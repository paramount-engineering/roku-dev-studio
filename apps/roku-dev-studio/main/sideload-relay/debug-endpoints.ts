/**
 * Self-contained debug endpoints for the Sideload Relay (RDS emulates a Roku).
 *
 * Previously these ports were transparent TCP proxies to a designated "primary"
 * real device. That model is gone — RDS now stands alone:
 *
 *  - 8081 (binary debug protocol): a STUB. On connect it sends the BrightScript
 *    debug-protocol handshake (magic + version) so the VS Code BrightScript
 *    "Debug: Launch" connection succeeds instead of failing with
 *    "device unreachable", then holds the socket and drains input. There is no
 *    Roku runtime behind it, so real breakpoints/stepping are NOT provided —
 *    the goal is purely to let the IDE hand the build over to RDS cleanly.
 *
 *  - 8085 (telnet console): a live status console. While a fan-out is running it
 *    streams per-device sideload progress to any connected client (e.g. the
 *    IDE's console). The connection is left OPEN after the run (like a real
 *    Roku console) — closing it makes roku-debug's TelnetAdapter report a lost
 *    connection ("Unable to connect to Roku…"), so we let the client hang up.
 *
 * Both bind whenever the relay is enabled (no toggle, no primary). The ECP
 * surface (8060) + SSDP discovery are handled separately by {@link RokuEmulator}
 * / {@link SsdpResponder}.
 */

import type { Server as NetServer, Socket } from 'net';

const net = require('net');
const { mainLog, mainWarn } = require('../log');
const { DEBUG_CONTROL_PORT, DEBUG_CONSOLE_PORT } = require('../../shared/sideload-relay/types');

/**
 * BrightScript debug-protocol handshake bytes: the 8-byte magic `bsdebug\0`
 * followed by protocol version major/minor/patch as little-endian uint32.
 * We advertise a legacy (pre-3.0.0) version so the client doesn't expect the
 * extended handshake-v3 fields. Best-effort — enough for the IDE to consider
 * the debugger "connected"; not a full protocol implementation.
 */
function buildDebugHandshake(): Buffer {
  const magic = Buffer.from('bsdebug\0', 'ascii'); // 8 bytes
  const version = Buffer.alloc(12);
  version.writeUInt32LE(1, 0); // major
  version.writeUInt32LE(0, 4); // minor
  version.writeUInt32LE(0, 8); // patch
  return Buffer.concat([magic, version]);
}

export class DebugEndpoints {
  private controlServer: NetServer | null = null;
  private consoleServer: NetServer | null = null;
  private listening = false;
  private lastError: string | undefined;

  /** Connected 8081 debug-protocol control clients (the IDE in debug-protocol mode). */
  private readonly controlClients = new Set<Socket>();
  /** Connected 8085 console clients (the IDE / a telnet session). */
  private readonly consoleClients = new Set<Socket>();
  /** Lines emitted during the current run, replayed to clients that connect mid-run. */
  private consoleBuffer: string[] = [];
  private runActive = false;
  /**
   * Whether a dev channel is currently "running" from the IDE's point of view.
   * Set once a fan-out installs successfully (we emit the run beacons), cleared
   * on app exit. Gates {@link endSession} so a pre-launch Home press (which
   * roku-debug fires during init) doesn't tear the session down early.
   */
  private appRunning = false;
  /** Pending timer for the delayed run-enter beacon (see signalAppLaunched). */
  private runEnterTimer: ReturnType<typeof setTimeout> | null = null;

  isListening(): boolean {
    return this.listening;
  }
  getLastError(): string | undefined {
    return this.lastError;
  }

  async start(): Promise<void> {
    if (this.listening) return;
    this.lastError = undefined;
    try {
      this.controlServer = await this.startControl();
      this.consoleServer = await this.startConsole();
      this.listening = true;
      mainLog(
        `[SideloadRelay] debug endpoints up (protocol stub :${DEBUG_CONTROL_PORT}, status console :${DEBUG_CONSOLE_PORT})`
      );
    } catch (e) {
      this.lastError = (e as Error)?.message || String(e);
      mainWarn('[SideloadRelay] debug endpoints failed to start:', this.lastError);
      await this.stop();
      throw e;
    }
  }

  async stop(): Promise<void> {
    this.listening = false;
    if (this.runEnterTimer) {
      clearTimeout(this.runEnterTimer);
      this.runEnterTimer = null;
    }
    this.appRunning = false;
    for (const c of this.controlClients) {
      try {
        c.destroy();
      } catch {
        /* ignore */
      }
    }
    this.controlClients.clear();
    for (const c of this.consoleClients) {
      try {
        c.destroy();
      } catch {
        /* ignore */
      }
    }
    this.consoleClients.clear();
    this.consoleBuffer = [];
    this.runActive = false;
    const close = (srv: NetServer | null) =>
      new Promise<void>((resolve) => {
        if (!srv) return resolve();
        srv.close(() => resolve());
      });
    await Promise.all([close(this.controlServer), close(this.consoleServer)]);
    this.controlServer = null;
    this.consoleServer = null;
  }

  /** 8081 — send the debug-protocol handshake, then hold the socket open. */
  private startControl(): Promise<NetServer> {
    const handshake = buildDebugHandshake();
    return new Promise((resolve, reject) => {
      const srv: NetServer = net.createServer((sock: Socket) => {
        const from = sock.remoteAddress || '?';
        mainLog(`[SideloadRelay] debug-protocol connect from ${from} — sending stub handshake`);
        this.controlClients.add(sock);
        const drop = () => this.controlClients.delete(sock);
        try {
          sock.write(handshake);
        } catch {
          /* client may have already gone */
        }
        // Absorb whatever the client sends; we don't speak the full protocol.
        sock.on('data', () => {});
        sock.on('error', drop);
        sock.on('close', drop);
      });
      srv.on('error', reject);
      srv.listen(DEBUG_CONTROL_PORT, () => resolve(srv));
    });
  }

  /** 8085 — register the client and stream fan-out status to it. */
  private startConsole(): Promise<NetServer> {
    return new Promise((resolve, reject) => {
      const srv: NetServer = net.createServer((sock: Socket) => {
        this.consoleClients.add(sock);
        const drop = () => this.consoleClients.delete(sock);
        sock.on('close', drop);
        sock.on('error', drop);
        try {
          sock.write('RokuDevStudio> Sideload Relay console connected.\r\n');
          if (this.runActive && this.consoleBuffer.length) {
            for (const line of this.consoleBuffer) sock.write(line);
          } else if (!this.runActive) {
            sock.write('RokuDevStudio> Waiting for a sideload…\r\n');
          }
        } catch {
          drop();
        }
      });
      srv.on('error', reject);
      srv.listen(DEBUG_CONSOLE_PORT, () => resolve(srv));
    });
  }

  private broadcast(line: string): void {
    const framed = line.endsWith('\n') ? line : `${line}\r\n`;
    if (this.runActive) this.consoleBuffer.push(framed);
    for (const c of this.consoleClients) {
      try {
        c.write(framed);
      } catch {
        /* client will be dropped on error/close */
      }
    }
  }

  /** Fan-out started — reset the buffer and print a header. */
  beginRun(filename: string, kb: number, targetCount: number): void {
    this.runActive = true;
    this.consoleBuffer = [];
    this.broadcast(
      `------ Sideloading '${filename}' (${kb} KB) to ${targetCount} device${targetCount === 1 ? '' : 's'} via Roku Dev Studio ------`
    );
  }

  /** One line of live status during the current run. */
  status(line: string): void {
    this.broadcast(line);
  }

  /**
   * Relay a target device's REAL 8085 console output verbatim to the IDE's
   * console clients. Unlike {@link status}/{@link broadcast} this does not add a
   * prefix or reframe the text, so the device's authentic output — including
   * compile errors, which roku-debug's CompileErrorProcessor parses — reaches
   * the IDE unchanged. Best-effort; not buffered (avoids unbounded growth).
   */
  relayDeviceOutput(text: string): void {
    for (const c of this.consoleClients) {
      try {
        c.write(text);
      } catch {
        /* dropped on close */
      }
    }
  }

  /**
   * Fan-out finished — print a summary but KEEP the console connections open.
   *
   * A real Roku's telnet 8085 console stays open for the whole session; the VS
   * Code BrightScript extension (roku-debug's TelnetAdapter) relies on that and
   * treats an unexpected close as a lost connection, surfacing the misleading
   * "Unable to connect to Roku. Is another device already connected?" error.
   * So we leave the socket open and let the client (IDE, or a manual telnet)
   * disconnect on its own; `drop()` cleans up when it does.
   */
  endRun(summary: string): void {
    this.broadcast(summary);
    this.broadcast('------ Sideload Relay run complete ------');
    this.runActive = false;
  }

  /**
   * Emit the console beacons roku-debug's TelnetAdapter watches for to consider
   * the dev channel compiled + running: `[beacon.signal] |AppCompileComplete`
   * (→ its `app-ready`) and `[scrpt.ctx.run.enter]` (→ `isAppRunning = true`).
   * Called once a fan-out install succeeds. Mirrors a real Roku's console.
   */
  signalAppLaunched(): void {
    this.appRunning = true;
    this.broadcast('[beacon.signal] |AppCompileComplete --- Sideload Relay dev channel ready');
    // roku-debug's TelnetAdapter only records the "app running" beacon
    // (`[scrpt.ctx.run.enter]`) while it is ACTIVATED, and it activates a beat
    // AFTER the compile-complete beacon (it finishes the publish step first).
    // Emitting both back-to-back races that activation and the run beacon gets
    // dropped, leaving the IDE stuck on "Launching". Emit it after a short delay
    // so activation has happened and the launch completes cleanly.
    if (this.runEnterTimer) clearTimeout(this.runEnterTimer);
    this.runEnterTimer = setTimeout(() => {
      this.runEnterTimer = null;
      if (this.appRunning) this.broadcast('[scrpt.ctx.run.enter] Sideload Relay dev channel started');
    }, 600);
  }

  /**
   * Mark the channel "running" WITHOUT emitting synthetic beacons — used when a
   * real device console is being relayed to the IDE (its authentic
   * `AppCompileComplete`/`run.enter` beacons drive the launch, so synthetic ones
   * would just duplicate and interfere). Enables the {@link endSession} guard.
   */
  markAppRunning(): void {
    if (this.runEnterTimer) {
      clearTimeout(this.runEnterTimer);
      this.runEnterTimer = null;
    }
    this.appRunning = true;
  }

  /**
   * End the emulated debug session cleanly, whichever mode the IDE is in:
   *
   *  - Telnet mode: emit `[beacon.report] |AppExitComplete`, the line roku-debug's
   *    TelnetAdapter matches to fire `app-exit` → a clean `shutdown()`.
   *  - Debug-protocol mode: gracefully `end()` the 8081 control socket. roku-debug's
   *    protocol client treats a normal FIN close as `app-exit` (a socket *error*
   *    is what it treats as the fatal "Unable to connect"), so this ends cleanly.
   *
   * Used both for the post-install auto-end and a Home press. No-op unless a
   * channel is running, so the pre-launch Home press the adapter sends during
   * init is ignored.
   *
   * @returns true if a session was actually ended.
   */
  endSession(reason: string): boolean {
    if (this.runEnterTimer) {
      clearTimeout(this.runEnterTimer);
      this.runEnterTimer = null;
    }
    if (!this.appRunning) return false;
    this.appRunning = false;

    // Telnet-mode termination: narrate + emit the app-exit beacon.
    this.broadcast(`[Sideload Relay] ${reason}`);
    this.broadcast('[beacon.report] |AppExitComplete --- Sideload Relay session ended');

    // Debug-protocol-mode termination: gracefully close the 8081 control socket.
    for (const c of this.controlClients) {
      try {
        c.end();
      } catch {
        /* ignore */
      }
    }
    this.controlClients.clear();

    mainLog('[SideloadRelay] ended IDE debug session (app-exit): ' + reason);
    return true;
  }
}

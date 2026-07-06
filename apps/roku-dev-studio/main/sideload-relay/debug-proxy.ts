/**
 * P4 — "BrightScript Debug: Launch" support.
 *
 * With `host = <RDS-ip>`, VS Code's roku-debug sends ECP (8060), the debug
 * protocol control socket (8081), and the telnet console (8085) to RDS instead
 * of a device. RDS handles them as:
 *
 *   - **8060 (ECP)** — a full {@link RokuEmulator}: RDS answers device-info,
 *     app queries, and remote commands itself as a developer-enabled Roku (so
 *     the launch pre-flight and roku-deploy discovery pass with no reachable
 *     device), and forwards keypress/launch/… to the primary + fleet.
 *   - **8081 / 8085** — transparent TCP relays to the primary. Because both are
 *     opaque socket streams, RDS forwards bytes without parsing the debug
 *     protocol; the debugger attaches to the primary and breakpoints work there.
 *
 * The sideload itself (port 80) is handled by the ingest server + fan-out; this
 * module only covers the fixed Roku ports the debugger assumes.
 */

import type { Server } from 'http';
import type { Server as NetServer, Socket } from 'net';

const net = require('net');
const { mainLog, mainWarn } = require('../log');
const { DEBUG_CONTROL_PORT, DEBUG_CONSOLE_PORT, ECP_PORT } = require('../../shared/sideload-relay/types');
import { RokuEmulator } from './roku-emulator';

export interface DebugProxyCallbacks {
  /** ip of the current primary/debug device, or null when none is set. */
  getPrimaryIp: () => string | null;
  /** Other enabled target IPs to optionally replay keypress/launch to (best-effort). */
  getReplayIps: () => string[];
}

export class DebugProxy {
  private ecpServer: Server | null = null;
  private controlServer: NetServer | null = null;
  private consoleServer: NetServer | null = null;
  private listening = false;
  private lastError: string | undefined;
  private readonly cb: DebugProxyCallbacks;
  private readonly emulator: RokuEmulator;

  constructor(cb: DebugProxyCallbacks) {
    this.cb = cb;
    this.emulator = new RokuEmulator({
      getPrimaryIp: () => this.cb.getPrimaryIp(),
      getReplayIps: () => this.cb.getReplayIps()
    });
  }

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
      this.ecpServer = await this.emulator.listen();
      this.controlServer = await this.startTcpProxy(DEBUG_CONTROL_PORT, 'debug-control');
      this.consoleServer = await this.startTcpProxy(DEBUG_CONSOLE_PORT, 'debug-console');
      this.listening = true;
      mainLog(`[SideloadRelay] debug proxy up (ECP emulator :${ECP_PORT}, control :${DEBUG_CONTROL_PORT}, console :${DEBUG_CONSOLE_PORT})`);
    } catch (e) {
      this.lastError = (e as Error)?.message || String(e);
      mainWarn('[SideloadRelay] debug proxy failed to start:', this.lastError);
      await this.stop();
      throw e;
    }
  }

  async stop(): Promise<void> {
    this.listening = false;
    const close = (srv: Server | NetServer | null) =>
      new Promise<void>((resolve) => {
        if (!srv) return resolve();
        srv.close(() => resolve());
      });
    await Promise.all([close(this.ecpServer), close(this.controlServer), close(this.consoleServer)]);
    this.ecpServer = null;
    this.controlServer = null;
    this.consoleServer = null;
  }

  private startTcpProxy(port: number, label: string): Promise<NetServer> {
    return new Promise((resolve, reject) => {
      const srv: NetServer = net.createServer((client: Socket) => {
        const primary = this.cb.getPrimaryIp();
        if (!primary) {
          client.destroy();
          return;
        }
        const upstream: Socket = net.connect(port, primary);
        const teardown = () => {
          client.destroy();
          upstream.destroy();
        };
        client.on('error', teardown);
        upstream.on('error', (e: Error) => {
          mainWarn(`[SideloadRelay] ${label} upstream error (${primary}:${port}):`, e.message);
          teardown();
        });
        client.on('close', () => upstream.destroy());
        upstream.on('close', () => client.destroy());
        client.pipe(upstream);
        upstream.pipe(client);
      });
      srv.on('error', reject);
      srv.listen(port, () => resolve(srv));
    });
  }
}

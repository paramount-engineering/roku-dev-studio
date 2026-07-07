/**
 * Sideload Relay service — orchestrates the ingest server (port 80→fallback),
 * the optional debug proxy (8060/8081/8085), and the fan-out engine. Holds the
 * current boot config and surfaces status + per-run results through a
 * transport-agnostic {@link RelayListener} (the Electron adapter maps these
 * onto IPC channels).
 *
 * Mirrors the Network Inspector service shape: a lazily-created singleton that
 * `setConfig()` re-boots from settings, `getStatus()` reports on, and
 * `dispose()` tears down on quit.
 */

import type {
  RelayBootConfig,
  RelayDeviceResult,
  RelayListener,
  RelayRunStarted,
  RelayStatus,
  RelayTarget
} from '../../shared/sideload-relay/types';
import type { Server } from 'http';
import { RelayIngestServer, type RelayUpload } from './relay-server';
import { DebugEndpoints } from './debug-endpoints';
import { SsdpResponder } from './ssdp-responder';
import { RokuEmulator } from './roku-emulator';
import { runFanout, type FanoutTarget, type RemoteFanoutOps } from './fanout';

const { mainLog, mainWarn } = require('../log');
const { DEFAULT_RELAY_PORT } = require('../../shared/sideload-relay/types');
const { subscribeDebugTelnetData } = require('../ipc/telnet-handlers') as {
  subscribeDebugTelnetData: (ip: string, cb: (text: string) => void) => () => void;
};

function defaultConfig(): RelayBootConfig {
  return {
    enabled: false,
    requestedPort: DEFAULT_RELAY_PORT,
    password: '',
    targets: [],
    targetPasswords: {},
    autoConsole: true,
    retryOnFailure: false
  };
}

/**
 * Gate for a sideload arriving from a machine other than this one. Returns a
 * promise that resolves true to allow, false to deny. Injected by the Electron
 * layer (native dialog); undefined in non-Electron contexts (always allowed).
 */
export type AuthorizeSource = (info: { ip: string }) => Promise<boolean>;

export class SideloadRelayService {
  private readonly listener: RelayListener;
  private readonly ingest: RelayIngestServer;
  private readonly proxy: DebugEndpoints;
  private readonly ssdp: SsdpResponder;
  private readonly emulator: RokuEmulator;
  /** The 8060 ECP emulator http server (runs whenever the relay is enabled). */
  private emulatorServer: Server | null = null;
  private config: RelayBootConfig = defaultConfig();
  private runCounter = 0;
  private disposed = false;
  /** Most recent run + its per-device results, so a UI opened after a sideload can render it. */
  private lastRun: RelayRunStarted | null = null;
  private lastResults = new Map<string, RelayDeviceResult>();
  /** Active tap forwarding a representative device's console to the IDE (compile errors + logs). */
  private deviceTapUnsub: (() => void) | null = null;
  private deviceTapTimer: ReturnType<typeof setTimeout> | null = null;
  /** Session-end orchestration: fires once the real device signals it's up, or a cap. */
  private endArmed = false;
  private endGraceTimer: ReturnType<typeof setTimeout> | null = null;
  private endCapTimer: ReturnType<typeof setTimeout> | null = null;
  private endEmitTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly remoteOps?: RemoteFanoutOps;

  constructor(listener: RelayListener, authorizeSource?: AuthorizeSource, remoteOps?: RemoteFanoutOps) {
    this.listener = listener;
    this.remoteOps = remoteOps;
    this.proxy = new DebugEndpoints();
    this.ingest = new RelayIngestServer({
      getPassword: () => this.config.password,
      getTargets: () => this.enabledTargets().map((t) => ({ name: t.name || t.ip, ip: t.ip })),
      // Wrap the host's allow/deny gate so the approval flow streams to the 8085
      // console (the IDE's debug console) — the requester sees exactly what RDS
      // is waiting on and whether it was approved.
      authorizeSource: authorizeSource ? (info) => this.authorizeWithConsole(authorizeSource, info) : undefined,
      onUpload: (upload) => this.handleUpload(upload),
      onDelete: () => mainLog('[SideloadRelay] received Delete request (fan-out of Delete not yet enabled)')
    });
    this.ssdp = new SsdpResponder();
    this.emulator = new RokuEmulator({
      // Home press (e.g. VS Code Stop) → end the emulated debug session cleanly
      // (stops the device-console tap first, then signals app-exit). The fleet is
      // never driven by the IDE, so nothing is forwarded to devices.
      onHomePress: () => this.endIdeSession()
    });
  }

  private emulatorListening(): boolean {
    return this.emulatorServer != null;
  }

  private closeEmulator(): Promise<void> {
    const srv = this.emulatorServer;
    this.emulatorServer = null;
    if (!srv) return Promise.resolve();
    return new Promise<void>((resolve) => srv.close(() => resolve()));
  }

  private enabledTargets(): RelayTarget[] {
    return (this.config.targets || []).filter((t) => t && t.enabled && !!t.ip);
  }

  getStatus(): RelayStatus {
    return {
      enabled: this.config.enabled,
      listening: this.ingest.isListening(),
      boundPort: this.ingest.getBoundPort(),
      requestedPort: this.config.requestedPort,
      addresses: this.ingest.getAddresses(),
      lastError: this.ingest.getLastError() || this.proxy.getLastError(),
      debugEndpointsListening: this.proxy.isListening(),
      ecpEmulatorListening: this.emulatorListening(),
      ssdpAdvertising: this.ssdp.isListening()
    };
  }

  private emitStatus(): void {
    try {
      this.listener.onStatus(this.getStatus());
    } catch {
      /* best-effort */
    }
  }

  /** The most recent run + per-device results (for a UI that opens after a sideload). */
  getLastRun(): { run: RelayRunStarted | null; results: RelayDeviceResult[] } {
    return { run: this.lastRun, results: Array.from(this.lastResults.values()) };
  }

  /** Re-boot the relay from a fresh config (called on startup and on settings change). */
  async setConfig(next: RelayBootConfig): Promise<void> {
    if (this.disposed) return;
    const prev = this.config;
    this.config = { ...defaultConfig(), ...next };

    const portChanged = prev.requestedPort !== this.config.requestedPort;
    const enableChanged = prev.enabled !== this.config.enabled;

    // Ingest server: bind only while enabled.
    try {
      if (this.config.enabled && (!this.ingest.isListening() || portChanged || enableChanged)) {
        await this.ingest.start(this.config.requestedPort);
      } else if (!this.config.enabled && this.ingest.isListening()) {
        await this.ingest.stop();
      }
    } catch (e) {
      mainWarn('[SideloadRelay] ingest (re)start failed:', (e as Error)?.message || e);
    }

    // ECP emulator (8060) + SSDP advertisement: run whenever the relay is
    // enabled, so RDS is discoverable in VS Code and answers roku-debug's
    // device-info pre-flight WITHOUT needing a primary/debug device. (This used
    // to be gated behind the debug-proxy toggle, which made the relay look
    // undiscoverable unless you also flipped that second switch.)
    const wantEmulator = this.config.enabled;
    try {
      if (wantEmulator && !this.emulatorListening()) {
        this.emulatorServer = await this.emulator.listen();
      } else if (!wantEmulator && this.emulatorListening()) {
        await this.closeEmulator();
      }
    } catch (e) {
      mainWarn('[SideloadRelay] ECP emulator (re)start failed:', (e as Error)?.message || e);
    }
    try {
      if (wantEmulator && !this.ssdp.isListening()) {
        await this.ssdp.start();
      } else if (!wantEmulator && this.ssdp.isListening()) {
        await this.ssdp.stop();
      }
    } catch (e) {
      mainWarn('[SideloadRelay] SSDP responder (re)start failed:', (e as Error)?.message || e);
    }

    // Debug endpoints (8081 protocol stub + 8085 status console): run whenever
    // the relay is enabled, so the VS Code "Debug: Launch" connect always
    // succeeds and the fan-out status streams to the console. RDS emulates these
    // itself — no primary/real device required.
    const wantProxy = this.config.enabled;
    try {
      if (wantProxy && !this.proxy.isListening()) {
        await this.proxy.start();
      } else if (!wantProxy && this.proxy.isListening()) {
        await this.proxy.stop();
      }
    } catch (e) {
      mainWarn('[SideloadRelay] debug endpoints (re)start failed:', (e as Error)?.message || e);
    }

    this.emitStatus();
  }

  private nextRunId(): string {
    this.runCounter += 1;
    return `relay-${Date.now()}-${this.runCounter}`;
  }

  /**
   * Run the host's allow/deny gate for an external (different-machine) deploy,
   * narrating the whole approval flow to the 8085 console so the requester (the
   * IDE's debug console) sees that RDS is waiting on the host, and the outcome.
   */
  private async authorizeWithConsole(
    authorize: AuthorizeSource,
    info: { ip: string }
  ): Promise<boolean> {
    this.proxy.status(`[Sideload Relay] Deploy request from ${info.ip}.`);
    this.proxy.status('[Sideload Relay] Waiting for the Roku Dev Studio host to allow this device… (a prompt is open on the host)');
    let ok = false;
    try {
      ok = await authorize(info);
    } catch {
      ok = false;
    }
    if (ok) {
      this.proxy.status('[Sideload Relay] ✓ Approved by the Roku Dev Studio host — continuing the install.');
    } else {
      this.proxy.status('[Sideload Relay] ✗ Denied by the Roku Dev Studio host (or the prompt timed out). Deploy cancelled.');
    }
    return ok;
  }

  private buildFanoutTargets(): FanoutTarget[] {
    // Per-device install password comes ONLY from the shared device-credential
    // store (validated via the setup modal / Dev App). The relay's own Dev
    // Password (IDE→RDS auth) is a separate concept and not used here.
    const pwds = this.config.targetPasswords || {};
    return this.enabledTargets().map((t) => ({
      id: t.id,
      ip: t.ip,
      name: t.name || t.ip,
      password: pwds[t.id] || '',
      remote: !!t.remote,
      location: t.location,
      serverUrl: t.serverUrl
    }));
  }

  /**
   * Tap a representative LOCAL target's real 8085 console and forward it verbatim
   * to the IDE's relay console, so the device's actual compile errors and logs
   * surface in the IDE. (Remote-location devices stream over their own server and
   * aren't tapped here.) Best-effort; auto-stops after a window or on dispose.
   */
  private startDeviceTap(targets: FanoutTarget[]): void {
    this.stopDeviceTap();
    const rep = targets.find((t) => !t.remote && !!t.ip);
    if (!rep) return;
    try {
      this.deviceTapUnsub = subscribeDebugTelnetData(rep.ip, (text) => {
        this.proxy.relayDeviceOutput(text);
        this.watchForLaunchComplete(text);
      });
      mainLog(`[SideloadRelay] relaying ${rep.name} (${rep.ip}) console to the IDE for this run`);
    } catch {
      this.deviceTapUnsub = null;
    }
    // Safety net: stop tapping after 2 minutes even if nothing else clears it.
    this.deviceTapTimer = setTimeout(() => this.stopDeviceTap(), 120_000);
  }

  private stopDeviceTap(): void {
    if (this.deviceTapTimer) {
      clearTimeout(this.deviceTapTimer);
      this.deviceTapTimer = null;
    }
    if (this.deviceTapUnsub) {
      try {
        this.deviceTapUnsub();
      } catch {
        /* ignore */
      }
      this.deviceTapUnsub = null;
    }
  }

  /**
   * Watch the relayed device console for the real "app fully launched" beacon.
   * Once seen, arm the session-end (after a short grace for trailing output).
   * This is what makes the end reliable across repeated launches: we key off the
   * device's own lifecycle instead of racing a fixed timer against a live stream.
   */
  private watchForLaunchComplete(text: string): void {
    if (this.endArmed) return;
    if (/\[beacon\.signal\] \|AppLaunchChainComplete/i.test(text) || /\[scrpt\.ctx\.run\.enter\]/i.test(text)) {
      this.endArmed = true;
      this.scheduleEnd(1200);
    }
  }

  /** Clear any pending end/cap/emit timers and reset the arm flag (per-run reset). */
  private resetEndState(): void {
    this.endArmed = false;
    for (const key of ['endGraceTimer', 'endCapTimer', 'endEmitTimer'] as const) {
      const t = this[key];
      if (t) {
        clearTimeout(t);
        this[key] = null;
      }
    }
  }

  private scheduleEnd(delayMs: number): void {
    if (this.endGraceTimer) clearTimeout(this.endGraceTimer);
    this.endGraceTimer = setTimeout(() => {
      this.endGraceTimer = null;
      this.endIdeSession();
    }, delayMs);
  }

  /**
   * End the IDE debug session cleanly. Crucially, STOP the device tap first so no
   * more real device output trails behind — then, after a brief quiet gap, emit
   * the app-exit signal into a silent stream. Without the quiet gap the continuous
   * device output (esp. on a second launch, when the app is already running) keeps
   * resetting roku-debug's app-exit timer, so the session never ends.
   */
  private endIdeSession(): void {
    this.resetEndState();
    this.stopDeviceTap();
    this.endEmitTimer = setTimeout(() => {
      this.endEmitTimer = null;
      this.proxy.endSession('Deploy complete — ending the IDE debug session; the devices keep running under Roku Dev Studio.');
    }, 300);
  }

  private handleUpload(upload: RelayUpload): void {
    const runId = this.nextRunId();
    const targets = this.buildFanoutTargets();
    const debugLaunch = upload.remotedebug;

    const run: RelayRunStarted = {
      runId,
      filename: upload.filename,
      bytes: upload.bytes,
      targetIds: targets.map((t) => t.id),
      debugLaunch,
      startedAt: Date.now()
    };
    this.lastRun = run;
    this.lastResults.clear();
    this.resetEndState(); // fresh end-orchestration for this launch
    try {
      this.listener.onRunStarted(run);
    } catch {
      /* best-effort */
    }

    if (targets.length === 0) {
      mainWarn('[SideloadRelay] upload received but no enabled targets — nothing to fan out to');
    }

    // Relay one representative device's real console (compile errors + logs) to
    // the IDE for the duration of the run.
    this.startDeviceTap(targets);
    // Mark the session running as soon as the tap is live so a launch-complete
    // beacon seen mid-fan-out can end the session even before the fan-out
    // resolves — otherwise the end could fire while appRunning is still false
    // (a no-op) and only the cap timer would rescue it, ~15s late.
    if (this.deviceTapUnsub) this.proxy.markAppRunning();

    // Kick off the live 8085 status console for this run.
    this.proxy.beginRun(upload.filename, Math.round(upload.bytes / 1024), targets.length);
    if (targets.length) {
      for (const t of targets) {
        const via = t.remote ? ` — via ${t.location || 'remote'}` : '';
        this.proxy.status(`  • ${t.name} (${t.ip})${via}`);
      }
    } else {
      this.proxy.status('  (no enabled + reachable target devices — nothing to install to)');
    }
    const consoleDone = new Set<string>();

    const stepWord = (s: RelayDeviceResult['install']) =>
      s.state === 'ok' ? 'ok' : s.state === 'error' ? `FAILED (${s.message || 'error'})` : s.state;

    // Cache each per-device result before forwarding so a UI opened later can
    // render the latest run via getLastRun(), and stream a one-line summary to
    // the 8085 console the first time each device settles.
    const cachingListener: RelayListener = {
      onStatus: (s) => this.listener.onStatus(s),
      onRunStarted: (r) => this.listener.onRunStarted(r),
      onDeviceResult: (result) => {
        this.lastResults.set(result.targetId, result);
        this.listener.onDeviceResult(result);
        if (result.done && !consoleDone.has(result.targetId)) {
          consoleDone.add(result.targetId);
          const ok = result.install.state === 'ok';
          this.proxy.status(
            `[${ok ? ' OK ' : 'FAIL'}] ${result.name} (${result.ip}): ` +
              `install ${stepWord(result.install)}, console ${stepWord(result.console)}`
          );
        }
      }
    };

    void runFanout(
      {
        runId,
        packagePath: upload.filePath,
        targets,
        autoConsole: this.config.autoConsole,
        retryOnFailure: this.config.retryOnFailure,
        remoteOps: this.remoteOps
      },
      cachingListener
    )
      .then(() => {
        const results = Array.from(this.lastResults.values());
        const okCount = results.filter((r) => r.install.state === 'ok').length;
        this.proxy.endRun(`Installed on ${okCount}/${results.length} device(s).`);
        if (okCount > 0) {
          // Tell the requester where the real logs live — this console only
          // carries deploy status; each device's actual output (print, crashes,
          // BrightScript errors) streams in the Roku Dev Studio window.
          this.proxy.status(`The channel is now installed and running on ${okCount} device${okCount === 1 ? '' : 's'}.`);
          this.proxy.status('▶ Switch to the Roku Dev Studio window to watch each device’s live logs (Console / telnet 8085 per device) and control the devices.');
          this.proxy.status('  (This IDE console shows Sideload Relay deploy status only; the devices now are independently controlled by Roku Dev Studio.)');
          // With a tap, the device's authentic beacons drive the launch (already
          // marked running above). Without one, emit the synthetic beacons so the
          // launch still completes.
          if (!this.deviceTapUnsub) this.proxy.signalAppLaunched();
          // End the IDE session once the real device signals it's up (watched in
          // the tap) — or a cap, so it always ends even on compile error / no tap.
          this.endCapTimer = setTimeout(() => {
            this.endCapTimer = null;
            this.endIdeSession();
          }, this.deviceTapUnsub ? 15_000 : 2_000);
        } else {
          this.proxy.status('No device was installed — check device reachability, dev mode, and the saved password, then retry.');
        }
      })
      .catch((e) => {
        mainWarn('[SideloadRelay] fan-out error:', (e as Error)?.message || e);
        this.proxy.endRun('Fan-out error — see RDS logs.');
      });
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.resetEndState();
    this.stopDeviceTap();
    try {
      await this.ingest.stop();
    } catch {
      /* ignore */
    }
    this.ingest.cleanupTemp();
    try {
      await this.proxy.stop();
    } catch {
      /* ignore */
    }
    try {
      await this.ssdp.stop();
    } catch {
      /* ignore */
    }
    try {
      await this.closeEmulator();
    } catch {
      /* ignore */
    }
  }
}

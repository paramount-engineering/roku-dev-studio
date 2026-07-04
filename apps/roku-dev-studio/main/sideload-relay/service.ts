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
import { RelayIngestServer, type RelayUpload } from './relay-server';
import { DebugProxy } from './debug-proxy';
import { SsdpResponder } from './ssdp-responder';
import { runFanout, type FanoutTarget } from './fanout';

const { mainLog, mainWarn } = require('../log');
const { DEFAULT_RELAY_PORT } = require('../../shared/sideload-relay/types');

function defaultConfig(): RelayBootConfig {
  return {
    enabled: false,
    requestedPort: DEFAULT_RELAY_PORT,
    password: '',
    targets: [],
    targetPasswords: {},
    autoLaunch: true,
    autoConsole: true,
    debugProxyEnabled: false,
    retryOnFailure: false
  };
}

export class SideloadRelayService {
  private readonly listener: RelayListener;
  private readonly ingest: RelayIngestServer;
  private readonly proxy: DebugProxy;
  private readonly ssdp: SsdpResponder;
  private config: RelayBootConfig = defaultConfig();
  private runCounter = 0;
  private disposed = false;
  /** Most recent run + its per-device results, so a UI opened after a sideload can render it. */
  private lastRun: RelayRunStarted | null = null;
  private lastResults = new Map<string, RelayDeviceResult>();

  constructor(listener: RelayListener) {
    this.listener = listener;
    this.ingest = new RelayIngestServer({
      getPassword: () => this.config.password,
      onUpload: (upload) => this.handleUpload(upload),
      onDelete: () => mainLog('[SideloadRelay] received Delete request (fan-out of Delete not yet enabled)')
    });
    this.proxy = new DebugProxy({
      getPrimaryIp: () => this.primaryTarget()?.ip || null,
      getReplayIps: () => this.enabledTargets().map((t) => t.ip)
    });
    this.ssdp = new SsdpResponder();
  }

  private enabledTargets(): RelayTarget[] {
    return (this.config.targets || []).filter((t) => t && t.enabled && !!t.ip);
  }
  private primaryTarget(): RelayTarget | undefined {
    return this.enabledTargets().find((t) => t.primary);
  }

  getStatus(): RelayStatus {
    return {
      enabled: this.config.enabled,
      listening: this.ingest.isListening(),
      boundPort: this.ingest.getBoundPort(),
      requestedPort: this.config.requestedPort,
      addresses: this.ingest.getAddresses(),
      lastError: this.ingest.getLastError() || this.proxy.getLastError(),
      debugProxyListening: this.proxy.isListening(),
      ssdpAdvertising: this.ssdp.isListening(),
      primaryIp: this.primaryTarget()?.ip || null
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

    // Debug proxy + SSDP advertisement: bind only while enabled AND the debug
    // path is requested. SSDP makes RDS discoverable in VS Code; the proxy
    // serves the synthetic device-info the discoverer follows to.
    const wantProxy = this.config.enabled && this.config.debugProxyEnabled;
    try {
      if (wantProxy && !this.proxy.isListening()) {
        await this.proxy.start();
      } else if (!wantProxy && this.proxy.isListening()) {
        await this.proxy.stop();
      }
    } catch (e) {
      mainWarn('[SideloadRelay] debug proxy (re)start failed:', (e as Error)?.message || e);
    }
    try {
      if (wantProxy && !this.ssdp.isListening()) {
        await this.ssdp.start();
      } else if (!wantProxy && this.ssdp.isListening()) {
        await this.ssdp.stop();
      }
    } catch (e) {
      mainWarn('[SideloadRelay] SSDP responder (re)start failed:', (e as Error)?.message || e);
    }

    this.emitStatus();
  }

  private nextRunId(): string {
    this.runCounter += 1;
    return `relay-${Date.now()}-${this.runCounter}`;
  }

  private buildFanoutTargets(): FanoutTarget[] {
    const pwds = this.config.targetPasswords || {};
    return this.enabledTargets().map((t) => ({
      id: t.id,
      ip: t.ip,
      name: t.name || t.ip,
      password: pwds[t.id] || this.config.password,
      primary: !!t.primary
    }));
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
    try {
      this.listener.onRunStarted(run);
    } catch {
      /* best-effort */
    }

    if (targets.length === 0) {
      mainWarn('[SideloadRelay] upload received but no enabled targets — nothing to fan out to');
    }

    // Cache each per-device result before forwarding so a UI opened later can
    // render the latest run via getLastRun().
    const cachingListener: RelayListener = {
      onStatus: (s) => this.listener.onStatus(s),
      onRunStarted: (r) => this.listener.onRunStarted(r),
      onDeviceResult: (result) => {
        this.lastResults.set(result.targetId, result);
        this.listener.onDeviceResult(result);
      }
    };

    void runFanout(
      {
        runId,
        packagePath: upload.filePath,
        targets,
        autoLaunch: this.config.autoLaunch,
        autoConsole: this.config.autoConsole,
        debugLaunch,
        retryOnFailure: this.config.retryOnFailure
      },
      cachingListener
    ).catch((e) => mainWarn('[SideloadRelay] fan-out error:', (e as Error)?.message || e));
  }

  async dispose(): Promise<void> {
    this.disposed = true;
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
  }
}

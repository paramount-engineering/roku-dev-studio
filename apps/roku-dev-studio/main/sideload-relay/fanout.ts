/**
 * Sideload Relay fan-out engine.
 *
 * Given a saved package and the set of enabled targets, forwards the install
 * to every device in parallel (best-effort — one failure never blocks peers),
 * then per device auto-connects the telnet console. The channel auto-launches
 * on install, so the relay never issues an explicit launch. Each step's outcome
 * is streamed back through the listener as a `RelayDeviceResult` so the renderer
 * can render live per-device status.
 *
 * Every enabled target is a plain install → console. There is no
 * "primary/debug device" special-casing anymore: RDS emulates the debug
 * endpoints (8081/8085) itself, so devices never need `remotedebug=1` and the
 * whole fleet just runs the build.
 */

import type {
  RelayDeviceResult,
  RelayListener,
  RelayStepResult,
  RelayStepState
} from '../../shared/sideload-relay/types';

const rokuApi = require('roku-dev-studio-api') as {
  sideloadChannel: (opts: {
    ip: string;
    filePath: string;
    password: string;
    log?: (msg: string) => void;
    extraFields?: { name: string; value: string }[];
    cleanInstall?: boolean;
  }) => Promise<{ success: boolean; error?: string; message?: string }>;
};
const { ensureDebugTelnetConnected } = require('../ipc/telnet-handlers') as {
  ensureDebugTelnetConnected: (
    ip: string,
    options?: { holder?: string }
  ) => Promise<{ success: boolean; error?: string }>;
};
const { mainLog, mainWarn } = require('../log');

/** A target with its credentials already resolved by the service. */
export interface FanoutTarget {
  id: string;
  ip: string;
  name: string;
  password: string;
  /** True for a remote-location device — install/console route through its server. */
  remote?: boolean;
  /** Human location label (e.g. "Local" or a remote location name). */
  location?: string;
  /** Remote server base URL (remote targets only). */
  serverUrl?: string;
  /**
   * Per-device opt-in (persisted from the Dev App "Sideload with Debugging"
   * checkbox): fan out this target's install with `remotedebug=1` so its real
   * debug protocol port (8081) opens for the BrightScript debugger. Local
   * targets only — debug-over-relay for remote targets isn't supported yet.
   */
  remoteDebug?: boolean;
}

/** Remote-server operations injected by the Electron layer for remote-target fan-out. */
export interface RemoteFanoutOps {
  sideload: (serverUrl: string, ip: string, filePath: string, password: string) => Promise<{ success: boolean; error?: string }>;
  ensureConsole: (serverUrl: string, ip: string, options?: { holder?: string }) => Promise<{ success: boolean; error?: string }>;
}

export interface FanoutOptions {
  runId: string;
  packagePath: string;
  targets: FanoutTarget[];
  autoConsole: boolean;
  /** Retry a failed install once before reporting failure (P5). */
  retryOnFailure: boolean;
  /** Remote-server ops for remote targets; absent = remote targets error out. */
  remoteOps?: RemoteFanoutOps;
}

function step(state: RelayStepState, message?: string, durationMs?: number): RelayStepResult {
  return { state, ...(message ? { message } : {}), ...(durationMs != null ? { durationMs } : {}) };
}

/** Run the fan-out. Resolves once every target's chain has settled. */
export async function runFanout(opts: FanoutOptions, listener: RelayListener): Promise<void> {
  const { runId, packagePath, targets, autoConsole, retryOnFailure } = opts;

  await Promise.all(
    targets.map(async (target) => {
      const result: RelayDeviceResult = {
        runId,
        targetId: target.id,
        ip: target.ip,
        name: target.name,
        install: step('pending'),
        console: step('pending'),
        done: false
      };
      const emit = () => {
        try {
          listener.onDeviceResult({ ...result });
        } catch {
          /* listener best-effort */
        }
      };
      emit();

      // Pick local (direct-IP) or remote (via the location's RDS server) transport.
      // A remote target with no server/ops available can't be reached — error out
      // clearly instead of attempting a direct-IP install (which could hit a
      // different device sharing that IP on the local network).
      const isRemote = !!target.remote;
      if (isRemote && (!target.serverUrl || !opts.remoteOps)) {
        result.install = step('error', `Remote location for ${target.name} is unavailable`);
        result.console = step('skipped', 'remote unavailable');
        result.done = true;
        emit();
        return;
      }
      const doInstall = () =>
        isRemote
          ? opts.remoteOps!.sideload(target.serverUrl!, target.ip, packagePath, target.password)
          : rokuApi.sideloadChannel({
              ip: target.ip,
              filePath: packagePath,
              password: target.password,
              log: (m: string) => mainLog(`[SideloadRelay ${target.ip}]`, m),
              // Honor the per-device "Sideload with Debugging" preference so the
              // fleet's debug-enabled devices open port 8081 (local only). Debug
              // launches force a clean Delete+Install so remotedebug=1 is honored.
              ...(target.remoteDebug ? { extraFields: [{ name: 'remotedebug', value: '1' }], cleanInstall: true } : {})
            });
      const doConsole = () =>
        isRemote
          ? opts.remoteOps!.ensureConsole(target.serverUrl!, target.ip, { holder: 'sideload-relay' })
          : ensureDebugTelnetConnected(target.ip, { holder: 'sideload-relay' });
      const where = isRemote ? `${target.name} via ${target.location || 'remote'}` : `${target.name} (${target.ip})`;

      // --- Install ---
      result.install = step('running');
      emit();
      const installStart = Date.now();
      let installOk = false;
      let installErr = '';
      try {
        let r = await doInstall();
        if (!r.success && retryOnFailure) {
          mainWarn(`[SideloadRelay] install failed on ${where} (${r.error}); retrying once`);
          r = await doInstall();
        }
        installOk = !!r.success;
        installErr = r.error || (installOk ? '' : 'Install failed');
      } catch (e) {
        installErr = (e as Error)?.message || String(e);
      }
      result.install = step(installOk ? 'ok' : 'error', installOk ? undefined : installErr, Date.now() - installStart);
      emit();
      if (installOk) {
        mainLog(`[SideloadRelay] installed on ${where}`);
      }

      if (!installOk) {
        result.console = step('skipped', 'install failed');
        result.done = true;
        emit();
        return;
      }

      // --- Auto-connect console --- (the channel auto-launches on install)
      if (autoConsole) {
        result.console = step('running');
        emit();
        const consoleStart = Date.now();
        try {
          const cr = await doConsole();
          result.console = step(cr.success ? 'ok' : 'error', cr.success ? undefined : cr.error || 'Console connect failed', Date.now() - consoleStart);
        } catch (e) {
          result.console = step('error', (e as Error)?.message || String(e), Date.now() - consoleStart);
        }
      } else {
        result.console = step('skipped', 'auto-console off');
      }

      result.done = true;
      emit();
    })
  );
}

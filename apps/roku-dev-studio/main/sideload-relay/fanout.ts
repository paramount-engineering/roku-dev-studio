/**
 * Sideload Relay fan-out engine.
 *
 * Given a saved package and the set of enabled targets, forwards the install
 * to every device in parallel (best-effort — one failure never blocks peers),
 * then per device: `launch('dev')` and auto-connect the telnet console. Each
 * step's outcome is streamed back through the listener as a `RelayDeviceResult`
 * so the renderer can render live per-device status.
 *
 * Debug-launch nuance (P4): the primary/debug device is sideloaded WITH
 * `remotedebug=1` (so it opens its debug control port for the IDE's debugger,
 * which RDS proxies) and RDS does NOT auto-launch/console it — the VS Code
 * debugger drives it. Non-primary devices are plain installs that RDS then
 * launches + consoles so the whole fleet runs the build.
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
    extraFields?: { name: string; value: string }[];
  }) => Promise<{ success: boolean; error?: string; message?: string }>;
  launch: (ip: string, appId: string) => Promise<{ success: boolean; error?: string }>;
};
const { ensureDebugTelnetConnected } = require('../ipc/telnet-handlers') as {
  ensureDebugTelnetConnected: (
    ip: string,
    options?: { holder?: string }
  ) => Promise<{ success: boolean; error?: string }>;
};
const { mainLog, mainWarn } = require('../log');

/** A target with its credentials + role already resolved by the service. */
export interface FanoutTarget {
  id: string;
  ip: string;
  name: string;
  password: string;
  primary: boolean;
}

export interface FanoutOptions {
  runId: string;
  packagePath: string;
  targets: FanoutTarget[];
  autoLaunch: boolean;
  autoConsole: boolean;
  /** True when the incoming upload carried `remotedebug=1` (VS Code Debug: Launch). */
  debugLaunch: boolean;
  /** Retry a failed install once before reporting failure (P5). */
  retryOnFailure: boolean;
}

function step(state: RelayStepState, message?: string, durationMs?: number): RelayStepResult {
  return { state, ...(message ? { message } : {}), ...(durationMs != null ? { durationMs } : {}) };
}

/** Run the fan-out. Resolves once every target's chain has settled. */
export async function runFanout(opts: FanoutOptions, listener: RelayListener): Promise<void> {
  const { runId, packagePath, targets, autoLaunch, autoConsole, debugLaunch, retryOnFailure } = opts;

  await Promise.all(
    targets.map(async (target) => {
      const result: RelayDeviceResult = {
        runId,
        targetId: target.id,
        ip: target.ip,
        name: target.name,
        primary: target.primary,
        install: step('pending'),
        launch: step('pending'),
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

      // A debug-launch primary is driven by the IDE's debugger (attached through
      // the RDS proxy); RDS forwards remotedebug=1 but leaves launch/console to
      // the debugger so it doesn't fight the attach.
      const isDebugPrimary = debugLaunch && target.primary;
      const extraFields = isDebugPrimary ? [{ name: 'remotedebug', value: '1' }] : [];

      // --- Install ---
      result.install = step('running');
      emit();
      const installStart = Date.now();
      let installOk = false;
      let installErr = '';
      try {
        let r = await rokuApi.sideloadChannel({
          ip: target.ip,
          filePath: packagePath,
          password: target.password,
          extraFields
        });
        if (!r.success && retryOnFailure) {
          mainWarn(`[SideloadRelay] install failed on ${target.ip} (${r.error}); retrying once`);
          r = await rokuApi.sideloadChannel({
            ip: target.ip,
            filePath: packagePath,
            password: target.password,
            extraFields
          });
        }
        installOk = !!r.success;
        installErr = r.error || (installOk ? '' : 'Install failed');
      } catch (e) {
        installErr = (e as Error)?.message || String(e);
      }
      result.install = step(
        installOk ? 'ok' : 'error',
        installOk ? undefined : installErr,
        Date.now() - installStart
      );
      emit();
      if (installOk) {
        mainLog(`[SideloadRelay] installed on ${target.name} (${target.ip})`);
      }

      if (!installOk) {
        result.launch = step('skipped', 'install failed');
        result.console = step('skipped', 'install failed');
        result.done = true;
        emit();
        return;
      }

      if (isDebugPrimary) {
        result.launch = step('skipped', 'driven by VS Code debugger');
        result.console = step('skipped', 'debugger attached via proxy');
        result.done = true;
        emit();
        return;
      }

      // --- Launch dev app ---
      if (autoLaunch) {
        result.launch = step('running');
        emit();
        const launchStart = Date.now();
        try {
          const lr = await rokuApi.launch(target.ip, 'dev');
          result.launch = step(
            lr.success ? 'ok' : 'error',
            lr.success ? undefined : lr.error || 'Launch failed',
            Date.now() - launchStart
          );
        } catch (e) {
          result.launch = step('error', (e as Error)?.message || String(e), Date.now() - launchStart);
        }
      } else {
        result.launch = step('skipped', 'auto-launch off');
      }
      emit();

      // --- Auto-connect telnet console ---
      if (autoConsole) {
        result.console = step('running');
        emit();
        const consoleStart = Date.now();
        try {
          const cr = await ensureDebugTelnetConnected(target.ip, { holder: 'sideload-relay' });
          result.console = step(
            cr.success ? 'ok' : 'error',
            cr.success ? undefined : cr.error || 'Console connect failed',
            Date.now() - consoleStart
          );
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

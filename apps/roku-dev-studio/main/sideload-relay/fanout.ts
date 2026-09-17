/**
 * Sideload Relay fan-out engine.
 *
 * Given a saved package and the set of enabled targets, per device (all in
 * parallel, best-effort — one failure never blocks peers): open the telnet
 * console FIRST, then install, then (local targets) re-dial the console so the
 * new channel's output lands on it. The channel auto-launches on install, so the
 * relay never issues an explicit launch. Each step's outcome is streamed back
 * through the listener as a `RelayDeviceResult` so the renderer can render live
 * per-device status — and open every target's tab at run start (first result),
 * so a target whose install fails is still connected and visible.
 *
 * No "primary device" — each target that opted into "Enable Debugger"
 * (or whose build carries STOP breakpoints) additionally gets `remotedebug=1` so
 * its real debug protocol port (8081) opens, local or remote alike (see
 * `FanoutTarget.remoteDebug`). 8081 attaches AFTER install: the port only opens
 * on a debug launch.
 */

import type {
  RelayDeviceResult,
  RelayListener,
  RelayStepResult,
  RelayStepState
} from '../../shared/sideload-relay/types';
import type { SideloadChannelOpts } from 'roku-dev-studio-api/lib/plugin-install';

// `roku-dev-studio-api`'s root is a CJS `module.exports` (its .d.ts is `export {}`), so this one
// member stays hand-typed against the api's own exported opts type.
const rokuApi = require('roku-dev-studio-api') as {
  sideloadChannel: (opts: SideloadChannelOpts) => Promise<{ success: boolean; error?: string; message?: string }>;
};
const { ensureDebugTelnetConnected, bounceDebugTelnet } = require('../ipc/telnet-handlers') as typeof import('../ipc/telnet-handlers');
const { ensureRceDebugTelnetConnected } = require('../ipc/rce-handlers') as typeof import('../ipc/rce-handlers');
const { resolveRceDeviceBySerial, resolveRceInstanceBySerial } = require('../rce-device-registry') as typeof import('../rce-device-registry');
const { rceSideload } = require('roku-dev-studio-rce') as typeof import('roku-dev-studio-rce');
// A debug-enabled install just (re)opened the target's debug protocol port (8081) — tell the
// Telnet debug sidebar to reattach, the same event every other sideload entry point
// (dev-app-handlers.ts / bs-fiddle-handlers.ts / rce-handlers.ts) already fires. Fan-out never did
// this, so a fleet target with an already-open device panel never picked up its fresh debug
// session automatically. Harmless no-op if no panel is open for that target.
import { notifyDebuggerReattach } from '../ipc/debugger-handlers';
const fs = require('fs');
const path = require('path');
const { mainLog, mainWarn } = require('../log');

/** A target with its credentials already resolved by the service. */
export interface FanoutTarget {
  id: string;
  ip: string;
  /** Device serial when known — the identity key for per-device settings ("Enable Debugger"). */
  serial?: string;
  name: string;
  password: string;
  /** True for a remote-location device — install/console route through its server. */
  remote?: boolean;
  /** Human location label (e.g. "Local" or a remote location name). */
  location?: string;
  /** Remote server base URL (remote targets only). */
  serverUrl?: string;
  /** Remote location id (remote targets only) — passed through to the renderer's result stream. */
  locationId?: string;
  /**
   * Per-device opt-in (persisted from the Dev App "Enable Debugger"
   * checkbox): fan out this target's install with `remotedebug=1` so its real
   * debug protocol port (8081) opens for the BrightScript debugger. Honored for
   * both local targets (`rokuApi.sideloadChannel`) and remote targets (the
   * remote server's own `DebugSessionController` attaches over its own network
   * access to the device — see `RemoteFanoutOps.sideload`'s 5th param).
   */
  remoteDebug?: boolean;
}

/** Remote-server operations injected by the Electron layer for remote-target fan-out. */
export interface RemoteFanoutOps {
  sideload: (serverUrl: string, ip: string, filePath: string, password: string, remoteDebug?: boolean) => Promise<{ success: boolean; error?: string }>;
  ensureConsole: (serverUrl: string, ip: string) => Promise<{ success: boolean; error?: string }>;
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

// Step messages are developer output: their only sink is the emulated Roku 8085 console streamed to
// the IDE (service.ts `stepWord`, an English line like `install FAILED (<message>)`) — no renderer
// surface renders `RelayStepResult.message`. Deliberately plain English, not `S.*` (a localized
// fragment inside that English line was worse). 'skipped' messages are informational in the IPC
// payload only; `stepWord` prints just the state for them.
const CONSOLE_SKIPPED_INSTALL_FAILED = 'install failed';

function step(state: RelayStepState, message?: string, durationMs?: number): RelayStepResult {
  return { state, ...(message ? { message } : {}), ...(durationMs != null ? { durationMs } : {}) };
}

/** Run the fan-out. Resolves once every target's chain has settled. */
export async function runFanout(opts: FanoutOptions, listener: RelayListener): Promise<void> {
  const { runId, packagePath, targets, autoConsole, retryOnFailure } = opts;

  await Promise.all(
    targets.map(async (target) => {
      // RCE targets are identified by serial, not IP (design doc / [[device-identity-key-rule]]) —
      // `target.ip` already *is* the serial for an RCE device (see `normalizeRceDevice` in
      // renderer/app.ts; `resolveDeviceIp`/`resolveRemoteDeviceIp` above never touch it, since a
      // synthetic RCE identifier is never in either physical registry, so it always falls through
      // to the saved value unchanged). Checked first, cheaply and synchronously, so a genuine
      // physical/remote target's dispatch below is completely unaffected. Computed up front (not
      // inline below) so the initial `result` can carry the RCE identity fields the renderer's
      // auto-connect needs to route through `connectRceDevice` instead of the local-only
      // `connectDevice` — without it, a relay install to an already-open RCE tab opened a second,
      // duplicate one every time.
      const rceKnown = resolveRceDeviceBySerial(target.ip);
      const result: RelayDeviceResult = {
        runId,
        targetId: target.id,
        ip: target.ip,
        name: target.name,
        install: step('pending'),
        console: step('pending'),
        done: false,
        // Lets the renderer's auto-connect flow route through `connectRemoteDevice` for a
        // remote target instead of the local-only `connectDevice` (see RelayDeviceResult).
        ...(target.remote ? { remote: true, serverUrl: target.serverUrl, locationId: target.locationId } : {}),
        ...(rceKnown ? { rce: true, rceAccountName: rceKnown.accountName, rceDeviceId: rceKnown.deviceId } : {})
      };
      const emit = () => {
        try {
          listener.onDeviceResult({ ...result });
        } catch {
          /* listener best-effort */
        }
      };
      emit();

      /** Console step — runs BEFORE install so the tab's Console (and the relay's device tap) is
       *  already listening when the channel compiles/launches, and so a failed install still
       *  leaves the target connected. */
      const connectConsole = async (open: () => Promise<{ success: boolean; error?: string }>): Promise<void> => {
        if (!autoConsole) {
          result.console = step('skipped', 'auto-console off');
          return;
        }
        result.console = step('running');
        emit();
        const consoleStart = Date.now();
        try {
          const cr = await open();
          result.console = step(cr.success ? 'ok' : 'error', cr.success ? undefined : cr.error || 'Console connect failed', Date.now() - consoleStart);
        } catch (e) {
          result.console = step('error', (e as Error)?.message || String(e), Date.now() - consoleStart);
        }
        emit();
      };

      if (rceKnown) {
        const rceInstance = await resolveRceInstanceBySerial(target.ip);
        if (!rceInstance.success) {
          result.install = step('error', rceInstance.error);
          result.console = step('skipped', CONSOLE_SKIPPED_INSTALL_FAILED);
          result.done = true;
          emit();
          return;
        }
        const { accountName, instanceApiUrl, token } = rceInstance.instance;
        // RCE connects its console AFTER install (like remote targets): there is no rebind path for
        // the tunnel, so a pre-install socket could stay bound to the old channel instance.
        result.install = step('running');
        emit();
        const installStart = Date.now();
        let zipData: Buffer;
        try {
          zipData = fs.readFileSync(packagePath);
        } catch (e) {
          result.install = step('error', (e as Error)?.message || 'Could not read package', Date.now() - installStart);
          result.console = step('skipped', CONSOLE_SKIPPED_INSTALL_FAILED);
          result.done = true;
          emit();
          return;
        }
        // Honor the per-device "Enable Debugger" preference here too — same
        // `remotedebug=1` field the local/remote branches below pass, just via rceSideload's own
        // parameter instead of an extraFields array (see rceSideload's doc comment).
        let r = await rceSideload({ instanceApiUrl, rceToken: token, devPassword: target.password }, zipData, path.basename(packagePath), target.remoteDebug);
        if (!r.success && retryOnFailure) {
          mainWarn(`[SideloadRelay] RCE install failed on ${target.name} (${r.error}); retrying once`);
          r = await rceSideload({ instanceApiUrl, rceToken: token, devPassword: target.password }, zipData, path.basename(packagePath), target.remoteDebug);
        }
        result.install = step(r.success ? 'ok' : 'error', r.success ? undefined : r.error || 'Install failed', Date.now() - installStart);
        emit();
        if (!r.success) {
          result.console = step('skipped', CONSOLE_SKIPPED_INSTALL_FAILED);
          result.done = true;
          emit();
          return;
        }
        mainLog(`[SideloadRelay] installed on ${target.name} (RCE)`);
        await connectConsole(() => ensureRceDebugTelnetConnected(accountName, instanceApiUrl, target.ip));
        if (target.remoteDebug) {
          try {
            notifyDebuggerReattach(target.ip);
          } catch {
            /* best-effort */
          }
        }
        result.done = true;
        emit();
        return;
      }

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
          ? opts.remoteOps!.sideload(target.serverUrl!, target.ip, packagePath, target.password, target.remoteDebug)
          : rokuApi.sideloadChannel({
              ip: target.ip,
              filePath: packagePath,
              password: target.password,
              log: (m: string) => mainLog(`[SideloadRelay ${target.ip}]`, m),
              // Honor the per-device "Enable Debugger" preference so the
              // fleet's debug-enabled devices open port 8081. Debug launches force a
              // clean Delete+Install so remotedebug=1 is honored.
              ...(target.remoteDebug ? { extraFields: [{ name: 'remotedebug', value: '1' }], cleanInstall: true } : {})
            });
      // Courtesy pre-open with NO lease holder: the renderer's relay auto-connect
      // (registerRelayAutoConnect → panel.connectTelnet in renderer/app.ts) claims the 'main-ui'
      // lease on `done`, so the user's Disconnect / tab close really closes 8085 afterwards. A
      // 'sideload-relay' holder here was never released, which kept the device's single-client
      // console port held by RDS (and the panel's Disconnect a no-op) until the app quit.
      const doConsole = () =>
        isRemote
          ? opts.remoteOps!.ensureConsole(target.serverUrl!, target.ip)
          : ensureDebugTelnetConnected(target.ip);
      const where = isRemote ? `${target.name} via ${target.location || 'remote'}` : `${target.name} (${target.ip})`;

      // --- Console first (LOCAL) --- the socket is listening when the channel compiles/launches and a
      // failed install still leaves the target connected; re-dialed after install (below). REMOTE
      // targets connect AFTER install instead: the lab server owns the device socket, shares it across
      // its clients and has no rebind, so a pre-install socket could stay bound to the old channel on
      // affected firmware. 8081 stays post-install for both: the debug port only opens on a debug launch.
      if (!isRemote) await connectConsole(doConsole);

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
        if (isRemote) {
          await connectConsole(doConsole);
        } else {
          // On some firmware `plugin_install` unbinds whichever 8085 client was connected beforehand
          // (see the post-sideload bounce in bs-fiddle-handlers.ts). Re-dial whatever socket main
          // holds for this device — the fan-out's pre-open or the tab's own run-start connect (the
          // renderer connects even with auto-console off) — transparently, so the panel never flips.
          try {
            const b = await bounceDebugTelnet(target.ip, { onlyIfOpen: true });
            if (!b.success) result.console = step('error', b.error || 'Console reconnect failed');
          } catch (e) {
            result.console = step('error', (e as Error)?.message || String(e));
          }
        }
        if (target.remoteDebug) {
          try {
            notifyDebuggerReattach(target.ip, isRemote && target.serverUrl ? { isRemote: true, serverUrl: target.serverUrl } : undefined);
          } catch {
            /* best-effort */
          }
        }
      } else if (isRemote) {
        result.console = step('skipped', CONSOLE_SKIPPED_INSTALL_FAILED);
      }

      result.done = true;
      emit();
    })
  );
}

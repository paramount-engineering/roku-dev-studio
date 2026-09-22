/**
 * Shared reader for the persisted `remote-locations` setting (connected remote
 * RDS servers). One implementation used by the Settings window and the Sideload
 * Relay device discovery.
 *
 * Also owns the "Forget it on App Quit/Close" sweep (`forgetEphemeralRemoteLocations`):
 * a location added with `forgetOnQuit: true` is session-only, so main drops it from
 * `remote-locations` at `before-quit` AND again at startup right after the secret store
 * is up (crash safety — a hard kill skips `before-quit`). Dropping an RCE location also
 * deletes its stored account (token + user-id sidecar). Sideload Relay targets that
 * pointed at a forgotten location are dropped too: RDS Relay targets by exact `serverUrl`,
 * RCE targets by resolving the target's serial through the in-memory RCE device registry —
 * which is only populated while the app runs, so RCE targets are caught at quit, not at the
 * startup sweep.
 */

import { loadSettings, saveSettings } from './settings';
import { deleteRceAccount, getRceAccountNames } from './rce-account-store';
import { orphanedRceAccounts } from './rce-account-orphans';
import { resolveRceDeviceBySerial } from './rce-device-registry';
import { mainLog, mainWarn } from './log';

export interface RemoteLocationInfo {
  id: string;
  name: string;
  serverUrl: string;
  host: string;
}

export function readRemoteLocations(settings: Record<string, unknown>): RemoteLocationInfo[] {
  const raw = settings['remote-locations'];
  if (!Array.isArray(raw)) return [];
  const out: RemoteLocationInfo[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const serverUrl = typeof o.serverUrl === 'string' ? o.serverUrl : '';
    if (!serverUrl) continue;
    let host = typeof o.host === 'string' && o.host.trim() ? o.host.trim() : '';
    if (!host) {
      try {
        host = new URL(serverUrl).hostname;
      } catch {
        host = '';
      }
    }
    out.push({
      id: typeof o.id === 'string' ? o.id : serverUrl,
      name: typeof o.name === 'string' && o.name.trim() ? o.name : serverUrl,
      serverUrl,
      host
    });
  }
  return out;
}

/**
 * Purge every `forgetOnQuit` remote location (plus its RCE account and any Sideload Relay
 * targets that belonged to it). Idempotent and never throws — `before-quit` can fire twice
 * (the Fiddle cleanup preventDefaults, then calls `app.quit()` again).
 * @returns number of locations forgotten (0 = nothing written).
 */
export function forgetEphemeralRemoteLocations(): number {
  try {
    const settings = loadSettings();
    const raw = settings['remote-locations'];
    const locs = (Array.isArray(raw) ? raw : []).filter((e) => e && typeof e === 'object') as Array<
      Record<string, unknown>
    >;
    const gone = locs.filter((l) => l.forgetOnQuit === true);
    if (gone.length === 0) return 0;
    settings['remote-locations'] = locs.filter((l) => l.forgetOnQuit !== true);

    const serverUrls = new Set<string>();
    const rceAccounts = new Set<string>();
    for (const l of gone) {
      if (typeof l.serverUrl === 'string' && l.serverUrl) serverUrls.add(l.serverUrl);
      if (l.kind === 'rce' && typeof l.accountName === 'string' && l.accountName) rceAccounts.add(l.accountName);
    }
    for (const name of rceAccounts) deleteRceAccount(name);

    const targets = settings['sideloadRelayTargets'];
    if (Array.isArray(targets)) {
      const kept = targets.filter((t) => {
        if (!t || typeof t !== 'object') return true;
        const o = t as Record<string, unknown>;
        if (typeof o.serverUrl === 'string' && serverUrls.has(o.serverUrl)) return false;
        const rce = resolveRceDeviceBySerial(typeof o.serial === 'string' ? o.serial : undefined);
        return !(rce && rceAccounts.has(rce.accountName));
      });
      if (kept.length !== targets.length) settings['sideloadRelayTargets'] = kept;
    }

    saveSettings(settings);
    const names = gone.map((l) => (typeof l.name === 'string' && l.name) || l.serverUrl || l.accountName || l.id);
    mainLog(`[Remote Locations] forgot ${gone.length} session-only location(s): ${names.join(', ')}`);
    return gone.length;
  } catch (e) {
    mainWarn('[Remote Locations] forget-on-quit sweep failed:', e);
    return 0;
  }
}

/**
 * Delete stored RCE accounts (token + user id) that no `remote-locations` entry references any
 * more — see main/rce-account-orphans.ts for why they arise. The `remote-locations` setting owns
 * RCE account lifecycle: main/settings.ts runs this after every renderer write of that key, so
 * deleting a location deletes its token in the same IPC call; startup runs it too for crash
 * safety and for data left by builds that predate the cascade. Idempotent, never throws.
 * @returns number of accounts pruned.
 */
export function pruneOrphanedRceAccounts(): number {
  try {
    const orphans = orphanedRceAccounts(getRceAccountNames(), loadSettings()['remote-locations']);
    for (const name of orphans) deleteRceAccount(name);
    if (orphans.length > 0) {
      mainLog(`[Remote Locations] pruned ${orphans.length} orphaned RCE account(s): ${orphans.join(', ')}`);
    }
    return orphans.length;
  } catch (err) {
    mainWarn('[Remote Locations] orphaned RCE account prune failed:', err);
    return 0;
  }
}

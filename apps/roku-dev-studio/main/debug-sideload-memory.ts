/**
 * Which .zip a device was last debug-sideloaded with — what the debug sidebar's Restart / Relaunch
 * re-sideloads (clean install, remotedebug=1) so a fresh run waits for the debugger again.
 *
 * The api package's scan-stops keeps this in memory (it also feeds the STOP scan); this wrapper
 * persists it in app settings too, so a Relaunch still works after the app restarted — which is
 * exactly the case that leaves a channel's print output routed to a debugger that no longer
 * exists and 8081 closed (see `telnet.lineDebuggerOutputRouted`). Keyed by `deviceKey()` (serial
 * when known, else ip) per the per-device-state rule; each entry carries the ip so a caller that
 * only knows the ip (the restart handlers) still finds it.
 */
import { deviceKey } from '../shared/platform/device-identity';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron') as typeof import('electron');

const scan = require('roku-dev-studio-api/lib/debugger/scan-stops') as {
  rememberSideloadZip: (ip: string, zipPath: string) => void;
  getRememberedZip: (ip: string) => string | undefined;
};
const settingsMod = require('./settings') as {
  loadSettings: () => Record<string, unknown>;
  saveSettings: (s: Record<string, unknown>) => boolean;
};

export const DEBUG_LAST_ZIP_KEY = 'debug-last-sideload-zip';

type Entry = { zip: string; ip: string };

function table(settings: Record<string, unknown>): Record<string, Entry> {
  const raw = settings[DEBUG_LAST_ZIP_KEY];
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, Entry>) : {};
}

/** A Sideload Relay upload lives in a per-run temp dir that dies with the app — copy it somewhere
 *  stable (one file per device, overwritten each time) so Relaunch has a build to re-sideload after
 *  a restart. A user-chosen zip (Dev App tab) is already stable and is referenced as-is. */
function stableCopy(key: string, zip: string): string {
  if (!zip.startsWith(os.tmpdir())) return zip;
  const dir = path.join(app.getPath('userData'), 'debug-relaunch');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${key.replace(/[^\w.-]+/g, '_')}.zip`);
  fs.copyFileSync(zip, dest);
  return dest;
}

export function rememberDebugZip(ip: string, zip: string, serial?: string): void {
  if (!ip || !zip) return;
  scan.rememberSideloadZip(ip, zip);
  try {
    const key = deviceKey({ serial: serial || '', ip });
    const settings = settingsMod.loadSettings();
    const next: Record<string, Entry> = {};
    // Drop other entries for this same device (an ip-keyed one written before its serial was
    // known, a previous ip) — one live entry per device.
    for (const [k, e] of Object.entries(table(settings))) if (k !== key && e?.ip !== ip) next[k] = e;
    next[key] = { zip: stableCopy(key, zip), ip };
    settings[DEBUG_LAST_ZIP_KEY] = next;
    settingsMod.saveSettings(settings);
  } catch {
    /* persistence is best-effort; the in-memory copy still serves this app session */
  }
}

/** The zip to re-sideload for `ip`: this session's in-memory value, else the persisted one (which
 *  also re-hydrates the in-memory map so the STOP scan works again after a restart). */
export function recallDebugZip(ip: string, serial?: string): string | undefined {
  const live = scan.getRememberedZip(ip);
  if (live) return live;
  try {
    const t = table(settingsMod.loadSettings());
    const byKey = t[deviceKey({ serial: serial || '', ip })];
    const candidates = [byKey, ...Object.values(t).filter((e) => e && e.ip === ip)].filter((e): e is Entry => !!e?.zip);
    // Prefer a build that still exists on disk (a stale entry may point at a temp upload that
    // died with a previous app run); the caller reports "build missing" for the rest.
    const hit = candidates.find((e) => fs.existsSync(e.zip)) ?? candidates[0];
    if (hit) {
      scan.rememberSideloadZip(ip, hit.zip);
      return hit.zip;
    }
  } catch {
    /* fall through */
  }
  return undefined;
}

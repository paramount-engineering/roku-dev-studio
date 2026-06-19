/**
 * One-time startup wipe of stale RDS temp files left in the OS temp root by a previous run that
 * crashed (or was killed before its own cleanup ran). Mirrors the crash-leftover wipe `console-spill`
 * does for its dedicated subdir, and the stale-cache cleanup the Network Inspector does for its
 * detail store — but for the two artifacts RDS writes directly into `os.tmpdir()`:
 *
 *   - `roku-screenshot-*.jpg` — captured by `dev-app-handlers` (`RokuScreenshot`); normally unlinked
 *     when the user Saves, so a never-saved or crashed run leaves them behind.
 *   - `rds-fiddle-*.zip` — built by `bs-fiddle-template.buildFiddleZip`; normally unlinked in the run's
 *     `finally`, so a crash mid-run leaves them behind.
 *
 * Because these live in the shared OS temp root (not a directory we own), we match by our own
 * filename prefixes only and never touch unrelated files or recurse into directories. Best-effort
 * and bounded: a single shallow `readdir` of the temp root, prefix match, unlink of plain files.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Keep in sync with the producers cited above.
const STALE_TEMP_PREFIXES = ['roku-screenshot-', 'rds-fiddle-'];

let cleaned = false;

/** Remove stale RDS temp files from `os.tmpdir()`. Idempotent — safe to call once at startup. */
export function cleanupStaleTempFiles(): void {
  if (cleaned) return;
  cleaned = true;

  let dir: string;
  let entries: string[];
  try {
    dir = os.tmpdir();
    entries = fs.readdirSync(dir);
  } catch {
    // Temp dir missing or unreadable — nothing to clean.
    return;
  }

  for (const name of entries) {
    if (!STALE_TEMP_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;
    const full = path.join(dir, name);
    try {
      // Only unlink plain files — never recurse into a directory we don't own (a coincidental
      // prefix collision on a folder must not be removed).
      if (fs.lstatSync(full).isFile()) fs.unlinkSync(full);
    } catch {
      /* best effort — file in use, vanished, or permission denied */
    }
  }
}

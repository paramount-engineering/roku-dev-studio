/**
 * Developer Mode logging helper for renderer modules.
 *
 * Mirrors the `devLog` behavior in `renderer/app.ts` but exposed as a module so feature code
 * (e.g. Action Scripts executor) can emit gated diagnostic logs without re-subscribing to the same
 * IPC everywhere.
 *
 * Formatting/level handling come from the shared logger in `roku-dev-studio-platform` (via the
 * bundled `shared/logging` shim) so the renderer logs the same way as the rest of the app. This
 * module owns only the renderer's verbose gate: logs are emitted when Developer Mode is on (File
 * menu) OR when the unified `RDS_DEBUG` env flag forced verbose logging on at launch (delivered from
 * the main process via the `get-verbose-debug` IPC, since the renderer can't read env vars).
 */

import { createLogger } from '@shared/logging/logger.js';

let devModeEnabled = false;
let verboseEnv = false;
let initialized = false;

/** Verbose gate: the File-menu Developer Mode toggle OR the RDS_DEBUG env flag from main. */
function verbose(): boolean {
  return devModeEnabled || verboseEnv;
}

// `[DEV]` prefix, no timestamp — matches the original renderer format. The logger's verbose gate is
// wired to `verbose()`, but `devLog` calls `log` (not `debug`) so lines keep their plain `[DEV] …`
// shape; we gate manually below.
const logger = createLogger({ prefix: '[DEV]', timestamp: false, debug: verbose });

function readInitial() {
  if (initialized) return;
  initialized = true;
  try {
    const roku = (typeof window !== 'undefined' ? (window as unknown as { roku?: unknown }).roku : undefined) as
      | {
          getDeveloperMode?: () => Promise<{ enabled?: boolean }>;
          onDeveloperModeChanged?: (cb: (v: boolean) => void) => void;
          getVerboseDebug?: () => Promise<{ enabled?: boolean }>;
        }
      | undefined;
    if (!roku) return;
    if (typeof roku.getDeveloperMode === 'function') {
      roku.getDeveloperMode().then((r) => {
        devModeEnabled = !!(r && r.enabled);
      }).catch(() => {});
    }
    if (typeof roku.onDeveloperModeChanged === 'function') {
      roku.onDeveloperModeChanged((v: boolean) => {
        devModeEnabled = !!v;
        // Mirror the original app.ts signal so the dev console announces the toggle either way.
        logger.log(v ? 'Developer Mode ENABLED - console logging active' : 'Developer Mode DISABLED');
      });
    }
    if (typeof roku.getVerboseDebug === 'function') {
      roku.getVerboseDebug().then((r) => {
        verboseEnv = !!(r && r.enabled);
      }).catch(() => {});
    }
  } catch {
    // Non-fatal: preload not wired, keep disabled.
  }
}

readInitial();

/** True when verbose dev logging is active (Developer Mode toggle or the RDS_DEBUG env flag). */
export function isDeveloperModeEnabled(): boolean {
  return verbose();
}

/** Console log gated by Developer Mode / RDS_DEBUG. Prefix `[DEV]` matches `app.ts devLog`. */
export function devLog(...args: unknown[]): void {
  if (!verbose()) return;
  try {
    logger.log(...args);
  } catch {
    // ignore
  }
}

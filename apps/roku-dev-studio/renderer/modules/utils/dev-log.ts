/**
 * Developer Mode logging helper for renderer modules.
 *
 * Mirrors the `devLog` behavior in `renderer/app.ts` but exposed as a module
 * so feature code (e.g. Action Scripts executor) can emit gated diagnostic
 * logs without re-subscribing to the same IPC everywhere.
 *
 * Logs are only emitted when Developer Mode is enabled in the File menu.
 */

let enabled = false;
let initialized = false;

function readInitial() {
  if (initialized) return;
  initialized = true;
  try {
    const roku = (typeof window !== 'undefined' ? (window as unknown as { roku?: unknown }).roku : undefined) as
      | { getDeveloperMode?: () => Promise<{ enabled?: boolean }>; onDeveloperModeChanged?: (cb: (v: boolean) => void) => void }
      | undefined;
    if (!roku) return;
    if (typeof roku.getDeveloperMode === 'function') {
      roku.getDeveloperMode().then((r) => {
        enabled = !!(r && r.enabled);
      }).catch(() => {});
    }
    if (typeof roku.onDeveloperModeChanged === 'function') {
      roku.onDeveloperModeChanged((v: boolean) => {
        enabled = !!v;
      });
    }
  } catch {
    // Non-fatal: preload not wired, keep disabled.
  }
}

readInitial();

/** True when the File → Developer Mode toggle is on. */
export function isDeveloperModeEnabled(): boolean {
  return enabled;
}

/** Console log gated by Developer Mode. Prefix `[DEV]` matches `app.ts devLog`. */
export function devLog(...args: unknown[]): void {
  if (!enabled) return;
  try {
    console.log('[DEV]', ...args);
  } catch {
    // ignore
  }
}

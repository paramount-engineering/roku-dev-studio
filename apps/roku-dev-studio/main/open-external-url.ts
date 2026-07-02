import { execFile } from 'child_process';
import type { Shell } from 'electron';

/**
 * URL schemes we are willing to hand to the OS. This is the security boundary for
 * every external-open path (renderer IPC, device-log link detection, about/update
 * dialogs). It MUST live here — not scattered in renderer call sites — because both
 * `/usr/bin/open` and `shell.openExternal` will happily launch `file://` paths, `.app`
 * bundles, and arbitrary custom protocol handlers. Device log output is attacker-
 * influenced, so an unvalidated URL is a real escalation vector.
 */
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/** True when `url` parses and uses a scheme we permit opening in the OS default handler. */
export function isAllowedExternalUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  try {
    return ALLOWED_SCHEMES.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Open a URL or URI in the OS default handler.
 * On macOS, `/usr/bin/open` usually activates the target app; `shell.openExternal`
 * can open a background browser tab while this app stays focused.
 *
 * Rejects any URL whose scheme is not in {@link ALLOWED_SCHEMES} so untrusted,
 * device-log-derived URLs (e.g. `file:`, custom schemes) can never reach the OS.
 */
export function openExternalUrl(shell: Shell, url: string): Promise<void> {
  if (!isAllowedExternalUrl(url)) {
    return Promise.reject(new Error(`Refusing to open URL with disallowed scheme: ${String(url).slice(0, 128)}`));
  }
  if (process.platform === 'darwin' && typeof url === 'string' && url.length > 0) {
    return new Promise((resolve, reject) => {
      execFile('/usr/bin/open', [url], { windowsHide: true }, (err) => {
        if (err) {
          void shell.openExternal(url, { activate: true }).then(resolve).catch(reject);
          return;
        }
        resolve();
      });
    });
  }
  return shell.openExternal(url);
}

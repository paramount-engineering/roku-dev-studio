import { execFile } from 'child_process';
import type { Shell } from 'electron';

/**
 * Open a URL or URI in the OS default handler.
 * On macOS, `/usr/bin/open` usually activates the target app; `shell.openExternal`
 * can open a background browser tab while this app stays focused.
 */
export function openExternalUrl(shell: Shell, url: string): Promise<void> {
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

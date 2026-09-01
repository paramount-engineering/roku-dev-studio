/**
 * Mitigation for a native window resize drag starving the main process's event loop for the
 * whole drag on macOS — a long-standing Electron/Chromium limitation (electron/electron#36280),
 * not something fixable from here. Not letting a resize *start* while an async main-process load
 * is in flight (Log Viewer indexing, Network Session Viewer parsing) sidesteps the freeze the
 * user would otherwise see. Shared by both windows so the mitigation and its rationale live in
 * one place — see `main/log-file-viewer-window.ts` and `main/network-session-viewer-window.ts`.
 */

import type { BrowserWindow as ElectronBrowserWindow } from 'electron';

export async function withResizeLocked<T>(
  win: ElectronBrowserWindow | null,
  fn: () => Promise<T>
): Promise<T> {
  win?.setResizable(false);
  try {
    return await fn();
  } finally {
    if (win && !win.isDestroyed()) win.setResizable(true);
  }
}

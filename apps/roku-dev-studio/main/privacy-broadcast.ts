/**
 * Fan the Privacy Mode state out to EVERY open window.
 *
 * Privacy Mode is applied per-window by toggling a `privacy-mode` body class in
 * each renderer (main, Fiddle, Settings, Network Session Viewer, …). Whenever the
 * state changes — the File → Privacy Mode menu, the in-app toggle
 * (`SetPrivacyMode`), or a Settings-window Save — the main process must notify
 * all of those windows so they mask in lockstep. Sending to windows that don't
 * listen for the channel is harmless, and every listener applies it idempotently,
 * so a window that already matches is a no-op.
 */

import { IPC } from '../shared/ipc/channels';

const { BrowserWindow } = require('electron') as typeof import('electron');

export function broadcastPrivacyModeToAllWindows(enabled: boolean): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(IPC.PrivacyModeChanged, !!enabled);
    }
  }
}

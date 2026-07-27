/**
 * Fan a language-preference change out to EVERY open window.
 *
 * Each renderer has its own copy of the shared string catalog, so a locale switch must be
 * applied per-window: the main process persists the preference and then sends this so every
 * window (main, Settings, Fiddle, Session Viewer, …) re-resolves the preference against its
 * own OS locale and retranslates in place — no reload, no lost state. Sending to windows
 * that don't listen is harmless, and each listener applies it idempotently.
 *
 * The payload is the raw preference ('system' | a locale code), NOT a resolved code: each
 * window resolves 'system' via its own `navigator.language`.
 */

import { IPC } from '../shared/ipc/channels';

const { BrowserWindow } = require('electron') as typeof import('electron');

export function broadcastLocaleToAllWindows(pref: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(IPC.LocaleChanged, pref);
    }
  }
}

/**
 * Win/Linux: `Menu.setApplicationMenu` paints File/Edit/View on every framed
 * BrowserWindow. The main shell is frameless (no bar); child windows (Settings,
 * About, Fiddle, Log Viewer, …) must not inherit that chrome.
 */

import type { App } from 'electron';

let registered = false;

export function registerStripAuxWindowMenus(app: App): void {
  if (registered || process.platform === 'darwin') return;
  registered = true;

  app.on('browser-window-created', (_event, window) => {
    window.setMenu(null);
    window.setAutoHideMenuBar(true);
  });
}

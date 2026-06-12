/**
 * Win/Linux title-bar app menu actions (renderer-owned dropdown UI).
 * macOS uses the system menu bar instead — see `createWindow` in `main.ts`.
 */

import { app, BrowserWindow, type Dialog, type IpcMain } from 'electron';
import { IPC } from '../shared/ipc/channels';

export type AppMenuAction =
  | 'open-log-file-picker'
  | 'open-fiddle'
  | 'settings'
  | 'clear-cache'
  | 'quit'
  | 'toggle-debug-logging';

export type HamburgerMenuDeps = {
  dialog: Dialog;
  getMainWindow: () => BrowserWindow | undefined;
  getDebugLogging: () => boolean;
  setDebugLogging: (enabled: boolean) => void;
  showAboutDialog: (win: BrowserWindow) => void;
  showSettingsDialog: (win: BrowserWindow) => void;
  openLogFileViewer: (parent: BrowserWindow | undefined, filePath: string) => void;
  openFiddle: () => void;
  clearCacheAndReload: () => void;
};

let appMenuIpcRegistered = false;

export function registerHamburgerMenuIpc(ipcMain: IpcMain, deps: HamburgerMenuDeps): void {
  if (appMenuIpcRegistered) return;
  appMenuIpcRegistered = true;

  ipcMain.handle(IPC.AppMenuAction, async (event, action: AppMenuAction) => {
    if (process.platform === 'darwin') {
      return { success: false, error: 'App menu actions are not used on macOS.' };
    }

    const win = BrowserWindow.fromWebContents(event.sender) || deps.getMainWindow();
    if (!win || win.isDestroyed()) {
      return { success: false, error: 'Window unavailable.' };
    }

    switch (action) {
      case 'toggle-debug-logging': {
        deps.setDebugLogging(!deps.getDebugLogging());
        return { success: true, enabled: deps.getDebugLogging() };
      }
      case 'open-log-file-picker': {
        const res = await deps.dialog.showOpenDialog(win, {
          title: 'Open log file',
          properties: ['openFile'],
          filters: [
            {
              name: 'Log & text',
              extensions: ['log', 'txt', 'text', 'out', 'err', 'trace', 'rtf']
            },
            { name: 'All files', extensions: ['*'] }
          ]
        });
        if (res.canceled || !res.filePaths?.length) {
          return { success: true, canceled: true };
        }
        deps.openLogFileViewer(win, res.filePaths[0]!);
        return { success: true };
      }
      case 'open-fiddle':
        deps.openFiddle();
        return { success: true };
      case 'settings':
        deps.showSettingsDialog(win);
        return { success: true };
      case 'clear-cache':
        deps.clearCacheAndReload();
        return { success: true };
      case 'quit':
        app.quit();
        return { success: true };
      default:
        return { success: false, error: `Unknown app menu action: ${String(action)}` };
    }
  });

  ipcMain.handle(IPC.ShowAboutDialog, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || deps.getMainWindow();
    if (!win || win.isDestroyed()) {
      return { success: false, error: 'Window unavailable.' };
    }
    deps.showAboutDialog(win);
    return { success: true };
  });
}

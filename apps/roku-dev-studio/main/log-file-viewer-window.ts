/**
 * Standalone window: open a log file with the same console-style rendering as the device Console.
 */

import type { BrowserWindow as ElectronBrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import { IPC } from '../shared/ipc/channels';

const fs = require('fs');
const path = require('path');
const { BrowserWindow, dialog, screen } = require('electron') as typeof import('electron');

const LOG_VIEWER_MAX_BYTES = 36 * 1024 * 1024;

/** BrowserWindow.id → absolute file path (set before load; cleared on close). */
const logViewerPathsByWindowId = new Map<number, string>();

let logViewerIpcRegistered = false;

export function registerLogViewerIpc(ipcMain: IpcMain): void {
  if (logViewerIpcRegistered) return;
  logViewerIpcRegistered = true;

  ipcMain.handle(IPC.LogViewerLoad, (event: IpcMainInvokeEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) {
      return { success: false, error: 'Internal error: no window' };
    }
    const filePath = logViewerPathsByWindowId.get(win.id);
    if (!filePath) {
      return { success: false, error: 'No file is associated with this window' };
    }
    try {
      const st = fs.statSync(filePath);
      if (!st.isFile()) {
        return { success: false, error: 'Not a file' };
      }
      if (st.size > LOG_VIEWER_MAX_BYTES) {
        return {
          success: false,
          error: `File is too large (${Math.round(st.size / (1024 * 1024))} MB). Maximum is ${LOG_VIEWER_MAX_BYTES / (1024 * 1024)} MB.`
        };
      }
      const content = fs.readFileSync(filePath, 'utf8');
      return {
        success: true,
        fileName: path.basename(filePath),
        content
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  });
}

export function openLogFileViewerWindow(parent: ElectronBrowserWindow | undefined, filePath: string): void {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    const boxOpts = {
      type: 'error' as const,
      title: 'Open Log File',
      message: 'Could not open the selected file.'
    };
    if (parent && !parent.isDestroyed()) {
      void dialog.showMessageBox(parent, boxOpts);
    } else {
      void dialog.showMessageBox(boxOpts);
    }
    return;
  }

  const preloadPath = path.join(__dirname, 'log-viewer-preload.bundled.cjs');
  const htmlPath = path.join(__dirname, 'renderer', 'log-file-viewer.html');

  // No `parent`: a child window stays above the main window and can vanish or mis-stack when
  // dragged to another display. This is a normal top-level window; we only center it on the
  // parent's display once at open time.
  const child = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 560,
    minHeight: 400,
    title: `Logs — ${path.basename(resolved)}`,
    backgroundColor: '#0a0a12',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  logViewerPathsByWindowId.set(child.id, resolved);
  child.once('closed', () => {
    logViewerPathsByWindowId.delete(child.id);
  });

  child.once('ready-to-show', () => {
    if (parent && !parent.isDestroyed()) {
      try {
        const pb = parent.getBounds();
        const [w, h] = child.getSize();
        const { workArea } = screen.getDisplayMatching(pb);
        let x = Math.round(pb.x + (pb.width - w) / 2);
        let y = Math.round(pb.y + (pb.height - h) / 2);
        const maxX = workArea.x + workArea.width - w;
        const maxY = workArea.y + workArea.height - h;
        x = Math.min(Math.max(workArea.x, x), maxX);
        y = Math.min(Math.max(workArea.y, y), maxY);
        child.setPosition(x, y);
      } catch {
        /* keep OS default placement */
      }
    }
    child.show();
  });

  child.webContents.on('preload-error', (_e: unknown, failedPath: string, error: Error) => {
    console.error('[Log viewer] Preload failed:', failedPath, error);
  });

  void child.loadFile(htmlPath).catch((err: unknown) => {
    console.error('[Log viewer] loadFile failed:', err);
    logViewerPathsByWindowId.delete(child.id);
    if (!child.isDestroyed()) child.close();
  });
}

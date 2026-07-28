/**
 * Standalone window: "View and Manage Action Scripts". Hosts a standalone Action Scripts Builder
 * over the in-app saved-scripts library — pick a script from the top dropdown, edit it in the full
 * builder (left = steps, right = JSON), and Save / Duplicate / Delete, or push it into the main
 * window's Builder. Reuses the MAIN window preload (`preload.bundled.cjs`) so the renderer gets the
 * complete `window.roku` bridge (incl. the action-scripts library IPC) plus `window.actionScriptVariables`,
 * both of which the builder needs. Singleton — a second invocation just focuses the open window.
 */
import type { BrowserWindow as ElectronBrowserWindow } from 'electron';
import { S, getLocale } from '../shared/strings/index';
import { setupZoomGuards } from './window-zoom';
import { mainError } from './log.js';

const fs = require('fs');
const path = require('path');
const { BrowserWindow, screen } = require('electron') as typeof import('electron');

let viewerWindow: ElectronBrowserWindow | null = null;

export function openActionScriptsViewerWindow(parent: ElectronBrowserWindow | undefined): void {
  // Singleton: focus the existing window instead of opening a duplicate.
  if (viewerWindow && !viewerWindow.isDestroyed()) {
    if (viewerWindow.isMinimized()) viewerWindow.restore();
    viewerWindow.focus();
    return;
  }

  const preloadPath = path.join(__dirname, 'preload.bundled.cjs');
  const htmlPath = path.join(__dirname, 'renderer', 'action-scripts-viewer.html');
  if (!fs.existsSync(preloadPath)) {
    mainError('[ActionScriptsViewer] Preload bundle missing at', preloadPath, '— run build.');
    return;
  }
  if (!fs.existsSync(htmlPath)) {
    mainError('[ActionScriptsViewer] HTML shell missing at', htmlPath);
    return;
  }

  const child = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 560,
    title: S.actionScripts.viewerHeading,
    backgroundColor: '#0a0a12',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  viewerWindow = child;

  // Same zoom band + pinch-zoom guard as the main window.
  setupZoomGuards(child);

  // This window only exists to manage the main app's scripts, so it closes when the main window does.
  const closeWithParent = (): void => {
    if (!child.isDestroyed()) child.close();
  };
  if (parent && !parent.isDestroyed()) parent.once('closed', closeWithParent);

  child.once('closed', () => {
    if (parent && !parent.isDestroyed()) parent.removeListener('closed', closeWithParent);
    if (viewerWindow === child) viewerWindow = null;
  });

  child.once('ready-to-show', () => {
    if (parent && !parent.isDestroyed()) {
      try {
        const pb = parent.getBounds();
        const [w, h] = child.getSize();
        const { workArea } = screen.getDisplayMatching(pb);
        let x = Math.round(pb.x + (pb.width - w) / 2);
        let y = Math.round(pb.y + (pb.height - h) / 2);
        x = Math.min(Math.max(workArea.x, x), workArea.x + workArea.width - w);
        y = Math.min(Math.max(workArea.y, y), workArea.y + workArea.height - h);
        child.setPosition(x, y);
      } catch {
        /* keep OS default placement */
      }
    }
    child.show();
  });

  child.webContents.on('preload-error', (_e: unknown, failedPath: string, error: Error) => {
    mainError('[ActionScriptsViewer] Preload failed:', failedPath, error);
  });

  // Deliver the active locale synchronously via the loadFile query (flash-free), same as the
  // main window; live switches arrive over IPC.LocaleChanged (exposed by the shared preload).
  void child.loadFile(htmlPath, { query: { locale: getLocale() } }).catch((err: unknown) => {
    mainError('[ActionScriptsViewer] loadFile failed:', err);
    if (viewerWindow === child) viewerWindow = null;
  });
}

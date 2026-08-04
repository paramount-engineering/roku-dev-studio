/**
 * Standalone window: Static Channel Analysis — a UI around Roku's own `sca-cmd` CLI.
 *
 * RDS never bundles or ships `sca-cmd` — see `main/static-analysis/sca-tool-manager.ts` for the
 * runtime fetch-and-cache logic. This module only owns window lifecycle; the feature logic lives
 * in `main/ipc/static-analysis-handlers.ts` (mirrors the `fiddle-window.ts` / `bs-fiddle-handlers.ts`
 * split), no live device data is involved so there's no per-window snapshot state to track — just
 * simple no-device windows.
 */

import type { BrowserWindow as ElectronBrowserWindow } from 'electron';
import { S } from '../shared/strings/index';
import { setupZoomGuards } from './window-zoom';
import { mainError } from './log.js';
import { killRunsForSender } from './static-analysis/sca-runner';

const path = require('path');
const { BrowserWindow, screen } = require('electron') as typeof import('electron');

const openWindows = new Set<ElectronBrowserWindow>();

/** Push a status/progress/result event to every open Static Analysis window. */
export function broadcastStaticAnalysis(channel: string, payload: unknown): void {
  for (const win of openWindows) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

export function openStaticAnalysisWindow(parent: ElectronBrowserWindow | undefined): void {
  const preloadPath = path.join(__dirname, 'static-analysis-preload.bundled.cjs');
  const htmlPath = path.join(__dirname, 'renderer', 'static-analysis.html');

  const child = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 700,
    minHeight: 500,
    title: S.staticAnalysis.windowTitle,
    backgroundColor: '#0a0a12',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const senderId = child.webContents.id;
  openWindows.add(child);
  child.once('closed', () => {
    openWindows.delete(child);
    killRunsForSender(senderId);
  });

  setupZoomGuards(child);

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
    mainError('[StaticAnalysis] Preload failed:', failedPath, error);
  });

  void child.loadFile(htmlPath).catch((err: unknown) => {
    mainError('[StaticAnalysis] loadFile failed:', err);
    openWindows.delete(child);
    if (!child.isDestroyed()) child.close();
  });
}

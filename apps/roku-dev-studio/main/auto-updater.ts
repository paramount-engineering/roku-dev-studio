/**
 * App auto-update via electron-updater + GitHub Releases.
 *
 * In dev mode the current version is overridden to 1.0.0 so that the existing
 * 1.1.0 GitHub release is surfaced as an available update — without touching
 * package.json. Remove the override block once you no longer need to demo
 * the update flow in development.
 */

import type { App, BrowserWindow, IpcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC } from '../shared/ipc/channels';
import { mainError } from './log.js';

const path = require('path');

export interface UpdaterStatus {
  type: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error';
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  message?: string;
}

let currentStatus: UpdaterStatus = { type: 'idle' };

function applyStatus(status: UpdaterStatus, broadcast: (s: UpdaterStatus) => void) {
  currentStatus = status;
  broadcast(status);
}

export function setupAutoUpdater(
  app: App,
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null | undefined
): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  if (!app.isPackaged) {
    // Dev mode: simulate running on 1.0.0 so the 1.1.0 GitHub release is detected.
    try {
      const { parse } = require('semver');
      (autoUpdater as any).currentVersion = parse('1.0.0');
    } catch {
      // semver not available — skip version override
    }
    const devConfigPath = path.join(__dirname, '..', 'dev-app-update.yml');
    (autoUpdater as any).updateConfigPath = devConfigPath;
    (autoUpdater as any).forceDevUpdateConfig = true;
  }

  function broadcast(status: UpdaterStatus) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.UpdaterStatus, status);
    }
  }

  autoUpdater.on('checking-for-update', () => {
    applyStatus({ type: 'checking' }, broadcast);
  });

  autoUpdater.on('update-available', (info) => {
    applyStatus({ type: 'available', version: String(info.version) }, broadcast);
  });

  autoUpdater.on('update-not-available', (info) => {
    applyStatus({ type: 'not-available', version: String(info.version) }, broadcast);
  });

  autoUpdater.on('download-progress', (progress) => {
    applyStatus(
      { type: 'downloading', percent: progress.percent, bytesPerSecond: progress.bytesPerSecond },
      broadcast
    );
  });

  autoUpdater.on('update-downloaded', (info) => {
    applyStatus({ type: 'ready', version: String(info.version) }, broadcast);
  });

  autoUpdater.on('error', (err) => {
    mainError('Auto-updater error:', err);
    applyStatus({ type: 'error', message: err.message }, broadcast);
  });

  ipcMain.handle(IPC.UpdaterCheck, async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      applyStatus({ type: 'error', message: msg }, broadcast);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle(IPC.UpdaterDownload, async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      applyStatus({ type: 'error', message: msg }, broadcast);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle(IPC.UpdaterInstall, () => {
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  });

  // Reply with current status immediately when renderer requests it
  // (e.g. after the window reloads and misses earlier broadcasts).
  ipcMain.handle(IPC.UpdaterStatus, () => currentStatus);

  // Auto-check 12 seconds after the app is ready so it doesn't slow launch.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e) => {
      mainError('Auto-updater background check failed:', e);
    });
  }, 12000);
}

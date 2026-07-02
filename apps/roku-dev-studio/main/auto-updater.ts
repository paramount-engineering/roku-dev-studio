/**
 * App auto-update via electron-updater + GitHub Releases.
 *
 * In dev mode (`!app.isPackaged`) the current version is pinned to 1.0.0 so
 * the latest GitHub release is always surfaced as an available update during
 * local development without touching package.json. In packaged production
 * builds electron-updater reads the real version from package.json automatically.
 */

import type { App, BrowserWindow, IpcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC } from '../shared/ipc/channels';
import { mainError, mainWarn } from './log.js';

const path = require('path');
const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/paramount-engineering/roku-dev-studio/releases/latest';
const MANUAL_UPDATE_MESSAGE = 'New update is available. Please download the latest release to update.';

export interface UpdaterStatus {
  type: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error';
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  message?: string;
  needsManualDownload?: boolean;
}

/**
 * Handle returned by `setupAutoUpdater` so callers outside the IPC layer (e.g. the
 * "Check for Updates" File-menu item) can trigger the exact same check flow that
 * runs on startup. Emitting `checking-for-update` clears any banner the renderer is
 * currently showing, then the resulting `available` / `not-available` / `error`
 * status re-drives the notification.
 */
export interface AutoUpdaterControls {
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
}

let currentStatus: UpdaterStatus = { type: 'idle' };

function isMissingMetadataUpdaterError(errorLike: unknown): boolean {
  const maybeObj = errorLike as { message?: unknown; code?: unknown } | undefined;
  const msg = String(maybeObj?.message ?? errorLike ?? '');
  const code = String(maybeObj?.code ?? '');
  return (
    code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' ||
    /latest-mac\.yml|release artifacts|cannot find\s+latest/i.test(msg)
  );
}

function toUpdaterMessage(errorLike: unknown): string {
  if (isMissingMetadataUpdaterError(errorLike)) return MANUAL_UPDATE_MESSAGE;
  const maybeObj = errorLike as { message?: unknown } | undefined;
  return String(maybeObj?.message ?? errorLike ?? 'Unknown updater error');
}

function extractVersionFromUpdaterError(errorLike: unknown): string | undefined {
  const maybeObj = errorLike as { message?: unknown } | undefined;
  const msg = String(maybeObj?.message ?? errorLike ?? '');
  const match = msg.match(/\/releases\/download\/(v?\d+\.\d+\.\d+(?:[-+][^\/\s]+)?)\//i);
  if (!match || !match[1]) return undefined;
  return String(match[1]).replace(/^v/i, '');
}

function applyStatus(status: UpdaterStatus, broadcast: (s: UpdaterStatus) => void) {
  currentStatus = status;
  broadcast(status);
}

export function setupAutoUpdater(
  app: App,
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null | undefined
): AutoUpdaterControls {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  // Replace electron-updater's default logger so the verbose 404 stack-trace for a
  // missing latest-mac.yml is suppressed — we handle that case ourselves and emit a
  // clean "manual download required" message instead.
  autoUpdater.logger = {
    info:  (...args: unknown[]) => mainWarn('[updater]', ...args),
    warn:  (...args: unknown[]) => mainWarn('[updater]', ...args),
    error: (...args: unknown[]) => {
      // Swallow the noisy missing-metadata 404 — our 'error' event handler already
      // logs a concise warning and surfaces the manual-download banner to the user.
      const combined = args.map((a) => String((a as any)?.message ?? a ?? '')).join(' ');
      if (isMissingMetadataUpdaterError({ message: combined })) return;
      mainError('[updater]', ...args);
    },
    debug: () => { /* suppress verbose debug output */ },
  } as any;

  if (!app.isPackaged) {
    // Dev mode only: pin the current version to 1.0.0 so a real GitHub release is
    // detected during local development. In production app.isPackaged is true and
    // electron-updater uses the real app version from package.json automatically.
    try {
      const { parse } = require('semver');
      (autoUpdater as any).currentVersion = parse('1.0.0');
    } catch {
      // semver not available — skip version override
    }
    const devConfigPath = path.join(__dirname, 'dev-app-update.yml');
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
    const manualDownload = isMissingMetadataUpdaterError(err);
    const version = extractVersionFromUpdaterError(err);
    if (isMissingMetadataUpdaterError(err)) {
      mainWarn('Auto-updater metadata missing on release; manual download required.');
    } else {
      mainError('Auto-updater error:', err);
    }
    applyStatus({ type: 'error', message: toUpdaterMessage(err), needsManualDownload: manualDownload, version }, broadcast);
  });

  // Shared check flow used by the renderer's UpdaterCheck IPC, the "Check for
  // Updates" menu item, and (via `checkForUpdates()` below) the startup timer.
  // `checkForUpdates()` emits `checking-for-update` first, which clears any banner
  // the renderer is showing; the resulting status then re-drives the notification.
  async function runCheckForUpdates(): Promise<{ success: boolean; error?: string }> {
    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (e: any) {
      const msg = toUpdaterMessage(e);
      applyStatus({
        type: 'error',
        message: msg,
        needsManualDownload: isMissingMetadataUpdaterError(e),
        version: extractVersionFromUpdaterError(e)
      }, broadcast);
      return { success: false, error: msg };
    }
  }

  ipcMain.handle(IPC.UpdaterCheck, () => runCheckForUpdates());

  ipcMain.handle(IPC.UpdaterDownload, async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (e: any) {
      const msg = toUpdaterMessage(e);
      applyStatus({
        type: 'error',
        message: msg,
        needsManualDownload: isMissingMetadataUpdaterError(e),
        version: extractVersionFromUpdaterError(e)
      }, broadcast);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle(IPC.UpdaterLatestReleaseInfo, async () => {
    try {
      const response = await fetch(LATEST_RELEASE_API_URL, {
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) {
        return {
          success: false,
          error: `Failed to load release notes (${response.status})`
        };
      }
      const json = (await response.json()) as {
        name?: string;
        tag_name?: string;
        body?: string;
        html_url?: string;
      };
      return {
        success: true,
        info: {
          title: String(json?.name || json?.tag_name || 'Latest Release'),
          body: String(json?.body || ''),
          htmlUrl: String(json?.html_url || 'https://github.com/paramount-engineering/roku-dev-studio/releases/latest')
        }
      };
    } catch (e: any) {
      return {
        success: false,
        error: String(e?.message ?? e)
      };
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
      if (isMissingMetadataUpdaterError(e)) {
        mainWarn('Auto-updater background check requires manual download (missing release metadata).');
      } else {
        mainError('Auto-updater background check failed:', e);
      }
    });
  }, 12000);

  return { checkForUpdates: runCheckForUpdates };
}

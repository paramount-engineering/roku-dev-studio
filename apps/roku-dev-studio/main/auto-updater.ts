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
  /** Set only when a *user-initiated* check finds no update, so the renderer can toast
   *  "you're up to date" (the automatic startup check leaves this unset to stay silent). */
  notifyNoUpdate?: boolean;
}

/**
 * Handle returned by `setupAutoUpdater` so callers outside the IPC layer (e.g. the
 * "Check for Updates" File-menu item) can trigger the exact same check flow that
 * runs on startup. Emitting `checking-for-update` clears any banner the renderer is
 * currently showing, then the resulting `available` / `not-available` / `error`
 * status re-drives the notification.
 */
export interface AutoUpdaterControls {
  checkForUpdates: (opts?: { userInitiated?: boolean }) => Promise<{ success: boolean; error?: string }>;
}

let currentStatus: UpdaterStatus = { type: 'idle' };

function isMissingMetadataUpdaterError(errorLike: unknown): boolean {
  const maybeObj = errorLike as { message?: unknown; code?: unknown } | undefined;
  const msg = String(maybeObj?.message ?? errorLike ?? '');
  const code = String(maybeObj?.code ?? '');
  return (
    code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' ||
    // Per-platform channel files hosted on the release: latest-mac.yml (macOS),
    // latest.yml (Windows), latest-linux.yml (Linux). `app-update.yml` is the sibling
    // metadata file bundled *inside* the app itself (Resources/app-update.yml) — both
    // come from the same electron-builder `publish` config and go missing together
    // (e.g. a build made with `publish: null`), surfacing as a plain ENOENT for
    // whichever one electron-updater reaches for first. The generic phrases catch
    // wording variants across electron-updater versions/platforms.
    /latest(-mac|-linux)?\.yml|app-update\.yml|release artifacts|cannot find\s+latest/i.test(msg)
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

/** Strip a leading `v` and keep only a `x.y.z[-…]` version, or undefined if it isn't one. */
function normalizeVersion(v: unknown): string | undefined {
  const s = String(v ?? '').trim().replace(/^v/i, '');
  return /^\d+\.\d+\.\d+/.test(s) ? s : undefined;
}

/**
 * True only when `latest` is a strictly higher version than `current`. Prefers semver;
 * falls back to a numeric tuple compare if semver isn't loadable. A non-comparable input
 * returns false so we never prompt on a bad/equal version.
 */
function isStrictlyNewer(latest: string, current: string): boolean {
  try {
    const semver = require('semver');
    const a = semver.coerce(latest)?.version;
    const b = semver.coerce(current)?.version;
    if (a && b) return semver.gt(a, b);
  } catch {
    /* semver unavailable — fall through to tuple compare */
  }
  const pa = latest.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = current.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

/** Latest published release version from the GitHub API, or undefined if it can't be read. */
async function fetchLatestReleaseVersion(): Promise<string | undefined> {
  try {
    const response = await fetch(LATEST_RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) return undefined;
    const json = (await response.json()) as { tag_name?: string; name?: string };
    return normalizeVersion(json?.tag_name) ?? normalizeVersion(json?.name);
  } catch {
    return undefined;
  }
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
  // missing channel file (latest-mac.yml / latest.yml / latest-linux.yml) is suppressed —
  // we handle that case ourselves and emit a clean "manual download required" message instead.
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

  // The version this build reports for update comparisons. Dev is pinned to 1.0.0 (matching
  // the currentVersion override above) so a real release always surfaces locally; a packaged
  // build uses its actual version so we don't prompt users who are already on the latest.
  function getCurrentVersion(): string {
    if (!app.isPackaged) return '1.0.0';
    return normalizeVersion(app.getVersion()) ?? '0.0.0';
  }

  // Guards against the error event and the checkForUpdates() rejection both triggering a
  // GitHub round-trip for the same failed check.
  let manualCheckInFlight = false;

  // True while a check the user explicitly asked for is running. Consumed by the terminal
  // outcome (available / not-available / error) to decide whether a "no update" result should
  // be announced to the user. The automatic startup check leaves this false so it stays silent.
  let pendingUserInitiated = false;
  /** Read and clear the user-initiated flag so it applies to exactly one check outcome. */
  function consumeUserInitiated(): boolean {
    const v = pendingUserInitiated;
    pendingUserInitiated = false;
    return v;
  }

  /**
   * A release without electron-updater metadata (missing latest-mac.yml / latest.yml /
   * latest-linux.yml) can't be auto-checked,
   * so electron-updater reports it as an error. That does NOT mean an update exists — surfacing
   * the "manual download" banner unconditionally shows it even to users already on the latest
   * version. Verify against the latest published release and only prompt when it's strictly newer.
   */
  async function surfaceManualUpdateIfNewer(versionFromError: string | undefined): Promise<void> {
    if (manualCheckInFlight) return;
    manualCheckInFlight = true;
    const userInitiated = consumeUserInitiated();
    try {
      const current = getCurrentVersion();
      const latest = normalizeVersion(versionFromError) ?? (await fetchLatestReleaseVersion());
      if (latest && isStrictlyNewer(latest, current)) {
        applyStatus(
          { type: 'error', message: MANUAL_UPDATE_MESSAGE, needsManualDownload: true, version: latest },
          broadcast
        );
      } else {
        // Already current (or the latest version couldn't be determined) — don't nag,
        // but confirm to the user if they asked for the check themselves.
        applyStatus({ type: 'not-available', version: latest ?? current, notifyNoUpdate: userInitiated }, broadcast);
      }
    } finally {
      manualCheckInFlight = false;
    }
  }

  autoUpdater.on('checking-for-update', () => {
    applyStatus({ type: 'checking' }, broadcast);
  });

  autoUpdater.on('update-available', (info) => {
    // Update exists — the banner surfaces it, so no "no update" toast is needed.
    consumeUserInitiated();
    applyStatus({ type: 'available', version: String(info.version) }, broadcast);
  });

  autoUpdater.on('update-not-available', (info) => {
    applyStatus({ type: 'not-available', version: String(info.version), notifyNoUpdate: consumeUserInitiated() }, broadcast);
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
    if (isMissingMetadataUpdaterError(err)) {
      mainWarn('Auto-updater metadata missing on release; verifying against latest release before prompting.');
      void surfaceManualUpdateIfNewer(extractVersionFromUpdaterError(err));
      return;
    }
    consumeUserInitiated();
    mainError('Auto-updater error:', err);
    applyStatus(
      { type: 'error', message: toUpdaterMessage(err), needsManualDownload: false, version: extractVersionFromUpdaterError(err) },
      broadcast
    );
  });

  // Shared check flow used by the renderer's UpdaterCheck IPC, the "Check for
  // Updates" menu item, and (via `checkForUpdates()` below) the startup timer.
  // `checkForUpdates()` emits `checking-for-update` first, which clears any banner
  // the renderer is showing; the resulting status then re-drives the notification.
  // `userInitiated` marks explicit user checks so a "no update" result can be toasted.
  async function runCheckForUpdates(opts?: { userInitiated?: boolean }): Promise<{ success: boolean; error?: string }> {
    pendingUserInitiated = !!opts?.userInitiated;
    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (e: any) {
      const msg = toUpdaterMessage(e);
      if (isMissingMetadataUpdaterError(e)) {
        // The 'error' event (above) already routes this through the version gate; don't
        // apply a manual-download status here or we'd flash the banner before the check.
        void surfaceManualUpdateIfNewer(extractVersionFromUpdaterError(e));
      } else {
        applyStatus({
          type: 'error',
          message: msg,
          needsManualDownload: false,
          version: extractVersionFromUpdaterError(e)
        }, broadcast);
      }
      return { success: false, error: msg };
    }
  }

  ipcMain.handle(IPC.UpdaterCheck, () => runCheckForUpdates({ userInitiated: true }));

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

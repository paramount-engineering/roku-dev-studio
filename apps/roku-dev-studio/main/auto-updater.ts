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
import { classifyUpdaterError, isMissingMetadataError, type UpdaterErrorReason } from '../shared/updater-errors';
import { mainError, mainWarn } from './log.js';

const path = require('path');
const GITHUB_OWNER = 'paramount-engineering';
const GITHUB_REPO = 'roku-dev-studio';
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
// Dev-only (see setupAutoUpdater): lets a local test server stand in for the GitHub API so the
// "release has no updater metadata" fallback can be exercised end to end. Packaged builds ignore it.
let latestReleaseApiUrl = LATEST_RELEASE_API_URL;
const MANUAL_UPDATE_MESSAGE = 'New update is available. Please download the latest release to update.';

/**
 * HEAD-check that the release's primary update asset is actually reachable before surfacing an
 * "available" status with an auto-download button — a release published with a manifest/asset
 * filename mismatch (see .discussion-docs/auto-updater-release-pipeline-gap.md) would otherwise
 * pass this exact check right up until the user clicks Download and hits a 404. Best-effort: a
 * network hiccup here fails OPEN (treated as downloadable) rather than blocking the notification
 * on this pre-check's own reachability — the real download would hit the same transient issue
 * anyway, so failing closed here would only make things worse, not better.
 */
async function isUpdateAssetDownloadable(info: { version?: unknown; files?: Array<{ url?: unknown }> }): Promise<boolean> {
  const fileUrl = info.files?.[0]?.url;
  const version = normalizeVersion(info.version);
  if (typeof fileUrl !== 'string' || !fileUrl || !version) return true;
  try {
    const url = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${version}/${encodeURIComponent(fileUrl)}`;
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return response.ok;
  } catch {
    return true;
  }
}

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
  /** For `not-available`: the running build's version, and whether it is AHEAD of `version`
   *  (the latest published release) — e.g. a 1.3.0 build checking against v1.2.0. */
  currentVersion?: string;
  ahead?: boolean;
  /** Set when the error is one the renderer can phrase for a human (see shared/updater-errors.ts);
   *  unset errors fall back to showing `message` verbatim. */
  reason?: UpdaterErrorReason;
  httpStatus?: number;
  /** Raw electron-updater error (code + stack), for the banner's Copy Details button. */
  detail?: string;
  /** Which step failed — decides whether "Retry" re-runs the check or the download. */
  stage?: 'check' | 'download';
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

/** See shared/updater-errors.ts — kept as a local alias so the call sites below read the same. */
const isMissingMetadataUpdaterError = isMissingMetadataError;

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

/**
 * Latest published release version from the GitHub API. A failure is returned, not swallowed: the
 * caller must be able to tell "no newer release" from "could not ask", because the latter is a
 * failed check and must never be reported as "you're up to date".
 */
async function fetchLatestReleaseVersion(): Promise<{ version?: string; error?: unknown }> {
  try {
    const response = await fetch(latestReleaseApiUrl, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) {
      return {
        error: Object.assign(new Error(`GitHub API returned ${response.status} for ${latestReleaseApiUrl}`), {
          code: `HTTP_ERROR_${response.status}`,
          statusCode: response.status
        })
      };
    }
    const json = (await response.json()) as { tag_name?: string; name?: string };
    const version = normalizeVersion(json?.tag_name) ?? normalizeVersion(json?.name);
    return version ? { version } : { error: new Error(`GitHub API response for ${latestReleaseApiUrl} had no usable tag_name`) };
  } catch (e) {
    return { error: e };
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
      // Use electron-updater's OWN bundled semver, not whatever "semver" happens to resolve to
      // from this file (a root-hoisted, unrelated older major pulled in by other build tooling).
      // electron-updater's internal comparisons (checkForUpdates' semver.eq/gt/lt) construct a
      // `new SemVer(...)` from ITS copy and check `instanceof` against ITS `SemVer` class — a
      // parsed object from a DIFFERENT copy of the package fails that check and throws "Invalid
      // version. Must be a string. Got type \"object\"." (a classic dual-package-instance hazard).
      const { parse } = require('electron-updater/node_modules/semver');
      (autoUpdater as any).currentVersion = parse('1.0.0');
    } catch {
      // semver not available — skip version override
    }
    if (process.env.RDS_UPDATER_API_URL) latestReleaseApiUrl = process.env.RDS_UPDATER_API_URL;
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

  // The step currently running, stamped on error statuses so the renderer's Retry knows what to redo.
  let stage: 'check' | 'download' = 'check';
  // Whether the check currently running was asked for by the user. A failed AUTOMATIC check (startup)
  // is logged but never shown: the user did nothing, and for a build that is already current there is
  // nothing to do about GitHub being down or the network being offline. Download failures always show.
  let currentCheckUserInitiated = false;
  function errorStatus(err: unknown): UpdaterStatus {
    const c = classifyUpdaterError(err);
    const e = err as { code?: unknown; stack?: unknown; message?: unknown } | undefined;
    const raw = String(e?.stack ?? e?.message ?? err ?? '');
    return {
      type: 'error',
      message: toUpdaterMessage(err),
      needsManualDownload: false,
      version: c?.version ?? extractVersionFromUpdaterError(err),
      reason: c?.reason,
      httpStatus: c?.httpStatus,
      stage,
      detail: `${e?.code ? `${String(e.code)} — ` : ''}${raw}`.slice(0, 4000)
    };
  }
  /** "No update": also says whether this build is ahead of the latest release (dev / pre-release builds). */
  function notAvailableStatus(latest: string, notifyNoUpdate: boolean): UpdaterStatus {
    const currentVersion = getCurrentVersion();
    return { type: 'not-available', version: latest, currentVersion, ahead: isStrictlyNewer(currentVersion, latest), notifyNoUpdate };
  }
  /** Surface a check/download failure — or swallow it (log only) when a background check failed. */
  function reportError(err: unknown, extra?: Partial<UpdaterStatus>): void {
    const status = { ...errorStatus(err), ...extra };
    if (stage === 'check' && !currentCheckUserInitiated) {
      mainWarn(
        `Auto-updater background check failed (not shown to the user): ${status.reason ?? 'unclassified'} — ${status.message?.slice(0, 300)}`
      );
      applyStatus({ type: 'idle' }, broadcast);
      return;
    }
    applyStatus(status, broadcast);
  }

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
      let latest = normalizeVersion(versionFromError);
      if (!latest) {
        const probe = await fetchLatestReleaseVersion();
        if (!probe.version) {
          // We could not learn what the latest release is, so we cannot claim "up to date": report it
          // like any other failed check (quiet for the background check, a banner for a manual one).
          reportError(probe.error);
          return;
        }
        latest = probe.version;
      }
      if (isStrictlyNewer(latest, current)) {
        applyStatus(
          { type: 'error', message: MANUAL_UPDATE_MESSAGE, needsManualDownload: true, version: latest },
          broadcast
        );
      } else {
        // Already current (or ahead) — don't nag, but confirm to the user if they asked for the check.
        applyStatus(notAvailableStatus(latest, userInitiated), broadcast);
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
    const version = String(info.version);
    void isUpdateAssetDownloadable(info).then((downloadable) => {
      applyStatus({ type: 'available', version, needsManualDownload: !downloadable }, broadcast);
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    applyStatus(notAvailableStatus(normalizeVersion(info.version) ?? String(info.version), consumeUserInitiated()), broadcast);
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
    reportError(err);
  });

  // Shared check flow used by the renderer's UpdaterCheck IPC, the "Check for
  // Updates" menu item, and (via `checkForUpdates()` below) the startup timer.
  // `checkForUpdates()` emits `checking-for-update` first, which clears any banner
  // the renderer is showing; the resulting status then re-drives the notification.
  // `userInitiated` marks explicit user checks so a "no update" result can be toasted.
  async function runCheckForUpdates(opts?: { userInitiated?: boolean }): Promise<{ success: boolean; error?: string }> {
    pendingUserInitiated = !!opts?.userInitiated;
    currentCheckUserInitiated = !!opts?.userInitiated;
    stage = 'check';
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
        reportError(e);
      }
      return { success: false, error: msg };
    }
  }

  ipcMain.handle(IPC.UpdaterCheck, () => runCheckForUpdates({ userInitiated: true }));

  ipcMain.handle(IPC.UpdaterDownload, async () => {
    stage = 'download';
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (e: any) {
      const msg = toUpdaterMessage(e);
      reportError(e, { needsManualDownload: isMissingMetadataUpdaterError(e) });
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
    stage = 'check';
    currentCheckUserInitiated = false;
    // Failures are already handled by the 'error' event: metadata-missing → version-gated manual
    // banner, everything else → reportError (log-only for this background check).
    autoUpdater.checkForUpdates().catch(() => undefined);
  }, 12000);

  return { checkForUpdates: runCheckForUpdates };
}

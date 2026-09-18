// Dev app handlers (sideloading, screenshots, etc.)

import type { BrowserWindow, Dialog, IpcMainInvokeEvent } from 'electron';
import type {
  IpFilePasswordPayload,
  IpPasswordPayload,
  IpPasswordScreenshotPayload,
  SaveScreenshotPayload,
  SideloadFilePathPayload
} from '../../shared/ipc/payloads';
import { IPC } from '../../shared/ipc/channels';
import { mainError, mainLog } from '../log.js';
import { S } from '../../shared/strings/index';
import { DEBUGGER_ENABLED_DEVICES_KEY, isDebuggerEnabled, withDebuggerEnabled } from '../../shared/platform/debugger-enabled';
import { notifyDebuggerReattach } from './debugger-handlers';
import { recallDebugZip, rememberDebugZip } from '../debug-sideload-memory';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveUserPathUnderOneOf } = require('roku-dev-studio-platform/path-safe');
const { userProfileDirectories } = require('roku-dev-studio-platform/node');

const {
  captureRokuScreenshot,
  verifyDeveloperDigestAuth,
  sideloadChannel,
  deleteSideload,
  rebootDevice,
  checkForUpdate
} = require('roku-dev-studio-api');

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Decide whether a sideload should be a debug launch, and discover STOP breakpoints
 * in its source. "Debugging enabled" = caller asked (checkbox) OR the device opted in
 * previously (persisted) OR we just DISCOVERED STOP breakpoints (auto-enable) — when
 * enabled, the caller should forward `remotedebug=1` (opens 8081) and use a clean
 * Delete+Install. Persisted by device key (serial preferred, else IP) so the preference
 * survives a network change; the raw-IP form is also checked for entries saved before
 * device-key migration.
 *
 * `filePath` is always the LOCAL disk path — even for a remote-managed device the
 * package is uploaded FROM this file, so the STOP scan and the "last debug zip" memory
 * (used by Restart / the Breakpoints panel's scan-stops IPC) are identical for a local
 * or remote sideload target and never need a remote-server counterpart.
 *
 * Already exported (see the bottom of this file) so `rce-handlers.ts`'s `RceSideload` handler can
 * use the exact same persisted-setting + STOP-auto-detect logic instead of a one-off inline
 * calculation — an RCE sideload should respect "Enable Debugger" identically to a
 * local/LAN-relay one.
 */
function computeSideloadDebugFlags(
  ip: string,
  serial: string | undefined,
  filePath: string,
  remoteDebug: boolean | undefined
): { debugEnabled: boolean; discovered: number } {
  const scan = require('roku-dev-studio-api/lib/debugger/scan-stops') as {
    scanZipForStops: (p: string) => unknown[];
  };
  const settingsMod = require('../settings') as {
    loadSettings: () => Record<string, unknown>;
    saveSettings: (s: Record<string, unknown>) => boolean;
  };

  let discovered = 0;
  try {
    discovered = scan.scanZipForStops(filePath).length;
  } catch { /* scan best-effort */ }

  const ref = { serial, ip };
  // One read: `loadSettings()` also runs the legacy-key migration, so don't call it twice per sideload.
  const settings = settingsMod.loadSettings();
  let debugEnabled = !!remoteDebug || isDebuggerEnabled(settings[DEBUGGER_ENABLED_DEVICES_KEY], ref);
  if (discovered > 0 && !debugEnabled) {
    debugEnabled = true;
    // Persist the auto-enable so future sideloads (and the sidebar) stay on.
    settings[DEBUGGER_ENABLED_DEVICES_KEY] = withDebuggerEnabled(settings[DEBUGGER_ENABLED_DEVICES_KEY], ref, true);
    settingsMod.saveSettings(settings);
  }
  return { debugEnabled, discovered };
}

const SIDELOAD_PACKAGE_EXTENSIONS = new Set(['zip', 'pkg']);

function getSideloadAllowedBases(): string[] {
  return userProfileDirectories();
}

// Paths the user explicitly chose this session via the OS file picker or by
// dragging a file onto the drop zone. Those gestures are the trust boundary —
// the user picked a real file — so we let them sideload even if it lives outside
// the home directory (external drives, /Volumes, /tmp, shared folders, etc.).
// A renderer still can't sideload an arbitrary path it invents: `RokuSideload`
// only accepts paths under the home dir OR ones recorded here.
const approvedSideloadPaths = new Set<string>();

type ResolvedSideloadFile =
  | { success: true; filePath: string; fileName: string; fileSize: number }
  | { success: false; error: string };

function inspectPackageFile(resolved: string): ResolvedSideloadFile {
  if (!fs.existsSync(resolved)) {
    return { success: false, error: 'File not found' };
  }
  const ext = path.extname(resolved).slice(1).toLowerCase();
  if (!SIDELOAD_PACKAGE_EXTENSIONS.has(ext)) {
    return { success: false, error: S.devApp.sideloadWrongTypeError };
  }
  const stats = fs.statSync(resolved);
  if (!stats.isFile()) {
    return { success: false, error: 'Not a file' };
  }
  return {
    success: true,
    filePath: resolved,
    fileName: path.basename(resolved),
    fileSize: stats.size
  };
}

/**
 * Resolve a file the user explicitly selected (native picker) or dropped onto the
 * Dev App. These are user-initiated OS-level gestures, so the file's location is
 * trusted and the home-directory restriction is intentionally skipped. On success
 * the resolved path is recorded so the matching `RokuSideload` call can accept it.
 */
function resolveTrustedSideloadFile(filePath: string): ResolvedSideloadFile {
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: 'File path required' };
  }
  const resolved = path.resolve(filePath);
  const result = inspectPackageFile(resolved);
  if (result.success) {
    approvedSideloadPaths.add(resolved);
  }
  return result;
}

/**
 * Resolve a sideload path that arrives over IPC (e.g. the install action). Accepts
 * the path only if it lives under an allowed base directory OR was previously
 * approved this session through the trusted picker/drop flow above — so a buggy or
 * compromised renderer can't sideload an arbitrary path it never had the user pick.
 */
function resolveSideloadPackageFile(filePath: string): ResolvedSideloadFile {
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: 'File path required' };
  }
  const resolvedAbs = path.resolve(filePath);
  let resolved = resolveUserPathUnderOneOf(getSideloadAllowedBases(), filePath);
  if (!resolved && approvedSideloadPaths.has(resolvedAbs)) {
    resolved = resolvedAbs;
  }
  if (!resolved) {
    return { success: false, error: 'Path is not under an allowed directory' };
  }
  return inspectPackageFile(resolved);
}

/**
 * Setup dev app IPC handlers
 */
function setupDevAppHandlers(mainWindow: BrowserWindow | undefined, dialog: Dialog) {
  const { ipcMain } = require('electron');

  // Select sideload file
  ipcMain.handle(IPC.RokuSelectSideloadFile, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: S.devApp.selectRokuChannelPackageTitle,
      filters: [
        { name: S.devApp.rokuChannelPackageFilter, extensions: ['zip', 'pkg'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    // The OS picker is the trust boundary — accept the chosen file wherever it lives.
    return resolveTrustedSideloadFile(result.filePaths[0]);
  });

  // Resolve a dropped or pasted sideload package path. A drag-drop is a user-initiated
  // gesture (the path comes from the dropped File via the preload bridge), so it's
  // trusted the same way the native picker is.
  ipcMain.handle(IPC.RokuResolveSideloadFile, async (_event: IpcMainInvokeEvent, { filePath }: SideloadFilePathPayload) => {
    return resolveTrustedSideloadFile(filePath);
  });

  // Sideload a channel package (shared logic in lib/roku-plugin-install.js). filePath must be under allowed dirs.
  ipcMain.handle(IPC.RokuSideload, async (_event: IpcMainInvokeEvent, { ip, filePath, password, remoteDebug, serial }: IpFilePasswordPayload & { remoteDebug?: boolean; serial?: string }) => {
    // Go through the same validation as the picker/drag paths so a direct IPC
    // call can't sideload a non-package (or a file outside the allowed dirs).
    const resolvedFile = resolveSideloadPackageFile(filePath);
    if (!resolvedFile.success) {
      return resolvedFile;
    }
    const resolved = resolvedFile.filePath;
    const scan = require('roku-dev-studio-api/lib/debugger/scan-stops') as {
      rememberSideloadZip: (ip: string, p: string) => void;
    };
    const scanSymbols = require('roku-dev-studio-api/lib/debugger/scan-symbols') as {
      rememberAnySideloadZip: (ip: string, p: string) => void;
    };
    const { debugEnabled, discovered } = computeSideloadDebugFlags(ip, serial, resolved, remoteDebug);
    const extraFields = debugEnabled ? [{ name: 'remotedebug', value: '1' }] : undefined;
    mainLog(`[sideload] ip=${ip} debugEnabled=${debugEnabled} discovered=${discovered} remotedebug=${debugEnabled ? '1' : '0'} file=${resolvedFile.fileName}`);
    const result = await sideloadChannel({
      ip,
      filePath: resolved,
      password,
      log: (m: string) => mainLog('[sideload]', m),
      // Debug launches need a clean Delete+Install so the device actually relaunches
      // with remotedebug=1 (Replace can drop it → STOPs hit the 8085 micro-debugger).
      cleanInstall: debugEnabled,
      ...(extraFields ? { extraFields } : {})
    });
    const sideloadSucceeded = !!result && (result as { success?: boolean }).success !== false;
    if (sideloadSucceeded) {
      try {
        // Remember the .zip for Fiddle's symbol-completion scan, regardless of debug mode.
        scanSymbols.rememberAnySideloadZip(ip, resolved);
      } catch {
        /* best-effort */
      }
    }
    if (debugEnabled && sideloadSucceeded) {
      try {
        // Remember the .zip for STOP scanning, and reattach the debugger to the fresh
        // run — passing the discovered count so the sidebar can toast it.
        rememberDebugZip(ip, resolved, serial);
        notifyDebuggerReattach(ip, { discovered });
      } catch {
        /* best-effort */
      }
    }
    return result;
  });

  // Restart the debug session: re-sideload the last debug .zip we remembered for this
  // device (clean Delete+Install so remotedebug=1 is honored), then reattach. This is
  // the one-click edit-run-debug loop — the renderer supplies the stored dev password.
  ipcMain.handle(IPC.DebuggerRestart, async (_event: IpcMainInvokeEvent, { ip, password }: IpPasswordPayload) => {
    const zip = recallDebugZip(ip);
    if (!zip) return { success: false, error: S.debugger.errNoPreviousDebugSideload };
    if (!fs.existsSync(zip)) return { success: false, error: S.debugger.errPreviousDebugBuildMissing };
    mainLog(`[sideload] restart ip=${ip} remotedebug=1 file=${path.basename(zip)}`);
    const result = await sideloadChannel({
      ip,
      filePath: zip,
      password: password || '',
      log: (m: string) => mainLog('[sideload]', m),
      cleanInstall: true,
      extraFields: [{ name: 'remotedebug', value: '1' }]
    });
    if (result && (result as { success?: boolean }).success !== false) {
      try {
        // The zip is the one we just recalled (already remembered under the device's key) — no
        // re-remember here, which would only know the ip and rewrite the entry under it.
        notifyDebuggerReattach(ip);
      } catch {
        /* best-effort */
      }
    }
    return result;
  });

  // Delete sideloaded channel (shared logic in lib/roku-plugin-install.js)
  ipcMain.handle(IPC.RokuDeleteSideload, async (_event: IpcMainInvokeEvent, { ip, password }: IpPasswordPayload) => {
    return deleteSideload({ ip, password });
  });

  // Reboot the device via the Developer Application Installer (plugin_swup).
  ipcMain.handle(IPC.RokuReboot, async (_event: IpcMainInvokeEvent, { ip, password }: IpPasswordPayload) => {
    return rebootDevice({ ip, password: password || '' });
  });

  // Ask the device to check for a software update (plugin_swup).
  ipcMain.handle(IPC.RokuCheckUpdate, async (_event: IpcMainInvokeEvent, { ip, password }: IpPasswordPayload) => {
    return checkForUpdate({ ip, password: password || '' });
  });

  // Save screenshot to file
  ipcMain.handle(IPC.RokuSaveScreenshot, async (_event: IpcMainInvokeEvent, { tempFile, dataUrl }: SaveScreenshotPayload) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: S.devApp.saveScreenshotDialogTitle,
      defaultPath: `roku-screenshot-${Date.now()}.jpg`,
      filters: [
        { name: S.devApp.imagesFilter, extensions: ['jpg', 'jpeg', 'png'] }
      ]
    });
    
    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Save cancelled' };
    }
    
    try {
      // Renderer-supplied `tempFile` is untrusted; restrict to the OS temp dir so a
      // buggy/compromised renderer can't use this handler to copy arbitrary readable
      // files to the user-chosen save location.
      const tempFileSafe = tempFile
        ? resolveUserPathUnderOneOf([os.tmpdir()], tempFile)
        : null;
      if (tempFileSafe && fs.existsSync(tempFileSafe)) {
        await fs.promises.copyFile(tempFileSafe, result.filePath);
        try {
          await fs.promises.unlink(tempFileSafe);
        } catch (unlinkErr) {
          // Ignore cleanup errors
        }
      } else if (dataUrl) {
        // Decode base64 data URL
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.promises.writeFile(result.filePath, buffer);
      } else {
        return { success: false, error: 'No screenshot data available' };
      }

      return { success: true, filePath: result.filePath };
    } catch (error: unknown) {
      return { success: false, error: errMsg(error) };
    }
  });

  // Persists a canvas-frame-grab / agent-driven capture's `data:` URL to a temp file — those two
  // paths never go through a device call, so (unlike RokuScreenshot/RceScreenshot above) they'd
  // otherwise have no on-disk copy at all, forcing the renderer to keep the full base64 string
  // resident for the session-gallery entry's whole lifetime. Naming matches RokuScreenshot's own
  // `roku-screenshot-*` prefix so `cleanupStaleTempFiles` (startup-temp-cleanup.ts) already covers
  // any of these left behind by a crash — no separate prefix to register there.
  ipcMain.handle(IPC.PersistScreenshotDataUrl, async (_event: IpcMainInvokeEvent, { dataUrl }: { dataUrl: string }) => {
    const match = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl || '');
    if (!match) return { success: false, error: 'Not a data: image URL' };
    const [, subtype, base64] = match;
    const ext = subtype === 'jpeg' ? 'jpg' : subtype;
    const tempFile = path.join(os.tmpdir(), `roku-screenshot-${Date.now()}.${ext}`);
    try {
      await fs.promises.writeFile(tempFile, Buffer.from(base64, 'base64'));
      return { success: true, tempFile };
    } catch (error: unknown) {
      return { success: false, error: errMsg(error) };
    }
  });

  // Deletes one screenshot temp file — the session gallery's Clear/Clear All actions and a device
  // tab's disconnect teardown both call this so a capture's temp file doesn't outlive its own
  // history entry (previously nothing ever deleted these except an explicit Save). Renderer-
  // supplied path is untrusted, so restrict to `os.tmpdir()` — same guard RokuSaveScreenshot uses.
  ipcMain.handle(IPC.DeleteScreenshotTempFile, async (_event: IpcMainInvokeEvent, { tempFile }: { tempFile: string }) => {
    const safePath = tempFile ? resolveUserPathUnderOneOf([os.tmpdir()], tempFile) : null;
    if (!safePath) return { success: false, error: 'Invalid temp file path' };
    try {
      await fs.promises.unlink(safePath);
    } catch {
      // Best-effort — already gone, or a transient lock. Not worth surfacing to the user.
    }
    return { success: true };
  });

  // Developer password check: Digest GET http://device/ (same as browser sign-in; no screenshot required)
  ipcMain.handle(IPC.RokuVerifyDevAuth, async (_event: IpcMainInvokeEvent, { ip, password }: IpPasswordPayload) => {
    return verifyDeveloperDigestAuth({ ip, password: password || '' });
  });

  // Take screenshot from Roku device (single implementation in lib/roku-screenshot.js; used by Dev App and Action Executor)
  ipcMain.handle(IPC.RokuScreenshot, async (_event: IpcMainInvokeEvent, { ip, password, waitAfterTriggerMs }: IpPasswordScreenshotPayload) => {
    const result = await captureRokuScreenshot({ ip, password, waitAfterTriggerMs });
    if (!result.success) {
      return result;
    }
    const tempFile = path.join(os.tmpdir(), `roku-screenshot-${Date.now()}.jpg`);
    try {
      await fs.promises.writeFile(tempFile, result.imageBuffer);
    } catch (err: unknown) {
      mainError('Screenshot: failed to write temp file', errMsg(err));
      return { success: false, error: S.devApp.failedToSaveScreenshot(errMsg(err)) };
    }
    const dataUrl = `data:image/jpeg;base64,${result.imageBuffer.toString('base64')}`;
    return { success: true, url: dataUrl, tempFile, message: S.devApp.screenshotCapturedToast };
  });
}

export { setupDevAppHandlers, computeSideloadDebugFlags, resolveSideloadPackageFile };

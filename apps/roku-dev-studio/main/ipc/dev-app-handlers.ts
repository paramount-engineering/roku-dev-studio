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
import { mainError } from '../log.js';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveUserPathUnderOneOf } = require('../../lib/path-safe.js');
const { userProfileDirectories } = require('roku-dev-studio-platform/node');

const {
  captureRokuScreenshot,
  verifyDeveloperDigestAuth,
  sideloadChannel,
  deleteSideload
} = require('roku-dev-studio-api');

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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
    return { success: false, error: 'Select a .zip or .pkg Roku channel package' };
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
      title: 'Select Roku Channel Package',
      filters: [
        { name: 'Roku Channel Package', extensions: ['zip', 'pkg'] }
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
  ipcMain.handle(IPC.RokuSideload, async (_event: IpcMainInvokeEvent, { ip, filePath, password }: IpFilePasswordPayload) => {
    // Go through the same validation as the picker/drag paths so a direct IPC
    // call can't sideload a non-package (or a file outside the allowed dirs).
    const resolvedFile = resolveSideloadPackageFile(filePath);
    if (!resolvedFile.success) {
      return resolvedFile;
    }
    const resolved = resolvedFile.filePath;
    return sideloadChannel({ ip, filePath: resolved, password });
  });

  // Delete sideloaded channel (shared logic in lib/roku-plugin-install.js)
  ipcMain.handle(IPC.RokuDeleteSideload, async (_event: IpcMainInvokeEvent, { ip, password }: IpPasswordPayload) => {
    return deleteSideload({ ip, password });
  });

  // Save screenshot to file
  ipcMain.handle(IPC.RokuSaveScreenshot, async (_event: IpcMainInvokeEvent, { tempFile, dataUrl }: SaveScreenshotPayload) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save Screenshot',
      defaultPath: `roku-screenshot-${Date.now()}.jpg`,
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }
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
        fs.copyFileSync(tempFileSafe, result.filePath);
        try {
          fs.unlinkSync(tempFileSafe);
        } catch (unlinkErr) {
          // Ignore cleanup errors
        }
      } else if (dataUrl) {
        // Decode base64 data URL
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(result.filePath, buffer);
      } else {
        return { success: false, error: 'No screenshot data available' };
      }

      return { success: true, filePath: result.filePath };
    } catch (error: unknown) {
      return { success: false, error: errMsg(error) };
    }
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
      fs.writeFileSync(tempFile, result.imageBuffer);
    } catch (err: unknown) {
      mainError('Screenshot: failed to write temp file', errMsg(err));
      return { success: false, error: `Failed to save screenshot: ${errMsg(err)}` };
    }
    const dataUrl = `data:image/jpeg;base64,${result.imageBuffer.toString('base64')}`;
    return { success: true, url: dataUrl, tempFile, message: 'Screenshot captured!' };
  });
}

export { setupDevAppHandlers };

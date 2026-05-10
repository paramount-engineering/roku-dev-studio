// Dev app handlers (sideloading, screenshots, etc.)

import type { BrowserWindow, Dialog, IpcMainInvokeEvent } from 'electron';
import type {
  IpFilePasswordPayload,
  IpPasswordPayload,
  IpPasswordScreenshotPayload,
  SaveScreenshotPayload
} from '../../shared/ipc/payloads';
import { IPC } from '../../shared/ipc/channels';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveUserPathUnderOneOf } = require('../../lib/path-safe.js');

const {
  captureRokuScreenshot,
  verifyDeveloperDigestAuth,
  sideloadChannel,
  deleteSideload
} = require('roku-dev-studio-api');

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    const stats = fs.statSync(filePath);

    return {
      success: true,
      filePath,
      fileName,
      fileSize: stats.size
    };
  });

  // Sideload a channel package (shared logic in lib/roku-plugin-install.js). filePath must be under allowed dirs.
  ipcMain.handle(IPC.RokuSideload, async (_event: IpcMainInvokeEvent, { ip, filePath, password }: IpFilePasswordPayload) => {
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'File path required' };
    }
    const allowedBases = [os.homedir(), process.platform === 'win32' ? process.env.USERPROFILE || '' : os.homedir()].filter(Boolean);
    const resolved = resolveUserPathUnderOneOf(allowedBases, filePath);
    if (!resolved) {
      return { success: false, error: 'Path is not under an allowed directory' };
    }
    if (!fs.existsSync(resolved)) {
      return { success: false, error: 'File not found' };
    }
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
      console.error('Screenshot: failed to write temp file', errMsg(err));
      return { success: false, error: `Failed to save screenshot: ${errMsg(err)}` };
    }
    const dataUrl = `data:image/jpeg;base64,${result.imageBuffer.toString('base64')}`;
    return { success: true, url: dataUrl, tempFile, message: 'Screenshot captured!' };
  });
}

export { setupDevAppHandlers };

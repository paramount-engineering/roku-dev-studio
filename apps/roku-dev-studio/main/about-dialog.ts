/**
 * About dialog window and IPC handlers.
 * Uses preload for getInfo/copy/openExternal; no Node in renderer.
 */

import type { BrowserWindow, Clipboard, IpcMain, IpcMainInvokeEvent, Shell } from 'electron';
import { IPC } from '../shared/ipc/channels';
import { openExternalUrl } from './open-external-url';
import { isMacOS, platformLabel } from 'roku-dev-studio-platform';
import { mainError } from './log.js';

const path = require('path');
const os = require('os');
const { BrowserWindow: BrowserWindowConstructor, dialog } = require('electron');

function buildAboutInfo() {
  const packageJson = require('../package.json');
  const appVersion = packageJson.version;
  let rokuDevStudioApiVersion = 'unknown';
  try {
    rokuDevStudioApiVersion = require('roku-dev-studio-api').PACKAGE_VERSION ?? 'unknown';
  } catch {
    // Dependency missing or resolution failed (e.g. broken install)
  }
  const iconPath = path.join(__dirname, 'assets', 'icon-256.png');
  const iconUrl = `file://${iconPath.replace(/\\/g, '/')}`;
  return {
    appVersion,
    rokuDevStudioApiVersion,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromiumVersion: process.versions.chrome,
    v8Version: process.versions.v8,
    osType: platformLabel(os.platform()),
    arch: os.arch(),
    osRelease: os.release(),
    iconUrl,
    repoUrl: 'https://github.com/paramount-engineering/roku-dev-studio',
    authorUrl: packageJson.author?.url || 'https://github.com/hdonapati',
  };
}

/**
 * Register IPC handlers for the About dialog (getInfo, copy, openExternal).
 */
function registerAboutIpc(ipcMain: IpcMain, clipboard: Clipboard, shell: Shell) {
  ipcMain.handle(IPC.AboutGetInfo, (_event: IpcMainInvokeEvent) => {
    return buildAboutInfo();
  });
  ipcMain.handle(IPC.AboutCopy, (_event: IpcMainInvokeEvent, text: string) => {
    clipboard.writeText(text);
    return Promise.resolve();
  });
  ipcMain.handle(IPC.AboutOpenExternal, (_event: IpcMainInvokeEvent, url: string) => {
    return openExternalUrl(shell, url);
  });
}

/**
 * Show the About dialog (modal, parent = mainWindow).
 */
function showAboutDialog(mainWindow: BrowserWindow) {
  if (!mainWindow) {
    mainError('Main window not available');
    return;
  }

  const isMac = isMacOS();

  const aboutWindow = new BrowserWindowConstructor({
    width: 500,
    height: 400,
    resizable: false,
    minimizable: false,
    maximizable: false,
    modal: true,
    parent: mainWindow,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload-about.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    titleBarStyle: isMac ? 'default' : 'default',
    frame: true,
    show: false
  });

  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show();
  });

  try {
    aboutWindow.loadFile(path.join(__dirname, 'renderer', 'about.html'));
  } catch (error) {
    mainError('Error loading About dialog:', error);
    dialog.showErrorBox('Error', 'Failed to load About dialog. Please try again.');
  }
}

export { showAboutDialog, registerAboutIpc };

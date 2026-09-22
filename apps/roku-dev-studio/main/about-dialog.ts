/**
 * About dialog window and IPC handlers.
 * Uses preload for getInfo/copy/openExternal; no Node in renderer.
 */

import type { BrowserWindow, Clipboard, IpcMain, IpcMainEvent, IpcMainInvokeEvent, Shell } from 'electron';
import { IPC } from '../shared/ipc/channels';
import { openExternalUrl } from './open-external-url';
import { isMacOS, platformLabel } from 'roku-dev-studio-platform';
import { mainError } from './log.js';
import { S } from '../shared/strings/index';

const path = require('path');
const os = require('os');
const { BrowserWindow: BrowserWindowConstructor, dialog } = require('electron');

/** About windows that have painted / that the page has fitted — shown only when both are true. */
const aboutReadyToShow = new WeakSet<BrowserWindow>();
const aboutFitted = new WeakSet<BrowserWindow>();
/** If the page never reports a height (e.g. it failed to load), show anyway after this long. */
const ABOUT_SHOW_FALLBACK_MS = 400;

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
    siteUrl: 'https://paramount-engineering.github.io/roku-dev-studio/',
  };
}

/**
 * Register IPC handlers for the About dialog (getInfo, copy, openExternal).
 */
function registerAboutIpc(ipcMain: IpcMain, clipboard: Clipboard, shell: Shell) {
  // The window is not user-resizable and its content height varies by locale (and grows when rows are
  // added), so the page reports its rendered height and we fit the content area to it — no dead space
  // under the buttons, no scrollbar. Clamped so a runaway value can't produce an absurd window.
  ipcMain.on(IPC.AboutFitHeight, (event: IpcMainEvent, contentHeight: unknown) => {
    const win = BrowserWindowConstructor.fromWebContents(event.sender);
    if (!win || win.isDestroyed() || typeof contentHeight !== 'number' || !Number.isFinite(contentHeight)) return;
    const [width, current] = win.getContentSize();
    const target = Math.round(Math.min(Math.max(contentHeight, 320), 800));
    if (Math.abs(target - current) >= 2) win.setContentSize(width, target, false);
    aboutFitted.add(win);
    // Reveal only now: the user never sees the pre-fit height (a scrollbar flashing, then a jump).
    if (aboutReadyToShow.has(win) && !win.isVisible()) win.show();
  });
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
    // Content-area size; the page then reports its exact rendered height (IPC.AboutFitHeight).
    height: 470,
    useContentSize: true,
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
    aboutReadyToShow.add(aboutWindow);
    if (aboutFitted.has(aboutWindow)) {
      aboutWindow.show();
      return;
    }
    // Normally the fit message (IPC.AboutFitHeight) shows the window a few ms from now; this only
    // guards against a page that never reports (load failure), so it can't stay invisible.
    setTimeout(() => {
      if (!aboutWindow.isDestroyed() && !aboutWindow.isVisible()) aboutWindow.show();
    }, ABOUT_SHOW_FALLBACK_MS);
  });

  try {
    aboutWindow.loadFile(path.join(__dirname, 'renderer', 'about.html'));
  } catch (error) {
    mainError('Error loading About dialog:', error);
    dialog.showErrorBox(S.common.error, S.about.loadFailedMessage);
  }
}

export { showAboutDialog, registerAboutIpc };

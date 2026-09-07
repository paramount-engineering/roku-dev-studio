/**
 * Settings modal window — loadFile pattern; all HTML/CSS/JS are compiled bundled renderer entries.
 */

import type { BrowserWindow, Event, IpcMainEvent } from 'electron';
import { mainError } from './log.js';
import { S, getLocale } from '../shared/strings/index';
import { IPC } from '../shared/ipc/channels';

const path = require('path');
const { BrowserWindow: BrowserWindowConstructor, dialog, ipcMain } = require('electron');

/** The currently-open Settings window, so a second open request focuses/navigates it instead of
 *  stacking another modal. */
let settingsWindowRef: (BrowserWindow & { __rdsDestroying?: boolean }) | null = null;

/**
 * Show the Settings dialog (modal, parent = mainWindow). When `initialSection` is given, the window
 * opens navigated to that section (e.g. 'network-inspector'); if Settings is already open it's
 * focused and navigated instead of opening a duplicate.
 */
function showSettingsDialog(mainWindow: BrowserWindow, initialSection?: string, highlightId?: string) {
  if (!mainWindow) {
    mainError('Main window not available');
    return;
  }

  // Already open: focus it and (optionally) navigate to the requested section / flash a row.
  if (settingsWindowRef && !settingsWindowRef.isDestroyed()) {
    settingsWindowRef.focus();
    if (initialSection || highlightId) {
      settingsWindowRef.webContents
        .executeJavaScript(
          `window.rdsNavigateSettingsSection && window.rdsNavigateSettingsSection(${JSON.stringify(initialSection || '')}, ${JSON.stringify(highlightId || '')})`
        )
        .catch(() => undefined);
    }
    return;
  }

  const settingsWindow = new BrowserWindowConstructor({
    width: 820,
    height: 780,
    minWidth: 640,
    minHeight: 580,
    resizable: true,
    minimizable: false,
    maximizable: true,
    modal: true,
    parent: mainWindow,
    backgroundColor: '#08080c',
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    titleBarStyle: 'default',
    frame: true,
    show: false,
    title: S.settings.heading
  });

  settingsWindowRef = settingsWindow as BrowserWindow & { __rdsDestroying?: boolean };

  // Reveal the window only once the renderer signals its initial getState() population is
  // done (`SettingsWindowReady`). Showing on `ready-to-show` alone reveals the static shell
  // and then visibly flashes as getState() flips the toggles and builds the dynamic sections.
  // A fallback timer guarantees the window still appears if the renderer errors before it
  // signals (or the signal is throttled).
  let shown = false;
  const revealSettings = () => {
    if (shown || settingsWindow.isDestroyed()) return;
    shown = true;
    settingsWindow.show();
  };
  const onSettingsReady = (e: IpcMainEvent) => {
    if (!settingsWindow.isDestroyed() && e.sender === settingsWindow.webContents) revealSettings();
  };
  ipcMain.once(IPC.SettingsWindowReady, onSettingsReady);
  settingsWindow.once('ready-to-show', () => {
    setTimeout(revealSettings, 1500);
  });

  settingsWindow.on('closed', () => {
    ipcMain.removeListener(IPC.SettingsWindowReady, onSettingsReady);
    if (settingsWindowRef === settingsWindow) settingsWindowRef = null;
  });

  settingsWindow.on('close', (e: Event) => {
    const sw = settingsWindow as import('electron').BrowserWindow & { __rdsDestroying?: boolean };
    if (sw.__rdsDestroying) return;
    e.preventDefault();
    settingsWindow.webContents
      .executeJavaScript('window.requestCloseSettingsWindow && window.requestCloseSettingsWindow()')
      .catch(() => {
        sw.__rdsDestroying = true;
        settingsWindow.destroy();
      });
  });

  try {
    // Pass the resolved effective locale so the renderer can apply it before its
    // first paint (avoids the English → locale re-render flash on open).
    const q: Record<string, string> = { locale: getLocale() };
    if (initialSection) q.section = initialSection;
    if (highlightId) q.highlight = highlightId;
    settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'), { query: q });
  } catch (error) {
    mainError('Error loading Settings dialog:', error);
    dialog.showErrorBox(S.common.error, S.settings.loadFailedMessage);
  }
}

export { showSettingsDialog };

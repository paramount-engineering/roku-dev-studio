/**
 * Settings modal window — loadFile pattern; all HTML/CSS/JS are compiled bundled renderer entries.
 */

import type { BrowserWindow, Event } from 'electron';
import { mainError } from './log.js';

const path = require('path');
const { BrowserWindow: BrowserWindowConstructor, dialog } = require('electron');

/** The currently-open Settings window, so a second open request focuses/navigates it instead of
 *  stacking another modal. */
let settingsWindowRef: (BrowserWindow & { __rdsDestroying?: boolean }) | null = null;

/**
 * Show the Settings dialog (modal, parent = mainWindow). When `initialSection` is given, the window
 * opens navigated to that section (e.g. 'network-inspector'); if Settings is already open it's
 * focused and navigated instead of opening a duplicate.
 */
function showSettingsDialog(mainWindow: BrowserWindow, initialSection?: string) {
  if (!mainWindow) {
    mainError('Main window not available');
    return;
  }

  // Already open: focus it and (optionally) navigate to the requested section.
  if (settingsWindowRef && !settingsWindowRef.isDestroyed()) {
    settingsWindowRef.focus();
    if (initialSection) {
      settingsWindowRef.webContents
        .executeJavaScript(
          `window.rdsNavigateSettingsSection && window.rdsNavigateSettingsSection(${JSON.stringify(initialSection)})`
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
    title: 'Settings'
  });

  settingsWindowRef = settingsWindow as BrowserWindow & { __rdsDestroying?: boolean };
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.on('closed', () => {
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
    const query = initialSection ? { query: { section: initialSection } } : undefined;
    settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'), query);
  } catch (error) {
    mainError('Error loading Settings dialog:', error);
    dialog.showErrorBox('Error', 'Failed to open Settings. Please try again.');
  }
}

export { showSettingsDialog };

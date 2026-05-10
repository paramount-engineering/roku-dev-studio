// IPC handlers index - wires all IPC handler modules together

import type { App, BrowserWindow, Clipboard, Dialog } from 'electron';
import type { GetDeviceIdFn, GetDeviceInfoFn, SafeSendFn } from '../../shared/ipc/payloads';
import { setupDeviceDiscovery } from './device-discovery';
import { setupRokuCommands } from './roku-commands';
import { setupRaleHandlers } from './rale-handlers';
import { setupDevAppHandlers } from './dev-app-handlers';
import { setupTelnetHandlers } from './telnet-handlers';
import { setupRemoteHandlers } from './remote-handlers';
import { setupSystemHandlers } from './system-handlers';

type AppWindowState = {
  developerModeEnabled: boolean;
  privacyModeEnabled: boolean;
  debugLoggingEnabled: boolean;
  logFile: string | null;
};

/**
 * ipcMain.handle() throws if the same channel is registered twice. `main.ts` calls
 * setupIpcHandlers once in whenReady and again from `activate` if the main window was
 * recreated; without this guard the second call crashes the main process.
 */
let ipcHandlersRegistered = false;

function setupIpcHandlers(
  mainWindow: BrowserWindow | undefined,
  getDeviceInfo: GetDeviceInfoFn,
  getDeviceId: GetDeviceIdFn,
  safeSendToRenderer: SafeSendFn,
  dialog: Dialog,
  Menu: typeof import('electron').Menu,
  clipboard: Clipboard,
  app: App,
  state: AppWindowState
) {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;
  setupDeviceDiscovery(mainWindow, getDeviceInfo, getDeviceId, safeSendToRenderer);
  setupRokuCommands(mainWindow, getDeviceInfo);
  setupRaleHandlers(mainWindow, safeSendToRenderer);
  setupDevAppHandlers(mainWindow, dialog);
  setupTelnetHandlers(mainWindow, safeSendToRenderer);
  setupRemoteHandlers(mainWindow, safeSendToRenderer);
  setupSystemHandlers(mainWindow, dialog, Menu, clipboard, app, state);
}

export { setupIpcHandlers };

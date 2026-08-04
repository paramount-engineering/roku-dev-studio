// Basic Roku ECP command handlers — delegate to roku-dev-studio-api

import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type {
  GetDeviceInfoFn,
  IpAppIdPayload,
  IpAppParamsPayload,
  IpDeeplinkPayload,
  IpEndpointPayload,
  IpKeyPayload,
  IpTextPayload
} from '../../shared/ipc/payloads';
import { IPC } from '../../shared/ipc/channels';

const {
  keypress,
  launch,
  query,
  post,
  inputText,
  deeplink,
  testConnection,
  getIcon
} = require('roku-dev-studio-api');

type IpOnly = { ip: string };

/**
 * Setup basic Roku command IPC handlers
 */
function setupRokuCommands(_mainWindow: BrowserWindow | undefined, _getDeviceInfo: GetDeviceInfoFn) {
  const { ipcMain } = require('electron');

  ipcMain.handle(IPC.RokuKeypress, async (_event: IpcMainInvokeEvent, { ip, key }: IpKeyPayload) =>
    keypress(ip, key));

  ipcMain.handle(IPC.RokuLaunch, async (_event: IpcMainInvokeEvent, { ip, appId, params }: IpAppParamsPayload) =>
    launch(ip, appId, params));

  ipcMain.handle(IPC.RokuQuery, async (_event: IpcMainInvokeEvent, { ip, endpoint }: IpEndpointPayload) =>
    query(ip, endpoint));

  ipcMain.handle(IPC.RokuPost, async (_event: IpcMainInvokeEvent, { ip, endpoint }: IpEndpointPayload) =>
    post(ip, endpoint));

  ipcMain.handle(IPC.RokuInputText, async (_event: IpcMainInvokeEvent, { ip, text }: IpTextPayload) =>
    inputText(ip, text));

  ipcMain.handle(IPC.RokuDeeplink, async (_event: IpcMainInvokeEvent, payload: IpDeeplinkPayload) =>
    deeplink(payload.ip, payload.appId, payload.contentId, payload.mediaType, { extraParams: payload.params }));

  ipcMain.handle(IPC.RokuTestConnection, async (_event: IpcMainInvokeEvent, { ip }: IpOnly) =>
    testConnection(ip));

  ipcMain.handle(IPC.RokuGetIcon, async (_event: IpcMainInvokeEvent, { ip, appId }: IpAppIdPayload) =>
    getIcon(ip, appId));
}

export { setupRokuCommands };

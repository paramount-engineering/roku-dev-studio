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
import { notifyDeviceConnectionSuspect } from '../device-connection-suspect';

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
 * `ecpRequest` (roku-dev-studio-api/ecp.ts) sets `statusCode` only when the device actually
 * responded (including 4xx/5xx) — a connection-level failure (ECONNREFUSED, EHOSTDOWN, a
 * timeout, …) never gets that far, so it never has one. That absence is a cleaner signal than
 * string-matching the error text: it can't accidentally match an auth/HTTP-status failure,
 * which says nothing about reachability.
 */
function isConnectionLevelFailure(result: unknown): boolean {
  if (result == null || typeof result !== 'object') return false;
  const r = result as { success?: unknown; statusCode?: unknown };
  return r.success === false && r.statusCode == null;
}

/** Runs `fn`, and if its result looks like a connection-level failure (not an HTTP-status/auth
 *  error), hints the shared reachability check to re-run *now* instead of waiting for its next
 *  scheduled tick. Does not itself decide "offline" — see `device-connection-suspect.ts`. */
async function withReachabilityHint<T>(ip: string, fn: () => Promise<T>): Promise<T> {
  const result = await fn();
  if (isConnectionLevelFailure(result)) notifyDeviceConnectionSuspect(ip);
  return result;
}

/**
 * Setup basic Roku command IPC handlers
 */
function setupRokuCommands(_mainWindow: BrowserWindow | undefined, _getDeviceInfo: GetDeviceInfoFn) {
  const { ipcMain } = require('electron');

  ipcMain.handle(IPC.RokuKeypress, async (_event: IpcMainInvokeEvent, { ip, key }: IpKeyPayload) =>
    withReachabilityHint(ip, () => keypress(ip, key)));

  ipcMain.handle(IPC.RokuLaunch, async (_event: IpcMainInvokeEvent, { ip, appId, params }: IpAppParamsPayload) =>
    withReachabilityHint(ip, () => launch(ip, appId, params)));

  ipcMain.handle(IPC.RokuQuery, async (_event: IpcMainInvokeEvent, { ip, endpoint }: IpEndpointPayload) =>
    withReachabilityHint(ip, () => query(ip, endpoint)));

  ipcMain.handle(IPC.RokuPost, async (_event: IpcMainInvokeEvent, { ip, endpoint }: IpEndpointPayload) =>
    withReachabilityHint(ip, () => post(ip, endpoint)));

  ipcMain.handle(IPC.RokuInputText, async (_event: IpcMainInvokeEvent, { ip, text }: IpTextPayload) =>
    withReachabilityHint(ip, () => inputText(ip, text)));

  ipcMain.handle(IPC.RokuDeeplink, async (_event: IpcMainInvokeEvent, payload: IpDeeplinkPayload) =>
    withReachabilityHint(payload.ip, () =>
      deeplink(payload.ip, payload.appId, payload.contentId, payload.mediaType, { extraParams: payload.params })));

  // Deliberately NOT wrapped: testConnection IS the reachability check itself (wrapping it would
  // just notify-then-immediately-recheck the same thing), and getIcon failures are routine for
  // channels with no custom icon — noisy, not a reachability signal.
  ipcMain.handle(IPC.RokuTestConnection, async (_event: IpcMainInvokeEvent, { ip }: IpOnly) =>
    testConnection(ip));

  ipcMain.handle(IPC.RokuGetIcon, async (_event: IpcMainInvokeEvent, { ip, appId }: IpAppIdPayload) =>
    getIcon(ip, appId));
}

export { setupRokuCommands };

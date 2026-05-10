// RALE (App Connector / TrackerTask) — device I/O from roku-dev-studio-api only

import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type { ConnectionIdPayload, IpPortPayload, RaleCommandPayload, SafeSendFn } from '../../shared/ipc/payloads';
import { IPC } from '../../shared/ipc/channels';

const {
  raleWake,
  raleConnect,
  raleCommand,
  raleDisconnect,
  raleConnectionStatus
} = require('roku-dev-studio-api');

/**
 * Setup RALE IPC handlers
 */
function setupRaleHandlers(_mainWindow: BrowserWindow | undefined, safeSendToRenderer: SafeSendFn) {
  const { ipcMain } = require('electron');

  ipcMain.handle(IPC.RokuRaleWake, async (_event: IpcMainInvokeEvent, { ip, port }: IpPortPayload) =>
    raleWake(ip, port));

  ipcMain.handle(IPC.RokuRaleConnect, async (_event: IpcMainInvokeEvent, { ip, port }: IpPortPayload) =>
    raleConnect(ip, port, {
      onClose: (connectionId: string) => {
        safeSendToRenderer(IPC.RaleDisconnected, { connectionId });
      }
    })
  );

  ipcMain.handle(IPC.RokuRaleCommand, async (_event: IpcMainInvokeEvent, payload: RaleCommandPayload) =>
    raleCommand(payload.connectionId, payload.command, payload.args || {})
  );

  ipcMain.handle(IPC.RokuRaleDisconnect, async (_event: IpcMainInvokeEvent, { connectionId }: ConnectionIdPayload) =>
    raleDisconnect(connectionId)
  );

  ipcMain.handle(IPC.RokuRaleStatus, async (_event: IpcMainInvokeEvent, { connectionId }: ConnectionIdPayload) =>
    raleConnectionStatus(connectionId)
  );
}

export { setupRaleHandlers };

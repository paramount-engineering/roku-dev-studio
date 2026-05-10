// Telnet to Roku (debug 8085, system 8080) — TCP from roku-dev-studio-api

import type { Socket } from 'net';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type { IpCommandPayload, IpPayload, SafeSendFn } from '../../shared/ipc/payloads';
import { IPC } from '../../shared/ipc/channels';
import {
  createTelnetIpcCoalesceState,
  flushCoalescedMapNow,
  scheduleCoalescedMapFlush,
  type TelnetIpcCoalesceState
} from './telnet-log-ipc-coalesce.js';
import { getPersistedTimingValue } from '../settings';

const {
  connectRokuDebugTelnet,
  connectRokuSystemTelnet,
  writeRokuTelnetLine
} = require('roku-dev-studio-api');

type DebugTelnetConn = {
  socket: Socket;
  isRemote: boolean;
  /** Batched text before IPC to renderer */
  ipcCoalesce: TelnetIpcCoalesceState;
};

type SystemTelnetConn = { socket: Socket; ipcCoalesce: TelnetIpcCoalesceState };

/** Process-wide telnet connection maps. Exposed so other main-process modules
 * (e.g. BrightScript Fiddle) can reuse the same pool and avoid fighting over
 * Roku's single-client 8085 socket. */
const telnetConnections = new Map<string, DebugTelnetConn>();
const telnetSystemConnections = new Map<string, SystemTelnetConn>();

let cachedSafeSend: SafeSendFn | null = null;

/**
 * Open (or re-open) the local 8085 debug telnet socket for `ip`. If a
 * connection already exists it is destroyed and replaced. Renderer stays in
 * sync via the usual `IPC.TelnetConnected` / `TelnetData` events.
 */
async function connectDebugTelnetInternal(ip: string): Promise<{ success: boolean; error?: string; connectionId?: string }> {
  const connectionId = ip;
  const safeSend = cachedSafeSend;
  if (telnetConnections.has(connectionId)) {
    const existing = telnetConnections.get(connectionId)!;
    flushCoalescedMapNow(telnetConnections, connectionId, (_live, slice) => {
      if (safeSend) safeSend(IPC.TelnetData, { ip, connectionId, data: slice });
    });
    if (existing.socket) existing.socket.destroy();
    telnetConnections.delete(connectionId);
  }
  const conn = await connectRokuDebugTelnet(ip, {
    connectTimeoutMs: getPersistedTimingValue('TELNET_TIMEOUT')
  });
  if (!conn.success) {
    console.warn('[Telnet] connect failed for', ip, ':8085 →', conn.error);
    return { success: false, error: conn.error };
  }

  const socket: Socket = conn.socket;
  telnetConnections.set(connectionId, {
    socket,
    isRemote: false,
    ipcCoalesce: createTelnetIpcCoalesceState()
  });
  console.log('[Telnet] connected to', ip, ':8085 (readyState=' + (socket as unknown as { readyState?: string }).readyState + ')');
  if (safeSend) safeSend(IPC.TelnetConnected, { ip, connectionId });

  socket.on('data', (data: Buffer) => {
    const text = data.toString('utf8');
    const connection = telnetConnections.get(connectionId);
    if (!connection) return;
    connection.ipcCoalesce.pending += text;
    scheduleCoalescedMapFlush(telnetConnections, connectionId, (_live, slice) => {
      if (safeSend) safeSend(IPC.TelnetData, { ip, connectionId, data: slice });
    });
  });

  socket.on('error', (error: Error) => {
    if (safeSend) {
      safeSend(IPC.TelnetError, { ip, connectionId, error: error.message });
    }
  });

  socket.on('close', (hadError: boolean) => {
    flushCoalescedMapNow(telnetConnections, connectionId, (_live, slice) => {
      if (safeSend) safeSend(IPC.TelnetData, { ip, connectionId, data: slice });
    });
    telnetConnections.delete(connectionId);
    if (safeSend) safeSend(IPC.TelnetDisconnected, { ip, connectionId, hadError });
  });

  return { success: true, connectionId };
}

async function disconnectDebugTelnetInternal(ip: string): Promise<{ success: boolean }> {
  const connectionId = ip;
  const safeSend = cachedSafeSend;
  const connection = telnetConnections.get(connectionId);
  if (connection && connection.socket) {
    flushCoalescedMapNow(telnetConnections, connectionId, (_live, slice) => {
      if (safeSend) safeSend(IPC.TelnetData, { ip, connectionId, data: slice });
    });
    connection.socket.destroy();
    telnetConnections.delete(connectionId);
  }
  return { success: true };
}

export async function bounceDebugTelnet(ip: string): Promise<{ success: boolean; error?: string }> {
  console.log('[Telnet] bounceDebugTelnet: disconnect + reconnect', ip);
  await disconnectDebugTelnetInternal(ip);
  const result = await connectDebugTelnetInternal(ip);
  return { success: result.success, error: result.error };
}

/**
 * Ensure the shared 8085 telnet socket is open for this IP WITHOUT bouncing a
 * healthy connection. Validates the socket is actually in `'open'` readyState
 * — `!destroyed` alone isn't enough because a stale map entry can carry a
 * half-open/zombie socket that passes the laxer check but never receives data.
 */
export async function ensureDebugTelnetConnected(ip: string): Promise<{ success: boolean; error?: string }> {
  const existing = telnetConnections.get(ip);
  const socket = existing?.socket as (Socket & { readyState?: string }) | undefined;
  const isHealthy = !!(existing && socket && !socket.destroyed && socket.readyState === 'open');
  if (isHealthy) {
    console.log('[Telnet] ensureDebugTelnetConnected: reusing healthy socket for', ip);
    return { success: true };
  }
  // Stale or missing — wipe it and open fresh.
  if (existing) {
    console.log('[Telnet] ensureDebugTelnetConnected: stale entry for', ip,
      '(destroyed=' + (socket?.destroyed ?? '?') + ', readyState=' + (socket?.readyState ?? '?') + ') — reconnecting');
    try { socket?.destroy(); } catch { /* ignore */ }
    telnetConnections.delete(ip);
  } else {
    console.log('[Telnet] ensureDebugTelnetConnected: no existing socket for', ip, '— opening fresh');
  }
  const result = await connectDebugTelnetInternal(ip);
  return { success: result.success, error: result.error };
}

/**
 * Setup telnet IPC handlers
 */
function setupTelnetHandlers(_mainWindow: BrowserWindow | undefined, safeSendToRenderer: SafeSendFn) {
  const { ipcMain } = require('electron');
  cachedSafeSend = safeSendToRenderer;

  ipcMain.handle(IPC.TelnetConnect, async (_event: IpcMainInvokeEvent, { ip }: IpPayload) => {
    const result = await connectDebugTelnetInternal(ip);
    if (result.success) console.log('[Telnet] Connected to', ip, ':8085');
    return result;
  });

  ipcMain.handle(IPC.TelnetDisconnect, async (_event: IpcMainInvokeEvent, { ip }: IpPayload) => {
    return await disconnectDebugTelnetInternal(ip);
  });

  ipcMain.handle(IPC.TelnetSend, async (_event: IpcMainInvokeEvent, { ip, command }: IpCommandPayload) => {
    const connectionId = ip;
    const connection = telnetConnections.get(connectionId);

    if (!connection || !connection.socket || connection.socket.destroyed) {
      return { success: false, error: 'Not connected' };
    }

    return writeRokuTelnetLine(connection.socket, command);
  });

  ipcMain.handle(IPC.TelnetStatus, async (_event: IpcMainInvokeEvent, { ip }: IpPayload) => {
    const connectionId = ip;
    const connection = telnetConnections.get(connectionId);
    const connected = connection && connection.socket && !connection.socket.destroyed;
    return { connected, connectionId };
  });

  ipcMain.handle(IPC.TelnetSystemConnect, async (_event: IpcMainInvokeEvent, { ip }: IpPayload) => {
    const connectionId = `${ip}:8080`;

    if (telnetSystemConnections.has(connectionId)) {
      const existing = telnetSystemConnections.get(connectionId)!;
      flushCoalescedMapNow(telnetSystemConnections, connectionId, (_live, slice) => {
        safeSendToRenderer(IPC.TelnetSystemData, { ip, connectionId, data: slice });
      });
      if (existing.socket) {
        existing.socket.destroy();
      }
      telnetSystemConnections.delete(connectionId);
    }

    const conn = await connectRokuSystemTelnet(ip, {
      connectTimeoutMs: getPersistedTimingValue('TELNET_TIMEOUT')
    });
    if (!conn.success) {
      return { success: false, error: conn.error };
    }

    const socket = conn.socket;
    console.log('[Telnet System] Connected to', ip, ':8080');

    telnetSystemConnections.set(connectionId, {
      socket,
      ipcCoalesce: createTelnetIpcCoalesceState()
    });

    socket.on('data', (data: Buffer) => {
      const text = data.toString('utf8');
      const sysConn = telnetSystemConnections.get(connectionId);
      if (!sysConn) return;
      sysConn.ipcCoalesce.pending += text;
      scheduleCoalescedMapFlush(telnetSystemConnections, connectionId, (_live, slice) => {
        safeSendToRenderer(IPC.TelnetSystemData, {
          ip,
          connectionId,
          data: slice
        });
      });
    });

    socket.on('error', (error: Error) => {
      console.log('[Telnet System] Socket error:', error.message);
    });

    socket.on('close', (hadError: boolean) => {
      console.log('[Telnet System] Socket closed, hadError:', hadError);
      flushCoalescedMapNow(telnetSystemConnections, connectionId, (_live, slice) => {
        safeSendToRenderer(IPC.TelnetSystemData, {
          ip,
          connectionId,
          data: slice
        });
      });
      telnetSystemConnections.delete(connectionId);
    });

    return { success: true, connectionId };
  });

  ipcMain.handle(IPC.TelnetSystemDisconnect, async (_event: IpcMainInvokeEvent, { ip }: IpPayload) => {
    const connectionId = `${ip}:8080`;
    const connection = telnetSystemConnections.get(connectionId);

    if (connection && connection.socket) {
      flushCoalescedMapNow(telnetSystemConnections, connectionId, (_live, slice) => {
        safeSendToRenderer(IPC.TelnetSystemData, { ip, connectionId, data: slice });
      });
      connection.socket.destroy();
      telnetSystemConnections.delete(connectionId);
    }

    return { success: true };
  });

  ipcMain.handle(IPC.TelnetSystemSend, async (_event: IpcMainInvokeEvent, { ip, command }: IpCommandPayload) => {
    const connectionId = `${ip}:8080`;
    const connection = telnetSystemConnections.get(connectionId);

    if (!connection || !connection.socket || connection.socket.destroyed) {
      return { success: false, error: 'Not connected' };
    }

    return writeRokuTelnetLine(connection.socket, command, { lineEnding: '\n' });
  });

  ipcMain.handle(IPC.TelnetSystemStatus, async (_event: IpcMainInvokeEvent, { ip }: IpPayload) => {
    const connectionId = `${ip}:8080`;
    const connection = telnetSystemConnections.get(connectionId);
    const connected = connection && connection.socket && !connection.socket.destroyed;
    return { connected, connectionId };
  });
}

export { setupTelnetHandlers };

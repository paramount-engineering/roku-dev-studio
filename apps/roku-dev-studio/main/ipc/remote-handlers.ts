// Remote server handlers (all remote:* IPC handlers)

import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type { IncomingMessage } from 'http';
import type {
  RemoteAppIdPayload,
  RemoteDevicePayload,
  RemoteDeeplinkPayload,
  RemoteEndpointPayload,
  RemoteKeypressPayload,
  RemoteLaunchPayload,
  RemoteRaleCommandPayload,
  RemoteRaleDisconnectPayload,
  RemoteRaleWakePayload,
  RemoteScreenshotPayload,
  RemoteVerifyDevAuthPayload,
  RemoteSideloadPayload,
  RemoteTextPayload,
  ServerUrlPayload,
  SafeSendFn
} from '../../shared/ipc/payloads';
import { IPC } from '../../shared/ipc/channels';
import {
  createTelnetIpcCoalesceState,
  flushCoalescedMapNow,
  scheduleCoalescedMapFlush,
  type TelnetIpcCoalesceState
} from './telnet-log-ipc-coalesce.js';

const WebSocket = require('ws');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveUserPathUnderOneOf } = require('../../lib/path-safe.js');

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Helper function to make HTTP request to remote server
 */
function remoteHttpRequest(
  serverUrl: string,
  pathStr: string,
  method = 'GET',
  body: Record<string, unknown> | null = null,
  timeout = 15000
) {
  return new Promise((resolve) => {
    const url = new URL(pathStr, serverUrl);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? require('https') : require('http');

    const headers: Record<string, string | number> = {};

    const options: {
      hostname: string;
      port: string | number;
      path: string;
      method: string;
      headers: Record<string, string | number>;
      timeout: number;
    } = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: method,
      headers,
      timeout: timeout
    };

    let postData: string | null = null;
    if (body) {
      postData = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const req = httpModule.request(options, (res: IncomingMessage) => {
      let data = '';
      res.on('data', (chunk: Buffer | string) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ success: false, error: 'Invalid JSON response', raw: data });
        }
      });
    });
    
    req.on('error', (err: Error) => {
      resolve({ success: false, error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timed out' });
    });
    
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

type RemoteTelnetConn = {
  ws: import('ws').WebSocket;
  sessionId: string;
  serverUrl: string;
  ip: string;
  isRemote: boolean;
  ipcCoalesce: TelnetIpcCoalesceState;
};

// Module-scoped state shared with non-IPC callers (e.g. Fiddle run flow, which
// needs to open the relay WebSocket before sideloading a remote device so
// telnet logs start streaming even if the user hasn't manually opened the
// remote Console panel).
const remoteTelnetConnections = new Map<string, RemoteTelnetConn>();
/** See `debugTelnetHoldersByIp` in telnet-handlers.ts — same lease model for relay streams. */
const remoteTelnetHoldersByConnId = new Map<string, Set<string>>();

function fiddleRemoteTelnetHolderKey(fiddleWindowId: number): string {
  return `fiddle:${fiddleWindowId}`;
}

function addRemoteTelnetHolder(connectionId: string, holder: string): void {
  let set = remoteTelnetHoldersByConnId.get(connectionId);
  if (!set) {
    set = new Set();
    remoteTelnetHoldersByConnId.set(connectionId, set);
  }
  set.add(holder);
}

async function closeRemoteTelnetConnection(connectionId: string): Promise<void> {
  const connection = remoteTelnetConnections.get(connectionId);
  if (!connection) return;
  const safeSendToRenderer: SafeSendFn = (channel, payload) => {
    return moduleSafeSendToRenderer ? moduleSafeSendToRenderer(channel, payload) : false;
  };
  flushCoalescedMapNow(remoteTelnetConnections, connectionId, (live, slice) => {
    safeSendToRenderer(IPC.TelnetData, {
      ip: live.ip,
      connectionId,
      data: slice,
      isRemote: true
    });
  });
  const { serverUrl, ip, sessionId } = connection;
  try {
    const url = new URL('/telnet/disconnect', serverUrl);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? require('https') : require('http');
    const postData = JSON.stringify({ sessionId });
    const req = httpModule.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    });
    req.write(postData);
    req.end();
  } catch (e: unknown) {
    console.log('[Remote Telnet] Error notifying relay of disconnect:', errMsg(e));
  }
  try {
    if (connection.ws) connection.ws.close();
  } catch { /* ignore */ }
  remoteTelnetConnections.delete(connectionId);
}

async function removeRemoteTelnetHolder(connectionId: string, holder: string): Promise<void> {
  const set = remoteTelnetHoldersByConnId.get(connectionId);
  if (!set) return;
  set.delete(holder);
  if (set.size === 0) {
    remoteTelnetHoldersByConnId.delete(connectionId);
    await closeRemoteTelnetConnection(connectionId);
  }
}

export async function releaseAllRemoteTelnetHoldersForFiddleWindow(
  fiddleWindowId: number
): Promise<void> {
  const key = fiddleRemoteTelnetHolderKey(fiddleWindowId);
  const connIds = [...remoteTelnetHoldersByConnId.entries()]
    .filter(([, holders]) => holders.has(key))
    .map(([connId]) => connId);
  await Promise.all(connIds.map((connId) => removeRemoteTelnetHolder(connId, key)));
}

export async function disconnectRemoteTelnetIfUnheld(
  serverUrl: string,
  ip: string
): Promise<void> {
  const connectionId = `${serverUrl}:${ip}`;
  const holders = remoteTelnetHoldersByConnId.get(connectionId);
  if (holders && holders.size > 0) return;
  if (!remoteTelnetConnections.has(connectionId)) return;
  remoteTelnetHoldersByConnId.delete(connectionId);
  await closeRemoteTelnetConnection(connectionId);
}

let moduleMainWindow: BrowserWindow | undefined;
let moduleSafeSendToRenderer: SafeSendFn | null = null;

/**
 * Low-level relay WebSocket establish. Requests a session from the relay,
 * opens the streaming WebSocket, and wires incoming log frames into
 * `IPC.TelnetData` so every listener (main Console, Fiddle windows, etc.) sees
 * the stream. Replaces any pre-existing connection for the same device.
 */
function establishRemoteTelnetConnection(
  serverUrl: string,
  ip: string
): Promise<{ success: boolean; error?: string; connectionId?: string; sessionId?: string }> {
  const connectionId = `${serverUrl}:${ip}`;
  const safeSendToRenderer: SafeSendFn = (channel, payload) => {
    return moduleSafeSendToRenderer ? moduleSafeSendToRenderer(channel, payload) : false;
  };
  const mainWindow = moduleMainWindow;

  // Close any existing connection so we don't duplicate stream handlers.
  if (remoteTelnetConnections.has(connectionId)) {
    const existing = remoteTelnetConnections.get(connectionId)!;
    flushCoalescedMapNow(remoteTelnetConnections, connectionId, (live, slice) => {
      safeSendToRenderer(IPC.TelnetData, {
        ip: live.ip,
        connectionId,
        data: slice,
        isRemote: true
      });
    });
    try { if (existing.ws) existing.ws.close(); } catch { /* ignore */ }
    remoteTelnetConnections.delete(connectionId);
  }

  return (async () => {
    try {
      const response = await new Promise<{ success?: boolean; error?: string; sessionId?: string }>((resolve, reject) => {
        const url = new URL('/telnet/connect', serverUrl);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? require('https') : require('http');
        const postData = JSON.stringify({ deviceIP: ip });
        const req = httpModule.request({
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 15000
        }, (res: IncomingMessage) => {
          let data = '';
          res.on('data', (chunk: Buffer | string) => { data += chunk; });
          res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch { reject(new Error('Invalid response from relay server')); }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Relay server request timed out')); });
        req.write(postData);
        req.end();
      });

      if (!response.success) {
        return { success: false, error: response.error || 'Failed to connect via relay' };
      }

      const sessionId = response.sessionId;
      if (!sessionId) {
        return { success: false, error: 'Relay did not return sessionId' };
      }

      const wsUrl = serverUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      const ws = new WebSocket(`${wsUrl}/telnet/stream/${sessionId}`);

      return await new Promise<{ success: boolean; error?: string; connectionId?: string; sessionId?: string }>((resolve) => {
        let resolved = false;

        ws.on('open', () => {
          console.log('[Remote Telnet] WebSocket connected to relay');
          remoteTelnetConnections.set(connectionId, {
            ws,
            sessionId,
            serverUrl,
            ip,
            isRemote: true,
            ipcCoalesce: createTelnetIpcCoalesceState()
          });
          if (!resolved) {
            resolved = true;
            resolve({ success: true, connectionId, sessionId });
          }
          if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send(IPC.TelnetConnected, { ip, connectionId, isRemote: true, sessionId });
          }
        });

        ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
          try {
            const parsed = JSON.parse(data.toString());
            if (parsed.type === 'log') {
              const rt = remoteTelnetConnections.get(connectionId);
              if (rt && typeof parsed.data === 'string') {
                rt.ipcCoalesce.pending += parsed.data;
                scheduleCoalescedMapFlush(remoteTelnetConnections, connectionId, (live, slice) => {
                  safeSendToRenderer(IPC.TelnetData, { ip: live.ip, connectionId, data: slice, isRemote: true });
                });
              }
            } else if (parsed.type === 'disconnected') {
              ws.close();
            } else if (parsed.type === 'error') {
              safeSendToRenderer(IPC.TelnetError, { ip, connectionId, error: parsed.error, isRemote: true });
            }
          } catch {
            const rt = remoteTelnetConnections.get(connectionId);
            if (rt) {
              rt.ipcCoalesce.pending += data.toString();
              scheduleCoalescedMapFlush(remoteTelnetConnections, connectionId, (live, slice) => {
                safeSendToRenderer(IPC.TelnetData, { ip: live.ip, connectionId, data: slice, isRemote: true });
              });
            }
          }
        });

        ws.on('error', (error: Error) => {
          console.log('[Remote Telnet] WebSocket error:', error.message);
          if (!resolved) { resolved = true; resolve({ success: false, error: error.message }); }
        });

        ws.on('close', () => {
          console.log('[Remote Telnet] WebSocket closed');
          flushCoalescedMapNow(remoteTelnetConnections, connectionId, (live, slice) => {
            safeSendToRenderer(IPC.TelnetData, { ip: live.ip, connectionId, data: slice, isRemote: true });
          });
          remoteTelnetConnections.delete(connectionId);
          remoteTelnetHoldersByConnId.delete(connectionId);
          safeSendToRenderer(IPC.TelnetDisconnected, { ip, connectionId, isRemote: true });
        });

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            try { ws.close(); } catch { /* ignore */ }
            resolve({ success: false, error: 'WebSocket connection timed out' });
          }
        }, 15000);
      });
    } catch (error: unknown) {
      return { success: false, error: errMsg(error) };
    }
  })();
}

/**
 * Ensure a relay-backed telnet stream is live for the given remote device.
 * Reuses an already-open WebSocket (so opening Fiddle doesn't disconnect the
 * user's existing Console session) and only dials the relay if nothing is
 * currently connected. Intended for the Fiddle run flow — call this before
 * sideloading so `[FIDDLE_BEGIN:…]` and subsequent prints can reach us.
 */
export async function ensureRemoteTelnetConnected(
  serverUrl: string,
  ip: string,
  options?: { holder?: string }
): Promise<{ success: boolean; error?: string }> {
  const connectionId = `${serverUrl}:${ip}`;
  const existing = remoteTelnetConnections.get(connectionId);
  // ws.OPEN === 1 but WebSocket.OPEN may not be imported; readyState 1 is open.
  if (existing && existing.ws && existing.ws.readyState === 1) {
    if (options?.holder) addRemoteTelnetHolder(connectionId, options.holder);
    return { success: true };
  }
  const res = await establishRemoteTelnetConnection(serverUrl, ip);
  if (res.success && options?.holder) addRemoteTelnetHolder(connectionId, options.holder);
  return { success: !!res.success, error: res.error };
}

/**
 * Setup remote server IPC handlers
 */
function setupRemoteHandlers(mainWindow: BrowserWindow | undefined, safeSendToRenderer: SafeSendFn) {
  const { ipcMain } = require('electron');
  moduleMainWindow = mainWindow;
  moduleSafeSendToRenderer = safeSendToRenderer;

  // Discover devices on a remote location
  ipcMain.handle(IPC.RemoteDiscover, async (_event: IpcMainInvokeEvent, { serverUrl }: ServerUrlPayload) => {
    console.log('Discovering devices on remote server:', serverUrl);
    return await remoteHttpRequest(serverUrl, '/devices');
  });

  // Get cached devices from remote location (fast)
  ipcMain.handle(IPC.RemoteDevicesCached, async (_event: IpcMainInvokeEvent, { serverUrl }: ServerUrlPayload) => {
    return await remoteHttpRequest(serverUrl, '/devices/cached');
  });

  // Health check for remote server
  ipcMain.handle(IPC.RemoteHealth, async (_event: IpcMainInvokeEvent, { serverUrl }: ServerUrlPayload) => {
    return await remoteHttpRequest(serverUrl, '/health');
  });

  // Get server capabilities/features
  ipcMain.handle(IPC.RemoteCapabilities, async (_event: IpcMainInvokeEvent, { serverUrl }: ServerUrlPayload) => {
    return await remoteHttpRequest(serverUrl, '/capabilities');
  });

  // Get device info from remote location
  ipcMain.handle(IPC.RemoteDeviceInfo, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    return await remoteHttpRequest(serverUrl, `/device/${ip}/info`);
  });

  // Send key press via remote server
  ipcMain.handle(IPC.RemoteKeypress, async (_event: IpcMainInvokeEvent, { serverUrl, ip, key }: RemoteKeypressPayload) => {
    return await remoteHttpRequest(serverUrl, `/device/${ip}/keypress/${key}`, 'POST');
  });

  // Launch app via remote server
  ipcMain.handle(IPC.RemoteLaunch, async (_event: IpcMainInvokeEvent, { serverUrl, ip, appId, params }: RemoteLaunchPayload) => {
    return await remoteHttpRequest(serverUrl, `/device/${ip}/launch/${appId}`, 'POST', { params });
  });

  // Query device via remote server
  ipcMain.handle(IPC.RemoteQuery, async (_event: IpcMainInvokeEvent, { serverUrl, ip, endpoint }: RemoteEndpointPayload) => {
    return await remoteHttpRequest(serverUrl, `/device/${ip}${endpoint}`);
  });

  // POST to device via remote server
  ipcMain.handle(IPC.RemotePost, async (_event: IpcMainInvokeEvent, { serverUrl, ip, endpoint }: RemoteEndpointPayload) => {
    return await remoteHttpRequest(serverUrl, `/device/${ip}/post${endpoint}`, 'POST');
  });

  // Input text via remote server
  ipcMain.handle(IPC.RemoteInputText, async (_event: IpcMainInvokeEvent, { serverUrl, ip, text }: RemoteTextPayload) => {
    return await remoteHttpRequest(serverUrl, `/device/${ip}/input-text`, 'POST', { text });
  });

  // Deep link via remote server
  ipcMain.handle(IPC.RemoteDeeplink, async (_event: IpcMainInvokeEvent, payload: RemoteDeeplinkPayload) => {
    const { serverUrl, ip, appId, contentId, mediaType } = payload;
    return await remoteHttpRequest(serverUrl, `/device/${ip}/deeplink`, 'POST', { appId, contentId, mediaType });
  });

  // Get app icon via remote server
  ipcMain.handle(IPC.RemoteGetIcon, async (_event: IpcMainInvokeEvent, { serverUrl, ip, appId }: RemoteAppIdPayload) => {
    return await remoteHttpRequest(serverUrl, `/device/${ip}/icon/${appId}`);
  });

  // Screenshot via remote server
  ipcMain.handle(IPC.RemoteScreenshot, async (_event: IpcMainInvokeEvent, payload: RemoteScreenshotPayload) => {
    const { serverUrl, ip, password, waitAfterTriggerMs } = payload;
    return await remoteHttpRequest(serverUrl, `/device/${ip}/screenshot`, 'POST', { password, waitAfterTriggerMs });
  });

  // Developer Digest auth check via remote server (no screenshot)
  ipcMain.handle(IPC.RemoteVerifyDevAuth, async (_event: IpcMainInvokeEvent, payload: RemoteVerifyDevAuthPayload) => {
    const { serverUrl, ip, password } = payload;
    return await remoteHttpRequest(serverUrl, `/device/${ip}/verify-dev-auth`, 'POST', { password });
  });

  // Sideload via remote server (file must be on remote server)
  ipcMain.handle(IPC.RemoteSideload, async (_event: IpcMainInvokeEvent, payload: RemoteSideloadPayload) => {
    const { serverUrl, ip, filePath, password } = payload;
    return await remoteHttpRequest(serverUrl, `/device/${ip}/sideload`, 'POST', { filePath, password });
  });

  // Sideload via remote server with file upload from local machine. filePath must be under allowed dirs.
  ipcMain.handle(IPC.RemoteSideloadUpload, async (_event: IpcMainInvokeEvent, payload: RemoteSideloadPayload) => {
    const { serverUrl, ip, filePath, password } = payload;
    try {
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: 'File path required' };
      }
      const allowedBases = [os.homedir(), process.platform === 'win32' ? process.env.USERPROFILE || '' : os.homedir()].filter(Boolean);
      const resolved = resolveUserPathUnderOneOf(allowedBases, filePath);
      if (!resolved) {
        return { success: false, error: 'Path is not under an allowed directory' };
      }
      if (!fs.existsSync(resolved)) {
        return { success: false, error: 'File not found: ' + filePath };
      }
      const fileName = path.basename(resolved);
      const fileBuffer = fs.readFileSync(resolved);
      
      // Create form data
      const form = new FormData();
      form.append('file', fileBuffer, {
        filename: fileName,
        contentType: 'application/zip'
      });
      form.append('password', password);
      
      // Parse server URL
      const urlObj = new URL(serverUrl);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 80,
        path: `/device/${ip}/sideload`,
        method: 'POST',
        headers: form.getHeaders(),
        timeout: 180000 // 3 minutes timeout for upload + install
      };
      
      return new Promise((resolve) => {
        const http = require(urlObj.protocol === 'https:' ? 'https' : 'http');
        const req = http.request(options, (res: IncomingMessage) => {
          let data = '';
          res.on('data', (chunk: Buffer | string) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve({ success: false, error: 'Invalid response from server' });
            }
          });
        });
        
        // Set socket timeout as well
        req.setTimeout(180000);
        
        req.on('error', (error: Error) => {
          resolve({ success: false, error: error.message });
        });
        
        req.on('timeout', () => {
          req.destroy();
          resolve({ success: false, error: 'Request timeout - sideload may still be in progress' });
        });
        
        form.pipe(req);
      });
    } catch (error: unknown) {
      return { success: false, error: errMsg(error) };
    }
  });

  // Delete sideload via remote server
  ipcMain.handle(IPC.RemoteDeleteSideload, async (_event: IpcMainInvokeEvent, payload: RemoteSideloadPayload) => {
    const { serverUrl, ip, password } = payload;
    return await remoteHttpRequest(serverUrl, `/device/${ip}/delete-sideload`, 'POST', { password });
  });

  // RALE wake via remote server
  ipcMain.handle(IPC.RemoteRaleWake, async (_event: IpcMainInvokeEvent, payload: RemoteRaleWakePayload) => {
    const { serverUrl, ip, port } = payload;
    return await remoteHttpRequest(serverUrl, `/device/${ip}/rale/wake`, 'POST', { port });
  });

  // RALE connect via remote server (longer timeout for socket operations)
  ipcMain.handle(IPC.RemoteRaleConnect, async (_event: IpcMainInvokeEvent, payload: RemoteRaleWakePayload) => {
    const { serverUrl, ip, port } = payload;
    // Use 20s timeout (longer than server's 10s socket timeout)
    return await remoteHttpRequest(serverUrl, `/device/${ip}/rale/connect`, 'POST', { port }, 20000);
  });

  // RALE command via remote server (longer timeout for socket operations)
  ipcMain.handle(IPC.RemoteRaleCommand, async (_event: IpcMainInvokeEvent, payload: RemoteRaleCommandPayload) => {
    const { serverUrl, connectionId, command, args } = payload;
    // Extract IP from connectionId (format: ip:port)
    const ip = connectionId.split(':')[0];
    // Use 45s timeout (longer than server's 30s socket timeout)
    return await remoteHttpRequest(serverUrl, `/device/${ip}/rale/command`, 'POST', { connectionId, command, args }, 45000);
  });

  // RALE disconnect via remote server
  ipcMain.handle(IPC.RemoteRaleDisconnect, async (_event: IpcMainInvokeEvent, payload: RemoteRaleDisconnectPayload) => {
    const { serverUrl, connectionId } = payload;
    const ip = connectionId.split(':')[0];
    return await remoteHttpRequest(serverUrl, `/device/${ip}/rale/disconnect`, 'POST', { connectionId });
  });

  // ============================================
  // Remote Telnet (via Relay Server)
  // ============================================

  // Connect to remote telnet via relay server. Delegates to the module-scoped
  // helper so Fiddle and the Console share one connection pool and wiring.
  // The IPC handler preserves the historical "force-reconnect" semantics: when
  // the user explicitly hits Connect we tear down any existing session and
  // dial a fresh one.
  ipcMain.handle(IPC.RemoteTelnetConnect, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    const connectionId = `${serverUrl}:${ip}`;
    const res = await establishRemoteTelnetConnection(serverUrl, ip);
    if (res.success) addRemoteTelnetHolder(connectionId, 'main-ui');
    return res;
  });

  // Disconnect remote telnet
  ipcMain.handle(IPC.RemoteTelnetDisconnect, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    const connectionId = `${serverUrl}:${ip}`;
    await removeRemoteTelnetHolder(connectionId, 'main-ui');
    return { success: true };
  });

  // Send command to remote telnet
  ipcMain.handle(IPC.RemoteTelnetSend, async (
    _event: IpcMainInvokeEvent,
    { serverUrl, ip, command }: RemoteDevicePayload & { command: string }
  ) => {
    const connectionId = `${serverUrl}:${ip}`;
    const connection = remoteTelnetConnections.get(connectionId);
    
    if (!connection || !connection.ws || connection.ws.readyState !== 1) {
      return { success: false, error: 'Not connected' };
    }
    
    try {
      connection.ws.send(JSON.stringify({ command }));
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: errMsg(error) };
    }
  });

  // Check remote telnet connection status
  ipcMain.handle(IPC.RemoteTelnetStatus, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    const connectionId = `${serverUrl}:${ip}`;
    const connection = remoteTelnetConnections.get(connectionId);
    const connected = connection && connection.ws && connection.ws.readyState === 1;
    return { connected, connectionId, sessionId: connection?.sessionId };
  });

  // ============================================
  // Remote Telnet System Commands (Port 8080)
  // ============================================

  // Connect to remote telnet system (port 8080)
  ipcMain.handle(IPC.RemoteTelnetSystemConnect, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    return await remoteHttpRequest(serverUrl, `/device/${ip}/telnet-system/connect`, 'POST');
  });

  // Disconnect from remote telnet system
  ipcMain.handle(IPC.RemoteTelnetSystemDisconnect, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    return await remoteHttpRequest(serverUrl, `/device/${ip}/telnet-system/disconnect`, 'POST');
  });

  // Send command to remote telnet system
  ipcMain.handle(IPC.RemoteTelnetSystemSend, async (
    _event: IpcMainInvokeEvent,
    { serverUrl, ip, command }: RemoteDevicePayload & { command: string }
  ) => {
    return await remoteHttpRequest(serverUrl, `/device/${ip}/telnet-system/send`, 'POST', { command });
  });

  // Get remote telnet system status
  ipcMain.handle(IPC.RemoteTelnetSystemStatus, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    return await remoteHttpRequest(serverUrl, `/device/${ip}/telnet-system/status`, 'GET');
  });

  // Poll data from remote telnet system
  ipcMain.handle(IPC.RemoteTelnetSystemPollData, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    return await remoteHttpRequest(serverUrl, `/device/${ip}/telnet-system/data`, 'GET');
  });
}

export { setupRemoteHandlers };

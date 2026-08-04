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
  appendCoalescedText,
  createTelnetIpcCoalesceState,
  flushCoalescedMapNow,
  scheduleCoalescedMapFlush,
  type TelnetIpcCoalesceState
} from './telnet-log-ipc-coalesce.js';
import { mainLog } from '../log.js';
import { isSafeRelayUrl, remoteHttpRequest } from '../remote-http';

const { computeInputTextRelayHttpTimeoutMs } = require('roku-dev-studio-api');
const WebSocket = require('ws');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { resolveUserPathUnderOneOf } = require('roku-dev-studio-platform/path-safe');
const { userProfileDirectories } = require('roku-dev-studio-platform/node');

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Build a `/device/<ip>...` path with the IP encoded as a single path segment
 * so addresses containing reserved characters can't break out of the segment. */
function devicePath(ip: string, suffix = ''): string {
  return `/device/${encodeURIComponent(ip)}${suffix}`;
}

type RemoteTelnetConn = {
  ws: import('ws').WebSocket;
  sessionId: string;
  serverUrl: string;
  ip: string;
  isRemote: boolean;
  ipcCoalesce: TelnetIpcCoalesceState;
  openedAtMs: number;
  bytesReceived: number;
  /** Set when the relay reports Roku socket closed with hadError. */
  relayCloseHadError?: boolean;
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
      },
      timeout: 5000
    });
    // Fire-and-forget, but bound it: swallow errors and destroy on timeout so a
    // dead relay can't leak a hung socket on every disconnect.
    req.on('error', () => { /* ignore */ });
    req.on('timeout', () => req.destroy());
    req.write(postData);
    req.end();
  } catch (e: unknown) {
    mainLog('[Remote Telnet] Error notifying relay of disconnect:', errMsg(e));
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
  ip: string,
  options?: { skipRelayBuffer?: boolean }
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
      if (!isSafeRelayUrl(serverUrl)) {
        return { success: false, error: 'Invalid relay server URL' };
      }
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
      const streamQuery = options?.skipRelayBuffer ? '?skipBuffer=1' : '';
      const ws = new WebSocket(`${wsUrl}/telnet/stream/${sessionId}${streamQuery}`);

      return await new Promise<{ success: boolean; error?: string; connectionId?: string; sessionId?: string }>((resolve) => {
        let resolved = false;
        let wsCloseHadError = false;

        ws.on('open', () => {
          mainLog('[Remote Telnet] WebSocket connected to relay');
          remoteTelnetConnections.set(connectionId, {
            ws,
            sessionId,
            serverUrl,
            ip,
            isRemote: true,
            ipcCoalesce: createTelnetIpcCoalesceState(),
            openedAtMs: Date.now(),
            bytesReceived: 0
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
          const chunkText = Buffer.isBuffer(data)
            ? data.toString('utf8')
            : Array.isArray(data)
              ? Buffer.concat(data).toString('utf8')
              : Buffer.from(data).toString('utf8');
          try {
            const parsed = JSON.parse(chunkText);
            if (parsed.type === 'log') {
              const rt = remoteTelnetConnections.get(connectionId);
              if (rt && typeof parsed.data === 'string') {
                rt.bytesReceived += Buffer.byteLength(parsed.data, 'utf8');
                appendCoalescedText(rt, parsed.data);
                scheduleCoalescedMapFlush(remoteTelnetConnections, connectionId, (live, slice) => {
                  safeSendToRenderer(IPC.TelnetData, { ip: live.ip, connectionId, data: slice, isRemote: true });
                });
              }
            } else if (parsed.type === 'disconnected') {
              const rt = remoteTelnetConnections.get(connectionId);
              if (rt && parsed.hadError) {
                rt.relayCloseHadError = true;
              }
              ws.close();
            } else if (parsed.type === 'error') {
              safeSendToRenderer(IPC.TelnetError, { ip, connectionId, error: parsed.error, isRemote: true });
            }
          } catch {
            const rt = remoteTelnetConnections.get(connectionId);
            if (rt) {
              rt.bytesReceived += Buffer.byteLength(chunkText, 'utf8');
              appendCoalescedText(rt, chunkText);
              scheduleCoalescedMapFlush(remoteTelnetConnections, connectionId, (live, slice) => {
                safeSendToRenderer(IPC.TelnetData, { ip: live.ip, connectionId, data: slice, isRemote: true });
              });
            }
          }
        });

        ws.on('error', (error: Error) => {
          mainLog('[Remote Telnet] WebSocket error:', error.message);
          wsCloseHadError = true;
          if (!resolved) { resolved = true; resolve({ success: false, error: error.message }); }
        });

        ws.on('close', () => {
          const rt = remoteTelnetConnections.get(connectionId);
          // Only the socket that currently owns this connection slot may tear
          // down holders and emit a disconnect. A socket that was replaced by
          // an intentional reconnect (its map entry was already deleted/reused)
          // must NOT wipe `remoteTelnetHoldersByConnId` — doing so dropped
          // other holders (e.g. a Fiddle window) on every explicit Connect.
          if (!rt || rt.ws !== ws) {
            mainLog('[Remote Telnet] WebSocket closed (superseded — ignoring)');
            return;
          }
          mainLog('[Remote Telnet] WebSocket closed');
          const aliveMs = Date.now() - rt.openedAtMs;
          const bytesReceived = rt.bytesReceived;
          const hadError = wsCloseHadError || !!rt.relayCloseHadError;
          flushCoalescedMapNow(remoteTelnetConnections, connectionId, (live, slice) => {
            safeSendToRenderer(IPC.TelnetData, { ip: live.ip, connectionId, data: slice, isRemote: true });
          });
          remoteTelnetConnections.delete(connectionId);
          remoteTelnetHoldersByConnId.delete(connectionId);
          safeSendToRenderer(IPC.TelnetDisconnected, {
            ip,
            connectionId,
            isRemote: true,
            hadError,
            aliveMs,
            bytesReceived
          });
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
 * Sideload a local .zip to a device via a remote RDS server. Trusted internal
 * caller (Sideload Relay fan-out) — unlike the {@link IPC.RemoteSideloadUpload}
 * handler this does NOT restrict the path to the user profile dirs, because the
 * relay's package lives in an OS temp dir it created itself.
 */
export async function sideloadFileToRemote(
  serverUrl: string,
  ip: string,
  filePath: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isSafeRelayUrl(serverUrl)) return { success: false, error: 'Invalid relay server URL' };
    if (!filePath || !fs.existsSync(filePath)) return { success: false, error: 'Package file not found' };
    const fileBuffer = await fs.promises.readFile(filePath);
    const form = new FormData();
    form.append('file', fileBuffer, { filename: path.basename(filePath), contentType: 'application/zip' });
    form.append('password', password || '');
    const urlObj = new URL(serverUrl);
    const isHttps = urlObj.protocol === 'https:';
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: devicePath(ip, '/sideload'),
      method: 'POST',
      headers: form.getHeaders(),
      timeout: 180000
    };
    return await new Promise<{ success: boolean; error?: string }>((resolve) => {
      const httpModule = isHttps ? require('https') : require('http');
      const req = httpModule.request(options, (res: IncomingMessage) => {
        let data = '';
        res.on('data', (c: Buffer | string) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as { success: boolean; error?: string });
          } catch {
            resolve({ success: false, error: 'Invalid response from remote server' });
          }
        });
      });
      req.setTimeout(180000);
      req.on('error', (e: Error) => resolve({ success: false, error: e.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Remote sideload timed out' });
      });
      form.pipe(req);
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Launch a channel on a device via a remote RDS server. */
export async function launchOnRemote(
  serverUrl: string,
  ip: string,
  appId = 'dev'
): Promise<{ success: boolean; error?: string }> {
  const r = (await remoteHttpRequest(serverUrl, devicePath(ip, `/launch/${encodeURIComponent(appId)}`), 'POST', {})) as {
    success?: boolean;
    error?: string;
  };
  return { success: r?.success !== false, error: r?.error };
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
    mainLog('Discovering devices on remote server:', serverUrl);
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

  // ============================================
  // Remote Network Inspector (proxy to server /network/* endpoints)
  // ============================================
  ipcMain.handle(IPC.RemoteNetworkStatus, async (_event: IpcMainInvokeEvent, { serverUrl }: ServerUrlPayload) => {
    return await remoteHttpRequest(serverUrl, '/network/status');
  });

  ipcMain.handle(IPC.RemoteNetworkGetConfig, async (_event: IpcMainInvokeEvent, { serverUrl }: ServerUrlPayload) => {
    return await remoteHttpRequest(serverUrl, '/network/config');
  });

  ipcMain.handle(
    IPC.RemoteNetworkSetConfig,
    async (
      _event: IpcMainInvokeEvent,
      { serverUrl, config }: ServerUrlPayload & { config: Record<string, unknown> }
    ) => {
      return await remoteHttpRequest(serverUrl, '/network/config', 'PUT', config || {});
    }
  );

  ipcMain.handle(
    IPC.RemoteNetworkEvents,
    async (
      _event: IpcMainInvokeEvent,
      { serverUrl, deviceIp, limit }: ServerUrlPayload & { deviceIp: string; limit?: number }
    ) => {
      const q = `deviceIp=${encodeURIComponent(deviceIp || '')}&limit=${encodeURIComponent(String(limit || 500))}`;
      return await remoteHttpRequest(serverUrl, `/network/events?${q}`);
    }
  );

  ipcMain.handle(
    IPC.RemoteNetworkEventDetail,
    async (_event: IpcMainInvokeEvent, { serverUrl, id }: ServerUrlPayload & { id: string }) => {
      return await remoteHttpRequest(serverUrl, `/network/event/${encodeURIComponent(id)}`);
    }
  );

  ipcMain.handle(
    IPC.RemoteNetworkClear,
    async (
      _event: IpcMainInvokeEvent,
      { serverUrl, deviceIps }: ServerUrlPayload & { deviceIps?: string[] }
    ) => {
      return await remoteHttpRequest(serverUrl, '/network/clear', 'POST', { deviceIps: deviceIps || [] });
    }
  );

  ipcMain.handle(IPC.RemoteNetworkSetupCapture, async (_event: IpcMainInvokeEvent, { serverUrl }: ServerUrlPayload) => {
    return await remoteHttpRequest(serverUrl, '/network/setup-capture', 'POST');
  });

  // Get device info from remote location
  ipcMain.handle(IPC.RemoteDeviceInfo, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/info'));
  });

  // Send key press via remote server. Encode path segments so Lit_ keys with
  // % (e.g. Lit_%40 for @) survive URL parsing — matches relay-client.ts.
  ipcMain.handle(IPC.RemoteKeypress, async (_event: IpcMainInvokeEvent, { serverUrl, ip, key }: RemoteKeypressPayload) => {
    return await remoteHttpRequest(
      serverUrl,
      `/device/${encodeURIComponent(ip)}/keypress/${encodeURIComponent(key)}`,
      'POST'
    );
  });

  // Launch app via remote server
  ipcMain.handle(IPC.RemoteLaunch, async (_event: IpcMainInvokeEvent, { serverUrl, ip, appId, params }: RemoteLaunchPayload) => {
    return await remoteHttpRequest(serverUrl, devicePath(ip, `/launch/${encodeURIComponent(appId)}`), 'POST', { params });
  });

  // Query device via remote server
  ipcMain.handle(IPC.RemoteQuery, async (_event: IpcMainInvokeEvent, { serverUrl, ip, endpoint }: RemoteEndpointPayload) => {
    return await remoteHttpRequest(serverUrl, devicePath(ip, endpoint));
  });

  // POST to device via remote server
  ipcMain.handle(IPC.RemotePost, async (_event: IpcMainInvokeEvent, { serverUrl, ip, endpoint }: RemoteEndpointPayload) => {
    return await remoteHttpRequest(serverUrl, devicePath(ip, `/post${endpoint}`), 'POST');
  });

  // Input text via remote server — scale HTTP timeout with string length so long
  // URLs/emails do not hit the default 15s client limit while the relay is still
  // sending Lit_ keypresses on the LAN.
  ipcMain.handle(IPC.RemoteInputText, async (_event: IpcMainInvokeEvent, { serverUrl, ip, text }: RemoteTextPayload) => {
    const timeoutMs = computeInputTextRelayHttpTimeoutMs(text);
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/input-text'), 'POST', { text }, timeoutMs);
  });

  // Deep link via remote server
  ipcMain.handle(IPC.RemoteDeeplink, async (_event: IpcMainInvokeEvent, payload: RemoteDeeplinkPayload) => {
    const { serverUrl, ip, appId, contentId, mediaType, params } = payload;
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/deeplink'), 'POST', { appId, contentId, mediaType, params });
  });

  // Get app icon via remote server
  ipcMain.handle(IPC.RemoteGetIcon, async (_event: IpcMainInvokeEvent, { serverUrl, ip, appId }: RemoteAppIdPayload) => {
    return await remoteHttpRequest(serverUrl, devicePath(ip, `/icon/${encodeURIComponent(appId)}`));
  });

  // Screenshot via remote server
  ipcMain.handle(IPC.RemoteScreenshot, async (_event: IpcMainInvokeEvent, payload: RemoteScreenshotPayload) => {
    const { serverUrl, ip, password, waitAfterTriggerMs } = payload;
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/screenshot'), 'POST', { password, waitAfterTriggerMs });
  });

  // Developer Digest auth check via remote server (no screenshot)
  ipcMain.handle(IPC.RemoteVerifyDevAuth, async (_event: IpcMainInvokeEvent, payload: RemoteVerifyDevAuthPayload) => {
    const { serverUrl, ip, password } = payload;
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/verify-dev-auth'), 'POST', { password });
  });

  // Sideload via remote server (file must be on remote server)
  ipcMain.handle(IPC.RemoteSideload, async (_event: IpcMainInvokeEvent, payload: RemoteSideloadPayload) => {
    const { serverUrl, ip, filePath, password } = payload;
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/sideload'), 'POST', { filePath, password });
  });

  // Sideload via remote server with file upload from local machine. filePath must be under allowed dirs.
  ipcMain.handle(IPC.RemoteSideloadUpload, async (_event: IpcMainInvokeEvent, payload: RemoteSideloadPayload) => {
    const { serverUrl, ip, filePath, password } = payload;
    // Renderer-supplied path: enforce the allowed-dirs sandbox here, then delegate
    // the actual multipart upload to the shared `sideloadFileToRemote` (the same
    // implementation the Sideload Relay fan-out uses — one code path, not two).
    if (!filePath || typeof filePath !== 'string') return { success: false, error: 'File path required' };
    if (!isSafeRelayUrl(serverUrl)) return { success: false, error: 'Invalid relay server URL' };
    const resolved = resolveUserPathUnderOneOf(userProfileDirectories(), filePath);
    if (!resolved) return { success: false, error: 'Path is not under an allowed directory' };
    return sideloadFileToRemote(serverUrl, ip, resolved, password || '');
  });

  // Delete sideload via remote server
  ipcMain.handle(IPC.RemoteDeleteSideload, async (_event: IpcMainInvokeEvent, payload: RemoteSideloadPayload) => {
    const { serverUrl, ip, password } = payload;
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/delete-sideload'), 'POST', { password });
  });

  // RALE wake via remote server
  ipcMain.handle(IPC.RemoteRaleWake, async (_event: IpcMainInvokeEvent, payload: RemoteRaleWakePayload) => {
    const { serverUrl, ip, port } = payload;
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/rale/wake'), 'POST', { port });
  });

  // RALE connect via remote server (longer timeout for socket operations)
  ipcMain.handle(IPC.RemoteRaleConnect, async (_event: IpcMainInvokeEvent, payload: RemoteRaleWakePayload) => {
    const { serverUrl, ip, port } = payload;
    // Use 20s timeout (longer than server's 10s socket timeout)
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/rale/connect'), 'POST', { port }, 20000);
  });

  // RALE command via remote server (longer timeout for socket operations)
  ipcMain.handle(IPC.RemoteRaleCommand, async (_event: IpcMainInvokeEvent, payload: RemoteRaleCommandPayload) => {
    const { serverUrl, connectionId, command, args } = payload;
    // Extract IP from connectionId (format: ip:port)
    const ip = connectionId.split(':')[0];
    // Use 45s timeout (longer than server's 30s socket timeout)
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/rale/command'), 'POST', { connectionId, command, args }, 45000);
  });

  // RALE disconnect via remote server
  ipcMain.handle(IPC.RemoteRaleDisconnect, async (_event: IpcMainInvokeEvent, payload: RemoteRaleDisconnectPayload) => {
    const { serverUrl, connectionId } = payload;
    const ip = connectionId.split(':')[0];
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/rale/disconnect'), 'POST', { connectionId });
  });

  // ============================================
  // Remote Telnet (via Relay Server)
  // ============================================

  // Connect to remote telnet via relay server. Delegates to the module-scoped
  // helper so Fiddle and the Console share one connection pool and wiring.
  // The IPC handler preserves the historical "force-reconnect" semantics: when
  // the user explicitly hits Connect we tear down any existing session and
  // dial a fresh one.
  ipcMain.handle(IPC.RemoteTelnetConnect, async (
    _event: IpcMainInvokeEvent,
    { serverUrl, ip, skipRelayBuffer }: RemoteDevicePayload & { skipRelayBuffer?: boolean }
  ) => {
    const connectionId = `${serverUrl}:${ip}`;
    const res = await establishRemoteTelnetConnection(serverUrl, ip, { skipRelayBuffer });
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

  ipcMain.handle(IPC.RemoteTelnetClearBuffer, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/telnet/clear-buffer'), 'POST');
  });

  // ============================================
  // Remote Telnet System Commands (Port 8080)
  // ============================================

  // Connect to remote telnet system (port 8080)
  ipcMain.handle(IPC.RemoteTelnetSystemConnect, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/telnet-system/connect'), 'POST');
  });

  // Disconnect from remote telnet system
  ipcMain.handle(IPC.RemoteTelnetSystemDisconnect, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/telnet-system/disconnect'), 'POST');
  });

  // Send command to remote telnet system
  ipcMain.handle(IPC.RemoteTelnetSystemSend, async (
    _event: IpcMainInvokeEvent,
    { serverUrl, ip, command }: RemoteDevicePayload & { command: string }
  ) => {
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/telnet-system/send'), 'POST', { command });
  });

  // Get remote telnet system status
  ipcMain.handle(IPC.RemoteTelnetSystemStatus, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/telnet-system/status'), 'GET');
  });

  // Poll data from remote telnet system
  ipcMain.handle(IPC.RemoteTelnetSystemPollData, async (_event: IpcMainInvokeEvent, { serverUrl, ip }: RemoteDevicePayload) => {
    return await remoteHttpRequest(serverUrl, devicePath(ip, '/telnet-system/data'), 'GET');
  });
}

export { setupRemoteHandlers };

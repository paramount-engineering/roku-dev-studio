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
import { isSafeRelayUrl, remoteHttpRequest, remoteHttpRequestBinary } from '../remote-http';
import { recordRemoteDeviceSeen } from '../remote-device-registry';
import { S } from '../../shared/strings/index';

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

/**
 * Reference-count `holder` strings (a device panel's tabId, a Fiddle window key, …) against a
 * resource key (a serverUrl, a `${serverUrl}:${ip}` connection id, …). `onEmpty` runs once the
 * last holder for a key releases it — the caller decides what "closing" the resource means.
 * Shared by every relay below (remote telnet, the remote Network Inspector stream, the remote
 * debugger stream) so this bookkeeping isn't hand-rolled three times over.
 */
function createHolderRefCount(onEmpty: (key: string) => void | Promise<void>) {
  const holdersByKey = new Map<string, Set<string>>();

  function add(key: string, holder: string): void {
    let set = holdersByKey.get(key);
    if (!set) {
      set = new Set();
      holdersByKey.set(key, set);
    }
    set.add(holder);
  }

  function remove(key: string, holder: string): void | Promise<void> {
    const set = holdersByKey.get(key);
    if (!set) return;
    set.delete(holder);
    if (set.size === 0) {
      holdersByKey.delete(key);
      return onEmpty(key);
    }
  }

  return { holdersByKey, add, remove };
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
/** Same lease model as `debugTelnetHoldersByIp` in telnet-handlers.ts (a separate map there —
 *  that one tracks the LOCAL debug telnet session, a different module/concern). `closeRemoteTelnetConnection`
 *  is a hoisted function declaration, so referencing it here (before its own definition further
 *  down this file) is safe. */
const remoteTelnetHolders = createHolderRefCount((connectionId) => closeRemoteTelnetConnection(connectionId));
/** Raw per-connectionId holder sets, for the two spots below that need to enumerate/inspect them
 *  directly rather than add/remove a single holder. */
const remoteTelnetHoldersByConnId = remoteTelnetHolders.holdersByKey;

function fiddleRemoteTelnetHolderKey(fiddleWindowId: number): string {
  return `fiddle:${fiddleWindowId}`;
}

// ============================================
// Remote live SSE relays — Network Inspector capture + BrightScript Debugger
// ============================================
//
// Both features run entirely server-side (capture is server-wide; the debug session has real
// network access only from the remote server), so both need the same thing here: one
// reference-counted SSE relay per remote server, forwarding frames onto the matching local push
// channel. `createSseRelay` below is that shared plumbing; the two features just supply their own
// path + event-channel map and get their own independent connection/holder state back.

/** Belt-and-suspenders bound above the debugger controller's own 20s post-sideload attach retry budget. */
const DEBUGGER_ATTACH_TIMEOUT_MS = 25000;

type SseRelayConn = {
  req: import('http').ClientRequest;
  serverUrl: string;
  /** Unconsumed bytes from the SSE response, held until a full `\n\n`-terminated record arrives. */
  buffer: string;
};

/**
 * Map Network Inspector's SSE frame `type`s to the local push channel the renderer already
 * listens on. `device-joined`/`device-left`/`device-discovered` are deliberately NOT included
 * yet: their renderer handlers (app.ts's `setupNetworkInspectorListeners`) unconditionally write
 * into hotspotSerialsActive/hotspotSerialIps — local-hotspot-only state — before deferring to
 * `applyNetworkTabForSerial`'s own `isRemote` skip, so relaying them today would pollute that
 * state with remote-origin entries even though the visible effect stays correctly scoped. Revisit
 * once those handlers are made origin-aware the same way onStatus/onCaptureEvents/onClientsCleared
 * are here.
 */
const NETWORK_STREAM_EVENT_CHANNEL: Record<string, string> = {
  status: IPC.NetworkInspectorStatus,
  events: IPC.NetworkInspectorCaptureEvents,
  'clients-cleared': IPC.NetworkInspectorClientsCleared
};

/** Maps a debugger SSE frame's `type` (DEBUGGER_EVENTS values) onto the same local push
 *  channel the renderer already listens on for a local session. */
const DEBUGGER_STREAM_EVENT_CHANNEL: Record<string, string> = {
  state: IPC.DebuggerState,
  stopped: IPC.DebuggerStopped,
  output: IPC.DebuggerOutput,
  'runtime-error': IPC.DebuggerRuntimeError,
  'compile-errors': IPC.DebuggerCompileErrors,
  breakpoints: IPC.DebuggerBreakpoints
};

/**
 * Extract every complete `\n\n`-terminated SSE record from `buffer`, returning the parsed
 * `{type, payload}` frames (malformed/comment-only records — e.g. the server's `: ping`
 * heartbeat — are skipped) plus whatever partial bytes remain for the next chunk.
 */
function drainSseRecords(buffer: string): { frames: Array<{ type: string; payload: unknown }>; rest: string } {
  const frames: Array<{ type: string; payload: unknown }> = [];
  let rest = buffer;
  let idx: number;
  while ((idx = rest.indexOf('\n\n')) !== -1) {
    const record = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    const dataLines = record.split('\n').filter((line) => line.startsWith('data:'));
    if (dataLines.length === 0) continue; // heartbeat (`: ping`) or other comment-only record
    try {
      const parsed = JSON.parse(dataLines.map((line) => line.slice(5).trimStart()).join('\n'));
      if (parsed && typeof parsed.type === 'string') frames.push(parsed);
    } catch {
      /* malformed frame — drop it, the next one still parses independently */
    }
  }
  return { frames, rest };
}

/**
 * Tag a parsed SSE frame's payload with `{ isRemote: true, serverUrl }` so the renderer's global
 * push fan-out can route it to the right panels instead of applying one server's event to every
 * open device/session. "events" (Network Inspector's batched capture frame) is the one frame type
 * that carries an ARRAY — spreading the tag onto the array itself would turn it into a
 * numeric-keyed object and break every consumer that expects a real array, so each element is
 * tagged instead; every other frame type's payload (including every debugger frame) is a plain
 * object and gets tagged directly.
 */
function tagSseFramePayload(payload: unknown, tag: { isRemote: true; serverUrl: string }): unknown {
  if (Array.isArray(payload)) {
    return payload.map((item) => (item && typeof item === 'object' ? { ...(item as Record<string, unknown>), ...tag } : item));
  }
  return payload && typeof payload === 'object' ? { ...(payload as Record<string, unknown>), ...tag } : { value: payload, ...tag };
}

/**
 * Build one reference-counted SSE relay to `{serverUrl}{path}`: `establish` opens the connection
 * (idempotent — a second call for an already-connected serverUrl is a no-op success) and forwards
 * every frame onto `eventChannelMap[frame.type]` (frames with no mapped channel are dropped),
 * tagged via {@link tagSseFramePayload}. Holder lease-tracking (the connection closes once every
 * holder — a device panel's tabId — has released it) reuses {@link createHolderRefCount}, the
 * same primitive `remoteTelnetHolders` above is built on. `connections`/`close` are exposed
 * directly too since the two IPC handler pairs below each have their own slightly different
 * holder-vs-no-holder semantics.
 */
function createSseRelay(path: string, eventChannelMap: Record<string, string>, logLabel: string) {
  const connections = new Map<string, SseRelayConn>();

  function close(serverUrl: string): void {
    const conn = connections.get(serverUrl);
    if (!conn) return;
    connections.delete(serverUrl);
    try {
      conn.req.destroy();
    } catch {
      /* best-effort */
    }
  }

  const holders = createHolderRefCount(close);

  function establish(serverUrl: string): { success: boolean; error?: string } {
    if (!isSafeRelayUrl(serverUrl)) return { success: false, error: 'Invalid relay server URL' };
    if (connections.has(serverUrl)) return { success: true };

    const safeSendToRenderer: SafeSendFn = (channel, payload) =>
      moduleSafeSendToRenderer ? moduleSafeSendToRenderer(channel, payload) : false;

    const url = new URL(path, serverUrl);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? require('https') : require('http');

    const req = httpModule.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'GET',
        headers: { Accept: 'text/event-stream' }
      },
      (res: IncomingMessage) => {
        if ((res.statusCode ?? 0) >= 400) {
          mainLog(`${logLabel} stream ${serverUrl} responded ${res.statusCode}`);
          req.destroy();
          return;
        }
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          const conn = connections.get(serverUrl);
          if (!conn) return; // holder released mid-flight; drop stray data
          const { frames, rest } = drainSseRecords(conn.buffer + chunk);
          conn.buffer = rest;
          for (const frame of frames) {
            const channel = eventChannelMap[frame.type];
            if (!channel) continue;
            safeSendToRenderer(channel, tagSseFramePayload(frame.payload, { isRemote: true, serverUrl }));
          }
        });
        res.on('end', () => {
          mainLog(`${logLabel} stream ${serverUrl} ended`);
          connections.delete(serverUrl);
        });
      }
    );
    req.on('error', (err: Error) => {
      mainLog(`${logLabel} stream ${serverUrl} error:`, errMsg(err));
      connections.delete(serverUrl);
    });
    req.end();

    connections.set(serverUrl, { req, serverUrl, buffer: '' });
    return { success: true };
  }

  return { connections, establish, addHolder: holders.add, removeHolder: holders.remove, close };
}

const networkStreamRelay = createSseRelay('/network/stream', NETWORK_STREAM_EVENT_CHANNEL, '[Remote Network Inspector]');
const debuggerStreamRelay = createSseRelay('/debugger/stream', DEBUGGER_STREAM_EVENT_CHANNEL, '[Remote Debugger]');

/** Translate the remote server's `{ success, data, error }` envelope to the `{ ok, data,
 *  error }` shape the renderer's debug sidebar already expects from the local IPC surface
 *  (mirrors debugger-handlers.ts's `guard()` wrapper). */
function toDebuggerOkEnvelope(r: { success?: boolean; data?: unknown; error?: string } | null): { ok: boolean; data?: unknown; error?: string } {
  if (r && r.success) return { ok: true, data: r.data };
  return { ok: false, error: (r && r.error) || 'Request failed.' };
}

function addRemoteTelnetHolder(connectionId: string, holder: string): void {
  remoteTelnetHolders.add(connectionId, holder);
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
  await remoteTelnetHolders.remove(connectionId, holder);
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
  password: string,
  remoteDebug = false
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isSafeRelayUrl(serverUrl)) return { success: false, error: 'Invalid relay server URL' };
    if (!filePath || !fs.existsSync(filePath)) return { success: false, error: 'Package file not found' };
    const fileBuffer = await fs.promises.readFile(filePath);
    const form = new FormData();
    form.append('file', fileBuffer, { filename: path.basename(filePath), contentType: 'application/zip' });
    form.append('password', password || '');
    // Tells the remote server's /sideload route to do a clean Delete+Install with
    // remotedebug=1 (opens the device's debug control port, 8081).
    if (remoteDebug) form.append('remotedebug', '1');
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
  const { ipcMain, dialog, BrowserWindow } = require('electron') as typeof import('electron');
  moduleMainWindow = mainWindow;
  moduleSafeSendToRenderer = safeSendToRenderer;

  // Discover devices on a remote location
  ipcMain.handle(IPC.RemoteDiscover, async (_event: IpcMainInvokeEvent, { serverUrl }: ServerUrlPayload) => {
    mainLog('Discovering devices on remote server:', serverUrl);
    const res = await remoteHttpRequest(serverUrl, '/devices');
    // Feed the remote device-IP registry so Sideload Relay fan-out can resolve a stale saved
    // target IP against what this location's device list actually reports right now.
    const devices = Array.isArray(res) ? res : Array.isArray(res?.devices) ? res.devices : [];
    for (const d of devices) {
      if (d && typeof d === 'object') recordRemoteDeviceSeen(d as Record<string, unknown>);
    }
    return res;
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

  // Live SSE relay (see createSseRelay/networkStreamRelay above). `holder` is the calling
  // device panel's tabId — required so the ref-count is per-panel, not collapsed onto a single
  // shared string the way `establishRemoteTelnetConnection`'s 'main-ui' key can be (that's safe
  // there because telnet connections are already keyed per-device; this one is keyed per-server).
  ipcMain.handle(
    IPC.RemoteNetworkStreamConnect,
    async (_event: IpcMainInvokeEvent, { serverUrl, holder }: ServerUrlPayload & { holder?: string }) => {
      const res = networkStreamRelay.establish(serverUrl);
      if (res.success) networkStreamRelay.addHolder(serverUrl, holder || 'main-ui');
      return res;
    }
  );

  ipcMain.handle(
    IPC.RemoteNetworkStreamDisconnect,
    async (_event: IpcMainInvokeEvent, { serverUrl, holder }: ServerUrlPayload & { holder?: string }) => {
      networkStreamRelay.removeHolder(serverUrl, holder || 'main-ui');
      return { success: true };
    }
  );

  ipcMain.handle(
    IPC.RemoteNetworkSetEventNote,
    async (_event: IpcMainInvokeEvent, { serverUrl, id, note }: ServerUrlPayload & { id: string; note: string }) => {
      return await remoteHttpRequest(serverUrl, `/network/event/${encodeURIComponent(id)}/note`, 'POST', { note });
    }
  );

  ipcMain.handle(IPC.RemoteNetworkGetTrafficRules, async (_event: IpcMainInvokeEvent, { serverUrl }: ServerUrlPayload) => {
    return await remoteHttpRequest(serverUrl, '/network/traffic-rules');
  });

  ipcMain.handle(
    IPC.RemoteNetworkSetDeviceTrafficRules,
    async (
      _event: IpcMainInvokeEvent,
      { serverUrl, deviceIp, rules }: ServerUrlPayload & { deviceIp: string; rules?: unknown }
    ) => {
      return await remoteHttpRequest(serverUrl, `/network/device/${encodeURIComponent(deviceIp)}/traffic-rules`, 'PUT', { rules });
    }
  );

  ipcMain.handle(
    IPC.RemoteNetworkReplayRequest,
    async (
      _event: IpcMainInvokeEvent,
      payload: ServerUrlPayload & { deviceIp?: string; input: unknown; applyTrafficRules?: boolean; timeoutMs?: number }
    ) => {
      const { serverUrl, ...body } = payload;
      // Replay can run a full round-trip against a slow/unreachable upstream host, so give the
      // relay hop more room than the default 15s (mirrors the client-side ceiling in
      // roku-dev-studio-network-inspector/input-sanitize's MAX_REPLAY_TIMEOUT_MS).
      return await remoteHttpRequest(serverUrl, '/network/replay', 'POST', body, 65000);
    }
  );

  ipcMain.handle(
    IPC.RemoteNetworkFind,
    async (_event: IpcMainInvokeEvent, { serverUrl, deviceIp, options }: ServerUrlPayload & { deviceIp: string; options: unknown }) => {
      return await remoteHttpRequest(serverUrl, '/network/find', 'POST', { deviceIp, options });
    }
  );

  ipcMain.handle(
    IPC.RemoteNetworkSetRecording,
    async (_event: IpcMainInvokeEvent, { serverUrl, deviceIps, recording }: ServerUrlPayload & { deviceIps: string[]; recording: boolean }) => {
      return await remoteHttpRequest(serverUrl, '/network/recording', 'POST', { deviceIps, recording });
    }
  );

  ipcMain.handle(IPC.RemoteNetworkGetCaInfo, async (_event: IpcMainInvokeEvent, { serverUrl }: ServerUrlPayload) => {
    return await remoteHttpRequest(serverUrl, '/network/ca/info');
  });

  // The three exports below all follow the same shape: fetch the bytes from the remote server,
  // then show the SAME native save dialog the local export uses — parented to whichever window
  // actually invoked it (the device panel's main window, or the Settings window's per-location CA
  // card), falling back to the main window, exactly like the local NetworkInspectorExportCa* handlers.
  ipcMain.handle(
    IPC.RemoteNetworkExportPcap,
    async (event: IpcMainInvokeEvent, { serverUrl, deviceIps }: ServerUrlPayload & { deviceIps?: string[] }) => {
      const senderWin = BrowserWindow.fromWebContents(event.sender);
      const win = (senderWin && !senderWin.isDestroyed())
        ? senderWin
        : (moduleMainWindow && !moduleMainWindow.isDestroyed() ? moduleMainWindow : undefined);
      const primaryIp = deviceIps?.find((ip) => !ip.endsWith('.1'));
      const namePart = primaryIp ? primaryIp.replace(/\./g, '-') : 'hotspot';
      const pcapOpts = {
        title: S.networkInspector.exportDialogTitles.savePcap,
        defaultPath: `network-inspector-${namePart}-${Date.now()}.pcap`,
        filters: [{ name: S.networkInspector.exportDialogTitles.pcapFilter, extensions: ['pcap'] }]
      };
      const dialogResult = await (win ? dialog.showSaveDialog(win, pcapOpts) : dialog.showSaveDialog(pcapOpts));
      if (dialogResult.canceled || !dialogResult.filePath) return { success: false, error: 'cancelled' };
      const query = deviceIps?.length ? `?deviceIps=${encodeURIComponent(deviceIps.join(','))}` : '';
      const res = await remoteHttpRequestBinary(serverUrl, `/network/export-pcap${query}`, 60000);
      if (!res.success || !res.buffer) return { success: false, error: res.error || 'Export failed' };
      try {
        fs.writeFileSync(dialogResult.filePath, res.buffer);
        const packetsWritten = Number(res.headers?.['x-packets-written']) || 0;
        return { success: true, packetsWritten, filePath: dialogResult.filePath };
      } catch (e) {
        return { success: false, error: errMsg(e) };
      }
    }
  );

  ipcMain.handle(IPC.RemoteNetworkExportCaPem, async (event: IpcMainInvokeEvent, { serverUrl }: ServerUrlPayload) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    const win = (senderWin && !senderWin.isDestroyed())
      ? senderWin
      : (moduleMainWindow && !moduleMainWindow.isDestroyed() ? moduleMainWindow : undefined);
    const pemOpts = {
      title: S.networkInspector.exportDialogTitles.caPem,
      defaultPath: 'rds-network-inspector-ca.pem',
      filters: [{ name: S.networkInspector.exportDialogTitles.pemFilter, extensions: ['pem'] }]
    };
    const dialogResult = await (win ? dialog.showSaveDialog(win, pemOpts) : dialog.showSaveDialog(pemOpts));
    if (dialogResult.canceled || !dialogResult.filePath) return { success: false, error: 'cancelled' };
    const res = await remoteHttpRequestBinary(serverUrl, '/network/ca/pem');
    if (!res.success || !res.buffer) return { success: false, error: res.error || 'Export failed' };
    try {
      fs.writeFileSync(dialogResult.filePath, res.buffer);
      return { success: true };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle(IPC.RemoteNetworkExportCaCert, async (event: IpcMainInvokeEvent, { serverUrl }: ServerUrlPayload) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    const win = (senderWin && !senderWin.isDestroyed())
      ? senderWin
      : (moduleMainWindow && !moduleMainWindow.isDestroyed() ? moduleMainWindow : undefined);
    const crtOpts = {
      title: S.networkInspector.exportDialogTitles.caCrt,
      defaultPath: 'rds-network-inspector-ca.crt',
      filters: [{ name: S.networkInspector.exportDialogTitles.certFilter, extensions: ['crt', 'cer'] }]
    };
    const dialogResult = await (win ? dialog.showSaveDialog(win, crtOpts) : dialog.showSaveDialog(crtOpts));
    if (dialogResult.canceled || !dialogResult.filePath) return { success: false, error: 'cancelled' };
    const res = await remoteHttpRequestBinary(serverUrl, '/network/ca/cert');
    if (!res.success || !res.buffer) return { success: false, error: res.error || 'Export failed' };
    try {
      fs.writeFileSync(dialogResult.filePath, res.buffer);
      return { success: true };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
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
    const { serverUrl, ip, filePath, password, remoteDebug, serial } = payload;
    // Renderer-supplied path: enforce the allowed-dirs sandbox here, then delegate
    // the actual multipart upload to the shared `sideloadFileToRemote` (the same
    // implementation the Sideload Relay fan-out uses — one code path, not two).
    if (!filePath || typeof filePath !== 'string') return { success: false, error: 'File path required' };
    if (!isSafeRelayUrl(serverUrl)) return { success: false, error: 'Invalid relay server URL' };
    const resolved = resolveUserPathUnderOneOf(userProfileDirectories(), filePath);
    if (!resolved) return { success: false, error: 'Path is not under an allowed directory' };
    // Same "should this be a debug launch?" computation the local sideload handler uses
    // (checkbox OR persisted OR discovered STOP breakpoints) — the .zip is on THIS
    // machine's disk either way, so the scan/settings logic never needs a remote copy.
    const { debugEnabled, discovered } = (require('./dev-app-handlers') as {
      computeSideloadDebugFlags: (ip: string, serial: string | undefined, filePath: string, remoteDebug: boolean | undefined) => { debugEnabled: boolean; discovered: number };
    }).computeSideloadDebugFlags(ip, serial, resolved, remoteDebug);
    mainLog(`[remote sideload] server=${serverUrl} ip=${ip} debugEnabled=${debugEnabled} discovered=${discovered}`);
    const result = await sideloadFileToRemote(serverUrl, ip, resolved, password || '', debugEnabled);
    if (debugEnabled && result && result.success !== false) {
      try {
        (require('roku-dev-studio-api/lib/debugger/scan-stops') as {
          rememberSideloadZip: (ip: string, p: string) => void;
        }).rememberSideloadZip(ip, resolved);
        (require('./debugger-handlers') as {
          notifyDebuggerReattach: (ip: string, extra?: { discovered?: number; isRemote?: boolean; serverUrl?: string }) => void;
        }).notifyDebuggerReattach(ip, { discovered, isRemote: true, serverUrl });
      } catch {
        /* best-effort */
      }
    }
    return result;
  });

  // Restart the debug session on a remote-managed device: re-upload the last debug
  // .zip we remembered for this device (clean Delete+Install so remotedebug=1 is
  // honored), then reattach. Mirrors the local IPC.DebuggerRestart handler.
  ipcMain.handle(IPC.RemoteDebuggerRestart, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string; password?: string }) => {
    const { serverUrl, ip, password } = payload;
    if (!isSafeRelayUrl(serverUrl)) return { success: false, error: 'Invalid relay server URL' };
    const scan = require('roku-dev-studio-api/lib/debugger/scan-stops') as {
      getRememberedZip: (ip: string) => string | undefined;
      rememberSideloadZip: (ip: string, p: string) => void;
    };
    const zip = scan.getRememberedZip(ip);
    if (!zip) return { success: false, error: 'No previous debug sideload to restart. Sideload with Debugging first.' };
    if (!fs.existsSync(zip)) return { success: false, error: 'The previous debug build is no longer on disk. Sideload again.' };
    mainLog(`[remote sideload] restart server=${serverUrl} ip=${ip} remotedebug=1`);
    const result = await sideloadFileToRemote(serverUrl, ip, zip, password || '', true);
    if (result && result.success !== false) {
      try {
        scan.rememberSideloadZip(ip, zip);
        (require('./debugger-handlers') as {
          notifyDebuggerReattach: (ip: string, extra?: { isRemote?: boolean; serverUrl?: string }) => void;
        }).notifyDebuggerReattach(ip, { isRemote: true, serverUrl });
      } catch {
        /* best-effort */
      }
    }
    return result;
  });

  // BrightScript Debugger (control port 8081) via remote server. The session runs
  // ON the remote server (real network access to the device); these just proxy
  // each request over HTTP and translate its { success } envelope to the { ok }
  // shape the renderer's debug sidebar already expects from the local IPC surface.
  ipcMain.handle(IPC.RemoteDebuggerAttach, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string }) => {
    const { serverUrl, ip } = payload;
    const r = await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/attach'), 'POST', {}, DEBUGGER_ATTACH_TIMEOUT_MS);
    return r && r.success ? { ok: true } : { ok: false, error: (r && r.error) || 'Attach failed.' };
  });
  ipcMain.handle(IPC.RemoteDebuggerDetach, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string }) => {
    const { serverUrl, ip } = payload;
    return toDebuggerOkEnvelope(await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/detach'), 'POST', {}));
  });
  ipcMain.handle(IPC.RemoteDebuggerStatus, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string }) => {
    const { serverUrl, ip } = payload;
    return toDebuggerOkEnvelope(await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/status'), 'GET'));
  });
  ipcMain.handle(IPC.RemoteDebuggerContinue, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string }) => {
    const { serverUrl, ip } = payload;
    return toDebuggerOkEnvelope(await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/continue'), 'POST', {}));
  });
  ipcMain.handle(IPC.RemoteDebuggerPause, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string }) => {
    const { serverUrl, ip } = payload;
    return toDebuggerOkEnvelope(await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/pause'), 'POST', {}));
  });
  ipcMain.handle(IPC.RemoteDebuggerStepOver, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string; threadIndex?: number }) => {
    const { serverUrl, ip, threadIndex } = payload;
    return toDebuggerOkEnvelope(await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/step-over'), 'POST', { threadIndex }));
  });
  ipcMain.handle(IPC.RemoteDebuggerStepIn, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string; threadIndex?: number }) => {
    const { serverUrl, ip, threadIndex } = payload;
    return toDebuggerOkEnvelope(await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/step-in'), 'POST', { threadIndex }));
  });
  ipcMain.handle(IPC.RemoteDebuggerStepOut, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string; threadIndex?: number }) => {
    const { serverUrl, ip, threadIndex } = payload;
    return toDebuggerOkEnvelope(await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/step-out'), 'POST', { threadIndex }));
  });
  ipcMain.handle(IPC.RemoteDebuggerStackTrace, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string; threadIndex?: number }) => {
    const { serverUrl, ip, threadIndex } = payload;
    return toDebuggerOkEnvelope(await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/stack-trace'), 'POST', { threadIndex }));
  });
  ipcMain.handle(IPC.RemoteDebuggerVariables, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string; threadIndex?: number; stackFrameIndex?: number; variablePath?: string[] }) => {
    const { serverUrl, ip, threadIndex, stackFrameIndex, variablePath } = payload;
    return toDebuggerOkEnvelope(await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/variables'), 'POST', { threadIndex, stackFrameIndex, variablePath }));
  });
  ipcMain.handle(IPC.RemoteDebuggerAddBreakpoints, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string; breakpoints?: unknown }) => {
    const { serverUrl, ip, breakpoints } = payload;
    return toDebuggerOkEnvelope(await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/add-breakpoints'), 'POST', { breakpoints }));
  });
  ipcMain.handle(IPC.RemoteDebuggerRemoveBreakpointsByLocation, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string; locations?: Array<{ filePath: string; lineNumber: number }> }) => {
    const { serverUrl, ip, locations } = payload;
    return toDebuggerOkEnvelope(await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/remove-breakpoints-by-location'), 'POST', { locations }));
  });
  ipcMain.handle(IPC.RemoteDebuggerExecute, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; ip: string; sourceCode: string; threadIndex?: number; stackFrameIndex?: number }) => {
    const { serverUrl, ip, sourceCode, threadIndex, stackFrameIndex } = payload;
    return toDebuggerOkEnvelope(await remoteHttpRequest(serverUrl, devicePath(ip, '/debugger/execute'), 'POST', { sourceCode, threadIndex, stackFrameIndex }));
  });

  // Live debugger event stream (server-wide — one relay per server, like the Network
  // Inspector stream above). Reference-counted per tabId so multiple device panels
  // against the same server share one relay.
  ipcMain.handle(IPC.RemoteDebuggerStreamConnect, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; holder?: string }) => {
    const { serverUrl, holder } = payload;
    const existing = debuggerStreamRelay.connections.has(serverUrl);
    if (existing) {
      if (holder) debuggerStreamRelay.addHolder(serverUrl, holder);
      return { success: true };
    }
    const res = debuggerStreamRelay.establish(serverUrl);
    if (res.success && holder) debuggerStreamRelay.addHolder(serverUrl, holder);
    return res;
  });
  ipcMain.handle(IPC.RemoteDebuggerStreamDisconnect, async (_event: IpcMainInvokeEvent, payload: { serverUrl: string; holder?: string }) => {
    const { serverUrl, holder } = payload;
    if (holder) debuggerStreamRelay.removeHolder(serverUrl, holder);
    else debuggerStreamRelay.close(serverUrl);
    return { success: true };
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

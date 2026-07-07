// Telnet to Roku (debug 8085, system 8080) — TCP from roku-dev-studio-api

import type { Socket } from 'net';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type { IpCommandPayload, IpPayload, SafeSendFn } from '../../shared/ipc/payloads';
import { IPC } from '../../shared/ipc/channels';
import {
  appendCoalescedText,
  createTelnetIpcCoalesceState,
  flushCoalescedMapNow,
  scheduleCoalescedMapFlush,
  type TelnetIpcCoalesceState
} from './telnet-log-ipc-coalesce.js';
import { getPersistedTimingValue } from '../settings';
import { mainLog, mainWarn } from '../log.js';

const {
  connectRokuDebugTelnet,
  connectRokuSystemTelnet,
  writeRokuTelnetLine,
  isValidIp
} = require('roku-dev-studio-api');

type DebugTelnetConn = {
  socket: Socket;
  isRemote: boolean;
  /** Batched text before IPC to renderer */
  ipcCoalesce: TelnetIpcCoalesceState;
  /** monotonic ms when the socket actually opened — for diagnostic close logs */
  openedAtMs: number;
  /** total bytes received on this socket — for diagnostic close logs */
  bytesReceived: number;
};

type SystemTelnetConn = { socket: Socket; ipcCoalesce: TelnetIpcCoalesceState };

/** Process-wide telnet connection maps. Exposed so other main-process modules
 * (e.g. BrightScript Fiddle) can reuse the same pool and avoid fighting over
 * Roku's single-client 8085 socket. */
const telnetConnections = new Map<string, DebugTelnetConn>();
const telnetSystemConnections = new Map<string, SystemTelnetConn>();

/** Logical holders per device IP. The TCP socket stays open while any holder
 * remains; releasing the last holder closes 8085. Fiddle registers
 * `fiddle:<windowId>`; the main Console / MCP path registers `main-ui`. */
const debugTelnetHoldersByIp = new Map<string, Set<string>>();

function fiddleDebugTelnetHolderKey(fiddleWindowId: number): string {
  return `fiddle:${fiddleWindowId}`;
}

/**
 * Raw 8085 console-data subscribers per device IP. Lets other main-process
 * modules (the Sideload Relay) tap a device's live console output — e.g. to
 * relay a target's real compile errors/logs to the IDE's relay console.
 */
const telnetDataSubscribers = new Map<string, Set<(text: string) => void>>();

/** Subscribe to a device's raw 8085 console text. Returns an unsubscribe fn. */
export function subscribeDebugTelnetData(ip: string, cb: (text: string) => void): () => void {
  let set = telnetDataSubscribers.get(ip);
  if (!set) {
    set = new Set();
    telnetDataSubscribers.set(ip, set);
  }
  set.add(cb);
  return () => {
    const s = telnetDataSubscribers.get(ip);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) telnetDataSubscribers.delete(ip);
  };
}

function notifyTelnetDataSubscribers(ip: string, text: string): void {
  const set = telnetDataSubscribers.get(ip);
  if (!set) return;
  for (const cb of set) {
    try {
      cb(text);
    } catch {
      /* subscriber best-effort */
    }
  }
}

function addDebugTelnetHolder(ip: string, holder: string): void {
  let set = debugTelnetHoldersByIp.get(ip);
  if (!set) {
    set = new Set();
    debugTelnetHoldersByIp.set(ip, set);
  }
  set.add(holder);
}

async function removeDebugTelnetHolder(ip: string, holder: string): Promise<void> {
  const set = debugTelnetHoldersByIp.get(ip);
  if (!set) return;
  set.delete(holder);
  if (set.size === 0) {
    debugTelnetHoldersByIp.delete(ip);
    await disconnectDebugTelnetInternal(ip);
  }
}

/** Drop every Fiddle lease when its window closes so 8085 is free for VS Code
 * and other tools unless the main Console still holds `main-ui`. */
export async function releaseAllDebugTelnetHoldersForFiddleWindow(
  fiddleWindowId: number
): Promise<void> {
  const key = fiddleDebugTelnetHolderKey(fiddleWindowId);
  const ips = [...debugTelnetHoldersByIp.entries()]
    .filter(([, holders]) => holders.has(key))
    .map(([ip]) => ip);
  await Promise.all(ips.map((ip) => removeDebugTelnetHolder(ip, key)));
}

/** Close 8085 when the socket is open but no logical holder remains (e.g.
 * Fiddle connected before holder tracking, or a leaked process-wide socket). */
export async function disconnectDebugTelnetIfUnheld(ip: string): Promise<void> {
  const holders = debugTelnetHoldersByIp.get(ip);
  if (holders && holders.size > 0) return;
  if (!telnetConnections.has(ip)) return;
  debugTelnetHoldersByIp.delete(ip);
  await disconnectDebugTelnetInternal(ip);
}

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
    mainWarn('[Telnet] connect failed for', ip, ':8085 →', conn.error);
    return { success: false, error: conn.error };
  }

  const socket: Socket = conn.socket;
  telnetConnections.set(connectionId, {
    socket,
    isRemote: false,
    ipcCoalesce: createTelnetIpcCoalesceState(),
    openedAtMs: Date.now(),
    bytesReceived: 0
  });
  mainLog('[Telnet] connected to', ip, ':8085 (readyState=' + (socket as unknown as { readyState?: string }).readyState + ')');
  if (safeSend) safeSend(IPC.TelnetConnected, { ip, connectionId });

  socket.on('data', (data: Buffer) => {
    const text = data.toString('utf8');
    const connection = telnetConnections.get(connectionId);
    if (!connection) return;
    connection.bytesReceived += data.length;
    notifyTelnetDataSubscribers(ip, text);
    appendCoalescedText(connection, text);
    scheduleCoalescedMapFlush(telnetConnections, connectionId, (_live, slice) => {
      if (safeSend) safeSend(IPC.TelnetData, { ip, connectionId, data: slice });
    });
  });

  socket.on('error', (error: Error) => {
    mainWarn('[Telnet] socket error for', ip, ':8085 →', error.message);
    if (safeSend) {
      safeSend(IPC.TelnetError, { ip, connectionId, error: error.message });
    }
  });

  socket.on('close', (hadError: boolean) => {
    // Diagnostic detail for the "connected but no logs are received" class
    // of bug. `bytesReceived === 0` + a short lifetime is the signature of
    // either (a) another telnet client holds Roku's BrightScript stdout
    // binding (Roku 8085 is single-client and the rebind is racy — see
    // bs-fiddle-handlers.ts comments around the post-sideload bounce),
    // or (b) the channel exited / crashed immediately after we attached.
    // The renderer surfaces this to the user; the log line here is for
    // the support log bundle.
    const conn = telnetConnections.get(connectionId);
    const aliveMs = conn ? Date.now() - conn.openedAtMs : -1;
    const bytes = conn ? conn.bytesReceived : -1;
    mainLog('[Telnet] socket close for', ip, ':8085',
      '(hadError=' + hadError + ', aliveMs=' + aliveMs + ', bytesReceived=' + bytes + ')');
    flushCoalescedMapNow(telnetConnections, connectionId, (_live, slice) => {
      if (safeSend) safeSend(IPC.TelnetData, { ip, connectionId, data: slice });
    });
    telnetConnections.delete(connectionId);
    debugTelnetHoldersByIp.delete(connectionId);
    if (safeSend) {
      safeSend(IPC.TelnetDisconnected, {
        ip,
        connectionId,
        hadError,
        aliveMs,
        bytesReceived: bytes
      });
    }
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
  mainLog('[Telnet] bounceDebugTelnet: disconnect + reconnect', ip);
  // Snapshot logical holders before the bounce. Destroying the socket fires the
  // `close` handler, which wipes `debugTelnetHoldersByIp` for this IP; without
  // restoring them the socket would re-open with zero holders, breaking the
  // lease invariant (a leaked socket nothing will ever close, or one that
  // `disconnectDebugTelnetIfUnheld` tears down out from under Fiddle).
  const preservedHolders = new Set(debugTelnetHoldersByIp.get(ip) ?? []);
  await disconnectDebugTelnetInternal(ip);
  const result = await connectDebugTelnetInternal(ip);
  if (result.success) {
    for (const holder of preservedHolders) addDebugTelnetHolder(ip, holder);
  }
  return { success: result.success, error: result.error };
}

/**
 * Ensure the shared 8085 telnet socket is open for this IP WITHOUT bouncing a
 * healthy connection. Validates the socket is actually in `'open'` readyState
 * — `!destroyed` alone isn't enough because a stale map entry can carry a
 * half-open/zombie socket that passes the laxer check but never receives data.
 */
export async function ensureDebugTelnetConnected(
  ip: string,
  options?: { holder?: string }
): Promise<{ success: boolean; error?: string }> {
  const existing = telnetConnections.get(ip);
  const socket = existing?.socket as (Socket & { readyState?: string }) | undefined;
  const isHealthy = !!(existing && socket && !socket.destroyed && socket.readyState === 'open');
  if (isHealthy) {
    mainLog('[Telnet] ensureDebugTelnetConnected: reusing healthy socket for', ip);
    if (options?.holder) addDebugTelnetHolder(ip, options.holder);
    return { success: true };
  }
  // Stale or missing — wipe it and open fresh.
  if (existing) {
    mainLog('[Telnet] ensureDebugTelnetConnected: stale entry for', ip,
      '(destroyed=' + (socket?.destroyed ?? '?') + ', readyState=' + (socket?.readyState ?? '?') + ') — reconnecting');
    try { socket?.destroy(); } catch { /* ignore */ }
    telnetConnections.delete(ip);
  } else {
    mainLog('[Telnet] ensureDebugTelnetConnected: no existing socket for', ip, '— opening fresh');
  }
  const result = await connectDebugTelnetInternal(ip);
  if (result.success && options?.holder) addDebugTelnetHolder(ip, options.holder);
  return { success: result.success, error: result.error };
}

/**
 * Setup telnet IPC handlers
 */
function setupTelnetHandlers(_mainWindow: BrowserWindow | undefined, safeSendToRenderer: SafeSendFn) {
  const { ipcMain } = require('electron');
  cachedSafeSend = safeSendToRenderer;

  ipcMain.handle(IPC.TelnetConnect, async (_event: IpcMainInvokeEvent, { ip }: IpPayload) => {
    if (!isValidIp(ip)) return { success: false, error: 'Invalid IP address' };
    // Idempotent: reuse a healthy 8085 socket rather than destroy+reopen.
    // The Roku 8085 BrightScript log stream binds to a single client and the
    // rebind on a destroy/reopen cycle is racy — repeated connects (e.g. an
    // Action Script auto-connect colliding with a manual click, or an MCP
    // agent retrying) used to bounce the socket each time and could leave
    // the user "connected" with no log stream attached. `ensureDebugTelnetConnected`
    // checks `readyState === 'open'` + `!destroyed` before reopening.
    // The internal `bounceDebugTelnet` (still exported for `bs-fiddle-handlers.ts`'s
    // post-sideload rebind) remains the explicit destructive path; it is
    // intentionally not exposed via IPC because the actual cause of
    // "connected but no logs" in the field is almost always Roku-side
    // (another telnet client holds the binding, channel exited, etc.) and
    // a renderer-driven reconnect doesn't help — the disconnect-cause
    // diagnostics on the close handler do.
    const result = await ensureDebugTelnetConnected(ip, { holder: 'main-ui' });
    if (result.success) mainLog('[Telnet] TelnetConnect OK for', ip, ':8085 (idempotent)');
    return result;
  });

  ipcMain.handle(IPC.TelnetDisconnect, async (_event: IpcMainInvokeEvent, { ip }: IpPayload) => {
    await removeDebugTelnetHolder(ip, 'main-ui');
    return { success: true };
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
    if (!isValidIp(ip)) return { success: false, error: 'Invalid IP address' };
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
    mainLog('[Telnet System] Connected to', ip, ':8080');

    telnetSystemConnections.set(connectionId, {
      socket,
      ipcCoalesce: createTelnetIpcCoalesceState()
    });

    socket.on('data', (data: Buffer) => {
      const text = data.toString('utf8');
      const sysConn = telnetSystemConnections.get(connectionId);
      if (!sysConn) return;
      appendCoalescedText(sysConn, text);
      scheduleCoalescedMapFlush(telnetSystemConnections, connectionId, (_live, slice) => {
        safeSendToRenderer(IPC.TelnetSystemData, {
          ip,
          connectionId,
          data: slice
        });
      });
    });

    socket.on('error', (error: Error) => {
      mainLog('[Telnet System] Socket error:', error.message);
    });

    socket.on('close', (hadError: boolean) => {
      mainLog('[Telnet System] Socket closed, hadError:', hadError);
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

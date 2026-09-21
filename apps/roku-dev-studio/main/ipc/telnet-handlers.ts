// Telnet to Roku (debug 8085, system consoles 8080/8087) — TCP from roku-dev-studio-api

import type { Socket } from 'net';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type { IpCommandPayload, IpPayload, SafeSendFn } from '../../shared/ipc/payloads';
import { IPC } from '../../shared/ipc/channels';
import type { DebugTelnetConnectResult } from '../../shared/ipc/debug-telnet-connection-id';
import { singleFlight } from 'roku-dev-studio-platform/async-patterns';
import {
  appendCoalescedText,
  createTelnetIpcCoalesceState,
  emitTelnetTextInChunks,
  flushCoalescedMapNow,
  scheduleCoalescedMapFlush,
  type TelnetIpcCoalesceState
} from './telnet-log-ipc-coalesce.js';
import { getPersistedTimingValue } from '../settings';
import { mainLog, mainWarn } from '../log.js';
import { notifyDeviceConnectionSuspect } from '../device-connection-suspect';
import { broadcastToPortTerminals } from '../port-terminal-broadcast';
import { createHeldPool, type SystemTelnetConnectResult, type SystemTelnetHolder } from './held-console-pool';
export type { SystemTelnetConnectResult, SystemTelnetHolder } from './held-console-pool';

const {
  connectRokuDebugTelnet,
  connectRokuTcp,
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

type SystemTelnetConn = {
  socket: Socket;
  ipcCoalesce: TelnetIpcCoalesceState;
  ip: string;
  port: number;
  /** The Ports window owns this socket: one-shot consumers reuse it and their disconnect is a
   *  no-op until the window releases it (see `disconnectSystemTelnet`). */
  heldByWindow: boolean;
};

export const SYSTEM_TELNET_DEFAULT_PORT = 8080;
/** Roku text consoles this pool will dial: 8080 (SceneGraph / "system") and 8087 (Screensaver).
 *  8085 is the Console tab's own pool above; 8081 is the binary debug protocol, not a telnet port. */
export const SYSTEM_TELNET_PORTS: ReadonlyArray<number> = [8080, 8087];
export type SystemTelnetPayload = IpPayload & { port?: number };

/** `undefined` → 8080; anything outside {@link SYSTEM_TELNET_PORTS} → null (reject, don't dial).
 *  Local and relay consoles are limited to these two; only the RCE tunnel accepts more (rce-handlers). */
export function normalizeSystemTelnetPort(port: unknown): number | null {
  const p = port === undefined || port === null ? SYSTEM_TELNET_DEFAULT_PORT : port;
  return typeof p === 'number' && SYSTEM_TELNET_PORTS.includes(p) ? p : null;
}

/** Ports that already have a dedicated surface and are single-client on the device: 8085 is the
 *  Console tab, 8081/8082 are the debugger's control and I/O channels (the 8081 tab). A raw console
 *  on any of them would fight that surface for the one slot. */
export const RESERVED_CONSOLE_PORTS: ReadonlyArray<number> = [8081, 8082, 8085];

export function systemTelnetConnectionId(ip: string, port: number): string {
  return `${ip}:${port}`;
}

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

/** ip -> when its 8085 socket was (re)connected. Roku's debug console — like the Sideload Relay's own
 *  faithful emulation of it, see the "replayed to clients that connect mid-run" gap buffer in
 *  `sideload-relay/debug-endpoints.ts` — flushes a burst of recent console history to a freshly-opened
 *  socket. Those bytes arrive via the same `socket.on('data', …)` event as genuinely new output, so a
 *  one-shot marker matched right after a (re)connect may be stale history, not a live event. */
const debugTelnetConnectedAt = new Map<string, number>();
/** Compare against `CONSOLE_REPLAY_WINDOW_MS` (shared/console/roku-beacons.ts) to tell that backlog from
 *  a live event. Real device backlog arrives in one immediate burst on connect, not trickled in over
 *  seconds — confirmed against a real capture where a stale match landed 22ms after reconnect and the
 *  genuine one landed 6.8s later. Used by the Sideload Relay's launch-complete watcher
 *  (sideload-relay/service.ts). The "Waiting for debugger" auto-attach does NOT live here: the Console
 *  panel watches its own line stream for every transport (local / lab server / RCE) and tries the
 *  attach quietly instead of guessing at staleness — see telnet-console-panel.ts. */
export function msSinceDebugTelnetConnected(ip: string): number {
  const t = debugTelnetConnectedAt.get(ip);
  return t == null ? Infinity : Date.now() - t;
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

/** ip -> the connect currently in flight for it. The map entry only lands after the TCP await,
 *  so two concurrent connects for one device (the Sideload Relay fan-out's console step racing
 *  the debug sidebar's auto-connect, an MCP `telnet_connect` racing a click, …) used to both
 *  dial. Roku's 8085 is single-client: it rejected the loser ("Console connection is already in
 *  use.") and the loser's `close` wiped the winner's bookkeeping, orphaning a live socket that
 *  held the port — every later connect was rejected — until the app quit. */
const debugTelnetConnecting = new Map<string, Promise<DebugTelnetConnectResult>>();

/**
 * Open (or re-open) the local 8085 debug telnet socket for `ip`. If a
 * connection already exists it is destroyed and replaced. Renderer stays in
 * sync via the usual `IPC.TelnetConnected` / `TelnetData` events. Single-flight
 * per ip: a caller arriving while a connect is in flight joins that attempt.
 */
function connectDebugTelnetInternal(ip: string): Promise<DebugTelnetConnectResult> {
  return singleFlight(debugTelnetConnecting, ip, () => openDebugTelnet(ip));
}

async function openDebugTelnet(ip: string): Promise<DebugTelnetConnectResult> {
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
  debugTelnetConnectedAt.set(ip, Date.now());

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
    // This handler only exists on a socket that already connected (registered post-`await
    // connectRokuDebugTelnet`), and a plain `.destroy()` (every intentional teardown in this
    // file) never emits 'error' — only 'close' does. So this is never a user-initiated
    // disconnect misfiring; it's always a hint worth an immediate reachability re-check.
    notifyDeviceConnectionSuspect(ip);
  });

  socket.on('close', (hadError: boolean) => {
    const live = telnetConnections.get(connectionId);
    if (live && live.socket !== socket) {
      // A newer socket already replaced this one; the map entry, holders and the renderer's
      // connected state belong to it — this close must not tear them down.
      mainLog('[Telnet] ignoring close of superseded socket for', ip, ':8085');
      return;
    }
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

/**
 * Swap the 8085 socket for `ip` under the same connectionId — TRANSPARENT to every consumer:
 * holders are kept, the renderer sees no TelnetDisconnected/Connected flip (so the Console panel
 * keeps its scrollback and keeps ingesting; a visible flip used to make it re-adopt via Connect,
 * clearing the view and dropping the backlog Roku flushes to a fresh socket). Only a FAILED
 * re-dial is surfaced as a disconnect, since then there really is no socket any more.
 * Used after a sideload: on some firmware `plugin_install` unbinds whichever 8085 client was
 * connected beforehand (see bs-fiddle-handlers.ts), so a pre-opened console must be re-dialed
 * for the new channel's output to land on it.
 */
export async function bounceDebugTelnet(ip: string, opts?: { onlyIfOpen?: boolean }): Promise<{ success: boolean; error?: string }> {
  const safeSend = cachedSafeSend;
  const old = telnetConnections.get(ip);
  if (!old && opts?.onlyIfOpen) return { success: true }; // nothing bound to rebind
  mainLog('[Telnet] bounceDebugTelnet: disconnect + reconnect', ip);
  if (old) {
    flushCoalescedMapNow(telnetConnections, ip, (_live, slice) => {
      if (safeSend) safeSend(IPC.TelnetData, { ip, connectionId: ip, data: slice });
    });
    // Terminate a mid-line tail so the renderer's line assembler can't glue it onto the fresh
    // socket's first chunk (an empty segment renders nothing, so this is invisible at a boundary).
    if (safeSend) safeSend(IPC.TelnetData, { ip, connectionId: ip, data: '\n' });
    // Detach the old socket's 'close' bookkeeping — this is a replacement, not a teardown.
    old.socket.removeAllListeners('close');
    telnetConnections.delete(ip);
    old.socket.destroy();
  }
  const result = await connectDebugTelnetInternal(ip);
  if (!result.success && old) {
    // There WAS a socket and now there isn't — that is a disconnect. (A failed dial with nothing
    // open before is just a failed connect: the panel was never connected, don't flip it.)
    debugTelnetHoldersByIp.delete(ip);
    if (safeSend) safeSend(IPC.TelnetDisconnected, { ip, connectionId: ip, hadError: true, aliveMs: -1, bytesReceived: -1 });
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

// ── Telnet system console pool (8080 / 8087) ──────────────────────────────────────────────────
// Ownership rules (reuse / window hold / single-flight / held no-op disconnect) live in
// held-console-pool.ts; this file owns the TCP socket, its coalesced IPC pushes and the flushes.

const systemPool = createHeldPool<SystemTelnetConn>(telnetSystemConnections);

function emitSystemTelnetData(conn: SystemTelnetConn, connectionId: string, slice: string): void {
  const payload = { ip: conn.ip, port: conn.port, connectionId, data: slice };
  cachedSafeSend?.(IPC.TelnetSystemData, payload);
  broadcastToPortTerminals(IPC.TelnetSystemData, payload);
}

function emitSystemTelnetDisconnected(ip: string, port: number, connectionId: string, hadError: boolean): void {
  const payload = { ip, port, connectionId, hadError };
  cachedSafeSend?.(IPC.TelnetSystemDisconnected, payload);
  broadcastToPortTerminals(IPC.TelnetSystemDisconnected, payload);
}

/** Push whatever is still coalesced for `conn` — works on an entry the pool already dropped. */
function flushSystemTelnetEntry(conn: SystemTelnetConn, connectionId: string): void {
  const blob = conn.ipcCoalesce.pending;
  conn.ipcCoalesce.pending = '';
  conn.ipcCoalesce.flushScheduled = false;
  emitTelnetTextInChunks(blob, (slice) => emitSystemTelnetData(conn, connectionId, slice));
}

function systemSocketOpen(conn: SystemTelnetConn): boolean {
  const sock = conn.socket as Socket & { readyState?: string };
  return !sock.destroyed && sock.readyState === 'open';
}

/**
 * Open — or reuse — the `ip:port` text console (see held-console-pool.ts for the reuse / window-hold
 * contract). A stale entry is flushed, destroyed and replaced.
 */
export function connectSystemTelnet(ip: string, port: number, holder?: SystemTelnetHolder): Promise<SystemTelnetConnectResult> {
  const connectionId = systemTelnetConnectionId(ip, port);
  return systemPool.connect(connectionId, holder, {
    healthy: systemSocketOpen,
    discardStale: (stale) => {
      flushSystemTelnetEntry(stale, connectionId);
      try { stale.socket.destroy(); } catch { /* ignore */ }
    },
    dial: async () => {
      const conn = await connectRokuTcp(ip, port, { connectTimeoutMs: getPersistedTimingValue('TELNET_TIMEOUT') });
      if (!conn.success) return { success: false, error: conn.error };

      const socket: Socket = conn.socket;
      mainLog('[Telnet System] Connected to', connectionId);
      const entry: SystemTelnetConn = { socket, ipcCoalesce: createTelnetIpcCoalesceState(), ip, port, heldByWindow: false };

      socket.on('data', (data: Buffer) => {
        if (telnetSystemConnections.get(connectionId) !== entry) return;
        appendCoalescedText(entry, data.toString('utf8'));
        scheduleCoalescedMapFlush(telnetSystemConnections, connectionId, (live, slice) => emitSystemTelnetData(live, connectionId, slice));
      });
      socket.on('error', (error: Error) => {
        mainLog('[Telnet System] Socket error:', connectionId, error.message);
        // Only attached post-connect, and a bare `.destroy()` never emits 'error' — always an
        // involuntary drop (same reasoning as the 8085 handler above).
        notifyDeviceConnectionSuspect(ip);
      });
      socket.on('close', (hadError: boolean) => {
        // Identity guard: a replacement socket may already own this id (see the 8085 pool's note on
        // a lost race orphaning a live socket) — only the current entry gets to tear down.
        if (telnetSystemConnections.get(connectionId) !== entry) return;
        mainLog('[Telnet System] Socket closed:', connectionId, 'hadError:', hadError);
        flushSystemTelnetEntry(entry, connectionId);
        telnetSystemConnections.delete(connectionId);
        emitSystemTelnetDisconnected(ip, port, connectionId, hadError);
      });
      return { success: true, entry };
    }
  });
}

/** Close `ip:port` — a successful no-op (`held: true`) while the Ports window holds it and the
 *  caller isn't the window. */
export function disconnectSystemTelnet(ip: string, port: number, holder?: SystemTelnetHolder): Promise<{ success: true; held?: boolean }> {
  const connectionId = systemTelnetConnectionId(ip, port);
  return systemPool.disconnect(connectionId, holder, (conn) => {
    flushSystemTelnetEntry(conn, connectionId);
    try { conn.socket.destroy(); } catch { /* ignore */ }
    // The 'close' handler sees a foreign/missing entry and stays silent, so announce it here.
    emitSystemTelnetDisconnected(ip, port, connectionId, false);
  });
}

export function sendSystemTelnet(ip: string, port: number, command: string): { success: true } | { success: false; error: string } {
  const conn = telnetSystemConnections.get(systemTelnetConnectionId(ip, port));
  if (!conn || !conn.socket || conn.socket.destroyed) return { success: false, error: 'Not connected' };
  // Roku's text consoles take a bare `\n`, not telnet's `\r\n`.
  return writeRokuTelnetLine(conn.socket, command, { lineEnding: '\n' });
}

export function systemTelnetStatus(ip: string, port: number): { connected: boolean; connectionId: string; heldByWindow: boolean } {
  const connectionId = systemTelnetConnectionId(ip, port);
  const conn = telnetSystemConnections.get(connectionId);
  const connected = !!(conn && conn.socket && !conn.socket.destroyed);
  return { connected, connectionId, heldByWindow: !!conn?.heldByWindow };
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

  // Telnet system consoles (8080 SceneGraph / 8087 Screensaver). These are the one-shot consumer
  // entry points (Query tab, Action Scripts, Toggle FPS): connect reuses a socket the Ports window
  // already holds, and disconnect is a no-op while it does. The window itself never comes through
  // IPC here — `port-terminal-window.ts` calls the exported functions with `holder: 'window'`.
  ipcMain.handle(IPC.TelnetSystemConnect, async (_event: IpcMainInvokeEvent, { ip, port }: SystemTelnetPayload) => {
    if (!isValidIp(ip)) return { success: false, error: 'Invalid IP address' };
    const p = normalizeSystemTelnetPort(port);
    if (p === null) return { success: false, error: 'Unsupported port' };
    return connectSystemTelnet(ip, p);
  });

  ipcMain.handle(IPC.TelnetSystemDisconnect, async (_event: IpcMainInvokeEvent, { ip, port }: SystemTelnetPayload) => {
    const p = normalizeSystemTelnetPort(port);
    if (p === null) return { success: false, error: 'Unsupported port' };
    return disconnectSystemTelnet(ip, p);
  });

  ipcMain.handle(IPC.TelnetSystemSend, async (_event: IpcMainInvokeEvent, { ip, port, command }: SystemTelnetPayload & { command: string }) => {
    const p = normalizeSystemTelnetPort(port);
    if (p === null) return { success: false, error: 'Unsupported port' };
    return sendSystemTelnet(ip, p, command);
  });

  ipcMain.handle(IPC.TelnetSystemStatus, async (_event: IpcMainInvokeEvent, { ip, port }: SystemTelnetPayload) => {
    const p = normalizeSystemTelnetPort(port) ?? SYSTEM_TELNET_DEFAULT_PORT;
    return systemTelnetStatus(ip, p);
  });
}

export { setupTelnetHandlers };

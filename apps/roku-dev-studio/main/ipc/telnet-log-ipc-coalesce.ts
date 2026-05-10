/**
 * Coalesce high-frequency telnet `data` into fewer IPC messages, then chunk very large
 * strings so the renderer never receives a single multi‑MB string (reduces jank / OOM risk).
 */

export const TELNET_IPC_CHUNK_CHARS = 256 * 1024;

export type TelnetIpcCoalesceState = {
  pending: string;
  flushScheduled: boolean;
};

export function createTelnetIpcCoalesceState(): TelnetIpcCoalesceState {
  return { pending: '', flushScheduled: false };
}

export function emitTelnetTextInChunks(data: string, emitSlice: (slice: string) => void): void {
  if (!data) return;
  for (let i = 0; i < data.length; i += TELNET_IPC_CHUNK_CHARS) {
    emitSlice(data.slice(i, i + TELNET_IPC_CHUNK_CHARS));
  }
}

/** Anything carrying {@link TelnetIpcCoalesceState} for map-based telnet IPC (debug, remote relay, system). */
export type TelnetIpcCoalesceHost = { ipcCoalesce: TelnetIpcCoalesceState };

/**
 * One `setImmediate` tick: drain pending text into chunked IPC, then reschedule if more arrived.
 */
export function scheduleCoalescedMapFlush<T extends TelnetIpcCoalesceHost>(
  map: Map<string, T>,
  connectionId: string,
  emitSlice: (live: T, slice: string) => void
): void {
  const conn = map.get(connectionId);
  if (!conn || conn.ipcCoalesce.flushScheduled) return;
  conn.ipcCoalesce.flushScheduled = true;
  setImmediate(() => {
    const live = map.get(connectionId);
    if (!live) return;
    live.ipcCoalesce.flushScheduled = false;
    const blob = live.ipcCoalesce.pending;
    live.ipcCoalesce.pending = '';
    emitTelnetTextInChunks(blob, (slice) => emitSlice(live, slice));
    if (live.ipcCoalesce.pending.length > 0) {
      scheduleCoalescedMapFlush(map, connectionId, emitSlice);
    }
  });
}

/** Synchronously emit all pending coalesced text (e.g. disconnect / reconnect). */
export function flushCoalescedMapNow<T extends TelnetIpcCoalesceHost>(
  map: Map<string, T>,
  connectionId: string,
  emitSlice: (live: T, slice: string) => void
): void {
  const live = map.get(connectionId);
  if (!live) return;
  const blob = live.ipcCoalesce.pending;
  live.ipcCoalesce.pending = '';
  live.ipcCoalesce.flushScheduled = false;
  emitTelnetTextInChunks(blob, (slice) => emitSlice(live, slice));
}

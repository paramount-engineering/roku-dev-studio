/**
 * The "window-holds-socket" console pool, shared by the three text-console transports (local TCP in
 * telnet-handlers, relay HTTP + poll in remote-handlers, RCE WebSocket in rce-handlers). Owns the
 * ownership rules so they exist once:
 *
 *  - connect: a healthy entry is reused (`reused: true` — no banner will follow); `holder: 'window'`
 *    marks it owned by the Ports window in either order (window first, or adopting a one-shot
 *    consumer's live socket). Dials are single-flight per key so a window open racing a Query click
 *    dials once — and a window that JOINED an in-flight dial still gets its hold applied.
 *  - disconnect: while the window holds the entry and the caller isn't the window, a successful
 *    no-op (`held: true`); otherwise the entry leaves the map synchronously (so a connect that lands
 *    during an async teardown never gets deleted by it) and `teardown` runs.
 *
 * Transport specifics (socket listeners, poll timers, coalescing, disconnect pushes) stay with each
 * caller — they are what differ.
 */
import { singleFlight } from 'roku-dev-studio-platform/async-patterns';

export type SystemTelnetHolder = 'window' | undefined;
export type SystemTelnetConnectResult =
  | { success: true; connectionId: string; reused: boolean }
  | { success: false; error: string };

export interface HeldEntry {
  heldByWindow: boolean;
}

export interface HeldPoolConnectOps<T extends HeldEntry> {
  /** Reuse `entry` as-is? (open socket / poller not stopped) */
  healthy: (entry: T) => boolean;
  /** Tear down an unhealthy leftover about to be replaced (still in the map while this runs). */
  discardStale?: (entry: T) => void;
  /** Open the transport and return its entry with listeners attached. `heldByWindow` is set by the pool. */
  dial: () => Promise<{ success: true; entry: T } | { success: false; error: string }>;
  /** The id reported to callers — defaults to the pool key (remote pools key by server too). */
  connectionId?: string;
}

export interface HeldPool<T extends HeldEntry> {
  readonly entries: Map<string, T>;
  connect(key: string, holder: SystemTelnetHolder, ops: HeldPoolConnectOps<T>): Promise<SystemTelnetConnectResult>;
  disconnect(key: string, holder: SystemTelnetHolder, teardown: (entry: T) => void | Promise<void>): Promise<{ success: true; held?: boolean }>;
}

export function createHeldPool<T extends HeldEntry>(entries: Map<string, T> = new Map()): HeldPool<T> {
  const connecting = new Map<string, Promise<SystemTelnetConnectResult>>();

  async function connect(key: string, holder: SystemTelnetHolder, ops: HeldPoolConnectOps<T>): Promise<SystemTelnetConnectResult> {
    const connectionId = ops.connectionId ?? key;
    const existing = entries.get(key);
    if (existing && ops.healthy(existing)) {
      if (holder === 'window') existing.heldByWindow = true;
      return { success: true, connectionId, reused: true };
    }
    const result = await singleFlight(connecting, key, async (): Promise<SystemTelnetConnectResult> => {
      const stale = entries.get(key);
      if (stale) {
        try { ops.discardStale?.(stale); } catch { /* best-effort */ }
        entries.delete(key);
      }
      const r = await ops.dial();
      if (!r.success) return r;
      r.entry.heldByWindow = false;
      entries.set(key, r.entry);
      return { success: true, connectionId, reused: false };
    });
    // Applied after the shared dial so a window that joined someone else's in-flight connect owns
    // the result too (otherwise that consumer's disconnect would close the socket under the window).
    if (result.success && holder === 'window') {
      const live = entries.get(key);
      if (live) live.heldByWindow = true;
    }
    return result;
  }

  async function disconnect(key: string, holder: SystemTelnetHolder, teardown: (entry: T) => void | Promise<void>): Promise<{ success: true; held?: boolean }> {
    const conn = entries.get(key);
    if (!conn) return { success: true };
    if (conn.heldByWindow && holder !== 'window') return { success: true, held: true };
    entries.delete(key);
    await teardown(conn);
    return { success: true };
  }

  return { entries, connect, disconnect };
}

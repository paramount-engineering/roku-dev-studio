/**
 * A tiny in-memory `Storage`-compatible shim, used as the DEFAULT backing store for the find bars'
 * search history and the centered-search width (in place of `sessionStorage`).
 *
 * Why not sessionStorage: in Electron on a `file://` origin, the FIRST access to the Web Storage
 * subsystem synchronously initializes the storage partition, and here that stall is ~4 SECONDS. That
 * first touch used to land on the first find bar built during a device connect
 * (createDevicePanel → setupQueries → createFindBar → attachSearchHistory), freezing the whole
 * renderer — no hover, queued clicks — for ~4s on the first connect. (localStorage is already warmed
 * at startup by settings, so only sessionStorage was cold, and the find bar was the first to touch
 * it.) An in-memory Map has identical practical semantics here — history/width are per-window and
 * needn't survive a restart or an (essentially never-happening) window reload — with zero
 * storage-subsystem cost, so the find bar builds instantly.
 *
 * Callers that genuinely want cross-restart persistence pass `localStorage` explicitly; that path is
 * unchanged.
 */
const mem = new Map<string, string>();

export const inMemorySessionStore: Storage = {
  get length(): number {
    return mem.size;
  },
  clear(): void {
    mem.clear();
  },
  getItem(key: string): string | null {
    return mem.has(key) ? mem.get(key)! : null;
  },
  key(index: number): string | null {
    return Array.from(mem.keys())[index] ?? null;
  },
  removeItem(key: string): void {
    mem.delete(key);
  },
  setItem(key: string, value: string): void {
    mem.set(key, String(value));
  }
};

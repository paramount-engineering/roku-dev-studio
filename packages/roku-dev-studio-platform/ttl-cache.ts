/**
 * Generic time-to-live cache. Entries expire `ttlMs` after they're written. To bound memory without
 * a background timer, expired entries are swept lazily on write once the map reaches `pruneThreshold`,
 * and the whole cache is cleared if it's still over `maxSize` after a sweep (a coarse but cheap cap).
 *
 * `now` is injectable on every time-sensitive method so callers can test deterministically; it
 * defaults to `Date.now()` (fine in runtime app code).
 */

export interface TtlCacheOptions {
  /** Entry lifetime in milliseconds. */
  ttlMs: number;
  /** Begin sweeping expired entries on write once the cache reaches this size. Omit to never sweep. */
  pruneThreshold?: number;
  /** After a sweep, if the cache is still larger than this, clear it entirely. Omit for no hard cap. */
  maxSize?: number;
}

export class TtlCache<K, V> {
  private readonly store = new Map<K, { at: number; value: V }>();
  private readonly ttlMs: number;
  private readonly pruneThreshold: number;
  private readonly maxSize: number;

  constructor(options: TtlCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.pruneThreshold = options.pruneThreshold ?? Infinity;
    this.maxSize = options.maxSize ?? Infinity;
  }

  /** The fresh value for `key`, or `undefined` if absent or expired (expired entries are evicted). */
  get(key: K, now: number = Date.now()): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (now - hit.at > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  /** True if a fresh (non-expired) entry exists for `key`. */
  has(key: K, now: number = Date.now()): boolean {
    return this.get(key, now) !== undefined;
  }

  /** Store `value` under `key`, stamping it at `now`. Sweeps/caps the cache first. */
  set(key: K, value: V, now: number = Date.now()): void {
    this.prune(now);
    this.store.set(key, { at: now, value });
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  /** Evict expired entries (only once at/over `pruneThreshold`); clear all if still over `maxSize`. */
  prune(now: number = Date.now()): void {
    if (this.store.size < this.pruneThreshold) return;
    for (const [k, v] of this.store) {
      if (now - v.at > this.ttlMs) this.store.delete(k);
    }
    if (this.store.size > this.maxSize) this.store.clear();
  }
}

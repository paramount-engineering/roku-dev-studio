/**
 * Shared data spine for a Network Inspector surface — the events + derived sessions + filter +
 * selection that both the live tab and the offline Session Viewer need. It unifies the two data
 * sources behind one model:
 *
 *   - Live capture: many small batches arrive over time → {@link SessionStore.ingest} (dedup +
 *     in-place status updates + optional cap) → subscribers repaint the delta.
 *   - Saved file:   one batch arrives at load       → {@link SessionStore.setAll} → paint once.
 *
 * "File load" is just the single-batch case of a stream. The store owns the memoized
 * `buildSessions`/`filterSessions` caching (version-gated) so both surfaces get identical, cheap
 * derived data without reimplementing it.
 */
import type { ParsedNetworkEvent } from '@shared/network-inspector/types';
import { buildSessions, filterSessions, type NetworkSession } from './network-sessions.js';

export class SessionStore {
  private events: ParsedNetworkEvent[] = [];
  private byId = new Map<string, ParsedNetworkEvent>();
  /** Bumps on every change; gates the derived-session caches and drives subscriber repaints. */
  private version = 0;
  private query = '';
  private selectedId: string | null = null;
  private readonly listeners = new Set<() => void>();
  private sessionCache = new Map<boolean, { version: number; result: NetworkSession[] }>();
  private filteredCache:
    | { version: number; decryptedOnly: boolean; query: string; result: NetworkSession[] }
    | null = null;

  get size(): number {
    return this.events.length;
  }
  get all(): ParsedNetworkEvent[] {
    return this.events;
  }
  get changeVersion(): number {
    return this.version;
  }

  /** Subscribe to any change (ingest/setAll/markDirty/clear). Returns an unsubscribe fn. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    this.version++;
    this.sessionCache.clear();
    this.filteredCache = null;
    for (const fn of this.listeners) fn();
  }

  /** Replace all events (whole-file load). Clears a selection that's no longer present. */
  setAll(events: ParsedNetworkEvent[]): void {
    this.events = events.slice();
    this.byId = new Map(events.map((e) => [e.id, e]));
    if (this.selectedId && !this.byId.has(this.selectedId)) this.selectedId = null;
    this.emit();
  }

  /**
   * Merge a live batch: new events append; events already held are updated in place (status/body
   * fills as a transaction completes). `cap` trims the oldest events to bound memory on long
   * captures. Returns true if anything changed.
   */
  ingest(batch: ParsedNetworkEvent[], cap = Infinity): boolean {
    let changed = false;
    for (const ev of batch) {
      const existing = this.byId.get(ev.id);
      if (existing) {
        Object.assign(existing, ev);
        changed = true;
      } else {
        this.events.push(ev);
        this.byId.set(ev.id, ev);
        changed = true;
      }
    }
    if (Number.isFinite(cap) && this.events.length > cap) {
      const drop = this.events.length - cap;
      for (let i = 0; i < drop; i++) this.byId.delete(this.events[i].id);
      this.events.splice(0, drop);
      if (this.selectedId && !this.byId.has(this.selectedId)) this.selectedId = null;
    }
    if (changed) this.emit();
    return changed;
  }

  /** Force a repaint/cache rebuild after held events were mutated by reference (e.g. an in-place
   *  status update applied outside {@link ingest}). */
  markDirty(): void {
    this.emit();
  }

  clear(): void {
    this.events = [];
    this.byId.clear();
    this.selectedId = null;
    this.emit();
  }

  getById(id: string): ParsedNetworkEvent | undefined {
    return this.byId.get(id);
  }

  setQuery(q: string): void {
    if (q === this.query) return;
    this.query = q;
    this.filteredCache = null;
  }
  getQuery(): string {
    return this.query;
  }

  select(id: string | null): void {
    this.selectedId = id;
  }
  getSelectedId(): string | null {
    return this.selectedId;
  }
  getSelectedEvent(): ParsedNetworkEvent | null {
    return this.selectedId ? this.byId.get(this.selectedId) ?? null : null;
  }

  /** Memoized `buildSessions` for the given decrypted-only mode (rebuilt only when events change). */
  sessions(decryptedOnly = false): NetworkSession[] {
    const cached = this.sessionCache.get(decryptedOnly);
    if (cached && cached.version === this.version) return cached.result;
    const result = buildSessions(this.events, { decryptedOnly });
    this.sessionCache.set(decryptedOnly, { version: this.version, result });
    return result;
  }

  /** Memoized filtered sessions — `buildSessions` + the current filter query. */
  filteredSessions(decryptedOnly = false): NetworkSession[] {
    if (
      this.filteredCache &&
      this.filteredCache.version === this.version &&
      this.filteredCache.decryptedOnly === decryptedOnly &&
      this.filteredCache.query === this.query
    ) {
      return this.filteredCache.result;
    }
    const result = filterSessions(this.sessions(decryptedOnly), this.query);
    this.filteredCache = { version: this.version, decryptedOnly, query: this.query, result };
    return result;
  }
}

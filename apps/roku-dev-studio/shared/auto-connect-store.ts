/**
 * Auto Connect "remembered devices" — ONE in-memory source of truth for the persisted list, with
 * single-flight persistence and the session-only "dismissed" set.
 *
 * Why this exists: the list used to be mutated by independent read-modify-write cycles against the
 * settings store (add on connect, remove on tab close), and the auto-connect passes read it while
 * those writes were in flight. Closing a tab mid-scan therefore (1) left the device in the cached
 * list until the async removal landed, so the next SSDP reply reconnected it, and (2) that reconnect's
 * own add interleaved with the removal and resurrected the entry — the device came back on the next
 * launch too. Here every mutation applies to the in-memory list synchronously and the writes queue
 * behind one promise chain, so a caller's intent is visible to the very next pass and writes land in
 * call order.
 *
 * `dismiss()` is the other half: the user closed this connection's tab, so auto-connect must not
 * reopen it for the rest of the session even if a stale entry still matches. A user-initiated
 * connect calls `undismiss()`. Keyed by the *connection* key (`ip` for local devices,
 * `${locationId}:${ip}` for remote/RCE) — the same key `state.connectedDevices` uses.
 *
 * Pinned by `npm run verify:auto-connect-store`.
 */

export interface RememberedStoreIo<T> {
  /** Read the persisted list (called at most once per cache lifetime). */
  load: () => Promise<T[]>;
  /** Write the whole list. Called in mutation order, never concurrently. */
  persist: (list: T[]) => Promise<unknown>;
  onError?: (error: unknown) => void;
}

export class RememberedDeviceStore<T> {
  private cache: T[] | undefined;
  private loading: Promise<T[]> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private readonly dismissed = new Set<string>();

  constructor(
    private readonly keyOf: (entry: T) => string,
    private readonly io: RememberedStoreIo<T>
  ) {}

  /** The list, loading it on first use. Later calls return the live in-memory copy. */
  list(): Promise<T[]> {
    if (this.cache !== undefined) return Promise.resolve(this.cache);
    if (!this.loading) {
      this.loading = this.io
        .load()
        .then(
          (loaded) => (this.cache = loaded),
          (error) => {
            this.io.onError?.(error);
            return (this.cache = []);
          }
        )
        .finally(() => {
          this.loading = null;
        });
    }
    return this.loading;
  }

  /** The in-memory list if loaded — synchronous, for callers that must not await. */
  peek(): T[] | undefined {
    return this.cache;
  }

  /** Forget the cached copy (the settings store changed underneath us); the next `list()` reloads. */
  reset(): void {
    this.cache = undefined;
  }

  /** Add unless an entry with the same key is already present. */
  add(entry: T): void {
    const key = this.keyOf(entry);
    this.mutate((list) => (list.some((e) => this.keyOf(e) === key) ? list : [...list, entry]));
  }

  remove(key: string): void {
    this.mutate((list) => list.filter((e) => this.keyOf(e) !== key));
  }

  dismiss(connectionKey: string): void {
    this.dismissed.add(connectionKey);
  }

  undismiss(connectionKey: string): void {
    this.dismissed.delete(connectionKey);
  }

  isDismissed(connectionKey: string): boolean {
    return this.dismissed.has(connectionKey);
  }

  /** Resolves once every write queued so far has landed. */
  flush(): Promise<void> {
    return this.queue;
  }

  /**
   * Apply `fn` to the in-memory list right away when it is loaded (so the next auto-connect pass
   * sees the result), then persist that snapshot behind the write queue. Before the first load the
   * whole step queues, so it still runs after the load and in call order.
   */
  private mutate(fn: (list: T[]) => T[]): void {
    if (this.cache !== undefined) {
      this.cache = fn(this.cache.slice());
      const snapshot = this.cache;
      this.enqueue(() => this.io.persist(snapshot));
      return;
    }
    this.enqueue(async () => {
      const current = await this.list();
      this.cache = fn(current.slice());
      await this.io.persist(this.cache);
    });
  }

  private enqueue(job: () => Promise<unknown>): void {
    this.queue = this.queue.then(job).then(
      () => undefined,
      (error) => this.io.onError?.(error)
    );
  }
}

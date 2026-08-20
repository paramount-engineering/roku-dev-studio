/**
 * Generic browser `Worker` pool — task in, result out, over a fixed set of persistent threads.
 * Browser-only (DOM `Worker` / `navigator.hardwareConcurrency`), same interface shape as the Node
 * pool in `roku-dev-studio-platform/worker-pool` but not shimmed through `shared/` the way the
 * logger is — that shim exists to bridge a cross-package CJS dependency into the per-file-transpiled
 * renderer bundle, and there's no cross-package boundary to bridge here; this is a normal renderer
 * module.
 *
 * Not a work-stealing or priority scheduler: a plain FIFO queue over a fixed pool. A consumer that
 * needs strict per-connection ordering (e.g. telnet console parsing, where a chunk's continuation
 * must land on the same worker as the chunk before it) should not share tasks across a fungible pool
 * at all — create a dedicated `poolSize: 1` instance per connection instead. See
 * `.discussion-docs/worker-pool-threading-design.md` for the full writeup.
 */

/** Leave 2 cores free once there are 4+ to spare; below that, use everything available. No env
 *  override on this side — the renderer can't read `process.env` without dedicated IPC wiring, and
 *  nothing here needs one (the one identified consumer passes an explicit `poolSize` per connection). */
function defaultPoolSize(): number {
  const cores = navigator.hardwareConcurrency || 4;
  return cores < 4 ? cores : Math.max(cores - 2, 4);
}

export interface BrowserWorkerPoolOptions {
  /** Worker script URL, e.g. `new URL('./telnet-parse.worker.js', import.meta.url)`. */
  workerUrl: string | URL;
  /** Thread count. Default: cores-aware (see module doc). */
  poolSize?: number;
  /** Reject `run()` immediately once queued + in-flight would exceed this. Default: no limit. */
  maxQueueSize?: number;
  /** Reject a task and recycle its worker if it doesn't resolve within this many ms. Default: no timeout. */
  taskTimeoutMs?: number;
}

export interface WorkerPool<TIn = unknown, TOut = unknown> {
  /** Submit one task; resolves/rejects with the worker's result. `transferList` moves ownership
   *  (e.g. an ArrayBuffer) instead of copying it. */
  run(input: TIn, transferList?: readonly Transferable[]): Promise<TOut>;
  /** Thread count — stays constant; a crashed worker is replaced, not just removed. */
  readonly size: number;
  /** Queued + in-flight task count. */
  readonly pending: number;
  /** Reject everything still queued/in-flight and terminate every worker. */
  destroy(): void;
}

type TaskMessage<TIn> = { id: number; input: TIn };
type ResultMessage<TOut> =
  | { id: number; ok: true; output: TOut }
  | { id: number; ok: false; error: string };

interface PendingTask<TIn, TOut> {
  input: TIn;
  transferList?: readonly Transferable[];
  resolve: (value: TOut) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

interface PoolWorker {
  worker: Worker;
  busy: boolean;
  taskId: number | null;
}

export function createWorkerPool<TIn = unknown, TOut = unknown>(
  options: BrowserWorkerPoolOptions
): WorkerPool<TIn, TOut> {
  const poolSize = Math.max(1, options.poolSize ?? defaultPoolSize());
  const maxQueueSize = options.maxQueueSize ?? Infinity;
  const taskTimeoutMs = options.taskTimeoutMs;

  const workers: PoolWorker[] = [];
  const queue: number[] = [];
  const pendingById = new Map<number, PendingTask<TIn, TOut>>();
  let nextId = 1;
  let destroyed = false;

  function failCurrentTask(entry: PoolWorker, err: unknown): void {
    const id = entry.taskId;
    entry.taskId = null;
    if (id == null) return;
    const pending = pendingById.get(id);
    if (!pending) return;
    pendingById.delete(id);
    if (pending.timer) clearTimeout(pending.timer);
    pending.reject(err instanceof Error ? err : new Error(String(err)));
  }

  function replaceWorker(entry: PoolWorker): void {
    if (destroyed) return;
    const idx = workers.indexOf(entry);
    if (idx === -1) return; // already replaced
    try {
      entry.worker.terminate();
    } catch {
      /* already gone */
    }
    workers[idx] = spawnWorker();
    pump();
  }

  function spawnWorker(): PoolWorker {
    const worker = new Worker(options.workerUrl, { type: 'module' });
    const entry: PoolWorker = { worker, busy: false, taskId: null };

    worker.onmessage = (ev: MessageEvent<ResultMessage<TOut>>) => {
      const msg = ev.data;
      const pending = pendingById.get(msg.id);
      entry.busy = false;
      entry.taskId = null;
      if (!pending) {
        pump(); // late reply for a task that already timed out — nothing to resolve, slot is free
        return;
      }
      pendingById.delete(msg.id);
      if (pending.timer) clearTimeout(pending.timer);
      if (msg.ok) pending.resolve(msg.output);
      else pending.reject(new Error(msg.error));
      pump();
    };

    // An uncaught throw inside the worker. A worker isn't guaranteed dead after this (unlike a Node
    // worker_threads 'exit'), but its state can't be trusted, so treat it the same way: fail the
    // in-flight task and replace the thread rather than keep using it.
    worker.onerror = (ev: ErrorEvent) => {
      failCurrentTask(entry, new Error(ev.message || 'Worker error'));
      replaceWorker(entry);
    };

    return entry;
  }

  function pump(): void {
    if (destroyed) return;
    for (const entry of workers) {
      if (entry.busy) continue;
      let id: number | undefined;
      let pending: PendingTask<TIn, TOut> | undefined;
      while ((id = queue.shift()) !== undefined) {
        pending = pendingById.get(id);
        if (pending) break; // else: settled already (e.g. timed out while still queued) — skip
      }
      if (id === undefined || !pending) break; // queue drained
      entry.busy = true;
      entry.taskId = id;
      const message: TaskMessage<TIn> = { id, input: pending.input };
      if (pending.transferList) entry.worker.postMessage(message, pending.transferList as Transferable[]);
      else entry.worker.postMessage(message);
    }
  }

  function timeoutTask(id: number): void {
    const pending = pendingById.get(id);
    if (!pending) return; // already settled
    pendingById.delete(id);
    pending.reject(new Error('Worker task timed out.'));
    const entry = workers.find((w) => w.taskId === id);
    if (entry) {
      entry.taskId = null;
      entry.busy = false;
      replaceWorker(entry); // might be stuck — recycle rather than trust it'll come back
    }
    // else: was still queued, never dispatched — pump() skips it lazily via the pendingById check above.
  }

  for (let i = 0; i < poolSize; i++) workers.push(spawnWorker());

  return {
    run(input, transferList) {
      if (destroyed) return Promise.reject(new Error('Worker pool has been destroyed.'));
      if (pendingById.size >= maxQueueSize) {
        return Promise.reject(new Error(`Worker pool queue is full (maxQueueSize=${maxQueueSize}).`));
      }
      const id = nextId++;
      return new Promise<TOut>((resolve, reject) => {
        const timer = taskTimeoutMs != null ? setTimeout(() => timeoutTask(id), taskTimeoutMs) : null;
        pendingById.set(id, { input, transferList, resolve, reject, timer });
        queue.push(id);
        pump();
      });
    },
    get size() {
      return workers.length;
    },
    get pending() {
      return pendingById.size;
    },
    destroy() {
      destroyed = true;
      const err = new Error('Worker pool was destroyed.');
      queue.length = 0;
      for (const pending of pendingById.values()) {
        if (pending.timer) clearTimeout(pending.timer);
        pending.reject(err);
      }
      pendingById.clear();
      for (const entry of workers) entry.worker.terminate();
    }
  };
}

/**
 * Worker-side helper — wires `self.onmessage` so a feature's worker entry file is just this call
 * wrapping its (pure) handler function. Must run inside a dedicated Worker's module scope.
 */
export function runWorkerLoop<TIn = unknown, TOut = unknown>(
  handle: (input: TIn) => TOut | Promise<TOut>
): void {
  const scope = self as unknown as {
    onmessage: ((ev: MessageEvent<TaskMessage<TIn>>) => void) | null;
    postMessage(message: ResultMessage<TOut>): void;
  };
  scope.onmessage = (ev) => {
    const msg = ev.data;
    Promise.resolve()
      .then(() => handle(msg.input))
      .then(
        (output) => scope.postMessage({ id: msg.id, ok: true, output }),
        (error) =>
          scope.postMessage({
            id: msg.id,
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          })
      );
  };
}

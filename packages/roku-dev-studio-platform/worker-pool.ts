/**
 * Generic `worker_threads` pool — task in, result out, over a fixed set of persistent threads.
 * Node-only (uses `node:worker_threads` + `node:os`), like `node.ts` — consumable from the Electron
 * main process, the remote-server package, the api package, or any future Node-side feature.
 *
 * Not a work-stealing or priority scheduler: a plain FIFO queue over a fixed pool. A consumer that
 * needs strict per-key ordering (e.g. one stateful connection's chunks must land on the same worker,
 * in order) should not share tasks across a fungible pool at all — create a dedicated `poolSize: 1`
 * instance per key instead; see `.discussion-docs/worker-pool-threading-design.md` for the worked
 * example (telnet console parsing).
 */

import { Worker, parentPort, type TransferListItem } from 'node:worker_threads';
import * as os from 'node:os';

/** Leave 2 cores free once there are 4+ to spare; below that, use everything available. */
function defaultPoolSize(): number {
  const envOverride = process.env.RDS_WORKER_POOL_SIZE;
  if (envOverride) {
    const n = parseInt(envOverride.trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const cores = os.cpus().length;
  return cores < 4 ? cores : Math.max(cores - 2, 4);
}

export interface WorkerPoolOptions {
  /** Absolute path to the compiled worker entry (.js) — the file that calls `runWorkerLoop()`. */
  workerFile: string;
  /** Passed to every spawned thread's `workerData` at startup (e.g. static config the handler needs). */
  workerData?: unknown;
  /** Thread count. Default: cores-aware (see module doc); overridable via `RDS_WORKER_POOL_SIZE`. */
  poolSize?: number;
  /** Reject `run()` immediately once queued + in-flight would exceed this. Default: no limit. */
  maxQueueSize?: number;
  /** Reject a task and recycle its worker if it doesn't resolve within this many ms. Default: no timeout. */
  taskTimeoutMs?: number;
}

export interface WorkerPool<TIn = unknown, TOut = unknown> {
  /** Submit one task; resolves/rejects with the worker's result. `transferList` moves ownership
   *  (e.g. a Buffer's underlying ArrayBuffer) instead of copying it. */
  run(input: TIn, transferList?: readonly TransferListItem[]): Promise<TOut>;
  /** Thread count — stays constant; a crashed worker is replaced, not just removed. */
  readonly size: number;
  /** Queued + in-flight task count. */
  readonly pending: number;
  /** Reject everything still queued/in-flight and terminate every worker. */
  destroy(): Promise<void>;
}

type TaskMessage<TIn> = { id: number; input: TIn };
type ResultMessage<TOut> =
  | { id: number; ok: true; output: TOut }
  | { id: number; ok: false; error: string };

interface PendingTask<TIn, TOut> {
  input: TIn;
  transferList?: readonly TransferListItem[];
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
  options: WorkerPoolOptions
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
    if (idx === -1) return; // already replaced (e.g. 'error' then 'exit' for the same failure)
    try {
      entry.worker.terminate();
    } catch {
      /* already dead */
    }
    workers[idx] = spawnWorker();
    pump();
  }

  function spawnWorker(): PoolWorker {
    const worker = new Worker(options.workerFile, { workerData: options.workerData });
    const entry: PoolWorker = { worker, busy: false, taskId: null };

    worker.on('message', (msg: ResultMessage<TOut>) => {
      const pending = pendingById.get(msg.id);
      entry.busy = false;
      entry.taskId = null;
      if (!pending) {
        pump(); // late reply for a task that already timed out — nothing to resolve, but the slot is free
        return;
      }
      pendingById.delete(msg.id);
      if (pending.timer) clearTimeout(pending.timer);
      if (msg.ok) pending.resolve(msg.output);
      else pending.reject(new Error(msg.error));
      pump();
    });

    // An uncaught throw inside the worker. Usually followed by 'exit'; failCurrentTask/replaceWorker
    // are idempotent against that second call (the entry is already out of `workers` by then).
    worker.on('error', (err) => {
      failCurrentTask(entry, err);
      replaceWorker(entry);
    });

    worker.on('exit', (code) => {
      if (destroyed || code === 0) return;
      failCurrentTask(entry, new Error(`Worker exited unexpectedly (code ${code}).`));
      replaceWorker(entry);
    });

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
      entry.worker.postMessage(message, pending.transferList as TransferListItem[] | undefined);
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
    async destroy() {
      destroyed = true;
      const err = new Error('Worker pool was destroyed.');
      queue.length = 0;
      for (const pending of pendingById.values()) {
        if (pending.timer) clearTimeout(pending.timer);
        pending.reject(err);
      }
      pendingById.clear();
      await Promise.all(workers.map((w) => w.worker.terminate()));
    }
  };
}

/**
 * Worker-side helper — wires `parentPort` message handling so a feature's worker entry file is just
 * this call wrapping its (pure) handler function. Must run inside a `worker_threads` Worker.
 */
export function runWorkerLoop<TIn = unknown, TOut = unknown>(
  handle: (input: TIn) => TOut | Promise<TOut>
): void {
  if (!parentPort) {
    throw new Error('runWorkerLoop() must run inside a worker_threads Worker (parentPort is null).');
  }
  const port = parentPort;
  port.on('message', (msg: TaskMessage<TIn>) => {
    Promise.resolve()
      .then(() => handle(msg.input))
      .then(
        (output) => {
          const result: ResultMessage<TOut> = { id: msg.id, ok: true, output };
          port.postMessage(result);
        },
        (error) => {
          const result: ResultMessage<TOut> = {
            id: msg.id,
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          };
          port.postMessage(result);
        }
      );
  });
}

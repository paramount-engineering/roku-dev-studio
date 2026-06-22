/**
 * Shared timing / async-rate primitives. Use these instead of hand-rolling `setTimeout` bookkeeping
 * so cancellation and edge semantics are consistent across the app, the network inspector, and the
 * remote server.
 *
 * These cover the common cases (collapse a burst, cap a call rate, grow a retry delay). Specialized
 * algorithms with their own contracts — e.g. a token-bucket rate limiter (`retryAfterMs` budgets) or
 * a microtask/`setImmediate` coalescer — are intentionally NOT modeled here; they live with their
 * callers because their APIs aren't a debounce/throttle/backoff.
 */

/** A scheduled function that can be cancelled (drops any pending trailing invocation). */
export type Cancellable<A extends unknown[]> = ((...args: A) => void) & { cancel: () => void };

/**
 * Trailing-edge debounce: `fn` runs `waitMs` after the *last* call. Each call resets the timer, and
 * the most recent arguments win. Good for "settle then act" (e.g. emit after input stops).
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number): Cancellable<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;
  const debounced = ((...args: A) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const a = lastArgs as A;
      lastArgs = null;
      fn(...a);
    }, waitMs);
  }) as Cancellable<A>;
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  return debounced;
}

/**
 * Trailing throttle: `fn` runs at most once per `intervalMs`. The first call opens a window and
 * schedules a single trailing invocation `intervalMs` later; calls during the window are absorbed
 * (the latest arguments are used when it fires). Good for collapsing a burst of state changes into
 * one emit while still firing promptly. `fn` sees state as of fire time.
 */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, intervalMs: number): Cancellable<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;
  const throttled = ((...args: A) => {
    lastArgs = args;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const a = lastArgs as A;
      lastArgs = null;
      fn(...a);
    }, intervalMs);
  }) as Cancellable<A>;
  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  return throttled;
}

/** A growing delay: starts at `baseMs`, multiplies by `factor` on each `next()`, capped at `maxMs`. */
export interface BackoffStepper {
  /** Current delay in ms (starts at `baseMs`). */
  readonly value: number;
  /** Multiply the delay by `factor` (capped at `maxMs`) and return the new value. */
  next(): number;
  /** Reset the delay back to `baseMs`. */
  reset(): void;
}

export interface ExponentialBackoffOptions {
  /** Starting (and floor) delay in ms. */
  baseMs: number;
  /** Ceiling delay in ms. */
  maxMs: number;
  /** Growth multiplier per step. Default 2. */
  factor?: number;
}

/**
 * Create an exponential-backoff stepper: a small piece of state for "stay at the floor while things
 * are changing, grow toward the ceiling while idle/stable, snap back on activity". Doubling by
 * default. This is the stateful counterpart to a one-shot `baseMs * factor**attempt` formula and maps
 * directly onto cadence loops (e.g. a discovery scan interval).
 */
export function exponentialBackoff(options: ExponentialBackoffOptions): BackoffStepper {
  const { baseMs, maxMs } = options;
  const factor = options.factor ?? 2;
  let current = baseMs;
  return {
    get value() {
      return current;
    },
    next() {
      current = Math.min(maxMs, current * factor);
      return current;
    },
    reset() {
      current = baseMs;
    }
  };
}

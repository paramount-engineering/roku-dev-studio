/**
 * Per-tool token-bucket rate limiter for the MCP bridge.
 *
 * Generalizes the existing `scan_devices` cooldown into a small bucket
 * per (tool / endpoint) so a runaway agent loop can't saturate a device,
 * the LAN, or the bridge worker pool. Process-local; reset on every
 * Dev Studio launch.
 *
 * Defaults (per minute):
 *   - read-only ops:  60
 *   - destructive ops: 20
 *
 * `scan_devices` keeps its own (longer, 10s) cooldown because the
 * fan-out cost is not "1 request" but "an arp/SSDP sweep across the LAN".
 *
 * Buckets refill linearly at `capacity / windowMs` tokens per ms.
 * `take()` returns `{ allowed, retryAfterMs }`. The retry hint is what
 * the bridge surfaces in `Retry-After` and `retryAfterMs` body fields.
 *
 * Why token bucket and not a fixed sliding window:
 *   - Bursty agents: a coding LLM frequently fires 3–5 quick reads to
 *     orient itself, then idles. A token bucket lets that burst land
 *     immediately as long as long-run throughput stays under the cap.
 *   - Deterministic recovery: the agent gets a precise `retryAfterMs`,
 *     not "wait until the window slides".
 */

type Bucket = {
  /** Available tokens (fractional during refill). */
  tokens: number;
  /** Last time the bucket was refilled. */
  lastRefillAt: number;
  /** Capacity (max tokens) — captured per bucket for variable per-tool caps. */
  capacity: number;
  /** Window in ms over which one full bucket replenishes. */
  windowMs: number;
};

const buckets = new Map<string, Bucket>();

/**
 * Upper bound on distinct buckets. Keys are derived from the request path/op id, which
 * is caller-controlled — a looping agent hitting `/op/<garbage-N>` or arbitrary POST
 * paths would otherwise grow this map without bound. Legit traffic uses only a few dozen
 * keys, so 512 is comfortably above real usage while capping worst-case memory.
 */
const MAX_BUCKETS = 512;

/** Evict the least-recently-refilled bucket to keep the map bounded. */
function evictOldestBucket(): void {
  let oldestKey: string | undefined;
  let oldestAt = Infinity;
  for (const [k, v] of buckets) {
    if (v.lastRefillAt < oldestAt) {
      oldestAt = v.lastRefillAt;
      oldestKey = k;
    }
  }
  if (oldestKey !== undefined) buckets.delete(oldestKey);
}

export type RateDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

/**
 * Try to take one token from the named bucket. The first call seeds the
 * bucket with its full capacity; subsequent calls refill at
 * `capacity / windowMs` tokens / ms.
 */
export function take(key: string, capacity: number, windowMs: number): RateDecision {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    if (buckets.size >= MAX_BUCKETS) evictOldestBucket();
    b = { tokens: capacity, lastRefillAt: now, capacity, windowMs };
    buckets.set(key, b);
  }
  // If the per-bucket settings changed (e.g. a new build adjusted defaults),
  // adopt the new settings on the next call. Tokens are reset to capacity
  // because the old bucket's accumulated balance no longer maps cleanly.
  if (b.capacity !== capacity || b.windowMs !== windowMs) {
    b.capacity = capacity;
    b.windowMs = windowMs;
    b.tokens = Math.min(b.tokens, capacity);
  }
  const elapsed = Math.max(0, now - b.lastRefillAt);
  const refillRate = b.capacity / b.windowMs; // tokens per ms
  b.tokens = Math.min(b.capacity, b.tokens + elapsed * refillRate);
  b.lastRefillAt = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { allowed: true };
  }
  // 0 < tokens < 1 → time to next whole token = (1 - tokens) / refillRate.
  const retryAfterMs = Math.max(1, Math.ceil((1 - b.tokens) / refillRate));
  return { allowed: false, retryAfterMs };
}

/** Test helper — reset all buckets between tests. */
export function _resetMcpRateLimitForTests(): void {
  buckets.clear();
}

/**
 * Decide which bucket (if any) a given request belongs to. Returns null
 * for endpoints that should not be rate-limited:
 *   - GET /health, /selected-device, /devices — read-only state queries
 *     served from in-memory cache; never touch a device.
 *   - POST /scan-devices — has its own (stricter) 10s cooldown elsewhere.
 *
 * For `/op/<id>` we look up the op descriptor so a destructive op gets
 * the tighter cap. For `/tool` (renderer-routed dispatcher) and the
 * back-compat aliases we use a hand-tuned mapping; renderer-routed tools
 * are mostly destructive (RALE writes, telnet send, app connector control)
 * so the cap defaults to "destructive" there.
 */
export type RateBudget = {
  key: string;
  capacity: number;
  windowMs: number;
};

const READ_CAP = 60;
const DESTRUCTIVE_CAP = 20;
const WINDOW_MS = 60_000;

const DESTRUCTIVE_ALIAS_PATHS = new Set(['/ecp-post', '/sideload', '/delete-sideload', '/screenshot']);

/**
 * Pathname → rate budget. Caller passes a `lookupOp` so the bridge can
 * map `/op/<id>` to its op descriptor without this module having to
 * import `roku-dev-studio-api`.
 */
export function rateBudgetForRequest(
  method: string,
  pathname: string,
  lookupOp: (id: string) => { destructive: boolean } | undefined
): RateBudget | null {
  if (method === 'GET') {
    if (pathname === '/health' || pathname === '/selected-device' || pathname === '/devices') return null;
    if (pathname === '/app-connector/functions') {
      return { key: 'GET:/app-connector/functions', capacity: READ_CAP, windowMs: WINDOW_MS };
    }
    return null;
  }
  if (method !== 'POST') return null;
  if (pathname === '/scan-devices') return null;

  if (pathname.startsWith('/op/')) {
    const opId = pathname.slice('/op/'.length);
    const op = lookupOp(opId);
    const destructive = op ? op.destructive : true;
    return {
      key: `op:${opId}`,
      capacity: destructive ? DESTRUCTIVE_CAP : READ_CAP,
      windowMs: WINDOW_MS
    };
  }
  if (pathname === '/tool') {
    return { key: 'tool', capacity: DESTRUCTIVE_CAP, windowMs: WINDOW_MS };
  }
  if (pathname === '/builder/drop-script') {
    return { key: 'tool:builder/drop-script', capacity: DESTRUCTIVE_CAP, windowMs: WINDOW_MS };
  }
  if (pathname === '/connect-device') {
    return { key: 'tool:connect-device', capacity: READ_CAP, windowMs: WINDOW_MS };
  }
  // Back-compat aliases (kept for older clients; new code uses /op/<id>).
  if (DESTRUCTIVE_ALIAS_PATHS.has(pathname)) {
    return { key: `path:${pathname}`, capacity: DESTRUCTIVE_CAP, windowMs: WINDOW_MS };
  }
  return { key: `path:${pathname}`, capacity: READ_CAP, windowMs: WINDOW_MS };
}

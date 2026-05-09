/**
 * AppConnector — the single owner of a device panel's App Connector (RALE) connection.
 *
 * One connector per device panel. All paths that need to talk to the app's
 * TrackerTask (Inspector / Action Script Builder / Executor / if-eval in the
 * API package) share it, which is why this module lives outside the inspector
 * component. It owns the connectionId and the `RaleDisconnected` IPC
 * subscription so every caller sees the same state.
 *
 * Responsibilities:
 *  - connect / disconnect lifecycle (wake -> socket -> init)
 *  - auto-reconnect on stale "Not connected" responses (kept connections stale
 *    when a launch/sideload between steps closes the TrackerTask socket)
 *  - state change notifications for UI (buttons, status line)
 *
 * See `.discussion-docs/app-connector-refactor.md` for rationale.
 */

import { DEFAULT_RALE_PORT } from '../utils/constants.js';
import { isRaleNotConnectedResult } from '../utils/rale-result-guards.js';
import { normalizeRaleFunctions } from '../utils/rale-functions.js';

export type AppConnectorStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface AppConnectorState {
  status: AppConnectorStatus;
  /** Current active socket id (null unless status === 'connected'). */
  connectionId: string | null;
  /** Last connect / command error, cleared on success. */
  lastError: string | null;
  /** Short human-readable status message for UI (e.g. "Connected!"). */
  message: string | null;
}

/**
 * Channel-side function exposed via `GetExternalControlFunctions`. Same
 * normalized shape every consumer uses. See `rale-functions.ts`.
 *
 * `description` is optional; channels may include a per-function description
 * in the payload that we surface in the Inspector hint, the MCP
 * `list_app_connector_functions` tool, and the bridge state push.
 */
export type AppConnectorFunction = {
  name: string;
  params: Array<{ name?: string; type?: string }>;
  description?: string;
};

export interface AppConnectorApiLike {
  query(endpoint: string): Promise<{ success?: boolean; data?: string; error?: string }>;
  raleWake(port: number): Promise<{ success?: boolean; error?: string }>;
  raleConnect(
    port: number
  ): Promise<{ success?: boolean; connectionId?: string; error?: string }>;
  raleCommand(
    connectionId: string,
    command: string,
    args: unknown
  ): Promise<{ success?: boolean; data?: unknown; error?: string } | Record<string, unknown>>;
  raleDisconnect(connectionId: string): Promise<unknown>;
}

export interface AppConnectorConnectOptions {
  /** Pre-flight `/query/active-app` to confirm Dev App is foreground (manual connect path). */
  checkDevApp?: boolean;
  /** Override port for this connect (defaults to the connector's getPort()). */
  port?: number;
  /** Override log verbosity for `init` (defaults to the connector's getLogVerbosity()). */
  logVerbosity?: number;
  /** Progress callback for UI (e.g. "Waking up TrackerTask on port 49200..."). */
  onStatus?: (message: string) => void;
}

export interface AppConnectorConnectResult {
  ok: boolean;
  connectionId?: string;
  error?: string;
  /** True when Dev App check failed (caller may show a nicer message). */
  devAppNotActive?: boolean;
  /** True when `/query/active-app` itself failed (network / ECP issue). */
  devAppQueryFailed?: boolean;
  /** Data returned by the RALE `init` command, if it succeeded. */
  initData?: unknown;
}

export interface AppConnectorCommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AppConnector {
  getState(): AppConnectorState;
  getConnectionId(): string | null;
  isConnected(): boolean;
  /** Subscribe to state changes. Returns unsubscribe fn. Immediately invoked once with current state. */
  onStateChange(listener: (state: AppConnectorState) => void): () => void;

  /**
   * Last-fetched channel function list, or `null` if nothing has been
   * fetched in this session yet. Auto-populated by every successful
   * `command('getExternalControlFunctions', {})` round-trip.
   *
   * The cache is deliberately **not** cleared on disconnect — the function
   * list is a property of the channel's source code, not of any single
   * session. See `setState` note below and `engineering-principles.md` §8.
   * Only `destroy()` nulls it.
   */
  getFunctions(): AppConnectorFunction[] | null;

  /** ISO timestamp of the last successful fetch, or `null`. */
  getFunctionsFetchedAt(): string | null;

  /**
   * Subscribe to function-list changes. Fires immediately with the
   * current value (which may be `null`). Returns an unsubscribe fn.
   *
   * This is the single source of truth for the function list — the
   * Inspector dropdown, the Action Script Builder type-ahead, and the
   * MCP bridge state push all subscribe here so they stay in lockstep
   * regardless of who initiated the underlying fetch.
   */
  onFunctionsChange(
    listener: (functions: AppConnectorFunction[] | null, fetchedAt: string | null) => void
  ): () => void;

  /**
   * Establish a connection if not already connected. If connected and still
   * alive, returns the current connectionId without doing any work.
   */
  connect(opts?: AppConnectorConnectOptions): Promise<AppConnectorConnectResult>;

  /** User-initiated close. Emits a `disconnected` state with the user reason. */
  disconnect(): Promise<void>;

  /**
   * Return a usable connectionId, establishing one if needed. When `verify`
   * is true, runs a cheap liveness check first and reconnects if stale.
   */
  ensureConnected(opts?: { verify?: boolean }): Promise<string | null>;

  /**
   * Execute a RALE command with auto-recovery: on a "Not connected" response,
   * the connector reconnects and retries once.
   */
  command<T = unknown>(
    command: string,
    args?: unknown
  ): Promise<AppConnectorCommandResult<T>>;

  /** Liveness probe via `getExternalControlFunctions`. Clears state on failure. */
  verify(): Promise<boolean>;

  /** Remove IPC subscription and reset state. Call when the panel is being torn down. */
  destroy(): void;
}

export interface CreateAppConnectorOptions {
  /** Current RALE port (read dynamically so UI port-input changes take effect). */
  getPort?: () => number;
  /** Current log verbosity for `init` (defaults to 0). */
  getLogVerbosity?: () => number;
  /**
   * Subscribe fn for `RaleDisconnected` IPC events. Defaults to
   * `window.roku.onRaleDisconnected`. Override for tests / non-electron envs.
   */
  subscribeDisconnect?: (cb: (data: { connectionId?: string }) => void) => (() => void) | void;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function defaultSubscribeDisconnect(
  cb: (data: { connectionId?: string }) => void
): (() => void) | void {
  const w = window as unknown as {
    roku?: { onRaleDisconnected?: (fn: (data: unknown) => void) => () => void };
  };
  if (!w.roku || typeof w.roku.onRaleDisconnected !== 'function') return;
  return w.roku.onRaleDisconnected((data: unknown) => {
    cb((data as { connectionId?: string }) || {});
  });
}

export function createAppConnector(
  api: AppConnectorApiLike,
  opts: CreateAppConnectorOptions = {}
): AppConnector {
  const getPort = opts.getPort ?? (() => DEFAULT_RALE_PORT);
  const getLogVerbosity = opts.getLogVerbosity ?? (() => 0);
  const subscribeDisconnect = opts.subscribeDisconnect ?? defaultSubscribeDisconnect;

  let state: AppConnectorState = {
    status: 'idle',
    connectionId: null,
    lastError: null,
    message: null
  };

  const listeners = new Set<(s: AppConnectorState) => void>();
  /** In-flight connect promise so concurrent callers await the same attempt. */
  let connectInFlight: Promise<AppConnectorConnectResult> | null = null;

  // Function-list cache + listeners. Separate from connection state so
  // existing `onStateChange` subscribers don't get spammed every time the
  // function list changes (and vice versa). Both lists are notified
  // immediately on subscribe, mirroring `onStateChange` semantics.
  let functions: AppConnectorFunction[] | null = null;
  let functionsFetchedAt: string | null = null;
  const functionsListeners = new Set<
    (fns: AppConnectorFunction[] | null, fetchedAt: string | null) => void
  >();

  function notifyFunctionsChange(): void {
    for (const listener of Array.from(functionsListeners)) {
      try {
        listener(functions, functionsFetchedAt);
      } catch (_) {
        // Never let a faulty listener break the connector.
      }
    }
  }

  /**
   * Replace the cached function list and broadcast. Called from inside
   * `command()` whenever a `getExternalControlFunctions` round-trip
   * succeeds — every consumer auto-syncs without an extra IPC hop.
   */
  function setFunctions(next: AppConnectorFunction[] | null): void {
    functions = next;
    functionsFetchedAt = next != null ? new Date().toISOString() : null;
    notifyFunctionsChange();
  }

  // NOTE: there is deliberately no exported "clear the function list" helper.
  // The list's only lifecycle is: set on a successful
  // `getExternalControlFunctions` response (via `maybeCacheFunctionsFromResult`),
  // and null'd in `destroy()` when the panel is torn down. Clearing it on any
  // narrower event (disconnect, RaleDisconnected IPC, stale-socket recovery)
  // wipes the cache that the Action Script Builder's borrow-pattern fetch just
  // populated — see `engineering-principles.md` §8 "Worked regression".

  function setState(patch: Partial<AppConnectorState>): void {
    state = { ...state, ...patch };
    // NOTE: the function-list cache is **not** cleared on disconnect.
    //
    // Earlier versions auto-invalidated `functions` whenever status went
    // to `disconnected` / `idle`. That broke the Action Script Builder's
    // borrow-pattern fetch in `fetchAppFunctionsForBuilder`:
    //   connect → fetch → cache populated → borrow disconnects → cache cleared.
    // Callers reading `getFunctions()` after the borrow saw `null` and
    // reported `status: "not-applicable", functions: []` even though the
    // channel had just answered with a real list.
    //
    // The function list is a property of the channel's source code, not
    // of any single session. As long as the same channel is sideloaded,
    // it's the same list. Consumers that want "no functions visible
    // while disconnected" (the Inspector dropdown) clear their own
    // local view based on `isConnected()` — that's a UX choice, not a
    // correctness invariant. Cache lives until `destroy()`.
    //
    // Snapshot listener list: callbacks may subscribe/unsubscribe during notify.
    for (const listener of Array.from(listeners)) {
      try {
        listener(state);
      } catch (_) {
        // Never let a faulty listener break the connector.
      }
    }
  }

  const disconnectUnsub = subscribeDisconnect((data) => {
    if (!data || !data.connectionId) return;
    if (data.connectionId !== state.connectionId) return;
    setState({
      status: 'disconnected',
      connectionId: null,
      message: 'Connection closed by device'
    });
  });

  async function doConnect(
    options: AppConnectorConnectOptions
  ): Promise<AppConnectorConnectResult> {
    const port = options.port ?? getPort();
    const logVerbosity = options.logVerbosity ?? getLogVerbosity();
    const onStatus = options.onStatus;

    setState({ status: 'connecting', lastError: null, message: 'Connecting...' });

    if (options.checkDevApp) {
      onStatus?.('Checking if Dev App is active...');
      try {
        const res = await api.query('/query/active-app');
        if (!res || !res.success || typeof res.data !== 'string') {
          const err = 'Could not verify Dev App status.';
          setState({ status: 'disconnected', lastError: err, message: err });
          return { ok: false, error: err, devAppQueryFailed: true };
        }
        if (!res.data.includes('id="dev"')) {
          const err = 'Dev App is not running on the Roku device.';
          setState({ status: 'disconnected', lastError: err, message: err });
          return { ok: false, error: err, devAppNotActive: true };
        }
      } catch (e) {
        const err = errMsg(e) || 'Could not verify Dev App status.';
        setState({ status: 'disconnected', lastError: err, message: err });
        return { ok: false, error: err, devAppQueryFailed: true };
      }
    }

    onStatus?.(`Waking up TrackerTask on port ${port}...`);
    try {
      const wake = await api.raleWake(port);
      if (wake && wake.success === false) {
        const err = wake.error || 'Failed to wake TrackerTask';
        setState({ status: 'disconnected', lastError: err, message: err });
        return { ok: false, error: err };
      }
    } catch (e) {
      const err = errMsg(e) || 'Failed to wake TrackerTask';
      setState({ status: 'disconnected', lastError: err, message: err });
      return { ok: false, error: err };
    }

    // TrackerTask needs a moment after `raleWake` before it's listening on
    // the socket. A blind `setTimeout(2000)` would make fast devices pay 2s
    // per Connect and still sometimes race on cold-boot devices that need
    // longer (see `engineering-principles.md` §3 "Subscribe-driven UI >
    // poll-driven UI > timer-driven UI").
    //
    // Instead: retry the socket connect with small linear backoff until
    // either success or total-elapsed exceeds `CONNECT_TIMEOUT_MS`. Typical
    // happy-path latency is well under 500 ms; the worst case is bounded by
    // roughly the old blind-wait budget.
    const CONNECT_INITIAL_BACKOFF_MS = 150;
    const CONNECT_BACKOFF_STEP_MS = 150;
    const CONNECT_TIMEOUT_MS = 4500;
    const CONNECT_MAX_ATTEMPTS = 12;

    onStatus?.('Connecting to socket...');
    let cid: string | null = null;
    let lastError: string | null = null;
    {
      const started = Date.now();
      let attempt = 0;
      let backoff = CONNECT_INITIAL_BACKOFF_MS;
      while (attempt < CONNECT_MAX_ATTEMPTS) {
        attempt++;
        await new Promise((r) => setTimeout(r, backoff));
        try {
          const res = await api.raleConnect(port);
          if (res && res.success && res.connectionId) {
            cid = res.connectionId;
            lastError = null;
            break;
          }
          lastError = (res && res.error) || 'Failed to connect';
        } catch (e) {
          lastError = errMsg(e) || 'Failed to connect';
        }
        if (Date.now() - started >= CONNECT_TIMEOUT_MS) break;
        if (attempt > 1) onStatus?.(`Connecting to socket (retry ${attempt})...`);
        backoff += CONNECT_BACKOFF_STEP_MS;
      }
    }

    if (!cid) {
      const err = lastError || 'Failed to connect';
      setState({ status: 'disconnected', lastError: err, message: err });
      return { ok: false, error: err };
    }

    // TrackerTask closes the socket if no `init` command arrives within 3s.
    // Run it eagerly so downstream callers don't have to race that timer.
    onStatus?.('Initializing...');
    let initData: unknown;
    try {
      const res = (await api.raleCommand(cid, 'init', { logVerbosity })) as {
        success?: boolean;
        data?: unknown;
        error?: string;
      };
      if (res && res.success) {
        initData = res.data ?? null;
      }
    } catch (_) {
      // Non-fatal: some TrackerTask builds may not respond; any raleCommand
      // counts as activity which keeps the socket open.
    }

    setState({
      status: 'connected',
      connectionId: cid,
      lastError: null,
      message: 'Connected'
    });
    return { ok: true, connectionId: cid, initData };
  }

  async function connect(
    options: AppConnectorConnectOptions = {}
  ): Promise<AppConnectorConnectResult> {
    if (state.status === 'connected' && state.connectionId) {
      const alive = await verify();
      if (alive) {
        return { ok: true, connectionId: state.connectionId };
      }
    }
    if (connectInFlight) return connectInFlight;
    connectInFlight = doConnect(options).finally(() => {
      connectInFlight = null;
    });
    return connectInFlight;
  }

  async function disconnect(): Promise<void> {
    const cid = state.connectionId;
    if (cid && typeof api.raleDisconnect === 'function') {
      try {
        await api.raleDisconnect(cid);
      } catch (_) {
        // Ignore: the device may already be gone.
      }
    }
    setState({
      status: 'disconnected',
      connectionId: null,
      lastError: null,
      message: 'Disconnected'
    });
  }

  async function verify(): Promise<boolean> {
    const cid = state.connectionId;
    if (!cid) return false;
    try {
      const res = (await api.raleCommand(cid, 'getExternalControlFunctions', {})) as {
        success?: boolean;
      };
      if (res && res.success) return true;
    } catch (_) {
      // Fall through to clear state.
    }
    if (state.connectionId === cid) {
      setState({
        status: 'disconnected',
        connectionId: null,
        message: 'Connection lost'
      });
    }
    return false;
  }

  async function ensureConnected(
    options: { verify?: boolean } = {}
  ): Promise<string | null> {
    if (state.status === 'connected' && state.connectionId) {
      if (!options.verify) return state.connectionId;
      const alive = await verify();
      if (alive) return state.connectionId;
    }
    const res = await connect();
    return res.ok && res.connectionId ? res.connectionId : null;
  }

  /**
   * Look at a command result and, if it's a successful
   * `getExternalControlFunctions` response, normalize and cache its
   * function list. Centralizing the auto-cache here means any consumer
   * (Inspector, Builder borrow-fetch, validator's RALE preflight, MCP
   * tool) ends up writing to the same store without an explicit
   * `setFunctions` call.
   */
  function maybeCacheFunctionsFromResult(cmd: string, result: unknown): void {
    if (cmd !== 'getExternalControlFunctions') return;
    if (!result || typeof result !== 'object') return;
    const r = result as { success?: boolean; data?: unknown };
    if (!r.success || !r.data || typeof r.data !== 'object') return;
    const funcs = (r.data as { functions?: unknown }).functions;
    if (!Array.isArray(funcs)) return;
    const normalized = normalizeRaleFunctions(funcs) as AppConnectorFunction[];
    setFunctions(Array.isArray(normalized) ? normalized : []);
  }

  async function command<T = unknown>(
    cmd: string,
    args?: unknown
  ): Promise<AppConnectorCommandResult<T>> {
    let cid = state.connectionId;
    if (!cid) {
      cid = await ensureConnected();
      if (!cid) return { success: false, error: 'Not connected' };
    }

    let result = (await api.raleCommand(cid, cmd, args ?? {})) as AppConnectorCommandResult<T>;
    if (!isRaleNotConnectedResult(result)) {
      maybeCacheFunctionsFromResult(cmd, result);
      return result;
    }

    // Cached id was stale (socket closed between steps). Reconnect and retry once.
    setState({ status: 'reconnecting', message: 'Reconnecting...' });
    if (state.connectionId === cid) {
      setState({ connectionId: null });
    }
    const fresh = await ensureConnected();
    if (!fresh) return result;
    result = (await api.raleCommand(fresh, cmd, args ?? {})) as AppConnectorCommandResult<T>;
    maybeCacheFunctionsFromResult(cmd, result);
    return result;
  }

  function onStateChange(listener: (s: AppConnectorState) => void): () => void {
    listeners.add(listener);
    try {
      listener(state);
    } catch (_) {}
    return () => {
      listeners.delete(listener);
    };
  }

  function onFunctionsChange(
    listener: (
      fns: AppConnectorFunction[] | null,
      fetchedAt: string | null
    ) => void
  ): () => void {
    functionsListeners.add(listener);
    try {
      listener(functions, functionsFetchedAt);
    } catch (_) {}
    return () => {
      functionsListeners.delete(listener);
    };
  }

  function destroy(): void {
    if (typeof disconnectUnsub === 'function') {
      try {
        disconnectUnsub();
      } catch (_) {}
    }
    listeners.clear();
    functionsListeners.clear();
    functions = null;
    functionsFetchedAt = null;
    state = { status: 'idle', connectionId: null, lastError: null, message: null };
  }

  return {
    getState: () => state,
    getConnectionId: () => state.connectionId,
    isConnected: () => state.status === 'connected' && state.connectionId != null,
    onStateChange,
    getFunctions: () => functions,
    getFunctionsFetchedAt: () => functionsFetchedAt,
    onFunctionsChange,
    connect,
    disconnect,
    ensureConnected,
    command,
    verify,
    destroy
  };
}

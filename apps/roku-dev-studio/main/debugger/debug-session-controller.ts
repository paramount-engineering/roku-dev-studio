/**
 * BrightScript socket-based debugger — main-process session controller.
 *
 * Wraps RDS's in-house {@link DebugProtocolClient} (the binary debug protocol on
 * control port 8081, implemented under ./protocol — no `roku-debug` dependency)
 * into a small, IPC-friendly controller. One `DebugSession` per device IP.
 *
 * Scope (Phase 1 spike): attach/detach, execution control (continue / pause /
 * step), on-stop snapshot (threads + stack + top-frame variables), a REPL
 * (`executeCommand`), breakpoint add/remove/list, and live console output
 * (`io-output`). Emitted events are forwarded verbatim to the Debugger window
 * via the injected `emit`.
 *
 * NOT yet handled (Phase 2/3): coordinating the single-client 8081 lease with
 * the 8085 telnet console (a real device can't cleanly serve both at once — see
 * telnet-handlers.ts holder/lease pattern), source-map (`pkg:/`) resolution,
 * and Privacy Mode masking of variable values.
 */
import { IPC } from '../../shared/ipc/channels';
import { mainError, mainLog } from '../log.js';
import { DEBUG_CONTROL_PORT } from './protocol/constants';
import { DebugProtocolClient } from './protocol/debug-protocol-client';
/** Total budget to keep retrying attach after a debug sideload (8081 opens a beat late). */
const PORT_WAIT_MS = 20000;
/** Per-attempt bound on connect + handshake (belt-and-suspenders around the socket connect). */
const PER_ATTEMPT_MS = 5000;
/** Delay between attach attempts. */
const PROBE_INTERVAL_MS = 800;
/** At the entry halt, wait this long for the renderer's initial breakpoint push to
 *  arrive before flushing + continuing — breakpoints only register while stopped. */
const ENTRY_BREAKPOINT_GRACE_MS = 600;

type SessionState = 'connecting' | 'attached' | 'stopped' | 'running' | 'disconnected' | 'error';

/** A breakpoint the renderer asked us to set, tracked so we can (re)send it while halted. */
interface CachedBreakpoint {
  filePath: string;
  lineNumber: number;
  conditionalExpression?: string;
  hitCount?: number;
  /** True once it has been sent to the device WHILE HALTED (so it actually registered). */
  sent: boolean;
  /** Device breakpoint id (once registered) — needed to remove it later. */
  breakpointId?: number;
}

interface DebugSession {
  ip: string;
  client: DebugProtocolClient;
  state: SessionState;
  protocolVersion?: string;
  /** The very first suspend is the entry halt (protocol 2.0+ stops on the first statement). */
  entryHandled: boolean;
  /** Client-owned breakpoints keyed by `path:line`; flushed to the device while halted. */
  breakpoints: Map<string, CachedBreakpoint>;
  /** Last stop snapshot (reason/detail/threads/stackFrames/variables), retained so a
   *  polling caller — e.g. the MCP bridge's wait-for-stop — can read it without the event.
   *  Cleared on resume. */
  lastStop?: Record<string, unknown>;
}

type Emit = (channel: string, payload: unknown) => void;

export class DebugSessionController {
  private sessions = new Map<string, DebugSession>();

  constructor(private readonly emit: Emit) {}

  private setState(session: DebugSession, state: SessionState, extra?: Record<string, unknown>): void {
    session.state = state;
    if (state === 'running') session.lastStop = undefined; // the retained snapshot is stale once we resume
    this.emit(IPC.DebuggerState, { ip: session.ip, state, protocolVersion: session.protocolVersion, ...extra });
  }

  /** True if a session for `ip` exists and is not disconnected. */
  isAttached(ip: string): boolean {
    const s = this.sessions.get(ip);
    return !!s && s.state !== 'disconnected' && s.state !== 'error';
  }

  status(ip: string): { ip: string; state: SessionState; protocolVersion?: string } {
    const s = this.sessions.get(ip);
    return { ip, state: s?.state ?? 'disconnected', protocolVersion: s?.protocolVersion };
  }

  /**
   * Open a debug-protocol session to `ip:8081`. Tears down any existing session
   * for that IP first (the control port is single-client). Resolves once the
   * handshake completes or rejects with an actionable message.
   */
  async attach(ip: string): Promise<{ ok: boolean; error?: string }> {
    const clean = (ip || '').trim();
    if (!clean) return { ok: false, error: 'A device IP is required to attach.' };

    await this.detach(clean); // single-client control port — never stack sessions

    // Surface "connecting" immediately; the port can take a beat to open after a
    // debug-enabled sideload.
    this.emit(IPC.DebuggerState, { ip: clean, state: 'connecting' });

    // The debug control port is SINGLE-CLIENT: any TCP connection consumes the one
    // slot. So we must NOT pre-probe with a throwaway socket (that burns the slot
    // and the real client is then refused). Instead let our client be the
    // first/only connector, and retry IT to cover the post-sideload timing window.
    // Our connect() rejects promptly on a refused/errored port; withTimeout is a
    // belt-and-suspenders bound, and between attempts we fully destroy the client
    // so the next attempt is a clean first-connect.
    const deadline = Date.now() + PORT_WAIT_MS;
    let attempt = 0;
    let lastError = 'connection refused';
    while (Date.now() < deadline) {
      attempt++;
      let client: DebugProtocolClient;
      try {
        client = new DebugProtocolClient({ host: clean, controlPort: DEBUG_CONTROL_PORT });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      const session: DebugSession = { ip: clean, client, state: 'connecting', entryHandled: false, breakpoints: new Map() };
      this.wireEvents(session);
      try {
        await withTimeout(client.connect(true), PER_ATTEMPT_MS, 'handshake-timeout');
        // Handshake succeeded — this is our live session.
        this.sessions.set(clean, session);
        if (session.state === 'connecting') this.setState(session, 'attached');
        mainLog(`[debugger] attached to ${clean}:${DEBUG_CONTROL_PORT} (attempt ${attempt})`);
        return { ok: true };
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        try { await client.destroy(true); } catch { /* best-effort teardown before retry */ }
        if (Date.now() >= deadline) break;
        await sleep(PROBE_INTERVAL_MS);
      }
    }

    const desc = await describeDevice(clean);
    // Classify the failure: every attempt refused = the port is closed (not a debug
    // launch); a handshake timeout = the TCP port opened but the debug protocol never
    // completed (port held by another debugger, or not a debug build).
    const refused = /ECONNREFUSED|ECONNRESET|EHOSTUNREACH|connection refused/i.test(lastError);
    // A short summary for the status line + the full remediation as `detail` — the renderer
    // shows the summary and reveals `detail` on demand (hover tooltip + a "Why?" modal)
    // instead of dumping the whole paragraph into a one-line clipped status.
    const summary = refused ? `Port ${DEBUG_CONTROL_PORT} closed — not a debug launch` : 'Debug handshake never completed';
    const detail = refused
      ? `Debug port ${DEBUG_CONTROL_PORT} is closed on ${clean} (connection refused). ${desc} ` +
        `The running channel was NOT launched with debugging. Re-sideload with "Sideload with Debugging" enabled ` +
        `(or drop a STOP in your code — that auto-enables it). A plain sideload, a Replace/reload without the debug ` +
        `flag, or an app relaunch does not open the debug port. If the console shows the Micro Debugger ` +
        `"Thread selected…" text, the socket protocol is NOT active for this run. Also confirm Settings → System → ` +
        `Advanced system settings → "Control by mobile apps" is Enabled or Permissive.`
      : `Connected to debug port ${DEBUG_CONTROL_PORT} on ${clean} but the debug handshake never completed. ${desc} ` +
        `The port may be held by another debugger (a VS Code BrightScript session or a second RDS window), or the ` +
        `running channel is not a debug build. Close other debuggers and re-sideload with debugging.`;
    this.emit(IPC.DebuggerState, { ip: clean, state: 'error', message: summary, detail });
    mainError(`[debugger] attach gave up for ${clean} after ${attempt} attempt(s): ${lastError} (${refused ? 'port closed' : 'handshake never completed'}). ${desc}`);
    return { ok: false, error: detail };
  }

  /** Close and forget the session for `ip` (idempotent). */
  async detach(ip: string): Promise<void> {
    const s = this.sessions.get(ip);
    if (!s) return;
    this.sessions.delete(ip);
    try {
      await s.client.destroy(true);
    } catch (e) {
      mainError('[debugger] destroy error:', ip, e instanceof Error ? e.message : String(e));
    }
    this.emit(IPC.DebuggerState, { ip, state: 'disconnected' });
  }

  /** Close every session (called when the Debugger window closes / on quit). */
  async detachAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((ip) => this.detach(ip)));
  }

  // --- Execution control -----------------------------------------------------

  private require(ip: string): DebugProtocolClient {
    const s = this.sessions.get(ip);
    if (!s) throw new Error(`No debug session for ${ip}. Attach first.`);
    return s.client;
  }

  async continue(ip: string): Promise<void> {
    await this.require(ip).continue();
    this.markResumed(ip);
  }
  async pause(ip: string): Promise<void> { await this.require(ip).pause(); }
  // A step RESUMES execution until the next suspend, so — like continue() — mark running
  // (which clears the retained `lastStop` snapshot). Otherwise a wait-for-stop poller
  // reading getStop() would return the pre-step stack/variables before the step lands.
  async stepOver(ip: string, threadIndex?: number): Promise<void> { await this.require(ip).stepOver(threadIndex); this.markResumed(ip); }
  async stepIn(ip: string, threadIndex?: number): Promise<void> { await this.require(ip).stepIn(threadIndex); this.markResumed(ip); }
  async stepOut(ip: string, threadIndex?: number): Promise<void> { await this.require(ip).stepOut(threadIndex); this.markResumed(ip); }

  /** After a continue/step resumes the device, flip to `running` (which nulls `lastStop`). */
  private markResumed(ip: string): void {
    const s = this.sessions.get(ip);
    if (s) this.setState(s, 'running');
  }

  async stackTrace(ip: string, threadIndex?: number): Promise<unknown> {
    // Return the flat entries array (like `variables`) so the renderer's thread-switch
    // refetch reads `res.data` directly instead of digging through the raw envelope.
    return plain(dataArray(await this.require(ip).getStackTrace(threadIndex), 'entries', 'stackFrames'));
  }
  async variables(ip: string, opts: { threadIndex?: number; stackFrameIndex?: number; variablePath?: string[] } = {}): Promise<unknown> {
    // Return the (nested) variables array — for a path fetch this is `[container]`
    // whose `.children` holds the next level (roku-debug always requests child keys).
    return plain(dataArray(await this.require(ip).getVariables(opts.variablePath ?? [], opts.stackFrameIndex, opts.threadIndex), 'variables'));
  }
  async execute(ip: string, sourceCode: string, opts: { threadIndex?: number; stackFrameIndex?: number } = {}): Promise<unknown> {
    return this.require(ip).executeCommand(sourceCode, opts.stackFrameIndex, opts.threadIndex);
  }
  async addBreakpoints(ip: string, breakpoints: unknown): Promise<unknown> {
    const client = this.require(ip);
    const session = this.sessions.get(ip);
    // Cache every requested breakpoint so we can (re)send it while halted. Roku only
    // registers breakpoints added from a STOPPED state — a breakpoint sent while the
    // channel is running is silently NOT honored (the "added breakpoints don't get hit"
    // bug). So we send now only if halted; otherwise it stays queued (sent:false) and
    // flushes at the next stop (entry halt or any later suspend).
    const specs = normalizeBreakpoints(breakpoints);
    if (session) {
      for (const b of specs) {
        const k = bpKey(b.filePath, b.lineNumber);
        const existing = session.breakpoints.get(k);
        if (existing) {
          existing.conditionalExpression = b.conditionalExpression;
          existing.hitCount = b.hitCount;
          existing.sent = false; // re-added (e.g. after a remove) → re-register on next flush
        } else {
          session.breakpoints.set(k, { ...b, sent: false });
        }
      }
    }
    if (!client.halted) {
      // Queued — will register at the next stop. Echo the specs (no ids yet) so the
      // caller sees them as pending rather than failed.
      return specs.map((b) => ({ ...b, pending: true }));
    }
    const entries = session ? specs.map((b) => session.breakpoints.get(bpKey(b.filePath, b.lineNumber))).filter(Boolean) as CachedBreakpoint[] : [];
    // Mark sent BEFORE the await so a concurrent flush (entry grace / stop) doesn't
    // re-send the same specs and double-register them; revert on failure.
    for (const e of entries) e.sent = true;
    let res: unknown;
    try {
      res = await client.addBreakpoints(specs);
    } catch (err) {
      for (const e of entries) e.sent = false;
      throw err;
    }
    this.recordBreakpointIds(session, entries, res);
    // Return just the per-breakpoint results (breakpointId / errorCode, in request
    // order) as plain JSON so the renderer can map ids back to file:line.
    return plain((res as { data?: { breakpoints?: unknown } } | undefined)?.data?.breakpoints ?? res);
  }

  /** Send any not-yet-registered breakpoints to the device WHILE HALTED (best-effort). */
  private async flushBreakpoints(session: DebugSession): Promise<void> {
    if (!session.client.halted) return;
    const pending = [...session.breakpoints.values()].filter((b) => !b.sent);
    if (!pending.length) return;
    for (const b of pending) b.sent = true; // mark before await (race guard); revert on failure
    try {
      const res = await session.client.addBreakpoints(pending.map((b) => ({
        filePath: b.filePath,
        lineNumber: b.lineNumber,
        ...(b.conditionalExpression ? { conditionalExpression: b.conditionalExpression } : {}),
        ...(b.hitCount ? { hitCount: b.hitCount } : {})
      })));
      this.recordBreakpointIds(session, pending, res);
      mainLog(`[debugger] flushed ${pending.length} breakpoint(s) to ${session.ip} while halted`);
    } catch (e) {
      for (const b of pending) b.sent = false; // failed → allow a later retry
      mainError('[debugger] breakpoint flush failed:', session.ip, e instanceof Error ? e.message : String(e));
    }
  }

  /** Map the device's per-breakpoint response (in request order) back to cached entries:
   *  store each `breakpointId` (so it can be removed later) and tell the renderer, keyed by
   *  file:line, so a queued breakpoint that only just registered gets its id + loses "Q". */
  private recordBreakpointIds(session: DebugSession | undefined, entries: CachedBreakpoint[], res: unknown): void {
    if (!session) return;
    const arr = ((res as { data?: { breakpoints?: unknown } } | undefined)?.data?.breakpoints ?? []) as Array<Record<string, unknown>>;
    const registered: Array<{ filePath: string; lineNumber: number; breakpointId: number }> = [];
    entries.forEach((e, i) => {
      const r = Array.isArray(arr) ? arr[i] : undefined;
      if (!r) return;
      const id = Number(r.breakpointId ?? r.breakpoint_id ?? 0);
      if (id > 0) { e.breakpointId = id; registered.push({ filePath: e.filePath, lineNumber: e.lineNumber, breakpointId: id }); }
    });
    if (registered.length) this.emit(IPC.DebuggerBreakpoints, { ip: session.ip, registered });
  }

  /** Remove breakpoints by file:line — prunes the session cache (so flush can't resurrect a
   *  deleted one) AND removes any that have a device id. Location-based because a queued
   *  breakpoint has no device id yet, so an id-only removal path would leak/resurrect it. */
  async removeBreakpointsByLocation(ip: string, locations: Array<{ filePath: string; lineNumber: number }>): Promise<{ removed: number }> {
    const session = this.sessions.get(ip);
    const ids: number[] = [];
    for (const loc of locations || []) {
      if (!loc || !loc.filePath || !loc.lineNumber) continue;
      const k = bpKey(loc.filePath, loc.lineNumber);
      const e = session?.breakpoints.get(k);
      if (e?.breakpointId) ids.push(e.breakpointId);
      session?.breakpoints.delete(k);
    }
    if (ids.length && session) { try { await session.client.removeBreakpoints(ids); } catch { /* best-effort */ } }
    return { removed: ids.length };
  }

  // --- Event wiring ----------------------------------------------------------

  private wireEvents(session: DebugSession): void {
    const { client, ip } = session;

    // Live BrightScript console output over the debug protocol's I/O channel.
    client.on('io-output', (arg) => {
      const text = typeof arg === 'string' ? arg : safeText(arg);
      if (!text) return;
      this.emit(IPC.DebuggerOutput, { ip, text });
    });

    client.on('protocol-version', (arg) => {
      session.protocolVersion = versionString(arg);
      this.emit(IPC.DebuggerState, { ip, state: session.state, protocolVersion: session.protocolVersion });
    });

    // A thread stopped (breakpoint / STOP / step complete). Gather a snapshot.
    client.on('suspend', (arg) => { void this.onSuspend(session, arg); });
    client.on('cannot-continue', () => this.setState(session, 'stopped'));

    client.on('runtime-error', (arg) => {
      // A runtime error IS a stop — the device is halted at the throw site. Surface
      // the error message AND snapshot the crash location's stack + variables so the
      // sidebar can show where it died (previously this only set state, no stack).
      this.emit(IPC.DebuggerRuntimeError, { ip, error: plain(arg), message: stopDetail(arg) });
      void this.emitStopSnapshot(session, arg);
    });
    client.on('compile-error', (arg) => {
      this.emit(IPC.DebuggerCompileErrors, { ip, errors: plain(arg) });
    });

    // Device verified (or errored) breakpoints we sent — async, may arrive after
    // addBreakpoints resolves (e.g. deferred verification in not-yet-loaded code).
    client.on('breakpoints-verified', (arg) => {
      const list = (arg as { breakpoints?: unknown } | undefined)?.breakpoints ?? arg;
      this.emit(IPC.DebuggerBreakpoints, { ip, verified: plain(list) });
    });
    // Device REJECTED a breakpoint (bad path/line, unsupported condition, …). Surface it
    // instead of dropping it — otherwise a breakpoint silently never hits.
    client.on('breakpoint-error', (arg) => {
      this.emit(IPC.DebuggerBreakpoints, { ip, error: plain(arg) });
    });

    const end = (): void => {
      if (this.sessions.get(ip) === session) this.sessions.delete(ip);
      // Tear the client down so the SEPARATE io socket (+ its 'io-output' listener) and
      // the client's timers/listeners are released. Without this, a device-initiated end
      // (channel exit, or a control-socket error while the app is still printing) leaves
      // the io socket live, emitting ghost DebuggerOutput for a session we've marked
      // disconnected — and a later re-attach can't clean it up (detach() early-returns
      // once the session is gone). destroy(true) is idempotent (guards on `ended`).
      void session.client.destroy(true);
      this.emit(IPC.DebuggerState, { ip, state: 'disconnected' });
    };
    client.on('app-exit', end);
    client.on('close', end);
  }

  /** On stop: snapshot threads + top-frame stack + top-frame variables (best-effort). */
  private async onSuspend(session: DebugSession, arg: unknown): Promise<void> {
    // The first suspend is the entry halt (protocol 2.0+ stops on the first
    // statement and waits). Like roku-debug with stopOnEntry off, auto-continue
    // it — otherwise the app hangs at entry and the device closes the debug
    // session (the "connected then disconnected" symptom). The renderer sends
    // breakpoints on `attached`; STOP statements always halt regardless.
    if (!session.entryHandled) {
      session.entryHandled = true;
      // Stay halted at entry briefly so the renderer's initial breakpoint push (fired
      // on the 'attached' state) lands, then FLUSH those breakpoints WHILE STOPPED —
      // the device only reliably registers breakpoints added from a halted state, and
      // this pre-continue entry halt is that window. Then continue.
      try {
        await sleep(ENTRY_BREAKPOINT_GRACE_MS);
        await this.flushBreakpoints(session);
      } catch (e) {
        mainError('[debugger] entry breakpoint flush failed:', session.ip, e instanceof Error ? e.message : String(e));
      }
      this.setState(session, 'running');
      try {
        await session.client.continue();
      } catch (e) {
        mainError('[debugger] entry auto-continue failed:', session.ip, e instanceof Error ? e.message : String(e));
      }
      return;
    }
    await this.emitStopSnapshot(session, arg);
  }

  /**
   * Set `stopped` and emit a full snapshot (threads + top-frame stack + top-frame
   * variables) as `DebuggerStopped`. Shared by a normal suspend and a runtime error
   * (both leave the device halted; the renderer selects a thread/frame from here).
   */
  private async emitStopSnapshot(session: DebugSession, arg: unknown): Promise<void> {
    this.setState(session, 'stopped');
    // Now that we're halted, register any breakpoints queued while running (e.g. ones
    // the user added mid-run) so they take effect from here on.
    await this.flushBreakpoints(session);
    const payload: Record<string, unknown> = { ip: session.ip, reason: stopReason(arg), detail: stopDetail(arg) };
    // The in-house client exposes arrays at `response.data.{threads,entries,variables}`;
    // extract them explicitly so the renderer sees a populated stack/variables list.
    try { payload.threads = plain(dataArray(await session.client.threads(), 'threads')); } catch { /* best-effort */ }
    try { payload.stackFrames = plain(dataArray(await session.client.getStackTrace(), 'entries', 'stackFrames')); } catch { /* best-effort */ }
    try { payload.variables = plain(dataArray(await session.client.getVariables([], 0), 'variables')); } catch { /* best-effort */ }
    session.lastStop = payload; // retain for pollers (MCP bridge wait-for-stop)
    this.emit(IPC.DebuggerStopped, payload);
  }

  // --- read-only views (shared with the MCP bridge) --------------------------

  /** The last retained stop snapshot for `ip` (null if never stopped, or since resumed). */
  getStop(ip: string): Record<string, unknown> | null {
    return this.sessions.get(ip)?.lastStop ?? null;
  }

  /** Client-owned breakpoints for `ip` (cache view): file:line, condition, hit count, device
   *  id, and whether it's registered (`verified`) or still `queued` for the next stop. */
  getBreakpoints(ip: string): Array<Record<string, unknown>> {
    const s = this.sessions.get(ip);
    if (!s) return [];
    return [...s.breakpoints.values()].map((b) => ({
      filePath: b.filePath,
      lineNumber: b.lineNumber,
      ...(b.conditionalExpression ? { conditionalExpression: b.conditionalExpression } : {}),
      ...(b.hitCount ? { hitCount: b.hitCount } : {}),
      verified: b.breakpointId != null,
      queued: !b.sent,
      ...(b.breakpointId != null ? { breakpointId: b.breakpointId } : {})
    }));
  }
}

// --- helpers -----------------------------------------------------------------

/** Resolve after `ms`. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Dedup key for a breakpoint: normalized `path:line`. */
function bpKey(filePath: string, lineNumber: number): string {
  return `${String(filePath).toLowerCase().replace(/\\/g, '/')}:${lineNumber}`;
}

/** Coerce the renderer's breakpoint payload into a clean, validated spec list. */
function normalizeBreakpoints(
  input: unknown
): Array<{ filePath: string; lineNumber: number; conditionalExpression?: string; hitCount?: number }> {
  if (!Array.isArray(input)) return [];
  const out: Array<{ filePath: string; lineNumber: number; conditionalExpression?: string; hitCount?: number }> = [];
  for (const raw of input) {
    const b = raw as { filePath?: unknown; lineNumber?: unknown; conditionalExpression?: unknown; hitCount?: unknown };
    const filePath = typeof b?.filePath === 'string' ? b.filePath : '';
    const lineNumber = Number(b?.lineNumber);
    if (!filePath || !Number.isFinite(lineNumber) || lineNumber <= 0) continue;
    const cond = typeof b.conditionalExpression === 'string' ? b.conditionalExpression.trim() : '';
    const hits = Number(b.hitCount);
    out.push({
      filePath,
      lineNumber,
      ...(cond ? { conditionalExpression: cond } : {}),
      ...(Number.isFinite(hits) && hits > 0 ? { hitCount: hits } : {})
    });
  }
  return out;
}

/** Best-effort "Device: Roku OS <ver>, <model>." so an attach failure is diagnostic, not opaque. */
async function describeDevice(ip: string): Promise<string> {
  try {
    const api = require('roku-dev-studio-api') as {
      testConnection: (ip: string) => Promise<{ success?: boolean; deviceInfo?: Record<string, unknown> }>;
    };
    const res = await api.testConnection(ip);
    const di = (res && res.deviceInfo) || {};
    const ver = String(di.softwareVersion ?? di['software-version'] ?? '') || '?';
    const model = String(di.friendlyModelName ?? di.modelName ?? di.friendlyDeviceName ?? di['model-number'] ?? '');
    return `Device: Roku OS ${ver}${model ? `, ${model}` : ''}.`;
  } catch {
    return '';
  }
}

/** Reject with `label` if `p` hasn't settled within `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

/** Pull the first array found at `resp.data[key]` (roku-debug nests its arrays under `.data`). */
function dataArray(resp: unknown, ...keys: string[]): unknown[] {
  const r = resp as { data?: Record<string, unknown> } | undefined;
  for (const k of keys) {
    const v = r?.data?.[k] ?? (resp as Record<string, unknown> | undefined)?.[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

/** Strip anything non-serializable so the payload survives structured-clone over IPC. */
function plain(value: unknown): unknown {
  try { return JSON.parse(JSON.stringify(value ?? null)); } catch { return null; }
}

function safeText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  const asObj = value as { data?: unknown; output?: unknown; text?: unknown };
  return String(asObj.text ?? asObj.output ?? asObj.data ?? '');
}

function versionString(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  const v = arg as { major?: number; minor?: number; patch?: number; version?: string } | null;
  if (v?.version) return v.version;
  if (v && v.major != null) return `${v.major}.${v.minor ?? 0}.${v.patch ?? 0}`;
  return 'unknown';
}

function stopReason(arg: unknown): string {
  const a = arg as { stopReason?: string; reason?: string; data?: { stopReason?: string } } | null;
  return a?.stopReason ?? a?.reason ?? a?.data?.stopReason ?? 'stopped';
}

/** Human-readable detail for a stop / runtime error (the device's `stop_reason_detail`). */
function stopDetail(arg: unknown): string {
  const a = arg as { stopReasonDetail?: string; detail?: string; data?: { stopReasonDetail?: string } } | null;
  return a?.stopReasonDetail ?? a?.detail ?? a?.data?.stopReasonDetail ?? '';
}

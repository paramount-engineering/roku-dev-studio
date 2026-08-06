/**
 * Debugger sidebar for the Telnet Console panel.
 *
 * Collapsible, resizable Call Stack / Breakpoints / Variables sidebar + an
 * execution-control toolbar, shown in a device's Telnet Console tab while
 * debugging is enabled. Drives a socket debug-protocol session over
 * `window.roku.debugger*` (auto-connects the 8085 console + auto-attaches 8081
 * when the device opted into "Sideload with Debugging").
 *
 * The Breakpoints panel is a UNIFIED, deduped-by-`file:line` view of three
 * sources (Roku never hands us a breakpoint list — it's client-owned):
 *   - scanned  — STOP statements found in the sideloaded .zip source (main scan)
 *   - hit      — locations where the app actually stopped at runtime (+ hit count)
 *   - managed  — breakpoints the user added here; sent via ADD_BREAKPOINTS and
 *                verified/errored by the device. Persisted per device.
 * An entry can carry several sources at once (deduped), each shown as a badge.
 *
 * Returns a cleanup fn for the panel to call on tear-down.
 */
import { S } from '@shared/strings/index.js';
import { showToast } from '../utils/ui.js';
import { setDynamicText } from '../utils/dom.js';
import { getStoredPassword } from '../utils/storage.js';
import { attachInstantTooltips } from '../utils/instant-tooltip.js';
import { attachBackdropClickToClose } from '../utils/modal-backdrop-click.js';
import { deviceKey } from '@shared/platform/device-identity.js';

/**
 * Raw serial for a device panel, read from the `data-serial` attribute (never the localized
 * `.device-serial` display text — that shows the translated "N/A" placeholder when absent, which
 * would otherwise get treated as a real serial).
 */
function resolvePanelSerial(devPanel: Element): string {
  return (devPanel.querySelector('.device-serial')?.getAttribute('data-serial') || '').trim();
}

/** The subset of `window.roku` this sidebar drives directly, dispatched to either the
 *  local or the remote-server debugger session (see `debugApi` below). */
interface DebuggerBridge {
  getSetting(key: string): Promise<{ success?: boolean; value?: unknown }>;
  setSetting(key: string, value: unknown): Promise<unknown>;
  debuggerStatus(ip: string): Promise<{ ok?: boolean; data?: { state?: string } }>;
  debuggerScanStops(ip: string): Promise<{ ok?: boolean; data?: unknown }>;
  debuggerAttach(ip: string): Promise<{ ok?: boolean; error?: string }>;
  debuggerDetach(ip: string): Promise<unknown>;
  keypress(ip: string, key: string): Promise<{ success?: boolean; error?: string }>;
  debuggerContinue(ip: string): Promise<unknown>;
  debuggerPause(ip: string): Promise<unknown>;
  debuggerStepOver(ip: string): Promise<unknown>;
  debuggerStepIn(ip: string): Promise<unknown>;
  debuggerStepOut(ip: string): Promise<unknown>;
  debuggerAddBreakpoints(ip: string, breakpoints: unknown): Promise<{ ok?: boolean; data?: unknown }>;
  debuggerRemoveBreakpointsByLocation(ip: string, locations: Array<{ filePath: string; lineNumber: number }>): Promise<unknown>;
  debuggerStackTrace(ip: string, threadIndex?: number): Promise<{ ok?: boolean; data?: unknown }>;
  debuggerVariables(ip: string, opts: { variablePath?: string[]; stackFrameIndex?: number; threadIndex?: number }): Promise<{ ok?: boolean; data?: unknown }>;
  debuggerExecute(ip: string, sourceCode: string, opts?: { threadIndex?: number; stackFrameIndex?: number }): Promise<{ ok?: boolean; data?: unknown; error?: string }>;
  debuggerRestart(ip: string, password: string): Promise<{ success?: boolean; error?: string; message?: string }>;
  onDebuggerState(cb: (data: unknown) => void): () => void;
  onDebuggerStopped(cb: (data: unknown) => void): () => void;
  onDebuggerBreakpoints(cb: (data: unknown) => void): () => void;
  onDebuggerReattach(cb: (data: unknown) => void): () => void;
  onDebuggerRuntimeError(cb: (data: unknown) => void): () => void;
  onDebuggerCompileErrors(cb: (data: unknown) => void): () => void;
}

/** The `remoteDebugger*`/`remoteKeypress` counterparts — the session runs on the
 *  remote server; these proxy over HTTP but resolve to the same `{ ok, data }` shape. */
interface RemoteDebuggerBridge {
  remoteDebuggerStatus(serverUrl: string, ip: string): Promise<{ ok?: boolean; data?: { state?: string } }>;
  remoteDebuggerAttach(serverUrl: string, ip: string): Promise<{ ok?: boolean; error?: string }>;
  remoteDebuggerDetach(serverUrl: string, ip: string): Promise<unknown>;
  remoteKeypress(serverUrl: string, ip: string, key: string): Promise<{ success?: boolean; error?: string }>;
  remoteDebuggerContinue(serverUrl: string, ip: string): Promise<unknown>;
  remoteDebuggerPause(serverUrl: string, ip: string): Promise<unknown>;
  remoteDebuggerStepOver(serverUrl: string, ip: string): Promise<unknown>;
  remoteDebuggerStepIn(serverUrl: string, ip: string): Promise<unknown>;
  remoteDebuggerStepOut(serverUrl: string, ip: string): Promise<unknown>;
  remoteDebuggerAddBreakpoints(serverUrl: string, ip: string, breakpoints: unknown): Promise<{ ok?: boolean; data?: unknown }>;
  remoteDebuggerRemoveBreakpointsByLocation(serverUrl: string, ip: string, locations: Array<{ filePath: string; lineNumber: number }>): Promise<unknown>;
  remoteDebuggerStackTrace(serverUrl: string, ip: string, threadIndex?: number): Promise<{ ok?: boolean; data?: unknown }>;
  remoteDebuggerVariables(serverUrl: string, ip: string, opts: { variablePath?: string[]; stackFrameIndex?: number; threadIndex?: number }): Promise<{ ok?: boolean; data?: unknown }>;
  remoteDebuggerExecute(serverUrl: string, ip: string, sourceCode: string, opts?: { threadIndex?: number; stackFrameIndex?: number }): Promise<{ ok?: boolean; data?: unknown; error?: string }>;
  remoteDebuggerRestart(serverUrl: string, ip: string, password: string): Promise<{ success?: boolean; error?: string; message?: string }>;
}

/** The request/action subset of `DebuggerBridge` that gets dispatched locally or
 *  remotely — excludes the `onDebugger*` event subscriptions, which are never
 *  branched (both a local and a remote session push through the same channels,
 *  tagged) and stay directly on `roku`. */
type DebuggerActions = Omit<
  DebuggerBridge,
  'onDebuggerState' | 'onDebuggerStopped' | 'onDebuggerBreakpoints' | 'onDebuggerReattach' | 'onDebuggerRuntimeError' | 'onDebuggerCompileErrors'
>;

type SessionState = 'idle' | 'connecting' | 'attached' | 'running' | 'stopped' | 'error' | 'disconnected';

interface SidebarOpts {
  /** Called once when debugging is enabled, so the panel can auto-connect the 8085 console. */
  autoConnectConsole?: () => void;
  /** When set, the debug session runs on this remote RDS server, not the Electron host. */
  isRemote?: boolean;
  serverUrl?: string | null;
  /** False when a remote device's server reports `capabilities.debugger === false` (see
   *  createApiAdapter in app.ts). Disables the toggle button and skips all wiring instead of
   *  attempting a session the server has no debug-protocol route for. Always true/undefined
   *  for local devices. */
  debuggerSupported?: boolean;
}

/**
 * REPL handle the console panel uses to power the input bar it slides up under the
 * console output. The sidebar owns the debug session (state + selected thread/frame);
 * the console owns the input UI.
 */
export interface ReplController {
  /** True while halted (the REPL can evaluate only when stopped at a frame). */
  isStopped(): boolean;
  /** Evaluate BrightScript in the selected frame; print output streams via io-output. */
  execute(source: string): Promise<{ ok: boolean; errors: string[] }>;
  /** Subscribe to stopped/running transitions so the bar can slide in/out. Returns an unsubscribe. */
  onAvailabilityChange(cb: (stopped: boolean) => void): () => void;
}

export interface DebugSidebarHandle {
  cleanup: () => void;
  repl: ReplController;
}

interface BpEntry {
  path: string;
  line: number;
  function?: string;
  scanned: boolean;
  hit: boolean;
  managed: boolean;
  hitCount: number;
  verified?: boolean;
  error?: string;
  breakpointId?: number;
  /** Sent while the app was running → queued by main; registers at the next stop. */
  queued?: boolean;
  /** Optional conditional-breakpoint expression (protocol >=3.1.0 / Roku OS 11.5+). */
  condition?: string;
}

const DEBUG_SIDELOAD_KEY = 'sideload-debug-ips';
const BREAKPOINTS_KEY = 'debug-breakpoints';
const WATCHES_KEY = 'debug-watches';
const NOOP_HANDLE: DebugSidebarHandle = {
  cleanup: (): void => undefined,
  repl: { isStopped: () => false, execute: async () => ({ ok: false, errors: [] }), onAvailabilityChange: () => () => undefined }
};

export function setupTelnetDebugSidebar(panel: HTMLElement, ip: string, opts: SidebarOpts = {}): DebugSidebarHandle {
  const roku = (window as unknown as { roku?: DebuggerBridge & RemoteDebuggerBridge }).roku;
  const sidebar = panel.querySelector<HTMLElement>('[data-telnet-debug-sidebar]');
  const toggleBtn = panel.querySelector<HTMLButtonElement>('[data-telnet-debug-toggle]');
  if (!roku || !sidebar || !toggleBtn) return NOOP_HANDLE;

  if (opts.debuggerSupported === false) {
    toggleBtn.disabled = true;
    toggleBtn.title = S.debugger.unsupportedByServerTitle;
    sidebar.hidden = true;
    return NOOP_HANDLE;
  }

  const serverUrl = opts.isRemote ? (opts.serverUrl ?? null) : null;
  const isRemote = !!(opts.isRemote && serverUrl);

  // Dispatches every debugger action to the local controller or the remote server's,
  // keeping every call site below unchanged (`debugApi.debuggerAttach(ip)`, etc.) —
  // same shape as `createApiAdapter()` in app.ts. `debuggerScanStops` has no remote
  // route (it reads the local sideload .zip, identical either way) and `getSetting`/
  // `setSetting` are plain Electron settings, so both stay on `roku` directly.
  const debugApi: DebuggerActions = isRemote
    ? {
        getSetting: (k) => roku.getSetting(k),
        setSetting: (k, v) => roku.setSetting(k, v),
        debuggerScanStops: (i) => roku.debuggerScanStops(i),
        debuggerStatus: (i) => roku.remoteDebuggerStatus(serverUrl!, i),
        debuggerAttach: (i) => roku.remoteDebuggerAttach(serverUrl!, i),
        debuggerDetach: (i) => roku.remoteDebuggerDetach(serverUrl!, i),
        keypress: (i, key) => roku.remoteKeypress(serverUrl!, i, key),
        debuggerContinue: (i) => roku.remoteDebuggerContinue(serverUrl!, i),
        debuggerPause: (i) => roku.remoteDebuggerPause(serverUrl!, i),
        debuggerStepOver: (i) => roku.remoteDebuggerStepOver(serverUrl!, i),
        debuggerStepIn: (i) => roku.remoteDebuggerStepIn(serverUrl!, i),
        debuggerStepOut: (i) => roku.remoteDebuggerStepOut(serverUrl!, i),
        debuggerAddBreakpoints: (i, bps2) => roku.remoteDebuggerAddBreakpoints(serverUrl!, i, bps2),
        debuggerRemoveBreakpointsByLocation: (i, locs) => roku.remoteDebuggerRemoveBreakpointsByLocation(serverUrl!, i, locs),
        debuggerStackTrace: (i, ti) => roku.remoteDebuggerStackTrace(serverUrl!, i, ti),
        debuggerVariables: (i, vOpts) => roku.remoteDebuggerVariables(serverUrl!, i, vOpts),
        debuggerExecute: (i, src, eOpts) => roku.remoteDebuggerExecute(serverUrl!, i, src, eOpts),
        debuggerRestart: (i, pwd) => roku.remoteDebuggerRestart(serverUrl!, i, pwd)
      }
    : roku;

  /** True if a debugger push event's origin tag matches this sidebar's (local vs. this
   *  specific remote server) — same filtering shape as the Network Inspector tab controllers. */
  const originMatches = (d: { isRemote?: boolean; serverUrl?: string }): boolean =>
    !!d.isRemote === isRemote && (!isRemote || d.serverUrl === serverUrl);

  // Persisted per-device state (breakpoints, watches) is keyed by serial, not IP — IP isn't
  // stable across networks/DHCP, so an IP-keyed entry would silently orphan on a network change.
  // Recomputed on each persist/load (not cached) since the panel can be re-rendered.
  const resolveKey = (): string => {
    const devPanel = panel.closest('.device-panel') || panel.querySelector('.device-panel') || panel;
    return deviceKey({ serial: resolvePanelSerial(devPanel), ip });
  };

  const q = <T extends HTMLElement>(sel: string): T | null => panel.querySelector<T>(sel);
  const callStackBody = q<HTMLElement>('[data-debug-body="callstack"]');
  const breakpointsBody = q<HTMLElement>('[data-debug-body="breakpoints"]');
  const variablesBody = q<HTMLElement>('[data-debug-body="variables"]');
  const toolbar = q<HTMLElement>('[data-debug-toolbar]');
  const statusDot = q<HTMLElement>('[data-debug-status]');
  const statusText = q<HTMLElement>('[data-debug-statustext]');
  const whyBtn = q<HTMLButtonElement>('[data-debug-why]');
  const attachBtn = q<HTMLButtonElement>('[data-debug-cmd="attach"]');
  const continueBtn = q<HTMLButtonElement>('[data-debug-cmd="continue"]');
  const pauseBtn = q<HTMLButtonElement>('[data-debug-cmd="pause"]');
  const stepBtns = ['stepOver', 'stepIn', 'stepOut'].map((c) => q<HTMLButtonElement>(`[data-debug-cmd="${c}"]`));
  const bpAddBtn = q<HTMLButtonElement>('[data-debug-bp-add]');
  const bpAddRow = q<HTMLElement>('[data-debug-bp-addrow]');
  const bpInput = q<HTMLInputElement>('[data-debug-bp-input]');
  const bpCondInput = q<HTMLInputElement>('[data-debug-bp-cond]');
  const bpSubmitBtn = q<HTMLButtonElement>('[data-debug-bp-submit]');
  const watchBody = q<HTMLElement>('[data-debug-body="watch"]');
  const watchAddBtn = q<HTMLButtonElement>('[data-debug-watch-add]');
  const watchAddRow = q<HTMLElement>('[data-debug-watch-addrow]');
  const watchInput = q<HTMLInputElement>('[data-debug-watch-input]');
  const watchSubmitBtn = q<HTMLButtonElement>('[data-debug-watch-submit]');

  let prefEnabled = false;
  let sessionActive = false;
  let collapsed = false;
  let didAutoStart = false;
  let state: SessionState = 'idle';
  let lastError = '';
  // Where we last halted ("fn — file:line"); shown on the status-dot tooltip on a clean stop.
  let lastStopLoc = '';
  // When set, the breakpoint add-row is editing this existing managed breakpoint (its
  // `path:line` key) rather than creating a new one — submit replaces it.
  let editingKey: string | null = null;
  // Guards against a double-submit re-entering the edit flow mid-await (which could
  // re-add a breakpoint before the old one's async removal completes).
  let bpSubmitting = false;
  const bps = new Map<string, BpEntry>();
  // Variables are grouped by call-stack frame: each frame index → its top-level
  // vars (frame 0 arrives with the stop; deeper frames lazy-load when expanded).
  // `expandedVars`/`varChildCache` keys are frame-namespaced (see VarScope) so the
  // same variable name in two frames never collides. `collapsedFrames` holds the
  // folded groups (default: everything but the active frame).
  const frameVars = new Map<number, unknown[]>();
  const collapsedFrames = new Set<number>();
  const expandedVars = new Set<string>();
  const varChildCache = new Map<string, unknown[]>();
  // Call-stack + threads (from the last stop) and the user's current selection.
  let lastThreads: unknown[] = [];
  let lastFrames: unknown[] = [];
  let selectedThread = 0;
  let selectedFrame = 0;
  // Watch expressions and their last-evaluated values (re-eval'd on each stop).
  const watches: string[] = [];
  const watchResults = new Map<string, unknown>();
  // REPL availability subscribers (the console panel's input bar).
  const replListeners = new Set<(stopped: boolean) => void>();

  const isAttached = (): boolean => state === 'attached' || state === 'running' || state === 'stopped';

  /** Unwrap a `{ ok, data }` debugger IPC envelope to its data array (empty on any miss). */
  const okArray = <T = unknown>(res: { ok?: boolean; data?: unknown } | null | undefined): T[] =>
    res && res.ok && Array.isArray(res.data) ? (res.data as T[]) : [];

  /** A small "copy location" control: copies `pkg:/…:line` to the clipboard (pragmatic
   *  jump-to-source — paste into your editor). Stops propagation so it doesn't also select. */
  const makeCopyLocBtn = (text: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'telnet-debug-copyloc';
    b.textContent = '⧉';
    b.title = S.common.copy;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      void navigator.clipboard?.writeText(text).then(
        () => { try { showToast(S.common.copied, 'success'); } catch { /* best-effort */ } },
        () => { /* clipboard denied — best-effort */ }
      );
    });
    return b;
  };

  const updateVisibility = (): void => {
    const enabled = prefEnabled || sessionActive; // debugger enabled for this device
    const connected = isAttached();                // attached / running / stopped
    // Button: hidden only when debugging isn't enabled. It stays CLICKABLE whether or
    // not connected so the sidebar can always be closed (a disconnect must never trap
    // it open). Connection state is shown inside the sidebar (status line + Attach).
    toggleBtn.hidden = !enabled;
    sidebar.hidden = !enabled || collapsed;
    const open = enabled && !collapsed;
    toggleBtn.setAttribute('aria-pressed', String(open));
    toggleBtn.classList.toggle('telnet-debug-toggle--active', open);
    toggleBtn.classList.toggle('telnet-debug-toggle--offline', enabled && !connected);
  };

  // Full remediation for the current attach error (shown on demand via the "Why?" button /
  // the status-line hover tooltip); empty when the last status wasn't an attach failure.
  let attachErrorDetail = '';
  // Close fn for a currently-open attach-error modal (appended to document.body, outside the
  // sidebar subtree). Tracked so cleanup() can dismiss it — otherwise closing the tab while
  // it's open orphans the overlay + leaks its document keydown listener for the window's life.
  let closeAttachErrorModal: (() => void) | null = null;
  // The status is a compact tone dot in the toolbar; it carries NO text — the full status
  // (e.g. "Running — set a STOP / breakpoint to inspect.") reads out via its hover tooltip.
  const setStatus = (label: string, tone = '', full?: string): void => {
    // Compact status label beside Attach, so state is glanceable without hovering the dot.
    if (statusText) statusText.textContent = label;
    if (!statusDot) return;
    if (tone) statusDot.dataset.tone = tone;
    else statusDot.removeAttribute('data-tone');
    statusDot.title = full || label || '';
    statusDot.removeAttribute('data-tip'); // let the shared tooltip re-adopt the fresh title
    // A plain status supersedes a prior attach-error detail (drops the click-to-open affordance + Why?).
    attachErrorDetail = '';
    statusDot.classList.remove('telnet-debug-statusdot--clickable');
    whyBtn?.setAttribute('hidden', '');
  };

  /** Show an attach failure compactly: the tone dot goes red with the full remediation on its
   *  hover tooltip; clicking the dot opens the detail modal. */
  const setAttachError = (summary: string, detail?: string): void => {
    setStatus(summary, 'error', detail);
    if (!detail) return;
    attachErrorDetail = detail;
    statusDot?.classList.add('telnet-debug-statusdot--clickable');
    whyBtn?.removeAttribute('hidden'); // surface an explicit "Why?" — clicking the dot alone isn't discoverable
  };

  const openAttachErrorModal = (detail: string): void => {
    closeAttachErrorModal?.(); // never stack two; also releases the prior listener
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay telnet-debug-why-overlay active';
    overlay.innerHTML = `
      <div class="telnet-debug-why-modal" role="dialog" aria-modal="true" aria-label="${S.debugger.attachErrorTitle}">
        <div class="telnet-debug-why-header">
          <h3 class="telnet-debug-why-title">${S.debugger.attachErrorTitle}</h3>
          <button type="button" class="modal-close telnet-debug-why-close" title="${S.common.close}" aria-label="${S.common.close}"><span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span></button>
        </div>
        <div class="telnet-debug-why-body"></div>
      </div>`;
    document.body.appendChild(overlay);
    const bodyEl = overlay.querySelector('.telnet-debug-why-body') as HTMLElement;
    bodyEl.textContent = detail; // plain text; the controller builds a multi-sentence remediation
    const close = (): void => { overlay.remove(); document.removeEventListener('keydown', onKey); closeAttachErrorModal = null; };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
    closeAttachErrorModal = close;
    document.addEventListener('keydown', onKey);
    attachBackdropClickToClose(overlay, close);
    overlay.querySelector('.telnet-debug-why-close')?.addEventListener('click', close);
  };
  const onStatusClick = (): void => { if (attachErrorDetail) openAttachErrorModal(attachErrorDetail); };
  statusDot?.addEventListener('click', onStatusClick);
  whyBtn?.addEventListener('click', onStatusClick);

  const updateControls = (): void => {
    const attached = isAttached() || state === 'connecting';
    if (attachBtn) {
      // Stamp I18N_DYNAMIC_ATTR via setDynamicText so a live-locale-switch applyI18n pass
      // doesn't revert this data-i18n button back to "Attach" while it's showing "Detach"
      // (the label would then contradict dataset.debugCmd, which drives the click).
      setDynamicText(attachBtn, attached ? S.debugger.detach : S.debugger.attach);
      attachBtn.dataset.debugCmd = attached ? 'detach' : 'attach';
    }
    if (continueBtn) {
      continueBtn.disabled = state !== 'stopped';
      continueBtn.classList.toggle('telnet-debug-btn--go', state === 'stopped'); // emphasize resume while halted
    }
    if (pauseBtn) pauseBtn.disabled = !(state === 'running' || state === 'attached');
    for (const b of stepBtns) if (b) b.disabled = state !== 'stopped';
    switch (state) {
      case 'connecting': setStatus(S.debugger.status.connecting, 'connecting'); break;
      case 'attached': setStatus(S.debugger.status.attached, 'attached'); break;
      // Full "Running — set a STOP / breakpoint to inspect." rides on the dot's tooltip.
      case 'running': setStatus(S.debugger.status.running, 'running', S.debugger.waitingForStop); break;
      // A runtime/compile error surfaces here (error tone) with the message on the tooltip.
      // On a clean stop the dot's tooltip carries where we halted (fn — file:line).
      case 'stopped': setStatus(lastError ? S.debugger.status.error : S.debugger.status.stopped, lastError ? 'error' : 'stopped', lastError || lastStopLoc || undefined); break;
      case 'error': break; // message set by the error event
      case 'disconnected': setStatus(S.debugger.status.disconnected); break;
      default: setStatus(S.debugger.status.idle);
    }
    // Tell the console's REPL bar whether it can evaluate (only while stopped).
    for (const cb of replListeners) cb(state === 'stopped');
  };

  // --- breakpoint store ------------------------------------------------------
  const keyOf = (path: string, line: number): string => `${path.toLowerCase().replace(/\\/g, '/')}:${line}`;
  const upsert = (path: string, line: number): BpEntry => {
    const k = keyOf(path, line);
    let e = bps.get(k);
    if (!e) {
      e = { path, line, scanned: false, hit: false, managed: false, hitCount: 0 };
      bps.set(k, e);
    }
    return e;
  };
  const managedList = (): BpEntry[] => [...bps.values()].filter((e) => e.managed);

  const renderBreakpoints = (): void => {
    if (!breakpointsBody) return;
    const entries = [...bps.values()].sort((a, b) => (a.path === b.path ? a.line - b.line : a.path.localeCompare(b.path)));
    if (!entries.length) return renderEmpty(breakpointsBody, S.debugger.breakpointsEmpty);
    const rows = entries.map((e) => buildBpRow(e));
    breakpointsBody.replaceChildren(...rows);
  };

  const buildBpRow = (e: BpEntry): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'telnet-debug-bp-row';
    const addBadge = (mod: string, text: string, title: string): void => {
      const b = document.createElement('span');
      b.className = `telnet-debug-bp-badge telnet-debug-bp-badge--${mod}`;
      b.textContent = text;
      b.title = title;
      row.appendChild(b);
    };
    if (e.managed) addBadge('managed', 'M', S.debugger.bpSourceManaged);
    if (e.scanned) addBadge('scanned', 'S', S.debugger.bpSourceScanned);
    if (e.hit) addBadge('hit', 'H', S.debugger.bpSourceHit);
    if (e.condition) addBadge('cond', 'C', `${S.debugger.bpConditional}: ${e.condition}`);
    if (e.queued && !e.verified) addBadge('cond', 'Q', S.debugger.bpQueuedUntilStop);
    if (e.verified) addBadge('verified', '✓', S.debugger.bpVerified);
    if (e.error) addBadge('error', '!', e.error || S.debugger.bpInvalid);

    const loc = document.createElement('span');
    loc.className = 'telnet-debug-bp-loc';
    loc.textContent = e.path.replace(/^pkg:\//i, '') + ':' + e.line;
    loc.title = e.path + ':' + e.line;
    if (e.function) {
      const fn = document.createElement('span');
      fn.className = 'telnet-debug-bp-fn';
      fn.textContent = '  ' + e.function;
      loc.appendChild(fn);
    }
    row.appendChild(loc);

    if (e.hitCount > 0) {
      const hits = document.createElement('span');
      hits.className = 'telnet-debug-bp-hits';
      hits.textContent = `×${e.hitCount}`;
      row.appendChild(hits);
    }
    if (e.managed) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'telnet-debug-bp-edit';
      edit.textContent = '✎';
      edit.title = S.debugger.editBreakpoint;
      edit.addEventListener('click', () => startEditManaged(e));
      row.appendChild(edit);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'telnet-debug-bp-remove';
      rm.textContent = '×';
      rm.title = S.debugger.removeBreakpoint;
      rm.addEventListener('click', () => void removeManaged(e));
      row.appendChild(rm);
    }
    row.appendChild(makeCopyLocBtn(`${e.path}:${e.line}`));
    return row;
  };

  /** Load a managed breakpoint into the add-row for editing (submit replaces it). */
  const startEditManaged = (e: BpEntry): void => {
    editingKey = keyOf(e.path, e.line);
    if (bpInput) bpInput.value = `${e.path}:${e.line}`;
    if (bpCondInput) bpCondInput.value = e.condition || '';
    showBpAdd(true);
  };

  // Per-device settings (breakpoints, watches) are stored as one map keyed by device key
  // (serial, else IP). These two helpers own the unwrap + the device-key-vs-legacy-IP
  // fallback + dropping the stale IP-keyed entry, so every persist/load is a one-liner.
  const readKeyedSetting = async <T>(settingKey: string): Promise<T[]> => {
    try {
      const res = await roku.getSetting(settingKey);
      const all = (res && res.success && res.value && typeof res.value === 'object' ? res.value : {}) as Record<string, unknown>;
      const key = resolveKey();
      // Prefer the device-key entry; fall back to the pre-migration IP-keyed one.
      const raw = Array.isArray(all[key]) ? all[key] : Array.isArray(all[ip]) ? all[ip] : [];
      return raw as T[];
    } catch {
      return [];
    }
  };
  const writeKeyedSetting = async (settingKey: string, value: unknown[]): Promise<void> => {
    try {
      const res = await roku.getSetting(settingKey);
      const all = (res && res.success && res.value && typeof res.value === 'object' ? res.value : {}) as Record<string, unknown>;
      const key = resolveKey();
      all[key] = value;
      if (key !== ip) delete all[ip]; // drop the pre-migration IP-keyed entry once we can save under the real key
      await roku.setSetting(settingKey, all);
    } catch {
      /* best-effort persistence */
    }
  };

  const persistManaged = async (): Promise<void> => {
    await writeKeyedSetting(BREAKPOINTS_KEY, managedList().map((e) => ({ path: e.path, line: e.line, ...(e.condition ? { condition: e.condition } : {}) })));
  };

  /** Send managed breakpoints that haven't been acknowledged yet; map ids/errors back. */
  const sendManaged = async (only?: BpEntry): Promise<void> => {
    if (!isAttached()) return;
    const toSend = (only ? [only] : managedList()).filter((e) => e.breakpointId == null);
    if (!toSend.length) return;
    try {
      const res = await debugApi.debuggerAddBreakpoints(
        ip,
        toSend.map((e) => ({ filePath: e.path, lineNumber: e.line, ...(e.condition ? { conditionalExpression: e.condition } : {}) }))
      );
      const arr = okArray<Record<string, unknown>>(res);
      toSend.forEach((e, i) => {
        const r = arr[i];
        if (!r) return;
        // Sent while the app was running → the device only registers breakpoints while
        // stopped, so main queued it. Show it as pending (not verified, not an error);
        // it flushes at the next stop. Don't mark an id so it re-sends if needed.
        if (r.pending) { e.queued = true; e.verified = false; e.error = undefined; return; }
        e.queued = false;
        const id = Number(r.breakpointId ?? r.breakpoint_id ?? 0);
        const errCode = Number(r.errorCode ?? r.error_code ?? 0);
        if (id > 0) { e.breakpointId = id; e.verified = true; e.error = undefined; }
        else e.error = errCode ? `err ${errCode}` : S.debugger.bpInvalid;
      });
      renderBreakpoints();
    } catch {
      /* leave unsent; will retry on next attach */
    }
  };

  const addManaged = (path: string, line: number, condition?: string): void => {
    const e = upsert(path, line);
    e.managed = true;
    if (condition) e.condition = condition;
    renderBreakpoints();
    void persistManaged();
    void sendManaged(e);
  };

  const removeManaged = async (e: BpEntry): Promise<void> => {
    e.managed = false;
    e.breakpointId = undefined;
    e.verified = undefined;
    e.queued = false;
    // Remove by LOCATION (not id): a breakpoint added while running has no device id yet
    // but IS cached in the main process — location removal prunes that cache so it can't
    // resurrect at the next stop, and removes the device breakpoint if it was registered.
    if (isAttached()) {
      try { await debugApi.debuggerRemoveBreakpointsByLocation(ip, [{ filePath: e.path, lineNumber: e.line }]); } catch { /* ignore */ }
    }
    if (!e.scanned && !e.hit) bps.delete(keyOf(e.path, e.line));
    renderBreakpoints();
    void persistManaged();
  };

  const loadScanned = async (): Promise<void> => {
    try {
      const res = await debugApi.debuggerScanStops(ip);
      const stops = okArray<{ path?: string; line?: number }>(res);
      for (const s of stops) {
        if (s.path && s.line) upsert(s.path, s.line).scanned = true;
      }
      renderBreakpoints();
    } catch {
      /* no scan available */
    }
  };

  const loadManaged = async (): Promise<void> => {
    const list = await readKeyedSetting<{ path?: string; line?: number; condition?: string }>(BREAKPOINTS_KEY);
    for (const b of list) {
      if (b.path && b.line) {
        const e = upsert(b.path, b.line);
        e.managed = true;
        if (b.condition) e.condition = b.condition;
      }
    }
    renderBreakpoints();
  };

  // --- variable tree ---------------------------------------------------------
  const isContainerVar = (v: unknown): boolean => {
    const o = v as { isContainer?: boolean; childCount?: number; children?: unknown[] } | null;
    // Rely on the wire `isContainer` flag / a positive childCount. Do NOT treat an EMPTY
    // `children` array as a container: the protocol decoder sets `children: []` on every
    // directly-fetched (root) variable — incl. scalars like a watched String — so an
    // empty array here means "no children", not "is a container" (the "String {0}" bug).
    return !!(o && (o.isContainer || (typeof o.childCount === 'number' && o.childCount > 0) || (Array.isArray(o.children) && o.children.length > 0)));
  };
  const varCount = (v: unknown): number | undefined => {
    const o = v as { childCount?: number; children?: unknown[] } | null;
    if (o && typeof o.childCount === 'number') return o.childCount;
    if (o && Array.isArray(o.children)) return o.children.length;
    return undefined;
  };
  const varChildren = (v: unknown, key: string): unknown[] | undefined => {
    const o = v as { children?: unknown } | null;
    if (o && Array.isArray(o.children)) return o.children;
    return varChildCache.get(key);
  };

  // A rendering scope for a variable sub-tree: which stack frame it queries, and a
  // key prefix that namespaces its expansion/cache entries (a frame group vs a watch),
  // so the same variable name in two frames never collides.
  interface VarScope { keyPrefix: string; frameIndex: number; }

  /** Per-node overrides so a watch root reuses `renderVarRow` (its own label/class, an
   *  "unavailable" placeholder when the value is missing, and a trailing remove button). */
  interface VarRowOpts { label?: string; nameClass?: string; unavailable?: string; trailing?: HTMLElement; }

  /** Fetch a frame's top-level variables on demand (frame 0 comes free with the stop). */
  const loadFrameVars = async (fi: number): Promise<void> => {
    try {
      const res = await debugApi.debuggerVariables(ip, { variablePath: [], stackFrameIndex: fi, threadIndex: selectedThread });
      frameVars.set(fi, okArray(res));
    } catch {
      frameVars.set(fi, []);
    }
  };

  const toggleFrameGroup = async (fi: number): Promise<void> => {
    if (collapsedFrames.has(fi)) {
      collapsedFrames.delete(fi);
      if (!frameVars.has(fi)) { renderVariables(); await loadFrameVars(fi); } // loading note, then fill
    } else {
      collapsedFrames.add(fi);
    }
    renderVariables();
  };

  /** A frame/thread's display fields: function name, pkg-stripped file, line (each may be ''). */
  const frameInfo = (x: unknown): { fn: string; file: string; line: string } => ({
    fn: pick(x, 'functionName', 'function', 'name'),
    file: pick(x, 'filePath', 'fileName', 'file', 'path').replace(/^pkg:\//i, ''),
    line: pick(x, 'lineNumber', 'line')
  });

  const buildFrameGroup = (f: unknown, fi: number): HTMLElement => {
    const header = document.createElement('div');
    header.className = 'telnet-debug-row telnet-debug-var-group';
    header.dataset.frameGroup = String(fi);
    if (fi === selectedFrame) header.classList.add('telnet-debug-var-group--active');
    header.style.cursor = 'pointer';
    const tw = document.createElement('span');
    tw.className = 'telnet-debug-twisty';
    tw.textContent = collapsedFrames.has(fi) ? '▸' : '▾';
    header.appendChild(tw);
    const fnEl = document.createElement('span');
    fnEl.className = 'telnet-debug-var-group-fn';
    const { fn, file, line } = frameInfo(f);
    fnEl.textContent = fn || S.debugger.frameN(fi);
    header.appendChild(fnEl);
    if (file || line) {
      const loc = document.createElement('span');
      loc.className = 'telnet-debug-var-group-loc';
      loc.textContent = `  ${file}${line ? `:${line}` : ''}`;
      header.appendChild(loc);
    }
    header.addEventListener('click', () => void toggleFrameGroup(fi));
    return header;
  };

  const groupNote = (text: string): void => {
    if (!variablesBody) return;
    const d = document.createElement('div');
    d.className = 'telnet-debug-empty';
    d.style.paddingLeft = '16px';
    d.textContent = text;
    variablesBody.appendChild(d);
  };

  // Render EVERY frame's variables as a collapsible group (grouped by call stack).
  // The active frame (top by default) is expanded; deeper frames fold until opened,
  // and each lazy-loads its own locals on first expand.
  const renderVariables = (): void => {
    if (!variablesBody) return;
    if (!lastFrames.length) { renderEmpty(variablesBody, S.debugger.variablesEmpty); return; }
    variablesBody.replaceChildren();
    lastFrames.forEach((f, fi) => {
      variablesBody.appendChild(buildFrameGroup(f, fi));
      if (collapsedFrames.has(fi)) return;
      const vars = frameVars.get(fi);
      if (vars === undefined) { groupNote(S.common.loading); return; }
      if (!vars.length) { groupNote(S.debugger.variablesEmpty); return; }
      const scope: VarScope = { keyPrefix: `f${fi}:`, frameIndex: fi };
      for (const v of vars) renderVarRow(variablesBody, v, 1, [pick(v, 'name', 'key')], scope, renderVariables);
    });
  };

  const renderVarRow = (parent: HTMLElement, v: unknown, depth: number, path: string[], scope: VarScope, rerender: () => void, opts: VarRowOpts = {}): void => {
    const key = scope.keyPrefix + path.join('');
    const container = v != null && isContainerVar(v);
    const row = document.createElement('div');
    row.className = 'telnet-debug-row';
    row.style.paddingLeft = `${depth * 12 + 4}px`;
    const tw = document.createElement('span');
    tw.className = container ? 'telnet-debug-twisty' : 'telnet-debug-twisty-empty';
    if (container) tw.textContent = expandedVars.has(key) ? '▾' : '▸';
    row.appendChild(tw);
    const nameEl = document.createElement('span');
    nameEl.className = opts.nameClass || 'telnet-debug-var-name';
    nameEl.textContent = opts.label ?? (pick(v, 'name', 'key') || S.debugger.anonVar);
    row.appendChild(nameEl);
    const type = pick(v, 'variableType', 'type');
    if (v == null && opts.unavailable) {
      const valEl = document.createElement('span');
      valEl.className = 'telnet-debug-var-type';
      valEl.textContent = `: ${opts.unavailable}`;
      row.appendChild(valEl);
    } else if (container) {
      const cnt = varCount(v);
      const valEl = document.createElement('span');
      valEl.className = 'telnet-debug-var-type';
      valEl.textContent = `: ${type || S.debugger.containerType}${cnt != null ? ` {${cnt}}` : ''}`;
      row.appendChild(valEl);
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => void toggleVar(v, path, key, scope, rerender));
    } else {
      // Scalar: show the value, plus the type in parens so an empty/uninitialized value
      // still reads clearly (e.g. "(Uninitialized)"); an em-dash when there's neither.
      const value = pick(v, 'value');
      row.appendChild(document.createTextNode(`: ${value || (type ? '' : '—')}`));
      if (type) {
        const typeEl = document.createElement('span');
        typeEl.className = 'telnet-debug-var-type';
        typeEl.textContent = `  (${type})`;
        row.appendChild(typeEl);
      }
    }
    if (opts.trailing) row.appendChild(opts.trailing);
    parent.appendChild(row);
    if (container && expandedVars.has(key)) {
      const kids = varChildren(v, key);
      if (kids) for (const c of kids) renderVarRow(parent, c, depth + 1, [...path, pick(c, 'name', 'key')], scope, rerender);
    }
  };

  const toggleVar = async (v: unknown, path: string[], key: string, scope: VarScope, rerender: () => void): Promise<void> => {
    if (expandedVars.has(key)) {
      expandedVars.delete(key);
      rerender();
      return;
    }
    // Children already present (one level came with the stop / a prior fetch)?
    if (!varChildren(v, key)) {
      try {
        const res = await debugApi.debuggerVariables(ip, { variablePath: path, stackFrameIndex: scope.frameIndex, threadIndex: selectedThread });
        const arr = okArray(res);
        const first = arr[0] as { children?: unknown } | undefined;
        varChildCache.set(key, first && Array.isArray(first.children) ? (first.children as unknown[]) : arr);
      } catch {
        varChildCache.set(key, []);
      }
    }
    expandedVars.add(key);
    rerender();
  };

  // --- call stack + threads + frame selection --------------------------------
  // Unified Call Stack: an optional thread list (when >1 thread) with the primary highlighted +
  // badged and the selected one active, then the frames of the selected thread (default = the
  // primary/stopped thread, whose stack the on-stop snapshot already carries).
  const renderCallStack = (): void => {
    if (!callStackBody) return;
    if (!lastFrames.length && lastThreads.length <= 1) { renderEmpty(callStackBody, S.debugger.callStackEmpty); return; }
    callStackBody.replaceChildren();

    // Render the (selected thread's) call-stack frames; `nested` indents them so they read as
    // belonging to the thread row directly above.
    const appendFrames = (nested: boolean): void => {
      if (!lastFrames.length) {
        const note = document.createElement('div');
        note.className = nested ? 'telnet-debug-empty telnet-debug-frame-nested' : 'telnet-debug-empty';
        note.textContent = S.debugger.callStackEmpty;
        callStackBody.appendChild(note);
        return;
      }
      lastFrames.forEach((f, i) => {
        const { fn: fnRaw, file, line } = frameInfo(f);
        const fn = fnRaw || S.debugger.frameN(i);
        const fullPath = pick(f, 'filePath', 'fileName', 'file', 'path');
        const fullLoc = `${fullPath}${line ? `:${line}` : ''}`;
        const row = document.createElement('div');
        row.className = 'telnet-debug-row telnet-debug-row--frame';
        if (nested) row.classList.add('telnet-debug-frame-nested');
        if (i === selectedFrame) row.classList.add('telnet-debug-row--selected');
        // Fixed-width index gutter (#0 = top/current), mirroring the thread rows' numbering.
        const num = document.createElement('span');
        num.className = 'telnet-debug-frame-num';
        num.textContent = `#${i}`;
        row.appendChild(num);
        const fnEl = document.createElement('span');
        fnEl.className = 'telnet-debug-fn';
        fnEl.textContent = fn;
        row.appendChild(fnEl);
        if (file || line) {
          const loc = document.createElement('span');
          loc.className = 'telnet-debug-loc';
          loc.textContent = `  ${file}${line ? `:${line}` : ''}`;
          if (fullPath) loc.title = fullLoc; // full pkg path on hover (via .rds-tip) — disambiguates same-name files
          row.appendChild(loc);
        }
        row.addEventListener('click', () => void selectFrame(i));
        if (fullPath) row.appendChild(makeCopyLocBtn(fullLoc));
        callStackBody.appendChild(row);
      });
    };

    if (lastThreads.length > 1) {
      lastThreads.forEach((t, i) => {
        const { fn: fnRaw, file, line } = frameInfo(t);
        const fn = fnRaw || S.debugger.threadN(i);
        const isPrimary = !!(t as { isPrimary?: boolean })?.isPrimary;
        const row = document.createElement('div');
        row.className = 'telnet-debug-thread-row';
        if (i === selectedThread) row.classList.add('telnet-debug-thread-row--active');
        if (isPrimary) row.classList.add('telnet-debug-thread-row--primary');
        const num = document.createElement('span');
        num.className = 'telnet-debug-thread-num';
        num.textContent = `#${i}`;
        row.appendChild(num);
        const fnEl = document.createElement('span');
        fnEl.className = 'telnet-debug-fn';
        fnEl.textContent = fn;
        row.appendChild(fnEl);
        if (file || line) {
          const loc = document.createElement('span');
          loc.className = 'telnet-debug-loc';
          loc.textContent = `  ${file}${line ? `:${line}` : ''}`;
          row.appendChild(loc);
        }
        if (isPrimary) {
          const badge = document.createElement('span');
          badge.className = 'telnet-debug-thread-badge';
          badge.textContent = S.debugger.threadPrimary;
          row.appendChild(badge);
        }
        row.addEventListener('click', () => void selectThread(i));
        callStackBody.appendChild(row);
        // The selected thread's call stack renders DIRECTLY beneath its row (indented).
        if (i === selectedThread) appendFrames(true);
      });
    } else {
      appendFrames(false);
    }
  };

  // NOTE: display frame index maps directly to the protocol stackFrameIndex — matches
  // the controller's on-stop `getVariables([], 0)` default. If a device reports the
  // STACKTRACE order reversed vs the VARIABLES index, other-frame locals would mirror;
  // frame 0 (the common case) stays correct. Revisit with on-device verification.
  //
  // Variables are shown for ALL frames at once (grouped). Selecting a call-stack frame
  // just focuses it for the REPL/watch scope and expands + scrolls to its group — the
  // other groups stay visible.
  const selectFrame = async (i: number): Promise<void> => {
    if (state !== 'stopped') return;
    selectedFrame = i;
    collapsedFrames.delete(i);
    renderCallStack();
    if (!frameVars.has(i)) { renderVariables(); await loadFrameVars(i); }
    renderVariables();
    variablesBody?.querySelector<HTMLElement>(`[data-frame-group="${i}"]`)?.scrollIntoView({ block: 'nearest' });
    void evalAllWatches();
  };

  const selectThread = async (i: number): Promise<void> => {
    if (state !== 'stopped') return;
    selectedThread = i;
    selectedFrame = 0;
    expandedVars.clear();
    varChildCache.clear();
    frameVars.clear();
    try {
      const st = await debugApi.debuggerStackTrace(ip, i);
      lastFrames = okArray(st);
    } catch { lastFrames = []; }
    collapsedFrames.clear();
    for (let f = 1; f < lastFrames.length; f++) collapsedFrames.add(f);
    renderCallStack();
    await loadFrameVars(0);
    renderVariables();
    void evalAllWatches();
  };

  // --- watches ---------------------------------------------------------------
  const parseWatchPath = (expr: string): string[] => {
    const tokens: string[] = [];
    const re = /\.?([A-Za-z_][\w$]*)|\[\s*"([^"]*)"\s*\]|\[\s*(\d+)\s*\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(expr))) {
      if (m[1] != null) tokens.push(m[1]);
      else if (m[2] != null) tokens.push('"' + m[2] + '"'); // quoted → case-sensitive key
      else if (m[3] != null) tokens.push(m[3]); // array index
    }
    return tokens;
  };
  const persistWatches = async (): Promise<void> => {
    await writeKeyedSetting(WATCHES_KEY, [...watches]);
  };
  const loadWatches = async (): Promise<void> => {
    const list = await readKeyedSetting<unknown>(WATCHES_KEY);
    for (const e of list) if (typeof e === 'string' && e.trim() && !watches.includes(e)) watches.push(e);
    renderWatches();
  };
  const evalWatch = async (expr: string): Promise<void> => {
    if (state !== 'stopped') return;
    const path = parseWatchPath(expr);
    if (!path.length) { watchResults.set(expr, null); return; }
    try {
      const res = await debugApi.debuggerVariables(ip, { variablePath: path, stackFrameIndex: selectedFrame, threadIndex: selectedThread });
      const arr = res && res.ok && Array.isArray(res.data) ? (res.data as unknown[]) : [];
      watchResults.set(expr, arr[0] ?? null);
    } catch { watchResults.set(expr, null); }
  };
  const evalAllWatches = async (): Promise<void> => {
    if (!watches.length) { renderWatches(); return; }
    for (const w of watches) await evalWatch(w);
    renderWatches();
  };
  const removeWatch = (expr: string): void => {
    const i = watches.indexOf(expr);
    if (i >= 0) watches.splice(i, 1);
    watchResults.delete(expr);
    void persistWatches();
    renderWatches();
  };
  /** Load a watch back into the add-row for editing (remove it, then submit re-adds). Parity
   *  with the breakpoint edit affordance. */
  const startEditWatch = (expr: string): void => {
    removeWatch(expr);
    if (watchInput) watchInput.value = expr;
    showWatchAdd(true);
  };
  const renderWatches = (): void => {
    if (!watchBody) return;
    if (!watches.length) { renderEmpty(watchBody, S.debugger.watchEmpty); return; }
    watchBody.replaceChildren();
    for (const expr of watches) {
      const v = watchResults.get(expr) ?? null; // null → "unavailable" (not evaluated / out of scope)
      // Watch sub-trees evaluate in the active frame; namespaced away from frame groups.
      const scope: VarScope = { keyPrefix: `watch:${expr}:`, frameIndex: selectedFrame };
      const actions = document.createElement('span');
      actions.className = 'telnet-debug-watch-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'telnet-debug-watch-edit';
      edit.textContent = '✎';
      edit.title = S.debugger.editWatch;
      edit.addEventListener('click', (e) => { e.stopPropagation(); startEditWatch(expr); });
      actions.appendChild(edit);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'telnet-debug-watch-remove';
      rm.textContent = '×';
      rm.title = S.debugger.removeWatch;
      rm.addEventListener('click', (e) => { e.stopPropagation(); removeWatch(expr); });
      actions.appendChild(rm);
      // Reuse the variable-row renderer: the watch expr is the root label, its parsed path
      // drives drill-in, and the edit/remove buttons ride along as the trailing controls.
      renderVarRow(watchBody, v, 0, parseWatchPath(expr), scope, renderWatches, {
        label: expr,
        nameClass: 'telnet-debug-watch-expr',
        unavailable: S.debugger.watchUnavailable,
        trailing: actions
      });
    }
  };

  // --- restart ---------------------------------------------------------------
  // Resolve the dev password from the Dev App tab in the same device panel: the live
  // input first, then the password the user Saved (Remember) for this device's serial.
  // The saved-by-serial fallback is what makes Restart work when the input is empty
  // (e.g. panel re-rendered, or the password was only ever persisted, never re-typed).
  const resolveDevPassword = (): string => {
    // `.device-panel` may be an ancestor OR a descendant of this sidebar's panel
    // depending on how the device tab was cloned — handle both, then the panel itself.
    const devPanel = panel.closest('.device-panel') || panel.querySelector('.device-panel') || panel;
    const fromInput = (devPanel.querySelector<HTMLInputElement>('.dev-password')?.value || '').trim();
    if (fromInput) return fromInput;
    const serial = resolvePanelSerial(devPanel);
    try {
      return serial ? getStoredPassword(serial).trim() : '';
    } catch {
      return '';
    }
  };
  const doRestart = async (): Promise<void> => {
    const pwd = resolveDevPassword();
    if (!pwd) {
      // No path forward from the message alone — make the toast jump to the fix: open the
      // Dev App tab and focus the password field.
      try {
        showToast(S.debugger.restartNoPassword, 'warning', () => {
          (panel.querySelector('.inner-tab[data-inner-tab="devapp"]') as HTMLElement | null)?.click();
          (panel.querySelector('.dev-password') as HTMLInputElement | null)?.focus();
        });
      } catch { /* best-effort */ }
      return;
    }
    setStatus(S.debugger.restarting, 'connecting');
    try {
      const res = await debugApi.debuggerRestart(ip, pwd);
      if (res && res.success === false) setStatus(S.debugger.status.error, 'error', res.error || S.debugger.attachFailed(''));
      // On success the main process fires DebuggerReattach → the sidebar reattaches.
    } catch (e) {
      setStatus(S.debugger.status.error, 'error', e instanceof Error ? e.message : String(e));
    }
  };

  // Initial empty states.
  if (callStackBody) renderEmpty(callStackBody, S.debugger.callStackEmpty);
  if (breakpointsBody) renderEmpty(breakpointsBody, S.debugger.breakpointsEmpty);
  if (variablesBody) renderEmpty(variablesBody, S.debugger.variablesEmpty);
  if (watchBody) renderEmpty(watchBody, S.debugger.watchEmpty);

  // --- collapse toggle -------------------------------------------------------
  const onToggle = (): void => {
    collapsed = !collapsed;
    updateVisibility();
  };
  toggleBtn.addEventListener('click', onToggle);

  // --- execution controls ----------------------------------------------------
  // Every attach here is a REAL one (manual button, post-sideload reattach, or a
  // sync when a session already exists) — the console-open speculative 8081 probe was
  // removed, so an attach failure always surfaces the full remediation.
  const doAttach = async (): Promise<void> => {
    setStatus(S.debugger.status.connecting, 'connecting');
    try {
      await debugApi.debuggerAttach(ip);
      // On failure the controller emits a DebuggerState 'error' carrying a compact summary
      // + full remediation, rendered by the state handler; we don't set the long error
      // here (it would clobber the summary and get clipped).
    } catch (e) {
      setStatus(S.debugger.status.error, 'error', e instanceof Error ? e.message : String(e));
    }
  };
  /** Detach and collapse the sidebar — a disconnect must never leave it stuck open. */
  const doDetach = async (): Promise<void> => {
    try { await debugApi.debuggerDetach(ip); } catch { /* best-effort */ }
    collapsed = true;
    updateVisibility();
  };
  /** Detach, send the Home key to exit the channel on-device, and collapse the sidebar. */
  const doStop = async (): Promise<void> => {
    try { await debugApi.debuggerDetach(ip); } catch { /* best-effort */ }
    try { await debugApi.keypress(ip, 'Home'); } catch { /* best-effort */ }
    collapsed = true;
    updateVisibility();
  };
  const onToolbarClick = (e: MouseEvent): void => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-debug-cmd]');
    if (!btn || btn.hasAttribute('disabled')) return;
    switch (btn.dataset.debugCmd) {
      case 'attach': void doAttach(); break;
      case 'detach': void doDetach(); break;
      case 'stop': void doStop(); break;
      case 'restart': void doRestart(); break;
      case 'continue': void debugApi.debuggerContinue(ip); break;
      case 'pause': void debugApi.debuggerPause(ip); break;
      case 'stepOver': void debugApi.debuggerStepOver(ip); break;
      case 'stepIn': void debugApi.debuggerStepIn(ip); break;
      case 'stepOut': void debugApi.debuggerStepOut(ip); break;
    }
  };
  toolbar?.addEventListener('click', onToolbarClick);

  // --- add-row toggles (breakpoint / watch) ----------------------------------
  // The + button flips to × while its add-row is open, so a second click clearly
  // CLOSES the row (the affordance reads as a toggle, not "add another").
  const setAddBtn = (btn: HTMLButtonElement | null, open: boolean, closedLabel: string): void => {
    if (!btn) return;
    btn.textContent = open ? '×' : '+';
    btn.classList.toggle('telnet-debug-bp-add--open', open);
    btn.setAttribute('aria-expanded', String(open));
    const label = open ? S.common.close : closedLabel;
    btn.title = label;
    btn.setAttribute('aria-label', label);
  };
  const showBpAdd = (open: boolean): void => {
    if (!bpAddRow) return;
    if (open) ensureSectionForAddRow('breakpoints'); // reveal the row even if collapsed/tiny
    bpAddRow.hidden = !open;
    setAddBtn(bpAddBtn, open, S.debugger.addBreakpoint);
    if (open) bpInput?.focus();
    else editingKey = null; // closing (cancel/submit-done) clears any edit-in-progress
  };
  const showWatchAdd = (open: boolean): void => {
    if (!watchAddRow) return;
    if (open) ensureSectionForAddRow('watch');
    watchAddRow.hidden = !open;
    setAddBtn(watchAddBtn, open, S.debugger.addWatch);
    if (open) watchInput?.focus();
  };

  // --- breakpoint add UI -----------------------------------------------------
  const onBpAddToggle = (): void => showBpAdd(!!bpAddRow?.hidden);
  const submitBpInput = async (): Promise<void> => {
    if (bpSubmitting) return; // ignore a re-entrant submit while an edit's removal is in flight
    const raw = (bpInput?.value || '').trim();
    if (!raw) { bpInput?.focus(); return; }
    // A breakpoint needs "path:line" — the LAST colon splits location from line number
    // (so the `pkg:` scheme colon isn't mistaken for it). Missing/invalid line → tell
    // the user instead of silently doing nothing.
    const idx = raw.lastIndexOf(':');
    let path = idx > 0 ? raw.slice(0, idx).trim() : '';
    const line = idx > 0 ? parseInt(raw.slice(idx + 1).trim(), 10) : NaN;
    if (!path || !Number.isFinite(line) || line <= 0) {
      try { showToast(S.debugger.bpNeedsLine, 'warning'); } catch { /* best-effort */ }
      bpInput?.focus();
      return;
    }
    if (!/^(pkg|lib):\//i.test(path)) path = 'pkg:/' + path.replace(/^\/+/, '');
    const condition = (bpCondInput?.value || '').trim();
    // Conditions need protocol >=3.1.0 (Roku OS 11.5+). We don't pre-check the version
    // here: the main-process client is authoritative — if it can't honor the condition it
    // registers the breakpoint unconditionally and emits a 'condition-unsupported' warning
    // (handled in onDebuggerBreakpoints), which also covers the running/queued case.
    bpSubmitting = true;
    try {
      // Editing an existing managed breakpoint → fully remove the old one (device + local)
      // before re-adding, so a moved location or changed condition replaces cleanly.
      if (editingKey) {
        const old = bps.get(editingKey);
        editingKey = null;
        if (old) await removeManaged(old);
      }
      addManaged(path, line, condition || undefined);
    } finally {
      bpSubmitting = false;
    }
    // Breakpoints only register while the app is halted; if it's running, main queues
    // it until the next stop — tell the user so it doesn't seem broken.
    if (state === 'running') { try { showToast(S.debugger.bpQueuedUntilStop, 'info'); } catch { /* best-effort */ } }
    if (bpInput) bpInput.value = '';
    if (bpCondInput) bpCondInput.value = '';
    showBpAdd(false);
  };
  bpAddBtn?.addEventListener('click', onBpAddToggle);
  bpSubmitBtn?.addEventListener('click', submitBpInput);
  const onBpKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') void submitBpInput();
    else if (e.key === 'Escape') showBpAdd(false);
  };
  bpInput?.addEventListener('keydown', onBpKey);
  bpCondInput?.addEventListener('keydown', onBpKey);

  // --- watch add UI ----------------------------------------------------------
  const onWatchAddToggle = (): void => showWatchAdd(!!watchAddRow?.hidden);
  const submitWatchInput = (): void => {
    const expr = (watchInput?.value || '').trim();
    if (!expr) return;
    if (!watches.includes(expr)) {
      watches.push(expr);
      void persistWatches();
      void evalWatch(expr);
    }
    renderWatches();
    if (watchInput) watchInput.value = '';
    showWatchAdd(false);
  };
  watchAddBtn?.addEventListener('click', onWatchAddToggle);
  watchSubmitBtn?.addEventListener('click', submitWatchInput);
  const onWatchKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') submitWatchInput();
    else if (e.key === 'Escape') showWatchAdd(false);
  };
  watchInput?.addEventListener('keydown', onWatchKey);

  // --- resize: width + section heights ---------------------------------------
  const disposers: Array<() => void> = [];

  // Instant tooltips across the sidebar (badges + toolbar icons) — shared app-wide util.
  disposers.push(attachInstantTooltips(sidebar));
  const widthHandle = q<HTMLElement>('[data-debug-resize]');
  if (widthHandle) {
    disposers.push(makeResizer(widthHandle, () => sidebar.offsetWidth, (start, dx) => {
      sidebar.style.width = `${clamp(start + dx, 180, 620)}px`; // handle on right edge → drag right widens
    }, undefined, () => { sidebar.style.width = ''; })); // double-click → back to the default width
  }
  // Per-section collapse + vertical resize (accordion). The chevron toggles collapse;
  // the section HEADER is a resize handle that sizes the section ABOVE it (like a
  // divider between the two). The BOTTOM-most expanded section always grows to fill,
  // so collapsed headers pack to the bottom and there are never gaps — and that filler
  // can't be pushed out of view (a min keeps it >= MIN_BODY_PX).
  const SECTION_KEYS = ['callstack', 'breakpoints', 'watch', 'variables'] as const;
  const MIN_BODY_PX = 90; // matches the CSS min-height on the expanded Variables filler
  const DEFAULT_BASIS: Record<string, number> = { callstack: 150, breakpoints: 130, watch: 110, variables: 160 };
  const collapsedSections = new Set<string>();
  const basisPx = new Map<string, number>(Object.entries(DEFAULT_BASIS));
  const sectionEl = (k: string): HTMLElement | null => q<HTMLElement>(`[data-debug-section="${k}"]`);
  const isCollapsed = (k: string): boolean => collapsedSections.has(k);
  /** Bottom-most expanded section — it grows to fill (the accordion filler). */
  const bottomExpanded = (): string | undefined => [...SECTION_KEYS].reverse().find((k) => !isCollapsed(k));
  /** Nearest expanded section ABOVE `key` (the one a header-drag on `key` resizes). */
  const prevExpanded = (key: string): string | undefined => {
    const i = SECTION_KEYS.indexOf(key as (typeof SECTION_KEYS)[number]);
    for (let j = i - 1; j >= 0; j--) if (!isCollapsed(SECTION_KEYS[j])) return SECTION_KEYS[j];
    return undefined;
  };
  const applySectionLayout = (): void => {
    const grower = bottomExpanded();
    for (const k of SECTION_KEYS) {
      const sec = sectionEl(k);
      if (!sec) continue;
      if (isCollapsed(k)) sec.style.flex = '0 0 auto';
      else if (k === grower) sec.style.flex = '1 1 0';
      else sec.style.flex = `0 1 ${basisPx.get(k) ?? 120}px`; // shrinkable so the filler never clips
      // A header resizes the section above it — show the ns-resize cursor only when a
      // drag would actually do something (there's an expanded section above that ISN'T
      // the filler; the drag no-ops otherwise).
      const above = prevExpanded(k);
      const header = q<HTMLElement>(`[data-debug-section-header="${k}"]`);
      if (header) header.classList.toggle('telnet-debug-section-header--resizable', !!above && above !== grower);
    }
    // Everything collapsed → no filler; pin the header stack to the bottom (no top gap).
    const first = sectionEl(SECTION_KEYS[0]);
    if (first) first.style.marginTop = grower ? '' : 'auto';
  };
  const setCollapsed = (key: string, collapsed: boolean): void => {
    const chevron = q<HTMLElement>(`[data-debug-collapse="${key}"]`);
    if (collapsed) collapsedSections.add(key); else collapsedSections.delete(key);
    sectionEl(key)?.classList.toggle('telnet-debug-section--collapsed', collapsed);
    if (chevron) {
      chevron.textContent = collapsed ? '▸' : '▾';
      const label = collapsed ? S.common.expand : S.common.collapse;
      chevron.title = label;
      chevron.setAttribute('aria-label', label);
    }
    applySectionLayout();
  };
  /** Pressing + on a collapsed / too-short section should reveal its add-row: expand the
   *  section if collapsed, and grow it to at least fit header + inputs + button. */
  const ensureSectionForAddRow = (key: string): void => {
    if (isCollapsed(key)) setCollapsed(key, false);
    if (key === bottomExpanded()) return; // the filler already fills, so the add-row fits
    const MIN_ADDROW_PX = 160; // header + two inputs + Add button + a sliver of list
    if ((basisPx.get(key) ?? 0) < MIN_ADDROW_PX) {
      basisPx.set(key, MIN_ADDROW_PX);
      applySectionLayout();
    }
  };
  applySectionLayout();
  for (const key of SECTION_KEYS) {
    const chevron = q<HTMLElement>(`[data-debug-collapse="${key}"]`);
    if (!chevron) continue;
    const onChevron = (e: MouseEvent): void => { e.stopPropagation(); setCollapsed(key, !isCollapsed(key)); };
    chevron.addEventListener('click', onChevron);
    disposers.push(() => chevron.removeEventListener('click', onChevron));
  }
  // Ignore drags that begin on a button / input / select inside the header or add-row.
  const notOnControl = (t: EventTarget | null): boolean =>
    t instanceof HTMLElement && !!t.closest('button, input, select, .telnet-debug-bp-addrow');
  for (const key of SECTION_KEYS) {
    const header = q<HTMLElement>(`[data-debug-section-header="${key}"]`);
    if (!header) continue;
    // Dragging `key`'s header resizes the expanded section ABOVE it; the filler absorbs.
    disposers.push(makeResizer(
      header,
      () => { const p = prevExpanded(key); return p ? (sectionEl(p)?.offsetHeight ?? 0) : 0; },
      (start, _dx, dy) => {
        const prev = prevExpanded(key);
        const grower = bottomExpanded();
        if (!prev || prev === grower) return; // nothing above, or above IS the filler
        const growerEl = grower ? sectionEl(grower) : null;
        const prevEl = sectionEl(prev);
        const pool = (prevEl?.offsetHeight ?? 0) + (growerEl?.offsetHeight ?? 0); // the two that trade
        const next = clamp(start + dy, 34, Math.max(34, pool - MIN_BODY_PX));
        basisPx.set(prev, next);
        applySectionLayout();
      },
      notOnControl,
      // Double-click a section header → reset every section height to its default.
      () => { for (const k of SECTION_KEYS) basisPx.set(k, DEFAULT_BASIS[k]); applySectionLayout(); }
    ));
  }

  // --- live data -------------------------------------------------------------
  // Call Stack + Variables only carry data while halted; keep them collapsed until a stop
  // so the not-attached / running sidebar isn't four headers over empty panes. Breakpoints
  // + Watch stay expanded (they're actionable before a stop). Only re-runs on a change, so
  // it doesn't fight a manual toggle within the same stopped/running phase.
  let sectionsShowStopped: boolean | null = null;
  const syncSectionsForState = (stopped: boolean): void => {
    if (sectionsShowStopped === stopped) return;
    sectionsShowStopped = stopped;
    setCollapsed('callstack', !stopped);
    setCollapsed('variables', !stopped);
  };
  syncSectionsForState(false);

  let wasAttached = false;
  const stateUnsub = roku.onDebuggerState((data) => {
    const d = (data ?? {}) as { ip?: string; state?: SessionState; message?: string; detail?: string; protocolVersion?: string; isRemote?: boolean; serverUrl?: string };
    if (d.ip && d.ip !== ip) return;
    if (!originMatches(d)) return;
    if (!d.state) return;
    state = d.state;
    sessionActive = d.state !== 'disconnected';
    syncSectionsForState(d.state === 'stopped');
    // Show the compact summary + the full remediation on demand (status-dot click / tooltip).
    if (d.state === 'error' && d.message) setAttachError(d.message, d.detail);
    // Running (continue / step) → the last stop's stack + variables are now stale; clear
    // them so nothing misleading lingers until the next stop repopulates.
    if (d.state === 'running') {
      // Continuing/stepping → the last stop's data is stale; clear it (and any error).
      lastError = '';
      lastStopLoc = '';
      frameVars.clear();
      collapsedFrames.clear();
      lastFrames = [];
      lastThreads = [];
      selectedFrame = 0;
      expandedVars.clear();
      varChildCache.clear();
      watchResults.clear();
      if (callStackBody) renderEmpty(callStackBody, S.debugger.waitingForStop);
      if (variablesBody) renderEmpty(variablesBody, S.debugger.waitingForStop);
      renderWatches();
    }
    // On (re)attach, refresh the scanned STOPs and push managed breakpoints.
    if (isAttached() && !wasAttached) { void loadScanned(); void sendManaged(); }
    wasAttached = isAttached();
    updateControls();
    updateVisibility();
  });

  const stoppedUnsub = roku.onDebuggerStopped((data) => {
    const d = (data ?? {}) as { ip?: string; stackFrames?: unknown; variables?: unknown; threads?: unknown; isRemote?: boolean; serverUrl?: string };
    if (d.ip && d.ip !== ip) return;
    if (!originMatches(d)) return;
    state = 'stopped';
    syncSectionsForState(true); // reveal Call Stack + Variables now that they have data
    if (collapsed) { collapsed = false; updateVisibility(); } // auto-open on halt so the data is visible
    lastFrames = asArray(d.stackFrames, 'stackFrames', 'entries', 'frames');
    lastThreads = asArray(d.threads, 'threads');
    // Default to the primary (stopped) thread and its top frame.
    const pi = lastThreads.findIndex((t) => !!(t as { isPrimary?: boolean })?.isPrimary);
    selectedThread = pi >= 0 ? pi : 0;
    selectedFrame = 0;
    renderCallStack();
    // Fresh stop → rebuild the per-frame variable groups. Frame 0's locals arrive with
    // the stop; deeper frames lazy-load when opened. Show the top (stopped/crash) frame
    // expanded and the rest folded.
    frameVars.clear();
    frameVars.set(0, asArray(d.variables, 'variables', 'children'));
    collapsedFrames.clear();
    for (let i = 1; i < lastFrames.length; i++) collapsedFrames.add(i);
    expandedVars.clear();
    varChildCache.clear();
    renderVariables();
    void evalAllWatches();
    // Main flushes queued breakpoints while halted — they're registered now, so drop
    // the pending 'Q' badge.
    for (const e of bps.values()) if (e.queued) e.queued = false;
    // Record the stop location as a "hit" breakpoint (deduped with scanned/managed).
    const top = lastFrames[0];
    const path = pick(top, 'filePath', 'fileName', 'file', 'path');
    const line = parseInt(pick(top, 'lineNumber', 'line'), 10);
    if (path && Number.isFinite(line) && line > 0) {
      const e = upsert(path, line);
      e.hit = true;
      e.hitCount += 1;
      const fn = pick(top, 'functionName', 'function', 'name');
      if (fn) e.function = fn;
      // Where we halted, for the status-dot tooltip (e.g. "renderScene() — main.brs:42").
      lastStopLoc = `${fn ? `${fn} — ` : ''}${path.replace(/^pkg:\//i, '')}:${line}`;
    }
    renderBreakpoints();
    updateControls();
  });

  const bpUnsub = roku.onDebuggerBreakpoints((data) => {
    const d = (data ?? {}) as { ip?: string; verified?: unknown; error?: unknown; registered?: unknown; isRemote?: boolean; serverUrl?: string };
    if (d.ip && d.ip !== ip) return;
    if (!originMatches(d)) return;
    // Main registered these on the device (incl. ones that were queued while running) —
    // record the device id by file:line so removal works, and clear the "Q" pending badge.
    if (d.registered) {
      let changed = false;
      for (const r of asArray(d.registered)) {
        const rp = pick(r, 'filePath');
        const rl = parseInt(pick(r, 'lineNumber'), 10);
        const rid = Number(pick(r, 'breakpointId') || 0);
        if (!rp || !Number.isFinite(rl) || !rid) continue;
        const e = bps.get(keyOf(rp, rl));
        if (e) { e.breakpointId = rid; e.queued = false; e.error = undefined; changed = true; }
      }
      if (changed) renderBreakpoints();
      return;
    }
    // The device's protocol (<3.1.0) can't honor a breakpoint condition — the client
    // registered it UNCONDITIONALLY and told us so. Warn (it's not a hard rejection): the
    // breakpoint still works, it just halts on every hit rather than only when true.
    if (d.error && (d.error as { reason?: string }).reason === 'condition-unsupported') {
      try { showToast(S.debugger.bpConditionRequiresOs, 'warning'); } catch { /* best-effort */ }
      return;
    }
    // Device REJECTED a breakpoint (bad path/line, unsupported condition, …). Surface it
    // so the user knows why it never hits instead of it silently failing.
    if (d.error) {
      const err = d.error as { compileErrors?: unknown; runtimeErrors?: unknown; otherErrors?: unknown };
      const msgs = [err.compileErrors, err.runtimeErrors, err.otherErrors]
        .flatMap((a) => (Array.isArray(a) ? a : []))
        .filter((x): x is string => typeof x === 'string' && !!x);
      try { showToast(S.debugger.bpRejected(msgs.join('; ')), 'error'); } catch { /* best-effort */ }
      return;
    }
    const verified = asArray(d.verified);
    let changed = false;
    for (const v of verified) {
      const id = Number(pick(v, 'breakpointId', 'breakpoint_id') || 0);
      if (!id) continue;
      for (const e of bps.values()) {
        if (e.breakpointId === id) { e.verified = true; e.queued = false; e.error = undefined; changed = true; }
      }
    }
    if (changed) renderBreakpoints();
  });

  // Runtime error: the device is halted at the throw site. Surface the message; the
  // stack + variables arrive via DebuggerStopped (the controller snapshots on error).
  const runtimeErrUnsub = roku.onDebuggerRuntimeError((data) => {
    const d = (data ?? {}) as { ip?: string; message?: string; error?: unknown; isRemote?: boolean; serverUrl?: string };
    if (d.ip && d.ip !== ip) return;
    if (!originMatches(d)) return;
    const msg = d.message || pick(d.error, 'stopReasonDetail', 'detail', 'reason');
    lastError = S.debugger.runtimeError(msg);
    try { showToast(lastError, 'error'); } catch { /* best-effort */ }
    if (state === 'stopped') updateControls();
  });

  // Compile error: the build failed to load — surface it prominently.
  const compileErrUnsub = roku.onDebuggerCompileErrors((data) => {
    const d = (data ?? {}) as { ip?: string; errors?: unknown; isRemote?: boolean; serverUrl?: string };
    if (d.ip && d.ip !== ip) return;
    if (!originMatches(d)) return;
    const first = asArray(d.errors, 'errors')[0] ?? d.errors;
    const msg = pick(first, 'errorMessage', 'message') || (typeof d.errors === 'string' ? d.errors : '');
    lastError = `${S.debugger.compileErrorTitle}${msg ? `: ${msg}` : ''}`;
    try { showToast(lastError, 'error'); } catch { /* best-effort */ }
    setStatus(S.debugger.status.error, 'error', lastError);
  });

  // Main fires this after ANY sideload (normal or relay) to a debug-enabled device,
  // so the sidebar reattaches to the fresh run (the device just reopened 8081).
  const reattachUnsub = roku.onDebuggerReattach((data) => {
    const d = (data ?? {}) as { ip?: string; discovered?: number; isRemote?: boolean; serverUrl?: string };
    if (d.ip && d.ip !== ip) return;
    if (!originMatches(d)) return;
    prefEnabled = true;
    didAutoStart = true;
    updateVisibility();
    // Toast when the build's STOP breakpoints were discovered (debugger auto-enabled).
    if (typeof d.discovered === 'number' && d.discovered > 0) {
      try { showToast(S.debugger.discoveredToast(d.discovered), 'info'); } catch { /* toast best-effort */ }
    }
    opts.autoConnectConsole?.();
    void loadScanned();
    void doAttach();
  });

  // --- auto-start when debugging is enabled ----------------------------------
  // On panel/console open we connect the 8085 console but do NOT speculatively
  // attach 8081: the channel running right now is often NOT a debug launch (its
  // 8081 is closed), so a probe here just fails and spams the log with a misleading
  // "attach gave up" every time the console opens. The real attach fires on the
  // post-sideload reattach (below) — exactly when 8081 is freshly open — or when the
  // user clicks Attach. If a debug session already exists, reflect it; else idle.
  const maybeAutoStart = async (): Promise<void> => {
    if (didAutoStart || !prefEnabled) return;
    didAutoStart = true;
    opts.autoConnectConsole?.();
    try {
      const st = await debugApi.debuggerStatus(ip);
      const cur = st?.data?.state;
      if (cur && cur !== 'disconnected') void doAttach(); // already debugging → sync UI
      else setStatus(S.debugger.status.idle);
    } catch {
      setStatus(S.debugger.status.idle);
    }
  };

  void (async () => {
    try {
      const res = await roku.getSetting(DEBUG_SIDELOAD_KEY);
      const ips = res && res.success && Array.isArray(res.value) ? (res.value as string[]) : [];
      prefEnabled = ips.includes(resolveKey()) || ips.includes(ip);
    } catch { /* default off */ }
    updateVisibility();
    await loadManaged();
    await loadScanned();
    await loadWatches();
    void maybeAutoStart();
  })();
  updateControls();
  updateVisibility();

  // REPL handle for the console panel's slide-up input bar. Evaluates in the
  // selected thread/frame; `print` output streams back via the debug io-output.
  const repl: ReplController = {
    isStopped: () => state === 'stopped',
    execute: async (source: string) => {
      const res = await debugApi.debuggerExecute(ip, source, { threadIndex: selectedThread, stackFrameIndex: selectedFrame });
      const outer = (res && res.ok ? res.data : null) as { data?: unknown } | unknown[] | null;
      // controller.execute returns the raw protocol result → { data: { compileErrors, … } }.
      const inner = (outer && typeof outer === 'object' && !Array.isArray(outer) && 'data' in outer
        ? (outer as { data?: unknown }).data
        : outer) as Record<string, unknown> | null;
      const errors: string[] = [];
      if (inner && typeof inner === 'object') {
        for (const k of ['compileErrors', 'runtimeErrors', 'otherErrors']) {
          const a = (inner as Record<string, unknown>)[k];
          if (Array.isArray(a)) for (const e of a) if (typeof e === 'string' && e) errors.push(e);
        }
      }
      return { ok: !!(res && res.ok), errors };
    },
    onAvailabilityChange: (cb) => {
      replListeners.add(cb);
      cb(state === 'stopped');
      return () => replListeners.delete(cb);
    }
  };

  const cleanup = (): void => {
    toggleBtn.removeEventListener('click', onToggle);
    toolbar?.removeEventListener('click', onToolbarClick);
    bpAddBtn?.removeEventListener('click', onBpAddToggle);
    bpSubmitBtn?.removeEventListener('click', submitBpInput);
    bpInput?.removeEventListener('keydown', onBpKey);
    bpCondInput?.removeEventListener('keydown', onBpKey);
    watchAddBtn?.removeEventListener('click', onWatchAddToggle);
    watchSubmitBtn?.removeEventListener('click', submitWatchInput);
    watchInput?.removeEventListener('keydown', onWatchKey);
    statusDot?.removeEventListener('click', onStatusClick);
    whyBtn?.removeEventListener('click', onStatusClick);
    closeAttachErrorModal?.(); // dismiss an open attach-error modal so it can't outlive the sidebar
    for (const d of disposers) d();
    stateUnsub();
    stoppedUnsub();
    bpUnsub();
    reattachUnsub();
    runtimeErrUnsub();
    compileErrUnsub();
    replListeners.clear();
    if (sessionActive) void debugApi.debuggerDetach(ip);
  };

  return { cleanup, repl };
}

// --- helpers -----------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Pointer drag: `onStart` captures the base size at mousedown; `onDelta` gets (start, dx, dy).
 *  `ignore` (optional) skips the drag when the mousedown target matches (e.g. a button in a
 *  header that doubles as a resize handle). */
function makeResizer(
  handle: HTMLElement,
  onStart: () => number,
  onDelta: (start: number, dx: number, dy: number) => void,
  ignore?: (target: EventTarget | null) => boolean,
  onReset?: () => void
): () => void {
  const down = (e: MouseEvent): void => {
    if (ignore && ignore(e.target)) return;
    e.preventDefault();
    const start = onStart();
    const sx = e.clientX;
    const sy = e.clientY;
    const move = (ev: MouseEvent): void => onDelta(start, ev.clientX - sx, ev.clientY - sy);
    const up = (): void => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.body.style.userSelect = 'none';
  };
  // Double-click the handle → reset to the default size (skips drags on inner controls).
  const dbl = (e: MouseEvent): void => {
    if (ignore && ignore(e.target)) return;
    if (!onReset) return;
    e.preventDefault();
    onReset();
  };
  handle.addEventListener('mousedown', down);
  if (onReset) handle.addEventListener('dblclick', dbl);
  return () => {
    handle.removeEventListener('mousedown', down);
    handle.removeEventListener('dblclick', dbl);
  };
}

function renderEmpty(container: HTMLElement, text: string): void {
  const d = document.createElement('div');
  d.className = 'telnet-debug-empty';
  d.textContent = text;
  container.replaceChildren(d);
}

function asArray(value: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    for (const k of keys) {
      const v = (value as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function pick(obj: unknown, ...keys: string[]): string {
  if (obj && typeof obj === 'object') {
    for (const k of keys) {
      const v = (obj as Record<string, unknown>)[k];
      if (v !== undefined && v !== null && v !== '') return String(v);
    }
  }
  return '';
}


import type { ParsedNetworkEvent } from '../../../shared/network-inspector/types';
import { escapeHtml } from '../../modules/utils/dom.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import {
  renderSidebarSequence,
  renderSidebarRows,
  renderStructureTree,
  renderStructureLeaves,
  statusPillHtml,
  rowMetaPartsHtml
} from './network-session-view.js';
import {
  renderRequestPane,
  renderResponsePane,
  type BodyFormatMode,
  type RequestPaneTab,
  type ResponsePaneTab
} from './network-detail.js';
import { buildSessions, buildStructureGroups, filterSessions } from './network-sessions.js';
import { openConsoleUrlViewer } from '../../modules/console-log/console-url-modal.js';
import { openTrafficRulesModal } from './traffic-rules-modal.js';
import { buildCurlCommand, buildHarArchive, isExportableEvent } from './network-export.js';
import { openHotspotCaptureSetupModal } from './hotspot-setup-modal.js';
import { showPortConflictModal, hidePortConflictModal } from './port-conflict-modal.js';
import {
  networkInspectorHasCaptureSetupAction,
  type NiSetupPlatform
} from '../../shared/network-inspector/setup-guide.js';

// Caps resident DOM rows so an extreme session count can't bloat the list. The event
// buffer is already capped (MAX_EVENTS), so this only engages in heavy-capture sessions.
const MAX_RENDERED_ROWS = 2000;

/** Structural mirror of the package's `PrerequisiteCheck` (arrives as plain JSON over IPC).
 *  Lets the blocked-state UI render the main-process remediation steps directly. */
type PrerequisiteCheck = {
  ok: boolean;
  code: string;
  title: string;
  message: string;
  remediation: string[];
  docsPath?: string;
  persistentFixInstalled?: boolean;
};

/** Structural mirror of the package's `MitmPortConflict` (arrives as plain JSON over IPC). */
type MitmPortConflict = {
  port: number;
  pid?: number;
  processName?: string;
  command?: string;
  title: string;
  message: string;
  remediation: string[];
};

function renderCapNotice(total: number): string {
  return `<div class="ni-cap-notice">Showing the latest ${MAX_RENDERED_ROWS} of ${total} sessions — use the filter to narrow results.</div>`;
}

type NetworkTabState = {
  deviceIp: string;
  deviceSerial: string;
  deviceName: string;
  events: ParsedNetworkEvent[];
  hotspotIp: string | null;
  watchIps: Set<string>;
  captureError: string | null;
  captureActive: boolean;
  hotspotInterfaceDetected?: boolean;
  platform?: string;
  captureToolAvailable?: boolean;
  bpfCaptureAvailable?: boolean;
  bpfLaunchDaemonInstalled?: boolean;
  prerequisites?: PrerequisiteCheck[];
  mitmEnabled?: boolean;
  mitmActive?: boolean;
  mitmListenAddress?: string;
  mitmLastError?: string;
  mitmPortConflict?: MitmPortConflict | null;
  mitmTransactions?: number;
  selectedEventId: string | null;
  viewMode: 'sequence' | 'structure';
  requestTab: RequestPaneTab;
  responseTab: ResponsePaneTab;
  requestBodyFormat: BodyFormatMode;
  responseBodyFormat: BodyFormatMode;
  collapsedHosts: Set<string>;
  detailLayout: 'stacked' | 'columns';
  decryptedOnly: boolean;
  capturing: boolean;
  requestBodyWrap: boolean;
  responseBodyWrap: boolean;
};

// Mirror of `isPrivateClientIp` in `roku-dev-studio-network-inspector` (kept as a
// local copy because the renderer is a separate bundle from the Node package).
// Rules MUST stay identical to the package helper — RFC1918 ranges minus the
// gateway `.1`, covering macOS Internet Sharing (192.168.2.x), Windows ICS /
// Mobile Hotspot (192.168.137.x) and Linux NetworkManager shared (10.42.x.x).
function isHotspotClientIp(ip: string): boolean {
  if (!ip || ip.endsWith('.1')) return false;
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(ip)
  );
}

/** Supported filter fields, shown in the help modal with clickable examples. */
const FILTER_HELP_FIELDS: Array<{ field: string; desc: string; examples: string[] }> = [
  { field: 'host:', desc: 'Match the hostname (substring).', examples: ['host:roku.com', 'host:googlevideo'] },
  { field: 'method:', desc: 'HTTP method.', examples: ['method:POST', 'method:GET'] },
  { field: 'status:', desc: 'Status code, or a class like 4xx / 5xx.', examples: ['status:404', 'status:4xx', 'status:5xx'] },
  { field: 'type:', desc: 'Response content-type (alias content-type:).', examples: ['type:json', 'type:image'] },
  { field: 'kind:', desc: 'Session kind.', examples: ['kind:https', 'kind:dns', 'kind:tcp'] },
  { field: 'path:', desc: 'URL path (substring; alias url:).', examples: ['path:/v1/play'] }
];

/**
 * Filtering help modal. Lists the supported field-scoped syntax with clickable example chips that
 * append to the filter box via `onPick`. Free text and comma-OR semantics are explained inline.
 */
function openFilterHelpModal(onPick: (term: string) => void): void {
  const overlay = document.createElement('div');
  // `.modal-overlay` is display:none until `.active` is added (shared backdrop + centering).
  overlay.className = 'modal-overlay ni-filter-help-overlay active';
  const rows = FILTER_HELP_FIELDS.map((f) => {
    const chips = f.examples
      .map(
        (ex) =>
          `<button type="button" class="ni-filter-help-chip" data-filter-term="${escapeHtml(ex)}" title="Add to filter">${escapeHtml(ex)}</button>`
      )
      .join('');
    return `<tr>
      <td class="ni-filter-help-field"><code>${escapeHtml(f.field)}</code></td>
      <td class="ni-filter-help-desc">${escapeHtml(f.desc)}<div class="ni-filter-help-chips">${chips}</div></td>
    </tr>`;
  }).join('');
  overlay.innerHTML = `
    <div class="ni-filter-help-modal" role="dialog" aria-modal="true" aria-label="Filter help">
      <div class="ni-filter-help-header">
        <h3>Filtering sessions</h3>
        <button type="button" class="modal-close ni-filter-help-close" title="Close" aria-label="Close">×</button>
      </div>
      <div class="ni-filter-help-body">
        <p class="ni-filter-help-intro">Type free text to match host, path, method, status, kind, or content-type. Use <code>field:value</code> for precise matches, and separate terms with <strong>commas</strong> to match <strong>any</strong> of them (OR).</p>
        <table class="ni-filter-help-table"><tbody>${rows}</tbody></table>
        <p class="ni-filter-help-note">Example: <code>host:roku.com, status:4xx, method:POST</code> shows any session on roku.com <em>or</em> with a 4xx status <em>or</em> using POST. Click an example to add it.</p>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  attachBackdropClickToClose(overlay, close);
  overlay.querySelector('.ni-filter-help-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('[data-filter-term]') as HTMLElement | null;
    if (chip?.dataset.filterTerm) {
      onPick(chip.dataset.filterTerm);
      close();
    }
  });
}

function eventMatchesTab(ev: ParsedNetworkEvent, state: NetworkTabState): boolean {
  // IPs known to belong to this device (its LAN IP + resolved hotspot lease).
  if (state.watchIps.has(ev.deviceIp)) return true;
  const watch = state.hotspotIp || state.deviceIp;
  if (watch && ev.deviceIp === watch) return true;
  // Discovery fallback: only before this tab has resolved its hotspot lease.
  // Once `hotspotIp` is known we filter strictly so multiple Rokus on the same
  // hotspot don't cross-show each other's traffic (including MITM/decrypted
  // events, which previously matched any hotspot client unconditionally).
  if (!state.hotspotIp && isHotspotClientIp(ev.deviceIp)) return true;
  return false;
}

export function setupNetworkTab(
  panel: HTMLElement,
  device: { ip: string; serialNumber?: string; deviceName?: string; modelName?: string },
  isRemote: boolean
): {
  destroy: () => void;
  setHotspotIp: (ip: string | null) => void;
  setDeviceIp: (ip: string) => void;
  setVisible: (visible: boolean) => void;
  appendEvents: (events: ParsedNetworkEvent[]) => void;
  clearEvents: () => void;
  setCaptureStatus: (status: {
    packetsCaptured?: number;
    captureActive?: boolean;
    hotspotInterfaceDetected?: boolean;
    lastError?: string;
    captureInterface?: string;
    eventsBuffered?: number;
    mitmEnabled?: boolean;
    mitmActive?: boolean;
    mitmListenAddress?: string;
    mitmLastError?: string;
    mitmPortConflict?: MitmPortConflict | null;
    mitmTransactions?: number;
    platform?: string;
    captureToolAvailable?: boolean;
    bpfCaptureAvailable?: boolean;
    bpfLaunchDaemonInstalled?: boolean;
    prerequisites?: PrerequisiteCheck[];
  }) => void;
  loadBufferedEvents: (events: ParsedNetworkEvent[]) => void;
} {
  const tabBtn = panel.querySelector('.inner-tab[data-inner-tab="network"]') as HTMLElement | null;
  const tabContent = panel.querySelector('.inner-tab-content[data-inner-content="network"]') as HTMLElement | null;
  if (tabBtn) tabBtn.style.display = 'none';

  const state: NetworkTabState = {
    deviceIp: device.ip || '',
    deviceSerial: typeof device.serialNumber === 'string' ? device.serialNumber.trim() : '',
    deviceName: (device.deviceName || device.modelName || '').trim(),
    events: [],
    hotspotIp: null,
    watchIps: new Set(device.ip ? [device.ip] : []),
    captureError: null,
    captureActive: false,
    mitmEnabled: false,
    mitmActive: false,
    mitmListenAddress: undefined,
    mitmLastError: undefined,
    mitmPortConflict: null,
    mitmTransactions: 0,
    selectedEventId: null,
    viewMode: 'sequence',
    requestTab: 'overview',
    responseTab: 'headers',
    requestBodyFormat: 'auto',
    responseBodyFormat: 'auto',
    collapsedHosts: new Set(),
    detailLayout: 'columns',
    decryptedOnly: true,
    capturing: true,
    requestBodyWrap: true,
    responseBodyWrap: true
  };
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastBufferedPollAt = 0;
  // Per-watch-IP cursor for delta polling: the main process returns only events added/updated
  // since this sequence, so polls stay cheap and never re-fetch the trimmed history (which is what
  // caused the renderer's window to fight the 50k main buffer). Reset on clear/new capture.
  const lastSeqByIp = new Map<string, number>();
  let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let listPaintRaf = 0;
  let listPaintQueued: { scrollToSelection?: boolean; followTail?: boolean; force?: boolean } | null = null;
  let userScrollingList = false;
  let userScrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastListSignature = '';
  let lastDetailSignature = '';
  // The full event (headers + bodies) for the *currently focused* request only. Loaded on demand
  // from the main-process disk store and dropped as soon as the user selects a different request,
  // so at most one request's heavy payload is resident in renderer memory at a time.
  let selectedDetail: { id: string; event: ParsedNetworkEvent } | null = null;
  // Bumped on every selection change / load kickoff so a slow in-flight detail fetch for a
  // previously selected request is ignored when it resolves.
  let detailLoadToken = 0;
  // Ids whose detail fetch came back empty (evicted / never stored). Prevents re-requesting and
  // re-showing the loading state in a loop — those panes fall back to the summary view.
  const detailUnavailableIds = new Set<string>();
  // Host order from the last full structure render, used to decide whether the grouped
  // view can be patched incrementally (append leaves) instead of fully rebuilt.
  let lastStructureHosts: string[] = [];
  // Ids of EXISTING rows whose status/meta changed since the last paint (e.g. Pending → 200).
  // These are patched in place after a paint so a status change never triggers a full list
  // rebuild — which is what used to reset/jump the scroll position during live capture.
  const dirtyEventIds = new Set<string>();
  // Bumped whenever state.events is mutated in a way that affects rendered sessions
  // (new event appended or an existing event replaced with changed fields). Used to
  // memoize buildSessions and to force list repaints when a row's status changes.
  let eventsVersion = 0;
  const sessionCache = new Map<boolean, { version: number; result: ReturnType<typeof buildSessions> }>();
  // Persistent id→event index avoids rebuilding a Map of all events on every merge. The renderer
  // now holds only lightweight summaries (bodies/headers live in the main-process disk store and
  // are fetched on demand), so the count cap alone bounds memory — no payload-byte cap needed.
  const eventIndex = new Map<string, ParsedNetworkEvent>();
  const MAX_EVENTS = 5000;

  // The "Proxied" filter only means something when hotspot capture is running, where
  // proxied and hotspot-metadata sessions coexist. Without hotspot capture (e.g. Roku + desktop on
  // the same Wi-Fi router, MITM-only), every session is already proxied, so the filter is a no-op —
  // treat it as off and hide the toggle.
  function effProxiedOnly(): boolean {
    return state.decryptedOnly && !!state.captureActive;
  }

  function buildSessionsCached(decryptedOnly: boolean): ReturnType<typeof buildSessions> {
    const hit = sessionCache.get(decryptedOnly);
    if (hit && hit.version === eventsVersion) return hit.result;
    const result = buildSessions(state.events, { decryptedOnly });
    sessionCache.set(decryptedOnly, { version: eventsVersion, result });
    return result;
  }

  const captureToggleBtn = panel.querySelector('[data-ni-capture-toggle]') as HTMLButtonElement | null;
  const sessionCountEl = panel.querySelector('[data-ni-session-count]');
  const layoutToggleBtn = panel.querySelector('[data-ni-layout-toggle]') as HTMLButtonElement | null;
  const workspaceEl = panel.querySelector('[data-ni-workspace]') as HTMLElement | null;
  const sessionListEl = panel.querySelector('[data-ni-session-list]');
  const sessionPaneEl = panel.querySelector('[data-ni-session-pane]');
  const detailPane = panel.querySelector('[data-ni-detail]');
  const copyMenuEl = panel.querySelector('[data-ni-copy-menu]') as HTMLElement | null;
  const copyCaretEl = panel.querySelector('[data-ni-copy-menu-toggle]') as HTMLElement | null;
  const copyDropdownEl = panel.querySelector('[data-ni-copy-dropdown]') as HTMLElement | null;
  const scrollBottomFab = panel.querySelector('[data-ni-scroll-bottom]') as HTMLButtonElement | null;
  const jumpErrorFab = panel.querySelector('[data-ni-jump-error]') as HTMLButtonElement | null;
  const requestBodyEl = panel.querySelector('[data-ni-request-body]');
  const responseBodyEl = panel.querySelector('[data-ni-response-body]');
  const requestFormatWrapEl = panel.querySelector('[data-ni-req-format-wrap]');
  const responseFormatWrapEl = panel.querySelector('[data-ni-res-format-wrap]');
  const requestFormatSelect = panel.querySelector(
    '[data-ni-body-format="request"]'
  ) as HTMLSelectElement | null;
  const responseFormatSelect = panel.querySelector(
    '[data-ni-body-format="response"]'
  ) as HTMLSelectElement | null;
  const filterInput = panel.querySelector('[data-ni-filter]') as HTMLInputElement | null;
  const groupByHostInput = panel.querySelector('[data-ni-group-by-host]') as HTMLInputElement | null;
  const decryptedOnlyInput = panel.querySelector('[data-ni-decrypted-only]') as HTMLInputElement | null;
  const proxiedFilterLabel = panel.querySelector('[data-ni-proxied-filter]') as HTMLElement | null;
  const sidebarOptionsEl = panel.querySelector('.ni-sidebar-options') as HTMLElement | null;
  const clearBtn = panel.querySelector('[data-ni-clear]');
  const saveBtn = panel.querySelector('[data-ni-save-pcap]');
  const configureBtn = panel.querySelector('[data-ni-configure]');
  const setupBadgeBtn = panel.querySelector('[data-ni-setup-badge]') as HTMLElement | null;
  const setupBadgeLabel = panel.querySelector('[data-ni-setup-badge-label]') as HTMLElement | null;
  const filterClearBtn = panel.querySelector('[data-ni-filter-clear]') as HTMLElement | null;
  const filterHelpBtn = panel.querySelector('[data-ni-filter-help]') as HTMLElement | null;
  const portBadgeBtn = panel.querySelector('[data-ni-port-badge]') as HTMLElement | null;
  // Tracks whether the Network inner tab is the foreground tab in this device panel, so the global
  // port-conflict modal only auto-pops when the user is actually looking at the Network tab.
  let networkTabForeground = false;

  // Single signal removes every listener registered below in one call from destroy().
  const listenerAc = new AbortController();
  const listenerOpts = { signal: listenerAc.signal };
  let lastPushAt = 0;

  let filteredCache:
    | { version: number; decryptedOnly: boolean; query: string; result: ReturnType<typeof buildSessions> }
    | null = null;

  function filteredSessions() {
    const decryptedOnly = effProxiedOnly();
    const query = filterInput?.value || '';
    if (
      filteredCache &&
      filteredCache.version === eventsVersion &&
      filteredCache.decryptedOnly === decryptedOnly &&
      filteredCache.query === query
    ) {
      return filteredCache.result;
    }
    const sessions = buildSessionsCached(decryptedOnly);
    const result = filterSessions(sessions, query);
    filteredCache = { version: eventsVersion, decryptedOnly, query, result };
    return result;
  }

  function markUserScrollingList(): void {
    // Trivial on purpose: no layout reads here. Reading scrollHeight/clientHeight on every
    // scroll event forces synchronous reflows that jank the main-thread-painted custom
    // scrollbar. We defer list repaints while the user is actively scrolling so the DOM
    // doesn't mutate under their finger.
    userScrollingList = true;
    if (userScrollIdleTimer) clearTimeout(userScrollIdleTimer);
    userScrollIdleTimer = setTimeout(() => {
      userScrollingList = false;
      userScrollIdleTimer = null;
      if (listPaintQueued) scheduleSessionListPaint(listPaintQueued);
    }, 350);
  }

  function listSignature(sessions: ReturnType<typeof filteredSessions>): string {
    // eventsVersion changes whenever any rendered session field changes (new row or a
    // status/body update on an existing row), so we don't need to sample row contents.
    return `${state.viewMode}|${effProxiedOnly()}|${filterInput?.value || ''}|${sessions.length}|${eventsVersion}|${state.selectedEventId ?? ''}`;
  }

  function detailSignature(ev: ParsedNetworkEvent, loaded: boolean): string {
    return [
      ev.id,
      ev.type,
      ev.httpResponse?.statusCode ?? '',
      ev.httpRequest?.bodyBytes ?? '',
      ev.httpResponse?.bodyBytes ?? '',
      loaded ? '1' : '0',
      state.requestTab,
      state.responseTab,
      state.requestBodyFormat,
      state.responseBodyFormat
    ].join('|');
  }

  function detailLoadingHtml(): string {
    return `<div class="ni-pane-empty">Loading captured data…</div>`;
  }

  // The event whose headers/body should be rendered: the loaded detail if it matches the current
  // selection, otherwise the lightweight summary (Overview renders fine from the summary alone).
  function detailRenderEvent(): ParsedNetworkEvent | null {
    const summary = selectedEvent();
    if (!summary) return null;
    if (selectedDetail?.id === summary.id) return selectedDetail.event;
    return summary;
  }

  async function ensureDetailLoaded(summary: ParsedNetworkEvent): Promise<void> {
    if (selectedDetail?.id === summary.id) return;
    if (!summary.detailAvailable || detailUnavailableIds.has(summary.id)) return;
    const api = window.roku;
    if (!api?.networkInspectorGetEventDetail) return;
    const id = summary.id;
    const token = ++detailLoadToken;
    try {
      const res = await api.networkInspectorGetEventDetail(id);
      // Ignore if a newer selection/load superseded this fetch or the selection moved on.
      if (token !== detailLoadToken || state.selectedEventId !== id) return;
      const full = (res?.event ?? null) as ParsedNetworkEvent | null;
      if (full) {
        selectedDetail = { id, event: full };
      } else {
        // Detail is gone (evicted/never stored) — stop the spinner and fall back to the summary.
        detailUnavailableIds.add(id);
      }
      lastDetailSignature = '';
      renderDetail('both');
    } catch {
      detailUnavailableIds.add(id);
      lastDetailSignature = '';
      renderDetail('both');
    }
  }

  function updateSelectionHighlight(): void {
    if (!(sessionListEl instanceof HTMLElement)) return;
    sessionListEl
      .querySelectorAll('.ni-sidebar-row-selected, .ni-seq-row-selected, .ni-struct-leaf-selected')
      .forEach((el) => {
        el.classList.remove('ni-sidebar-row-selected', 'ni-seq-row-selected', 'ni-struct-leaf-selected');
      });
    if (!state.selectedEventId) return;
    const row = sessionListEl.querySelector(
      `[data-event-id="${CSS.escape(state.selectedEventId)}"]`
    ) as HTMLElement | null;
    if (!row) return;
    if (row.classList.contains('ni-sidebar-row')) row.classList.add('ni-sidebar-row-selected');
    else if (row.classList.contains('ni-seq-row')) row.classList.add('ni-seq-row-selected');
    else if (row.classList.contains('ni-struct-leaf')) row.classList.add('ni-struct-leaf-selected');
  }

  function listScrollWrap(): HTMLElement | null {
    if (!(sessionListEl instanceof HTMLElement)) return null;
    return sessionListEl.querySelector('.ni-sidebar-scroll, .ni-sequence-wrap, .ni-structure-wrap') as HTMLElement | null;
  }

  function focusListForKeyboard(): void {
    const wrap = listScrollWrap();
    if (wrap) wrap.focus({ preventScroll: true });
  }

  function captureListScroll(): { scrollTop: number; atBottom: boolean } {
    const wrap = listScrollWrap();
    if (!wrap) return { scrollTop: 0, atBottom: true };
    const atBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 8;
    return { scrollTop: wrap.scrollTop, atBottom };
  }

  function scrollRowWithinWrap(wrap: HTMLElement, row: HTMLElement): void {
    const wr = wrap.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    if (rr.top >= wr.top && rr.bottom <= wr.bottom) return;
    if (rr.top < wr.top) wrap.scrollTop += rr.top - wr.top;
    else if (rr.bottom > wr.bottom) wrap.scrollTop += rr.bottom - wr.bottom;
  }

  function restoreListScroll(saved: { scrollTop: number; atBottom: boolean }): void {
    const wrap = listScrollWrap();
    if (!wrap) return;
    const max = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
    wrap.scrollTop = Math.min(Math.max(0, saved.scrollTop), max);
  }

  // Scroll handling after a paint:
  //  - scrollToSelection: bring the selected row into view (keyboard nav / decrypted toggle).
  //  - followTail + was-at-bottom: stay pinned to the newest row (no active selection).
  //  - 'rebuilt': the container was replaced (scrollTop reset to 0) → restore the position we
  //    captured synchronously before the rebuild.
  //  - 'patched': rows were appended at the bottom / updated in place → leave native scroll
  //    untouched so the user's position and momentum are preserved (no jump).
  function applyListScrollAfterPaint(
    result: 'rebuilt' | 'patched',
    saved: { scrollTop: number; atBottom: boolean } | null,
    options?: { scrollToSelection?: boolean; followTail?: boolean }
  ): void {
    requestAnimationFrame(() => {
      if (options?.scrollToSelection) {
        scrollSelectedRowIntoView();
        updateListFabs();
        return;
      }
      if (options?.followTail && saved?.atBottom) {
        const wrap = listScrollWrap();
        if (wrap) wrap.scrollTop = wrap.scrollHeight;
        updateListFabs();
        return;
      }
      if (result === 'rebuilt' && saved) restoreListScroll(saved);
      updateListFabs();
    });
  }

  function scrollSelectedRowIntoView(): void {
    if (!(sessionListEl instanceof HTMLElement)) return;
    const wrap = listScrollWrap();
    const row = sessionListEl.querySelector(
      '.ni-sidebar-row-selected, .ni-seq-row-selected, .ni-struct-leaf-selected'
    ) as HTMLElement | null;
    if (!wrap || !row) return;
    scrollRowWithinWrap(wrap, row);
  }

  function isErrorSession(s: ReturnType<typeof filteredSessions>[number]): boolean {
    return typeof s.statusCode === 'number' && s.statusCode >= 400;
  }

  /** Toggle the floating list affordances: scroll-to-latest (when scrolled up) and jump-to-error
   *  (when the filtered list has any 4xx/5xx response). Cheap: one scroll read + one array scan. */
  function updateListFabs(): void {
    if (scrollBottomFab) {
      const wrap = listScrollWrap();
      const atBottom = !wrap || wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 8;
      const scrollable = !!wrap && wrap.scrollHeight - wrap.clientHeight > 8;
      scrollBottomFab.hidden = !scrollable || atBottom;
    }
    if (jumpErrorFab) {
      jumpErrorFab.hidden = !filteredSessions().some(isErrorSession);
    }
  }

  function scrollListToBottom(): void {
    const wrap = listScrollWrap();
    if (!wrap) return;
    wrap.scrollTop = wrap.scrollHeight;
    updateListFabs();
  }

  /** Select + reveal the latest error session (4xx/5xx) in the filtered list. */
  function jumpToLatestError(): void {
    const sessions = filteredSessions();
    let target: string | null = null;
    for (const s of sessions) {
      if (isErrorSession(s)) target = s.eventId;
    }
    if (!target) return;
    if (state.selectedEventId !== target) {
      state.selectedEventId = target;
      updateSelectionHighlight();
      lastListSignature = listSignature(sessions);
      renderDetail('both');
    }
    scrollSelectedRowIntoView();
  }

  function navigableEventIds(): string[] {
    if (!(sessionListEl instanceof HTMLElement)) return [];
    if (state.viewMode === 'structure') {
      return Array.from(sessionListEl.querySelectorAll('.ni-struct-leaf[data-event-id]'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => (el as HTMLElement).dataset.eventId)
        .filter((id): id is string => !!id);
    }
    return filteredSessions().map((s) => s.eventId);
  }

  function selectSessionByOffset(delta: number): void {
    const ids = navigableEventIds();
    if (ids.length === 0) return;
    let idx = state.selectedEventId ? ids.indexOf(state.selectedEventId) : -1;
    if (idx < 0) idx = delta > 0 ? -1 : ids.length;
    const next = Math.max(0, Math.min(ids.length - 1, idx + delta));
    if (next === idx) return;
    state.selectedEventId = ids[next];
    updateSelectionHighlight();
    lastListSignature = listSignature(filteredSessions());
    renderDetail('both');
    scrollSelectedRowIntoView();
  }

  function pickDefaultSelection(sessions: ReturnType<typeof filteredSessions>): void {
    if (sessions.length === 0) {
      state.selectedEventId = null;
      return;
    }
    if (state.selectedEventId && sessions.some((s) => s.eventId === state.selectedEventId)) return;
    if (effProxiedOnly()) {
      const decrypted = sessions.find((s) => s.decrypted);
      state.selectedEventId = decrypted?.eventId ?? null;
      return;
    }
    const decrypted = sessions.find((s) => s.decrypted);
    state.selectedEventId = (decrypted || sessions[sessions.length - 1]).eventId;
  }

  function selectedEvent(): ParsedNetworkEvent | null {
    if (!state.selectedEventId) return null;
    return state.events.find((e) => e.id === state.selectedEventId) || null;
  }

  function watchDeviceIps(): string[] {
    const ips = new Set<string>();
    if (state.deviceIp) ips.add(state.deviceIp);
    if (state.hotspotIp) ips.add(state.hotspotIp);
    for (const ip of state.watchIps) ips.add(ip);
    return Array.from(ips).filter((ip) => ip && !ip.endsWith('.1'));
  }

  async function syncRecordingToMain(): Promise<void> {
    const api = window.roku;
    if (!api?.networkInspectorSetRecording) return;
    const ips = watchDeviceIps();
    if (ips.length === 0) return;
    try {
      await api.networkInspectorSetRecording({ deviceIps: ips, recording: state.capturing });
    } catch {
      /* ignore */
    }
  }

  async function clearSessionsOnMain(): Promise<void> {
    const api = window.roku;
    if (!api?.networkInspectorClearEvents) return;
    const ips = watchDeviceIps();
    try {
      await api.networkInspectorClearEvents(ips.length > 0 ? ips : undefined);
    } catch {
      /* ignore */
    }
  }

  function syncPaneChrome(which: 'request' | 'response' | 'both' = 'both'): void {
    if (which !== 'response') {
      panel.querySelectorAll('[data-ni-req-tab]').forEach((btn) => {
        btn.classList.toggle(
          'active',
          (btn as HTMLElement).dataset.niReqTab === state.requestTab
        );
      });
      if (requestFormatWrapEl instanceof HTMLElement) {
        requestFormatWrapEl.hidden = state.requestTab !== 'body';
      }
      if (requestFormatSelect && requestFormatSelect.value !== state.requestBodyFormat) {
        requestFormatSelect.value = state.requestBodyFormat;
      }
    }
    if (which !== 'request') {
      panel.querySelectorAll('[data-ni-res-tab]').forEach((btn) => {
        btn.classList.toggle(
          'active',
          (btn as HTMLElement).dataset.niResTab === state.responseTab
        );
      });
      if (responseFormatWrapEl instanceof HTMLElement) {
        responseFormatWrapEl.hidden = state.responseTab !== 'body';
      }
      if (responseFormatSelect && responseFormatSelect.value !== state.responseBodyFormat) {
        responseFormatSelect.value = state.responseBodyFormat;
      }
    }
  }

  function renderDetail(which: 'request' | 'response' | 'both' = 'both'): void {
    const summary = selectedEvent();
    if (!(detailPane instanceof HTMLElement)) return;
    // Release the previous request's heavy detail as soon as the focus moves elsewhere.
    if (selectedDetail && (!summary || selectedDetail.id !== summary.id)) {
      selectedDetail = null;
      detailLoadToken++;
    }
    if (!summary) {
      detailPane.classList.add('is-empty');
      lastDetailSignature = '';
      if (which !== 'response' && requestBodyEl instanceof HTMLElement) requestBodyEl.innerHTML = '';
      if (which !== 'request' && responseBodyEl instanceof HTMLElement) responseBodyEl.innerHTML = '';
      return;
    }
    detailPane.classList.remove('is-empty');
    const loaded = selectedDetail?.id === summary.id;
    const ev = detailRenderEvent() ?? summary;
    // cURL/HAR export only applies to full HTTP transactions (DNS/TLS/TCP rows have no request).
    // Those exports live in the copy-button dropdown, so the caret only appears when exportable;
    // otherwise the plain copy-body button stands alone.
    const canExportSelected = isExportableEvent(summary);
    if (copyCaretEl) copyCaretEl.hidden = !canExportSelected;
    if (copyMenuEl) copyMenuEl.classList.toggle('has-caret', canExportSelected);
    if (!canExportSelected) closeCopyDropdown();
    // Headers/body live on disk; only the loaded detail has them. Until it arrives, show a
    // loading state for panes that need it (Overview renders fully from the summary).
    const needsDetail =
      !loaded && summary.detailAvailable === true && !detailUnavailableIds.has(summary.id);
    // Skip the costly innerHTML rewrite when a full ('both') repaint is requested but the
    // selected event's content and view options are unchanged. This preserves the user's
    // scroll position and text selection inside the body panes across idle polls/list paints.
    const sig = detailSignature(summary, loaded);
    if (
      which === 'both' &&
      sig === lastDetailSignature &&
      requestBodyEl instanceof HTMLElement &&
      requestBodyEl.childNodes.length > 0 &&
      responseBodyEl instanceof HTMLElement &&
      responseBodyEl.childNodes.length > 0
    ) {
      syncPaneChrome('both');
      return;
    }
    if (which !== 'response' && requestBodyEl instanceof HTMLElement) {
      if (state.requestTab === 'body' && needsDetail) {
        requestBodyEl.innerHTML = detailLoadingHtml();
      } else {
        const allEvents = state.requestTab === 'overview' ? state.events : [];
        requestBodyEl.innerHTML = renderRequestPane(
          ev,
          state.requestTab,
          state.requestBodyFormat,
          allEvents
        );
      }
    }
    if (which !== 'request' && responseBodyEl instanceof HTMLElement) {
      // Both response tabs (headers + body) require the loaded detail.
      if (needsDetail) {
        responseBodyEl.innerHTML = detailLoadingHtml();
      } else {
        responseBodyEl.innerHTML = renderResponsePane(
          ev,
          state.responseTab,
          state.responseBodyFormat
        );
      }
    }
    lastDetailSignature = sig;
    syncPaneChrome(which);
    if (needsDetail) void ensureDetailLoaded(summary);
  }

  function renderDecryptedOnlyEmpty(): void {
    if (!(sessionListEl instanceof HTMLElement)) return;
    const proxyAddr = state.mitmListenAddress || 'machine-ip:8888';
    let mitmLine: string;
    if (state.mitmActive) {
      mitmLine =
        `MITM proxy is active at <strong>${escapeHtml(proxyAddr)}</strong> — route your dev channel's requests through it to capture them.`;
    } else if (state.mitmPortConflict) {
      const c = state.mitmPortConflict;
      const who = c.processName ? `${escapeHtml(c.processName)}${c.pid ? ` (PID ${c.pid})` : ''}` : 'another app';
      mitmLine = `MITM proxy can't use port ${c.port} — ${who} is using it. Click <strong>Proxy Port unavailable</strong> above to close it or change the port.`;
    } else if (state.mitmLastError) {
      mitmLine = `MITM proxy failed to start: ${escapeHtml(state.mitmLastError)}.`;
    } else if (state.mitmEnabled) {
      mitmLine = 'MITM proxy is starting — relaunch Roku Dev Studio if this persists.';
    } else {
      mitmLine = 'Enable <strong>MITM proxy</strong> in Settings → Network Inspector.';
    }
    sessionListEl.innerHTML =
      `<div class="ni-session-empty"><p>No proxied sessions yet.</p>` + `<p class="ni-hint">${mitmLine}</p></div>`;
    renderDetail();
  }

  function renderFlatView(
    sessions: ReturnType<typeof filteredSessions>,
    force: boolean
  ): 'rebuilt' | 'patched' {
    if (!(sessionListEl instanceof HTMLElement)) return 'rebuilt';
    const overCap = sessions.length > MAX_RENDERED_ROWS;
    const scroll = listScrollWrap();
    // Under the cap and not forced, patch in place: append new rows at the bottom, and let
    // surgical updates handle status changes to existing rows. This keeps the scroll stable.
    if (scroll && scroll.classList.contains('ni-sidebar-scroll') && !force && !overCap) {
      const existingRows = scroll.querySelectorAll('[data-event-id]').length;
      if (existingRows === 0) {
        scroll.innerHTML = renderSidebarRows(sessions, state.selectedEventId);
        return 'rebuilt';
      }
      if (existingRows < sessions.length) {
        scroll.insertAdjacentHTML(
          'beforeend',
          renderSidebarRows(sessions.slice(existingRows), state.selectedEventId)
        );
        return 'patched';
      }
      if (existingRows > sessions.length) {
        scroll.innerHTML = renderSidebarRows(sessions, state.selectedEventId);
        return 'rebuilt';
      }
      // Same row count → no structural change; any status change is handled in place.
      return 'patched';
    }
    if (overCap) {
      const windowed = sessions.slice(sessions.length - MAX_RENDERED_ROWS);
      sessionListEl.innerHTML =
        `<div class="ni-sidebar-scroll">${renderCapNotice(sessions.length)}${renderSidebarRows(windowed, state.selectedEventId)}</div>`;
      return 'rebuilt';
    }
    sessionListEl.innerHTML = renderSidebarSequence(sessions, state.selectedEventId);
    return 'rebuilt';
  }

  function renderStructureView(
    sessions: ReturnType<typeof filteredSessions>,
    force: boolean
  ): 'rebuilt' | 'patched' {
    if (!(sessionListEl instanceof HTMLElement)) return 'rebuilt';
    const overCap = sessions.length > MAX_RENDERED_ROWS;
    const windowed = overCap ? sessions.slice(sessions.length - MAX_RENDERED_ROWS) : sessions;
    const groups = buildStructureGroups(windowed);
    const wrap = sessionListEl.querySelector('.ni-structure-wrap') as HTMLElement | null;
    const hosts = groups.map((g) => g.host);
    const sameHosts =
      wrap &&
      !force &&
      hosts.length === lastStructureHosts.length &&
      hosts.every((h, i) => h === lastStructureHosts[i]);

    if (sameHosts) {
      // Append only the new leaves to each host whose count grew — no full tree rebuild.
      // Status changes to existing leaves are handled by the surgical update pass.
      for (const g of groups) {
        const hostEl = wrap.querySelector(
          `.ni-struct-host[data-struct-host="${CSS.escape(g.host)}"]`
        ) as HTMLElement | null;
        if (!hostEl) continue;
        const childrenEl = hostEl.querySelector('.ni-struct-children') as HTMLElement | null;
        const countEl = hostEl.querySelector('.ni-struct-host-count');
        if (!childrenEl) continue;
        const existing = childrenEl.querySelectorAll('.ni-struct-leaf').length;
        if (existing < g.sessions.length) {
          const slice = g.sessions.slice(existing);
          childrenEl.insertAdjacentHTML(
            'beforeend',
            renderStructureLeaves(slice, state.selectedEventId, existing)
          );
        }
        if (countEl) countEl.textContent = String(g.sessions.length);
      }
      return 'patched';
    }

    lastStructureHosts = hosts;
    sessionListEl.innerHTML = renderStructureTree(
      windowed,
      state.selectedEventId,
      state.collapsedHosts,
      overCap ? renderCapNotice(sessions.length) : ''
    );
    return 'rebuilt';
  }

  // Patch status/timestamp/duration on rows that changed (e.g. Pending → 200) without
  // rebuilding the list, so the scroll position is never disturbed.
  function updateChangedRows(sessions: ReturnType<typeof filteredSessions>): void {
    if (dirtyEventIds.size === 0 || !(sessionListEl instanceof HTMLElement)) return;
    const byId = new Map(sessions.map((s) => [s.eventId, s]));
    for (const id of dirtyEventIds) {
      const s = byId.get(id);
      if (!s) continue;
      const row = sessionListEl.querySelector(`[data-event-id="${CSS.escape(id)}"]`);
      if (!row) continue;
      const statusEl = row.querySelector('.ni-sidebar-status, .ni-struct-leaf-status');
      if (statusEl) statusEl.innerHTML = statusPillHtml(s);
      const { ts, dur } = rowMetaPartsHtml(s);
      const tsEl = row.querySelector('.ni-row-ts');
      if (tsEl) tsEl.textContent = ts;
      const durEl = row.querySelector('.ni-row-dur');
      if (durEl) durEl.textContent = dur;
    }
  }

  function renderSessionList(options?: { scrollToSelection?: boolean; followTail?: boolean; force?: boolean }): void {
    if (!(sessionListEl instanceof HTMLElement)) return;
    const sessions = state.events.length === 0 ? [] : filteredSessions();
    const signature = listSignature(sessions);

    if (
      !options?.force &&
      signature === lastListSignature &&
      sessionListEl.querySelector('.ni-sidebar-scroll, .ni-structure-wrap, .ni-sequence-wrap')
    ) {
      updateSelectionHighlight();
      if (options?.scrollToSelection) scrollSelectedRowIntoView();
      updateListFabs();
      return;
    }
    lastListSignature = signature;

    // Capture the CURRENT scroll position synchronously, before any DOM mutation, so a
    // forced rebuild (filter/group/collapse) restores exactly where the user was — not a
    // stale sampled value, which was the source of the scroll "jumps".
    const savedScroll = options?.scrollToSelection ? null : captureListScroll();
    if (sessionPaneEl instanceof HTMLElement) {
      sessionPaneEl.dataset.view = state.viewMode;
    }
    syncSidebarOptions();

    if (state.events.length === 0) {
      let body: string;
      // Hotspot capture on Windows is optional and has no in-app fix — its Npcap setup is guided
      // from Settings → Network Inspector, not here. So never surface a hotspot-capture
      // "blocked/needs Npcap" warning on the Windows capture screen (it would also misleadingly
      // appear when no hotspot is active and hotspot capture isn't even being attempted). Fall
      // through to the MITM-proxy guidance, which is the path that actually works on Windows.
      const showCaptureError = !!state.captureError && state.platform !== 'win32';
      if (showCaptureError && state.mitmActive) {
        body =
          `<p class="ni-hint">Hotspot capture is blocked, but the MITM proxy at <strong>${escapeHtml(state.mitmListenAddress || 'gateway:8888')}</strong> can still record proxied requests. Use <code>host:port</code> only in BrightScript (e.g. <code>192.168.2.1:8888</code>), not the device IP and not <code>http://</code>.</p>`;
      } else if (showCaptureError) {
        body = `<p class="ni-hint ni-hint-error">${escapeHtml(state.captureError)}</p>`;
      } else if (state.mitmActive && !state.captureActive) {
        // Shared Wi-Fi / no hotspot: only the MITM proxy is recording. Guide the user to point
        // their dev channel at the proxy address (host:port only, the machine's LAN IP).
        const proxyAddr = state.mitmListenAddress || 'machine-ip:8888';
        body = `<p class="ni-hint">MITM proxy is active at <code class="ni-hint-code">${escapeHtml(proxyAddr)}</code>. Route your dev channel through it to capture Network requests.</p>`;
      } else if (state.captureActive || state.mitmActive) {
        const mitmHint = state.mitmActive
          ? ' MITM proxy is decrypting dev-channel HTTPS routed through Roku Dev Studio.'
          : ' HTTPS bodies are encrypted in hotspot capture mode — enable MITM in Settings for dev channels.';
        body =
          '<p class="ni-hint">Capturing on hotspot. Browse or play content on the Roku.</p>' +
          `<p class="ni-hint">${mitmHint}</p>`;
      } else {
        body =
          '<p class="ni-hint">Connect the Roku to the same Wi‑Fi (or your machine hotspot), then enable the <strong>MITM proxy</strong> in Settings → Network Inspector to capture dev-channel HTTPS.</p>';
      }
      sessionListEl.innerHTML = `<div class="ni-session-empty"><p>No sessions yet.</p>${body}</div>`;
      renderDetail();
      updateListFabs();
      return;
    }

    pickDefaultSelection(sessions);

    if (sessions.length === 0 && effProxiedOnly()) {
      renderDecryptedOnlyEmpty();
      updateListFabs();
      return;
    }

    const result =
      state.viewMode === 'structure'
        ? renderStructureView(sessions, !!options?.force)
        : renderFlatView(sessions, !!options?.force);
    // A full rebuild already reflects every status; only an incremental ('patched') paint
    // needs the changed existing rows updated in place.
    if (result === 'patched') updateChangedRows(sessions);
    dirtyEventIds.clear();

    if (
      state.selectedEventId &&
      !sessions.some((s) => s.eventId === state.selectedEventId) &&
      sessions.length > 0
    ) {
      pickDefaultSelection(sessions);
      updateSelectionHighlight();
    }

    const wrap = listScrollWrap();
    if (wrap && !wrap.hasAttribute('tabindex')) {
      wrap.tabIndex = 0;
      wrap.setAttribute('aria-label', 'Network session list. Use arrow keys to navigate.');
    }
    bindListKeyboardNav();

    renderDetail('both');
    applyListScrollAfterPaint(result, savedScroll, options);
  }

  function scheduleSessionListPaint(options?: {
    scrollToSelection?: boolean;
    followTail?: boolean;
    force?: boolean;
  }): void {
    listPaintQueued = { ...listPaintQueued, ...options };
    if (listPaintRaf) return;
    listPaintRaf = requestAnimationFrame(() => {
      listPaintRaf = 0;
      if (userScrollingList && !listPaintQueued?.force) {
        scheduleSessionListPaint(listPaintQueued || undefined);
        listPaintQueued = null;
        return;
      }
      const opts = listPaintQueued || undefined;
      listPaintQueued = null;
      renderSessionList(opts);
    });
  }

  function refreshSessionList(options?: { scrollToSelection?: boolean; followTail?: boolean; force?: boolean }): void {
    scheduleSessionListPaint(options);
  }

  function render(force = false): void {
    scheduleSessionListPaint({ force });
  }

  function bindListKeyboardNav(): void {
    const wrap = listScrollWrap();
    if (!wrap || wrap.dataset.niKeybound === '1') return;
    wrap.dataset.niKeybound = '1';
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectSessionByOffset(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectSessionByOffset(-1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        const ids = navigableEventIds();
        if (ids.length === 0) return;
        const first = ids[0];
        if (state.selectedEventId === first) return;
        state.selectedEventId = first;
        updateSelectionHighlight();
        lastListSignature = listSignature(filteredSessions());
        renderDetail('both');
        scrollSelectedRowIntoView();
      } else if (e.key === 'End') {
        e.preventDefault();
        const ids = navigableEventIds();
        if (ids.length === 0) return;
        const last = ids[ids.length - 1];
        if (state.selectedEventId === last) return;
        state.selectedEventId = last;
        updateSelectionHighlight();
        lastListSignature = listSignature(filteredSessions());
        renderDetail('both');
        scrollSelectedRowIntoView();
      }
    }, listenerOpts);
  }

  function syncDetailLayout(): void {
    if (workspaceEl instanceof HTMLElement) {
      workspaceEl.dataset.detailLayout = state.detailLayout;
    }
    if (layoutToggleBtn instanceof HTMLButtonElement) {
      const stacked = state.detailLayout === 'stacked';
      layoutToggleBtn.title = 'Request and Response Panes - ' + (stacked ? 'Side by Side' : 'Stack Vertically');
      layoutToggleBtn.setAttribute('aria-pressed', stacked ? 'false' : 'true');
      layoutToggleBtn.innerHTML = stacked ? '<span class="icon icon-sm"><svg><use href="#icon-layout-columns"/></svg></span>' : '<span class="icon icon-sm"><svg><use href="#icon-layout-rows"/></svg></span>';
    }
  }

  function syncSidebarOptions(): void {
    if (groupByHostInput) groupByHostInput.checked = state.viewMode === 'structure';
    // The "Proxied" filter is only meaningful alongside hotspot capture, where
    // proxied and hotspot-metadata sessions coexist. In MITM-only setups (e.g. Roku + desktop on
    // the same Wi-Fi router, no hotspot capture) every session is already proxied, so the filter is
    // a forced no-op. Rather than hide it, keep it visible but checked + disabled to communicate
    // that everything is proxied and the choice can't be changed in this mode.
    const proxiedLocked = !state.captureActive;
    if (decryptedOnlyInput) {
      decryptedOnlyInput.checked = proxiedLocked ? true : state.decryptedOnly;
      decryptedOnlyInput.disabled = proxiedLocked;
    }
    if (proxiedFilterLabel) {
      proxiedFilterLabel.style.display = '';
      proxiedFilterLabel.classList.toggle('is-disabled', proxiedLocked);
      proxiedFilterLabel.title = proxiedLocked
        ? 'All traffic is proxied through Roku Dev Studio in this mode, so this is always on. This control will be enabled when the Roku device is connected through the hotspot.'
        : 'Show only requests proxied through Roku Dev Studio (full headers + body), hiding hotspot-capture SNI/DNS metadata';
    }
    // Both controls are always shown now, so the single-option centering no longer applies.
    if (sidebarOptionsEl) sidebarOptionsEl.classList.remove('ni-options-single');
  }

  function syncFilterClear(): void {
    if (!(filterClearBtn instanceof HTMLElement)) return;
    filterClearBtn.hidden = !filterInput?.value;
  }

  function syncBodyWrap(): void {
    // Per-pane: the nowrap class lives on each body scroll element so Request and Response
    // wrap independently.
    if (requestBodyEl instanceof HTMLElement) {
      requestBodyEl.classList.toggle('ni-body-nowrap', !state.requestBodyWrap);
    }
    if (responseBodyEl instanceof HTMLElement) {
      responseBodyEl.classList.toggle('ni-body-nowrap', !state.responseBodyWrap);
    }
    panel.querySelectorAll('[data-ni-wrap-toggle]').forEach((btn) => {
      const pane = (btn as HTMLElement).dataset.niWrapToggle;
      const on = pane === 'response' ? state.responseBodyWrap : state.requestBodyWrap;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-active', on);
      (btn as HTMLElement).title = on ? 'Disable word wrap' : 'Enable word wrap';
    });
  }

  async function copyPaneContent(btn: HTMLElement, which: string): Promise<void> {
    if (!window.roku?.copyToClipboard) return;
    // Use the loaded detail (has the full headers/body); fall back to summary for tabs that
    // don't carry a single source string.
    const ev =
      selectedDetail?.id === state.selectedEventId ? selectedDetail.event : selectedEvent();
    let text = '';
    // Prefer the full raw body from the event so Copy yields the complete payload even
    // when the displayed body is capped/formatted; fall back to the visible text for the
    // overview/headers tabs which have no single source string.
    if (ev) {
      if (which === 'request' && state.requestTab === 'body') {
        text = ev.httpRequest?.body || '';
      } else if (which === 'response' && state.responseTab === 'body') {
        text = ev.httpResponse?.body || '';
      }
    }
    if (!text) {
      const el = which === 'request' ? requestBodyEl : responseBodyEl;
      if (el instanceof HTMLElement) text = (el.innerText || el.textContent || '').trim();
    }
    if (!text) return;
    try {
      await window.roku.copyToClipboard(text);
      btn.classList.add('is-copied');
      window.setTimeout(() => btn.classList.remove('is-copied'), 1400);
    } catch {
      /* ignore */
    }
  }

  /** Copy the selected transaction as a cURL command or a HAR archive. Ensures the full detail
   *  (headers/body) is loaded first so the export isn't limited to the lightweight summary. */
  async function exportSelectedAs(btn: HTMLElement, kind: 'curl' | 'har'): Promise<void> {
    if (!window.roku?.copyToClipboard) return;
    const summary = selectedEvent();
    if (!isExportableEvent(summary) || !summary) return;
    // Pull full headers/body from the on-disk detail store before building the export.
    await ensureDetailLoaded(summary);
    const ev = selectedDetail?.id === summary.id ? selectedDetail.event : summary;
    let text = '';
    try {
      text = kind === 'curl' ? buildCurlCommand(ev) : buildHarArchive(ev);
    } catch {
      return;
    }
    if (!text) return;
    try {
      await window.roku.copyToClipboard(text);
      btn.classList.add('is-copied');
      window.setTimeout(() => btn.classList.remove('is-copied'), 1400);
    } catch {
      /* ignore */
    }
  }

  function closeCopyDropdown(): void {
    if (copyDropdownEl && !copyDropdownEl.hidden) copyDropdownEl.hidden = true;
    copyCaretEl?.setAttribute('aria-expanded', 'false');
  }

  function toggleCopyDropdown(): void {
    if (!copyDropdownEl || !copyCaretEl || copyCaretEl.hidden) return;
    const willOpen = copyDropdownEl.hidden;
    copyDropdownEl.hidden = !willOpen;
    copyCaretEl.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  function updateSessionCount(): void {
    if (!(sessionCountEl instanceof HTMLElement)) return;
    const captured = buildSessionsCached(false).length;
    const visible = filteredSessions().length;
    const hasTextFilter = !!(filterInput?.value?.trim());
    const filtered = hasTextFilter || effProxiedOnly();
    if (filtered) {
      sessionCountEl.textContent = `${visible}/${captured}`;
      sessionCountEl.title = `${visible} matching of ${captured} captured sessions`;
    } else {
      sessionCountEl.textContent = String(captured);
      sessionCountEl.title = captured === 1 ? '1 captured session' : `${captured} captured sessions`;
    }
  }

  /**
   * A user-facing summary of a blocking Network Inspector problem (proxy port taken or another MITM
   * proxy error), or null when healthy. Used to flip the capture toggle into a "blocked" state.
   * Hotspot capture setup is intentionally excluded — it's optional and has its own setup badge.
   */
  function niIssueSummary(): string | null {
    const c = state.mitmPortConflict;
    if (c) {
      const who = c.processName ? ` (${c.processName}${c.pid ? ` · PID ${c.pid}` : ''})` : '';
      return `Network Inspector unavailable — port ${c.port} is in use${who}.`;
    }
    if (state.mitmLastError) {
      return `Network Inspector issue — MITM proxy: ${state.mitmLastError}`;
    }
    return null;
  }

  function updateCaptureButton(): void {
    updateSessionCount();
    if (!captureToggleBtn) return;
    const issue = niIssueSummary();
    if (issue) {
      // A blocking MITM problem overrides the play/pause affordance: show a "blocked" icon + the
      // problem in the tooltip. Clicking still toggles capture (and the Proxy Port badge / modal
      // carry the fix), so capture isn't trapped off.
      captureToggleBtn.innerHTML =
        '<span class="icon icon-sm"><svg><use href="#icon-wifi-off"/></svg></span>';
      captureToggleBtn.classList.add('has-ni-issue');
      captureToggleBtn.classList.remove('is-capturing');
      captureToggleBtn.title = issue;
      captureToggleBtn.setAttribute('aria-label', issue);
      return;
    }
    captureToggleBtn.classList.remove('has-ni-issue');
    if (state.capturing) {
      captureToggleBtn.innerHTML =
        '<span class="icon icon-sm"><svg><use href="#icon-pause"/></svg></span>';
      captureToggleBtn.classList.add('is-capturing');
      captureToggleBtn.title = 'Stop capturing';
      captureToggleBtn.setAttribute('aria-label', 'Stop capturing');
    } else {
      captureToggleBtn.innerHTML =
        '<span class="icon icon-sm"><svg><use href="#icon-play"/></svg></span>';
      captureToggleBtn.classList.remove('is-capturing');
      captureToggleBtn.title = 'Start capturing';
      captureToggleBtn.setAttribute('aria-label', 'Start capturing');
    }
  }

  function setCapturing(on: boolean): void {
    state.capturing = on;
    updateCaptureButton();
    void syncRecordingToMain();
    if (on) {
      if (shouldPollEvents()) startPolling();
      void loadBufferedForTab();
    } else {
      stopPolling();
    }
  }

  function eventRenderSig(e: ParsedNetworkEvent): string {
    return `${e.type}|${e.httpResponse?.statusCode ?? ''}|${e.httpRequest?.bodyBytes ?? ''}|${e.httpResponse?.bodyBytes ?? ''}|${e.hostname ?? ''}`;
  }

  // Drop oldest summaries when over the count cap, keeping the id index consistent. Returns true
  // if any were removed. (Bodies aren't held here, so a payload-byte cap is unnecessary.)
  function trimEvents(): boolean {
    if (state.events.length <= MAX_EVENTS) return false;
    const removed = state.events.splice(0, state.events.length - MAX_EVENTS);
    for (const e of removed) eventIndex.delete(e.id);
    return true;
  }

  // Returns true when state.events changed in a way that affects rendered sessions, so
  // callers only repaint on real updates (the buffer is re-fetched in full each poll).
  function mergeEvents(incoming: ParsedNetworkEvent[]): boolean {
    if (incoming.length === 0) return false;
    let changed = false;
    for (const ev of incoming) {
      const existing = eventIndex.get(ev.id);
      if (existing) {
        const idx = state.events.indexOf(existing);
        if (idx >= 0) {
          if (eventRenderSig(existing) !== eventRenderSig(ev)) {
            changed = true;
            dirtyEventIds.add(ev.id);
            // If the focused request itself changed (e.g. MITM Pending → 200), drop its cached
            // detail so the panes reload the fresh headers/body rather than showing stale data.
            if (ev.id === state.selectedEventId) {
              selectedDetail = null;
              detailLoadToken++;
            }
            // The event changed on disk too; allow its detail to be (re)fetched.
            detailUnavailableIds.delete(ev.id);
          }
          state.events[idx] = ev;
          eventIndex.set(ev.id, ev);
        }
      } else {
        changed = true;
        state.events.push(ev);
        eventIndex.set(ev.id, ev);
      }
    }
    if (trimEvents()) changed = true;
    if (changed) eventsVersion++;
    return changed;
  }

  function shouldPollEvents(): boolean {
    return state.capturing && (state.captureActive || state.mitmActive || !!state.mitmEnabled);
  }

  function startPolling(): void {
    if (pollTimer || !state.capturing) return;
    pollTimer = setInterval(() => {
      if (!shouldPollEvents()) return;
      // The push channel (onNetworkInspectorCaptureEvents) is the primary delivery path;
      // skip the costly full-buffer re-fetch when it delivered events recently. The poll
      // then only acts as a safety-net reconciliation when push is quiet.
      if (Date.now() - lastPushAt < 4000) return;
      void loadBufferedForTab();
    }, 2000);
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function syncWatchIps(): void {
    state.watchIps.clear();
    if (state.deviceIp) state.watchIps.add(state.deviceIp);
    if (state.hotspotIp) state.watchIps.add(state.hotspotIp);
  }

  function readPanelDeviceIp(): string {
    const ipEl = panel.querySelector('.device-ip');
    const text = ipEl?.textContent?.trim() || '';
    return /^\d+\.\d+\.\d+\.\d+$/.test(text) ? text : '';
  }

  /** Resolve the renderer's platform string to the shared setup-guide platform union. */
  function setupGuidePlatform(): NiSetupPlatform | null {
    if (state.platform === 'darwin' || state.platform === 'win32' || state.platform === 'linux') {
      return state.platform;
    }
    return null;
  }

  /**
   * Header setup badge (left of the filter box). Shows only when the hotspot is actually in
   * use — capture is only ever attempted once RDS detects a hotspot interface, so "hotspot
   * engaged" == capture running (`captureActive`) or a capture attempt that errored
   * (`captureError`). When no hotspot is up we don't nag — the user isn't using hotspot capture
   * yet. Clicking the badge opens the same per-platform setup guide as Settings.
   */
  function updateSetupBadge(): void {
    if (!setupBadgeBtn) return;
    // "Hotspot in play" covers three cases: capture is running, a capture attempt errored, OR a
    // hotspot is confidently detected but capture never started. That last case is what surfaces
    // the badge on Windows when Mobile Hotspot is on but Npcap isn't installed (capture can't be
    // attempted, so there's no captureError) — without it the user would get no in-context nudge.
    const hotspotInPlay =
      state.captureActive || !!state.captureError || !!state.hotspotInterfaceDetected;
    const failedPrereq = (state.prerequisites || []).find(
      (p) => !p.ok && p.docsPath === 'network-inspector'
    );
    const show = !!setupGuidePlatform() && hotspotInPlay && !!failedPrereq;
    setupBadgeBtn.hidden = !show;
    if (!show) return;
    // Severity: red when capture actively failed (you turned on the hotspot but capture is
    // blocked); yellow when it's just a setup-needed notice.
    const isError = !!state.captureError;
    setupBadgeBtn.classList.toggle('is-error', isError);
    setupBadgeBtn.classList.toggle('is-warn', !isError);
    if (setupBadgeLabel) setupBadgeLabel.textContent = isError ? 'Capture blocked' : 'Capture setup';
    setupBadgeBtn.title = failedPrereq
      ? `${failedPrereq.title} — click for setup instructions`
      : 'Hotspot capture setup — click for instructions';
  }

  /**
   * The header "Proxy Port unavailable" badge is the persistent, in-context indicator that the MITM
   * proxy can't bind its port. It's shown whenever a conflict exists and opens the full modal on
   * click. (The prominent warning itself is the modal — see {@link showPortConflictModal}.)
   */
  function updatePortBadge(): void {
    if (!(portBadgeBtn instanceof HTMLElement)) return;
    const conflict = state.mitmPortConflict;
    portBadgeBtn.hidden = !conflict;
    if (conflict) {
      portBadgeBtn.title = `${conflict.title} — click for details`;
    }
  }

  function portConflictKey(conflict: MitmPortConflict | null | undefined): string {
    if (!conflict) return '';
    return `${conflict.port}|${conflict.pid ?? ''}|${conflict.processName ?? ''}`;
  }

  function setPortConflict(conflict: MitmPortConflict | null | undefined): void {
    const next = conflict || null;
    const prevKey = portConflictKey(state.mitmPortConflict);
    const nextKey = portConflictKey(next);
    state.mitmPortConflict = next;
    updatePortBadge();
    // Reflect the blocked state on the capture toggle (icon + tooltip) whenever the conflict flips.
    updateCaptureButton();
    if (next) {
      // Only auto-open the modal while the user is actually on the Network tab; otherwise the badge
      // waits for them to arrive (or click it). The modal is a global singleton, so concurrent
      // device panels won't stack duplicate dialogs.
      if (networkTabForeground) showPortConflictModal(next);
    } else {
      hidePortConflictModal();
    }
    // The empty-state hint references the conflict, so repaint it when the conflict appears/clears.
    if (nextKey !== prevKey && state.events.length === 0) {
      scheduleSessionListPaint({ force: true });
    }
  }

  async function runCaptureSetup(): Promise<{ success?: boolean; error?: string }> {
    const api = window.roku;
    if (!api?.networkInspectorInstallBpfAccess) {
      return { success: false, error: 'Setup is not available in this build.' };
    }
    const res = await api.networkInspectorInstallBpfAccess();
    if (res?.success) {
      state.captureError = null;
      await refreshNetworkCaptureStatus();
      updateSetupBadge();
    }
    return res;
  }

  function openSetupModal(): void {
    const platform = setupGuidePlatform();
    if (!platform) return;
    openHotspotCaptureSetupModal({
      platform,
      onRunSetup: networkInspectorHasCaptureSetupAction(platform) ? runCaptureSetup : undefined
    });
  }

  function applyStatusFields(s: {
    packetsCaptured?: number;
    captureActive?: boolean;
    hotspotInterfaceDetected?: boolean;
    lastError?: string;
    captureInterface?: string;
    connectedClients?: Array<{ ip?: string; serialNumber?: string }>;
    eventsBuffered?: number;
    mitmEnabled?: boolean;
    mitmActive?: boolean;
    mitmListenAddress?: string;
    mitmLastError?: string;
    mitmPortConflict?: MitmPortConflict | null;
    mitmTransactions?: number;
    platform?: string;
    captureToolAvailable?: boolean;
    bpfCaptureAvailable?: boolean;
    bpfLaunchDaemonInstalled?: boolean;
    hotspotGatewayIp?: string;
  }): void {
    const clients = s.connectedClients || [];
    const match = clients.find(
      (c) =>
        (state.deviceSerial && c.serialNumber === state.deviceSerial) ||
        (c.ip && state.deviceIp && c.ip === state.deviceIp) ||
        (c.ip && state.hotspotIp && c.ip === state.hotspotIp)
    );
    if (match?.ip) {
      state.hotspotIp = match.ip;
      syncWatchIps();
    }
    const prevCaptureActive = state.captureActive;
    if (s.lastError) {
      state.captureError = s.lastError;
      state.captureActive = false;
    } else {
      state.captureError = null;
      state.captureActive = !!s.captureActive;
    }
    // Capture state gates the "Proxied" filter's relevance — refresh its visibility and repaint the
    // list (the effective filter changes) when it flips, even if no new events arrived.
    if (prevCaptureActive !== state.captureActive) {
      syncSidebarOptions();
      scheduleSessionListPaint({ force: true });
    }
    state.mitmEnabled = !!s.mitmEnabled;
    state.mitmActive = !!s.mitmActive;
    state.mitmListenAddress =
      typeof s.mitmListenAddress === 'string' ? s.mitmListenAddress : undefined;
    if (typeof s.mitmLastError === 'string') {
      state.mitmLastError = s.mitmLastError;
    } else if (s.mitmActive) {
      state.mitmLastError = undefined;
    }
    state.mitmTransactions = typeof s.mitmTransactions === 'number' ? s.mitmTransactions : 0;
    setPortConflict(s.mitmPortConflict ?? null);
    if (typeof s.platform === 'string') state.platform = s.platform;
    state.captureToolAvailable = s.captureToolAvailable === true;
    state.bpfCaptureAvailable = s.bpfCaptureAvailable === true;
    state.bpfLaunchDaemonInstalled = s.bpfLaunchDaemonInstalled === true;
    if (typeof s.hotspotInterfaceDetected === 'boolean') {
      state.hotspotInterfaceDetected = s.hotspotInterfaceDetected;
    }
    updateSetupBadge();
    if (
      state.capturing &&
      s.captureActive &&
      !s.lastError &&
      state.events.length === 0 &&
      (s.eventsBuffered ?? 0) > 0
    ) {
      void loadBufferedForTab();
    } else if (
      state.capturing &&
      s.mitmActive &&
      state.events.length === 0 &&
      (s.eventsBuffered ?? 0) > 0
    ) {
      void loadBufferedForTab();
    }
    if (shouldPollEvents()) startPolling();
    else stopPolling();
    updateCaptureButton();
  }

  async function refreshNetworkCaptureStatus(): Promise<void> {
    const api = window.roku;
    if (!api?.networkInspectorGetStatus) return;
    try {
      const res = await api.networkInspectorGetStatus();
      if (res?.status) applyStatusFields(res.status as Parameters<typeof applyStatusFields>[0]);
    } catch {
      /* ignore */
    }
  }

  async function loadBufferedForTab(): Promise<void> {
    if (!state.capturing) return;
    const api = window.roku;
    if (!api?.networkInspectorGetEvents) return;
    const now = Date.now();
    if (now - lastBufferedPollAt < 500) return;
    lastBufferedPollAt = now;
    const ips = Array.from(state.watchIps);
    if (state.hotspotIp && !ips.includes(state.hotspotIp)) ips.push(state.hotspotIp);
    if (state.deviceIp && !ips.includes(state.deviceIp)) ips.push(state.deviceIp);
    let anyChanged = false;
    for (const ip of ips) {
      try {
        // Cursor-based delta: pass the last sequence we've seen for this IP so the main process
        // returns only new/updated events (not the whole buffer), and advance the cursor from the
        // response so trimmed-out history is never re-delivered.
        const sinceSeq = lastSeqByIp.get(ip) ?? 0;
        const res = await api.networkInspectorGetEvents(ip, 2000, sinceSeq);
        if (res?.success) {
          if (typeof res.cursor === 'number') lastSeqByIp.set(ip, res.cursor);
          if (Array.isArray(res.events) && res.events.length > 0) {
            const filtered = res.events.filter((e) => eventMatchesTab(e, state));
            anyChanged = mergeEvents(filtered) || anyChanged;
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (anyChanged) {
      // A repaint also calls renderDetail('both'), which now no-ops unless the selected
      // event's content actually changed — so this updates statuses without wiping the
      // body pane when the user is reading an unchanged response.
      const followTail = !state.selectedEventId;
      scheduleSessionListPaint({ followTail });
      updateCaptureButton();
    }
  }

  captureToggleBtn?.addEventListener('click', () => {
    setCapturing(!state.capturing);
  }, listenerOpts);

  layoutToggleBtn?.addEventListener('click', () => {
    state.detailLayout = state.detailLayout === 'stacked' ? 'columns' : 'stacked';
    syncDetailLayout();
  }, listenerOpts);

  function applyFilterChange(): void {
    updateSessionCount();
    syncFilterClear();
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => {
      filterDebounceTimer = null;
      lastListSignature = '';
      refreshSessionList({ force: true });
    }, 160);
  }

  filterInput?.addEventListener('input', applyFilterChange, listenerOpts);

  filterClearBtn?.addEventListener('click', () => {
    if (!filterInput || !filterInput.value) return;
    filterInput.value = '';
    applyFilterChange();
    filterInput.focus();
  }, listenerOpts);

  filterHelpBtn?.addEventListener('click', () => {
    openFilterHelpModal((term) => {
      if (!filterInput) return;
      // Clicking an example chip appends the term (comma-OR) and applies it immediately.
      const current = filterInput.value.trim();
      filterInput.value = current ? `${current}, ${term}` : term;
      applyFilterChange();
      filterInput.focus();
    });
  }, listenerOpts);

  groupByHostInput?.addEventListener('change', () => {
    state.viewMode = groupByHostInput.checked ? 'structure' : 'sequence';
    lastListSignature = '';
    refreshSessionList({ force: true });
  }, listenerOpts);

  decryptedOnlyInput?.addEventListener('change', () => {
    state.decryptedOnly = !!decryptedOnlyInput.checked;
    lastListSignature = '';
    updateSessionCount();
    refreshSessionList({ scrollToSelection: !!state.selectedEventId, force: true });
  }, listenerOpts);

  sessionListEl?.addEventListener(
    'wheel',
    () => {
      markUserScrollingList();
    },
    { passive: true, signal: listenerAc.signal }
  );
  sessionListEl?.addEventListener(
    'scroll',
    // capture phase: scroll events don't bubble, and the only scrollable descendant of the
    // session list is the list scroller, so we can mark scrolling without a closest() check.
    () => {
      markUserScrollingList();
      updateListFabs();
    },
    { passive: true, capture: true, signal: listenerAc.signal }
  );

  scrollBottomFab?.addEventListener('click', () => {
    scrollListToBottom();
  }, listenerOpts);

  jumpErrorFab?.addEventListener('click', () => {
    jumpToLatestError();
  }, listenerOpts);

  sessionListEl?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const toggle = target?.closest('[data-struct-toggle]') as HTMLElement | null;
    if (toggle?.dataset.structToggle) {
      const host = toggle.dataset.structToggle;
      if (state.collapsedHosts.has(host)) state.collapsedHosts.delete(host);
      else state.collapsedHosts.add(host);
      lastListSignature = '';
      refreshSessionList({ force: true });
      return;
    }
    const row = target?.closest('[data-event-id]') as HTMLElement | null;
    if (row?.dataset.eventId) {
      const nextId = row.dataset.eventId;
      if (state.selectedEventId === nextId) return;
      state.selectedEventId = nextId;
      updateSelectionHighlight();
      lastListSignature = listSignature(filteredSessions());
      renderDetail('both');
      focusListForKeyboard();
    }
  }, listenerOpts);

  detailPane?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const urlBtn = target?.closest('[data-ni-url]') as HTMLElement | null;
    if (urlBtn?.dataset.niUrl) {
      e.preventDefault();
      openConsoleUrlViewer(urlBtn, urlBtn.dataset.niUrl, { titlePrefix: 'Network Inspector' });
      return;
    }
    const copyMenuToggle = target?.closest('[data-ni-copy-menu-toggle]') as HTMLElement | null;
    if (copyMenuToggle) {
      toggleCopyDropdown();
      return;
    }
    const copyItem = target?.closest('[data-ni-copy-item]') as HTMLElement | null;
    if (copyItem?.dataset.niCopyItem) {
      const kind = copyItem.dataset.niCopyItem;
      if (kind === 'curl' || kind === 'har') void exportSelectedAs(copyItem, kind);
      else void copyPaneContent(copyItem, 'request');
      closeCopyDropdown();
      return;
    }
    const copyBtn = target?.closest('[data-ni-copy]') as HTMLElement | null;
    if (copyBtn?.dataset.niCopy) {
      void copyPaneContent(copyBtn, copyBtn.dataset.niCopy);
      return;
    }
    const wrapBtn = target?.closest('[data-ni-wrap-toggle]') as HTMLElement | null;
    if (wrapBtn) {
      if (wrapBtn.dataset.niWrapToggle === 'response') {
        state.responseBodyWrap = !state.responseBodyWrap;
      } else {
        state.requestBodyWrap = !state.requestBodyWrap;
      }
      syncBodyWrap();
      return;
    }
    const reqTabBtn = target?.closest('[data-ni-req-tab]') as HTMLElement | null;
    if (reqTabBtn?.dataset.niReqTab) {
      const tab = reqTabBtn.dataset.niReqTab as RequestPaneTab;
      if (tab === 'overview' || tab === 'body') {
        if (state.requestTab === tab) return;
        state.requestTab = tab;
        renderDetail('request');
      }
      return;
    }
    const resTabBtn = target?.closest('[data-ni-res-tab]') as HTMLElement | null;
    if (resTabBtn?.dataset.niResTab) {
      const tab = resTabBtn.dataset.niResTab as ResponsePaneTab;
      if (tab === 'headers' || tab === 'body') {
        if (state.responseTab === tab) return;
        state.responseTab = tab;
        renderDetail('response');
      }
    }
  }, listenerOpts);

  // Dismiss the copy dropdown on an outside click or Escape so it behaves like a normal menu.
  document.addEventListener(
    'click',
    (e) => {
      if (!copyMenuEl || copyDropdownEl?.hidden) return;
      const t = e.target as Node | null;
      if (t && copyMenuEl.contains(t)) return;
      closeCopyDropdown();
    },
    { signal: listenerAc.signal }
  );
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && copyDropdownEl && !copyDropdownEl.hidden) {
        closeCopyDropdown();
        if (copyCaretEl instanceof HTMLElement) copyCaretEl.focus();
      }
    },
    { signal: listenerAc.signal }
  );

  requestFormatSelect?.addEventListener('change', () => {
    const value = requestFormatSelect.value as BodyFormatMode;
    if (value === 'auto' || value === 'json' || value === 'xml' || value === 'raw') {
      if (state.requestBodyFormat === value) return;
      state.requestBodyFormat = value;
      renderDetail('request');
    }
  }, listenerOpts);

  responseFormatSelect?.addEventListener('change', () => {
    const value = responseFormatSelect.value as BodyFormatMode;
    if (value === 'auto' || value === 'json' || value === 'xml' || value === 'raw') {
      if (state.responseBodyFormat === value) return;
      state.responseBodyFormat = value;
      renderDetail('response');
    }
  }, listenerOpts);

  function resetEventsState(): void {
    state.events = [];
    eventIndex.clear();
    lastSeqByIp.clear();
    state.selectedEventId = null;
    selectedDetail = null;
    detailLoadToken++;
    detailUnavailableIds.clear();
    eventsVersion++;
    lastListSignature = '';
    lastDetailSignature = '';
    lastStructureHosts = [];
    dirtyEventIds.clear();
  }

  clearBtn?.addEventListener('click', () => {
    void (async () => {
      await clearSessionsOnMain();
      resetEventsState();
      scheduleSessionListPaint({ force: true });
      updateCaptureButton();
    })();
  }, listenerOpts);

  saveBtn?.addEventListener('click', async () => {
    const api = window.roku;
    if (!api?.networkInspectorExportPcap) return;
    // Scope the pcap to this device's traffic only — capture stays whole-hotspot, but the
    // download filters to the watched device IPs (device + its hotspot lease).
    const ips = watchDeviceIps();
    await api.networkInspectorExportPcap(ips.length > 0 ? ips : undefined);
  }, listenerOpts);

  configureBtn?.addEventListener('click', () => {
    const deviceIp = state.hotspotIp || state.deviceIp;
    if (!deviceIp) return;
    const hostSuggestions: string[] = [];
    for (const e of state.events) {
      if (e.hostname) hostSuggestions.push(e.hostname);
    }
    // Prefer the live panel header name (kept in sync with discovery) over the value
    // captured at setup, falling back to model/serial when the device is unnamed.
    const panelName = panel.querySelector('.panel-device-name-text')?.textContent?.trim() || '';
    const deviceName = panelName || state.deviceName || '';
    void openTrafficRulesModal({
      deviceIp,
      deviceName,
      deviceSerial: state.deviceSerial,
      hostSuggestions
    });
  }, listenerOpts);

  setupBadgeBtn?.addEventListener('click', () => {
    openSetupModal();
  }, listenerOpts);

  portBadgeBtn?.addEventListener('click', () => {
    // Clicking the badge always (re)opens the modal, even if it was dismissed for this conflict.
    if (state.mitmPortConflict) showPortConflictModal(state.mitmPortConflict, { force: true });
  }, listenerOpts);

  // Treat switching into the Network inner tab as "the user came into the Network tab": auto-open
  // the port-conflict modal if one is outstanding, and close it when they navigate away.
  panel.addEventListener('innertabswitch', (e) => {
    const tab = (e as CustomEvent<{ tab?: string }>).detail?.tab;
    networkTabForeground = tab === 'network';
    if (networkTabForeground) {
      // Re-show on every entry into the Network tab (force), not just the first time — per
      // requirement that opening the section always surfaces an outstanding port conflict.
      if (state.mitmPortConflict) showPortConflictModal(state.mitmPortConflict, { force: true });
    } else {
      hidePortConflictModal();
    }
  }, listenerOpts);

  if (isRemote && tabBtn) {
    tabBtn.remove();
    tabContent?.remove();
  }

  updateCaptureButton();
  updateSetupBadge();
  updatePortBadge();
  syncDetailLayout();
  syncBodyWrap();
  syncFilterClear();
  void syncRecordingToMain();

  return {
    destroy() {
      listenerAc.abort();
      if (networkTabForeground) hidePortConflictModal();
      stopPolling();
      if (filterDebounceTimer) {
        clearTimeout(filterDebounceTimer);
        filterDebounceTimer = null;
      }
      if (userScrollIdleTimer) {
        clearTimeout(userScrollIdleTimer);
        userScrollIdleTimer = null;
      }
      if (listPaintRaf) {
        cancelAnimationFrame(listPaintRaf);
        listPaintRaf = 0;
      }
      listPaintQueued = null;
      dirtyEventIds.clear();
      state.events = [];
      eventIndex.clear();
      selectedDetail = null;
      sessionCache.clear();
    },
    setHotspotIp(ip: string | null) {
      state.hotspotIp = ip;
      syncWatchIps();
    },
    setDeviceIp(ip: string) {
      const next = ip?.trim() || '';
      if (!next || next === state.deviceIp) return;
      state.deviceIp = next;
      syncWatchIps();
      if (!state.hotspotIp) state.hotspotIp = next;
      void loadBufferedForTab();
    },
    setVisible(visible: boolean) {
      if (!tabBtn || !tabContent || isRemote) return;
      tabBtn.style.display = visible ? '' : 'none';
      if (visible) {
        tabContent.style.removeProperty('display');
        const panelIp = readPanelDeviceIp();
        if (panelIp) {
          state.deviceIp = panelIp;
          syncWatchIps();
        }
        if (!state.hotspotIp) {
          const ip = state.deviceIp || panelIp;
          if (ip) state.hotspotIp = ip;
        }
        updateCaptureButton();
        render();
        void refreshNetworkCaptureStatus();
        void syncRecordingToMain();
        void loadBufferedForTab();
        if (state.capturing) startPolling();
      } else {
        // Tab fully hidden (e.g. device left hotspot / panel deactivated): it's no longer the
        // foreground Network tab, so drop the modal if this instance owned it.
        if (networkTabForeground) hidePortConflictModal();
        networkTabForeground = false;
        stopPolling();
      }
    },
    appendEvents(events: ParsedNetworkEvent[]) {
      if (!state.capturing) return;
      lastPushAt = Date.now();
      const filtered = events.filter((e) => eventMatchesTab(e, state));
      if (filtered.length === 0) return;
      const hadSelection = !!state.selectedEventId;
      mergeEvents(filtered);
      if (!state.hotspotIp && filtered[0]?.deviceIp) {
        state.hotspotIp = filtered[0].deviceIp;
        syncWatchIps();
      }
      if (!hadSelection && filtered.length > 0) {
        state.selectedEventId = filtered[filtered.length - 1].id;
      }
      scheduleSessionListPaint({ followTail: !hadSelection });
      updateCaptureButton();
    },
    clearEvents() {
      void (async () => {
        await clearSessionsOnMain();
        resetEventsState();
        scheduleSessionListPaint({ force: true });
        updateCaptureButton();
      })();
    },
    setCaptureStatus(status) {
      // Keep the readiness fields and structured prerequisites fresh on every
      // push so the blocked-state banner can render the main-process remediation
      // steps (not just a raw `lastError` string).
      if (typeof status.platform === 'string') state.platform = status.platform;
      if (typeof status.captureToolAvailable === 'boolean') state.captureToolAvailable = status.captureToolAvailable;
      if (typeof status.bpfCaptureAvailable === 'boolean') state.bpfCaptureAvailable = status.bpfCaptureAvailable;
      if (typeof status.bpfLaunchDaemonInstalled === 'boolean') state.bpfLaunchDaemonInstalled = status.bpfLaunchDaemonInstalled;
      if (typeof status.hotspotInterfaceDetected === 'boolean') state.hotspotInterfaceDetected = status.hotspotInterfaceDetected;
      if (Array.isArray(status.prerequisites)) state.prerequisites = status.prerequisites;
      // The MITM port conflict is independent of hotspot capture state, so evaluate it even when a
      // capture error short-circuits the rest of this handler below.
      setPortConflict(status.mitmPortConflict ?? null);
      if (status.lastError) {
        state.captureError = status.lastError;
        state.captureActive = false;
        updateSetupBadge();
        if (state.events.length === 0) scheduleSessionListPaint({ force: true });
        return;
      }
      state.captureError = null;
      const prevCaptureActiveStatus = state.captureActive;
      state.captureActive = !!status.captureActive;
      if (prevCaptureActiveStatus !== state.captureActive) {
        syncSidebarOptions();
        scheduleSessionListPaint({ force: true });
      }
      if (typeof status.mitmEnabled === 'boolean') state.mitmEnabled = status.mitmEnabled;
      if (typeof status.mitmActive === 'boolean') state.mitmActive = status.mitmActive;
      if (typeof status.mitmListenAddress === 'string') {
        state.mitmListenAddress = status.mitmListenAddress;
      }
      if (typeof status.mitmLastError === 'string') {
        state.mitmLastError = status.mitmLastError;
      } else if (status.mitmActive) {
        state.mitmLastError = undefined;
      }
      if (typeof status.mitmTransactions === 'number') {
        state.mitmTransactions = status.mitmTransactions;
      }
      if (status.captureActive || status.mitmActive) {
        if (state.capturing) startPolling();
        if (
          state.capturing &&
          state.events.length === 0 &&
          ((status.eventsBuffered ?? 0) > 0)
        ) {
          void loadBufferedForTab();
        }
      } else if (!state.capturing) {
        stopPolling();
      } else if (!status.captureActive && !status.mitmActive) {
        stopPolling();
      }
      // Re-evaluate the setup badge on every (non-error) status push too, so it clears live once
      // capture recovers — e.g. after Npcap is installed and capture starts, or macOS BPF access is
      // granted — without waiting for a tab re-show. The error branch above already does this.
      updateSetupBadge();
      updateCaptureButton();
    },
    loadBufferedEvents(events) {
      if (!state.capturing) return;
      const filtered = events.filter((e) => eventMatchesTab(e, state));
      if (filtered.length === 0) return;
      const hadSelection = !!state.selectedEventId;
      mergeEvents(filtered);
      refreshSessionList({ followTail: !hadSelection });
      updateCaptureButton();
    }
  };
}

export function initNetworkInspectorBridge(handlers: {
  onDeviceDiscovered: (device: Record<string, unknown>) => void;
  onDeviceJoined: (payload: { serialNumber?: string; ip?: string }) => void;
  onDeviceLeft: (payload: { serialNumber?: string }) => void;
  onClientsCleared: () => void;
  onStatus: (status: Record<string, unknown>) => void;
  onCaptureEvents: (events: ParsedNetworkEvent[]) => void;
}): () => void {
  const api = window.roku;
  if (!api) return () => undefined;
  const cleanups: Array<() => void> = [];
  if (api.onNetworkInspectorDeviceDiscovered) {
    cleanups.push(api.onNetworkInspectorDeviceDiscovered((d) => handlers.onDeviceDiscovered(d as Record<string, unknown>)));
  }
  if (api.onNetworkInspectorDeviceJoined) {
    cleanups.push(api.onNetworkInspectorDeviceJoined((d) => handlers.onDeviceJoined(d as { serialNumber?: string; ip?: string })));
  }
  if (api.onNetworkInspectorDeviceLeft) {
    cleanups.push(api.onNetworkInspectorDeviceLeft((d) => handlers.onDeviceLeft(d as { serialNumber?: string })));
  }
  if (api.onNetworkInspectorClientsCleared) {
    cleanups.push(api.onNetworkInspectorClientsCleared(() => handlers.onClientsCleared()));
  }
  if (api.onNetworkInspectorStatus) {
    cleanups.push(api.onNetworkInspectorStatus((s) => handlers.onStatus(s as Record<string, unknown>)));
  }
  if (api.onNetworkInspectorCaptureEvents) {
    cleanups.push(api.onNetworkInspectorCaptureEvents((e) => handlers.onCaptureEvents(e as ParsedNetworkEvent[])));
  }
  return () => cleanups.forEach((fn) => fn());
}

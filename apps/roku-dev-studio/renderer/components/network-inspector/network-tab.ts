import type { ParsedNetworkEvent } from '@shared/network-inspector/types';
import { escapeHtml } from '../../modules/utils/dom.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import {
  renderSidebarSequence,
  renderSidebarRows,
  renderStructureTree,
  renderStructureLeaves,
  statusPillHtml,
  rowMetaPartsHtml,
  syncGroupToggleButton as syncGroupToggleButtonShared
} from './network-session-view.js';
import {
  renderRequestPane,
  renderResponsePane,
  getLargeBodyKb,
  getLargeBodyDowngraded,
  upgradeStructuredBodies,
  type BodyFormatMode,
  type RequestPaneTab,
  type ResponsePaneTab
} from './network-detail.js';
import { buildSessions, buildStructureGroups, filterSessions } from './network-sessions.js';
import { openConsoleUrlViewer } from '../../modules/console-log/console-url-modal.js';
import { openConsoleStructuredViewer } from '../../modules/console-log/console-structured-view-modal.js';
import { getEmbeddedStructuredPayload } from './network-embedded-structured.js';
import { makeCenteredSearchResizable } from '../../modules/ui/header-search-resize.js';
import { filterWidthKey, filterHistoryKey } from '../../modules/ui/search-storage-keys.js';
import { DETAIL_PANE_HTML, wireDetailInteractions, syncBodyWrap as syncBodyWrapShared } from './network-detail-view.js';
import { wireNetworkFilterControls } from './network-filter-help.js';
import { openTrafficRulesModal } from './traffic-rules-modal.js';
import {
  buildCurlCommand,
  buildHarArchive,
  buildHarArchiveAll,
  buildNetworkSessionFile,
  isExportableEvent,
  NETWORK_SESSION_FILE_EXT
} from './network-export.js';
import { showToast } from '../../modules/utils/ui.js';
import { openHotspotCaptureSetupModal } from './hotspot-setup-modal.js';
import {
  showPortConflictModal,
  hidePortConflictModal,
  resolvePortConflictModal
} from './port-conflict-modal.js';
import {
  networkInspectorHasCaptureSetupAction,
  type NiSetupPlatform
} from '@shared/network-inspector/setup-guide.js';
import {
  createMultiFindBar,
  buildMultiFindBarElement,
  type MultiFindHandle,
  type MkwKeyword
} from '../../modules/ui/multi-keyword-find-bar.js';
import { createPaneFindStore, sameKeywordTexts } from '../../modules/ui/pane-find-store.js';
import {
  supportsCssHighlights,
  ensureFindHighlightStyles,
  paintMatchHighlights,
  clearFindHighlights
} from '../../modules/ui/find-highlight.js';
import { createNetworkFindModal, type FindModalHandle } from './network-find-modal.js';
import { paneBodyText, flashCopied } from './network-copy.js';
import type { NetworkFindMatch } from '@shared/network-inspector/content-search';
import {
  applyFindDecorations as applyFindDecorationsShared,
  visibleFindOrder as visibleFindOrderShared,
  type FindTermInfo
} from './network-find-decorations.js';
import { attachFoldToggle, MAX_STRUCTURED_BYTES } from '../../modules/ui/structured-body.js';
import { attachSelectAll } from '../../modules/ui/select-all.js';

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
  /**
   * True when more than one device tab is open. With a single device a tab may use the permissive
   * "any hotspot client" discovery fallback (fast first paint before its lease is known); with
   * multiple devices that fallback is disabled so a tab can't claim another device's traffic before
   * its own hotspot lease resolves by serial. See {@link eventMatchesTab}.
   */
  multiDevice: boolean;
  captureError: string | null;
  captureActive: boolean;
  /** Raw frames retained for pcap export (mirrors the main-process export guard). 0 ⇒ pcap export
   *  has nothing to write, so the pcap download option is hidden. */
  rawPacketsAvailable: number;
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

/**
 * Explainer for the "shown as raw text" case: a JSON/XML body too large to render as a collapsible
 * tree. Opened from the small amber "i" beside the Format selector (set by `setFormatInfo`), so it
 * only ever appears for a genuine structured→raw downgrade — never for natively-raw bodies. Reuses
 * the filter-help modal's shell styling for consistency.
 */
function openLargeBodyInfoModal(kb: number): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay ni-filter-help-overlay ni-large-body-overlay active';
  const sizeLabel = kb > 0 ? `${kb.toLocaleString()} KB` : 'This body';
  const limitKb = Math.round(MAX_STRUCTURED_BYTES / 1024).toLocaleString();
  overlay.innerHTML = `
    <div class="ni-filter-help-modal" role="dialog" aria-modal="true" aria-label="Shown as Raw Text">
      <div class="ni-filter-help-header">
        <h3>Shown as Raw Text</h3>
        <button type="button" class="modal-close ni-large-body-close" title="Close" aria-label="Close">×</button>
      </div>
      <div class="ni-filter-help-body">
        <p class="ni-filter-help-intro">This body is <strong>${escapeHtml(sizeLabel)}</strong> — larger than the ${escapeHtml(limitKb)} KB limit for rendering a collapsible, syntax-highlighted JSON/XML tree. To keep the inspector responsive, the <strong>entire</strong> body is shown as raw text instead. Nothing is truncated or hidden.</p>
        <p class="ni-filter-help-note">Copy, Save, and Find still operate on the full body. Embedded JSON/XML fragments remain clickable. Select a smaller response to see the formatted tree.</p>
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
  overlay.querySelector('.ni-large-body-close')?.addEventListener('click', close);
}

function eventMatchesTab(ev: ParsedNetworkEvent, state: NetworkTabState): boolean {
  // IPs known to belong to this device (its LAN IP + resolved hotspot lease).
  if (state.watchIps.has(ev.deviceIp)) return true;
  const watch = state.hotspotIp || state.deviceIp;
  if (watch && ev.deviceIp === watch) return true;
  // Discovery fallback: only before this tab has resolved its hotspot lease, AND only when this is
  // the sole device tab. With multiple devices open this "any hotspot client" match is unsafe — a
  // tab could claim another device's traffic before its own lease resolves by serial — so we filter
  // strictly by identity (deviceIp/hotspotIp/watchIps) and let the serial-based resolution set the
  // lease. With a single device the fallback is harmless (the only client IS this device).
  if (!state.multiDevice && !state.hotspotIp && isHotspotClientIp(ev.deviceIp)) return true;
  return false;
}

export function setupNetworkTab(
  panel: HTMLElement,
  device: { ip: string; serialNumber?: string; deviceName?: string; modelName?: string },
  isRemote: boolean
): {
  destroy: () => void;
  setHotspotIp: (ip: string | null) => void;
  /** Tell the tab whether more than one device tab is open (disables the single-device discovery
   *  fallback so tabs don't cross-claim traffic). */
  setMultiDevice: (multi: boolean) => void;
  setDeviceIp: (ip: string) => void;
  setVisible: (visible: boolean) => void;
  appendEvents: (events: ParsedNetworkEvent[]) => void;
  clearEvents: () => void;
  setCaptureStatus: (status: {
    packetsCaptured?: number;
    rawPacketsAvailable?: number;
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
    multiDevice: false,
    captureError: null,
    captureActive: false,
    rawPacketsAvailable: 0,
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
  // Stable, monotonic capture number per event (assigned on first sight), so the row index shown to
  // the user never renumbers when the oldest events are trimmed or the filter changes. Independent
  // of the event's position in `state.events`.
  const seqById = new Map<string, number>();
  let captureSeq = 0;
  // Set when a trim removed front events: the incremental row-patch assumes tail-only growth, which
  // is invalid after a front removal, so the next paint must do a full rebuild.
  let listNeedsRebuild = false;

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
    const result = buildSessions(state.events, { decryptedOnly, seqById });
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
  // The detail pane's request/response markup is single-sourced in `network-detail-view.ts` and
  // injected here, before the per-pane element queries below read from it. (Shared with the
  // standalone Session Viewer so the two never drift.)
  if (detailPane instanceof HTMLElement) detailPane.innerHTML = DETAIL_PANE_HTML;
  const copyMenuEl = panel.querySelector('[data-ni-copy-menu]') as HTMLElement | null;
  const copyCaretEl = panel.querySelector('[data-ni-copy-menu-toggle]') as HTMLElement | null;
  const copyDropdownEl = panel.querySelector('[data-ni-copy-dropdown]') as HTMLElement | null;
  const scrollBottomFab = panel.querySelector('[data-ni-scroll-bottom]') as HTMLButtonElement | null;
  const requestBodyEl = panel.querySelector('[data-ni-request-body]');
  const responseBodyEl = panel.querySelector('[data-ni-response-body]');
  // Per-pane find-in-body controllers (shared simple find bar). The bars are built + inserted in
  // the init block below; null when the body elements are missing (defensive).
  let requestSearch: MultiFindHandle | null = null;
  let responseSearch: MultiFindHandle | null = null;
  // "Find in content" (URL/headers/bodies) modal + its result state. Distinct from the toolbar
  // Filter (summary-only). Matches badge the session list ("keep all + badge & jump"); the focused
  // match seeds the detail-pane find bars so the hit highlights in the body too.
  let findModal: FindModalHandle | null = null;
  let findMatches = new Map<string, NetworkFindMatch>();
  // Term id → {color, query}, in term order — drives the multi-color segmented row bar and the
  // per-row body-highlight seed. Rebuilt each search.
  let findTermInfo: FindTermInfo = new Map();
  let findCurrentId: string | null = null;
  // The Find modal's non-regex terms as {text,color}, used to seed the detail-pane multi-keyword find
  // bars + the URL/header seed highlight for the selected request. Sourced live from the modal.
  const currentSeedKeywords = (): MkwKeyword[] => findModal?.getSeedKeywords() ?? [];
  // Per-request divergence for the detail-pane find bars — the store + union + edit-diff live in the
  // shared `pane-find-store.ts`; this host only supplies the modal terms (match-gated) + selected id.
  const paneFind = createPaneFindStore({
    modalSeedFor: (id) => (findMatches.has(id) ? (findModal?.getSeedTerms() ?? []) : []),
    getSelectedId: () => state.selectedEventId
  });
  // Guards the live re-search while the Find modal is open — only re-run when events/filter change.
  let lastFindRefreshSig = '';
  // Debounce the live re-search: a capture burst bumps eventsVersion every frame, so coalesce into one
  // search after the traffic settles (the incremental main-process cache makes each search cheap, but
  // this keeps us from firing one IPC round-trip per frame during heavy capture).
  let findRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleLiveFindRefresh = (): void => {
    clearTimeout(findRefreshTimer);
    findRefreshTimer = setTimeout(() => {
      if (findModal?.isActive()) findModal.refresh();
    }, 180);
  };
  const requestFormatWrapEl = panel.querySelector('[data-ni-req-format-wrap]');
  const responseFormatWrapEl = panel.querySelector('[data-ni-res-format-wrap]');
  const requestTruncatedBadgeEl = panel.querySelector('[data-ni-req-truncated]');
  const responseTruncatedBadgeEl = panel.querySelector('[data-ni-res-truncated]');
  const requestFormatInfoEl = panel.querySelector('[data-ni-req-format-info]');
  const responseFormatInfoEl = panel.querySelector('[data-ni-res-format-info]');
  // Whether the currently-selected event's request/response body was truncated during capture.
  // Set in `renderDetail`, consumed by `syncPaneChrome` so the header badge tracks tab switches and
  // unchanged-signature repaints (both of which route through `syncPaneChrome`).
  let reqBodyTruncated = false;
  let resBodyTruncated = false;
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
  const groupToggleBtn = panel.querySelector('[data-ni-toggle-all-groups]') as HTMLButtonElement | null;
  const clearBtn = panel.querySelector('[data-ni-clear]');
  const findBtn = panel.querySelector('[data-ni-find]') as HTMLButtonElement | null;
  const findBtnGroup = panel.querySelector('.ni-find-btn-group') as HTMLElement | null;
  const findClearBtn = panel.querySelector('[data-ni-find-clear]') as HTMLButtonElement | null;
  const findPrevBtn = panel.querySelector('[data-ni-find-prev]') as HTMLButtonElement | null;
  const findNextBtn = panel.querySelector('[data-ni-find-next]') as HTMLButtonElement | null;
  const downloadMenuEl = panel.querySelector('[data-ni-download-menu]') as HTMLElement | null;
  const downloadToggleEl = panel.querySelector('[data-ni-download-toggle]') as HTMLElement | null;
  const downloadDropdownEl = panel.querySelector('[data-ni-download-dropdown]') as HTMLElement | null;
  const downloadPcapItemEl = panel.querySelector('[data-ni-download-item="pcap"]') as HTMLElement | null;
  const configureBtn = panel.querySelector('[data-ni-configure]');
  const setupBadgeBtn = panel.querySelector('[data-ni-setup-badge]') as HTMLElement | null;
  const setupBadgeLabel = panel.querySelector('[data-ni-setup-badge-label]') as HTMLElement | null;
  const filterClearBtn = panel.querySelector('[data-ni-filter-clear]') as HTMLElement | null;
  const filterHelpBtn = panel.querySelector('[data-ni-filter-help]') as HTMLElement | null;
  // Centered, drag-to-resize behavior for the session filter (its .ni-header-center
  // is now absolutely centered on the header — see CSS).
  const niHeaderCenter = panel.querySelector('.ni-header-center');
  const niFilterResize =
    niHeaderCenter instanceof HTMLElement
      ? makeCenteredSearchResizable(niHeaderCenter, {
          storageKey: filterWidthKey('ni', device.ip || 'unknown'),
          leftGroupSelector: '.ni-header-start',
          rightGroupSelector: '.ni-header-controls',
          minWidthPx: 280
        })
      : null;
  // The resize handle is created at the right edge of the whole centered slot, which also holds the
  // session count — so it lands to the right of the count. Reparent it into the filter box so it
  // anchors to the text box's right edge instead (its `right:-9px` is relative to `.ni-filter-wrap`,
  // which is position:relative), sitting directly beside the input.
  if (niHeaderCenter instanceof HTMLElement) {
    const resizeHandle = niHeaderCenter.querySelector(':scope > .hdr-search-resize');
    const filterWrap = niHeaderCenter.querySelector('.ni-filter-wrap');
    if (resizeHandle && filterWrap instanceof HTMLElement) filterWrap.appendChild(resizeHandle);
  }
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
      .querySelectorAll(
        '.ni-sidebar-row-selected, .ni-seq-row-selected, .ni-struct-leaf-selected, .ni-struct-host-row-selected'
      )
      .forEach((el) => {
        el.classList.remove(
          'ni-sidebar-row-selected',
          'ni-seq-row-selected',
          'ni-struct-leaf-selected',
          'ni-struct-host-row-selected'
        );
      });
    if (!state.selectedEventId) return;
    const row = sessionListEl.querySelector(
      `[data-event-id="${CSS.escape(state.selectedEventId)}"]`
    ) as HTMLElement | null;
    if (!row) return;
    if (row.classList.contains('ni-sidebar-row')) row.classList.add('ni-sidebar-row-selected');
    else if (row.classList.contains('ni-seq-row')) row.classList.add('ni-seq-row-selected');
    else if (row.classList.contains('ni-struct-leaf')) {
      row.classList.add('ni-struct-leaf-selected');
      // If the leaf's group is collapsed, the leaf itself is hidden — surface
      // the selection on the (visible) group header instead/as well.
      const host = row.closest('.ni-struct-host');
      if (host?.classList.contains('ni-struct-host-collapsed')) {
        host.querySelector(':scope > .ni-struct-host-row')?.classList.add('ni-struct-host-row-selected');
      }
    }
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

  /** Toggle the scroll-to-latest floating affordance (shown only when scrolled up off the bottom). */
  function updateListFabs(): void {
    if (scrollBottomFab) {
      const wrap = listScrollWrap();
      const atBottom = !wrap || wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 8;
      const scrollable = !!wrap && wrap.scrollHeight - wrap.clientHeight > 8;
      scrollBottomFab.hidden = !scrollable || atBottom;
    }
  }

  function scrollListToBottom(): void {
    const wrap = listScrollWrap();
    if (!wrap) return;
    wrap.scrollTop = wrap.scrollHeight;
    updateListFabs();
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

  /** Select an event by id (used by Find navigation): render its detail + scroll it into view. */
  /** In Group-by-Host view, expand the host group that contains `id` if it's collapsed (so a Find
   *  jump can land inside a folded group). Returns true when it changed state (a re-render is due). */
  function ensureEventRevealed(id: string): boolean {
    if (state.viewMode !== 'structure') return false;
    const session = filteredSessions().find((s) => s.eventId === id);
    if (!session) return false;
    const hostKey = session.host.toLowerCase();
    if (!state.collapsedHosts.has(hostKey)) return false;
    state.collapsedHosts.delete(hostKey);
    return true;
  }

  function selectEventById(id: string): void {
    const revealed = ensureEventRevealed(id);
    if (state.selectedEventId !== id) {
      state.selectedEventId = id;
      updateSelectionHighlight();
      lastListSignature = listSignature(filteredSessions());
      renderDetail('both');
    }
    if (revealed) {
      // The group just expanded — repaint so the (now-visible) leaf exists, then scroll to it.
      lastListSignature = '';
      refreshSessionList({ force: true, scrollToSelection: true });
    } else {
      scrollSelectedRowIntoView();
    }
  }

  /** Build the CSS `background` value for a row's left bar: one equal-height color segment per matched
   *  term (in term order). One color → a solid bar; N colors → hard-stop vertical thirds/quarters. */
  /** Badge matching rows + emphasize the focused match + flag collapsed host groups — delegates to the
   *  shared decorator (network-find-decorations.ts), shared with the standalone Session Viewer. */
  function applyFindDecorations(): void {
    if (!(sessionListEl instanceof HTMLElement)) return;
    applyFindDecorationsShared({
      listEl: sessionListEl,
      matches: findMatches,
      termInfo: findTermInfo,
      currentId: findCurrentId
    });
  }

  /** The ordered set Find's Prev/Next walks — visible (filtered-in) matches in on-screen order
   *  (Group-by-Host follows DOM leaf order; sequence view follows capture order). */
  function visibleFindOrder(): string[] {
    return visibleFindOrderShared({
      viewMode: state.viewMode,
      listEl: sessionListEl instanceof HTMLElement ? sessionListEl : null,
      sequenceIds: filteredSessions().map((s) => s.eventId),
      matches: findMatches
    });
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
    // O(1) via the id→event index (kept in sync by mergeEvents/trim), not an O(n) array scan.
    return eventIndex.get(state.selectedEventId) ?? null;
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

  /** Show/hide the small amber "i" beside the Format selector. It appears ONLY when a JSON/XML body
   *  was too large to render as a collapsible tree and is shown as raw text instead (`downgraded`) —
   *  i.e. the one case where "why is this raw?" needs explaining. Natively-raw bodies (JS/CSS/text)
   *  get no affordance, since raw is their expected rendering. The KB size is stashed on the button
   *  for the click-opened explainer modal. */
  function setFormatInfo(btnEl: Element | null, kb: number, downgraded: boolean): void {
    if (!(btnEl instanceof HTMLElement)) return;
    const show = kb > 0 && downgraded;
    btnEl.hidden = !show;
    if (show) btnEl.dataset.kb = String(kb);
    else delete btnEl.dataset.kb;
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
      if (requestTruncatedBadgeEl instanceof HTMLElement) {
        requestTruncatedBadgeEl.hidden = !(reqBodyTruncated && state.requestTab === 'body');
      }
      setFormatInfo(
        requestFormatInfoEl,
        state.requestTab === 'body' ? getLargeBodyKb('request') : 0,
        getLargeBodyDowngraded('request')
      );
      // Find visibility is decided in afterBodyRender (it depends on the rendered content —
      // only text bodies are searchable, not image/video previews).
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
      if (responseTruncatedBadgeEl instanceof HTMLElement) {
        responseTruncatedBadgeEl.hidden = !(resBodyTruncated && state.responseTab === 'body');
      }
      setFormatInfo(
        responseFormatInfoEl,
        state.responseTab === 'body' ? getLargeBodyKb('response') : 0,
        getLargeBodyDowngraded('response')
      );
      // Find visibility is decided in afterBodyRender (depends on rendered content).
    }
  }

  /** Find only makes sense for text bodies. Image/video/audio previews and empty/placeholder
   *  states have nothing to search — so the bar stays hidden there (but appears for the same
   *  binary body when viewed as Raw, which renders the bytes as text). */
  function bodyIsSearchable(bodyEl: Element | null): boolean {
    if (!(bodyEl instanceof HTMLElement)) return false;
    if (bodyEl.querySelector('.ni-media-wrap')) return false;
    if (bodyEl.children.length === 1 && bodyEl.firstElementChild?.classList.contains('ni-pane-empty')) {
      return false;
    }
    return (bodyEl.textContent?.trim().length ?? 0) > 0;
  }

  /** After a body render: upgrade any fold tree, then show/hide + refresh the find bar based on the
   *  active tab AND whether the rendered content is searchable text. */
  function afterBodyRender(which: 'request' | 'response' | 'both'): void {
    if (which !== 'response') {
      upgradeStructuredBodies(requestBodyEl);
      requestSearch?.setVisible(state.requestTab === 'body' && bodyIsSearchable(requestBodyEl));
      requestSearch?.refresh();
      syncPaneSeedHighlight('request');
    }
    if (which !== 'request') {
      upgradeStructuredBodies(responseBodyEl);
      responseSearch?.setVisible(state.responseTab === 'body' && bodyIsSearchable(responseBodyEl));
      responseSearch?.refresh();
      syncPaneSeedHighlight('response');
    }
    seedDetailFind(which);
  }

  // Standalone highlight of the Find term on the NON-body tabs (Overview URL, Headers). The Body tab
  // has its own find bar (with a count); everywhere else we just paint the match with the same amber
  // tint so a hit in the URL or a header is visible. Separate highlight-registry ids per pane so the
  // two panes (and the body find bars, which use `ni-find-*`) never clobber each other.
  const SEED_HL_REQUEST = 'ni-detail-seed-request';
  const SEED_HL_RESPONSE = 'ni-detail-seed-response';
  const SEED_HL_CAP = 2000;

  function paintSeedInPane(el: HTMLElement, id: string, keywords: string[]): void {
    ensureFindHighlightStyles(id);
    clearFindHighlights(id);
    const needles = keywords.map((k) => k.toLowerCase()).filter((n) => n.length > 0);
    if (needles.length === 0 || !supportsCssHighlights) return;
    const ranges: Range[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode()) && ranges.length < SEED_HL_CAP) {
      const text = node.nodeValue ?? '';
      if (!text) continue;
      const hay = text.toLowerCase();
      for (const needle of needles) {
        let idx = hay.indexOf(needle);
        while (idx !== -1 && ranges.length < SEED_HL_CAP) {
          const range = document.createRange();
          try {
            range.setStart(node, idx);
            range.setEnd(node, idx + needle.length);
            ranges.push(range);
          } catch {
            /* ignore an un-rangeable node */
          }
          idx = hay.indexOf(needle, idx + needle.length);
        }
      }
    }
    paintMatchHighlights(id, ranges);
  }

  /** Paint (or clear) the seed-keyword highlight for one pane's non-body tabs. */
  function syncPaneSeedHighlight(which: 'request' | 'response'): void {
    const el = which === 'request' ? requestBodyEl : responseBodyEl;
    const tab = which === 'request' ? state.requestTab : state.responseTab;
    const id = which === 'request' ? SEED_HL_REQUEST : SEED_HL_RESPONSE;
    const keywords = currentSeedKeywords().map((k) => k.text);
    if (!(el instanceof HTMLElement) || tab === 'body' || !selectedIsFindMatch() || keywords.length === 0) {
      clearFindHighlights(id);
      return;
    }
    paintSeedInPane(el, id, keywords);
  }

  /** True when the currently-selected request is a Find match (so its detail should show the terms). */
  function selectedIsFindMatch(): boolean {
    return !!state.selectedEventId && findMatches.has(state.selectedEventId);
  }

  /** Seed the in-body Request/Response find bars for the selected request. The chip set is the
   *  view-time union of that request's stored user terms + the modal's terms (regex + substring; see
   *  {@link createPaneFindStore}). The body find only searches the *rendered body*, so a request
   *  matched via URL/headers may show no in-body results even though it's a valid match — expected. */
  function seedPane(which: 'request' | 'response', id: string, jumpToFirst: boolean): void {
    const bar = which === 'request' ? requestSearch : responseSearch;
    if (!bar) return;
    const eff = paneFind.computeEffective(id, which);
    // On a PASSIVE reseed (live-event refresh, jumpToFirst=false) skip the re-push when the chip set is
    // unchanged — otherwise every incoming request would reset the nav cursor (the orange current-match)
    // even though nothing changed. Explicit actions (selection/navigation) always reseed + jump.
    if (!jumpToFirst && sameKeywordTexts(eff, bar.getKeywords())) return;
    bar.setKeywords(eff, jumpToFirst);
  }

  function seedDetailFind(which: 'request' | 'response' | 'both' = 'both', jumpToFirst = true): void {
    const id = state.selectedEventId;
    if (!id) return;
    if (which !== 'response') seedPane('request', id, jumpToFirst);
    if (which !== 'request') seedPane('response', id, jumpToFirst);
  }

  /** Re-apply the Find term to the CURRENTLY-selected request's detail (body find bars + URL/header
   *  highlight). Call after the match set / query changes so the request in view updates immediately,
   *  without waiting for a re-render. `jumpToFirst=false` while typing so the body doesn't scroll. */
  function syncSelectedDetailFind(jumpToFirst: boolean): void {
    seedDetailFind('both', jumpToFirst);
    syncPaneSeedHighlight('request');
    syncPaneSeedHighlight('response');
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
      requestSearch?.setVisible(false);
      responseSearch?.setVisible(false);
      reqBodyTruncated = false;
      resBodyTruncated = false;
      if (requestTruncatedBadgeEl instanceof HTMLElement) requestTruncatedBadgeEl.hidden = true;
      if (responseTruncatedBadgeEl instanceof HTMLElement) responseTruncatedBadgeEl.hidden = true;
      return;
    }
    detailPane.classList.remove('is-empty');
    const loaded = selectedDetail?.id === summary.id;
    const ev = detailRenderEvent() ?? summary;
    // Drive the header "Body Truncated" badges (toggled in `syncPaneChrome`). The summary carries
    // `bodyTruncated` even before the full detail loads, so this is correct on first paint too.
    reqBodyTruncated = !!ev.httpRequest?.bodyTruncated;
    resBodyTruncated = !!ev.httpResponse?.bodyTruncated;
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
    afterBodyRender(which);
    if (needsDetail) void ensureDetailLoaded(summary);
  }

  function renderDecryptedOnlyEmpty(): void {
    if (!(sessionListEl instanceof HTMLElement)) return;
    const proxyAddr = state.mitmListenAddress || 'machine-ip:8888';
    let mitmLine: string;
    if (state.mitmActive) {
      mitmLine =
        `MITM proxy is active at <strong>${escapeHtml(proxyAddr)}</strong> — route your Dev channel's requests through it to capture them.`;
    } else if (state.mitmPortConflict) {
      const c = state.mitmPortConflict;
      const who = c.processName ? `${escapeHtml(c.processName)}${c.pid ? ` (PID ${c.pid})` : ''}` : 'another app';
      mitmLine = `MITM proxy can't use port ${c.port} — ${who} is using it. Click <strong>Proxy Port Unavailable</strong> above to close it or change the port.`;
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
          childrenEl.insertAdjacentHTML('beforeend', renderStructureLeaves(slice, state.selectedEventId));
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
    // A pending trim invalidates the incremental patch path (front rows removed) → force a rebuild.
    const force = !!options?.force || listNeedsRebuild;
    listNeedsRebuild = false;
    const sessions = state.events.length === 0 ? [] : filteredSessions();
    const signature = listSignature(sessions);

    if (
      !force &&
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
      const isAutoDisabledError =
        typeof state.captureError === 'string' && /^Network Inspector disabled:/i.test(state.captureError);
      const showCaptureError = !!state.captureError && (state.platform !== 'win32' || isAutoDisabledError);
      if (showCaptureError && state.mitmActive) {
        body =
          `<p class="ni-hint">Hotspot capture is blocked, but the MITM proxy at <strong>${escapeHtml(state.mitmListenAddress || 'gateway:8888')}</strong> can still record proxied requests. Use <code>host:port</code> only in BrightScript (e.g. <code>192.168.2.1:8888</code>), not the device IP and not <code>http://</code>.</p>`;
      } else if (showCaptureError) {
        body = `<p class="ni-hint ni-hint-error">${escapeHtml(state.captureError)}</p>`;
      } else if (state.mitmActive && !state.captureActive) {
        // Shared Wi-Fi / no hotspot: only the MITM proxy is recording. Guide the user to point
        // their dev channel at the proxy address (host:port only, the machine's LAN IP).
        const proxyAddr = state.mitmListenAddress || 'machine-ip:8888';
        body = `<p class="ni-hint">MITM proxy is active at <code class="ni-hint-code">${escapeHtml(proxyAddr)}</code>. Route your dev channel through it to capture Network Requests.</p>`;
      } else if (state.captureActive || state.mitmActive) {
        const mitmHint = state.mitmActive
          ? ' MITM proxy is decrypting dev-channel HTTPS routed through Roku Dev Studio.'
          : ' HTTPS bodies are encrypted in hotspot capture mode — enable MITM in Settings for Dev channels.';
        body =
          '<p class="ni-hint">Capturing on Hotspot. Browse or play content on the Roku.</p>' +
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
        ? renderStructureView(sessions, force)
        : renderFlatView(sessions, force);
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
    syncGroupToggleButton();
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
      // Re-stamp Find badges (rows may have been rebuilt). While the modal is open, re-run the search
      // only when the events or filter actually changed — not on every repaint (e.g. scroll) — so a
      // live capture doesn't spam the search IPC.
      applyFindDecorations();
      // Keep Find live: whenever the events or filter change, re-run the active search so requests
      // that arrive AFTER the search still get matched + highlighted — even with the modal closed.
      if (findModal?.isActive()) {
        // viewMode is included so toggling Group-by-Host re-runs the search and reorders the
        // Prev/Next set to match the new on-screen order.
        const sig = `${eventsVersion}|${effProxiedOnly()}|${state.viewMode}|${filterInput?.value || ''}`;
        if (sig !== lastFindRefreshSig) {
          lastFindRefreshSig = sig;
          scheduleLiveFindRefresh();
        }
      }
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
      // Shift+↑/↓ jumps across Find matches only (plain ↑/↓ still step through every request).
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.shiftKey && findModal?.isActive()) {
        e.preventDefault();
        if (e.key === 'ArrowDown') findModal.next();
        else findModal.prev();
        return;
      }
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
    syncGroupToggleButton();
  }

  /** Show the single expand/collapse-all-groups control only in "Group by Host" view (animated in/
   *  out via CSS). Its triangle mirrors a group's own toggle — ▼ when groups are expanded, ▶ when
   *  all are collapsed — and clicking flips the whole set. */
  function syncGroupToggleButton(): void {
    syncGroupToggleButtonShared(groupToggleBtn, state.viewMode, lastStructureHosts, state.collapsedHosts);
  }

  function syncFilterClear(): void {
    if (!(filterClearBtn instanceof HTMLElement)) return;
    filterClearBtn.hidden = !filterInput?.value;
  }

  function syncBodyWrap(): void {
    syncBodyWrapShared({
      root: panel,
      requestBodyEl,
      responseBodyEl,
      requestWrap: state.requestBodyWrap,
      responseWrap: state.responseBodyWrap
    });
  }

  // Map a media MIME to a sensible download extension.
  function mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg'
    };
    return map[mime] || mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin';
  }

  /** Native right-click menu for a media preview: Copy Image (images) + Save File… The raw
   *  bytes/base64 are available via the Raw format view, so there's no Copy-as-Data-URL item. */
  async function showMediaContextMenu(dataUrl: string, isImage: boolean): Promise<void> {
    const api = window.roku;
    if (!api?.showContextMenu) return;
    const match = /^data:([^;,]*)[^,]*,(.*)$/s.exec(dataUrl);
    const mime = match?.[1] || 'application/octet-stream';
    const base64 = match?.[2] || '';
    const items: Array<Record<string, unknown>> = [];
    if (isImage) items.push({ label: 'Copy Image', action: 'ni-copy-image' });
    items.push({ label: isImage ? 'Save Image As…' : 'Save File…', action: 'ni-save-media' });
    let res: { action?: string } | null = null;
    try {
      res = (await api.showContextMenu(items)) as { action?: string } | null;
    } catch {
      return;
    }
    if (!res) return;
    if (res.action === 'ni-copy-image') {
      await api.copyImage?.({ dataUrl });
    } else if (res.action === 'ni-save-media') {
      await api.saveBinaryFile?.({
        base64,
        defaultName: `response-${Date.now()}.${mimeToExt(mime)}`,
        dialogTitle: isImage ? 'Save Image' : 'Save File'
      });
    }
  }

  async function copyPaneContent(btn: HTMLElement, which: string): Promise<void> {
    if (!window.roku?.copyToClipboard) return;
    // Use the loaded detail (has the full headers/body); fall back to summary for tabs that
    // don't carry a single source string.
    const ev =
      selectedDetail?.id === state.selectedEventId ? selectedDetail.event : selectedEvent();
    const pane = which === 'response' ? 'response' : 'request';
    const showingBody = pane === 'request' ? state.requestTab === 'body' : state.responseTab === 'body';
    const text = paneBodyText(ev, pane, showingBody, pane === 'request' ? requestBodyEl : responseBodyEl);
    if (!text) return;
    try {
      await window.roku.copyToClipboard(text);
      flashCopied(btn);
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

  function closeDownloadDropdown(): void {
    if (downloadDropdownEl && !downloadDropdownEl.hidden) downloadDropdownEl.hidden = true;
    downloadToggleEl?.setAttribute('aria-expanded', 'false');
  }

  function toggleDownloadDropdown(): void {
    if (!downloadDropdownEl || !downloadToggleEl) return;
    const willOpen = downloadDropdownEl.hidden;
    downloadDropdownEl.hidden = !willOpen;
    downloadToggleEl.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  /** Raw pcap export only has data when the packet-capture engine is running and has captured
   *  frames. MITM-proxied sessions (device off the hotspot) produce no raw frames, so hide the
   *  pcap option entirely rather than offer a download that would come back empty. */
  function updateDownloadOptions(): void {
    if (!downloadPcapItemEl) return;
    downloadPcapItemEl.hidden = state.rawPacketsAvailable <= 0;
  }

  /**
   * Fetch the full detail (headers + bodies) for a set of list summaries without disturbing the
   * pane's `selectedDetail`. Exports need the complete payload, but the list only holds lightweight
   * summaries; this pulls each event's detail from the on-disk store (bounded concurrency) and
   * falls back to the summary when detail was never stored / has been evicted.
   */
  async function loadEventsWithDetail(summaries: ParsedNetworkEvent[]): Promise<ParsedNetworkEvent[]> {
    const api = window.roku;
    const getDetail = api?.networkInspectorGetEventDetail;
    if (!getDetail) return summaries;
    const out = new Array<ParsedNetworkEvent>(summaries.length);
    const CONCURRENCY = 8;
    let cursor = 0;
    async function worker(): Promise<void> {
      while (cursor < summaries.length) {
        const i = cursor++;
        const summary = summaries[i];
        if (!summary.detailAvailable) {
          out[i] = summary;
          continue;
        }
        try {
          const res = await getDetail(summary.id);
          const full = (res?.event ?? null) as ParsedNetworkEvent | null;
          out[i] = full || summary;
        } catch {
          out[i] = summary;
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, summaries.length) }, () => worker()));
    return out;
  }

  /** Timestamped default filename stem scoped to the watched device, e.g. `network-192-168-1-81`. */
  function exportFileStem(): string {
    const ips = watchDeviceIps();
    const primary = ips.find((ip) => !ip.endsWith('.1')) || ips[0];
    const namePart = primary ? primary.replace(/\./g, '-') : 'session';
    return `network-${namePart}-${Date.now()}`;
  }

  /** Save the raw packet capture (.pcap). Only yields data when hotspot frames were captured;
   *  MITM-proxied sessions have no raw frames, so surface that instead of failing silently. */
  async function exportPcap(): Promise<void> {
    const api = window.roku;
    if (!api?.networkInspectorExportPcap) return;
    // Scope the pcap to this device's traffic only — capture stays whole-hotspot, but the
    // download filters to the watched device IPs (device + its hotspot lease).
    const ips = watchDeviceIps();
    try {
      const res = await api.networkInspectorExportPcap(ips.length > 0 ? ips : undefined);
      if (res?.success) {
        const n = typeof res.packetsWritten === 'number' ? res.packetsWritten : 0;
        showToast(`Saved ${n} packet${n === 1 ? '' : 's'} to ${res.filePath || 'file'}.`, 'success');
      } else if (res?.error && res.error !== 'cancelled') {
        showToast(res.error, 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save packet capture.', 'error');
    }
  }

  /** Export every request currently shown in the list (respecting the filter). `kind` selects the
   *  interop HAR archive or the native, fully re-openable `.rdsnet.json` session bundle. */
  async function exportSessions(kind: 'har' | 'bundle'): Promise<void> {
    const api = window.roku;
    if (!api?.saveTextFile) return;
    const sessions = filteredSessions();
    if (sessions.length === 0) {
      showToast('No requests to export.', 'warning');
      return;
    }
    if (kind === 'har' && !sessions.some((s) => isExportableEvent(s.event))) {
      showToast('No HTTP transactions to export as HAR.', 'warning');
      return;
    }
    try {
      const events = await loadEventsWithDetail(sessions.map((s) => s.event));
      const content =
        kind === 'har'
          ? buildHarArchiveAll(events)
          : buildNetworkSessionFile(events, { deviceIps: watchDeviceIps() });
      const stem = exportFileStem();
      const res = await api.saveTextFile({
        content,
        defaultName: kind === 'har' ? `${stem}.har` : `${stem}.${NETWORK_SESSION_FILE_EXT}`,
        dialogTitle: kind === 'har' ? 'Export sessions as HAR' : 'Export network session'
      });
      if (res?.success) {
        showToast(`Exported ${events.length} request${events.length === 1 ? '' : 's'} to ${res.filePath || 'file'}.`, 'success');
      } else if (res?.error && res.error !== 'Save cancelled') {
        showToast(res.error, 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to export session.', 'error');
    }
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
    if (typeof state.captureError === 'string' && /^Network Inspector disabled:/i.test(state.captureError)) {
      return state.captureError;
    }
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
      captureToggleBtn.title = 'Stop Capturing';
      captureToggleBtn.setAttribute('aria-label', 'Stop Capturing');
    } else {
      captureToggleBtn.innerHTML =
        '<span class="icon icon-sm"><svg><use href="#icon-play"/></svg></span>';
      captureToggleBtn.classList.remove('is-capturing');
      captureToggleBtn.title = 'Start Capturing';
      captureToggleBtn.setAttribute('aria-label', 'Start Capturing');
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
    for (const e of removed) {
      eventIndex.delete(e.id);
      seqById.delete(e.id);
    }
    // Front rows were removed → the tail-append patch path can't reconcile; force a full rebuild.
    listNeedsRebuild = true;
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
        // Update in place: the same object stays at its position in `state.events` and in
        // `eventIndex`, so there's no O(n) `indexOf`/array write per updated event. `ev` is a fresh
        // full summary with the same shape, so the shallow merge fully refreshes it.
        Object.assign(existing, ev);
      } else {
        changed = true;
        state.events.push(ev);
        eventIndex.set(ev.id, ev);
        if (!seqById.has(ev.id)) seqById.set(ev.id, ++captureSeq);
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
    if (setupBadgeLabel) setupBadgeLabel.textContent = isError ? 'Capture Blocked' : 'Capture Setup';
    setupBadgeBtn.title = failedPrereq
      ? `${failedPrereq.title} — click for setup instructions`
      : 'Hotspot Capture Setup — Click for Instructions';
  }

  /**
   * The header "Proxy Port Unavailable" badge is the persistent, in-context indicator that the MITM
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
      // Conflict cleared. If the modal is up showing that conflict, morph it into a brief "port is
      // free again" confirmation that auto-dismisses; otherwise (nothing open) this is a no-op.
      resolvePortConflictModal();
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
    rawPacketsAvailable?: number;
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
    if (typeof s.rawPacketsAvailable === 'number') state.rawPacketsAvailable = s.rawPacketsAvailable;
    // Capture state gates the "Proxied" filter's relevance — refresh its visibility and repaint the
    // list (the effective filter changes) when it flips, even if no new events arrived.
    if (prevCaptureActive !== state.captureActive) {
      syncSidebarOptions();
      scheduleSessionListPaint({ force: true });
    }
    updateDownloadOptions();
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

  // Input + Up/Down history + clear + help — via the shared wiring (network-filter-help.ts). Pass
  // listenerOpts so all three listeners abort on dispose; the handle disposes the history binding.
  const filterControls = wireNetworkFilterControls({
    filterInput,
    filterClearBtn,
    filterHelpBtn,
    historyStorageKey: filterHistoryKey('ni', device.ip || 'unknown'),
    onApply: applyFilterChange,
    listenerOptions: listenerOpts
  });

  groupByHostInput?.addEventListener('change', () => {
    state.viewMode = groupByHostInput.checked ? 'structure' : 'sequence';
    lastListSignature = '';
    syncGroupToggleButton();
    refreshSessionList({ force: true });
  }, listenerOpts);

  // Single expand/collapse-all-groups control (shown only in "Group by Host" view).
  groupToggleBtn?.addEventListener('click', () => {
    if (state.viewMode !== 'structure') return;
    const hosts = lastStructureHosts;
    if (hosts.length === 0) return;
    const allCollapsed = hosts.every((h) => state.collapsedHosts.has(h));
    if (allCollapsed) state.collapsedHosts.clear();
    else for (const h of hosts) state.collapsedHosts.add(h);
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

  // Enter/Space activates a focused embedded JSON/XML highlight (it's role="button").
  detailPane?.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter' && ke.key !== ' ') return;
    const target = e.target as HTMLElement | null;
    const embBtn = target?.closest('.ni-embedded-structured') as HTMLElement | null;
    if (!embBtn?.dataset.niEmbIdx) return;
    e.preventDefault();
    const pane = embBtn.closest('[data-ni-response-body]') ? 'response' : 'request';
    const payload = getEmbeddedStructuredPayload(pane, parseInt(embBtn.dataset.niEmbIdx, 10));
    if (payload) openConsoleStructuredViewer(embBtn, payload, { titlePrefix: 'Network Inspector' });
  }, listenerOpts);

  if (detailPane instanceof HTMLElement) {
    // Delegated detail-pane clicks (tabs/wrap/copy/cURL/HAR/URL/embedded) run through the shared
    // dispatcher; the callbacks below preserve the live tab's exact behavior (lazy-loaded export,
    // dropdown caret, per-pane wrap). `renderDetail`, find bars and badges stay local.
    wireDetailInteractions(
      detailPane,
      {
        onUrl: (anchor, url) =>
          openConsoleUrlViewer(anchor, url, { titlePrefix: 'Network Inspector' }),
        onEmbedded: (anchor, pane, idx) => {
          const payload = getEmbeddedStructuredPayload(pane, idx);
          if (payload) openConsoleStructuredViewer(anchor, payload, { titlePrefix: 'Network Inspector' });
        },
        onCopyMenuToggle: () => toggleCopyDropdown(),
        onCopyItem: (item, kind) => {
          if (kind === 'curl' || kind === 'har') void exportSelectedAs(item, kind);
          else void copyPaneContent(item, 'request');
          closeCopyDropdown();
        },
        onCopyBody: (btn, which) => void copyPaneContent(btn, which),
        onToggleWrap: (which) => {
          if (which === 'response') state.responseBodyWrap = !state.responseBodyWrap;
          else state.requestBodyWrap = !state.requestBodyWrap;
          syncBodyWrap();
        },
        onSetRequestTab: (tab) => {
          if (state.requestTab === tab) return;
          state.requestTab = tab;
          renderDetail('request');
        },
        onSetResponseTab: (tab) => {
          if (state.responseTab === tab) return;
          state.responseTab = tab;
          renderDetail('response');
        }
      },
      listenerOpts
    );
  }

  // Right-click on a media preview (image/video/audio) → native menu to copy the actual picture
  // or save the file, instead of the text-only Copy button. The element's `src` is the data URL.
  detailPane?.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement | null;
    const mediaEl = target?.closest('.ni-media-img, .ni-media-el, .ni-media-audio') as
      | HTMLImageElement
      | HTMLMediaElement
      | null;
    const dataUrl = mediaEl?.getAttribute('src') || '';
    if (!dataUrl.startsWith('data:')) return;
    e.preventDefault();
    void showMediaContextMenu(dataUrl, mediaEl instanceof HTMLImageElement);
  }, listenerOpts);

  // Collapsible JSON/XML fold twisties in the body panes (delegated; shared helper).
  if (detailPane instanceof HTMLElement) {
    listenerAc.signal.addEventListener('abort', attachFoldToggle(detailPane));
  }

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

  // The amber "i" beside each Format selector explains the structured→raw downgrade for a too-large
  // body. Visibility is driven by `setFormatInfo`; the click just opens the explainer with the size.
  requestFormatInfoEl?.addEventListener('click', () => {
    if (requestFormatInfoEl instanceof HTMLElement) {
      openLargeBodyInfoModal(Number(requestFormatInfoEl.dataset.kb) || getLargeBodyKb('request'));
    }
  }, listenerOpts);
  responseFormatInfoEl?.addEventListener('click', () => {
    if (responseFormatInfoEl instanceof HTMLElement) {
      openLargeBodyInfoModal(Number(responseFormatInfoEl.dataset.kb) || getLargeBodyKb('response'));
    }
  }, listenerOpts);

  function resetEventsState(): void {
    state.events = [];
    eventIndex.clear();
    lastSeqByIp.clear();
    // Per-request body-search terms are keyed by event id; those ids are gone now.
    paneFind.clear();
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

  downloadToggleEl?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDownloadDropdown();
  }, listenerOpts);

  downloadDropdownEl?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement | null)?.closest('[data-ni-download-item]') as HTMLElement | null;
    const kind = item?.dataset.niDownloadItem;
    if (!kind) return;
    closeDownloadDropdown();
    if (kind === 'pcap') void exportPcap();
    else if (kind === 'har' || kind === 'bundle') void exportSessions(kind);
  }, listenerOpts);

  // Dismiss the download dropdown on an outside click or Escape, like a normal menu.
  document.addEventListener(
    'click',
    (e) => {
      if (!downloadMenuEl || downloadDropdownEl?.hidden) return;
      const t = e.target as Node | null;
      if (t && downloadMenuEl.contains(t)) return;
      closeDownloadDropdown();
    },
    { signal: listenerAc.signal }
  );
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && downloadDropdownEl && !downloadDropdownEl.hidden) {
        closeDownloadDropdown();
        if (downloadToggleEl instanceof HTMLElement) downloadToggleEl.focus();
      }
    },
    { signal: listenerAc.signal }
  );

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

  // Build + insert the find bar just above each body scroll area, then wire it. Visibility is
  // driven by the Body tab in syncPaneChrome (no search on Overview / Headers).
  /** Focus a pane's find bar on ⌘/Ctrl+F, but only while it's visible (inert on non-Body tabs). */
  function bindBodyFindShortcut(target: HTMLElement, handle: MultiFindHandle): () => void {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
        if (!handle.isVisible()) return;
        e.preventDefault();
        handle.focus();
      }
    };
    target.addEventListener('keydown', onKey);
    return () => target.removeEventListener('keydown', onKey);
  }

  if (requestBodyEl instanceof HTMLElement) {
    const bar = buildMultiFindBarElement();
    requestBodyEl.insertAdjacentElement('beforebegin', bar);
    requestSearch = createMultiFindBar({
      bodyEl: requestBodyEl,
      barEl: bar,
      highlightId: 'ni-find-request',
      onChange: (kws) => paneFind.applyPaneEdit('request', kws)
    });
    if (requestSearch) {
      listenerAc.signal.addEventListener('abort', bindBodyFindShortcut(requestBodyEl, requestSearch));
    }
    // Cmd/Ctrl+A selects all text in the focused body pane (not the whole page).
    listenerAc.signal.addEventListener('abort', attachSelectAll(requestBodyEl));
  }
  if (responseBodyEl instanceof HTMLElement) {
    const bar = buildMultiFindBarElement();
    responseBodyEl.insertAdjacentElement('beforebegin', bar);
    responseSearch = createMultiFindBar({
      bodyEl: responseBodyEl,
      barEl: bar,
      highlightId: 'ni-find-response',
      onChange: (kws) => paneFind.applyPaneEdit('response', kws)
    });
    if (responseSearch) {
      listenerAc.signal.addEventListener('abort', bindBodyFindShortcut(responseBodyEl, responseSearch));
    }
    listenerAc.signal.addEventListener('abort', attachSelectAll(responseBodyEl));
  }

  // ── Find in content (URL / headers / bodies) ──────────────────────────────────────────────
  // Deferred visual update: when the modal is open, row badges + button color/child-animation are
  // held here and applied only after close so they all play together when the list is back in view.
  let pendingFindVisualUpdate: (() => void) | null = null;
  findModal = createNetworkFindModal({
    async search(request) {
      const api = window.roku;
      if (!api?.networkInspectorFind) return [];
      // Search each watched device's captured traffic and merge (ids are globally unique).
      const ips = watchDeviceIps();
      const merged: NetworkFindMatch[] = [];
      const seen = new Set<string>();
      await Promise.all(
        ips.map(async (ip) => {
          try {
            const res = await api.networkInspectorFind(ip, request);
            const matches = (res?.matches ?? []) as NetworkFindMatch[];
            for (const m of matches) {
              if (!seen.has(m.id)) {
                seen.add(m.id);
                merged.push(m);
              }
            }
          } catch {
            /* ignore per-device failure */
          }
        })
      );
      return merged;
    },
    onResults(matches, termInfo) {
      findMatches = new Map(matches.map((m) => [m.id, m]));
      findTermInfo = termInfo;
      // Reseed the editable body find-bars ONLY when the selection or seed-set changed (not on every
      // live-event refresh — that would wipe keywords the user typed in the panes). The URL/header
      // seed highlight is cheap + non-editable, so refresh it every time.
      seedDetailFind('both', false); // self-guarded: reseeds only on a selection/seed-set change
      syncPaneSeedHighlight('request');
      syncPaneSeedHighlight('response');
      // Navigation walks only the VISIBLE (filtered-in) matches, so drive the header controls off
      // that set too: if the toolbar Filter hides every match, the ↑/↓/clear buttons and the amber
      // search state hide rather than sitting there doing nothing.
      const order = visibleFindOrder();
      const hasResults = order.length > 0;
      if (findModal?.isOpen()) {
        // Modal is open: defer row-badge decoration + button color/child-animation until close so
        // they all play together when the list comes back into view (no animation fires behind the modal).
        pendingFindVisualUpdate = () => {
          applyFindDecorations();
          if (findBtn) findBtn.classList.toggle('is-find-active', hasResults);
          // The group class drives the CSS expand/collapse animation for the ↑/↓/clear child buttons.
          if (findBtnGroup) findBtnGroup.classList.toggle('has-results', hasResults);
        };
      } else {
        applyFindDecorations();
        if (findBtn) findBtn.classList.toggle('is-find-active', hasResults);
        // The group class drives the CSS expand/collapse animation for the ↑/↓/clear child buttons.
        if (findBtnGroup) findBtnGroup.classList.toggle('has-results', hasResults);
      }
      return order;
    },
    getCurrentId: () => state.selectedEventId,
    onNavigate(id) {
      findCurrentId = id;
      selectEventById(id);
      // Re-sync here too: when Find re-commits on the ALREADY-selected request, selectEventById is a
      // no-op (no re-render) so afterBodyRender won't fire. Jump to the first hit on commit.
      syncSelectedDetailFind(true);
      applyFindDecorations();
    },
    onClear() {
      pendingFindVisualUpdate = null; // cancel any deferred visual update from the last search
      findMatches = new Map();
      findTermInfo = new Map();
      findCurrentId = null;
      // The modal terms are gone, but a request's OWN pane terms are independent of the modal search,
      // so re-seed (rather than wipe) the current panes — they now show just this request's user terms
      // (empty union → empty bar). The URL/header seed tint clears.
      seedDetailFind('both', false);
      clearFindHighlights(SEED_HL_REQUEST);
      clearFindHighlights(SEED_HL_RESPONSE);
      applyFindDecorations();
      if (findBtn) findBtn.classList.remove('is-find-active');
      if (findBtnGroup) findBtnGroup.classList.remove('has-results');
    },
    // While the modal is open, `.ni-find-open` on the list suppresses the match-bar entrance
    // animation (it'd play behind the modal, unseen). Removing it on close re-arms the animation so
    // every match bar eases in right as the user's attention returns to the list.
    onOpen() {
      if (sessionListEl instanceof HTMLElement) sessionListEl.classList.add('ni-find-open');
    },
    onClose() {
      if (sessionListEl instanceof HTMLElement) sessionListEl.classList.remove('ni-find-open');
      if (pendingFindVisualUpdate) {
        // Rows that onNavigate silently tagged while the modal was open (ni-find-open suppressed
        // their animation) must be stripped first so re-applying the classes triggers the entrance
        // animation now that ni-find-open is gone and the list is back in view.
        if (sessionListEl instanceof HTMLElement) {
          sessionListEl.querySelectorAll('.ni-find-match, .ni-find-current').forEach((el) => {
            el.classList.remove('ni-find-match', 'ni-find-current');
          });
          sessionListEl.querySelectorAll('.ni-find-group-match').forEach((el) => {
            el.classList.remove('ni-find-group-match');
          });
        }
        pendingFindVisualUpdate();
        pendingFindVisualUpdate = null;
      }
    }
  });
  findBtn?.addEventListener('click', () => findModal?.open(), listenerOpts);
  findClearBtn?.addEventListener('click', () => findModal?.clear(), listenerOpts);
  findPrevBtn?.addEventListener('click', () => findModal?.prev(), listenerOpts);
  findNextBtn?.addEventListener('click', () => findModal?.next(), listenerOpts);
  // ⌘/Ctrl+F opens the Find modal — unless an in-body find bar already handled it (it calls
  // preventDefault when focused + visible), so searching the focused body stays contextual.
  panel.addEventListener(
    'keydown',
    (e) => {
      const ke = e as KeyboardEvent;
      if (!((ke.metaKey || ke.ctrlKey) && (ke.key === 'f' || ke.key === 'F'))) return;
      if (ke.defaultPrevented) return;
      ke.preventDefault();
      findModal?.open();
    },
    listenerOpts
  );

  updateCaptureButton();
  updateSetupBadge();
  updatePortBadge();
  updateDownloadOptions();
  syncDetailLayout();
  syncBodyWrap();
  syncFilterClear();
  void syncRecordingToMain();

  return {
    destroy() {
      listenerAc.abort();
      niFilterResize?.dispose();
      filterControls.dispose();
      requestSearch?.dispose();
      responseSearch?.dispose();
      findModal?.destroy();
      clearTimeout(findRefreshTimer);
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
    setMultiDevice(multi: boolean) {
      state.multiDevice = multi;
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
        // Tab fully hidden (e.g. Network Inspector disabled / device left hotspot / panel
        // deactivated): it's no longer the foreground Network tab, so drop the modal if this
        // instance owned it.
        if (networkTabForeground) hidePortConflictModal();
        networkTabForeground = false;
        stopPolling();
        // If the (now hidden) Network tab was the active section, its content pane would keep
        // showing. Hide the pane and fall back to the Remote tab so the panel doesn't strand the
        // user on a section whose selector button just disappeared.
        const wasActive = tabBtn.classList.contains('active') || tabContent.classList.contains('active');
        tabContent.classList.remove('active');
        tabContent.style.display = 'none';
        if (wasActive) {
          const remoteBtn = panel.querySelector('.inner-tab[data-inner-tab="remote"]');
          if (remoteBtn instanceof HTMLElement) remoteBtn.click();
        }
      }
    },
    appendEvents(events: ParsedNetworkEvent[]) {
      if (!state.capturing) return;
      lastPushAt = Date.now();
      const filtered = events.filter((e) => eventMatchesTab(e, state));
      if (filtered.length === 0) return;
      const hadSelection = !!state.selectedEventId;
      mergeEvents(filtered);
      // Adopt the first matched event's IP as the hotspot lease only for a sole device — with
      // multiple devices the lease must come from the authoritative serial-based resolution, or a
      // tab could lock onto another device's IP (matched via the discovery fallback above).
      if (!state.multiDevice && !state.hotspotIp && filtered[0]?.deviceIp) {
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
      const prevCaptureActiveStatus = state.captureActive;
      const hasCaptureError = !!status.lastError;
      if (hasCaptureError) {
        state.captureError = String(status.lastError || 'Network Inspector error');
        state.captureActive = false;
      } else {
        state.captureError = null;
      }
      if (!hasCaptureError) {
        state.captureActive = !!status.captureActive;
      }
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
      if (hasCaptureError) {
        stopPolling();
      } else if (status.captureActive || status.mitmActive) {
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
      if (typeof status.rawPacketsAvailable === 'number') {
        state.rawPacketsAvailable = status.rawPacketsAvailable;
      }
      updateSetupBadge();
      updateCaptureButton();
      updateDownloadOptions();
      if (hasCaptureError && state.events.length === 0) scheduleSessionListPaint({ force: true });
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

/**
 * Standalone Network Session Viewer — renders a saved capture (`.rds-network-inspector.json` bundle,
 * HAR, or `.pcap`) with the same two-pane UI as the live Network Inspector, read-only.
 *
 * The whole session is parsed in main and delivered once via `window.roku.loadNetworkSession()`
 * (no live capture, no detail-store round-trips — bundles/HAR inline bodies; pcap has none). All
 * rendering reuses the Network Inspector's pure modules (`network-sessions`, `network-session-view`,
 * `network-detail`, `network-export`), so this file is just glue: state + selection + filter + tabs.
 */
import type { ParsedNetworkEvent } from '@shared/network-inspector/types';
import { buildStructureGroups, type NetworkSession } from '../network-inspector/network-sessions.js';
import { SessionStore } from '../network-inspector/network-session-store.js';
import { filterHistoryKey, filterWidthKey } from '../../modules/ui/search-storage-keys.js';
import { makeCenteredSearchResizable } from '../../modules/ui/header-search-resize.js';
import {
  renderSidebarSequence,
  renderStructureTree,
  syncGroupToggleButton as syncGroupToggleButtonShared
} from '../network-inspector/network-session-view.js';
import {
  renderRequestPane,
  renderResponsePane,
  upgradeStructuredBodies,
  bodyIsSearchable,
  getLargeBodyKb,
  getLargeBodyDowngraded,
  type BodyFormatMode,
  type RequestPaneTab,
  type ResponsePaneTab
} from '../network-inspector/network-detail.js';
import { buildCurlCommand, buildHarArchive, isExportableEvent, absoluteUrl, eventRequestLabel } from '../network-inspector/network-export.js';
import {
  detailPaneHtml,
  wireDetailInteractions,
  syncBodyWrap as syncBodyWrapShared
} from '../network-inspector/network-detail-view.js';
import { openNoteModal } from '../network-inspector/network-note-modal.js';
import { paneBodyText as paneBodyTextShared, flashCopied } from '../network-inspector/network-copy.js';
import { wireNetworkFilterControls } from '../network-inspector/network-filter-help.js';
import { attachFoldToggle } from '../../modules/ui/structured-body.js';
import { openConsoleUrlViewer } from '../../modules/console-log/console-url-modal.js';
import { openConsoleStructuredViewer } from '../../modules/console-log/console-structured-view-modal.js';
import {
  getEmbeddedStructuredPayload,
  type EmbeddedPane
} from '../network-inspector/network-embedded-structured.js';
import { createNetworkFindModal, type FindModalHandle } from '../network-inspector/network-find-modal.js';
import {
  bindListKeyboardNav,
  focusListForKeyboard,
  makeListFocusable,
  navigableEventIds,
  scrollRowWithinWrap,
  updateSelectionHighlight,
  type ListNavHost
} from '../network-inspector/network-list-nav.js';
import { bindMediaContextMenu, type MediaMenuApi } from '../network-inspector/network-media-menu.js';
import { setFormatInfo, wireFormatInfoButton } from '../network-inspector/network-large-body.js';
import { attachSelectAll } from '../../modules/ui/select-all.js';
import { SEED_HL_REQUEST, SEED_HL_RESPONSE, syncPaneSeedHighlight as syncPaneSeedHighlightShared } from '../network-inspector/network-seed-highlight.js';
import {
  createContentMatchers,
  matchEventContentMulti,
  type NetworkFindMatch,
  type NetworkFindRequest
} from '@shared/network-inspector/content-search.js';
import {
  createMultiFindBar,
  buildMultiFindBarElement,
  type MultiFindHandle
} from '../../modules/ui/multi-keyword-find-bar.js';
import { createPaneFindStore, sameKeywordTexts } from '../../modules/ui/pane-find-store.js';
import {
  applyFindDecorations as applyFindDecorationsShared,
  visibleFindOrder as visibleFindOrderShared,
  type FindTermInfo
} from '../network-inspector/network-find-decorations.js';
import { applyFocusDecorations } from '../network-inspector/network-focus-decorations.js';
import { S, applyI18n } from '@shared/strings/index.js';
import { initLocaleForWindow } from '../../modules/utils/locale-live.js';
import { attachInstantTooltips } from '../../modules/utils/instant-tooltip.js';
import { installCrashCapture } from '../../modules/errors/install.js';

type RokuApi = {
  loadNetworkSession: () => Promise<{
    success: boolean;
    fileName?: string;
    format?: 'bundle' | 'har' | 'pcap';
    events?: ParsedNetworkEvent[];
    deviceIps?: string[];
    notice?: string;
    error?: string;
  }>;
  copyToClipboard: (text: string) => Promise<unknown>;
  openExternal: (url: string) => Promise<unknown>;
  showContextMenu?: (items: unknown) => Promise<{ action?: string } | null>;
  getPrivacyMode?: () => Promise<{ enabled: boolean }>;
  onPrivacyModeChanged?: (cb: (enabled: boolean) => void) => () => void;
  getSetting: (key: string) => Promise<{ success: boolean; value?: unknown }>;
  getAppInfo: () => Promise<{ version: string; platform: string; osRelease: string }>;
};

/** Toggle the `privacy-mode` body class so the shared inspector CSS (device IPs,
 *  client addresses) blurs here exactly as it does in the live tab. Optional bridge
 *  methods keep an older preload from crashing the window (privacy just stays off). */
function bindPrivacyMode(): void {
  const apply = (enabled: boolean) => document.body.classList.toggle('privacy-mode', !!enabled);
  if (typeof api.getPrivacyMode === 'function') {
    api.getPrivacyMode().then((res) => apply(!!res?.enabled)).catch(() => {
      /* handler unavailable (older main process) — leave privacy off */
    });
  }
  if (typeof api.onPrivacyModeChanged === 'function') {
    api.onPrivacyModeChanged((enabled) => apply(enabled));
  }
}

const api = (window as unknown as { roku: RokuApi }).roku;

installCrashCapture({
  windowName: 'network-session-viewer',
  getSetting: api.getSetting,
  getAppInfo: api.getAppInfo,
  openExternal: api.openExternal
});

// The events + derived sessions + filter + selection live in the shared SessionStore (also used by
// the live tab). Bodies are inlined in the parsed file, so this window just `setAll`s once — no
// streaming ingest, no lazy detail fetch.
const store = new SessionStore();

// `initLocaleForWindow`'s initial locale-apply (below) resolves as soon as the locale preference
// IPC round-trip completes — typically well under the time a large file takes to load+parse (a
// 250MB capture can take 2+ seconds). Without this guard, its `extra` re-render callback fires on
// the still-empty store first, replacing the cold-start loading placeholder with the SAME "No
// matching sessions." markup a genuinely empty file would show — and nothing ever puts the
// placeholder back, so the loading state is invisible for the entire load. Set once real events
// are in the store (success or failure) so a later, genuine live locale switch still re-renders.
let sessionDataSettled = false;

const state = {
  viewMode: 'sequence' as 'sequence' | 'structure',
  decryptedOnly: false,
  requestTab: 'overview' as RequestPaneTab,
  responseTab: 'headers' as ResponsePaneTab,
  requestBodyFormat: 'auto' as BodyFormatMode,
  responseBodyFormat: 'auto' as BodyFormatMode,
  requestBodyWrap: true,
  responseBodyWrap: true,
  collapsedHosts: new Set<string>(),
  focusedHosts: new Set<string>(),
  detailLayout: 'columns' as 'columns' | 'stacked',
  lastStructureHosts: [] as string[]
};

const $ = <T extends Element = HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);

// "Find in content" (multi-term) — mirrors the live tab, but searches the in-memory events directly
// (bodies are inlined in the loaded file, so no IPC / disk store). Matches badge the list with a
// colored left bar (one segment per matched term); there are no in-body find bars in this window yet.
let findModal: FindModalHandle | null = null;
let findMatches = new Map<string, NetworkFindMatch>();
let findTermInfo: FindTermInfo = new Map();
let findCurrentId: string | null = null;
// In-body multi-keyword find bars for the Request/Response panes, seeded from the Find modal's
// non-regex entries (same behavior as the live Network Inspector).
let requestSearch: MultiFindHandle | null = null;
let responseSearch: MultiFindHandle | null = null;
// Per-request divergence for the detail-pane find bars (shared with the live tab via pane-find-store).
// One file per viewer window, so the store lives for the window's lifetime (no reset). Modal terms are
// unioned in only for a Find match; a non-match shows purely that request's own stored terms.
const paneFind = createPaneFindStore({
  modalSeedFor: (id) => (findMatches.has(id) ? (findModal?.getSeedTerms() ?? []) : []),
  getSelectedId: () => store.getSelectedId()
});

// Inject the shared detail-pane markup before the per-pane queries below read from it, so this
// window and the live inspector render from one source (network-detail-view.ts).
const detailPaneHost = $('[data-ni-detail]');
if (detailPaneHost) detailPaneHost.innerHTML = detailPaneHtml();

const filterInput = $<HTMLInputElement>('[data-ni-filter]');
const filterClearBtn = $<HTMLElement>('[data-ni-filter-clear]');
const filterHelpBtn = $<HTMLElement>('[data-ni-filter-help]');

/** Show the filter's clear (×) button only while the filter has text (mirrors the live tab). */
function syncFilterClear(): void {
  if (filterClearBtn) filterClearBtn.hidden = !filterInput?.value;
}
const sessionListEl = $('[data-ni-session-list]');
const sessionPaneEl = $('[data-ni-session-pane]');
const sessionCountEl = $('[data-ni-session-count]');
const detailPane = $('[data-ni-detail]');
const workspaceEl = $('[data-ni-workspace]');
const requestBodyEl = $('[data-ni-request-body]');
const responseBodyEl = $('[data-ni-response-body]');
const groupByHostInput = $<HTMLInputElement>('[data-ni-group-by-host]');
const groupToggleBtn = $<HTMLButtonElement>('[data-ni-toggle-all-groups]');
const layoutToggleBtn = $<HTMLButtonElement>('[data-ni-layout-toggle]');
const noticeEl = $('[data-nsv-notice]');
const copyDropdownEl = $('[data-ni-copy-dropdown]');
const copyCaretEl = $('[data-ni-copy-menu-toggle]');
const reqFormatWrap = $('[data-ni-req-format-wrap]');
const resFormatWrap = $('[data-ni-res-format-wrap]');
const reqTruncatedBadge = $('[data-ni-req-truncated]');
const resTruncatedBadge = $('[data-ni-res-truncated]');
const findBtn = $<HTMLButtonElement>('[data-ni-find]');
const findBtnGroup = findBtn?.closest('.ni-find-btn-group') as HTMLElement | null;
const findPrevBtn = $('[data-ni-find-prev]');
const findNextBtn = $('[data-ni-find-next]');
const findClearBtn = $('[data-ni-find-clear]');

function filteredSessions(): NetworkSession[] {
  return store.filteredSessions(state.decryptedOnly);
}

function selectedEvent(): ParsedNetworkEvent | null {
  return store.getSelectedEvent();
}

/** The list's scroll container (rebuilt with the list, so re-query after every render). */
function listScroller(): HTMLElement | null {
  if (!(sessionListEl instanceof HTMLElement)) return null;
  return sessionListEl.querySelector('.ni-sidebar-scroll, .ni-structure-wrap, .ni-sequence-wrap') as HTMLElement | null;
}

/** Host for the shared list keyboard navigation (↑/↓, Home/End, Shift+↑/↓ across Find matches). */
const listNavHost: ListNavHost = {
  navigableIds: () =>
    navigableEventIds({
      viewMode: state.viewMode,
      listEl: sessionListEl instanceof HTMLElement ? sessionListEl : null,
      sequenceIds: filteredSessions().map((s) => s.eventId)
    }),
  selectedId: () => store.getSelectedId(),
  select: (id) => {
    selectEvent(id);
    const wrap = listScroller();
    const row = sessionListEl instanceof HTMLElement ? sessionListEl.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(id)}"]`) : null;
    if (wrap && row) scrollRowWithinWrap(wrap, row);
  },
  findActive: () => !!findModal?.isActive(),
  findNext: () => findModal?.next(),
  findPrev: () => findModal?.prev()
};

function renderList(): void {
  if (!(sessionListEl instanceof HTMLElement)) return;
  // The list is rebuilt wholesale (innerHTML), which resets the scroller to the top. Keep the user's
  // position so selecting a row, re-badging Find matches or toggling focus never yanks the list —
  // callers that want the selection on screen (Find navigation) scroll to it explicitly afterwards.
  const prevScrollTop = listScroller()?.scrollTop ?? 0;
  const sessions = filteredSessions();
  const selectedId = store.getSelectedId();
  if (state.viewMode === 'structure') {
    state.lastStructureHosts = buildStructureGroups(sessions).map((g) => g.host);
    sessionListEl.innerHTML = renderStructureTree(sessions, selectedId, state.collapsedHosts);
  } else {
    state.lastStructureHosts = [];
    sessionListEl.innerHTML = renderSidebarSequence(sessions, selectedId);
  }
  if (sessions.length === 0 && state.decryptedOnly && store.size > 0) {
    sessionListEl.innerHTML = `<div class="ni-session-empty">${S.networkSessionViewer.noDecryptedSessions}</div>`;
  }
  const scroller = listScroller();
  if (scroller && prevScrollTop > 0) scroller.scrollTop = prevScrollTop;
  if (scroller) {
    makeListFocusable(scroller, S.networkInspector.sessionListAria);
    bindListKeyboardNav(scroller, listNavHost);
  }
  if (sessionCountEl instanceof HTMLElement) {
    const total = store.sessions().length;
    sessionCountEl.textContent = sessions.length === total ? `${total}` : `${sessions.length}/${total}`;
  }
  syncGroupToggleButton();
  // Matching rows are rebuilt by the innerHTML above, so re-badge them from the current match set.
  applyFindDecorations();
  // Re-stamp focus dim classes (rows were just rebuilt), shared with the live tab. Skipped in
  // Group-by-Host view — grouped rows never dim; focusedHosts is preserved and restored on return to sequence.
  if (state.viewMode !== 'structure' && sessionListEl instanceof HTMLElement) {
    applyFocusDecorations({ listEl: sessionListEl, focusedHosts: state.focusedHosts });
  }
}

/** Right-click a host row/group → native Focus/Unfocus menu (+ Clear). Resolve the host under the
 *  cursor, then toggle it and re-render (renderList re-stamps the decorations). */
function resolveHostFromNode(node: HTMLElement | null): string | null {
  const group = node?.closest('.ni-struct-host') as HTMLElement | null;
  if (group?.dataset.structHost) return group.dataset.structHost;
  const row = node?.closest('.ni-sidebar-row[data-host]') as HTMLElement | null;
  return row?.dataset.host ?? null;
}

async function showHostFocusMenu(host: string): Promise<void> {
  if (!api?.showContextMenu) return;
  const isFocused = state.focusedHosts.has(host);
  const items: Array<Record<string, unknown>> = [
    {
      label: isFocused ? S.networkInspector.unfocusHost(host) : S.networkInspector.focusHost(host),
      action: 'ni-focus-toggle'
    }
  ];
  if (state.focusedHosts.size > 0) {
    items.push({ type: 'separator' }, { label: S.networkInspector.clearFocusedHosts, action: 'ni-focus-clear' });
  }
  let res: { action?: string } | null = null;
  try {
    res = await api.showContextMenu(items);
  } catch {
    return;
  }
  if (!res) return;
  if (res.action === 'ni-focus-toggle') {
    if (state.focusedHosts.has(host)) state.focusedHosts.delete(host);
    else state.focusedHosts.add(host);
  } else if (res.action === 'ni-focus-clear') {
    state.focusedHosts.clear();
  }
  onFocusChanged();
}

/** Repaint the list so renderList re-stamps the dim/emphasis decorations for the focused-host set. */
function onFocusChanged(): void {
  renderList();
}

/** Badge matching rows + flag collapsed host groups that hold a match — delegates to the shared
 *  decorator (network-find-decorations.ts), shared with the live Network Inspector tab. */
function applyFindDecorations(): void {
  if (!(sessionListEl instanceof HTMLElement)) return;
  applyFindDecorationsShared({
    listEl: sessionListEl,
    matches: findMatches,
    termInfo: findTermInfo,
    currentId: findCurrentId
  });
}

/** The ordered set Find's Prev/Next walks — visible (filtered-in) matches in on-screen order. */
function visibleFindOrder(): string[] {
  return visibleFindOrderShared({
    viewMode: state.viewMode,
    listEl: sessionListEl instanceof HTMLElement ? sessionListEl : null,
    sequenceIds: filteredSessions().map((s) => s.eventId),
    matches: findMatches
  });
}

/** Select + scroll to a matched event, revealing its host group first when collapsed. */
function navigateToFind(id: string): void {
  findCurrentId = id;
  if (state.viewMode === 'structure' && sessionListEl instanceof HTMLElement) {
    const row = sessionListEl.querySelector(`[data-event-id="${id}"]`);
    const hostName = row
      ?.closest('.ni-struct-host')
      ?.querySelector('[data-struct-toggle]')
      ?.getAttribute('data-struct-toggle');
    if (hostName && state.collapsedHosts.has(hostName)) {
      state.collapsedHosts.delete(hostName);
      renderList();
    }
  }
  selectEvent(id);
  (sessionListEl instanceof HTMLElement
    ? sessionListEl.querySelector(`[data-event-id="${id}"]`)
    : null
  )?.scrollIntoView({ block: 'nearest' });
  applyFindDecorations();
}

/** Show the expand/collapse-all-groups control only in Group-by-Host view, and reflect the
 *  all-collapsed vs expanded state on its chevron/label (mirrors the live Network Inspector). */
function syncGroupToggleButton(): void {
  syncGroupToggleButtonShared(
    groupToggleBtn,
    state.viewMode,
    state.lastStructureHosts,
    state.collapsedHosts
  );
}


function syncBodyWrap(): void {
  syncBodyWrapShared({
    root: document,
    requestBodyEl,
    responseBodyEl,
    requestWrap: state.requestBodyWrap,
    responseWrap: state.responseBodyWrap
  });
}

/** Amber-tint the Find terms on a pane's Overview/Headers tabs (the Body tab's find bar owns the body). */
function syncPaneSeedHighlight(which: 'request' | 'response'): void {
  const selectedId = store.getSelectedId();
  syncPaneSeedHighlightShared({
    el: which === 'request' ? requestBodyEl : responseBodyEl,
    tab: which === 'request' ? state.requestTab : state.responseTab,
    id: which === 'request' ? SEED_HL_REQUEST : SEED_HL_RESPONSE,
    keywords: (findModal?.getSeedKeywords() ?? []).map((k) => k.text),
    isMatch: !!selectedId && findMatches.has(selectedId)
  });
}

function renderDetail(): void {
  const ev = selectedEvent();
  if (!detailPane) return;
  if (!ev) {
    detailPane.classList.add('is-empty');
    return;
  }
  detailPane.classList.remove('is-empty');
  // Tint the header Notes button when the selected event carries a note; plain otherwise.
  detailPane.querySelector('[data-ni-note-open]')?.classList.toggle('has-note', !!ev.note?.trim());
  if (requestBodyEl instanceof HTMLElement) {
    requestBodyEl.innerHTML = renderRequestPane(ev, state.requestTab, state.requestBodyFormat, store.all);
    upgradeStructuredBodies(requestBodyEl);
    setFormatInfo($('[data-ni-req-format-info]'), state.requestTab === 'body' ? getLargeBodyKb('request') : 0, getLargeBodyDowngraded('request'));
  }
  if (responseBodyEl instanceof HTMLElement) {
    responseBodyEl.innerHTML = renderResponsePane(ev, state.responseTab, state.responseBodyFormat);
    upgradeStructuredBodies(responseBodyEl);
    setFormatInfo($('[data-ni-res-format-info]'), state.responseTab === 'body' ? getLargeBodyKb('response') : 0, getLargeBodyDowngraded('response'));
  }
  // Format/wrap controls only apply to a body tab; truncated badge from the captured flags.
  reqFormatWrap?.toggleAttribute('hidden', state.requestTab !== 'body');
  resFormatWrap?.toggleAttribute('hidden', state.responseTab !== 'body');
  reqTruncatedBadge?.toggleAttribute('hidden', !(state.requestTab === 'body' && ev.httpRequest?.bodyTruncated));
  resTruncatedBadge?.toggleAttribute('hidden', !(state.responseTab === 'body' && ev.httpResponse?.bodyTruncated));
  syncBodyWrap();
  syncBodyFind();
  syncPaneSeedHighlight('request');
  syncPaneSeedHighlight('response');
}

/** Show/hide the body find bars per active tab and seed them with the view-time union (this request's
 *  own terms + the modal's terms, regex + substring). A passive reseed with an unchanged chip set is
 *  skipped so the nav cursor survives (this window has no live churn, but tab toggles route through here). */
function syncBodyFind(): void {
  requestSearch?.setVisible(state.requestTab === 'body' && bodyIsSearchable(requestBodyEl));
  responseSearch?.setVisible(state.responseTab === 'body' && bodyIsSearchable(responseBodyEl));
  const id = store.getSelectedId();
  if (!id) return;
  for (const which of ['request', 'response'] as const) {
    const bar = which === 'request' ? requestSearch : responseSearch;
    if (!bar) continue;
    const eff = paneFind.computeEffective(id, which);
    if (sameKeywordTexts(eff, bar.getKeywords())) bar.refresh();
    else bar.setKeywords(eff, true); // new chip set (selection changed): land on the first hit, like the live tab
  }
}

/** Focus a pane's find bar on ⌘/Ctrl+F while it's visible; swallow so the list Find modal
 *  (bound at document level) doesn't also open. */
function bindBodyFindShortcut(target: HTMLElement, handle: MultiFindHandle): void {
  target.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
      if (!handle.isVisible()) return;
      e.preventDefault();
      e.stopPropagation();
      handle.focus();
    }
  });
}

function setupBodyFind(): void {
  if (requestBodyEl instanceof HTMLElement) {
    const bar = buildMultiFindBarElement();
    requestBodyEl.insertAdjacentElement('beforebegin', bar);
    requestSearch = createMultiFindBar({
      bodyEl: requestBodyEl,
      barEl: bar,
      highlightId: 'ni-find-request',
      onChange: (kws) => paneFind.applyPaneEdit('request', kws)
    });
    if (requestSearch) bindBodyFindShortcut(requestBodyEl, requestSearch);
    attachSelectAll(requestBodyEl); // ⌘/Ctrl+A selects the pane, not the page
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
    if (responseSearch) bindBodyFindShortcut(responseBodyEl, responseSearch);
    attachSelectAll(responseBodyEl);
  }
}

function selectEvent(id: string): void {
  if (store.getSelectedId() === id) return;
  store.select(id);
  // Selecting must not rebuild the list: renderList() replaces the scroller, which reset the scroll
  // position to the top on every click. The shared highlighter re-stamps the class in place (sequence
  // rows, Group-by-Host leaves and the collapsed-host marker); only an unrendered row falls back to a
  // full render, which restores the scroll position.
  if (!(sessionListEl instanceof HTMLElement && updateSelectionHighlight(sessionListEl, id))) renderList();
  renderDetail();
}

function setActiveTab(group: 'req' | 'res', tab: string): void {
  const sel = group === 'req' ? '[data-ni-req-tab]' : '[data-ni-res-tab]';
  document.querySelectorAll(sel).forEach((b) => {
    const btn = b as HTMLElement;
    const val = group === 'req' ? btn.dataset.niReqTab : btn.dataset.niResTab;
    btn.classList.toggle('active', val === tab);
  });
}

async function copyText(text: string, btn: HTMLElement | null): Promise<void> {
  if (!text) return;
  try {
    await api.copyToClipboard(text);
    flashCopied(btn);
  } catch {
    /* ignore */
  }
}

function paneBodyText(which: 'request' | 'response'): string {
  const showingBody = which === 'request' ? state.requestTab === 'body' : state.responseTab === 'body';
  const el = which === 'request' ? requestBodyEl : responseBodyEl;
  return paneBodyTextShared(selectedEvent(), which, showingBody, el);
}

function closeCopyDropdown(): void {
  if (copyDropdownEl && !(copyDropdownEl as HTMLElement).hidden) (copyDropdownEl as HTMLElement).hidden = true;
  copyCaretEl?.setAttribute('aria-expanded', 'false');
}

function wireEvents(): void {
  // In-flow, drag-to-resize session filter (see the `.nsv-root .ni-header-center` overrides). Dragging
  // the right-edge handle sets the `--nsv-filter-w` CSS var; double-click resets to the CSS default.
  // In-flow → it can NEVER wrap to a second row (the live tab's centered slot did). Window-lifetime
  // width, so no cross-session persistence needed.
  // Centered, drag-to-resize filter — the same app-wide behavior as the live tab (and the Query /
  // App Connector / Log Viewer find bars): shared slot CSS, shared handle, per-surface width memory.
  const niHeaderCenter = $('.ni-header-center');
  if (niHeaderCenter instanceof HTMLElement) {
    makeCenteredSearchResizable(niHeaderCenter, {
      storageKey: filterWidthKey('nsv'),
      leftGroupSelector: '.ni-header-start',
      rightGroupSelector: ':scope > .ni-header-tools',
      minWidthPx: 280,
      handleHost: niHeaderCenter.querySelector<HTMLElement>('.ni-filter-wrap')
    });
  }

  const applyFilter = (): void => {
    if (!filterInput) return;
    store.setQuery(filterInput.value);
    syncFilterClear();
    renderList();
    findModal?.refresh();
  };

  // Input + Up/Down history + clear + help — via the shared wiring (network-filter-help.ts). Window
  // lifetime, so the returned dispose handle is unused (no AbortController teardown like the live tab).
  wireNetworkFilterControls({
    filterInput,
    filterClearBtn,
    filterHelpBtn,
    historyStorageKey: filterHistoryKey('nsv'),
    onApply: applyFilter
  });

  groupByHostInput?.addEventListener('change', () => {
    state.viewMode = groupByHostInput.checked ? 'structure' : 'sequence';
    sessionPaneEl?.setAttribute('data-view', state.viewMode);
    renderList();
    findModal?.refresh();
  });

  // "Proxied" (decrypted-only) filter — same predicate as the live tab (buildSessions decryptedOnly).
  const decryptedOnlyInput = $('[data-ni-decrypted-only]') as HTMLInputElement | null;
  decryptedOnlyInput?.addEventListener('change', () => {
    state.decryptedOnly = !!decryptedOnlyInput.checked;
    renderList();
    findModal?.refresh();
  });
  // Shared detail-pane affordances: "Large Body" explainer + media preview right-click menu.
  wireFormatInfoButton($('[data-ni-req-format-info]'), 'request');
  wireFormatInfoButton($('[data-ni-res-format-info]'), 'response');
  if (detailPane instanceof HTMLElement) {
    bindMediaContextMenu(detailPane, () => (window as unknown as { roku?: MediaMenuApi }).roku);
  }

  layoutToggleBtn?.addEventListener('click', () => {
    state.detailLayout = state.detailLayout === 'columns' ? 'stacked' : 'columns';
    workspaceEl?.setAttribute('data-detail-layout', state.detailLayout);
    layoutToggleBtn.setAttribute('aria-pressed', String(state.detailLayout === 'columns'));
  });

  // Sidebar: row selection + structure host collapse/expand.
  sessionListEl?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const toggle = target?.closest('[data-struct-toggle]') as HTMLElement | null;
    if (toggle?.dataset.structToggle) {
      const host = toggle.dataset.structToggle;
      if (state.collapsedHosts.has(host)) state.collapsedHosts.delete(host);
      else state.collapsedHosts.add(host);
      renderList();
      return;
    }
    const row = target?.closest('[data-event-id]') as HTMLElement | null;
    if (row?.dataset.eventId) {
      selectEvent(row.dataset.eventId);
      focusListForKeyboard(listScroller());
    }
  });

  // Right-click a host row / group header → Focus/Unfocus menu (mirrors the live Network tab).
  sessionListEl?.addEventListener('contextmenu', (e) => {
    // Focus is disabled in Group-by-Host view; its items are the only ones this menu would hold, so
    // show no menu at all while grouped.
    if (state.viewMode === 'structure') return;
    const host = resolveHostFromNode(e.target as HTMLElement | null);
    if (!host) return;
    e.preventDefault();
    void showHostFocusMenu(host);
  });

  // Detail pane: tabs, format, wrap, copy/export, URL links — via the shared dispatcher.
  if (detailPane instanceof HTMLElement) {
    wireDetailInteractions(detailPane, {
      onUrl: (anchor, url) => openConsoleUrlViewer(anchor, url, { titlePrefix: S.networkSessionViewer.networkSession }),
      onEmbedded: (anchor, pane, idx) => {
        const payload = getEmbeddedStructuredPayload(pane as EmbeddedPane, idx);
        if (payload) openConsoleStructuredViewer(anchor, payload, { titlePrefix: S.networkSessionViewer.networkSession });
      },
      onCopyMenuToggle: () => {
        const dd = copyDropdownEl as HTMLElement | null;
        if (!dd) return;
        const open = dd.hidden;
        dd.hidden = !open;
        copyCaretEl?.setAttribute('aria-expanded', String(open));
      },
      onCopyItem: (item, kind) => {
        const ev = selectedEvent();
        if (kind === 'curl' && ev && isExportableEvent(ev)) void copyText(buildCurlCommand(ev), item);
        else if (kind === 'har' && ev && isExportableEvent(ev)) void copyText(buildHarArchive(ev), item);
        else if (kind === 'url' && ev && isExportableEvent(ev)) void copyText(absoluteUrl(ev), item);
        else void copyText(paneBodyText('request'), item);
        closeCopyDropdown();
      },
      onCopyBody: (btn, which) => void copyText(paneBodyText(which), btn),
      onToggleWrap: (which) => {
        if (which === 'response') state.responseBodyWrap = !state.responseBodyWrap;
        else state.requestBodyWrap = !state.requestBodyWrap;
        syncBodyWrap();
      },
      onSetRequestTab: (tab) => {
        state.requestTab = tab;
        setActiveTab('req', tab);
        renderDetail();
      },
      onSetResponseTab: (tab) => {
        state.responseTab = tab;
        setActiveTab('res', tab);
        renderDetail();
      },
      // Per-request Note modal (header Notes button, all event kinds). Ephemeral: the note is held in
      // memory on the event and flows into per-request Copy-as-HAR; no IPC / disk write-back. A
      // list-only repaint refreshes the row marker.
      onNote: () => {
        const ev = selectedEvent();
        if (!ev) return;
        openNoteModal({
          id: ev.id,
          note: ev.note ?? '',
          subtitle: eventRequestLabel(ev),
          onSave: (_id, value) => {
            ev.note = value.trim() ? value : undefined;
            store.markDirty();
            renderList();
            detailPane?.querySelector('[data-ni-note-open]')?.classList.toggle('has-note', !!ev.note);
          }
        });
      }
    });
  }

  // Fold twisties in the JSON/XML trees toggle via the shared handler.
  if (requestBodyEl instanceof HTMLElement) attachFoldToggle(requestBodyEl);
  if (responseBodyEl instanceof HTMLElement) attachFoldToggle(responseBodyEl);

  // Expand/collapse all host groups (Group-by-Host view only).
  groupToggleBtn?.addEventListener('click', () => {
    if (state.viewMode !== 'structure') return;
    const hosts = state.lastStructureHosts;
    if (hosts.length === 0) return;
    const allCollapsed = hosts.every((h) => state.collapsedHosts.has(h));
    if (allCollapsed) state.collapsedHosts.clear();
    else for (const h of hosts) state.collapsedHosts.add(h);
    renderList();
  });

  detailPane?.addEventListener('change', (e) => {
    const sel = (e.target as HTMLElement | null)?.closest('[data-ni-body-format]') as HTMLSelectElement | null;
    if (!sel?.dataset.niBodyFormat) return;
    const val = sel.value as BodyFormatMode;
    if (sel.dataset.niBodyFormat === 'response') state.responseBodyFormat = val;
    else state.requestBodyFormat = val;
    renderDetail();
  });

  // Show the cURL/HAR export options only for exportable HTTP transactions (like the live tab).
  document.addEventListener('click', (e) => {
    const menu = (e.target as HTMLElement | null)?.closest('[data-ni-copy-menu]');
    if (!menu && copyDropdownEl && !(copyDropdownEl as HTMLElement).hidden) closeCopyDropdown();
  });
}

function updateCopyCaretVisibility(): void {
  const ev = selectedEvent();
  const exportable = !!ev && isExportableEvent(ev);
  (copyCaretEl as HTMLElement | null)?.toggleAttribute('hidden', !exportable);
}

function setupFind(): void {
  findModal = createNetworkFindModal({
    async search(request: NetworkFindRequest) {
      // In-memory search: bodies are inlined in the loaded file, so run the matcher directly over
      // every event (no IPC / disk store like the live tab).
      const terms = createContentMatchers(request.terms ?? []);
      if (terms.length === 0) return [];
      const out: NetworkFindMatch[] = [];
      for (const ev of store.all) {
        const m = matchEventContentMulti(ev, terms);
        if (m) out.push(m);
      }
      return out;
    },
    onResults(matches, termInfo) {
      findMatches = new Map(matches.map((m) => [m.id, m]));
      findTermInfo = termInfo;
      const order = visibleFindOrder();
      const hasResults = order.length > 0;
      applyFindDecorations();
      syncPaneSeedHighlight('request');
      syncPaneSeedHighlight('response');
      findBtn?.classList.toggle('is-find-active', hasResults);
      findBtnGroup?.classList.toggle('has-results', hasResults);
      return order;
    },
    getCurrentId: () => store.getSelectedId(),
    onNavigate(id) {
      // Select + reveal; the ensuing renderDetail → syncBodyFind seeds the pane bars for the new row.
      navigateToFind(id);
    },
    onClear() {
      findMatches = new Map();
      findTermInfo = new Map();
      findCurrentId = null;
      // Modal terms gone; a request's OWN pane terms persist, so re-seed (rather than wipe) the current
      // panes — they now show just this request's user terms.
      syncBodyFind();
      applyFindDecorations();
      syncPaneSeedHighlight('request');
      syncPaneSeedHighlight('response');
      findBtn?.classList.remove('is-find-active');
      findBtnGroup?.classList.remove('has-results');
    },
    onOpen() {
      if (sessionListEl instanceof HTMLElement) sessionListEl.classList.add('ni-find-open');
    },
    onClose() {
      // Strip + re-apply so the match bars ease in together now that `.ni-find-open` (which suppressed
      // the entrance animation while typing) is gone and the list is back to the user's focus.
      if (sessionListEl instanceof HTMLElement) {
        sessionListEl.classList.remove('ni-find-open');
        sessionListEl
          .querySelectorAll('.ni-find-match, .ni-find-current')
          .forEach((el) => el.classList.remove('ni-find-match', 'ni-find-current'));
        sessionListEl
          .querySelectorAll('.ni-find-group-match')
          .forEach((el) => el.classList.remove('ni-find-group-match'));
      }
      applyFindDecorations();
    }
  });
  findBtn?.addEventListener('click', () => findModal?.open());
  findClearBtn?.addEventListener('click', () => findModal?.clear());
  findPrevBtn?.addEventListener('click', () => findModal?.prev());
  findNextBtn?.addEventListener('click', () => findModal?.next());
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return; // the focused list scroller already handled it (shared list nav)
    if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      findModal?.open();
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.shiftKey && findModal?.isActive()) {
      e.preventDefault();
      if (e.key === 'ArrowDown') findModal.next();
      else findModal.prev();
    } else if (e.key === 'Escape') {
      closeCopyDropdown();
    }
  });
}

async function main(): Promise<void> {
  bindPrivacyMode();
  // Localize the static session-viewer.html shell (toolbar, tab labels, tooltips).
  applyI18n(document);
  // Apply the active locale on open + retranslate live on change. The session list and detail body
  // are rendered imperatively from S.*, so re-render them (from the store, selection preserved) after
  // applyI18n handles the static shell + the data-i18n detail-pane labels.
  void initLocaleForWindow(window.roku as unknown as Parameters<typeof initLocaleForWindow>[0], () => {
    if (!sessionDataSettled) return;
    renderList();
    renderDetail();
  });
  wireEvents();
  setupFind();
  setupBodyFind();
  const res = await api.loadNetworkSession();
  if (!res?.success || !res.events) {
    sessionDataSettled = true;
    if (sessionListEl instanceof HTMLElement) {
      sessionListEl.innerHTML = `<div class="ni-session-empty">${escapeText(res?.error || S.networkSessionViewer.failedToLoadSession)}</div>`;
    }
    return;
  }
  sessionDataSettled = true;
  store.setAll(res.events);
  document.title = res.fileName ? S.networkSessionViewer.windowTitleWithFile(res.fileName) : S.networkSessionViewer.networkSession;
  if (res.notice && noticeEl instanceof HTMLElement) {
    noticeEl.textContent = res.notice;
    noticeEl.hidden = false;
  }
  renderList();
  // Auto-select the first session so the panes aren't empty on open.
  const first = filteredSessions()[0];
  if (first) {
    selectEvent(first.eventId);
    updateCopyCaretVisibility();
  }
  // Keep the export caret in sync as selection changes.
  sessionListEl?.addEventListener('click', () => window.setTimeout(updateCopyCaretVisibility, 0));
}

// App-wide instant tooltip for every `[title]`/`[data-tip]`/`[data-tip-html]` in this window —
// same rich `.rds-tip` popover the main window and Settings use instead of the slow native one.
attachInstantTooltips(document.body);

/** Local escape (avoids importing the DOM util just for one string). */
function escapeText(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || c);
}

void main();

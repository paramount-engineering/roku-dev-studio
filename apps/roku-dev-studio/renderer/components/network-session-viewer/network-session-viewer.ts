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
import { attachSearchHistory } from '../../modules/ui/search-history.js';
import { filterHistoryKey } from '../../modules/ui/search-storage-keys.js';
import {
  renderSidebarSequence,
  renderStructureTree,
  syncGroupToggleButton as syncGroupToggleButtonShared
} from '../network-inspector/network-session-view.js';
import {
  renderRequestPane,
  renderResponsePane,
  upgradeStructuredBodies,
  type BodyFormatMode,
  type RequestPaneTab,
  type ResponsePaneTab
} from '../network-inspector/network-detail.js';
import { buildCurlCommand, buildHarArchive, isExportableEvent } from '../network-inspector/network-export.js';
import {
  DETAIL_PANE_HTML,
  wireDetailInteractions,
  syncBodyWrap as syncBodyWrapShared
} from '../network-inspector/network-detail-view.js';
import { paneBodyText as paneBodyTextShared, flashCopied } from '../network-inspector/network-copy.js';
import { openFilterHelpModal } from '../network-inspector/network-filter-help.js';
import { attachFoldToggle } from '../../modules/ui/structured-body.js';
import { openConsoleUrlViewer } from '../../modules/console-log/console-url-modal.js';
import { openConsoleStructuredViewer } from '../../modules/console-log/console-structured-view-modal.js';
import {
  getEmbeddedStructuredPayload,
  type EmbeddedPane
} from '../network-inspector/network-embedded-structured.js';
import { createNetworkFindModal, type FindModalHandle } from '../network-inspector/network-find-modal.js';
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
};

const api = (window as unknown as { roku: RokuApi }).roku;

// The events + derived sessions + filter + selection live in the shared SessionStore (also used by
// the live tab). Bodies are inlined in the parsed file, so this window just `setAll`s once — no
// streaming ingest, no lazy detail fetch.
const store = new SessionStore();

const state = {
  viewMode: 'sequence' as 'sequence' | 'structure',
  requestTab: 'overview' as RequestPaneTab,
  responseTab: 'headers' as ResponsePaneTab,
  requestBodyFormat: 'auto' as BodyFormatMode,
  responseBodyFormat: 'auto' as BodyFormatMode,
  requestBodyWrap: true,
  responseBodyWrap: true,
  collapsedHosts: new Set<string>(),
  detailLayout: 'columns' as 'columns' | 'stacked',
  lastStructureHosts: [] as string[]
};

const $ = <T extends Element = HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);

// "Find in content" (multi-term) — mirrors the live tab, but searches the in-memory events directly
// (bodies are inlined in the loaded file, so no IPC / disk store). Matches badge the list with a
// colored left bar (one segment per matched term); there are no in-body find bars in this window yet.
let findModal: FindModalHandle | null = null;
let findMatches = new Map<string, NetworkFindMatch>();
let findTermInfo = new Map<string, { color: string; query: string }>();
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
if (detailPaneHost) detailPaneHost.innerHTML = DETAIL_PANE_HTML;

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
  return store.filteredSessions();
}

function selectedEvent(): ParsedNetworkEvent | null {
  return store.getSelectedEvent();
}

function renderList(): void {
  if (!(sessionListEl instanceof HTMLElement)) return;
  const sessions = filteredSessions();
  const selectedId = store.getSelectedId();
  if (state.viewMode === 'structure') {
    state.lastStructureHosts = buildStructureGroups(sessions).map((g) => g.host);
    sessionListEl.innerHTML = renderStructureTree(sessions, selectedId, state.collapsedHosts);
  } else {
    state.lastStructureHosts = [];
    sessionListEl.innerHTML = renderSidebarSequence(sessions, selectedId);
  }
  if (sessionCountEl instanceof HTMLElement) {
    const total = store.sessions().length;
    sessionCountEl.textContent = sessions.length === total ? `${total}` : `${sessions.length}/${total}`;
  }
  syncGroupToggleButton();
  // Matching rows are rebuilt by the innerHTML above, so re-badge them from the current match set.
  applyFindDecorations();
}

/** Build the CSS `background` for a row's left bar: one equal-height color segment per matched term. */
function findBarGradient(match: NetworkFindMatch): string {
  const colors: string[] = [];
  for (const [termId, info] of findTermInfo) {
    if (match.terms?.[termId]) colors.push(info.color);
  }
  if (colors.length === 0) return 'var(--accent-amber)';
  if (colors.length === 1) return colors[0]!;
  const step = 100 / colors.length;
  const stops = colors
    .map((c, i) => `${c} ${(i * step).toFixed(3)}% ${((i + 1) * step).toFixed(3)}%`)
    .join(', ');
  return `linear-gradient(to bottom, ${stops})`;
}

/** Badge matching rows with a colored (segmented) left bar; flag collapsed host groups that hold a
 *  match (CSS tints their chevron cyan). Idempotent so the entrance animation only fires on
 *  newly-matched/freshly-rendered rows. */
function applyFindDecorations(): void {
  if (!(sessionListEl instanceof HTMLElement)) return;
  sessionListEl.querySelectorAll('[data-event-id]').forEach((row) => {
    const el = row as HTMLElement;
    const id = el.dataset.eventId;
    const match = id ? findMatches.get(id) : undefined;
    el.classList.toggle('ni-find-match', !!match);
    el.classList.toggle('ni-find-current', !!match && id === findCurrentId);
    if (match) el.style.setProperty('--ni-find-bar', findBarGradient(match));
    else el.style.removeProperty('--ni-find-bar');
  });
  sessionListEl.querySelectorAll('.ni-struct-host').forEach((host) => {
    const hasMatch = !!host.querySelector('.ni-struct-children .ni-find-match');
    host
      .querySelector(':scope > .ni-struct-host-row')
      ?.classList.toggle('ni-find-group-match', hasMatch);
  });
}

/** The ordered set Find's Prev/Next walks — visible (filtered-in) matches in on-screen order. */
function visibleFindOrder(): string[] {
  if (state.viewMode === 'structure' && sessionListEl instanceof HTMLElement) {
    return Array.from(sessionListEl.querySelectorAll('.ni-struct-leaf[data-event-id]'))
      .map((el) => (el as HTMLElement).dataset.eventId)
      .filter((id): id is string => !!id && findMatches.has(id));
  }
  return filteredSessions()
    .map((s) => s.eventId)
    .filter((id) => findMatches.has(id));
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

function renderDetail(): void {
  const ev = selectedEvent();
  if (!detailPane) return;
  if (!ev) {
    detailPane.classList.add('is-empty');
    return;
  }
  detailPane.classList.remove('is-empty');
  if (requestBodyEl instanceof HTMLElement) {
    requestBodyEl.innerHTML = renderRequestPane(ev, state.requestTab, state.requestBodyFormat, store.all);
    upgradeStructuredBodies(requestBodyEl);
  }
  if (responseBodyEl instanceof HTMLElement) {
    responseBodyEl.innerHTML = renderResponsePane(ev, state.responseTab, state.responseBodyFormat);
    upgradeStructuredBodies(responseBodyEl);
  }
  // Format/wrap controls only apply to a body tab; truncated badge from the captured flags.
  reqFormatWrap?.toggleAttribute('hidden', state.requestTab !== 'body');
  resFormatWrap?.toggleAttribute('hidden', state.responseTab !== 'body');
  reqTruncatedBadge?.toggleAttribute('hidden', !(state.requestTab === 'body' && ev.httpRequest?.bodyTruncated));
  resTruncatedBadge?.toggleAttribute('hidden', !(state.responseTab === 'body' && ev.httpResponse?.bodyTruncated));
  syncBodyWrap();
  syncBodyFind();
}

/** Show/hide the body find bars per active tab and seed them with the view-time union (this request's
 *  own terms + the modal's terms, regex + substring). A passive reseed with an unchanged chip set is
 *  skipped so the nav cursor survives (this window has no live churn, but tab toggles route through here). */
function syncBodyFind(): void {
  requestSearch?.setVisible(state.requestTab === 'body');
  responseSearch?.setVisible(state.responseTab === 'body');
  const id = store.getSelectedId();
  if (!id) return;
  for (const which of ['request', 'response'] as const) {
    const bar = which === 'request' ? requestSearch : responseSearch;
    if (!bar) continue;
    const eff = paneFind.computeEffective(id, which);
    if (sameKeywordTexts(eff, bar.getKeywords())) bar.refresh();
    else bar.setKeywords(eff, false);
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
  }
}

function selectEvent(id: string): void {
  if (store.getSelectedId() === id) return;
  store.select(id);
  renderList();
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
  const headerCenter = $('.ni-header-center');
  const filterResizeHandle = $('[data-nsv-filter-resize]');
  if (headerCenter instanceof HTMLElement && filterResizeHandle instanceof HTMLElement) {
    const MIN_W = 240;
    const maxW = (): number => {
      const header = headerCenter.closest('.ni-card-header');
      // Stay clear of the side groups so the single row never overflows.
      return header instanceof HTMLElement ? Math.max(MIN_W, header.clientWidth - 340) : 900;
    };
    let startX = 0;
    let startW = 0;
    const onMove = (e: PointerEvent): void => {
      const w = Math.round(Math.min(maxW(), Math.max(MIN_W, startW + (e.clientX - startX))));
      headerCenter.style.setProperty('--nsv-filter-w', `${w}px`);
    };
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      filterResizeHandle.classList.remove('is-dragging');
    };
    filterResizeHandle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startX = e.clientX;
      startW = headerCenter.offsetWidth;
      document.body.style.userSelect = 'none';
      filterResizeHandle.classList.add('is-dragging');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
    filterResizeHandle.addEventListener('dblclick', () => headerCenter.style.removeProperty('--nsv-filter-w'));
  }

  const applyFilter = (): void => {
    if (!filterInput) return;
    store.setQuery(filterInput.value);
    syncFilterClear();
    renderList();
    findModal?.refresh();
  };

  filterInput?.addEventListener('input', applyFilter);
  // Up/Down arrow recall of previous filter terms (shared behavior).
  if (filterInput) {
    attachSearchHistory({
      input: filterInput,
      storageKey: filterHistoryKey('nsv'),
      onChange: applyFilter
    });
  }

  filterClearBtn?.addEventListener('click', () => {
    if (!filterInput || !filterInput.value) return;
    filterInput.value = '';
    applyFilter();
    filterInput.focus();
  });

  filterHelpBtn?.addEventListener('click', () => {
    openFilterHelpModal((term) => {
      if (!filterInput) return;
      // Append the picked example (comma-OR), then apply immediately.
      const current = filterInput.value.trim();
      filterInput.value = current ? `${current}, ${term}` : term;
      applyFilter();
      filterInput.focus();
    });
  });

  groupByHostInput?.addEventListener('change', () => {
    state.viewMode = groupByHostInput.checked ? 'structure' : 'sequence';
    sessionPaneEl?.setAttribute('data-view', state.viewMode);
    renderList();
    findModal?.refresh();
  });

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
    if (row?.dataset.eventId) selectEvent(row.dataset.eventId);
  });

  // Detail pane: tabs, format, wrap, copy/export, URL links — via the shared dispatcher.
  if (detailPane instanceof HTMLElement) {
    wireDetailInteractions(detailPane, {
      onUrl: (anchor, url) => openConsoleUrlViewer(anchor, url, { titlePrefix: 'Network Session' }),
      onEmbedded: (anchor, pane, idx) => {
        const payload = getEmbeddedStructuredPayload(pane as EmbeddedPane, idx);
        if (payload) openConsoleStructuredViewer(anchor, payload, { titlePrefix: 'Network Session' });
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
    if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      findModal?.open();
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.shiftKey && findModal?.isActive()) {
      e.preventDefault();
      if (e.key === 'ArrowDown') findModal.next();
      else findModal.prev();
    }
  });
}

async function main(): Promise<void> {
  wireEvents();
  setupFind();
  setupBodyFind();
  const res = await api.loadNetworkSession();
  if (!res?.success || !res.events) {
    if (sessionListEl instanceof HTMLElement) {
      sessionListEl.innerHTML = `<div class="ni-session-empty">${escapeText(res?.error || 'Failed to load session.')}</div>`;
    }
    return;
  }
  store.setAll(res.events);
  document.title = res.fileName ? `Network Session — ${res.fileName}` : 'Network Session';
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

/** Local escape (avoids importing the DOM util just for one string). */
function escapeText(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || c);
}

void main();

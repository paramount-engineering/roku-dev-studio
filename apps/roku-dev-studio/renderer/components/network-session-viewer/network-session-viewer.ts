/**
 * Standalone Network Session Viewer — renders a saved capture (`.rds-network-inspector.json` bundle,
 * HAR, or `.pcap`) with the same two-pane UI as the live Network Inspector, read-only.
 *
 * The whole session is parsed in main and delivered once via `window.roku.loadNetworkSession()`
 * (no live capture, no detail-store round-trips — bundles/HAR inline bodies; pcap has none). All
 * rendering reuses the Network Inspector's pure modules (`network-sessions`, `network-session-view`,
 * `network-detail`, `network-export`), so this file is just glue: state + selection + filter + tabs.
 */
import type { ParsedNetworkEvent } from '../../../shared/network-inspector/types';
import { buildStructureGroups, type NetworkSession } from '../network-inspector/network-sessions.js';
import { SessionStore } from '../network-inspector/network-session-store.js';
import {
  renderSidebarSequence,
  renderStructureTree
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
import { DETAIL_PANE_HTML, wireDetailInteractions } from '../network-inspector/network-detail-view.js';
import { openFilterHelpModal } from '../network-inspector/network-filter-help.js';
import { attachFoldToggle } from '../../modules/ui/structured-body.js';
import { openConsoleUrlViewer } from '../../modules/console-log/console-url-modal.js';
import { openConsoleStructuredViewer } from '../../modules/console-log/console-structured-view-modal.js';
import {
  getEmbeddedStructuredPayload,
  type EmbeddedPane
} from '../network-inspector/network-embedded-structured.js';

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

// Inject the shared detail-pane markup before the per-pane queries below read from it, so this
// window and the live inspector render from one source (network-detail-view.ts).
const detailPaneHost = $('[data-ni-detail]');
if (detailPaneHost) detailPaneHost.innerHTML = DETAIL_PANE_HTML;

const filterInput = $<HTMLInputElement>('[data-ni-filter]');
const filterHelpBtn = $<HTMLElement>('[data-ni-filter-help]');
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
}

/** Show the expand/collapse-all-groups control only in Group-by-Host view, and reflect the
 *  all-collapsed vs expanded state on its chevron/label (mirrors the live Network Inspector). */
function syncGroupToggleButton(): void {
  if (!(groupToggleBtn instanceof HTMLButtonElement)) return;
  const hosts = state.lastStructureHosts;
  const show = state.viewMode === 'structure' && hosts.length > 0;
  groupToggleBtn.classList.toggle('is-visible', show);
  groupToggleBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
  groupToggleBtn.tabIndex = show ? 0 : -1;
  if (!show) return;
  const allCollapsed = hosts.every((h) => state.collapsedHosts.has(h));
  const chevron = groupToggleBtn.querySelector('.ni-struct-chevron');
  if (chevron) chevron.textContent = allCollapsed ? '▶' : '▼';
  const label = allCollapsed ? 'Expand all groups' : 'Collapse all groups';
  groupToggleBtn.title = label;
  groupToggleBtn.setAttribute('aria-label', label);
}


function syncBodyWrap(): void {
  requestBodyEl?.classList.toggle('ni-body-nowrap', !state.requestBodyWrap);
  responseBodyEl?.classList.toggle('ni-body-nowrap', !state.responseBodyWrap);
  const reqWrapBtn = $('[data-ni-wrap-toggle="request"]');
  const resWrapBtn = $('[data-ni-wrap-toggle="response"]');
  reqWrapBtn?.classList.toggle('is-active', state.requestBodyWrap);
  reqWrapBtn?.setAttribute('aria-pressed', String(state.requestBodyWrap));
  resWrapBtn?.classList.toggle('is-active', state.responseBodyWrap);
  resWrapBtn?.setAttribute('aria-pressed', String(state.responseBodyWrap));
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
    btn?.classList.add('is-copied');
    window.setTimeout(() => btn?.classList.remove('is-copied'), 1400);
  } catch {
    /* ignore */
  }
}

function paneBodyText(which: 'request' | 'response'): string {
  const ev = selectedEvent();
  if (ev) {
    if (which === 'request' && state.requestTab === 'body') return ev.httpRequest?.body || '';
    if (which === 'response' && state.responseTab === 'body') return ev.httpResponse?.body || '';
  }
  const el = which === 'request' ? requestBodyEl : responseBodyEl;
  return el instanceof HTMLElement ? (el.innerText || el.textContent || '').trim() : '';
}

function closeCopyDropdown(): void {
  if (copyDropdownEl && !(copyDropdownEl as HTMLElement).hidden) (copyDropdownEl as HTMLElement).hidden = true;
  copyCaretEl?.setAttribute('aria-expanded', 'false');
}

function wireEvents(): void {
  filterInput?.addEventListener('input', () => {
    store.setQuery(filterInput.value);
    renderList();
  });

  filterHelpBtn?.addEventListener('click', () => {
    openFilterHelpModal((term) => {
      if (!filterInput) return;
      // Append the picked example (comma-OR), then apply immediately.
      const current = filterInput.value.trim();
      filterInput.value = current ? `${current}, ${term}` : term;
      store.setQuery(filterInput.value);
      renderList();
      filterInput.focus();
    });
  });

  groupByHostInput?.addEventListener('change', () => {
    state.viewMode = groupByHostInput.checked ? 'structure' : 'sequence';
    sessionPaneEl?.setAttribute('data-view', state.viewMode);
    renderList();
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

async function main(): Promise<void> {
  wireEvents();
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

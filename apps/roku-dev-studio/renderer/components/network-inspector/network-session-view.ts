import { escapeHtml } from '../../modules/utils/dom.js';
import {
  buildStructureGroups,
  type NetworkSession,
  statusClass
} from './network-sessions.js';

function sessionMetaHtml(s: NetworkSession): string {
  return `<span class="ni-row-meta">
    <span class="ni-row-ts">${escapeHtml(s.timestampLabel)}</span>
    <span class="ni-row-dur">${escapeHtml(s.durationLabel)}</span>
  </span>`;
}

export function statusPillHtml(s: NetworkSession): string {
  const cls = statusClass(s);
  const spinner = cls === 'ni-status-pending' ? '<span class="ni-status-spin" aria-hidden="true"></span>' : '';
  return `<span class="ni-status-pill ${cls}">${spinner}${escapeHtml(s.status)}</span>`;
}

/** Dynamic row parts (timestamp + duration) that change as a request completes. */
export function rowMetaPartsHtml(s: NetworkSession): { ts: string; dur: string } {
  return { ts: s.timestampLabel, dur: s.durationLabel };
}

function seqPillHtml(index: number, title: string): string {
  return `<span class="ni-seq-pill" title="${escapeHtml(title)}">${index}</span>`;
}

function sidebarRowHtml(s: NetworkSession, selectedEventId: string | null): string {
  const sel = s.eventId === selectedEventId ? ' ni-sidebar-row-selected' : '';
  const mitm = s.decrypted ? ' ni-sidebar-row-mitm' : '';
  const ssl = s.decrypted
    ? '<span class="ni-sidebar-ssl" title="Decrypted (MITM)">🔓</span>'
    : s.encrypted
      ? '<span class="ni-sidebar-ssl" title="HTTPS (encrypted)">🔒</span>'
      : '<span class="ni-sidebar-ssl">—</span>';
  const path = s.path.length > 48 ? `${s.path.slice(0, 45)}…` : s.path;
  return `<div class="ni-sidebar-row${sel}${mitm}" data-event-id="${escapeHtml(s.eventId)}">
    <span class="ni-sidebar-seq">${seqPillHtml(s.index, `Session #${s.index}`)}</span>
    ${ssl}
    <span class="ni-sidebar-host">${escapeHtml(s.host)}</span>
    <span class="ni-sidebar-path">${escapeHtml(s.method)} ${escapeHtml(path)}</span>
    <span class="ni-sidebar-status">${statusPillHtml(s)}</span>
    ${sessionMetaHtml(s)}
  </div>`;
}

export function renderSidebarRows(
  sessions: NetworkSession[],
  selectedEventId: string | null
): string {
  return sessions.map((s) => sidebarRowHtml(s, selectedEventId)).join('');
}

export function renderSidebarSequence(
  sessions: NetworkSession[],
  selectedEventId: string | null
): string {
  if (sessions.length === 0) {
    return `<div class="ni-session-empty">No matching sessions.</div>`;
  }
  return `<div class="ni-sidebar-scroll">${renderSidebarRows(sessions, selectedEventId)}</div>`;
}

function structureLeafHtml(s: NetworkSession, selectedEventId: string | null): string {
  const sel = s.eventId === selectedEventId ? ' ni-struct-leaf-selected' : '';
  const label = s.kind === 'dns' ? s.path : `${s.method} ${s.path}`;
  // Use the session's stable capture index (not a per-group ordinal) so a request keeps the same
  // number across sequence/grouped views and it doesn't renumber when older events are trimmed.
  return `<div class="ni-struct-leaf${sel}" data-event-id="${escapeHtml(s.eventId)}">
    <span class="ni-struct-leaf-seq">${seqPillHtml(s.index, `Request #${s.index}`)}</span>
    <span class="ni-struct-leaf-label">${escapeHtml(label)}</span>
    <span class="ni-struct-leaf-status">${statusPillHtml(s)}</span>
    ${sessionMetaHtml(s)}
  </div>`;
}

/** Leaf rows only, for appending to an existing host group (incremental structure paint). */
export function renderStructureLeaves(
  sessions: NetworkSession[],
  selectedEventId: string | null
): string {
  return sessions.map((s) => structureLeafHtml(s, selectedEventId)).join('');
}

export function renderStructureTree(
  sessions: NetworkSession[],
  selectedEventId: string | null,
  collapsedHosts: Set<string>,
  noticeHtml = ''
): string {
  if (sessions.length === 0) {
    return `<div class="ni-session-empty">No hosts yet. Structure groups traffic by hostname.</div>`;
  }
  const groups = buildStructureGroups(sessions);
  const html = groups
    .map((g) => {
      const open = !collapsedHosts.has(g.host);
      const chevron = open ? '▼' : '▶';
      // A collapsed group that contains the currently-open request carries the
      // selection highlight on its header, so the active request is still
      // discoverable without expanding the group.
      const containsSelected =
        selectedEventId != null && g.sessions.some((s) => s.eventId === selectedEventId);
      const hostStateClass = open ? 'ni-struct-host-open' : 'ni-struct-host-collapsed';
      const rowSel = !open && containsSelected ? ' ni-struct-host-row-selected' : '';
      const children = renderStructureLeaves(g.sessions, selectedEventId);
      return `<div class="ni-struct-host ${hostStateClass}" data-struct-host="${escapeHtml(g.host)}">
        <div class="ni-struct-host-row${rowSel}" data-struct-toggle="${escapeHtml(g.host)}">
          <span class="ni-struct-chevron">${chevron}</span>
          <span class="ni-struct-host-name">${escapeHtml(g.host)}</span>
          <span class="ni-struct-host-count">${g.sessions.length}</span>
        </div>
        <div class="ni-struct-children" style="display:${open ? 'block' : 'none'}">${children}</div>
      </div>`;
    })
    .join('');
  return `<div class="ni-structure-wrap">${noticeHtml}${html}</div>`;
}

/**
 * Sync the "expand/collapse all groups" toggle button: visible only in Group-by-Host view with
 * hosts, chevron + label reflecting the all-collapsed state. Shared by the live tab and the offline
 * viewer so the a11y contract (aria-hidden / tabindex) can't drift between them.
 */
export function syncGroupToggleButton(
  btn: HTMLButtonElement | null,
  viewMode: 'sequence' | 'structure',
  hosts: string[],
  collapsedHosts: Set<string>
): void {
  if (!(btn instanceof HTMLButtonElement)) return;
  const show = viewMode === 'structure' && hosts.length > 0;
  btn.classList.toggle('is-visible', show);
  btn.setAttribute('aria-hidden', show ? 'false' : 'true');
  btn.tabIndex = show ? 0 : -1;
  if (!show) return;
  const allCollapsed = hosts.every((h) => collapsedHosts.has(h));
  const chevron = btn.querySelector('.ni-struct-chevron');
  if (chevron) chevron.textContent = allCollapsed ? '▶' : '▼';
  const label = allCollapsed ? 'Expand all groups' : 'Collapse all groups';
  btn.title = label;
  btn.setAttribute('aria-label', label);
}

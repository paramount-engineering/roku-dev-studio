/**
 * Find-decoration glue shared by the two Network Inspector surfaces — the LIVE tab (`network-tab.ts`)
 * and the standalone Session Viewer (`network-session-viewer.ts`). Both badge matching session rows
 * with a colored left bar (one segment per matched term), flag collapsed host groups that hide a
 * match, and walk Prev/Next over the visible matches in on-screen order. That logic was duplicated
 * verbatim in both files; it's pure DOM + data, so it lives here and each surface passes in its own
 * list element + match state.
 *
 * NOT here (they legitimately differ live-vs-file): the match `search()` itself (IPC-per-device vs
 * in-memory), selection/reveal machinery, and the modal's onResults/onClear deferral. See each caller.
 */

import type { NetworkFindMatch } from '@shared/network-inspector/content-search.js';

/** Per-term display info keyed by term id — the color drives each match bar's segment. */
export type FindTermInfo = Map<string, { color: string; query: string }>;

/**
 * Build the CSS `background` for a matched row's left bar: one equal-height color segment per matched
 * term (in `termInfo` iteration order), a solid color for a single term, or the default amber when a
 * match carries no per-term breakdown.
 */
export function findBarGradient(match: NetworkFindMatch, termInfo: FindTermInfo): string {
  const colors: string[] = [];
  for (const [termId, info] of termInfo) {
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

export interface ApplyFindDecorationsOpts {
  /** The session-list container whose `[data-event-id]` rows get badged. */
  listEl: HTMLElement;
  matches: Map<string, NetworkFindMatch>;
  termInfo: FindTermInfo;
  /** The currently-focused match id (gets `.ni-find-current`), or null. */
  currentId: string | null;
}

/**
 * Badge matching rows with a colored left bar and emphasize the focused match. Re-run after every list
 * repaint (matching rows get rebuilt).
 *
 * The class toggles are idempotent (not remove-all-then-re-add): a row already flagged keeps its class
 * untouched, so the CSS bar-appear animation fires only when a row NEWLY matches (or is freshly
 * rendered) — never re-triggering on every repaint/scroll. The gradient is a CSS var so recoloring or
 * adding a term restyles the bar in place without replaying the entrance animation.
 *
 * In Group-by-Host view a collapsed group hides its leaves (and their bars), so host rows whose group
 * contains a match get `.ni-find-group-match`; the CSS tints the chevron cyan ONLY while collapsed —
 * expanding reverts it and the individual request bars take over.
 */
export function applyFindDecorations({ listEl, matches, termInfo, currentId }: ApplyFindDecorationsOpts): void {
  listEl.querySelectorAll('[data-event-id]').forEach((row) => {
    const el = row as HTMLElement;
    const id = el.dataset.eventId;
    const match = id ? matches.get(id) : undefined;
    const isMatch = !!match;
    el.classList.toggle('ni-find-match', isMatch);
    el.classList.toggle('ni-find-current', isMatch && id === currentId);
    if (match) el.style.setProperty('--ni-find-bar', findBarGradient(match, termInfo));
    else el.style.removeProperty('--ni-find-bar');
  });
  listEl.querySelectorAll('.ni-struct-host').forEach((host) => {
    const hasMatch = !!host.querySelector('.ni-struct-children .ni-find-match');
    host.querySelector(':scope > .ni-struct-host-row')?.classList.toggle('ni-find-group-match', hasMatch);
  });
}

export interface VisibleFindOrderOpts {
  viewMode: 'sequence' | 'structure';
  /** The session-list container (only read in structure view for DOM leaf order). */
  listEl: HTMLElement | null;
  /** Filtered-in event ids in capture order — the walk order for sequence view. */
  sequenceIds: string[];
  matches: Map<string, NetworkFindMatch>;
}

/**
 * The ordered set Find's Prev/Next walks. In Group-by-Host view it follows on-screen group order (DOM
 * leaf order — collapsed groups still render their leaves, and navigation reveals them). In sequence
 * view it's plain capture order. Either way, only filtered-in matches are included.
 */
export function visibleFindOrder({ viewMode, listEl, sequenceIds, matches }: VisibleFindOrderOpts): string[] {
  if (viewMode === 'structure' && listEl) {
    return Array.from(listEl.querySelectorAll('.ni-struct-leaf[data-event-id]'))
      .map((el) => (el as HTMLElement).dataset.eventId)
      .filter((id): id is string => !!id && matches.has(id));
  }
  return sequenceIds.filter((id) => matches.has(id));
}

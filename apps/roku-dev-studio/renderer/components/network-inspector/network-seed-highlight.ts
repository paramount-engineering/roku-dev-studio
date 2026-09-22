/**
 * Standalone highlight of the Find terms on the NON-body detail tabs (Overview URL, Headers). The Body
 * tab has its own find bar (with a count); everywhere else we just paint each hit with the same amber
 * tint so a match in the URL or a header is visible. Shared by the live Network tab and the standalone
 * Session Viewer so a request that Find badged in the list shows WHY on either surface.
 *
 * Separate highlight-registry ids per pane so the two panes (and the body find bars, which use
 * `ni-find-*`) never clobber each other.
 */
import {
  clearFindHighlights,
  ensureFindHighlightStyles,
  paintMatchHighlights,
  supportsCssHighlights
} from '../../modules/ui/find-highlight.js';

export const SEED_HL_REQUEST = 'ni-detail-seed-request';
export const SEED_HL_RESPONSE = 'ni-detail-seed-response';
const SEED_HL_CAP = 2000;

/** Paint every case-insensitive substring hit of `keywords` inside `el` under highlight id `id`. */
export function paintSeedInPane(el: HTMLElement, id: string, keywords: string[]): void {
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

/**
 * Paint (or clear) one pane's seed highlight. Cleared on the Body tab (the find bar owns it there),
 * when the selected request isn't a Find match, or when there are no terms.
 */
export function syncPaneSeedHighlight(opts: {
  el: Element | null;
  tab: string;
  id: string;
  keywords: string[];
  isMatch: boolean;
}): void {
  const { el, tab, id, keywords, isMatch } = opts;
  if (!(el instanceof HTMLElement) || tab === 'body' || !isMatch || keywords.length === 0) {
    clearFindHighlights(id);
    return;
  }
  paintSeedInPane(el, id, keywords);
}

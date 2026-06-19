/**
 * Shared lower layer for the two find-bar engines — the simple DOM-flat `find-bar.ts` (ECP /
 * App Connector / Network bodies) and the rich, model-driven `console-log/console-find-bar.ts`
 * (Console + Log Viewer). The two keep deliberately different *match models* — one walks the
 * rendered text of a single scroll container, the other searches a line-entry model with
 * regex/filter/virtualization — and that split is intentional. What they genuinely share is the
 * CSS Custom Highlight plumbing: the feature-detect, the paint priorities, and the registry
 * set/delete calls. That lives here so both engines reference one implementation instead of
 * re-declaring `supportsCssHighlights` and re-deriving the same `CSS.highlights` conventions.
 *
 * Browser support: requires the CSS Custom Highlight API (Chrome 105+ / Electron 33 = Chromium
 * 130). When absent, counts + navigation still work in both engines; only the painted tint is lost.
 */

export const supportsCssHighlights =
  typeof CSS !== 'undefined' &&
  typeof (CSS as unknown as { highlights?: unknown }).highlights !== 'undefined' &&
  typeof (globalThis as unknown as { Highlight?: unknown }).Highlight === 'function';

/** Paint priority for the "all matches" highlight. The current match sits one above so it always
 *  wins when ranges overlap (and both sit above the default-priority JSON+ inline tint). */
export const HIGHLIGHT_PRIORITY_MATCHES = 10;
export const HIGHLIGHT_PRIORITY_CURRENT = 11;

/** Registry key for a surface's current-match highlight, derived from its base `id`. */
export function currentHighlightId(id: string): string {
  return `${id}-current`;
}

// One injected <style> per id so surfaces without hand-written highlight CSS need zero extra CSS.
// The tints match the in-app find affordances (amber for all matches, orange for the active one).
// Surfaces that ship their own `::highlight()` rules (e.g. the Console's `telnet-find`) simply
// don't call this.
const injectedHighlightStyles = new Set<string>();
export function ensureFindHighlightStyles(id: string): void {
  if (injectedHighlightStyles.has(id) || typeof document === 'undefined') return;
  injectedHighlightStyles.add(id);
  const style = document.createElement('style');
  style.textContent =
    `::highlight(${id}){background-color:rgba(250,204,21,0.30);color:inherit;}` +
    `::highlight(${currentHighlightId(id)}){background-color:rgba(249,115,22,0.85);color:#14141b;}`;
  document.head.appendChild(style);
}

/** Drop both the all-matches and current-match registry entries for `id`. No-op when unsupported. */
export function clearFindHighlights(id: string): void {
  if (!supportsCssHighlights) return;
  CSS.highlights.delete(id);
  CSS.highlights.delete(currentHighlightId(id));
}

/** Rebuild the all-matches highlight for `id` from `ranges` (caller enforces any paint cap). */
export function paintMatchHighlights(id: string, ranges: Range[]): void {
  if (!supportsCssHighlights) return;
  CSS.highlights.delete(id);
  if (ranges.length === 0) return;
  const h = new Highlight();
  h.priority = HIGHLIGHT_PRIORITY_MATCHES;
  for (const r of ranges) h.add(r);
  CSS.highlights.set(id, h);
}

/** Set (or clear, when `range` is null) the single current-match highlight for `id`. */
export function setCurrentMatchHighlight(id: string, range: Range | null): void {
  if (!supportsCssHighlights) return;
  const currentId = currentHighlightId(id);
  if (!range) {
    CSS.highlights.delete(currentId);
    return;
  }
  const h = new Highlight(range);
  h.priority = HIGHLIGHT_PRIORITY_CURRENT;
  CSS.highlights.set(currentId, h);
}

/**
 * Inline tint for nested JSON+ regions, painted via the CSS Custom Highlight API.
 *
 * The outer JSON / XML / nested-JSON+ payloads each have a colored pill in the
 * line gutter. After clicks-resolve-to-deepest-target shipped, users had no way
 * to tell which character ranges of the line belonged to the nested JSON+
 * literal versus the outer object. Painting the nested ranges with a cyan tint
 * (matching `.telnet-structured-view-pill--nested`) gives them a visual map.
 *
 * Why CSS.highlights and not span wrapping:
 *   - Wrapping ranges in `<span>`s would split the existing text-node tree
 *     (URL spans, etc.) and break the find bar's invariant
 *     `contentEl.textContent === entry.text`, which the highlight Range mapper
 *     relies on.
 *   - CSS.highlights paints over Range objects without touching the DOM, so
 *     URL spans, structured pills, and the find-bar overlay all coexist.
 *
 * Lifecycle:
 *   - One singleton Highlight per document is registered the first time we
 *     paint anything. Subsequent paints just `.add(range)` to it.
 *   - Each line's ranges are tracked in a `WeakMap<lineEl, Range[]>` so the
 *     scrollback-trim path can call `clearJsonPlusRangesForLine(lineEl)` to
 *     remove them from the Highlight before the line's DOM is detached.
 */

import type { StructuredConsolePayload } from './structured-log-detect.js';

const HIGHLIGHT_ID = 'telnet-json-plus';

const supportsCssHighlights =
  typeof CSS !== 'undefined' &&
  typeof (CSS as unknown as { highlights?: unknown }).highlights !== 'undefined' &&
  typeof (globalThis as unknown as { Highlight?: unknown }).Highlight === 'function';

let highlight: Highlight | null = null;
const lineToRanges = new WeakMap<HTMLElement, Range[]>();

function ensureHighlight(): Highlight | null {
  if (!supportsCssHighlights) return null;
  if (highlight) return highlight;
  highlight = new Highlight();
  CSS.highlights.set(HIGHLIGHT_ID, highlight);
  return highlight;
}

/**
 * Map a flat character offset into the line's text to a (Text node, offset)
 * pair inside `contentEl`. Mirrors the find bar's mapping. Relies on
 * `contentEl.textContent === entries[i].text`.
 */
function flatOffsetToDomPosition(
  contentEl: HTMLElement,
  flatOffset: number
): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let n: Node | null;
  let lastTextNode: Text | null = null;
  while ((n = walker.nextNode())) {
    if (!(n instanceof Text)) continue;
    lastTextNode = n;
    const len = n.nodeValue?.length ?? 0;
    if (flatOffset <= consumed + len) {
      return { node: n, offset: flatOffset - consumed };
    }
    consumed += len;
  }
  if (lastTextNode && flatOffset === consumed) {
    return { node: lastTextNode, offset: lastTextNode.nodeValue?.length ?? 0 };
  }
  return null;
}

function buildRange(contentEl: HTMLElement, start: number, end: number): Range | null {
  const startPos = flatOffsetToDomPosition(contentEl, start);
  if (!startPos) return null;
  const endPos = flatOffsetToDomPosition(contentEl, end);
  if (!endPos) return null;
  const range = document.createRange();
  try {
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
  } catch {
    return null;
  }
  return range;
}

/**
 * Paint cyan tints over each nested JSON+ region for this line. Idempotent: if
 * ranges were previously stored for this line they are cleared first, so re-running
 * after a content rebuild (e.g. deferred-heavy line drain → URL-span repopulate)
 * picks up fresh Range objects bound to the new text nodes.
 *
 * No-ops on lines that have no nested JSON+ targets, no `lineRange`, or when the
 * runtime doesn't support the CSS Custom Highlight API (we don't fall back to a
 * DOM-wrapping path because the inline tint is purely informational).
 */
export function paintJsonPlusRangesForLine(
  lineEl: HTMLElement,
  contentEl: HTMLElement,
  targets: ReadonlyArray<StructuredConsolePayload>
): void {
  clearJsonPlusRangesForLine(lineEl);
  if (!supportsCssHighlights) return;

  // Detection produces one target per discovered nested literal — so chained
  // escaped JSON (`{"a":"{\"b\":\"{\\\"c\\\":1}\"}"}`) yields three nested targets
  // whose ranges are nested inside each other. Painting *all* of them stacks the
  // 0.10-cyan tint multiple times in the overlap (2x → 0.20, 3x → 0.30, …) and
  // floods the line. Keep only the *outermost* range in each cluster: sort by
  // start ascending, end descending; emit a range only when it starts past the
  // last accepted range's end. Disjoint ranges are preserved untouched.
  const candidate: Array<[number, number]> = [];
  for (const t of targets) {
    if (!t.fromEscapedString || !t.lineRange) continue;
    candidate.push(t.lineRange);
  }
  if (candidate.length === 0) return;

  candidate.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const outermost: Array<[number, number]> = [];
  let lastEnd = -1;
  for (const [s, e] of candidate) {
    if (s >= lastEnd) {
      outermost.push([s, e]);
      lastEnd = e;
    }
    // else: this range is contained inside an already-accepted outer range; skip.
  }

  const ranges: Range[] = [];
  for (const [s, e] of outermost) {
    const r = buildRange(contentEl, s, e);
    if (r) ranges.push(r);
  }
  if (ranges.length === 0) return;

  const h = ensureHighlight();
  if (!h) return;
  for (const r of ranges) h.add(r);
  lineToRanges.set(lineEl, ranges);
}

export function clearJsonPlusRangesForLine(lineEl: HTMLElement): void {
  const ranges = lineToRanges.get(lineEl);
  if (!ranges) return;
  if (highlight) {
    for (const r of ranges) highlight.delete(r);
  }
  lineToRanges.delete(lineEl);
}

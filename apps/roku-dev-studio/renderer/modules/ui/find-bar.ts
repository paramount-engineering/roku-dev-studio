/**
 * Shared "simple" find-in-content bar.
 *
 * One implementation for the lightweight search surfaces — ECP Query Results, App Connector
 * Response, and the Network Inspector Request/Response bodies. (The Console and Log Viewer keep
 * their richer `attachConsoleFindBar`, which is line-model-driven with Find/Filter modes and
 * regex/case/word options — overkill for a single scrollable output element.)
 *
 * Design:
 *   - Model-free: matches are computed by walking the rendered text nodes of one scroll container.
 *   - DOM-light + fast: text segments are cached per render (`refresh`), matches are stored as cheap
 *     numeric offsets (capped), and `Range` objects are built lazily — only for the painted subset
 *     and the current match — via a binary-search offset→node lookup. This keeps typing responsive
 *     even on very large bodies.
 *   - Non-destructive: matches paint with the CSS Custom Highlight API (`CSS.highlights`) over
 *     `Range`s, so syntax-highlight spans / fold trees are never rewritten.
 *   - Fold-aware: if the content uses the shared `.telnet-fold-*` tree, collapsed ancestors of the
 *     current match are expanded, and synthetic collapse summaries are skipped. Both are no-ops when
 *     the content isn't a fold tree.
 *
 * Browser support: requires the CSS Custom Highlight API (Chrome 105+ / Electron 33 = Chromium 130).
 * If absent, counts + scroll still work, just without the painted tint.
 */

import {
  supportsCssHighlights,
  ensureFindHighlightStyles,
  clearFindHighlights,
  paintMatchHighlights,
  setCurrentMatchHighlight
} from './find-highlight.js';
import { attachSearchHistory } from './search-history.js';
import { findHistoryKey } from './search-storage-keys.js';

export type FindBarHandle = {
  /** Show/hide the bar. Hiding drops highlights; the query is retained for next show. */
  setVisible: (visible: boolean) => void;
  isVisible: () => boolean;
  /** Focus + select the input (e.g. from Ctrl/Cmd+F). No-op when hidden. */
  focus: () => void;
  /** Set the query programmatically (e.g. seeded from the Network Inspector Find modal). Searches
   *  immediately when the bar is visible; otherwise the query is applied next time it's shown. */
  setQuery: (query: string, jumpToFirst?: boolean) => void;
  /** Recompute matches against the current body DOM (call after the content repaints). */
  refresh: () => void;
  /** Clear the query, input, and highlights (e.g. the output was reset). Leaves the bar visible. */
  clear: () => void;
  dispose: () => void;
};

export type FindBarOptions = {
  /** Scrollable container whose rendered text is searched. */
  bodyEl: HTMLElement;
  /** The find-bar element (built via {@link buildFindBarElement} or static markup). */
  barEl: HTMLElement;
  /** Unique id for this surface's CSS highlight registry entries (e.g. 'ecp-find'). */
  highlightId: string;
  /** Extra scope suffix for the search-history key (e.g. a device IP) so history
   *  is per-device rather than shared. Omit for a single shared history. */
  historyScope?: string;
  /** Backing store for history (default localStorage; sessionStorage = per-window). */
  historyStorage?: Storage;
};

// Navigation walks up to MAX_MATCHES; paint covers up to PAINT_CAP. Both bound worst-case work for
// tiny queries against large bodies.
const MAX_MATCHES = 5000;
const PAINT_CAP = 2000;

type Segment = { node: Text; start: number };
type MatchOffset = { start: number; end: number };

/** Build the standardized find-bar markup. Insert it next to a scroll container, then pass it to
 *  {@link createFindBar} as `barEl`. */
export function buildFindBarElement(placeholder = 'Find'): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'find-bar';
  bar.hidden = true;
  // The search icon, count, and nav/clear buttons all live INSIDE the input box (`.find-bar-field`):
  // the icon reads as part of the field (not a stray glyph beside it), and the flush-right controls
  // leave no reserved empty gap when nothing is searched.
  bar.innerHTML =
    `<div class="find-bar-field">` +
    `<span class="find-bar-icon icon icon-xs"><svg><use href="#icon-zoom"/></svg></span>` +
    `<input type="text" class="find-bar-input" data-find-input placeholder="${placeholder}" spellcheck="false" aria-label="${placeholder}" />` +
    `<span class="find-bar-count" data-find-count aria-live="polite"></span>` +
    `<button type="button" class="find-bar-btn" data-find-prev title="Previous Match (Shift+Enter)" aria-label="Previous Match"><span class="icon icon-xs"><svg><use href="#icon-chevron-up"/></svg></span></button>` +
    `<button type="button" class="find-bar-btn" data-find-next title="Next Match (Enter)" aria-label="Next Match"><span class="icon icon-xs"><svg><use href="#icon-chevron-down"/></svg></span></button>` +
    `<button type="button" class="find-bar-btn" data-find-clear title="Clear search (Esc)" aria-label="Clear search"><span class="icon icon-xs"><svg><use href="#icon-x"/></svg></span></button>` +
    `</div>`;
  return bar;
}

export function createFindBar(opts: FindBarOptions): FindBarHandle | null {
  const { bodyEl, barEl, highlightId } = opts;

  const inputCandidate = barEl.querySelector('[data-find-input]');
  const countCandidate = barEl.querySelector('[data-find-count]');
  const prevCandidate = barEl.querySelector('[data-find-prev]');
  const nextCandidate = barEl.querySelector('[data-find-next]');
  const clearCandidate = barEl.querySelector('[data-find-clear]');
  if (
    !(inputCandidate instanceof HTMLInputElement) ||
    !(countCandidate instanceof HTMLElement) ||
    !(prevCandidate instanceof HTMLElement) ||
    !(nextCandidate instanceof HTMLElement) ||
    !(clearCandidate instanceof HTMLElement)
  ) {
    return null;
  }
  // Re-bind to fresh consts so the narrowed (non-null) types flow into the nested closures below.
  const inputEl = inputCandidate;
  const countEl = countCandidate;
  const prevEl = prevCandidate;
  const nextEl = nextCandidate;
  const clearEl = clearCandidate;

  ensureFindHighlightStyles(highlightId);

  let visible = false;
  let query = '';
  let matchOffsets: MatchOffset[] = [];
  let currentIndex = -1;
  let debounce: ReturnType<typeof setTimeout> | undefined;

  // Cached flat text + segment index for the current body content. Rebuilt only when the body
  // re-renders (segmentsDirty), not on every keystroke.
  let full = '';
  let segments: Segment[] = [];
  let segmentsDirty = true;

  function clearHighlights(): void {
    clearFindHighlights(highlightId);
  }

  function ensureSegments(): void {
    if (!segmentsDirty) return;
    segmentsDirty = false;
    segments = [];
    const parts: string[] = [];
    let offset = 0;
    const walker = document.createTreeWalker(bodyEl, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // Skip synthetic collapsed-summary text (`…}` mirrors), not real body content.
        const parent = (node as Text).parentElement;
        if (parent && parent.closest('.telnet-fold-summary')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node as Text;
      const len = text.nodeValue?.length ?? 0;
      if (len === 0) continue;
      segments.push({ node: text, start: offset });
      parts.push(text.nodeValue!);
      offset += len;
    }
    full = parts.join('');
  }

  /** Binary-search a flat offset → (Text node, local offset). */
  function locate(offset: number): { node: Text; offset: number } | null {
    if (segments.length === 0) return null;
    let lo = 0;
    let hi = segments.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const seg = segments[mid]!;
      const len = seg.node.nodeValue?.length ?? 0;
      if (offset < seg.start) hi = mid - 1;
      else if (offset > seg.start + len) lo = mid + 1;
      else return { node: seg.node, offset: offset - seg.start };
    }
    const last = segments[segments.length - 1]!;
    return { node: last.node, offset: last.node.nodeValue?.length ?? 0 };
  }

  function buildRange(m: MatchOffset): Range | null {
    const startPos = locate(m.start);
    const endPos = locate(m.end);
    if (!startPos || !endPos) return null;
    const range = document.createRange();
    try {
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);
    } catch {
      return null;
    }
    return range;
  }

  function computeMatches(): void {
    matchOffsets = [];
    currentIndex = -1;
    if (!query) return;
    ensureSegments();
    if (!full) return;
    const haystack = full.toLowerCase();
    const needle = query.toLowerCase();
    let from = 0;
    while (matchOffsets.length < MAX_MATCHES) {
      const idx = haystack.indexOf(needle, from);
      if (idx === -1) break;
      matchOffsets.push({ start: idx, end: idx + needle.length });
      from = idx + needle.length;
    }
  }

  function paintAll(): void {
    if (!supportsCssHighlights) return;
    const cap = Math.min(matchOffsets.length, PAINT_CAP);
    const ranges: Range[] = [];
    for (let i = 0; i < cap; i++) {
      const r = buildRange(matchOffsets[i]!);
      if (r) ranges.push(r);
    }
    paintMatchHighlights(highlightId, ranges);
  }

  /** Expand any collapsed fold groups containing `node` so a match inside them is visible. */
  function expandAncestors(node: Node): void {
    let el = node.parentElement;
    while (el && el !== bodyEl) {
      if (el.classList.contains('telnet-fold-group') && el.classList.contains('telnet-fold-collapsed')) {
        el.classList.remove('telnet-fold-collapsed');
        el.querySelector(':scope > .telnet-fold-twisty')?.setAttribute('aria-expanded', 'true');
      }
      el = el.parentElement;
    }
  }

  function paintCurrent(scroll: boolean): void {
    if (currentIndex < 0 || currentIndex >= matchOffsets.length) {
      setCurrentMatchHighlight(highlightId, null);
      return;
    }
    const range = buildRange(matchOffsets[currentIndex]!);
    if (!range) return;
    expandAncestors(range.startContainer);
    setCurrentMatchHighlight(highlightId, range);
    if (scroll) scrollRangeIntoView(range);
  }

  function scrollRangeIntoView(range: Range): void {
    const startEl =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement;
    startEl?.scrollIntoView({ block: 'center', inline: 'nearest' });
    requestAnimationFrame(() => {
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const view = bodyEl.getBoundingClientRect();
      const pad = 8;
      if (rect.top >= view.top + pad && rect.bottom <= view.bottom - pad) return;
      const desiredTop = view.top + (view.height - rect.height) / 2;
      bodyEl.scrollTo({ top: bodyEl.scrollTop + (rect.top - desiredTop), behavior: 'auto' });
    });
  }

  function updateCount(): void {
    if (!query) {
      countEl.textContent = '';
      barEl.classList.remove('find-bar-empty');
      return;
    }
    if (matchOffsets.length === 0) {
      countEl.textContent = 'No results';
      barEl.classList.add('find-bar-empty');
      return;
    }
    barEl.classList.remove('find-bar-empty');
    const total = matchOffsets.length >= MAX_MATCHES ? `${MAX_MATCHES}+` : `${matchOffsets.length}`;
    countEl.textContent = `${currentIndex + 1} of ${total}`;
  }

  function runSearch(jumpToFirst: boolean): void {
    computeMatches();
    paintAll();
    if (matchOffsets.length > 0 && jumpToFirst) {
      currentIndex = 0;
      paintCurrent(true);
    } else {
      setCurrentMatchHighlight(highlightId, null);
    }
    updateCount();
  }

  function next(): void {
    if (matchOffsets.length === 0) return;
    currentIndex = (currentIndex + 1) % matchOffsets.length;
    paintCurrent(true);
    updateCount();
  }

  function prev(): void {
    if (matchOffsets.length === 0) return;
    currentIndex = (currentIndex - 1 + matchOffsets.length) % matchOffsets.length;
    paintCurrent(true);
    updateCount();
  }

  function doClear(): void {
    inputEl.value = '';
    query = '';
    clearTimeout(debounce);
    matchOffsets = [];
    currentIndex = -1;
    clearHighlights();
    updateCount();
  }

  const onInput = (): void => {
    query = inputEl.value;
    clearTimeout(debounce);
    debounce = setTimeout(() => runSearch(true), 150);
  };

  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounce);
      if (inputEl.value !== query) {
        query = inputEl.value;
        runSearch(true);
        return;
      }
      if (e.shiftKey) prev();
      else next();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (inputEl.value) {
        // Clear the query and swallow the event so a containing modal's
        // Escape-to-close handler doesn't also fire — Escape in a search box
        // should clear the search first, not dismiss the whole modal. A second
        // Escape (now empty) falls through below and closes/blurs as usual.
        e.stopPropagation();
        doClear();
      } else {
        inputEl.blur();
        bodyEl.focus();
      }
    }
  };

  inputEl.addEventListener('input', onInput);
  inputEl.addEventListener('keydown', onKeydown);
  prevEl.addEventListener('click', prev);
  nextEl.addEventListener('click', next);
  clearEl.addEventListener('click', () => {
    doClear();
    bodyEl.focus();
  });

  // Up/Down arrow recall of previous search terms (shared behavior).
  const historyHandle = attachSearchHistory({
    input: inputEl,
    storageKey: findHistoryKey(highlightId, opts.historyScope),
    storage: opts.historyStorage,
    onChange: (v) => {
      query = v;
      runSearch(true);
    }
  });

  barEl.hidden = true;

  return {
    setVisible(v: boolean) {
      if (v === visible) return;
      visible = v;
      barEl.hidden = !v;
      if (v) {
        segmentsDirty = true;
        if (query) runSearch(false);
      } else {
        clearHighlights();
      }
    },
    isVisible: () => visible,
    focus() {
      if (!visible) return;
      inputEl.focus();
      inputEl.select();
    },
    setQuery(q: string, jumpToFirst = true) {
      if (inputEl.value === q && query === q) {
        // Already showing this query — just re-anchor if visible (content may have repainted).
        if (visible) runSearch(jumpToFirst);
        return;
      }
      inputEl.value = q;
      query = q;
      clearTimeout(debounce);
      if (visible) runSearch(jumpToFirst);
    },
    refresh() {
      if (!visible || !query) return;
      // Content changed under us; rebuild segments + matches without yanking the scroll, then
      // re-anchor the current match in place.
      segmentsDirty = true;
      runSearch(false);
      if (matchOffsets.length > 0) {
        currentIndex = 0;
        paintCurrent(false);
        updateCount();
      }
    },
    clear: doClear,
    dispose() {
      clearTimeout(debounce);
      inputEl.removeEventListener('input', onInput);
      inputEl.removeEventListener('keydown', onKeydown);
      prevEl.removeEventListener('click', prev);
      nextEl.removeEventListener('click', next);
      historyHandle.dispose();
      clearHighlights();
    }
  };
}

/** Bind Ctrl/Cmd+F on `target` to focus the find bar — but only while the bar is visible, so it
 *  stays inert on surfaces/tabs where there's nothing to search. Returns a remover. */
export function bindFindShortcut(target: HTMLElement, handle: FindBarHandle): () => void {
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

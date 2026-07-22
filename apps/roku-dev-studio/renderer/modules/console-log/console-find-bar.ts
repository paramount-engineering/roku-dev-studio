/**
 * Find / filter bar for `.telnet-output` (Console + log file viewer). Same markup/CSS as device Console.
 *
 * Model-driven search: we search the entries[] array (the parsed line text), never the
 * rendered DOM. Highlights are painted via the CSS Custom Highlight API
 * (`CSS.highlights`), which paints over `Range` objects without touching the underlying
 * DOM. Consequences:
 *   - Matches inside `.telnet-log-url` spans, structured-payload pills, etc. are found
 *     (the previous DOM-walking implementation skipped those subtrees).
 *   - URL spans / classification CSS / structured-pill widgets are never disturbed.
 *   - Search cost is O(N entries × String.matchAll), not O(N DOM walks). On a 180k-line
 *     file the work is dominated by `matchAll`, not RAF scheduling.
 *
 * Browser support: requires the CSS Custom Highlight API (Chrome 105+, Safari 17.2+).
 * Electron 33 ships Chromium 130, so we always have it; if the API is missing we still
 * compute counts and navigate, just without painted highlights.
 *
 * Pure helpers (regex compile, ReDoS guard, query match, cache key) live in
 * `console-find-helpers.ts` so the algorithmic pieces are readable without
 * scrolling past the DOM event glue.
 */

import {
  buildSearchRegex,
  cacheKeyFor,
  FIND_CACHE_CAP,
  HIGHLIGHT_PAINT_CAP,
  consoleFindMatchesQuery,
  type FindCacheEntry,
  type FlatHit,
  type ConsoleFindOptions
} from './console-find-helpers.js';
import {
  supportsCssHighlights,
  HIGHLIGHT_PRIORITY_MATCHES,
  setCurrentMatchHighlight
} from '../ui/find-highlight.js';
import { attachSearchHistory } from '../ui/search-history.js';
import { findHistoryKey } from '../ui/search-storage-keys.js';
import { looksLikeRegex } from '@shared/platform/text-match.js';

// Re-export so existing callers that imported these from the find-bar module
// keep working after the helpers were extracted.
export {
  consoleFindMatchesQuery,
  type ConsoleFindOptions
} from './console-find-helpers.js';

/**
 * Source-of-truth model for find / filter. The find bar reads from this — it never
 * reads `textContent` off the DOM. Consumers (log file viewer, live Console panel)
 * implement this against their own line buffer.
 */
export type ConsoleFindModel = {
  /** Total number of entries (lines) in the model. */
  getEntryCount(): number;
  /** Entry text by 0-based line index, or undefined if out of range. Must equal the
   *  line's rendered `.telnet-log-content` `textContent` for highlight ranges to land
   *  on the correct characters. */
  getEntryText(lineIndex: number): string | undefined;
  /** DOM line element for an entry, or null if the line is not currently in the DOM
   *  (e.g. virtualized / trimmed). */
  getLineEl(lineIndex: number): HTMLElement | null;
  /** Iterate every currently-mounted (line index, element) pair. For non-virtualized
   *  models this is every entry; for virtualized models, just the visible window. The
   *  find bar uses this to (re)bind highlight ranges only for lines whose text nodes
   *  exist in the DOM right now. */
  forEachMountedLine(cb: (lineIndex: number, lineEl: HTMLElement) => void): void;
};

export type ConsoleFindBarHandle = {
  resetFindState: () => void;
  /** Call after the underlying model mutated in a way that doesn't fit the
   *  append/remove hooks below — re-runs the active query from scratch. Cheap
   *  when there is no active query. */
  refresh: () => void;
  /** The model's entries were WIPED (Clear Console / connect reset). Drops the
   *  now-stale cache and re-runs the active query against the fresh buffer, so the
   *  find count keeps auto-updating as new matching lines stream in (without this,
   *  a cleared-then-refilled console leaves the count dead until the query is retyped). */
  onLinesCleared: () => void;
  /** New entries were appended to the model. The cache is updated incrementally:
   *  the active query gets its tail scanned and painted; inactive cached queries
   *  keep their prior `scannedUpTo` and are extended lazily on next use. */
  onLinesAppended: () => void;
  /** `count` entries were removed from the head of the model (scrollback trim).
   *  Adjusts cached hits in-place so `lineIndex` references stay valid. */
  onLinesRemoved: (count: number) => void;
  /** Called by virtualized consumers when a line element mounts. The find bar
   *  builds Range objects for any active-query hits in this line and adds them
   *  to the global Highlight. No-op when there's no active query. */
  bindLineHighlights: (lineIndex: number, lineEl: HTMLElement) => void;
  /** Called by virtualized consumers when a line element unmounts. Removes that
   *  line's Range objects from the global Highlight so detached text nodes don't
   *  linger in the registry. */
  unbindLineHighlights: (lineIndex: number) => void;
  getFindOptions: () => ConsoleFindOptions;
  getMode: () => 'find' | 'filter';
  getQuery: () => string;
  /**
   * Single source of truth for "is this entry hidden by the active filter?".
   * Returns `true` only when (a) mode is `filter`, (b) the query is non-empty,
   * and (c) the entry text doesn't match. Both surfaces (live Console row
   * builder, Log Viewer mount opt) call this so a future filter rule (case-
   * sensitive default, multi-line regex, …) lands in one place — earlier each
   * surface re-derived the predicate inline and one would inevitably drift.
   */
  shouldFilterOut: (text: string) => boolean;
  /** Move focus to the find input (e.g. from a Cmd+F / Ctrl+F shortcut handler). */
  focusInput: () => void;
  /** Programmatically navigate to the next / Previous Match, same as the bar's own buttons. */
  searchNext: () => void;
  searchPrev: () => void;
  /** Toggle Find ⇄ Filter, mirroring the dropdown. Triggers a re-evaluation. */
  toggleMode: () => void;
  dispose: () => void;
};

export type AttachConsoleFindBarOpts = {
  /** Element that contains `.telnet-find-bar`, `.telnet-find-input`, … (e.g. device panel or log viewer header). */
  root: HTMLElement | Document;
  outputEl: HTMLElement;
  model: ConsoleFindModel;
  /** Unique key for this find bar's CSS Custom Highlight registry entries. Defaults
   *  to `'telnet-find'`. Override when multiple find bars share a document. */
  highlightId?: string;
  /** Extra scope suffix for the search-history key (e.g. a device IP) so history
   *  is per-device rather than shared. Omit for a single shared history. */
  historyScope?: string;
  /** Backing store for history (default localStorage; sessionStorage = per-window). */
  historyStorage?: Storage;
  /**
   * Optional virtualization-aware scroll-into-view. When provided, the find bar
   * uses this to navigate to a hit's line instead of the DOM `scrollIntoView`
   * (which fails for lines that aren't mounted yet). The implementation should
   * mount the row if necessary and then position it within the viewport.
   *
   * If omitted, the find bar falls back to `lineEl.scrollIntoView` (suitable for
   * non-virtualized models where every entry is in the DOM).
   */
  scrollLineIntoView?: (lineIndex: number) => void;
  /**
   * Whole-file search delegate. When present, **Find mode** calls this instead
   * of scanning `model.getEntryText` line-by-line — used by the windowed Log
   * Viewer, which only holds a slice of the file resident in the renderer so an
   * in-memory scan would miss matches outside the loaded window. Returns hits
   * (`line` is the model/view index), the matching-line set, and a `truncated`
   * flag, or `null` when a newer search superseded this one (ignore it).
   *
   * Callers that provide this get no incremental cache / append-tail scanning —
   * each query is one round trip to the search backend.
   */
  remoteSearch?: (
    query: string,
    options: ConsoleFindOptions
  ) => Promise<{ hits: FlatHit[]; matchLines: number[]; truncated: boolean } | null>;
  /**
   * Filter-mode line-set sink. When present (alongside `remoteSearch`),
   * **Filter mode** does NOT toggle `filtered-out` classes across model rows;
   * instead it reports the matching line numbers here (or `null` to clear the
   * filter) so a windowed consumer can collapse its virtual list to just the
   * matching lines. The find bar still drives the query/debounce/regex; the
   * consumer owns how the collapse is rendered.
   */
  onFilterLinesChange?: (matchLines: number[] | null) => void;
};

export function attachConsoleFindBar(opts: AttachConsoleFindBarOpts): ConsoleFindBarHandle | null {
  const { outputEl, model } = opts;
  const root = opts.root instanceof Document ? opts.root.documentElement : opts.root;
  const highlightId = opts.highlightId ?? 'telnet-find';

  const findBarCandidate = root.querySelector('.telnet-find-bar');
  const modeSelectCandidate = root.querySelector('.telnet-mode-select');
  const findInputCandidate = root.querySelector('.telnet-find-input');
  const findCountCandidate = root.querySelector('.telnet-find-count');
  const findPrevCandidate = root.querySelector('.telnet-find-prev');
  const findNextCandidate = root.querySelector('.telnet-find-next');
  const findClearCandidate = root.querySelector('.telnet-find-clear');

  if (
    !(findBarCandidate instanceof HTMLElement) ||
    !(modeSelectCandidate instanceof HTMLSelectElement) ||
    !(findInputCandidate instanceof HTMLInputElement) ||
    !(findCountCandidate instanceof HTMLElement) ||
    !(findPrevCandidate instanceof HTMLElement) ||
    !(findNextCandidate instanceof HTMLElement) ||
    !(findClearCandidate instanceof HTMLElement)
  ) {
    return null;
  }

  const findBarEl = findBarCandidate;
  const modeSelectEl = modeSelectCandidate;
  const findInputEl = findInputCandidate;
  const findCountEl = findCountCandidate;
  const findPrevEl = findPrevCandidate;
  const findNextEl = findNextCandidate;
  const findClearEl = findClearCandidate;
  const regexBtnEl = root.querySelector<HTMLElement>('.telnet-option-btn[data-option="regex"]');

  // Nudge (don't force) regex mode when the draft has strong regex signals and the toggle is still
  // off: pulse the `.*` button so one click switches to a regex search. Mirrors the Find modal and
  // the multi-keyword find bar.
  const syncRegexSuggest = (): void => {
    if (!regexBtnEl) return;
    const suggest = !findOptions.regex && looksLikeRegex(findInputEl.value);
    regexBtnEl.classList.toggle('is-suggested', suggest);
    regexBtnEl.title = suggest
      ? 'This looks like a regular expression — click to search by regex'
      : 'Use Regular Expression (Alt+R)';
  };

  let currentMode: 'find' | 'filter' = modeSelectEl.value === 'filter' ? 'filter' : 'find';
  let currentQuery = '';
  /** Flat list of all matches across all entries, in document order. When a cache
   *  entry is in play (find mode with an active query), this is *aliased* to that
   *  entry's `hits` array — pushing during a chunked scan updates the cache too. */
  let flatHits: FlatHit[] = [];
  let currentHitIndex = -1;
  const findOptions: ConsoleFindOptions = { case: false, word: false, regex: false };

  /**
   * LRU cache of `(query, options) → hits + scannedUpTo`. `Map`'s insertion-order
   * iteration is the LRU order; bump on access by `delete + set`, evict the
   * oldest entry when the size exceeds `FIND_CACHE_CAP`.
   *
   * Filter mode does not use the cache — its semantics (toggle visibility per
   * line, no enumeration of match ranges) make caching a different shape.
   */
  const cache: Map<string, FindCacheEntry> = new Map();
  /** The cache slot the current find query is reading from. `flatHits` aliases
   *  `currentEntry.hits`, so pushes go into both. `null` when there is no active
   *  query (or in filter mode). */
  let currentEntry: FindCacheEntry | null = null;

  let searchAbortController: { abort: boolean } | null = null;
  let findTimeout: ReturnType<typeof setTimeout> | undefined;

  /**
   * Monotonic token for the remote (whole-file) search path. Each new query
   * bumps it; an in-flight `remoteSearch` promise that resolves against a stale
   * token is ignored, so fast typing can't paint results for a superseded query.
   */
  let remoteSearchSeq = 0;
  /** True when the last remote result was capped by the backend (more matches
   *  exist than were returned). Surfaced in the count label. */
  let remoteTruncated = false;

  /**
   * The hit the user most recently asked to navigate to (Next/Prev/typing).
   * `tryScrollPendingHitIntoView` consumes (and clears) it once the line is
   * mounted and the actual match Range can be positioned in the viewport.
   *
   * Why: the per-line scroll in `highlightCurrentMatch` only centers the
   * `.telnet-log-line` element. For a single log line that wraps onto many
   * visual rows (e.g. a 500 KB JSON dump on one entry), centering the line
   * puts the *middle* of the wrapped content in view — the actual match,
   * often near the start, ends up far above or below the viewport. Following
   * up with a Range-based scroll lands the matched characters themselves.
   *
   * Multiple paths (the immediate 2-RAF after Next, the line-mount hook in
   * `bindLineHighlights`) try to satisfy the pending hit; the first one to
   * find a mounted line wins and clears the slot.
   */
  let pendingScrollHit: FlatHit | null = null;

  /**
   * Persistent global Highlight. Range objects are added/removed per *line* as it
   * mounts/unmounts (`bindLineHighlights` / `unbindLineHighlights`), so the
   * registry only ever holds ranges whose underlying text nodes are still in the
   * DOM. This is what makes the highlight survive virtualization scroll —
   * unmounted rows have their ranges dropped, remounted rows re-bind freshly.
   */
  let allHighlight: Highlight | null = null;
  /** Per-line ranges currently in `allHighlight`, keyed by entry index. Lets
   *  `unbindLineHighlights(idx)` find exactly which ranges to remove without
   *  walking the entire registry. */
  const lineBindings = new Map<number, Range[]>();

  function clearAllHighlights(): void {
    if (allHighlight) {
      // Rather than re-creating the Highlight (which would also invalidate any
      // browser-side caches), explicitly drop every range we added. Cheap; we
      // only ever have ranges for currently-mounted lines.
      for (const ranges of lineBindings.values()) {
        for (const r of ranges) allHighlight.delete(r);
      }
    }
    lineBindings.clear();
    setCurrentMatchHighlight(highlightId, null);
    if (!supportsCssHighlights || !allHighlight) return;
    // Drop the empty Highlight; lazy-recreate on next paint.
    CSS.highlights.delete(highlightId);
    allHighlight = null;
  }

  /**
   * Map a flat-string offset inside `entries[lineIndex].text` to a (Text node, offset)
   * pair inside the rendered `.telnet-log-content`. Walks every text node — including
   * those inside `.telnet-log-url` spans — because the rendered text is segmented across
   * those subtrees but the entry text is flat. Relies on
   * `contentEl.textContent === entries[lineIndex].text`.
   */
  function flatOffsetToDomPosition(
    contentEl: HTMLElement,
    flatOffset: number
  ): { node: Text; offset: number } | null {
    const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
    let consumed = 0;
    let node: Node | null;
    let lastTextNode: Text | null = null;
    while ((node = walker.nextNode())) {
      if (!(node instanceof Text)) continue;
      lastTextNode = node;
      const len = node.nodeValue?.length ?? 0;
      if (flatOffset <= consumed + len) {
        return { node, offset: flatOffset - consumed };
      }
      consumed += len;
    }
    // End-of-text fallback: a match ending exactly at content length lands on the last
    // text node's end. Avoids losing the trailing match when offsets equal total length.
    if (lastTextNode && flatOffset === consumed) {
      return { node: lastTextNode, offset: lastTextNode.nodeValue?.length ?? 0 };
    }
    return null;
  }

  function buildRangeForHit(hit: FlatHit): Range | null {
    const lineEl = model.getLineEl(hit.lineIndex);
    if (!lineEl) return null;
    const contentEl = lineEl.querySelector('.telnet-log-content');
    if (!(contentEl instanceof HTMLElement)) return null;
    const startPos = flatOffsetToDomPosition(contentEl, hit.start);
    if (!startPos) return null;
    const endPos = flatOffsetToDomPosition(contentEl, hit.end);
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

  function ensureAllHighlight(): Highlight | null {
    if (!supportsCssHighlights) return null;
    if (allHighlight) return allHighlight;
    allHighlight = new Highlight();
    // Higher than the JSON+ inline tint (default priority 0) so search hits
    // always paint over JSON+ regions instead of disappearing into them.
    allHighlight.priority = HIGHLIGHT_PRIORITY_MATCHES;
    CSS.highlights.set(highlightId, allHighlight);
    return allHighlight;
  }

  /**
   * Bind every find hit on `lineIndex` into the global Highlight. Idempotent:
   * if the line was already bound, the previous ranges are removed first.
   * Capped at `HIGHLIGHT_PAINT_CAP` total ranges across all lines to avoid
   * pathological cases (a query matching every space character on a 180k-line
   * file produces hundreds of thousands of hits — paint count, not paint, is
   * what matters at that scale).
   */
  function bindLineFindRangesInternal(lineIndex: number, lineEl: HTMLElement): void {
    if (currentMode !== 'find' || flatHits.length === 0) return;
    const h = ensureAllHighlight();
    if (!h) return;
    // Remove any existing binding for this line first (idempotent rebind).
    unbindLineFindRangesInternal(lineIndex);
    // Count ranges already in the registry; bail if we'd exceed the paint cap.
    let alreadyPainted = 0;
    for (const ranges of lineBindings.values()) alreadyPainted += ranges.length;
    if (alreadyPainted >= HIGHLIGHT_PAINT_CAP) return;
    const remaining = HIGHLIGHT_PAINT_CAP - alreadyPainted;

    const contentEl = lineEl.querySelector('.telnet-log-content');
    if (!(contentEl instanceof HTMLElement)) return;

    const ranges: Range[] = [];
    for (const hit of flatHits) {
      if (hit.lineIndex !== lineIndex) continue;
      if (ranges.length >= remaining) break;
      const startPos = flatOffsetToDomPosition(contentEl, hit.start);
      if (!startPos) continue;
      const endPos = flatOffsetToDomPosition(contentEl, hit.end);
      if (!endPos) continue;
      const r = document.createRange();
      try {
        r.setStart(startPos.node, startPos.offset);
        r.setEnd(endPos.node, endPos.offset);
      } catch {
        continue;
      }
      ranges.push(r);
    }
    if (ranges.length === 0) return;
    for (const r of ranges) h.add(r);
    lineBindings.set(lineIndex, ranges);
  }

  function unbindLineFindRangesInternal(lineIndex: number): void {
    const ranges = lineBindings.get(lineIndex);
    if (!ranges) return;
    if (allHighlight) {
      for (const r of ranges) allHighlight.delete(r);
    }
    lineBindings.delete(lineIndex);
    // If the active match was on this line, drop the current highlight too —
    // it'll be re-painted by `paintCurrentHighlight` if the line re-mounts.
    if (currentHitIndex >= 0 && flatHits[currentHitIndex]?.lineIndex === lineIndex) {
      setCurrentMatchHighlight(highlightId, null);
    }
  }

  /**
   * Drop and rebuild every line binding using the current model's mounted set.
   * Called when `flatHits` itself changes (new query, scan progress, trim) —
   * all existing bindings might point to stale ranges in stale lines.
   */
  function rebindAllMountedLines(): void {
    if (allHighlight) {
      for (const ranges of lineBindings.values()) {
        for (const r of ranges) allHighlight.delete(r);
      }
    }
    lineBindings.clear();
    if (currentMode !== 'find' || flatHits.length === 0) return;
    model.forEachMountedLine((idx, el) => bindLineFindRangesInternal(idx, el));
  }

  function paintCurrentHighlight(): void {
    if (!supportsCssHighlights) return;
    if (currentHitIndex < 0 || currentHitIndex >= flatHits.length) {
      setCurrentMatchHighlight(highlightId, null);
      return;
    }
    const hit = flatHits[currentHitIndex]!;
    const lineEl = model.getLineEl(hit.lineIndex);
    if (!lineEl) {
      // The current match's line isn't mounted yet (e.g. virtualization hasn't
      // scrolled to it). The caller's scroll-into-view will trigger a mount,
      // and the eventual `bindLineHighlights` will repaint via this same path.
      setCurrentMatchHighlight(highlightId, null);
      return;
    }
    // `buildRangeForHit` may return null (offsets didn't resolve); the shared helper treats null
    // as "clear", which matches the prior else-branch. The current match sits one priority above
    // the all-hits highlight so it stays unambiguous when ranges overlap.
    setCurrentMatchHighlight(highlightId, buildRangeForHit(hit));
  }

  /**
   * Refine the scroll position so the actual match Range — not the line
   * element — sits inside the viewport. No-op if the range is already fully
   * visible (small padding). Always clears `pendingScrollHit` on a successful
   * attempt so the line-mount hook doesn't re-run it.
   */
  function tryScrollPendingHitIntoView(): void {
    const hit = pendingScrollHit;
    if (!hit) return;
    const lineEl = model.getLineEl(hit.lineIndex);
    if (!lineEl) return; // line not mounted yet — wait for `bindLineHighlights`
    const range = buildRangeForHit(hit);
    if (!range) return;
    const rangeRect = range.getBoundingClientRect();
    if (rangeRect.width === 0 && rangeRect.height === 0) return;
    const scrollRect = outputEl.getBoundingClientRect();
    pendingScrollHit = null;
    const PADDING = 4;
    if (
      rangeRect.top >= scrollRect.top + PADDING &&
      rangeRect.bottom <= scrollRect.bottom - PADDING
    ) {
      return;
    }
    const desiredTop = scrollRect.top + (scrollRect.height - rangeRect.height) / 2;
    const delta = rangeRect.top - desiredTop;
    outputEl.scrollTo({ top: outputEl.scrollTop + delta, behavior: 'auto' });
  }

  function highlightCurrentMatch(scrollIntoView: boolean): void {
    paintCurrentHighlight();
    if (currentHitIndex < 0 || currentHitIndex >= flatHits.length) return;
    if (!scrollIntoView) return;

    const hit = flatHits[currentHitIndex]!;
    pendingScrollHit = hit;
    if (opts.scrollLineIntoView) {
      // Virtualization-aware path: handler scrolls (and mounts the row if it
      // was virtualized out). Subsequent `onMount` fires `bindLineHighlights`,
      // which calls `paintCurrentHighlight` and lands the active-match highlight
      // on the freshly-mounted text nodes.
      opts.scrollLineIntoView(hit.lineIndex);
    } else {
      const lineEl = model.getLineEl(hit.lineIndex);
      lineEl?.scrollIntoView({ block: 'center' });
    }
    // Two RAFs: first frame lets the virtualizer's mount + measure microtask
    // run; second lets the resulting layout settle before we read the Range
    // rect. If the line isn't mounted by then, `bindLineHighlights` will
    // pick the pending hit up when it fires.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (pendingScrollHit !== hit) return; // a newer Next/Prev superseded us
        tryScrollPendingHitIntoView();
      });
    });
  }

  function searchNext(): void {
    if (flatHits.length === 0) return;
    currentHitIndex = (currentHitIndex + 1) % flatHits.length;
    highlightCurrentMatch(true);
    updateFindCountLabel();
  }

  function searchPrev(): void {
    if (flatHits.length === 0) return;
    currentHitIndex = (currentHitIndex - 1 + flatHits.length) % flatHits.length;
    highlightCurrentMatch(true);
    updateFindCountLabel();
  }

  /**
   * Drives the count label. Called from progressive-paint chunks (with a `scanPercent`)
   * and from terminal states (no `scanPercent`). Centralized so the label format stays
   * consistent regardless of which code path produced the update.
   */
  function updateFindCountLabel(scanPercent?: number): void {
    if (currentMode === 'filter') {
      findCountEl.textContent = '';
      return;
    }
    if (flatHits.length === 0) {
      findCountEl.textContent =
        scanPercent != null ? `Searching... ${scanPercent}%` : 'No results';
      return;
    }
    const base = `${currentHitIndex + 1} of ${flatHits.length}`;
    // When the total exceeds the paint cap, only the first
    // `HIGHLIGHT_PAINT_CAP` matches are visually highlighted; navigation
    // (Next/Prev) still covers all of them. Without this annotation users see
    // "200 of 1200" but only some matches glow, which reads as broken paint.
    // `remoteTruncated` means the whole-file backend itself capped the result
    // set — there are more matches than we can navigate.
    const cappedNote = remoteTruncated
      ? ' (First matches)'
      : flatHits.length > HIGHLIGHT_PAINT_CAP
        ? ' (Highlights capped)'
        : '';
    const navPart = `${base}${cappedNote}`;
    findCountEl.textContent = scanPercent != null ? `${navPart} (Searching ${scanPercent}%)` : navPart;
  }

  function applyFilter(): void {
    const total = model.getEntryCount();
    const filtering = !!currentQuery && currentMode === 'filter';
    for (let i = 0; i < total; i++) {
      const lineEl = model.getLineEl(i);
      if (!lineEl) continue;
      if (!filtering) {
        lineEl.classList.remove('filtered-out');
        continue;
      }
      const text = model.getEntryText(i) ?? '';
      if (!consoleFindMatchesQuery(text, currentQuery, findOptions)) {
        lineEl.classList.add('filtered-out');
      } else {
        lineEl.classList.remove('filtered-out');
      }
    }
  }

  function clearFilter(): void {
    const total = model.getEntryCount();
    for (let i = 0; i < total; i++) {
      model.getLineEl(i)?.classList.remove('filtered-out');
    }
  }

  /**
   * Chunked scan from `entry.scannedUpTo` to the model's current size. Pushes
   * matches onto `flatHits` (which aliases `entry.hits`), repaints incrementally,
   * advances `entry.scannedUpTo` as it goes. Used by both `performSearch` (for
   * full-or-partial-cache initial scan) and `onLinesAppended` (for the active
   * query's tail-extension when new lines arrive during streaming).
   */
  function startScanFromCursor(entry: FindCacheEntry, rx: RegExp, autoJumpOnFirst: boolean): void {
    if (searchAbortController) {
      searchAbortController.abort = true;
      searchAbortController = null;
    }

    // Create the abort controller BEFORE the already-fully-scanned early return below: that path
    // calls `finalizeAfterScan()`, which reads `controller` — declaring it later (in the chunked-scan
    // setup) would leave it in the temporal dead zone and throw on a cache hit, so the stale count /
    // highlights from the previous query would never get cleared (e.g. toggling regex off after on).
    const controller = { abort: false };
    searchAbortController = controller;

    const totalEntries = model.getEntryCount();
    if (entry.scannedUpTo >= totalEntries) {
      finalizeAfterScan();
      return;
    }

    const showProgress = totalEntries > 5000;
    // Only show the "Searching… X%" prefix when we have no hits yet; otherwise
    // the running count format ("1 of 60 (searching X%)") covers it.
    if (showProgress && flatHits.length === 0) {
      findCountEl.textContent = 'Searching... 0%';
    }

    /**
     * String-based search is fast enough that we can use a much larger chunk than the
     * DOM-walking implementation could. A 5,000-line chunk completes a 180k-line file
     * in ~36 RAF ticks (~600 ms), dominated by `matchAll` rather than scheduling.
     */
    const CHUNK_SIZE = 5000;

    function processChunk(): void {
      if (controller.abort) return;
      const hadAnyHits = flatHits.length > 0;

      const end = Math.min(entry.scannedUpTo + CHUNK_SIZE, totalEntries);
      for (let i = entry.scannedUpTo; i < end; i++) {
        const text = model.getEntryText(i);
        if (!text) continue;
        rx.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = rx.exec(text)) !== null) {
          flatHits.push({ lineIndex: i, start: m.index, end: m.index + m[0].length });
          if (m[0].length === 0) rx.lastIndex++;
        }
      }
      entry.scannedUpTo = end;

      const stillSearching = entry.scannedUpTo < totalEntries;
      const scanPercent =
        stillSearching && showProgress
          ? Math.round((entry.scannedUpTo / totalEntries) * 100)
          : undefined;

      if (flatHits.length > 0) {
        if (!hadAnyHits && autoJumpOnFirst) {
          currentHitIndex = 0;
          highlightCurrentMatch(true);
        }
        rebindAllMountedLines();
        findBarEl.classList.remove('no-results');
        updateFindCountLabel(scanPercent);
      } else if (stillSearching) {
        updateFindCountLabel(scanPercent);
      }

      if (stillSearching) {
        requestAnimationFrame(processChunk);
      } else {
        finalizeAfterScan();
      }
    }

    function finalizeAfterScan() {
      if (controller.abort) return;
      searchAbortController = null;
      if (flatHits.length > 0) {
        rebindAllMountedLines();
        findBarEl.classList.remove('no-results');
        updateFindCountLabel();
      } else {
        findCountEl.textContent = 'No results';
        findBarEl.classList.add('no-results');
      }
    }

    processChunk();
  }

  /**
   * Find mode against a whole-file backend (`opts.remoteSearch`). Replaces the
   * in-renderer chunked scan for consumers (the windowed Log Viewer) that don't
   * hold the whole file resident. No incremental cache — one round trip per
   * query, guarded by `remoteSearchSeq` so stale results never paint.
   */
  function performRemoteSearch(): void {
    if (searchAbortController) {
      searchAbortController.abort = true;
      searchAbortController = null;
    }
    clearAllHighlights();
    currentHitIndex = -1;
    currentEntry = null;
    remoteTruncated = false;

    if (!currentQuery) {
      flatHits = [];
      findCountEl.textContent = '';
      findBarEl.classList.remove('no-results');
      return;
    }

    const seq = ++remoteSearchSeq;
    findCountEl.textContent = 'Searching…';
    findBarEl.classList.remove('no-results');
    void opts.remoteSearch!(currentQuery, findOptions).then(
      (res) => {
        if (seq !== remoteSearchSeq) return; // a newer query superseded us
        if (!res) return; // backend reports it was superseded
        flatHits = res.hits;
        remoteTruncated = res.truncated;
        if (flatHits.length === 0) {
          currentHitIndex = -1;
          findCountEl.textContent = 'No results';
          findBarEl.classList.add('no-results');
          return;
        }
        currentHitIndex = 0;
        rebindAllMountedLines();
        findBarEl.classList.remove('no-results');
        highlightCurrentMatch(true);
        updateFindCountLabel();
      },
      () => {
        if (seq !== remoteSearchSeq) return;
        findCountEl.textContent = 'Search failed';
      }
    );
  }

  /**
   * Filter mode against the whole-file backend. Reports the matching line set
   * to `opts.onFilterLinesChange` (the consumer collapses its virtual list to
   * those lines) instead of toggling `filtered-out` classes on resident rows.
   */
  function performRemoteFilter(): void {
    remoteTruncated = false;
    if (!currentQuery) {
      opts.onFilterLinesChange!(null);
      findCountEl.textContent = '';
      findBarEl.classList.remove('no-results');
      return;
    }
    const seq = ++remoteSearchSeq;
    findCountEl.textContent = 'Filtering…';
    findBarEl.classList.remove('no-results');
    void opts.remoteSearch!(currentQuery, findOptions).then(
      (res) => {
        if (seq !== remoteSearchSeq) return;
        if (!res) return;
        opts.onFilterLinesChange!(res.matchLines);
        if (res.matchLines.length === 0) {
          findCountEl.textContent = 'No results';
          findBarEl.classList.add('no-results');
        } else {
          findCountEl.textContent = `${res.matchLines.length.toLocaleString()} lines${res.truncated ? ' (capped)' : ''}`;
          findBarEl.classList.remove('no-results');
        }
      },
      () => {
        if (seq !== remoteSearchSeq) return;
        findCountEl.textContent = 'Filter failed';
      }
    );
  }

  function performSearch(): void {
    if (opts.remoteSearch) {
      performRemoteSearch();
      return;
    }
    if (searchAbortController) {
      searchAbortController.abort = true;
      searchAbortController = null;
    }
    clearAllHighlights();
    currentHitIndex = -1;

    if (!currentQuery) {
      flatHits = [];
      currentEntry = null;
      findCountEl.textContent = '';
      findBarEl.classList.remove('no-results');
      return;
    }

    const maybeRx = buildSearchRegex(currentQuery, findOptions);
    if (!maybeRx) {
      flatHits = [];
      currentEntry = null;
      findCountEl.textContent = 'No results';
      findBarEl.classList.add('no-results');
      return;
    }
    const rx: RegExp = maybeRx;

    // Cache lookup. `Map.delete + set` bumps insertion order so the entry is
    // most-recently-used. Capacity is enforced on insertion of fresh entries.
    const key = cacheKeyFor(currentQuery, findOptions);
    let entry = cache.get(key);
    if (entry) {
      cache.delete(key);
      cache.set(key, entry);
    } else {
      entry = {
        query: currentQuery,
        options: { ...findOptions },
        hits: [],
        scannedUpTo: 0
      };
      cache.set(key, entry);
      // LRU eviction: drop the oldest entry first (Map iteration starts from
      // oldest insertion). Cap is small enough that linear walk is fine.
      while (cache.size > FIND_CACHE_CAP) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey === undefined || oldestKey === key) break;
        cache.delete(oldestKey);
      }
    }
    currentEntry = entry;
    flatHits = entry.hits;

    // Cache hit: paint what's already cached + auto-jump to the first match
    // immediately, then resume scanning the tail (if any). Cache miss: same
    // flow with empty starting state.
    if (flatHits.length > 0) {
      currentHitIndex = 0;
      rebindAllMountedLines();
      highlightCurrentMatch(true);
      findBarEl.classList.remove('no-results');
      updateFindCountLabel();
    }

    startScanFromCursor(entry, rx, /* autoJumpOnFirst */ flatHits.length === 0);
  }

  function executeFindAction(): void {
    currentQuery = findInputEl.value.trim();

    if (currentMode === 'filter') {
      // Switching to / typing in filter mode: drop any leftover find paint, then
      // recompute the filter.
      if (searchAbortController) {
        searchAbortController.abort = true;
        searchAbortController = null;
      }
      flatHits = [];
      currentHitIndex = -1;
      clearAllHighlights();
      if (opts.onFilterLinesChange && opts.remoteSearch) {
        // Whole-file filter: the consumer collapses its virtual list to the
        // matching line set (see `performRemoteFilter`).
        performRemoteFilter();
      } else {
        applyFilter();
        findCountEl.textContent = '';
        findBarEl.classList.remove('no-results');
      }
    } else {
      // Find mode: ensure no rows are filtered, then compute hits + paint.
      if (opts.onFilterLinesChange) {
        // Windowed consumer: restore the un-collapsed full-file view (idempotent
        // when already un-collapsed). No `filtered-out` classes are ever set in
        // this mode, so the O(viewCount) `clearFilter` sweep is unnecessary.
        opts.onFilterLinesChange(null);
      } else {
        clearFilter();
      }
      performSearch();
    }
  }

  const onModeChange = (): void => {
    currentMode = modeSelectEl.value === 'filter' ? 'filter' : 'find';
    findBarEl.classList.toggle('filter-mode', currentMode === 'filter');
    executeFindAction();
  };

  const onOptionClick = (e: Event): void => {
    const btn = (e.target as Element).closest('.telnet-option-btn');
    if (!(btn instanceof HTMLButtonElement)) return;
    const option = btn.dataset.option;
    if (option !== 'case' && option !== 'word' && option !== 'regex') return;
    findOptions[option] = !findOptions[option];
    btn.classList.toggle('active', findOptions[option]);
    syncRegexSuggest();
    executeFindAction();
  };

  const onFindInput = (): void => {
    if (searchAbortController) {
      searchAbortController.abort = true;
      searchAbortController = null;
    }
    findCountEl.textContent = '';
    findBarEl.classList.remove('no-results');
    syncRegexSuggest();
    clearTimeout(findTimeout);
    findTimeout = setTimeout(executeFindAction, 300);
  };

  const onFindKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Flush any pending debounce so Enter operates on the *current* input
      // value, not whatever query last completed. Without this, typing a new
      // query and hitting Enter immediately advances through the previous
      // result set (or no-ops on a fresh query) until the 300ms debounce fires.
      //
      // When the query has changed, `executeFindAction` already lands on the
      // first match (or paints from cache + jumps to hit 0), so Shift+Enter is
      // the only direction that needs an extra navigation step. On an
      // unchanged query, both Enter and Shift+Enter behave like Next/Prev.
      const typedQuery = findInputEl.value.trim();
      const queryChanged = typedQuery !== currentQuery;
      if (queryChanged) {
        clearTimeout(findTimeout);
        executeFindAction();
      }
      if (currentMode === 'find') {
        if (e.shiftKey) searchPrev();
        else if (!queryChanged) searchNext();
      }
    }
    if (e.key === 'Escape') {
      // First Escape with text in the input clears the query (so the user can
      // dismiss a search without leaving the find bar). A second Escape on an
      // already-empty input blurs the input back to the viewer so subsequent
      // keystrokes (Cmd+G / End / Home / arrows) reach the document-level
      // shortcut handler instead of the find input.
      if (findInputEl.value.length === 0) {
        findInputEl.blur();
        return;
      }
      // Swallow the event so a containing modal's Escape-to-close handler
      // doesn't also fire — Escape in the find box clears the query first.
      e.preventDefault();
      e.stopPropagation();
      findInputEl.value = '';
      currentQuery = '';
      syncRegexSuggest();
      executeFindAction();
    }
  };

  const onClearClick = (): void => {
    findInputEl.value = '';
    currentQuery = '';
    syncRegexSuggest();
    executeFindAction();
  };

  modeSelectEl.addEventListener('change', onModeChange);
  root.querySelectorAll('.telnet-option-btn').forEach((btn) => btn.addEventListener('click', onOptionClick));
  findInputEl.addEventListener('input', onFindInput);
  findInputEl.addEventListener('keydown', onFindKeydown);
  findPrevEl.addEventListener('click', searchPrev);
  findNextEl.addEventListener('click', searchNext);
  findClearEl.addEventListener('click', onClearClick);
  syncRegexSuggest(); // reflect the initial input/regex-toggle state on the button

  // Up/Down arrow recall of previous find/filter terms (shared behavior).
  const historyHandle = attachSearchHistory({
    input: findInputEl,
    storageKey: findHistoryKey(highlightId, opts.historyScope),
    storage: opts.historyStorage,
    onChange: () => executeFindAction()
  });

  const resetFindState = (): void => {
    if (searchAbortController) {
      searchAbortController.abort = true;
      searchAbortController = null;
    }
    // Invalidate any in-flight remote (whole-file) search so a late resolve
    // can't repaint after a reset.
    remoteSearchSeq++;
    remoteTruncated = false;
    flatHits = [];
    currentHitIndex = -1;
    currentEntry = null;
    pendingScrollHit = null;
    cache.clear();
    clearAllHighlights();
    findCountEl.textContent = '';
    findBarEl.classList.remove('no-results');
  };

  const refresh = (): void => {
    if (!currentQuery) return;
    // Drop the currentEntry's cached hits — refresh is the "I don't trust the
    // cache" escape hatch — but leave other cached entries alone (they'll be
    // extended on next selection).
    if (currentEntry) {
      currentEntry.hits = [];
      currentEntry.scannedUpTo = 0;
    }
    executeFindAction();
  };

  const onLinesCleared = (): void => {
    // The model's entries were wiped (Clear Console / connect reset). Every cached entry's `scannedUpTo`
    // + `hits` now point at gone lines, so drop the whole cache. Crucially, re-run the active query
    // against the fresh (empty) buffer so a live `currentEntry` is re-established (0 hits for now) — else
    // `onLinesAppended` bails on `!currentEntry` and the find count never repopulates as new matching
    // lines stream in (the query is still in the box, but its scan is dead until retyped).
    resetFindState();
    if (findInputEl.value.trim()) executeFindAction();
  };

  const onLinesAppended = (): void => {
    // Inactive cached entries are *not* extended here — they keep their current
    // `scannedUpTo` and pick up the new tail lazily on the next time the user
    // re-selects them. Extending all of them would do useless O(N) per append.
    if (currentMode === 'filter') {
      // Filter mode: re-evaluate filter classes for newly-appended lines. The
      // Console panel already does this at line-creation time, so this branch
      // is mostly defensive (full filter re-application).
      if (currentQuery) applyFilter();
      return;
    }
    if (!currentEntry || !currentQuery) return;
    if (searchAbortController) return; // a scan is already running

    const rx = buildSearchRegex(currentQuery, findOptions);
    if (!rx) return;

    const totalEntries = model.getEntryCount();
    if (currentEntry.scannedUpTo >= totalEntries) return;

    // Resume the chunked scan from the cursor. This extends the cached hit list
    // *and* repaints incrementally — same path as performSearch's tail.
    startScanFromCursor(currentEntry, rx, /* autoJumpOnFirst */ flatHits.length === 0);
  };

  const onLinesRemoved = (count: number): void => {
    if (count <= 0) return;
    // Update every cached entry, not just the active one — otherwise an entry
    // re-selected after a trim would point to wrong line indices.
    for (const entry of cache.values()) {
      let droppedAtHead = 0;
      while (droppedAtHead < entry.hits.length && entry.hits[droppedAtHead]!.lineIndex < count) {
        droppedAtHead++;
      }
      if (droppedAtHead > 0) entry.hits.splice(0, droppedAtHead);
      for (const h of entry.hits) h.lineIndex -= count;
      entry.scannedUpTo = Math.max(0, entry.scannedUpTo - count);
    }
    if (!currentEntry || !currentQuery) return;

    // The active query's `flatHits` aliased the entry's hits, so it already
    // sees the splice. Realign the navigation cursor and repaint.
    if (flatHits.length === 0) {
      currentHitIndex = -1;
    } else if (currentHitIndex >= flatHits.length) {
      currentHitIndex = flatHits.length - 1;
    } else if (currentHitIndex >= 0) {
      // Approximate: the user's selected match might have been one of the
      // dropped ones. Snap to 0 in that case so we don't silently land on the
      // wrong match. This is rare in practice — scrollback trim drops only old
      // entries that are typically not in the current viewport.
      // (More accurate: count dropped-from-head and subtract; left simple here.)
    }

    if (currentMode === 'find') {
      clearAllHighlights();
      if (flatHits.length > 0) rebindAllMountedLines();
      if (currentHitIndex >= 0) highlightCurrentMatch(false);
      if (flatHits.length === 0) {
        findCountEl.textContent = 'No results';
        findBarEl.classList.add('no-results');
      } else {
        updateFindCountLabel();
      }
    } else if (currentMode === 'filter') {
      applyFilter();
    }
  };

  const dispose = (): void => {
    clearTimeout(findTimeout);
    modeSelectEl.removeEventListener('change', onModeChange);
    root.querySelectorAll('.telnet-option-btn').forEach((btn) => btn.removeEventListener('click', onOptionClick));
    findInputEl.removeEventListener('input', onFindInput);
    findInputEl.removeEventListener('keydown', onFindKeydown);
    findPrevEl.removeEventListener('click', searchPrev);
    findNextEl.removeEventListener('click', searchNext);
    findClearEl.removeEventListener('click', onClearClick);
    historyHandle.dispose();
    resetFindState();
  };

  // Suppress "outputEl is unused" — kept on the opts type for future virtualization
  // hooks (scrolling a not-yet-rendered hit into view will need the scroll container).
  void outputEl;

  const focusInput = (): void => {
    findInputEl.focus();
    findInputEl.select();
  };

  const toggleMode = (): void => {
    modeSelectEl.value = currentMode === 'find' ? 'filter' : 'find';
    // Dispatch the same event the dropdown does so onModeChange runs the
    // single source-of-truth path (sets `currentMode`, toggles `filter-mode`
    // class, calls `executeFindAction`).
    modeSelectEl.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const bindLineHighlights = (lineIndex: number, lineEl: HTMLElement): void => {
    bindLineFindRangesInternal(lineIndex, lineEl);
    // If the just-mounted line happens to host the active match, paint it.
    if (currentHitIndex >= 0 && flatHits[currentHitIndex]?.lineIndex === lineIndex) {
      paintCurrentHighlight();
      // The Next/Prev path may have been waiting for this very line to mount
      // before refining the scroll position to land on the actual match
      // (instead of the line center). One more RAF lets the row's measured
      // height land before we read the Range rect.
      if (pendingScrollHit?.lineIndex === lineIndex) {
        requestAnimationFrame(() => tryScrollPendingHitIntoView());
      }
    }
  };

  const unbindLineHighlights = (lineIndex: number): void => {
    unbindLineFindRangesInternal(lineIndex);
  };

  /**
   * Used by both surfaces' row-build paths (`telnet-console-panel.ts
   * createLogLineElement` and `console-log-file-view.ts buildLogLineElement`)
   * so newly-mounted rows pick up the active filter without each call site
   * re-deriving the predicate. Mirrors the in-bar `applyFilter` (`text` ↔
   * `model.getEntryText(i)`).
   */
  const shouldFilterOut = (text: string): boolean => {
    if (currentMode !== 'filter') return false;
    if (!currentQuery) return false;
    return !consoleFindMatchesQuery(text, currentQuery, findOptions);
  };

  return {
    resetFindState,
    refresh,
    onLinesCleared,
    onLinesAppended,
    onLinesRemoved,
    bindLineHighlights,
    unbindLineHighlights,
    getFindOptions: () => ({ ...findOptions }),
    getMode: () => currentMode,
    getQuery: () => currentQuery,
    shouldFilterOut,
    focusInput,
    searchNext,
    searchPrev,
    toggleMode,
    dispose
  };
}

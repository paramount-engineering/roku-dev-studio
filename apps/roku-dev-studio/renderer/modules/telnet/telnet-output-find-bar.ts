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
 */

export type TelnetFindOptions = { case: boolean; word: boolean; regex: boolean };

const MAX_REGEX_PATTERN_LENGTH = 100;
const MAX_FIND_QUERY_LENGTH = 300;
/**
 * Cap the number of painted match ranges. The find count and prev/next navigation
 * still cover all hits — we just stop *painting* once we have this many. Mirrors
 * xterm.js's default decoration cap (1000); we go higher because our find bar is the
 * primary navigation surface and users expect "60 of 60" all visible at once.
 */
const HIGHLIGHT_PAINT_CAP = 5000;

function isLikelyRedos(pattern: string): boolean {
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) return true;
  return /\(\.\*\)\*|\(\.\+\)\+|\(\.\*\)\+|\(\.\+\)\*|\{\d+,\s*\d*\}\s*\+/.test(pattern);
}

function safeRegexEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Plain match helper for copy/save and filter (same rules as find bar). */
export function telnetFindMatchesQuery(text: string, query: string, findOptions: TelnetFindOptions): boolean {
  if (!query) return true;
  if (query.length > MAX_FIND_QUERY_LENGTH) return false;

  const flags = findOptions.case ? '' : 'i';
  const literalMatch = () =>
    findOptions.case ? text.includes(query) : text.toLowerCase().includes(query.toLowerCase());

  if (findOptions.regex) {
    if (isLikelyRedos(query)) return literalMatch();
    try {
      const regex = new RegExp(query, flags);
      return regex.test(text);
    } catch {
      return literalMatch();
    }
  }
  if (findOptions.word) {
    try {
      const escaped = safeRegexEscape(query);
      const regex = new RegExp(`\\b${escaped}\\b`, flags);
      return regex.test(text);
    } catch {
      return literalMatch();
    }
  }
  return literalMatch();
}

/**
 * Source-of-truth model for find / filter. The find bar reads from this — it never
 * reads `textContent` off the DOM. Consumers (log file viewer, live Console panel)
 * implement this against their own line buffer.
 */
export type TelnetFindModel = {
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

export type TelnetOutputFindBarHandle = {
  resetFindState: () => void;
  /** Call after the underlying model mutated in a way that doesn't fit the
   *  append/remove hooks below — re-runs the active query from scratch. Cheap
   *  when there is no active query. */
  refresh: () => void;
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
  getFindOptions: () => TelnetFindOptions;
  getMode: () => 'find' | 'filter';
  getQuery: () => string;
  /** Move focus to the find input (e.g. from a Cmd+F / Ctrl+F shortcut handler). */
  focusInput: () => void;
  /** Programmatically navigate to the next / previous match, same as the bar's own buttons. */
  searchNext: () => void;
  searchPrev: () => void;
  /** Toggle Find ⇄ Filter, mirroring the dropdown. Triggers a re-evaluation. */
  toggleMode: () => void;
  dispose: () => void;
};

export type AttachTelnetOutputFindBarOpts = {
  /** Element that contains `.telnet-find-bar`, `.telnet-find-input`, … (e.g. device panel or log viewer header). */
  root: HTMLElement | Document;
  outputEl: HTMLElement;
  model: TelnetFindModel;
  /** Unique key for this find bar's CSS Custom Highlight registry entries. Defaults
   *  to `'telnet-find'`. Override when multiple find bars share a document. */
  highlightId?: string;
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
};

type FlatHit = { lineIndex: number; start: number; end: number };

/**
 * One cache slot per `(query, options)` pair. `hits` and `scannedUpTo` together
 * describe "we have searched entries `[0, scannedUpTo)` for this query and these
 * are the matches we found". The trim hook (`onLinesRemoved`) keeps both fields
 * consistent in-place so a cached entry stays usable across scrollback churn.
 *
 * The active query's `hits` array is *aliased* (same reference) as the find bar's
 * `flatHits`, so pushing during a chunked scan transparently updates the cache.
 */
type CacheEntry = {
  query: string;
  options: TelnetFindOptions;
  hits: FlatHit[];
  scannedUpTo: number;
};

const CACHE_CAP = 8;

function cacheKeyFor(query: string, options: TelnetFindOptions): string {
  return `${options.case ? '1' : '0'}|${options.word ? '1' : '0'}|${options.regex ? '1' : '0'}|${query}`;
}

const supportsCssHighlights =
  typeof CSS !== 'undefined' &&
  typeof (CSS as unknown as { highlights?: unknown }).highlights !== 'undefined' &&
  typeof (globalThis as unknown as { Highlight?: unknown }).Highlight === 'function';

export function attachTelnetOutputFindBar(opts: AttachTelnetOutputFindBarOpts): TelnetOutputFindBarHandle | null {
  const { outputEl, model } = opts;
  const root = opts.root instanceof Document ? opts.root.documentElement : opts.root;
  const highlightId = opts.highlightId ?? 'telnet-find';
  const highlightCurrentId = `${highlightId}-current`;

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

  let currentMode: 'find' | 'filter' = modeSelectEl.value === 'filter' ? 'filter' : 'find';
  let currentQuery = '';
  /** Flat list of all matches across all entries, in document order. When a cache
   *  entry is in play (find mode with an active query), this is *aliased* to that
   *  entry's `hits` array — pushing during a chunked scan updates the cache too. */
  let flatHits: FlatHit[] = [];
  let currentHitIndex = -1;
  const findOptions: TelnetFindOptions = { case: false, word: false, regex: false };

  /**
   * LRU cache of `(query, options) → hits + scannedUpTo`. `Map`'s insertion-order
   * iteration is the LRU order; bump on access by `delete + set`, evict the
   * oldest entry when the size exceeds `CACHE_CAP`.
   *
   * Filter mode does not use the cache — its semantics (toggle visibility per
   * line, no enumeration of match ranges) make caching a different shape.
   */
  const cache: Map<string, CacheEntry> = new Map();
  /** The cache slot the current find query is reading from. `flatHits` aliases
   *  `currentEntry.hits`, so pushes go into both. `null` when there is no active
   *  query (or in filter mode). */
  let currentEntry: CacheEntry | null = null;

  let searchAbortController: { abort: boolean } | null = null;
  let findTimeout: ReturnType<typeof setTimeout> | undefined;

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
    if (!supportsCssHighlights) return;
    CSS.highlights.delete(highlightCurrentId);
    if (!allHighlight) return;
    // Drop the empty Highlight; lazy-recreate on next paint.
    CSS.highlights.delete(highlightId);
    allHighlight = null;
  }

  function buildSearchRegex(query: string): RegExp | null {
    if (!query) return null;
    if (query.length > MAX_FIND_QUERY_LENGTH) return null;
    const flags = findOptions.case ? 'g' : 'gi';
    try {
      if (findOptions.regex && !isLikelyRedos(query)) {
        return new RegExp(query, flags);
      }
    } catch {
      /* fall through to escaped */
    }
    const escaped = safeRegexEscape(query);
    try {
      return findOptions.word ? new RegExp(`\\b${escaped}\\b`, flags) : new RegExp(escaped, flags);
    } catch {
      return null;
    }
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
    allHighlight.priority = 10;
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
      if (supportsCssHighlights) CSS.highlights.delete(highlightCurrentId);
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
      CSS.highlights.delete(highlightCurrentId);
      return;
    }
    const hit = flatHits[currentHitIndex]!;
    const lineEl = model.getLineEl(hit.lineIndex);
    if (!lineEl) {
      // The current match's line isn't mounted yet (e.g. virtualization hasn't
      // scrolled to it). The caller's scroll-into-view will trigger a mount,
      // and the eventual `bindLineHighlights` will repaint via this same path.
      CSS.highlights.delete(highlightCurrentId);
      return;
    }
    const r = buildRangeForHit(hit);
    if (r) {
      const h = new Highlight(r);
      // One above the all-hits highlight so the active match is unambiguous when
      // it overlaps a non-current hit (and one above the JSON+ tint by extension).
      h.priority = 11;
      CSS.highlights.set(highlightCurrentId, h);
    } else {
      CSS.highlights.delete(highlightCurrentId);
    }
  }

  function highlightCurrentMatch(scrollIntoView: boolean): void {
    paintCurrentHighlight();
    if (currentHitIndex < 0 || currentHitIndex >= flatHits.length) return;
    if (!scrollIntoView) return;

    const hit = flatHits[currentHitIndex]!;
    if (opts.scrollLineIntoView) {
      // Virtualization-aware path: handler scrolls (and mounts the row if it
      // was virtualized out). Subsequent `onMount` fires `bindLineHighlights`,
      // which calls `paintCurrentHighlight` and lands the active-match highlight
      // on the freshly-mounted text nodes.
      opts.scrollLineIntoView(hit.lineIndex);
    } else {
      const lineEl = model.getLineEl(hit.lineIndex);
      lineEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
    findCountEl.textContent = scanPercent != null ? `${base} (searching ${scanPercent}%)` : base;
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
      if (!telnetFindMatchesQuery(text, currentQuery, findOptions)) {
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
  function startScanFromCursor(entry: CacheEntry, rx: RegExp, autoJumpOnFirst: boolean): void {
    if (searchAbortController) {
      searchAbortController.abort = true;
      searchAbortController = null;
    }

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
    const controller = { abort: false };
    searchAbortController = controller;

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

  function performSearch(): void {
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

    const maybeRx = buildSearchRegex(currentQuery);
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
      while (cache.size > CACHE_CAP) {
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
      // recompute filter classes from the model.
      if (searchAbortController) {
        searchAbortController.abort = true;
        searchAbortController = null;
      }
      flatHits = [];
      currentHitIndex = -1;
      clearAllHighlights();
      applyFilter();
      findCountEl.textContent = '';
      findBarEl.classList.remove('no-results');
    } else {
      // Find mode: ensure no rows are filtered, then compute hits + paint.
      clearFilter();
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
    executeFindAction();
  };

  const onFindInput = (): void => {
    if (searchAbortController) {
      searchAbortController.abort = true;
      searchAbortController = null;
    }
    findCountEl.textContent = '';
    findBarEl.classList.remove('no-results');
    clearTimeout(findTimeout);
    findTimeout = setTimeout(executeFindAction, 300);
  };

  const onFindKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentMode === 'find') {
        if (e.shiftKey) searchPrev();
        else searchNext();
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
      findInputEl.value = '';
      currentQuery = '';
      executeFindAction();
    }
  };

  const onClearClick = (): void => {
    findInputEl.value = '';
    currentQuery = '';
    executeFindAction();
  };

  modeSelectEl.addEventListener('change', onModeChange);
  root.querySelectorAll('.telnet-option-btn').forEach((btn) => btn.addEventListener('click', onOptionClick));
  findInputEl.addEventListener('input', onFindInput);
  findInputEl.addEventListener('keydown', onFindKeydown);
  findPrevEl.addEventListener('click', searchPrev);
  findNextEl.addEventListener('click', searchNext);
  findClearEl.addEventListener('click', onClearClick);

  const resetFindState = (): void => {
    if (searchAbortController) {
      searchAbortController.abort = true;
      searchAbortController = null;
    }
    flatHits = [];
    currentHitIndex = -1;
    currentEntry = null;
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

    const rx = buildSearchRegex(currentQuery);
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
    }
  };

  const unbindLineHighlights = (lineIndex: number): void => {
    unbindLineFindRangesInternal(lineIndex);
  };

  return {
    resetFindState,
    refresh,
    onLinesAppended,
    onLinesRemoved,
    bindLineHighlights,
    unbindLineHighlights,
    getFindOptions: () => ({ ...findOptions }),
    getMode: () => currentMode,
    getQuery: () => currentQuery,
    focusInput,
    searchNext,
    searchPrev,
    toggleMode,
    dispose
  };
}

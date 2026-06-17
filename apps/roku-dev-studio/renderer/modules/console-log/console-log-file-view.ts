/**
 * Mount a virtualized "console-style" view over a `ConsoleLogFileEntry[]`
 * model into a `.telnet-output` container. Reuses URL / JSON / XML
 * affordances from the device Console (telnet) stack — same row markup, same
 * click delegation, same JSON+ inline tint.
 *
 * Pure parse (text → entries) lives in `console-log-file-parse.ts`. Keeping
 * the two split means the parser can be used (and tested) without dragging
 * in DOM / virtualizer / modal dependencies.
 */
import { detectStructuredConsoleLine } from './structured-log-detect.js';
import {
  clearJsonPlusRangesForLine,
  paintJsonPlusRangesForLine
} from './console-json-plus-highlight.js';
import { DEFER_HEAVY_LINE_CHARS, ROW_HEIGHT_ESTIMATE_PX } from './console-render-limits.js';
import { populateConsoleLineContentWithUrls } from './console-url-detect.js';
import { createConsoleVirtualizer } from './console-virtualizer.js';
import {
  attachStructuredPillsToLine,
  clickedStructuredTargetIndex,
  closestConsoleLogLineFromEvent,
  consoleLogLineEntryIndex,
  firstHitElementOnConsoleClick,
  openConsoleStructuredViewer,
  primaryStructuredTarget
} from './console-structured-view-modal.js';
import { openConsoleUrlViewer } from './console-url-modal.js';
import type { ConsoleLogFileEntry } from './console-log-file-parse.js';

// Re-export parse symbols so existing callers (`log-file-viewer.ts`,
// `scripts/verify-structured-pills.ts`) keep working without churn after the
// parse-vs-mount split.
export {
  rawLogFileTextToEntries,
  type ConsoleLogFileEntry
} from './console-log-file-parse.js';

/**
 * Build a `.telnet-log-line` for `entries[index]`. Used as the virtualizer's
 * `createLineEl` callback — fires once per row when it scrolls into view.
 *
 * Differs from the pre-virtualization implementation in two ways:
 *   1. Heavy-line URL detection runs *synchronously* now instead of being
 *      deferred to a setTimeout. Virtualization caps the number of in-flight
 *      lines at the visible window (~40), so per-frame work is bounded — the
 *      original defer strategy was a workaround for "we just appended 180k
 *      lines, please don't detect URLs for all of them at once" which no
 *      longer applies.
 *   2. The caller (`mountConsoleLogFileView`) handles JSON+ paint and
 *      find-range bind via the virtualizer's onMount callback, *not* this
 *      function. This keeps the DOM-build step pure — no side effects on the
 *      highlight registry.
 *
 * `shouldFilterOut` is invoked at row-build time so a row that mounts while
 * the find bar is in Filter mode gets the `filtered-out` class as soon as it
 * lands in the DOM. Without this, scrolling new rows into view in Filter
 * mode shows lines that should be hidden (and find then jumps to "invisible"
 * matches). Mirrors the live Console's `createLogLineElement`
 * (`telnet-console-panel.ts`).
 */
function buildLogLineElement(
  entry: ConsoleLogFileEntry,
  index: number,
  shouldFilterOut?: (entry: ConsoleLogFileEntry, lineIndex: number) => boolean
): HTMLElement {
  const lineEl = document.createElement('div');
  lineEl.className = `telnet-log-line ${entry.type}`.trim();
  lineEl.dataset.lineIndex = String(index);

  if (entry.timestamp) {
    const timestampEl = document.createElement('span');
    timestampEl.className = 'telnet-log-timestamp';
    timestampEl.textContent = `[${entry.timestamp}]`;
    lineEl.appendChild(timestampEl);
  }

  const contentEl = document.createElement('span');
  contentEl.className = 'telnet-log-content';
  populateConsoleLineContentWithUrls(contentEl, entry.text);
  lineEl.appendChild(contentEl);

  // Heavy lines (>=6KB) had structured detection skipped during parse to keep
  // `rawLogFileTextToEntries` fast. Now that the row is actually visible, run
  // detection — bounded by the visible window size, not file size.
  if (!entry.structuredTargets?.length && entry.text.length >= DEFER_HEAVY_LINE_CHARS) {
    const d = detectStructuredConsoleLine(entry.text);
    if (d.length) entry.structuredTargets = d;
  }

  if (entry.structuredTargets?.length) {
    attachStructuredPillsToLine(lineEl, contentEl, entry.structuredTargets);
  }

  if (shouldFilterOut?.(entry, index)) {
    lineEl.classList.add('filtered-out');
  }

  return lineEl;
}

/**
 * Handle returned from `mountConsoleLogFileView`. Exposes the parsed entries
 * plus a DOM lookup so the find bar can search the model directly (and map
 * flat-string offsets back to DOM positions for CSS-Custom-Highlight
 * painting) without ever walking the rendered DOM. See
 * `console-find-bar.ts → ConsoleFindModel`.
 */
export type ConsoleLogFileViewHandle = {
  getEntryCount(): number;
  getEntryText(lineIndex: number): string | undefined;
  getLineEl(lineIndex: number): HTMLElement | null;
  forEachMountedLine(cb: (lineIndex: number, lineEl: HTMLElement) => void): void;
  /** Programmatic scroll-into-view for `entries[index]` (mounts the row if
   *  it's currently virtualized out, then scrolls). Used by the find bar to
   *  reveal the active match. */
  scrollToIndex(index: number, opts?: { align?: 'auto' | 'start' | 'center' | 'end' }): void;
  /** Total scrollable size in px summed from each entry's currently-measured
   *  (or estimated) height. Streaming consumers read this before/after
   *  `setCount` to compute the exact pixel delta a scrollback trim removed
   *  (so they can compensate `scrollTop` and keep the visible window put). */
  getTotalSize(): number;
  /** Re-evaluate layout against a new entry count. Streaming consumers call
   *  this after appending to or trimming from the underlying array. */
  setCount(n: number): void;
  /** After the consumer trimmed `headCount` entries from the head of its
   *  model, renumber every mounted row's `data-line-index` so subsequent
   *  `getLineEl(i)` lookups return the row for entry `i` post-trim. Also
   *  shifts the underlying virtualizer's size cache (otherwise off-screen
   *  rows render at stale positions, surfacing as overlapping rows during
   *  streaming past the in-memory cap). Pair with `setCount(newCount)`. */
  shiftIndicesAfterTrim(headCount: number): void;
  /** Inverse of `shiftIndicesAfterTrim`. Use after prepending `headCount`
   *  entries to the front of the model (e.g. spill auto-load). Pair with
   *  `setCount(newCount)`. */
  shiftIndicesAfterPrepend(headCount: number): void;
  /** The virtualizer's spacer container element (sibling of any
   *  consumer-managed placeholder element inside `outputEl`). Streaming
   *  consumers use this to insert/remove a placeholder *before* the
   *  container without resorting to querySelector — keeps the placeholder
   *  + container sibling order identical to the cold-start markup. */
  getContainerEl(): HTMLElement;
  /** Tear down the underlying virtualizer (detach scroll/resize observers
   *  and remove all mounted rows). The caller still owns `outputEl`. */
  dispose(): void;
};

export type MountConsoleLogFileViewOpts = {
  /** Fires after a row is created and inserted into the DOM. The find bar
   *  wires this to `bindLineHighlights` so search hits paint as soon as the
   *  line scrolls into view. */
  onLineMount?: (lineIndex: number, lineEl: HTMLElement) => void;
  /** Fires before a row is removed from the DOM (scrolled out of the visible
   *  window). The find bar wires this to `unbindLineHighlights` so detached
   *  text nodes don't linger in the highlight registry. */
  onLineUnmount?: (lineIndex: number, lineEl: HTMLElement) => void;
  /** Returns true if this entry should be hidden (`.filtered-out`) at mount
   *  time. Wired to the find bar's filter state so rows that scroll into
   *  view while a Filter query is active are hidden immediately, matching
   *  the live Console (which checks this in `createLogLineElement`). */
  shouldFilterOut?: (entry: ConsoleLogFileEntry, lineIndex: number) => boolean;
  /**
   * Custom row builder. Replaces the default `buildLogLineElement` that
   * synchronously detects URLs + structured payloads. The live Console
   * passes its own builder that defers URL detection on heavy (>=6 KB)
   * streaming lines so per-flush DOM cost stays bounded — the default
   * builder's sync detection is fine for the file viewer (rows mount
   * lazily in batches of ~40) but pile-up risk for the panel's bursty
   * 350-line flushes.
   */
  buildLineEl?: (entry: ConsoleLogFileEntry, index: number) => HTMLElement;
  /**
   * Skip the `outputEl.textContent = ''` step at mount. The live Console
   * renders a "Connect to Roku…" placeholder element into `outputEl` before
   * any data arrives and removes it on the first flush; clearing the
   * container at mount time would wipe that placeholder.
   *
   * Static consumers (file viewer) leave this `false`/undefined; the mount
   * always starts from a clean container.
   */
  preservePlaceholder?: boolean;
};

/**
 * Mount a virtualized log-file view. Only the visible window of `entries` is
 * in the DOM at any one time — typically ~40 rows regardless of
 * `entries.length`.
 *
 * onLineMount / onLineUnmount fire whenever the visible window shifts
 * (scroll, resize). Consumers wire these to the find bar's
 * `bindLineHighlights` / `unbindLineHighlights` so search highlights track
 * the visible rows.
 */
export function mountConsoleLogFileView(
  outputEl: HTMLElement,
  entries: ConsoleLogFileEntry[],
  opts: MountConsoleLogFileViewOpts = {}
): ConsoleLogFileViewHandle {
  // Idempotency guard: callers may re-mount on hot-reload. Tear down any
  // prior virtualizer (its rows were children of `outputEl`) before
  // building afresh — unless the caller is managing a placeholder that
  // should survive (live Console).
  if (!opts.preservePlaceholder) {
    if (outputEl.dataset.logViewerBound === '1') {
      outputEl.textContent = '';
    }
    outputEl.textContent = '';
  }
  outputEl.dataset.logViewerBound = '1';

  const logLines = entries;

  // The virtualizer wants a tall spacer container *inside* the scroll
  // element whose height equals the total scrollable size. Rows are
  // absolutely positioned children of that container.
  const containerEl = document.createElement('div');
  containerEl.className = 'telnet-log-virtual-container';
  outputEl.appendChild(containerEl);

  const buildLine =
    opts.buildLineEl ?? ((entry, index) => buildLogLineElement(entry, index, opts.shouldFilterOut));

  const virtualizer = createConsoleVirtualizer({
    scrollEl: outputEl,
    containerEl,
    getCount: () => logLines.length,
    estimateSize: ROW_HEIGHT_ESTIMATE_PX,
    overscan: 8,
    createLineEl: (index) => buildLine(logLines[index]!, index),
    onMount: (index, lineEl) => {
      // JSON+ inline tint: bind ranges *after* the line is in the DOM so the
      // text-node walker sees the URL spans / structured pill markup.
      const entry = logLines[index];
      if (entry?.structuredTargets?.length) {
        const contentEl = lineEl.querySelector('.telnet-log-content');
        if (contentEl instanceof HTMLElement) {
          paintJsonPlusRangesForLine(lineEl, contentEl, entry.structuredTargets);
        }
      }
      opts.onLineMount?.(index, lineEl);
    },
    onUnmount: (index, lineEl) => {
      // Drop the line's range bindings from the global Highlight registries
      // before the DOM is detached. Without this, the registry would
      // accumulate ranges pointing to garbage-collected text nodes.
      clearJsonPlusRangesForLine(lineEl);
      opts.onLineUnmount?.(index, lineEl);
    }
  });

  // Click delegation lives on `outputEl` (the persistent scroll container),
  // so it survives row mounts/unmounts. Same logic as before — URL spans
  // first, then structured payloads via the click-resolves-to-deepest-target
  // helper.
  outputEl.addEventListener(
    'click',
    (e) => {
      const anchor = firstHitElementOnConsoleClick(e);
      if (!anchor) return;

      const urlHit = anchor.closest('.telnet-log-url');
      if (urlHit instanceof HTMLElement && urlHit.dataset.url) {
        e.preventDefault();
        e.stopPropagation();
        const href = urlHit.dataset.url;
        if (e.metaKey || e.ctrlKey) {
          if (href.startsWith('http://') || href.startsWith('https://')) {
            void window.roku.openExternal(href);
          }
        } else {
          openConsoleUrlViewer(urlHit, href);
        }
        return;
      }

      const pillHit = anchor.closest('.telnet-structured-view-pill');
      if (pillHit instanceof HTMLElement) {
        const line = pillHit.closest('.telnet-log-line');
        if (!(line instanceof HTMLElement)) return;
        const idx = consoleLogLineEntryIndex(line);
        const entry = idx >= 0 ? logLines[idx] : undefined;
        if (!entry?.structuredTargets?.length) return;
        e.preventDefault();
        e.stopPropagation();
        // A pill carries its own target index; fall back to the primary target
        // when the index is missing/out of range (so a second non-nested badge
        // — e.g. two XML fragments — opens its own payload, not the first).
        const targetIdx = parseInt(pillHit.dataset.structuredIndex || '', 10);
        const payload =
          (Number.isInteger(targetIdx) ? entry.structuredTargets[targetIdx] : undefined) ??
          primaryStructuredTarget(entry.structuredTargets);
        if (!payload) return;
        openConsoleStructuredViewer(line, payload);
        return;
      }

      const contentEl = anchor.closest('.telnet-log-content');
      if (!(contentEl instanceof HTMLElement)) return;
      const line = closestConsoleLogLineFromEvent(e);
      if (!line) return;
      const idx = consoleLogLineEntryIndex(line);
      const entry = idx >= 0 ? logLines[idx] : undefined;
      if (!entry?.structuredTargets?.length) return;
      e.preventDefault();
      // Resolve to the deepest nested JSON+ literal the click landed inside, so
      // clicking within a tinted nested region opens that payload rather than
      // always opening the outer object.
      const targetIdx = clickedStructuredTargetIndex(contentEl, e, entry.structuredTargets);
      const payload = entry.structuredTargets[targetIdx] ?? primaryStructuredTarget(entry.structuredTargets);
      if (!payload) return;
      openConsoleStructuredViewer(line, payload);
    },
    { passive: false }
  );

  return {
    getEntryCount: () => logLines.length,
    getEntryText: (i) => logLines[i]?.text,
    getLineEl: (i) => virtualizer.getLineEl(i),
    forEachMountedLine: (cb) => virtualizer.forEachMounted(cb),
    scrollToIndex: (i, scrollOpts) => virtualizer.scrollToIndex(i, scrollOpts),
    getTotalSize: () => virtualizer.getTotalSize(),
    setCount: (n) => virtualizer.setCount(n),
    shiftIndicesAfterTrim: (headCount) => virtualizer.shiftIndicesAfterTrim(headCount),
    shiftIndicesAfterPrepend: (headCount) => virtualizer.shiftIndicesAfterPrepend(headCount),
    getContainerEl: () => containerEl,
    dispose: () => virtualizer.dispose()
  };
}

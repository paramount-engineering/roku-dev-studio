/**
 * Single-call wiring for the "console-style log surface" — virtualizer + find
 * bar + viewer shortcuts + Copy/Save model-text path — over an entries model.
 *
 * Used by both the Log Viewer (static entries from a file) and the live
 * Console panel (`telnet-console-panel.ts`, streaming entries from telnet).
 *
 * **Scope intentionally bounded:** the surface owns the rendering / search /
 * shortcut wiring. It does not own:
 *
 *   - Connection lifecycle (Console panel's Connect/Disconnect, IPC subs)
 *   - Streaming ingest queue + flush pacing (`addLogLinesBatch` and
 *     `pendingTelnetLines` in the panel — Console-only)
 *   - Auto-scroll stick-to-bottom logic (Console-only)
 *   - Scrollback trim (Console-only; Log Viewer has a static, file-bounded
 *     entries array)
 *   - File loading (Log Viewer-only)
 *   - Header chrome buttons (different per surface)
 *
 * For streaming consumers, mutating the entries array directly *and* calling
 * `surface.notifyAppended()` / `surface.notifyTrimmed(count)` afterwards is
 * the operational contract — the surface routes the notification to both
 * the virtualizer (`setCount` / `shiftIndicesAfterTrim`) and the find bar
 * (`onLinesAppended` / `onLinesRemoved`) so future per-step concerns land in
 * one place instead of two.
 */

import { mountConsoleLogFileView, type ConsoleLogFileEntry, type ConsoleLogFileViewHandle, type MountConsoleLogFileViewOpts } from './console-log-file-view.js';
import { attachConsoleFindBar, type ConsoleFindBarHandle, type AttachConsoleFindBarOpts } from './console-find-bar.js';
import { attachViewerShortcuts } from './console-viewer-shortcuts.js';
import { buildVisibleLogText } from './console-visible-log-text.js';

export type MountConsoleLogSurfaceOpts = {
  /** The `.telnet-output` scroll container the virtualizer mounts into. */
  outputEl: HTMLElement;
  /** Entries to render. The same array reference is observed by the find bar
   *  for filter/search; mutating it (append/trim) is allowed but consumers
   *  must call `notifyAppended` / `notifyTrimmed` on the surface handle
   *  afterwards so the virtualizer + find bar relayout. */
  entries: ConsoleLogFileEntry[];
  /** Element containing the find bar markup (`.telnet-find-bar`,
   *  `.telnet-find-input`, …). Pass `null` to skip find/filter wiring. */
  findBarHost: HTMLElement | null;
  /** Optional scope element for the keyboard shortcuts. Defaults to
   *  `outputEl`. Use the Console panel's root so shortcuts only fire when
   *  the panel is the visible one. */
  shortcutScopeEl?: HTMLElement;
  /** Scope suffix for the find bar's search-history key (e.g. device IP). */
  historyScope?: string;
  /** Backing store for search history (default localStorage; sessionStorage = per-window). */
  historyStorage?: Storage;
  /**
   * Callback invoked by Cmd/Ctrl+A. The default is "copy the visible log
   * text to clipboard" via `buildVisibleLogText` + `window.roku.copyToClipboard`,
   * with no user feedback. Override when you have a status surface for
   * "Copied!" feedback (the Log Viewer's `flashStatus`).
   */
  onSelectAll?: () => void;
  /** Forwarded to the underlying view's `onLineMount`. The surface already
   *  binds find-bar highlights — this is for *additional* per-mount work. */
  onLineMount?: MountConsoleLogFileViewOpts['onLineMount'];
  /** Forwarded to the underlying view's `onLineUnmount`. */
  onLineUnmount?: MountConsoleLogFileViewOpts['onLineUnmount'];
  /** Forwarded to the view: custom row builder. Defaults to the file viewer's
   *  sync URL/structured detection at row-build time. The Console panel
   *  passes its own builder that defers heavy-line URL detection. */
  buildLineEl?: MountConsoleLogFileViewOpts['buildLineEl'];
  /** Forwarded to the view: skip the outputEl clear at mount. The Console
   *  panel uses this to preserve a "Connect to Roku…" placeholder element
   *  that's removed on the first batch. */
  preservePlaceholder?: boolean;
  /**
   * Override for the find bar's "scroll a match into view" path. Defaults to
   * `view.scrollToIndex(idx, { align: 'center' })`.
   *
   * The live Console passes its own implementation so a find navigation also
   * *unpins* auto-scroll: otherwise the stick-to-bottom tail-follow keeps
   * yanking the view back to the newest line while the find bar pulls it to
   * the match — two scroll controllers fighting, visible as flicker. The
   * static Log Viewer has no tail-follow, so it uses the default.
   */
  scrollLineIntoView?: (index: number) => void;
  /** Forwarded to the view/virtualizer: fires with the current visible index
   *  range after each layout pass. The windowed Log Viewer wires this to slide
   *  its resident byte-window. */
  onRangeChange?: (start: number, end: number) => void;
  /** Forwarded to the find bar. When present, Find mode delegates to this
   *  (whole-file search in main) instead of scanning the in-memory model — the
   *  windowed Log Viewer only holds a slice of the file resident. */
  remoteSearch?: AttachConsoleFindBarOpts['remoteSearch'];
  /** Forwarded to the find bar. When present, Filter mode reports its matching
   *  line-number set here (instead of toggling `filtered-out` on model rows) so
   *  the windowed viewer can collapse the virtual list to matching lines. */
  onFilterLinesChange?: AttachConsoleFindBarOpts['onFilterLinesChange'];
};

export type ConsoleLogSurfaceHandle = {
  view: ConsoleLogFileViewHandle;
  findBar: ConsoleFindBarHandle | null;
  /** Visible (filter-respecting) text for Copy / Save / Cmd+A. */
  getVisibleText(): string;
  /**
   * Streaming consumers call this after appending entries to the underlying
   * array. Routes through `view.setCount` (so the virtualizer relayouts
   * the bottom-edge window) and `findBar.onLinesAppended` (so the active
   * query incrementally scans the new tail). No-op for static models.
   */
  notifyAppended(): void;
  /**
   * Streaming consumers call this after trimming `count` entries from the
   * head of the underlying array (scrollback cap). Routes through
   * `view.shiftIndicesAfterTrim(count)` + `view.setCount(newLength)` and
   * `findBar.onLinesRemoved(count)`. Returns the pixel delta the trim
   * removed (computed from the virtualizer's measured sizes before/after)
   * so the caller can compensate `outputEl.scrollTop` and keep the user's
   * visible window put.
   */
  notifyTrimmed(count: number): number;
  /**
   * Inverse of `notifyTrimmed`. Consumers call this after prepending
   * `count` entries to the *front* of the underlying array (e.g. lazy-load
   * of a disk spill into the in-memory model). Routes through
   * `view.setCount(newLength)` and `findBar.refresh()`. Returns the pixel
   * delta the prepend added so the caller can compensate `outputEl.scrollTop`
   * (otherwise the user would suddenly see content from `count` rows further
   * up — disorienting after an explicit "load older lines" gesture, which
   * expects the view to stay anchored on what was previously visible).
   */
  notifyPrepended(count: number): number;
  /** Rebuild the visible window via the row builder — see
   *  `ConsoleLogFileViewHandle.remountVisible`. The windowed Log Viewer calls
   *  this after a byte-window load lands. */
  remountVisible(): void;
  /** Set the total (view) entry count. The windowed viewer calls this directly
   *  when Filter mode reshapes the virtual list to matching lines only. */
  setCount(n: number): void;
  /** Detach the find bar + shortcut listeners and dispose the underlying
   *  virtualizer. The caller still owns `outputEl`. */
  dispose(): void;
};

/**
 * Mount the shared console-log surface stack onto `outputEl`.
 *
 * Wires (in order):
 *   1. The virtualizer (`mountConsoleLogFileView`), with onMount/onUnmount
 *      forwarding to find-bar highlight bind/unbind and the optional
 *      consumer hooks.
 *   2. The find/filter bar (`attachConsoleFindBar`), with `scrollLineIntoView`
 *      threaded to the virtualizer's mount-then-scroll path.
 *   3. Viewer shortcuts (`attachViewerShortcuts`), with Cmd/Ctrl+A wired
 *      to the consumer's `onSelectAll` (or a default model-text copy).
 *
 * Filter-on-mount uses the find bar's own `shouldFilterOut(text)` predicate
 * so newly-mounted rows pick up the active filter without the consumer
 * re-deriving the predicate.
 */
export function mountConsoleLogSurface(opts: MountConsoleLogSurfaceOpts): ConsoleLogSurfaceHandle {
  const { outputEl, entries, findBarHost, shortcutScopeEl } = opts;

  // Late-bound find-bar handle: the virtualizer's onMount/onUnmount may fire
  // *before* the find bar is constructed (e.g. when the initial visible
  // window mounts during the same tick). The closure-captured ref lets the
  // initial mounts no-op safely (handle is null), then later mounts /
  // unmounts wire through to the find bar's per-line range binders for
  // search highlights.
  let findBarHandle: ConsoleFindBarHandle | null = null;

  const view = mountConsoleLogFileView(outputEl, entries, {
    onLineMount: (idx, el) => {
      findBarHandle?.bindLineHighlights(idx, el);
      opts.onLineMount?.(idx, el);
    },
    onLineUnmount: (idx, el) => {
      findBarHandle?.unbindLineHighlights(idx);
      opts.onLineUnmount?.(idx, el);
    },
    shouldFilterOut: (entry) => findBarHandle?.shouldFilterOut(entry.text) ?? false,
    buildLineEl: opts.buildLineEl,
    preservePlaceholder: opts.preservePlaceholder,
    onRangeChange: opts.onRangeChange
  });

  if (findBarHost) {
    findBarHandle = attachConsoleFindBar({
      root: findBarHost,
      outputEl,
      model: view,
      historyScope: opts.historyScope,
      historyStorage: opts.historyStorage,
      remoteSearch: opts.remoteSearch,
      onFilterLinesChange: opts.onFilterLinesChange,
      // Find's "scroll into view on next/prev" must use the virtualizer's
      // scroll-to-index path (it mounts the row first, then scrolls) instead
      // of the DOM `scrollIntoView` which assumes the row is already in DOM.
      // Consumers can override (live Console unpins auto-scroll here so the
      // tail-follow doesn't fight the find navigation — see opts doc).
      scrollLineIntoView:
        opts.scrollLineIntoView ?? ((idx) => view.scrollToIndex(idx, { align: 'center' }))
    });
  }

  const shortcutHandle = attachViewerShortcuts({
    findBar: findBarHandle,
    outputEl,
    scopeEl: shortcutScopeEl,
    findInputEl: findBarHost?.querySelector<HTMLInputElement>('.telnet-find-input') ?? null,
    selectAllAction: opts.onSelectAll
      ? opts.onSelectAll
      : () => {
          const text = buildVisibleLogText(entries, findBarHandle);
          if (!text) return;
          // Best-effort default: no status feedback. Consumers that need a
          // "Copied!" indicator should pass `onSelectAll` and call
          // `getVisibleText()` themselves.
          void window.roku.copyToClipboard(text);
        }
  });

  return {
    view,
    findBar: findBarHandle,
    getVisibleText: () => buildVisibleLogText(entries, findBarHandle),
    notifyAppended() {
      view.setCount(entries.length);
      findBarHandle?.onLinesAppended();
    },
    notifyTrimmed(count: number): number {
      if (count <= 0) return 0;
      // Read total size *before* the shift so we can compute the exact
      // pixel delta the trim removed. Multiplying by `estimateSize` would
      // be wrong for measured rows (especially long wrapped lines).
      const beforeTotal = view.getTotalSize();
      view.shiftIndicesAfterTrim(count);
      view.setCount(entries.length);
      const afterTotal = view.getTotalSize();
      findBarHandle?.onLinesRemoved(count);
      return Math.max(0, beforeTotal - afterTotal);
    },
    notifyPrepended(count: number): number {
      if (count <= 0) return 0;
      // Symmetric inverse of `notifyTrimmed`. The consumer has already
      // prepended `count` entries to the *front* of the entries array;
      // here we tell the virtualizer + find bar so the unified view stays
      // consistent. Returns the pixel delta added so the caller can
      // compensate `outputEl.scrollTop` (otherwise the user would suddenly
      // see content from `count` rows further up — disorienting after an
      // explicit "load older lines" gesture, which expects the view to
      // stay anchored on what was previously visible).
      const beforeTotal = view.getTotalSize();
      // Shift mounted-row data-indices + the virtualizer's internal
      // size cache up by `count`. Without the cache shift, every existing
      // mounted row's `item.start` would compute against stale-keyed
      // sizes and render at the wrong position (same root cause as the
      // streaming-overlap bug at the trim boundary).
      view.shiftIndicesAfterPrepend(count);
      view.setCount(entries.length);
      const afterTotal = view.getTotalSize();
      // Find bar: any cached hit cursor that referred to entry `i` in the
      // old indexing now points to entry `i + count`. The find bar's
      // existing `refresh()` re-runs the active query from scratch —
      // wasteful for a 50K-entry buffer if the user has a query active,
      // but the user-triggered "load older lines" is rare enough to absorb
      // the cost, and getting the cache shifted forward correctly requires
      // a new find-bar API surface that's not worth the complexity for
      // this single use case.
      findBarHandle?.refresh();
      return Math.max(0, afterTotal - beforeTotal);
    },
    remountVisible() {
      view.remountVisible();
    },
    setCount(n: number) {
      view.setCount(n);
    },
    dispose() {
      shortcutHandle.dispose();
      findBarHandle?.dispose();
      view.dispose();
    }
  };
}

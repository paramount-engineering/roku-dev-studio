/**
 * Vanilla-DOM wrapper around `@tanstack/virtual-core`'s headless `Virtualizer`
 * for the telnet log viewers (file viewer + live Console).
 *
 * Why headless: the package does *only* the layout math (which rows are visible
 * for the current scrollTop, what's the total scroll height, how to scroll-to-
 * index). DOM mounting/unmounting is left to the caller. We do that here with
 * an absolute-positioned `translateY(item.start)` per row inside a single tall
 * spacer container that lives inside the scroll element.
 *
 * Lifecycle:
 *   - `mount`: caller creates `.telnet-log-line` for an index. The wrapper
 *     positions it and fires `onMount(idx, el, contentEl)` so consumers (find
 *     bar, JSON+ highlight painter) can bind their per-line state.
 *   - `unmount`: wrapper detaches the element and fires `onUnmount(idx, el)`
 *     so consumers can clear their per-line state. The element is then removed
 *     from the DOM and dropped from the wrapper's mounted set.
 *
 * Variable row height: we run with a fixed `estimateSize` for now and rely on
 * the virtualizer's `measureElement` hook to read each mounted row's actual
 * height post-layout, so layout converges within a frame even when lines wrap.
 *
 * Append / trim: callers tell us via `setCount(n)`. The virtualizer recomputes
 * its layout and we re-sync mounted rows to the new visible range. Trim
 * shifts every entry's index down by N — for that case, see
 * `shiftIndicesAfterTrim(headCount)` which renumbers mounted rows in place.
 */

import {
  Virtualizer,
  observeElementOffset,
  observeElementRect,
  elementScroll,
  measureElement as defaultMeasureElement
} from '../../vendor/tanstack-virtual-core.mjs';

/** Keep `data-line-index` (click/find) and `data-index` (virtualizer measure) in sync. */
function setRowDatasetIndex(el: HTMLElement, index: number): void {
  const s = String(index);
  el.dataset.lineIndex = s;
  el.dataset.index = s;
}

export type ConsoleVirtualizerOpts = {
  /** The `overflow-y: auto` scroll element. */
  scrollEl: HTMLElement;
  /** Inner spacer (sits inside `scrollEl`). The wrapper sets its `height` to
   *  the virtualizer's total size and appends rows to it as absolute children. */
  containerEl: HTMLElement;
  /** Total entries. Wrapper polls this lazily; call `setCount(n)` after appending
   *  or trimming so the virtualizer is told. */
  getCount: () => number;
  /** Estimated (initial) row height in pixels. Real heights are read via
   *  `measureElement` once the row is in the DOM. */
  estimateSize: number;
  /** How many rows to render outside the viewport on each side. */
  overscan?: number;
  /** Build a brand-new `.telnet-log-line` for `index`. The wrapper applies
   *  `position: absolute; transform: translateY(...)`. */
  createLineEl: (index: number) => HTMLElement;
  onMount?: (index: number, lineEl: HTMLElement) => void;
  onUnmount?: (index: number, lineEl: HTMLElement) => void;
};

export type ConsoleVirtualizerHandle = {
  scrollToIndex: (index: number, opts?: { align?: 'auto' | 'start' | 'center' | 'end' }) => void;
  scrollToOffset: (offset: number) => void;
  getLineEl: (index: number) => HTMLElement | null;
  /** Iterate all currently-mounted (index, element) pairs. */
  forEachMounted: (cb: (index: number, lineEl: HTMLElement) => void) => void;
  /** Total scrollable size in px, summed from each entry's currently-measured
   *  (or estimated) height. Read this *before* a `setCount` / trim and again
   *  *after* to compute the exact pixel delta a trim removed — needed when the
   *  caller has to compensate `scrollTop` so the user's visible window stays
   *  put. Multiplying by `estimateSize` is wrong for measured rows, especially
   *  long wrapped lines. */
  getTotalSize: () => number;
  setCount: (n: number) => void;
  /**
   * After the consumer trimmed `headCount` entries from the head of its
   * model, renumber every mounted row's `data-line-index` (and our internal
   * map) so `getLineEl(i)` keeps returning the row for entry `i` post-trim.
   * Also shifts the underlying virtualizer's internal `itemSizeCache` so
   * off-screen rows keep their measured sizes — without this, `item.start`
   * for non-visible rows compute wrong, surfacing as overlapping rows
   * during streaming past the scrollback cap. Call `setCount(newCount)`
   * after to let the virtualizer relayout.
   */
  shiftIndicesAfterTrim: (headCount: number) => void;
  /**
   * Inverse of `shiftIndicesAfterTrim`. After the consumer prepended
   * `headCount` entries to the *front* of its model (e.g. lazy-load of a
   * disk spill into the in-memory model), renumber every mounted row's
   * `data-line-index` *up* by `headCount` and shift the size cache the
   * same direction. The newly-prepended entries (now at indices 0 ..
   * headCount-1) have no cached size yet and use `estimateSize` until
   * they mount and self-measure. Call `setCount(newCount)` after.
   */
  shiftIndicesAfterPrepend: (headCount: number) => void;
  /** Force a relayout pass (e.g. when row content changed shape). */
  measure: () => void;
  dispose: () => void;
};

export function createConsoleVirtualizer(opts: ConsoleVirtualizerOpts): ConsoleVirtualizerHandle {
  const overscan = opts.overscan ?? 8;

  // Mounted rows by entry index. Single source of truth for both `getLineEl`
  // and the unmount diff in `sync()` below.
  const mounted = new Map<number, HTMLElement>();

  /**
   * Newly-mounted rows queued for measurement. Two reasons for the defer:
   *
   *   1. Measuring a fresh row inside `sync()` immediately triggers
   *      `resizeItem → notify → onChange → sync` recursively. The outer
   *      sync's `for` loop is iterating a `getVirtualItems()` snapshot taken
   *      *before* the resize, so its later iterations would overwrite the
   *      inner sync's correct transforms with stale `item.start` values —
   *      visible to the user as rows overlapping during scroll. Measuring in
   *      a post-loop microtask avoids that race.
   *
   *   2. We force-measure each row by calling `virt.resizeItem(index, h)`
   *      *directly* with `el.offsetHeight`. `virt.measureElement(node)`
   *      registers the ResizeObserver, but its internal call to `resizeItem`
   *      is gated by `(!isScrolling || scrollState) && shouldMeasureDuringScroll(idx)`,
   *      so during user scroll the cache can stay at the initial estimate
   *      forever — even though `offsetHeight` would read the true size. The
   *      symptom was that the 18px estimate (smaller than the actual ~21px
   *      single-line height: `font-size 12 × line-height 1.6 + 2px padding`)
   *      compounded into multi-row visual overlap, especially around long
   *      wrapping payloads where the estimate is dramatically wrong.
   *      Calling `resizeItem` ourselves bypasses the gate and lands the
   *      real measurement deterministically. Repeated calls with the same
   *      size are cheap — `resizeItem` early-returns on `delta === 0`.
   */
  const pendingMeasure: Array<{ index: number; el: HTMLElement }> = [];
  let measureScheduled = false;
  function scheduleMeasurePass(): void {
    if (measureScheduled) return;
    measureScheduled = true;
    queueMicrotask(() => {
      measureScheduled = false;
      while (pendingMeasure.length > 0) {
        const job = pendingMeasure.shift()!;
        const { index, el } = job;
        if (!el.isConnected) continue;
        // 1. Register with the ResizeObserver so future height changes (e.g.,
        //    deferred-heavy-line drain replacing contentEl, font load) propagate
        //    through upstream's path. Its internal `resizeItem` may be skipped
        //    by the scroll gate — that's fine, step 2 handles it.
        virt.measureElement(el);
        // 2. Force-land the current rendered height in the size cache. `offsetHeight`
        //    forces sync layout, so we get the true wrapped height for this row.
        const h = el.offsetHeight;
        if (h > 0) virt.resizeItem(index, h);
      }
    });
  }

  // The virtualizer itself doesn't mutate DOM — `onChange` fires whenever its
  // state recomputes (scroll, resize, count change) and we re-sync from
  // `getVirtualItems()`. Sync is idempotent: only mounts new indices and
  // unmounts ones that fell out of range.
  const virt: Virtualizer<HTMLElement, HTMLElement> = new Virtualizer<HTMLElement, HTMLElement>({
    count: opts.getCount(),
    getScrollElement: () => opts.scrollEl,
    estimateSize: () => opts.estimateSize,
    overscan,
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    measureElement: defaultMeasureElement,
    onChange: () => sync()
  });

  // The container holds the spacer height + absolutely-positioned rows. We set
  // `position: relative` here so each row's `position: absolute` resolves to
  // the container, not the document.
  opts.containerEl.style.position = 'relative';
  opts.containerEl.style.width = '100%';

  function sync(): void {
    opts.containerEl.style.height = `${virt.getTotalSize()}px`;

    const items = virt.getVirtualItems();
    const desired = new Set<number>();
    // Track the previously-processed row so we can insert each new row
    // immediately after it, keeping `containerEl.children` ordered by entry
    // index. This matters for native text selection: the browser builds a
    // Range from anchor → focus in DOM order, not visual order. If new rows
    // were just `appendChild`ed (e.g. after scrolling backward), DOM order
    // would drift from visual order and a click-drag across two visually-
    // adjacent rows could end up selecting hundreds of intervening nodes in
    // DOM order. Index-ordered children keep selection ranges aligned with
    // what the user sees on screen.
    let prevEl: HTMLElement | null = null;
    for (const item of items) {
      desired.add(item.index);
      let el = mounted.get(item.index);
      if (!el) {
        el = opts.createLineEl(item.index);
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.right = '0';
        el.style.top = '0';
        // Position with `transform: translateY(...)`, NOT `top: ${px}`.
        //
        // Why this matters during streaming: the measure-then-resync cycle
        // fires sync() multiple times per batch (initial mount with
        // estimate-based item.start → measurement microtask → resizeItem →
        // re-sync with corrected item.start). With `top`, each sync's
        // assignment triggers a real layout pass and the user briefly
        // sees rows positioned at the *stale* (estimate-based) coords —
        // visible as rows overlapping each other during heavy streaming.
        // With `transform`, the position changes get composited and only
        // the final value paints per frame, so the intermediate states
        // are invisible.
        //
        // We tried `top: ${item.start}px` once on the theory that
        // `transform` breaks `position: sticky` on descendants (because
        // a transformed ancestor establishes a containing block for
        // sticky elements). That theory was speculative — never confirmed
        // broken in our Chromium for `.telnet-structured-view-pills` —
        // and the streaming-overlap regression it caused was immediate
        // and obvious. If sticky pills DO turn out to be broken on long
        // wrapped lines in some Chromium build, the right fix is to
        // restructure the pill DOM (e.g. promote it out of the line
        // element and into the scroll container), not to revert this.
        el.style.transform = `translateY(${item.start}px)`;
        // `data-index` lets the default `measureElement` correlate the
        // ResizeObserver entry back to a virtualizer index; `data-line-index`
        // is what click/find handlers read — keep both in sync.
        setRowDatasetIndex(el, item.index);
        if (prevEl) {
          prevEl.after(el);
        } else {
          opts.containerEl.prepend(el);
        }
        mounted.set(item.index, el);
        opts.onMount?.(item.index, el);
        // Defer measurement to a microtask — see `pendingMeasure` doc above.
        pendingMeasure.push({ index: item.index, el });
      } else {
        el.style.transform = `translateY(${item.start}px)`;
      }
      prevEl = el;
    }

    // Unmount: anything in `mounted` that's no longer in `desired`.
    for (const [idx, el] of mounted) {
      if (!desired.has(idx)) {
        opts.onUnmount?.(idx, el);
        el.remove();
        mounted.delete(idx);
      }
    }

    if (pendingMeasure.length > 0) scheduleMeasurePass();
  }

  // `_didMount` only registers a cleanup hook in `@tanstack/virtual-core` —
  // the actual scroll-/resize-observer installation and initial layout pass
  // happens in `_willUpdate`, which the framework adapters (React, etc.) call
  // from a layout effect. For our vanilla integration we have to drive it
  // ourselves: `_willUpdate` here so observers attach + initial range gets
  // computed, then `sync()` to mount the first batch of rows. Without this,
  // the virtualizer never sees its scroll element's dimensions, `getVirtualItems`
  // returns empty, and the viewer paints blank.
  const detach = virt._didMount();
  virt._willUpdate();
  sync();

  return {
    scrollToIndex(index, scrollOpts) {
      virt.scrollToIndex(index, scrollOpts ?? { align: 'center' });
    },
    scrollToOffset(offset) {
      virt.scrollToOffset(offset);
    },
    getLineEl(index) {
      return mounted.get(index) ?? null;
    },
    forEachMounted(cb) {
      for (const [idx, el] of mounted) cb(idx, el);
    },
    getTotalSize() {
      return virt.getTotalSize();
    },
    setCount(n) {
      virt.setOptions({ ...virt.options, count: n });
      // setOptions only merges; nothing internally re-runs layout. Calling
      // _willUpdate forces a recompute against the new count, then sync()
      // mounts/unmounts the diff. Without this, `getVirtualItems()` keeps
      // returning the old window even though the model grew/shrank.
      virt._willUpdate();
      sync();
    },
    shiftIndicesAfterTrim(headCount) {
      if (headCount <= 0) return;
      // Map<index, el> → Map<newIndex, el>. Anything that becomes negative is
      // unmounted (it scrolled off the head as part of the trim).
      const next = new Map<number, HTMLElement>();
      for (const [idx, el] of mounted) {
        const newIdx = idx - headCount;
        if (newIdx < 0) {
          opts.onUnmount?.(idx, el);
          el.remove();
        } else {
          setRowDatasetIndex(el, newIdx);
          next.set(newIdx, el);
        }
      }
      mounted.clear();
      for (const [idx, el] of next) mounted.set(idx, el);

      // Shift the virtualizer's INTERNAL size cache too. Without this, every
      // off-screen row's `item.start` ends up computed from a stale size
      // (the cache is keyed by index, and trim makes index 0 in the new
      // model correspond to a different entry than the cache thinks). The
      // visible rows self-correct on next mount via the pendingMeasure
      // path, but off-screen rows stay wrong — surfacing as visible row
      // overlap at trim boundaries during streaming (≥ 50K-line sessions
      // where `ensureTelnetScrollbackRoom` fires constantly).
      //
      // The default `getItemKey` is `(index) => index`, so cache keys are
      // numeric indices. Any key < headCount belongs to a trimmed entry
      // (drop it); any key >= headCount renames to (key - headCount).
      //
      // `itemSizeCache` and `measurementsCache` are marked `private` in
      // TS but are plain class fields at runtime — same access hatch the
      // upstream code itself uses internally on every `resizeItem` (see
      // node_modules/@tanstack/virtual-core/dist/esm/index.js: ~line 656,
      // `this.itemSizeCache = new Map(...)`). Resetting `measurementsCache`
      // forces the next `getMeasurements()` call (triggered by `setCount`'s
      // `_willUpdate`) to rebuild the derived `start`/`end` array from the
      // freshly-shifted size cache.
      const internals = virt as unknown as {
        itemSizeCache: Map<number, number>;
        measurementsCache: unknown[];
      };
      const oldSizeCache = internals.itemSizeCache;
      const newSizeCache = new Map<number, number>();
      for (const [key, size] of oldSizeCache) {
        if (key >= headCount) newSizeCache.set(key - headCount, size);
      }
      internals.itemSizeCache = newSizeCache;
      internals.measurementsCache = [];
    },
    shiftIndicesAfterPrepend(headCount) {
      if (headCount <= 0) return;
      // Symmetric inverse of `shiftIndicesAfterTrim`. Every existing entry's
      // index moves *up* by `headCount` so the prepended entries can occupy
      // the new 0 .. headCount-1 range.
      const next = new Map<number, HTMLElement>();
      for (const [idx, el] of mounted) {
        const newIdx = idx + headCount;
        setRowDatasetIndex(el, newIdx);
        next.set(newIdx, el);
      }
      mounted.clear();
      for (const [idx, el] of next) mounted.set(idx, el);

      // Shift the size cache the same direction. Entries currently at key K
      // belong to entries that are about to move to key K + headCount.
      // Prepended entries (keys 0 .. headCount-1) have no cached size yet
      // and will use estimateSize until they mount and self-measure.
      const internals = virt as unknown as {
        itemSizeCache: Map<number, number>;
        measurementsCache: unknown[];
      };
      const oldSizeCache = internals.itemSizeCache;
      const newSizeCache = new Map<number, number>();
      for (const [key, size] of oldSizeCache) {
        newSizeCache.set(key + headCount, size);
      }
      internals.itemSizeCache = newSizeCache;
      internals.measurementsCache = [];
    },
    measure() {
      virt.measure();
      virt._willUpdate();
      sync();
    },
    dispose() {
      detach();
      for (const [idx, el] of mounted) {
        opts.onUnmount?.(idx, el);
        el.remove();
      }
      mounted.clear();
    }
  };
}

#!/usr/bin/env npx tsx
/**
 * Regression guard for the Console Filter-mode freeze: switching to Filter
 * with a sparse match set (e.g. 35 matches in 23,000 lines) used to force the
 * virtualizer to mount + measure nearly the whole buffer one row at a time to
 * fill a single viewport (a multi-minute UI freeze). `applyRowFilter`
 * (console-virtualizer.ts) fixes this by pre-seeding the size cache so
 * non-matching rows are never built at all.
 *
 * This checks the actual invariant: row-builder call count after filtering
 * stays viewport-bound, not proportional to corpus size.
 *
 * Run from apps/roku-dev-studio: npx tsx scripts/verify-console-filter-perf.ts
 */
import { JSDOM } from 'jsdom';

async function main() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true });
  const { window } = dom;
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node
  });

  // jsdom has no real event loop scheduling for rAF/microtasks tied to layout —
  // polyfill requestAnimationFrame the same way scripts/verify-structured-pills.ts does.
  const rafHandles = new Map<number, ReturnType<typeof setTimeout>>();
  let rafNext = 1;
  (globalThis as typeof globalThis & { requestAnimationFrame: typeof window.requestAnimationFrame }).requestAnimationFrame =
    (cb: FrameRequestCallback) => {
      const id = rafNext++;
      const t = setTimeout(() => cb(0), 0);
      rafHandles.set(id, t);
      return id;
    };
  (globalThis as typeof globalThis & { cancelAnimationFrame: typeof window.cancelAnimationFrame }).cancelAnimationFrame =
    (id: number) => {
      const t = rafHandles.get(id);
      if (t) clearTimeout(t);
      rafHandles.delete(id);
    };

  const { createConsoleVirtualizer } = await import('../renderer/modules/console-log/console-virtualizer.js');

  const scrollEl = window.document.createElement('div');
  const containerEl = window.document.createElement('div');
  scrollEl.appendChild(containerEl);
  window.document.body.appendChild(scrollEl);
  // jsdom never lays out real boxes (offsetHeight/clientHeight are always 0) —
  // fake a real viewport so the virtualizer computes a bounded visible window.
  Object.defineProperty(scrollEl, 'offsetHeight', { value: 800, configurable: true });
  Object.defineProperty(scrollEl, 'offsetWidth', { value: 600, configurable: true });
  Object.defineProperty(scrollEl, 'clientHeight', { value: 800, configurable: true });

  const TOTAL = 23000;
  const ESTIMATE = 20;
  const VIEWPORT_BOUND = 200; // generous multiple of one screenful; real UI mounts ~40-60

  let buildCount = 0;
  const virt = createConsoleVirtualizer({
    scrollEl,
    containerEl,
    getCount: () => TOTAL,
    estimateSize: ESTIMATE,
    overscan: 8,
    createLineEl: (index) => {
      buildCount++;
      const el = window.document.createElement('div');
      el.textContent = String(index);
      return el;
    }
  });

  const initialBuildCount = buildCount;
  console.log(`Initial (unfiltered) mount over ${TOTAL} lines built ${initialBuildCount} rows.`);
  if (initialBuildCount === 0 || initialBuildCount > VIEWPORT_BOUND) {
    console.error(`FAIL: expected a small viewport-bound initial mount, got ${initialBuildCount}.`);
    process.exit(1);
  }

  // Sparse filter: 35 matches scattered across 23,000 lines — the reported scenario.
  const visible: number[] = [];
  for (let i = 0; i < 35; i++) visible.push(Math.floor((i / 35) * TOTAL));

  const beforeFilter = buildCount;
  virt.applyRowFilter(visible);
  const builtDuringFilter = buildCount - beforeFilter;
  console.log(`Applying a 35-match filter over ${TOTAL} lines built ${builtDuringFilter} rows.`);
  if (builtDuringFilter > VIEWPORT_BOUND) {
    console.error(
      `FAIL: applyRowFilter built ${builtDuringFilter} rows — expected a small, viewport-bound number, ` +
        `not proportional to corpus size. The mount-storm regression is back.`
    );
    process.exit(1);
  }

  const totalSizeAfterFilter = virt.getTotalSize();
  const unfilteredSize = TOTAL * ESTIMATE;
  console.log(`Scroll size after filtering: ${totalSizeAfterFilter}px (unfiltered would be ~${unfilteredSize}px).`);
  if (totalSizeAfterFilter > unfilteredSize * 0.1) {
    console.error('FAIL: total scroll size did not collapse — non-matching rows are not pinned to 0px.');
    process.exit(1);
  }

  // Clearing the filter must also stay cheap — no O(total) rebuild storm.
  const beforeClear = buildCount;
  virt.applyRowFilter(null);
  const builtDuringClear = buildCount - beforeClear;
  console.log(`Clearing the filter built ${builtDuringClear} rows.`);
  if (builtDuringClear > VIEWPORT_BOUND) {
    console.error(`FAIL: clearing the filter built ${builtDuringClear} rows — expected viewport-bound.`);
    process.exit(1);
  }

  console.log('OK: filtering a sparse match set stays viewport-bound regardless of corpus size.');
  // jsdom's `pretendToBeVisual` window leaves timers alive that keep the
  // process from exiting on its own — force it now that checks are done.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

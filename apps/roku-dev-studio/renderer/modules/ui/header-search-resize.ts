/**
 * Shared "centered, drag-to-resize search box" behavior for card headers.
 *
 * The search box lives in a `slot` centered on its card `header` (CSS
 * `left:50%; transform:translateX(-50%)`), so its horizontal center always
 * coincides with the header's center regardless of the side groups' widths. A
 * `handle` on the slot's right edge widens it: because the slot is centered, we
 * grow its width by 2× the pointer delta so the dragged (right) edge tracks the
 * cursor while the center stays pinned.
 *
 * Resizing only ever *expands* from the default width and is clamped so the box
 * never overlaps the header's left/right groups. Double-click resets to the
 * default. The chosen width is persisted per `storageKey`.
 *
 * A ResizeObserver on the header re-applies the width whenever the header
 * changes size — including 0 → N when a hidden tab first becomes visible — so
 * the persisted width lands even for tabs that aren't mounted-visible at setup.
 */

export interface HeaderSearchResizeOptions {
  /** Absolutely-centered element that holds the search box (its width is driven). */
  slot: HTMLElement;
  /** Drag handle (sits at the slot's right edge). */
  handle: HTMLElement;
  /** Card header — positioning context and the thing we center on. */
  header: HTMLElement;
  /** Right edge of the left-hand group; the box won't overlap it. */
  leftGroup?: Element | null;
  /** Left edge of the right-hand group; the box won't overlap it. */
  rightGroup?: Element | null;
  /** Storage key for the persisted width. */
  storageKey: string;
  /** Backing store. Default sessionStorage (per-box, per-session width); keys are
   *  scoped per section + device. Pass localStorage to persist across restarts. */
  storage?: Storage;
  /** Cap for the default/resting width (px). Default 680. */
  maxDefaultWidth?: number;
  /** Reserve subtracted from header width for the default. Default 360. */
  defaultReservePx?: number;
  /** Gap kept between the box and each side group at max expansion. Default 30 —
   *  enough that the drag handle (which overhangs the box's right edge by ~9px)
   *  still clears the side controls. */
  edgeGapPx?: number;
  /** Minimum width — the box never shrinks (or is dragged) below this, so its own
   *  controls always fit inside. When the header can't fit even this without
   *  overlapping the side groups, the header wraps the box onto a second row
   *  instead. Default 200. */
  minWidthPx?: number;
}

export function attachHeaderSearchResize(o: HeaderSearchResizeOptions): { dispose: () => void } {
  const { slot, handle, header } = o;
  const MAX_DEFAULT = o.maxDefaultWidth ?? 680;
  const RESERVE = o.defaultReservePx ?? 360;
  const GAP = o.edgeGapPx ?? 30;
  const store: Storage = o.storage ?? sessionStorage;

  // User's chosen width (null = use the default). Restored from storage below.
  let desired: number | null = null;
  try {
    const saved = Number(store.getItem(o.storageKey));
    if (Number.isFinite(saved) && saved > 0) desired = saved;
  } catch {
    /* ignore */
  }

  // Smallest the box may be — its controls always fit at this width; the box is
  // never dragged/clamped below it. When even this doesn't fit on one row, the
  // header wraps the box to a second row instead (see `apply`).
  const MIN = o.minWidthPx ?? 200;

  // Mark the slot so the shared two-row wrap CSS can target it.
  slot.classList.add('hdr-search-slot');

  // Preferred/resting width — mirrors the CSS default `min(MAX_DEFAULT, 100% - RESERVE)`.
  const preferredW = (): number =>
    Math.min(MAX_DEFAULT, Math.max(MIN, header.clientWidth - RESERVE));

  // Widest the centered box can be on one row without overlapping either side
  // group. Not floored at MIN — so we can detect when even MIN won't fit.
  const availW = (): number => {
    const hr = header.getBoundingClientRect();
    const center = hr.left + hr.width / 2;
    const leftEnd = o.leftGroup instanceof HTMLElement ? o.leftGroup.getBoundingClientRect().right : hr.left;
    const rightStart = o.rightGroup instanceof HTMLElement ? o.rightGroup.getBoundingClientRect().left : hr.right;
    return 2 * Math.min(center - leftEnd, rightStart - center) - GAP;
  };

  const clamp = (w: number): number => Math.round(Math.max(MIN, Math.min(w, Math.max(MIN, availW()))));

  // On one row when the box fits (clamped to [MIN, no-overlap]); otherwise wrap
  // the whole box to a second, full-width row so nothing overlaps or overflows.
  // Skipped until the header has a real size — a hidden tab measures 0, and the
  // ResizeObserver re-runs this once it shows.
  const apply = (): void => {
    if (header.clientWidth <= 0) return;
    if (availW() < MIN) {
      header.classList.add('hdr-search-wrapped');
      slot.style.width = '';
    } else {
      header.classList.remove('hdr-search-wrapped');
      slot.style.width = `${clamp(desired ?? preferredW())}px`;
    }
  };

  // Observe the header AND the side groups: the header can stay the same width
  // while a side group grows (e.g. a streaming "50,000 of 132,130 lines" counter),
  // which would otherwise let the box overlap it. Observing the groups re-clamps
  // whenever their width changes, so the box always yields before overlapping.
  const ro = new ResizeObserver(() => apply());
  ro.observe(header);
  if (o.leftGroup instanceof Element) ro.observe(o.leftGroup);
  if (o.rightGroup instanceof Element) ro.observe(o.rightGroup);
  requestAnimationFrame(apply);

  let startX = 0;
  let startW = 0;
  const onMove = (e: PointerEvent): void => {
    slot.style.width = `${clamp(startW + (e.clientX - startX) * 2)}px`;
  };
  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.style.userSelect = '';
    handle.classList.remove('is-dragging');
    desired = slot.getBoundingClientRect().width;
    try {
      store.setItem(o.storageKey, String(Math.round(desired)));
    } catch {
      /* ignore */
    }
  };
  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    startX = e.clientX;
    startW = slot.getBoundingClientRect().width;
    document.body.style.userSelect = 'none';
    handle.classList.add('is-dragging');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const onDblClick = (): void => {
    desired = null;
    slot.style.width = '';
    try {
      store.removeItem(o.storageKey);
    } catch {
      /* ignore */
    }
    apply();
  };

  handle.addEventListener('pointerdown', onDown);
  handle.addEventListener('dblclick', onDblClick);

  return {
    dispose(): void {
      ro.disconnect();
      handle.removeEventListener('pointerdown', onDown);
      handle.removeEventListener('dblclick', onDblClick);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      header.classList.remove('hdr-search-wrapped');
      slot.classList.remove('hdr-search-slot');
    }
  };
}

/**
 * Convenience for the shared `.find-bar.find-bar-header` surfaces (Query
 * Results, App Connector Response, …): appends a drag handle to the (already
 * absolutely-centered) find bar and wires {@link attachHeaderSearchResize}
 * against its card header. Returns null if the bar isn't inside a `.card-header`.
 */
export function makeCenteredSearchResizable(
  barEl: HTMLElement,
  opts: {
    storageKey: string;
    storage?: Storage;
    leftGroupSelector?: string;
    rightGroupSelector?: string;
    header?: HTMLElement | null;
    minWidthPx?: number;
  }
): { dispose: () => void } | null {
  const header = opts.header ?? barEl.closest('.card-header');
  if (!(header instanceof HTMLElement)) return null;
  const handle = document.createElement('div');
  handle.className = 'hdr-search-resize';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.title = 'Drag to widen search (double-click to reset)';
  barEl.appendChild(handle);
  return attachHeaderSearchResize({
    slot: barEl,
    handle,
    header,
    leftGroup: opts.leftGroupSelector ? header.querySelector(opts.leftGroupSelector) : null,
    rightGroup: opts.rightGroupSelector ? header.querySelector(opts.rightGroupSelector) : null,
    storageKey: opts.storageKey,
    storage: opts.storage,
    minWidthPx: opts.minWidthPx
  });
}

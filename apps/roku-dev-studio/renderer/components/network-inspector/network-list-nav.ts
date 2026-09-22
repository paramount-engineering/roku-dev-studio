/**
 * Keyboard navigation for the session list, shared by the live Network tab and the standalone Session
 * Viewer: ↑/↓ step through requests, Home/End jump to the ends, Shift+↑/↓ walk Find matches. The host
 * supplies the navigable id order and the select action; this module owns the key handling, the focus
 * plumbing and the "keep the selected row inside the scroller" math.
 */
export interface ListNavHost {
  /** Event ids in on-screen order (see {@link navigableEventIds}). */
  navigableIds: () => string[];
  selectedId: () => string | null;
  /** Select `id`: highlight it, render its detail and bring its row into view. */
  select: (id: string) => void;
  findActive?: () => boolean;
  findNext?: () => void;
  findPrev?: () => void;
}

/**
 * Ids a keyboard walk visits, in on-screen order. Group-by-Host follows the DOM (collapsed groups hide
 * their leaves); sequence view is the filtered capture order — non-focused rows only dim (never hide),
 * so every filtered session stays arrow-navigable.
 */
export function navigableEventIds(opts: {
  viewMode: 'sequence' | 'structure';
  listEl: HTMLElement | null;
  sequenceIds: string[];
}): string[] {
  if (opts.viewMode === 'structure' && opts.listEl) {
    return Array.from(opts.listEl.querySelectorAll('.ni-struct-leaf[data-event-id]'))
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => (el as HTMLElement).dataset.eventId)
      .filter((id): id is string => !!id);
  }
  return opts.sequenceIds;
}

/** Step the selection by `delta` rows (clamped to the ends). */
export function selectByOffset(host: ListNavHost, delta: number): void {
  const ids = host.navigableIds();
  if (ids.length === 0) return;
  const current = host.selectedId();
  let idx = current ? ids.indexOf(current) : -1;
  if (idx < 0) idx = delta > 0 ? -1 : ids.length;
  const next = Math.max(0, Math.min(ids.length - 1, idx + delta));
  if (next === idx) return;
  host.select(ids[next]!);
}

function selectEnd(host: ListNavHost, which: 'first' | 'last'): void {
  const ids = host.navigableIds();
  if (ids.length === 0) return;
  const id = which === 'first' ? ids[0]! : ids[ids.length - 1]!;
  if (host.selectedId() === id) return;
  host.select(id);
}

/** Make the scroller focusable so keys reach it after a row click — idempotent. */
export function makeListFocusable(wrap: HTMLElement, ariaLabel: string): void {
  if (wrap.hasAttribute('tabindex')) return;
  wrap.tabIndex = 0;
  wrap.setAttribute('aria-label', ariaLabel);
}

/** Focus the scroller without scrolling it (called after a row click). */
export function focusListForKeyboard(wrap: HTMLElement | null): void {
  wrap?.focus({ preventScroll: true });
}

/** Bind the key handling once per scroller element (a rebuilt scroller gets bound again). */
export function bindListKeyboardNav(
  wrap: HTMLElement,
  host: ListNavHost,
  listenerOptions?: AddEventListenerOptions
): void {
  if (wrap.dataset.niKeybound === '1') return;
  wrap.dataset.niKeybound = '1';
  wrap.addEventListener(
    'keydown',
    (e) => {
      // Shift+↑/↓ jumps across Find matches only (plain ↑/↓ still step through every request).
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.shiftKey && host.findActive?.()) {
        e.preventDefault();
        if (e.key === 'ArrowDown') host.findNext?.();
        else host.findPrev?.();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectByOffset(host, 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectByOffset(host, -1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        selectEnd(host, 'first');
      } else if (e.key === 'End') {
        e.preventDefault();
        selectEnd(host, 'last');
      }
    },
    listenerOptions
  );
}

/** Scroll `wrap` the minimum needed so `row` sits fully inside it (no-op when already visible). */
export function scrollRowWithinWrap(wrap: HTMLElement, row: HTMLElement): void {
  const wr = wrap.getBoundingClientRect();
  const rr = row.getBoundingClientRect();
  if (rr.top >= wr.top && rr.bottom <= wr.bottom) return;
  if (rr.top < wr.top) wrap.scrollTop += rr.top - wr.top;
  else if (rr.bottom > wr.bottom) wrap.scrollTop += rr.bottom - wr.bottom;
}

/**
 * Re-stamp the selected-row class in place (no list rebuild, so the scroll position is untouched).
 * Handles sequence rows and Group-by-Host leaves; when the leaf's group is collapsed the leaf itself is
 * hidden, so the selection is surfaced on the (visible) group header too. Returns false when `id` has
 * no rendered row — the caller then falls back to a full render.
 */
export function updateSelectionHighlight(listEl: HTMLElement, id: string | null): boolean {
  listEl
    .querySelectorAll('.ni-sidebar-row-selected, .ni-seq-row-selected, .ni-struct-leaf-selected, .ni-struct-host-row-selected')
    .forEach((el) => {
      el.classList.remove('ni-sidebar-row-selected', 'ni-seq-row-selected', 'ni-struct-leaf-selected', 'ni-struct-host-row-selected');
    });
  if (!id) return false;
  const row = listEl.querySelector(`[data-event-id="${CSS.escape(id)}"]`) as HTMLElement | null;
  if (!row) return false;
  if (row.classList.contains('ni-sidebar-row')) row.classList.add('ni-sidebar-row-selected');
  else if (row.classList.contains('ni-seq-row')) row.classList.add('ni-seq-row-selected');
  else if (row.classList.contains('ni-struct-leaf')) {
    row.classList.add('ni-struct-leaf-selected');
    const host = row.closest('.ni-struct-host');
    if (host?.classList.contains('ni-struct-host-collapsed')) {
      host.querySelector(':scope > .ni-struct-host-row')?.classList.add('ni-struct-host-row-selected');
    }
  }
  return true;
}

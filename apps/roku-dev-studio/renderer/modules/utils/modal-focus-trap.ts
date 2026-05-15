/**
 * Focus management for `[role="dialog"]` overlays opened by
 * `openModalOverlayActiveFromOpener`. Provides:
 *
 *   - **focus move on open**: send focus to the dialog (or its first focusable
 *     descendant) so screen readers and keyboard users land *inside* the
 *     dialog instead of the page behind it.
 *   - **focus trap on Tab**: keep keyboard focus inside the dialog while it's
 *     open. Tab past the last focusable wraps to the first; Shift+Tab past
 *     the first wraps to the last.
 *   - **focus restore on close**: return focus to whatever element opened the
 *     dialog (typically the button / pill / link that triggered it). Falls
 *     back to `document.body` when the opener is gone (e.g. row unmounted).
 *
 * Why a dedicated util: the project's existing modal infra
 * (`modal-origin-motion.ts`) handles geometry / animation but not a11y. Older
 * modals predate `aria-modal`-conscious assistive tech and intentionally let
 * focus stay on the opener; the telnet JSON/XML and URL viewers, by contrast,
 * mark themselves with `role="dialog" aria-modal="true"` so their contract
 * with assistive tech is now to manage focus. This helper is opt-in to keep
 * legacy modals untouched.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable=""]',
  '[contenteditable="true"]'
].join(', ');

/**
 * Return the dialog surface element (the actual focusable region) for an
 * overlay. Mirrors `getModalDialogSurface` in `modal-origin-motion.ts` —
 * kept local so the focus-trap util doesn't take a dep on motion code.
 */
function findDialogSurface(overlay: HTMLElement): HTMLElement {
  const candidate = overlay.querySelector(
    ':scope > .modal, :scope > [role="dialog"]'
  );
  return candidate instanceof HTMLElement ? candidate : overlay;
}

function getVisibleFocusable(root: HTMLElement): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  // `offsetParent` is `null` when the element (or any ancestor) is
  // `display: none`, which is exactly the "not actually reachable" state we
  // want to skip. Visibility:hidden and aria-hidden subtrees aren't filtered
  // here — they're rare on these dialogs and adding the checks isn't worth
  // the perf hit on every Tab.
  return all.filter((el) => el.offsetParent !== null || el === document.activeElement);
}

export type ModalFocusTrapHandle = {
  /** Detach the keydown listener and restore focus to the opener. Call from
   *  the overlay's close path so a re-open starts from a clean state. */
  release: () => void;
};

export type AttachModalFocusTrapOpts = {
  overlay: HTMLElement;
  /**
   * Element that opened the dialog. Focus is restored here on `release()`
   * (when the dialog closes). May be `null` for keyboard / programmatic
   * opens — in that case focus falls back to `document.body`.
   */
  opener?: HTMLElement | null;
  /**
   * Element to focus on attach. Defaults to the first focusable inside the
   * dialog surface, falling back to the surface itself (with a temporary
   * `tabindex="-1"`) when there are no focusables. Pass an explicit element
   * for dialogs whose first focusable is a destructive action — focusing
   * "Delete" by default is rarely what users want.
   */
  initialFocus?: HTMLElement | null;
};

/**
 * Install a focus trap on `overlay`. Caller is responsible for invoking
 * `release()` when the dialog closes (typically inside the overlay's `close`
 * function, before motion cleanup).
 */
export function attachModalFocusTrap(opts: AttachModalFocusTrapOpts): ModalFocusTrapHandle {
  const { overlay } = opts;
  const surface = findDialogSurface(overlay);
  const opener = opts.opener ?? null;

  // Make the surface focusable as a fallback target when nothing inside it is
  // tab-reachable. Removed on release so we don't pollute the DOM.
  const surfaceHadTabIndex = surface.hasAttribute('tabindex');
  if (!surfaceHadTabIndex) {
    surface.setAttribute('tabindex', '-1');
  }

  const target = opts.initialFocus ?? getVisibleFocusable(surface)[0] ?? surface;
  // Defer the focus to the next microtask so it lands *after* the dialog has
  // been added to the DOM and (more importantly) after any synchronous
  // `.focus()` from the open animation hooks has settled. Without the defer,
  // the dialog surface would steal focus and then the animation cleanup would
  // remove the `tabindex` we just set, leaving focus on `<body>`.
  queueMicrotask(() => {
    if (!overlay.isConnected) return;
    target.focus({ preventScroll: true });
  });

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return;
    if (!overlay.classList.contains('active')) return;
    const focusables = getVisibleFocusable(surface);
    if (focusables.length === 0) {
      // Nothing focusable inside the dialog — keep focus pinned on the
      // surface. Without this Tab would escape to elements behind the
      // overlay.
      e.preventDefault();
      surface.focus({ preventScroll: true });
      return;
    }
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || active === surface) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
  };

  // `keydown` on `document` (not the overlay): the user might be focused on
  // the surface itself (the `tabindex="-1"` fallback), and overlay-scoped
  // listeners don't fire when the focus target isn't a descendant of the
  // listener's element in some browsers. `document` always sees the event.
  document.addEventListener('keydown', onKeyDown, true);

  let released = false;
  return {
    release(): void {
      if (released) return;
      released = true;
      document.removeEventListener('keydown', onKeyDown, true);
      if (!surfaceHadTabIndex) {
        surface.removeAttribute('tabindex');
      }
      // Restore focus to whatever opened the dialog. Skip when the opener has
      // been detached (e.g. its containing log row was unmounted while the
      // dialog was open) — focusing a detached node throws in some engines.
      if (opener && opener.isConnected) {
        try {
          opener.focus({ preventScroll: true });
        } catch {
          /* swallow — body is the safe fallback */
        }
      }
    }
  };
}

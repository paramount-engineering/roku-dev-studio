/**
 * Reusable scaffold for the singleton telnet-style modals (formatted JSON/XML
 * viewer, URL viewer). Both modals had identical lifecycle plumbing — singleton
 * overlay creation, backdrop click-with-mousedown-gate, Esc-key handler, focus
 * trap re-arming, scroll reset, motion bridging — that needed to evolve
 * together but lived in two files. The recent backdrop-dismissal and focus-trap
 * fixes had to land in both files independently; the next bug in this surface
 * area would too. Folding the lifecycle into one helper means each modal file
 * shrinks to its payload-specific markup + behavior, and a shared fix lands
 * once.
 *
 * Per-modal code provides:
 *   - the overlay DOM id (singleton key)
 *   - the inner markup (one `.modal[role="dialog"]` root)
 *   - the selector of the close (×) button inside the dialog
 *   - an optional `onMount` to wire payload-specific buttons / delegates
 *
 * The helper provides:
 *   - `getOverlay()` — singleton lazy create
 *   - `open(opener, populate?)` — reset scroll, run `populate`, attach focus
 *     trap, play motion
 *   - `close()` — release trap, play close motion, reset scroll, drop
 *     `.active`, fire `notifyConsoleViewerClosed`
 */

import {
  closeModalWithOriginMotion,
  openModalOverlayActiveFromOpener
} from '../utils/modal-origin-motion.js';
import {
  attachModalFocusTrap,
  type ModalFocusTrapHandle
} from '../utils/modal-focus-trap.js';
import { attachBackdropClickToClose } from '../utils/modal-backdrop-click.js';
import { attachModalResize } from '../utils/modal-resize.js';
import {
  resetConsoleModalScrollInOverlay,
  scheduleConsoleModalScrollReset
} from './console-modal-scroll-reset.js';
import { notifyConsoleViewerClosed } from './console-viewer-bridge.js';

export type SingletonConsoleModalOpts = {
  /** DOM id for the singleton overlay element. The same id is used to look
   *  up an existing overlay before building a new one — mismatched ids
   *  would create a second overlay on every `open()`. */
  overlayId: string;
  /**
   * Markup inserted as `.modal-overlay`'s innerHTML. Must contain a single
   * root element matching `.modal` with `role="dialog"` and `aria-modal="true"`,
   * including a labelled title (`aria-labelledby` referencing an in-overlay id).
   * The focus trap and `aria-modal` semantics depend on this contract.
   *
   * Pass a FUNCTION (not a plain string) when the markup embeds localized `S.*`
   * text, so it is resolved from the active locale when the overlay is built
   * (first open) rather than frozen at module-import time.
   */
  innerHTML: string | (() => string);
  /**
   * Selector for the close (×) button inside the dialog surface. Wired to
   * the same `close()` path the backdrop and Esc use.
   */
  closeButtonSelector: string;
  /**
   * Called once after the overlay DOM is appended and the shared lifecycle
   * handlers (close button, backdrop, Esc) are bound. Use this to wire
   * payload-specific buttons (e.g. Copy, "Open in browser") and delegates
   * (e.g. fold-group twisty toggling). The `close` helper is the same
   * function the backdrop / Esc invoke, so payload buttons that should
   * dismiss the modal can call it directly.
   */
  onMount?: (overlay: HTMLElement, helpers: { close: () => void }) => void;
};

export type SingletonConsoleModalHandle = {
  /** Returns the overlay element, building it on first use. */
  getOverlay: () => HTMLElement;
  /**
   * Open the modal:
   *   1. Build the overlay if it doesn't exist (`onMount` fires here once).
   *   2. Run `populate(overlay)` so the dialog has its final layout box
   *      *before* motion calculates the transform-origin.
   *   3. Set `aria-hidden=false`, play open motion from the opener's center,
   *      schedule a scroll reset.
   *   4. Re-arm the focus trap (releasing any prior trap from a back-to-back
   *      open).
   */
  open: (opener: HTMLElement | null, populate?: (overlay: HTMLElement) => void) => void;
  /** Idempotent close; only fires when the overlay is `.active`. */
  close: () => void;
};

export function createSingletonConsoleModal(opts: SingletonConsoleModalOpts): SingletonConsoleModalHandle {
  const { overlayId, innerHTML, closeButtonSelector } = opts;

  let overlay: HTMLElement | null = null;
  let activeFocusTrap: ModalFocusTrapHandle | null = null;
  let escapeListenerAdded = false;

  const releaseFocusTrap = (): void => {
    if (!activeFocusTrap) return;
    activeFocusTrap.release();
    activeFocusTrap = null;
  };

  const closeOverlay = (target: HTMLElement): void => {
    if (!target.classList.contains('active')) return;
    // Release the focus trap before motion so focus restoration happens
    // synchronously with the close — otherwise the dialog would still be in
    // a "trap active" state during the closing animation.
    releaseFocusTrap();
    closeModalWithOriginMotion(target, () => {
      resetConsoleModalScrollInOverlay(target);
      target.classList.remove('active');
      target.setAttribute('aria-hidden', 'true');
      notifyConsoleViewerClosed();
    });
  };

  const ensureOverlay = (): HTMLElement => {
    if (overlay && overlay.isConnected) return overlay;

    const existing = document.getElementById(overlayId);
    if (existing instanceof HTMLElement) {
      overlay = existing;
      return overlay;
    }

    const el = document.createElement('div');
    el.id = overlayId;
    el.className = 'modal-overlay';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = typeof innerHTML === 'function' ? innerHTML() : innerHTML;
    document.body.appendChild(el);
    overlay = el;

    const close = () => closeOverlay(el);

    el.querySelector(closeButtonSelector)?.addEventListener('click', close);

    // Backdrop click-to-close (mousedown-gated; see helper for rationale).
    attachBackdropClickToClose(el, close);

    if (!escapeListenerAdded) {
      escapeListenerAdded = true;
      document.addEventListener(
        'keydown',
        (e) => {
          if (e.key !== 'Escape') return;
          const current = overlay;
          if (!current || !current.isConnected) return;
          if (!current.classList.contains('active')) return;
          closeOverlay(current);
        },
        true
      );
    }

    // Make the dialog surface user-resizable (bottom-right grip, center-anchored).
    const dialog = el.querySelector('[role="dialog"]');
    if (dialog instanceof HTMLElement) attachModalResize(dialog);

    opts.onMount?.(el, { close });
    return el;
  };

  const open = (
    opener: HTMLElement | null,
    populate?: (target: HTMLElement) => void
  ): void => {
    const target = ensureOverlay();
    populate?.(target);
    resetConsoleModalScrollInOverlay(target);
    target.setAttribute('aria-hidden', 'false');
    openModalOverlayActiveFromOpener(target, opener, () => {
      scheduleConsoleModalScrollReset(target);
    });
    // Re-arm focus management for this open. `release` happens in the close
    // path normally — but re-opening from a *different* opener (without an
    // intervening close) hits this without a release, so defensively drop
    // any prior trap before installing the new one.
    releaseFocusTrap();
    activeFocusTrap = attachModalFocusTrap({ overlay: target, opener });
  };

  return {
    getOverlay: ensureOverlay,
    open,
    close: () => {
      const target = overlay;
      if (target) closeOverlay(target);
    }
  };
}

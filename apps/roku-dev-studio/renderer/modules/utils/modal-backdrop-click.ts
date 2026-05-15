/**
 * Backdrop-click-to-close handler for `.modal-overlay`-style modals, gated on
 * `mousedown` ALSO starting on the backdrop.
 *
 * Why a helper: a naive `overlay.addEventListener('click', e => { if (e.target
 * === overlay) close(); })` looks correct but fires the close on a perfectly
 * legitimate user interaction — text selection that starts inside the dialog
 * body and ends on the backdrop. The browser's `click` event fires on the
 * **closest common ancestor of mousedown and mouseup**; for "drag from
 * dialog text → release on backdrop", that ancestor is the overlay itself,
 * so the naive guard passes and the modal dismisses mid-selection.
 *
 * Latching the press location on `mousedown` (was it on the backdrop, or on
 * a descendant?) and gating the `click` on it preserves drag-out selection
 * while keeping the intuitive "click the backdrop to dismiss" affordance.
 *
 * This had to be patched in three modals independently last session
 * (singleton-console-modal, action-step-help-modal, app.ts confirm overlay).
 * Folding the pattern into a shared helper means the next modal that needs
 * backdrop-dismissal gets it right by default, and any future fix lands once.
 *
 * Returns a `dispose()` so callers that re-mount or tear down can detach the
 * listeners cleanly. Most callers don't need to call dispose (the overlay
 * itself is the listener target and is removed with its listeners on close);
 * exposed only for completeness.
 */

export function attachBackdropClickToClose(overlay: HTMLElement, close: () => void): () => void {
  let pressStartedOnOverlay = false;

  const onMouseDown = (e: MouseEvent): void => {
    pressStartedOnOverlay = e.target === overlay;
  };
  const onClick = (e: MouseEvent): void => {
    if (e.target === overlay && pressStartedOnOverlay) close();
  };

  overlay.addEventListener('mousedown', onMouseDown);
  overlay.addEventListener('click', onClick);

  return () => {
    overlay.removeEventListener('mousedown', onMouseDown);
    overlay.removeEventListener('click', onClick);
  };
}

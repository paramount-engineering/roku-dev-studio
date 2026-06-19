/**
 * Bottom-right drag-to-resize grip for a *center-anchored* modal dialog.
 *
 * Extracted from the singleton console-modal scaffold so any modal (not just the singleton
 * JSON/XML and URL viewers) can opt into user resizing with one call. Lives beside the other modal
 * lifecycle helpers (`modal-origin-motion`, `modal-focus-trap`, `modal-backdrop-click`).
 *
 * Because the overlay flex-centers the modal, growing its width/height keeps its center fixed — so
 * to keep the bottom-right corner under the cursor we grow each dimension by *twice* the drag delta
 * (the box expands equally on both sides / top & bottom). Size is clamped to the viewport;
 * `is-resized` lets CSS drop the default max-w/h caps so the explicit size wins.
 */

// Smallest the user can shrink a resized modal to (px), so it never collapses past usability.
const RESIZE_MIN_W = 360;
const RESIZE_MIN_H = 220;

/** Append a resize grip to `modal` and wire pointer-drag resizing. Returns a remover that detaches
 *  the grip + its listeners. */
export function attachModalResize(modal: HTMLElement): () => void {
  const handle = document.createElement('div');
  handle.className = 'modal-resize-handle';
  handle.setAttribute('aria-hidden', 'true');
  handle.title = 'Drag to resize';
  modal.appendChild(handle);

  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = modal.getBoundingClientRect();
    const startW = rect.width;
    const startH = rect.height;
    modal.classList.add('is-resized');
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const onMove = (ev: PointerEvent): void => {
      const maxW = window.innerWidth * 0.96;
      const maxH = window.innerHeight * 0.96;
      const w = Math.min(maxW, Math.max(RESIZE_MIN_W, startW + (ev.clientX - startX) * 2));
      const h = Math.min(maxH, Math.max(RESIZE_MIN_H, startH + (ev.clientY - startY) * 2));
      modal.style.width = `${Math.round(w)}px`;
      modal.style.height = `${Math.round(h)}px`;
    };
    const onUp = (ev: PointerEvent): void => {
      try {
        handle.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  };

  handle.addEventListener('pointerdown', onPointerDown);
  return () => {
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.remove();
  };
}

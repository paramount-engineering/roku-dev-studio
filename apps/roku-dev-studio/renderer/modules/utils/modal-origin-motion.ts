/**
 * Modal open/close: dialog **scales** from the opener control with `transform-origin`
 * at the opener center (in the dialog’s local coordinates), so corners appear to
 * expand from / shrink toward the button — not translate-from-center.
 */

const CLASS_MOTION = 'modal-motion-enabled';

/**
 * Smooth deceleration at the end (less “snappy” than linear-ish curves).
 * Slightly longer duration reads calmer on large modals.
 */
const MOTION_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const MOTION_DURATION_MS = 400;
/** When open/close motion cleanup runs at latest (fallback `transitionend`). Exported for scroll reset after dialog layout settles. */
export const MODAL_ORIGIN_MOTION_FALLBACK_MS = MOTION_DURATION_MS + 220;
const MOTION_FALLBACK_MS = MODAL_ORIGIN_MOTION_FALLBACK_MS;
const MOTION_TRANSITION = `transform ${MOTION_DURATION_MS}ms ${MOTION_EASE}, opacity ${MOTION_DURATION_MS}ms ${MOTION_EASE}`;
/** Dim + frosted glass behind the dialog, same timing as the surface motion. */
const OVERLAY_BACKDROP_TRANSITION = `backdrop-filter ${MOTION_DURATION_MS}ms ${MOTION_EASE}, -webkit-backdrop-filter ${MOTION_DURATION_MS}ms ${MOTION_EASE}, background-color ${MOTION_DURATION_MS}ms ${MOTION_EASE}`;
/** Slightly higher floor = less abrupt micro-scale from tiny openers. */
const MIN_SCALE_FLOOR = 0.08;
const MIN_SCALE_CAP = 0.2;

const TRANSPARENT_BG = 'rgba(0, 0, 0, 0)';
const ZERO_BACKDROP = 'blur(0px)';

type OverlayBackdropEnd = { filter: string; background: string };

function readComputedBackdrop(overlay: HTMLElement): OverlayBackdropEnd {
  const cs = getComputedStyle(overlay);
  let filter = (cs.backdropFilter || '').trim();
  if (!filter || filter === 'none') {
    const wk = (cs as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter?.trim();
    if (wk && wk !== 'none') filter = wk;
  }
  if (!filter || filter === 'none') filter = 'blur(4px)';
  const background = cs.backgroundColor || TRANSPARENT_BG;
  return { filter, background };
}

function clearOverlayBackdropStyles(overlay: HTMLElement): void {
  overlay.style.removeProperty('transition');
  overlay.style.removeProperty('backdrop-filter');
  overlay.style.removeProperty('-webkit-backdrop-filter');
  overlay.style.removeProperty('background-color');
}

function setOverlayBackdropNoTransition(overlay: HTMLElement, filter: string, background: string): void {
  overlay.style.transition = 'none';
  overlay.style.backdropFilter = filter;
  overlay.style.setProperty('-webkit-backdrop-filter', filter);
  overlay.style.backgroundColor = background;
  void overlay.offsetHeight;
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getModalDialogSurface(overlay: HTMLElement): HTMLElement | null {
  const selectors = [
    ':scope > .modal',
    ':scope > .add-location-form',
    ':scope > .server-info-modal',
    ':scope > .device-hardware-image-modal'
  ];
  for (const sel of selectors) {
    const el = overlay.querySelector(sel);
    if (el instanceof HTMLElement) return el;
  }
  return null;
}

function clearOpenerDataset(overlay: HTMLElement): void {
  delete overlay.dataset.modalOpenerCx;
  delete overlay.dataset.modalOpenerCy;
  delete overlay.dataset.modalOpenerW;
  delete overlay.dataset.modalOpenerH;
}

function resetSurfaceInline(surface: HTMLElement): void {
  surface.style.transition = 'none';
  surface.style.removeProperty('transform');
  surface.style.removeProperty('transform-origin');
  surface.style.removeProperty('opacity');
  void surface.offsetHeight;
}

function openerMinScale(surfaceRect: DOMRect, openerW: number, openerH: number): number {
  const sx = Math.max(surfaceRect.width, 1);
  const sy = Math.max(surfaceRect.height, 1);
  return Math.max(MIN_SCALE_FLOOR, Math.min(openerW / sx, openerH / sy, MIN_SCALE_CAP));
}

function readOpenerCenter(overlay: HTMLElement): { cx: number; cy: number; ow: number; oh: number } | null {
  const cx = parseFloat(overlay.dataset.modalOpenerCx || '');
  const cy = parseFloat(overlay.dataset.modalOpenerCy || '');
  const ow = parseFloat(overlay.dataset.modalOpenerW || '');
  const oh = parseFloat(overlay.dataset.modalOpenerH || '');
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return {
    cx,
    cy,
    ow: Number.isFinite(ow) && ow > 0 ? ow : 32,
    oh: Number.isFinite(oh) && oh > 0 ? oh : 32
  };
}

/** Snapshot opener geometry for origin + end scale (viewport space). */
export function prepareModalOpenOrigin(overlay: HTMLElement, opener: HTMLElement | null | undefined): void {
  delete overlay.dataset.modalClosing;
  clearOpenerDataset(overlay);

  if (reducedMotion()) return;

  if (!opener || !document.contains(opener)) return;

  const r = opener.getBoundingClientRect();
  if (r.width < 1 && r.height < 1) return;

  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  overlay.dataset.modalOpenerCx = String(cx);
  overlay.dataset.modalOpenerCy = String(cy);
  overlay.dataset.modalOpenerW = String(Math.max(r.width, 8));
  overlay.dataset.modalOpenerH = String(Math.max(r.height, 8));
}

/** Run after overlay is visible and the dialog surface has its final layout box. */
export function playModalOpenMotion(overlay: HTMLElement): void {
  const surface = getModalDialogSurface(overlay);
  if (!surface) {
    return;
  }

  if (reducedMotion()) {
    resetSurfaceInline(surface);
    return;
  }

  overlay.classList.add(CLASS_MOTION);

  const opener = readOpenerCenter(overlay);
  const rect = surface.getBoundingClientRect();
  let ox = rect.width / 2;
  let oy = rect.height / 2;
  /** No opener: subtle zoom from center (keyboard / programmatic open). */
  let minScale = 0.94;

  if (opener) {
    ox = opener.cx - rect.left;
    oy = opener.cy - rect.top;
    minScale = openerMinScale(rect, opener.ow, opener.oh);
  }

  const backdropEnd = readComputedBackdrop(overlay);
  setOverlayBackdropNoTransition(overlay, ZERO_BACKDROP, TRANSPARENT_BG);

  resetSurfaceInline(surface);
  surface.style.transformOrigin = `${ox}px ${oy}px`;
  surface.style.transform = `scale(${minScale})`;
  /** Opener: full fade-in; no opener: lighter fade with the subtle center scale. */
  surface.style.opacity = opener ? '0' : '0.88';

  void surface.offsetHeight;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.transition = OVERLAY_BACKDROP_TRANSITION;
      overlay.style.backdropFilter = backdropEnd.filter;
      overlay.style.setProperty('-webkit-backdrop-filter', backdropEnd.filter);
      overlay.style.backgroundColor = backdropEnd.background;

      surface.style.transition = MOTION_TRANSITION;
      surface.style.transform = 'scale(1)';
      surface.style.opacity = '1';

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        surface.removeEventListener('transitionend', onEnd);
        surface.style.removeProperty('transition');
        surface.style.removeProperty('transform');
        surface.style.removeProperty('transform-origin');
        surface.style.removeProperty('opacity');
        clearOverlayBackdropStyles(overlay);
      };

      const onEnd = (e: TransitionEvent) => {
        if (e.target !== surface || e.propertyName !== 'transform') return;
        cleanup();
      };
      surface.addEventListener('transitionend', onEnd);
      window.setTimeout(cleanup, MOTION_FALLBACK_MS);
    });
  });
}

function clearMotionStyle(overlay: HTMLElement): void {
  overlay.classList.remove(CLASS_MOTION);
  clearOverlayBackdropStyles(overlay);
  const surface = getModalDialogSurface(overlay);
  if (surface) {
    surface.style.removeProperty('transition');
    surface.style.removeProperty('transform');
    surface.style.removeProperty('transform-origin');
    surface.style.removeProperty('opacity');
  }
  clearOpenerDataset(overlay);
}

/**
 * Scale dialog down toward the stored opener origin, then run `finalize`.
 */
export function closeModalWithOriginMotion(overlay: HTMLElement, finalize: () => void): void {
  if (!overlay.isConnected) {
    delete overlay.dataset.modalClosing;
    return;
  }
  if (overlay.dataset.modalClosing === '1') return;
  overlay.dataset.modalClosing = '1';

  const surface = getModalDialogSurface(overlay);
  const opener = readOpenerCenter(overlay);

  const runFinalize = () => {
    delete overlay.dataset.modalClosing;
    finalize();
    if (overlay.isConnected) {
      clearMotionStyle(overlay);
    }
  };

  if (!surface || reducedMotion()) {
    runFinalize();
    return;
  }

  const backdropStart = readComputedBackdrop(overlay);
  setOverlayBackdropNoTransition(overlay, backdropStart.filter, backdropStart.background);

  const rect = surface.getBoundingClientRect();
  let ox = rect.width / 2;
  let oy = rect.height / 2;
  let minScale = 0.94;

  if (opener) {
    ox = opener.cx - rect.left;
    oy = opener.cy - rect.top;
    minScale = openerMinScale(rect, opener.ow, opener.oh);
  }

  resetSurfaceInline(surface);
  surface.style.transformOrigin = `${ox}px ${oy}px`;
  surface.style.transform = 'scale(1)';
  surface.style.opacity = '1';

  void surface.offsetHeight;

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    surface.removeEventListener('transitionend', onEnd);
    runFinalize();
  };

  const onEnd = (e: TransitionEvent) => {
    if (e.target !== surface || e.propertyName !== 'transform') return;
    done();
  };
  surface.addEventListener('transitionend', onEnd);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.transition = OVERLAY_BACKDROP_TRANSITION;
      overlay.style.backdropFilter = ZERO_BACKDROP;
      overlay.style.setProperty('-webkit-backdrop-filter', ZERO_BACKDROP);
      overlay.style.backgroundColor = TRANSPARENT_BG;

      surface.style.transition = MOTION_TRANSITION;
      surface.style.transform = `scale(${minScale})`;
      surface.style.opacity = opener ? '0' : '0.92';
    });
  });

  window.setTimeout(done, MOTION_FALLBACK_MS);
}

/** Adds `.active`, optional hook, then plays enter motion (after `prepareModalOpenOrigin`). */
export function openModalOverlayActiveFromOpener(
  overlay: HTMLElement,
  opener: HTMLElement | null | undefined,
  afterActive?: () => void
): void {
  prepareModalOpenOrigin(overlay, opener ?? null);
  overlay.classList.add('active');
  afterActive?.();
  playModalOpenMotion(overlay);
}

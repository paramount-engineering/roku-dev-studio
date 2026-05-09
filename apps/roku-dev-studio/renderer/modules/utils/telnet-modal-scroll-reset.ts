import { MODAL_ORIGIN_MOTION_FALLBACK_MS } from './modal-origin-motion.js';

/**
 * Telnet JSON/XML/URL modals reuse one DOM subtree; browsers keep scrollTop on nested
 * overflow boxes. Reset every descendant that can scroll (heuristic + known shells).
 */
export function resetTelnetModalScrollInOverlay(overlay: HTMLElement): void {
  overlay.scrollTop = 0;
  overlay.scrollLeft = 0;

  const known = overlay.querySelectorAll<HTMLElement>(
    '.modal, .modal-body, .telnet-structured-view-body, .telnet-structured-view-pre, .telnet-url-view-body, .telnet-url-view-full-url, .telnet-url-view-params'
  );
  for (const el of known) {
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }

  for (const el of overlay.querySelectorAll<HTMLElement>('*')) {
    if (el.scrollTop || el.scrollLeft) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
    const sh = el.scrollHeight;
    const ch = el.clientHeight;
    const sw = el.scrollWidth;
    const cw = el.clientWidth;
    if (sh > ch + 1 || sw > cw + 1) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
  }
}

/** Run after paint and again after open motion so scroll position does not stick from the previous open. */
export function scheduleTelnetModalScrollReset(overlay: HTMLElement): void {
  const run = () => resetTelnetModalScrollInOverlay(overlay);
  queueMicrotask(run);
  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
  window.setTimeout(run, 0);
  window.setTimeout(run, MODAL_ORIGIN_MOTION_FALLBACK_MS + 40);
}

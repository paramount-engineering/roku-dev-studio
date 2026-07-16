/**
 * Reveal + flash a single console/log row by its virtualizer index — the "jump to this occurrence"
 * landing used by the Console Monitor. Shared by the live Console and the windowed Log Viewer, which
 * differ only in how the caller maps a finding position to a view index (buffer index vs. file line):
 * both hand the resolved index here.
 *
 * The row may not be mounted the instant we scroll — the live Console mounts synchronously, but the
 * Log Viewer has to pull the byte window from the main process first — so after scrolling we poll
 * `getLineEl` briefly until the row exists, then flash it. Self-styling (mirrors the modal's
 * `ensureConsoleAnalyticsStyles`) so it works in either window without a shared stylesheet.
 */

import type { ConsoleLogFileViewHandle } from './console-log-file-view.js';

const FLASH_CLASS = 'console-occurrence-flash';
const FLASH_STYLE_ID = 'console-occurrence-flash-styles';
/** ~1.6s total: poll every 50ms for up to 30 tries while an async window load lands the row. */
const POLL_INTERVAL_MS = 50;
const POLL_MAX_TRIES = 30;

function ensureFlashStyles(): void {
  if (document.getElementById(FLASH_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = FLASH_STYLE_ID;
  style.textContent = `
    @keyframes console-occurrence-flash-kf {
      0%   { background-color: rgba(139, 92, 246, 0.55); }
      100% { background-color: rgba(139, 92, 246, 0); }
    }
    .${FLASH_CLASS} { animation: console-occurrence-flash-kf 1.8s ease-out; border-radius: 4px; }`;
  document.head.appendChild(style);
}

function flash(el: HTMLElement): void {
  el.classList.remove(FLASH_CLASS);
  void el.offsetWidth; // reflow so re-adding the class restarts the animation
  el.classList.add(FLASH_CLASS);
  window.setTimeout(() => el.classList.remove(FLASH_CLASS), 1900);
}

/**
 * Scroll `viewIndex` into view (centered) and briefly flash the row so the eye lands on it. The caller
 * has already resolved `viewIndex` into the view's row-index space and handled any stick-to-bottom
 * unpinning.
 */
export function revealAndFlashLine(view: ConsoleLogFileViewHandle, viewIndex: number): void {
  ensureFlashStyles();
  view.scrollToIndex(viewIndex, { align: 'center' });
  let tries = 0;
  const attempt = (): void => {
    const el = view.getLineEl(viewIndex);
    if (el) {
      flash(el);
      return;
    }
    if (tries++ < POLL_MAX_TRIES) window.setTimeout(attempt, POLL_INTERVAL_MS);
  };
  // Two RAFs let the virtualizer mount + measure before the first lookup (matches the find bar's
  // reveal timing); the poll then covers the Log Viewer's slower async window load.
  requestAnimationFrame(() => requestAnimationFrame(attempt));
}

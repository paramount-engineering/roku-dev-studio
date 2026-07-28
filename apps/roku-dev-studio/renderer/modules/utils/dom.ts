// DOM utility functions

import { I18N_DYNAMIC_ATTR } from '@shared/strings/i18n.js';

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Decode HTML entities without using innerHTML (avoids XSS surface).
 */
export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

/**
 * Set element content from HTML. Use only when html is already safe (e.g. built with escapeHtml).
 */
export function setSafeHTML(element: HTMLElement | null | undefined, html: string): void {
  if (element) element.innerHTML = html;
}

/**
 * Write live/dynamic content into an element and MARK it as JS-managed so `applyI18n` leaves
 * it alone.
 *
 * Elements that show a translated placeholder before real data arrives (e.g. a device header
 * "Loading…", a computed hint) carry a `data-i18n` attribute. Once JS replaces that placeholder
 * with dynamic data, a later `applyI18n(document)` retranslate pass (fired on a live locale
 * switch) would revert the element back to the placeholder — so these helpers stamp the element
 * with {@link I18N_DYNAMIC_ATTR}, which the applyI18n content passes skip. Use them instead of a
 * bare `textContent =` / `setSafeHTML` whenever the element started as a `data-i18n` placeholder.
 * `setDynamicText` sets text; `setDynamicHTML` sets (already-safe) markup. The `data-i18n` key is
 * left intact, so removing {@link I18N_DYNAMIC_ATTR} later would hand the element back to `applyI18n`
 * unchanged if it ever needs to toggle from live data back to a translatable placeholder.
 */
export function setDynamicText(element: Element | null | undefined, text: string): void {
  if (!(element instanceof HTMLElement)) return;
  element.textContent = text;
  element.setAttribute(I18N_DYNAMIC_ATTR, '');
}

export function setDynamicHTML(element: Element | null | undefined, html: string): void {
  if (!(element instanceof HTMLElement)) return;
  element.innerHTML = html;
  element.setAttribute(I18N_DYNAMIC_ATTR, '');
}

/** In-flight height tweens, keyed by element, so a re-render can cancel + restart cleanly. */
const heightTweens = new WeakMap<HTMLElement, () => void>();

/**
 * Run `mutate` (which changes `el`'s contents) and smoothly tween `el`'s height between its
 * before/after values instead of letting it snap. The mutation ALWAYS runs; the tween is skipped
 * (height snaps, as before) when the height is unchanged, the element is hidden/detached, or the
 * user prefers reduced motion. Re-entrant: a fresh call cancels any in-flight tween on the same
 * element and animates from its current (mid-tween) height. Uses explicit px heights, so it needs
 * no `interpolate-size` support.
 */
export function animateHeight(
  el: Element | null | undefined,
  mutate: () => void,
  durationMs = 200
): void {
  if (!(el instanceof HTMLElement)) {
    mutate();
    return;
  }
  const startH = el.getBoundingClientRect().height; // current height (may be mid-tween)
  heightTweens.get(el)?.(); // cancel any in-flight tween on this element

  // Clean slate so the mutation + target measurement see the natural layout.
  el.style.transition = '';
  el.style.height = '';
  el.style.overflow = '';

  mutate();

  const reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || startH === 0 || !el.isConnected) return;

  const endH = el.getBoundingClientRect().height;
  if (Math.abs(endH - startH) < 0.5) return;

  el.style.height = `${startH}px`;
  el.style.overflow = 'hidden';
  void el.offsetHeight; // commit the start height before transitioning
  el.style.transition = `height ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`;
  el.style.height = `${endH}px`;

  let timer = 0;
  const cleanup = (): void => {
    if (timer) clearTimeout(timer);
    el.style.transition = '';
    el.style.height = '';
    el.style.overflow = '';
    el.removeEventListener('transitionend', onEnd);
    heightTweens.delete(el);
  };
  const onEnd = (e: TransitionEvent): void => {
    if (e.target === el && e.propertyName === 'height') cleanup();
  };
  el.addEventListener('transitionend', onEnd);
  timer = window.setTimeout(cleanup, durationMs + 60);
  heightTweens.set(el, cleanup);
}

/**
 * Generate SVG icon HTML. Name/sizeClass/colorClass are escaped to prevent XSS.
 */
export function icon(name: string, sizeClass = 'icon-sm', colorClass = ''): string {
  const safeName = escapeHtml(String(name || ''));
  const safeSize = escapeHtml(String(sizeClass || 'icon-sm'));
  const safeColor = escapeHtml(String(colorClass || ''));
  const classes = ['icon', safeSize, safeColor].filter(Boolean).join(' ');
  return `<span class="${classes}"><svg><use href="#icon-${safeName}"/></svg></span>`;
}

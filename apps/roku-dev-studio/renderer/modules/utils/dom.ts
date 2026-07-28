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
 * left intact, so {@link clearDynamic} can hand the element back to `applyI18n` unchanged if it
 * ever toggles from live data back to a translatable placeholder.
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

/**
 * Reverse {@link setDynamicText}/{@link setDynamicHTML}: clear the dynamic marker so a later
 * `applyI18n(document)` pass retranslates the element from its (untouched) `data-i18n` key again.
 * Call this when an element goes from JS-managed live content back to a translatable placeholder;
 * set the placeholder text yourself for the immediate paint (the next applyI18n pass will keep it
 * in sync on subsequent locale switches).
 */
export function clearDynamic(element: Element | null | undefined): void {
  if (!(element instanceof HTMLElement)) return;
  element.removeAttribute(I18N_DYNAMIC_ATTR);
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

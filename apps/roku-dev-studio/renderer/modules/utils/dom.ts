// DOM utility functions

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
 * Generate SVG icon HTML. Name/sizeClass/colorClass are escaped to prevent XSS.
 */
export function icon(name: string, sizeClass = 'icon-sm', colorClass = ''): string {
  const safeName = escapeHtml(String(name || ''));
  const safeSize = escapeHtml(String(sizeClass || 'icon-sm'));
  const safeColor = escapeHtml(String(colorClass || ''));
  const classes = ['icon', safeSize, safeColor].filter(Boolean).join(' ');
  return `<span class="${classes}"><svg><use href="#icon-${safeName}"/></svg></span>`;
}

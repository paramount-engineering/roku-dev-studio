/**
 * Shared copy helpers for the Network Inspector detail panes, used by both the live tab and the
 * offline Session Viewer so the "what does Copy actually yield" rule and the copied-flash timing
 * stay identical.
 */
import type { ParsedNetworkEvent } from '@shared/network-inspector/types';

/**
 * Text to copy for a request/response pane. On the Body tab, prefer the event's full RAW body so
 * Copy yields the complete, un-truncated/un-formatted payload (returning `''` when the body is empty,
 * so a placeholder like "(no request body)" is never copied). Otherwise fall back to the pane's
 * visible rendered text (Overview/Headers, which have no single source string).
 */
export function paneBodyText(
  ev: ParsedNetworkEvent | null,
  which: 'request' | 'response',
  showingBody: boolean,
  bodyEl: Element | null
): string {
  if (ev && showingBody) {
    const raw = which === 'request' ? ev.httpRequest?.body : ev.httpResponse?.body;
    if (raw != null) return raw;
  }
  return bodyEl instanceof HTMLElement ? (bodyEl.innerText || bodyEl.textContent || '').trim() : '';
}

/** Brief "copied" affordance: add `is-copied` and remove it after `ms`. */
export function flashCopied(btn: HTMLElement | null, ms = 1400): void {
  if (!btn) return;
  btn.classList.add('is-copied');
  window.setTimeout(() => btn.classList.remove('is-copied'), ms);
}

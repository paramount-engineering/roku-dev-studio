// Response display and formatting (App Connector / RALE)
import { renderStructuredBody } from '../../modules/ui/structured-body.js';

/**
 * Display a RALE/App Connector response: a small timestamp line followed by the payload rendered as
 * a collapsible, syntax-highlighted JSON/XML tree (shared fold renderer). Non-structured payloads
 * fall back to plain text.
 */
export function displayResponse(
  responseOutput: HTMLElement,
  copyBtn: HTMLElement | null,
  data: unknown,
  isError = false
) {
  const content = typeof data === 'object' && data !== null ? JSON.stringify(data, null, 2) : String(data);

  responseOutput.replaceChildren();

  const ts = document.createElement('div');
  ts.className = 'rale-response-timestamp';
  ts.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
  ts.textContent = `[${new Date().toLocaleTimeString()}]`;
  responseOutput.appendChild(ts);

  const body = document.createElement('div');
  renderStructuredBody(body, content);
  responseOutput.appendChild(body);

  if (copyBtn) {
    copyBtn.style.display = 'inline-flex';
  }
}

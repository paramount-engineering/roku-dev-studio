// Response display and formatting
import { setSafeHTML } from '../../modules/utils/dom.js';

/**
 * Display response in output area
 */
export function displayResponse(
  responseOutput: HTMLElement,
  copyBtn: HTMLElement | null,
  data: unknown,
  isError = false
) {
  let content;
  if (typeof data === 'object') {
    content = JSON.stringify(data, null, 2);
  } else {
    content = String(data);
  }
  
  // Syntax highlight JSON
  const highlighted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span style="color: #9cdcfe;">"$1"</span>:')
    .replace(/: "([^"]+)"/g, ': <span style="color: #ce9178;">"$1"</span>')
    .replace(/: (\d+)/g, ': <span style="color: #b5cea8;">$1</span>')
    .replace(/: (true|false)/g, ': <span style="color: #569cd6;">$1</span>')
    .replace(/: (null)/g, ': <span style="color: #569cd6;">$1</span>');
  
  const timestamp = new Date().toLocaleTimeString();
  const color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
  const safeTimestamp = String(timestamp).replace(/[<>"&]/g, c => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' }[c] || c));
  setSafeHTML(responseOutput, '<div style="color: ' + color + '; margin-bottom: 8px; font-size: 10px;">[' + safeTimestamp + ']</div>' + highlighted);
  if (copyBtn) {
    copyBtn.style.display = 'inline-flex';
  }
}

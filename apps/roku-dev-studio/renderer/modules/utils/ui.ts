// UI utility functions
import { escapeHtml, setSafeHTML } from './dom.js';
import { STATUS_MESSAGE_DURATION, TOAST_DISPLAY_DURATION } from './constants.js';

type StatusType = 'info' | 'success' | 'error' | 'warning';

/**
 * Show a status message in an element
 */
export function showStatusMessage(
  element: HTMLElement,
  message: string,
  type: StatusType | string = 'info',
  autoHide = true
): void {
  const safeType = ['info', 'success', 'error', 'warning'].includes(type) ? (type as StatusType) : 'info';
  setSafeHTML(
    element,
    `
    <div class="status-message ${safeType}">
      ${escapeHtml(String(message ?? ''))}
    </div>
  `
  );

  if (autoHide) {
    setTimeout(() => {
      element.innerHTML = '';
    }, STATUS_MESSAGE_DURATION);
  }
}

/**
 * Show a toast notification. Pass `onClick` to make it navigable (e.g. jump to the device
 * that raised it) — the toast gets a pointer cursor and dismisses itself when clicked.
 */
export function showToast(message: string, type: StatusType | string = 'info', onClick?: () => void): void {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(container);
  }

  // Cap concurrent toasts so a looping caller can't fill the screen — drop the oldest.
  const MAX_TOASTS = 4;
  while (container.children.length >= MAX_TOASTS) container.firstElementChild?.remove();

  const toast = document.createElement('div');
  // Distinct color per tone: warning gets its own amber so a destructive/agent action no
  // longer reads identically to a neutral "info" (both were purple before).
  const bgColor =
    type === 'success'
      ? 'var(--accent-green)'
      : type === 'error'
        ? 'var(--accent-red)'
        : type === 'warning'
          ? 'var(--accent-amber-strong, #b45309)'
          : 'var(--accent-purple)';

  toast.style.cssText = `
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    max-width: 380px;
    word-break: break-word;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `;

  toast.textContent = message;
  const dismiss = (): void => {
    toast.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  };
  if (onClick) {
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', () => {
      try { onClick(); } catch { /* navigation is best-effort */ }
      dismiss();
    });
  }
  container.appendChild(toast);

  setTimeout(dismiss, TOAST_DISPLAY_DURATION);
}

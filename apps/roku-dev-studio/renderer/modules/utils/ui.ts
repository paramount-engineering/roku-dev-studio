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
 * Show a toast notification
 */
export function showToast(message: string, type: StatusType | string = 'info'): void {
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

  const toast = document.createElement('div');
  const bgColor =
    type === 'success'
      ? 'var(--accent-green)'
      : type === 'error'
        ? 'var(--accent-red)'
        : 'var(--accent-purple)';

  toast.style.cssText = `
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `;

  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, TOAST_DISPLAY_DURATION);
}

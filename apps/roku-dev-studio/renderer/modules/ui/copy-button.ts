// Reusable copy button handler
import { setSafeHTML } from '../utils/dom.js';
import { rendererError } from '../utils/logger.js';

export interface CopyButtonOptions {
  successText?: string;
  duration?: number;
}

/**
 * Setup a copy button that copies text to clipboard
 */
export function setupCopyButton(
  button: HTMLElement | null,
  getTextFn: (() => string) | string,
  options: CopyButtonOptions = {}
): void {
  if (!button) return;

  const { successText = '✓ Copied!', duration = 2000 } = options;

  const originalHTML = button.innerHTML;
  // Guard against rapid re-clicks: each click would otherwise start an overlapping
  // restore timer that races the button state (label + .copied class).
  let restoreTimer: ReturnType<typeof setTimeout> | null = null;

  button.addEventListener('click', async () => {
    const text = typeof getTextFn === 'function' ? getTextFn() : getTextFn;
    if (!text) return;

    try {
      if (!window.roku?.copyToClipboard) return;
      await window.roku.copyToClipboard(text);

      if (restoreTimer != null) clearTimeout(restoreTimer);
      button.textContent = successText;
      button.classList.add('copied');

      restoreTimer = setTimeout(() => {
        setSafeHTML(button, originalHTML);
        button.classList.remove('copied');
        restoreTimer = null;
      }, duration);
    } catch (error) {
      rendererError('Failed to copy to clipboard:', error);
    }
  });
}

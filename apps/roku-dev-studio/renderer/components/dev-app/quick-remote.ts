// Quick remote controls for Dev App + shared helper used by the Floating Remote

import type { DevAppApi, DevicePanelRoot } from './dev-app-types.js';

/** Options for `attachQuickRemoteKeys` shared between the Dev App card and the Floating Remote. */
export interface AttachQuickRemoteKeysOptions {
  /**
   * Element to dispatch the `homePressed` CustomEvent on. Dev App listens for
   * this on the device panel; the Floating Remote should still target the
   * active device panel even though the buttons live on the body-level shell.
   */
  dispatchHomePressedOn?: HTMLElement;
}

/**
 * Wire up the `.devapp-key` buttons and the `.devapp-text-input` / `.devapp-send-text-btn`
 * Send Text pair inside `root` to the given `api`. Idempotent — re-running
 * replaces previously-attached listeners by cloning each button node
 * (matches the original `setupQuickRemote` behavior). Used by both the Dev App
 * Quick Remote card and the body-level Floating Remote shell.
 */
export function attachQuickRemoteKeys(
  root: HTMLElement,
  api: DevAppApi,
  scheduleAutoScreenshot?: (delayMs?: number) => void,
  opts?: AttachQuickRemoteKeysOptions
): void {
  const homeTarget = opts?.dispatchHomePressedOn ?? root;
  const remoteButtons = root.querySelectorAll('.devapp-key');
  remoteButtons.forEach((btn: Element) => {
    const newBtn = btn.cloneNode(true) as HTMLElement;
    const parent = btn.parentNode;
    if (!parent) return;
    parent.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', async (e: Event) => {
      const me = e as MouseEvent;
      me.stopPropagation();
      me.preventDefault();

      const key = newBtn.dataset.key;
      if (!key) return;

      newBtn.classList.add('pressed');
      setTimeout(() => newBtn.classList.remove('pressed'), 150);

      try {
        const result = await api.keypress(key);
        if (!result.success) {
          console.error('Quick remote keypress failed:', result.error);
        } else {
          if (scheduleAutoScreenshot) {
            scheduleAutoScreenshot();
          }

          if (key === 'Home') {
            setTimeout(() => {
              homeTarget.dispatchEvent(new CustomEvent('homePressed', { bubbles: true }));
            }, 300);
          }
        }
      } catch (error) {
        console.error('Quick remote keypress error:', error);
      }
    });
  });

  const textInput = root.querySelector('.devapp-text-input');
  const sendTextBtn = root.querySelector('.devapp-send-text-btn');

  if (textInput instanceof HTMLInputElement && sendTextBtn instanceof HTMLElement) {
    const sendText = async () => {
      const text = textInput.value;
      if (!text) return;

      sendTextBtn.classList.add('pressed');

      try {
        for (const char of text) {
          await api.keypress(`Lit_${encodeURIComponent(char)}`);
        }
        textInput.value = '';
        if (scheduleAutoScreenshot) {
          scheduleAutoScreenshot();
        }
      } catch (error) {
        console.error('Quick remote send text error:', error);
      }

      setTimeout(() => sendTextBtn.classList.remove('pressed'), 150);
    };

    sendTextBtn.addEventListener('click', (e: Event) => {
      (e as MouseEvent).stopPropagation();
      sendText();
    });

    textInput.addEventListener('keypress', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter') {
        ke.preventDefault();
        sendText();
      }
    });
  }
}

/**
 * Setup the Dev App Quick Remote card on a device panel. Thin wrapper around
 * `attachQuickRemoteKeys` that targets the panel root and dispatches the
 * `homePressed` event on it (so the Dev App listener wired in
 * `components/dev-app/index.ts` keeps working).
 */
export function setupQuickRemote(
  panel: DevicePanelRoot,
  api: DevAppApi,
  scheduleAutoScreenshot?: (delayMs?: number) => void
): void {
  attachQuickRemoteKeys(panel, api, scheduleAutoScreenshot, {
    dispatchHomePressedOn: panel
  });
}

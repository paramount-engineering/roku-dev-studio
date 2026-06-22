// Quick remote controls for Dev App + shared helper used by the Floating Remote

import type { DevAppApi, DevicePanelRoot } from './dev-app-types.js';
import { SCREENSHOT_DEBOUNCE_DELAY } from '../../modules/utils/constants.js';
import { scheduleAutoScreenshotAfterSendText } from '../../modules/utils/keyboard-remote-auto-screenshot-registry.js';
import { rendererError } from '../../modules/utils/logger.js';

/** Options for `attachQuickRemoteKeys` shared between the Dev App card and the Floating Remote. */
export interface AttachQuickRemoteKeysOptions {
  /**
   * Element to dispatch the `homePressed` CustomEvent on. Dev App listens for
   * this on the device panel; the Floating Remote should still target the
   * active device panel even though the buttons live on the body-level shell.
   */
  dispatchHomePressedOn?: HTMLElement;
  /** Device panel root — used for auto-screenshot after Send Text when no explicit scheduler is passed (e.g. Floating Remote). */
  devicePanel?: HTMLElement;
}

const wiringAbortControllers = new WeakMap<HTMLElement, AbortController>();

/** Abort prior listeners on `root` and return a signal for a fresh wiring pass. */
function resetWiring(root: HTMLElement): AbortSignal {
  wiringAbortControllers.get(root)?.abort();
  const ac = new AbortController();
  wiringAbortControllers.set(root, ac);
  return ac.signal;
}

type InputTextApi = {
  inputText?: (text: string) => Promise<{ success?: boolean; error?: string }>;
  keypress?: (key: string) => Promise<{ success?: boolean; error?: string }>;
};

async function sendTextViaApi(api: InputTextApi, text: string): Promise<boolean> {
  if (typeof api.inputText === 'function') {
    const result = await api.inputText(text);
    if (!result || result.success !== true) {
      rendererError('Send text failed:', result?.error || result);
      return false;
    }
    return true;
  }
  if (typeof api.keypress !== 'function') {
    rendererError('Send text failed: API has no inputText or keypress');
    return false;
  }
  for (const char of text) {
    const result = await api.keypress(`Lit_${encodeURIComponent(char)}`);
    if (!result?.success) {
      rendererError('Send text failed:', result?.error || result);
      return false;
    }
  }
  return true;
}

/** Wire the Remote tab key buttons (solo + quad layouts). Scoped to the Remote inner tab only. */
export function wireRemoteTabKeyButtons(
  panel: HTMLElement,
  api: DevAppApi,
  scheduleAutoScreenshot: (delayMs?: number) => void,
  onHomePressed?: () => void
): void {
  const remoteRoot = panel.querySelector('.inner-tab-content[data-inner-content="remote"]');
  if (!(remoteRoot instanceof HTMLElement)) return;

  const signal = resetWiring(remoteRoot);
  const keyButtons = remoteRoot.querySelectorAll('[data-key]');

  keyButtons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    let isProcessing = false;

    const handlePress = async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (isProcessing) return;
      isProcessing = true;

      const key = btn.dataset.key;
      if (!key) {
        isProcessing = false;
        return;
      }

      btn.classList.add('pressed');

      try {
        const result = await api.keypress(key);
        if (result.success) {
          scheduleAutoScreenshot();
          if (key === 'Home' && onHomePressed) {
            setTimeout(onHomePressed, 300);
          }
        } else {
          rendererError('Remote keypress failed:', result.error);
        }
      } catch (error) {
        rendererError('Remote keypress error:', error);
      }

      setTimeout(() => {
        btn.classList.remove('pressed');
        isProcessing = false;
      }, 100);
    };

    btn.addEventListener('mousedown', handlePress, { signal });
    btn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        void handlePress(e);
      },
      { passive: false, signal }
    );
    btn.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
  });
}

/**
 * Send Text pair inside `root` to the given `api`. Idempotent — re-running aborts
 * prior listeners on `root` without cloning nodes (so typed text is preserved).
 * Used by both the Dev App Quick Remote card and the body-level Floating Remote shell.
 */
export function attachQuickRemoteKeys(
  root: HTMLElement,
  api: DevAppApi,
  scheduleAutoScreenshot?: (delayMs?: number) => void,
  opts?: AttachQuickRemoteKeysOptions
): void {
  const signal = resetWiring(root);
  const homeTarget = opts?.dispatchHomePressedOn ?? root;
  const remoteButtons = root.querySelectorAll('.devapp-key');
  remoteButtons.forEach((btn: Element) => {
    if (!(btn instanceof HTMLElement)) return;

    btn.addEventListener(
      'click',
      async (e: Event) => {
        const me = e as MouseEvent;
        me.stopPropagation();
        me.preventDefault();

        const key = btn.dataset.key;
        if (!key) return;

        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 150);

        try {
          const result = await api.keypress(key);
          if (!result.success) {
            rendererError('Quick remote keypress failed:', result.error);
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
          rendererError('Quick remote keypress error:', error);
        }
      },
      { signal }
    );
  });

  const textInput = root.querySelector('.devapp-text-input');
  const sendTextBtn = root.querySelector('.devapp-send-text-btn');

  if (textInput instanceof HTMLInputElement && sendTextBtn instanceof HTMLElement) {
    wireSendTextControls(textInput, sendTextBtn, api, signal, {
      scheduleAutoScreenshot,
      devicePanel: opts?.devicePanel,
    });
  }
}

/** Wire the Remote tab `.text-input` / `.send-text-btn` pair (solo + quad layouts). */
export function wireRemoteTabSendText(
  panel: HTMLElement,
  api: InputTextApi,
  scheduleAutoScreenshot: (delayMs?: number) => void
): void {
  const section = panel.querySelector(
    '.inner-tab-content[data-inner-content="remote"] .text-input-section'
  );
  if (!(section instanceof HTMLElement)) return;

  const textInput = section.querySelector('.text-input');
  const sendTextBtn = section.querySelector('.send-text-btn');
  if (!(textInput instanceof HTMLInputElement) || !(sendTextBtn instanceof HTMLButtonElement)) {
    return;
  }

  const signal = resetWiring(section);
  const sendTextLabel = sendTextBtn.querySelector('.send-text-btn-label');

  wireSendTextControls(textInput, sendTextBtn, api, signal, {
    scheduleAutoScreenshot,
    onSendingChange: (sending) => {
      sendTextBtn.disabled = sending;
      if (sendTextLabel instanceof HTMLElement) {
        sendTextLabel.textContent = sending ? 'Sending...' : 'Send Text';
      }
    },
  });
}

interface WireSendTextControlsOptions {
  scheduleAutoScreenshot?: (delayMs?: number) => void;
  devicePanel?: HTMLElement;
  onSendingChange?: (sending: boolean) => void;
}

function wireSendTextControls(
  textInput: HTMLInputElement,
  sendTextBtn: HTMLElement,
  api: InputTextApi,
  signal: AbortSignal,
  opts: WireSendTextControlsOptions
): void {
  let sendInFlight = false;

  const sendText = async () => {
    if (sendInFlight) return;
    const text = textInput.value;
    if (!text) return;

    sendInFlight = true;
    opts.onSendingChange?.(true);
    sendTextBtn.classList.add('pressed');

    try {
      const ok = await sendTextViaApi(api, text);
      if (!ok) return;

      textInput.value = '';
      const screenshotDelay = SCREENSHOT_DEBOUNCE_DELAY;
      if (opts.scheduleAutoScreenshot) {
        opts.scheduleAutoScreenshot(screenshotDelay);
      } else if (opts.devicePanel) {
        scheduleAutoScreenshotAfterSendText(opts.devicePanel, screenshotDelay);
      }
    } catch (error) {
      rendererError('Send text error:', error);
    } finally {
      sendInFlight = false;
      opts.onSendingChange?.(false);
      setTimeout(() => sendTextBtn.classList.remove('pressed'), 150);
    }
  };

  sendTextBtn.addEventListener(
    'click',
    (e: Event) => {
      (e as MouseEvent).stopPropagation();
      void sendText();
    },
    { signal }
  );

  textInput.addEventListener(
    'keydown',
    (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter') {
        ke.preventDefault();
        void sendText();
      }
    },
    { signal }
  );
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

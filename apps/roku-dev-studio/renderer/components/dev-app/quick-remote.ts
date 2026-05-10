// Quick remote controls for Dev App

import { icon } from '../../modules/utils/index.js';
import type { DevAppApi, DevicePanelRoot } from './dev-app-types.js';

/**
 * Setup quick remote controls
 * @param {HTMLElement} panel - Device panel
 * @param {Object} api - API adapter
 * @param {Function} scheduleAutoScreenshot - Function to schedule auto screenshot
 */
export function setupQuickRemote(
  panel: DevicePanelRoot,
  api: DevAppApi,
  scheduleAutoScreenshot?: (delayMs?: number) => void
) {
  // Setup Quick Remote buttons in Dev App
  const devappRemoteButtons = panel.querySelectorAll('.devapp-key');
  devappRemoteButtons.forEach((btn: Element) => {
    // Remove any existing listeners by cloning the button
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
      
      // Visual feedback
      newBtn.classList.add('pressed');
      setTimeout(() => newBtn.classList.remove('pressed'), 150);
      
      try {
        const result = await api.keypress(key);
        if (!result.success) {
          console.error('Quick remote keypress failed:', result.error);
        } else {
          // Schedule auto screenshot after successful keypress
          if (scheduleAutoScreenshot) {
            scheduleAutoScreenshot();
          }
          
          // If Home was pressed, check if dev app exited
          if (key === 'Home') {
            setTimeout(() => {
              panel.dispatchEvent(new CustomEvent('homePressed', { bubbles: true }));
            }, 300);
          }
        }
      } catch (error) {
        console.error('Quick remote keypress error:', error);
      }
    });
  });
  
  // Setup Send Text in Quick Remote
  const devappTextInput = panel.querySelector('.devapp-text-input');
  const devappSendTextBtn = panel.querySelector('.devapp-send-text-btn');
  
  if (devappTextInput instanceof HTMLInputElement && devappSendTextBtn instanceof HTMLElement) {
    const sendText = async () => {
      const text = devappTextInput.value;
      if (!text) return;
      
      devappSendTextBtn.classList.add('pressed');
      
      try {
        for (const char of text) {
          await api.keypress(`Lit_${encodeURIComponent(char)}`);
        }
        devappTextInput.value = '';
        // Schedule auto screenshot after sending text
        if (scheduleAutoScreenshot) {
          scheduleAutoScreenshot();
        }
      } catch (error) {
        console.error('Quick remote send text error:', error);
      }
      
      setTimeout(() => devappSendTextBtn.classList.remove('pressed'), 150);
    };
    
    devappSendTextBtn.addEventListener('click', (e: Event) => {
      (e as MouseEvent).stopPropagation();
      sendText();
    });

    devappTextInput.addEventListener('keypress', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter') {
        ke.preventDefault();
        sendText();
      }
    });
  }
}

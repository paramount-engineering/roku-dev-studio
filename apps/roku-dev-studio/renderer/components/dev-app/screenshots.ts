// Screenshot functionality

import { icon, setSafeHTML } from '../../modules/utils/index.js';
import { showStatusMessage } from '../../modules/utils/ui.js';
import { SCREENSHOT_DEBOUNCE_DELAY } from '../../modules/utils/constants.js';
import {
  AGENT_SCREENSHOT_EVENT,
  type AgentScreenshotDetail
} from '../../modules/mcp-bridge-client.js';
import type { DevAppApi, DevicePanelRoot, ScreenshotElements } from './dev-app-types.js';
import { errMessage } from './dev-app-types.js';
import { rendererError } from '../../modules/utils/logger.js';
import { S } from '@shared/strings/index.js';

/**
 * Setup screenshot functionality
 * @param {HTMLElement} panel - Device panel
 * @param {Object} api - API adapter
 * @param {Object} elements - UI elements
 * @param {Function} getPassword - Function to get current password
 * @param {Function} isAuthenticated - Function to check if authenticated
 * @returns {{ scheduleAutoScreenshot: Function, setDevAppAllowsCapture: Function }}
 */
export function setupScreenshots(
  panel: DevicePanelRoot,
  api: DevAppApi,
  elements: ScreenshotElements,
  getPassword: () => string,
  isAuthenticated: () => boolean
) {
  const {
    screenshotBtn,
    copyScreenshotBtn,
    saveScreenshotBtn,
    clearScreenshotBtn,
    screenshotStatus,
    screenshotImage,
    screenshotPlaceholder,
    autoScreenshotCheckbox
  } = elements;
  
  let currentScreenshotUrl = '';
  let currentScreenshotTempFile = '';
  let screenshotDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let devAppAllowsCapture = false;
  let captureInProgress = false;

  const CAPTURE_DISABLED_TITLE = S.devApp.captureDisabledTitle;

  function updateScreenshotCaptureButtonState() {
    if (!screenshotBtn) return;
    screenshotBtn.disabled = captureInProgress || !devAppAllowsCapture;
    screenshotBtn.title = devAppAllowsCapture ? '' : CAPTURE_DISABLED_TITLE;
  }

  /** Enable Capture only when the dev channel (id=dev) is the active app. */
  function setDevAppAllowsCapture(allowed: boolean) {
    devAppAllowsCapture = !!allowed;
    updateScreenshotCaptureButtonState();
  }

  setDevAppAllowsCapture(false);
  
  // Show/hide screenshot buttons (Copy / Download / Clear appear once there's an image)
  function showScreenshotButtons(show: boolean) {
    const display = show ? 'inline-flex' : 'none';
    if (copyScreenshotBtn) copyScreenshotBtn.style.display = display;
    if (saveScreenshotBtn) saveScreenshotBtn.style.display = display;
    if (clearScreenshotBtn) clearScreenshotBtn.style.display = display;
  }
  
  // Capture screenshot
  if (screenshotBtn) {
    screenshotBtn.addEventListener('click', async () => {
      if (!devAppAllowsCapture) {
        showStatusMessage(screenshotStatus, S.devApp.launchBeforeCapture, 'warning');
        return;
      }
      const password = getPassword();
      if (!password) {
        showStatusMessage(screenshotStatus, S.devApp.pleaseEnterDeveloperPassword, 'warning');
        return;
      }

      captureInProgress = true;
      updateScreenshotCaptureButtonState();
      screenshotBtn.textContent = S.devApp.capturing;
      screenshotStatus.innerHTML = '';
      
      try {
        const result = await api.screenshot(password);
        if (result.success) {
          showStatusMessage(screenshotStatus, '✓ ' + result.message, 'success');
          const url = result.url ?? '';
          currentScreenshotUrl = url;
          currentScreenshotTempFile = result.tempFile || '';
          screenshotImage.src = url;
          screenshotImage.style.display = 'block';
          if (screenshotPlaceholder) screenshotPlaceholder.style.display = 'none';
          showScreenshotButtons(true);
        } else {
          showStatusMessage(screenshotStatus, '✗ ' + result.error, 'error');
        }
      } catch (error: unknown) {
        showStatusMessage(screenshotStatus, '✗ ' + errMessage(error), 'error');
      }

      captureInProgress = false;
      updateScreenshotCaptureButtonState();
      setSafeHTML(screenshotBtn, icon('camera', 'icon-xs') + ' ' + S.devApp.capture);
    });
  }
  
  // ── Copy / Save / Clear actions ──────────────────────────────────────────────────────────────
  // Extracted from the button handlers so the right-click context menu can trigger the exact same
  // behavior (see the `contextmenu` handler below).

  /** Copy the current screenshot to the clipboard as a PNG. Throws on failure (caller reports it). */
  async function copyScreenshotToClipboard(): Promise<void> {
    if (!currentScreenshotUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = currentScreenshotUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
    if (!blob) throw new Error('Could not encode screenshot');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }

  /** Save the current screenshot to a file via the native dialog. Reports its own status. */
  async function saveScreenshotToFile(): Promise<void> {
    if (!currentScreenshotUrl) return;
    try {
      const result = await window.roku.saveScreenshot(currentScreenshotTempFile, currentScreenshotUrl);
      if (result.success) {
        showStatusMessage(screenshotStatus, S.devApp.savedTo(result.filePath), 'success');
      } else if (result.error !== 'Save cancelled') {
        showStatusMessage(screenshotStatus, '✗ ' + result.error, 'error');
      }
    } catch (error: unknown) {
      showStatusMessage(screenshotStatus, '✗ ' + errMessage(error), 'error');
    }
  }

  /** Clear the current screenshot — drop the image and return to the placeholder. */
  function clearScreenshot(): void {
    currentScreenshotUrl = '';
    currentScreenshotTempFile = '';
    screenshotImage.removeAttribute('src');
    screenshotImage.style.display = 'none';
    if (screenshotPlaceholder) screenshotPlaceholder.style.display = '';
    screenshotStatus.innerHTML = '';
    showScreenshotButtons(false);
  }

  // Copy screenshot (button) — copy + a brief "Copied!" flash on the button itself.
  if (copyScreenshotBtn) {
    copyScreenshotBtn.addEventListener('click', async () => {
      if (!currentScreenshotUrl) return;
      try {
        await copyScreenshotToClipboard();
        copyScreenshotBtn.title = S.devApp.copiedTitle;
        setSafeHTML(copyScreenshotBtn, icon('check', 'icon-xs'));
        setTimeout(() => {
          copyScreenshotBtn.title = S.devApp.copyScreenshot;
          setSafeHTML(copyScreenshotBtn, icon('copy', 'icon-xs'));
        }, 2000);
      } catch (error: unknown) {
        showStatusMessage(screenshotStatus, S.devApp.failedToCopy(errMessage(error)), 'error');
      }
    });
  }

  // Save screenshot (button)
  if (saveScreenshotBtn) {
    saveScreenshotBtn.addEventListener('click', () => void saveScreenshotToFile());
  }

  // Clear screenshot (button)
  if (clearScreenshotBtn) {
    clearScreenshotBtn.addEventListener('click', clearScreenshot);
  }

  // Right-click the screenshot preview → the same Copy / Save / Clear actions as the toolbar buttons,
  // shown only when there's a screenshot (matching the buttons' visibility). Uses the native menu via
  // the main process (`window.roku.showContextMenu`), consistent with the device card + Network Inspector.
  // NOTE: action names avoid the literal `'copy'`, which the main handler treats as a built-in TEXT
  // clipboard write (it would blank the clipboard); we do the image copy in the renderer instead.
  const screenshotContainer = screenshotImage.closest('.screenshot-container');
  if (screenshotContainer instanceof HTMLElement) {
    screenshotContainer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!currentScreenshotUrl) return; // nothing to act on — no menu, mirrors the hidden buttons
      void (async () => {
        const items = [
          { label: S.devApp.copyScreenshot, action: 'copy-screenshot' },
          { label: S.devApp.saveScreenshotAs, action: 'save-screenshot' },
          { type: 'separator' },
          { label: S.devApp.clearScreenshot, action: 'clear-screenshot' }
        ];
        let res: { action?: string } | null = null;
        try {
          res = (await window.roku.showContextMenu(items)) as { action?: string } | null;
        } catch {
          return;
        }
        if (res?.action === 'copy-screenshot') {
          try {
            await copyScreenshotToClipboard();
            showStatusMessage(screenshotStatus, S.devApp.copiedToClipboard, 'success');
          } catch (error: unknown) {
            showStatusMessage(screenshotStatus, S.devApp.failedToCopy(errMessage(error)), 'error');
          }
        } else if (res?.action === 'save-screenshot') {
          await saveScreenshotToFile();
        } else if (res?.action === 'clear-screenshot') {
          clearScreenshot();
        }
      })();
    });
  }

  // Debounced screenshot function for auto-screenshot
  async function takeAutoScreenshot() {
    if (!autoScreenshotCheckbox || !autoScreenshotCheckbox.checked) return;
    if (!isAuthenticated()) return;
    if (!devAppAllowsCapture) return;
    
    const password = getPassword();
    if (!password) return;
    
    try {
      const result = await api.screenshot(password);
      if (result.success) {
        const url = result.url ?? '';
        currentScreenshotUrl = url;
        currentScreenshotTempFile = result.tempFile || '';
        if (screenshotImage) {
          screenshotImage.src = url;
          screenshotImage.style.display = 'block';
        }
        if (screenshotPlaceholder) screenshotPlaceholder.style.display = 'none';
        showScreenshotButtons(true);
      }
    } catch (error: unknown) {
      rendererError('Auto screenshot error:', error);
    }
  }
  
  // Schedule auto screenshot (optional delay — use longer after Dev App Launch)
  function scheduleAutoScreenshot(delayMs = SCREENSHOT_DEBOUNCE_DELAY) {
    if (screenshotDebounceTimer) {
      clearTimeout(screenshotDebounceTimer);
    }
    screenshotDebounceTimer = setTimeout(takeAutoScreenshot, delayMs);
  }

  /**
   * MCP agents that call the `screenshot` tool dispatch an AGENT_SCREENSHOT_EVENT
   * on the matching device panel so the pane updates without the user clicking
   * Capture. Mirrors the local-click code path above.
   */
  panel.addEventListener(AGENT_SCREENSHOT_EVENT as keyof HTMLElementEventMap, (event) => {
    const detail = (event as CustomEvent<AgentScreenshotDetail>).detail;
    if (!detail || typeof detail.dataUrl !== 'string' || !detail.dataUrl) return;
    currentScreenshotUrl = detail.dataUrl;
    currentScreenshotTempFile = '';
    if (screenshotImage) {
      screenshotImage.src = detail.dataUrl;
      screenshotImage.style.display = 'block';
    }
    if (screenshotPlaceholder) screenshotPlaceholder.style.display = 'none';
    showScreenshotButtons(true);
  });

  return { scheduleAutoScreenshot, setDevAppAllowsCapture };
}

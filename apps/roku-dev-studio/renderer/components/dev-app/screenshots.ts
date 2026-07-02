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

  const CAPTURE_DISABLED_TITLE = 'Launch the sideloaded Dev App on the device to capture a screenshot.';

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
        showStatusMessage(screenshotStatus, 'Launch the Dev App on the device before capturing a screenshot.', 'warning');
        return;
      }
      const password = getPassword();
      if (!password) {
        showStatusMessage(screenshotStatus, 'Please enter your developer password', 'warning');
        return;
      }
      
      captureInProgress = true;
      updateScreenshotCaptureButtonState();
      screenshotBtn.textContent = 'Capturing...';
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
      setSafeHTML(screenshotBtn, icon('camera', 'icon-xs') + ' Capture');
    });
  }
  
  // Copy screenshot
  if (copyScreenshotBtn) {
    copyScreenshotBtn.addEventListener('click', async () => {
      if (!currentScreenshotUrl) return;
      try {
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
        copyScreenshotBtn.title = 'Copied!';
        setSafeHTML(copyScreenshotBtn, icon('check', 'icon-xs'));
        setTimeout(() => {
          copyScreenshotBtn.title = 'Copy screenshot';
          setSafeHTML(copyScreenshotBtn, icon('copy', 'icon-xs'));
        }, 2000);
      } catch (error: unknown) {
        showStatusMessage(screenshotStatus, 'Failed to copy: ' + errMessage(error), 'error');
      }
    });
  }
  
  // Save screenshot
  if (saveScreenshotBtn) {
    saveScreenshotBtn.addEventListener('click', async () => {
      if (!currentScreenshotUrl) return;
      try {
        const result = await window.roku.saveScreenshot(currentScreenshotTempFile, currentScreenshotUrl);
        if (result.success) {
          showStatusMessage(screenshotStatus, '✓ Saved to: ' + result.filePath, 'success');
        } else if (result.error !== 'Save cancelled') {
          showStatusMessage(screenshotStatus, '✗ ' + result.error, 'error');
        }
      } catch (error: unknown) {
        showStatusMessage(screenshotStatus, '✗ ' + errMessage(error), 'error');
      }
    });
  }

  // Clear screenshot — drop the current image and return to the placeholder.
  if (clearScreenshotBtn) {
    clearScreenshotBtn.addEventListener('click', () => {
      currentScreenshotUrl = '';
      currentScreenshotTempFile = '';
      screenshotImage.removeAttribute('src');
      screenshotImage.style.display = 'none';
      if (screenshotPlaceholder) screenshotPlaceholder.style.display = '';
      screenshotStatus.innerHTML = '';
      showScreenshotButtons(false);
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

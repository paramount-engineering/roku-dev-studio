// Screenshot functionality

import { icon, setSafeHTML } from '../../modules/utils/index.js';
import { showStatusMessage } from '../../modules/utils/ui.js';
import { SCREENSHOT_DEBOUNCE_DELAY } from '../../modules/utils/constants.js';
import {
  AGENT_SCREENSHOT_EVENT,
  type AgentScreenshotDetail
} from '../../modules/mcp-bridge-client.js';
import type { DevAppApi, DevicePanelRoot, RceSessionScreenshot, ScreenshotElements } from './dev-app-types.js';
import { errMessage, isRceDevice } from './dev-app-types.js';
import { rendererError } from '../../modules/utils/logger.js';
import { flyScreenshotToHistory } from './screenshot-fly-animation.js';
import { openRceScreenshotGalleryModal } from './rce-screenshot-gallery-modal.js';
import type { RceVideoHandle } from '../../modules/rce/rce-video.js';
import { S } from '@shared/strings/index.js';

let sessionScreenshotIdCounter = 0;

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
    autoScreenshotCheckbox,
    videoElement,
    galleryBtn
  } = elements;

  const isRce = isRceDevice(api);

  let currentScreenshotUrl = '';
  let currentScreenshotTempFile = '';
  let screenshotDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let devAppAllowsCapture = false;
  let captureInProgress = false;
  // Every screenshot captured this session (design doc §8's gallery, originally RCE-only, now
  // populated for every device kind), in-memory, cleared on teardown.
  const sessionScreenshots: RceSessionScreenshot[] = [];
  let rceVideoHandle: RceVideoHandle | null = null;

  const CAPTURE_DISABLED_TITLE = S.devApp.captureDisabledTitle;

  function updateScreenshotCaptureButtonState() {
    if (!screenshotBtn) return;
    screenshotBtn.disabled = captureInProgress || !devAppAllowsCapture;
    screenshotBtn.title = devAppAllowsCapture ? '' : CAPTURE_DISABLED_TITLE;
  }

  /** Enable Capture only when the dev channel (id=dev) is the active app. RCE has no such
   *  gate — design doc §8: "Capture should just always be enabled while the stream is live." */
  function setDevAppAllowsCapture(allowed: boolean) {
    devAppAllowsCapture = isRce ? true : !!allowed;
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
  
  /** Writes a `data:` URL to a temp file via the main process, for capture paths that don't
   *  already get one from a device call (canvas frame-grab, agent-driven). Best-effort — returns
   *  '' on any failure, in which case the caller keeps holding the raw `data:` URL instead. */
  async function persistToTempFile(dataUrl: string): Promise<string> {
    try {
      const result = await window.roku.persistScreenshotDataUrl(dataUrl);
      return result?.success ? result.tempFile || '' : '';
    } catch {
      return '';
    }
  }

  /** What actually gets stored/displayed for a capture — a `file://` reference once a temp file
   *  exists, so `sessionScreenshots` never holds the full base64 payload resident for the tab's
   *  whole lifetime. Falls back to the raw `data:` URL only when persisting to disk failed. */
  function displayUrlFor(url: string, tempFile: string): string {
    return tempFile ? `file://${tempFile}` : url;
  }

  function pushSessionScreenshot(url: string, tempFile?: string): string {
    const id = `shot-${++sessionScreenshotIdCounter}`;
    sessionScreenshots.unshift({ id, url, tempFile: tempFile || undefined, capturedAt: Date.now() });
    return id;
  }

  function getSessionScreenshots(): RceSessionScreenshot[] {
    return sessionScreenshots;
  }

  function removeSessionScreenshot(id: string): void {
    const index = sessionScreenshots.findIndex((s) => s.id === id);
    if (index === -1) return;
    const [removed] = sessionScreenshots.splice(index, 1);
    if (removed.tempFile) {
      void window.roku.deleteScreenshotTempFile(removed.tempFile);
      // The main card's Save/Copy still default to this exact tempFile/url — leaving them as-is
      // would let a subsequent Save silently write the now-deleted temp file's stale `file://`
      // reference through as a bogus `dataUrl`, reporting success on a corrupted file.
      if (removed.tempFile === currentScreenshotTempFile) clearScreenshot();
    }
  }

  function removeAllSessionScreenshots(): void {
    if (currentScreenshotTempFile && sessionScreenshots.some((s) => s.tempFile === currentScreenshotTempFile)) {
      clearScreenshot();
    }
    for (const shot of sessionScreenshots) {
      if (shot.tempFile) void window.roku.deleteScreenshotTempFile(shot.tempFile);
    }
    sessionScreenshots.length = 0;
  }

  /** Open the session gallery modal, optionally scrolled to and highlighting one shot (the
   *  fly-animation thumbnail's own click — see the RCE capture handler below). `opener` grows the
   *  modal from wherever the user actually clicked (the gallery button, or the flying thumbnail
   *  mid-flight) per this repo's shared modal-motion convention. */
  function openGallery(focusShotId?: string, opener?: HTMLElement | null): void {
    openRceScreenshotGalleryModal(
      getSessionScreenshots,
      copyScreenshotToClipboard,
      saveScreenshotToFile,
      removeSessionScreenshot,
      removeAllSessionScreenshots,
      undefined,
      opener ?? galleryBtn ?? null,
      focusShotId
    );
  }

  if (galleryBtn) {
    galleryBtn.addEventListener('click', () => openGallery());
  }

  /** RCE fallback: grab the current video frame instead of a device call — no password gate. Used
   *  only when the direct RCE screenshot call (captureViaDeviceCall) is unavailable or fails.
   *  Returns true on success so the caller knows whether to open the preview modal. */
  async function captureRceFrame(): Promise<boolean> {
    if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight || !rceVideoHandle) {
      showStatusMessage(screenshotStatus, S.devApp.rceStreamNotReady, 'warning');
      return false;
    }
    const url = rceVideoHandle.captureFrame();
    if (!url) {
      showStatusMessage(screenshotStatus, '✗ ' + S.devApp.couldNotGetCanvasContext, 'error');
      return false;
    }
    const tempFile = await persistToTempFile(url);
    currentScreenshotUrl = displayUrlFor(url, tempFile);
    currentScreenshotTempFile = tempFile;
    showStatusMessage(screenshotStatus, '✓ ' + S.devApp.captureSuccess, 'success');
    pushSessionScreenshot(currentScreenshotUrl, tempFile);
    return true;
  }

  /** Shared device-call capture used by physical devices and RCE's direct network call. On
   *  success, records the shot in the session history for every device kind, but only displays it
   *  inline in the card for physical/LAN devices — RCE never writes into the card's `<img>` (it
   *  overlaps the live video), instead flying a thumbnail of the fresh capture into the gallery
   *  button (see the click handler below). On failure, reports the error unless `silent` (RCE
   *  calls this quietly first, then falls back to captureRceFrame). */
  async function captureViaDeviceCall(password: string, silent: boolean): Promise<boolean> {
    captureInProgress = true;
    updateScreenshotCaptureButtonState();
    screenshotBtn!.textContent = S.devApp.capturing;
    screenshotStatus.innerHTML = '';

    let success = false;
    try {
      const result = await api.screenshot!(password);
      if (result.success) {
        const tempFile = result.tempFile || '';
        currentScreenshotUrl = displayUrlFor(result.url ?? '', tempFile);
        currentScreenshotTempFile = tempFile;
        if (isRce) {
          showStatusMessage(screenshotStatus, '✓ ' + result.message, 'success');
        } else {
          showStatusMessage(screenshotStatus, '✓ ' + result.message, 'success');
          screenshotImage.src = currentScreenshotUrl;
          screenshotImage.style.display = 'block';
          if (screenshotPlaceholder) screenshotPlaceholder.style.display = 'none';
          showScreenshotButtons(true);
        }
        pushSessionScreenshot(currentScreenshotUrl, tempFile);
        success = true;
      } else if (!silent) {
        showStatusMessage(screenshotStatus, '✗ ' + result.error, 'error');
      }
    } catch (error: unknown) {
      if (!silent) showStatusMessage(screenshotStatus, '✗ ' + errMessage(error), 'error');
    }

    captureInProgress = false;
    updateScreenshotCaptureButtonState();
    setSafeHTML(screenshotBtn!, icon('camera', 'icon-xs') + ' ' + S.devApp.capture);
    return success;
  }

  // Capture screenshot
  if (screenshotBtn) {
    screenshotBtn.addEventListener('click', async () => {
      if (isRce) {
        // Try the real RCE device screenshot first (same plugin_inspect call physical devices use,
        // proxied through the instance's /sideload path); Screen Relay's live-frame grab is only a
        // fallback for when the device call is unavailable, not the primary path anymore. Either
        // way, the live video area only ever shows video, never a captured image overlaid on top
        // of it — the capture instead flies a thumbnail into the gallery/history button (Copy/Save
        // for it live there, per-thumbnail, in the session gallery).
        const password = getPassword();
        let success = password ? await captureViaDeviceCall(password, /* silent */ true) : false;
        if (!success) success = await captureRceFrame();
        if (success) {
          // pushSessionScreenshot (inside captureViaDeviceCall/captureRceFrame above) always
          // unshifts, so the shot this capture just created is the freshest entry.
          const shotId = sessionScreenshots[0]?.id;
          flyScreenshotToHistory(currentScreenshotUrl, screenshotBtn, galleryBtn ?? null, screenshotBtn.closest('.card'), (thumb) =>
            openGallery(shotId, thumb)
          );
        }
        return;
      }
      if (!devAppAllowsCapture) {
        showStatusMessage(screenshotStatus, S.devApp.launchBeforeCapture, 'warning');
        return;
      }
      const password = getPassword();
      if (!password) {
        showStatusMessage(screenshotStatus, S.devApp.pleaseEnterDeveloperPassword, 'warning');
        return;
      }
      await captureViaDeviceCall(password, /* silent */ false);
    });
  }
  
  // ── Copy / Save / Clear actions ──────────────────────────────────────────────────────────────
  // Extracted from the button handlers so the right-click context menu can trigger the exact same
  // behavior (see the `contextmenu` handler below).

  /** Copy a screenshot to the clipboard as a PNG. Defaults to the current one; the RCE gallery
   *  passes a specific thumbnail's URL instead (design doc §8: per-thumbnail Copy/Save/Clear).
   *  Throws on failure (caller reports it). */
  async function copyScreenshotToClipboard(url: string = currentScreenshotUrl): Promise<void> {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(S.devApp.couldNotGetCanvasContext);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
    if (!blob) throw new Error(S.devApp.couldNotEncodeScreenshot);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }

  /** Save a screenshot to a file via the native dialog. Defaults to the current one/tempFile; the
   *  gallery passes a specific thumbnail's own `url`/`tempFile` pair instead (every capture path
   *  has a tempFile now — see `persistToTempFile`/`displayUrlFor` above). Reports its own status. */
  async function saveScreenshotToFile(url: string = currentScreenshotUrl, tempFile: string = currentScreenshotTempFile): Promise<void> {
    if (!url) return;
    try {
      const result = await window.roku.saveScreenshot(tempFile, url);
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

  // Debounced screenshot function for auto-screenshot. Not meaningful for RCE — the live video
  // already shows everything continuously, there's no ECP round trip to schedule.
  async function takeAutoScreenshot() {
    if (isRce) return;
    if (!autoScreenshotCheckbox || !autoScreenshotCheckbox.checked) return;
    if (!isAuthenticated()) return;
    if (!devAppAllowsCapture) return;

    const password = getPassword();
    if (!password) return;

    try {
      const result = await api.screenshot!(password);
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
    void (async () => {
      const tempFile = await persistToTempFile(detail.dataUrl);
      currentScreenshotUrl = displayUrlFor(detail.dataUrl, tempFile);
      currentScreenshotTempFile = tempFile;
      // RCE: never write into screenshotImage — it overlaps the live video (see captureViaDeviceCall's
      // doc comment). Just record it in the history; an agent-driven capture shouldn't pop a modal.
      if (!isRce) {
        if (screenshotImage) {
          screenshotImage.src = currentScreenshotUrl;
          screenshotImage.style.display = 'block';
        }
        if (screenshotPlaceholder) screenshotPlaceholder.style.display = 'none';
        showScreenshotButtons(true);
      }
      pushSessionScreenshot(currentScreenshotUrl, tempFile);
    })();
  });

  // Deletes every remaining temp file this panel's captures wrote to disk when its tab closes —
  // otherwise only an explicit Save (or the next app-launch startup sweep, see
  // startup-temp-cleanup.ts) would ever unlink them for a screenshot the user never cleared.
  panel._screenshotsCleanup = () => {
    removeAllSessionScreenshots();
  };

  return {
    scheduleAutoScreenshot,
    setDevAppAllowsCapture,
    setRceVideoHandle: (handle: RceVideoHandle | null): void => {
      rceVideoHandle = handle;
    }
  };
}

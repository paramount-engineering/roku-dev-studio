// Dev App component - Main setup function

import { setupPasswordAuth } from './password-auth.js';
import { setupSideloading } from './sideloading.js';
import { setupScreenshots } from './screenshots.js';
import { setupSideloadedApp } from './sideloaded-app.js';
import { setupQuickRemote } from './quick-remote.js';
import { registerKeyboardRemoteAutoScreenshotDevApp } from '../../modules/utils/keyboard-remote-auto-screenshot-registry.js';
import { rendererError } from '../../modules/utils/logger.js';
import { attachRceVideo, type RceVideoStatus } from '../../modules/rce/rce-video.js';
import { showStatusMessage } from '../../modules/utils/ui.js';
import { icon, setSafeHTML } from '../../modules/utils/index.js';
import { S } from '@shared/strings/index.js';
import type {
  DevAppApi,
  DevAppDevice,
  DevPasswordVerifiedDetail,
  DevicePanelRoot,
  InnertabSwitchDetail
} from './dev-app-types.js';
import { isRceDevice } from './dev-app-types.js';

/**
 * Setup dev app component
 * @param {DevicePanelRoot} panel - Device panel
 * @param {Object} device - Device info
 * @param {Object} api - API adapter
 */
export function setupDevApp(panel: DevicePanelRoot, device: DevAppDevice, api: DevAppApi) {
  // Live, not a one-time snapshot: `device` is the same object `checkDeviceConnection`
  // (renderer/app.ts) mutates in place on every health check, so a device opened via Sideload
  // Relay auto-connect (no serial yet) picks up the real serial once that check fetches it.
  const getSerialNumber = (): string | undefined => device.serialNumber;

  const passwordInput = panel.querySelector('.dev-password');
  const verifyPasswordBtn = panel.querySelector('.verify-password-btn');
  const authStatus = panel.querySelector('.auth-status');
  const selectFileBtn = panel.querySelector('.select-file-btn');
  const fileNameSpan = panel.querySelector('.selected-file-name');
  const filePathInput = panel.querySelector('.sideload-file-path');
  const sideloadBtn = panel.querySelector('.sideload-btn');
  const deleteBtn = panel.querySelector('.delete-sideload-btn');
  const launchSideloadBtn = panel.querySelector('.launch-sideload-btn');
  const statusDiv = panel.querySelector('.sideload-status');
  const progressDiv = panel.querySelector('.sideload-progress');
  const progressText = panel.querySelector('.progress-text');
  const rememberCheckbox = panel.querySelector('.remember-password-checkbox');
  const deleteStatusDiv = panel.querySelector('.delete-sideload-status');
  const sideloadedAppCard = panel.querySelector('.sideloaded-app-card');
  const sideloadedAppDetails = panel.querySelector('.sideloaded-app-details');
  const refreshSideloadedBtn = panel.querySelector('.refresh-sideloaded-btn');
  const screenshotBtn = panel.querySelector('.screenshot-btn');
  const copyScreenshotBtn = panel.querySelector('.copy-screenshot-btn');
  const saveScreenshotBtn = panel.querySelector('.save-screenshot-btn');
  const clearScreenshotBtn = panel.querySelector('.clear-screenshot-btn');
  const screenshotStatus = panel.querySelector('.screenshot-status');
  const screenshotImage = panel.querySelector('.screenshot-image');
  const screenshotPlaceholder = panel.querySelector('.screenshot-placeholder');
  const autoScreenshotCheckbox = panel.querySelector('.auto-screenshot-checkbox');
  const dropZone = panel.querySelector('.install-drop-zone');
  const selectedFileInfo = panel.querySelector('.selected-file-info');
  const clearFileBtn = panel.querySelector('.clear-file-btn');
  const rceVideoStream = panel.querySelector('.rce-video-stream');
  const rceVideoControls = panel.querySelector('.rce-video-controls');
  const rceVideoVolume = panel.querySelector('.rce-video-volume');
  const rceVideoVolumeValue = panel.querySelector('.rce-video-volume-value');
  const rceGalleryBtn = panel.querySelector('.rce-gallery-btn');

  if (
    !(passwordInput instanceof HTMLInputElement) ||
    !(selectFileBtn instanceof HTMLElement) ||
    !(sideloadBtn instanceof HTMLButtonElement) ||
    !(statusDiv instanceof HTMLElement) ||
    !(progressDiv instanceof HTMLElement) ||
    !(screenshotStatus instanceof HTMLElement) ||
    !(screenshotImage instanceof HTMLImageElement) ||
    !(sideloadedAppCard instanceof HTMLElement) ||
    !(sideloadedAppDetails instanceof HTMLElement)
  ) {
    rendererError('Dev app elements not found');
    return;
  }

  // Auto-enable screenshot for remote devices
  if (autoScreenshotCheckbox instanceof HTMLInputElement && api.isRemote) {
    autoScreenshotCheckbox.checked = true;
  }

  const passwordAuth = setupPasswordAuth(
    panel,
    api,
    {
      passwordInput,
      verifyPasswordBtn: verifyPasswordBtn instanceof HTMLButtonElement ? verifyPasswordBtn : null,
      authStatus: authStatus instanceof HTMLElement ? authStatus : null,
      rememberCheckbox: rememberCheckbox instanceof HTMLInputElement ? rememberCheckbox : null
    },
    getSerialNumber
  );

  const screenshots = setupScreenshots(
    panel,
    api,
    {
      screenshotBtn: screenshotBtn instanceof HTMLButtonElement ? screenshotBtn : null,
      copyScreenshotBtn: copyScreenshotBtn instanceof HTMLButtonElement ? copyScreenshotBtn : null,
      saveScreenshotBtn: saveScreenshotBtn instanceof HTMLButtonElement ? saveScreenshotBtn : null,
      clearScreenshotBtn: clearScreenshotBtn instanceof HTMLButtonElement ? clearScreenshotBtn : null,
      screenshotStatus,
      screenshotImage,
      screenshotPlaceholder: screenshotPlaceholder instanceof HTMLElement ? screenshotPlaceholder : null,
      autoScreenshotCheckbox: autoScreenshotCheckbox instanceof HTMLInputElement ? autoScreenshotCheckbox : null,
      videoElement: rceVideoStream instanceof HTMLVideoElement ? rceVideoStream : null,
      galleryBtn: rceGalleryBtn instanceof HTMLButtonElement ? rceGalleryBtn : null
    },
    passwordAuth.getPassword,
    passwordAuth.isAuthenticated
  );
  const { scheduleAutoScreenshot, setDevAppAllowsCapture } = screenshots;

  registerKeyboardRemoteAutoScreenshotDevApp(panel, scheduleAutoScreenshot);

  // "Wake Device" / "Dev Mode" quick actions (mirrors Roku's own RCE dashboard) — RCE-only, no
  // physical/LAN-relay equivalent. Independent of the video-feed setup below (device.id/accountName
  // guards there are about claiming the live video, not needed just to show these two buttons).
  const rceActionsRow = panel.querySelector('.devapp-rce-actions-row');
  if (rceActionsRow instanceof HTMLElement) rceActionsRow.hidden = !isRceDevice(api);

  // Screenshot history gallery — originally RCE-only, now available for every device kind since
  // captureViaDeviceCall (screenshots.ts) pushes every successful capture into the session list
  // regardless of api.kind. The gallery-button click itself, plus the fly-thumbnail's own click,
  // are both wired inside setupScreenshots (screenshots.ts) since they share all of its internal
  // session-screenshot state.

  // RCE live video (design doc §7/§8) — replaces the Screenshot card's `<img>` with the live feed,
  // renames the card (it's a video relay, not a screenshot), and moves Copy/Save/Clear out in
  // favor of a mute+volume control (per-capture actions live in the session gallery wired above
  // instead — a captured shot always pops its own preview modal for RCE, see screenshots.ts).
  if (
    isRceDevice(api) &&
    rceVideoStream instanceof HTMLVideoElement &&
    rceVideoControls instanceof HTMLElement &&
    device.id != null &&
    device.accountName
  ) {
    // Rebind to non-null aliases — TS narrowing from the `if` guard above doesn't flow into the
    // nested `renderMuteButtonState`/event-handler closures below (same pattern used elsewhere in
    // this codebase, e.g. `setupRemoteLocationModal`'s `const locationModal = modal;`).
    const videoEl = rceVideoStream;
    const controlsEl = rceVideoControls;
    if (screenshotImage) screenshotImage.style.display = 'none';
    if (screenshotPlaceholder instanceof HTMLElement) screenshotPlaceholder.style.display = 'none';
    videoEl.style.display = 'block';
    controlsEl.style.display = 'flex';

    const cardTitleEl = panel.querySelector('.devapp-col-right .card-title');
    if (cardTitleEl instanceof HTMLElement) {
      cardTitleEl.removeAttribute('data-i18n');
      cardTitleEl.textContent = S.devApp.rceDeviceScreenRelay;
    }
    // The card-icon left of the title is a camera by default (Screenshot mode) — swap it for the
    // app's canonical screen/device glyph once this becomes Screen Relay. `card-icon--tv` exists
    // solely for the optical-centering nudge below (see its CSS comment) — scoped so it never
    // touches the default camera-icon case, which doesn't have this glyph's asymmetry.
    const cardIconEl = panel.querySelector('.devapp-col-right .card-icon');
    if (cardIconEl instanceof HTMLElement) {
      setSafeHTML(cardIconEl, icon('tv', 'icon-sm'));
      cardIconEl.classList.add('card-icon--tv');
    }
    // Copy/Save/Clear act on a single "current" screenshot, which has no equivalent for a live
    // feed — the session gallery's per-thumbnail actions replace them entirely for RCE.
    const screenshotActionsEl = panel.querySelector('.devapp-col-right .screenshot-actions');
    if (screenshotActionsEl instanceof HTMLElement) screenshotActionsEl.style.display = 'none';

    const rceVideoMuteBtn = panel.querySelector('.rce-video-mute-btn');
    function renderMuteButtonState(): void {
      if (!(rceVideoMuteBtn instanceof HTMLButtonElement)) return;
      const muted = videoEl.muted || videoEl.volume === 0;
      setSafeHTML(rceVideoMuteBtn, icon(muted ? 'volume-x' : 'volume', 'icon-xs'));
      rceVideoMuteBtn.title = muted ? S.devApp.rceUnmuteLabel : S.devApp.rceMuteLabel;
      rceVideoMuteBtn.setAttribute('aria-label', rceVideoMuteBtn.title);
      // Dim the slider + value rather than swap their text — the numeric value still reflects
      // what volume unmuting will restore, this just makes clear audio isn't playing right now.
      controlsEl.classList.toggle('is-muted', muted);
    }
    renderMuteButtonState();

    // Always-on readout (both here and in the floating remote, which borrows this same node —
    // see floating-remote.ts) — a fixed-width span so showing it never resizes the slider next to
    // it (that resize-on-hide was the previous "flash only while dragging" behavior).
    function renderVolumeValueText(): void {
      if (!(rceVideoVolumeValue instanceof HTMLElement) || !(rceVideoVolume instanceof HTMLInputElement)) return;
      rceVideoVolumeValue.textContent = `${Math.round(Number(rceVideoVolume.value))}%`;
    }
    renderVolumeValueText();

    if (rceVideoVolume instanceof HTMLInputElement) {
      rceVideoVolume.addEventListener('input', () => {
        const value = Number(rceVideoVolume.value) / 100;
        videoEl.volume = value;
        videoEl.muted = value === 0;
        renderMuteButtonState();
        renderVolumeValueText();
      });
    }
    if (rceVideoMuteBtn instanceof HTMLButtonElement) {
      // Toggle mute without losing the slider's volume level — unmuting restores whatever the
      // slider was already set to, rather than jumping to some fixed "last volume" guess.
      rceVideoMuteBtn.addEventListener('click', () => {
        videoEl.muted = !videoEl.muted;
        if (!videoEl.muted && videoEl.volume === 0) {
          videoEl.volume = 1;
          if (rceVideoVolume instanceof HTMLInputElement) rceVideoVolume.value = '100';
        }
        renderMuteButtonState();
        renderVolumeValueText();
      });
    }

    const onVideoStatus = (status: RceVideoStatus, error?: string) => {
      if (!screenshotStatus) return;
      if (status === 'connecting') showStatusMessage(screenshotStatus, S.devApp.rceVideoConnecting, 'warning');
      else if (status === 'reconnecting') showStatusMessage(screenshotStatus, S.devApp.rceVideoReconnecting, 'warning');
      else if (status === 'stopped') showStatusMessage(screenshotStatus, S.devApp.rceVideoStopped, 'warning');
      else if (status === 'error') showStatusMessage(screenshotStatus, '✗ ' + S.devApp.rceVideoError(error ?? ''), 'error');
      else screenshotStatus.innerHTML = '';
    };

    const videoHandle = attachRceVideo(videoEl, device.accountName, device.id, onVideoStatus);
    screenshots.setRceVideoHandle(videoHandle);
    panel._rceVideoCleanup = () => {
      screenshots.setRceVideoHandle(null);
      videoHandle.stop();
    };
  }

  const sideloadedApp = setupSideloadedApp(
    panel,
    api,
    {
      sideloadedAppCard,
      sideloadedAppDetails,
      refreshSideloadedBtn: refreshSideloadedBtn instanceof HTMLButtonElement ? refreshSideloadedBtn : null,
      deleteBtn: deleteBtn instanceof HTMLButtonElement ? deleteBtn : null,
      launchSideloadBtn: launchSideloadBtn instanceof HTMLButtonElement ? launchSideloadBtn : null
    },
    scheduleAutoScreenshot,
    setDevAppAllowsCapture
  );

  setupSideloading(
    panel,
    api,
    {
      selectFileBtn,
      fileNameSpan: fileNameSpan instanceof HTMLElement ? fileNameSpan : null,
      filePathInput: filePathInput instanceof HTMLInputElement ? filePathInput : null,
      sideloadBtn,
      deleteBtn: deleteBtn instanceof HTMLButtonElement ? deleteBtn : null,
      statusDiv,
      progressDiv,
      progressText: progressText instanceof HTMLElement ? progressText : null,
      rememberCheckbox: rememberCheckbox instanceof HTMLInputElement ? rememberCheckbox : null,
      deleteStatusDiv: deleteStatusDiv instanceof HTMLElement ? deleteStatusDiv : null,
      dropZone: dropZone instanceof HTMLElement ? dropZone : null,
      selectedFileInfo: selectedFileInfo instanceof HTMLElement ? selectedFileInfo : null,
      clearFileBtn: clearFileBtn instanceof HTMLButtonElement ? clearFileBtn : null
    },
    getSerialNumber,
    passwordAuth.getPassword,
    sideloadedApp.checkSideloadedApp,
    // Same scheduler the Launch button uses — gated on auto-screenshot
    // checkbox + auth status inside the scheduler.
    scheduleAutoScreenshot
  );

  setupQuickRemote(panel, api, scheduleAutoScreenshot);

  panel.addEventListener('innertabswitch', (e: Event) => {
    const ce = e as CustomEvent<InnertabSwitchDetail>;
    if (ce.detail.tab === 'devapp') {
      void sideloadedApp.checkSideloadedApp();
      const devApp1Pass = panel.querySelector('.dev-password');
      if (devApp1Pass instanceof HTMLInputElement && devApp1Pass.value && !passwordInput.value) {
        passwordInput.value = devApp1Pass.value;
        void passwordAuth.verifyPassword();
      }
    }
  });

  panel.addEventListener('dev-password-verified', (e: Event) => {
    const ce = e as CustomEvent<DevPasswordVerifiedDetail>;
    if (!ce.detail || ce.detail.password == null) return;
    passwordInput.value = ce.detail.password;
    if (rememberCheckbox instanceof HTMLInputElement) {
      rememberCheckbox.checked = !!ce.detail.remember;
    }
    passwordAuth.setAuthenticatedState(true);
  });
}

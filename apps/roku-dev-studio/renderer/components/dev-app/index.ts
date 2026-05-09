// Dev App component - Main setup function

import { setupPasswordAuth } from './password-auth.js';
import { setupSideloading } from './sideloading.js';
import { setupScreenshots } from './screenshots.js';
import { setupSideloadedApp } from './sideloaded-app.js';
import { setupQuickRemote } from './quick-remote.js';
import { registerKeyboardRemoteAutoScreenshotDevApp } from '../../modules/utils/keyboard-remote-auto-screenshot-registry.js';
import type {
  DevAppApi,
  DevAppDevice,
  DevPasswordVerifiedDetail,
  DevicePanelRoot,
  InnertabSwitchDetail
} from './dev-app-types.js';

/**
 * Setup dev app component
 * @param {DevicePanelRoot} panel - Device panel
 * @param {Object} device - Device info
 * @param {Object} api - API adapter
 */
export function setupDevApp(panel: DevicePanelRoot, device: DevAppDevice, api: DevAppApi) {
  const serialNumber = device.serialNumber;

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
  const screenshotStatus = panel.querySelector('.screenshot-status');
  const screenshotImage = panel.querySelector('.screenshot-image');
  const screenshotPlaceholder = panel.querySelector('.screenshot-placeholder');
  const autoScreenshotCheckbox = panel.querySelector('.auto-screenshot-checkbox');
  const dropZone = panel.querySelector('.install-drop-zone');
  const selectedFileInfo = panel.querySelector('.selected-file-info');
  const clearFileBtn = panel.querySelector('.clear-file-btn');

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
    console.error('Dev app elements not found');
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
    serialNumber
  );

  const { scheduleAutoScreenshot, setDevAppAllowsCapture } = setupScreenshots(
    panel,
    api,
    {
      screenshotBtn: screenshotBtn instanceof HTMLButtonElement ? screenshotBtn : null,
      copyScreenshotBtn: copyScreenshotBtn instanceof HTMLButtonElement ? copyScreenshotBtn : null,
      saveScreenshotBtn: saveScreenshotBtn instanceof HTMLButtonElement ? saveScreenshotBtn : null,
      screenshotStatus,
      screenshotImage,
      screenshotPlaceholder: screenshotPlaceholder instanceof HTMLElement ? screenshotPlaceholder : null,
      autoScreenshotCheckbox: autoScreenshotCheckbox instanceof HTMLInputElement ? autoScreenshotCheckbox : null
    },
    passwordAuth.getPassword,
    passwordAuth.isAuthenticated
  );

  registerKeyboardRemoteAutoScreenshotDevApp(panel, scheduleAutoScreenshot);

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
    serialNumber,
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

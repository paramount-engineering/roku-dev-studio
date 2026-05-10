// Sideloading functionality

import { icon, escapeHtml, decodeHtmlEntities, setSafeHTML } from '../../modules/utils/index.js';
import { showStatusMessage } from '../../modules/utils/ui.js';
import { savePassword, removePassword, getStoredPassword } from '../../modules/utils/storage.js';
import { SCREENSHOT_AFTER_LAUNCH_DELAY } from '../../modules/utils/constants.js';
import type { DevAppApi, DevicePanelRoot, SideloadElements } from './dev-app-types.js';
import { errMessage } from './dev-app-types.js';
import {
  pollDevAppForegroundAfterLaunch,
  pollDevAppForegroundOnce
} from './dev-app-foreground-sync.js';

/**
 * Setup sideloading functionality
 * @param {HTMLElement} panel - Device panel
 * @param {Object} api - API adapter
 * @param {Object} elements - UI elements
 * @param {string} serialNumber - Device serial number
 * @param {Function} getPassword - Function to get current password
 * @param {Function} checkSideloadedApp - Function to check sideloaded app
 * @param {Function} [scheduleAutoScreenshot] - (delayMs?) => void. Called after a
 *   successful sideload once the Dev App becomes foreground, matching the Launch
 *   button behavior. Internally gated on the Auto Screenshot checkbox + password
 *   auth success — safe to call unconditionally.
 */
export function setupSideloading(
  panel: DevicePanelRoot,
  api: DevAppApi,
  elements: SideloadElements,
  serialNumber: string | undefined,
  getPassword: () => string,
  checkSideloadedApp: () => void | Promise<void>,
  scheduleAutoScreenshot?: (delayMs?: number) => void
) {
  const {
    selectFileBtn,
    fileNameSpan,
    filePathInput,
    sideloadBtn,
    deleteBtn,
    statusDiv,
    progressDiv,
    rememberCheckbox,
    deleteStatusDiv,
    dropZone,
    selectedFileInfo,
    clearFileBtn
  } = elements;
  
  // Store selected file path for remote sideloading
  let selectedFilePath = '';
  
  // Update drop zone text for remote devices
  if (api.isRemote && dropZone) {
    setSafeHTML(dropZone, `
      <div class="drop-zone-icon">📤</div>
      <div class="drop-zone-text">Remote Sideloading</div>
      <div class="drop-zone-hint" style="max-width: 280px; line-height: 1.4;">
        Select a .zip or .pkg file from your computer.<br>
        It will be uploaded to the remote server and installed.
      </div>
    `);
  }
  
  // Function to update sideload button state
  function updateSideloadButton() {
    const hasFile = selectedFilePath || (filePathInput && filePathInput.value.trim());
    const hasPassword = getPassword();
    sideloadBtn.disabled = !(hasFile && hasPassword);
  }
  
  // Listen for password changes
  const passwordInput = panel.querySelector('.dev-password');
  if (passwordInput) {
    passwordInput.addEventListener('input', updateSideloadButton);
  }
  
  // File selection
  selectFileBtn.addEventListener('click', async () => {
    const result = await window.roku.selectSideloadFile();
    if (result && result.success) {
      selectedFilePath = result.filePath;
      if (filePathInput) filePathInput.value = result.filePath;
      const sizeKB = (result.fileSize / 1024).toFixed(1);
      const sizeMB = (result.fileSize / (1024 * 1024)).toFixed(2);
      const sizeText = result.fileSize > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
      
      if (fileNameSpan) {
        fileNameSpan.textContent = `${result.fileName} (${sizeText})`;
        fileNameSpan.title = result.filePath;
        fileNameSpan.classList.add('has-file');
      }
      
      // Show selected file info, hide drop zone
      if (dropZone) dropZone.style.display = 'none';
      if (selectedFileInfo) selectedFileInfo.style.display = 'flex';
      
      updateSideloadButton();
    }
  });
  
  // Clear file selection
  if (clearFileBtn) {
    clearFileBtn.addEventListener('click', () => {
      selectedFilePath = '';
      if (filePathInput) filePathInput.value = '';
      if (fileNameSpan) {
        fileNameSpan.textContent = '';
        fileNameSpan.classList.remove('has-file');
      }
      if (dropZone) dropZone.style.display = 'block';
      if (selectedFileInfo) selectedFileInfo.style.display = 'none';
      updateSideloadButton();
    });
  }
  
  // Sideload
  sideloadBtn.addEventListener('click', async () => {
    const filePath = selectedFilePath || (filePathInput ? filePathInput.value.trim() : '');
    const password = getPassword();
    
    if (!filePath || !password) {
      showStatusMessage(statusDiv, 'Please select a file and enter your developer password', 'warning');
      return;
    }
    
    sideloadBtn.disabled = true;
    sideloadBtn.textContent = api.isRemote ? 'Uploading & Installing...' : 'Installing...';
    progressDiv.style.display = 'block';
    statusDiv.innerHTML = '';
    let sideloadSucceeded = false;

    try {
      const result = await api.sideload(filePath, password);
      progressDiv.style.display = 'none';
      
      if (result.success) {
        sideloadSucceeded = true;
        showStatusMessage(statusDiv, '✓ ' + result.message, 'success');
        if (rememberCheckbox && rememberCheckbox.checked && serialNumber) {
          savePassword(serialNumber, password);
        }
        // Reset file selection on success
        selectedFilePath = '';
        if (filePathInput) filePathInput.value = '';
        if (fileNameSpan) {
          fileNameSpan.textContent = '';
          fileNameSpan.classList.remove('has-file');
        }
        if (dropZone) dropZone.style.display = 'block';
        if (selectedFileInfo) selectedFileInfo.style.display = 'none';
      } else {
        showStatusMessage(statusDiv, '✗ ' + result.error, 'error');
        // If the device rejected the password *and* that password matches the
        // one we had persisted, the stored copy is stale (e.g. user changed
        // the developer password on the device) — wipe it so subsequent
        // RDS actions don't silently retry with a bad credential. If the user
        // just typed a wrong password manually (stored !== password), leave
        // the stored copy alone.
        if (result.authFailed && serialNumber) {
          const stored = getStoredPassword(serialNumber);
          if (stored && stored === password) {
            removePassword(serialNumber);
          }
        }
      }
    } catch (error: unknown) {
      progressDiv.style.display = 'none';
      showStatusMessage(statusDiv, '✗ ' + (errMessage(error) || 'Unknown error'), 'error');
    }
    
    setSafeHTML(sideloadBtn, icon('rocket', 'icon-xs') + ' Install App');
    sideloadBtn.disabled = false;
    updateSideloadButton();
    setTimeout(() => {
      void (async () => {
        await Promise.resolve(checkSideloadedApp());
        if (sideloadSucceeded) {
          // Roku's sideload flow auto-launches the Dev App. Wait for it to
          // come to the foreground, then fire the same auto-screenshot as a
          // manual Launch so a fresh install ships a capture without the
          // user having to click anything.
          const foreground = await pollDevAppForegroundAfterLaunch(panel, api, {
            attempts: 6,
            intervalMs: 450
          });
          if (foreground && scheduleAutoScreenshot) {
            scheduleAutoScreenshot(SCREENSHOT_AFTER_LAUNCH_DELAY);
          }
        }
      })();
    }, 500);
  });
  
  // Delete
  if (deleteBtn && deleteStatusDiv) {
    const delStatus = deleteStatusDiv;
    deleteBtn.addEventListener('click', async () => {
      const password = getPassword();
      if (!password) {
        showStatusMessage(delStatus, 'Please enter your developer password', 'warning');
        return;
      }
      if (!confirm('Delete sideloaded channel?')) return;

      deleteBtn.disabled = true;
      deleteBtn.style.opacity = '0.5';
      let deleteSucceeded = false;

      try {
        const result = await api.deleteSideload(password);
        if (result.success) {
          deleteSucceeded = true;
          showStatusMessage(delStatus, '✓ ' + result.message, 'success');
        } else {
          showStatusMessage(delStatus, '✗ ' + result.error, 'error');
          if (result.authFailed && serialNumber) {
            const stored = getStoredPassword(serialNumber);
            if (stored && stored === password) {
              removePassword(serialNumber);
            }
          }
        }
      } catch (error: unknown) {
        showStatusMessage(delStatus, '✗ ' + errMessage(error), 'error');
      }

      deleteBtn.disabled = false;
      deleteBtn.style.opacity = '1';
      setTimeout(() => {
        void (async () => {
          await Promise.resolve(checkSideloadedApp());
          if (deleteSucceeded) {
            await pollDevAppForegroundOnce(panel, api);
          }
        })();
      }, 500);
    });
  }
}

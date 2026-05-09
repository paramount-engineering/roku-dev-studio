// Password authentication management

import { icon, setSafeHTML } from '../../modules/utils/index.js';
import { getStoredPassword, savePassword, removePassword } from '../../modules/utils/storage.js';
import type { DevAppApi, DevicePanelRoot, PasswordAuthElements } from './dev-app-types.js';

/**
 * Setup password authentication
 * @param {HTMLElement} panel - Device panel
 * @param {Object} api - API adapter
 * @param {Object} elements - UI elements
 * @param {string} serialNumber - Device serial number
 * @returns {Object} Authentication state and functions
 */
export function setupPasswordAuth(
  panel: DevicePanelRoot,
  api: DevAppApi,
  elements: PasswordAuthElements,
  serialNumber: string | undefined
) {
  const {
    passwordInput,
    verifyPasswordBtn,
    authStatus,
    rememberCheckbox
  } = elements;
  
  let isAuthenticated = false;
  
  // Update authentication status display (and optionally persist remember state)
  function updateAuthStatus(authenticated: boolean) {
    isAuthenticated = authenticated;
    if (authStatus) {
      if (authenticated) {
        setSafeHTML(authStatus, icon('circle', 'icon-xs', 'icon-green') + ' Authenticated');
        authStatus.className = 'auth-status authenticated';
      } else {
        setSafeHTML(authStatus, icon('circle', 'icon-xs', 'icon-red') + ' Not Authenticated');
        authStatus.className = 'auth-status not-authenticated';
      }
    }

    if (authenticated && rememberCheckbox && rememberCheckbox.checked && serialNumber) {
      savePassword(serialNumber, passwordInput.value.trim());
    } else if (!rememberCheckbox?.checked && serialNumber) {
      removePassword(serialNumber);
    }
  }

  /** Set authenticated state from outside (e.g. Import Action Script modal) without calling API. */
  function setAuthenticatedState(authenticated: boolean) {
    isAuthenticated = authenticated;
    if (authStatus) {
      if (authenticated) {
        setSafeHTML(authStatus, icon('circle', 'icon-xs', 'icon-green') + ' Authenticated');
        authStatus.className = 'auth-status authenticated';
      } else {
        setSafeHTML(authStatus, icon('circle', 'icon-xs', 'icon-red') + ' Not Authenticated');
        authStatus.className = 'auth-status not-authenticated';
      }
    }
  }
  
  // Verify password
  async function verifyPassword() {
    const password = passwordInput.value.trim();
    if (!password) {
      updateAuthStatus(false);
      return false;
    }
    
    if (verifyPasswordBtn) {
      verifyPasswordBtn.disabled = true;
      verifyPasswordBtn.textContent = '...';
    }
    
    try {
      const result = await api.verifyDevAuth(password);

      if (!result) {
        updateAuthStatus(false);
        if (verifyPasswordBtn) {
          verifyPasswordBtn.disabled = false;
          verifyPasswordBtn.textContent = 'Verify';
        }
        return false;
      }

      const authOk = !!result.success;
      updateAuthStatus(authOk);

      // Stored-password invalidation. If the Roku rejected the exact password
      // we had persisted (i.e. what we just auto-loaded, or what the user
      // left in the field after loading), wipe it so we don't silently retry
      // a known-bad credential next time. A manually-typed password that
      // doesn't match the stored one is left alone — the stored copy might
      // still be correct.
      if (!authOk && result.authFailed && serialNumber) {
        const stored = getStoredPassword(serialNumber);
        if (stored && stored === password) {
          removePassword(serialNumber);
          if (rememberCheckbox) rememberCheckbox.checked = false;
        }
      }

      // Sync to Dev App 1
      const devApp1Password = panel.querySelector('.dev-password');
      if (authOk && devApp1Password instanceof HTMLInputElement) {
        devApp1Password.value = password;
      }
      
      if (verifyPasswordBtn) {
        verifyPasswordBtn.disabled = false;
        verifyPasswordBtn.textContent = 'Verify';
      }
      return authOk;
    } catch (e) {
      updateAuthStatus(false);
      if (verifyPasswordBtn) {
        verifyPasswordBtn.disabled = false;
        verifyPasswordBtn.textContent = 'Verify';
      }
      return false;
    }
  }
  
  // Event handlers
  if (verifyPasswordBtn) {
    verifyPasswordBtn.addEventListener('click', verifyPassword);
  }
  
  // Load stored password
  if (serialNumber) {
    const storedPassword = getStoredPassword(serialNumber);
    if (storedPassword) {
      passwordInput.value = storedPassword;
      if (rememberCheckbox) rememberCheckbox.checked = true;
      setTimeout(() => verifyPassword(), 500);
    }
  }
  
  // Handle remember checkbox changes
  if (rememberCheckbox) {
    rememberCheckbox.addEventListener('change', () => {
      if (rememberCheckbox.checked && isAuthenticated && serialNumber) {
        savePassword(serialNumber, passwordInput.value.trim());
      } else if (!rememberCheckbox.checked && serialNumber) {
        removePassword(serialNumber);
      }
    });
  }
  
  passwordInput.addEventListener('blur', () => {
    if (passwordInput.value.trim()) {
      verifyPassword();
    } else {
      updateAuthStatus(false);
    }
  });
  
  return {
    isAuthenticated: () => isAuthenticated,
    verifyPassword,
    getPassword: () => passwordInput.value.trim(),
    setAuthenticatedState
  };
}

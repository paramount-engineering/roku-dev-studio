// Password authentication management

import { icon, setSafeHTML, escapeHtml } from '../../modules/utils/index.js';
import { getStoredPassword, savePassword, removePassword } from '../../modules/utils/storage.js';
import type { DevAppApi, DevicePanelRoot, PasswordAuthElements } from './dev-app-types.js';
import { registerPanelRetranslate } from '../../modules/ui/retranslate-registry.js';
import { S } from '@shared/strings/index.js';

/**
 * Setup password authentication
 * @param {HTMLElement} panel - Device panel
 * @param {Object} api - API adapter
 * @param {Object} elements - UI elements
 * @param {Function} getSerialNumber - Live device serial number getter. A device opened via
 *   Sideload Relay auto-connect starts with no serial at all (a minimal fallback object) even
 *   though a later health check fetches the real one — a plain `string | undefined` parameter
 *   would freeze that "no serial yet" snapshot for the panel's whole lifetime, so this reads
 *   fresh at every use instead. The initial "load stored password" check re-runs (once) via the
 *   `device-info-refreshed` listener below when the serial actually becomes known.
 * @returns {Object} Authentication state and functions
 */
export function setupPasswordAuth(
  panel: DevicePanelRoot,
  api: DevAppApi,
  elements: PasswordAuthElements,
  getSerialNumber: () => string | undefined
) {
  const {
    passwordInput,
    verifyPasswordBtn,
    authStatus,
    rememberCheckbox
  } = elements;
  
  let isAuthenticated = false;
  
  function formatAuthStatusLabel(authenticated: boolean, detail?: string): string {
    if (authenticated) {
      return icon('circle', 'icon-xs', 'icon-green') + ' ' + S.devApp.authenticated;
    }
    const base = icon('circle', 'icon-xs', 'icon-red') + ' ' + S.devApp.notAuthenticated;
    if (detail) {
      // `detail` can be a device/API-supplied error string — escape it before
      // it lands in the HTML passed to `setSafeHTML` (the title attribute path
      // uses textContent and is already safe).
      return `${base} — ${escapeHtml(detail)}`;
    }
    return base;
  }

  // Update authentication status display (and optionally persist remember state)
  function updateAuthStatus(authenticated: boolean, detail?: string) {
    isAuthenticated = authenticated;
    if (authStatus) {
      setSafeHTML(authStatus, formatAuthStatusLabel(authenticated, detail));
      authStatus.className = authenticated ? 'auth-status authenticated' : 'auth-status not-authenticated';
      if (detail && !authenticated) {
        authStatus.setAttribute('title', detail);
      } else {
        authStatus.removeAttribute('title');
      }
    }

    const serialNumber = getSerialNumber();
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
        setSafeHTML(authStatus, icon('circle', 'icon-xs', 'icon-green') + ' ' + S.devApp.authenticated);
        authStatus.className = 'auth-status authenticated';
      } else {
        setSafeHTML(authStatus, icon('circle', 'icon-xs', 'icon-red') + ' ' + S.devApp.notAuthenticated);
        authStatus.className = 'auth-status not-authenticated';
      }
    }
  }
  
  // Verify password
  async function verifyPassword() {
    const password = passwordInput.value.trim();
    if (!password) {
      updateAuthStatus(false, S.devApp.enterDeveloperPassword);
      return false;
    }
    
    if (verifyPasswordBtn) {
      verifyPasswordBtn.disabled = true;
      verifyPasswordBtn.textContent = '...';
    }
    
    try {
      const result = await api.verifyDevAuth(password);

      if (!result) {
        updateAuthStatus(false, S.devApp.verificationNoResponse);
        if (verifyPasswordBtn) {
          verifyPasswordBtn.disabled = false;
          verifyPasswordBtn.textContent = S.devApp.verify;
        }
        return false;
      }

      const authOk = !!result.success;
      const errDetail =
        !authOk && typeof result.error === 'string' && result.error.trim()
          ? result.error.trim()
          : undefined;
      updateAuthStatus(authOk, errDetail);

      // Stored-password invalidation. If the Roku rejected the exact password
      // we had persisted (i.e. what we just auto-loaded, or what the user
      // left in the field after loading), wipe it so we don't silently retry
      // a known-bad credential next time. A manually-typed password that
      // doesn't match the stored one is left alone — the stored copy might
      // still be correct.
      const serialNumber = getSerialNumber();
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
        verifyPasswordBtn.textContent = S.devApp.verify;
      }
      return authOk;
    } catch (e) {
      updateAuthStatus(false);
      if (verifyPasswordBtn) {
        verifyPasswordBtn.disabled = false;
        verifyPasswordBtn.textContent = S.devApp.verify;
      }
      return false;
    }
  }
  
  // Event handlers
  if (verifyPasswordBtn) {
    verifyPasswordBtn.addEventListener('click', verifyPassword);
  }
  
  // Load stored password, once we actually have a serial to look one up under. Called both
  // immediately (if the serial is already known) and from the `device-info-refreshed` listener
  // below (if it wasn't yet — e.g. a Sideload Relay auto-connected device).
  let triedStoredPasswordLoad = false;
  function tryAutoloadStoredPassword(): void {
    if (triedStoredPasswordLoad) return;
    const serialNumber = getSerialNumber();
    if (!serialNumber) return;
    triedStoredPasswordLoad = true;
    const storedPassword = getStoredPassword(serialNumber);
    if (storedPassword) {
      passwordInput.value = storedPassword;
      if (rememberCheckbox) rememberCheckbox.checked = true;
      setTimeout(() => verifyPassword(), 500);
    }
  }
  tryAutoloadStoredPassword();
  panel.addEventListener('device-info-refreshed', () => tryAutoloadStoredPassword());

  // Handle remember checkbox changes
  if (rememberCheckbox) {
    rememberCheckbox.addEventListener('change', () => {
      const serialNumber = getSerialNumber();
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
  
  // Live locale switch: the auth badge is icon-only in the template (no data-i18n) and its
  // "Authenticated" / "Not authenticated" label is set imperatively, so applyI18n can't reach it.
  // Re-render from the current auth state (a transient error detail, if any, is dropped on relabel).
  registerPanelRetranslate(panel, () => setAuthenticatedState(isAuthenticated));

  return {
    isAuthenticated: () => isAuthenticated,
    verifyPassword,
    getPassword: () => passwordInput.value.trim(),
    setAuthenticatedState
  };
}

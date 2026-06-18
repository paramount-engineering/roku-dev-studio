/**
 * Import Action Script modal: upload/paste JSON, output folder, developer password,
 * validate-and-import with password verification (cache > script > ask).
 * Validates script (parse + schema), establishes App Connector when required, then loads into executor.
 */

import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { scriptHasSaveActions, scriptNeedsPassword, scriptNeedsRaleConnection } from './action-registry.js';
import { parseAndValidateScript } from './validator.js';
import { ensureRaleFunctionsWhenScriptNeedsRale } from './script-rale-validation.js';
import { getStoredPassword, savePassword, removePassword } from '../../modules/utils/storage.js';
import { resolveDevPassword } from '../../modules/utils/dev-password.js';
import { getActionScriptDefaultSaveFolder } from '../../modules/utils/app-user-settings.js';
import { flattenStepsPreorder, stepPathToDisplayId } from './action-script-tree.js';
import {
  prepareModalOpenOrigin,
  playModalOpenMotion,
  closeModalWithOriginMotion
} from '../../modules/utils/modal-origin-motion.js';

const MODAL_ID = 'actionScriptsImportModal';

/** Runtime fields on the global import modal overlay (shared across device panels). */
type ImportModalRootEl = HTMLElement & {
  _importTarget?: 'executor' | 'builder';
  _importTargetContainer?: HTMLElement;
  _importContext?: {
    api: unknown;
    getDeviceSerial: () => string;
    container: HTMLElement;
    executorTextarea?: HTMLTextAreaElement | null;
    executorValidateBtn?: HTMLElement | null;
    /** Set per `openImportModal` so the shared Validate handler loads the correct device panel’s Builder. */
    onImportToBuilder?: (json: string) => void;
  };
  _importOutputFolder?: string | null | undefined;
};

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Format and validate script JSON; returns { formatted, error }. */
export function formatScriptJson(text) {
  const raw = (text || '').trim();
  if (!raw) return { formatted: '', error: null };
  try {
    const parsed = JSON.parse(raw);
    if (parsed == null || typeof parsed !== 'object') return { formatted: raw, error: 'Invalid script: must be an object' };
    if (!Array.isArray(parsed.steps)) return { formatted: JSON.stringify(parsed, null, 2), error: 'Script must have a "steps" array' };
    return { formatted: JSON.stringify(parsed, null, 2), error: null };
  } catch (e) {
    return { formatted: raw, error: e instanceof Error ? e.message : String(e) || 'Invalid JSON' };
  }
}

/** Import modal priority: stored (per-serial) > script > modal input.
 *  See `resolveDevPassword` for why each path differs. */
function resolvePassword(parsed, getSerial, modalPasswordValue) {
  return resolveDevPassword(
    {
      storedForSerial: getStoredPassword(getSerial()),
      scriptDevPassword: parsed && parsed.devPassword,
      uiInput: modalPasswordValue
    },
    ['storedForSerial', 'scriptDevPassword', 'uiInput']
  );
}

/** Strip devPassword from script for display when loading from executor. */
export function stripDevPasswordForDisplay(jsonString) {
  const raw = (jsonString || '').trim();
  if (!raw) return jsonString;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'devPassword' in parsed) {
      const copy = { ...parsed };
      delete copy.devPassword;
      return JSON.stringify(copy, null, 2);
    }
  } catch (_) {}
  return jsonString;
}

/**
 * Setup Import Action Script modal.
 * @param {HTMLElement} container - Action scripts container (for target panel / executor)
 * @param {{ serialNumber?: string, ip?: string }} device - Current device (for serial)
 * @param {{ verifyDevAuth?: (password: string) => Promise<{ success?: boolean, error?: string, authFailed?: boolean }> }} api - Device API
 * @param {{ executorElements: { executorTextarea?: HTMLTextAreaElement }, hasExecutorSteps: () => boolean, onImportToBuilder?: (json: string) => void }} context
 * @returns {{ openImportModal: (prefillJson?: string, opener?: HTMLElement | null, options?: { target?: 'executor' | 'builder' }) => void, closeImportModal: () => void }}
 */
export function setupImportModal(container, device, api, context) {
  const { executorElements, hasExecutorSteps, onImportToBuilder } = context;
  const modalRootEl = document.getElementById(MODAL_ID);
  if (!modalRootEl) {
    return {
      openImportModal: (_prefill?: string, _opener?: HTMLElement | null, _options?: { target?: 'executor' | 'builder' }) => {},
      closeImportModal: () => {}
    };
  }
  const modalRoot = modalRootEl as ImportModalRootEl;

  const importFileInput = modalRoot.querySelector(
    '.action-scripts-import-file-input'
  ) as HTMLInputElement | null;
  const importUploadBtn = modalRoot.querySelector('.action-scripts-import-upload-btn');
  const importTextarea = modalRoot.querySelector(
    '.action-scripts-import-textarea'
  ) as HTMLTextAreaElement | null;
  const importClearBtn = modalRoot.querySelector('.action-scripts-import-clear-btn');
  const importErrorEl = modalRoot.querySelector('.action-scripts-import-error') as HTMLElement | null;
  const importValidateBtn = modalRoot.querySelector(
    '.action-scripts-import-validate-btn'
  ) as HTMLButtonElement | null;
  const importModalCloseBtn = modalRoot.querySelector(
    '.action-scripts-import-modal-close'
  ) as HTMLElement | null;
  const importOutputFolderPath = modalRoot.querySelector(
    '.action-scripts-import-output-folder-path'
  ) as HTMLElement | null;
  const importOutputFolderSection = modalRoot.querySelector(
    '.action-scripts-import-output-folder'
  ) as HTMLElement | null;
  const importChooseFolderBtn = modalRoot.querySelector('.action-scripts-import-choose-folder-btn');
  const importDevPasswordSection = modalRoot.querySelector(
    '.action-scripts-import-dev-password'
  ) as HTMLElement | null;
  const importDevPasswordRequiredMsg = modalRoot.querySelector(
    '.action-scripts-import-dev-password-required-msg'
  ) as HTMLElement | null;
  const importDevPasswordInput = modalRoot.querySelector(
    '.action-scripts-import-dev-password-input'
  ) as HTMLInputElement | null;
  const importRememberPasswordCheckbox = modalRoot.querySelector(
    '.action-scripts-import-remember-password'
  ) as HTMLInputElement | null;

  const getDeviceSerial = () =>
    (device && (device.serialNumber && device.serialNumber.trim() ? device.serialNumber.trim() : device.ip)) || '';

  /** Serial for password cache / visibility: device that opened the modal (listeners are shared across panels). */
  function getImportDeviceSerialForModal(): string {
    const ctx = modalRoot._importContext;
    if (ctx && typeof ctx.getDeviceSerial === 'function') return ctx.getDeviceSerial();
    return getDeviceSerial();
  }

  function setImportError(msg) {
    if (importErrorEl) {
      importErrorEl.textContent = msg || '';
      importErrorEl.style.display = msg ? 'block' : 'none';
    }
  }

  /** Show Dev Password section only when script needs password and none from cache or script. */
  function updateDevPasswordVisibility(raw) {
    if (!importDevPasswordSection) return;
    if (modalRoot._importTarget === 'builder') {
      importDevPasswordSection.style.display = 'none';
      if (importDevPasswordRequiredMsg) importDevPasswordRequiredMsg.style.display = 'none';
      return;
    }
    const text = (raw || '').trim();
    if (!text) {
      importDevPasswordSection.style.display = 'none';
      if (importDevPasswordRequiredMsg) importDevPasswordRequiredMsg.style.display = 'none';
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.steps)) {
        importDevPasswordSection.style.display = 'none';
        if (importDevPasswordRequiredMsg) importDevPasswordRequiredMsg.style.display = 'none';
        return;
      }
      const needsPassword = scriptNeedsPassword(parsed);
      const scriptHasPassword = !!(parsed.devPassword && String(parsed.devPassword).trim());
      const cachedPassword = getStoredPassword(getImportDeviceSerialForModal());
      const hasPasswordFromCacheOrScript = !!cachedPassword || scriptHasPassword;
      if (needsPassword && !hasPasswordFromCacheOrScript) {
        importDevPasswordSection.style.display = 'block';
        if (importDevPasswordRequiredMsg) importDevPasswordRequiredMsg.style.display = 'block';
      } else {
        importDevPasswordSection.style.display = 'none';
        if (importDevPasswordRequiredMsg) importDevPasswordRequiredMsg.style.display = 'none';
      }
    } catch (_) {
      importDevPasswordSection.style.display = 'none';
      if (importDevPasswordRequiredMsg) importDevPasswordRequiredMsg.style.display = 'none';
    }
  }

  function showPasswordSectionAfterAuthFailure(showRequiredMsg = false) {
    if (importDevPasswordSection) {
      importDevPasswordSection.style.display = 'block';
      if (importDevPasswordRequiredMsg) importDevPasswordRequiredMsg.style.display = showRequiredMsg ? 'block' : 'none';
      importDevPasswordSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function functionsNotAvailableMessage(missingNames) {
    const list = Array.from(new Set(missingNames)).filter(Boolean).join(', ');
    return `The following App Function(s) are not available from the app: ${list || '?'}. Ensure your channel exposes these functions (or remove these steps from the script), then try again.`;
  }

  /**
   * Run full validation: 4-step App Connector check when script has appFunction steps, then parseAndValidateScript, sideload file check.
   * @param {Object} parsed - Parsed script object
   * @param {string} raw - Raw JSON string
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async function runFullValidation(parsed, raw, importContainer, importApi) {
    const panel = importContainer.closest('.tab-panel');
    let raleFunctions: unknown[] = [];
    const scriptUsesRale = scriptNeedsRaleConnection(parsed);

    if (scriptUsesRale && importApi && importApi.raleCommand) {
      const raleRes = await ensureRaleFunctionsWhenScriptNeedsRale(panel, importApi, null);
      if (!raleRes.ok) return { ok: false, error: raleRes.error };
      raleFunctions = raleRes.raleFunctions ?? [];
    }

    const result = parseAndValidateScript(raw, raleFunctions);
    if (result.parseError) return { ok: false, error: `Invalid JSON: ${result.parseError}` };
    if (result.validation && !result.validation.valid) {
      const errors = result.validation.errors || [];
      const missingNames = errors
        .filter((e) => e.message && String(e.message).includes('not found'))
        .map((e) => {
          const si = e.stepIndex;
          if (typeof si !== 'number' || !parsed.steps) return null;
          const st = parsed.steps[si];
          return st && st.functionName ? st.functionName : null;
        })
        .filter(Boolean);
      if (missingNames.length > 0) return { ok: false, error: functionsNotAvailableMessage(missingNames) };
      const flatLabels = flattenStepsPreorder(parsed.steps || []);
      const errLines = errors
        .map((e) => {
          const si = e.stepIndex;
          if (si == null) return String(e.message);
          const entry = flatLabels[si];
          return `Action ${stepPathToDisplayId(entry && entry.path, si)}: ${e.message}`;
        })
        .join('\n');
      return { ok: false, error: errLines };
    }

    if (
      result.script &&
      result.script.steps &&
      typeof window !== 'undefined' &&
      window.roku &&
      window.roku.actionScriptCheckFileExists
    ) {
      for (let i = 0; i < result.script.steps.length; i++) {
        const step = result.script.steps[i];
        if (step && step.type === 'sideload' && step.filePath) {
          const res = await window.roku.actionScriptCheckFileExists(step.filePath);
          if (res && res.success && !res.exists)
            return { ok: false, error: `Action ${stepPathToDisplayId([i])}: File not found: ${step.filePath}` };
        }
      }
    }
    return { ok: true };
  }

  const importModalTitleEl = modalRoot.querySelector('.action-scripts-import-modal-title') as HTMLElement | null;
  const defaultImportTitle = importModalTitleEl?.textContent?.trim() || 'Import Action Script';

  function openImportModal(
    prefillJson,
    opener?: HTMLElement | null,
    options?: { target?: 'executor' | 'builder' }
  ) {
    modalRoot._importTarget = options?.target === 'builder' ? 'builder' : 'executor';
    if (importModalTitleEl) {
      importModalTitleEl.textContent =
        modalRoot._importTarget === 'builder' ? 'Import Script into Builder' : defaultImportTitle;
    }
    if (importValidateBtn) {
      importValidateBtn.textContent =
        modalRoot._importTarget === 'builder' ? 'Validate and Load' : 'Validate and Import';
    }
    if (importOutputFolderSection) {
      if (modalRoot._importTarget === 'builder') {
        importOutputFolderSection.style.display = 'none';
        importOutputFolderSection.setAttribute('aria-hidden', 'true');
      } else {
        importOutputFolderSection.style.display = '';
        importOutputFolderSection.removeAttribute('aria-hidden');
      }
    }
    modalRoot._importTargetContainer = container;
    modalRoot._importContext = {
      api,
      getDeviceSerial,
      container,
      executorTextarea: executorElements.executorTextarea ?? null,
      executorValidateBtn: executorElements.executorValidateBtn ?? null,
      onImportToBuilder: typeof onImportToBuilder === 'function' ? onImportToBuilder : undefined
    };
    // Always open with a clear textarea; only fill when Copy to Executor passes JSON
    if (importTextarea) {
      importTextarea.value = '';
      setImportError('');
      if (typeof prefillJson === 'string' && prefillJson.trim()) {
        const { formatted, error } = formatScriptJson(prefillJson);
        importTextarea.value = formatted;
        setImportError(error || '');
      }
    }
    if (modalRoot._importTarget === 'builder') {
      delete (modalRoot as ImportModalRootEl)._importOutputFolder;
    } else {
      const currentPath = container.querySelector('.action-script-save-folder-path');
      let pathStr =
        currentPath && currentPath.textContent && currentPath.textContent !== 'No folder selected'
          ? currentPath.textContent
          : '';
      if (!pathStr) {
        const defaultFolder = getActionScriptDefaultSaveFolder();
        if (defaultFolder) pathStr = defaultFolder;
      }
      modalRoot._importOutputFolder = pathStr || null;
      if (importOutputFolderPath) {
        importOutputFolderPath.textContent = pathStr || 'No folder selected';
        importOutputFolderPath.title = pathStr || '';
      }
    }
    updateDevPasswordVisibility(importTextarea ? importTextarea.value : '');
    const panel = container.closest('.tab-panel');
    const devPasswordField = panel && panel.querySelector('.dev-password');
    const devRememberCheckbox = panel && panel.querySelector('.remember-password-checkbox');
    const sectionVisible = importDevPasswordSection && importDevPasswordSection.style.display !== 'none';
    if (sectionVisible && (devPasswordField || devRememberCheckbox)) {
      if (importDevPasswordInput && devPasswordField) importDevPasswordInput.value = devPasswordField.value || '';
      if (importRememberPasswordCheckbox && devRememberCheckbox != null) importRememberPasswordCheckbox.checked = !!devRememberCheckbox.checked;
    } else {
      if (importDevPasswordInput) importDevPasswordInput.value = '';
      if (importRememberPasswordCheckbox) importRememberPasswordCheckbox.checked = false;
    }
    prepareModalOpenOrigin(modalRoot, opener ?? null);
    modalRoot.classList.add('active');
    if (modalRoot.setAttribute) modalRoot.setAttribute('aria-hidden', 'false');
    modalRoot.classList.add('modal-motion-enabled');
    playModalOpenMotion(modalRoot);
    if (importTextarea) importTextarea.focus();
  }

  function closeImportModal() {
    if (!modalRoot.classList.contains('active')) return;
    closeModalWithOriginMotion(modalRoot, () => {
      modalRoot.classList.remove('active');
      if (modalRoot.setAttribute) modalRoot.setAttribute('aria-hidden', 'true');
    });
  }

  async function verifyPasswordForImport(importApi, password) {
    if (!importApi || typeof importApi.verifyDevAuth !== 'function') {
      return { ok: false, error: 'Cannot verify password: device connection not available.' };
    }
    try {
      const result = await importApi.verifyDevAuth(password);
      // Match Dev App password-auth: any truthy success counts (IPC/remote JSON may vary).
      if (result && result.success) return { ok: true };
      const authError = !!(result && result.authFailed);
      return { ok: false, error: result && result.error, authError };
    } catch (e) {
      return { ok: false, error: errMsg(e) || 'Verification failed', authError: false };
    }
  }

  function handleValidateAndImport() {
    if (!importTextarea || !importValidateBtn) return;
    const ctx = modalRoot._importContext;
    if (!ctx || !ctx.container) {
      setImportError('Could not determine device for import. Close the modal and open Import again from this device tab.');
      return;
    }
    const { api: importApi, getDeviceSerial: serialForImport, container: importContainer } = ctx;
    try {
      const raw = importTextarea.value.trim();
      if (!raw) {
        setImportError('Paste or upload a script (JSON).');
        return;
      }
      const { formatted, error } = formatScriptJson(raw);
      if (error) {
        setImportError(error);
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(formatted);
      } catch (e) {
        setImportError(errMsg(e) || 'Invalid script');
        return;
      }
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.steps)) {
        setImportError('Script must have a "steps" array.');
        return;
      }

      const importToBuilder = modalRoot._importTarget === 'builder';

      const needsSaveFolder = scriptHasSaveActions(parsed);
      const hasSaveFolder = modalRoot._importOutputFolder && String(modalRoot._importOutputFolder).trim() !== '';
      if (!importToBuilder && needsSaveFolder && !hasSaveFolder) {
        setImportError('Save folder is required for this Script (e.g. Screenshot step). Please choose a save folder.');
        return;
      }

      const needsPassword = scriptNeedsPassword(parsed);
      const modalPasswordValue = importDevPasswordInput ? importDevPasswordInput.value : '';
      const resolvedPassword = resolvePassword(parsed, serialForImport, modalPasswordValue);

      if (!importToBuilder && needsPassword && !resolvedPassword) {
        setImportError('Developer password is required and not in cache or script. Enter it below.');
        updateDevPasswordVisibility(raw);
        showPasswordSectionAfterAuthFailure(true);
        if (importDevPasswordInput) importDevPasswordInput.focus();
        return;
      }

      if (!importToBuilder && needsPassword && resolvedPassword) {
        const btnLabel = importValidateBtn.textContent;
        importValidateBtn.disabled = true;
        importValidateBtn.textContent = 'Verifying password…';
        setImportError('');
        verifyPasswordForImport(importApi, resolvedPassword)
          .then((verification) => {
            importValidateBtn.disabled = false;
            importValidateBtn.textContent = btnLabel;
            if (!verification.ok) {
              // Invalidate the stored copy if *that* is what just failed. We
              // compare against the persisted value so a user typing a wrong
              // one-off password doesn't wipe their correctly-saved one.
              if (verification.authError) {
                const serial = serialForImport();
                if (serial) {
                  const stored = getStoredPassword(serial);
                  if (stored && stored === resolvedPassword) {
                    removePassword(serial);
                    if (importRememberPasswordCheckbox) importRememberPasswordCheckbox.checked = false;
                  }
                }
              }
              showPasswordSectionAfterAuthFailure(false);
              if (importDevPasswordInput) {
                importDevPasswordInput.value = resolvedPassword;
                importDevPasswordInput.focus();
              }
              setImportError(
                verification.authError
                  ? 'Authentication failed. Please check your password and try again.'
                  : verification.error || 'Password verification failed.'
              );
              return;
            }
            if (importRememberPasswordCheckbox && importRememberPasswordCheckbox.checked) {
              const serial = serialForImport();
              if (serial) savePassword(serial, resolvedPassword);
            }
            const panel = importContainer.closest('.tab-panel');
            const devPasswordInput = panel && panel.querySelector('.dev-password');
            if (devPasswordInput instanceof HTMLInputElement) devPasswordInput.value = resolvedPassword;
            if (panel) {
              panel.dispatchEvent(
                new CustomEvent('dev-password-verified', {
                  detail: {
                    password: resolvedPassword,
                    remember: !!(importRememberPasswordCheckbox && importRememberPasswordCheckbox.checked)
                  }
                })
              );
            }
            parsed.devPassword = resolvedPassword;
            importValidateBtn.disabled = true;
            importValidateBtn.textContent = 'Validating…';
            setImportError('');
            return runFullValidation(parsed, formatted, importContainer, importApi);
          })
          .then((validation) => {
            if (validation === undefined) return;
            importValidateBtn.disabled = false;
            importValidateBtn.textContent = btnLabel;
            if (!validation.ok) {
              setImportError(validation.error || 'Validation failed');
              return;
            }
            finishImport(parsed);
          })
          .catch((e) => {
            importValidateBtn.disabled = false;
            importValidateBtn.textContent = btnLabel;
            setImportError(errMsg(e) || 'Verification or validation failed');
          });
        return;
      }

      const btnLabel = importValidateBtn.textContent;
      importValidateBtn.disabled = true;
      importValidateBtn.textContent = 'Validating…';
      setImportError('');
      runFullValidation(parsed, formatted, importContainer, importApi)
        .then((validation) => {
          importValidateBtn.disabled = false;
          importValidateBtn.textContent = btnLabel;
          if (!validation.ok) {
            setImportError(validation.error || 'Validation failed');
            return;
          }
          finishImport(parsed);
        })
        .catch((e) => {
          importValidateBtn.disabled = false;
          importValidateBtn.textContent = btnLabel;
          setImportError(errMsg(e) || 'Validation failed');
        });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e) || 'Invalid script');
      if (importValidateBtn) {
        importValidateBtn.disabled = false;
        importValidateBtn.textContent =
          modalRoot._importTarget === 'builder' ? 'Validate and Load' : 'Validate and Import';
      }
    }
  }

  function finishImport(parsed) {
    const finalFormatted = JSON.stringify(parsed, null, 2);
    if (modalRoot._importTarget === 'builder') {
      const loadInBuilder = modalRoot._importContext?.onImportToBuilder;
      if (typeof loadInBuilder === 'function') {
        loadInBuilder(finalFormatted);
      }
      setImportError('');
      closeImportModal();
      return;
    }
    // Prefer the device that opened Import (may differ from active tab if user switched tabs while modal is open)
    const fromSession = modalRoot._importContext?.container || modalRoot._importTargetContainer;
    const activePanel = document.querySelector('.tab-panel.active');
    const target =
      (fromSession instanceof HTMLElement ? fromSession : null) ||
      (activePanel instanceof HTMLElement && activePanel.querySelector('.action-scripts-container')) ||
      modalRoot._importTargetContainer;
    const ctx = modalRoot._importContext;
    const ta =
      ctx?.executorTextarea instanceof HTMLTextAreaElement
        ? ctx.executorTextarea
        : target instanceof HTMLElement
          ? target.querySelector('.action-script-executor-textarea')
          : null;
    const validateBtn =
      ctx?.executorValidateBtn instanceof HTMLElement
        ? ctx.executorValidateBtn
        : target instanceof HTMLElement
          ? target.querySelector('.action-script-executor-validate')
          : null;
    const importSection =
      target instanceof HTMLElement ? (target.querySelector('.executor-import-section') as HTMLElement | null) : null;
    const panel = target instanceof HTMLElement ? target.closest('.tab-panel') : null;

    // The JSON/Validate strip uses inline `display:none` (hidden by design). Browsers often skip
    // programmatic activation on controls inside non-rendered subtrees, so the first Validate click
    // can no-op. Briefly show the section, then restore after the sync part of the handler runs.
    let restoreSection: () => void = () => {};
    if (importSection instanceof HTMLElement) {
      const prevDisplay = importSection.style.display;
      const prevAria = importSection.getAttribute('aria-hidden');
      importSection.style.display = 'block';
      importSection.removeAttribute('aria-hidden');
      restoreSection = () => {
        importSection.style.display = prevDisplay;
        if (prevAria != null) importSection.setAttribute('aria-hidden', prevAria);
        else importSection.setAttribute('aria-hidden', 'true');
      };
    }

    if (ta instanceof HTMLTextAreaElement) {
      ta.value = finalFormatted;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (panel && modalRoot._importOutputFolder !== undefined) {
      panel.dispatchEvent(new CustomEvent('action-script-set-save-folder', { detail: { path: modalRoot._importOutputFolder || null } }));
    }
    queueMicrotask(() => {
      if (validateBtn instanceof HTMLElement) validateBtn.click();
      restoreSection();
    });
    setImportError('');
    closeImportModal();
  }

  if (!modalRoot.dataset.modalRootInit) {
    modalRoot.dataset.modalRootInit = '1';
    if (importUploadBtn && importFileInput) {
      importUploadBtn.addEventListener('click', () => importFileInput.click());
      importFileInput.addEventListener('change', () => {
        const file = importFileInput.files && importFileInput.files[0];
        importFileInput.value = '';
        if (!file || !importTextarea) return;
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result;
          const { formatted, error } = formatScriptJson(text);
          importTextarea.value = formatted;
          setImportError(error || '');
          updateDevPasswordVisibility(formatted || text);
        };
        reader.onerror = () => setImportError('Failed to read file');
        reader.readAsText(file);
      });
    }
    if (importTextarea) {
      importTextarea.addEventListener('paste', () => {
        setTimeout(() => {
          const { formatted, error } = formatScriptJson(importTextarea.value);
          importTextarea.value = formatted;
          setImportError(error || '');
          updateDevPasswordVisibility(importTextarea.value);
        }, 10);
      });
      importTextarea.addEventListener('blur', () => {
        const { formatted, error } = formatScriptJson(importTextarea.value);
        if (formatted !== importTextarea.value) importTextarea.value = formatted;
        setImportError(error || '');
        updateDevPasswordVisibility(importTextarea.value);
      });
    }
    if (importClearBtn && importTextarea) {
      importClearBtn.addEventListener('click', () => {
        importTextarea.value = '';
        setImportError('');
        importTextarea.focus();
      });
    }
    if (importChooseFolderBtn && importOutputFolderPath) {
      importChooseFolderBtn.addEventListener('click', async () => {
        if (!window.roku || !window.roku.actionScriptShowSaveFolder) return;
        const res = await window.roku.actionScriptShowSaveFolder();
        if (res.success && res.folderPath) {
          modalRoot._importOutputFolder = res.folderPath;
          importOutputFolderPath.textContent = res.folderPath;
          importOutputFolderPath.title = res.folderPath;
        }
      });
    }
    if (importValidateBtn && importTextarea) {
      importValidateBtn.addEventListener('click', handleValidateAndImport);
    }
    if (importModalCloseBtn) importModalCloseBtn.addEventListener('click', closeImportModal);
    attachBackdropClickToClose(modalRoot, closeImportModal);
  }

  return { openImportModal, closeImportModal };
}

/**
 * Renderer entry for the standalone "View and Manage Action Scripts" window. Hosts a real Action
 * Scripts Builder (`setupBuilder`, with a null device api — every device call in the builder is
 * guarded) over the in-app saved-scripts library: pick a script from the top dropdown to load it
 * into the builder (left = steps, right = JSON), edit it, then Save (overwrites the open script by
 * name), Duplicate (save-as), Delete, or push it into the main window's Builder.
 */
import { S, applyI18n, setLocale, effectiveLocale } from '@shared/strings/index.js';
import { applyLocalePreference } from '../../modules/utils/locale-live.js';
import { setupBuilder } from './builder.js';
import {
  ensureSavedScriptsLoaded,
  listSavedScripts,
  loadSavedScript,
  saveScriptToApp,
  deleteSavedScript,
  type SavedScriptMeta
} from './saved-scripts-store.js';
import { promptSaveScriptName } from './save-script-modal.js';
import { openApplyToDeviceModal, type ApplyDeviceOption } from './apply-to-device-modal.js';
import { showToast } from '../../modules/utils/ui.js';

type ViewerBridge = {
  onLocaleChanged?: (cb: (pref: string) => void) => unknown;
  getApplyDeviceOptions?: () => Promise<ApplyDeviceOption[]>;
  rescanApplyDeviceOptions?: () => Promise<ApplyDeviceOption[]>;
  applyActionScriptToDevice?: (deviceId: string, json: string) => Promise<unknown>;
};

type BuilderApi = {
  getScript: () => { version?: string; steps: unknown[] };
  importFromValidatedJson: (text: string) => Promise<{ ok: boolean; message?: string } | undefined>;
} | undefined;

function q<T extends Element = HTMLElement>(sel: string): T | null {
  return document.querySelector(sel) as T | null;
}

async function main(): Promise<void> {
  // Sync locale from the loadFile query BEFORE the first applyI18n (flash-free), like the main window.
  const localePref = new URLSearchParams(location.search).get('locale');
  if (localePref) setLocale(effectiveLocale(localePref, navigator.language));
  applyI18n(document);

  const roku = (window as unknown as { roku?: ViewerBridge }).roku;

  const builderElements = {
    builderStepsList: q('.action-scripts-builder-steps-list'),
    builderAddStepBtn: q('.action-scripts-builder-add-step'),
    builderCancelEditBtn: q('.action-scripts-builder-cancel-edit'),
    builderFormHeading: q('.action-scripts-builder-form-heading'),
    builderAddForm: q('.action-scripts-builder-add-form'),
    builderAddFormDismiss: q('.action-scripts-builder-add-form-dismiss'),
    builderStepHelpBtn: q('.action-scripts-builder-step-help-btn'),
    builderAddSection: q('.action-scripts-builder-add-section'),
    builderStepTypeSelect: q('.action-scripts-builder-type-select'),
    builderStepFields: q('.action-scripts-builder-step-fields'),
    builderCopyJsonBtn: q('.action-scripts-builder-copy-json'),
    builderCopyToExecutorBtn: null, // no executor in this window
    builderSaveScriptBtn: q('.action-scripts-builder-save-script'),
    builderSaveCaretBtn: q('.action-scripts-builder-save-caret'),
    builderSaveDropdown: q('.action-scripts-save-dropdown'),
    builderSaveToDirectoryBtn: q('.action-scripts-builder-save-to-directory'),
    builderOutputPreview: q('.action-scripts-builder-output-preview'),
    builderUndoBtn: q('.builder-undo-btn'),
    builderRedoBtn: q('.builder-redo-btn'),
    builderClearBtn: q('.builder-clear-btn')
  };
  const builderRoot = q('.action-scripts-builder-content') ?? document.body;

  const dropdown = q<HTMLSelectElement>('#asViewerSelect');
  const deleteBtn = q<HTMLButtonElement>('.as-viewer-delete');
  const applyBtn = q<HTMLButtonElement>('.as-viewer-apply-to-device');
  const saveAsBtn = q<HTMLButtonElement>('.as-viewer-save-as');

  let openScript: SavedScriptMeta | null = null;

  const builderApi: BuilderApi = setupBuilder(builderRoot, null, {
    elements: builderElements,
    // Save pre-fills the open script's name so it overwrites in place; refresh the list after a save.
    getSaveDefaultName: () => openScript?.name ?? '',
    onScriptSaved: (name: string) => refreshDropdown(name),
    // Apply/Copy/Save live in the JSON panel and are all gated on the builder having steps: Copy/Save
    // are toggled by the builder itself; mirror that onto Apply via the step-count hook.
    onStepsChanged: (count: number) => {
      if (applyBtn) applyBtn.disabled = count < 1;
    }
  }) as BuilderApi;

  // Delete targets the open saved script, so it's gated on a script being selected — independent of
  // whether the builder currently has steps (which gates Apply/Copy/Save).
  function setDeleteEnabled(enabled: boolean): void {
    if (deleteBtn) deleteBtn.disabled = !enabled;
  }

  function populateDropdown(scripts: SavedScriptMeta[], selectId?: string): void {
    if (!dropdown) return;
    dropdown.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = scripts.length
      ? S.modals.actionScriptsImport.savedSelectPlaceholder
      : S.actionScripts.viewerEmpty;
    dropdown.appendChild(placeholder);
    for (const s of scripts) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      dropdown.appendChild(opt);
    }
    dropdown.value = selectId && scripts.some((s) => s.id === selectId) ? selectId : '';
  }

  function refreshDropdown(selectName?: string): void {
    const scripts = listSavedScripts();
    const match = selectName ? scripts.find((s) => s.name === selectName) : undefined;
    if (match) openScript = match;
    populateDropdown(scripts, openScript?.id);
    setDeleteEnabled(!!openScript && scripts.some((s) => s.id === openScript?.id));
  }

  async function selectScript(id: string): Promise<void> {
    const meta = listSavedScripts().find((s) => s.id === id) ?? null;
    openScript = meta;
    setDeleteEnabled(!!meta);
    if (!meta) return;
    const content = await loadSavedScript(id);
    if (!content) {
      showToast(S.actionScripts.errFailedToReadFile, 'error');
      return;
    }
    if (builderApi) {
      const res = await builderApi.importFromValidatedJson(JSON.stringify(content));
      if (res && !res.ok && res.message) showToast(res.message.replace(/\n/g, ' '), 'error');
    }
  }

  dropdown?.addEventListener('change', () => {
    if (dropdown.value) {
      void selectScript(dropdown.value);
    } else {
      // Placeholder selected — no saved script is open, so Delete goes inert. Apply/Copy/Save keep
      // following the builder's current contents (selecting the placeholder doesn't clear them).
      openScript = null;
      setDeleteEnabled(false);
    }
  });

  // "Save As…" lives in the Save split-button's dropdown; saves the current builder content under a
  // new name (defaults to the open script's name + a "copy" suffix).
  saveAsBtn?.addEventListener('click', async () => {
    if (!builderApi) return;
    const dd = document.querySelector('.action-scripts-save-dropdown');
    if (dd instanceof HTMLElement) dd.hidden = true;
    const base = openScript ? `${openScript.name} ${S.actionScripts.viewerCopySuffix}`.trim() : '';
    const name = await promptSaveScriptName({
      defaultName: base,
      savedNames: listSavedScripts().map((s) => s.name)
    });
    if (!name) return;
    try {
      await saveScriptToApp(name, builderApi.getScript());
      refreshDropdown(name);
      showToast(S.actionScripts.savedFeedback, 'success');
    } catch {
      showToast(S.actionScripts.toastSaveFailed, 'error');
    }
  });

  deleteBtn?.addEventListener('click', async () => {
    if (!openScript) return;
    const target = openScript;
    if (!window.confirm(S.actionScripts.viewerDeleteConfirm(target.name))) return;
    const ok = await deleteSavedScript(target.id);
    if (!ok) {
      showToast(S.actionScripts.errFailedToReadFile, 'error');
      return;
    }
    openScript = null;
    populateDropdown(listSavedScripts());
    setDeleteEnabled(false);
    // Clearing the builder fires onStepsChanged(0), which disables Apply/Copy/Save.
    if (builderApi) void builderApi.importFromValidatedJson(JSON.stringify({ steps: [] }));
  });

  // Apply to Device: pick a device in THIS window (device list is fetched from the main window, which
  // owns device state), then apply — which brings the main window forward and loads the script there.
  applyBtn?.addEventListener('click', async () => {
    if (!builderApi) return;
    const json = JSON.stringify(builderApi.getScript());
    const initialDevices = (await roku?.getApplyDeviceOptions?.()) ?? [];
    openApplyToDeviceModal({
      initialDevices,
      rescan: async () => (await roku?.rescanApplyDeviceOptions?.()) ?? [],
      onApply: (deviceId: string) => {
        void roku?.applyActionScriptToDevice?.(deviceId, json);
      }
    });
  });

  // Live locale switching: retranslate the shell + repaint the dropdown and the builder's steps
  // (imperative rows aren't covered by applyI18n — re-import the open script to redraw them).
  if (roku && typeof roku.onLocaleChanged === 'function') {
    roku.onLocaleChanged((pref: string) => {
      applyLocalePreference(pref, () => {
        populateDropdown(listSavedScripts(), openScript?.id);
        if (openScript && builderApi) {
          void builderApi.importFromValidatedJson(JSON.stringify(builderApi.getScript()));
        }
      });
    });
  }

  await ensureSavedScriptsLoaded();
  populateDropdown(listSavedScripts());
  setDeleteEnabled(false);
}

void main();

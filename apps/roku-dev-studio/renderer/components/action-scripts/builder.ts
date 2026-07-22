/**
 * Action Script Builder UI: form-style step builder, pre-populated queries,
 * optional RALE app functions, output: save to folder or copy JSON.
 */

import { STEP_SCHEMA, scriptNeedsRaleConnection } from './action-registry.js';
import { getRaleBuiltinDefForCommand } from './rale-command-param-ui.js';
import { renderBuilderSteps, type BuilderAddPlacement } from './actions-list-view.js';
import {
  flattenStepsPreorder,
  removeStepAtPath,
  appendStepToIfBranch,
  replaceStepAtPath,
  insertStepAfterPath,
  getStepAtPath,
  getParentArrayAndIndex,
  stepPathToDisplayId,
  stepsTreeContainsIf,
  preorderStepSubtreeSize,
  ensureIfBranches,
  type StepPath
} from './action-script-tree.js';
import { parseAndValidateScript } from './validator.js';
import { fetchAppFunctionsForBuilder } from './fetch-app-functions.js';
import { raleCommandSupportsAssignToVar } from './action-script-variables-client.js';
import { showToast } from '../../modules/utils/ui.js';
import { setSafeHTML } from '../../modules/utils/dom.js';
import { renderParamInputs } from '../inspector/parameter-inputs.js';
import { applyRaleArgsToBuilderParams } from './builder-step-helpers.js';
import { createRenderStepFields } from './builder-render-step-fields.js';
import { collectActionStepHelpContext, openActionStepHelpModal } from './action-step-help-modal.js';
import { createBuilderStepForm } from './builder-step-form.js';
import { S } from '@shared/strings/index.js';

const STEP_TYPES = Object.keys(STEP_SCHEMA);

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function setupBuilder(panel, api, context) {
  const {
    builderStepsList,
    builderAddStepBtn,
    builderCancelEditBtn,
    builderFormHeading,
    builderAddForm,
    builderAddFormDismiss,
    builderStepHelpBtn,
    builderAddSection,
    builderStepTypeSelect,
    builderStepFields,
    builderCopyJsonBtn,
    builderCopyToExecutorBtn,
    builderSaveScriptBtn,
    builderOutputPreview,
    builderUndoBtn,
    builderRedoBtn,
    builderClearBtn
  } = context.elements;
  const onCopyToExecutor = context.onCopyToExecutor;

  if (!builderStepsList || !builderAddStepBtn) return;

  function removeHoistedWaitRalePanel() {
    const p = builderAddSection?.querySelector(':scope > .builder-wait-rale-panel');
    p?.remove();
  }

  function queryWaitRalePanel() {
    return builderStepFields?.querySelector('.builder-wait-rale-panel') || null;
  }

  function copyWaitTimingMediaPlayerToRale() {
    if (!builderStepFields) return;
    const mT = builderStepFields.querySelector('.builder-wait-timeout--mp');
    const mP = builderStepFields.querySelector('.builder-wait-poll--mp');
    const rT = builderStepFields.querySelector('.builder-wait-timeout--rale');
    const rP = builderStepFields.querySelector('.builder-wait-poll--rale');
    if (mT && rT) rT.value = mT.value;
    if (mP && rP) rP.value = mP.value;
  }

  function copyWaitTimingRaleToMediaPlayer() {
    if (!builderStepFields) return;
    const mT = builderStepFields.querySelector('.builder-wait-timeout--mp');
    const mP = builderStepFields.querySelector('.builder-wait-poll--mp');
    const rT = builderStepFields.querySelector('.builder-wait-timeout--rale');
    const rP = builderStepFields.querySelector('.builder-wait-poll--rale');
    if (mT && rT) mT.value = rT.value;
    if (mP && rP) mP.value = rP.value;
  }

  /**
   * RALE param UI for Action Scripts: always plain text fields (same param list as Execute Function).
   * App Connector may show registry dropdowns when connected; scripts run with runtime values only.
   * @param {HTMLElement} builderStepFieldsEl
   * @param {{ command?: string, args?: Record<string, unknown> } | null} presetStep
   */
  function refreshActionScriptRaleFields(builderStepFieldsEl, presetStep) {
    const cmdEl = builderStepFieldsEl.querySelector('.builder-field-rale-command');
    const container = builderStepFieldsEl.querySelector('.builder-rale-command-params');
    const paramsBlock = builderStepFieldsEl.querySelector('.builder-rale-params-block');
    if (!cmdEl || !container) return;

    function setRaleParamsBlockVisible(visible) {
      if (paramsBlock) paramsBlock.hidden = !visible;
    }

    /** Set var applies only to read/query RALE commands (not registry clear/edit). */
    function syncRaleAssignToVarRow() {
      const cmd = cmdEl.value.trim();
      const def = getRaleBuiltinDefForCommand(cmd);
      const supports = !!(def && raleCommandSupportsAssignToVar(cmd));
      if (builderAddSection) builderAddSection.classList.toggle('builder-rale-no-assign', !supports);
      const assignIn = builderStepFieldsEl.querySelector('.builder-field-assignToVar');
      if (!supports && assignIn) assignIn.value = '';
    }

    if (presetStep && presetStep.command) cmdEl.value = presetStep.command;
    const cmd = cmdEl.value.trim();
    const def = getRaleBuiltinDefForCommand(cmd);
    if (!def) {
      setSafeHTML(container, '');
      setRaleParamsBlockVisible(false);
      syncRaleAssignToVarRow();
      return;
    }
    const hasParams = Array.isArray(def.params) && def.params.length > 0;
    if (!hasParams) {
      setSafeHTML(container, '');
      setRaleParamsBlockVisible(false);
      syncRaleAssignToVarRow();
      return;
    }
    setRaleParamsBlockVisible(true);
    renderParamInputs(container, def.params, cmdEl, {});
    if (presetStep && presetStep.args && typeof presetStep.args === 'object') {
      applyRaleArgsToBuilderParams(container, cmd, presetStep.args);
    }
    syncRaleAssignToVarRow();
  }

  let steps: unknown[] = [];
  let importedScriptVersion = '1';
  let raleFunctions: unknown[] = [];
  const undoStack: unknown[][] = [];
  const redoStack: unknown[][] = [];
  let copiedStep: unknown = null;
  let selectedStepIndex: number | null = null;

  /** When true, show the add-step form (add mode only; update mode uses selectedStepIndex). */
  let addFormVisible = false;

  /** Where the next "Add Action" goes (add mode only). */
  let addPlacement: BuilderAddPlacement = { kind: 'root-end' };

  let placementHintEl: HTMLParagraphElement | null = null;

  const renderStepFieldsBase = createRenderStepFields({
    builderStepFields,
    builderAddSection,
    removeHoistedWaitRalePanel,
    queryWaitRalePanel,
    copyWaitTimingMediaPlayerToRale,
    copyWaitTimingRaleToMediaPlayer,
    refreshActionScriptRaleFields,
    getRaleFunctions: () => raleFunctions
  });

  function syncStepHelpButton(type: string) {
    if (!(builderStepHelpBtn instanceof HTMLElement)) return;
    const opt = builderStepTypeSelect?.selectedOptions[0];
    const typeLabel = opt?.textContent?.trim() || type;
    const fields = builderStepFields instanceof HTMLElement ? builderStepFields : null;
    const sub = fields ? collectActionStepHelpContext(type, fields) : null;
    const detail = sub?.subtitle ? ` · ${sub.subtitle}` : '';
    builderStepHelpBtn.title = S.actionScripts.helpTooltip(typeLabel, detail);
    builderStepHelpBtn.setAttribute('aria-label', S.actionScripts.helpTooltip(typeLabel, detail));
  }

  function renderStepFields(type: string) {
    renderStepFieldsBase(type);
    syncStepHelpButton(type);
  }

  const { populateFormFromStep, collectStepFromForm } = createBuilderStepForm({
    builderStepFields,
    builderStepTypeSelect,
    queryWaitRalePanel,
    refreshActionScriptRaleFields,
    renderStepFields
  });

  function pathsEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function addPlacementStillValid() {
    const p = addPlacement;
    if (p.kind === 'root-end') return true;
    const flat = flattenStepsPreorder(steps);
    if (p.kind === 'after') {
      return flat.some((e) => pathsEqual(e.path, p.path));
    }
    const s = getStepAtPath(steps, p.ifPath);
    return !!(s && (s as { type?: string }).type === 'if');
  }

  function ensurePlacementHintEl() {
    if (placementHintEl || !builderAddSection || !builderFormHeading) return;
    placementHintEl = document.createElement('p');
    placementHintEl.className = 'builder-add-placement-hint';
    placementHintEl.setAttribute('hidden', '');
    placementHintEl.style.cssText =
      'margin:0 0 10px;font-size:12px;line-height:1.45;color:var(--text-secondary);';
    builderFormHeading.insertAdjacentElement('afterend', placementHintEl);
  }

  function resetAddPlacementToRoot() {
    addPlacement = { kind: 'root-end' };
    updateAddPlacementHint();
  }

  function updateAddPlacementHint() {
    ensurePlacementHintEl();
    if (!placementHintEl) return;
    if (!addPlacementStillValid()) {
      addPlacement = { kind: 'root-end' };
    }
    placementHintEl.setAttribute('hidden', '');
    placementHintEl.replaceChildren();
  }

  function syncAddFormVisibility() {
    if (!builderAddForm) return;
    const show = selectedStepIndex != null || addFormVisible;
    if (show) builderAddForm.removeAttribute('hidden');
    else builderAddForm.setAttribute('hidden', '');
  }

  function snapshotSteps() {
    undoStack.push(JSON.parse(JSON.stringify(steps)));
    redoStack.length = 0;
  }

  function updateUndoRedoButtons() {
    if (builderUndoBtn) builderUndoBtn.disabled = undoStack.length === 0;
    if (builderRedoBtn) builderRedoBtn.disabled = redoStack.length === 0;
    if (builderClearBtn) builderClearBtn.disabled = steps.length === 0;
  }

  function scriptVersionForExport() {
    if (stepsTreeContainsIf(steps)) return '2';
    return importedScriptVersion === '2' ? '2' : '1';
  }

  function afterMutation() {
    renderStepsList();
    updateOutputPreview();
    updateUndoRedoButtons();
  }

  function applyAddModeChrome() {
    if (builderFormHeading) {
      builderFormHeading.textContent = S.actionScripts.addStep;
      builderFormHeading.classList.remove('builder-form-heading-update');
    }
    if (builderAddStepBtn) {
      builderAddStepBtn.textContent = S.actionScripts.addActionBtn;
      builderAddStepBtn.classList.remove('builder-btn-update');
    }
    if (builderCancelEditBtn) builderCancelEditBtn.style.display = 'none';
    if (builderAddSection) builderAddSection.classList.remove('builder-add-section-update');
  }

  function switchToAddMode() {
    selectedStepIndex = null;
    addFormVisible = false;
    applyAddModeChrome();
  }

  function openAddFormAtPlacement(placement: BuilderAddPlacement) {
    addPlacement = placement;
    if (!addPlacementStillValid()) addPlacement = { kind: 'root-end' };
    selectedStepIndex = null;
    addFormVisible = true;
    applyAddModeChrome();
    if (builderStepTypeSelect) renderStepFields(builderStepTypeSelect.value);
    renderStepsList();
    requestAnimationFrame(() => builderAddForm?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  function dismissBuilderAddSurface() {
    resetAddPlacementToRoot();
    addFormVisible = false;
    if (selectedStepIndex != null) {
      selectedStepIndex = null;
      applyAddModeChrome();
      if (builderStepTypeSelect) renderStepFields(builderStepTypeSelect.value);
    }
    renderStepsList();
  }

  function switchToUpdateMode(index) {
    selectedStepIndex = index;
    addFormVisible = false;
    resetAddPlacementToRoot();
    if (builderFormHeading) {
      builderFormHeading.textContent = S.actionScripts.updateStepHeading(index + 1);
      builderFormHeading.classList.add('builder-form-heading-update');
    }
    if (builderAddStepBtn) {
      builderAddStepBtn.textContent = S.actionScripts.updateActionBtn;
      builderAddStepBtn.classList.add('builder-btn-update');
    }
    if (builderCancelEditBtn) builderCancelEditBtn.style.display = 'inline-flex';
    if (builderAddSection) builderAddSection.classList.add('builder-add-section-update');
  }

  /**
   * Insert a deep clone of {@link copiedStep} at the given add-row placement.
   * @param {{ kind: 'root-end' } | { kind: 'after', path: Array<number|string> } | { kind: 'if-branch', ifPath: Array<number|string>, branch: 'then'|'else' }} placement
   */
  function pasteStepAtPlacement(placement: BuilderAddPlacement) {
    if (!copiedStep) return;
    const clone = JSON.parse(JSON.stringify(copiedStep));
    snapshotSteps();
    let ok = true;
    if (placement.kind === 'root-end') {
      steps.push(clone);
    } else if (placement.kind === 'after') {
      ok = insertStepAfterPath(steps, placement.path, clone);
      if (!ok) steps.push(clone);
    } else {
      ok = appendStepToIfBranch(steps, placement.ifPath, placement.branch, clone);
      if (!ok) steps.push(clone);
    }
    afterMutation();
    showToast(S.actionScripts.toastActionPasted, 'success');
  }

  /** True if `inner` points to a descendant of the step at `outer`. */
  function isPathInsideSubtree(inner: StepPath, outer: StepPath): boolean {
    if (inner.length <= outer.length) return false;
    for (let i = 0; i < outer.length; i++) {
      if (inner[i] !== outer[i]) return false;
    }
    return true;
  }

  /**
   * Reorder via drag-and-drop that respects nested `if` branches.
   * `fromIndex`/`toIndex` are preorder flat indices from the rendered list.
   * `toIndex === flat.length` means the bottom drop zone (append at root end).
   * Otherwise `fromIndex < toIndex` means dropped AFTER `flat[toIndex-1]`, and
   * `fromIndex > toIndex` means dropped BEFORE `flat[toIndex]`; the moved step
   * becomes a sibling of that reference step (which may live inside an if branch).
   */
  function reorderStep(fromIndex: number, toIndex: number) {
    const flat = flattenStepsPreorder(steps);
    if (fromIndex < 0 || fromIndex >= flat.length) return;
    if (fromIndex === toIndex) return;
    const fromEntry = flat[fromIndex];
    const fromPath = fromEntry.path;
    const selectedStep =
      selectedStepIndex != null ? flat[selectedStepIndex]?.step ?? null : null;

    let destParent: unknown[];
    let destIndex: number;

    if (toIndex >= flat.length) {
      destParent = steps;
      destIndex = steps.length;
    } else {
      const insertAfter = fromIndex < toIndex;
      const targetFlatIndex = insertAfter ? toIndex - 1 : toIndex;
      const targetEntry = flat[targetFlatIndex];
      if (!targetEntry) return;
      const targetPath = targetEntry.path;
      if (
        targetPath.length === fromPath.length &&
        targetPath.every((seg, i) => seg === fromPath[i])
      ) {
        return;
      }
      if (isPathInsideSubtree(targetPath, fromPath)) {
        showToast(S.actionScripts.toastCannotMoveIntoOwnBranch, 'error');
        return;
      }
      const targetLoc = getParentArrayAndIndex(steps, targetPath);
      if (!targetLoc) return;
      destParent = targetLoc.parent as unknown[];
      destIndex = insertAfter ? targetLoc.index + 1 : targetLoc.index;
    }

    const fromLoc = getParentArrayAndIndex(steps, fromPath);
    if (!fromLoc) return;

    snapshotSteps();
    const [moved] = (fromLoc.parent as unknown[]).splice(fromLoc.index, 1);
    if (destParent === fromLoc.parent && destIndex > fromLoc.index) destIndex--;
    destParent.splice(destIndex, 0, moved);

    if (selectedStep) {
      const newFlat = flattenStepsPreorder(steps);
      const newIdx = newFlat.findIndex((e) => e.step === selectedStep);
      if (newIdx >= 0) {
        selectedStepIndex = newIdx;
      } else {
        selectedStepIndex = null;
        switchToAddMode();
      }
    }

    afterMutation();
  }

  function renderStepsList() {
    if (!builderStepsList) return;
    const flat = flattenStepsPreorder(steps);
    renderBuilderSteps(builderStepsList, steps, {
      selectedIndex: selectedStepIndex,
      onSelectStep(idx) {
        const f = flattenStepsPreorder(steps);
        if (idx < 0 || idx >= f.length) return;
        selectedStepIndex = idx;
        const step = f[idx].step as Record<string, unknown>;
        renderStepFields(String(step.type ?? ''));
        populateFormFromStep(step);
        switchToUpdateMode(idx);
        renderStepsList();
        const row = builderStepsList.querySelector(`.steps-list-builder-row[data-index="${idx}"]`);
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
      onDelete(idx) {
        snapshotSteps();
        const f = flattenStepsPreorder(steps);
        const entry = f[idx];
        if (!entry) return;
        const removedSize = preorderStepSubtreeSize(entry.step);
        if (selectedStepIndex != null) {
          if (selectedStepIndex >= idx && selectedStepIndex < idx + removedSize) {
            selectedStepIndex = null;
            switchToAddMode();
          } else if (selectedStepIndex >= idx + removedSize) {
            selectedStepIndex -= removedSize;
          }
        }
        removeStepAtPath(steps, entry.path);
        afterMutation();
      },
      onReorder: (fromIndex, toIndex) => reorderStep(fromIndex, toIndex),
      onCopyStep(idx) {
        const f = flattenStepsPreorder(steps);
        if (idx < 0 || idx >= f.length) return;
        copiedStep = JSON.parse(JSON.stringify(f[idx].step));
        showToast(S.actionScripts.toastActionCopied, 'success');
        renderStepsList();
        requestAnimationFrame(() => {
          const row = builderStepsList?.querySelector(`.steps-list-builder-row[data-index="${idx}"]`);
          if (row) {
            row.classList.add('steps-list-row-copied');
            setTimeout(() => row.classList.remove('steps-list-row-copied'), 1400);
          }
        });
      },
      onOpenAddForm(placement) {
        openAddFormAtPlacement(placement);
      },
      hasCopiedStep: !!copiedStep,
      onPasteStep(placement) {
        pasteStepAtPlacement(placement);
      }
    });
    const flatLen = flat.length;
    if (builderCopyToExecutorBtn) builderCopyToExecutorBtn.disabled = flatLen < 1;
    if (builderCopyJsonBtn) builderCopyJsonBtn.disabled = flatLen < 1;
    if (builderSaveScriptBtn) builderSaveScriptBtn.disabled = flatLen < 1;
    updateUndoRedoButtons();
    updateAddPlacementHint();
    syncAddFormVisibility();
  }

  function updateOutputPreview() {
    const script = { version: scriptVersionForExport(), steps };
    const json = JSON.stringify(script, null, 2);
    if (builderOutputPreview) {
      builderOutputPreview.textContent = json;
    }
    const n = flattenStepsPreorder(steps).length;
    if (builderCopyToExecutorBtn) builderCopyToExecutorBtn.disabled = n < 1;
    if (builderCopyJsonBtn) builderCopyJsonBtn.disabled = n < 1;
    if (builderSaveScriptBtn) builderSaveScriptBtn.disabled = n < 1;
    return json;
  }

  if (builderStepTypeSelect) {
    setSafeHTML(builderStepTypeSelect, STEP_TYPES.map(t => {
      const meta = STEP_SCHEMA[t];
      return `<option value="${t}">${meta ? meta.label : t}</option>`;
    }).join(''));

    builderStepTypeSelect.addEventListener('change', () => {
      const v = builderStepTypeSelect.value;
      if (v !== 'systemTelnet') {
        builderStepTypeSelect.querySelector('option[value="systemTelnet"]')?.remove();
      }
      renderStepFields(builderStepTypeSelect.value);
    });
    renderStepFields(builderStepTypeSelect.value);
  }

  builderAddStepBtn.addEventListener('click', () => {
    const type = builderStepTypeSelect ? builderStepTypeSelect.value : 'query';
    if (type === 'devicePerformance') {
      const chartEl = builderStepFields?.querySelector(
        '.builder-field-device-performance-chart'
      ) as HTMLSelectElement | null;
      const chart = chartEl && chartEl.value ? chartEl.value.trim() : '';
      if (!chart) {
        showToast(S.actionScripts.toastChooseChartType, 'error');
        return;
      }
    }
    const step = collectStepFromForm(type) as Record<string, unknown>;
    if (type === 'if') {
      if (selectedStepIndex != null) {
        const prev = flattenStepsPreorder(steps)[selectedStepIndex]?.step as Record<string, unknown> | undefined;
        if (prev && prev.type === 'if') {
          step.then = Array.isArray(prev.then) ? JSON.parse(JSON.stringify(prev.then)) : [];
          step.else = Array.isArray(prev.else) ? JSON.parse(JSON.stringify(prev.else)) : [];
        } else {
          ensureIfBranches(step);
        }
      } else {
        ensureIfBranches(step);
      }
    }
    if (selectedStepIndex != null) {
      snapshotSteps();
      const flat = flattenStepsPreorder(steps);
      const path = flat[selectedStepIndex]?.path;
      if (path && replaceStepAtPath(steps, path, step)) {
        const updatedIndex = selectedStepIndex;
        switchToAddMode();
        afterMutation();
        const actionNumber = updatedIndex + 1;
        showToast(S.actionScripts.toastUpdatedAction(actionNumber), 'success');
        requestAnimationFrame(() => {
          const row = builderStepsList?.querySelector(`.steps-list-builder-row[data-index="${updatedIndex}"]`);
          if (row) {
            row.classList.add('steps-list-row-updated');
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            setTimeout(() => row.classList.remove('steps-list-row-updated'), 2200);
          }
        });
      }
    } else {
      snapshotSteps();
      let ok = true;
      if (addPlacement.kind === 'root-end') {
        steps.push(step);
      } else if (addPlacement.kind === 'after') {
        ok = insertStepAfterPath(steps, addPlacement.path, step);
        if (!ok) steps.push(step);
      } else {
        ok = appendStepToIfBranch(steps, addPlacement.ifPath, addPlacement.branch, step);
        if (!ok) steps.push(step);
      }
      resetAddPlacementToRoot();
      addFormVisible = false;
      afterMutation();
    }
  });

  if (builderAddFormDismiss) {
    builderAddFormDismiss.addEventListener('click', () => dismissBuilderAddSurface());
  }

  if (builderStepHelpBtn) {
    builderStepHelpBtn.addEventListener('click', () => {
      const t = builderStepTypeSelect?.value || 'query';
      const fields = builderStepFields instanceof HTMLElement ? builderStepFields : null;
      openActionStepHelpModal(t, fields, builderStepHelpBtn, () => raleFunctions);
    });
  }

  if (builderAddSection) {
    builderAddSection.addEventListener('change', () => {
      const t = builderStepTypeSelect?.value;
      if (t) syncStepHelpButton(t);
    });
  }

  if (builderCancelEditBtn) {
    builderCancelEditBtn.addEventListener('click', () => {
      dismissBuilderAddSurface();
    });
  }

  builderCopyJsonBtn.addEventListener('click', () => {
    const json = updateOutputPreview();
    if (window.roku && window.roku.copyToClipboard) {
      window.roku.copyToClipboard(json);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json);
    }
    if (builderCopyJsonBtn) builderCopyJsonBtn.textContent = S.actionScripts.copiedFeedback;
    setTimeout(() => { builderCopyJsonBtn.textContent = S.actionScripts.copyActionScriptBtn; }, 2000);
  });

  if (builderCopyToExecutorBtn && typeof onCopyToExecutor === 'function') {
    builderCopyToExecutorBtn.addEventListener('click', () => {
      const json = updateOutputPreview();
      onCopyToExecutor(json, builderCopyToExecutorBtn);
    });
  }

  builderSaveScriptBtn.addEventListener('click', async () => {
    if (!window.roku || !window.roku.actionScriptShowSaveScriptDialog) return;
    const res = await window.roku.actionScriptShowSaveScriptDialog();
    if (res.canceled || !res.filePath) return;
    const json = updateOutputPreview();
    const writeRes = await window.roku.actionScriptWriteFile({ filePath: res.filePath, content: json, encoding: 'utf8' });
    if (writeRes.success) {
      builderSaveScriptBtn.textContent = S.actionScripts.savedFeedback;
      setTimeout(() => { builderSaveScriptBtn.textContent = S.actionScripts.saveActionScriptBtn; }, 2000);
    }
  });

  /* Undo / Redo / Clear All */
  if (builderUndoBtn) {
    builderUndoBtn.addEventListener('click', () => {
      if (undoStack.length === 0) return;
      redoStack.push(JSON.parse(JSON.stringify(steps)));
      const prevSteps = undoStack.pop();
      if (prevSteps) steps = prevSteps;
      if (selectedStepIndex != null && selectedStepIndex >= flattenStepsPreorder(steps).length) {
        switchToAddMode();
      }
      afterMutation();
    });
  }
  if (builderRedoBtn) {
    builderRedoBtn.addEventListener('click', () => {
      if (redoStack.length === 0) return;
      undoStack.push(JSON.parse(JSON.stringify(steps)));
      const nextSteps = redoStack.pop();
      if (nextSteps) steps = nextSteps;
      if (selectedStepIndex != null && selectedStepIndex >= flattenStepsPreorder(steps).length) {
        switchToAddMode();
      }
      afterMutation();
    });
  }
  if (builderClearBtn) {
    builderClearBtn.addEventListener('click', () => {
      if (steps.length === 0) return;
      snapshotSteps();
      steps = [];
      switchToAddMode();
      afterMutation();
    });
  }

  /**
   * Load script JSON into the builder (parse, optional RALE fetch, validate, replace steps).
   * @returns Whether the script was applied; on failure `message` describes the error.
   */
  async function importFromValidatedJson(text: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const raw = (text || '').trim();
    if (!raw) return { ok: false, message: S.actionScripts.msgNoScriptJson };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { ok: false, message: S.actionScripts.invalidJson(errMsg(e)) };
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { steps?: unknown }).steps)) {
      return { ok: false, message: S.actionScripts.msgStepsArray };
    }
    const stepsArray = (parsed as { steps: unknown[] }).steps;
    const needsRale = scriptNeedsRaleConnection({ steps: stepsArray });
    if (needsRale && api && api.raleCommand) {
      const ok = await fetchAppFunctionsForBuilder(panel, api, (f) => {
        raleFunctions = f && Array.isArray(f) ? f : [];
      });
      if (!ok) raleFunctions = [];
    }
    const result = parseAndValidateScript(raw, raleFunctions);
    if (result.parseError) {
      return { ok: false, message: S.actionScripts.invalidJson(result.parseError) };
    }
    const importValidation = result.validation;
    if (!importValidation || !importValidation.valid) {
      const flatLabels = flattenStepsPreorder(stepsArray);
      const errLines = (importValidation?.errors || []).map((e) =>
        e.stepIndex != null
          ? S.actionScripts.actionLabel(stepPathToDisplayId(flatLabels[e.stepIndex] && flatLabels[e.stepIndex].path, e.stepIndex), e.message)
          : e.message
      );
      return { ok: false, message: S.actionScripts.msgValidation(errLines.join('\n')) };
    }
    snapshotSteps();
    steps = result.script.steps || [];
    importedScriptVersion =
      result.script.version != null && String(result.script.version).trim() === '2' ? '2' : '1';
    switchToAddMode();
    afterMutation();
    return { ok: true };
  }

  /* Keyboard shortcuts: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z (redo), Ctrl/Cmd+V (paste step) */
  const builderSection = builderStepsList && builderStepsList.closest('.action-scripts-builder-content');
  const shortcutTarget = builderSection || panel;
  shortcutTarget.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (selectedStepIndex != null || addFormVisible)) {
      dismissBuilderAddSurface();
      return;
    }
    // Ignore if user is typing in an input or textarea
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;

    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (builderUndoBtn && !builderUndoBtn.disabled) builderUndoBtn.click();
    } else if ((e.key === 'z' && e.shiftKey) || (e.key === 'y')) {
      e.preventDefault();
      if (builderRedoBtn && !builderRedoBtn.disabled) builderRedoBtn.click();
    } else if (e.key === 'v') {
      if (!copiedStep) return;
      e.preventDefault();
      pasteStepAtPlacement({ kind: 'root-end' });
    }
  });

  renderStepsList();
  updateOutputPreview();
  updateUndoRedoButtons();

  return {
    setRaleFunctions(functions) {
      raleFunctions = functions || [];
      if (builderStepTypeSelect && builderStepTypeSelect.value === 'appFunction') {
        renderStepFields('appFunction');
      }
    },
    getRaleFunctions() {
      return Array.isArray(raleFunctions) ? raleFunctions : [];
    },
    getScript() {
      return { version: scriptVersionForExport(), steps: [...steps] };
    },
    importFromValidatedJson
  };
}

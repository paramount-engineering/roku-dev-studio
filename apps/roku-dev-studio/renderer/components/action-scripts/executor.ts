/**
 * Action Script Executor UI: paste/upload script, validate, save folder, Run, split view (steps | results).
 */

import { parseAndValidateScript } from './validator.js';
import { withFlattenedFieldList } from '../inspector/node-lookup.js';
import { stripFieldlistMetaForDisplay } from '../inspector/inspector-node-update-helpers.js';
import { scriptHasSaveActions, scriptNeedsPassword, scriptNeedsRaleConnection } from './action-registry.js';
import { runScript, stepDescription } from './executor-engine.js';
import { getAppConnector } from '../../modules/app-connector/index.js';
import {
  ensureRaleFunctionsWhenScriptNeedsRale,
  optionalRaleFunctionsForScript
} from './script-rale-validation.js';
import { escapeHtml, setSafeHTML } from '../../modules/utils/index.js';
import { rendererError } from '../../modules/utils/logger.js';
import { prettyJson, prettyXmlLenient } from '../../modules/ui/structured-body.js';
import { attachSelectAll } from '../../modules/ui/select-all.js';
import { getActionScriptDefaultSaveFolder } from '../../modules/utils/app-user-settings.js';
import { renderExecutorSteps } from './actions-list-view.js';
import { flattenStepsPreorder, stepPathToDisplayId } from './action-script-tree.js';
import { S } from '@shared/strings/index.js';

/** Parsed script object kept after successful validation (executor UI + run). */
type ExecutorScript = { steps?: unknown[] } & Record<string, unknown>;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Preorder step count (v2 nested scripts use flat indices for UI + run callbacks). */
function flatStepCount(script: ExecutorScript | null | undefined) {
  if (!script || !Array.isArray(script.steps)) return 0;
  return flattenStepsPreorder(script.steps).length;
}

function errorIndicesFromValidationErrors(errors: Array<{ stepIndex?: number }> | null | undefined) {
  const s = new Set<number>();
  for (const e of errors || []) {
    if (typeof e.stepIndex === 'number' && e.stepIndex >= 0) s.add(e.stepIndex);
  }
  return s;
}

function firstErrorStepIndex(indexSet: Set<number> | null | undefined) {
  if (!indexSet || indexSet.size === 0) return null;
  return Math.min(...indexSet);
}

export function setupExecutor(panel, api, context) {
  const {
    executorTextarea,
    executorUploadBtn,
    executorValidateBtn,
    executorValidationMessage,
    executorSaveFolderDisplay,
    executorSaveFolderBtn,
    executorConnectConsoleCheckbox,
    executorRunBtn,
    executorStopBtn,
    executorClearActionsBtn,
    executorResultsCopyBtn,
    executorResultsSaveBtn,
    executorResultsClearBtn,
    executorStepsList,
    executorResults,
    executorWarningNoFolder,
    executorPasswordPrompt,
    executorPasswordInput
  } = context.elements;
  const getRaleFunctionsFromBuilder = context.getRaleFunctions || null;

  if (!executorTextarea || !executorValidateBtn || !executorRunBtn) return;

  // Cmd/Ctrl+A selects all the executor results text (when the results pane is focused).
  if (executorResults instanceof HTMLElement) attachSelectAll(executorResults);

  let chosenSaveFolder: string | null = null;
  let lastValidScript: ExecutorScript | null = null;
  /** Raw JSON (trimmed) that last passed full Validate; Run reuses `lastValidScript` until text changes or Clear — leaving the Action Scripts inner tab only sets `runRequiresFreshValidation`. */
  let lastValidatedRaw: string | null = null;
  /**
   * After switching away from Action Scripts, Run is disabled until the user returns (if JSON still
   * matches last validation, we clear this automatically) or re-validates via Import modal / Validate.
   */
  let runRequiresFreshValidation = false;
  let raleFunctions: unknown[] | null = null;
  let currentResultCardBody: HTMLElement | null = null;
  let userScrolledSteps = false;
  let scrollProgrammatic = false;
  let stepStates: Array<'pending' | 'executing' | 'done' | 'error' | 'skipped'> = [];
  let skippedSet = new Set<number>();

  /* Run / Pause / Stop state */
  let isRunning = false;
  let isPaused = false;
  let isStopped = false;

  function updateRunStopUI() {
    if (!executorRunBtn) return;
    const useEl = executorRunBtn.querySelector('use');
    if (isRunning && !isPaused) {
      // Show pause icon while running
      if (useEl) useEl.setAttribute('href', '#icon-pause');
      executorRunBtn.title = S.actionScripts.runBtnPause;
      executorRunBtn.disabled = false;
    } else if (isRunning && isPaused) {
      // Show play icon to resume
      if (useEl) useEl.setAttribute('href', '#icon-play');
      executorRunBtn.title = S.actionScripts.runBtnResume;
      executorRunBtn.disabled = false;
    } else {
      // Idle: show play icon
      if (useEl) useEl.setAttribute('href', '#icon-play');
      executorRunBtn.title = S.actionScripts.runBtnRun;
    }
    if (executorStopBtn) {
      executorStopBtn.disabled = !isRunning;
    }
    updateResultsButtons();
    updateExecutorClearActionsBtn();
  }

  function showExecutorStepsEmptyState() {
    if (!executorStepsList) return;
    setSafeHTML(executorStepsList, `
      <div class="executor-steps-list-empty">
        <p class="executor-steps-list-empty-text">
          ${S.actionScripts.emptyNoActions}
        </p>
      </div>
    `);
  }

  function updateExecutorClearActionsBtn() {
    const hasSteps = lastValidScript && lastValidScript.steps && lastValidScript.steps.length > 0;
    if (executorClearActionsBtn) {
      executorClearActionsBtn.disabled = !hasSteps || isRunning;
    }
  }

  function resetRunState() {
    isRunning = false;
    isPaused = false;
    isStopped = false;
    updateRunStopUI();
    updateRunButtonState();
    updateResultsButtons();
  }

  /**
   * After a run completes, fade out the step highlight colors,
   * then reset all states to 'pending' so Skip/Unskip buttons return.
   */
  function fadeOutAndResetSteps() {
    if (!executorStepsList || !lastValidScript) return;
    const rows = executorStepsList.querySelectorAll('.steps-list-executor-row');
    // First: strip coloured classes so the CSS transition kicks in (rows fade to transparent)
    rows.forEach(row => {
      row.classList.remove('executor-step-executing', 'executor-step-done', 'executor-step-error', 'executor-step-skipped');
      row.classList.add('executor-step-pending');
    });
    // After the CSS transition ends (~600ms), fully reset and re-render with skip/unskip buttons
    setTimeout(() => {
      const stepCount = flatStepCount(lastValidScript);
      stepStates = Array(stepCount).fill('pending');
      // Preserve the skippedSet the user had before the run
      renderExecutorStepsList(lastValidScript);
    }, 650);
  }

  const appConnector = getAppConnector(panel, api);
  const getPassword = () => {
    // Priority: executor password prompt > device panel dev-password input
    if (executorPasswordInput && executorPasswordInput.value) return executorPasswordInput.value;
    const pw = panel.querySelector('.dev-password');
    return pw instanceof HTMLInputElement ? pw.value : '';
  };

  function showPasswordPrompt() {
    if (executorPasswordPrompt) executorPasswordPrompt.style.display = 'block';
  }
  function hidePasswordPrompt() {
    if (executorPasswordPrompt) executorPasswordPrompt.style.display = 'none';
  }

  function setSaveFolder(path) {
    chosenSaveFolder = path;
    if (executorSaveFolderDisplay) {
      executorSaveFolderDisplay.textContent = path || S.actionScripts.noFolderSelected;
      executorSaveFolderDisplay.title = path || '';
    }
    if (executorSaveFolderBtn) executorSaveFolderBtn.style.display = path ? 'inline-flex' : 'none';
    updateRunButtonState();
  }

  function updateRunButtonState() {
    if (!executorRunBtn) return;
    if (isRunning) return; // Don't override during a run (pause/resume managed elsewhere)
    const hasSaveActions = lastValidScript && scriptHasSaveActions(lastValidScript);
    const canRun =
      lastValidScript &&
      !runRequiresFreshValidation &&
      (!hasSaveActions || chosenSaveFolder);
    executorRunBtn.disabled = !canRun;
    if (executorWarningNoFolder) {
      executorWarningNoFolder.style.display = hasSaveActions && !chosenSaveFolder ? 'block' : 'none';
    }
  }

  function updateResultsButtons() {
    const hasResults = !!(executorResults && executorResults.querySelector('.executor-result-block'));
    if (executorResultsCopyBtn) executorResultsCopyBtn.disabled = !hasResults;
    if (executorResultsSaveBtn) executorResultsSaveBtn.disabled = !hasResults;
    if (executorResultsClearBtn) {
      executorResultsClearBtn.disabled = !hasResults || isRunning;
    }
  }

  function clearResultsRunInfo() {
    const panel = executorResults && executorResults.closest('.executor-results-panel');
    const el = panel && panel.querySelector('.executor-results-panel-run-info');
    if (el) el.textContent = '';
  }

  /** Clear results DOM and run info. Releases in-memory data (screenshots) so Save has nothing until next run. */
  function clearResults() {
    if (isRunning) return;
    if (!executorResults) return;
    setSafeHTML(executorResults, `<p class="executor-results-placeholder">${S.actionScripts.resultsPlaceholder}</p>`);
    clearResultsRunInfo();
    updateResultsButtons();
  }

  // Connect to Console: auto-connect telnet when checkbox is checked.
  // Uses the telnet panel's exported `connectTelnet()` method instead of
  // synthesizing a click on `.telnet-connect-btn`, which would silently break
  // if the Telnet tab's markup changed.
  if (executorConnectConsoleCheckbox) {
    executorConnectConsoleCheckbox.addEventListener('change', () => {
      if (!executorConnectConsoleCheckbox.checked) return;
      if (typeof panel.isTelnetConnected === 'function' && panel.isTelnetConnected()) return;
      if (typeof panel.connectTelnet === 'function') {
        void panel.connectTelnet();
      }
    });
  }

  function renderExecutorStepsList(script: ExecutorScript | null) {
    if (!executorStepsList || !script) return;
    renderExecutorSteps(executorStepsList, script, {
      stepStates,
      skippedSet,
      onSkip(i) {
        skippedSet.add(i);
        renderExecutorStepsList(lastValidScript);
      },
      onUnskip(i) {
        skippedSet.delete(i);
        renderExecutorStepsList(lastValidScript);
      },
      onReorder(fromIndex, toIndex) {
        if (!lastValidScript || !lastValidScript.steps || isRunning) return;
        const stepsArr = lastValidScript.steps;
        const [moved] = stepsArr.splice(fromIndex, 1);
        const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
        stepsArr.splice(insertIndex, 0, moved);
        // Reorder the states and skipped set to match
        const [movedState] = stepStates.splice(fromIndex, 1);
        stepStates.splice(insertIndex, 0, movedState);
        const wasSkipped = skippedSet.has(fromIndex);
        // Rebuild skippedSet with shifted indices
        const newSkipped = new Set<number>();
        skippedSet.forEach((idx: number) => {
          if (idx === fromIndex) return; // handled separately
          let adjusted = idx;
          if (fromIndex < toIndex) {
            if (idx > fromIndex && idx <= insertIndex) adjusted = idx - 1;
          } else {
            if (idx >= insertIndex && idx < fromIndex) adjusted = idx + 1;
          }
          newSkipped.add(adjusted);
        });
        if (wasSkipped) newSkipped.add(insertIndex);
        skippedSet = newSkipped;
        renderExecutorStepsList(lastValidScript);
      }
    });
  }

  function setStepState(index, state) {
    stepStates[index] = state;
    if (!executorStepsList) return;
    const row = executorStepsList.querySelector(`[data-step-index="${index}"]`);
    if (!row) return;
    row.classList.remove('executor-step-pending', 'executor-step-executing', 'executor-step-done', 'executor-step-error', 'executor-step-skipped');
    row.classList.add(state === 'error' ? 'executor-step-error' : state === 'executing' ? 'executor-step-executing' : state === 'skipped' ? 'executor-step-skipped' : 'executor-step-done');
    if (state !== 'pending') {
      const actionCell = row.querySelector('.steps-list-action');
      if (actionCell) setSafeHTML(actionCell, '<span class="steps-list-action-empty"></span>');
    }
  }

  function scrollStepIntoView(index) {
    if (!executorStepsList || userScrolledSteps) return;
    const row = executorStepsList.querySelector(`[data-step-index="${index}"]`);
    if (row) {
      scrollProgrammatic = true;
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      requestAnimationFrame(() => { scrollProgrammatic = false; });
    }
  }

  /** Scroll to a step after validation errors (ignores userScrolledSteps). */
  function scrollValidationErrorStepIntoView(index) {
    if (!executorStepsList || index == null || index < 0) return;
    const row = executorStepsList.querySelector(`[data-step-index="${index}"]`);
    if (!row) return;
    userScrolledSteps = false;
    scrollProgrammatic = true;
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    requestAnimationFrame(() => { scrollProgrammatic = false; });
  }

  function invalidateValidatedScript(mutedUserMessage) {
    runRequiresFreshValidation = false;
    lastValidScript = null;
    lastValidatedRaw = null;
    showExecutorStepsEmptyState();
    updateRunButtonState();
    updateExecutorClearActionsBtn();
    if (executorValidationMessage && mutedUserMessage) {
      setSafeHTML(executorValidationMessage, '<span class="validation-muted">' + escapeHtml(mutedUserMessage) + '</span>');
      executorValidationMessage.style.display = 'block';
    }
  }

  /**
   * Show steps read-only with validation-error highlighting; does not set lastValidScript.
   * @param {object} script - Must have steps[] (parsed object).
   * @param {Set<number>} errorIndexSet
   */
  function renderValidationFailureStepList(script: ExecutorScript, errorIndexSet: Set<number> | null | undefined) {
    if (!executorStepsList || !script || !Array.isArray(script.steps) || script.steps.length === 0) {
      showExecutorStepsEmptyState();
      return;
    }
    const n = flatStepCount(script);
    stepStates = Array(n).fill('pending');
    skippedSet = new Set();
    renderExecutorSteps(executorStepsList, script, {
      stepStates,
      skippedSet,
      onSkip: () => {},
      onUnskip: () => {},
      validationErrorIndices: errorIndexSet && errorIndexSet.size ? errorIndexSet : new Set(),
      readOnlyList: true
    });
    const scrollTo = firstErrorStepIndex(errorIndexSet);
    if (scrollTo != null) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollValidationErrorStepIntoView(scrollTo));
      });
    }
  }

  let waitSpinnerEl: HTMLElement | null = null;

  function appendToResultCard(msg, isError = false) {
    if (!currentResultCardBody) return;
    const line = document.createElement('div');
    line.className = isError ? 'log-line log-error' : 'log-line';
    line.textContent = msg;
    currentResultCardBody.appendChild(line);
    if (executorResults) executorResults.scrollTop = executorResults.scrollHeight;
  }

  function setWaitSpinner(show) {
    if (show) {
      if (!currentResultCardBody || waitSpinnerEl) return;
      waitSpinnerEl = document.createElement('div');
      waitSpinnerEl.className = 'executor-wait-spinner-wrap';
      waitSpinnerEl.setAttribute('aria-live', 'polite');
      setSafeHTML(waitSpinnerEl, `<span class="executor-wait-spinner" aria-hidden="true"></span><span class="executor-wait-spinner-label">${S.actionScripts.waiting}</span>`);
      currentResultCardBody.appendChild(waitSpinnerEl);
      if (executorResults) executorResults.scrollTop = executorResults.scrollHeight;
    } else {
      if (waitSpinnerEl && waitSpinnerEl.parentNode) {
        waitSpinnerEl.remove();
      }
      waitSpinnerEl = null;
    }
  }

  function startResultCard(headerText, depth = 0) {
    if (!executorResults) return;
    const block = document.createElement('div');
    block.className = 'executor-result-block';
    const d = Math.min(12, Math.max(0, typeof depth === 'number' ? depth : 0));
    block.dataset.stepDepth = String(d);
    if (d > 0) block.style.marginLeft = `${d * 12}px`;
    setSafeHTML(block, `
      <div class="executor-result-block-header">${escapeHtml(headerText)}</div>
      <div class="executor-result-block-body"></div>
      <div class="executor-result-block-status" style="display:none;"></div>
    `);
    currentResultCardBody = block.querySelector('.executor-result-block-body');
    executorResults.appendChild(block);
    executorResults.scrollTop = executorResults.scrollHeight;
  }

  /**
   * @param {string} [screenshotUrl]
   * @param {{ pngDataUrls?: string[], pngCaptions?: string[], htmlFragments?: string[] } | null} [devicePerformance]
   */
  function finishResultCard(isError, statusText, outputContent, screenshotUrl, devicePerformance) {
    setWaitSpinner(false);
    if (!currentResultCardBody) return;
    const block = currentResultCardBody.closest('.executor-result-block');
    if (block) {
      const statusEl = block.querySelector('.executor-result-block-status');
      if (statusEl instanceof HTMLElement) {
        statusEl.style.display = '';
        statusEl.className = `executor-result-block-status ${isError ? 'error' : 'success'}`;
        statusEl.textContent = statusText || (isError ? S.actionScripts.statusFailed : S.actionScripts.statusOk);
      }
      if (screenshotUrl) {
        const img = document.createElement('img');
        img.className = 'executor-result-screenshot';
        img.src = screenshotUrl;
        img.alt = S.actionScripts.altScreenshot;
        // Preserve data URL for PDF export (browser may replace img.src with blob:)
        if (typeof screenshotUrl === 'string' && screenshotUrl.startsWith('data:')) {
          img.setAttribute('data-rtf-src', screenshotUrl);
        }
        currentResultCardBody.appendChild(img);
      }
      if (devicePerformance && Array.isArray(devicePerformance.pngDataUrls)) {
        const urls = devicePerformance.pngDataUrls;
        const caps = devicePerformance.pngCaptions || [];
        for (let i = 0; i < urls.length; i++) {
          const cap = caps[i];
          if (cap) {
            const h4 = document.createElement('h4');
            h4.className = 'executor-performance-h4';
            h4.textContent = cap;
            currentResultCardBody.appendChild(h4);
          }
          const url = urls[i];
          if (typeof url !== 'string' || !url) continue;
          const img = document.createElement('img');
          img.className = 'executor-result-screenshot executor-result-performance-chart';
          img.src = url;
          img.alt = cap || S.actionScripts.altDevicePerformanceChart;
          if (url.startsWith('data:')) {
            img.setAttribute('data-rtf-src', url);
          }
          currentResultCardBody.appendChild(img);
        }
        const frags = devicePerformance.htmlFragments;
        if (Array.isArray(frags)) {
          for (const html of frags) {
            if (!html) continue;
            const box = document.createElement('div');
            box.className = 'executor-performance-html-wrap';
            setSafeHTML(box, html);
            currentResultCardBody.appendChild(box);
          }
        }
      }
      if (outputContent) {
        const out = document.createElement('div');
        out.className = 'executor-result-output';
        out.textContent = outputContent;
        currentResultCardBody.appendChild(out);
      }
    }
    currentResultCardBody = null;
    if (executorResults) executorResults.scrollTop = executorResults.scrollHeight;
  }

  /**
   * Pretty-print structured output for display and PDF: XML indentation, JSON with 2-space indent.
   * Used for query (including telnet:… endpoints), appFunction, raleCommand, and legacy systemTelnet result data.
   */
  function formatStructuredOutput(data) {
    if (data == null) return '';
    if (typeof data !== 'string') {
      return JSON.stringify(data, null, 2);
    }
    const s = data.trim();
    if (!s) return '';
    if (s.startsWith('{') || s.startsWith('[')) {
      return prettyJson(s) ?? data;
    }
    if (s.startsWith('<') || s.startsWith('<?xml')) {
      // Lenient (best-effort, never throws) — step output can be partial / non-well-formed, so the
      // strict DOMParser `prettyXml` would bail. Shared with the PDF export via structured-body.
      return prettyXmlLenient(s);
    }
    return data;
  }

  function formatStepResult(step, result) {
    if (!result || result.success === false) return result && result.error ? result.error : '';
    if (result.skipped && result.skippedReason) return result.skippedReason;
    if (!step || !step.type) return '';
    if (step.type === 'devicePerformance' && result.success && result.textSummary) {
      return String(result.textSummary);
    }
    if (
      result.data != null &&
      (step.type === 'query' ||
        step.type === 'appFunction' ||
        step.type === 'raleCommand' ||
        step.type === 'systemTelnet')
    ) {
      let displayData = result.data;
      if (step.type === 'raleCommand') {
        displayData = stripFieldlistMetaForDisplay(withFlattenedFieldList(result.data));
      }
      return formatStructuredOutput(displayData);
    }
    return '';
  }

  // Validate
  executorValidateBtn.addEventListener('click', async () => {
    const raw = executorTextarea.value.trim();
    if (executorValidationMessage) {
      executorValidationMessage.style.display = 'block';
      setSafeHTML(executorValidationMessage, `<span class="validation-muted">${S.actionScripts.validating}</span>`);
    }
    if (!raw) {
      if (executorValidationMessage) {
        setSafeHTML(executorValidationMessage, `<span class="validation-error">${S.actionScripts.errPasteOrUpload}</span>`);
      }
      return;
    }

    // Step 1: If script needs RALE (appFunction, raleCommand, rale-node-field wait), run App Connector validation (block on failure).
    let scriptUsesRale = false;
    let parsed: ExecutorScript | null = null;
    try {
      parsed = JSON.parse(raw) as ExecutorScript;
      scriptUsesRale = !!(parsed && scriptNeedsRaleConnection(parsed));
    } catch (_) {}

    raleFunctions = [];
    if (scriptUsesRale && api && api.raleCommand) {
      const raleRes = await ensureRaleFunctionsWhenScriptNeedsRale(panel, api, getRaleFunctionsFromBuilder);
      if (!raleRes.ok) {
        if (executorValidationMessage) {
          setSafeHTML(executorValidationMessage, '<span class="validation-error">' + escapeHtml(raleRes.error) + '</span>');
          executorValidationMessage.style.display = 'block';
        }
        lastValidScript = null;
        lastValidatedRaw = null;
        hidePasswordPrompt();
        showExecutorStepsEmptyState();
        if (executorResults) executorResults.innerHTML = '';
        clearResultsRunInfo();
        updateRunButtonState();
        updateExecutorClearActionsBtn();
        return;
      }
      raleFunctions = raleRes.raleFunctions ?? [];
    } else {
      const rf = await optionalRaleFunctionsForScript(panel, api, getRaleFunctionsFromBuilder);
      raleFunctions = Array.isArray(rf) ? rf : [];
    }

    const result = parseAndValidateScript(raw, raleFunctions);
    if (result.parseError) {
      if (executorValidationMessage) {
        setSafeHTML(executorValidationMessage, '<span class="validation-error">' + escapeHtml(S.actionScripts.invalidJson(result.parseError)) + '</span>');
        executorValidationMessage.style.display = 'block';
      }
      lastValidScript = null;
      lastValidatedRaw = null;
      hidePasswordPrompt();
      showExecutorStepsEmptyState();
      if (executorResults) executorResults.innerHTML = '';
      clearResultsRunInfo();
      updateRunButtonState();
      updateExecutorClearActionsBtn();
      return;
    }

    const validation = result.validation;
    if (!validation || !validation.valid) {
      const errors = validation?.errors || [];
      const steps = (result.script && result.script.steps) || (parsed && parsed.steps) || [];
      const missingNames = errors
        .filter((e) => e.message && String(e.message).includes('not found'))
        .map((e) => {
          const si = e.stepIndex;
          const row = typeof si === 'number' ? (steps as Record<string, unknown>[])[si] : undefined;
          return row && typeof row.functionName === 'string' ? row.functionName : null;
        })
        .filter(Boolean);
      if (missingNames.length > 0) {
        const list = Array.from(new Set(missingNames)).filter(Boolean).join(', ');
        const msg = S.actionScripts.errMissingAppFunctions(list || '?');
        if (executorValidationMessage) {
          setSafeHTML(executorValidationMessage, '<span class="validation-error">' + escapeHtml(msg) + '</span>');
          executorValidationMessage.style.display = 'block';
        }
      } else {
        const flatLabels = flattenStepsPreorder(steps as unknown[]);
        const errLines = errors
          .map((e: {
            stepIndex?: number;
            message: string;
            code?: string;
            expected?: string | string[];
          }) => {
            const head =
              e.stepIndex != null
                ? S.actionScripts.actionLabel(stepPathToDisplayId(flatLabels[e.stepIndex] && flatLabels[e.stepIndex].path, e.stepIndex), e.message)
                : e.message;
            // Inline hint: show allowed values when the canonical validator
            // returned an `expected` enum so the user knows the fix.
            // (Phase 0b — Q1=b inline hints from `.discussion-docs/unified-action-script-validation.md`.)
            if (Array.isArray(e.expected) && e.expected.length > 0) {
              return `${head}${S.actionScripts.expectedSuffix(e.expected.join(', '))}`;
            }
            if (typeof e.expected === 'string' && e.expected.length > 0) {
              return `${head}${S.actionScripts.expectedSuffix(e.expected)}`;
            }
            return head;
          })
          .join('\n');
        if (executorValidationMessage) {
          setSafeHTML(executorValidationMessage, '<span class="validation-error">' + escapeHtml(errLines) + '</span>');
          executorValidationMessage.style.display = 'block';
        }
      }
      lastValidScript = null;
      lastValidatedRaw = null;
      hidePasswordPrompt();
      const errIdx = errorIndicesFromValidationErrors(errors);
      if (result.script && Array.isArray(result.script.steps) && result.script.steps.length > 0) {
        renderValidationFailureStepList(result.script, errIdx);
      } else {
        showExecutorStepsEmptyState();
      }
      if (executorResults) executorResults.innerHTML = '';
      clearResultsRunInfo();
      updateRunButtonState();
      updateExecutorClearActionsBtn();
      return;
    }

    if (result.script && result.script.steps && window.roku && window.roku.actionScriptCheckFileExists) {
      const fileErrors: Array<{ stepIndex: number; message: string }> = [];
      for (let i = 0; i < result.script.steps.length; i++) {
        const step = result.script.steps[i];
        if (step && step.type === 'sideload' && step.filePath) {
          const res = await window.roku.actionScriptCheckFileExists(step.filePath);
          if (res && res.success && !res.exists) {
            fileErrors.push({ stepIndex: i, message: S.actionScripts.errFileNotFound(step.filePath) });
          }
        }
      }
      if (fileErrors.length > 0) {
        const flatFile = flattenStepsPreorder(result.script.steps || []);
        const errLines = fileErrors.map((e) =>
          S.actionScripts.actionLabel(stepPathToDisplayId(flatFile[e.stepIndex] && flatFile[e.stepIndex].path, e.stepIndex), e.message)
        ).join('\n');
        if (executorValidationMessage) {
          setSafeHTML(executorValidationMessage, '<span class="validation-error">' + escapeHtml(errLines) + '</span>');
          executorValidationMessage.style.display = 'block';
        }
        lastValidScript = null;
        lastValidatedRaw = null;
        hidePasswordPrompt();
        const fileErrIdx = new Set(fileErrors.map((e) => e.stepIndex));
        renderValidationFailureStepList(result.script, fileErrIdx);
        if (executorResults) executorResults.innerHTML = '';
        clearResultsRunInfo();
        updateRunButtonState();
        updateExecutorClearActionsBtn();
        return;
      }
    }

    lastValidScript = result.script;
    lastValidatedRaw = raw;
    const stepCount = flatStepCount(result.script);
    stepStates = Array(stepCount).fill('pending');
    skippedSet = new Set();
    renderExecutorStepsList(result.script);
    clearResultsRunInfo();
    if (executorResults) setSafeHTML(executorResults, `<p class="executor-results-placeholder">${S.actionScripts.resultsPlaceholder}</p>`);
    if (executorValidationMessage) {
      setSafeHTML(executorValidationMessage, `<span class="validation-success">${S.actionScripts.statusValid}</span>`);
      executorValidationMessage.style.display = 'block';
    }

    // Show password prompt only if script needs a password and none is available anywhere
    const needsPw = scriptNeedsPassword(result.script);
    const hasPw = !!getPassword();
    if (needsPw && !hasPw) {
      showPasswordPrompt();
    } else {
      hidePasswordPrompt();
      if (needsPw && hasPw && executorValidationMessage) {
        executorValidationMessage.innerHTML += ` <span class="validation-muted" style="font-size:11px;">${S.actionScripts.usingDevPasswordFromAuth}</span>`;
      }
    }

    runRequiresFreshValidation = false;
    updateRunButtonState();
    updateExecutorClearActionsBtn();

    const hasSave = scriptHasSaveActions(result.script);
    if (hasSave && !chosenSaveFolder) {
      const defaultFolder = getActionScriptDefaultSaveFolder();
      if (defaultFolder) {
        setSaveFolder(defaultFolder);
      } else if (window.roku && window.roku.actionScriptShowSaveFolder) {
        const folderResult = await window.roku.actionScriptShowSaveFolder();
        if (folderResult.success && folderResult.folderPath) {
          setSaveFolder(folderResult.folderPath);
        }
      }
    }
  });

  if (panel) {
    panel.addEventListener('innertabswitch', (e) => {
      const tab = e.detail && e.detail.tab;
      if (tab && tab !== 'actionscripts' && (lastValidatedRaw !== null || lastValidScript)) {
        runRequiresFreshValidation = true;
        updateRunButtonState();
        if (executorValidationMessage) {
          setSafeHTML(
            executorValidationMessage,
            '<span class="validation-muted">' +
              escapeHtml(
                S.actionScripts.switchedTabRunPaused
              ) +
              '</span>'
          );
          executorValidationMessage.style.display = 'block';
        }
      } else if (tab === 'actionscripts' && runRequiresFreshValidation) {
        // The JSON/Validate row is hidden by default (.executor-import-section); users usually re-validate only
        // via Import modal. If the script text is unchanged, treat as safe to run again.
        const t = (executorTextarea && executorTextarea.value.trim()) || '';
        if (lastValidScript && lastValidatedRaw !== null && t === lastValidatedRaw) {
          runRequiresFreshValidation = false;
          if (executorValidationMessage) {
            setSafeHTML(executorValidationMessage, `<span class="validation-success">${S.actionScripts.statusValid}</span>`);
            executorValidationMessage.style.display = 'block';
          }
        } else if (lastValidScript || lastValidatedRaw !== null) {
          if (executorValidationMessage) {
            setSafeHTML(
              executorValidationMessage,
              '<span class="validation-muted">' +
                escapeHtml(
                  S.actionScripts.scriptChangedNeedsValidation
                ) +
                '</span>'
            );
            executorValidationMessage.style.display = 'block';
          }
        }
        updateRunButtonState();
      }
    });
  }

  executorTextarea.addEventListener('input', () => {
    const t = executorTextarea.value.trim();
    if (lastValidatedRaw !== null && t !== lastValidatedRaw) {
      invalidateValidatedScript(S.actionScripts.scriptChangedClickValidate);
    }
  });

  // Upload
  if (executorUploadBtn) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    panel.appendChild(input);
    executorUploadBtn.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        executorTextarea.value = text;
        executorTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        executorValidateBtn.click();
      } catch (e) {
        if (executorValidationMessage) {
          setSafeHTML(executorValidationMessage, '<span class="validation-error">' + escapeHtml(errMsg(e)) + '</span>');
          executorValidationMessage.style.display = 'block';
        }
      }
    });
  }

  // Choose folder
  if (executorSaveFolderBtn) {
    executorSaveFolderBtn.addEventListener('click', async () => {
      if (!window.roku || !window.roku.actionScriptShowSaveFolder) return;
      const res = await window.roku.actionScriptShowSaveFolder();
      if (res.success && res.folderPath) setSaveFolder(res.folderPath);
    });
  }

  panel.addEventListener('action-script-set-save-folder', (e) => {
    if (e.detail && e.detail.path !== undefined) setSaveFolder(e.detail.path || null);
  });

  if (executorStepsList) {
    executorStepsList.addEventListener('scroll', () => {
      if (!scrollProgrammatic) userScrolledSteps = true;
    });
  }

  // Run / Pause / Resume
  executorRunBtn.addEventListener('click', async () => {
    // If running: toggle pause
    if (isRunning) {
      isPaused = !isPaused;
      updateRunStopUI();
      return;
    }
    if (!lastValidScript || runRequiresFreshValidation) return;

    isRunning = true;
    isPaused = false;
    isStopped = false;
    updateRunStopUI();

    const needsRale = scriptNeedsRaleConnection(lastValidScript);
    // Track whether this run was the first to establish an App Connector
    // connection, so we can disconnect cleanly at the end. Any prior state
    // (user connected manually) is left alone.
    const runStartedConnected = appConnector.isConnected();
    userScrolledSteps = false;
    clearResultsRunInfo();
    const resultsPanel = executorResults && executorResults.closest('.executor-results-panel');
    const runInfoEl = resultsPanel && resultsPanel.querySelector('.executor-results-panel-run-info');
    // Clear previous run results (releases in-memory data for Save/Copy)
    if (executorResults) {
      executorResults.innerHTML = '';
    }
    updateResultsButtons();
    const stepCount = flatStepCount(lastValidScript);
    const runStepFlat = flattenStepsPreorder(lastValidScript.steps || []);
    stepStates = Array(stepCount).fill('pending');
    renderExecutorStepsList(lastValidScript);

    // `raleCommand` for the engine: delegates to the shared AppConnector,
    // which already does verify-and-reconnect on stale "Not connected"
    // responses (common after launch/sideload kills TrackerTask mid-run).
    // If the script never uses RALE we pass `null` so engine skips those
    // steps instead of eagerly opening a connection.
    const runRaleCommand = needsRale
      ? (command: string, args?: unknown) => {
          // Let the user see the connect progress while the first RALE
          // step is waiting.
          if (!appConnector.isConnected() && executorResults) {
            const existing = executorResults.querySelector('.executor-results-placeholder');
            if (!existing) {
              const p = document.createElement('p');
              p.className = 'executor-results-placeholder';
              p.textContent = S.actionScripts.connectingToAppConnector;
              executorResults.appendChild(p);
              executorResults.scrollTop = executorResults.scrollHeight;
            }
          }
          return appConnector.command(command, args);
        }
      : null;

    const connectConsole = executorConnectConsoleCheckbox && executorConnectConsoleCheckbox.checked;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const runId = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    if (runInfoEl) {
      runInfoEl.textContent = S.actionScripts.runStarted(runId, stepCount);
    }

    // Auto-connect to telnet console if checkbox is checked and not already connected
    if (
      connectConsole &&
      typeof panel.isTelnetConnected === 'function' &&
      !panel.isTelnetConnected() &&
      typeof panel.connectTelnet === 'function'
    ) {
      void panel.connectTelnet();
    }

    try {
      await runScript(lastValidScript, {
        api,
        raleCommand: runRaleCommand,
        getPassword,
        saveFolder: chosenSaveFolder || undefined,
        runId,
        isStepSkipped: (i) => skippedSet.has(i),
        shouldPause: () => isPaused,
        shouldStop: () => isStopped,
        captureDevicePerformance: (chart, opts) => {
          const root = panel as HTMLElement & {
            rokuDevicePerformanceCapture?: (
              c: string,
              o?: { shouldStop?: () => boolean; onWaiting?: (show: boolean) => void }
            ) => Promise<unknown>;
          };
          const fn = root.rokuDevicePerformanceCapture;
          if (typeof fn !== 'function') {
            return Promise.resolve({
              success: false,
              error: S.actionScripts.errDevicePerformanceUnavailable
            });
          }
          return fn(chart, opts);
        }
      }, {
        onStepStart: (i, step, desc) => {
          setStepState(i, 'executing');
          scrollStepIntoView(i);
          const rowDepth = runStepFlat[i] && typeof runStepFlat[i].depth === 'number' ? runStepFlat[i].depth : 0;
          const displayId = stepPathToDisplayId(runStepFlat[i] && runStepFlat[i].path, i);
          startResultCard(S.actionScripts.actionLabel(displayId, desc), rowDepth);
        },
        onStepEnd: (i, result) => {
          if (!lastValidScript) return;
          const flat = flattenStepsPreorder(lastValidScript.steps || []);
          const step = flat[i] ? flat[i].step : (lastValidScript.steps || [])[i];
          const failed = result && result.success === false;
          const skipped = result && result.skipped === true;
          const isPasswordError = failed && result && result.error && String(result.error).toLowerCase().includes('developer password');
          if (isPasswordError) {
            showPasswordPrompt();
            if (executorPasswordPrompt) {
              executorPasswordPrompt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
          setStepState(i, failed ? 'error' : skipped ? 'skipped' : 'done');
          const output = formatStepResult(step, result);
          const stepObj = step && typeof step === 'object' ? (step as { type?: string }) : null;
          const screenshotUrl =
            stepObj?.type === 'screenshot' && result && result.success && result.url ? result.url : undefined;
          const perf =
            stepObj?.type === 'devicePerformance' &&
            result &&
            result.success &&
            !skipped &&
            (Array.isArray(result.pngDataUrls) || Array.isArray(result.htmlFragments))
              ? {
                  pngDataUrls: result.pngDataUrls,
                  pngCaptions: result.pngCaptions,
                  htmlFragments: result.htmlFragments
                }
              : undefined;
          finishResultCard(
            failed,
            failed ? (result.error || S.actionScripts.statusFailedPlain) : skipped ? S.actionScripts.statusSkipped : S.actionScripts.statusOk,
            output,
            screenshotUrl,
            perf
          );
        },
        onError: (i, err) => {
          const message = errMsg(err);
          setStepState(i, 'error');
          if (currentResultCardBody) {
            appendToResultCard(S.actionScripts.errorLine(message), true);
            finishResultCard(true, message, '', undefined, undefined);
          }
        },
        onComplete: (flags) => {
          const wasStopped = flags && flags.stopped;
          if (executorResults) {
            const p = document.createElement('p');
            p.style.marginTop = '12px';
            p.style.fontWeight = '600';
            p.style.color = wasStopped ? 'var(--accent-red)' : 'var(--accent-green)';
            p.textContent = wasStopped ? S.actionScripts.runStopped : S.actionScripts.runCompleted;
            executorResults.appendChild(p);
            executorResults.scrollTop = executorResults.scrollHeight;
          }
        },
        onLog: (msg) => appendToResultCard(msg, false),
        onWaiting: (show) => setWaitSpinner(show)
      });
    } finally {
      // Only release the App Connector connection if the run itself opened it.
      // If the user already had a manual connection when Run started, leave it
      // alone so they can keep inspecting the app afterwards.
      if (needsRale && !runStartedConnected && appConnector.isConnected()) {
        try { await appConnector.disconnect(); } catch (_) {}
      }
      resetRunState();
      fadeOutAndResetSteps();
    }
  });

  // Stop button
  if (executorStopBtn) {
    executorStopBtn.addEventListener('click', () => {
      if (!isRunning) return;
      isStopped = true;
      isPaused = false;
      updateRunStopUI();
    });
  }

  /* ----- PDF export & Results Copy/Save ----- */

  /** Convert a blob: URL to a data: URL (e.g. when browser replaced screenshot data URL with blob). */
  function blobUrlToDataUrl(blobUrl: string): Promise<string> {
    return new Promise((resolve) => {
      fetch(blobUrl)
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () =>
            resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        })
        .catch(() => resolve(''));
    });
  }

  /** Resolve an executor screenshot img to { dataUrl, w, h } (for PDF export). */
  async function resolveScreenshotImageData(node: HTMLImageElement) {
    const src = (node && (node.getAttribute('data-rtf-src') || node.src)) || '';
    if (!src || typeof src !== 'string') return null;
    let dataUrl = src.startsWith('data:') ? src : null;
    if (!dataUrl && (src.startsWith('file:') || src.startsWith('file://')) && window.roku) {
      try {
        const res = await window.roku.readFileAsBase64(src);
        if (res && res.success && res.dataUrl) dataUrl = res.dataUrl;
      } catch (_) { /* ignore */ }
    }
    if (!dataUrl && src.startsWith('blob:')) {
      dataUrl = await blobUrlToDataUrl(src);
    }
    if (!dataUrl) return null;
    const w = node && (node.naturalWidth || node.width);
    const h = node && (node.naturalHeight || node.height);
    return { dataUrl, w, h };
  }

  /**
   * Build results payload for PDF export: blocks with header, ordered body (same as DOM / tool), status.
   */
  type PdfBodyItem =
    | { type: 'line'; text: string | null; isError: boolean }
    | { type: 'image'; dataUrl: string }
    | { type: 'output'; text: string }
    | { type: 'caption'; text: string }
    | { type: 'textBlock'; text: string };
  type PdfBlock = {
    header: string;
    body: PdfBodyItem[];
    status: string;
    statusError: boolean;
    depth: number;
  };

  async function buildResultsPdfPayload() {
    if (!executorResults) return null;
    const blocks = executorResults.querySelectorAll('.executor-result-block');
    if (blocks.length === 0) return null;
    const out: { blocks: PdfBlock[] } = { blocks: [] };
    for (const block of blocks) {
      const header = block.querySelector('.executor-result-block-header');
      const body = block.querySelector('.executor-result-block-body');
      const statusEl = block.querySelector('.executor-result-block-status');
      const bodyItems: PdfBodyItem[] = [];
      if (body) {
        for (const node of body.children) {
          if (node.classList && node.classList.contains('executor-wait-spinner-wrap')) {
            continue;
          }
          if (node.classList && node.classList.contains('log-line')) {
            bodyItems.push({
              type: 'line',
              text: node.textContent,
              isError: node.classList.contains('log-error')
            });
          } else if (
            node instanceof HTMLImageElement &&
            node.classList &&
            (node.classList.contains('executor-result-screenshot') ||
              node.classList.contains('executor-result-performance-chart'))
          ) {
            const resolved = await resolveScreenshotImageData(node);
            if (resolved && resolved.dataUrl) bodyItems.push({ type: 'image', dataUrl: resolved.dataUrl });
          } else if (node.classList && node.classList.contains('executor-result-output')) {
            bodyItems.push({ type: 'output', text: node.textContent || '' });
          } else if (node.classList && node.classList.contains('executor-performance-h4')) {
            bodyItems.push({ type: 'caption', text: node.textContent || '' });
          } else if (node.classList && node.classList.contains('executor-performance-html-wrap')) {
            const el = node as HTMLElement;
            const text = (el.innerText != null && el.innerText.trim() !== '' ? el.innerText : el.textContent) || '';
            if (text.trim()) bodyItems.push({ type: 'textBlock', text });
          }
        }
      }
      out.blocks.push({
        header: header ? header.textContent || '' : '',
        body: bodyItems,
        status: statusEl ? statusEl.textContent || '' : '',
        statusError: !!(statusEl && statusEl.classList.contains('error')),
        depth: Math.min(12, parseInt(block.dataset.stepDepth || '0', 10) || 0)
      });
    }
    return out;
  }

  function generateResultsPlainText() {
    if (!executorResults) return '';
    const blocks = executorResults.querySelectorAll('.executor-result-block');
    const parts: string[] = [];
    blocks.forEach(block => {
      const header = block.querySelector('.executor-result-block-header');
      const body = block.querySelector('.executor-result-block-body');
      const status = block.querySelector('.executor-result-block-status');
      const depth = Math.min(12, parseInt(block.dataset.stepDepth || '0', 10) || 0);
      const blockIndent = depth > 0 ? '  '.repeat(depth) : '';
      if (header) parts.push(blockIndent + header.textContent);
      if (body) {
        const lines = body.querySelectorAll('.log-line');
        const lineIndent = blockIndent + '  ';
        lines.forEach(line => parts.push(lineIndent + line.textContent));
        const output = body.querySelector('.executor-result-output');
        if (output) {
          const oText = output.textContent || '';
          const oIndent = blockIndent + '  ';
          oText.split('\n').forEach((ln) => parts.push(oIndent + ln));
        }
      }
      if (status) parts.push(blockIndent + status.textContent);
      parts.push('');
    });
    return parts.join('\n');
  }

  // Copy Results button
  if (executorResultsCopyBtn) {
    executorResultsCopyBtn.addEventListener('click', async () => {
      const plainText = generateResultsPlainText();
      if (!plainText) return;
      try {
        if (window.roku && window.roku.copyToClipboard) {
          await window.roku.copyToClipboard(plainText);
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(plainText);
        }
        executorResultsCopyBtn.title = S.actionScripts.copiedFeedback;
        setTimeout(() => { executorResultsCopyBtn.title = S.actionScripts.copyResultsTitle; }, 2000);
      } catch (e) {
        rendererError('Copy results failed:', e);
      }
    });
  }

  // Save Results button — PDF with embedded images (displays correctly in all viewers)
  if (executorResultsSaveBtn) {
    executorResultsSaveBtn.addEventListener('click', async () => {
      try {
        const payload = await buildResultsPdfPayload();
        if (!payload || !payload.blocks.length) return;
        if (window.roku && window.roku.saveResultsPdf) {
          const res = await window.roku.saveResultsPdf(payload);
          if (res && res.success) {
            executorResultsSaveBtn.title = S.actionScripts.savedFeedback;
            setTimeout(() => { executorResultsSaveBtn.title = S.actionScripts.saveResultsTitle; }, 2000);
          }
        }
      } catch (e) {
        rendererError('Save results failed:', e);
      }
    });
  }

  // Clear Results button — clears logs and releases in-memory data (Save will have nothing until next Run)
  if (executorResultsClearBtn) {
    executorResultsClearBtn.addEventListener('click', () => {
      clearResults();
    });
  }

  // Clear Actions — clear script and actions list, show empty state
  if (executorClearActionsBtn) {
    executorClearActionsBtn.addEventListener('click', () => {
      if (isRunning) return;
      runRequiresFreshValidation = false;
      lastValidScript = null;
      lastValidatedRaw = null;
      stepStates = [];
      skippedSet = new Set();
      if (executorTextarea) {
        executorTextarea.value = '';
        executorTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (executorValidationMessage) {
        executorValidationMessage.style.display = 'none';
        executorValidationMessage.innerHTML = '';
      }
      hidePasswordPrompt();
      showExecutorStepsEmptyState();
      if (executorResults) {
        setSafeHTML(executorResults, `<p class="executor-results-placeholder">${S.actionScripts.resultsPlaceholder}</p>`);
      }
      clearResultsRunInfo();
      updateRunButtonState();
      updateExecutorClearActionsBtn();
      updateResultsButtons();
    });
  }

  setSaveFolder(null);
  showExecutorStepsEmptyState();
  updateRunButtonState();
  updateResultsButtons();
  updateRunStopUI();
}

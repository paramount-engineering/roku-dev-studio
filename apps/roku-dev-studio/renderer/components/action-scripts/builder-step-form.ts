/**
 * populateFormFromStep / collectStepFromForm for the action script builder.
 */

import { QUERY_PRESETS } from './action-registry.js';
import { buildRaleArgsFromParamValues } from './rale-command-param-ui.js';
import { validateAndNormalizeRaleCommandArgs } from './rale-command-validator.js';
import { getParamValues } from '../inspector/parameter-inputs.js';
import { getAssignToVarName, raleCommandSupportsAssignToVar } from './action-script-variables-client.js';
import { OPS_NEED_VALUE } from './action-script-if-client.js';
import {
  syncRaleNodeFieldWaitValueRows,
  syncIfConditionValueRows,
  parseRalePathFromTextarea,
  coerceIfConditionValueFromText,
  conditionValueToInputString,
  stringifyPathForTextarea
} from './builder-step-helpers.js';

/** Step JSON object in the builder (loose shape; validated on export). */
type BuilderStep = Record<string, unknown>;

/**
 * @param {object} ctx
 * @param {HTMLElement | null} ctx.builderStepFields
 * @param {HTMLSelectElement | null} ctx.builderStepTypeSelect
 * @param {() => HTMLElement | null} ctx.queryWaitRalePanel
 * @param {(el: HTMLElement, preset: object | null) => void} ctx.refreshActionScriptRaleFields
 * @param {(type: string) => void} ctx.renderStepFields
 */
export function createBuilderStepForm(ctx) {
  const {
    builderStepFields,
    builderStepTypeSelect,
    queryWaitRalePanel,
    refreshActionScriptRaleFields,
    renderStepFields
  } = ctx;

  function populateFormFromStep(step: BuilderStep | null | undefined) {
    if (!step || !builderStepFields) return;
    const type = String(step.type || 'query');
    if (builderStepTypeSelect) {
      const leg = builderStepTypeSelect.querySelector('option[value="systemTelnet"]');
      if (type !== 'systemTelnet' && leg) {
        leg.remove();
      }
      if (type === 'systemTelnet' && !builderStepTypeSelect.querySelector('option[value="systemTelnet"]')) {
        const opt = document.createElement('option');
        opt.value = 'systemTelnet';
        opt.textContent = 'Plugins / Memory (legacy JSON)';
        builderStepTypeSelect.appendChild(opt);
      }
      builderStepTypeSelect.value = type;
    }
    renderStepFields(type);
    if (type === 'query') {
      const presetSelect = builderStepFields.querySelector('.builder-query-preset');
      const endpointInput = builderStepFields.querySelector('.builder-field-endpoint');
      const customRow = builderStepFields.querySelector('.builder-query-custom-row');
      const ep = String(step.endpoint ?? '');
      const preset = QUERY_PRESETS.find((p) => p.endpoint === ep);
      if (presetSelect) presetSelect.value = preset ? preset.endpoint : '';
      if (endpointInput) endpointInput.value = ep || presetSelect?.value || '';
      if (customRow) customRow.style.display = preset ? 'none' : 'flex';
    } else if (type === 'systemTelnet') {
      const preset = builderStepFields.querySelector('.builder-system-telnet-preset');
      if (preset && step.telnetCommand) preset.value = String(step.telnetCommand);
    } else if (type === 'post') {
      const el = builderStepFields.querySelector('.builder-post-preset');
      if (el && step.endpoint) el.value = step.endpoint;
    } else if (type === 'keypress') {
      const keySelect = builderStepFields.querySelector('.builder-field-key-select');
      if (keySelect && step.key) keySelect.value = step.key;
    } else if (type === 'inputText') {
      const el = builderStepFields.querySelector('.builder-field-text');
      if (el) el.value = step.text || '';
    } else if (type === 'launch') {
      const appId = builderStepFields.querySelector('.builder-field-appId');
      const params = builderStepFields.querySelector('.builder-field-params');
      if (appId) appId.value = step.appId || '';
      if (params) params.value = step.params || '';
    } else if (type === 'sideload') {
      const fp = builderStepFields.querySelector('.builder-field-filePath');
      const pw = builderStepFields.querySelector('.builder-field-password');
      if (fp) fp.value = step.filePath || '';
      if (pw) pw.value = step.password || '';
    } else if (type === 'deleteSideload') {
      const pw = builderStepFields.querySelector('.builder-field-password');
      if (pw) pw.value = step.password || '';
    } else if (type === 'appFunction') {
      const nameEl = builderStepFields.querySelector('.builder-field-functionName');
      if (nameEl && step.functionName) nameEl.value = step.functionName;
      const paramsContainer = builderStepFields.querySelector('.builder-app-function-params');
      if (paramsContainer && Array.isArray(step.functionParams)) {
        nameEl?.dispatchEvent(new Event('change'));
        const paramInputs = Array.from(builderStepFields.querySelectorAll('.builder-field-param')) as HTMLElement[];
        paramInputs.sort(
          (a, b) =>
            (parseInt(a.dataset.paramIndex || '0', 10) || 0) - (parseInt(b.dataset.paramIndex || '0', 10) || 0)
        );
        const storedParams = step.functionParams as unknown[];
        storedParams.forEach((val, idx) => {
          const input = paramInputs[idx];
          if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
            input.value = val == null ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
          }
        });
      }
      const outAf = builderStepFields.querySelector('.builder-field-assignToVar');
      if (outAf) outAf.value = getAssignToVarName(step) || '';
    } else if (type === 'raleCommand') {
      const cmdEl = builderStepFields.querySelector('.builder-field-rale-command');
      if (cmdEl && step.command) cmdEl.value = step.command;
      refreshActionScriptRaleFields(builderStepFields, step);
      const outRc = builderStepFields.querySelector('.builder-field-assignToVar');
      if (outRc && step.command && raleCommandSupportsAssignToVar(step.command)) {
        outRc.value = getAssignToVarName(step) || '';
      }
    } else if (type === 'screenshot') {
      const label = builderStepFields.querySelector('.builder-field-label');
      const waitBefore = builderStepFields.querySelector('.builder-field-screenshot-waitBeforeMs');
      const waitAfter = builderStepFields.querySelector('.builder-field-screenshot-waitAfterTriggerMs');
      if (label) label.value = step.label || '';
      if (waitBefore) waitBefore.value = step.waitBeforeMs != null ? String(step.waitBeforeMs) : '100';
      if (waitAfter) waitAfter.value = step.waitAfterTriggerMs != null ? String(step.waitAfterTriggerMs) : '';
    } else if (type === 'devicePerformance') {
      const chartSel = builderStepFields.querySelector('.builder-field-device-performance-chart');
      const lab = builderStepFields.querySelector('.builder-field-device-performance-label');
      if (chartSel && step.chart != null) chartSel.value = String(step.chart);
      if (lab) lab.value = step.label ? String(step.label) : '';
    } else if (type === 'wait') {
      const waitMode = builderStepFields.querySelector('.builder-field-wait-mode');
      const delayInput = builderStepFields.querySelector('.builder-field-wait-delayMs');
      const source = builderStepFields.querySelector('.builder-field-wait-source');
      const stateSelect = builderStepFields.querySelector('.builder-field-wait-state');
      const timeoutMp = builderStepFields.querySelector('.builder-wait-timeout--mp');
      const pollMp = builderStepFields.querySelector('.builder-wait-poll--mp');
      const timeoutRale = builderStepFields.querySelector('.builder-wait-timeout--rale');
      const pollRale = builderStepFields.querySelector('.builder-wait-poll--rale');
      const ralePanel = queryWaitRalePanel();
      const pathTa = ralePanel?.querySelector('.builder-field-wait-path');
      const nodeId = ralePanel?.querySelector('.builder-field-wait-node-id');
      const fieldIn = ralePanel?.querySelector('.builder-field-wait-field');
      const operatorSel = ralePanel?.querySelector('.builder-field-wait-operator');
      const valueIn = ralePanel?.querySelector('.builder-field-wait-value');
      const caseCb = ralePanel?.querySelector('.builder-field-wait-caseInsensitive');
      const hasDelay = step.delayMs != null;
      if (waitMode) waitMode.value = hasDelay ? 'delay' : 'condition';
      if (delayInput) delayInput.value = hasDelay ? String(step.delayMs) : '2000';
      const waitCond =
        step.condition && typeof step.condition === 'object'
          ? (step.condition as Record<string, unknown>)
          : null;
      if (source) source.value = String(waitCond?.source ?? 'media-player');
      if (stateSelect && waitCond && waitCond.state != null) stateSelect.value = String(waitCond.state);
      const c = (waitCond || {}) as Record<string, unknown>;
      if (pathTa && c.source === 'rale-node-field') {
        pathTa.value = stringifyPathForTextarea(c.path);
      }
      if (nodeId && c.id != null) nodeId.value = String(c.id);
      if (fieldIn && c.field != null) fieldIn.value = String(c.field);
      if (operatorSel && c.operator) operatorSel.value = c.operator;
      if (valueIn && c.value != null) {
        valueIn.value = conditionValueToInputString(c.value);
      }
      if (caseCb) caseCb.checked = !!c.caseInsensitive;
      const to = step.timeoutMs != null ? String(step.timeoutMs) : '300000';
      const po = step.pollIntervalMs != null ? String(step.pollIntervalMs) : '2000';
      if (timeoutMp) timeoutMp.value = to;
      if (pollMp) pollMp.value = po;
      if (timeoutRale) timeoutRale.value = to;
      if (pollRale) pollRale.value = po;
      if (source) source.dataset.waitPrevSrc = '';
      waitMode?.dispatchEvent(new Event('change'));
      source?.dispatchEvent(new Event('change'));
      if (source) source.dataset.waitPrevSrc = source.value || '';
      syncRaleNodeFieldWaitValueRows(builderStepFields);
    } else if (type === 'if') {
      const srcEl = builderStepFields.querySelector('.builder-field-if-source');
      const c = (step.condition && typeof step.condition === 'object' ? step.condition : {}) as Record<string, unknown>;
      if (srcEl) srcEl.value = c.source || 'media-player';
      if (c.source === 'media-player' || !c.source) {
        const st = builderStepFields.querySelector('.builder-field-if-state');
        if (st && c.state) st.value = c.state;
      }
      if (c.source === 'rale-node-field') {
        const pathTa = builderStepFields.querySelector('.builder-field-if-rale-path');
        const nodeId = builderStepFields.querySelector('.builder-field-if-rale-node-id');
        const fieldIn = builderStepFields.querySelector('.builder-field-if-rale-field');
        const operatorSel = builderStepFields.querySelector('.builder-field-if-rale-operator');
        const valueIn = builderStepFields.querySelector('.builder-field-if-rale-value');
        const caseCb = builderStepFields.querySelector('.builder-field-if-rale-caseInsensitive');
        if (pathTa) {
          pathTa.value = stringifyPathForTextarea(c.path);
        }
        if (nodeId && c.id != null) nodeId.value = String(c.id);
        if (fieldIn && c.field != null) fieldIn.value = String(c.field);
        if (operatorSel && c.operator) operatorSel.value = c.operator;
        if (valueIn && c.value != null) {
          valueIn.value = conditionValueToInputString(c.value);
        }
        if (caseCb) caseCb.checked = !!c.caseInsensitive;
      }
      if (c.source === 'variables') {
        const vp = builderStepFields.querySelector('.builder-field-if-variablePath');
        const operatorSel = builderStepFields.querySelector('.builder-field-if-vars-operator');
        const valueIn = builderStepFields.querySelector('.builder-field-if-vars-value');
        const caseCb = builderStepFields.querySelector('.builder-field-if-vars-caseInsensitive');
        if (vp && c.variablePath != null) vp.value = String(c.variablePath);
        if (operatorSel && c.operator) operatorSel.value = c.operator;
        if (valueIn && c.value != null) {
          valueIn.value = conditionValueToInputString(c.value);
        }
        if (caseCb) caseCb.checked = !!c.caseInsensitive;
      }
      if (c.source === 'active-app') {
        const attrSel = builderStepFields.querySelector('.builder-field-if-active-app-attribute');
        const operatorSel = builderStepFields.querySelector('.builder-field-if-active-app-operator');
        const valueIn = builderStepFields.querySelector('.builder-field-if-active-app-value');
        const caseCb = builderStepFields.querySelector('.builder-field-if-active-app-caseInsensitive');
        if (attrSel && c.attribute != null) attrSel.value = String(c.attribute);
        if (operatorSel && c.operator) operatorSel.value = c.operator;
        if (valueIn && c.value != null) {
          valueIn.value = conditionValueToInputString(c.value);
        }
        if (caseCb) caseCb.checked = !!c.caseInsensitive;
      }
      srcEl?.dispatchEvent(new Event('change'));
      syncIfConditionValueRows(builderStepFields);
    }
  }

  function collectStepFromForm(type: string): BuilderStep {
    const step: BuilderStep = { type };
    if (type === 'query') {
      const presetSelect = builderStepFields.querySelector('.builder-query-preset');
      const endpointInput = builderStepFields.querySelector('.builder-field-endpoint');
      step.endpoint =
        (presetSelect && presetSelect.value) ||
        (endpointInput && endpointInput.value.trim()) ||
        '/query/device-info';
    } else if (type === 'systemTelnet') {
      const preset = builderStepFields.querySelector('.builder-system-telnet-preset');
      step.telnetCommand = preset && preset.value ? preset.value : 'plugins';
    } else if (type === 'post') {
      const el = builderStepFields.querySelector('.builder-post-preset');
      if (el && el.value) step.endpoint = el.value;
    } else if (type === 'keypress') {
      const keySelect = builderStepFields.querySelector('.builder-field-key-select');
      if (keySelect && keySelect.value) step.key = keySelect.value;
    } else if (type === 'inputText') {
      const el = builderStepFields.querySelector('.builder-field-text');
      if (el) step.text = el.value.trim();
    } else if (type === 'launch') {
      const appId = builderStepFields.querySelector('.builder-field-appId');
      const params = builderStepFields.querySelector('.builder-field-params');
      if (appId) step.appId = appId.value.trim();
      if (params && params.value.trim()) step.params = params.value.trim();
    } else if (type === 'sideload') {
      const fp = builderStepFields.querySelector('.builder-field-filePath');
      const pw = builderStepFields.querySelector('.builder-field-password');
      if (fp) step.filePath = fp.value.trim();
      if (pw) step.password = pw.value;
    } else if (type === 'deleteSideload') {
      const pw = builderStepFields.querySelector('.builder-field-password');
      if (pw) step.password = pw.value;
    } else if (type === 'appFunction') {
      const nameEl = builderStepFields.querySelector('.builder-field-functionName');
      const paramInputs = Array.from(builderStepFields.querySelectorAll('.builder-field-param')) as HTMLElement[];
      paramInputs.sort(
        (a, b) =>
          (parseInt(a.dataset.paramIndex || '0', 10) || 0) - (parseInt(b.dataset.paramIndex || '0', 10) || 0)
      );
      if (nameEl) step.functionName = nameEl.value.trim();
      const fp: unknown[] = [];
      step.functionParams = fp;
      paramInputs.forEach((input) => {
        if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) return;
        const raw = input.value.trim();
        const ptype = (input.dataset && input.dataset.paramType) ? input.dataset.paramType : '';
        const t = ptype.toLowerCase();
        if (!raw) {
          fp.push(null);
          return;
        }
        if (['roassociativearray', 'associativearray', 'roarray', 'array', 'rolist', 'list', 'object'].includes(t)) {
          try {
            fp.push(JSON.parse(raw));
          } catch {
            fp.push(raw);
          }
        } else if (['boolean', 'bool'].includes(t)) {
          const lower = raw.toLowerCase();
          fp.push(lower === 'true');
        } else if (['integer', 'int', 'longinteger'].includes(t)) {
          const n = parseInt(raw, 10);
          fp.push(isNaN(n) ? raw : n);
        } else if (['float', 'double'].includes(t)) {
          const n = parseFloat(raw);
          fp.push(isNaN(n) ? raw : n);
        } else {
          fp.push(raw);
        }
      });
      const outEl = builderStepFields.querySelector('.builder-field-assignToVar');
      if (outEl && outEl.value.trim()) step.assignToVar = outEl.value.trim();
    } else if (type === 'screenshot') {
      const label = builderStepFields.querySelector('.builder-field-label');
      if (label && label.value.trim()) step.label = label.value.trim();
      const waitBeforeInput = builderStepFields.querySelector('.builder-field-screenshot-waitBeforeMs');
      if (waitBeforeInput) {
        const ms = parseInt(waitBeforeInput.value, 10);
        if (!isNaN(ms) && ms >= 0) step.waitBeforeMs = ms;
      }
      const waitAfterInput = builderStepFields.querySelector('.builder-field-screenshot-waitAfterTriggerMs');
      if (waitAfterInput && waitAfterInput.value.trim() !== '') {
        const ms = parseInt(waitAfterInput.value, 10);
        if (!isNaN(ms) && ms >= 0) step.waitAfterTriggerMs = ms;
      }
    } else if (type === 'devicePerformance') {
      const chartSel = builderStepFields.querySelector('.builder-field-device-performance-chart');
      if (chartSel && chartSel.value) step.chart = chartSel.value;
      const lab = builderStepFields.querySelector('.builder-field-device-performance-label');
      if (lab && lab.value.trim()) step.label = lab.value.trim();
    } else if (type === 'raleCommand') {
      const cmdEl = builderStepFields.querySelector('.builder-field-rale-command');
      const container = builderStepFields.querySelector('.builder-rale-command-params');
      if (cmdEl) step.command = cmdEl.value.trim();
      const cmd = String(step.command ?? '');
      const raw = buildRaleArgsFromParamValues(cmd, container ? getParamValues(container) : []);
      const vr = validateAndNormalizeRaleCommandArgs(cmd, raw);
      step.args = vr.ok ? vr.args : raw;
      const outEl = builderStepFields.querySelector('.builder-field-assignToVar');
      if (outEl && outEl.value.trim() && raleCommandSupportsAssignToVar(cmd)) {
        step.assignToVar = outEl.value.trim();
      }
    } else if (type === 'wait') {
      const waitMode = builderStepFields.querySelector('.builder-field-wait-mode');
      const delayInput = builderStepFields.querySelector('.builder-field-wait-delayMs');
      const source = builderStepFields.querySelector('.builder-field-wait-source');
      const stateSelect = builderStepFields.querySelector('.builder-field-wait-state');
      const ralePanel = queryWaitRalePanel();
      const pathTa = ralePanel?.querySelector('.builder-field-wait-path');
      const nodeId = ralePanel?.querySelector('.builder-field-wait-node-id');
      const fieldIn = ralePanel?.querySelector('.builder-field-wait-field');
      const operatorSel = ralePanel?.querySelector('.builder-field-wait-operator');
      const valueIn = ralePanel?.querySelector('.builder-field-wait-value');
      const caseCb = ralePanel?.querySelector('.builder-field-wait-caseInsensitive');
      if (waitMode && waitMode.value === 'delay' && delayInput) {
        const ms = parseInt(delayInput.value, 10);
        if (!isNaN(ms) && ms >= 0) step.delayMs = ms;
      } else {
        const src = source ? source.value : 'media-player';
        const cond: Record<string, unknown> = { source: src };
        if (src === 'media-player') {
          if (stateSelect && stateSelect.value) cond.state = stateSelect.value;
        } else if (src === 'rale-node-field') {
          cond.path = parseRalePathFromTextarea(pathTa?.value);
          if (nodeId) cond.id = nodeId.value.trim();
          if (fieldIn) cond.field = fieldIn.value.trim();
          if (operatorSel) cond.operator = operatorSel.value;
          const op = operatorSel ? operatorSel.value : '';
          if (valueIn && OPS_NEED_VALUE.has(op)) cond.value = valueIn.value;
          if (caseCb && OPS_NEED_VALUE.has(op)) cond.caseInsensitive = !!caseCb.checked;
        }
        step.condition = cond;
        const timeoutEl =
          src === 'rale-node-field'
            ? builderStepFields.querySelector('.builder-wait-timeout--rale')
            : builderStepFields.querySelector('.builder-wait-timeout--mp');
        const pollEl =
          src === 'rale-node-field'
            ? builderStepFields.querySelector('.builder-wait-poll--rale')
            : builderStepFields.querySelector('.builder-wait-poll--mp');
        if (timeoutEl && timeoutEl.value) step.timeoutMs = parseInt(timeoutEl.value, 10);
        if (pollEl && pollEl.value) step.pollIntervalMs = parseInt(pollEl.value, 10);
      }
    } else if (type === 'if') {
      const srcEl = builderStepFields.querySelector('.builder-field-if-source');
      const src = srcEl ? srcEl.value : 'media-player';
      const cond: Record<string, unknown> = { source: src };
      if (src === 'media-player') {
        const st = builderStepFields.querySelector('.builder-field-if-state');
        if (st && st.value) cond.state = st.value;
      } else if (src === 'rale-node-field') {
        const pathTa = builderStepFields.querySelector('.builder-field-if-rale-path');
        const nodeId = builderStepFields.querySelector('.builder-field-if-rale-node-id');
        const fieldIn = builderStepFields.querySelector('.builder-field-if-rale-field');
        const operatorSel = builderStepFields.querySelector('.builder-field-if-rale-operator');
        const valueIn = builderStepFields.querySelector('.builder-field-if-rale-value');
        const caseCb = builderStepFields.querySelector('.builder-field-if-rale-caseInsensitive');
        cond.path = parseRalePathFromTextarea(pathTa?.value);
        if (nodeId) cond.id = nodeId.value.trim();
        if (fieldIn) cond.field = fieldIn.value.trim();
        if (operatorSel) cond.operator = operatorSel.value;
        const op = operatorSel ? operatorSel.value : '';
        if (valueIn && OPS_NEED_VALUE.has(op)) {
          cond.value = coerceIfConditionValueFromText(valueIn.value);
        }
        if (caseCb && OPS_NEED_VALUE.has(op)) cond.caseInsensitive = !!caseCb.checked;
      } else if (src === 'active-app') {
        const attrSel = builderStepFields.querySelector('.builder-field-if-active-app-attribute');
        const operatorSel = builderStepFields.querySelector('.builder-field-if-active-app-operator');
        const valueIn = builderStepFields.querySelector('.builder-field-if-active-app-value');
        const caseCb = builderStepFields.querySelector('.builder-field-if-active-app-caseInsensitive');
        if (attrSel) cond.attribute = attrSel.value;
        if (operatorSel) cond.operator = operatorSel.value;
        const op = operatorSel ? operatorSel.value : '';
        if (valueIn && OPS_NEED_VALUE.has(op)) {
          cond.value = coerceIfConditionValueFromText(valueIn.value);
        }
        if (caseCb && OPS_NEED_VALUE.has(op)) cond.caseInsensitive = !!caseCb.checked;
      } else if (src === 'variables') {
        const vp = builderStepFields.querySelector('.builder-field-if-variablePath');
        const operatorSel = builderStepFields.querySelector('.builder-field-if-vars-operator');
        const valueIn = builderStepFields.querySelector('.builder-field-if-vars-value');
        const caseCb = builderStepFields.querySelector('.builder-field-if-vars-caseInsensitive');
        if (vp) cond.variablePath = vp.value.trim();
        if (operatorSel) cond.operator = operatorSel.value;
        const op = operatorSel ? operatorSel.value : '';
        if (valueIn && OPS_NEED_VALUE.has(op)) {
          cond.value = coerceIfConditionValueFromText(valueIn.value);
        }
        if (caseCb && OPS_NEED_VALUE.has(op)) cond.caseInsensitive = !!caseCb.checked;
      }
      step.condition = cond;
      step.then = [];
      step.else = [];
    }
    return step;
  }

  return { populateFormFromStep, collectStepFromForm };
}

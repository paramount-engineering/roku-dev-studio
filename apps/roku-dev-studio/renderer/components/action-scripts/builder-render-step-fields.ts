/**
 * Renders per-step form fields in the action script builder (large template + listeners).
 */

import {
  QUERY_PRESETS,
  POST_PRESETS,
  KEYPRESS_GROUPS,
  MEDIA_PLAYER_STATES,
  ACTIVE_APP_IF_ATTRIBUTES,
  SYSTEM_TELNET_PRESETS
} from './action-registry.js';
import { listRaleCommandsForBuilder } from './rale-command-param-ui.js';
import { RALE_NODE_FIELD_OPERATORS } from './action-script-if-client.js';
import { setSafeHTML } from '../../modules/utils/dom.js';
import { renderParamInputs } from '../inspector/parameter-inputs.js';
import {
  escapeHtml,
  escapeAttr,
  syncRaleNodeFieldWaitValueRows,
  syncIfConditionValueRows
} from './builder-step-helpers.js';

/**
 * @param {object} ctx
 * @param {HTMLElement | null} ctx.builderStepFields
 * @param {HTMLElement | null} ctx.builderAddSection
 * @param {() => void} ctx.removeHoistedWaitRalePanel
 * @param {() => HTMLElement | null} ctx.queryWaitRalePanel
 * @param {() => void} ctx.copyWaitTimingMediaPlayerToRale
 * @param {() => void} ctx.copyWaitTimingRaleToMediaPlayer
 * @param {(el: HTMLElement, preset: object | null) => void} ctx.refreshActionScriptRaleFields
 * @param {() => unknown[]} ctx.getRaleFunctions
 */
export function createRenderStepFields(ctx) {
  const {
    builderStepFields,
    builderAddSection,
    removeHoistedWaitRalePanel,
    queryWaitRalePanel,
    copyWaitTimingMediaPlayerToRale,
    copyWaitTimingRaleToMediaPlayer,
    refreshActionScriptRaleFields,
    getRaleFunctions
  } = ctx;

  return function renderStepFields(type) {
    if (!builderStepFields) return;
    removeHoistedWaitRalePanel();
    builderStepFields.classList.remove(
      'builder-app-function-fields',
      'builder-rale-command-fields',
      'builder-wait-step-fields',
      'builder-if-step-fields'
    );
    if (builderAddSection) {
      builderAddSection.classList.remove(
        'builder-rale-layout',
        'builder-rale-no-assign',
        'builder-wait-layout',
        'builder-if-layout'
      );
    }

    const raleFunctions = getRaleFunctions();

    if (type === 'query') {
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group">
          <label>Query</label>
          <select class="builder-query-preset action-scripts-select">
            ${QUERY_PRESETS.map((p) => `<option value="${escapeAttr(p.endpoint)}">${escapeHtml(p.label)}</option>`).join('')}
            <option value="">Custom...</option>
          </select>
        </div>
        <div class="builder-field-group builder-query-custom-row" style="display: none;">
          <label>Endpoint</label>
          <input type="text" class="builder-field-endpoint" placeholder="/query/… or telnet:plugins / telnet:free">
        </div>
      `
      );
      const presetSelect = builderStepFields.querySelector('.builder-query-preset');
      const customRow = builderStepFields.querySelector('.builder-query-custom-row');
      const endpointInput = builderStepFields.querySelector('.builder-field-endpoint');
      function toggleCustom() {
        const isCustom = presetSelect.value === '';
        if (customRow) customRow.style.display = isCustom ? 'flex' : 'none';
        if (endpointInput) endpointInput.value = isCustom ? endpointInput.value : presetSelect.value;
      }
      presetSelect.addEventListener('change', () => {
        if (presetSelect.value) endpointInput.value = presetSelect.value;
        toggleCustom();
      });
      toggleCustom();
      return;
    }
    if (type === 'systemTelnet') {
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group">
          <label>Command (legacy type — use Device Query for new steps)</label>
          <select class="builder-system-telnet-preset action-scripts-select">
            ${SYSTEM_TELNET_PRESETS.map(
              (p) =>
                `<option value="${escapeAttr(p.telnetCommand)}">${escapeHtml(p.label)}</option>`
            ).join('')}
          </select>
        </div>
      `
      );
      return;
    }
    if (type === 'keypress') {
      const optionFor = (k) => {
        const val = typeof k === 'string' ? k : k.value;
        const text = typeof k === 'string' ? k : k.label;
        return `<option value="${escapeAttr(val)}">${escapeHtml(text)}</option>`;
      };
      const keyOpts = KEYPRESS_GROUPS.map(
        (g) =>
          `<optgroup label="${escapeAttr(g.label)}">${g.keys.map(optionFor).join('')}</optgroup>`
      ).join('');
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group">
          <label>Key</label>
          <select class="builder-field-key builder-field-key-select action-scripts-select">
            <option value="">-- Select key --</option>
            ${keyOpts}
          </select>
        </div>
      `
      );
      return;
    }
    if (type === 'inputText') {
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group">
          <label>Text</label>
          <input type="text" class="builder-field-text" placeholder="Text to send">
        </div>
      `
      );
      return;
    }
    if (type === 'launch') {
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group">
          <label>App ID</label>
          <input type="text" class="builder-field-appId" placeholder="12345">
        </div>
        <div class="builder-field-group">
          <label>Params (optional)</label>
          <input type="text" class="builder-field-params" placeholder="">
        </div>
      `
      );
      return;
    }
    if (type === 'sideload') {
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group">
          <label>File path</label>
          <div class="builder-file-path-row">
            <input type="text" class="builder-field-filePath" placeholder="Paste path or choose file" title="Path to .zip package. Paste here or use Choose File.">
            <button type="button" class="btn btn-secondary builder-choose-file-btn" title="Choose file (.zip)" aria-label="Choose file">
              <span class="builder-choose-file-btn__icon" aria-hidden="true"><svg width="18" height="18" aria-hidden="true"><use href="#icon-folder"/></svg></span>
              <span class="builder-choose-file-btn__text">Choose File</span>
            </button>
          </div>
        </div>
        <div class="builder-field-group">
          <label>Password</label>
          <input type="password" class="builder-field-password" placeholder="dev password">
        </div>
      `
      );
      const chooseBtn = builderStepFields.querySelector('.builder-choose-file-btn');
      const filePathInput = builderStepFields.querySelector('.builder-field-filePath');
      if (chooseBtn && filePathInput && window.roku && window.roku.selectSideloadFile) {
        chooseBtn.addEventListener('click', async () => {
          const result = await window.roku.selectSideloadFile();
          if (result && result.success && result.filePath) filePathInput.value = result.filePath;
        });
      }
      return;
    }
    if (type === 'deleteSideload') {
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group">
          <label>Password</label>
          <input type="password" class="builder-field-password" placeholder="dev password">
        </div>
      `
      );
      return;
    }
    if (type === 'appFunction') {
      builderStepFields.classList.add('builder-app-function-fields');
      const opts = raleFunctions.length
        ? raleFunctions
            .map((f) => {
              const name = (f && f.name) || 'unknown';
              return `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`;
            })
            .join('')
        : '<option value="">Connect App Connector first</option>';
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group builder-app-function-fn">
          <label>Function</label>
          <select class="builder-field-functionName action-scripts-select">${opts}</select>
        </div>
        <div class="builder-app-function-params"></div>
        <div class="builder-field-group">
          <label>Set Var (optional)</label>
          <input type="text" class="builder-field-assignToVar" placeholder="e.g. varX" autocomplete="off" spellcheck="false" title="Letters, digits, underscore; start with letter or _">
        </div>
      `
      );
      const fnSelect = builderStepFields.querySelector('.builder-field-functionName');
      const paramsContainer = builderStepFields.querySelector('.builder-app-function-params');
      function renderAppFunctionParams() {
        const name = fnSelect && fnSelect.value;
        const fn = raleFunctions.find((f) => (f && f.name) === name);
        const params = fn && Array.isArray(fn.params) ? fn.params : [];
        if (!paramsContainer) return;
        if (params.length === 0) {
          setSafeHTML(
            paramsContainer,
            '<div class="builder-params-empty">' + (name ? 'No parameters' : 'Select a function') + '</div>'
          );
          paramsContainer.className = 'builder-app-function-params';
          return;
        }
        const isComplexType = (t) => {
          if (!t) return false;
          const lower = String(t).toLowerCase();
          return ['roassociativearray', 'associativearray', 'roarray', 'array', 'rolist', 'list', 'object'].includes(
            lower
          );
        };
        const placeholderFor = (t) => {
          const lower = String(t).toLowerCase();
          if (['roassociativearray', 'associativearray', 'object'].includes(lower)) return '{}';
          if (['roarray', 'array', 'rolist', 'list'].includes(lower)) return '[]';
          if (['boolean', 'bool'].includes(lower)) return 'true | false';
          if (['integer', 'int', 'longinteger'].includes(lower)) return '0';
          if (['float', 'double'].includes(lower)) return '0.0';
          return '';
        };
        let html = '';
        params.forEach((param, index) => {
          const pName =
            param && typeof param === 'object' && param.name != null ? param.name : `param${index + 1}`;
          const pType =
            param && typeof param === 'object' && param.type != null ? param.type : 'Dynamic';
          const jsonHint = `{"name":"${escapeAttr(pName)}","type":"${escapeAttr(pType)}"}`;
          const label = `${pName} (${pType})`;
          const placeholder = placeholderFor(pType);
          const isComplex = isComplexType(pType);
          const tag = isComplex ? 'textarea' : 'input';
          const inputAttrs = isComplex
            ? `class="builder-field-param action-scripts-select" data-param-index="${index}" data-param-type="${escapeAttr(pType)}" placeholder="${escapeAttr(placeholder)}" rows="2"`
            : `class="builder-field-param action-scripts-select" type="${['boolean', 'bool'].includes(String(pType).toLowerCase()) ? 'text' : ['integer', 'int', 'longinteger', 'float', 'double'].includes(String(pType).toLowerCase()) ? 'number' : 'text'}" data-param-index="${index}" data-param-type="${escapeAttr(pType)}" placeholder="${escapeAttr(placeholder)}"`;
          html += `
            <div class="builder-field-group builder-param-row">
              <label title="${escapeAttr(jsonHint)}">${escapeHtml(label)}</label>
              <${tag} ${inputAttrs}></${tag}>
            </div>`;
        });
        setSafeHTML(paramsContainer, html);
        paramsContainer.className = 'builder-app-function-params';
      }
      if (fnSelect) {
        fnSelect.addEventListener('change', renderAppFunctionParams);
        renderAppFunctionParams();
      }
      return;
    }
    if (type === 'raleCommand') {
      if (builderAddSection) builderAddSection.classList.add('builder-rale-layout');
      builderStepFields.classList.add('builder-rale-command-fields');
      const cmdOpts = listRaleCommandsForBuilder()
        .map((o) => `<option value="${escapeAttr(o.value)}">${escapeHtml(o.label)}</option>`)
        .join('');
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group builder-rale-cmd-group">
          <label>Command</label>
          <select class="builder-field-rale-command action-scripts-select">${cmdOpts}</select>
        </div>
        <div class="builder-field-group builder-rale-assign-group">
          <label>Set Var (optional)</label>
          <input type="text" class="builder-field-assignToVar" placeholder="e.g. varX" autocomplete="off" spellcheck="false" title="Letters, digits, underscore; start with letter or _">
        </div>
        <div class="builder-rale-params-block">
          <span class="builder-rale-params-heading">Parameters</span>
          <div class="builder-rale-params-row">
            <div class="rale-params-container builder-rale-command-params"></div>
          </div>
        </div>
      `
      );
      const cmdEl = builderStepFields.querySelector('.builder-field-rale-command');
      if (cmdEl) {
        cmdEl.addEventListener('change', () => refreshActionScriptRaleFields(builderStepFields, null));
      }
      refreshActionScriptRaleFields(builderStepFields, null);
      return;
    }
    if (type === 'screenshot') {
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group">
          <label>Label (optional)</label>
          <input type="text" class="builder-field-label" placeholder="e.g. After login">
        </div>
        <div class="builder-field-group">
          <label>Wait Before (ms)</label>
          <input type="number" class="builder-field-screenshot-waitBeforeMs" value="100" placeholder="100" min="0">
        </div>
        <div class="builder-field-group">
          <label>Wait After (ms)</label>
          <input type="number" class="builder-field-screenshot-waitAfterTriggerMs" value="" placeholder="1500 (default)" min="0" title="Time to wait after triggering capture before first download. Increase if image is truncated or UI is slow (e.g. HUD).">
        </div>
      `
      );
      return;
    }
    if (type === 'devicePerformance') {
      const chartOpts = [
        { value: '', label: 'Choose chart…' },
        { value: 'objects', label: 'BrightScript Objects' },
        { value: 'cpu', label: 'CPU Usage' },
        { value: 'memory', label: 'System Memory' },
        { value: 'aboveAll', label: 'Above All' }
      ]
        .map(
          (o) =>
            `<option value="${escapeAttr(o.value)}">${escapeHtml(o.label)}</option>`
        )
        .join('');
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group">
          <label>Chart</label>
          <select class="builder-field-device-performance-chart action-scripts-select" required>
            ${chartOpts}
          </select>
        </div>
        <div class="builder-field-group">
          <label>Label (optional)</label>
          <input type="text" class="builder-field-device-performance-label" placeholder="e.g. After navigation">
        </div>
      `
      );
      return;
    }
    if (type === 'wait') {
      const waitModeOptions =
        '<option value="delay">Fixed Delay (ms)</option><option value="condition">Until Condition</option>';
      const stateOptions = MEDIA_PLAYER_STATES.map(
        (s) => `<option value="${escapeAttr(s.value)}">${escapeHtml(s.label)}</option>`
      ).join('');
      const opOptions = RALE_NODE_FIELD_OPERATORS.map(
        (op) => `<option value="${escapeAttr(op)}">${escapeHtml(op)}</option>`
      ).join('');
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group builder-wait-grid-slot-wait-mode">
          <label>Wait type</label>
          <select class="builder-field-wait-mode action-scripts-select">${waitModeOptions}</select>
        </div>
        <div class="builder-field-group builder-wait-delay-row builder-wait-grid-slot-delay">
          <label>Delay (ms)</label>
          <input type="number" class="builder-field-wait-delayMs" value="2000" placeholder="2000" min="0">
        </div>
        <div class="builder-field-group builder-wait-condition-rows builder-wait-grid-slot-source" style="display: none;">
          <label>Source</label>
          <select class="builder-field-wait-source action-scripts-select" data-wait-prev-src="">
            <option value="media-player">media-player</option>
            <option value="rale-node-field">RALE Node Field</option>
          </select>
        </div>
        <div class="builder-wait-mp-row builder-wait-condition-rows" style="display: none;">
          <div class="builder-wait-mp-inner">
            <div class="builder-field-group">
              <label>State</label>
              <select class="builder-field-wait-state action-scripts-select">
                <option value="">-- Select state --</option>
                ${stateOptions}
              </select>
            </div>
            <div class="builder-field-group">
              <label>Timeout (ms)</label>
              <input type="number" class="builder-field-timeoutMs builder-wait-timeout--mp" value="300000" placeholder="300000" min="0">
            </div>
            <div class="builder-field-group">
              <label>Poll interval (ms)</label>
              <input type="number" class="builder-field-pollIntervalMs builder-wait-poll--mp" value="2000" placeholder="2000" min="0">
            </div>
          </div>
        </div>
        <div class="builder-wait-rale-panel builder-wait-condition-rows" style="display: none;">
          <div class="builder-wait-rale-inner">
            <div class="builder-wait-rale-row-main">
              <div class="builder-field-group builder-wait-rale-path-col">
                <label>Path (JSON array)</label>
                <textarea class="builder-field-wait-path action-scripts-select" rows="2" spellcheck="false">[]</textarea>
              </div>
              <div class="builder-field-group">
                <label>Node id</label>
                <input type="text" class="builder-field-wait-node-id action-scripts-select" placeholder="node id">
              </div>
              <div class="builder-field-group">
                <label>Field name</label>
                <input type="text" class="builder-field-wait-field action-scripts-select" placeholder="field in fieldlist">
              </div>
              <div class="builder-field-group">
                <label>Operator</label>
                <select class="builder-field-wait-operator action-scripts-select">${opOptions}</select>
              </div>
            </div>
            <div class="builder-wait-rale-row-bottom">
              <div class="builder-field-group builder-wait-rale-value-cell">
                <label class="builder-field-wait-value-label">Value (is)</label>
                <input type="text" class="builder-field-wait-value action-scripts-select" placeholder="compare string">
              </div>
              <div class="builder-field-group builder-wait-rale-ci-cell">
                <span class="builder-wait-rale-ci-label-spacer" aria-hidden="true">&nbsp;</span>
                <div class="builder-wait-ci-row-inner">
                  <label class="builder-wait-ci-inline">
                    <input type="checkbox" class="builder-field-wait-caseInsensitive">
                    <span class="builder-wait-ci-text">Case-insensitive</span>
                  </label>
                </div>
              </div>
              <div class="builder-field-group">
                <label>Timeout (ms)</label>
                <input type="number" class="builder-field-timeoutMs builder-wait-timeout--rale" value="300000" placeholder="300000" min="0">
              </div>
              <div class="builder-field-group">
                <label>Poll interval (ms)</label>
                <input type="number" class="builder-field-pollIntervalMs builder-wait-poll--rale" value="2000" placeholder="2000" min="0">
              </div>
            </div>
          </div>
        </div>
      `
      );
      const waitMode = builderStepFields.querySelector('.builder-field-wait-mode');
      const delayRow = builderStepFields.querySelector('.builder-wait-delay-row');
      const conditionRows = builderStepFields.querySelectorAll('.builder-wait-condition-rows');
      const mpRow = builderStepFields.querySelector('.builder-wait-mp-row');
      const waitSource = builderStepFields.querySelector('.builder-field-wait-source');
      function toggleWaitSource() {
        const src = waitSource && waitSource.value;
        const prev = waitSource && waitSource.dataset.waitPrevSrc;
        if (prev === 'rale-node-field' && src === 'media-player') copyWaitTimingRaleToMediaPlayer();
        if (prev === 'media-player' && src === 'rale-node-field') copyWaitTimingMediaPlayerToRale();
        if (waitSource) waitSource.dataset.waitPrevSrc = src || '';
        if (mpRow) mpRow.style.display = src === 'media-player' ? 'flex' : 'none';
        const ralePanel = queryWaitRalePanel();
        if (ralePanel) ralePanel.style.display = src === 'rale-node-field' ? 'flex' : 'none';
        syncRaleNodeFieldWaitValueRows(builderStepFields);
      }
      function toggleWaitMode() {
        const isDelay = waitMode && waitMode.value === 'delay';
        if (delayRow) delayRow.style.display = isDelay ? 'flex' : 'none';
        conditionRows.forEach((r) => {
          r.style.display = isDelay ? 'none' : 'flex';
        });
        if (!isDelay) toggleWaitSource();
      }
      const operatorSel = builderStepFields.querySelector('.builder-field-wait-operator');
      if (operatorSel) {
        operatorSel.addEventListener('change', () => syncRaleNodeFieldWaitValueRows(builderStepFields));
      }
      if (waitMode) waitMode.addEventListener('change', toggleWaitMode);
      if (waitSource) waitSource.addEventListener('change', toggleWaitSource);
      builderStepFields.classList.add('builder-wait-step-fields');
      if (builderAddSection) builderAddSection.classList.add('builder-wait-layout');
      toggleWaitMode();
      syncRaleNodeFieldWaitValueRows(builderStepFields);
      return;
    }
    if (type === 'if') {
      const stateOptions = MEDIA_PLAYER_STATES.map(
        (s) => `<option value="${escapeAttr(s.value)}">${escapeHtml(s.label)}</option>`
      ).join('');
      const opOptions = RALE_NODE_FIELD_OPERATORS.map(
        (op) => `<option value="${escapeAttr(op)}">${escapeHtml(op)}</option>`
      ).join('');
      const activeAppAttrOptions = ACTIVE_APP_IF_ATTRIBUTES.map(
        (a) => `<option value="${escapeAttr(a.value)}">${escapeHtml(a.label)}</option>`
      ).join('');
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group builder-if-grid-slot-condition">
          <label>Condition source</label>
          <select class="builder-field-if-source action-scripts-select">
            <option value="media-player">Media Player</option>
            <option value="active-app">Active App</option>
            <option value="rale-node-field">RALE Node Field</option>
            <option value="variables">Variables</option>
          </select>
        </div>
        <div class="builder-field-group builder-if-grid-slot-mp-state builder-if-panel">
          <label>State</label>
          <select class="builder-field-if-state action-scripts-select">
            <option value="">-- Select state --</option>
            ${stateOptions}
          </select>
        </div>
        <div class="builder-if-rale-panel builder-if-panel" style="display:none">
          <div class="builder-wait-rale-inner">
            <div class="builder-wait-rale-row-main">
              <div class="builder-field-group builder-wait-rale-path-col">
                <label>Path (JSON array)</label>
                <textarea class="builder-field-if-rale-path action-scripts-select" rows="2" spellcheck="false">[]</textarea>
              </div>
              <div class="builder-field-group">
                <label>Node id</label>
                <input type="text" class="builder-field-if-rale-node-id action-scripts-select" placeholder="node id">
              </div>
              <div class="builder-field-group">
                <label>Field name</label>
                <input type="text" class="builder-field-if-rale-field action-scripts-select" placeholder="field in fieldlist">
              </div>
              <div class="builder-field-group">
                <label>Operator</label>
                <select class="builder-field-if-rale-operator action-scripts-select">${opOptions}</select>
              </div>
            </div>
            <div class="builder-wait-rale-row-bottom builder-if-rale-row-bottom--two-cols">
              <div class="builder-field-group builder-if-rale-value-cell builder-wait-rale-value-cell">
                <label class="builder-field-if-rale-value-label">Value (is)</label>
                <input type="text" class="builder-field-if-rale-value action-scripts-select" placeholder="compare string">
              </div>
              <div class="builder-field-group builder-if-rale-ci-cell builder-wait-rale-ci-cell">
                <span class="builder-wait-rale-ci-label-spacer" aria-hidden="true">&nbsp;</span>
                <div class="builder-wait-ci-row-inner">
                  <label class="builder-wait-ci-inline">
                    <input type="checkbox" class="builder-field-if-rale-caseInsensitive">
                    <span class="builder-wait-ci-text">Case-insensitive</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="builder-if-active-app-panel builder-if-panel" style="display:none">
          <div class="builder-field-group">
            <label>Attribute</label>
            <select class="builder-field-if-active-app-attribute action-scripts-select">
              ${activeAppAttrOptions}
            </select>
          </div>
          <div class="builder-if-compare-row builder-if-active-app-compare-row">
            <div class="builder-field-group">
              <label>Operator</label>
              <select class="builder-field-if-active-app-operator action-scripts-select">${opOptions}</select>
            </div>
            <div class="builder-field-group builder-if-active-app-value-cell">
              <label class="builder-field-if-active-app-value-label">Value (is)</label>
              <input type="text" class="builder-field-if-active-app-value action-scripts-select" placeholder="e.g. dev, 837, YouTube">
            </div>
            <div class="builder-field-group builder-if-active-app-ci-cell builder-wait-rale-ci-cell">
              <span class="builder-wait-rale-ci-label-spacer" aria-hidden="true">&nbsp;</span>
              <div class="builder-wait-ci-row-inner">
                <label class="builder-wait-ci-inline">
                  <input type="checkbox" class="builder-field-if-active-app-caseInsensitive">
                  <span class="builder-wait-ci-text">Case-insensitive</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        <div class="builder-if-vars-panel builder-if-panel" style="display:none">
          <div class="builder-field-group">
            <label>Variable path</label>
            <input type="text" class="builder-field-if-variablePath action-scripts-select" placeholder="myVar or data.items.0.id">
          </div>
          <div class="builder-if-compare-row builder-if-vars-compare-row">
            <div class="builder-field-group">
              <label>Operator</label>
              <select class="builder-field-if-vars-operator action-scripts-select">${opOptions}</select>
            </div>
            <div class="builder-field-group builder-if-vars-value-cell">
              <label class="builder-field-if-vars-value-label">Value (is)</label>
              <input type="text" class="builder-field-if-vars-value action-scripts-select" placeholder="compare value">
            </div>
            <div class="builder-field-group builder-if-vars-ci-cell builder-wait-rale-ci-cell">
              <span class="builder-wait-rale-ci-label-spacer" aria-hidden="true">&nbsp;</span>
              <div class="builder-wait-ci-row-inner">
                <label class="builder-wait-ci-inline">
                  <input type="checkbox" class="builder-field-if-vars-caseInsensitive">
                  <span class="builder-wait-ci-text">Case-insensitive</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      `
      );
      const ifSource = builderStepFields.querySelector('.builder-field-if-source');
      function toggleIfPanels() {
        const src = ifSource && ifSource.value;
        const mp = builderStepFields.querySelector('.builder-if-grid-slot-mp-state');
        const aa = builderStepFields.querySelector('.builder-if-active-app-panel');
        const rale = builderStepFields.querySelector('.builder-if-rale-panel');
        const vars = builderStepFields.querySelector('.builder-if-vars-panel');
        if (mp) mp.style.display = src === 'media-player' ? '' : 'none';
        /* Clear inline display when visible so CSS can use flex + gap on compare rows (block would drop gap). */
        if (aa) aa.style.display = src === 'active-app' ? '' : 'none';
        if (rale) rale.style.display = src === 'rale-node-field' ? '' : 'none';
        if (vars) vars.style.display = src === 'variables' ? '' : 'none';
        syncIfConditionValueRows(builderStepFields);
      }
      ifSource?.addEventListener('change', toggleIfPanels);
      builderStepFields
        .querySelector('.builder-field-if-rale-operator')
        ?.addEventListener('change', () => syncIfConditionValueRows(builderStepFields));
      builderStepFields
        .querySelector('.builder-field-if-vars-operator')
        ?.addEventListener('change', () => syncIfConditionValueRows(builderStepFields));
      builderStepFields
        .querySelector('.builder-field-if-active-app-operator')
        ?.addEventListener('change', () => syncIfConditionValueRows(builderStepFields));
      builderStepFields.classList.add('builder-if-step-fields');
      if (builderAddSection) builderAddSection.classList.add('builder-if-layout');
      toggleIfPanels();
      syncIfConditionValueRows(builderStepFields);
      return;
    }
    if (type === 'post') {
      const postOpts = POST_PRESETS.map(
        (p) => `<option value="${escapeAttr(p.endpoint)}">${escapeHtml(p.label)}</option>`
      ).join('');
      setSafeHTML(
        builderStepFields,
        `
        <div class="builder-field-group">
          <label>POST</label>
          <select class="builder-field-endpoint builder-post-preset action-scripts-select">
            <option value="">-- Select POST --</option>
            ${postOpts}
          </select>
        </div>
      `
      );
      return;
    }
    setSafeHTML(builderStepFields, '<p>No extra fields for this type.</p>');
  };
}

// Function selector and management

import { escapeHtml, setSafeHTML, setDynamicHTML, clearDynamic } from '../../modules/utils/index.js';
import { RALE_BUILTIN_COMMANDS } from './rale-builtins.js';
import { S } from '@shared/strings/index.js';
import type {
  DevicePanelRoot,
  ExternalControlFunctionMeta,
  FunctionSelectorElements,
  RenderParamInputsFn
} from './inspector-types.js';

/**
 * Setup function selector
 */
export function setupFunctionSelector(
  panel: DevicePanelRoot,
  elements: FunctionSelectorElements,
  renderParamInputsFn: RenderParamInputsFn
) {
  const {
    funcSelect,
    funcNameInput,
    funcParamHint,
    availableFunctions: initialFunctions = []
  } = elements;

  let availableFunctions: ExternalControlFunctionMeta[] = [...initialFunctions];

  // Set dynamic hint content (function counts / a function's description). `setDynamicHTML` marks the
  // element JS-managed so a live locale switch's applyI18n pass won't revert this live text back to
  // the generic "Select a function…" placeholder. The disconnected path calls `clearDynamic` to hand
  // the element (with its original data-i18n key untouched) back to applyI18n so the placeholder
  // retranslates again.
  const setDynamicFuncParamHint = (html: string): void => setDynamicHTML(funcParamHint, html);

  function renderRaleOptgroup() {
    let html = '';
    for (const [valueKey, def] of Object.entries(RALE_BUILTIN_COMMANDS)) {
      html += `<option value="${escapeHtml(valueKey)}" data-source="rale">${escapeHtml(def.label)}</option>`;
    }
    return html;
  }

  // Render available functions in dropdown (App Connector + RALE optgroups)
  function renderFunctionsList(isConnected = false) {
    if (!isConnected) {
      // data-i18n so applyI18n(document) retranslates the placeholder on a live locale switch (it's
      // regenerated with the correct locale when functions load / the tab reconnects).
      setSafeHTML(
        funcSelect,
        `<option value="" data-i18n="inspector.connectToLoadFunctions">${S.inspector.connectToLoadFunctions}</option>`
      );
      funcNameInput.value = '';
      if (funcParamHint) {
        setSafeHTML(funcParamHint, S.inspector.selectFunctionForParamDetails);
        // Clear the JS-managed marker (a prior connected state may have set it) so applyI18n
        // retranslates this disconnected hint via the element's data-i18n key on the next switch.
        clearDynamic(funcParamHint);
      }
      renderParamInputsFn([]);
      return;
    }

    let html = `<option value="" data-i18n="inspector.selectAFunction">${S.inspector.selectAFunction}</option>`;
    html += `<optgroup label="${S.inspector.appConnectorFunctions}">`;
    if (availableFunctions.length === 0) {
      html +=
        `<option value="" disabled data-i18n="inspector.noFunctionsImplement">${S.inspector.noFunctionsImplement}</option>`;
    } else {
      availableFunctions.forEach((func, index) => {
        const funcName =
          (func && func.name) || (typeof func === 'string' ? func : S.inspector.unknownFunctionName);
        html += `<option value="${escapeHtml(funcName)}" data-source="app" data-func-index="${index}">${escapeHtml(funcName)}</option>`;
      });
    }
    html += '</optgroup>';
    html += `<optgroup label="${S.inspector.raleFunctions}">`;
    html += renderRaleOptgroup();
    html += '</optgroup>';

    setSafeHTML(funcSelect, html);
    funcNameInput.value = '';
    renderParamInputsFn([]);
    if (funcParamHint) {
      const appCount = availableFunctions.length;
      const raleCount = Object.keys(RALE_BUILTIN_COMMANDS).length;
      setDynamicFuncParamHint(
        `<span style="color: var(--accent-green);">${S.inspector.functionCounts(appCount, raleCount)}</span>`
      );
    }
  }

  // Handle function selection from dropdown
  funcSelect.addEventListener('change', () => {
    const selectedOption = funcSelect.options[funcSelect.selectedIndex];
    const funcName = funcSelect.value;

    if (!funcName) {
      funcNameInput.value = '';
      renderParamInputsFn([]);
      if (funcParamHint) {
        const appCount = availableFunctions.length;
        const raleCount = Object.keys(RALE_BUILTIN_COMMANDS).length;
        setDynamicFuncParamHint(
          `<span style="color: var(--accent-green);">${S.inspector.functionCounts(appCount, raleCount)}</span>`
        );
      }
      return;
    }

    if (selectedOption.dataset.source === 'rale') {
      const builtin = RALE_BUILTIN_COMMANDS[funcName as keyof typeof RALE_BUILTIN_COMMANDS];
      if (!builtin) {
        return;
      }
      funcNameInput.value = funcName;
      setDynamicFuncParamHint(
        `<div style="color: var(--text-secondary);">${escapeHtml(builtin.description)}</div>`
      );
      renderParamInputsFn(builtin.params || [], { builtin, selectionKey: funcName });
      return;
    }

    if (selectedOption.dataset.source === 'app') {
      funcNameInput.value = funcName;
      const funcIndex = parseInt(selectedOption.dataset.funcIndex ?? '', 10);
      const func = availableFunctions[funcIndex] as ExternalControlFunctionMeta | undefined;
      if (!func) {
        return;
      }
      const funcParams = Array.isArray(func.params) ? func.params : (func.parameters || []);
      const paramCount = func.paramCount || (Array.isArray(funcParams) ? funcParams.length : 0);
      const funcDesc = func.description || '';

      let hintHtml = '';
      if (funcDesc) {
        hintHtml += `<div style="color: var(--text-secondary);">${escapeHtml(funcDesc)}</div>`;
      } else {
        hintHtml += `<span style="color: var(--accent-green);">${S.inspector.readyToExecute}</span>`;
      }

      setDynamicFuncParamHint(hintHtml);

      if (paramCount > 0 && Array.isArray(funcParams) && funcParams.length > 0) {
        renderParamInputsFn(funcParams);
      } else if (paramCount > 0) {
        const genericParams = Array(paramCount)
          .fill(null)
          .map((_, i) => ({ name: `param${i + 1}`, type: 'any' }));
        renderParamInputsFn(genericParams);
      } else {
        renderParamInputsFn([]);
      }
    }
  });

  return {
    setFunctions: (functions: ExternalControlFunctionMeta[]) => {
      availableFunctions = functions;
      renderFunctionsList(true);
    },
    getFunctions: () => availableFunctions,
    clearFunctions: () => {
      availableFunctions = [];
      renderFunctionsList(false);
    },
    renderFunctionsList
  };
}

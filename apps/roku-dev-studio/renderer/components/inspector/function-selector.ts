// Function selector and management

import { escapeHtml, setSafeHTML } from '../../modules/utils/index.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
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
    funcInfoBtn = null,
    funcNameInput,
    availableFunctions: initialFunctions = []
  } = elements;

  let availableFunctions: ExternalControlFunctionMeta[] = [...initialFunctions];
  let selectedFunctionInfo = '';

  function setFunctionInfoButtonState(enabled: boolean): void {
    if (!funcInfoBtn) return;
    funcInfoBtn.disabled = !enabled;
    funcInfoBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  }

  function openFunctionInfoModal(text: string): void {
    const body = text.trim() || S.inspector.noFunctionDetails;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active inspector-func-info-overlay';
    setSafeHTML(
      overlay,
      `<div class="modal inspector-func-info-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(S.inspector.functionDetailsTitle)}">
         <div class="modal-header">
           <h2>${escapeHtml(S.inspector.functionDetailsTitle)}</h2>
           <button type="button" class="modal-close inspector-func-info-close" title="${escapeHtml(S.common.close)}" aria-label="${escapeHtml(S.common.close)}">&times;</button>
         </div>
         <div class="modal-body">
           <p class="inspector-func-info-text">${escapeHtml(body)}</p>
         </div>
       </div>`
    );

    const close = (): void => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    // mousedown-latched backdrop close (a naive click===overlay closes on a drag-out release).
    attachBackdropClickToClose(overlay, close);
    overlay.querySelectorAll('.inspector-func-info-close').forEach((el) => {
      el.addEventListener('click', close);
    });
    document.body.appendChild(overlay);
  }

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
      renderParamInputsFn([]);
      selectedFunctionInfo = '';
      setFunctionInfoButtonState(false);
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
    selectedFunctionInfo = '';
    setFunctionInfoButtonState(false);
  }

  // Handle function selection from dropdown
  funcSelect.addEventListener('change', () => {
    const selectedOption = funcSelect.options[funcSelect.selectedIndex];
    const funcName = funcSelect.value;

    if (!funcName) {
      funcNameInput.value = '';
      renderParamInputsFn([]);
      selectedFunctionInfo = '';
      setFunctionInfoButtonState(false);
      return;
    }

    if (selectedOption.dataset.source === 'rale') {
      const builtin = RALE_BUILTIN_COMMANDS[funcName as keyof typeof RALE_BUILTIN_COMMANDS];
      if (!builtin) {
        return;
      }
      funcNameInput.value = funcName;
      selectedFunctionInfo = builtin.description || S.inspector.noFunctionDetails;
      setFunctionInfoButtonState(true);
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

      selectedFunctionInfo = funcDesc || S.inspector.readyToExecute;
      setFunctionInfoButtonState(true);

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

  funcInfoBtn?.addEventListener('click', () => {
    if (!funcSelect.value) return;
    openFunctionInfoModal(selectedFunctionInfo);
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

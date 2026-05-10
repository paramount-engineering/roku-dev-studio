// Parameter input rendering and management

import { escapeHtml, setSafeHTML } from '../../modules/utils/index.js';
import { renderRegistryBuiltinParams, getRegistryBuiltinParamValues } from './registry-params-ui.js';
import { syncBuilderRaleParamRowHeights } from './rale-builder-param-row-sync.js';
import type { RenderParamInputsOptions } from './inspector-types.js';

/**
 * Roku type definitions
 */
const ROKU_TYPES = {
  // Simple types (single-line input)
  simple: ['boolean', 'integer', 'longinteger', 'float', 'double', 'string', 'int', 'bool'],
  // Complex types (multi-line JSON input)
  complex: ['roassociativearray', 'associativearray', 'roarray', 'array', 'rolist', 'list', 'object', 'map', 'dictionary']
};

/**
 * Check if type is complex (needs multi-line input)
 * @param {string} type - Parameter type
 * @returns {boolean}
 */
function isComplexType(type: string) {
  if (!type) return false;
  return ROKU_TYPES.complex.includes(type.toLowerCase());
}

/**
 * Check if type is array-like
 * @param {string} type - Parameter type
 * @returns {boolean}
 */
function isArrayType(type: string) {
  if (!type) return false;
  const arrayTypes = ['roarray', 'array', 'rolist', 'list'];
  return arrayTypes.includes(type.toLowerCase());
}

/**
 * Get placeholder hint for type
 * @param {string} type - Parameter type
 * @param {string} paramName - Parameter name
 * @returns {string}
 */
function getTypePlaceholder(type: string, paramName: string) {
  if (!type) return `${paramName}`;
  
  const t = type.toLowerCase();
  switch (t) {
    case 'boolean':
    case 'bool':
      return 'true or false';
    case 'integer':
    case 'int':
      return '0';
    case 'longinteger':
      return '0';
    case 'float':
      return '0.0';
    case 'double':
      return '0.0';
    case 'string':
      return 'Enter text...';
    case 'roassociativearray':
    case 'associativearray':
    case 'object':
    case 'map':
    case 'dictionary':
      return '{ "key": "value" }';
    case 'roarray':
    case 'array':
      return '[ "item1", "item2" ]';
    case 'rolist':
    case 'list':
      return '[ "item1", "item2" ]';
    default:
      return `${paramName} (${type})`;
  }
}

/**
 * Get default value for type
 * @param {string} type - Parameter type
 * @returns {string}
 */
function getTypeDefaultValue(type: string) {
  if (!type) return '';
  const t = type.toLowerCase();
  if (isArrayType(t)) return '';
  if (isComplexType(t)) return '';
  return '';
}

/**
 * Auto-resize textarea to fit content
 * @param {HTMLTextAreaElement} textarea - Textarea element
 */
function autoResizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto';
  const newHeight = Math.max(38, Math.min(textarea.scrollHeight, 200));
  textarea.style.height = newHeight + 'px';
}

/**
 * Format value for complex types
 * @param {string} value - Input value
 * @param {string} type - Parameter type
 * @returns {string}
 */
function formatComplexValue(value: string, type: string) {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

/**
 * Get CSS class for type badge
 * @param {string} type - Parameter type
 * @returns {string}
 */
function getTypeClass(type: string) {
  if (!type) return '';
  const t = type.toLowerCase();
  if (['boolean', 'bool'].includes(t)) return 'type-boolean';
  if (['integer', 'int', 'longinteger'].includes(t)) return 'type-number';
  if (['float', 'double'].includes(t)) return 'type-number';
  if (['string'].includes(t)) return 'type-string';
  if (isComplexType(t)) return 'type-complex';
  return '';
}

/**
 * Render parameter input fields
 * @param {HTMLElement} paramsContainer - Container for parameter inputs
 * @param {Array} params - Array of parameter definitions
 * @param {HTMLElement} funcSelect - Function select element (for empty state)
 * @param {RenderParamInputsOptions} [options]
 */
export function renderParamInputs(
  paramsContainer: HTMLElement | null,
  params: unknown[],
  funcSelect: HTMLSelectElement,
  options: RenderParamInputsOptions = {}
) {
  if (!paramsContainer) return;

  const { builtin, getConnectionId, sendCommand } = options;
  if (
    builtin &&
    builtin.registryUi &&
    typeof getConnectionId === 'function' &&
    typeof sendCommand === 'function'
  ) {
    void renderRegistryBuiltinParams(paramsContainer, params, funcSelect, {
      builtin,
      getConnectionId,
      sendCommand
    });
    return;
  }

  delete paramsContainer.dataset.registryMode;
  delete paramsContainer.dataset.registryUi;

  if (!params || params.length === 0) {
    setSafeHTML(paramsContainer, `
      <div class="rale-params-empty">
        ${funcSelect?.value ? '✓ No parameters required' : 'Select a function to see parameters'}
      </div>
    `);
    return;
  }
  
  let html = '';
  params.forEach((param: unknown, index: number) => {
    const p = param as { name?: string; type?: string; defaultValue?: unknown };
    const paramName = typeof param === 'string' ? param : (p.name || `param${index + 1}`);
    const paramType = typeof param === 'object' && param != null && p.type ? p.type : 'Dynamic';
    const isComplex = isComplexType(paramType);
    const placeholder = getTypePlaceholder(paramType, paramName);
    const defaultValue =
      typeof param === 'object' && param != null && Object.prototype.hasOwnProperty.call(param, 'defaultValue')
        ? String(p.defaultValue ?? '')
        : getTypeDefaultValue(paramType);
    const complexClass = isComplex ? 'complex-type' : '';
    const typeClass = getTypeClass(paramType);
    
    html += `
      <div class="rale-param-input-row">
        <label class="rale-param-label">
          <span class="param-name">${escapeHtml(paramName)}</span>
          <span class="param-type ${typeClass}">${escapeHtml(paramType)}</span>
        </label>
        <textarea class="rale-param-input ${complexClass}" data-param-index="${index}" data-param-name="${escapeHtml(paramName)}" data-param-type="${escapeHtml(paramType)}" placeholder="${escapeHtml(placeholder)}" rows="1">${escapeHtml(String(defaultValue ?? ''))}</textarea>
      </div>
    `;
  });
  
  setSafeHTML(paramsContainer, html);
  
  // Add auto-resize and formatting listeners to all textareas
  paramsContainer.querySelectorAll('.rale-param-input').forEach((node: Element) => {
    if (!(node instanceof HTMLTextAreaElement)) return;
    const textarea = node;
    const paramType = textarea.dataset.paramType ?? '';
    const isComplex = isComplexType(paramType);

    autoResizeTextarea(textarea);

    textarea.addEventListener('input', () => {
      autoResizeTextarea(textarea);
      syncBuilderRaleParamRowHeights(paramsContainer);
    });

    if (isComplex) {
      textarea.addEventListener('paste', () => {
        setTimeout(() => {
          const formatted = formatComplexValue(textarea.value, paramType);
          if (formatted !== textarea.value) {
            textarea.value = formatted;
            autoResizeTextarea(textarea);
            syncBuilderRaleParamRowHeights(paramsContainer);
          }
        }, 10);
      });

      textarea.addEventListener('blur', () => {
        const formatted = formatComplexValue(textarea.value, paramType);
        if (formatted !== textarea.value) {
          textarea.value = formatted;
          autoResizeTextarea(textarea);
          syncBuilderRaleParamRowHeights(paramsContainer);
        }
      });
    }
  });
  syncBuilderRaleParamRowHeights(paramsContainer);
}

/**
 * Get parameter values from inputs
 * @param {HTMLElement} paramsContainer - Container with parameter inputs
 * @returns {Array} Array of parsed parameter values
 */
export function getParamValues(paramsContainer: HTMLElement): unknown[] {
  if (paramsContainer?.dataset?.registryMode === 'true') {
    return getRegistryBuiltinParamValues(paramsContainer);
  }

  const inputs = paramsContainer.querySelectorAll('.rale-param-input');
  const values: unknown[] = [];

  inputs.forEach((input: Element) => {
    if (!(input instanceof HTMLTextAreaElement)) return;
    let raw = input.value.trim();
    const paramType = (input.dataset.paramType || 'dynamic').toLowerCase();

    if (!raw) {
      if (isArrayType(paramType)) {
        values.push([]);
      } else if (isComplexType(paramType)) {
        values.push({});
      } else {
        values.push(null);
      }
      return;
    }

    let parsed: unknown = raw;
    if (['boolean', 'bool'].includes(paramType)) {
      parsed = raw.toLowerCase() === 'true';
    } else if (['integer', 'int', 'longinteger'].includes(paramType)) {
      parsed = parseInt(raw, 10) || 0;
    } else if (['float', 'double'].includes(paramType)) {
      parsed = parseFloat(raw) || 0.0;
    } else if (paramType === 'string') {
      let s = raw;
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1);
      }
      parsed = s;
    } else {
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.warn(`Parameter ${input.dataset.paramName}: kept as string (not valid JSON)`);
      }
    }

    values.push(parsed);
  });

  return values;
}

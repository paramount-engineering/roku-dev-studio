/**
 * Shared DOM / coercion helpers for the action script builder.
 */

import { raleArgsToParamStrings } from './rale-command-param-ui.js';
import { OPS_NEED_VALUE } from './action-script-if-client.js';

export function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Show or hide RALE value + case cells; set value label; compact bottom row when no compare value.
 * @param {HTMLElement | null} stepFieldsRoot
 */
export function syncRaleNodeFieldWaitValueRows(stepFieldsRoot) {
  if (!stepFieldsRoot) return;
  const waitSource = stepFieldsRoot.querySelector('.builder-field-wait-source');
  const panel = stepFieldsRoot.querySelector('.builder-wait-rale-panel');
  if (!panel || !waitSource) return;
  const operatorSel = panel.querySelector('.builder-field-wait-operator');
  const bottom = panel.querySelector('.builder-wait-rale-row-bottom');
  const valueCell = panel.querySelector('.builder-wait-rale-value-cell');
  const ciCell = panel.querySelector('.builder-wait-rale-ci-cell');
  const valueLabel = panel.querySelector('.builder-field-wait-value-label');
  if (!operatorSel) return;
  const op = operatorSel.value || 'is';
  if (valueLabel) valueLabel.textContent = `Value (${op})`;
  const need = OPS_NEED_VALUE.has(op);
  const isRale = waitSource.value === 'rale-node-field';
  if (!isRale) return;
  if (bottom) bottom.classList.toggle('builder-wait-rale-bottom--no-value', !need);
  const disp = need ? '' : 'none';
  if (valueCell) valueCell.style.display = disp;
  if (ciCell) ciCell.style.display = disp;
}

const IF_VALUE_ROW_PANELS = [
  {
    source: 'rale-node-field',
    opSel: '.builder-field-if-rale-operator',
    valueCell: '.builder-if-rale-value-cell',
    ciCell: '.builder-if-rale-ci-cell',
    valueLabel: '.builder-field-if-rale-value-label'
  },
  {
    source: 'variables',
    opSel: '.builder-field-if-vars-operator',
    valueCell: '.builder-if-vars-value-cell',
    ciCell: '.builder-if-vars-ci-cell',
    valueLabel: '.builder-field-if-vars-value-label'
  },
  {
    source: 'active-app',
    opSel: '.builder-field-if-active-app-operator',
    valueCell: '.builder-if-active-app-value-cell',
    ciCell: '.builder-if-active-app-ci-cell',
    valueLabel: '.builder-field-if-active-app-value-label'
  }
];

/**
 * Show/hide value + case-insensitive for if-step RALE, variables, and active-app panels.
 * @param {HTMLElement | null} stepFieldsRoot
 */
export function syncIfConditionValueRows(stepFieldsRoot) {
  if (!stepFieldsRoot) return;
  const src = stepFieldsRoot.querySelector('.builder-field-if-source')?.value;
  for (const cfg of IF_VALUE_ROW_PANELS) {
    if (src !== cfg.source) continue;
    const op = stepFieldsRoot.querySelector(cfg.opSel)?.value || 'is';
    const need = OPS_NEED_VALUE.has(op);
    const vCell = stepFieldsRoot.querySelector(cfg.valueCell);
    const ciCell = stepFieldsRoot.querySelector(cfg.ciCell);
    const vLabel = stepFieldsRoot.querySelector(cfg.valueLabel);
    if (vLabel) vLabel.textContent = `Value (${op})`;
    const disp = need ? '' : 'none';
    if (vCell) vCell.style.display = disp;
    if (ciCell) ciCell.style.display = disp;
  }
}

/**
 * @param {string} [text]
 * @returns {unknown[]}
 */
export function parseRalePathFromTextarea(text) {
  const t = text != null ? String(text).trim() : '';
  if (!t) return [];
  try {
    const p = JSON.parse(t);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/**
 * Coerce if-step compare field text to JSON-friendly scalars (matches collect semantics).
 * @param {string} raw
 */
export function coerceIfConditionValueFromText(raw) {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && !Number.isNaN(Number(trimmed)) && String(Number(trimmed)) === trimmed) {
    return Number(trimmed);
  }
  return trimmed;
}

/**
 * @param {unknown} val
 * @returns {string}
 */
export function conditionValueToInputString(val) {
  if (val == null) return '';
  return typeof val === 'string' ? val : JSON.stringify(val);
}

/**
 * @param {unknown} pathVal
 * @returns {string}
 */
export function stringifyPathForTextarea(pathVal) {
  try {
    return JSON.stringify(pathVal != null ? pathVal : [], null, 2);
  } catch {
    return '[]';
  }
}

/**
 * After RALE param UI render, apply saved args (registry select cascade only if those controls exist).
 * @param {HTMLElement} container
 * @param {string} command
 * @param {Record<string, unknown>} args
 */
export function applyRaleArgsToBuilderParams(container, command, args) {
  const strings = raleArgsToParamStrings(command, args);
  const els = Array.from(container.querySelectorAll('[data-param-index]')) as HTMLElement[];
  els.sort(
    (a, b) =>
      Number(a.dataset.paramIndex || 0) -
      Number(b.dataset.paramIndex || 0)
  );

  function setSelectValue(sel: HTMLSelectElement, val: string) {
    if (!val) return;
    if ([...sel.options].some((o) => o.value === val)) {
      sel.value = val;
      return;
    }
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    sel.appendChild(opt);
    sel.value = val;
  }

  if (command === 'removeRegistryField' || command === 'editRegistryField') {
    const sec = container.querySelector('select.rale-registry-section');
    const keySel = container.querySelector('select.rale-registry-key');
    if (sec instanceof HTMLSelectElement && keySel instanceof HTMLSelectElement) {
      if (strings[0]) setSelectValue(sec, strings[0]);
      sec.dispatchEvent(new Event('change'));
      if (strings[1]) setSelectValue(keySel, strings[1]);
      for (let i = 2; i < strings.length; i++) {
        const el = els.find((e) => Number(e.dataset.paramIndex) === i);
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = strings[i];
      }
      return;
    }
  }

  els.forEach((el, i) => {
    if (i >= strings.length) return;
    const val = strings[i];
    if (val == null || val === '') return;
    if (el instanceof HTMLSelectElement) setSelectValue(el, val);
    else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = val;
  });
}

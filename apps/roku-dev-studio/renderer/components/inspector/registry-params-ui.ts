// Registry-specific parameter UI (sections/keys from getRegistrySections)

import { escapeHtml, setSafeHTML } from '../../modules/utils/index.js';
import { syncBuilderRaleParamRowHeights } from './rale-builder-param-row-sync.js';
import { S } from '@shared/strings/index.js';
import type { RaleSendCommand } from './inspector-types.js';

export type RegistrySectionsMap = Record<string, Record<string, string>>;

function isSectionMap(data: unknown): data is Record<string, unknown> {
  return data != null && typeof data === 'object' && !Array.isArray(data);
}

/**
 * Fetch the current device's full registry snapshot.
 *
 * Goes through `sendCommand` (which wraps `AppConnector.command`) rather than
 * `api.raleCommand` so the call benefits from verify-and-reconnect on a stale
 * socket and stays consistent with every other RALE call site in the Inspector.
 * See `engineering-principles.md` §2 "centralize where the data is produced"
 * and the note on `inspector/function-execution.ts::sendCommand`.
 */
export async function fetchRegistrySectionsData(
  getConnectionId: () => string | null | undefined,
  sendCommand: RaleSendCommand
): Promise<{ ok: true; sections: RegistrySectionsMap } | { ok: false; message: string }> {
  const connectionId = getConnectionId();
  if (!connectionId) {
    return { ok: false, message: S.inspector.notConnected };
  }
  const res = await sendCommand('getRegistrySections', {});
  if (!res || !res.success) {
    return { ok: false, message: String(res?.error || S.inspector.commandFailed) };
  }
  const data = res.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    const err = d.error as { message?: unknown } | undefined;
    if (err?.message) {
      return { ok: false, message: String(err.message) };
    }
  }
  if (!isSectionMap(data)) {
    return { ok: false, message: S.inspector.unexpectedRegistryResponse };
  }
  const dataObj = data;
  const sections: RegistrySectionsMap = {};
  for (const sn of Object.keys(dataObj)) {
    const sec = dataObj[sn];
    if (sec && typeof sec === 'object' && !Array.isArray(sec)) {
      sections[sn] = sec as Record<string, string>;
    }
  }
  return { ok: true, sections };
}

function autoResize(el: HTMLElement) {
  if (!(el instanceof HTMLTextAreaElement)) return;
  el.style.height = 'auto';
  const h = Math.max(38, Math.min(el.scrollHeight, 200));
  el.style.height = h + 'px';
}

function attachTextareaResize(root: HTMLElement) {
  root.querySelectorAll('textarea.rale-param-input').forEach((ta: Element) => {
    if (!(ta instanceof HTMLTextAreaElement)) return;
    autoResize(ta);
    ta.addEventListener('input', () => {
      autoResize(ta);
      syncBuilderRaleParamRowHeights(root);
    });
  });
  syncBuilderRaleParamRowHeights(root);
}

function sectionOptionsHtml(sections: RegistrySectionsMap, selected: string) {
  const names = Object.keys(sections).sort();
  let html =
    `<option value="">${S.inspector.selectSection}</option>` +
    names.map((n) => {
      const sel = n === selected ? ' selected' : '';
      return `<option value="${escapeHtml(n)}"${sel}>${escapeHtml(n)}</option>`;
    }).join('');
  if (names.length === 0) {
    html += `<option value="" disabled>${S.inspector.noSections}</option>`;
  }
  return html;
}

function keyOptionsHtml(fields: Record<string, string>, selected = '') {
  const keys = Object.keys(fields || {}).sort();
  let html =
    `<option value="">${S.inspector.selectKey}</option>` +
    keys.map((k) => {
      const sel = k === selected ? ' selected' : '';
      return `<option value="${escapeHtml(k)}"${sel}>${escapeHtml(k)}</option>`;
    }).join('');
  if (keys.length === 0) {
    html += `<option value="" disabled>${S.inspector.noKeys}</option>`;
  }
  return html;
}

export async function renderRegistryBuiltinParams(
  paramsContainer: HTMLElement,
  _params: unknown[],
  _funcSelect: HTMLElement,
  options: {
    builtin: { registryUi?: string; params?: unknown[] };
    getConnectionId: () => string | null | undefined;
    sendCommand: RaleSendCommand;
  }
) {
  const { builtin, getConnectionId, sendCommand } = options;
  const ui = builtin.registryUi;
  if (!ui) return;

  paramsContainer.dataset.registryMode = 'true';
  paramsContainer.dataset.registryUi = ui;

  setSafeHTML(
    paramsContainer,
    `<div class="rale-params-empty"><span style="color: var(--text-secondary);">${S.inspector.loadingRegistry}</span></div>`
  );

  // Latest-call-wins: rapidly switching RALE registry commands would otherwise let an
  // older fetch's result clobber a newer one. Tag each invocation and ignore stale responses.
  type RegistryContainer = HTMLElement & { __registryReqId?: number };
  const container = paramsContainer as RegistryContainer;
  const reqId = (container.__registryReqId ?? 0) + 1;
  container.__registryReqId = reqId;
  const isStale = () => container.__registryReqId !== reqId;

  const loaded = await fetchRegistrySectionsData(getConnectionId, sendCommand);
  if (isStale()) return;
  if (!loaded.ok) {
    delete paramsContainer.dataset.registryMode;
    delete paramsContainer.dataset.registryUi;
    setSafeHTML(
      paramsContainer,
      `<div class="rale-params-empty"><span style="color: var(--accent-red);">${escapeHtml(loaded.message)}</span></div>`
    );
    return;
  }

  const sections: RegistrySectionsMap = loaded.sections;
  const sectionNames = Object.keys(sections).sort();
  const firstSection = sectionNames[0] || '';

  if (ui === 'removeSection') {
    setSafeHTML(
      paramsContainer,
      `
      <div class="rale-registry-params" data-registry-ui="removeSection">
        <div class="rale-param-input-row">
          <label class="rale-param-label">
            <span class="param-name">name</span>
            <span class="param-type type-string">String</span>
          </label>
          <select class="rale-param-input rale-registry-select" data-param-index="0" data-param-type="string" aria-label="${S.inspector.ariaSectionToRemove}">
            ${sectionOptionsHtml(sections, '')}
          </select>
        </div>
        <p class="rale-registry-hint" style="font-size: 11px; color: var(--text-secondary); margin-top: 8px;">${S.inspector.removeSectionHint}</p>
      </div>
    `
    );
    return;
  }

  if (ui === 'setField') {
    setSafeHTML(
      paramsContainer,
      `
      <div class="rale-registry-params" data-registry-ui="setField">
        <div class="rale-param-input-row">
          <label class="rale-param-label">
            <span class="param-name">sectionName</span>
            <span class="param-type type-string">String</span>
          </label>
          <select class="rale-param-input rale-registry-select" data-param-index="0" data-param-type="string" aria-label="${S.inspector.ariaSection}">
            ${sectionOptionsHtml(sections, firstSection)}
          </select>
        </div>
        <div class="rale-param-input-row">
          <label class="rale-param-label">
            <span class="param-name">key</span>
            <span class="param-type type-string">String</span>
          </label>
          <textarea class="rale-param-input" data-param-index="1" data-param-type="string" rows="1" placeholder="${S.inspector.fieldKeyPlaceholder}"></textarea>
        </div>
        <div class="rale-param-input-row">
          <label class="rale-param-label">
            <span class="param-name">value</span>
            <span class="param-type type-string">String</span>
          </label>
          <textarea class="rale-param-input" data-param-index="2" data-param-type="string" rows="1" placeholder="${S.inspector.stringValuePlaceholder}"></textarea>
        </div>
      </div>
    `
    );
    attachTextareaResize(paramsContainer);
    return;
  }

  if (ui === 'removeField') {
    const keys0 = firstSection ? Object.keys(sections[firstSection] || {}) : [];
    const fk = keys0.sort()[0] || '';
    setSafeHTML(
      paramsContainer,
      `
      <div class="rale-registry-params" data-registry-ui="removeField">
        <div class="rale-param-input-row">
          <label class="rale-param-label">
            <span class="param-name">sectionName</span>
            <span class="param-type type-string">String</span>
          </label>
          <select class="rale-param-input rale-registry-select rale-registry-section" data-param-index="0" data-param-type="string" aria-label="${S.inspector.ariaSection}">
            ${sectionOptionsHtml(sections, firstSection)}
          </select>
        </div>
        <div class="rale-param-input-row">
          <label class="rale-param-label">
            <span class="param-name">key</span>
            <span class="param-type type-string">String</span>
          </label>
          <select class="rale-param-input rale-registry-select rale-registry-key" data-param-index="1" data-param-type="string" aria-label="${S.inspector.ariaKey}">
            ${keyOptionsHtml(firstSection ? sections[firstSection] : {}, fk)}
          </select>
        </div>
      </div>
    `
    );
    wireSectionKeyCascade(paramsContainer, sections);
    return;
  }

  if (ui === 'editField') {
    const keys0 = firstSection ? Object.keys(sections[firstSection] || {}) : [];
    const fk = keys0.sort()[0] || '';
    setSafeHTML(
      paramsContainer,
      `
      <div class="rale-registry-params" data-registry-ui="editField">
        <div class="rale-param-input-row">
          <label class="rale-param-label">
            <span class="param-name">sectionName</span>
            <span class="param-type type-string">String</span>
          </label>
          <select class="rale-param-input rale-registry-select rale-registry-section" data-param-index="0" data-param-type="string" aria-label="${S.inspector.ariaSection}">
            ${sectionOptionsHtml(sections, firstSection)}
          </select>
        </div>
        <div class="rale-param-input-row">
          <label class="rale-param-label">
            <span class="param-name">key</span>
            <span class="param-type type-string">String</span>
          </label>
          <select class="rale-param-input rale-registry-select rale-registry-key" data-param-index="1" data-param-type="string" aria-label="${S.inspector.ariaKeyToReplace}">
            ${keyOptionsHtml(firstSection ? sections[firstSection] : {}, fk)}
          </select>
        </div>
        <div class="rale-param-input-row">
          <label class="rale-param-label">
            <span class="param-name">newKey</span>
            <span class="param-type type-string">String</span>
          </label>
          <textarea class="rale-param-input" data-param-index="2" data-param-type="string" rows="1" placeholder="${S.inspector.newKeyPlaceholder}"></textarea>
        </div>
        <div class="rale-param-input-row">
          <label class="rale-param-label">
            <span class="param-name">newValue</span>
            <span class="param-type type-string">String</span>
          </label>
          <textarea class="rale-param-input" data-param-index="3" data-param-type="string" rows="1" placeholder="${S.inspector.newValuePlaceholder}"></textarea>
        </div>
      </div>
    `
    );
    wireSectionKeyCascade(paramsContainer, sections);
    attachTextareaResize(paramsContainer);
  }
}

function wireSectionKeyCascade(paramsContainer: HTMLElement, sections: RegistrySectionsMap) {
  const secSel = paramsContainer.querySelector('select.rale-registry-section');
  const keySel = paramsContainer.querySelector('select.rale-registry-key');
  if (!(secSel instanceof HTMLSelectElement) || !(keySel instanceof HTMLSelectElement)) return;

  secSel.addEventListener('change', () => {
    const sn = secSel.value;
    const fields = sn ? sections[sn] || {} : {};
    keySel.innerHTML = keyOptionsHtml(fields, '');
  });
}

export function getRegistryBuiltinParamValues(paramsContainer: HTMLElement): unknown[] {
  const els = Array.from(paramsContainer.querySelectorAll('[data-param-index]')).sort(
    (a: Element, b: Element) =>
      Number((a as HTMLElement).dataset.paramIndex) - Number((b as HTMLElement).dataset.paramIndex)
  );
  const values: unknown[] = [];
  els.forEach((el: Element) => {
    const raw = 'value' in el ? String(/** @type {HTMLInputElement} */ (el).value) : '';
    const trimmed = raw.trim();
    if (!trimmed) {
      values.push(null);
      return;
    }
    values.push(trimmed);
  });
  return values;
}

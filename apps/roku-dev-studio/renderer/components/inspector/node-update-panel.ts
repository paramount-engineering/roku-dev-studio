// "Update Node" modal after Get Node by ID — selectNode + setField / removeField (TrackerTask)

import { formatRaleCommandResponse } from './node-lookup.js';
import {
  prepareModalOpenOrigin,
  playModalOpenMotion,
  closeModalWithOriginMotion
} from '../../modules/utils/modal-origin-motion.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { S } from '@shared/strings/index.js';
import type { DevicePanelRoot, DisplayResponseFn, RaleSendCommand } from './inspector-types.js';
import type { NodeUpdateContext } from './inspector-node-update-helpers.js';

export interface NodeUpdatePanelOptions {
  getConnectionId: () => string | null | undefined;
  /**
   * Canonical RALE sender — routes every `selectNode` / `setField` / `removeField`
   * through the shared AppConnector so the "Update Node" modal gets the same
   * auto-reconnect and interceptor plumbing as the rest of the Inspector.
   * See `engineering-principles.md` §2.
   */
  sendCommand: RaleSendCommand;
  displayResponseFn: DisplayResponseFn;
  getLastGetNodeContext: () => NodeUpdateContext | null;
  setLastGetNodeContext: (ctx: NodeUpdateContext | null) => void;
  onModalCloseRefreshGetNodeById?: () => void | Promise<void>;
}

export function parseValueForRaleFieldType(
  type: string,
  raw: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  const t = (type || 'string').toLowerCase();
  if (t === 'string') {
    return { ok: true, value: raw };
  }
  if (t === 'boolean') {
    const s = raw.trim().toLowerCase();
    if (s === 'true' || s === '1') return { ok: true, value: true };
    if (s === 'false' || s === '0') return { ok: true, value: false };
    return { ok: false, error: S.inspector.parseBoolean };
  }
  if (t === 'integer') {
    const n = Number.parseInt(raw.trim(), 10);
    if (Number.isNaN(n)) return { ok: false, error: S.inspector.parseInteger };
    return { ok: true, value: n };
  }
  if (t === 'float') {
    const n = Number.parseFloat(raw.trim());
    if (Number.isNaN(n)) return { ok: false, error: S.inspector.parseFloat };
    return { ok: true, value: n };
  }
  if (t === 'color') {
    const n = Number.parseInt(raw.trim(), 10);
    if (Number.isNaN(n)) return { ok: false, error: S.inspector.parseColor };
    return { ok: true, value: n };
  }
  if (t === 'vector2d' || t === 'rect2d') {
    try {
      const v = JSON.parse(raw.trim());
      if (!Array.isArray(v)) {
        return { ok: false, error: S.inspector.jsonArrayRequired(t) };
      }
      if (t === 'vector2d' && v.length < 2) {
        return { ok: false, error: S.inspector.parseVector2d };
      }
      if (t === 'rect2d' && v.length < 4) {
        return { ok: false, error: S.inspector.parseRect2d };
      }
      return { ok: true, value: v };
    } catch (e) {
      return { ok: false, error: S.inspector.invalidJsonArray(t) };
    }
  }
  if (t === 'array') {
    const s = raw.trim();
    if (s.startsWith('[')) {
      try {
        const v = JSON.parse(s);
        if (Array.isArray(v)) return { ok: true, value: v };
      } catch (e) {
        return { ok: false, error: S.inspector.parseArray };
      }
    }
    return { ok: true, value: s.split(',').map((x: string) => x.trim()) };
  }
  if (t === 'assocarray') {
    try {
      const v = JSON.parse(raw.trim());
      if (v && typeof v === 'object' && !Array.isArray(v)) return { ok: true, value: v };
    } catch (e) {
      return { ok: false, error: S.inspector.parseAssocArray };
    }
    return { ok: false, error: S.inspector.parseAssocArray };
  }
  if (t === 'node') {
    return { ok: true, value: raw.trim() };
  }
  return { ok: true, value: raw };
}

function flattenedValueToTextarea(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function ensureTypeOption(typeSelectEl: HTMLSelectElement, fieldType: string) {
  const t = fieldType || 'string';
  const exists = [...typeSelectEl.options].some((o) => o.value === t);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    typeSelectEl.appendChild(opt);
  }
  typeSelectEl.value = t;
}

function outcomeFromRaleResult(result: unknown): { ok: boolean; message: string } {
  if (!result) {
    return { ok: false, message: `${S.inspector.noResponseFromDevice}.` };
  }
  const r = result as { success?: boolean; data?: unknown; error?: string };
  if (r.success && r.data !== undefined) {
    const data = r.data;
    if (data && typeof data === 'object' && !Array.isArray(data) && (data as Record<string, unknown>).error) {
      const errObj = (data as Record<string, unknown>).error as { message?: unknown };
      const em = errObj?.message;
      if (em != null && String(em).length > 0) {
        return { ok: false, message: String(em) };
      }
    }
    return { ok: true, message: '' };
  }
  return { ok: false, message: String(r.error || S.inspector.commandFailed) };
}

export function setupNodeUpdatePanel(panel: DevicePanelRoot, options: NodeUpdatePanelOptions) {
  const {
    getConnectionId,
    sendCommand,
    displayResponseFn,
    getLastGetNodeContext,
    setLastGetNodeContext,
    onModalCloseRefreshGetNodeById
  } = options;

  const btn = panel.querySelector('.rale-update-node-btn');
  const modal = panel.querySelector('.rale-update-node-modal');
  const closeBtn = modal?.querySelector('.rale-update-node-modal-close');
  const cancelBtn = modal?.querySelector('.rale-update-node-modal-cancel');
  const actionGroup = modal?.querySelector('.rale-node-action-group');
  const actionButtons: HTMLButtonElement[] = actionGroup
    ? [...actionGroup.querySelectorAll('.rale-node-action-btn')].filter(
        (n): n is HTMLButtonElement => n instanceof HTMLButtonElement
      )
    : [];
  const fieldSelect = modal?.querySelector('.rale-node-field-select');
  const fieldAddInput = modal?.querySelector('.rale-node-field-add-name');
  const rowFld = modal?.querySelector('.rale-node-row-field-select');
  const rowAdd = modal?.querySelector('.rale-node-row-add-name');
  const rowType = modal?.querySelector('.rale-node-row-type');
  const rowValue = modal?.querySelector('.rale-node-row-value');
  const valueLabel = modal?.querySelector('.rale-node-row-value-label');
  const typeSelect = modal?.querySelector('.rale-node-field-type');
  const fieldValue = modal?.querySelector('.rale-node-field-value');
  const applyBtn = modal?.querySelector('.rale-node-field-apply');
  const feedbackEl = modal?.querySelector('.rale-node-update-feedback');
  const modalBox = modal?.querySelector('.rale-update-node-modal-box');

  if (
    !(btn instanceof HTMLButtonElement) ||
    !(modal instanceof HTMLElement) ||
    !(actionGroup instanceof HTMLElement) ||
    actionButtons.length < 3 ||
    !(fieldSelect instanceof HTMLSelectElement) ||
    !(fieldAddInput instanceof HTMLInputElement) ||
    !(typeSelect instanceof HTMLSelectElement) ||
    !(fieldValue instanceof HTMLTextAreaElement) ||
    !(applyBtn instanceof HTMLButtonElement) ||
    !(rowFld instanceof HTMLElement) ||
    !(rowAdd instanceof HTMLElement) ||
    !(rowType instanceof HTMLElement) ||
    !(rowValue instanceof HTMLElement)
  ) {
    return {};
  }

  const rootModal = modal;
  const rootBtn = btn;
  const selField = fieldSelect;
  const addNameInput = fieldAddInput;
  const typeSel = typeSelect;
  const valArea = fieldValue;
  const apply = applyBtn;
  const rowFldEl = rowFld;
  const rowAddEl = rowAdd;
  const rowTypeEl = rowType;
  const rowValEl = rowValue;

  function clearModalFeedback() {
    if (!(feedbackEl instanceof HTMLElement)) return;
    feedbackEl.textContent = '';
    feedbackEl.hidden = true;
    feedbackEl.classList.remove(
      'rale-node-update-feedback--visible',
      'rale-node-update-feedback--loading',
      'rale-node-update-feedback--success',
      'rale-node-update-feedback--error'
    );
  }

  /**
   * @param {string} message
   * @param {'loading' | 'success' | 'error'} variant
   */
  function showModalFeedback(message: string, variant: 'loading' | 'success' | 'error') {
    if (!(feedbackEl instanceof HTMLElement)) return;
    feedbackEl.hidden = false;
    feedbackEl.textContent = message;
    feedbackEl.classList.add('rale-node-update-feedback--visible');
    feedbackEl.classList.remove(
      'rale-node-update-feedback--loading',
      'rale-node-update-feedback--success',
      'rale-node-update-feedback--error'
    );
    if (variant === 'loading') feedbackEl.classList.add('rale-node-update-feedback--loading');
    if (variant === 'success') feedbackEl.classList.add('rale-node-update-feedback--success');
    if (variant === 'error') feedbackEl.classList.add('rale-node-update-feedback--error');
  }

  /** @type {'update' | 'add' | 'remove'} */
  let selectedAction = 'update';

  /** Successful setField / removeField calls while this modal session is open (reset on open). */
  let successfulFieldMutationsInModal = 0;

  function getAction() {
    return selectedAction;
  }

  function setAction(v: 'update' | 'add' | 'remove') {
    selectedAction = v;
    actionButtons.forEach((hitBtn) => {
      const on = hitBtn.dataset.action === v;
      hitBtn.classList.toggle('rale-node-action-btn--active', on);
      hitBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /**
   * @param {boolean} runRefresh - If true, may re-fetch getNodeById after close when there were successful field mutations. False for programmatic close (disconnect, clear).
   */
  function applyAfterModalClose(runRefresh: boolean) {
    rootModal.classList.remove('active');
    rootModal.setAttribute('aria-hidden', 'true');
    const shouldRefresh =
      runRefresh && successfulFieldMutationsInModal > 0 && typeof onModalCloseRefreshGetNodeById === 'function';
    if (shouldRefresh) {
      const p = onModalCloseRefreshGetNodeById();
      if (p && typeof p.then === 'function') {
        p.catch(() => {});
      }
    }
    successfulFieldMutationsInModal = 0;
  }

  function closeModal(runRefresh = true) {
    if (!rootModal.classList.contains('active')) {
      applyAfterModalClose(runRefresh);
      return;
    }
    closeModalWithOriginMotion(rootModal, () => applyAfterModalClose(runRefresh));
  }

  function syncActionUi() {
    let action = getAction();
    const keys = [...selField.options].map((o) => o.value).filter(Boolean);
    const hasFields = keys.length > 0;

    actionButtons.forEach((hitBtn) => {
      const a = hitBtn.dataset.action;
      if (a === 'update' || a === 'remove') {
        hitBtn.disabled = !hasFields;
      } else {
        hitBtn.disabled = false;
      }
    });
    if (!hasFields && (action === 'update' || action === 'remove')) {
      setAction('add');
      action = 'add';
    }

    const a = action;
    // Add: field name + type + value only (no existing-field dropdown).
    // Remove: existing field dropdown only.
    // Update: dropdown + locked type + value.
    if (a === 'add') {
      rowFldEl.hidden = true;
      rowAddEl.hidden = false;
      rowTypeEl.hidden = false;
      rowValEl.hidden = false;
      typeSel.disabled = false;
      if (valueLabel) valueLabel.textContent = S.inspector.newValueLabel;
      valArea.placeholder = S.inspector.addValuePlaceholder;
    } else if (a === 'remove') {
      rowFldEl.hidden = false;
      rowAddEl.hidden = true;
      rowTypeEl.hidden = true;
      rowValEl.hidden = true;
    } else {
      rowFldEl.hidden = false;
      rowAddEl.hidden = true;
      rowTypeEl.hidden = false;
      rowValEl.hidden = false;
      typeSel.disabled = true;
      if (valueLabel) valueLabel.textContent = S.inspector.valueLabel;
      valArea.placeholder = S.inspector.updateValuePlaceholder;
    }

    if (a === 'remove') {
      apply.textContent = S.inspector.removeFieldBtn;
    } else if (a === 'add') {
      apply.textContent = S.inspector.addFieldBtn;
    } else {
      apply.textContent = S.inspector.updateFieldBtn;
    }
  }

  function populateFieldSelect(ctx: NodeUpdateContext) {
    selField.innerHTML = '';
    const vals = ctx.fieldlistValues && typeof ctx.fieldlistValues === 'object' ? ctx.fieldlistValues : {};
    const keys = Object.keys(vals).sort();
    for (const k of keys) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      selField.appendChild(opt);
    }
  }

  function applySelectedFieldToTypeAndValue() {
    const ctx = getLastGetNodeContext?.();
    if (!ctx || getAction() !== 'update') return;
    const name = selField.value;
    const meta = ctx.fieldlistMeta && typeof ctx.fieldlistMeta === 'object' ? ctx.fieldlistMeta : {};
    const ent = meta[name];
    const ft = ent && typeof ent.fieldType === 'string' ? ent.fieldType : 'string';
    ensureTypeOption(typeSel, ft);
    const vals = ctx.fieldlistValues && typeof ctx.fieldlistValues === 'object' ? ctx.fieldlistValues : {};
    valArea.value = flattenedValueToTextarea(vals[name]);
  }

  function openModal() {
    const ctx = getLastGetNodeContext?.();
    if (!ctx) return;
    successfulFieldMutationsInModal = 0;
    clearModalFeedback();
    populateFieldSelect(ctx);
    const keys = Object.keys(ctx.fieldlistValues || {}).length;
    setAction(keys ? 'update' : 'add');
    syncActionUi();
    if (getAction() === 'update' && selField.options.length) {
      selField.selectedIndex = 0;
      applySelectedFieldToTypeAndValue();
    } else {
      addNameInput.value = '';
      ensureTypeOption(typeSel, 'string');
      typeSel.disabled = false;
      valArea.value = '';
    }
    prepareModalOpenOrigin(rootModal, rootBtn);
    rootModal.classList.add('active');
    rootModal.setAttribute('aria-hidden', 'false');
    rootModal.classList.add('modal-motion-enabled');
    playModalOpenMotion(rootModal);
    setTimeout(() => {
      const a = getAction();
      if (a === 'add') addNameInput.focus();
      else if (a === 'remove' || a === 'update') selField.focus();
    }, 0);
  }

  function hideUpdateUi() {
    rootBtn.style.display = 'none';
    closeModal(false);
    setLastGetNodeContext?.(null);
  }

  rootBtn.addEventListener('click', () => {
    const ctx = getLastGetNodeContext?.();
    if (!ctx || !Array.isArray(ctx.path)) {
      displayResponseFn(
        { command: 'setField', error: S.inspector.noNodeContext },
        true
      );
      return;
    }
    openModal();
  });

  actionGroup.addEventListener('click', (e: Event) => {
    const t = e.target;
    const hit = t instanceof Element ? t.closest('.rale-node-action-btn') : null;
    if (!hit || !(hit instanceof HTMLButtonElement) || hit.disabled) return;
    const next = hit.dataset.action;
    if (next !== 'update' && next !== 'add' && next !== 'remove') return;
    setAction(next);
    syncActionUi();
    if (getAction() === 'update') applySelectedFieldToTypeAndValue();
    if (getAction() === 'add') {
      addNameInput.value = '';
      ensureTypeOption(typeSel, 'string');
      typeSel.disabled = false;
      valArea.value = '';
    }
  });

  selField.addEventListener('change', () => {
    applySelectedFieldToTypeAndValue();
  });

  closeBtn?.addEventListener('click', () => closeModal());
  cancelBtn?.addEventListener('click', () => closeModal());
  attachBackdropClickToClose(rootModal, closeModal);
  rootModal.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && rootModal.classList.contains('active')) {
      e.stopPropagation();
      closeModal();
    }
  });

  apply.addEventListener('click', async () => {
    clearModalFeedback();

    const ctx = getLastGetNodeContext?.();
    if (!ctx || !Array.isArray(ctx.path)) {
      showModalFeedback(S.inspector.noNodeContext, 'error');
      displayResponseFn(
        { command: 'setField', error: S.inspector.noNodeContext },
        true
      );
      return;
    }

    const action = getAction();
    let fieldName = '';
    if (action === 'add') {
      fieldName = String(addNameInput.value || '').trim();
    } else {
      fieldName = String(selField.value || '').trim();
    }
    if (!fieldName) {
      showModalFeedback(S.inspector.fieldNameRequired, 'error');
      return;
    }

    const connectionId = getConnectionId();
    if (!connectionId) {
      showModalFeedback(`${S.inspector.notConnected}.`, 'error');
      displayResponseFn({ command: 'setField', error: S.inspector.notConnected }, true);
      return;
    }

    apply.disabled = true;
    if (modalBox) modalBox.setAttribute('aria-busy', 'true');

    try {
      showModalFeedback(S.inspector.selectingNode, 'loading');

      const sel = await sendCommand('selectNode', { path: ctx.path });
      if (!sel.success) {
        const rawErr = sel.error;
        const msg =
          typeof rawErr === 'string' && rawErr.length > 0
            ? rawErr
            : rawErr != null
              ? String(rawErr)
              : S.inspector.selectNodeFailed;
        showModalFeedback(msg, 'error');
        displayResponseFn({ command: 'selectNode', error: msg }, true);
        return;
      }
      const selData = sel.data;
      const selRec =
        selData && typeof selData === 'object' && !Array.isArray(selData)
          ? (selData as Record<string, unknown>)
          : null;
      const errObj = selRec?.error;
      const errMsg =
        errObj && typeof errObj === 'object' && !Array.isArray(errObj)
          ? (errObj as Record<string, unknown>).message
          : undefined;
      if (errMsg != null && String(errMsg).length > 0) {
        const msg = String(errMsg);
        showModalFeedback(msg, 'error');
        displayResponseFn({ command: 'selectNode', error: msg, data: selData }, true);
        return;
      }

      if (action === 'remove') {
        showModalFeedback(S.inspector.removingField, 'loading');
        const rm = await sendCommand('removeField', { field: fieldName });
        formatRaleCommandResponse(rm, 'removeField', displayResponseFn);
        const out = outcomeFromRaleResult(rm);
        if (out.ok) {
          successfulFieldMutationsInModal += 1;
          showModalFeedback(S.inspector.removedField(fieldName), 'success');
        } else {
          showModalFeedback(out.message, 'error');
        }
        return;
      }

      const meta = ctx.fieldlistMeta && typeof ctx.fieldlistMeta === 'object' ? ctx.fieldlistMeta : {};
      const ent = meta[fieldName];
      const typeFromNode =
        action === 'update' && ent && typeof ent.fieldType === 'string' ? ent.fieldType : null;
      const type = typeFromNode || String(typeSel.value || 'string');
      const rawVal = String(valArea.value ?? '');
      const parsed = parseValueForRaleFieldType(type, rawVal);
      if (!parsed.ok) {
        showModalFeedback(parsed.error, 'error');
        return;
      }

      showModalFeedback(action === 'add' ? S.inspector.addingField : S.inspector.updatingField, 'loading');

      const setRes = await sendCommand('setField', {
        field: fieldName,
        type,
        value: parsed.value
      });
      formatRaleCommandResponse(setRes, 'setField', displayResponseFn);
      const out = outcomeFromRaleResult(setRes);
      if (out.ok) {
        successfulFieldMutationsInModal += 1;
        showModalFeedback(
          action === 'add' ? S.inspector.addedField(fieldName) : S.inspector.updatedField(fieldName),
          'success'
        );
      } else {
        showModalFeedback(out.message, 'error');
      }
    } finally {
      apply.disabled = false;
      if (modalBox) modalBox.removeAttribute('aria-busy');
    }
  });

  return { hideUpdateUi };
}

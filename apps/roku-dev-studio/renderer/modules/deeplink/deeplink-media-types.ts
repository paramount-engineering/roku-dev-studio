/**
 * Global Deep Link media types: built-in defaults plus user-added entries persisted in app settings.
 */
import { escapeHtml } from '../utils/dom.js';
import { rendererError } from '../utils/logger.js';
import { attachBackdropClickToClose } from '../utils/modal-backdrop-click.js';
import {
  closeModalWithOriginMotion,
  openModalOverlayActiveFromOpener
} from '../utils/modal-origin-motion.js';
import {
  deleteDeeplinkPresetsByIds,
  getPresetsForMediaType,
  type DeeplinkPreset
} from './deeplink-presets.js';

export type MediaTypeEntry = { value: string; label: string };

const SETTINGS_KEY = 'deeplink-custom-media-types';

const DEFAULT_MEDIA_TYPES: MediaTypeEntry[] = [
  { value: 'movie', label: 'Movie' },
  { value: 'series', label: 'Series' },
  { value: 'episode', label: 'Episode' },
  { value: 'live', label: 'Live' }
];

let customTypes: MediaTypeEntry[] = [];
let modalInitialized = false;
let deleteMediaTypeModalInitialized = false;
let editingIndex: number | null = null;
let pendingDeleteMediaTypeResolve: ((confirmed: boolean) => void) | null = null;

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLabel(label: string): string {
  return label.trim();
}

function slugifyLabel(label: string): string {
  return normalizeLabel(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getAllMediaTypes(): MediaTypeEntry[] {
  return [...DEFAULT_MEDIA_TYPES, ...customTypes];
}

function validateEntry(entry: MediaTypeEntry, excludeIndex?: number): string | null {
  const value = normalizeValue(entry.value);
  const label = normalizeLabel(entry.label);
  const labelKey = label.toLowerCase();

  if (!label) return 'Enter a display name.';
  if (!value) return 'Enter an ECP value.';
  if (!/^[a-z][a-z0-9_-]*$/.test(value)) {
    return 'Value must start with a letter and use only letters, numbers, hyphens, or underscores.';
  }

  for (const builtIn of DEFAULT_MEDIA_TYPES) {
    if (normalizeValue(builtIn.value) === value) {
      return `"${builtIn.label}" is already a built-in media type.`;
    }
    if (builtIn.label.toLowerCase() === labelKey) {
      return `"${builtIn.label}" is already a built-in media type.`;
    }
  }

  for (let i = 0; i < customTypes.length; i++) {
    if (excludeIndex !== undefined && i === excludeIndex) continue;
    const existing = customTypes[i];
    if (normalizeValue(existing.value) === value) {
      return 'A media type with this value already exists.';
    }
    if (existing.label.toLowerCase() === labelKey) {
      return 'A media type with this name already exists.';
    }
  }

  return null;
}

async function persistCustomTypes(): Promise<void> {
  if (!window.roku?.setSetting) return;
  try {
    await window.roku.setSetting(SETTINGS_KEY, customTypes);
  } catch (e) {
    rendererError('[Deep Link] Failed to save custom media types:', e);
  }
}

export function populateMediaTypeSelect(select: HTMLSelectElement): void {
  const prev = select.value;
  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- Select --';
  select.appendChild(placeholder);

  for (const entry of getAllMediaTypes()) {
    const opt = document.createElement('option');
    opt.value = entry.value;
    opt.textContent = entry.label;
    select.appendChild(opt);
  }

  if (prev && Array.from(select.options).some((o) => o.value === prev)) {
    select.value = prev;
  }
}

function refreshAllMediaTypeSelects(): void {
  document.querySelectorAll<HTMLSelectElement>('.deeplink-media-type').forEach((select) => {
    populateMediaTypeSelect(select);
  });
}

async function removeCustomMediaTypeAtIndex(index: number): Promise<void> {
  if (!Number.isFinite(index) || !customTypes[index]) return;
  const removedValue = customTypes[index].value;
  customTypes.splice(index, 1);
  await persistCustomTypes();
  document.querySelectorAll<HTMLSelectElement>('.deeplink-media-type').forEach((select) => {
    if (select.value === removedValue) select.value = '';
  });
  refreshAllMediaTypeSelects();
  if (editingIndex === index) editingIndex = null;
  else if (editingIndex !== null && editingIndex > index) editingIndex -= 1;
  setModalError('');
  renderCustomEntriesList();
}

function closeDeleteMediaTypeModal(modal: HTMLElement): void {
  if (!modal.classList.contains('active')) return;
  closeModalWithOriginMotion(modal, () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    if (pendingDeleteMediaTypeResolve) {
      pendingDeleteMediaTypeResolve(false);
      pendingDeleteMediaTypeResolve = null;
    }
  });
}

function setupDeleteMediaTypeModalOnce(): void {
  const modal = document.getElementById('deeplinkDeleteMediaTypeModal');
  if (!(modal instanceof HTMLElement) || deleteMediaTypeModalInitialized) return;
  deleteMediaTypeModalInitialized = true;

  const cancelBtn = document.getElementById('deeplinkDeleteMediaTypeCancel');
  const confirmBtn = document.getElementById('deeplinkDeleteMediaTypeConfirm');
  const closeBtn = modal.querySelector('.deeplink-delete-media-type-modal-close');

  closeBtn?.addEventListener('click', () => closeDeleteMediaTypeModal(modal));
  cancelBtn?.addEventListener('click', () => closeDeleteMediaTypeModal(modal));
  attachBackdropClickToClose(modal, () => closeDeleteMediaTypeModal(modal));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeDeleteMediaTypeModal(modal);
    }
  });

  confirmBtn?.addEventListener('click', () => {
    const resolve = pendingDeleteMediaTypeResolve;
    pendingDeleteMediaTypeResolve = null;
    closeModalWithOriginMotion(modal, () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      resolve?.(true);
    });
  });
}

function promptDeleteMediaTypeWithPresets(
  entry: MediaTypeEntry,
  linkedPresets: DeeplinkPreset[],
  opener?: HTMLElement | null
): Promise<boolean> {
  const modal = document.getElementById('deeplinkDeleteMediaTypeModal');
  const lead = document.getElementById('deeplinkDeleteMediaTypeLead');
  const list = document.getElementById('deeplinkDeleteMediaTypePresetList');
  if (!(modal instanceof HTMLElement) || !lead || !list) {
    return Promise.resolve(false);
  }

  setupDeleteMediaTypeModalOnce();
  if (pendingDeleteMediaTypeResolve) {
    pendingDeleteMediaTypeResolve(false);
    pendingDeleteMediaTypeResolve = null;
  }

  const count = linkedPresets.length;
  lead.textContent =
    count === 1
      ? `"${entry.label}" is used by 1 saved deep link and cannot be removed until you decide what to do with it.`
      : `"${entry.label}" is used by ${count} saved deep links and cannot be removed until you decide what to do with them.`;
  list.innerHTML = linkedPresets
    .map((preset) => `<li>${escapeHtml(preset.name)}</li>`)
    .join('');

  return new Promise((resolve) => {
    pendingDeleteMediaTypeResolve = resolve;
    openModalOverlayActiveFromOpener(modal, opener ?? null, () => {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      if (opener) setTimeout(() => opener.blur(), 0);
    });
  });
}

async function tryDeleteCustomMediaType(index: number, opener?: HTMLElement | null): Promise<void> {
  if (!Number.isFinite(index) || !customTypes[index]) return;
  const entry = customTypes[index];
  const linkedPresets = getPresetsForMediaType(entry.value);

  if (linkedPresets.length > 0) {
    const confirmed = await promptDeleteMediaTypeWithPresets(entry, linkedPresets, opener);
    if (!confirmed) return;
    await deleteDeeplinkPresetsByIds(linkedPresets.map((p) => p.id));
  }

  await removeCustomMediaTypeAtIndex(index);
}

function setModalError(message: string): void {
  const el = document.getElementById('deeplinkMediaTypesError');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.textContent = '';
    el.hidden = true;
  }
}

function customEntryRowHtml(entry: MediaTypeEntry, index: number): string {
  const label = escapeHtml(entry.label);
  const value = escapeHtml(entry.value);
  return `<div class="deeplink-media-type-entry" data-custom-index="${index}">
    <div class="deeplink-media-type-entry-main">
      <span class="deeplink-media-type-entry-label">${label}</span>
      <span class="deeplink-media-type-entry-value">${value}</span>
    </div>
    <div class="deeplink-media-type-entry-actions">
      <button type="button" class="btn btn-secondary btn-icon deeplink-media-type-edit-btn" data-custom-edit="${index}" title="Edit" aria-label="Edit ${label}">
        <span class="icon icon-xs"><svg><use href="#icon-edit-3"/></svg></span>
      </button>
      <button type="button" class="btn btn-danger btn-icon deeplink-media-type-delete-btn" data-custom-delete="${index}" title="Delete" aria-label="Delete ${label}">
        <span class="icon icon-xs"><svg><use href="#icon-trash"/></svg></span>
      </button>
    </div>
  </div>`;
}

function editEntryRowHtml(entry: MediaTypeEntry, index: number): string {
  const label = escapeHtml(entry.label);
  const value = escapeHtml(entry.value);
  return `<div class="deeplink-media-type-entry deeplink-media-type-entry--editing" data-custom-index="${index}">
    <div class="deeplink-media-type-edit-fields">
      <label class="deeplink-media-type-edit-field">
        <span class="deeplink-media-type-edit-label">Display name</span>
        <input type="text" class="deeplink-media-type-edit-label-input" value="${label}" maxlength="64" />
      </label>
      <label class="deeplink-media-type-edit-field">
        <span class="deeplink-media-type-edit-label">ECP value</span>
        <input type="text" class="deeplink-media-type-edit-value-input" value="${value}" maxlength="64" />
      </label>
    </div>
    <div class="deeplink-media-type-entry-actions">
      <button type="button" class="btn btn-primary btn-sm deeplink-media-type-save-edit-btn" data-custom-save="${index}">Save</button>
      <button type="button" class="btn btn-secondary btn-sm deeplink-media-type-cancel-edit-btn" data-custom-cancel="${index}">Cancel</button>
    </div>
  </div>`;
}

function renderCustomEntriesList(): void {
  const list = document.getElementById('deeplinkMediaTypesCustomList');
  if (!list) return;

  if (customTypes.length === 0) {
    list.innerHTML = '<p class="deeplink-media-types-empty">No custom media types yet.</p>';
    return;
  }

  list.innerHTML = customTypes
    .map((entry, index) =>
      editingIndex === index ? editEntryRowHtml(entry, index) : customEntryRowHtml(entry, index)
    )
    .join('');
}

function resetAddForm(): void {
  const labelInput = document.getElementById('deeplinkMediaTypeLabel') as HTMLInputElement | null;
  const valueInput = document.getElementById('deeplinkMediaTypeValue') as HTMLInputElement | null;
  if (labelInput) labelInput.value = '';
  if (valueInput) valueInput.value = '';
}

function closeDeeplinkMediaTypesModal(modal: HTMLElement): void {
  if (!modal.classList.contains('active')) return;
  closeModalWithOriginMotion(modal, () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    editingIndex = null;
    setModalError('');
    resetAddForm();
  });
}

export function openDeeplinkMediaTypesModal(opener?: HTMLElement | null): void {
  const modal = document.getElementById('deeplinkMediaTypesModal');
  if (!(modal instanceof HTMLElement)) return;

  editingIndex = null;
  setModalError('');
  resetAddForm();
  renderCustomEntriesList();

  openModalOverlayActiveFromOpener(modal, opener ?? null, () => {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    const labelInput = document.getElementById('deeplinkMediaTypeLabel') as HTMLInputElement | null;
    labelInput?.focus();
    if (opener) setTimeout(() => opener.blur(), 0);
  });
}

function setupModalOnce(): void {
  const modal = document.getElementById('deeplinkMediaTypesModal');
  if (!(modal instanceof HTMLElement) || modalInitialized) return;
  modalInitialized = true;

  const closeBtn = modal.querySelector('.deeplink-media-types-modal-close');
  closeBtn?.addEventListener('click', () => closeDeeplinkMediaTypesModal(modal));
  attachBackdropClickToClose(modal, () => closeDeeplinkMediaTypesModal(modal));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeDeeplinkMediaTypesModal(modal);
    }
  });

  const labelInput = document.getElementById('deeplinkMediaTypeLabel') as HTMLInputElement | null;
  const valueInput = document.getElementById('deeplinkMediaTypeValue') as HTMLInputElement | null;
  const addBtn = document.getElementById('deeplinkMediaTypeAddBtn');

  labelInput?.addEventListener('input', () => {
    if (!valueInput || !labelInput) return;
    if (valueInput.dataset.userEdited === '1') return;
    valueInput.value = slugifyLabel(labelInput.value);
  });

  valueInput?.addEventListener('input', () => {
    if (!valueInput) return;
    valueInput.dataset.userEdited = valueInput.value.trim() ? '1' : '';
  });

  addBtn?.addEventListener('click', async () => {
    const label = labelInput?.value ?? '';
    const value = valueInput?.value ?? '';
    const entry = { label: normalizeLabel(label), value: normalizeValue(value) };
    const err = validateEntry(entry);
    if (err) {
      setModalError(err);
      return;
    }

    customTypes.push(entry);
    await persistCustomTypes();
    refreshAllMediaTypeSelects();
    setModalError('');
    resetAddForm();
    if (valueInput) valueInput.dataset.userEdited = '';
    renderCustomEntriesList();
    labelInput?.focus();
  });

  const customList = document.getElementById('deeplinkMediaTypesCustomList');
  customList?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const editBtn = target.closest('[data-custom-edit]') as HTMLElement | null;
    const deleteBtn = target.closest('[data-custom-delete]') as HTMLElement | null;
    const saveBtn = target.closest('[data-custom-save]') as HTMLElement | null;
    const cancelBtn = target.closest('[data-custom-cancel]') as HTMLElement | null;

    if (editBtn) {
      const index = parseInt(editBtn.dataset.customEdit || '', 10);
      if (!Number.isFinite(index) || !customTypes[index]) return;
      editingIndex = index;
      setModalError('');
      renderCustomEntriesList();
      return;
    }

    if (cancelBtn) {
      editingIndex = null;
      setModalError('');
      renderCustomEntriesList();
      return;
    }

    if (saveBtn) {
      const index = parseInt(saveBtn.dataset.customSave || '', 10);
      const row = saveBtn.closest('.deeplink-media-type-entry');
      if (!row || !Number.isFinite(index) || !customTypes[index]) return;

      const labelEl = row.querySelector('.deeplink-media-type-edit-label-input') as HTMLInputElement | null;
      const valueEl = row.querySelector('.deeplink-media-type-edit-value-input') as HTMLInputElement | null;
      const oldValue = customTypes[index].value;
      const entry = {
        label: normalizeLabel(labelEl?.value ?? ''),
        value: normalizeValue(valueEl?.value ?? '')
      };
      const err = validateEntry(entry, index);
      if (err) {
        setModalError(err);
        return;
      }

      customTypes[index] = entry;
      await persistCustomTypes();
      if (oldValue !== entry.value) {
        document.querySelectorAll<HTMLSelectElement>('.deeplink-media-type').forEach((select) => {
          if (select.value === oldValue) select.value = entry.value;
        });
      }
      refreshAllMediaTypeSelects();
      editingIndex = null;
      setModalError('');
      renderCustomEntriesList();
      return;
    }

    if (deleteBtn) {
      const index = parseInt(deleteBtn.dataset.customDelete || '', 10);
      if (!Number.isFinite(index) || !customTypes[index]) return;
      await tryDeleteCustomMediaType(index, deleteBtn);
    }
  });

  [labelInput, valueInput].forEach((input) => {
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addBtn?.click();
    });
  });
}

export function wireDeepLinkMediaTypeManageBtn(btn: HTMLButtonElement): void {
  btn.addEventListener('click', (e) => {
    const opener = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
    openDeeplinkMediaTypesModal(opener);
  });
}

export async function initDeeplinkMediaTypes(): Promise<void> {
  if (window.roku?.getSetting) {
    try {
      const res = await window.roku.getSetting(SETTINGS_KEY);
      if (res?.success && Array.isArray(res.value)) {
        customTypes = res.value
          .filter(
            (item): item is MediaTypeEntry =>
              !!item &&
              typeof item === 'object' &&
              typeof (item as MediaTypeEntry).value === 'string' &&
              typeof (item as MediaTypeEntry).label === 'string'
          )
          .map((item) => ({
            value: normalizeValue(item.value),
            label: normalizeLabel(item.label)
          }))
          .filter((item) => item.value && item.label);
      }
    } catch (e) {
      rendererError('[Deep Link] Failed to load custom media types:', e);
    }
  }

  setupModalOnce();
  refreshAllMediaTypeSelects();
}

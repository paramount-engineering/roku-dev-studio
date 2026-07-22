/**
 * Global saved Deep Link presets (App ID, Content ID, Media Type) persisted in app settings.
 */
import { rendererError } from '../utils/logger.js';
import { attachBackdropClickToClose } from '../utils/modal-backdrop-click.js';
import {
  closeModalWithOriginMotion,
  openModalOverlayActiveFromOpener
} from '../utils/modal-origin-motion.js';
import { S } from '@shared/strings/index.js';

export type DeeplinkPreset = {
  id: string;
  name: string;
  appId: string;
  contentId: string;
  mediaType: string;
};

const SETTINGS_KEY = 'deeplink-saved-presets';

let savedPresets: DeeplinkPreset[] = [];
let saveModalInitialized = false;
let pendingSaveResolve: ((name: string | null) => void) | null = null;

function presetKey(preset: Pick<DeeplinkPreset, 'appId' | 'contentId' | 'mediaType'>): string {
  return `${preset.appId.trim()}|${preset.contentId.trim()}|${preset.mediaType.trim()}`;
}

function generatePresetId(): string {
  const bytes = new Uint8Array(6);
  window.crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes)
    .map((b) => (b % 36).toString(36))
    .join('');
  return `dl-${Date.now()}-${suffix}`;
}

export function suggestPresetName(
  appId: string,
  contentId: string,
  mediaType: string
): string {
  const parts = [appId.trim()];
  if (contentId.trim()) parts.push(contentId.trim());
  if (mediaType.trim()) parts.push(`(${mediaType.trim()})`);
  return parts.join(' · ');
}

function normalizePreset(raw: unknown): DeeplinkPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as DeeplinkPreset;
  const appId = typeof item.appId === 'string' ? item.appId.trim() : '';
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!appId || !name) return null;
  return {
    id: typeof item.id === 'string' && item.id ? item.id : generatePresetId(),
    name,
    appId,
    contentId: typeof item.contentId === 'string' ? item.contentId.trim() : '',
    mediaType: typeof item.mediaType === 'string' ? item.mediaType.trim() : ''
  };
}

async function persistPresets(): Promise<void> {
  if (!window.roku?.setSetting) return;
  try {
    await window.roku.setSetting(SETTINGS_KEY, savedPresets);
  } catch (e) {
    rendererError('[Deep Link] Failed to save presets:', e);
  }
}

export function getSavedDeeplinkPresets(): readonly DeeplinkPreset[] {
  return savedPresets;
}

export function getPresetsForMediaType(mediaTypeValue: string): DeeplinkPreset[] {
  const key = mediaTypeValue.trim().toLowerCase();
  if (!key) return [];
  return savedPresets.filter((p) => p.mediaType.trim().toLowerCase() === key);
}

function clearPanelsReferencingPresetIds(removedIds: Set<string>): void {
  document.querySelectorAll<HTMLSelectElement>('.deeplink-saved-select').forEach((select) => {
    if (removedIds.has(select.value)) select.value = '';
  });
  document.querySelectorAll<HTMLButtonElement>('.deeplink-saved-delete-btn').forEach((btn) => {
    btn.disabled = true;
  });
}

export async function deleteDeeplinkPresetsByIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const idSet = new Set(ids);
  const before = savedPresets.length;
  savedPresets = savedPresets.filter((p) => !idSet.has(p.id));
  const removed = before - savedPresets.length;
  if (removed > 0) {
    await persistPresets();
    clearPanelsReferencingPresetIds(idSet);
    refreshSavedPresetDropdowns();
  }
  return removed;
}

export async function deleteDeeplinkPresetById(id: string): Promise<boolean> {
  const index = savedPresets.findIndex((p) => p.id === id);
  if (index === -1) return false;
  savedPresets.splice(index, 1);
  await persistPresets();
  clearPanelsReferencingPresetIds(new Set([id]));
  refreshSavedPresetDropdowns();
  return true;
}

export function syncSavedPresetDeleteButton(panel: HTMLElement): void {
  const savedSelect = panel.querySelector('.deeplink-saved-select') as HTMLSelectElement | null;
  const deleteBtn = panel.querySelector('.deeplink-saved-delete-btn') as HTMLButtonElement | null;
  if (!savedSelect || !deleteBtn) return;
  deleteBtn.disabled = !savedSelect.value;
}

export function populateSavedPresetSelect(select: HTMLSelectElement): void {
  const prev = select.value;
  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = S.deeplink.savedPresetPlaceholder;
  select.appendChild(placeholder);

  for (const preset of savedPresets) {
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = preset.name;
    select.appendChild(opt);
  }

  if (prev && savedPresets.some((p) => p.id === prev)) {
    select.value = prev;
  }
}

export function refreshSavedPresetDropdowns(): void {
  const hasSaved = savedPresets.length > 0;
  document.querySelectorAll<HTMLElement>('.deeplink-saved-row').forEach((row) => {
    row.hidden = !hasSaved;
  });
  document.querySelectorAll<HTMLSelectElement>('.deeplink-saved-select').forEach((select) => {
    populateSavedPresetSelect(select);
    const panel = select.closest('.tab-panel');
    if (panel instanceof HTMLElement) syncSavedPresetDeleteButton(panel);
  });
}

export function applyPresetToPanel(
  panel: HTMLElement,
  preset: DeeplinkPreset,
  opts?: { updateSavedSelect?: boolean }
): void {
  const appIdInput = panel.querySelector('.deeplink-app-id') as HTMLInputElement | null;
  const contentIdInput = panel.querySelector('.deeplink-content-id') as HTMLInputElement | null;
  const mediaTypeSelect = panel.querySelector('.deeplink-media-type') as HTMLSelectElement | null;
  const savedSelect = panel.querySelector('.deeplink-saved-select') as HTMLSelectElement | null;

  if (appIdInput) appIdInput.value = preset.appId;
  if (contentIdInput) contentIdInput.value = preset.contentId;
  if (mediaTypeSelect) {
    const hasOption = Array.from(mediaTypeSelect.options).some((o) => o.value === preset.mediaType);
    mediaTypeSelect.value = hasOption ? preset.mediaType : '';
  }
  if (opts?.updateSavedSelect !== false && savedSelect) {
    savedSelect.value = preset.id;
  }
  syncSavedPresetDeleteButton(panel);
}

function findPresetById(id: string): DeeplinkPreset | undefined {
  return savedPresets.find((p) => p.id === id);
}

export async function saveDeeplinkPreset(
  fields: Pick<DeeplinkPreset, 'appId' | 'contentId' | 'mediaType'>,
  name: string
): Promise<DeeplinkPreset> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error(S.deeplink.enterPresetName);
  if (!fields.appId.trim()) throw new Error(S.deeplink.appIdRequired);

  const normalized = {
    appId: fields.appId.trim(),
    contentId: fields.contentId.trim(),
    mediaType: fields.mediaType.trim()
  };
  const key = presetKey(normalized);
  const existing = savedPresets.find((p) => presetKey(p) === key);

  let preset: DeeplinkPreset;
  if (existing) {
    existing.name = trimmedName;
    preset = existing;
  } else {
    preset = {
      id: generatePresetId(),
      name: trimmedName,
      ...normalized
    };
    savedPresets.push(preset);
  }

  savedPresets.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  await persistPresets();
  refreshSavedPresetDropdowns();
  return preset;
}

function setSaveModalError(message: string): void {
  const el = document.getElementById('deeplinkSavePresetError');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.textContent = '';
    el.hidden = true;
  }
}

function closeSavePresetModal(modal: HTMLElement): void {
  if (!modal.classList.contains('active')) return;
  closeModalWithOriginMotion(modal, () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    setSaveModalError('');
    if (pendingSaveResolve) {
      pendingSaveResolve(null);
      pendingSaveResolve = null;
    }
  });
}

function setupSaveModalOnce(): void {
  const modal = document.getElementById('deeplinkSavePresetModal');
  if (!(modal instanceof HTMLElement) || saveModalInitialized) return;
  saveModalInitialized = true;

  const nameInput = document.getElementById('deeplinkSavePresetName') as HTMLInputElement | null;
  const cancelBtn = document.getElementById('deeplinkSavePresetCancel');
  const confirmBtn = document.getElementById('deeplinkSavePresetConfirm');
  const closeBtn = modal.querySelector('.deeplink-save-preset-modal-close');

  closeBtn?.addEventListener('click', () => closeSavePresetModal(modal));
  cancelBtn?.addEventListener('click', () => closeSavePresetModal(modal));
  attachBackdropClickToClose(modal, () => closeSavePresetModal(modal));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeSavePresetModal(modal);
    }
  });

  confirmBtn?.addEventListener('click', () => {
    const name = nameInput?.value ?? '';
    if (!name.trim()) {
      setSaveModalError(S.deeplink.enterPresetName);
      nameInput?.focus();
      return;
    }
    setSaveModalError('');
    const resolve = pendingSaveResolve;
    pendingSaveResolve = null;
    closeModalWithOriginMotion(modal, () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      resolve?.(name.trim());
    });
  });

  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmBtn?.click();
  });
}

export function promptSavePresetName(
  suggestion: string,
  opener?: HTMLElement | null
): Promise<string | null> {
  const modal = document.getElementById('deeplinkSavePresetModal');
  const nameInput = document.getElementById('deeplinkSavePresetName') as HTMLInputElement | null;
  if (!(modal instanceof HTMLElement) || !nameInput) {
    return Promise.resolve(suggestion.trim() || null);
  }

  setupSaveModalOnce();
  if (pendingSaveResolve) {
    pendingSaveResolve(null);
    pendingSaveResolve = null;
  }

  return new Promise((resolve) => {
    pendingSaveResolve = resolve;
    nameInput.value = suggestion;
    setSaveModalError('');

    openModalOverlayActiveFromOpener(modal, opener ?? null, () => {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      nameInput.focus();
      nameInput.select();
      if (opener) setTimeout(() => opener.blur(), 0);
    });
  });
}

export function wireSavedPresetSelect(select: HTMLSelectElement, panel: HTMLElement): void {
  select.addEventListener('change', () => {
    const id = select.value;
    if (!id) return;
    const preset = findPresetById(id);
    if (!preset) return;
    applyPresetToPanel(panel, preset, { updateSavedSelect: true });
  });
}

export function clearSavedPresetSelection(panel: HTMLElement): void {
  const savedSelect = panel.querySelector('.deeplink-saved-select') as HTMLSelectElement | null;
  if (savedSelect && savedSelect.value) savedSelect.value = '';
}

export async function initDeeplinkPresets(): Promise<void> {
  if (window.roku?.getSetting) {
    try {
      const res = await window.roku.getSetting(SETTINGS_KEY);
      if (res?.success && Array.isArray(res.value)) {
        savedPresets = res.value
          .map(normalizePreset)
          .filter((item): item is DeeplinkPreset => item !== null);
        savedPresets.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      }
    } catch (e) {
      rendererError('[Deep Link] Failed to load saved presets:', e);
    }
  }

  setupSaveModalOnce();
  refreshSavedPresetDropdowns();
}

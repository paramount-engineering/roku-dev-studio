/**
 * Per-device Deep Link panel: launch, save-and-launch split control, and saved preset picker.
 */
import { showStatusMessage } from '../utils/ui.js';
import { rendererError } from '../utils/logger.js';
import { populateMediaTypeSelect, wireDeepLinkMediaTypeManageBtn } from './deeplink-media-types.js';
import {
  applyPresetToPanel,
  clearSavedPresetSelection,
  deleteDeeplinkPresetById,
  populateSavedPresetSelect,
  promptSavePresetName,
  refreshSavedPresetDropdowns,
  saveDeeplinkPreset,
  suggestPresetName,
  syncSavedPresetDeleteButton,
  wireSavedPresetSelect
} from './deeplink-presets.js';
import { S } from '@shared/strings/index.js';

type DeeplinkApi = {
  deeplink: (
    appId: string,
    contentId: string,
    mediaType?: string
  ) => Promise<{ success?: boolean; error?: string; statusCode?: number }>;
};

function formatDeepLinkError(
  result: { error?: string; statusCode?: number },
  appId: string
): string {
  if (result.statusCode === 404) {
    if (appId.trim().toLowerCase() === 'dev') {
      return S.deeplink.devAppNotSideloaded;
    }
    return S.deeplink.channelNotFound(appId);
  }
  if (result.statusCode === 401 || result.statusCode === 403) {
    return result.error || S.deeplink.ecpAccessDenied;
  }
  return result.error || S.deeplink.deepLinkFailed;
}

function readDeepLinkFields(panel: HTMLElement): {
  appIdInput: HTMLInputElement;
  contentIdInput: HTMLInputElement;
  mediaTypeSelect: HTMLSelectElement;
  appId: string;
  contentId: string;
  mediaType: string;
} | null {
  const appIdInput = panel.querySelector('.deeplink-app-id') as HTMLInputElement | null;
  const contentIdInput = panel.querySelector('.deeplink-content-id') as HTMLInputElement | null;
  const mediaTypeSelect = panel.querySelector('.deeplink-media-type') as HTMLSelectElement | null;
  if (!appIdInput || !contentIdInput || !mediaTypeSelect) return null;
  return {
    appIdInput,
    contentIdInput,
    mediaTypeSelect,
    appId: appIdInput.value.trim(),
    contentId: contentIdInput.value.trim(),
    mediaType: mediaTypeSelect.value
  };
}

async function launchDeepLink(
  panel: HTMLElement,
  api: DeeplinkApi,
  statusDiv: HTMLElement
): Promise<boolean> {
  const fields = readDeepLinkFields(panel);
  if (!fields) return false;

  if (!fields.appId) {
    showStatusMessage(statusDiv, S.deeplink.enterAppId, 'warning');
    return false;
  }

  const result = await api.deeplink(fields.appId, fields.contentId, fields.mediaType);

  if (result.success) {
    showStatusMessage(statusDiv, S.deeplink.launchedSuccess, 'success');
    return true;
  }

  showStatusMessage(statusDiv, S.deeplink.deepLinkFailedDetail(formatDeepLinkError(result, fields.appId)), 'error');
  return false;
}

function ensureLaunchMenuDismissBound(): void {
  if (document.body.dataset.deeplinkLaunchMenuDismissBound === '1') return;
  document.body.dataset.deeplinkLaunchMenuDismissBound = '1';

  document.addEventListener('click', (e) => {
    document.querySelectorAll<HTMLElement>('.deeplink-launch-dropdown:not([hidden])').forEach((dropdown) => {
      const menu = dropdown.closest('.deeplink-launch-split');
      if (!menu) return;
      if (e.target instanceof Node && menu.contains(e.target)) return;
      dropdown.hidden = true;
      const caret = menu.querySelector('.deeplink-launch-caret') as HTMLButtonElement | null;
      caret?.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll<HTMLElement>('.deeplink-launch-dropdown:not([hidden])').forEach((dropdown) => {
        dropdown.hidden = true;
        const caret = dropdown
          .closest('.deeplink-launch-split')
          ?.querySelector('.deeplink-launch-caret') as HTMLButtonElement | null;
        caret?.setAttribute('aria-expanded', 'false');
      });
    }
  });
}

function wireLaunchSplitMenu(panel: HTMLElement, api: DeeplinkApi, statusDiv: HTMLElement): void {
  const launchBtn = panel.querySelector('.deeplink-launch-main') as HTMLButtonElement | null;
  const caretBtn = panel.querySelector('.deeplink-launch-caret') as HTMLButtonElement | null;
  const dropdown = panel.querySelector('.deeplink-launch-dropdown') as HTMLElement | null;
  const saveLaunchItem = panel.querySelector('[data-deeplink-save-launch]') as HTMLButtonElement | null;

  if (!launchBtn || !caretBtn || !dropdown || !saveLaunchItem) return;

  ensureLaunchMenuDismissBound();

  const closeDropdown = (): void => {
    dropdown.hidden = true;
    caretBtn.setAttribute('aria-expanded', 'false');
  };

  const toggleDropdown = (): void => {
    const willOpen = dropdown.hidden;
    dropdown.hidden = !willOpen;
    caretBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  };

  launchBtn.addEventListener('click', async () => {
    closeDropdown();
    await launchDeepLink(panel, api, statusDiv);
  });

  caretBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  caretBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown();
  });

  saveLaunchItem.addEventListener('click', async () => {
    closeDropdown();
    const fields = readDeepLinkFields(panel);
    if (!fields) return;

    if (!fields.appId) {
      showStatusMessage(statusDiv, S.deeplink.enterAppId, 'warning');
      return;
    }

    const suggestion = suggestPresetName(fields.appId, fields.contentId, fields.mediaType);
    const name = await promptSavePresetName(suggestion, saveLaunchItem);
    if (!name) return;

    try {
      const preset = await saveDeeplinkPreset(
        {
          appId: fields.appId,
          contentId: fields.contentId,
          mediaType: fields.mediaType
        },
        name
      );
      applyPresetToPanel(panel, preset);
      const launched = await launchDeepLink(panel, api, statusDiv);
      if (launched) {
        showStatusMessage(statusDiv, S.deeplink.savedAndLaunched, 'success');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : S.deeplink.failedToSave;
      showStatusMessage(statusDiv, message, 'error');
    }
  });
}

function wireFieldChangeClearsSavedSelect(panel: HTMLElement): void {
  const appIdInput = panel.querySelector('.deeplink-app-id');
  const contentIdInput = panel.querySelector('.deeplink-content-id');
  const mediaTypeSelect = panel.querySelector('.deeplink-media-type');

  const onEdit = (): void => {
    clearSavedPresetSelection(panel);
    syncSavedPresetDeleteButton(panel);
  };
  appIdInput?.addEventListener('input', onEdit);
  contentIdInput?.addEventListener('input', onEdit);
  mediaTypeSelect?.addEventListener('change', onEdit);
}

function wireSavedPresetDelete(panel: HTMLElement, statusDiv: HTMLElement): void {
  const savedSelect = panel.querySelector('.deeplink-saved-select') as HTMLSelectElement | null;
  const deleteBtn = panel.querySelector('.deeplink-saved-delete-btn') as HTMLButtonElement | null;
  if (!savedSelect || !deleteBtn) return;

  const syncDeleteEnabled = (): void => {
    syncSavedPresetDeleteButton(panel);
  };

  savedSelect.addEventListener('change', syncDeleteEnabled);
  syncDeleteEnabled();

  deleteBtn.addEventListener('click', async () => {
    const id = savedSelect.value;
    if (!id) return;

    const removed = await deleteDeeplinkPresetById(id);
    if (!removed) {
      showStatusMessage(statusDiv, S.deeplink.savedNotFound, 'warning');
      syncDeleteEnabled();
      return;
    }

    clearSavedPresetSelection(panel);
    const appIdInput = panel.querySelector('.deeplink-app-id') as HTMLInputElement | null;
    const contentIdInput = panel.querySelector('.deeplink-content-id') as HTMLInputElement | null;
    const mediaTypeSelect = panel.querySelector('.deeplink-media-type') as HTMLSelectElement | null;
    if (appIdInput) appIdInput.value = '';
    if (contentIdInput) contentIdInput.value = '';
    if (mediaTypeSelect) mediaTypeSelect.value = '';
    showStatusMessage(statusDiv, S.deeplink.savedDeleted, 'success');
    syncDeleteEnabled();
  });
}

export function setupDeepLinkPanel(panel: HTMLElement, api: DeeplinkApi): void {
  const statusDiv = panel.querySelector('.deeplink-status') as HTMLElement | null;
  const mediaTypeSelect = panel.querySelector('.deeplink-media-type') as HTMLSelectElement | null;
  const savedSelect = panel.querySelector('.deeplink-saved-select') as HTMLSelectElement | null;
  const savedRow = panel.querySelector('.deeplink-saved-row') as HTMLElement | null;

  if (!statusDiv || !mediaTypeSelect) {
    rendererError('Deep link elements not found');
    return;
  }

  populateMediaTypeSelect(mediaTypeSelect);

  const manageBtn = panel.querySelector('.deeplink-media-type-manage-btn');
  if (manageBtn instanceof HTMLButtonElement) {
    wireDeepLinkMediaTypeManageBtn(manageBtn);
  }

  if (savedSelect) {
    populateSavedPresetSelect(savedSelect);
    wireSavedPresetSelect(savedSelect, panel);
    wireSavedPresetDelete(panel, statusDiv);
  }
  if (savedRow) {
    savedRow.hidden = savedSelect ? savedSelect.options.length <= 1 : true;
  }

  wireLaunchSplitMenu(panel, api, statusDiv);
  wireFieldChangeClearsSavedSelect(panel);
}

export function refreshDeepLinkSavedRows(): void {
  refreshSavedPresetDropdowns();
}

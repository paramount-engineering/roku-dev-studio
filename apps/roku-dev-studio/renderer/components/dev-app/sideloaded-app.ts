// Sideloaded app display and management

import { icon, escapeHtml, setSafeHTML } from '../../modules/utils/index.js';
import { SCREENSHOT_AFTER_LAUNCH_DELAY } from '../../modules/utils/constants.js';
import type {
  DevAppApi,
  DevicePanelRoot,
  InnertabSwitchDetail,
  SideloadedAppElements
} from './dev-app-types.js';
import { pollDevAppForegroundAfterHome, pollDevAppForegroundAfterLaunch, pollDevAppForegroundOnce } from './dev-app-foreground-sync.js';
import { rendererError } from '../../modules/utils/logger.js';
import { S } from '@shared/strings/index.js';
import {
  loadAppsAndInputs,
  onAppsAndInputsResolved,
  type AppsAndInputsResult,
  type AppsAndInputsFailure
} from './apps-and-inputs.js';

/**
 * Setup sideloaded app display
 * @param {HTMLElement} panel - Device panel
 * @param {Object} api - API adapter
 * @param {Object} elements - UI elements
 * @param {Function} [scheduleAutoScreenshot] - (delayMs?) => void; Launch uses a longer delay than keypress
 * @param {Function} [setDevAppAllowsCapture] - (allowed: boolean) => void; gates Screenshot Capture until dev is foreground
 */
export function setupSideloadedApp(
  panel: DevicePanelRoot,
  api: DevAppApi,
  elements: SideloadedAppElements,
  scheduleAutoScreenshot?: (delayMs?: number) => void,
  setDevAppAllowsCapture?: (allowed: boolean) => void
) {
  const {
    sideloadedAppCard,
    sideloadedAppDetails,
    refreshSideloadedBtn,
    deleteBtn,
    launchSideloadBtn
  } = elements;
  
  function renderNoChannel(): void {
    sideloadedAppCard.style.display = 'block';
    setSafeHTML(sideloadedAppDetails, `<div class="sideloaded-none">${S.devApp.noChannelSideloaded}</div>`);
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (launchSideloadBtn) launchSideloadBtn.style.display = 'none';
    if (setDevAppAllowsCapture) setDevAppAllowsCapture(false);
    panel.dispatchEvent(new CustomEvent('dev-app-sideload-state', { detail: { installed: false } }));
  }

  function renderInstalled(appName: string, version: string): void {
    sideloadedAppCard.style.display = 'block';
    setSafeHTML(sideloadedAppDetails, `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="sideloaded-app-icon-wrapper loading" style="width:80px;height:45px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;overflow:hidden;">
          <img class="sideloaded-app-icon" style="width:100%;height:100%;object-fit:cover;display:none;">
          <span class="sideloaded-icon-placeholder">${icon('tv', 'icon-lg', 'icon-muted')}</span>
        </div>
        <div>
          <div class="sideloaded-app-name">${escapeHtml(appName)}</div>
          <div class="sideloaded-app-meta">
            <span>${S.devApp.versionLabel} ${escapeHtml(version)}</span>
          </div>
        </div>
      </div>
    `);

    // Load icon
    const iconImg = sideloadedAppDetails.querySelector('.sideloaded-app-icon');
    const iconPlaceholder = sideloadedAppDetails.querySelector('.sideloaded-icon-placeholder');
    const iconWrapper = sideloadedAppDetails.querySelector('.sideloaded-app-icon-wrapper');

    if (
      iconImg instanceof HTMLImageElement &&
      iconPlaceholder instanceof HTMLElement &&
      iconWrapper instanceof HTMLElement
    ) {
      api.getIcon('dev').then((result: { success?: boolean; dataUrl?: string }) => {
        if (result.success && result.dataUrl) {
          iconImg.src = result.dataUrl;
          iconImg.style.display = 'block';
          iconPlaceholder.style.display = 'none';
          iconWrapper.classList.remove('loading');
        } else {
          iconWrapper.classList.remove('loading');
        }
      }).catch(() => {
        iconWrapper.classList.remove('loading');
      });
    }

    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    checkIfDevAppActive();
    panel.dispatchEvent(new CustomEvent('dev-app-sideload-state', { detail: { installed: true } }));
  }

  // Single render path for every source — the initial/refresh checks below, or a notification that
  // some OTHER tab (Apps, Remote) triggered a reload of the shared apps+inputs fetch.
  function applyAppsAndInputsResult(result: AppsAndInputsResult | AppsAndInputsFailure): void {
    const devApp = result.success ? result.apps.find((a) => a.id === 'dev') : undefined;
    if (devApp) {
      renderInstalled(devApp.name, devApp.version || S.devApp.unknown);
    } else {
      renderNoChannel();
    }
  }

  // Every result reaches this card through this subscription — whether this card, the Apps tab
  // or the Remote tab triggered the fetch — so one fetch renders once. (Applying the awaited value
  // in `checkSideloadedApp` as well rendered every check twice: two icon fetches, two
  // active-app polls, two sideload-state events.)
  onAppsAndInputsResolved(api, applyAppsAndInputsResult);

  // Check sideloaded app. Joins the Apps tab's `/query/apps` fetch (or triggers it, whichever
  // runs first) via the shared `loadAppsAndInputs` in-flight join instead of firing an independent
  // ECP call — see that function's doc comment for why (both used to race the same device on every
  // connect). `loadAppsAndInputs` reports fetch failures as a result (rendered above as
  // "no channel"); the catch is for a throwing subscriber.
  async function checkSideloadedApp() {
    try {
      await loadAppsAndInputs(api);
    } catch (e) {
      rendererError('Failed to check sideloaded app:', e);
      renderNoChannel();
    }
  }
  
  /**
   * Apply foreground dev-app state when we know a dev channel is sideloaded.
   * Skips when UI shows "no channel" so we do not resurrect Launch incorrectly.
   */
  function applyDevAppForegroundFromActiveQuery(isDevActive: boolean) {
    if (sideloadedAppDetails.querySelector('.sideloaded-none')) return;
    if (getComputedStyle(sideloadedAppCard).display === 'none') return;
    if (launchSideloadBtn) {
      launchSideloadBtn.style.display = isDevActive ? 'none' : 'inline-flex';
    }
    if (setDevAppAllowsCapture) setDevAppAllowsCapture(isDevActive);
  }

  async function checkIfDevAppActive() {
    await pollDevAppForegroundOnce(panel, api);
  }
  
  // Initial check
  checkSideloadedApp();
  
  // Listen for tab switch — re-checks so switching back to this tab catches a sideload/uninstall
  // that happened elsewhere (relay, CLI) while it was in the background.
  panel.addEventListener('innertabswitch', (e: Event) => {
    const ce = e as CustomEvent<InnertabSwitchDetail>;
    if (ce.detail.tab === 'devapp') {
      checkSideloadedApp();
    }
  });
  
  // Listen for Home button press to check if dev app exited. A single immediate query races the
  // device's own state transition — usually wins against a physical device's near-instant LAN
  // ECP response, but an RCE device's extra ports-bridge/HTTPS hop loses that race often enough to
  // leave Launch (Dev App tab and Floating Remote alike) stuck hidden until some unrelated refresh
  // — so this polls a few times instead of checking once (see pollDevAppForegroundAfterHome).
  panel.addEventListener('homePressed', () => {
    void pollDevAppForegroundAfterHome(panel, api);
  });

  /** Periodic device active check: refresh Launch + screenshot gate from /query/active-app */
  panel.addEventListener('dev-app-active-polled', (e: Event) => {
    const ce = e as CustomEvent<{ active: boolean }>;
    if (!ce.detail || typeof ce.detail.active !== 'boolean') return;
    applyDevAppForegroundFromActiveQuery(ce.detail.active);
  });
  
  if (refreshSideloadedBtn) {
    refreshSideloadedBtn.addEventListener('click', () => checkSideloadedApp());
  }
  
  if (launchSideloadBtn) {
    launchSideloadBtn.addEventListener('click', async () => {
      launchSideloadBtn.disabled = true;
      setSafeHTML(launchSideloadBtn, icon('rocket', 'icon-xs') + ' ' + S.devApp.launching);
      try {
        await api.launch('dev');
        const foreground = await pollDevAppForegroundAfterLaunch(panel, api);
        if (foreground && scheduleAutoScreenshot) {
          scheduleAutoScreenshot(SCREENSHOT_AFTER_LAUNCH_DELAY);
        }
      } catch (e) {
        rendererError('Failed to launch dev app:', e);
      }
      launchSideloadBtn.disabled = false;
      setSafeHTML(launchSideloadBtn, icon('rocket', 'icon-xs') + ' ' + S.devApp.launch);
    });
  }
  
  return {
    checkSideloadedApp,
    checkIfDevAppActive
  };
}

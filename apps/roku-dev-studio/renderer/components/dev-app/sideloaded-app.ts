// Sideloaded app display and management

import { icon, escapeHtml, decodeHtmlEntities, setSafeHTML } from '../../modules/utils/index.js';
import { SCREENSHOT_AFTER_LAUNCH_DELAY } from '../../modules/utils/constants.js';
import type {
  DevAppApi,
  DevicePanelRoot,
  InnertabSwitchDetail,
  SideloadedAppElements
} from './dev-app-types.js';
import { pollDevAppForegroundAfterLaunch, pollDevAppForegroundOnce } from './dev-app-foreground-sync.js';
import { rendererError } from '../../modules/utils/logger.js';

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
  
  // Check sideloaded app
  async function checkSideloadedApp() {
    try {
      const result = await api.query('/query/apps');
      
      if (result.success && result.data) {
        const devAppMatch = result.data.match(/<app id="dev"[^>]*>([^<]*)<\/app>/);
        
        if (devAppMatch) {
          const appName = decodeHtmlEntities(devAppMatch[1]);
          const versionMatch = result.data.match(/<app id="dev"[^>]*version="([^"]*)"[^>]*>/);
          const version = versionMatch ? versionMatch[1] : 'Unknown';
          
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
                  <span>Version: ${escapeHtml(version)}</span>
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
          panel.dispatchEvent(
            new CustomEvent('dev-app-sideload-state', { detail: { installed: true } })
          );
        } else {
          sideloadedAppCard.style.display = 'block';
          setSafeHTML(sideloadedAppDetails, '<div class="sideloaded-none">No channel currently sideloaded</div>');
          if (deleteBtn) deleteBtn.style.display = 'none';
          if (launchSideloadBtn) launchSideloadBtn.style.display = 'none';
          if (setDevAppAllowsCapture) setDevAppAllowsCapture(false);
          panel.dispatchEvent(
            new CustomEvent('dev-app-sideload-state', { detail: { installed: false } })
          );
        }
      } else {
        // `/query/apps` itself failed — reset the card too, so we don't show a
        // stale "installed" state while other listeners have been told installed=false.
        sideloadedAppCard.style.display = 'block';
        setSafeHTML(sideloadedAppDetails, '<div class="sideloaded-none">No channel currently sideloaded</div>');
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (launchSideloadBtn) launchSideloadBtn.style.display = 'none';
        if (setDevAppAllowsCapture) setDevAppAllowsCapture(false);
        panel.dispatchEvent(
          new CustomEvent('dev-app-sideload-state', { detail: { installed: false } })
        );
      }
    } catch (e) {
      rendererError('Failed to check sideloaded app:', e);
      sideloadedAppCard.style.display = 'block';
      setSafeHTML(sideloadedAppDetails, '<div class="sideloaded-none">No channel currently sideloaded</div>');
      if (deleteBtn) deleteBtn.style.display = 'none';
      if (launchSideloadBtn) launchSideloadBtn.style.display = 'none';
      if (setDevAppAllowsCapture) setDevAppAllowsCapture(false);
      panel.dispatchEvent(
        new CustomEvent('dev-app-sideload-state', { detail: { installed: false } })
      );
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
  
  // Listen for tab switch
  panel.addEventListener('innertabswitch', (e: Event) => {
    const ce = e as CustomEvent<InnertabSwitchDetail>;
    if (ce.detail.tab === 'devapp') {
      checkSideloadedApp();
    }
  });
  
  // Listen for Home button press to check if dev app exited
  panel.addEventListener('homePressed', () => {
    checkIfDevAppActive();
  });

  /** Periodic device active check: refresh Launch + screenshot gate from /query/active-app */
  panel.addEventListener('dev-app-active-polled', (e: Event) => {
    const ce = e as CustomEvent<{ active: boolean }>;
    if (!ce.detail || typeof ce.detail.active !== 'boolean') return;
    applyDevAppForegroundFromActiveQuery(ce.detail.active);
  });
  
  if (refreshSideloadedBtn) {
    refreshSideloadedBtn.addEventListener('click', checkSideloadedApp);
  }
  
  if (launchSideloadBtn) {
    launchSideloadBtn.addEventListener('click', async () => {
      launchSideloadBtn.disabled = true;
      setSafeHTML(launchSideloadBtn, icon('rocket', 'icon-xs') + ' Launching');
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
      setSafeHTML(launchSideloadBtn, icon('rocket', 'icon-xs') + ' Launch');
    });
  }
  
  return {
    checkSideloadedApp,
    checkIfDevAppActive
  };
}

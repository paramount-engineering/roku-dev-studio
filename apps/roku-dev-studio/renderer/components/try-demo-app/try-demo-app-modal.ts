/**
 * "Try Demo App" picker — opened from the titlebar button. Shows a short
 * explainer of what the bundled "Roku Dev Studio Showcase" channel
 * demonstrates, a device `<select>`, and a launch action that sideloads it.
 * UI-only + transient (built on open, removed on close), modeled on
 * `apply-to-device-modal.ts` — but the device list is already known
 * in-process (this modal lives in the main window, not a separate one), so
 * `rescan` is synchronous rather than an async IPC round-trip.
 */
import { escapeHtml, setSafeHTML } from '../../modules/utils/index.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { showToast } from '../../modules/utils/ui.js';
import { S } from '@shared/strings/index.js';

export interface TryDemoAppDeviceOption {
  id: string;
  label: string;
  ip: string;
  isRemote: boolean;
  serverUrl?: string | null;
  password?: string;
}

export function openTryDemoAppModal(opts: {
  initialDevices: TryDemoAppDeviceOption[];
  rescan: () => TryDemoAppDeviceOption[];
  onLaunched?: (device: TryDemoAppDeviceOption) => void;
}): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active try-demo-app-overlay';
  setSafeHTML(
    overlay,
    `<div class="modal try-demo-app-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(S.tryDemoApp.modalTitle)}">
       <div class="modal-header">
         <h2>${escapeHtml(S.tryDemoApp.modalTitle)}</h2>
         <button type="button" class="modal-close try-demo-app-close" title="${escapeHtml(S.common.close)}" aria-label="${escapeHtml(S.common.close)}">&times;</button>
       </div>
       <div class="modal-body">
         <p class="try-demo-app-explainer">${escapeHtml(S.tryDemoApp.explainer)}</p>
         <div class="try-demo-app-tips">
           <p class="try-demo-app-tips-heading">${escapeHtml(S.tryDemoApp.postLaunchHeading)}</p>
           <ul class="try-demo-app-tips-list">${S.tryDemoApp.postLaunchTips.map((tip) => `<li>${tip}</li>`).join('')}</ul>
         </div>
         <div class="try-demo-app-row">
           <label class="try-demo-app-select-label" for="tryDemoAppDeviceSelect">${escapeHtml(S.tryDemoApp.deviceSelectLabel)}</label>
           <select class="try-demo-app-select" id="tryDemoAppDeviceSelect"></select>
           <button type="button" class="btn btn-secondary try-demo-app-rescan">${escapeHtml(S.actionScripts.viewerRescan)}</button>
         </div>
         <p class="try-demo-app-error" hidden></p>
       </div>
       <div class="modal-footer try-demo-app-footer">
         <button type="button" class="btn btn-secondary try-demo-app-cancel">${escapeHtml(S.common.cancel)}</button>
         <button type="button" class="btn btn-primary try-demo-app-launch" disabled>${escapeHtml(S.tryDemoApp.launchBtn)}</button>
       </div>
     </div>`
  );

  const select = overlay.querySelector('.try-demo-app-select') as HTMLSelectElement;
  const rescanBtn = overlay.querySelector('.try-demo-app-rescan') as HTMLButtonElement;
  const launchBtn = overlay.querySelector('.try-demo-app-launch') as HTMLButtonElement;
  const errorEl = overlay.querySelector('.try-demo-app-error') as HTMLElement;

  let devices: TryDemoAppDeviceOption[] = [];

  const settle = (): void => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') settle();
  };

  function showError(message: string): void {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError(): void {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  function render(next: TryDemoAppDeviceOption[]): void {
    devices = next;
    clearError();
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = devices.length ? S.tryDemoApp.deviceSelectPlaceholder : S.tryDemoApp.noDevicesText;
    select.appendChild(placeholder);
    for (const d of devices) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.label;
      select.appendChild(opt);
    }
    select.value = '';
    select.disabled = devices.length === 0;
    launchBtn.disabled = true;
  }

  render(opts.initialDevices);

  select.addEventListener('change', () => {
    launchBtn.disabled = !select.value;
  });

  rescanBtn.addEventListener('click', () => {
    render(opts.rescan());
  });

  launchBtn.addEventListener('click', async () => {
    const device = devices.find((d) => d.id === select.value);
    if (!device) return;
    clearError();
    const prevLabel = launchBtn.textContent;
    launchBtn.disabled = true;
    select.disabled = true;
    rescanBtn.disabled = true;
    launchBtn.textContent = S.tryDemoApp.launchBtnBusy;
    try {
      const result = await window.roku.launchDemoApp({
        ip: device.ip,
        isRemote: device.isRemote,
        serverUrl: device.serverUrl,
        password: device.password || ''
      });
      if (result && result.success) {
        settle();
        showToast(S.tryDemoApp.toastSuccess, 'success');
        opts.onLaunched?.(device);
      } else {
        const message = (result && result.error) || S.tryDemoApp.errSideloadFailed;
        showError(message);
        showToast(S.tryDemoApp.toastFailure(message), 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(message);
      showToast(S.tryDemoApp.toastFailure(message), 'error');
    } finally {
      if (overlay.isConnected) {
        launchBtn.disabled = !select.value;
        select.disabled = false;
        rescanBtn.disabled = false;
        launchBtn.textContent = prevLabel;
      }
    }
  });

  overlay.querySelector('.try-demo-app-close')?.addEventListener('click', settle);
  overlay.querySelector('.try-demo-app-cancel')?.addEventListener('click', settle);
  attachBackdropClickToClose(overlay, settle);
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
}

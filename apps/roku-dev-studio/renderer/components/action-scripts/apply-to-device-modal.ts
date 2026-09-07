/**
 * "Apply to Device" picker — opened in the MAIN window when the "View and Manage Action Scripts"
 * window asks to apply a script to a device. Lists discovered devices (labels pre-built, incl.
 * privacy masking, by the caller), offers a Rescan, and on Apply hands the chosen device id back.
 * UI-only + transient (built on open, removed on close); the caller owns device resolution.
 */
import { escapeHtml, setSafeHTML } from '../../modules/utils/index.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { S } from '@shared/strings/index.js';

export type ApplyDeviceOption = { id: string; label: string };

export function openApplyToDeviceModal(opts: {
  initialDevices: ApplyDeviceOption[];
  rescan: () => Promise<ApplyDeviceOption[]>;
  onApply: (id: string) => void;
}): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active apply-to-device-overlay';
  setSafeHTML(
    overlay,
    `<div class="modal apply-to-device-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(S.actionScripts.viewerApplyToDevice)}">
       <div class="modal-header">
         <h2>${escapeHtml(S.actionScripts.viewerApplyToDevice)}</h2>
         <button type="button" class="modal-close apply-to-device-close" title="${escapeHtml(S.common.close)}" aria-label="${escapeHtml(S.common.close)}"><span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span></button>
       </div>
       <div class="modal-body">
         <div class="apply-to-device-row">
           <select class="apply-to-device-select"></select>
           <button type="button" class="btn btn-secondary apply-to-device-rescan">${escapeHtml(S.actionScripts.viewerRescan)}</button>
         </div>
       </div>
       <div class="modal-footer apply-to-device-footer">
         <button type="button" class="btn btn-primary apply-to-device-apply" disabled>${escapeHtml(S.actionScripts.viewerApply)}</button>
       </div>
     </div>`
  );

  const select = overlay.querySelector('.apply-to-device-select') as HTMLSelectElement;
  const rescanBtn = overlay.querySelector('.apply-to-device-rescan') as HTMLButtonElement;
  const applyBtn = overlay.querySelector('.apply-to-device-apply') as HTMLButtonElement;

  const settle = (): void => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') settle();
  };

  function render(devices: ApplyDeviceOption[]): void {
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = devices.length ? S.fiddle.selectDevice : S.actionScripts.viewerNoDevices;
    select.appendChild(placeholder);
    for (const d of devices) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.label;
      select.appendChild(opt);
    }
    select.value = '';
    select.disabled = devices.length === 0;
    applyBtn.disabled = true;
  }

  render(opts.initialDevices);

  select.addEventListener('change', () => {
    applyBtn.disabled = !select.value;
  });

  rescanBtn.addEventListener('click', async () => {
    const prev = rescanBtn.textContent;
    rescanBtn.disabled = true;
    rescanBtn.textContent = S.common.loading;
    try {
      render(await opts.rescan());
    } finally {
      rescanBtn.disabled = false;
      rescanBtn.textContent = prev;
    }
  });

  applyBtn.addEventListener('click', () => {
    const id = select.value;
    if (!id) return;
    settle();
    opts.onApply(id);
  });

  overlay.querySelector('.apply-to-device-close')?.addEventListener('click', settle);
  attachBackdropClickToClose(overlay, settle);
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
}

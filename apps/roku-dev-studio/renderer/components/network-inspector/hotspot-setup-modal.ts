/**
 * Hotspot Capture Setup modal for the Network Inspector screen. Opened from the header setup
 * badge. Renders the exact same per-platform guide as Settings → Network Inspector (shared source
 * in `roku-dev-studio-network-inspector/setup-guide`), plus the in-app one-click "Setup Packet
 * Capture" action on macOS/Linux.
 */
import {
  networkInspectorSetupTitle,
  networkInspectorSetupGuideBodyHtml,
  networkInspectorHasCaptureSetupAction,
  type NiSetupPlatform,
  type NiSetupGuideStrings
} from '@shared/network-inspector/setup-guide.js';
import { escapeHtml } from '../../modules/utils/dom.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { S } from '@shared/strings/index.js';

export type SetupCaptureResult = { success?: boolean; error?: string };

export function openHotspotCaptureSetupModal(opts: {
  platform: NiSetupPlatform;
  /** Optional one-click capture-access grant (macOS BPF / Linux setcap). Omitted on Windows. */
  onRunSetup?: () => Promise<SetupCaptureResult>;
}): void {
  // Undefined for a locale that hasn't translated the guide yet; the builders fall back to English.
  const guide: NiSetupGuideStrings | undefined = S.settings.niSetupGuide;
  const title = networkInspectorSetupTitle(opts.platform, guide && guide.titlePrefix);
  const body = networkInspectorSetupGuideBodyHtml(opts.platform, guide);
  const hasAction = networkInspectorHasCaptureSetupAction(opts.platform) && typeof opts.onRunSetup === 'function';

  const overlay = document.createElement('div');
  // `.modal-overlay` is display:none until `.active` is added.
  overlay.className = 'modal-overlay ni-setup-overlay active';
  overlay.innerHTML = `
    <div class="ni-setup-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="ni-setup-modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button type="button" class="modal-close ni-setup-modal-close" title="${S.common.close}" aria-label="${S.common.close}"><span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span></button>
      </div>
      <div class="ni-setup-modal-body ni-setup-guide">
${body}
${hasAction
      ? `        <div class="ni-setup-actions">
          <button type="button" class="btn btn-primary btn-sm" data-ni-setup-run>${S.networkInspector.setupPacketCapture}</button>
          <span class="ni-setup-status" data-ni-setup-status aria-live="polite"></span>
        </div>`
      : ''}
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  attachBackdropClickToClose(overlay, close);
  overlay.querySelector('.ni-setup-modal-close')?.addEventListener('click', close);

  if (hasAction && opts.onRunSetup) {
    const runBtn = overlay.querySelector('[data-ni-setup-run]') as HTMLButtonElement | null;
    const statusEl = overlay.querySelector('[data-ni-setup-status]') as HTMLElement | null;
    runBtn?.addEventListener('click', async () => {
      runBtn.disabled = true;
      if (statusEl) {
        statusEl.textContent = S.networkInspector.requestingCaptureAccess;
        statusEl.classList.remove('is-error');
      }
      try {
        const res = await opts.onRunSetup!();
        if (res?.success) {
          if (statusEl) statusEl.textContent = S.networkInspector.captureAccessGranted;
          window.setTimeout(close, 1000);
          return;
        }
        const cancelled = res?.error === 'cancelled' || !res?.error;
        if (statusEl) {
          statusEl.textContent = cancelled ? S.networkInspector.setupCancelled : (res?.error || S.networkInspector.setupFailed);
          statusEl.classList.toggle('is-error', !cancelled);
        }
        runBtn.disabled = false;
      } catch {
        if (statusEl) {
          statusEl.textContent = S.networkInspector.setupFailedRetry;
          statusEl.classList.add('is-error');
        }
        runBtn.disabled = false;
      }
    });
  }
}

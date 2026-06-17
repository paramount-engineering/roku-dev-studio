/**
 * MITM proxy port-conflict modal for the Network Inspector. Shown when Roku Dev Studio can't bind
 * its configured proxy port because another app/process holds it. Names the offending process and
 * recommends either closing it or changing the proxy port in Settings → Network Inspector (the only
 * place the port is editable — opened via the modal's button).
 *
 * Implemented as a process-wide singleton: each device panel has its own Network tab instance, but
 * the proxy (and therefore the conflict) is global, so only one modal is ever shown. Re-opening with
 * the same conflict is a no-op while it's already showing.
 */
import { escapeHtml } from '../../modules/utils/dom.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';

export type PortConflictInfo = {
  port: number;
  pid?: number;
  processName?: string;
  command?: string;
  title: string;
  message: string;
  remediation: string[];
};

let currentOverlay: HTMLElement | null = null;
let currentKey = '';
let dismissedKey = '';
let onKeyHandler: ((e: KeyboardEvent) => void) | null = null;

function conflictKey(c: PortConflictInfo): string {
  return `${c.port}|${c.pid ?? ''}|${c.processName ?? ''}`;
}

/** Human label for the process holding the port. */
function holderLabel(c: PortConflictInfo): string {
  if (c.processName && c.pid) return `${escapeHtml(c.processName)} (PID ${c.pid})`;
  if (c.processName) return escapeHtml(c.processName);
  if (c.pid) return `PID ${c.pid}`;
  return 'Another app';
}

/** Inner HTML for the modal body, re-rendered in place on refresh (footer/header stay wired). */
function bodyHtml(c: PortConflictInfo): string {
  const steps = Array.isArray(c.remediation) ? c.remediation : [];
  const portStr = String(c.port);
  // Render the port number in the message as an inline code block (escape first, then wrap).
  const messageHtml = escapeHtml(c.message).replace(
    `port ${portStr}`,
    `port <code class="ni-port-modal-inline">${portStr}</code>`
  );
  return `
    <p class="ni-port-modal-msg">${messageHtml}</p>
    <div class="ni-port-modal-holder">
      <span class="ni-port-modal-holder-name">${holderLabel(c)}</span>
      ${c.command ? `<code class="ni-port-modal-holder-cmd">${escapeHtml(c.command)}</code>` : ''}
    </div>
    ${steps.length > 0 ? `<ul class="ni-port-modal-steps">${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}
  `;
}

function closeInternal(): void {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }
  if (onKeyHandler) {
    document.removeEventListener('keydown', onKeyHandler);
    onKeyHandler = null;
  }
  currentKey = '';
}

/** Close the modal if it's open (e.g. the conflict cleared or the user left the Network tab). */
export function hidePortConflictModal(): void {
  closeInternal();
}

/**
 * Show (or refresh) the port-conflict modal for `conflict`. No-ops when the same conflict is already
 * showing, or was dismissed (unless `force`, used when the user clicks the header badge).
 */
export function showPortConflictModal(conflict: PortConflictInfo, opts?: { force?: boolean }): void {
  const key = conflictKey(conflict);
  if (!opts?.force && dismissedKey === key) return;
  if (currentOverlay && currentKey === key) return;
  closeInternal();
  currentKey = key;
  // A forced reopen of a previously dismissed conflict clears the dismissal.
  if (opts?.force && dismissedKey === key) dismissedKey = '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay ni-port-modal-overlay active';
  overlay.innerHTML = `
    <div class="ni-port-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(conflict.title)}">
      <div class="ni-port-modal-header">
        <span class="ni-port-modal-icon" aria-hidden="true"><span class="icon icon-sm"><svg><use href="#icon-warning"/></svg></span></span>
        <h3>${escapeHtml(conflict.title)}</h3>
        <button type="button" class="ni-port-modal-close" title="Close" aria-label="Close">×</button>
      </div>
      <div class="ni-port-modal-body" data-ni-port-modal-body>${bodyHtml(conflict)}</div>
      <div class="ni-port-modal-footer">
        <button type="button" class="btn btn-secondary btn-sm ni-port-modal-refresh" data-ni-port-modal-refresh title="Re-check status" aria-label="Re-check status">
          <span class="icon icon-sm"><svg><use href="#icon-refresh"/></svg></span>
          <span>Refresh</span>
        </button>
        <button type="button" class="btn btn-primary btn-sm" data-ni-port-modal-settings>Open Network Inspector Settings</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  currentOverlay = overlay;

  const dismiss = (): void => {
    dismissedKey = key;
    closeInternal();
  };
  onKeyHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') dismiss();
  };
  document.addEventListener('keydown', onKeyHandler);
  attachBackdropClickToClose(overlay, dismiss);
  overlay.querySelector('.ni-port-modal-close')?.addEventListener('click', dismiss);

  // Port changes happen in Settings → Network Inspector only; this button takes the user there.
  overlay.querySelector('[data-ni-port-modal-settings]')?.addEventListener('click', () => {
    window.roku?.openSettings?.('network-inspector');
    dismiss();
  });

  // Manual "check now" — re-fetch live status (faster than the ~4s background poll). Updates the
  // details in place if still conflicting, or closes the modal once the port is free.
  const refreshBtn = overlay.querySelector('[data-ni-port-modal-refresh]') as HTMLButtonElement | null;
  const bodyEl = overlay.querySelector('[data-ni-port-modal-body]') as HTMLElement | null;
  refreshBtn?.addEventListener('click', () => {
    void (async () => {
      const api = window.roku;
      if (!api?.networkInspectorGetStatus) return;
      refreshBtn.disabled = true;
      refreshBtn.classList.add('is-checking');
      try {
        const res = await api.networkInspectorGetStatus();
        const next = (res && res.status && res.status.mitmPortConflict) || null;
        if (!next) {
          // Port is free now — clear the dismissal so a future conflict re-opens, then close.
          dismissedKey = '';
          closeInternal();
          return;
        }
        currentKey = conflictKey(next as PortConflictInfo);
        if (bodyEl) bodyEl.innerHTML = bodyHtml(next as PortConflictInfo);
      } catch {
        /* ignore — the background poll will reconcile */
      } finally {
        if (currentOverlay === overlay) {
          refreshBtn.disabled = false;
          refreshBtn.classList.remove('is-checking');
        }
      }
    })();
  });
}

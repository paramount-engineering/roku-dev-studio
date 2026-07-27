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
import { S } from '@shared/strings/index.js';

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
let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
/** What Escape / the backdrop / the × button do RIGHT NOW. In the conflict state this also remembers
 *  the dismissal (so the same conflict doesn't immediately reopen); once the modal has morphed into
 *  the "port freed" confirmation it's just a plain close. Swapped by {@link showResolvedState}. */
let closeAction: () => void = () => closeInternal();

/** How long the "port is free again" confirmation lingers before closing itself. */
const AUTO_DISMISS_MS = 4500;

function clearAutoDismiss(): void {
  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }
}

function conflictKey(c: PortConflictInfo): string {
  return `${c.port}|${c.pid ?? ''}|${c.processName ?? ''}`;
}

/** Human label for the process holding the port. */
function holderLabel(c: PortConflictInfo): string {
  if (c.processName && c.pid) return S.networkInspector.holderWithPid(escapeHtml(c.processName), c.pid);
  if (c.processName) return escapeHtml(c.processName);
  if (c.pid) return S.networkInspector.holderPidOnly(c.pid);
  return S.networkInspector.holderAnotherApp;
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
  clearAutoDismiss();
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

/** Immediately close the modal if it's open, no confirmation — used when the user leaves the Network
 *  tab or the panel tears down (a lingering auto-dismissing toast makes no sense once they've left). */
export function hidePortConflictModal(): void {
  closeInternal();
}

/**
 * Morph the OPEN conflict modal into a brief "the port is free again" confirmation that auto-dismisses
 * after {@link AUTO_DISMISS_MS} (the user can close it sooner). No-op unless a CONFLICT is currently
 * shown (`currentKey` set): if the modal was never opened, the user already closed it, or it's already
 * showing the confirmation, there's nothing to confirm — so this won't reopen anything or keep
 * re-arming the timer as the background status poll keeps reporting "no conflict".
 */
export function resolvePortConflictModal(): void {
  if (!currentOverlay || !currentKey) return;
  showResolvedState();
}

/** Swap the modal's icon/title/body to the success state, drop the footer, and arm the auto-dismiss. */
function showResolvedState(): void {
  const overlay = currentOverlay;
  if (!overlay) return;
  clearAutoDismiss();
  // The conflict is gone: forget any remembered dismissal and stop treating this as an active conflict,
  // so a later poll reporting "free" won't re-enter here, and a genuinely NEW conflict reopens cleanly.
  dismissedKey = '';
  currentKey = '';
  // A manual close from here is just a close — it must NOT re-arm dismissal for the (now stale) key.
  closeAction = () => closeInternal();

  const icon = overlay.querySelector('.ni-port-modal-icon');
  const title = overlay.querySelector('.ni-port-modal-header h3');
  const body = overlay.querySelector('[data-ni-port-modal-body]');
  const footer = overlay.querySelector('.ni-port-modal-footer');
  overlay.querySelector('.ni-port-modal')?.classList.add('is-resolved');
  if (icon) {
    icon.classList.add('is-resolved');
    icon.innerHTML = '<span class="icon icon-sm"><svg><use href="#icon-check"/></svg></span>';
  }
  if (title) title.textContent = S.networkInspector.portResolvedTitle;
  if (body) {
    body.innerHTML =
      `<p class="ni-port-modal-msg ni-port-modal-msg-ok">${S.networkInspector.portResolvedMsg}</p>`;
  }
  footer?.remove();

  autoDismissTimer = setTimeout(() => closeInternal(), AUTO_DISMISS_MS);
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
        <button type="button" class="modal-close ni-port-modal-close" title="${S.common.close}" aria-label="${S.common.close}"><span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span></button>
      </div>
      <div class="ni-port-modal-body" data-ni-port-modal-body>${bodyHtml(conflict)}</div>
      <div class="ni-port-modal-footer">
        <button type="button" class="btn btn-secondary btn-sm ni-port-modal-refresh" data-ni-port-modal-refresh title="${S.networkInspector.recheckStatus}" aria-label="${S.networkInspector.recheckStatus}">
          <span class="icon icon-sm"><svg><use href="#icon-refresh"/></svg></span>
          <span>${S.common.refresh}</span>
        </button>
        <button type="button" class="btn btn-primary btn-sm" data-ni-port-modal-settings>${S.networkInspector.openNetworkInspectorSettings}</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  currentOverlay = overlay;

  // While a conflict is shown, closing also remembers the dismissal. `closeAction` is read late (on
  // each event) so it picks up the swap to a plain close once the modal morphs to the "freed" state.
  closeAction = (): void => {
    dismissedKey = key;
    closeInternal();
  };
  onKeyHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') closeAction();
  };
  document.addEventListener('keydown', onKeyHandler);
  attachBackdropClickToClose(overlay, () => closeAction());
  overlay.querySelector('.ni-port-modal-close')?.addEventListener('click', () => closeAction());

  // Port changes happen in Settings → Network Inspector only; this button takes the user there.
  overlay.querySelector('[data-ni-port-modal-settings]')?.addEventListener('click', () => {
    window.roku?.openSettings?.('network-inspector');
    closeAction();
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
          // Port is free now — confirm it (auto-dismisses), same feedback as the background poll.
          showResolvedState();
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

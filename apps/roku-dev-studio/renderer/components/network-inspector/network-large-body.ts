/**
 * "Large Body" affordance, shared by the live Network tab and the Session Viewer: the small amber "i"
 * beside a pane's Format selector appears only when a JSON/XML body was too large to render as a
 * collapsible tree and was shown as raw text instead (a structured→raw *downgrade*), and clicking it
 * opens the explainer. Natively-raw bodies (JS/CSS/text) get no affordance — raw is their expected
 * rendering.
 */
import { S } from '@shared/strings/index.js';
import { escapeHtml } from '../../modules/utils/dom.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { openModalOverlayActiveFromOpener, closeModalWithOriginMotion } from '../../modules/utils/modal-origin-motion.js';
import { MAX_STRUCTURED_BYTES } from '../../modules/ui/structured-body.js';
import { getLargeBodyKb } from './network-detail.js';

/** Explainer modal for the "shown as raw text" case. Reuses the filter-help modal's shell styling. */
export function openLargeBodyInfoModal(kb: number, opener?: HTMLElement | null): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay ni-filter-help-overlay ni-large-body-overlay';
  const sizeLabel = kb > 0 ? `${kb.toLocaleString()} KB` : S.networkInspector.thisBody;
  const limitKb = Math.round(MAX_STRUCTURED_BYTES / 1024).toLocaleString();
  overlay.innerHTML = `
    <div class="ni-filter-help-modal" role="dialog" aria-modal="true" aria-label="${S.networkInspector.shownAsRawText}">
      <div class="ni-filter-help-header">
        <h3>${S.networkInspector.shownAsRawText}</h3>
        <button type="button" class="modal-close ni-large-body-close" title="${S.common.close}" aria-label="${S.common.close}"><span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span></button>
      </div>
      <div class="ni-filter-help-body">
        <p class="ni-filter-help-intro">${S.networkInspector.largeBodyIntro(escapeHtml(sizeLabel), escapeHtml(limitKb))}</p>
        <p class="ni-filter-help-note">${S.networkInspector.largeBodyNote}</p>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  openModalOverlayActiveFromOpener(overlay, opener ?? null);

  const close = (): void => {
    closeModalWithOriginMotion(overlay, () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    });
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  attachBackdropClickToClose(overlay, close);
  overlay.querySelector('.ni-large-body-close')?.addEventListener('click', close);
}

/** Show the "i" only for a genuine downgrade; the KB size is stashed on the button for the modal. */
export function setFormatInfo(btnEl: Element | null, kb: number, downgraded: boolean): void {
  if (!(btnEl instanceof HTMLElement)) return;
  const show = kb > 0 && downgraded;
  btnEl.hidden = !show;
  if (show) btnEl.dataset.kb = String(kb);
  else delete btnEl.dataset.kb;
}

/** Click on the "i" opens the explainer with the size `setFormatInfo` stashed (or the pane's live value). */
export function wireFormatInfoButton(
  btnEl: Element | null,
  pane: 'request' | 'response',
  listenerOptions?: AddEventListenerOptions
): void {
  if (!(btnEl instanceof HTMLElement)) return;
  btnEl.addEventListener(
    'click',
    () => openLargeBodyInfoModal(Number(btnEl.dataset.kb) || getLargeBodyKb(pane), btnEl),
    listenerOptions
  );
}

// Integration Guide setup

import type { DevicePanelRoot } from '../../types/device-panel-dom.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import {
  openModalOverlayActiveFromOpener,
  closeModalWithOriginMotion
} from '../../modules/utils/modal-origin-motion.js';

function blurIntegrationGuideOpenButtons() {
  document.querySelectorAll('.integration-guide-open-btn').forEach((el: Element) => {
    if (el instanceof HTMLElement) el.blur();
  });
}

function closeIntegrationGuideModal(modal: HTMLElement | null) {
  if (!modal || !modal.classList.contains('active')) return;
  closeModalWithOriginMotion(modal, () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(() => blurIntegrationGuideOpenButtons(), 0);
  });
}

/**
 * Setup integration guide UI
 */
export function setupIntegrationGuide(panel: DevicePanelRoot) {
  const modal = document.getElementById('integrationGuideModal');
  const openBtn = panel.querySelector('.integration-guide-open-btn');

  if (openBtn && modal instanceof HTMLElement) {
    openBtn.addEventListener('click', (e: Event) => {
      const opener = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
      openModalOverlayActiveFromOpener(modal, opener, () => {
        modal.setAttribute('aria-hidden', 'false');
        if (opener) setTimeout(() => opener.blur(), 0);
      });
    });
  }

  if (modal instanceof HTMLElement && !modal.dataset.integrationGuideBound) {
    modal.dataset.integrationGuideBound = '1';

    const closeBtn = modal.querySelector('.integration-guide-modal-close');
    closeBtn?.addEventListener('click', () => closeIntegrationGuideModal(modal));

    attachBackdropClickToClose(modal, () => closeIntegrationGuideModal(modal));

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeIntegrationGuideModal(modal);
      }
    });

    const guideSaveBtn = modal.querySelector('.guide-save-btn');
    const guideCopyBtn = modal.querySelector('.guide-copy-btn');

    guideSaveBtn?.addEventListener('click', (e: Event) => {
      (e as MouseEvent).stopPropagation();
      void window.saveTrackerTask?.();
    });

    guideCopyBtn?.addEventListener('click', (e: Event) => {
      (e as MouseEvent).stopPropagation();
      window.copyTrackerTaskInfo?.();
    });
  }
}

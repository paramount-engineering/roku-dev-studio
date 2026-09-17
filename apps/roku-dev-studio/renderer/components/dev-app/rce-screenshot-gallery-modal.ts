/**
 * Session screenshot gallery for RCE devices (design doc §8) — every frame captured during the
 * current video session, in memory only. Content-only/programmatic, mirroring `bitmaps-modal.ts`'s
 * snapshot-provider pattern rather than a one-shot render-at-open-time modal, since captures keep
 * arriving while the gallery is open.
 *
 * Per-thumbnail Copy/Save/Clear (decided 2026-09-11 design discussion) rather than a
 * selection-state concept the single-screenshot card doesn't have anywhere else — Clear on one
 * thumbnail removes just that capture, not the others or the main card's current image.
 */

import type { RceSessionScreenshot } from './dev-app-types.js';
import { icon, setSafeHTML, escapeHtml } from '../../modules/utils/index.js';
import {
  prepareModalOpenOrigin,
  playModalOpenMotion,
  closeModalWithOriginMotion
} from '../../modules/utils/modal-origin-motion.js';
import { attachBackdropClickToClose, attachEscToClose } from '../../modules/utils/modal-backdrop-click.js';
import { rendererWarn } from '../../modules/utils/logger.js';
import { S } from '@shared/strings/index.js';

export interface RceGalleryModalHandle {
  close: () => void;
  /** Re-pull the screenshot list and re-render the grid in place. */
  refresh: () => void;
}

// See bitmaps-modal.ts's identical map for why a rapid re-open needs to tear down the previous
// instance's own timers/listeners rather than just removing the stale DOM node.
const activeTeardowns = new WeakMap<HTMLElement, () => void>();

/** Trigger a direct-to-Downloads save for a data URL — no native dialog, so "Download All" doesn't
 *  make the user click through one Save-As prompt per shot. The per-thumbnail Save button keeps
 *  using the native-dialog `onSave` instead, matching the single-screenshot card's existing
 *  behavior (a deliberate difference: one file wants dialog control, N files don't). */
function downloadDataUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

function screenshotFilename(shot: RceSessionScreenshot): string {
  const iso = new Date(shot.capturedAt).toISOString().replace(/[:.]/g, '-');
  return `roku-screenshot-${iso}.png`;
}

export function openRceScreenshotGalleryModal(
  getScreenshots: () => RceSessionScreenshot[],
  onCopy: (url: string) => Promise<void>,
  onSave: (url: string, tempFile?: string) => Promise<void>,
  onRemove: (id: string) => void,
  onRemoveAll: () => void,
  onClose?: () => void,
  opener?: HTMLElement | null,
  focusShotId?: string
): RceGalleryModalHandle {
  document.querySelectorAll<HTMLElement>('.rce-gallery-modal-overlay').forEach((el) => {
    activeTeardowns.get(el)?.();
    el.remove();
  });

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay rce-gallery-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal rce-gallery-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', S.devApp.rceGalleryTitle);

  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'modal-title';
  titleEl.textContent = S.devApp.rceGalleryTitle;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', S.common.close);
  setSafeHTML(closeBtn, icon('x', 'icon-sm'));

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body rce-gallery-modal-body';

  const footer = document.createElement('div');
  footer.className = 'modal-footer rce-gallery-modal-footer';

  const downloadAllBtn = document.createElement('button');
  downloadAllBtn.type = 'button';
  downloadAllBtn.className = 'btn btn-secondary';
  setSafeHTML(downloadAllBtn, icon('download', 'icon-xs') + ' ' + escapeHtml(S.devApp.downloadAll));
  downloadAllBtn.addEventListener('click', () => {
    for (const shot of getScreenshots()) downloadDataUrl(shot.url, screenshotFilename(shot));
  });

  const clearAllBtn = document.createElement('button');
  clearAllBtn.type = 'button';
  clearAllBtn.className = 'btn btn-secondary';
  setSafeHTML(clearAllBtn, icon('clear-results', 'icon-xs') + ' ' + escapeHtml(S.devApp.clearAll));
  clearAllBtn.addEventListener('click', () => {
    onRemoveAll();
    render();
  });

  footer.appendChild(downloadAllBtn);
  footer.appendChild(clearAllBtn);

  let closed = false;

  function renderUnsafe(): void {
    const screenshots = getScreenshots();
    downloadAllBtn.disabled = screenshots.length === 0;
    clearAllBtn.disabled = screenshots.length === 0;
    if (screenshots.length === 0) {
      setSafeHTML(body, `<p class="rce-gallery-empty">${escapeHtml(S.devApp.rceGalleryEmpty)}</p>`);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'rce-gallery-grid';

    for (const shot of screenshots) {
      const card = document.createElement('div');
      card.className = 'rce-gallery-item';
      card.dataset.shotId = shot.id;

      const img = document.createElement('img');
      img.className = 'rce-gallery-thumb';
      img.src = shot.url;
      img.alt = S.devApp.rceGalleryCapturedAt(new Date(shot.capturedAt).toLocaleTimeString());

      const meta = document.createElement('div');
      meta.className = 'rce-gallery-item-meta';

      const timeLabel = document.createElement('span');
      timeLabel.className = 'rce-gallery-item-time';
      timeLabel.textContent = S.devApp.rceGalleryCapturedAt(new Date(shot.capturedAt).toLocaleTimeString());

      const actions = document.createElement('div');
      actions.className = 'rce-gallery-item-actions';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn btn-secondary btn-icon';
      copyBtn.title = S.devApp.copyScreenshot;
      setSafeHTML(copyBtn, icon('copy', 'icon-xs'));
      copyBtn.addEventListener('click', () => {
        void onCopy(shot.url).then(() => {
          setSafeHTML(copyBtn, icon('check', 'icon-xs'));
          setTimeout(() => setSafeHTML(copyBtn, icon('copy', 'icon-xs')), 1500);
        });
      });

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn btn-secondary btn-icon';
      saveBtn.title = S.devApp.saveScreenshotAs;
      setSafeHTML(saveBtn, icon('download', 'icon-xs'));
      // `?? ''`, not left undefined — `saveScreenshotToFile`'s `tempFile` param defaults to the
      // *last captured* shot's temp file when omitted, which is wrong for an older gallery entry
      // that simply never got one (falls back to decoding `shot.url` instead, as intended).
      saveBtn.addEventListener('click', () => void onSave(shot.url, shot.tempFile ?? ''));

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'btn btn-secondary btn-icon';
      clearBtn.title = S.devApp.clearScreenshot;
      setSafeHTML(clearBtn, icon('clear-results', 'icon-xs'));
      clearBtn.addEventListener('click', () => {
        onRemove(shot.id);
        render();
      });

      actions.appendChild(copyBtn);
      actions.appendChild(saveBtn);
      actions.appendChild(clearBtn);
      meta.appendChild(timeLabel);
      meta.appendChild(actions);
      card.appendChild(img);
      card.appendChild(meta);
      grid.appendChild(card);
    }

    setSafeHTML(body, '');
    body.appendChild(grid);
  }

  function render(): void {
    try {
      renderUnsafe();
    } catch (e) {
      rendererWarn('[rce-screenshot-gallery-modal] render failed', e);
      setSafeHTML(body, `<p class="rce-gallery-empty">${escapeHtml(S.devApp.rceGalleryEmpty)}</p>`);
    }
  }

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  prepareModalOpenOrigin(overlay, opener ?? null);
  document.body.appendChild(overlay);
  overlay.classList.add('active');
  overlay.classList.add('modal-motion-enabled');
  playModalOpenMotion(overlay);

  render();

  // Scroll straight to the shot that was just captured (only meaningful right after this initial
  // render — later re-renders, e.g. from a Clear click, don't re-trigger this scroll).
  if (focusShotId) {
    const focused = body.querySelector<HTMLElement>(`.rce-gallery-item[data-shot-id="${focusShotId}"]`);
    if (focused) {
      focused.scrollIntoView({ block: 'center' });
      focused.classList.add('rce-gallery-item-focused');
      setTimeout(() => focused.classList.remove('rce-gallery-item-focused'), 1600);
    }
  }

  let detachEsc = () => {};
  const teardown = () => {
    if (closed) return;
    closed = true;
    activeTeardowns.delete(overlay);
    overlay.remove();
    detachEsc();
    onClose && onClose();
  };
  activeTeardowns.set(overlay, teardown);

  const requestClose = () => {
    closeModalWithOriginMotion(overlay, teardown);
  };

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    requestClose();
  });
  attachBackdropClickToClose(overlay, requestClose);
  detachEsc = attachEscToClose(requestClose);
  closeBtn.focus();

  return {
    close: requestClose,
    refresh: () => {
      if (!closed) render();
    }
  };
}

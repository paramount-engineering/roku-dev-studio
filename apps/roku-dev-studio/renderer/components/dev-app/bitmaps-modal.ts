/**
 * Modal listing the current `r2d2-bitmaps` snapshot (Graphics mode of the Memory Usage card).
 * Content-only: it takes a snapshot provider and re-renders in place via `refresh()` as new
 * polling data arrives, mirroring `openConsoleAnalyticsModal`'s snapshot-provider pattern
 * (console-analytics-modal.ts) rather than a one-shot render-at-open-time modal.
 */

import type { R2d2Bitmap } from './remote-metrics-charts.js';
import { icon, setSafeHTML, escapeHtml } from '../../modules/utils/index.js';
import {
  prepareModalOpenOrigin,
  playModalOpenMotion,
  closeModalWithOriginMotion
} from '../../modules/utils/modal-origin-motion.js';
import { attachBackdropClickToClose, attachEscToClose } from '../../modules/utils/modal-backdrop-click.js';
import { attachInstantTooltips } from '../../modules/utils/instant-tooltip.js';
import { S } from '@shared/strings/index.js';

export interface BitmapsModalHandle {
  close: () => void;
  /** Re-pull the snapshot and re-render the table in place (preserving body scroll position). */
  refresh: () => void;
}

function fmtBitmapSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** "Updated HH:MM:SS" alone under 10s (an "ago" clause is redundant that soon), then
 *  "Updated HH:MM:SS (5s ago)" — re-derived on every call, so a caller that re-runs this on a 1s
 *  timer gets a live-ticking relative time without touching the table. */
function fmtUpdatedLabel(ts: number | null): string {
  if (ts == null) return S.devApp.bitmapsUpdatedNever;
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  const timeStr = new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  if (diffSec < 10) return S.devApp.bitmapsUpdatedAtPlain(timeStr);
  const ago =
    diffSec < 60 ? S.devApp.bitmapsAgoSeconds(diffSec) : S.devApp.bitmapsAgoMinutes(Math.floor(diffSec / 60));
  return S.devApp.bitmapsUpdatedAt(timeStr, ago);
}

export function openBitmapsModal(
  getSnapshot: () => R2d2Bitmap[],
  getUpdatedAt: () => number | null,
  onClose?: () => void,
  opener?: HTMLElement | null
): BitmapsModalHandle {
  document.querySelectorAll('.bitmaps-modal-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay bitmaps-modal-overlay';
  // Native `title` tooltips are slow and pair with a "?" help cursor that reads as "no tooltip"
  // (see instant-tooltip.ts) — this modal is appended straight to `document.body`, outside the
  // Remote Section's own `attachInstantTooltips(wrap)` subtree, so it needs its own.
  const detachTooltips = attachInstantTooltips(overlay);

  const modal = document.createElement('div');
  modal.className = 'modal bitmaps-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', S.devApp.bitmapsModalTitle);

  const header = document.createElement('div');
  header.className = 'modal-header bitmaps-modal-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'modal-title';
  titleEl.textContent = S.devApp.bitmapsModalTitle;

  const updatedEl = document.createElement('span');
  updatedEl.className = 'bitmaps-modal-updated';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', S.common.close);
  setSafeHTML(closeBtn, icon('x', 'icon-sm'));

  header.appendChild(titleEl);
  header.appendChild(updatedEl);
  header.appendChild(closeBtn);

  function renderUpdatedLabel(): void {
    updatedEl.textContent = fmtUpdatedLabel(getUpdatedAt());
  }
  /* Ticks the relative "Xs/Xm ago" clause even between polls (~2s apart) — a plain re-render on
   * data refresh alone would leave it frozen at whatever it said at the last poll. */
  const updatedTimer = setInterval(renderUpdatedLabel, 1000);

  const body = document.createElement('div');
  body.className = 'modal-body bitmaps-modal-body';

  // Three stacked pieces so the scrollbar only ever spans the data rows: a fixed head table, a
  // `flex:1` scroll area holding just the body table, and a fixed foot table — not a single
  // scrolling table with `position: sticky` thead/tfoot, whose native scrollbar track would run
  // the full height (visibly overlapping the header/footer bands). `table-layout: fixed` plus the
  // same `.bitmaps-modal-col-*` width percentages on all three tables keeps their columns aligned.
  const tableWrap = document.createElement('div');
  tableWrap.className = 'bitmaps-modal-table-wrap';

  const headTable = document.createElement('table');
  headTable.className = 'bitmaps-modal-table bitmaps-modal-table-head';
  setSafeHTML(
    headTable,
    `<thead><tr>
      <th class="bitmaps-modal-col-name">${escapeHtml(S.devApp.bitmapsColName)}</th>
      <th class="bitmaps-modal-col-dims">${escapeHtml(S.devApp.bitmapsColDimensions)}</th>
      <th class="bitmaps-modal-col-bpp" title="${escapeHtml(S.devApp.bitmapsBppTooltip)}">${escapeHtml(S.devApp.bitmapsColBpp)}</th>
      <th class="bitmaps-modal-col-size">${escapeHtml(S.devApp.bitmapsColSize)}</th>
    </tr></thead>`
  );

  const scrollArea = document.createElement('div');
  scrollArea.className = 'bitmaps-modal-scroll-area';

  const footTable = document.createElement('table');
  footTable.className = 'bitmaps-modal-table bitmaps-modal-table-foot';

  let closed = false;

  function render(): void {
    renderUpdatedLabel();
    const bitmaps = getSnapshot();
    const scrollTop = scrollArea.scrollTop;

    if (bitmaps.length === 0) {
      headTable.hidden = true;
      footTable.hidden = true;
      setSafeHTML(scrollArea, `<p class="bitmaps-modal-empty">${escapeHtml(S.devApp.bitmapsModalEmpty)}</p>`);
      return;
    }
    headTable.hidden = false;
    footTable.hidden = false;

    const sorted = [...bitmaps].sort((a, b) => b.size - a.size);
    const totalBytes = bitmaps.reduce((sum, b) => sum + b.size, 0);

    const bodyTable = document.createElement('table');
    bodyTable.className = 'bitmaps-modal-table';
    const tbody = document.createElement('tbody');
    for (const b of sorted) {
      const row = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.className = 'bitmaps-modal-col-name';
      nameCell.textContent = b.name;
      nameCell.title = b.name;

      const dimsCell = document.createElement('td');
      dimsCell.className = 'bitmaps-modal-col-dims';
      dimsCell.textContent = `${b.width}×${b.height}`;

      const bppCell = document.createElement('td');
      bppCell.className = 'bitmaps-modal-col-bpp';
      bppCell.textContent = String(b.bpp);

      const sizeCell = document.createElement('td');
      sizeCell.className = 'bitmaps-modal-col-size';
      sizeCell.textContent = fmtBitmapSize(b.size);

      row.appendChild(nameCell);
      row.appendChild(dimsCell);
      row.appendChild(bppCell);
      row.appendChild(sizeCell);
      tbody.appendChild(row);
    }
    bodyTable.appendChild(tbody);

    setSafeHTML(scrollArea, '');
    scrollArea.appendChild(bodyTable);
    scrollArea.scrollTop = scrollTop;

    setSafeHTML(
      footTable,
      `<tfoot><tr>
        <td class="bitmaps-modal-col-name bitmaps-modal-footer-label">${escapeHtml(S.devApp.bitmapsFooterTotal)}</td>
        <td class="bitmaps-modal-footer-count" colspan="2">${escapeHtml(S.devApp.bitmapsFooterCount(bitmaps.length))}</td>
        <td class="bitmaps-modal-col-size">${escapeHtml(fmtBitmapSize(totalBytes))}</td>
      </tr></tfoot>`
    );
  }

  render();

  tableWrap.appendChild(headTable);
  tableWrap.appendChild(scrollArea);
  tableWrap.appendChild(footTable);
  body.appendChild(tableWrap);
  modal.appendChild(header);
  modal.appendChild(body);

  overlay.appendChild(modal);
  prepareModalOpenOrigin(overlay, opener ?? null);
  document.body.appendChild(overlay);
  overlay.classList.add('active');
  overlay.classList.add('modal-motion-enabled');
  playModalOpenMotion(overlay);

  let detachEsc = () => {};
  const teardown = () => {
    closed = true;
    clearInterval(updatedTimer);
    detachTooltips();
    overlay.remove();
    detachEsc();
    onClose && onClose();
  };

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

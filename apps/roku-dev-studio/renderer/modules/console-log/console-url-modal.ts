import { createSingletonConsoleModal } from './singleton-console-modal.js';
import { consoleViewerModalTitle } from './console-modal-title.js';

const OVERLAY_ID = 'telnetUrlViewerOverlay';

function tryDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

export type UrlModalParamRow = { key: string; value: string };

function parseQueryPair(part: string): UrlModalParamRow | null {
  const t = part.trim();
  if (!t) return null;
  const eq = t.indexOf('=');
  if (eq < 0) return { key: tryDecode(t), value: '' };
  return {
    key: tryDecode(t.slice(0, eq).trim()),
    value: tryDecode(t.slice(eq + 1).trim())
  };
}

/**
 * Split raw query string (without leading `?`) into one or more "sets".
 * - Both `&` and `;` (FreeWheel-style): `mode=LIVE;fms_…` uses `;` like `&` (same block).
 *   When `;ptgt=` / `;slid=` appear, split there into major blocks (often 3 tables), then
 *   split each block on `[&;]` into key/value rows.
 * - Otherwise (both separators, no those markers): split on `;` then `&` per segment.
 * - Only `&`: single table, rows from `&`.
 * - Only `;`: single table, rows from `;`.
 */
export function splitQueryIntoParamSets(rawQuery: string): string[][] {
  const q = rawQuery.trim();
  if (!q) return [];
  const hasAmp = q.includes('&');
  const hasSemi = q.includes(';');
  if (hasAmp && hasSemi) {
    const fwMajor = q.split(/;(?=ptgt=|slid=)/i);
    if (fwMajor.length > 1) {
      return fwMajor
        .map((s) => s.trim())
        .filter(Boolean)
        .map((seg) => seg.split(/[&;]/g).map((s) => s.trim()).filter(Boolean));
    }
    return q
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((seg) => seg.split('&').map((s) => s.trim()).filter(Boolean));
  }
  if (hasAmp) {
    return [q.split('&').map((s) => s.trim()).filter(Boolean)];
  }
  if (hasSemi) {
    return [q.split(';').map((s) => s.trim()).filter(Boolean)];
  }
  return [[q]];
}

function createParamTable(rows: UrlModalParamRow[]): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'telnet-url-view-param-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const thKey = document.createElement('th');
  thKey.textContent = 'Key';
  const thVal = document.createElement('th');
  thVal.textContent = 'Value';
  headRow.appendChild(thKey);
  headRow.appendChild(thVal);
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    const tdKey = document.createElement('td');
    tdKey.textContent = r.key;
    const tdVal = document.createElement('td');
    tdVal.className = 'telnet-url-view-value-cell';
    tdVal.textContent = r.value;
    tr.appendChild(tdKey);
    tr.appendChild(tdVal);
    tbody.appendChild(tr);
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}

function populateUrlModalBody(overlay: HTMLElement, url: string): void {
  const fullEl = overlay.querySelector('.telnet-url-view-full-url');
  const paramsEl = overlay.querySelector('.telnet-url-view-params');
  if (!(fullEl instanceof HTMLElement) || !(paramsEl instanceof HTMLElement)) return;

  paramsEl.replaceChildren();

  const trimmed = url.trim();
  let displayHref = trimmed;
  let rawQuery = '';

  try {
    const u = new URL(trimmed);
    displayHref = u.href;
    rawQuery = u.search.startsWith('?') ? u.search.slice(1) : u.search;
  } catch {
    const qIdx = trimmed.indexOf('?');
    if (qIdx >= 0) {
      rawQuery = trimmed.slice(qIdx + 1);
    }
  }

  fullEl.textContent = displayHref;

  const sets = splitQueryIntoParamSets(rawQuery);
  const rowGroups = sets
    .map((pairStrs) => pairStrs.map(parseQueryPair).filter((r): r is UrlModalParamRow => r !== null))
    .filter((g) => g.length > 0);

  if (rowGroups.length === 0) {
    const hint = document.createElement('p');
    hint.className = 'telnet-url-view-no-params';
    hint.textContent = rawQuery ? 'Could not parse parameters.' : 'No query parameters.';
    paramsEl.appendChild(hint);
    return;
  }

  rowGroups.forEach((rows, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'telnet-url-view-param-set';
    if (rowGroups.length > 1) {
      const lab = document.createElement('div');
      lab.className = 'telnet-url-view-param-set-label';
      lab.textContent = `Parameter set ${i + 1}`;
      wrap.appendChild(lab);
    }
    wrap.appendChild(createParamTable(rows));
    paramsEl.appendChild(wrap);
  });
}

// All shared lifecycle (singleton overlay, backdrop click-with-mousedown-gate,
// Esc handler, focus-trap re-arm, scroll reset, motion bridging) lives in
// `singleton-telnet-modal.ts`. This file owns only the URL-viewer-specific
// markup and the per-open populate logic.
const urlModal = createSingletonConsoleModal({
  overlayId: OVERLAY_ID,
  innerHTML: `
    <div class="modal telnet-url-view-modal" role="dialog" aria-modal="true" aria-labelledby="telnetUrlViewerTitle">
      <div class="modal-header">
        <span class="modal-title" id="telnetUrlViewerTitle">Console</span>
        <div class="telnet-url-view-modal-actions">
          <button type="button" class="btn btn-secondary telnet-url-view-open" title="Open in default browser">Open in browser</button>
          <button type="button" class="btn btn-secondary telnet-url-view-copy" title="Copy URL">Copy</button>
          <button type="button" class="modal-close telnet-url-view-close" aria-label="Close"><span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span></button>
        </div>
      </div>
      <div class="modal-body telnet-url-view-body">
        <div class="telnet-url-view-full-url" tabindex="0" aria-label="Full URL"></div>
        <div class="telnet-url-view-params" aria-label="Query parameters"></div>
      </div>
    </div>
  `,
  closeButtonSelector: '.telnet-url-view-close',
  onMount: (overlay, { close }) => {
    overlay.querySelector('.telnet-url-view-open')?.addEventListener('click', async () => {
      const raw = overlay.dataset.currentUrl || '';
      if (!raw || (!raw.startsWith('http://') && !raw.startsWith('https://'))) {
        return;
      }
      try {
        await window.roku.openExternal(raw);
      } catch {
        /* ignore */
      } finally {
        close();
      }
    });

    const copyBtn = overlay.querySelector('.telnet-url-view-copy');
    copyBtn?.addEventListener('click', async () => {
      const raw = overlay.dataset.currentUrl || '';
      try {
        await window.roku.copyToClipboard(raw);
        if (copyBtn instanceof HTMLElement) {
          const prev = copyBtn.textContent;
          copyBtn.textContent = 'Copied';
          setTimeout(() => {
            copyBtn.textContent = prev || 'Copy';
          }, 1600);
        }
      } catch {
        /* ignore */
      }
    });
  }
});

/**
 * Preview URL in a modal: full URL in a highlighted block; query params in one or more tables
 * (multiple tables for FreeWheel-style queries: major breaks at `;ptgt=` / `;slid=`, else `;` groups.)
 */
export function openConsoleUrlViewer(opener: HTMLElement | null, url: string): void {
  urlModal.open(opener, (overlay) => {
    const title = overlay.querySelector('#telnetUrlViewerTitle');
    overlay.dataset.currentUrl = url.trim();
    if (title) {
      title.textContent = consoleViewerModalTitle('URL');
    }
    populateUrlModalBody(overlay, url);
  });
}

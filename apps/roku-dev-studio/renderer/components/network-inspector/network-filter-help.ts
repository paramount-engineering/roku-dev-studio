/**
 * Filter-syntax help modal for the session filter box — shared by the live Network Inspector tab
 * and the standalone Session Viewer. Lists the supported field-scoped syntax with clickable example
 * chips that append to the filter box via `onPick`; free-text and comma-OR semantics are explained
 * inline. The `field:value` grammar matches `filterSessions()` in network-sessions.ts.
 */
import { escapeHtml } from '../../modules/utils/dom.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { attachSearchHistory } from '../../modules/ui/search-history.js';
import { S } from '@shared/strings/index.js';

/** Supported filter fields, shown in the help modal with clickable examples. A function
 *  (not a const) so the `desc` labels read from the active locale each time the modal opens. */
export const filterHelpFields = (): Array<{ field: string; desc: string; examples: string[] }> => [
  { field: 'host:', desc: S.networkInspector.filterDescHost, examples: ['host:roku.com', 'host:googlevideo'] },
  { field: 'method:', desc: S.networkInspector.filterDescMethod, examples: ['method:POST', 'method:GET'] },
  { field: 'status:', desc: S.networkInspector.filterDescStatus, examples: ['status:404', 'status:4xx', 'status:5xx'] },
  { field: 'type:', desc: S.networkInspector.filterDescType, examples: ['type:json', 'type:image'] },
  { field: 'kind:', desc: S.networkInspector.filterDescKind, examples: ['kind:https', 'kind:dns', 'kind:tcp'] },
  { field: 'path:', desc: S.networkInspector.filterDescPath, examples: ['path:/v1/play'] }
];

export interface NetworkFilterControlsOpts {
  filterInput: HTMLInputElement | null;
  filterClearBtn: HTMLElement | null;
  filterHelpBtn: HTMLElement | null;
  /** Storage key for Up/Down-arrow filter-history recall (e.g. `filterHistoryKey('ni', ip)`). */
  historyStorageKey: string;
  /** Run after every filter change — input edit, history recall, clear-button, and help-chip append.
   *  Each surface's own apply routine handles its own repaint + clear-button sync. */
  onApply: () => void;
  /** The live tab passes its `AbortController` options so all three listeners tear down on dispose;
   *  omit for the window-lifetime Session Viewer. Does NOT cover the search-history binding — use the
   *  returned handle's `dispose()` for that. */
  listenerOptions?: AddEventListenerOptions;
}

export interface NetworkFilterControlsHandle {
  /** Tear down the Up/Down search-history binding (the live tab calls this from its `destroy()`). */
  dispose(): void;
}

/**
 * Wire the session-filter controls (text input + Up/Down history recall + clear button + help modal) —
 * identical glue in the live Network Inspector tab and the standalone Session Viewer, so it lives here.
 * The clear button and help-chip append both write the input then call `onApply`; the help chip appends
 * comma-OR. Everything funnels through the single `onApply` callback each surface supplies.
 */
export function wireNetworkFilterControls(opts: NetworkFilterControlsOpts): NetworkFilterControlsHandle {
  const { filterInput, filterClearBtn, filterHelpBtn, historyStorageKey, onApply, listenerOptions } = opts;

  filterInput?.addEventListener('input', onApply, listenerOptions);

  // Up/Down arrow recall of previous filter terms. Defaults to the in-memory session store (see
  // attachSearchHistory) — the same backend both surfaces already used.
  const history = filterInput
    ? attachSearchHistory({ input: filterInput, storageKey: historyStorageKey, onChange: onApply })
    : null;

  filterClearBtn?.addEventListener(
    'click',
    () => {
      if (!filterInput || !filterInput.value) return;
      filterInput.value = '';
      onApply();
      filterInput.focus();
    },
    listenerOptions
  );

  filterHelpBtn?.addEventListener(
    'click',
    () => {
      openFilterHelpModal((term) => {
        if (!filterInput) return;
        // Append the picked example (comma-OR), then apply immediately.
        const current = filterInput.value.trim();
        filterInput.value = current ? `${current}, ${term}` : term;
        onApply();
        filterInput.focus();
      });
    },
    listenerOptions
  );

  return { dispose: () => history?.dispose() };
}

/**
 * Open the filtering help modal. Clicking an example chip calls `onPick(term)` (typically appends it
 * to the filter box, comma-OR) and closes the modal.
 */
export function openFilterHelpModal(onPick: (term: string) => void): void {
  const overlay = document.createElement('div');
  // `.modal-overlay` is display:none until `.active` is added (shared backdrop + centering).
  overlay.className = 'modal-overlay ni-filter-help-overlay active';
  const rows = filterHelpFields().map((f) => {
    const chips = f.examples
      .map(
        (ex) =>
          `<button type="button" class="ni-filter-help-chip" data-filter-term="${escapeHtml(ex)}" title="${S.networkInspector.addToFilter}">${escapeHtml(ex)}</button>`
      )
      .join('');
    return `<tr>
      <td class="ni-filter-help-field"><code>${escapeHtml(f.field)}</code></td>
      <td class="ni-filter-help-desc">${escapeHtml(f.desc)}<div class="ni-filter-help-chips">${chips}</div></td>
    </tr>`;
  }).join('');
  overlay.innerHTML = `
    <div class="ni-filter-help-modal" role="dialog" aria-modal="true" aria-label="${S.networkInspector.filterHelpAria}">
      <div class="ni-filter-help-header">
        <h3>${S.networkInspector.filterHelpHeading}</h3>
        <button type="button" class="modal-close ni-filter-help-close" title="${S.common.close}" aria-label="${S.common.close}"><span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span></button>
      </div>
      <div class="ni-filter-help-body">
        <p class="ni-filter-help-intro">${S.networkInspector.filterHelpIntro}</p>
        <table class="ni-filter-help-table"><tbody>${rows}</tbody></table>
        <p class="ni-filter-help-note">${S.networkInspector.filterHelpNoteLead}<button type="button" class="ni-filter-help-chip" data-filter-term="host:roku.com, status:4xx, method:POST" title="${S.networkInspector.addToFilter}">host:roku.com, status:4xx, method:POST</button>${S.networkInspector.filterHelpNoteExplain}</p>
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
  overlay.querySelector('.ni-filter-help-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('[data-filter-term]') as HTMLElement | null;
    if (chip?.dataset.filterTerm) {
      onPick(chip.dataset.filterTerm);
      close();
    }
  });
}

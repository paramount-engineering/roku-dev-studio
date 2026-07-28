/**
 * Save-Action-Script modal (the default in-app "Save" path). Resolves to the trimmed name, or
 * `null` if cancelled. Features:
 *  - a proper full-width Name field,
 *  - a LIVE duplicate alert: as soon as the typed name matches an existing one, a warning shows,
 *    the confirm button flips to "Overwrite", and the matching saved row is highlighted,
 *  - a fixed-height, scrollable list of already-saved scripts (or a "No saved scripts" empty
 *    state); clicking a row fills the Name field (i.e. sets up an overwrite),
 *  - a Cancel / Save footer.
 *
 * Programmatic + transient (built on open, removed on close), so it carries no `data-i18n` — all
 * text is read from `S.*` at build time.
 */
import { escapeHtml, setSafeHTML } from '../../modules/utils/index.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { S } from '@shared/strings/index.js';

export function promptSaveScriptName(opts: {
  defaultName?: string;
  savedNames: string[];
}): Promise<string | null> {
  return new Promise((resolve) => {
    const savedNames = opts.savedNames.slice();
    const nameExists = (name: string): boolean => {
      const key = name.trim().toLowerCase();
      return !!key && savedNames.some((n) => n.trim().toLowerCase() === key);
    };

    const listMarkup = savedNames.length
      ? savedNames
          .map(
            (n) =>
              `<button type="button" class="action-scripts-save-modal-list-item" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button>`
          )
          .join('')
      : `<div class="action-scripts-save-modal-empty">${escapeHtml(S.actionScripts.saveModalNoSavedScripts)}</div>`;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active action-scripts-save-modal-overlay';
    setSafeHTML(
      overlay,
      `<div class="modal action-scripts-save-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(S.actionScripts.saveActionScriptBtn)}">
         <div class="modal-header">
           <h2>${escapeHtml(S.actionScripts.saveActionScriptBtn)}</h2>
           <button type="button" class="modal-close action-scripts-save-modal-close" title="${escapeHtml(S.common.close)}" aria-label="${escapeHtml(S.common.close)}">&times;</button>
         </div>
         <div class="modal-body">
           <div class="action-scripts-save-field">
             <label class="action-scripts-save-modal-label" for="actionScriptsSaveNameInput">${escapeHtml(S.actionScripts.saveModalNameLabel)}</label>
             <input id="actionScriptsSaveNameInput" type="text" class="action-scripts-save-modal-input" placeholder="${escapeHtml(S.actionScripts.saveModalNamePlaceholder)}" autocomplete="off" spellcheck="false" />
             <p class="action-scripts-save-modal-warning" role="alert" hidden></p>
           </div>
           <div class="action-scripts-save-saved">
             <div class="action-scripts-save-saved-label">${escapeHtml(S.actionScripts.saveModalSavedListLabel)}</div>
             <div class="action-scripts-save-modal-list">${listMarkup}</div>
           </div>
         </div>
         <div class="modal-footer action-scripts-save-modal-footer">
           <button type="button" class="btn btn-secondary action-scripts-save-modal-cancel">${escapeHtml(S.common.cancel)}</button>
           <button type="button" class="btn btn-primary action-scripts-save-modal-confirm">${escapeHtml(S.common.save)}</button>
         </div>
       </div>`
    );

    const input = overlay.querySelector('.action-scripts-save-modal-input') as HTMLInputElement;
    const warning = overlay.querySelector('.action-scripts-save-modal-warning') as HTMLElement;
    const confirmBtn = overlay.querySelector('.action-scripts-save-modal-confirm') as HTMLButtonElement;
    const listEl = overlay.querySelector('.action-scripts-save-modal-list') as HTMLElement;

    const settle = (value: string | null): void => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(value);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') settle(null);
    };

    // Live duplicate feedback: warn + flip Save→Overwrite + highlight the matching saved row.
    const syncDuplicateState = (): void => {
      const name = input.value.trim();
      const key = name.toLowerCase();
      const dup = nameExists(name);
      if (dup) {
        warning.textContent = S.actionScripts.saveModalOverwriteWarning(name);
        warning.hidden = false;
      } else {
        warning.hidden = true;
      }
      confirmBtn.textContent = dup ? S.actionScripts.saveModalOverwriteConfirm : S.common.save;
      listEl.querySelectorAll<HTMLElement>('.action-scripts-save-modal-list-item').forEach((item) => {
        item.classList.toggle('is-current', !!key && (item.dataset.name ?? '').trim().toLowerCase() === key);
      });
    };

    const submit = (): void => {
      const name = input.value.trim();
      if (!name) {
        warning.textContent = S.actionScripts.saveModalNameRequired;
        warning.hidden = false;
        input.focus();
        return;
      }
      settle(name);
    };

    input.addEventListener('input', syncDuplicateState);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
    confirmBtn.addEventListener('click', submit);
    listEl.querySelectorAll<HTMLElement>('.action-scripts-save-modal-list-item').forEach((item) => {
      item.addEventListener('click', () => {
        input.value = item.dataset.name ?? '';
        syncDuplicateState();
        input.focus();
      });
    });
    overlay.querySelector('.action-scripts-save-modal-close')?.addEventListener('click', () => settle(null));
    overlay.querySelector('.action-scripts-save-modal-cancel')?.addEventListener('click', () => settle(null));
    attachBackdropClickToClose(overlay, () => settle(null));
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    if (opts.defaultName) input.value = opts.defaultName;
    syncDuplicateState();
    input.focus();
    input.select();
  });
}

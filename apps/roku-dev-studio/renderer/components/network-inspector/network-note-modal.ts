/**
 * Per-request Note modal for the Network Inspector — opened from the request-pane header's Notes
 * button (see network-detail-view.ts). Replaces the old inline pinned textarea in the Overview.
 * Shared by BOTH surfaces: the live tab persists via IPC (`networkInspectorSetEventNote`), the
 * offline Session Viewer keeps the note in memory only — each supplies its own `onSave`.
 *
 * Follows the app's modal convention (same as network-compose-modal.ts): `.modal-overlay.active` +
 * attachBackdropClickToClose + Escape + document.body.appendChild + inline S.* interpolation (no
 * applyI18n pass needed). Save is EXPLICIT: the footer Save button is the only thing that persists
 * (calls `onSave`); the header ×, Escape, and a backdrop click all close WITHOUT saving.
 */
import { escapeHtml } from '../../modules/utils/dom.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { S } from '@shared/strings/index.js';

/**
 * Open the Notes modal for a captured request. Prefills the textarea with `note`; `onSave(id, note)`
 * fires ONLY when the user clicks Save, with the textarea's current value (the caller decides how to
 * normalize — e.g. treat empty/whitespace as "no note"). Dismissing via ×/Escape/backdrop discards
 * edits. `subtitle`, when given, renders a line under the heading identifying the request being noted.
 */
export function openNoteModal(opts: {
  id: string;
  note: string;
  subtitle?: string;
  onSave: (id: string, note: string) => void;
}): void {
  const subtitleLine = opts.subtitle
    ? `<div class="ni-note-subtitle">${escapeHtml(opts.subtitle)}</div>`
    : '';

  const overlay = document.createElement('div');
  // `.modal-overlay` is display:none until `.active` is added.
  overlay.className = 'modal-overlay ni-note-overlay active';
  overlay.innerHTML = `
    <div class="ni-rules-modal ni-note-modal" role="dialog" aria-modal="true" aria-label="${S.networkInspector.secNote}">
      <div class="ni-rules-header">
        <div class="ni-rules-header-info">
          <h3 class="ni-rules-title">${S.networkInspector.secNote}</h3>
          ${subtitleLine}
        </div>
        <button type="button" class="modal-close ni-note-close" title="${S.common.close}" aria-label="${S.common.close}"><span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span></button>
      </div>
      <div class="ni-rules-body">
        <div class="ni-rules-field">
          <textarea class="ni-note-textarea" data-ni-note rows="8" placeholder="${escapeHtml(S.networkInspector.notePlaceholder)}" aria-label="${escapeHtml(S.networkInspector.noteAriaLabel)}" spellcheck="false">${escapeHtml(opts.note)}</textarea>
        </div>
      </div>
      <div class="ni-rules-footer">
        <button type="button" class="btn btn-secondary ni-note-clear-btn" data-ni-note-clear${opts.note.trim() ? '' : ' disabled'}>${S.common.clear}</button>
        <button type="button" class="btn btn-primary" data-ni-note-save>${S.common.save}</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const textarea = overlay.querySelector('[data-ni-note]') as HTMLTextAreaElement | null;

  // Close WITHOUT saving — the header ×, Escape, and a backdrop click all discard edits.
  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  // The ONLY path that persists: hand the textarea's current value to `onSave`, then close. There is
  // no auto-save on type/blur, so dismissing the modal any other way leaves the stored note untouched.
  const saveAndClose = (): void => {
    opts.onSave(opts.id, textarea?.value ?? '');
    close();
  };
  document.addEventListener('keydown', onKey);
  attachBackdropClickToClose(overlay, close);
  overlay.querySelector('.ni-note-close')?.addEventListener('click', close);
  overlay.querySelector('[data-ni-note-save]')?.addEventListener('click', saveAndClose);

  // Clear empties the textarea (the user still clicks Save to persist the removal, per the explicit-save
  // model). Enabled only while there's non-whitespace text to clear.
  const clearBtn = overlay.querySelector('[data-ni-note-clear]') as HTMLButtonElement | null;
  const syncClearEnabled = (): void => {
    if (clearBtn) clearBtn.disabled = !textarea?.value.trim();
  };
  textarea?.addEventListener('input', syncClearEnabled);
  clearBtn?.addEventListener('click', () => {
    if (textarea) {
      textarea.value = '';
      textarea.focus();
    }
    syncClearEnabled();
  });

  // Focus the textarea and drop the caret at the end so an existing note is ready to append to.
  textarea?.focus();
  const len = textarea?.value.length ?? 0;
  textarea?.setSelectionRange(len, len);
}

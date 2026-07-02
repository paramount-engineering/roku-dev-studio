/**
 * Filter-syntax help modal for the session filter box — shared by the live Network Inspector tab
 * and the standalone Session Viewer. Lists the supported field-scoped syntax with clickable example
 * chips that append to the filter box via `onPick`; free-text and comma-OR semantics are explained
 * inline. The `field:value` grammar matches `filterSessions()` in network-sessions.ts.
 */
import { escapeHtml } from '../../modules/utils/dom.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';

/** Supported filter fields, shown in the help modal with clickable examples. */
export const FILTER_HELP_FIELDS: Array<{ field: string; desc: string; examples: string[] }> = [
  { field: 'host:', desc: 'Match the hostname (substring).', examples: ['host:roku.com', 'host:googlevideo'] },
  { field: 'method:', desc: 'HTTP method.', examples: ['method:POST', 'method:GET'] },
  { field: 'status:', desc: 'Status code, or a class like 4xx / 5xx.', examples: ['status:404', 'status:4xx', 'status:5xx'] },
  { field: 'type:', desc: 'Response Content-Type (alias content-type:).', examples: ['type:json', 'type:image'] },
  { field: 'kind:', desc: 'Session kind.', examples: ['kind:https', 'kind:dns', 'kind:tcp'] },
  { field: 'path:', desc: 'URL path (substring; alias url:).', examples: ['path:/v1/play'] }
];

/**
 * Open the filtering help modal. Clicking an example chip calls `onPick(term)` (typically appends it
 * to the filter box, comma-OR) and closes the modal.
 */
export function openFilterHelpModal(onPick: (term: string) => void): void {
  const overlay = document.createElement('div');
  // `.modal-overlay` is display:none until `.active` is added (shared backdrop + centering).
  overlay.className = 'modal-overlay ni-filter-help-overlay active';
  const rows = FILTER_HELP_FIELDS.map((f) => {
    const chips = f.examples
      .map(
        (ex) =>
          `<button type="button" class="ni-filter-help-chip" data-filter-term="${escapeHtml(ex)}" title="Add to Filter">${escapeHtml(ex)}</button>`
      )
      .join('');
    return `<tr>
      <td class="ni-filter-help-field"><code>${escapeHtml(f.field)}</code></td>
      <td class="ni-filter-help-desc">${escapeHtml(f.desc)}<div class="ni-filter-help-chips">${chips}</div></td>
    </tr>`;
  }).join('');
  overlay.innerHTML = `
    <div class="ni-filter-help-modal" role="dialog" aria-modal="true" aria-label="Filter Help">
      <div class="ni-filter-help-header">
        <h3>Filtering Sessions</h3>
        <button type="button" class="modal-close ni-filter-help-close" title="Close" aria-label="Close">×</button>
      </div>
      <div class="ni-filter-help-body">
        <p class="ni-filter-help-intro">Type free text to match host, path, method, status, kind, or Content-Type. Use <code>field:value</code> for precise matches, and separate terms with <strong>commas</strong> to match <strong>any</strong> of them (OR).</p>
        <table class="ni-filter-help-table"><tbody>${rows}</tbody></table>
        <p class="ni-filter-help-note">Example: <button type="button" class="ni-filter-help-chip" data-filter-term="host:roku.com, status:4xx, method:POST" title="Add to Filter">host:roku.com, status:4xx, method:POST</button> shows any session on roku.com <em>or</em> with a 4xx status <em>or</em> using POST. Click any example to add it.</p>
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

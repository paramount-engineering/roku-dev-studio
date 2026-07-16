/**
 * Single source of truth for the rich console/log find-bar **markup**.
 *
 * The `attachConsoleFindBar` logic (`console-find-bar.ts`) was already shared by both hosts (the
 * telnet Console in the main window and the standalone Log Viewer window), but each host used to
 * hand-write its own copy of the `.telnet-find-bar` HTML — one inside `index.html`'s
 * `#devicePanelTemplate`, one inside `log-file-viewer.html`. The two copies drifted (aria labels,
 * `type="button"`, tooltip text), and a markup/behavior tweak had to be made twice. This builder
 * produces one identical element that both hosts inject at mount time.
 *
 * It returns just the `.telnet-find-bar` element. Each host keeps its own surrounding chrome:
 *   - Console: a `.telnet-find-slot` flex spacer + a `.telnet-find-resize` drag handle.
 *   - Log Viewer: the centered `#logViewerFindHost`, resized via `makeCenteredSearchResizable`.
 *
 * Icons reference the shared SVG `<symbol>`s (`#icon-chevron-up/-down`, `#icon-x`), which are defined
 * in both documents.
 */

export interface ConsoleFindBarMarkupOptions {
  /**
   * Append the `(Alt+…)` keyboard-shortcut hints to the option-button tooltips. Only the main window
   * binds Alt+C/W/R (via the console shortcut handler), so the standalone Log Viewer omits them to
   * avoid advertising a shortcut it doesn't wire up.
   */
  altShortcutHints?: boolean;
}

const iconSpan = (symbolId: string): string =>
  `<span class="icon icon-xs"><svg><use href="#${symbolId}"/></svg></span>`;

/**
 * Build the `.telnet-find-bar` element consumed by {@link import('./console-find-bar.js').attachConsoleFindBar}.
 * The caller is responsible for inserting it into the host that it later passes as `root`.
 */
export function buildConsoleFindBarElement(opts: ConsoleFindBarMarkupOptions = {}): HTMLElement {
  const alt = opts.altShortcutHints ?? false;
  const bar = document.createElement('div');
  bar.className = 'telnet-find-bar';
  bar.innerHTML =
    `<select class="telnet-mode-select" aria-label="Find or filter mode">` +
      `<option value="find">Find</option>` +
      `<option value="filter">Filter</option>` +
    `</select>` +
    `<div class="telnet-find-input-wrapper">` +
      `<input type="text" class="telnet-find-input" placeholder="Find..." spellcheck="false" aria-label="Find or filter query">` +
      `<div class="telnet-find-options">` +
        `<button type="button" class="telnet-option-btn" data-option="case" title="Match Case${alt ? ' (Alt+C)' : ''}" aria-label="Match Case">Aa</button>` +
        `<button type="button" class="telnet-option-btn" data-option="word" title="Match Whole Word${alt ? ' (Alt+W)' : ''}" aria-label="Match Whole Word">ab</button>` +
        `<button type="button" class="telnet-option-btn" data-option="regex" title="Use Regular Expression${alt ? ' (Alt+R)' : ''}" aria-label="Use Regular Expression">.*</button>` +
      `</div>` +
    `</div>` +
    `<span class="telnet-find-count" aria-live="polite"></span>` +
    `<button type="button" class="btn btn-icon telnet-find-prev" title="Previous (Shift+Enter)" aria-label="Previous Match">${iconSpan('icon-chevron-up')}</button>` +
    `<button type="button" class="btn btn-icon telnet-find-next" title="Next (Enter)" aria-label="Next Match">${iconSpan('icon-chevron-down')}</button>` +
    `<button type="button" class="btn btn-icon telnet-find-clear" title="Clear" aria-label="Clear find">${iconSpan('icon-x')}</button>`;
  return bar;
}

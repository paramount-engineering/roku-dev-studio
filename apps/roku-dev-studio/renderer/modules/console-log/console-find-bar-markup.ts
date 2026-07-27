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

import { S } from '@shared/strings/index.js';

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
  // Static labels carry data-i18n* so a live locale switch's applyI18n(document) pass retranslates
  // this once-built bar in place (it's shared by the telnet Console panel + the Log Viewer window;
  // both run applyI18n) WITHOUT re-rendering — so an in-progress search keeps its input + matches.
  // The three option-button tooltips are parametrized (`(alt)`) so they can't ride data-i18n and stay
  // as rendered; they're symbol buttons (Aa/ab/.*) whose visible glyphs need no translation anyway.
  bar.innerHTML =
    `<select class="telnet-mode-select" aria-label="${S.consoleLog.modeSelectAria}" data-i18n-aria-label="consoleLog.modeSelectAria">` +
      `<option value="find" data-i18n="consoleLog.modeFind">${S.consoleLog.modeFind}</option>` +
      `<option value="filter" data-i18n="consoleLog.modeFilter">${S.consoleLog.modeFilter}</option>` +
    `</select>` +
    `<div class="telnet-find-input-wrapper">` +
      `<input type="text" class="telnet-find-input" placeholder="${S.consoleLog.queryPlaceholder}" data-i18n-placeholder="consoleLog.queryPlaceholder" spellcheck="false" aria-label="${S.consoleLog.queryAria}" data-i18n-aria-label="consoleLog.queryAria">` +
      `<div class="telnet-find-options">` +
        `<button type="button" class="telnet-option-btn" data-option="case" title="${S.consoleLog.optMatchCaseTitle(alt)}" aria-label="${S.consoleLog.optMatchCaseTitle(false)}">Aa</button>` +
        `<button type="button" class="telnet-option-btn" data-option="word" title="${S.consoleLog.optWholeWordTitle(alt)}" aria-label="${S.consoleLog.optWholeWordTitle(false)}">ab</button>` +
        `<button type="button" class="telnet-option-btn" data-option="regex" title="${S.consoleLog.optRegexTitle(alt)}" aria-label="${S.consoleLog.optRegexTitle(false)}">.*</button>` +
      `</div>` +
    `</div>` +
    `<span class="telnet-find-count" aria-live="polite"></span>` +
    `<button type="button" class="btn btn-icon telnet-find-prev" title="${S.consoleLog.prevTitle}" data-i18n-title="consoleLog.prevTitle" aria-label="${S.consoleLog.prevAria}" data-i18n-aria-label="consoleLog.prevAria">${iconSpan('icon-chevron-up')}</button>` +
    `<button type="button" class="btn btn-icon telnet-find-next" title="${S.consoleLog.nextTitle}" data-i18n-title="consoleLog.nextTitle" aria-label="${S.consoleLog.nextAria}" data-i18n-aria-label="consoleLog.nextAria">${iconSpan('icon-chevron-down')}</button>` +
    `<button type="button" class="btn btn-icon telnet-find-clear" title="${S.common.clear}" data-i18n-title="common.clear" aria-label="${S.consoleLog.clearAria}" data-i18n-aria-label="consoleLog.clearAria">${iconSpan('icon-x')}</button>`;
  return bar;
}

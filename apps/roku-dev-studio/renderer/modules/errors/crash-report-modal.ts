import { S } from '@shared/strings/index.js';
import { attachBackdropClickToClose, attachEscToClose } from '../utils/modal-backdrop-click.js';
import {
  buildIssueTitle,
  buildIssueBody,
  buildGithubIssueUrl,
  buildPlainCrashInfo,
  type CapturedError,
  type AppInfo
} from './crash-report.js';
import { redactSensitive } from './redact.js';

const STYLE_ID = 'rds-crash-report-styles';

/**
 * Fully self-contained styling (own class names, injected once) matching the app's real modal
 * design tokens (`.modal-overlay`/`.modal`/`.btn-primary`/`.btn-secondary`, `:root` colors in
 * `renderer/index.html`) with the actual values hardcoded rather than `var(--x)` — those custom
 * properties are only defined in `index.html`, not in the other 7 windows' separate CSS files, so
 * referencing them would fall back to unstyled everywhere except the main window.
 */
function ensureStylesInjected(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rds-crash-overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .rds-crash-modal {
      background: #16161f; color: #f1f5f9;
      border: 1px solid rgba(139, 92, 246, 0.12); border-radius: 16px;
      width: min(700px, 90vw); max-height: 80vh;
      display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    .rds-crash-header {
      padding: 20px 24px; border-bottom: 1px solid rgba(139, 92, 246, 0.12);
      display: flex; align-items: center; justify-content: space-between;
    }
    .rds-crash-title { margin: 0; font-size: 18px; font-weight: 600; }
    .rds-crash-close {
      width: 28px; height: 28px; background: #1e1e2a; border: none; border-radius: 6px;
      color: #64748b; font-size: 16px; line-height: 1; cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: all 0.15s;
    }
    .rds-crash-close:hover { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
    .rds-crash-body { padding: 24px; overflow-y: auto; flex: 1; }
    .rds-crash-message { margin: 0 0 20px; font-size: 13px; line-height: 1.55; color: #f1f5f9; }
    .rds-crash-section { margin-bottom: 20px; }
    .rds-crash-section:last-child { margin-bottom: 0; }
    .rds-crash-label {
      margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #94a3b8;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .rds-crash-pre {
      margin: 0; padding: 12px 14px; background: #0e0e14; border: 1px solid rgba(139, 92, 246, 0.12);
      border-radius: 8px; white-space: pre-wrap; word-break: break-word;
      font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.5; color: #94a3b8;
      max-height: 220px; overflow-y: auto;
    }
    .rds-crash-env-row { display: flex; gap: 8px; font-size: 13px; line-height: 1.7; }
    .rds-crash-env-row-label { color: #94a3b8; min-width: 110px; }
    .rds-crash-env-row-value { color: #f1f5f9; }
    .rds-crash-placeholder { margin: 0; font-size: 13px; color: #64748b; font-style: italic; }
    .rds-crash-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 16px 24px; border-top: 1px solid rgba(139, 92, 246, 0.12);
    }
    .rds-crash-btn {
      padding: 10px 18px; border-radius: 8px; border: none; font-family: inherit;
      font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.15s;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .rds-crash-btn-secondary { background: #1e1e2a; color: #f1f5f9; border: 1px solid rgba(139, 92, 246, 0.12); }
    .rds-crash-btn-secondary:hover { background: rgba(139, 92, 246, 0.15); border-color: #8b5cf6; }
    .rds-crash-btn-primary { background: #8b5cf6; color: #fff; }
    .rds-crash-btn-primary:hover { background: #7c3aed; }
    .rds-crash-copy-split { position: relative; display: inline-flex; }
    .rds-crash-copy-btn { border-top-right-radius: 0; border-bottom-right-radius: 0; border-right: none; }
    .rds-crash-copy-caret {
      border-top-left-radius: 0; border-bottom-left-radius: 0; border-left: 1px solid rgba(139, 92, 246, 0.12);
      padding-left: 7px; padding-right: 7px; min-width: 30px; justify-content: center;
    }
    .rds-crash-copy-dropdown {
      position: absolute; bottom: calc(100% + 4px); left: 0; z-index: 1;
      min-width: 100%; width: max-content; padding: 4px;
      display: flex; flex-direction: column; gap: 2px;
      background: #1e1e2a; border: 1px solid rgba(139, 92, 246, 0.12); border-radius: 6px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42); box-sizing: border-box;
    }
    .rds-crash-copy-dropdown[hidden] { display: none !important; }
    .rds-crash-copy-dropdown-item {
      display: inline-flex; align-items: center; width: 100%; margin: 0;
      padding: 7px 12px; border: none; border-radius: 4px; background: transparent;
      color: #f1f5f9; font-family: inherit; font-size: 12px; text-align: left;
      white-space: nowrap; cursor: pointer; transition: background 0.15s ease; box-sizing: border-box;
    }
    .rds-crash-copy-dropdown-item:hover { background: rgba(139, 92, 246, 0.15); }
  `;
  document.head.appendChild(style);
}

function envRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'rds-crash-env-row';
  const labelEl = document.createElement('span');
  labelEl.className = 'rds-crash-env-row-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'rds-crash-env-row-value';
  valueEl.textContent = value;
  row.append(labelEl, valueEl);
  return row;
}

function section(label: string, content: HTMLElement): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'rds-crash-section';
  const labelEl = document.createElement('div');
  labelEl.className = 'rds-crash-label';
  labelEl.textContent = label;
  el.append(labelEl, content);
  return el;
}

/** Briefly swaps a button's label to the shared "Copied!" confirmation, then restores it. */
function flashCopied(btn: HTMLButtonElement): void {
  const original = btn.textContent;
  btn.textContent = S.common.copied;
  setTimeout(() => {
    btn.textContent = original;
  }, 1500);
}

export function showCrashReportModal(
  err: CapturedError,
  appInfo: AppInfo | null,
  openExternal: (url: string) => void
): void {
  ensureStylesInjected();

  const title = buildIssueTitle(err);
  const markdownBody = buildIssueBody(err, appInfo);
  const plainCrashInfo = buildPlainCrashInfo(err, appInfo);

  const overlay = document.createElement('div');
  overlay.className = 'rds-crash-overlay';

  const modal = document.createElement('div');
  modal.className = 'rds-crash-modal';
  modal.setAttribute('role', 'alertdialog');
  modal.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'rds-crash-header';
  const heading = document.createElement('h2');
  heading.className = 'rds-crash-title';
  heading.textContent = S.crashReport.title;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'rds-crash-close';
  closeBtn.setAttribute('aria-label', S.common.close);
  closeBtn.title = S.common.close;
  closeBtn.textContent = '×';
  header.append(heading, closeBtn);

  const body = document.createElement('div');
  body.className = 'rds-crash-body';

  const message = document.createElement('p');
  message.className = 'rds-crash-message';
  message.textContent = redactSensitive(err.message);

  const trace = document.createElement('pre');
  trace.className = 'rds-crash-pre';
  trace.textContent = redactSensitive(err.stack);

  const envContent = document.createElement('div');
  envContent.append(
    envRow(S.crashReport.appVersionLabel, appInfo?.version ?? 'unknown'),
    envRow(S.crashReport.platformLabel, `${appInfo?.platform ?? 'unknown'} ${appInfo?.osRelease ?? ''}`.trim()),
    envRow(S.crashReport.windowLabel, err.windowName)
  );

  const stepsContent = document.createElement('p');
  stepsContent.className = 'rds-crash-placeholder';
  stepsContent.textContent = S.crashReport.stepsToReproducePlaceholder;

  body.append(
    message,
    section(S.crashReport.errorSection, trace),
    section(S.crashReport.environmentSection, envContent),
    section(S.crashReport.stepsToReproduce, stepsContent)
  );

  const footer = document.createElement('div');
  footer.className = 'rds-crash-footer';

  const copySplit = document.createElement('div');
  copySplit.className = 'rds-crash-copy-split';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'rds-crash-btn rds-crash-btn-secondary rds-crash-copy-btn';
  copyBtn.textContent = S.crashReport.copyCrashInfo;
  const copyCaret = document.createElement('button');
  copyCaret.type = 'button';
  copyCaret.className = 'rds-crash-btn rds-crash-btn-secondary rds-crash-copy-caret';
  copyCaret.setAttribute('aria-haspopup', 'menu');
  copyCaret.setAttribute('aria-expanded', 'false');
  copyCaret.setAttribute('aria-label', S.crashReport.moreCopyOptions);
  copyCaret.title = S.crashReport.moreCopyOptions;
  copyCaret.textContent = '▾';
  const copyDropdown = document.createElement('div');
  copyDropdown.className = 'rds-crash-copy-dropdown';
  copyDropdown.setAttribute('role', 'menu');
  copyDropdown.hidden = true;
  const copyMarkdownItem = document.createElement('button');
  copyMarkdownItem.type = 'button';
  copyMarkdownItem.className = 'rds-crash-copy-dropdown-item';
  copyMarkdownItem.setAttribute('role', 'menuitem');
  copyMarkdownItem.textContent = S.crashReport.copyAsMarkdown;
  copyDropdown.appendChild(copyMarkdownItem);
  copySplit.append(copyBtn, copyCaret, copyDropdown);

  const reportBtn = document.createElement('button');
  reportBtn.type = 'button';
  reportBtn.className = 'rds-crash-btn rds-crash-btn-primary';
  reportBtn.textContent = S.crashReport.reportOnGithub;

  footer.append(copySplit, reportBtn);

  modal.append(header, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  let disposeBackdrop = (): void => {};
  let disposeEsc = (): void => {};
  let disposeOutsideClick = (): void => {};
  function close(): void {
    disposeBackdrop();
    disposeEsc();
    disposeOutsideClick();
    overlay.remove();
  }
  disposeBackdrop = attachBackdropClickToClose(overlay, close);
  disposeEsc = attachEscToClose(close);

  closeBtn.addEventListener('click', close);
  reportBtn.addEventListener('click', () => openExternal(buildGithubIssueUrl(title, markdownBody)));

  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(plainCrashInfo);
    flashCopied(copyBtn);
  });

  const closeDropdown = (): void => {
    copyDropdown.hidden = true;
    copyCaret.setAttribute('aria-expanded', 'false');
  };
  copyCaret.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = copyDropdown.hidden;
    copyDropdown.hidden = !willOpen;
    copyCaret.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });
  copyMarkdownItem.addEventListener('click', () => {
    void navigator.clipboard.writeText(markdownBody);
    closeDropdown();
    flashCopied(copyBtn);
  });
  const onOutsideClick = (e: MouseEvent): void => {
    if (!copySplit.contains(e.target as Node)) closeDropdown();
  };
  document.addEventListener('click', onOutsideClick);
  disposeOutsideClick = () => document.removeEventListener('click', onOutsideClick);
}

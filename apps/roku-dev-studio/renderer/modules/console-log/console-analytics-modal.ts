/**
 * Console Monitor modal — a read-only breakdown of recognized BrightScript issues in a set of console
 * lines: total issues, per-category tallies, and an expandable list of each issue type with the unique
 * log lines that triggered it.
 *
 * CONTENT-ONLY. The caller passes a `getSnapshot` provider that returns already-computed
 * {@link ConsoleFindings} (plus display meta), NOT raw lines — so the modal has no idea where the
 * findings came from:
 *   - the live telnet Console computes them in-renderer from its resident buffer and calls `refresh()`
 *     as new lines stream in;
 *   - the windowed Log Viewer scans the whole file in the main process and hands over a one-shot
 *     snapshot (no refresh).
 *
 * `computeConsoleFindings` (in the shared catalog) is the single source of truth — the same aggregation
 * backs the `console_monitor_findings` MCP tool.
 */

import { escapeHtml } from '../utils/dom.js';
import { attachBackdropClickToClose } from '../utils/modal-backdrop-click.js';
import type {
  ConsoleFindings,
  ConsoleFinding
} from '@shared/console/brightscript-error-catalog.js';

export interface ConsoleAnalyticsMeta {
  /** Lines actually scanned for findings. */
  bufferedCount: number;
  /** Total lines available; when > bufferedCount the subtitle notes that older lines weren't scanned. */
  totalCount: number;
}

export interface ConsoleAnalyticsSnapshot {
  /** Pre-aggregated findings — the modal renders these verbatim. */
  findings: ConsoleFindings;
  /** How many lines produced the findings (shown as "N issues across M lines"). */
  scannedLines: number;
  /** Optional first/last per-line timestamps for the subtitle's time span (both null → omitted). */
  timeSpan: { first: string | null; last: string | null };
  meta: ConsoleAnalyticsMeta;
}

export interface ConsoleAnalyticsHandle {
  close: () => void;
  /** Re-pull the snapshot and re-render in place (preserving expanded issues + log scroll). */
  refresh: () => void;
}

const ANALYTICS_STYLE_ID = 'console-analytics-modal-styles';

/**
 * Inject the Console Monitor styles once, from here — so the modal carries its own CSS to whichever
 * document opens it (the main window OR the standalone Log Viewer window, which has no shared
 * stylesheet). `.telnet-an-overlay` is made self-sufficient (it does NOT rely on the global
 * `.modal-overlay` base, which the Log Viewer lacks); its values match that base. Mirrors the
 * `ensureFindHighlightStyles` pattern.
 */
function ensureConsoleAnalyticsStyles(): void {
  if (document.getElementById(ANALYTICS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ANALYTICS_STYLE_ID;
  style.textContent = `
    .telnet-an-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
    .telnet-an-modal {
      width: 820px; max-width: 96vw; min-width: 460px; max-height: 88vh; min-height: 260px;
      display: flex; flex-direction: column; background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: 12px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55); overflow: hidden; resize: both;
    }
    .telnet-an-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
    .telnet-an-icon { color: var(--accent-purple); flex: 0 0 auto; display: inline-flex; }
    /* Size the header glyph here so the modal doesn't depend on the host document defining .icon-xl. */
    .telnet-an-icon .icon { font-size: 24px; }
    .telnet-an-title { flex: 1 1 auto; min-width: 0; }
    .telnet-an-title h3 { margin: 0; font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .telnet-an-sub { margin: 2px 0 0; font-size: 11.5px; color: var(--text-secondary); }
    .telnet-an-sub-note { color: var(--text-muted); }
    .telnet-an-close { border: none; background: transparent; color: var(--text-secondary); font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px; flex: 0 0 auto; }
    .telnet-an-close:hover { color: var(--text-primary); }
    .telnet-an-body { flex: 1 1 auto; min-height: 0; padding: 14px 16px; overflow-y: auto; }
    .telnet-an-section { margin-top: 18px; }
    .telnet-an-section:first-child { margin-top: 0; }
    .telnet-an-section h4 { margin: 0 0 9px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
    .telnet-an-empty { margin: 0; font-size: 12px; color: var(--text-secondary); }
    .telnet-an-cats { display: flex; flex-wrap: wrap; gap: 6px; }
    .telnet-an-cat { display: inline-flex; align-items: center; gap: 6px; padding: 3px 6px 3px 10px; font-size: 11.5px; color: var(--text-primary); background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 999px; }
    .telnet-an-cat-count { font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; background: var(--bg-deep); color: var(--text-secondary); border-radius: 999px; padding: 1px 6px; }
    .telnet-an-issue { border: 1px solid var(--border); border-radius: 10px; margin-bottom: 16px; background: var(--bg-tertiary); overflow: hidden; }
    .telnet-an-issue:last-child { margin-bottom: 0; }
    .telnet-an-issue[open] { border-color: var(--border-hover); }
    /* Header row: [count]  message  [copy]  ————  [severity] */
    .telnet-an-issue > summary { display: flex; align-items: center; gap: 10px; padding: 11px 14px; cursor: pointer; list-style: none; }
    .telnet-an-issue > summary::-webkit-details-marker { display: none; }
    .telnet-an-issue > summary:hover { background: var(--bg-secondary); }
    /* When expanded, make the header read as a distinct title bar: a divider + a subtle lighter tint
       (theme-independent; kept off --bg-deep so the count badge, which IS --bg-deep, stays distinct). */
    .telnet-an-issue[open] > summary { background: rgba(255, 255, 255, 0.035); border-bottom: 1px solid var(--border); }
    .telnet-an-issue[open] > summary:hover { background: rgba(255, 255, 255, 0.055); }
    .telnet-an-issue-badge { flex: 0 0 auto; min-width: 24px; text-align: center; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-primary); background: var(--bg-deep); border: 1px solid var(--border-hover); border-radius: 999px; padding: 2px 8px; }
    .telnet-an-issue-title { flex: 0 1 auto; min-width: 0; font-size: 12.5px; color: var(--text-primary); font-family: var(--font-mono, ui-monospace, monospace); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .telnet-an-copy { flex: 0 0 auto; border: none; background: transparent; color: var(--text-muted); cursor: pointer; padding: 3px 5px; border-radius: 5px; display: inline-flex; align-items: center; opacity: 0.7; transition: opacity 0.1s ease; }
    .telnet-an-copy:hover { color: var(--text-primary); background: var(--bg-deep); opacity: 1; }
    .telnet-an-copy.is-copied { color: var(--accent-green, #4ade80); opacity: 1; }
    .telnet-an-sev { flex: 0 0 auto; margin-left: auto; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 2px 8px; border-radius: 999px; }
    .telnet-an-sev.is-error { background: rgba(239, 68, 68, 0.16); color: #fca5a5; }
    .telnet-an-sev.is-warning { background: rgba(251, 191, 36, 0.16); color: var(--accent-amber, #fbbf24); }
    .telnet-an-sev.is-info { background: rgba(59, 130, 246, 0.16); color: #93c5fd; }
    /* Top padding gives the body breathing room below the header divider when expanded. */
    .telnet-an-issue-body { padding: 15px 14px 16px; }
    .telnet-an-issue-kind { margin: 0 0 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    /* Label / value grid — replaces the packed "What: … Cause: …" paragraphs. */
    .telnet-an-meta { display: grid; grid-template-columns: max-content 1fr; gap: 9px 14px; margin: 0; align-items: baseline; }
    .telnet-an-meta dt { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    .telnet-an-meta dd { margin: 0; font-size: 12px; line-height: 1.55; color: var(--text-secondary); }
    .telnet-an-issue-docs { color: var(--accent-purple); text-decoration: none; white-space: nowrap; }
    .telnet-an-issue-docs:hover { text-decoration: underline; }
    .telnet-an-occ-head { margin: 16px 0 7px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    .telnet-an-logs { max-height: 168px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-deep); }
    .telnet-an-log { display: flex; align-items: flex-start; gap: 10px; padding: 7px 10px; border-bottom: 1px solid var(--border); }
    .telnet-an-log:last-child { border-bottom: none; }
    /* Clickable occurrence: jumps to the line in the console/log behind the modal. */
    .telnet-an-log.is-navigable { cursor: pointer; }
    .telnet-an-log.is-navigable:hover { background: rgba(255, 255, 255, 0.05); }
    .telnet-an-log.is-navigable:focus-visible { outline: 1px solid var(--accent-purple); outline-offset: -2px; }
    .telnet-an-log-go { flex: 0 0 auto; align-self: center; color: var(--accent-purple); font-size: 13px; line-height: 1; opacity: 0; transition: opacity 0.1s ease; }
    .telnet-an-log.is-navigable:hover .telnet-an-log-go,
    .telnet-an-log.is-navigable:focus-visible .telnet-an-log-go { opacity: 0.95; }
    .telnet-an-log code { flex: 1 1 auto; min-width: 0; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; line-height: 1.5; color: var(--text-secondary); white-space: pre-wrap; word-break: break-word; }
    .telnet-an-log-loc { flex: 0 0 auto; align-self: flex-start; margin-top: 1px; font-size: 10px; color: var(--text-muted); font-family: var(--font-mono, ui-monospace, monospace); white-space: nowrap; }
    .telnet-an-log-count { flex: 0 0 auto; align-self: flex-start; min-width: 20px; text-align: center; margin-top: 1px; font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-secondary); background: var(--bg-tertiary); border-radius: 999px; padding: 1px 6px; }
    .telnet-an-more { margin: 8px 0 0; font-size: 11px; color: var(--text-muted); }`;
  document.head.appendChild(style);
}

const num = (n: number): string => n.toLocaleString();

/** Copy text to the clipboard — prefer the Web API, fall back to the app's `window.roku` bridge. */
function copyToClipboard(text: string): void {
  if (!text) return;
  try {
    const nav = navigator as Navigator & { clipboard?: { writeText?: (t: string) => Promise<void> } };
    if (nav.clipboard?.writeText) {
      void nav.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fall through to the bridge */
  }
  const roku = (window as unknown as { roku?: { copyToClipboard?: (t: string) => unknown } }).roku;
  roku?.copyToClipboard?.(text);
}

/** Brief "copied" affordance: swap the copy glyph for a check for ~1.2s. */
function flashCopied(btn: HTMLElement): void {
  const original = btn.innerHTML;
  btn.classList.add('is-copied');
  btn.innerHTML = `<span class="icon icon-xs"><svg><use href="#icon-check"/></svg></span>`;
  window.setTimeout(() => {
    if (!btn.isConnected) return; // a refresh may have rebuilt the list
    btn.classList.remove('is-copied');
    btn.innerHTML = original;
  }, 1200);
}

function subtitleHtml(
  f: ConsoleFindings,
  scanned: number,
  span: { first: string | null; last: string | null },
  meta: ConsoleAnalyticsMeta
): string {
  const summary = `${num(f.totalIssues)} issue${f.totalIssues === 1 ? '' : 's'} across ${num(scanned)} line${scanned === 1 ? '' : 's'}`;
  const spill =
    meta.totalCount > meta.bufferedCount
      ? ` <span class="telnet-an-sub-note">(of ${num(meta.totalCount)} captured — older lines spilled to disk aren't scanned)</span>`
      : '';
  const time =
    span.first && span.last
      ? ` <span class="telnet-an-sub-note">· ${escapeHtml(span.first)} – ${escapeHtml(span.last)}</span>`
      : '';
  return `${summary}${spill}${time}`;
}

function categoryChips(f: ConsoleFindings): string {
  const chips = f.byCategory
    .map(
      ({ category, count }) =>
        `<span class="telnet-an-cat"><span class="telnet-an-cat-name">${escapeHtml(category)}</span><span class="telnet-an-cat-count">${num(count)}</span></span>`
    )
    .join('');
  return chips || `<p class="telnet-an-empty">No recognized BrightScript issues. 🎉</p>`;
}

/** Scrollable table of the unique log lines for one issue, most-frequent first. When `navigable`, each
 *  row is a button that jumps to the occurrence's first position in the console/log. */
function issueLogTable(finding: ConsoleFinding, navigable: boolean): string {
  const LINE_CAP = 100;
  const rows = finding.lines
    .slice(0, LINE_CAP)
    .map((l) => {
      const base = l.file ? (l.file.split('/').pop() ?? l.file) : '';
      const loc =
        base !== ''
          ? `<span class="telnet-an-log-loc">${escapeHtml(base)}${l.line !== undefined ? '(' + num(l.line) + ')' : ''}</span>`
          : '';
      const canJump = navigable && l.indices.length > 0;
      // Jump to the FIRST occurrence: for a dedup'd row all positions share the same text, so any is
      // "that occurrence"; the first is the top-to-bottom-reading choice.
      const navAttrs = canJump
        ? ` class="telnet-an-log is-navigable" role="button" tabindex="0" data-nav-index="${l.indices[0]}" title="Go to this line in the log"`
        : ' class="telnet-an-log"';
      const go = canJump ? `<span class="telnet-an-log-go" aria-hidden="true">→</span>` : '';
      return `<div${navAttrs}><code>${escapeHtml(l.message)}</code>${loc}<span class="telnet-an-log-count">${num(l.count)}</span>${go}</div>`;
    })
    .join('');
  const extra = finding.lines.length - LINE_CAP;
  const more =
    extra > 0 ? `<p class="telnet-an-more">+${num(extra)} more unique line${extra === 1 ? '' : 's'}</p>` : '';
  return `<div class="telnet-an-logs" data-issue-id="${escapeHtml(finding.id)}">${rows}</div>${more}`;
}

function issuesList(f: ConsoleFindings, navigable: boolean): string {
  return f.findings
    .map((finding) => {
      const docs = finding.docsUrl
        ? ` <a class="telnet-an-issue-docs" href="${escapeHtml(finding.docsUrl)}" target="_blank" rel="noreferrer">docs ↗</a>`
        : '';
      return (
        `<details class="telnet-an-issue" data-issue-id="${escapeHtml(finding.id)}">` +
        `<summary>` +
        `<span class="telnet-an-issue-badge">${num(finding.count)}</span>` +
        // Header = the REAL extracted message (not the paraphrased catalog title).
        `<span class="telnet-an-issue-title" title="${escapeHtml(finding.message)}">${escapeHtml(finding.message)}</span>` +
        `<button type="button" class="telnet-an-copy" data-copy="${escapeHtml(finding.message)}" title="Copy message" aria-label="Copy error message"><span class="icon icon-xs"><svg><use href="#icon-copy"/></svg></span></button>` +
        `<span class="telnet-an-sev is-${finding.severity}">${escapeHtml(finding.severity)}</span>` +
        `</summary>` +
        `<div class="telnet-an-issue-body">` +
        `<p class="telnet-an-issue-kind">${escapeHtml(finding.category)} · ${escapeHtml(finding.title)}</p>` +
        `<dl class="telnet-an-meta">` +
        `<dt>What</dt><dd>${escapeHtml(finding.meaning)}</dd>` +
        `<dt>Cause</dt><dd>${escapeHtml(finding.cause)}</dd>` +
        `<dt>Fix</dt><dd>${escapeHtml(finding.fix)}${docs}</dd>` +
        `</dl>` +
        `<div class="telnet-an-occ-head">Occurrence${finding.lines.length === 1 ? '' : 's'}</div>` +
        issueLogTable(finding, navigable) +
        `</div>` +
        `</details>`
      );
    })
    .join('');
}

function bodyHtml(f: ConsoleFindings, navigable: boolean): string {
  return (
    `<section class="telnet-an-section">` +
    `<div class="telnet-an-cats">${categoryChips(f)}</div>` +
    `</section>` +
    (f.findings.length > 0
      ? `<section class="telnet-an-section"><h4>Issues</h4>${issuesList(f, navigable)}</section>`
      : '')
  );
}

/**
 * Open the Console Monitor. `getSnapshot` is pulled on open and on every `refresh()`.
 *
 * When `onNavigate` is provided, each occurrence row becomes a button: clicking it closes the modal
 * (it covers the surface, so revealing behind it would be pointless) and calls `onNavigate` with the
 * occurrence's first position — a buffer index for the live Console, a file line for the Log Viewer.
 * The caller maps that position to a view row and reveals it (see `revealAndFlashLine`).
 */
export function openConsoleAnalyticsModal(
  getSnapshot: () => ConsoleAnalyticsSnapshot,
  onClose?: () => void,
  onNavigate?: (index: number) => void
): ConsoleAnalyticsHandle {
  ensureConsoleAnalyticsStyles();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay telnet-an-overlay active';
  overlay.innerHTML = `
    <div class="telnet-an-modal" role="dialog" aria-modal="true" aria-label="Console Monitor">
      <div class="telnet-an-header">
        <span class="telnet-an-icon" aria-hidden="true"><span class="icon icon-xl"><svg><use href="#icon-monitor"/></svg></span></span>
        <div class="telnet-an-title">
          <h3>Console Monitor</h3>
          <p class="telnet-an-sub" data-an-sub></p>
        </div>
        <button type="button" class="telnet-an-close" title="Close" aria-label="Close">×</button>
      </div>
      <div class="telnet-an-body" data-an-body></div>
    </div>`;

  const subEl = overlay.querySelector('[data-an-sub]') as HTMLElement;
  const bodyEl = overlay.querySelector('[data-an-body]') as HTMLElement;

  const render = (): void => {
    const { findings: f, scannedLines, timeSpan, meta } = getSnapshot();
    // Preserve which issues are expanded + each log table's scroll offset across the re-render.
    const openIds = new Set<string>();
    bodyEl.querySelectorAll<HTMLElement>('details.telnet-an-issue[open]').forEach((d) => {
      const id = d.getAttribute('data-issue-id');
      if (id) openIds.add(id);
    });
    const scrolls = new Map<string, number>();
    bodyEl.querySelectorAll<HTMLElement>('.telnet-an-logs').forEach((el) => {
      const id = el.getAttribute('data-issue-id');
      if (id) scrolls.set(id, el.scrollTop);
    });

    subEl.innerHTML = subtitleHtml(f, scannedLines, timeSpan, meta);
    bodyEl.innerHTML = bodyHtml(f, !!onNavigate);

    bodyEl.querySelectorAll<HTMLElement>('details.telnet-an-issue').forEach((d) => {
      const id = d.getAttribute('data-issue-id');
      if (id && openIds.has(id)) (d as HTMLDetailsElement).open = true;
    });
    bodyEl.querySelectorAll<HTMLElement>('.telnet-an-logs').forEach((el) => {
      const id = el.getAttribute('data-issue-id');
      const top = id ? scrolls.get(id) : undefined;
      if (top !== undefined) el.scrollTop = top;
    });
  };

  // Let the user SELECT the issue title without the <summary> toggling the <details> shut. A drag to
  // select fires a click on the summary (whose default action is the toggle); we cancel that toggle
  // when the pointer moved between mousedown and click (a selection), but allow a plain click (a real
  // toggle). Delegated on bodyEl so it survives the live re-renders that rebuild the inner HTML.
  let downX = 0;
  let downY = 0;
  bodyEl.addEventListener('mousedown', (e) => {
    if ((e.target as Element)?.closest?.('summary')) {
      downX = e.clientX;
      downY = e.clientY;
    }
  });
  // Close the modal (it covers the surface) and hand the occurrence's position to the caller to reveal.
  const navigateFromRow = (row: HTMLElement): void => {
    const raw = row.getAttribute('data-nav-index');
    const index = raw !== null ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(index)) return;
    close();
    onNavigate?.(index);
  };

  bodyEl.addEventListener('click', (e) => {
    // Copy button in an issue header — copy the message; don't let the click toggle the <details>.
    const copyBtn = (e.target as Element)?.closest?.('.telnet-an-copy');
    if (copyBtn instanceof HTMLElement) {
      e.preventDefault();
      e.stopPropagation();
      copyToClipboard(copyBtn.getAttribute('data-copy') ?? '');
      flashCopied(copyBtn);
      return;
    }
    // Occurrence row — jump to that line in the console/log.
    const navRow = (e.target as Element)?.closest?.('.telnet-an-log.is-navigable');
    if (navRow instanceof HTMLElement) {
      navigateFromRow(navRow);
      return;
    }
    if (!(e.target as Element)?.closest?.('summary')) return;
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) e.preventDefault();
  });
  // Keyboard activation for the focusable occurrence rows (role="button").
  bodyEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const navRow = (e.target as Element)?.closest?.('.telnet-an-log.is-navigable');
    if (navRow instanceof HTMLElement) {
      e.preventDefault();
      navigateFromRow(navRow);
    }
  });

  document.body.appendChild(overlay);
  render();

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  attachBackdropClickToClose(overlay, close);
  overlay.querySelector('.telnet-an-close')?.addEventListener('click', close);

  return {
    close,
    refresh: () => {
      if (!closed) render();
    }
  };
}

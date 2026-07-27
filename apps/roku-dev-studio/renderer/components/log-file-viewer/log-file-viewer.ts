import { setConsoleViewerModalTitlePrefix } from '../../modules/console-log/console-modal-title.js';
import { mountConsoleLogSurface } from '../../modules/console-log/mount-console-log-surface.js';
import { buildConsoleFindBarElement } from '../../modules/console-log/console-find-bar-markup.js';
import { openConsoleAnalyticsModal } from '../../modules/console-log/console-analytics-modal.js';
import { revealAndFlashLine } from '../../modules/console-log/reveal-occurrence.js';
import type { ConsoleFindings } from '@shared/console/brightscript-error-catalog.js';
import { consoleDisplayText } from '../../modules/console-log/console-line-parser.js';
import type { ConsoleFindOptions } from '../../modules/console-log/console-find-helpers.js';
import { createLogFileWindowModel } from './log-file-window-model.js';
import { makeCenteredSearchResizable } from '../../modules/ui/header-search-resize.js';
import { searchWidthKey } from '../../modules/ui/search-storage-keys.js';
import { inMemorySessionStore } from '../../modules/ui/in-memory-storage.js';
import { S, applyI18n } from '@shared/strings/index.js';
import { initLocaleForWindow } from '../../modules/utils/locale-live.js';

/**
 * Local typed view of `window.roku` for this renderer window. Declared as a
 * file-local cast (not `declare global`) because the main window has a
 * different (broader) `roku` surface from `renderer-globals.d.ts`, and a
 * conflicting global `Window.roku` declaration in this file would override
 * that and break the Console panel's IPC bridges. See `log-viewer-preload.ts`
 * for the IPC shape.
 *
 * **Load model: windowed.** We ask main to index the file (`prepareLogViewerFile`)
 * and then pull only the byte range around the viewport (`readLogViewerRange` /
 * `readLogViewerLines`) as the user scrolls, so the whole file never lives in
 * this renderer's heap. Find / Filter run whole-file in main
 * (`searchLogViewerFile`). See `log-file-window-model.ts`.
 */
type LogViewerRokuApi = {
  prepareLogViewerFile: () => Promise<{
    success: boolean;
    fileName?: string;
    fileSize?: number;
    lineCount?: number;
    encoding?: string;
    error?: string;
  }>;
  readLogViewerRange: (
    startLine: number,
    endLine: number
  ) => Promise<{ success: boolean; startLine?: number; endLine?: number; lines?: string[]; error?: string }>;
  readLogViewerLines: (
    lines: number[]
  ) => Promise<{ success: boolean; lines?: Array<{ line: number; text: string }>; error?: string }>;
  scanLogViewerFindings: () => Promise<{
    success: boolean;
    findings?: ConsoleFindings;
    scannedLines?: number;
    truncated?: boolean;
    superseded?: boolean;
    error?: string;
  }>;
  searchLogViewerFile: (
    query: string,
    options: ConsoleFindOptions
  ) => Promise<{
    success: boolean;
    hits?: Array<{ line: number; start: number; end: number }>;
    matchLines?: number[];
    truncated?: boolean;
    superseded?: boolean;
    error?: string;
  }>;
  copyToClipboard: (text: string) => Promise<unknown>;
  openExternal: (url: string) => Promise<unknown>;
};

const rokuApi = window.roku as unknown as LogViewerRokuApi;

async function main() {
  // Localize the static log-file-viewer.html shell.
  applyI18n(document);
  // Apply the active locale on open + retranslate live on change.
  void initLocaleForWindow(window.roku as unknown as Parameters<typeof initLocaleForWindow>[0]);
  const statusEl = document.getElementById('logViewerStatus');
  const titleEl = document.getElementById('logViewerTitle');
  const outputEl = document.getElementById('logViewerOutput');
  const headerEl = document.getElementById('logViewerHeader');
  const findHostEl = document.getElementById('logViewerFindHost');
  const actionsEl = document.getElementById('logViewerActions');
  const copyBtn = actionsEl?.querySelector<HTMLButtonElement>('.log-viewer-copy-btn') ?? null;
  const monitorBtn = actionsEl?.querySelector<HTMLButtonElement>('.log-viewer-monitor-btn') ?? null;

  if (!(outputEl instanceof HTMLElement)) return;

  let lineCount = 0;

  function setStatus(message: string, isError = false): void {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle('log-viewer-status--error', isError);
  }

  /**
   * Brief, transient feedback in the status row (Cmd+A / Copy). The line-count
   * caption is restored after a short delay.
   */
  function flashStatus(message: string): void {
    if (!statusEl) return;
    const prev = statusEl.textContent ?? '';
    const wasError = statusEl.classList.contains('log-viewer-status--error');
    statusEl.textContent = message;
    statusEl.classList.remove('log-viewer-status--error');
    window.setTimeout(() => {
      statusEl.textContent = prev;
      if (wasError) statusEl.classList.add('log-viewer-status--error');
    }, 1500);
  }

  setStatus(S.logFileViewer.indexing);
  // Inject the find bar from the shared builder (same markup source as the Console panel). No
  // Alt+ shortcut hints here — this standalone window doesn't bind them.
  if (findHostEl && !findHostEl.querySelector('.telnet-find-bar')) {
    findHostEl.appendChild(buildConsoleFindBarElement());
  }
  findHostEl?.removeAttribute('hidden');
  if (actionsEl) actionsEl.removeAttribute('hidden');

  let res: Awaited<ReturnType<typeof rokuApi.prepareLogViewerFile>>;
  try {
    res = await rokuApi.prepareLogViewerFile();
  } catch (e: unknown) {
    setStatus(e instanceof Error ? e.message : S.logFileViewer.couldNotLoadFile, true);
    return;
  }
  if (!res.success) {
    setStatus(res.error || S.logFileViewer.couldNotLoadFile, true);
    return;
  }

  if (res.fileName) {
    setConsoleViewerModalTitlePrefix(res.fileName);
    if (titleEl) titleEl.textContent = res.fileName;
    document.title = S.logFileViewer.documentTitle(res.fileName);
  }
  lineCount = res.lineCount ?? 0;

  const model = createLogFileWindowModel({
    lineCount,
    fileSize: res.fileSize ?? 0,
    readRange: async (startLine, endLine) => {
      const r = await rokuApi.readLogViewerRange(startLine, endLine);
      return r.success ? (r.lines ?? []) : null;
    },
    readLines: async (lines) => {
      const r = await rokuApi.readLogViewerLines(lines);
      return r.success ? (r.lines ?? []) : null;
    },
    scrollToTop: () => {
      outputEl.scrollTop = 0;
    }
  });

  /**
   * Build the export text for Copy / Cmd+A. Windowing means the whole file
   * isn't resident, so we read it back from main on demand: the entire file in
   * Find mode, or just the matching lines when a Filter is active. Text is
   * run through `consoleDisplayText` so it matches what's on screen (ANSI
   * stripped, long lines truncated) — same as the old in-memory copy path.
   */
  async function buildExportText(): Promise<string> {
    const spec = model.exportSpec();
    if (spec.kind === 'lines') {
      if (spec.lines.length === 0) return '';
      const rows = await rokuApi.readLogViewerLines(spec.lines);
      if (!rows.success || !rows.lines) return '';
      return rows.lines.map((r) => consoleDisplayText(r.text)).join('\n');
    }
    if (lineCount === 0) return '';
    const r = await rokuApi.readLogViewerRange(0, lineCount);
    if (!r.success || !r.lines) return '';
    return r.lines.map((line) => consoleDisplayText(line)).join('\n');
  }

  async function copyExport(feedbackPrefix: string): Promise<void> {
    let text: string;
    try {
      text = await buildExportText();
    } catch {
      flashStatus(S.logFileViewer.copyFailed);
      return;
    }
    if (!text) {
      flashStatus(S.logFileViewer.nothingToCopy);
      return;
    }
    try {
      await rokuApi.copyToClipboard(text);
      flashStatus(feedbackPrefix);
    } catch {
      flashStatus(S.logFileViewer.copyFailed);
    }
  }

  const surface = mountConsoleLogSurface({
    outputEl,
    entries: model.entries,
    findBarHost: headerEl,
    // Standalone window → per-window history (cleared when the window closes).
    historyStorage: inMemorySessionStore,
    onRangeChange: (start, end) => model.ensureWindow(start, end),
    remoteSearch: async (query, options) => {
      const r = await rokuApi.searchLogViewerFile(query, options);
      if (!r.success || r.superseded) return null;
      return {
        hits: (r.hits ?? []).map((h) => ({ lineIndex: h.line, start: h.start, end: h.end })),
        matchLines: r.matchLines ?? [],
        truncated: !!r.truncated
      };
    },
    onFilterLinesChange: (matchLines) => model.setFilter(matchLines),
    onSelectAll: () => void copyExport(S.logFileViewer.copiedEntireLog)
  });
  model.bindSurface(surface);
  // Centered, drag-to-resize behavior for the find bar in the header.
  if (findHostEl instanceof HTMLElement && headerEl instanceof HTMLElement) {
    makeCenteredSearchResizable(findHostEl, {
      storageKey: searchWidthKey('logviewer'),
      storage: inMemorySessionStore,
      header: headerEl,
      leftGroupSelector: '.log-viewer-header-primary',
      rightGroupSelector: '#logViewerActions',
      minWidthPx: 420
    });
  }
  // Kick the first window load explicitly. The virtualizer's initial layout
  // normally fires onRangeChange (which loads the top window), but if the
  // scroll area reports zero height on first paint no range fires — this
  // guarantees content regardless. Redundant loads are deduped by the model's
  // load token, so at worst this costs one extra read.
  model.ensureWindow(0, Math.min(64, lineCount));

  setStatus(S.logFileViewer.linesCount(lineCount));

  copyBtn?.addEventListener('click', () => void copyExport(S.logFileViewer.copiedToClipboard));

  // Console Monitor: scan the whole file in main, then open the shared analytics modal with the
  // findings. Static file → one-shot snapshot, no live refresh. The scan supersedes itself in main,
  // so a rapid re-click just repaints with the latest result.
  let monitorFindings: ConsoleFindings | null = null;
  let monitorScanned = 0;
  monitorBtn?.addEventListener('click', () => {
    if (monitorBtn.disabled) return;
    monitorBtn.disabled = true;
    flashStatus(S.logFileViewer.scanningForIssues);
    void rokuApi
      .scanLogViewerFindings()
      .then((r) => {
        if (!r.success || r.superseded || !r.findings) {
          if (!r.superseded) flashStatus(r.error || S.logFileViewer.scanFailed);
          return;
        }
        monitorFindings = r.findings;
        monitorScanned = r.scannedLines ?? lineCount;
        openConsoleAnalyticsModal(
          () => ({
            findings: monitorFindings ?? { totalIssues: 0, issueTypeCount: 0, byCategory: [], findings: [], crashes: [] },
            scannedLines: monitorScanned,
            timeSpan: { first: null, last: null },
            meta: { bufferedCount: monitorScanned, totalCount: monitorScanned }
          }),
          undefined,
          // Findings carry 0-based file line numbers (from the whole-file scan). Map to a view row
          // (identity in normal mode; the filter position when a filter is active) and reveal it.
          (fileLine) => {
            const viewIndex = model.fileLineToViewIndex(fileLine);
            if (viewIndex === null) return;
            revealAndFlashLine(surface.view, viewIndex);
          }
        );
      })
      .finally(() => {
        monitorBtn.disabled = false;
      });
  });
}

void main();

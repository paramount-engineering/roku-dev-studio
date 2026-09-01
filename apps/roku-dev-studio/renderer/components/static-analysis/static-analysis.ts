/**
 * Static Channel Analysis window renderer.
 *
 * UI flow:
 *   1. Preload exposes `window.staticAnalysis.*`.
 *   2. On load we call `ensureTool()` and `checkJava()` in parallel; `onToolStatus` carries live
 *      progress (checking → downloading → ready/error) for the duration of `ensureTool()`.
 *   3. The user picks (or drags in) a channel `.zip`; Analyze is enabled once the tool is ready,
 *      Java is available, and a file is selected.
 *   4. `run()` returns a `runId` immediately; `onProgress` streams stdout/stderr into the Terminal
 *      tab while it runs, `onRunResult` carries the terminal outcome (a parsed report, or raw
 *      output as a fallback — Roku doesn't document the report's JSON schema, so it's read
 *      defensively) and populates the Results tab + the "View JSON" modal.
 */

import { S, applyI18n } from '@shared/strings/index.js';
import { initLocaleForWindow } from '../../modules/utils/locale-live.js';
import { rendererError } from '../../modules/utils/logger.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { attachModalResize } from '../../modules/utils/modal-resize.js';
import { renderStructuredInto, attachFoldToggle, structuredBodyText, detectStructuredKind } from '../../modules/ui/structured-body.js';
import { resolveCertRequirementUrl } from './cert-requirements-map.js';
import { installCrashCapture } from '../../modules/errors/install.js';

export {};

interface ScaToolStatus {
  type: 'idle' | 'checking' | 'downloading' | 'ready' | 'error';
  etag?: string;
  updated?: boolean;
  error?: { code: string; message: string; httpStatus?: number };
}

interface JavaStatus {
  available: boolean;
  versionString?: string;
  majorVersion?: number;
  error?: { code: string; message: string };
}

interface StaticAnalysisRunResult {
  runId: string;
  report?: unknown;
  reportPath?: string;
  rawStdout?: string;
  rawStderr?: string;
  exitCode?: number | null;
  signal?: string | null;
  timedOut?: boolean;
  cancelled?: boolean;
  error?: { code: string; message: string };
}

interface StaticAnalysisBridge {
  ensureTool: (opts?: { force?: boolean }) => Promise<ScaToolStatus>;
  checkJava: () => Promise<JavaStatus>;
  chooseFile: () => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>;
  resolveDroppedFile: (file: File) => string | null;
  run: (payload: { inputPath: string; severity?: string; categories?: string[] }) => Promise<{ success: boolean; runId?: string; error?: string }>;
  cancelRun: (payload: { runId: string }) => Promise<{ success: boolean }>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  getSetting: (key: string) => Promise<{ success: boolean; value?: unknown }>;
  getAppInfo: () => Promise<{ version: string; platform: string; osRelease: string }>;
  saveTextFile: (opts: { content: string; defaultName?: string; dialogTitle?: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  onToolStatus: (cb: (status: ScaToolStatus) => void) => () => void;
  onProgress: (cb: (data: { runId: string; stream: 'stdout' | 'stderr'; text: string }) => void) => () => void;
  onRunResult: (cb: (data: StaticAnalysisRunResult) => void) => () => void;
  getLocale?: () => Promise<unknown>;
  onLocaleChanged?: (cb: (pref: string) => void) => unknown;
}

declare global {
  interface Window {
    staticAnalysis?: StaticAnalysisBridge;
  }
}

function getBridge(): StaticAnalysisBridge {
  const bridge = window.staticAnalysis;
  if (!bridge) throw new Error('window.staticAnalysis bridge is not available (preload failed).');
  return bridge;
}

installCrashCapture({
  windowName: 'static-analysis',
  getSetting: (key) => getBridge().getSetting(key),
  getAppInfo: () => getBridge().getAppInfo(),
  openExternal: (url) => getBridge().openExternal(url)
});

function q<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Static Analysis: missing element ${selector}`);
  return el;
}

const els = {
  toolStatus: q<HTMLElement>('#scaToolStatus'),
  toolStatusText: q<HTMLElement>('#scaToolStatus .sca-status-text'),
  toolRetryBtn: q<HTMLButtonElement>('#scaToolRetryBtn'),
  toolInfoBtn: q<HTMLButtonElement>('#scaToolInfoBtn'),
  javaStatus: q<HTMLElement>('#scaJavaStatus'),
  javaStatusText: q<HTMLElement>('#scaJavaStatus .sca-status-text'),
  javaInfoBtn: q<HTMLButtonElement>('#scaJavaInfoBtn'),
  toolInfoModalOverlay: q<HTMLElement>('#scaToolInfoModalOverlay'),
  toolInfoModalCloseBtn: q<HTMLButtonElement>('#scaToolInfoModalCloseBtn'),
  javaInfoModalOverlay: q<HTMLElement>('#scaJavaInfoModalOverlay'),
  javaInfoModalCloseBtn: q<HTMLButtonElement>('#scaJavaInfoModalCloseBtn'),
  javaInfoRequired: q<HTMLElement>('#scaJavaInfoRequired'),
  javaInfoDetected: q<HTMLElement>('#scaJavaInfoDetected'),
  javaInfoLink: q<HTMLAnchorElement>('#scaJavaInfoLink'),
  dropzone: q<HTMLElement>('#scaDropzone'),
  selectedFileInfo: q<HTMLElement>('#scaSelectedFileInfo'),
  fileName: q<HTMLElement>('#scaFileName'),
  clearFileBtn: q<HTMLButtonElement>('#scaClearFileBtn'),
  optionsCard: q<HTMLElement>('#scaOptionsCard'),
  severityPanel: q<HTMLElement>('#scaSeverityPanel'),
  categories: q<HTMLElement>('#scaCategories'),
  analyzeBtn: q<HTMLButtonElement>('#scaAnalyzeBtn'),
  cancelBtn: q<HTMLButtonElement>('#scaCancelBtn'),
  analyzingLabel: q<HTMLElement>('#scaAnalyzingLabel'),
  tabTerminal: q<HTMLButtonElement>('#scaTabTerminal'),
  tabTable: q<HTMLButtonElement>('#scaTabTable'),
  panelTerminal: q<HTMLElement>('#scaPanelTerminal'),
  panelTable: q<HTMLElement>('#scaPanelTable'),
  consoleOutput: q<HTMLElement>('#scaConsoleOutput'),
  summaryChips: q<HTMLElement>('#scaSummaryChips'),
  categoryFilter: q<HTMLSelectElement>('#scaCategoryFilter'),
  resultNote: q<HTMLElement>('#scaResultNote'),
  resultsTableBody: q<HTMLElement>('#scaResultsTableBody'),
  viewJsonBtn: q<HTMLButtonElement>('#scaViewJsonBtn'),
  jsonModalOverlay: q<HTMLElement>('#scaJsonModalOverlay'),
  jsonModalBody: q<HTMLElement>('#scaJsonModalBody'),
  jsonModalSaveBtn: q<HTMLButtonElement>('#scaJsonModalSaveBtn'),
  jsonModalCopyBtn: q<HTMLButtonElement>('#scaJsonModalCopyBtn'),
  jsonModalCloseBtn: q<HTMLButtonElement>('#scaJsonModalCloseBtn')
};

let toolReady = false;
let javaOk = false;
let selectedFilePath: string | null = null;
let currentRunId: string | null = null;
/** Text shown by the "View JSON" modal — the parsed report pretty-printed, or raw output when no
 *  report was produced. Kept as a plain variable rather than re-reading a hidden DOM node. */
let lastJsonModalText = '';

/** Full, unfiltered rows from the most recent run — the Severity chips / Category select filter
 *  which of these render into the table, without re-running the tool (mirrors Roku's own web
 *  dashboard, which lets you filter an already-completed report the same way). */
let allIssueRows: ScaIssueRow[] = [];
let activeSeverityFilter: string | null = null;
let activeCategoryFilter = '';

function syncAnalyzeEnabled(): void {
  els.analyzeBtn.disabled = !(toolReady && javaOk && !!selectedFilePath && !currentRunId);
}

function setToolStatus(status: ScaToolStatus): void {
  els.toolStatus.dataset.state = status.type;
  els.toolRetryBtn.hidden = status.type !== 'error';
  toolReady = status.type === 'ready';
  switch (status.type) {
    case 'checking':
      els.toolStatusText.textContent = S.staticAnalysis.toolStatusChecking;
      break;
    case 'downloading':
      els.toolStatusText.textContent = S.staticAnalysis.toolStatusDownloading;
      break;
    case 'ready':
      els.toolStatusText.textContent = status.updated ? S.staticAnalysis.toolStatusReadyUpdated : S.staticAnalysis.toolStatusReady;
      break;
    case 'error': {
      const title = status.error ? (S.staticAnalysis.errorTitles as Record<string, string>)[status.error.code] : undefined;
      const detail = status.error?.message ?? '';
      els.toolStatusText.textContent = S.staticAnalysis.toolStatusError(title ? `${title}: ${detail}` : detail);
      break;
    }
    default:
      break;
  }
  syncAnalyzeEnabled();
}

/** Empirically confirmed (twice) against the real sca-cmd.jar: it's compiled for class file
 *  version 65, i.e. Java 21. Soft warning only — Roku doesn't publish a minimum and a future
 *  build could lower it, so this never blocks Analyze, it just steers the user away from
 *  repeating the same "downloaded an old Java" mistake before they hit a run failure. */
const MIN_JAVA_MAJOR = 21;

/** `versionString` is the JVM's raw banner line, e.g. `openjdk version "21.0.12" 2026-07-21 LTS` —
 *  pull just the quoted version number for the compact header badge; the full banner still shows
 *  in the info modal. */
function shortJavaVersion(status: JavaStatus): string {
  const quoted = status.versionString ? /"([^"]+)"/.exec(status.versionString) : null;
  if (quoted) return quoted[1]!;
  return typeof status.majorVersion === 'number' ? String(status.majorVersion) : '';
}

function setJavaStatus(status: JavaStatus): void {
  javaOk = status.available;
  const tooOld = status.available && typeof status.majorVersion === 'number' && status.majorVersion < MIN_JAVA_MAJOR;
  els.javaStatus.dataset.state = !status.available ? 'error' : tooOld ? 'warning' : 'ready';
  if (!status.available) {
    els.javaStatusText.textContent = S.staticAnalysis.javaMissing;
  } else {
    const v = shortJavaVersion(status);
    els.javaStatusText.textContent = v ? S.staticAnalysis.javaVersionLabel(v) : S.staticAnalysis.javaAvailable('');
  }
  els.javaInfoRequired.textContent = S.staticAnalysis.javaInfoRequiredValue;
  els.javaInfoDetected.textContent = status.available
    ? status.versionString ?? S.staticAnalysis.javaAvailable('')
    : S.staticAnalysis.javaMissing;
  syncAnalyzeEnabled();
}

async function initToolAndJava(force = false): Promise<void> {
  const bridge = getBridge();
  setToolStatus({ type: 'checking' });
  els.javaStatus.dataset.state = 'checking';
  els.javaStatusText.textContent = S.staticAnalysis.javaChecking;
  const [toolStatus, javaStatus] = await Promise.all([
    bridge.ensureTool({ force }).catch(
      (e): ScaToolStatus => ({ type: 'error', error: { code: 'spawn-failed', message: e instanceof Error ? e.message : String(e) } })
    ),
    bridge.checkJava().catch((e): JavaStatus => ({ available: false, error: { code: 'java-check-failed', message: e instanceof Error ? e.message : String(e) } }))
  ]);
  setToolStatus(toolStatus);
  setJavaStatus(javaStatus);
}

function setSelectedFile(path: string | null): void {
  selectedFilePath = path;
  // Dropzone and "file selected" bar crossfade in the same slot (see .sca-file-slot) rather than
  // both being visible/hidden via the `hidden` attribute, so picking/clearing a file never shifts
  // the rest of the card.
  els.dropzone.classList.toggle('is-hidden', !!path);
  els.selectedFileInfo.classList.toggle('is-hidden', !path);
  if (path) {
    els.fileName.textContent = path.split(/[\\/]/).pop() ?? path;
    els.fileName.title = path;
  }
  syncAnalyzeEnabled();
}

function readSeverity(): string {
  return els.severityPanel.querySelector('.sca-severity-btn.is-active')?.getAttribute('data-severity') ?? 'warning';
}

function readCategories(): string[] | undefined {
  const boxes = Array.from(els.categories.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  const checked = boxes.filter((b) => b.checked).map((b) => b.value);
  // All checked (the default) means "no filter" — omit the list entirely rather than spelling
  // out every category; only a genuinely narrowed selection is sent.
  return checked.length === boxes.length ? undefined : checked;
}

function appendConsole(text: string): void {
  els.consoleOutput.textContent += text;
  els.consoleOutput.scrollTop = els.consoleOutput.scrollHeight;
}

function switchTab(tab: 'terminal' | 'table'): void {
  const showTerminal = tab === 'terminal';
  els.tabTerminal.classList.toggle('is-active', showTerminal);
  els.tabTerminal.setAttribute('aria-selected', String(showTerminal));
  els.panelTerminal.classList.toggle('is-active', showTerminal);
  els.tabTable.classList.toggle('is-active', !showTerminal);
  els.tabTable.setAttribute('aria-selected', String(!showTerminal));
  els.panelTable.classList.toggle('is-active', !showTerminal);
}

interface ScaDocLink {
  url: string;
  alias?: string;
}

/** One row the results table can render, extracted defensively from an undocumented JSON shape. */
interface ScaIssueRow {
  severity: string;
  category: string;
  message: string;
  location: string;
  certRequirements?: string[];
  documentationUrls?: ScaDocLink[];
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v) return v;
    if (typeof v === 'number') return String(v);
  }
  return '';
}

/** Roku doesn't document the report schema — try the confirmed real shape (a top-level `logs`
 *  array) first, then a few other plausible container keys/shapes as a fallback, and read each
 *  entry's likely fields by name rather than assuming one exact structure. */
function extractIssues(report: unknown): ScaIssueRow[] {
  let list: unknown[] | null = null;
  if (Array.isArray(report)) {
    list = report;
  } else if (report && typeof report === 'object') {
    const obj = report as Record<string, unknown>;
    for (const key of ['logs', 'issues', 'results', 'findings', 'violations', 'items']) {
      if (Array.isArray(obj[key])) {
        list = obj[key] as unknown[];
        break;
      }
    }
  }
  if (!list) return [];
  return list
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const file = pickString(item, ['file', 'filePath', 'path', 'fileName']);
      const line = pickString(item, ['line', 'lineNumber']);
      const certRequirements = Array.isArray(item.certRequirements)
        ? item.certRequirements.filter((c): c is string => typeof c === 'string')
        : undefined;
      const documentationUrls = Array.isArray(item.documentationUrls)
        ? item.documentationUrls
            .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object' && typeof d.url === 'string')
            .map((d): ScaDocLink => ({ url: d.url as string, alias: typeof d.alias === 'string' ? d.alias : undefined }))
        : undefined;
      return {
        severity: pickString(item, ['severity', 'level', 'type']).toLowerCase() || 'info',
        category: pickString(item, ['category', 'categoryName', 'rule', 'ruleId']),
        message: pickString(item, ['message', 'description', 'msg', 'text']),
        location: file ? (line ? `${file}:${line}` : file) : '',
        ...(certRequirements && certRequirements.length > 0 ? { certRequirements } : {}),
        ...(documentationUrls && documentationUrls.length > 0 ? { documentationUrls } : {})
      };
    });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Populate the Category `<select>` from whatever category strings actually appear in this
 *  report (free-form text from the tool, not the fixed 7 `-c` CLI buckets — real reports contain
 *  values like "billing"/"authentication" that aren't among those 7). */
function populateCategoryFilter(rows: ScaIssueRow[]): void {
  const categories = Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  els.categoryFilter.innerHTML = [`<option value="">${escapeHtml(S.staticAnalysis.allCategoriesOption)}</option>`]
    .concat(categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`))
    .join('');
  els.categoryFilter.disabled = categories.length === 0;
  els.categoryFilter.value = '';
}

function buildRowsHtml(rows: ScaIssueRow[]): string {
  return rows
    .map((row, i) => {
      const hasDetail = !!(row.certRequirements?.length || row.documentationUrls?.length);
      const expandCell = hasDetail
        ? `<button type="button" class="sca-row-expand-btn" data-row-index="${i}" title="${escapeHtml(S.staticAnalysis.expandDetailsTitle)}"></button>`
        : '';
      const mainRow = `<tr class="${hasDetail ? 'sca-has-detail' : ''}" data-row-index="${i}">
        <td class="sca-th-expand">${expandCell}</td>
        <td><span class="sca-severity-badge ${row.severity}">${row.severity}</span></td>
        <td>${escapeHtml(row.category)}</td>
        <td>${escapeHtml(row.message)}</td>
        <td>${escapeHtml(row.location)}</td>
      </tr>`;
      if (!hasDetail) return mainRow;
      // 4-column label/value grid — Cert Requirements | value | Documentation | value. When
      // only one of the two is present, its pair is the only thing pushed, so it simply lands
      // in the first two columns rather than leaving two empty ones.
      const cols: string[] = [];
      if (row.certRequirements?.length) {
        cols.push(
          `<div class="sca-detail-label">${escapeHtml(S.staticAnalysis.certRequirementsLabel)}</div>`,
          `<div class="sca-detail-value">${row.certRequirements
            .map((c) => {
              const url = resolveCertRequirementUrl(c);
              return url
                ? `<a href="${escapeHtml(url)}" class="sca-cert-chip" target="_blank" rel="noreferrer">${escapeHtml(c)}</a>`
                : `<span class="sca-cert-chip">${escapeHtml(c)}</span>`;
            })
            .join('')}</div>`
        );
      }
      if (row.documentationUrls?.length) {
        cols.push(
          `<div class="sca-detail-label">${escapeHtml(S.staticAnalysis.documentationLabel)}</div>`,
          `<div class="sca-detail-value">${row.documentationUrls
            .map((d) => `<a href="${escapeHtml(d.url)}" class="sca-doc-link" target="_blank" rel="noreferrer">${escapeHtml(d.alias || d.url)}</a>`)
            .join('')}</div>`
        );
      }
      const detailRow = `<tr class="sca-detail-row"><td class="sca-detail-cell" colspan="5"><div class="sca-detail-grid">${cols.join('')}</div></td></tr>`;
      return mainRow + detailRow;
    })
    .join('');
}

/** Re-renders the chips + table from `allIssueRows` against the current filter state — never
 *  re-runs the tool. Chips always reflect the FULL (unfiltered) counts and double as severity
 *  toggles; the Category `<select>` narrows further. Mirrors Roku's own web dashboard, which lets
 *  you filter an already-completed report the same way. */
function renderFilteredTable(): void {
  const counts = { error: 0, warning: 0, info: 0 } as Record<string, number>;
  for (const row of allIssueRows) counts[row.severity] = (counts[row.severity] ?? 0) + 1;
  const chip = (severity: string, cls: string, label: string): string =>
    `<button type="button" class="sca-chip ${cls}${severity === activeSeverityFilter ? ' is-active' : ''}" data-severity="${severity}">${label}</button>`;
  els.summaryChips.classList.toggle('has-active-filter', !!activeSeverityFilter);
  els.summaryChips.innerHTML = [
    counts.error ? chip('error', 'sca-chip-error', S.staticAnalysis.summaryErrors(counts.error)) : '',
    counts.warning ? chip('warning', 'sca-chip-warning', S.staticAnalysis.summaryWarnings(counts.warning)) : '',
    counts.info ? chip('info', 'sca-chip-info', S.staticAnalysis.summaryInfo(counts.info)) : ''
  ].join('');

  const visibleRows = allIssueRows.filter(
    (row) => (!activeSeverityFilter || row.severity === activeSeverityFilter) && (!activeCategoryFilter || row.category === activeCategoryFilter)
  );
  if (visibleRows.length === 0) {
    els.resultNote.hidden = false;
    els.resultNote.textContent = S.staticAnalysis.noFilterMatchNote;
    els.resultsTableBody.innerHTML = '';
  } else {
    els.resultNote.hidden = true;
    els.resultsTableBody.innerHTML = buildRowsHtml(visibleRows);
  }
}

function renderResults(result: StaticAnalysisRunResult): void {
  els.resultNote.hidden = true;
  els.summaryChips.innerHTML = '';
  els.summaryChips.classList.remove('has-active-filter');
  els.resultsTableBody.innerHTML = '';
  allIssueRows = result.report ? extractIssues(result.report) : [];
  activeSeverityFilter = null;
  activeCategoryFilter = '';

  lastJsonModalText = result.report
    ? JSON.stringify(result.report, null, 2)
    : (result.rawStdout || '') + (result.rawStderr ? `\n${result.rawStderr}` : '');
  els.viewJsonBtn.disabled = !lastJsonModalText;

  const realFailure = result.error && result.error.code !== 'report-missing' && result.error.code !== 'report-malformed';
  if (realFailure) {
    // A genuine failure (crash, timeout, cancel, incompatible Java, …) — show the classified
    // error instead of the generic "no report" note. Raw stdout/stderr already streamed into
    // the Terminal tab, which is where the user's attention already is by default.
    const title = result.error ? (S.staticAnalysis.errorTitles as Record<string, string>)[result.error.code] : undefined;
    els.resultNote.hidden = false;
    els.resultNote.textContent = title ? `${title}: ${result.error!.message}` : result.error!.message;
    return;
  }

  if (!result.report) {
    els.resultNote.hidden = false;
    els.resultNote.textContent =
      result.error?.code === 'report-malformed' ? S.staticAnalysis.malformedReportNote : S.staticAnalysis.noReportFallbackNote;
  } else if (allIssueRows.length === 0) {
    els.resultNote.hidden = false;
    els.resultNote.textContent = S.staticAnalysis.noIssuesFound;
  } else {
    populateCategoryFilter(allIssueRows);
    renderFilteredTable();
  }
}

function setRunning(running: boolean): void {
  els.analyzeBtn.hidden = running;
  els.cancelBtn.hidden = !running;
  els.analyzingLabel.hidden = !running;
  if (!running) currentRunId = null;
  // Lock Severity/Categories for the duration of a run — changing them wouldn't affect the
  // analysis already in flight, so leaving them live just invites a mismatch between what's
  // shown and what was actually passed to `run()`.
  els.optionsCard.classList.toggle('is-locked', running);
  els.severityPanel.querySelectorAll<HTMLButtonElement>('.sca-severity-btn').forEach((b) => {
    b.disabled = running;
  });
  els.categories.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((c) => {
    c.disabled = running;
  });
  syncAnalyzeEnabled();
}

async function startAnalysis(): Promise<void> {
  if (!selectedFilePath) return;
  const bridge = getBridge();
  els.consoleOutput.textContent = '';
  els.summaryChips.innerHTML = '';
  els.resultsTableBody.innerHTML = '';
  els.resultNote.hidden = true;
  els.viewJsonBtn.disabled = true;
  lastJsonModalText = '';
  switchTab('terminal');
  currentRunId = 'pending';
  setRunning(true);

  const res = await bridge.run({ inputPath: selectedFilePath, severity: readSeverity(), categories: readCategories() });
  if (!res.success || !res.runId) {
    setRunning(false);
    const title = res.error ? (S.staticAnalysis.errorTitles as Record<string, string>)[res.error] : undefined;
    appendConsole(`\n${title ?? S.staticAnalysis.runFailed(res.error ?? '')}\n`);
    return;
  }
  currentRunId = res.runId;
}

function wireFilePicker(): void {
  els.dropzone.addEventListener('click', async () => {
    const res = await getBridge().chooseFile();
    if (res.success && res.path) setSelectedFile(res.path);
  });
  els.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.dropzone.click();
    }
  });
  els.clearFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setSelectedFile(null);
  });

  els.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropzone.classList.add('sca-dropzone-active');
  });
  els.dropzone.addEventListener('dragleave', () => {
    els.dropzone.classList.remove('sca-dropzone-active');
  });
  els.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropzone.classList.remove('sca-dropzone-active');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const path = getBridge().resolveDroppedFile(file);
    if (path && /\.zip$/i.test(path)) setSelectedFile(path);
  });
}

/** Shared open/close wiring for the two plain-content info modals (About the Analysis Tool /
 *  About the Java Requirement) — no resize/collapse, just backdrop-click + Escape + close button. */
function wireInfoModal(overlay: HTMLElement, closeBtn: HTMLButtonElement, openBtns: HTMLButtonElement[]): void {
  const close = (): void => {
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
  };
  const open = (): void => {
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
  };
  openBtns.forEach((btn) => btn.addEventListener('click', open));
  closeBtn.addEventListener('click', close);
  attachBackdropClickToClose(overlay, close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close();
  });
}

function wireToolAndJava(): void {
  els.toolRetryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    void initToolAndJava(true);
  });
  wireInfoModal(els.toolInfoModalOverlay, els.toolInfoModalCloseBtn, [els.toolInfoBtn]);
  wireInfoModal(els.javaInfoModalOverlay, els.javaInfoModalCloseBtn, [els.javaInfoBtn]);
  els.javaInfoLink.addEventListener('click', (e) => {
    e.preventDefault();
    void getBridge().openExternal('https://adoptium.net/temurin/releases/?version=21');
  });
}

function wireSeverityPanel(): void {
  els.severityPanel.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement | null)?.closest('.sca-severity-btn');
    if (!(btn instanceof HTMLElement)) return;
    els.severityPanel.querySelectorAll('.sca-severity-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
  });
}

function wireTabs(): void {
  els.tabTerminal.addEventListener('click', () => switchTab('terminal'));
  els.tabTable.addEventListener('click', () => switchTab('table'));
}

function wireAnalyze(): void {
  els.analyzeBtn.addEventListener('click', () => void startAnalysis());
  els.cancelBtn.addEventListener('click', async () => {
    if (!currentRunId || currentRunId === 'pending') return;
    await getBridge().cancelRun({ runId: currentRunId });
  });
}

/** Delegated clicks on the results table body: expand/collapse the cert-requirements +
 *  documentation detail row. The cert/documentation links themselves are plain
 *  `target="_blank"` anchors (same as the Console Monitor's docs links) — with no
 *  `setWindowOpenHandler` registered anywhere in this app, Electron's default behavior opens
 *  those in their own in-app window rather than the system browser, so no click handling is
 *  needed here at all. */
function wireResultsTable(): void {
  els.resultsTableBody.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const expandBtn = target?.closest('.sca-row-expand-btn');
    if (expandBtn instanceof HTMLElement) {
      const row = expandBtn.closest('tr');
      if (!row) return;
      const nowExpanded = row.classList.toggle('is-expanded');
      expandBtn.title = nowExpanded ? S.staticAnalysis.collapseDetailsTitle : S.staticAnalysis.expandDetailsTitle;
    }
  });
}

/** Severity chips + Category select both re-filter `allIssueRows` client-side — no re-run. A
 *  chip click toggles: clicking the already-active severity clears back to "all". */
function wireResultsFilters(): void {
  els.summaryChips.addEventListener('click', (e) => {
    const chipEl = (e.target as HTMLElement | null)?.closest('.sca-chip');
    if (!(chipEl instanceof HTMLElement)) return;
    const severity = chipEl.getAttribute('data-severity');
    activeSeverityFilter = activeSeverityFilter === severity ? null : severity;
    renderFilteredTable();
  });
  els.categoryFilter.addEventListener('change', () => {
    activeCategoryFilter = els.categoryFilter.value;
    renderFilteredTable();
  });
}

function wireJsonModal(): void {
  const modalEl = els.jsonModalOverlay.querySelector('.modal');
  if (modalEl instanceof HTMLElement) attachModalResize(modalEl);
  attachFoldToggle(els.jsonModalBody);

  const close = (): void => {
    els.jsonModalOverlay.hidden = true;
    els.jsonModalOverlay.setAttribute('aria-hidden', 'true');
  };
  const open = (): void => {
    renderStructuredInto(els.jsonModalBody, lastJsonModalText);
    els.jsonModalOverlay.hidden = false;
    els.jsonModalOverlay.setAttribute('aria-hidden', 'false');
  };

  els.viewJsonBtn.addEventListener('click', open);
  els.jsonModalCloseBtn.addEventListener('click', close);
  attachBackdropClickToClose(els.jsonModalOverlay, close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.jsonModalOverlay.hidden) close();
  });
  els.jsonModalCopyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(structuredBodyText(els.jsonModalBody));
  });
  els.jsonModalSaveBtn.addEventListener('click', async () => {
    const content = structuredBodyText(els.jsonModalBody);
    const ext = detectStructuredKind(content) === 'json' ? 'json' : 'txt';
    await getBridge().saveTextFile({
      content,
      defaultName: `sca-report-${Date.now()}.${ext}`,
      dialogTitle: S.staticAnalysis.saveJsonDialogTitle
    });
  });
}

function wireBridgeEvents(): void {
  const bridge = getBridge();
  bridge.onToolStatus((status) => setToolStatus(status));
  bridge.onProgress((data) => {
    // The main process can emit progress (e.g. the command echo) before the `run()` invoke
    // resolves and assigns the real runId here — adopt it from the first event instead of
    // dropping everything sent while we're still holding the 'pending' placeholder.
    if (currentRunId === 'pending') currentRunId = data.runId;
    if (data.runId !== currentRunId) return;
    appendConsole(data.text);
  });
  bridge.onRunResult((result) => {
    if (currentRunId === 'pending') currentRunId = result.runId;
    if (result.runId !== currentRunId) return;
    setRunning(false);
    renderResults(result);
  });
}

async function main(): Promise<void> {
  applyI18n(document);
  try {
    await initLocaleForWindow(window.staticAnalysis);
  } catch {
    /* keep the default locale if the query fails */
  }

  wireFilePicker();
  wireToolAndJava();
  wireSeverityPanel();
  wireTabs();
  wireAnalyze();
  wireResultsTable();
  wireResultsFilters();
  wireJsonModal();
  wireBridgeEvents();
  setSelectedFile(null);

  try {
    await initToolAndJava();
  } catch (e) {
    rendererError('[StaticAnalysis] init failed:', e);
  }
}

void main();

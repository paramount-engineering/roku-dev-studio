/**
 * UI strings for the Console log surfaces: the shared find/filter bar (live telnet Console +
 * standalone Log Viewer), the formatted JSON/XML and URL viewer modals, the Console Monitor
 * (analytics) modal, and the structured-syntax fold controls.
 *
 * Parametrized strings are functions returning the composed text — the standard way to keep
 * interpolation translatable without a runtime format library. A few values are consumed inside
 * `innerHTML` templates (the modal shells), so they render as plain text just as any other leaf.
 */
export const consoleLog = {
  // ── Shared viewer modal chrome (console-modal-title.ts, structured + URL modals) ──────
  /** Default title prefix for the JSON/XML/URL viewer modals ("Console: JSON"). */
  titlePrefix: 'Console',
  jsonLabel: 'JSON',
  xmlLabel: 'XML',
  jsonPlusLabel: 'JSON+',
  urlLabel: 'URL',
  /** Transient button feedback after copying (plain text, no glyph — distinct from common.copied). */
  copied: 'Copied',

  // ── Fold twisty (console-structured-syntax.ts) ────────────────────────────────────────
  collapse: 'Collapse',
  expand: 'Expand',

  // ── Structured JSON/XML viewer modal (console-structured-view-modal.ts) ───────────────
  copyFormattedTitle: 'Copy Formatted Text',
  hintJsonFullNested: 'Click to view the full JSON for this line. Use JSON+ for nested fragments only.',
  hintJsonFormatted: 'Click to view formatted JSON (opens in a modal)',
  hintXmlFull: 'Click to view the full XML for this line.',
  hintXmlFormatted: 'Click to view formatted XML (opens in a modal)',
  hintPillNestedJson: 'Nested JSON only (from an escaped string). Does not open the full outer JSON.',
  hintPillFullJson: 'Full JSON for this line (click the line text for the same).',

  // ── URL viewer modal (console-url-modal.ts) ───────────────────────────────────────────
  openInBrowser: 'Open in Browser',
  openInBrowserTitle: 'Open in Default Browser',
  copyUrlTitle: 'Copy URL',
  fullUrlAria: 'Full URL',
  queryParamsAria: 'Query Parameters',
  colKey: 'Key',
  colValue: 'Value',
  couldNotParseParams: 'Could not parse parameters.',
  noQueryParams: 'No query parameters.',
  parameterSet: (n: number): string => `Parameter Set ${n}`,

  // ── Inline URL span (console-url-detect.ts) ───────────────────────────────────────────
  urlSpanTitle: 'Click to preview in a Modal · ⌘ or Ctrl+Click to open in Browser',

  // ── Find/filter bar markup (console-find-bar-markup.ts) ───────────────────────────────
  modeSelectAria: 'Find or filter mode',
  modeFind: 'Find',
  modeFilter: 'Filter',
  queryPlaceholder: 'Find...',
  queryAria: 'Find or filter query',
  // Option-button tooltips: `alt` appends the (Alt+…) shortcut hint the main window binds.
  // The aria-label reuses the same text with `alt=false` (no shortcut suffix).
  optMatchCaseTitle: (alt: boolean): string => `Match Case${alt ? ' (Alt+C)' : ''}`,
  optWholeWordTitle: (alt: boolean): string => `Match Whole Word${alt ? ' (Alt+W)' : ''}`,
  optRegexTitle: (alt: boolean): string => `Use Regular Expression${alt ? ' (Alt+R)' : ''}`,
  prevTitle: 'Previous (Shift+Enter)',
  prevAria: 'Previous Match',
  nextTitle: 'Next (Enter)',
  nextAria: 'Next Match',
  clearAria: 'Clear find',

  // ── Find/filter bar runtime (console-find-bar.ts) ─────────────────────────────────────
  regexSuggestTitle: 'This looks like a regular expression — click to search by regex',
  searchingPct: (pct: number): string => `Searching... ${pct}%`,
  noResults: 'No Results',
  matchPosition: (current: number, total: number): string => `${current} of ${total}`,
  firstMatchesNote: ' (First Matches)',
  highlightsCappedNote: ' (Highlights Capped)',
  searchingSuffix: (pct: number): string => ` (searching ${pct}%)`,
  searchingRemote: 'Searching…',
  filteringRemote: 'Filtering…',
  searchFailed: 'Search failed',
  filterFailed: 'Filter failed',
  linesMatched: (n: number, capped: boolean): string =>
    `${n.toLocaleString()} lines${capped ? ' (capped)' : ''}`,

  // ── Console Monitor / analytics modal (console-analytics-modal.ts) ────────────────────
  monitorTitle: 'Console Monitor',
  noRecognizedIssues: 'No recognized BrightScript issues. 🎉',
  sectionCrashes: 'Crashes',
  sectionIssues: 'Issues',
  labelWhat: 'What',
  labelCause: 'Cause',
  labelFix: 'Fix',
  docsLink: 'docs ↗',
  copyMessageTitle: 'Copy Message',
  copyMessageAria: 'Copy Error Message',
  goToLineTitle: 'Go to this line in the log',
  goToCrashTitle: 'Go to this crash in the log',
  copyCrashTitle: 'Copy Crash + Backtrace',
  copyCrashAria: 'Copy Crash and Backtrace',
  backtraceHead: 'Backtrace',
  noBacktrace:
    'The channel exited from a BrightScript crash; no backtrace was captured in this console output.',
  crashKindLabel: 'Crash',
  // Crash severity badge (rendered uppercase via CSS; kept lowercase to mirror the data-driven
  // severity tokens on the non-crash issue badges).
  severityCrash: 'crash',
  // Crash card annotations: "exited" badge and inline "runtime error <code>" (both lowercase; the
  // badge is uppercased by CSS, the code annotation reads inline).
  exitedLabel: 'exited',
  exitedTitle: 'The channel process exited',
  runtimeErrorLabel: 'runtime error',
  crashCount: (n: number): string => `${n.toLocaleString()} crash${n === 1 ? '' : 'es'}`,
  issuesAcrossLines: (issues: number, lines: number): string =>
    `${issues.toLocaleString()} issue${issues === 1 ? '' : 's'} across ${lines.toLocaleString()} line${lines === 1 ? '' : 's'}`,
  spillNote: (total: number): string =>
    `(of ${total.toLocaleString()} captured — older lines spilled to disk aren't scanned)`,
  occurrences: (n: number): string => `Occurrence${n === 1 ? '' : 's'}`,
  moreUniqueLines: (n: number): string =>
    `+${n.toLocaleString()} more unique line${n === 1 ? '' : 's'}`,
} as const;

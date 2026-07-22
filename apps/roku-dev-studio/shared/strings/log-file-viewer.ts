/**
 * UI strings for the standalone Log Viewer window
 * (renderer/components/log-file-viewer/log-file-viewer.ts).
 *
 * Status-row captions, copy/scan feedback, and the window title. Parametrized
 * strings are functions returning the composed text.
 */
export const logFileViewer = {
  indexing: 'Indexing…',
  couldNotLoadFile: 'Could not load file',
  /** Window/document title; `♦` is the app's title separator glyph. */
  documentTitle: (fileName: string): string => `Log Viewer ♦ ${fileName}`,
  linesCount: (n: number): string => `${n.toLocaleString()} lines`,

  // Copy feedback
  copyFailed: 'Copy failed',
  nothingToCopy: 'Nothing to copy',
  copiedToClipboard: 'Copied to clipboard',
  copiedEntireLog: 'Copied entire log to clipboard',

  // Console Monitor scan feedback
  scanningForIssues: 'Scanning for issues…',
  scanFailed: 'Scan failed',

  // Static log-file-viewer.html header actions (button captions + tooltips)
  monitorBtn: 'Monitor',
  monitorBtnTitle: 'Console Monitor — scan this file for recognized BrightScript issues',
  copyBtnTitle: 'Copy filtered log content to clipboard',
} as const;

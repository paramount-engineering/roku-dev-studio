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

  // Window/document title (main-process BrowserWindow + static <title>)
  /** Base document/window title before a file name is known. */
  windowTitle: 'Logs',
  /** OS window title once a file name is known (main-process BrowserWindow). */
  windowTitleWithFile: (fileName: string): string => `Logs — ${fileName}`,
  /** `#logViewerTitle` <h1> default before JS sets it to the opened file's name. */
  defaultTitle: 'Log file',

  // Open-file error dialog (main process)
  openErrorTitle: 'Open Log File',

  // IPC.LogViewerPrepare guard errors (shown in the viewer). `maxGb` stays a
  // bare number to match the original interpolation.
  fileTooLargeError: (currentGb: number, maxGb: number): string =>
    `File is too large (${currentGb} GB). Maximum is ${maxGb} GB.`,
  tooManyLinesError: (maxLines: string): string =>
    `File has too many lines (over ${maxLines}). Try splitting it.`,
} as const;

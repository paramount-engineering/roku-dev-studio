/**
 * Romanian (ro) translation of the standalone Log Viewer window strings
 * (renderer/components/log-file-viewer/log-file-viewer.ts).
 *
 * Status-row captions, copy/scan feedback, and the window title. Count-driven
 * text uses the Romanian singular/plural + "de" rule.
 */
export const logFileViewer = {
  indexing: 'Se indexează…',
  couldNotLoadFile: 'Fișierul nu a putut fi încărcat',
  /** Window/document title; `♦` is the app's title separator glyph. */
  documentTitle: (fileName: string): string => `Vizualizator jurnale ♦ ${fileName}`,
  linesCount: (n: number): string => {
    const word =
      n === 1 ? 'linie' :
      n % 100 === 0 || n % 100 >= 20 ? 'de linii' :
      'linii';
    return `${n.toLocaleString()} ${word}`;
  },

  // Copy feedback
  copyFailed: 'Copierea a eșuat',
  nothingToCopy: 'Nimic de copiat',
  copiedToClipboard: 'Copiat în clipboard',
  copiedEntireLog: 'Întregul jurnal a fost copiat în clipboard',

  // Console Monitor scan feedback
  scanningForIssues: 'Se scanează pentru probleme…',
  scanFailed: 'Scanarea a eșuat',

  // Static log-file-viewer.html header actions (button captions + tooltips)
  monitorBtn: 'Monitor',
  monitorBtnTitle: 'Console Monitor — scanează acest fișier pentru probleme BrightScript recunoscute',
  copyBtnTitle: 'Copiază conținutul filtrat al jurnalului în clipboard',

  // Window/document title (main-process BrowserWindow + static <title>)
  /** Base document/window title before a file name is known. */
  windowTitle: 'Jurnale',
  /** OS window title once a file name is known (main-process BrowserWindow). */
  windowTitleWithFile: (fileName: string): string => `Jurnale — ${fileName}`,
  /** `#logViewerTitle` <h1> default before JS sets it to the opened file's name. */
  defaultTitle: 'Fișier jurnal',

  // Open-file error dialog (main process)
  openErrorTitle: 'Deschide fișierul jurnal',

  // IPC.LogViewerPrepare guard errors (shown in the viewer). `maxGb` stays a
  // bare number to match the original interpolation.
  fileTooLargeError: (currentGb: number, maxGb: number): string =>
    `Fișierul este prea mare (${currentGb} GB). Maximul este ${maxGb} GB.`,
  tooManyLinesError: (maxLines: string): string =>
    `Fișierul are prea multe linii (peste ${maxLines}). Încercați să îl împărțiți.`,
};

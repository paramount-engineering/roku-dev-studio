/**
 * Polish (pl) translation of the standalone Log Viewer window strings
 * (renderer/components/log-file-viewer/log-file-viewer.ts).
 *
 * Status-row captions, copy/scan feedback, and the window title. Count-driven
 * text uses the Polish 3-form plural.
 */
export const logFileViewer = {
  indexing: 'Indeksowanie…',
  couldNotLoadFile: 'Nie udało się załadować pliku',
  /** Window/document title; `♦` is the app's title separator glyph. */
  documentTitle: (fileName: string): string => `Przeglądarka dzienników ♦ ${fileName}`,
  linesCount: (n: number): string => {
    const word =
      n === 1 ? 'wiersz' :
      n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'wiersze' :
      'wierszy';
    return `${n.toLocaleString()} ${word}`;
  },

  // Copy feedback
  copyFailed: 'Kopiowanie nie powiodło się',
  nothingToCopy: 'Nie ma czego kopiować',
  copiedToClipboard: 'Skopiowano do schowka',
  copiedEntireLog: 'Skopiowano cały dziennik do schowka',

  // Console Monitor scan feedback
  scanningForIssues: 'Skanowanie w poszukiwaniu problemów…',
  scanFailed: 'Skanowanie nie powiodło się',

  // Static log-file-viewer.html header actions (button captions + tooltips)
  monitorBtn: 'Monitor',
  monitorBtnTitle: 'Console Monitor — przeskanuj ten plik pod kątem rozpoznanych problemów BrightScript',
  copyBtnTitle: 'Kopiuj przefiltrowaną zawartość dziennika do schowka',

  // Window/document title (main-process BrowserWindow + static <title>)
  /** Base document/window title before a file name is known. */
  windowTitle: 'Dzienniki',
  /** OS window title once a file name is known (main-process BrowserWindow). */
  windowTitleWithFile: (fileName: string): string => `Dzienniki — ${fileName}`,
  /** `#logViewerTitle` <h1> default before JS sets it to the opened file's name. */
  defaultTitle: 'Plik dziennika',

  // Open-file error dialog (main process)
  openErrorTitle: 'Otwórz plik dziennika',

  // IPC.LogViewerPrepare guard errors (shown in the viewer). `maxGb` stays a
  // bare number to match the original interpolation.
  fileTooLargeError: (currentGb: number, maxGb: number): string =>
    `Plik jest za duży (${currentGb} GB). Maksimum to ${maxGb} GB.`,
  tooManyLinesError: (maxLines: string): string =>
    `Plik ma za dużo wierszy (ponad ${maxLines}). Spróbuj go podzielić.`,
};

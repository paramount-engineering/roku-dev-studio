/**
 * Ukrainian (uk) translation of the standalone Log Viewer window strings
 * (renderer/components/log-file-viewer/log-file-viewer.ts).
 *
 * Status-row captions, copy/scan feedback, and the window title. Count-driven
 * text uses the Ukrainian 3-form plural.
 */
export const logFileViewer = {
  indexing: 'Індексування…',
  couldNotLoadFile: 'Не вдалося завантажити файл',
  /** Window/document title; `♦` is the app's title separator glyph. */
  documentTitle: (fileName: string): string => `Переглядач журналів ♦ ${fileName}`,
  linesCount: (n: number): string => {
    const word =
      n % 10 === 1 && n % 100 !== 11 ? 'рядок' :
      n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'рядки' :
      'рядків';
    return `${n.toLocaleString()} ${word}`;
  },

  // Copy feedback
  copyFailed: 'Не вдалося скопіювати',
  nothingToCopy: 'Немає чого копіювати',
  copiedToClipboard: 'Скопійовано в буфер обміну',
  copiedEntireLog: 'Увесь журнал скопійовано в буфер обміну',

  // Console Monitor scan feedback
  scanningForIssues: 'Пошук проблем…',
  scanFailed: 'Сканування не вдалося',

  // Static log-file-viewer.html header actions (button captions + tooltips)
  monitorBtn: 'Monitor',
  monitorBtnTitle: 'Console Monitor — просканувати цей файл на відомі проблеми BrightScript',
  copyBtnTitle: 'Копіювати відфільтрований вміст журналу в буфер обміну',

  // Window/document title (main-process BrowserWindow + static <title>)
  /** Base document/window title before a file name is known. */
  windowTitle: 'Журнали',
  /** OS window title once a file name is known (main-process BrowserWindow). */
  windowTitleWithFile: (fileName: string): string => `Журнали — ${fileName}`,
  /** `#logViewerTitle` <h1> default before JS sets it to the opened file's name. */
  defaultTitle: 'Файл журналу',

  // Open-file error dialog (main process)
  openErrorTitle: 'Відкрити файл журналу',

  // IPC.LogViewerPrepare guard errors (shown in the viewer). `maxGb` stays a
  // bare number to match the original interpolation.
  fileTooLargeError: (currentGb: number, maxGb: number): string =>
    `Файл завеликий (${currentGb} ГБ). Максимум — ${maxGb} ГБ.`,
  tooManyLinesError: (maxLines: string): string =>
    `Файл має забагато рядків (понад ${maxLines}). Спробуйте розділити його.`,
};

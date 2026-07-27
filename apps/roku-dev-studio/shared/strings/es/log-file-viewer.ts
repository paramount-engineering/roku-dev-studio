/**
 * UI strings for the standalone Log Viewer window
 * (renderer/components/log-file-viewer/log-file-viewer.ts). Latin American Spanish.
 *
 * Status-row captions, copy/scan feedback, and the window title.
 */
export const logFileViewer = {
  indexing: 'Indexando…',
  couldNotLoadFile: 'No se pudo cargar el archivo',
  /** Window/document title; `♦` is the app's title separator glyph. */
  documentTitle: (fileName: string): string => `Visor de registros ♦ ${fileName}`,
  linesCount: (n: number): string => `${n.toLocaleString()} líneas`,

  // Copy feedback
  copyFailed: 'La copia falló',
  nothingToCopy: 'Nada que copiar',
  copiedToClipboard: 'Copiado al portapapeles',
  copiedEntireLog: 'Se copió todo el registro al portapapeles',

  // Console Monitor scan feedback
  scanningForIssues: 'Escaneando en busca de problemas…',
  scanFailed: 'El escaneo falló',

  // Static log-file-viewer.html header actions (button captions + tooltips)
  monitorBtn: 'Monitor',
  monitorBtnTitle: 'Console Monitor — escanear este archivo en busca de problemas reconocidos de BrightScript',
  copyBtnTitle: 'Copiar el contenido filtrado del registro al portapapeles',

  // Window/document title (main-process BrowserWindow + static <title>)
  /** Base document/window title before a file name is known. */
  windowTitle: 'Registros',
  /** OS window title once a file name is known (main-process BrowserWindow). */
  windowTitleWithFile: (fileName: string): string => `Registros — ${fileName}`,
  /** `#logViewerTitle` <h1> default before JS sets it to the opened file's name. */
  defaultTitle: 'Archivo de registro',

  // Open-file error dialog (main process)
  openErrorTitle: 'Abrir archivo de registro',

  // IPC.LogViewerPrepare guard errors (shown in the viewer). `maxGb` stays a
  // bare number to match the original interpolation.
  fileTooLargeError: (currentGb: number, maxGb: number): string =>
    `El archivo es demasiado grande (${currentGb} GB). El máximo es ${maxGb} GB.`,
  tooManyLinesError: (maxLines: string): string =>
    `El archivo tiene demasiadas líneas (más de ${maxLines}). Intente dividirlo.`,
};

/**
 * UI strings for the standalone Log Viewer window
 * (renderer/components/log-file-viewer/log-file-viewer.ts).
 *
 * Status-row captions, copy/scan feedback, and the window title. Parametrized
 * strings are functions returning the composed text.
 */
export const logFileViewer = {
  indexing: 'Indexando…',
  couldNotLoadFile: 'Não foi possível carregar o arquivo',
  /** Window/document title; `♦` is the app's title separator glyph. */
  documentTitle: (fileName: string): string => `Visualizador de logs ♦ ${fileName}`,
  linesCount: (n: number): string => `${n.toLocaleString()} linhas`,

  // Copy feedback
  copyFailed: 'Falha ao copiar',
  nothingToCopy: 'Nada para copiar',
  copiedToClipboard: 'Copiado para a área de transferência',
  copiedEntireLog: 'Log inteiro copiado para a área de transferência',

  // Console Monitor scan feedback
  scanningForIssues: 'Verificando problemas…',
  scanFailed: 'Falha na verificação',

  // Static log-file-viewer.html header actions (button captions + tooltips)
  monitorBtn: 'Monitorar',
  monitorBtnTitle: 'Console Monitor — verifique neste arquivo os problemas reconhecidos do BrightScript',
  copyBtnTitle: 'Copiar o conteúdo filtrado do log para a área de transferência',

  // Window/document title (main-process BrowserWindow + static <title>)
  /** Base document/window title before a file name is known. */
  windowTitle: 'Logs',
  /** OS window title once a file name is known (main-process BrowserWindow). */
  windowTitleWithFile: (fileName: string): string => `Logs — ${fileName}`,
  /** `#logViewerTitle` <h1> default before JS sets it to the opened file's name. */
  defaultTitle: 'Arquivo de log',

  // Open-file error dialog (main process)
  openErrorTitle: 'Abrir arquivo de log',

  // IPC.LogViewerPrepare guard errors (shown in the viewer). `maxGb` stays a
  // bare number to match the original interpolation.
  fileTooLargeError: (currentGb: number, maxGb: number): string =>
    `O arquivo é muito grande (${currentGb} GB). O máximo é ${maxGb} GB.`,
  tooManyLinesError: (maxLines: string): string =>
    `O arquivo tem linhas demais (mais de ${maxLines}). Tente dividi-lo.`,
};

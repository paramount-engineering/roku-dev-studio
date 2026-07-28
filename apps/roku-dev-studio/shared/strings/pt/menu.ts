/**
 * pt-BR (Brazilian Portuguese) translation of shared/strings/menu.ts.
 * UI strings for the native application menu (macOS menu bar / Win+Linux File-Edit-View
 * strip), built in the main process (`main.ts`). Migrated out of inline literals so the
 * menu is catalog-driven and can be rebuilt in another locale. Role-based items (undo,
 * copy, reload, …) get their labels from Electron and are not listed here.
 */
export const menu = {
  // macOS app menu + File
  about: 'Sobre o Roku Dev Studio',
  settings: 'Configurações',
  file: 'Arquivo',
  developerMode: 'Modo de desenvolvedor',
  privacyMode: 'Modo de privacidade',
  debugLogging: 'Registro de depuração',
  openDiagnosticLogsFolder: 'Abrir pasta de logs de diagnóstico',
  openLogFile: 'Abrir arquivo de log',
  openNetworkSession: 'Abrir sessão de rede',
  openFiddle: 'Abrir Fiddle',
  openActionScriptsViewer: 'Visualizar e gerenciar Action Scripts',
  checkForUpdates: 'Verificar atualizações',
  clearCacheAndReload: 'Limpar cache e recarregar',
  // Edit / View / Window / Help
  edit: 'Editar',
  view: 'Visualizar',
  actualSize: 'Tamanho real',
  zoomIn: 'Ampliar',
  zoomInAlt: 'Ampliar (=)',
  zoomOut: 'Reduzir',
  window: 'Janela',
  help: 'Ajuda',
  // Open-file dialogs launched from the File menu (sentence case — dialog titles)
  openLogFileDialogTitle: 'Abrir arquivo de log',
  openNetworkSessionDialogTitle: 'Abrir sessão de rede',
  filterLogAndText: 'Log e texto',
  filterNetworkSession: 'Sessão de rede',
  filterAllFiles: 'Todos os arquivos',
};

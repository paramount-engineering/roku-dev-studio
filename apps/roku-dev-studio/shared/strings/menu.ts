/**
 * UI strings for the native application menu (macOS menu bar / Win+Linux File-Edit-View
 * strip), built in the main process (`main.ts`). Migrated out of inline literals so the
 * menu is catalog-driven and can be rebuilt in another locale. Role-based items (undo,
 * copy, reload, …) get their labels from Electron and are not listed here.
 */
export const menu = {
  // macOS app menu + File
  about: 'About Roku Dev Studio',
  settings: 'Settings',
  file: 'File',
  developerMode: 'Developer Mode',
  privacyMode: 'Privacy Mode',
  debugLogging: 'Debug Logging',
  openDiagnosticLogsFolder: 'Open Diagnostic Logs Folder',
  openLogFile: 'Open Log File',
  openNetworkSession: 'Open Network Session',
  openFiddle: 'Open Fiddle',
  openActionScriptsViewer: 'View and Manage Action Scripts',
  checkForUpdates: 'Check for Updates',
  clearCacheAndReload: 'Clear Cache and Reload',
  // Edit / View / Window / Help
  edit: 'Edit',
  view: 'View',
  actualSize: 'Actual Size',
  zoomIn: 'Zoom In',
  zoomInAlt: 'Zoom In (=)',
  zoomOut: 'Zoom Out',
  window: 'Window',
  help: 'Help',
  // Open-file dialogs launched from the File menu (sentence case — dialog titles)
  openLogFileDialogTitle: 'Open log file',
  openNetworkSessionDialogTitle: 'Open network session',
  filterLogAndText: 'Log & text',
  filterNetworkSession: 'Network session',
  filterAllFiles: 'All files',
} as const;

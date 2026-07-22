/**
 * UI strings for the BrightScript Fiddle window
 * (renderer/components/fiddle/fiddle.ts).
 *
 * Parametrized strings are functions returning the composed text — the standard way
 * to keep interpolation translatable without a runtime format library. Status-line
 * wording (Running… / Run complete. / etc.) and diagnostic counts are preserved
 * verbatim; only their letter-casing convention is honoured.
 */
export const fiddle = {
  // Device dropdown
  selectDevice: 'Select a device',
  noDevices: 'No Dev Mode–enabled devices found',
  deviceFallbackName: 'Roku',
  remotePrefix: '[Remote] ',

  // Diagnostics status chip (bottom of the editor)
  noIssues: 'No Issues',
  diagWarnings: (warnCount: number): string => `${warnCount} Warning${warnCount === 1 ? '' : 's'}`,
  diagErrors: (errCount: number, warnCount: number): string =>
    `${errCount} Error${errCount === 1 ? '' : 's'}${warnCount ? `, ${warnCount} Warning${warnCount === 1 ? '' : 's'}` : ''}`,

  // Password modal
  passwordRequired: 'Password is required.',

  // Run / Stop status line
  selectDeviceFirst: 'Select a device first.',
  deviceUnavailable: 'Selected device is no longer available.',
  runCancelledPassword: 'Run cancelled — password required.',
  running: 'Running...',
  runFailed: 'Run failed.',
  runFailedWith: (msg: string): string => `Run failed: ${msg}`,
  sideloadWaiting: 'Sideload complete — waiting for output…',
  runningOnDevice: 'Running on device…',
  runComplete: 'Run complete.',
  editorReset: 'Editor reset to default Snippet.',
  uninstalling: 'Uninstalling...',
  channelRemoved: 'BrightScript Fiddle channel removed.',
  stopFailed: 'Stop failed.',
  ready: 'Ready.',

  // Reset-code confirm
  resetConfirm: 'Reset the editor to the default Snippet? Unsaved changes will be lost.',

  // Editor bootstrap status
  loadingEditor: 'Loading editor...',
  editorFailedToLoad: (msg: string): string => `Editor failed to load: ${msg}`,

  // Monaco command-palette / context-menu action
  runOnDevice: 'Run on device',

  // Static fiddle.html shell — header, device picker, panes, status row
  heading: 'BrightScript Fiddle',
  subtitle: 'Run a quick BrightScript snippet on any connected device.',
  deviceLabel: 'Device',
  scanForDevices: 'Scan for Devices',
  runBtn: 'Run',
  runBtnTitle: 'Run (⌘/Ctrl+Enter)',
  stopBtn: 'Stop',
  stopBtnTitle: 'Uninstall Fiddle Channel',
  codeLabel: 'Code',
  resetSnippetTitle: 'Reset to default Snippet',
  resetSnippetAria: 'Reset editor to default Snippet',
  terminalLabel: 'Terminal',
  clearTerminal: 'Clear Terminal',
  statusRowCaption: 'Run replaces the currently sideloaded channel on the selected device.',

  // Developer-password modal
  passwordModalTitle: 'Developer Password Required',
  passwordModalHint:
    "Sideloading requires the device's developer password—the one you set when enabling Developer Mode.",
  passwordLabel: 'Password',
  passwordPlaceholder: 'Enter Developer Password',
  passwordModalHintMuted:
    'This password is used only for this session. To save it for future use, verify Developer Mode in the main window.',
  passwordSubmitBtn: 'Save & Run',
} as const;

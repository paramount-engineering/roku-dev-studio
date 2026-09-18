/**
 * Ports window — one per device, opened from the Console card header. Tabs for the Roku text
 * consoles (8080 SceneGraph, 8087 Screensaver) and a read-only trace of the 8081 debug protocol.
 */
export const portTerminal = {
  /** OS window title. */
  windowTitle: (deviceLabel: string): string => `Ports — ${deviceLabel}`,
  documentTitle: 'Ports',
  openButtonTitle: 'Open Ports Window',
  unknownDevice: 'Roku Device',

  pickerTitle: 'Open a Port',
  pickerHint: 'Each port opens in its own tab. Pick one to start.',
  noPortsAvailable: 'No ports are available for this device.',
  alreadyOpen: 'Open',
  newTab: 'New Tab',
  closeTab: 'Close Tab',

  port8080Name: 'SceneGraph Console',
  port8080Desc: 'Port 8080 — plugins, free, sgnodes, fps_display and other device commands',
  port8081Name: 'Debug Protocol',
  port8081Desc: 'Port 8081 — BrightScript debugger controls with a live trace of the protocol traffic',
  port8087Name: 'Screensaver Console',
  port8087Desc: 'Port 8087 — BrightScript console for the screensaver',
  portTab: (port: number): string => `Port ${port}`,
  customPortName: 'Custom Port',
  customPortDesc: 'Open another tunneled port as a text console — 9999 or 49152–65535',
  customPortPlaceholder: 'Port number',
  customPortInvalid: 'Enter a port between 1 and 65535',
  customPortReserved: (port: number): string => `Port ${port} has its own tab — the Console tab for 8085, the 8081 tab for the debugger ports`,
  customPortNotTunneled: (port: number): string => `The emulator only tunnels 8080, 8081, 8087, 9999 and 49152–65535 — not ${port}`,

  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'Disconnected',
  disconnectedReconnecting: 'Disconnected by the device — reconnecting…',
  reconnect: 'Reconnect',
  connectFailed: (error: string): string => `Could not connect: ${error}`,
  sendFailed: (error: string): string => `Could not send: ${error}`,
  inputPlaceholder: 'Type a command and press Enter',
  send: 'Send',
  nothingToCopy: 'Nothing to copy',
  defaultSaveName: (deviceLabel: string, port: number): string => `roku-${deviceLabel}-port-${port}.log`,

  debuggerNotAttached: 'Debugger not attached. Use Attach, or start a debug sideload — protocol frames appear here as soon as a session is live.',
  debuggerState: (state: string): string => `Debugger: ${state}`,
  wireError: (code: number): string => `error ${code}`,
  wireBytes: (n: number): string => `${n} B`
} as const;

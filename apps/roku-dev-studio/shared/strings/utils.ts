/**
 * UI strings for shared renderer utilities (renderer/modules/utils/*).
 *
 * Only user-facing text lives here: the telnet single-command session's status +
 * error strings (surfaced in the Query tab output and Action Script logs) and the
 * modal resize-grip tooltip. Developer log messages, ECP key names, and thrown
 * preload-bridge errors stay in code.
 *
 * Parametrized strings are functions returning the composed text.
 */
export const utils = {
  // Telnet single-command session status (telnet-system-command-run.ts) — shown to
  // the user via the Query output area / Action Script log.
  connectedSettingUpListener: 'Connected. Setting up listener...',
  sendingCommand: 'Sending command...',
  waitingForOutput: 'Waiting for output...',

  // Telnet session errors (surfaced to the user by callers)
  failedToConnectTelnet: (detail: string): string =>
    `Failed to connect to Telnet (port 8080): ${detail}`,
  remoteTelnetPollUnavailable: 'Remote Telnet poll not available',
  telnetDataListenerUnavailable: 'Telnet system data listener not available',
  failedToSendCommand: (detail: string): string => `Failed to send command: ${detail}`,
  stopped: 'Stopped',
  /** Fallback when an underlying error has no message. */
  unknownError: 'Unknown',

  // Resize-grip tooltip (modal-resize.ts)
  dragToResize: 'Drag to resize',
} as const;

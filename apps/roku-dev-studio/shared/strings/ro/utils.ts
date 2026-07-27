/**
 * Romanian (ro) translation of the shared renderer utility strings
 * (renderer/modules/utils/*).
 *
 * Only user-facing text lives here: the telnet single-command session's status +
 * error strings and the modal resize-grip tooltip.
 *
 * Parametrized strings are functions returning the composed text.
 */
export const utils = {
  // Telnet single-command session status (telnet-system-command-run.ts) — shown to
  // the user via the Query output area / Action Script log.
  connectedSettingUpListener: 'Conectat. Se configurează ascultătorul...',
  sendingCommand: 'Se trimite comanda...',
  waitingForOutput: 'Se așteaptă rezultatul...',

  // Telnet session errors (surfaced to the user by callers)
  failedToConnectTelnet: (detail: string): string =>
    `Conectarea la Telnet (port 8080) a eșuat: ${detail}`,
  remoteTelnetPollUnavailable: 'Interogarea Telnet la distanță indisponibilă',
  telnetDataListenerUnavailable: 'Ascultătorul de date de sistem Telnet indisponibil',
  failedToSendCommand: (detail: string): string => `Trimiterea comenzii a eșuat: ${detail}`,
  stopped: 'Oprit',
  /** Fallback when an underlying error has no message. */
  unknownError: 'Necunoscut',

  // Resize-grip tooltip (modal-resize.ts)
  dragToResize: 'Trage pentru a redimensiona',
};

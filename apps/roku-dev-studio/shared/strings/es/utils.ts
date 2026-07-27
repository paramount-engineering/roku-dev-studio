/**
 * UI strings for shared renderer utilities (renderer/modules/utils/*). Latin American Spanish.
 *
 * Only user-facing text lives here: the telnet single-command session's status +
 * error strings and the modal resize-grip tooltip.
 *
 * Parametrized strings are functions returning the composed text.
 */
export const utils = {
  // Telnet single-command session status (telnet-system-command-run.ts) — shown to
  // the user via the Query output area / Action Script log.
  connectedSettingUpListener: 'Conectado. Configurando el receptor...',
  sendingCommand: 'Enviando comando...',
  waitingForOutput: 'Esperando la salida...',

  // Telnet session errors (surfaced to the user by callers)
  failedToConnectTelnet: (detail: string): string =>
    `No se pudo conectar a Telnet (puerto 8080): ${detail}`,
  remoteTelnetPollUnavailable: 'El sondeo de Telnet remoto no está disponible',
  telnetDataListenerUnavailable: 'El receptor de datos del sistema Telnet no está disponible',
  failedToSendCommand: (detail: string): string => `No se pudo enviar el comando: ${detail}`,
  stopped: 'Detenido',
  /** Fallback when an underlying error has no message. */
  unknownError: 'Desconocido',

  // Resize-grip tooltip (modal-resize.ts)
  dragToResize: 'Arrastre para redimensionar',
};

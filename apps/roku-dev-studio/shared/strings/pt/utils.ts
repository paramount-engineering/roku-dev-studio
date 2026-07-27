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
  connectedSettingUpListener: 'Conectado. Configurando o listener...',
  sendingCommand: 'Enviando comando...',
  waitingForOutput: 'Aguardando a saida...',

  // Telnet session errors (surfaced to the user by callers)
  failedToConnectTelnet: (detail: string): string =>
    `Falha ao conectar ao Telnet (porta 8080): ${detail}`,
  remoteTelnetPollUnavailable: 'Polling remoto do Telnet nao disponivel',
  telnetDataListenerUnavailable: 'Listener de dados do sistema Telnet nao disponivel',
  failedToSendCommand: (detail: string): string => `Falha ao enviar o comando: ${detail}`,
  stopped: 'Parado',
  /** Fallback when an underlying error has no message. */
  unknownError: 'Desconhecido',

  // Resize-grip tooltip (modal-resize.ts)
  dragToResize: 'Arraste para redimensionar',
};

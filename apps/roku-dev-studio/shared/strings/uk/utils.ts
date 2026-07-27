/**
 * Ukrainian (uk) translation of the shared renderer utility strings
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
  connectedSettingUpListener: 'Підключено. Налаштування слухача...',
  sendingCommand: 'Надсилання команди...',
  waitingForOutput: 'Очікування виводу...',

  // Telnet session errors (surfaced to the user by callers)
  failedToConnectTelnet: (detail: string): string =>
    `Не вдалося підключитися до Telnet (порт 8080): ${detail}`,
  remoteTelnetPollUnavailable: 'Віддалене опитування Telnet недоступне',
  telnetDataListenerUnavailable: 'Системний слухач даних Telnet недоступний',
  failedToSendCommand: (detail: string): string => `Не вдалося надіслати команду: ${detail}`,
  stopped: 'Зупинено',
  /** Fallback when an underlying error has no message. */
  unknownError: 'Невідомо',

  // Resize-grip tooltip (modal-resize.ts)
  dragToResize: 'Перетягніть, щоб змінити розмір',
};

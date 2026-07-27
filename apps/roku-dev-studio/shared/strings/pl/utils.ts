/**
 * Polish (pl) translation of the shared renderer utility strings
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
  connectedSettingUpListener: 'Połączono. Konfigurowanie nasłuchiwania...',
  sendingCommand: 'Wysyłanie polecenia...',
  waitingForOutput: 'Oczekiwanie na wynik...',

  // Telnet session errors (surfaced to the user by callers)
  failedToConnectTelnet: (detail: string): string =>
    `Nie udało się połączyć z Telnet (port 8080): ${detail}`,
  remoteTelnetPollUnavailable: 'Zdalne odpytywanie Telnet niedostępne',
  telnetDataListenerUnavailable: 'Systemowy odbiornik danych Telnet niedostępny',
  failedToSendCommand: (detail: string): string => `Nie udało się wysłać polecenia: ${detail}`,
  stopped: 'Zatrzymano',
  /** Fallback when an underlying error has no message. */
  unknownError: 'Nieznany',

  // Resize-grip tooltip (modal-resize.ts)
  dragToResize: 'Przeciągnij, aby zmienić rozmiar',
};

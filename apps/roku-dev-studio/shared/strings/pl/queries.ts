/**
 * Polish (pl) translation of the Query / Device Queries tab strings: ECP query
 * results, custom queries, POST actions, telnet system commands, Remove Plugin,
 * and the Secret Screens modal. Sibling of ../queries.ts — same `queries` shape,
 * keys, order, and function signatures. Only literal display text is translated.
 */
export const queries = {
  // Results card
  findInResults: 'Znajdź w wynikach',
  saveResultsDialog: 'Zapisz wyniki',

  // Custom query field
  running: 'Wykonywanie...',
  runQuery: 'Wykonaj zapytanie',

  // Shared error / status text (rendered into the results output)
  errorText: (msg: string): string => `Błąd: ${msg}`,
  unknownError: 'Nieznany błąd',
  connectingToTelnet: 'Łączenie z Telnet (port 8080)...',
  connectedSettingUpListener: 'Połączono. Konfigurowanie nasłuchiwania...',
  failedToConnectTelnet: (err?: string): string => `Nie udało się połączyć z Telnet (port 8080): ${err}`,
  noOutputReceived: 'Nie otrzymano danych wyjściowych',
  noOutputFromCommand: 'Nie otrzymano danych wyjściowych z polecenia.',

  // Remove Plugin
  enterAppId: 'Wprowadź App ID',
  confirmRemovePlugin: (appId: string): string =>
    `Usunąć wtyczkę „${appId}”?\n\nSpowoduje to usunięcie aplikacji z tego urządzenia oraz ze wszystkich urządzeń powiązanych z tym samym kontem Roku.`,
  noResponseReceived: 'Nie otrzymano odpowiedzi',
  noResponseFromCommand: 'Nie otrzymano odpowiedzi z polecenia',

  // Secret Screens modal
  runSequence: 'Wykonaj sekwencję',
  keySequenceAria: (title: string): string => `Sekwencja klawiszy ${title}`,
  confirmReboot: 'Spowoduje to wysłanie sekwencji klawiszy, która ponownie uruchamia Roku. Kontynuować?',

  // Secret screen titles
  developerSettings: 'Ustawienia programisty',
  secretScreen: 'Sekretny ekran',
  secretScreen2: 'Sekretny ekran 2',
  wifiSecret: 'Sekretny ekran Wi-Fi',
  antennaSecret: 'Sekretny ekran anteny',
  channelInfo: 'Informacje o kanale',
  network: 'Sieć',
  reboot: 'Uruchom ponownie',
};

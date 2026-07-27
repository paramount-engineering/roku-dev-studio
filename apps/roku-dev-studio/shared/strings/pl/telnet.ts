/**
 * Polish (pl) translation of the Telnet / BrightScript debug console panel
 * strings. Sibling of ../telnet.ts — same `telnet` shape, keys, order, and
 * function signatures.
 *
 * Parametrized strings are functions returning the composed text. The "--- … ---"
 * session markers keep their exact interpolation; count-driven text uses the
 * Polish 3-form plural. Only literal wording is translated.
 */
export const telnet = {
  // Connection status pill (right of the console header)
  statusConnecting: 'Łączenie...',
  connectionFailed: 'Połączenie nie powiodło się',
  connectionLost: 'Utracono połączenie',
  unknownError: 'Nieznany błąd',
  errorStatusPrefix: (msg: string): string => `Błąd: ${msg}`,

  // Empty-state placeholder (shown before the first connect)
  placeholderTitle: 'Połącz, aby zobaczyć debugowy wynik BrightScript',
  placeholderHintDevMode: 'Wymaga włączonego Trybu programisty na urządzeniu Roku.',
  placeholderHintSingleConn: 'Jednocześnie może być aktywne tylko jedno połączenie telnet z urządzeniem Roku.',

  // Live line counter (left of the status pill) + its hover tooltip
  linesCount: (countLabel: string, n: number): string => {
    const word =
      n === 1 ? 'wiersz' :
      n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'wiersze' :
      'wierszy';
    return `${countLabel} ${word}`;
  },
  spillTooltip: (bufferedLabel: string, totalLabel: string, spilledLabel: string, capHit: boolean): string =>
    `${bufferedLabel} z ${totalLabel} wierszy — ${bufferedLabel} w pamięci, ${spilledLabel} zrzucono na dysk` +
    (capHit ? ' (osiągnięto limit dysku — starsze wiersze odrzucono)' : ''),

  // Session log lines the console prints into its own stream ("--- … ---")
  relayNoteSkipBuffer: ' (przez relay, pomiń istniejący bufor dzienników)',
  relayNoteReplayBuffer: ' (przez relay, odtwórz bufor)',
  lineConnectedTo: (ip: string, relayNote: string): string => `--- Połączono z ${ip}:8085${relayNote} ---`,
  lineConnectionFailed: (err: string): string => `--- Połączenie nie powiodło się: ${err} ---`,
  lineConnectionError: (msg: string): string => `--- Błąd połączenia: ${msg} ---`,
  lineDisconnected: '--- Rozłączono ---',
  lineError: (err: string): string => `--- Błąd: ${err} ---`,
  lineConnectionClosed: (aliveStr: string | null, bytes: number): string => {
    let s = '--- Połączenie zamknięte';
    if (aliveStr !== null) s += ` (aktywne ${aliveStr}`;
    if (bytes >= 0) s += `${aliveStr !== null ? ', ' : ' ('}odebrano ${bytes} bajtów`;
    if (aliveStr !== null || bytes >= 0) s += ')';
    s += ' ---';
    return s;
  },
  hintNoLogData:
    '--- Wskazówka: Roku szybko zamknął gniazdo bez danych dziennika. Sprawdź, czy żaden inny klient telnet nie jest podłączony do tego urządzenia na porcie 8085 (BrightScript IDE, inne okno Dev Studio, sesja terminala `telnet`, …) i czy obecnie działa wgrany kanał. ---',
  hintAbnormalClose:
    '--- Wskazówka: zamknięcie gniazda było nieprawidłowe (TCP RST lub podobne). Roku mógł się zrestartować albo inny klient przejął powiązanie z portem 8085. ---',

  // Copy button transient feedback (rendered next to a check icon — no ✓ prefix,
  // unlike common.copied, so the icon isn't doubled).
  copied: 'Skopiowano!',

  // Save button transient feedback + save dialog + saved-file header block
  saveNoLogs: 'Brak dzienników',
  saving: 'Zapisywanie...',
  saved: 'Zapisano!',
  saveError: 'Błąd',
  saveDialogTitle: 'Zapisz dzienniki konsoli',
  saveHeaderTitle: 'Dzienniki konsoli Roku',
  saveHeaderUnknownDevice: 'Nieznane',
  saveHeaderDevice: (device: string, ip: string): string => `Urządzenie: ${device} (${ip})`,
  saveHeaderSaved: (when: string): string => `Zapisano: ${when}`,
  saveHeaderTotalLines: (n: number): string => `Łączna liczba wierszy: ${n}`,
};

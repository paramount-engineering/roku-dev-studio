/**
 * Polish (pl) translation of the BrightScript Fiddle window strings.
 * Sibling of ../fiddle.ts — same `fiddle` shape, keys, order, and function
 * signatures. Count-driven text uses the Polish 3-form plural. Only literal
 * display text is translated.
 */
export const fiddle = {
  // Device dropdown
  selectDevice: 'Wybierz urządzenie',
  noDevices: 'Nie znaleziono urządzeń z włączonym trybem programisty',
  deviceFallbackName: 'Roku',
  remotePrefix: '[Zdalne] ',

  // Diagnostics status chip (bottom of the editor)
  noIssues: 'Brak problemów',
  diagWarnings: (warnCount: number): string => {
    const word =
      warnCount === 1 ? 'ostrzeżenie' :
      warnCount % 10 >= 2 && warnCount % 10 <= 4 && !(warnCount % 100 >= 12 && warnCount % 100 <= 14) ? 'ostrzeżenia' :
      'ostrzeżeń';
    return `${warnCount} ${word}`;
  },
  diagErrors: (errCount: number, warnCount: number): string => {
    const errWord =
      errCount === 1 ? 'błąd' :
      errCount % 10 >= 2 && errCount % 10 <= 4 && !(errCount % 100 >= 12 && errCount % 100 <= 14) ? 'błędy' :
      'błędów';
    const warnWord =
      warnCount === 1 ? 'ostrzeżenie' :
      warnCount % 10 >= 2 && warnCount % 10 <= 4 && !(warnCount % 100 >= 12 && warnCount % 100 <= 14) ? 'ostrzeżenia' :
      'ostrzeżeń';
    return `${errCount} ${errWord}${warnCount ? `, ${warnCount} ${warnWord}` : ''}`;
  },

  // Password modal
  passwordRequired: 'Hasło jest wymagane.',

  // Run / Stop status line
  selectDeviceFirst: 'Najpierw wybierz urządzenie.',
  deviceUnavailable: 'Wybrane urządzenie nie jest już dostępne.',
  runCancelledPassword: 'Uruchomienie anulowane — wymagane hasło.',
  running: 'Uruchamianie...',
  runFailed: 'Uruchomienie nie powiodło się.',
  runFailedWith: (msg: string): string => `Uruchomienie nie powiodło się: ${msg}`,
  sideloadWaiting: 'Wgrywanie zakończone — oczekiwanie na wynik…',
  runningOnDevice: 'Uruchamianie na urządzeniu…',
  runComplete: 'Uruchomienie zakończone.',
  editorReset: 'Edytor zresetowany do domyślnego Snippet.',
  uninstalling: 'Odinstalowywanie...',
  channelRemoved: 'Kanał BrightScript Fiddle usunięty.',
  stopFailed: 'Zatrzymanie nie powiodło się.',
  ready: 'Gotowe.',

  // Reset-code confirm
  resetConfirm: 'Zresetować edytor do domyślnego Snippet? Niezapisane zmiany zostaną utracone.',

  // Editor bootstrap status
  loadingEditor: 'Ładowanie edytora...',
  editorFailedToLoad: (msg: string): string => `Nie udało się załadować edytora: ${msg}`,

  // Monaco command-palette / context-menu action
  runOnDevice: 'Uruchom na urządzeniu',

  // Static fiddle.html shell — header, device picker, panes, status row
  heading: 'BrightScript Fiddle',
  subtitle: 'Uruchom szybki fragment BrightScript na dowolnym podłączonym urządzeniu.',
  deviceLabel: 'Urządzenie',
  scanForDevices: 'Skanuj urządzenia',
  runBtn: 'Uruchom',
  runBtnTitle: 'Uruchom (⌘/Ctrl+Enter)',
  stopBtn: 'Zatrzymaj',
  stopBtnTitle: 'Odinstaluj kanał Fiddle',
  codeLabel: 'Kod',
  resetSnippetTitle: 'Resetuj do domyślnego Snippet',
  resetSnippetAria: 'Resetuj edytor do domyślnego Snippet',
  terminalLabel: 'Terminal',
  clearTerminal: 'Wyczyść terminal',
  statusRowCaption: 'Uruchomienie zastępuje aktualnie wgrany kanał na wybranym urządzeniu.',

  // Developer-password modal
  passwordModalTitle: 'Wymagane hasło programisty',
  passwordModalHint:
    'Wgrywanie (sideload) wymaga hasła programisty urządzenia — tego, które ustawiasz podczas włączania Trybu programisty.',
  passwordLabel: 'Hasło',
  passwordPlaceholder: 'Wprowadź hasło programisty',
  passwordModalHintMuted:
    'To hasło jest używane tylko w tej sesji. Aby zapisać je do przyszłego użytku, zweryfikuj Tryb programisty w głównym oknie.',
  passwordSubmitBtn: 'Zapisz i uruchom',

  /**
   * Monaco editor's initial value + the target of "Reset to default Snippet".
   * The two leading `'` comment lines are user-facing guidance; the BrightScript
   * keywords/identifiers (`Sub`, `End Sub`, `print`, `userFiddle`, `init`) and the
   * example `print` output are code tokens kept verbatim. Composed via the same
   * newline join as the source so the editor value is byte-for-byte identical.
   */
  defaultSnippet: [
    "' `userFiddle` to punkt wejścia, który Fiddle uruchamia po pojawieniu się kanału na ekranie.",
    "' Umieść tutaj swój fragment — możesz też zdefiniować poniżej pomocnicze sub/funkcje i wywołać je z userFiddle. NIE definiuj sub o nazwie `init` — ten identyfikator jest zarezerwowany przez scenę Fiddle.",
    'Sub userFiddle()',
    '    print "Hello from Roku Dev Studio Fiddle"',
    'End Sub',
    ''
  ].join('\n'),

  // ── Main-process diagnostics + run/stop errors (main/ipc/bs-fiddle-handlers.ts) ──
  // Surfaced in the Fiddle UI (Monaco markers or the status line). Code literals
  // (`init`, `userFiddle`) are kept verbatim.
  lintReservedInit:
    'Nazwa `init` jest zarezerwowana przez scenę Fiddle. Zmień nazwę tego sub na `userFiddle` — Fiddle wywoła `userFiddle()` automatycznie, gdy scena pojawi się na ekranie.',
  errWindowUnavailable: 'Okno Fiddle nie jest już dostępne.',
  errDeviceDisconnected: 'Wybrane urządzenie nie jest już połączone.',
  errNoPasswordProvided: 'Nie podano hasła programisty.',
  errNoPasswordAvailable: 'Brak dostępnego hasła programisty dla tego urządzenia.',
  errPackageFailed: (detail: string): string => `Nie udało się spakować fragmentu: ${detail}`,
  errRemoteMissingServerUrl: 'Zdalne urządzenie nie ma adresu URL serwera przekazującego — nie można przesyłać strumieniowo dzienników telnet.',
  errSideloadFailed: 'Wgrywanie nie powiodło się',
  errDeviceNotFound: 'Nie znaleziono urządzenia.',
  errNotFiddleChannel:
    'Aktualnie zainstalowany kanał deweloperski nie jest kanałem Fiddle — pozostawiono go nietkniętym, aby nie usunąć Twojej własnej aplikacji.',

  // humanizeRemoteUploadError prose (remote relay upload failures)
  errRemoteUnknown: 'Nieznany błąd zdalnego serwera przekazującego.',
  errRemoteNetworkBlip:
    'Chwilowy problem sieciowy między serwerem przekazującym a Roku (przerwany potok). ' +
    'Zwykle ustępuje po ponowieniu — jeśli się powtarza, sprawdź, czy host przekazujący ' +
    'może dotrzeć do urządzenia przez sieć LAN i czy Roku nie jest zajęte.',
  errRemoteCurl: (detail: string): string => `Błąd curl zdalnego serwera przekazującego: ${detail}`,
};

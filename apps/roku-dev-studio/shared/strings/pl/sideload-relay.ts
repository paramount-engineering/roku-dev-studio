/**
 * Polish (pl) translation of the Sideload Relay settings section +
 * device-setup modal strings. Sibling of ../sideload-relay.ts — same
 * `sideloadRelay` shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Polish
 * count-driven text uses the 3-form plural. Only literal display text is
 * translated.
 */
export const sideloadRelay = {
  // Enable gate
  gateTitle: 'Aby włączyć Sideload Relay:',
  gateNeedPassword: 'Ustaw hasło programisty Relay, aby Twoje IDE mogło uwierzytelnić się w RDS.',
  gateNeedDevice: 'Wybierz co najmniej jedno dostępne urządzenie — otwórz „Konfiguruj urządzenia” i włącz urządzenie, które jest online.',

  // Targeted Devices summary row
  targetSummaryEmpty: 'Nie wybrano jeszcze żadnych urządzeń. Kliknij „Konfiguruj urządzenia”, aby wybrać, które urządzenia Roku otrzymują każdą kompilację.',
  targetSummaryChecking: (n: number): string => {
    const word =
      n === 1 ? 'urządzenie' :
      n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'urządzenia' :
      'urządzeń';
    return `Wybrano ${n} ${word} · sprawdzanie dostępności…`;
  },
  targetSummaryReachable: (reachable: number): string => `${reachable} włączonych i dostępnych`,
  targetSummaryOfflineSuffix: (offline: number): string => ` · ${offline} offline (pominięto do czasu dostępności)`,

  // Toggle rows + password field
  enableTitle: 'Włącz Sideload Relay',
  enableDesc: 'Rozgłaszaj RDS jako Roku przez SSDP i akceptuj wgrywanie (sideload). Domyślnie wyłączone.',
  passwordTitle: 'Hasło programisty Relay',
  passwordDesc: 'Hasło, którym uwierzytelnia się Twoje IDE (użytkownik rokudev). Puste pole zachowuje zapisane.',
  autoConsoleTitle: 'Automatycznie połącz konsolę',
  autoConsoleDesc: 'Otwieraj konsolę telnet 8085 na każdym urządzeniu po instalacji.',
  retryTitle: 'Ponów raz przy niepowodzeniu',
  retryDesc: 'Ponów nieudaną instalację jeden raz przed zgłoszeniem błędu.',
  targetedDevicesTitle: 'Wybrane urządzenia',
  setupDevicesBtn: 'Konfiguruj urządzenia',
  targetSummaryLoading: 'Ładowanie…',

  // Setup modal
  modalTitle: 'Konfiguruj urządzenia Sideload Relay',
  modalSubtitle:
    'Włączone i dostępne urządzenia otrzymują każdą kompilację, którą wgrywasz przez RDS. Wcześniej wybrane urządzenia, które są offline, pozostają na liście (wyłączone) i automatycznie dołączają ponownie, gdy znów staną się dostępne.',
  scanBtn: 'Skanuj urządzenia',
  scanning: 'Skanowanie…',
  colLocation: 'Lokalizacja',
  colDevice: 'Urządzenie',
  colIpSerial: 'IP i numer seryjny',
  colEnabled: 'Włączone',
  colReachable: 'Dostępne',
  emptyDevices: 'Nie znaleziono urządzeń. Upewnij się, że Twoje urządzenia Roku są włączone i w trybie programisty, a następnie skanuj ponownie.',
  locRemote: 'Zdalne',
  locLocal: 'Lokalne',

  // Per-device password affordance
  setPasswordBtn: '🔒 Ustaw hasło',
  setPasswordTitle: 'Wprowadź i zweryfikuj hasło programisty, aby włączyć to urządzenie',
  enableAriaLabel: (name: string): string => `Włącz ${name}`,
  reachableNow: 'Teraz dostępne',
  reachableOk: '✓',
  reachableOff: '○ offline',
  reachableOffTitle: 'Niedostępne — pominięte, dopóki nie wróci do sieci',

  // Inline password editor
  pwInputPlaceholder: 'Hasło programisty',
  pwInputAriaLabel: (name: string): string => `Hasło programisty dla ${name}`,
  pwValidateTitle: (name: string): string => `Zweryfikuj i włącz ${name}`,
  pwValidateAriaLabel: 'Zweryfikuj hasło',
  pwValidateChar: '✓',
  pwEnterPassword: 'Wprowadź hasło',
  pwWrong: 'Nieprawidłowe hasło',
  pwUnreachable: 'Niedostępne',

  // Modal summary
  modalSummary: (enabledReachable: number, reachableTotal: number): string =>
    `${enabledReachable} włączonych i dostępnych z ${reachableTotal} online`,
  modalSummaryOfflineSuffix: (offline: number): string => ` · zachowano ${offline} offline`,

  // Scan status
  scanFound: (local: number, remote: number, total: number): string => {
    const word =
      total === 1 ? 'urządzenie' :
      total % 10 >= 2 && total % 10 <= 4 && !(total % 100 >= 12 && total % 100 <= 14) ? 'urządzenia' :
      'urządzeń';
    return `Znaleziono ${local} lokalnych${remote ? ` · ${remote} zdalnych` : ''} ${word} dev.`;
  },
  scanFailed: 'Skanowanie nie powiodło się.',

  // Save status
  saved: 'Zapisano ustawienia Sideload Relay.',
  saveFailed: 'Nie udało się zapisać',
  fixBeforeEnable: 'Popraw powyższe elementy przed włączeniem Sideload Relay.',

  // Password reveal aria/title
  showPassword: 'Pokaż hasło',
  hidePassword: 'Ukryj hasło',

  // Saved-password placeholder hint
  savedPasswordPlaceholder: '•••••••• (zapisane)',

  // ── Native allow/deny prompt on the host (main/sideload-relay/index.ts) ──
  authorizeTitle: 'Sideload Relay',
  authorizeAllow: 'Zezwól',
  authorizeDeny: 'Odmów',
  authorizeMessage: (who: string): string => `Zezwolić na wgranie (sideload) z ${who}?`,
  authorizeDetail:
    'Inne urządzenie w Twojej sieci próbuje zainstalować kompilację przez Roku Dev Studio. ' +
    'Zezwól tylko wtedy, gdy rozpoznajesz to urządzenie.',

  // ── Relay dev-password validate / reveal + settings-save errors (main/ipc/relay-handlers.ts) ──
  errDeviceIpPasswordRequired: 'Adres IP i hasło urządzenia są wymagane.',
  errIncorrectPassword: 'Nieprawidłowe hasło programisty.',
  errValidationFailed: 'Weryfikacja nie powiodła się.',
  errCouldNotReadPassword: 'Nie udało się odczytać zapisanego hasła.',
  errCouldNotWriteSettings: 'Nie udało się zapisać pliku ustawień.',
};

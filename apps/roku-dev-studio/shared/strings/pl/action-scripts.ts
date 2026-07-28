/**
 * Polish (pl) translation of the Action Scripts UI strings (Builder, step
 * fields, Executor, Import modal, shared actions list, and the per-step Help
 * modal).
 *
 * Same structure/keys/order as ../action-scripts.ts. Parametrized strings are
 * functions returning the composed text. Help-modal body values contain inline
 * HTML (assigned via `setSafeHTML`); dynamic values are HTML-escaped at the call
 * site before being passed in.
 */
export const actionScripts = {
  // ── Builder: step-type option (legacy) ──
  legacyPluginsMemoryOption: 'Plugins / Pamięć (starszy JSON)',

  // ── Builder: per-step field labels / placeholders / prompts ──
  labelQuery: 'Zapytanie',
  labelEndpoint: 'Endpoint',
  optionCustom: 'Niestandardowy...',
  labelSystemTelnetCommand: 'Polecenie (starszy typ — użyj Zapytania urządzenia dla nowych kroków)',
  labelKey: 'Klawisz',
  optionSelectKey: '-- Wybierz klawisz --',
  labelText: 'Tekst',
  placeholderTextToSend: 'Tekst do wysłania',
  labelAppId: 'App ID',
  labelParamsOptional: 'Parametry (opcjonalnie)',
  labelFilePath: 'Ścieżka pliku',
  placeholderPastePathOrChoose: 'Wklej ścieżkę lub wybierz plik',
  titleFilePathZip: 'Ścieżka do pakietu .zip. Wklej tutaj lub użyj przycisku Wybierz plik.',
  chooseFileTitle: 'Wybierz plik (.zip)',
  chooseFileAria: 'Wybierz plik',
  chooseFileBtn: 'Wybierz plik',
  labelPassword: 'Hasło',
  placeholderDevPassword: 'Hasło deweloperskie',
  optionConnectAppConnectorFirst: 'Najpierw połącz App Connector',
  labelFunction: 'Funkcja',
  labelSetVarOptional: 'Ustaw zmienną (opcjonalnie)',
  placeholderVarExample: 'np. varX',
  titleVarNameRules: 'Litery, cyfry, podkreślenie; zacznij od litery lub _',
  noParameters: 'Brak parametrów',
  selectAFunction: 'Wybierz funkcję',
  labelCommand: 'Polecenie',
  labelParameters: 'Parametry',
  labelLabelOptional: 'Etykieta (opcjonalnie)',
  placeholderScreenshotLabel: 'np. Po zalogowaniu',
  labelWaitBeforeMs: 'Czekaj przed (ms)',
  labelWaitAfterMs: 'Czekaj po (ms)',
  placeholderWaitAfterDefault: '1500 (domyślnie)',
  titleWaitAfter:
    'Czas oczekiwania po wyzwoleniu przechwytywania przed pierwszym pobraniem. Zwiększ, jeśli obraz jest ucięty lub UI działa wolno (np. HUD).',
  optionChooseChart: 'Wybierz wykres…',
  labelChart: 'Wykres',
  placeholderPerfLabel: 'np. Po nawigacji',
  waitModeFixedDelay: 'Stałe opóźnienie (ms)',
  waitModeUntilCondition: 'Do spełnienia warunku',
  labelWaitType: 'Typ oczekiwania',
  labelDelayMs: 'Opóźnienie (ms)',
  labelSource: 'Źródło',
  labelState: 'Stan',
  optionSelectState: '-- Wybierz stan --',
  labelTimeoutMs: 'Limit czasu (ms)',
  labelPollIntervalMs: 'Interwał odpytywania (ms)',
  labelPathJsonArray: 'Ścieżka (tablica JSON)',
  labelNodeId: 'ID węzła',
  labelFieldName: 'Nazwa pola',
  labelOperator: 'Operator',
  placeholderFieldInFieldList: 'Pole w FieldList',
  placeholderCompareString: 'Ciąg do porównania',
  placeholderCompareValue: 'Wartość do porównania',
  caseInsensitive: 'Bez rozróżniania wielkości liter',
  labelConditionSource: 'Źródło warunku',
  labelAttribute: 'Atrybut',
  placeholderActiveAppValue: 'np. dev, 837, YouTube',
  labelVariablePath: 'Ścieżka zmiennej',
  labelPost: 'POST',
  optionSelectPost: '-- Wybierz POST --',
  noExtraFields: 'Brak dodatkowych pól dla tego typu.',

  // Chart option labels (shared: Builder dropdown, list Details, Executor descriptions)
  chartObjects: 'Obiekty BrightScript',
  chartCpu: 'Użycie CPU',
  chartMemory: 'Pamięć systemowa',
  chartAboveAll: 'Wszystko razem',

  // Condition / wait source labels (shared)
  sourceMediaPlayer: 'Odtwarzacz multimediów',
  sourceActiveApp: 'Aktywna aplikacja',
  sourceRaleNodeField: 'Pole węzła RALE',
  sourceVariables: 'Zmienne',

  // Value-with-operator label (Builder compare cells)
  valueWithOperator: (op: string): string => `Wartość (${op})`,

  // ── Shared actions list view (Builder + Executor) ──
  branchThen: 'Wtedy',
  branchElse: 'Inaczej',
  dragToReorder: 'Przeciągnij, aby zmienić kolejność',
  columnType: 'Typ',
  columnDetails: 'Szczegóły',
  addStep: 'Dodaj krok',
  pasteStepBtn: 'Wklej krok',
  pasteActionTooltip: 'Wklej skopiowaną akcję tutaj',
  ariaThenBranchPrefix: 'Gałąź Wtedy. ',
  ariaElseBranchPrefix: 'Gałąź Inaczej. ',
  copyActionTooltip: 'Kopiuj akcję',
  removeActionTooltip: 'Usuń akcję',
  skipBtn: 'Pomiń',
  skipActionTooltip: 'Pomiń tę akcję',
  skipActionAria: 'Pomiń akcję',
  unskipBtn: 'Nie pomijaj',
  runActionTooltip: 'Wykonaj tę akcję',
  unskipActionAria: 'Nie pomijaj akcji',
  emptyNoScript:
    'Nie załadowano skryptu. Kliknij <strong>Importuj Action Script</strong> powyżej, aby zaimportować skrypt, lub użyj karty <strong>Kreator</strong>, aby utworzyć nowy.',
  stepRowAria: (num: string, type: string, details: string): string =>
    `Akcja ${num}: ${type}${details ? ', ' + details : ''}. Kliknij, aby edytować.`,

  /** Row header / error line: "Action <id>: <text>" */
  actionLabel: (id: string, text: string): string => `Akcja ${id}: ${text}`,

  // ── Builder chrome + toasts + import messages ──
  helpTooltip: (label: string, detail: string): string => `Pomoc: ${label}${detail}`,
  addActionBtn: 'Dodaj akcję',
  updateStepHeading: (n: number): string => `Aktualizuj krok ${n}`,
  updateActionBtn: 'Aktualizuj akcję',
  toastActionPasted: 'Wklejono akcję',
  toastCannotMoveIntoOwnBranch: 'Nie można przenieść kroku do jego własnej gałęzi If.',
  toastActionCopied: 'Skopiowano akcję',
  toastChooseChartType: 'Wybierz typ wykresu dla Wydajności urządzenia.',
  toastUpdatedAction: (n: number): string => `Zaktualizowano akcję #${n}`,
  copiedFeedback: 'Skopiowano!',
  copyActionScriptBtn: 'Kopiuj Action Script',
  savedFeedback: 'Zapisano!',
  saveActionScriptBtn: 'Zapisz Action Script',
  saveModalNameLabel: 'Nazwa',
  saveModalNamePlaceholder: 'np. Uruchom i odtwórz',
  saveModalNameRequired: 'Wpisz nazwę.',
  saveModalOverwriteWarning: (name: string): string =>
    `Zapisany skrypt o nazwie "${name}" już istnieje.`,
  saveModalOverwriteConfirm: 'Zastąp',
  saveModalSavedListLabel: 'Zapisane skrypty',
  saveModalNoSavedScripts: 'Brak zapisanych skryptów',
  toastSaveFailed: 'Nie udało się zapisać skryptu.',
  viewerHeading: 'Wyświetl i zarządzaj Action Scripts',
  viewerSaveAs: 'Zapisz jako…',
  viewerApplyToDevice: 'Zastosuj do urządzenia',
  viewerApply: 'Zastosuj',
  viewerRescan: 'Skanuj ponownie',
  viewerNoDevices: 'Nie znaleziono urządzeń',
  viewerCopySuffix: 'kopia',
  viewerDeleteConfirm: (name: string): string => `Usunąć zapisany skrypt „${name}”?`,
  viewerNoDeviceNote: 'Podłącz urządzenie w oknie głównym, aby widzieć na bieżąco nazwy funkcji App Connector i RALE.',
  viewerEmpty: 'Brak zapisanych skryptów — zapisz jeden z Buildera Action Scripts na karcie urządzenia.',
  msgNoScriptJson: 'Brak JSON skryptu do załadowania.',
  invalidJson: (detail: string): string => `Nieprawidłowy JSON: ${detail}`,
  msgStepsArray: 'Skrypt musi zawierać tablicę "steps".',
  msgValidation: (lines: string): string => `Walidacja:\n${lines}`,

  // ── index.ts toasts (user-visible; MCP-bridge/agent error strings are left in place) ──
  toastBuilderNotAvailable: 'Kreator nie jest dostępny na tej karcie.',
  toastLoadedInBuilder: 'Załadowano w Kreatorze',
  toastAiAgentLoaded: 'Agent SI załadował skrypt do Kreatora',
  toastCouldNotLoadScript: 'Nie udało się załadować skryptu',
  toastNoScriptInExecutor: 'Brak JSON skryptu w Wykonawcy do załadowania.',
  toastAddNonEmptySteps: 'Najpierw dodaj niepustą tablicę "steps" do JSON skryptu.',
  toastOpenedInBuilder: 'Otwarto w Kreatorze',

  // ── Shared RALE preflight errors (Executor + Import) ──
  errDevAppRequired:
    'Aby nawiązać połączenie App Connector, należy uruchomić Roku Developer Application. Otwórz Developer Application na urządzeniu Roku (lub uruchom swój kanał sideload z karty Dev App), a następnie spróbuj ponownie.',
  errRaleConnection:
    'Narzędziu nie udało się nawiązać połączenia App Connector. Upewnij się, że Dev App działa z włączonym Trybem dewelopera i że na karcie App Connector ustawiono prawidłowy port, a następnie spróbuj ponownie. Skrypt nie może zostać wykonany, dopóki połączenie nie będzie dostępne.',

  // ── Executor engine: full-sentence user-facing errors ──
  errScreenshotPassword:
    'Hasło deweloperskie jest wymagane do zrzutu ekranu. Podaj je w skrypcie (devPassword) lub wprowadź je podczas walidacji.',
  errScreenshotDevApp:
    'Zrzut ekranu wymaga, aby Developer App był aktywny. Najpierw uruchom swój kanał sideload z karty Dev App.',
  errDevicePerformanceInRds:
    'Wydajność urządzenia jest dostępna tylko podczas uruchamiania Action Scripts w Roku Dev Studio.',

  // ── Executor UI ──
  runBtnPause: 'Wstrzymaj wykonywanie',
  runBtnResume: 'Wznów wykonywanie',
  runBtnRun: 'Uruchom Action Script',
  emptyNoActions:
    '<strong>Nie załadowano akcji</strong><br><br>Użyj <strong>Importuj Action Script</strong> powyżej, aby wkleić lub przesłać skrypt JSON, a następnie kliknij <strong>Waliduj i importuj</strong> w oknie modalnym, aby załadować tutaj akcje.',
  noFolderSelected: 'Nie wybrano folderu',
  resultsPlaceholder: 'Waliduj i uruchom, aby zobaczyć wyniki.',
  waiting: 'Oczekiwanie…',
  statusOk: '✓ OK',
  statusFailed: '✗ Niepowodzenie',
  statusFailedPlain: 'Niepowodzenie',
  statusSkipped: 'Pominięto',
  altScreenshot: 'Zrzut ekranu',
  altDevicePerformanceChart: 'Wykres wydajności urządzenia',
  validating: 'Walidacja…',
  errPasteOrUpload: 'Wklej lub prześlij skrypt (JSON).',
  errMissingAppFunctions: (list: string): string =>
    `Następujące funkcje aplikacji (App Function) nie są udostępniane przez aplikację: ${list}. Upewnij się, że Twój kanał udostępnia te funkcje (lub usuń te kroki ze skryptu), a następnie spróbuj ponownie.`,
  expectedSuffix: (values: string): string => `\n   oczekiwano: ${values}`,
  errFileNotFound: (path: string): string => `Nie znaleziono pliku: ${path}`,
  statusValid: '✓ Prawidłowy',
  usingDevPasswordFromAuth: '(używane Hasło deweloperskie z Auth)',
  switchedTabRunPaused:
    'Przełączono kartę — wykonywanie jest wstrzymane. Wróć do Action Scripts, aby wznowić (jeśli JSON się nie zmienił), lub użyj Importuj → Waliduj i importuj.',
  scriptChangedNeedsValidation:
    'Skrypt zmieniony lub wymaga walidacji — użyj Importuj Action Script → Waliduj i importuj, albo zmień JSON i zwaliduj.',
  scriptChangedClickValidate: 'Skrypt zmieniony — kliknij Waliduj.',
  connectingToAppConnector: 'Łączenie z App Connector...',
  runStarted: (runId: string, count: number): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word =
      count === 1
        ? 'akcja'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'akcje'
          : 'akcji';
    return `Wykonywanie rozpoczęte (${runId}) — ${count} ${word}`;
  },
  errDevicePerformanceUnavailable:
    'Wydajność urządzenia jest niedostępna dla tego urządzenia. Otwórz Remote Section (z metrykami) lub połącz urządzenie ponownie.',
  errorLine: (message: string): string => `Błąd: ${message}`,
  runStopped: 'Wykonywanie zatrzymane.',
  runCompleted: 'Wykonywanie zakończone.',
  copyResultsTitle: 'Kopiuj wyniki',
  saveResultsTitle: 'Zapisz wyniki jako PDF',

  // ── validator.ts parse errors ──
  noScriptContent: 'Brak treści skryptu',
  scriptEmpty: 'Skrypt jest pusty',
  invalidJsonShort: 'Nieprawidłowy JSON',

  // ── Import modal ──
  msgStepsArrayNoDot: 'Skrypt musi zawierać tablicę "steps"',
  errInvalidScriptObject: 'Nieprawidłowy skrypt: musi być obiektem',
  importModalTitle: 'Importuj Action Script',
  importIntoBuilderTitle: 'Importuj skrypt do Kreatora',
  validateAndLoadBtn: 'Waliduj i załaduj',
  validateAndImportBtn: 'Waliduj i importuj',
  errCannotVerifyPassword: 'Nie można zweryfikować hasła: połączenie z urządzeniem jest niedostępne.',
  errVerificationFailed: 'Weryfikacja nie powiodła się',
  errCouldNotDetermineDevice:
    'Nie udało się określić urządzenia do importu. Zamknij okno modalne i otwórz Import ponownie z tej karty urządzenia.',
  errInvalidScript: 'Nieprawidłowy skrypt',
  errSaveFolderRequired:
    'Dla tego skryptu wymagany jest folder zapisu (np. krok Zrzut ekranu). Wybierz folder zapisu.',
  errDevPasswordRequired: 'Hasło deweloperskie jest wymagane, a nie ma go w pamięci podręcznej ani w skrypcie. Wprowadź je poniżej.',
  verifyingPassword: 'Weryfikacja hasła…',
  errAuthFailed: 'Uwierzytelnianie nie powiodło się. Sprawdź hasło i spróbuj ponownie.',
  errPasswordVerificationFailed: 'Weryfikacja hasła nie powiodła się.',
  errValidationFailed: 'Walidacja nie powiodła się',
  errVerificationOrValidationFailed: 'Weryfikacja lub walidacja nie powiodła się',
  errFailedToReadFile: 'Nie udało się odczytać pliku',

  // ── Step Help modal: subtitles + title ──
  helpSubCustomEndpoint: 'Niestandardowy endpoint',
  helpSubSelectPost: 'Wybierz POST',
  helpSubFixedDelay: 'Stałe opóźnienie',
  helpUntilCondition: (srcLabel: string): string => `Do spełnienia warunku · ${srcLabel}`,
  helpSubSelectCommand: 'Wybierz polecenie',
  helpSubSelectKey: 'Wybierz klawisz',
  helpSubSelectCommandShort: 'Wybierz polecenie',
  helpSystemTelnetTitle: 'Plugins / Pamięć (starsze)',
  helpNoText: (type: string): string => `Brak tekstu pomocy dla „${type}”.`,

  // ── Step Help modal: variant bodies (inline HTML) ──
  helpBodyQueryCustom: `
    <p>
      <strong>Niestandardowy</strong> pozwala samodzielnie wpisać dowolną ścieżkę Zapytania urządzenia: zwykłe <code>/query/…</code> ECP GET lub
      wartości w stylu dev, takie jak <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Użyj tego, gdy dla potrzebnego endpointu nie ma gotowego ustawienia. Wartość jest wysyłana bez zmian do tego samego mechanizmu zapytań co gotowe ustawienia.</p>
  `,
  helpBodyQueryTelnetPlugins: `
    <p>
      Uruchamia deweloperskie polecenie telnet <strong>plugins</strong> (lista spakowanych kanałów / podsumowanie wtyczek). To te
      same dane, co wybór gotowego ustawienia Plugins w starszych procesach, wyrażone jako gotowe ustawienie zapytania.
    </p>
    <p>Wymaga dostępu deweloperskiego do urządzenia (jak inne zapytania dev-plugin).</p>
  `,
  helpBodyQueryTelnetFree: `
    <p>
      Uruchamia deweloperskie polecenie telnet <strong>free</strong> (zrzut w stylu pamięci / heap). Użyj go, gdy potrzebujesz
      szybkiego odczytu pamięci podczas skryptu.
    </p>
  `,
  helpBodyPostNone: `
    <p>Wybierz jedno z gotowych ustawień <strong>POST</strong> (SGRendezvous, FW Beacons itp.). Każda opcja odpowiada stałej ścieżce na urządzeniu.</p>
  `,
  helpBodyWaitDelay: `
    <p>
      Wstrzymuje skrypt na zadaną liczbę <strong>milisekund</strong> bez odpytywania. Użyj po animacjach,
      uruchomieniach lub dowolnym kroku, gdzie potrzebujesz tylko stałej pauzy.
    </p>
  `,
  helpBodyWaitMediaPlayer: `
    <p>
      Odpytuje <code>/query/media-player</code>, dopóki <strong>stan</strong> odtwarzacza nie będzie zgodny z Twoim wyborem (play,
      pause, buffer, …) lub nie upłynie <strong>limit czasu</strong>.
    </p>
    <p>
      Dostosuj <strong>interwał odpytywania</strong>, aby zrównoważyć responsywność i obciążenie. Jeśli warunek nigdy nie stanie się prawdziwy,
      krok kończy się niepowodzeniem po osiągnięciu limitu czasu.
    </p>
  `,
  helpBodyWaitRale: `
    <p>
      Odpytuje przez <strong>RALE</strong>, dopóki pole węzła sceny nie będzie zgodne z porównaniem (operator + wartość). Musisz
      podać ścieżkę (tablicę JSON), id węzła, nazwę pola oraz pola czasowe.
    </p>
    <p>
      Wymaga połączenia App Connector w czasie wykonywania. Operatory takie jak <code>exists</code> / <code>notExists</code> mogą
      ukrywać pole wartości — zobacz etykiety formularza dla aktywnego trybu.
    </p>
  `,
  helpBodyIfMediaPlayer: `
    <p>
      Ocenia bieżący stan <strong>odtwarzacza multimediów</strong> jeden raz i wykonuje gałąź <strong>wtedy</strong> lub
      <strong>inaczej</strong>. Wybierz oczekiwany stan (play, pause, …), na którym ma nastąpić rozgałęzienie.
    </p>
    <p>W przeciwieństwie do <strong>Oczekiwania</strong> nie ma odpytywania: warunek jest sprawdzany jednorazowo podczas wykonywania kroku.</p>
  `,
  helpBodyIfActiveApp: `
    <p>
      Porównuje jeden atrybut z <code>/query/active-app</code> (app id, typ, wersja, nazwa) przy użyciu ustawionego przez Ciebie operatora i
      wartości. Przydatne do rozgałęziania, gdy określony kanał jest na pierwszym planie.
    </p>
  `,
  helpBodyIfRale: `
    <p>
      Jednorazowe sprawdzenie <strong>pola węzła RALE</strong> (ścieżka, id węzła, pole, operator, wartość). Taka sama struktura jak
      strona RALE warunku Oczekiwania, ale oceniana jednorazowo na potrzeby rozgałęzienia.
    </p>
  `,
  helpBodyIfVariables: `
    <p>
      Porównuje wartość zapisaną w <strong>zmiennej skryptu</strong> (z poprzedniego polecenia RALE lub przypisania funkcji aplikacji)
      przy użyciu skonfigurowanej przez Ciebie ścieżki zmiennej i operatora.
    </p>
    <p>Wymaga wersji skryptu 2 oraz wcześniejszych kroków, które wypełniają zmienną.</p>
  `,
  helpBodyRaleNone: `
    <p>Wybierz <strong>polecenie RALE</strong> z listy. Parametry i opcjonalne „Ustaw zmienną” pojawiają się po wybraniu polecenia.</p>
  `,
  helpBodyAppFunctionNone: `
    <p>
      Połącz <strong>App Connector</strong>, aby wyeksportowane funkcje Twojego kanału pojawiły się na liście, a następnie wybierz
      funkcję, aby zobaczyć jej parametry.
    </p>
  `,
  helpBodyKeypressNone: `
    <p>Wybierz <strong>klawisz pilota</strong> z pogrupowanej listy. Skrypt wysyła ten klawisz przez ECP podczas wykonywania kroku.</p>
  `,
  helpBodySystemTelnetNone: `
    <p>Wybierz <strong>Plugins</strong> lub <strong>Pamięć</strong> dla tego starszego kroku albo przejdź na Zapytanie urządzenia z odpowiednimi gotowymi ustawieniami telnet.</p>
  `,
  helpBodySystemTelnetPlugins: `
    <p>Starsze polecenie telnet <strong>plugins</strong>. W nowych skryptach preferuj <strong>Zapytanie urządzenia</strong> z gotowym ustawieniem <code>telnet:plugins</code>.</p>
  `,
  helpBodySystemTelnetFree: `
    <p>Starsze polecenie telnet <strong>free</strong> (pamięć). W nowych skryptach preferuj <strong>Zapytanie urządzenia</strong> z gotowym ustawieniem <code>telnet:free</code>.</p>
  `,

  // ── Step Help modal: per-action fallback bodies (inline HTML) ──
  helpFallbackQuery: `
    <p>
      Wykonuje odczyt z urządzenia: albo zwykłe <strong>ECP GET</strong> na ścieżce <code>/query/…</code>, albo
      endpoint w stylu dev, taki jak <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Wybierz gotowe ustawienie dla typowych endpointów lub <strong>Niestandardowy</strong>, aby wpisać własny.</p>
  `,
  helpFallbackPost: `
    <p>
      Wysyła <strong>HTTP POST</strong> do Roku na stałej ścieżce analityki / beacon. Każde gotowe ustawienie odpowiada
      określonemu endpointowi używanemu w procesach deweloperskich.
    </p>
  `,
  helpFallbackKeypress: `
    <p>
      Wysyła <strong>klawisz pilota</strong> przez ECP. Tytuł pomocy odzwierciedla, który klawisz jest aktualnie wybrany, gdy
      otwierasz to okno dialogowe.
    </p>
  `,
  helpFallbackInputText: `
    <p>
      Wysyła <strong>tekst w stylu klawiatury</strong> do urządzenia (wprowadzanie tekstu ECP). Znaki odbiera aktywne pole lub ekranowa
      klawiatura.
    </p>
  `,
  helpFallbackLaunch: `
    <p>
      Uruchamia kanał według <strong>app ID</strong>. Opcjonalne <strong>parametry</strong> mogą dostarczyć Deep-Link lub argumenty
      uruchomienia zależnie od kanału.
    </p>
  `,
  helpFallbackSideload: `
    <p>
      Przesyła pakiet ze <strong>ścieżki pliku</strong> i instaluje go jako deweloperski kanał sideload. Podaj
      hasło deweloperskie na kroku lub przez <code>devPassword</code> w skrypcie, gdy jest to wymagane.
    </p>
  `,
  helpFallbackDeleteSideload: `
    <p>Usuwa deweloperski kanał sideload. Opcjonalne hasło odpowiada ustawieniom zabezpieczeń dev Twojego urządzenia.</p>
  `,
  helpFallbackAppFunction: `
    <p>
      Wywołuje <strong>funkcję BrightScript</strong> przez App Connector. Podtytuł pokazuje <strong>wybraną
      funkcję</strong>. Parametry odpowiadają eksportowanej sygnaturze kanału; użyj <strong>Ustaw zmienną</strong>, aby przechwycić
      zwracaną wartość dla późniejszych kroków.
    </p>
  `,
  helpFallbackRaleCommand: `
    <p>
      Uruchamia <strong>wbudowane polecenie RALE</strong>. Podtytuł pokazuje wybrane polecenie; rozszerzony opis pochodzi
      z wbudowanego opisu polecenia, gdy jest dostępny.
    </p>
  `,
  helpFallbackDevicePerformance: `
    <p>
      Wykonuje zrzut wykresów <strong>Wydajności urządzenia</strong> dla <strong>tego samego urządzenia</strong>, na którym działa ten skrypt (to
      samo połączenie co Zapytanie urządzenia i naciśnięcie klawisza). Wartości są zgodne z ustawieniami historii Remote Section, gdy odpytywanie na żywo
      wypełniło wykresy; w przeciwnym razie krok czeka krótko na świeżą próbkę, gdy jest to potrzebne.
    </p>
    <h4>Wykres</h4>
    <p>
      <strong>Obiekty BrightScript</strong>, <strong>Użycie CPU</strong>, <strong>Pamięć systemowa</strong> lub
      <strong>Wszystko razem</strong> (jeden połączony wynik: CPU, potem pamięć, potem obiekty). CPU i pamięć pochodzą z
      tego samego odpytywania wydajności kanału.
    </p>
    <h4>Opcjonalna etykieta</h4>
    <p>Pokazywana w nagłówku wyników, podobnie jak w kroku zrzutu ekranu.</p>
  `,
  helpFallbackScreenshot: `
    <p>
      Przechwytuje obraz telewizora przez <strong>Developer App</strong>. Developer App powinien być aktywny; na kroku,
      w skrypcie lub w monicie walidacji musi być dostępne hasło deweloperskie.
    </p>
    <h4>Czekaj przed (ms)</h4>
    <p>
      Pauza w Wykonawcy <strong>przed</strong> rozpoczęciem przechwytywania, aby UI mógł się ustabilizować (domyślnie 100 ms, gdy dodajesz
      krok).
    </p>
    <h4>Czekaj po (ms)</h4>
    <p>
      Po wyzwoleniu przechwytywania Wykonawca czeka przed pobraniem <code>dev.jpg</code>. Zwiększ, jeśli obrazy są
      ucięte; puste używa domyślnie <strong>1500 ms</strong>.
    </p>
    <h4>Opcjonalna etykieta</h4>
    <p>Pomaga zidentyfikować ten zrzut w wyniku wykonania, gdy skrypt robi wiele zrzutów ekranu.</p>
  `,
  helpFallbackWait: `
    <p>
      Albo <strong>stałe opóźnienie</strong>, albo <strong>dopóki warunek jest spełniony</strong>. Podtytuł odzwierciedla
      bieżący typ oczekiwania, a dla warunków — źródło danych (odtwarzacz multimediów lub pole węzła RALE).
    </p>
  `,
  helpFallbackIf: `
    <p>
      Rozgałęzia się na listy kroków <strong>wtedy</strong> / <strong>inaczej</strong> przy użyciu jednorazowego warunku. Podtytuł
      odzwierciedla wybrane źródło warunku (odtwarzacz multimediów, aktywna aplikacja, pole RALE lub zmienne). Wymaga wersji
      skryptu 2.
    </p>
  `,
  helpFallbackSystemTelnet: `
    <p>
      <strong>Starszy</strong> krok tylko dla telnet. W nowych skryptach preferuj <strong>Zapytanie urządzenia</strong> z <code>telnet:plugins</code> lub
      <code>telnet:free</code>.
    </p>
  `,

  // ── Step Help modal: composed / interpolated body fragments (dynamic values pre-escaped) ──
  helpQueryPresetBody: (label: string, endpoint: string): string => `
    <p>
      Wykonuje <strong>Zapytanie urządzenia</strong> dla <strong>${label}</strong> przy użyciu endpointu
      <code>${endpoint}</code>.
    </p>
    <p>
      Jak wszystkie zapytania, to również używa ECP (lub ścieżki dev-plugin aplikacji dla gotowych ustawień w stylu telnet). Urządzenie musi być
      osiągalne w sieci.
    </p>
  `,
  helpPostPresetBody: (label: string, endpoint: string): string => `
    <p>
      Wysyła HTTP <strong>POST</strong> do <code>${endpoint}</code> (<strong>${label}</strong>).
    </p>
    <p>Użyj tego dla procesów analityki / beacon, które oczekują POST zamiast GET.</p>
  `,
  helpSelectedFunction: (fn: string): string =>
    `<p><strong>Wybrana funkcja:</strong> <code>${fn}</code></p>`,
  helpAppFunctionDescription: (desc: string): string =>
    `<p><strong>Opis funkcji aplikacji:</strong> ${desc}</p>`,
  helpAppFunctionArgs:
    '<p>Wiersze argumentów są zgodne z metadanymi App Connector dla tej funkcji; typy złożone używają JSON w polu.</p>',
  helpCurrentKey: (nice: string, key: string): string => `
        <p>
          <strong>Bieżący klawisz:</strong> ${nice} (<code>${key}</code>) — wysyłany jako standardowe naciśnięcie klawisza ECP
          podczas wykonywania kroku.
        </p>
      `,

  // ── Builder: additional field placeholders / option fallbacks ──
  placeholderQueryEndpoint: '/query/… lub telnet:plugins / telnet:free',
  placeholderVariablePathExample: 'myVar lub data.items.0.id',
  optionUnknownFunction: 'nieznana',

  // ── Executor: step descriptions (stepDescription; result-card header + list rows) ──
  descQuery: (endpoint: string): string => `Zapytanie ${endpoint}`,
  descKeypress: (key: string): string => `Naciśnięcie klawisza ${key}`,
  descSendText: (text: string): string => `Wyślij tekst "${text}"`,
  descLaunchApp: (appId: string): string => `Uruchom aplikację ${appId}`,
  descSideload: (filename: string): string => `Sideload ${filename}`,
  descDeleteSideload: 'Usuń sideload',
  descAppFunction: (fn: string): string => `Funkcja aplikacji ${fn}`,
  descScreenshot: 'Zrzut ekranu',
  descScreenshotLabel: (label: string): string => `Zrzut ekranu (${label})`,
  descScreenshotWaitAfter: (ms: number): string => `Zrzut ekranu (czekaj po: ${ms}ms)`,
  descDevicePerformance: (chart: string): string => `Wydajność urządzenia — ${chart}`,
  descDevicePerformanceLabel: (label: string, chart: string): string =>
    `Wydajność urządzenia (${label}) — ${chart}`,
  descWait: 'Oczekiwanie',
  descWaitWithDetails: (details: string): string => `Oczekiwanie · ${details}`,
  descIf: 'If (…)',
  descIfWithDetails: (details: string): string => `If · ${details}`,

  // ── Executor: wait-step Details column (formatWaitStepListDetails) ──
  waitDetailFixedDelay: (delayMs: number): string => `Stałe opóźnienie ${delayMs} ms`,
  waitDetailTiming: (maxSec: number, pollMs: number): string =>
    ` · maks. ${maxSec}s · odpyt. ${pollMs}ms`,
  waitDetailMediaPlayerState: (state: string): string =>
    `Odtwarzacz multimediów · do stanu "${state}"`,
  waitDetailMediaPlayerCheck: (check: string): string => `Odtwarzacz multimediów · aż ${check}`,
  waitDetailRale: (line: string): string => `Pole węzła RALE · ${line}`,
  waitDetailRaleIncomplete: 'Pole węzła RALE · (niekompletne)',
  waitDetailGenericSource: (src: string): string => `Oczekiwanie · źródło ${src}`,

  // ── Executor: if-step Details column (formatIfStepListDetails) ──
  ifDetailMediaPlayerState: (state: string): string => `Odtwarzacz multimediów · stan "${state}"`,
  ifDetailMediaPlayerCheck: (check: string): string => `Odtwarzacz multimediów · ${check}`,
  ifDetailRale: (line: string): string => `Pole węzła RALE · ${line}`,
  ifDetailRaleEmpty: 'Pole węzła RALE · …',
  ifDetailVariable: (path: string): string => `Zmienna · $${path}`,
  ifDetailVariableEmpty: 'Zmienna · …',
  ifDetailActiveApp: (attr: string): string => `Aktywna aplikacja · ${attr}`,
  ifDetailActiveAppEmpty: 'Aktywna aplikacja · …',

  // ── Executor: results-panel progress log lines (onLog) ──
  logWaitingMs: (ms: number): string => `Oczekiwanie ${ms} ms...`,
  logWaitingBeforeCapture: (ms: number): string => `Oczekiwanie ${ms} ms przed przechwyceniem...`,
  logPollingFieldMet: (elapsed: number, field: string): string =>
    `Odpytywanie... (${elapsed}s) — pole "${field}" — warunek spełniony`,
  logPollingField: (elapsed: number, field: string, value: string): string =>
    `Odpytywanie... (${elapsed}s) — pole "${field}": ${value}`,
  logPollingStatusMet: (elapsed: number, status: string): string =>
    `Odpytywanie... (${elapsed}s) — ${status} — warunek spełniony`,
  logPollingStatus: (elapsed: number, status: string): string =>
    `Odpytywanie... (${elapsed}s) — ${status}`,
  pollValueEmpty: '(puste)',
  pollValueReconnecting: '(ponowne łączenie...)',
  pollValueNoResponse: '(brak odpowiedzi)',
  pollStateValue: (state: unknown): string => `stan: ${state}`,
  pollStateNone: 'stan: (brak)',
  pollInvalidMediaPlayer: 'Nieprawidłowa odpowiedź media-player',
  pollQueryFailed: (err: string): string => `Zapytanie nie powiodło się: ${err}`,
  pollNoResponse: 'Brak odpowiedzi',
  logConnectingTelnet: 'Łączenie z Telnet (port 8080)...',
  logQueryUsesDevTelnet: (ep: string, cmd: string): string =>
    `Zapytanie urządzenia "${ep}" używa dev Telnet "${cmd}" (tak samo jak karta Zapytanie).`,
  logPartialPerformance: 'Niektóre sekcje wydajności były niedostępne; częściowy zrzut.',

  // ── Executor: step result summaries (onLog) ──
  stepSummaryChars: (n: number): string => `→ ${n} znaków`,
  stepSummaryOk: '→ OK',
  stepSummarySentKey: (key: string): string => `→ wysłano ${key}`,
  stepSummarySent: '→ wysłano',
  stepSummaryLaunched: (appId: string): string => `→ uruchomiono ${appId}`,
  stepSummarySideloadComplete: '→ sideload zakończony',
  stepSummaryDeleted: '→ usunięto',
  stepSummarySaveFailed: (err: string): string => `→ zapis nie powiódł się: ${err}`,
  stepSummarySavedAs: (filename: string): string => `→ zapisano jako ${filename}`,
  stepSummaryCapturedNoFolder: '→ przechwycono (brak folderu zapisu)',
  stepSummaryChartImages: (n: number): string => `→ ${n} obraz(ów) wykresu`,
  stepSummaryCaptured: '→ przechwycono',
  stepSummarySkipped: (reason: string): string => `→ pominięto (${reason})`,

  // ── Executor: step errors / skip reasons (result.error / skippedReason) ──
  errWaitTimeout: 'Przekroczono limit czasu oczekiwania',
  errStopped: 'Zatrzymano',
  skipReasonNoAppConnector: 'App Connector niedostępny',
  errNoAppConnectorRaleWait: 'App Connector niedostępny dla oczekiwania na węzeł RALE',
  errUnknownActionType: (type: string): string => `Nieznany typ akcji: ${type}`,
  errInvalidRaleCommand: 'Nieprawidłowe polecenie RALE',
  errTelnetNotAvailable: 'Polecenia systemowe Telnet nie są dostępne w tym kontekście',
  errSaveNotAvailable: 'Zapis niedostępny',
  errCouldNotVerifyDevApp: (err: string): string =>
    `Nie udało się zweryfikować stanu Dev App przed zrzutem ekranu: ${err}`,
  errInvalidPath: 'Nieprawidłowa ścieżka',
  errStepPreorderMismatch: 'Błąd wewnętrzny: niezgodność preorder kroków',

  // ── Settings: Action Script default-folder picker (main process) ──
  pickDefaultFolderTitle: 'Domyślny folder dla wyjścia Action Script'
};

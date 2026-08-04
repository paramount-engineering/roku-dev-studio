/**
 * Polish (pl) translation of the global modals catalog.
 * Mirrors the exact shape of shared/strings/modals.ts — same keys, order, and
 * function signatures/placeholders. Only literal display text is translated.
 */
export const modals = {
  // Release Notes modal
  releaseNotes: 'Uwagi do wydania',
  versionedReleaseNotes: (title: string): string => `${title} · Uwagi do wydania`,
  openReleasePage: 'Otwórz stronę wydania',
  loadingReleaseNotes: 'Ładowanie uwag do wydania…',
  noReleaseNotes: 'Brak uwag do tego wydania.',
  couldNotLoadReleaseNotes: 'Nie udało się teraz załadować uwag do wydania.',
  latestRelease: 'Najnowsze wydanie',
  unknownError: 'Nieznany błąd',

  // Update banner — update available
  updateAvailableTitle: (version?: string): string =>
    `Roku Dev Studio ${version ? `v${version}` : 'aktualizacja'} dostępna`,
  newVersionReady: 'Nowa wersja jest gotowa do pobrania.',
  dismissUpdateNotification: 'Zamknij powiadomienie o aktualizacji',
  later: 'Później',
  download: 'Pobierz',

  // Update banner — downloading
  downloadingUpdate: 'Pobieranie aktualizacji…',
  pleaseWaitDownloading: 'Poczekaj, aż aktualizacja zostanie pobrana.',

  // Update banner — ready to install
  updateReadyTitle: (version?: string): string =>
    `Roku Dev Studio ${version ? `v${version}` : 'aktualizacja'} gotowa`,
  installedOnRestart: 'Zostanie zainstalowana po ponownym uruchomieniu.',
  restartAndInstall: 'Uruchom ponownie i zainstaluj',

  // Update banner — manual download / error
  newUpdateAvailable: 'Dostępna nowa aktualizacja',
  pleaseDownloadLatest: 'Pobierz najnowsze wydanie, aby zaktualizować.',
  dismiss: 'Zamknij',
  updateError: 'Błąd aktualizacji',
  updateCheckFailed: 'Nie udało się sprawdzić aktualizacji.',

  // "Check for Updates" — no update found toast
  upToDate: (version?: string): string => `Masz najnowszą wersję${version ? ` (v${version})` : ''}.`,

  // Welcome-screen feature detail modals — longer blurb + capability bullets per tile.
  // (Keyed by the feature title so the component can look each up by the tile's live title.)
  features: {
    deviceDiscovery: {
      blurb:
        'Roku Dev Studio nieustannie skanuje Twoją sieć lokalną za pomocą SSDP, dzięki czemu każdy Roku w tej samej podsieci pojawia się automatycznie — bez konieczności wpisywania IP.',
      points: [
        'Automatycznie wykrywa modele, nazwy i adresy IP urządzeń Roku',
        'Oznacza, które urządzenia mają włączony Tryb programisty',
        'Odświeża się, gdy urządzenia dołączają do sieci lub ją opuszczają',
        'Jedno kliknięcie, aby połączyć się i rozpocząć pracę',
      ],
    },
    appsDeepLinking: {
      blurb:
        'Przeglądaj każdy kanał zainstalowany na podłączonym Roku, uruchamiaj dowolny z nich natychmiast i testuj Deep-Links z niestandardowymi parametrami treści i typu mediów.',
      points: [
        'Siatka zainstalowanych aplikacji (plus wejścia TV w telewizorach Roku TV)',
        'Uruchamianie z siatki lub według ID aplikacji',
        'Deep-Link z contentId / mediaType do testowania uruchamiania treści',
        'Kopiowanie surowej listy ID + wersji wszystkiego, co zainstalowano',
      ],
    },
    devApp: {
      blurb:
        'Wgrywaj (sideload), steruj i inspekcjonuj swój kanał deweloperski od początku do końca — od przesłania pliku zip po zrzuty ekranu na żywo z tego, co jest na ekranie.',
      points: [
        'Wgraj (sideload) kanał deweloperski .zip za pomocą hasła programisty',
        'Uruchom lub usuń wgraną aplikację',
        'Rób zrzuty ekranu na żądanie lub automatycznie',
        'Kopiuj, pobieraj lub usuwaj przechwycone obrazy',
      ],
    },
    appConnector: {
      blurb:
        'Wywołuj zdalnie funkcje BrightScript w swoim wgranym kanale i sprawdzaj ich wartości zwracane — testuj ścieżki kodu bez dotykania pilota.',
      points: [
        'Wywołuj eksportowane funkcje po nazwie z argumentami',
        'Sprawdzaj zwracane wartości bezpośrednio na miejscu',
        'Działa na aktywnym kanale deweloperskim',
      ],
    },
    fiddle: {
      blurb:
        'Brudnopis dla BrightScript: pisz fragmenty kodu w pełnym edytorze Monaco i uruchamiaj je na podłączonym urządzeniu z lintingiem na żywo.',
      points: [
        'Edytor Monaco z podświetlaniem składni',
        'Informacje z lintera na żywo podczas pisania',
        'Uruchamianie na podłączonym Roku jednym kliknięciem',
        'Otwiera się we własnym, dedykowanym oknie',
      ],
    },
    mcpServer: {
      blurb:
        'Udostępnij Roku Dev Studio agentom SI za pośrednictwem Model Context Protocol, aby asystenci mogli sterować Twoim urządzeniem w ramach Twojej pętli deweloperskiej.',
      points: [
        'Uruchamiaj aplikacje, naciskaj klawisze i rób zrzuty ekranu za pomocą narzędzi MCP',
        'Odpytuj stan urządzenia programowo',
        'Włącz agentów SI do swojego procesu testowania i debugowania',
      ],
    },
    deviceRemote: {
      blurb:
        'Pełny ekranowy pilot Roku — każdy przycisk fizycznego pilota, a także sterowanie klawiaturą i wprowadzanie tekstu.',
      points: [
        'D-pad, OK, Wstecz, Ekran główny, Opcje i Powtórka',
        'Sterowanie odtwarzaniem: odtwórz/wstrzymaj, przewijanie do tyłu, przewijanie do przodu',
        'Głośność, wyciszenie i zasilanie',
        'Wpisuj tekst bezpośrednio w pola na urządzeniu',
      ],
    },
    query: {
      blurb:
        'Odczytuj stan Roku na żywo przez ECP (External Control Protocol) — informacje o urządzeniu, stan odtwarzacza mediów, zainstalowane aplikacje i rejestr.',
      points: [
        'Informacje o urządzeniu: model, wersja i sieć',
        'Aktywna aplikacja i stan odtwarzania odtwarzacza mediów',
        'Lista zainstalowanych aplikacji',
        'Zawartość rejestru',
      ],
    },
    console: {
      blurb:
        'Przesyłaj na żywo strumień BrightScript Debug Output z Roku przez Telnet, z filtrowaniem i wyszukiwaniem, aby wydobyć dokładnie to, co ważne, a także podłącz pełny debugger BrightScript, gdy musisz przejść przez kod krok po kroku.',
      points: [
        'Strumień dziennika Telnet na żywo',
        'Filtrowanie i wyszukiwanie pełnotekstowe',
        'Kliknij URL/JSON/XML, aby wyświetlić je w czytelnej formie w oknie modalnym',
        'Zapisz dziennik do pliku',
        'Podłącz debugger — punkty przerwania, zmienne, stos wywołań i REPL',
      ],
    },
    actionScripts: {
      blurb:
        'Automatyzuj powtarzalne przepływy na urządzeniu, łącząc naciśnięcia klawiszy, uruchomienia aplikacji i wywołania RALE w jeden uruchamialny skrypt.',
      points: [
        'Sekwencjonuj naciśnięcia klawiszy, uruchomienia i oczekiwania',
        'Uwzględnij wywołania RALE w przepływie',
        'Uruchamiaj ponownie przepływy do testów regresji',
      ],
    },
    networkInspector: {
      blurb:
        'Przechwytuj i analizuj ruch HTTP/HTTPS aplikacji Dev App za pomocą wbudowanego proxy MITM — niczym karta sieciowa przeglądarki dla Twojego kanału.',
      points: [
        'Zobacz każde żądanie i odpowiedź wysyłane przez kanał',
        'Analizuj nagłówki, treści i czasy',
        'Odszyfruj HTTPS przez proxy MITM',
        'Grupuj według hosta lub przeglądaj sesje przez proxy',
      ],
    },
    remoteLocations: {
      blurb:
        'Łącz się z urządzeniami Roku, które nie znajdują się w Twojej sieci lokalnej, kierując ruch przez serwery przekaźnikowe.',
      points: [
        'Docieraj do urządzeń w dowolnym miejscu przez serwer przekaźnikowy',
        'Zarządzaj wieloma lokalizacjami zdalnymi',
        'Te same narzędzia co dla urządzeń lokalnych',
      ],
    },
  },

  // ── Global modal fragments (renderer/components/modals/fragments/*.html) ──
  // One sub-group per fragment. Only elements whose visible text is a single
  // text node (pure text, icon + label, or a pure-text child span) are keyed —
  // applyI18n's mixed-content path replaces just the first text node, so prose
  // with inline <strong>/<code>/<em>/<a>/kbd markup is intentionally NOT keyed
  // and keeps its inline English. Generic buttons reuse common.* (cancel, save,
  // add, clear, close).

  addLocation: {
    title: '🌐 Dodaj lokalizację zdalną',
    intro:
      'Łącz się z urządzeniami Roku w zdalnej lokalizacji za pośrednictwem Roku Relay Server działającego na Mac Mini lub innym komputerze.',
    nameLabel: 'Nazwa lokalizacji',
    namePlaceholder: 'np. Laboratorium biurowe, Studio B',
    nameHint: 'Przyjazna nazwa pozwalająca zidentyfikować tę lokalizację',
    hostLabel: 'Adres serwera',
    hostPlaceholder: '192.168.1.50 lub mac-mini.local',
    hostHint: 'Adres IP lub nazwa hosta Relay Server',
    portLabel: 'Port',
    portHint: 'Domyślny port to 4951',
    addBtn: 'Dodaj lokalizację',
  },

  actionScriptsImport: {
    title: 'Importuj skrypt akcji',
    uploadJsonLabel: 'Prześlij JSON',
    chooseFileBtn: 'Wybierz plik',
    savedScriptLabel: 'Zapisane skrypty',
    savedSelectPlaceholder: 'Wybierz zapisany Action Script',
    savedSelectEmpty: 'Brak zapisanych skryptów',
    pasteJsonLabel: 'Wklej lub edytuj JSON',
    outputFolderLabel: 'Folder wyjściowy',
    noFolderSelected: 'Nie wybrano folderu',
    chooseFolderBtn: 'Wybierz folder',
    outputWarning:
      'Jeśli nie wybrano folderu, artefakty (np. zrzuty ekranu) nie zostaną zapisane podczas uruchamiania skryptu.',
    devPasswordRequiredMsg: 'Ten skrypt wymaga hasła programisty. Wprowadź je poniżej.',
    devPasswordLabel: 'Hasło programisty',
    devPasswordPlaceholder: 'Wprowadź hasło programisty do kroków zrzutu ekranu / wgrywania (sideload)',
    rememberPasswordTitle: 'Zapisz hasło dla tego urządzenia (tak samo jak przechowywanie hasła Dev App)',
    rememberPasswordLabel: 'Zapamiętaj hasło dla tego urządzenia',
    devPasswordHintHtml:
      'Wymagane, gdy skrypt ma kroki zrzutu ekranu lub wgrywania (sideload) i nie zawiera pola <code>devPassword</code>.',
    validateImportBtn: 'Sprawdź i importuj',
  },

  deeplinkDeleteMediaType: {
    title: 'Usuń typ mediów',
    confirmHint: 'Usunąć typ mediów i te zapisane Deep-Links?',
    deleteAllBtn: 'Usuń wszystko',
  },

  deeplinkMediaTypes: {
    title: 'Zarządzaj typami mediów',
    hint: 'Wbudowane typy mediów są zawsze dostępne. Niestandardowe wpisy są zapisywane globalnie i pojawiają się w każdej karcie urządzenia.',
    builtinTitle: 'Wbudowane',
    builtinMovie: 'Film',
    builtinSeries: 'Serial',
    builtinEpisode: 'Odcinek',
    builtinLive: 'Na żywo',
    customTitle: 'Niestandardowe',
    addTitle: 'Dodaj typ mediów',
    displayNameLabel: 'Nazwa wyświetlana',
    displayNamePlaceholder: 'np. Film krótkometrażowy',
    ecpValueLabel: 'Wartość ECP',
    ecpValuePlaceholder: 'np. short-film',
  },

  deeplinkSavePreset: {
    title: 'Zapisz Deep-Link',
    hint: 'Nadaj temu Deep-Link nazwę, aby móc wybrać go z zapisanej listy na dowolnym urządzeniu.',
    nameLabel: 'Nazwa',
    namePlaceholder: 'np. Netflix · Odcinek 12',
  },

  devMode: {
    title: 'Włącz Tryb programisty na Roku',
    whatIsHeading: 'Czym jest Tryb programisty?',
    whatIsBody:
      'Tryb programisty pozwala wgrywać (sideload) i testować własne kanały Roku bezpośrednio na urządzeniu. Jego włączenie jest bezpłatne i daje dostęp do zaawansowanych narzędzi programistycznych.',
    stepsHeading: 'Kroki włączania Trybu programisty',
    pressSequenceHtml:
      'Na pilocie Roku naciśnij: <span class="help-kbd">Home</span> <span class="help-kbd">Home</span> <span class="help-kbd">Home</span> <span class="help-kbd">Up</span> <span class="help-kbd">Up</span> <span class="help-kbd">Right</span> <span class="help-kbd">Left</span> <span class="help-kbd">Right</span> <span class="help-kbd">Left</span> <span class="help-kbd">Right</span>',
    step2: 'Na Twoim telewizorze pojawi się okno Ustawień programisty',
    step3Html: 'Wybierz <strong>"Enable installer and restart"</strong>',
    step4: 'Zaakceptuj umowę licencyjną Developer SDK',
    step5Html: `Ustaw <strong>hasło serwera WWW</strong> (będzie potrzebne do wgrywania)`,
    step6: 'Twój Roku uruchomi się ponownie z włączonym Trybem programisty',
    afterHeading: 'Po włączeniu',
    afterIntro: 'Gdy Tryb programisty jest włączony:',
    afterBadgeHtml:
      'Twoje urządzenie pokaże plakietkę <span class="dev-badge enabled" style="font-size: 11px;"><span class="icon icon-xs"><svg><use href="#icon-wrench"/></svg></span> Dev</span> na liście urządzeń',
    afterSideloadHtml: 'Możesz wgrywać (sideload) pakiety kanałów .zip za pomocą karty <strong>Dev App</strong>',
    afterAppConnectorHtml: 'Użyj <strong>App Connector</strong>, aby komunikować się z kodem swojego kanału',
    afterQueryHtml: 'Uzyskaj dostęp do dodatkowych zapytań ECP na karcie <strong>Zapytania</strong>',
    moreHeading: 'Więcej informacji',
    moreBody: 'Szczegółową dokumentację znajdziesz w oficjalnej dokumentacji dla programistów Roku:',
  },

  ecpMode: {
    title: 'Sterowanie przez aplikacje mobilne na Roku',
    whyHeading: 'Dlaczego jest to potrzebne?',
    whyBodyHtml:
      'Funkcjonalność zdalnego sterowania (naciśnięcia klawiszy, aplikacje, szybki pilot, Wyślij tekst) korzysta z External Control Protocol (ECP) Roku. Ustawienie urządzenia <strong>Control by Mobile Apps → Network Access</strong> można ustawić na jeden z czterech trybów:',
    modeDisabledHtml: '<strong>Disabled</strong> – Sterowanie przez aplikacje mobilne jest wyłączone.',
    modeLimitedHtml:
      '<strong>Limited</strong> – Tylko wprowadzanie tekstu, uruchamianie aplikacji i odpytywanie aktywnej aplikacji; włączone dla adresów sieci prywatnej.',
    modePermissiveHtml:
      '<strong>Permissive</strong> – Pełne sterowanie; akceptuje polecenia tylko z sieci prywatnej lub tej samej podsieci.',
    modeEnabledHtml: '<strong>Enabled</strong> – Pełne sterowanie; włączone dla adresów sieci prywatnej.',
    howHeading: 'Jak zmienić to ustawienie',
    step1Html: 'Na urządzeniu Roku przejdź do <strong>Settings</strong> → <strong>System</strong>',
    step2Html: 'Otwórz <strong>Advanced System Settings</strong>',
    step3Html: 'Wybierz <strong>Control by Mobile Apps</strong>',
    step4Html: 'Wybierz <strong>Network Access</strong>',
    step5Html:
      'Wybierz <strong>Limited</strong>, <strong>Permissive</strong> lub <strong>Enabled</strong> (ta aplikacja dostosowuje się do trybu)',
    afterHeading: 'Po zmianie',
    afterBodyHtml:
      'Przy <strong>Limited</strong> Wyślij tekst, uruchamianie aplikacji i zapytania do aplikacji działają; pełna obsługa klawiszy pilota może nie. Przy <strong>Permissive</strong> lub <strong>Enabled</strong> działa pełne zdalne sterowanie. W przypadku Permissive upewnij się, że ten komputer jest w tej samej podsieci co Roku, jeśli polecenia nie działają. Po zmianie ustawienia nie jest wymagane ponowne uruchomienie.',
  },

  keyboardRemoteHelp: {
    title: 'Pilot klawiaturowy',
    introHtml:
      'Skróty działają tylko wtedy, gdy ta karta urządzenia znajduje się na karcie <strong>Pilot</strong> lub <strong>Dev App</strong>.',
    tableCaption: 'Skróty przypisane do pilota Roku',
    colKey: 'Klawisz',
    colAction: 'Akcja pilota',
    actionNavigate: 'Nawigacja (w górę, w dół, w lewo, w prawo)',
    actionSelect: 'Wybierz / OK',
    actionBack: 'Wstecz',
    actionHome: 'Ekran główny',
    actionPlayPause: 'Odtwórz / Wstrzymaj',
    actionRewind: 'Przewiń do tyłu',
    actionForward: 'Przewiń do przodu',
    actionOptions: 'Opcje (Info)',
    actionReplay: 'Powtórka natychmiastowa',
    actionVolumeUp: 'Zwiększ głośność',
    actionVolumeDown: 'Zmniejsz głośność',
    actionMute: 'Wycisz',
    actionPower: 'Zasilanie',
    footnote:
      'Wyłącz Pilot klawiaturowy w Ustawieniach, jeśli nie chcesz, aby klawisze strzałek i inne przypisane klawisze wysyłały naciśnięcia do Roku.',
  },

  secretScreens: {
    title: 'Sekretne ekrany Roku',
    introHtml: `
            Urządzenia Roku mają wbudowane menu diagnostyczne i deweloperskie dostępne za pomocą sekwencji przycisków pilota.
            Z <strong>Ekranu głównego</strong> Roku naciśnij przyciski pokazane w każdym wierszu, używając
            <strong>fizycznego pilota</strong> (pilot na podczerwień lub głosowy).
          `,
    ecpLimitationTitle: 'Ograniczenie ECP',
    ecpLimitationBodyHtml: `
              Roku nie zawsze niezawodnie interpretuje wszystkie sekwencje sekretnych ekranów wysyłane przez ECP. Jeśli
              sekwencja nie otwiera się przez <strong>Wykonaj sekwencję</strong>, użyj <strong>fizycznego pilota</strong>.
            `,
    sectionTitle: 'Sekretne ekrany',
  },

  integrationGuide: {
    title: 'Przewodnik integracji',
    whatIsHeading: 'Czym jest TrackerTask?',
    whatIsBodyHtml: `
            <strong>TrackerTask</strong> to komponent BrightScript pierwotnie stworzony dla <strong>RALE (Roku Advanced
              Layout Editor)</strong> -
            oficjalne narzędzie deweloperskie Roku do inspekcji i debugowania aplikacji SceneGraph w czasie rzeczywistym.
          `,
    trackerTaskEnabling:
      'TrackerTask nawiązuje połączenie gniazda (socket) między Twoją aplikacją Roku a narzędziami zewnętrznymi, umożliwiając:',
    enablingPoint1: 'Inspekcję i modyfikację węzłów w czasie rzeczywistym',
    enablingPoint2: 'Podgląd granic elementów UI na żywo',
    enablingPoint3: 'Zarządzanie rejestrem',
    enablingPoint4: 'Rejestrowanie i debugowanie',
    extendsBody:
      'App Connector rozszerza tę funkcjonalność o dwie niestandardowe funkcje, które pozwalają udostępniać i wykonywać niestandardowe funkcje BrightScript Twojej aplikacji z tego narzędzia desktopowego.',
    customFunctionsHeading: 'Niestandardowe funkcje dla App Connector',
    customFunctionsBody:
      'Do TrackerTask dodano dwie funkcje, aby włączyć funkcjonalność App Connector:',
    implementingHeading: 'Implementacja w Twojej scenie',
    implementingBodyHtml: `
            Plik <strong>MainScene.xml</strong> Twojej aplikacji musi zadeklarować dwie funkcje interfejsu, które
            wywoła TrackerTask:
          `,
    getExternalHeading: 'Implementacja GetExternalControlFunctions',
    getExternalBodyHtml: `
            Ta funkcja musi zwrócić <strong>roArray</strong> tablic asocjacyjnych, gdzie każdy element opisuje
            funkcję:
          `,
    supportedParamsBodyHtml: `
              <strong>Boolean</strong> · <strong>Integer</strong> · <strong>LongInteger</strong> ·
              <strong>Float</strong> ·
              <strong>Double</strong> · <strong>String</strong> · <strong>roAssociativeArray</strong> ·
              <strong>roArray</strong> · <strong>roList</strong>
            `,
    supportedParamsTitle: '📝 Obsługiwane typy parametrów',
    executeFunctionHeading: 'Implementacja ExecuteFunction',
    executeFunctionBody:
      'Ta funkcja odbiera nazwę funkcji i tablicę parametrów, a następnie kieruje je do odpowiedniego obsługującego:',
    setupHeading: 'Konfiguracja TrackerTask',
    setupBody: 'Dodaj komponent TrackerTask do swojego projektu i utwórz jego instancję w MainScene:',
    setupPlaceHtml: `
            Umieść plik <code>TrackerTask.xml</code> w katalogu <code>components/</code> swojej aplikacji.
          `,
    saveBtn: 'Zapisz TrackerTask.xml',
    copyBtn: 'Kopiuj informacje o integracji',
  },

  helpModal: {
    title: 'Pomoc i przewodnik użytkownika',
    navAriaLabel: 'Sekcje pomocy',
    navDeviceDiscovery: 'Wykrywanie urządzeń',
    navRemoteControl: 'Zdalne sterowanie',
    navApps: 'Aplikacje',
    navQuery: 'Zapytania',
    navDevApp: 'Dev App',
    navConsole: 'Konsola',
    navAppConnector: 'App Connector',
    navActionScripts: 'Skrypty akcji',
    navDevicePerformance: 'Wydajność urządzenia',
    navNetworkInspector: 'Inspektor sieci',
    navAiAgents: 'Agenci SI (MCP)',
    navFiddle: 'BrightScript Fiddle',
    navLogViewer: 'Przeglądarka plików dziennika',
    navSecretScreens: 'Sekretne ekrany',
    navSettings: 'Ustawienia',
    navRemoteLocations: 'Lokalizacje zdalne',
    navSideloadRelay: 'Sideload Relay',
    navTips: 'Wskazówki',

    deviceDiscoveryHeading: 'Wykrywanie urządzeń',
    deviceDiscoveryScanHtml: `Kliknij <strong>Skanuj</strong>, aby automatycznie wykryć urządzenia Roku w Twojej sieci. Urządzenia z włączonym Trybem programisty pokażą zieloną plakietkę „Dev”.`,
    deviceDiscoveryNoScanHtml: `<strong>Skanowanie nic nie znajduje?</strong> Multicast SSDP (port UDP 1900) może być blokowany przez VPN, firmowe Wi‑Fi lub reguły zapory — spróbuj funkcji Połącz ręcznie z adresem IP urządzenia. Komputer i Roku muszą być w tej samej osiągalnej sieci.`,
    deviceDiscoveryManual:
      'Możesz też połączyć się ręcznie, wpisując adres IP w sekcji „Połączenie ręczne” na dole paska bocznego.',

    remoteControlHeading: 'Zdalne sterowanie',
    remoteControlIntroHtml: `Użyj wirtualnego pilota, aby sterować swoim Roku. Opcjonalne skróty klawiszowe są dostępne po włączeniu <strong>Ustawienia → Ogólne → Pilot Roku - używaj klawiatury </strong> (domyślnie wyłączone). Działają na karcie <strong>Pilot</strong> (samodzielnie lub w układzie poczwórnym wydajności urządzenia) albo na karcie <strong>Dev App</strong>, tylko dla otwartej karty urządzenia — nie w innych sekcjach, polach tekstowych ani oknach modalnych.`,
    remoteControlTabHtml: `Na karcie <strong>Pilot</strong> lub <strong>Dev App</strong> naciśnij <span class="help-kbd">Tab</span> z poziomu przycisków pilota (nie z zakładek sekcji ani innego pola tekstowego), aby przejść do pola <strong>Wyślij tekst</strong>. <span class="help-kbd">Enter</span> wysyła z tego pola.`,
    remoteControlMediaHtml: `Elementy sterowania multimediami (Przewiń do tyłu, Odtwórz/Wstrzymaj, Przewiń do przodu) oraz przyciski głośności są także dostępne na wirtualnym pilocie. Użyj pola <strong>Wyślij tekst</strong> na dole, aby wpisywać tekst bezpośrednio w aktywne pole tekstowe urządzenia.`,
    scNavigation: 'Nawigacja',
    scForward: 'Przewiń do przodu',
    scSelect: 'Wybierz / OK',
    scRewind: 'Przewiń do tyłu',
    scBack: 'Wstecz',
    scReplay: 'Powtórka natychmiastowa',
    scHome: 'Ekran główny',
    scVolume: 'Zwiększ / zmniejsz głośność',
    scPlayPause: 'Odtwórz / Wstrzymaj',
    scMute: 'Wycisz',
    scOptions: 'Menu opcji',
    scPower: 'Zasilanie',

    appsHeading: 'Aplikacje',
    appsListHtml: `
            <li><strong>Uruchamianie niestandardowe</strong> - Uruchom dowolną aplikację według ID, w tym wejścia TV (HDMI 1-4)</li>
            <li><strong>Deep Link</strong> - Uruchamiaj aplikacje z określoną treścią za pomocą deep linkingu (App ID, Content ID, Media Type)</li>
            <li><strong>Surowa lista aplikacji</strong> - Wyświetl surową listę XML wszystkich zainstalowanych aplikacji</li>
          `,
    appsBody:
      'Zobacz wszystkie aplikacje zainstalowane na urządzeniu Roku. Kliknij dowolną aplikację, aby ją uruchomić. Użyj wyszukiwania, aby filtrować aplikacje według nazwy.',

    queryHeading: 'Zapytania',
    queryListHtml: `
            <li><strong>Zapytania urządzenia</strong> - Gotowe ustawienia typowych zapytań, takich jak Device Info, Apps, Active App, Media Player i inne</li>
            <li><strong>Zapytania deweloperskie</strong> - Zaawansowane zapytania dla urządzeń z Trybem programisty (SG Nodes, Plugins, Frame Rate, Channel Perf, App State, Registry)</li>
            <li><strong>Zapytanie niestandardowe</strong> - Wprowadź dowolny niestandardowy punkt końcowy ECP</li>
          `,
    queryIntro: 'Odpytuj informacje o urządzeniu za pomocą punktów końcowych ECP Roku:',
    queryResults:
      'Wyniki są wyświetlane w panelu Wyniki poniżej. Dostępne są także punkty końcowe POST (śledzenie SGRendezvous, FW Beacons).',

    devAppHeading: 'Dev App',
    devAppListHtml: `
            <li><strong>Uwierzytelnianie</strong> - Wprowadź i zweryfikuj hasło programisty Roku. Włącz „Zapamiętaj”, aby zachować je między sesjami</li>
            <li><strong>Wgrywanie (sideload)</strong> - Zainstaluj pakiety kanału .zip lub .pkg</li>
            <li><strong>Remote</strong> - Wyświetl stronę instalatora internetowego urządzenia z dodatkowymi opcjami deweloperskimi</li>
            <li><strong>Zrzut ekranu</strong> - Rób zrzuty ekranu z działającej aplikacji Dev App</li>
            <li><strong>Usuń</strong> - Usuń wgrany kanał</li>
          `,
    devAppIntro: 'Dla urządzeń z włączonym Trybem programisty:',
    devAppNote: 'Potrzebne będzie hasło programisty Roku (ustawione podczas konfiguracji Trybu programisty).',

    consoleHeading: 'Konsola',
    consoleListHtml: `
            <li><strong>Połącz / Rozłącz</strong> - Nawiąż lub zamknij połączenie telnet</li>
            <li><strong>Znajdź / Filtruj</strong> - Przeszukuj dzienniki z opcjami rozróżniania wielkości liter, całych słów i dopasowania wyrażeń regularnych</li>
            <li><strong>Automatyczne przewijanie</strong> - Automatycznie przewijaj do najnowszego wyniku</li>
            <li><strong>Kopiuj / Zapisz</strong> - Kopiuj wszystkie dzienniki do schowka lub zapisz do pliku</li>
            <li><strong>Wyczyść</strong> - Wyczyść wyjście konsoli</li>
          `,
    consoleIntro: 'Połącz się z konsolą debugowania BrightScript przez Telnet (port 8085):',
    consoleNote:
      'Wymaga włączonego Trybu programisty. Na jedno urządzenie może być aktywne tylko jedno połączenie Telnet naraz.',

    appConnectorHeading: 'App Connector',
    appConnectorListHtml: `
            <li><strong>Połącz</strong> - Nawiązuje połączenie gniazda (socket) z działającą aplikacją Dev App (domyślny port <code>49200</code>)</li>
            <li><strong>Wykonaj funkcję</strong> - Wywołuj niestandardowe funkcje udostępnione przez <code>GetExternalControlFunctions</code> Twojej sceny</li>
            <li><strong>Odpowiedź</strong> - Przeglądaj wartości zwracane i wyjście debugowania</li>
            <li><strong>Aktualizuj węzeł</strong> - Po uruchomieniu <em>Get Node by ID</em> panel odpowiedzi oferuje okno modalne aktualizacji węzła, w którym możesz wykonać <code>selectNode</code>, <code>setField</code> lub <code>removeField</code> na dopasowanym węźle</li>
            <li><strong>Wbudowane polecenia RALE</strong> - Lista rozwijana funkcji zawiera także wbudowane polecenia RALE: <em>Get Node by ID</em>, <em>Get Node by SubType</em> oraz edytor rejestru (<em>Get All Sections</em>, <em>Add/Update Section</em>, <em>Remove Section</em>, <em>Set / Edit / Remove Section Key</em>, <em>Clear All Sections</em>)</li>
          `,
    appConnectorFooterHtml: `Twoja aplikacja Roku musi mieć zintegrowany TrackerTask. Kliknij <strong>Przewodnik integracji</strong> na karcie App Connector, aby uzyskać fragmenty kodu BrightScript i obsługiwane typy parametrów. Użyj <strong>Zapisz TrackerTask.xml</strong> z tego samego okna modalnego, aby dodać gotową do wdrożenia kopię do swojego kanału.`,
    appConnectorIntro:
      'Łącz się z aplikacjami Roku, które implementują komponent TrackerTask do komunikacji dwukierunkowej:',

    actionScriptsHeading: 'Skrypty akcji',
    actionScriptsBuilderHtml: `<strong>Kreator</strong> - Wizualnie twórz skrypty akcji akcja po akcji:`,
    actionScriptsBuilderListHtml: `
            <li><strong>Typy akcji</strong> - Naciśnięcie klawisza, Wyślij tekst, Uruchom aplikację, Zapytanie urządzenia, POST, Wgraj (sideload), Usuń wgrany kanał, Zrzut ekranu, Funkcja aplikacji, Polecenie RALE, przechwytywanie Wydajności urządzenia, Czekaj, Jeśli</li>
            <li><strong>Zmienne (skrypt v2)</strong> - Użyj kroku <em>Ustaw zmienną</em> lub <code>assignToVar</code> w Zapytaniu urządzenia / Funkcji aplikacji / Poleceniu RALE, aby zapamiętać wartości, a następnie odwołuj się do nich jako <code>\${name}</code> w polach późniejszych kroków (tekst, parametry, treść deep-link itp.)</li>
            <li><strong>If / Else if / Else (skrypt v2)</strong> - Rozgałęziaj na podstawie warunków opartych na stanie <code>media-player</code>, aktywnej aplikacji, polu węzła RALE lub przechowywanej zmiennej; zagnieżdżaj kroki <em>Jeśli</em> dla gałęzi wielokrokowych</li>
            <li><strong>Warunki oczekiwania</strong> - <em>Czekaj</em> może być stałym <code>delayMs</code> lub czekać, aż warunek stanie się prawdziwy: stan <em>media-player</em> lub <em>pole węzła RALE</em> (odpytuj <code>getNodeById</code> i porównuj pole operatorami takimi jak <code>equals</code>, <code>contains</code>, <code>matches</code>, <code>hasAnyValue</code>) z opcjonalnymi <code>timeoutMs</code> i <code>pollIntervalMs</code></li>
            <li><strong>Krok Wydajność urządzenia</strong> - Przechwytuj wykresy <em>CPU</em>, <em>pamięci</em>, <em>obiektów</em> lub <em>wszystkich</em> dla urządzenia, na którym działa ten skrypt; przechwycone pliki PNG trafiają do wyników uruchomienia / eksportu PDF</li>
            <li><strong>Pomoc dla kroku</strong> - Element <em>?</em> w każdym wierszu kreatora otwiera kontekstowe okno pomocy dla danego typu akcji</li>
            <li><strong>Zarządzanie akcjami</strong> - Dodawaj, usuwaj, zmieniaj kolejność (przeciągnij i upuść), kopiuj i wklejaj akcje</li>
            <li><strong>Kopiuj / Wklej</strong> - Skopiuj akcję za pomocą elementu kopiowania w każdym wierszu. Po skopiowaniu użyj <strong>Wklej krok</strong> obok dowolnego wiersza <strong>Dodaj krok</strong>, aby wstawić w tej pozycji, lub <span class="help-kbd">Ctrl</span>+<span class="help-kbd">V</span>, aby dołączyć na końcu skryptu</li>
            <li><strong>Importuj</strong> - Załaduj istniejący skrypt z pliku JSON</li>
            <li><strong>Cofnij / Ponów</strong> - <span class="help-kbd">Ctrl</span>+<span class="help-kbd">Z</span>, aby cofnąć, <span class="help-kbd">Ctrl</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">Z</span>, aby ponowić</li>
            <li><strong>Podgląd JSON</strong> - Podgląd na żywo wygenerowanego skryptu. Skopiuj lub zapisz skrypt do pliku</li>
            <li><strong>Kopiuj do Wykonawcy</strong> - Wyślij zbudowany skrypt bezpośrednio do Wykonawcy w celu uruchomienia</li>
          `,
    actionScriptsExecutorHtml: `<strong>Wykonawca</strong> - Importuj, weryfikuj i uruchamiaj skrypty akcji:`,
    actionScriptsExecutorListHtml: `
            <li><strong>Importuj</strong> - Prześlij plik skryptu JSON lub wklej JSON skryptu, a następnie zweryfikuj</li>
            <li><strong>Uruchom / Wstrzymaj / Zatrzymaj</strong> - Steruj wykonaniem za pomocą akcji odtwarzania, wstrzymania i zatrzymania</li>
            <li><strong>Pomiń / Przywróć</strong> - Przełączaj poszczególne akcje, aby pominąć je podczas wykonania</li>
            <li><strong>Zmień kolejność</strong> - Przeciągnij i upuść, aby zmienić kolejność akcji przed uruchomieniem</li>
            <li><strong>Wyniki</strong> - Przeglądaj szczegółowe wyniki każdej akcji, w tym osadzone zrzuty ekranu i przechwycone wykresy wydajności</li>
            <li><strong>Kopiuj / Zapisz wyniki</strong> - Kopiuj wyniki do schowka lub zapisz jako PDF (PDF osadza zrzuty ekranu i karty wykresów)</li>
            <li><strong>Połącz z konsolą</strong> - Opcjonalnie automatycznie łącz się z konsolą debugowania podczas uruchomień</li>
          `,
    actionScriptsDevPasswordHtml: `<strong>Hasło programisty</strong> - Akcje takie jak Zrzut ekranu, Wgraj (sideload) i Usuń wgrany kanał wymagają hasła programisty. Hasło jest ustalane w kolejności: na poziomie akcji <code>"password"</code> → na poziomie skryptu <code>"devPassword"</code> → hasło z sekcji uwierzytelniania Dev App. Jeśli żadnego nie znaleziono, zostaniesz o nie poproszony podczas weryfikacji.`,
    actionScriptsSaveFolderHtml: `<strong>Folder zapisu</strong> - Domyślny folder zapisu znajduje się w <strong>Ustawienia → Action Scripts → Domyślny folder</strong>. Na każde uruchomienie możesz wybrać inny folder. Artefakty (zrzuty ekranu, pliki PNG wykresów wydajności, wyeksportowane pliki PDF) trafiają do podfolderu ze znacznikiem czasu, tworzonego tylko wtedy, gdy coś rzeczywiście powstanie.`,
    actionScriptsAiAgentsHtml: `<strong>Agenci SI</strong> - Skrypty akcji tworzone w Kreatorze mogą być również tworzone przez agentów SI za pośrednictwem serwera MCP (zobacz sekcję <em>Agenci SI (MCP)</em> poniżej); skrypt agenta zawsze trafia do Kreatora do przeglądu przez człowieka przed uruchomieniem.`,
    actionScriptsIntro:
      'Automatyzuj sekwencje akcji urządzenia za pomocą skryptów opartych na JSON. Dostępne są dwa widoki:',

    devicePerformanceHeading: 'Wydajność urządzenia (sekcja pilota)',
    devicePerformanceIntroHtml: `Przełącz <strong>Pokaż wydajność urządzenia</strong> w sekcji pilota, aby rozwinąć poczwórny układ z wykresami na żywo:`,
    devicePerformanceListHtml: `
            <li>Wykresy <strong>użycia CPU</strong>, <strong>pamięci systemowej</strong> i <strong>obiektów BrightScript</strong> (widok liczby lub pamięci, gdy dostępny)</li>
            <li>Wykresy odzwierciedlają działającą aplikację — aby uzyskać reprezentatywne odczyty, urządzenie powinno mieć włączony <strong>Tryb programisty</strong>, a Twój <strong>wgrany kanał deweloperski</strong> na pierwszym planie</li>
            <li><strong>Ustawienia → Wydajność urządzenia</strong> dostraja interwał próbkowania wykresu i okno historii; włącz <strong>Zapamiętaj „Pokaż wydajność urządzenia”</strong>, aby przywracać układ poczwórny dla każdego urządzenia między sesjami</li>
            <li>Wewnątrz Skryptów akcji kroki <strong>Wydajność urządzenia</strong> przechwytują karty wykresów do wyników uruchomienia (i eksportu PDF)</li>
          `,

    networkInspectorHeading: 'Inspektor sieci',
    networkInspectorIntroHtml: `Analizuj ruch HTTP(S) generowany przez Twój kanał deweloperski. Roku Dev Studio uruchamia lokalny <strong>proxy MITM</strong>, który odszyfrowuje ruch HTTPS kanału deweloperskiego kierowany przez niego, dzięki czemu widzisz pełne nagłówki i treści żądań/odpowiedzi.`,
    networkInspectorGettingStartedHtml: `<strong>Pierwsze kroki</strong>`,
    networkInspectorGettingStartedListHtml: `
            <li>Włącz <strong>proxy MITM</strong> w <strong>Ustawienia → Inspektor sieci</strong>, a następnie skieruj żądania swojego kanału deweloperskiego przez pokazany adres proxy — użyj <code>host:port</code> (np. <code>192.168.1.50:8888</code>). Sposób zastosowania tego proxy przez kanał zależy od kodu sieciowego Twojej aplikacji.</li>
            <li>Opcjonalne <strong>Przechwytywanie hotspotu</strong> rejestruje metadane SNI/DNS dla całego ruchu urządzenia; wymaga dostępu do przechwytywania pakietów systemu operacyjnego (macOS BPF, Windows Npcap). Ustawienia → Inspektor sieci przeprowadza przez konfigurację dla poszczególnych platform.</li>
          `,
    networkInspectorToolbarHtml: `<strong>Pasek narzędzi</strong> (w prawym górnym rogu panelu): <strong>Rozpocznij/Zatrzymaj przechwytywanie</strong>, <strong>Układ paneli</strong> (stos lub obok siebie żądanie/odpowiedź) oraz <strong>Konfiguruj reguły ruchu</strong>.`,
    networkInspectorToolbarListHtml: `
            <li><strong>Lista sesji</strong> - Filtruj za pomocą <code>host:</code>, <code>method:</code>, <code>status:</code>, <code>type:</code>, <code>kind:</code>, <code>path:</code> (oddzielaj wyrażenia przecinkami dla OR); grupuj według hosta; przełącz <em>Przez proxy</em>, aby ukryć metadane dostępne tylko z hotspotu. Skróty przejścia do błędu i przewinięcia do najnowszego pojawiają się, gdy są istotne.</li>
            <li><strong>Inspekcja</strong> - Przeglądaj podsumowanie żądania / odpowiedzi, nagłówki i treści (JSON / XML / surowe). <strong>Skopiuj</strong> treść lub wyeksportuj transakcję jako <strong>cURL</strong> lub <strong>HAR</strong>.</li>
            <li><strong>Zapisz .pcap</strong> - Wyeksportuj przechwycone pakiety urządzenia; <strong>Wyczyść</strong> opróżnia listę sesji.</li>
          `,
    networkInspectorTrafficRulesHtml: `<strong>Reguły ruchu</strong> (koło zębate na pasku narzędzi) kształtują ruch tego urządzenia przechodzący przez proxy; zmiany są stosowane natychmiast:`,
    networkInspectorTrafficRulesListHtml: `
            <li><strong>Blokuj cały ruch przez proxy</strong> - Odrzucaj każde żądanie przez proxy. Ma pierwszeństwo nad regułami per-host i ograniczeniem przepustowości urządzenia.</li>
            <li><strong>Ograniczenie urządzenia</strong> - Ogranicz przepustowość i/lub dodaj opóźnienie do każdego żądania przez proxy. Wybierz gotowe ustawienie lub wpisz niestandardową wartość (np. <code>3 Mbps</code>, <code>1500 kbps</code>).</li>
            <li><strong>Reguły per-host</strong> - Dodaj <strong>nazwę hosta</strong>, aby objąć każde żądanie do tego hosta, lub <strong>host + ścieżkę</strong> (np. <code>api.example.com/v1/play</code>), aby objąć tylko tę ścieżkę. Każda reguła może <em>Blokować</em>, <em>Resetować</em> połączenie (symulować awarię sieci), <em>Mockować</em> gotową odpowiedź (status / Content-Type / opóźnienie / treść) i/lub ograniczać przepustowość.</li>
            <li><strong>Symbole wieloznaczne</strong> - Użyj <code>*</code> w hoście lub ścieżce, aby dopasować więcej niż jeden cel. <code>*.example.com</code> obejmuje każdą subdomenę (np. środowiska niższe <em>i</em> produkcyjne w jednej regule), a <code>/v1/*/play</code> pasuje do dowolnej ścieżki pod <code>/v1</code>. Wzorzec bez <code>*</code> zachowuje stare zachowanie (goły host pasuje także do swoich subdomen).</li>
            <li><strong>Edytuj regułę</strong> - Kliknij ołówek na regule, aby zmienić jej przechwytywany adres URL w miejscu (host lub host/ścieżka); naciśnij Enter, aby zastosować, lub Escape, aby anulować.</li>
            <li><strong>Przepisz</strong> - W przeciwieństwie do Blokuj / Resetuj / Mockuj (które zatrzymują żądanie), reguły przepisywania pozwalają żądaniu przejść z zastosowanymi zmianami. Dodaj operacje na <em>żądaniu</em> (przekieruj host — „zmapuj zdalnie” produkcyjny adres URL na staging/localhost, ustaw ścieżkę, dodaj/usuń parametry zapytania lub nagłówki, znajdź/zamień w treści) i/lub <em>odpowiedzi</em> (nadpisz status, dodaj/usuń nagłówki, znajdź/zamień w treści — odpowiedzi gzip/br są dekodowane, edytowane i wysyłane ponownie). Znajdowanie/zamiana w treści obsługuje zwykły tekst lub wyrażenie regularne i dotyczy tylko treści tekstowych.</li>
            <li><strong>Ograniczenia</strong> - Host nie może być szybszy niż limit przepustowości urządzenia, a jego opóźnienie nie może spaść poniżej dolnego progu opóźnienia urządzenia.</li>
          `,
    networkInspectorLocalOnly: 'Inspektor sieci jest dostępny dla urządzeń połączonych lokalnie.',

    aiAgentsHeading: 'Agenci SI (MCP)',
    aiAgentsIntroHtml: `Roku Dev Studio zawiera serwer <strong>MCP (Model Context Protocol)</strong>, dzięki czemu agenci SI w Cursor, Claude Desktop lub VS Code mogą sterować prawdziwym urządzeniem za pośrednictwem tej aplikacji:`,
    aiAgentsListHtml: `
            <li><strong>Ustawienia → Serwer MCP</strong> - Przełącz klienta, aby dodać lub usunąć jego wpis MCP <code>roku-dev-studio</code>; inne wpisy w konfiguracji MCP tego klienta pozostają nietknięte</li>
            <li><strong>Dwie powierzchnie</strong> - Bezpośrednie operacje na urządzeniu dla jednorazowych akcji (<code>keypress</code>, <code>launch_app</code>, <code>screenshot</code>, <code>app_function</code>, <code>rale_command</code>, telnet …) oraz <strong>Skrypty akcji</strong> dla przepływów wielokrokowych / warunkowych, które trafiają do Kreatora w celu przeglądu</li>
            <li><strong>Powiadomienia Toast</strong> - Destrukcyjne akcje agenta (uruchomienie, wgranie, usunięcie wgrania, zrzut ekranu, destrukcyjne polecenia RALE) pokazują nieblokujące powiadomienie Toast w aplikacji, dzięki czemu zawsze widzisz, co zrobił agent</li>
            <li><strong>Hasła pozostają lokalne</strong> - Wgrywanie / zrzut ekranu / usuwanie wgrania używają ponownie hasła zapamiętanego przez panel urządzenia; agent nigdy nie musi go wysyłać</li>
          `,
    aiAgentsBridge:
      'Most uruchamia się automatycznie, gdy aplikacja jest otwarta, i wyłącza się po jej zamknięciu. Jeśli agent zgłosi, że most jest offline, po prostu przywróć tę aplikację na pierwszy plan.',

    fiddleHeading: 'BrightScript Fiddle',
    fiddleIntroHtml: `Otwórz przez <strong>Plik → Otwórz Fiddle</strong> (<span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">B</span>) lub przyciskiem <em>Otwórz Fiddle</em> na karcie Zapytania.`,
    fiddleListHtml: `
            <li><strong>Edytor</strong> - Edytor Monaco z podświetlaniem BrightScript i lintingiem <em>BrighterScript</em> na żywo; przycisk Uruchom jest wyłączony, gdy występują błędy</li>
            <li><strong>Uruchom</strong> - Opakowuje Twój fragment kodu w minimalny kanał SceneGraph, wgrywa go na wybrane urządzenie i przesyła konsolę debugowania BrightScript (8085) do terminala okna Fiddle</li>
            <li><strong>Zatrzymaj / zamknięcie okna</strong> - Automatycznie usuwa kanał Fiddle z urządzenia</li>
          `,
    fiddleNote:
      'Wymaga urządzenia z włączonym Trybem programisty i znanym hasłem programisty (użyj raz karty Dev App, aby je zapamiętać, albo zostaniesz o nie poproszony w Fiddle).',

    logViewerHeading: 'Przeglądarka plików dziennika',
    logViewerBodyHtml: `<strong>Plik → Otwórz plik dziennika</strong> (<span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">O</span>) otwiera zapisany plik konsoli / dziennika w dedykowanym oknie z tymi samymi elementami wyszukiwania / dziennika strukturalnego / wykrywania adresów URL co na żywej karcie Konsola. Przydatne do przeglądania dzienników z poprzedniej sesji lub od współpracownika.`,

    secretScreensHeading: 'Sekretne ekrany',
    secretScreensBodyHtml: `Łącze <em>Sekretne ekrany</em> (sekcja pilota i stopka karty Zapytania) otwiera okno modalne z listą standardowych sekwencji klawiszy Roku dla ukrytych ustawień — <strong>Ustawienia programisty</strong>, <strong>Sekretny ekran 1/2/3</strong>, <strong>Informacje Wi-Fi</strong>, <strong>Informacje o kanale</strong>, <strong>Ponowne uruchomienie</strong> itd. Kliknij sekwencję, aby wysłać naciśnięcia klawiszy do podłączonego urządzenia.`,

    settingsHeading: 'Ustawienia',
    settingsIntroHtml: `Otwórz za pomocą <span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">,</span> lub <em>Roku Dev Studio → Ustawienia</em> (macOS) / <em>Plik → Ustawienia</em> (Windows / Linux). Pięć sekcji:`,
    settingsListHtml: `
            <li><strong>Ogólne</strong> - Tryb programisty, Tryb prywatności (maskuj adresy IP / numery seryjne), Logowanie debugowania do pliku, Pilot Roku - używaj klawiatury, Automatycznie łącz z urządzeniami, Automatycznie ukrywaj pasek boczny, Szyfruj zapisane hasła (wiersz statusu pokazuje, czy pęk kluczy systemu operacyjnego rzeczywiście szyfruje — w niektórych konfiguracjach Linuksa tak nie jest)</li>
            <li><strong>Action Scripts</strong> - Domyślny folder na artefakty uruchomienia (zrzuty ekranu, wyeksportowane pliki PDF)</li>
            <li><strong>Wydajność urządzenia</strong> - Interwał próbkowania wykresu, okno historii wykresu, Zapamiętaj „Pokaż wydajność urządzenia” dla każdego urządzenia</li>
            <li><strong>Czasy &amp; sieć</strong> - Limity czasu połączenia / zapytania / telnet i inne pokrętła sieciowe (z opcją Przywróć domyślne)</li>
            <li><strong>Serwer MCP</strong> - Przełącz <code>roku-dev-studio</code> w swoich klientach SI, aby agenci mogli sterować urządzeniem za pośrednictwem tej aplikacji</li>
          `,

    remoteLocationsHeading: 'Lokalizacje zdalne',
    remoteLocationsListHtml: `
            <li><strong>Konfiguracja</strong> - Uruchom Roku Relay Server na Mac Mini w lokalizacji zdalnej</li>
            <li><strong>Dodaj lokalizację</strong> - Kliknij „Dodaj” w sekcji Lokalizacje zdalne, aby skonfigurować połączenie</li>
            <li><strong>Adres serwera</strong> - Wprowadź adres IP lub nazwę hosta serwera przekaźnikowego</li>
            <li><strong>Domyślny port</strong> - Serwer przekaźnikowy domyślnie działa na porcie <code>4951</code></li>
          `,
    remoteLocationsServerHtml: `Serwer przekaźnikowy znajduje się w folderze <code>remote-server</code>. Instrukcje konfiguracji znajdziesz w pliku README (macOS LaunchAgent, Linux systemd, Windows Task Scheduler).`,
    remoteLocationsTroubleshootHtml: `<strong>Wgrywanie lub zrzut ekranu przez przekaźnik zawodzi, ale ECP działa?</strong> Zaktualizuj host przekaźnika do tej samej wersji <code>roku-dev-studio-api</code> co ta aplikacja. Sprawdź <code>GET /health</code> na przekaźniku (pole <code>apiVersion</code>) i upewnij się, że port <code>4951</code> jest osiągalny przez zapory.`,
    remoteLocationsIntro: 'Steruj urządzeniami Roku w lokalizacjach zdalnych za pośrednictwem Relay Server:',

    sideloadRelayHeading: 'Sideload Relay',
    sideloadRelayIntroHtml: `Wgraj jedną kompilację na <strong>wiele urządzeń jednocześnie</strong>. Gdy przekaźnik jest włączony, Roku Dev Studio rozgłasza się jako Roku w Twojej sieci: skieruj swoje IDE (VS Code BrightScript / roku-deploy / Eclipse) lub przeglądarkę na ten komputer, prześlij raz, a RDS rozprowadza kompilację — <em>instalacja → uruchomienie → konsola</em> — na każde docelowe urządzenie, lokalne lub w lokalizacji zdalnej.`,
    sideloadRelayEnableHtml: `<strong>Włącz to</strong> w <strong>Ustawienia → Sideload Relay</strong> (domyślnie wyłączone). Przełącznik jest chroniony dwoma wymaganiami wstępnymi:`,
    sideloadRelayEnableListHtml: `
            <li><strong>Hasło programisty Relay</strong> - Hasło, którym Twoje IDE uwierzytelnia się w RDS (użytkownik <code>rokudev</code>), dokładnie jak hasło programisty prawdziwego Roku. Jest ono odrębne od własnego hasła programisty każdego urządzenia docelowego.</li>
            <li><strong>Konfiguracja urządzeń</strong> - Otwórz okno modalne konfiguracji urządzeń i włącz co najmniej jedno osiągalne urządzenie z włączonym Trybem programisty. Wyświetla ono urządzenia lokalne i zdalne (z lokalizacji przekaźnika); włącz te, które mają otrzymywać każdą kompilację. Urządzenia bez zapisanego hasła programisty pokazują <strong>🔒 Ustaw hasło</strong>, aby zweryfikować je bezpośrednio. Wcześniej wybrane urządzenia, które przechodzą w tryb offline, pozostają na liście (wyłączone) i dołączają ponownie automatycznie, gdy znów będą osiągalne.</li>
          `,
    sideloadRelayPointHtml: `<strong>Skieruj swoje IDE na RDS.</strong> Przy włączonym przekaźniku RDS jest wykrywalny przez SSDP jako <em>„Roku Dev Studio Relay”</em>, albo możesz bezpośrednio ustawić host kompilacji na adres IP tego komputera. Przy <em>Sideload</em> / <em>Debug: Launch</em> IDE przesyła do RDS na porcie <code>80</code>, a RDS obsługuje rozprowadzanie. Pod adresem przekaźnika (<code>http://&lt;this-machine&gt;/</code>) serwowana jest także stylizowana strona przesyłania do wgrywania <code>.zip</code> metodą przeciągnij i upuść z przeglądarki.`,
    sideloadRelayAutoConnectHtml: `<strong>Automatyczne łączenie.</strong> Gdy kompilacja pomyślnie trafi na urządzenie docelowe, RDS otwiera to urządzenie jako połączoną kartę i automatycznie dołącza jego konsolę debugowania, dzięki czemu widzisz wyjście dla każdego urządzenia bez dodatkowych kliknięć. Postęp rozprowadzania na żywo jest także przesyłany jako konsola statusu na porcie telnet <code>8085</code>.`,
    sideloadRelaySourceApprovalHtml: `<strong>Zatwierdzanie źródła.</strong> Wgranie pochodzące z tego komputera przebiega automatycznie. Wgranie z innego komputera wstrzymuje przesyłanie i pokazuje monit o zezwolenie/odmowę na hoście RDS (automatyczna odmowa po 30 s); przesyłanie z przeglądarki z komputera zdalnego dodatkowo wymaga zalogowania się za pomocą hasła programisty Relay.`,
    sideloadRelayFooterHtml: `Wymaga, aby urządzenia docelowe miały włączony Tryb programisty. Zobacz <strong>Lokalizacje zdalne</strong> powyżej, aby kierować na urządzenia w innej lokalizacji za pośrednictwem serwera przekaźnikowego.`,

    tipsHeading: 'Wskazówki',
    tipDeveloperModeHtml: `Włącz Tryb programisty na swoim Roku: przejdź do Ekranu głównego, naciśnij <span class="help-kbd">Home</span> 3x, <span class="help-kbd">↑</span> 2x, <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span>`,
    tipMacosHtml: `<strong>macOS:</strong> zamknięcie okna głównego kończy aplikację (sesje telnet i MCP są zamykane). Użyj <em>Roku Dev Studio → Zamknij</em> lub <span class="help-kbd">Cmd</span>+<span class="help-kbd">Q</span> — aplikacja nie pozostaje w Docku bez okien.`,
    tipWindowsLinuxHtml: `<strong>Windows / Linux:</strong> użyj menu paska tytułu (☰) do Ustawień, Trybu prywatności i O programie; przyciski minimalizacji/maksymalizacji/zamknięcia okna znajdują się przy prawej krawędzi paska tytułu.`,
    tipMultipleDevices: 'Można podłączyć wiele urządzeń jednocześnie — każde otrzymuje własną kartę',
    tipClickCard: 'Kliknij kartę podłączonego urządzenia, aby przejść do jego zakładki',
    tipRightClick: 'Kliknij kartę urządzenia prawym przyciskiem myszy, aby skopiować informacje o urządzeniu',
    tipRemoteLocations: 'Lokalizacje zdalne umożliwiają sterowanie urządzeniami bez fizycznego dostępu',
  },
};

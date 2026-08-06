/**
 * Polish (pl) translation of the Settings window strings (General, MCP,
 * Network Inspector, timing/validation, …). Sibling of ../settings.ts — same
 * `settings` shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated; product/feature names and tech tokens are verbatim.
 */
export const settings = {
  // Bootstrap / fatal
  apiUnavailable: 'API ustawień niedostępne.',
  loadFailedMessage: 'Nie udało się otworzyć Ustawień. Spróbuj ponownie.',

  // General section
  noFolderSet: 'Nie ustawiono folderu',
  logFilePath: (path: string): string => `Plik dziennika: ${path}`,

  // Password storage / keychain
  keychainUnencryptedConfirm:
    'Twój system nie zapewnia prawdziwego pęku kluczy szyfrowania. Włączenie tej opcji powoduje przechowywanie haseł jako zakodowanego zwykłego tekstu na dysku, bez szyfrowania. Kontynuować?',
  keychainOff: 'Przełącznik szyfrowania jest wyłączony — zapamiętane hasła są przechowywane jako zwykły tekst na dysku.',
  keychainDefaultBackend: 'Systemowy pęk kluczy',
  keychainEncrypted: (backend: string): string => `Przechowywanie: zaszyfrowane przez ${backend}.`,
  keychainUnencrypted:
    'Ostrzeżenie: przełącznik jest włączony, ale ten system używa zwykłego tekstu — hasła są zapisywane na dysku jako zwykły tekst zakodowany Base64. Użyj pęku kluczy systemu Linux (Secret Service/KWallet), aby uzyskać prawdziwe szyfrowanie.',
  keychainUnavailable:
    'Ostrzeżenie: przełącznik jest włączony, ale pęk kluczy systemu operacyjnego jest niedostępny — hasła pozostają w pamięci tylko na czas tej sesji.',
  keychainStatus: (status: string, backend: string): string =>
    `Stan przechowywania: ${status}${backend ? ` (${backend})` : ''}.`,

  // MCP Server section
  // Client row labels (product/brand names — same across locales, but sourced here so the
  // catalog is the single place UI text lives). Keys match main's McpClientId union.
  mcpClientLabels: {
    chatgpt: 'ChatGPT Desktop',
    claude: 'Claude Desktop',
    cursor: 'Cursor',
    vscode: 'Visual Studio Code',
    'vscode-insiders': 'VS Code Insiders',
    vscodium: 'VSCodium',
    windsurf: 'Windsurf',
  },
  // MCP panel help blurb — contains <a>/<code>, rendered via data-i18n-html.
  mcpServerBlurbHtml: `Udostępnij Roku Dev Studio agentom SI za pomocą <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" class="mcp-link">Model Context Protocol</a>. Przełącz klienta, aby dodać lub usunąć jego wpis serwera MCP <code class="mcp-inline-code">roku-dev-studio</code>; pozostałe wpisy pozostają nietknięte.`,
  mcpNoClients: 'Nie wykryto obsługiwanych klientów MCP w tym systemie.',
  mcpInstalled: 'Zainstalowano',
  mcpNotDetected: 'Nie wykryto',
  mcpOpenConfigTitle: (path: string): string => `Otwórz ${path}`,
  mcpOpenConfigAria: (label: string): string => `Otwórz plik konfiguracyjny MCP dla ${label}`,
  mcpOpenConfigFile: 'Otwórz plik konfiguracyjny',
  mcpInstallToEnable: (label: string): string => `Zainstaluj ${label}, aby włączyć.`,
  mcpEnableAria: (label: string): string => `Włącz MCP dla ${label}`,

  // Network Inspector — status line
  niStatusDisabled: 'Stan: wyłączone — zapisz po włączeniu, aby rozpocząć wykrywanie klientów hotspotu.',
  niPlatformMac: 'bridge100 w systemie macOS',
  niPlatformWin: 'wirtualna karta sieciowa w systemie Windows',
  niPlatformLinux: 'interfejs hotspotu w systemie Linux',
  niStatusEnabled: (platformHint: string): string =>
    `Stan: włączone — oczekiwanie na interfejs hotspotu (${platformHint}).`,
  niMitmSuffix: (port: number): string => ` · Serwer proxy MITM na porcie ${port}`,

  // Network Inspector — capture setup (BPF)
  captureAccessEnabled: 'Dostęp do przechwytywania włączony',
  setupNeeded: 'Wymagana konfiguracja',
  // Static default for the setup modal <h2>; JS replaces it with a platform-suffixed title.
  hotspotCaptureSetupModalTitle: 'Konfiguracja przechwytywania hotspotu',
  niSetupRowDescOk: 'Opcjonalne — tylko do przechwytywania DNS/SNI hotspotu. Proxy nie wymaga konfiguracji.',
  niSetupRowDescNeeds: 'Przechwytywanie hotspotu wymaga konfiguracji — otwórz, aby je włączyć. (Proxy nadal działa.)',
  niSetupPacketCapture: 'Skonfiguruj przechwytywanie pakietów',
  bpfWaitingApproval: 'Oczekiwanie na zatwierdzenie przez administratora…',
  bpfInstalled: 'Dostęp do przechwytywania pakietów zainstalowany.',
  bpfInstalledHint: 'Zainstalowano — wróć do karty Inspektor sieci.',
  bpfCancelled: 'Anulowano.',
  bpfSetupFailed: 'Konfiguracja nie powiodła się.',

  niSetupGuide: {
    titlePrefix: `Konfiguracja przechwytywania hotspotu`,
    darwin: {
      intro: `<strong>Opcjonalne — tylko dla przechwytywania hotspotu.</strong> Odszyfrowywanie Twojego kanału dev wgranego przez sideload działa w każdej sieci bez tej konfiguracji. Te kroki dodają przechwytywanie hotspotu dla DNS/TLS SNI z <em>całego</em> ruchu urządzenia Roku przez hotspot Udostępniania internetu na Twoim Macu (<code class="mcp-inline-code">bridge100</code>). Tylko urządzenia lokalne.`,
      enableSharing: `<strong>Włącz Udostępnianie internetu</strong> — RDS przechwytuje na <code class="mcp-inline-code">bridge100</code>, gdy tylko jest ono włączone:`,
      sharingSteps: [
        `Otwórz <strong>Ustawienia systemowe → Ogólne → Udostępnianie</strong>`,
        `Włącz <strong>Udostępnianie internetu</strong>, udostępniając <strong>przez Wi-Fi</strong>`,
        `Podłącz Roku do udostępnionej sieci Wi-Fi Maca`
      ],
      captureHead: `Dostęp do przechwytywania pakietów`,
      captureBody: `macOS tworzy <code class="mcp-inline-code">/dev/bpf*</code> z dostępem tylko dla użytkownika root. Uruchom poniższą jednorazową konfigurację, aby przywrócić dostęp utrzymujący się po ponownych uruchomieniach (wymagane hasło administratora, tak jak w przypadku ChmodBPF z Wireshark). Możesz też zainstalować <a href="https://www.wireshark.org/download.html" target="_blank" rel="noopener noreferrer" class="mcp-link">Wireshark</a> i uruchomić jego instalator ChmodBPF.`
    },
    win32: {
      intro: `<strong>Opcjonalne — tylko dla przechwytywania hotspotu.</strong> Odszyfrowywanie Twojego kanału dev wgranego przez sideload działa w każdej sieci bez tej konfiguracji (serwer proxy MITM obsługuje zarówno tę samą sieć Wi-Fi, jak i hotspot). Te kroki dodają przechwytywanie hotspotu dla DNS/TLS SNI z <em>całego</em> ruchu urządzenia Roku, gdy jest ono połączone przez hotspot tego komputera. Tylko urządzenia lokalne.`,
      enableHotspot: `<strong>Włącz hotspot samodzielnie (opcjonalnie)</strong> — RDS nie przełącza ustawień sieciowych Windows; to Ty masz nad tym kontrolę:`,
      hotspotSteps: [
        `Otwórz <strong>Ustawienia → Sieć i Internet → Hotspot mobilny</strong>`,
        `Włącz <strong>Hotspot mobilny</strong> (udostępnianie przez Wi-Fi)`,
        `Podłącz Roku do tego hotspotu — RDS automatycznie wykrywa wirtualną kartę sieciową`
      ],
      npcapHead: `Dostęp do przechwytywania hotspotu (Npcap)`,
      npcapBody: `Przechwytywanie hotspotu (DNS/TLS SNI z całego ruchu urządzenia Roku) wymaga sterownika <a href="https://npcap.com/" target="_blank" rel="noopener noreferrer" class="mcp-link">Npcap</a>. Jest to opcjonalne — pomiń to, a serwer proxy MITM nadal będzie rejestrować Twój kanał dev wgrany przez sideload.`,
      npcapSteps: [
        `Pobierz i uruchom instalator ze strony <a href="https://npcap.com/" target="_blank" rel="noopener noreferrer" class="mcp-link">npcap.com</a>`,
        `Podczas instalacji zaznacz <strong>“Install Npcap in WinPcap API-compatible Mode”</strong>`,
        `<strong>Uruchom ponownie Roku Dev Studio</strong> po instalacji, aby załadował się dołączony moduł przechwytywania`
      ],
      npcapNote: `Masz już Npcap, ale przechwytywanie nadal się nie uruchamia? Zainstaluj ponownie Roku Dev Studio, aby jego natywny moduł przechwytywania pasował do tej wersji.`
    },
    linux: {
      intro: `<strong>Opcjonalne — tylko dla przechwytywania hotspotu.</strong> Odszyfrowywanie Twojego kanału dev wgranego przez sideload działa w każdej sieci bez tej konfiguracji. Te kroki dodają przechwytywanie hotspotu dla DNS/TLS SNI z <em>całego</em> ruchu urządzenia Roku poprzez udostępnienie połączenia tego komputera. Tylko urządzenia lokalne.`,
      shareConnection: `<strong>Udostępnij swoje połączenie</strong>, aby ruch Roku był kierowany przez ten komputer:`,
      shareSteps: [
        `Użyj NetworkManager → <strong>“Udostępnione innym komputerom”</strong> na połączeniu Wi-Fi/Ethernet (brama <code class="mcp-inline-code">10.42.0.1</code>) lub uruchom hotspot hostapd`,
        `Podłącz Roku do tej udostępnionej sieci — RDS automatycznie wykrywa interfejs bramy`
      ],
      captureHead: `Dostęp do przechwytywania pakietów`,
      captureBody: `Linux przechwytuje za pomocą <code class="mcp-inline-code">tcpdump</code>, który wymaga uprawnień do surowych gniazd. Uruchom poniższą jednorazową konfigurację (monit administratora), aby przyznać uprawnienia <code class="mcp-inline-code">cap_net_raw</code>/<code class="mcp-inline-code">cap_net_admin</code> — lub ręcznie: <code class="mcp-inline-code">sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump)</code>.`
    }
  },
  // Network Inspector — place selector + Remote Locations
  placeLocal: 'Lokalnie (ten komputer)',
  placeRemoteFallback: 'Zdalnie',
  niRemoteRequiresRoot:
    'Ta lokalizacja wymaga uruchomienia serwera zdalnego jako root, aby włączyć Inspektor sieci.',
  niRemoteUnsupported:
    'Ta lokalizacja nie obsługuje Inspektor sieci. Zaktualizuj ten serwer zdalny, aby uzyskać funkcje Inspektor sieci.',
  niDisabled: 'Inspektor sieci jest wyłączony.',
  niEditingRemote: 'Edytowanie ustawień lokalizacji zdalnej. Przechwytywanie działa na serwerze zdalnym.',
  niPortConflictTitle: 'Port proxy niedostępny',
  niRemoteUnavailable: 'Zdalny Inspektor sieci jest niedostępny w tej wersji.',
  niCheckingRemote: 'Sprawdzanie lokalizacji zdalnej…',
  niCouldNotReachRemote: 'Nie można połączyć się z lokalizacją zdalną.',

  // Network Inspector — enable confirm + save status
  niConfirmEnable:
    'Inspektor sieci będzie przechwytywać ruch Roku i przechowywać go lokalnie na tym komputerze — przez serwer proxy MITM oraz, jeśli skonfigurowano, przez przechwytywanie hotspotu / sieci współdzielonej. Kontynuować?',
  niSaved: 'Ustawienia Inspektor sieci zapisane.',
  niSavedRemote: 'Zapisano w lokalizacji zdalnej.',
  niRemoteSaveFailed: 'Zapis zdalny nie powiódł się',

  // Etykiety wierszy „Czasy i sieć” (tytuł + podpowiedź dla każdego klucza czasu),
  // zlokalizowane tutaj, aby interfejs ustawień renderował je w aktywnym języku.
  // Numeryczne granice min/maks nadal pochodzą z procesu głównego przez `timingMeta`.
  timingLabels: {
    DEFAULT_RALE_PORT: { title: 'Port RALE / App Connector', hint: 'Port TCP (domyślnie 49200).' },
    SCREENSHOT_DEBOUNCE_DELAY: { title: 'Debounce zrzutu ekranu (ms)', hint: 'Opóźnienie po naciśnięciu klawisza przed automatycznym zrzutem ekranu.' },
    SCREENSHOT_AFTER_LAUNCH_DELAY: { title: 'Zrzut ekranu po uruchomieniu (ms)', hint: 'Odczekaj po uruchomieniu Dev App przed zrzutem ekranu.' },
    TELNET_TIMEOUT: { title: 'Limit czasu połączenia Telnet (ms)', hint: 'Konsola debugowania / systemowy Telnet.' },
    CONNECTION_CHECK_INTERVAL: { title: 'Sprawdzanie aktywności urządzenia (ms)', hint: 'Jak często odpytywane są połączone urządzenia: informacje o urządzeniu, stan ECP oraz to, czy kanał Dev App jest na pierwszym planie.' },
    DEVICE_METRICS_SAMPLE_INTERVAL_MS: { title: 'Częstotliwość próbkowania (ms)', hint: 'Częstotliwość odpytywania Chanperf i liczby obiektów. Mniej = świeższe dane, większy ruch ECP; wymaga Trybu dewelopera i Control by Mobile Apps.' },
    DEVICE_METRICS_CHART_HISTORY_MS: { title: 'Czas historii wykresu (minuty)', hint: 'Jak daleko wstecz sięgają wykresy CPU i System Memory' },
    TOAST_DISPLAY_DURATION: { title: 'Czas trwania Toast (s)', hint: 'Widoczność powiadomień Toast o sukcesie/błędzie.' },
    STATUS_MESSAGE_DURATION: { title: 'Czas trwania komunikatu statusu (s)', hint: 'Widoczność wiersza statusu w nagłówku.' },
  },

  // Timing bounds + validation
  timingValueFallback: 'Wartość',
  timingBoundMin: (value: string | number): string => `Min: ${value}`,
  timingBoundMax: (value: string | number): string => `Maks: ${value}`,
  timingMustBeWholeNumber: (label: string): string => `${label} musi być liczbą całkowitą.`,
  timingMustBeAtLeast: (label: string, bound: string): string => `${label} musi wynosić co najmniej ${bound}.`,
  timingMustBeAtMost: (label: string, bound: string): string => `${label} może wynosić najwyżej ${bound}.`,
  timingMoreOutOfRange: (n: number): string => ` (jeszcze ${n} poza zakresem)`,
  timingClamped: (label: string, value: string, which: string): string =>
    `${label} dostosowano do ${value} (${which}).`,
  timingClampMinimum: 'minimum',
  timingClampMaximum: 'maksimum',

  // Save status messages
  generalSaved: 'Ustawienia ogólne zapisane.',
  actionScriptsSaved: 'Ustawienia Action Scripts zapisane.',
  devicePerfSaved: 'Ustawienia wydajności urządzenia zapisane.',
  timingSaved: 'Ustawienia czasów i sieci zapisane.',
  mcpSaved: 'Ustawienia serwera MCP zapisane.',
  saveFailed: 'Zapis nie powiódł się',
  saveWriteFailedError: 'Nie udało się zapisać pliku ustawień.',
  mcpConfigUpdateWarning: (summary: string): string =>
    `Aktualizacja konfiguracji klienta MCP zawierała błędy: ${summary}`,

  // ── Static settings.html shell ──────────────────────────────────────────
  // Header + nav
  windowTitle: 'Ustawienia — Roku Dev Studio',
  heading: 'Ustawienia',
  navAria: 'Sekcje ustawień',
  tabGeneral: 'Ogólne',
  tabActionScripts: 'Skrypty akcji',
  tabDevicePerformance: 'Wydajność urządzenia',
  tabTiming: 'Czasy i sieć',
  tabNetworkInspector: 'Inspektor sieci',
  tabSideloadRelay: 'Sideload Relay',
  tabMcpServer: 'Serwer MCP',
  // Shared across every section's save dock
  resetToDefaults: 'Przywróć domyślne',

  // General section — toggle labels, descriptions, and (screen-reader) aria labels
  language: 'Język',
  languageDesc: 'Język interfejsu aplikacji.',
  languageAria: 'Język wyświetlania',
  languageSystemDefault: (name: string): string => `Domyślny systemowy (${name})`,
  developerMode: 'Tryb dewelopera',
  developerModeDesc: 'Dodatkowe logowanie w oknie głównym (tak samo jak Plik → Tryb dewelopera).',
  developerModeAria: 'Tryb dewelopera',
  privacyMode: 'Tryb prywatności',
  privacyModeDesc: 'Maskuj adresy IP i numery seryjne w interfejsie (tak samo jak Plik → Tryb prywatności).',
  privacyModeAria: 'Tryb prywatności',
  debugLogging: 'Logowanie debugowania do pliku',
  debugLogHint: 'Po włączeniu zapisuje do pliku dziennika w danych użytkownika aplikacji.',
  debugLoggingAria: 'Logowanie debugowania do pliku',
  useKeyboardRemote: 'Używaj klawiatury do pilota Roku',
  useKeyboardRemoteDesc:
    'Gdy włączone, możesz sterować Roku za pomocą klawiatury. Skróty klawiszowe są wymienione w oknie pomocy pilota.',
  useKeyboardRemoteAria: 'Pilot Roku - używaj klawiatury ',
  autoConnect: 'Automatycznie łącz z urządzeniami',
  autoConnectDesc:
    'Gdy włączone, aplikacja automatycznie połączy się z urządzeniami, które pozostały połączone przy zamykaniu aplikacji w poprzedniej sesji.',
  autoHideSidebar: 'Automatycznie ukrywaj pasek boczny',
  autoHideSidebarDesc:
    'Gdy włączone, pasek boczny, który prezentuje listę urządzeń, będzie automatycznie przełączany, jeśli był ukryty w poprzedniej sesji.',
  encryptPasswords: 'Szyfruj zapisane hasła za pomocą systemowego pęku kluczy',
  encryptPasswordsDesc:
    'Szyfruj zapamiętane hasło każdego urządzenia za pomocą pęku kluczy systemu operacyjnego. Gdy wyłączone, hasło jest zachowywane, ale przechowywane na dysku bez szyfrowania.',
  encryptPasswordsAria: 'Przechowuj zapisane hasła w systemowym pęku kluczy',

  // Action Scripts section
  actionScriptsBlurb:
    'Domyślny folder na zrzuty ekranu i dzienniki, gdy skrypt musi coś zapisać. Nadal możesz wybrać inny folder przy każdym uruchomieniu.',
  chooseFolder: 'Wybierz folder…',

  // Device Performance section
  devicePerfIntroHtml: `Obowiązuje, gdy <strong>Pokaż wydajność urządzenia</strong> jest włączone, Roku ma Tryb dewelopera, a Dev App jest na pierwszym planie. Gdy poniżej włączone jest <strong>Zapamiętaj „Pokaż wydajność urządzenia”</strong>, sekcja pilota przywraca układ poczwórny dla każdego urządzenia.`,
  rememberDevicePerf: 'Zapamiętaj „Pokaż wydajność urządzenia”',
  rememberDevicePerfAria: 'Zapamiętaj pokazywanie lub ukrywanie wydajności urządzenia dla każdego urządzenia',
  // Row description — contains <strong>, rendered via data-i18n-html.
  rememberDevicePerfDescHtml: `Przywróć, czy <strong>Pokaż wydajność urządzenia</strong> było włączone dla każdego urządzenia. Wyłącz, aby zawsze zaczynać tylko od sekcji pilota, dopóki nie włączysz jej ponownie.`,

  // Network Inspector section — place selector + field labels
  location: 'Lokalizacja',
  niPlaceAria: 'Lokalizacja Inspektor sieci',
  enableNetworkInspector: 'Włącz Inspektor sieci',
  enableNetworkInspectorDesc:
    'Analizuj ruch sieciowy urządzenia. Odszyfrowuje ruch HTTPS Twojego kanału deweloperskiego przez lokalny serwer proxy (dowolna sieć); hotspot przechwytuje także DNS/SNI. Przechowywane tylko lokalnie.',
  mitmProxyPort: 'Port serwera proxy MITM',
  mitmProxyPortDesc:
    'Port, na którym nasłuchuje lokalny serwer proxy odszyfrowujący. Kieruj przez niego swój wgrany kanał deweloperski — kanałów fabrycznych nie można przechwycić.',
  mitmProxyPortAria: 'Port serwera proxy MITM',
  packetLimit: 'Limit pakietów na urządzenie',
  packetLimitDesc:
    'Ramki zachowywane na urządzenie na potrzeby eksportu PCAP. Więcej = więcej historii i pamięci.',
  packetLimitAria: 'Limit pakietów na urządzenie',
  maxBodySize: 'Maksymalny rozmiar treści (KB)',
  maxBodySizeDesc:
    'Ile z treści każdego żądania/odpowiedzi jest zachowywane do wyświetlenia. Powyżej limitu pokazuje się plakietka „Treść skrócona” (nie wpływa to na urządzenie). Dotyczy tylko nowego ruchu.',
  maxBodySizeAria: 'Maksymalny zachowywany rozmiar treści w KB',
  hotspotCaptureSetup: 'Konfiguracja hotspotu i przechwytywania',
  viewSetup: 'Pokaż konfigurację',

  // Sideload Relay section — intro bullets. The first bullet has inline markup (<span>/<code>,
  // whose #srRelayUrlWrap/#srRelayUrl are populated at runtime) so it's rendered via data-i18n-html.
  srIntro1Html: `Skieruj swoje narzędzie do wgrywania (VS Code z rozszerzeniem BrightScript, Eclipse lub CLI roku-deploy)<span id="srRelayUrlWrap" hidden> — lub przeglądarkę na <code id="srRelayUrl">http://…/</code></span> — tutaj zamiast na pojedyncze Roku.`,
  srIntro2: 'RDS akceptuje wgranie raz, a następnie instaluje je na każdym włączonym urządzeniu docelowym, uruchamia Dev App i otwiera każdą konsolę.',
  srIntro3: 'Wgrania z tego komputera przebiegają automatycznie.',
  srIntro4: 'Wgranie z innego urządzenia w sieci LAN wymaga hasła deweloperskiego i prosi o zezwolenie.',

  // ── Network Inspector — Certificate Authority card (surface the CA) ──
  caSectionTitle: 'Urząd certyfikacji',
  caRowDesc: 'Lokalny urząd certyfikacji, którego serwer proxy używa do odszyfrowywania ruchu HTTPS.',
  caRowDescRemote: 'Urząd certyfikacji tej lokalizacji, używany przez jej serwer proxy do odszyfrowywania ruchu HTTPS.',
  caViewCert: 'Pokaż certyfikat',
  caSectionDesc:
    'Inspektor sieci podpisuje odszyfrowany ruch HTTPS lokalnym urzędem certyfikacji. Zaufaj mu lub zaimportuj go na urządzeniu, aby Twój kanał deweloperski akceptował serwer proxy. Klucz prywatny nigdy nie opuszcza tego komputera.',
  caSectionDescRemote:
    'Inspektor sieci podpisuje odszyfrowany ruch HTTPS urzędem certyfikacji tej lokalizacji. Zaufaj mu lub zaimportuj go na urządzeniu, aby Twój kanał deweloperski akceptował serwer proxy. Klucz prywatny nigdy nie opuszcza tego serwera.',
  caSubject: 'Podmiot',
  caFingerprint: 'Odcisk SHA-256',
  caValidity: 'Ważność',
  caProxyAddress: 'Adres serwera proxy',
  caValidityRange: (from: string, to: string): string => `${from} – ${to}`,
  caLoading: 'Ładowanie szczegółów certyfikatu…',
  caUnavailable: 'Szczegóły certyfikatu są niedostępne.',
  caExportAction: 'Eksportuj',
  exportCaPem: 'Eksportuj .pem',
  exportCaCrt: 'Eksportuj .crt',
  caExportedPem: 'Wyeksportowano CA jako .pem.',
  caExportedCrt: 'Wyeksportowano CA jako .crt.',
  caExportFailed: 'Eksport nie powiódł się.',
};

/**
 * Polish (pl) translation of the main app shell UI strings. Mirrors the exact
 * shape of shared/strings/app.ts — same keys, order, nesting, and function
 * signatures. Parametrized strings stay functions; count-driven text uses the
 * Polish 3-form plural (one / few / many).
 */
export const app = {
  // Generic display fallbacks
  notAvailable: 'N/D',
  unknown: 'Nieznane',
  unknownError: 'Nieznany błąd',
  unknownRoku: 'Nieznane Roku',
  rokuDevice: 'Urządzenie Roku',
  remote: 'Zdalne',

  // Scan button (sidebar + title bar)
  scan: 'Skanuj',

  // Remote locations — sidebar section
  statusOffline: 'Offline',
  connecting: 'Łączenie...',
  serverInfoTitle: 'Informacje o serwerze',
  deviceCount: (n: number): string => {
    const few = n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14);
    const word = n === 1 ? 'urządzenie' : few ? 'urządzenia' : 'urządzeń';
    return `${n} ${word}`;
  },
  scanningForDevices: 'Skanowanie w poszukiwaniu urządzeń...',
  connectingToRelayServer: 'Łączenie z serwerem przekazującym...',
  serverOffline: 'Serwer offline',
  noRokuDevicesFound: 'Nie znaleziono urządzeń Roku',
  confirmRemoveLocation: (name: string): string => `Usunąć lokalizację "${name}"?`,

  // Add-location flow (errors surfaced via alert)
  locationHostExists: (host: string, name: string): string =>
    `Lokalizacja z hostem "${host}" już istnieje ("${name}").`,
  locationServerExists: (name: string): string =>
    `Lokalizacja z tym adresem serwera już istnieje ("${name}").`,
  unableToConnectRelay:
    'Nie można połączyć się z serwerem przekazującym. Sprawdź adres i upewnij się, że serwer działa.',
  failedToConnectRelay: 'Nie udało się połączyć z serwerem przekazującym',
  addLocation: 'Dodaj lokalizację',

  // Server capabilities modal
  serverCapabilities: {
    remote: { label: 'Zdalne sterowanie', desc: 'Polecenia klawiszy i nawigacji' },
    apps: { label: 'Aplikacje', desc: 'Wyświetlanie i uruchamianie zainstalowanych aplikacji' },
    query: { label: 'Zapytania', desc: 'Informacje o urządzeniu, stan odtwarzacza multimediów' },
    devApp: { label: 'Dev App', desc: 'Wgrywanie kanałów deweloperskich' },
    screenshot: { label: 'Zrzut ekranu', desc: 'Przechwytywanie ekranu urządzenia' },
    console: { label: 'Konsola', desc: 'Dane wyjściowe debugowania BrightScript' },
    debugger: { label: 'Debugger', desc: 'Punkty przerwania, wykonywanie krok po kroku, podgląd zmiennych' },
    appConnector: { label: 'App Connector', desc: 'Integracja RALE TrackerTask' },
    deepLink: { label: 'Deep-Link', desc: 'Uruchamianie treści z parametrami' },
    networkInspector: { label: 'Inspektor sieci', desc: 'Przechwytywanie DNS/SNI/HTTP + proxy MITM' }
  },
  capSupported: 'Obsługiwane',
  capNeedsRoot: 'Wymaga uprawnień root',
  capNotSupported: 'Nieobsługiwane',
  capabilitiesHeading: 'Możliwości',

  // Device cards + tabs
  devBadge: 'Dev',
  remoteOff: 'Pilot wyłączony',
  ecpBadgeDisabledTitle: 'Sterowanie przez aplikacje mobilne jest wyłączone',
  ecpLimited: 'ECP ograniczone',
  ecpBadgeLimitedTitle: 'ECP ograniczone: tekst, uruchamianie aplikacji i zapytania działają; pełna obsługa klawiszy może nie działać',
  deviceTypeTv: 'TV',
  deviceTypeStb: 'STB',
  labelType: 'Typ',
  labelIp: 'IP',
  labelModel: 'Model',
  labelSerial: 'Numer seryjny',
  labelSw: 'SW',
  expand: 'Rozwiń',
  minimize: 'Zwiń',
  reconnect: 'Połącz ponownie',
  atLocation: (value: string, location: string): string => `${value} @ ${location}`,

  // Device context menu
  copyDeviceName: 'Kopiuj nazwę urządzenia',
  copyIpAddress: 'Kopiuj adres IP',
  copyModelNumber: 'Kopiuj numer modelu',
  copySerialNumber: 'Kopiuj numer seryjny',
  copyAllDetails: 'Kopiuj wszystkie szczegóły',
  deviceDetails: (d: {
    deviceName?: string;
    ip?: string;
    modelName?: string;
    modelNumber?: string;
    serialNumber?: string;
    softwareVersion?: string;
    deviceId?: string;
    networkType?: string;
    wifiMac?: string;
  }): string =>
    `Nazwa urządzenia: ${d.deviceName}
Adres IP: ${d.ip}
Nazwa modelu: ${d.modelName}
Numer modelu: ${d.modelNumber}
Numer seryjny: ${d.serialNumber}
Wersja oprogramowania: ${d.softwareVersion || 'N/D'}
Identyfikator urządzenia: ${d.deviceId || 'N/D'}
Typ sieci: ${d.networkType || 'N/D'}
WiFi MAC: ${d.wifiMac || 'N/D'}`,

  // Offline / connection state
  deviceOffline: 'Urządzenie offline',
  unableToConnectDevice: 'Nie można połączyć się z tym urządzeniem Roku.',
  retryConnection: 'Ponów połączenie',

  // Device hardware-image modal
  labelScreenSize: 'Rozmiar ekranu',
  labelOsVersionBuild: 'Wersja i kompilacja systemu',
  checkForUpdates: 'Sprawdź aktualizacje',
  restartDevice: 'Uruchom ponownie urządzenie',
  checkForUpdatesLabel: 'Sprawdź aktualizacje',
  restartDeviceLabel: 'Uruchom ponownie urządzenie',
  deviceImageAria: (name: string): string => `${name} — zdjęcie urządzenia`,
  viewLargerImage: (name: string): string => `Wyświetl większe zdjęcie: ${name}`,
  deviceIpUnavailable: 'Adres IP urządzenia jest niedostępny.',
  setDevPasswordFirst: 'Najpierw ustaw hasło deweloperskie tego urządzenia (karta Dev App).',
  actionSucceeded: (label: string): string => `${label} — zakończono powodzeniem.`,
  actionFailed: (label: string): string => `${label} — nie powiodło się.`,
  actionFailedWith: (label: string, err: string): string => `${label} — nie powiodło się: ${err}`,

  // Apps tab
  installedApps: 'Zainstalowane aplikacje',
  installedAppsAndTvInputs: 'Zainstalowane aplikacje i wejścia TV',
  rawListOfApps: 'Surowa lista aplikacji',
  appsAndInputsList: 'Lista aplikacji i wejść',
  appTileTitle: (name: string, id: string): string => `${name}\nID: ${id}\nKliknij, aby uruchomić`,
  switchToInput: (name: string): string => `Przełącz na ${name}`,
  failedToLoadApps: 'Nie udało się załadować aplikacji:',
  errorPrefix: 'Błąd:',
  installedAppsHeader: 'ZAINSTALOWANE APLIKACJE',
  inputsHeader: 'WEJŚCIA',
  copied: 'Skopiowano!',
  copyList: 'Kopiuj listę',

  // Auto-connect toasts
  connectedAutomatically: (label: string): string => `Automatycznie połączono z ${label}.`,
  connectedMultipleAutomatically: (count: number): string => {
    const few = count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14);
    const word = count === 1 ? 'zapisane urządzenie' : few ? 'zapisane urządzenia' : 'zapisanych urządzeń';
    return `Automatycznie połączono ${count} ${word}.`;
  },

  // Manual connect
  couldNotConnectToIp: (ip: string): string =>
    `Nie można połączyć się z ${ip}. Upewnij się, że urządzenie Roku jest włączone i dostępne.`,
  connectionError: (err: string): string => `Błąd połączenia: ${err}`,

  // Custom title bar
  windowControlsUnavailable: 'Elementy sterujące okna są niedostępne. Zamknij i uruchom ponownie Roku Dev Studio.',
  restoreDown: 'Przywróć w dół',
  maximize: 'Maksymalizuj',

  // Log file
  couldNotOpenLogFile: (err: string): string => `Nie można otworzyć pliku dziennika: ${err}`,

  // Help modal
  searchHelpGuide: 'Przeszukaj pomoc i przewodnik',

  // ECP / Control by Mobile Apps warnings
  ecpWarnDisabledTitle: 'Sterowanie przez aplikacje mobilne wyłączone',
  ecpWarnDisabledDesc:
    'Zdalne sterowanie jest wyłączone. Włącz "Control by Mobile Apps" → Network Access na urządzeniu Roku, aby korzystać z pilota, aplikacji i wprowadzania tekstu.',
  ecpWarnLimitedTitle: 'Sterowanie przez aplikacje mobilne: ograniczone',
  ecpWarnLimitedDesc:
    'Wprowadzanie tekstu, uruchamianie aplikacji i zapytania do aplikacji działają. Pełna obsługa klawiszy pilota może być niedostępna — ustaw Network Access na <strong>Permissive</strong> lub <strong>Enabled</strong>, aby uzyskać pełną obsługę pilota.',
  ecpWarnSubnetTitle: 'Permissive: sprawdź sieć',
  ecpWarnSubnetDesc:
    'Tryb Permissive akceptuje polecenia tylko z tej samej podsieci. Twój komputer może znajdować się w innej podsieci; jeśli polecenia nie działają, sprawdź sieć.',

  // App Connector / TrackerTask
  trackerTaskSaved: 'Pomyślnie zapisano TrackerTask.xml!',
  failedToSaveTrackerTask: 'Nie udało się zapisać TrackerTask.xml:',
  errorSavingTrackerTask: 'Błąd podczas zapisywania TrackerTask:',
  integrationInfoCopied: 'Skopiowano informacje o integracji do schowka!',
  failedToCopyClipboard: 'Nie udało się skopiować do schowka',

  // App init
  appInitFailed: 'Inicjalizacja aplikacji nie powiodła się:',

  // ───────────────────────────────────────────────────────────────────────
  // Static index.html markup (filled by applyI18n). Inline English is kept as
  // the fallback; these mirror it (with ui-text-casing applied to labels).
  // ───────────────────────────────────────────────────────────────────────

  // Title bar
  titleBarToggleSidebar: 'Przełącz pasek boczny',
  titleBarScanTitle: 'Skanuj w poszukiwaniu urządzeń lokalnych i zdalnych',
  titleBarScanAria: 'Skanuj w poszukiwaniu urządzeń',
  titleBarHelpTitle: 'Pomoc i przewodnik użytkownika',
  titleBarHelpAria: 'Pomoc i przewodnik',
  helpAndGuide: 'Pomoc i przewodnik',
  floatingRemoteToggleTitle: 'Przełącz pływający pilot, który towarzyszy Ci poza kartami Pilot i Dev App',
  floatingRemoteToggleAria: 'Przełącz pływający pilot',
  floatingRemote: 'Pływający pilot',
  appMenu: 'Menu aplikacji',
  zoomOut: 'Pomniejsz',
  zoomIn: 'Powiększ',
  resetZoom: 'Przywróć powiększenie do 100%',
  currentZoomAria: 'Bieżące powiększenie; kliknij, aby przywrócić 100%',

  // Sidebar — device discovery
  sidebarLocal: 'Lokalne',
  manualConnect: 'Połącz ręcznie',
  addRemoteLocation: 'Dodaj zdalną lokalizację',
  viewLogsTitle: 'Wyświetl dzienniki debugowania (Desktop/roku-connector-debug.log)',
  viewLogs: 'Wyświetl dzienniki',

  // Welcome panel
  welcomeSubtitle:
    'Wykrywaj urządzenia Roku lokalnie lub przez zdalne przekaźniki, wgrywaj i uruchamiaj kanały przez Deep-Link, debuguj na żywo BrightScript za pomocą strumieniowej konsoli Telnet, automatyzuj kompleksowe scenariusze testowe i włącz agentów SI do swojego procesu deweloperskiego przez MCP.',
  featureDeviceDiscovery: 'Wykrywanie urządzeń',
  featureDeviceDiscoveryDesc: 'Automatyczne wykrywanie urządzeń Roku w sieci lokalnej przez SSDP.',
  featureAppsDeepLinking: 'Aplikacje i Deep-Linking',
  featureAppsDeepLinkingDesc: 'Przeglądaj i uruchamiaj aplikacje, korzystaj z Deep-Links z niestandardowymi parametrami.',
  featureDevAppDesc: 'Wgrywaj kanały deweloperskie i automatycznie przechwytuj zrzuty ekranu Dev App.',
  featureAppConnectorDesc: 'Wykonuj funkcje BrightScript w aplikacji wgranej przez sideload.',
  featureFiddle: 'Fiddle',
  featureFiddleDesc: 'Uruchamiaj fragmenty kodu BrightScript na urządzeniu w edytorze Monaco.',
  featureMcpServer: 'Serwer MCP',
  featureMcpServerDesc: 'Udostępnij Roku Dev Studio agentom SI za pomocą serwera MCP.',
  featureDeviceRemote: 'Pilot urządzenia',
  featureDeviceRemoteDesc: 'Pełny D-pad, sterowanie multimediami i wprowadzanie tekstu — jak prawdziwy pilot.',
  featureQueryDesc: 'Odpytuj informacje o urządzeniu, stan odtwarzacza multimediów i rejestr przez ECP.',
  featureConsoleDesc: 'Wyświetlaj dane debugowania BrightScript przez Telnet, filtruj, wyszukuj i debuguj',
  featureActionScriptsDesc: 'Łącz naciśnięcia klawiszy, uruchomienia i wywołania RALE w zautomatyzowane scenariusze.',
  featureNetworkInspectorDesc: 'Analizuj ruch HTTP/HTTPS aplikacji Dev App za pomocą proxy MITM.',
  featureRemoteLocations: 'Zdalne lokalizacje',
  featureRemoteLocationsDesc: 'Łącz się z urządzeniami Roku w dowolnym miejscu za pomocą serwerów przekazujących.',

  // Device-panel tabs
  tabRemote: 'Pilot',
  tabApps: 'Aplikacje',
  tabQuery: 'Zapytania',
  tabDevApp: 'Dev App',
  tabConsole: 'Konsola',
  tabAppConnector: 'App Connector',
  tabActionScripts: 'Skrypty akcji',
  tabNetwork: 'Sieć',

  // Device panel — performance strip & paused nav
  perfCpu: 'CPU',
  perfMem: 'Pam',
  perfObj: 'Obj',
  devicePerfPaused: 'Wydajność urządzenia wstrzymana — przełącz Dev App na pierwszy plan, aby wznowić.',
  devicePerfPausedShort: 'Wydajność urządzenia wstrzymana',
  launch: 'Uruchom',
  sideloadDevApp: 'Wgraj Dev App',
  sideload: 'Wgraj',

  // Shared warnings (Developer Mode / Control by Mobile Apps)
  developerModeNotEnabled: 'Tryb dewelopera nie jest włączony',
  ecpNotEnabledTitle: 'Sterowanie przez aplikacje mobilne nie jest włączone',
  howToEnable: 'Jak włączyć',
  devAppDevModeDesc: 'Wgrywanie aplikacji Dev App wymaga włączonego trybu dewelopera na urządzeniu Roku.',
  queryDevModeDesc: 'Niektóre funkcje zapytań mogą być ograniczone. Włącz tryb dewelopera, aby uzyskać pełny dostęp.',
  inspectorDevModeDesc: 'App Connector wymaga trybu dewelopera oraz kanału wgranego przez sideload z TrackerTask.',

  // Remote Section
  keyboardShortcutsRemoteTitle: 'Skróty klawiszowe dla tego pilota',
  keyboardShortcutsQuickRemoteTitle: 'Skróty klawiszowe dla szybkiego pilota',
  keyboardRemoteHelpAria: 'Pomoc dotycząca skrótów klawiszowych pilota',
  showDevicePerformance: 'Pokaż wydajność urządzenia',
  remoteBack: 'Wstecz',
  remoteHome: 'Ekran główny',
  remoteOptions: 'Opcje',
  remoteReplay: 'Powtórka',
  remoteVolUp: 'Głośność +',
  remoteMute: 'Wycisz',
  remoteVolDown: 'Głośność -',
  remotePower: 'Zasilanie',
  remoteRewind: 'Przewiń w tył',
  remotePlayPause: 'Odtwórz/Pauza',
  remoteForward: 'Przewiń w przód',
  sendTextPlaceholder: 'Wpisz tekst do wysłania do Roku...',
  sendText: 'Wyślij tekst',
  rokuSecretScreens: 'Ukryte ekrany Roku',
  secretScreensTitle: 'Sekwencje klawiszy pilota do ukrytych i diagnostycznych ekranów Roku',
  sectionRemoteControl: 'Zdalne sterowanie',
  sectionObjectCounts: 'Liczba obiektów BrightScript (Dev)',
  cpuUsage: 'Użycie CPU',
  sectionMemoryUsage: 'Użycie pamięci',

  // Remote Section — metrics quadrants
  brightScriptObjects: 'Obiekty BrightScript',
  objectMetricsMode: 'Tryb metryk obiektów',
  objectsModeCount: 'Liczba',
  objectsModeMemory: 'Pamięć',
  objectsTop10: 'Top 10',
  cpuMetricsMode: 'Tryb metryk CPU',
  cpuModePercent: 'CPU %',
  cpuModeProcess: 'Proces',
  systemMemory: 'Pamięć systemowa',
  legendTotal: 'Łącznie',
  legendUser: 'Użytkownik',
  legendKernel: 'Jądro',
  legendUsed: 'Użyte',
  legendResident: 'Rezydentna',
  legendAnonymous: 'Anonimowa',
  legendShared: 'Współdzielona',
  legendLimit: 'Limit',

  // Apps tab
  customLaunch: 'Niestandardowe uruchomienie',
  customAppIdPlaceholder: 'ID aplikacji (np. 12)',
  tvInputsLabel: 'Wejścia TV:',
  hdmi1: 'HDMI 1',
  hdmi2: 'HDMI 2',
  hdmi3: 'HDMI 3',
  hdmi4: 'HDMI 4',
  deepLink: 'Deep-Link',
  moreLaunchOptions: 'Więcej opcji uruchamiania',
  saveAndLaunch: 'Zapisz i uruchom',
  deeplinkSaved: 'Zapisano',
  selectSavedDeepLink: '-- Wybierz zapisany Deep-Link --',
  deleteSavedDeepLink: 'Usuń zapisany Deep-Link',
  appId: 'ID aplikacji',
  deeplinkAppIdPlaceholder: 'np. 31440',
  contentId: 'ID treści',
  contentIdPlaceholder: 'Identyfikator treści',
  mediaType: 'Typ multimediów',
  selectPlaceholder: '-- Wybierz --',
  mediaTypeMovie: 'Film',
  mediaTypeSeries: 'Serial',
  mediaTypeEpisode: 'Odcinek',
  mediaTypeLive: 'Na żywo',
  manageMediaTypes: 'Zarządzaj typami multimediów',
  addParameter: 'Dodaj parametr',
  deeplinkParamKeyPlaceholder: 'Klucz',
  deeplinkParamValuePlaceholder: 'Wartość',
  removeParameter: 'Usuń parametr',
  listApps: 'Lista',
  loadingApps: 'Ładowanie aplikacji...',
  inputsSectionLabel: 'Wejścia',
  noAppsFound: 'Nie znaleziono aplikacji. Kliknij Odśwież, aby załadować.',

  // Dev App tab
  auth: 'Autoryzacja',
  password: 'Hasło',
  verify: 'Zweryfikuj',
  remember: 'Zapamiętaj',
  selectPackage: 'Wybierz pakiet',
  install: 'Zainstaluj',
  typeTextShortPlaceholder: 'Wpisz tekst...',
  send: 'Wyślij',
  autoScreenshot: 'Automatyczny zrzut ekranu',
  screenshot: 'Zrzut ekranu',
  copyScreenshot: 'Kopiuj zrzut ekranu',
  downloadScreenshot: 'Pobierz zrzut ekranu',
  clearScreenshot: 'Wyczyść zrzut ekranu',
  capture: 'Przechwyć',
  clickCapture: 'Kliknij Przechwyć',

  // Query tab
  deviceQueries: 'Zapytania do urządzenia',
  queryDeviceInfo: 'Device Info',
  queryAllApps: 'All Apps',
  queryActiveApp: 'Active App',
  queryMediaPlayer: 'Media Player',
  queryPlugins: 'Plugins',
  queryMemory: 'Memory',
  developerQueries: 'Zapytania deweloperskie',
  openFiddle: 'Otwórz Fiddle',
  openFiddleTitle: 'Otwórz BrightScript Fiddle z tym urządzeniem wybranym wstępnie',
  openFiddleAria: 'Otwórz BrightScript Fiddle dla tego urządzenia',
  qsSceneGraph: 'SceneGraph',
  qsSgRendezvous: 'SG Rendezvous',
  qsFwBeacons: 'FW Beacons',
  qsPerformance: 'Wydajność',
  qsOther: 'Inne',
  qsCustom: 'Niestandardowe',
  queryAllNodes: 'All Nodes',
  queryRootNodes: 'Root Nodes',
  track: 'Track',
  events: 'Events',
  untrack: 'Untrack',
  queryFrameRate: 'Frame Rate',
  queryChannelPerf: 'Channel Perf',
  queryAppState: 'App State',
  queryRegistry: 'Registry',
  queryObjectCounts: 'Object Counts',
  run: 'Uruchom',
  customQueryPlaceholder: 'np. /query/device-info',
  results: 'Wyniki',
  removePluginPlaceholder: 'ID aplikacji (np. 987654_cf9a)',
  removePlugin: 'Usuń wtyczkę',

  // Console (Telnet) tab
  telnetConsole: 'Konsola Telnet',
  copyAllLogs: 'Kopiuj wszystkie dzienniki',
  saveLogsToFile: 'Zapisz dzienniki do pliku',
  clearConsole: 'Wyczyść konsolę',
  clearOptions: 'Opcje czyszczenia',
  clearRelayOnly: 'Wyczyść (tylko na serwerze przekazującym)',
  clearLocalAndRelay: 'Wyczyść (lokalnie i na serwerze przekazującym)',
  findResizeTitle: 'Przeciągnij, aby poszerzyć wyszukiwanie (dwukrotne kliknięcie resetuje)',
  consoleMonitor: 'Monitor konsoli',
  telnetPortBadge: 'Port 8085',
  connectPullRelayTitle: 'Połącz i pobierz bufor przekazujący',
  connectOptions: 'Opcje połączenia',
  connectLiveOnly: 'Połącz (pomiń istniejący bufor dzienników)',
  telnetPlaceholder: 'Połącz, aby wyświetlić dane debugowania BrightScript',
  jumpToLatestLogs: 'Przejdź do najnowszych dzienników',

  // App Connector tab
  connection: 'Połączenie',
  port: 'Port',
  logVerbosity: 'Szczegółowość dziennika',
  logVerbosityTitle: 'Poziom loggera RALE stosowany przy połączeniu',
  verbosityOff: 'Wyłączone',
  verbosityError: 'Błąd',
  verbosityWarning: 'Ostrzeżenie',
  verbosityInfo: 'Informacje',
  verbosityDebug: 'Debugowanie',
  integrationGuide: 'Przewodnik integracji',
  integrationGuideTitle: 'Jak zintegrować TrackerTask z App Connector',
  executeFunction: 'Wykonaj funkcję',
  functionLabel: 'Funkcja',
  connectToLoadFunctions: '-- Połącz, aby załadować funkcje --',
  execute: 'Wykonaj',
  parameters: 'Parametry',
  selectFunctionParams: 'Wybierz funkcję, aby zobaczyć parametry',
  response: 'Odpowiedź',
  updateNode: 'Aktualizuj węzeł',
  updateNodeBtnTitle: 'Po Get Node by ID: selectNode, następnie setField, removeField lub Add Field przez setField',
  action: 'Akcja',
  fieldAction: 'Akcja pola',
  updateField: 'Aktualizuj pole',
  addField: 'Dodaj pole',
  removeField: 'Usuń pole',
  field: 'Pole',
  fieldName: 'Nazwa pola',
  fieldNamePlaceholder: 'np. text, visible, width',
  fieldType: 'Typ pola',
  typeString: 'String',
  typeInteger: 'Integer',
  typeFloat: 'Float',
  typeBoolean: 'Boolean',
  typeColor: 'Color',
  typeArray: 'Array',
  typeAssocArray: 'AssocArray',
  value: 'Wartość',
  fieldValuePlaceholder: 'Skalary, true/false, JSON dla tablic / wektorów / obiektów',

  // Action Scripts tab
  builder: 'Kreator',
  executor: 'Wykonawca',
  copyToExecutor: 'Kopiuj do wykonawcy',
  copyActionScript: 'Kopiuj skrypt akcji',
  saveActionScript: 'Zapisz skrypt akcji',
  saveToDirectory: 'Zapisz do folderu…',
  moreSaveOptions: 'Więcej opcji zapisu',
  addActionToEnable: 'Dodaj co najmniej jedną akcję, aby włączyć',
  connectToConsole: 'Połącz z konsolą',
  editInBuilder: 'Edytuj w kreatorze',
  editInBuilderTitle: 'Otwórz bieżący skrypt na karcie Kreator',
  importActionScript: 'Importuj skrypt akcji',
  importActionScriptTitle: 'Importuj lub zaktualizuj skrypt akcji',
  actions: 'Akcje',
  builderImportTitle: 'Importuj skrypt z pliku lub wklej JSON',
  undoTitle: 'Cofnij (Ctrl+Z)',
  redoTitle: 'Ponów (Ctrl+Shift+Z)',
  clearAllActions: 'Wyczyść wszystkie akcje',
  helpForActionType: 'Pomoc dla tego typu akcji',
  closeAddStep: 'Zamknij dodawanie kroku',
  actionType: 'Typ akcji',
  addAction: 'Dodaj akcję',
  dragToResize: 'Przeciągnij, aby zmienić rozmiar',
  resizePanels: 'Zmień rozmiar paneli',
  json: 'JSON',
  uploadJson: 'Prześlij JSON',
  orPasteBelow: 'Lub wklej poniżej',
  validate: 'Sprawdź poprawność',
  devPasswordRequired: 'Niektóre akcje wymagają hasła deweloperskiego (zrzut ekranu, wgrywanie):',
  enterDevPassword: 'Wprowadź hasło deweloperskie',
  clearActions: 'Wyczyść akcje',
  runActionScript: 'Uruchom skrypt akcji',
  stopExecution: 'Zatrzymaj wykonywanie',
  copyResultsToClipboard: 'Kopiuj wyniki do schowka',
  saveResultsAsPdf: 'Zapisz wyniki jako PDF',
  clearResultsTitle: 'Wyczyść wyniki i zwolnij pamięć (do następnego uruchomienia nie będzie nic do zapisania)',

  // Network Inspector tab
  networkInspector: 'Inspektor sieci',
  niFindTitle: 'Znajdź w ruchu — URL, ładunki, nagłówki, treści odpowiedzi (⌘/Ctrl+F)',
  niFindAria: 'Znajdź w ruchu',
  niFindPrevTitle: 'Poprzednie dopasowanie (Shift+↑)',
  niFindPrev: 'Poprzednie dopasowanie',
  niFindNextTitle: 'Następne dopasowanie (Shift+↓)',
  niFindNext: 'Następne dopasowanie',
  niFindClear: 'Wyczyść wyniki wyszukiwania',
  niDownloadTitle: 'Pobierz sesję…',
  niDownloadAria: 'Pobierz sesję',
  niExportHar: 'Eksportuj wszystko jako HAR',
  niExportSession: 'Eksportuj sesję (.rds-network-inspector.json)',
  niSavePcap: 'Zapisz przechwycone pakiety (.pcap)',
  niClearTitle: 'Wyczyść listę sesji',
  niSetupBadgeTitle: 'Wymagana konfiguracja przechwytywania hotspot — kliknij, aby uzyskać instrukcje',
  niCaptureSetup: 'Konfiguracja przechwytywania',
  niPortBadgeTitle: 'Port proxy niedostępny — kliknij, aby uzyskać szczegóły',
  niProxyPortUnavailable: 'Port proxy niedostępny',
  niFilterPlaceholder: 'Filtruj ruch…',
  niFilterTitle: 'Filtruj ruch — kliknij ikonę informacji, aby zobaczyć obsługiwaną składnię.',
  niClearFilter: 'Wyczyść filtr',
  niFilterHelpTitle: 'Pomoc dotycząca filtrowania i obsługiwana składnia',
  niFilterHelpAria: 'Pomoc dotycząca filtrowania',
  niSessionCountTitle: 'Przechwycone sesje',
  niControls: 'Elementy sterujące Inspektor sieci',
  niToggleDetailLayout: 'Przełącz układ szczegółów',
  niConfigureTitle: 'Konfiguruj reguły ruchu',
  niGroupByHostTitle: 'Grupuj sesje według nazwy hosta',
  niGroupByHost: 'Grupuj według hosta',
  niProxiedTitle:
    'Pokaż tylko żądania przechodzące przez proxy RDS (pełne nagłówki + treść), ukrywając metadane SNI/DNS z przechwytywania hotspot',
  niProxied: 'Przez proxy',
  niWaitingForTraffic: 'Oczekiwanie na ruch…',
  niScrollBottom: 'Przewiń do najnowszych sesji',

  // App menu (hamburger)
  developerMode: 'Tryb dewelopera',
  privacyMode: 'Tryb prywatności',
  debugLogging: 'Rejestrowanie debugowania',
  openDiagnosticLogsFolder: 'Otwórz folder dzienników diagnostycznych',
  openLogFile: 'Otwórz plik dziennika',
  settings: 'Ustawienia',
  clearCacheAndReload: 'Wyczyść pamięć podręczną i przeładuj',
  zoom: 'Powiększenie',
  aboutRokuDevStudio: 'O Roku Dev Studio',
  quitRokuDevStudio: 'Zamknij Roku Dev Studio',

  // ───────────────────────────────────────────────────────────────────────
  // index.html localization pass — cloned-template defaults, empty-states,
  // attribute-only strings, and multi-element prose (data-i18n-html) blocks
  // that the earlier migration left inline.
  // ───────────────────────────────────────────────────────────────────────

  // Sidebar — local devices empty state (prose with <br>/<strong>)
  noDevicesFoundHtml: 'Nie znaleziono urządzeń.<br>Kliknij <strong>Skanuj</strong>, aby wykryć urządzenia Roku.',

  // Device panel header (cloned-template defaults, replaced by JS at runtime)
  deviceNamePlaceholder: 'Nazwa urządzenia',
  perfStripPausedPlaceholder: 'Wstrzymano — uruchom Dev App, aby wznowić',

  // ECP / Control by Mobile Apps warning descriptions (prose with <strong>)
  ecpRemoteWarningDescHtml:
    'Zdalne sterowanie (naciśnięcia klawiszy, aplikacje itp.) wymaga ustawienia "Control by Mobile Apps" → Network Access na <strong>Enabled</strong> na urządzeniu Roku.',
  ecpDevAppWarningDescHtml:
    'Funkcje szybkiego pilota i naciśnięć klawiszy wymagają ustawienia "Control by Mobile Apps" → Network Access na <strong>Enabled</strong> na urządzeniu Roku.',

  // Dev App tab — sideloaded-app default + screenshot image alt text
  noChannelSideloaded: 'Nie wgrano żadnego kanału',
  screenshotAlt: 'Zrzut ekranu Roku',

  // App Connector — Update Node modal intro (prose with <strong>/<code>) + response empty-state
  updateNodeModalIntroHtml:
    'Używa <strong>ścieżki</strong> z ostatniego udanego Get Node by ID. Akcje: <code>removeField</code>, <code>setField</code> (dodaj / aktualizuj).',
  responseWillAppearHere: 'Odpowiedź pojawi się tutaj...',

  // Action Scripts — Executor nudge + password-prompt hint (prose with <strong>/<code>)
  executorBuilderNudgeHtml:
    'Użyj karty <strong>Kreator</strong>, aby dodawać i edytować kroki za pomocą prowadzonych pól. Użyj tego obszaru, aby sprawdzić, zaimportować lub uruchomić JSON.',
  executorPasswordPromptHintHtml:
    'Wprowadź je tutaj i uruchom ponownie lub dodaj <code>"devPassword": "..."</code> do JSON swojego skryptu.'
};

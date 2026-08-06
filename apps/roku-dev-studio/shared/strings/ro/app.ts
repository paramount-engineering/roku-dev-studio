/**
 * Romanian (ro) UI strings for the main app shell — a translation of
 * shared/strings/app.ts. Same shape, keys, order, and function signatures as the
 * English source; only the string values are localized.
 *
 * Parametrized strings are functions returning the composed Romanian text.
 * Count-based plurals follow Romanian rules: singular for n === 1, plural
 * otherwise, and the preposition "de" is inserted before the noun when n === 0,
 * or when (n % 100) is 0 or falls in 20..99 (e.g. "1 dispozitiv",
 * "3 dispozitive", "20 de dispozitive", "105 dispozitive").
 */
export const app = {
  // Generic display fallbacks
  notAvailable: 'N/A',
  unknown: 'Necunoscut',
  unknownError: 'Eroare necunoscută',
  unknownRoku: 'Roku necunoscut',
  rokuDevice: 'Dispozitiv Roku',
  remote: 'La distanță',

  // Scan button (sidebar + title bar)
  scan: 'Scanează',

  // Remote locations — sidebar section
  statusOffline: 'Offline',
  connecting: 'Se conectează...',
  serverInfoTitle: 'Informații server',
  deviceCount: (n: number): string => {
    const de = n === 0 || n % 100 === 0 || (n % 100 >= 20 && n % 100 <= 99);
    return `${n} ${de ? 'de ' : ''}${n === 1 ? 'dispozitiv' : 'dispozitive'}`;
  },
  scanningForDevices: 'Se caută dispozitive...',
  connectingToRelayServer: 'Se conectează la serverul releu...',
  serverOffline: 'Server offline',
  noRokuDevicesFound: 'Nu s-au găsit dispozitive Roku',
  confirmRemoveLocation: (name: string): string => `Eliminați locația „${name}”?`,

  // Add-location flow (errors surfaced via alert)
  locationHostExists: (host: string, name: string): string =>
    `Există deja o locație cu gazda „${host}” („${name}”).`,
  locationServerExists: (name: string): string =>
    `Există deja o locație cu această adresă de server („${name}”).`,
  unableToConnectRelay:
    'Nu se poate conecta la serverul releu. Verificați adresa și asigurați-vă că serverul rulează.',
  failedToConnectRelay: 'Conectarea la serverul releu a eșuat',
  addLocation: 'Adaugă locație',

  // Server capabilities modal
  serverCapabilities: {
    remote: { label: 'Telecomandă', desc: 'Comenzi de taste și navigare' },
    apps: { label: 'Aplicații', desc: 'Listează și lansează aplicațiile instalate' },
    query: { label: 'Interogare', desc: 'Informații dispozitiv, stare player media' },
    devApp: { label: 'Dev App', desc: 'Încarcă lateral canale de dezvoltare' },
    screenshot: { label: 'Captură de ecran', desc: 'Capturează ecranul dispozitivului' },
    console: { label: 'Consolă', desc: 'Ieșire de depanare BrightScript' },
    debugger: { label: 'Depanator', desc: 'Puncte de întrerupere, execuție pas cu pas, inspecția variabilelor' },
    appConnector: { label: 'App Connector', desc: 'Integrare RALE TrackerTask' },
    deepLink: { label: 'Deep-Link', desc: 'Lansează conținut cu parametri' },
    networkInspector: { label: 'Inspector de rețea', desc: 'Capturează DNS/SNI/HTTP + proxy MITM' }
  },
  capSupported: 'Acceptat',
  capNeedsRoot: 'Necesită root',
  capNotSupported: 'Neacceptat',
  capabilitiesHeading: 'Capabilități',

  // Device cards + tabs
  devBadge: 'Dev',
  remoteOff: 'Telecomandă oprită',
  ecpBadgeDisabledTitle: 'Control by Mobile Apps este dezactivat',
  ecpLimited: 'ECP limitat',
  ecpBadgeLimitedTitle: 'ECP limitat: textul, lansarea aplicațiilor și interogarea funcționează; apăsarea completă a tastelor s-ar putea să nu',
  deviceTypeTv: 'TV',
  deviceTypeStb: 'STB',
  labelType: 'Tip',
  labelIp: 'IP',
  labelModel: 'Model',
  labelSerial: 'Serie',
  labelSw: 'SW',
  expand: 'Extinde',
  minimize: 'Minimizează',
  reconnect: 'Reconectează',
  atLocation: (value: string, location: string): string => `${value} @ ${location}`,

  // Device context menu
  copyDeviceName: 'Copiază numele dispozitivului',
  copyIpAddress: 'Copiază adresa IP',
  copyModelNumber: 'Copiază numărul modelului',
  copySerialNumber: 'Copiază numărul de serie',
  copyAllDetails: 'Copiază toate detaliile',
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
    `Nume dispozitiv: ${d.deviceName}
Adresă IP: ${d.ip}
Nume model: ${d.modelName}
Număr model: ${d.modelNumber}
Număr de serie: ${d.serialNumber}
Versiune software: ${d.softwareVersion || 'N/A'}
ID dispozitiv: ${d.deviceId || 'N/A'}
Tip de rețea: ${d.networkType || 'N/A'}
MAC WiFi: ${d.wifiMac || 'N/A'}`,

  // Offline / connection state
  deviceOffline: 'Dispozitiv offline',
  unableToConnectDevice: 'Nu se poate conecta la acest dispozitiv Roku.',
  retryConnection: 'Reîncearcă conectarea',

  // Device hardware-image modal
  labelScreenSize: 'Dimensiune ecran',
  labelOsVersionBuild: 'Versiune și build OS',
  checkForUpdates: 'Caută actualizări',
  restartDevice: 'Repornește dispozitivul',
  checkForUpdatesLabel: 'Caută actualizări',
  restartDeviceLabel: 'Repornește dispozitivul',
  deviceImageAria: (name: string): string => `${name} — imaginea dispozitivului`,
  viewLargerImage: (name: string): string => `Vezi imaginea mărită: ${name}`,
  deviceIpUnavailable: 'Adresa IP a dispozitivului nu este disponibilă.',
  setDevPasswordFirst: 'Setați mai întâi parola de dezvoltator a acestui dispozitiv (fila Dev App).',
  actionSucceeded: (label: string): string => `${label} a reușit.`,
  actionFailed: (label: string): string => `${label} a eșuat.`,
  actionFailedWith: (label: string, err: string): string => `${label} a eșuat: ${err}`,

  // Apps tab
  installedApps: 'Aplicații instalate',
  installedAppsAndTvInputs: 'Aplicații instalate și intrări TV',
  rawListOfApps: 'Listă brută de aplicații',
  appsAndInputsList: 'Listă de aplicații și intrări',
  appTileTitle: (name: string, id: string): string => `${name}\nID: ${id}\nFaceți clic pentru a lansa`,
  switchToInput: (name: string): string => `Comută la ${name}`,
  failedToLoadApps: 'Încărcarea aplicațiilor a eșuat:',
  errorPrefix: 'Eroare:',
  installedAppsHeader: 'APLICAȚII INSTALATE',
  inputsHeader: 'INTRĂRI',
  copied: 'Copiat!',
  copyList: 'Copiază lista',

  // Auto-connect toasts
  connectedAutomatically: (label: string): string => `Conectat automat la ${label}.`,
  connectedMultipleAutomatically: (count: number): string => {
    const de = count === 0 || count % 100 === 0 || (count % 100 >= 20 && count % 100 <= 99);
    return `Conectat automat la ${count} ${de ? 'de ' : ''}dispozitive salvate.`;
  },

  // Manual connect
  couldNotConnectToIp: (ip: string): string =>
    `Nu s-a putut conecta la ${ip}. Asigurați-vă că dispozitivul Roku este pornit și accesibil.`,
  connectionError: (err: string): string => `Eroare de conexiune: ${err}`,

  // Custom title bar
  windowControlsUnavailable: 'Comenzile ferestrei nu sunt disponibile. Închideți și reporniți Roku Dev Studio.',
  restoreDown: 'Restabilește în jos',
  maximize: 'Maximizează',

  // Log file
  couldNotOpenLogFile: (err: string): string => `Nu s-a putut deschide fișierul jurnal: ${err}`,

  // Help modal
  searchHelpGuide: 'Caută în ajutor și ghid',

  // ECP / Control by Mobile Apps warnings
  ecpWarnDisabledTitle: 'Control by Mobile Apps dezactivat',
  ecpWarnDisabledDesc:
    'Telecomanda este oprită. Activați „Control by Mobile Apps” → Network Access pe dispozitivul Roku pentru a folosi telecomanda, aplicațiile și introducerea de text.',
  ecpWarnLimitedTitle: 'Control by Mobile Apps: limitat',
  ecpWarnLimitedDesc:
    'Introducerea de text, lansarea și interogarea aplicațiilor funcționează. Apăsarea completă a tastelor de pe telecomandă s-ar putea să nu fie disponibilă — setați Network Access la <strong>Permissive</strong> sau <strong>Enabled</strong> pentru telecomandă completă.',
  ecpWarnSubnetTitle: 'Permissive: verificați rețeaua',
  ecpWarnSubnetDesc:
    'Modul Permissive acceptă comenzi doar din aceeași subrețea. Este posibil ca mașina dvs. să fie într-o subrețea diferită; dacă comenzile eșuează, verificați rețeaua.',

  // App Connector / TrackerTask
  trackerTaskSaved: 'TrackerTask.xml a fost salvat cu succes!',
  failedToSaveTrackerTask: 'Salvarea TrackerTask.xml a eșuat:',
  errorSavingTrackerTask: 'Eroare la salvarea TrackerTask:',
  integrationInfoCopied: 'Informațiile de integrare au fost copiate în clipboard!',
  failedToCopyClipboard: 'Copierea în clipboard a eșuat',

  // App init
  appInitFailed: 'Inițializarea aplicației a eșuat:',

  // ───────────────────────────────────────────────────────────────────────
  // Static index.html markup (filled by applyI18n). Inline English is kept as
  // the fallback; these mirror it (with ui-text-casing applied to labels).
  // ───────────────────────────────────────────────────────────────────────

  // Title bar
  titleBarToggleSidebar: 'Comută bara laterală',
  titleBarScanTitle: 'Scanează dispozitive locale și la distanță',
  titleBarScanAria: 'Scanează dispozitive',
  titleBarHelpTitle: 'Ajutor și ghid de utilizare',
  titleBarHelpAria: 'Ajutor și ghid',
  helpAndGuide: 'Ajutor și ghid',
  floatingRemoteToggleTitle: 'Comută o telecomandă flotantă care te urmează în afara filelor Telecomandă și Dev App',
  floatingRemoteToggleAria: 'Comută telecomanda flotantă',
  floatingRemote: 'Telecomandă flotantă',
  appMenu: 'Meniul aplicației',
  zoomOut: 'Micșorează',
  zoomIn: 'Mărește',
  resetZoom: 'Resetează zoomul la 100%',
  currentZoomAria: 'Zoom curent; faceți clic pentru a reseta la 100%',

  // Sidebar — device discovery
  sidebarLocal: 'Local',
  manualConnect: 'Conectare manuală',
  addRemoteLocation: 'Adaugă locație la distanță',
  viewLogsTitle: 'Vezi jurnalele de depanare (Desktop/roku-connector-debug.log)',
  viewLogs: 'Vezi jurnalele',

  // Welcome panel
  welcomeSubtitle:
    'Descoperă dispozitive Roku local sau prin relee la distanță, încarcă lateral canale și accesează-le prin deep-link, depanează BrightScript în timp real cu o consolă Telnet în flux, automatizează fluxuri de testare cap la cap și adu agenți IA în bucla de dezvoltare prin MCP.',
  featureDeviceDiscovery: 'Descoperire dispozitive',
  featureDeviceDiscoveryDesc: 'Descoperă automat dispozitive Roku în rețeaua locală prin SSDP.',
  featureAppsDeepLinking: 'Aplicații și Deep-Linking',
  featureAppsDeepLinkingDesc: 'Răsfoiește, lansează aplicații, folosește Deep-Links cu parametri personalizați.',
  featureDevAppDesc: 'Încarcă lateral canale de dezvoltare și capturează automat ecrane din Dev App.',
  featureAppConnectorDesc: 'Execută funcții BrightScript pe o aplicație încărcată lateral.',
  featureFiddle: 'Fiddle',
  featureFiddleDesc: 'Rulează fragmente BrightScript pe dispozitiv într-un editor Monaco.',
  featureMcpServer: 'Server MCP',
  featureMcpServerDesc: 'Expune Roku Dev Studio agenților IA folosind serverul MCP.',
  featureDeviceRemote: 'Telecomandă dispozitiv',
  featureDeviceRemoteDesc: 'D-pad complet, comenzi media și introducere de text — ca o telecomandă reală.',
  featureQueryDesc: 'Interoghează informații despre dispozitiv, starea player-ului media și registrul prin ECP.',
  featureConsoleDesc: 'Vezi ieșirea de depanare BrightScript prin Telnet, filtrează, caută și depanează',
  featureActionScriptsDesc: 'Înlănțuie apăsări de taste, lansări și apeluri RALE în fluxuri automatizate.',
  featureNetworkInspectorDesc: 'Inspectează traficul HTTP/HTTPS al Dev App printr-un proxy MITM.',
  featureRemoteLocations: 'Locații la distanță',
  featureRemoteLocationsDesc: 'Conectează-te la dispozitive Roku de oriunde prin servere releu.',

  // Device-panel tabs
  tabRemote: 'Telecomandă',
  tabApps: 'Aplicații',
  tabQuery: 'Interogare',
  tabDevApp: 'Dev App',
  tabConsole: 'Consolă',
  tabAppConnector: 'App Connector',
  tabActionScripts: 'Scripturi de acțiune',
  tabNetwork: 'Rețea',

  // Device panel — performance strip & paused nav
  perfCpu: 'CPU',
  perfMem: 'Mem',
  perfObj: 'Obj',
  devicePerfPaused: 'Performanța dispozitivului este în pauză — adu Dev App în prim-plan pentru a relua.',
  devicePerfPausedShort: 'Performanța dispozitivului în pauză',
  launch: 'Lansează',
  sideloadDevApp: 'Încarcă lateral Dev App',
  sideload: 'Încarcă lateral',

  // Shared warnings (Developer Mode / Control by Mobile Apps)
  developerModeNotEnabled: 'Developer Mode nu este activat',
  ecpNotEnabledTitle: 'Control by Mobile Apps nu este activat',
  howToEnable: 'Cum se activează',
  devAppDevModeDesc: 'Încărcarea laterală a Dev App necesită activarea Developer Mode pe dispozitivul Roku.',
  queryDevModeDesc: 'Unele funcții de interogare pot fi limitate. Activați Developer Mode pentru acces complet.',
  inspectorDevModeDesc: 'App Connector necesită Developer Mode și un canal încărcat lateral cu TrackerTask.',

  // Remote Section
  keyboardShortcutsRemoteTitle: 'Scurtături de tastatură pentru această telecomandă',
  keyboardShortcutsQuickRemoteTitle: 'Scurtături de tastatură pentru telecomanda rapidă',
  keyboardRemoteHelpAria: 'Ajutor pentru scurtăturile de tastatură ale telecomenzii',
  showDevicePerformance: 'Afișează performanța dispozitivului',
  remoteBack: 'Înapoi',
  remoteHome: 'Acasă',
  remoteOptions: 'Opțiuni',
  remoteReplay: 'Reluare',
  remoteVolUp: 'Vol +',
  remoteMute: 'Mut',
  remoteVolDown: 'Vol -',
  remotePower: 'Pornire',
  remoteRewind: 'Derulare înapoi',
  remotePlayPause: 'Redare/Pauză',
  remoteForward: 'Derulare înainte',
  sendTextPlaceholder: 'Scrieți textul de trimis către Roku...',
  sendText: 'Trimite text',
  rokuSecretScreens: 'Ecrane secrete Roku',
  secretScreensTitle: 'Secvențe de taste pe telecomandă pentru ecranele secrete și de diagnosticare Roku',
  sectionRemoteControl: 'Telecomandă',
  sectionObjectCounts: 'Număr de obiecte BrightScript (Dev)',
  cpuUsage: 'Utilizare CPU',
  sectionMemoryUsage: 'Utilizare memorie',

  // Remote Section — metrics quadrants
  brightScriptObjects: 'Obiecte BrightScript',
  objectMetricsMode: 'Mod metrici obiecte',
  objectsModeCount: 'Număr',
  objectsModeMemory: 'Memorie',
  objectsTop10: 'Top 10',
  cpuMetricsMode: 'Mod metrici CPU',
  cpuModePercent: 'CPU %',
  cpuModeProcess: 'Proces',
  systemMemory: 'Memorie sistem',
  legendTotal: 'Total',
  legendUser: 'Utilizator',
  legendKernel: 'Kernel',
  legendUsed: 'Utilizat',
  legendResident: 'Rezident',
  legendAnonymous: 'Anonim',
  legendShared: 'Partajat',
  legendLimit: 'Limită',

  // Apps tab
  customLaunch: 'Lansare personalizată',
  customAppIdPlaceholder: 'ID aplicație (ex.: 12)',
  tvInputsLabel: 'Intrări TV:',
  hdmi1: 'HDMI 1',
  hdmi2: 'HDMI 2',
  hdmi3: 'HDMI 3',
  hdmi4: 'HDMI 4',
  deepLink: 'Deep-Link',
  moreLaunchOptions: 'Mai multe opțiuni de lansare',
  saveAndLaunch: 'Salvează și lansează',
  deeplinkSaved: 'Salvat',
  selectSavedDeepLink: '-- Selectează un Deep-Link salvat --',
  deleteSavedDeepLink: 'Șterge Deep-Link-ul salvat',
  appId: 'ID aplicație',
  deeplinkAppIdPlaceholder: 'ex.: 31440',
  contentId: 'ID conținut',
  contentIdPlaceholder: 'Identificator de conținut',
  mediaType: 'Tip media',
  selectPlaceholder: '-- Selectează --',
  mediaTypeMovie: 'Film',
  mediaTypeSeries: 'Serial',
  mediaTypeEpisode: 'Episod',
  mediaTypeLive: 'În direct',
  manageMediaTypes: 'Gestionează tipurile media',
  addParameter: 'Adaugă parametru',
  deeplinkParamKeyPlaceholder: 'Cheie',
  deeplinkParamValuePlaceholder: 'Valoare',
  removeParameter: 'Elimină parametru',
  listApps: 'Listează',
  loadingApps: 'Se încarcă aplicațiile...',
  inputsSectionLabel: 'Intrări',
  noAppsFound: 'Nu s-au găsit aplicații. Faceți clic pe Reîmprospătează pentru a le încărca.',

  // Dev App tab
  auth: 'Autentificare',
  password: 'Parolă',
  verify: 'Verifică',
  remember: 'Reține',
  selectPackage: 'Selectează pachetul',
  install: 'Instalează',
  typeTextShortPlaceholder: 'Scrieți textul...',
  send: 'Trimite',
  autoScreenshot: 'Captură automată',
  screenshot: 'Captură de ecran',
  copyScreenshot: 'Copiază captura',
  downloadScreenshot: 'Descarcă captura',
  clearScreenshot: 'Șterge captura',
  capture: 'Capturează',
  clickCapture: 'Faceți clic pe Capturează',

  // Query tab
  deviceQueries: 'Interogări dispozitiv',
  queryDeviceInfo: 'Device Info',
  queryAllApps: 'All Apps',
  queryActiveApp: 'Active App',
  queryMediaPlayer: 'Media Player',
  queryPlugins: 'Plugins',
  queryMemory: 'Memory',
  developerQueries: 'Interogări de dezvoltator',
  openFiddle: 'Deschide Fiddle',
  openFiddleTitle: 'Deschide BrightScript Fiddle cu acest dispozitiv preselectat',
  openFiddleAria: 'Deschide BrightScript Fiddle pentru acest dispozitiv',
  qsSceneGraph: 'SceneGraph',
  qsSgRendezvous: 'SG Rendezvous',
  qsFwBeacons: 'FW Beacons',
  qsPerformance: 'Performanță',
  qsOther: 'Altele',
  qsCustom: 'Personalizat',
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
  run: 'Rulează',
  customQueryPlaceholder: 'ex. /query/device-info',
  results: 'Rezultate',
  removePluginPlaceholder: 'ID aplicație (ex.: 987654_cf9a)',
  removePlugin: 'Elimină plugin-ul',

  // Console (Telnet) tab
  telnetConsole: 'Consolă Telnet',
  copyAllLogs: 'Copiază toate jurnalele',
  saveLogsToFile: 'Salvează jurnalele într-un fișier',
  clearConsole: 'Golește consola',
  clearOptions: 'Opțiuni de golire',
  clearRelayOnly: 'Golește (doar pe serverul releu)',
  clearLocalAndRelay: 'Golește (local și pe serverul releu)',
  findResizeTitle: 'Trageți pentru a lărgi căutarea (dublu-clic pentru resetare)',
  consoleMonitor: 'Monitor consolă',
  telnetPortBadge: 'Port 8085',
  connectPullRelayTitle: 'Conectează și preia bufferul releului',
  connectOptions: 'Opțiuni de conectare',
  connectLiveOnly: 'Conectează (omite bufferul de jurnale existent)',
  telnetPlaceholder: 'Conectați-vă pentru a vedea ieșirea de depanare BrightScript',
  jumpToLatestLogs: 'Sari la cele mai recente jurnale',

  // App Connector tab
  connection: 'Conexiune',
  port: 'Port',
  logVerbosity: 'Detaliere jurnal',
  logVerbosityTitle: 'Nivelul logger-ului RALE aplicat la conectare',
  verbosityOff: 'Oprit',
  verbosityError: 'Eroare',
  verbosityWarning: 'Avertisment',
  verbosityInfo: 'Info',
  verbosityDebug: 'Depanare',
  integrationGuide: 'Ghid de integrare',
  integrationGuideTitle: 'Cum se integrează TrackerTask cu App Connector',
  executeFunction: 'Execută funcția',
  functionLabel: 'Funcție',
  connectToLoadFunctions: '-- Conectați-vă pentru a încărca funcțiile --',
  execute: 'Execută',
  parameters: 'Parametri',
  selectFunctionParams: 'Selectați o funcție pentru a vedea parametrii',
  response: 'Răspuns',
  updateNode: 'Actualizează nodul',
  updateNodeBtnTitle: 'După Get Node by ID: selectNode apoi setField, removeField sau Add Field prin setField',
  action: 'Acțiune',
  fieldAction: 'Acțiune câmp',
  updateField: 'Actualizează câmpul',
  addField: 'Adaugă câmp',
  removeField: 'Elimină câmpul',
  field: 'Câmp',
  fieldName: 'Nume câmp',
  fieldNamePlaceholder: 'ex.: text, visible, width',
  fieldType: 'Tip câmp',
  typeString: 'String',
  typeInteger: 'Integer',
  typeFloat: 'Float',
  typeBoolean: 'Boolean',
  typeColor: 'Color',
  typeArray: 'Array',
  typeAssocArray: 'AssocArray',
  value: 'Valoare',
  fieldValuePlaceholder: 'Scalari, true/false, JSON pentru Arrays / Vectors / Objects',

  // Action Scripts tab
  builder: 'Constructor',
  executor: 'Executor',
  copyToExecutor: 'Copiază în Executor',
  copyActionScript: 'Copiază scriptul de acțiune',
  saveActionScript: 'Salvează scriptul de acțiune',
  saveToDirectory: 'Salvează în folder…',
  moreSaveOptions: 'Mai multe opțiuni de salvare',
  addActionToEnable: 'Adăugați cel puțin o acțiune pentru a activa',
  connectToConsole: 'Conectează-te la consolă',
  editInBuilder: 'Editează în Constructor',
  editInBuilderTitle: 'Deschide scriptul curent în fila Constructor',
  importActionScript: 'Importă scriptul de acțiune',
  importActionScriptTitle: 'Importă sau actualizează scriptul de acțiune',
  actions: 'Acțiuni',
  builderImportTitle: 'Importă scriptul dintr-un fișier sau lipește JSON',
  undoTitle: 'Anulează (Ctrl+Z)',
  redoTitle: 'Refă (Ctrl+Shift+Z)',
  clearAllActions: 'Șterge toate acțiunile',
  helpForActionType: 'Ajutor pentru acest tip de acțiune',
  closeAddStep: 'Închide adăugarea pasului',
  actionType: 'Tip de acțiune',
  addAction: 'Adaugă acțiune',
  dragToResize: 'Trageți pentru redimensionare',
  resizePanels: 'Redimensionează panourile',
  json: 'JSON',
  uploadJson: 'Încarcă JSON',
  orPasteBelow: 'Sau lipiți mai jos',
  validate: 'Validează',
  devPasswordRequired: 'Parola de dezvoltator este necesară pentru unele acțiuni (captură de ecran, încărcare laterală):',
  enterDevPassword: 'Introduceți parola de dezvoltator',
  clearActions: 'Șterge acțiunile',
  runActionScript: 'Rulează scriptul de acțiune',
  stopExecution: 'Oprește execuția',
  copyResultsToClipboard: 'Copiază rezultatele în clipboard',
  saveResultsAsPdf: 'Salvează rezultatele ca PDF',
  clearResultsTitle: 'Șterge rezultatele și eliberează memoria (Salvarea nu va avea nimic până la următoarea Rulare)',

  // Network Inspector tab
  networkInspector: 'Inspector de rețea',
  niFindTitle: 'Caută în trafic — URL, payload-uri, anteturi, corpuri de răspuns (⌘/Ctrl+F)',
  niFindAria: 'Caută în trafic',
  niFindPrevTitle: 'Potrivirea anterioară (Shift+↑)',
  niFindPrev: 'Potrivirea anterioară',
  niFindNextTitle: 'Potrivirea următoare (Shift+↓)',
  niFindNext: 'Potrivirea următoare',
  niFindClear: 'Șterge rezultatele căutării',
  niDownloadTitle: 'Descarcă sesiunea…',
  niDownloadAria: 'Descarcă sesiunea',
  niExportHar: 'Exportă tot ca HAR',
  niExportSession: 'Exportă sesiunea (.rds-network-inspector.json)',
  niSavePcap: 'Salvează captura de pachete (.pcap)',
  niClearTitle: 'Șterge lista de sesiuni',
  niSetupBadgeTitle: 'Este necesară configurarea capturii prin hotspot — faceți clic pentru instrucțiuni',
  niCaptureSetup: 'Configurare captură',
  niPortBadgeTitle: 'Portul proxy nu este disponibil — faceți clic pentru detalii',
  niProxyPortUnavailable: 'Portul proxy nu este disponibil',
  niFilterPlaceholder: 'Filtrează traficul…',
  niFilterTitle: 'Filtrează traficul — faceți clic pe pictograma info pentru sintaxa acceptată.',
  niClearFilter: 'Șterge filtrul',
  niFilterHelpTitle: 'Ajutor pentru filtrare și sintaxa acceptată',
  niFilterHelpAria: 'Ajutor pentru filtrare',
  niSessionCountTitle: 'Sesiuni capturate',
  niControls: 'Comenzi Inspector de rețea',
  niToggleDetailLayout: 'Comută aspectul detaliilor',
  niConfigureTitle: 'Configurează regulile de trafic',
  niGroupByHostTitle: 'Grupează sesiunile după numele gazdei',
  niGroupByHost: 'Grupează după gazdă',
  niProxiedTitle:
    'Afișează doar cererile trecute prin proxy RDS (anteturi complete + corp), ascunzând metadatele SNI/DNS din captura prin hotspot',
  niProxied: 'Prin proxy',
  niWaitingForTraffic: 'Se așteaptă trafic…',
  niScrollBottom: 'Derulează la cele mai recente sesiuni',

  // App menu (hamburger)
  developerMode: 'Developer Mode',
  privacyMode: 'Mod confidențialitate',
  debugLogging: 'Jurnalizare de depanare',
  openDiagnosticLogsFolder: 'Deschide folderul jurnalelor de diagnosticare',
  openLogFile: 'Deschide fișierul jurnal',
  settings: 'Setări',
  clearCacheAndReload: 'Golește cache-ul și reîncarcă',
  zoom: 'Zoom',
  aboutRokuDevStudio: 'Despre Roku Dev Studio',
  quitRokuDevStudio: 'Ieși din Roku Dev Studio',

  // ───────────────────────────────────────────────────────────────────────
  // index.html localization pass — cloned-template defaults, empty-states,
  // attribute-only strings, and multi-element prose (data-i18n-html) blocks
  // that the earlier migration left inline.
  // ───────────────────────────────────────────────────────────────────────

  // Sidebar — local devices empty state (prose with <br>/<strong>)
  noDevicesFoundHtml: 'Nu s-au găsit dispozitive.<br>Apasă <strong>Scanează</strong> pentru a descoperi dispozitive Roku.',

  // Device panel header (cloned-template defaults, replaced by JS at runtime)
  deviceNamePlaceholder: 'Nume dispozitiv',
  perfStripPausedPlaceholder: 'În pauză — lansează Dev App pentru a relua',

  // ECP / Control by Mobile Apps warning descriptions (prose with <strong>)
  ecpRemoteWarningDescHtml:
    'Telecomanda (apăsare de taste, aplicații etc.) necesită ca „Control by Mobile Apps” → Network Access să fie setat la <strong>Enabled</strong> pe dispozitivul Roku.',
  ecpDevAppWarningDescHtml:
    'Telecomanda rapidă și funcțiile de apăsare a tastelor necesită ca „Control by Mobile Apps” → Network Access să fie <strong>Enabled</strong> pe dispozitivul Roku.',

  // Dev App tab — sideloaded-app default + screenshot image alt text
  noChannelSideloaded: 'Niciun canal încărcat',
  screenshotAlt: 'Captură de ecran Roku',

  // App Connector — Update Node modal intro (prose with <strong>/<code>) + response empty-state
  updateNodeModalIntroHtml:
    'Folosește <strong>calea</strong> de la ultima executare reușită a Get Node by ID. Acțiuni: <code>removeField</code>, <code>setField</code> (adaugă / actualizează).',
  responseWillAppearHere: 'Răspunsul va apărea aici...',

  // Action Scripts — Executor nudge + password-prompt hint (prose with <strong>/<code>)
  executorBuilderNudgeHtml:
    'Folosește fila <strong>Constructor</strong> pentru a adăuga și edita pași cu câmpuri ghidate. Folosește această zonă pentru a valida, importa sau rula JSON.',
  executorPasswordPromptHintHtml:
    'Introdu-o aici și rulează din nou sau adaugă <code>"devPassword": "..."</code> în JSON-ul scriptului.'
};

/**
 * Ukrainian (uk) UI strings for the main app shell (renderer/app.ts): device
 * sidebar cards, device tabs, connect/scan flow, remote-location + server-info
 * modals, device hardware-image modal, Apps tab, ECP/Control-by-Mobile-Apps
 * warnings, toasts, and dialogs.
 *
 * Parametrized strings are functions returning the composed text — the standard
 * way to keep interpolation translatable without a runtime format library.
 * Count-based functions apply Ukrainian (Slavic) 3-form plural logic.
 */
export const app = {
  // Generic display fallbacks
  notAvailable: 'Н/Д',
  unknown: 'Невідомо',
  unknownError: 'Невідома помилка',
  unknownRoku: 'Невідомий Roku',
  rokuDevice: 'Пристрій Roku',
  remote: 'Віддалений',

  // Scan button (sidebar + title bar)
  scan: 'Сканувати',

  // Remote locations — sidebar section
  statusOffline: 'Офлайн',
  connecting: 'Підключення...',
  serverInfoTitle: 'Інформація про сервер',
  deviceCount: (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      mod10 === 1 && mod100 !== 11
        ? 'пристрій'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'пристрої'
          : 'пристроїв';
    return `${n} ${word}`;
  },
  scanningForDevices: 'Сканування пристроїв...',
  connectingToRelayServer: 'Підключення до relay-сервера...',
  serverOffline: 'Сервер офлайн',
  noRokuDevicesFound: 'Пристроїв Roku не знайдено',
  confirmRemoveLocation: (name: string): string => `Видалити розташування «${name}»?`,

  // Add-location flow (errors surfaced via alert)
  locationHostExists: (host: string, name: string): string =>
    `Розташування з хостом «${host}» вже існує («${name}»).`,
  locationServerExists: (name: string): string =>
    `Розташування з цією адресою сервера вже існує («${name}»).`,
  unableToConnectRelay:
    'Не вдалося підключитися до relay-сервера. Перевірте адресу та переконайтеся, що сервер запущено.',
  failedToConnectRelay: 'Не вдалося підключитися до relay-сервера',
  addLocation: 'Додати розташування',

  // Server capabilities modal
  serverCapabilities: {
    remote: { label: 'Дистанційне керування', desc: 'Команди натискання клавіш і навігації' },
    apps: { label: 'Застосунки', desc: 'Список і запуск встановлених застосунків' },
    query: { label: 'Запити', desc: 'Інформація про пристрій, стан медіапрогравача' },
    devApp: { label: 'Dev App', desc: 'Sideload каналів розробки' },
    screenshot: { label: 'Знімок екрана', desc: 'Захоплення екрана пристрою' },
    console: { label: 'Консоль', desc: 'Налагоджувальний вивід BrightScript' },
    appConnector: { label: 'App Connector', desc: 'Інтеграція RALE TrackerTask' },
    deepLink: { label: 'Deep-Link', desc: 'Запуск контенту з параметрами' },
    networkInspector: { label: 'Інспектор мережі', desc: 'Захоплення DNS/SNI/HTTP + MITM-проксі' }
  },
  capSupported: 'Підтримується',
  capNeedsRoot: 'Потрібен root',
  capNotSupported: 'Не підтримується',
  capabilitiesHeading: 'Можливості',

  // Device cards + tabs
  devBadge: 'Dev',
  remoteOff: 'Пульт вимкнено',
  ecpBadgeDisabledTitle: 'Керування через мобільні застосунки вимкнено',
  ecpLimited: 'ECP обмежено',
  ecpBadgeLimitedTitle: 'ECP обмежено: працюють текст, запуск застосунків і запити; повне натискання клавіш може не працювати',
  deviceTypeTv: 'TV',
  deviceTypeStb: 'STB',
  labelType: 'Тип',
  labelIp: 'IP',
  labelModel: 'Модель',
  labelSerial: 'Серійний №',
  labelSw: 'SW',
  expand: 'Розгорнути',
  minimize: 'Згорнути',
  reconnect: 'Перепідключити',
  atLocation: (value: string, location: string): string => `${value} @ ${location}`,

  // Device context menu
  copyDeviceName: 'Копіювати назву пристрою',
  copyIpAddress: 'Копіювати IP-адресу',
  copyModelNumber: 'Копіювати номер моделі',
  copySerialNumber: 'Копіювати серійний номер',
  copyAllDetails: 'Копіювати всі відомості',
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
    `Назва пристрою: ${d.deviceName}
IP-адреса: ${d.ip}
Назва моделі: ${d.modelName}
Номер моделі: ${d.modelNumber}
Серійний номер: ${d.serialNumber}
Версія ПЗ: ${d.softwareVersion || 'Н/Д'}
ID пристрою: ${d.deviceId || 'Н/Д'}
Тип мережі: ${d.networkType || 'Н/Д'}
WiFi MAC: ${d.wifiMac || 'Н/Д'}`,

  // Offline / connection state
  deviceOffline: 'Пристрій офлайн',
  unableToConnectDevice: 'Не вдалося підключитися до цього пристрою Roku.',
  retryConnection: 'Повторити підключення',

  // Device hardware-image modal
  labelScreenSize: 'Розмір екрана',
  labelOsVersionBuild: 'Версія та збірка ОС',
  checkForUpdates: 'Перевірити наявність оновлень',
  restartDevice: 'Перезапустити пристрій',
  checkForUpdatesLabel: 'Перевірити наявність оновлень',
  restartDeviceLabel: 'Перезапустити пристрій',
  deviceImageAria: (name: string): string => `${name} — зображення пристрою`,
  viewLargerImage: (name: string): string => `Переглянути більше зображення: ${name}`,
  deviceIpUnavailable: 'IP-адреса пристрою недоступна.',
  setDevPasswordFirst: 'Спочатку встановіть пароль розробника для цього пристрою (вкладка Dev App).',
  actionSucceeded: (label: string): string => `${label} — виконано успішно.`,
  actionFailed: (label: string): string => `${label} — не вдалося.`,
  actionFailedWith: (label: string, err: string): string => `${label} — не вдалося: ${err}`,

  // Apps tab
  installedApps: 'Встановлені застосунки',
  installedAppsAndTvInputs: 'Встановлені застосунки та TV-входи',
  rawListOfApps: 'Необроблений список застосунків',
  appsAndInputsList: 'Список застосунків і входів',
  appTileTitle: (name: string, id: string): string => `${name}\nID: ${id}\nНатисніть, щоб запустити`,
  switchToInput: (name: string): string => `Перемкнути на ${name}`,
  failedToLoadApps: 'Не вдалося завантажити застосунки:',
  errorPrefix: 'Помилка:',
  installedAppsHeader: 'ВСТАНОВЛЕНІ ЗАСТОСУНКИ',
  inputsHeader: 'ВХОДИ',
  copied: 'Скопійовано!',
  copyList: 'Копіювати список',

  // Auto-connect toasts
  connectedAutomatically: (label: string): string => `Автоматично підключено до ${label}.`,
  connectedMultipleAutomatically: (count: number): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const phrase =
      mod10 === 1 && mod100 !== 11
        ? 'збереженого пристрою'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'збережених пристроїв'
          : 'збережених пристроїв';
    return `Автоматично підключено до ${count} ${phrase}.`;
  },

  // Manual connect
  couldNotConnectToIp: (ip: string): string =>
    `Не вдалося підключитися до ${ip}. Переконайтеся, що пристрій Roku увімкнено та доступний.`,
  connectionError: (err: string): string => `Помилка підключення: ${err}`,

  // Custom title bar
  windowControlsUnavailable: 'Елементи керування вікном недоступні. Закрийте та перезапустіть Roku Dev Studio.',
  restoreDown: 'Відновити',
  maximize: 'Розгорнути',

  // Log file
  couldNotOpenLogFile: (err: string): string => `Не вдалося відкрити файл журналу: ${err}`,

  // Help modal
  searchHelpGuide: 'Пошук у довідці та посібнику',

  // ECP / Control by Mobile Apps warnings
  ecpWarnDisabledTitle: 'Керування через мобільні застосунки вимкнено',
  ecpWarnDisabledDesc:
    'Дистанційне керування вимкнено. Увімкніть «Керування через мобільні застосунки» → «Доступ до мережі» на пристрої Roku, щоб користуватися пультом, застосунками та введенням тексту.',
  ecpWarnLimitedTitle: 'Керування через мобільні застосунки: обмежено',
  ecpWarnLimitedDesc:
    'Введення тексту, запуск і запити застосунків працюють. Повне натискання клавіш пульта може бути недоступним — встановіть «Доступ до мережі» на <strong>Permissive</strong> або <strong>Enabled</strong> для повного керування пультом.',
  ecpWarnSubnetTitle: 'Permissive: перевірте мережу',
  ecpWarnSubnetDesc:
    'Режим Permissive приймає команди лише з тієї самої підмережі. Ваш комп’ютер може бути в іншій підмережі; якщо команди не працюють, перевірте мережу.',

  // App Connector / TrackerTask
  trackerTaskSaved: 'TrackerTask.xml успішно збережено!',
  failedToSaveTrackerTask: 'Не вдалося зберегти TrackerTask.xml:',
  errorSavingTrackerTask: 'Помилка збереження TrackerTask:',
  integrationInfoCopied: 'Інформацію про інтеграцію скопійовано в буфер обміну!',
  failedToCopyClipboard: 'Не вдалося скопіювати в буфер обміну',

  // App init
  appInitFailed: 'Не вдалося ініціалізувати застосунок:',

  // ───────────────────────────────────────────────────────────────────────
  // Static index.html markup (filled by applyI18n). Inline English is kept as
  // the fallback; these mirror it (with ui-text-casing applied to labels).
  // ───────────────────────────────────────────────────────────────────────

  // Title bar
  titleBarToggleSidebar: 'Перемкнути бічну панель',
  titleBarScanTitle: 'Сканувати локальні та віддалені пристрої',
  titleBarScanAria: 'Сканувати пристрої',
  titleBarHelpTitle: 'Довідка та посібник користувача',
  titleBarHelpAria: 'Довідка та посібник',
  helpAndGuide: 'Довідка та посібник',
  floatingRemoteToggleTitle: 'Перемкнути плаваючий пульт, що супроводжує вас за межами вкладок Remote і Dev App',
  floatingRemoteToggleAria: 'Перемкнути плаваючий пульт',
  floatingRemote: 'Плаваючий пульт',
  appMenu: 'Меню застосунку',
  zoomOut: 'Зменшити масштаб',
  zoomIn: 'Збільшити масштаб',
  resetZoom: 'Скинути масштаб до 100%',
  currentZoomAria: 'Поточний масштаб; натисніть, щоб скинути до 100%',

  // Sidebar — device discovery
  sidebarLocal: 'Локальні',
  manualConnect: 'Підключити вручну',
  addRemoteLocation: 'Додати віддалене розташування',
  viewLogsTitle: 'Переглянути журнали налагодження (Desktop/roku-connector-debug.log)',
  viewLogs: 'Переглянути журнали',

  // Welcome panel
  welcomeSubtitle:
    'Знаходьте пристрої Roku локально або через віддалені relay-сервери, виконуйте sideload і deep-link каналів, налагоджуйте BrightScript у реальному часі за допомогою потокової Telnet-консолі, автоматизуйте наскрізні тестові сценарії та залучайте ШІ-агентів до циклу розробки через MCP.',
  featureDeviceDiscovery: 'Виявлення пристроїв',
  featureDeviceDiscoveryDesc: 'Автоматично виявляйте пристрої Roku у локальній мережі через SSDP.',
  featureAppsDeepLinking: 'Застосунки та Deep-Linking',
  featureAppsDeepLinkingDesc: 'Переглядайте, запускайте застосунки, використовуйте Deep-Links з власними параметрами.',
  featureDevAppDesc: 'Виконуйте sideload каналів розробки та автоматично робіть знімки екрана Dev App.',
  featureAppConnectorDesc: 'Виконуйте функції BrightScript у застосунку, завантаженому через sideload.',
  featureFiddle: 'Fiddle',
  featureFiddleDesc: 'Запускайте фрагменти BrightScript на пристрої в редакторі Monaco.',
  featureMcpServer: 'MCP-сервер',
  featureMcpServerDesc: 'Відкрийте доступ до Roku Dev Studio для ШІ-агентів через MCP-сервер.',
  featureDeviceRemote: 'Пульт пристрою',
  featureDeviceRemoteDesc: 'Повноцінний D-pad, медіакерування та введення тексту — як справжній пульт.',
  featureQueryDesc: 'Робіть запити інформації про пристрій, стану медіапрогравача та реєстру через ECP.',
  featureConsoleDesc: 'Переглядайте налагоджувальний вивід BrightScript через Telnet, фільтруйте та шукайте',
  featureActionScriptsDesc: 'Об’єднуйте натискання клавіш, запуски та виклики RALE в автоматизовані сценарії.',
  featureNetworkInspectorDesc: 'Аналізуйте HTTP/HTTPS-трафік Dev App через MITM-проксі.',
  featureRemoteLocations: 'Віддалені розташування',
  featureRemoteLocationsDesc: 'Підключайтеся до пристроїв Roku будь-де через relay-сервери.',

  // Device-panel tabs
  tabRemote: 'Пульт',
  tabApps: 'Застосунки',
  tabQuery: 'Запити',
  tabDevApp: 'Dev App',
  tabConsole: 'Консоль',
  tabAppConnector: 'App Connector',
  tabActionScripts: 'Скрипти дій',
  tabNetwork: 'Мережа',

  // Device panel — performance strip & paused nav
  perfCpu: 'CPU',
  perfMem: 'Пам’ять',
  perfObj: 'Об’єкти',
  devicePerfPaused: 'Продуктивність пристрою призупинено — виведіть Dev App на передній план, щоб відновити.',
  devicePerfPausedShort: 'Продуктивність пристрою призупинено',
  launch: 'Запустити',
  sideloadDevApp: 'Sideload Dev App',
  sideload: 'Sideload',

  // Shared warnings (Developer Mode / Control by Mobile Apps)
  developerModeNotEnabled: 'Режим розробника не увімкнено',
  ecpNotEnabledTitle: 'Керування через мобільні застосунки не увімкнено',
  howToEnable: 'Як увімкнути',
  devAppDevModeDesc: 'Для sideload Dev App потрібно увімкнути режим розробника на пристрої Roku.',
  queryDevModeDesc: 'Деякі функції запитів можуть бути обмежені. Увімкніть режим розробника для повного доступу.',
  inspectorDevModeDesc: 'App Connector потребує режиму розробника та каналу, завантаженого через sideload, з TrackerTask.',

  // Remote Section
  keyboardShortcutsRemoteTitle: 'Комбінації клавіш для цього пульта',
  keyboardShortcutsQuickRemoteTitle: 'Комбінації клавіш для швидкого пульта',
  keyboardRemoteHelpAria: 'Довідка з клавіатурних комбінацій пульта',
  showDevicePerformance: 'Показати продуктивність пристрою',
  remoteBack: 'Назад',
  remoteHome: 'Головна',
  remoteOptions: 'Опції',
  remoteReplay: 'Повтор',
  remoteVolUp: 'Гучн. +',
  remoteMute: 'Без звуку',
  remoteVolDown: 'Гучн. -',
  remotePower: 'Живлення',
  remoteRewind: 'Перемотка назад',
  remotePlayPause: 'Відтворити/пауза',
  remoteForward: 'Перемотка вперед',
  sendTextPlaceholder: 'Введіть текст для надсилання на Roku...',
  sendText: 'Надіслати текст',
  rokuSecretScreens: 'Секретні екрани Roku',
  secretScreensTitle: 'Послідовності клавіш пульта для секретних і діагностичних екранів Roku',
  sectionRemoteControl: 'Дистанційне керування',
  sectionObjectCounts: 'Кількість об’єктів BrightScript (Dev)',
  cpuUsage: 'Використання CPU',
  sectionMemoryUsage: 'Використання пам’яті',

  // Remote Section — metrics quadrants
  brightScriptObjects: 'Об’єкти BrightScript',
  objectMetricsMode: 'Режим метрик об’єктів',
  objectsModeCount: 'Кількість',
  objectsModeMemory: 'Пам’ять',
  objectsTop10: 'Топ-10',
  cpuMetricsMode: 'Режим метрик CPU',
  cpuModePercent: 'CPU %',
  cpuModeProcess: 'Процес',
  systemMemory: 'Системна пам’ять',
  legendTotal: 'Усього',
  legendUser: 'Користувач',
  legendKernel: 'Ядро',
  legendUsed: 'Використано',
  legendResident: 'Резидентна',
  legendAnonymous: 'Анонімна',
  legendShared: 'Спільна',
  legendLimit: 'Ліміт',

  // Apps tab
  customLaunch: 'Власний запуск',
  customAppIdPlaceholder: 'ID застосунку (напр., 12)',
  tvInputsLabel: 'TV-входи:',
  hdmi1: 'HDMI 1',
  hdmi2: 'HDMI 2',
  hdmi3: 'HDMI 3',
  hdmi4: 'HDMI 4',
  deepLink: 'Deep-Link',
  moreLaunchOptions: 'Більше параметрів запуску',
  saveAndLaunch: 'Зберегти та запустити',
  deeplinkSaved: 'Збережено',
  selectSavedDeepLink: '-- Виберіть збережений Deep-Link --',
  deleteSavedDeepLink: 'Видалити збережений Deep-Link',
  appId: 'ID застосунку',
  deeplinkAppIdPlaceholder: 'напр., 31440',
  contentId: 'ID контенту',
  contentIdPlaceholder: 'Ідентифікатор контенту',
  mediaType: 'Тип медіа',
  selectPlaceholder: '-- Виберіть --',
  mediaTypeMovie: 'Фільм',
  mediaTypeSeries: 'Серіал',
  mediaTypeEpisode: 'Епізод',
  mediaTypeLive: 'Наживо',
  manageMediaTypes: 'Керувати типами медіа',
  listApps: 'Список',
  loadingApps: 'Завантаження застосунків...',
  inputsSectionLabel: 'Входи',
  noAppsFound: 'Застосунків не знайдено. Натисніть «Оновити», щоб завантажити.',

  // Dev App tab
  auth: 'Автентифікація',
  password: 'Пароль',
  verify: 'Перевірити',
  remember: 'Запам’ятати',
  selectPackage: 'Вибрати пакет',
  install: 'Встановити',
  typeTextShortPlaceholder: 'Введіть текст...',
  send: 'Надіслати',
  autoScreenshot: 'Авто знімок екрана',
  screenshot: 'Знімок екрана',
  copyScreenshot: 'Копіювати знімок екрана',
  downloadScreenshot: 'Завантажити знімок екрана',
  clearScreenshot: 'Очистити знімок екрана',
  capture: 'Захопити',
  clickCapture: 'Захоплення за кліком',

  // Query tab
  deviceQueries: 'Запити пристрою',
  queryDeviceInfo: 'Device Info',
  queryAllApps: 'All Apps',
  queryActiveApp: 'Active App',
  queryMediaPlayer: 'Media Player',
  queryPlugins: 'Plugins',
  queryMemory: 'Memory',
  developerQueries: 'Запити розробника',
  openFiddle: 'Відкрити Fiddle',
  openFiddleTitle: 'Відкрити BrightScript Fiddle з попередньо вибраним цим пристроєм',
  openFiddleAria: 'Відкрити BrightScript Fiddle для цього пристрою',
  qsSceneGraph: 'SceneGraph',
  qsSgRendezvous: 'SG Rendezvous',
  qsFwBeacons: 'FW Beacons',
  qsPerformance: 'Продуктивність',
  qsOther: 'Інше',
  qsCustom: 'Власне',
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
  run: 'Запустити',
  customQueryPlaceholder: 'напр. /query/device-info',
  results: 'Результати',
  removePluginPlaceholder: 'ID застосунку (напр., 987654_cf9a)',
  removePlugin: 'Видалити плагін',

  // Console (Telnet) tab
  telnetConsole: 'Telnet-консоль',
  copyAllLogs: 'Копіювати всі журнали',
  saveLogsToFile: 'Зберегти журнали у файл',
  clearConsole: 'Очистити консоль',
  clearOptions: 'Параметри очищення',
  clearRelayOnly: 'Очистити (лише на relay-сервері)',
  clearLocalAndRelay: 'Очистити (локально та на relay-сервері)',
  findResizeTitle: 'Перетягніть, щоб розширити пошук (подвійний клік — скидання)',
  consoleMonitor: 'Монітор консолі',
  telnetPortBadge: 'Порт 8085',
  connectPullRelayTitle: 'Підключитися та отримати буфер relay',
  connectOptions: 'Параметри підключення',
  connectLiveOnly: 'Підключитися (пропустити наявний буфер журналів)',
  telnetPlaceholder: 'Підключіться, щоб переглянути налагоджувальний вивід BrightScript',
  jumpToLatestLogs: 'Перейти до останніх журналів',

  // App Connector tab
  connection: 'Підключення',
  port: 'Порт',
  logVerbosity: 'Докладність журналу',
  logVerbosityTitle: 'Рівень RALE Logger, що застосовується при підключенні',
  verbosityOff: 'Вимкнено',
  verbosityError: 'Помилка',
  verbosityWarning: 'Попередження',
  verbosityInfo: 'Інформація',
  verbosityDebug: 'Налагодження',
  integrationGuide: 'Посібник з інтеграції',
  integrationGuideTitle: 'Як інтегрувати TrackerTask з App Connector',
  executeFunction: 'Виконати функцію',
  functionLabel: 'Функція',
  connectToLoadFunctions: '-- Підключіться, щоб завантажити функції --',
  execute: 'Виконати',
  parameters: 'Параметри',
  selectFunctionParams: 'Виберіть функцію, щоб побачити параметри',
  response: 'Відповідь',
  updateNode: 'Оновити вузол',
  updateNodeBtnTitle: 'Після Get Node by ID: selectNode, потім setField, removeField або Add Field через setField',
  action: 'Дія',
  fieldAction: 'Дія з полем',
  updateField: 'Оновити поле',
  addField: 'Додати поле',
  removeField: 'Видалити поле',
  field: 'Поле',
  fieldName: 'Назва поля',
  fieldNamePlaceholder: 'напр. text, visible, width',
  fieldType: 'Тип поля',
  typeString: 'String',
  typeInteger: 'Integer',
  typeFloat: 'Float',
  typeBoolean: 'Boolean',
  typeColor: 'Color',
  typeArray: 'Array',
  typeAssocArray: 'AssocArray',
  value: 'Значення',
  fieldValuePlaceholder: 'Скаляри, true/false, JSON для масивів / векторів / об’єктів',

  // Action Scripts tab
  builder: 'Конструктор',
  executor: 'Виконавець',
  copyToExecutor: 'Копіювати до виконавця',
  copyActionScript: 'Копіювати Action Script',
  saveActionScript: 'Зберегти Action Script',
  addActionToEnable: 'Додайте принаймні одну дію, щоб увімкнути',
  connectToConsole: 'Підключитися до консолі',
  editInBuilder: 'Редагувати в конструкторі',
  editInBuilderTitle: 'Відкрити поточний скрипт на вкладці «Конструктор»',
  importActionScript: 'Імпортувати Action Script',
  importActionScriptTitle: 'Імпортувати або оновити Action Script',
  actions: 'Дії',
  builderImportTitle: 'Імпортувати скрипт з файлу або вставити JSON',
  undoTitle: 'Скасувати (Ctrl+Z)',
  redoTitle: 'Повторити (Ctrl+Shift+Z)',
  clearAllActions: 'Очистити всі дії',
  helpForActionType: 'Довідка для цього типу дії',
  closeAddStep: 'Закрити додавання кроку',
  actionType: 'Тип дії',
  addAction: 'Додати дію',
  dragToResize: 'Перетягніть, щоб змінити розмір',
  resizePanels: 'Змінити розмір панелей',
  json: 'JSON',
  uploadJson: 'Завантажити JSON',
  orPasteBelow: 'Або вставте нижче',
  validate: 'Перевірити',
  devPasswordRequired: 'Деякі дії потребують пароль розробника (знімок екрана, sideload):',
  enterDevPassword: 'Введіть пароль розробника',
  clearActions: 'Очистити дії',
  runActionScript: 'Запустити Action Script',
  stopExecution: 'Зупинити виконання',
  copyResultsToClipboard: 'Копіювати результати в буфер обміну',
  saveResultsAsPdf: 'Зберегти результати як PDF',
  clearResultsTitle: 'Очистити результати та звільнити пам’ять (до наступного запуску немає що зберігати)',

  // Network Inspector tab
  networkInspector: 'Інспектор мережі',
  niFindTitle: 'Знайти в трафіку — URL, корисні дані, заголовки, тіла відповідей (⌘/Ctrl+F)',
  niFindAria: 'Знайти в трафіку',
  niFindPrevTitle: 'Попередній збіг (Shift+↑)',
  niFindPrev: 'Попередній збіг',
  niFindNextTitle: 'Наступний збіг (Shift+↓)',
  niFindNext: 'Наступний збіг',
  niFindClear: 'Очистити результати пошуку',
  niDownloadTitle: 'Завантажити сеанс…',
  niDownloadAria: 'Завантажити сеанс',
  niExportHar: 'Експортувати все як HAR',
  niExportSession: 'Експортувати сеанс (.rds-network-inspector.json)',
  niSavePcap: 'Зберегти захоплення пакетів (.pcap)',
  niClearTitle: 'Очистити список сеансів',
  niSetupBadgeTitle: 'Потрібне налаштування захоплення через точку доступу — натисніть для інструкцій',
  niCaptureSetup: 'Налаштування захоплення',
  niPortBadgeTitle: 'Порт проксі недоступний — натисніть для деталей',
  niProxyPortUnavailable: 'Порт проксі недоступний',
  niFilterPlaceholder: 'Фільтрувати трафік…',
  niFilterTitle: 'Фільтрувати трафік — натисніть значок інформації для підтримуваного синтаксису.',
  niClearFilter: 'Очистити фільтр',
  niFilterHelpTitle: 'Довідка з фільтрації та підтримуваний синтаксис',
  niFilterHelpAria: 'Довідка з фільтрації',
  niSessionCountTitle: 'Захоплені сеанси',
  niControls: 'Елементи керування Інспектор мережі',
  niToggleDetailLayout: 'Перемкнути макет деталей',
  niConfigureTitle: 'Налаштувати правила трафіку',
  niGroupByHostTitle: 'Групувати сеанси за іменем хоста',
  niGroupByHost: 'Групувати за хостом',
  niProxiedTitle:
    'Показувати лише запити, що проходять через проксі RDS (повні заголовки + тіло), приховуючи метадані SNI/DNS від захоплення через точку доступу',
  niProxied: 'Через проксі',
  niWaitingForTraffic: 'Очікування трафіку…',
  niScrollBottom: 'Прокрутити до останніх сеансів',

  // App menu (hamburger)
  developerMode: 'Режим розробника',
  privacyMode: 'Режим конфіденційності',
  debugLogging: 'Журналювання налагодження',
  openDiagnosticLogsFolder: 'Відкрити папку діагностичних журналів',
  openLogFile: 'Відкрити файл журналу',
  settings: 'Налаштування',
  clearCacheAndReload: 'Очистити кеш і перезавантажити',
  zoom: 'Масштаб',
  aboutRokuDevStudio: 'Про Roku Dev Studio',
  quitRokuDevStudio: 'Вийти з Roku Dev Studio',

  // ───────────────────────────────────────────────────────────────────────
  // index.html localization pass — cloned-template defaults, empty-states,
  // attribute-only strings, and multi-element prose (data-i18n-html) blocks
  // that the earlier migration left inline.
  // ───────────────────────────────────────────────────────────────────────

  // Sidebar — local devices empty state (prose with <br>/<strong>)
  noDevicesFoundHtml: 'Пристроїв не знайдено.<br>Натисніть <strong>Сканувати</strong>, щоб виявити пристрої Roku.',

  // Device panel header (cloned-template defaults, replaced by JS at runtime)
  deviceNamePlaceholder: 'Назва пристрою',
  perfStripPausedPlaceholder: 'Призупинено — запустіть Dev App, щоб відновити',

  // ECP / Control by Mobile Apps warning descriptions (prose with <strong>)
  ecpRemoteWarningDescHtml:
    'Дистанційне керування (натискання клавіш, застосунки тощо) потребує, щоб «Керування через мобільні застосунки» → «Доступ до мережі» було встановлено на <strong>Enabled</strong> на вашому пристрої Roku.',
  ecpDevAppWarningDescHtml:
    'Функції швидкого пульта та натискання клавіш потребують, щоб «Керування через мобільні застосунки» → «Доступ до мережі» було <strong>Enabled</strong> на вашому пристрої Roku.',

  // Dev App tab — sideloaded-app default + screenshot image alt text
  noChannelSideloaded: 'Канал не завантажено через sideload',
  screenshotAlt: 'Знімок екрана Roku',

  // App Connector — Update Node modal intro (prose with <strong>/<code>) + response empty-state
  updateNodeModalIntroHtml:
    'Використовує <strong>шлях</strong> з вашого останнього успішного Get Node by ID. Дії: <code>removeField</code>, <code>setField</code> (додати / оновити).',
  responseWillAppearHere: 'Відповідь з’явиться тут...',

  // Action Scripts — Executor nudge + password-prompt hint (prose with <strong>/<code>)
  executorBuilderNudgeHtml:
    'Використовуйте вкладку <strong>Конструктор</strong>, щоб додавати й редагувати кроки за допомогою підказаних полів. Використовуйте цю область, щоб перевіряти, імпортувати або запускати JSON.',
  executorPasswordPromptHintHtml:
    'Введіть його тут і запустіть знову, або додайте <code>"devPassword": "..."</code> до JSON вашого скрипту.'
};

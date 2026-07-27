/**
 * Ukrainian (uk) translation of the Settings window strings (General, MCP,
 * Network Inspector, timing/validation, …). Sibling of ../settings.ts — same
 * `settings` shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated; product/feature names and tech tokens are verbatim.
 */
export const settings = {
  // Bootstrap / fatal
  apiUnavailable: 'API налаштувань недоступний.',
  loadFailedMessage: 'Не вдалося відкрити налаштування. Спробуйте ще раз.',

  // General section
  noFolderSet: 'Папку не встановлено',
  logFilePath: (path: string): string => `Файл журналу: ${path}`,

  // Password storage / keychain
  keychainUnencryptedConfirm:
    'Ваша система не надає справжнього сховища ключів для шифрування. Увімкнення цієї опції зберігає паролі як закодований відкритий текст на диску, без шифрування. Продовжити?',
  keychainOff: 'Перемикач шифрування вимкнено — збережені паролі зберігаються як відкритий текст на диску.',
  keychainDefaultBackend: 'Системне сховище ключів',
  keychainEncrypted: (backend: string): string => `Сховище: зашифровано за допомогою ${backend}.`,
  keychainUnencrypted:
    'Попередження: перемикач увімкнено, але ця система використовує звичайний текст — паролі зберігаються як відкритий текст у кодуванні Base64 на диску. Використовуйте сховище ключів Linux (Secret Service/KWallet) для справжнього шифрування.',
  keychainUnavailable:
    'Попередження: перемикач увімкнено, але сховище ключів ОС недоступне — паролі зберігаються в пам’яті лише для цієї сесії.',
  keychainStatus: (status: string, backend: string): string =>
    `Стан сховища: ${status}${backend ? ` (${backend})` : ''}.`,

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
  mcpServerBlurbHtml: `Надайте ШІ-агентам доступ до Roku Dev Studio через <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" class="mcp-link">Model Context Protocol</a>. Перемкніть клієнта, щоб додати або вилучити його запис MCP-сервера <code class="mcp-inline-code">roku-dev-studio</code>; інші записи залишаються незмінними.`,
  mcpNoClients: 'У цій системі не виявлено підтримуваних клієнтів MCP.',
  mcpInstalled: 'Встановлено',
  mcpNotDetected: 'Не виявлено',
  mcpOpenConfigTitle: (path: string): string => `Відкрити ${path}`,
  mcpOpenConfigAria: (label: string): string => `Відкрити файл конфігурації MCP для ${label}`,
  mcpOpenConfigFile: 'Відкрити файл конфігурації',
  mcpInstallToEnable: (label: string): string => `Встановіть ${label}, щоб увімкнути.`,
  mcpEnableAria: (label: string): string => `Увімкнути MCP для ${label}`,

  // Network Inspector — status line
  niStatusDisabled: 'Стан: вимкнено — збережіть після ввімкнення, щоб почати відстеження клієнтів точки доступу.',
  niPlatformMac: 'bridge100 у macOS',
  niPlatformWin: 'віртуальний адаптер у Windows',
  niPlatformLinux: 'інтерфейс точки доступу в Linux',
  niStatusEnabled: (platformHint: string): string =>
    `Стан: увімкнено — очікування інтерфейсу точки доступу (${platformHint}).`,
  niMitmSuffix: (port: number): string => ` · проксі MITM на порту ${port}`,

  // Network Inspector — capture setup (BPF)
  captureAccessEnabled: 'Доступ до захоплення ввімкнено',
  setupNeeded: 'Потрібне налаштування',
  // Static default for the setup modal <h2>; JS replaces it with a platform-suffixed title.
  hotspotCaptureSetupModalTitle: 'Налаштування захоплення через точку доступу',
  niSetupRowDescOk: 'Необов’язково — лише для захоплення DNS/SNI через точку доступу. Проксіювання не потребує налаштування.',
  niSetupRowDescNeeds: 'Захоплення через точку доступу потребує налаштування — відкрийте, щоб увімкнути. (Проксіювання все одно працює.)',
  niSetupPacketCapture: 'Налаштувати захоплення пакетів',
  bpfWaitingApproval: 'Очікування схвалення адміністратором…',
  bpfInstalled: 'Доступ до захоплення пакетів встановлено.',
  bpfInstalledHint: 'Встановлено — поверніться на вкладку Інспектор мережі.',
  bpfCancelled: 'Скасовано.',
  bpfSetupFailed: 'Помилка налаштування.',

  // Network Inspector — place selector + Remote Locations
  placeLocal: 'Локально (цей комп’ютер)',
  placeRemoteFallback: 'Віддалено',
  niRemoteRequiresRoot:
    'Це розташування вимагає, щоб віддалений сервер працював від імені root для ввімкнення Інспектор мережі.',
  niRemoteUnsupported:
    'Це розташування не підтримує Інспектор мережі. Оновіть цей віддалений сервер для функціональності Інспектор мережі.',
  niDisabled: 'Інспектор мережі вимкнено.',
  niEditingRemote: 'Редагування налаштувань віддаленого розташування. Захоплення виконується на віддаленому сервері.',
  niPortConflictTitle: 'Порт проксі недоступний',
  niRemoteUnavailable: 'Віддалений Інспектор мережі недоступний у цій збірці.',
  niCheckingRemote: 'Перевірка віддаленого розташування…',
  niCouldNotReachRemote: 'Не вдалося зв’язатися з віддаленим розташуванням.',

  // Network Inspector — enable confirm + save status
  niConfirmEnable:
    'Інспектор мережі захоплюватиме трафік Roku та зберігатиме його локально на цьому комп’ютері — через проксі MITM і, якщо налаштовано, захоплення через точку доступу/спільну мережу. Продовжити?',
  niSaved: 'Налаштування Інспектор мережі збережено.',
  niSavedRemote: 'Збережено у віддаленому розташуванні.',
  niRemoteSaveFailed: 'Не вдалося зберегти на віддаленому сервері',

  // Timing & Network row labels (title + hint per timing key), локалізовані тут, щоб
  // UI налаштувань відображав їх активною мовою. Числові межі min/max все ще надходять
  // з головного процесу через `timingMeta`.
  timingLabels: {
    DEFAULT_RALE_PORT: { title: 'RALE / App Connector Port', hint: 'TCP Port (за замовчуванням 49200).' },
    SCREENSHOT_DEBOUNCE_DELAY: { title: 'Дебаунс знімка екрана (ms)', hint: 'Затримка після натискання клавіші перед авто-знімком екрана.' },
    SCREENSHOT_AFTER_LAUNCH_DELAY: { title: 'Знімок екрана після запуску (ms)', hint: 'Очікування після запуску Dev App перед знімком екрана.' },
    TELNET_TIMEOUT: { title: 'Тайм-аут підключення Telnet (ms)', hint: 'Консоль налагодження / системний Telnet.' },
    CONNECTION_CHECK_INTERVAL: { title: 'Перевірка активності пристрою (ms)', hint: 'Як часто опитуються підключені пристрої: інформація про пристрій, стан ECP і чи канал Dev App на передньому плані.' },
    DEVICE_METRICS_SAMPLE_INTERVAL_MS: { title: 'Частота дискретизації (ms)', hint: 'Частота опитування Chanperf + кількості об’єктів. Менше = свіжіші дані, більше трафіку ECP; потрібні Developer Mode і Control by Mobile Apps.' },
    DEVICE_METRICS_CHART_HISTORY_MS: { title: 'Час історії графіка (хвилини)', hint: 'Наскільки далеко в минуле відображають графіки CPU і System Memory' },
    TOAST_DISPLAY_DURATION: { title: 'Тривалість toast (с)', hint: 'Видимість toast успіху/помилки.' },
    STATUS_MESSAGE_DURATION: { title: 'Тривалість повідомлення стану (с)', hint: 'Видимість рядка стану в заголовку.' },
  },

  // Timing bounds + validation
  timingValueFallback: 'Значення',
  timingBoundMin: (value: string | number): string => `Мін: ${value}`,
  timingBoundMax: (value: string | number): string => `Макс: ${value}`,
  timingMustBeWholeNumber: (label: string): string => `${label} має бути цілим числом.`,
  timingMustBeAtLeast: (label: string, bound: string): string => `${label} має бути не менше ${bound}.`,
  timingMustBeAtMost: (label: string, bound: string): string => `${label} має бути не більше ${bound}.`,
  timingMoreOutOfRange: (n: number): string => ` (ще ${n} поза діапазоном)`,
  timingClamped: (label: string, value: string, which: string): string =>
    `${label} скориговано до ${value} (${which}).`,
  timingClampMinimum: 'мінімум',
  timingClampMaximum: 'максимум',

  // Save status messages
  generalSaved: 'Загальні налаштування збережено.',
  actionScriptsSaved: 'Налаштування Action Scripts збережено.',
  devicePerfSaved: 'Налаштування продуктивності пристрою збережено.',
  timingSaved: 'Налаштування таймінгів і мережі збережено.',
  mcpSaved: 'Налаштування сервера MCP збережено.',
  saveFailed: 'Не вдалося зберегти',
  saveWriteFailedError: 'Не вдалося записати файл налаштувань.',
  mcpConfigUpdateWarning: (summary: string): string =>
    `Оновлення конфігурації клієнта MCP містило помилки: ${summary}`,

  // ── Static settings.html shell ──────────────────────────────────────────
  // Header + nav
  windowTitle: 'Налаштування — Roku Dev Studio',
  heading: 'Налаштування',
  navAria: 'Розділи налаштувань',
  tabGeneral: 'Загальні',
  tabActionScripts: 'Скрипти дій',
  tabDevicePerformance: 'Продуктивність пристрою',
  tabTiming: 'Таймінги та мережа',
  tabNetworkInspector: 'Інспектор мережі',
  tabSideloadRelay: 'Sideload Relay',
  tabMcpServer: 'Сервер MCP',
  // Shared across every section's save dock
  resetToDefaults: 'Скинути до типових значень',

  // General section — toggle labels, descriptions, and (screen-reader) aria labels
  language: 'Мова',
  languageDesc: 'Мова інтерфейсу застосунку.',
  languageAria: 'Мова відображення',
  languageSystemDefault: (name: string): string => `Системна (${name})`,
  developerMode: 'Режим розробника',
  developerModeDesc: 'Додаткове журналювання в головному вікні (те саме, що Файл → Режим розробника).',
  developerModeAria: 'Режим розробника',
  privacyMode: 'Режим конфіденційності',
  privacyModeDesc: 'Маскувати IP та серійні номери в інтерфейсі (те саме, що Файл → Режим конфіденційності).',
  privacyModeAria: 'Режим конфіденційності',
  debugLogging: 'Журналювання налагодження у файл',
  debugLogHint: 'Записує у файл журналу в даних користувача застосунку, коли ввімкнено.',
  debugLoggingAria: 'Журналювання налагодження у файл',
  useKeyboardRemote: 'Використовувати клавіатуру для пульта Roku',
  useKeyboardRemoteDesc:
    'Коли ввімкнено, ви можете використовувати клавіатуру для керування Roku. Комбінації клавіш перелічені у вікні довідки пульта.',
  useKeyboardRemoteAria: 'Пульт Roku - використовувати клавіатуру ',
  autoConnect: 'Автопідключення до пристроїв',
  autoConnectDesc:
    'Коли ввімкнено, застосунок автоматично підключатиметься до пристроїв, які залишалися підключеними під час закриття застосунку в попередній сесії.',
  autoHideSidebar: 'Автоприховування бічної панелі',
  autoHideSidebarDesc:
    'Коли ввімкнено, бічна панель, яка відображає список пристроїв, автоматично перемкнеться, якщо її було приховано в попередній сесії.',
  encryptPasswords: 'Шифрувати збережені паролі за допомогою системного сховища ключів',
  encryptPasswordsDesc:
    'Шифрувати збережений пароль кожного пристрою через сховище ключів ОС. Коли вимкнено, він зберігається, але записується на диск без шифрування.',
  encryptPasswordsAria: 'Зберігати збережені паролі в системному сховищі ключів',

  // Action Scripts section
  actionScriptsBlurb:
    'Типова папка для знімків екрана та журналів, коли скрипту потрібно щось зберегти. Ви все одно можете вибрати іншу папку для кожного запуску.',
  chooseFolder: 'Вибрати папку…',

  // Device Performance section
  devicePerfIntroHtml: `Застосовується, коли ввімкнено <strong>Показувати продуктивність пристрою</strong>, на Roku є Режим розробника, а Dev App на передньому плані. Коли <strong>Запам’ятати «Показувати продуктивність пристрою»</strong> ввімкнено нижче, розділ пульта відновлює макет-квадрант для кожного пристрою.`,
  rememberDevicePerf: 'Запам’ятати «Показувати продуктивність пристрою»',
  rememberDevicePerfAria: 'Запам’ятовувати показ або приховування продуктивності для кожного пристрою',
  // Row description — contains <strong>, rendered via data-i18n-html.
  rememberDevicePerfDescHtml: `Відновлювати, чи було ввімкнено <strong>Показувати продуктивність пристрою</strong> для кожного пристрою. Вимкніть, щоб завжди починати лише з розділу пульта, доки ви знову його не ввімкнете.`,

  // Network Inspector section — place selector + field labels
  location: 'Розташування',
  niPlaceAria: 'Розташування Інспектор мережі',
  enableNetworkInspector: 'Увімкнути Інспектор мережі',
  enableNetworkInspectorDesc:
    'Перевіряйте мережевий трафік пристрою. Розшифровує HTTPS вашого каналу розробника через локальний проксі (будь-яка мережа); точка доступу також захоплює DNS/SNI. Зберігається лише локально.',
  mitmProxyPort: 'Порт проксі MITM',
  mitmProxyPortDesc:
    'Порт, який прослуховує локальний проксі розшифрування. Спрямуйте через нього свій завантажений через sideload канал розробника — працює в будь-якій мережі (стандартні канали неможливо перехопити).',
  mitmProxyPortAria: 'Порт проксі MITM',
  packetLimit: 'Ліміт пакетів на пристрій',
  packetLimitDesc:
    'Максимум захоплених кадрів, що зберігаються на пристрій для експорту PCAP. Більше = довша історія, більше пам’яті. 100–100000.',
  packetLimitAria: 'Ліміт пакетів на пристрій',
  maxBodySize: 'Максимальний розмір тіла (KB)',
  maxBodySizeDesc:
    'Яка частина тіла кожного запиту/відповіді зберігається для перегляду в інспекторі. Більше = переглядайте великі тіла (наприклад, JS розміром у кілька MB) повністю; понад це тіло показує позначку "Body Truncated". Це ніколи не впливає на те, що отримує пристрій. Застосовується лише до нового трафіку — збільшення не відновить тіла, які вже захоплено та скорочено. 64–16384 KB.',
  maxBodySizeAria: 'Максимальний розмір тіла, що зберігається, у KB',
  hotspotCaptureSetup: 'Налаштування точки доступу та захоплення',
  viewSetup: 'Переглянути налаштування',

  // Sideload Relay section — intro bullets. The first bullet has inline markup (<span>/<code>,
  // whose #srRelayUrlWrap/#srRelayUrl are populated at runtime) so it's rendered via data-i18n-html.
  srIntro1Html: `Спрямуйте свій інструмент sideload (VS Code з розширенням BrightScript, Eclipse або CLI roku-deploy)<span id="srRelayUrlWrap" hidden> — чи браузер на <code id="srRelayUrl">http://…/</code></span> — сюди замість одного Roku.`,
  srIntro2: 'RDS приймає sideload один раз, потім встановлює його на кожну ввімкнену ціль, запускає Dev App і відкриває кожну консоль.',
  srIntro3: 'Sideload із цього комп’ютера виконується автоматично.',
  srIntro4: 'Sideload з іншого пристрою LAN потребує пароля розробника та просить вас це дозволити.',
};

/**
 * Ukrainian (uk) translation of the Action Scripts UI strings
 * (Builder, step fields, Executor, Import modal, shared actions list, and the
 * per-step Help modal).
 *
 * Same structure/keys/order as ../action-scripts.ts. Parametrized strings are
 * functions returning the composed text. Help-modal body values contain inline
 * HTML (assigned via `setSafeHTML`); dynamic values are HTML-escaped at the call
 * site before being passed in.
 */
export const actionScripts = {
  // ── Builder: step-type option (legacy) ──
  legacyPluginsMemoryOption: 'Plugins / Пам’ять (застарілий JSON)',

  // ── Builder: per-step field labels / placeholders / prompts ──
  labelQuery: 'Запит',
  labelEndpoint: 'Endpoint',
  optionCustom: 'Власний...',
  labelSystemTelnetCommand: 'Команда (застарілий тип — для нових кроків використовуйте Запит пристрою)',
  labelKey: 'Клавіша',
  optionSelectKey: '-- Виберіть клавішу --',
  labelText: 'Текст',
  placeholderTextToSend: 'Текст для надсилання',
  labelAppId: 'App ID',
  labelParamsOptional: 'Параметри (необов’язково)',
  labelFilePath: 'Шлях до файлу',
  placeholderPastePathOrChoose: 'Вставте шлях або виберіть файл',
  titleFilePathZip: 'Шлях до пакета .zip. Вставте тут або скористайтеся кнопкою «Вибрати файл».',
  chooseFileTitle: 'Вибрати файл (.zip)',
  chooseFileAria: 'Вибрати файл',
  chooseFileBtn: 'Вибрати файл',
  labelPassword: 'Пароль',
  placeholderDevPassword: 'Пароль розробника',
  optionConnectAppConnectorFirst: 'Спочатку підключіть App Connector',
  labelFunction: 'Функція',
  labelSetVarOptional: 'Задати змінну (необов’язково)',
  placeholderVarExample: 'напр. varX',
  titleVarNameRules: 'Літери, цифри, підкреслення; починайте з літери або _',
  noParameters: 'Немає параметрів',
  selectAFunction: 'Виберіть функцію',
  labelCommand: 'Команда',
  labelParameters: 'Параметри',
  labelLabelOptional: 'Мітка (необов’язково)',
  placeholderScreenshotLabel: 'напр. Після входу',
  labelWaitBeforeMs: 'Очікування перед (мс)',
  labelWaitAfterMs: 'Очікування після (мс)',
  placeholderWaitAfterDefault: '1500 (за замовчуванням)',
  titleWaitAfter:
    'Час очікування після запуску захоплення перед першим завантаженням. Збільште, якщо зображення обрізане або UI повільний (напр. HUD).',
  optionChooseChart: 'Вибрати діаграму…',
  labelChart: 'Діаграма',
  placeholderPerfLabel: 'напр. Після навігації',
  waitModeFixedDelay: 'Фіксована затримка (мс)',
  waitModeUntilCondition: 'До виконання умови',
  labelWaitType: 'Тип очікування',
  labelDelayMs: 'Затримка (мс)',
  labelSource: 'Джерело',
  labelState: 'Стан',
  optionSelectState: '-- Виберіть стан --',
  labelTimeoutMs: 'Тайм-аут (мс)',
  labelPollIntervalMs: 'Інтервал опитування (мс)',
  labelPathJsonArray: 'Шлях (масив JSON)',
  labelNodeId: 'ID вузла',
  labelFieldName: 'Назва поля',
  labelOperator: 'Оператор',
  placeholderFieldInFieldList: 'Поле у FieldList',
  placeholderCompareString: 'Рядок для порівняння',
  placeholderCompareValue: 'Значення для порівняння',
  caseInsensitive: 'Без урахування регістру',
  labelConditionSource: 'Джерело умови',
  labelAttribute: 'Атрибут',
  placeholderActiveAppValue: 'напр. dev, 837, YouTube',
  labelVariablePath: 'Шлях змінної',
  labelPost: 'POST',
  optionSelectPost: '-- Виберіть POST --',
  noExtraFields: 'Немає додаткових полів для цього типу.',

  // Chart option labels (shared: Builder dropdown, list Details, Executor descriptions)
  chartObjects: 'Об’єкти BrightScript',
  chartCpu: 'Використання CPU',
  chartMemory: 'Системна пам’ять',
  chartAboveAll: 'Усе разом',

  // Condition / wait source labels (shared)
  sourceMediaPlayer: 'Медіаплеєр',
  sourceActiveApp: 'Активний застосунок',
  sourceRaleNodeField: 'Поле вузла RALE',
  sourceVariables: 'Змінні',

  // Value-with-operator label (Builder compare cells)
  valueWithOperator: (op: string): string => `Значення (${op})`,

  // ── Shared actions list view (Builder + Executor) ──
  branchThen: 'Тоді',
  branchElse: 'Інакше',
  dragToReorder: 'Перетягніть, щоб змінити порядок',
  columnType: 'Тип',
  columnDetails: 'Деталі',
  addStep: 'Додати крок',
  pasteStepBtn: 'Вставити крок',
  pasteActionTooltip: 'Вставити скопійовану дію сюди',
  ariaThenBranchPrefix: 'Гілка «Тоді». ',
  ariaElseBranchPrefix: 'Гілка «Інакше». ',
  copyActionTooltip: 'Копіювати дію',
  removeActionTooltip: 'Видалити дію',
  skipBtn: 'Пропустити',
  skipActionTooltip: 'Пропустити цю дію',
  skipActionAria: 'Пропустити дію',
  unskipBtn: 'Не пропускати',
  runActionTooltip: 'Виконати цю дію',
  unskipActionAria: 'Не пропускати дію',
  emptyNoScript:
    'Скрипт не завантажено. Натисніть <strong>Імпортувати Action Script</strong> вгорі, щоб імпортувати скрипт, або скористайтеся вкладкою <strong>Конструктор</strong>, щоб створити новий.',
  stepRowAria: (num: string, type: string, details: string): string =>
    `Дія ${num}: ${type}${details ? ', ' + details : ''}. Натисніть, щоб редагувати.`,

  /** Row header / error line: "Action <id>: <text>" */
  actionLabel: (id: string, text: string): string => `Дія ${id}: ${text}`,

  // ── Builder chrome + toasts + import messages ──
  helpTooltip: (label: string, detail: string): string => `Довідка: ${label}${detail}`,
  addActionBtn: 'Додати дію',
  updateStepHeading: (n: number): string => `Оновити крок ${n}`,
  updateActionBtn: 'Оновити дію',
  toastActionPasted: 'Дію вставлено',
  toastCannotMoveIntoOwnBranch: 'Не можна перемістити крок у його власну гілку If.',
  toastActionCopied: 'Дію скопійовано',
  toastChooseChartType: 'Виберіть тип діаграми для Продуктивності пристрою.',
  toastUpdatedAction: (n: number): string => `Оновлено дію #${n}`,
  copiedFeedback: 'Скопійовано!',
  copyActionScriptBtn: 'Копіювати Action Script',
  savedFeedback: 'Збережено!',
  saveActionScriptBtn: 'Зберегти Action Script',
  saveModalNameLabel: 'Назва',
  saveModalNamePlaceholder: 'напр. Запуск і відтворення',
  saveModalNameRequired: 'Введіть назву.',
  saveModalOverwriteWarning: (name: string): string =>
    `Збережений скрипт із назвою "${name}" уже існує.`,
  saveModalOverwriteConfirm: 'Перезаписати',
  saveModalSavedListLabel: 'Збережені скрипти',
  saveModalNoSavedScripts: 'Немає збережених скриптів',
  toastSaveFailed: 'Не вдалося зберегти скрипт.',
  viewerHeading: 'Перегляд і керування Action Scripts',
  viewerSaveAs: 'Зберегти як…',
  viewerApplyToDevice: 'Застосувати до пристрою',
  viewerApply: 'Застосувати',
  viewerRescan: 'Сканувати знову',
  viewerNoDevices: 'Пристроїв не знайдено',
  viewerCopySuffix: 'копія',
  viewerDeleteConfirm: (name: string): string => `Видалити збережений скрипт "${name}"?`,
  viewerNoDeviceNote: 'Підключіть пристрій у головному вікні, щоб бачити актуальні назви функцій App Connector і RALE.',
  viewerEmpty: 'Ще немає збережених скриптів — збережіть один у Builder Action Scripts на вкладці пристрою.',
  msgNoScriptJson: 'Немає JSON скрипту для завантаження.',
  invalidJson: (detail: string): string => `Недійсний JSON: ${detail}`,
  msgStepsArray: 'Скрипт повинен містити масив "steps".',
  msgValidation: (lines: string): string => `Перевірка:\n${lines}`,

  // ── index.ts toasts (user-visible; MCP-bridge/agent error strings are left in place) ──
  toastBuilderNotAvailable: 'Конструктор недоступний на цій вкладці.',
  toastLoadedInBuilder: 'Завантажено в Конструктор',
  toastAiAgentLoaded: 'Агент ШІ завантажив скрипт у Конструктор',
  toastCouldNotLoadScript: 'Не вдалося завантажити скрипт',
  toastNoScriptInExecutor: 'У Виконавці немає JSON скрипту для завантаження.',
  toastAddNonEmptySteps: 'Спочатку додайте непорожній масив "steps" до JSON скрипту.',
  toastOpenedInBuilder: 'Відкрито в Конструкторі',

  // ── Shared RALE preflight errors (Executor + Import) ──
  errDevAppRequired:
    'Щоб установити підключення App Connector, потрібно запустити Roku Developer Application. Відкрийте Developer Application на своєму пристрої Roku (або запустіть свій сайдлоуд-канал із вкладки Dev App), потім спробуйте знову.',
  errRaleConnection:
    'Інструменту не вдалося встановити підключення App Connector. Переконайтеся, що ваш Dev App запущено з увімкненим Режимом розробника і що на вкладці App Connector вказано правильний порт, потім спробуйте знову. Скрипт не можна виконати, доки не буде доступне підключення.',

  // ── Executor engine: full-sentence user-facing errors ──
  errScreenshotPassword:
    'Для знімка екрана потрібен Пароль розробника. Вкажіть його у скрипті (devPassword) або введіть під час перевірки.',
  errScreenshotDevApp:
    'Для знімка екрана Developer App має бути активним. Спочатку запустіть свій сайдлоуд-канал із вкладки Dev App.',
  errDevicePerformanceInRds:
    'Продуктивність пристрою доступна лише під час виконання Action Scripts у Roku Dev Studio.',

  // ── Executor UI ──
  runBtnPause: 'Призупинити виконання',
  runBtnResume: 'Відновити виконання',
  runBtnRun: 'Виконати Action Script',
  emptyNoActions:
    '<strong>Дії не завантажено</strong><br><br>Скористайтеся <strong>Імпортувати Action Script</strong> вгорі, щоб вставити або завантажити JSON-скрипт, потім натисніть <strong>Перевірити та імпортувати</strong> у модальному вікні, щоб завантажити дії сюди.',
  noFolderSelected: 'Папку не вибрано',
  resultsPlaceholder: 'Перевірте та виконайте, щоб побачити результати.',
  waiting: 'Очікування…',
  statusOk: '✓ OK',
  statusFailed: '✗ Помилка',
  statusFailedPlain: 'Помилка',
  statusSkipped: 'Пропущено',
  altScreenshot: 'Знімок екрана',
  altDevicePerformanceChart: 'Діаграма продуктивності пристрою',
  validating: 'Перевірка…',
  errPasteOrUpload: 'Вставте або завантажте скрипт (JSON).',
  errMissingAppFunctions: (list: string): string =>
    `Наведені нижче функції застосунку недоступні: ${list}. Переконайтеся, що ваш канал надає ці функції (або видаліть ці кроки зі скрипту), потім спробуйте знову.`,
  expectedSuffix: (values: string): string => `\n   очікувалося: ${values}`,
  errFileNotFound: (path: string): string => `Файл не знайдено: ${path}`,
  statusValid: '✓ Дійсний',
  usingDevPasswordFromAuth: '(використовується Пароль розробника з Auth)',
  switchedTabRunPaused:
    'Вкладку змінено — виконання призупинено. Поверніться до Action Scripts, щоб відновити (якщо JSON не змінився), або скористайтеся Імпорт → Перевірити та імпортувати.',
  scriptChangedNeedsValidation:
    'Скрипт змінено або потрібна перевірка — скористайтеся Імпортувати Action Script → Перевірити та імпортувати, або змініть JSON і виконайте перевірку.',
  scriptChangedClickValidate: 'Скрипт змінено — натисніть «Перевірити».',
  connectingToAppConnector: 'Підключення до App Connector...',
  runStarted: (runId: string, count: number): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word =
      mod10 === 1 && mod100 !== 11
        ? 'дія'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'дії'
          : 'дій';
    return `Виконання розпочато (${runId}) — ${count} ${word}`;
  },
  errDevicePerformanceUnavailable:
    'Продуктивність пристрою недоступна для цього пристрою. Відкрийте Remote Section (з метриками) або перепідключіть пристрій.',
  errorLine: (message: string): string => `Помилка: ${message}`,
  runStopped: 'Виконання зупинено.',
  runCompleted: 'Виконання завершено.',
  copyResultsTitle: 'Копіювати результати',
  saveResultsTitle: 'Зберегти результати як PDF',

  // ── validator.ts parse errors ──
  noScriptContent: 'Немає вмісту скрипту',
  scriptEmpty: 'Скрипт порожній',
  invalidJsonShort: 'Недійсний JSON',

  // ── Import modal ──
  msgStepsArrayNoDot: 'Скрипт повинен містити масив "steps"',
  errInvalidScriptObject: 'Недійсний скрипт: має бути об’єктом',
  importModalTitle: 'Імпортувати Action Script',
  importIntoBuilderTitle: 'Імпортувати скрипт у Конструктор',
  validateAndLoadBtn: 'Перевірити та завантажити',
  validateAndImportBtn: 'Перевірити та імпортувати',
  errCannotVerifyPassword: 'Неможливо перевірити пароль: підключення до пристрою недоступне.',
  errVerificationFailed: 'Помилка перевірки',
  errCouldNotDetermineDevice:
    'Не вдалося визначити пристрій для імпорту. Закрийте модальне вікно та відкрийте Імпорт знову з цієї вкладки пристрою.',
  errInvalidScript: 'Недійсний скрипт',
  errSaveFolderRequired:
    'Для цього скрипту потрібна папка для збереження (напр. крок знімка екрана). Виберіть папку для збереження.',
  errDevPasswordRequired: 'Пароль розробника обов’язковий, і його немає ні в кеші, ні у скрипті. Введіть його нижче.',
  verifyingPassword: 'Перевірка пароля…',
  errAuthFailed: 'Помилка автентифікації. Перевірте пароль і спробуйте знову.',
  errPasswordVerificationFailed: 'Помилка перевірки пароля.',
  errValidationFailed: 'Помилка валідації',
  errVerificationOrValidationFailed: 'Помилка перевірки або валідації',
  errFailedToReadFile: 'Не вдалося прочитати файл',

  // ── Step Help modal: subtitles + title ──
  helpSubCustomEndpoint: 'Власний endpoint',
  helpSubSelectPost: 'Виберіть POST',
  helpSubFixedDelay: 'Фіксована затримка',
  helpUntilCondition: (srcLabel: string): string => `До виконання умови · ${srcLabel}`,
  helpSubSelectCommand: 'Виберіть команду',
  helpSubSelectKey: 'Виберіть клавішу',
  helpSubSelectCommandShort: 'Вибрати команду',
  helpSystemTelnetTitle: 'Plugins / Пам’ять (застаріле)',
  helpNoText: (type: string): string => `Немає тексту довідки для «${type}».`,

  // ── Step Help modal: variant bodies (inline HTML) ──
  helpBodyQueryCustom: `
    <p>
      <strong>Власний</strong> дозволяє самостійно ввести будь-який шлях Запиту пристрою: звичайний <code>/query/…</code> ECP GET, або
      значення dev-стилю, такі як <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Використовуйте це, коли для потрібного endpoint немає пресету. Значення надсилається як є до того самого механізму запитів, що й пресети.</p>
  `,
  helpBodyQueryTelnetPlugins: `
    <p>
      Виконує telnet-команду розробника <strong>plugins</strong> (список запакованих каналів / зведення плагінів). Це ті
      самі дані, що й при виборі пресету Plugins у старіших процесах, подані як пресет запиту.
    </p>
    <p>Потребує доступу розробника до пристрою (як і інші запити dev-plugin).</p>
  `,
  helpBodyQueryTelnetFree: `
    <p>
      Виконує telnet-команду розробника <strong>free</strong> (знімок пам’яті / heap). Використовуйте, коли потрібно
      швидко зчитати обсяг пам’яті під час скрипту.
    </p>
  `,
  helpBodyPostNone: `
    <p>Виберіть один із пресетів <strong>POST</strong> (SGRendezvous, FW Beacons тощо). Кожен варіант зіставляється з фіксованим шляхом на пристрої.</p>
  `,
  helpBodyWaitDelay: `
    <p>
      Призупиняє скрипт на задану кількість <strong>мілісекунд</strong> без опитування. Використовуйте після анімацій,
      запусків або будь-якого кроку, де потрібна лише фіксована пауза.
    </p>
  `,
  helpBodyWaitMediaPlayer: `
    <p>
      Опитує <code>/query/media-player</code>, доки <strong>стан</strong> плеєра не збігатиметься з вашим вибором (play,
      pause, buffer, …) або не мине <strong>тайм-аут</strong>.
    </p>
    <p>
      Налаштуйте <strong>інтервал опитування</strong>, щоб збалансувати чутливість і навантаження. Якщо умова ніколи не стає істинною,
      крок завершується помилкою після досягнення тайм-ауту.
    </p>
  `,
  helpBodyWaitRale: `
    <p>
      Опитує через <strong>RALE</strong>, доки поле вузла сцени не збігатиметься з порівнянням (оператор + значення). Потрібно
      вказати шлях (масив JSON), id вузла, назву поля та поля таймінгу.
    </p>
    <p>
      Потребує підключення App Connector під час виконання. Оператори на кшталт <code>exists</code> / <code>notExists</code> можуть
      приховувати поле значення — див. підписи форми для активного режиму.
    </p>
  `,
  helpBodyIfMediaPlayer: `
    <p>
      Оцінює поточний стан <strong>медіаплеєра</strong> один раз і виконує гілку <strong>тоді</strong> або
      <strong>інакше</strong>. Виберіть очікуваний стан (play, pause, …) для розгалуження.
    </p>
    <p>На відміну від <strong>Очікування</strong>, опитування немає: умова перевіряється один раз під час виконання кроку.</p>
  `,
  helpBodyIfActiveApp: `
    <p>
      Порівнює один атрибут із <code>/query/active-app</code> (app id, тип, версія, назва) за допомогою заданих вами оператора та
      значення. Корисно для розгалуження, коли на передньому плані певний канал.
    </p>
  `,
  helpBodyIfRale: `
    <p>
      Одноразова перевірка <strong>поля вузла RALE</strong> (шлях, id вузла, поле, оператор, значення). Така сама структура, як
      RALE-частина умови Очікування, але оцінюється один раз для розгалуження.
    </p>
  `,
  helpBodyIfVariables: `
    <p>
      Порівнює значення, збережене у <strong>змінній скрипту</strong> (з попередньої команди RALE або присвоєння функції застосунку)
      за допомогою заданих вами шляху змінної та оператора.
    </p>
    <p>Потребує версії скрипту 2 та попередніх кроків, що заповнюють змінну.</p>
  `,
  helpBodyRaleNone: `
    <p>Виберіть <strong>команду RALE</strong> зі списку. Параметри та необов’язкове «Задати змінну» з’являються після вибору команди.</p>
  `,
  helpBodyAppFunctionNone: `
    <p>
      Підключіть <strong>App Connector</strong>, щоб експортовані функції вашого каналу з’явилися у списку, потім виберіть
      функцію, щоб побачити її параметри.
    </p>
  `,
  helpBodyKeypressNone: `
    <p>Виберіть <strong>клавішу пульта</strong> зі згрупованого списку. Скрипт надсилає цю клавішу через ECP під час виконання кроку.</p>
  `,
  helpBodySystemTelnetNone: `
    <p>Виберіть <strong>Plugins</strong> або <strong>Пам’ять</strong> для цього застарілого кроку, або перейдіть на Запит пристрою з відповідними telnet-пресетами.</p>
  `,
  helpBodySystemTelnetPlugins: `
    <p>Застаріла telnet-команда <strong>plugins</strong>. Для нових скриптів надавайте перевагу <strong>Запиту пристрою</strong> з пресетом <code>telnet:plugins</code>.</p>
  `,
  helpBodySystemTelnetFree: `
    <p>Застаріла telnet-команда <strong>free</strong> (пам’ять). Для нових скриптів надавайте перевагу <strong>Запиту пристрою</strong> з пресетом <code>telnet:free</code>.</p>
  `,

  // ── Step Help modal: per-action fallback bodies (inline HTML) ──
  helpFallbackQuery: `
    <p>
      Виконує зчитування з пристрою: або звичайний <strong>ECP GET</strong> на шляху <code>/query/…</code>, або
      dev-стиль endpoint, такий як <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Виберіть пресет для поширених endpoint або <strong>Власний</strong>, щоб ввести свій.</p>
  `,
  helpFallbackPost: `
    <p>
      Надсилає <strong>HTTP POST</strong> на Roku за фіксованим шляхом аналітики / beacon. Кожен пресет зіставляється з
      конкретним endpoint, що використовується в робочих процесах розробки.
    </p>
  `,
  helpFallbackKeypress: `
    <p>
      Надсилає <strong>клавішу пульта</strong> через ECP. Заголовок довідки відображає, яка клавіша вибрана зараз, коли
      ви відкриваєте це діалогове вікно.
    </p>
  `,
  helpFallbackInputText: `
    <p>
      Надсилає <strong>текст із клавіатури</strong> на пристрій (введення тексту ECP). Символи отримує сфокусоване поле або екранна
      клавіатура.
    </p>
  `,
  helpFallbackLaunch: `
    <p>
      Запускає канал за <strong>app ID</strong>. Необов’язкові <strong>параметри</strong> можуть передавати Deep-Link або аргументи
      запуску залежно від каналу.
    </p>
  `,
  helpFallbackSideload: `
    <p>
      Завантажує пакет зі <strong>шляху до файлу</strong> та встановлює його як сайдлоуд-канал розробника. За потреби вкажіть
      пароль розробника на кроці або через <code>devPassword</code> скрипту.
    </p>
  `,
  helpFallbackDeleteSideload: `
    <p>Видаляє сайдлоуд-канал розробника. Необов’язковий пароль відповідає налаштуванням безпеки dev вашого пристрою.</p>
  `,
  helpFallbackAppFunction: `
    <p>
      Викликає <strong>функцію BrightScript</strong> через App Connector. Підзаголовок показує <strong>вибрану
      функцію</strong>. Параметри відповідають експортованій сигнатурі каналу; використовуйте <strong>Задати змінну</strong>, щоб зберегти
      значення, що повертається, для наступних кроків.
    </p>
  `,
  helpFallbackRaleCommand: `
    <p>
      Виконує <strong>вбудовану команду RALE</strong>. Підзаголовок показує вибрану команду; розширений опис береться
      з вбудованого опису команди, коли він доступний.
    </p>
  `,
  helpFallbackDevicePerformance: `
    <p>
      Робить знімок діаграм <strong>Продуктивності пристрою</strong> для <strong>того самого пристрою</strong>, на якому виконується цей скрипт (те
      саме підключення, що й для Запиту пристрою та натискання клавіш). Значення відповідають налаштуванням історії Remote Section, коли живе опитування
      заповнило діаграми; інакше крок ненадовго очікує на свіжу вибірку, коли це потрібно.
    </p>
    <h4>Діаграма</h4>
    <p>
      <strong>Об’єкти BrightScript</strong>, <strong>Використання CPU</strong>, <strong>Системна пам’ять</strong> або
      <strong>Усе разом</strong> (один об’єднаний результат: CPU, потім пам’ять, потім об’єкти). CPU та пам’ять надходять із
      того самого опитування продуктивності каналу.
    </p>
    <h4>Необов’язкова мітка</h4>
    <p>Показується в заголовку результатів, подібно до кроку знімка екрана.</p>
  `,
  helpFallbackScreenshot: `
    <p>
      Захоплює зображення телевізора через <strong>Developer App</strong>. Developer App має бути активним; на кроці,
      у скрипті або у запиті перевірки має бути доступний пароль розробника.
    </p>
    <h4>Очікування перед (мс)</h4>
    <p>
      Пауза у виконавці <strong>перед</strong> початком захоплення, щоб UI встиг стабілізуватися (за замовчуванням 100 мс, коли ви додаєте
      крок).
    </p>
    <h4>Очікування після (мс)</h4>
    <p>
      Після запуску захоплення виконавець очікує перед завантаженням <code>dev.jpg</code>. Збільште, якщо зображення
      обрізаються; порожнє значення використовує <strong>1500 мс</strong> за замовчуванням.
    </p>
    <h4>Необов’язкова мітка</h4>
    <p>Допомагає ідентифікувати цей знімок у виводі виконання, коли скрипт робить кілька знімків екрана.</p>
  `,
  helpFallbackWait: `
    <p>
      Або <strong>фіксована затримка</strong>, або <strong>доки не виконається умова</strong>. Підзаголовок відображає
      поточний тип очікування, а для умов — джерело даних (медіаплеєр чи поле вузла RALE).
    </p>
  `,
  helpFallbackIf: `
    <p>
      Розгалужується на списки кроків <strong>тоді</strong> / <strong>інакше</strong> за допомогою одноразової умови. Підзаголовок
      відображає вибране джерело умови (медіаплеєр, активний застосунок, поле RALE або змінні). Потребує версії
      скрипту 2.
    </p>
  `,
  helpFallbackSystemTelnet: `
    <p>
      <strong>Застарілий</strong> крок лише для telnet. Для нових скриптів надавайте перевагу <strong>Запиту пристрою</strong> з <code>telnet:plugins</code> або
      <code>telnet:free</code>.
    </p>
  `,

  // ── Step Help modal: composed / interpolated body fragments (dynamic values pre-escaped) ──
  helpQueryPresetBody: (label: string, endpoint: string): string => `
    <p>
      Виконує <strong>Запит пристрою</strong> для <strong>${label}</strong> за допомогою endpoint
      <code>${endpoint}</code>.
    </p>
    <p>
      Як і всі запити, цей використовує ECP (або dev-plugin шлях застосунку для пресетів telnet-стилю). Пристрій має бути
      доступним у мережі.
    </p>
  `,
  helpPostPresetBody: (label: string, endpoint: string): string => `
    <p>
      Надсилає HTTP <strong>POST</strong> на <code>${endpoint}</code> (<strong>${label}</strong>).
    </p>
    <p>Використовуйте це для потоків аналітики / beacon, що очікують POST, а не GET.</p>
  `,
  helpSelectedFunction: (fn: string): string =>
    `<p><strong>Вибрана функція:</strong> <code>${fn}</code></p>`,
  helpAppFunctionDescription: (desc: string): string =>
    `<p><strong>Опис функції застосунку:</strong> ${desc}</p>`,
  helpAppFunctionArgs:
    '<p>Рядки аргументів відповідають метаданим App Connector для цієї функції; складні типи використовують JSON у полі.</p>',
  helpCurrentKey: (nice: string, key: string): string => `
        <p>
          <strong>Поточна клавіша:</strong> ${nice} (<code>${key}</code>) — надсилається як стандартне ECP
          натискання клавіші під час виконання кроку.
        </p>
      `,

  // ── Builder: additional field placeholders / option fallbacks ──
  placeholderQueryEndpoint: '/query/… або telnet:plugins / telnet:free',
  placeholderVariablePathExample: 'myVar або data.items.0.id',
  optionUnknownFunction: 'невідома',

  // ── Executor: step descriptions (stepDescription; result-card header + list rows) ──
  descQuery: (endpoint: string): string => `Запит ${endpoint}`,
  descKeypress: (key: string): string => `Натискання ${key}`,
  descSendText: (text: string): string => `Надіслати текст "${text}"`,
  descLaunchApp: (appId: string): string => `Запустити застосунок ${appId}`,
  descSideload: (filename: string): string => `Сайдлоуд ${filename}`,
  descDeleteSideload: 'Видалити сайдлоуд',
  descAppFunction: (fn: string): string => `Функція застосунку ${fn}`,
  descScreenshot: 'Знімок екрана',
  descScreenshotLabel: (label: string): string => `Знімок екрана (${label})`,
  descScreenshotWaitAfter: (ms: number): string => `Знімок екрана (очікування після: ${ms}мс)`,
  descDevicePerformance: (chart: string): string => `Продуктивність пристрою — ${chart}`,
  descDevicePerformanceLabel: (label: string, chart: string): string =>
    `Продуктивність пристрою (${label}) — ${chart}`,
  descWait: 'Очікування',
  descWaitWithDetails: (details: string): string => `Очікування · ${details}`,
  descIf: 'If (…)',
  descIfWithDetails: (details: string): string => `If · ${details}`,

  // ── Executor: wait-step Details column (formatWaitStepListDetails) ──
  waitDetailFixedDelay: (delayMs: number): string => `Фіксована затримка ${delayMs} мс`,
  waitDetailTiming: (maxSec: number, pollMs: number): string =>
    ` · макс ${maxSec}с · опитування ${pollMs}мс`,
  waitDetailMediaPlayerState: (state: string): string => `Медіаплеєр · доки стан "${state}"`,
  waitDetailMediaPlayerCheck: (check: string): string => `Медіаплеєр · доки ${check}`,
  waitDetailRale: (line: string): string => `Поле вузла RALE · ${line}`,
  waitDetailRaleIncomplete: 'Поле вузла RALE · (неповне)',
  waitDetailGenericSource: (src: string): string => `Очікування · джерело ${src}`,

  // ── Executor: if-step Details column (formatIfStepListDetails) ──
  ifDetailMediaPlayerState: (state: string): string => `Медіаплеєр · стан "${state}"`,
  ifDetailMediaPlayerCheck: (check: string): string => `Медіаплеєр · ${check}`,
  ifDetailRale: (line: string): string => `Поле вузла RALE · ${line}`,
  ifDetailRaleEmpty: 'Поле вузла RALE · …',
  ifDetailVariable: (path: string): string => `Змінна · $${path}`,
  ifDetailVariableEmpty: 'Змінна · …',
  ifDetailActiveApp: (attr: string): string => `Активний застосунок · ${attr}`,
  ifDetailActiveAppEmpty: 'Активний застосунок · …',

  // ── Executor: results-panel progress log lines (onLog) ──
  logWaitingMs: (ms: number): string => `Очікування ${ms} мс...`,
  logWaitingBeforeCapture: (ms: number): string => `Очікування ${ms} мс перед захопленням...`,
  logPollingFieldMet: (elapsed: number, field: string): string =>
    `Опитування... (${elapsed}с) — поле "${field}" — умову виконано`,
  logPollingField: (elapsed: number, field: string, value: string): string =>
    `Опитування... (${elapsed}с) — поле "${field}": ${value}`,
  logPollingStatusMet: (elapsed: number, status: string): string =>
    `Опитування... (${elapsed}с) — ${status} — умову виконано`,
  logPollingStatus: (elapsed: number, status: string): string =>
    `Опитування... (${elapsed}с) — ${status}`,
  pollValueEmpty: '(порожньо)',
  pollValueReconnecting: '(перепідключення...)',
  pollValueNoResponse: '(немає відповіді)',
  pollStateValue: (state: unknown): string => `стан: ${state}`,
  pollStateNone: 'стан: (немає)',
  pollInvalidMediaPlayer: 'Недійсна відповідь media-player',
  pollQueryFailed: (err: string): string => `Помилка запиту: ${err}`,
  pollNoResponse: 'Немає відповіді',
  logConnectingTelnet: 'Підключення до Telnet (порт 8080)...',
  logQueryUsesDevTelnet: (ep: string, cmd: string): string =>
    `Запит пристрою "${ep}" використовує dev Telnet "${cmd}" (те саме, що й вкладка Запит).`,
  logPartialPerformance: 'Деякі розділи продуктивності були недоступні; частковий знімок.',

  // ── Executor: step result summaries (onLog) ──
  stepSummaryChars: (n: number): string => `→ ${n} символів`,
  stepSummaryOk: '→ OK',
  stepSummarySentKey: (key: string): string => `→ надіслано ${key}`,
  stepSummarySent: '→ надіслано',
  stepSummaryLaunched: (appId: string): string => `→ запущено ${appId}`,
  stepSummarySideloadComplete: '→ сайдлоуд завершено',
  stepSummaryDeleted: '→ видалено',
  stepSummarySaveFailed: (err: string): string => `→ помилка збереження: ${err}`,
  stepSummarySavedAs: (filename: string): string => `→ збережено як ${filename}`,
  stepSummaryCapturedNoFolder: '→ захоплено (немає папки для збереження)',
  stepSummaryChartImages: (n: number): string => `→ ${n} зображень діаграм`,
  stepSummaryCaptured: '→ захоплено',
  stepSummarySkipped: (reason: string): string => `→ пропущено (${reason})`,

  // ── Executor: step errors / skip reasons (result.error / skippedReason) ──
  errWaitTimeout: 'Тайм-аут очікування',
  errStopped: 'Зупинено',
  skipReasonNoAppConnector: 'App Connector недоступний',
  errNoAppConnectorRaleWait: 'App Connector недоступний для очікування вузла RALE',
  errUnknownActionType: (type: string): string => `Невідомий тип дії: ${type}`,
  errInvalidRaleCommand: 'Недійсна команда RALE',
  errTelnetNotAvailable: 'Системні команди Telnet недоступні в цьому контексті',
  errSaveNotAvailable: 'Збереження недоступне',
  errCouldNotVerifyDevApp: (err: string): string =>
    `Не вдалося перевірити стан Dev App перед знімком екрана: ${err}`,
  errInvalidPath: 'Недійсний шлях',
  errStepPreorderMismatch: 'Внутрішня помилка: невідповідність preorder кроків',

  // ── Settings: Action Script default-folder picker (main process) ──
  pickDefaultFolderTitle: 'Папка за замовчуванням для виводу Action Script'
};

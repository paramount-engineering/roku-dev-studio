/**
 * Ukrainian (uk) translation of the global modals catalog.
 * Mirrors the exact shape of shared/strings/modals.ts — same keys, order, and
 * function signatures/placeholders. Only literal display text is translated.
 */
export const modals = {
  // Release Notes modal
  releaseNotes: 'Примітки до випуску',
  versionedReleaseNotes: (title: string): string => `${title} · Примітки до випуску`,
  openReleasePage: 'Відкрити сторінку випуску',
  loadingReleaseNotes: 'Завантаження приміток до випуску…',
  noReleaseNotes: 'Для цього випуску не надано приміток.',
  couldNotLoadReleaseNotes: 'Не вдалося завантажити примітки до випуску зараз.',
  latestRelease: 'Останній випуск',
  unknownError: 'Невідома помилка',

  // Update banner — update available
  updateAvailableTitle: (version?: string): string =>
    `Roku Dev Studio ${version ? `v${version}` : 'оновлення'} доступне`,
  newVersionReady: 'Нова версія готова до завантаження.',
  dismissUpdateNotification: 'Закрити сповіщення про оновлення',
  later: 'Пізніше',
  download: 'Завантажити',

  // Update banner — downloading
  downloadingUpdate: 'Завантаження оновлення…',
  pleaseWaitDownloading: 'Зачекайте, доки завантажується оновлення.',

  // Update banner — ready to install
  updateReadyTitle: (version?: string): string =>
    `Roku Dev Studio ${version ? `v${version}` : 'оновлення'} готове`,
  installedOnRestart: 'Буде встановлено після перезапуску.',
  restartAndInstall: 'Перезапустити та встановити',

  // Update banner — manual download / error
  newUpdateAvailable: 'Доступне нове оновлення',
  pleaseDownloadLatest: 'Завантажте останній випуск, щоб оновити.',
  dismiss: 'Закрити',
  updateError: 'Помилка оновлення',
  updateCheckFailed: 'Не вдалося перевірити оновлення.',

  // "Check for Updates" — no update found toast
  upToDate: (version?: string): string => `У вас найновіша версія${version ? ` (v${version})` : ''}.`,

  // Welcome-screen feature detail modals — longer blurb + capability bullets per tile.
  // (Keyed by the feature title so the component can look each up by the tile's live title.)
  features: {
    deviceDiscovery: {
      blurb:
        'Roku Dev Studio безперервно сканує вашу локальну мережу за допомогою SSDP, тож кожен Roku в тій самій підмережі з’являється автоматично — вводити IP не потрібно.',
      points: [
        'Автоматично визначає моделі, назви та IP-адреси Roku',
        'Позначає, на яких пристроях увімкнено Режим розробника',
        'Оновлюється, коли пристрої підключаються до мережі або залишають її',
        'Один клац, щоб підключитися та почати роботу',
      ],
    },
    appsDeepLinking: {
      blurb:
        'Переглядайте кожен канал, установлений на підключеному Roku, миттєво запускайте будь-який із них і тестуйте Deep-Links з користувацькими параметрами контенту та типу медіа.',
      points: [
        'Сітка встановлених додатків (а також входи TV на Roku TV)',
        'Запуск із сітки або за ID додатка',
        'Deep-link з contentId / mediaType для тестування запуску контенту',
        'Копіювання неформатованого списку ID + версій усього встановленого',
      ],
    },
    devApp: {
      blurb:
        'Виконуйте sideload, керуйте та інспектуйте свій канал розробки від початку до кінця — від завантаження zip до живих знімків екрана того, що на ньому.',
      points: [
        'Виконуйте sideload dev-каналу .zip за допомогою пароля розробника',
        'Запускайте або видаляйте завантажений через sideload додаток',
        'Робіть знімки екрана за запитом або автоматично',
        'Копіюйте, завантажуйте або очищайте зроблені зображення',
      ],
    },
    appConnector: {
      blurb:
        'Викликайте функції BrightScript на своєму завантаженому через sideload каналі віддалено та переглядайте значення, що вони повертають — перевіряйте шляхи виконання коду, не торкаючись пульта.',
      points: [
        'Викликайте експортовані функції за назвою з аргументами',
        'Інспектуйте повернуті значення на місці',
        'Працює з активним dev-каналом',
      ],
    },
    fiddle: {
      blurb:
        'Чернетка для BrightScript: пишіть фрагменти коду в повноцінному редакторі Monaco та запускайте їх на підключеному пристрої з живим лінтингом.',
      points: [
        'Редактор Monaco з підсвічуванням синтаксису',
        'Живі підказки лінтера під час набору',
        'Запуск на підключеному Roku одним клацанням',
        'Відкривається в окремому спеціальному вікні',
      ],
    },
    mcpServer: {
      blurb:
        'Відкрийте доступ до Roku Dev Studio для агентів ШІ через Model Context Protocol, щоб асистенти могли керувати вашим пристроєм у вашому циклі розробки.',
      points: [
        'Запускайте додатки, натискайте клавіші та робіть знімки екрана за допомогою інструментів MCP',
        'Запитуйте стан пристрою програмно',
        'Долучайте агентів ШІ до вашого робочого процесу тестування та налагодження',
      ],
    },
    deviceRemote: {
      blurb:
        'Повноцінний екранний пульт Roku — кожна кнопка фізичного пульта, а також керування з клавіатури та введення тексту.',
      points: [
        'D-pad, OK, Назад, Головна, Опції та Повтор',
        'Керування відтворенням: відтворення/пауза, перемотка назад, перемотка вперед',
        'Гучність, вимкнення звуку та живлення',
        'Уводьте текст безпосередньо в поля на пристрої',
      ],
    },
    query: {
      blurb:
        'Читайте актуальний стан Roku через ECP (External Control Protocol) — інформацію про пристрій, статус медіапрогравача, установлені додатки та реєстр.',
      points: [
        'Інформація про пристрій: модель, версія та мережа',
        'Активний додаток і стан відтворення медіапрогравача',
        'Список установлених додатків',
        'Вміст реєстру',
      ],
    },
    console: {
      blurb:
        'Транслюйте наживо вихідні дані налагодження BrightScript з Roku через Telnet, з фільтрацією та пошуком, щоб виявити саме те, що важливо, і підключайте повноцінний дебагер BrightScript, коли потрібно покроково пройти код.',
      points: [
        'Живий потік журналу Telnet',
        'Фільтр і повнотекстовий пошук',
        'Клацніть URL/JSON/XML, щоб переглянути їх у зручному форматі в модальному вікні',
        'Збережіть журнал у файл',
        'Підключіть дебагер — точки зупину, змінні, стек викликів і REPL',
      ],
    },
    actionScripts: {
      blurb:
        'Автоматизуйте повторювані сценарії пристрою, поєднуючи натискання клавіш, запуски додатків і виклики RALE в єдиний виконуваний скрипт.',
      points: [
        'Упорядковуйте натискання клавіш, запуски та очікування',
        'Додавайте виклики RALE до сценарію',
        'Повторно запускайте сценарії для регресійного тестування',
      ],
    },
    networkInspector: {
      blurb:
        'Захоплюйте та інспектуйте HTTP/HTTPS-трафік Dev App через вбудований проксі MITM — наче вкладка мережі браузера для вашого каналу.',
      points: [
        'Переглядайте кожен запит і відповідь, які надсилає канал',
        'Інспектуйте заголовки, тіла та час',
        'Розшифровуйте HTTPS через проксі MITM',
        'Групуйте за хостом або переглядайте проксовані сесії',
      ],
    },
    remoteLocations: {
      blurb:
        'Підключайтеся до пристроїв Roku, яких немає у вашій локальній мережі, спрямовуючи трафік через сервери-ретранслятори.',
      points: [
        'Отримуйте доступ до пристроїв будь-де через сервер-ретранслятор',
        'Керуйте кількома віддаленими розташуваннями',
        'Ті самі інструменти, що й для локальних пристроїв',
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
    title: '🌐 Додати віддалене розташування',
    intro:
      'Підключайтеся до пристроїв Roku у віддаленому розташуванні через Roku Relay Server, що працює на Mac Mini чи іншому комп’ютері.',
    nameLabel: 'Назва розташування',
    namePlaceholder: 'напр., офісна лабораторія, студія B',
    nameHint: 'Зрозуміла назва для ідентифікації цього розташування',
    hostLabel: 'Адреса сервера',
    hostPlaceholder: '192.168.1.50 або mac-mini.local',
    hostHint: 'IP-адреса або ім’я хоста Relay Server',
    portLabel: 'Порт',
    portHint: 'Типовий порт — 4951',
    addBtn: 'Додати розташування',
  },

  actionScriptsImport: {
    title: 'Імпортувати Action Script',
    uploadJsonLabel: 'Завантажити JSON',
    chooseFileBtn: 'Вибрати файл',
    savedScriptLabel: 'Збережені скрипти',
    savedSelectPlaceholder: 'Виберіть збережений Action Script',
    savedSelectEmpty: 'Немає збережених скриптів',
    pasteJsonLabel: 'Вставити або редагувати JSON',
    outputFolderLabel: 'Папка виводу',
    noFolderSelected: 'Папку не вибрано',
    chooseFolderBtn: 'Вибрати папку',
    outputWarning:
      'Якщо папку не вибрано, артефакти (напр., знімки екрана) не збережуться під час виконання скрипту.',
    devPasswordRequiredMsg: 'Цей скрипт потребує пароля розробника. Уведіть його нижче.',
    devPasswordLabel: 'Пароль розробника',
    devPasswordPlaceholder: 'Уведіть пароль розробника для кроків знімка екрана / sideload',
    rememberPasswordTitle: 'Зберегти пароль для цього пристрою (так само, як зберігання пароля Dev App)',
    rememberPasswordLabel: 'Запам’ятати пароль для цього пристрою',
    devPasswordHintHtml:
      'Потрібен, коли скрипт має кроки знімка екрана чи sideload і не містить поля <code>devPassword</code>.',
    validateImportBtn: 'Перевірити та імпортувати',
  },

  deeplinkDeleteMediaType: {
    title: 'Видалити тип медіа',
    confirmHint: 'Видалити тип медіа та ці збережені Deep-Links?',
    deleteAllBtn: 'Видалити все',
  },

  deeplinkMediaTypes: {
    title: 'Керування типами медіа',
    hint: 'Вбудовані типи медіа завжди доступні. Користувацькі записи зберігаються глобально й з’являються на вкладці кожного пристрою.',
    builtinTitle: 'Вбудовані',
    builtinMovie: 'Фільм',
    builtinSeries: 'Серіал',
    builtinEpisode: 'Епізод',
    builtinLive: 'Наживо',
    customTitle: 'Користувацькі',
    addTitle: 'Додати тип медіа',
    displayNameLabel: 'Відображувана назва',
    displayNamePlaceholder: 'напр., короткометражний фільм',
    ecpValueLabel: 'Значення ECP',
    ecpValuePlaceholder: 'напр., short-film',
  },

  deeplinkSavePreset: {
    title: 'Зберегти Deep-Link',
    hint: 'Дайте цьому Deep-Link назву, щоб можна було вибрати його зі збереженого списку на будь-якому пристрої.',
    nameLabel: 'Назва',
    namePlaceholder: 'напр., Netflix · епізод 12',
  },

  devMode: {
    title: 'Увімкнути Режим розробника на Roku',
    whatIsHeading: 'Що таке Режим розробника?',
    whatIsBody:
      'Режим розробника дозволяє виконувати sideload і тестувати власні канали Roku безпосередньо на пристрої. Його ввімкнення безкоштовне й дає доступ до потужних інструментів розробки.',
    stepsHeading: 'Кроки для ввімкнення Режиму розробника',
    pressSequenceHtml:
      'На пульті Roku натисніть: <span class="help-kbd">Home</span> <span class="help-kbd">Home</span> <span class="help-kbd">Home</span> <span class="help-kbd">Up</span> <span class="help-kbd">Up</span> <span class="help-kbd">Right</span> <span class="help-kbd">Left</span> <span class="help-kbd">Right</span> <span class="help-kbd">Left</span> <span class="help-kbd">Right</span>',
    step2: 'На вашому TV з’явиться діалогове вікно налаштувань розробника',
    step3Html: 'Виберіть <strong>«Enable installer and restart»</strong>',
    step4: 'Прийміть ліцензійну угоду SDK для розробників',
    step5Html: `Установіть <strong>Web Server Password</strong> (він знадобиться вам для sideload)`,
    step6: 'Ваш Roku перезапуститься з увімкненим Режимом розробника',
    afterHeading: 'Після ввімкнення',
    afterIntro: 'Після ввімкнення Режиму розробника:',
    afterBadgeHtml:
      'Ваш пристрій показуватиме позначку <span class="dev-badge enabled" style="font-size: 11px;"><span class="icon icon-xs"><svg><use href="#icon-wrench"/></svg></span> Dev</span> у списку пристроїв',
    afterSideloadHtml: 'Ви можете виконувати sideload пакетів каналу .zip через вкладку <strong>Dev App</strong>',
    afterAppConnectorHtml: 'Використовуйте <strong>App Connector</strong>, щоб взаємодіяти з кодом вашого каналу',
    afterQueryHtml: 'Отримайте доступ до додаткових запитів ECP на вкладці <strong>Запити</strong>',
    moreHeading: 'Докладніше',
    moreBody: 'Щоб отримати докладну документацію, відвідайте офіційну документацію для розробників Roku:',
  },

  ecpMode: {
    title: 'Керування через мобільні додатки на Roku',
    whyHeading: 'Навіщо це потрібно?',
    whyBodyHtml:
      'Функції пульта (натискання клавіш, додатки, швидкий пульт, Надіслати текст) використовують External Control Protocol (ECP) Roku. Налаштування пристрою <strong>Керування через мобільні додатки → Доступ до мережі</strong> можна встановити в один із чотирьох режимів:',
    modeDisabledHtml: '<strong>Disabled</strong> – Керування через мобільні додатки вимкнено.',
    modeLimitedHtml:
      '<strong>Limited</strong> – Лише введення тексту, запуски додатків і запити активного додатка; увімкнено для адрес приватної мережі.',
    modePermissiveHtml:
      '<strong>Permissive</strong> – Повне керування; приймає команди лише з приватної мережі або тієї самої підмережі.',
    modeEnabledHtml: '<strong>Enabled</strong> – Повне керування; увімкнено для адрес приватної мережі.',
    howHeading: 'Як змінити налаштування',
    step1Html: 'На пристрої Roku перейдіть до <strong>Settings</strong> → <strong>System</strong>',
    step2Html: 'Відкрийте <strong>Advanced System Settings</strong>',
    step3Html: 'Виберіть <strong>Control by Mobile Apps</strong>',
    step4Html: 'Виберіть <strong>Network Access</strong>',
    step5Html:
      'Виберіть <strong>Limited</strong>, <strong>Permissive</strong> або <strong>Enabled</strong> (цей застосунок адаптується до режиму)',
    afterHeading: 'Після зміни',
    afterBodyHtml:
      'З <strong>Limited</strong> працюють Надіслати текст, запуск і запити додатків; повне натискання клавіш пульта може не працювати. З <strong>Permissive</strong> або <strong>Enabled</strong> працює повне дистанційне керування. Для Permissive переконайтеся, що цей комп’ютер у тій самій підмережі, що й Roku, якщо команди не працюють. Після зміни налаштування перезапуск не потрібен.',
  },

  keyboardRemoteHelp: {
    title: 'Пульт із клавіатури',
    introHtml:
      'Комбінації клавіш діють, лише коли ця вкладка пристрою перебуває на вкладці <strong>Пульт</strong> або <strong>Dev App</strong>.',
    tableCaption: 'Комбінації клавіш, зіставлені з пультом Roku',
    colKey: 'Клавіша',
    colAction: 'Дія пульта',
    actionNavigate: 'Навігація (вгору, вниз, вліво, вправо)',
    actionSelect: 'Вибір / OK',
    actionBack: 'Назад',
    actionHome: 'Головна',
    actionPlayPause: 'Відтворення / пауза',
    actionRewind: 'Перемотка назад',
    actionForward: 'Перемотка вперед',
    actionOptions: 'Опції (інформація)',
    actionReplay: 'Миттєвий повтор',
    actionVolumeUp: 'Збільшення гучності',
    actionVolumeDown: 'Зменшення гучності',
    actionMute: 'Вимкнення звуку',
    actionPower: 'Живлення',
    footnote:
      'Вимкніть Пульт із клавіатури в <button type="button" class="help-settings-link" data-settings-section="general" data-settings-highlight="keyboardRemoteSettingsRow">Налаштуваннях</button>, якщо не хочете, щоб клавіші зі стрілками та інші зіставлені клавіші надсилали натискання на Roku.',
  },

  secretScreens: {
    title: 'Секретні екрани Roku',
    introHtml: `
            Пристрої Roku мають вбудовані діагностичні меню та меню розробника, доступні через послідовності кнопок пульта.
            З екрана <strong>Головна</strong> на Roku натискайте кнопки, показані в кожному рядку, за допомогою
            <strong>фізичного пульта</strong> (IR або голосового пульта).
          `,
    ecpLimitationTitle: 'Обмеження ECP',
    ecpLimitationBodyHtml: `
              Roku не завжди надійно інтерпретує всі послідовності секретних екранів, надіслані через ECP. Якщо
              послідовність не відкривається через <strong>Run Sequence</strong>, скористайтеся <strong>фізичним пультом</strong>.
            `,
    sectionTitle: 'Секретні екрани',
  },

  integrationGuide: {
    title: 'Посібник з інтеграції',
    whatIsHeading: 'Що таке TrackerTask?',
    whatIsBodyHtml: `
            <strong>TrackerTask</strong> — це компонент BrightScript, спочатку створений для <strong>RALE (Roku Advanced
              Layout Editor)</strong> -
            офіційного інструмента розробника Roku для інспектування та налагодження додатків SceneGraph у реальному часі.
          `,
    trackerTaskEnabling:
      'TrackerTask встановлює з’єднання через сокет між вашим додатком Roku та зовнішніми інструментами, що дає змогу:',
    enablingPoint1: 'Інспекція та зміна вузлів у реальному часі',
    enablingPoint2: 'Живий перегляд меж елементів інтерфейсу',
    enablingPoint3: 'Керування реєстром',
    enablingPoint4: 'Журналювання та налагодження',
    extendsBody:
      'App Connector розширює цю функціональність двома користувацькими функціями, які дозволяють відкривати й виконувати користувацькі функції BrightScript вашого додатка з цього десктопного інструмента.',
    customFunctionsHeading: 'Користувацькі функції для App Connector',
    customFunctionsBody:
      'До TrackerTask додано дві функції, щоб увімкнути функціональність App Connector:',
    implementingHeading: 'Реалізація у вашому Scene',
    implementingBodyHtml: `
            Файл <strong>MainScene.xml</strong> вашого додатка повинен оголосити дві інтерфейсні функції, які викликатиме
            TrackerTask:
          `,
    getExternalHeading: 'Реалізація GetExternalControlFunctions',
    getExternalBodyHtml: `
            Ця функція повинна повертати <strong>roArray</strong> асоціативних масивів, де кожен елемент описує
            функцію:
          `,
    supportedParamsBodyHtml: `
              <strong>Boolean</strong> · <strong>Integer</strong> · <strong>LongInteger</strong> ·
              <strong>Float</strong> ·
              <strong>Double</strong> · <strong>String</strong> · <strong>roAssociativeArray</strong> ·
              <strong>roArray</strong> · <strong>roList</strong>
            `,
    supportedParamsTitle: '📝 Підтримувані типи параметрів',
    executeFunctionHeading: 'Реалізація ExecuteFunction',
    executeFunctionBody:
      'Ця функція отримує назву функції та масив параметрів, а потім спрямовує їх до відповідного обробника:',
    setupHeading: 'Налаштування TrackerTask',
    setupBody: 'Додайте компонент TrackerTask до свого проєкту та створіть екземпляр у своєму MainScene:',
    setupPlaceHtml: `
            Розмістіть файл <code>TrackerTask.xml</code> у каталозі <code>components/</code> вашого додатка.
          `,
    saveBtn: 'Зберегти TrackerTask.xml',
    copyBtn: 'Копіювати інформацію про інтеграцію',
  },

  helpModal: {
    title: 'Довідка та посібник користувача',
    navAriaLabel: 'Розділи довідки',
    navDeviceDiscovery: 'Виявлення пристроїв',
    navRemoteControl: 'Дистанційне керування',
    navApps: 'Додатки',
    navQuery: 'Запит',
    navDevApp: 'Dev App',
    navConsole: 'Консоль',
    navAppConnector: 'App Connector',
    navActionScripts: 'Action Scripts',
    navDevicePerformance: 'Продуктивність пристрою',
    navNetworkInspector: 'Інспектор мережі',
    navAiAgents: 'Агенти ШІ (MCP)',
    navFiddle: 'BrightScript Fiddle',
    navLogViewer: 'Переглядач файлів журналу',
    navSecretScreens: 'Секретні екрани',
    navSettings: 'Налаштування',
    navRemoteLocations: 'Віддалені розташування',
    navSideloadRelay: 'Sideload Relay',
    navTips: 'Поради',

    deviceDiscoveryHeading: 'Виявлення пристроїв',
    deviceDiscoveryScanHtml: `Натисніть <strong>Scan</strong>, щоб автоматично виявити пристрої Roku у вашій мережі. Пристрої з увімкненим Режимом розробника матимуть зелену позначку «Dev».`,
    deviceDiscoveryNoScanHtml: `<strong>Scan нічого не знаходить?</strong> Багатоадресна розсилка SSDP (UDP порт 1900) може бути заблокована VPN, корпоративним Wi‑Fi чи правилами брандмауера — спробуйте ручне підключення з IP пристрою. ПК і Roku мають бути в одній доступній мережі.`,
    deviceDiscoveryManual:
      'Ви також можете підключитися вручну, ввівши IP-адресу в розділі «Ручне підключення» внизу бічної панелі.',

    remoteControlHeading: 'Дистанційне керування',
    remoteControlIntroHtml: `Використовуйте віртуальний пульт для керування Roku. Додаткові комбінації клавіш доступні, коли ви вмикаєте <button type="button" class="help-settings-link" data-settings-section="general" data-settings-highlight="keyboardRemoteSettingsRow">Налаштування → Загальні → Пульт Roku - використовувати клавіатуру </button> (вимкнено за замовчуванням). Вони діють на вкладці <strong>Пульт</strong> (окремо або в макеті-квадранті продуктивності пристрою) чи на вкладці <strong>Dev App</strong>, лише для відкритої вкладки пристрою — не в інших розділах, текстових полях чи модальних вікнах.`,
    remoteControlTabHtml: `На вкладці <strong>Пульт</strong> або <strong>Dev App</strong> натисніть <span class="help-kbd">Tab</span> з елементів керування пультом (не з вкладок розділів чи іншого текстового поля), щоб перейти до поля <strong>Надіслати текст</strong>. <span class="help-kbd">Enter</span> надсилає з цього поля.`,
    remoteControlMediaHtml: `Елементи керування медіа (перемотка назад, відтворення/пауза, перемотка вперед) і кнопки гучності також доступні на віртуальному пульті. Використовуйте <strong>Надіслати текст</strong> внизу, щоб уводити текст безпосередньо в активне текстове поле пристрою.`,
    scNavigation: 'Навігація',
    scForward: 'Перемотка вперед',
    scSelect: 'Вибір / OK',
    scRewind: 'Перемотка назад',
    scBack: 'Назад',
    scReplay: 'Миттєвий повтор',
    scHome: 'Головна',
    scVolume: 'Збільшення / зменшення гучності',
    scPlayPause: 'Відтворення / пауза',
    scMute: 'Вимкнення звуку',
    scOptions: 'Меню опцій',
    scPower: 'Живлення',

    appsHeading: 'Додатки',
    appsListHtml: `
            <li><strong>Користувацький запуск</strong> - Запуск будь-якого додатка за ID, зокрема входів TV (HDMI 1-4)</li>
            <li><strong>Deep Link</strong> - Запуск додатків з певним контентом за допомогою deep linking (App ID, Content ID, Media Type)</li>
            <li><strong>Неформатований список додатків</strong> - Перегляд неформатованого XML-списку всіх встановлених додатків</li>
          `,
    appsBody:
      'Переглядайте всі встановлені додатки на вашому пристрої Roku. Клацніть будь-який додаток, щоб запустити його. Використовуйте пошук, щоб фільтрувати додатки за назвою.',

    queryHeading: 'Запит',
    queryListHtml: `
            <li><strong>Запити пристрою</strong> - Заготовки для поширених запитів, як-от Device Info, Apps, Active App, Media Player тощо</li>
            <li><strong>Запити розробника</strong> - Розширені запити для пристроїв із режимом розробника (SG Nodes, Plugins, Frame Rate, Channel Perf, App State, Registry)</li>
            <li><strong>Користувацький запит</strong> - Уведіть будь-яку користувацьку кінцеву точку ECP</li>
          `,
    queryIntro: 'Запитуйте інформацію про пристрій за допомогою кінцевих точок ECP Roku:',
    queryResults:
      'Результати відображаються на панелі результатів нижче. Також доступні кінцеві точки POST (відстеження SGRendezvous, FW Beacons).',

    devAppHeading: 'Dev App',
    devAppListHtml: `
            <li><strong>Автентифікація</strong> - Уведіть і перевірте свій пароль розробника Roku. Увімкніть «Запам’ятати», щоб зберегти його між сесіями</li>
            <li><strong>Sideload</strong> - Встановлення пакетів каналу .zip або .pkg</li>
            <li><strong>Remote</strong> - Перегляд сторінки вебінсталятора пристрою для додаткових опцій розробника</li>
            <li><strong>Знімок екрана</strong> - Робіть знімки екрана з вашого запущеного Dev App</li>
            <li><strong>Видалити</strong> - Видалення завантаженого через sideload каналу</li>
          `,
    devAppIntro: 'Для пристроїв з увімкненим Режимом розробника:',
    devAppNote: 'Вам знадобиться пароль розробника Roku (встановлений під час налаштування Режиму розробника).',

    consoleHeading: 'Консоль',
    consoleListHtml: `
            <li><strong>Підключити / від’єднати</strong> - Встановлення або закриття з’єднання telnet</li>
            <li><strong>Знайти / фільтрувати</strong> - Пошук у журналах з опціями врахування регістру, збігу цілого слова та регулярних виразів</li>
            <li><strong>Автопрокручування</strong> - Автоматичне прокручування до найновішого виводу</li>
            <li><strong>Копіювати / зберегти</strong> - Копіювання всіх журналів у буфер обміну або збереження у файл</li>
            <li><strong>Очистити</strong> - Очищення виводу консолі</li>
          `,
    consoleIntro: 'Підключіться до консолі налагодження BrightScript через Telnet (порт 8085):',
    consoleNote:
      'Потребує ввімкненого Режиму розробника. Одночасно на пристрої може бути активним лише одне з’єднання telnet.',

    appConnectorHeading: 'App Connector',
    appConnectorListHtml: `
            <li><strong>Підключити</strong> - Встановлює з’єднання через сокет із вашим запущеним Dev App (типовий порт <code>49200</code>)</li>
            <li><strong>Виконати функцію</strong> - Викликайте користувацькі функції, відкриті через <code>GetExternalControlFunctions</code> вашого scene</li>
            <li><strong>Відповідь</strong> - Перегляд повернутих значень і виводу налагодження</li>
            <li><strong>Оновити вузол</strong> - Після виконання <em>Get Node by ID</em> панель відповіді пропонує модальне вікно оновлення вузла, де ви можете застосувати <code>selectNode</code>, <code>setField</code> чи <code>removeField</code> до знайденого вузла</li>
            <li><strong>Вбудовані команди RALE</strong> - Спадне меню функцій також містить вбудовані команди RALE: <em>Get Node by ID</em>, <em>Get Node by SubType</em> і редактор реєстру (<em>Get All Sections</em>, <em>Add/Update Section</em>, <em>Remove Section</em>, <em>Set / Edit / Remove Section Key</em>, <em>Clear All Sections</em>)</li>
          `,
    appConnectorFooterHtml: `Ваш додаток Roku повинен мати інтегрований TrackerTask. Натисніть <strong>Посібник з інтеграції</strong> на вкладці App Connector, щоб отримати фрагменти коду BrightScript і підтримувані типи параметрів. Використовуйте <strong>Зберегти TrackerTask.xml</strong> з того самого модального вікна, щоб додати готову до постачання копію у ваш канал.`,
    appConnectorIntro:
      'Підключайтеся до додатків Roku, які реалізують компонент TrackerTask для двостороннього зв’язку:',

    actionScriptsHeading: 'Action Scripts',
    actionScriptsBuilderHtml: `<strong>Builder</strong> - Візуально створюйте action scripts дія за дією:`,
    actionScriptsBuilderListHtml: `
            <li><strong>Типи дій</strong> - Натискання клавіші, Надіслати текст, Запуск додатка, Запит пристрою, POST, Sideload, Видалення sideload, Знімок екрана, Функція додатка, Команда RALE, захоплення продуктивності пристрою, Очікування, If</li>
            <li><strong>Змінні (script v2)</strong> - Використовуйте крок <em>Установити змінну</em> або <code>assignToVar</code> у Запиті пристрою / Функції додатка / Команді RALE, щоб запам’ятати значення, а потім посилайтеся на них як <code>\${name}</code> у полях наступних кроків (текст, параметри, контент deep-link тощо)</li>
            <li><strong>If / Else if / Else (script v2)</strong> - Розгалуження за умовами на основі стану <code>media-player</code>, активного додатка, поля вузла RALE чи збереженої змінної; вкладайте кроки <em>If</em> для багатоетапних гілок</li>
            <li><strong>Умови очікування</strong> - <em>Очікування</em> може бути фіксованим <code>delayMs</code> або чекати, доки умова стане істинною: стан <em>media-player</em> чи <em>поле вузла RALE</em> (опитує <code>getNodeById</code> і порівнює поле з операторами, як-от <code>equals</code>, <code>contains</code>, <code>matches</code>, <code>hasAnyValue</code>) з необов’язковими <code>timeoutMs</code> і <code>pollIntervalMs</code></li>
            <li><strong>Крок продуктивності пристрою</strong> - Захоплюйте графіки <em>CPU</em>, <em>пам’яті</em>, <em>об’єктів</em> чи <em>усіх</em> для пристрою, на якому виконується цей скрипт; захоплені PNG входять до результатів запуску / експорту PDF</li>
            <li><strong>Довідка для кроку</strong> - Елемент <em>?</em> у кожному рядку конструктора відкриває контекстну довідку для цього типу дії</li>
            <li><strong>Керування діями</strong> - Додавайте, видаляйте, змінюйте порядок (перетягуванням), копіюйте та вставляйте дії</li>
            <li><strong>Копіювати / вставити</strong> - Скопіюйте дію за допомогою елемента копіювання в кожному рядку. Після копіювання використовуйте <strong>Вставити крок</strong> поруч із будь-яким рядком <strong>Додати крок</strong>, щоб вставити в цю позицію, або <span class="help-kbd">Ctrl</span>+<span class="help-kbd">V</span>, щоб додати в кінець скрипту</li>
            <li><strong>Імпорт</strong> - Завантажте наявний скрипт із файлу JSON</li>
            <li><strong>Скасувати / повторити</strong> - <span class="help-kbd">Ctrl</span>+<span class="help-kbd">Z</span>, щоб скасувати, <span class="help-kbd">Ctrl</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">Z</span>, щоб повторити</li>
            <li><strong>Попередній перегляд JSON</strong> - Живий попередній перегляд згенерованого скрипту. Скопіюйте або збережіть скрипт у файл</li>
            <li><strong>Копіювати в Executor</strong> - Надішліть створений скрипт безпосередньо в Executor для виконання</li>
          `,
    actionScriptsExecutorHtml: `<strong>Executor</strong> - Імпортуйте, перевіряйте та запускайте action scripts:`,
    actionScriptsExecutorListHtml: `
            <li><strong>Імпорт</strong> - Завантажте файл скрипту JSON або вставте JSON скрипту, потім перевірте</li>
            <li><strong>Запуск / пауза / стоп</strong> - Керуйте виконанням за допомогою дій відтворення, паузи та зупинки</li>
            <li><strong>Пропустити / не пропускати</strong> - Перемикайте окремі дії для пропуску під час виконання</li>
            <li><strong>Змінити порядок</strong> - Перетягуйте, щоб змінити порядок дій перед запуском</li>
            <li><strong>Результати</strong> - Переглядайте докладні результати для кожної дії, зокрема вбудовані знімки екрана та захоплені графіки продуктивності</li>
            <li><strong>Копіювати / зберегти результати</strong> - Скопіюйте результати в буфер обміну або збережіть як PDF (PDF містить знімки екрана та картки графіків)</li>
            <li><strong>Підключитися до консолі</strong> - За бажанням автоматично підключайтеся до консолі налагодження під час запусків</li>
          `,
    actionScriptsDevPasswordHtml: `<strong>Пароль розробника</strong> - Дії, як-от знімок екрана, Sideload і видалення sideload, потребують пароля розробника. Пароль визначається в такому порядку: рівень дії <code>"password"</code> → рівень скрипту <code>"devPassword"</code> → пароль із розділу автентифікації Dev App. Якщо жодного не знайдено, вас запитають під час перевірки.`,
    actionScriptsSaveFolderHtml: `<strong>Папка збереження</strong> - Типова папка збереження розташована в <button type="button" class="help-settings-link" data-settings-section="action-scripts" data-settings-highlight="actionScriptsDefaultFolderSettingsRow">Налаштування → Action Scripts → Типова папка</button>. Для кожного запуску можна вибрати іншу папку. Артефакти (знімки екрана, PNG-графіки продуктивності, експортовані PDF) потрапляють у підпапку з позначкою часу, яка створюється лише тоді, коли щось справді згенеровано.`,
    actionScriptsAiAgentsHtml: `<strong>Агенти ШІ</strong> - Action Scripts, які ви створюєте в Builder, також можуть створюватися агентами ШІ через сервер MCP (див. розділ <em>Агенти ШІ (MCP)</em> нижче); скрипт агента завжди потрапляє в Builder для перегляду людиною перед запуском.`,
    actionScriptsIntro:
      'Автоматизуйте послідовності дій пристрою за допомогою скриптів на основі JSON. Доступні два подання:',

    devicePerformanceHeading: 'Продуктивність пристрою (розділ пульта)',
    devicePerformanceIntroHtml: `Увімкніть <strong>Показувати продуктивність пристрою</strong> в розділі пульта, щоб розгорнути квадрант із живими графіками:`,
    devicePerformanceListHtml: `
            <li>Графіки <strong>використання CPU</strong>, <strong>системної пам’яті</strong> та <strong>об’єктів BrightScript</strong> (перегляд кількості або пам’яті, де доступно)</li>
            <li>Графіки відображають запущений додаток — для репрезентативних показників на пристрої має бути ввімкнено <strong>Режим розробника</strong>, а ваш <strong>завантажений через sideload dev-канал</strong> — на передньому плані</li>
            <li><button type="button" class="help-settings-link" data-settings-section="device-performance" data-settings-highlight="devicePerfRows">Налаштування → Продуктивність пристрою</button> налаштовує інтервал дискретизації графіка та вікно історії; увімкніть <strong>Запам’ятати «Показувати продуктивність пристрою»</strong>, щоб відновлювати макет-квадрант для кожного пристрою між сесіями</li>
            <li>У Action Scripts кроки <strong>Продуктивності пристрою</strong> захоплюють картки графіків у результати запуску (та експорт PDF)</li>
          `,

    networkInspectorHeading: 'Інспектор мережі',
    networkInspectorIntroHtml: `Інспектуйте трафік HTTP(S), який створює ваш dev-канал. Roku Dev Studio запускає локальний <strong>проксі MITM</strong>, який розшифровує HTTPS dev-каналу, спрямований через нього, тож ви можете бачити повні заголовки й тіла запитів/відповідей.`,
    networkInspectorGettingStartedHtml: `<strong>Початок роботи</strong>`,
    networkInspectorGettingStartedListHtml: `
            <li>Увімкніть <strong>проксі MITM</strong> у <button type="button" class="help-settings-link" data-settings-section="network-inspector" data-settings-highlight="networkInspectorEnableSettingsRow">Налаштування → Інспектор мережі</button>, потім налаштуйте свій dev-канал спрямовувати запити через показану адресу проксі — використовуйте <code>host:port</code> (напр., <code>192.168.1.50:8888</code>). Те, як канал застосовує цей проксі, залежить від мережевого коду вашого додатка.</li>
            <li>Необов’язкове <strong>захоплення через точку доступу</strong> записує метадані SNI/DNS для всього трафіку пристрою; воно потребує доступу до захоплення пакетів ОС (macOS BPF, Windows Npcap). <button type="button" class="help-settings-link" data-settings-section="network-inspector" data-settings-highlight="niSetupRow">Налаштування → Інспектор мережі</button> проведе вас через налаштування для кожної платформи.</li>
          `,
    networkInspectorToolbarHtml: `<strong>Панель інструментів</strong> (угорі праворуч на панелі): <strong>Почати/зупинити захоплення</strong>, <strong>Макет панелей</strong> (стос чи запит/відповідь поруч) і <strong>Налаштувати правила трафіку</strong>.`,
    networkInspectorToolbarListHtml: `
            <li><strong>Список сесій</strong> - Фільтруйте за <code>host:</code>, <code>method:</code>, <code>status:</code>, <code>type:</code>, <code>kind:</code>, <code>path:</code> (розділяйте терміни комами для OR); групуйте за хостом; перемкніть <em>Proxied</em>, щоб приховати метадані лише з точки доступу. Ярлики переходу до помилки та прокручування до найновішого з’являються, коли доречно.</li>
            <li><strong>Інспектувати</strong> - Переглядайте огляд запиту / відповіді, заголовки та тіла (JSON / XML / raw). <strong>Скопіюйте</strong> тіло або експортуйте транзакцію як <strong>cURL</strong> чи <strong>HAR</strong>.</li>
            <li><strong>Зберегти .pcap</strong> - Експортуйте захоплені пакети пристрою; <strong>Очистити</strong> спорожняє список сесій.</li>
          `,
    networkInspectorTrafficRulesHtml: `<strong>Правила трафіку</strong> (шестірня на панелі інструментів) формують проксований трафік цього пристрою; зміни набувають чинності негайно:`,
    networkInspectorTrafficRulesListHtml: `
            <li><strong>Блокувати весь проксований трафік</strong> - Відхиляти кожен проксований запит. Це має перевагу над правилами для окремих хостів і обмеженням швидкості пристрою.</li>
            <li><strong>Обмеження швидкості пристрою</strong> - Обмежуйте пропускну здатність та/або додавайте затримку для кожного проксованого запиту. Виберіть заготовку або введіть власне значення (напр., <code>3 Mbps</code>, <code>1500 kbps</code>).</li>
            <li><strong>Правила для окремих хостів</strong> - Додайте <strong>ім’я хоста</strong>, щоб націлити кожен запит до цього хоста, або <strong>хост + шлях</strong> (напр., <code>api.example.com/v1/play</code>), щоб націлити лише цей шлях. Кожне правило може <em>Блокувати</em>, <em>Скидати</em> з’єднання (імітувати збій мережі), <em>Підміняти</em> шаблонну відповідь (статус / Content-Type / затримка / тіло) та/або обмежувати швидкість.</li>
            <li><strong>Символи підстановки</strong> - Використовуйте <code>*</code> у хості чи шляху, щоб зіставити кілька цілей. <code>*.example.com</code> охоплює кожен субдомен (напр., нижчі <em>та</em> робочі середовища в одному правилі), а <code>/v1/*/play</code> зіставляє будь-який шлях під <code>/v1</code>. Шаблон без <code>*</code> зберігає стару поведінку (голий хост також зіставляє свої субдомени).</li>
            <li><strong>Редагувати правило</strong> - Клацніть олівець на правилі, щоб змінити його URL перехоплення на місці (хост або хост/шлях); натисніть Enter, щоб застосувати, або Escape, щоб скасувати.</li>
            <li><strong>Перезапис</strong> - На відміну від Блокувати / Скидати / Підміняти (які зупиняють запит), правила перезапису дозволяють запиту пройти із застосованими змінами. Додавайте операції до <em>запиту</em> (перенаправлення хоста — «зіставити віддалено» робочий URL зі staging/localhost, встановити шлях, додати/видалити параметри запиту чи заголовки, знайти/замінити в тілі) та/або <em>відповіді</em> (перевизначити статус, додати/видалити заголовки, знайти/замінити в тілі — відповіді gzip/br декодуються, редагуються та повторно надсилаються). Знайти/замінити в тілі підтримує звичайний текст або регулярний вираз і застосовується лише до текстових тіл.</li>
            <li><strong>Межі</strong> - Хост не може бути швидшим за обмеження пропускної здатності пристрою, а його затримка не може опускатися нижче мінімальної затримки пристрою.</li>
          `,
    networkInspectorLocalOnly: 'Інспектор мережі доступний для локально підключених пристроїв.',

    aiAgentsHeading: 'Агенти ШІ (MCP)',
    aiAgentsIntroHtml: `Roku Dev Studio постачається із сервером <strong>MCP (Model Context Protocol)</strong>, щоб агенти ШІ в Cursor, Claude Desktop чи VS Code могли керувати реальним пристроєм через цей застосунок:`,
    aiAgentsListHtml: `
            <li><button type="button" class="help-settings-link" data-settings-section="mcp-server">Налаштування → Сервер MCP</button> - Перемкніть клієнта, щоб додати або видалити його запис MCP <code>roku-dev-studio</code>; інші записи в конфігурації MCP цього клієнта залишаються незмінними</li>
            <li><strong>Дві поверхні</strong> - Прямі операції з пристроєм для одноразових дій (<code>keypress</code>, <code>launch_app</code>, <code>screenshot</code>, <code>app_function</code>, <code>rale_command</code>, telnet …) і <strong>Action Scripts</strong> для багатоетапних / умовних сценаріїв, що потрапляють у Builder на перегляд</li>
            <li><strong>Toasts</strong> - Деструктивні дії агента (запуск, sideload, видалення sideload, знімок екрана, деструктивні команди RALE) показують неблокувальний toast у застосунку, тож ви завжди бачите, що зробив агент</li>
            <li><strong>Паролі залишаються локальними</strong> - Sideload / знімок екрана / видалення sideload повторно використовують пароль, який запам’ятала панель пристрою; агенту ніколи не потрібно надсилати його</li>
          `,
    aiAgentsBridge:
      'Міст запускається автоматично, коли додаток відкрито, і вимикається під час виходу. Якщо агент повідомляє, що міст офлайн, просто перемкніть цей додаток на передній план.',

    fiddleHeading: 'BrightScript Fiddle',
    fiddleIntroHtml: `Відкрийте через <strong>Файл → Відкрити Fiddle</strong> (<span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">B</span>) або кнопку <em>Відкрити Fiddle</em> на вкладці Запит.`,
    fiddleListHtml: `
            <li><strong>Редактор</strong> - Редактор Monaco з підсвічуванням BrightScript і живим лінтингом <em>BrighterScript</em>; кнопка Run вимкнена, доки є помилки</li>
            <li><strong>Run</strong> - Обгортає ваш фрагмент коду в мінімальний канал SceneGraph, виконує його sideload на вибраному пристрої та транслює консоль налагодження BrightScript (8085) у термінал вікна Fiddle</li>
            <li><strong>Стоп / закриття вікна</strong> - Автоматично видаляє канал Fiddle з пристрою</li>
          `,
    fiddleNote:
      'Потребує пристрою з увімкненим Режимом розробника й відомим паролем розробника (скористайтеся вкладкою Dev App один раз, щоб запам’ятати його, інакше вас запитають у Fiddle).',

    logViewerHeading: 'Переглядач файлів журналу',
    logViewerBodyHtml: `<strong>Файл → Відкрити файл журналу</strong> (<span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">O</span>) відкриває збережений файл консолі / журналу в окремому вікні з тими самими елементами пошуку / структурованого журналу / виявлення URL, що й на живій вкладці Консоль. Зручно для перегляду журналів із попередньої сесії чи від колеги.`,

    secretScreensHeading: 'Секретні екрани',
    secretScreensBodyHtml: `Посилання <em>Секретні екрани</em> (розділ пульта та нижній колонтитул вкладки Запит) відкриває модальне вікно зі стандартними послідовностями клавіш Roku для прихованих налаштувань — <strong>Developer Settings</strong>, <strong>Secret Screen 1/2/3</strong>, <strong>Wi-Fi Info</strong>, <strong>Channel Info</strong>, <strong>Reboot</strong> тощо. Клацніть послідовність, щоб надіслати натискання клавіш на підключений пристрій.`,

    settingsHeading: 'Налаштування',
    settingsIntroHtml: `Відкрийте за допомогою <span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">,</span> або <em>Roku Dev Studio → Налаштування</em> (macOS) / <em>Файл → Налаштування</em> (Windows / Linux). П’ять розділів:`,
    settingsListHtml: `
            <li><strong>Загальні</strong> - Режим розробника, Режим конфіденційності (маскування IP / серійних номерів), Журналювання налагодження у файл, Пульт Roku - використовувати клавіатуру, Автопідключення до пристроїв, Автоприховування бічної панелі, Шифрування збережених паролів (рядок стану показує, чи справді сховище ключів ОС шифрує — у деяких конфігураціях Linux ні)</li>
            <li><strong>Action Scripts</strong> - Типова папка для артефактів запуску (знімки екрана, експортовані PDF)</li>
            <li><strong>Продуктивність пристрою</strong> - Інтервал дискретизації графіка, вікно історії графіка, Запам’ятати «Показувати продуктивність пристрою» для кожного пристрою</li>
            <li><strong>Таймінги &amp; мережа</strong> - Тайм-аути підключення / запиту / telnet та інші налаштування мережі (зі скиданням до типових значень)</li>
            <li><strong>Сервер MCP</strong> - Перемкніть <code>roku-dev-studio</code> у ваших клієнтах ШІ, щоб агенти могли керувати пристроєм через цей застосунок</li>
          `,

    remoteLocationsHeading: 'Віддалені розташування',
    remoteLocationsListHtml: `
            <li><strong>Налаштування</strong> - Запустіть Roku Relay Server на Mac Mini у віддаленому розташуванні</li>
            <li><strong>Додати розташування</strong> - Натисніть «Додати» в розділі віддалених розташувань, щоб налаштувати з’єднання</li>
            <li><strong>Адреса сервера</strong> - Уведіть IP-адресу або ім’я хоста сервера-ретранслятора</li>
            <li><strong>Типовий порт</strong> - Сервер-ретранслятор за замовчуванням працює на порту <code>4951</code></li>
          `,
    remoteLocationsServerHtml: `Сервер-ретранслятор можна знайти в папці <code>remote-server</code>. Див. README для інструкцій із налаштування (macOS LaunchAgent, Linux systemd, Windows Task Scheduler).`,
    remoteLocationsTroubleshootHtml: `<strong>Sideload або знімок екрана не працює через ретранслятор, але ECP працює?</strong> Оновіть хост ретранслятора до тієї самої версії <code>roku-dev-studio-api</code>, що й цей застосунок. Перевірте <code>GET /health</code> на ретрансляторі (поле <code>apiVersion</code>) і переконайтеся, що порт <code>4951</code> доступний через брандмауери.`,
    remoteLocationsIntro: 'Керуйте пристроями Roku у віддалених розташуваннях через Relay Server:',

    sideloadRelayHeading: 'Sideload Relay',
    sideloadRelayIntroHtml: `Виконуйте sideload однієї збірки на <strong>багато пристроїв одразу</strong>. Коли ретранслятор увімкнено, Roku Dev Studio оголошує себе як Roku у вашій мережі: спрямуйте свій IDE (VS Code BrightScript / roku-deploy / Eclipse) або браузер на цей комп’ютер, завантажте один раз, і RDS роздає збірку — <em>встановлення → запуск → консоль</em> — на кожен цільовий пристрій, локальний чи у віддаленому розташуванні.`,
    sideloadRelayEnableHtml: `<strong>Увімкніть його</strong> в <button type="button" class="help-settings-link" data-settings-section="sideload-relay" data-settings-highlight="optSideloadRelay-row">Налаштування → Sideload Relay</button> (вимкнено за замовчуванням). Перемикач залежить від двох передумов:`,
    sideloadRelayEnableListHtml: `
            <li><strong>Пароль розробника ретранслятора</strong> - Пароль, за яким ваш IDE автентифікується в RDS (користувач <code>rokudev</code>), точнісінько як пароль розробника справжнього Roku. Він окремий від власного пароля розробника кожного цільового пристрою.</li>
            <li><strong>Налаштувати пристрої</strong> - Відкрийте модальне вікно налаштування пристроїв і ввімкніть принаймні один доступний пристрій з увімкненим Режимом розробника. Воно перелічує локальні та віддалені пристрої (у розташуванні ретранслятора); увімкніть ті, які мають отримувати кожну збірку. Пристрої без збереженого пароля розробника показують <strong>🔒 Установити пароль</strong>, щоб перевірити його на місці. Раніше націлені пристрої, які переходять офлайн, залишаються в списку (вимкнені) й автоматично повертаються, коли знову стають доступними.</li>
          `,
    sideloadRelayPointHtml: `<strong>Спрямуйте свій IDE на RDS.</strong> Коли ретранслятор увімкнено, RDS можна виявити через SSDP як <em>«Roku Dev Studio Relay»</em>, або ви можете напряму встановити хост збірки на IP цього комп’ютера. Під час <em>Sideload</em> / <em>Debug: Launch</em> IDE завантажує в RDS на порту <code>80</code>, а RDS обробляє роздачу. За адресою ретранслятора також обслуговується тематична вебсторінка завантаження (<code>http://&lt;this-machine&gt;/</code>) для sideload файлів <code>.zip</code> перетягуванням із браузера.`,
    sideloadRelayAutoConnectHtml: `<strong>Автопідключення.</strong> Коли збірка успішно потрапляє на ціль, RDS відкриває цей пристрій як підключену вкладку й автоматично приєднує його консоль налагодження, тож ви бачите вивід кожного пристрою без зайвих клацань. Живий перебіг роздачі також транслюється як консоль стану на порту telnet <code>8085</code>.`,
    sideloadRelaySourceApprovalHtml: `<strong>Схвалення джерела.</strong> Sideload, що походить із цього комп’ютера, виконується автоматично. Sideload з іншого комп’ютера утримує завантаження та показує запит дозволу/відхилення на хості RDS (автоматично відхиляє через 30 с); завантаження з браузера на віддаленому комп’ютері додатково потребують входу з паролем розробника ретранслятора.`,
    sideloadRelayFooterHtml: `Потребує ввімкненого Режиму розробника на цільових пристроях. Див. <strong>Віддалені розташування</strong> вище для націлювання на пристрої в іншому місці через сервер-ретранслятор.`,

    tipsHeading: 'Поради',
    tipDeveloperModeHtml: `Увімкніть Режим розробника на вашому Roku: перейдіть на головний екран, натисніть <span class="help-kbd">Home</span> 3 рази, <span class="help-kbd">↑</span> 2 рази, <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span>`,
    tipMacosHtml: `<strong>macOS:</strong> закриття головного вікна завершує роботу застосунку (сесії telnet і MCP розриваються). Використовуйте <em>Roku Dev Studio → Вийти</em> або <span class="help-kbd">Cmd</span>+<span class="help-kbd">Q</span> — застосунок не залишається в доку без вікон.`,
    tipWindowsLinuxHtml: `<strong>Windows / Linux:</strong> використовуйте меню в рядку заголовка (☰) для Налаштувань, Режиму конфіденційності та розділу «Про застосунок»; кнопки згортання/розгортання/закриття вікна розташовані на правому краю рядка заголовка.`,
    tipMultipleDevices: 'Кілька пристроїв можна підключити одночасно — кожен отримує власну вкладку',
    tipClickCard: 'Клацніть картку підключеного пристрою, щоб перемкнутися на його вкладку',
    tipRightClick: 'Клацніть правою кнопкою миші картки пристроїв, щоб скопіювати інформацію про пристрій',
    tipRemoteLocations: 'Віддалені розташування дозволяють керувати пристроями без фізичного доступу',
  },
};

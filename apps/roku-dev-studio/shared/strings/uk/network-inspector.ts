/**
 * Ukrainian (uk) translation of the Network Inspector strings — the live capture
 * tab, its modals (traffic rules, find-in-content, hotspot setup, port conflict,
 * large-body info, filter help), and the detail renderers shared with the
 * standalone Session Viewer. Sibling of ../network-inspector.ts — same
 * `networkInspector` shape, keys, order, and function signatures.
 *
 * Some values intentionally embed HTML markup (<strong>, <code>, <kbd>, <em>)
 * because they're injected via innerHTML. Only literal display text is translated;
 * product / feature names, tech tokens, code literals, and placeholders are kept
 * verbatim. Count-based functions apply Ukrainian (Slavic) 3-form plural logic.
 */
export const networkInspector = {
  // Section identity (used as a title prefix for the shared URL / structured viewers).
  titlePrefix: 'Інспектор мережі',

  // ── Shared detail pane chrome (network-detail-view.ts) ──────────────────────────────
  emptyDetail: 'Виберіть сеанс, щоб перевірити запит і відповідь.',
  request: 'Запит',
  response: 'Відповідь',
  tabOverview: 'Огляд',
  tabBody: 'Тіло',
  tabHeaders: 'Заголовки',
  copyRequestBody: 'Копіювати тіло запиту',
  copyResponseBody: 'Копіювати тіло відповіді',
  moreCopyOptions: 'Більше параметрів копіювання',
  copyBody: 'Копіювати тіло',
  copyAsCurl: 'Копіювати як cURL',
  copyAsHar: 'Копіювати як HAR',
  bodyTruncated: 'Тіло скорочено',
  bodyTruncatedRequestTitle:
    'Захоплена копія цього тіла перевищила ліміт відображення інспектора, тому показане тут є неповним. Повне тіло все одно було доставлено на сервер призначення. Скористайтеся кнопкою Копіювати для захопленої частини.',
  bodyTruncatedResponseTitle:
    'Захоплена копія цього тіла перевищила ліміт відображення інспектора, тому показане тут є неповним. Повне тіло все одно було доставлено на Roku. Скористайтеся кнопкою Копіювати для захопленої частини.',
  disableWordWrap: 'Вимкнути перенесення рядків',
  enableWordWrap: 'Увімкнути перенесення рядків',
  toggleWordWrap: 'Перемкнути перенесення рядків',
  formatLabel: 'Формат',
  formatAuto: 'Авто',
  formatJson: 'JSON',
  formatXml: 'XML',
  formatRaw: 'Необроблений',
  whyRawText: 'Чому це показано як необроблений текст?',

  // ── Session list rows (network-session-view.ts) ─────────────────────────────────────
  noMatchingSessions: 'Немає відповідних сеансів.',
  noHostsYet: 'Хостів поки немає. Подання «Структура» групує трафік за іменем хоста.',
  sslDecryptedTitle: 'Розшифровано (MITM)',
  sslEncryptedTitle: 'HTTPS (зашифровано)',
  sessionNumber: (n: number): string => `Сеанс #${n}`,
  requestNumber: (n: number): string => `Запит #${n}`,
  expandAllGroups: 'Розгорнути всі групи',
  collapseAllGroups: 'Згорнути всі групи',

  // ── Session-list derived tokens (network-sessions.ts) ───────────────────────────────
  // Duration column value while a transaction is still open (distinct from statusPending
  // below — has a trailing ellipsis and is the duration cell, not the status pill).
  durationPending: 'Очікування…',
  // Status-pill tokens for the session list. Kept SEPARATE from the overview statusPending:
  // statusClass()/the status filter compare against session.status, so these must stay
  // byte-identical to the values eventToSession() assigns.
  listStatusPending: 'Pending',
  listStatusQuery: 'Query',
  listStatusOk: 'OK',
  listStatusOpen: 'Open',
  // DNS structure-tree leaf / sidebar path labels.
  dnsQueryLabel: 'DNS-запит',
  dnsResponseLabel: 'DNS-відповідь',

  // ── Detail renderers (network-detail.ts) ────────────────────────────────────────────
  // Synthetic first-row header of the response Headers table (HTTP/RFC start-line term).
  statusLine: 'Status-Line',
  noHeaders: '(немає заголовків)',
  noRequestBody: '(немає тіла запиту)',
  noResponseBody: '(немає тіла відповіді)',
  emptyResponseBody: '(порожнє тіло відповіді)',
  waitingForResponse: '(очікування відповіді…)',
  encryptedNoHeaders: '(зашифровано — немає заголовків)',
  dnsNoHeaders: '(DNS — немає заголовків HTTP)',
  dnsAnswerEmpty: '(порожньо)',
  dnsPending: '(очікування)',
  noResponseBodyCaptured: '(тіло відповіді не захоплено)',
  httpsResponseEncrypted: 'Тіло HTTPS-відповіді зашифроване. Увімкніть проксі MITM, щоб перевіряти тіла тут.',
  // Media-preview fallbacks + captions.
  mimeContent: 'вміст',
  mimeBinary: 'двійковий',
  mimeUnknownType: 'невідомий тип',
  responseImageAlt: 'Попередній перегляд зображення відповіді',
  binaryTruncatedNote: (mime: string): string =>
    `Двійковий ${mime} було скорочено під час захоплення — попередній перегляд недоступний. Скористайтеся кнопкою Копіювати для захопленого base64.`,
  binaryNotPreviewable: (mime: string, size: string): string =>
    `Двійковий вміст (${mime}, ~${size}) — попередній перегляд недоступний. Скористайтеся кнопкою Копіювати для захопленого base64.`,
  // Overview: request Status row values (display-only; distinct from the session-list status tokens).
  statusPending: 'Очікування',
  statusComplete: 'Завершено',
  statusFailed: 'Не вдалося',
  // Overview: row + section labels.
  ovType: 'Тип',
  ovTime: 'Час',
  ovDevice: 'Пристрій',
  ovHost: 'Хост',
  ovDestination: 'Призначення',
  ovUrl: 'URL',
  ovStatus: 'Статус',
  ovResponseCode: 'Код відповіді',
  ovProtocol: 'Протокол',
  ovMethod: 'Метод',
  requestContentType: 'Content-Type запиту',
  responseContentType: 'Content-Type відповіді',
  ovClientAddress: 'Адреса клієнта',
  ovRemoteAddress: 'Віддалена адреса',
  ovTags: 'Теги',
  ovDns: 'DNS',
  ovNotes: 'Нотатки',
  ovRequestStart: 'Початок запиту',
  ovTotal: 'Усього',
  secTls: 'TLS',
  secTiming: 'Час виконання',
  secSize: 'Розмір',
  viewUrlTitle: 'Переглянути URL і параметри запиту',
  tagsMitmDecrypted: 'MITM · Розшифровано',
  protocolHttpsDecrypted: 'HTTPS (розшифровано через проксі MITM Roku Dev Studio)',
  protocolHttpsEncrypted: 'HTTPS (зашифровано)',
  notesProxied: 'Запит через проксі — вихідний TLS завершено в Roku Dev Studio',
  notesHotspot: 'Захоплення через точку доступу — тіла недоступні без MITM',
  typeHttpsTlsHandshake: 'HTTPS (рукостискання TLS)',
  unknownHost: 'невідомий-хост',
  dnsQueryValue: (host: string): string => `Запит ${host}`,
  dnsBody: (isQuery: boolean, host: string): string => `DNS ${isQuery ? 'запит' : 'відповідь'}: ${host}`,
  httpsRequestFallback: (host: string, port: string): string =>
    `CONNECT ${host}${port} (HTTPS — зашифровано)\n\nЗахоплення через точку доступу бачить лише рукостискання TLS (SNI + IP), а не тіла JSON.\n\nУвімкніть MITM у Налаштуваннях і спрямуйте канал через Roku Dev Studio, щоб перевіряти тіла.`,

  // ── Embedded JSON/XML fragment highlight (network-embedded-structured.ts) ────────────
  embeddedViewTitle: (label: string): string => `Натисніть, щоб переглянути відформатований ${label} (відкриється у модальному вікні)`,

  // ── Hotspot Capture Setup modal (hotspot-setup-modal.ts) ─────────────────────────────
  setupPacketCapture: 'Налаштувати захоплення пакетів',
  requestingCaptureAccess: 'Запит доступу до захоплення…',
  captureAccessGranted: 'Доступ до захоплення надано.',
  setupCancelled: 'Налаштування скасовано.',
  setupFailed: 'Не вдалося виконати налаштування.',
  setupFailedRetry: 'Не вдалося виконати налаштування — спробуйте ще раз.',

  // ── Filter-syntax help modal (network-filter-help.ts) ────────────────────────────────
  filterHelpHeading: 'Фільтрування сеансів',
  filterHelpAria: 'Довідка з фільтрування',
  addToFilter: 'Додати до фільтра',
  filterDescHost: 'Збіг за іменем хоста (підрядок).',
  filterDescMethod: 'Метод HTTP.',
  filterDescStatus: 'Код статусу або клас, наприклад 4xx / 5xx.',
  filterDescType: 'Content-Type відповіді (псевдонім content-type:).',
  filterDescKind: 'Вид сеансу.',
  filterDescPath: 'Шлях URL (підрядок; псевдонім url:).',
  filterHelpIntro:
    'Введіть довільний текст для збігу за хостом, шляхом, методом, статусом, видом або Content-Type. Використовуйте <code>field:value</code> для точних збігів і розділяйте терміни <strong>комами</strong>, щоб знайти <strong>будь-який</strong> із них (OR).',
  filterHelpNoteLead: 'Приклад: ',
  filterHelpNoteExplain:
    ' показує будь-який сеанс на roku.com <em>або</em> зі статусом 4xx <em>або</em> з використанням POST. Натисніть будь-який приклад, щоб додати його.',

  // ── Port-conflict modal (port-conflict-modal.ts) ─────────────────────────────────────
  holderAnotherApp: 'Інша програма',
  holderWithPid: (name: string, pid: number): string => `${name} (PID ${pid})`,
  holderPidOnly: (pid: number): string => `PID ${pid}`,
  portResolvedTitle: 'Порт проксі доступний',
  portResolvedMsg:
    'Порт проксі знову вільний — Інспектор мережі може захоплювати трафік. Це повідомлення закриється автоматично.',
  recheckStatus: 'Перевірити статус знову',
  openNetworkInspectorSettings: 'Відкрити налаштування Інспектор мережі',

  // ── Traffic-rules modal (traffic-rules-modal.ts) ─────────────────────────────────────
  trafficRules: 'Правила трафіку',
  deviceFallbackName: 'Пристрій Roku',
  serialTitle: (serial: string): string => `Серійний номер ${serial}`,
  rulesNote:
    'Застосовується лише до трафіку, який цей пристрій спрямовує через проксі Roku Dev Studio — інший (без проксі) трафік не зачіпається. Зміни набувають чинності негайно.',
  deviceTrafficTitle: 'Трафік пристрою',
  blockAllTitle: 'Блокувати весь проксі-трафік',
  blockAllDesc: 'Відхиляти кожен запит, спрямований через проксі.',
  bandwidthLimit: 'Обмеження пропускної здатності',
  addedLatency: 'Додана затримка',
  addedLatencyMsTitle: 'Додана затримка (ms)',
  hostsBlockedNote: 'Правила для окремих хостів не діють, поки заблоковано весь проксі-трафік.',
  perHostRules: 'Правила для окремих хостів',
  addHostTitle:
    'Хост або хост/шлях. Використовуйте * як символ підстановки (наприклад, *.example.com відповідає prod + staging, /v1/* відповідає будь-якому шляху в межах /v1/).',
  noRulesYet: 'Правил поки немає — додайте хост або шлях вище, щоб змінити його поведінку.',
  saveChanges: 'Зберегти зміни',
  restartToSave: 'Перезапустіть Roku Dev Studio, щоб увімкнути збереження Правил трафіку.',
  failedSaveRules: 'Не вдалося зберегти Правила трафіку.',
  // Rewrite op type labels (dropdown options).
  rwRedirectHost: 'Перенаправити хост',
  rwSetPath: 'Установити шлях',
  rwSetQuery: 'Установити параметр запиту',
  rwRemoveQuery: 'Вилучити параметр запиту',
  rwSetHeader: 'Установити заголовок',
  rwRemoveHeader: 'Вилучити заголовок',
  rwBodyReplace: 'Замінити в тілі',
  rwSetStatus: 'Установити статус',
  // Rewrite op field placeholders.
  rwHeaderName: 'Ім’я заголовка',
  rwValue: 'Значення',
  rwStatusCode: 'Код статусу (наприклад, 503)',
  rwHostOrHostPort: 'host або host:port',
  rwNewPath: '/new/path',
  rwParamName: 'Ім’я параметра',
  rwFind: 'Знайти',
  rwReplaceWith: 'Замінити на',
  // Rewrite op row chrome.
  rewriteTargetAria: 'Ціль перезапису',
  rewriteTypeAria: 'Тип перезапису',
  regexTreatTitle: 'Вважати «Знайти» регулярним виразом',
  regexLabel: 'Regex',
  removeRewrite: 'Вилучити перезапис',
  rewriteTitle: 'Перезапис',
  rewriteHint: 'Застосовується під час пересилання (не з Блокувати / Скинути / Імітувати)',
  addRewrite: '+ Додати перезапис',
  // Per-host rule scope badges.
  scopeWildcardPath: 'Шлях із підстановкою',
  scopeSinglePath: 'Окремий шлях',
  scopeWildcardHost: 'Хост із підстановкою',
  scopeAllRequests: 'Усі запити',
  // Per-host rule controls.
  collapseExpandRule: 'Згорнути / розгорнути правило',
  editUrl: 'Редагувати URL',
  editInterceptUrlAria: 'Редагувати URL перехоплення',
  deleteRule: 'Видалити правило',
  block: 'Блокувати',
  resetTitle: 'Розірвати з’єднання (імітувати збій мережі)',
  mock: 'Імітувати',
  mockTitle: 'Повертати заготовлену відповідь замість пересилання на вихідний сервер',
  latencyPlaceholder: 'Затримка',
  mockFieldStatus: 'Статус',
  mockFieldContentType: 'Content-Type',
  mockFieldDelay: 'Затримка',
  httpStatusCodeTitle: 'Код статусу HTTP',
  delayTitle: 'Затримка перед відповіддю (ms)',
  mockBodyPlaceholder: 'Тіло відповіді (наприклад, {&quot;error&quot;:&quot;forced&quot;})',
  // Bandwidth preset/label/placeholder for the "no cap" option (kbps 0). The other presets
  // ('8 Mbps', '512 kbps', …) are units and stay verbatim in BW_OPTIONS. NOTE: parseBandwidth()
  // still matches the lowercased literal 'unlimited', so keep this word round-trippable.
  bandwidthUnlimited: 'Необмежено',
  bwCustomTitle: 'Виберіть пресет або введіть власне обмеження (наприклад, 3 Mbps або 1500 kbps)',
  bwPresetsAria: 'Показати пресети пропускної здатності',
  throttleCapSpeed: (limit: string): string => `швидкість обмежено до Ліміту пристрою (${limit})`,
  throttleFloorLatency: (ms: number): string => `затримка не менша за Затримку пристрою (${ms} ms)`,
  throttleNote: (parts: string[]): string => `Для окремого хоста ${parts.join(', а також ')}.`,

  // ── Find-in-content modal (network-find-modal.ts) ────────────────────────────────────
  chipUrl: 'URL',
  chipRequest: 'Тіло запиту',
  chipResponse: 'Тіло відповіді',
  chipHeaders: 'Заголовки',
  chipUrlTitle: 'URL запиту, ім’я хоста та SNI',
  chipRequestTitle: 'Корисне навантаження запиту',
  chipResponseTitle: 'Корисне навантаження відповіді',
  chipHeadersTitle: 'Заголовки запиту та відповіді',
  noMatches: 'Немає збігів',
  requestCount: (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      mod10 === 1 && mod100 !== 11
        ? 'запит'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'запити'
          : 'запитів';
    return `${n} ${word}`;
  },
  hitCount: (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      mod10 === 1 && mod100 !== 11
        ? 'збіг'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'збіги'
          : 'збігів';
    return ` · ${n} ${word}`;
  },
  setColorAria: (c: string): string => `Установити колір ${c}`,
  customColorTitle: 'Власний колір…',
  customColorAria: 'Власний колір',
  hexColorAria: 'Шістнадцятковий колір',
  changeColorTitle: 'Змінити колір',
  changeColorAria: 'Змінити колір терміна',
  findPlaceholder: 'Знайти',
  searchTermAria: 'Пошуковий термін',
  clearText: 'Очистити текст',
  matchCase: 'Враховувати регістр',
  useRegexTitle: 'Використовувати регулярний вираз',
  deleteSearchEntry: 'Видалити елемент пошуку',
  regexLikeHint: 'Це схоже на регулярний вираз.',
  useRegexBtn: 'Використати regex',
  findAriaLabel: 'Знайти в мережевому трафіку',
  findTitle: 'Знайти у трафіку',
  closeEsc: 'Закрити (Esc)',
  addSearchEntryTitle: 'Додати ще один елемент пошуку',
  addSearchEntry: '+ Шукати більше…',
  noteColor: 'Кожен термін отримує колір; запит показує колір кожного терміна, що збігається.',
  noteWhitespace: 'Пробіли ігноруються — збігаються як мініфіковані, так і відформатовані тіла.',
  noteBinary: 'Двійкові тіла (base64) не шукаються.',
  noteEnter: 'Натисніть <kbd>Enter</kbd>, щоб перейти до першого збігу та закрити.',
  noteShiftEnter: (max: number): string =>
    `<kbd>Shift</kbd>+<kbd>Enter</kbd> додає ще один термін (до ${max}).`,
  noteArrows: '<kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> (або стрілки в заголовку) переміщують між збігами.',

  // ── Live tab (network-tab.ts) ────────────────────────────────────────────────────────
  capNotice: (shown: number, total: number): string =>
    `Показано останні ${shown} з ${total} сеансів — скористайтеся фільтром, щоб звузити результати.`,
  loadingData: 'Завантаження захоплених даних…',
  // Large-body "shown as raw text" explainer modal.
  shownAsRawText: 'Показано як необроблений текст',
  thisBody: 'Це тіло',
  largeBodyIntro: (sizeLabel: string, limitKb: string): string =>
    `Це тіло має розмір <strong>${sizeLabel}</strong> — більше за ліміт ${limitKb} KB для відображення згортуваного дерева JSON/XML з підсвічуванням синтаксису. Щоб інспектор залишався чутливим, замість цього <strong>усе</strong> тіло показано як необроблений текст. Нічого не скорочено й не приховано.`,
  largeBodyNote:
    'Копіювати, Зберегти та Знайти й далі працюють з повним тілом. Вбудовані фрагменти JSON/XML залишаються клікабельними. Виберіть меншу відповідь, щоб побачити відформатоване дерево.',
  // Empty-state hints.
  noProxiedSessions: 'Проксі-сеансів поки немає.',
  noSessions: 'Сеансів поки немає.',
  proxyAddrFallback: 'machine-ip:8888',
  gatewayAddrFallback: 'gateway:8888',
  anotherApp: 'інша програма',
  mitmActiveLine: (addr: string): string =>
    `Проксі MITM активний за адресою <strong>${addr}</strong> — спрямуйте запити свого каналу Dev через нього, щоб захопити їх.`,
  mitmPortConflictLine: (port: number, who: string): string =>
    `Проксі MITM не може використовувати порт ${port} — його використовує ${who}. Натисніть <strong>Порт проксі недоступний</strong> вище, щоб закрити його або змінити порт.`,
  mitmFailedLine: (err: string): string => `Не вдалося запустити проксі MITM: ${err}.`,
  mitmStarting: 'Проксі MITM запускається — перезапустіть Roku Dev Studio, якщо це триває.',
  enableMitmSettings: 'Увімкніть <strong>проксі MITM</strong> у Налаштування → Інспектор мережі.',
  hotspotBlockedMitmLine: (addr: string): string =>
    `Захоплення через точку доступу заблоковано, але проксі MITM за адресою <strong>${addr}</strong> усе одно може записувати проксі-запити. Використовуйте <code>host:port</code> лише в BrightScript (наприклад, <code>192.168.2.1:8888</code>), а не IP пристрою й не <code>http://</code>.`,
  mitmActiveNoCaptureLine: (addr: string): string =>
    `Проксі MITM активний за адресою <code class="ni-hint-code">${addr}</code>. Спрямуйте свій канал dev через нього, щоб захоплювати мережеві запити.`,
  mitmDecryptingHint: ' Проксі MITM розшифровує HTTPS каналу dev, спрямований через Roku Dev Studio.',
  hotspotEncryptedHint: ' Тіла HTTPS зашифровані в режимі захоплення через точку доступу — увімкніть MITM у Налаштуваннях для каналів Dev.',
  capturingOnHotspot: 'Захоплення через точку доступу. Переглядайте або відтворюйте вміст на Roku.',
  connectWifiHint:
    'Підключіть Roku до тієї самої мережі Wi‑Fi (або точки доступу вашого комп’ютера), потім увімкніть <strong>проксі MITM</strong> у Налаштування → Інспектор мережі, щоб захоплювати HTTPS каналу dev.',
  sessionListAria: 'Список мережевих сеансів. Використовуйте клавіші зі стрілками для навігації.',
  // Layout toggle.
  layoutToggleTitle: (stacked: boolean): string =>
    `Панелі запиту та відповіді - ${stacked ? 'Поруч' : 'Розташувати вертикально'}`,
  // "Proxied" filter tooltips.
  proxiedLockedTitle:
    'У цьому режимі весь трафік проходить через проксі Roku Dev Studio, тому це завжди ввімкнено. Цей елемент керування стане доступним, коли пристрій Roku буде підключено через точку доступу.',
  proxiedUnlockedTitle:
    'Показувати лише запити, що пройшли через проксі Roku Dev Studio (повні заголовки + тіло), приховуючи метадані SNI/DNS із захоплення через точку доступу',
  // Media context menu + save dialogs.
  copyImage: 'Копіювати зображення',
  saveImageAs: 'Зберегти зображення як…',
  saveFile: 'Зберегти файл…',
  saveImageDialog: 'Зберегти зображення',
  saveFileDialog: 'Зберегти файл',
  // Export toasts + dialogs.
  fileFallback: 'файл',
  savedPackets: (n: number, path: string): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      mod10 === 1 && mod100 !== 11
        ? 'пакет'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'пакети'
          : 'пакетів';
    return `Збережено ${n} ${word} до ${path}.`;
  },
  failedSavePcap: 'Не вдалося зберегти захоплення пакетів.',
  noRequestsToExport: 'Немає запитів для експорту.',
  noHttpToExport: 'Немає транзакцій HTTP для експорту як HAR.',
  exportHarDialog: 'Експортувати сеанси як HAR',
  exportSessionDialog: 'Експортувати мережевий сеанс',
  // Native save-dialog titles + filter names (main/ipc/network-inspector-handlers.ts).
  exportDialogTitles: {
    savePcap: 'Зберегти захоплення пакетів',
    pcapFilter: 'Wireshark PCAP',
    caPem: 'Експортувати сертифікат CA RDS (PEM)',
    pemFilter: 'Сертифікат PEM',
    caCrt: 'Експортувати сертифікат CA RDS (CRT)',
    certFilter: 'Сертифікат'
  },
  exportedRequests: (n: number, path: string): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      mod10 === 1 && mod100 !== 11
        ? 'запит'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'запити'
          : 'запитів';
    return `Експортовано ${n} ${word} до ${path}.`;
  },
  failedExportSession: 'Не вдалося експортувати сеанс.',
  // Session count tooltips.
  countMatchingTitle: (visible: number, captured: number): string =>
    `${visible} відповідних із ${captured} захоплених сеансів`,
  capturedSessionsTitle: (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      mod10 === 1 && mod100 !== 11
        ? 'захоплений сеанс'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'захоплені сеанси'
          : 'захоплених сеансів';
    return `${n} ${word}`;
  },
  // Capture-button "blocked" tooltips.
  issuePortInUse: (port: number, who: string): string =>
    `Інспектор мережі недоступний — порт ${port} використовується${who}.`,
  issueMitm: (err: string): string => `Проблема Інспектор мережі — проксі MITM: ${err}`,
  captureErrorFallback: 'Помилка Інспектор мережі',
  stopCapturing: 'Зупинити захоплення',
  startCapturing: 'Почати захоплення',
  setupNotAvailable: 'Налаштування недоступне в цій збірці.',
  // Header setup badge.
  captureBlocked: 'Захоплення заблоковано',
  captureSetup: 'Налаштування захоплення',
  setupBadgeTitlePrereq: (title: string): string => `${title} — натисніть для інструкцій з налаштування`,
  setupBadgeTitle: 'Налаштування захоплення через точку доступу — натисніть для інструкцій',
  // Header port badge.
  portBadgeTitle: (title: string): string => `${title} — натисніть для деталей`,

  // ══ Network Inspector additions ═══════════════════════════════════════════════
  // Copy URL action (network-detail-view.ts copy menu).
  copyUrl: 'Копіювати URL',

  // Traffic-rule presets — device-wide toggles (traffic-rules-modal.ts).
  noCachingTitle: 'Без кешування',
  noCachingDesc: 'Видаляти заголовки кешування та примусово встановлювати Cache-Control: no-store у відповідях.',
  blockCookiesTitle: 'Блокувати Cookie',
  blockCookiesDesc: 'Видаляти Cookie із запитів і Set-Cookie з відповідей.',

  // Parsed detail viewers — Cookies tabs (network-detail.ts, network-parsed-tables.ts).
  tabCookies: 'Cookie',
  colName: 'Ім’я',
  colValue: 'Значення',
  colAttributes: 'Атрибути',
  noResponseCookies: 'Ця відповідь не встановлює cookie.',

  // Editable per-request note (network-detail.ts Overview + list marker).
  secNote: 'Нотатка',
  notePlaceholder: 'Додати нотатку…',
  noteAriaLabel: 'Нотатка для цього запиту',
  noteMarkerAria: 'Має нотатку',

  // Map Local — file-backed mock response (traffic-rules-modal.ts + proxy).
  mockFieldFile: 'Локальний файл',
  mockChooseFile: 'Вибрати файл…',
  mockFilePlaceholder: 'Файл не вибрано',
  mockFileClearAria: 'Очистити зіставлений файл',
  mockFileServingBody: 'Тіло відповіді надається із зіставленого файлу.',
  mapLocalHint:
    'Надавати локальний файл як тіло відповіді. Content-Type визначається за розширенням файлу, якщо не встановлено вище.',
  mapLocalDialogTitle: 'Виберіть файл для надання',
  mapLocalAllFilesFilter: 'Усі файли',

  // Focus hosts (network-session-view.ts + sidebar toggles).
  focusHost: (host: string): string => `Фокус на ${host}`,
  unfocusHost: (host: string): string => `Прибрати фокус з ${host}`,
  clearFocusedHosts: 'Очистити сфокусовані хости',

  // Replay / Compose (network-detail-view.ts action + network-compose-modal.ts).
  replay: 'Повторити',
  replayTitle: 'Повторити цей запит з хоста',
  replayAria: 'Повторити запит',
  moreReplayOptions: 'Більше параметрів повтору',
  replayNow: 'Повторити зараз',
  composeItem: 'Редагувати та надіслати знову…',
  composeTitle: 'Редагувати та надіслати знову',
  composeNote: 'Повторно надіслати цей запит з хоста. Відредагуйте метод, URL, заголовки або тіло перед надсиланням.',
  composeMethodLabel: 'Метод',
  composeUrlLabel: 'URL',
  composeParamsLabel: 'Параметри запиту',
  composeAddRow: '+ Додати',
  composeRowEnabledAria: 'Включити цей запис',
  composeSelectAllAria: 'Перемкнути всі записи',
  composeHeadersLabel: 'Заголовки',
  composeBodyLabel: 'Тіло',
  composeBodyPlaceholder: 'Тіло запиту',
  composeBinaryBodyNote:
    'Захоплене тіло запиту двійкове й надсилається без змін; його не можна редагувати тут.',
  composeApplyRules: 'Застосувати активні правила трафіку',
  composeApplyRulesTitle: 'Пропустити повтор через правила блокування, перезапису та обмеження цього пристрою',
  composeSend: 'Надіслати',
  composeSending: 'Надсилання…',
  replayAddedToList: 'Відповідь додано до списку сеансів.',
  replayFailed: (err: string): string => `Не вдалося повторити: ${err}`,
  replayInvalidUrl: 'Введіть дійсний URL http:// або https://.',
  replayUnavailable: 'Повтор недоступний у цій збірці.',
  replayStarting: 'Повторення…',
  tagsReplayed: 'Повторено',
  replayedBadgeTitle: 'Цю відповідь отримано повторенням захопленого запиту з хоста',

  // Timing waterfall (network-detail.ts Overview timing section).
  ovDuration: 'Тривалість',
  wfDns: 'DNS',
  wfConnect: 'Підключення',
  wfTls: 'TLS',
  wfSend: 'Надсилання',
  wfWait: 'Очікування (TTFB)',
  wfReceive: 'Завантаження',
  wfMs: (n: number): string => `${n} ms`,
  wfSeconds: (s: number): string => `${s.toFixed(2)} с`,
  wfSegmentTitle: (label: string, value: string): string => `${label}: ${value}`,
  wfAria: 'Розподіл часу запиту'
};

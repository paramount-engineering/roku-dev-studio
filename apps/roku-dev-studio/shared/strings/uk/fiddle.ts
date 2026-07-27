/**
 * Ukrainian (uk) translation of the BrightScript Fiddle window strings.
 * Sibling of ../fiddle.ts — same `fiddle` shape, keys, order, and function
 * signatures. Count-driven text uses the Ukrainian 3-form plural. Only literal
 * display text is translated.
 */
export const fiddle = {
  // Device dropdown
  selectDevice: 'Виберіть пристрій',
  noDevices: 'Не знайдено пристроїв із увімкненим режимом розробника',
  deviceFallbackName: 'Roku',
  remotePrefix: '[Віддалений] ',

  // Diagnostics status chip (bottom of the editor)
  noIssues: 'Немає проблем',
  diagWarnings: (warnCount: number): string => {
    const word =
      warnCount % 10 === 1 && warnCount % 100 !== 11 ? 'попередження' :
      warnCount % 10 >= 2 && warnCount % 10 <= 4 && !(warnCount % 100 >= 12 && warnCount % 100 <= 14) ? 'попередження' :
      'попереджень';
    return `${warnCount} ${word}`;
  },
  diagErrors: (errCount: number, warnCount: number): string => {
    const errWord =
      errCount % 10 === 1 && errCount % 100 !== 11 ? 'помилка' :
      errCount % 10 >= 2 && errCount % 10 <= 4 && !(errCount % 100 >= 12 && errCount % 100 <= 14) ? 'помилки' :
      'помилок';
    const warnWord =
      warnCount % 10 === 1 && warnCount % 100 !== 11 ? 'попередження' :
      warnCount % 10 >= 2 && warnCount % 10 <= 4 && !(warnCount % 100 >= 12 && warnCount % 100 <= 14) ? 'попередження' :
      'попереджень';
    return `${errCount} ${errWord}${warnCount ? `, ${warnCount} ${warnWord}` : ''}`;
  },

  // Password modal
  passwordRequired: 'Потрібен пароль.',

  // Run / Stop status line
  selectDeviceFirst: 'Спочатку виберіть пристрій.',
  deviceUnavailable: 'Вибраний пристрій більше недоступний.',
  runCancelledPassword: 'Запуск скасовано — потрібен пароль.',
  running: 'Виконання...',
  runFailed: 'Не вдалося виконати.',
  runFailedWith: (msg: string): string => `Не вдалося виконати: ${msg}`,
  sideloadWaiting: 'Завантаження завершено — очікування виводу…',
  runningOnDevice: 'Виконання на пристрої…',
  runComplete: 'Виконання завершено.',
  editorReset: 'Редактор скинуто до типового Snippet.',
  uninstalling: 'Видалення...',
  channelRemoved: 'Канал BrightScript Fiddle видалено.',
  stopFailed: 'Не вдалося зупинити.',
  ready: 'Готово.',

  // Reset-code confirm
  resetConfirm: 'Скинути редактор до типового Snippet? Незбережені зміни буде втрачено.',

  // Editor bootstrap status
  loadingEditor: 'Завантаження редактора...',
  editorFailedToLoad: (msg: string): string => `Не вдалося завантажити редактор: ${msg}`,

  // Monaco command-palette / context-menu action
  runOnDevice: 'Виконати на пристрої',

  // Static fiddle.html shell — header, device picker, panes, status row
  heading: 'BrightScript Fiddle',
  subtitle: 'Виконайте швидкий фрагмент BrightScript на будь-якому підключеному пристрої.',
  deviceLabel: 'Пристрій',
  scanForDevices: 'Шукати пристрої',
  runBtn: 'Виконати',
  runBtnTitle: 'Виконати (⌘/Ctrl+Enter)',
  stopBtn: 'Зупинити',
  stopBtnTitle: 'Видалити канал Fiddle',
  codeLabel: 'Код',
  resetSnippetTitle: 'Скинути до типового Snippet',
  resetSnippetAria: 'Скинути редактор до типового Snippet',
  terminalLabel: 'Термінал',
  clearTerminal: 'Очистити термінал',
  statusRowCaption: 'Виконання замінює канал, наразі завантажений на вибраному пристрої.',

  // Developer-password modal
  passwordModalTitle: 'Потрібен пароль розробника',
  passwordModalHint:
    'Для завантаження потрібен пароль розробника пристрою — той, який ви встановили під час увімкнення режиму розробника.',
  passwordLabel: 'Пароль',
  passwordPlaceholder: 'Введіть пароль розробника',
  passwordModalHintMuted:
    'Цей пароль використовується лише для цього сеансу. Щоб зберегти його для подальшого використання, перевірте режим розробника в головному вікні.',
  passwordSubmitBtn: 'Зберегти та виконати',

  /**
   * Monaco editor's initial value + the target of "Reset to default Snippet".
   * The two leading `'` comment lines are user-facing guidance; the BrightScript
   * keywords/identifiers (`Sub`, `End Sub`, `print`, `userFiddle`, `init`) and the
   * example `print` output are code tokens kept verbatim. Composed via the same
   * newline join as the source so the editor value is byte-for-byte identical.
   */
  defaultSnippet: [
    "' `userFiddle` — це точка входу, яку Fiddle запускає після появи каналу на екрані.",
    "' Розмістіть свій фрагмент тут — ви також можете визначити допоміжні sub/функції нижче та викликати їх з userFiddle. НЕ визначайте sub з іменем `init` — цей ідентифікатор зарезервовано сценою Fiddle.",
    'Sub userFiddle()',
    '    print "Hello from Roku Dev Studio Fiddle"',
    'End Sub',
    ''
  ].join('\n'),

  // ── Main-process diagnostics + run/stop errors (main/ipc/bs-fiddle-handlers.ts) ──
  // Surfaced in the Fiddle UI (Monaco markers or the status line). Code literals
  // (`init`, `userFiddle`) are kept verbatim.
  lintReservedInit:
    'Ім’я `init` зарезервовано сценою Fiddle. Перейменуйте цей sub на `userFiddle` — Fiddle автоматично викличе `userFiddle()`, щойно сцена з’явиться на екрані.',
  errWindowUnavailable: 'Вікно Fiddle більше недоступне.',
  errDeviceDisconnected: 'Вибраний пристрій більше не підключено.',
  errNoPasswordProvided: 'Пароль розробника не надано.',
  errNoPasswordAvailable: 'Для цього пристрою немає доступного пароля розробника.',
  errPackageFailed: (detail: string): string => `Не вдалося запакувати фрагмент: ${detail}`,
  errRemoteMissingServerUrl: 'У віддаленого пристрою відсутня URL-адреса relay-сервера — неможливо транслювати журнали telnet.',
  errSideloadFailed: 'Не вдалося завантажити',
  errDeviceNotFound: 'Пристрій не знайдено.',
  errNotFiddleChannel:
    'Наразі встановлений dev-канал не є каналом Fiddle — його залишено без змін, щоб ваша власна програма не була видалена.',

  // humanizeRemoteUploadError prose (remote relay upload failures)
  errRemoteUnknown: 'Невідома помилка від віддаленого relay-сервера.',
  errRemoteNetworkBlip:
    'Збій мережі між relay-сервером і Roku (розірваний канал). ' +
    'Зазвичай це вирішується після повторної спроби — якщо повторюється, перевірте, чи relay-хост ' +
    'може дістатися до пристрою по локальній мережі та чи Roku не зайнятий.',
  errRemoteCurl: (detail: string): string => `Помилка curl віддаленого relay: ${detail}`,
};

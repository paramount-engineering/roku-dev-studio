/**
 * Ukrainian (uk) translation of the Sideload Relay settings section +
 * device-setup modal strings. Sibling of ../sideload-relay.ts — same
 * `sideloadRelay` shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Ukrainian
 * count-driven text uses the 3-form plural. Only literal display text is
 * translated.
 */
export const sideloadRelay = {
  // Enable gate
  gateTitle: 'Щоб увімкнути Sideload Relay:',
  gateNeedPassword: 'Встановіть пароль розробника Relay, щоб ваша IDE могла автентифікуватися з RDS.',
  gateNeedDevice: 'Виберіть щонайменше один доступний пристрій — відкрийте «Налаштувати пристрої» та увімкніть пристрій, який онлайн.',

  // Targeted Devices summary row
  targetSummaryEmpty: 'Ще не вибрано жодного пристрою. Натисніть «Налаштувати пристрої», щоб вибрати, які Roku отримуватимуть кожну збірку.',
  targetSummaryChecking: (n: number): string => {
    const word =
      n % 10 === 1 && n % 100 !== 11 ? 'пристрій' :
      n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'пристрої' :
      'пристроїв';
    return `${n} ${word} вибрано · перевірка доступності…`;
  },
  targetSummaryReachable: (reachable: number): string => `${reachable} увімкнено та доступно`,
  targetSummaryOfflineSuffix: (offline: number): string => ` · ${offline} офлайн (пропущено до відновлення доступності)`,

  // Toggle rows + password field
  enableTitle: 'Увімкнути Sideload Relay',
  enableDesc: 'Оголошувати RDS як Roku через SSDP і приймати сайдлоади. Вимкнено за замовчуванням.',
  passwordTitle: 'Пароль розробника Relay',
  passwordDesc: 'Пароль, з яким автентифікується ваша IDE (користувач rokudev). Порожнє поле зберігає збережений.',
  autoConsoleTitle: 'Автоматично підключати консоль',
  autoConsoleDesc: 'Відкривати консоль telnet 8085 на кожному пристрої після встановлення.',
  retryTitle: 'Повторити один раз у разі помилки',
  retryDesc: 'Повторити невдале встановлення один раз, перш ніж повідомляти про нього.',
  targetedDevicesTitle: 'Вибрані пристрої',
  setupDevicesBtn: 'Налаштувати пристрої',
  targetSummaryLoading: 'Завантаження…',

  // Setup modal
  modalTitle: 'Налаштувати пристрої Sideload Relay',
  modalSubtitle:
    'Увімкнені та доступні пристрої отримують кожну збірку, яку ви завантажуєте через RDS. Раніше вибрані пристрої, які офлайн, залишаються у списку (вимкненими) і автоматично повертаються, коли знову стають доступними.',
  scanBtn: 'Сканувати пристрої',
  scanning: 'Сканування…',
  colLocation: 'Розташування',
  colDevice: 'Пристрій',
  colIpSerial: 'IP і серійний номер',
  colEnabled: 'Увімкнено',
  colReachable: 'Доступно',
  emptyDevices: 'Пристроїв не знайдено. Переконайтеся, що ваші Roku увімкнені та в режимі розробника, потім скануйте повторно.',
  locRemote: 'Віддалений',
  locLocal: 'Локальний',

  // Per-device password affordance
  setPasswordBtn: '🔒 Встановити пароль',
  setPasswordTitle: 'Введіть і перевірте пароль розробника, щоб увімкнути цей пристрій',
  enableAriaLabel: (name: string): string => `Увімкнути ${name}`,
  reachableNow: 'Зараз доступний',
  reachableOk: '✓',
  reachableOff: '○ офлайн',
  reachableOffTitle: 'Недоступний — пропущено, доки не повернеться в мережу',

  // Inline password editor
  pwInputPlaceholder: 'Пароль розробника',
  pwInputAriaLabel: (name: string): string => `Пароль розробника для ${name}`,
  pwValidateTitle: (name: string): string => `Перевірити та увімкнути ${name}`,
  pwValidateAriaLabel: 'Перевірити пароль',
  pwValidateChar: '✓',
  pwEnterPassword: 'Введіть пароль',
  pwWrong: 'Неправильний пароль',
  pwUnreachable: 'Недоступний',

  // Modal summary
  modalSummary: (enabledReachable: number, reachableTotal: number): string =>
    `${enabledReachable} увімкнено та доступно з ${reachableTotal} онлайн`,
  modalSummaryOfflineSuffix: (offline: number): string => ` · ${offline} офлайн збережено`,

  // Scan status
  scanFound: (local: number, remote: number, total: number): string => {
    const word =
      total % 10 === 1 && total % 100 !== 11 ? 'пристрій' :
      total % 10 >= 2 && total % 10 <= 4 && !(total % 100 >= 12 && total % 100 <= 14) ? 'пристрої' :
      'пристроїв';
    return `Знайдено ${local} локальних${remote ? ` · ${remote} віддалених` : ''} dev-${word}.`;
  },
  scanFailed: 'Сканування не вдалося.',

  // Save status
  saved: 'Налаштування Sideload Relay збережено.',
  saveFailed: 'Не вдалося зберегти',
  fixBeforeEnable: 'Виправте елементи вище, перш ніж вмикати Sideload Relay.',

  // Password reveal aria/title
  showPassword: 'Показати пароль',
  hidePassword: 'Приховати пароль',

  // Saved-password placeholder hint
  savedPasswordPlaceholder: '•••••••• (збережено)',

  // ── Native allow/deny prompt on the host (main/sideload-relay/index.ts) ──
  authorizeTitle: 'Sideload Relay',
  authorizeAllow: 'Дозволити',
  authorizeDeny: 'Відхилити',
  authorizeMessage: (who: string): string => `Дозволити сайдлоад від ${who}?`,
  authorizeDetail:
    'Інший пристрій у вашій мережі намагається встановити збірку через Roku Dev Studio. ' +
    'Дозволяйте, лише якщо ви впізнаєте цей пристрій.',

  // ── Relay dev-password validate / reveal + settings-save errors (main/ipc/relay-handlers.ts) ──
  errDeviceIpPasswordRequired: 'Потрібні IP-адреса пристрою та пароль.',
  errIncorrectPassword: 'Неправильний пароль розробника.',
  errValidationFailed: 'Перевірку не пройдено.',
  errCouldNotReadPassword: 'Не вдалося прочитати збережений пароль.',
  errCouldNotWriteSettings: 'Не вдалося записати файл налаштувань.',
};

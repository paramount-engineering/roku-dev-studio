/**
 * Ukrainian (uk) translation of the Dev App panel strings.
 * Sibling of ../dev-app.ts — same `devApp` shape, keys, order, and function
 * signatures. Only literal display text is translated.
 */
export const devApp = {
  // ── Password auth (password-auth.ts) ──────────────────────────────────────
  authenticated: 'Автентифіковано',
  notAuthenticated: 'Не автентифіковано',
  verify: 'Перевірити',
  enterDeveloperPassword: 'Введіть пароль розробника.',
  verificationNoResponse: 'Не вдалося перевірити — немає відповіді від Dev App.',

  // ── Quick remote (quick-remote.ts) ────────────────────────────────────────
  sendText: 'Надіслати текст',
  sending: 'Надсилання...',

  // ── Screenshots (screenshots.ts) ──────────────────────────────────────────
  captureDisabledTitle: 'Запустіть завантажений Dev App на пристрої, щоб зробити знімок екрана.',
  launchBeforeCapture: 'Запустіть Dev App на пристрої, перш ніж робити знімок екрана.',
  capturing: 'Захоплення...',
  capture: 'Зробити знімок',
  copiedTitle: 'Скопійовано!',
  copyScreenshot: 'Копіювати знімок екрана',
  saveScreenshotAs: 'Зберегти знімок екрана як…',
  clearScreenshot: 'Очистити знімок екрана',
  copiedToClipboard: '✓ Скопійовано в буфер обміну',
  savedTo: (filePath: string): string => `✓ Збережено у: ${filePath}`,
  failedToCopy: (detail: string): string => `Не вдалося скопіювати: ${detail}`,
  couldNotGetCanvasContext: 'Не вдалося отримати контекст полотна',
  couldNotEncodeScreenshot: 'Не вдалося закодувати знімок екрана',

  // ── Sideloaded app card (sideloaded-app.ts) ───────────────────────────────
  versionLabel: 'Версія:',
  unknown: 'Невідомо',
  noChannelSideloaded: 'Наразі не завантажено жодного каналу',
  launching: 'Запуск',
  launch: 'Запустити',

  // ── Sideloading (sideloading.ts) ──────────────────────────────────────────
  dragDropUnavailable: 'Перетягування недоступне в цій збірці',
  selectFileAndPassword: 'Виберіть файл і введіть пароль розробника',
  installing: 'Встановлення...',
  install: 'Встановити',
  unknownError: 'Невідома помилка',
  deleteSideloadedChannelConfirm: 'Видалити завантажений канал?',

  // Shared between screenshots + sideloading
  pleaseEnterDeveloperPassword: 'Введіть пароль розробника',

  // ── Channel performance parse messages (remote-metrics-charts.ts) ─────────
  channelPerfUnavailable: (err: string): string => `Продуктивність каналу недоступна: ${err}`,
  channelPerfUnavailableFailed: 'Продуктивність каналу недоступна (статус: помилка).',
  chartAxisNow: 'зараз',

  // ── Device Performance Action Script capture (device-metrics-performance-step.ts) ──
  captionCpuGraph: 'Використання CPU (графік)',
  captionCpuProcess: 'Використання CPU (процес)',
  captionSystemMemory: 'Системна памʼять',
  captionObjectsCount: 'Обʼєкти BrightScript (кількість)',
  captionObjectsMemory: 'Обʼєкти BrightScript (памʼять)',
  invalidChartType: 'Недійсний тип графіка продуктивності пристрою.',
  developerModeRequired: 'Щоб зафіксувати метрики продуктивності, на цьому пристрої має бути ввімкнено режим розробника.',
  remoteMetricsRootNotFound: 'Не знайдено кореня віддалених метрик для цієї вкладки пристрою.',
  performanceCardNotFound: (selector: string): string => `Картку продуктивності не знайдено: ${selector}`,
  performanceCardNoVisibleBounds:
    'Картка продуктивності не має видимих меж. Увімкніть «Показувати продуктивність пристрою» (чотиричастинний макет) у розділі «Пульт».',
  chartRasterizeFailed: 'Не вдалося растеризувати графік (порожня або недійсна URL-адреса даних).',
  canvasUnavailable: 'Полотно недоступне',
  couldNotDecodeCaptureForScaling: 'Не вдалося декодувати захоплення для масштабування експорту',
  devicePerfHidden:
    'Картки продуктивності пристрою приховані. У розділі «Пульт» увімкніть «Показувати продуктивність пристрою» (чотиричастинний макет), потім запустіть цей крок знову.',
  couldNotShowDevicePerf:
    'Не вдалося показати продуктивність пристрою автоматично. У розділі «Пульт» увімкніть «Показувати продуктивність пристрою» (чотиричастинний макет), потім запустіть цей крок знову.',
  stopped: 'Зупинено',
  couldNotCaptureDevicePerf:
    'Не вдалося зафіксувати картки продуктивності пристрою. Переконайтеся, що чотиричастинний макет видимий, а вікно не згорнуте.',
  devicePerfAutoEnabledSummary:
    '«Показувати продуктивність пристрою» (чотиричастинний макет) було ввімкнено автоматично для цього кроку.',
  skippedNoProcStat: (caption: string): string =>
    `Пропущено захоплення "${caption}" — пристрій ще не створив <proc-stat> (потрібен Roku OS 15.2+).`,

  // ── Device metrics: process-state labels (device-metrics.ts) ──────────────
  stateRunning: 'Виконується',
  stateSleeping: 'Сон',
  stateIdle: 'Простій',
  stateTracingStop: 'Зупинка трасування',
  stateDiskWait: 'Очікування диска',
  stateStopped: 'Зупинено',
  stateZombie: 'Зомбі',
  stateDead: 'Мертвий',

  // ── Device metrics: objects resource monitor ──────────────────────────────
  updatedAt: (time: string): string => `Оновлено: ${time}`,
  memoryEstimatedHint:
    'Памʼять оцінюється за кількістю обʼєктів і памʼяттю chanperf («used»), коли пристрій не надсилає байти за типами.',
  totalBrightScriptObjects: 'Усього обʼєктів BrightScript',

  // ── Device metrics: header perf strip ─────────────────────────────────────
  latestDevicePerfTitle: 'Остання продуктивність пристрою (клацніть, щоб відкрити пульт)',

  // ── Device metrics: CPU process table ─────────────────────────────────────
  processLabel: 'Процес',
  waitingForProcStat: 'Очікування зразка proc-stat…',
  stateFieldLabel: 'Стан',
  channelUptime: 'Час роботи каналу',
  sinceFirstObserved: 'Від першого спостереження',
  userCpuTime: 'Час CPU користувача',
  kernelCpuTime: 'Час CPU ядра',
  childCpuTime: 'Час CPU дочірніх процесів',
  childFaults: 'Помилки дочірніх процесів',
  minorMajor: 'Незначні/Значні',
  clockTickRate: 'Частота тактів годинника',
  minorFaults: 'Незначні помилки',
  majorFaults: 'Значні помилки',
  stableFor: (duration: string): string => `Стабільно протягом ${duration}`,
  childCpuTimeSecondary: (user: string, kernel: string): string => `Користувач ${user} · Ядро ${kernel}`,

  // ── Device metrics: chart hover series labels ─────────────────────────────
  hoverTotal: 'Усього',
  hoverUser: 'Користувач',
  hoverKernel: 'Ядро',
  hoverUsed: 'Використано',
  hoverResident: 'Резидентна',
  hoverAnonymous: 'Анонімна',
  hoverShared: 'Спільна',
  hoverLimit: 'Ліміт',

  // ── Device metrics: error toasts ──────────────────────────────────────────
  chanperfRequestFailed: 'Запит chanperf не вдався',
  couldNotParseChanperf: 'Не вдалося розібрати продуктивність каналу (режим розробника / ECP / chanperf).',
  objectCountsFailed: 'Не вдалося отримати кількість обʼєктів',
  deviceMetricsUnavailable: 'Метрики пристрою недоступні',

  // ── Device metrics: objects empty states ──────────────────────────────────
  objectsEmptyBackground:
    'Немає розподілу обʼєктів BrightScript, поки Dev App у фоновому режимі. Запустіть Dev App на пристрої або перемкніться на нього — метрики та кількість обʼєктів оновлюються лише коли він на передньому плані.',
  objectsEmptyNoForeground:
    'Розподілу обʼєктів BrightScript ще немає. Після того як зʼєднання повідомить про канал на передньому плані, запустіть Dev App, якщо вам потрібна кількість обʼєктів завантаженого Dev App.',
  objectsEmptyNoCounts:
    'Розподілу обʼєктів BrightScript ще немає. Переконайтеся, що ввімкнено керування з мобільних застосунків (доступ до мережі) і що канал на передньому плані надає кількість обʼєктів.',

  // ── Device metrics: launch + paused nav ───────────────────────────────────
  launchingProgress: 'Запуск…',
  launchFailed: 'Не вдалося запустити',
  pausedSideloadFull: 'Продуктивність пристрою призупинено — завантажте Dev App, щоб відновити',
  pausedSideloadShort: 'Завантажте, щоб відновити',
  pausedLaunchFull: 'Продуктивність пристрою призупинено — запустіть Dev App, щоб відновити',
  pausedLaunchShort: 'Запустіть, щоб відновити',
  pausedUnknownFull: 'Продуктивність пристрою призупинено — виведіть Dev App на передній план, щоб відновити.',
  pausedUnknownShort: 'Продуктивність пристрою призупинено',
  bringDevAppToForegroundTitle:
    'Виведіть Dev App на передній план на пристрої, щоб увімкнути продуктивність пристрою.',
  showDevicePerfAutoOnToast:
    '«Показувати продуктивність пристрою» було ввімкнено, щоб Action Script міг зафіксувати графіки.',

  // ── Native dialogs + IPC results (main: dev-app-handlers.ts) ──────────────
  selectRokuChannelPackageTitle: 'Виберіть пакет каналу Roku',
  rokuChannelPackageFilter: 'Пакет каналу Roku',
  saveScreenshotDialogTitle: 'Зберегти знімок екрана',
  imagesFilter: 'Зображення',
  screenshotCapturedToast: 'Знімок екрана зроблено!',
  sideloadWrongTypeError: 'Виберіть пакет каналу Roku .zip або .pkg',
  failedToSaveScreenshot: (detail: string): string => `Не вдалося зберегти знімок екрана: ${detail}`,
};

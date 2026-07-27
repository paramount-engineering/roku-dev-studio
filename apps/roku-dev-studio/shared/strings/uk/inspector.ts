/**
 * Ukrainian (uk) translation of the SceneGraph / node Inspector strings
 * (App Connector / RALE tab). Sibling of ../inspector.ts — same `inspector`
 * shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated; protocol identifiers, type names, code literals,
 * and example values are kept verbatim. Count-based functions apply Ukrainian
 * (Slavic) 3-form plural logic.
 */
export const inspector = {
  // Reused generic status / errors (Inspector-scoped variants)
  notConnected: 'Не підключено',
  commandFailed: 'Помилка команди',
  noResponseFromDevice: 'Немає відповіді від пристрою',

  // Connection flow (Connect/Disconnect, status line, Dev App preflight)
  connectingBtn: 'Підключення...',
  connectionLost: 'Зʼєднання втрачено',
  reconnecting: 'Повторне підключення...',
  connectingStatus: '🟡 Підключення...',
  reconnectingStatus: '🟡 Повторне підключення...',
  connectedBang: 'Підключено!',
  checkingDevApp: 'Перевірка, чи активний Dev App...',
  couldNotVerifyDevAppQuery:
    'Не вдалося перевірити стан Dev App. Запит активного застосунку не вдався (мережа / ECP / режим розробника?).',
  couldNotVerifyDevApp: 'Не вдалося перевірити стан Dev App.',
  checkConnectionHint: 'Перевірте підключення пристрою та режим розробника, потім спробуйте підключитися знову.',
  statusCheckFailed: 'Не вдалося перевірити стан',
  devAppNotRunning:
    'Dev App не запущено на пристрої Roku. Спершу запустіть завантажений через sideload Dev App.',
  launchDevAppHint: 'Перейдіть на вкладку Dev App і натисніть «Запустити», щоб запустити свій завантажений через sideload канал.',
  devAppNotActive: 'Dev App не активний',
  wakingUpTrackerTask: (port: number): string => `Активація TrackerTask на порту ${port}...`,
  failedToConnect: 'Не вдалося підключитися',
  failedToWakeTrackerTask: 'Не вдалося активувати TrackerTask',
  connectingToSocket: 'Підключення до сокета...',
  connectingToSocketRetry: (attempt: number): string =>
    `Підключення до сокета (спроба ${attempt})...`,
  initializing: 'Ініціалізація...',
  connectionClosedByDevice: 'З’єднання закрито пристроєм',

  // Response card (index.ts)
  findInResponse: 'Знайти у відповіді',
  saveResponseTitle: 'Зберегти відповідь',
  failedAutoFetchFunctions: 'Не вдалося автоматично отримати функції. Натисніть «Оновити», щоб спробувати знову.',
  refreshing: (command: string): string => `Оновлення ${command}…`,

  // Function selector / dropdown (function-selector.ts)
  connectToLoadFunctions: '-- Підключіться, щоб завантажити функції --',
  selectAFunction: '-- Виберіть функцію --',
  selectFunctionForParamDetails: 'Виберіть функцію, щоб побачити деталі параметрів',
  appConnectorFunctions: 'Функції App Connector',
  raleFunctions: 'Функції RALE',
  noFunctionsImplement: 'Немає функцій — реалізуйте GetExternalControlFunctions',
  readyToExecute: 'Готово до виконання',
  unknownFunctionName: 'невідома',
  functionCounts: (appCount: number, raleCount: number): string => {
    const appMod10 = appCount % 10;
    const appMod100 = appCount % 100;
    const appWord =
      appMod10 === 1 && appMod100 !== 11
        ? 'функція App'
        : appMod10 >= 2 && appMod10 <= 4 && (appMod100 < 12 || appMod100 > 14)
          ? 'функції App'
          : 'функцій App';
    const raleMod10 = raleCount % 10;
    const raleMod100 = raleCount % 100;
    const raleWord =
      raleMod10 === 1 && raleMod100 !== 11
        ? 'команда RALE'
        : raleMod10 >= 2 && raleMod10 <= 4 && (raleMod100 < 12 || raleMod100 > 14)
          ? 'команди RALE'
          : 'команд RALE';
    return `${appCount} ${appWord}, ${raleCount} ${raleWord}`;
  },

  // Function execution (function-execution.ts)
  sending: (command: string): string => `Надсилання ${command}...`,
  executing: (selection: string): string => `Виконання ${selection}...`,
  fetchingFunctions: 'Отримання доступних функцій...',
  foundFunctions: (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      mod10 === 1 && mod100 !== 11
        ? 'функцію'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'функції'
          : 'функцій';
    return `Знайдено ${n} ${word}`;
  },
  noFunctionsReturned: 'Функції не повернуто',
  getExternalControlFunctionsReturnedFalse:
    'getExternalControlFunctions повернув false — переконайтеся, що сцена SceneGraph реалізує цю функцію',
  failedToFetchFunctions: 'Не вдалося отримати функції',
  selectFunctionToExecute: 'Виберіть функцію для виконання',
  functionExecutionFailed: 'Не вдалося виконати функцію',
  unknownRaleBuiltin: 'Невідома вбудована команда RALE',
  unhandledRaleBuiltin: (command: string): string => `Необроблена вбудована команда RALE: ${command}`,

  // RALE path parsing (node-lookup.ts)
  pathMustBeJsonArray: 'Шлях має бути масивом JSON (наприклад, [] або [{"child":0}])',
  invalidPathJson: (detail: string): string => `Недійсний JSON шляху: ${detail}`,

  // Update Node modal (node-update-panel.ts)
  noNodeContext: 'Немає контексту вузла — спершу виконайте «Отримати вузол за ID».',
  fieldNameRequired: 'Потрібна назва поля.',
  selectNodeFailed: 'Не вдалося виконати selectNode',
  selectingNode: 'Вибір вузла…',
  removingField: 'Видалення поля…',
  addingField: 'Додавання поля…',
  updatingField: 'Оновлення поля…',
  removedField: (name: string): string => `Поле "${name}" видалено.`,
  addedField: (name: string): string => `Поле "${name}" додано.`,
  updatedField: (name: string): string => `Поле "${name}" оновлено.`,
  removeFieldBtn: 'Видалити поле',
  addFieldBtn: 'Додати поле',
  updateFieldBtn: 'Оновити поле',
  valueLabel: 'Значення',
  newValueLabel: 'Нове значення',
  addValuePlaceholder:
    'Початкове значення для нового поля (скаляри, true/false, JSON для масивів / об’єкта)',
  updateValuePlaceholder: 'Скаляри, true/false, JSON для масивів / векторів / об’єктів',

  // Update Node — value parse errors (parseValueForRaleFieldType)
  parseBoolean: 'boolean: використовуйте true або false',
  parseInteger: 'integer: недійсне число',
  parseFloat: 'float: недійсне число',
  parseColor: 'color: використовуйте ціле число (наприклад, -16777216)',
  parseVector2d: 'vector2d: щонайменше два елементи, наприклад [0,0]',
  parseRect2d: 'rect2d: чотири елементи, наприклад [0,0,100,100]',
  parseArray: 'array: недійсний масив JSON',
  parseAssocArray: 'assocarray: потрібен об’єкт JSON',
  jsonArrayRequired: (type: string): string => `${type}: потрібен масив JSON`,
  invalidJsonArray: (type: string): string => `${type}: недійсний масив JSON`,

  // Registry builtin param editors (registry-params-ui.ts)
  unexpectedRegistryResponse: 'Неочікувана відповідь реєстру',
  loadingRegistry: 'Завантаження реєстру…',
  selectSection: '— Виберіть розділ —',
  noSections: '(немає розділів)',
  selectKey: '— Виберіть ключ —',
  noKeys: '(немає ключів)',
  ariaSectionToRemove: 'Розділ для видалення',
  ariaSection: 'Розділ',
  ariaKey: 'Ключ',
  ariaKeyToReplace: 'Ключ для заміни',
  removeSectionHint: 'Розділи завантажено з пристрою. Виконання видаляє вибраний розділ.',
  fieldKeyPlaceholder: 'Ключ поля',
  stringValuePlaceholder: 'Рядкове значення',
  newKeyPlaceholder: 'Новий ключ',
  newValuePlaceholder: 'Нове значення',

  // Registry client-side validation (registry-validation.ts)
  sectionNameRequired: 'Потрібна назва розділу.',
  sectionMustBeJsonObject: 'Розділ має бути об’єктом JSON (не масивом).',
  sectionKeysNotEmpty: 'Ключі об’єкта розділу не можуть бути порожніми або складатися лише з пробілів.',
  eachValueMustBeString: (key: string): string =>
    `Кожне значення має бути рядком (roRegistry зберігає рядки). Ключ "${key}" не є рядком — використовуйте рядки в лапках у JSON.`,
  selectSectionFromList: 'Виберіть розділ зі списку.',
  selectKeyFromList: 'Виберіть ключ зі списку.',
  enterFieldKey: 'Введіть ключ поля.',

  // Parameter inputs (parameter-inputs.ts)
  noParamsRequired: '✓ Параметри не потрібні',
  selectFunctionForParams: 'Виберіть функцію, щоб побачити параметри',
  booleanPlaceholder: 'true або false',
  stringPlaceholder: 'Введіть текст...',

  // Execute Function dropdown — RALE builtin labels (rale-builtins.ts)
  getNodeByIdLabel: 'Отримати вузол за ID',
  getNodeByNameLabel: 'Отримати вузол за SubType (клас компонента)',
  getRegistrySectionsLabel: '[Реєстр] Отримати всі розділи',
  clearRegistryLabel: '[Реєстр] Очистити всі розділи',
  addRegistrySectionLabel: '[Реєстр] Додати/оновити розділ',
  removeRegistrySectionLabel: '[Реєстр] Видалити розділ',
  addRegistryFieldLabel: '[Реєстр] Встановити ключ розділу',
  removeRegistryFieldLabel: '[Реєстр] Видалити ключ розділу',
  editRegistryFieldLabel: '[Реєстр] Редагувати ключ розділу',

  // Execute Function dropdown — RALE builtin descriptions (hint text)
  getNodeByIdDesc:
    'RALE getNodeById — пошук у глибину за шляхом; id збігається з полем id вузла. Шлях [] = корінь сцени.',
  getNodeByNameDesc:
    'RALE getNodeByName — name це node.subtype() (клас компонента XML), наприклад Label, RowList. Шлях [] = корінь сцени.',
  getRegistrySectionsDesc:
    'RALE getRegistrySections — читає всі розділи та ключі roRegistry (повертає вкладений об’єкт за назвою розділу).',
  clearRegistryDesc:
    'RALE clearRegistry — видаляє кожен розділ реєстру на пристрої (руйнівна дія).',
  addRegistrySectionDesc:
    'RALE addRegistrySection — args.name = назва розділу; args.section = об’єкт JSON із рядкових пар ключ/значення.',
  removeRegistrySectionDesc:
    'RALE removeRegistrySection — видаляє один розділ. Розділи завантажуються з пристрою; після успіху реєстр оновлюється.',
  addRegistryFieldDesc:
    'RALE addRegistryField — встановлює рядкове значення для ключа в розділі. Список розділів завантажується з пристрою.',
  removeRegistryFieldDesc:
    'RALE removeRegistryField — видаляє один ключ. Виберіть розділ і ключ зі списків, завантажених з пристрою.',
  editRegistryFieldDesc:
    'RALE editRegistryField — виберіть розділ і ключ, потім введіть newKey і newValue. Списки завантажуються з пристрою.',
};

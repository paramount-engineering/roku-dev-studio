/**
 * Ukrainian (uk) translation of the Query / Device Queries tab strings: ECP query
 * results, custom queries, POST actions, telnet system commands, Remove Plugin,
 * and the Secret Screens modal. Sibling of ../queries.ts — same `queries` shape,
 * keys, order, and function signatures. Only literal display text is translated.
 */
export const queries = {
  // Results card
  findInResults: 'Знайти в результатах',
  saveResultsDialog: 'Зберегти результати',

  // Custom query field
  running: 'Виконання...',
  runQuery: 'Виконати запит',

  // Shared error / status text (rendered into the results output)
  errorText: (msg: string): string => `Помилка: ${msg}`,
  unknownError: 'Невідома помилка',
  connectingToTelnet: 'Підключення до Telnet (порт 8080)...',
  connectedSettingUpListener: 'Підключено. Налаштування слухача...',
  failedToConnectTelnet: (err?: string): string => `Не вдалося підключитися до Telnet (порт 8080): ${err}`,
  noOutputReceived: 'Вивід не отримано',
  noOutputFromCommand: 'Вивід від команди не отримано.',

  // Remove Plugin
  enterAppId: 'Введіть App ID',
  confirmRemovePlugin: (appId: string): string =>
    `Видалити плагін «${appId}»?\n\nЦе видалить програму з цього пристрою та з усіх пристроїв, прив’язаних до того самого облікового запису Roku.`,
  noResponseReceived: 'Відповідь не отримано',
  noResponseFromCommand: 'Відповідь від команди не отримано',

  // Secret Screens modal
  runSequence: 'Виконати послідовність',
  keySequenceAria: (title: string): string => `Послідовність клавіш ${title}`,
  confirmReboot: 'Це надсилає послідовність клавіш, яка перезавантажує Roku. Продовжити?',

  // Secret screen titles
  developerSettings: 'Налаштування розробника',
  secretScreen: 'Секретний екран',
  secretScreen2: 'Секретний екран 2',
  wifiSecret: 'Секретний екран Wi-Fi',
  antennaSecret: 'Секретний екран антени',
  channelInfo: 'Інформація про канал',
  network: 'Мережа',
  reboot: 'Перезавантажити',
};

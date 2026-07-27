/**
 * Ukrainian (uk) translation of the Telnet / BrightScript debug console panel
 * strings. Sibling of ../telnet.ts — same `telnet` shape, keys, order, and
 * function signatures.
 *
 * Parametrized strings are functions returning the composed text. The "--- … ---"
 * session markers keep their exact interpolation; count-driven text uses the
 * Ukrainian 3-form plural. Only literal wording is translated.
 */
export const telnet = {
  // Connection status pill (right of the console header)
  statusConnecting: 'Підключення...',
  connectionFailed: 'Не вдалося підключитися',
  connectionLost: 'Зʼєднання втрачено',
  unknownError: 'Невідома помилка',
  errorStatusPrefix: (msg: string): string => `Помилка: ${msg}`,

  // Empty-state placeholder (shown before the first connect)
  placeholderTitle: 'Підключіться, щоб переглянути налагоджувальний вивід BrightScript',
  placeholderHintDevMode: 'Потрібно ввімкнути режим розробника на пристрої Roku.',
  placeholderHintSingleConn: 'Одночасно може бути активним лише одне зʼєднання telnet із пристроєм Roku.',

  // Live line counter (left of the status pill) + its hover tooltip
  linesCount: (countLabel: string, n: number): string => {
    const word =
      n % 10 === 1 && n % 100 !== 11 ? 'рядок' :
      n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'рядки' :
      'рядків';
    return `${countLabel} ${word}`;
  },
  spillTooltip: (bufferedLabel: string, totalLabel: string, spilledLabel: string, capHit: boolean): string =>
    `${bufferedLabel} з ${totalLabel} рядків — ${bufferedLabel} у памʼяті, ${spilledLabel} скинуто на диск` +
    (capHit ? ' (досягнуто ліміту диска — старіші рядки відкинуто)' : ''),

  // Session log lines the console prints into its own stream ("--- … ---")
  relayNoteSkipBuffer: ' (через relay, пропустити наявний буфер журналів)',
  relayNoteReplayBuffer: ' (через relay, відтворити буфер)',
  lineConnectedTo: (ip: string, relayNote: string): string => `--- Підключено до ${ip}:8085${relayNote} ---`,
  lineConnectionFailed: (err: string): string => `--- Не вдалося підключитися: ${err} ---`,
  lineConnectionError: (msg: string): string => `--- Помилка зʼєднання: ${msg} ---`,
  lineDisconnected: '--- Відключено ---',
  lineError: (err: string): string => `--- Помилка: ${err} ---`,
  lineConnectionClosed: (aliveStr: string | null, bytes: number): string => {
    let s = '--- Зʼєднання закрито';
    if (aliveStr !== null) s += ` (активне ${aliveStr}`;
    if (bytes >= 0) s += `${aliveStr !== null ? ', ' : ' ('}отримано ${bytes} байт`;
    if (aliveStr !== null || bytes >= 0) s += ')';
    s += ' ---';
    return s;
  },
  hintNoLogData:
    '--- Підказка: Roku швидко закрив сокет без даних журналу. Перевірте, що жоден інший клієнт telnet не підключений до цього пристрою на порту 8085 (BrightScript IDE, інше вікно Dev Studio, сеанс термінала `telnet`, …) і що наразі запущено завантажений канал. ---',
  hintAbnormalClose:
    '--- Підказка: закриття сокета було ненормальним (TCP RST або подібне). Можливо, Roku перезавантажився або інший клієнт зайняв привʼязку до 8085. ---',

  // Copy button transient feedback (rendered next to a check icon — no ✓ prefix,
  // unlike common.copied, so the icon isn't doubled).
  copied: 'Скопійовано!',

  // Save button transient feedback + save dialog + saved-file header block
  saveNoLogs: 'Немає журналів',
  saving: 'Збереження...',
  saved: 'Збережено!',
  saveError: 'Помилка',
  saveDialogTitle: 'Зберегти журнали консолі',
  saveHeaderTitle: 'Журнали консолі Roku',
  saveHeaderUnknownDevice: 'Невідомо',
  saveHeaderDevice: (device: string, ip: string): string => `Пристрій: ${device} (${ip})`,
  saveHeaderSaved: (when: string): string => `Збережено: ${when}`,
  saveHeaderTotalLines: (n: number): string => `Усього рядків: ${n}`,
};

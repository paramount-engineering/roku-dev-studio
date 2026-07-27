/**
 * Ukrainian (uk) translation of the standalone Network Session Viewer window
 * strings. Sibling of ../network-session-viewer.ts — same
 * `networkSessionViewer` shape, keys, order, and function signatures.
 * Only literal display text is translated.
 */
export const networkSessionViewer = {
  /** Window title + modal title prefix (used when no file name is known). */
  networkSession: 'Мережева сесія',
  /** Window title once a capture file name is known. */
  windowTitleWithFile: (fileName: string): string => `Мережева сесія — ${fileName}`,
  /** Empty-state shown when the capture can't be loaded. */
  failedToLoadSession: 'Не вдалося завантажити сесію.',

  // Open-file error dialog (main process)
  openErrorTitle: 'Відкрити мережеву сесію',

  // ── Parse errors (main/network-session-parse.ts) ──
  // Thrown as Error messages, caught by the viewer window and shown to the user.
  // File extensions / tokens (.har, .pcap, pcapng, Wireshark, Ethernet) are verbatim.
  errUnsupportedType: 'Непідтримуваний тип файлу. Відкрийте файл .rds-network-inspector.json, .har або .pcap.',
  errNotSessionFile: 'Це не файл мережевої сесії Roku Dev Studio (відсутній масив "events").',
  errNotHar: 'Недійсний файл HAR (відсутній log.entries).',
  errPcapTooSmall: 'Файл замалий, щоб бути pcap.',
  errPcapng: 'Це файл pcapng. Повторно експортуйте як класичний pcap (Wireshark: “pcap”), щоб переглянути його тут.',
  errPcapBadMagic: 'Не розпізнано файл pcap (неправильне магічне число).',
  errPcapLinkType: (linkType: number): string =>
    `Непідтримуваний тип канального рівня pcap ${linkType} — декодувати можна лише кадри Ethernet (1).`,

  // Static network-session-viewer.html header controls (mirrors the live Network Inspector).
  // Find controls
  findBtnTitle: 'Знайти в трафіку — URL, корисні дані, заголовки, тіла відповідей (⌘/Ctrl+F)',
  findBtnAria: 'Знайти в трафіку',
  findPrevTitle: 'Попередній збіг (Shift+↑)',
  findPrevAria: 'Попередній збіг',
  findNextTitle: 'Наступний збіг (Shift+↓)',
  findNextAria: 'Наступний збіг',
  findClear: 'Очистити результати пошуку',
  // Filter controls
  filterPlaceholder: 'Фільтрувати трафік…',
  filterTitle: 'Фільтрувати трафік — натисніть значок інформації, щоб побачити підтримуваний синтаксис.',
  clearFilter: 'Очистити фільтр',
  filterHelpTitle: 'Довідка з фільтрування та підтримуваний синтаксис',
  filterHelpAria: 'Довідка з фільтрування',
  filterResizeTitle: 'Перетягніть, щоб змінити розмір фільтра (подвійне клацання для скидання)',
  // Layout toggle + sidebar options
  layoutToggleTitle: 'Розташувати запит і відповідь вертикально',
  layoutToggleAria: 'Перемкнути компонування деталей',
  collapseGroups: 'Згорнути всі групи',
  groupByHostTitle: 'Групувати сесії за іменем хоста',
  groupByHost: 'Групувати за хостом',
};

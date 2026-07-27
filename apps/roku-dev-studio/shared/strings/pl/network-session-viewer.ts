/**
 * Polish (pl) translation of the standalone Network Session Viewer window
 * strings. Sibling of ../network-session-viewer.ts — same
 * `networkSessionViewer` shape, keys, order, and function signatures.
 * Only literal display text is translated.
 */
export const networkSessionViewer = {
  /** Window title + modal title prefix (used when no file name is known). */
  networkSession: 'Sesja sieciowa',
  /** Window title once a capture file name is known. */
  windowTitleWithFile: (fileName: string): string => `Sesja sieciowa — ${fileName}`,
  /** Empty-state shown when the capture can't be loaded. */
  failedToLoadSession: 'Nie udało się załadować sesji.',

  // Open-file error dialog (main process)
  openErrorTitle: 'Otwórz sesję sieciową',

  // ── Parse errors (main/network-session-parse.ts) ──
  // Thrown as Error messages, caught by the viewer window and shown to the user.
  // File extensions / tokens (.har, .pcap, pcapng, Wireshark, Ethernet) are verbatim.
  errUnsupportedType: 'Nieobsługiwany typ pliku. Otwórz plik .rds-network-inspector.json, .har lub .pcap.',
  errNotSessionFile: 'To nie jest plik sesji sieciowej Roku Dev Studio (brak tablicy "events").',
  errNotHar: 'To nie jest prawidłowy plik HAR (brak log.entries).',
  errPcapTooSmall: 'Plik jest za mały, aby był plikiem pcap.',
  errPcapng: 'To jest plik pcapng. Wyeksportuj ponownie jako klasyczny pcap (Wireshark: „pcap”), aby go tu wyświetlić.',
  errPcapBadMagic: 'Nierozpoznany plik pcap (nieprawidłowa liczba magiczna).',
  errPcapLinkType: (linkType: number): string =>
    `Nieobsługiwany typ warstwy łącza pcap ${linkType} — można dekodować tylko ramki Ethernet (1).`,

  // Static network-session-viewer.html header controls (mirrors the live Network Inspector).
  // Find controls
  findBtnTitle: 'Znajdź w ruchu — URL, ładunki, nagłówki, treści odpowiedzi (⌘/Ctrl+F)',
  findBtnAria: 'Znajdź w ruchu',
  findPrevTitle: 'Poprzednie dopasowanie (Shift+↑)',
  findPrevAria: 'Poprzednie dopasowanie',
  findNextTitle: 'Następne dopasowanie (Shift+↓)',
  findNextAria: 'Następne dopasowanie',
  findClear: 'Wyczyść wyniki wyszukiwania',
  // Filter controls
  filterPlaceholder: 'Filtruj ruch…',
  filterTitle: 'Filtruj ruch — kliknij ikonę informacji, aby zobaczyć obsługiwaną składnię.',
  clearFilter: 'Wyczyść filtr',
  filterHelpTitle: 'Pomoc dotycząca filtrowania i obsługiwana składnia',
  filterHelpAria: 'Pomoc dotycząca filtrowania',
  filterResizeTitle: 'Przeciągnij, aby zmienić rozmiar filtra (kliknij dwukrotnie, aby zresetować)',
  // Layout toggle + sidebar options
  layoutToggleTitle: 'Ułóż żądanie i odpowiedź pionowo',
  layoutToggleAria: 'Przełącz układ szczegółów',
  collapseGroups: 'Zwiń wszystkie grupy',
  groupByHostTitle: 'Grupuj sesje według nazwy hosta',
  groupByHost: 'Grupuj według hosta',
};

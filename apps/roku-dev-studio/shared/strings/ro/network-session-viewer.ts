/**
 * Romanian (ro) translation of the standalone Network Session Viewer window
 * strings. Sibling of ../network-session-viewer.ts — same
 * `networkSessionViewer` shape, keys, order, and function signatures.
 * Only literal display text is translated.
 */
export const networkSessionViewer = {
  /** Window title + modal title prefix (used when no file name is known). */
  networkSession: 'Sesiune de rețea',
  /** Window title once a capture file name is known. */
  windowTitleWithFile: (fileName: string): string => `Sesiune de rețea — ${fileName}`,
  /** Empty-state shown when the capture can't be loaded. */
  failedToLoadSession: 'Încărcarea sesiunii a eșuat.',

  // Open-file error dialog (main process)
  openErrorTitle: 'Deschide sesiunea de rețea',

  // ── Parse errors (main/network-session-parse.ts) ──
  // Thrown as Error messages, caught by the viewer window and shown to the user.
  // File extensions / tokens (.har, .pcap, pcapng, Wireshark, Ethernet) are verbatim.
  errUnsupportedType: 'Tip de fișier neacceptat. Deschideți un fișier .rds-network-inspector.json, .har sau .pcap.',
  errNotSessionFile: 'Nu este un fișier de sesiune de rețea Roku Dev Studio (lipsește tabloul "events").',
  errNotHar: 'Nu este un fișier HAR valid (lipsește log.entries).',
  errPcapTooSmall: 'Fișierul este prea mic pentru a fi un pcap.',
  errPcapng: 'Acesta este un fișier pcapng. Reexportați-l ca pcap clasic (Wireshark: „pcap”) pentru a-l vizualiza aici.',
  errPcapBadMagic: 'Fișier pcap nerecunoscut (număr magic incorect).',
  errPcapLinkType: (linkType: number): string =>
    `Tip de strat de legătură pcap neacceptat ${linkType} — doar cadrele Ethernet (1) pot fi decodate.`,

  // Static network-session-viewer.html header controls (mirrors the live Network Inspector).
  // Find controls
  findBtnTitle: 'Caută în trafic — URL, payload-uri, anteturi, corpuri de răspuns (⌘/Ctrl+F)',
  findBtnAria: 'Caută în trafic',
  findPrevTitle: 'Potrivirea anterioară (Shift+↑)',
  findPrevAria: 'Potrivirea anterioară',
  findNextTitle: 'Potrivirea următoare (Shift+↓)',
  findNextAria: 'Potrivirea următoare',
  findClear: 'Golește rezultatele căutării',
  // Filter controls
  filterPlaceholder: 'Filtrează traficul…',
  filterTitle: 'Filtrează traficul — apasă pictograma de informații pentru sintaxa acceptată.',
  clearFilter: 'Golește filtrul',
  filterHelpTitle: 'Ajutor pentru filtrare și sintaxă acceptată',
  filterHelpAria: 'Ajutor pentru filtrare',
  filterResizeTitle: 'Trage pentru a redimensiona filtrul (dublu-clic pentru resetare)',
  // Layout toggle + sidebar options
  layoutToggleTitle: 'Stivuiește cererea și răspunsul vertical',
  layoutToggleAria: 'Comută aspectul detaliilor',
  collapseGroups: 'Restrânge toate grupurile',
  groupByHostTitle: 'Grupează sesiunile după numele hostului',
  groupByHost: 'Grupează după host',
};

/**
 * Latin American Spanish (neutral) translation of the standalone Network Session
 * Viewer window strings. Sibling of ../network-session-viewer.ts — same
 * `networkSessionViewer` shape, keys, order, and function signatures.
 * Only literal display text is translated.
 */
export const networkSessionViewer = {
  /** Window title + modal title prefix (used when no file name is known). */
  networkSession: 'Sesión de red',
  /** Window title once a capture file name is known. */
  windowTitleWithFile: (fileName: string): string => `Sesión de red — ${fileName}`,
  /** Empty-state shown when the capture can't be loaded. */
  failedToLoadSession: 'Error al cargar la sesión.',

  // Open-file error dialog (main process)
  openErrorTitle: 'Abrir sesión de red',

  // ── Parse errors (main/network-session-parse.ts) ──
  // Thrown as Error messages, caught by the viewer window and shown to the user.
  // File extensions / tokens (.har, .pcap, pcapng, Wireshark, Ethernet) are verbatim.
  errUnsupportedType: 'Tipo de archivo no compatible. Abra un archivo .rds-network-inspector.json, .har o .pcap.',
  errNotSessionFile: 'No es un archivo de sesión de red de Roku Dev Studio (falta el arreglo "events").',
  errNotHar: 'No es un archivo HAR válido (falta log.entries).',
  errPcapTooSmall: 'El archivo es demasiado pequeño para ser un pcap.',
  errPcapng: 'Este es un archivo pcapng. Vuelva a exportarlo como pcap clásico (Wireshark: “pcap”) para verlo aquí.',
  errPcapBadMagic: 'No es un archivo pcap reconocido (número mágico incorrecto).',
  errPcapLinkType: (linkType: number): string =>
    `Tipo de capa de enlace pcap no compatible ${linkType} — solo se pueden decodificar tramas Ethernet (1).`,

  // Static network-session-viewer.html header controls (mirrors the live Network Inspector).
  // Find controls
  findBtnTitle: 'Buscar en el tráfico — URL, payloads, encabezados, cuerpos de respuesta (⌘/Ctrl+F)',
  findBtnAria: 'Buscar en el tráfico',
  findPrevTitle: 'Coincidencia anterior (Shift+↑)',
  findPrevAria: 'Coincidencia anterior',
  findNextTitle: 'Coincidencia siguiente (Shift+↓)',
  findNextAria: 'Coincidencia siguiente',
  findClear: 'Limpiar los resultados de la búsqueda',
  // Filter controls
  filterPlaceholder: 'Filtrar tráfico…',
  filterTitle: 'Filtrar tráfico — haga clic en el ícono de información para ver la sintaxis compatible.',
  clearFilter: 'Limpiar filtro',
  filterHelpTitle: 'Ayuda de filtrado y sintaxis compatible',
  filterHelpAria: 'Ayuda de filtrado',
  filterResizeTitle: 'Arrastre para redimensionar el filtro (doble clic para restablecer)',
  // Layout toggle + sidebar options
  layoutToggleTitle: 'Apilar solicitud y respuesta verticalmente',
  layoutToggleAria: 'Alternar diseño de detalle',
  collapseGroups: 'Contraer todos los grupos',
  groupByHostTitle: 'Agrupar sesiones por nombre de host',
  groupByHost: 'Agrupar por host',
};

/**
 * UI strings for the standalone Network Session Viewer window
 * (renderer/components/network-session-viewer/network-session-viewer.ts).
 */
export const networkSessionViewer = {
  /** Window title + modal title prefix (used when no file name is known). */
  networkSession: 'Sessão de rede',
  /** Window title once a capture file name is known. */
  windowTitleWithFile: (fileName: string): string => `Sessão de rede — ${fileName}`,
  /** Empty-state shown when the capture can't be loaded. */
  failedToLoadSession: 'Falha ao carregar a sessão.',

  // Open-file error dialog (main process)
  openErrorTitle: 'Abrir sessão de rede',

  // ── Parse errors (main/network-session-parse.ts) ──
  // Thrown as Error messages, caught by the viewer window and shown to the user.
  // File extensions / tokens (.har, .pcap, pcapng, Wireshark, Ethernet) are verbatim.
  errUnsupportedType: 'Tipo de arquivo não suportado. Abra um arquivo .rds-network-inspector.json, .har ou .pcap.',
  errNotSessionFile: 'Não é um arquivo de sessão de rede do Roku Dev Studio (array "events" ausente).',
  errNotHar: 'Não é um arquivo HAR válido (log.entries ausente).',
  errPcapTooSmall: 'O arquivo é pequeno demais para ser um pcap.',
  errPcapng: 'Este é um arquivo pcapng. Exporte novamente como pcap clássico (Wireshark: “pcap”) para visualizá-lo aqui.',
  errPcapBadMagic: 'Não é um arquivo pcap reconhecido (número mágico inválido).',
  errPcapLinkType: (linkType: number): string =>
    `Tipo de camada de enlace pcap não suportado ${linkType} — somente quadros Ethernet (1) podem ser decodificados.`,

  // Static network-session-viewer.html header controls (mirrors the live Network Inspector).
  // Find controls
  findBtnTitle: 'Buscar no tráfego — URL, payloads, cabeçalhos, corpos de resposta (⌘/Ctrl+F)',
  findBtnAria: 'Buscar no tráfego',
  findPrevTitle: 'Correspondência anterior (Shift+↑)',
  findPrevAria: 'Correspondência anterior',
  findNextTitle: 'Próxima correspondência (Shift+↓)',
  findNextAria: 'Próxima correspondência',
  findClear: 'Limpar resultados da busca',
  // Filter controls
  filterPlaceholder: 'Filtrar tráfego…',
  filterTitle: 'Filtrar tráfego — clique no ícone de informações para ver a sintaxe suportada.',
  clearFilter: 'Limpar filtro',
  filterHelpTitle: 'Ajuda de filtragem e sintaxe suportada',
  filterHelpAria: 'Ajuda de filtragem',
  filterResizeTitle: 'Arraste para redimensionar o filtro (clique duplo para redefinir)',
  // Layout toggle + sidebar options
  layoutToggleTitle: 'Empilhar requisição e resposta verticalmente',
  layoutToggleAria: 'Alternar layout de detalhes',
  collapseGroups: 'Recolher todos os grupos',
  groupByHostTitle: 'Agrupar sessões por nome de host',
  groupByHost: 'Agrupar por host',
};

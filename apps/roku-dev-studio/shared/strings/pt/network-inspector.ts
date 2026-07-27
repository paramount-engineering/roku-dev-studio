/**
 * UI strings for the Network Inspector — the live capture tab (network-tab.ts), its modals
 * (traffic rules, find-in-content, hotspot setup, port conflict, large-body info, filter help),
 * and the detail renderers shared with the standalone Session Viewer.
 *
 * Parametrized strings are functions returning the composed text (the standard way to keep
 * interpolation translatable without a runtime format library). Some values intentionally embed
 * HTML markup (<strong>, <code>, <kbd>, <em>, <button>) because they're injected via innerHTML.
 */
export const networkInspector = {
  // Section identity (used as a title prefix for the shared URL / structured viewers).
  titlePrefix: 'Inspetor de rede',

  // ── Shared detail pane chrome (network-detail-view.ts) ──────────────────────────────
  emptyDetail: 'Selecione uma sessão para inspecionar a requisição e a resposta.',
  request: 'Requisição',
  response: 'Resposta',
  tabOverview: 'Visão geral',
  tabBody: 'Corpo',
  tabHeaders: 'Cabeçalhos',
  copyRequestBody: 'Copiar corpo da requisição',
  copyResponseBody: 'Copiar corpo da resposta',
  moreCopyOptions: 'Mais opções de cópia',
  copyBody: 'Copiar corpo',
  copyAsCurl: 'Copiar como cURL',
  copyAsHar: 'Copiar como HAR',
  bodyTruncated: 'Corpo truncado',
  bodyTruncatedRequestTitle:
    'A cópia capturada deste corpo excedeu o limite de exibição do inspetor, então o que é mostrado aqui está incompleto. O corpo completo ainda assim foi entregue ao servidor upstream. Use Copiar para a parte capturada.',
  bodyTruncatedResponseTitle:
    'A cópia capturada deste corpo excedeu o limite de exibição do inspetor, então o que é mostrado aqui está incompleto. O corpo completo ainda assim foi entregue ao Roku. Use Copiar para a parte capturada.',
  disableWordWrap: 'Desativar quebra de linha',
  enableWordWrap: 'Ativar quebra de linha',
  toggleWordWrap: 'Alternar quebra de linha',
  formatLabel: 'Formato',
  formatAuto: 'Automático',
  formatJson: 'JSON',
  formatXml: 'XML',
  formatRaw: 'Bruto',
  whyRawText: 'Por que isto é mostrado como texto bruto?',

  // ── Session list rows (network-session-view.ts) ─────────────────────────────────────
  noMatchingSessions: 'Nenhuma sessão correspondente.',
  noHostsYet: 'Nenhum host ainda. A estrutura agrupa o tráfego por nome de host.',
  sslDecryptedTitle: 'Descriptografado (MITM)',
  sslEncryptedTitle: 'HTTPS (criptografado)',
  sessionNumber: (n: number): string => `Sessão nº ${n}`,
  requestNumber: (n: number): string => `Requisição nº ${n}`,
  expandAllGroups: 'Expandir todos os grupos',
  collapseAllGroups: 'Recolher todos os grupos',

  // ── Session-list derived tokens (network-sessions.ts) ───────────────────────────────
  // Duration column value while a transaction is still open (distinct from statusPending
  // below — has a trailing ellipsis and is the duration cell, not the status pill).
  durationPending: 'Pendente…',
  // Status-pill tokens for the session list. Kept SEPARATE from the overview statusPending:
  // statusClass()/the status filter compare against session.status, so these must stay
  // byte-identical to the values eventToSession() assigns.
  listStatusPending: 'Pending',
  listStatusQuery: 'Query',
  listStatusOk: 'OK',
  listStatusOpen: 'Open',
  // DNS structure-tree leaf / sidebar path labels.
  dnsQueryLabel: 'Consulta DNS',
  dnsResponseLabel: 'Resposta DNS',

  // ── Detail renderers (network-detail.ts) ────────────────────────────────────────────
  // Synthetic first-row header of the response Headers table (HTTP/RFC start-line term).
  statusLine: 'Status-Line',
  noHeaders: '(sem cabeçalhos)',
  noRequestBody: '(sem corpo de requisição)',
  noResponseBody: '(sem corpo de resposta)',
  emptyResponseBody: '(corpo de resposta vazio)',
  waitingForResponse: '(aguardando resposta…)',
  encryptedNoHeaders: '(criptografado — sem cabeçalhos)',
  dnsNoHeaders: '(DNS — sem cabeçalhos HTTP)',
  dnsAnswerEmpty: '(vazio)',
  dnsPending: '(pendente)',
  noResponseBodyCaptured: '(nenhum corpo de resposta capturado)',
  httpsResponseEncrypted: 'O corpo da resposta HTTPS está criptografado. Ative o proxy MITM para inspecionar os corpos aqui.',
  // Media-preview fallbacks + captions.
  mimeContent: 'conteúdo',
  mimeBinary: 'binário',
  mimeUnknownType: 'tipo desconhecido',
  responseImageAlt: 'Prévia da imagem de resposta',
  binaryTruncatedNote: (mime: string): string =>
    `${mime} binário foi truncado durante a captura — prévia indisponível. Use Copiar para o base64 capturado.`,
  binaryNotPreviewable: (mime: string, size: string): string =>
    `Conteúdo binário (${mime}, ~${size}) — sem prévia disponível. Use Copiar para o base64 capturado.`,
  // Overview: request Status row values (display-only; distinct from the session-list status tokens).
  statusPending: 'Pendente',
  statusComplete: 'Concluído',
  statusFailed: 'Falhou',
  // Overview: row + section labels.
  ovType: 'Tipo',
  ovTime: 'Horário',
  ovDevice: 'Dispositivo',
  ovHost: 'Host',
  ovDestination: 'Destino',
  ovUrl: 'URL',
  ovStatus: 'Status',
  ovResponseCode: 'Código de resposta',
  ovProtocol: 'Protocolo',
  ovMethod: 'Método',
  requestContentType: 'Content-Type da requisição',
  responseContentType: 'Content-Type da resposta',
  ovClientAddress: 'Endereço do cliente',
  ovRemoteAddress: 'Endereço remoto',
  ovTags: 'Tags',
  ovDns: 'DNS',
  ovNotes: 'Notas',
  ovRequestStart: 'Início da requisição',
  ovTotal: 'Total',
  secTls: 'TLS',
  secTiming: 'Tempos',
  secSize: 'Tamanho',
  secRequestHeaders: 'Cabeçalhos da requisição',
  viewUrlTitle: 'Ver URL e parâmetros de consulta',
  tagsMitmDecrypted: 'MITM · Descriptografado',
  protocolHttpsDecrypted: 'HTTPS (descriptografado via proxy MITM do Roku Dev Studio)',
  protocolHttpsEncrypted: 'HTTPS (criptografado)',
  notesProxied: 'Requisição via proxy — TLS upstream encerrado no Roku Dev Studio',
  notesHotspot: 'Captura por hotspot — corpos indisponíveis sem MITM',
  typeHttpsTlsHandshake: 'HTTPS (handshake TLS)',
  unknownHost: 'host-desconhecido',
  dnsQueryValue: (host: string): string => `Consulta ${host}`,
  dnsBody: (isQuery: boolean, host: string): string => `DNS ${isQuery ? 'Consulta' : 'Resposta'}: ${host}`,
  httpsRequestFallback: (host: string, port: string): string =>
    `CONNECT ${host}${port} (HTTPS — criptografado)\n\nA captura por hotspot vê apenas o handshake TLS (SNI + IP), não os corpos JSON.\n\nAtive o MITM nas Configurações e roteie o canal pelo Roku Dev Studio para inspecionar os corpos.`,

  // ── Embedded JSON/XML fragment highlight (network-embedded-structured.ts) ────────────
  embeddedViewTitle: (label: string): string => `Clique para ver ${label} formatado (abre em um modal)`,

  // ── Hotspot Capture Setup modal (hotspot-setup-modal.ts) ─────────────────────────────
  setupPacketCapture: 'Configurar captura de pacotes',
  requestingCaptureAccess: 'Solicitando acesso de captura…',
  captureAccessGranted: 'Acesso de captura concedido.',
  setupCancelled: 'A configuração foi cancelada.',
  setupFailed: 'A configuração falhou.',
  setupFailedRetry: 'A configuração falhou — tente novamente.',

  // ── Filter-syntax help modal (network-filter-help.ts) ────────────────────────────────
  filterHelpHeading: 'Filtrando sessões',
  filterHelpAria: 'Ajuda de filtro',
  addToFilter: 'Adicionar ao filtro',
  filterDescHost: 'Corresponde ao nome de host (substring).',
  filterDescMethod: 'Método HTTP.',
  filterDescStatus: 'Código de status, ou uma classe como 4xx / 5xx.',
  filterDescType: 'Content-Type da resposta (alias content-type:).',
  filterDescKind: 'Tipo de sessão.',
  filterDescPath: 'Caminho da URL (substring; alias url:).',
  filterHelpIntro:
    'Digite texto livre para corresponder a host, caminho, método, status, tipo ou Content-Type. Use <code>field:value</code> para correspondências precisas e separe os termos com <strong>vírgulas</strong> para corresponder a <strong>qualquer</strong> um deles (OR).',
  filterHelpNoteLead: 'Exemplo: ',
  filterHelpNoteExplain:
    ' mostra qualquer sessão em roku.com <em>ou</em> com status 4xx <em>ou</em> usando POST. Clique em qualquer exemplo para adicioná-lo.',

  // ── Port-conflict modal (port-conflict-modal.ts) ─────────────────────────────────────
  holderAnotherApp: 'Outro aplicativo',
  holderWithPid: (name: string, pid: number): string => `${name} (PID ${pid})`,
  holderPidOnly: (pid: number): string => `PID ${pid}`,
  portResolvedTitle: 'Porta do proxy disponível',
  portResolvedMsg:
    'A porta do proxy está livre novamente — o Inspetor de rede pode capturar tráfego. Esta mensagem fecha automaticamente.',
  recheckStatus: 'Verificar status novamente',
  openNetworkInspectorSettings: 'Abrir configurações do Inspetor de rede',

  // ── Traffic-rules modal (traffic-rules-modal.ts) ─────────────────────────────────────
  trafficRules: 'Regras de tráfego',
  deviceFallbackName: 'Dispositivo Roku',
  serialTitle: (serial: string): string => `Serial ${serial}`,
  rulesNote:
    'Aplica-se apenas ao tráfego que este dispositivo roteia pelo proxy do Roku Dev Studio — o restante do tráfego (sem proxy) não é afetado. As alterações entram em vigor imediatamente.',
  deviceTrafficTitle: 'Tráfego do dispositivo',
  blockAllTitle: 'Bloquear todo o tráfego via proxy',
  blockAllDesc: 'Rejeitar toda requisição roteada pelo proxy.',
  bandwidthLimit: 'Limite de banda',
  addedLatency: 'Latência adicionada',
  addedLatencyMsTitle: 'Latência adicionada (ms)',
  hostsBlockedNote: 'As regras por host não se aplicam enquanto todo o tráfego via proxy estiver bloqueado.',
  perHostRules: 'Regras por host',
  addHostTitle:
    'Host, ou host/caminho. Use * como curinga (ex.: *.example.com corresponde a prod + staging, /v1/* corresponde a qualquer caminho sob /v1/).',
  noRulesYet: 'Nenhuma regra ainda — adicione um host ou caminho acima para substituir seu comportamento.',
  saveChanges: 'Salvar alterações',
  restartToSave: 'Reinicie o Roku Dev Studio para habilitar o salvamento das Regras de tráfego.',
  failedSaveRules: 'Falha ao salvar as Regras de tráfego.',
  // Rewrite op type labels (dropdown options).
  rwRedirectHost: 'Redirecionar host',
  rwSetPath: 'Definir caminho',
  rwSetQuery: 'Definir parâmetro de consulta',
  rwRemoveQuery: 'Remover parâmetro de consulta',
  rwSetHeader: 'Definir cabeçalho',
  rwRemoveHeader: 'Remover cabeçalho',
  rwBodyReplace: 'Substituir no corpo',
  rwSetStatus: 'Definir status',
  // Rewrite op field placeholders.
  rwHeaderName: 'Nome do cabeçalho',
  rwValue: 'Valor',
  rwStatusCode: 'Código de status (ex.: 503)',
  rwHostOrHostPort: 'host ou host:port',
  rwNewPath: '/new/path',
  rwParamName: 'Nome do parâmetro',
  rwFind: 'Localizar',
  rwReplaceWith: 'Substituir por',
  // Rewrite op row chrome.
  rewriteTargetAria: 'Alvo da reescrita',
  rewriteTypeAria: 'Tipo de reescrita',
  regexTreatTitle: 'Tratar Localizar como expressão regular',
  regexLabel: 'regex',
  removeRewrite: 'Remover reescrita',
  rewriteTitle: 'Reescrita',
  rewriteHint: 'Aplicado ao encaminhar (não com Bloquear / Redefinir / Simular)',
  addRewrite: '+ Adicionar reescrita',
  // Per-host rule scope badges.
  scopeWildcardPath: 'Caminho curinga',
  scopeSinglePath: 'Caminho único',
  scopeWildcardHost: 'Host curinga',
  scopeAllRequests: 'Todas as requisições',
  // Per-host rule controls.
  collapseExpandRule: 'Recolher / expandir regra',
  editUrl: 'Editar URL',
  editInterceptUrlAria: 'Editar URL de interceptação',
  deleteRule: 'Excluir regra',
  block: 'Bloquear',
  resetTitle: 'Descartar a conexão (simular uma falha de rede)',
  mock: 'Simular',
  mockTitle: 'Retornar uma resposta pré-definida em vez de encaminhar upstream',
  latencyPlaceholder: 'Latência',
  mockFieldStatus: 'Status',
  mockFieldContentType: 'Content-Type',
  mockFieldDelay: 'Atraso',
  httpStatusCodeTitle: 'Código de status HTTP',
  delayTitle: 'Atraso antes de responder (ms)',
  mockBodyPlaceholder: 'Corpo da resposta (ex.: {&quot;error&quot;:&quot;forced&quot;})',
  // Bandwidth preset/label/placeholder for the "no cap" option (kbps 0). The other presets
  // ('8 Mbps', '512 kbps', …) are units and stay verbatim in BW_OPTIONS. NOTE: parseBandwidth()
  // still matches the lowercased literal 'unlimited', so keep this word round-trippable.
  bandwidthUnlimited: 'Ilimitado',
  bwCustomTitle: 'Escolha uma predefinição ou digite um limite personalizado (ex.: 3 Mbps ou 1500 kbps)',
  bwPresetsAria: 'Mostrar predefinições de banda',
  throttleCapSpeed: (limit: string): string => `a velocidade é limitada ao Limite do dispositivo (${limit})`,
  throttleFloorLatency: (ms: number): string => `a latência tem um mínimo definido pela Latência do dispositivo (${ms} ms)`,
  throttleNote: (parts: string[]): string => `Por host ${parts.join(', e ')}.`,

  // ── Find-in-content modal (network-find-modal.ts) ────────────────────────────────────
  chipUrl: 'URL',
  chipRequest: 'Corpo da requisição',
  chipResponse: 'Corpo da resposta',
  chipHeaders: 'Cabeçalhos',
  chipUrlTitle: 'URL da requisição, nome de host e SNI',
  chipRequestTitle: 'Payload da requisição',
  chipResponseTitle: 'Payload da resposta',
  chipHeadersTitle: 'Cabeçalhos de requisição e resposta',
  noMatches: 'Nenhuma correspondência',
  requestCount: (n: number): string => `${n} requisiç${n === 1 ? 'ão' : 'ões'}`,
  hitCount: (n: number): string => ` · ${n} ocorrência${n === 1 ? '' : 's'}`,
  setColorAria: (c: string): string => `Definir cor ${c}`,
  customColorTitle: 'Cor personalizada…',
  customColorAria: 'Cor personalizada',
  hexColorAria: 'Cor hexadecimal',
  changeColorTitle: 'Alterar cor',
  changeColorAria: 'Alterar cor do termo',
  findPlaceholder: 'Localizar',
  searchTermAria: 'Termo de busca',
  clearText: 'Limpar texto',
  matchCase: 'Diferenciar maiúsculas',
  useRegexTitle: 'Usar expressão regular',
  deleteSearchEntry: 'Excluir entrada de busca',
  regexLikeHint: 'Isto parece uma expressão regular.',
  useRegexBtn: 'Usar regex',
  findAriaLabel: 'Localizar no tráfego de rede',
  findTitle: 'Localizar no tráfego',
  closeEsc: 'Fechar (Esc)',
  addSearchEntryTitle: 'Adicionar outra entrada de busca',
  addSearchEntry: '+ Buscar mais…',
  noteColor: 'Cada termo recebe uma cor; uma requisição mostra a cor de cada termo correspondente.',
  noteWhitespace: 'Espaços em branco são ignorados — corpos minificados e formatados correspondem igualmente.',
  noteBinary: 'Corpos binários (base64) não são pesquisados.',
  noteEnter: 'Pressione <kbd>Enter</kbd> para ir à primeira correspondência e fechar.',
  noteShiftEnter: (max: number): string =>
    `<kbd>Shift</kbd>+<kbd>Enter</kbd> adiciona outro termo (até ${max}).`,
  noteArrows: '<kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> (ou as setas do cabeçalho) navegam entre as correspondências.',

  // ── Live tab (network-tab.ts) ────────────────────────────────────────────────────────
  capNotice: (shown: number, total: number): string =>
    `Mostrando as ${shown} sessões mais recentes de ${total} — use o filtro para refinar os resultados.`,
  loadingData: 'Carregando dados capturados…',
  // Large-body "shown as raw text" explainer modal.
  shownAsRawText: 'Mostrado como texto bruto',
  thisBody: 'Este corpo',
  largeBodyIntro: (sizeLabel: string, limitKb: string): string =>
    `Este corpo tem <strong>${sizeLabel}</strong> — maior que o limite de ${limitKb} KB para renderizar uma árvore JSON/XML recolhível com destaque de sintaxe. Para manter o inspetor responsivo, o corpo <strong>inteiro</strong> é mostrado como texto bruto. Nada é truncado ou ocultado.`,
  largeBodyNote:
    'Copiar, Salvar e Localizar continuam operando sobre o corpo completo. Fragmentos JSON/XML incorporados permanecem clicáveis. Selecione uma resposta menor para ver a árvore formatada.',
  // Empty-state hints.
  noProxiedSessions: 'Nenhuma sessão via proxy ainda.',
  noSessions: 'Nenhuma sessão ainda.',
  proxyAddrFallback: 'machine-ip:8888',
  gatewayAddrFallback: 'gateway:8888',
  anotherApp: 'outro aplicativo',
  mitmActiveLine: (addr: string): string =>
    `O proxy MITM está ativo em <strong>${addr}</strong> — roteie as requisições do seu canal Dev por ele para capturá-las.`,
  mitmPortConflictLine: (port: number, who: string): string =>
    `O proxy MITM não pode usar a porta ${port} — ${who} está usando-a. Clique em <strong>Porta do proxy indisponível</strong> acima para fechá-la ou alterar a porta.`,
  mitmFailedLine: (err: string): string => `O proxy MITM não conseguiu iniciar: ${err}.`,
  mitmStarting: 'O proxy MITM está iniciando — reinicie o Roku Dev Studio se isto persistir.',
  enableMitmSettings: 'Ative o <strong>proxy MITM</strong> em Configurações → Inspetor de rede.',
  hotspotBlockedMitmLine: (addr: string): string =>
    `A captura por hotspot está bloqueada, mas o proxy MITM em <strong>${addr}</strong> ainda pode registrar as requisições via proxy. Use <code>host:port</code> apenas no BrightScript (ex.: <code>192.168.2.1:8888</code>), não o IP do dispositivo e não <code>http://</code>.`,
  mitmActiveNoCaptureLine: (addr: string): string =>
    `O proxy MITM está ativo em <code class="ni-hint-code">${addr}</code>. Roteie seu canal dev por ele para capturar as requisições de rede.`,
  mitmDecryptingHint: ' O proxy MITM está descriptografando o HTTPS do canal dev roteado pelo Roku Dev Studio.',
  hotspotEncryptedHint: ' Os corpos HTTPS são criptografados no modo de captura por hotspot — ative o MITM nas Configurações para canais Dev.',
  capturingOnHotspot: 'Capturando no hotspot. Navegue ou reproduza conteúdo no Roku.',
  connectWifiHint:
    'Conecte o Roku à mesma rede Wi‑Fi (ou ao hotspot da sua máquina), depois ative o <strong>proxy MITM</strong> em Configurações → Inspetor de rede para capturar o HTTPS do canal dev.',
  sessionListAria: 'Lista de sessões de rede. Use as teclas de seta para navegar.',
  // Layout toggle.
  layoutToggleTitle: (stacked: boolean): string =>
    `Painéis de requisição e resposta - ${stacked ? 'Lado a lado' : 'Empilhar verticalmente'}`,
  // "Proxied" filter tooltips.
  proxiedLockedTitle:
    'Todo o tráfego passa pelo proxy do Roku Dev Studio neste modo, então isto está sempre ativado. Este controle será habilitado quando o dispositivo Roku estiver conectado pelo hotspot.',
  proxiedUnlockedTitle:
    'Mostrar apenas requisições que passam pelo proxy do Roku Dev Studio (cabeçalhos + corpo completos), ocultando os metadados SNI/DNS da captura por hotspot',
  // Media context menu + save dialogs.
  copyImage: 'Copiar imagem',
  saveImageAs: 'Salvar imagem como…',
  saveFile: 'Salvar arquivo…',
  saveImageDialog: 'Salvar imagem',
  saveFileDialog: 'Salvar arquivo',
  // Export toasts + dialogs.
  fileFallback: 'arquivo',
  savedPackets: (n: number, path: string): string =>
    `${n} pacote${n === 1 ? '' : 's'} salvo${n === 1 ? '' : 's'} em ${path}.`,
  failedSavePcap: 'Falha ao salvar a captura de pacotes.',
  noRequestsToExport: 'Nenhuma requisição para exportar.',
  noHttpToExport: 'Nenhuma transação HTTP para exportar como HAR.',
  exportHarDialog: 'Exportar sessões como HAR',
  exportSessionDialog: 'Exportar sessão de rede',
  // Native save-dialog titles + filter names (main/ipc/network-inspector-handlers.ts).
  exportDialogTitles: {
    savePcap: 'Salvar captura de pacotes',
    pcapFilter: 'Wireshark PCAP',
    caPem: 'Exportar certificado CA do RDS (PEM)',
    pemFilter: 'Certificado PEM',
    caCrt: 'Exportar certificado CA do RDS (CRT)',
    certFilter: 'Certificado'
  },
  exportedRequests: (n: number, path: string): string =>
    `${n} requisiç${n === 1 ? 'ão' : 'ões'} exportada${n === 1 ? '' : 's'} para ${path}.`,
  failedExportSession: 'Falha ao exportar a sessão.',
  // Session count tooltips.
  countMatchingTitle: (visible: number, captured: number): string =>
    `${visible} correspondentes de ${captured} sessões capturadas`,
  capturedSessionsTitle: (n: number): string =>
    n === 1 ? '1 sessão capturada' : `${n} sessões capturadas`,
  // Capture-button "blocked" tooltips.
  issuePortInUse: (port: number, who: string): string =>
    `Inspetor de rede indisponível — a porta ${port} está em uso${who}.`,
  issueMitm: (err: string): string => `Problema no Inspetor de rede — proxy MITM: ${err}`,
  captureErrorFallback: 'Erro do Inspetor de rede',
  stopCapturing: 'Parar captura',
  startCapturing: 'Iniciar captura',
  setupNotAvailable: 'A configuração não está disponível nesta build.',
  // Header setup badge.
  captureBlocked: 'Captura bloqueada',
  captureSetup: 'Configuração de captura',
  setupBadgeTitlePrereq: (title: string): string => `${title} — clique para ver as instruções de configuração`,
  setupBadgeTitle: 'Configuração da captura por hotspot — clique para ver as instruções',
  // Header port badge.
  portBadgeTitle: (title: string): string => `${title} — clique para ver os detalhes`
};

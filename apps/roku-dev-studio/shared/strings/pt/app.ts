/**
 * Brazilian Portuguese (pt-BR) translation of the main app shell strings
 * (see ../app.ts). Same object name, key order, nesting, and function
 * signatures as the English source; only literal display text is translated.
 *
 * Parametrized strings are functions returning the composed text — the standard
 * way to keep interpolation translatable without a runtime format library.
 */
export const app = {
  // Generic display fallbacks
  notAvailable: 'N/A',
  unknown: 'Desconhecido',
  unknownError: 'Erro desconhecido',
  unknownRoku: 'Roku desconhecido',
  rokuDevice: 'Dispositivo Roku',
  remote: 'Remoto',

  // Scan button (sidebar + title bar)
  scan: 'Buscar',

  // Remote locations — sidebar section
  statusOffline: 'Offline',
  connecting: 'Conectando...',
  serverInfoTitle: 'Informações do servidor',
  deviceCount: (n: number): string => `${n} dispositivo${n !== 1 ? 's' : ''}`,
  scanningForDevices: 'Buscando dispositivos...',
  connectingToRelayServer: 'Conectando ao servidor de relay...',
  serverOffline: 'Servidor offline',
  noRokuDevicesFound: 'Nenhum dispositivo Roku encontrado',
  confirmRemoveLocation: (name: string): string => `Remover local "${name}"?`,

  // Add-location flow (errors surfaced via alert)
  locationHostExists: (host: string, name: string): string =>
    `Já existe um local com o host "${host}" ("${name}").`,
  locationServerExists: (name: string): string =>
    `Já existe um local com este endereço de servidor ("${name}").`,
  unableToConnectRelay:
    'Não foi possível conectar ao servidor de relay. Verifique o endereço e confirme se o servidor está em execução.',
  failedToConnectRelay: 'Falha ao conectar ao servidor de relay',
  addLocation: 'Adicionar local',

  // Server capabilities modal
  serverCapabilities: {
    remote: { label: 'Controle remoto', desc: 'Comandos de tecla e navegação' },
    apps: { label: 'Apps', desc: 'Listar e iniciar apps instalados' },
    query: { label: 'Consulta', desc: 'Informações do dispositivo, status do reprodutor de mídia' },
    devApp: { label: 'Dev App', desc: 'Fazer sideload de canais de desenvolvimento' },
    screenshot: { label: 'Captura de tela', desc: 'Capturar a tela do dispositivo' },
    console: { label: 'Console', desc: 'Saída de depuração do BrightScript' },
    debugger: { label: 'Depurador', desc: 'Pontos de interrupção, execução passo a passo, inspeção de variáveis' },
    appConnector: { label: 'App Connector', desc: 'Integração com TrackerTask do RALE' },
    deepLink: { label: 'Deep-Link', desc: 'Iniciar conteúdo com parâmetros' },
    networkInspector: { label: 'Inspetor de rede', desc: 'Capturar DNS/SNI/HTTP + proxy MITM' }
  },
  capSupported: 'Compatível',
  capNeedsRoot: 'Requer root',
  capNotSupported: 'Não compatível',
  capabilitiesHeading: 'Recursos',

  // Device cards + tabs
  devBadge: 'Dev',
  remoteOff: 'Remoto desligado',
  ecpBadgeDisabledTitle: 'O controle por apps móveis está desativado',
  ecpLimited: 'ECP limitado',
  ecpBadgeLimitedTitle: 'ECP limitado: texto, início de apps e consulta funcionam; teclas completas podem não funcionar',
  deviceTypeTv: 'TV',
  deviceTypeStb: 'STB',
  labelType: 'Tipo',
  labelIp: 'IP',
  labelModel: 'Modelo',
  labelSerial: 'Série',
  labelSw: 'SW',
  expand: 'Expandir',
  minimize: 'Minimizar',
  reconnect: 'Reconectar',
  atLocation: (value: string, location: string): string => `${value} @ ${location}`,

  // Device context menu
  copyDeviceName: 'Copiar nome do dispositivo',
  copyIpAddress: 'Copiar endereço IP',
  copyModelNumber: 'Copiar número do modelo',
  copySerialNumber: 'Copiar número de série',
  copyAllDetails: 'Copiar todos os detalhes',
  deviceDetails: (d: {
    deviceName?: string;
    ip?: string;
    modelName?: string;
    modelNumber?: string;
    serialNumber?: string;
    softwareVersion?: string;
    deviceId?: string;
    networkType?: string;
    wifiMac?: string;
  }): string =>
    `Nome do dispositivo: ${d.deviceName}
Endereço IP: ${d.ip}
Nome do modelo: ${d.modelName}
Número do modelo: ${d.modelNumber}
Número de série: ${d.serialNumber}
Versão do software: ${d.softwareVersion || 'N/A'}
ID do dispositivo: ${d.deviceId || 'N/A'}
Tipo de rede: ${d.networkType || 'N/A'}
MAC WiFi: ${d.wifiMac || 'N/A'}`,

  // Offline / connection state
  deviceOffline: 'Dispositivo offline',
  unableToConnectDevice: 'Não foi possível conectar a este dispositivo Roku.',
  retryConnection: 'Tentar conectar novamente',

  // Device hardware-image modal
  labelScreenSize: 'Tamanho da tela',
  labelOsVersionBuild: 'Versão e build do SO',
  checkForUpdates: 'Verificar atualizações',
  restartDevice: 'Reiniciar dispositivo',
  checkForUpdatesLabel: 'Verificar atualizações',
  restartDeviceLabel: 'Reiniciar dispositivo',
  deviceImageAria: (name: string): string => `${name} — imagem do dispositivo`,
  viewLargerImage: (name: string): string => `Ver imagem maior: ${name}`,
  deviceIpUnavailable: 'O IP do dispositivo está indisponível.',
  setDevPasswordFirst: 'Defina primeiro a senha de desenvolvedor deste dispositivo (aba Dev App).',
  actionSucceeded: (label: string): string => `${label} concluído com sucesso.`,
  actionFailed: (label: string): string => `${label} falhou.`,
  actionFailedWith: (label: string, err: string): string => `${label} falhou: ${err}`,

  // Apps tab
  installedApps: 'Apps instalados',
  installedAppsAndTvInputs: 'Apps instalados e entradas de TV',
  rawListOfApps: 'Lista bruta de apps',
  appsAndInputsList: 'Lista de apps e entradas',
  appTileTitle: (name: string, id: string): string => `${name}\nID: ${id}\nClique para iniciar`,
  switchToInput: (name: string): string => `Mudar para ${name}`,
  failedToLoadApps: 'Falha ao carregar os apps:',
  errorPrefix: 'Erro:',
  installedAppsHeader: 'APPS INSTALADOS',
  inputsHeader: 'ENTRADAS',
  copied: 'Copiado!',
  copyList: 'Copiar lista',

  // Auto-connect toasts
  connectedAutomatically: (label: string): string => `Conectado a ${label} automaticamente.`,
  connectedMultipleAutomatically: (count: number): string =>
    `Conectado a ${count} dispositivos salvos automaticamente.`,

  // Manual connect
  couldNotConnectToIp: (ip: string): string =>
    `Não foi possível conectar a ${ip}. Verifique se o dispositivo Roku está ligado e acessível.`,
  connectionError: (err: string): string => `Erro de conexão: ${err}`,

  // Custom title bar
  windowControlsUnavailable: 'Os controles da janela estão indisponíveis. Feche e reinicie o Roku Dev Studio.',
  restoreDown: 'Restaurar',
  maximize: 'Maximizar',

  // Log file
  couldNotOpenLogFile: (err: string): string => `Não foi possível abrir o arquivo de log: ${err}`,

  // File drag & drop onto the main window
  fileDropOverlayReadyOne: (viewerLabel: string): string => `Solte para abrir em ${viewerLabel}`,
  fileDropOverlayReadyMany: 'Solte para abrir',
  fileDropOverlayUnsupported: 'Tipo de arquivo não suportado',
  fileDropOverlayGeneric: 'Solte arquivos para abrir',
  fileDropLogViewerLabel: 'Visualizador de logs',
  fileDropNetworkSessionViewerLabel: 'Visualizador de sessão de rede',
  fileDropOpenedOne: (name: string, viewerLabel: string): string => `"${name}" aberto em ${viewerLabel}`,
  fileDropOpenedMany: (count: number): string => `${count} arquivos abertos`,
  fileDropOpenedWithSkipped: (openedCount: number, unsupportedCount: number): string =>
    `${openedCount} arquivo(s) aberto(s), ${unsupportedCount} não suportado(s) ignorado(s)`,
  fileDropUnsupportedOne: (name: string): string => `"${name}" não é um tipo de arquivo suportado`,
  fileDropUnsupportedMany: (count: number): string => `${count} arquivos não suportados — nada foi aberto`,
  fileDropFailed: 'Não foi possível abrir o(s) arquivo(s) solto(s)',

  // Help modal
  searchHelpGuide: 'Buscar na ajuda e guia',

  // ECP / Control by Mobile Apps warnings
  ecpWarnDisabledTitle: 'Controle por apps móveis desativado',
  ecpWarnDisabledDesc:
    'O controle remoto está desligado. Ative "Controle por apps móveis" → Acesso à rede no seu dispositivo Roku para usar o controle, os apps e a entrada de texto.',
  ecpWarnLimitedTitle: 'Controle por apps móveis: limitado',
  ecpWarnLimitedDesc:
    'A entrada de texto, o início de apps e a consulta de apps funcionam. As teclas completas do controle podem não estar disponíveis — defina o Acesso à rede como <strong>Permissivo</strong> ou <strong>Ativado</strong> para o controle completo.',
  ecpWarnSubnetTitle: 'Permissivo: verifique a rede',
  ecpWarnSubnetDesc:
    'O modo permissivo aceita comandos apenas da mesma sub-rede. Sua máquina pode estar em uma sub-rede diferente; se os comandos falharem, verifique sua rede.',

  // App Connector / TrackerTask
  trackerTaskSaved: 'TrackerTask.xml salvo com sucesso!',
  failedToSaveTrackerTask: 'Falha ao salvar TrackerTask.xml:',
  errorSavingTrackerTask: 'Erro ao salvar TrackerTask:',
  integrationInfoCopied: 'Informações de integração copiadas para a área de transferência!',
  failedToCopyClipboard: 'Falha ao copiar para a área de transferência',

  // App init
  appInitFailed: 'Falha na inicialização do app:',

  // ───────────────────────────────────────────────────────────────────────
  // Static index.html markup (filled by applyI18n). Inline English is kept as
  // the fallback; these mirror it (with ui-text-casing applied to labels).
  // ───────────────────────────────────────────────────────────────────────

  // Title bar
  titleBarToggleSidebar: 'Alternar barra lateral',
  titleBarScanTitle: 'Buscar dispositivos locais e remotos',
  titleBarScanAria: 'Buscar dispositivos',
  titleBarHelpTitle: 'Ajuda e guia do usuário',
  titleBarHelpAria: 'Ajuda e guia',
  helpAndGuide: 'Ajuda e guia',
  floatingRemoteToggleTitle: 'Alternar um controle remoto flutuante que acompanha você fora das abas Remoto e Dev App',
  floatingRemoteToggleAria: 'Alternar controle remoto flutuante',
  floatingRemote: 'Controle remoto flutuante',
  tryDemoAppTitle: 'Experimente o canal de demonstração incluso Roku Dev Studio Showcase',
  tryDemoAppAria: 'Experimentar App de Demonstração',
  tryDemoApp: 'Experimentar App de Demonstração',
  appMenu: 'Menu do app',
  zoomOut: 'Diminuir zoom',
  zoomIn: 'Aumentar zoom',
  resetZoom: 'Redefinir zoom para 100%',
  currentZoomAria: 'Zoom atual; clique para redefinir para 100%',

  // Sidebar — device discovery
  sidebarLocal: 'Local',
  manualConnect: 'Conexão manual',
  addRemoteLocation: 'Adicionar local remoto',
  viewLogsTitle: 'Ver logs de depuração (Desktop/roku-connector-debug.log)',
  viewLogs: 'Ver logs',

  // Welcome panel
  welcomeSubtitle:
    'Descubra dispositivos Roku localmente ou via relays remotos, faça sideload e deep-link de canais, depure BrightScript ao vivo com um console Telnet em streaming, automatize fluxos de teste de ponta a ponta e traga agentes de IA para o seu ciclo de desenvolvimento via MCP.',
  featureDeviceDiscovery: 'Descoberta de dispositivos',
  featureDeviceDiscoveryDesc: 'Descubra automaticamente dispositivos Roku na sua rede local via SSDP.',
  featureAppsDeepLinking: 'Apps e Deep-Linking',
  featureAppsDeepLinkingDesc: 'Navegue, inicie apps e use Deep-Links com parâmetros personalizados.',
  featureDevAppDesc: 'Faça sideload de canais de desenvolvimento e capture telas do Dev App automaticamente.',
  featureAppConnectorDesc: 'Execute funções BrightScript em um app com sideload.',
  featureFiddle: 'Fiddle',
  featureFiddleDesc: 'Execute trechos de BrightScript no dispositivo em um editor Monaco.',
  featureMcpServer: 'Servidor MCP',
  featureMcpServerDesc: 'Exponha o Roku Dev Studio a agentes de IA usando o servidor MCP.',
  featureDeviceRemote: 'Controle do dispositivo',
  featureDeviceRemoteDesc: 'D-pad completo, controles de mídia e entrada de texto — como um controle de verdade.',
  featureQueryDesc: 'Consulte informações do dispositivo, o estado do reprodutor de mídia e o registro via ECP.',
  featureConsoleDesc: 'Veja a saída de depuração do BrightScript via Telnet, filtre, pesquise e depure',
  featureActionScriptsDesc: 'Encadeie toques de tecla, inicializações e chamadas RALE em fluxos automatizados.',
  featureNetworkInspectorDesc: 'Inspecione o tráfego HTTP/HTTPS do Dev App via um proxy MITM.',
  featureRemoteLocations: 'Locais remotos',
  featureRemoteLocationsDesc: 'Conecte-se a dispositivos Roku em qualquer lugar via servidores de relay.',

  // Device-panel tabs
  tabRemote: 'Remoto',
  tabApps: 'Apps',
  tabQuery: 'Consulta',
  tabDevApp: 'Dev App',
  tabConsole: 'Console',
  tabAppConnector: 'App Connector',
  tabActionScripts: 'Scripts de ação',
  tabNetwork: 'Rede',

  // Device panel — performance strip & paused nav
  perfCpu: 'CPU',
  perfMem: 'Mem',
  perfObj: 'Obj',
  devicePerfPaused: 'Desempenho do dispositivo pausado — traga o Dev App para o primeiro plano para retomar.',
  devicePerfPausedShort: 'Desempenho do dispositivo pausado',
  launch: 'Iniciar',
  sideloadDevApp: 'Fazer sideload do Dev App',
  sideload: 'Sideload',

  // Shared warnings (Developer Mode / Control by Mobile Apps)
  developerModeNotEnabled: 'Modo de desenvolvedor não ativado',
  ecpNotEnabledTitle: 'Controle por apps móveis não ativado',
  howToEnable: 'Como ativar',
  devAppDevModeDesc: 'O sideload do Dev App exige que o modo de desenvolvedor esteja ativado no seu dispositivo Roku.',
  queryDevModeDesc: 'Alguns recursos de consulta podem ser limitados. Ative o modo de desenvolvedor para acesso completo.',
  inspectorDevModeDesc: 'O App Connector exige o modo de desenvolvedor e um canal com sideload contendo TrackerTask.',

  // Remote Section
  keyboardShortcutsRemoteTitle: 'Atalhos de teclado para este controle',
  keyboardShortcutsQuickRemoteTitle: 'Atalhos de teclado para o controle rápido',
  keyboardRemoteHelpAria: 'Ajuda de atalhos de teclado do controle',
  showDevicePerformance: 'Mostrar desempenho do dispositivo',
  remoteBack: 'Voltar',
  remoteHome: 'Início',
  remoteOptions: 'Opções',
  remoteReplay: 'Repetir',
  remoteVolUp: 'Vol +',
  remoteMute: 'Mudo',
  remoteVolDown: 'Vol -',
  remotePower: 'Liga/Desliga',
  remoteRewind: 'Retroceder',
  remotePlayPause: 'Reproduzir/Pausar',
  remoteForward: 'Avançar',
  sendTextPlaceholder: 'Digite o texto para enviar ao Roku...',
  sendText: 'Enviar texto',
  rokuSecretScreens: 'Telas secretas do Roku',
  secretScreensTitle: 'Sequências de teclas do controle para as telas secretas e de diagnóstico do Roku',
  sectionRemoteControl: 'Controle remoto',
  sectionObjectCounts: 'Contagem de objetos BrightScript (Dev)',
  cpuUsage: 'Uso de CPU',
  sectionMemoryUsage: 'Uso de memória',

  // Remote Section — metrics quadrants
  brightScriptObjects: 'Objetos BrightScript',
  objectMetricsMode: 'Modo de métricas de objetos',
  objectsModeCount: 'Contagem',
  objectsModeMemory: 'Memória',
  objectsTop10: 'Top 10',
  cpuMetricsMode: 'Modo de métricas de CPU',
  cpuModePercent: 'CPU %',
  cpuModeProcess: 'Processo',
  systemMemory: 'Memória do sistema',
  legendTotal: 'Total',
  legendUser: 'Usuário',
  legendKernel: 'Kernel',
  legendUsed: 'Usada',
  legendResident: 'Residente',
  legendAnonymous: 'Anônima',
  legendShared: 'Compartilhada',
  legendLimit: 'Limite',

  // Apps tab
  deepLink: 'Deep-Link',
  moreLaunchOptions: 'Mais opções de inicialização',
  saveAndLaunch: 'Salvar e iniciar',
  deeplinkSaved: 'Salvo',
  selectSavedDeepLink: '-- Selecionar Deep-Link salvo --',
  deleteSavedDeepLink: 'Excluir Deep-Link salvo',
  appId: 'ID do app',
  deeplinkAppIdPlaceholder: 'ex.: 31440',
  contentId: 'ID do conteúdo',
  contentIdPlaceholder: 'Identificador do conteúdo',
  mediaType: 'Tipo de mídia',
  selectPlaceholder: '-- Selecionar --',
  mediaTypeMovie: 'Filme',
  mediaTypeSeries: 'Série',
  mediaTypeEpisode: 'Episódio',
  mediaTypeLive: 'Ao vivo',
  manageMediaTypes: 'Gerenciar tipos de mídia',
  addParameter: 'Adicionar parâmetro',
  deeplinkParamKeyPlaceholder: 'Chave',
  deeplinkParamValuePlaceholder: 'Valor',
  removeParameter: 'Remover parâmetro',
  listApps: 'Listar',
  loadingApps: 'Carregando apps...',
  inputsSectionLabel: 'Entradas',
  noAppsFound: 'Nenhum app encontrado. Clique em Atualizar para carregar.',

  // Dev App tab
  auth: 'Autenticação',
  password: 'Senha',
  verify: 'Verificar',
  remember: 'Lembrar',
  selectPackage: 'Selecionar pacote',
  install: 'Instalar',
  typeTextShortPlaceholder: 'Digite o texto...',
  send: 'Enviar',
  autoScreenshot: 'Captura automática',
  screenshot: 'Captura de tela',
  copyScreenshot: 'Copiar captura de tela',
  downloadScreenshot: 'Baixar captura de tela',
  clearScreenshot: 'Limpar captura de tela',
  capture: 'Capturar',
  clickCapture: 'Clique em Capturar',

  // Query tab
  deviceQueries: 'Consultas do dispositivo',
  queryDeviceInfo: 'Device Info',
  queryAllApps: 'All Apps',
  queryActiveApp: 'Active App',
  queryMediaPlayer: 'Media Player',
  queryPlugins: 'Plugins',
  queryMemory: 'Memory',
  developerQueries: 'Consultas de desenvolvedor',
  openFiddle: 'Abrir Fiddle',
  openFiddleTitle: 'Abrir o BrightScript Fiddle com este dispositivo pré-selecionado',
  openFiddleAria: 'Abrir o BrightScript Fiddle para este dispositivo',
  qsSceneGraph: 'SceneGraph',
  qsSgRendezvous: 'SG Rendezvous',
  qsFwBeacons: 'FW Beacons',
  qsPerformance: 'Desempenho',
  qsOther: 'Outros',
  qsCustom: 'Personalizado',
  queryAllNodes: 'All Nodes',
  queryRootNodes: 'Root Nodes',
  track: 'Track',
  events: 'Events',
  untrack: 'Untrack',
  queryFrameRate: 'Frame Rate',
  queryChannelPerf: 'Channel Perf',
  queryAppState: 'App State',
  queryRegistry: 'Registry',
  queryObjectCounts: 'Object Counts',
  run: 'Executar',
  customQueryPlaceholder: 'ex. /query/device-info',
  results: 'Resultados',
  removePluginPlaceholder: 'ID do app (ex.: 987654_cf9a)',
  removePlugin: 'Remover plugin',

  // Console (Telnet) tab
  telnetConsole: 'Console Telnet',
  copyAllLogs: 'Copiar todos os logs',
  saveLogsToFile: 'Salvar logs em arquivo',
  clearConsole: 'Limpar console',
  clearOptions: 'Opções de limpeza',
  clearRelayOnly: 'Limpar (apenas no servidor de relay)',
  clearLocalAndRelay: 'Limpar (local e no servidor de relay)',
  findResizeTitle: 'Arraste para ampliar a busca (clique duplo para redefinir)',
  consoleMonitor: 'Monitor do console',
  telnetPortBadge: 'Porta 8085',
  connectPullRelayTitle: 'Conectar e puxar o buffer do relay',
  connectOptions: 'Opções de conexão',
  connectLiveOnly: 'Conectar (ignorar o buffer de logs existente)',
  telnetPlaceholder: 'Conecte-se para ver a saída de depuração do BrightScript',
  jumpToLatestLogs: 'Ir para os logs mais recentes',

  // App Connector tab
  connection: 'Conexão',
  port: 'Porta',
  logVerbosity: 'Verbosidade do log',
  logVerbosityTitle: 'Nível do logger RALE aplicado ao conectar',
  verbosityOff: 'Desligado',
  verbosityError: 'Erro',
  verbosityWarning: 'Aviso',
  verbosityInfo: 'Info',
  verbosityDebug: 'Depuração',
  integrationGuide: 'Guia de integração',
  integrationGuideTitle: 'Como integrar o TrackerTask com o App Connector',
  executeFunction: 'Executar função',
  functionLabel: 'Função',
  connectToLoadFunctions: '-- Conecte-se para carregar funções --',
  execute: 'Executar',
  parameters: 'Parâmetros',
  selectFunctionParams: 'Selecione uma função para ver os parâmetros',
  response: 'Resposta',
  updateNode: 'Atualizar nó',
  updateNodeBtnTitle: 'Após Get Node by ID: selectNode, depois setField, removeField ou Adicionar campo via setField',
  action: 'Ação',
  fieldAction: 'Ação do campo',
  updateField: 'Atualizar campo',
  addField: 'Adicionar campo',
  removeField: 'Remover campo',
  field: 'Campo',
  fieldName: 'Nome do campo',
  fieldNamePlaceholder: 'ex.: text, visible, width',
  fieldType: 'Tipo do campo',
  typeString: 'String',
  typeInteger: 'Integer',
  typeFloat: 'Float',
  typeBoolean: 'Boolean',
  typeColor: 'Color',
  typeArray: 'Array',
  typeAssocArray: 'AssocArray',
  value: 'Valor',
  fieldValuePlaceholder: 'Escalares, true/false, JSON para Arrays / Vectors / Objects',

  // Action Scripts tab
  builder: 'Construtor',
  executor: 'Executor',
  copyToExecutor: 'Copiar para o Executor',
  copyActionScript: 'Copiar script de ação',
  saveActionScript: 'Salvar script de ação',
  saveToDirectory: 'Salvar em pasta…',
  moreSaveOptions: 'Mais opções de salvamento',
  addActionToEnable: 'Adicione pelo menos uma ação para ativar',
  connectToConsole: 'Conectar ao console',
  editInBuilder: 'Editar no Construtor',
  editInBuilderTitle: 'Abrir o script atual na aba Construtor',
  importActionScript: 'Importar script de ação',
  importActionScriptTitle: 'Importar ou atualizar o script de ação',
  actions: 'Ações',
  builderImportTitle: 'Importar script de arquivo ou colar JSON',
  undoTitle: 'Desfazer (Ctrl+Z)',
  redoTitle: 'Refazer (Ctrl+Shift+Z)',
  clearAllActions: 'Limpar todas as ações',
  helpForActionType: 'Ajuda para este tipo de ação',
  closeAddStep: 'Fechar adição de etapa',
  actionType: 'Tipo de ação',
  addAction: 'Adicionar ação',
  dragToResize: 'Arraste para redimensionar',
  resizePanels: 'Redimensionar painéis',
  json: 'JSON',
  uploadJson: 'Carregar JSON',
  orPasteBelow: 'Ou cole abaixo',
  validate: 'Validar',
  devPasswordRequired: 'Senha de desenvolvedor exigida por algumas ações (captura de tela, sideload):',
  enterDevPassword: 'Digite a senha de desenvolvedor',
  clearActions: 'Limpar ações',
  runActionScript: 'Executar script de ação',
  stopExecution: 'Parar execução',
  copyResultsToClipboard: 'Copiar resultados para a área de transferência',
  saveResultsAsPdf: 'Salvar resultados como PDF',
  clearResultsTitle: 'Limpar resultados e liberar memória (não haverá nada para salvar até a próxima execução)',

  // Network Inspector tab
  networkInspector: 'Inspetor de rede',
  niFindTitle: 'Buscar no tráfego — URL, payloads, cabeçalhos, corpos de resposta (⌘/Ctrl+F)',
  niFindAria: 'Buscar no tráfego',
  niFindPrevTitle: 'Correspondência anterior (Shift+↑)',
  niFindPrev: 'Correspondência anterior',
  niFindNextTitle: 'Próxima correspondência (Shift+↓)',
  niFindNext: 'Próxima correspondência',
  niFindClear: 'Limpar resultados da busca',
  niDownloadTitle: 'Baixar sessão…',
  niDownloadAria: 'Baixar sessão',
  niExportHar: 'Exportar tudo como HAR',
  niExportSession: 'Exportar sessão (.rds-network-inspector.json)',
  niSavePcap: 'Salvar captura de pacotes (.pcap)',
  niClearTitle: 'Limpar lista de sessões',
  niSetupBadgeTitle: 'Configuração de captura de hotspot necessária — clique para ver instruções',
  niCaptureSetup: 'Configuração de captura',
  niPortBadgeTitle: 'Porta do proxy indisponível — clique para ver detalhes',
  niProxyPortUnavailable: 'Porta do proxy indisponível',
  niFilterPlaceholder: 'Filtrar tráfego…',
  niFilterTitle: 'Filtrar tráfego — clique no ícone de informações para ver a sintaxe compatível.',
  niClearFilter: 'Limpar filtro',
  niFilterHelpTitle: 'Ajuda de filtragem e sintaxe compatível',
  niFilterHelpAria: 'Ajuda de filtragem',
  niSessionCountTitle: 'Sessões capturadas',
  niControls: 'Controles do Inspetor de rede',
  niToggleDetailLayout: 'Alternar layout de detalhes',
  niConfigureTitle: 'Configurar regras de tráfego',
  niGroupByHostTitle: 'Agrupar sessões por nome de host',
  niGroupByHost: 'Agrupar por host',
  niProxiedTitle:
    'Mostrar apenas as requisições passadas pelo proxy do RDS (cabeçalhos completos + corpo), ocultando os metadados SNI/DNS da captura de hotspot',
  niProxied: 'Via proxy',
  niWaitingForTraffic: 'Aguardando tráfego…',
  niScrollBottom: 'Rolar até as sessões mais recentes',

  // App menu (hamburger)
  developerMode: 'Modo de desenvolvedor',
  privacyMode: 'Modo de privacidade',
  debugLogging: 'Log de depuração',
  openDiagnosticLogsFolder: 'Abrir pasta de logs de diagnóstico',
  openLogFile: 'Abrir arquivo de log',
  settings: 'Configurações',
  clearCacheAndReload: 'Limpar cache e recarregar',
  zoom: 'Zoom',
  aboutRokuDevStudio: 'Sobre o Roku Dev Studio',
  quitRokuDevStudio: 'Sair do Roku Dev Studio',

  // ───────────────────────────────────────────────────────────────────────
  // index.html localization pass — cloned-template defaults, empty-states,
  // attribute-only strings, and multi-element prose (data-i18n-html) blocks
  // that the earlier migration left inline.
  // ───────────────────────────────────────────────────────────────────────

  // Sidebar — local devices empty state (prose with <br>/<strong>)
  noDevicesFoundHtml: 'Nenhum dispositivo encontrado.<br>Clique em <strong>Buscar</strong> para descobrir dispositivos Roku.',

  // Device panel header (cloned-template defaults, replaced by JS at runtime)
  deviceNamePlaceholder: 'Nome do dispositivo',
  perfStripPausedPlaceholder: 'Pausado — inicie o Dev App para retomar',

  // ECP / Control by Mobile Apps warning descriptions (prose with <strong>)
  ecpRemoteWarningDescHtml:
    'O controle remoto (teclas, apps, etc.) requer que "Controle por apps móveis" → Acesso à rede esteja definido como <strong>Ativado</strong> no seu dispositivo Roku.',
  ecpDevAppWarningDescHtml:
    'Os recursos de Controle rápido e de teclas requerem que "Controle por apps móveis" → Acesso à rede esteja <strong>Ativado</strong> no seu dispositivo Roku.',

  // Dev App tab — sideloaded-app default + screenshot image alt text
  noChannelSideloaded: 'Nenhum canal carregado via sideload',
  screenshotAlt: 'Captura de tela do Roku',

  // App Connector — Update Node modal intro (prose with <strong>/<code>) + response empty-state
  updateNodeModalIntroHtml:
    'Usa o <strong>path</strong> do seu último Obter nó por ID bem-sucedido. Ações: <code>removeField</code>, <code>setField</code> (adicionar / atualizar).',
  responseWillAppearHere: 'A resposta aparecerá aqui...',

  // Action Scripts — Executor nudge + password-prompt hint (prose with <strong>/<code>)
  executorBuilderNudgeHtml:
    'Use a aba <strong>Construtor</strong> para adicionar e editar etapas com campos guiados. Use esta área para validar, importar ou executar JSON.',
  executorPasswordPromptHintHtml:
    'Digite-a aqui e execute novamente, ou adicione <code>"devPassword": "..."</code> ao JSON do seu script.'
};

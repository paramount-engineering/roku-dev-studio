/**
 * Brazilian Portuguese (pt-BR) translation of the Settings window strings
 * (General, MCP, Network Inspector, timing/validation, …). Sibling of
 * ../settings.ts — same `settings` shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated; product/feature names and tech tokens are verbatim.
 */
export const settings = {
  // Bootstrap / fatal
  apiUnavailable: 'API de configurações indisponível.',
  loadFailedMessage: 'Falha ao abrir as Configurações. Tente novamente.',

  // General section
  noFolderSet: 'Nenhuma pasta definida',
  logFilePath: (path: string): string => `Arquivo de log: ${path}`,

  // Password storage / keychain
  keychainUnencryptedConfirm:
    'Seu sistema não oferece um chaveiro de criptografia real. Ativar isso armazena as senhas como texto puro codificado no disco, sem criptografia. Continuar?',
  keychainOff: 'A opção de criptografia está desativada — as senhas lembradas são armazenadas como texto puro no disco.',
  keychainDefaultBackend: 'Chaveiro do sistema',
  keychainEncrypted: (backend: string): string => `Armazenamento: criptografado via ${backend}.`,
  keychainUnencrypted:
    'Aviso: a opção está ativada, mas este sistema usa texto básico — as senhas são texto puro codificado em Base64 no disco. Use um chaveiro do Linux (Secret Service/KWallet) para criptografia real.',
  keychainUnavailable:
    'Aviso: a opção está ativada, mas o chaveiro do sistema operacional está indisponível — as senhas permanecem na memória apenas nesta sessão.',
  keychainStatus: (status: string, backend: string): string =>
    `Status do armazenamento: ${status}${backend ? ` (${backend})` : ''}.`,

  // MCP Server section
  // Client row labels (product/brand names — same across locales, but sourced here so the
  // catalog is the single place UI text lives). Keys match main's McpClientId union.
  mcpClientLabels: {
    chatgpt: 'ChatGPT Desktop',
    claude: 'Claude Desktop',
    cursor: 'Cursor',
    vscode: 'Visual Studio Code',
    'vscode-insiders': 'VS Code Insiders',
    vscodium: 'VSCodium',
    windsurf: 'Windsurf',
  },
  // MCP panel help blurb — contains <a>/<code>, rendered via data-i18n-html.
  mcpServerBlurbHtml: `Exponha o Roku Dev Studio a agentes de IA via <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" class="mcp-link">Model Context Protocol</a>. Ative um cliente para adicionar ou remover a entrada de servidor MCP <code class="mcp-inline-code">roku-dev-studio</code> dele; outras entradas permanecem intactas.`,
  mcpNoClients: 'Nenhum cliente MCP compatível detectado neste sistema.',
  mcpInstalled: 'Instalado',
  mcpNotDetected: 'Não detectado',
  mcpOpenConfigTitle: (path: string): string => `Abrir ${path}`,
  mcpOpenConfigAria: (label: string): string => `Abrir o arquivo de configuração do MCP para ${label}`,
  mcpOpenConfigFile: 'Abrir arquivo de configuração',
  mcpInstallToEnable: (label: string): string => `Instale ${label} para ativar.`,
  mcpEnableAria: (label: string): string => `Ativar MCP para ${label}`,

  // Network Inspector — status line
  niStatusDisabled: 'Status: desativado — salve após ativar para começar a monitorar os clientes do hotspot.',
  niPlatformMac: 'bridge100 no macOS',
  niPlatformWin: 'adaptador virtual no Windows',
  niPlatformLinux: 'interface de hotspot no Linux',
  niStatusEnabled: (platformHint: string): string =>
    `Status: ativado — aguardando a interface de hotspot (${platformHint}).`,
  niMitmSuffix: (port: number): string => ` · proxy MITM na porta ${port}`,

  // Network Inspector — capture setup (BPF)
  captureAccessEnabled: 'Acesso à captura ativado',
  setupNeeded: 'Configuração necessária',
  // Static default for the setup modal <h2>; JS replaces it with a platform-suffixed title.
  hotspotCaptureSetupModalTitle: 'Configuração da captura por hotspot',
  niSetupRowDescOk: 'Opcional — apenas para a captura de DNS/SNI do hotspot. O proxy não requer configuração.',
  niSetupRowDescNeeds: 'A captura do hotspot requer configuração — abra para ativá-la. (O proxy continua funcionando.)',
  niSetupPacketCapture: 'Configurar captura de pacotes',
  bpfWaitingApproval: 'Aguardando a aprovação do administrador…',
  bpfInstalled: 'Acesso à captura de pacotes instalado.',
  bpfInstalledHint: 'Instalado — volte para a aba do Inspetor de rede.',
  bpfCancelled: 'Cancelado.',
  bpfSetupFailed: 'Falha na configuração.',

  // Network Inspector — place selector + Remote Locations
  placeLocal: 'Local (esta máquina)',
  placeRemoteFallback: 'Remoto',
  niRemoteRequiresRoot:
    'Este local exige que o servidor remoto seja executado como root para ativar o Inspetor de rede.',
  niRemoteUnsupported:
    'Este local não oferece suporte ao Inspetor de rede. Atualize este servidor remoto para a funcionalidade do Inspetor de rede.',
  niDisabled: 'O Inspetor de rede está desativado.',
  niEditingRemote: 'Editando as configurações do local remoto. A captura é executada no servidor remoto.',
  niPortConflictTitle: 'Porta do proxy indisponível',
  niRemoteUnavailable: 'O Inspetor de rede remoto não está disponível nesta compilação.',
  niCheckingRemote: 'Verificando o local remoto…',
  niCouldNotReachRemote: 'Não foi possível acessar o local remoto.',

  // Network Inspector — enable confirm + save status
  niConfirmEnable:
    'O Inspetor de rede vai capturar o tráfego do Roku e armazená-lo localmente nesta máquina — por meio do proxy MITM e, se configurado, da captura de hotspot/rede compartilhada. Continuar?',
  niSaved: 'Configurações do Inspetor de rede salvas.',
  niSavedRemote: 'Salvo no local remoto.',
  niRemoteSaveFailed: 'Falha ao salvar remotamente',

  // Timing & Network row labels (title + hint per timing key), localized here so the
  // Settings UI renders them in the active language. Numeric min/max bounds still come
  // from the main process via `timingMeta`.
  timingLabels: {
    DEFAULT_RALE_PORT: { title: 'RALE / App Connector Port', hint: 'TCP Port (padrão 49200).' },
    SCREENSHOT_DEBOUNCE_DELAY: { title: 'Debounce da captura de tela (ms)', hint: 'Atraso após pressionar a tecla antes da captura automática.' },
    SCREENSHOT_AFTER_LAUNCH_DELAY: { title: 'Captura de tela após iniciar (ms)', hint: 'Espera após iniciar o Dev App antes da captura de tela.' },
    TELNET_TIMEOUT: { title: 'Tempo limite de conexão Telnet (ms)', hint: 'Console de depuração / Telnet do sistema.' },
    CONNECTION_CHECK_INTERVAL: { title: 'Verificação de dispositivo ativo (ms)', hint: 'Com que frequência os dispositivos conectados são consultados: informações do dispositivo, estado ECP e se o canal do Dev App está em primeiro plano.' },
    DEVICE_METRICS_SAMPLE_INTERVAL_MS: { title: 'Taxa de amostragem (ms)', hint: 'Cadência de consulta do Chanperf + contagem de objetos. Menor = dados mais recentes, mais tráfego ECP; requer o Modo de desenvolvedor e Control by Mobile Apps.' },
    DEVICE_METRICS_CHART_HISTORY_MS: { title: 'Tempo de histórico do gráfico (minutos)', hint: 'Até onde os gráficos de CPU e System Memory retrocedem' },
    TOAST_DISPLAY_DURATION: { title: 'Duração do toast (s)', hint: 'Visibilidade do toast de sucesso/erro.' },
    STATUS_MESSAGE_DURATION: { title: 'Duração da mensagem de status (s)', hint: 'Visibilidade da linha de status do cabeçalho.' },
  },

  // Timing bounds + validation
  timingValueFallback: 'Valor',
  timingBoundMin: (value: string | number): string => `Mín: ${value}`,
  timingBoundMax: (value: string | number): string => `Máx: ${value}`,
  timingMustBeWholeNumber: (label: string): string => `${label} deve ser um número inteiro.`,
  timingMustBeAtLeast: (label: string, bound: string): string => `${label} deve ser no mínimo ${bound}.`,
  timingMustBeAtMost: (label: string, bound: string): string => `${label} deve ser no máximo ${bound}.`,
  timingMoreOutOfRange: (n: number): string => ` (mais ${n} fora do intervalo)`,
  timingClamped: (label: string, value: string, which: string): string =>
    `${label} ajustado para ${value} (${which}).`,
  timingClampMinimum: 'mínimo',
  timingClampMaximum: 'máximo',

  // Save status messages
  generalSaved: 'Configurações gerais salvas.',
  actionScriptsSaved: 'Configurações de Action Scripts salvas.',
  devicePerfSaved: 'Configurações de desempenho do dispositivo salvas.',
  timingSaved: 'Configurações de tempos e rede salvas.',
  mcpSaved: 'Configurações do servidor MCP salvas.',
  saveFailed: 'Falha ao salvar',
  saveWriteFailedError: 'Não foi possível gravar o arquivo de configurações.',
  mcpConfigUpdateWarning: (summary: string): string =>
    `A atualização da configuração do cliente MCP teve erros: ${summary}`,

  // ── Static settings.html shell ──────────────────────────────────────────
  // Header + nav
  windowTitle: 'Configurações — Roku Dev Studio',
  heading: 'Configurações',
  navAria: 'Seções de configurações',
  tabGeneral: 'Geral',
  tabActionScripts: 'Scripts de ação',
  tabDevicePerformance: 'Desempenho do dispositivo',
  tabTiming: 'Tempos e rede',
  tabNetworkInspector: 'Inspetor de rede',
  tabSideloadRelay: 'Sideload Relay',
  tabMcpServer: 'Servidor MCP',
  // Shared across every section's save dock
  resetToDefaults: 'Restaurar padrões',

  // General section — toggle labels, descriptions, and (screen-reader) aria labels
  language: 'Idioma',
  languageDesc: 'Idioma de exibição da interface do aplicativo.',
  languageAria: 'Idioma de exibição',
  languageSystemDefault: (name: string): string => `Padrão do sistema (${name})`,
  developerMode: 'Modo de desenvolvedor',
  developerModeDesc: 'Registro extra na janela principal (o mesmo que Arquivo → Modo de desenvolvedor).',
  developerModeAria: 'Modo de desenvolvedor',
  privacyMode: 'Modo de privacidade',
  privacyModeDesc: 'Mascarar IPs e números de série na interface (o mesmo que Arquivo → Modo de privacidade).',
  privacyModeAria: 'Modo de privacidade',
  debugLogging: 'Registro de depuração em arquivo',
  debugLogHint: 'Grava no arquivo de log dentro dos dados de usuário do aplicativo quando ativado.',
  debugLoggingAria: 'Registro de depuração em arquivo',
  useKeyboardRemote: 'Usar o teclado para o controle remoto do Roku',
  useKeyboardRemoteDesc:
    'Quando ativado, você pode usar o teclado para controlar o Roku. Os atalhos de teclado estão listados na janela de ajuda do controle remoto.',
  useKeyboardRemoteAria: 'Controle remoto do Roku - Usar o teclado ',
  autoConnect: 'Conectar automaticamente aos dispositivos',
  autoConnectDesc:
    'Quando ativado, o aplicativo se conectará automaticamente aos dispositivos que permaneceram conectados ao fechar o aplicativo na sessão anterior.',
  autoHideSidebar: 'Ocultar a barra lateral automaticamente',
  autoHideSidebarDesc:
    'Quando ativado, a barra lateral, que apresenta a lista de dispositivos, será alternada automaticamente se estivesse oculta na sessão anterior.',
  encryptPasswords: 'Criptografar as senhas salvas com o chaveiro do sistema',
  encryptPasswordsDesc:
    'Criptografe a senha lembrada de cada dispositivo por meio do chaveiro do sistema operacional. Quando desativado, ela é mantida, mas armazenada sem criptografia no disco.',
  encryptPasswordsAria: 'Manter as senhas salvas no chaveiro do sistema',

  // Action Scripts section
  actionScriptsBlurb:
    'Pasta padrão para capturas de tela e logs quando um script precisa salvar. Você ainda pode escolher outra pasta a cada execução.',
  chooseFolder: 'Escolher pasta…',

  // Device Performance section
  devicePerfIntroHtml: `Aplica-se enquanto <strong>Mostrar desempenho do dispositivo</strong> está ativado, o Roku tem o modo de desenvolvedor e o Dev App está em primeiro plano. Quando <strong>Lembrar 'Mostrar desempenho do dispositivo'</strong> está ativado abaixo, a seção do controle remoto restaura o layout em quadrante por dispositivo.`,
  rememberDevicePerf: "Lembrar 'Mostrar desempenho do dispositivo'",
  rememberDevicePerfAria: 'Lembrar mostrar ou ocultar o desempenho do dispositivo por dispositivo',
  // Row description — contains <strong>, rendered via data-i18n-html.
  rememberDevicePerfDescHtml: `Restaura se <strong>Mostrar desempenho do dispositivo</strong> estava ativado para cada dispositivo. Desative para sempre começar apenas com a seção do controle remoto até você ativá-lo novamente.`,

  // Network Inspector section — place selector + field labels
  location: 'Local',
  niPlaceAria: 'Local do Inspetor de rede',
  enableNetworkInspector: 'Ativar o Inspetor de rede',
  enableNetworkInspectorDesc:
    'Inspecione o tráfego de rede de um dispositivo. Descriptografa o HTTPS do seu canal de desenvolvedor pelo proxy local (qualquer rede); um hotspot também captura DNS/SNI. Armazenado apenas localmente.',
  mitmProxyPort: 'Porta do proxy MITM',
  mitmProxyPortDesc:
    'Porta em que o proxy local de descriptografia escuta. Roteie seu canal de desenvolvedor carregado via sideload por ela — funciona em qualquer rede (canais de fábrica não podem ser interceptados).',
  mitmProxyPortAria: 'Porta do proxy MITM',
  packetLimit: 'Limite de pacotes por dispositivo',
  packetLimitDesc:
    'Máximo de quadros capturados mantidos por dispositivo para a exportação PCAP. Maior = histórico mais longo, mais memória. 100–100000.',
  packetLimitAria: 'Limite de pacotes por dispositivo',
  maxBodySize: 'Tamanho máximo do corpo (KB)',
  maxBodySizeDesc:
    'Quanto de cada corpo de requisição/resposta é mantido para visualização no inspetor. Maior = inspecione corpos grandes (ex.: JS de vários MB) por inteiro; acima disso, o corpo mostra um selo "Body Truncated". Isso nunca afeta o que o dispositivo recebe. Aplica-se apenas ao novo tráfego — aumentá-lo não restaurará corpos já capturados e truncados. 64–16384 KB.',
  maxBodySizeAria: 'Tamanho máximo do corpo retido em KB',
  hotspotCaptureSetup: 'Configuração de hotspot e captura',
  viewSetup: 'Ver configuração',

  // Sideload Relay section — intro bullets. The first bullet has inline markup (<span>/<code>,
  // whose #srRelayUrlWrap/#srRelayUrl are populated at runtime) so it's rendered via data-i18n-html.
  srIntro1Html: `Aponte sua ferramenta de sideload (VS Code com a extensão BrightScript, Eclipse ou a CLI roku-deploy)<span id="srRelayUrlWrap" hidden> — ou um navegador em <code id="srRelayUrl">http://…/</code></span> — para cá em vez de um único Roku.`,
  srIntro2: 'O RDS aceita o sideload uma vez, depois o instala em cada destino ativado, inicia o Dev App e abre cada console.',
  srIntro3: 'Os sideloads desta máquina prosseguem automaticamente.',
  srIntro4: 'Um sideload de outro dispositivo na LAN precisa da senha de desenvolvedor e pede que você o permita.',
};

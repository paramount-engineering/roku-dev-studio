/** UI strings for the Dev App panel (password auth, sideloading, screenshots, quick remote, Device Performance metrics). */
export const devApp = {
  // ── Password auth (password-auth.ts) ──────────────────────────────────────
  authenticated: 'Autenticado',
  notAuthenticated: 'Não autenticado',
  verify: 'Verificar',
  enterDeveloperPassword: 'Digite uma senha de desenvolvedor.',
  verificationNoResponse: 'Falha na verificação — sem resposta do Dev App.',

  // ── Quick remote (quick-remote.ts) ────────────────────────────────────────
  sendText: 'Enviar texto',
  sending: 'Enviando...',

  // ── Screenshots (screenshots.ts) ──────────────────────────────────────────
  captureDisabledTitle: 'Inicie o Dev App carregado via sideload no dispositivo para fazer uma captura de tela.',
  launchBeforeCapture: 'Inicie o Dev App no dispositivo antes de fazer uma captura de tela.',
  capturing: 'Capturando...',
  capture: 'Capturar',
  copiedTitle: 'Copiado!',
  copyScreenshot: 'Copiar captura de tela',
  saveScreenshotAs: 'Salvar captura de tela como…',
  clearScreenshot: 'Limpar captura de tela',
  copiedToClipboard: '✓ Copiado para a área de transferência',
  savedTo: (filePath: string): string => `✓ Salvo em: ${filePath}`,
  failedToCopy: (detail: string): string => `Falha ao copiar: ${detail}`,
  couldNotGetCanvasContext: 'Não foi possível obter o contexto do canvas',
  couldNotEncodeScreenshot: 'Não foi possível codificar a captura de tela',

  // ── Sideloaded app card (sideloaded-app.ts) ───────────────────────────────
  versionLabel: 'Versão:',
  unknown: 'Desconhecido',
  noChannelSideloaded: 'Nenhum canal carregado via sideload no momento',
  launching: 'Iniciando',
  launch: 'Iniciar',

  // ── Sideloading (sideloading.ts) ──────────────────────────────────────────
  dragDropUnavailable: 'Arrastar e soltar não está disponível nesta versão',
  selectFileAndPassword: 'Selecione um arquivo e digite sua senha de desenvolvedor',
  installing: 'Instalando...',
  install: 'Instalar',
  unknownError: 'Erro desconhecido',
  deleteSideloadedChannelConfirm: 'Excluir canal carregado via sideload?',

  // Shared between screenshots + sideloading
  pleaseEnterDeveloperPassword: 'Digite sua senha de desenvolvedor',

  // ── Channel performance parse messages (remote-metrics-charts.ts) ─────────
  channelPerfUnavailable: (err: string): string => `Desempenho do canal indisponível: ${err}`,
  channelPerfUnavailableFailed: 'Desempenho do canal indisponível (status: falha).',
  chartAxisNow: 'agora',

  // ── Device Performance Action Script capture (device-metrics-performance-step.ts) ──
  captionCpuGraph: 'Uso da CPU (gráfico)',
  captionCpuProcess: 'Uso da CPU (processo)',
  captionSystemMemory: 'Memória do sistema',
  captionObjectsCount: 'Objetos BrightScript (contagem)',
  captionObjectsMemory: 'Objetos BrightScript (memória)',
  invalidChartType: 'Tipo de gráfico de Desempenho do dispositivo inválido.',
  developerModeRequired: 'O Developer Mode deve estar ativado neste dispositivo para capturar métricas de desempenho.',
  remoteMetricsRootNotFound: 'Raiz de métricas do controle remoto não encontrada para esta aba do dispositivo.',
  performanceCardNotFound: (selector: string): string => `Card de desempenho não encontrado: ${selector}`,
  performanceCardNoVisibleBounds:
    'O card de desempenho não tem limites visíveis. Ative “Mostrar Desempenho do dispositivo” (layout quad) na seção Controle Remoto.',
  chartRasterizeFailed: 'Falha ao rasterizar o gráfico (data URL vazia ou inválida).',
  canvasUnavailable: 'Canvas indisponível',
  couldNotDecodeCaptureForScaling: 'Não foi possível decodificar a captura para o dimensionamento de exportação',
  devicePerfHidden:
    'Os cards de Desempenho do dispositivo estão ocultos. Na seção Controle Remoto, ative “Mostrar Desempenho do dispositivo” (layout quad) e execute esta etapa novamente.',
  couldNotShowDevicePerf:
    'Não foi possível mostrar o Desempenho do dispositivo automaticamente. Na seção Controle Remoto, ative “Mostrar Desempenho do dispositivo” (layout quad) e execute esta etapa novamente.',
  stopped: 'Parado',
  couldNotCaptureDevicePerf:
    'Não foi possível capturar os cards de Desempenho do dispositivo. Verifique se o quad está visível e se a janela não está minimizada.',
  devicePerfAutoEnabledSummary:
    'Mostrar Desempenho do dispositivo (layout quad) foi ativado automaticamente para esta etapa.',
  skippedNoProcStat: (caption: string): string =>
    `Captura de "${caption}" ignorada — o dispositivo ainda não produziu <proc-stat> (requer Roku OS 15.2+).`,

  // ── Device metrics: process-state labels (device-metrics.ts) ──────────────
  stateRunning: 'Em execução',
  stateSleeping: 'Dormindo',
  stateIdle: 'Ocioso',
  stateTracingStop: 'Parada de rastreamento',
  stateDiskWait: 'Aguardando disco',
  stateStopped: 'Parado',
  stateZombie: 'Zumbi',
  stateDead: 'Morto',

  // ── Device metrics: objects resource monitor ──────────────────────────────
  updatedAt: (time: string): string => `Atualizado: ${time}`,
  memoryEstimatedHint:
    'A memória é estimada a partir das contagens de objetos e da memória do chanperf (“usada”) quando o dispositivo não envia bytes por tipo.',
  totalBrightScriptObjects: 'Total de objetos BrightScript',

  // ── Device metrics: header perf strip ─────────────────────────────────────
  latestDevicePerfTitle: 'Desempenho do dispositivo mais recente (clique para abrir o controle remoto)',

  // ── Device metrics: CPU process table ─────────────────────────────────────
  processLabel: 'Processo',
  waitingForProcStat: 'Aguardando amostra de proc-stat…',
  stateFieldLabel: 'Estado',
  channelUptime: 'Tempo de atividade do canal',
  sinceFirstObserved: 'Desde a primeira observação',
  userCpuTime: 'Tempo de CPU do usuário',
  kernelCpuTime: 'Tempo de CPU do kernel',
  childCpuTime: 'Tempo de CPU do filho',
  childFaults: 'Falhas do filho',
  minorMajor: 'Menores/maiores',
  clockTickRate: 'Taxa de ticks do relógio',
  minorFaults: 'Falhas menores',
  majorFaults: 'Falhas maiores',
  stableFor: (duration: string): string => `Estável há ${duration}`,
  childCpuTimeSecondary: (user: string, kernel: string): string => `Usuário ${user} · Kernel ${kernel}`,

  // ── Device metrics: chart hover series labels ─────────────────────────────
  hoverTotal: 'Total',
  hoverUser: 'Usuário',
  hoverKernel: 'Kernel',
  hoverUsed: 'Usada',
  hoverResident: 'Residente',
  hoverAnonymous: 'Anônima',
  hoverShared: 'Compartilhada',
  hoverLimit: 'Limite',

  // ── Device metrics: error toasts ──────────────────────────────────────────
  chanperfRequestFailed: 'falha na solicitação de chanperf',
  couldNotParseChanperf: 'Não foi possível analisar o Desempenho do canal (Dev Mode / ECP / chanperf).',
  objectCountsFailed: 'Falha nas contagens de objetos',
  deviceMetricsUnavailable: 'Métricas do dispositivo indisponíveis',

  // ── Device metrics: objects empty states ──────────────────────────────────
  objectsEmptyBackground:
    'Nenhum detalhamento de objetos BrightScript enquanto o Dev App está em segundo plano. Inicie ou alterne para o Dev App no dispositivo — as métricas e contagens de objetos só são atualizadas quando ele está em primeiro plano.',
  objectsEmptyNoForeground:
    'Ainda não há detalhamento de objetos BrightScript. Depois que a conexão informar o canal em primeiro plano, inicie o Dev App se você precisar das contagens de objetos do Dev App carregado via sideload.',
  objectsEmptyNoCounts:
    'Ainda não há detalhamento de objetos BrightScript. Verifique se o Controle por aplicativos móveis (acesso à rede) está ativado e se o canal em primeiro plano expõe contagens de objetos.',

  // ── Device metrics: launch + paused nav ───────────────────────────────────
  launchingProgress: 'Iniciando…',
  launchFailed: 'Falha ao iniciar',
  pausedSideloadFull: 'Desempenho do dispositivo pausado — faça o sideload do Dev App para retomar',
  pausedSideloadShort: 'Faça o sideload para retomar',
  pausedLaunchFull: 'Desempenho do dispositivo pausado — inicie o Dev App para retomar',
  pausedLaunchShort: 'Inicie para retomar',
  pausedUnknownFull: 'Desempenho do dispositivo pausado — traga o Dev App para o primeiro plano para retomar.',
  pausedUnknownShort: 'Desempenho do dispositivo pausado',
  bringDevAppToForegroundTitle:
    'Traga o Dev App para o primeiro plano no dispositivo para ativar o Desempenho do dispositivo.',
  showDevicePerfAutoOnToast:
    'Mostrar Desempenho do dispositivo foi ativado para que um Action Script pudesse capturar os gráficos.',

  // ── Native dialogs + IPC results (main: dev-app-handlers.ts) ──────────────
  selectRokuChannelPackageTitle: 'Selecionar pacote de canal Roku',
  rokuChannelPackageFilter: 'Pacote de canal Roku',
  saveScreenshotDialogTitle: 'Salvar captura de tela',
  imagesFilter: 'Imagens',
  screenshotCapturedToast: 'Captura de tela feita!',
  sideloadWrongTypeError: 'Selecione um pacote de canal Roku .zip ou .pkg',
  failedToSaveScreenshot: (detail: string): string => `Falha ao salvar a captura de tela: ${detail}`,
};

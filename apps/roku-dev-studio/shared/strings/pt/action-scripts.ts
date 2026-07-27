/**
 * Brazilian Portuguese (pt-BR) translation of the Action Scripts UI strings
 * (Builder, step fields, Executor, Import modal, shared actions list, and the
 * per-step Help modal).
 *
 * Same structure/keys/order as ../action-scripts.ts. Parametrized strings are
 * functions returning the composed text. Help-modal body values contain inline
 * HTML (assigned via `setSafeHTML`); dynamic values are HTML-escaped at the call
 * site before being passed in.
 */
export const actionScripts = {
  // ── Builder: step-type option (legacy) ──
  legacyPluginsMemoryOption: 'Plugins / Memória (JSON legado)',

  // ── Builder: per-step field labels / placeholders / prompts ──
  labelQuery: 'Consulta',
  labelEndpoint: 'Endpoint',
  optionCustom: 'Personalizado...',
  labelSystemTelnetCommand: 'Comando (tipo legado — use Consulta de dispositivo para novas etapas)',
  labelKey: 'Tecla',
  optionSelectKey: '-- Selecionar tecla --',
  labelText: 'Texto',
  placeholderTextToSend: 'Texto para enviar',
  labelAppId: 'App ID',
  labelParamsOptional: 'Parâmetros (opcional)',
  labelFilePath: 'Caminho do arquivo',
  placeholderPastePathOrChoose: 'Cole o caminho ou escolha um arquivo',
  titleFilePathZip: 'Caminho para o pacote .zip. Cole aqui ou use Escolher arquivo.',
  chooseFileTitle: 'Escolher arquivo (.zip)',
  chooseFileAria: 'Escolher arquivo',
  chooseFileBtn: 'Escolher arquivo',
  labelPassword: 'Senha',
  placeholderDevPassword: 'Senha de dev',
  optionConnectAppConnectorFirst: 'Conecte o App Connector primeiro',
  labelFunction: 'Função',
  labelSetVarOptional: 'Definir variável (opcional)',
  placeholderVarExample: 'ex. varX',
  titleVarNameRules: 'Letras, dígitos, sublinhado; comece com letra ou _',
  noParameters: 'Sem parâmetros',
  selectAFunction: 'Selecione uma função',
  labelCommand: 'Comando',
  labelParameters: 'Parâmetros',
  labelLabelOptional: 'Rótulo (opcional)',
  placeholderScreenshotLabel: 'ex. Após o login',
  labelWaitBeforeMs: 'Esperar antes (ms)',
  labelWaitAfterMs: 'Esperar depois (ms)',
  placeholderWaitAfterDefault: '1500 (padrão)',
  titleWaitAfter:
    'Tempo a esperar após acionar a captura antes do primeiro download. Aumente se a imagem estiver truncada ou a UI estiver lenta (ex. HUD).',
  optionChooseChart: 'Escolher gráfico…',
  labelChart: 'Gráfico',
  placeholderPerfLabel: 'ex. Após a navegação',
  waitModeFixedDelay: 'Atraso fixo (ms)',
  waitModeUntilCondition: 'Até a condição',
  labelWaitType: 'Tipo de espera',
  labelDelayMs: 'Atraso (ms)',
  labelSource: 'Origem',
  labelState: 'Estado',
  optionSelectState: '-- Selecionar estado --',
  labelTimeoutMs: 'Tempo limite (ms)',
  labelPollIntervalMs: 'Intervalo de sondagem (ms)',
  labelPathJsonArray: 'Caminho (array JSON)',
  labelNodeId: 'ID do nó',
  labelFieldName: 'Nome do campo',
  labelOperator: 'Operador',
  placeholderFieldInFieldList: 'Campo em FieldList',
  placeholderCompareString: 'String de comparação',
  placeholderCompareValue: 'Valor de comparação',
  caseInsensitive: 'Não diferencia maiúsculas',
  labelConditionSource: 'Origem da condição',
  labelAttribute: 'Atributo',
  placeholderActiveAppValue: 'ex. dev, 837, YouTube',
  labelVariablePath: 'Caminho da variável',
  labelPost: 'POST',
  optionSelectPost: '-- Selecionar POST --',
  noExtraFields: 'Nenhum campo extra para este tipo.',

  // Chart option labels (shared: Builder dropdown, list Details, Executor descriptions)
  chartObjects: 'Objetos BrightScript',
  chartCpu: 'Uso de CPU',
  chartMemory: 'Memória do sistema',
  chartAboveAll: 'Tudo combinado',

  // Condition / wait source labels (shared)
  sourceMediaPlayer: 'Reprodutor de mídia',
  sourceActiveApp: 'App ativo',
  sourceRaleNodeField: 'Campo de nó RALE',
  sourceVariables: 'Variáveis',

  // Value-with-operator label (Builder compare cells)
  valueWithOperator: (op: string): string => `Valor (${op})`,

  // ── Shared actions list view (Builder + Executor) ──
  branchThen: 'Então',
  branchElse: 'Senão',
  dragToReorder: 'Arraste para reordenar',
  columnType: 'Tipo',
  columnDetails: 'Detalhes',
  addStep: 'Adicionar etapa',
  pasteStepBtn: 'Colar etapa',
  pasteActionTooltip: 'Colar ação copiada aqui',
  ariaThenBranchPrefix: 'Ramo Então. ',
  ariaElseBranchPrefix: 'Ramo Senão. ',
  copyActionTooltip: 'Copiar ação',
  removeActionTooltip: 'Remover ação',
  skipBtn: 'Pular',
  skipActionTooltip: 'Pular esta ação',
  skipActionAria: 'Pular ação',
  unskipBtn: 'Não pular',
  runActionTooltip: 'Executar esta ação',
  unskipActionAria: 'Não pular ação',
  emptyNoScript:
    'Nenhum script carregado. Clique em <strong>Importar Action Script</strong> acima para importar um script, ou use a aba <strong>Construtor</strong> para criar um.',
  stepRowAria: (num: string, type: string, details: string): string =>
    `Ação ${num}: ${type}${details ? ', ' + details : ''}. Clique para editar.`,

  /** Row header / error line: "Action <id>: <text>" */
  actionLabel: (id: string, text: string): string => `Ação ${id}: ${text}`,

  // ── Builder chrome + toasts + import messages ──
  helpTooltip: (label: string, detail: string): string => `Ajuda: ${label}${detail}`,
  addActionBtn: 'Adicionar ação',
  updateStepHeading: (n: number): string => `Atualizar etapa ${n}`,
  updateActionBtn: 'Atualizar ação',
  toastActionPasted: 'Ação colada',
  toastCannotMoveIntoOwnBranch: 'Não é possível mover uma etapa para o próprio ramo If.',
  toastActionCopied: 'Ação copiada',
  toastChooseChartType: 'Escolha um tipo de gráfico para Desempenho do dispositivo.',
  toastUpdatedAction: (n: number): string => `Ação #${n} atualizada`,
  copiedFeedback: 'Copiado!',
  copyActionScriptBtn: 'Copiar Action Script',
  savedFeedback: 'Salvo!',
  saveActionScriptBtn: 'Salvar Action Script',
  msgNoScriptJson: 'Nenhum JSON de script para carregar.',
  invalidJson: (detail: string): string => `JSON inválido: ${detail}`,
  msgStepsArray: 'O script deve ter um array "steps".',
  msgValidation: (lines: string): string => `Validação:\n${lines}`,

  // ── index.ts toasts (user-visible; MCP-bridge/agent error strings are left in place) ──
  toastBuilderNotAvailable: 'O Construtor não está disponível nesta aba.',
  toastLoadedInBuilder: 'Carregado no Construtor',
  toastAiAgentLoaded: 'O Agente de IA carregou um script no Construtor',
  toastCouldNotLoadScript: 'Não foi possível carregar o script',
  toastNoScriptInExecutor: 'Nenhum JSON de script no Executor para carregar.',
  toastAddNonEmptySteps: 'Adicione primeiro um array "steps" não vazio ao JSON do script.',
  toastOpenedInBuilder: 'Aberto no Construtor',

  // ── Shared RALE preflight errors (Executor + Import) ──
  errDevAppRequired:
    'O Roku Developer Application deve ser iniciado para estabelecer uma conexão do App Connector. Abra o Developer Application no seu dispositivo Roku (ou inicie o seu canal carregado via sideload pela aba Dev App), depois tente novamente.',
  errRaleConnection:
    'A ferramenta não conseguiu estabelecer uma conexão do App Connector. Verifique se o seu Dev App está em execução com o Modo de Desenvolvedor ativado e se a porta correta está definida na aba App Connector, depois tente novamente. O script não pode ser executado até que uma conexão esteja disponível.',

  // ── Executor engine: full-sentence user-facing errors ──
  errScreenshotPassword:
    'Senha de Desenvolvedor necessária para Captura de tela. Especifique-a no script (devPassword) ou informe-a durante a validação.',
  errScreenshotDevApp:
    'A Captura de tela requer que o Developer App esteja ativo. Primeiro inicie o seu canal carregado via sideload pela aba Dev App.',
  errDevicePerformanceInRds:
    'Desempenho do dispositivo só está disponível ao executar Action Scripts no Roku Dev Studio.',

  // ── Executor UI ──
  runBtnPause: 'Pausar execução',
  runBtnResume: 'Retomar execução',
  runBtnRun: 'Executar Action Script',
  emptyNoActions:
    '<strong>Nenhuma ação carregada</strong><br><br>Use <strong>Importar Action Script</strong> acima para colar ou enviar um script JSON, depois clique em <strong>Validar e importar</strong> no modal para carregar as ações aqui.',
  noFolderSelected: 'Nenhuma pasta selecionada',
  resultsPlaceholder: 'Valide e execute para ver os resultados.',
  waiting: 'Aguardando…',
  statusOk: '✓ OK',
  statusFailed: '✗ Falhou',
  statusFailedPlain: 'Falhou',
  statusSkipped: 'Pulado',
  altScreenshot: 'Captura de tela',
  altDevicePerformanceChart: 'Gráfico de Desempenho do dispositivo',
  validating: 'Validando…',
  errPasteOrUpload: 'Cole ou envie um script (JSON).',
  errMissingAppFunctions: (list: string): string =>
    `As seguintes funções do app não estão disponíveis a partir do app: ${list}. Verifique se o seu canal expõe essas funções (ou remova essas etapas do script), depois tente novamente.`,
  expectedSuffix: (values: string): string => `\n   esperado: ${values}`,
  errFileNotFound: (path: string): string => `Arquivo não encontrado: ${path}`,
  statusValid: '✓ Válido',
  usingDevPasswordFromAuth: '(usando a Senha de dev da Autenticação)',
  switchedTabRunPaused:
    'Aba trocada — a execução está pausada. Volte para Action Scripts para retomar (se o JSON não tiver mudado), ou use Importar → Validar e importar.',
  scriptChangedNeedsValidation:
    'O script mudou ou precisa de validação — use Importar Action Script → Validar e importar, ou altere o JSON e valide.',
  scriptChangedClickValidate: 'O script mudou — clique em Validar.',
  connectingToAppConnector: 'Conectando ao App Connector...',
  runStarted: (runId: string, count: number): string =>
    `Execução iniciada (${runId}) — ${count} ${count === 1 ? 'ação' : 'ações'}`,
  errDevicePerformanceUnavailable:
    'O desempenho do dispositivo não está disponível para este dispositivo. Abra a Remote Section (com métricas) ou reconecte o dispositivo.',
  errorLine: (message: string): string => `Erro: ${message}`,
  runStopped: 'Execução interrompida.',
  runCompleted: 'Execução concluída.',
  copyResultsTitle: 'Copiar resultados',
  saveResultsTitle: 'Salvar resultados como PDF',

  // ── validator.ts parse errors ──
  noScriptContent: 'Nenhum conteúdo de script',
  scriptEmpty: 'O script está vazio',
  invalidJsonShort: 'JSON inválido',

  // ── Import modal ──
  msgStepsArrayNoDot: 'O script deve ter um array "steps"',
  errInvalidScriptObject: 'Script inválido: deve ser um objeto',
  importModalTitle: 'Importar Action Script',
  importIntoBuilderTitle: 'Importar script para o Construtor',
  validateAndLoadBtn: 'Validar e carregar',
  validateAndImportBtn: 'Validar e importar',
  errCannotVerifyPassword: 'Não é possível verificar a senha: conexão com o dispositivo não disponível.',
  errVerificationFailed: 'Falha na verificação',
  errCouldNotDetermineDevice:
    'Não foi possível determinar o dispositivo para a importação. Feche o modal e abra Importar novamente a partir desta aba de dispositivo.',
  errInvalidScript: 'Script inválido',
  errSaveFolderRequired:
    'A pasta de salvamento é necessária para este script (ex. etapa de Captura de tela). Escolha uma pasta de salvamento.',
  errDevPasswordRequired: 'A senha de desenvolvedor é necessária e não está no cache nem no script. Informe-a abaixo.',
  verifyingPassword: 'Verificando senha…',
  errAuthFailed: 'Falha na autenticação. Verifique a sua senha e tente novamente.',
  errPasswordVerificationFailed: 'Falha na verificação da senha.',
  errValidationFailed: 'Falha na validação',
  errVerificationOrValidationFailed: 'Falha na verificação ou validação',
  errFailedToReadFile: 'Falha ao ler o arquivo',

  // ── Step Help modal: subtitles + title ──
  helpSubCustomEndpoint: 'Endpoint personalizado',
  helpSubSelectPost: 'Selecione um POST',
  helpSubFixedDelay: 'Atraso fixo',
  helpUntilCondition: (srcLabel: string): string => `Até a condição · ${srcLabel}`,
  helpSubSelectCommand: 'Selecione um comando',
  helpSubSelectKey: 'Selecione uma tecla',
  helpSubSelectCommandShort: 'Selecionar comando',
  helpSystemTelnetTitle: 'Plugins / Memória (legado)',
  helpNoText: (type: string): string => `Nenhum texto de ajuda para “${type}”.`,

  // ── Step Help modal: variant bodies (inline HTML) ──
  helpBodyQueryCustom: `
    <p>
      <strong>Personalizado</strong> permite que você digite qualquer caminho de Consulta de dispositivo: um <code>/query/…</code> ECP GET normal, ou
      valores no estilo dev como <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Use isto quando não houver uma predefinição para o endpoint de que você precisa. O valor é enviado como está para a mesma máquina de consulta das predefinições.</p>
  `,
  helpBodyQueryTelnetPlugins: `
    <p>
      Executa o comando telnet de desenvolvedor <strong>plugins</strong> (lista de canais empacotados / resumo de plugins). São os
      mesmos dados de escolher a predefinição Plugins em fluxos antigos, expressos como uma predefinição de consulta.
    </p>
    <p>Requer acesso de desenvolvedor ao dispositivo (igual a outras consultas de dev-plugin).</p>
  `,
  helpBodyQueryTelnetFree: `
    <p>
      Executa o comando telnet de desenvolvedor <strong>free</strong> (captura no estilo memória / heap). Use-o quando precisar de uma
      leitura rápida de memória durante um script.
    </p>
  `,
  helpBodyPostNone: `
    <p>Escolha uma das predefinições de <strong>POST</strong> (SGRendezvous, FW Beacons, etc.). Cada opção é mapeada para um caminho fixo no dispositivo.</p>
  `,
  helpBodyWaitDelay: `
    <p>
      Pausa o script pelo número de <strong>milissegundos</strong> informado, sem sondagem. Use após animações,
      inicializações ou qualquer etapa em que você só precise de uma pausa fixa.
    </p>
  `,
  helpBodyWaitMediaPlayer: `
    <p>
      Sonda <code>/query/media-player</code> até que o <strong>estado</strong> do reprodutor corresponda à sua seleção (play,
      pause, buffer, …) ou até esgotar o <strong>tempo limite</strong>.
    </p>
    <p>
      Ajuste o <strong>Intervalo de sondagem</strong> para equilibrar responsividade e carga. Se a condição nunca se tornar verdadeira, a
      etapa falha quando o tempo limite é atingido.
    </p>
  `,
  helpBodyWaitRale: `
    <p>
      Sonda via <strong>RALE</strong> até que um campo em um nó da cena corresponda à comparação (operador + valor). Você deve
      fornecer o caminho (array JSON), o ID do nó, o nome do campo e os campos de tempo.
    </p>
    <p>
      Requer uma conexão do App Connector em tempo de execução. Operadores como <code>exists</code> / <code>notExists</code> podem
      ocultar o campo de valor — veja os rótulos do formulário para o modo ativo.
    </p>
  `,
  helpBodyIfMediaPlayer: `
    <p>
      Avalia uma vez o estado atual do <strong>reprodutor de mídia</strong> e executa o ramo <strong>então</strong> ou
      <strong>senão</strong>. Escolha o estado esperado (play, pause, …) para a bifurcação.
    </p>
    <p>Diferente de <strong>Esperar</strong>, não há sondagem: a condição é verificada uma única vez quando a etapa é executada.</p>
  `,
  helpBodyIfActiveApp: `
    <p>
      Compara um atributo de <code>/query/active-app</code> (app id, tipo, versão, nome) usando o operador e
      o valor que você definir. Útil para bifurcar quando um canal específico está em primeiro plano.
    </p>
  `,
  helpBodyIfRale: `
    <p>
      Verificação única de um <strong>campo de nó RALE</strong> (caminho, ID do nó, campo, operador, valor). Mesma estrutura do
      lado RALE de uma condição de Esperar, mas avaliada uma vez para bifurcar.
    </p>
  `,
  helpBodyIfVariables: `
    <p>
      Compara um valor armazenado em uma <strong>variável de script</strong> (de um comando RALE ou de uma atribuição de função do app anterior)
      usando o caminho da variável e o operador que você configurar.
    </p>
    <p>Requer a versão 2 do script e etapas anteriores que preencham a variável.</p>
  `,
  helpBodyRaleNone: `
    <p>Selecione um <strong>comando RALE</strong> na lista. Os parâmetros e o opcional “Definir variável” aparecem depois que um comando é escolhido.</p>
  `,
  helpBodyAppFunctionNone: `
    <p>
      Conecte o <strong>App Connector</strong> para que as funções exportadas do seu canal apareçam na lista, depois escolha uma
      função para ver os parâmetros dela.
    </p>
  `,
  helpBodyKeypressNone: `
    <p>Escolha uma <strong>tecla do controle remoto</strong> na lista agrupada. O script envia essa tecla por ECP quando a etapa é executada.</p>
  `,
  helpBodySystemTelnetNone: `
    <p>Escolha <strong>Plugins</strong> ou <strong>Memória</strong> para esta etapa legada, ou migre para Consulta de dispositivo com as predefinições de telnet correspondentes.</p>
  `,
  helpBodySystemTelnetPlugins: `
    <p>Comando telnet <strong>plugins</strong> legado. Prefira <strong>Consulta de dispositivo</strong> com a predefinição <code>telnet:plugins</code> para novos scripts.</p>
  `,
  helpBodySystemTelnetFree: `
    <p>Comando telnet <strong>free</strong> (memória) legado. Prefira <strong>Consulta de dispositivo</strong> com a predefinição <code>telnet:free</code> para novos scripts.</p>
  `,

  // ── Step Help modal: per-action fallback bodies (inline HTML) ──
  helpFallbackQuery: `
    <p>
      Executa uma leitura no dispositivo: um <strong>ECP GET</strong> normal em um caminho <code>/query/…</code> ou um
      endpoint no estilo dev como <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Escolha uma predefinição para endpoints comuns, ou <strong>Personalizado</strong> para digitar o seu.</p>
  `,
  helpFallbackPost: `
    <p>
      Envia um <strong>HTTP POST</strong> para o Roku em um caminho fixo de analytics / beacon. Cada predefinição é mapeada para um
      endpoint específico usado em fluxos de desenvolvimento.
    </p>
  `,
  helpFallbackKeypress: `
    <p>
      Envia uma <strong>tecla do controle remoto</strong> por ECP. O título da ajuda reflete qual tecla está selecionada no momento em que
      você abre esta caixa de diálogo.
    </p>
  `,
  helpFallbackInputText: `
    <p>
      Envia <strong>texto no estilo de teclado</strong> para o dispositivo (entrada de texto ECP). O campo em foco ou o
      teclado na tela recebe os caracteres.
    </p>
  `,
  helpFallbackLaunch: `
    <p>
      Inicia um canal por <strong>app ID</strong>. <strong>Parâmetros</strong> opcionais podem fornecer um Deep-Link ou argumentos
      de inicialização dependendo do canal.
    </p>
  `,
  helpFallbackSideload: `
    <p>
      Envia um pacote a partir do <strong>caminho do arquivo</strong> e o instala como o canal de desenvolvedor carregado via sideload. Forneça uma
      senha de desenvolvedor na etapa ou via <code>devPassword</code> no script quando necessário.
    </p>
  `,
  helpFallbackDeleteSideload: `
    <p>Remove o canal de desenvolvedor carregado via sideload. A senha opcional corresponde às configurações de segurança de dev do seu dispositivo.</p>
  `,
  helpFallbackAppFunction: `
    <p>
      Chama uma <strong>função BrightScript</strong> via App Connector. O subtítulo mostra a <strong>função
      selecionada</strong>. Os parâmetros correspondem à assinatura exportada do canal; use <strong>Definir variável</strong> para capturar um
      valor de retorno para etapas posteriores.
    </p>
  `,
  helpFallbackRaleCommand: `
    <p>
      Executa um <strong>comando RALE integrado</strong>. O subtítulo mostra o comando selecionado; o texto ampliado vem
      da descrição integrada do comando quando disponível.
    </p>
  `,
  helpFallbackDevicePerformance: `
    <p>
      Captura os gráficos de <strong>Desempenho do dispositivo</strong> para o <strong>mesmo dispositivo</strong> em que este script é executado (a
      mesma conexão da Consulta de dispositivo e da pulsação de tecla). Os valores seguem as configurações de histórico da Remote Section quando a sondagem ao vivo
      preencheu os gráficos; caso contrário, a etapa aguarda brevemente por uma amostra nova quando necessário.
    </p>
    <h4>Gráfico</h4>
    <p>
      <strong>Objetos BrightScript</strong>, <strong>Uso de CPU</strong>, <strong>Memória do sistema</strong>, ou
      <strong>Tudo combinado</strong> (um resultado combinado: CPU, depois memória, depois objetos). CPU e memória vêm da
      mesma sondagem de desempenho do canal.
    </p>
    <h4>Rótulo opcional</h4>
    <p>Exibido no cabeçalho de resultados, semelhante à etapa de captura de tela.</p>
  `,
  helpFallbackScreenshot: `
    <p>
      Captura a imagem da TV através do <strong>Developer App</strong>. O Developer App deve estar ativo; uma
      senha de desenvolvedor deve estar disponível na etapa, no script ou no prompt de validação.
    </p>
    <h4>Esperar antes (ms)</h4>
    <p>
      Pausa no executor <strong>antes</strong> de a captura começar, para que a UI possa se estabilizar (padrão de 100 ms quando você adiciona
      a etapa).
    </p>
    <h4>Esperar depois (ms)</h4>
    <p>
      Após acionar a captura, o executor aguarda antes de baixar <code>dev.jpg</code>. Aumente se as imagens estiverem
      truncadas; vazio usa o padrão de <strong>1500 ms</strong>.
    </p>
    <h4>Rótulo opcional</h4>
    <p>Ajuda a identificar esta captura na saída da execução quando um script tira várias capturas de tela.</p>
  `,
  helpFallbackWait: `
    <p>
      Ou um <strong>atraso fixo</strong> ou <strong>até que uma condição</strong> seja satisfeita. O subtítulo reflete o
      tipo de espera atual e, para condições, a origem de dados (reprodutor de mídia vs. campo de nó RALE).
    </p>
  `,
  helpFallbackIf: `
    <p>
      Bifurca em listas de etapas <strong>então</strong> / <strong>senão</strong> usando uma condição única. O subtítulo
      reflete a origem da condição selecionada (reprodutor de mídia, app ativo, campo RALE ou variáveis). Requer a versão
      2 do script.
    </p>
  `,
  helpFallbackSystemTelnet: `
    <p>
      Etapa <strong>legada</strong> somente de telnet. Prefira <strong>Consulta de dispositivo</strong> com <code>telnet:plugins</code> ou
      <code>telnet:free</code> para novos scripts.
    </p>
  `,

  // ── Step Help modal: composed / interpolated body fragments (dynamic values pre-escaped) ──
  helpQueryPresetBody: (label: string, endpoint: string): string => `
    <p>
      Executa uma <strong>Consulta de dispositivo</strong> para <strong>${label}</strong> usando o endpoint
      <code>${endpoint}</code>.
    </p>
    <p>
      Como todas as consultas, esta usa ECP (ou o caminho de dev-plugin do app para predefinições no estilo telnet). O dispositivo deve estar
      acessível na rede.
    </p>
  `,
  helpPostPresetBody: (label: string, endpoint: string): string => `
    <p>
      Envia um <strong>POST</strong> HTTP para <code>${endpoint}</code> (<strong>${label}</strong>).
    </p>
    <p>Use isto para fluxos de analytics / beacon que esperam POST em vez de GET.</p>
  `,
  helpSelectedFunction: (fn: string): string =>
    `<p><strong>Função selecionada:</strong> <code>${fn}</code></p>`,
  helpAppFunctionDescription: (desc: string): string =>
    `<p><strong>Descrição da função do app:</strong> ${desc}</p>`,
  helpAppFunctionArgs:
    '<p>As linhas de argumentos seguem os metadados do App Connector para esta função; tipos complexos usam JSON no campo.</p>',
  helpCurrentKey: (nice: string, key: string): string => `
        <p>
          <strong>Tecla atual:</strong> ${nice} (<code>${key}</code>) — enviada como uma pulsação de tecla
          ECP padrão quando a etapa é executada.
        </p>
      `,

  // ── Builder: additional field placeholders / option fallbacks ──
  placeholderQueryEndpoint: '/query/… ou telnet:plugins / telnet:free',
  placeholderVariablePathExample: 'myVar ou data.items.0.id',
  optionUnknownFunction: 'desconhecida',

  // ── Executor: step descriptions (stepDescription; result-card header + list rows) ──
  descQuery: (endpoint: string): string => `Consulta ${endpoint}`,
  descKeypress: (key: string): string => `Pressionar tecla ${key}`,
  descSendText: (text: string): string => `Enviar texto "${text}"`,
  descLaunchApp: (appId: string): string => `Iniciar app ${appId}`,
  descSideload: (filename: string): string => `Sideload ${filename}`,
  descDeleteSideload: 'Excluir sideload',
  descAppFunction: (fn: string): string => `Função do app ${fn}`,
  descScreenshot: 'Captura de tela',
  descScreenshotLabel: (label: string): string => `Captura de tela (${label})`,
  descScreenshotWaitAfter: (ms: number): string => `Captura de tela (esperar depois: ${ms}ms)`,
  descDevicePerformance: (chart: string): string => `Desempenho do dispositivo — ${chart}`,
  descDevicePerformanceLabel: (label: string, chart: string): string =>
    `Desempenho do dispositivo (${label}) — ${chart}`,
  descWait: 'Esperar',
  descWaitWithDetails: (details: string): string => `Esperar · ${details}`,
  descIf: 'Se (…)',
  descIfWithDetails: (details: string): string => `Se · ${details}`,

  // ── Executor: wait-step Details column (formatWaitStepListDetails) ──
  waitDetailFixedDelay: (delayMs: number): string => `Atraso fixo ${delayMs} ms`,
  waitDetailTiming: (maxSec: number, pollMs: number): string =>
    ` · máx ${maxSec}s · sondagem ${pollMs}ms`,
  waitDetailMediaPlayerState: (state: string): string => `Reprodutor de mídia · até estado "${state}"`,
  waitDetailMediaPlayerCheck: (check: string): string => `Reprodutor de mídia · até ${check}`,
  waitDetailRale: (line: string): string => `Campo de nó RALE · ${line}`,
  waitDetailRaleIncomplete: 'Campo de nó RALE · (incompleto)',
  waitDetailGenericSource: (src: string): string => `Esperar · origem ${src}`,

  // ── Executor: if-step Details column (formatIfStepListDetails) ──
  ifDetailMediaPlayerState: (state: string): string => `Reprodutor de mídia · estado "${state}"`,
  ifDetailMediaPlayerCheck: (check: string): string => `Reprodutor de mídia · ${check}`,
  ifDetailRale: (line: string): string => `Campo de nó RALE · ${line}`,
  ifDetailRaleEmpty: 'Campo de nó RALE · …',
  ifDetailVariable: (path: string): string => `Variável · $${path}`,
  ifDetailVariableEmpty: 'Variável · …',
  ifDetailActiveApp: (attr: string): string => `App ativo · ${attr}`,
  ifDetailActiveAppEmpty: 'App ativo · …',

  // ── Executor: results-panel progress log lines (onLog) ──
  logWaitingMs: (ms: number): string => `Aguardando ${ms} ms...`,
  logWaitingBeforeCapture: (ms: number): string => `Aguardando ${ms} ms antes da captura...`,
  logPollingFieldMet: (elapsed: number, field: string): string =>
    `Sondando... (${elapsed}s) — campo "${field}" — condição satisfeita`,
  logPollingField: (elapsed: number, field: string, value: string): string =>
    `Sondando... (${elapsed}s) — campo "${field}": ${value}`,
  logPollingStatusMet: (elapsed: number, status: string): string =>
    `Sondando... (${elapsed}s) — ${status} — condição satisfeita`,
  logPollingStatus: (elapsed: number, status: string): string =>
    `Sondando... (${elapsed}s) — ${status}`,
  pollValueEmpty: '(vazio)',
  pollValueReconnecting: '(reconectando...)',
  pollValueNoResponse: '(sem resposta)',
  pollStateValue: (state: unknown): string => `estado: ${state}`,
  pollStateNone: 'estado: (nenhum)',
  pollInvalidMediaPlayer: 'Resposta inválida de media-player',
  pollQueryFailed: (err: string): string => `Consulta falhou: ${err}`,
  pollNoResponse: 'Sem resposta',
  logConnectingTelnet: 'Conectando ao Telnet (porta 8080)...',
  logQueryUsesDevTelnet: (ep: string, cmd: string): string =>
    `Consulta de dispositivo "${ep}" usa o Telnet de dev "${cmd}" (igual à aba Consulta).`,
  logPartialPerformance: 'Algumas seções de desempenho estavam indisponíveis; captura parcial.',

  // ── Executor: step result summaries (onLog) ──
  stepSummaryChars: (n: number): string => `→ ${n} caracteres`,
  stepSummaryOk: '→ OK',
  stepSummarySentKey: (key: string): string => `→ ${key} enviada`,
  stepSummarySent: '→ enviado',
  stepSummaryLaunched: (appId: string): string => `→ ${appId} iniciado`,
  stepSummarySideloadComplete: '→ sideload concluído',
  stepSummaryDeleted: '→ excluído',
  stepSummarySaveFailed: (err: string): string => `→ falha ao salvar: ${err}`,
  stepSummarySavedAs: (filename: string): string => `→ salvo como ${filename}`,
  stepSummaryCapturedNoFolder: '→ capturado (sem pasta de salvamento)',
  stepSummaryChartImages: (n: number): string => `→ ${n} imagem(ns) de gráfico`,
  stepSummaryCaptured: '→ capturado',
  stepSummarySkipped: (reason: string): string => `→ pulado (${reason})`,

  // ── Executor: step errors / skip reasons (result.error / skippedReason) ──
  errWaitTimeout: 'Tempo limite de espera',
  errStopped: 'Interrompido',
  skipReasonNoAppConnector: 'App Connector não disponível',
  errNoAppConnectorRaleWait: 'App Connector não disponível para espera de nó RALE',
  errUnknownActionType: (type: string): string => `Tipo de ação desconhecido: ${type}`,
  errInvalidRaleCommand: 'Comando RALE inválido',
  errTelnetNotAvailable: 'Comandos de sistema Telnet não estão disponíveis neste contexto',
  errSaveNotAvailable: 'Salvamento não disponível',
  errCouldNotVerifyDevApp: (err: string): string =>
    `Não foi possível verificar o status do Dev App antes da captura de tela: ${err}`,
  errInvalidPath: 'Caminho inválido',
  errStepPreorderMismatch: 'Erro interno: incompatibilidade de pré-ordenação de etapas',

  // ── Settings: Action Script default-folder picker (main process) ──
  pickDefaultFolderTitle: 'Pasta padrão para a saída do Action Script'
};

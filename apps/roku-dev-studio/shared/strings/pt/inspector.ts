/**
 * pt-BR (Brazilian Portuguese) translation of shared/strings/inspector.ts.
 * UI strings for the SceneGraph / node Inspector (App Connector / RALE tab):
 * connection status, the Response card, the Execute Function dropdown, the
 * Update Node modal, and the roRegistry builtin param editors.
 *
 * Parametrized strings are functions returning the composed text — the standard
 * way to keep interpolation translatable without a runtime format library.
 * Protocol identifiers (RALE command names, node/field types) are passed in as
 * arguments rather than baked into the catalog.
 */
export const inspector = {
  // Reused generic status / errors (Inspector-scoped variants)
  notConnected: 'Não conectado',
  commandFailed: 'Falha no comando',
  noResponseFromDevice: 'Sem resposta do dispositivo',

  // Connection flow (Connect/Disconnect, status line, Dev App preflight)
  connectingBtn: 'Conectando...',
  connectionLost: 'Conexão perdida',
  reconnecting: 'Reconectando...',
  connectingStatus: '🟡 Conectando...',
  reconnectingStatus: '🟡 Reconectando...',
  connectedBang: 'Conectado!',
  checkingDevApp: 'Verificando se o Dev App está ativo...',
  couldNotVerifyDevAppQuery:
    'Não foi possível verificar o status do Dev App. A consulta do app ativo falhou (rede / ECP / modo de desenvolvedor?).',
  couldNotVerifyDevApp: 'Não foi possível verificar o status do Dev App.',
  checkConnectionHint: 'Verifique a conexão do dispositivo e o modo de desenvolvedor, depois tente Conectar novamente.',
  statusCheckFailed: 'Falha na verificação de status',
  devAppNotRunning:
    'O Dev App não está em execução no dispositivo Roku. Inicie primeiro o Dev App carregado via sideload.',
  launchDevAppHint: 'Vá até a aba Dev App e clique em "Iniciar" para iniciar seu canal carregado via sideload.',
  devAppNotActive: 'Dev App inativo',
  wakingUpTrackerTask: (port: number): string => `Ativando TrackerTask na porta ${port}...`,
  failedToConnect: 'Falha ao conectar',
  failedToWakeTrackerTask: 'Falha ao ativar o TrackerTask',
  connectingToSocket: 'Conectando ao socket...',
  connectingToSocketRetry: (attempt: number): string =>
    `Conectando ao socket (tentativa ${attempt})...`,
  initializing: 'Inicializando...',
  connectionClosedByDevice: 'Conexão encerrada pelo dispositivo',

  // Response card (index.ts)
  findInResponse: 'Localizar na resposta',
  saveResponseTitle: 'Salvar resposta',
  failedAutoFetchFunctions: 'Falha ao buscar funções automaticamente. Clique em Atualizar para tentar novamente.',
  refreshing: (command: string): string => `Atualizando ${command}…`,

  // Function selector / dropdown (function-selector.ts)
  connectToLoadFunctions: '-- Conecte-se para carregar funções --',
  selectAFunction: '-- Selecione uma função --',
  selectFunctionForParamDetails: 'Selecione uma função para ver os detalhes dos parâmetros',
  appConnectorFunctions: 'Funções do App Connector',
  raleFunctions: 'Funções do RALE',
  noFunctionsImplement: 'Nenhuma função — implemente GetExternalControlFunctions',
  readyToExecute: 'Pronto para executar',
  unknownFunctionName: 'desconhecida',
  functionCounts: (appCount: number, raleCount: number): string =>
    `${appCount} ${appCount === 1 ? 'função' : 'funções'} de app, ${raleCount} ${raleCount === 1 ? 'comando' : 'comandos'} do RALE`,

  // Function execution (function-execution.ts)
  sending: (command: string): string => `Enviando ${command}...`,
  executing: (selection: string): string => `Executando ${selection}...`,
  fetchingFunctions: 'Buscando funções disponíveis...',
  foundFunctions: (n: number): string => `${n} ${n === 1 ? 'função encontrada' : 'funções encontradas'}`,
  noFunctionsReturned: 'Nenhuma função retornada',
  getExternalControlFunctionsReturnedFalse:
    'getExternalControlFunctions retornou false — verifique se a cena SceneGraph implementa esta função',
  failedToFetchFunctions: 'Falha ao buscar funções',
  selectFunctionToExecute: 'Selecione uma função para executar',
  functionExecutionFailed: 'Falha na execução da função',
  unknownRaleBuiltin: 'Builtin do RALE desconhecido',
  unhandledRaleBuiltin: (command: string): string => `Builtin do RALE não tratado: ${command}`,

  // RALE path parsing (node-lookup.ts)
  pathMustBeJsonArray: 'O caminho deve ser um array JSON (ex.: [] ou [{"child":0}])',
  invalidPathJson: (detail: string): string => `JSON do caminho inválido: ${detail}`,

  // Update Node modal (node-update-panel.ts)
  noNodeContext: 'Sem contexto de nó — execute Obter nó por ID primeiro.',
  fieldNameRequired: 'O nome do campo é obrigatório.',
  selectNodeFailed: 'Falha em selectNode',
  selectingNode: 'Selecionando nó…',
  removingField: 'Removendo campo…',
  addingField: 'Adicionando campo…',
  updatingField: 'Atualizando campo…',
  removedField: (name: string): string => `Campo "${name}" removido.`,
  addedField: (name: string): string => `Campo "${name}" adicionado.`,
  updatedField: (name: string): string => `Campo "${name}" atualizado.`,
  removeFieldBtn: 'Remover campo',
  addFieldBtn: 'Adicionar campo',
  updateFieldBtn: 'Atualizar campo',
  valueLabel: 'Valor',
  newValueLabel: 'Novo valor',
  addValuePlaceholder:
    'Valor inicial para o novo campo (escalares, true/false, JSON para arrays / objeto)',
  updateValuePlaceholder: 'Escalares, true/false, JSON para arrays / vetores / objetos',

  // Update Node — value parse errors (parseValueForRaleFieldType)
  parseBoolean: 'boolean: use true ou false',
  parseInteger: 'integer: número inválido',
  parseFloat: 'float: número inválido',
  parseColor: 'color: use um inteiro (ex.: -16777216)',
  parseVector2d: 'vector2d: pelo menos dois elementos, ex.: [0,0]',
  parseRect2d: 'rect2d: quatro elementos, ex.: [0,0,100,100]',
  parseArray: 'array: array JSON inválido',
  parseAssocArray: 'assocarray: objeto JSON obrigatório',
  jsonArrayRequired: (type: string): string => `${type}: array JSON obrigatório`,
  invalidJsonArray: (type: string): string => `${type}: array JSON inválido`,

  // Registry builtin param editors (registry-params-ui.ts)
  unexpectedRegistryResponse: 'Resposta inesperada do registro',
  loadingRegistry: 'Carregando registro…',
  selectSection: '— Selecione a seção —',
  noSections: '(nenhuma seção)',
  selectKey: '— Selecione a chave —',
  noKeys: '(nenhuma chave)',
  ariaSectionToRemove: 'Seção a remover',
  ariaSection: 'Seção',
  ariaKey: 'Chave',
  ariaKeyToReplace: 'Chave a substituir',
  removeSectionHint: 'Seções carregadas do dispositivo. Executar remove a seção selecionada.',
  fieldKeyPlaceholder: 'Chave do campo',
  stringValuePlaceholder: 'Valor de string',
  newKeyPlaceholder: 'Nova chave',
  newValuePlaceholder: 'Novo valor',

  // Registry client-side validation (registry-validation.ts)
  sectionNameRequired: 'O nome da seção é obrigatório.',
  sectionMustBeJsonObject: 'A seção deve ser um objeto JSON (não um array).',
  sectionKeysNotEmpty: 'As chaves do objeto da seção não podem estar vazias ou conter apenas espaços em branco.',
  eachValueMustBeString: (key: string): string =>
    `Cada valor deve ser uma string (o roRegistry armazena strings). A chave "${key}" não é uma string — use strings entre aspas no JSON.`,
  selectSectionFromList: 'Selecione uma seção na lista.',
  selectKeyFromList: 'Selecione uma chave na lista.',
  enterFieldKey: 'Insira uma chave de campo.',

  // Parameter inputs (parameter-inputs.ts)
  noParamsRequired: '✓ Nenhum parâmetro obrigatório',
  selectFunctionForParams: 'Selecione uma função para ver os parâmetros',
  booleanPlaceholder: 'true ou false',
  stringPlaceholder: 'Digite o texto...',

  // Execute Function dropdown — RALE builtin labels (rale-builtins.ts)
  getNodeByIdLabel: 'Obter nó por ID',
  getNodeByNameLabel: 'Obter nó por SubType (classe de componente)',
  getRegistrySectionsLabel: '[Registro] Obter todas as seções',
  clearRegistryLabel: '[Registro] Limpar todas as seções',
  addRegistrySectionLabel: '[Registro] Adicionar/atualizar seção',
  removeRegistrySectionLabel: '[Registro] Remover seção',
  addRegistryFieldLabel: '[Registro] Definir chave da seção',
  removeRegistryFieldLabel: '[Registro] Remover chave da seção',
  editRegistryFieldLabel: '[Registro] Editar chave da seção',

  // Execute Function dropdown — RALE builtin descriptions (hint text)
  getNodeByIdDesc:
    'RALE getNodeById — busca em profundidade sob o caminho; id corresponde ao campo id do nó. Caminho [] = raiz da cena.',
  getNodeByNameDesc:
    'RALE getNodeByName — name é node.subtype() (classe de componente XML), ex.: Label, RowList. Caminho [] = raiz da cena.',
  getRegistrySectionsDesc:
    'RALE getRegistrySections — lê todas as seções e chaves do roRegistry (retorna objeto aninhado por nome da seção).',
  clearRegistryDesc:
    'RALE clearRegistry — exclui todas as seções do registro no dispositivo (destrutivo).',
  addRegistrySectionDesc:
    'RALE addRegistrySection — args.name = nome da seção; args.section = objeto JSON com pares de chave/valor de string.',
  removeRegistrySectionDesc:
    'RALE removeRegistrySection — exclui uma seção. As seções são carregadas do dispositivo; após o sucesso, o registro é atualizado.',
  addRegistryFieldDesc:
    'RALE addRegistryField — define um valor de string para uma chave em uma seção. A lista de seções é carregada do dispositivo.',
  removeRegistryFieldDesc:
    'RALE removeRegistryField — exclui uma chave. Escolha a seção e a chave em listas carregadas do dispositivo.',
  editRegistryFieldDesc:
    'RALE editRegistryField — escolha a seção e a chave, depois insira newKey e newValue. As listas são carregadas do dispositivo.',
};

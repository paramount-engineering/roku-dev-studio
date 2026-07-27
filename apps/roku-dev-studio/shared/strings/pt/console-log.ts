/**
 * UI strings for the Console log surfaces: the shared find/filter bar (live telnet Console +
 * standalone Log Viewer), the formatted JSON/XML and URL viewer modals, the Console Monitor
 * (analytics) modal, and the structured-syntax fold controls.
 *
 * Parametrized strings are functions returning the composed text — the standard way to keep
 * interpolation translatable without a runtime format library. A few values are consumed inside
 * `innerHTML` templates (the modal shells), so they render as plain text just as any other leaf.
 *
 * pt-BR (Brazilian Portuguese) translation.
 */
export const consoleLog = {
  // ── Shared viewer modal chrome (console-modal-title.ts, structured + URL modals) ──────
  /** Default title prefix for the JSON/XML/URL viewer modals ("Console: JSON"). */
  titlePrefix: 'Console',
  jsonLabel: 'JSON',
  xmlLabel: 'XML',
  jsonPlusLabel: 'JSON+',
  urlLabel: 'URL',
  /** Transient button feedback after copying (plain text, no glyph — distinct from common.copied). */
  copied: 'Copiado',

  // ── Fold twisty (console-structured-syntax.ts) ────────────────────────────────────────
  collapse: 'Recolher',
  expand: 'Expandir',

  // ── Structured JSON/XML viewer modal (console-structured-view-modal.ts) ───────────────
  copyFormattedTitle: 'Copiar texto formatado',
  hintJsonFullNested: 'Clique para ver o JSON completo desta linha. Use JSON+ apenas para fragmentos aninhados.',
  hintJsonFormatted: 'Clique para ver o JSON formatado (abre em um modal)',
  hintXmlFull: 'Clique para ver o XML completo desta linha.',
  hintXmlFormatted: 'Clique para ver o XML formatado (abre em um modal)',
  hintPillNestedJson: 'Apenas JSON aninhado (de uma string escapada). Não abre o JSON externo completo.',
  hintPillFullJson: 'JSON completo desta linha (clique no texto da linha para o mesmo).',

  // ── URL viewer modal (console-url-modal.ts) ───────────────────────────────────────────
  openInBrowser: 'Abrir no navegador',
  openInBrowserTitle: 'Abrir no navegador padrão',
  copyUrlTitle: 'Copiar URL',
  fullUrlAria: 'URL completa',
  queryParamsAria: 'Parâmetros de consulta',
  colKey: 'Chave',
  colValue: 'Valor',
  couldNotParseParams: 'Não foi possível analisar os parâmetros.',
  noQueryParams: 'Nenhum parâmetro de consulta.',
  parameterSet: (n: number): string => `Conjunto de parâmetros ${n}`,

  // ── Inline URL span (console-url-detect.ts) ───────────────────────────────────────────
  urlSpanTitle: 'Clique para visualizar em um modal · ⌘ ou Ctrl+Clique para abrir no navegador',

  // ── Find/filter bar markup (console-find-bar-markup.ts) ───────────────────────────────
  modeSelectAria: 'Modo de busca ou filtro',
  modeFind: 'Buscar',
  modeFilter: 'Filtrar',
  queryPlaceholder: 'Buscar...',
  queryAria: 'Consulta de busca ou filtro',
  // Option-button tooltips: `alt` appends the (Alt+…) shortcut hint the main window binds.
  // The aria-label reuses the same text with `alt=false` (no shortcut suffix).
  optMatchCaseTitle: (alt: boolean): string => `Diferenciar maiúsculas${alt ? ' (Alt+C)' : ''}`,
  optWholeWordTitle: (alt: boolean): string => `Coincidir palavra inteira${alt ? ' (Alt+W)' : ''}`,
  optRegexTitle: (alt: boolean): string => `Usar expressão regular${alt ? ' (Alt+R)' : ''}`,
  prevTitle: 'Anterior (Shift+Enter)',
  prevAria: 'Correspondência anterior',
  nextTitle: 'Próximo (Enter)',
  nextAria: 'Próxima correspondência',
  clearAria: 'Limpar busca',

  // ── Find/filter bar runtime (console-find-bar.ts) ─────────────────────────────────────
  regexSuggestTitle: 'Isto parece uma expressão regular — clique para buscar por regex',
  searchingPct: (pct: number): string => `Buscando... ${pct}%`,
  noResults: 'Nenhum resultado',
  matchPosition: (current: number, total: number): string => `${current} de ${total}`,
  firstMatchesNote: ' (primeiras correspondências)',
  highlightsCappedNote: ' (destaques limitados)',
  searchingSuffix: (pct: number): string => ` (buscando ${pct}%)`,
  searchingRemote: 'Buscando…',
  filteringRemote: 'Filtrando…',
  searchFailed: 'Falha na busca',
  filterFailed: 'Falha no filtro',
  linesMatched: (n: number, capped: boolean): string =>
    `${n.toLocaleString()} linhas${capped ? ' (limitado)' : ''}`,

  // ── Console Monitor / analytics modal (console-analytics-modal.ts) ────────────────────
  monitorTitle: 'Console Monitor',
  noRecognizedIssues: 'Nenhum problema reconhecido do BrightScript. 🎉',
  sectionCrashes: 'Travamentos',
  sectionIssues: 'Problemas',
  labelWhat: 'O que',
  labelCause: 'Causa',
  labelFix: 'Correção',
  docsLink: 'docs ↗',
  copyMessageTitle: 'Copiar mensagem',
  copyMessageAria: 'Copiar mensagem de erro',
  goToLineTitle: 'Ir para esta linha no log',
  goToCrashTitle: 'Ir para este travamento no log',
  copyCrashTitle: 'Copiar travamento + backtrace',
  copyCrashAria: 'Copiar travamento e backtrace',
  backtraceHead: 'Backtrace',
  noBacktrace:
    'O canal foi encerrado por um travamento do BrightScript; nenhum backtrace foi capturado nesta saída do console.',
  crashKindLabel: 'Travamento',
  // Crash severity badge (rendered uppercase via CSS; kept lowercase to mirror the data-driven
  // severity tokens on the non-crash issue badges).
  severityCrash: 'travamento',
  // Crash card annotations: "exited" badge and inline "runtime error <code>" (both lowercase; the
  // badge is uppercased by CSS, the code annotation reads inline).
  exitedLabel: 'encerrado',
  exitedTitle: 'O processo do canal foi encerrado',
  runtimeErrorLabel: 'erro de execução',
  crashCount: (n: number): string => `${n.toLocaleString()} travamento${n === 1 ? '' : 's'}`,
  issuesAcrossLines: (issues: number, lines: number): string =>
    `${issues.toLocaleString()} problema${issues === 1 ? '' : 's'} em ${lines.toLocaleString()} linha${lines === 1 ? '' : 's'}`,
  spillNote: (total: number): string =>
    `(de ${total.toLocaleString()} capturadas — linhas mais antigas transferidas para o disco não são verificadas)`,
  occurrences: (n: number): string => `Ocorrência${n === 1 ? '' : 's'}`,
  moreUniqueLines: (n: number): string =>
    `+${n.toLocaleString()} linha${n === 1 ? '' : 's'} única${n === 1 ? '' : 's'} a mais`,

  // ── BrightScript error catalog (brightscript-error-catalog.ts) ────────────────────────
  // Cópia localizável de cada entrada do catálogo, com chave pelo `id` da entrada. Os tokens
  // técnicos do BrightScript/Roku são mantidos como estão.
  errors: {
    'type-mismatch': {
      title: 'Incompatibilidade de tipos',
      meaning: 'Um operador foi aplicado a valores de tipos incompatíveis.',
      cause: 'Comparar ou combinar tipos incompatíveis (por exemplo, String vs Integer), ou uma variável não inicializada tratada como o tipo errado.',
      fix: 'Converta com Str()/Val()/ToStr() para que ambos os operandos compartilhem um tipo. O Roku OS 10.5+ nomeia o operador e ambos os tipos na mensagem.',
    },
    'dot-on-invalid': {
      title: 'Operador "Dot" em objeto invalid',
      meaning: 'Uso de `.` para ler um membro/campo em um valor que é invalid ou não é um componente/interface.',
      cause: 'O objeto nunca foi criado ou uma busca retornou invalid — por exemplo, `m.top.findNode("x").text` onde findNode retornou invalid.',
      fix: 'Verifique se é nulo antes de usar o ponto (`if node <> invalid`); confirme que o objeto existe e que o nome do membro está correto.',
    },
    'for-each-non-enumerable': {
      title: 'FOR EACH em um valor não enumerável',
      meaning: '`for each` foi executado sobre um valor que é invalid ou não é um objeto enumerável.',
      cause: 'Iterar o resultado de uma função que retornou invalid (uma chave de AA ausente, um GetChildElements()/GetBody() vazio), ou um escalar/node.',
      fix: 'Verifique nulo/tipo antes do laço; enumere apenas roArray, roList, roAssociativeArray ou roMessagePort (tipos com ifEnum).',
    },
    'call-on-non-function': {
      title: 'Operador de chamada ( ) em algo que não é função',
      meaning: 'O código tentou invocar `()` em um valor que não é uma função.',
      cause: 'Uma variável ocultou uma função, o nome está escrito incorretamente/não declarado, ou o valor é invalid/dados em vez de uma função.',
      fix: 'Verifique se o identificador é uma função definida; verifique colisões de nomes e valores invalid antes de chamar.',
    },
    'uninitialized-variable': {
      title: 'Uso de variável não inicializada',
      meaning: 'Uma variável foi lida antes de receber qualquer valor.',
      cause: 'Um nome de variável escrito incorretamente, uma variável declarada apenas em outro escopo, ou um caminho condicional que pulou a atribuição.',
      fix: 'Inicialize antes de usar; verifique a grafia e o escopo; o depurador mostra essas variáveis locais como `<uninitialized>`.',
    },
    'uninitialized-function-ref': {
      title: 'Referência de função não inicializada',
      meaning: 'Chamada através de uma variável de função que não contém nenhuma função.',
      cause: 'Um ponteiro de função nunca foi atribuído, ou foi definido como invalid.',
      fix: 'Atribua uma referência de função válida antes de invocá-la.',
    },
    'invalid-left-side': {
      title: 'Lado esquerdo inválido da expressão',
      meaning: 'O alvo de uma atribuição não é algo que possa receber um valor.',
      cause: 'Atribuir a um literal ou expressão em vez de a uma variável ou campo de objeto.',
      fix: 'Atribua apenas a uma variável ou a um campo de objeto.',
    },
    'divide-by-zero': {
      title: 'Divisão por zero',
      meaning: 'Uma divisão ou MOD usou um denominador zero em tempo de execução.',
      cause: 'Uma variável divisora resultou em 0 (ou em invalid, convertido para 0).',
      fix: 'Proteja os denominadores antes de dividir (`if d <> 0`).',
    },
    'array-out-of-bounds': {
      title: 'Índice de array fora dos limites',
      meaning: 'Leitura ou escrita além do fim de (ou um índice negativo em) um array.',
      cause: 'Limites de laço com erro de um (off-by-one); indexar um array vazio ou menor.',
      fix: 'Verifique `arr.count()` antes de indexar; valide os limites do laço.',
    },
    'array-not-dimd': {
      title: 'Operação de array em uma variável sem DIM',
      meaning: 'Indexação de uma variável que nunca foi criada como um array.',
      cause: 'Uso de `[]` em um escalar ou em invalid.',
      fix: 'Inicialize o array (`arr = []`) antes de indexá-lo.',
    },
    'non-numeric-array-index': {
      title: 'Índice de array não numérico',
      meaning: 'Uso de uma string/objeto como índice em um roArray.',
      cause: 'Confundir um roArray com um roAssociativeArray.',
      fix: 'Use um AA para chaves de string, ou um índice numérico para arrays.',
    },
    'invalid-num-array-indexes': {
      title: 'Número inválido de índices de array',
      meaning: 'Foi usada a dimensionalidade errada para indexar um array.',
      cause: 'Uso de `a[i,j]` em um array de 1 dimensão (ou vice-versa).',
      fix: 'Faça o número de índices corresponder às dimensões declaradas do array.',
    },
    'wrong-num-params': {
      title: 'Número incorreto de parâmetros de função',
      meaning: 'Uma função foi chamada com argumentos de menos ou de mais.',
      cause: 'Uma assinatura alterada, ou um parâmetro opcional sem valor padrão.',
      fix: 'Faça a chamada corresponder à assinatura; dê valores padrão aos parâmetros opcionais.',
    },
    'bad-throw': {
      title: 'Argumento de throw inválido',
      meaning: 'Um `throw` recebeu algo diferente de uma string ou de um AA de erro válido.',
      cause: 'Lançar um número/objeto que não tem campos `number`/`message` válidos.',
      fix: 'Lance uma string, ou um AA com campos `number` do tipo Integer e `message` do tipo String.',
    },
    'user-thrown-exception': {
      title: 'Exceção de usuário não capturada (THROW)',
      meaning: 'Um `throw` propagou-se até o topo sem ser capturado, encerrando o script.',
      cause: 'Um `throw "…"` (ou `throw {message: …}`) sem um `try/catch` ao redor para tratá-lo.',
      fix: 'Envolva a chamada que lança em `try/catch` (Roku OS 9.4+) e inspecione `e.number`/`e.message`/`e.backtrace`.',
    },
    'invalid-format-specifier': {
      title: 'Especificador de formato inválido',
      meaning: 'Um especificador inválido foi passado para uma função de formatação.',
      cause: 'Um token malformado no estilo Format()/printf.',
      fix: 'Corrija a string de formato.',
    },
    'invalid-param': {
      title: 'Parâmetro inválido passado para função/array',
      meaning: 'Uma função interna recebeu um argumento fora do domínio (por exemplo, sqrt de um negativo, uma dimensão negativa).',
      cause: 'Um domínio matemático inválido ou uma dimensão de array negativa.',
      fix: 'Valide os argumentos antes da chamada.',
    },
    'member-fn-not-found': {
      title: 'Função membro não encontrada',
      meaning: 'Chamada de um método que o componente ou a interface não expõe.',
      cause: 'Um nome de método escrito incorretamente, chamada em invalid, o tipo de componente errado, ou um método ausente naquela versão de firmware.',
      fix: 'Confirme que o método existe para aquele objeto/OS; proteja objetos invalid antes de chamar.',
    },
    'interface-not-member': {
      title: 'Interface não é membro do componente',
      meaning: 'Solicitou uma interface que o componente não implementa.',
      cause: 'Uma chamada GetInterface() para uma interface que o objeto não possui, ou o nome de interface errado.',
      fix: 'Use uma interface que o componente realmente expõe.',
    },
    'component-class-not-found': {
      title: 'Classe de componente / node não encontrada',
      meaning: 'CreateObject / createChild usou uma classe ou tipo de node que não existe.',
      cause: 'Uma string de tipo escrita incorretamente ou com maiúsculas/minúsculas erradas, ou um componente não declarado/registrado no pacote.',
      fix: 'Corrija a string de tipo (diferencia maiúsculas de minúsculas); certifique-se de que o XML do componente esteja incluído no canal.',
    },
    'sg-field-type-mismatch': {
      title: 'Incompatibilidade de tipo de campo do SceneGraph',
      meaning: 'Um valor atribuído a um campo de node não correspondeu ao tipo declarado do campo.',
      cause: 'Atribuir, por exemplo, uma String a um campo int/uri, ou um Array a um campo assocarray via setField/addReplace.',
      fix: 'Atribua um valor que corresponda ao tipo de interface declarado do campo, ou corrija o tipo do campo no XML do componente.',
    },
    'sg-nonexistent-field': {
      title: 'Definir campo inexistente do SceneGraph',
      meaning: 'Atribuição a um campo de node que o tipo de node não declara (ignorado silenciosamente).',
      cause: 'Um nome de campo escrito incorretamente, ou um campo não definido no `<interface>` do XML do componente.',
      fix: 'Use um nome de campo declarado (diferencia maiúsculas de minúsculas), ou adicione o campo à interface do XML do componente.',
    },
    'component-call-arg-count': {
      title: 'Chamada de componente com número incorreto de parâmetros',
      meaning: 'Um método de componente interno foi chamado com o número errado de argumentos.',
      cause: 'Um número de argumentos que não corresponde à assinatura do método ifXXX.',
      fix: 'Faça corresponder à assinatura documentada do método.',
    },
    'rendezvous-aborted': {
      title: 'Rendezvous abortado',
      meaning: 'Um acesso a node entre threads falhou porque o node de destino era invalid ou não existia mais.',
      cause: 'Acessar um node pertencente a outra thread que foi destruída ou travou (por exemplo, um node global perdido após reprodução longa).',
      fix: 'Evite acesso frequente a nodes entre threads; verifique nulo antes do acesso; faça profiling com `logrendezvous` / `sgperf`.',
    },
    'rendezvous-block': {
      title: 'Rendezvous do SceneGraph (bloqueio de thread)',
      meaning: 'Um ponto de sincronização entre render-thread ↔ task-thread; ocorrências frequentes travam a render thread.',
      cause: 'Uma thread de Task lendo/escrevendo campos de node da render-thread um de cada vez.',
      fix: 'Agrupe os acessos a campos com getFields/setFields; minimize o acesso a nodes entre threads.',
    },
    'execution-timeout': {
      title: 'Tempo limite de execução (o script demorou demais)',
      meaning: 'O código executou por muito tempo em uma thread (a render thread tem um limite de alguns segundos).',
      cause: 'Laços pesados, análise de JSON grande, ou I/O síncrono na render thread ou em uma thread de Task.',
      fix: 'Mova o trabalho pesado para um node Task; divida em partes ou torne o trabalho assíncrono.',
    },
    'too-many-task-threads': {
      title: 'Threads de task em excesso',
      meaning: 'Excedeu o limite de threads de Task simultâneas.',
      cause: 'Criar nodes Task em um laço sem reutilização ou limpeza.',
      fix: 'Reutilize/faça pooling de nodes Task; limite a concorrência; deixe as tasks terminarem.',
    },
    'wait-on-non-port': {
      title: 'Wait em um objeto sem message port',
      meaning: '`wait()` foi chamado em um objeto que não tem ifMessagePort.',
      cause: 'Aguardar no objeto errado em vez de um roMessagePort.',
      fix: 'Aguarde apenas em um roMessagePort.',
    },
    'formatjson-nested': {
      title: 'FormatJSON com referência aninhada/cíclica',
      meaning: 'FormatJSON falhou em uma referência circular ou aninhamento com mais de 256 níveis.',
      cause: 'Um grafo de objetos cíclico, ou um tipo de valor não suportado (por exemplo, um roList) na árvore.',
      fix: 'Quebre os ciclos de referência; mantenha o aninhamento abaixo de 256; serialize apenas tipos suportados (AA, array, string, number, boolean).',
    },
    'parsejson-failed': {
      title: 'ParseJSON falhou',
      meaning: 'ParseJSON não conseguiu analisar a string de entrada (retorna invalid).',
      cause: 'Entrada vazia/em branco (por exemplo, um corpo de resposta HTTP vazio), JSON malformado, ou um argumento que não é string.',
      fix: 'Proteja contra entrada vazia/inválida antes de ParseJSON; verifique a origem (verifique primeiro o corpo/tamanho do HTTP).',
    },
    'file-write-failed': {
      title: 'Falha ao escrever arquivo',
      meaning: 'Não foi possível abrir um arquivo para escrita (WriteAsciiFile / roCreateFile).',
      cause: 'Escrever fora de um local gravável — apenas `tmp:/` e `cachefs:/` são graváveis (`pkg:/` é somente leitura) — ou um diretório ausente / disco cheio.',
      fix: 'Escreva apenas em `tmp:/` ou `cachefs:/`; certifique-se de que o caminho pai existe.',
    },
    'stack-overflow': {
      title: 'Estouro de pilha',
      meaning: 'A pilha de chamadas foi esgotada.',
      cause: 'Recursão ilimitada ou muito profunda (o Roku estoura após ~31 chamadas aninhadas).',
      fix: 'Adicione um caso base; converta a recursão profunda em iteração.',
    },
    'out-of-memory': {
      title: 'Memória esgotada',
      meaning: 'Uma alocação de memória falhou; o heap está esgotado.',
      cause: 'Estruturas de dados grandes, vazamentos, ou nodes/texturas retidos; construção de strings enormes em um laço.',
      fix: 'Libere referências, reduza o tamanho dos dados, reutilize nodes; processe trabalho com strings grandes em streaming/partes.',
    },
    'string-too-long': {
      title: 'String muito longa',
      meaning: 'Uma string excedeu o comprimento máximo.',
      cause: 'Concatenar entrada ilimitada.',
      fix: 'Limite ou divida o comprimento da string.',
    },
    'syntax-error': {
      title: 'Erro de sintaxe',
      meaning: 'O código-fonte não compilou.',
      cause: 'Erros de digitação, blocos desbalanceados, ou tokens inválidos.',
      fix: 'Corrija a sintaxe na linha/coluna indicada; compile localmente antes de fazer o sideload.',
    },
    'compile-error-generic': {
      title: 'Erro de compilação',
      meaning: 'O compilador rejeitou uma ou mais linhas antes de o app executar.',
      cause: 'Um erro de digitação, uma palavra-chave ausente, ou uma expressão malformada.',
      fix: 'Corrija cada `line N:` indicada no arquivo mencionado.',
    },
    'unterminated-block': {
      title: 'Bloco não terminado',
      meaning: 'Um bloco de controle (FOR/NEXT, IF/ENDIF, WHILE/ENDWHILE) está sem sua palavra-chave de fechamento.',
      cause: 'Um `end if` / `next` / `end while` ausente ou incompatível.',
      fix: 'Balanceie cada palavra-chave de abertura de bloco com seu fechamento correspondente.',
    },
    'xml-parse-error': {
      title: 'Erro de análise de componente XML',
      meaning: 'Um arquivo de componente XML do SceneGraph falhou na análise ou tem um defeito.',
      cause: 'Marcação malformada, uma tag inválida, ou uma referência inválida de field/interface/script no componente.',
      fix: 'Valide a marcação .xml e corrija a definição do componente.',
    },
    'no-manifest': {
      title: 'Sem manifest — pacote inválido',
      meaning: 'O zip de sideload não tem um manifest válido.',
      cause: 'O manifest está ausente ou não está na raiz do arquivo.',
      fix: 'Coloque um arquivo `manifest` válido na raiz do zip.',
    },
    'unused-variable': {
      title: 'Variável não utilizada',
      meaning: 'Uma variável declarada — frequentemente um parâmetro de função ou de manipulador de eventos — nunca é usada.',
      cause: 'Um parâmetro de manipulador (`msg`/`event`/`field`) ou variável local que o corpo da função nunca referencia.',
      fix: 'Remova-a se realmente não for usada; é inofensiva em produção. Parâmetros obrigatórios da assinatura de callback podem ser mantidos como estão.',
    },
    'brightscript-warning': {
      title: 'Aviso do BrightScript',
      meaning: 'O compilador do BrightScript emitiu um aviso não fatal.',
      cause: 'Um problema de nível de lint (código não usado, um padrão obsoleto) que não interrompe a execução.',
      fix: 'Revise a função/arquivo mencionado — avisos são seguros para executar, mas frequentemente sinalizam código morto ou erros.',
    },
    'http-unsupported-protocol': {
      title: 'Protocolo não suportado (-1)',
      meaning: 'O esquema da URL não é suportado pela transferência.',
      cause: 'Uma URL malformada ou esquema errado.',
      fix: 'Use uma URL http(s):// suportada.',
    },
    'http-resolve-host': {
      title: 'Não foi possível resolver o host (-6)',
      meaning: 'A resolução DNS do host da requisição falhou.',
      cause: 'Um nome de host inválido, sem rede, ou uma queda de DNS.',
      fix: 'Verifique a URL/host e a conectividade de rede.',
    },
    'http-connect': {
      title: 'Não foi possível conectar (-7)',
      meaning: 'A conexão TCP com o host/proxy falhou.',
      cause: 'Servidor fora do ar, porta errada, ou um firewall.',
      fix: 'Verifique a disponibilidade do endpoint/porta.',
    },
    'http-timeout': {
      title: 'Tempo limite da requisição HTTP esgotado (-28)',
      meaning: 'A requisição excedeu seu tempo limite.',
      cause: 'Um servidor lento ou inacessível, ou um tempo limite muito pequeno.',
      fix: 'Aumente o tempo limite; tente novamente; verifique o servidor.',
    },
    'http-ssl-peer': {
      title: 'Falha na verificação do peer SSL (-51)',
      meaning: 'O certificado TLS do servidor não foi validado.',
      cause: 'Um certificado expirado, autoassinado, ou incompatível.',
      fix: 'Corrija a cadeia de certificados; desabilite EnablePeerVerification(false) apenas para testes.',
    },
    'http-ca-cert': {
      title: 'Arquivo de certificado CA inválido/ausente (-77)',
      meaning: 'O bundle de CA não pôde ser carregado.',
      cause: 'Um caminho de SetCertificatesFile ausente ou incorreto.',
      fix: 'Defina `common:/certs/ca-bundle.crt` e chame InitClientCertificates().',
    },
    'deploy-update-check-required': {
      title: 'O dispositivo precisa verificar atualizações',
      meaning: 'O dispositivo recusa conexões até verificar uma atualização do sistema.',
      cause: 'Verificação de atualização de firmware do Roku pendente.',
      fix: 'No dispositivo: Settings → System → System update → Check now.',
    },
    'deploy-unauthorized': {
      title: 'Não autorizado (senha de dev incorreta)',
      meaning: 'O servidor de dev rejeitou as credenciais.',
      cause: 'Uma senha de desenvolvedor errada, ou o modo desenvolvedor está desativado.',
      fix: 'Defina a senha correta; ative o modo desenvolvedor no dispositivo.',
    },
    'deploy-connection-reset': {
      title: 'Conexão redefinida durante o deploy',
      meaning: 'O dispositivo derrubou o socket no meio do deploy.',
      cause: 'O dispositivo está ocupado ou precisa de uma atualização, ou uma queda de rede.',
      fix: 'Tente novamente; verifique atualizações; verifique a rede.',
    },
    'stop-statement': {
      title: 'Instrução STOP atingida',
      meaning: 'A execução pausou porque uma instrução `stop` levou o app para o Micro Debugger.',
      cause: 'Uma instrução de depuração `stop` esquecida no código.',
      fix: 'Remova `stop` antes do lançamento; use `continue`/`step` para retomar.',
    },
    'cant-continue': {
      title: 'Não é possível continuar',
      meaning: 'O depurador não pode retomar — a thread morreu em um erro fatal.',
      cause: 'Um erro de execução irrecuperável, ou a thread foi encerrada.',
      fix: 'Reinicie o canal e corrija a linha que trava (veja o backtrace acima).',
    },
    'console-in-use': {
      title: 'Conexão do console já em uso',
      meaning: 'A porta de depuração telnet (8085) já está sendo usada por outro cliente.',
      cause: 'Uma segunda sessão de depurador/telnet está aberta com o dispositivo.',
      fix: 'Feche outras sessões telnet/VS Code com o dispositivo.',
    },
    'app-crash-exit': {
      title: 'O canal foi encerrado por um travamento do BrightScript',
      meaning: 'O processo do canal terminou porque uma thread do BrightScript travou (um erro de execução não capturado).',
      cause: 'Um erro de execução não capturado em uma thread sem manipulador.',
      fix: 'Veja o travamento + backtrace no Console Monitor; proteja a chamada com falha usando try/catch ou corrija a linha com falha.',
    },
  },

  // Valores de categoria distintos do catálogo (BrsErrorCategory). A chave é a string de categoria em inglês.
  errorCategories: {
    'Type/Runtime': 'Tipo/Execução',
    'SceneGraph/Component': 'SceneGraph/Componente',
    'Threading/Rendezvous': 'Threads/Rendezvous',
    'JSON': 'JSON',
    'Memory': 'Memória',
    'Syntax/Compile': 'Sintaxe/Compilação',
    'Network/HTTP': 'Rede/HTTP',
    'Deploy': 'Deploy',
    'Debugger': 'Depurador',
    'Other': 'Outros',
  },
};

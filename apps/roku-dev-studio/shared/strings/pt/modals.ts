/**
 * pt-BR (Brazilian Portuguese) translation of shared/strings/modals.ts.
 * UI strings for global modals: the auto-update notification banner + Release
 * Notes modal (renderer/components/modals/update-notification.ts) and the
 * welcome-screen feature detail modals (welcome-feature-modal.ts).
 *
 * Parametrized strings are functions returning the composed text — the standard
 * way to keep interpolation translatable without a runtime format library.
 */
export const modals = {
  // Release Notes modal
  releaseNotes: 'Notas de versão',
  versionedReleaseNotes: (title: string): string => `${title} · Notas de versão`,
  openReleasePage: 'Abrir página da versão',
  loadingReleaseNotes: 'Carregando notas de versão…',
  noReleaseNotes: 'Nenhuma nota de versão fornecida para esta versão.',
  couldNotLoadReleaseNotes: 'Não foi possível carregar as notas de versão agora.',
  latestRelease: 'Versão mais recente',
  unknownError: 'Erro desconhecido',

  // Update banner — update available
  updateAvailableTitle: (version?: string): string =>
    `Roku Dev Studio ${version ? `v${version}` : 'Atualização'} disponível`,
  newVersionReady: 'Uma nova versão está pronta para baixar.',
  dismissUpdateNotification: 'Dispensar notificação de atualização',
  later: 'Depois',
  download: 'Baixar',

  // Update banner — downloading
  downloadingUpdate: 'Baixando atualização…',
  pleaseWaitDownloading: 'Aguarde enquanto a atualização é baixada.',

  // Update banner — ready to install
  updateReadyTitle: (version?: string): string =>
    `Roku Dev Studio ${version ? `v${version}` : 'Atualização'} pronta`,
  installedOnRestart: 'Será instalada ao reiniciar.',
  restartAndInstall: 'Reiniciar e instalar',

  // Update banner — manual download / error
  newUpdateAvailable: 'Nova atualização disponível',
  pleaseDownloadLatest: 'Baixe a versão mais recente para atualizar.',
  dismiss: 'Dispensar',
  updateError: 'Erro de atualização',
  updateCheckFailed: 'A verificação de atualização falhou.',

  // "Check for Updates" — no update found toast
  upToDate: (version?: string): string => `Você está atualizado${version ? ` (v${version})` : ''}.`,

  // Welcome-screen feature detail modals — longer blurb + capability bullets per tile.
  // (Keyed by the feature title so the component can look each up by the tile's live title.)
  features: {
    deviceDiscovery: {
      blurb:
        'O Roku Dev Studio verifica continuamente sua rede local com SSDP para que cada Roku na mesma sub-rede apareça automaticamente — sem precisar digitar IP.',
      points: [
        'Detecta automaticamente modelos, nomes e endereços IP de Roku',
        'Indica quais dispositivos têm o modo de desenvolvedor ativado',
        'Atualiza conforme os dispositivos entram ou saem da rede',
        'Um clique para conectar e começar a trabalhar',
      ],
    },
    appsDeepLinking: {
      blurb:
        'Navegue por todos os canais instalados no Roku conectado, inicie qualquer um deles instantaneamente e teste Deep-Links com parâmetros personalizados de conteúdo e tipo de mídia.',
      points: [
        'Grade de apps instalados (mais entradas de TV em Roku TVs)',
        'Inicie pela grade ou pelo ID do app',
        'Deep-link com contentId / mediaType para testar o lançamento de conteúdo',
        'Copie uma lista bruta de ID + versão de tudo o que está instalado',
      ],
    },
    devApp: {
      blurb:
        'Faça sideload, controle e inspecione seu canal de desenvolvimento de ponta a ponta — do upload de um zip a capturas de tela ao vivo do que está na tela.',
      points: [
        'Faça sideload de um canal de desenvolvimento .zip com sua senha de desenvolvedor',
        'Inicie ou exclua o app carregado por sideload',
        'Capture telas sob demanda ou automaticamente',
        'Copie, baixe ou limpe as imagens capturadas',
      ],
    },
    appConnector: {
      blurb:
        'Chame funções BrightScript no seu canal carregado por sideload remotamente e veja seus valores de retorno — execute caminhos de código sem tocar no controle remoto.',
      points: [
        'Invoque funções exportadas pelo nome com argumentos',
        'Inspecione os valores retornados diretamente na interface',
        'Executa no canal de desenvolvimento ao vivo',
      ],
    },
    fiddle: {
      blurb:
        'Um rascunho para BrightScript: escreva trechos em um editor Monaco completo e execute-os em um dispositivo conectado com lint ao vivo.',
      points: [
        'Editor Monaco com destaque de sintaxe',
        'Feedback de lint ao vivo enquanto você digita',
        'Execução em um clique no Roku conectado',
        'Abre em sua própria janela dedicada',
      ],
    },
    mcpServer: {
      blurb:
        'Exponha o Roku Dev Studio a agentes de IA pelo Model Context Protocol, para que assistentes possam controlar seu dispositivo dentro do seu ciclo de desenvolvimento.',
      points: [
        'Inicie apps, pressione teclas e capture telas com ferramentas MCP',
        'Consulte o estado do dispositivo programaticamente',
        'Traga agentes de IA para o seu fluxo de teste e depuração',
      ],
    },
    deviceRemote: {
      blurb:
        'Um controle remoto Roku completo na tela — todos os botões do controle físico, além de controle por teclado e entrada de texto.',
      points: [
        'D-pad, OK, Voltar, Início, Opções e Repetição',
        'Transporte de mídia: reproduzir/pausar, retroceder, avançar',
        'Volume, mudo e liga/desliga',
        'Digite texto diretamente nos campos do dispositivo',
      ],
    },
    query: {
      blurb:
        'Leia o estado ao vivo do Roku via ECP (External Control Protocol) — informações do dispositivo, status do reprodutor de mídia, apps instalados e o registro.',
      points: [
        'Informações do dispositivo: modelo, versão e rede',
        'App ativo e estado de reprodução do reprodutor de mídia',
        'Lista de apps instalados',
        'Conteúdo do registro',
      ],
    },
    console: {
      blurb:
        'Transmita a saída de depuração BrightScript do Roku ao vivo via Telnet, com filtragem e busca para mostrar exatamente o que importa.',
      points: [
        'Fluxo de log Telnet ao vivo',
        'Filtro e busca de texto completo',
        'Clique em URLs ou JSON para inspecioná-los em um modal',
        'Salve o log em um arquivo',
      ],
    },
    actionScripts: {
      blurb:
        'Automatize fluxos repetíveis do dispositivo encadeando pressionamentos de tecla, lançamentos de apps e chamadas RALE em um único script executável.',
      points: [
        'Sequencie pressionamentos de tecla, lançamentos e esperas',
        'Inclua chamadas RALE no fluxo',
        'Reexecute fluxos para testes de regressão',
      ],
    },
    networkInspector: {
      blurb:
        'Capture e inspecione o tráfego HTTP/HTTPS do Dev App por meio de um proxy MITM integrado — como a aba de rede de um navegador para o seu canal.',
      points: [
        'Veja cada requisição e resposta que o canal faz',
        'Inspecione cabeçalhos, corpos e tempos',
        'Descriptografe HTTPS pelo proxy MITM',
        'Agrupe por host ou veja sessões via proxy',
      ],
    },
    remoteLocations: {
      blurb:
        'Conecte-se a dispositivos Roku que não estão na sua rede local roteando por servidores de retransmissão.',
      points: [
        'Alcance dispositivos em qualquer lugar via um servidor de retransmissão',
        'Gerencie várias localizações remotas',
        'As mesmas ferramentas dos dispositivos locais',
      ],
    },
  },

  // ── Global modal fragments (renderer/components/modals/fragments/*.html) ──
  // One sub-group per fragment. Only elements whose visible text is a single
  // text node (pure text, icon + label, or a pure-text child span) are keyed —
  // applyI18n's mixed-content path replaces just the first text node, so prose
  // with inline <strong>/<code>/<em>/<a>/kbd markup is intentionally NOT keyed
  // and keeps its inline English. Generic buttons reuse common.* (cancel, save,
  // add, clear, close).

  addLocation: {
    title: '🌐 Adicionar localização remota',
    intro:
      'Conecte-se a dispositivos Roku em uma localização remota via o Roku Relay Server em execução em um Mac Mini ou outro computador.',
    nameLabel: 'Nome da localização',
    namePlaceholder: 'ex.: Laboratório do escritório, Estúdio B',
    nameHint: 'Um nome amigável para identificar esta localização',
    hostLabel: 'Endereço do servidor',
    hostPlaceholder: '192.168.1.50 ou mac-mini.local',
    hostHint: 'Endereço IP ou nome de host do Relay Server',
    portLabel: 'Porta',
    portHint: 'A porta padrão é 4951',
    addBtn: 'Adicionar localização',
  },

  actionScriptsImport: {
    title: 'Importar Action Script',
    uploadJsonLabel: 'Enviar JSON',
    chooseFileBtn: 'Escolher arquivo',
    savedScriptLabel: 'Scripts salvos',
    savedSelectPlaceholder: 'Selecione um Action Script salvo',
    savedSelectEmpty: 'Nenhum script salvo',
    pasteJsonLabel: 'Colar ou editar JSON',
    outputFolderLabel: 'Pasta de saída',
    noFolderSelected: 'Nenhuma pasta selecionada',
    chooseFolderBtn: 'Escolher pasta',
    outputWarning:
      'Se nenhuma pasta for selecionada, os artefatos (por exemplo, capturas de tela) não serão salvos quando você executar o script.',
    devPasswordRequiredMsg: 'Este script requer uma senha de desenvolvedor. Digite-a abaixo.',
    devPasswordLabel: 'Senha de desenvolvedor',
    devPasswordPlaceholder: 'Digite a senha de desenvolvedor para etapas de captura de tela / sideload',
    rememberPasswordTitle: 'Salvar a senha deste dispositivo (igual ao armazenamento de senha do Dev App)',
    rememberPasswordLabel: 'Lembrar a senha deste dispositivo',
    devPasswordHintHtml:
      'Obrigatório quando o script tem etapas de captura de tela ou sideload e não inclui um campo <code>devPassword</code>.',
    validateImportBtn: 'Validar e importar',
  },

  deeplinkDeleteMediaType: {
    title: 'Excluir tipo de mídia',
    confirmHint: 'Excluir o tipo de mídia e estes Deep-Links salvos?',
    deleteAllBtn: 'Excluir tudo',
  },

  deeplinkMediaTypes: {
    title: 'Gerenciar tipos de mídia',
    hint: 'Tipos de mídia integrados estão sempre disponíveis. Entradas personalizadas são salvas globalmente e aparecem em todas as abas de dispositivo.',
    builtinTitle: 'Integrados',
    builtinMovie: 'Filme',
    builtinSeries: 'Série',
    builtinEpisode: 'Episódio',
    builtinLive: 'Ao vivo',
    customTitle: 'Personalizado',
    addTitle: 'Adicionar tipo de mídia',
    displayNameLabel: 'Nome de exibição',
    displayNamePlaceholder: 'ex.: Curta-metragem',
    ecpValueLabel: 'Valor ECP',
    ecpValuePlaceholder: 'ex.: short-film',
  },

  deeplinkSavePreset: {
    title: 'Salvar Deep-Link',
    hint: 'Dê um nome a este Deep-Link para que você possa selecioná-lo na lista de salvos em qualquer dispositivo.',
    nameLabel: 'Nome',
    namePlaceholder: 'ex.: Netflix · Episódio 12',
  },

  devMode: {
    title: 'Ativar o modo de desenvolvedor no Roku',
    whatIsHeading: 'O que é o modo de desenvolvedor?',
    whatIsBody:
      'O modo de desenvolvedor permite que você faça sideload e teste seus próprios canais Roku diretamente no seu dispositivo. É gratuito para ativar e dá acesso a ferramentas de desenvolvimento poderosas.',
    stepsHeading: 'Etapas para ativar o modo de desenvolvedor',
    pressSequenceHtml:
      'No seu controle remoto Roku, pressione: <span class="help-kbd">Início</span> <span class="help-kbd">Início</span> <span class="help-kbd">Início</span> <span class="help-kbd">Cima</span> <span class="help-kbd">Cima</span> <span class="help-kbd">Direita</span> <span class="help-kbd">Esquerda</span> <span class="help-kbd">Direita</span> <span class="help-kbd">Esquerda</span> <span class="help-kbd">Direita</span>',
    step2: 'Uma caixa de diálogo de configurações de desenvolvedor aparecerá na sua TV',
    step3Html: 'Selecione <strong>"Ativar instalador e reiniciar"</strong>',
    step4: 'Aceite o Contrato de Licença do SDK do Desenvolvedor',
    step5Html: 'Defina uma <strong>Senha do servidor web</strong> (você precisará dela para o sideload)',
    step6: 'Seu Roku reiniciará com o modo de desenvolvedor ativado',
    afterHeading: 'Após ativar',
    afterIntro: 'Depois que o modo de desenvolvedor estiver ativado:',
    afterBadgeHtml:
      'Seu dispositivo exibirá um selo <span class="dev-badge enabled" style="font-size: 11px;"><span class="icon icon-xs"><svg><use href="#icon-wrench"/></svg></span> Dev</span> na lista de dispositivos',
    afterSideloadHtml: 'Você pode fazer sideload de pacotes de canal .zip pela aba <strong>Dev App</strong>',
    afterAppConnectorHtml: 'Use o <strong>App Connector</strong> para se comunicar com o código do seu canal',
    afterQueryHtml: 'Acesse consultas ECP adicionais na aba <strong>Consulta</strong>',
    moreHeading: 'Mais informações',
    moreBody: 'Para documentação detalhada, acesse a documentação oficial de desenvolvedor da Roku:',
  },

  ecpMode: {
    title: 'Controle por apps móveis no Roku',
    whyHeading: 'Por que isso é necessário?',
    whyBodyHtml:
      'A funcionalidade de controle remoto (teclas, apps, Controle rápido, Enviar texto) usa o External Control Protocol (ECP) do Roku. A configuração do dispositivo <strong>Controle por apps móveis → Acesso à rede</strong> pode ser definida em um de quatro modos:',
    modeDisabledHtml: '<strong>Desativado</strong> – O controle por apps móveis está desligado.',
    modeLimitedHtml:
      '<strong>Limitado</strong> – Apenas entrada de texto, início de apps e consulta do app ativo; ativado em endereços de rede privada.',
    modePermissiveHtml:
      '<strong>Permissivo</strong> – Controle completo; aceita comandos apenas da rede privada ou da mesma sub-rede.',
    modeEnabledHtml: '<strong>Ativado</strong> – Controle completo; ativado em endereços de rede privada.',
    howHeading: 'Como alterar a configuração',
    step1Html: 'No seu dispositivo Roku, vá em <strong>Configurações</strong> → <strong>Sistema</strong>',
    step2Html: 'Abra <strong>Configurações avançadas do sistema</strong>',
    step3Html: 'Selecione <strong>Controle por apps móveis</strong>',
    step4Html: 'Selecione <strong>Acesso à rede</strong>',
    step5Html:
      'Escolha <strong>Limitado</strong>, <strong>Permissivo</strong> ou <strong>Ativado</strong> (este aplicativo se adapta ao modo)',
    afterHeading: 'Após alterar',
    afterBodyHtml:
      'Com <strong>Limitado</strong>, Enviar texto, início de apps e consulta de apps funcionam; as teclas completas do controle podem não funcionar. Com <strong>Permissivo</strong> ou <strong>Ativado</strong>, o controle remoto completo funciona. Para o Permissivo, verifique se este computador está na mesma sub-rede que o Roku caso os comandos falhem. Não é necessário reiniciar após alterar a configuração.',
  },

  keyboardRemoteHelp: {
    title: 'Controle por teclado',
    introHtml:
      'Os atalhos se aplicam apenas enquanto esta aba de dispositivo está na aba <strong>Remoto</strong> ou na aba <strong>Dev App</strong>.',
    tableCaption: 'Atalhos mapeados para o controle remoto Roku',
    colKey: 'Tecla',
    colAction: 'Ação do controle remoto',
    actionNavigate: 'Navegar (Cima, Baixo, Esquerda, Direita)',
    actionSelect: 'Selecionar / OK',
    actionBack: 'Voltar',
    actionHome: 'Início',
    actionPlayPause: 'Reproduzir / Pausar',
    actionRewind: 'Retroceder',
    actionForward: 'Avançar',
    actionOptions: 'Opções (Info)',
    actionReplay: 'Repetição instantânea',
    actionVolumeUp: 'Aumentar volume',
    actionVolumeDown: 'Diminuir volume',
    actionMute: 'Mudo',
    actionPower: 'Liga/Desliga',
    footnote:
      'Desative o controle por teclado nas Configurações se você não quiser que as teclas de seta e outras teclas mapeadas enviem pressionamentos ao Roku.',
  },

  secretScreens: {
    title: 'Telas secretas do Roku',
    introHtml: `
            Dispositivos Roku têm menus de diagnóstico e de desenvolvedor integrados, acessíveis por sequências de botões do controle remoto.
            Na tela <strong>Início</strong> do Roku, pressione os botões mostrados em cada linha usando um
            <strong>controle remoto físico</strong> (controle IR ou de voz).
          `,
    ecpLimitationTitle: 'Limitação do ECP',
    ecpLimitationBodyHtml: `
              O Roku não interpreta de forma confiável todas as sequências de telas secretas enviadas via ECP. Se uma
              sequência não abrir via <strong>Executar sequência</strong>, use o <strong>controle remoto físico</strong>.
            `,
    sectionTitle: 'Telas secretas',
  },

  integrationGuide: {
    title: 'Guia de integração',
    whatIsHeading: 'O que é o TrackerTask?',
    whatIsBodyHtml: `
            <strong>TrackerTask</strong> é um componente BrightScript criado originalmente para o <strong>RALE (Roku Advanced
              Layout Editor)</strong> -
            a ferramenta oficial de desenvolvedor da Roku para inspecionar e depurar aplicativos SceneGraph em tempo real.
          `,
    trackerTaskEnabling:
      'O TrackerTask estabelece uma conexão de socket entre o seu app Roku e ferramentas externas, permitindo:',
    enablingPoint1: 'Inspeção e modificação de nós em tempo real',
    enablingPoint2: 'Visualização ao vivo dos limites de elementos de UI',
    enablingPoint3: 'Gerenciamento do registro',
    enablingPoint4: 'Registro de log e depuração',
    extendsBody:
      'O App Connector estende essa funcionalidade com duas funções personalizadas que permitem expor e executar as funções BrightScript personalizadas do seu app a partir desta ferramenta de desktop.',
    customFunctionsHeading: 'Funções personalizadas para o App Connector',
    customFunctionsBody:
      'Duas funções foram adicionadas ao TrackerTask para habilitar a funcionalidade do App Connector:',
    implementingHeading: 'Implementando na sua Scene',
    implementingBodyHtml: `
            O <strong>MainScene.xml</strong> do seu app deve declarar duas funções de interface que o TrackerTask irá
            chamar:
          `,
    getExternalHeading: 'Implementação de GetExternalControlFunctions',
    getExternalBodyHtml: `
            Esta função deve retornar um <strong>roArray</strong> de arrays associativos, onde cada item descreve uma
            função:
          `,
    supportedParamsBodyHtml: `
              <strong>Boolean</strong> · <strong>Integer</strong> · <strong>LongInteger</strong> ·
              <strong>Float</strong> ·
              <strong>Double</strong> · <strong>String</strong> · <strong>roAssociativeArray</strong> ·
              <strong>roArray</strong> · <strong>roList</strong>
            `,
    supportedParamsTitle: '📝 Tipos de parâmetro suportados',
    executeFunctionHeading: 'Implementação de ExecuteFunction',
    executeFunctionBody:
      'Esta função recebe o nome da função e o array de parâmetros e, em seguida, encaminha para o handler apropriado:',
    setupHeading: 'Configuração do TrackerTask',
    setupBody: 'Adicione o componente TrackerTask ao seu projeto e crie uma instância no seu MainScene:',
    setupPlaceHtml: `
            Coloque o arquivo <code>TrackerTask.xml</code> no diretório <code>components/</code> do seu app.
          `,
    saveBtn: 'Salvar TrackerTask.xml',
    copyBtn: 'Copiar informações de integração',
  },

  helpModal: {
    title: 'Ajuda e guia do usuário',
    navAriaLabel: 'Seções de ajuda',
    navDeviceDiscovery: 'Descoberta de dispositivos',
    navRemoteControl: 'Controle remoto',
    navApps: 'Apps',
    navQuery: 'Consulta',
    navDevApp: 'Dev App',
    navConsole: 'Console',
    navAppConnector: 'App Connector',
    navActionScripts: 'Action Scripts',
    navDevicePerformance: 'Desempenho do dispositivo',
    navNetworkInspector: 'Inspetor de rede',
    navAiAgents: 'Agentes de IA (MCP)',
    navFiddle: 'BrightScript Fiddle',
    navLogViewer: 'Visualizador de arquivos de log',
    navSecretScreens: 'Telas secretas',
    navSettings: 'Configurações',
    navRemoteLocations: 'Localizações remotas',
    navSideloadRelay: 'Sideload Relay',
    navTips: 'Dicas',

    deviceDiscoveryHeading: 'Descoberta de dispositivos',
    deviceDiscoveryScanHtml: `Clique em <strong>Verificar</strong> para descobrir automaticamente dispositivos Roku na sua rede. Dispositivos com o modo de desenvolvedor ativado exibirão um selo verde "Dev".`,
    deviceDiscoveryNoScanHtml: `<strong>A verificação não encontra nada?</strong> O multicast SSDP (porta UDP 1900) pode estar bloqueado por VPN, Wi‑Fi corporativo ou regras de firewall — tente a Conexão manual com o IP do dispositivo. O PC e o Roku devem estar na mesma rede acessível.`,
    deviceDiscoveryManual:
      'Você também pode conectar manualmente inserindo um endereço IP na seção "Conexão manual" na parte inferior da barra lateral.',

    remoteControlHeading: 'Controle remoto',
    remoteControlIntroHtml: `Use o controle remoto virtual para controlar seu Roku. Atalhos de teclado opcionais ficam disponíveis quando você ativa <strong>Configurações → Geral → Controle remoto do Roku - Usar o teclado </strong> (desativado por padrão). Eles se aplicam na aba <strong>Controle remoto</strong> (sozinha ou no layout em quadrante de desempenho do dispositivo) ou na aba <strong>Dev App</strong>, apenas para a aba de dispositivo que você tem aberta — não em outras seções, campos de texto ou modais.`,
    remoteControlTabHtml: `Na aba <strong>Controle remoto</strong> ou <strong>Dev App</strong>, pressione <span class="help-kbd">Tab</span> a partir dos controles remotos (não das abas de seção ou de outro campo de texto) para saltar para o campo <strong>Enviar texto</strong>. <span class="help-kbd">Enter</span> envia a partir desse campo.`,
    remoteControlMediaHtml: `Os controles de mídia (Retroceder, Reproduzir/Pausar, Avançar) e os botões de volume também estão disponíveis no controle remoto virtual. Use <strong>Enviar texto</strong> na parte inferior para digitar texto diretamente no campo de texto ativo do dispositivo.`,
    scNavigation: 'Navegação',
    scForward: 'Avançar',
    scSelect: 'Selecionar / OK',
    scRewind: 'Retroceder',
    scBack: 'Voltar',
    scReplay: 'Repetição instantânea',
    scHome: 'Início',
    scVolume: 'Aumentar / diminuir volume',
    scPlayPause: 'Reproduzir / Pausar',
    scMute: 'Mudo',
    scOptions: 'Menu de opções',
    scPower: 'Liga/Desliga',

    appsHeading: 'Apps',
    appsListHtml: `
            <li><strong>Lançamento personalizado</strong> - Inicie qualquer app pelo ID, incluindo entradas de TV (HDMI 1-4)</li>
            <li><strong>Deep Link</strong> - Inicie apps com conteúdo específico usando deep linking (App ID, Content ID, Media Type)</li>
            <li><strong>Lista bruta de apps</strong> - Veja a lista XML bruta de todos os apps instalados</li>
          `,
    appsBody:
      'Veja todos os apps instalados no seu dispositivo Roku. Clique em qualquer app para iniciá-lo. Use a busca para filtrar apps por nome.',

    queryHeading: 'Consulta',
    queryListHtml: `
            <li><strong>Consultas de dispositivo</strong> - Predefinições para consultas comuns como Informações do dispositivo, Apps, App ativo, Reprodutor de mídia e mais</li>
            <li><strong>Consultas de desenvolvedor</strong> - Consultas avançadas para dispositivos com modo de desenvolvedor (SG Nodes, Plugins, Frame Rate, Channel Perf, App State, Registry)</li>
            <li><strong>Consulta personalizada</strong> - Insira qualquer endpoint ECP personalizado</li>
          `,
    queryIntro: 'Consulte informações do dispositivo usando os endpoints ECP do Roku:',
    queryResults:
      'Os resultados são exibidos no painel de Resultados abaixo. Endpoints POST (rastreamento SGRendezvous, FW Beacons) também estão disponíveis.',

    devAppHeading: 'Dev App',
    devAppListHtml: `
            <li><strong>Autenticação</strong> - Insira e valide sua senha de desenvolvedor Roku. Ative "Lembrar" para mantê-la entre as sessões</li>
            <li><strong>Sideload</strong> - Instale pacotes de canal .zip ou .pkg</li>
            <li><strong>Remoto</strong> - Veja a página do instalador web do dispositivo para opções de desenvolvimento adicionais</li>
            <li><strong>Captura de tela</strong> - Capture telas do seu Dev App em execução</li>
            <li><strong>Excluir</strong> - Remova o canal carregado por sideload</li>
          `,
    devAppIntro: 'Para dispositivos com o modo de desenvolvedor ativado:',
    devAppNote: 'Você precisará da sua senha de desenvolvedor Roku (definida durante a configuração do modo de desenvolvedor).',

    consoleHeading: 'Console',
    consoleListHtml: `
            <li><strong>Conectar / Desconectar</strong> - Estabeleça ou feche a conexão telnet</li>
            <li><strong>Buscar / Filtrar</strong> - Pesquise nos logs com opções de diferenciação de maiúsculas, palavra inteira e correspondência por regex</li>
            <li><strong>Rolagem automática</strong> - Role automaticamente para a saída mais recente</li>
            <li><strong>Copiar / Salvar</strong> - Copie todos os logs para a área de transferência ou salve em um arquivo</li>
            <li><strong>Limpar</strong> - Limpe a saída do console</li>
          `,
    consoleIntro: 'Conecte-se ao console de depuração BrightScript via Telnet (porta 8085):',
    consoleNote:
      'Requer o modo de desenvolvedor ativado. Apenas uma conexão Telnet pode estar ativa por vez em cada dispositivo.',

    appConnectorHeading: 'App Connector',
    appConnectorListHtml: `
            <li><strong>Conectar</strong> - Estabelece uma conexão de socket com o seu Dev App em execução (porta padrão <code>49200</code>)</li>
            <li><strong>Executar função</strong> - Chame funções personalizadas expostas pelo <code>GetExternalControlFunctions</code> da sua scene</li>
            <li><strong>Resposta</strong> - Veja os valores de retorno e a saída de depuração</li>
            <li><strong>Atualizar nó</strong> - Após executar <em>Obter nó por ID</em>, o painel de resposta oferece um modal de atualização de nó onde você pode usar <code>selectNode</code>, <code>setField</code> ou <code>removeField</code> no nó correspondente</li>
            <li><strong>Comandos internos do RALE</strong> - A lista suspensa de funções também mostra comandos internos do RALE: <em>Obter nó por ID</em>, <em>Obter nó por SubType</em> e um editor de registro (<em>Obter todas as seções</em>, <em>Adicionar/Atualizar seção</em>, <em>Remover seção</em>, <em>Definir / Editar / Remover chave de seção</em>, <em>Limpar todas as seções</em>)</li>
          `,
    appConnectorFooterHtml: `Seu app Roku deve ter o TrackerTask integrado. Clique em <strong>Guia de integração</strong> na aba App Connector para obter os trechos de BrightScript e os tipos de parâmetro suportados. Use <strong>Salvar TrackerTask.xml</strong> no mesmo modal para colocar uma cópia pronta para uso no seu canal.`,
    appConnectorIntro:
      'Conecte-se a apps Roku que implementam o componente TrackerTask para comunicação bidirecional:',

    actionScriptsHeading: 'Action Scripts',
    actionScriptsBuilderHtml: `<strong>Construtor</strong> - Crie action scripts visualmente, ação por ação:`,
    actionScriptsBuilderListHtml: `
            <li><strong>Tipos de ação</strong> - Pressionar tecla, Enviar texto, Iniciar app, Consulta de dispositivo, POST, Sideload, Excluir sideload, Captura de tela, Função de app, Comando RALE, captura de Desempenho do dispositivo, Aguardar, Se</li>
            <li><strong>Variáveis (script v2)</strong> - Use uma etapa <em>Definir variável</em> ou <code>assignToVar</code> em Consulta de dispositivo / Função de app / Comando RALE para lembrar valores e, em seguida, referencie-os como <code>\${name}</code> em campos de etapas posteriores (texto, parâmetros, conteúdo de deep-link, etc.)</li>
            <li><strong>Se / Senão se / Senão (script v2)</strong> - Ramifique com base em condições originadas do estado de <code>media-player</code>, do app ativo, de um campo de nó RALE ou de uma variável armazenada; aninhe etapas <em>Se</em> para ramificações de várias etapas</li>
            <li><strong>Condições de espera</strong> - <em>Aguardar</em> pode ser um <code>delayMs</code> fixo ou aguardar até que uma condição se torne verdadeira: estado do <em>media-player</em> ou <em>campo de nó RALE</em> (consulte <code>getNodeById</code> e compare um campo com operadores como <code>equals</code>, <code>contains</code>, <code>matches</code>, <code>hasAnyValue</code>) com <code>timeoutMs</code> e <code>pollIntervalMs</code> opcionais</li>
            <li><strong>Etapa de desempenho do dispositivo</strong> - Capture os gráficos de <em>CPU</em>, <em>memória</em>, <em>objetos</em> ou <em>todos</em> para o dispositivo em que este script é executado; os PNGs capturados vão nos resultados da execução / exportação em PDF</li>
            <li><strong>Ajuda por etapa</strong> - O controle <em>?</em> em cada linha do construtor abre um modal de ajuda contextual para aquele tipo de ação</li>
            <li><strong>Gerenciamento de ações</strong> - Adicione, exclua, reordene (arrastar e soltar), copie e cole ações</li>
            <li><strong>Copiar / Colar</strong> - Copie uma ação com o controle de cópia em cada linha. Após copiar, use <strong>Colar etapa</strong> ao lado de qualquer linha <strong>Adicionar etapa</strong> para inserir naquela posição, ou <span class="help-kbd">Ctrl</span>+<span class="help-kbd">V</span> para anexar ao final do script</li>
            <li><strong>Importar</strong> - Carregue um script existente de um arquivo JSON</li>
            <li><strong>Desfazer / Refazer</strong> - <span class="help-kbd">Ctrl</span>+<span class="help-kbd">Z</span> para desfazer, <span class="help-kbd">Ctrl</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">Z</span> para refazer</li>
            <li><strong>Prévia do JSON</strong> - Prévia ao vivo do script gerado. Copie ou salve o script em um arquivo</li>
            <li><strong>Copiar para o Executor</strong> - Envie o script construído diretamente para o Executor para execução</li>
          `,
    actionScriptsExecutorHtml: `<strong>Executor</strong> - Importe, valide e execute action scripts:`,
    actionScriptsExecutorListHtml: `
            <li><strong>Importar</strong> - Envie um arquivo de script JSON ou cole o JSON do script e, em seguida, valide</li>
            <li><strong>Executar / Pausar / Parar</strong> - Controle a execução com as ações reproduzir, pausar e parar</li>
            <li><strong>Pular / Não pular</strong> - Alterne ações individuais para pular durante a execução</li>
            <li><strong>Reordenar</strong> - Arraste e solte para reordenar as ações antes de executar</li>
            <li><strong>Resultados</strong> - Veja resultados detalhados de cada ação, incluindo capturas de tela embutidas e gráficos de desempenho capturados</li>
            <li><strong>Copiar / Salvar resultados</strong> - Copie os resultados para a área de transferência ou salve como PDF (o PDF incorpora capturas de tela e cartões de gráfico)</li>
            <li><strong>Conectar ao Console</strong> - Opcionalmente, conecte-se automaticamente ao console de depuração durante as execuções</li>
          `,
    actionScriptsDevPasswordHtml: `<strong>Senha de desenvolvedor</strong> - Ações como Captura de tela, Sideload e Excluir sideload exigem uma senha de desenvolvedor. A senha é resolvida nesta ordem: <code>"password"</code> no nível da ação → <code>"devPassword"</code> no nível do script → senha da seção Autenticação do Dev App. Se nenhuma for encontrada, você será solicitado durante a validação.`,
    actionScriptsSaveFolderHtml: `<strong>Pasta de salvamento</strong> - A pasta de salvamento padrão fica em <strong>Configurações → Action Scripts → Pasta padrão</strong>. A cada execução, você pode escolher outra pasta. Os artefatos (capturas de tela, PNGs de gráficos de desempenho, PDFs exportados) vão para uma subpasta com carimbo de data/hora, criada apenas quando algo é de fato produzido.`,
    actionScriptsAiAgentsHtml: `<strong>Agentes de IA</strong> - Os Action Scripts que você cria no Construtor também podem ser criados por agentes de IA por meio do servidor MCP (veja a seção <em>Agentes de IA (MCP)</em> abaixo); o script do agente sempre vai para o Construtor para revisão humana antes de executar.`,
    actionScriptsIntro:
      'Automatize sequências de ações do dispositivo usando scripts baseados em JSON. Duas visualizações estão disponíveis:',

    devicePerformanceHeading: 'Desempenho do dispositivo (seção do controle remoto)',
    devicePerformanceIntroHtml: `Ative <strong>Mostrar desempenho do dispositivo</strong> na seção do controle remoto para expandir um quadrante com gráficos ao vivo:`,
    devicePerformanceListHtml: `
            <li>Gráficos de <strong>uso de CPU</strong>, <strong>memória do sistema</strong> e <strong>objetos BrightScript</strong> (contagem ou visualização de memória quando disponível)</li>
            <li>Os gráficos refletem o app em execução — para leituras representativas, o dispositivo deve estar com o <strong>modo de desenvolvedor</strong> ativado e seu <strong>canal de desenvolvedor carregado por sideload</strong> em primeiro plano</li>
            <li><strong>Configurações → Desempenho do dispositivo</strong> ajusta o intervalo de amostragem e a janela de histórico dos gráficos; ative <strong>Lembrar 'Mostrar desempenho do dispositivo'</strong> para restaurar o layout em quadrante por dispositivo entre as sessões</li>
            <li>Dentro dos Action Scripts, as etapas de <strong>Desempenho do dispositivo</strong> capturam cartões de gráfico nos resultados da execução (e na exportação em PDF)</li>
          `,

    networkInspectorHeading: 'Inspetor de rede',
    networkInspectorIntroHtml: `Inspecione o tráfego HTTP(S) que o seu canal de desenvolvedor faz. O Roku Dev Studio executa um <strong>proxy MITM</strong> local que descriptografa o HTTPS do canal de desenvolvedor roteado por ele, para que você possa ver os cabeçalhos e corpos completos de requisição/resposta.`,
    networkInspectorGettingStartedHtml: `<strong>Primeiros passos</strong>`,
    networkInspectorGettingStartedListHtml: `
            <li>Ative o <strong>proxy MITM</strong> em <strong>Configurações → Inspetor de rede</strong> e, em seguida, faça seu canal de desenvolvedor rotear as requisições pelo endereço de proxy mostrado — use <code>host:port</code> (ex.: <code>192.168.1.50:8888</code>). A forma como o canal aplica esse proxy depende do código de rede do seu app.</li>
            <li>A <strong>Captura de hotspot</strong> opcional registra metadados de SNI/DNS de todo o tráfego do dispositivo; ela precisa de acesso à captura de pacotes do SO (macOS BPF, Windows Npcap). Configurações → Inspetor de rede orienta a configuração por plataforma.</li>
          `,
    networkInspectorToolbarHtml: `<strong>Barra de ferramentas</strong> (canto superior direito do painel): <strong>Iniciar/Parar captura</strong>, <strong>Layout dos painéis</strong> (empilhado vs. requisição/resposta lado a lado) e <strong>Configurar regras de tráfego</strong>.`,
    networkInspectorToolbarListHtml: `
            <li><strong>Lista de sessões</strong> - Filtre com <code>host:</code>, <code>method:</code>, <code>status:</code>, <code>type:</code>, <code>kind:</code>, <code>path:</code> (separe os termos com vírgulas para OR); agrupe por host; alterne <em>Via proxy</em> para ocultar metadados apenas de hotspot. Atalhos de ir para o erro e rolar até o mais recente aparecem quando relevantes.</li>
            <li><strong>Inspecionar</strong> - Veja a visão geral de requisição / resposta, cabeçalhos e corpos (JSON / XML / bruto). <strong>Copie</strong> um corpo ou exporte a transação como <strong>cURL</strong> ou <strong>HAR</strong>.</li>
            <li><strong>Salvar .pcap</strong> - Exporte os pacotes capturados do dispositivo; <strong>Limpar</strong> esvazia a lista de sessões.</li>
          `,
    networkInspectorTrafficRulesHtml: `As <strong>Regras de tráfego</strong> (a engrenagem na barra de ferramentas) moldam o tráfego via proxy deste dispositivo; as alterações têm efeito imediato:`,
    networkInspectorTrafficRulesListHtml: `
            <li><strong>Bloquear todo o tráfego via proxy</strong> - Rejeite todas as requisições via proxy. Isso prevalece sobre as regras por host e a limitação do dispositivo.</li>
            <li><strong>Limitação do dispositivo</strong> - Limite a largura de banda e/ou adicione latência a todas as requisições via proxy. Escolha uma predefinição ou digite um valor personalizado (ex.: <code>3 Mbps</code>, <code>1500 kbps</code>).</li>
            <li><strong>Regras por host</strong> - Adicione um <strong>nome de host</strong> para atingir todas as requisições a esse host, ou um <strong>host + caminho</strong> (ex.: <code>api.example.com/v1/play</code>) para atingir apenas aquele caminho. Cada regra pode <em>Bloquear</em>, <em>Redefinir</em> a conexão (simular uma falha de rede), <em>Simular</em> uma resposta predefinida (status / Content-Type / atraso / corpo) e/ou limitar.</li>
            <li><strong>Curingas</strong> - Use <code>*</code> no host ou no caminho para corresponder a mais de um alvo. <code>*.example.com</code> abrange todos os subdomínios (ex.: ambientes lower <em>e</em> prod em uma regra), e <code>/v1/*/play</code> corresponde a qualquer caminho sob <code>/v1</code>. Um padrão sem <code>*</code> mantém o comportamento antigo (um host simples também corresponde aos seus subdomínios).</li>
            <li><strong>Editar uma regra</strong> - Clique no lápis de uma regra para alterar sua URL de interceptação no local (host ou host/caminho); pressione Enter para aplicar ou Escape para cancelar.</li>
            <li><strong>Reescrever</strong> - Ao contrário de Bloquear / Redefinir / Simular (que interrompem a requisição), as regras de reescrita deixam a requisição passar com as edições aplicadas. Adicione operações na <em>requisição</em> (redirecionar host — "map remote" de uma URL de prod para staging/localhost, definir caminho, adicionar/remover parâmetros de consulta ou cabeçalhos, localizar/substituir no corpo) e/ou na <em>resposta</em> (substituir status, adicionar/remover cabeçalhos, localizar/substituir no corpo — respostas gzip/br são decodificadas, editadas e reenviadas). O localizar/substituir no corpo suporta texto simples ou uma regex e se aplica apenas a corpos textuais.</li>
            <li><strong>Limites</strong> - Um host não pode ser mais rápido que o limite de largura de banda do dispositivo, e sua latência não pode cair abaixo do piso de latência do dispositivo.</li>
          `,
    networkInspectorLocalOnly: 'O Inspetor de rede está disponível para dispositivos conectados localmente.',

    aiAgentsHeading: 'Agentes de IA (MCP)',
    aiAgentsIntroHtml: `O Roku Dev Studio inclui um servidor <strong>MCP (Model Context Protocol)</strong> para que agentes de IA no Cursor, Claude Desktop ou VS Code possam controlar um dispositivo real por meio deste app:`,
    aiAgentsListHtml: `
            <li><strong>Configurações → Servidor MCP</strong> - Alterne um cliente para adicionar ou remover sua entrada MCP <code>roku-dev-studio</code>; as outras entradas na configuração MCP desse cliente não são alteradas</li>
            <li><strong>Duas superfícies</strong> - Operações diretas no dispositivo para ações pontuais (<code>keypress</code>, <code>launch_app</code>, <code>screenshot</code>, <code>app_function</code>, <code>rale_command</code>, telnet …) e <strong>Action Scripts</strong> para fluxos de várias etapas / condicionais que vão para o Construtor para revisão</li>
            <li><strong>Toasts</strong> - Ações destrutivas do agente (iniciar, sideload, excluir sideload, captura de tela, comandos RALE destrutivos) mostram um toast não bloqueante no app para que você sempre veja o que o agente fez</li>
            <li><strong>As senhas permanecem locais</strong> - Sideload / captura de tela / exclusão de sideload reutilizam a senha que o painel do dispositivo lembrou; o agente nunca precisa enviar uma</li>
          `,
    aiAgentsBridge:
      'A ponte inicia automaticamente quando o app está aberto e é encerrada ao sair. Se um agente informar que a ponte está offline, basta trazer este app para o primeiro plano.',

    fiddleHeading: 'BrightScript Fiddle',
    fiddleIntroHtml: `Abra em <strong>Arquivo → Abrir Fiddle</strong> (<span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">B</span>) ou pelo botão <em>Abrir Fiddle</em> na aba Consulta.`,
    fiddleListHtml: `
            <li><strong>Editor</strong> - Editor Monaco com destaque de BrightScript e lint ao vivo de <em>BrighterScript</em>; o botão Executar fica desativado enquanto houver erros</li>
            <li><strong>Executar</strong> - Envolve seu trecho em um canal SceneGraph mínimo, faz sideload dele no dispositivo selecionado e transmite o console de depuração BrightScript (8085) para o terminal da janela do Fiddle</li>
            <li><strong>Parar / fechar a janela</strong> - Remove o canal do Fiddle do dispositivo automaticamente</li>
          `,
    fiddleNote:
      'Requer um dispositivo com o modo de desenvolvedor ativado e uma senha de desenvolvedor conhecida (use a aba Dev App uma vez para lembrá-la, ou você será solicitado no Fiddle).',

    logViewerHeading: 'Visualizador de arquivos de log',
    logViewerBodyHtml: `<strong>Arquivo → Abrir arquivo de log</strong> (<span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">O</span>) abre um arquivo de console / log salvo em uma janela dedicada, com os mesmos recursos de busca / log estruturado / detecção de URL da aba Console ao vivo. Prático para revisar logs de uma sessão anterior ou de um colega de equipe.`,

    secretScreensHeading: 'Telas secretas',
    secretScreensBodyHtml: `O link <em>Telas secretas</em> (na seção do controle remoto e no rodapé da aba Consulta) abre um modal que lista as sequências de teclas padrão do Roku para configurações ocultas — <strong>Configurações de desenvolvedor</strong>, <strong>Tela secreta 1/2/3</strong>, <strong>Informações de Wi-Fi</strong>, <strong>Informações do canal</strong>, <strong>Reiniciar</strong>, etc. Clique em uma sequência para enviar os pressionamentos de tecla ao dispositivo conectado.`,

    settingsHeading: 'Configurações',
    settingsIntroHtml: `Abra com <span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">,</span> ou em <em>Roku Dev Studio → Configurações</em> (macOS) / <em>Arquivo → Configurações</em> (Windows / Linux). Cinco seções:`,
    settingsListHtml: `
            <li><strong>Geral</strong> - Modo de desenvolvedor, Modo de privacidade (mascarar IPs / seriais), Registro de depuração em arquivo, Controle remoto do Roku - Usar o teclado, Conectar automaticamente aos dispositivos, Ocultar a barra lateral automaticamente, Criptografar as senhas salvas (a linha de status mostra se o chaveiro do SO está realmente criptografando — em algumas configurações do Linux, não está)</li>
            <li><strong>Action Scripts</strong> - Pasta padrão para os artefatos de execução (capturas de tela, PDFs exportados)</li>
            <li><strong>Desempenho do dispositivo</strong> - Intervalo de amostragem do gráfico, janela de histórico do gráfico, Lembrar 'Mostrar desempenho do dispositivo' por dispositivo</li>
            <li><strong>Tempos &amp; rede</strong> - Tempos limite de conexão / consulta / telnet e outros ajustes de rede (com Restaurar padrões)</li>
            <li><strong>Servidor MCP</strong> - Alterne <code>roku-dev-studio</code> no(s) seu(s) cliente(s) de IA para que os agentes possam controlar o dispositivo por meio deste app</li>
          `,

    remoteLocationsHeading: 'Localizações remotas',
    remoteLocationsListHtml: `
            <li><strong>Configuração</strong> - Execute o Roku Relay Server em um Mac Mini na localização remota</li>
            <li><strong>Adicionar localização</strong> - Clique em "Adicionar" na seção Localizações remotas para configurar uma conexão</li>
            <li><strong>Endereço do servidor</strong> - Insira o endereço IP ou o nome de host do servidor de retransmissão</li>
            <li><strong>Porta padrão</strong> - O servidor de retransmissão é executado na porta <code>4951</code> por padrão</li>
          `,
    remoteLocationsServerHtml: `O servidor de retransmissão pode ser encontrado na pasta <code>remote-server</code>. Consulte o README para instruções de configuração (LaunchAgent no macOS, systemd no Linux, Agendador de Tarefas no Windows).`,
    remoteLocationsTroubleshootHtml: `<strong>O sideload ou a captura de tela falham via retransmissão, mas o ECP funciona?</strong> Atualize o host de retransmissão para a mesma versão do <code>roku-dev-studio-api</code> deste app. Verifique <code>GET /health</code> na retransmissão (campo <code>apiVersion</code>) e garanta que a porta <code>4951</code> esteja acessível através dos firewalls.`,
    remoteLocationsIntro: 'Controle dispositivos Roku em localizações remotas por meio de um Relay Server:',

    sideloadRelayHeading: 'Sideload Relay',
    sideloadRelayIntroHtml: `Faça sideload de um build para <strong>muitos dispositivos de uma vez</strong>. Quando a retransmissão está ativada, o Roku Dev Studio se anuncia como um Roku na sua rede: aponte seu IDE (VS Code BrightScript / roku-deploy / Eclipse) ou um navegador para esta máquina, faça o upload uma vez, e o RDS distribui o build — <em>instalar → iniciar → console</em> — para cada dispositivo de destino, local ou em uma localização remota.`,
    sideloadRelayEnableHtml: `<strong>Ative-a</strong> em <strong>Configurações → Sideload Relay</strong> (desativada por padrão). Dois pré-requisitos controlam a opção:`,
    sideloadRelayEnableListHtml: `
            <li><strong>Senha de desenvolvedor da retransmissão</strong> - A senha com que o seu IDE se autentica no RDS (usuário <code>rokudev</code>), exatamente como a senha de desenvolvedor de um Roku real. Ela é separada da senha de desenvolvedor de cada dispositivo de destino.</li>
            <li><strong>Configurar dispositivos</strong> - Abra o modal de configuração de dispositivos e ative pelo menos um dispositivo acessível e com o modo de desenvolvedor ativado. Ele lista dispositivos locais e remotos (de localização de retransmissão); ative os que devem receber cada build. Dispositivos sem uma senha de desenvolvedor salva mostram <strong>🔒 Definir senha</strong> para validar uma na interface. Dispositivos definidos anteriormente que ficam offline permanecem na lista (desativados) e reingressam automaticamente quando ficam acessíveis novamente.</li>
          `,
    sideloadRelayPointHtml: `<strong>Aponte seu IDE para o RDS.</strong> Com a retransmissão ativada, o RDS é detectável via SSDP como <em>"Roku Dev Studio Relay"</em>, ou você pode definir o host de build diretamente para o IP desta máquina. Em <em>Sideload</em> / <em>Debug: Launch</em>, o IDE faz upload para o RDS na porta <code>80</code> e o RDS cuida da distribuição. Uma página web de upload personalizada também é servida no endereço da retransmissão (<code>http://&lt;this-machine&gt;/</code>) para sideloads <code>.zip</code> por arrastar e soltar a partir de um navegador.`,
    sideloadRelayAutoConnectHtml: `<strong>Conexão automática.</strong> Quando um build chega com sucesso a um destino, o RDS abre esse dispositivo como uma aba conectada e anexa seu console de depuração automaticamente, para que você veja a saída de cada dispositivo sem cliques extras. O progresso da distribuição ao vivo também é transmitido como um console de status na porta telnet <code>8085</code>.`,
    sideloadRelaySourceApprovalHtml: `<strong>Aprovação de origem.</strong> Um sideload originado desta máquina prossegue automaticamente. Um sideload de uma máquina diferente retém o upload e mostra um prompt de permitir/negar no host do RDS (nega automaticamente após 30s); uploads de navegador de uma máquina remota exigem, além disso, fazer login com a senha de desenvolvedor da retransmissão.`,
    sideloadRelayFooterHtml: `Requer que os dispositivos de destino tenham o modo de desenvolvedor ativado. Consulte <strong>Localizações remotas</strong> acima para direcionar dispositivos em outro local por meio de um servidor de retransmissão.`,

    tipsHeading: 'Dicas',
    tipDeveloperModeHtml: `Ative o modo de desenvolvedor no seu Roku: vá para a tela inicial, pressione <span class="help-kbd">Home</span> 3x, <span class="help-kbd">↑</span> 2x, <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span>`,
    tipMacosHtml: `<strong>macOS:</strong> fechar a janela principal encerra o app (as sessões telnet e MCP são encerradas). Use <em>Roku Dev Studio → Sair</em> ou <span class="help-kbd">Cmd</span>+<span class="help-kbd">Q</span> — o app não permanece no dock sem janelas.`,
    tipWindowsLinuxHtml: `<strong>Windows / Linux:</strong> use o menu da barra de título (☰) para Configurações, Modo de privacidade e Sobre; os botões de minimizar/maximizar/fechar a janela ficam na borda direita da barra de título.`,
    tipMultipleDevices: 'Vários dispositivos podem ser conectados simultaneamente - cada um ganha sua própria aba',
    tipClickCard: 'Clique no cartão de um dispositivo conectado para alternar para a aba dele',
    tipRightClick: 'Clique com o botão direito nos cartões de dispositivo para copiar as informações do dispositivo',
    tipRemoteLocations: 'As localizações remotas permitem controlar dispositivos sem acesso físico',
  },
};

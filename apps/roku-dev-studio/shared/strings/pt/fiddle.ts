/**
 * pt-BR UI strings for the BrightScript Fiddle window
 * (renderer/components/fiddle/fiddle.ts).
 *
 * Parametrized strings are functions returning the composed text — the standard way
 * to keep interpolation translatable without a runtime format library. Same signatures
 * and ${...} placeholders as the English source; only the literal text is translated,
 * with pt-BR two-form plurals (n === 1 → singular, otherwise plural).
 */
export const fiddle = {
  // Device dropdown
  selectDevice: 'Selecione um dispositivo',
  noDevices: 'Nenhum dispositivo com Dev Mode habilitado encontrado',
  deviceFallbackName: 'Roku',
  remotePrefix: '[Remoto] ',

  // Diagnostics status chip (bottom of the editor)
  noIssues: 'Nenhum problema',
  diagWarnings: (warnCount: number): string => `${warnCount} Aviso${warnCount === 1 ? '' : 's'}`,
  diagErrors: (errCount: number, warnCount: number): string =>
    `${errCount} Erro${errCount === 1 ? '' : 's'}${warnCount ? `, ${warnCount} Aviso${warnCount === 1 ? '' : 's'}` : ''}`,

  // Password modal
  passwordRequired: 'A senha é obrigatória.',

  // Run / Stop status line
  selectDeviceFirst: 'Selecione um dispositivo primeiro.',
  deviceUnavailable: 'O dispositivo selecionado não está mais disponível.',
  runCancelledPassword: 'Execução cancelada — senha obrigatória.',
  running: 'Executando...',
  runFailed: 'Falha na execução.',
  runFailedWith: (msg: string): string => `Falha na execução: ${msg}`,
  sideloadWaiting: 'Sideload concluído — aguardando saída…',
  runningOnDevice: 'Executando no dispositivo…',
  runComplete: 'Execução concluída.',
  editorReset: 'Editor redefinido para o Snippet padrão.',
  uninstalling: 'Desinstalando...',
  channelRemoved: 'Canal BrightScript Fiddle removido.',
  stopFailed: 'Falha ao parar.',
  ready: 'Pronto.',

  // Reset-code confirm
  resetConfirm: 'Redefinir o editor para o Snippet padrão? As alterações não salvas serão perdidas.',

  // Editor bootstrap status
  loadingEditor: 'Carregando editor...',
  editorFailedToLoad: (msg: string): string => `Falha ao carregar o editor: ${msg}`,

  // Monaco command-palette / context-menu action
  runOnDevice: 'Executar no dispositivo',

  // Static fiddle.html shell — header, device picker, panes, status row
  heading: 'BrightScript Fiddle',
  subtitle: 'Execute um snippet BrightScript rápido em qualquer dispositivo conectado.',
  deviceLabel: 'Dispositivo',
  scanForDevices: 'Buscar dispositivos',
  runBtn: 'Executar',
  runBtnTitle: 'Executar (⌘/Ctrl+Enter)',
  stopBtn: 'Parar',
  stopBtnTitle: 'Desinstalar canal Fiddle',
  codeLabel: 'Código',
  resetSnippetTitle: 'Redefinir para o Snippet padrão',
  resetSnippetAria: 'Redefinir editor para o Snippet padrão',
  terminalLabel: 'Terminal',
  clearTerminal: 'Limpar Terminal',
  statusRowCaption: 'A execução substitui o canal atualmente carregado via sideload no dispositivo selecionado.',

  // Developer-password modal
  passwordModalTitle: 'Senha de desenvolvedor obrigatória',
  passwordModalHint:
    'O sideload requer a senha de desenvolvedor do dispositivo — aquela que você definiu ao habilitar o Developer Mode.',
  passwordLabel: 'Senha',
  passwordPlaceholder: 'Digite a senha de desenvolvedor',
  passwordModalHintMuted:
    'Esta senha é usada apenas nesta sessão. Para salvá-la para uso futuro, verifique o Developer Mode na janela principal.',
  passwordSubmitBtn: 'Salvar e executar',

  /**
   * Monaco editor's initial value + the target of "Reset to default Snippet".
   * The two leading `'` comment lines are user-facing guidance; the BrightScript
   * keywords/identifiers (`Sub`, `End Sub`, `print`, `userFiddle`, `init`) and the
   * example `print` output are code tokens kept verbatim. Composed via the same
   * newline join as the source so the editor value is byte-for-byte identical.
   */
  defaultSnippet: [
    "' `userFiddle` é o ponto de entrada que o Fiddle executa depois que o canal está na tela.",
    "' Coloque seu snippet aqui — você também pode definir subs/funções auxiliares abaixo e chamá-las a partir de userFiddle. NÃO defina um sub chamado `init` — esse identificador é reservado pela cena do Fiddle.",
    'Sub userFiddle()',
    '    print "Hello from Roku Dev Studio Fiddle"',
    'End Sub',
    ''
  ].join('\n'),

  // ── Main-process diagnostics + run/stop errors (main/ipc/bs-fiddle-handlers.ts) ──
  // Surfaced in the Fiddle UI (Monaco markers or the status line). Code literals
  // (`init`, `userFiddle`) are kept verbatim.
  lintReservedInit:
    'O nome `init` é reservado pela cena do Fiddle. Renomeie este sub para `userFiddle` — o Fiddle chamará `userFiddle()` automaticamente assim que a cena estiver na tela.',
  errWindowUnavailable: 'A janela do Fiddle não está mais disponível.',
  errDeviceDisconnected: 'O dispositivo selecionado não está mais conectado.',
  errNoPasswordProvided: 'Nenhuma senha de desenvolvedor fornecida.',
  errNoPasswordAvailable: 'Nenhuma senha de desenvolvedor disponível para este dispositivo.',
  errPackageFailed: (detail: string): string => `Falha ao empacotar o snippet: ${detail}`,
  errRemoteMissingServerUrl: 'O dispositivo remoto não tem a URL do servidor de relay — não é possível transmitir os logs de telnet.',
  errSideloadFailed: 'Falha no sideload',
  errDeviceNotFound: 'Dispositivo não encontrado.',
  errNotFiddleChannel:
    'O canal de desenvolvedor atualmente instalado não é um canal Fiddle — ele foi mantido para que seu próprio app não seja removido.',

  // humanizeRemoteUploadError prose (remote relay upload failures)
  errRemoteUnknown: 'Erro desconhecido do servidor de relay remoto.',
  errRemoteNetworkBlip:
    'Falha momentânea de rede entre o servidor de relay e o Roku (pipe quebrado). ' +
    'Isso geralmente se resolve ao tentar novamente — se continuar acontecendo, verifique se o ' +
    'host do relay consegue alcançar o dispositivo pela LAN e se o Roku não está ocupado.',
  errRemoteCurl: (detail: string): string => `Erro de curl do relay remoto: ${detail}`,
};

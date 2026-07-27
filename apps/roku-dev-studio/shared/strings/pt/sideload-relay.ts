/**
 * UI strings for the Sideload Relay settings section + device-setup modal
 * (renderer/components/settings/sideload-relay-section.ts).
 *
 * Parametrized strings are functions returning the composed text — the standard way
 * to keep interpolation translatable without a runtime format library. Plain-string
 * leaves are also usable from static HTML via `data-i18n`.
 */
export const sideloadRelay = {
  // Enable gate
  gateTitle: 'Para ativar o Sideload Relay:',
  gateNeedPassword: 'Defina uma Senha de desenvolvedor do Relay para que sua IDE possa autenticar com o RDS.',
  gateNeedDevice: 'Selecione ao menos um dispositivo acessível — abra “Configurar dispositivos” e ative um dispositivo que esteja online.',

  // Targeted Devices summary row
  targetSummaryEmpty: 'Nenhum dispositivo selecionado ainda. Clique em “Configurar dispositivos” para escolher quais Rokus recebem cada build.',
  targetSummaryChecking: (n: number): string =>
    `${n} dispositivo${n === 1 ? '' : 's'} selecionado${n === 1 ? '' : 's'} · verificando acessibilidade…`,
  targetSummaryReachable: (reachable: number): string =>
    `${reachable} ativado${reachable === 1 ? '' : 's'} e acessíve${reachable === 1 ? 'l' : 'is'}`,
  targetSummaryOfflineSuffix: (offline: number): string =>
    ` · ${offline} offline (ignorado${offline === 1 ? '' : 's'} até ficar${offline === 1 ? '' : 'em'} acessíve${offline === 1 ? 'l' : 'is'})`,

  // Toggle rows + password field
  enableTitle: 'Ativar o Sideload Relay',
  enableDesc: 'Anuncia o RDS como um Roku via SSDP e aceita sideloads. Desativado por padrão.',
  passwordTitle: 'Senha de desenvolvedor do Relay',
  passwordDesc: 'Senha com que sua IDE se autentica (usuário rokudev). Em branco, mantém a salva.',
  autoConsoleTitle: 'Conectar console automaticamente',
  autoConsoleDesc: 'Abre o console telnet 8085 em cada dispositivo após a instalação.',
  retryTitle: 'Tentar novamente uma vez após falha',
  retryDesc: 'Tenta novamente uma instalação com falha uma vez antes de reportá-la.',
  targetedDevicesTitle: 'Dispositivos selecionados',
  setupDevicesBtn: 'Configurar dispositivos',
  targetSummaryLoading: 'Carregando…',

  // Setup modal
  modalTitle: 'Configurar dispositivos do Sideload Relay',
  modalSubtitle:
    'Dispositivos ativados e acessíveis recebem cada build que você faz sideload pelo RDS. Dispositivos selecionados anteriormente que estão offline permanecem listados (desativados) e voltam automaticamente quando ficarem acessíveis novamente.',
  scanBtn: 'Buscar dispositivos',
  scanning: 'Buscando…',
  colLocation: 'Localização',
  colDevice: 'Dispositivo',
  colIpSerial: 'IP e serial',
  colEnabled: 'Ativado',
  colReachable: 'Acessível',
  emptyDevices: 'Nenhum dispositivo encontrado. Verifique se seus Rokus estão ligados e em modo de desenvolvedor e busque novamente.',
  locRemote: 'Remoto',
  locLocal: 'Local',

  // Per-device password affordance
  setPasswordBtn: '🔒 Definir senha',
  setPasswordTitle: 'Digite e valide a senha de desenvolvedor para ativar este dispositivo',
  enableAriaLabel: (name: string): string => `Ativar ${name}`,
  reachableNow: 'Acessível agora',
  reachableOk: '✓',
  reachableOff: '○ offline',
  reachableOffTitle: 'Não acessível — ignorado até voltar a ficar online',

  // Inline password editor
  pwInputPlaceholder: 'Senha de desenvolvedor',
  pwInputAriaLabel: (name: string): string => `Senha de desenvolvedor de ${name}`,
  pwValidateTitle: (name: string): string => `Validar e ativar ${name}`,
  pwValidateAriaLabel: 'Validar senha',
  pwValidateChar: '✓',
  pwEnterPassword: 'Digite uma senha',
  pwWrong: 'Senha incorreta',
  pwUnreachable: 'Inacessível',

  // Modal summary
  modalSummary: (enabledReachable: number, reachableTotal: number): string =>
    `${enabledReachable} ativado${enabledReachable === 1 ? '' : 's'} e acessíve${enabledReachable === 1 ? 'l' : 'is'} de ${reachableTotal} online`,
  modalSummaryOfflineSuffix: (offline: number): string => ` · ${offline} offline mantido${offline === 1 ? '' : 's'}`,

  // Scan status
  scanFound: (local: number, remote: number, total: number): string =>
    `Encontrado${total === 1 ? '' : 's'} ${local} local${remote ? ` · ${remote} remoto` : ''} dispositivo${total === 1 ? '' : 's'} de desenvolvedor.`,
  scanFailed: 'Falha na busca.',

  // Save status
  saved: 'Configurações do Sideload Relay salvas.',
  saveFailed: 'Falha ao salvar',
  fixBeforeEnable: 'Corrija os itens acima antes de ativar o Sideload Relay.',

  // Password reveal aria/title
  showPassword: 'Mostrar senha',
  hidePassword: 'Ocultar senha',

  // Saved-password placeholder hint
  savedPasswordPlaceholder: '•••••••• (salva)',

  // ── Native allow/deny prompt on the host (main/sideload-relay/index.ts) ──
  authorizeTitle: 'Sideload Relay',
  authorizeAllow: 'Permitir',
  authorizeDeny: 'Negar',
  authorizeMessage: (who: string): string => `Permitir um sideload de ${who}?`,
  authorizeDetail:
    'Outro dispositivo na sua rede está tentando instalar um build pelo Roku Dev Studio. ' +
    'Permita somente se você reconhecer este dispositivo.',

  // ── Relay dev-password validate / reveal + settings-save errors (main/ipc/relay-handlers.ts) ──
  errDeviceIpPasswordRequired: 'O IP e a senha do dispositivo são obrigatórios.',
  errIncorrectPassword: 'Senha de desenvolvedor incorreta.',
  errValidationFailed: 'Falha na validação.',
  errCouldNotReadPassword: 'Não foi possível ler a senha salva.',
  errCouldNotWriteSettings: 'Não foi possível gravar o arquivo de configurações.',
};

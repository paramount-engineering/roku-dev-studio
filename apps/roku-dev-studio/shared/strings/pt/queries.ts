/**
 * UI strings for the Query / Device Queries tab: ECP query results, custom
 * queries, POST actions, telnet system commands, Remove Plugin, and the Secret
 * Screens modal (renderer/components/queries/*).
 *
 * Parametrized strings are functions returning the composed text — the standard
 * way to keep interpolation translatable without a runtime format library.
 */
export const queries = {
  // Results card
  findInResults: 'Buscar nos resultados',
  saveResultsDialog: 'Salvar resultados',

  // Custom query field
  running: 'Executando...',
  runQuery: 'Executar consulta',

  // Shared error / status text (rendered into the results output)
  errorText: (msg: string): string => `Erro: ${msg}`,
  unknownError: 'Erro desconhecido',
  connectingToTelnet: 'Conectando ao Telnet (porta 8080)...',
  connectedSettingUpListener: 'Conectado. Configurando o listener...',
  failedToConnectTelnet: (err?: string): string => `Falha ao conectar ao Telnet (porta 8080): ${err}`,
  noOutputReceived: 'Nenhuma saída recebida',
  noOutputFromCommand: 'Nenhuma saída recebida do comando.',

  // Remove Plugin
  enterAppId: 'Insira um App ID',
  confirmRemovePlugin: (appId: string): string =>
    `Remover o plugin "${appId}"?\n\nIsso removerá o app deste dispositivo e de todos os dispositivos vinculados à mesma conta Roku.`,
  noResponseReceived: 'Nenhuma resposta recebida',
  noResponseFromCommand: 'Nenhuma resposta recebida do comando',

  // Secret Screens modal
  runSequence: 'Executar sequência',
  keySequenceAria: (title: string): string => `Sequência de teclas de ${title}`,
  confirmReboot: 'Isso envia a sequência de teclas que reinicia o Roku. Continuar?',

  // Secret screen titles
  developerSettings: 'Configurações de desenvolvedor',
  secretScreen: 'Tela secreta',
  secretScreen2: 'Tela secreta 2',
  wifiSecret: 'Tela secreta de Wi-Fi',
  antennaSecret: 'Tela secreta de antena',
  channelInfo: 'Informações do canal',
  network: 'Rede',
  reboot: 'Reiniciar',
};

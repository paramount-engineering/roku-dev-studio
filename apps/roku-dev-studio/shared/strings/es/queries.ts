/**
 * Latin American Spanish (neutral) translation of the Query / Device Queries tab
 * strings: ECP query results, custom queries, POST actions, telnet system commands,
 * Remove Plugin, and the Secret Screens modal. Sibling of ../queries.ts — same
 * `queries` shape, keys, order, and function signatures. Only literal display text
 * is translated.
 */
export const queries = {
  // Results card
  findInResults: 'Buscar en los resultados',
  saveResultsDialog: 'Guardar resultados',

  // Custom query field
  running: 'Ejecutando...',
  runQuery: 'Ejecutar consulta',

  // Shared error / status text (rendered into the results output)
  errorText: (msg: string): string => `Error: ${msg}`,
  unknownError: 'Error desconocido',
  connectingToTelnet: 'Conectando a Telnet (puerto 8080)...',
  connectedSettingUpListener: 'Conectado. Configurando el receptor...',
  failedToConnectTelnet: (err?: string): string => `Error al conectar a Telnet (puerto 8080): ${err}`,
  noOutputReceived: 'No se recibió salida',
  noOutputFromCommand: 'No se recibió salida del comando.',

  // Remove Plugin
  enterAppId: 'Ingrese un App ID',
  confirmRemovePlugin: (appId: string): string =>
    `¿Quitar el plugin "${appId}"?\n\nEsto quitará la app de este dispositivo y de todos los dispositivos vinculados a la misma cuenta de Roku.`,
  noResponseReceived: 'No se recibió respuesta',
  noResponseFromCommand: 'No se recibió respuesta del comando',

  // Secret Screens modal
  runSequence: 'Ejecutar secuencia',
  keySequenceAria: (title: string): string => `Secuencia de teclas de ${title}`,
  confirmReboot: 'Esto envía la secuencia de teclas que reinicia el Roku. ¿Continuar?',

  // Secret screen titles
  developerSettings: 'Configuración de desarrollador',
  secretScreen: 'Pantalla secreta',
  secretScreen2: 'Pantalla secreta 2',
  wifiSecret: 'Pantalla secreta de Wi-Fi',
  antennaSecret: 'Pantalla secreta de antena',
  channelInfo: 'Información del canal',
  network: 'Red',
  reboot: 'Reiniciar',
};

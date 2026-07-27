/**
 * Romanian (ro) translation of the Query / Device Queries tab strings: ECP query
 * results, custom queries, POST actions, telnet system commands, Remove Plugin,
 * and the Secret Screens modal. Sibling of ../queries.ts — same `queries` shape,
 * keys, order, and function signatures. Only literal display text is translated.
 */
export const queries = {
  // Results card
  findInResults: 'Găsește în rezultate',
  saveResultsDialog: 'Salvează rezultatele',

  // Custom query field
  running: 'Se execută...',
  runQuery: 'Execută interogarea',

  // Shared error / status text (rendered into the results output)
  errorText: (msg: string): string => `Eroare: ${msg}`,
  unknownError: 'Eroare necunoscută',
  connectingToTelnet: 'Se conectează la Telnet (port 8080)...',
  connectedSettingUpListener: 'Conectat. Se configurează ascultătorul...',
  failedToConnectTelnet: (err?: string): string => `Conectarea la Telnet (port 8080) a eșuat: ${err}`,
  noOutputReceived: 'Nu s-a primit niciun rezultat',
  noOutputFromCommand: 'Nu s-a primit niciun rezultat de la comandă.',

  // Remove Plugin
  enterAppId: 'Introduceți un App ID',
  confirmRemovePlugin: (appId: string): string =>
    `Eliminați pluginul „${appId}”?\n\nAceasta va elimina aplicația de pe acest dispozitiv și de pe toate dispozitivele conectate la același cont Roku.`,
  noResponseReceived: 'Nu s-a primit niciun răspuns',
  noResponseFromCommand: 'Nu s-a primit niciun răspuns de la comandă',

  // Secret Screens modal
  runSequence: 'Execută secvența',
  keySequenceAria: (title: string): string => `Secvență de taste ${title}`,
  confirmReboot: 'Aceasta trimite secvența de taste care repornește Roku. Continuați?',

  // Secret screen titles
  developerSettings: 'Setări dezvoltator',
  secretScreen: 'Ecran secret',
  secretScreen2: 'Ecran secret 2',
  wifiSecret: 'Ecran secret Wi-Fi',
  antennaSecret: 'Ecran secret antenă',
  channelInfo: 'Informații canal',
  network: 'Rețea',
  reboot: 'Repornire',
};

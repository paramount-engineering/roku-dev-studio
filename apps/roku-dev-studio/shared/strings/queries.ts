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
  findInResults: 'Find in Results',
  saveResultsDialog: 'Save Results',

  // Custom query field
  running: 'Running...',
  runQuery: 'Run Query',

  // Shared error / status text (rendered into the results output)
  errorText: (msg: string): string => `Error: ${msg}`,
  unknownError: 'Unknown error',
  connectingToTelnet: 'Connecting to Telnet (port 8080)...',
  connectedSettingUpListener: 'Connected. Setting up listener...',
  failedToConnectTelnet: (err?: string): string => `Failed to connect to Telnet (port 8080): ${err}`,
  noOutputReceived: 'No output received',
  noOutputFromCommand: 'No output received from command.',

  // Remove Plugin
  enterAppId: 'Please enter an App ID',
  confirmRemovePlugin: (appId: string): string =>
    `Remove Plugin "${appId}"?\n\nThis will remove the app from this device and all devices linked to the same Roku account.`,
  noResponseReceived: 'No response received',
  noResponseFromCommand: 'No response received from command',

  // Secret Screens modal
  runSequence: 'Run Sequence',
  keySequenceAria: (title: string): string => `${title} Key Sequence`,
  confirmReboot: 'This sends the key sequence that reboots the Roku. Continue?',

  // Secret screen titles
  developerSettings: 'Developer Settings',
  secretScreen: 'Secret Screen',
  secretScreen2: 'Secret Screen 2',
  wifiSecret: 'Wi-Fi Secret Screen',
  antennaSecret: 'Antenna Secret Screen',
  channelInfo: 'Channel Info',
  network: 'Network',
  reboot: 'Reboot',
} as const;

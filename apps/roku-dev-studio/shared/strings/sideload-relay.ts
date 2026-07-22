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
  gateTitle: 'To enable Sideload Relay:',
  gateNeedPassword: 'Set a Relay Dev Password so your IDE can authenticate with RDS.',
  gateNeedDevice: 'Target at least one reachable device — open “Setup Devices” and enable a device that’s online.',

  // Targeted Devices summary row
  targetSummaryEmpty: 'No devices targeted yet. Click “Setup Devices” to choose which Rokus receive each build.',
  targetSummaryChecking: (n: number): string =>
    `${n} device${n === 1 ? '' : 's'} targeted · checking reachability…`,
  targetSummaryReachable: (reachable: number): string => `${reachable} enabled & reachable`,
  targetSummaryOfflineSuffix: (offline: number): string => ` · ${offline} offline (skipped until reachable)`,

  // Toggle rows + password field
  enableTitle: 'Enable Sideload Relay',
  enableDesc: 'Advertise RDS as a Roku over SSDP and accept sideloads. Off by default.',
  passwordTitle: 'Relay Dev Password',
  passwordDesc: 'Password your IDE authenticates with (user rokudev). Blank keeps the saved one.',
  autoConsoleTitle: 'Auto Connect Console',
  autoConsoleDesc: 'Open the telnet 8085 console on each device after install.',
  retryTitle: 'Retry Once on Failure',
  retryDesc: 'Retry a failed install one time before reporting it.',
  targetedDevicesTitle: 'Targeted Devices',
  setupDevicesBtn: 'Setup Devices',
  targetSummaryLoading: 'Loading…',

  // Setup modal
  modalTitle: 'Setup Sideload Relay Devices',
  modalSubtitle:
    'Enabled + reachable devices receive every build you sideload through RDS. Previously-targeted devices that are offline stay listed (disabled) and rejoin automatically when reachable again.',
  scanBtn: 'Scan Devices',
  scanning: 'Scanning…',
  colLocation: 'Location',
  colDevice: 'Device',
  colIpSerial: 'IP & Serial',
  colEnabled: 'Enabled',
  colReachable: 'Reachable',
  emptyDevices: 'No devices found. Make sure your Rokus are on and in dev mode, then Rescan.',
  locRemote: 'Remote',
  locLocal: 'Local',

  // Per-device password affordance
  setPasswordBtn: '🔒 Set Password',
  setPasswordTitle: 'Enter and validate the dev password to enable this device',
  enableAriaLabel: (name: string): string => `Enable ${name}`,
  reachableNow: 'Reachable now',
  reachableOk: '✓',
  reachableOff: '○ offline',
  reachableOffTitle: 'Not reachable — skipped until it comes back online',

  // Inline password editor
  pwInputPlaceholder: 'Dev Password',
  pwInputAriaLabel: (name: string): string => `Dev password for ${name}`,
  pwValidateTitle: (name: string): string => `Validate & enable ${name}`,
  pwValidateAriaLabel: 'Validate Password',
  pwValidateChar: '✓',
  pwEnterPassword: 'Enter a password',
  pwWrong: 'Wrong password',
  pwUnreachable: 'Unreachable',

  // Modal summary
  modalSummary: (enabledReachable: number, reachableTotal: number): string =>
    `${enabledReachable} enabled & reachable of ${reachableTotal} online`,
  modalSummaryOfflineSuffix: (offline: number): string => ` · ${offline} offline kept`,

  // Scan status
  scanFound: (local: number, remote: number, total: number): string =>
    `Found ${local} local${remote ? ` · ${remote} remote` : ''} dev device${total === 1 ? '' : 's'}.`,
  scanFailed: 'Scan failed.',

  // Save status
  saved: 'Sideload Relay settings saved.',
  saveFailed: 'Save Failed',
  fixBeforeEnable: 'Fix the items above before enabling Sideload Relay.',

  // Password reveal aria/title
  showPassword: 'Show password',
  hidePassword: 'Hide password',

  // Saved-password placeholder hint
  savedPasswordPlaceholder: '•••••••• (saved)',
} as const;

/**
 * UI strings for the Settings window (General, MCP, Network Inspector, timing/validation, …).
 *
 * Parametrized strings are functions returning the composed text — the standard way to keep
 * interpolation translatable without a runtime format library. Generic words (Save, Cancel, …)
 * live in `common`; only Settings-specific copy belongs here.
 */
export const settings = {
  // Bootstrap / fatal
  apiUnavailable: 'Settings API unavailable.',

  // General section
  noFolderSet: 'No folder set',
  logFilePath: (path: string): string => `Log file: ${path}`,

  // Password storage / keychain
  keychainUnencryptedConfirm:
    'Your system does not provide a real encryption keyring. Enabling this stores passwords as encoded plaintext on disk, not encrypted. Continue?',
  keychainOff: 'Encryption toggle is off — remembered passwords are stored as plaintext on disk.',
  keychainDefaultBackend: 'System Keychain',
  keychainEncrypted: (backend: string): string => `Storage: encrypted via ${backend}.`,
  keychainUnencrypted:
    'Warning: toggle is on but this system uses basic text — passwords are Base64-encoded plaintext on disk. Use a Linux keyring (Secret Service/KWallet) for real encryption.',
  keychainUnavailable:
    'Warning: toggle is on but the OS keychain is unavailable — passwords stay in memory for this session only.',
  keychainStatus: (status: string, backend: string): string =>
    `Storage status: ${status}${backend ? ` (${backend})` : ''}.`,

  // MCP Server section
  mcpNoClients: 'No supported MCP clients detected on this system.',
  mcpInstalled: 'Installed',
  mcpNotDetected: 'Not Detected',
  mcpOpenConfigTitle: (path: string): string => `Open ${path}`,
  mcpOpenConfigAria: (label: string): string => `Open MCP config file for ${label}`,
  mcpOpenConfigFile: 'Open Config File',
  mcpInstallToEnable: (label: string): string => `Install ${label} to enable.`,
  mcpEnableAria: (label: string): string => `Enable MCP for ${label}`,

  // Network Inspector — status line
  niStatusDisabled: 'Status: disabled — save after enabling to start watching for hotspot clients.',
  niPlatformMac: 'bridge100 on macOS',
  niPlatformWin: 'virtual adapter on Windows',
  niPlatformLinux: 'hotspot interface on Linux',
  niStatusEnabled: (platformHint: string): string =>
    `Status: enabled — waiting for hotspot interface (${platformHint}).`,
  niMitmSuffix: (port: number): string => ` · MITM proxy on port ${port}`,

  // Network Inspector — capture setup (BPF)
  captureAccessEnabled: 'Capture Access Enabled',
  setupNeeded: 'Setup Needed',
  niSetupRowDescOk: 'Optional — only for hotspot DNS/SNI capture. Proxying needs no setup.',
  niSetupRowDescNeeds: 'Hotspot capture needs setup — open to enable it. (Proxying still works.)',
  niSetupPacketCapture: 'Setup Packet Capture',
  bpfWaitingApproval: 'Waiting for administrator approval…',
  bpfInstalled: 'Packet capture access installed.',
  bpfInstalledHint: 'Installed — return to the Network Inspector tab.',
  bpfCancelled: 'Cancelled.',
  bpfSetupFailed: 'Setup failed.',

  // Network Inspector — place selector + Remote Locations
  placeLocal: 'Local (This Machine)',
  placeRemoteFallback: 'Remote',
  niRemoteRequiresRoot:
    'This location requires the remote server to run as root to enable Network Inspector.',
  niRemoteUnsupported:
    'This location does not support Network Inspector. Update this Remote Server for Network Inspector functionality.',
  niDisabled: 'Network Inspector is disabled.',
  niEditingRemote: 'Editing Remote Location settings. Capture runs on the remote server.',
  niPortConflictTitle: 'Proxy Port Unavailable',
  niRemoteUnavailable: 'Remote Network Inspector is not available in this build.',
  niCheckingRemote: 'Checking Remote Location…',
  niCouldNotReachRemote: 'Could not reach the Remote Location.',

  // Network Inspector — enable confirm + save status
  niConfirmEnable:
    'Network Inspector will capture Roku traffic and store it locally on this machine — through the MITM proxy and, if set up, hotspot/shared-network capture. Continue?',
  niSaved: 'Network Inspector settings saved.',
  niSavedRemote: 'Saved to Remote Location.',
  niRemoteSaveFailed: 'Remote Save Failed',

  // Timing bounds + validation
  timingValueFallback: 'Value',
  timingBoundMin: (value: string | number): string => `Min: ${value}`,
  timingBoundMax: (value: string | number): string => `Max: ${value}`,
  timingMustBeWholeNumber: (label: string): string => `${label} must be a whole number.`,
  timingMustBeAtLeast: (label: string, bound: string): string => `${label} must be at least ${bound}.`,
  timingMustBeAtMost: (label: string, bound: string): string => `${label} must be at most ${bound}.`,
  timingMoreOutOfRange: (n: number): string => ` (${n} more out of range)`,
  timingClamped: (label: string, value: string, which: string): string =>
    `${label} adjusted to ${value} (${which}).`,
  timingClampMinimum: 'minimum',
  timingClampMaximum: 'maximum',

  // Save status messages
  generalSaved: 'General Settings saved.',
  actionScriptsSaved: 'Action Scripts Settings saved.',
  devicePerfSaved: 'Device Performance Settings saved.',
  timingSaved: 'Timing & Network Settings saved.',
  mcpSaved: 'MCP Server Settings saved.',
  saveFailed: 'Save Failed',

  // ── Static settings.html shell ──────────────────────────────────────────
  // Header + nav
  heading: 'Settings',
  navAria: 'Settings sections',
  tabGeneral: 'General',
  tabActionScripts: 'Action Scripts',
  tabDevicePerformance: 'Device Performance',
  tabTiming: 'Timing & Network',
  tabNetworkInspector: 'Network Inspector',
  tabSideloadRelay: 'Sideload Relay',
  tabMcpServer: 'MCP Server',
  // Shared across every section's save dock
  resetToDefaults: 'Reset to Defaults',

  // General section — toggle labels, descriptions, and (screen-reader) aria labels
  developerMode: 'Developer Mode',
  developerModeDesc: 'Extra logging in the main window (same as File → Developer Mode).',
  developerModeAria: 'Developer mode',
  privacyMode: 'Privacy Mode',
  privacyModeDesc: 'Mask IPs and Serial-Numbers in the UI (same as File → Privacy Mode).',
  privacyModeAria: 'Privacy mode',
  debugLogging: 'Debug Logging to File',
  debugLogHint: 'Writes to the log file under app user data when enabled.',
  debugLoggingAria: 'Debug logging to file',
  useKeyboardRemote: 'Use Keyboard for Roku Remote',
  useKeyboardRemoteDesc:
    'When On, you can use the keyboard to control the Roku. Keyboard shortcuts are listed in the Remote Help modal.',
  useKeyboardRemoteAria: 'Roku Remote - Use Keyboard ',
  autoConnect: 'Auto Connect to Devices',
  autoConnectDesc:
    'When On, the app will automatically connect to devices that were stayed connected when closing the app in the previous session.',
  autoHideSidebar: 'Auto-Hide Sidebar',
  autoHideSidebarDesc:
    'When On, the Sidebar, which presents the devices list, will auto-toggle if the Sidebar was hidden in the previous session.',
  encryptPasswords: 'Encrypt Saved Passwords with System Keychain',
  encryptPasswordsDesc:
    'Encrypt each device\'s remembered password via the OS keychain. When Off, it persists but is stored unencrypted on disk.',
  encryptPasswordsAria: 'Persist saved passwords in system keychain',

  // Action Scripts section
  actionScriptsBlurb:
    'Default folder for screenshots and logs when a script needs saves. You can still pick another folder per run.',
  chooseFolder: 'Choose Folder…',

  // Device Performance section
  rememberDevicePerf: "Remember 'Show Device Performance'",
  rememberDevicePerfAria: 'Remember Device Performance show or hide per device',

  // Network Inspector section — place selector + field labels
  location: 'Location',
  niPlaceAria: 'Network Inspector location',
  enableNetworkInspector: 'Enable Network Inspector',
  enableNetworkInspectorDesc:
    "Inspect a device's network traffic. Decrypts your dev channel's HTTPS via the local proxy (any network); a hotspot also captures DNS/SNI. Stored locally only.",
  mitmProxyPort: 'MITM Proxy Port',
  mitmProxyPortDesc:
    "Port the local decrypting proxy listens on. Route your sideloaded dev channel through it — works on any network (stock channels can't be intercepted).",
  mitmProxyPortAria: 'MITM proxy port',
  packetLimit: 'Per-Device Packet Limit',
  packetLimitDesc:
    'Max captured frames kept per device for the PCAP export. Higher = longer history, more memory. 100–100000.',
  packetLimitAria: 'Per-device packet limit',
  maxBodySize: 'Max Body Size (KB)',
  maxBodySizeDesc:
    'How much of each request/response body is kept for viewing in the inspector. Larger = inspect big bodies (e.g. multi-MB JS) whole; over this, the body shows a "Body Truncated" badge. This never affects what the device receives. Applies to new traffic only — raising it won\'t restore bodies already captured and truncated. 64–16384 KB.',
  maxBodySizeAria: 'Max retained body size in KB',
  hotspotCaptureSetup: 'Hotspot & Capture Setup',
  viewSetup: 'View Setup',

  // Sideload Relay section — intro bullets (text-only bullets only; the first bullet has inline markup)
  srIntro2: 'RDS accepts the sideload once, then installs it on every enabled target, launches the Dev App, and opens each console.',
  srIntro3: 'Sideloads from this machine proceed automatically.',
  srIntro4: 'A sideload from another LAN device needs the Dev Password and asks you to allow it.',
} as const;

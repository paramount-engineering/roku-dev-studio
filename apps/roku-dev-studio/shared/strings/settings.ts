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
  loadFailedMessage: 'Failed to open Settings. Please try again.',

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
  // Client row labels (product/brand names — same across locales, but sourced here so the
  // catalog is the single place UI text lives). Keys match main's McpClientId union.
  mcpClientLabels: {
    chatgpt: 'ChatGPT Desktop',
    claude: 'Claude Desktop',
    cursor: 'Cursor',
    vscode: 'Visual Studio Code',
    'vscode-insiders': 'VS Code Insiders',
    vscodium: 'VSCodium',
    windsurf: 'Windsurf',
  },
  // MCP panel help blurb — contains <a>/<code>, rendered via data-i18n-html.
  mcpServerBlurbHtml: `Expose Roku Dev Studio to AI agents via the <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" class="mcp-link">Model Context Protocol</a>. Toggle a client to add or remove its <code class="mcp-inline-code">roku-dev-studio</code> MCP server entry; other entries are left untouched.`,
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
  // Static default for the setup modal <h2>; JS replaces it with a platform-suffixed title.
  hotspotCaptureSetupModalTitle: 'Hotspot Capture Setup',
  niSetupRowDescOk: 'Optional — only for hotspot DNS/SNI capture. Proxying needs no setup.',
  niSetupRowDescNeeds: 'Hotspot capture needs setup — open to enable it. (Proxying still works.)',
  niSetupPacketCapture: 'Setup Packet Capture',
  bpfWaitingApproval: 'Waiting for administrator approval…',
  bpfInstalled: 'Packet capture access installed.',
  bpfInstalledHint: 'Installed — return to the Network Inspector tab.',
  bpfCancelled: 'Cancelled.',
  bpfSetupFailed: 'Setup failed.',

  // Network Inspector — Hotspot Capture Setup guide body (per-platform paragraphs + steps).
  // Injected as HTML, so these carry inline <strong>/<em>/<code>/<a> markup. Keep code literals
  // (bridge100, /dev/bpf*, tcpdump, URLs) and product names (Wi-Fi, Npcap, Wireshark) as-is.
  niSetupGuide: {
    titlePrefix: 'Hotspot Capture Setup',
    darwin: {
      intro: `<strong>Optional — for hotspot capture only.</strong> Decrypting your sideloaded dev channel works on any network without this setup. These steps add hotspot capture of DNS/TLS SNI from <em>all</em> of a Roku's traffic via your Mac's Internet Sharing hotspot (<code class="mcp-inline-code">bridge100</code>). Local devices only.`,
      enableSharing: `<strong>Enable Internet Sharing</strong> — RDS captures on <code class="mcp-inline-code">bridge100</code> once it's on:`,
      sharingSteps: [
        `Open <strong>System Settings → General → Sharing</strong>`,
        `Turn on <strong>Internet Sharing</strong>, sharing <strong>to Wi-Fi</strong>`,
        `Connect your Roku to the Mac's shared Wi-Fi network`
      ],
      captureHead: 'Packet Capture Access',
      captureBody: `macOS creates <code class="mcp-inline-code">/dev/bpf*</code> as root-only. Run the one-time setup below to restore access across reboots (admin password required, like Wireshark's ChmodBPF). Or install <a href="https://www.wireshark.org/download.html" target="_blank" rel="noopener noreferrer" class="mcp-link">Wireshark</a> and run its ChmodBPF installer.`
    },
    win32: {
      intro: `<strong>Optional — for hotspot capture only.</strong> Decrypting your sideloaded dev channel works on any network without this setup (the MITM proxy handles both same-Wi-Fi and hotspot). These steps add hotspot capture of DNS/TLS SNI from <em>all</em> of a Roku's traffic when it's connected through this PC's hotspot. Local devices only.`,
      enableHotspot: `<strong>Enable a hotspot yourself (optional)</strong> — RDS doesn't toggle Windows networking; you control it:`,
      hotspotSteps: [
        `Open <strong>Settings → Network &amp; internet → Mobile hotspot</strong>`,
        `Turn <strong>Mobile hotspot</strong> on (share over Wi-Fi)`,
        `Connect your Roku to that hotspot — RDS auto-detects the virtual adapter`
      ],
      npcapHead: 'Hotspot Capture Access (Npcap)',
      npcapBody: `Hotspot capture (DNS/TLS SNI from all of the Roku's traffic) needs the <a href="https://npcap.com/" target="_blank" rel="noopener noreferrer" class="mcp-link">Npcap</a> driver. This is optional — leave it out and MITM proxying still records your sideloaded dev channel.`,
      npcapSteps: [
        `Download and run the installer from <a href="https://npcap.com/" target="_blank" rel="noopener noreferrer" class="mcp-link">npcap.com</a>`,
        `During setup, enable <strong>“Install Npcap in WinPcap API-compatible Mode”</strong>`,
        `<strong>Restart Roku Dev Studio</strong> after installing so the bundled capture module loads`
      ],
      npcapNote: `Already have Npcap but capture still won't start? Reinstall Roku Dev Studio so its native capture module matches this build.`
    },
    linux: {
      intro: `<strong>Optional — for hotspot capture only.</strong> Decrypting your sideloaded dev channel works on any network without this setup. These steps add hotspot capture of DNS/TLS SNI from <em>all</em> of a Roku's traffic by sharing this machine's connection. Local devices only.`,
      shareConnection: `<strong>Share your connection</strong> so the Roku routes through this machine:`,
      shareSteps: [
        `Use NetworkManager → <strong>“Shared to other computers”</strong> on a Wi-Fi/Ethernet connection (gateway <code class="mcp-inline-code">10.42.0.1</code>), or run a hostapd hotspot`,
        `Connect your Roku to that shared network — RDS auto-detects the gateway interface`
      ],
      captureHead: 'Packet Capture Access',
      captureBody: `Linux captures via <code class="mcp-inline-code">tcpdump</code>, which needs raw-socket privileges. Run the one-time setup below (admin prompt) to grant the <code class="mcp-inline-code">cap_net_raw</code>/<code class="mcp-inline-code">cap_net_admin</code> capabilities — or manually: <code class="mcp-inline-code">sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump)</code>.`
    }
  },

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

  // Timing & Network row labels (title + hint per timing key), localized here so the
  // Settings UI renders them in the active language. Numeric min/max bounds still come
  // from the main process via `timingMeta`.
  timingLabels: {
    DEFAULT_RALE_PORT: { title: 'RALE / App Connector Port', hint: 'TCP Port(Default 49200).' },
    SCREENSHOT_DEBOUNCE_DELAY: { title: 'Screenshot Debounce(ms)', hint: 'Delay after key press before auto-screenshot.' },
    SCREENSHOT_AFTER_LAUNCH_DELAY: { title: 'Screenshot After Launch(ms)', hint: 'Wait after Dev App launch before screenshot.' },
    TELNET_TIMEOUT: { title: 'Telnet Connect Timeout(ms)', hint: 'Debug Console / System Telnet.' },
    CONNECTION_CHECK_INTERVAL: { title: 'Device Active Check(ms)', hint: 'How often connected devices are polled: device info, ECP state, and whether the Dev App channel is in the foreground.' },
    DEVICE_METRICS_SAMPLE_INTERVAL_MS: { title: 'Sampling Rate(ms)', hint: 'Chanperf + object-count poll cadence. Lower = fresher data, more ECP traffic; needs Developer Mode and Control by Mobile Apps.' },
    DEVICE_METRICS_CHART_HISTORY_MS: { title: 'Chart History Time(minutes)', hint: 'How far back the CPU and System Memory charts plot' },
    TOAST_DISPLAY_DURATION: { title: 'Toast Duration(s)', hint: 'Success/Error toast visibility.' },
    STATUS_MESSAGE_DURATION: { title: 'Status Message Duration(s)', hint: 'Header Status Line Visibility.' },
  },

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
  saveWriteFailedError: 'Could not write settings file.',
  mcpConfigUpdateWarning: (summary: string): string =>
    `MCP client config update had errors: ${summary}`,

  // ── Static settings.html shell ──────────────────────────────────────────
  // Header + nav
  windowTitle: 'Settings — Roku Dev Studio',
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
  language: 'Language',
  languageDesc: 'Display language for the app interface.',
  languageAria: 'Display language',
  languageSystemDefault: (name: string): string => `System Default (${name})`,
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
  tryDemoAppToggle: 'Show Try Demo App Button',
  tryDemoAppToggleDesc:
    'When On, a Try Demo App button appears in the title bar for sideloading the bundled Roku Dev Studio Showcase demo channel to a device.',
  tryDemoAppToggleAria: 'Show Try Demo App button',
  tryDemoAppOpenBtn: 'Open Demo App',
  tryDemoAppOpenBtnAria: 'Open the Try Demo App picker',
  crashReportingToggle: 'Show Crash Reports',
  crashReportingToggleDesc:
    'When On, an uncaught error shows a report modal with details you can file as a GitHub issue.',
  crashReportingToggleAria: 'Show crash reports',
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
  devicePerfIntroHtml: `Applies while <strong>Show Device Performance</strong> is on, the Roku has Developer Mode, and the Dev App is in the foreground. When <strong>Remember 'Show Device Performance'</strong> is on below, the Remote Section restores the quad layout per device.`,
  rememberDevicePerf: "Remember 'Show Device Performance'",
  rememberDevicePerfAria: 'Remember Device Performance show or hide per device',
  // Row description — contains <strong>, rendered via data-i18n-html.
  rememberDevicePerfDescHtml: `Restore whether <strong>Show Device Performance</strong> was on for each device. Turn off to always start with just the Remote Section until you enable it again.`,

  // Network Inspector section — place selector + field labels
  location: 'Location',
  niPlaceAria: 'Network Inspector location',
  enableNetworkInspector: 'Enable Network Inspector',
  enableNetworkInspectorDesc:
    "Inspect a device's network traffic. Decrypts your dev channel's HTTPS via the local proxy (any network); a hotspot also captures DNS/SNI. Stored locally only.",
  mitmProxyPort: 'MITM Proxy Port',
  mitmProxyPortDesc:
    "Port the local decrypting proxy listens on. Route your sideloaded dev channel through it — stock channels can't be intercepted.",
  mitmProxyPortAria: 'MITM proxy port',
  packetLimit: 'Per-Device Packet Limit',
  packetLimitDesc:
    'Frames kept per device for the PCAP export. Higher = more history and memory.',
  packetLimitAria: 'Per-device packet limit',
  maxBodySize: 'Max Body Size (KB)',
  maxBodySizeDesc:
    'How much of each request/response body is kept for viewing. Over the limit, a "Body Truncated" badge shows (the device is unaffected). Applies to new traffic only.',
  maxBodySizeAria: 'Max retained body size in KB',
  hotspotCaptureSetup: 'Hotspot & Capture Setup',
  viewSetup: 'View Setup',

  // Sideload Relay section — intro bullets. The first bullet has inline markup (<span>/<code>,
  // whose #srRelayUrlWrap/#srRelayUrl are populated at runtime) so it's rendered via data-i18n-html.
  srIntro1Html: `Point your sideload tool (VS Code with the BrightScript extension, Eclipse, or the roku-deploy CLI)<span id="srRelayUrlWrap" hidden> — or a browser at <code id="srRelayUrl">http://…/</code></span> — here instead of a single Roku.`,
  srIntro2: 'RDS accepts the sideload once, then installs it on every enabled target, launches the Dev App, and opens each console.',
  srIntro3: 'Sideloads from this machine proceed automatically.',
  srIntro4: 'A sideload from another LAN device needs the Dev Password and asks you to allow it.',

  // ── Network Inspector — Certificate Authority (compact row + details modal) ──
  caSectionTitle: 'Certificate Authority',
  // Short description shown on the settings row; the full caSectionDesc lives in the modal.
  caRowDesc: 'The local certificate authority the proxy uses to decrypt HTTPS.',
  // Shown instead of caRowDesc/caSectionDesc when the selected place is a remote location —
  // the certificate authority (and its private key) live on that server, not this machine.
  caRowDescRemote: "This location's certificate authority, used by its proxy to decrypt HTTPS.",
  caViewCert: 'View Certificate',
  caSectionDesc:
    'The Network Inspector signs decrypted HTTPS with a local certificate authority. Trust or import it on the device so your dev channel accepts the proxy. The private key never leaves this machine.',
  caSectionDescRemote:
    'The Network Inspector signs decrypted HTTPS with this location’s certificate authority. Trust or import it on the device so your dev channel accepts the proxy. The private key never leaves that server.',
  caSubject: 'Subject',
  caFingerprint: 'SHA-256 Fingerprint',
  caValidity: 'Validity',
  caProxyAddress: 'Proxy Address',
  caValidityRange: (from: string, to: string): string => `${from} – ${to}`,
  caLoading: 'Loading certificate details…',
  caUnavailable: 'Certificate details are unavailable.',
  // Verb-only label; the file extension (.pem/.crt) is a non-translatable literal shown beside it.
  caExportAction: 'Export',
  exportCaPem: 'Export .pem',
  exportCaCrt: 'Export .crt',
  caExportedPem: 'CA exported as .pem.',
  caExportedCrt: 'CA exported as .crt.',
  caExportFailed: 'Export failed.',
} as const;

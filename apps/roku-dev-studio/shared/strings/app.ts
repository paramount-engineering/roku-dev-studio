/**
 * UI strings for the main app shell (renderer/app.ts): device sidebar cards,
 * device tabs, connect/scan flow, remote-location + server-info modals, device
 * hardware-image modal, Apps tab, ECP/Control-by-Mobile-Apps warnings, toasts,
 * and dialogs.
 *
 * Parametrized strings are functions returning the composed text — the standard
 * way to keep interpolation translatable without a runtime format library.
 */
export const app = {
  // Generic display fallbacks
  notAvailable: 'N/A',
  unknown: 'Unknown',
  unknownError: 'Unknown error',
  unknownRoku: 'Unknown Roku',
  rokuDevice: 'Roku device',
  remote: 'Remote',

  // Scan button (sidebar + title bar)
  scan: 'Scan',

  // Remote locations — sidebar section
  statusOffline: 'Offline',
  connecting: 'Connecting...',
  serverInfoTitle: 'Server Info',
  deviceCount: (n: number): string => `${n} device${n !== 1 ? 's' : ''}`,
  scanningForDevices: 'Scanning for devices...',
  connectingToRelayServer: 'Connecting to relay server...',
  serverOffline: 'Server Offline',
  noRokuDevicesFound: 'No Roku devices found',
  confirmRemoveLocation: (name: string): string => `Remove location "${name}"?`,

  // Add-location flow (errors surfaced via alert)
  locationHostExists: (host: string, name: string): string =>
    `A location with host "${host}" already exists ("${name}").`,
  locationServerExists: (name: string): string =>
    `A location with this server address already exists ("${name}").`,
  unableToConnectRelay:
    'Unable to connect to relay server. Please check the address and ensure the server is running.',
  failedToConnectRelay: 'Failed to connect to relay server',
  addLocation: 'Add Location',

  // Server capabilities modal
  serverCapabilities: {
    remote: { label: 'Remote Control', desc: 'Keypress and Navigation Commands' },
    apps: { label: 'Apps', desc: 'List and Launch Installed Apps' },
    query: { label: 'Query', desc: 'Device Info, Media Player Status' },
    devApp: { label: 'Dev App', desc: 'Sideload Development Channels' },
    screenshot: { label: 'Screenshot', desc: 'Capture Device Screen' },
    console: { label: 'Console', desc: 'BrightScript Debug Output' },
    debugger: { label: 'Debugger', desc: 'Breakpoints, Step Execution, Variable Inspection' },
    appConnector: { label: 'App Connector', desc: 'RALE TrackerTask Integration' },
    deepLink: { label: 'Deep-Link', desc: 'Launch Content with Parameters' },
    networkInspector: { label: 'Network Inspector', desc: 'Capture DNS/SNI/HTTP + MITM Proxy' }
  },
  capSupported: 'Supported',
  capNeedsRoot: 'Needs Root',
  capNotSupported: 'Not Supported',
  capabilitiesHeading: 'Capabilities',

  // Device cards + tabs
  devBadge: 'Dev',
  remoteOff: 'Remote Off',
  ecpBadgeDisabledTitle: 'Control by Mobile Apps is disabled',
  ecpLimited: 'ECP Limited',
  ecpBadgeLimitedTitle: 'ECP Limited: Text, App Launch, and Query Work; Full Keypress may not',
  deviceTypeTv: 'TV',
  deviceTypeStb: 'STB',
  labelType: 'Type',
  labelIp: 'IP',
  labelModel: 'Model',
  labelSerial: 'Serial',
  labelSw: 'SW',
  expand: 'Expand',
  minimize: 'Minimize',
  reconnect: 'Reconnect',
  atLocation: (value: string, location: string): string => `${value} @ ${location}`,

  // Device context menu
  copyDeviceName: 'Copy Device Name',
  copyIpAddress: 'Copy IP Address',
  copyModelNumber: 'Copy Model-Number',
  copySerialNumber: 'Copy Serial-Number',
  copyAllDetails: 'Copy All Details',
  deviceDetails: (d: {
    deviceName?: string;
    ip?: string;
    modelName?: string;
    modelNumber?: string;
    serialNumber?: string;
    softwareVersion?: string;
    deviceId?: string;
    networkType?: string;
    wifiMac?: string;
  }): string =>
    `Device Name: ${d.deviceName}
IP Address: ${d.ip}
Model Name: ${d.modelName}
Model-Number: ${d.modelNumber}
Serial-Number: ${d.serialNumber}
Software Version: ${d.softwareVersion || 'N/A'}
Device ID: ${d.deviceId || 'N/A'}
Network Type: ${d.networkType || 'N/A'}
WiFi MAC: ${d.wifiMac || 'N/A'}`,

  // Offline / connection state
  deviceOffline: 'Device Offline',
  unableToConnectDevice: 'Unable to connect to this Roku device.',
  retryConnection: 'Retry Connection',

  // Device hardware-image modal
  labelScreenSize: 'Screen Size',
  labelOsVersionBuild: 'OS Version & Build',
  checkForUpdates: 'Check for Updates',
  restartDevice: 'Restart Device',
  checkForUpdatesLabel: 'Check for Updates',
  restartDeviceLabel: 'Restart Device',
  deviceImageAria: (name: string): string => `${name} — device image`,
  viewLargerImage: (name: string): string => `View larger image: ${name}`,
  deviceIpUnavailable: 'Device IP is unavailable.',
  setDevPasswordFirst: 'Set this device’s developer password first (Dev App tab).',
  actionSucceeded: (label: string): string => `${label} succeeded.`,
  actionFailed: (label: string): string => `${label} failed.`,
  actionFailedWith: (label: string, err: string): string => `${label} failed: ${err}`,

  // Apps tab
  installedApps: 'Installed Apps',
  installedAppsAndTvInputs: 'Installed Apps and TV Inputs',
  rawListOfApps: 'Raw List of Apps',
  appsAndInputsList: 'Apps and Inputs List',
  appTileTitle: (name: string, id: string): string => `${name}\nID: ${id}\nClick to launch`,
  switchToInput: (name: string): string => `Switch to ${name}`,
  failedToLoadApps: 'Failed to load apps:',
  errorPrefix: 'Error:',
  installedAppsHeader: 'INSTALLED APPS',
  inputsHeader: 'INPUTS',
  copied: 'Copied!',
  copyList: 'Copy List',

  // Auto-connect toasts
  connectedAutomatically: (label: string): string => `Connected to ${label} automatically.`,
  connectedMultipleAutomatically: (count: number): string =>
    `Connected to ${count} saved devices automatically.`,

  // Manual connect
  couldNotConnectToIp: (ip: string): string =>
    `Could not connect to ${ip}. Make sure the Roku device is on and accessible.`,
  connectionError: (err: string): string => `Connection error: ${err}`,

  // Custom title bar
  windowControlsUnavailable: 'Window controls are unavailable. Quit and restart Roku Dev Studio.',
  restoreDown: 'Restore Down',
  maximize: 'Maximize',

  // Log file
  couldNotOpenLogFile: (err: string): string => `Could not open log file: ${err}`,

  // Help modal
  searchHelpGuide: 'Search Help & Guide',

  // ECP / Control by Mobile Apps warnings
  ecpWarnDisabledTitle: 'Control by Mobile Apps Disabled',
  ecpWarnDisabledDesc:
    'Remote control is off. Enable "Control by Mobile Apps" → Network Access on your Roku device to use remote, apps, and text input.',
  ecpWarnLimitedTitle: 'Control by Mobile Apps: Limited',
  ecpWarnLimitedDesc:
    'Text input, app launch, and app query work. Full remote keypress may not be available—set Network Access to <strong>Permissive</strong> or <strong>Enabled</strong> for full remote.',
  ecpWarnSubnetTitle: 'Permissive: Check Network',
  ecpWarnSubnetDesc:
    'Permissive mode accepts commands only from the same subnet. Your machine may be on a different subnet; if commands fail, check your network.',

  // App Connector / TrackerTask
  trackerTaskSaved: 'TrackerTask.xml saved successfully!',
  failedToSaveTrackerTask: 'Failed to save TrackerTask.xml:',
  errorSavingTrackerTask: 'Error saving TrackerTask:',
  integrationInfoCopied: 'Integration info copied to clipboard!',
  failedToCopyClipboard: 'Failed to copy to clipboard',

  // App init
  appInitFailed: 'App initialization failed:',

  // ───────────────────────────────────────────────────────────────────────
  // Static index.html markup (filled by applyI18n). Inline English is kept as
  // the fallback; these mirror it (with ui-text-casing applied to labels).
  // ───────────────────────────────────────────────────────────────────────

  // Title bar
  titleBarToggleSidebar: 'Toggle Sidebar',
  titleBarScanTitle: 'Scan for Local and Remote Devices',
  titleBarScanAria: 'Scan for Devices',
  titleBarHelpTitle: 'Help & User Guide',
  titleBarHelpAria: 'Help and Guide',
  helpAndGuide: 'Help & Guide',
  floatingRemoteToggleTitle: 'Toggle a Floating Remote that follows you outside Remote and Dev App tabs',
  floatingRemoteToggleAria: 'Toggle Floating Remote',
  floatingRemote: 'Floating Remote',
  appMenu: 'App Menu',
  zoomOut: 'Zoom Out',
  zoomIn: 'Zoom In',
  resetZoom: 'Reset Zoom to 100%',
  currentZoomAria: 'Current zoom; click to reset to 100%',

  // Sidebar — device discovery
  sidebarLocal: 'Local',
  manualConnect: 'Manual Connect',
  addRemoteLocation: 'Add Remote Location',
  viewLogsTitle: 'View Debug Logs (Desktop/roku-connector-debug.log)',
  viewLogs: 'View Logs',

  // Welcome panel
  welcomeSubtitle:
    'Discover Roku devices locally or via remote relays, sideload and deep-link channels, debug live BrightScript with a streaming Telnet console, automate end-to-end test flows, and bring AI agents into your dev loop over MCP.',
  featureDeviceDiscovery: 'Device Discovery',
  featureDeviceDiscoveryDesc: 'Auto-discover Roku devices on your local network via SSDP.',
  featureAppsDeepLinking: 'Apps & Deep-Linking',
  featureAppsDeepLinkingDesc: 'Browse, launch apps, use Deep-Links with custom parameters.',
  featureDevAppDesc: 'Sideload dev channels and auto-capture Dev App screenshots.',
  featureAppConnectorDesc: 'Execute BrightScript functions on a sideloaded app.',
  featureFiddle: 'Fiddle',
  featureFiddleDesc: 'Run BrightScript snippets on-device in a Monaco editor.',
  featureMcpServer: 'MCP Server',
  featureMcpServerDesc: 'Expose Roku Dev Studio to AI agents using MCP Server.',
  featureDeviceRemote: 'Device Remote',
  featureDeviceRemoteDesc: 'Full D-pad, media controls, and text input — like a real remote.',
  featureQueryDesc: 'Query device info, media-player state, and registry over ECP.',
  featureConsoleDesc: 'View BrightScript Debug Output via Telnet, Filter, Search, and Debug',
  featureActionScriptsDesc: 'Chain key presses, launches, and RALE calls into automated flows.',
  featureNetworkInspectorDesc: 'Inspect Dev App HTTP/HTTPS traffic via a MITM proxy.',
  featureRemoteLocations: 'Remote Locations',
  featureRemoteLocationsDesc: 'Connect to Roku devices anywhere via relay servers.',

  // Device-panel tabs
  tabRemote: 'Remote',
  tabApps: 'Apps',
  tabQuery: 'Query',
  tabDevApp: 'Dev App',
  tabConsole: 'Console',
  tabAppConnector: 'App Connector',
  tabActionScripts: 'Action Scripts',
  tabNetwork: 'Network',

  // Device panel — performance strip & paused nav
  perfCpu: 'CPU',
  perfMem: 'Mem',
  perfObj: 'Obj',
  devicePerfPaused: 'Device Performance Paused — bring the Dev App to the foreground to resume.',
  devicePerfPausedShort: 'Device Performance Paused',
  launch: 'Launch',
  sideloadDevApp: 'Sideload Dev App',
  sideload: 'Sideload',

  // Shared warnings (Developer Mode / Control by Mobile Apps)
  developerModeNotEnabled: 'Developer Mode Not Enabled',
  ecpNotEnabledTitle: 'Control by Mobile Apps Not Enabled',
  howToEnable: 'How to Enable',
  devAppDevModeDesc: 'Dev App sideloading requires Developer Mode to be enabled on your Roku device.',
  queryDevModeDesc: 'Some query features may be limited. Enable Developer Mode for full access.',
  inspectorDevModeDesc: 'App Connector requires Developer Mode and a sideloaded channel with TrackerTask.',

  // Remote Section
  keyboardShortcutsRemoteTitle: 'Keyboard Shortcuts for this Remote',
  keyboardShortcutsQuickRemoteTitle: 'Keyboard Shortcuts for Quick Remote',
  keyboardRemoteHelpAria: 'Keyboard Remote Shortcuts Help',
  showDevicePerformance: 'Show Device Performance',
  remoteBack: 'Back',
  remoteHome: 'Home',
  remoteOptions: 'Options',
  remoteReplay: 'Replay',
  remoteVolUp: 'Vol +',
  remoteMute: 'Mute',
  remoteVolDown: 'Vol -',
  remotePower: 'Power',
  remoteRewind: 'Rewind',
  remotePlayPause: 'Play/Pause',
  remoteForward: 'Forward',
  sendTextPlaceholder: 'Type Text to send to Roku...',
  sendText: 'Send Text',
  rokuSecretScreens: 'Roku Secret Screens',
  secretScreensTitle: 'Remote Key Sequences for Roku Secret and Diagnostic Screens',
  sectionRemoteControl: 'Remote Control',
  sectionObjectCounts: 'BrightScript Object Counts (Dev)',
  cpuUsage: 'CPU Usage',
  sectionMemoryUsage: 'Memory Usage',

  // Remote Section — metrics quadrants
  brightScriptObjects: 'BrightScript Objects',
  objectMetricsMode: 'Object Metrics Mode',
  objectsModeCount: 'Count',
  objectsModeMemory: 'Memory',
  objectsTop10: 'Top 10',
  cpuMetricsMode: 'CPU Metrics Mode',
  cpuModePercent: 'CPU %',
  cpuModeProcess: 'Process',
  systemMemory: 'System Memory',
  legendTotal: 'Total',
  legendUser: 'User',
  legendKernel: 'Kernel',
  legendUsed: 'Used',
  legendResident: 'Resident',
  legendAnonymous: 'Anonymous',
  legendShared: 'Shared',
  legendLimit: 'Limit',

  // Apps tab
  customLaunch: 'Custom Launch',
  customAppIdPlaceholder: 'App ID (e.g., 12)',
  tvInputsLabel: 'TV Inputs:',
  hdmi1: 'HDMI 1',
  hdmi2: 'HDMI 2',
  hdmi3: 'HDMI 3',
  hdmi4: 'HDMI 4',
  deepLink: 'Deep-Link',
  moreLaunchOptions: 'More Launch Options',
  saveAndLaunch: 'Save and Launch',
  deeplinkSaved: 'Saved',
  selectSavedDeepLink: '-- Select saved Deep-Link --',
  deleteSavedDeepLink: 'Delete Saved Deep-Link',
  appId: 'App ID',
  deeplinkAppIdPlaceholder: 'e.g., 31440',
  contentId: 'Content ID',
  contentIdPlaceholder: 'Content Identifier',
  mediaType: 'Media Type',
  selectPlaceholder: '-- Select --',
  mediaTypeMovie: 'Movie',
  mediaTypeSeries: 'Series',
  mediaTypeEpisode: 'Episode',
  mediaTypeLive: 'Live',
  manageMediaTypes: 'Manage Media Types',
  addParameter: 'Add Parameter',
  deeplinkParamKeyPlaceholder: 'Key',
  deeplinkParamValuePlaceholder: 'Value',
  removeParameter: 'Remove Parameter',
  listApps: 'List',
  loadingApps: 'Loading apps...',
  inputsSectionLabel: 'Inputs',
  noAppsFound: 'No apps found. Click Refresh to load.',

  // Dev App tab
  auth: 'Auth',
  password: 'Password',
  verify: 'Verify',
  remember: 'Remember',
  selectPackage: 'Select Package',
  install: 'Install',
  typeTextShortPlaceholder: 'Type Text...',
  send: 'Send',
  autoScreenshot: 'Auto Screenshot',
  screenshot: 'Screenshot',
  copyScreenshot: 'Copy Screenshot',
  downloadScreenshot: 'Download Screenshot',
  clearScreenshot: 'Clear Screenshot',
  capture: 'Capture',
  clickCapture: 'Click Capture',

  // Query tab
  deviceQueries: 'Device Queries',
  queryDeviceInfo: 'Device Info',
  queryAllApps: 'All Apps',
  queryActiveApp: 'Active App',
  queryMediaPlayer: 'Media Player',
  queryPlugins: 'Plugins',
  queryMemory: 'Memory',
  developerQueries: 'Developer Queries',
  openFiddle: 'Open Fiddle',
  openFiddleTitle: 'Open BrightScript Fiddle with this device preselected',
  openFiddleAria: 'Open BrightScript Fiddle for this device',
  qsSceneGraph: 'SceneGraph',
  qsSgRendezvous: 'SG Rendezvous',
  qsFwBeacons: 'FW Beacons',
  qsPerformance: 'Performance',
  qsOther: 'Other',
  qsCustom: 'Custom',
  queryAllNodes: 'All Nodes',
  queryRootNodes: 'Root Nodes',
  track: 'Track',
  events: 'Events',
  untrack: 'Untrack',
  queryFrameRate: 'Frame Rate',
  queryChannelPerf: 'Channel Perf',
  queryAppState: 'App State',
  queryRegistry: 'Registry',
  queryObjectCounts: 'Object Counts',
  run: 'Run',
  customQueryPlaceholder: 'e.g. /query/device-info',
  results: 'Results',
  removePluginPlaceholder: 'App ID (e.g., 987654_cf9a)',
  removePlugin: 'Remove Plugin',

  // Console (Telnet) tab
  telnetConsole: 'Telnet Console',
  copyAllLogs: 'Copy All Logs',
  saveLogsToFile: 'Save Logs to File',
  clearConsole: 'Clear Console',
  clearOptions: 'Clear Options',
  clearRelayOnly: 'Clear (on Relay Server only)',
  clearLocalAndRelay: 'Clear (Local and on Relay Server)',
  findResizeTitle: 'Drag to widen Search (Double-click to reset)',
  consoleMonitor: 'Console Monitor',
  telnetPortBadge: 'Port 8085',
  connectPullRelayTitle: 'Connect and Pull Relay Buffer',
  connectOptions: 'Connect Options',
  connectLiveOnly: 'Connect (skip existing logs buffer)',
  telnetPlaceholder: 'Connect to view BrightScript Debug Output',
  jumpToLatestLogs: 'Jump to Latest Logs',

  // App Connector tab
  connection: 'Connection',
  port: 'Port',
  logVerbosity: 'Log Verbosity',
  logVerbosityTitle: 'RALE Logger Level Applied on Connect',
  verbosityOff: 'Off',
  verbosityError: 'Error',
  verbosityWarning: 'Warning',
  verbosityInfo: 'Info',
  verbosityDebug: 'Debug',
  integrationGuide: 'Integration Guide',
  integrationGuideTitle: 'How to integrate TrackerTask with App Connector',
  executeFunction: 'Execute Function',
  functionLabel: 'Function',
  connectToLoadFunctions: '-- Connect to load functions --',
  execute: 'Execute',
  parameters: 'Parameters',
  selectFunctionParams: 'Select a function to see parameters',
  response: 'Response',
  updateNode: 'Update Node',
  updateNodeBtnTitle: 'After Get Node by ID: selectNode Then setField, removeField, or Add Field via setField',
  action: 'Action',
  fieldAction: 'Field Action',
  updateField: 'Update Field',
  addField: 'Add Field',
  removeField: 'Remove Field',
  field: 'Field',
  fieldName: 'Field Name',
  fieldNamePlaceholder: 'e.g. text, visible, width',
  fieldType: 'Field Type',
  typeString: 'String',
  typeInteger: 'Integer',
  typeFloat: 'Float',
  typeBoolean: 'Boolean',
  typeColor: 'Color',
  typeArray: 'Array',
  typeAssocArray: 'AssocArray',
  value: 'Value',
  fieldValuePlaceholder: 'Scalars, true/false, JSON for Arrays / Vectors / Objects',

  // Action Scripts tab
  builder: 'Builder',
  executor: 'Executor',
  copyToExecutor: 'Copy to Executor',
  copyActionScript: 'Copy Action Script',
  saveActionScript: 'Save Action Script',
  saveToDirectory: 'Save to Directory…',
  moreSaveOptions: 'More Save Options',
  addActionToEnable: 'Add at least one action to enable',
  connectToConsole: 'Connect to Console',
  editInBuilder: 'Edit in Builder',
  editInBuilderTitle: 'Open the Current Script in the Builder Tab',
  importActionScript: 'Import Action Script',
  importActionScriptTitle: 'Import or Update the Action Script',
  actions: 'Actions',
  builderImportTitle: 'Import Script from File or Paste JSON',
  undoTitle: 'Undo (Ctrl+Z)',
  redoTitle: 'Redo (Ctrl+Shift+Z)',
  clearAllActions: 'Clear All Actions',
  helpForActionType: 'Help for This Action Type',
  closeAddStep: 'Close Add Step',
  actionType: 'Action Type',
  addAction: 'Add Action',
  dragToResize: 'Drag to resize',
  resizePanels: 'Resize Panels',
  json: 'JSON',
  uploadJson: 'Upload JSON',
  orPasteBelow: 'Or paste below',
  validate: 'Validate',
  devPasswordRequired: 'Developer password required by some actions (screenshot, sideload):',
  enterDevPassword: 'Enter developer password',
  clearActions: 'Clear Actions',
  runActionScript: 'Run Action Script',
  stopExecution: 'Stop Execution',
  copyResultsToClipboard: 'Copy Results to Clipboard',
  saveResultsAsPdf: 'Save Results as PDF',
  clearResultsTitle: 'Clear Results and Free Memory (Save will have nothing until next Run)',

  // Network Inspector tab
  networkInspector: 'Network Inspector',
  niFindTitle: 'Find in Traffic — URL, Payloads, Headers, Response Bodies (⌘/Ctrl+F)',
  niFindAria: 'Find in Traffic',
  niFindPrevTitle: 'Previous Match (Shift+↑)',
  niFindPrev: 'Previous Match',
  niFindNextTitle: 'Next Match (Shift+↓)',
  niFindNext: 'Next Match',
  niFindClear: 'Clear Find Results',
  niDownloadTitle: 'Download Session…',
  niDownloadAria: 'Download Session',
  niExportHar: 'Export All as HAR',
  niExportSession: 'Export Session (.rds-network-inspector.json)',
  niSavePcap: 'Save Packet Capture (.pcap)',
  niClearTitle: 'Clear Session List',
  niSetupBadgeTitle: 'Hotspot Capture Setup Needed — Click for Instructions',
  niCaptureSetup: 'Capture Setup',
  niPortBadgeTitle: 'Proxy Port Unavailable — Click for Details',
  niProxyPortUnavailable: 'Proxy Port Unavailable',
  niFilterPlaceholder: 'Filter Traffic…',
  niFilterTitle: 'Filter Traffic — click the info icon for supported syntax.',
  niClearFilter: 'Clear Filter',
  niFilterHelpTitle: 'Filtering Help & Supported Syntax',
  niFilterHelpAria: 'Filtering Help',
  niSessionCountTitle: 'Captured Sessions',
  niControls: 'Network Inspector Controls',
  niToggleDetailLayout: 'Toggle Detail Layout',
  niConfigureTitle: 'Configure Traffic Rules',
  niGroupByHostTitle: 'Group Sessions by Hostname',
  niGroupByHost: 'Group by Host',
  niProxiedTitle:
    'Show Only Requests Proxied Through RDS (Full Headers + Body), Hiding Hotspot-capture SNI/DNS Metadata',
  niProxied: 'Proxied',
  niWaitingForTraffic: 'Waiting for traffic…',
  niScrollBottom: 'Scroll to Latest Sessions',

  // App menu (hamburger)
  developerMode: 'Developer Mode',
  privacyMode: 'Privacy Mode',
  debugLogging: 'Debug Logging',
  openDiagnosticLogsFolder: 'Open Diagnostic Logs Folder',
  openLogFile: 'Open Log File',
  settings: 'Settings',
  clearCacheAndReload: 'Clear Cache and Reload',
  zoom: 'Zoom',
  aboutRokuDevStudio: 'About Roku Dev Studio',
  quitRokuDevStudio: 'Quit Roku Dev Studio',

  // ───────────────────────────────────────────────────────────────────────
  // index.html localization pass — cloned-template defaults, empty-states,
  // attribute-only strings, and multi-element prose (data-i18n-html) blocks
  // that the earlier migration left inline.
  // ───────────────────────────────────────────────────────────────────────

  // Sidebar — local devices empty state (prose with <br>/<strong>)
  noDevicesFoundHtml: 'No devices found.<br>Click <strong>Scan</strong> to discover Roku devices.',

  // Device panel header (cloned-template defaults, replaced by JS at runtime)
  deviceNamePlaceholder: 'Device Name',
  perfStripPausedPlaceholder: 'Paused — launch Dev App to resume',

  // ECP / Control by Mobile Apps warning descriptions (prose with <strong>)
  ecpRemoteWarningDescHtml:
    'Remote control (keypress, apps, etc.) requires "Control by Mobile Apps" → Network Access to be set to <strong>Enabled</strong> on your Roku device.',
  ecpDevAppWarningDescHtml:
    'The Quick Remote and keypress features require "Control by Mobile Apps" → Network Access to be <strong>Enabled</strong> on your Roku device.',

  // Dev App tab — sideloaded-app default + screenshot image alt text
  noChannelSideloaded: 'No channel sideloaded',
  screenshotAlt: 'Roku Screenshot',

  // App Connector — Update Node modal intro (prose with <strong>/<code>) + response empty-state
  updateNodeModalIntroHtml:
    'Uses the <strong>path</strong> from your last successful Get Node by ID. Actions: <code>removeField</code>, <code>setField</code> (add / update).',
  responseWillAppearHere: 'Response will appear here...',

  // Action Scripts — Executor nudge + password-prompt hint (prose with <strong>/<code>)
  executorBuilderNudgeHtml:
    'Use the <strong>Builder</strong> tab to add and edit steps with guided fields. Use this area to validate, import, or run JSON.',
  executorPasswordPromptHintHtml:
    'Enter it here and run again, or add <code>"devPassword": "..."</code> to your script JSON.'
} as const;

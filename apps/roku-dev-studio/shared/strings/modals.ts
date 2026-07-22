/**
 * UI strings for global modals: the auto-update notification banner + Release
 * Notes modal (renderer/components/modals/update-notification.ts) and the
 * welcome-screen feature detail modals (welcome-feature-modal.ts).
 *
 * Parametrized strings are functions returning the composed text — the standard
 * way to keep interpolation translatable without a runtime format library.
 */
export const modals = {
  // Release Notes modal
  releaseNotes: 'Release Notes',
  versionedReleaseNotes: (title: string): string => `${title} · Release Notes`,
  openReleasePage: 'Open Release Page',
  loadingReleaseNotes: 'Loading release notes…',
  noReleaseNotes: 'No release notes provided for this release.',
  couldNotLoadReleaseNotes: 'Could not load release notes right now.',
  latestRelease: 'Latest Release',
  unknownError: 'Unknown error',

  // Update banner — update available
  updateAvailableTitle: (version?: string): string =>
    `Roku Dev Studio ${version ? `v${version}` : 'Update'} Available`,
  newVersionReady: 'A new version is ready to download.',
  dismissUpdateNotification: 'Dismiss update notification',
  later: 'Later',
  download: 'Download',

  // Update banner — downloading
  downloadingUpdate: 'Downloading Update…',
  pleaseWaitDownloading: 'Please wait while the update is downloaded.',

  // Update banner — ready to install
  updateReadyTitle: (version?: string): string =>
    `Roku Dev Studio ${version ? `v${version}` : 'Update'} Ready`,
  installedOnRestart: 'Will be installed on restart.',
  restartAndInstall: 'Restart & Install',

  // Update banner — manual download / error
  newUpdateAvailable: 'New Update Available',
  pleaseDownloadLatest: 'Please download the latest release to update.',
  dismiss: 'Dismiss',
  updateError: 'Update Error',
  updateCheckFailed: 'Update check failed.',

  // "Check for Updates" — no update found toast
  upToDate: (version?: string): string => `You're up to date${version ? ` (v${version})` : ''}.`,

  // Welcome-screen feature detail modals — longer blurb + capability bullets per tile.
  // (Keyed by the feature title so the component can look each up by the tile's live title.)
  features: {
    deviceDiscovery: {
      blurb:
        'Roku Dev Studio continuously scans your local network with SSDP so every Roku on the same subnet shows up automatically — no IP typing required.',
      points: [
        'Auto-detects Roku models, names, and IP addresses',
        'Flags which devices have Developer Mode enabled',
        'Refreshes as devices join or leave the network',
        'One click to connect and start working',
      ],
    },
    appsDeepLinking: {
      blurb:
        'Browse every channel installed on the connected Roku, launch any of them instantly, and test Deep-Links with custom content and media-type parameters.',
      points: [
        'Grid of installed apps (plus TV inputs on Roku TVs)',
        'Launch from the grid or by app ID',
        'Deep-link with contentId / mediaType for content-launch testing',
        'Copy a raw ID + version list of everything installed',
      ],
    },
    devApp: {
      blurb:
        'Sideload, control, and inspect your development channel end-to-end — from a zip upload to live screenshots of what is on screen.',
      points: [
        'Sideload a .zip dev channel with your developer password',
        'Launch or delete the sideloaded app',
        'Capture screenshots on demand or auto-capture',
        'Copy, download, or clear captured images',
      ],
    },
    appConnector: {
      blurb:
        'Call BrightScript functions on your sideloaded channel remotely and see their return values — exercise code paths without touching the remote.',
      points: [
        'Invoke exported functions by name with arguments',
        'Inspect the returned values inline',
        'Runs against the live dev channel',
      ],
    },
    fiddle: {
      blurb:
        'A scratchpad for BrightScript: write snippets in a full Monaco editor and run them on a connected device with live linting.',
      points: [
        'Monaco editor with syntax highlighting',
        'Live lint feedback as you type',
        'One-click run on the connected Roku',
        'Opens in its own dedicated window',
      ],
    },
    mcpServer: {
      blurb:
        'Expose Roku Dev Studio to AI agents over the Model Context Protocol, so assistants can drive your device inside your dev loop.',
      points: [
        'Launch apps, press keys, and capture screenshots via MCP tools',
        'Query device state programmatically',
        'Bring AI agents into your test and debug workflow',
      ],
    },
    deviceRemote: {
      blurb:
        'A full on-screen Roku remote — every button of the physical remote, plus keyboard control and text entry.',
      points: [
        'D-pad, OK, Back, Home, Options, and Replay',
        'Media transport: play/pause, rewind, fast-forward',
        'Volume, mute, and power',
        'Type Text straight into on-device fields',
      ],
    },
    query: {
      blurb:
        'Read live state from the Roku over ECP (External Control Protocol) — device info, media-player status, installed apps, and the registry.',
      points: [
        'Device info: model, version, and network',
        'Active app and media-player playback state',
        'Installed apps list',
        'Registry contents',
      ],
    },
    console: {
      blurb:
        "Stream the Roku's BrightScript Debug Output live over Telnet, with filtering and search to surface exactly what matters.",
      points: [
        'Live Telnet log stream',
        'Filter and full-text search',
        'Click URLs or JSON to inspect them in a modal',
        'Save the log to a file',
      ],
    },
    actionScripts: {
      blurb:
        'Automate repeatable device flows by chaining key presses, app launches, and RALE calls into a single runnable script.',
      points: [
        'Sequence keypresses, launches, and waits',
        'Include RALE calls in the flow',
        'Re-run flows for regression testing',
      ],
    },
    networkInspector: {
      blurb:
        "Capture and inspect the Dev App's HTTP/HTTPS traffic through a built-in MITM proxy — like a browser's network tab for your channel.",
      points: [
        'See every request and response the channel makes',
        'Inspect headers, bodies, and timing',
        'Decrypt HTTPS via the MITM proxy',
        'Group by host or view proxied sessions',
      ],
    },
    remoteLocations: {
      blurb:
        "Connect to Roku devices that aren't on your local network by routing through relay servers.",
      points: [
        'Reach devices anywhere via a relay server',
        'Manage multiple Remote Locations',
        'Same tooling as local devices',
      ],
    },
  },

  // ── Global modal fragments (renderer/components/modals/fragments/*.html) ──
  // One sub-group per fragment. Only elements whose visible text is a single
  // text node (pure text, icon + label, or a pure-text child span) are keyed —
  // applyI18n's mixed-content path replaces just the first text node, so prose
  // with inline <strong>/<code>/<em>/<a>/kbd markup is intentionally NOT keyed
  // and keeps its inline English. Generic buttons reuse common.* (cancel, save,
  // add, clear, close).

  addLocation: {
    title: '🌐 Add Remote Location',
    intro:
      'Connect to Roku devices at a remote location via the Roku Relay Server running on a Mac Mini or other computer.',
    nameLabel: 'Location Name',
    namePlaceholder: 'e.g., Office Lab, Studio B',
    nameHint: 'A friendly name to identify this location',
    hostLabel: 'Server Address',
    hostPlaceholder: '192.168.1.50 or mac-mini.local',
    hostHint: 'IP Address or Hostname of the Relay Server',
    portLabel: 'Port',
    portHint: 'Default port is 4951',
    addBtn: 'Add Location',
  },

  actionScriptsImport: {
    title: 'Import Action Script',
    uploadJsonLabel: 'Upload JSON',
    chooseFileBtn: 'Choose File',
    pasteJsonLabel: 'Paste or Edit JSON',
    outputFolderLabel: 'Output Folder',
    noFolderSelected: 'No folder selected',
    chooseFolderBtn: 'Choose Folder',
    outputWarning:
      'If no folder is selected, artifacts (e.g. screenshots) will not be saved when you run the script.',
    devPasswordRequiredMsg: 'This script requires a developer password. Enter it below.',
    devPasswordLabel: 'Developer Password',
    devPasswordPlaceholder: 'Enter developer password for screenshot / sideload steps',
    rememberPasswordTitle: 'Save password for this device (same as Dev App password storage)',
    rememberPasswordLabel: 'Remember password for this device',
    validateImportBtn: 'Validate and Import',
  },

  deeplinkDeleteMediaType: {
    title: 'Delete Media Type',
    confirmHint: 'Delete the media type and these saved Deep-Links?',
    deleteAllBtn: 'Delete All',
  },

  deeplinkMediaTypes: {
    title: 'Manage Media Types',
    hint: 'Built-in media types are always available. Custom entries are saved globally and appear in every device tab.',
    builtinTitle: 'Built-in',
    builtinMovie: 'Movie',
    builtinSeries: 'Series',
    builtinEpisode: 'Episode',
    builtinLive: 'Live',
    customTitle: 'Custom',
    addTitle: 'Add Media Type',
    displayNameLabel: 'Display Name',
    displayNamePlaceholder: 'e.g., Short Film',
    ecpValueLabel: 'ECP Value',
    ecpValuePlaceholder: 'e.g., short-film',
  },

  deeplinkSavePreset: {
    title: 'Save Deep-Link',
    hint: 'Give this Deep-Link a name so you can pick it from the saved list on any device.',
    nameLabel: 'Name',
    namePlaceholder: 'e.g., Netflix · Episode 12',
  },

  devMode: {
    title: 'Enable Developer Mode on Roku',
    whatIsHeading: 'What is Developer Mode?',
    whatIsBody:
      "Developer Mode allows you to sideload and test your own Roku channels directly on your device. It's free to enable and gives you access to powerful development tools.",
    stepsHeading: 'Steps to enable Developer Mode',
    step2: 'A Developer Settings dialog will appear on your TV',
    step4: 'Accept the Developer SDK License Agreement',
    step6: 'Your Roku will restart with Developer Mode enabled',
    afterHeading: 'After enabling',
    afterIntro: 'Once Developer Mode is enabled:',
    moreHeading: 'More information',
    moreBody: 'For detailed documentation, visit the official Roku Developer documentation:',
  },

  ecpMode: {
    title: 'Control by Mobile Apps on Roku',
    whyHeading: 'Why is this needed?',
    howHeading: 'How to change the setting',
    afterHeading: 'After changing',
  },

  keyboardRemoteHelp: {
    title: 'Keyboard Remote',
    tableCaption: 'Shortcuts Mapped to Roku Remote',
    colKey: 'Key',
    colAction: 'Remote Action',
    actionNavigate: 'Navigate (Up, Down, Left, Right)',
    actionSelect: 'Select / OK',
    actionBack: 'Back',
    actionHome: 'Home',
    actionPlayPause: 'Play / Pause',
    actionRewind: 'Rewind',
    actionForward: 'Forward',
    actionOptions: 'Options (Info)',
    actionReplay: 'Instant Replay',
    actionVolumeUp: 'Volume Increase',
    actionVolumeDown: 'Volume Decrease',
    actionMute: 'Mute',
    actionPower: 'Power',
    footnote:
      'Turn Keyboard Remote off in Settings if you do not want arrow keys and other mapped keys to send Roku keypresses.',
  },

  secretScreens: {
    title: 'Roku Secret Screens',
    ecpLimitationTitle: 'ECP Limitation',
    sectionTitle: 'Secret Screens',
  },

  integrationGuide: {
    title: 'Integration Guide',
    whatIsHeading: 'What is TrackerTask?',
    trackerTaskEnabling:
      'The TrackerTask establishes a socket connection between your Roku app and external tools, enabling:',
    enablingPoint1: 'Real-time node inspection and modification',
    enablingPoint2: 'Live view of UI element boundaries',
    enablingPoint3: 'Registry management',
    enablingPoint4: 'Logging and debugging',
    extendsBody:
      "The App Connector extends this functionality with two custom functions that allow you to expose and execute your app's custom BrightScript functions from this desktop tool.",
    customFunctionsHeading: 'Custom Functions for App Connector',
    customFunctionsBody:
      'Two functions have been added to the TrackerTask to enable the App Connector functionality:',
    implementingHeading: 'Implementing in Your Scene',
    getExternalHeading: 'GetExternalControlFunctions Implementation',
    supportedParamsTitle: '📝 Supported Parameter Types',
    executeFunctionHeading: 'ExecuteFunction Implementation',
    executeFunctionBody:
      'This function receives the function name and parameters array, then routes to the appropriate handler:',
    setupHeading: 'TrackerTask Setup',
    setupBody: 'Add the TrackerTask component to your project and create an instance in your MainScene:',
    saveBtn: 'Save TrackerTask.xml',
    copyBtn: 'Copy Integration Info',
  },

  helpModal: {
    title: 'Help & User Guide',
    navAriaLabel: 'Help Sections',
    navDeviceDiscovery: 'Device Discovery',
    navRemoteControl: 'Remote Control',
    navApps: 'Apps',
    navQuery: 'Query',
    navDevApp: 'Dev App',
    navConsole: 'Console',
    navAppConnector: 'App Connector',
    navActionScripts: 'Action Scripts',
    navDevicePerformance: 'Device Performance',
    navNetworkInspector: 'Network Inspector',
    navAiAgents: 'AI Agents (MCP)',
    navFiddle: 'BrightScript Fiddle',
    navLogViewer: 'Log File Viewer',
    navSecretScreens: 'Secret Screens',
    navSettings: 'Settings',
    navRemoteLocations: 'Remote Locations',
    navSideloadRelay: 'Sideload Relay',
    navTips: 'Tips',

    deviceDiscoveryHeading: 'Device Discovery',
    deviceDiscoveryManual:
      'You can also manually connect by entering an IP address in the "Manual Connect" section at the bottom of the sidebar.',

    remoteControlHeading: 'Remote Control',
    scNavigation: 'Navigation',
    scForward: 'Forward',
    scSelect: 'Select / OK',
    scRewind: 'Rewind',
    scBack: 'Back',
    scReplay: 'Instant Replay',
    scHome: 'Home',
    scVolume: 'Volume Increase / Decrease',
    scPlayPause: 'Play / Pause',
    scMute: 'Mute',
    scOptions: 'Options menu',
    scPower: 'Power',

    appsHeading: 'Apps',
    appsBody:
      'View all installed apps on your Roku device. Click any app to launch it. Use the search to filter apps by name.',

    queryHeading: 'Query',
    queryIntro: "Query device information using Roku's ECP endpoints:",
    queryResults:
      'Results are displayed in the Results panel below. POST endpoints (SGRendezvous tracking, FW Beacons) are also available.',

    devAppHeading: 'Dev App',
    devAppIntro: 'For Developer Mode enabled devices:',
    devAppNote: "You'll need your Roku Developer password (set during Developer Mode setup).",

    consoleHeading: 'Console',
    consoleIntro: 'Connect to the BrightScript debug console via Telnet (port 8085):',
    consoleNote:
      'Requires Developer Mode enabled. Only one telnet connection can be active at a time per device.',

    appConnectorHeading: 'App Connector',
    appConnectorIntro:
      'Connect to Roku apps that implement the TrackerTask component for two-way communication:',

    actionScriptsHeading: 'Action Scripts',
    actionScriptsIntro:
      'Automate sequences of device actions using JSON-based scripts. Two views are available:',

    devicePerformanceHeading: 'Device Performance (Remote Section)',

    networkInspectorHeading: 'Network Inspector',
    networkInspectorLocalOnly: 'Network Inspector is available for locally connected devices.',

    aiAgentsHeading: 'AI Agents (MCP)',
    aiAgentsBridge:
      'The bridge starts automatically when the app is open and shuts down on quit. If an agent reports the bridge is offline, just bring this app to the foreground.',

    fiddleHeading: 'BrightScript Fiddle',
    fiddleNote:
      "Requires a Developer Mode-enabled device with a known Dev Password (use the Dev App tab once to remember it, or you'll be prompted in Fiddle).",

    logViewerHeading: 'Log File Viewer',

    secretScreensHeading: 'Secret Screens',

    settingsHeading: 'Settings',

    remoteLocationsHeading: 'Remote Locations',
    remoteLocationsIntro: 'Control Roku devices at Remote Locations via a Relay Server:',

    sideloadRelayHeading: 'Sideload Relay',

    tipsHeading: 'Tips',
    tipMultipleDevices: 'Multiple devices can be connected simultaneously - each gets its own tab',
    tipClickCard: 'Click a connected device card to switch to its tab',
    tipRightClick: 'Right-click device cards to copy device info',
    tipRemoteLocations: 'Remote locations allow you to control devices without physical access',
  },
} as const;

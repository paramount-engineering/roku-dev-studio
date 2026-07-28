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
    savedScriptLabel: 'Saved Action Scripts',
    savedSelectPlaceholder: 'Select a saved Action Script',
    savedSelectEmpty: 'No saved Action Scripts',
    pasteJsonLabel: 'Paste or Edit JSON',
    outputFolderLabel: 'Output Folder',
    noFolderSelected: 'No Folder selected',
    chooseFolderBtn: 'Choose Folder',
    outputWarning:
      'If no folder is selected, artifacts (e.g. screenshots) will not be saved when you run the script.',
    devPasswordRequiredMsg: 'This script requires a developer password. Enter it below.',
    devPasswordLabel: 'Developer Password',
    devPasswordPlaceholder: 'Enter developer password for screenshot / sideload steps',
    rememberPasswordTitle: 'Save password for this device (same as Dev App password storage)',
    rememberPasswordLabel: 'Remember password for this device',
    devPasswordHintHtml:
      'Required when the script has screenshot or sideload steps and does not include a <code>devPassword</code> field.',
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
    pressSequenceHtml:
      'On your Roku remote, press: <span class="help-kbd">Home</span> <span class="help-kbd">Home</span> <span class="help-kbd">Home</span> <span class="help-kbd">Up</span> <span class="help-kbd">Up</span> <span class="help-kbd">Right</span> <span class="help-kbd">Left</span> <span class="help-kbd">Right</span> <span class="help-kbd">Left</span> <span class="help-kbd">Right</span>',
    step2: 'A Developer Settings dialog will appear on your TV',
    step3Html: 'Select <strong>"Enable installer and restart"</strong>',
    step4: 'Accept the Developer SDK License Agreement',
    step5Html: `Set a <strong>Web Server Password</strong> (you'll need this for sideloading)`,
    step6: 'Your Roku will restart with Developer Mode enabled',
    afterHeading: 'After enabling',
    afterIntro: 'Once Developer Mode is enabled:',
    afterBadgeHtml:
      'Your device will show a <span class="dev-badge enabled" style="font-size: 11px;"><span class="icon icon-xs"><svg><use href="#icon-wrench"/></svg></span> Dev</span> badge in the device list',
    afterSideloadHtml: 'You can sideload .zip channel packages via the <strong>Dev App</strong> tab',
    afterAppConnectorHtml: 'Use the <strong>App Connector</strong> to communicate with your channel code',
    afterQueryHtml: 'Access additional ECP queries in the <strong>Query</strong> tab',
    moreHeading: 'More information',
    moreBody: 'For detailed documentation, visit the official Roku Developer documentation:',
  },

  ecpMode: {
    title: 'Control by Mobile Apps on Roku',
    whyHeading: 'Why is this needed?',
    whyBodyHtml:
      "Remote functionality (keypress, apps, Quick Remote, Send Text) uses Roku's External Control Protocol (ECP). The device setting <strong>Control by Mobile Apps → Network Access</strong> can be set to one of four modes:",
    modeDisabledHtml: '<strong>Disabled</strong> – Control by mobile apps is off.',
    modeLimitedHtml:
      '<strong>Limited</strong> – Text input, app launches, and querying the active app only; enabled on private network addresses.',
    modePermissiveHtml:
      '<strong>Permissive</strong> – Full control; accepts commands only from private network or the same subnet.',
    modeEnabledHtml: '<strong>Enabled</strong> – Full control; enabled on private network addresses.',
    howHeading: 'How to change the setting',
    step1Html: 'On your Roku device, go to <strong>Settings</strong> → <strong>System</strong>',
    step2Html: 'Open <strong>Advanced System Settings</strong>',
    step3Html: 'Select <strong>Control by Mobile Apps</strong>',
    step4Html: 'Select <strong>Network Access</strong>',
    step5Html:
      'Choose <strong>Limited</strong>, <strong>Permissive</strong>, or <strong>Enabled</strong> (this app adapts to the mode)',
    afterHeading: 'After changing',
    afterBodyHtml:
      'With <strong>Limited</strong>, Send Text, app launch, and app query work; full remote keypress may not. With <strong>Permissive</strong> or <strong>Enabled</strong>, full remote control works. For Permissive, ensure this computer is on the same subnet as the Roku if commands fail. No restart is required after changing the setting.',
  },

  keyboardRemoteHelp: {
    title: 'Keyboard Remote',
    introHtml:
      'Shortcuts apply while this device tab is on the <strong>Remote</strong> tab or the <strong>Dev App</strong> tab only.',
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
    introHtml: `
            Roku devices have built-in diagnostic and developer menus accessible via remote button sequences.
            From the Roku <strong>Home</strong> screen, press the buttons shown in each row using a
            <strong>physical remote</strong> (IR or voice remote).
          `,
    ecpLimitationTitle: 'ECP Limitation',
    ecpLimitationBodyHtml: `
              Roku does not reliably interpret all secret-screen sequences sent over ECP. If a
              sequence doesn't open via <strong>Run Sequence</strong>, use the <strong>physical remote</strong>.
            `,
    sectionTitle: 'Secret Screens',
  },

  integrationGuide: {
    title: 'Integration Guide',
    whatIsHeading: 'What is TrackerTask?',
    whatIsBodyHtml: `
            <strong>TrackerTask</strong> is a BrightScript component originally created for <strong>RALE (Roku Advanced
              Layout Editor)</strong> -
            Roku's official developer tool for inspecting and debugging SceneGraph applications in real-time.
          `,
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
    implementingBodyHtml: `
            Your app's <strong>MainScene.xml</strong> must declare two interface functions that the TrackerTask will
            call:
          `,
    getExternalHeading: 'GetExternalControlFunctions Implementation',
    getExternalBodyHtml: `
            This function must return an <strong>roArray</strong> of associative arrays, where each item describes a
            function:
          `,
    supportedParamsBodyHtml: `
              <strong>Boolean</strong> · <strong>Integer</strong> · <strong>LongInteger</strong> ·
              <strong>Float</strong> ·
              <strong>Double</strong> · <strong>String</strong> · <strong>roAssociativeArray</strong> ·
              <strong>roArray</strong> · <strong>roList</strong>
            `,
    supportedParamsTitle: '📝 Supported Parameter Types',
    executeFunctionHeading: 'ExecuteFunction Implementation',
    executeFunctionBody:
      'This function receives the function name and parameters array, then routes to the appropriate handler:',
    setupHeading: 'TrackerTask Setup',
    setupBody: 'Add the TrackerTask component to your project and create an instance in your MainScene:',
    setupPlaceHtml: `
            Place the <code>TrackerTask.xml</code> file in your App's <code>components/</code> directory.
          `,
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
    deviceDiscoveryScanHtml: `Click <strong>Scan</strong> to automatically discover Roku devices on your network. Devices with Developer Mode enabled will show a green "Dev" badge.`,
    deviceDiscoveryNoScanHtml: `<strong>Scan finds nothing?</strong> SSDP multicast (UDP port 1900) may be blocked by VPN, corporate Wi‑Fi, or firewall rules — try Manual Connect with the device IP. The PC and Roku must be on the same reachable network.`,
    deviceDiscoveryManual:
      'You can also manually connect by entering an IP address in the "Manual Connect" section at the bottom of the sidebar.',

    remoteControlHeading: 'Remote Control',
    remoteControlIntroHtml: `Use the virtual remote to control your Roku. Optional keyboard shortcuts are available when you turn on <strong>Settings → General → Roku Remote - Use Keyboard </strong> (off by default). They apply on the <strong>Remote</strong> tab (solo or device-performance quad layout) or the <strong>Dev App</strong> tab, only for the device tab you have open — not in other sections, text fields, or modals.`,
    remoteControlTabHtml: `On the <strong>Remote</strong> or <strong>Dev App</strong> tab, press <span class="help-kbd">Tab</span> from the remote controls (not from the section tabs or another text field) to jump to the <strong>Send Text</strong> field. <span class="help-kbd">Enter</span> sends from that field.`,
    remoteControlMediaHtml: `Media controls (Rewind, Play/Pause, Forward) and volume buttons are also available on the virtual remote. Use <strong>Send Text</strong> at the bottom to type text directly into the device's active text field.`,
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
    appsListHtml: `
            <li><strong>Custom Launch</strong> - Launch any app by ID, including TV inputs (HDMI 1-4)</li>
            <li><strong>Deep Link</strong> - Launch apps with specific content using deep linking (App ID, Content ID, Media Type)</li>
            <li><strong>Raw List of Apps</strong> - View the raw XML list of all installed apps</li>
          `,
    appsBody:
      'View all installed apps on your Roku device. Click any app to launch it. Use the search to filter apps by name.',

    queryHeading: 'Query',
    queryListHtml: `
            <li><strong>Device Queries</strong> - Presets for common queries like Device Info, Apps, Active App, Media Player, and more</li>
            <li><strong>Developer Queries</strong> - Advanced queries for dev-enabled devices (SG Nodes, Plugins, Frame Rate, Channel Perf, App State, Registry)</li>
            <li><strong>Custom Query</strong> - Enter any custom ECP endpoint</li>
          `,
    queryIntro: "Query device information using Roku's ECP endpoints:",
    queryResults:
      'Results are displayed in the Results panel below. POST endpoints (SGRendezvous tracking, FW Beacons) are also available.',

    devAppHeading: 'Dev App',
    devAppListHtml: `
            <li><strong>Auth</strong> - Enter and validate your Roku Developer password. Enable "Remember" to persist it across sessions</li>
            <li><strong>Sideload</strong> - Install .zip or .pkg channel packages</li>
            <li><strong>Remote</strong> - View the device's web installer page for additional dev options</li>
            <li><strong>Screenshot</strong> - Capture screenshots from your running Dev App</li>
            <li><strong>Delete</strong> - Remove the sideloaded channel</li>
          `,
    devAppIntro: 'For Developer Mode enabled devices:',
    devAppNote: "You'll need your Roku Developer password (set during Developer Mode setup).",

    consoleHeading: 'Console',
    consoleListHtml: `
            <li><strong>Connect / Disconnect</strong> - Establish or close the telnet connection</li>
            <li><strong>Find / Filter</strong> - Search through logs with options for case-sensitive, whole-word, and regex matching</li>
            <li><strong>Auto-scroll</strong> - Automatically scroll to the latest output</li>
            <li><strong>Copy / Save</strong> - Copy all logs to clipboard or save to a file</li>
            <li><strong>Clear</strong> - Clear the console output</li>
          `,
    consoleIntro: 'Connect to the BrightScript debug console via Telnet (port 8085):',
    consoleNote:
      'Requires Developer Mode enabled. Only one telnet connection can be active at a time per device.',

    appConnectorHeading: 'App Connector',
    appConnectorListHtml: `
            <li><strong>Connect</strong> - Establishes a socket connection to your running Dev App (default port <code>49200</code>)</li>
            <li><strong>Execute Function</strong> - Call custom functions exposed by your scene's <code>GetExternalControlFunctions</code></li>
            <li><strong>Response</strong> - View return values and debug output</li>
            <li><strong>Update Node</strong> - After running <em>Get Node by ID</em>, the response panel offers a node-update modal where you can <code>selectNode</code>, <code>setField</code>, or <code>removeField</code> on the matched node</li>
            <li><strong>RALE built-ins</strong> - The function dropdown also lists built-in RALE commands: <em>Get Node by ID</em>, <em>Get Node by SubType</em>, and a registry editor (<em>Get All Sections</em>, <em>Add/Update Section</em>, <em>Remove Section</em>, <em>Set / Edit / Remove Section Key</em>, <em>Clear All Sections</em>)</li>
          `,
    appConnectorFooterHtml: `Your Roku app must have TrackerTask integrated. Click <strong>Integration Guide</strong> in the App Connector tab for the BrightScript snippets and supported parameter types. Use <strong>Save TrackerTask.xml</strong> from the same modal to drop a ready-to-ship copy into your channel.`,
    appConnectorIntro:
      'Connect to Roku apps that implement the TrackerTask component for two-way communication:',

    actionScriptsHeading: 'Action Scripts',
    actionScriptsBuilderHtml: `<strong>Builder</strong> - Visually create action scripts action by action:`,
    actionScriptsBuilderListHtml: `
            <li><strong>Action Types</strong> - Keypress, Send Text, Launch App, Device Query, POST, Sideload, Delete Sideload, Screenshot, App Function, RALE Command, Device Performance capture, Wait, If</li>
            <li><strong>Variables (script v2)</strong> - Use a <em>Set Variable</em> step or <code>assignToVar</code> on Device Query / App Function / RALE Command to remember values, then reference them as <code>\${name}</code> in later step fields (text, params, deep-link content, etc.)</li>
            <li><strong>If / Else if / Else (script v2)</strong> - Branch on conditions sourced from <code>media-player</code> state, the active app, a RALE node field, or a stored variable; nest <em>If</em> steps for multi-step branches</li>
            <li><strong>Wait conditions</strong> - <em>Wait</em> can be a fixed <code>delayMs</code>, or wait until a condition becomes true: <em>media-player</em> state or <em>RALE node field</em> (poll <code>getNodeById</code> and compare a field with operators like <code>equals</code>, <code>contains</code>, <code>matches</code>, <code>hasAnyValue</code>) with optional <code>timeoutMs</code> and <code>pollIntervalMs</code></li>
            <li><strong>Device Performance step</strong> - Capture <em>CPU</em>, <em>memory</em>, <em>objects</em>, or <em>all</em> charts for the device this script runs on; the captured PNGs ship in run results / PDF export</li>
            <li><strong>Per-step help</strong> - The <em>?</em> control on each builder row opens a context-aware help modal for that action type</li>
            <li><strong>Action Management</strong> - Add, delete, reorder (drag & drop), copy, and paste actions</li>
            <li><strong>Copy / Paste</strong> - Copy an action with the copy control on each row. After copying, use <strong>Paste Step</strong> next to any <strong>Add Step</strong> row to insert at that position, or <span class="help-kbd">Ctrl</span>+<span class="help-kbd">V</span> to append at the end of the script</li>
            <li><strong>Import</strong> - Load an existing script from a JSON file</li>
            <li><strong>Undo / Redo</strong> - <span class="help-kbd">Ctrl</span>+<span class="help-kbd">Z</span> to undo, <span class="help-kbd">Ctrl</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">Z</span> to redo</li>
            <li><strong>JSON Preview</strong> - Live preview of the generated script. Copy or save the script to a file</li>
            <li><strong>Copy to Executor</strong> - Send the built script directly to the Executor for running</li>
          `,
    actionScriptsExecutorHtml: `<strong>Executor</strong> - Import, validate, and run action scripts:`,
    actionScriptsExecutorListHtml: `
            <li><strong>Import</strong> - Upload a JSON script file or paste script JSON, then validate</li>
            <li><strong>Run / Pause / Stop</strong> - Control execution with play, pause, and stop actions</li>
            <li><strong>Skip / Unskip</strong> - Toggle individual actions to skip during execution</li>
            <li><strong>Reorder</strong> - Drag and drop to reorder actions before running</li>
            <li><strong>Results</strong> - View detailed results for each action, including inline screenshots and captured performance charts</li>
            <li><strong>Copy / Save Results</strong> - Copy results to clipboard or save as PDF (PDF embeds screenshots and chart cards)</li>
            <li><strong>Connect to Console</strong> - Optionally auto-connect to the debug console during runs</li>
          `,
    actionScriptsDevPasswordHtml: `<strong>Developer Password</strong> - Actions like Screenshot, Sideload, and Delete Sideload require a developer password. The password is resolved in order: action-level <code>"password"</code> → script-level <code>"devPassword"</code> → password from the Dev App Auth section. If none is found, you'll be prompted during validation.`,
    actionScriptsSaveFolderHtml: `<strong>Save Folder</strong> - The default save folder lives under <strong>Settings → Action Scripts → Default folder</strong>. Per run you can pick another folder. Artifacts (screenshots, performance chart PNGs, exported PDFs) land in a timestamped subfolder, created only when something is actually produced.`,
    actionScriptsAiAgentsHtml: `<strong>AI Agents</strong> - Action Scripts you build in the Builder can also be authored by AI agents through the MCP server (see the <em>AI Agents (MCP)</em> section below); the agent's script always lands in the Builder for human review before running.`,
    actionScriptsIntro:
      'Automate sequences of device actions using JSON-based scripts. Two views are available:',

    devicePerformanceHeading: 'Device Performance (Remote Section)',
    devicePerformanceIntroHtml: `Toggle <strong>Show Device Performance</strong> on the Remote Section to expand a quad with live charts:`,
    devicePerformanceListHtml: `
            <li><strong>CPU usage</strong>, <strong>system memory</strong>, and <strong>BrightScript object</strong> charts (count or memory view where available)</li>
            <li>Charts reflect the running app — for representative readings, the device should have <strong>Developer Mode</strong> on and your <strong>sideloaded Dev channel</strong> in the foreground</li>
            <li><strong>Settings → Device Performance</strong> tunes chart sample interval and history window; turn on <strong>Remember 'Show Device Performance'</strong> to restore the quad layout per device between sessions</li>
            <li>Inside Action Scripts, <strong>Device Performance</strong> steps capture chart cards into run results (and PDF export)</li>
          `,

    networkInspectorHeading: 'Network Inspector',
    networkInspectorIntroHtml: `Inspect the HTTP(S) traffic your Dev channel makes. Roku Dev Studio runs a local <strong>MITM proxy</strong> that decrypts dev-channel HTTPS routed through it, so you can see full request/response headers and bodies.`,
    networkInspectorGettingStartedHtml: `<strong>Getting started</strong>`,
    networkInspectorGettingStartedListHtml: `
            <li>Enable the <strong>MITM proxy</strong> in <strong>Settings → Network Inspector</strong>, then have your dev channel route its requests through the proxy address shown — use <code>host:port</code> (e.g. <code>192.168.1.50:8888</code>). How the channel applies that proxy is up to your app's networking code.</li>
            <li>Optional <strong>Hotspot Capture</strong> records SNI/DNS metadata for all of the device's traffic; it needs OS packet-capture access (macOS BPF, Windows Npcap). Settings → Network Inspector walks through the per-platform setup.</li>
          `,
    networkInspectorToolbarHtml: `<strong>Toolbar</strong> (top-right of the panel): <strong>Start/Stop Capture</strong>, <strong>Panes Layout</strong> (stack vs. side-by-side request/response), and <strong>Configure Traffic Rules</strong>.`,
    networkInspectorToolbarListHtml: `
            <li><strong>Session list</strong> - Filter with <code>host:</code>, <code>method:</code>, <code>status:</code>, <code>type:</code>, <code>kind:</code>, <code>path:</code> (separate terms with commas for OR); group by host; toggle <em>Proxied</em> to hide hotspot-only metadata. Jump-to-error and scroll-to-latest shortcuts appear when relevant.</li>
            <li><strong>Inspect</strong> - View request / response overview, headers, and bodies (JSON / XML / raw). <strong>Copy</strong> a body, or export the transaction as <strong>cURL</strong> or <strong>HAR</strong>.</li>
            <li><strong>Save .pcap</strong> - Export the device's captured packets; <strong>Clear</strong> empties the session list.</li>
          `,
    networkInspectorTrafficRulesHtml: `<strong>Traffic Rules</strong> (the gear in the toolbar) shape this device's proxied traffic; changes take effect immediately:`,
    networkInspectorTrafficRulesListHtml: `
            <li><strong>Block all proxied traffic</strong> - Reject every proxied request. This wins over per-host rules and the device throttle.</li>
            <li><strong>Device throttle</strong> - Cap bandwidth and/or add latency for every proxied request. Pick a preset or type a custom value (e.g. <code>3 Mbps</code>, <code>1500 kbps</code>).</li>
            <li><strong>Per-host rules</strong> - Add a <strong>hostname</strong> to target every request to that host, or a <strong>host + path</strong> (e.g. <code>api.example.com/v1/play</code>) to target only that path. Each rule can <em>Block</em>, <em>Reset</em> the connection (simulate a network failure), <em>Mock</em> a canned response (status / Content-Type / delay / body), and/or throttle.</li>
            <li><strong>Wildcards</strong> - Use <code>*</code> in the host or path to match more than one target. <code>*.example.com</code> covers every subdomain (e.g. lower <em>and</em> prod environments in one rule), and <code>/v1/*/play</code> matches any path under <code>/v1</code>. A pattern without <code>*</code> keeps the old behavior (a bare host also matches its subdomains).</li>
            <li><strong>Edit a rule</strong> - Click the pencil on a rule to change its intercept URL in place (host or host/path); press Enter to apply or Escape to cancel.</li>
            <li><strong>Rewrite</strong> - Unlike Block / Reset / Mock (which stop the request), rewrite rules let the request go through with edits applied. Add ops on the <em>request</em> (redirect host — "map remote" a prod URL to staging/localhost, set path, add/remove query params or headers, find/replace in the body) and/or the <em>response</em> (override status, add/remove headers, find/replace in the body — gzip/br responses are decoded, edited, and re-sent). Body find/replace supports plain text or a regex, and applies to textual bodies only.</li>
            <li><strong>Bounds</strong> - A host can't be faster than the device's bandwidth cap, and its latency can't drop below the device latency floor.</li>
          `,
    networkInspectorLocalOnly: 'Network Inspector is available for locally connected devices.',

    aiAgentsHeading: 'AI Agents (MCP)',
    aiAgentsIntroHtml: `Roku Dev Studio ships an <strong>MCP (Model Context Protocol)</strong> server so AI agents in Cursor, Claude Desktop, or VS Code can drive a real device through this app:`,
    aiAgentsListHtml: `
            <li><strong>Settings → MCP Server</strong> - Toggle a client to add or remove its <code>roku-dev-studio</code> MCP entry; other entries in that client's MCP config are left untouched</li>
            <li><strong>Two surfaces</strong> - Direct device ops for one-shot actions (<code>keypress</code>, <code>launch_app</code>, <code>screenshot</code>, <code>app_function</code>, <code>rale_command</code>, telnet …) and <strong>Action Scripts</strong> for multi-step / conditional flows that drop into the Builder for review</li>
            <li><strong>Toasts</strong> - Destructive agent actions (launch, sideload, delete sideload, screenshot, destructive RALE commands) show a non-blocking toast in the app so you always see what the agent did</li>
            <li><strong>Passwords stay local</strong> - Sideload / screenshot / delete-sideload reuse the password the device panel remembered; the agent never has to send one</li>
          `,
    aiAgentsBridge:
      'The bridge starts automatically when the app is open and shuts down on quit. If an agent reports the bridge is offline, just bring this app to the foreground.',

    fiddleHeading: 'BrightScript Fiddle',
    fiddleIntroHtml: `Open via <strong>File → Open Fiddle</strong> (<span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">B</span>) or the <em>Open Fiddle</em> button on the Query tab.`,
    fiddleListHtml: `
            <li><strong>Editor</strong> - Monaco editor with BrightScript highlighting and live <em>BrighterScript</em> linting; the Run button is disabled while errors are present</li>
            <li><strong>Run</strong> - Wraps your snippet into a minimal SceneGraph channel, sideloads it on the selected device, and streams the BrightScript debug console (8085) into the Fiddle window's terminal</li>
            <li><strong>Stop / window close</strong> - Removes the Fiddle channel from the device automatically</li>
          `,
    fiddleNote:
      "Requires a Developer Mode-enabled device with a known Dev Password (use the Dev App tab once to remember it, or you'll be prompted in Fiddle).",

    logViewerHeading: 'Log File Viewer',
    logViewerBodyHtml: `<strong>File → Open Log File</strong> (<span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">O</span>) opens a saved console / log file in a dedicated window with the same find / structured-log / URL-detection chrome as the live Console tab. Handy for reviewing logs from a previous session or a teammate.`,

    secretScreensHeading: 'Secret Screens',
    secretScreensBodyHtml: `The <em>Secret Screens</em> link (Remote Section and the Query tab footer) opens a modal listing the standard Roku key sequences for hidden settings — <strong>Developer Settings</strong>, <strong>Secret Screen 1/2/3</strong>, <strong>Wi-Fi Info</strong>, <strong>Channel Info</strong>, <strong>Reboot</strong>, etc. Click a sequence to send the keypresses to the connected device.`,

    settingsHeading: 'Settings',
    settingsIntroHtml: `Open with <span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">,</span> or <em>Roku Dev Studio → Settings</em> (macOS) / <em>File → Settings</em> (Windows / Linux). Five sections:`,
    settingsListHtml: `
            <li><strong>General</strong> - Developer Mode, Privacy Mode (mask IPs / serials), Debug Logging to file, Roku Remote - Use Keyboard, Auto Connect to Devices, Auto Hide Sidebar, Encrypt Saved Passwords (status line shows whether the OS keychain is really encrypting — on some Linux setups it is not)</li>
            <li><strong>Action Scripts</strong> - Default folder for run artifacts (screenshots, exported PDFs)</li>
            <li><strong>Device Performance</strong> - Chart sample interval, chart history window, Remember 'Show Device Performance' per device</li>
            <li><strong>Timing &amp; Network</strong> - Connection / query / telnet timeouts and other network knobs (with Reset to Defaults)</li>
            <li><strong>MCP Server</strong> - Toggle <code>roku-dev-studio</code> in your AI client(s) so agents can drive the device through this app</li>
          `,

    remoteLocationsHeading: 'Remote Locations',
    remoteLocationsListHtml: `
            <li><strong>Setup</strong> - Run the Roku Relay Server on a Mac Mini at the remote location</li>
            <li><strong>Add Location</strong> - Click "Add" in the Remote Locations section to configure a connection</li>
            <li><strong>Server Address</strong> - Enter the IP Address or Hostname of the relay server</li>
            <li><strong>Default Port</strong> - The relay server runs on port <code>4951</code> by default</li>
          `,
    remoteLocationsServerHtml: `The relay server can be found in the <code>remote-server</code> folder. See the README for setup instructions (macOS LaunchAgent, Linux systemd, Windows Task Scheduler).`,
    remoteLocationsTroubleshootHtml: `<strong>Sideload or screenshot fails via relay but ECP works?</strong> Update the relay host to the same <code>roku-dev-studio-api</code> version as this app. Check <code>GET /health</code> on the relay (<code>apiVersion</code> field) and ensure port <code>4951</code> is reachable through firewalls.`,
    remoteLocationsIntro: 'Control Roku devices at Remote Locations via a Relay Server:',

    sideloadRelayHeading: 'Sideload Relay',
    sideloadRelayIntroHtml: `Sideload one build to <strong>many devices at once</strong>. When the relay is on, Roku Dev Studio advertises itself as a Roku on your network: point your IDE (VS Code BrightScript / roku-deploy / Eclipse) or a browser at this machine, upload once, and RDS fans the build out — <em>install → launch → console</em> — to every targeted device, local or at a remote location.`,
    sideloadRelayEnableHtml: `<strong>Enable it</strong> in <strong>Settings → Sideload Relay</strong> (off by default). Two prerequisites gate the toggle:`,
    sideloadRelayEnableListHtml: `
            <li><strong>Relay Dev Password</strong> - The password your IDE authenticates to RDS with (user <code>rokudev</code>), exactly like a real Roku's developer password. This is separate from each target device's own dev password.</li>
            <li><strong>Setup Devices</strong> - Open the device-setup modal and enable at least one reachable, Developer Mode-enabled device. It lists local and remote (relay-location) devices; enable the ones that should receive every build. Devices without a saved dev password show <strong>🔒 Set Password</strong> to validate one inline. Previously-targeted devices that go offline stay listed (disabled) and rejoin automatically when reachable again.</li>
          `,
    sideloadRelayPointHtml: `<strong>Point your IDE at RDS.</strong> With the relay enabled, RDS is discoverable over SSDP as <em>"Roku Dev Studio Relay"</em>, or you can set your build host to this machine's IP directly. On <em>Sideload</em> / <em>Debug: Launch</em>, the IDE uploads to RDS on port <code>80</code> and RDS handles the fan-out. A themed upload web page is also served at the relay address (<code>http://&lt;this-machine&gt;/</code>) for drag-and-drop <code>.zip</code> sideloads from a browser.`,
    sideloadRelayAutoConnectHtml: `<strong>Auto-connect.</strong> When a build lands successfully on a target, RDS opens that device as a connected tab and attaches its debug console automatically, so you see per-device output without extra clicks. Live fan-out progress also streams as a status console on telnet port <code>8085</code>.`,
    sideloadRelaySourceApprovalHtml: `<strong>Source approval.</strong> A sideload originating from this machine proceeds automatically. A sideload from a different machine holds the upload and shows an allow/deny prompt on the RDS host (auto-denies after 30s); browser uploads from a remote machine additionally require logging in with the Relay Dev Password.`,
    sideloadRelayFooterHtml: `Requires the targeted devices to have Developer Mode enabled. See <strong>Remote Locations</strong> above for targeting devices at another site through a relay server.`,

    tipsHeading: 'Tips',
    tipDeveloperModeHtml: `Enable Developer Mode on your Roku: Go to Home, press <span class="help-kbd">Home</span> 3x, <span class="help-kbd">↑</span> 2x, <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span>`,
    tipMacosHtml: `<strong>macOS:</strong> closing the main window quits the app (telnet and MCP sessions are torn down). Use <em>Roku Dev Studio → Quit</em> or <span class="help-kbd">Cmd</span>+<span class="help-kbd">Q</span> — the app does not stay in the dock with no windows.`,
    tipWindowsLinuxHtml: `<strong>Windows / Linux:</strong> use the title-bar menu (☰) for Settings, Privacy Mode, and About; window min/max/close buttons are on the right edge of the title bar.`,
    tipMultipleDevices: 'Multiple devices can be connected simultaneously - each gets its own tab',
    tipClickCard: 'Click a connected device card to switch to its tab',
    tipRightClick: 'Right-click device cards to copy device info',
    tipRemoteLocations: 'Remote locations allow you to control devices without physical access',
  },
} as const;

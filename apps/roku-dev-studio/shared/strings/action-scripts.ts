/**
 * UI strings for Action Scripts (Builder, step fields, Executor, Import modal,
 * shared actions list, and the per-step Help modal).
 *
 * Parametrized strings are functions returning the composed text (interpolation
 * without a runtime format library). Help-modal body values contain inline HTML
 * (they are assigned via `setSafeHTML`); any dynamic values interpolated into
 * them are HTML-escaped at the call site before being passed in.
 */
export const actionScripts = {
  // ── Builder: step-type option (legacy) ──
  legacyPluginsMemoryOption: 'Plugins / Memory (Legacy JSON)',

  // ── Builder: per-step field labels / placeholders / prompts ──
  labelQuery: 'Query',
  labelEndpoint: 'Endpoint',
  optionCustom: 'Custom...',
  labelSystemTelnetCommand: 'Command (legacy type — use Device Query for new steps)',
  labelKey: 'Key',
  optionSelectKey: '-- Select key --',
  labelText: 'Text',
  placeholderTextToSend: 'Text to send',
  labelAppId: 'App ID',
  labelParamsOptional: 'Params (optional)',
  labelFilePath: 'File Path',
  placeholderPastePathOrChoose: 'Paste path or Choose file',
  titleFilePathZip: 'Path to .zip package. Paste here or use Choose File.',
  chooseFileTitle: 'Choose File (.zip)',
  chooseFileAria: 'Choose File',
  chooseFileBtn: 'Choose File',
  labelPassword: 'Password',
  placeholderDevPassword: 'Dev Password',
  optionConnectAppConnectorFirst: 'Connect App Connector first',
  labelFunction: 'Function',
  labelSetVarOptional: 'Set Var (optional)',
  placeholderVarExample: 'e.g. varX',
  titleVarNameRules: 'Letters, Digits, Underscore; start with letter or _',
  noParameters: 'No Parameters',
  selectAFunction: 'Select a Function',
  labelCommand: 'Command',
  labelParameters: 'Parameters',
  labelLabelOptional: 'Label (optional)',
  placeholderScreenshotLabel: 'e.g. After Login',
  labelWaitBeforeMs: 'Wait Before (ms)',
  labelWaitAfterMs: 'Wait After (ms)',
  placeholderWaitAfterDefault: '1500 (default)',
  titleWaitAfter:
    'Time to wait after triggering capture before first download. Increase if image is truncated or UI is slow (e.g. HUD).',
  optionChooseChart: 'Choose Chart…',
  labelChart: 'Chart',
  placeholderPerfLabel: 'e.g. After Navigation',
  waitModeFixedDelay: 'Fixed Delay (ms)',
  waitModeUntilCondition: 'Until Condition',
  labelWaitType: 'Wait Type',
  labelDelayMs: 'Delay (ms)',
  labelSource: 'Source',
  labelState: 'State',
  optionSelectState: '-- Select State --',
  labelTimeoutMs: 'Timeout (ms)',
  labelPollIntervalMs: 'Poll Interval (ms)',
  labelPathJsonArray: 'Path (JSON array)',
  labelNodeId: 'Node ID',
  labelFieldName: 'Field Name',
  labelOperator: 'Operator',
  placeholderFieldInFieldList: 'Field in FieldList',
  placeholderCompareString: 'Compare string',
  placeholderCompareValue: 'Compare Value',
  caseInsensitive: 'Case-insensitive',
  labelConditionSource: 'Condition Source',
  labelAttribute: 'Attribute',
  placeholderActiveAppValue: 'e.g. dev, 837, YouTube',
  labelVariablePath: 'Variable Path',
  labelPost: 'POST',
  optionSelectPost: '-- Select POST --',
  noExtraFields: 'No extra fields for this type.',

  // Chart option labels (shared: Builder dropdown, list Details, Executor descriptions)
  chartObjects: 'BrightScript Objects',
  chartCpu: 'CPU Usage',
  chartMemory: 'System Memory',
  chartAboveAll: 'Above All',

  // Condition / wait source labels (shared)
  sourceMediaPlayer: 'Media Player',
  sourceActiveApp: 'Active App',
  sourceRaleNodeField: 'RALE Node Field',
  sourceVariables: 'Variables',

  // Value-with-operator label (Builder compare cells)
  valueWithOperator: (op: string): string => `Value (${op})`,

  // ── Shared actions list view (Builder + Executor) ──
  branchThen: 'Then',
  branchElse: 'Else',
  dragToReorder: 'Drag to reorder',
  columnType: 'Type',
  columnDetails: 'Details',
  addStep: 'Add Step',
  pasteStepBtn: 'Paste Step',
  pasteActionTooltip: 'Paste copied action here',
  ariaThenBranchPrefix: 'Then branch. ',
  ariaElseBranchPrefix: 'Else branch. ',
  copyActionTooltip: 'Copy action',
  removeActionTooltip: 'Remove Action',
  skipBtn: 'Skip',
  skipActionTooltip: 'Skip this Action',
  skipActionAria: 'Skip Action',
  unskipBtn: 'Unskip',
  runActionTooltip: 'Run this Action',
  unskipActionAria: 'Unskip Action',
  emptyNoScript:
    'No script loaded. Click <strong>Import Action Script</strong> above to import a script, or use the <strong>Builder</strong> tab to create one.',
  stepRowAria: (num: string, type: string, details: string): string =>
    `Action ${num}: ${type}${details ? ', ' + details : ''}. Click to edit.`,

  /** Row header / error line: "Action <id>: <text>" */
  actionLabel: (id: string, text: string): string => `Action ${id}: ${text}`,

  // ── Builder chrome + toasts + import messages ──
  helpTooltip: (label: string, detail: string): string => `Help: ${label}${detail}`,
  addActionBtn: 'Add Action',
  updateStepHeading: (n: number): string => `Update Step ${n}`,
  updateActionBtn: 'Update Action',
  toastActionPasted: 'Action pasted',
  toastCannotMoveIntoOwnBranch: 'Cannot move a step into its own If branch.',
  toastActionCopied: 'Action copied',
  toastChooseChartType: 'Choose a chart type for Device Performance.',
  toastUpdatedAction: (n: number): string => `Updated Action #${n}`,
  copiedFeedback: 'Copied!',
  copyActionScriptBtn: 'Copy Action Script',
  savedFeedback: 'Saved!',
  saveActionScriptBtn: 'Save Action Script',
  saveModalNameLabel: 'Name',
  saveModalNamePlaceholder: 'e.g. Launch and Play',
  saveModalNameRequired: 'Enter a name.',
  saveModalOverwriteWarning: (name: string): string =>
    `A saved script named "${name}" already exists.`,
  saveModalOverwriteConfirm: 'Overwrite',
  saveModalSavedListLabel: 'Saved Scripts',
  saveModalNoSavedScripts: 'No saved scripts',
  toastSaveFailed: 'Failed to save the script.',
  viewerHeading: 'View and Manage Action Scripts',
  viewerSaveAs: 'Save As…',
  viewerApplyToDevice: 'Apply to Device',
  viewerApply: 'Apply',
  viewerRescan: 'Rescan',
  viewerNoDevices: 'No devices found',
  viewerCopySuffix: 'copy',
  viewerDeleteConfirm: (name: string): string => `Delete the saved script "${name}"?`,
  viewerNoDeviceNote: 'Connect a device in the main window for live App Connector and RALE function names.',
  viewerEmpty: 'No saved scripts yet — save one from a device tab’s Action Scripts builder.',
  msgNoScriptJson: 'No script JSON to load.',
  invalidJson: (detail: string): string => `Invalid JSON: ${detail}`,
  msgStepsArray: 'Script must have a "steps" array.',
  msgValidation: (lines: string): string => `Validation:\n${lines}`,

  // ── index.ts toasts (user-visible; MCP-bridge/agent error strings are left in place) ──
  toastBuilderNotAvailable: 'Builder is not available on this tab.',
  toastLoadedInBuilder: 'Loaded in Builder',
  toastAiAgentLoaded: 'AI Agent loaded a Script into the Builder',
  toastCouldNotLoadScript: 'Could not load script',
  toastNoScriptInExecutor: 'No script JSON in Executor to load.',
  toastAddNonEmptySteps: 'Add a non-empty "steps" array to the script JSON first.',
  toastOpenedInBuilder: 'Opened in Builder',

  // ── Shared RALE preflight errors (Executor + Import) ──
  errDevAppRequired:
    'The Roku Developer Application must be launched to establish an App Connector connection. Please open the Developer Application on your Roku device (or launch your sideloaded channel from the Dev App tab), then try again.',
  errRaleConnection:
    'The tool could not establish an App Connector connection. Ensure your Dev App is running with Developer Mode on and the correct port is set in the App Connector tab, then try again. The script cannot be executed until a connection is available.',

  // ── Executor engine: full-sentence user-facing errors ──
  errScreenshotPassword:
    'Developer Password required for Screenshot. Specify it in the script (devPassword) or enter it during validation.',
  errScreenshotDevApp:
    'Screenshot requires the Developer App to be active. Launch your sideloaded channel from the Dev App tab first.',
  errDevicePerformanceInRds:
    'Device Performance is only available when running Action Scripts in Roku Dev Studio.',

  // ── Executor UI ──
  runBtnPause: 'Pause Execution',
  runBtnResume: 'Resume Execution',
  runBtnRun: 'Run Action Script',
  emptyNoActions:
    '<strong>No actions loaded</strong><br><br>Use <strong>Import Action Script</strong> above to paste or upload a JSON script, then click <strong>Validate and Import</strong> in the modal to load actions here.',
  noFolderSelected: 'No folder selected',
  resultsPlaceholder: 'Validate and Run to see results.',
  waiting: 'Waiting…',
  statusOk: '✓ OK',
  statusFailed: '✗ Failed',
  statusFailedPlain: 'Failed',
  statusSkipped: 'Skipped',
  altScreenshot: 'Screenshot',
  altDevicePerformanceChart: 'Device Performance Chart',
  validating: 'Validating…',
  errPasteOrUpload: 'Paste or upload a script (JSON).',
  errMissingAppFunctions: (list: string): string =>
    `The following App Function(s) are not available from the app: ${list}. Ensure your channel exposes these functions (or remove these steps from the script), then try again.`,
  expectedSuffix: (values: string): string => `\n   expected: ${values}`,
  errFileNotFound: (path: string): string => `File not found: ${path}`,
  statusValid: '✓ Valid',
  usingDevPasswordFromAuth: '(using Dev Password from Auth)',
  switchedTabRunPaused:
    'Switched tab — Run is paused. Come back to Action Scripts to resume (if JSON is unchanged), or use Import → Validate and Import.',
  scriptChangedNeedsValidation:
    'Script changed or needs validation — use Import Action Script → Validate and Import, or change JSON and validate.',
  scriptChangedClickValidate: 'Script changed — click Validate.',
  connectingToAppConnector: 'Connecting to App Connector...',
  runStarted: (runId: string, count: number): string =>
    `Run started (${runId}) — ${count} action${count === 1 ? '' : 's'}`,
  errDevicePerformanceUnavailable:
    'Device performance is not available for this device. Open the Remote Section (with metrics) or reconnect the device.',
  errorLine: (message: string): string => `Error: ${message}`,
  runStopped: 'Run Stopped.',
  runCompleted: 'Run Completed.',
  copyResultsTitle: 'Copy Results',
  saveResultsTitle: 'Save Results as PDF',

  // ── validator.ts parse errors ──
  noScriptContent: 'No Script Content',
  scriptEmpty: 'Script is Empty',
  invalidJsonShort: 'Invalid JSON',

  // ── Import modal ──
  msgStepsArrayNoDot: 'Script must have a "steps" array',
  errInvalidScriptObject: 'Invalid Script: must be an Object',
  importModalTitle: 'Import Action Script',
  importIntoBuilderTitle: 'Import Script into Builder',
  validateAndLoadBtn: 'Validate and Load',
  validateAndImportBtn: 'Validate and Import',
  errCannotVerifyPassword: 'Cannot verify password: Device connection not available.',
  errVerificationFailed: 'Verification Failed',
  errCouldNotDetermineDevice:
    'Could not determine Device for import. Close the modal and open Import again from this Device tab.',
  errInvalidScript: 'Invalid Script',
  errSaveFolderRequired:
    'Save folder is required for this Script (e.g. Screenshot step). Please choose a save folder.',
  errDevPasswordRequired: 'Developer password is required and not in cache or script. Enter it below.',
  verifyingPassword: 'Verifying Password…',
  errAuthFailed: 'Authentication Failed. Please check your password and try again.',
  errPasswordVerificationFailed: 'Password Verification Failed.',
  errValidationFailed: 'Validation failed',
  errVerificationOrValidationFailed: 'Verification or validation failed',
  errFailedToReadFile: 'Failed to read file',

  // ── Step Help modal: subtitles + title ──
  helpSubCustomEndpoint: 'Custom Endpoint',
  helpSubSelectPost: 'Select a POST',
  helpSubFixedDelay: 'Fixed Delay',
  helpUntilCondition: (srcLabel: string): string => `Until condition · ${srcLabel}`,
  helpSubSelectCommand: 'Select a Command',
  helpSubSelectKey: 'Select a Key',
  helpSubSelectCommandShort: 'Select Command',
  helpSystemTelnetTitle: 'Plugins / Memory (Legacy)',
  helpNoText: (type: string): string => `No help text for “${type}”.`,

  // ── Step Help modal: variant bodies (inline HTML) ──
  helpBodyQueryCustom: `
    <p>
      <strong>Custom</strong> lets you type any Device Query path yourself: a normal <code>/query/…</code> ECP GET, or
      dev-style values such as <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Use this when there is no preset for the endpoint you need. The value is sent as-is to the same query machinery as presets.</p>
  `,
  helpBodyQueryTelnetPlugins: `
    <p>
      Runs the developer <strong>plugins</strong> telnet command (packed channel list / plugin summary). This is the
      same data as choosing the Plugins preset in older flows, expressed as a query preset.
    </p>
    <p>Requires developer access to the device (same as other dev-plugin queries).</p>
  `,
  helpBodyQueryTelnetFree: `
    <p>
      Runs the developer <strong>free</strong> telnet command (memory / heap style snapshot). Use it when you need a
      quick memory readout during a script.
    </p>
  `,
  helpBodyPostNone: `
    <p>Choose one of the <strong>POST</strong> presets (SGRendezvous, FW Beacons, etc.). Each option maps to a fixed path on the device.</p>
  `,
  helpBodyWaitDelay: `
    <p>
      Pauses the script for the given number of <strong>milliseconds</strong> with no polling. Use after animations,
      launches, or any step where you only need a fixed pause.
    </p>
  `,
  helpBodyWaitMediaPlayer: `
    <p>
      Polls <code>/query/media-player</code> until the player’s <strong>state</strong> matches your selection (play,
      pause, buffer, …) or the <strong>timeout</strong> elapses.
    </p>
    <p>
      Tune <strong>Poll interval</strong> to balance responsiveness vs load. If the condition never becomes true, the
      step fails when the timeout is reached.
    </p>
  `,
  helpBodyWaitRale: `
    <p>
      Polls via <strong>RALE</strong> until a field on a scene node matches the comparison (operator + value). You must
      supply path (JSON array), node id, field name, and timing fields.
    </p>
    <p>
      Requires an App Connector connection at run time. Operators like <code>exists</code> / <code>notExists</code> may
      hide the value field—see the form labels for the active mode.
    </p>
  `,
  helpBodyIfMediaPlayer: `
    <p>
      Evaluates the current <strong>media player</strong> state once and runs either the <strong>then</strong> or
      <strong>else</strong> branch. Pick the expected state (play, pause, …) to branch on.
    </p>
    <p>Unlike <strong>Wait</strong>, there is no polling: the condition is checked a single time when the step runs.</p>
  `,
  helpBodyIfActiveApp: `
    <p>
      Compares one attribute from <code>/query/active-app</code> (app id, type, version, name) using the operator and
      value you set. Useful for branching when a specific channel is foregrounded.
    </p>
  `,
  helpBodyIfRale: `
    <p>
      One-shot check of a <strong>RALE node field</strong> (path, node id, field, operator, value). Same shape as the
      RALE side of a Wait condition, but evaluated once for branching.
    </p>
  `,
  helpBodyIfVariables: `
    <p>
      Compares a value stored in a <strong>script variable</strong> (from a previous RALE Command or App Function assign)
      using the variable path and operator you configure.
    </p>
    <p>Requires script version 2 and earlier steps that populate the variable.</p>
  `,
  helpBodyRaleNone: `
    <p>Select a <strong>RALE command</strong> from the list. Parameters and optional “Set Var” appear after a command is chosen.</p>
  `,
  helpBodyAppFunctionNone: `
    <p>
      Connect <strong>App Connector</strong> so your channel’s exported functions appear in the list, then pick a
      function to see its parameters.
    </p>
  `,
  helpBodyKeypressNone: `
    <p>Pick a <strong>remote key</strong> from the grouped list. The script sends that key over ECP when the step runs.</p>
  `,
  helpBodySystemTelnetNone: `
    <p>Choose <strong>Plugins</strong> or <strong>Memory</strong> for this legacy step, or migrate to Device Query with the matching telnet presets.</p>
  `,
  helpBodySystemTelnetPlugins: `
    <p>Legacy telnet <strong>plugins</strong> command. Prefer <strong>Device Query</strong> with preset <code>telnet:plugins</code> for new scripts.</p>
  `,
  helpBodySystemTelnetFree: `
    <p>Legacy telnet <strong>free</strong> (memory) command. Prefer <strong>Device Query</strong> with preset <code>telnet:free</code> for new scripts.</p>
  `,

  // ── Step Help modal: per-action fallback bodies (inline HTML) ──
  helpFallbackQuery: `
    <p>
      Runs a read against the device: either a normal <strong>ECP GET</strong> on a <code>/query/…</code> path or a
      dev-style endpoint such as <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Choose a preset for common endpoints, or <strong>Custom</strong> to type your own.</p>
  `,
  helpFallbackPost: `
    <p>
      Sends an <strong>HTTP POST</strong> to the Roku on a fixed analytics / beacon path. Each preset maps to a
      specific endpoint used in development workflows.
    </p>
  `,
  helpFallbackKeypress: `
    <p>
      Sends a <strong>remote control key</strong> over ECP. The help title reflects which key is currently selected when
      you open this dialog.
    </p>
  `,
  helpFallbackInputText: `
    <p>
      Sends <strong>keyboard-style text</strong> to the device (ECP input entry). The focused field or on-screen
      keyboard receives the characters.
    </p>
  `,
  helpFallbackLaunch: `
    <p>
      Launches a channel by <strong>app ID</strong>. Optional <strong>params</strong> can supply a Deep-Link or launch
      arguments depending on the channel.
    </p>
  `,
  helpFallbackSideload: `
    <p>
      Uploads a package from the <strong>file path</strong> and installs it as the sideloaded developer channel. Supply a
      developer password on the step or via script <code>devPassword</code> when required.
    </p>
  `,
  helpFallbackDeleteSideload: `
    <p>Removes the sideloaded developer channel. Optional password matches your device’s dev security settings.</p>
  `,
  helpFallbackAppFunction: `
    <p>
      Calls a <strong>BrightScript function</strong> over App Connector. The subtitle shows the <strong>selected
      function</strong>. Parameters match the channel’s exported signature; use <strong>Set Var</strong> to capture a
      return value for later steps.
    </p>
  `,
  helpFallbackRaleCommand: `
    <p>
      Runs a <strong>built-in RALE command</strong>. The subtitle shows the selected command; extended copy comes from
      the command’s built-in description when available.
    </p>
  `,
  helpFallbackDevicePerformance: `
    <p>
      Snapshots <strong>Device Performance</strong> charts for the <strong>same device</strong> this script runs on (the
      same connection as Device Query and keypress). Values follow the Remote Section history settings when live polling has
      filled the charts; otherwise the step waits briefly for a fresh sample when needed.
    </p>
    <h4>Chart</h4>
    <p>
      <strong>BrightScript Objects</strong>, <strong>CPU Usage</strong>, <strong>System Memory</strong>, or
      <strong>Above All</strong> (one combined result: CPU, then memory, then objects). CPU and memory are driven from the
      same channel performance poll.
    </p>
    <h4>Optional label</h4>
    <p>Shown in the results header, similar to the screenshot step.</p>
  `,
  helpFallbackScreenshot: `
    <p>
      Captures the TV image through the <strong>Developer App</strong>. The Developer App should be active; a
      developer password must be available on the step, script, or validation prompt.
    </p>
    <h4>Wait before (ms)</h4>
    <p>
      Pause in the executor <strong>before</strong> capture starts so the UI can settle (default 100 ms when you add
      the step).
    </p>
    <h4>Wait after (ms)</h4>
    <p>
      After triggering capture, the executor waits before downloading <code>dev.jpg</code>. Increase if images are
      truncated; empty uses <strong>1500 ms</strong> default.
    </p>
    <h4>Optional label</h4>
    <p>Helps identify this capture in run output when a script takes multiple screenshots.</p>
  `,
  helpFallbackWait: `
    <p>
      Either a <strong>fixed delay</strong> or <strong>until a condition</strong> holds. The subtitle reflects the
      current wait type and, for conditions, the data source (media player vs RALE node field).
    </p>
  `,
  helpFallbackIf: `
    <p>
      Branches into <strong>then</strong> / <strong>else</strong> step lists using a one-shot condition. The subtitle
      reflects the selected condition source (media player, active app, RALE field, or variables). Requires script
      version 2.
    </p>
  `,
  helpFallbackSystemTelnet: `
    <p>
      <strong>Legacy</strong> telnet-only step. Prefer <strong>Device Query</strong> with <code>telnet:plugins</code> or
      <code>telnet:free</code> for new scripts.
    </p>
  `,

  // ── Step Help modal: composed / interpolated body fragments (dynamic values pre-escaped) ──
  helpQueryPresetBody: (label: string, endpoint: string): string => `
    <p>
      Runs a <strong>Device Query</strong> for <strong>${label}</strong> using endpoint
      <code>${endpoint}</code>.
    </p>
    <p>
      Like all queries, this uses ECP (or the app’s dev-plugin path for telnet-style presets). The device must be
      reachable on the network.
    </p>
  `,
  helpPostPresetBody: (label: string, endpoint: string): string => `
    <p>
      Sends an HTTP <strong>POST</strong> to <code>${endpoint}</code> (<strong>${label}</strong>).
    </p>
    <p>Use this for analytics / beacon flows that expect POST rather than GET.</p>
  `,
  helpSelectedFunction: (fn: string): string =>
    `<p><strong>Selected function:</strong> <code>${fn}</code></p>`,
  helpAppFunctionDescription: (desc: string): string =>
    `<p><strong>App Function Description:</strong> ${desc}</p>`,
  helpAppFunctionArgs:
    '<p>Argument rows follow the App Connector metadata for this function; complex types use JSON in the field.</p>',
  helpCurrentKey: (nice: string, key: string): string => `
        <p>
          <strong>Current key:</strong> ${nice} (<code>${key}</code>) — sent as a standard ECP
          keypress when the step runs.
        </p>
      `,

  // ── Builder: additional field placeholders / option fallbacks ──
  placeholderQueryEndpoint: '/query/… or telnet:plugins / telnet:free',
  placeholderVariablePathExample: 'myVar or data.items.0.id',
  optionUnknownFunction: 'unknown',

  // ── Executor: step descriptions (stepDescription; result-card header + list rows) ──
  descQuery: (endpoint: string): string => `Query ${endpoint}`,
  descKeypress: (key: string): string => `Keypress ${key}`,
  descSendText: (text: string): string => `Send text "${text}"`,
  descLaunchApp: (appId: string): string => `Launch app ${appId}`,
  descSideload: (filename: string): string => `Sideload ${filename}`,
  descDeleteSideload: 'Delete sideload',
  descAppFunction: (fn: string): string => `App Function ${fn}`,
  descScreenshot: 'Screenshot',
  descScreenshotLabel: (label: string): string => `Screenshot (${label})`,
  descScreenshotWaitAfter: (ms: number): string => `Screenshot (wait after: ${ms}ms)`,
  descDevicePerformance: (chart: string): string => `Device Performance — ${chart}`,
  descDevicePerformanceLabel: (label: string, chart: string): string =>
    `Device Performance (${label}) — ${chart}`,
  descWait: 'Wait',
  descWaitWithDetails: (details: string): string => `Wait · ${details}`,
  descIf: 'If (…)',
  descIfWithDetails: (details: string): string => `If · ${details}`,

  // ── Executor: wait-step Details column (formatWaitStepListDetails) ──
  waitDetailFixedDelay: (delayMs: number): string => `Fixed Delay ${delayMs} ms`,
  waitDetailTiming: (maxSec: number, pollMs: number): string =>
    ` · max ${maxSec}s · poll ${pollMs}ms`,
  waitDetailMediaPlayerState: (state: string): string => `Media player · until state "${state}"`,
  waitDetailMediaPlayerCheck: (check: string): string => `Media player · until ${check}`,
  waitDetailRale: (line: string): string => `RALE Node Field · ${line}`,
  waitDetailRaleIncomplete: 'RALE Node Field · (incomplete)',
  waitDetailGenericSource: (src: string): string => `Wait · source ${src}`,

  // ── Executor: if-step Details column (formatIfStepListDetails) ──
  ifDetailMediaPlayerState: (state: string): string => `Media player · state "${state}"`,
  ifDetailMediaPlayerCheck: (check: string): string => `Media player · ${check}`,
  ifDetailRale: (line: string): string => `RALE Node Field · ${line}`,
  ifDetailRaleEmpty: 'RALE Node Field · …',
  ifDetailVariable: (path: string): string => `Variable · $${path}`,
  ifDetailVariableEmpty: 'Variable · …',
  ifDetailActiveApp: (attr: string): string => `Active App · ${attr}`,
  ifDetailActiveAppEmpty: 'Active App · …',

  // ── Executor: results-panel progress log lines (onLog) ──
  logWaitingMs: (ms: number): string => `Waiting ${ms} ms...`,
  logWaitingBeforeCapture: (ms: number): string => `Waiting ${ms} ms before capture...`,
  logPollingFieldMet: (elapsed: number, field: string): string =>
    `Polling... (${elapsed}s) — field "${field}" — condition met`,
  logPollingField: (elapsed: number, field: string, value: string): string =>
    `Polling... (${elapsed}s) — field "${field}": ${value}`,
  logPollingStatusMet: (elapsed: number, status: string): string =>
    `Polling... (${elapsed}s) — ${status} — condition met`,
  logPollingStatus: (elapsed: number, status: string): string =>
    `Polling... (${elapsed}s) — ${status}`,
  pollValueEmpty: '(empty)',
  pollValueReconnecting: '(reconnecting...)',
  pollValueNoResponse: '(no response)',
  pollStateValue: (state: unknown): string => `state: ${state}`,
  pollStateNone: 'state: (none)',
  pollInvalidMediaPlayer: 'Invalid media-player response',
  pollQueryFailed: (err: string): string => `Query failed: ${err}`,
  pollNoResponse: 'No Response',
  logConnectingTelnet: 'Connecting to Telnet (port 8080)...',
  logQueryUsesDevTelnet: (ep: string, cmd: string): string =>
    `Device Query "${ep}" uses dev Telnet "${cmd}" (same as the Query tab).`,
  logPartialPerformance: 'Some performance sections were unavailable; partial snapshot.',

  // ── Executor: step result summaries (onLog) ──
  stepSummaryChars: (n: number): string => `→ ${n} chars`,
  stepSummaryOk: '→ OK',
  stepSummarySentKey: (key: string): string => `→ sent ${key}`,
  stepSummarySent: '→ sent',
  stepSummaryLaunched: (appId: string): string => `→ launched ${appId}`,
  stepSummarySideloadComplete: '→ sideload complete',
  stepSummaryDeleted: '→ deleted',
  stepSummarySaveFailed: (err: string): string => `→ save failed: ${err}`,
  stepSummarySavedAs: (filename: string): string => `→ saved as ${filename}`,
  stepSummaryCapturedNoFolder: '→ captured (no save folder)',
  stepSummaryChartImages: (n: number): string => `→ ${n} chart image(s)`,
  stepSummaryCaptured: '→ captured',
  stepSummarySkipped: (reason: string): string => `→ skipped (${reason})`,

  // ── Executor: step errors / skip reasons (result.error / skippedReason) ──
  errWaitTimeout: 'Wait timeout',
  errStopped: 'Stopped',
  skipReasonNoAppConnector: 'App Connector not available',
  errNoAppConnectorRaleWait: 'App Connector not available for RALE Node wait',
  errUnknownActionType: (type: string): string => `Unknown action type: ${type}`,
  errInvalidRaleCommand: 'Invalid RALE command',
  errTelnetNotAvailable: 'Telnet system commands are not available in this context',
  errSaveNotAvailable: 'Save not available',
  errCouldNotVerifyDevApp: (err: string): string =>
    `Could not verify Dev App status before screenshot: ${err}`,
  errInvalidPath: 'Invalid path',
  errStepPreorderMismatch: 'Internal error: step preorder mismatch',

  // ── Settings: Action Script default-folder picker (main process) ──
  pickDefaultFolderTitle: 'Default folder for Action Script output'
} as const;

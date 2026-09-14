"use strict";

// shared/ipc/channels.ts
var IPC = {
  // App updater
  UpdaterCheck: "updater:check",
  UpdaterDownload: "updater:download",
  UpdaterInstall: "updater:install",
  /** Renderer asks main to fetch latest GitHub release title/body/url (avoids renderer CORS/CSP issues). */
  UpdaterLatestReleaseInfo: "updater:latest-release-info",
  /** Main → renderer: push updater status (checking / available / not-available / downloading / ready / error). */
  UpdaterStatus: "updater:status",
  // About
  AboutGetInfo: "about:getInfo",
  AboutCopy: "about:copy",
  AboutOpenExternal: "about:openExternal",
  // Settings window (modal)
  /** Main renderer asks to open the Settings window, optionally navigated to a section. */
  SettingsOpen: "settings:open",
  SettingsWindowGetState: "settings-window:get-state",
  SettingsWindowSave: "settings-window:save",
  SettingsWindowPickFolder: "settings-window:pick-folder",
  /** Renderer requests destroying the Settings BrowserWindow after close animation. */
  SettingsWindowClose: "settings-window:close",
  /** Settings renderer signals its initial getState() population is done, so main can show the
   *  window fully-rendered instead of on ready-to-show (avoids a toggle/section-populate flash). */
  SettingsWindowReady: "settings-window:ready",
  /** Settings window asks main to open a detected MCP client's config file in the default editor (falls back to revealing in folder). */
  SettingsWindowOpenMcpConfig: "settings-window:open-mcp-config",
  /** Settings window probes a remote location's Network Inspector capability + current config. */
  SettingsWindowRemoteNetworkProbe: "settings-window:remote-network-probe",
  /** Settings window applies Network Inspector config to a remote location. */
  SettingsWindowRemoteNetworkSetConfig: "settings-window:remote-network-set-config",
  AppSettingsUpdated: "app-settings-updated",
  /** Renderer pushes its current state (selected device, App Connector Functions) to main for the MCP bridge to expose. */
  McpBridgeReportState: "mcp-bridge:report-state",
  /** Main asks the renderer to drop an Action Script into the Builder of the active device tab. */
  McpBridgeDropScript: "mcp-bridge:drop-script",
  /** Main acks the drop result back to whoever initiated it (the bridge). */
  McpBridgeDropScriptResult: "mcp-bridge:drop-script-result",
  /** Main asks the renderer to run a read-only RALE command (e.g. getNodeById) using the active App Connector session. */
  McpBridgeRaleRequest: "mcp-bridge:rale-request",
  /** Renderer relays the RALE command result back to main. */
  McpBridgeRaleResult: "mcp-bridge:rale-result",
  /** Main asks the renderer to fetch the current channel's App Connector Function list (borrow-and-disconnect when needed). */
  McpBridgeFunctionsRequest: "mcp-bridge:functions-request",
  /** Renderer relays the function-list result back to main. */
  McpBridgeFunctionsResult: "mcp-bridge:functions-result",
  /** Main asks the renderer to open a device tab for `connect_device` requests. */
  McpBridgeConnectRequest: "mcp-bridge:connect-request",
  /** Renderer relays the connect result back to main. */
  McpBridgeConnectResult: "mcp-bridge:connect-result",
  /** Generic renderer-routed tool call (RALE writes, telnet send, App Connector connect, …). */
  McpBridgeToolRequest: "mcp-bridge:tool-request",
  /** Renderer relays the generic tool result back to main. */
  McpBridgeToolResult: "mcp-bridge:tool-result",
  /** Main broadcasts an agent-initiated action so the renderer can surface it as a toast. */
  McpBridgeAgentAction: "mcp-bridge:agent-action",
  /** Main broadcasts an agent-captured screenshot so the matching device tab's screenshot pane can render it. */
  McpBridgeAgentScreenshot: "mcp-bridge:agent-screenshot",
  /** Main asks the renderer for the Dev Password remembered for a device serial (localStorage). */
  McpBridgeStoredPasswordRequest: "mcp-bridge:stored-password-request",
  /** Renderer returns remembered password (or omits it) for a prior stored-password request. */
  McpBridgeStoredPasswordResult: "mcp-bridge:stored-password-result",
  // Roku local
  RokuDiscover: "roku:discover",
  RokuScanSubnet: "roku:scan-subnet",
  RokuDeviceFound: "roku:device-found",
  RokuTestConnection: "roku:test-connection",
  RokuGetIcon: "roku:get-icon",
  RokuGetDeviceHardwareImage: "roku:get-device-hardware-image",
  RokuKeypress: "roku:keypress",
  RokuLaunch: "roku:launch",
  RokuQuery: "roku:query",
  RokuPost: "roku:post",
  RokuInputText: "roku:input-text",
  RokuDeeplink: "roku:deeplink",
  RokuSelectSideloadFile: "roku:select-sideload-file",
  RokuResolveSideloadFile: "roku:resolve-sideload-file",
  RokuSideload: "roku:sideload",
  RokuDeleteSideload: "roku:delete-sideload",
  RokuReboot: "roku:reboot",
  RokuCheckUpdate: "roku:check-update",
  RokuScreenshot: "roku:screenshot",
  RokuVerifyDevAuth: "roku:verify-dev-auth",
  RokuSaveScreenshot: "roku:save-screenshot",
  /** Persists a renderer-held screenshot `data:` URL (canvas frame-grab / agent-driven capture —
   *  paths with no device-written file already) to a temp file, so the session gallery can hold a
   *  lightweight `file://` reference instead of the full base64 string for the life of the tab. */
  PersistScreenshotDataUrl: "roku:persist-screenshot-data-url",
  /** Deletes one screenshot temp file — used when a session-gallery entry is cleared (single/all)
   *  or its device tab disconnects, so a capture's temp file doesn't outlive its own history entry.
   *  Renderer-supplied path, so the handler restricts deletion to `os.tmpdir()` (see
   *  `RokuSaveScreenshot`'s identical guard). */
  DeleteScreenshotTempFile: "roku:delete-screenshot-temp-file",
  RokuRaleWake: "roku:rale-wake",
  RokuRaleConnect: "roku:rale-connect",
  RokuRaleCommand: "roku:rale-command",
  RokuRaleDisconnect: "roku:rale-disconnect",
  RokuRaleStatus: "roku:rale-status",
  RaleDisconnected: "rale-disconnected",
  ShowContextMenu: "show-context-menu",
  ClipboardWrite: "clipboard:write",
  ShellOpenExternal: "shell:open-external",
  IsDebugEnabled: "is-debug-enabled",
  OpenLogFile: "open-log-file",
  /** Opens an arbitrary previously-saved file with the OS default app (toast "Open" button). */
  OpenFile: "open-file",
  /** Diagnostic build only — opens the userData folder containing all log files. */
  IsDiagnosticBuild: "is-diagnostic-build",
  OpenDiagnosticLogFolder: "open-diagnostic-log-folder",
  /**
   * Console scrollback spill — disk-backed history beyond the in-memory cap.
   *
   * Per-tab session: renderer calls `Start` once on Connect to get a handle,
   * `Append` per scrollback trim to write the dropped entries to disk, `Read`
   * once when the user scrolls near the top of the in-memory buffer (so we
   * can prepend the spilled history into the visible model), `Clear` on the
   * Clear button or tab teardown. Cleanup on `will-quit` is handled in the
   * main-process module without an IPC round-trip.
   *
   * File format: NDJSON, one entry per line. Each line is a JSON object with
   * compact keys (`t`, `ty`, `st?`) so the file stays parseable end-to-end
   * even when an individual log line contains an embedded newline (the
   * embedded `\n` is escaped inside the JSON string).
   */
  ConsoleSpillStart: "console-spill:start",
  ConsoleSpillAppend: "console-spill:append",
  ConsoleSpillRead: "console-spill:read",
  ConsoleSpillClear: "console-spill:clear",
  /**
   * Windowed load: renderer asks main to index the file (encoding-aware line
   * offsets) and answers with `{ lineCount, encoding, fileSize, fileName }`.
   * The renderer then pulls only the byte range around the viewport via
   * `LogViewerReadRange` / `LogViewerReadLines`, so the whole file never lives
   * in the renderer heap. The scrollbar spans the full file (`lineCount`); the
   * resident window slides as the user scrolls. Full-file Find/Filter run in
   * main via `LogViewerSearch`. See `main/log-file-index.ts`.
   */
  LogViewerPrepare: "log-viewer:prepare",
  /** Renderer → main (invoke): decode a *contiguous* line range
   *  `{ startLine, endLine }` (half-open). Answers `{ text, startLine, endLine }`.
   *  Used for the normal (unfiltered) sliding window. */
  LogViewerReadRange: "log-viewer:read-range",
  /** Renderer → main (invoke): decode a set of *scattered* line numbers
   *  `{ lines: number[] }` (used by Filter mode, whose visible lines are not
   *  contiguous in the file). Answers `{ lines: Array<{ line, text }> }`. */
  LogViewerReadLines: "log-viewer:read-lines",
  /** Renderer → main (invoke): full-file search. Payload
   *  `{ query, options: { case, word, regex } }`. Answers
   *  `{ hits: Array<{ line, start, end }>, matchLines: number[], truncated }`.
   *  `hits` drive Find highlight/nav (capped); `matchLines` is the ordered set
   *  of matching line numbers Filter mode collapses the file down to. A newer
   *  Search invoke supersedes any in-flight scan for the same window. */
  LogViewerSearch: "log-viewer:search",
  /** Renderer → main (invoke): scan the whole file for recognized BrightScript issues (the Console
   *  Monitor findings) and answer `{ success, findings?, scannedLines?, error? }`, where `findings`
   *  is the shared `ConsoleFindings` shape. Runs whole-file in main (like `LogViewerSearch`) so the
   *  windowed renderer never has to hold the file resident. */
  LogViewerFindings: "log-viewer:findings",
  /**
   * Standalone Network Session Viewer window. `NetSessionViewerLoad` (renderer → main, invoke)
   * parses the file the window was opened with (native `.rds-network-inspector.json` bundle, HAR
   * 1.2, or `.pcap`) into `ParsedNetworkEvent[]` and answers
   * `{ success, fileName, format, events, deviceIps, error }`. Network captures are small relative to
   * logs, so the whole parsed session is returned at once — no windowed paging like the log viewer.
   */
  NetSessionViewerLoad: "net-session-viewer:load",
  RokuSaveTrackerTask: "roku:save-tracker-task",
  RokuSaveTextFile: "roku:save-text-file",
  RokuSaveBinaryFile: "roku:save-binary-file",
  RokuCopyImage: "roku:copy-image",
  RokuActionScriptShowSaveFolder: "roku:action-script-show-save-folder",
  RokuActionScriptWriteFile: "roku:action-script-write-file",
  RokuActionScriptShowSaveScriptDialog: "roku:action-script-show-save-script-dialog",
  RokuActionScriptCheckFileExists: "roku:action-script-check-file-exists",
  // App-managed Action Scripts library (userData/action-scripts/index.json + scripts/<id>.json)
  RokuActionScriptsList: "roku:action-scripts-list",
  RokuActionScriptsRead: "roku:action-scripts-read",
  RokuActionScriptsSave: "roku:action-scripts-save",
  RokuActionScriptsDelete: "roku:action-scripts-delete",
  // "View and Manage Action Scripts" window shows its OWN device picker. The main window's renderer
  // owns device state, so the viewer fetches/rescans the device list through a request/reply relay
  // via the main process, then applies the script to the chosen device on the main window.
  RokuActionScriptGetDeviceOptions: "roku:action-script-get-device-options",
  RokuActionScriptRescanDeviceOptions: "roku:action-script-rescan-device-options",
  ActionScriptRequestDeviceOptions: "action-script:request-device-options",
  ActionScriptProvideDeviceOptions: "action-script:provide-device-options",
  RokuActionScriptApplyToDevice: "roku:action-script-apply-to-device",
  ActionScriptApplyToDeviceOnMain: "action-script:apply-to-device-on-main",
  RokuReadFileAsBase64: "roku:read-file-as-base64",
  /** Crop a region of the invoking `WebContents` (CSS / DIP rect) to PNG (Device Performance quad cards). */
  RokuCaptureViewRect: "roku:capture-view-rect",
  RokuSaveResultsPdf: "roku:save-results-pdf",
  RemoteDiscover: "remote:discover",
  RemoteDevicesCached: "remote:devices-cached",
  RemoteHealth: "remote:health",
  RemoteCapabilities: "remote:capabilities",
  RemoteNetworkStatus: "remote:network-status",
  RemoteNetworkGetConfig: "remote:network-get-config",
  RemoteNetworkSetConfig: "remote:network-set-config",
  RemoteNetworkEvents: "remote:network-events",
  RemoteNetworkEventDetail: "remote:network-event-detail",
  RemoteNetworkClear: "remote:network-clear",
  RemoteNetworkSetupCapture: "remote:network-setup-capture",
  // Live SSE relay from the remote server's /network/stream — one connection per serverUrl,
  // reference-counted across every device panel pointed at that server (mirrors the
  // RemoteTelnetConnect/Disconnect lease model below). Forwarded events land on the same
  // NetworkInspector* push channels the local engine uses, tagged { isRemote: true, serverUrl }.
  RemoteNetworkStreamConnect: "remote:network-stream-connect",
  RemoteNetworkStreamDisconnect: "remote:network-stream-disconnect",
  RemoteNetworkSetEventNote: "remote:network-set-event-note",
  RemoteNetworkGetTrafficRules: "remote:network-get-traffic-rules",
  RemoteNetworkSetDeviceTrafficRules: "remote:network-set-device-traffic-rules",
  RemoteNetworkReplayRequest: "remote:network-replay-request",
  RemoteNetworkFind: "remote:network-find",
  RemoteNetworkSetRecording: "remote:network-set-recording",
  RemoteNetworkExportPcap: "remote:network-export-pcap",
  RemoteNetworkGetCaInfo: "remote:network-get-ca-info",
  RemoteNetworkExportCaPem: "remote:network-export-ca-pem",
  RemoteNetworkExportCaCert: "remote:network-export-ca-cert",
  RemoteDeviceInfo: "remote:device-info",
  RemoteKeypress: "remote:keypress",
  RemoteLaunch: "remote:launch",
  RemoteQuery: "remote:query",
  RemotePost: "remote:post",
  RemoteInputText: "remote:input-text",
  RemoteDeeplink: "remote:deeplink",
  RemoteGetIcon: "remote:get-icon",
  RemoteScreenshot: "remote:screenshot",
  RemoteVerifyDevAuth: "remote:verify-dev-auth",
  RemoteSideload: "remote:sideload",
  RemoteSideloadUpload: "remote:sideload-upload",
  RemoteDeleteSideload: "remote:delete-sideload",
  RemoteRaleWake: "remote:rale-wake",
  RemoteRaleConnect: "remote:rale-connect",
  RemoteRaleCommand: "remote:rale-command",
  RemoteRaleDisconnect: "remote:rale-disconnect",
  TelnetConnect: "telnet:connect",
  TelnetDisconnect: "telnet:disconnect",
  TelnetSend: "telnet:send",
  TelnetStatus: "telnet:status",
  TelnetConnected: "telnet:connected",
  TelnetData: "telnet:data",
  TelnetError: "telnet:error",
  TelnetDisconnected: "telnet:disconnected",
  RemoteTelnetConnect: "remote:telnet-connect",
  RemoteTelnetDisconnect: "remote:telnet-disconnect",
  RemoteTelnetSend: "remote:telnet-send",
  RemoteTelnetStatus: "remote:telnet-status",
  RemoteTelnetClearBuffer: "remote:telnet-clear-buffer",
  RemoteTelnetSystemConnect: "remote:telnet-system-connect",
  RemoteTelnetSystemDisconnect: "remote:telnet-system-disconnect",
  RemoteTelnetSystemSend: "remote:telnet-system-send",
  RemoteTelnetSystemStatus: "remote:telnet-system-status",
  RemoteTelnetSystemPollData: "remote:telnet-system-poll-data",
  TelnetSystemConnect: "telnet-system:connect",
  TelnetSystemDisconnect: "telnet-system:disconnect",
  TelnetSystemSend: "telnet-system:send",
  TelnetSystemStatus: "telnet-system:status",
  TelnetSystemData: "telnet-system:data",
  // BrightScript socket-based debugger (debug protocol, control port 8081).
  // Invoke (renderer → main):
  DebuggerAttach: "debugger:attach",
  DebuggerDetach: "debugger:detach",
  DebuggerContinue: "debugger:continue",
  DebuggerPause: "debugger:pause",
  DebuggerStepOver: "debugger:step-over",
  DebuggerStepIn: "debugger:step-in",
  DebuggerStepOut: "debugger:step-out",
  DebuggerStackTrace: "debugger:stacktrace",
  DebuggerVariables: "debugger:variables",
  DebuggerAddBreakpoints: "debugger:add-breakpoints",
  DebuggerExecute: "debugger:execute",
  DebuggerStatus: "debugger:status",
  /** Scan the device's last debug-sideloaded .zip source for STOP statements. */
  DebuggerScanStops: "debugger:scan-stops",
  DebuggerRestart: "debugger:restart",
  /** Remove breakpoints by file:line (prunes the main-process cache too, so a deleted one can't resurrect). */
  DebuggerRemoveBreakpointsByLocation: "debugger:remove-breakpoints-by-location",
  // Push (main → debugger window):
  DebuggerState: "debugger:state",
  DebuggerStopped: "debugger:stopped",
  DebuggerOutput: "debugger:output",
  DebuggerRuntimeError: "debugger:runtime-error",
  DebuggerCompileErrors: "debugger:compile-errors",
  /** Main → windows: breakpoints verified/errored by the device (async). */
  DebuggerBreakpoints: "debugger:breakpoints",
  /** Main → windows: a (debug-enabled) device was just (re)sideloaded — reattach. */
  DebuggerReattach: "debugger:reattach",
  // Remote debugger — the session runs on the remote RDS server (real network access to the
  // device); these proxy each request over HTTP. Push events reuse the local Debugger* channels
  // above (tagged { isRemote: true, serverUrl } by the relay) rather than duplicating them.
  // DebuggerScanStops has no remote equivalent — it reads the local sideload .zip already on
  // the Electron host's disk, which is identical for a local or remote sideload target.
  RemoteDebuggerAttach: "remote:debugger-attach",
  RemoteDebuggerDetach: "remote:debugger-detach",
  RemoteDebuggerStatus: "remote:debugger-status",
  RemoteDebuggerContinue: "remote:debugger-continue",
  RemoteDebuggerPause: "remote:debugger-pause",
  RemoteDebuggerStepOver: "remote:debugger-step-over",
  RemoteDebuggerStepIn: "remote:debugger-step-in",
  RemoteDebuggerStepOut: "remote:debugger-step-out",
  RemoteDebuggerStackTrace: "remote:debugger-stacktrace",
  RemoteDebuggerVariables: "remote:debugger-variables",
  RemoteDebuggerAddBreakpoints: "remote:debugger-add-breakpoints",
  RemoteDebuggerRemoveBreakpointsByLocation: "remote:debugger-remove-breakpoints-by-location",
  RemoteDebuggerExecute: "remote:debugger-execute",
  RemoteDebuggerRestart: "remote:debugger-restart",
  RemoteDebuggerStreamConnect: "remote:debugger-stream-connect",
  RemoteDebuggerStreamDisconnect: "remote:debugger-stream-disconnect",
  SettingsGet: "settings:get",
  SettingsSet: "settings:set",
  SettingsDelete: "settings:delete",
  /** Encrypted secret store (developer passwords) — backed by Electron `safeStorage`. */
  SecretsStatus: "secrets:status",
  SecretsGetAll: "secrets:get-all",
  SecretsSetPassword: "secrets:set-password",
  SecretsDeletePassword: "secrets:delete-password",
  /** Main → renderer: a device password was saved elsewhere (e.g. Sideload Relay); update the in-memory cache. */
  SecretsPasswordUpdated: "secrets:password-updated",
  SecretsMigrateLegacy: "secrets:migrate-legacy",
  SecretsClearAll: "secrets:clear-all",
  GetDeveloperMode: "get-developer-mode",
  SetDeveloperMode: "set-developer-mode",
  DeveloperModeChanged: "developer-mode-changed",
  /** Whether verbose logging is forced on by the `RDS_DEBUG`/`RDS_NI_DEBUG`-style env flags (read once at startup). */
  GetVerboseDebug: "get-verbose-debug",
  GetPrivacyMode: "get-privacy-mode",
  SetPrivacyMode: "set-privacy-mode",
  PrivacyModeChanged: "privacy-mode-changed",
  /** Renderer → main: current persisted language preference ('system' | locale code), so a
   *  window opened while a non-default locale is active can apply it on load. */
  GetLocale: "get-locale",
  /** Renderer → main: persist a language preference ('system' | locale code), rebuild the
   *  menu, and fan the change out to every window. */
  SetLocale: "set-locale",
  /** Main → all renderers: the language preference changed; each window re-resolves and
   *  retranslates in place (no reload). Payload is the preference string. */
  LocaleChanged: "locale-changed",
  DebugLoggingChanged: "debug-logging-changed",
  /** Main → main window: an uncaught exception/rejection fired in the main process. Payload is
   *  `{ message, stack, timestamp }` — shown in the same crash-report modal renderer errors use. */
  MainProcessError: "main-process-error",
  /** Any window → main: app version + OS platform/release, for the crash-report modal's
   *  Environment section. */
  GetAppInfo: "get-app-info",
  /** Main → all renderers: a live op against this device IP just failed at the connection level
   *  (ECP request, Telnet socket, …) — a hint to re-check reachability *now* rather than wait for
   *  the next scheduled poll. NOT itself a verdict: the renderer must still run the real
   *  `checkDeviceConnection` probe and only flip offline on that check's own result, since an
   *  isolated service failure (e.g. a crashed channel dropping Telnet) doesn't mean the device
   *  itself is unreachable. */
  DeviceConnectionSuspect: "device-connection-suspect",
  /** Win/Linux title-bar hamburger → main-process menu actions. */
  AppMenuAction: "app-menu:action",
  ShowAboutDialog: "show-about-dialog",
  /** @deprecated Native popup removed — renderer draws the hamburger menu. */
  ShowHamburgerMenu: "show-hamburger-menu",
  /** Frameless main window — custom title bar (Windows / Linux). */
  MainWindowMinimize: "main-window:minimize",
  MainWindowToggleMaximize: "main-window:toggle-maximize",
  MainWindowClose: "main-window:close",
  IsMainWindowMaximized: "main-window:is-maximized",
  MainWindowMaximizeChanged: "main-window:maximize-changed",
  /** Main → renderer: webContents zoom factor changed (menu Cmd+/-/0,
   * Ctrl+wheel, or initial load). Renderer mirrors it into the
   * `--app-zoom` CSS variable so the frameless title bar can stay at a
   * constant screen-pixel size — macOS-drawn traffic lights and the
   * Windows/Linux custom controls don't scale with content zoom and
   * collide with content otherwise. */
  AppZoomChanged: "app:zoom-changed",
  /** Renderer → main: request a zoom step from the title-bar zoom indicator
   * (`-` / `+` buttons). Payload: `{ direction: 'in' | 'out' | 'reset' }`.
   * Main re-uses the same `applyZoomFactor` path as the View > Zoom menu
   * so clamp + broadcast stay centralized; the renderer is told the new
   * factor via `AppZoomChanged` and updates its `--app-zoom` + the
   * indicator label from there. */
  AppZoomChange: "app:zoom-change",
  /** BrightScript Fiddle — standalone window (editor + terminal) */
  FiddleOpen: "fiddle:open",
  FiddleReady: "fiddle:ready",
  FiddleInit: "fiddle:init",
  FiddleLint: "fiddle:lint",
  FiddleGetSymbols: "fiddle:get-symbols",
  FiddleRun: "fiddle:run",
  FiddleStop: "fiddle:stop",
  FiddleRunResult: "fiddle:run-result",
  FiddleTerminalData: "fiddle:terminal-data",
  FiddleTerminalCleared: "fiddle:terminal-cleared",
  FiddleDevicesUpdate: "fiddle:devices-update",
  FiddleRefreshDevices: "fiddle:refresh-devices",
  /** Main renderer pushes its current device snapshot to main (main re-broadcasts to fiddle windows). */
  FiddlePushDevices: "fiddle:push-devices",
  /** Main process asks main renderer to wipe a device's stored password (auth failed upstream). */
  FiddleClearPasswordRequest: "fiddle:clear-password-request",
  /** Main renderer pushes scan status (spinner state) to open Fiddle windows. */
  FiddleScanStatus: "fiddle:scan-status",
  /** "Try Demo App" — sideload the bundled Roku Dev Studio Showcase channel
   * to a device chosen in the main window's own modal (no separate window). */
  DemoAppLaunch: "demo-app:launch",
  /** Settings window's "Demo App" button (shown when the titlebar button is off) asks main to
   * open the picker in the main window; main relays it over `DemoAppOpenOnMain`. */
  DemoAppRequestOpen: "demo-app:request-open",
  DemoAppOpenOnMain: "demo-app:open-on-main",
  /** Network Inspector — hotspot traffic capture (local devices). */
  NetworkInspectorGetStatus: "network-inspector:get-status",
  NetworkInspectorGetEvents: "network-inspector:get-events",
  NetworkInspectorGetEventDetail: "network-inspector:get-event-detail",
  /** Set/clear the session-scoped user note for a captured event (in-memory side map). */
  NetworkInspectorSetEventNote: "network-inspector:set-event-note",
  /** "Find in content" — search URL/headers/bodies across a device's captured transactions. */
  NetworkInspectorFind: "network-inspector:find",
  NetworkInspectorClearEvents: "network-inspector:clear-events",
  NetworkInspectorSetRecording: "network-inspector:set-recording",
  NetworkInspectorExportPcap: "network-inspector:export-pcap",
  NetworkInspectorApplySettings: "network-inspector:apply-settings",
  NetworkInspectorStatus: "network-inspector:status",
  NetworkInspectorCaptureEvents: "network-inspector:capture-events",
  NetworkInspectorDeviceJoined: "network-inspector:device-joined",
  NetworkInspectorDeviceLeft: "network-inspector:device-left",
  NetworkInspectorDeviceDiscovered: "network-inspector:device-discovered",
  NetworkInspectorClientsCleared: "network-inspector:clients-cleared",
  NetworkInspectorGetCaInfo: "network-inspector:get-ca-info",
  NetworkInspectorExportCaPem: "network-inspector:export-ca-pem",
  NetworkInspectorExportCaCert: "network-inspector:export-ca-cert",
  NetworkInspectorInstallBpfAccess: "network-inspector:install-bpf-access",
  NetworkInspectorGetTrafficRules: "network-inspector:get-traffic-rules",
  NetworkInspectorSetDeviceTrafficRules: "network-inspector:set-device-traffic-rules",
  /**
   * Replay / Edit & Resend — re-issue a captured HTTP transaction FROM THE RDS HOST (renderer →
   * main, invoke). Request: `{ deviceIp: string; input: { method: string; url: string;
   * headers?: Record<string,string>; body?: string; bodyEncoding?: 'text'|'base64' };
   * applyTrafficRules?: boolean; timeoutMs?: number }`. Response: `{ success: true; event:
   * ParsedNetworkEvent } | { success: false; error: string }`. The returned `event` carries
   * `mitm: true` + `replay: true` and is ALSO pushed over NetworkInspectorCaptureEvents (the invoke
   * return just lets the renderer select the new row immediately). One-click Replay bypasses active
   * traffic rules; Compose opts in via `applyTrafficRules`.
   */
  NetworkInspectorReplayRequest: "network-inspector:replay-request",
  /** Map Local — open a native file picker so a mock rule can serve a local file as its response body. */
  NetworkInspectorPickMockFile: "network-inspector:pick-mock-file",
  /**
   * Sideload Relay — RDS impersonates a Roku dev server on `/plugin_install`,
   * accepts one build from the IDE, and fans it out (install → launch →
   * console) to many devices. Gated by `sideloadRelayEnabled` (default off).
   */
  SideloadRelayGetStatus: "sideload-relay:get-status",
  /** Returns a renderer-safe view of the current config (targets + flags, NO passwords). */
  SideloadRelayGetConfig: "sideload-relay:get-config",
  /** Persist relay config (targets/flags) and re-boot the service. Passwords go via the secret-store IPC. */
  SideloadRelayApplySettings: "sideload-relay:apply-settings",
  /** Discover LAN devices and return them as candidate targets to seed the list. */
  SideloadRelaySeedTargets: "sideload-relay:seed-targets",
  /** Validate a device's dev password (local or remote) and, on success, save it for the relay. */
  SideloadRelayValidatePassword: "sideload-relay:validate-password",
  /** Reveal the saved Relay Dev Password (for the settings "show password" eye toggle). */
  SideloadRelayRevealPassword: "sideload-relay:reveal-password",
  /** Add or remove a single device from the relay's target list (the Device Info modal's shortcut — Settings' Setup Devices modal uses ApplySettings instead). */
  SideloadRelayToggleDevice: "sideload-relay:toggle-device",
  /** Main → renderer, broadcast to every window: config (targets/flags) changed, from
   *  either save path (Settings' Setup Devices modal, or the Device Info modal's toggle) —
   *  so whichever surface is open picks it up live instead of only on next open. */
  SideloadRelayConfigChanged: "sideload-relay:config-changed",
  /** Main → renderer, broadcast: a device was dropped from the relay's target list because
   *  its dev password was just deleted (from ANY surface — Dev App, sideloading, Action
   *  Scripts import, …), not just an explicit relay action. The main window toasts this. */
  SideloadRelayDeviceRemoved: "sideload-relay:device-removed",
  /** Main → renderer: relay bind/lifecycle status changed. */
  SideloadRelayStatus: "sideload-relay:status",
  /** Main → renderer: a new upload was accepted and fan-out started. */
  SideloadRelayRunStarted: "sideload-relay:run-started",
  /** Main → renderer: per-device fan-out result update. */
  SideloadRelayResult: "sideload-relay:result",
  /** Static Channel Analysis — standalone window wrapping Roku's own `sca-cmd` CLI
   *  (fetched at runtime, never bundled — see main/static-analysis/sca-tool-manager.ts). */
  StaticAnalysisEnsureTool: "static-analysis:ensure-tool",
  /** Invoke (get current) and push (main → renderer on change) share this one channel. */
  StaticAnalysisToolStatus: "static-analysis:tool-status",
  StaticAnalysisCheckJava: "static-analysis:check-java",
  StaticAnalysisChooseFile: "static-analysis:choose-file",
  StaticAnalysisRun: "static-analysis:run",
  StaticAnalysisCancelRun: "static-analysis:cancel-run",
  /** Main → renderer: streamed stdout/stderr while a run is in progress. */
  StaticAnalysisProgress: "static-analysis:progress",
  /** Main → renderer: terminal outcome of a run (report JSON, or raw output + error). */
  StaticAnalysisRunResult: "static-analysis:run-result",
  /** Files dropped onto the main window: open each in its associated viewer
   *  (Log Viewer / Network Session Viewer), skipping unsupported ones. */
  OpenDroppedFiles: "main-window:open-dropped-files",
  /** Roku Cloud Emulator (RCE) — Core API account/device management. Phase 1 slice only: add an
   *  account, list its devices. Device control/lifecycle channels land with later phases. */
  RceValidateToken: "rce:validate-token",
  RceAddAccount: "rce:add-account",
  RceRemoveAccount: "rce:remove-account",
  RceListAccounts: "rce:list-accounts",
  /** User/org info + quota (`GET /user/me`) for the "User Info" button on an RCE location. */
  RceGetUserInfo: "rce:get-user-info",
  /** Billable instance-minutes for the User Info modal's usage chart — tries `GET /usage/owner`
   *  (org-wide, needs owner permission) first, falls back to `GET /usage/user` (the caller's own
   *  usage) on failure. */
  RceGetUsage: "rce:get-usage",
  RceListDevices: "rce:list-devices",
  /** Single-device fetch — used at connect time to get a fresh `running_device.instanceApiUrl`
   *  rather than trusting whatever `RceListDevices` last cached (unverified whether the list
   *  endpoint populates instance info as fully as this one does). */
  RceGetDevice: "rce:get-device",
  RceStartDevice: "rce:start-device",
  RceStopDevice: "rce:stop-device",
  /** Backs the "Run device" modal's snapshot picker — `RceManagementClient.listSnapshots` was
   *  already used server-side (`resolveStartParams`'s default-snapshot fallback) but never
   *  exposed to the renderer until the picker needed real names/timestamps, not just an id. */
  RceListSnapshots: "rce:list-snapshots",
  /** Account-wide firmware list (all device types in one call) — fetched once per location on
   *  connect and cached, backs the "Run device" modal's firmware picker and the stale-firmware
   *  check on both that modal and the plain Start button. See `resolveStartParams`. */
  RceListFirmwareVersions: "rce:list-firmware-versions",
  // ECP over an RCE instance's Device API — powers the same Remote/Apps/Query/Deep-Link tabs a
  // local device uses, via `RceEcpClient` in `roku-dev-studio-rce` (see `createRceApiAdapter` in
  // renderer/app.ts). The BrightScript debugger and video are not wired yet — those tabs stay
  // capability-gated off for `kind: 'rce'` devices until they land.
  RceKeypress: "rce:keypress",
  RceLaunch: "rce:launch",
  RceQuery: "rce:query",
  RcePost: "rce:post",
  RceInputText: "rce:input-text",
  RceDeeplink: "rce:deeplink",
  RceGetIcon: "rce:get-icon",
  /** Same UPnP `<iconList>`-then-fetch trick physical devices use (`RokuGetDeviceHardwareImage`),
   *  over the port-8060 ECP proxy — powers the Device Info modal's photo for RCE devices. */
  RceGetHardwareImage: "rce:get-hardware-image",
  /** "Dev mode" quick action (Quick Remote / Floating Remote / Remote tab, RCE-only) — triggers the
   *  on-device Developer Settings wizard screen. Not an ECP call; see
   *  `RceEcpClient.devSettingsCombo`. "Wake device" needs no dedicated channel — it's two plain
   *  `RceKeypress` calls, `Guide` then `Home` (matches Roku's own RCE dashboard). */
  RceDevSettingsCombo: "rce:dev-settings-combo",
  /** Classic `plugin_inspect`/Screenshot dev-web-installer flow, proxied through the RCE
   *  instance's `/sideload` path — same mechanism as `RceSideload`, ported from the reference
   *  `roku-deploy` implementation the RokuCommunity VS Code extension uses for RCE devices. */
  RceScreenshot: "rce:screenshot",
  RceVerifyDevAuth: "rce:verify-dev-auth",
  // Telnet system console (port 8080 — plugins/free/etc., the Query tab's "Device Queries" telnet
  // buttons), tunneled through the Device API's ports-bridge WebSocket via `RceSocket`. Pushes
  // received data on the existing `TelnetSystemData` channel (keyed by the device's synthetic
  // `ip`), so the renderer's local-device telnet listener picks it up with no changes.
  RceTelnetSystemConnect: "rce:telnet-system-connect",
  RceTelnetSystemDisconnect: "rce:telnet-system-disconnect",
  RceTelnetSystemSend: "rce:telnet-system-send",
  // BrightScript debug console (port 8085 — the Console tab), same ports-bridge tunnel. Pushes
  // on the existing `TelnetConnected`/`TelnetData`/`TelnetDisconnected`/`TelnetError` channels,
  // keyed by the device's synthetic `ip` — `debugTelnetConnectionId()` already falls through to
  // plain `ip` for any device with a falsy `serverUrl`, which RCE's adapter always has.
  RceTelnetConnect: "rce:telnet-connect",
  RceTelnetDisconnect: "rce:telnet-disconnect",
  // App Connector (RALE, port 49200), same ports-bridge tunnel — confirmed live 2026-09-12 the
  // tunnel is binary-only (a text WS frame gets `1003`), which the shared `[start]/[end]` framing
  // in roku-dev-studio-api's rale-direct.ts already satisfies (Node's Writable auto-converts a
  // string `.write()` to a Buffer before RceSocket sees it). Only wake (ECP proxy) and connect
  // (the RceSocket tunnel dial) are RCE-specific; once connected, the device's synthetic `ip` IS
  // the connectionId, so RceRaleCommand/RceRaleDisconnect reuse RokuRaleCommand/RokuRaleDisconnect
  // unchanged — those already only take a connectionId, no ip/port coupling.
  RceRaleWake: "rce:rale-wake",
  RceRaleConnect: "rce:rale-connect",
  // Push-based device state (design doc §5) — `GET /devices/{id}/ws`, main-process-held per
  // device, broadcast to every window. Replaces polling as the source of truth for whether a
  // device has finished booting and can be connected to.
  RceWatchDeviceState: "rce:watch-device-state",
  RceUnwatchDeviceState: "rce:unwatch-device-state",
  /** Main → renderer: a watched device's state changed. */
  RceDeviceStateChanged: "rce:device-state-changed",
  // Sideload — `POST /sideload/plugin_install` on the Device API (design doc §6 item 7), reusing
  // the file-picker/path-validation IPC (RokuSelectSideloadFile/RokuResolveSideloadFile) shared
  // with physical devices; only the actual upload call is RCE-specific.
  RceSideload: "rce:sideload",
  RceDeleteSideload: "rce:delete-sideload",
  // Live video preview (Janus/WebRTC signaling, design doc §7). Signaling (the WebSocket to Janus)
  // runs in main — a renderer WebSocket can't set the `Authorization: Bearer` handshake header —
  // while the actual `RTCPeerConnection` lives in the renderer, which is Chromium and has one
  // natively. These channels carry the SDP offer down and the answer/ICE candidates back up.
  RceVideoStart: "rce:video-start",
  RceVideoStop: "rce:video-stop",
  RceVideoAnswer: "rce:video-answer",
  RceVideoCandidate: "rce:video-candidate",
  RceVideoCandidatesComplete: "rce:video-candidates-complete",
  /** Main → renderer: the SDP offer + ICE server list for a `RceVideoStart` request. */
  RceVideoOffer: "rce:video-offer",
  /** Main → renderer: signaling lifecycle state (connecting/reconnecting/stopped/error) — not the
   *  actual media/ICE connection state, which only the renderer's RTCPeerConnection knows. */
  RceVideoStatus: "rce:video-status"
};

// network-session-viewer-preload.ts
var { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("roku", {
  /** Parse the file this window was opened with and return the whole session at once. `format` is
   *  the detected input kind; `notice` carries a non-fatal parse warning (e.g. odd pcap link type). */
  loadNetworkSession: () => ipcRenderer.invoke(IPC.NetSessionViewerLoad),
  copyToClipboard: (text) => ipcRenderer.invoke(IPC.ClipboardWrite, text),
  openExternal: (url) => ipcRenderer.invoke(IPC.ShellOpenExternal, url),
  // Crash-report modal: read the enable/disable setting + environment info.
  getSetting: (key) => ipcRenderer.invoke(IPC.SettingsGet, key),
  getAppInfo: () => ipcRenderer.invoke(IPC.GetAppInfo),
  // Native right-click menu (used by the Focus-hosts feature). Same channel as the live tab.
  showContextMenu: (items) => ipcRenderer.invoke(IPC.ShowContextMenu, items),
  // Privacy Mode — this viewer reuses the live inspector's renderers (device IPs,
  // client addresses), so it must blur them too. Read the current state at open and
  // listen for live toggles broadcast from the main process.
  getPrivacyMode: () => ipcRenderer.invoke(IPC.GetPrivacyMode),
  onPrivacyModeChanged: (callback) => {
    const handler = (_e, enabled) => callback(enabled);
    ipcRenderer.on(IPC.PrivacyModeChanged, handler);
    return () => ipcRenderer.removeListener(IPC.PrivacyModeChanged, handler);
  },
  // Live locale: apply the current preference on open + retranslate on change.
  getLocale: () => ipcRenderer.invoke(IPC.GetLocale),
  onLocaleChanged: (callback) => {
    const handler = (_e, pref) => callback(pref);
    ipcRenderer.on(IPC.LocaleChanged, handler);
    return () => ipcRenderer.removeListener(IPC.LocaleChanged, handler);
  },
  saveTextFile: (opts) => ipcRenderer.invoke(IPC.RokuSaveTextFile, opts),
  saveBinaryFile: (opts) => ipcRenderer.invoke(IPC.RokuSaveBinaryFile, opts)
});

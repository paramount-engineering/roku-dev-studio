"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// shared/ipc/channels.ts
var channels_exports = {};
__export(channels_exports, {
  IPC: () => IPC
});
var IPC;
var init_channels = __esm({
  "shared/ipc/channels.ts"() {
    "use strict";
    IPC = {
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
      /** Main → renderer: relay bind/lifecycle status changed. */
      SideloadRelayStatus: "sideload-relay:status",
      /** Main → renderer: a new upload was accepted and fan-out started. */
      SideloadRelayRunStarted: "sideload-relay:run-started",
      /** Main → renderer: per-device fan-out result update. */
      SideloadRelayResult: "sideload-relay:result"
    };
  }
});

// preload-settings.ts
var { contextBridge, ipcRenderer } = require("electron");
var { IPC: IPC2 } = (init_channels(), __toCommonJS(channels_exports));
contextBridge.exposeInMainWorld("settingsApi", {
  // Privacy Mode — mirrors the main/Fiddle bridge so the Settings window can blur
  // IPs/serials (e.g. the Sideload Relay device table) in lockstep. Reads the
  // current state at open; the main process fans `IPC.PrivacyModeChanged` to every
  // open window so a menu / other-window toggle flows through live.
  getPrivacyMode: () => ipcRenderer.invoke(IPC2.GetPrivacyMode),
  onPrivacyModeChanged: (callback) => {
    const handler = (_e, enabled) => callback(enabled);
    ipcRenderer.on(IPC2.PrivacyModeChanged, handler);
    return () => ipcRenderer.removeListener(IPC2.PrivacyModeChanged, handler);
  },
  // Language — apply live on dropdown change: main persists, re-labels the native menu,
  // and fans `IPC.LocaleChanged` to every window (including this one) to retranslate.
  setLanguage: (code) => ipcRenderer.invoke(IPC2.SetLocale, code),
  onLocaleChanged: (callback) => {
    const handler = (_e, pref) => callback(pref);
    ipcRenderer.on(IPC2.LocaleChanged, handler);
    return () => ipcRenderer.removeListener(IPC2.LocaleChanged, handler);
  },
  // Signal main that the initial getState() population is complete, so it can reveal the
  // window fully-rendered (no toggle/section-populate flash). Main also has a fallback timer.
  notifyReady: () => ipcRenderer.send(IPC2.SettingsWindowReady),
  getState: () => ipcRenderer.invoke(IPC2.SettingsWindowGetState),
  save: (payload) => ipcRenderer.invoke(IPC2.SettingsWindowSave, payload),
  pickFolder: () => ipcRenderer.invoke(IPC2.SettingsWindowPickFolder),
  openMcpConfig: (id) => ipcRenderer.invoke(IPC2.SettingsWindowOpenMcpConfig, { id }),
  closeWindow: () => ipcRenderer.send(IPC2.SettingsWindowClose),
  getNetworkInspectorStatus: () => ipcRenderer.invoke(IPC2.NetworkInspectorGetStatus),
  installBpfAccess: () => ipcRenderer.invoke(IPC2.NetworkInspectorInstallBpfAccess),
  // Certificate Authority (read-only CA card in the Network Inspector tab). The handlers are
  // registered globally on ipcMain, so invoke from the settings webContents reaches them.
  networkInspectorGetCaInfo: () => ipcRenderer.invoke(IPC2.NetworkInspectorGetCaInfo),
  networkInspectorExportCaPem: () => ipcRenderer.invoke(IPC2.NetworkInspectorExportCaPem),
  networkInspectorExportCaCert: () => ipcRenderer.invoke(IPC2.NetworkInspectorExportCaCert),
  // Remote Network Inspector (per-location): probe capability + config, and apply config.
  remoteNetworkProbe: (serverUrl) => ipcRenderer.invoke(IPC2.SettingsWindowRemoteNetworkProbe, { serverUrl }),
  remoteNetworkSetConfig: (serverUrl, config) => ipcRenderer.invoke(IPC2.SettingsWindowRemoteNetworkSetConfig, { serverUrl, config }),
  // Sideload Relay — config (gate/port/password/flags/targets) + live per-device results.
  sideloadRelayGetStatus: () => ipcRenderer.invoke(IPC2.SideloadRelayGetStatus),
  sideloadRelayGetConfig: () => ipcRenderer.invoke(IPC2.SideloadRelayGetConfig),
  sideloadRelayApply: (payload) => ipcRenderer.invoke(IPC2.SideloadRelayApplySettings, payload),
  sideloadRelaySeedTargets: (includeSubnetScan) => ipcRenderer.invoke(IPC2.SideloadRelaySeedTargets, { includeSubnetScan }),
  sideloadRelayValidatePassword: (payload) => ipcRenderer.invoke(IPC2.SideloadRelayValidatePassword, payload),
  sideloadRelayRevealPassword: () => ipcRenderer.invoke(IPC2.SideloadRelayRevealPassword),
  onSideloadRelayStatus: (callback) => {
    const handler = (_e, status) => callback(status);
    ipcRenderer.on(IPC2.SideloadRelayStatus, handler);
    return () => ipcRenderer.removeListener(IPC2.SideloadRelayStatus, handler);
  },
  onSideloadRelayRunStarted: (callback) => {
    const handler = (_e, run) => callback(run);
    ipcRenderer.on(IPC2.SideloadRelayRunStarted, handler);
    return () => ipcRenderer.removeListener(IPC2.SideloadRelayRunStarted, handler);
  },
  onSideloadRelayResult: (callback) => {
    const handler = (_e, result) => callback(result);
    ipcRenderer.on(IPC2.SideloadRelayResult, handler);
    return () => ipcRenderer.removeListener(IPC2.SideloadRelayResult, handler);
  }
});

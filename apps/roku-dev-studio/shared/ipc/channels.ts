/**
 * Single source of truth for IPC channel names (invoke, handle, send, on).
 * Preload and main both import these so renames are caught by TypeScript.
 */
export const IPC = {
  // About
  AboutCopy: 'about:copy',
  AboutOpenExternal: 'about:openExternal',
  // Settings window (modal)
  SettingsWindowGetState: 'settings-window:get-state',
  SettingsWindowSave: 'settings-window:save',
  SettingsWindowPickFolder: 'settings-window:pick-folder',
  /** Renderer requests destroying the Settings BrowserWindow after close animation. */
  SettingsWindowClose: 'settings-window:close',
  /** Settings window asks main to open a detected MCP client's config file in the default editor (falls back to revealing in folder). */
  SettingsWindowOpenMcpConfig: 'settings-window:open-mcp-config',
  AppSettingsUpdated: 'app-settings-updated',
  /** Renderer pushes its current state (selected device, App Connector Functions) to main for the MCP bridge to expose. */
  McpBridgeReportState: 'mcp-bridge:report-state',
  /** Main asks the renderer to drop an Action Script into the Builder of the active device tab. */
  McpBridgeDropScript: 'mcp-bridge:drop-script',
  /** Main acks the drop result back to whoever initiated it (the bridge). */
  McpBridgeDropScriptResult: 'mcp-bridge:drop-script-result',
  /** Main asks the renderer to run a read-only RALE command (e.g. getNodeById) using the active App Connector session. */
  McpBridgeRaleRequest: 'mcp-bridge:rale-request',
  /** Renderer relays the RALE command result back to main. */
  McpBridgeRaleResult: 'mcp-bridge:rale-result',
  /** Main asks the renderer to fetch the current channel's App Connector Function list (borrow-and-disconnect when needed). */
  McpBridgeFunctionsRequest: 'mcp-bridge:functions-request',
  /** Renderer relays the function-list result back to main. */
  McpBridgeFunctionsResult: 'mcp-bridge:functions-result',
  /** Main asks the renderer to open a device tab for `connect_device` requests. */
  McpBridgeConnectRequest: 'mcp-bridge:connect-request',
  /** Renderer relays the connect result back to main. */
  McpBridgeConnectResult: 'mcp-bridge:connect-result',
  /** Generic renderer-routed tool call (RALE writes, telnet send, App Connector connect, …). */
  McpBridgeToolRequest: 'mcp-bridge:tool-request',
  /** Renderer relays the generic tool result back to main. */
  McpBridgeToolResult: 'mcp-bridge:tool-result',
  /** Main broadcasts an agent-initiated action so the renderer can surface it as a toast. */
  McpBridgeAgentAction: 'mcp-bridge:agent-action',
  /** Main broadcasts an agent-captured screenshot so the matching device tab's screenshot pane can render it. */
  McpBridgeAgentScreenshot: 'mcp-bridge:agent-screenshot',
  /** Main asks the renderer for the dev password remembered for a device serial (localStorage). */
  McpBridgeStoredPasswordRequest: 'mcp-bridge:stored-password-request',
  /** Renderer returns remembered password (or omits it) for a prior stored-password request. */
  McpBridgeStoredPasswordResult: 'mcp-bridge:stored-password-result',
  // Roku local
  RokuDiscover: 'roku:discover',
  RokuScanSubnet: 'roku:scan-subnet',
  RokuDeviceFound: 'roku:device-found',
  RokuTestConnection: 'roku:test-connection',
  RokuGetIcon: 'roku:get-icon',
  RokuKeypress: 'roku:keypress',
  RokuLaunch: 'roku:launch',
  RokuQuery: 'roku:query',
  RokuPost: 'roku:post',
  RokuInputText: 'roku:input-text',
  RokuDeeplink: 'roku:deeplink',
  RokuSelectSideloadFile: 'roku:select-sideload-file',
  RokuSideload: 'roku:sideload',
  RokuDeleteSideload: 'roku:delete-sideload',
  RokuScreenshot: 'roku:screenshot',
  RokuVerifyDevAuth: 'roku:verify-dev-auth',
  RokuSaveScreenshot: 'roku:save-screenshot',
  RokuRaleWake: 'roku:rale-wake',
  RokuRaleConnect: 'roku:rale-connect',
  RokuRaleCommand: 'roku:rale-command',
  RokuRaleDisconnect: 'roku:rale-disconnect',
  RokuRaleStatus: 'roku:rale-status',
  RaleDisconnected: 'rale-disconnected',
  ShowContextMenu: 'show-context-menu',
  CopyToClipboard: 'copy-to-clipboard',
  ClipboardWrite: 'clipboard:write',
  ShellOpenExternal: 'shell:open-external',
  IsDebugEnabled: 'is-debug-enabled',
  OpenLogFile: 'open-log-file',
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
  ConsoleSpillStart: 'console-spill:start',
  ConsoleSpillAppend: 'console-spill:append',
  ConsoleSpillRead: 'console-spill:read',
  ConsoleSpillClear: 'console-spill:clear',
  /** Streaming load: renderer kicks off the read; main answers with file
   *  metadata and starts emitting `LogViewerStreamChunk` / `Complete` /
   *  `Error` events. Streaming avoids holding the whole decoded file string
   *  in memory in both processes (which doubled peak heap on large files). */
  LogViewerStreamStart: 'log-viewer:stream-start',
  /** Main → renderer: a decoded text chunk plus progress
   *  (`{ text, doneBytes, totalBytes }`). Sent multiple times per stream. */
  LogViewerStreamChunk: 'log-viewer:stream-chunk',
  /** Main → renderer: stream finished cleanly (EOF). */
  LogViewerStreamComplete: 'log-viewer:stream-complete',
  /** Main → renderer: read failed mid-stream. Payload `{ error: string }`. */
  LogViewerStreamError: 'log-viewer:stream-error',
  RokuSaveTrackerTask: 'roku:save-tracker-task',
  RokuSaveConsoleLogs: 'roku:save-console-logs',
  RokuActionScriptShowSaveFolder: 'roku:action-script-show-save-folder',
  RokuActionScriptWriteFile: 'roku:action-script-write-file',
  RokuActionScriptShowSaveScriptDialog: 'roku:action-script-show-save-script-dialog',
  RokuActionScriptCheckFileExists: 'roku:action-script-check-file-exists',
  RokuReadFileAsBase64: 'roku:read-file-as-base64',
  /** Crop a region of the invoking `WebContents` (CSS / DIP rect) to PNG (Device Performance quad cards). */
  RokuCaptureViewRect: 'roku:capture-view-rect',
  RokuSaveResultsPdf: 'roku:save-results-pdf',
  RemoteDiscover: 'remote:discover',
  RemoteDevicesCached: 'remote:devices-cached',
  RemoteHealth: 'remote:health',
  RemoteCapabilities: 'remote:capabilities',
  RemoteDeviceInfo: 'remote:device-info',
  RemoteKeypress: 'remote:keypress',
  RemoteLaunch: 'remote:launch',
  RemoteQuery: 'remote:query',
  RemotePost: 'remote:post',
  RemoteInputText: 'remote:input-text',
  RemoteDeeplink: 'remote:deeplink',
  RemoteGetIcon: 'remote:get-icon',
  RemoteScreenshot: 'remote:screenshot',
  RemoteVerifyDevAuth: 'remote:verify-dev-auth',
  RemoteSideload: 'remote:sideload',
  RemoteSideloadUpload: 'remote:sideload-upload',
  RemoteDeleteSideload: 'remote:delete-sideload',
  RemoteRaleWake: 'remote:rale-wake',
  RemoteRaleConnect: 'remote:rale-connect',
  RemoteRaleCommand: 'remote:rale-command',
  RemoteRaleDisconnect: 'remote:rale-disconnect',
  TelnetConnect: 'telnet:connect',
  TelnetDisconnect: 'telnet:disconnect',
  TelnetSend: 'telnet:send',
  TelnetStatus: 'telnet:status',
  TelnetConnected: 'telnet:connected',
  TelnetData: 'telnet:data',
  TelnetError: 'telnet:error',
  TelnetDisconnected: 'telnet:disconnected',
  RemoteTelnetConnect: 'remote:telnet-connect',
  RemoteTelnetDisconnect: 'remote:telnet-disconnect',
  RemoteTelnetSend: 'remote:telnet-send',
  RemoteTelnetStatus: 'remote:telnet-status',
  RemoteTelnetSystemConnect: 'remote:telnet-system-connect',
  RemoteTelnetSystemDisconnect: 'remote:telnet-system-disconnect',
  RemoteTelnetSystemSend: 'remote:telnet-system-send',
  RemoteTelnetSystemStatus: 'remote:telnet-system-status',
  RemoteTelnetSystemPollData: 'remote:telnet-system-poll-data',
  TelnetSystemConnect: 'telnet-system:connect',
  TelnetSystemDisconnect: 'telnet-system:disconnect',
  TelnetSystemSend: 'telnet-system:send',
  TelnetSystemStatus: 'telnet-system:status',
  TelnetSystemData: 'telnet-system:data',
  SettingsGet: 'settings:get',
  SettingsSet: 'settings:set',
  SettingsDelete: 'settings:delete',
  /** Encrypted secret store (developer passwords) — backed by Electron `safeStorage`. */
  SecretsStatus: 'secrets:status',
  SecretsGetAll: 'secrets:get-all',
  SecretsSetPassword: 'secrets:set-password',
  SecretsDeletePassword: 'secrets:delete-password',
  SecretsMigrateLegacy: 'secrets:migrate-legacy',
  SecretsClearAll: 'secrets:clear-all',
  GetDeveloperMode: 'get-developer-mode',
  SetDeveloperMode: 'set-developer-mode',
  DeveloperModeChanged: 'developer-mode-changed',
  GetPrivacyMode: 'get-privacy-mode',
  SetPrivacyMode: 'set-privacy-mode',
  PrivacyModeChanged: 'privacy-mode-changed',
  DebugLoggingChanged: 'debug-logging-changed',
  /** Frameless main window — custom title bar (Windows / Linux). */
  MainWindowMinimize: 'main-window:minimize',
  MainWindowToggleMaximize: 'main-window:toggle-maximize',
  MainWindowClose: 'main-window:close',
  /** Main → renderer: webContents zoom factor changed (menu Cmd+/-/0,
   * Ctrl+wheel, or initial load). Renderer mirrors it into the
   * `--app-zoom` CSS variable so the frameless title bar can stay at a
   * constant screen-pixel size — macOS-drawn traffic lights and the
   * Windows/Linux custom controls don't scale with content zoom and
   * collide with content otherwise. */
  AppZoomChanged: 'app:zoom-changed',
  /** Renderer → main: request a zoom step from the title-bar zoom indicator
   * (`-` / `+` buttons). Payload: `{ direction: 'in' | 'out' | 'reset' }`.
   * Main re-uses the same `applyZoomFactor` path as the View > Zoom menu
   * so clamp + broadcast stay centralized; the renderer is told the new
   * factor via `AppZoomChanged` and updates its `--app-zoom` + the
   * indicator label from there. */
  AppZoomChange: 'app:zoom-change',
  /** BrightScript Fiddle — standalone window (editor + terminal) */
  FiddleOpen: 'fiddle:open',
  FiddleReady: 'fiddle:ready',
  FiddleInit: 'fiddle:init',
  FiddleLint: 'fiddle:lint',
  FiddleRun: 'fiddle:run',
  FiddleStop: 'fiddle:stop',
  FiddleRunResult: 'fiddle:run-result',
  FiddleTerminalData: 'fiddle:terminal-data',
  FiddleTerminalCleared: 'fiddle:terminal-cleared',
  FiddleDevicesUpdate: 'fiddle:devices-update',
  FiddleRefreshDevices: 'fiddle:refresh-devices',
  /** Main renderer pushes its current device snapshot to main (main re-broadcasts to fiddle windows). */
  FiddlePushDevices: 'fiddle:push-devices',
  /** Main process asks main renderer to wipe a device's stored password (auth failed upstream). */
  FiddleClearPasswordRequest: 'fiddle:clear-password-request',
  /** Main renderer pushes scan status (spinner state) to open Fiddle windows. */
  FiddleScanStatus: 'fiddle:scan-status'
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

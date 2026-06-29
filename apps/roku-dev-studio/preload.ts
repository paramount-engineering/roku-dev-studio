import type { IpcRendererEvent } from 'electron';
import { IPC } from './shared/ipc/channels';
import type { ActionScriptWriteFilePayload } from './shared/ipc/payloads';

const { contextBridge, ipcRenderer, webUtils } = require('electron');
// Resolved at esbuild bundle time (see scripts/build/transpile-main-process.ts). Do not use bare
// `roku-dev-studio-api/...` here — workspace hoisting breaks it; the bundle inlines these files.
const {
  normalizeRaleFunctions,
  parseGetExternalControlFunctionsResponse
} = require('../../packages/roku-dev-studio-api/dist/lib/rale-functions-normalize.js');
const actionScriptWaitCore = require('../../packages/roku-dev-studio-api/dist/lib/action-script-wait-core.js');
const actionScriptVariables = require('../../packages/roku-dev-studio-api/dist/lib/action-script-variables.js');
const actionScriptIfEval = require('../../packages/roku-dev-studio-api/dist/lib/action-script-if-eval.js');
const actionScriptValidator = require('../../packages/roku-dev-studio-api/dist/lib/validate-action-script.js');
const actionScriptRaleCommandArgs = require('../../packages/roku-dev-studio-api/dist/lib/rale-command-args.js');
const actionScriptNodeFieldConstants = require('../../packages/roku-dev-studio-api/dist/lib/action-script-node-field-constants.js');
const sharedConstants = require('../../packages/roku-dev-studio-api/dist/lib/shared-constants.js');
// Canonical catalogs (STEP_SCHEMA, keypress, presets, etc.) — single source
// of truth. Exposed through the preload bridge so the renderer can read the
// same shapes the MCP server and the future remote server use.
const catalogs = require('../../packages/roku-dev-studio-api/dist/lib/catalogs.js');

contextBridge.exposeInMainWorld('rdsCatalogs', catalogs);

contextBridge.exposeInMainWorld(
  'rdsSharedConstants',
  Object.freeze({
    DEFAULT_RALE_PORT: sharedConstants.DEFAULT_RALE_PORT,
    SCREENSHOT_DEBOUNCE_DELAY: sharedConstants.SCREENSHOT_DEBOUNCE_DELAY,
    SCREENSHOT_AFTER_LAUNCH_DELAY: sharedConstants.SCREENSHOT_AFTER_LAUNCH_DELAY,
    TELNET_TIMEOUT: sharedConstants.TELNET_TIMEOUT,
    CONNECTION_CHECK_INTERVAL: sharedConstants.CONNECTION_CHECK_INTERVAL,
    DEVICE_METRICS_SAMPLE_INTERVAL_MS: sharedConstants.DEVICE_METRICS_SAMPLE_INTERVAL_MS,
    DEVICE_METRICS_CHART_HISTORY_MS: sharedConstants.DEVICE_METRICS_CHART_HISTORY_MS,
    TOAST_DISPLAY_DURATION: sharedConstants.TOAST_DISPLAY_DURATION,
    STATUS_MESSAGE_DURATION: sharedConstants.STATUS_MESSAGE_DURATION
  })
);

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('roku', {
  // ============================================
  // Device Discovery
  // ============================================
  
  // Discover Roku devices on the network (SSDP multicast)
  discover: () => ipcRenderer.invoke(IPC.RokuDiscover),
  
  // Fallback: Scan subnet for Roku devices (HTTP-based, works on unsigned apps)
  scanSubnet: () => ipcRenderer.invoke(IPC.RokuScanSubnet),
  
  // Listen for device found events during discovery
  onDeviceFound: (callback: (device: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, device: unknown) => callback(device);
    ipcRenderer.on(IPC.RokuDeviceFound, handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener(IPC.RokuDeviceFound, handler);
  },
  
  // Test connection to a specific IP
  testConnection: (ip: string) => ipcRenderer.invoke(IPC.RokuTestConnection, { ip }),
  
  // Get app icon as data URL
  getIcon: (ip: string, appId: string) => ipcRenderer.invoke(IPC.RokuGetIcon, { ip, appId }),
  
  // ============================================
  // ECP Commands
  // ============================================
  
  // Send a key press command
  keypress: (ip: string, key: string) => ipcRenderer.invoke(IPC.RokuKeypress, { ip, key }),
  
  // Launch an app by ID
  launch: (ip: string, appId: string, params: unknown) => ipcRenderer.invoke(IPC.RokuLaunch, { ip, appId, params }),
  
  // Query device info
  query: (ip: string, endpoint: string) => ipcRenderer.invoke(IPC.RokuQuery, { ip, endpoint }),
  
  // POST request (for sgrendezvous track/untrack, etc.)
  post: (ip: string, endpoint: string) => ipcRenderer.invoke(IPC.RokuPost, { ip, endpoint }),
  
  // Sideload channel package
  selectSideloadFile: () => ipcRenderer.invoke(IPC.RokuSelectSideloadFile),
  resolveSideloadFile: (filePath: string) =>
    ipcRenderer.invoke(IPC.RokuResolveSideloadFile, { filePath }),
  /** Resolve a drag-dropped File via preload (renderer cannot read `file.path` in modern Electron). */
  resolveDroppedSideloadFile: (file: File) => {
    try {
      const filePath = webUtils.getPathForFile(file);
      return ipcRenderer.invoke(IPC.RokuResolveSideloadFile, { filePath });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return Promise.resolve({ success: false, error: message || 'Could not read the dropped file path' });
    }
  },
  sideload: (ip: string, filePath: string, password: string | undefined) => 
    ipcRenderer.invoke(IPC.RokuSideload, { ip, filePath, password }),
  deleteSideload: (ip: string, password: string | undefined) => 
    ipcRenderer.invoke(IPC.RokuDeleteSideload, { ip, password }),
  
  // Screenshot (optional options.waitAfterTriggerMs for slow/HUD screens)
  screenshot: (ip: string, password: string | undefined, options: { waitAfterTriggerMs?: number } | undefined) =>
    ipcRenderer.invoke(IPC.RokuScreenshot, { ip, password, waitAfterTriggerMs: options?.waitAfterTriggerMs }),
  verifyDevAuth: (ip: string, password: string | undefined) =>
    ipcRenderer.invoke(IPC.RokuVerifyDevAuth, { ip, password }),
  saveScreenshot: (tempFile: string, dataUrl: string) => 
    ipcRenderer.invoke(IPC.RokuSaveScreenshot, { tempFile, dataUrl }),
  
  // Deep link to content
  deeplink: (ip: string, appId: string, contentId: string, mediaType?: string) => 
    ipcRenderer.invoke(IPC.RokuDeeplink, { ip, appId, contentId, mediaType }),
  
  // Send text input
  inputText: (ip: string, text: string) => ipcRenderer.invoke(IPC.RokuInputText, { ip, text }),
  
  // ============================================
  // RALE (Roku Advanced Layout Editor) Inspector
  // ============================================
  
  // Wake up RALE TrackerTask
  raleWake: (ip: string, port: number) => ipcRenderer.invoke(IPC.RokuRaleWake, { ip, port }),
  
  // Connect to RALE
  raleConnect: (ip: string, port: number) => ipcRenderer.invoke(IPC.RokuRaleConnect, { ip, port }),
  
  // Send RALE command
  raleCommand: (connectionId: string, command: string, args: unknown) => 
    ipcRenderer.invoke(IPC.RokuRaleCommand, { connectionId, command, args }),
  
  // Disconnect RALE
  raleDisconnect: (connectionId: string) => 
    ipcRenderer.invoke(IPC.RokuRaleDisconnect, { connectionId }),
  
  // Check RALE connection status
  raleStatus: (connectionId: string) => 
    ipcRenderer.invoke(IPC.RokuRaleStatus, { connectionId }),
  
  // Listen for RALE disconnect events
  onRaleDisconnected: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(IPC.RaleDisconnected, handler);
    return () => ipcRenderer.removeListener(IPC.RaleDisconnected, handler);
  },
  
  // ============================================
  // Context Menu & Clipboard
  // ============================================
  
  // Show context menu with items
  showContextMenu: (items: unknown) => ipcRenderer.invoke(IPC.ShowContextMenu, items),
  
  // Copy text to clipboard
  copyToClipboard: (text: string) => ipcRenderer.invoke(IPC.ClipboardWrite, text),
  
  // Open URL in default browser
  openExternal: (url: string) => ipcRenderer.invoke(IPC.ShellOpenExternal, url),
  
  // Check if debug logging is enabled
  isDebugEnabled: () => ipcRenderer.invoke(IPC.IsDebugEnabled),

  // Whether verbose logging is forced on by the RDS_DEBUG env flag (read once at startup).
  getVerboseDebug: () => ipcRenderer.invoke(IPC.GetVerboseDebug),

  // Open debug log file (only works if debug enabled)
  openLogFile: () => ipcRenderer.invoke(IPC.OpenLogFile),

  isDiagnosticBuild: () => ipcRenderer.invoke(IPC.IsDiagnosticBuild),
  openDiagnosticLogFolder: () => ipcRenderer.invoke(IPC.OpenDiagnosticLogFolder),
  
  // ============================================
  // TrackerTask Management
  // ============================================
  
  // Save TrackerTask.xml file
  saveTrackerTask: () => ipcRenderer.invoke(IPC.RokuSaveTrackerTask),
  
  // Save arbitrary text (e.g. console logs, a query / App Connector response) to a file.
  saveTextFile: (opts: { content: string; defaultName?: string; dialogTitle?: string }) =>
    ipcRenderer.invoke(IPC.RokuSaveTextFile, opts),

  // Save raw binary bytes (base64) to a file — e.g. an image/video response body.
  saveBinaryFile: (opts: { base64: string; defaultName?: string; dialogTitle?: string }) =>
    ipcRenderer.invoke(IPC.RokuSaveBinaryFile, opts),

  // Copy an image (data URL) to the clipboard as an actual picture.
  copyImage: (opts: { dataUrl: string }) => ipcRenderer.invoke(IPC.RokuCopyImage, opts),

  // Console scrollback spill — disk-backed history past the in-memory cap.
  // See `main/console-spill.ts` for the file lifecycle. The renderer calls
  // `Start` on Connect, `Append` per scrollback trim, `Read` on a one-shot
  // "user scrolled near top of in-memory range, materialize the spill" load,
  // and `Clear` on the Clear button or device-tab teardown.
  consoleSpillStart: (tag: string) => ipcRenderer.invoke(IPC.ConsoleSpillStart, { tag }),
  consoleSpillAppend: (spillId: string, entries: ReadonlyArray<Record<string, unknown>>) =>
    ipcRenderer.invoke(IPC.ConsoleSpillAppend, { spillId, entries }),
  consoleSpillRead: (spillId: string) => ipcRenderer.invoke(IPC.ConsoleSpillRead, { spillId }),
  consoleSpillClear: (spillId: string) => ipcRenderer.invoke(IPC.ConsoleSpillClear, { spillId }),

  // Action Scripts: select folder for run outputs (screenshots, console log)
  actionScriptShowSaveFolder: () => ipcRenderer.invoke(IPC.RokuActionScriptShowSaveFolder),
  // Write file: (folderPath, filename, content, encoding) or ({ filePath, content, encoding })
  actionScriptWriteFile: (folderPathOrOpts: string | ActionScriptWriteFilePayload, filename?: string, content?: string, encoding?: string) => {
    if (typeof folderPathOrOpts === 'object') {
      return ipcRenderer.invoke(IPC.RokuActionScriptWriteFile, folderPathOrOpts);
    }
    return ipcRenderer.invoke(IPC.RokuActionScriptWriteFile, {
      folderPath: folderPathOrOpts,
      filename,
      content,
      encoding: encoding || 'utf8'
    });
  },
  // Action Script Builder: save script dialog and write
  actionScriptShowSaveScriptDialog: () => ipcRenderer.invoke(IPC.RokuActionScriptShowSaveScriptDialog),
  // Check file exists (for sideload step validation)
  actionScriptCheckFileExists: (filePath: string) => ipcRenderer.invoke(IPC.RokuActionScriptCheckFileExists, { filePath }),
  // Read file as base64 (for PDF screenshot embedding)
  readFileAsBase64: (filePathOrUrl: string) => ipcRenderer.invoke(IPC.RokuReadFileAsBase64, { filePathOrUrl }),
  /** Crop the invoking window’s page (CSS / DIP rect from `getBoundingClientRect()`) to a PNG data URL. */
  captureViewRect: (payload: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke(IPC.RokuCaptureViewRect, payload),
  // Save Action Script results as PDF (images embedded; displays in all viewers)
  saveResultsPdf: (payload: unknown) => ipcRenderer.invoke(IPC.RokuSaveResultsPdf, { payload }),

  // ============================================
  // Remote Location APIs
  // ============================================

  // Discover devices on a remote server
  remoteDiscover: (serverUrl: string) => 
    ipcRenderer.invoke(IPC.RemoteDiscover, { serverUrl }),

  // Get cached devices from remote server (fast)
  remoteDevicesCached: (serverUrl: string) => 
    ipcRenderer.invoke(IPC.RemoteDevicesCached, { serverUrl }),

  // Health check for remote server
  remoteHealth: (serverUrl: string) => 
    ipcRenderer.invoke(IPC.RemoteHealth, { serverUrl }),

  // Get server capabilities/features
  remoteCapabilities: (serverUrl: string) => 
    ipcRenderer.invoke(IPC.RemoteCapabilities, { serverUrl }),

  // Remote Network Inspector (proxies the server's /network/* endpoints)
  remoteNetworkStatus: (serverUrl: string) =>
    ipcRenderer.invoke(IPC.RemoteNetworkStatus, { serverUrl }),
  remoteNetworkGetConfig: (serverUrl: string) =>
    ipcRenderer.invoke(IPC.RemoteNetworkGetConfig, { serverUrl }),
  remoteNetworkSetConfig: (serverUrl: string, config: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.RemoteNetworkSetConfig, { serverUrl, config }),
  remoteNetworkEvents: (serverUrl: string, deviceIp: string, limit?: number) =>
    ipcRenderer.invoke(IPC.RemoteNetworkEvents, { serverUrl, deviceIp, limit }),
  remoteNetworkEventDetail: (serverUrl: string, id: string) =>
    ipcRenderer.invoke(IPC.RemoteNetworkEventDetail, { serverUrl, id }),
  remoteNetworkClear: (serverUrl: string, deviceIps?: string[]) =>
    ipcRenderer.invoke(IPC.RemoteNetworkClear, { serverUrl, deviceIps }),
  remoteNetworkSetupCapture: (serverUrl: string) =>
    ipcRenderer.invoke(IPC.RemoteNetworkSetupCapture, { serverUrl }),

  // Get device info from remote location
  remoteDeviceInfo: (serverUrl: string, ip: string) => 
    ipcRenderer.invoke(IPC.RemoteDeviceInfo, { serverUrl, ip }),

  // Send key press via remote server
  remoteKeypress: (serverUrl: string, ip: string, key: string) => 
    ipcRenderer.invoke(IPC.RemoteKeypress, { serverUrl, ip, key }),

  // Launch app via remote server
  remoteLaunch: (serverUrl: string, ip: string, appId: string, params: unknown) => 
    ipcRenderer.invoke(IPC.RemoteLaunch, { serverUrl, ip, appId, params }),

  // Query device via remote server
  remoteQuery: (serverUrl: string, ip: string, endpoint: string) => 
    ipcRenderer.invoke(IPC.RemoteQuery, { serverUrl, ip, endpoint }),

  // POST to device via remote server
  remotePost: (serverUrl: string, ip: string, endpoint: string) => 
    ipcRenderer.invoke(IPC.RemotePost, { serverUrl, ip, endpoint }),

  // Input text via remote server
  remoteInputText: (serverUrl: string, ip: string, text: string) => 
    ipcRenderer.invoke(IPC.RemoteInputText, { serverUrl, ip, text }),

  // Deep link via remote server
  remoteDeeplink: (serverUrl: string, ip: string, appId: string, contentId: string, mediaType?: string) => 
    ipcRenderer.invoke(IPC.RemoteDeeplink, { serverUrl, ip, appId, contentId, mediaType }),

  // Get app icon via remote server
  remoteGetIcon: (serverUrl: string, ip: string, appId: string) => 
    ipcRenderer.invoke(IPC.RemoteGetIcon, { serverUrl, ip, appId }),

  // Screenshot via remote server
  remoteScreenshot: (serverUrl: string, ip: string, password: string | undefined, options: { waitAfterTriggerMs?: number } | undefined) =>
    ipcRenderer.invoke(IPC.RemoteScreenshot, { serverUrl, ip, password, waitAfterTriggerMs: options?.waitAfterTriggerMs }),
  remoteVerifyDevAuth: (serverUrl: string, ip: string, password: string | undefined) =>
    ipcRenderer.invoke(IPC.RemoteVerifyDevAuth, { serverUrl, ip, password }),

  // Sideload via remote server (file must be on remote server)
  remoteSideload: (serverUrl: string, ip: string, filePath: string, password: string | undefined) => 
    ipcRenderer.invoke(IPC.RemoteSideload, { serverUrl, ip, filePath, password }),
  
  // Sideload via remote server with file upload from local machine
  remoteSideloadUpload: (serverUrl: string, ip: string, filePath: string, password: string | undefined) => 
    ipcRenderer.invoke(IPC.RemoteSideloadUpload, { serverUrl, ip, filePath, password }),

  // Delete sideload via remote server
  remoteDeleteSideload: (serverUrl: string, ip: string, password: string | undefined) => 
    ipcRenderer.invoke(IPC.RemoteDeleteSideload, { serverUrl, ip, password }),

  // RALE wake via remote server
  remoteRaleWake: (serverUrl: string, ip: string, port: number) => 
    ipcRenderer.invoke(IPC.RemoteRaleWake, { serverUrl, ip, port }),

  // RALE connect via remote server
  remoteRaleConnect: (serverUrl: string, ip: string, port: number) => 
    ipcRenderer.invoke(IPC.RemoteRaleConnect, { serverUrl, ip, port }),

  // RALE command via remote server
  remoteRaleCommand: (serverUrl: string, connectionId: string, command: string, args: unknown) => 
    ipcRenderer.invoke(IPC.RemoteRaleCommand, { serverUrl, connectionId, command, args }),

  // RALE disconnect via remote server
  remoteRaleDisconnect: (serverUrl: string, connectionId: string) => 
    ipcRenderer.invoke(IPC.RemoteRaleDisconnect, { serverUrl, connectionId }),

  // ============================================
  // Telnet Debug Console (Port 8085)
  // ============================================
  
  // Connect to local device telnet (idempotent — reuses a healthy 8085 socket)
  telnetConnect: (ip: string) => ipcRenderer.invoke(IPC.TelnetConnect, { ip }),
  
  // Disconnect local telnet
  telnetDisconnect: (ip: string) => ipcRenderer.invoke(IPC.TelnetDisconnect, { ip }),
  
  // Send command to local telnet
  telnetSend: (ip: string, command: string) => ipcRenderer.invoke(IPC.TelnetSend, { ip, command }),
  
  // Check local telnet status
  telnetStatus: (ip: string) => ipcRenderer.invoke(IPC.TelnetStatus, { ip }),
  
  // Connect to remote telnet via relay
  remoteTelnetConnect: (
    serverUrl: string,
    ip: string,
    options?: { skipRelayBuffer?: boolean }
  ) => ipcRenderer.invoke(IPC.RemoteTelnetConnect, { serverUrl, ip, skipRelayBuffer: options?.skipRelayBuffer }),
  
  // Disconnect remote telnet
  remoteTelnetDisconnect: (serverUrl: string, ip: string) => 
    ipcRenderer.invoke(IPC.RemoteTelnetDisconnect, { serverUrl, ip }),
  
  // Send command to remote telnet
  remoteTelnetSend: (serverUrl: string, ip: string, command: string) => 
    ipcRenderer.invoke(IPC.RemoteTelnetSend, { serverUrl, ip, command }),
  
  // Check remote telnet status
  remoteTelnetStatus: (serverUrl: string, ip: string) => 
    ipcRenderer.invoke(IPC.RemoteTelnetStatus, { serverUrl, ip }),

  // Clear relay-side telnet log buffer (8085 session stays open)
  remoteTelnetClearBuffer: (serverUrl: string, ip: string) =>
    ipcRenderer.invoke(IPC.RemoteTelnetClearBuffer, { serverUrl, ip }),
  
  // Telnet System Commands (port 8080) - Remote via IPC
  remoteTelnetSystemConnect: (serverUrl: string, ip: string) => 
    ipcRenderer.invoke(IPC.RemoteTelnetSystemConnect, { serverUrl, ip }),
  
  remoteTelnetSystemDisconnect: (serverUrl: string, ip: string) => 
    ipcRenderer.invoke(IPC.RemoteTelnetSystemDisconnect, { serverUrl, ip }),
  
  remoteTelnetSystemSend: (serverUrl: string, ip: string, command: string) => 
    ipcRenderer.invoke(IPC.RemoteTelnetSystemSend, { serverUrl, ip, command }),
  
  remoteTelnetSystemStatus: (serverUrl: string, ip: string) => 
    ipcRenderer.invoke(IPC.RemoteTelnetSystemStatus, { serverUrl, ip }),
  
  // Poll for telnet system data (remote devices use polling instead of events)
  remoteTelnetSystemPollData: (serverUrl: string, ip: string) => 
    ipcRenderer.invoke(IPC.RemoteTelnetSystemPollData, { serverUrl, ip }),
  
  // Listen for telnet events
  onTelnetConnected: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(IPC.TelnetConnected, handler);
    return () => ipcRenderer.removeListener(IPC.TelnetConnected, handler);
  },
  
  onTelnetData: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(IPC.TelnetData, handler);
    return () => ipcRenderer.removeListener(IPC.TelnetData, handler);
  },
  
  onTelnetError: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(IPC.TelnetError, handler);
    return () => ipcRenderer.removeListener(IPC.TelnetError, handler);
  },
  
  onTelnetDisconnected: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(IPC.TelnetDisconnected, handler);
    return () => ipcRenderer.removeListener(IPC.TelnetDisconnected, handler);
  },

  // ============================================
  // Telnet System Commands (Port 8080)
  // ============================================
  
  // Connect to local device telnet system (port 8080)
  telnetSystemConnect: (ip: string) => ipcRenderer.invoke(IPC.TelnetSystemConnect, { ip }),
  
  // Disconnect local telnet system
  telnetSystemDisconnect: (ip: string) => ipcRenderer.invoke(IPC.TelnetSystemDisconnect, { ip }),
  
  // Send command to local telnet system
  telnetSystemSend: (ip: string, command: string) => ipcRenderer.invoke(IPC.TelnetSystemSend, { ip, command }),
  
  // Check local telnet system status
  telnetSystemStatus: (ip: string) => ipcRenderer.invoke(IPC.TelnetSystemStatus, { ip }),
  
  // Listen for telnet system data events
  onTelnetSystemData: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(IPC.TelnetSystemData, handler);
    return () => ipcRenderer.removeListener(IPC.TelnetSystemData, handler);
  },

  // ============================================
  // Settings Storage (file-based)
  // ============================================
  
  // Get a setting value
  getSetting: (key: string) => ipcRenderer.invoke(IPC.SettingsGet, key),
  
  // Set a setting value
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke(IPC.SettingsSet, key, value),
  
  // Delete a setting
  deleteSetting: (key: string) => ipcRenderer.invoke(IPC.SettingsDelete, key),

  // ============================================
  // Encrypted Secret Store (developer passwords)
  // Backed by Electron `safeStorage` in the main process. The renderer
  // hydrates an in-memory cache from `secretsGetAll` on boot, then uses the
  // sync `getStoredPassword/savePassword/removePassword` helpers in
  // `renderer/modules/utils/storage.ts`. Writes fan out as fire-and-forget
  // IPC calls below.
  // ============================================
  secretsStatus: () => ipcRenderer.invoke(IPC.SecretsStatus),
  secretsGetAll: () => ipcRenderer.invoke(IPC.SecretsGetAll),
  secretsSetPassword: (serial: string, password: string) =>
    ipcRenderer.invoke(IPC.SecretsSetPassword, { serial, password }),
  secretsDeletePassword: (serial: string) =>
    ipcRenderer.invoke(IPC.SecretsDeletePassword, { serial }),
  secretsMigrateLegacy: (entries: Record<string, string>) =>
    ipcRenderer.invoke(IPC.SecretsMigrateLegacy, { entries }),
  
  // ============================================
  // Developer Mode
  // ============================================
  
  // Get developer mode state
  getDeveloperMode: () => ipcRenderer.invoke(IPC.GetDeveloperMode),
  
  // Set developer mode state
  setDeveloperMode: (enabled: boolean) => ipcRenderer.invoke(IPC.SetDeveloperMode, enabled),
  
  // Listen for developer mode changes from menu
  onDeveloperModeChanged: (callback: (enabled: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, enabled: boolean) => callback(enabled);
    ipcRenderer.on(IPC.DeveloperModeChanged, handler);
    return () => ipcRenderer.removeListener(IPC.DeveloperModeChanged, handler);
  },

  // ============================================
  // Privacy Mode
  // ============================================
  
  // Get privacy mode state
  getPrivacyMode: () => ipcRenderer.invoke(IPC.GetPrivacyMode),
  
  // Set privacy mode state
  setPrivacyMode: (enabled: boolean) => ipcRenderer.invoke(IPC.SetPrivacyMode, enabled),
  
  // Listen for privacy mode changes from menu
  onPrivacyModeChanged: (callback: (enabled: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, enabled: boolean) => callback(enabled);
    ipcRenderer.on(IPC.PrivacyModeChanged, handler);
    return () => ipcRenderer.removeListener(IPC.PrivacyModeChanged, handler);
  },

  // Listen for debug logging changes from File menu
  onDebugLoggingChanged: (callback: (enabled: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, enabled: boolean) => callback(enabled);
    ipcRenderer.on(IPC.DebugLoggingChanged, handler);
    return () => ipcRenderer.removeListener(IPC.DebugLoggingChanged, handler);
  },

  // Persisted app settings changed (Settings window save) — reload timing + connection poll
  onAppSettingsUpdated: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(IPC.AppSettingsUpdated, handler);
    return () => ipcRenderer.removeListener(IPC.AppSettingsUpdated, handler);
  },

  // ============================================
  // Network Inspector (local hotspot traffic capture)
  // ============================================
  networkInspectorGetStatus: () => ipcRenderer.invoke(IPC.NetworkInspectorGetStatus),
  networkInspectorGetEvents: (deviceIp: string, limit?: number, sinceSeq?: number) =>
    ipcRenderer.invoke(IPC.NetworkInspectorGetEvents, { deviceIp, limit, sinceSeq }),
  networkInspectorGetEventDetail: (id: string) =>
    ipcRenderer.invoke(IPC.NetworkInspectorGetEventDetail, { id }),
  networkInspectorClearEvents: (deviceIps?: string[]) =>
    ipcRenderer.invoke(IPC.NetworkInspectorClearEvents, { deviceIps }),
  networkInspectorSetRecording: (payload: { deviceIps: string[]; recording: boolean }) =>
    ipcRenderer.invoke(IPC.NetworkInspectorSetRecording, payload),
  networkInspectorExportPcap: (deviceIps?: string[]) =>
    ipcRenderer.invoke(IPC.NetworkInspectorExportPcap, { deviceIps }),
  networkInspectorGetCaInfo: () => ipcRenderer.invoke(IPC.NetworkInspectorGetCaInfo),
  networkInspectorExportCaPem: () => ipcRenderer.invoke(IPC.NetworkInspectorExportCaPem),
  networkInspectorExportCaCert: () => ipcRenderer.invoke(IPC.NetworkInspectorExportCaCert),
  networkInspectorInstallBpfAccess: () => ipcRenderer.invoke(IPC.NetworkInspectorInstallBpfAccess),
  networkInspectorGetTrafficRules: () => ipcRenderer.invoke(IPC.NetworkInspectorGetTrafficRules),
  /** Open the Settings window, optionally navigated to a section (e.g. 'network-inspector'). */
  openSettings: (section?: string) => ipcRenderer.send(IPC.SettingsOpen, { section }),
  networkInspectorSetDeviceTrafficRules: (deviceIp: string, rules: unknown) =>
    ipcRenderer.invoke(IPC.NetworkInspectorSetDeviceTrafficRules, { deviceIp, rules }),
  onNetworkInspectorStatus: (callback: (status: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on(IPC.NetworkInspectorStatus, handler);
    return () => ipcRenderer.removeListener(IPC.NetworkInspectorStatus, handler);
  },
  onNetworkInspectorCaptureEvents: (callback: (events: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, events: unknown) => callback(events);
    ipcRenderer.on(IPC.NetworkInspectorCaptureEvents, handler);
    return () => ipcRenderer.removeListener(IPC.NetworkInspectorCaptureEvents, handler);
  },
  onNetworkInspectorDeviceJoined: (callback: (payload: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on(IPC.NetworkInspectorDeviceJoined, handler);
    return () => ipcRenderer.removeListener(IPC.NetworkInspectorDeviceJoined, handler);
  },
  onNetworkInspectorDeviceLeft: (callback: (payload: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on(IPC.NetworkInspectorDeviceLeft, handler);
    return () => ipcRenderer.removeListener(IPC.NetworkInspectorDeviceLeft, handler);
  },
  onNetworkInspectorDeviceDiscovered: (callback: (payload: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on(IPC.NetworkInspectorDeviceDiscovered, handler);
    return () => ipcRenderer.removeListener(IPC.NetworkInspectorDeviceDiscovered, handler);
  },
  onNetworkInspectorClientsCleared: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.NetworkInspectorClientsCleared, handler);
    return () => ipcRenderer.removeListener(IPC.NetworkInspectorClientsCleared, handler);
  },

  // ============================================
  // BrightScript Fiddle (standalone window)
  // ============================================

  /** File menu "Open Fiddle" → main asks renderer for a device snapshot, renderer responds with openFiddle. */
  onOpenFiddleRequested: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.FiddleOpen, handler);
    return () => ipcRenderer.removeListener(IPC.FiddleOpen, handler);
  },

  /** Open the Fiddle window with a device snapshot supplied by the main renderer. */
  openFiddle: (payload: { devices: unknown[]; initialDeviceId?: string | null }) =>
    ipcRenderer.send(IPC.FiddleOpen, payload),

  /** Push fresh device snapshots to any open Fiddle windows. */
  pushFiddleDevices: (payload: { devices: unknown[] }) =>
    ipcRenderer.send(IPC.FiddlePushDevices, payload),

  /** Push a scan status (e.g. spinner on/off) to any open Fiddle windows. */
  pushFiddleScanStatus: (payload: { scanning: boolean }) =>
    ipcRenderer.send(IPC.FiddleScanStatus, payload),

  /** Fiddle window asked for a fresh device list. */
  onFiddleRefreshRequested: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.FiddleRefreshDevices, handler);
    return () => ipcRenderer.removeListener(IPC.FiddleRefreshDevices, handler);
  },

  /** Main process detected an auth failure for `deviceId` and wants the
   * renderer to wipe the persisted developer password so subsequent Fiddle
   * (or other) actions re-prompt rather than silently retrying a stale
   * password. */
  onFiddleClearPasswordRequested: (
    callback: (payload: { deviceId: string }) => void
  ) => {
    const handler = (_event: IpcRendererEvent, payload: { deviceId: string }) =>
      callback(payload);
    ipcRenderer.on(IPC.FiddleClearPasswordRequest, handler);
    return () => ipcRenderer.removeListener(IPC.FiddleClearPasswordRequest, handler);
  }
});

// Shared pure logic from roku-dev-studio-api (renderer has nodeIntegration: false)
contextBridge.exposeInMainWorld('rokuNormalize', {
  normalizeRaleFunctions: (raw: unknown) => normalizeRaleFunctions(raw),
  parseGetExternalControlFunctionsResponse: (raleResult: unknown) =>
    parseGetExternalControlFunctionsResponse(raleResult)
});

contextBridge.exposeInMainWorld('actionScriptWaitCore', {
  parseMediaPlayerXml: (xmlText: string) => actionScriptWaitCore.parseMediaPlayerXml(xmlText),
  evaluateWaitCheck: (check: unknown, data: unknown) => actionScriptWaitCore.evaluateWaitCheck(check, data),
  sleepWithStop: (ms: number, shouldStop: unknown, chunkMs?: number) =>
    actionScriptWaitCore.sleepWithStop(ms, shouldStop, chunkMs),
  isValidMediaPlayerState: (state: unknown) => actionScriptWaitCore.isValidMediaPlayerState(state),
  resolveMediaPlayerWaitExpectedState: (condition: unknown) =>
    actionScriptWaitCore.resolveMediaPlayerWaitExpectedState(condition)
});

contextBridge.exposeInMainWorld('actionScriptVariables', {
  isValidOutputName: (name: unknown) => actionScriptVariables.isValidOutputName(name),
  getAssignToVarName: (step: unknown) => actionScriptVariables.getAssignToVarName(step),
  validateOutputFields: (script: unknown) => actionScriptVariables.validateOutputFields(script),
  resolveStepWithVariables: (step: unknown, variables: unknown) =>
    actionScriptVariables.resolveStepWithVariables(step, variables),
  raleCommandSupportsAssignToVar: (command: unknown) => actionScriptVariables.raleCommandSupportsAssignToVar(command),
  parseVariableDotPath: (pathStr: unknown) => actionScriptVariables.parseVariableDotPath(pathStr)
});

// Canonical Action Script validator — single source of truth for the rules
// the Builder, the headless CLI, and the MCP `validate_script` tool all
// enforce. See `.discussion-docs/unified-action-script-validation.md`.
contextBridge.exposeInMainWorld('actionScriptValidator', {
  validateScript: (input: unknown, options?: unknown) => actionScriptValidator.validateScript(input, options || {}),
  /**
   * Validate + normalize wire args for a `raleCommand` step. The renderer's
   * Action Script Executor (`executor-engine.ts`) and the Builder UI both
   * call this through the preload bridge so the rules stay in lock-step
   * with the canonical validator's deep raleCommand check.
   */
  validateRaleCommandArgs: (command: unknown, args: unknown) =>
    actionScriptRaleCommandArgs.validateAndNormalizeRaleCommandArgs(command, args)
});

contextBridge.exposeInMainWorld('actionScriptIf', {
  evaluateIfConditionOnce: (
    condition: unknown,
    variables: unknown,
    api: unknown,
    raleCommand: unknown
  ) =>
    actionScriptIfEval.evaluateIfConditionOnce(
      condition,
      variables,
      api,
      typeof raleCommand === 'function' ? raleCommand : null
    ),
  validateIfConditionShape: (cond: unknown, mediaPlayerStateValues: unknown) =>
    actionScriptIfEval.validateIfConditionShape(cond, mediaPlayerStateValues || []),
  RALE_NODE_FIELD_OPERATORS: actionScriptNodeFieldConstants.RALE_NODE_FIELD_OPERATORS,
  OPS_NEED_VALUE: Array.from(actionScriptNodeFieldConstants.OPS_NEED_VALUE)
});

const rdsPlatform =
  typeof process !== 'undefined' && typeof process.platform === 'string' ? process.platform : 'unknown';
contextBridge.exposeInMainWorld('rdsShell', {
  platform: rdsPlatform,
  appMenuAction: (action: string) => ipcRenderer.invoke(IPC.AppMenuAction, action),
  showAboutDialog: () => ipcRenderer.invoke(IPC.ShowAboutDialog),
  minimizeWindow: () => ipcRenderer.send(IPC.MainWindowMinimize),
  toggleMaximizeWindow: () => ipcRenderer.send(IPC.MainWindowToggleMaximize),
  closeWindow: () => ipcRenderer.send(IPC.MainWindowClose),
  isMainWindowMaximized: () => ipcRenderer.invoke(IPC.IsMainWindowMaximized) as Promise<{ maximized?: boolean }>,
  onMainWindowMaximizeChanged: (callback: (maximized: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, maximized: boolean) => callback(!!maximized);
    ipcRenderer.on(IPC.MainWindowMaximizeChanged, handler);
    return () => ipcRenderer.removeListener(IPC.MainWindowMaximizeChanged, handler);
  },
  /**
   * Subscribe to webContents zoom-factor changes (View > Zoom In/Out/Reset,
   * ⌘=/⌘-/⌘0, Ctrl+wheel). Main also fires this once on `did-finish-load`
   * so the renderer can sync `--app-zoom` before first paint and the
   * frameless title bar starts at the correct screen-pixel size. Returns
   * an unsubscribe fn. See `apps/roku-dev-studio/main.ts::applyZoomFactor`.
   */
  onAppZoomChanged: (callback: (factor: number) => void) => {
    const handler = (_event: IpcRendererEvent, payload: { factor: number }) => {
      const factor = payload && typeof payload.factor === 'number' ? payload.factor : 1;
      callback(factor);
    };
    ipcRenderer.on(IPC.AppZoomChanged, handler);
    return () => ipcRenderer.removeListener(IPC.AppZoomChanged, handler);
  },
  /**
   * Request a zoom step from the title-bar indicator. Main re-uses its
   * `zoomIn`/`zoomOut`/`resetZoom` (clamped + broadcast via `AppZoomChanged`),
   * so the renderer never sets the zoom factor itself — the indicator label
   * + visibility update from the broadcast above.
   */
  zoomIn: () => ipcRenderer.send(IPC.AppZoomChange, { direction: 'in' }),
  zoomOut: () => ipcRenderer.send(IPC.AppZoomChange, { direction: 'out' }),
  zoomReset: () => ipcRenderer.send(IPC.AppZoomChange, { direction: 'reset' })
});

// MCP bridge: renderer pushes selected-device + App Connector state to main so
// the bundled MCP server can serve live tools. Main may also push a "drop this
// Action Script into the Builder" request from an external agent.
contextBridge.exposeInMainWorld('rdsMcpBridge', {
  reportState: (payload: unknown) => ipcRenderer.send(IPC.McpBridgeReportState, payload),
  ackDrop: (payload: { correlationId: string; ok: boolean; error?: string }) =>
    ipcRenderer.send(IPC.McpBridgeDropScriptResult, payload),
  onDropScript: (
    callback: (payload: {
      correlationId: string;
      script: unknown;
      targetSerial?: string;
      targetIp?: string;
    }) => void
  ) => {
    const handler = (
      _event: IpcRendererEvent,
      payload: { correlationId: string; script: unknown; targetSerial?: string; targetIp?: string }
    ) => callback(payload);
    ipcRenderer.on(IPC.McpBridgeDropScript, handler);
    return () => ipcRenderer.removeListener(IPC.McpBridgeDropScript, handler);
  },
  ackRale: (payload: { correlationId: string; ok: boolean; data?: unknown; error?: string }) =>
    ipcRenderer.send(IPC.McpBridgeRaleResult, payload),
  onRaleRequest: (
    callback: (payload: {
      correlationId: string;
      command: string;
      args: unknown;
      targetSerial?: string;
      targetIp?: string;
    }) => void
  ) => {
    const handler = (
      _event: IpcRendererEvent,
      payload: {
        correlationId: string;
        command: string;
        args: unknown;
        targetSerial?: string;
        targetIp?: string;
      }
    ) => callback(payload);
    ipcRenderer.on(IPC.McpBridgeRaleRequest, handler);
    return () => ipcRenderer.removeListener(IPC.McpBridgeRaleRequest, handler);
  },
  ackFunctions: (payload: {
    correlationId: string;
    ok: boolean;
    status?: string;
    functions?: unknown[];
    error?: string;
  }) => ipcRenderer.send(IPC.McpBridgeFunctionsResult, payload),
  onFunctionsRequest: (
    callback: (payload: { correlationId: string; targetSerial?: string; targetIp?: string }) => void
  ) => {
    const handler = (
      _event: IpcRendererEvent,
      payload: { correlationId: string; targetSerial?: string; targetIp?: string }
    ) => callback(payload);
    ipcRenderer.on(IPC.McpBridgeFunctionsRequest, handler);
    return () => ipcRenderer.removeListener(IPC.McpBridgeFunctionsRequest, handler);
  },
  ackConnect: (payload: { correlationId: string; ok: boolean; device?: unknown; error?: string }) =>
    ipcRenderer.send(IPC.McpBridgeConnectResult, payload),
  onConnectRequest: (
    callback: (payload: { correlationId: string; targetSerial?: string; targetIp?: string }) => void
  ) => {
    const handler = (
      _event: IpcRendererEvent,
      payload: { correlationId: string; targetSerial?: string; targetIp?: string }
    ) => callback(payload);
    ipcRenderer.on(IPC.McpBridgeConnectRequest, handler);
    return () => ipcRenderer.removeListener(IPC.McpBridgeConnectRequest, handler);
  },
  ackTool: (payload: { correlationId: string; ok: boolean; data?: unknown; error?: string }) =>
    ipcRenderer.send(IPC.McpBridgeToolResult, payload),
  onToolRequest: (
    callback: (payload: {
      correlationId: string;
      tool: string;
      args: unknown;
      targetSerial?: string;
      targetIp?: string;
    }) => void
  ) => {
    const handler = (
      _event: IpcRendererEvent,
      payload: {
        correlationId: string;
        tool: string;
        args: unknown;
        targetSerial?: string;
        targetIp?: string;
      }
    ) => callback(payload);
    ipcRenderer.on(IPC.McpBridgeToolRequest, handler);
    return () => ipcRenderer.removeListener(IPC.McpBridgeToolRequest, handler);
  },
  onAgentAction: (
    callback: (payload: {
      level: 'info' | 'destructive';
      summary: string;
      details?: Record<string, unknown>;
    }) => void
  ) => {
    const handler = (
      _event: IpcRendererEvent,
      payload: {
        level: 'info' | 'destructive';
        summary: string;
        details?: Record<string, unknown>;
      }
    ) => callback(payload);
    ipcRenderer.on(IPC.McpBridgeAgentAction, handler);
    return () => ipcRenderer.removeListener(IPC.McpBridgeAgentAction, handler);
  },
  onAgentScreenshot: (
    callback: (payload: {
      ip: string;
      dataUrl: string;
      filename: string;
      bytes: number;
      mimeType: string;
    }) => void
  ) => {
    const handler = (
      _event: IpcRendererEvent,
      payload: { ip: string; dataUrl: string; filename: string; bytes: number; mimeType: string }
    ) => callback(payload);
    ipcRenderer.on(IPC.McpBridgeAgentScreenshot, handler);
    return () => ipcRenderer.removeListener(IPC.McpBridgeAgentScreenshot, handler);
  },
  ackStoredPassword: (payload: { correlationId: string; password?: string }) =>
    ipcRenderer.send(IPC.McpBridgeStoredPasswordResult, payload),
  onStoredPasswordRequest: (
    callback: (payload: { correlationId: string; serial: string }) => void
  ) => {
    const handler = (
      _event: IpcRendererEvent,
      payload: { correlationId: string; serial: string }
    ) => callback(payload);
    ipcRenderer.on(IPC.McpBridgeStoredPasswordRequest, handler);
    return () => ipcRenderer.removeListener(IPC.McpBridgeStoredPasswordRequest, handler);
  }
});

contextBridge.exposeInMainWorld('rdsUpdater', {
  check: () => ipcRenderer.invoke(IPC.UpdaterCheck),
  download: () => ipcRenderer.invoke(IPC.UpdaterDownload),
  install: () => ipcRenderer.invoke(IPC.UpdaterInstall),
  getLatestReleaseInfo: () => ipcRenderer.invoke(IPC.UpdaterLatestReleaseInfo),
  getStatus: () => ipcRenderer.invoke(IPC.UpdaterStatus),
  onStatus: (callback: (status: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on(IPC.UpdaterStatus, handler);
    return () => ipcRenderer.removeListener(IPC.UpdaterStatus, handler);
  }
});

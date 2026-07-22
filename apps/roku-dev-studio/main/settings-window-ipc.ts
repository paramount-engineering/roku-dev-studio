/**
 * IPC for the Settings modal window: load/save app-settings.json + sync modes with main process.
 */

import type { Dialog, IpcMain, IpcMainInvokeEvent, Menu } from 'electron';
import { IPC } from '../shared/ipc/channels';
import { loadSettings, saveSettings } from './settings';
import {
  applyMcpClients,
  detectMcpClients,
  MCP_CLIENT_IDS,
  sanitizeMcpClientsPayload
} from './mcp-clients';
import type { McpClientId } from './mcp-clients';
import { initNetworkInspectorFromSettings } from './network-inspector/index';
import { getCapturePlatform } from './network-inspector/index';
import {
  DEFAULT_MAX_RAW_PACKETS_PER_DEVICE,
  clampMaxRawPacketsPerDevice,
  DEFAULT_MAX_BODY_RETAINED_BYTES,
  clampMaxBodyRetainedBytes
} from '../shared/network-inspector/types';

const sharedConstants = require('roku-dev-studio-api/lib/shared-constants') as Record<string, number>;

export const TIMING_KEYS = [
  'DEFAULT_RALE_PORT',
  'SCREENSHOT_DEBOUNCE_DELAY',
  'SCREENSHOT_AFTER_LAUNCH_DELAY',
  'TELNET_TIMEOUT',
  'CONNECTION_CHECK_INTERVAL',
  'DEVICE_METRICS_SAMPLE_INTERVAL_MS',
  'DEVICE_METRICS_CHART_HISTORY_MS',
  'TOAST_DISPLAY_DURATION',
  'STATUS_MESSAGE_DURATION'
] as const;

export type TimingKey = (typeof TIMING_KEYS)[number];

const BOUNDS: Record<TimingKey, { min: number; max: number }> = {
  DEFAULT_RALE_PORT: { min: 1, max: 65535 },
  SCREENSHOT_DEBOUNCE_DELAY: { min: 0, max: 120_000 },
  SCREENSHOT_AFTER_LAUNCH_DELAY: { min: 0, max: 120_000 },
  TELNET_TIMEOUT: { min: 1_000, max: 600_000 },
  CONNECTION_CHECK_INTERVAL: { min: 3_000, max: 600_000 },
  DEVICE_METRICS_SAMPLE_INTERVAL_MS: { min: 500, max: 5000 },
  DEVICE_METRICS_CHART_HISTORY_MS: { min: 300_000, max: 3_600_000 },
  /** Stored as ms; Settings UI shows seconds (2–10). */
  TOAST_DISPLAY_DURATION: { min: 2000, max: 10_000 },
  STATUS_MESSAGE_DURATION: { min: 2000, max: 10_000 }
};

const TIMING_LABELS: Record<TimingKey, { title: string; hint: string }> = {
  DEFAULT_RALE_PORT: { title: 'RALE / App Connector Port', hint: 'TCP Port (Default 49200).' },
  SCREENSHOT_DEBOUNCE_DELAY: {
    title: 'Screenshot Debounce (ms)',
    hint: 'Delay after key press before auto-screenshot.'
  },
  SCREENSHOT_AFTER_LAUNCH_DELAY: {
    title: 'Screenshot After Launch (ms)',
    hint: 'Wait after Dev App launch before screenshot.'
  },
  TELNET_TIMEOUT: { title: 'Telnet Connect Timeout (ms)', hint: 'Debug Console / System Telnet.' },
  CONNECTION_CHECK_INTERVAL: {
    title: 'Device Active Check (ms)',
    hint:
      'How often connected devices are polled: device info, ECP state, and whether the Dev App channel is in the foreground.'
  },
  DEVICE_METRICS_SAMPLE_INTERVAL_MS: {
    title: 'Sampling Rate (ms)',
    hint:
      'Chanperf + object-count poll cadence. Lower = fresher data, more ECP traffic; needs Developer Mode and Control by Mobile Apps.'
  },
  DEVICE_METRICS_CHART_HISTORY_MS: {
    title: 'Chart History Time (minutes)',
    hint: 'How far back the CPU and System Memory charts plot'
  },
  TOAST_DISPLAY_DURATION: { title: 'Toast Duration (s)', hint: 'Success/error toast visibility.' },
  STATUS_MESSAGE_DURATION: { title: 'Status Message Duration (s)', hint: 'Header Status Line Visibility.' }
};

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const x = Number(v);
    if (Number.isFinite(x)) return x;
  }
  return null;
}

/** Sanitize timing object from client: clamp known keys only. */
export function sanitizeTimingOverrides(raw: unknown): Partial<Record<TimingKey, number>> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<TimingKey, number>> = {};
  for (const key of TIMING_KEYS) {
    if (!(key in o)) continue;
    const n = coerceNumber(o[key]);
    if (n == null) continue;
    const { min, max } = BOUNDS[key];
    out[key] = clampInt(n, min, max);
  }
  return out;
}

export function getCompileDefaults(): Record<TimingKey, number> {
  const out = {} as Record<TimingKey, number>;
  for (const key of TIMING_KEYS) {
    const v = sharedConstants[key];
    out[key] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }
  return out;
}

export type SettingsWindowSavePayload = {
  developerModeEnabled: boolean;
  privacyModeEnabled: boolean;
  debugLoggingEnabled: boolean;
  timingOverrides: Record<string, unknown>;
  actionScriptDefaultSaveFolder: string;
  /** When true, Remote Section remembers Show Device Performance per device. Default off until enabled in Settings. */
  devicePerformanceRememberQuadPerDevice: boolean;
  /** When true, keyboard drives the Roku only on Remote / Dev App inner tabs for the active device tab. */
  keyboardRemoteShortcutsEnabled: boolean;
  /** When true, after discovery on launch, reconnect if the last-used device is present. */
  autoConnectLastDeviceEnabled: boolean;
  /** When true, persist primary sidebar collapsed state (localStorage). Default off. */
  rememberSidebarToggle: boolean;
  /**
   * When true, Dev Passwords are persisted across launches via the OS
   * keychain (`safeStorage`). Default **off** — on macOS this causes a
   * one-time system password prompt the first time the keychain entry is
   * accessed, which we want to keep opt-in. When Off, Dev Passwords are
   * remembered only for the current session (in-memory).
   */
  rememberPasswordsInKeychain: boolean;
  /**
   * Per-client MCP enablement. Toggling a client on writes the
   * `roku-dev-studio` server entry into that client's MCP config; toggling
   * off removes it. Keys not present here are left untouched.
   */
  mcpClients?: Partial<Record<McpClientId, boolean>>;
  /** When true, Network Inspector captures hotspot traffic for local devices. */
  networkInspectorEnabled: boolean;
  networkInspectorMitmEnabled?: boolean;
  networkInspectorMitmPort?: number;
  /** Max raw frames retained per device for the per-device pcap export. */
  networkInspectorMaxRawPacketsPerDevice?: number;
  /** Max bytes of each body retained for display (snapshot-only; never affects forwarded traffic). */
  networkInspectorMaxBodyRetainedBytes?: number;
  /** Host OS for the running app (`darwin` | `win32` | `linux`). */
  hostPlatform: string;
};

type AppStateRef = {
  developerModeEnabled: boolean;
  privacyModeEnabled: boolean;
  debugLoggingEnabled: boolean;
  logFile: string | null;
};

type SecretStoreStatusSnapshot = {
  status: string;
  backend: string;
};

type RegisterDeps = {
  getAppState: () => AppStateRef;
  getSecretStoreStatus: () => SecretStoreStatusSnapshot;
  applyModesAfterSave: (
    developerModeEnabled: boolean,
    privacyModeEnabled: boolean,
    debugLoggingEnabled: boolean
  ) => void;
  /**
   * Called when the user flips the "Remember device passwords in system
   * keychain" toggle. Main wires this to `secretStore.setEnabled(next)` so
   * a flip-on triggers the one-shot keychain hydration (the only point where
   * `safeStorage.*` is allowed to prompt the OS).
   */
  applyRememberPasswordsInKeychain: (rememberPasswordsInKeychain: boolean) => void;
  notifyRenderer: (channel: string, data: unknown) => void;
};

function syncFileMenuCheckboxes(
  Menu: typeof import('electron').Menu,
  dev: boolean,
  privacy: boolean,
  debug: boolean
) {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;
  const fileMenu = menu.items.find((item) => item.label === 'File');
  if (!fileMenu || !fileMenu.submenu) return;
  for (const item of fileMenu.submenu.items) {
    if (item.label === 'Developer Mode') item.checked = dev;
    if (item.label === 'Privacy Mode') item.checked = privacy;
    if (item.label === 'Debug Logging') item.checked = debug;
  }
}

/** Connected Remote Locations (id/name/serverUrl) for the Settings Network Inspector place picker. */
function readRemoteLocations(
  settings: Record<string, unknown>
): Array<{ id: string; name: string; serverUrl: string; host: string }> {
  const raw = settings['remote-locations'];
  if (!Array.isArray(raw)) return [];
  const out: Array<{ id: string; name: string; serverUrl: string; host: string }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const serverUrl = typeof o.serverUrl === 'string' ? o.serverUrl : '';
    if (!serverUrl) continue;
    // Prefer the stored host; fall back to parsing it out of the server URL.
    let host = typeof o.host === 'string' && o.host.trim() ? o.host.trim() : '';
    if (!host) {
      try {
        host = new URL(serverUrl).hostname;
      } catch {
        host = '';
      }
    }
    out.push({
      id: typeof o.id === 'string' ? o.id : serverUrl,
      name: typeof o.name === 'string' && o.name.trim() ? o.name : serverUrl,
      serverUrl,
      host
    });
  }
  return out;
}

/** Minimal JSON HTTP request to a remote location server (probe capabilities / network config). */
function settingsRemoteHttp(
  serverUrl: string,
  pathStr: string,
  method = 'GET',
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    try {
      const url = new URL(pathStr, serverUrl);
      const isHttps = url.protocol === 'https:';
      const mod = require(isHttps ? 'https' : 'http');
      const headers: Record<string, string | number> = {};
      let postData: string | null = null;
      if (body) {
        postData = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(postData);
      }
      const req = mod.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          method,
          headers,
          timeout: 8000
        },
        (res: import('http').IncomingMessage) => {
          let data = '';
          res.on('data', (c: Buffer | string) => (data += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({ success: false, error: 'Invalid JSON response' });
            }
          });
        }
      );
      req.on('error', (e: Error) => resolve({ success: false, error: e.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Request timed out' });
      });
      if (postData) req.write(postData);
      req.end();
    } catch (e) {
      resolve({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}

/**
 * Register IPC used by the Settings window preload.
 */
function registerSettingsWindowIpc(
  ipcMain: IpcMain,
  Menu: typeof import('electron').Menu,
  dialog: Dialog,
  deps: RegisterDeps
) {
  const { BrowserWindow, shell } = require('electron') as typeof import('electron');

  ipcMain.on(IPC.SettingsWindowClose, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    (win as import('electron').BrowserWindow & { __rdsDestroying?: boolean }).__rdsDestroying = true;
    win.destroy();
  });

  ipcMain.handle(
    IPC.SettingsWindowOpenMcpConfig,
    async (_event: IpcMainInvokeEvent, payload: { id?: unknown }) => {
      const id = typeof payload?.id === 'string' ? (payload.id as McpClientId) : null;
      if (!id || !MCP_CLIENT_IDS.includes(id)) {
        return { success: false, error: 'Unknown MCP client id.' };
      }
      const det = detectMcpClients().find((d) => d.id === id);
      if (!det || !det.installed || !det.configPath) {
        return { success: false, error: 'Client not installed or config path unavailable.' };
      }
      try {
        const errMsg = await shell.openPath(det.configPath);
        if (errMsg) {
          // No default app for the file (or it failed); fall back to revealing it in the OS file browser.
          shell.showItemInFolder(det.configPath);
          return { success: true, revealed: true, path: det.configPath, openError: errMsg };
        }
        return { success: true, opened: true, path: det.configPath };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    }
  );

  ipcMain.handle(
    IPC.SettingsWindowRemoteNetworkProbe,
    async (_event: IpcMainInvokeEvent, payload: { serverUrl?: string }) => {
      const serverUrl = typeof payload?.serverUrl === 'string' ? payload.serverUrl : '';
      if (!serverUrl) return { success: false, error: 'serverUrl required' };
      const [caps, cfg, status] = await Promise.all([
        settingsRemoteHttp(serverUrl, '/capabilities'),
        settingsRemoteHttp(serverUrl, '/network/config'),
        settingsRemoteHttp(serverUrl, '/network/status')
      ]);
      const capabilities = (caps?.capabilities as Record<string, unknown> | undefined) || undefined;
      // The server responded with a capabilities payload → it's reachable / "connected".
      const reachable = !!capabilities;
      return {
        success: true,
        reachable,
        networkInspector: capabilities?.networkInspector ?? null,
        config: cfg?.config ?? null,
        status: status?.status ?? null
      };
    }
  );

  ipcMain.handle(
    IPC.SettingsWindowRemoteNetworkSetConfig,
    async (
      _event: IpcMainInvokeEvent,
      payload: { serverUrl?: string; config?: Record<string, unknown> }
    ) => {
      const serverUrl = typeof payload?.serverUrl === 'string' ? payload.serverUrl : '';
      if (!serverUrl) return { success: false, error: 'serverUrl required' };
      return await settingsRemoteHttp(serverUrl, '/network/config', 'PUT', payload?.config || {});
    }
  );

  ipcMain.handle(IPC.SettingsWindowGetState, async () => {
    const settings = loadSettings();
    const st = deps.getAppState();
    const timingRaw = settings['rds-timing-overrides'];
    const timingStored =
      timingRaw != null && typeof timingRaw === 'object' && !Array.isArray(timingRaw)
        ? (timingRaw as Record<string, unknown>)
        : {};
    const timingEffective = { ...getCompileDefaults(), ...sanitizeTimingOverrides(timingStored) };
    const folderRaw = settings['action-script-default-save-folder'];
    const actionScriptDefaultSaveFolder =
      typeof folderRaw === 'string' && folderRaw.trim() !== '' ? folderRaw.trim() : '';
    const rememberRaw = settings['devicePerformanceRememberQuadPerDevice'];
    const devicePerformanceRememberQuadPerDevice =
      typeof rememberRaw === 'boolean' ? rememberRaw : false;
    const kbRaw = settings['keyboardRemoteShortcutsEnabled'];
    const keyboardRemoteShortcutsEnabled = typeof kbRaw === 'boolean' ? kbRaw : false;
    const autoConnRaw = settings['autoConnectLastDeviceEnabled'];
    const autoConnectLastDeviceEnabled = typeof autoConnRaw === 'boolean' ? autoConnRaw : false;
    const rememberSidebarRaw = settings['rememberSidebarToggle'];
    const rememberSidebarToggle = typeof rememberSidebarRaw === 'boolean' ? rememberSidebarRaw : false;
    const rememberPasswordsInKeychainRaw = settings['rememberPasswordsInKeychain'];
    const rememberPasswordsInKeychain =
      typeof rememberPasswordsInKeychainRaw === 'boolean' ? rememberPasswordsInKeychainRaw : false;
    const networkInspectorEnabled = settings['networkInspectorEnabled'] === true;
    // MITM proxy is always on with the inspector (no dedicated toggle); default true.
    const networkInspectorMitmEnabled = settings['networkInspectorMitmEnabled'] !== false;
    const mitmPortRaw = settings['networkInspectorMitmPort'];
    const networkInspectorMitmPort =
      typeof mitmPortRaw === 'number' && mitmPortRaw > 0 && mitmPortRaw < 65536
        ? Math.floor(mitmPortRaw)
        : 8888;
    const networkInspectorMaxRawPacketsPerDevice =
      'networkInspectorMaxRawPacketsPerDevice' in settings
        ? clampMaxRawPacketsPerDevice(settings['networkInspectorMaxRawPacketsPerDevice'])
        : DEFAULT_MAX_RAW_PACKETS_PER_DEVICE;
    const networkInspectorMaxBodyRetainedBytes =
      'networkInspectorMaxBodyRetainedBytes' in settings
        ? clampMaxBodyRetainedBytes(settings['networkInspectorMaxBodyRetainedBytes'])
        : DEFAULT_MAX_BODY_RETAINED_BYTES;

    const mcpDetections = detectMcpClients();
    const mcpEnabledRaw = settings['mcpEnabledClients'];
    const mcpEnabledStored =
      mcpEnabledRaw && typeof mcpEnabledRaw === 'object' && !Array.isArray(mcpEnabledRaw)
        ? (mcpEnabledRaw as Record<string, unknown>)
        : {};
    /**
     * The "true" enabled state is whatever is on disk in the client's MCP
     * config. The stored map is only used as a fallback when an installed
     * client hasn't been touched yet.
     */
    const mcpClientsState: Record<McpClientId, boolean> = {} as Record<McpClientId, boolean>;
    for (const det of mcpDetections) {
      const stored = typeof mcpEnabledStored[det.id] === 'boolean' ? (mcpEnabledStored[det.id] as boolean) : false;
      mcpClientsState[det.id] = det.installed ? det.enabledOnDisk : stored;
    }

    return {
      developerModeEnabled: st.developerModeEnabled,
      privacyModeEnabled: st.privacyModeEnabled,
      debugLoggingEnabled: st.debugLoggingEnabled,
      logFilePath: st.logFile,
      timingOverrides: timingEffective,
      compileDefaults: getCompileDefaults(),
      timingMeta: Object.fromEntries(
        TIMING_KEYS.map((k) => [k, { ...TIMING_LABELS[k], ...BOUNDS[k] }])
      ) as Record<TimingKey, { title: string; hint: string; min: number; max: number }>,
      actionScriptDefaultSaveFolder,
      devicePerformanceRememberQuadPerDevice,
      keyboardRemoteShortcutsEnabled,
      autoConnectLastDeviceEnabled,
      rememberSidebarToggle,
      rememberPasswordsInKeychain,
      networkInspectorEnabled,
      networkInspectorMitmEnabled,
      networkInspectorMitmPort,
      networkInspectorMaxRawPacketsPerDevice,
      networkInspectorMaxBodyRetainedBytes,
      hostPlatform: process.platform,
      remoteLocations: readRemoteLocations(settings),
      // Capture readiness comes from the per-OS capture worker — no platform branching here. Off-
      // platform detail flags default to "available" so the settings UI only gates on the host's
      // relevant prerequisite (matching the previous per-detector defaults).
      ...(() => {
        const readiness = getCapturePlatform().getReadiness();
        return {
          bpfCaptureAvailable: readiness.bpfCaptureAvailable ?? true,
          bpfLaunchDaemonInstalled: readiness.bpfLaunchDaemonInstalled ?? false,
          captureToolAvailable: readiness.captureToolAvailable,
          linuxCaptureAvailable: readiness.linuxCaptureAvailable ?? true,
          capModuleAvailable: readiness.capModuleAvailable ?? true
        };
      })(),
      secretStoreStatus: deps.getSecretStoreStatus(),
      mcpClients: mcpClientsState,
      mcpClientDetections: mcpDetections.map((d) => ({
        id: d.id,
        label: d.label,
        installed: d.installed,
        configPath: d.configPath
      }))
    };
  });

  ipcMain.handle(IPC.SettingsWindowPickFolder, async (event: IpcMainInvokeEvent) => {
    const { BrowserWindow } = require('electron');
    const parent = BrowserWindow.fromWebContents(event.sender);
    try {
      const result = await dialog.showOpenDialog(parent ?? undefined, {
        title: 'Default folder for Action Script output',
        properties: ['openDirectory']
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      return { success: true, folderPath: result.filePaths[0] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle(
    IPC.SettingsWindowSave,
    async (_event: IpcMainInvokeEvent, payload: SettingsWindowSavePayload) => {
      try {
        const timing = sanitizeTimingOverrides(payload.timingOverrides);
        const folder = String(payload.actionScriptDefaultSaveFolder || '').trim();

        const settings = loadSettings();
        settings['rds-timing-overrides'] = timing;
        if (folder) {
          settings['action-script-default-save-folder'] = folder;
        } else {
          delete settings['action-script-default-save-folder'];
        }
        settings['devicePerformanceRememberQuadPerDevice'] = !!payload.devicePerformanceRememberQuadPerDevice;
        settings['keyboardRemoteShortcutsEnabled'] = !!payload.keyboardRemoteShortcutsEnabled;
        settings['autoConnectLastDeviceEnabled'] = !!payload.autoConnectLastDeviceEnabled;
        settings['rememberSidebarToggle'] = !!payload.rememberSidebarToggle;
        settings['rememberPasswordsInKeychain'] = !!payload.rememberPasswordsInKeychain;
        settings['networkInspectorEnabled'] = !!payload.networkInspectorEnabled;
        settings['networkInspectorMitmEnabled'] = !!payload.networkInspectorMitmEnabled;
        if (typeof payload.networkInspectorMitmPort === 'number') {
          settings['networkInspectorMitmPort'] = Math.max(
            1,
            Math.min(65535, Math.floor(payload.networkInspectorMitmPort))
          );
        }
        const niMaxRawPackets =
          typeof payload.networkInspectorMaxRawPacketsPerDevice === 'number'
            ? clampMaxRawPacketsPerDevice(payload.networkInspectorMaxRawPacketsPerDevice)
            : DEFAULT_MAX_RAW_PACKETS_PER_DEVICE;
        settings['networkInspectorMaxRawPacketsPerDevice'] = niMaxRawPackets;
        const niMaxBodyRetainedBytes =
          typeof payload.networkInspectorMaxBodyRetainedBytes === 'number'
            ? clampMaxBodyRetainedBytes(payload.networkInspectorMaxBodyRetainedBytes)
            : DEFAULT_MAX_BODY_RETAINED_BYTES;
        settings['networkInspectorMaxBodyRetainedBytes'] = niMaxBodyRetainedBytes;
        settings.debugLoggingEnabled = !!payload.debugLoggingEnabled;

        const mcpRequested = sanitizeMcpClientsPayload(payload.mcpClients);
        const mcpResults = applyMcpClients(mcpRequested);
        const mcpStored: Record<string, boolean> = {};
        const prevStored = settings['mcpEnabledClients'];
        if (prevStored && typeof prevStored === 'object' && !Array.isArray(prevStored)) {
          for (const id of MCP_CLIENT_IDS) {
            const v = (prevStored as Record<string, unknown>)[id];
            if (typeof v === 'boolean') mcpStored[id] = v;
          }
        }
        for (const r of mcpResults) {
          mcpStored[r.id] = r.enabled;
        }
        settings['mcpEnabledClients'] = mcpStored;

        if (!saveSettings(settings)) {
          return { success: false, error: 'Could not write settings file.' };
        }

        const mcpErrors = mcpResults.filter((r) => r.error);

        const d = !!payload.developerModeEnabled;
        const p = !!payload.privacyModeEnabled;
        const dbg = !!payload.debugLoggingEnabled;

        deps.applyModesAfterSave(d, p, dbg);

        // Apply the keychain opt-in **after** the file write succeeded so a
        // toggle-on only triggers `safeStorage.*` once we've actually
        // committed the user's choice to disk.
        deps.applyRememberPasswordsInKeychain(!!payload.rememberPasswordsInKeychain);

        const { app } = require('electron') as typeof import('electron');
        initNetworkInspectorFromSettings(
          (channel, data) => deps.notifyRenderer(channel, data),
          {
            enabled: !!payload.networkInspectorEnabled,
            mitmEnabled: !!payload.networkInspectorMitmEnabled,
            mitmPort:
              typeof payload.networkInspectorMitmPort === 'number'
                ? payload.networkInspectorMitmPort
                : 8888,
            maxRawPacketsPerDevice: niMaxRawPackets,
            maxBodyRetainedBytes: niMaxBodyRetainedBytes,
            userDataPath: app.getPath('userData')
          }
        );

        syncFileMenuCheckboxes(Menu, d, p, dbg);

        deps.notifyRenderer(IPC.DeveloperModeChanged, d);
        deps.notifyRenderer(IPC.PrivacyModeChanged, p);
        deps.notifyRenderer(IPC.DebugLoggingChanged, dbg);
        deps.notifyRenderer(IPC.AppSettingsUpdated, {
          timing: true,
          folder: true,
          networkInspector: true
        });

        if (mcpErrors.length > 0) {
          const summary = mcpErrors
            .map((r) => `${r.id}: ${r.error}`)
            .join('; ');
          return {
            success: true,
            mcpResults,
            warning: `MCP client config update had errors: ${summary}`
          };
        }
        return { success: true, mcpResults };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    }
  );
}

export { registerSettingsWindowIpc };

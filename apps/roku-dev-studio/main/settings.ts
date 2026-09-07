/**
 * File-based settings storage and IPC handlers.
 * Must call initSettings(app) before loadSettings/saveSettings/registerSettingsIpc.
 */

import type { App, IpcMain, IpcMainInvokeEvent } from 'electron';

const path = require('path');
const fs = require('fs');
const { resolveUnderBase } = require('roku-dev-studio-platform/path-safe');
const { mainLog, mainWarn, mainError } = require('./log');
const sharedConstants = require('roku-dev-studio-api/lib/shared-constants') as Record<string, number>;

let settingsDir: string | null = null;
let settingsFile: string | null = null;

/**
 * Initialize settings paths from Electron app userData.
 */
function initSettings(app: App) {
  const userData = app.getPath('userData');
  settingsDir = resolveUnderBase(userData, 'settings') || path.join(userData, 'settings');
  settingsFile = resolveUnderBase(settingsDir, 'app-settings.json') || path.join(settingsDir, 'app-settings.json');
}

function ensureSettingsDir() {
  if (!settingsDir) return;
  try {
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
  } catch (e) {
    mainError('Failed to create settings directory:', e);
  }
}

/**
 * Load all settings from file.
 * @returns {object}
 */
function loadSettings(): Record<string, unknown> {
  try {
    ensureSettingsDir();
    if (settingsFile && fs.existsSync(settingsFile)) {
      const data = fs.readFileSync(settingsFile, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    mainError('Failed to load settings:', e);
  }
  return {};
}

/**
 * Save all settings to file.
 * @param {object} settings
 * @returns {boolean}
 */
function saveSettings(settings: Record<string, unknown>) {
  try {
    ensureSettingsDir();
    if (settingsFile) {
      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
      return true;
    }
  } catch (e) {
    mainError('Failed to save settings:', e);
  }
  return false;
}

/**
 * Allowlist of keys the renderer is permitted to write via the generic settings:set /
 * settings:delete IPC. Keeping this strict prevents a compromised or buggy renderer
 * from overwriting structured/main-owned keys in `app-settings.json`.
 *
 * Keys that are **main-owned** and written exclusively by the Settings window
 * (`settings-window-ipc.ts` → SettingsWindowSave, which bypasses this handler) or by
 * the main process itself are intentionally absent: `debugLoggingEnabled`,
 * `devicePerformanceRememberQuadPerDevice`, `keyboardRemoteShortcutsEnabled`,
 * `autoConnectLastDeviceEnabled`, `rememberSidebarToggle`.
 */
const RENDERER_WRITABLE_KEYS = new Set<string>([
  'rds-timing-overrides',
  'action-script-default-save-folder',
  'device-performance-view-quad-v1',
  'remote-locations',
  'autoConnectRememberedDevices',
  // Floating Remote: renderer-owned. `enabled` is flipped by the title-bar
  // toggle button; `position` is persisted on drag-end. Both are read back by
  // `loadPersistedAppSettings()` so they survive across sessions.
  'floating-remote.enabled',
  'floating-remote.position',
  'deeplink-custom-media-types',
  'deeplink-saved-presets',
  // IPs the user opted into "Sideload with Debugging" for (Dev App checkbox).
  // Persisted per-device so it survives launches and so the main-process Sideload
  // Relay can fan out those devices with remotedebug=1.
  'sideload-debug-ips',
  // Managed debugger breakpoints, keyed by device IP → [{ path, line, condition? }].
  'debug-breakpoints',
  // Debugger watch expressions, keyed by device IP → [expr, …].
  'debug-watches'
]);

/**
 * Keys the renderer may read via settings:get. Superset of the writable allowlist —
 * the renderer needs to read Settings-window–owned flags to sync UI state (e.g. the
 * keyboard shortcut toggle, “remember per-device quad” toggle). `debugLoggingEnabled`
 * has its own dedicated IPC (`is-debug-enabled`) and is not exposed here.
 */
const RENDERER_READABLE_KEYS = new Set<string>([
  ...RENDERER_WRITABLE_KEYS,
  'devicePerformanceRememberQuadPerDevice',
  'keyboardRemoteShortcutsEnabled',
  'tryDemoAppEnabled',
  'autoConnectLastDeviceEnabled',
  'rememberSidebarToggle',
  'rememberPasswordsInKeychain',
  'networkInspectorEnabled',
  'crashReportingEnabled',
  // Persisted UI locale ('system' | code). The main window reads this at startup
  // (loadPersistedAppSettings → setLocale) so it renders in the saved language; without
  // this the get is refused and the window falls back to System/English until a manual switch.
  'language'
]);

function isValidSettingsKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && key.length < 256;
}

/**
 * Register settings IPC handlers (get, set, delete).
 * Logs only for set/delete to avoid noisy read logging.
 * @param {object} ipcMain - Electron ipcMain
 */
function registerSettingsIpc(ipcMain: IpcMain) {
  ipcMain.handle('settings:get', async (_event: IpcMainInvokeEvent, key: string) => {
    if (!isValidSettingsKey(key)) return { success: false, error: 'Invalid key' };
    if (!RENDERER_READABLE_KEYS.has(key)) {
      mainWarn('[Settings] Refused get for non-allowlisted key:', key);
      return { success: false, error: 'Key is not accessible' };
    }
    const settings = loadSettings();
    return { success: true, value: settings[key] };
  });

  ipcMain.handle('settings:set', async (_event: IpcMainInvokeEvent, key: string, value: unknown) => {
    if (!isValidSettingsKey(key)) return { success: false, error: 'Invalid key' };
    if (!RENDERER_WRITABLE_KEYS.has(key)) {
      mainWarn('[Settings] Refused set for non-allowlisted key:', key);
      return { success: false, error: 'Key is not writable' };
    }
    const settings = loadSettings();
    settings[key] = value;
    const saved = saveSettings(settings);
    mainLog('[Settings] Set:', key, '-> saved:', saved);
    return { success: saved };
  });

  ipcMain.handle('settings:delete', async (_event: IpcMainInvokeEvent, key: string) => {
    if (!isValidSettingsKey(key)) return { success: false, error: 'Invalid key' };
    if (!RENDERER_WRITABLE_KEYS.has(key)) {
      mainWarn('[Settings] Refused delete for non-allowlisted key:', key);
      return { success: false, error: 'Key is not writable' };
    }
    const settings = loadSettings();
    delete settings[key];
    const saved = saveSettings(settings);
    mainLog('[Settings] Delete:', key, '-> saved:', saved);
    return { success: saved };
  });
}

/**
 * Read a single sanitized timing override (or the package compile default) without
 * importing the Settings-window save path. The save flow already runs
 * `sanitizeTimingOverrides` (clamps to bounds), so on-disk values are trusted to
 * be in range; we only re-validate type here so a hand-edited bogus entry can't
 * crash a downstream consumer.
 */
function getPersistedTimingValue(key: string): number {
  const settings = loadSettings();
  const raw = settings['rds-timing-overrides'];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  }
  const def = sharedConstants[key];
  return typeof def === 'number' && Number.isFinite(def) ? def : 0;
}

export { initSettings, loadSettings, saveSettings, registerSettingsIpc, getPersistedTimingValue };

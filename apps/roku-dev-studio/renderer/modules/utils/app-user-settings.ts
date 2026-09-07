/**
 * Loads optional user settings from file storage (`app-settings.json` via IPC)
 * that are not yet exposed in a dedicated Settings UI.
 */

import {
  applyRdsTimingOverrides,
  resetRdsTimingToCompileDefaults,
  type RdsTimingOverrides
} from './constants.js';
import { rendererError } from './logger.js';
import { SYSTEM_LOCALE } from '@shared/strings/index.js';
import { setLocaleFromPreference } from './locale-pref.js';

/** Persisted language preference: a locale code (e.g. 'en') or 'system'. Default 'system'. */
export const SETTINGS_KEY_LANGUAGE = 'language';

/** Persisted object: keys match `RdsTimingOverrideKey` in constants.ts */
export const SETTINGS_KEY_RDS_TIMING_OVERRIDES = 'rds-timing-overrides';

/** Default folder for Action Script screenshots/logs (absolute path). */
export const SETTINGS_KEY_ACTION_SCRIPT_DEFAULT_SAVE_FOLDER = 'action-script-default-save-folder';

/**
 * Per-device preference: Remote Section “Show Device Performance” (quad layout) when eligible.
 * Value is a plain object: `{ [deviceKey]: boolean }` where `deviceKey` is serial string or `ip:…`.
 */
export const SETTINGS_KEY_DEVICE_PERFORMANCE_QUAD = 'device-performance-view-quad-v1';

/** When true, restore Remote Section “Show Device Performance” per device from disk. Default off until enabled in Settings. */
export const SETTINGS_KEY_DEVICE_PERF_REMEMBER_QUAD = 'devicePerformanceRememberQuadPerDevice';

/** When true, arrow keys / Enter / etc. drive the Roku from the keyboard (see Settings → General). Default off. */
export const SETTINGS_KEY_KEYBOARD_REMOTE_SHORTCUTS = 'keyboardRemoteShortcutsEnabled';

/** When true, reconnect automatically on launch if the last-used device appears after discovery. Default off. */
export const SETTINGS_KEY_AUTO_CONNECT_LAST_DEVICE = 'autoConnectLastDeviceEnabled';

/** When true, title-bar primary sidebar show/hide is saved in localStorage between sessions. Default off. */
export const SETTINGS_KEY_REMEMBER_SIDEBAR_TOGGLE = 'rememberSidebarToggle';

/** When true, Network Inspector watches hotspot traffic for local devices. */
export const SETTINGS_KEY_NETWORK_INSPECTOR_ENABLED = 'networkInspectorEnabled';

/** When true, a "Try Demo App" button appears in the title bar (see Settings → General). Default on. */
export const SETTINGS_KEY_TRY_DEMO_APP_ENABLED = 'tryDemoAppEnabled';

/**
 * When true, a draggable Floating Remote is shown over the current device
 * panel whenever the active inner tab is not `remote` or `devapp`. Toggled
 * per-user from the device-panel header button. Default off.
 */
export const SETTINGS_KEY_FLOATING_REMOTE_ENABLED = 'floating-remote.enabled';

/**
 * Persisted last-known floating remote shell top-left position in CSS pixels.
 * Shape: `{ x: number, y: number }`. Re-clamped to the viewport on load /
 * window resize so a smaller window doesn't strand the floater off-screen.
 */
export const SETTINGS_KEY_FLOATING_REMOTE_POSITION = 'floating-remote.position';

export let REMEMBER_DEVICE_PERFORMANCE_QUAD_PER_DEVICE = false;

export let KEYBOARD_REMOTE_SHORTCUTS_ENABLED = false;

export let TRY_DEMO_APP_ENABLED = true;

export let AUTO_CONNECT_LAST_DEVICE_ENABLED = false;

export let REMEMBER_SIDEBAR_TOGGLE = false;

export let NETWORK_INSPECTOR_ENABLED = false;

export let FLOATING_REMOTE_ENABLED = false;

export interface FloatingRemotePosition {
  x: number;
  y: number;
}

export let FLOATING_REMOTE_POSITION: FloatingRemotePosition | null = null;

type DevicePerfQuadMap = Record<string, boolean>;

function isPerfQuadMap(v: unknown): v is DevicePerfQuadMap {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

export async function getDevicePerformanceQuadPref(deviceKey: string): Promise<boolean> {
  if (!deviceKey || !window.roku?.getSetting) return false;
  try {
    const res = await window.roku.getSetting(SETTINGS_KEY_DEVICE_PERFORMANCE_QUAD);
    if (!res || !res.success || res.value == null) return false;
    if (!isPerfQuadMap(res.value)) return false;
    return res.value[deviceKey] === true;
  } catch {
    return false;
  }
}

export async function setDevicePerformanceQuadPref(deviceKey: string, quad: boolean): Promise<void> {
  if (!deviceKey || !window.roku?.getSetting || !window.roku?.setSetting) return;
  try {
    const cur = await window.roku.getSetting(SETTINGS_KEY_DEVICE_PERFORMANCE_QUAD);
    const prev: DevicePerfQuadMap =
      cur && cur.success && cur.value != null && isPerfQuadMap(cur.value) ? { ...cur.value } : {};
    if (quad) prev[deviceKey] = true;
    else delete prev[deviceKey];
    await window.roku.setSetting(SETTINGS_KEY_DEVICE_PERFORMANCE_QUAD, prev);
  } catch (e) {
    rendererError('[App settings] Failed to persist Device Performance view:', e);
  }
}

let actionScriptDefaultSaveFolder: string | null = null;

export function getActionScriptDefaultSaveFolder(): string | null {
  return actionScriptDefaultSaveFolder;
}

/**
 * Update cached path and persist. Pass null or empty to clear.
 */
export async function setActionScriptDefaultSaveFolder(path: string | null): Promise<void> {
  const trimmed = path && String(path).trim() ? String(path).trim() : null;
  actionScriptDefaultSaveFolder = trimmed;
  if (!window.roku?.setSetting || !window.roku?.deleteSetting) return;
  if (trimmed) {
    await window.roku.setSetting(SETTINGS_KEY_ACTION_SCRIPT_DEFAULT_SAVE_FOLDER, trimmed);
  } else {
    await window.roku.deleteSetting(SETTINGS_KEY_ACTION_SCRIPT_DEFAULT_SAVE_FOLDER);
  }
}

/**
 * Load timing overrides and default Action Script folder before UI uses them
 * (e.g. connection poll interval, validate flow).
 */
export async function loadPersistedAppSettings(): Promise<void> {
  if (!window.roku?.getSetting) return;
  try {
    // Apply the persisted UI locale to the shared catalog before the app renders, so
    // `S.*` reads and `applyI18n` resolve against the chosen language. The preference may
    // be a locale code or 'system' (default) — resolve it against the OS locale. (Each
    // process has its own catalog instance, so every window applies this independently.)
    // Only 'en' ships today, so this resolves to English until a second catalog is added.
    const languageRes = await window.roku.getSetting(SETTINGS_KEY_LANGUAGE);
    const pref =
      languageRes && languageRes.success && typeof languageRes.value === 'string' && languageRes.value.trim()
        ? languageRes.value.trim()
        : SYSTEM_LOCALE;
    setLocaleFromPreference(pref);

    /**
     * Read timing from disk *before* resetting live constants. Previously we called
     * `resetRdsTimingToCompileDefaults()` then awaited getSetting — during the await,
     * other code (e.g. device metrics `renderCharts`) saw the 5‑minute compile default for
     * `DEVICE_METRICS_CHART_HISTORY_MS`, treated it as a user setting change, and reset the
     * chart “session” so the visible history snapped back to 5 minutes.
     */
    const timingRes = await window.roku.getSetting(SETTINGS_KEY_RDS_TIMING_OVERRIDES);
    resetRdsTimingToCompileDefaults();
    if (timingRes && timingRes.success && timingRes.value != null) {
      applyRdsTimingOverrides(timingRes.value);
    }
    const folderRes = await window.roku.getSetting(SETTINGS_KEY_ACTION_SCRIPT_DEFAULT_SAVE_FOLDER);
    if (
      folderRes &&
      folderRes.success &&
      typeof folderRes.value === 'string' &&
      folderRes.value.trim() !== ''
    ) {
      actionScriptDefaultSaveFolder = folderRes.value.trim();
    } else {
      actionScriptDefaultSaveFolder = null;
    }

    const rememberRes = await window.roku.getSetting(SETTINGS_KEY_DEVICE_PERF_REMEMBER_QUAD);
    if (rememberRes && rememberRes.success && typeof rememberRes.value === 'boolean') {
      REMEMBER_DEVICE_PERFORMANCE_QUAD_PER_DEVICE = rememberRes.value;
    } else {
      REMEMBER_DEVICE_PERFORMANCE_QUAD_PER_DEVICE = false;
    }

    const kbRemoteRes = await window.roku.getSetting(SETTINGS_KEY_KEYBOARD_REMOTE_SHORTCUTS);
    if (kbRemoteRes && kbRemoteRes.success && typeof kbRemoteRes.value === 'boolean') {
      KEYBOARD_REMOTE_SHORTCUTS_ENABLED = kbRemoteRes.value;
    } else {
      KEYBOARD_REMOTE_SHORTCUTS_ENABLED = false;
    }

    const tryDemoAppRes = await window.roku.getSetting(SETTINGS_KEY_TRY_DEMO_APP_ENABLED);
    if (tryDemoAppRes && tryDemoAppRes.success && typeof tryDemoAppRes.value === 'boolean') {
      TRY_DEMO_APP_ENABLED = tryDemoAppRes.value;
    } else {
      TRY_DEMO_APP_ENABLED = true;
    }

    const autoConnRes = await window.roku.getSetting(SETTINGS_KEY_AUTO_CONNECT_LAST_DEVICE);
    if (autoConnRes && autoConnRes.success && typeof autoConnRes.value === 'boolean') {
      AUTO_CONNECT_LAST_DEVICE_ENABLED = autoConnRes.value;
    } else {
      AUTO_CONNECT_LAST_DEVICE_ENABLED = false;
    }

    const rememberSidebarRes = await window.roku.getSetting(SETTINGS_KEY_REMEMBER_SIDEBAR_TOGGLE);
    if (rememberSidebarRes && rememberSidebarRes.success && typeof rememberSidebarRes.value === 'boolean') {
      REMEMBER_SIDEBAR_TOGGLE = rememberSidebarRes.value;
    } else {
      REMEMBER_SIDEBAR_TOGGLE = false;
    }

    const networkInspectorRes = await window.roku.getSetting(SETTINGS_KEY_NETWORK_INSPECTOR_ENABLED);
    if (networkInspectorRes && networkInspectorRes.success && typeof networkInspectorRes.value === 'boolean') {
      NETWORK_INSPECTOR_ENABLED = networkInspectorRes.value;
    } else {
      NETWORK_INSPECTOR_ENABLED = false;
    }

    const floatingRemoteRes = await window.roku.getSetting(SETTINGS_KEY_FLOATING_REMOTE_ENABLED);
    if (floatingRemoteRes && floatingRemoteRes.success && typeof floatingRemoteRes.value === 'boolean') {
      FLOATING_REMOTE_ENABLED = floatingRemoteRes.value;
    } else {
      FLOATING_REMOTE_ENABLED = false;
    }

    const floatingRemotePosRes = await window.roku.getSetting(SETTINGS_KEY_FLOATING_REMOTE_POSITION);
    FLOATING_REMOTE_POSITION = parseFloatingRemotePosition(
      floatingRemotePosRes && floatingRemotePosRes.success ? floatingRemotePosRes.value : null
    );

    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('keyboard-remote-shortcuts-on', KEYBOARD_REMOTE_SHORTCUTS_ENABLED);
      document.body.classList.toggle('floating-remote-on', FLOATING_REMOTE_ENABLED);
    }
  } catch (e) {
    rendererError('[App settings] Failed to load persisted settings:', e);
  }
}

function parseFloatingRemotePosition(value: unknown): FloatingRemotePosition | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as { x?: unknown; y?: unknown };
  if (typeof v.x !== 'number' || typeof v.y !== 'number') return null;
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
  return { x: v.x, y: v.y };
}

/** Persist the floating remote toggle. Caller updates UI separately. */
export async function setFloatingRemoteEnabled(enabled: boolean): Promise<void> {
  FLOATING_REMOTE_ENABLED = enabled;
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('floating-remote-on', enabled);
  }
  if (!window.roku?.setSetting) return;
  try {
    await window.roku.setSetting(SETTINGS_KEY_FLOATING_REMOTE_ENABLED, enabled);
  } catch (e) {
    rendererError('[App settings] Failed to persist floating remote enabled:', e);
  }
}

/** Persist the floating remote top-left position. Called on drag end. */
export async function setFloatingRemotePosition(pos: FloatingRemotePosition): Promise<void> {
  FLOATING_REMOTE_POSITION = pos;
  if (!window.roku?.setSetting) return;
  try {
    await window.roku.setSetting(SETTINGS_KEY_FLOATING_REMOTE_POSITION, pos);
  } catch (e) {
    rendererError('[App settings] Failed to persist floating remote position:', e);
  }
}

/**
 * Persist partial or full timing overrides: merges with stored object, resets to compile
 * defaults then re-applies merged values so removed keys revert to defaults.
 */
export async function saveRdsTimingOverrides(overrides: RdsTimingOverrides): Promise<boolean> {
  if (!window.roku?.getSetting || !window.roku?.setSetting) return false;
  const cur = await window.roku.getSetting(SETTINGS_KEY_RDS_TIMING_OVERRIDES);
  const prev =
    cur &&
    cur.success &&
    cur.value != null &&
    typeof cur.value === 'object' &&
    !Array.isArray(cur.value)
      ? (cur.value as Record<string, unknown>)
      : {};
  const merged = { ...prev, ...overrides } as RdsTimingOverrides;
  resetRdsTimingToCompileDefaults();
  applyRdsTimingOverrides(merged);
  const res = await window.roku.setSetting(SETTINGS_KEY_RDS_TIMING_OVERRIDES, merged);
  return !!(res && res.success);
}

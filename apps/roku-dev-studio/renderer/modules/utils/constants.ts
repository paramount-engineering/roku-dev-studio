/**
 * Re-exports shared defaults from `roku-dev-studio-api/lib/shared-constants.js`
 * (exposed as `window.rdsSharedConstants` in preload). App-only keys below.
 *
 * Values are mutable `let` bindings so `applyRdsTimingOverrides()` can apply
 * `app-settings.json` (`rds-timing-overrides`) at runtime without a reload.
 */

const C = typeof window !== 'undefined' ? window.rdsSharedConstants : undefined;
if (!C) {
  throw new Error(
    'rdsSharedConstants missing: preload must expose roku-dev-studio-api/lib/shared-constants.js'
  );
}
/** Narrowed preload constants (closure-safe for helpers below). */
const RDS = C;

/** Keys accepted in `rds-timing-overrides` (same names as these exports). */
export type RdsTimingOverrideKey =
  | 'DEFAULT_RALE_PORT'
  | 'SCREENSHOT_DEBOUNCE_DELAY'
  | 'SCREENSHOT_AFTER_LAUNCH_DELAY'
  | 'TELNET_TIMEOUT'
  | 'CONNECTION_CHECK_INTERVAL'
  | 'DEVICE_METRICS_SAMPLE_INTERVAL_MS'
  | 'DEVICE_METRICS_CHART_HISTORY_MS'
  | 'TOAST_DISPLAY_DURATION'
  | 'STATUS_MESSAGE_DURATION';

export type RdsTimingOverrides = Partial<Record<RdsTimingOverrideKey, number>>;

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

/** Live values — start at compile-time defaults from preload; may be updated by settings. */
export let DEFAULT_RALE_PORT = RDS.DEFAULT_RALE_PORT;
export let SCREENSHOT_DEBOUNCE_DELAY = RDS.SCREENSHOT_DEBOUNCE_DELAY;
export let SCREENSHOT_AFTER_LAUNCH_DELAY = RDS.SCREENSHOT_AFTER_LAUNCH_DELAY;
export let TELNET_TIMEOUT = RDS.TELNET_TIMEOUT;
export let CONNECTION_CHECK_INTERVAL = RDS.CONNECTION_CHECK_INTERVAL;
export let DEVICE_METRICS_SAMPLE_INTERVAL_MS = RDS.DEVICE_METRICS_SAMPLE_INTERVAL_MS;
export let DEVICE_METRICS_CHART_HISTORY_MS = RDS.DEVICE_METRICS_CHART_HISTORY_MS;
export let TOAST_DISPLAY_DURATION = RDS.TOAST_DISPLAY_DURATION;
export let STATUS_MESSAGE_DURATION = RDS.STATUS_MESSAGE_DURATION;

const BOUNDS: Record<RdsTimingOverrideKey, { min: number; max: number }> = {
  DEFAULT_RALE_PORT: { min: 1, max: 65535 },
  SCREENSHOT_DEBOUNCE_DELAY: { min: 0, max: 120_000 },
  SCREENSHOT_AFTER_LAUNCH_DELAY: { min: 0, max: 120_000 },
  TELNET_TIMEOUT: { min: 1_000, max: 600_000 },
  CONNECTION_CHECK_INTERVAL: { min: 3_000, max: 600_000 },
  DEVICE_METRICS_SAMPLE_INTERVAL_MS: { min: 500, max: 5000 },
  DEVICE_METRICS_CHART_HISTORY_MS: { min: 300_000, max: 3_600_000 },
  TOAST_DISPLAY_DURATION: { min: 2000, max: 10_000 },
  STATUS_MESSAGE_DURATION: { min: 2000, max: 10_000 }
};

/**
 * Merge numeric overrides from persisted settings (object keyed by RdsTimingOverrideKey).
 * Invalid or out-of-range values are ignored for that key.
 */
export function applyRdsTimingOverrides(raw: unknown): void {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return;
  const o = raw as Record<string, unknown>;
  (Object.keys(BOUNDS) as RdsTimingOverrideKey[]).forEach((key) => {
    if (!(key in o)) return;
    const n = coerceNumber(o[key]);
    if (n == null) return;
    const { min, max } = BOUNDS[key];
    const v = clampInt(n, min, max);
    switch (key) {
      case 'DEFAULT_RALE_PORT':
        DEFAULT_RALE_PORT = v;
        break;
      case 'SCREENSHOT_DEBOUNCE_DELAY':
        SCREENSHOT_DEBOUNCE_DELAY = v;
        break;
      case 'SCREENSHOT_AFTER_LAUNCH_DELAY':
        SCREENSHOT_AFTER_LAUNCH_DELAY = v;
        break;
      case 'TELNET_TIMEOUT':
        TELNET_TIMEOUT = v;
        break;
      case 'CONNECTION_CHECK_INTERVAL':
        CONNECTION_CHECK_INTERVAL = v;
        break;
      case 'DEVICE_METRICS_SAMPLE_INTERVAL_MS':
        DEVICE_METRICS_SAMPLE_INTERVAL_MS = v;
        break;
      case 'DEVICE_METRICS_CHART_HISTORY_MS':
        DEVICE_METRICS_CHART_HISTORY_MS = v;
        break;
      case 'TOAST_DISPLAY_DURATION':
        TOAST_DISPLAY_DURATION = v;
        break;
      case 'STATUS_MESSAGE_DURATION':
        STATUS_MESSAGE_DURATION = v;
        break;
      default:
        break;
    }
  });
}

/** Snapshot of preload defaults (unchanged by overrides). */
export function getRdsCompileTimeDefaults(): RdsTimingOverrides {
  return {
    DEFAULT_RALE_PORT: RDS.DEFAULT_RALE_PORT,
    SCREENSHOT_DEBOUNCE_DELAY: RDS.SCREENSHOT_DEBOUNCE_DELAY,
    SCREENSHOT_AFTER_LAUNCH_DELAY: RDS.SCREENSHOT_AFTER_LAUNCH_DELAY,
    TELNET_TIMEOUT: RDS.TELNET_TIMEOUT,
    CONNECTION_CHECK_INTERVAL: RDS.CONNECTION_CHECK_INTERVAL,
    DEVICE_METRICS_SAMPLE_INTERVAL_MS: RDS.DEVICE_METRICS_SAMPLE_INTERVAL_MS,
    DEVICE_METRICS_CHART_HISTORY_MS: RDS.DEVICE_METRICS_CHART_HISTORY_MS,
    TOAST_DISPLAY_DURATION: RDS.TOAST_DISPLAY_DURATION,
    STATUS_MESSAGE_DURATION: RDS.STATUS_MESSAGE_DURATION
  };
}

/** Reset live timing values to preload defaults (before re-applying persisted overrides). */
export function resetRdsTimingToCompileDefaults(): void {
  DEFAULT_RALE_PORT = RDS.DEFAULT_RALE_PORT;
  SCREENSHOT_DEBOUNCE_DELAY = RDS.SCREENSHOT_DEBOUNCE_DELAY;
  SCREENSHOT_AFTER_LAUNCH_DELAY = RDS.SCREENSHOT_AFTER_LAUNCH_DELAY;
  TELNET_TIMEOUT = RDS.TELNET_TIMEOUT;
  CONNECTION_CHECK_INTERVAL = RDS.CONNECTION_CHECK_INTERVAL;
  DEVICE_METRICS_SAMPLE_INTERVAL_MS = RDS.DEVICE_METRICS_SAMPLE_INTERVAL_MS;
  DEVICE_METRICS_CHART_HISTORY_MS = RDS.DEVICE_METRICS_CHART_HISTORY_MS;
  TOAST_DISPLAY_DURATION = RDS.TOAST_DISPLAY_DURATION;
  STATUS_MESSAGE_DURATION = RDS.STATUS_MESSAGE_DURATION;
}

export const STORAGE_KEYS = {
  PASSWORDS: 'roku-dev-passwords',
  DEVICES: 'roku-devices',
  REMOTE_LOCATIONS: 'roku-remote-locations',
  COLLAPSED_LOCATIONS: 'roku-collapsed-locations'
} as const;

export const QUERY_ENDPOINTS = {
  APPS: '/query/apps',
  ACTIVE_APP: '/query/active-app',
  DEVICE_INFO: '/query/device-info',
  ICON: '/query/icon',
  TV_CHANNELS: '/query/tv-channels',
  TV_ACTIVE_CHANNEL: '/query/tv-active-channel'
} as const;

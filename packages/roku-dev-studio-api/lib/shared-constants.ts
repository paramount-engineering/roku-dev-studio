/**
 * Shared defaults for roku-dev-studio-api, `rds` CLI, remote relay server, and Roku Dev Studio (Electron).
 * Single source of truth — the desktop renderer reads these via preload (`window.rdsSharedConstants`).
 */

'use strict';

/** Default TrackerTask / App Connector TCP port */
const DEFAULT_RALE_PORT = 49200;

/** ms — keypress / text input auto-screenshot debounce (desktop UI) */
const SCREENSHOT_DEBOUNCE_DELAY = 800;

/** ms — wait after Dev App launch before screenshot so channel UI can render */
const SCREENSHOT_AFTER_LAUNCH_DELAY = 2500;

/**
 * ms — default Roku telnet TCP connect timeout (`connectRokuDebugTelnet` / system telnet).
 * Same numeric default as renderer polling caps for telnet command flows.
 */
const TELNET_TIMEOUT = 15000;

/** Alias for API consumers that name connect timeout explicitly */
const DEFAULT_TELNET_CONNECT_TIMEOUT_MS = TELNET_TIMEOUT;

/** ms — default timeout for ECP GET /query/* and device-info */
const QUERY_TIMEOUT = 10000;

/** ms — device active / health polling interval in UI (Settings: “Device Active Check”) */
const CONNECTION_CHECK_INTERVAL = 30000;

/**
 * ms — default interval between Device Performance samples (chanperf + object counts) when
 * Remote “Show Device Performance” is on (Settings → Device Performance).
 */
const DEVICE_METRICS_SAMPLE_INTERVAL_MS = 2000;

/**
 * ms — minimum allowed sampling interval (Roku Dev Studio Settings → Device Performance).
 * Relay server uses this as the GET `/query/*` response cache TTL so concurrent pollers share one ECP hit.
 */
const DEVICE_METRICS_SAMPLE_INTERVAL_MIN_MS = 500;

/** ms — CPU/memory chart history time (Settings → Device Performance; 5 min … 1 hr). */
const DEVICE_METRICS_CHART_HISTORY_MS = 300_000;

/** ms — success/error toast visibility (Settings → General; 2–10 s in UI) */
const TOAST_DISPLAY_DURATION = 5000;

/** ms — header status line visibility (Settings → General; 2–10 s in UI) */
const STATUS_MESSAGE_DURATION = 5000;

module.exports = {
  DEFAULT_RALE_PORT,
  SCREENSHOT_DEBOUNCE_DELAY,
  SCREENSHOT_AFTER_LAUNCH_DELAY,
  TELNET_TIMEOUT,
  DEFAULT_TELNET_CONNECT_TIMEOUT_MS,
  QUERY_TIMEOUT,
  CONNECTION_CHECK_INTERVAL,
  DEVICE_METRICS_SAMPLE_INTERVAL_MS,
  DEVICE_METRICS_SAMPLE_INTERVAL_MIN_MS,
  DEVICE_METRICS_CHART_HISTORY_MS,
  TOAST_DISPLAY_DURATION,
  STATUS_MESSAGE_DURATION
};

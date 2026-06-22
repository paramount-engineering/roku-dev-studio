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

/** ms — default pause between Lit_ keypresses in `inputText` (relay + local). Lower = faster; 0 may drop chars on some devices. */
const INPUT_TEXT_KEY_DELAY_MS = 40;

/** ms — per-character ECP keypress socket timeout used by `inputText`. */
const INPUT_TEXT_PER_KEY_TIMEOUT_MS = 2000;

/** ms — floor for RDS/CLI → relay HTTP timeout on `/input-text`. */
const INPUT_TEXT_RELAY_HTTP_MIN_TIMEOUT_MS = 15000;

/** ms — cap for RDS/CLI → relay HTTP timeout on `/input-text`. */
const INPUT_TEXT_RELAY_HTTP_MAX_TIMEOUT_MS = 180000;

/**
 * Estimate how long the relay should take to finish `inputText` so the
 * client HTTP socket does not give up early on long emails/URLs. Matches the
 * relay handler defaults (`inputKeyDelayMs` 100, per-key timeout 2000).
 */
function computeInputTextRelayHttpTimeoutMs(
  text: unknown,
  opts: { inputKeyDelayMs?: number; perKeyTimeoutMs?: number } = {}
): number {
  const len = text == null ? 0 : String(text).length;
  if (len === 0) return INPUT_TEXT_RELAY_HTTP_MIN_TIMEOUT_MS;
  const keyDelay = opts.inputKeyDelayMs ?? INPUT_TEXT_KEY_DELAY_MS;
  const perKey = opts.perKeyTimeoutMs ?? INPUT_TEXT_PER_KEY_TIMEOUT_MS;
  // Budget each char for one ECP POST + inter-key delay; add margin for JSON/HTTP.
  const estimated = len * (perKey + keyDelay) + 5000;
  return Math.min(
    INPUT_TEXT_RELAY_HTTP_MAX_TIMEOUT_MS,
    Math.max(INPUT_TEXT_RELAY_HTTP_MIN_TIMEOUT_MS, estimated)
  );
}

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
  STATUS_MESSAGE_DURATION,
  INPUT_TEXT_KEY_DELAY_MS,
  INPUT_TEXT_PER_KEY_TIMEOUT_MS,
  INPUT_TEXT_RELAY_HTTP_MIN_TIMEOUT_MS,
  INPUT_TEXT_RELAY_HTTP_MAX_TIMEOUT_MS,
  computeInputTextRelayHttpTimeoutMs
};

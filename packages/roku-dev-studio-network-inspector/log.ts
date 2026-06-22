/**
 * Network Inspector logger. Milestone events (`niLog`/`niWarn`/`niError`) are always emitted so a
 * user can run a build, reproduce an issue, and share the console/log file with us. High-frequency /
 * verbose tracing (`niDebug`) is gated behind the verbose flag so normal runs stay quiet.
 *
 * This is a thin wrapper around the shared logger in `roku-dev-studio-platform` — the formatting,
 * timestamping, and level handling live there so every part of the app logs the same way. All this
 * file owns is the Network Inspector identity (`[Network Inspector]` prefix) and its verbose gate.
 *
 * Verbose tracing turns on with the unified `RDS_DEBUG=1`, or just for the Network Inspector with
 * `RDS_NI_DEBUG=1` (Windows PowerShell: `$env:RDS_NI_DEBUG=1` before starting the app). `RDS_NI_DEBUG=0`
 * silences only the inspector while `RDS_DEBUG` is on. Every line is prefixed with `[Network Inspector]`
 * and an ISO timestamp, so logs are easy to grep and correlate across capture / MITM / discovery.
 */

import { createNodeLogger } from 'roku-dev-studio-platform/node';

const logger = createNodeLogger('[Network Inspector]', 'RDS_NI_DEBUG');

export function niLog(...args: unknown[]): void {
  logger.log(...args);
}

export function niWarn(...args: unknown[]): void {
  logger.warn(...args);
}

export function niError(...args: unknown[]): void {
  logger.error(...args);
}

/** Verbose trace — only emitted when verbose logging is enabled (`RDS_DEBUG`/`RDS_NI_DEBUG`). */
export function niDebug(...args: unknown[]): void {
  logger.debug(...args);
}

export function isNiDebug(): boolean {
  return logger.isDebugEnabled();
}

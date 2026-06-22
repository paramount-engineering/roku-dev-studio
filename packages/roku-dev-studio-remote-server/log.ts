/**
 * Roku Dev Studio remote-server logger. Thin wrapper over the shared logger in
 * `roku-dev-studio-platform` so the relay server logs the same way as the desktop app. Verbose
 * (`debug`) output is gated by the unified `RDS_DEBUG` flag, or `RDS_REMOTE_DEBUG=1` for just the
 * remote server.
 */

import { createNodeLogger } from 'roku-dev-studio-platform/node';

const logger = createNodeLogger('[Remote Server]', 'RDS_REMOTE_DEBUG');

export function serverLog(...args: unknown[]): void {
  logger.log(...args);
}

export function serverWarn(...args: unknown[]): void {
  logger.warn(...args);
}

export function serverError(...args: unknown[]): void {
  logger.error(...args);
}

/** Verbose trace — only emitted when `RDS_DEBUG`/`RDS_REMOTE_DEBUG` is set. */
export function serverDebug(...args: unknown[]): void {
  logger.debug(...args);
}

export function isServerDebug(): boolean {
  return logger.isDebugEnabled();
}

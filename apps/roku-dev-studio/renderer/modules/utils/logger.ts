/**
 * Renderer logger for always-on diagnostics (the renderer counterpart to the main-process logger).
 * Routes through the shared logger in `roku-dev-studio-platform` (via the bundled `shared/logging`
 * shim) so the renderer logs the same way as the rest of the app.
 *
 * Use this for messages that should always surface in the dev console — `rendererLog` / `rendererWarn`
 * / `rendererError` replace bare `console.*`. For verbose tracing that should only appear in
 * Developer Mode / under `RDS_DEBUG`, use `devLog` (see ./dev-log) — `rendererDebug` here is the same
 * gate exposed on this logger for symmetry. No timestamp: the browser devtools console already stamps
 * each line, matching the renderer's existing output.
 */

import { createLogger } from '@shared/logging/logger.js';
import { isDeveloperModeEnabled } from './dev-log.js';

const logger = createLogger({ prefix: '[RDS]', timestamp: false, debug: isDeveloperModeEnabled });

export function rendererLog(...args: unknown[]): void {
  logger.log(...args);
}

export function rendererWarn(...args: unknown[]): void {
  logger.warn(...args);
}

export function rendererError(...args: unknown[]): void {
  logger.error(...args);
}

/** Verbose trace — only emitted in Developer Mode / under `RDS_DEBUG` (same gate as `devLog`). */
export function rendererDebug(...args: unknown[]): void {
  logger.debug(...args);
}

export function isRendererDebug(): boolean {
  return logger.isDebugEnabled();
}

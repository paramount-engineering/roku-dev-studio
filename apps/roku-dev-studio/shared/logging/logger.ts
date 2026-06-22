/**
 * Shim: the shared logger lives in the `roku-dev-studio-platform` package. The HTML renderer is
 * transpiled per-file (`bundle: false`), so nothing resolves the bare `roku-dev-studio-platform`
 * specifier at runtime. transpile-renderer.ts bundles this shim to inline the package into a
 * browser-loadable module; renderer code imports the logger from here via a relative path
 * (`../../shared/logging/logger.js`), never the bare package directly.
 *
 * Only the logger surface is re-exported — not the platform identity helpers — so the renderer
 * bundle stays free of the `process.platform` reads in the package's root entry.
 */
export { createLogger } from 'roku-dev-studio-platform';
export type { Logger, LoggerOptions, LogSink } from 'roku-dev-studio-platform';

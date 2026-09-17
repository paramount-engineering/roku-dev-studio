/**
 * Shim: `singleFlight` lives in `roku-dev-studio-platform`'s async-patterns module (main and the
 * API package import it from the package directly). The HTML renderer is transpiled per-file, so
 * transpile-renderer.ts bundles this shim to inline the package — renderer code imports
 * `@shared/platform/single-flight.js`, never the bare package. Named export on purpose (a CJS dist
 * re-exported with `export *` loses its names).
 */
export { singleFlight } from 'roku-dev-studio-platform/async-patterns';

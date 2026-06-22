/**
 * Shim: the canonical `errorMessage` helper lives in the `roku-dev-studio-platform` package. The
 * HTML renderer is transpiled per-file (`bundle: false`), so transpile-renderer.ts bundles this
 * shim to inline the package into a browser-loadable module. Renderer code imports it via a relative
 * path (`../../shared/platform/err-util.js`), never the bare package.
 *
 * Re-exported under the renderer's historical name `errMessage` to keep call sites unchanged.
 */
export { errMessage } from 'roku-dev-studio-platform';

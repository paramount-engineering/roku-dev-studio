/**
 * Shim: the canonical device-identity key lives in `roku-dev-studio-platform`'s device-ref module
 * (the same anti-drift helper the MCP bridge and the API package use). The HTML renderer is
 * transpiled per-file (`bundle: false`), so transpile-renderer.ts bundles this shim to inline the
 * package into a browser-loadable module. Renderer code imports it via a relative path
 * (`../../shared/platform/device-identity.js`), never the bare package.
 */
export { deviceKey } from 'roku-dev-studio-platform/device-ref';
export type { DeviceLike } from 'roku-dev-studio-platform/device-ref';

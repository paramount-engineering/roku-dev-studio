/**
 * Renderer-local re-export so imports use `../../shared/platform/err-util.js` paths that resolve
 * identically at type-check (here → app-level shim) and runtime (emitted `renderer/dist/shared/...`).
 */
export * from '../../../shared/platform/err-util';

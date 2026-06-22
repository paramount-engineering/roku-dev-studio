/**
 * Renderer-local re-export so imports use `../../shared/logging/logger.js` paths that resolve
 * identically at type-check (here → app-level shim) and runtime (emitted `renderer/dist/shared/...`).
 */
export * from '../../../shared/logging/logger';

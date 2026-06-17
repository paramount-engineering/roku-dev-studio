/**
 * Renderer-local re-export so imports use `../../shared/network-inspector/…` paths that match the
 * emitted `renderer/dist/shared/**` module locations at runtime. (The build transpiles the
 * app-level `shared/network-inspector/setup-guide.ts` into `renderer/dist/shared/...`; this shim
 * only exists so the renderer's relative import resolves identically at type-check and runtime.)
 */
export * from '../../../shared/network-inspector/setup-guide';

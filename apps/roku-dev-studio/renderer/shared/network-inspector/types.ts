/**
 * Renderer-local re-export so imports use `../../shared/network-inspector/…` paths that match the
 * emitted `renderer/dist/shared/**` module locations at runtime. (The build bundles
 * `shared/network-inspector/types.ts` into `renderer/dist/shared/network-inspector/types.js`; this
 * shim exists so the renderer's relative import resolves at type-check and at runtime.)
 */
export * from '../../../shared/network-inspector/types';

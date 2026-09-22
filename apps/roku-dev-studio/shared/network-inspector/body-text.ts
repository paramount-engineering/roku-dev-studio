/**
 * Shim: re-export the body text decoder from the engine package so the renderer and main process can
 * import it via the `shared/network-inspector/*` path. Mirrors the sibling `content-search.ts` shim.
 */
export * from 'roku-dev-studio-network-inspector/body-text';

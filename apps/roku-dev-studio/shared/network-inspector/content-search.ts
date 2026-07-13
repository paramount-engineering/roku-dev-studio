/**
 * Shim: re-export the shared "Find in content" matcher from the engine package so the renderer and
 * main process can import it via the historical `shared/network-inspector/*` path. Mirrors the
 * sibling `types.ts` shim.
 */
export * from 'roku-dev-studio-network-inspector/content-search';

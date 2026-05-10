/**
 * Vendored ESM copied from `@tanstack/virtual-core` at build time (see
 * `scripts/build/transpile-renderer.ts → copyTanstackVirtualVendor`). This
 * declaration re-exports the upstream package's types so renderer source
 * files can `import { Virtualizer, ... } from '../../vendor/tanstack-virtual-core.mjs'`
 * and get full TS coverage without the runtime importer needing to resolve
 * an npm specifier (renderer transpile uses `bundle: false`).
 *
 * The relative module specifier in `declare module` is matched against the
 * literal import strings, not resolved from this file's location, so any
 * source file under `renderer/modules/**` (depth 2) using
 * `'../../vendor/tanstack-virtual-core.mjs'` will pick it up.
 */
declare module '../../vendor/tanstack-virtual-core.mjs' {
  export * from '@tanstack/virtual-core';
}

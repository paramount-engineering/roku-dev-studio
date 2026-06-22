#!/usr/bin/env node
/**
 * Transpile the platform package's .ts entries → dist/ (CommonJS). Declarations are emitted
 * separately by `tsc --emitDeclarationOnly` (see the `build` script). No typecheck here.
 *
 * The package historically shipped raw .ts (consumed only by bundlers). It now ships a real dist so
 * packages that are transpiled per-file and published (e.g. roku-dev-studio-api) can `require` it at
 * runtime like any normal dependency.
 */
import esbuild from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [join(root, 'index.ts'), join(root, 'node.ts')],
  outdir: join(root, 'dist'),
  outbase: root,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  logLevel: 'info',
  sourcemap: true,
});

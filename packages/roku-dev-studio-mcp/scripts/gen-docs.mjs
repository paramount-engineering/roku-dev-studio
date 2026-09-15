// Bundles gen-docs-entry.ts with esbuild (same toolchain/config as build.mjs, since that file
// already proves this package's mixed import/require style bundles cleanly) and runs it once to
// regenerate docs/mcp-tools.json.
import * as esbuild from 'esbuild';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import { createRequire } from 'module';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const tmpOut = path.join(__dirname, '.gen-docs-tmp.cjs');

await esbuild.build({
  entryPoints: [path.join(__dirname, 'gen-docs-entry.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: tmpOut,
  logLevel: 'info',
  // tools.ts transitively imports prose .md files as inlined strings (see build.mjs).
  loader: { '.md': 'text' }
});

try {
  createRequire(import.meta.url)(tmpOut);
} finally {
  fs.rmSync(tmpOut, { force: true });
}

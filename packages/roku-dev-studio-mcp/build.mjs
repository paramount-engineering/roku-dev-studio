// Bundle the MCP server into a single CJS file with a node shebang so Claude /
// Cursor / VS Code can spawn it directly via stdio.
import * as esbuild from 'esbuild';
import * as path from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(__dirname, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: path.join(__dirname, 'dist/index.cjs'),
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'info',
  treeShaking: true,
  // Inline prose markdown files (server instructions, agent contract, quick
  // start, prompt templates) as string literals so dist/index.cjs stays
  // self-contained and the runtime never has to read files from disk.
  loader: { '.md': 'text' }
});

// Make it executable so a `bin` resolution works on POSIX.
import * as fs from 'fs';
try {
  fs.chmodSync(path.join(__dirname, 'dist/index.cjs'), 0o755);
} catch {
  /* ignore on platforms without chmod */
}

console.log('roku-dev-studio-mcp build complete.');

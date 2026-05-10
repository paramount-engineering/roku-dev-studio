#!/usr/bin/env node
/**
 * Transpile roku-remote-server.ts → roku-remote-server.js (CommonJS, no bundle).
 */
import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  absWorkingDir: __dirname,
  entryPoints: [join(__dirname, 'roku-remote-server.ts')],
  outfile: join(__dirname, 'roku-remote-server.js'),
  bundle: false,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  banner: { js: '#!/usr/bin/env node\n' },
  logLevel: 'info'
});

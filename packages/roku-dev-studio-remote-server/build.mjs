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
  // Bundle so the Network Inspector engine (TypeScript source from the shared package) is inlined,
  // the same way the desktop app bundles it. Native/peer modules stay external: `cap` is an
  // optional native binding loaded via guarded require(), and `roku-dev-studio-api` is resolved
  // from node_modules at runtime (avoids double-bundling the sibling package).
  bundle: true,
  external: ['cap', 'roku-dev-studio-api'],
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  banner: { js: '#!/usr/bin/env node\n' },
  logLevel: 'info'
});

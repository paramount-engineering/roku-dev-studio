#!/usr/bin/env node
/**
 * Transpile roku-remote-server.ts → roku-remote-server.js (CommonJS, no bundle).
 */
import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const base = {
  absWorkingDir: __dirname,
  // Bundle so the Network Inspector engine (TypeScript source from the shared package) is inlined,
  // the same way the desktop app bundles it. Native/peer modules stay external: `cap` is an
  // optional native binding loaded via guarded require(), and `roku-dev-studio-api` is resolved
  // from node_modules at runtime (avoids double-bundling the sibling package).
  bundle: true,
  external: ['cap', 'roku-dev-studio-api'],
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  logLevel: 'info'
};

await esbuild.build({
  ...base,
  entryPoints: [join(__dirname, 'roku-remote-server.ts')],
  outfile: join(__dirname, 'roku-remote-server.js'),
  banner: { js: '#!/usr/bin/env node\n' }
});

// worker_threads entry for MITM leaf-cert signing (see mitm-proxy.ts / leaf-cert.worker.ts in the
// network-inspector package — this proxy runs in both the desktop app and this server). `new
// Worker(path)` needs a real standalone file, output alongside roku-remote-server.js so its
// `path.join(__dirname, 'leaf-cert.worker.js')` lookup resolves at runtime.
await esbuild.build({
  ...base,
  entryPoints: [join(__dirname, '..', 'roku-dev-studio-network-inspector', 'leaf-cert.worker.ts')],
  outfile: join(__dirname, 'leaf-cert.worker.js')
});

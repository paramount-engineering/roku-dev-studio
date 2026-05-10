#!/usr/bin/env node
/**
 * Compile repo-root lib/path-safe.ts → lib/path-safe.js (repo) and copy into apps/roku-dev-studio/lib/
 * for Electron packaging (asar resolves modules under the app tree).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as esbuild from 'esbuild';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const srcTs = path.join(repoRoot, 'lib', 'path-safe.ts');
const repoOutJs = path.join(repoRoot, 'lib', 'path-safe.js');
const destDir = path.join(__dirname, '..', 'lib');
const dest = path.join(destDir, 'path-safe.js');

if (!fs.existsSync(srcTs)) {
  console.error(`sync-path-safe: missing source file: ${srcTs}`);
  process.exit(1);
}

void esbuild
  .build({
    absWorkingDir: repoRoot,
    entryPoints: [srcTs],
    outfile: repoOutJs,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    logLevel: 'info',
  })
  .then(() => {
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(repoOutJs, dest);
    console.log(
      `sync-path-safe: built ${path.relative(repoRoot, repoOutJs)} → copied to ${path.relative(repoRoot, dest)}`
    );
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });

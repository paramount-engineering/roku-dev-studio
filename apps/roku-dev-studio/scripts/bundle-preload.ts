#!/usr/bin/env node
/**
 * @deprecated Use scripts/build/index.ts. Kept for older scripts/docs.
 */

import { spawnSync } from 'child_process';
import * as path from 'path';

const appDir = path.join(__dirname, '..');
const buildIndex = path.join(__dirname, 'build', 'index.ts');
const r = spawnSync(process.execPath, ['--import', 'tsx', buildIndex], {
  stdio: 'inherit',
  cwd: appDir,
});
process.exit(r.status === null ? (r.error ? 1 : 0) : r.status);

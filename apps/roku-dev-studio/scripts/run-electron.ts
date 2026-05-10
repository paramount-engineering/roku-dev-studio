#!/usr/bin/env node
/**
 * Launch Electron without relying on PATH (works with npm, bun, pnpm from any cwd).
 */

import { spawnSync } from 'child_process';
import * as path from 'path';

// The `electron` npm package resolves to the Electron executable path.
const electronPath = require('electron') as string;

const appRoot = path.join(__dirname, '..');
const r = spawnSync(electronPath, ['.'], { cwd: appRoot, stdio: 'inherit' });
process.exit(r.status == null ? (r.error ? 1 : 0) : r.status);

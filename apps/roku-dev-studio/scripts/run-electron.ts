#!/usr/bin/env node
/**
 * Launch Electron without relying on PATH (works with npm, bun, pnpm from any cwd).
 */

import { spawnSync } from 'child_process';
import * as path from 'path';

// The `electron` npm package resolves to the Electron executable path.
const electronPath = require('electron') as string;

const appRoot = path.join(__dirname, '..');
// Strip ELECTRON_RUN_AS_NODE: if the parent shell is itself hosted inside an
// Electron app (e.g. a VSCode/Claude Code integrated terminal), this leaks in
// and forces the spawned Electron binary to boot as plain Node instead of a
// GUI app — `require('electron')` then returns the path string instead of
// `{ app, BrowserWindow, ... }`, crashing on the first line that touches `app`.
const { ELECTRON_RUN_AS_NODE: _unused, ...env } = process.env;
const r = spawnSync(electronPath, ['.'], { cwd: appRoot, stdio: 'inherit', env });
process.exit(r.status == null ? (r.error ? 1 : 0) : r.status);

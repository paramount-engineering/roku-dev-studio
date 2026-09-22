#!/usr/bin/env node
/**
 * Desktop app transpile pipeline (run before Electron starts or after TS edits).
 *
 *   1. Main process + preload (+ about/settings preloads) → CJS at app root
 *   2. HTML renderer (TypeScript under renderer/) → ESM under renderer/dist/
 *
 * Chromium does not execute TypeScript; esbuild strips types and emits JS.
 */

import * as fs from 'fs';
import * as path from 'path';
import { transpileMainProcess } from './transpile-main-process';
import { transpileRenderer } from './transpile-renderer';

const appDir = path.join(__dirname, '..', '..');

/**
 * `build-info.json` — when this bundle was produced. Git-ignored like the bundles themselves (a
 * timestamp would dirty the tree on every build); packaged by electron-builder's `**\/*` and read by
 * main/about-dialog.ts for the About window's "Build Time" row.
 */
function writeBuildInfo(): void {
  const info = { buildTime: new Date().toISOString() };
  fs.writeFileSync(path.join(appDir, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
}

function buildDesktop(): void {
  transpileMainProcess(appDir);
  transpileRenderer(appDir);
  writeBuildInfo();
  console.log('build: preload-about.js, preload-settings.js, preload.bundled.cjs, main.bundled.cjs, renderer/dist/*.js, build-info.json');
}

buildDesktop();

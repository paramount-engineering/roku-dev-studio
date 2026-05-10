#!/usr/bin/env node
/**
 * Desktop app transpile pipeline (run before Electron starts or after TS edits).
 *
 *   1. Main process + preload (+ about/settings preloads) → CJS at app root
 *   2. HTML renderer (TypeScript under renderer/) → ESM under renderer/dist/
 *
 * Chromium does not execute TypeScript; esbuild strips types and emits JS.
 */

import * as path from 'path';
import { transpileMainProcess } from './transpile-main-process';
import { transpileRenderer } from './transpile-renderer';

const appDir = path.join(__dirname, '..', '..');

function buildDesktop(): void {
  transpileMainProcess(appDir);
  transpileRenderer(appDir);
  console.log('build: preload-about.js, preload-settings.js, preload.bundled.cjs, main.bundled.cjs, renderer/dist/*.js');
}

buildDesktop();

#!/usr/bin/env node
/**
 * Bundle Electron main process + preload (+ about window preload) from TypeScript → CJS.
 */

import * as path from 'path';
import * as esbuild from 'esbuild';

export const MAIN_EXTERNAL = [
  'electron',
  'roku-dev-studio-api',
  'ws',
  'form-data',
  'pdf-lib',
  // BrightScript Fiddle deps — require() at runtime, not bundled.
  'brighterscript',
  'fsevents',
  'chokidar'
];

/**
 * @param appDir Absolute path to apps/roku-dev-studio
 */
export function transpileMainProcess(appDir: string): void {
  esbuild.buildSync({
    absWorkingDir: appDir,
    entryPoints: [path.join(appDir, 'preload-about.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: path.join(appDir, 'preload-about.js'),
    external: ['electron'],
    logLevel: 'info',
    treeShaking: true,
  });

  esbuild.buildSync({
    absWorkingDir: appDir,
    entryPoints: [path.join(appDir, 'preload-settings.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: path.join(appDir, 'preload-settings.js'),
    external: ['electron'],
    logLevel: 'info',
    treeShaking: true,
  });

  esbuild.buildSync({
    absWorkingDir: appDir,
    entryPoints: [path.join(appDir, 'preload.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: path.join(appDir, 'preload.bundled.cjs'),
    external: ['electron'],
    logLevel: 'info',
    treeShaking: true,
  });

  esbuild.buildSync({
    absWorkingDir: appDir,
    entryPoints: [path.join(appDir, 'log-viewer-preload.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: path.join(appDir, 'log-viewer-preload.bundled.cjs'),
    external: ['electron'],
    logLevel: 'info',
    treeShaking: true,
  });

  esbuild.buildSync({
    absWorkingDir: appDir,
    entryPoints: [path.join(appDir, 'fiddle-preload.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: path.join(appDir, 'fiddle-preload.bundled.cjs'),
    external: ['electron'],
    logLevel: 'info',
    treeShaking: true,
  });

  esbuild.buildSync({
    absWorkingDir: appDir,
    entryPoints: [path.join(appDir, 'main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: path.join(appDir, 'main.bundled.cjs'),
    external: MAIN_EXTERNAL,
    logLevel: 'info',
    treeShaking: true,
  });
}

#!/usr/bin/env node
/**
 * Bundle Electron main process + preloads from TypeScript → CJS.
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
  'chokidar',
  // Optional native packet-capture binding (Network Inspector, Windows). Loaded via a guarded
  // runtime require(); must stay external so esbuild doesn't try to bundle its .node binary.
  'cap',
  // Zip reader for scanning sideloaded .brs source for STOP statements (debugger breakpoints).
  'adm-zip'
];

/** Preload bundles, all sharing the same `['electron']` external. `[entry.ts, outfile]`. */
const PRELOAD_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ['preload-about.ts', 'preload-about.js'],
  ['preload-settings.ts', 'preload-settings.js'],
  ['preload.ts', 'preload.bundled.cjs'],
  ['log-viewer-preload.ts', 'log-viewer-preload.bundled.cjs'],
  ['fiddle-preload.ts', 'fiddle-preload.bundled.cjs'],
  ['network-session-viewer-preload.ts', 'network-session-viewer-preload.bundled.cjs'],
  ['static-analysis-preload.ts', 'static-analysis-preload.bundled.cjs'],
];

/**
 * @param appDir Absolute path to apps/roku-dev-studio
 */
export function transpileMainProcess(appDir: string): void {
  // Options shared by every main/preload bundle. `alias`: a few of these graphs pull in renderer
  // helpers (e.g. the Log Viewer window reuses `console-find-helpers`) that import shared code via
  // the `@shared/*` alias — the renderer's own transpile rewrites that specifier for the browser,
  // but these bundle:true builds must resolve it to the app-level `shared/` source tree.
  const base = {
    absWorkingDir: appDir,
    alias: { '@shared': path.join(appDir, 'shared') },
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    logLevel: 'info',
    treeShaking: true,
  } as const;

  const bundleNode = (entry: string, outfile: string, external: string[]): void => {
    esbuild.buildSync({
      ...base,
      entryPoints: [path.join(appDir, entry)],
      outfile: path.join(appDir, outfile),
      external,
    });
  };

  for (const [entry, outfile] of PRELOAD_ENTRIES) bundleNode(entry, outfile, ['electron']);
  bundleNode('main.ts', 'main.bundled.cjs', MAIN_EXTERNAL);

  // worker_threads entries: each needs its own standalone file (`new Worker(path)` can't load a
  // symbol out of main.bundled.cjs), so they're bundled the same way as main itself. Output goes to
  // appDir root (bare filename), same as the preload bundles above — `__dirname` inside
  // main.bundled.cjs resolves to appDir root at runtime (see e.g. the preload path lookups in
  // main/*-window.ts), so callers do `path.join(__dirname, '<name>.worker.js')`.
  bundleNode('main/network-session-parse.worker.ts', 'network-session-parse.worker.js', MAIN_EXTERNAL);
  // Lives in the shared network-inspector package (mitm-proxy.ts is transport-agnostic, used by both
  // this app and the remote server) — same source file, bundled separately here and again by
  // roku-dev-studio-remote-server/build.mjs for its own process.
  bundleNode(
    '../../packages/roku-dev-studio-network-inspector/leaf-cert.worker.ts',
    'leaf-cert.worker.js',
    MAIN_EXTERNAL
  );
}

#!/usr/bin/env node
/**
 * Transpile HTML renderer TypeScript → ESM under renderer/dist/.
 * Copies modal HTML fragments so import.meta.url resolves next to emitted JS.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';

/** Copy Monaco's `min/vs` into renderer/dist/vendor/monaco so the Fiddle window can load via the AMD loader. */
export function copyMonacoVendor(appDir: string, rendererDist: string): void {
  const require = createRequire(path.join(appDir, 'package.json'));
  let pkgDir: string;
  try {
    pkgDir = path.dirname(require.resolve('monaco-editor/package.json'));
  } catch {
    console.warn('transpile-renderer: monaco-editor not installed — Fiddle window will not highlight code.');
    return;
  }
  const src = path.join(pkgDir, 'min');
  if (!fs.existsSync(src)) {
    console.warn('transpile-renderer: monaco-editor/min not found at', src);
    return;
  }
  const dest = path.join(rendererDist, 'vendor', 'monaco');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(src, dest, { recursive: true });
}

/** Copy `modern-screenshot` ESM next to legacy renderer sources and under `dist/` (for `../../vendor/…` imports). */
export function copyModernScreenshotVendor(appDir: string, rendererRoot: string, rendererDist: string): void {
  const require = createRequire(path.join(appDir, 'package.json'));
  let pkgDir: string;
  try {
    pkgDir = path.dirname(require.resolve('modern-screenshot/package.json'));
  } catch {
    console.warn(
      'transpile-renderer: optional dependency modern-screenshot missing — run npm install in apps/roku-dev-studio'
    );
    return;
  }
  const src = path.join(pkgDir, 'dist', 'index.mjs');
  if (!fs.existsSync(src)) {
    console.warn('transpile-renderer: modern-screenshot dist/index.mjs not found at', src);
    return;
  }
  const destDist = path.join(rendererDist, 'vendor', 'modern-screenshot.mjs');
  fs.mkdirSync(path.dirname(destDist), { recursive: true });
  fs.copyFileSync(src, destDist);
  /* Same relative import `../../vendor/…` resolves from source (`renderer/components/…`) and from `dist/`. */
  const destSrcTree = path.join(rendererRoot, 'vendor', 'modern-screenshot.mjs');
  fs.mkdirSync(path.dirname(destSrcTree), { recursive: true });
  fs.copyFileSync(src, destSrcTree);
}

/**
 * `@tanstack/virtual-core` ships ESM as `index.js + utils.js` (relative `./utils.js`
 * import). Renderer source files live under `renderer/` with `bundle: false`, so we
 * can't let esbuild resolve the package per-file at build time. Instead, bundle the
 * package into a *single* ESM file and stage it under `renderer/vendor/` (for source
 * resolution) and `renderer/dist/vendor/` (for the emitted JS) so renderer code can
 * import `'../../vendor/tanstack-virtual-core.mjs'` from any depth.
 */
export function copyTanstackVirtualVendor(appDir: string, rendererRoot: string, rendererDist: string): void {
  const require = createRequire(path.join(appDir, 'package.json'));
  let pkgDir: string;
  try {
    pkgDir = path.dirname(require.resolve('@tanstack/virtual-core/package.json'));
  } catch {
    console.warn(
      'transpile-renderer: @tanstack/virtual-core missing — log viewer / Console virtualization disabled'
    );
    return;
  }
  const src = path.join(pkgDir, 'dist', 'esm', 'index.js');
  if (!fs.existsSync(src)) {
    console.warn('transpile-renderer: @tanstack/virtual-core dist/esm/index.js not found at', src);
    return;
  }
  const destDist = path.join(rendererDist, 'vendor', 'tanstack-virtual-core.mjs');
  const destSrcTree = path.join(rendererRoot, 'vendor', 'tanstack-virtual-core.mjs');
  fs.mkdirSync(path.dirname(destDist), { recursive: true });
  fs.mkdirSync(path.dirname(destSrcTree), { recursive: true });
  // Bundle index.js + utils.js into one file so the relative `./utils.js` import is
  // inlined. esbuild's `bundle: true` resolves the relative graph from the entry.
  esbuild.buildSync({
    absWorkingDir: appDir,
    entryPoints: [src],
    outfile: destDist,
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    logLevel: 'silent'
  });
  fs.copyFileSync(destDist, destSrcTree);
}

/** Emit renderer-imported modules from `shared/` into `renderer/dist/shared/` (runtime ESM). */
function transpileSharedForRenderer(appDir: string, rendererDist: string): void {
  const sharedRoot = path.join(appDir, 'shared');
  const sharedOut = path.join(rendererDist, 'shared');

  // 1) Local shared modules with no external dependencies: a plain per-file transpile is enough
  //    (their relative imports resolve as-is in the renderer dist tree).
  const plainEntries = [
    path.join(sharedRoot, 'ipc', 'debug-telnet-connection-id.ts'),
  ].filter((p) => fs.existsSync(p));
  if (plainEntries.length > 0) {
    fs.mkdirSync(sharedOut, { recursive: true });
    esbuild.buildSync({
      absWorkingDir: appDir,
      entryPoints: plainEntries,
      outdir: sharedOut,
      outbase: sharedRoot,
      bundle: false,
      platform: 'browser',
      format: 'esm',
      target: 'es2022',
      logLevel: 'info',
    });
  }

  // 2) `shared/network-inspector/*` are shims that re-export runtime content from the
  //    `roku-dev-studio-network-inspector` package (e.g. setup-guide). These MUST be bundled so the
  //    bare package specifier is inlined into a browser-loadable module — a plain transpile would
  //    leave an unresolvable `import … from 'roku-dev-studio-network-inspector/…'` that 404s at
  //    runtime and takes down the whole ESM graph (every button/scan dies). Bundling *every* .ts in
  //    this dir means new shared shims are emitted automatically without editing this script.
  //    `shared/logging/*` is the same kind of shim: it re-exports the shared logger from the
  //    `roku-dev-studio-platform` package, so it MUST be bundled to inline that bare specifier.
  const bundledShimDirs = [
    path.join(sharedRoot, 'network-inspector'),
    path.join(sharedRoot, 'logging'),
  ];
  const shimEntries = bundledShimDirs.flatMap((d) => walkTsFiles(d));
  if (shimEntries.length > 0) {
    fs.mkdirSync(sharedOut, { recursive: true });
    esbuild.buildSync({
      absWorkingDir: appDir,
      entryPoints: shimEntries,
      outdir: sharedOut,
      outbase: sharedRoot,
      bundle: true,
      platform: 'browser',
      format: 'esm',
      target: 'es2022',
      logLevel: 'info',
    });
  }
}

/** Fail fast when renderer/dist is missing modules the HTML shell loads at runtime. */
function verifyRendererDist(appDir: string, rendererDist: string): void {
  const required = [
    path.join(rendererDist, 'app.js'),
    path.join(rendererDist, 'shared', 'ipc', 'debug-telnet-connection-id.js'),
    // Runtime shared shim imported by the Network Inspector — a 404 here breaks the whole ESM graph.
    path.join(rendererDist, 'shared', 'network-inspector', 'setup-guide.js'),
    // Shared logger shim — imported broadly across the renderer; a 404 takes down the ESM graph.
    path.join(rendererDist, 'shared', 'logging', 'logger.js'),
  ];
  const missing = required.filter((p) => !fs.existsSync(p));
  if (missing.length > 0) {
    throw new Error(
      `transpile-renderer: missing expected output:\n${missing.map((p) => `  - ${path.relative(appDir, p)}`).join('\n')}`
    );
  }
}

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkTsFiles(p, acc);
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) acc.push(p);
  }
  return acc;
}

/**
 * @param appDir Absolute path to apps/roku-dev-studio
 */
export function transpileRenderer(appDir: string): void {
  const rendererRoot = path.join(appDir, 'renderer');
  const rendererDist = path.join(rendererRoot, 'dist');

  const roots = [
    path.join(rendererRoot, 'modules'),
    path.join(rendererRoot, 'components', 'queries'),
    path.join(rendererRoot, 'components', 'action-scripts'),
    path.join(rendererRoot, 'components', 'inspector'),
    path.join(rendererRoot, 'components', 'dev-app'),
    path.join(rendererRoot, 'components', 'floating-remote'),
    path.join(rendererRoot, 'components', 'modals'),
    path.join(rendererRoot, 'components', 'log-file-viewer'),
    path.join(rendererRoot, 'components', 'fiddle'),
    path.join(rendererRoot, 'components', 'network-inspector'),
  ];
  const entryPoints = roots.flatMap((r) => walkTsFiles(r));
  const appTs = path.join(rendererRoot, 'app.ts');
  if (fs.existsSync(appTs)) entryPoints.push(appTs);
  if (entryPoints.length === 0) {
    console.warn('transpile-renderer: no .ts entry points');
    return;
  }

  fs.rmSync(rendererDist, { recursive: true, force: true });
  fs.mkdirSync(rendererDist, { recursive: true });

  esbuild.buildSync({
    absWorkingDir: appDir,
    entryPoints,
    outdir: rendererDist,
    outbase: rendererRoot,
    bundle: false,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    logLevel: 'info',
  });

  transpileSharedForRenderer(appDir, rendererDist);
  copyModernScreenshotVendor(appDir, rendererRoot, rendererDist);
  copyTanstackVirtualVendor(appDir, rendererRoot, rendererDist);
  copyMonacoVendor(appDir, rendererDist);

  const fragmentsSrc = path.join(rendererRoot, 'components', 'modals', 'fragments');
  const fragmentsDest = path.join(rendererDist, 'components', 'modals', 'fragments');
  if (fs.existsSync(fragmentsSrc)) {
    fs.mkdirSync(path.dirname(fragmentsDest), { recursive: true });
    fs.cpSync(fragmentsSrc, fragmentsDest, { recursive: true });
  }

  verifyRendererDist(appDir, rendererDist);
  console.log('HTML renderer:', entryPoints.length, 'modules →', path.relative(appDir, rendererDist));
}

#!/usr/bin/env node
/**
 * Transpile HTML renderer TypeScript → ESM under renderer/dist/.
 * Copies modal HTML fragments so import.meta.url resolves next to emitted JS.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';

/** Common esbuild options for renderer browser-ESM output (per-file transpile + shared-shim bundles).
 *  `minify` shrinks in-file whitespace/locals; `keepNames` preserves `.name`/`constructor.name`. */
const BROWSER_ESM = {
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  minify: true,
  keepNames: true,
  logLevel: 'info',
} as const;

/**
 * Extract the inline CSS from index.html's single <style> block into dist/network-session-viewer.css
 * so the standalone Network Session Viewer window can reuse the exact same `ni-*` + theme styles the
 * live Network Inspector uses (which are authored inline in index.html). Regenerated on every build,
 * so the viewer never drifts from the app's styling.
 */
export function extractIndexStyleToCss(rendererRoot: string, rendererDist: string): void {
  const indexHtml = path.join(rendererRoot, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    console.warn('transpile-renderer: index.html not found — skipping network-session-viewer.css');
    return;
  }
  const html = fs.readFileSync(indexHtml, 'utf-8');
  const match = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html);
  if (!match) {
    console.warn('transpile-renderer: no <style> block in index.html — skipping network-session-viewer.css');
    return;
  }
  // Guard against the recurring "chopped card headers" class of bug: a single mis-edit in this
  // ~13k-line inline stylesheet (an unclosed `/* */`, a stray/missing `}`) makes the browser's CSS
  // parser skip a whole run of rules — silently dropping globals like `.card-header { min-height }`,
  // which collapses every card header. Nothing caught it before, so it kept shipping and getting
  // re-fixed. Fail the build here instead, with a line number, the moment the block is malformed.
  const styleLine = html.slice(0, match.index).split('\n').length; // 1-based line of `<style>`
  validateIndexCss(match[1], styleLine);

  const header = '/* AUTO-GENERATED from renderer/index.html <style> by transpile-renderer.ts. Do not edit. */\n';
  fs.mkdirSync(rendererDist, { recursive: true });
  fs.writeFileSync(path.join(rendererDist, 'network-session-viewer.css'), header + match[1], 'utf-8');
}

/**
 * Fail the build if index.html's inline `<style>` is structurally broken in a way that makes a CSS
 * parser drop rules. Three cheap, false-positive-free checks: (1) `/*`↔`*​/` comment-delimiter
 * balance, (2) brace balance (never dips negative, ends at zero — after stripping comments/strings),
 * (3) esbuild's CSS parser must not hard-error. `lineOffset` maps offsets back to index.html lines.
 */
function validateIndexCss(css: string, lineOffset: number): void {
  const fail = (msg: string, lineInCss?: number): never => {
    const where = lineInCss != null ? ` (index.html line ~${lineOffset + lineInCss - 1})` : '';
    throw new Error(`transpile-renderer: index.html <style> is malformed${where} — ${msg}. ` +
      `A broken stylesheet silently drops CSS rules (e.g. chopped card headers). Fix before building.`);
  };

  const opens = (css.match(/\/\*/g) || []).length;
  const closes = (css.match(/\*\//g) || []).length;
  if (opens !== closes) fail(`unbalanced block comments (/*=${opens}, */=${closes}) — likely an unclosed /* … */`);

  // Strip comments + quoted strings so braces inside them don't skew the count.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  let depth = 0;
  let line = 1;
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === '\n') line++;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth < 0) fail('a stray `}` closes a rule that was never opened', line);
  }
  if (depth !== 0) fail(`${depth} unclosed \`{\` — a rule is missing its closing brace`);

  try {
    esbuild.transformSync(css, { loader: 'css' });
  } catch (e) {
    const err = (e as { errors?: Array<{ text: string; location?: { line: number } }> }).errors?.[0];
    fail(err?.text ?? String(e), err?.location?.line);
  }
}

/**
 * Resolve `<pkg>/<...subpath>` from the app's node_modules, or return `null` (with a warning) when
 * the package or the specific file is missing. Every vendor-staging step below shares this head —
 * an optional/vendored dep is a warn-and-skip, never a hard build failure.
 */
function resolveVendorFile(
  appDir: string,
  pkg: string,
  subpath: string[],
  missingWarn: string
): string | null {
  const require = createRequire(path.join(appDir, 'package.json'));
  let pkgDir: string;
  try {
    pkgDir = path.dirname(require.resolve(`${pkg}/package.json`));
  } catch {
    console.warn(missingWarn);
    return null;
  }
  const src = path.join(pkgDir, ...subpath);
  if (!fs.existsSync(src)) {
    console.warn(`transpile-renderer: ${pkg} ${subpath.join('/')} not found at`, src);
    return null;
  }
  return src;
}

/** Copy Monaco's `min/vs` into renderer/dist/vendor/monaco so the Fiddle window can load via the AMD loader. */
export function copyMonacoVendor(appDir: string, rendererDist: string): void {
  const src = resolveVendorFile(
    appDir,
    'monaco-editor',
    ['min'],
    'transpile-renderer: monaco-editor not installed — Fiddle window will not highlight code.'
  );
  if (!src) return;
  const dest = path.join(rendererDist, 'vendor', 'monaco');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(src, dest, { recursive: true });
  pruneMonacoVendor(dest);
}

/**
 * Drop the Monaco pieces the Fiddle window never loads (~7.6 MB of the ~13 MB `min/vs`).
 * Fiddle registers a fully-custom `brightscript` Monarch language (see fiddle.ts) and
 * never creates models for any built-in language, so:
 *   - `vs/language/*`     — TS/HTML/CSS/JSON worker language services (~6.9 MB), never requested.
 *   - `vs/basic-languages/*` — the 81 built-in syntax defs (~640 KB), never requested.
 *   - `vs/nls.messages.<locale>.js` — non-`en` UI localizations (the app ships en/en_GB only).
 * The AMD loader only fetches these on demand, so removing them can't break the editor.
 * `vs/editor`, `vs/base`, and `vs/loader.js` are required and kept.
 */
function pruneMonacoVendor(dest: string): void {
  // The copied tree lives under `<dest>/vs/…` (Monaco's `min/vs` structure).
  const vs = path.join(dest, 'vs');
  if (!fs.existsSync(vs)) return;
  const rmDirs = [path.join(vs, 'language'), path.join(vs, 'basic-languages')];
  for (const dir of rmDirs) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
  // Remove localized `nls.messages.<locale>.js`; keep the default `nls.messages.js`.
  for (const name of fs.readdirSync(vs)) {
    if (/^nls\.messages\.[^.]+\.js$/.test(name)) {
      fs.rmSync(path.join(vs, name), { force: true });
    }
  }
}

/** Copy `modern-screenshot` ESM next to legacy renderer sources and under `dist/` (for `../../vendor/…` imports). */
export function copyModernScreenshotVendor(appDir: string, rendererRoot: string, rendererDist: string): void {
  const src = resolveVendorFile(
    appDir,
    'modern-screenshot',
    ['dist', 'index.mjs'],
    'transpile-renderer: optional dependency modern-screenshot missing — run npm install in apps/roku-dev-studio'
  );
  if (!src) return;
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
  const src = resolveVendorFile(
    appDir,
    '@tanstack/virtual-core',
    ['dist', 'esm', 'index.js'],
    'transpile-renderer: @tanstack/virtual-core missing — log viewer / Console virtualization disabled'
  );
  if (!src) return;
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
      ...BROWSER_ESM,
      absWorkingDir: appDir,
      entryPoints: plainEntries,
      outdir: sharedOut,
      outbase: sharedRoot,
      bundle: false,
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
    path.join(sharedRoot, 'platform'),
  ];
  const shimEntries = bundledShimDirs.flatMap((d) => walkTsFiles(d));
  if (shimEntries.length > 0) {
    fs.mkdirSync(sharedOut, { recursive: true });
    esbuild.buildSync({
      ...BROWSER_ESM,
      absWorkingDir: appDir,
      entryPoints: shimEntries,
      outdir: sharedOut,
      outbase: sharedRoot,
      bundle: true,
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

function walkJsFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkJsFiles(p, acc);
    else if (name.endsWith('.js')) acc.push(p);
  }
  return acc;
}

/**
 * Rewrite the `@shared/*` alias to a plain relative path in every emitted renderer module.
 *
 * Renderer source imports shared code as `@shared/foo.js` (one location-independent convention, no
 * `../` counting — resolved for type-check by tsconfig `paths`). The per-file transpile (`bundle:
 * false`) leaves that bare specifier in the output, but the browser can't resolve a bare specifier
 * and the app's CSP (`script-src 'self'`) forbids the inline `<script type="importmap">` that would
 * map it. So we resolve it here instead: for each emitted `.js` file under `dist/`, replace
 * `@shared/` with the relative path from that file's directory to `dist/shared/`. The result is ESM
 * imports — CSP-safe, no import map, and the depth math is done once by the build, not by hand.
 */
function rewriteSharedAlias(rendererDist: string): void {
  const sharedDir = path.join(rendererDist, 'shared');
  for (const file of walkJsFiles(rendererDist)) {
    const code = fs.readFileSync(file, 'utf-8');
    if (!code.includes('@shared/')) continue;
    let rel = path.relative(path.dirname(file), sharedDir);
    if (!rel.startsWith('.')) rel = `./${rel}`;
    // Match the specifier in both quote styles esbuild may emit (e.g. `from"@shared/x.js"`).
    fs.writeFileSync(file, code.replace(/(["'])@shared\//g, `$1${rel}/`), 'utf-8');
  }
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
    path.join(rendererRoot, 'components', 'network-session-viewer'),
    path.join(rendererRoot, 'components', 'about'),
    path.join(rendererRoot, 'components', 'settings'),
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

  // `bundle: false` keeps import/export bindings intact (esbuild never renames them across files),
  // so BROWSER_ESM's minify only shrinks in-file whitespace/syntax/locals.
  esbuild.buildSync({
    ...BROWSER_ESM,
    absWorkingDir: appDir,
    entryPoints,
    outdir: rendererDist,
    outbase: rendererRoot,
    bundle: false,
  });

  transpileSharedForRenderer(appDir, rendererDist);
  rewriteSharedAlias(rendererDist);
  copyModernScreenshotVendor(appDir, rendererRoot, rendererDist);
  copyTanstackVirtualVendor(appDir, rendererRoot, rendererDist);
  copyMonacoVendor(appDir, rendererDist);

  const fragmentsSrc = path.join(rendererRoot, 'components', 'modals', 'fragments');
  const fragmentsDest = path.join(rendererDist, 'components', 'modals', 'fragments');
  if (fs.existsSync(fragmentsSrc)) {
    fs.mkdirSync(path.dirname(fragmentsDest), { recursive: true });
    fs.cpSync(fragmentsSrc, fragmentsDest, { recursive: true });
  }

  // The Network Session Viewer is a standalone window that reuses the Network Inspector's `ni-*`
  // styles (and theme vars), which live inline in index.html's single <style> block. Extract that
  // block verbatim into dist/network-session-viewer.css so the viewer stays pixel-identical to the
  // live inspector with zero manual transcription (unused app rules are harmless).
  extractIndexStyleToCss(rendererRoot, rendererDist);

  verifyRendererDist(appDir, rendererDist);
  console.log('HTML renderer:', entryPoints.length, 'modules →', path.relative(appDir, rendererDist));
}

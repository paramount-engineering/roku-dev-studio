/**
 * Guard: every `data-i18n*` key referenced in static HTML **or in a renderer TS template string**
 * must resolve to a real string in the shared catalog (`shared/strings`). These attribute keys are
 * NOT type-checked, so a typo would silently fall back to inline English (or, worse, a future
 * refactor could drop the key). Some `data-i18n*` bindings live inside TS `innerHTML` templates
 * (network-detail-view, console-find-bar, function-selector, …) so they must be scanned too. Run in
 * CI alongside typecheck.
 *
 *   cd apps/roku-dev-studio && npm run verify:i18n
 */
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { S } from '../shared/strings/index.js';

const appDir = path.resolve(__dirname, '..');

function resolve(key: string): string | undefined {
  let cur: unknown = S;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** Strip `//` line and block comments so illustrative `data-i18n="area.key"` examples in JSDoc
 *  don't register as real keys. The line-comment pass leaves `://` (URLs) alone. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** All `.ts` files under `renderer/` except `.d.ts` and any build-output dir. */
function walkRendererTs(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.endsWith('-dist')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkRendererTs(full, acc);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) acc.push(full);
  }
  return acc;
}

const fragmentsDir = path.join(appDir, 'renderer/components/modals/fragments');
const htmlFiles = [
  'renderer/index.html',
  'renderer/settings.html',
  'renderer/fiddle.html',
  'renderer/action-scripts-viewer.html',
  'renderer/network-session-viewer.html',
  'renderer/about.html',
  'renderer/log-file-viewer.html',
  'renderer/static-analysis.html',
  ...readdirSync(fragmentsDir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join('renderer/components/modals/fragments', f)),
];
const tsFiles = walkRendererTs(path.join(appDir, 'renderer')).map((f) => path.relative(appDir, f));

const attrRe = /data-i18n(?:-placeholder|-title|-aria-label|-html|-alt)?="([^"]+)"/g;
let total = 0;
let skippedDynamic = 0;
const missing: string[] = [];
for (const rel of [...htmlFiles, ...tsFiles]) {
  const isTs = rel.endsWith('.ts');
  const src = readFileSync(path.join(appDir, rel), 'utf8');
  const text = isTs ? stripComments(src) : src;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(text)) !== null) {
    const key = m[1];
    // TS templates emit a state-dependent key via interpolation, e.g.
    // `data-i18n="${cond ? 'a.b' : 'c.d'}"` — can't be resolved statically, so skip it.
    if (key.includes('${')) { skippedDynamic++; continue; }
    total++;
    if (resolve(key) === undefined) missing.push(`${rel}: ${key}`);
  }
}

console.log(
  `verify:i18n — scanned ${htmlFiles.length} HTML + ${tsFiles.length} TS files, ${total} data-i18n* keys` +
    (skippedDynamic ? ` (${skippedDynamic} dynamic keys skipped).` : '.')
);
if (missing.length) {
  console.error(`\n❌ ${missing.length} data-i18n* key(s) do not resolve in the catalog:`);
  for (const x of missing) console.error('  ' + x);
  process.exit(1);
}
console.log('✅ All data-i18n* keys resolve to a catalog string.');

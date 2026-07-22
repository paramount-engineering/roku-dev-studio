/**
 * Guard: every `data-i18n*` key referenced in static HTML must resolve to a real
 * string in the shared catalog (`shared/strings`). HTML attribute keys are NOT
 * type-checked, so a typo would silently fall back to inline English (or, worse, a
 * future refactor could drop the key). Run in CI alongside typecheck.
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

const fragmentsDir = path.join(appDir, 'renderer/components/modals/fragments');
const htmlFiles = [
  'renderer/index.html',
  'renderer/settings.html',
  'renderer/fiddle.html',
  'renderer/network-session-viewer.html',
  'renderer/about.html',
  'renderer/log-file-viewer.html',
  ...readdirSync(fragmentsDir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join('renderer/components/modals/fragments', f)),
];

const attrRe = /data-i18n(?:-placeholder|-title|-aria-label)?="([^"]+)"/g;
let total = 0;
const missing: string[] = [];
for (const rel of htmlFiles) {
  const html = readFileSync(path.join(appDir, rel), 'utf8');
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(html)) !== null) {
    total++;
    if (resolve(m[1]) === undefined) missing.push(`${rel}: ${m[1]}`);
  }
}

console.log(`verify:i18n — scanned ${htmlFiles.length} HTML files, ${total} data-i18n* keys.`);
if (missing.length) {
  console.error(`\n❌ ${missing.length} data-i18n* key(s) do not resolve in the catalog:`);
  for (const x of missing) console.error('  ' + x);
  process.exit(1);
}
console.log('✅ All data-i18n* keys resolve to a catalog string.');

/**
 * Version strings that are hand-written into documentation must match the package manifests they
 * describe — they were bumped by hand on every release and drifted. This pins them:
 *   1. docs site pages (`docs/*.html`, JSON-LD `softwareVersion`) → the desktop app's version;
 *   2. the Remote Server OpenAPI document (`swagger.json`):
 *        `info.version` and every `serverVersion` example → the remote-server package version,
 *        every `apiVersion` example and the CapabilitiesResponse `version` (documented as the bundled
 *        api version) → the roku-dev-studio-api package version.
 *
 *   npm run verify:doc-versions   (in apps/roku-dev-studio; also part of the root `ci:app-check`)
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const readJson = (rel: string): any => JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));

const appVersion: string = readJson('apps/roku-dev-studio/package.json').version;
const apiVersion: string = readJson('packages/roku-dev-studio-api/package.json').version;
const serverVersion: string = readJson('packages/roku-dev-studio-remote-server/package.json').version;

const problems: string[] = [];
const expect = (where: string, actual: unknown, expected: string): void => {
  if (actual !== expected) problems.push(`${where}: "${String(actual)}" (expected "${expected}")`);
};

// 1. docs site: JSON-LD softwareVersion on every page that declares one
const docsDir = path.join(repoRoot, 'docs');
let docsChecked = 0;
for (const name of fs.readdirSync(docsDir).filter((n) => n.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(docsDir, name), 'utf8');
  for (const m of html.matchAll(/"softwareVersion":\s*"([^"]*)"/g)) {
    docsChecked++;
    expect(`docs/${name} softwareVersion`, m[1], appVersion);
  }
}

// 2. swagger.json: walk every object; version-ish keys are compared by what they document
const swagger = readJson('packages/roku-dev-studio-remote-server/swagger.json');
expect('swagger.json info.version', swagger.info?.version, serverVersion);
let swaggerChecked = 1;
const walk = (node: unknown, trail: string): void => {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, `${trail}[${i}]`));
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  // A schema property definition: { type: 'string', example: 'x.y.z' } keyed by the field name.
  const isPropertyDef = typeof obj.type === 'string' && 'example' in obj;
  for (const [key, value] of Object.entries(obj)) {
    const here = trail ? `${trail}.${key}` : key;
    if (key === 'apiVersion' || key === 'serverVersion' || (key === 'version' && trail.endsWith('.example'))) {
      const want = key === 'serverVersion' ? serverVersion : apiVersion;
      if (typeof value === 'string') {
        swaggerChecked++;
        expect(`swagger.json ${here}`, value, want);
      } else if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).example === 'string') {
        swaggerChecked++;
        expect(`swagger.json ${here}.example`, (value as Record<string, unknown>).example, want);
      }
    }
    if (!(isPropertyDef && key === 'example')) walk(value, here);
  }
};
walk(swagger, '');

if (problems.length > 0) {
  console.error('verify-doc-versions: stale version strings:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(
  `verify-doc-versions: OK — app ${appVersion} in ${docsChecked} docs page(s); api ${apiVersion} / server ${serverVersion} across ${swaggerChecked} swagger field(s)`
);

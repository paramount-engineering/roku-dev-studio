/**
 * Artifact naming has ONE source of truth: electron-builder's `build.artifactName` (plus the
 * `nsis` / `portable` overrides) in package.json. This expands every configured target × arch the
 * way electron-builder does and pins the consumers to it:
 *   1. no two artifacts may share a filename (the NSIS installer and the portable .exe once did);
 *   2. the build hook's classifyArtifact() must file every name — and the legacy 1.2.0 shapes —
 *      under the right platform/arch;
 *   3. the release-notes guidance words "Setup" / "Portable" must still appear in the Windows names.
 * It also prints the expanded names, so it doubles as the reference for docs and release notes.
 *
 *   npm run verify:artifact-names   (in apps/roku-dev-studio; also part of the root `ci:app-check`)
 */
import * as fs from 'fs';
import * as path from 'path';
import { classifyArtifact } from './build-hooks';

type Arch = 'x64' | 'arm64';
type Platform = 'mac' | 'windows' | 'linux';
interface TargetSpec {
  platform: Platform;
  target: string;
  ext: string;
  arch: Arch;
}

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const build = pkg.build as Record<string, any>;

// electron-builder's own defaults, used only when no artifactName is configured at any level.
const EB_DEFAULT = '${productName}-${version}-${arch}.${ext}';
const NSIS_DEFAULT = '${productName} Setup ${version}.${ext}';
const PORTABLE_DEFAULT = '${productName} ${version}.${ext}';

/** builder-util `getArtifactArchName`: deb x64 → amd64, AppImage x64 → x86_64, everything else verbatim. */
function archName(arch: Arch, ext: string): string {
  if (arch === 'x64' && ext === 'deb') return 'amd64';
  if (arch === 'x64' && ext === 'AppImage') return 'x86_64';
  return arch;
}

/** Same precedence as electron-builder: target options → platform options → top-level → default. */
function templateFor(t: TargetSpec): string {
  const targetKey = t.target === 'AppImage' ? 'appImage' : t.target;
  const platformKey = t.platform === 'windows' ? 'win' : t.platform;
  const fallback = t.target === 'nsis' ? NSIS_DEFAULT : t.target === 'portable' ? PORTABLE_DEFAULT : EB_DEFAULT;
  return build[targetKey]?.artifactName ?? build[platformKey]?.artifactName ?? build.artifactName ?? fallback;
}

function expand(t: TargetSpec): string {
  const vars: Record<string, string> = {
    productName: build.productName ?? pkg.name,
    name: pkg.name,
    version: pkg.version,
    arch: archName(t.arch, t.ext),
    ext: t.ext
  };
  return templateFor(t).replace(/\$\{(\w+)\}/g, (whole: string, k: string) => vars[k] ?? whole);
}

function targets(): TargetSpec[] {
  const out: TargetSpec[] = [];
  for (const t of build.mac.target) for (const a of t.arch as Arch[]) out.push({ platform: 'mac', target: t.target, ext: t.target, arch: a });
  for (const t of build.win.target) for (const a of t.arch as Arch[]) out.push({ platform: 'windows', target: t.target, ext: 'exe', arch: a });
  for (const t of build.linux.target) for (const a of t.arch as Arch[]) out.push({ platform: 'linux', target: t.target, ext: t.target, arch: a });
  return out;
}

/** Real asset names from the v1.2.0 GitHub release (pre-artifactName). The hook must still file these. */
const LEGACY_NAMES: Array<[string, Platform, Arch]> = [
  ['Roku Dev Studio-1.2.0-arm64.dmg', 'mac', 'arm64'],
  ['Roku Dev Studio-1.2.0-arm64-mac.zip', 'mac', 'arm64'],
  ['Roku Dev Studio-1.2.0-arm64-mac.zip.blockmap', 'mac', 'arm64'],
  ['Roku Dev Studio-1.2.0-mac.zip', 'mac', 'x64'],
  ['Roku Dev Studio Setup 1.2.0.exe', 'windows', 'x64'],
  ['Roku Dev Studio 1.2.0.exe', 'windows', 'x64'],
  ['roku-dev-studio_1.2.0_amd64.deb', 'linux', 'x64'],
  ['roku-dev-studio_1.2.0_arm64.deb', 'linux', 'arm64'],
  ['Roku Dev Studio-1.2.0-x86_64.AppImage', 'linux', 'x64'],
  ['Roku Dev Studio-1.2.0-arm64.AppImage', 'linux', 'arm64']
];

let failures = 0;
function check(ok: boolean, msg: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures++;
}

const expanded = targets().map((t) => ({ t, name: expand(t) }));
console.log(`Artifact names for version ${pkg.version}:`);
for (const { t, name } of expanded) console.log(`  ${t.platform.padEnd(7)} ${t.target.padEnd(8)} ${t.arch.padEnd(5)} ${name}`);
console.log();

const seen = new Map<string, TargetSpec>();
for (const { t, name } of expanded) {
  const prev = seen.get(name);
  check(!prev, prev ? `collision: ${prev.target}/${prev.arch} and ${t.target}/${t.arch} both produce "${name}"` : `unique: ${name}`);
  seen.set(name, t);
}

for (const { t, name } of expanded) {
  const c = classifyArtifact(name);
  check(c?.platform === t.platform && c?.arch === t.arch, `hook files "${name}" as ${t.platform}/${t.arch} (got ${c ? `${c.platform}/${c.arch}` : 'null'})`);
  if (t.target === 'dmg' || t.target === 'zip' || t.target === 'nsis') {
    // electron-builder emits differential-update blockmaps for these (dmg via `dmg.writeUpdateInfo`).
    const b = classifyArtifact(`${name}.blockmap`);
    check(b?.platform === t.platform && b?.arch === t.arch, `hook files "${name}.blockmap" alongside it`);
  }
}

for (const [name, platform, arch] of LEGACY_NAMES) {
  const c = classifyArtifact(name);
  check(c?.platform === platform && c?.arch === arch, `legacy "${name}" still files as ${platform}/${arch}`);
}

const nsisName = expanded.find((e) => e.t.target === 'nsis')?.name ?? '';
const portableName = expanded.find((e) => e.t.target === 'portable')?.name ?? '';
check(/Setup/.test(nsisName), `Windows installer name contains "Setup" (release notes tell users to look for it): ${nsisName}`);
check(/Portable/.test(portableName), `Windows portable name contains "Portable" (release notes tell users to look for it): ${portableName}`);

console.log();
if (failures > 0) {
  console.error(`${failures} artifact-naming check(s) failed.`);
  process.exit(1);
}
console.log('All artifact-naming checks passed.');

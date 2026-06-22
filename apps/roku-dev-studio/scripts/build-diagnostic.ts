#!/usr/bin/env node
/**
 * Diagnostic builds — side-by-side with release (`Roku Dev Studio Diagnostic`).
 * Sets `diagnosticBuild: true` in the packaged app for always-on logging.
 *
 * Usage:
 *   tsx scripts/build-diagnostic.ts win
 *   tsx scripts/build-diagnostic.ts mac
 *   tsx scripts/build-diagnostic.ts linux
 *   tsx scripts/build-diagnostic.ts all
 */

import { execFileSync } from 'child_process';
import * as path from 'path';

type DiagnosticTarget = 'win' | 'mac' | 'linux' | 'all';

const appDir = path.join(__dirname, '..');
const env = { ...process.env, RDS_DIAGNOSTIC_BUILD: '1' };

const DIAGNOSTIC_FLAGS = [
  '-c.productName=Roku Dev Studio Diagnostic',
  '-c.appId=com.paramount.vtg.roku-dev-studio.diagnostic',
  '-c.extraMetadata.diagnosticBuild=true'
];

function run(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { cwd: appDir, stdio: 'inherit', env, shell: process.platform === 'win32' });
}

function parseTarget(argv: string[]): DiagnosticTarget {
  const arg = argv[2]?.toLowerCase();
  if (arg === 'win' || arg === 'mac' || arg === 'linux' || arg === 'all') return arg;
  console.error('Usage: tsx scripts/build-diagnostic.ts <win|mac|linux|all>');
  process.exit(1);
}

function bundle(): void {
  console.log('[build:diagnostic] Bundling app…');
  run('npm', ['run', 'build:bundle']);
}

function buildWin(): void {
  console.log('[build:win:diagnostic] Packaging NSIS installer (Windows x64)…');
  console.log('  (NSIS is less likely to be quarantined than a portable self-extracting .exe.)');
  run('npx', [
    'electron-builder',
    '--win',
    'nsis',
    '--x64',
    ...DIAGNOSTIC_FLAGS,
    '-c.win.target=nsis',
    '-c.nsis.artifactName=Roku-Dev-Studio-Diagnostic-Setup-${version}.${ext}'
  ]);
  console.log('');
  console.log('[build:win:diagnostic] Done.');
  console.log('  apps/roku-dev-studio/dist/windows/x64/Roku-Dev-Studio-Diagnostic-Setup-<version>.exe');
  console.log('');
  console.log('  If Defender deletes the file: add an exclusion BEFORE copying (see DIAGNOSTIC_BUILD.md).');
  console.log('  Alternative: use normal Roku Dev Studio + Settings → Debug Logging ON.');
}

function buildMac(): void {
  console.log('[build:mac:diagnostic] Packaging macOS arm64 dmg + zip…');
  run('npx', ['electron-builder', '--mac', 'dmg:arm64', 'zip:arm64', ...DIAGNOSTIC_FLAGS]);
  console.log('');
  console.log('[build:mac:diagnostic] Done.');
  console.log('  apps/roku-dev-studio/dist/mac/arm64/Roku Dev Studio Diagnostic-<version>-arm64.dmg');
  console.log('  apps/roku-dev-studio/dist/mac/arm64/Roku Dev Studio Diagnostic-<version>-arm64-mac.zip');
}

function buildLinux(): void {
  console.log('[build:linux:diagnostic] Packaging deb + AppImage (x64 + arm64)…');
  run('npx', [
    'electron-builder',
    '--linux',
    ...DIAGNOSTIC_FLAGS,
    '-c.deb.packageName=roku-dev-studio-diagnostic',
    '-c.appImage.artifactName=Roku-Dev-Studio-Diagnostic-${version}-${arch}.${ext}'
  ]);
  console.log('');
  console.log('[build:linux:diagnostic] Done.');
  console.log('  apps/roku-dev-studio/dist/linux/x64/roku-dev-studio-diagnostic_<version>_amd64.deb');
  console.log('  apps/roku-dev-studio/dist/linux/arm64/roku-dev-studio-diagnostic_<version>_arm64.deb');
  console.log('  apps/roku-dev-studio/dist/linux/*/Roku-Dev-Studio-Diagnostic-<version>-*.AppImage');
}

function buildAll(): void {
  console.log('[build:all:diagnostic] Packaging mac + linux + win in parallel…');
  const flagStr = DIAGNOSTIC_FLAGS.join(' ');
  const macCmd = `electron-builder --mac dmg:arm64 zip:arm64 ${flagStr} -c.npmRebuild=false`;
  const linuxCmd = `electron-builder --linux ${flagStr} -c.deb.packageName=roku-dev-studio-diagnostic -c.appImage.artifactName=Roku-Dev-Studio-Diagnostic-\\\${version}-\\\${arch}.\\\${ext} -c.npmRebuild=false`;
  const winCmd = `electron-builder --win nsis --x64 ${flagStr} -c.win.target=nsis -c.nsis.artifactName=Roku-Dev-Studio-Diagnostic-Setup-\\\${version}.\\\${ext} -c.npmRebuild=false`;
  run('npx', [
    'concurrently',
    '--names',
    'mac,linux,win',
    '--prefix-colors',
    'cyan,green,magenta',
    macCmd,
    linuxCmd,
    winCmd
  ]);
  console.log('');
  console.log('[build:all:diagnostic] Done. See dist/mac/, dist/linux/, dist/windows/x64/.');
}

const target = parseTarget(process.argv);

switch (target) {
  case 'win':
    bundle();
    buildWin();
    break;
  case 'mac':
    bundle();
    buildMac();
    break;
  case 'linux':
    bundle();
    buildLinux();
    break;
  case 'all':
    bundle();
    buildAll();
    break;
}

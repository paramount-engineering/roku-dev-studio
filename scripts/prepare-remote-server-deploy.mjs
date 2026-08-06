#!/usr/bin/env node
/**
 * Builds a self-contained folder you can copy straight to a remote machine and run —
 * no npm registry access needed for our own (unpublished) packages.
 *
 * Rebuilds roku-dev-studio-api and roku-dev-studio-remote-server, packs the api
 * package into a tarball (npm pack — its own real dependencies like archiver/
 * commander/adm-zip still resolve from the public registry on the remote side),
 * copies the remote server's runtime files, and writes a package.json whose
 * `dependencies` points straight at the local tarball with `devDependencies`
 * stripped out — a plain `npm install` on the remote box then never touches the
 * unpublished `roku-dev-studio-platform` devDependency, which otherwise 404s.
 *
 * Output: ~/Desktop/RDS-Remote-Server-Copy (recreated fresh every run).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(repoRoot, 'packages/roku-dev-studio-api');
const remoteServerDir = path.join(repoRoot, 'packages/roku-dev-studio-remote-server');
const targetDir = path.join(os.homedir(), 'Desktop', 'RDS-Remote-Server-Copy');
const DEFAULT_PORT = 4951;

function log(msg) {
  console.log(`\n\x1b[36m▸ ${msg}\x1b[0m`);
}

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

log(`Rebuilding roku-dev-studio-api...`);
run('npm run build -w roku-dev-studio-api', repoRoot);

log(`Rebuilding roku-dev-studio-remote-server...`);
run('npm run build -w roku-dev-studio-remote-server', repoRoot);

log(`Recreating ${targetDir}`);
fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });

log(`Packing roku-dev-studio-api into the target folder...`);
run(`npm pack --pack-destination "${targetDir}"`, apiDir);

const apiPkg = JSON.parse(fs.readFileSync(path.join(apiDir, 'package.json'), 'utf8'));
const expectedTarball = `${apiPkg.name}-${apiPkg.version}.tgz`;
const tarballPath = path.join(targetDir, expectedTarball);
if (!fs.existsSync(tarballPath)) {
  // Fall back to whatever npm actually named it, in case the naming convention
  // ever changes (scoped package, pre-release tag, etc.).
  const found = fs.readdirSync(targetDir).find((f) => f.endsWith('.tgz'));
  if (!found) throw new Error('npm pack did not produce a .tgz in the target folder');
  console.warn(`Expected ${expectedTarball} but found ${found} — using that instead.`);
}
const tarballName = fs.existsSync(tarballPath) ? expectedTarball : fs.readdirSync(targetDir).find((f) => f.endsWith('.tgz'));

log('Copying remote server runtime files...');
const REQUIRED_FILES = ['roku-remote-server.js', 'swagger.json', 'swagger-ui.html'];
const OPTIONAL_FILES = ['com.roku-dev-studio.remote-server.plist', 'roku-remote-server.service'];
for (const f of REQUIRED_FILES) {
  fs.copyFileSync(path.join(remoteServerDir, f), path.join(targetDir, f));
}
fs.chmodSync(path.join(targetDir, 'roku-remote-server.js'), 0o755);
for (const f of OPTIONAL_FILES) {
  const src = path.join(remoteServerDir, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(targetDir, f));
}

log('Writing a package.json that installs from the local tarball only...');
const serverPkg = JSON.parse(fs.readFileSync(path.join(remoteServerDir, 'package.json'), 'utf8'));
delete serverPkg.devDependencies;
serverPkg.dependencies = { [apiPkg.name]: `file:./${tarballName}` };
// These reference build.mjs/tsc, which aren't shipped here — `prepare` already
// no-ops when roku-remote-server.js exists, but drop the rest since they'd
// otherwise dangle on a machine with no devDependencies installed.
delete serverPkg.scripts.build;
delete serverPkg.scripts.typecheck;
fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(serverPkg, null, 2) + '\n');

const readme = `RDS Remote Server — deployment copy
Built ${new Date().toISOString()}

WHAT'S IN HERE
  roku-remote-server.js   — the server (already built)
  package.json            — points at the local tarball below, no registry needed for it
  ${tarballName}  — roku-dev-studio-api, self-contained
  swagger.json / swagger-ui.html — served at /api-docs

ON THE REMOTE MACHINE
  1. Copy this entire folder over (scp -r, AirDrop, USB, shared drive — whatever works).
  2. cd into the copied folder.
  3. npm install --omit=dev
     (only needs internet access for roku-dev-studio-api's own real dependencies —
     archiver, commander, adm-zip — not for our internal packages.)
  4. sudo node roku-remote-server.js ${DEFAULT_PORT}
     (root is required for Network Inspector's raw packet capture; the server still
     runs without it, just with that one capability disabled. Not supported on Windows.)

Re-run \`npm run deploy:remote-server\` from the repo any time to refresh this folder.
`;
fs.writeFileSync(path.join(targetDir, 'README.txt'), readme);

log(`Done → ${targetDir}`);
console.log(fs.readdirSync(targetDir).map((f) => `  ${f}`).join('\n'));

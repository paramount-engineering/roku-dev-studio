#!/usr/bin/env node
/**
 * Resilient macOS packaging wrapper around `electron-builder --mac`.
 *
 * electron-builder builds a DMG by mounting a temporary read-write disk image, laying out the
 * icon/background, then detaching it. On macOS a background process — Spotlight (`mds`/`mdworker`)
 * indexing the freshly-mounted volume, Finder/Quick Look, or corporate anti-virus — routinely holds
 * the volume open for a beat, so the detach intermittently fails with:
 *
 *     hdiutil: couldn't unmount "diskN" - Resource busy
 *     dmgbuild.core.DMGError: Unable to detach device cleanly
 *
 * …and a run that fails this way often leaves its volume STILL mounted, which then trips the next
 * run's mount. It's an environmental flake, not a code error (the Windows/Linux packagers are
 * unaffected), so the right fix is to make it self-healing rather than fail the whole build.
 *
 * This wrapper: (1) force-detaches any stale "Roku Dev Studio" build volumes left over from a prior
 * failed run, (2) runs `electron-builder --mac`, streaming its output live, and (3) ONLY when the
 * failure is that specific transient detach error, cleans up and retries a couple of times with a
 * short backoff. Any other failure (signing, a real packaging error) is surfaced immediately, so we
 * never mask a genuine break behind retries.
 *
 * Every argument after the script name is passed straight through to electron-builder, so callers add
 * their own targets/config: `dmg:arm64 zip:arm64`, `-c.npmRebuild=false`, diagnostic `-c.*`, etc.
 * `--mac` is always supplied here — callers must NOT repeat it.
 */

import { spawn, spawnSync } from 'child_process';
import * as path from 'path';

const appDir = path.join(__dirname, '..', '..'); // scripts/build/ → app root
const passThrough = process.argv.slice(2);

const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 4000;
/** The transient dmgbuild/hdiutil detach failure this wrapper retries. Everything else is fatal. */
const DETACH_ERROR = /couldn't unmount|Unable to detach device cleanly|Resource busy/i;

/** Synchronous nap between attempts — this is a top-level build script, so blocking is fine. */
function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Force-detach any mounted "Roku Dev Studio" build volume — the temp DMG a prior failed run left
 * behind (its lingering mount is exactly what makes the next run's "Resource busy" recur). No-op off
 * macOS and when nothing matches. Scoped to our own build-image mount points, never user disks.
 */
function detachStaleVolumes(): void {
  if (process.platform !== 'darwin') return;
  const info = spawnSync('hdiutil', ['info'], { encoding: 'utf8' });
  if (info.status !== 0 || !info.stdout) return;
  // Volume rows look like: `/dev/disk6s1  <uuid>  /Volumes/Roku Dev Studio 1.1.0-arm64`
  const devices: string[] = [];
  for (const line of info.stdout.split('\n')) {
    if (!/\/Volumes\/Roku Dev Studio/i.test(line)) continue;
    const dev = line.match(/\/dev\/(disk\d+)/)?.[1]; // whole device, not the sN slice
    if (dev && !devices.includes(dev)) devices.push(dev);
  }
  for (const dev of devices) {
    console.log(`[build:mac] Detaching stale build volume /dev/${dev} …`);
    spawnSync('hdiutil', ['detach', `/dev/${dev}`, '-force'], { stdio: 'ignore' });
  }
}

/** Run `electron-builder --mac …` once, streaming output live while sniffing stderr for the flake. */
function runElectronBuilderMac(): Promise<{ code: number; sawDetachError: boolean }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['electron-builder', '--mac', ...passThrough], {
      cwd: appDir,
      env: process.env,
      shell: process.platform === 'win32'
    });
    let sawDetachError = false;
    child.stdout.on('data', (d: Buffer) => process.stdout.write(d));
    child.stderr.on('data', (d: Buffer) => {
      const s = d.toString();
      if (DETACH_ERROR.test(s)) sawDetachError = true;
      process.stderr.write(s);
    });
    child.on('error', (err) => {
      console.error(`[build:mac] Failed to launch electron-builder: ${err.message}`);
      resolve({ code: 1, sawDetachError: false });
    });
    child.on('close', (code) => resolve({ code: code ?? 1, sawDetachError }));
  });
}

async function main(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    detachStaleVolumes();
    if (attempt > 1) {
      console.log(`[build:mac] Retry ${attempt}/${MAX_ATTEMPTS} after a transient DMG detach failure…`);
    }
    const { code, sawDetachError } = await runElectronBuilderMac();
    if (code === 0) process.exit(0);
    if (!sawDetachError || attempt === MAX_ATTEMPTS) {
      console.error(`[build:mac] electron-builder --mac failed (exit ${code}).`);
      process.exit(code);
    }
    console.warn('[build:mac] Transient DMG unmount ("Resource busy") — detaching + retrying.');
    sleep(RETRY_BACKOFF_MS);
  }
}

void main();

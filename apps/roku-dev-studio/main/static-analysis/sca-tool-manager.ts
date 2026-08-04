/**
 * Fetches and caches Roku's own `sca-cmd` (Static Channel Analysis) CLI at runtime — RDS never
 * bundles or ships this tool itself, only the interface around it (see the window's doc comment).
 *
 * Cache layout under `<userData>/sca-cmd/`:
 *   current/      the "live" extracted tool; this is what gets spawned
 *   meta.json     sidecar recording the last-seen ETag (Roku publishes no version number, so
 *                 ETag/hash comparison is the only update-detection signal available)
 *   .extract-*    transient extraction staging dir, promoted to `current/` on success
 *   current.stale-*  the previous `current/`, moved aside during promotion, deleted async
 *
 * The zip is fetched straight into memory (it's ~2.2MB) — `adm-zip` accepts a `Buffer` directly,
 * so there's never a temp zip file to clean up.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { App } from 'electron';
import type { ScaError, ScaToolStatus } from '../../shared/ipc/payloads';
import { mainError, mainLog } from '../log';

const SCA_ZIP_URL = 'https://devtools.web.roku.com/static-channel-analysis/sca-cmd.zip';
const LAUNCHER_NAME = process.platform === 'win32' ? 'sca-cmd.bat' : 'sca-cmd';
const JAR_NAME = 'sca-cmd.jar';
const HEAD_TIMEOUT_MS = 8000;
const GET_TIMEOUT_MS = 120_000;

interface ScaToolMeta {
  schemaVersion: 1;
  etag: string | null;
  lastModified: string | null;
  downloadedAt: string;
  launcherRelPath: string;
  jarRelPath: string;
}

function getScaBaseDir(app: App): string {
  return path.join(app.getPath('userData'), 'sca-cmd');
}

function getCurrentDir(app: App): string {
  return path.join(getScaBaseDir(app), 'current');
}

/** Absolute path to the platform launcher once the tool is ready, or null if not cached yet. */
export function getScaLauncherPathSync(app: App): string | null {
  const meta = readMeta(path.join(getScaBaseDir(app), 'meta.json'));
  if (!meta) return null;
  const launcherPath = path.join(getCurrentDir(app), meta.launcherRelPath);
  return fs.existsSync(launcherPath) ? launcherPath : null;
}

function readMeta(metaPath: string): ScaToolMeta | null {
  try {
    const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as ScaToolMeta;
    return raw && raw.schemaVersion === 1 ? raw : null;
  } catch {
    return null;
  }
}

function writeMeta(metaPath: string, meta: ScaToolMeta): void {
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
}

function launcherExistsAndExecutable(currentDir: string, meta: ScaToolMeta): boolean {
  const launcherPath = path.join(currentDir, meta.launcherRelPath);
  const jarPath = path.join(currentDir, meta.jarRelPath);
  try {
    fs.accessSync(launcherPath, fs.constants.F_OK);
    fs.accessSync(jarPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Best-effort cleanup of any staging dirs left behind by a crash mid-download/promote. Every name
 *  this touches is one we create ourselves (unlike the shared OS temp root), so an unconditional
 *  recursive remove is safe. */
function cleanupStaleScaStaging(base: string): void {
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(base);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name.startsWith('.extract-') || name.startsWith('current.stale-')) {
      try {
        fs.rmSync(path.join(base, name), { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
  }
}

/**
 * Breadth-first, depth-bounded search for the platform launcher, then locates `sca-cmd.jar`
 * relative to it. Confirmed by inspecting the real zip: it's a standard Gradle "application"
 * distribution — `sca-cmd/bin/sca-cmd(.bat)` + `sca-cmd/lib/sca-cmd.jar` (plus ~20 dependency
 * jars) — so the launcher and jar are siblings-of-a-sibling (`bin/` and `lib/` under the same
 * parent), NOT siblings of each other. The launcher script itself resolves its own `APP_HOME` as
 * the parent of its own directory and builds its classpath from `$APP_HOME/lib/*.jar`, so as long
 * as the whole `bin/` + `lib/` tree stays intact relative to itself, spawning the launcher
 * directly (from any cwd) works without RDS needing to know its classpath.
 */
function findLauncherAndJar(root: string): { launcherRelPath: string; jarRelPath: string } | null {
  let frontier = [root];
  for (let depth = 0; depth <= 4 && frontier.length > 0; depth++) {
    for (const dir of frontier) {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      const launcher = entries.find((e) => e.isFile() && e.name.toLowerCase() === LAUNCHER_NAME.toLowerCase());
      if (!launcher) continue;
      const launcherPath = path.join(dir, launcher.name);
      // Gradle "application" layout: launcher in .../bin/, jar in a sibling .../lib/.
      const gradleJarPath = path.join(path.dirname(dir), 'lib', JAR_NAME);
      // Fallback: some other layout puts the jar right next to the launcher.
      const siblingJarPath = path.join(dir, JAR_NAME);
      const jarPath = fs.existsSync(gradleJarPath) ? gradleJarPath : fs.existsSync(siblingJarPath) ? siblingJarPath : null;
      if (jarPath) {
        return { launcherRelPath: path.relative(root, launcherPath), jarRelPath: path.relative(root, jarPath) };
      }
    }
    frontier = frontier.flatMap((dir) => {
      try {
        return fs
          .readdirSync(dir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => path.join(dir, e.name));
      } catch {
        return [];
      }
    });
  }
  return null;
}

/** Windows can't rename over a non-empty directory, so move the old one aside first. Self-healing:
 *  if the process dies between the two renames, the next call just won't find `current/`, treats
 *  the cache as unhealthy, and re-downloads — no crash-specific recovery logic needed. */
function promoteStagingToCurrent(base: string, stagingDir: string, currentDir: string): void {
  if (fs.existsSync(currentDir)) {
    const stale = path.join(base, `current.stale-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.renameSync(currentDir, stale);
    void fs.promises.rm(stale, { recursive: true, force: true }).catch(() => {});
  }
  fs.renameSync(stagingDir, currentDir);
}

function classifyFsError(err: unknown): ScaError {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === 'ENOSPC') return { code: 'disk-full', message: 'Not enough disk space to install the analysis tool.' };
  if (code === 'EACCES' || code === 'EPERM') {
    return { code: 'permission-denied', message: 'Permission denied writing the analysis tool to disk.' };
  }
  return { code: 'unexpected-archive-layout', message: err instanceof Error ? err.message : String(err) };
}

async function safeHead(url: string): Promise<{ etag: string | null } | null> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(HEAD_TIMEOUT_MS) });
    if (!res.ok) return null;
    return { etag: res.headers.get('etag') };
  } catch {
    return null;
  }
}

let inFlight: Promise<ScaToolStatus> | null = null;

/**
 * Ensures a working, current copy of `sca-cmd` is cached locally, downloading/replacing it only
 * when needed. Single-flight: an overlapping call (e.g. the window closed and reopened quickly)
 * awaits the same promise instead of racing a second download/extract/promote against the first.
 */
export function ensureScaToolReady(
  app: App,
  opts: { force?: boolean; onStatus?: (status: ScaToolStatus) => void } = {}
): Promise<ScaToolStatus> {
  if (inFlight) return inFlight;
  inFlight = runEnsure(app, opts).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runEnsure(app: App, opts: { force?: boolean; onStatus?: (status: ScaToolStatus) => void }): Promise<ScaToolStatus> {
  const emit = (status: ScaToolStatus): ScaToolStatus => {
    opts.onStatus?.(status);
    return status;
  };

  const base = getScaBaseDir(app);
  const currentDir = getCurrentDir(app);
  const metaPath = path.join(base, 'meta.json');

  try {
    fs.mkdirSync(base, { recursive: true });
  } catch (err) {
    return emit({ type: 'error', error: classifyFsError(err) });
  }
  cleanupStaleScaStaging(base);

  emit({ type: 'checking' });

  const meta = readMeta(metaPath);
  const cacheHealthy = !!meta && launcherExistsAndExecutable(currentDir, meta);

  if (cacheHealthy && !opts.force) {
    const head = await safeHead(SCA_ZIP_URL);
    if (head === null) {
      // Offline / CDN unreachable but we already have a working cached tool — degrade to
      // "use what we have" rather than blocking the user with a network error.
      return emit({ type: 'ready', etag: meta!.etag ?? undefined, updated: false });
    }
    if (head.etag && head.etag === meta!.etag) {
      return emit({ type: 'ready', etag: head.etag, updated: false });
    }
    // ETag differs (or the CDN omitted one this time) — fall through to a full re-download.
  } else if (!cacheHealthy) {
    // No usable cache — an unreachable CDN here IS fatal, there's nothing to fall back on.
    const head = await safeHead(SCA_ZIP_URL);
    if (head === null) {
      return emit({
        type: 'error',
        error: { code: 'network-unreachable', message: "Could not reach Roku's analysis-tool download server." }
      });
    }
  }

  emit({ type: 'downloading' });
  let getRes: Response;
  try {
    getRes = await fetch(SCA_ZIP_URL, { signal: AbortSignal.timeout(GET_TIMEOUT_MS) });
  } catch (err) {
    return emit({ type: 'error', error: { code: 'network-unreachable', message: err instanceof Error ? err.message : String(err) } });
  }
  if (!getRes.ok) {
    return emit({
      type: 'error',
      error: { code: 'cdn-non-200', message: `Download failed (HTTP ${getRes.status}).`, httpStatus: getRes.status }
    });
  }
  const etag = getRes.headers.get('etag');
  const lastModified = getRes.headers.get('last-modified');
  const buf = Buffer.from(await getRes.arrayBuffer());

  const stagingDir = path.join(base, `.extract-${process.pid}-${Date.now()}`);
  try {
    fs.mkdirSync(stagingDir, { recursive: true });
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(buf);
    await new Promise<void>((resolve, reject) => {
      zip.extractAllToAsync(stagingDir, true, false, (err: Error | null) => (err ? reject(err) : resolve()));
    });
  } catch (err) {
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
    mainError('[StaticAnalysis] extract failed:', err);
    return emit({ type: 'error', error: classifyFsError(err) });
  }

  const found = findLauncherAndJar(stagingDir);
  if (!found) {
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
    return emit({
      type: 'error',
      error: { code: 'unexpected-archive-layout', message: 'sca-cmd.zip did not contain the expected launcher/jar files.' }
    });
  }

  if (process.platform !== 'win32') {
    // adm-zip's extractor opens files with a bare 0o666 (no exec bit) regardless of the zip's
    // stored attributes — never rely on it preserving the launcher's executable permission.
    fs.chmodSync(path.join(stagingDir, found.launcherRelPath), 0o755);
  }

  try {
    promoteStagingToCurrent(base, stagingDir, currentDir);
  } catch (err) {
    return emit({ type: 'error', error: classifyFsError(err) });
  }

  writeMeta(metaPath, {
    schemaVersion: 1,
    etag,
    lastModified,
    downloadedAt: new Date().toISOString(),
    launcherRelPath: found.launcherRelPath,
    jarRelPath: found.jarRelPath
  });

  mainLog(`[StaticAnalysis] sca-cmd installed (etag=${etag ?? 'none'})`);
  return emit({ type: 'ready', etag: etag ?? undefined, updated: true });
}

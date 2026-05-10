/**
 * Build a minimal Roku SceneGraph channel around a single user-authored
 * BrightScript file ("Fiddle"). Produces a sideloadable .zip on disk.
 *
 * The channel is assembled entirely from the static asset tree at
 * repo-root `roku-components/fiddle/` (copied into `dist/roku-components/fiddle/`
 * by `build.mjs`). There is no inline template for the manifest, BrightScript,
 * XML, or channel icons anywhere in the TS source — everything is read from
 * disk so the Roku-side asset layout is self-documenting and editable with
 * standard tooling.
 *
 * Mirrored 1:1 into the output zip:
 *   manifest                       <- roku-components/fiddle/manifest
 *   source/main.brs                <- roku-components/fiddle/source/main.brs
 *   components/FiddleScene.xml     <- roku-components/fiddle/components/FiddleScene.xml
 *   components/FiddleScene.brs     <- roku-components/fiddle/components/FiddleScene.brs
 *                                     (with `{{RUN_ID}}` substituted per-build)
 *   images/channel_icon_{hd,fhd,wide}.png
 *                                  <- roku-components/fiddle/images/*.png
 *
 * Additionally injected at build time:
 *   components/UserCode.brs        <- the user's BrightScript source VERBATIM
 *                                     (displayed on TV AND compiled into the scene).
 *
 * Convention: user code defines `sub userFiddle()` — that's the Fiddle
 * entry point. After the scene is on-screen, `_rdsFiddle_setUpApp` calls
 * `userFiddle()`. User code must NOT define `sub init()` / `function init()`
 * — that identifier is reserved by the Fiddle scene. The host Fiddle window
 * surfaces this as a Monaco diagnostic so the user sees the problem before
 * sideload.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const archiver = require('archiver');

export interface BuildFiddleZipOpts {
  /** User BrightScript source — must define `sub userFiddle()` and must NOT define `init()`. */
  code: string;
  /** Short per-run id used in the BEGIN/END sentinel lines. */
  runId: string;
  /** Optional override for the temp directory (defaults to OS temp). */
  tmpDir?: string;
}

export interface BuildFiddleZipResult {
  zipPath: string;
}

function sanitizeRunId(runId: string): string {
  return String(runId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'run';
}

/**
 * Return `true` if the user's code defines `sub init()` or `function init()`
 * at the top level (anywhere in the source, case-insensitive). That name is
 * reserved by the Fiddle scene component; shipping a user `init()` alongside
 * ours would produce a duplicate-function compile error and the channel
 * would fail to load on the device.
 */
export function userCodeDefinesInit(source: string): boolean {
  if (typeof source !== 'string' || source.length === 0) return false;
  return /(^|\n)\s*(sub|function)\s+init\s*\(/i.test(source);
}

/**
 * Resolve the directory that holds the static Fiddle channel assets
 * (manifest, source/*, components/*, images/*).
 *
 * The source of truth lives at repo-root `roku-components/fiddle/`. When the
 * API package is built, those files are copied into
 * `dist/roku-components/fiddle/` so the published/packaged npm tarball is
 * self-contained.
 *
 * Resolution order:
 *   1. Repo source (`<repo>/roku-components/fiddle/`) — wins when present so
 *      local edits are picked up immediately in monorepo dev without having
 *      to re-run `build.mjs`. This path only exists inside the repo; when
 *      the API package is installed from npm it's absent and we fall through.
 *   2. Bundled dist copy (`<pkg>/dist/roku-components/fiddle/`) — used in
 *      production and by downstream consumers of the published package.
 *
 * At runtime this file lives at `dist/lib/bs-fiddle-template.js`, so
 * `__dirname` is `<pkg>/dist/lib`.
 */
function resolveFiddleAssetsDir(): string {
  // <pkg>/dist/lib → up 4 → repo root → roku-components/fiddle
  const repoCandidate = path.resolve(__dirname, '..', '..', '..', '..', 'roku-components', 'fiddle');
  if (fs.existsSync(repoCandidate)) return repoCandidate;
  // <pkg>/dist/lib → up 1 → <pkg>/dist → roku-components/fiddle
  const distCandidate = path.resolve(__dirname, '..', 'roku-components', 'fiddle');
  if (fs.existsSync(distCandidate)) return distCandidate;
  throw new Error(
    'roku-components/fiddle assets not found. Expected at ' +
      repoCandidate +
      ' (repo) or ' +
      distCandidate +
      ' (built).'
  );
}

function readFiddleAssetText(relPath: string): string {
  return fs.readFileSync(path.join(resolveFiddleAssetsDir(), relPath), 'utf8');
}

function readFiddleAssetBuffer(relPath: string): Buffer {
  return fs.readFileSync(path.join(resolveFiddleAssetsDir(), relPath));
}

/** The full inventory of files packaged into the Fiddle channel zip, in the
 * order `archiver` should write them. Paths are relative to
 * `roku-components/fiddle/` and mirror the in-zip layout. Text entries are
 * readable as UTF-8; binary entries (icons) are read as raw Buffers. */
const FIDDLE_ZIP_TEXT_ENTRIES: ReadonlyArray<string> = [
  'manifest',
  'source/main.brs',
  'components/FiddleScene.xml'
  // components/FiddleScene.brs is handled separately below because it
  // requires per-build `{{RUN_ID}}` substitution.
];

const FIDDLE_ZIP_BINARY_ENTRIES: ReadonlyArray<string> = [
  'images/channel_icon_hd.png',
  'images/channel_icon_fhd.png',
  'images/channel_icon_wide.png'
];

async function buildFiddleZip({
  code,
  runId,
  tmpDir
}: BuildFiddleZipOpts): Promise<BuildFiddleZipResult> {
  const safeId = sanitizeRunId(runId);
  const baseTmp = tmpDir || os.tmpdir();
  const zipPath = path.join(baseTmp, `rds-fiddle-${safeId}-${Date.now()}.zip`);

  // Load FiddleScene.brs and substitute the per-run placeholder baked into
  // the template. Everything else is an as-is file copy into the zip.
  const sceneBrs = readFiddleAssetText('components/FiddleScene.brs').replace(/{{RUN_ID}}/g, safeId);

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    output.on('error', (err: Error) => reject(err));
    archive.on('warning', (err: Error) => {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') reject(err);
    });
    archive.on('error', (err: Error) => reject(err));

    archive.pipe(output);

    for (const rel of FIDDLE_ZIP_TEXT_ENTRIES) {
      archive.append(readFiddleAssetText(rel), { name: rel });
    }
    archive.append(sceneBrs, { name: 'components/FiddleScene.brs' });
    archive.append(String(code || ''), { name: 'components/UserCode.brs' });
    for (const rel of FIDDLE_ZIP_BINARY_ENTRIES) {
      archive.append(readFiddleAssetBuffer(rel), { name: rel });
    }

    void archive.finalize();
  });

  return { zipPath };
}

module.exports = {
  buildFiddleZip,
  userCodeDefinesInit
};

export { buildFiddleZip };

/**
 * Build the "Roku Dev Studio Showcase" demo channel into a sideloadable
 * .zip on disk.
 *
 * Unlike BrightScript Fiddle (`bs-fiddle-template.ts`), this channel is
 * entirely static — no per-run templating, no user code injected. Every
 * file is a 1:1 copy of `roku-components/demo/` (copied into
 * `dist/roku-components/demo/` by `build.mjs`) into the output zip.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const archiver = require('archiver');

export interface BuildDemoZipOpts {
  /** Optional override for the temp directory (defaults to OS temp). */
  tmpDir?: string;
}

export interface BuildDemoZipResult {
  zipPath: string;
}

/**
 * Resolve the directory that holds the static demo channel assets
 * (manifest, source/*, components/*, images/*, data/*).
 *
 * Same repo-source-first, dist-fallback resolution as
 * `bs-fiddle-template.ts`'s `resolveFiddleAssetsDir()` — see that function's
 * doc comment for why. At runtime this file lives at
 * `dist/lib/demo-channel-template.js`, so `__dirname` is `<pkg>/dist/lib`.
 */
function resolveDemoAssetsDir(): string {
  // <pkg>/dist/lib → up 4 → repo root → roku-components/demo
  const repoCandidate = path.resolve(__dirname, '..', '..', '..', '..', 'roku-components', 'demo');
  if (fs.existsSync(repoCandidate)) return repoCandidate;
  // <pkg>/dist/lib → up 1 → <pkg>/dist → roku-components/demo
  const distCandidate = path.resolve(__dirname, '..', 'roku-components', 'demo');
  if (fs.existsSync(distCandidate)) return distCandidate;
  throw new Error(
    'roku-components/demo assets not found. Expected at ' +
      repoCandidate +
      ' (repo) or ' +
      distCandidate +
      ' (built).'
  );
}

function readDemoAssetText(relPath: string): string {
  return fs.readFileSync(path.join(resolveDemoAssetsDir(), relPath), 'utf8');
}

function readDemoAssetBuffer(relPath: string): Buffer {
  return fs.readFileSync(path.join(resolveDemoAssetsDir(), relPath));
}

/** The full inventory of files packaged into the demo channel zip. Paths are
 * relative to `roku-components/demo/` and mirror the in-zip layout. Deliberately
 * excludes `generate-images.mjs`, `README.md`, and `.DS_Store` — those are
 * repo-only, not part of the channel package. */
const DEMO_ZIP_TEXT_ENTRIES: ReadonlyArray<string> = [
  'manifest',
  'source/main.brs',
  'components/TrackerTask.xml',
  'components/HelperTask.xml',
  'components/HelperTask.brs',
  'components/MainScene.xml',
  'components/MainScene.brs',
  'data/catalog.json'
];

const DEMO_ZIP_BINARY_ENTRIES: ReadonlyArray<string> = [
  'images/channel_icon_hd.png',
  'images/channel_icon_fhd.png',
  'images/channel_icon_wide.png',
  'images/splash.png'
];

async function buildDemoZip({ tmpDir }: BuildDemoZipOpts = {}): Promise<BuildDemoZipResult> {
  const baseTmp = tmpDir || os.tmpdir();
  const zipPath = path.join(baseTmp, `rds-demo-${Date.now()}.zip`);

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

    for (const rel of DEMO_ZIP_TEXT_ENTRIES) {
      archive.append(readDemoAssetText(rel), { name: rel });
    }
    for (const rel of DEMO_ZIP_BINARY_ENTRIES) {
      archive.append(readDemoAssetBuffer(rel), { name: rel });
    }

    void archive.finalize();
  });

  return { zipPath };
}

module.exports = {
  buildDemoZip
};

export { buildDemoZip };

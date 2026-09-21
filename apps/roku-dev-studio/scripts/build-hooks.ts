#!/usr/bin/env node
/**
 * Electron-builder hooks for organizing distribution files
 * Runs automatically during the build process.
 * Build-time only: console output is for developers, not end users (WS-I002-00027).
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveUnderBase } from 'roku-dev-studio-platform/path-safe';

const distDir = resolveUnderBase(__dirname, '..', 'dist') || path.join(__dirname, '..', 'dist');

/** Skip electron-builder unpack trees and macOS bundles — they contain .exe files that must stay put. */
function shouldSkipArtifactScanDir(dirPath: string): boolean {
  const rel = path.relative(distDir, dirPath);
  if (rel.startsWith('..')) {
    return true;
  }
  if (rel === '') {
    return false;
  }
  return rel.split(path.sep).some((segment) => {
    if (!segment) {
      return false;
    }
    if (segment === 'unpacked' || segment.endsWith('-unpacked')) {
      return true;
    }
    if (segment.endsWith('.app')) {
      return true;
    }
    return false;
  });
}

interface DirectoryMove {
  source: string;
  dest: string;
  platform: 'mac' | 'linux' | 'windows';
  appName?: string;
  isWholeDir?: boolean;
  isRootApp?: boolean;
}

export type ArtifactPlatform = 'mac' | 'linux' | 'windows';
export interface ArtifactClass {
  platform: ArtifactPlatform;
  arch: 'x64' | 'arm64' | null;
}

/** Arch tokens electron-builder emits via `${arch}` (see builder-util `getArtifactArchName`). */
const ARCH_TOKEN = /(?:^|[-_ .])(x64|amd64|x86_64|arm64|aarch64)(?=$|[-_ .])/i;
const ARCH_ALIAS: Record<string, 'x64' | 'arm64'> = {
  x64: 'x64',
  amd64: 'x64',
  x86_64: 'x64',
  arm64: 'arm64',
  aarch64: 'arm64'
};

/**
 * Classify an electron-builder artifact by platform/arch from its *extension and arch token only* —
 * never from the full filename template. The template (`build.artifactName` plus the `nsis` /
 * `portable` overrides in package.json) is the single source of truth for names; this stays valid
 * whether it produces today's `Roku-Dev-Studio-<version>-<arch>.<ext>` or the pre-1.2.1 default
 * shapes (`Roku Dev Studio-1.2.0-arm64-mac.zip`, `roku-dev-studio_1.2.0_amd64.deb`,
 * `Roku Dev Studio Setup 1.2.0.exe`). `scripts/verify-artifact-names.ts` pins the two together.
 * A name without an arch token is x64: electron-builder's legacy templates omit the default arch.
 */
export function classifyArtifact(fileName: string): ArtifactClass | null {
  if (fileName === 'latest-mac.yml') return { platform: 'mac', arch: null };
  if (fileName === 'latest.yml') return { platform: 'windows', arch: null };
  if (fileName === 'latest-linux.yml') return { platform: 'linux', arch: 'x64' };
  if (fileName === 'latest-linux-arm64.yml') return { platform: 'linux', arch: 'arm64' };
  const ext = fileName
    .replace(/\.blockmap$/, '')
    .match(/\.(dmg|zip|exe|deb|AppImage)$/i)?.[1]
    ?.toLowerCase();
  if (!ext) return null;
  const token = fileName.match(ARCH_TOKEN)?.[1]?.toLowerCase();
  const arch = token ? ARCH_ALIAS[token] : 'x64';
  if (ext === 'dmg' || ext === 'zip') return { platform: 'mac', arch };
  if (ext === 'exe') return { platform: 'windows', arch };
  return { platform: 'linux', arch };
}

/**
 * `build:all` runs three independent electron-builder processes in parallel
 * (one per platform), so this hook fires once per process. Each invocation
 * MUST only touch files belonging to its own electron-builder's platforms;
 * otherwise the first process to finish would sweep `dist/` and relocate
 * artifacts that another still-running process is mid-write on (the original
 * symptom: mac's blockmap step ENOENT'd because win's hook moved the zip
 * out of flat `dist/` and into `dist/mac/<arch>/` first).
 *
 * `buildResult.platformToTargets` (`app-builder-lib`) tells us which
 * platforms the current run actually built — `Platform.name` is one of
 * `'mac' | 'linux' | 'windows'`, the same strings `classifyArtifact()` returns.
 */
function organizeDistFiles(allowedPlatforms: ReadonlySet<string>): void {
  if (allowedPlatforms.has('windows')) {
    const winDir = resolveUnderBase(distDir, 'win') || path.join(distDir, 'win');
    const windowsDir = resolveUnderBase(distDir, 'windows') || path.join(distDir, 'windows');
    if (fs.existsSync(winDir) && !fs.existsSync(windowsDir)) {
      try {
        fs.renameSync(winDir, windowsDir);
        console.log('  win/ → windows/');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  Error renaming win/ to windows/: ${msg}`);
      }
    }
  }

  const allDirectoryMoves: DirectoryMove[] = [
    { source: 'mac-arm64', dest: 'mac/arm64', platform: 'mac', appName: 'Roku Dev Studio.app' },
    { source: 'mac', dest: 'mac/x64', platform: 'mac', appName: 'Roku Dev Studio.app', isRootApp: true },
    { source: 'linux-arm64-unpacked', dest: 'linux/arm64-unpacked', platform: 'linux', isWholeDir: true },
    { source: 'linux-unpacked', dest: 'linux/x64-unpacked', platform: 'linux', isWholeDir: true },
    { source: 'win-unpacked', dest: 'windows/unpacked', platform: 'windows', isWholeDir: true },
  ];
  const directoryMoves = allDirectoryMoves.filter((m) => allowedPlatforms.has(m.platform));

  function organizeDirectories(): number {
    let movedCount = 0;

    for (const move of directoryMoves) {
      const sourceDir = resolveUnderBase(distDir, move.source) || path.join(distDir, move.source);
      const destDir = resolveUnderBase(distDir, move.dest) || path.join(distDir, move.dest);

      if (move.isWholeDir) {
        if (fs.existsSync(sourceDir) && fs.statSync(sourceDir).isDirectory()) {
          const destParent = path.dirname(destDir);
          if (!fs.existsSync(destParent)) {
            fs.mkdirSync(destParent, { recursive: true });
          }

          if (fs.existsSync(destDir)) {
            continue;
          }

          try {
            fs.renameSync(sourceDir, destDir);
            movedCount++;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`  Error moving ${move.source}: ${msg}`);
          }
        }
        continue;
      }

      const appPath = move.appName
        ? resolveUnderBase(sourceDir, move.appName) || path.join(sourceDir, move.appName)
        : sourceDir;
      const destAppPath = move.appName
        ? resolveUnderBase(destDir, move.appName) || path.join(destDir, move.appName)
        : destDir;

      if (move.isRootApp) {
        if (fs.existsSync(appPath) && fs.statSync(appPath).isDirectory()) {
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }

          if (fs.existsSync(destAppPath)) {
            continue;
          }

          try {
            fs.renameSync(appPath, destAppPath);
            movedCount++;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`  Error moving ${move.appName}: ${msg}`);
          }
        }
      } else {
        if (fs.existsSync(sourceDir) && fs.existsSync(appPath)) {
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }

          if (!fs.existsSync(destAppPath)) {
            try {
              fs.renameSync(appPath, destAppPath);
              movedCount++;
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`  Error moving ${move.appName}: ${msg}`);
            }
          }

          try {
            const remaining = fs.readdirSync(sourceDir).filter((f) => !f.startsWith('.'));
            if (remaining.length === 0) {
              fs.rmSync(sourceDir, { recursive: true });
            }
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }

    return movedCount;
  }

  const dirsMoved = organizeDirectories();

  function reorganizeMisplacedFiles(): number {
    let movedCount = 0;
    const platformDirs = ['mac', 'linux', 'windows', 'win'].filter((p) => {
      const canonical = p === 'win' ? 'windows' : p;
      return allowedPlatforms.has(canonical);
    });

    function scanDirectory(currentDir: string, relativePath = ''): void {
      if (!fs.existsSync(currentDir)) {
        return;
      }
      if (shouldSkipArtifactScanDir(currentDir)) {
        return;
      }

      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = resolveUnderBase(currentDir, entry.name) || path.join(currentDir, entry.name);
        const relativeFilePath = path.join(relativePath, entry.name).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          scanDirectory(fullPath, relativeFilePath);
        } else if (entry.isFile()) {
          const fileName = entry.name;

          const hit = classifyArtifact(fileName);
          if (hit && allowedPlatforms.has(hit.platform)) {
            const { platform, arch } = hit;
            const correctDestDir = arch
              ? resolveUnderBase(distDir, platform, arch) || path.join(distDir, platform, arch)
              : resolveUnderBase(distDir, platform) || path.join(distDir, platform);
            const correctDestPath =
              resolveUnderBase(correctDestDir, fileName) || path.join(correctDestDir, fileName);
            if (fullPath !== correctDestPath) {
              if (!fs.existsSync(correctDestDir)) {
                fs.mkdirSync(correctDestDir, { recursive: true });
              }
              if (fs.existsSync(correctDestPath)) {
                try {
                  fs.unlinkSync(fullPath);
                  movedCount++;
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  console.error(`  Error deleting misplaced file ${relativeFilePath}: ${msg}`);
                }
              } else {
                try {
                  fs.renameSync(fullPath, correctDestPath);
                  movedCount++;
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  console.error(`  Error moving ${relativeFilePath}: ${msg}`);
                }
              }
            }
          }
        }
      }
    }

    scanDirectory(distDir, '');

    platformDirs.forEach((platform) => {
      const platformDir = resolveUnderBase(distDir, platform) || path.join(distDir, platform);
      if (fs.existsSync(platformDir)) {
        scanDirectory(platformDir, platform);
      }
    });

    return movedCount;
  }

  const filesReorganized = reorganizeMisplacedFiles();

  const filesToDelete = ['builder-debug.yml', 'builder-effective-config.yaml'];
  filesToDelete.forEach((file) => {
    const filePath = resolveUnderBase(distDir, file) || path.join(distDir, file);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore errors
      }
    }
  });

  const totalMoved = dirsMoved + filesReorganized;
  if (totalMoved > 0) {
    console.log(`  Organized ${totalMoved} item(s)`);
  }
}

interface BuildResultLike {
  platformToTargets?: Map<{ name?: string }, unknown>;
}

/**
 * Extract platform names (`'mac' | 'linux' | 'windows'`) from electron-builder's
 * `BuildResult.platformToTargets` map. Falls back to all platforms if the shape
 * is unexpected, which preserves the pre-platform-aware behavior for safety —
 * worth a warning so a future shape change shows up rather than silently
 * regressing.
 */
function extractAllowedPlatforms(buildResult: unknown): Set<string> {
  const all = new Set(['mac', 'linux', 'windows']);
  const br = buildResult as BuildResultLike | null | undefined;
  const map = br?.platformToTargets;
  if (!(map instanceof Map) || map.size === 0) {
    console.warn('  ⚠ build-hooks: platformToTargets missing — organizing all platforms (legacy fallback)');
    return all;
  }
  const result = new Set<string>();
  Array.from(map.keys()).forEach((platform) => {
    const name = platform?.name;
    if (typeof name === 'string' && all.has(name)) {
      result.add(name);
    }
  });
  return result.size > 0 ? result : all;
}

export default async function afterAllArtifactBuild(buildResult: unknown): Promise<string[]> {
  const allowedPlatforms = extractAllowedPlatforms(buildResult);
  const scope = Array.from(allowedPlatforms).sort().join(', ');
  console.log(`\nOrganizing distribution files (scope: ${scope})...`);
  organizeDistFiles(allowedPlatforms);
  console.log('✓ File organization complete\n');
  return [];
}

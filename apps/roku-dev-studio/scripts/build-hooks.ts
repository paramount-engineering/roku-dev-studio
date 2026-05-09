#!/usr/bin/env node
/**
 * Electron-builder hooks for organizing distribution files
 * Runs automatically during the build process.
 * Build-time only: console output is for developers, not end users (WS-I002-00027).
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveUnderBase } from '../../../lib/path-safe';

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
  appName?: string;
  isWholeDir?: boolean;
  isRootApp?: boolean;
}

interface FilePatternConfig {
  pattern: RegExp;
  platform: string;
  arch: string | null;
  excludeIf?: (file: string) => boolean;
}

function organizeDistFiles(): void {
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

  const directoryMoves: DirectoryMove[] = [
    { source: 'mac-arm64', dest: 'mac/arm64', appName: 'Roku Dev Studio.app' },
    { source: 'mac', dest: 'mac/x64', appName: 'Roku Dev Studio.app', isRootApp: true },
    { source: 'linux-arm64-unpacked', dest: 'linux/arm64-unpacked', isWholeDir: true },
    { source: 'linux-unpacked', dest: 'linux/x64-unpacked', isWholeDir: true },
    { source: 'win-unpacked', dest: 'windows/unpacked', isWholeDir: true },
  ];

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

  const filePatterns: FilePatternConfig[] = [
    { pattern: /-arm64-mac\.zip\.blockmap$/, platform: 'mac', arch: 'arm64' },
    { pattern: /-arm64-mac\.zip$/, platform: 'mac', arch: 'arm64' },
    { pattern: /-arm64\.dmg$/, platform: 'mac', arch: 'arm64' },
    { pattern: /\.dmg$/, platform: 'mac', arch: 'x64', excludeIf: (file) => file.includes('-arm64') },
    { pattern: /-mac\.zip$/, platform: 'mac', arch: 'x64', excludeIf: (file) => file.includes('-arm64') },
    { pattern: /-mac\.zip\.blockmap$/, platform: 'mac', arch: 'x64', excludeIf: (file) => file.includes('-arm64') },
    { pattern: /^latest-mac\.yml$/, platform: 'mac', arch: null },

    { pattern: /-arm64\.AppImage$/, platform: 'linux', arch: 'arm64' },
    { pattern: /_arm64\.deb$/, platform: 'linux', arch: 'arm64' },
    { pattern: /^latest-linux-arm64\.yml$/, platform: 'linux', arch: 'arm64' },
    { pattern: /-x86_64\.AppImage$/, platform: 'linux', arch: 'x64' },
    { pattern: /_amd64\.deb$/, platform: 'linux', arch: 'x64' },
    { pattern: /^latest-linux\.yml$/, platform: 'linux', arch: 'x64' },

    { pattern: /\.exe\.blockmap$/, platform: 'windows', arch: 'x64' },
    { pattern: /\.exe$/, platform: 'windows', arch: 'x64' },
    { pattern: /^latest\.yml$/, platform: 'windows', arch: null },
  ];

  function reorganizeMisplacedFiles(): number {
    let movedCount = 0;
    const platformDirs = ['mac', 'linux', 'windows', 'win'];

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

          for (const patternConfig of filePatterns) {
            const { pattern, platform, arch, excludeIf } = patternConfig;

            if (pattern.test(fileName)) {
              if (excludeIf && excludeIf(fileName)) {
                continue;
              }

              const correctDestDir = arch
                ? resolveUnderBase(distDir, platform, arch) || path.join(distDir, platform, arch)
                : resolveUnderBase(distDir, platform) || path.join(distDir, platform);
              const correctDestPath =
                resolveUnderBase(correctDestDir, fileName) || path.join(correctDestDir, fileName);
              if (fullPath === correctDestPath) {
                break;
              }

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
              break;
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

/** electron-builder hook — parameter unused */
export default async function afterAllArtifactBuild(_buildResult: unknown): Promise<string[]> {
  console.log('\nOrganizing distribution files...');
  organizeDistFiles();
  console.log('✓ File organization complete\n');
  return [];
}

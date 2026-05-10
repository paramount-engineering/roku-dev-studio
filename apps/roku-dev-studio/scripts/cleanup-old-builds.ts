#!/usr/bin/env node
/**
 * Pre-build script to clean up old build artifacts for the current version
 * Deletes existing builds in platform folders before building new ones.
 * Build-time only: console output is for developers, not end users (WS-I002-00027).
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveUnderBase } from '../../../lib/path-safe';

const distDir = resolveUnderBase(__dirname, '..', 'dist') || path.join(__dirname, '..', 'dist');

const packageJsonPath =
  resolveUnderBase(__dirname, '..', 'package.json') || path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version: string };
const version = packageJson.version;

console.log(`Cleaning up old build artifacts for version ${version}...\n`);

if (!fs.existsSync(distDir)) {
  console.log('✓ No dist directory found - nothing to clean up\n');
  process.exit(0);
}

function cleanupVersionFiles(dir: string, versionStr: string): { count: number; size: number } {
  let deletedCount = 0;
  let deletedSize = 0;

  if (!fs.existsSync(dir)) {
    return { count: 0, size: 0 };
  }

  function processDirectory(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolveUnderBase(currentDir, entry.name) || path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        processDirectory(fullPath);
      } else if (entry.isFile()) {
        if (entry.name.includes(versionStr)) {
          try {
            const stats = fs.statSync(fullPath);
            fs.unlinkSync(fullPath);
            deletedCount++;
            deletedSize += stats.size;
            console.log(`  Deleted: ${path.relative(distDir, fullPath)}`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`  Error deleting ${fullPath}: ${msg}`);
          }
        }
      }
    }
  }

  processDirectory(dir);

  return { count: deletedCount, size: deletedSize };
}

function cleanupUnpackedDirs(): number {
  const unpackedDirs = [
    'mac/arm64/Roku Dev Studio.app',
    'mac/x64/Roku Dev Studio.app',
    'win/arm64/Roku Dev Studio',
    'win/x64/Roku Dev Studio',
    'windows/arm64/Roku Dev Studio',
    'windows/x64/Roku Dev Studio',
    'linux/arm64-unpacked',
    'linux/x64-unpacked',
    'windows/unpacked',
    'win/unpacked',
  ];

  let deletedCount = 0;

  for (const dir of unpackedDirs) {
    const fullPath = resolveUnderBase(distDir, ...dir.split('/')) || path.join(distDir, dir);
    if (fs.existsSync(fullPath)) {
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`  Deleted directory: ${dir}/`);
        deletedCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  Error deleting ${dir}: ${msg}`);
      }
    }
  }

  return deletedCount;
}

const result = cleanupVersionFiles(distDir, version);
const dirsDeleted = cleanupUnpackedDirs();

let rootFiles: string[] = [];
if (fs.existsSync(distDir)) {
  try {
    rootFiles = fs
      .readdirSync(distDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.includes(version))
      .map((entry) => resolveUnderBase(distDir, entry.name) || path.join(distDir, entry.name));
  } catch {
    // Ignore errors reading directory
  }
}

rootFiles.forEach((filePath) => {
  try {
    const stats = fs.statSync(filePath);
    fs.unlinkSync(filePath);
    result.count++;
    result.size += stats.size;
    console.log(`  Deleted: ${path.basename(filePath)}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  Error deleting ${filePath}: ${msg}`);
  }
});

const platformDirs = ['mac', 'linux', 'windows', 'win'];
platformDirs.forEach((platform) => {
  const platformDir = resolveUnderBase(distDir, platform) || path.join(distDir, platform);
  if (fs.existsSync(platformDir)) {
    const archDirs = fs
      .readdirSync(platformDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolveUnderBase(platformDir, entry.name) || path.join(platformDir, entry.name));

    archDirs.forEach((archDir) => {
      try {
        const contents = fs.readdirSync(archDir);
        if (contents.length === 0) {
          fs.rmdirSync(archDir);
          console.log(`  Removed empty: ${path.relative(distDir, archDir)}/`);
        }
      } catch {
        // Ignore errors
      }
    });

    try {
      const platformContents = fs.readdirSync(platformDir);
      if (platformContents.length === 0) {
        fs.rmdirSync(platformDir);
        console.log(`  Removed empty: ${platform}/`);
      }
    } catch {
      // Ignore errors
    }
  }
});

const totalDeleted = result.count + dirsDeleted;
const sizeMB = (result.size / (1024 * 1024)).toFixed(2);

if (totalDeleted > 0) {
  console.log(`\n✓ Cleaned up ${totalDeleted} item(s) (${sizeMB} MB)`);
} else {
  console.log('\n✓ No old build artifacts found');
}

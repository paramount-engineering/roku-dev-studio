/**
 * Safe path resolution to prevent path traversal.
 * Use when building paths from user or external input.
 *
 * Caveats callers should know:
 *   • Containment is checked on the normalized *string* form of the path, not on the
 *     realpath. If any directory entry along the path is a symlink pointing outside the
 *     allowed base, `fs.open`/`fs.readFile` will still follow it. If you need stronger
 *     guarantees (e.g. refusing symlinked escapes), resolve with `fs.realpathSync` and
 *     re-check containment at the call site.
 *   • For `resolveUserPathUnderOneOf`, relative inputs resolve against `process.cwd()`,
 *     not against a base directory. Prefer passing absolute paths when possible so
 *     behavior does not depend on where the Node process was started.
 */

import * as path from 'node:path';

/**
 * Resolve path under a base directory. Returns the resolved path only if it
 * lies under baseDir (no escaping via ..). Returns null if outside base.
 */
export function resolveUnderBase(baseDir: string, ...segments: string[]): string | null {
  if (!baseDir || typeof baseDir !== 'string') return null;
  try {
    const baseNorm = path.normalize(path.resolve(baseDir));
    const resolved = path.resolve(baseDir, ...segments);
    const resNorm = path.normalize(resolved);
    if (resNorm !== baseNorm && !resNorm.startsWith(baseNorm + path.sep)) {
      return null;
    }
    return resolved;
  } catch {
    return null;
  }
}

/**
 * Resolve path under one of several allowed base directories.
 */
export function resolveUnderOneOf(allowedBases: string[], ...segments: string[]): string | null {
  if (!Array.isArray(allowedBases)) return null;
  for (const base of allowedBases) {
    const p = resolveUnderBase(base, ...segments);
    if (p != null) return p;
  }
  return null;
}

/**
 * Check if a resolved path lies under one of the allowed base directories.
 */
export function isPathUnderOneOf(resolvedPath: string, allowedBases: string[]): boolean {
  if (!resolvedPath || typeof resolvedPath !== 'string' || !Array.isArray(allowedBases)) return false;
  try {
    const resNorm = path.normalize(path.resolve(resolvedPath));
    for (const base of allowedBases) {
      if (!base) continue;
      const baseNorm = path.normalize(path.resolve(base));
      if (resNorm === baseNorm || resNorm.startsWith(baseNorm + path.sep)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve a user-provided path and return it only if it lies under one of the allowed bases.
 *
 * Note: relative `filePath` values resolve against `process.cwd()`; containment is
 * still enforced against the final normalized absolute path, but callers should pass
 * absolute paths where the expected base is known, for predictable behavior.
 */
export function resolveUserPathUnderOneOf(allowedBases: string[], filePath: string): string | null {
  if (!filePath || typeof filePath !== 'string' || !Array.isArray(allowedBases)) return null;
  try {
    const resolved = path.resolve(filePath);
    return isPathUnderOneOf(resolved, allowedBases) ? resolved : null;
  } catch {
    return null;
  }
}

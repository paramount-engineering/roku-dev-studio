/**
 * Node-only host-platform helpers (filesystem / environment). Kept separate from the renderer-safe
 * identity entry so the renderer bundle never pulls in Node built-ins.
 */

import * as os from 'node:os';

/**
 * The user's home/profile directories, de-duplicated. This is the trust boundary for resolving
 * user-supplied file paths (sideloaded packages, action-script imports, etc.) — a resolved path is
 * only accepted if it lies under one of these. On Windows, `USERPROFILE` is included alongside the
 * Node `homedir()` (they can differ in some environments).
 */
export function userProfileDirectories(): string[] {
  return Array.from(
    new Set(
      [os.homedir(), process.platform === 'win32' ? process.env.USERPROFILE || '' : os.homedir()].filter(
        Boolean
      )
    )
  );
}

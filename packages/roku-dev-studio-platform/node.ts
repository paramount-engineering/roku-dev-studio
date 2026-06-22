/**
 * Node-only host-platform helpers (filesystem / environment). Kept separate from the renderer-safe
 * identity entry so the renderer bundle never pulls in Node built-ins.
 */

import * as os from 'node:os';
import { createLogger, type Logger } from './index';

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

// ============================================================================
// Node logging — verbose gating
// ============================================================================

/** Interpret an env var as a tri-state flag: `true`/`false` when set, `undefined` when unset/empty. */
function envFlag(name: string): boolean | undefined {
  const v = process.env[name];
  if (v == null || v === '') return undefined;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Whether verbose/debug logging is enabled for a Node runtime. The unified `RDS_DEBUG` flag turns
 * verbose output on everywhere; a per-area var (e.g. `RDS_NI_DEBUG`) overrides it for that area in
 * either direction — set it to `1` to enable just that area, or to `0` to silence that area while
 * `RDS_DEBUG` is on. Unset per-area vars fall through to `RDS_DEBUG`.
 */
export function debugEnvEnabled(areaVar?: string): boolean {
  const area = areaVar ? envFlag(areaVar) : undefined;
  if (area !== undefined) return area;
  return envFlag('RDS_DEBUG') ?? false;
}

/**
 * Create a logger for a Node-side area (main process, a package, the remote server). Verbose
 * (`debug`) output is gated by {@link debugEnvEnabled} against the unified `RDS_DEBUG` flag and the
 * optional per-area override var. Writes to the global `console`, so the main process's debug-log
 * file wrapper still captures every line.
 */
export function createNodeLogger(prefix: string, areaDebugVar?: string): Logger {
  return createLogger({ prefix, debug: () => debugEnvEnabled(areaDebugVar) });
}

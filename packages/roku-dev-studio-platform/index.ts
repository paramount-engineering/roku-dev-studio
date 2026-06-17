/**
 * Shared host-platform identity helpers — the one place that answers "which OS are we on?" and
 * "what do we call it?". Used across the desktop app (main process), the renderer, and other
 * packages (e.g. the network inspector) so platform checks aren't re-implemented everywhere.
 *
 * This entry is intentionally **renderer-safe**: it imports no Node built-ins. The functions read
 * `process.platform` only when no explicit platform is passed, so renderer code that already knows
 * its platform (e.g. via an IPC-delivered value) can call them with an argument and never touch
 * `process`. Node-only helpers (filesystem paths) live in the `./node` entry.
 */

/** Any Node platform string. */
export type HostPlatform = NodeJS.Platform;

/** The three desktop platforms Roku Dev Studio ships on. */
export type DesktopPlatform = 'darwin' | 'win32' | 'linux';

/** The current host platform. Node/Electron-main only at runtime (reads `process.platform`). */
export function hostPlatform(): HostPlatform {
  return process.platform;
}

export function isMacOS(platform: HostPlatform = hostPlatform()): boolean {
  return platform === 'darwin';
}

export function isWindows(platform: HostPlatform = hostPlatform()): boolean {
  return platform === 'win32';
}

export function isLinux(platform: HostPlatform = hostPlatform()): boolean {
  return platform === 'linux';
}

/**
 * Narrow any platform to the three desktop targets RDS supports; anything else falls back to
 * `'linux'` (the closest POSIX behavior), matching the app's existing default handling.
 */
export function desktopPlatform(platform: HostPlatform = hostPlatform()): DesktopPlatform {
  return platform === 'darwin' || platform === 'win32' ? platform : 'linux';
}

/** Human-friendly OS name (e.g. for About / Settings copy). Unknown platforms pass through. */
export function platformLabel(platform: HostPlatform = hostPlatform()): string {
  if (platform === 'darwin') return 'macOS';
  if (platform === 'win32') return 'Windows';
  if (platform === 'linux') return 'Linux';
  return platform;
}

/** The primary command/modifier key label for keyboard shortcuts (⌘ on macOS, Ctrl elsewhere). */
export function primaryModifierKey(platform: HostPlatform = hostPlatform()): 'Cmd' | 'Ctrl' {
  return platform === 'darwin' ? 'Cmd' : 'Ctrl';
}

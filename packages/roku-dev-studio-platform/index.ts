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

/**
 * Narrow an unknown thrown value to a message string — for `catch (e: unknown)` blocks and logging.
 * The one canonical implementation; `errMessage` is a back-compat alias for renderer call sites that
 * used that name before this was consolidated here.
 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Alias of {@link errorMessage}. */
export const errMessage = errorMessage;

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

// ============================================================================
// Shared structured logger
// ============================================================================
//
// The one place every part of Roku Dev Studio gets a logger from — main process,
// renderer, and standalone packages. This core is intentionally **runtime-neutral**:
// it touches only `console` and `new Date()`, no Node or DOM globals, so the same
// implementation works in the Electron renderer, the main process, and headless
// packages (network inspector, remote server). Callers supply the parts that differ
// per runtime — the verbose gate (an env var in Node, the Developer-Mode toggle in the
// renderer) is passed in via `debug`, and the output target via `sink`.
//
// `new Date()` is fine here — this is runtime app code, not a workflow script.

/** The console-like sink a logger writes to. Defaults to the global `console`. */
export interface LogSink {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * A leveled logger with a fixed prefix. `log`/`warn`/`error` are milestone events that
 * always emit so a user can reproduce an issue and share the output; `debug` is verbose
 * tracing that only emits when the logger's verbose gate is on.
 */
export interface Logger {
  /** Always-emitted milestone log. */
  log(...args: unknown[]): void;
  /** Always-emitted warning. */
  warn(...args: unknown[]): void;
  /** Always-emitted error. */
  error(...args: unknown[]): void;
  /** Verbose trace — only emitted when the verbose gate is enabled. */
  debug(...args: unknown[]): void;
  /** Whether verbose (`debug`) output is currently enabled. */
  isDebugEnabled(): boolean;
  /** A nested logger whose prefix is appended to this one's (e.g. `[Network Inspector] [proxy]`). */
  child(childPrefix: string): Logger;
}

export interface LoggerOptions {
  /** Prefix tag shown on every line, e.g. `[Network Inspector]`. */
  prefix: string;
  /**
   * Verbose gate for `debug()`. Pass a boolean for a fixed decision, or a getter for a
   * live one (an env flag that can change, a Developer-Mode toggle, etc.). The getter is
   * called on every `debug()` so toggles take effect immediately. Defaults to `false`.
   */
  debug?: boolean | (() => boolean);
  /** Prefix every line with an ISO timestamp so lines are easy to correlate. Defaults to `true`. */
  timestamp?: boolean;
  /** Where lines are written. Defaults to the global `console`. */
  sink?: LogSink;
}

function asDebugGetter(debug: LoggerOptions['debug']): () => boolean {
  if (typeof debug === 'function') return debug;
  const fixed = !!debug;
  return () => fixed;
}

/**
 * Create a leveled, prefixed logger. See {@link LoggerOptions}. The returned logger holds no
 * mutable state of its own — re-evaluating the `debug` getter on each call is what lets a
 * runtime toggle (env var, Developer Mode) flip verbosity live.
 */
export function createLogger(options: LoggerOptions): Logger {
  const { prefix } = options;
  const timestamp = options.timestamp !== false;
  const sink: LogSink = options.sink ?? console;
  const isDebug = asDebugGetter(options.debug);

  // Lead each line with the prefix and (optionally) an ISO timestamp, then the caller's args.
  const head = (): unknown[] => (timestamp ? [prefix, new Date().toISOString()] : [prefix]);

  return {
    log: (...args) => sink.log(...head(), ...args),
    warn: (...args) => sink.warn(...head(), ...args),
    error: (...args) => sink.error(...head(), ...args),
    debug: (...args) => {
      if (isDebug()) sink.log(...head(), '[debug]', ...args);
    },
    isDebugEnabled: () => isDebug(),
    child: (childPrefix) =>
      createLogger({ prefix: `${prefix} ${childPrefix}`, debug: isDebug, timestamp, sink }),
  };
}

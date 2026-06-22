/**
 * Diagnostic builds — always-on structured logging for field debugging.
 *
 * Activated when the packaged `package.json` has `diagnosticBuild: true` (set by
 * `npm run build:*:diagnostic`) or when `RDS_DIAGNOSTIC_BUILD=1` at dev time.
 *
 * IMPORTANT: `diagnosticBuild` is read from disk at runtime (not bundled) so a
 * cross-build on another OS still sees the flag electron-builder writes into the
 * artifact. Avoid `process.platform` checks that esbuild would constant-fold at
 * bundle time on the build host.
 *
 * Log artifacts (under Electron userData, e.g. `%APPDATA%\\Roku Dev Studio Diagnostic\\`
 * on Windows, `~/Library/Application Support/Roku Dev Studio Diagnostic/` on macOS):
 *   • roku-dev-studio-debug.log      — main-process console + renderer console
 *   • diagnostic-snapshots.jsonl     — periodic NDJSON telemetry (memory, NI, etc.)
 *   • mcp-audit.log                  — MCP bridge tool calls (when MCP is used)
 *   • settings/app-settings.json     — app configuration snapshot
 */

import type { App, BrowserWindow, IpcMain, WebContents } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IPC } from '../shared/ipc/channels';

const SNAPSHOT_INTERVAL_MS = 30_000;

let snapshotTimer: ReturnType<typeof setInterval> | null = null;
let snapshotLogPath: string | null = null;
let appendMainLogLine: ((line: string) => void) | null = null;
let ipcRegistered = false;
let diagnosticFlagCache: boolean | null = null;

/**
 * True for diagnostic artifacts (`diagnosticBuild` in packaged package.json)
 * or local dev with `RDS_DIAGNOSTIC_BUILD=1`.
 */
export function isDiagnosticBuild(): boolean {
  if (diagnosticFlagCache !== null) return diagnosticFlagCache;
  if (process.env.RDS_DIAGNOSTIC_BUILD === '1') {
    diagnosticFlagCache = true;
    return true;
  }
  try {
    const pkgPath = path.join(__dirname, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { diagnosticBuild?: boolean };
    diagnosticFlagCache = pkg.diagnosticBuild === true;
    return diagnosticFlagCache;
  } catch {
    diagnosticFlagCache = false;
    return false;
  }
}

export type DiagnosticLogPaths = {
  userDataDir: string;
  mainLogFile: string;
  chromiumLogFile: string;
  snapshotLogFile: string;
  mcpAuditLogFile: string;
};

export function resolveDiagnosticLogPaths(userDataDir: string): DiagnosticLogPaths {
  return {
    userDataDir,
    mainLogFile: path.join(userDataDir, 'roku-dev-studio-debug.log'),
    chromiumLogFile: path.join(
      os.tmpdir(),
      'roku-dev-studio-diagnostic',
      'roku-dev-studio-chromium.log'
    ),
    snapshotLogFile: path.join(userDataDir, 'diagnostic-snapshots.jsonl'),
    mcpAuditLogFile: path.join(userDataDir, 'mcp-audit.log')
  };
}

/** Call before `app.whenReady()` — routes Chromium logs to a short temp path (no spaces). */
export function applyDiagnosticCommandLineSwitches(app: App, userDataDir: string): void {
  if (!isDiagnosticBuild()) return;
  const paths = resolveDiagnosticLogPaths(userDataDir);
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.mkdirSync(path.dirname(paths.chromiumLogFile), { recursive: true });
  } catch {
    /* ignore */
  }
  app.commandLine.appendSwitch('enable-logging');
  app.commandLine.appendSwitch('log-file', paths.chromiumLogFile);
  app.commandLine.appendSwitch('v', '1');
}

function appendSnapshot(record: Record<string, unknown>): void {
  if (!snapshotLogPath) return;
  try {
    fs.appendFileSync(snapshotLogPath, `${JSON.stringify(record)}\n`, 'utf-8');
  } catch (e) {
    console.warn('[Diagnostic] snapshot append failed:', e);
  }
}

function formatConsoleLevel(level: unknown): string {
  if (typeof level === 'string') return level.toUpperCase();
  if (typeof level === 'number') {
    switch (level) {
      case 0:
        return 'VERBOSE';
      case 1:
        return 'INFO';
      case 2:
        return 'WARN';
      case 3:
        return 'ERROR';
      default:
        return `L${level}`;
    }
  }
  return 'LOG';
}

/** Pipe renderer DevTools console into the main debug log file. */
export function registerDiagnosticWebContents(wc: WebContents): void {
  if (!isDiagnosticBuild()) return;
  wc.on('console-message', (...args: unknown[]) => {
    let level: unknown;
    let message: unknown;
    let line: unknown;
    let sourceId: unknown;
    if (args.length === 1 && args[0] && typeof args[0] === 'object' && 'message' in (args[0] as object)) {
      const d = args[0] as {
        level?: unknown;
        message?: unknown;
        lineNumber?: unknown;
        sourceId?: unknown;
      };
      level = d.level;
      message = d.message;
      line = d.lineNumber;
      sourceId = d.sourceId;
    } else if (args.length >= 3) {
      level = args[1];
      message = args[2];
      line = args[3];
      sourceId = args[4];
    } else {
      return;
    }
    const src = sourceId ? path.basename(String(sourceId)) : 'renderer';
    const lineInfo = typeof line === 'number' && line > 0 ? `:${line}` : '';
    appendMainLogLine?.(
      `[RENDERER] [${formatConsoleLevel(level)}] [${src}${lineInfo}] ${String(message ?? '')}`
    );
  });
  wc.on('render-process-gone', (_event, details) => {
    appendMainLogLine?.(
      `[RENDERER] render-process-gone reason=${details.reason} exitCode=${details.exitCode}`
    );
  });
  wc.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    appendMainLogLine?.(
      `[RENDERER] did-fail-load code=${errorCode} url=${validatedURL} ${errorDescription}`
    );
  });
}

export type DiagnosticTelemetryDeps = {
  userDataDir: string;
  /** Write a single line into roku-dev-studio-debug.log (without going through console). */
  appendMainLog: (line: string) => void;
  getMainWindow: () => BrowserWindow | undefined;
  getExtraSnapshot?: () => Record<string, unknown>;
};

/** Periodic JSONL snapshots + startup banner. Call once after file logging is enabled. */
export function startDiagnosticTelemetry(deps: DiagnosticTelemetryDeps): void {
  if (!isDiagnosticBuild()) return;
  appendMainLogLine = deps.appendMainLog;
  const paths = resolveDiagnosticLogPaths(deps.userDataDir);
  snapshotLogPath = paths.snapshotLogFile;

  const banner = {
    ts: new Date().toISOString(),
    kind: 'diagnostic-start',
    product: 'Roku Dev Studio Diagnostic',
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    node: process.versions.node,
    os: `${os.type()} ${os.release()}`,
    cpus: os.cpus().length,
    totalMemMb: Math.round(os.totalmem() / (1024 * 1024)),
    logPaths: paths
  };
  appendSnapshot(banner);
  appendMainLogLine(
    `[Diagnostic] Logging active. Folder: ${paths.userDataDir} (File → Open Diagnostic Logs Folder)`
  );

  if (snapshotTimer) clearInterval(snapshotTimer);
  snapshotTimer = setInterval(() => {
    const mem = process.memoryUsage();
    const win = deps.getMainWindow();
    const snapshot: Record<string, unknown> = {
      ts: new Date().toISOString(),
      kind: 'snapshot',
      uptimeSec: Math.round(process.uptime()),
      memory: {
        rssMb: Math.round(mem.rss / (1024 * 1024)),
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
        externalMb: Math.round(mem.external / (1024 * 1024))
      },
      mainWindow: win
        ? {
            destroyed: win.isDestroyed(),
            visible: !win.isDestroyed() && win.isVisible(),
            minimized: !win.isDestroyed() && win.isMinimized(),
            focused: !win.isDestroyed() && win.isFocused()
          }
        : null
    };
    if (deps.getExtraSnapshot) {
      try {
        Object.assign(snapshot, deps.getExtraSnapshot());
      } catch (e) {
        snapshot.extraSnapshotError = e instanceof Error ? e.message : String(e);
      }
    }
    appendSnapshot(snapshot);
  }, SNAPSHOT_INTERVAL_MS);
}

export function registerDiagnosticIpc(
  ipcMain: IpcMain,
  shell: { openPath: (p: string) => Promise<string> },
  getUserDataPath: () => string
): void {
  if (!isDiagnosticBuild() || ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle(IPC.IsDiagnosticBuild, async () => ({ enabled: true }));

  ipcMain.handle(IPC.OpenDiagnosticLogFolder, async () => {
    try {
      const userData = getUserDataPath();
      const paths = resolveDiagnosticLogPaths(userData);
      await shell.openPath(paths.userDataDir);
      return { success: true, path: paths.userDataDir, paths };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
}

/**
 * Spawns Roku's `sca-cmd` launcher against a chosen channel file/dir, streams its stdout/stderr
 * back to the requesting window, and resolves the run once the process exits — locating and
 * parsing the JSON report it produces (falling back to raw output if the report is missing or
 * unparseable, since Roku doesn't document its schema).
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFile, spawn, type ChildProcess } from 'child_process';
import * as crypto from 'crypto';
import type { App } from 'electron';
import type { ScaCategory, ScaError, ScaSeverity, StaticAnalysisRunResult } from '../../shared/ipc/payloads';
import {
  createTelnetIpcCoalesceState,
  scheduleCoalescedMapFlush,
  flushCoalescedMapNow,
  appendCoalescedText,
  type TelnetIpcCoalesceHost
} from '../ipc/telnet-log-ipc-coalesce';
import { mainError, mainLog } from '../log';

const DEFAULT_TIMEOUT_MS = 5 * 60_000;
/** Per-stream cap on the raw tail kept for the "no report found" fallback / crash diagnostics. */
const TAIL_CAP_CHARS = 256 * 1024;

interface ScaRunState extends TelnetIpcCoalesceHost {
  runId: string;
  /** `webContents.id` of the window that started this run — lets a window-close handler kill
   *  only its own runs without needing to track run ids on the window side. */
  senderId: number;
  child: ChildProcess;
  outputDir: string;
  stdoutTail: string;
  stderrTail: string;
  killedByUser: boolean;
  timedOut: boolean;
  watchdog: NodeJS.Timeout;
  emit: (channel: 'progress' | 'result', payload: unknown) => void;
}

const runsById = new Map<string, ScaRunState>();

function appendTail(state: ScaRunState, field: 'stdoutTail' | 'stderrTail', chunk: string): void {
  const combined = state[field] + chunk;
  state[field] = combined.length > TAIL_CAP_CHARS ? combined.slice(-TAIL_CAP_CHARS) : combined;
}

function getScaReportsBaseDir(app: App): string {
  return path.join(app.getPath('userData'), 'sca-cmd', 'reports');
}

/** Best-effort removal of a finished run's output directory — the report/raw output is already
 *  in memory by the time this is called (emitted to the renderer, which is also what "Save"
 *  writes from), so nothing else ever reads this directory again. */
function removeReportDir(outputDir: string): void {
  fs.promises.rm(outputDir, { recursive: true, force: true }).catch(() => {});
}

/** Defensive sweep for leftover run directories from a crash/force-quit that skipped the normal
 *  `removeReportDir` cleanup (same "clean up prior staging dirs" pattern as sca-tool-manager's
 *  cache promotion). Only removes directories not tracked in `runsById`, so it can never touch a
 *  concurrently running analysis in another window. */
async function pruneOrphanedReportDirs(app: App, keepRunId: string): Promise<void> {
  const baseDir = getScaReportsBaseDir(app);
  let entries: string[];
  try {
    entries = await fs.promises.readdir(baseDir);
  } catch {
    return;
  }
  const keep = new Set(runsById.keys());
  keep.add(keepRunId);
  await Promise.all(
    entries.filter((name) => !keep.has(name)).map((name) => fs.promises.rm(path.join(baseDir, name), { recursive: true, force: true }).catch(() => {}))
  );
}

const SEVERITIES: ReadonlySet<string> = new Set(['info', 'warning', 'error']);
const CATEGORIES: ReadonlySet<string> = new Set([
  'uncategorized',
  'deprecated_components',
  'deprecated_apis',
  'manifest',
  'raf',
  'red',
  'package'
]);

function buildArgs(inputPath: string, severity: ScaSeverity | undefined, categories: ScaCategory[] | undefined, outputDir: string): string[] {
  const args = [inputPath];
  if (severity && SEVERITIES.has(severity)) args.push('-s', severity);
  const cats = (categories ?? []).filter((c) => CATEGORIES.has(c));
  // All 7 (or none explicitly narrowed) selected means "no filter" — omit -c rather than
  // spelling out every category.
  if (cats.length > 0 && cats.length < CATEGORIES.size) args.push('-c', cats.join(','));
  // Always request both: if `json` turns out unsupported by a given sca-cmd build, console
  // output is still available as a fallback instead of silence.
  args.push('-f', 'console,json');
  // `-o` is a destination FILE path (its parent folder must already exist), not a directory —
  // passing the directory itself makes sca-cmd try to open it as the output file and fail with
  // "Is a directory". `outputDir` already exists (created before spawn), so this satisfies that.
  args.push('-o', path.join(outputDir, 'SCA_Report.json'));
  return args;
}

function killScaChild(child: ChildProcess): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    // sca-cmd.bat's cmd.exe wrapper doesn't propagate a kill to the java.exe it launched — /T kills the tree.
    execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {});
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      /* best-effort */
    }
  }
  setTimeout(() => {
    try {
      process.kill(-child.pid!, 'SIGKILL');
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {
        /* best-effort */
      }
    }
  }, 2000).unref();
}

/** Prefer Roku's documented default report name, then any other `.json` under the output dir. */
async function locateAndParseReport(outputDir: string): Promise<{ report: unknown | null; reportPath: string | null; parseError?: string }> {
  let files: string[] = [];
  try {
    const walk = async (dir: string, base: string): Promise<string[]> => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      const out: string[] = [];
      for (const entry of entries) {
        const rel = path.join(base, entry.name);
        if (entry.isDirectory()) out.push(...(await walk(path.join(dir, entry.name), rel)));
        else if (/\.json$/i.test(entry.name)) out.push(rel);
      }
      return out;
    };
    files = await walk(outputDir, '');
  } catch {
    return { report: null, reportPath: null };
  }
  if (files.length === 0) return { report: null, reportPath: null };

  const preferred = files.find((f) => /SCA_Report\.json$/i.test(f));
  const ordered = preferred ? [preferred, ...files.filter((f) => f !== preferred)] : files;
  let lastPath = path.join(outputDir, ordered[0]!);
  for (const rel of ordered) {
    const full = path.join(outputDir, rel);
    lastPath = full;
    try {
      const report = JSON.parse(await fs.promises.readFile(full, 'utf8'));
      return { report, reportPath: full };
    } catch {
      continue;
    }
  }
  return { report: null, reportPath: lastPath, parseError: 'JSON parse failed' };
}

function classifyExit(state: ScaRunState, code: number | null, signal: string | null): ScaError | undefined {
  if (state.killedByUser) return { code: 'cancelled', message: 'Analysis cancelled.' };
  if (state.timedOut) return { code: 'timeout', message: 'Analysis timed out.' };
  const combined = state.stdoutTail + state.stderrTail;
  if (/UnsupportedClassVersionError|class file version/i.test(combined)) {
    return { code: 'java-incompatible', message: "The installed Java version is incompatible with Roku's analysis tool." };
  }
  if (/not a valid|invalid (zip|package|manifest)|cannot read/i.test(combined)) {
    return { code: 'invalid-input-package', message: "The selected file doesn't look like a valid Roku channel package." };
  }
  if (code !== 0 && code !== null) {
    return { code: 'sca-tool-crashed', message: `Analysis tool exited with code ${code}.` };
  }
  if (signal) {
    return { code: 'sca-tool-crashed', message: `Analysis tool was terminated (${signal}).` };
  }
  return undefined;
}

export interface StartScaRunArgs {
  app: App;
  launcherPath: string;
  inputPath: string;
  severity?: ScaSeverity;
  categories?: ScaCategory[];
  timeoutMs?: number;
  /** `webContents.id` of the requesting window — see {@link ScaRunState.senderId}. */
  senderId: number;
  emit: (channel: 'progress' | 'result', payload: unknown) => void;
}

/** Starts a run and returns its id immediately (spawn success/failure only) — the run itself can
 *  take minutes, so the caller doesn't block on completion; progress/result arrive via `emit`. */
export function startScaRun(args: StartScaRunArgs): { success: boolean; runId?: string; error?: string } {
  let resolvedInput: string;
  try {
    resolvedInput = fs.realpathSync(args.inputPath);
  } catch {
    args.emit('result', {
      runId: '',
      error: { code: 'invalid-input-path', message: 'The selected file could not be found.' }
    } satisfies StaticAnalysisRunResult);
    return { success: false, error: 'invalid-input-path' };
  }

  const runId = crypto.randomUUID();
  const outputDir = path.join(getScaReportsBaseDir(args.app), runId);
  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
  void pruneOrphanedReportDirs(args.app, runId);

  const cliArgs = buildArgs(resolvedInput, args.severity, args.categories, outputDir);
  const isWin = process.platform === 'win32';
  let child: ChildProcess;
  try {
    child = spawn(args.launcherPath, cliArgs, {
      cwd: path.dirname(args.launcherPath),
      windowsHide: true,
      shell: isWin, // sca-cmd.bat requires cmd.exe; the POSIX launcher runs directly once chmod'd
      detached: !isWin, // new process group on POSIX so a kill can signal the whole tree
      env: process.env
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  const watchdog = setTimeout(() => {
    const state = runsById.get(runId);
    if (!state) return;
    state.timedOut = true;
    killScaChild(state.child);
  }, args.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const state: ScaRunState = {
    runId,
    senderId: args.senderId,
    child,
    outputDir,
    stdoutTail: '',
    stderrTail: '',
    killedByUser: false,
    timedOut: false,
    watchdog,
    emit: args.emit,
    ipcCoalesce: createTelnetIpcCoalesceState()
  };
  runsById.set(runId, state);

  const onData = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    appendTail(state, stream === 'stdout' ? 'stdoutTail' : 'stderrTail', text);
    appendCoalescedText(state, text);
    scheduleCoalescedMapFlush(runsById, runId, (live, slice) => live.emit('progress', { runId, stream, text: slice }));
  };
  child.stdout?.on('data', onData('stdout'));
  child.stderr?.on('data', onData('stderr'));

  child.on('error', (err) => {
    clearTimeout(watchdog);
    flushCoalescedMapNow(runsById, runId, () => {});
    runsById.delete(runId);
    removeReportDir(outputDir);
    mainError('[StaticAnalysis] spawn failed:', err);
    state.emit('result', {
      runId,
      rawStdout: state.stdoutTail,
      rawStderr: state.stderrTail,
      error: { code: 'spawn-failed', message: err.message }
    } satisfies StaticAnalysisRunResult);
  });

  child.on('close', async (code, signal) => {
    clearTimeout(watchdog);
    flushCoalescedMapNow(runsById, runId, (live, slice) => live.emit('progress', { runId, stream: 'stdout', text: slice }));
    runsById.delete(runId);

    const { report, reportPath, parseError } = await locateAndParseReport(outputDir);
    const error =
      classifyExit(state, code, signal) ??
      (report === null ? { code: 'report-missing' as const, message: 'No structured report was produced.' } : undefined) ??
      (parseError ? { code: 'report-malformed' as const, message: parseError } : undefined);

    removeReportDir(outputDir);
    mainLog(`[StaticAnalysis] run ${runId} finished: code=${code} signal=${signal ?? 'none'} report=${report ? 'yes' : 'no'}`);
    state.emit('result', {
      runId,
      report: report ?? undefined,
      reportPath: reportPath ?? undefined,
      rawStdout: state.stdoutTail,
      rawStderr: state.stderrTail,
      exitCode: code,
      signal,
      timedOut: state.timedOut,
      cancelled: state.killedByUser,
      error
    } satisfies StaticAnalysisRunResult);
  });

  return { success: true, runId };
}

export function cancelScaRun(runId: string): boolean {
  const state = runsById.get(runId);
  if (!state) return false;
  state.killedByUser = true;
  killScaChild(state.child);
  return true;
}

/** Called from `before-quit` so a run in progress can't orphan a `java` process. */
export function killAllScaRuns(): void {
  for (const state of runsById.values()) {
    state.killedByUser = true;
    killScaChild(state.child);
  }
}

/** Called when a Static Analysis window closes, so a run it started doesn't keep a `java`
 *  process running in the background with nothing left to show its result to. */
export function killRunsForSender(senderId: number): void {
  for (const state of runsById.values()) {
    if (state.senderId === senderId) {
      state.killedByUser = true;
      killScaChild(state.child);
    }
  }
}

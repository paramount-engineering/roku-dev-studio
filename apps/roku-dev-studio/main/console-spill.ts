/**
 * Console scrollback spill — disk-backed history beyond the in-memory cap of
 * `telnet-console-panel.ts` (`TELNET_MAX_SCROLLBACK_LINES = 50000`).
 *
 * The Console panel keeps the most-recent N entries in memory; older entries
 * trimmed from the head get appended here so the user can still recover them
 * (Save/Copy includes them; scrolling toward the top of the in-memory buffer
 * lazy-loads the file content back into the unified view).
 *
 * **Per-tab session.** Each Connect creates a fresh spill file in
 * `<temp>/roku-dev-studio/console-spill/`. The handle (`spillId`) is the
 * filename's stem and is what the renderer carries on subsequent
 * Append / Read / Clear calls. Cleanup happens on the renderer's explicit
 * Clear (`ConsoleSpillClear`), on the renderer dropping the device tab
 * (also `ConsoleSpillClear`), and on `app.on('will-quit')` here — the
 * temp dir gets wiped wholesale.
 *
 * **Format.** NDJSON: one JSON-encoded entry per line. The renderer pushes
 * arrays of `{ t, ty, st? }` objects (text / type / structuredTargets). JSON
 * encoding survives any embedded newlines / unicode the BrightScript log
 * stream might contain.
 *
 * **Cap.** 100 MB per spill file. Past the cap, additional `Append` calls
 * silently drop the new entries (same memory-savior reasoning as the
 * in-memory cap, scaled up). The 100 MB ceiling is large enough for several
 * hours of moderate streaming and small enough to keep IPC read-back
 * responsive (a 100 MB string lands in the renderer in well under a second).
 *
 * **Privacy.** Files live in OS temp (`app.getPath('temp')` →
 * `roku-dev-studio/console-spill/`). They're per-session, get wiped on
 * Clear / tab teardown / app quit, and never persist beyond the lifetime of
 * the user's active debugging context. No setting because the trade-off is
 * always net-positive for "I'm a developer staring at my own log output".
 */

import type { App, IpcMain, IpcMainInvokeEvent } from 'electron';

const fs = require('fs');
const path = require('path');

const SPILL_FILE_MAX_BYTES = 100 * 1024 * 1024;
/**
 * Filename stem prefix; per-session timestamp suffix appended in `start`.
 * Kept short so the OS temp dir stays scannable in Activity Monitor / `lsof`
 * without a wall of `roku-dev-studio-…`.
 */
const SPILL_FILE_PREFIX = 'console-';

type SpillSession = {
  filePath: string;
  byteSize: number;
  /** Total entries written across the lifetime of the file. Renderer reads
   *  this back on `start` (always 0 for a new session) and on `read` (so it
   *  can size its prepend correctly). */
  entryCount: number;
};

/** spillId → in-memory bookkeeping. The byte/entry counts are mirrored on
 *  the renderer side for the live counter, but the source of truth lives
 *  here so a renderer crash + restart re-syncs from disk on next start. */
const sessions = new Map<string, SpillSession>();

let consoleSpillIpcRegistered = false;
let cleanupRegistered = false;
let baseDir: string | null = null;

/** Lazy `<temp>/roku-dev-studio/console-spill/`. Created once per app run. */
function ensureBaseDir(app: App): string {
  if (baseDir) return baseDir;
  const dir = path.join(app.getPath('temp'), 'roku-dev-studio', 'console-spill');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.error('[Console spill] Could not create base dir:', e);
  }
  baseDir = dir;
  return dir;
}

/** Bulk-delete every spill file we know about, plus everything else in our
 *  temp subdir (in case a prior crashed run left stragglers). Bounded
 *  walk: the dir only ever contains our own files. */
function cleanupAll(): void {
  for (const id of [...sessions.keys()]) {
    deleteSpill(id);
  }
  if (baseDir && fs.existsSync(baseDir)) {
    try {
      const remaining = fs.readdirSync(baseDir);
      for (const entry of remaining) {
        try {
          fs.unlinkSync(path.join(baseDir, entry));
        } catch {
          /* best effort */
        }
      }
    } catch {
      /* dir disappeared — nothing to clean */
    }
  }
}

function deleteSpill(spillId: string): void {
  const session = sessions.get(spillId);
  if (!session) return;
  sessions.delete(spillId);
  try {
    if (fs.existsSync(session.filePath)) {
      fs.unlinkSync(session.filePath);
    }
  } catch (e) {
    // Non-fatal — temp dir cleanup will catch any stragglers on app quit.
    console.warn('[Console spill] Could not delete spill file:', session.filePath, e);
  }
}

export function registerConsoleSpillIpc(ipcMain: IpcMain, app: App): void {
  if (consoleSpillIpcRegistered) return;
  consoleSpillIpcRegistered = true;

  // App-wide cleanup. Registered once so the temp dir is wiped clean on a
  // normal quit even if individual sessions skipped their explicit Clear
  // (e.g. window force-closed via OS gesture).
  if (!cleanupRegistered) {
    cleanupRegistered = true;
    app.on('will-quit', () => {
      cleanupAll();
    });
  }

  ipcMain.handle(IPC_ConsoleSpillStart, (event: IpcMainInvokeEvent, payload: { tag?: string }) => {
    void event;
    const dir = ensureBaseDir(app);
    // Filename stem is `console-<sanitized-tag>-<timestamp>`. The tag is the
    // device IP / serial passed by the renderer; sanitized to filesystem-safe
    // chars (`.`, `:` etc. → `_`). Timestamp disambiguates back-to-back
    // Connect cycles to the same device.
    const tag = (payload?.tag || 'unknown').replace(/[^a-z0-9_-]/gi, '_').slice(0, 64);
    const stem = `${SPILL_FILE_PREFIX}${tag}-${Date.now()}`;
    const filePath = path.join(dir, `${stem}.ndjson`);
    try {
      // Touch the file so subsequent appendFileSync sees an existing zero-byte
      // file (clearer for `lsof` / debugging than "file appears on first
      // append").
      fs.writeFileSync(filePath, '');
    } catch (e) {
      return {
        success: false as const,
        error: e instanceof Error ? e.message : String(e)
      };
    }
    sessions.set(stem, { filePath, byteSize: 0, entryCount: 0 });
    return { success: true as const, spillId: stem };
  });

  ipcMain.handle(
    IPC_ConsoleSpillAppend,
    (
      event: IpcMainInvokeEvent,
      payload: { spillId: string; entries: Array<Record<string, unknown>> }
    ) => {
      void event;
      const session = sessions.get(payload.spillId);
      if (!session) {
        return { success: false as const, error: 'Unknown spillId' };
      }
      if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
        return {
          success: true as const,
          byteSize: session.byteSize,
          entryCount: session.entryCount,
          dropped: 0
        };
      }

      // Build the on-disk text first so we can pre-check against the cap. A
      // single `appendFileSync` is dramatically cheaper than per-entry
      // syscalls for the streaming workload (350-line bursts on hot trim).
      let text = '';
      let dropped = 0;
      for (const entry of payload.entries) {
        const line = JSON.stringify(entry) + '\n';
        if (session.byteSize + Buffer.byteLength(text) + Buffer.byteLength(line) > SPILL_FILE_MAX_BYTES) {
          dropped = payload.entries.length - (text.length === 0 ? 0 : countLines(text));
          break;
        }
        text += line;
      }

      if (text.length === 0) {
        // Hit the cap before writing anything. Caller learns from the
        // `dropped` count and may stop trying to append.
        return {
          success: true as const,
          byteSize: session.byteSize,
          entryCount: session.entryCount,
          dropped
        };
      }

      try {
        fs.appendFileSync(session.filePath, text);
      } catch (e) {
        return {
          success: false as const,
          error: e instanceof Error ? e.message : String(e)
        };
      }
      const writtenLines = countLines(text);
      session.byteSize += Buffer.byteLength(text);
      session.entryCount += writtenLines;

      return {
        success: true as const,
        byteSize: session.byteSize,
        entryCount: session.entryCount,
        dropped
      };
    }
  );

  ipcMain.handle(IPC_ConsoleSpillRead, (event: IpcMainInvokeEvent, payload: { spillId: string }) => {
    void event;
    const session = sessions.get(payload.spillId);
    if (!session) {
      return { success: false as const, error: 'Unknown spillId' };
    }
    try {
      const text = fs.readFileSync(session.filePath, 'utf8') as string;
      // Empty file or trailing newline produces an empty last line — strip it.
      const lines = text.length === 0 ? [] : text.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
      return {
        success: true as const,
        entries: lines,
        byteSize: session.byteSize,
        entryCount: session.entryCount
      };
    } catch (e) {
      return {
        success: false as const,
        error: e instanceof Error ? e.message : String(e)
      };
    }
  });

  ipcMain.handle(IPC_ConsoleSpillClear, (event: IpcMainInvokeEvent, payload: { spillId: string }) => {
    void event;
    deleteSpill(payload.spillId);
    return { success: true as const };
  });
}

/** Count `\n` occurrences in a string. Used to translate written bytes to
 *  written-entry count without re-iterating the entry array. NDJSON
 *  guarantees one entry per line. */
function countLines(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) n++;
  }
  return n;
}

// Channel-name imports — destructured lazily so the constants module isn't
// imported at module-load time (the file is loaded by main.ts before the
// shared ipc module is in scope on cold-start in some entry orderings).
import { IPC } from '../shared/ipc/channels';
const IPC_ConsoleSpillStart = IPC.ConsoleSpillStart;
const IPC_ConsoleSpillAppend = IPC.ConsoleSpillAppend;
const IPC_ConsoleSpillRead = IPC.ConsoleSpillRead;
const IPC_ConsoleSpillClear = IPC.ConsoleSpillClear;

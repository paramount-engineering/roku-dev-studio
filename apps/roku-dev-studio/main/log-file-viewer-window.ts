/**
 * Standalone window: open a log file with the same console-style rendering as the device Console.
 *
 * **Load model: windowed.** Earlier the main process streamed the whole file to
 * the renderer, which parsed every line into one resident `entries[]` array —
 * so the file effectively lived in the renderer heap and a 41 MB log tripped
 * the viewer's memory guard. Now main builds a per-line byte-offset index
 * (`buildLineIndex`) and the renderer pulls only the byte range around the
 * viewport (`readLineRange` / `readLines`), keeping a small sliding window
 * resident while the scrollbar still spans the whole file. Full-file Find /
 * Filter run in main (`searchFile`) so search covers lines that aren't
 * currently resident. See `log-file-index.ts` for the backend.
 */

import type { BrowserWindow as ElectronBrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import { IPC } from '../shared/ipc/channels';
import { setupZoomGuards } from './window-zoom';
import { mainError } from './log.js';
import {
  buildLineIndex,
  readLineRange,
  readLines,
  searchFile,
  LOG_VIEWER_MAX_LINES,
  type LogFileIndex
} from './log-file-index';
import { buildSearchRegex, type ConsoleFindOptions } from '../renderer/modules/console-log/console-find-helpers';

const fs = require('fs');
const path = require('path');
const { BrowserWindow, dialog, screen } = require('electron') as typeof import('electron');

/**
 * Upper bound on file size we'll index. Far above the old 36 MB in-renderer
 * cap because the file no longer lives in the renderer — only the offset table
 * (8 bytes/line, itself capped by `LOG_VIEWER_MAX_LINES`) and a small window do.
 * The ceiling is a sanity guard against accidentally pointing the viewer at a
 * multi-gigabyte blob, not a memory constraint.
 */
const LOG_VIEWER_MAX_BYTES = 2 * 1024 * 1024 * 1024;

/** Per-window backing state, keyed by BrowserWindow.id. `filePath` is set at
 *  open; `index` is built lazily on the first `Prepare`; `searchToken` lets a
 *  newer search supersede an in-flight scan. */
type LogViewerState = {
  filePath: string;
  index: LogFileIndex | null;
  searchToken: number;
};
const logViewerStateByWindowId = new Map<number, LogViewerState>();

let logViewerIpcRegistered = false;

function stateForEvent(event: IpcMainInvokeEvent): { state: LogViewerState } | { error: string } {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return { error: 'Internal error: no window' };
  const state = logViewerStateByWindowId.get(win.id);
  if (!state) return { error: 'No file is associated with this window' };
  return { state };
}

export function registerLogViewerIpc(ipcMain: IpcMain): void {
  if (logViewerIpcRegistered) return;
  logViewerIpcRegistered = true;

  // Prepare: stat + build the line-offset index. Answers with file metadata the
  // renderer needs to size the virtualizer to the whole file. The index is
  // cached on the window's state for subsequent range/search calls.
  ipcMain.handle(
    IPC.LogViewerPrepare,
    async (
      event: IpcMainInvokeEvent
    ): Promise<{
      success: boolean;
      fileName?: string;
      fileSize?: number;
      lineCount?: number;
      encoding?: string;
      error?: string;
    }> => {
      const got = stateForEvent(event);
      if ('error' in got) return { success: false, error: got.error };
      const { state } = got;

      let stat: ReturnType<typeof fs.statSync>;
      try {
        stat = fs.statSync(state.filePath);
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
      if (!stat.isFile()) return { success: false, error: 'Not a file' };
      if (stat.size > LOG_VIEWER_MAX_BYTES) {
        return {
          success: false,
          error: `File is too large (${Math.round(stat.size / (1024 * 1024 * 1024))} GB). Maximum is ${LOG_VIEWER_MAX_BYTES / (1024 * 1024 * 1024)} GB.`
        };
      }

      try {
        state.index = buildLineIndex(state.filePath);
      } catch (e) {
        if (e instanceof Error && e.message === 'too-many-lines') {
          return {
            success: false,
            error: `File has too many lines (over ${LOG_VIEWER_MAX_LINES.toLocaleString()}). Try splitting it.`
          };
        }
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }

      return {
        success: true,
        fileName: path.basename(state.filePath),
        fileSize: state.index.fileSize,
        lineCount: state.index.lineCount,
        encoding: state.index.encoding
      };
    }
  );

  // Read a contiguous line range for the normal sliding window.
  ipcMain.handle(
    IPC.LogViewerReadRange,
    (
      event: IpcMainInvokeEvent,
      payload: { startLine: number; endLine: number }
    ): { success: boolean; startLine?: number; endLine?: number; lines?: string[]; error?: string } => {
      const got = stateForEvent(event);
      if ('error' in got) return { success: false, error: got.error };
      const { state } = got;
      if (!state.index) return { success: false, error: 'File not prepared' };
      try {
        const lines = readLineRange(state.index, payload.startLine, payload.endLine);
        return { success: true, startLine: payload.startLine, endLine: payload.endLine, lines };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );

  // Read scattered line numbers for the Filter-mode window.
  ipcMain.handle(
    IPC.LogViewerReadLines,
    (
      event: IpcMainInvokeEvent,
      payload: { lines: number[] }
    ): { success: boolean; lines?: Array<{ line: number; text: string }>; error?: string } => {
      const got = stateForEvent(event);
      if ('error' in got) return { success: false, error: got.error };
      const { state } = got;
      if (!state.index) return { success: false, error: 'File not prepared' };
      try {
        return { success: true, lines: readLines(state.index, payload.lines ?? []) };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );

  // Full-file search (Find highlight/nav + Filter line set). A newer call bumps
  // `searchToken`; the running scan polls it and aborts if superseded.
  ipcMain.handle(
    IPC.LogViewerSearch,
    async (
      event: IpcMainInvokeEvent,
      payload: { query: string; options: ConsoleFindOptions }
    ): Promise<{
      success: boolean;
      hits?: Array<{ line: number; start: number; end: number }>;
      matchLines?: number[];
      truncated?: boolean;
      superseded?: boolean;
      error?: string;
    }> => {
      const got = stateForEvent(event);
      if ('error' in got) return { success: false, error: got.error };
      const { state } = got;
      if (!state.index) return { success: false, error: 'File not prepared' };

      const query = payload?.query ?? '';
      if (!query) return { success: true, hits: [], matchLines: [], truncated: false };

      const regex = buildSearchRegex(query, payload.options);
      if (!regex) return { success: true, hits: [], matchLines: [], truncated: false };

      const myToken = ++state.searchToken;
      const result = await searchFile(state.index, regex, () => state.searchToken !== myToken);
      if (state.searchToken !== myToken) {
        // A newer search started while we scanned — discard this stale result so
        // the renderer doesn't paint hits for an outdated query.
        return { success: true, superseded: true };
      }
      return {
        success: true,
        hits: result.hits,
        matchLines: result.matchLines,
        truncated: result.truncated
      };
    }
  );
}

export function openLogFileViewerWindow(parent: ElectronBrowserWindow | undefined, filePath: string): void {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    const boxOpts = {
      type: 'error' as const,
      title: 'Open Log File',
      message: 'Could not open the selected file.'
    };
    if (parent && !parent.isDestroyed()) {
      void dialog.showMessageBox(parent, boxOpts);
    } else {
      void dialog.showMessageBox(boxOpts);
    }
    return;
  }

  const preloadPath = path.join(__dirname, 'log-viewer-preload.bundled.cjs');
  const htmlPath = path.join(__dirname, 'renderer', 'log-file-viewer.html');

  // No `parent`: a child window stays above the main window and can vanish or mis-stack when
  // dragged to another display. This is a normal top-level window; we only center it on the
  // parent's display once at open time.
  const child = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 560,
    minHeight: 400,
    title: `Logs — ${path.basename(resolved)}`,
    backgroundColor: '#0a0a12',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  logViewerStateByWindowId.set(child.id, { filePath: resolved, index: null, searchToken: 0 });
  child.once('closed', () => {
    logViewerStateByWindowId.delete(child.id);
  });

  // Same zoom band + pinch-zoom guard as the main window so View > Zoom and
  // Ctrl+wheel both clamp to the configured min/max factor.
  setupZoomGuards(child);

  child.once('ready-to-show', () => {
    if (parent && !parent.isDestroyed()) {
      try {
        const pb = parent.getBounds();
        const [w, h] = child.getSize();
        const { workArea } = screen.getDisplayMatching(pb);
        let x = Math.round(pb.x + (pb.width - w) / 2);
        let y = Math.round(pb.y + (pb.height - h) / 2);
        const maxX = workArea.x + workArea.width - w;
        const maxY = workArea.y + workArea.height - h;
        x = Math.min(Math.max(workArea.x, x), maxX);
        y = Math.min(Math.max(workArea.y, y), maxY);
        child.setPosition(x, y);
      } catch {
        /* keep OS default placement */
      }
    }
    child.show();
  });

  child.webContents.on('preload-error', (_e: unknown, failedPath: string, error: Error) => {
    mainError('[Log viewer] Preload failed:', failedPath, error);
  });

  void child.loadFile(htmlPath).catch((err: unknown) => {
    mainError('[Log viewer] loadFile failed:', err);
    logViewerStateByWindowId.delete(child.id);
    if (!child.isDestroyed()) child.close();
  });
}

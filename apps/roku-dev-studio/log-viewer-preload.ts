import { IPC } from './shared/ipc/channels';
import type { ConsoleFindOptions } from './renderer/modules/console-log/console-find-helpers';
import type { ConsoleFindings } from './shared/console/brightscript-error-catalog';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('roku', {
  /**
   * Prepare the file for windowed reading: main builds the per-line byte-offset
   * index and returns file metadata (`lineCount` sizes the full-file scrollbar).
   * The renderer then pulls only the visible window via `readLogViewerRange` /
   * `readLogViewerLines`, so the whole file never lives in the renderer heap.
   */
  prepareLogViewerFile: () =>
    ipcRenderer.invoke(IPC.LogViewerPrepare) as Promise<{
      success: boolean;
      fileName?: string;
      fileSize?: number;
      lineCount?: number;
      encoding?: string;
      error?: string;
    }>,
  /** Decode a contiguous, half-open line range `[startLine, endLine)`. */
  readLogViewerRange: (startLine: number, endLine: number) =>
    ipcRenderer.invoke(IPC.LogViewerReadRange, { startLine, endLine }) as Promise<{
      success: boolean;
      startLine?: number;
      endLine?: number;
      lines?: string[];
      error?: string;
    }>,
  /** Decode a scattered set of line numbers (Filter mode's non-contiguous window). */
  readLogViewerLines: (lines: number[]) =>
    ipcRenderer.invoke(IPC.LogViewerReadLines, { lines }) as Promise<{
      success: boolean;
      lines?: Array<{ line: number; text: string }>;
      error?: string;
    }>,
  /** Full-file search. `hits` drive Find highlight/nav; `matchLines` is the set
   *  Filter mode collapses the file to. `superseded` means a newer search
   *  started before this one finished — the caller should ignore the result. */
  searchLogViewerFile: (query: string, options: ConsoleFindOptions) =>
    ipcRenderer.invoke(IPC.LogViewerSearch, { query, options }) as Promise<{
      success: boolean;
      hits?: Array<{ line: number; start: number; end: number }>;
      matchLines?: number[];
      truncated?: boolean;
      superseded?: boolean;
      error?: string;
    }>,
  /** Console Monitor: whole-file BrightScript-issue scan. `findings` is the shared `ConsoleFindings`
   *  shape the analytics modal renders. `superseded` means a newer scan started first — ignore. */
  scanLogViewerFindings: () =>
    ipcRenderer.invoke(IPC.LogViewerFindings) as Promise<{
      success: boolean;
      findings?: ConsoleFindings;
      scannedLines?: number;
      truncated?: boolean;
      superseded?: boolean;
      error?: string;
    }>,
  copyToClipboard: (text: string) => ipcRenderer.invoke(IPC.ClipboardWrite, text),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.ShellOpenExternal, url)
});

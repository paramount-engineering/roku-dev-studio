import { IPC } from './shared/ipc/channels';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('roku', {
  /**
   * Kick off the streaming load. Returns once the file metadata is known
   * (filename + total size); the renderer then subscribes to chunk events
   * via `onLogViewerChunk`/`onLogViewerComplete`/`onLogViewerError`. The
   * stream starts emitting on the next tick — guaranteed to arrive *after*
   * this promise resolves, so the renderer has a chance to mount the surface
   * scaffold before any chunk lands.
   */
  loadLogViewerFile: () =>
    ipcRenderer.invoke(IPC.LogViewerStreamStart) as Promise<{
      success: boolean;
      fileName?: string;
      fileSize?: number;
      error?: string;
    }>,
  /** Subscribe to streaming chunks. Returns a disposer for symmetry with
   *  the other `on*` bridges, though the log viewer window is single-load
   *  per session so most callers don't need it. */
  onLogViewerChunk: (
    callback: (data: { text: string; doneBytes: number; totalBytes: number }) => void
  ): (() => void) => {
    const handler = (_e: unknown, data: { text: string; doneBytes: number; totalBytes: number }) =>
      callback(data);
    ipcRenderer.on(IPC.LogViewerStreamChunk, handler);
    return () => ipcRenderer.removeListener(IPC.LogViewerStreamChunk, handler);
  },
  onLogViewerComplete: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.LogViewerStreamComplete, handler);
    return () => ipcRenderer.removeListener(IPC.LogViewerStreamComplete, handler);
  },
  onLogViewerError: (callback: (data: { error: string }) => void): (() => void) => {
    const handler = (_e: unknown, data: { error: string }) => callback(data);
    ipcRenderer.on(IPC.LogViewerStreamError, handler);
    return () => ipcRenderer.removeListener(IPC.LogViewerStreamError, handler);
  },
  copyToClipboard: (text: string) => ipcRenderer.invoke(IPC.ClipboardWrite, text),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.ShellOpenExternal, url),
  // Same IPC the live Console uses for its Save button. Reusing it means the
  // Log Viewer gets the same Electron save dialog + write-to-file path; no
  // separate main-process handler.
  saveConsoleLogs: (content: string) => ipcRenderer.invoke(IPC.RokuSaveConsoleLogs, { content })
});

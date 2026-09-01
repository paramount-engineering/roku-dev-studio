import type { IpcRendererEvent } from 'electron';
import { IPC } from './shared/ipc/channels';
import type {
  JavaStatus,
  ScaToolStatus,
  StaticAnalysisCancelRunPayload,
  StaticAnalysisProgressPayload,
  StaticAnalysisRunPayload,
  StaticAnalysisRunResult
} from './shared/ipc/payloads';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('staticAnalysis', {
  ensureTool: (opts?: { force?: boolean }) =>
    ipcRenderer.invoke(IPC.StaticAnalysisEnsureTool, opts ?? {}) as Promise<ScaToolStatus>,

  checkJava: () => ipcRenderer.invoke(IPC.StaticAnalysisCheckJava) as Promise<JavaStatus>,

  chooseFile: () =>
    ipcRenderer.invoke(IPC.StaticAnalysisChooseFile) as Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>,

  // Resolve a drag-dropped File's real filesystem path — modern Electron no longer exposes a
  // usable `file.path` in the renderer; `webUtils.getPathForFile` is only callable from preload.
  // Same pattern as the Dev App sideload dropzone's `resolveDroppedSideloadFile`.
  resolveDroppedFile: (file: File): string | null => {
    try {
      return webUtils.getPathForFile(file) || null;
    } catch {
      return null;
    }
  },

  run: (payload: StaticAnalysisRunPayload) =>
    ipcRenderer.invoke(IPC.StaticAnalysisRun, payload) as Promise<{ success: boolean; runId?: string; error?: string }>,

  cancelRun: (payload: StaticAnalysisCancelRunPayload) =>
    ipcRenderer.invoke(IPC.StaticAnalysisCancelRun, payload) as Promise<{ success: boolean }>,

  // Reuses the app-wide shell:open-external handler (registered once at app-ready by
  // `system-handlers.ts`) — a plain `<a target="_blank">` doesn't work in this window since
  // there's no `setWindowOpenHandler` anywhere in the app; every external link goes through this.
  openExternal: (url: string) => ipcRenderer.invoke(IPC.ShellOpenExternal, url) as Promise<{ success: boolean; error?: string }>,

  // Crash-report modal: read the enable/disable setting + environment info.
  getSetting: (key: string) => ipcRenderer.invoke(IPC.SettingsGet, key),
  getAppInfo: () => ipcRenderer.invoke(IPC.GetAppInfo),

  // Reuses the app-wide "save text to file" handler (registered once at app-ready by
  // `system-handlers.ts`) — the same one Log Viewer / Network Session export already use.
  saveTextFile: (opts: { content: string; defaultName?: string; dialogTitle?: string }) =>
    ipcRenderer.invoke(IPC.RokuSaveTextFile, opts) as Promise<{ success: boolean; filePath?: string; error?: string }>,

  // Event subscriptions (return cleanup functions).
  onToolStatus: (callback: (status: ScaToolStatus) => void) => {
    const handler = (_event: IpcRendererEvent, status: ScaToolStatus) => callback(status);
    ipcRenderer.on(IPC.StaticAnalysisToolStatus, handler);
    return () => ipcRenderer.removeListener(IPC.StaticAnalysisToolStatus, handler);
  },

  onProgress: (callback: (data: StaticAnalysisProgressPayload) => void) => {
    const handler = (_event: IpcRendererEvent, data: StaticAnalysisProgressPayload) => callback(data);
    ipcRenderer.on(IPC.StaticAnalysisProgress, handler);
    return () => ipcRenderer.removeListener(IPC.StaticAnalysisProgress, handler);
  },

  onRunResult: (callback: (data: StaticAnalysisRunResult) => void) => {
    const handler = (_event: IpcRendererEvent, data: StaticAnalysisRunResult) => callback(data);
    ipcRenderer.on(IPC.StaticAnalysisRunResult, handler);
    return () => ipcRenderer.removeListener(IPC.StaticAnalysisRunResult, handler);
  },

  // Live locale: apply the current preference on open + retranslate on change.
  getLocale: () => ipcRenderer.invoke(IPC.GetLocale) as Promise<string>,
  onLocaleChanged: (callback: (pref: string) => void) => {
    const handler = (_event: IpcRendererEvent, pref: string) => callback(pref);
    ipcRenderer.on(IPC.LocaleChanged, handler);
    return () => ipcRenderer.removeListener(IPC.LocaleChanged, handler);
  }
});

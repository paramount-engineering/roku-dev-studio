import { IPC } from './shared/ipc/channels';
import type { IpcRendererEvent } from 'electron';
import type { ParsedNetworkEvent } from './shared/network-inspector/types';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('roku', {
  /** Parse the file this window was opened with and return the whole session at once. `format` is
   *  the detected input kind; `notice` carries a non-fatal parse warning (e.g. odd pcap link type). */
  loadNetworkSession: () =>
    ipcRenderer.invoke(IPC.NetSessionViewerLoad) as Promise<{
      success: boolean;
      fileName?: string;
      format?: 'bundle' | 'har' | 'pcap';
      events?: ParsedNetworkEvent[];
      deviceIps?: string[];
      notice?: string;
      error?: string;
    }>,
  copyToClipboard: (text: string) => ipcRenderer.invoke(IPC.ClipboardWrite, text),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.ShellOpenExternal, url),
  // Privacy Mode — this viewer reuses the live inspector's renderers (device IPs,
  // client addresses), so it must blur them too. Read the current state at open and
  // listen for live toggles broadcast from the main process.
  getPrivacyMode: () => ipcRenderer.invoke(IPC.GetPrivacyMode) as Promise<{ enabled: boolean }>,
  onPrivacyModeChanged: (callback: (enabled: boolean) => void) => {
    const handler = (_e: IpcRendererEvent, enabled: boolean) => callback(enabled);
    ipcRenderer.on(IPC.PrivacyModeChanged, handler);
    return () => ipcRenderer.removeListener(IPC.PrivacyModeChanged, handler);
  },
  saveTextFile: (opts: { content: string; defaultName?: string; dialogTitle?: string }) =>
    ipcRenderer.invoke(IPC.RokuSaveTextFile, opts),
  saveBinaryFile: (opts: { base64: string; defaultName?: string; dialogTitle?: string }) =>
    ipcRenderer.invoke(IPC.RokuSaveBinaryFile, opts)
});

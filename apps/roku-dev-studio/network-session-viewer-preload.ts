import { IPC } from './shared/ipc/channels';
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
  saveTextFile: (opts: { content: string; defaultName?: string; dialogTitle?: string }) =>
    ipcRenderer.invoke(IPC.RokuSaveTextFile, opts),
  saveBinaryFile: (opts: { base64: string; defaultName?: string; dialogTitle?: string }) =>
    ipcRenderer.invoke(IPC.RokuSaveBinaryFile, opts)
});

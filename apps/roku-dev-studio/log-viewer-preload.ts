import { IPC } from './shared/ipc/channels';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('roku', {
  loadLogViewerFile: () => ipcRenderer.invoke(IPC.LogViewerLoad),
  copyToClipboard: (text: string) => ipcRenderer.invoke(IPC.ClipboardWrite, text),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.ShellOpenExternal, url)
});

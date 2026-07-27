/**
 * Preload for the About dialog window.
 * Exposes only copy and openExternal via contextBridge; no Node/Electron APIs in the page.
 */
import type { IpcRendererEvent } from 'electron';
const { contextBridge, ipcRenderer } = require('electron');
const { IPC } = require('./shared/ipc/channels');

contextBridge.exposeInMainWorld('aboutApi', {
  getInfo: () => ipcRenderer.invoke('about:getInfo'),
  copy: (text: string) => ipcRenderer.invoke('about:copy', text),
  openExternal: (url: string) => ipcRenderer.invoke('about:openExternal', url),
  // Live locale: apply the current preference on open + retranslate on change.
  getLocale: () => ipcRenderer.invoke(IPC.GetLocale) as Promise<string>,
  onLocaleChanged: (callback: (pref: string) => void) => {
    const handler = (_e: IpcRendererEvent, pref: string) => callback(pref);
    ipcRenderer.on(IPC.LocaleChanged, handler);
    return () => ipcRenderer.removeListener(IPC.LocaleChanged, handler);
  }
});

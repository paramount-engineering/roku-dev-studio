/**
 * Preload for the About dialog window.
 * Exposes only copy and openExternal via contextBridge; no Node/Electron APIs in the page.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aboutApi', {
  copy: (text: string) => ipcRenderer.invoke('about:copy', text),
  openExternal: (url: string) => ipcRenderer.invoke('about:openExternal', url)
});

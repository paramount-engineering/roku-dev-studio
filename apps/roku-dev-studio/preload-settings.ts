/**
 * Preload for the Settings modal window (same isolation pattern as preload-about).
 */
const { contextBridge, ipcRenderer } = require('electron');
const { IPC } = require('./shared/ipc/channels');

contextBridge.exposeInMainWorld('settingsApi', {
  getState: () => ipcRenderer.invoke(IPC.SettingsWindowGetState),
  save: (payload: unknown) => ipcRenderer.invoke(IPC.SettingsWindowSave, payload),
  pickFolder: () => ipcRenderer.invoke(IPC.SettingsWindowPickFolder),
  openMcpConfig: (id: string) => ipcRenderer.invoke(IPC.SettingsWindowOpenMcpConfig, { id }),
  closeWindow: () => ipcRenderer.send(IPC.SettingsWindowClose)
});

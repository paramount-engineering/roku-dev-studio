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
  closeWindow: () => ipcRenderer.send(IPC.SettingsWindowClose),
  getNetworkInspectorStatus: () => ipcRenderer.invoke(IPC.NetworkInspectorGetStatus),
  installBpfAccess: () => ipcRenderer.invoke(IPC.NetworkInspectorInstallBpfAccess),
  // Remote Network Inspector (per-location): probe capability + config, and apply config.
  remoteNetworkProbe: (serverUrl: string) =>
    ipcRenderer.invoke(IPC.SettingsWindowRemoteNetworkProbe, { serverUrl }),
  remoteNetworkSetConfig: (serverUrl: string, config: unknown) =>
    ipcRenderer.invoke(IPC.SettingsWindowRemoteNetworkSetConfig, { serverUrl, config })
});

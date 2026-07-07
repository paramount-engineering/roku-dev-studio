/**
 * Preload for the Settings modal window (same isolation pattern as preload-about).
 */
const { contextBridge, ipcRenderer } = require('electron');
import type { IpcRendererEvent } from 'electron';
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
    ipcRenderer.invoke(IPC.SettingsWindowRemoteNetworkSetConfig, { serverUrl, config }),

  // Sideload Relay — config (gate/port/password/flags/targets) + live per-device results.
  sideloadRelayGetStatus: () => ipcRenderer.invoke(IPC.SideloadRelayGetStatus),
  sideloadRelayGetConfig: () => ipcRenderer.invoke(IPC.SideloadRelayGetConfig),
  sideloadRelayApply: (payload: unknown) => ipcRenderer.invoke(IPC.SideloadRelayApplySettings, payload),
  sideloadRelaySeedTargets: (includeSubnetScan?: boolean) =>
    ipcRenderer.invoke(IPC.SideloadRelaySeedTargets, { includeSubnetScan }),
  sideloadRelayValidatePassword: (payload: {
    ip: string;
    serial?: string;
    remote?: boolean;
    serverUrl?: string;
    password: string;
  }) => ipcRenderer.invoke(IPC.SideloadRelayValidatePassword, payload),
  sideloadRelayRevealPassword: () => ipcRenderer.invoke(IPC.SideloadRelayRevealPassword),
  onSideloadRelayStatus: (callback: (status: unknown) => void) => {
    const handler = (_e: IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on(IPC.SideloadRelayStatus, handler);
    return () => ipcRenderer.removeListener(IPC.SideloadRelayStatus, handler);
  },
  onSideloadRelayRunStarted: (callback: (run: unknown) => void) => {
    const handler = (_e: IpcRendererEvent, run: unknown) => callback(run);
    ipcRenderer.on(IPC.SideloadRelayRunStarted, handler);
    return () => ipcRenderer.removeListener(IPC.SideloadRelayRunStarted, handler);
  },
  onSideloadRelayResult: (callback: (result: unknown) => void) => {
    const handler = (_e: IpcRendererEvent, result: unknown) => callback(result);
    ipcRenderer.on(IPC.SideloadRelayResult, handler);
    return () => ipcRenderer.removeListener(IPC.SideloadRelayResult, handler);
  }
});

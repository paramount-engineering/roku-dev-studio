/**
 * Preload for the Settings modal window (same isolation pattern as preload-about).
 */
const { contextBridge, ipcRenderer } = require('electron');
import type { IpcRendererEvent } from 'electron';
const { IPC } = require('./shared/ipc/channels');

contextBridge.exposeInMainWorld('settingsApi', {
  // Privacy Mode — mirrors the main/Fiddle bridge so the Settings window can blur
  // IPs/serials (e.g. the Sideload Relay device table) in lockstep. Reads the
  // current state at open; the main process fans `IPC.PrivacyModeChanged` to every
  // open window so a menu / other-window toggle flows through live.
  getPrivacyMode: () => ipcRenderer.invoke(IPC.GetPrivacyMode) as Promise<{ enabled: boolean }>,
  onPrivacyModeChanged: (callback: (enabled: boolean) => void) => {
    const handler = (_e: IpcRendererEvent, enabled: boolean) => callback(enabled);
    ipcRenderer.on(IPC.PrivacyModeChanged, handler);
    return () => ipcRenderer.removeListener(IPC.PrivacyModeChanged, handler);
  },

  // Language — apply live on dropdown change: main persists, re-labels the native menu,
  // and fans `IPC.LocaleChanged` to every window (including this one) to retranslate.
  setLanguage: (code: string) => ipcRenderer.invoke(IPC.SetLocale, code),
  onLocaleChanged: (callback: (pref: string) => void) => {
    const handler = (_e: IpcRendererEvent, pref: string) => callback(pref);
    ipcRenderer.on(IPC.LocaleChanged, handler);
    return () => ipcRenderer.removeListener(IPC.LocaleChanged, handler);
  },

  // Signal main that the initial getState() population is complete, so it can reveal the
  // window fully-rendered (no toggle/section-populate flash). Main also has a fallback timer.
  notifyReady: () => ipcRenderer.send(IPC.SettingsWindowReady),
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

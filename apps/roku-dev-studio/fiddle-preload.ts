import type { IpcRendererEvent } from 'electron';
import { IPC } from './shared/ipc/channels';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fiddle', {
  /** Notify main that the window is loaded and ready for the initial device snapshot. */
  ready: () => ipcRenderer.send(IPC.FiddleReady),

  /** Ask the main renderer for a fresh device-list snapshot. */
  refreshDevices: () => ipcRenderer.send(IPC.FiddleRefreshDevices),

  lint: (code: string) =>
    ipcRenderer.invoke(IPC.FiddleLint, { code }),

  run: (payload: { deviceId: string; code: string; password?: string }) =>
    ipcRenderer.invoke(IPC.FiddleRun, payload),

  stop: (payload: { deviceId: string; password?: string }) =>
    ipcRenderer.invoke(IPC.FiddleStop, payload),

  // Event subscriptions (return cleanup functions).
  onInit: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(IPC.FiddleInit, handler);
    return () => ipcRenderer.removeListener(IPC.FiddleInit, handler);
  },

  onDevicesUpdate: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(IPC.FiddleDevicesUpdate, handler);
    return () => ipcRenderer.removeListener(IPC.FiddleDevicesUpdate, handler);
  },

  onTerminalData: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(IPC.FiddleTerminalData, handler);
    return () => ipcRenderer.removeListener(IPC.FiddleTerminalData, handler);
  },

  onTerminalCleared: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.FiddleTerminalCleared, handler);
    return () => ipcRenderer.removeListener(IPC.FiddleTerminalCleared, handler);
  },

  onRunResult: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(IPC.FiddleRunResult, handler);
    return () => ipcRenderer.removeListener(IPC.FiddleRunResult, handler);
  },

  onScanStatus: (callback: (data: { scanning: boolean }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { scanning: boolean }) => callback(data);
    ipcRenderer.on(IPC.FiddleScanStatus, handler);
    return () => ipcRenderer.removeListener(IPC.FiddleScanStatus, handler);
  },

  // Privacy Mode — mirrors the main window's bridge surface. Reads the current
  // state at startup (via the same `GetPrivacyMode` invoke handler the main
  // renderer uses) and listens for menu/Settings toggles. The main process
  // fans `IPC.PrivacyModeChanged` out to every open Fiddle window so live
  // toggles take effect without re-opening the window.
  getPrivacyMode: () => ipcRenderer.invoke(IPC.GetPrivacyMode) as Promise<{ enabled: boolean }>,

  onPrivacyModeChanged: (callback: (enabled: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, enabled: boolean) => callback(!!enabled);
    ipcRenderer.on(IPC.PrivacyModeChanged, handler);
    return () => ipcRenderer.removeListener(IPC.PrivacyModeChanged, handler);
  },

  // Live locale: apply the current preference on open + retranslate on change.
  getLocale: () => ipcRenderer.invoke(IPC.GetLocale) as Promise<string>,
  onLocaleChanged: (callback: (pref: string) => void) => {
    const handler = (_event: IpcRendererEvent, pref: string) => callback(pref);
    ipcRenderer.on(IPC.LocaleChanged, handler);
    return () => ipcRenderer.removeListener(IPC.LocaleChanged, handler);
  }
});

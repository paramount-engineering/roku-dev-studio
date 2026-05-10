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
  }
});

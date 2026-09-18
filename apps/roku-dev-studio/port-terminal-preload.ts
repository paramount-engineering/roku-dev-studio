/**
 * Preload for the Ports window (renderer/port-terminal.html). The window is bound to one device
 * by main (`port-terminal-window.ts` keys its state on the BrowserWindow), so the bridge never
 * carries an ip — only ports and commands.
 */
import { IPC } from './shared/ipc/channels';
import { debuggerBridge } from './shared/ipc/debugger-bridge';
import type { IpcRendererEvent } from 'electron';

const { contextBridge, ipcRenderer } = require('electron');
// `renderer/modules/utils/constants.ts` (pulled in by the debugger sidebar via ui.ts) throws at
// import time unless the preload exposed these — same subset the main preload publishes.
const sharedConstants = require('../../packages/roku-dev-studio-api/dist/lib/shared-constants.js');

contextBridge.exposeInMainWorld(
  'rdsSharedConstants',
  Object.freeze({
    DEFAULT_RALE_PORT: sharedConstants.DEFAULT_RALE_PORT,
    SCREENSHOT_DEBOUNCE_DELAY: sharedConstants.SCREENSHOT_DEBOUNCE_DELAY,
    SCREENSHOT_AFTER_LAUNCH_DELAY: sharedConstants.SCREENSHOT_AFTER_LAUNCH_DELAY,
    TELNET_TIMEOUT: sharedConstants.TELNET_TIMEOUT,
    CONNECTION_CHECK_INTERVAL: sharedConstants.CONNECTION_CHECK_INTERVAL,
    DEVICE_METRICS_SAMPLE_INTERVAL_MS: sharedConstants.DEVICE_METRICS_SAMPLE_INTERVAL_MS,
    DEVICE_METRICS_CHART_HISTORY_MS: sharedConstants.DEVICE_METRICS_CHART_HISTORY_MS,
    TOAST_DISPLAY_DURATION: sharedConstants.TOAST_DISPLAY_DURATION,
    STATUS_MESSAGE_DURATION: sharedConstants.STATUS_MESSAGE_DURATION
  })
);

function subscribe<T>(channel: string) {
  return (callback: (payload: T) => void): (() => void) => {
    const handler = (_e: IpcRendererEvent, payload: T) => callback(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
}

contextBridge.exposeInMainWorld('roku', {
  /** This window's device, the ports it can offer, and the debugger's current attach state. */
  getInfo: () => ipcRenderer.invoke(IPC.PortTerminalInfo),
  /** Text consoles (8080 / 8087). `reused: true` → an existing socket was adopted (no banner). */
  connect: (port: number) => ipcRenderer.invoke(IPC.PortTerminalConnect, { port }),
  disconnect: (port: number) => ipcRenderer.invoke(IPC.PortTerminalDisconnect, { port }),
  send: (port: number, command: string) => ipcRenderer.invoke(IPC.PortTerminalSend, { port, command }),
  /** Remote 8081 tab: lease / release the relay's debugger event stream. No-ops for local devices. */
  holdDebuggerStream: () => ipcRenderer.invoke(IPC.PortTerminalDebuggerStreamHold),
  releaseDebuggerStream: () => ipcRenderer.invoke(IPC.PortTerminalDebuggerStreamRelease),

  onTelnetSystemData: subscribe<{ ip: string; port: number; data: string; isRemote?: boolean; serverUrl?: string }>(IPC.TelnetSystemData),
  onTelnetSystemDisconnected: subscribe<{ ip: string; port: number; hadError?: boolean; serverUrl?: string }>(IPC.TelnetSystemDisconnected),
  onDebuggerWire: subscribe<Record<string, unknown>>(IPC.DebuggerWire),

  // Debugger bridge — the 8081 tab hosts the Console tab's sidebar module unchanged, so this is the
  // same method surface the main preload exposes (one definition: shared/ipc/debugger-bridge.ts).
  ...debuggerBridge(ipcRenderer),
  keypress: (ip: string, key: string) => ipcRenderer.invoke(IPC.RokuKeypress, { ip, key }),
  remoteKeypress: (serverUrl: string, ip: string, key: string) => ipcRenderer.invoke(IPC.RemoteKeypress, { serverUrl, ip, key }),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke(IPC.SettingsSet, key, value),

  // Shared aux-window plumbing: clipboard / save / crash capture / live locale.
  copyToClipboard: (text: string) => ipcRenderer.invoke(IPC.ClipboardWrite, text),
  saveTextFile: (opts: { content: string; defaultName?: string; dialogTitle?: string }) =>
    ipcRenderer.invoke(IPC.RokuSaveTextFile, opts),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.ShellOpenExternal, url),
  getSetting: (key: string) => ipcRenderer.invoke(IPC.SettingsGet, key),
  getAppInfo: () => ipcRenderer.invoke(IPC.GetAppInfo),
  getLocale: () => ipcRenderer.invoke(IPC.GetLocale) as Promise<string>,
  onLocaleChanged: subscribe<string>(IPC.LocaleChanged)
});

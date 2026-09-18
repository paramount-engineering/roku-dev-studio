/**
 * The BrightScript debugger's renderer bridge — one definition, spread into every preload that hosts
 * the debug sidebar (`preload.ts` for the main window, `port-terminal-preload.ts` for the Ports
 * window's 8081 tab). Both windows drive the SAME session in main, so the method surface must be
 * identical; keeping it here means a new debugger command is added once.
 *
 * Local methods take `ip`; remote ones take `serverUrl` first (the session runs on the relay). Push
 * events are shared by local and remote sessions (the relay tags its frames `{ isRemote, serverUrl }`).
 */
import type { IpcRenderer, IpcRendererEvent } from 'electron';
import { IPC } from './channels.js';

type StepOpts = { threadIndex?: number; stackFrameIndex?: number };
type VarOpts = StepOpts & { variablePath?: string[] };
type Location = { filePath: string; lineNumber: number };

export function debuggerBridge(ipcRenderer: IpcRenderer) {
  const subscribe = (channel: string) => (callback: (data: unknown) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
  return {
    // Local session (debug protocol, control port 8081):
    debuggerAttach: (ip: string) => ipcRenderer.invoke(IPC.DebuggerAttach, { ip }),
    debuggerDetach: (ip: string) => ipcRenderer.invoke(IPC.DebuggerDetach, { ip }),
    debuggerStatus: (ip: string) => ipcRenderer.invoke(IPC.DebuggerStatus, { ip }),
    debuggerScanStops: (ip: string) => ipcRenderer.invoke(IPC.DebuggerScanStops, { ip }),
    debuggerRestart: (ip: string, password: string) => ipcRenderer.invoke(IPC.DebuggerRestart, { ip, password }),
    debuggerContinue: (ip: string) => ipcRenderer.invoke(IPC.DebuggerContinue, { ip }),
    debuggerPause: (ip: string) => ipcRenderer.invoke(IPC.DebuggerPause, { ip }),
    debuggerStepOver: (ip: string, threadIndex?: number) => ipcRenderer.invoke(IPC.DebuggerStepOver, { ip, threadIndex }),
    debuggerStepIn: (ip: string, threadIndex?: number) => ipcRenderer.invoke(IPC.DebuggerStepIn, { ip, threadIndex }),
    debuggerStepOut: (ip: string, threadIndex?: number) => ipcRenderer.invoke(IPC.DebuggerStepOut, { ip, threadIndex }),
    debuggerStackTrace: (ip: string, threadIndex?: number) => ipcRenderer.invoke(IPC.DebuggerStackTrace, { ip, threadIndex }),
    debuggerVariables: (ip: string, opts?: VarOpts) => ipcRenderer.invoke(IPC.DebuggerVariables, { ip, ...(opts ?? {}) }),
    debuggerAddBreakpoints: (ip: string, breakpoints: unknown) => ipcRenderer.invoke(IPC.DebuggerAddBreakpoints, { ip, breakpoints }),
    debuggerRemoveBreakpointsByLocation: (ip: string, locations: Location[]) =>
      ipcRenderer.invoke(IPC.DebuggerRemoveBreakpointsByLocation, { ip, locations }),
    debuggerExecute: (ip: string, sourceCode: string, opts?: StepOpts) =>
      ipcRenderer.invoke(IPC.DebuggerExecute, { ip, sourceCode, ...(opts ?? {}) }),
    // Remote session (runs on the relay server; proxied over HTTP). No remote debuggerScanStops —
    // it reads the local sideload .zip, identical for a local or remote target.
    remoteDebuggerAttach: (serverUrl: string, ip: string) => ipcRenderer.invoke(IPC.RemoteDebuggerAttach, { serverUrl, ip }),
    remoteDebuggerDetach: (serverUrl: string, ip: string) => ipcRenderer.invoke(IPC.RemoteDebuggerDetach, { serverUrl, ip }),
    remoteDebuggerStatus: (serverUrl: string, ip: string) => ipcRenderer.invoke(IPC.RemoteDebuggerStatus, { serverUrl, ip }),
    remoteDebuggerRestart: (serverUrl: string, ip: string, password: string) =>
      ipcRenderer.invoke(IPC.RemoteDebuggerRestart, { serverUrl, ip, password }),
    remoteDebuggerContinue: (serverUrl: string, ip: string) => ipcRenderer.invoke(IPC.RemoteDebuggerContinue, { serverUrl, ip }),
    remoteDebuggerPause: (serverUrl: string, ip: string) => ipcRenderer.invoke(IPC.RemoteDebuggerPause, { serverUrl, ip }),
    remoteDebuggerStepOver: (serverUrl: string, ip: string, threadIndex?: number) =>
      ipcRenderer.invoke(IPC.RemoteDebuggerStepOver, { serverUrl, ip, threadIndex }),
    remoteDebuggerStepIn: (serverUrl: string, ip: string, threadIndex?: number) =>
      ipcRenderer.invoke(IPC.RemoteDebuggerStepIn, { serverUrl, ip, threadIndex }),
    remoteDebuggerStepOut: (serverUrl: string, ip: string, threadIndex?: number) =>
      ipcRenderer.invoke(IPC.RemoteDebuggerStepOut, { serverUrl, ip, threadIndex }),
    remoteDebuggerStackTrace: (serverUrl: string, ip: string, threadIndex?: number) =>
      ipcRenderer.invoke(IPC.RemoteDebuggerStackTrace, { serverUrl, ip, threadIndex }),
    remoteDebuggerVariables: (serverUrl: string, ip: string, opts?: VarOpts) =>
      ipcRenderer.invoke(IPC.RemoteDebuggerVariables, { serverUrl, ip, ...(opts ?? {}) }),
    remoteDebuggerAddBreakpoints: (serverUrl: string, ip: string, breakpoints: unknown) =>
      ipcRenderer.invoke(IPC.RemoteDebuggerAddBreakpoints, { serverUrl, ip, breakpoints }),
    remoteDebuggerRemoveBreakpointsByLocation: (serverUrl: string, ip: string, locations: Location[]) =>
      ipcRenderer.invoke(IPC.RemoteDebuggerRemoveBreakpointsByLocation, { serverUrl, ip, locations }),
    remoteDebuggerExecute: (serverUrl: string, ip: string, sourceCode: string, opts?: StepOpts) =>
      ipcRenderer.invoke(IPC.RemoteDebuggerExecute, { serverUrl, ip, sourceCode, ...(opts ?? {}) }),
    // Push events (each returns an unsubscribe fn); local and remote sessions share these channels.
    onDebuggerState: subscribe(IPC.DebuggerState),
    onDebuggerStopped: subscribe(IPC.DebuggerStopped),
    onDebuggerOutput: subscribe(IPC.DebuggerOutput),
    onDebuggerRuntimeError: subscribe(IPC.DebuggerRuntimeError),
    onDebuggerCompileErrors: subscribe(IPC.DebuggerCompileErrors),
    onDebuggerBreakpoints: subscribe(IPC.DebuggerBreakpoints),
    onDebuggerReattach: subscribe(IPC.DebuggerReattach),
    onDebuggerExceptionBreakpointError: subscribe(IPC.DebuggerExceptionBreakpointError)
  };
}

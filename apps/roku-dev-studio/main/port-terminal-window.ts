/**
 * Standalone window: "Ports" — one per device, opened from the Console card header. Tabs for the
 * Roku text consoles (8080 SceneGraph, 8087 Screensaver, any custom port) and the 8081 debugger
 * sidebar + protocol trace. Local devices dial raw TCP, LAN-relay devices go through the relay's
 * allowlisted routes, RCE devices through the Instance API's `/api/v0/ports/{port}` WebSocket bridge.
 *
 * Ownership rule: a console the window opens is held by the window (`holder: 'window'` into the
 * telnet-system pools in telnet-handlers.ts / remote-handlers.ts). One-shot consumers in the main
 * window (Query tab, Action Scripts, Toggle FPS) then reuse that socket and their disconnect is a
 * no-op; the window releases everything it holds when it closes. When the window isn't holding a
 * port, nothing changes for them.
 *
 * Push data (console bytes, disconnects, debugger wire/state frames) reaches every open Ports
 * window via `port-terminal-broadcast.ts`, which this module registers itself into at load.
 */
import type { BrowserWindow as ElectronBrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import { S } from '../shared/strings/index';
import { IPC } from '../shared/ipc/channels';
import { setupZoomGuards } from './window-zoom';
import { registerPortTerminalSink } from './port-terminal-broadcast';
import {
  RESERVED_CONSOLE_PORTS,
  SYSTEM_TELNET_PORTS,
  connectSystemTelnet,
  disconnectSystemTelnet,
  normalizeSystemTelnetPort,
  sendSystemTelnet,
  type SystemTelnetConnectResult
} from './ipc/telnet-handlers';
import {
  RCE_TUNNEL_EPHEMERAL_RANGE,
  RCE_TUNNEL_FIXED_PORTS,
  connectRceSystemTelnet,
  disconnectRceSystemTelnet,
  isRcePortAllowed,
  sendRceSystemTelnet
} from './ipc/rce-handlers';
import { resolveRceInstanceBySerial } from './rce-device-registry';
import {
  connectRemoteSystemTelnet,
  disconnectRemoteSystemTelnet,
  holdRemoteDebuggerStream,
  releaseRemoteDebuggerStream,
  sendRemoteSystemTelnet
} from './ipc/remote-handlers';
import { getDebugSessionController } from './ipc/debugger-handlers';
import { isSafeRelayUrl, remoteHttpRequest } from './remote-http';
import { mainError, mainLog } from './log.js';

const fs = require('fs');
const path = require('path');
const { BrowserWindow, screen } = require('electron') as typeof import('electron');

const DEBUG_PROTOCOL_PORT = 8081;

export interface PortTerminalDevice {
  /** Device IP — or, for an RCE device, its serial (the app's RCE identity convention). */
  ip: string;
  kind?: 'local' | 'remote' | 'rce';
  /** LAN relay URL for remote devices; null/undefined for local. */
  serverUrl?: string | null;
  /** RCE account the device belongs to (kind 'rce'). */
  accountName?: string;
  /** Friendly name for the title bar (device name / model). */
  name?: string;
  /** Keys the 8081 tab's persisted breakpoints/watches like the Console tab (deviceKey → serial). */
  serialNumber?: string;
  /** Relay location name, for the header's "via …" hint. */
  locationName?: string;
  /** False when a remote server reports `capabilities.debugger === false` — 8081 is hidden. */
  debuggerSupported?: boolean;
}

type WindowState = {
  device: PortTerminalDevice;
  /** Text-console ports this window currently holds (released on close). */
  heldPorts: Set<number>;
  /** Remote only: this window leases the server's debugger SSE stream while its 8081 tab is open. */
  holdsDebuggerStream: boolean;
};

const windowsByDeviceKey = new Map<string, ElectronBrowserWindow>();
const stateByWindowId = new Map<number, WindowState>();

function deviceKey(device: PortTerminalDevice): string {
  return `${device.kind === 'rce' ? `rce:${device.accountName || ''}` : device.serverUrl || 'local'}|${device.ip}`;
}

/** The port a window may open on its device, or null: local and relay devices are limited to the
 *  fixed console ports (8080 / 8087), RCE to what the Instance API tunnels minus the ports that
 *  already have their own tab. */
function allowedPort(device: PortTerminalDevice, port: unknown): number | null {
  if (device.kind === 'rce') return isRcePortAllowed(port) && !RESERVED_CONSOLE_PORTS.includes(port) ? port : null;
  return normalizeSystemTelnetPort(port);
}

function deviceLabel(device: PortTerminalDevice): string {
  return device.name?.trim() || device.ip;
}

function debuggerStreamHolder(windowId: number): string {
  return `port-terminal:${windowId}`;
}

export function broadcastToPortTerminalWindows(channel: string, payload: unknown): void {
  if (windowsByDeviceKey.size === 0) return;
  for (const win of windowsByDeviceKey.values()) {
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel, payload);
  }
}
registerPortTerminalSink(broadcastToPortTerminalWindows, () => windowsByDeviceKey.size > 0);

/** Open the Ports window for `device`, or focus the one already open for it. */
export function openPortTerminalWindow(device: PortTerminalDevice, parent?: ElectronBrowserWindow | null): void {
  if (!device || typeof device.ip !== 'string' || !device.ip.trim()) return;
  if (device.serverUrl && !isSafeRelayUrl(device.serverUrl)) return;
  const key = deviceKey(device);
  const existing = windowsByDeviceKey.get(key);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return;
  }

  const preloadPath = path.join(__dirname, 'port-terminal-preload.bundled.cjs');
  const htmlPath = path.join(__dirname, 'renderer', 'port-terminal.html');
  if (!fs.existsSync(preloadPath)) {
    mainError('[Ports] Preload bundle missing at', preloadPath, '— run build.');
    return;
  }
  if (!fs.existsSync(htmlPath)) {
    mainError('[Ports] HTML shell missing at', htmlPath);
    return;
  }

  const child = new BrowserWindow({
    width: 980,
    height: 660,
    minWidth: 640,
    minHeight: 400,
    title: S.portTerminal.windowTitle(deviceLabel(device)),
    backgroundColor: '#0a0a12',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  windowsByDeviceKey.set(key, child);
  stateByWindowId.set(child.id, { device: { ...device }, heldPorts: new Set(), holdsDebuggerStream: false });
  setupZoomGuards(child);

  child.once('ready-to-show', () => {
    // Center on the parent's display (clamped to its work area) — no `parent:` option, a child
    // window mis-stacks across displays (see log-file-viewer-window.ts).
    if (parent && !parent.isDestroyed()) {
      try {
        const pb = parent.getBounds();
        const [w, h] = child.getSize();
        const { workArea } = screen.getDisplayMatching(pb);
        const x = Math.min(Math.max(workArea.x, Math.round(pb.x + (pb.width - w) / 2)), workArea.x + workArea.width - w);
        const y = Math.min(Math.max(workArea.y, Math.round(pb.y + (pb.height - h) / 2)), workArea.y + workArea.height - h);
        child.setPosition(x, y);
      } catch {
        /* keep OS default placement */
      }
    }
    child.show();
  });

  child.once('closed', () => {
    const st = stateByWindowId.get(child.id);
    stateByWindowId.delete(child.id);
    if (windowsByDeviceKey.get(key) === child) windowsByDeviceKey.delete(key);
    if (!st) return;
    // Release everything this window held — the one-shot consumers go back to open/close per use.
    for (const port of st.heldPorts) {
      void releaseConsole(st, port).catch((e: unknown) => mainLog('[Ports] release on close failed:', port, e));
    }
    if (st.holdsDebuggerStream && st.device.serverUrl) {
      releaseRemoteDebuggerStream(st.device.serverUrl, debuggerStreamHolder(child.id));
    }
  });

  child.webContents.on('preload-error', (_e: unknown, failedPath: string, error: Error) => {
    mainError('[Ports] Preload failed:', failedPath, error);
  });

  void child.loadFile(htmlPath).catch((err: unknown) => {
    mainError('[Ports] loadFile failed:', err);
    if (!child.isDestroyed()) child.close();
  });
}

async function openConsole(st: WindowState, port: number): Promise<SystemTelnetConnectResult> {
  const { ip, serverUrl, kind } = st.device;
  if (kind === 'rce') {
    // Resolved fresh every time: an instance's API URL changes on every boot (rce-device-registry).
    const live = await resolveRceInstanceBySerial(ip);
    if (!live.success) return { success: false, error: live.error };
    return connectRceSystemTelnet({ instanceApiUrl: live.instance.instanceApiUrl, token: live.instance.token, ip, port, holder: 'window' });
  }
  return serverUrl
    ? connectRemoteSystemTelnet(serverUrl, ip, port, 'window')
    : connectSystemTelnet(ip, port, 'window');
}

function releaseConsole(st: WindowState, port: number): Promise<{ success: true; held?: boolean }> {
  const { ip, serverUrl, kind } = st.device;
  st.heldPorts.delete(port);
  if (kind === 'rce') return disconnectRceSystemTelnet(ip, port, 'window');
  return serverUrl
    ? disconnectRemoteSystemTelnet(serverUrl, ip, port, 'window')
    : disconnectSystemTelnet(ip, port, 'window');
}

function sendConsole(st: WindowState, port: number, command: string): Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string } {
  const { ip, serverUrl, kind } = st.device;
  if (kind === 'rce') return sendRceSystemTelnet(ip, port, command);
  return serverUrl ? sendRemoteSystemTelnet(serverUrl, ip, port, command) : sendSystemTelnet(ip, port, command);
}

/** What the picker's "Custom Port" card may accept — RCE only: the Instance API tunnels a known set
 *  of extra ports (9999, the ephemeral range). Local and relay devices offer the fixed ports only. */
function customPortRule(device: PortTerminalDevice): { reserved: number[]; rceFixed: number[]; rceRange: [number, number] } | null {
  if (device.kind !== 'rce') return null;
  return {
    reserved: [...RESERVED_CONSOLE_PORTS],
    rceFixed: RCE_TUNNEL_FIXED_PORTS.filter((p) => !RESERVED_CONSOLE_PORTS.includes(p)),
    rceRange: [RCE_TUNNEL_EPHEMERAL_RANGE[0], RCE_TUNNEL_EPHEMERAL_RANGE[1]]
  };
}

/** Ports this device can offer. Local and RCE: all three. Remote: what the relay's `/capabilities`
 *  advertises — `telnetSystemPorts` (absent on older servers → 8080 only) and `debugger`. */
async function availablePorts(device: PortTerminalDevice): Promise<number[]> {
  if (device.kind === 'rce' || !device.serverUrl) return [...SYSTEM_TELNET_PORTS, DEBUG_PROTOCOL_PORT].sort((a, b) => a - b);
  const ports = new Set<number>([8080]);
  let debuggerOk = device.debuggerSupported !== false;
  try {
    const r = await remoteHttpRequest(device.serverUrl, '/capabilities', 'GET', null, 8000);
    const caps = (r && r.success && r.capabilities) as Record<string, unknown> | undefined;
    if (caps) {
      const list = caps['telnetSystemPorts'];
      if (Array.isArray(list)) {
        for (const p of list) if (typeof p === 'number' && SYSTEM_TELNET_PORTS.includes(p)) ports.add(p);
      }
      if (caps['debugger'] === false) debuggerOk = false;
    }
  } catch {
    /* unreachable relay → 8080 only; the connect itself will surface the real error */
  }
  if (debuggerOk) ports.add(DEBUG_PROTOCOL_PORT);
  return [...ports].sort((a, b) => a - b);
}

/** Current attach state of the device's 8081 session, so the tab is right before any push arrives. */
async function debuggerState(device: PortTerminalDevice): Promise<string> {
  try {
    if (!device.serverUrl) return getDebugSessionController().status(device.ip).state;
    const r = await remoteHttpRequest(device.serverUrl, `/device/${encodeURIComponent(device.ip)}/debugger/status`, 'GET', null, 8000);
    const state = r && r.success && r.data && (r.data as { state?: unknown }).state;
    return typeof state === 'string' ? state : 'disconnected';
  } catch {
    return 'disconnected';
  }
}

let ipcRegistered = false;

export function registerPortTerminalIpc(ipcMain: IpcMain, getMainWindow: () => ElectronBrowserWindow | null): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  const stateFor = (event: IpcMainInvokeEvent): WindowState | undefined => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? stateByWindowId.get(win.id) : undefined;
  };

  ipcMain.handle(IPC.PortTerminalOpen, async (_event: IpcMainInvokeEvent, device: PortTerminalDevice) => {
    openPortTerminalWindow(device, getMainWindow());
    return { success: true };
  });

  ipcMain.handle(IPC.PortTerminalInfo, async (event: IpcMainInvokeEvent) => {
    const st = stateFor(event);
    if (!st) return { success: false, error: 'Not a Ports window' };
    const [ports, dbg] = await Promise.all([availablePorts(st.device), debuggerState(st.device)]);
    return { success: true, device: st.device, ports, debuggerState: dbg, debugProtocolPort: DEBUG_PROTOCOL_PORT, custom: customPortRule(st.device) };
  });

  ipcMain.handle(IPC.PortTerminalConnect, async (event: IpcMainInvokeEvent, { port }: { port: number }) => {
    const st = stateFor(event);
    if (!st) return { success: false, error: 'Not a Ports window' };
    const p = allowedPort(st.device, port);
    if (p === null) return { success: false, error: 'Unsupported port' };
    const res = await openConsole(st, p);
    if (res.success) st.heldPorts.add(p);
    return res;
  });

  ipcMain.handle(IPC.PortTerminalDisconnect, async (event: IpcMainInvokeEvent, { port }: { port: number }) => {
    const st = stateFor(event);
    if (!st) return { success: false, error: 'Not a Ports window' };
    const p = allowedPort(st.device, port);
    if (p === null) return { success: false, error: 'Unsupported port' };
    return releaseConsole(st, p);
  });

  ipcMain.handle(IPC.PortTerminalSend, async (event: IpcMainInvokeEvent, { port, command }: { port: number; command: string }) => {
    const st = stateFor(event);
    if (!st) return { success: false, error: 'Not a Ports window' };
    const p = allowedPort(st.device, port);
    if (p === null) return { success: false, error: 'Unsupported port' };
    if (typeof command !== 'string') return { success: false, error: 'Missing command' };
    return sendConsole(st, p, command);
  });

  // Remote 8081 tab: lease the server-wide debugger SSE stream so wire frames flow even when no
  // device panel for that server is open. Local sessions push straight from debugger-handlers.
  ipcMain.handle(IPC.PortTerminalDebuggerStreamHold, async (event: IpcMainInvokeEvent) => {
    const st = stateFor(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!st || !win) return { success: false, error: 'Not a Ports window' };
    if (!st.device.serverUrl) return { success: true };
    const res = holdRemoteDebuggerStream(st.device.serverUrl, debuggerStreamHolder(win.id));
    if (res.success) st.holdsDebuggerStream = true;
    return res;
  });

  ipcMain.handle(IPC.PortTerminalDebuggerStreamRelease, async (event: IpcMainInvokeEvent) => {
    const st = stateFor(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!st || !win) return { success: false, error: 'Not a Ports window' };
    if (st.device.serverUrl && st.holdsDebuggerStream) {
      releaseRemoteDebuggerStream(st.device.serverUrl, debuggerStreamHolder(win.id));
    }
    st.holdsDebuggerStream = false;
    return { success: true };
  });
}

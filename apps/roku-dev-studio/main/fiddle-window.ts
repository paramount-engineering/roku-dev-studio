/**
 * Standalone window: BrightScript Fiddle — editor + terminal, sideload a wrapped
 * SceneGraph channel to a selected (local or remote) Roku device and stream output.
 */

import type { BrowserWindow as ElectronBrowserWindow, IpcMain, WebContents } from 'electron';
import { IPC } from '../shared/ipc/channels';
import { setupZoomGuards } from './window-zoom';

const fs = require('fs');
const path = require('path');
const { BrowserWindow, screen } = require('electron') as typeof import('electron');

export interface FiddleDeviceSnapshotEntry {
  id: string;
  ip: string;
  name: string;
  modelName?: string;
  isRemote: boolean;
  serverUrl?: string | null;
  /** Optional developer password (retrieved from renderer-side storage). */
  password?: string;
}

type FiddleWindowState = {
  devices: FiddleDeviceSnapshotEntry[];
  initialDeviceId: string | null;
  /** Set to the device id that currently has our Fiddle channel sideloaded
   * (cleared on Stop / successful deleteSideload). Used by the window-close
   * handler to auto-delete the channel when the user closes the Fiddle window. */
  activeFiddleDeviceId: string | null;
  /** The password that produced the current active sideload. Held in-memory for
   * the lifetime of this Fiddle window so window-close cleanup can delete the
   * channel even when the snapshot's persisted password is empty (i.e. the
   * user ran Fiddle with a session-only modal-entered password). Cleared when
   * `activeFiddleDeviceId` is cleared. */
  activeFiddlePassword: string | null;
};

const fiddleWindowsById = new Map<number, ElectronBrowserWindow>();
const fiddleStateByWindowId = new Map<number, FiddleWindowState>();

let fiddleIpcRegistered = false;
/** Set by `registerFiddleIpc`. `bs-fiddle-handlers.ts` uses it to message the
 * main renderer when a Fiddle auth failure needs to clear a persisted
 * developer password. Lazy-resolved because the main `webContents` may be
 * gone (or not yet open) when bs-fiddle-handlers wants to fire. */
let getMainWebContentsRef: (() => WebContents | null) | null = null;

/**
 * Called from main.ts to register IPC handlers once.
 * Also supplies a callback for talking to the main (device-owning) renderer.
 */
export function registerFiddleIpc(ipcMain: IpcMain, getMainWebContents: () => WebContents | null): void {
  if (fiddleIpcRegistered) return;
  fiddleIpcRegistered = true;

  getMainWebContentsRef = getMainWebContents;

  // The main renderer pushes the current device snapshot here (at open and on changes).
  ipcMain.on(IPC.FiddlePushDevices, (event, payload: { devices: FiddleDeviceSnapshotEntry[] }) => {
    const devices = Array.isArray(payload?.devices) ? payload.devices : [];
    for (const [winId, state] of fiddleStateByWindowId) {
      state.devices = devices;
      const win = fiddleWindowsById.get(winId);
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.FiddleDevicesUpdate, { devices });
      }
    }
  });

  // Fiddle window asks for fresh devices.
  ipcMain.on(IPC.FiddleRefreshDevices, () => {
    const mainWc = getMainWebContents();
    if (mainWc && !mainWc.isDestroyed()) {
      mainWc.send(IPC.FiddleRefreshDevices);
    }
  });

  // Main renderer pushes scan status — forward to every open Fiddle window.
  ipcMain.on(IPC.FiddleScanStatus, (_event, payload: { scanning?: boolean }) => {
    const scanning = !!payload?.scanning;
    for (const [, win] of fiddleWindowsById) {
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.FiddleScanStatus, { scanning });
      }
    }
  });

  // Fiddle window signals it's ready to receive init data.
  ipcMain.on(IPC.FiddleReady, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    const state = fiddleStateByWindowId.get(win.id);
    if (!state) return;
    win.webContents.send(IPC.FiddleInit, {
      devices: state.devices,
      initialDeviceId: state.initialDeviceId
    });
  });
}

export function getFiddleStateByWindow(winId: number): FiddleWindowState | null {
  return fiddleStateByWindowId.get(winId) || null;
}

export function openFiddleWindow(
  parent: ElectronBrowserWindow | undefined,
  devicesSnapshot: FiddleDeviceSnapshotEntry[],
  initialDeviceId?: string | null
): void {
  const preloadPath = path.join(__dirname, 'fiddle-preload.bundled.cjs');
  const htmlPath = path.join(__dirname, 'renderer', 'fiddle.html');

  if (!fs.existsSync(preloadPath)) {
    console.error('[Fiddle] Preload bundle missing at', preloadPath, '— run build.');
    return;
  }
  if (!fs.existsSync(htmlPath)) {
    console.error('[Fiddle] HTML shell missing at', htmlPath);
    return;
  }

  const child = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 820,
    minHeight: 520,
    title: 'BrightScript Fiddle',
    backgroundColor: '#0a0a12',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  fiddleWindowsById.set(child.id, child);
  fiddleStateByWindowId.set(child.id, {
    devices: Array.isArray(devicesSnapshot) ? devicesSnapshot : [],
    initialDeviceId: initialDeviceId || null,
    activeFiddleDeviceId: null,
    activeFiddlePassword: null
  });

  // Same zoom band + pinch-zoom guard as the main window so View > Zoom and
  // Ctrl+wheel both clamp to the configured min/max factor.
  setupZoomGuards(child);

  child.once('closed', () => {
    // Pull the snapshot out BEFORE we delete so the close cleanup (which may
    // run async) still has the device details it needs to verify + delete.
    const state = fiddleStateByWindowId.get(child.id);
    const activeId = state?.activeFiddleDeviceId || null;
    const matchingDevice = activeId && state
      ? state.devices.find((d) => d.id === activeId)
      : undefined;
    // Prefer the password that produced the current sideload (session-scoped)
    // so cleanup works even when the persisted password on the snapshot is
    // empty (modal-entered password, never saved to localStorage).
    const activePassword = state?.activeFiddlePassword || null;

    fiddleWindowsById.delete(child.id);
    fiddleStateByWindowId.delete(child.id);

    if (activeId && fiddleCloseCleanup) {
      try {
        void Promise.resolve(
          fiddleCloseCleanup({ deviceId: activeId, device: matchingDevice, password: activePassword })
        ).catch((err) => console.warn('[Fiddle] window-close cleanup failed:', err));
      } catch (err) {
        console.warn('[Fiddle] window-close cleanup threw:', err);
      }
    }
  });

  child.once('ready-to-show', () => {
    if (parent && !parent.isDestroyed()) {
      try {
        const pb = parent.getBounds();
        const [w, h] = child.getSize();
        const { workArea } = screen.getDisplayMatching(pb);
        let x = Math.round(pb.x + (pb.width - w) / 2);
        let y = Math.round(pb.y + (pb.height - h) / 2);
        const maxX = workArea.x + workArea.width - w;
        const maxY = workArea.y + workArea.height - h;
        x = Math.min(Math.max(workArea.x, x), maxX);
        y = Math.min(Math.max(workArea.y, y), maxY);
        child.setPosition(x, y);
      } catch {
        /* keep OS default placement */
      }
    }
    child.show();
  });

  child.webContents.on('preload-error', (_e: unknown, failedPath: string, error: Error) => {
    console.error('[Fiddle] Preload failed:', failedPath, error);
  });

  void child.loadFile(htmlPath).catch((err: unknown) => {
    console.error('[Fiddle] loadFile failed:', err);
    fiddleWindowsById.delete(child.id);
    fiddleStateByWindowId.delete(child.id);
    if (!child.isDestroyed()) child.close();
  });
}

/**
 * Fan-out every telnet data chunk the main process sees to every open Fiddle
 * window. Filtering/gating is owned entirely by the Fiddle renderer, which
 * filters by its currently-selected device's IP and suppresses data until
 * its run-specific `[FIDDLE_BEGIN:…]` marker arrives. This function just
 * delivers the bytes.
 */
export function broadcastFiddleTerminalData(ip: string, data: string, isRemote: boolean): void {
  if (fiddleWindowsById.size === 0) return;
  for (const win of fiddleWindowsById.values()) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.FiddleTerminalData, { ip, data, isRemote });
    }
  }
}

/** Record / clear the device + password that currently have our Fiddle channel
 * sideloaded. Pass `null` for both on Stop / successful delete to drop the
 * in-memory password along with the active marker. */
export function setFiddleActiveSideload(
  winId: number,
  deviceId: string | null,
  password: string | null
): void {
  const state = fiddleStateByWindowId.get(winId);
  if (!state) return;
  state.activeFiddleDeviceId = deviceId;
  state.activeFiddlePassword = deviceId ? password : null;
}

/**
 * Callback invoked when a Fiddle window closes *with* an active sideload, so
 * the handler module can verify-and-delete the channel. Registered once by
 * `bs-fiddle-handlers.ts` via `onFiddleWindowClosed` below. `password` is the
 * session-scoped password that produced the sideload (may be `null` if the
 * window was never able to capture it).
 */
type FiddleCloseCleanup = (snapshot: {
  deviceId: string;
  device: FiddleDeviceSnapshotEntry | undefined;
  password: string | null;
}) => void | Promise<void>;
let fiddleCloseCleanup: FiddleCloseCleanup | null = null;

export function onFiddleWindowClosed(cb: FiddleCloseCleanup): void {
  fiddleCloseCleanup = cb;
}

/**
 * Push the current Privacy Mode state to every open Fiddle window. Called from
 * `main.ts` whenever the user toggles Privacy Mode (File menu or Settings
 * window) so each Fiddle window can blur / mask IPs in lockstep with the main
 * window. Newly-opened Fiddle windows pull the same state on their own via
 * `getPrivacyMode()` (handled by the standard system IPC handler).
 */
export function broadcastFiddlePrivacyMode(enabled: boolean): void {
  if (fiddleWindowsById.size === 0) return;
  for (const win of fiddleWindowsById.values()) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.PrivacyModeChanged, !!enabled);
    }
  }
}

/** Tell any listening fiddle window to clear its terminal buffer. */
export function broadcastFiddleTerminalCleared(winId: number): void {
  const win = fiddleWindowsById.get(winId);
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.FiddleTerminalCleared, {});
  }
}

/**
 * Ask the main renderer to wipe the persisted developer password for `deviceId`.
 * Fire-and-forget: used by Fiddle's auth-fail path to invalidate stored creds
 * that no longer match the device. Silently no-ops if the main renderer isn't
 * available (e.g. app shutting down).
 */
export function requestMainRendererClearPassword(deviceId: string): void {
  if (!deviceId || !getMainWebContentsRef) return;
  const mainWc = getMainWebContentsRef();
  if (!mainWc || mainWc.isDestroyed()) return;
  mainWc.send(IPC.FiddleClearPasswordRequest, { deviceId });
}

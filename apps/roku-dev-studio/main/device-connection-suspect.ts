/**
 * Fans out a "this device IP just failed at the connection level" hint to every open window,
 * so the renderer can re-run its real reachability probe (`checkDeviceConnection`) immediately
 * instead of waiting for the next scheduled poll. This module is NOT the source of truth for
 * "is the device offline" — it only decides *when* to ask; the renderer's own ECP probe still
 * decides the answer. See `IPC.DeviceConnectionSuspect` in `shared/ipc/channels.ts`.
 *
 * Debounced per IP: several call sites (a failed ECP query, a dropped Telnet socket, …) can all
 * notice the same outage within milliseconds of each other. Without debouncing, each one would
 * trigger its own immediate re-check, hammering a device that's already known-suspect.
 */

import { IPC } from '../shared/ipc/channels';

const { BrowserWindow } = require('electron') as typeof import('electron');

const DEBOUNCE_MS = 2000;
const lastNotifiedAtMs = new Map<string, number>();

export function notifyDeviceConnectionSuspect(ip: string): void {
  const now = Date.now();
  const last = lastNotifiedAtMs.get(ip);
  if (last != null && now - last < DEBOUNCE_MS) return;
  lastNotifiedAtMs.set(ip, now);

  for (const win of BrowserWindow.getAllWindows()) {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(IPC.DeviceConnectionSuspect, { ip });
    }
  }
}

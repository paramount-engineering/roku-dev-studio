/**
 * Live video preview (Janus/WebRTC signaling) for RCE devices — design doc §7.
 *
 * Signaling (the Janus WebSocket) runs here in the main process because the handshake requires an
 * `Authorization: Bearer` header, which a renderer/browser `WebSocket` can't set — see
 * `RceVideoSignalingClient`'s own header for the full story (ported from, and live-verified
 * 2026-09-12 against, the RokuCommunity reference implementation). The actual `RTCPeerConnection`
 * lives in the renderer (Chromium has one natively); these handlers just relay the SDP offer down
 * and the answer/ICE candidates back up over IPC.
 *
 * One session per device (keyed by `name:deviceId`). Reconnect uses the reference
 * implementation's backoff schedule; a stop from a still-running device is a genuine failure
 * (broadcast as an error), while one from a device that's no longer running is broadcast as a
 * neutral "stopped" status, not an error — checked with a fresh `getDevice` before each retry
 * rather than assuming from the last-known status.
 *
 * Deliberately simpler than design doc §7's full spec in one respect: the "quick-drop" detection
 * (3 consecutive sub-30s drops ⇒ surface a hard error) needs the renderer to report ICE/media
 * failures back to main, which isn't wired — the renderer has no way to distinguish "blocked TURN"
 * from any other disconnect yet. Retrying indefinitely on the backoff schedule (until an explicit
 * Stop or a confirmed-stopped device) is safe without it, just less precise about *why* a stream
 * keeps failing; add the renderer→main failure report if that distinction turns out to matter.
 */

import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import { RceManagementClient, RceVideoSignalingClient } from 'roku-dev-studio-rce';
import type { RceVideoJsep } from 'roku-dev-studio-rce';
import { getRceAccountToken as getAccountToken } from '../rce-account-store';

const { mainWarn } = require('../log');

/** Reference implementation's schedule — 5 steps then hold at the last value. */
const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];

type VideoStatus = 'connecting' | 'reconnecting' | 'stopped' | 'error';

interface VideoSession {
  name: string;
  deviceId: number;
  client: RceVideoSignalingClient | null;
  /** True once the user (or a confirmed-stopped device) ends the session — suppresses reconnect. */
  stopped: boolean;
  retryIndex: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
}

function sessionKey(name: string, deviceId: number): string {
  return `${name}:${deviceId}`;
}

export function setupRceVideoHandlers(): void {
  const { ipcMain } = require('electron') as typeof import('electron');

  const sessions = new Map<string, VideoSession>();

  function broadcastStatus(name: string, deviceId: number, status: VideoStatus, error?: string): void {
    broadcastToAllWindows(IPC.RceVideoStatus, { name, deviceId, status, error });
  }

  function clearRetryTimer(session: VideoSession): void {
    if (session.retryTimer) {
      clearTimeout(session.retryTimer);
      session.retryTimer = null;
    }
  }

  async function startSession(session: VideoSession): Promise<void> {
    const token = getAccountToken(session.name);
    if (!token) {
      broadcastStatus(session.name, session.deviceId, 'error', 'No stored RCE account for this device.');
      return;
    }

    broadcastStatus(session.name, session.deviceId, session.retryIndex > 0 ? 'reconnecting' : 'connecting');

    const client = new RceManagementClient(token);
    const result = await client.getDevice(session.deviceId);
    if (session.stopped) return; // Stop() ran while the device fetch was in flight.
    if (!result.success || result.device.status !== 'running' || !result.device.runningDevice?.instanceApiUrl) {
      // The device itself is gone, not just this stream — a neutral end, not an error.
      session.stopped = true;
      broadcastStatus(session.name, session.deviceId, 'stopped');
      return;
    }
    const rd = result.device.runningDevice;

    const signalingClient = new RceVideoSignalingClient({
      websocketUrl: rd.janusWebsocketUrl!,
      streamId: rd.janusId!,
      pin: rd.janusPin,
      janusToken: rd.janusToken,
      apiToken: token,
      iceServers: rd.janusIceServers
    });
    session.client = signalingClient;

    signalingClient.on('error', (error: Error) => {
      mainWarn(`[rce-video] signaling error for ${session.name}:${session.deviceId}:`, error.message);
    });
    signalingClient.on('close', () => {
      if (session.stopped || session.client !== signalingClient) return; // superseded or user-stopped
      session.client = null;
      scheduleReconnect(session);
    });

    try {
      const { offer, iceServers } = await signalingClient.connect();
      if (session.stopped || session.client !== signalingClient) return;
      session.retryIndex = 0;
      broadcastToAllWindows(IPC.RceVideoOffer, { name: session.name, deviceId: session.deviceId, offer, iceServers });
    } catch (error: unknown) {
      if (session.stopped) return;
      session.client = null;
      scheduleReconnect(session);
    }
  }

  function scheduleReconnect(session: VideoSession): void {
    clearRetryTimer(session);
    broadcastStatus(session.name, session.deviceId, 'reconnecting');
    const delay = RECONNECT_BACKOFF_MS[Math.min(session.retryIndex, RECONNECT_BACKOFF_MS.length - 1)];
    session.retryIndex += 1;
    session.retryTimer = setTimeout(() => {
      session.retryTimer = null;
      if (!session.stopped) void startSession(session);
    }, delay);
  }

  function stopSession(session: VideoSession): void {
    session.stopped = true;
    clearRetryTimer(session);
    session.client?.stop();
    session.client = null;
  }

  ipcMain.handle(IPC.RceVideoStart, async (_e: IpcMainInvokeEvent, { name, deviceId }: { name: string; deviceId: number }) => {
    const key = sessionKey(name, deviceId);
    const existing = sessions.get(key);
    if (existing) stopSession(existing);
    const session: VideoSession = { name, deviceId, client: null, stopped: false, retryIndex: 0, retryTimer: null };
    sessions.set(key, session);
    void startSession(session);
    return { success: true };
  });

  ipcMain.handle(IPC.RceVideoStop, async (_e: IpcMainInvokeEvent, { name, deviceId }: { name: string; deviceId: number }) => {
    const key = sessionKey(name, deviceId);
    const session = sessions.get(key);
    if (session) {
      stopSession(session);
      sessions.delete(key);
    }
    return { success: true };
  });

  ipcMain.handle(
    IPC.RceVideoAnswer,
    async (_e: IpcMainInvokeEvent, { name, deviceId, answer }: { name: string; deviceId: number; answer: RceVideoJsep }) => {
      const session = sessions.get(sessionKey(name, deviceId));
      if (!session?.client) return { success: false, error: 'No active video session for this device.' };
      try {
        await session.client.sendAnswer(answer);
        return { success: true };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC.RceVideoCandidate,
    async (_e: IpcMainInvokeEvent, { name, deviceId, candidate }: { name: string; deviceId: number; candidate: unknown }) => {
      sessions.get(sessionKey(name, deviceId))?.client?.sendCandidate(candidate);
      return { success: true };
    }
  );

  ipcMain.handle(IPC.RceVideoCandidatesComplete, async (_e: IpcMainInvokeEvent, { name, deviceId }: { name: string; deviceId: number }) => {
    sessions.get(sessionKey(name, deviceId))?.client?.sendCandidatesComplete();
    return { success: true };
  });
}

/** Send `payload` on `channel` to every open window, skipping any that are destroyed. Mirrors
 *  `rce-handlers.ts`'s identical helper — small enough that sharing it isn't worth the coupling. */
function broadcastToAllWindows(channel: string, payload: unknown): void {
  const { BrowserWindow } = require('electron') as typeof import('electron');
  for (const win of BrowserWindow.getAllWindows()) {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

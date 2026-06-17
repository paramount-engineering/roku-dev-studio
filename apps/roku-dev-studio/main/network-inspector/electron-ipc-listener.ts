import { IPC } from '../../shared/ipc/channels';
import type { NetworkInspectorListener } from '../../shared/network-inspector/types';

type SafeSendFn = (channel: string, data: unknown) => void;

/**
 * Electron adapter: maps the engine's transport-agnostic {@link NetworkInspectorListener} events
 * onto the renderer IPC channels. This is the *only* place that couples the Network Inspector to
 * Electron IPC channel names — the engine itself knows nothing about them, which is what lets the
 * same engine run on the headless remote server behind an HTTP/SSE adapter instead.
 */
export function createElectronIpcListener(safeSend: SafeSendFn): NetworkInspectorListener {
  return {
    onEvents: (batch) => safeSend(IPC.NetworkInspectorCaptureEvents, batch),
    onStatus: (status) => safeSend(IPC.NetworkInspectorStatus, status),
    onDeviceJoined: (payload) => safeSend(IPC.NetworkInspectorDeviceJoined, payload),
    onDeviceLeft: (payload) => safeSend(IPC.NetworkInspectorDeviceLeft, payload),
    onDeviceDiscovered: (device) => safeSend(IPC.NetworkInspectorDeviceDiscovered, device),
    onClientsCleared: () => safeSend(IPC.NetworkInspectorClientsCleared, {})
  };
}

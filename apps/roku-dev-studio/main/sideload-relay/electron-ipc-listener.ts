import { IPC } from '../../shared/ipc/channels';
import type { RelayListener } from '../../shared/sideload-relay/types';

type SafeSendFn = (channel: string, data: unknown) => void;

/**
 * Electron adapter: maps the relay service's transport-agnostic
 * {@link RelayListener} events onto renderer IPC channels. The service itself
 * knows nothing about IPC channel names, mirroring the Network Inspector split.
 */
export function createRelayIpcListener(safeSend: SafeSendFn): RelayListener {
  return {
    onStatus: (status) => safeSend(IPC.SideloadRelayStatus, status),
    onRunStarted: (run) => safeSend(IPC.SideloadRelayRunStarted, run),
    onDeviceResult: (result) => safeSend(IPC.SideloadRelayResult, result)
  };
}

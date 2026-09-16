/**
 * Stable identity for 8085 debug-telnet IPC events.
 *
 * Local main uses `connectionId === ip`. Remote relay streams use
 * `connectionId === `${serverUrl}:${ip}`` so two labs with the same private
 * IP (or a local tab and a remote tab at the same address) do not cross-
 * deliver log chunks.
 */

export type DebugTelnetDeviceRef = {
  ip: string;
  isRemote?: boolean;
  serverUrl?: string | null;
};

export function debugTelnetConnectionId(device: DebugTelnetDeviceRef): string {
  if (device.isRemote && device.serverUrl) {
    return `${device.serverUrl}:${device.ip}`;
  }
  return device.ip;
}

export type DebugTelnetIpcPayload = {
  connectionId?: string;
  ip?: string;
  isRemote?: boolean;
};

/**
 * True when a DEBUGGER push event (`DebuggerState` / `DebuggerOutput` / …, shape
 * `{ ip?, isRemote?, serverUrl? }`) belongs to this device tab. Origin is "remote" only when the
 * tab has a server URL: an RCE tab is `isRemote: true` with NO serverUrl, but its debug session
 * runs in the LOCAL controller, whose events carry no origin tag — treating RCE as remote here is
 * what made the Console drop every debugger output line for RCE devices.
 */
export function debugEventTargetsDevice(
  event: { ip?: string; isRemote?: boolean; serverUrl?: string | null },
  device: DebugTelnetDeviceRef
): boolean {
  if (event.ip && event.ip !== device.ip) return false;
  const remote = !!(device.isRemote && device.serverUrl);
  return !!event.isRemote === remote && (!remote || event.serverUrl === device.serverUrl);
}

/** True when a main-process telnet IPC payload belongs to this device tab. */
export function debugTelnetIpcTargetsDevice(
  payload: DebugTelnetIpcPayload,
  device: DebugTelnetDeviceRef
): boolean {
  const expected = debugTelnetConnectionId(device);
  if (typeof payload.connectionId === 'string') {
    return payload.connectionId === expected;
  }
  // Legacy fallback (payloads without connectionId): local IP match only.
  return !device.isRemote && payload.ip === device.ip;
}

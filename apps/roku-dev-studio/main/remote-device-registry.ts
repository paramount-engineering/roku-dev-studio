/**
 * Process-lifetime record of the most recent IP seen for each remote-location device serial.
 * Mirrors roku-dev-studio-api's local `device-registry.ts` (`resolveDeviceIp`), but that one is
 * fed only by THIS machine's own `ssdpDiscover`/`subnetScan` — a remote location's device list
 * never touches it. Fed opportunistically here instead, wherever this process fetches a remote
 * location's live `/devices` list (`remote:discover` IPC + the Sideload Relay's own seed-targets
 * scan), so Sideload Relay fan-out can resolve a remote target's *current* IP instead of trusting
 * a saved one that may be stale after the device changed networks/renewed its DHCP lease.
 */

interface KnownRemoteDevice {
  ip: string;
  lastSeen: number;
}

const bySerial = new Map<string, KnownRemoteDevice>();

export function recordRemoteDeviceSeen(device: { serialNumber?: unknown; serial?: unknown; ip?: unknown }): void {
  const serial =
    (typeof device.serialNumber === 'string' && device.serialNumber.trim()) ||
    (typeof device.serial === 'string' && device.serial.trim()) ||
    '';
  const ip = typeof device.ip === 'string' ? device.ip.trim() : '';
  if (!serial || !ip) return;
  bySerial.set(serial, { ip, lastSeen: Date.now() });
}

/** The most recently seen IP for `serial` at a remote location, or `fallbackIp` if never seen this run. */
export function resolveRemoteDeviceIp(serial: string | undefined | null, fallbackIp: string): string {
  if (!serial) return fallbackIp;
  return bySerial.get(serial)?.ip || fallbackIp;
}

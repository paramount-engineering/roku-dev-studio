/**
 * Process-lifetime record of the most recent IP address seen for each Roku serial number.
 * `ssdpDiscover`/`subnetScan` (discovery.ts) feed this automatically on every device they find,
 * so any caller that already knows a device's serial — Sideload Relay, action scripts, etc. —
 * can ask "what IP is this serial reachable at *right now*" instead of trusting a persisted IP
 * that may be stale after the device (or the caller's machine) changed networks.
 */

interface KnownDevice {
  ip: string;
  lastSeen: number;
}

const bySerial = new Map<string, KnownDevice>();

function recordDeviceSeen(device: { serialNumber?: unknown; ip?: unknown }): void {
  const serial = typeof device.serialNumber === 'string' ? device.serialNumber.trim() : '';
  const ip = typeof device.ip === 'string' ? device.ip.trim() : '';
  if (!serial || !ip) return;
  bySerial.set(serial, { ip, lastSeen: Date.now() });
}

/** The most recently discovered IP for `serial`, or `fallbackIp` if that serial has never been seen this run. */
function resolveDeviceIp(serial: string | undefined | null, fallbackIp: string): string {
  if (!serial) return fallbackIp;
  return bySerial.get(serial)?.ip || fallbackIp;
}

module.exports = { recordDeviceSeen, resolveDeviceIp };

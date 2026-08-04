/**
 * Shared device identity primitives. A `DeviceRef` normalizes the many ways callers refer to a
 * device (raw IP string, serial, friendly name) into a single shape. The lookup helpers resolve a
 * ref against any "list of devices" collection (Dev Studio's connected tabs, the remote server's
 * inventory, a scan result, the MCP bridge's known/connected devices).
 *
 * This is the anti-drift helper: the MCP bridge (`resolveTarget`/`resolveIp`), the API package, and
 * the remote server all resolve devices the same way instead of re-implementing the match.
 */

import { isValidIp } from './validation';

export interface DeviceLike {
  ip?: string | null;
  serial?: string | null;
}

export interface DeviceRef {
  /** Serial match (preferred — stable). */
  serial?: string;
  /** IP match (used when serial is absent / unknown). */
  ip?: string;
}

/**
 * Parse a free-form device identifier (what an agent or user typed) into a normalized ref.
 * Heuristic: looks like an IPv4 → treat as IP; otherwise treat as a serial (serials don't contain
 * dots, but even a dotted non-IP is better kept as a serial than silently dropped).
 */
export function parseDeviceRef(raw: string | null | undefined): DeviceRef | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (isValidIp(s)) return { ip: s };
  return { serial: s };
}

/** Does this device match the given ref? Serial wins when both are available. */
export function deviceMatches(device: DeviceLike, ref: DeviceRef): boolean {
  if (!device || !ref) return false;
  if (ref.serial && device.serial && device.serial === ref.serial) return true;
  if (ref.ip && device.ip && device.ip === ref.ip) return true;
  return false;
}

/**
 * Canonical identity key for PERSISTING per-device state (settings, breakpoints, saved
 * preferences, …). Serial when known, else IP. Never persist raw IP alone as a device's
 * identity — it isn't stable across networks/DHCP, so a device that roams reappears under a
 * different IP with the same serial and any state keyed by the old IP silently orphans.
 */
export function deviceKey(d: DeviceLike): string {
  const serial = typeof d.serial === 'string' ? d.serial.trim() : '';
  if (serial) return serial;
  const ip = typeof d.ip === 'string' ? d.ip.trim() : '';
  return ip;
}

/**
 * Find the first device in a collection that matches the ref. Serial lookup runs before IP so a
 * caller that passed a serial wins over an IP alias.
 */
export function findDevice<T extends DeviceLike>(devices: Iterable<T>, ref: DeviceRef | null): T | null {
  if (!ref) return null;
  const list = Array.from(devices);
  if (ref.serial) {
    const s = list.find((d) => d.serial === ref.serial);
    if (s) return s;
  }
  if (ref.ip) {
    const i = list.find((d) => d.ip === ref.ip);
    if (i) return i;
  }
  return null;
}

/**
 * Resolve a free-form identifier directly against a device collection.
 * Equivalent to `findDevice(devices, parseDeviceRef(raw))`.
 */
export function resolveDevice<T extends DeviceLike>(
  raw: string | null | undefined,
  devices: Iterable<T>
): T | null {
  return findDevice(devices, parseDeviceRef(raw));
}

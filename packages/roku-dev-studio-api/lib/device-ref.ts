/**
 * Shared device identity primitives. A `DeviceRef` normalizes the many ways
 * callers refer to a device (raw IP string, serial, friendly name) into a
 * single shape. A `DeviceDirectory` resolves refs against any "list of
 * devices" collection (Dev Studio's connected tabs, the remote server's
 * inventory, a scan result).
 *
 * This is the anti-drift helper that previously lived separately in the
 * MCP bridge (`resolveTarget` / `resolveIp`), the renderer device-picker,
 * and the remote server's own lookup.
 */

'use strict';

const { isValidIp } = require('./validate-input');

interface DeviceLike {
  ip?: string | null;
  serial?: string | null;
}

interface DeviceRef {
  /** Serial match (preferred — stable). */
  serial?: string;
  /** IP match (used when serial is absent / unknown). */
  ip?: string;
}

/**
 * Parse a free-form device identifier (what an agent or user typed) into a
 * normalized ref. Heuristics: looks like an IPv4 → treat as IP; else serial.
 */
function parseDeviceRef(raw: string | null | undefined): DeviceRef | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (isValidIp(s)) return { ip: s };
  // Serials don't contain dots; if it has dots but isn't a valid IP, still
  // treat as serial (better than silently dropping the input).
  return { serial: s };
}

/**
 * Does this device match the given ref? Serial wins when both are available.
 */
function deviceMatches(device: DeviceLike, ref: DeviceRef): boolean {
  if (!device || !ref) return false;
  if (ref.serial && device.serial && device.serial === ref.serial) return true;
  if (ref.ip && device.ip && device.ip === ref.ip) return true;
  return false;
}

/**
 * Find the first device in a collection that matches the ref. Serial lookup
 * runs before IP so an agent that passed a serial wins over an IP alias.
 */
function findDevice<T extends DeviceLike>(devices: Iterable<T>, ref: DeviceRef | null): T | null {
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
function resolveDevice<T extends DeviceLike>(
  raw: string | null | undefined,
  devices: Iterable<T>
): T | null {
  return findDevice(devices, parseDeviceRef(raw));
}

module.exports = {
  parseDeviceRef,
  deviceMatches,
  findDevice,
  resolveDevice
};

// Export types for TS consumers that import the .d.ts.
// (CJS `module.exports` above is the runtime contract; these are ambient.)
export type { DeviceRef, DeviceLike };

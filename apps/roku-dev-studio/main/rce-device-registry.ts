/**
 * Process-lifetime record of which RCE account+device id a given serial number belongs to, mirroring
 * `roku-dev-studio-api/lib/device-registry.ts`'s `bySerial` map for physical devices (see
 * [[device-identity-key-rule]]).
 *
 * Why this exists: an RCE device's `ip` field (used throughout RDS's device model) is actually a
 * synthetic identifier (the serial number, or `rce-<id>` as a fallback) — there is no real network
 * address to persist. Worse, its *real* connection info, `instanceApiUrl`, is scoped to one boot of
 * one instance and goes stale on every restart, exactly the way a physical device's IP goes stale
 * across a DHCP renewal or network change. The fix is the same one already established for physical
 * devices: never persist the volatile value: persist the *stable identity* (serial) and re-resolve
 * the live connection info fresh, at time of use, from whichever main-process registry has seen
 * that serial most recently.
 *
 * Fed automatically by `RceListDevices`/`RceGetDevice` (rce-handlers.ts) — any caller that already
 * has a device's serial (Sideload Relay's Device Info modal row, its fan-out engine, Fiddle) can
 * ask "what account/device id is this serial right now" without needing to thread `accountName`/
 * `instanceApiUrl` through its own persisted config at all.
 */

import { RceManagementClient } from 'roku-dev-studio-rce';
import { getRceAccountToken } from './rce-account-store';

interface KnownRceDevice {
  accountName: string;
  deviceId: number;
  lastSeen: number;
}

const bySerial = new Map<string, KnownRceDevice>();

export function recordRceDeviceSeen(accountName: string, device: { id?: unknown; serialNumber?: unknown }): void {
  const serial = typeof device?.serialNumber === 'string' ? device.serialNumber.trim() : '';
  const deviceId = typeof device?.id === 'number' ? device.id : undefined;
  if (!serial || deviceId === undefined) return;
  bySerial.set(serial, { accountName, deviceId, lastSeen: Date.now() });
}

/** The most recently discovered `{accountName, deviceId}` for `serial`, or `null` if that serial
 *  hasn't been seen this run (e.g. the app was just launched and the RCE location hasn't refreshed
 *  its device list yet). Synchronous, registry-only — does not hit the network. */
export function resolveRceDeviceBySerial(serial: string | undefined | null): { accountName: string; deviceId: number } | null {
  if (!serial) return null;
  const known = bySerial.get(serial);
  return known ? { accountName: known.accountName, deviceId: known.deviceId } : null;
}

export interface RceLiveInstance {
  accountName: string;
  deviceId: number;
  instanceApiUrl: string;
  token: string;
}

export type RceLiveInstanceResult = { success: true; instance: RceLiveInstance } | { success: false; error: string };

/**
 * Resolve a serial all the way to a *fresh* running instance's connection info — the RCE analog of
 * `resolveDeviceIp(serial, fallbackIp)`, except there's no usable fallback: a stale `instanceApiUrl`
 * doesn't degrade gracefully like a stale IP might (it 404s outright, since the instance UUID in the
 * path is gone), so this always re-fetches from the Core API rather than trusting any cached value.
 */
export async function resolveRceInstanceBySerial(serial: string | undefined | null): Promise<RceLiveInstanceResult> {
  const known = resolveRceDeviceBySerial(serial);
  if (!known) return { success: false, error: 'Unrecognized device this session — reopen its RCE location to refresh.' };
  const token = getRceAccountToken(known.accountName);
  if (!token) return { success: false, error: `No stored RCE account named "${known.accountName}".` };
  const client = new RceManagementClient(token);
  const result = await client.getDevice(known.deviceId);
  if (!result.success) return { success: false, error: result.error };
  if (result.device.status !== 'running' || !result.device.runningDevice?.instanceApiUrl) {
    return { success: false, error: 'Device is not running.' };
  }
  return {
    success: true,
    instance: {
      accountName: known.accountName,
      deviceId: known.deviceId,
      instanceApiUrl: result.device.runningDevice.instanceApiUrl,
      token
    }
  };
}

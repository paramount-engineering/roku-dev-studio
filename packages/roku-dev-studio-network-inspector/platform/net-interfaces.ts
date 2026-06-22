/** Shared network-interface helpers used by the per-platform hotspot detectors. */

import * as os from 'os';
import type { HotspotInterfaceInfo } from './types';

/** Build a hotspot descriptor (name + /24 subnet prefix + gateway) from a gateway IPv4. */
export function ifaceDescriptor(name: string, gatewayIp: string): HotspotInterfaceInfo | null {
  const parts = gatewayIp.split('.');
  if (parts.length !== 4) return null;
  return { name, subnet: `${parts[0]}.${parts[1]}.${parts[2]}`, gatewayIp };
}

/**
 * First non-internal IPv4 address from an interface address list.
 * Centralised here so windows.ts hotspot detection and Npcap device resolution share the same
 * selection rule — a single place to update if we ever add IPv6 fallback or link-local filtering.
 */
export function firstIpv4(addrs: os.NetworkInterfaceInfo[]): string | undefined {
  return addrs.find((a) => a.family === 'IPv4' && !a.internal)?.address;
}

/** First non-internal IPv4 address for a named interface from os.networkInterfaces(). */
export function interfaceIpv4(name: string): string | undefined {
  return firstIpv4(os.networkInterfaces()[name] ?? []);
}

/** A private (RFC1918) IPv4 address. */
export function isPrivateGatewayIp(ip: string): boolean {
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(ip)
  );
}

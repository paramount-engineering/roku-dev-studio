/** Shared network-interface helpers used by the per-platform hotspot detectors. */

import type { HotspotInterfaceInfo } from './types';

/** Build a hotspot descriptor (name + /24 subnet prefix + gateway) from a gateway IPv4. */
export function ifaceDescriptor(name: string, gatewayIp: string): HotspotInterfaceInfo | null {
  const parts = gatewayIp.split('.');
  if (parts.length !== 4) return null;
  return { name, subnet: `${parts[0]}.${parts[1]}.${parts[2]}`, gatewayIp };
}

/** A private (RFC1918) IPv4 address. */
export function isPrivateGatewayIp(ip: string): boolean {
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(ip)
  );
}

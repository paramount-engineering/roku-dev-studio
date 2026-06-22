/** Windows capture worker: ICS/Mobile Hotspot detection + Npcap (cap) packet capture. */

import * as os from 'os';
import { ifaceDescriptor, isPrivateGatewayIp, firstIpv4 } from './net-interfaces';
import { NpcapFrameSource } from './frame-sources';
import {
  detectNpcapInstalled,
  detectCapModuleAvailable,
  defaultCapturePermissionHint
} from '../capture-engine';
import { buildNetworkInspectorPrerequisites } from '../prerequisites';
import {
  networkInspectorSetupTitle,
  networkInspectorSetupGuideBodyHtml
} from '../setup-guide';
import type {
  CapturePlatform,
  CaptureFrameSource,
  HotspotInterfaceInfo,
  InstallCaptureAccessResult,
  PlatformCaptureReadiness
} from './types';

/**
 * Score Windows interface candidates for a hotspot. Friendly names are localized (so a plain
 * English substring match silently fails on non-English Windows) and modern Mobile Hotspot doesn't
 * always match those names — so the ICS/Mobile Hotspot gateway subnet (192.168.137.x) is the
 * strongest signal, followed by the legacy adapter-name match, then any other private gateway.
 */
function scoreWindowsHotspotCandidate(): { name: string; subnet: string; gatewayIp: string; score: number } | null {
  const ifaces = os.networkInterfaces();
  let best: { name: string; subnet: string; gatewayIp: string; score: number } | null = null;
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    const ip = firstIpv4(addrs);
    if (!ip) continue;
    if (ip.startsWith('169.254.')) continue;
    const lower = name.toLowerCase();
    const nameMatch =
      lower.includes('wi-fi direct') ||
      lower.includes('local area connection') ||
      lower.includes('microsoft wi-fi direct');
    let score = 0;
    if (ip.startsWith('192.168.137.')) score = 3;
    else if (nameMatch) score = 2;
    else if (isPrivateGatewayIp(ip)) score = 1;
    if (score === 0) continue;
    if (!best || score > best.score) {
      const desc = ifaceDescriptor(name, ip);
      if (desc) best = { ...desc, score };
    }
  }
  return best;
}

export class WindowsCapturePlatform implements CapturePlatform {
  readonly platform = 'win32' as const;
  // Npcap is an external installer (+ relaunch) — there's no in-app one-click grant.
  readonly hasInAppCaptureSetup = false;

  detectHotspotInterface(): HotspotInterfaceInfo | null {
    const best = scoreWindowsHotspotCandidate();
    return best ? { name: best.name, subnet: best.subnet, gatewayIp: best.gatewayIp } : null;
  }

  isHotspotConfidentlyActive(): boolean {
    // Only a strong match counts (ICS subnet 192.168.137.x or a Wi-Fi Direct / hosted-network
    // adapter, score >= 2) so a normal Wi-Fi connection isn't mistaken for a hotspot.
    const best = scoreWindowsHotspotCandidate();
    return !!best && best.score >= 2;
  }

  getReadiness(): PlatformCaptureReadiness {
    const npcapInstalled = detectNpcapInstalled();
    const capModuleAvailable = detectCapModuleAvailable();
    return {
      captureToolAvailable: npcapInstalled && capModuleAvailable,
      npcapInstalled,
      capModuleAvailable
    };
  }

  buildPrerequisites(readiness: PlatformCaptureReadiness) {
    return buildNetworkInspectorPrerequisites({
      platform: 'win32',
      npcapInstalled: readiness.npcapInstalled,
      capModuleAvailable: readiness.capModuleAvailable
    });
  }

  capturePermissionHint(): string {
    return defaultCapturePermissionHint('win32');
  }

  createFrameSource(): CaptureFrameSource {
    return new NpcapFrameSource();
  }

  async installCaptureAccess(): Promise<InstallCaptureAccessResult> {
    return {
      success: false,
      error:
        'Install Npcap from https://npcap.com/ (WinPcap API-compatible mode), then reinstall/restart Roku Dev Studio.'
    };
  }

  canRecoverCaptureAfterError(): boolean {
    return false;
  }

  async refreshCaptureAccess(): Promise<void> {
    /* nothing cached at runtime */
  }

  setupGuideTitle(): string {
    return networkInspectorSetupTitle('win32');
  }

  setupGuideBodyHtml(): string {
    return networkInspectorSetupGuideBodyHtml('win32');
  }
}

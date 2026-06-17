/** Linux capture worker: shared-network gateway hotspot + tcpdump capture (cap_net_raw via setcap). */

import * as os from 'os';
import { ifaceDescriptor, isPrivateGatewayIp } from './net-interfaces';
import { TcpdumpFrameSource } from './frame-sources';
import { detectLinuxCaptureAvailable, defaultCapturePermissionHint } from '../capture-engine';
import { installCaptureAccessLinux, isLinuxCaptureAccessGranted } from '../capture-access-linux';
import { buildNetworkInspectorPrerequisites, linuxCaptureBlockedMessage } from '../prerequisites';
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

export class LinuxCapturePlatform implements CapturePlatform {
  readonly platform = 'linux' as const;
  readonly hasInAppCaptureSetup = true;

  // tcpdump capability state (cap_net_raw/cap_net_admin): true = granted, false = missing,
  // null = couldn't verify (no getcap). Refreshed each tick via refreshCaptureAccess().
  private captureAccessGranted: boolean | null = null;

  detectHotspotInterface(): HotspotInterfaceInfo | null {
    const ifaces = os.networkInterfaces();
    let best: { name: string; subnet: string; gatewayIp: string; score: number } | null = null;
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (!addrs || name === 'lo') continue;
      const ipv4 = addrs.find((a) => a.family === 'IPv4' && !a.internal);
      if (!ipv4) continue;
      const ip = ipv4.address;
      if (!ip.endsWith('.1')) continue; // the host is the gateway on a shared network
      if (ip.startsWith('169.254.')) continue;
      let score = 0;
      if (ip.startsWith('10.42.')) score = 3;
      else if (ip.startsWith('192.168.')) score = 2;
      else if (isPrivateGatewayIp(ip)) score = 1;
      if (score === 0) continue;
      if (!best || score > best.score) {
        const desc = ifaceDescriptor(name, ip);
        if (desc) best = { ...desc, score };
      }
    }
    return best ? { name: best.name, subnet: best.subnet, gatewayIp: best.gatewayIp } : null;
  }

  isHotspotConfidentlyActive(): boolean {
    return this.detectHotspotInterface() != null;
  }

  getReadiness(): PlatformCaptureReadiness {
    // tcpdump present AND (capabilities granted or unverifiable). `false` means the binary exists but
    // lacks cap_net_raw/cap_net_admin → report not-ready so the prerequisite surfaces the fix.
    const linuxCaptureAvailable =
      detectLinuxCaptureAvailable().ok && this.captureAccessGranted !== false;
    return { captureToolAvailable: linuxCaptureAvailable, linuxCaptureAvailable };
  }

  buildPrerequisites(readiness: PlatformCaptureReadiness) {
    return buildNetworkInspectorPrerequisites({
      platform: 'linux',
      linuxCaptureAvailable: readiness.linuxCaptureAvailable
    });
  }

  capturePermissionHint(): string {
    return defaultCapturePermissionHint('linux');
  }

  createFrameSource(): CaptureFrameSource {
    return new TcpdumpFrameSource({
      preflight: () => detectLinuxCaptureAvailable(),
      blockedMessage: linuxCaptureBlockedMessage()
    });
  }

  async installCaptureAccess(): Promise<InstallCaptureAccessResult> {
    const r = await installCaptureAccessLinux();
    // Reflect the freshly-granted capability immediately so getReadiness() doesn't keep reporting
    // "blocked" until the next tick re-runs getcap.
    if (r.captureToolAvailable) this.captureAccessGranted = true;
    return {
      success: r.success,
      error: r.error,
      captureToolAvailable: r.captureToolAvailable,
      bpfCaptureAvailable: r.captureToolAvailable
    };
  }

  canRecoverCaptureAfterError(): boolean {
    // Linux capture privilege isn't observable before spawning; auto-retrying every tick would just
    // respawn tcpdump in a loop. Recovery is explicit via the Setup action.
    return false;
  }

  async refreshCaptureAccess(): Promise<void> {
    try {
      this.captureAccessGranted = await isLinuxCaptureAccessGranted();
    } catch {
      this.captureAccessGranted = null;
    }
  }

  setupGuideTitle(): string {
    return networkInspectorSetupTitle('linux');
  }

  setupGuideBodyHtml(): string {
    return networkInspectorSetupGuideBodyHtml('linux');
  }
}

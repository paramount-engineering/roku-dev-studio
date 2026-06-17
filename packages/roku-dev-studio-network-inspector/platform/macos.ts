/** macOS capture worker: Internet Sharing (bridge100) hotspot + BPF packet capture via tcpdump. */

import * as os from 'os';
import { ifaceDescriptor } from './net-interfaces';
import { TcpdumpFrameSource } from './frame-sources';
import { detectBpfCaptureAvailable, defaultCapturePermissionHint } from '../capture-engine';
import { isBpfLaunchDaemonInstalled, installBpfAccessMacOS } from '../bpf-access-macos';
import { buildNetworkInspectorPrerequisites, macosBpfBlockedMessage } from '../prerequisites';
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

const MAC_HOTSPOT_INTERFACE = 'bridge100';

export class MacOsCapturePlatform implements CapturePlatform {
  readonly platform = 'darwin' as const;
  readonly hasInAppCaptureSetup = true;

  detectHotspotInterface(): HotspotInterfaceInfo | null {
    const ifaces = os.networkInterfaces();
    const bridge = ifaces[MAC_HOTSPOT_INTERFACE];
    if (!bridge) return null;
    const ipv4 = bridge.find((a) => a.family === 'IPv4');
    if (!ipv4) return null;
    return ifaceDescriptor(MAC_HOTSPOT_INTERFACE, ipv4.address);
  }

  isHotspotConfidentlyActive(): boolean {
    // bridge100 only exists while Internet Sharing is on — its presence is the signal.
    return this.detectHotspotInterface() != null;
  }

  getReadiness(): PlatformCaptureReadiness {
    const bpfOk = detectBpfCaptureAvailable().ok;
    return {
      captureToolAvailable: bpfOk,
      bpfCaptureAvailable: bpfOk,
      bpfLaunchDaemonInstalled: isBpfLaunchDaemonInstalled()
    };
  }

  buildPrerequisites(readiness: PlatformCaptureReadiness) {
    return buildNetworkInspectorPrerequisites({
      platform: 'darwin',
      bpfCaptureAvailable: readiness.bpfCaptureAvailable,
      bpfLaunchDaemonInstalled: readiness.bpfLaunchDaemonInstalled
    });
  }

  capturePermissionHint(): string {
    return defaultCapturePermissionHint('darwin');
  }

  createFrameSource(): CaptureFrameSource {
    return new TcpdumpFrameSource({
      preflight: () => detectBpfCaptureAvailable(),
      blockedMessage: macosBpfBlockedMessage()
    });
  }

  async installCaptureAccess(): Promise<InstallCaptureAccessResult> {
    const r = await installBpfAccessMacOS();
    return { ...r, captureToolAvailable: r.bpfCaptureAvailable };
  }

  canRecoverCaptureAfterError(): boolean {
    // BPF access can flip to writable at runtime (e.g. after the one-time setup) — allow auto-retry.
    return detectBpfCaptureAvailable().ok;
  }

  async refreshCaptureAccess(): Promise<void> {
    /* macOS readiness is read fresh in getReadiness(); nothing cached to refresh. */
  }

  setupGuideTitle(): string {
    return networkInspectorSetupTitle('darwin');
  }

  setupGuideBodyHtml(): string {
    return networkInspectorSetupGuideBodyHtml('darwin');
  }
}

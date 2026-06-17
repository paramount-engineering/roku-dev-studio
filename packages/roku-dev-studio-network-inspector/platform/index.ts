/**
 * Capture-platform selection. One worker implements {@link CapturePlatform} per OS; everything else
 * in the Network Inspector talks to the selected worker instead of branching on `process.platform`.
 */

import type { NetworkInspectorPlatform } from '../types';
import type {
  CapturePlatform,
  CaptureFrameSource,
  CaptureFrameSourceStartOptions,
  HotspotInterfaceInfo,
  InstallCaptureAccessResult,
  PlatformCaptureReadiness
} from './types';
import { MacOsCapturePlatform } from './macos';
import { WindowsCapturePlatform } from './windows';
import { LinuxCapturePlatform } from './linux';

export type {
  CapturePlatform,
  CaptureFrameSource,
  CaptureFrameSourceStartOptions,
  HotspotInterfaceInfo,
  InstallCaptureAccessResult,
  PlatformCaptureReadiness
} from './types';
export { MacOsCapturePlatform } from './macos';
export { WindowsCapturePlatform } from './windows';
export { LinuxCapturePlatform } from './linux';

/** Frame source that reports "unsupported" — used on platforms with no capture backend. */
class UnsupportedFrameSource implements CaptureFrameSource {
  start(options: CaptureFrameSourceStartOptions): boolean {
    options.onError('Packet capture is not yet supported on this platform.');
    return false;
  }
  stop(): void {
    /* nothing to stop */
  }
}

/** Fallback worker for non-darwin/win32/linux hosts (Electron only ships those, so this is rare). */
class UnsupportedCapturePlatform implements CapturePlatform {
  readonly platform: NetworkInspectorPlatform;
  readonly hasInAppCaptureSetup = false;
  constructor(platform: NodeJS.Platform) {
    this.platform = platform as NetworkInspectorPlatform;
  }
  detectHotspotInterface(): HotspotInterfaceInfo | null {
    return null;
  }
  isHotspotConfidentlyActive(): boolean {
    return false;
  }
  getReadiness(): PlatformCaptureReadiness {
    return { captureToolAvailable: false };
  }
  buildPrerequisites(): [] {
    return [];
  }
  capturePermissionHint(): string {
    return 'Packet capture is not supported on this platform.';
  }
  createFrameSource(): CaptureFrameSource {
    return new UnsupportedFrameSource();
  }
  async installCaptureAccess(): Promise<InstallCaptureAccessResult> {
    return { success: false, error: 'Packet capture is not supported on this platform.' };
  }
  canRecoverCaptureAfterError(): boolean {
    return false;
  }
  async refreshCaptureAccess(): Promise<void> {
    /* no-op */
  }
  setupGuideTitle(): string {
    return 'Hotspot Capture Setup';
  }
  setupGuideBodyHtml(): string {
    return '';
  }
}

function createCapturePlatform(platform: NodeJS.Platform): CapturePlatform {
  switch (platform) {
    case 'darwin':
      return new MacOsCapturePlatform();
    case 'win32':
      return new WindowsCapturePlatform();
    case 'linux':
      return new LinuxCapturePlatform();
    default:
      return new UnsupportedCapturePlatform(platform);
  }
}

let cached: CapturePlatform | null = null;

/**
 * The capture worker for this host. Cached as a singleton — the platform can't change at runtime, and
 * a shared instance keeps stateful readiness (e.g. Linux getcap) consistent across all callers.
 */
export function getCapturePlatform(): CapturePlatform {
  if (!cached) cached = createCapturePlatform(process.platform);
  return cached;
}

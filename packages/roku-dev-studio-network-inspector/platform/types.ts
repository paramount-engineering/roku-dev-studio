/**
 * Common contract for per-platform Network Inspector "capture workers".
 *
 * Each OS (macOS / Windows / Linux) implements {@link CapturePlatform}; the orchestrator
 * (`NetworkInspectorService`) and the platform-agnostic `CaptureEngine` consume a single selected
 * provider instead of branching on `process.platform` throughout. Add a new platform by writing one
 * provider — no scattered conditionals to hunt down.
 */

import type { NetworkInspectorPlatform } from '../types';
import type { PrerequisiteCheck } from '../prerequisites';

/** A detected hotspot/shared-network interface RDS can capture on. */
export interface HotspotInterfaceInfo {
  name: string;
  subnet: string;
  gatewayIp: string;
}

/** Up-front packet-capture readiness for the host platform. Fields are platform-specific but the
 *  cross-platform `captureToolAvailable` is always meaningful. */
export interface PlatformCaptureReadiness {
  captureToolAvailable: boolean;
  bpfCaptureAvailable?: boolean;
  bpfLaunchDaemonInstalled?: boolean;
  npcapInstalled?: boolean;
  capModuleAvailable?: boolean;
  linuxCaptureAvailable?: boolean;
}

/** Result of a one-click in-app capture-access grant (macOS BPF / Linux setcap). */
export interface InstallCaptureAccessResult {
  success: boolean;
  error?: string;
  bpfCaptureAvailable?: boolean;
  captureToolAvailable?: boolean;
  launchDaemonInstalled?: boolean;
}

export interface CaptureFrameSourceStartOptions {
  interfaceName: string;
  hotspotSubnetPrefix?: string;
  /** Called for each captured ethernet frame with a capture timestamp (ms since epoch). */
  onFrame: (frame: Buffer, timestampMs: number) => void;
  onError: (message: string) => void;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

/**
 * Platform-specific producer of raw ethernet frames for an interface. This is the only part of the
 * capture path that differs per OS (tcpdump→pcap stream on macOS/Linux, Npcap callback on Windows);
 * everything downstream (parsing, dispatch, counting) is shared in `CaptureEngine`.
 */
export interface CaptureFrameSource {
  start(options: CaptureFrameSourceStartOptions): boolean;
  stop(): void;
}

export interface CapturePlatform {
  readonly platform: NetworkInspectorPlatform;
  /** Whether an in-app one-click capture-access grant exists (false on Windows — external Npcap). */
  readonly hasInAppCaptureSetup: boolean;

  // ---- Hotspot detection ----
  detectHotspotInterface(): HotspotInterfaceInfo | null;
  /** A hotspot is *confidently* active (excludes loose "any private LAN IP" fallbacks). */
  isHotspotConfidentlyActive(): boolean;

  // ---- Readiness + remediation ----
  getReadiness(): PlatformCaptureReadiness;
  buildPrerequisites(readiness: PlatformCaptureReadiness): PrerequisiteCheck[];
  capturePermissionHint(): string;

  // ---- Capture mechanism ----
  createFrameSource(): CaptureFrameSource;

  // ---- One-click setup + runtime recovery ----
  installCaptureAccess(): Promise<InstallCaptureAccessResult>;
  /** After a capture error, has access recovered so the tick loop can auto-retry? (macOS BPF). */
  canRecoverCaptureAfterError(): boolean;
  /** Refresh cached readiness that can change at runtime without a relaunch (Linux getcap). */
  refreshCaptureAccess(): Promise<void>;

  // ---- Setup guide (shared content) ----
  setupGuideTitle(): string;
  setupGuideBodyHtml(): string;
}

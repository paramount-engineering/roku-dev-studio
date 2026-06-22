import * as fs from 'fs';
import * as path from 'path';
import { parseCaptureFrame, type PacketParseContext } from './packet-parser';
import { resetHttpStreams } from './http-stream-parser';
import { macosBpfBlockedMessage } from './prerequisites';
import type { CaptureFrameSource } from './platform/types';

type CaptureEngineOpts = {
  interfaceName: string;
  deviceIps: Set<string>;
  hotspotSubnetPrefix?: string;
  onEvents: (events: ParsedNetworkEvent[]) => void;
  onError: (message: string) => void;
  onRawPacket?: (frame: Buffer, timestampMs: number) => void;
  onProcessExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
};

import type { ParsedNetworkEvent } from './types';

export function detectBpfCaptureAvailable(): { ok: boolean; error?: string } {
  if (process.platform !== 'darwin') return { ok: true };
  try {
    const bpf0 = '/dev/bpf0';
    if (!fs.existsSync(bpf0)) {
      return { ok: false, error: 'BPF capture device not found (/dev/bpf0).' };
    }
    // Packet capture requires read *and* write on BPF (644 is not enough — only root can write).
    fs.accessSync(bpf0, fs.constants.R_OK | fs.constants.W_OK);
    return { ok: true };
  } catch {
    return { ok: false, error: macosBpfBlockedMessage() };
  }
}

// GUI-launched Electron apps inherit a minimal PATH that often omits /usr/sbin, so resolve the
// tcpdump binary by probing the standard install locations before falling back to bare `tcpdump`
// (which relies on PATH). Shared by macOS and Linux, which both capture via tcpdump → pcap stream.
const TCPDUMP_CANDIDATE_PATHS = [
  '/usr/sbin/tcpdump',
  '/usr/bin/tcpdump',
  '/sbin/tcpdump',
  '/bin/tcpdump',
  '/usr/local/sbin/tcpdump',
  '/usr/local/bin/tcpdump',
  '/opt/homebrew/bin/tcpdump'
] as const;

export function resolveTcpdumpPath(): string | null {
  for (const candidate of TCPDUMP_CANDIDATE_PATHS) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore and keep probing */
    }
  }
  return null;
}

/**
 * Linux capture readiness. The capture itself runs `tcpdump`, so we can only verify the binary is
 * present here — the actual privilege (root or `cap_net_raw,cap_net_admin`) is enforced by the
 * kernel at capture start and surfaced through stderr → remediation. Presence is the one thing we
 * can check up front so the UI can offer "install tcpdump" before the user even tries.
 */
export function detectLinuxCaptureAvailable(): { ok: boolean; error?: string } {
  if (process.platform !== 'linux') return { ok: true };
  if (resolveTcpdumpPath()) return { ok: true };
  return {
    ok: false,
    error:
      'tcpdump was not found. Install it (Debian/Ubuntu: sudo apt install tcpdump · Fedora: sudo dnf install tcpdump), then return to this tab.'
  };
}

let capModuleAvailableCache: boolean | null = null;

/**
 * Whether the optional native `cap` (libpcap/Npcap) binding can be loaded in this Electron runtime.
 * Cached because a failed native require is comparatively expensive and the answer can't change
 * without a relaunch. Only meaningful on Windows, where capture depends on it.
 */
export function detectCapModuleAvailable(): boolean {
  if (process.platform !== 'win32') return true;
  if (capModuleAvailableCache !== null) return capModuleAvailableCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('cap');
    capModuleAvailableCache = !!(mod && mod.Cap);
  } catch {
    capModuleAvailableCache = false;
  }
  return capModuleAvailableCache;
}

/**
 * Platform-agnostic capture engine: drives a platform-supplied {@link CaptureFrameSource} and owns
 * the shared hot path (frame → parse → dispatch → count). The per-OS capture mechanism lives in the
 * frame source, so this class has no `process.platform` branches.
 */
export class CaptureEngine {
  private source: CaptureFrameSource | null = null;
  private packetsCaptured = 0;
  private parseCtx: PacketParseContext | null = null;

  /** @param frameSourceFactory produces a fresh per-OS frame source for each capture session. */
  constructor(private readonly frameSourceFactory: () => CaptureFrameSource) {}

  updateParseContext(ctx: Partial<PacketParseContext>): void {
    if (!this.parseCtx) return;
    if (ctx.deviceIps) this.parseCtx.deviceIps = ctx.deviceIps;
    if (ctx.hotspotSubnetPrefix !== undefined) {
      this.parseCtx.hotspotSubnetPrefix = ctx.hotspotSubnetPrefix;
    }
  }

  start(opts: CaptureEngineOpts): boolean {
    this.stop();
    this.resetSession();
    this.parseCtx = {
      deviceIps: opts.deviceIps,
      hotspotSubnetPrefix: opts.hotspotSubnetPrefix,
      seenFlows: new Set<string>()
    };
    this.source = this.frameSourceFactory();
    return this.source.start({
      interfaceName: opts.interfaceName,
      hotspotSubnetPrefix: opts.hotspotSubnetPrefix,
      onFrame: (frame, timestampMs) => this.handleFrame(frame, timestampMs, opts),
      onError: opts.onError,
      onExit: opts.onProcessExit
    });
  }

  private handleFrame(frame: Buffer, timestampMs: number, opts: CaptureEngineOpts): void {
    this.packetsCaptured += 1;
    opts.onRawPacket?.(frame, timestampMs);
    const events = parseCaptureFrame(frame, this.parseCtx!);
    if (events.length > 0) {
      for (const ev of events) {
        ev.timestamp = new Date(timestampMs).toISOString();
      }
      opts.onEvents(events);
    }
  }

  stop(): void {
    if (this.source) {
      this.source.stop();
      this.source = null;
    }
    this.parseCtx = null;
  }

  resetSession(): void {
    this.packetsCaptured = 0;
    if (this.parseCtx) this.parseCtx.seenFlows = new Set();
    resetHttpStreams();
  }

  getPacketsCaptured(): number {
    return this.packetsCaptured;
  }

  /** Frame-source runtime stats for diagnostics (e.g. Windows Npcap queue depth / dropped). */
  getSourceStats(): { queued: number; dropped: number } | undefined {
    return this.source?.getStats?.();
  }
}

export function detectNpcapInstalled(): boolean {
  if (process.platform !== 'win32') return true;
  const npcapDll = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Npcap', 'wpcap.dll');
  return fs.existsSync(npcapDll);
}

export function defaultCapturePermissionHint(platform: NodeJS.Platform): string {
  if (platform === 'darwin') {
    return 'macOS: enable Internet Sharing, then allow packet capture. If capture fails, install Wireshark/tcpdump access via System Settings → Privacy & Security → Full Disk Access for Terminal or grant admin when prompted.';
  }
  if (platform === 'win32') {
    return 'Windows: install Npcap (https://npcap.com) in WinPcap API-compatible mode. Use RDS hotspot controls or Windows Mobile Hotspot — RDS watches the virtual adapter automatically.';
  }
  return 'Linux: share your connection (NetworkManager “Shared to other computers” or a hostapd hotspot), then allow capture with one-time setup or run: sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump).';
}

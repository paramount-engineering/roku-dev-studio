/**
 * Per-platform raw-frame producers. These are the only OS-specific part of the capture path:
 *   • {@link TcpdumpFrameSource} — macOS/Linux: spawn `tcpdump -w -` and parse the pcap stream.
 *   • {@link NpcapFrameSource}   — Windows: open the Npcap `cap` binding and read packets.
 * Both emit decoded ethernet frames (+ timestamp) via `onFrame`; all downstream parsing lives in
 * `CaptureEngine`.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PcapByteStream } from '../pcap-byte-stream';
import { resolveTcpdumpPath } from '../capture-engine';
import { niLog, niWarn, niError, niDebug } from '../log';
import type { CaptureFrameSource, CaptureFrameSourceStartOptions } from './types';

const PCAP_GLOBAL_HDR = 24;
const PCAP_REC_HDR = 16;

/** macOS/Linux capture via `tcpdump`, streamed as pcap and split into frames. */
export class TcpdumpFrameSource implements CaptureFrameSource {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private stream = new PcapByteStream();
  private globalHeaderStripped = false;

  constructor(
    private readonly cfg: {
      /** Up-front readiness check (BPF on macOS, tcpdump presence on Linux). */
      preflight: () => { ok: boolean; error?: string };
      /** User-facing message when capture is blocked by missing privilege. */
      blockedMessage: string;
    }
  ) {}

  start(options: CaptureFrameSourceStartOptions): boolean {
    const pf = this.cfg.preflight();
    if (!pf.ok) {
      options.onError(pf.error || 'Packet capture unavailable.');
      return false;
    }
    const subnet = options.hotspotSubnetPrefix;
    const filter = subnet
      ? `net ${subnet}.0/24 and (udp port 53 or tcp port 443 or tcp port 80)`
      : 'udp port 53 or tcp port 443 or tcp port 80';
    const tcpdumpBin = resolveTcpdumpPath() || 'tcpdump';
    niLog(`tcpdump capture starting: ${tcpdumpBin} -i ${options.interfaceName} filter="${filter}"`);
    const proc = spawn(tcpdumpBin, ['-i', options.interfaceName, '-w', '-', '-U', '-s', '0', filter], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    // stdin is 'ignore' (null), so the spawn result is ChildProcessByStdio<null,…>; the field only
    // needs `.kill()`/the std streams, so the cast is safe.
    this.proc = proc as unknown as ChildProcessWithoutNullStreams;
    this.stream.clear();
    this.globalHeaderStripped = false;
    proc.stdout.on('data', (chunk: Buffer) => {
      this.stream.append(chunk);
      this.drain(options.onFrame);
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim();
      if (!text) return;
      niWarn('tcpdump stderr:', text);
      if (/denied|permission|not permitted|must be root|couldn't find|No such device|Operation not permitted/i.test(text)) {
        options.onError(this.cfg.blockedMessage);
      }
    });
    proc.on('error', (err) => {
      niError('tcpdump failed to start:', err.message);
      options.onError(`tcpdump failed to start: ${err.message}`);
    });
    proc.on('exit', (code, signal) => {
      this.proc = null;
      niLog(`tcpdump exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
      options.onExit?.(code, signal);
      if (code !== 0 && signal !== 'SIGTERM') {
        options.onError(`tcpdump exited (${code ?? signal ?? 'unknown'})`);
      }
    });
    return true;
  }

  stop(): void {
    const proc = this.proc;
    this.proc = null;
    if (proc) {
      proc.kill('SIGTERM');
      // Escalate to SIGKILL if tcpdump doesn't exit promptly (e.g. blocked in a capture syscall), so
      // a stop()/start() cycle can't leave an orphaned capture process holding the interface.
      const killTimer = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          /* already exited */
        }
      }, 2000);
      if (typeof killTimer.unref === 'function') killTimer.unref();
      proc.once('exit', () => clearTimeout(killTimer));
    }
    this.stream.clear();
    this.globalHeaderStripped = false;
  }

  private drain(onFrame: (frame: Buffer, timestampMs: number) => void): void {
    if (!this.globalHeaderStripped && this.stream.size >= PCAP_GLOBAL_HDR) {
      this.stream.shift(PCAP_GLOBAL_HDR);
      this.globalHeaderStripped = true;
    }
    while (this.stream.size >= PCAP_REC_HDR) {
      const inclLen = this.stream.readUInt32LE(12);
      if (inclLen <= 0 || inclLen > 65535) {
        this.stream.shift(1);
        continue;
      }
      if (this.stream.size < PCAP_REC_HDR + inclLen) break;
      const tsSec = this.stream.readUInt32LE(0);
      const tsUsec = this.stream.readUInt32LE(4);
      const frame = this.stream.slice(PCAP_REC_HDR, PCAP_REC_HDR + inclLen);
      this.stream.shift(PCAP_REC_HDR + inclLen);
      const timestampMs = tsSec * 1000 + Math.floor(tsUsec / 1000);
      onFrame(frame, timestampMs);
    }
  }
}

// Npcap delivers packets via a synchronous native callback on the main thread, and the `cap` handle
// is bound to the thread that opened the adapter — so it can't be moved to a worker. To keep a burst
// of packets from monopolizing the event loop (starving IPC like Send Text), the native callback
// does only a cheap copy+enqueue; the expensive parse runs in bounded batches via setImmediate,
// yielding between batches so other event-loop work interleaves. The queue is capped so a sustained
// flood that outruns the parser drops oldest frames (and counts them) rather than growing unbounded.
const NPCAP_QUEUE_MAX = 5000;
const NPCAP_PUMP_BATCH = 256;

/**
 * Map an OS "friendly" interface name (e.g. "Wi-Fi", "Local Area Connection* 2", "Microsoft Wi-Fi
 * Direct Virtual Adapter") to the Npcap device name (`\Device\NPF_{GUID}`) that `cap.open()` requires.
 *
 * This is the macOS/Windows divergence behind "capture works on Mac but not Windows": tcpdump's `-i`
 * accepts the friendly name directly, but Npcap identifies adapters only by device name. We look up
 * the interface's IPv4 address and ask Npcap which device owns it (`Cap.findDevice(ip)`).
 */
function resolveNpcapDevice(
  Cap: { findDevice: (ip?: string) => string | undefined },
  interfaceName: string
): string | undefined {
  const addrs = os.networkInterfaces()[interfaceName];
  const ipv4 = addrs?.find((a) => a.family === 'IPv4' && !a.internal)?.address;
  if (!ipv4) {
    niWarn(`Interface "${interfaceName}" has no external IPv4 address; cannot resolve its Npcap device.`);
    return undefined;
  }
  try {
    const device = Cap.findDevice(ipv4) || undefined;
    niLog(`Resolved interface "${interfaceName}" (${ipv4}) to Npcap device ${device ?? '(none found)'}.`);
    return device;
  } catch (err) {
    niError(`Cap.findDevice(${ipv4}) failed: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

/** Windows capture via the optional native `cap` (Npcap/libpcap) binding. */
export class NpcapFrameSource implements CaptureFrameSource {
  private capInstance: { close: () => void } | null = null;
  private queue: Array<{ frame: Buffer; ts: number }> = [];
  private pumpScheduled = false;
  private onFrame: ((frame: Buffer, timestampMs: number) => void) | null = null;
  private droppedFrames = 0;

  start(options: CaptureFrameSourceStartOptions): boolean {
    const npcapRoot = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Npcap');
    const npcapDll = path.join(npcapRoot, 'wpcap.dll');
    if (!fs.existsSync(npcapDll)) {
      niWarn(`Npcap not found at ${npcapDll} — Windows capture unavailable until Npcap is installed.`);
      return false;
    }
    niLog(`Npcap detected at ${npcapDll}; opening interface "${options.interfaceName}".`);
    try {
      // Optional native binding — graceful when not built for this Electron ABI.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Cap = require('cap').Cap;
      const cap = new Cap();
      const subnet = options.hotspotSubnetPrefix;
      const filter = subnet
        ? `net ${subnet}.0/24 and (udp port 53 or tcp port 443 or tcp port 80)`
        : 'udp port 53 or tcp port 443 or tcp port 80';
      const bufSize = 10 * 1024 * 1024;
      const buffer = Buffer.alloc(65535);
      // Npcap needs the device name (\Device\NPF_{GUID}), not the OS friendly name we capture on.
      const device = resolveNpcapDevice(Cap, options.interfaceName);
      if (!device) {
        niError(`No Npcap device found for interface "${options.interfaceName}"; capture cannot start.`);
        options.onError(
          `Could not find the Npcap capture device for "${options.interfaceName}". Make sure Npcap is installed in WinPcap API-compatible mode.`
        );
        return false;
      }
      const linkType = cap.open(device, filter, bufSize, buffer);
      if (linkType == null) {
        niError(`cap.open returned null for device "${device}" (interface="${options.interfaceName}", filter="${filter}").`);
        options.onError(`Could not open ${options.interfaceName} for capture. Check Npcap installation.`);
        return false;
      }
      niLog(`Npcap capture started on "${options.interfaceName}" (device=${device}, linkType=${linkType}, filter="${filter}").`);
      this.onFrame = options.onFrame;
      cap.on('packet', (nbytes: number) => {
        // Keep the native callback minimal: `buffer` is a single allocation Npcap reuses for every
        // packet, so copy the bytes (the view is only valid until the next callback) and enqueue.
        // Parsing happens off this callback in pump() so a packet burst can't hold the event loop.
        if (this.queue.length >= NPCAP_QUEUE_MAX) {
          this.queue.shift();
          this.droppedFrames += 1;
          // Don't drop silently — surface sustained overrun (parser can't keep up with capture).
          if (this.droppedFrames % 1000 === 1) {
            niWarn(
              `Npcap capture queue full — dropped ${this.droppedFrames} frame(s); capture is outrunning the parser.`
            );
          }
        }
        this.queue.push({ frame: Buffer.from(buffer.subarray(0, nbytes)), ts: Date.now() });
        this.schedulePump();
      });
      this.capInstance = cap;
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      niError(`Failed to load/open the "cap" native module: ${msg}`);
      options.onError(
        `Windows capture requires the optional "cap" native module (${msg}). Install Npcap first; see Settings → Network Inspector.`
      );
      return false;
    }
  }

  /** Diagnostics: current queue depth and total dropped frames (for the periodic status log). */
  getStats(): { queued: number; dropped: number } {
    return { queued: this.queue.length, dropped: this.droppedFrames };
  }

  private schedulePump(): void {
    if (this.pumpScheduled) return;
    this.pumpScheduled = true;
    setImmediate(() => this.pump());
  }

  /** Drain a bounded batch of queued frames, then yield; reschedule while frames remain. */
  private pump(): void {
    this.pumpScheduled = false;
    const onFrame = this.onFrame;
    if (!onFrame) {
      this.queue.length = 0;
      return;
    }
    let processed = 0;
    while (this.queue.length > 0 && processed < NPCAP_PUMP_BATCH) {
      const next = this.queue.shift();
      processed += 1;
      if (next) onFrame(next.frame, next.ts);
    }
    if (processed > 0) niDebug(`Npcap pump drained ${processed} frame(s); ${this.queue.length} queued.`);
    if (this.queue.length > 0) this.schedulePump();
  }

  stop(): void {
    try {
      this.capInstance?.close();
    } catch {
      /* ignore */
    }
    this.capInstance = null;
    this.onFrame = null;
    this.queue.length = 0;
    this.pumpScheduled = false;
    this.droppedFrames = 0;
  }
}

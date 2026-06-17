/**
 * Per-platform raw-frame producers. These are the only OS-specific part of the capture path:
 *   • {@link TcpdumpFrameSource} — macOS/Linux: spawn `tcpdump -w -` and parse the pcap stream.
 *   • {@link NpcapFrameSource}   — Windows: open the Npcap `cap` binding and read packets.
 * Both emit decoded ethernet frames (+ timestamp) via `onFrame`; all downstream parsing lives in
 * `CaptureEngine`.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PcapByteStream } from '../pcap-byte-stream';
import { resolveTcpdumpPath } from '../capture-engine';
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
      console.warn('[Network Inspector] tcpdump:', text);
      if (/denied|permission|not permitted|must be root|couldn't find|No such device|Operation not permitted/i.test(text)) {
        options.onError(this.cfg.blockedMessage);
      }
    });
    proc.on('error', (err) => {
      options.onError(`tcpdump failed to start: ${err.message}`);
    });
    proc.on('exit', (code, signal) => {
      this.proc = null;
      options.onExit?.(code, signal);
      if (code !== 0 && signal !== 'SIGTERM') {
        options.onError(`tcpdump exited (${code ?? signal ?? 'unknown'})`);
      }
    });
    return true;
  }

  stop(): void {
    if (this.proc) {
      this.proc.kill('SIGTERM');
      this.proc = null;
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

/** Windows capture via the optional native `cap` (Npcap/libpcap) binding. */
export class NpcapFrameSource implements CaptureFrameSource {
  private capInstance: { close: () => void } | null = null;

  start(options: CaptureFrameSourceStartOptions): boolean {
    const npcapRoot = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Npcap');
    const npcapDll = path.join(npcapRoot, 'wpcap.dll');
    if (!fs.existsSync(npcapDll)) {
      return false;
    }
    try {
      // Optional native binding — graceful when not built for this Electron ABI.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Cap = require('cap').Cap;
      const cap = new Cap();
      const filter = 'udp port 53 or tcp port 443';
      const bufSize = 10 * 1024 * 1024;
      const buffer = Buffer.alloc(65535);
      const linkType = cap.open(options.interfaceName, filter, bufSize, buffer);
      if (linkType == null) {
        options.onError(`Could not open ${options.interfaceName} for capture. Check Npcap installation.`);
        return false;
      }
      cap.on('packet', (nbytes: number) => {
        options.onFrame(buffer.subarray(0, nbytes), Date.now());
      });
      this.capInstance = cap;
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      options.onError(
        `Windows capture requires the optional "cap" native module (${msg}). Install Npcap first; see Settings → Network Inspector.`
      );
      return false;
    }
  }

  stop(): void {
    try {
      this.capInstance?.close();
    } catch {
      /* ignore */
    }
    this.capInstance = null;
  }
}

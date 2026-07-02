/**
 * Parse a saved network capture file into `ParsedNetworkEvent[]` for the standalone Network Session
 * Viewer. Three formats are supported, matching what the Network Inspector's download menu produces:
 *
 *   - `.rds-network-inspector.json` — the native session bundle. Already `ParsedNetworkEvent[]` with
 *     headers/bodies inlined, so it round-trips the exact live UI (incl. DNS/TLS/TCP + MITM flags).
 *   - `.har` (HAR 1.2) — the interop archive. Each entry maps to an `http-transaction` event.
 *   - `.pcap` (Wireshark) — raw Ethernet frames, replayed through the SAME frame parser the live
 *     capture engine uses (`parseCaptureFrame`), so a hotspot capture yields DNS/TLS/TCP + plaintext
 *     HTTP. HTTPS stays encrypted (no keys in the file), exactly as it does live without MITM.
 */
import type { ParsedNetworkEvent, NetworkHttpMessage } from '../shared/network-inspector/types';
import {
  parseCaptureFrame,
  extractFrameIps,
  type PacketParseContext
} from 'roku-dev-studio-network-inspector/packet-parser';
import { resetHttpStreams } from 'roku-dev-studio-network-inspector/http-stream-parser';

export type NetworkSessionFormat = 'bundle' | 'har' | 'pcap';

export type ParsedSession = {
  format: NetworkSessionFormat;
  events: ParsedNetworkEvent[];
  deviceIps: string[];
  /** Non-fatal note surfaced to the user (e.g. an unusual pcap link-layer type). */
  notice?: string;
};

/** Pick the parser from the file extension (case-insensitive). `.json` is treated as the native
 *  bundle; `.rds-network-inspector.json` also ends in `.json`. */
export function detectFormat(filePath: string): NetworkSessionFormat | null {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.pcap') || lower.endsWith('.pcapng')) return 'pcap';
  if (lower.endsWith('.har')) return 'har';
  if (lower.endsWith('.json')) return 'bundle';
  return null;
}

function collectDeviceIps(events: ParsedNetworkEvent[]): string[] {
  return Array.from(new Set(events.map((e) => e.deviceIp).filter((ip): ip is string => !!ip)));
}

// ── Native bundle ────────────────────────────────────────────────────────────────────────────

function parseBundle(text: string): ParsedSession {
  const data = JSON.parse(text) as unknown;
  const obj = data as { events?: unknown; deviceIps?: unknown };
  if (!obj || !Array.isArray(obj.events)) {
    throw new Error('Not a Roku Dev Studio network session file (missing "events" array).');
  }
  // Keep only object entries — a crafted/corrupt file could carry primitives in the
  // array (e.g. `{"events":[1,2,3]}`), which the renderer would later deref (e.deviceIp…).
  const events = (obj.events as unknown[]).filter(
    (e): e is ParsedNetworkEvent => !!e && typeof e === 'object'
  );
  const deviceIps = Array.isArray(obj.deviceIps)
    ? (obj.deviceIps as unknown[]).filter((ip): ip is string => typeof ip === 'string')
    : collectDeviceIps(events);
  return { format: 'bundle', events, deviceIps };
}

// ── HAR 1.2 ──────────────────────────────────────────────────────────────────────────────────

type HarNameValue = { name?: string; value?: string };
type HarMessage = {
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  headers?: HarNameValue[];
  postData?: { text?: string; mimeType?: string };
  content?: { text?: string; mimeType?: string; encoding?: string; size?: number };
  bodySize?: number;
};
type HarEntry = {
  startedDateTime?: string;
  time?: number;
  request?: HarMessage;
  response?: HarMessage;
  serverIPAddress?: string;
};

function harHeadersToRecord(headers: HarNameValue[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers || []) {
    if (typeof h?.name === 'string') out[h.name] = typeof h.value === 'string' ? h.value : '';
  }
  return out;
}

function headerVal(rec: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(rec)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

function bareMime(mime: string | undefined): string | undefined {
  if (!mime) return undefined;
  const bare = mime.split(';')[0].trim();
  return bare || undefined;
}

function harRequestMessage(req: HarMessage | undefined): NetworkHttpMessage | undefined {
  if (!req) return undefined;
  const headers = harHeadersToRecord(req.headers);
  const body = req.postData?.text;
  return {
    method: req.method,
    url: req.url,
    headers,
    ...(body ? { body } : {}),
    contentType: bareMime(req.postData?.mimeType || headerVal(headers, 'content-type')),
    bodyBytes: body ? new TextEncoder().encode(body).length : req.bodySize && req.bodySize > 0 ? req.bodySize : 0
  };
}

function harResponseMessage(res: HarMessage | undefined): NetworkHttpMessage | undefined {
  if (!res) return undefined;
  const headers = harHeadersToRecord(res.headers);
  const body = res.content?.text;
  const isBase64 = res.content?.encoding === 'base64';
  const declaredSize = typeof res.content?.size === 'number' && res.content.size >= 0 ? res.content.size : undefined;
  return {
    statusCode: res.status,
    statusText: res.statusText,
    headers,
    ...(body ? { body } : {}),
    ...(isBase64 ? { bodyEncoding: 'base64' as const } : {}),
    contentType: bareMime(res.content?.mimeType || headerVal(headers, 'content-type')),
    bodyBytes:
      declaredSize ??
      (body ? (isBase64 ? Math.floor((body.length * 3) / 4) : new TextEncoder().encode(body).length) : 0)
  };
}

function hostFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function parseHar(text: string): ParsedSession {
  const data = JSON.parse(text) as { log?: { entries?: HarEntry[] } };
  const entries = data?.log?.entries;
  if (!Array.isArray(entries)) {
    throw new Error('Not a valid HAR file (missing log.entries).');
  }
  const events: ParsedNetworkEvent[] = entries.map((entry, i) => {
    const httpRequest = harRequestMessage(entry.request);
    const httpResponse = harResponseMessage(entry.response);
    const url = entry.request?.url;
    const host = hostFromUrl(url);
    const isHttps = !!url && url.startsWith('https://');
    return {
      id: `har-${i}`,
      type: 'http-transaction',
      deviceIp: '',
      timestamp: entry.startedDateTime || '',
      hostname: host,
      destIp: entry.serverIPAddress,
      destPort: isHttps ? 443 : 80,
      httpRequest,
      httpResponse,
      // HAR carries a decrypted transaction with bodies — mark it MITM-style so the UI shows the
      // request/response as fully inspectable rather than "encrypted".
      mitm: isHttps,
      durationMs: typeof entry.time === 'number' && entry.time >= 0 ? Math.round(entry.time) : undefined,
      detailAvailable: true
    };
  });
  return { format: 'har', events, deviceIps: [] };
}

// ── PCAP ─────────────────────────────────────────────────────────────────────────────────────

const PCAP_MAGIC_LE = 0xa1b2c3d4; // microsecond, little-endian
const PCAP_MAGIC_BE = 0xd4c3b2a1; // microsecond, byte-swapped
const PCAP_MAGIC_NS_LE = 0xa1b23c4d; // nanosecond, little-endian
const PCAP_MAGIC_NS_BE = 0x4d3cb2a1; // nanosecond, byte-swapped
const LINKTYPE_ETHERNET = 1;

/**
 * RFC1918 private client IP (minus the typical `.1` gateway). The live parser attributes a frame to
 * a device only when one endpoint is a known client IP; offline we have no device list, so we treat
 * every private endpoint seen in the capture as a "client" so both request and response frames get
 * attributed and decoded (mirrors the hotspot-client semantics without a fixed subnet prefix).
 */
function isPrivateClientIp(ip: string): boolean {
  if (!ip || ip.endsWith('.1')) return false;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  const m = /^172\.(\d+)\./.exec(ip);
  if (m) {
    const n = Number(m[1]);
    return n >= 16 && n <= 31;
  }
  return false;
}

/**
 * Replay a classic-format `.pcap` (not pcapng) through the live frame parser. Reads the 24-byte
 * global header for endianness + link type, then walks each record (16-byte header + frame bytes).
 */
function parsePcap(buf: Buffer): ParsedSession {
  if (buf.length < 24) throw new Error('File is too small to be a pcap.');
  const magic = buf.readUInt32LE(0);
  let little: boolean;
  let nano: boolean;
  if (magic === PCAP_MAGIC_LE) { little = true; nano = false; }
  else if (magic === PCAP_MAGIC_BE) { little = false; nano = false; }
  else if (magic === PCAP_MAGIC_NS_LE) { little = true; nano = true; }
  else if (magic === PCAP_MAGIC_NS_BE) { little = false; nano = true; }
  else {
    // pcapng starts with the Section Header Block type 0x0A0D0D0A — call that out specifically.
    if (buf.readUInt32BE(0) === 0x0a0d0d0a) {
      throw new Error('This is a pcapng file. Re-export as classic pcap (Wireshark: “pcap”) to view it here.');
    }
    throw new Error('Not a recognized pcap file (bad magic number).');
  }
  const u32 = (o: number): number => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const linkType = u32(20);

  const notice =
    linkType !== LINKTYPE_ETHERNET
      ? `Unsupported pcap link-layer type ${linkType} — only Ethernet (1) frames can be decoded.`
      : undefined;
  if (linkType !== LINKTYPE_ETHERNET) {
    return { format: 'pcap', events: [], deviceIps: [], notice };
  }

  /** Walk every record, calling `onFrame(frame, timestampMs)`. */
  const eachFrame = (onFrame: (frame: Buffer, ms: number) => void): void => {
    let offset = 24;
    while (offset + 16 <= buf.length) {
      const tsSec = u32(offset);
      const tsFrac = u32(offset + 4);
      const inclLen = u32(offset + 8);
      offset += 16;
      if (inclLen === 0 || offset + inclLen > buf.length) break; // truncated / malformed tail
      const frame = buf.subarray(offset, offset + inclLen);
      const ms = tsSec * 1000 + (nano ? Math.floor(tsFrac / 1e6) : Math.floor(tsFrac / 1000));
      onFrame(frame, ms);
      offset += inclLen;
    }
  };

  // Pass 1: discover the client IPs so the parser can attribute frames to a device.
  const deviceIps = new Set<string>();
  eachFrame((frame) => {
    const ips = extractFrameIps(frame);
    if (!ips) return;
    if (isPrivateClientIp(ips.srcIp)) deviceIps.add(ips.srcIp);
    if (isPrivateClientIp(ips.dstIp)) deviceIps.add(ips.dstIp);
  });

  // Pass 2: decode with the discovered client IPs. Fresh HTTP-stream state so reassembly starts clean.
  const ctx: PacketParseContext = { deviceIps, seenFlows: new Set<string>() };
  resetHttpStreams();
  const events: ParsedNetworkEvent[] = [];
  let seq = 0;
  eachFrame((frame, ms) => {
    const parsed = parseCaptureFrame(frame, ctx);
    for (const ev of parsed) {
      ev.timestamp = new Date(ms).toISOString();
      // Force stable, unique ids — the UI keys rows/selection off `id`, and a fresh offline parse
      // context can't guarantee the live engine's globally-unique numbering.
      ev.id = `pcap-${seq}`;
      seq += 1;
      events.push(ev);
    }
  });

  return { format: 'pcap', events, deviceIps: Array.from(deviceIps), notice };
}

// ── Entry point ────────────────────────────────────────────────────────────────────────────────

export function parseSessionBuffer(filePath: string, buf: Buffer): ParsedSession {
  const format = detectFormat(filePath);
  if (!format) {
    throw new Error('Unsupported file type. Open a .rds-network-inspector.json, .har, or .pcap file.');
  }
  if (format === 'pcap') return parsePcap(buf);
  const text = buf.toString('utf-8');
  return format === 'har' ? parseHar(text) : parseBundle(text);
}

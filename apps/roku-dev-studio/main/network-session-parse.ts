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
import type { ParsedNetworkEvent, NetworkHttpMessage, NetworkTimingPhases } from '../shared/network-inspector/types';
import { S } from '../shared/strings/index';
import {
  parseCaptureFrame,
  extractFrameIps,
  type PacketParseContext
} from 'roku-dev-studio-network-inspector/packet-parser';
import { resetHttpStreams } from 'roku-dev-studio-network-inspector/http-stream-parser';
import { isPrivateClientIp } from './network-inspector/index';

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
    throw new Error(S.networkSessionViewer.errNotSessionFile);
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
type HarTimings = {
  blocked?: number;
  dns?: number;
  connect?: number;
  ssl?: number;
  send?: number;
  wait?: number;
  receive?: number;
};
type HarEntry = {
  startedDateTime?: string;
  time?: number;
  request?: HarMessage;
  response?: HarMessage;
  serverIPAddress?: string;
  timings?: HarTimings;
  comment?: string;
};

/**
 * Rebuild our per-phase `ev.timing` from a HAR entry's `timings` (inverse of `harTimings` in
 * network-export.ts). Gated on a connection phase (dns/connect/ssl) being present: our own no-timing
 * fallback emits only send/wait/receive, and a generic HAR without connection phases shouldn't
 * fabricate a waterfall. Only phases with a real (>= 0) value are carried; -1/absent are dropped.
 */
function harTimingPhases(timings: HarTimings | undefined): NetworkTimingPhases | undefined {
  if (!timings) return undefined;
  const pos = (v: number | undefined): number | undefined =>
    typeof v === 'number' && v >= 0 ? v : undefined;
  const dns = pos(timings.dns);
  const connect = pos(timings.connect);
  const ssl = pos(timings.ssl);
  if (dns === undefined && connect === undefined && ssl === undefined) return undefined;
  const phases: NetworkTimingPhases = {};
  if (dns !== undefined) phases.dnsMs = dns;
  if (connect !== undefined) phases.connectMs = connect;
  if (ssl !== undefined) phases.tlsMs = ssl;
  const send = pos(timings.send);
  const wait = pos(timings.wait);
  const receive = pos(timings.receive);
  if (send !== undefined) phases.sendMs = send;
  if (wait !== undefined) phases.waitMs = wait;
  if (receive !== undefined) phases.receiveMs = receive;
  return Object.keys(phases).length > 0 ? phases : undefined;
}

/** Extract the user note from a HAR entry `comment` (our export writes `… · note: <text>`). */
function noteFromComment(comment: string | undefined): string | undefined {
  if (!comment) return undefined;
  const idx = comment.indexOf('note: ');
  if (idx < 0) return undefined;
  const note = comment.slice(idx + 'note: '.length).trim();
  return note || undefined;
}

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
    throw new Error(S.networkSessionViewer.errNotHar);
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
      timing: harTimingPhases(entry.timings),
      note: noteFromComment(entry.comment),
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

// `isPrivateClientIp` (imported from the engine) treats every RFC1918 endpoint as a "client": offline
// we have no device list, so both request and response frames get attributed and decoded, mirroring
// the hotspot-client semantics without a fixed subnet prefix.

/**
 * Replay a classic-format `.pcap` (not pcapng) through the live frame parser. Reads the 24-byte
 * global header for endianness + link type, then walks each record (16-byte header + frame bytes).
 */
function parsePcap(buf: Buffer): ParsedSession {
  if (buf.length < 24) throw new Error(S.networkSessionViewer.errPcapTooSmall);
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
      throw new Error(S.networkSessionViewer.errPcapng);
    }
    throw new Error(S.networkSessionViewer.errPcapBadMagic);
  }
  const u32 = (o: number): number => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const linkType = u32(20);

  const notice =
    linkType !== LINKTYPE_ETHERNET
      ? S.networkSessionViewer.errPcapLinkType(linkType)
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
    throw new Error(S.networkSessionViewer.errUnsupportedType);
  }
  if (format === 'pcap') return parsePcap(buf);
  const text = buf.toString('utf-8');
  return format === 'har' ? parseHar(text) : parseBundle(text);
}

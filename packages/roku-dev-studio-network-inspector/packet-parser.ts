import type { ParsedNetworkEvent, ParsedNetworkEventType } from './types';
import { feedTcpStream } from './http-stream-parser';

let eventSeq = 0;

function nextId(): string {
  eventSeq += 1;
  return `ni-${Date.now()}-${eventSeq}`;
}

function readUint16(buf: Buffer, offset: number): number {
  return buf.readUInt16BE(offset);
}

export type PacketParseContext = {
  deviceIps: Set<string>;
  /** e.g. `192.168.2` — match client traffic when device list is still populating */
  hotspotSubnetPrefix?: string;
  /** Dedupe outbound TCP flows (device → remote:port) across mid-stream captures */
  seenFlows?: Set<string>;
};

const MAX_SEEN_FLOWS = 20_000;

function rememberFlow(ctx: PacketParseContext, key: string): boolean {
  if (!ctx.seenFlows) ctx.seenFlows = new Set();
  if (ctx.seenFlows.has(key)) return false;
  ctx.seenFlows.add(key);
  if (ctx.seenFlows.size > MAX_SEEN_FLOWS) {
    const drop = Math.floor(MAX_SEEN_FLOWS / 4);
    let i = 0;
    for (const k of ctx.seenFlows) {
      ctx.seenFlows.delete(k);
      if (++i >= drop) break;
    }
  }
  return true;
}

function outboundTcpFlowKey(deviceIp: string, remoteIp: string, remotePort: number): string {
  return `${deviceIp}|${remoteIp}|${remotePort}`;
}

function isHotspotClientIp(ip: string, prefix: string | undefined): boolean {
  if (!prefix) return false;
  if (!ip.startsWith(`${prefix}.`)) return false;
  // Skip typical gateway (.1) — clients are .2+
  return !ip.endsWith('.1');
}

function resolveDeviceIp(srcIp: string, dstIp: string, ctx: PacketParseContext): string {
  if (ctx.deviceIps.has(srcIp)) return srcIp;
  if (ctx.deviceIps.has(dstIp)) return dstIp;
  if (isHotspotClientIp(srcIp, ctx.hotspotSubnetPrefix)) return srcIp;
  if (isHotspotClientIp(dstIp, ctx.hotspotSubnetPrefix)) return dstIp;
  return '';
}

function parseDnsName(buf: Buffer, offset: number): { name: string; next: number } | null {
  const labels: string[] = [];
  let pos = offset;
  let jumped = false;
  let jumpEnd = offset;
  for (let guard = 0; guard < 128; guard++) {
    if (pos >= buf.length) return null;
    const len = buf[pos];
    if (len === 0) {
      const next = jumped ? jumpEnd : pos + 1;
      return { name: labels.join('.'), next };
    }
    if ((len & 0xc0) === 0xc0) {
      if (pos + 1 >= buf.length) return null;
      const ptr = ((len & 0x3f) << 8) | buf[pos + 1];
      if (!jumped) jumpEnd = pos + 2;
      jumped = true;
      pos = ptr;
      continue;
    }
    pos += 1;
    if (pos + len > buf.length) return null;
    labels.push(buf.subarray(pos, pos + len).toString('utf8'));
    pos += len;
  }
  return null;
}

function parseDnsMessage(
  payload: Buffer,
  deviceIp: string,
  timestamp: string
): ParsedNetworkEvent[] {
  if (payload.length < 12) return [];
  const qdCount = payload.readUInt16BE(4);
  let offset = 12;
  const events: ParsedNetworkEvent[] = [];
  for (let i = 0; i < qdCount && offset < payload.length; i++) {
    const parsed = parseDnsName(payload, offset);
    if (!parsed) break;
    offset = parsed.next;
    if (offset + 4 > payload.length) break;
    const qtype = payload.readUInt16BE(offset);
    const qclass = payload.readUInt16BE(offset + 2);
    offset += 4;
    if (qclass !== 1) continue;
    if (qtype === 1 || qtype === 28) {
      events.push({
        id: nextId(),
        type: 'dns-query',
        deviceIp,
        timestamp,
        hostname: parsed.name
      });
    }
  }
  const anCount = payload.readUInt16BE(6);
  for (let i = 0; i < anCount && offset < payload.length; i++) {
    const parsed = parseDnsName(payload, offset);
    if (!parsed) break;
    offset = parsed.next;
    if (offset + 10 > payload.length) break;
    const type = payload.readUInt16BE(offset);
    const class_ = payload.readUInt16BE(offset + 2);
    const ttl = payload.readUInt32BE(offset + 4);
    const rdlen = payload.readUInt16BE(offset + 8);
    offset += 10;
    if (offset + rdlen > payload.length) break;
    const rdata = payload.subarray(offset, offset + rdlen);
    offset += rdlen;
    if (class_ !== 1) continue;
    const resolvedIps: string[] = [];
    if (type === 1 && rdlen === 4) {
      resolvedIps.push(`${rdata[0]}.${rdata[1]}.${rdata[2]}.${rdata[3]}`);
    }
    if (resolvedIps.length > 0) {
      events.push({
        id: nextId(),
        type: 'dns-response',
        deviceIp,
        timestamp,
        hostname: parsed.name,
        resolvedIps,
        ttl
      });
    }
  }
  return events;
}

function parseTlsClientHelloSni(payload: Buffer): string | null {
  if (payload.length < 5 || payload[0] !== 0x16) return null;
  const recLen = payload.readUInt16BE(3);
  if (payload.length < 5 + recLen) return null;
  let offset = 5;
  if (payload[offset] !== 0x01) return null;
  offset += 4;
  offset += 2;
  offset += 32;
  if (offset >= payload.length) return null;
  const sidLen = payload[offset];
  offset += 1 + sidLen;
  if (offset + 2 > payload.length) return null;
  const csLen = payload.readUInt16BE(offset);
  offset += 2 + csLen;
  if (offset >= payload.length) return null;
  const compLen = payload[offset];
  offset += 1 + compLen;
  if (offset + 2 > payload.length) return null;
  const extTotal = payload.readUInt16BE(offset);
  offset += 2;
  const extEnd = offset + extTotal;
  while (offset + 4 <= extEnd && offset + 4 <= payload.length) {
    const extType = payload.readUInt16BE(offset);
    const extLen = payload.readUInt16BE(offset + 2);
    offset += 4;
    if (offset + extLen > payload.length) break;
    if (extType === 0) {
      const sniListLen = payload.readUInt16BE(offset);
      let sniOffset = offset + 2;
      const sniEnd = offset + sniListLen;
      while (sniOffset + 3 <= sniEnd) {
        const nameType = payload[sniOffset];
        const nameLen = payload.readUInt16BE(sniOffset + 1);
        sniOffset += 3;
        if (nameType === 0 && sniOffset + nameLen <= payload.length) {
          return payload.subarray(sniOffset, sniOffset + nameLen).toString('utf8');
        }
        sniOffset += nameLen;
      }
    }
    offset += extLen;
  }
  return null;
}

function ipOffsetForFrame(frame: Buffer): number {
  // Prefer Ethernet (bridge100 / EN10MB) so a MAC byte is not mistaken for an IPv4 header.
  if (frame.length >= 34 && readUint16(frame, 12) === 0x0800) return 14;
  if (frame.length >= 20 && (frame[0] >> 4) === 4) return 0;
  return -1;
}

function parseIpPacket(frame: Buffer, ipOffset: number, ctx: PacketParseContext, timestamp: string): ParsedNetworkEvent[] {
  if (frame.length < ipOffset + 20) return [];
  const versionIhl = frame[ipOffset];
  const ihl = (versionIhl & 0x0f) * 4;
  if (ihl < 20 || frame.length < ipOffset + ihl) return [];
  const protocol = frame[ipOffset + 9];
  const srcIp = `${frame[ipOffset + 12]}.${frame[ipOffset + 13]}.${frame[ipOffset + 14]}.${frame[ipOffset + 15]}`;
  const dstIp = `${frame[ipOffset + 16]}.${frame[ipOffset + 17]}.${frame[ipOffset + 18]}.${frame[ipOffset + 19]}`;
  const deviceIp = resolveDeviceIp(srcIp, dstIp, ctx);
  if (!deviceIp) return [];

  const transportOffset = ipOffset + ihl;
  if (protocol === 17) {
    if (frame.length < transportOffset + 8) return [];
    const srcPort = frame.readUInt16BE(transportOffset);
    const dstPort = frame.readUInt16BE(transportOffset + 2);
    const payload = frame.subarray(transportOffset + 8);
    if (srcPort === 53 || dstPort === 53) {
      return parseDnsMessage(payload, deviceIp, timestamp);
    }
    return [
      {
        id: nextId(),
        type: 'udp-datagram',
        deviceIp,
        timestamp,
        destIp: deviceIp === srcIp ? dstIp : srcIp,
        destPort: deviceIp === srcIp ? dstPort : srcPort
      }
    ];
  }
  if (protocol === 6) {
    if (frame.length < transportOffset + 20) return [];
    const srcPort = frame.readUInt16BE(transportOffset);
    const dstPort = frame.readUInt16BE(transportOffset + 2);
    const dataOffset = ((frame[transportOffset + 12] >> 4) & 0x0f) * 4;
    const payload = frame.subarray(transportOffset + dataOffset);
    const outbound = deviceIp === srcIp;
    const remoteIp = outbound ? dstIp : srcIp;
    const remotePort = outbound ? dstPort : srcPort;
    const tcpFlags = frame[transportOffset + 13];
    // FIN (0x01) or RST (0x04) closes the flow — lets the HTTP reassembler finalize a
    // length-unknown (connection-close-delimited) response.
    const finOrRst = (tcpFlags & 0x01) !== 0 || (tcpFlags & 0x04) !== 0;
    const events: ParsedNetworkEvent[] = [];

    if (payload.length > 0 || finOrRst) {
      events.push(
        ...feedTcpStream({
          deviceIp,
          srcIp,
          dstIp,
          srcPort,
          dstPort,
          payload,
          timestamp,
          finOrRst
        })
      );
    }

    if (outbound && remotePort === 443) {
      const sni = parseTlsClientHelloSni(payload);
      if (sni) {
        rememberFlow(ctx, outboundTcpFlowKey(deviceIp, remoteIp, remotePort));
        events.push({
          id: nextId(),
          type: 'tls-handshake',
          deviceIp,
          timestamp,
          sni,
          hostname: sni,
          destIp: remoteIp,
          destPort: remotePort
        });
      }
    }

    if (events.length > 0) return events;

    const flags = tcpFlags;
    if (flags & 0x02 && !(flags & 0x10)) {
      if (outbound && rememberFlow(ctx, outboundTcpFlowKey(deviceIp, remoteIp, remotePort))) {
        return [
          {
            id: nextId(),
            type: 'tcp-connection',
            deviceIp,
            timestamp,
            destIp: remoteIp,
            destPort: remotePort
          }
        ];
      }
    }

    if (
      outbound &&
      (remotePort === 443 || remotePort === 80) &&
      rememberFlow(ctx, outboundTcpFlowKey(deviceIp, remoteIp, remotePort))
    ) {
      return [
        {
          id: nextId(),
          type: 'tcp-connection',
          deviceIp,
          timestamp,
          destIp: remoteIp,
          destPort: remotePort
        }
      ];
    }
  }
  return [];
}

/** Parse a pcap frame (Ethernet or raw IP — bridge interfaces often use raw IP on macOS). */
export function parseCaptureFrame(frame: Buffer, ctx: PacketParseContext): ParsedNetworkEvent[] {
  const ipOffset = ipOffsetForFrame(frame);
  if (ipOffset < 0) return [];
  return parseIpPacket(frame, ipOffset, ctx, new Date().toISOString());
}

/**
 * Extract the source/destination IPv4 addresses from a captured frame, or null if the frame
 * isn't a parseable IPv4 packet. Used to scope a pcap export to a single device's traffic
 * without re-running the full event parser.
 */
export function extractFrameIps(frame: Buffer): { srcIp: string; dstIp: string } | null {
  const ipOffset = ipOffsetForFrame(frame);
  if (ipOffset < 0) return null;
  if (frame.length < ipOffset + 20) return null;
  const versionIhl = frame[ipOffset];
  const ihl = (versionIhl & 0x0f) * 4;
  if (ihl < 20 || frame.length < ipOffset + ihl) return null;
  const srcIp = `${frame[ipOffset + 12]}.${frame[ipOffset + 13]}.${frame[ipOffset + 14]}.${frame[ipOffset + 15]}`;
  const dstIp = `${frame[ipOffset + 16]}.${frame[ipOffset + 17]}.${frame[ipOffset + 18]}.${frame[ipOffset + 19]}`;
  return { srcIp, dstIp };
}

/** @deprecated Use parseCaptureFrame */
export function parseEthernetFrame(frame: Buffer, deviceIps: Set<string>): ParsedNetworkEvent[] {
  return parseCaptureFrame(frame, { deviceIps });
}

export function eventTypeLabel(type: ParsedNetworkEventType): string {
  switch (type) {
    case 'dns-query':
      return 'DNS query';
    case 'dns-response':
      return 'DNS response';
    case 'tls-handshake':
      return 'TLS SNI';
    case 'tcp-connection':
      return 'TCP';
    case 'http-transaction':
      return 'HTTP';
    case 'udp-datagram':
      return 'UDP';
    default:
      return type;
  }
}

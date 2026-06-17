import type { NetworkHttpMessage, ParsedNetworkEvent } from './types';

const MAX_FLOW_BYTES = 256 * 1024;

type FlowState = {
  deviceIp: string;
  localPort: number;
  remoteIp: string;
  remotePort: number;
  outbound: Buffer;
  inbound: Buffer;
  emitted: boolean;
};

const flows = new Map<string, FlowState>();
let eventSeq = 0;

function nextId(): string {
  eventSeq += 1;
  return `ni-http-${Date.now()}-${eventSeq}`;
}

function flowKey(deviceIp: string, localPort: number, remoteIp: string, remotePort: number): string {
  return `${deviceIp}|${localPort}|${remoteIp}|${remotePort}`;
}

function appendChunk(buf: Buffer, chunk: Buffer): Buffer {
  if (chunk.length === 0) return buf;
  const next = Buffer.concat([buf, chunk]);
  if (next.length <= MAX_FLOW_BYTES) return next;
  return next.subarray(next.length - MAX_FLOW_BYTES);
}

function parseHttpMessage(raw: Buffer, isRequest: boolean): NetworkHttpMessage | null {
  if (raw.length < 4) return null;
  const text = raw.toString('utf8');
  const sep = text.indexOf('\r\n\r\n');
  if (sep < 0) return null;
  const headerBlock = text.slice(0, sep);
  const bodyRaw = raw.subarray(sep + 4);
  const lines = headerBlock.split('\r\n');
  if (lines.length === 0) return null;
  const start = lines[0];
  const headers: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (name) headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
  }

  if (isRequest) {
    const m = start.match(/^([A-Z]+)\s+(\S+)\s+HTTP\/[\d.]+$/i);
    if (!m) return null;
    const bodyText = bodyRaw.toString('utf8');
    return {
      method: m[1].toUpperCase(),
      url: m[2],
      headers,
      body: bodyText || undefined,
      bodyTruncated: bodyRaw.length >= MAX_FLOW_BYTES
    };
  }

  const m = start.match(/^HTTP\/[\d.]+\s+(\d{3})(?:\s+(.*))?$/i);
  if (!m) return null;
  const bodyText = bodyRaw.toString('utf8');
  return {
    statusCode: Number(m[1]),
    statusText: m[2] || undefined,
    headers,
    body: bodyText || undefined,
    bodyTruncated: bodyRaw.length >= MAX_FLOW_BYTES
  };
}

function tryEmitHttpTransaction(flow: FlowState, timestamp: string): ParsedNetworkEvent | null {
  if (flow.emitted) return null;
  const request = parseHttpMessage(flow.outbound, true);
  const response = parseHttpMessage(flow.inbound, false);
  if (!request) return null;
  if (!response && flow.inbound.length < 16) return null;
  flow.emitted = true;
  const host = request.headers?.host || request.url;
  return {
    id: nextId(),
    type: 'http-transaction',
    deviceIp: flow.deviceIp,
    timestamp,
    hostname: host,
    destIp: flow.remoteIp,
    destPort: flow.remotePort,
    flowId: flowKey(flow.deviceIp, flow.localPort, flow.remoteIp, flow.remotePort),
    httpRequest: request,
    httpResponse: response || undefined
  };
}

export function feedTcpStream(args: {
  deviceIp: string;
  srcIp: string;
  dstIp: string;
  srcPort: number;
  dstPort: number;
  payload: Buffer;
  timestamp: string;
}): ParsedNetworkEvent[] {
  if (args.payload.length === 0) return [];
  const outbound = args.srcIp === args.deviceIp;
  const inbound = args.dstIp === args.deviceIp;
  if (!outbound && !inbound) return [];

  const localPort = outbound ? args.srcPort : args.dstPort;
  const remoteIp = outbound ? args.dstIp : args.srcIp;
  const remotePort = outbound ? args.dstPort : args.srcPort;
  if (remotePort !== 80) return [];

  const key = flowKey(args.deviceIp, localPort, remoteIp, remotePort);
  let flow = flows.get(key);
  if (!flow) {
    flow = {
      deviceIp: args.deviceIp,
      localPort,
      remoteIp,
      remotePort,
      outbound: Buffer.alloc(0),
      inbound: Buffer.alloc(0),
      emitted: false
    };
    flows.set(key, flow);
  }
  if (outbound) flow.outbound = appendChunk(flow.outbound, args.payload);
  else flow.inbound = appendChunk(flow.inbound, args.payload);

  if (flows.size > 2000) {
    const drop = flows.keys().next().value;
    if (drop) flows.delete(drop);
  }

  const ev = tryEmitHttpTransaction(flow, args.timestamp);
  return ev ? [ev] : [];
}

export function resetHttpStreams(): void {
  flows.clear();
}

import type { NetworkHttpMessage, ParsedNetworkEvent } from './types';

/**
 * Passive plaintext-HTTP (port 80) reassembler for captured TCP payloads.
 *
 * Correctness notes (this replaced an earlier version that had two data-loss bugs):
 *  - It NEVER head-truncates a flow buffer. The old code kept only the *last* 256 KB,
 *    which dropped the request line / headers once a body exceeded the cap, so the
 *    parser silently stopped matching. Here the cap only ever bounds the *tail* (body),
 *    with `bodyTruncated` flagged — headers are always preserved.
 *  - It determines message completeness from Content-Length / Transfer-Encoding: chunked
 *    (and bodyless statuses), instead of emitting on the first response segment and
 *    latching. Bodies split across TCP segments are reassembled before emit.
 *  - Keep-alive connections carry multiple request/response pairs; completed messages are
 *    consumed from the buffers and paired FIFO (the HTTP/1.1 response-ordering guarantee),
 *    so a reused connection surfaces every transaction, not just the first.
 *  - Length-unknown responses (no Content-Length, not chunked — delimited by connection
 *    close) are held until a FIN/RST is observed for the flow, or until the cap forces a
 *    truncated emit.
 */

/** Per-direction cap. Bounds memory; overflow emits a `bodyTruncated` message rather than growing. */
const MAX_FLOW_BYTES = 256 * 1024;
/** Global cap on concurrently-tracked flows (oldest evicted). */
const MAX_FLOWS = 2000;

type FlowState = {
  deviceIp: string;
  localPort: number;
  remoteIp: string;
  remotePort: number;
  /** Unconsumed request bytes (device → remote). */
  outbound: Buffer;
  /** Unconsumed response bytes (remote → device). */
  inbound: Buffer;
  /** Completed-but-unpaired parsed messages, in arrival order. */
  requests: NetworkHttpMessage[];
  responses: NetworkHttpMessage[];
  /** Set once a FIN/RST is seen for the 4-tuple; finalizes length-unknown responses. */
  closed: boolean;
  /** A direction produced non-HTTP / malformed bytes — stop parsing it (bound memory). */
  outboundDead: boolean;
  inboundDead: boolean;
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

function parseStartAndHeaders(
  headerBlock: string
): { start: string; headers: Record<string, string> } | null {
  const lines = headerBlock.split('\r\n');
  if (lines.length === 0 || !lines[0]) return null;
  const headers: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (name) headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
  }
  return { start: lines[0], headers };
}

/**
 * Find the end index (exclusive) of a chunked body starting at `bodyStart`, or null if more
 * bytes are needed. Handles the common `size CRLF data CRLF … 0 CRLF CRLF` framing; trailers
 * (rare, and not used by Roku) collapse to the first CRLF after the terminating 0-chunk.
 */
function scanChunkedEnd(buf: Buffer, bodyStart: number): number | null {
  let pos = bodyStart;
  for (;;) {
    const lineEnd = buf.indexOf('\r\n', pos);
    if (lineEnd < 0) return null; // need more
    const sizeStr = buf.toString('ascii', pos, lineEnd);
    const semi = sizeStr.indexOf(';');
    const hex = (semi >= 0 ? sizeStr.slice(0, semi) : sizeStr).trim();
    const size = parseInt(hex, 16);
    if (!Number.isFinite(size) || size < 0) return null; // malformed → wait/cap
    const dataStart = lineEnd + 2;
    if (size === 0) {
      // Terminating chunk: consume trailer section up to the closing CRLF.
      const trailerEnd = buf.indexOf('\r\n', dataStart);
      if (trailerEnd < 0) return null;
      return trailerEnd + 2;
    }
    const dataEnd = dataStart + size;
    if (dataEnd + 2 > buf.length) return null; // need data + trailing CRLF
    pos = dataEnd + 2;
  }
}

/** Decode a complete chunked body [bodyStart, bodyEnd) into its concatenated content bytes. */
function decodeChunked(buf: Buffer, bodyStart: number, bodyEnd: number): Buffer {
  const parts: Buffer[] = [];
  let pos = bodyStart;
  while (pos < bodyEnd) {
    const lineEnd = buf.indexOf('\r\n', pos);
    if (lineEnd < 0 || lineEnd >= bodyEnd) break;
    const sizeStr = buf.toString('ascii', pos, lineEnd);
    const semi = sizeStr.indexOf(';');
    const size = parseInt((semi >= 0 ? sizeStr.slice(0, semi) : sizeStr).trim(), 16);
    if (!Number.isFinite(size) || size <= 0) break; // 0 = terminator, or malformed
    const dataStart = lineEnd + 2;
    const dataEnd = Math.min(dataStart + size, bodyEnd);
    parts.push(buf.subarray(dataStart, dataEnd));
    pos = dataEnd + 2;
  }
  return parts.length ? Buffer.concat(parts) : Buffer.alloc(0);
}

/**
 * Some hotspot/captive-portal forward proxies rewrite the request target to carry the real
 * destination as a semicolon "matrix param" after their own path, e.g.
 * `http://192.168.11.105:8080/;https://real-target.example/path`. Passive (non-MITM) hotspot
 * capture sees the proxy as the literal TCP peer, which then surfaces as the "Remote Address" for
 * every UI reader of `httpRequest.url` — unwrap back to the real target here, once, upstream of
 * all of them.
 */
function unwrapProxyEmbeddedTarget(raw: string): string {
  const m = /;(https?:\/\/.+)$/i.exec(raw);
  return m ? m[1] : raw;
}

type ExtractResult =
  | { status: 'need-more' }
  | { status: 'none' }
  | { status: 'message'; message: NetworkHttpMessage; consumed: number };

/**
 * Try to extract one complete HTTP message from the front of `buf`.
 * `closed` = the flow's connection has closed (lets length-unknown responses finalize).
 */
function extractMessage(buf: Buffer, isRequest: boolean, closed: boolean): ExtractResult {
  const headerEnd = buf.indexOf('\r\n\r\n');
  if (headerEnd < 0) {
    // No header terminator yet. If we've buffered more than the cap without one, this isn't
    // parseable HTTP (or is hopelessly malformed) — give up on the direction.
    return buf.length > MAX_FLOW_BYTES ? { status: 'none' } : { status: 'need-more' };
  }

  const parsed = parseStartAndHeaders(buf.toString('utf8', 0, headerEnd));
  if (!parsed) return { status: 'none' };
  const { start, headers } = parsed;

  let method: string | undefined;
  let url: string | undefined;
  let statusCode: number | undefined;
  let statusText: string | undefined;
  if (isRequest) {
    const m = start.match(/^([A-Z]+)\s+(\S+)\s+HTTP\/[\d.]+$/i);
    if (!m) return { status: 'none' };
    method = m[1].toUpperCase();
    url = unwrapProxyEmbeddedTarget(m[2]);
  } else {
    const m = start.match(/^HTTP\/[\d.]+\s+(\d{3})(?:\s+(.*))?$/i);
    if (!m) return { status: 'none' };
    statusCode = Number(m[1]);
    statusText = m[2] || undefined;
  }

  const bodyStart = headerEnd + 4;
  const te = (headers['transfer-encoding'] || '').toLowerCase();
  const clRaw = headers['content-length'];
  const cl = clRaw != null ? parseInt(clRaw, 10) : NaN;
  const isChunked = te.includes('chunked');
  // 1xx / 204 / 304 never carry a body regardless of headers.
  const bodylessStatus = statusCode != null && (statusCode < 200 || statusCode === 204 || statusCode === 304);

  let bodyEnd: number;
  let truncated = false;

  const capOrClosed = buf.length > MAX_FLOW_BYTES || closed;

  if (bodylessStatus) {
    bodyEnd = bodyStart;
  } else if (isRequest && !isChunked && !(Number.isFinite(cl) && cl > 0)) {
    // Request with neither chunked nor a positive Content-Length has no body (GET/HEAD/…).
    bodyEnd = bodyStart;
  } else if (isChunked) {
    const end = scanChunkedEnd(buf, bodyStart);
    if (end == null) {
      if (!capOrClosed) return { status: 'need-more' };
      bodyEnd = buf.length;
      truncated = true;
    } else {
      bodyEnd = end;
    }
  } else if (Number.isFinite(cl) && cl >= 0) {
    const want = bodyStart + cl;
    if (buf.length >= want) {
      bodyEnd = want;
    } else if (capOrClosed) {
      bodyEnd = buf.length;
      truncated = true;
    } else {
      return { status: 'need-more' };
    }
  } else {
    // Response with no Content-Length and not chunked → body ends at connection close.
    if (closed) {
      bodyEnd = buf.length;
    } else if (buf.length > MAX_FLOW_BYTES) {
      bodyEnd = buf.length;
      truncated = true;
    } else {
      return { status: 'need-more' };
    }
  }

  // For chunked bodies, decode the transfer-encoding into the actual content; otherwise the
  // body is the raw bytes between header end and body end.
  const bodyBuf = isChunked
    ? decodeChunked(buf, bodyStart, bodyEnd)
    : buf.subarray(bodyStart, bodyEnd);
  const bodyText = bodyBuf.length ? bodyBuf.toString('utf8') : undefined;
  const message: NetworkHttpMessage = isRequest
    ? { method, url, headers, body: bodyText, bodyTruncated: truncated }
    : { statusCode, statusText, headers, body: bodyText, bodyTruncated: truncated };
  return { status: 'message', message, consumed: bodyEnd };
}

/** Drain all currently-complete messages from one direction into its queue. */
function drainDirection(flow: FlowState, isRequest: boolean): void {
  for (;;) {
    const buf = isRequest ? flow.outbound : flow.inbound;
    if (buf.length === 0) break;
    const r = extractMessage(buf, isRequest, flow.closed);
    if (r.status === 'need-more') break;
    if (r.status === 'none') {
      // Non-HTTP / unrecoverable — drop the buffer and stop parsing this direction so it
      // can't grow unbounded, but leave the other direction alone.
      if (isRequest) {
        flow.outbound = Buffer.alloc(0);
        flow.outboundDead = true;
      } else {
        flow.inbound = Buffer.alloc(0);
        flow.inboundDead = true;
      }
      break;
    }
    (isRequest ? flow.requests : flow.responses).push(r.message);
    const rest = buf.subarray(r.consumed);
    if (isRequest) flow.outbound = rest;
    else flow.inbound = rest;
  }
}

/** When the request line is itself absolute-form (`GET https://host/path HTTP/1.1`, sent to an
 *  explicit proxy), its own authority is the real target — and is authoritative over `Host`,
 *  which some simple device HTTP clients set to the proxy's address instead of the target's. */
function absoluteFormHost(request: NetworkHttpMessage | undefined): string | undefined {
  if (!request?.url || !/^https?:\/\//i.test(request.url)) return undefined;
  try {
    return new URL(request.url).host;
  } catch {
    return undefined;
  }
}

function makeEvent(
  flow: FlowState,
  request: NetworkHttpMessage | undefined,
  response: NetworkHttpMessage | undefined,
  timestamp: string
): ParsedNetworkEvent {
  const host = absoluteFormHost(request) || request?.headers?.host || request?.url || flow.remoteIp;
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

/** Pair completed requests/responses FIFO; on close, flush any unpaired leftovers. */
function pairAndEmit(flow: FlowState, timestamp: string): ParsedNetworkEvent[] {
  const out: ParsedNetworkEvent[] = [];
  while (flow.requests.length > 0 && flow.responses.length > 0) {
    out.push(makeEvent(flow, flow.requests.shift(), flow.responses.shift(), timestamp));
  }
  if (flow.closed) {
    while (flow.requests.length > 0) out.push(makeEvent(flow, flow.requests.shift(), undefined, timestamp));
    while (flow.responses.length > 0) out.push(makeEvent(flow, undefined, flow.responses.shift(), timestamp));
  }
  return out;
}

export function feedTcpStream(args: {
  deviceIp: string;
  srcIp: string;
  dstIp: string;
  srcPort: number;
  dstPort: number;
  payload: Buffer;
  timestamp: string;
  /** TCP FIN or RST seen on this segment — finalizes the flow. */
  finOrRst?: boolean;
}): ParsedNetworkEvent[] {
  const outbound = args.srcIp === args.deviceIp;
  const inbound = args.dstIp === args.deviceIp;
  if (!outbound && !inbound) return [];
  if (args.payload.length === 0 && !args.finOrRst) return [];

  const localPort = outbound ? args.srcPort : args.dstPort;
  const remoteIp = outbound ? args.dstIp : args.srcIp;
  const remotePort = outbound ? args.dstPort : args.srcPort;
  if (remotePort !== 80) return [];

  const key = flowKey(args.deviceIp, localPort, remoteIp, remotePort);
  let flow = flows.get(key);
  if (!flow) {
    // A pure FIN/RST for a flow we never tracked carries nothing to emit.
    if (args.payload.length === 0) return [];
    flow = {
      deviceIp: args.deviceIp,
      localPort,
      remoteIp,
      remotePort,
      outbound: Buffer.alloc(0),
      inbound: Buffer.alloc(0),
      requests: [],
      responses: [],
      closed: false,
      outboundDead: false,
      inboundDead: false
    };
    flows.set(key, flow);
  }

  if (args.payload.length > 0) {
    if (outbound && !flow.outboundDead) {
      flow.outbound = Buffer.concat([flow.outbound, args.payload]);
    } else if (inbound && !flow.inboundDead) {
      flow.inbound = Buffer.concat([flow.inbound, args.payload]);
    }
  }
  if (args.finOrRst) flow.closed = true;

  if (flows.size > MAX_FLOWS) {
    const drop = flows.keys().next().value;
    if (drop && drop !== key) flows.delete(drop);
  }

  if (!flow.outboundDead) drainDirection(flow, true);
  if (!flow.inboundDead) drainDirection(flow, false);
  const events = pairAndEmit(flow, args.timestamp);

  // Once closed and fully drained/paired, forget the flow so its buffers are freed.
  if (flow.closed && flow.requests.length === 0 && flow.responses.length === 0) {
    flows.delete(key);
  }

  return events;
}

export function resetHttpStreams(): void {
  flows.clear();
}

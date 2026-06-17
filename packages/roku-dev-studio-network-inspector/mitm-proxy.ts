import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as tls from 'tls';
import { createLeafCert, type CaMaterial } from './ca-store';
import { parseRokuProxyTarget, normalizeProxyHostPort } from './roku-proxy-url';
import type { MockResponse, NetworkHttpMessage, TrafficDecision, TrafficThrottle } from './types';
import { throttleIsActive } from './types';

/**
 * Write `body` to a sink at a throttled rate. `downKbps` paces output in ~50ms chunks to approximate
 * the bandwidth limit; `latencyMs` delays the first byte. Falls back to a single write when no
 * bandwidth cap is set. Used to simulate slow/laggy networks for proxied responses.
 */
function writeBodyThrottled(
  write: (chunk: Buffer) => void,
  end: () => void,
  body: Buffer,
  throttle: TrafficThrottle
): void {
  const downKbps = typeof throttle.downKbps === 'number' && throttle.downKbps > 0 ? throttle.downKbps : 0;
  const latencyMs = typeof throttle.latencyMs === 'number' && throttle.latencyMs > 0 ? throttle.latencyMs : 0;
  if (!body.length) {
    if (latencyMs) setTimeout(end, latencyMs);
    else end();
    return;
  }
  if (!downKbps) {
    setTimeout(
      () => {
        try {
          write(body);
        } catch {
          /* socket gone */
        }
        end();
      },
      latencyMs
    );
    return;
  }
  const bytesPerSec = (downKbps * 1000) / 8;
  const tickMs = 50;
  const chunkSize = Math.max(1, Math.floor((bytesPerSec * tickMs) / 1000));
  let offset = 0;
  const pump = (): void => {
    if (offset >= body.length) {
      try {
        end();
      } catch {
        /* ignore */
      }
      return;
    }
    const slice = body.subarray(offset, offset + chunkSize);
    offset += slice.length;
    try {
      write(slice);
    } catch {
      return;
    }
    setTimeout(pump, tickMs);
  };
  if (latencyMs) setTimeout(pump, latencyMs);
  else pump();
}

export type MitmTransaction = {
  transactionId: string;
  deviceIp: string;
  timestamp: string;
  hostname: string;
  destPort?: number;
  request: NetworkHttpMessage;
  response: NetworkHttpMessage;
  durationMs?: number;
};

export type MitmProxyOptions = {
  port: number;
  ca: CaMaterial;
  onTransaction: (tx: MitmTransaction) => void;
  isHotspotClient: (ip: string) => boolean;
  gatewayIp?: string;
  onListening?: () => void;
  /**
   * Fired when the server emits an error after `start()` returned — most importantly the
   * asynchronous `EADDRINUSE` raised during `listen()` when the port is already taken. Lets the
   * owner surface which process holds the port instead of swallowing the failure.
   */
  onError?: (message: string) => void;
  /** Resolve the block/throttle/mock decision for a proxied request (device IP + host + path). */
  getTrafficDecision?: (deviceIp: string, hostname: string, path: string) => TrafficDecision;
};

// Per-message raw body capture cap. Sized so typical media (posters, thumbnails, small
// JPEG/PNG/WebP assets) is captured whole and can render as an <img> preview — the old
// 512 KB cap truncated common artwork, corrupting it. Beyond this the body is marked
// truncated and the UI shows a "preview unavailable" note instead of a broken image.
// Keep in sync with MAX_BASE64_CHARS in mitm-events.ts (base64 is ~4/3 the raw size).
const MAX_BODY_BYTES = 4_000_000;
// Socket idle timeout: fire if the upstream sends no data for this long.
const REQUEST_TIMEOUT_MS = 30_000;
// Absolute backstop so a transaction can never stay "Pending" indefinitely, even if the
// upstream stalls mid-body or the socket aborts without a clean 'error'/'end'.
const HARD_TIMEOUT_MS = 45_000;
// Cap retained per-host leaf certs so a long session minting many SNI certs can't grow unbounded.
const MAX_LEAF_CACHE = 256;
// Guard the manual TLS request-head parser against an unbounded header block.
const MAX_REQUEST_HEADER_BYTES = 64 * 1024;
const HEADER_SEP = Buffer.from('\r\n\r\n');
const CRLF = Buffer.from('\r\n');

/** Parse a CONNECT target into host/port, handling IPv6 literals like `[::1]:443`. */
function parseConnectTarget(target: string): { host: string; port: number } | null {
  const t = (target || '').trim();
  if (!t) return null;
  if (t.startsWith('[')) {
    const close = t.indexOf(']');
    if (close < 0) return null;
    const host = t.slice(1, close);
    const rest = t.slice(close + 1);
    const port = rest.startsWith(':') ? Number(rest.slice(1)) : 443;
    if (!host || !Number.isFinite(port) || port <= 0) return null;
    return { host, port };
  }
  const lastColon = t.lastIndexOf(':');
  if (lastColon < 0) return { host: t, port: 443 };
  // A bare IPv6 literal (multiple colons, no brackets) has no parseable port — treat as host:443.
  if (t.indexOf(':') !== lastColon) return { host: t, port: 443 };
  const host = t.slice(0, lastColon);
  const port = Number(t.slice(lastColon + 1));
  if (!host || !Number.isFinite(port) || port <= 0) return null;
  return { host, port };
}

/** Parse the request line + headers from a decoded HTTP head block. */
function parseRequestHead(
  headerBlock: string
): { method: string; path: string; headers: Record<string, string> } | null {
  const lines = headerBlock.split('\r\n');
  const m = /^(\w+)\s+(\S+)\s+HTTP/i.exec(lines[0] || '');
  if (!m) return null;
  const headers: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const colon = lines[i]!.indexOf(':');
    if (colon < 0) continue;
    headers[lines[i]!.slice(0, colon).trim().toLowerCase()] = lines[i]!.slice(colon + 1).trim();
  }
  return { method: m[1]!, path: m[2]!, headers };
}

/**
 * De-chunk a (possibly partial) HTTP/1.1 chunked body. `complete` is set once the terminal
 * zero-length chunk is seen; until then the caller should keep buffering.
 */
function decodeChunkedBody(buf: Buffer): { body: Buffer; complete: boolean } {
  const parts: Buffer[] = [];
  let offset = 0;
  while (offset < buf.length) {
    const lineEnd = buf.indexOf(CRLF, offset);
    if (lineEnd < 0) break;
    const sizeStr = buf.subarray(offset, lineEnd).toString('latin1').split(';')[0]!.trim();
    const size = parseInt(sizeStr, 16);
    if (!Number.isFinite(size) || size < 0) break;
    if (size === 0) return { body: Buffer.concat(parts), complete: true };
    const dataStart = lineEnd + 2;
    const dataEnd = dataStart + size;
    if (dataEnd + 2 > buf.length) break; // need the chunk data + its trailing CRLF
    parts.push(buf.subarray(dataStart, dataEnd));
    offset = dataEnd + 2;
  }
  return { body: Buffer.concat(parts), complete: false };
}

/** Path portion of a URL for path-based traffic rules; falls back to the raw string on parse error. */
function urlPath(fullUrl: string): string {
  try {
    const u = new URL(fullUrl);
    return `${u.pathname}${u.search}`;
  } catch {
    return fullUrl;
  }
}

/** Merge a MockResponse's content-type into its header map (lowercased keys). */
function mockHeaders(mock: MockResponse): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(mock.headers || {})) out[k.toLowerCase()] = v;
  if (mock.contentType) out['content-type'] = mock.contentType;
  return out;
}

function newTransactionId(): string {
  return `mitm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeHeaders(raw: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue;
    out[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

function stripHopByHop(headers: Record<string, string>): Record<string, string> {
  const drop = new Set([
    'connection',
    'proxy-connection',
    'keep-alive',
    'transfer-encoding',
    'te',
    'trailer',
    'upgrade',
    'host',
    'content-length'
  ]);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!drop.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

function toClientResponseHeaders(
  upstream: Record<string, string>,
  bodyLength: number,
  method: string
): Record<string, string> {
  const out = stripHopByHop(upstream);
  if (method !== 'HEAD' && bodyLength > 0) {
    out['content-length'] = String(bodyLength);
  }
  out.connection = 'close';
  return out;
}

function decodeRequestUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function requestSnapshotFromIncoming(
  req: http.IncomingMessage,
  targetUrl: string
): NetworkHttpMessage {
  return {
    method: req.method || 'GET',
    url: targetUrl,
    headers: normalizeHeaders(req.headers)
  };
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Reads a response body up to `MAX_BODY_BYTES`. Returns the captured buffer plus a
 * `truncated` flag. `truncated` is set whenever we hit the cap and destroy the stream —
 * inferring truncation from final buffer length is unreliable because we stop *before*
 * pushing the chunk that crosses the cap, so the final length can land just under it.
 * A wrong flag matters for binary previews: a partial JPEG is undecodable, so the UI
 * must show "truncated" rather than render a broken <img>.
 */
function readResponseBody(res: http.IncomingMessage): Promise<{ buffer: Buffer; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let done = false;
    let truncated = false;
    const settle = (fn: () => void): void => {
      if (done) return;
      done = true;
      fn();
    };
    res.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        truncated = true;
        res.destroy();
        settle(() => resolve({ buffer: Buffer.concat(chunks), truncated }));
        return;
      }
      chunks.push(chunk);
    });
    res.on('end', () => settle(() => resolve({ buffer: Buffer.concat(chunks), truncated })));
    res.on('error', (err) => settle(() => reject(err)));
    // A destroyed/aborted upstream emits 'aborted'/'close' without a clean 'end'; resolve
    // with whatever we have so the caller never hangs waiting on the body.
    res.on('aborted', () => settle(() => resolve({ buffer: Buffer.concat(chunks), truncated })));
    res.on('close', () => settle(() => resolve({ buffer: Buffer.concat(chunks), truncated })));
  });
}

function bodyToText(buf: Buffer, headers: Record<string, string>): string {
  if (!buf.length) return '';
  const ct = headers['content-type'] || headers['Content-Type'] || '';
  const charsetMatch = /charset=([^;\s]+)/i.exec(ct);
  const charset = charsetMatch?.[1]?.replace(/['"]/g, '') || 'utf8';
  try {
    return buf.toString(charset as BufferEncoding);
  } catch {
    return buf.toString('utf8');
  }
}

function contentTypeOf(headers: Record<string, string>): string {
  return (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
}

/** Textual payloads are charset-decoded; everything else is preserved as raw bytes (base64). */
function isTextualContentType(ct: string): boolean {
  if (!ct) return true; // unknown → assume text (matches previous behavior)
  if (ct.startsWith('text/')) return true;
  return /(json|xml|javascript|ecmascript|graphql|csv|x-www-form-urlencoded|svg)/.test(ct);
}

/** Encode a captured body: text via charset, binary (images/video/etc.) as base64. */
function encodeBody(
  buf: Buffer,
  headers: Record<string, string>,
  hitCap: boolean
): Pick<NetworkHttpMessage, 'body' | 'bodyEncoding' | 'bodyTruncated'> {
  if (!buf.length) return {};
  const truncated = hitCap ? { bodyTruncated: true } : {};
  if (isTextualContentType(contentTypeOf(headers))) {
    return { body: bodyToText(buf, headers), bodyEncoding: 'text', ...truncated };
  }
  return { body: buf.toString('base64'), bodyEncoding: 'base64', ...truncated };
}

export class RokuMitmProxy {
  private server: http.Server | null = null;
  private readonly leafCache = new Map<string, { certPem: string; keyPem: string }>();
  private readonly transactionStarts = new Map<string, number>();
  private running = false;
  private lastError: string | undefined;
  private readonly opts: MitmProxyOptions;

  constructor(opts: MitmProxyOptions) {
    this.opts = opts;
  }

  isRunning(): boolean {
    return !!(this.server?.listening || this.running);
  }

  getLastError(): string | undefined {
    return this.lastError;
  }

  getListenAddress(gatewayIp?: string): string {
    const host = gatewayIp || this.opts.gatewayIp || '0.0.0.0';
    return `${host}:${this.opts.port}`;
  }

  start(): boolean {
    if (this.server) return true;
    this.lastError = undefined;
    try {
      this.server = http.createServer((req, res) => {
        void this.handleHttp(req, res).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.failClient(req, res, msg, 500);
        });
      });
      this.server.on('connect', (req, clientSocket, head) => {
        void this.handleConnect(req, clientSocket as net.Socket, head);
      });
      this.server.on('error', (err) => {
        this.lastError = err.message;
        this.running = false;
        const srv = this.server;
        this.server = null;
        srv?.close();
        // Notify the owner of the (often asynchronous) listen failure — e.g. EADDRINUSE when the
        // configured port is already taken — so it can resolve the offending process and warn.
        this.opts.onError?.(err.message);
        this.opts.onListening?.();
      });
      // Always bind to every interface so the proxy is reachable whether the Roku is on the same
      // Wi-Fi as this machine (LAN IP) or connected to this machine's hotspot (gateway IP). The
      // private-client gate in handleHttp/handleConnect is what restricts who may proxy — not the
      // bind address. Binding to a single gateway IP previously made the proxy unreachable for the
      // other topology.
      this.server.listen(this.opts.port, '0.0.0.0', () => {
        this.running = true;
        this.opts.onListening?.();
      });
      return true;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      return false;
    }
  }

  stop(): void {
    if (!this.server) return;
    const srv = this.server;
    this.server = null;
    this.running = false;
    // Release per-host leaf certs and any in-flight transaction timers so a stop/start cycle
    // doesn't leak them for the process lifetime.
    this.leafCache.clear();
    this.transactionStarts.clear();
    srv.close();
  }

  private clientIp(req: http.IncomingMessage): string {
    const sock = req.socket;
    const remote = sock.remoteAddress || '';
    if (remote.startsWith('::ffff:')) return remote.slice(7);
    return remote;
  }

  private emitTransaction(
    transactionId: string,
    deviceIp: string,
    hostname: string,
    destPort: number | undefined,
    request: NetworkHttpMessage,
    response: NetworkHttpMessage,
    startedAtMs?: number
  ): void {
    const startMs = startedAtMs ?? this.transactionStarts.get(transactionId);
    if (startMs == null) {
      this.transactionStarts.set(transactionId, Date.now());
    } else if (response.statusCode !== 0) {
      this.transactionStarts.delete(transactionId);
    }
    const durationMs =
      response.statusCode === 0 || startMs == null ? undefined : Math.max(0, Date.now() - startMs);
    this.opts.onTransaction({
      transactionId,
      deviceIp,
      timestamp: startedAtMs != null ? new Date(startedAtMs).toISOString() : new Date().toISOString(),
      hostname,
      destPort,
      request,
      response,
      durationMs
    });
  }

  private failClient(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    message: string,
    statusCode: number
  ): void {
    const deviceIp = this.clientIp(req);
    const rawUrl = decodeRequestUrl(req.url);
    const rokuTarget = parseRokuProxyTarget(rawUrl);
    const targetUrl = rokuTarget?.originalUrl || rawUrl || req.url || '';
    const host = rokuTarget?.hostname || 'proxy';
    const port = rokuTarget?.port ?? this.opts.port;
    this.emitTransaction(newTransactionId(), deviceIp, host, port, requestSnapshotFromIncoming(req, targetUrl), {
      statusCode,
      statusText: statusCode === 500 ? 'Proxy Error' : 'Error',
      body: message
    });
    if (!res.headersSent) {
      res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8', Connection: 'close' });
      res.end(message);
    } else {
      try {
        res.end();
      } catch {
        /* ignore */
      }
    }
  }

  private respondPlain(res: http.ServerResponse, statusCode: number, body: string): void {
    if (res.headersSent) return;
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8', Connection: 'close' });
    res.end(body);
  }

  private async handleHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const deviceIp = this.clientIp(req);
    const rawUrl = decodeRequestUrl(req.url);
    if (!this.opts.isHotspotClient(deviceIp)) {
      const targetUrl = parseRokuProxyTarget(rawUrl)?.originalUrl || rawUrl || '';
      this.emitTransaction(newTransactionId(), deviceIp, 'proxy', this.opts.port, requestSnapshotFromIncoming(req, targetUrl), {
        statusCode: 403,
        statusText: 'Forbidden',
        body: `RDS proxy rejected client ${deviceIp || '(unknown)'} — local/private network clients only`
      });
      this.respondPlain(res, 403, 'RDS Network Inspector proxy: local/private network clients only');
      return;
    }

    const rokuTarget = parseRokuProxyTarget(rawUrl);
    if (rokuTarget) {
      await this.forwardRokuRequest(req, res, deviceIp, rokuTarget);
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const proxyHint = normalizeProxyHostPort(this.opts.gatewayIp ? `${this.opts.gatewayIp}:${this.opts.port}` : `:${this.opts.port}`);
      this.respondPlain(
        res,
        200,
        'Roku Dev Studio MITM proxy.\n' +
          `Proxy URL: http://${proxyHint || 'GATEWAY_IP:PORT'}/;https://original-host/path\n` +
          'Set proxyHostPort to host:port only (e.g. 192.168.2.1:8888) — do not include http://.\n'
      );
      return;
    }

    if (rawUrl && /^https?:\/\/https?:\/\//i.test(rawUrl)) {
      this.failClient(
        req,
        res,
        'Malformed proxy URL (double http://). Use host:port only (e.g. 192.168.2.1:8888) — do not include http://.',
        400
      );
      return;
    }

    this.failClient(
      req,
      res,
      `Unsupported request — use Roku proxy URL format: /;https://host/path (got ${rawUrl || '(empty)'})`,
      400
    );
  }

  private decisionFor(deviceIp: string, hostname: string, path = ''): TrafficDecision {
    return this.opts.getTrafficDecision
      ? this.opts.getTrafficDecision(deviceIp, hostname, path)
      : { block: false };
  }

  /** Write a canned mock response to a plain HTTP client response (request mocking). */
  private respondMockHttp(
    res: http.ServerResponse,
    method: string,
    mock: MockResponse,
    throttle: TrafficThrottle | undefined
  ): void {
    const headers = mockHeaders(mock);
    const bodyBuf = Buffer.from(mock.body || '', 'utf8');
    const send = (): void => {
      if (res.headersSent) {
        try { res.end(); } catch { /* ignore */ }
        return;
      }
      const clientHeaders = toClientResponseHeaders(headers, bodyBuf.length, method);
      res.writeHead(mock.statusCode, mock.statusText || undefined, clientHeaders);
      if (method !== 'HEAD' && bodyBuf.length && throttleIsActive(throttle)) {
        writeBodyThrottled((c) => { res.write(c); }, () => { res.end(); }, bodyBuf, throttle as TrafficThrottle);
      } else {
        if (method !== 'HEAD' && bodyBuf.length) res.write(bodyBuf);
        res.end();
      }
    };
    if (mock.delayMs && mock.delayMs > 0) setTimeout(send, mock.delayMs);
    else send();
  }

  /** Build the response snapshot recorded for a mock (so the Inspector shows the canned response). */
  private mockResponseSnapshot(mock: MockResponse): NetworkHttpMessage {
    const headers = mockHeaders(mock);
    const bodyBuf = Buffer.from(mock.body || '', 'utf8');
    return {
      statusCode: mock.statusCode,
      statusText: mock.statusText || 'Mocked',
      headers,
      ...encodeBody(bodyBuf, headers, false)
    };
  }

  private async forwardRokuRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deviceIp: string,
    target: ReturnType<typeof parseRokuProxyTarget>
  ): Promise<void> {
    if (!target) return;
    const method = req.method || 'GET';
    const reqHeaders = normalizeHeaders(req.headers);
    const outboundHeaders = stripHopByHop(reqHeaders);
    outboundHeaders.host = target.hostname;

    // Apply per-device/host traffic rules. Block / mock / reset short-circuit before touching the
    // upstream; throttle is applied when writing the response below.
    const decisionPort = target.port ?? (target.scheme === 'https' ? 443 : 80);
    const decision = this.decisionFor(deviceIp, target.hostname, urlPath(target.originalUrl));
    if (decision.block) {
      this.emitTransaction(
        newTransactionId(),
        deviceIp,
        target.hostname,
        decisionPort,
        requestSnapshotFromIncoming(req, target.originalUrl),
        { statusCode: 403, statusText: 'Blocked by RDS', body: 'Blocked by Roku Dev Studio traffic rules' }
      );
      this.respondPlain(res, 403, 'Blocked by Roku Dev Studio traffic rules');
      return;
    }
    if (decision.resetConnection) {
      this.emitTransaction(
        newTransactionId(),
        deviceIp,
        target.hostname,
        decisionPort,
        requestSnapshotFromIncoming(req, target.originalUrl),
        { statusCode: 0, statusText: 'Connection reset (RDS fault)', body: 'Connection reset by Roku Dev Studio traffic rule' }
      );
      try { req.socket.destroy(); } catch { /* ignore */ }
      return;
    }
    if (decision.respond) {
      this.emitTransaction(
        newTransactionId(),
        deviceIp,
        target.hostname,
        decisionPort,
        requestSnapshotFromIncoming(req, target.originalUrl),
        this.mockResponseSnapshot(decision.respond)
      );
      this.respondMockHttp(res, method, decision.respond, decision.throttle);
      return;
    }

    let reqBody: Buffer = Buffer.alloc(0);
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        reqBody = await readBody(req);
      } catch {
        this.emitTransaction(newTransactionId(), deviceIp, target.hostname, target.port ?? 443, requestSnapshotFromIncoming(req, target.originalUrl), {
          statusCode: 413,
          statusText: 'Payload Too Large',
          body: 'Request body too large'
        });
        this.respondPlain(res, 413, 'Request body too large');
        return;
      }
    }

    const port = target.port ?? (target.scheme === 'https' ? 443 : 80);
    const requestSnapshot: NetworkHttpMessage = {
      method,
      url: target.originalUrl,
      headers: reqHeaders,
      ...encodeBody(reqBody, reqHeaders, false)
    };

    const transactionId = newTransactionId();
    const startedAtMs = Date.now();

    // Record immediately so the Network Inspector shows the request even if upstream fails.
    this.emitTransaction(transactionId, deviceIp, target.hostname, port, requestSnapshot, {
      statusCode: 0,
      statusText: 'Pending',
      body: undefined
    }, startedAtMs);

    const mod = target.scheme === 'https' ? https : http;

    // Guarantee exactly one outcome per transaction. Without this guard a late socket
    // 'error'/'timeout' after a successful response would re-emit and flip a completed
    // request's status, and a stall could leave it "Pending" forever.
    let settled = false;
    let hardTimer: ReturnType<typeof setTimeout> | null = null;
    const finish = (responseSnapshot: NetworkHttpMessage, statusCode: number, body: Buffer): void => {
      if (settled) return;
      settled = true;
      if (hardTimer) {
        clearTimeout(hardTimer);
        hardTimer = null;
      }
      this.emitTransaction(transactionId, deviceIp, target.hostname, port, requestSnapshot, responseSnapshot, startedAtMs);
      if (res.headersSent) {
        try {
          res.end();
        } catch {
          /* ignore */
        }
        return;
      }
      try {
        const clientHeaders = toClientResponseHeaders(
          responseSnapshot.headers || {},
          body.length,
          method
        );
        res.writeHead(statusCode, clientHeaders);
        if (method !== 'HEAD' && body.length && throttleIsActive(decision.throttle)) {
          writeBodyThrottled(
            (c) => { res.write(c); },
            () => { res.end(); },
            body,
            decision.throttle as TrafficThrottle
          );
        } else {
          if (method !== 'HEAD' && body.length) res.write(body);
          res.end();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.respondPlain(res, 502, msg);
      }
    };

    await new Promise<void>((resolve) => {
      const upstream = mod.request(
        {
          hostname: target.hostname,
          port,
          path: target.path,
          method,
          headers: outboundHeaders,
          timeout: REQUEST_TIMEOUT_MS,
          servername: target.scheme === 'https' ? target.hostname : undefined
        },
        async (upstreamRes) => {
          try {
            const resHeaders = normalizeHeaders(upstreamRes.headers);
            const { buffer: resBodyBuf, truncated: resTruncated } =
              method === 'HEAD'
                ? { buffer: Buffer.alloc(0), truncated: false }
                : await readResponseBody(upstreamRes);
            const responseSnapshot: NetworkHttpMessage = {
              statusCode: upstreamRes.statusCode,
              statusText: upstreamRes.statusMessage,
              headers: resHeaders,
              ...encodeBody(resBodyBuf, resHeaders, resTruncated)
            };
            finish(responseSnapshot, upstreamRes.statusCode ?? 502, resBodyBuf);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            finish(
              { statusCode: 502, statusText: 'Bad Gateway', body: msg },
              502,
              Buffer.from(msg, 'utf8')
            );
          }
          resolve();
        }
      );

      // Absolute backstop independent of socket-level events: always resolves the pending
      // transaction even if neither 'response', 'error', nor 'timeout' ever fires.
      hardTimer = setTimeout(() => {
        const msg = 'Upstream did not respond in time';
        try {
          upstream.destroy();
        } catch {
          /* ignore */
        }
        finish({ statusCode: 504, statusText: 'Gateway Timeout', body: msg }, 504, Buffer.from(msg, 'utf8'));
        resolve();
      }, HARD_TIMEOUT_MS);

      upstream.on('timeout', () => {
        upstream.destroy();
        const msg = 'Upstream request timed out';
        finish({ statusCode: 504, statusText: 'Gateway Timeout', body: msg }, 504, Buffer.from(msg, 'utf8'));
        resolve();
      });

      upstream.on('error', (err) => {
        const msg = err.message;
        finish({ statusCode: 502, statusText: 'Bad Gateway', body: msg }, 502, Buffer.from(msg, 'utf8'));
        resolve();
      });

      if (reqBody.length) upstream.write(reqBody);
      upstream.end();
    });
  }

  private getLeaf(hostname: string): { certPem: string; keyPem: string } {
    const existing = this.leafCache.get(hostname);
    if (existing) {
      // Refresh recency: re-insert so this host becomes most-recently-used (Map keeps insert order).
      this.leafCache.delete(hostname);
      this.leafCache.set(hostname, existing);
      return existing;
    }
    const leaf = createLeafCert(hostname, this.opts.ca);
    this.leafCache.set(hostname, leaf);
    // Evict the least-recently-used entry once the cache grows past its cap.
    if (this.leafCache.size > MAX_LEAF_CACHE) {
      const oldest = this.leafCache.keys().next().value;
      if (oldest !== undefined) this.leafCache.delete(oldest);
    }
    return leaf;
  }

  private async handleConnect(
    req: http.IncomingMessage,
    clientSocket: net.Socket,
    head: Buffer
  ): Promise<void> {
    const deviceIp = this.clientIp(req);
    if (!this.opts.isHotspotClient(deviceIp)) {
      clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      clientSocket.destroy();
      return;
    }

    const parsedTarget = parseConnectTarget(req.url || '');
    if (!parsedTarget) {
      clientSocket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      clientSocket.destroy();
      return;
    }
    const { host: hostname, port } = parsedTarget;

    const leaf = this.getLeaf(hostname);
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

    const secureSocket = new tls.TLSSocket(clientSocket, {
      isServer: true,
      key: leaf.keyPem,
      cert: leaf.certPem,
      SNICallback: (servername, cb) => {
        const snLeaf = this.getLeaf(servername);
        const ctx = tls.createSecureContext({ key: snLeaf.keyPem, cert: snLeaf.certPem });
        cb(null, ctx);
      }
    });

    secureSocket.on('error', () => {
      secureSocket.destroy();
    });

    if (head.length) secureSocket.write(head);

    secureSocket.once('data', (firstChunk) => {
      void this.interceptTlsHttp(deviceIp, hostname, port, secureSocket, firstChunk);
    });
  }

  /**
   * Collect a full HTTP/1.1 request off the decrypted TLS socket, honoring Content-Length and
   * chunked transfer-encoding so large or split request bodies aren't truncated, then forward it.
   * A hard timeout guarantees the tunnel never hangs waiting for a body that never finishes.
   */
  private interceptTlsHttp(
    deviceIp: string,
    hostname: string,
    port: number,
    socket: tls.TLSSocket,
    firstChunk: Buffer
  ): void {
    const chunks: Buffer[] = firstChunk.length ? [firstChunk] : [];
    let handled = false;
    let hardTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (): void => {
      if (hardTimer) {
        clearTimeout(hardTimer);
        hardTimer = null;
      }
      socket.removeListener('data', onData);
    };

    const forward = (
      method: string,
      pathPart: string,
      hdrs: Record<string, string>,
      reqBodyBuf: Buffer,
      bodyTruncated: boolean
    ): void => {
      if (handled) return;
      handled = true;
      cleanup();
      this.forwardTunneledRequest(deviceIp, hostname, port, socket, method, pathPart, hdrs, reqBodyBuf, bodyTruncated);
    };

    const tryParse = (): void => {
      if (handled) return;
      const buf = Buffer.concat(chunks);
      const sep = buf.indexOf(HEADER_SEP);
      if (sep < 0) {
        // Headers not complete yet; bail out (drop) if the head grows unreasonably large.
        if (buf.length > MAX_REQUEST_HEADER_BYTES) {
          handled = true;
          cleanup();
          try { socket.destroy(); } catch { /* ignore */ }
        }
        return;
      }
      const head = parseRequestHead(buf.subarray(0, sep).toString('latin1'));
      if (!head) {
        handled = true;
        cleanup();
        try { socket.destroy(); } catch { /* ignore */ }
        return;
      }
      const bodyStart = sep + HEADER_SEP.length;
      const available = buf.subarray(bodyStart);
      const noBodyMethod = head.method === 'GET' || head.method === 'HEAD';
      const isChunked = /chunked/i.test(head.headers['transfer-encoding'] || '');
      const clRaw = head.headers['content-length'];
      const contentLength = clRaw != null && /^\d+$/.test(clRaw.trim()) ? parseInt(clRaw.trim(), 10) : undefined;

      if (isChunked && !noBodyMethod) {
        const { body, complete } = decodeChunkedBody(available);
        if (!complete && available.length < MAX_BODY_BYTES) return; // wait for more chunks
        const capped = body.subarray(0, MAX_BODY_BYTES);
        forward(head.method, head.path, head.headers, capped, !complete || body.length > MAX_BODY_BYTES);
        return;
      }
      if (contentLength != null && !noBodyMethod) {
        const need = Math.min(contentLength, MAX_BODY_BYTES);
        if (available.length < need) return; // wait for the rest of the declared body
        forward(head.method, head.path, head.headers, available.subarray(0, need), contentLength > MAX_BODY_BYTES);
        return;
      }
      // No Content-Length / chunked (or a body-less method): forward immediately.
      forward(
        head.method,
        head.path,
        head.headers,
        noBodyMethod ? Buffer.alloc(0) : available.subarray(0, MAX_BODY_BYTES),
        false
      );
    };

    const onData = (chunk: Buffer): void => {
      if (handled) return;
      chunks.push(chunk);
      tryParse();
    };

    // Hard backstop: if the request head/body never completes, forward whatever arrived (marked
    // truncated) or drop the tunnel rather than leaving the socket open forever.
    hardTimer = setTimeout(() => {
      if (handled) return;
      const buf = Buffer.concat(chunks);
      const sep = buf.indexOf(HEADER_SEP);
      const head = sep >= 0 ? parseRequestHead(buf.subarray(0, sep).toString('latin1')) : null;
      if (!head) {
        handled = true;
        cleanup();
        try { socket.destroy(); } catch { /* ignore */ }
        return;
      }
      const bodyStart = sep + HEADER_SEP.length;
      forward(head.method, head.path, head.headers, buf.subarray(bodyStart, bodyStart + MAX_BODY_BYTES), true);
    }, HARD_TIMEOUT_MS);

    socket.on('data', onData);
    tryParse();
  }

  /** Forward a fully-collected tunneled HTTPS request upstream and stream the response back. */
  private forwardTunneledRequest(
    deviceIp: string,
    hostname: string,
    port: number,
    socket: tls.TLSSocket,
    method: string,
    pathPart: string,
    hdrs: Record<string, string>,
    reqBodyBuf: Buffer,
    bodyTruncated: boolean
  ): void {
    const fullUrl = pathPart.startsWith('http')
      ? pathPart
      : `https://${hostname}${pathPart.startsWith('/') ? pathPart : `/${pathPart}`}`;
    const requestSnapshot: NetworkHttpMessage = {
      method,
      url: fullUrl,
      headers: hdrs,
      ...encodeBody(reqBodyBuf, hdrs, bodyTruncated)
    };

    const tlsDecision = this.decisionFor(deviceIp, hostname, urlPath(fullUrl));

    const writeStatusAndClose = (statusCode: number, statusText: string, body: string): void => {
      try {
        socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n${body}`);
      } catch { /* ignore */ }
      try { socket.end(); } catch { /* ignore */ }
    };

    if (tlsDecision.block) {
      this.emitTransaction(newTransactionId(), deviceIp, hostname, port, requestSnapshot, {
        statusCode: 403,
        statusText: 'Blocked by RDS',
        body: 'Blocked by Roku Dev Studio traffic rules'
      });
      writeStatusAndClose(403, 'Blocked by RDS', 'Blocked by Roku Dev Studio traffic rules');
      return;
    }
    if (tlsDecision.resetConnection) {
      this.emitTransaction(newTransactionId(), deviceIp, hostname, port, requestSnapshot, {
        statusCode: 0,
        statusText: 'Connection reset (RDS fault)',
        body: 'Connection reset by Roku Dev Studio traffic rule'
      });
      try { socket.destroy(); } catch { /* ignore */ }
      return;
    }
    if (tlsDecision.respond) {
      const mock = tlsDecision.respond;
      this.emitTransaction(newTransactionId(), deviceIp, hostname, port, requestSnapshot, this.mockResponseSnapshot(mock));
      const headers = mockHeaders(mock);
      const bodyBuf = Buffer.from(mock.body || '', 'utf8');
      const headerLines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
      const payload = Buffer.concat([
        Buffer.from(
          `HTTP/1.1 ${mock.statusCode} ${mock.statusText || 'Mocked'}\r\n` +
            `content-length: ${bodyBuf.length}\r\nconnection: close\r\n${headerLines}${headerLines ? '\r\n' : ''}\r\n`,
          'utf8'
        ),
        bodyBuf
      ]);
      const send = (): void => {
        try { socket.write(payload); } catch { /* ignore */ }
        try { socket.end(); } catch { /* ignore */ }
      };
      if (mock.delayMs && mock.delayMs > 0) setTimeout(send, mock.delayMs);
      else send();
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fullUrl);
    } catch {
      this.emitTransaction(newTransactionId(), deviceIp, hostname, port, requestSnapshot, {
        statusCode: 400,
        statusText: 'Bad Request',
        body: `Malformed request URL: ${fullUrl}`
      });
      writeStatusAndClose(400, 'Bad Request', 'Malformed request URL');
      return;
    }

    // One outcome per tunneled request: emit a transaction and close the socket exactly once,
    // whether the upstream responds, errors, or times out. A hard timer is the absolute backstop.
    let settled = false;
    let hardTimer: ReturnType<typeof setTimeout> | null = null;
    const settle = (): void => {
      if (hardTimer) {
        clearTimeout(hardTimer);
        hardTimer = null;
      }
    };
    const failTunnel = (statusCode: number, statusText: string, msg: string): void => {
      if (settled) return;
      settled = true;
      settle();
      this.emitTransaction(newTransactionId(), deviceIp, hostname, port, requestSnapshot, {
        statusCode,
        statusText,
        body: msg
      });
      writeStatusAndClose(statusCode, statusText, msg);
    };

    const upstream = https.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port ? Number(parsedUrl.port) : 443,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method,
        headers: { ...stripHopByHop(hdrs), host: parsedUrl.hostname },
        timeout: REQUEST_TIMEOUT_MS,
        servername: parsedUrl.hostname
      },
      async (upstreamRes) => {
        if (settled) {
          try { upstreamRes.destroy(); } catch { /* ignore */ }
          return;
        }
        try {
          const resHeaders = normalizeHeaders(upstreamRes.headers);
          const { buffer: resBodyBuf, truncated: resTruncated } = await readResponseBody(upstreamRes);
          if (settled) return;
          settled = true;
          settle();
          const responseSnapshot: NetworkHttpMessage = {
            statusCode: upstreamRes.statusCode,
            statusText: upstreamRes.statusMessage,
            headers: resHeaders,
            ...encodeBody(resBodyBuf, resHeaders, resTruncated)
          };
          this.emitTransaction(newTransactionId(), deviceIp, hostname, port, requestSnapshot, responseSnapshot);

          const statusLine = `HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}\r\n`;
          const headerLines = Object.entries(upstreamRes.headers)
            .flatMap(([k, v]) => {
              if (v == null) return [];
              const vals = Array.isArray(v) ? v : [v];
              return vals.map((vv) => `${k}: ${vv}`);
            })
            .join('\r\n');
          const payload = Buffer.concat([
            Buffer.from(`${statusLine}${headerLines}\r\n\r\n`, 'utf8'),
            resBodyBuf
          ]);
          if (throttleIsActive(tlsDecision.throttle)) {
            writeBodyThrottled(
              (c) => { socket.write(c); },
              () => { socket.end(); },
              payload,
              tlsDecision.throttle as TrafficThrottle
            );
          } else {
            socket.write(payload);
            socket.end();
          }
        } catch (err) {
          failTunnel(502, 'Bad Gateway', err instanceof Error ? err.message : String(err));
        }
      }
    );

    hardTimer = setTimeout(() => {
      try { upstream.destroy(); } catch { /* ignore */ }
      failTunnel(504, 'Gateway Timeout', 'Upstream did not respond in time');
    }, HARD_TIMEOUT_MS);

    upstream.on('timeout', () => {
      try { upstream.destroy(); } catch { /* ignore */ }
      failTunnel(504, 'Gateway Timeout', 'Upstream request timed out');
    });

    upstream.on('error', (err) => {
      failTunnel(502, 'Bad Gateway', err.message);
    });

    if (reqBodyBuf.length) upstream.write(reqBodyBuf);
    upstream.end();
  }
}

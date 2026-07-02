/**
 * Export a captured Network Inspector transaction as a copy-pasteable cURL command or a
 * HAR 1.2 archive entry. Both consume the loaded `ParsedNetworkEvent` (headers + body live on the
 * on-disk detail store and are fetched before export); a lightweight summary still yields a usable
 * URL/method-only result.
 */
import type { NetworkHttpMessage, ParsedNetworkEvent } from '../../../shared/network-inspector/types';

/** Can this event be meaningfully exported (only full HTTP transactions carry a request)? */
export function isExportableEvent(ev: ParsedNetworkEvent | null | undefined): boolean {
  return !!ev && ev.type === 'http-transaction' && !!ev.httpRequest;
}

function headerValue(msg: NetworkHttpMessage | undefined, name: string): string | undefined {
  if (!msg?.headers) return undefined;
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(msg.headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

/**
 * Resolve the absolute request URL. The captured `url` is often a path only (the device sends the
 * authority in the `Host` header), so fall back to `Host`/`hostname` + scheme inferred from
 * MITM/destination port.
 */
function absoluteUrl(ev: ParsedNetworkEvent): string {
  const raw = ev.httpRequest?.url || '/';
  if (/^https?:\/\//i.test(raw)) return raw;
  const host = headerValue(ev.httpRequest, 'host') || ev.hostname || ev.destIp || '';
  if (!host) return raw;
  const scheme = ev.mitm || ev.destPort === 443 ? 'https' : 'http';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${scheme}://${host}${path}`;
}

function shellSingleQuote(value: string): string {
  // POSIX-safe single-quoting: close quote, escaped quote, reopen.
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Build a cURL command string for the request. Binary (base64) bodies are noted rather than emitted
 * (a shell-pasted base64 blob would be meaningless); text bodies are sent via `--data-raw`.
 */
export function buildCurlCommand(ev: ParsedNetworkEvent): string {
  const req = ev.httpRequest;
  const method = (req?.method || 'GET').toUpperCase();
  const url = absoluteUrl(ev);
  const parts: string[] = [`curl ${shellSingleQuote(url)}`];
  if (method !== 'GET') parts.push(`-X ${method}`);
  if (req?.headers) {
    for (const [k, v] of Object.entries(req.headers)) {
      // `Host` is implied by the URL; skip pseudo-headers.
      if (k.toLowerCase() === 'host' || k.startsWith(':')) continue;
      parts.push(`-H ${shellSingleQuote(`${k}: ${v}`)}`);
    }
  }
  if (req?.body) {
    if (req.bodyEncoding === 'base64') {
      parts.push(`# (binary request body omitted — ${req.bodyBytes ?? 0} bytes, base64-encoded)`);
    } else {
      parts.push(`--data-raw ${shellSingleQuote(req.body)}`);
    }
  }
  // Join with line continuations so the command is readable and still pastes as one command.
  return parts.join(' \\\n  ');
}

function harHeaders(msg: NetworkHttpMessage | undefined): Array<{ name: string; value: string }> {
  if (!msg?.headers) return [];
  return Object.entries(msg.headers).map(([name, value]) => ({ name, value }));
}

function harQueryString(url: string): Array<{ name: string; value: string }> {
  try {
    const u = new URL(url);
    return Array.from(u.searchParams.entries()).map(([name, value]) => ({ name, value }));
  } catch {
    return [];
  }
}

/** Build one HAR 1.2 entry object for a single transaction (shared by single- and multi-entry export). */
function buildHarEntry(ev: ParsedNetworkEvent): Record<string, unknown> {
  const req = ev.httpRequest;
  const res = ev.httpResponse;
  const url = absoluteUrl(ev);
  const reqContentType = headerValue(req, 'content-type') || req?.contentType || '';
  const resContentType = headerValue(res, 'content-type') || res?.contentType || '';

  const postData =
    req?.body != null && req.body !== ''
      ? {
          mimeType: reqContentType || 'application/octet-stream',
          text: req.bodyEncoding === 'base64' ? '' : req.body,
          ...(req.bodyEncoding === 'base64' ? { comment: 'binary body omitted (base64)' } : {})
        }
      : undefined;

  return {
    startedDateTime: ev.timestamp || new Date().toISOString(),
    time: typeof ev.durationMs === 'number' && ev.durationMs >= 0 ? ev.durationMs : 0,
    request: {
      method: (req?.method || 'GET').toUpperCase(),
      url,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: harHeaders(req),
      queryString: harQueryString(url),
      ...(postData ? { postData } : {}),
      headersSize: -1,
      bodySize: req?.bodyBytes ?? (req?.body ? req.body.length : 0)
    },
    response: {
      status: res?.statusCode ?? 0,
      statusText: res?.statusText || '',
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: harHeaders(res),
      content: {
        size: res?.bodyBytes ?? (res?.body ? res.body.length : 0),
        mimeType: resContentType || 'application/octet-stream',
        ...(res?.body ? { text: res.body } : {}),
        ...(res?.bodyEncoding === 'base64' ? { encoding: 'base64' } : {})
      },
      redirectURL: headerValue(res, 'location') || '',
      headersSize: -1,
      bodySize: res?.bodyBytes ?? (res?.body ? res.body.length : 0)
    },
    cache: {},
    timings: {
      send: 0,
      wait: typeof ev.durationMs === 'number' && ev.durationMs >= 0 ? ev.durationMs : -1,
      receive: 0
    },
    ...(ev.deviceIp ? { serverIPAddress: ev.destIp, comment: `device ${ev.deviceIp}` } : {})
  };
}

function harLog(entries: Array<Record<string, unknown>>): string {
  const har = {
    log: {
      version: '1.2',
      creator: { name: 'Roku Dev Studio — Network Inspector', version: '1.0' },
      entries
    }
  };
  return JSON.stringify(har, null, 2);
}

/** Build a single-entry HAR 1.2 archive (stringified) for the transaction. */
export function buildHarArchive(ev: ParsedNetworkEvent): string {
  return harLog([buildHarEntry(ev)]);
}

/**
 * Build a whole-session HAR 1.2 archive from every exportable HTTP transaction in `events`
 * (order preserved). Non-HTTP events (DNS/TLS/TCP) carry no request and are skipped — HAR is an
 * HTTP-only format. Use {@link buildNetworkSessionFile} to capture those too.
 */
export function buildHarArchiveAll(events: ParsedNetworkEvent[]): string {
  const entries = events.filter(isExportableEvent).map((ev) => buildHarEntry(ev));
  return harLog(entries);
}

/** Bumped when the on-disk shape of a saved session changes in a way the viewer must branch on. */
export const NETWORK_SESSION_FILE_VERSION = 1;

/** File extension (without dot) for the native, fully re-openable session bundle. */
export const NETWORK_SESSION_FILE_EXT = 'rds-network-inspector.json';

export type NetworkSessionFile = {
  format: 'roku-dev-studio-network-session';
  version: number;
  createdAt: string;
  creator: { name: string; version: string };
  deviceIps: string[];
  eventCount: number;
  /** Full parsed events with headers/bodies inlined — feed straight to `buildSessions()`. */
  events: ParsedNetworkEvent[];
};

/**
 * Serialize a whole capture (all event kinds, full headers/bodies) into the native `.rdsnet.json`
 * bundle. Unlike HAR this preserves DNS/TLS/TCP rows and the MITM/decrypted flags, so the file
 * re-hydrates the exact Network Inspector UI when reopened. Callers must have loaded each event's
 * detail first so bodies are present.
 */
export function buildNetworkSessionFile(
  events: ParsedNetworkEvent[],
  meta?: { deviceIps?: string[]; createdAt?: string }
): string {
  const deviceIps = Array.from(
    new Set((meta?.deviceIps || events.map((e) => e.deviceIp)).filter((ip): ip is string => !!ip))
  );
  const bundle: NetworkSessionFile = {
    format: 'roku-dev-studio-network-session',
    version: NETWORK_SESSION_FILE_VERSION,
    createdAt: meta?.createdAt || new Date().toISOString(),
    creator: { name: 'Roku Dev Studio — Network Inspector', version: '1.0' },
    deviceIps,
    eventCount: events.length,
    events
  };
  return JSON.stringify(bundle, null, 2);
}

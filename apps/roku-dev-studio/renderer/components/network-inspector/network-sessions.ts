import type { ParsedNetworkEvent } from '../../../shared/network-inspector/types';

export type SessionKind = 'https' | 'http' | 'dns' | 'tcp';

export type NetworkSession = {
  id: string;
  eventId: string;
  index: number;
  kind: SessionKind;
  host: string;
  path: string;
  method: string;
  status: string;
  statusCode?: number;
  /** Bare mime (no charset), e.g. `application/json` — used by the `type:` filter. */
  contentType: string;
  sizeBytes: number;
  sizeLabel: string;
  timeLabel: string;
  timestampLabel: string;
  durationLabel: string;
  encrypted: boolean;
  decrypted: boolean;
  event: ParsedNetworkEvent;
};

export type SessionBuildOptions = {
  /** Hide passive TLS/TCP metadata when decrypted HTTP exists. */
  decryptedOnly?: boolean;
};

// A summary carries `bodyBytes` (and no `body`), so "has a captured body" is derived from sizes;
// MITM transactions are always decrypted regardless of body size.
function hasCapturedBody(ev: ParsedNetworkEvent): boolean {
  return (ev.httpRequest?.bodyBytes ?? 0) > 0 || (ev.httpResponse?.bodyBytes ?? 0) > 0;
}

function isDecryptedEvent(ev: ParsedNetworkEvent): boolean {
  return ev.type === 'http-transaction' && (ev.mitm === true || hasCapturedBody(ev));
}

export type StructureGroup = {
  host: string;
  sessions: NetworkSession[];
};

function destKey(ev: ParsedNetworkEvent): string {
  return `${ev.destIp || ''}:${ev.destPort ?? 0}`;
}

function formatTime(ts: string | undefined): string {
  if (!ts) return '—';
  return ts.slice(11, 23);
}

function formatTimestamp(ts: string | undefined): string {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return formatTime(ts);
    const hms = d.toLocaleTimeString(undefined, {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    return `${hms}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  } catch {
    return formatTime(ts);
  }
}

function formatDuration(ev: ParsedNetworkEvent): string {
  const pending = ev.type === 'http-transaction' && ev.httpResponse?.statusCode === 0;
  if (pending) return 'Pending…';
  if (typeof ev.durationMs === 'number' && ev.durationMs >= 0) {
    if (ev.durationMs < 1000) return `${ev.durationMs} ms`;
    return `${(ev.durationMs / 1000).toFixed(2)} s`;
  }
  return '—';
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function bodySize(ev: ParsedNetworkEvent): number {
  const req = ev.httpRequest?.bodyBytes ?? ev.httpRequest?.body?.length ?? 0;
  const res = ev.httpResponse?.bodyBytes ?? ev.httpResponse?.body?.length ?? 0;
  return req + res;
}

/** Bare response (or request) mime, lowercased, no charset — for the `type:` filter. */
function sessionContentType(ev: ParsedNetworkEvent): string {
  const ct = ev.httpResponse?.contentType || ev.httpRequest?.contentType || '';
  return ct.split(';')[0].trim().toLowerCase();
}

function eventToSession(ev: ParsedNetworkEvent, index: number): NetworkSession {
  const timeLabel = formatTime(ev.timestamp);
  const timestampLabel = formatTimestamp(ev.timestamp);
  const durationLabel = formatDuration(ev);
  if (ev.type === 'http-transaction') {
    const rawUrl = ev.httpRequest?.url || '/';
    let host = ev.hostname || ev.httpRequest?.headers?.host || ev.destIp || '—';
    // `hostname` is populated on the summary (the `host` header is dropped), so the fallback above
    // still resolves; the URL parse below refines it when an absolute URL is present.
    let path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    let isHttps = ev.mitm === true;
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      try {
        const u = new URL(rawUrl);
        host = u.hostname;
        path = `${u.pathname}${u.search}` || '/';
        isHttps = u.protocol === 'https:';
      } catch {
        /* keep defaults */
      }
    }
    const code = ev.httpResponse?.statusCode;
    const status =
      code === 0 ? 'Pending' : code != null ? String(code) : ev.httpResponse?.statusText || '—';
    return {
      id: `sess-${ev.id}`,
      eventId: ev.id,
      index,
      kind: isHttps ? 'https' : 'http',
      host,
      path,
      method: ev.httpRequest?.method || 'GET',
      status,
      statusCode: code === 0 ? undefined : code,
      contentType: sessionContentType(ev),
      sizeBytes: bodySize(ev),
      sizeLabel: formatSize(bodySize(ev)),
      timeLabel,
      timestampLabel,
      durationLabel,
      encrypted: false,
      decrypted: ev.mitm === true || hasCapturedBody(ev),
      event: ev
    };
  }
  if (ev.type === 'dns-query') {
    const host = ev.hostname || '—';
    return {
      id: `sess-${ev.id}`,
      eventId: ev.id,
      index,
      kind: 'dns',
      host,
      path: 'DNS Query',
      method: 'DNS',
      status: 'Query',
      contentType: '',
      sizeBytes: 0,
      sizeLabel: '—',
      timeLabel,
      timestampLabel,
      durationLabel,
      encrypted: false,
      decrypted: false,
      event: ev
    };
  }
  if (ev.type === 'dns-response') {
    const host = ev.hostname || '—';
    return {
      id: `sess-${ev.id}`,
      eventId: ev.id,
      index,
      kind: 'dns',
      host,
      path: 'DNS Response',
      method: 'DNS',
      status: 'OK',
      contentType: '',
      sizeBytes: 0,
      sizeLabel: '—',
      timeLabel,
      timestampLabel,
      durationLabel,
      encrypted: false,
      decrypted: false,
      event: ev
    };
  }
  if (ev.type === 'tls-handshake') {
    const host = ev.sni || ev.hostname || ev.destIp || '—';
    return {
      id: `sess-${ev.id}`,
      eventId: ev.id,
      index,
      kind: 'https',
      host,
      path: '*',
      method: 'HTTPS',
      status: 'SSL',
      contentType: '',
      sizeBytes: 0,
      sizeLabel: '—',
      timeLabel,
      timestampLabel,
      durationLabel,
      encrypted: true,
      decrypted: false,
      event: ev
    };
  }
  const host = ev.destIp || '—';
  const port = ev.destPort ?? 0;
  const isHttps = port === 443;
  return {
    id: `sess-${ev.id}`,
    eventId: ev.id,
    index,
    kind: isHttps ? 'https' : 'tcp',
    host,
    path: `:${port}`,
    method: isHttps ? 'HTTPS' : 'TCP',
    status: isHttps ? 'SSL' : 'Open',
    contentType: '',
    sizeBytes: 0,
    sizeLabel: '—',
    timeLabel,
    timestampLabel,
    durationLabel,
    encrypted: isHttps,
    decrypted: false,
    event: ev
  };
}

export function buildSessions(events: ParsedNetworkEvent[], options?: SessionBuildOptions): NetworkSession[] {
  const decryptedOnly = options?.decryptedOnly === true;
  const mitmHosts = new Set(
    events
      .filter((e) => e.mitm && (e.hostname || e.httpRequest?.url))
      .map((e) => {
        if (e.hostname) return e.hostname.toLowerCase();
        const u = e.httpRequest?.url || '';
        try {
          if (u.startsWith('http')) return new URL(u).hostname.toLowerCase();
        } catch {
          /* ignore */
        }
        return '';
      })
      .filter(Boolean)
  );
  const tlsDests = new Set(
    events.filter((e) => e.type === 'tls-handshake').map((e) => destKey(e))
  );
  const filtered = events.filter((e) => {
    if (decryptedOnly && !isDecryptedEvent(e)) return false;
    if (e.type === 'tls-handshake') {
      const sni = (e.sni || e.hostname || '').toLowerCase();
      if (sni && mitmHosts.has(sni)) return false;
    }
    if (e.type !== 'tcp-connection') return true;
    if (e.destPort === 443 && tlsDests.has(destKey(e))) return false;
    return true;
  });
  return filtered.map((ev, i) => eventToSession(ev, i + 1));
}

export function countDecryptedSessions(events: ParsedNetworkEvent[]): number {
  return events.filter(isDecryptedEvent).length;
}

type FilterTerm =
  | { field: 'host' | 'method' | 'type' | 'kind' | 'path'; value: string }
  | { field: 'status'; value: string }
  | { field: 'free'; value: string };

// Field prefixes the filter understands. `content-type`/`mime` alias `type`; `url` aliases `path`.
const FILTER_FIELD_ALIASES: Record<string, FilterTerm['field']> = {
  host: 'host',
  method: 'method',
  status: 'status',
  code: 'status',
  type: 'type',
  'content-type': 'type',
  contenttype: 'type',
  mime: 'type',
  kind: 'kind',
  path: 'path',
  url: 'path'
};

function parseFilterTerm(raw: string): FilterTerm {
  const colon = raw.indexOf(':');
  if (colon > 0) {
    const prefix = raw.slice(0, colon).trim();
    const field = FILTER_FIELD_ALIASES[prefix];
    if (field) {
      return { field, value: raw.slice(colon + 1).trim() } as FilterTerm;
    }
  }
  return { field: 'free', value: raw };
}

function statusMatches(session: NetworkSession, value: string): boolean {
  if (!value) return true;
  const code = session.statusCode;
  // `4xx` / `5xx` / `2xx` class match.
  const classMatch = /^([1-5])xx$/.exec(value);
  if (classMatch) {
    return code != null && Math.floor(code / 100) === Number(classMatch[1]);
  }
  if (code != null && String(code).includes(value)) return true;
  return session.status.toLowerCase().includes(value);
}

function termMatches(session: NetworkSession, term: FilterTerm): boolean {
  switch (term.field) {
    case 'host':
      return session.host.toLowerCase().includes(term.value);
    case 'method':
      return session.method.toLowerCase().includes(term.value);
    case 'type':
      return session.contentType.toLowerCase().includes(term.value);
    case 'kind':
      return session.kind.toLowerCase().includes(term.value);
    case 'path':
      return session.path.toLowerCase().includes(term.value);
    case 'status':
      return statusMatches(session, term.value);
    case 'free':
    default: {
      const hay =
        `${session.host} ${session.path} ${session.method} ${session.status} ${session.kind} ${session.contentType}`.toLowerCase();
      return hay.includes(term.value);
    }
  }
}

export function filterSessions(sessions: NetworkSession[], query: string): NetworkSession[] {
  // Comma-separated terms are OR'd: "roku.com, status:404, method:POST" keeps any session
  // matching at least one term. Each term may be field-scoped (`host:`, `method:`, `status:`
  // incl. `4xx`/`5xx` classes, `type:`/`content-type:`, `kind:`, `path:`); bare terms match
  // host/path/method/status/kind/content-type. Empty terms (trailing/double commas) are ignored.
  const terms = query
    .toLowerCase()
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map(parseFilterTerm)
    // A field prefix with no value (e.g. "status:") is a no-op, not a match-nothing.
    .filter((t) => t.value !== '');
  if (terms.length === 0) return sessions;
  return sessions.filter((s) => terms.some((t) => termMatches(s, t)));
}

export function buildStructureGroups(sessions: NetworkSession[]): StructureGroup[] {
  const map = new Map<string, NetworkSession[]>();
  for (const s of sessions) {
    const key = s.host.toLowerCase();
    const list = map.get(key) || [];
    list.push(s);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([host, list]) => ({ host, sessions: list }));
}

export function statusClass(session: NetworkSession): string {
  if (session.kind === 'dns') return 'ni-status-dns';
  if (session.encrypted || session.status === 'SSL') return 'ni-status-ssl';
  if (session.status === 'Pending' || session.status.toLowerCase().startsWith('pending')) {
    return 'ni-status-pending';
  }

  let code = session.statusCode;
  if (code == null) {
    const parsed = Number.parseInt(session.status, 10);
    if (!Number.isNaN(parsed) && parsed >= 100 && parsed < 600) code = parsed;
  }
  if (code == null) return 'ni-status-unknown';
  if (code >= 100 && code < 200) return 'ni-status-info';
  if (code >= 200 && code < 300) return 'ni-status-ok';
  if (code >= 300 && code < 400) return 'ni-status-redirect';
  if (code >= 400 && code < 500) return 'ni-status-client';
  if (code >= 500) return 'ni-status-server';
  return 'ni-status-warn';
}

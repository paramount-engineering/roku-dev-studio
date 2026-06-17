/**
 * Roku dev channels route HTTPS through a local proxy using host-prefixed proxy URLs:
 *   http://PROXY_HOST:PORT/;https://original-host/path?query
 * See https://briandunnington.github.io/proxying_network_requests
 */

export type ParsedRokuProxyTarget = {
  scheme: 'http' | 'https';
  hostname: string;
  port?: number;
  path: string;
  originalUrl: string;
};

const ROKU_PROXY_PATH_RE = /^\/;(https?:\/\/.+)$/i;
const ABSOLUTE_URL_RE = /^https?:\/\//i;

/** Strip scheme/path; keep host:port only (e.g. "192.168.2.1:8888"). */
export function normalizeProxyHostPort(raw: string | undefined): string {
  if (!raw) return '';
  let s = raw.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      return u.port ? `${u.hostname}:${u.port}` : u.hostname;
    } catch {
      s = s.replace(/^https?:\/\//i, '');
    }
  }
  return s.replace(/\/.*$/, '').trim();
}

/** Build Roku proxy URL. proxyHostPort must be host:port (no scheme). */
export function buildRokuProxyUrl(proxyHostPort: string, originalUrl: string): string {
  const proxy = normalizeProxyHostPort(proxyHostPort);
  const original = originalUrl.trim();
  if (!proxy || !original) return original;
  if (!ABSOLUTE_URL_RE.test(original)) return original;
  return `http://${proxy}/;${original}`;
}

export function parseRokuProxyTarget(rawUrl: string | undefined): ParsedRokuProxyTarget | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let candidate = trimmed;

  // Double scheme (http://http://…) — common misconfiguration; avoid confusing upstream parsers.
  if (/^https?:\/\/https?:\/\//i.test(trimmed)) {
    return null;
  }

  const pathMatch = trimmed.match(ROKU_PROXY_PATH_RE);
  if (pathMatch) {
    candidate = pathMatch[1];
  } else if (trimmed.includes('/;http')) {
    const idx = trimmed.indexOf('/;');
    if (idx >= 0) {
      const tail = trimmed.slice(idx + 2);
      if (ABSOLUTE_URL_RE.test(tail)) candidate = tail;
    }
  } else if (ABSOLUTE_URL_RE.test(trimmed) && trimmed.includes('/;')) {
    const idx = trimmed.indexOf('/;');
    if (idx >= 0) {
      const tail = trimmed.slice(idx + 2);
      if (ABSOLUTE_URL_RE.test(tail)) candidate = tail;
    }
  }

  if (!ABSOLUTE_URL_RE.test(candidate)) return null;

  try {
    const parsed = new URL(candidate);
    const scheme = parsed.protocol === 'https:' ? 'https' : 'http';
    const port =
      parsed.port !== ''
        ? Number(parsed.port)
        : scheme === 'https'
          ? 443
          : 80;
    return {
      scheme,
      hostname: parsed.hostname,
      port,
      path: `${parsed.pathname}${parsed.search}`,
      originalUrl: parsed.toString()
    };
  } catch {
    return null;
  }
}

export function isRokuProxyRequest(url: string | undefined): boolean {
  return parseRokuProxyTarget(url) !== null;
}

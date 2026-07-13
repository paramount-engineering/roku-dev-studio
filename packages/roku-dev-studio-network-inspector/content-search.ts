/**
 * Shared, environment-agnostic "Find in content" matcher for the Network Inspector.
 *
 * The list-level Filter (see the renderer's `filterSessions`) only sees lightweight summary fields
 * (host/path/method/status/type). "Find" is different: it searches the *full* content of a captured
 * transaction — the request URL, request/response headers, and request/response bodies — and reports
 * which scopes matched and how many times. The heavy content lives on disk in the desktop app
 * (`NetworkDetailStore`) and inline in the offline Session Viewer; both drive this one matcher so the
 * semantics are identical on either surface.
 *
 * Pure + isomorphic: no Node or DOM APIs, so it runs in the Electron main process (over disk-backed
 * detail) and in the renderer (over the viewer's in-memory events) unchanged.
 *
 * Bodies stored as base64 (`bodyEncoding === 'base64'`) are binary/media payloads and are NOT
 * searched — decoding them here would pull in Buffer/atob (breaking isomorphism) and searching binary
 * as text is meaningless. Text bodies (the common JSON/text/XML/form case) are searched in full.
 */
import type { NetworkHttpMessage, ParsedNetworkEvent } from './types';

/** The distinct parts of a transaction that Find can search. */
export type NetworkFindScope = 'url' | 'reqHeaders' | 'reqBody' | 'respHeaders' | 'respBody';

export const ALL_FIND_SCOPES: readonly NetworkFindScope[] = [
  'url',
  'reqHeaders',
  'reqBody',
  'respHeaders',
  'respBody'
];

/** Per-scope match counts for a single event. Zeroed scopes simply didn't match (or weren't searched). */
export type NetworkFindScopeCounts = Record<NetworkFindScope, number>;

export type NetworkFindMatch = {
  id: string;
  /** Total matches across all searched scopes — drives the row badge. */
  total: number;
  scopes: NetworkFindScopeCounts;
};

export type NetworkFindOptions = {
  query: string;
  /** Which scopes to search. Empty/undefined = all scopes. */
  scopes?: readonly NetworkFindScope[];
  caseSensitive?: boolean;
  /** Treat `query` as a JS regular expression. Invalid patterns yield a null matcher. */
  regex?: boolean;
};

/**
 * A compiled matcher: counts occurrences of the query in a string. Built once per Find run, then
 * applied to many events. `null` means the query was empty or an invalid regex — callers treat that
 * as "no active search".
 */
export type ContentMatcher = {
  scopes: ReadonlySet<NetworkFindScope>;
  count: (haystack: string) => number;
};

const zeroCounts = (): NetworkFindScopeCounts => ({
  url: 0,
  reqHeaders: 0,
  reqBody: 0,
  respHeaders: 0,
  respBody: 0
});

function countSubstring(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

function countRegex(haystack: string, re: RegExp): number {
  // `re` carries the global flag; reset lastIndex so the matcher is reusable across haystacks.
  re.lastIndex = 0;
  let count = 0;
  let guard = 0;
  for (;;) {
    const m = re.exec(haystack);
    if (m === null) break;
    count += 1;
    // Guard against zero-width matches (e.g. `a*`) spinning forever.
    if (m.index === re.lastIndex) re.lastIndex += 1;
    if (++guard > 1_000_000) break;
  }
  return count;
}

/**
 * Compile a {@link ContentMatcher} from options, or `null` when the query is empty or (in regex
 * mode) not a valid pattern. Substring search is case-insensitive by default; the needle is
 * lower-cased once and each haystack is lower-cased at count time.
 */
export function createContentMatcher(opts: NetworkFindOptions): ContentMatcher | null {
  const raw = opts.query ?? '';
  if (!raw) return null;
  const scopeList =
    opts.scopes && opts.scopes.length > 0 ? opts.scopes : ALL_FIND_SCOPES;
  const scopes = new Set<NetworkFindScope>(scopeList);

  if (opts.regex) {
    let re: RegExp;
    try {
      re = new RegExp(raw, opts.caseSensitive ? 'g' : 'gi');
    } catch {
      return null;
    }
    return { scopes, count: (hay) => (hay ? countRegex(hay, re) : 0) };
  }

  if (opts.caseSensitive) {
    return { scopes, count: (hay) => (hay ? countSubstring(hay, raw) : 0) };
  }
  const needle = raw.toLowerCase();
  return { scopes, count: (hay) => (hay ? countSubstring(hay.toLowerCase(), needle) : 0) };
}

/** Flatten headers into the same `key: value` line form the detail view renders, for searching. */
function headerText(msg: NetworkHttpMessage | undefined): string {
  const headers = msg?.headers;
  if (!headers) return '';
  const lines: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    lines.push(`${key}: ${value}`);
  }
  return lines.join('\n');
}

/** Searchable body text, or '' for absent/binary(base64) bodies (see file header). */
function bodyText(msg: NetworkHttpMessage | undefined): string {
  if (!msg?.body) return '';
  if (msg.bodyEncoding === 'base64') return '';
  return msg.body;
}

/** The searchable "URL" of a request: the request line URL plus the resolved hostname / SNI. */
function urlText(event: ParsedNetworkEvent): string {
  return [event.httpRequest?.url, event.hostname, event.sni]
    .filter((s): s is string => !!s)
    .join(' ');
}

/**
 * Run a compiled matcher over one event and return per-scope counts, or `null` when nothing matched.
 * Pass the fullest event available: the summary (URL only) for a URL-scoped search, or the
 * detail-store event (headers + bodies) for header/body scopes. Missing parts simply score 0.
 */
export function matchEventContent(
  event: ParsedNetworkEvent,
  matcher: ContentMatcher
): NetworkFindMatch | null {
  const counts = zeroCounts();
  if (matcher.scopes.has('url')) counts.url = matcher.count(urlText(event));
  if (matcher.scopes.has('reqHeaders')) counts.reqHeaders = matcher.count(headerText(event.httpRequest));
  if (matcher.scopes.has('reqBody')) counts.reqBody = matcher.count(bodyText(event.httpRequest));
  if (matcher.scopes.has('respHeaders')) {
    counts.respHeaders = matcher.count(headerText(event.httpResponse));
  }
  if (matcher.scopes.has('respBody')) counts.respBody = matcher.count(bodyText(event.httpResponse));

  const total =
    counts.url + counts.reqHeaders + counts.reqBody + counts.respHeaders + counts.respBody;
  if (total === 0) return null;
  return { id: event.id, total, scopes: counts };
}

/** True when a Find run needs the on-disk/heavy detail (any header or body scope is active). */
export function findNeedsDetail(scopes: ReadonlySet<NetworkFindScope>): boolean {
  return (
    scopes.has('reqHeaders') ||
    scopes.has('reqBody') ||
    scopes.has('respHeaders') ||
    scopes.has('respBody')
  );
}

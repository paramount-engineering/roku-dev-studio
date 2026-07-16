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
import { MAX_FIND_QUERY_LENGTH, compileGlobalSearchRegex } from 'roku-dev-studio-platform/text-match';

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

/** Per-term counts within one event (a single colored search term's hits). */
export type NetworkFindTermCounts = {
  /** Total matches for this term across the scopes it searched. */
  total: number;
  scopes: NetworkFindScopeCounts;
};

export type NetworkFindMatch = {
  id: string;
  /** Total matches across all searched scopes and all terms — drives the row badge. */
  total: number;
  /** Aggregate per-scope counts summed across every matched term. */
  scopes: NetworkFindScopeCounts;
  /**
   * Per-term breakdown, keyed by term id — present only for multi-term runs
   * ({@link matchEventContentMulti}). Only terms that actually matched appear here, so a row's badge
   * can render one color segment per key. Absent for the legacy single-term {@link matchEventContent}.
   */
  terms?: Record<string, NetworkFindTermCounts>;
};

/**
 * One colored search term in a multi-term Find. Each term carries its OWN scope/case/regex options
 * (they are independent searches unioned together), plus a stable `id` the renderer maps to a color.
 * `color` lives on the renderer's term model, not here — the engine is color-agnostic.
 */
export type NetworkFindTerm = {
  id: string;
  query: string;
  scopes?: readonly NetworkFindScope[];
  caseSensitive?: boolean;
  regex?: boolean;
};

/** A multi-term Find request: an OR of up to a handful of independent terms. */
export type NetworkFindRequest = {
  terms: readonly NetworkFindTerm[];
};

/** A compiled term: its id paired with its matcher. Empty/invalid terms are dropped at compile time. */
export type CompiledFindTerm = {
  id: string;
  matcher: ContentMatcher;
};

export type NetworkFindOptions = {
  query: string;
  /** Which scopes to search. Empty/undefined = all scopes. */
  scopes?: readonly NetworkFindScope[];
  caseSensitive?: boolean;
  /** Treat `query` as a JS regular expression. A dangerous (ReDoS-suspect) or un-compilable pattern
   *  degrades to a literal search rather than yielding no matcher — see {@link createContentMatcher}. */
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

/**
 * Remove ALL whitespace so a substring search is insensitive to formatting. The detail view
 * pretty-prints JSON/XML (adding `: ` after colons, indentation, newlines) while the captured body is
 * often minified — so a query copied from what the user *sees* wouldn't match the raw bytes (and vice
 * versa). Stripping whitespace from both needle and haystack makes the match formatting-agnostic. Only
 * substring terms use this; regex terms control their own whitespace.
 */
function stripWhitespace(s: string): string {
  return s.replace(/\s+/g, '');
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
 * Compile a {@link ContentMatcher} from options, or `null` when the query is empty or too long (see
 * {@link MAX_FIND_QUERY_LENGTH}). Substring search is case-insensitive by default; the needle is
 * lower-cased once and each haystack is lower-cased at count time.
 *
 * Regex mode shares the app-wide {@link compileGlobalSearchRegex}, which applies the ReDoS/length
 * guards and falls back to a literal search on a dangerous or un-compilable pattern — important here
 * because NI Find runs in the Electron **main process**, where a catastrophic regex would stall the
 * whole app, not just one renderer.
 */
export function createContentMatcher(opts: NetworkFindOptions): ContentMatcher | null {
  const raw = opts.query ?? '';
  if (!raw || raw.length > MAX_FIND_QUERY_LENGTH) return null;
  const scopeList =
    opts.scopes && opts.scopes.length > 0 ? opts.scopes : ALL_FIND_SCOPES;
  const scopes = new Set<NetworkFindScope>(scopeList);

  if (opts.regex) {
    const re = compileGlobalSearchRegex(raw, { regex: true, caseSensitive: !!opts.caseSensitive });
    if (!re) return null;
    return { scopes, count: (hay) => (hay ? countRegex(hay, re) : 0) };
  }

  // Whitespace-insensitive substring match (see stripWhitespace): a query keeps matching whether the
  // body is minified or pretty-printed, and whether the user typed it with or without formatting spaces.
  const needle = stripWhitespace(opts.caseSensitive ? raw : raw.toLowerCase());
  // A whitespace-only query has nothing to match — treat it like an empty query (null = no matcher) so
  // it's dropped rather than forcing a full disk-backed scan that can never hit.
  if (!needle) return null;
  return {
    scopes,
    count: (hay) =>
      hay ? countSubstring(stripWhitespace(opts.caseSensitive ? hay : hay.toLowerCase()), needle) : 0
  };
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

/**
 * Compile every term of a multi-term request into a matcher, in order, dropping terms that are empty
 * or don't yield a matcher (see {@link createContentMatcher}). Each term keeps its own scope/case/
 * regex options — they're independent searches whose results are unioned (OR) per event.
 */
export function createContentMatchers(terms: readonly NetworkFindTerm[]): CompiledFindTerm[] {
  const out: CompiledFindTerm[] = [];
  for (const term of terms) {
    const matcher = createContentMatcher({
      query: term.query,
      scopes: term.scopes,
      caseSensitive: term.caseSensitive,
      regex: term.regex
    });
    if (matcher) out.push({ id: term.id, matcher });
  }
  return out;
}

/** True when ANY compiled term needs the on-disk/heavy detail — the single disk read is shared. */
export function findNeedsDetailMulti(terms: readonly CompiledFindTerm[]): boolean {
  return terms.some((t) => findNeedsDetail(t.matcher.scopes));
}

/**
 * Run all compiled terms over ONE event in a single pass and return the combined match, or `null`
 * when no term matched. The per-scope text (URL / headers / bodies) is materialized once for the
 * union of scopes any term wants, then reused across every term's matcher — so adding terms costs
 * extra `count()` calls, never extra body reads. `terms` in the result holds only the terms that
 * actually matched (each one becomes a color segment on the row); `scopes`/`total` aggregate them.
 */
export function matchEventContentMulti(
  event: ParsedNetworkEvent,
  terms: readonly CompiledFindTerm[]
): NetworkFindMatch | null {
  if (terms.length === 0) return null;

  // Union of scopes across all terms → materialize each needed haystack exactly once.
  const union = new Set<NetworkFindScope>();
  for (const t of terms) for (const s of t.matcher.scopes) union.add(s);
  const text: Record<NetworkFindScope, string> = {
    url: union.has('url') ? urlText(event) : '',
    reqHeaders: union.has('reqHeaders') ? headerText(event.httpRequest) : '',
    reqBody: union.has('reqBody') ? bodyText(event.httpRequest) : '',
    respHeaders: union.has('respHeaders') ? headerText(event.httpResponse) : '',
    respBody: union.has('respBody') ? bodyText(event.httpResponse) : ''
  };

  const agg = zeroCounts();
  const perTerm: Record<string, NetworkFindTermCounts> = {};
  let grandTotal = 0;

  for (const t of terms) {
    const counts = zeroCounts();
    let termTotal = 0;
    for (const scope of t.matcher.scopes) {
      const c = t.matcher.count(text[scope]);
      counts[scope] = c;
      termTotal += c;
    }
    if (termTotal > 0) {
      perTerm[t.id] = { total: termTotal, scopes: counts };
      for (const scope of ALL_FIND_SCOPES) agg[scope] += counts[scope];
      grandTotal += termTotal;
    }
  }

  if (grandTotal === 0) return null;
  return { id: event.id, total: grandTotal, scopes: agg, terms: perTerm };
}

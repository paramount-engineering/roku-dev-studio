/**
 * Shared input validation for Network Inspector operations exposed over more than one transport
 * (Electron IPC, the remote-server HTTP API). Kept here — not duplicated per transport — so a
 * validation change (a new allowed field, a tighter cap) can't silently drift between them.
 */
import { ALL_FIND_SCOPES, type NetworkFindRequest, type NetworkFindScope, type NetworkFindTerm } from './content-search';
import type { ReplayHttpInput } from './types';

/** Hard cap on colored Find terms accepted from a caller (matches the modal's palette size). */
export const MAX_FIND_TERMS = 5;

/** Upper bound on the replay socket wait (ms). Clamps a caller-supplied timeout. */
export const MAX_REPLAY_TIMEOUT_MS = 60_000;
/** Cap on replay request headers accepted from a caller (guards a hostile/buggy payload). */
export const MAX_REPLAY_HEADER_COUNT = 200;

/** Validate one caller-supplied Find term, or null when it has no usable query. Color is a
 *  renderer-only concern (results come back keyed by `id`), so it isn't accepted here. */
function sanitizeFindTerm(raw: unknown, index: number): NetworkFindTerm | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const query = typeof t.query === 'string' ? t.query : '';
  if (!query) return null;
  const id = typeof t.id === 'string' && t.id ? t.id : `t${index}`;
  const scopes = Array.isArray(t.scopes)
    ? t.scopes.filter((s): s is NetworkFindScope =>
        (ALL_FIND_SCOPES as readonly string[]).includes(s as string)
      )
    : undefined;
  return {
    id,
    query,
    scopes: scopes && scopes.length > 0 ? scopes : undefined,
    caseSensitive: t.caseSensitive === true,
    regex: t.regex === true
  };
}

/** Validate a caller-supplied multi-term Find request, or null when no term has a usable query.
 *  Caps the term count at {@link MAX_FIND_TERMS} so a hostile/buggy caller can't fan out unboundedly. */
export function sanitizeFindOptions(raw: unknown): NetworkFindRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const rawTerms = Array.isArray(o.terms) ? o.terms : [];
  const terms: NetworkFindTerm[] = [];
  for (const rt of rawTerms) {
    if (terms.length >= MAX_FIND_TERMS) break;
    const term = sanitizeFindTerm(rt, terms.length);
    if (term) terms.push(term);
  }
  if (terms.length === 0) return null;
  return { terms };
}

/**
 * Coerce a caller-supplied replay input into a safe {@link ReplayHttpInput}, or null when the URL
 * isn't a parseable absolute http(s) URL. Method defaults to GET (uppercased); headers keep only
 * string→string pairs; body is a string; bodyEncoding is restricted to 'text' | 'base64'.
 */
export function sanitizeReplayInput(raw: unknown): ReplayHttpInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  const method = (typeof o.method === 'string' && o.method.trim() ? o.method.trim() : 'GET').toUpperCase();
  const headers: Record<string, string> = {};
  if (o.headers && typeof o.headers === 'object' && !Array.isArray(o.headers)) {
    let n = 0;
    for (const [k, v] of Object.entries(o.headers as Record<string, unknown>)) {
      if (n >= MAX_REPLAY_HEADER_COUNT) break;
      if (typeof k === 'string' && k && typeof v === 'string') {
        headers[k] = v;
        n++;
      }
    }
  }
  const bodyEncoding = o.bodyEncoding === 'base64' ? 'base64' : o.bodyEncoding === 'text' ? 'text' : undefined;
  const input: ReplayHttpInput = { method, url };
  if (Object.keys(headers).length) input.headers = headers;
  if (typeof o.body === 'string') input.body = o.body;
  if (bodyEncoding) input.bodyEncoding = bodyEncoding;
  return input;
}

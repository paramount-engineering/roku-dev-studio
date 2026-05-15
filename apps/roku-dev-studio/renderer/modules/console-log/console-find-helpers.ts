/**
 * Pure helpers for telnet find/filter: query/regex compilation, query matching,
 * cache keying, and shared tunables. No DOM, no closure state.
 *
 * Extracted from `console-find-bar.ts` so the algorithmic pieces can be
 * read without scanning past hundreds of lines of DOM event glue, and so they
 * can be unit-tested in isolation. The find bar still owns the runtime state
 * (cache map, active `flatHits`, navigation cursor); this module just provides
 * the building blocks.
 */

export type ConsoleFindOptions = {
  case: boolean;
  word: boolean;
  regex: boolean;
};

/** One match in the flat search result list, in document order. */
export type FlatHit = { lineIndex: number; start: number; end: number };

/**
 * One slot in the find bar's LRU cache. `hits` and `scannedUpTo` together
 * describe "we have searched entries `[0, scannedUpTo)` for this query and
 * these are the matches we found". The trim hook (`onLinesRemoved` in the find
 * bar) keeps both fields consistent in-place so a cached entry stays usable
 * across scrollback churn.
 *
 * The active query's `hits` array is *aliased* (same reference) as the find
 * bar's `flatHits`, so pushing during a chunked scan transparently updates the
 * cache slot.
 */
export type FindCacheEntry = {
  query: string;
  options: ConsoleFindOptions;
  hits: FlatHit[];
  scannedUpTo: number;
};

/** Reject patterns longer than this — the catastrophic-backtracking heuristic
 *  doesn't catch every footgun, and pathological 200+ char regexes are an
 *  outsize threat to the renderer's main thread. */
export const MAX_REGEX_PATTERN_LENGTH = 100;

/** Hard cap on the find input. Beyond this we assume the user pasted random
 *  binary into the box and refuse to scan. */
export const MAX_FIND_QUERY_LENGTH = 300;

/**
 * Cap on painted match Range objects. The find count and prev/next navigation
 * still cover all hits — we just stop *painting* once we have this many.
 * Mirrors xterm.js's default decoration cap (1000); we go higher because our
 * find bar is the primary navigation surface and users expect "60 of 60" all
 * visible at once.
 */
export const HIGHLIGHT_PAINT_CAP = 5000;

/** LRU capacity for the (query, options) → hits cache. Small linear-scan cap
 *  is intentional — eight cached queries covers the common back-and-forth flow
 *  ("debug" / "error" / "warning") without holding too many large hit arrays. */
export const FIND_CACHE_CAP = 8;

/**
 * Catastrophic-backtracking heuristic. Long patterns are rejected outright;
 * common nested-quantifier shapes are recognized by the regex below. Both
 * paths fall back to literal substring matching in the find bar.
 */
export function isLikelyRedos(pattern: string): boolean {
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) return true;
  return /\(\.\*\)\*|\(\.\+\)\+|\(\.\*\)\+|\(\.\+\)\*|\{\d+,\s*\d*\}\s*\+/.test(pattern);
}

/** Escape a string so every character is literal in a `RegExp`. */
export function safeRegexEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Plain-text match used by Filter mode and Copy/Save. Mirrors `buildSearchRegex`'s
 * decisions: regex mode falls back to literal on ReDoS / parse failure; word
 * mode wraps in `\b…\b`; otherwise plain `.includes`.
 */
export function consoleFindMatchesQuery(
  text: string,
  query: string,
  findOptions: ConsoleFindOptions
): boolean {
  if (!query) return true;
  if (query.length > MAX_FIND_QUERY_LENGTH) return false;

  const flags = findOptions.case ? '' : 'i';
  const literalMatch = (): boolean =>
    findOptions.case ? text.includes(query) : text.toLowerCase().includes(query.toLowerCase());

  if (findOptions.regex) {
    if (isLikelyRedos(query)) return literalMatch();
    try {
      const regex = new RegExp(query, flags);
      return regex.test(text);
    } catch {
      return literalMatch();
    }
  }
  if (findOptions.word) {
    try {
      const escaped = safeRegexEscape(query);
      const regex = new RegExp(`\\b${escaped}\\b`, flags);
      return regex.test(text);
    } catch {
      return literalMatch();
    }
  }
  return literalMatch();
}

/**
 * Stable cache key for `(query, options)`. The fixed bit-position encoding
 * means two equivalent option sets produce the same key regardless of object
 * key order in the source.
 */
export function cacheKeyFor(query: string, options: ConsoleFindOptions): string {
  return `${options.case ? '1' : '0'}|${options.word ? '1' : '0'}|${options.regex ? '1' : '0'}|${query}`;
}

/**
 * Compile the active query into a `RegExp`. Always returns a global-flag regex
 * (or `null` if the query is empty / too long / un-compilable). Callers must
 * `lastIndex = 0` before each entry's scan loop because we share a single
 * compiled regex across thousands of `String#exec` calls.
 *
 * Regex mode falls back to escaped-literal on ReDoS or parse failure so a bad
 * pattern doesn't break the search outright.
 */
export function buildSearchRegex(query: string, findOptions: ConsoleFindOptions): RegExp | null {
  if (!query) return null;
  if (query.length > MAX_FIND_QUERY_LENGTH) return null;
  const flags = findOptions.case ? 'g' : 'gi';
  try {
    if (findOptions.regex && !isLikelyRedos(query)) {
      return new RegExp(query, flags);
    }
  } catch {
    /* fall through to escaped */
  }
  const escaped = safeRegexEscape(query);
  try {
    return findOptions.word ? new RegExp(`\\b${escaped}\\b`, flags) : new RegExp(escaped, flags);
  } catch {
    return null;
  }
}

/**
 * Shared, environment-agnostic text-search primitives.
 *
 * Every "search" surface in the app needs the same low-level decisions: how long a query may be
 * before we refuse it, which regexes are too dangerous to run, how to escape a literal for use in a
 * `RegExp`, and how to compile a (query, options) pair into a single global regex. Historically these
 * lived twice — once in the Console/Log Viewer find bar (`console-find-helpers.ts`, renderer) and
 * once, thinner and *without the safety guards*, in the Network Inspector's content matcher
 * (`content-search.ts`, main process). This module is the one source of truth so the semantics — and
 * crucially the ReDoS/length guards — are identical on every surface and can't drift.
 *
 * Lives in `roku-dev-studio-platform` (next to `ttl-cache` / `async-patterns` / `validation`) rather
 * than any one feature package: it's a generic host-neutral utility. Pure + isomorphic (no Node or
 * DOM APIs), so it runs in the Electron main process, the renderer, and unit tests unchanged.
 */

/** Reject regex patterns longer than this — the catastrophic-backtracking heuristic doesn't catch
 *  every footgun, and pathological 200+ char patterns are an outsize threat to whichever thread runs
 *  them (renderer *or* the Electron main process, where NI Find executes). */
export const MAX_REGEX_PATTERN_LENGTH = 100;

/** Hard cap on the search input. Beyond this we assume the user pasted random binary into the box
 *  and refuse to scan. */
export const MAX_FIND_QUERY_LENGTH = 300;

/**
 * Catastrophic-backtracking heuristic. Long patterns are rejected outright; common nested-quantifier
 * shapes are recognized by the regex below. Callers fall back to literal matching on a `true` result.
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
 * Heuristic: does this query look like a *deliberate* regular expression? Only STRONG signals that are
 * meaningless (or very rare) in a literal search count — a bare `.`, `?`, or `*` (common in URLs/paths)
 * does NOT trigger, so we never nudge on an ordinary text search. Used across the find surfaces to
 * suggest (not force) regex mode when the user has typed a pattern with the regex toggle still off.
 */
export function looksLikeRegex(query: string): boolean {
  const s = query.trim();
  if (!s) return false;
  if (/\\[a-zA-Z0-9./(){}[\]^$|+*?-]/.test(s)) return true; // an escape like \s \d \. \w \\
  if (/\[[^\]]+\]/.test(s)) return true; // a character class [...]
  if (/\([^)]*\|[^)]*\)/.test(s)) return true; // an alternation group (a|b)
  if (/\{\d+(?:,\d*)?\}/.test(s)) return true; // a quantifier {n} {n,} {n,m}
  if (/\.[*+]/.test(s)) return true; // .* or .+
  return s.startsWith('^') || s.endsWith('$'); // an anchor
}

export type CompileRegexOptions = {
  /** Treat `query` as a JS regular expression (subject to the ReDoS guard). */
  regex?: boolean;
  /** Wrap the (escaped) query in `\b…\b` word boundaries. Ignored in regex mode. */
  word?: boolean;
  caseSensitive?: boolean;
};

/**
 * Compile a (query, options) pair into a single **global**-flag `RegExp`, or `null` when the query is
 * empty or too long. Regex mode falls back to an escaped literal on a ReDoS-suspect or un-compilable
 * pattern, so a bad pattern degrades to a safe literal search rather than hanging the thread or
 * breaking the search outright. Callers that share one compiled regex across many `exec`/`test` calls
 * must reset `lastIndex = 0` before each fresh scan.
 */
export function compileGlobalSearchRegex(
  query: string,
  opts: CompileRegexOptions = {}
): RegExp | null {
  if (!query) return null;
  if (query.length > MAX_FIND_QUERY_LENGTH) return null;
  const flags = opts.caseSensitive ? 'g' : 'gi';
  if (opts.regex && !isLikelyRedos(query)) {
    try {
      return new RegExp(query, flags);
    } catch {
      /* fall through to escaped literal */
    }
  }
  const escaped = safeRegexEscape(query);
  try {
    return opts.word ? new RegExp(`\\b${escaped}\\b`, flags) : new RegExp(escaped, flags);
  } catch {
    return null;
  }
}

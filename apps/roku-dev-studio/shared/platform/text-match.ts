/**
 * Shim: the shared text-search primitives (ReDoS/length guards, literal escaping, regex compilation)
 * live in the `roku-dev-studio-platform` package — a generic, host-neutral utility used by every
 * search surface (Console, Log Viewer, Network Inspector Find). The HTML renderer is transpiled
 * per-file (`bundle: false`), so transpile-renderer.ts bundles this shim to inline the package into a
 * browser-loadable module; renderer code imports it via `../../shared/platform/text-match.js`.
 *
 * NOTE: the platform package ships a **CommonJS** dist, so esbuild can't statically discover its
 * export names for an `export *` — that compiles to a runtime namespace copy with no ESM named
 * exports, and `import { isLikelyRedos }` then fails at load. Re-export each name explicitly (same as
 * the `err-util` shim) so real ESM bindings are emitted.
 */
export {
  MAX_REGEX_PATTERN_LENGTH,
  MAX_FIND_QUERY_LENGTH,
  isLikelyRedos,
  safeRegexEscape,
  compileGlobalSearchRegex,
  type CompileRegexOptions
} from 'roku-dev-studio-platform/text-match';

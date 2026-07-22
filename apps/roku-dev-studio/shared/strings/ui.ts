/**
 * UI strings for the shared UI primitives — the find bars (find-bar.ts,
 * multi-keyword-find-bar.ts), the copy button, the connection-status display,
 * and the centered header-search resize handle
 * (renderer/modules/ui/*.ts).
 *
 * These are generic building blocks, so generic verbs/status words (Connected,
 * Disconnected, Copied, Search, …) reuse `S.common.*`; only copy specific to
 * these primitives lives here.
 *
 * Parametrized strings are functions returning the composed text — the standard
 * way to keep interpolation translatable without a runtime format library. Plain
 * leaves are also usable from static HTML via `data-i18n`.
 */
export const ui = {
  // Connection status — fallback label when an error carries no message.
  // (The "Connected"/"Disconnected" states reuse S.common.connected/disconnected.)
  statusError: 'Error',

  // Find-bar input placeholders
  findPlaceholder: 'Find',
  searchPlaceholder: 'Search…',

  // Find-bar match navigation — icon-button accessible names + tooltips (the
  // tooltip variants append the keyboard shortcut).
  prevMatch: 'Previous Match',
  prevMatchTitle: 'Previous Match (Shift+Enter)',
  nextMatch: 'Next Match',
  nextMatchTitle: 'Next Match (Enter)',
  clearSearch: 'Clear Search',
  clearSearchTitle: 'Clear Search (Esc)',

  // Find-bar result counts
  noResults: 'No Results',
  matchCountOf: (current: number, total: string): string => `${current} of ${total}`,

  // Multi-keyword find bar — regex toggle, hints, and per-chip affordances
  useRegex: 'Use Regular Expression',
  useRegexAria: 'Use Regular Expression',
  regexSuggest: 'This looks like a regular expression — click to search by regex',
  regexBadgeTitle: 'Regular Expression',
  multiWordSearchHint: 'Press <kbd>Enter</kbd> to search multiple words',
  removeKeywordAria: (text: string): string => `Remove ${text}`,

  // Centered header-search box: drag-to-resize handle tooltip
  resizeSearchTitle: 'Drag to widen Search Bar (double-click to reset)',
} as const;

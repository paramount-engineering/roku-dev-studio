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
  statusError: 'Erro',

  // Find-bar input placeholders
  findPlaceholder: 'Localizar',
  searchPlaceholder: 'Buscar…',

  // Find-bar match navigation — icon-button accessible names + tooltips (the
  // tooltip variants append the keyboard shortcut).
  prevMatch: 'Ocorrência anterior',
  prevMatchTitle: 'Ocorrência anterior (Shift+Enter)',
  nextMatch: 'Próxima ocorrência',
  nextMatchTitle: 'Próxima ocorrência (Enter)',
  clearSearch: 'Limpar busca',
  clearSearchTitle: 'Limpar busca (Esc)',

  // Find-bar result counts
  noResults: 'Nenhum resultado',
  matchCountOf: (current: number, total: string): string => `${current} de ${total}`,

  // Multi-keyword find bar — regex toggle, hints, and per-chip affordances
  useRegex: 'Usar expressão regular',
  useRegexAria: 'Usar expressão regular',
  regexSuggest: 'Isto parece uma expressão regular — clique para buscar por regex',
  regexBadgeTitle: 'Expressão regular',
  multiWordSearchHint: 'Pressione <kbd>Enter</kbd> para buscar várias palavras',
  removeKeywordAria: (text: string): string => `Remover ${text}`,

  // Centered header-search box: drag-to-resize handle tooltip
  resizeSearchTitle: 'Arraste para alargar a barra de busca (clique duplo para redefinir)',
};

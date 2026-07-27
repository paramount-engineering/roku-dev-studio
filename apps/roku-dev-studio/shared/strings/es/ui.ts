/**
 * Latin American Spanish (neutral) translation of the shared UI primitive strings —
 * the find bars, the copy button, the connection-status display, and the centered
 * header-search resize handle. Sibling of ../ui.ts — same `ui` shape, keys, order,
 * and function signatures.
 *
 * Generic verbs/status words (Connected, Disconnected, Search, …) reuse S.common.*;
 * only copy specific to these primitives lives here. Some values embed <kbd> markup
 * because they're injected via innerHTML. Only literal display text is translated.
 */
export const ui = {
  // Connection status — fallback label when an error carries no message.
  // (The "Connected"/"Disconnected" states reuse S.common.connected/disconnected.)
  statusError: 'Error',

  // Find-bar input placeholders
  findPlaceholder: 'Buscar',
  searchPlaceholder: 'Buscar…',

  // Find-bar match navigation — icon-button accessible names + tooltips (the
  // tooltip variants append the keyboard shortcut).
  prevMatch: 'Coincidencia anterior',
  prevMatchTitle: 'Coincidencia anterior (Shift+Enter)',
  nextMatch: 'Coincidencia siguiente',
  nextMatchTitle: 'Coincidencia siguiente (Enter)',
  clearSearch: 'Limpiar búsqueda',
  clearSearchTitle: 'Limpiar búsqueda (Esc)',

  // Find-bar result counts
  noResults: 'Sin resultados',
  matchCountOf: (current: number, total: string): string => `${current} de ${total}`,

  // Multi-keyword find bar — regex toggle, hints, and per-chip affordances
  useRegex: 'Usar expresión regular',
  useRegexAria: 'Usar expresión regular',
  regexSuggest: 'Esto parece una expresión regular — haga clic para buscar por regex',
  regexBadgeTitle: 'Expresión regular',
  multiWordSearchHint: 'Presione <kbd>Enter</kbd> para buscar varias palabras',
  removeKeywordAria: (text: string): string => `Quitar ${text}`,

  // Centered header-search box: drag-to-resize handle tooltip
  resizeSearchTitle: 'Arrastre para ensanchar la barra de búsqueda (doble clic para restablecer)',
};

/**
 * Romanian (ro) translation of the shared UI primitive strings — the find bars,
 * the copy button, the connection-status display, and the centered header-search
 * resize handle. Sibling of ../ui.ts — same `ui` shape, keys, order, and function
 * signatures.
 *
 * Generic verbs/status words (Connected, Disconnected, Search, …) reuse S.common.*;
 * only copy specific to these primitives lives here. Some values embed <kbd> markup
 * because they're injected via innerHTML. Only literal display text is translated.
 */
export const ui = {
  // Connection status — fallback label when an error carries no message.
  // (The "Connected"/"Disconnected" states reuse S.common.connected/disconnected.)
  statusError: 'Eroare',

  // Find-bar input placeholders
  findPlaceholder: 'Găsește',
  searchPlaceholder: 'Caută…',

  // Find-bar match navigation — icon-button accessible names + tooltips (the
  // tooltip variants append the keyboard shortcut).
  prevMatch: 'Potrivirea anterioară',
  prevMatchTitle: 'Potrivirea anterioară (Shift+Enter)',
  nextMatch: 'Potrivirea următoare',
  nextMatchTitle: 'Potrivirea următoare (Enter)',
  clearSearch: 'Șterge căutarea',
  clearSearchTitle: 'Șterge căutarea (Esc)',

  // Find-bar result counts
  noResults: 'Niciun rezultat',
  matchCountOf: (current: number, total: string): string => `${current} din ${total}`,

  // Multi-keyword find bar — regex toggle, hints, and per-chip affordances
  useRegex: 'Folosește expresie regulată',
  useRegexAria: 'Folosește expresie regulată',
  regexSuggest: 'Aceasta pare a fi o expresie regulată — faceți clic pentru a căuta cu regex',
  regexBadgeTitle: 'Expresie regulată',
  multiWordSearchHint: 'Apăsați <kbd>Enter</kbd> pentru a căuta mai multe cuvinte',
  removeKeywordAria: (text: string): string => `Elimină ${text}`,

  // Centered header-search box: drag-to-resize handle tooltip
  resizeSearchTitle: 'Trageți pentru a lărgi bara de căutare (dublu clic pentru a reseta)',
};

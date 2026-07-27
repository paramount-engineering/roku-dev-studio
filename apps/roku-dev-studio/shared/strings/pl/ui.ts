/**
 * Polish (pl) translation of the shared UI primitive strings — the find bars,
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
  statusError: 'Błąd',

  // Find-bar input placeholders
  findPlaceholder: 'Znajdź',
  searchPlaceholder: 'Szukaj…',

  // Find-bar match navigation — icon-button accessible names + tooltips (the
  // tooltip variants append the keyboard shortcut).
  prevMatch: 'Poprzednie dopasowanie',
  prevMatchTitle: 'Poprzednie dopasowanie (Shift+Enter)',
  nextMatch: 'Następne dopasowanie',
  nextMatchTitle: 'Następne dopasowanie (Enter)',
  clearSearch: 'Wyczyść wyszukiwanie',
  clearSearchTitle: 'Wyczyść wyszukiwanie (Esc)',

  // Find-bar result counts
  noResults: 'Brak wyników',
  matchCountOf: (current: number, total: string): string => `${current} z ${total}`,

  // Multi-keyword find bar — regex toggle, hints, and per-chip affordances
  useRegex: 'Użyj wyrażenia regularnego',
  useRegexAria: 'Użyj wyrażenia regularnego',
  regexSuggest: 'To wygląda na wyrażenie regularne — kliknij, aby wyszukać za pomocą regex',
  regexBadgeTitle: 'Wyrażenie regularne',
  multiWordSearchHint: 'Naciśnij <kbd>Enter</kbd>, aby wyszukać wiele słów',
  removeKeywordAria: (text: string): string => `Usuń ${text}`,

  // Centered header-search box: drag-to-resize handle tooltip
  resizeSearchTitle: 'Przeciągnij, aby poszerzyć pasek wyszukiwania (dwukrotne kliknięcie resetuje)',
};

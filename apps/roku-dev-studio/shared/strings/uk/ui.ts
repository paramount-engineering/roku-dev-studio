/**
 * Ukrainian (uk) translation of the shared UI primitive strings — the find bars,
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
  statusError: 'Помилка',

  // Find-bar input placeholders
  findPlaceholder: 'Знайти',
  searchPlaceholder: 'Пошук…',

  // Find-bar match navigation — icon-button accessible names + tooltips (the
  // tooltip variants append the keyboard shortcut).
  prevMatch: 'Попередній збіг',
  prevMatchTitle: 'Попередній збіг (Shift+Enter)',
  nextMatch: 'Наступний збіг',
  nextMatchTitle: 'Наступний збіг (Enter)',
  clearSearch: 'Очистити пошук',
  clearSearchTitle: 'Очистити пошук (Esc)',

  // Find-bar result counts
  noResults: 'Немає результатів',
  matchCountOf: (current: number, total: string): string => `${current} з ${total}`,

  // Multi-keyword find bar — regex toggle, hints, and per-chip affordances
  useRegex: 'Використовувати регулярний вираз',
  useRegexAria: 'Використовувати регулярний вираз',
  regexSuggest: 'Це схоже на регулярний вираз — натисніть, щоб шукати за regex',
  regexBadgeTitle: 'Регулярний вираз',
  multiWordSearchHint: 'Натисніть <kbd>Enter</kbd>, щоб шукати кілька слів',
  removeKeywordAria: (text: string): string => `Вилучити ${text}`,

  // Centered header-search box: drag-to-resize handle tooltip
  resizeSearchTitle: 'Перетягніть, щоб розширити рядок пошуку (подвійне клацання для скидання)',
};

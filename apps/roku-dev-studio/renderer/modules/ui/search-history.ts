/**
 * Shared search-term history for text inputs — shell-style recall with the
 * Up/Down arrow keys.
 *
 *   - Up    → older query (saves the in-progress draft on the first press)
 *   - Down  → newer query, back down to the draft
 *
 * A query is committed to history when the user "finishes" a search: on Enter,
 * or when the input loses focus with a non-empty value (search-as-you-type
 * surfaces rarely press Enter). Duplicates move to the most-recent slot rather
 * than piling up. History persists per `storageKey`.
 *
 * Arrow keys don't move the caret in a single-line input, so hijacking them for
 * history is safe; we only `preventDefault` when we actually navigate.
 */

import { inMemorySessionStore } from './in-memory-storage.js';

export interface SearchHistoryOptions {
  input: HTMLInputElement;
  /** Storage key for the persisted history array. */
  storageKey: string;
  /** Backing store. Default sessionStorage (per-box, per-session history);
   *  keys are already scoped per section + device, so each search box keeps its
   *  own list. Pass localStorage to persist across app restarts. */
  storage?: Storage;
  /** Max entries kept. Default 50. */
  max?: number;
  /** Called after Up/Down changes the value, so the surface can run the search. */
  onChange?: (value: string) => void;
}

export function attachSearchHistory(o: SearchHistoryOptions): { commit: (v: string) => void; dispose: () => void } {
  const { input } = o;
  const MAX = o.max ?? 50;
  // Default to an in-memory store, NOT sessionStorage: the first sessionStorage touch on Electron's
  // file:// origin stalls the renderer ~4s (see in-memory-storage.ts), and it landed on the first
  // find bar built during a device connect. In-memory has identical per-window semantics here.
  const store: Storage = o.storage ?? inMemorySessionStore;

  let history: string[] = []; // oldest → newest
  try {
    const raw = store.getItem(o.storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) history = parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    /* ignore */
  }

  // `pointer` indexes `history`; === history.length means "the live draft".
  let pointer = history.length;
  let draft = '';

  const persist = (): void => {
    try {
      store.setItem(o.storageKey, JSON.stringify(history.slice(-MAX)));
    } catch {
      /* ignore */
    }
  };

  const setValue = (v: string): void => {
    input.value = v;
    try {
      input.setSelectionRange(v.length, v.length);
    } catch {
      /* some input types disallow selection; ignore */
    }
    o.onChange?.(v);
  };

  const commit = (raw: string): void => {
    const v = raw.trim();
    pointer = history.length;
    draft = '';
    if (!v) return;
    const existing = history.indexOf(v);
    if (existing !== -1) history.splice(existing, 1);
    history.push(v);
    if (history.length > MAX) history = history.slice(-MAX);
    persist();
    pointer = history.length;
  };

  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowUp') {
      if (history.length === 0 || pointer === 0) return;
      if (pointer === history.length) draft = input.value; // stash the live draft on first Up
      pointer--;
      e.preventDefault();
      setValue(history[pointer]!);
    } else if (e.key === 'ArrowDown') {
      if (pointer >= history.length) return;
      pointer++;
      e.preventDefault();
      setValue(pointer === history.length ? draft : history[pointer]!);
    } else if (e.key === 'Enter') {
      // Let the surface's own Enter handler run; just remember the query.
      commit(input.value);
    }
  };

  // Typing a fresh character resets the recall pointer to the draft position.
  const onInput = (): void => {
    pointer = history.length;
  };
  const onBlur = (): void => {
    if (input.value.trim()) commit(input.value);
  };

  input.addEventListener('keydown', onKeydown);
  input.addEventListener('input', onInput);
  input.addEventListener('blur', onBlur);

  return {
    commit,
    dispose(): void {
      input.removeEventListener('keydown', onKeydown);
      input.removeEventListener('input', onInput);
      input.removeEventListener('blur', onBlur);
    }
  };
}

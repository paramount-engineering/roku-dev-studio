/**
 * Per-request divergence store for the Network Inspector detail-pane find bars, shared by BOTH the live
 * tab (`network-tab.ts`) and the offline Session Viewer (`network-session-viewer.ts`).
 *
 * Each request stores its OWN body-search terms per pane — the terms the user actually typed there
 * (`added`) plus any modal terms they deleted there (`removed`, a tombstone of lowercased modal texts).
 * The set shown/searched in a pane is computed AT VIEW TIME as (current modal terms − removed) ∪ added,
 * so modal edits are unioned in lazily and a per-request removal sticks for that request without ever
 * storing the modal terms themselves. Modal terms keep their color/regex flags; the user's own terms
 * get the neutral {@link USER_KEYWORD_COLOR}.
 *
 * The two hosts differ only in where the modal terms and the selected id come from, so those are
 * injected — everything else (the store, the union, the edit-diff) lives here once.
 */
import type { MkwKeyword } from './multi-keyword-find-bar.js';

export type PaneKind = 'request' | 'response';

/** Neutral color for the user's own pane-typed keywords (modal terms keep their palette color). */
export const USER_KEYWORD_COLOR = '#94a3b8';

/** True when two keyword lists have the same texts in the same order (case-insensitive) — used to skip
 *  a passive reseed that wouldn't change the chips (which would needlessly reset the nav cursor). */
export function sameKeywordTexts(a: MkwKeyword[], b: MkwKeyword[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.text.toLowerCase() !== b[i]!.text.toLowerCase()) return false;
  }
  return true;
}

export interface PaneFindStoreDeps {
  /** The modal terms (regex + substring) to union into request `id`'s panes, or `[]` for a non-match.
   *  The host owns the match-gate (a non-match shows purely the user's own stored terms). */
  modalSeedFor: (id: string) => MkwKeyword[];
  /** The host's currently-selected event id (or null) — the request a pane edit is attributed to. */
  getSelectedId: () => string | null;
}

export interface PaneFindStore {
  /** View-time keyword set for `which` pane of request `id`: (modal − removed) ∪ added, deduped. */
  computeEffective: (id: string, which: PaneKind) => MkwKeyword[];
  /** Persist a pane's chip edit onto the SELECTED request's store: chips not from the modal become
   *  `added`; modal terms now absent become `removed` tombstones (per-request, not synced). */
  applyPaneEdit: (which: PaneKind, chips: MkwKeyword[]) => void;
  /** Drop all stored per-request terms (Clear Events / new session). */
  clear: () => void;
}

type Pane = { added: string[]; removed: string[] };
type RequestStores = { request: Pane; response: Pane };

export function createPaneFindStore(deps: PaneFindStoreDeps): PaneFindStore {
  const stores = new Map<string, RequestStores>();

  const ensure = (id: string): RequestStores => {
    let s = stores.get(id);
    if (!s) {
      s = { request: { added: [], removed: [] }, response: { added: [], removed: [] } };
      stores.set(id, s);
    }
    return s;
  };

  return {
    computeEffective(id, which) {
      const store = stores.get(id)?.[which] ?? { added: [], removed: [] };
      const removed = new Set(store.removed.map((t) => t.toLowerCase()));
      const seen = new Set<string>();
      const out: MkwKeyword[] = [];
      for (const m of deps.modalSeedFor(id)) {
        const key = m.text.toLowerCase();
        if (removed.has(key) || seen.has(key)) continue;
        seen.add(key);
        out.push({ text: m.text, color: m.color, regex: m.regex, caseSensitive: m.caseSensitive });
      }
      for (const a of store.added) {
        const key = a.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ text: a, color: USER_KEYWORD_COLOR });
      }
      return out;
    },
    applyPaneEdit(which, chips) {
      const id = deps.getSelectedId();
      if (!id) return;
      const modalTexts = new Set(deps.modalSeedFor(id).map((k) => k.text.toLowerCase()));
      const present = new Set(chips.map((k) => k.text.toLowerCase()));
      const store = ensure(id)[which];
      store.added = chips.filter((k) => !modalTexts.has(k.text.toLowerCase())).map((k) => k.text);
      store.removed = [...modalTexts].filter((t) => !present.has(t));
    },
    clear() {
      stores.clear();
    }
  };
}

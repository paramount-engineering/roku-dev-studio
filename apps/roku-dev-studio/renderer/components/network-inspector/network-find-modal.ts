/**
 * Network Inspector — "Find in content" modal.
 *
 * A surface-agnostic control panel for searching the *full* content of captured transactions
 * (request URL, request/response headers, request/response bodies) — as opposed to the toolbar
 * Filter, which only narrows the list by summary fields. The modal owns the query, scope chips, and
 * case/regex options; the *results* live in the host's own session list ("keep all + badge & jump"):
 *
 *   - The host badges matching rows and reports back which matched rows are currently visible.
 *   - Prev/Next (and Enter / Shift+Enter) walk that visible set, asking the host to select + scroll
 *     to each one and to seed the detail-pane find bar so the hit is highlighted in the body.
 *
 * Both the live Network tab and the offline Session Viewer drive this via {@link FindModalCallbacks}
 * — the only difference is how `search` sources content (IPC over the disk store vs. in-memory).
 */
import type {
  NetworkFindMatch,
  NetworkFindOptions,
  NetworkFindScope
} from '@shared/network-inspector/content-search';
import { escapeHtml } from '../../modules/utils/dom.js';

/** The four user-facing scope chips, mapped to the engine's granular scopes. */
type ChipKey = 'url' | 'request' | 'response' | 'headers';

const CHIP_LABELS: Array<{ key: ChipKey; label: string; title: string }> = [
  { key: 'url', label: 'URL', title: 'Request URL, hostname and SNI' },
  { key: 'request', label: 'Request Body', title: 'Request payload' },
  { key: 'response', label: 'Response Body', title: 'Response payload' },
  { key: 'headers', label: 'Headers', title: 'Request and response headers' }
];

const CHIP_SCOPES: Record<ChipKey, NetworkFindScope[]> = {
  url: ['url'],
  request: ['reqBody'],
  response: ['respBody'],
  headers: ['reqHeaders', 'respHeaders']
};

export type FindModalCallbacks = {
  /** Run the search for the given options and return per-event match counts. */
  search: (options: NetworkFindOptions) => Promise<NetworkFindMatch[]>;
  /**
   * Hand the host the fresh match set so it can badge rows. The host returns the eventIds that are
   * both matched AND currently visible, in list order — that ordered set is what Prev/Next walks.
   */
  onResults: (matches: NetworkFindMatch[]) => string[];
  /** Select + scroll to a matched event and seed its detail find bar with `query`. */
  onNavigate: (eventId: string, query: string) => void;
  /** Called when the search is cleared/emptied so the host can drop all badges. */
  onClear: () => void;
  /** Modal opened — host suppresses the match-bar entrance animation (feedback is deferred to close). */
  onOpen?: () => void;
  /** Modal closed — host plays the match-bar entrance animation now that the list is back in view. */
  onClose?: () => void;
};

export type FindModalHandle = {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  /** Whether a search query is currently active (results may be showing even with the modal closed). */
  isActive: () => boolean;
  /** Advance to the next / Previous Match (used by the header ↑/↓ buttons — works while closed). */
  next: () => void;
  prev: () => void;
  /** Re-run the active search against the current list (new events arrived / filter changed). Works
   *  whether the modal is open or closed, so future requests keep getting matched + highlighted. */
  refresh: () => void;
  /** Clear the query + results (keeps scope/option prefs) — e.g. the header "clear Find" button. */
  clear: () => void;
  destroy: () => void;
};

export function createNetworkFindModal(cb: FindModalCallbacks): FindModalHandle {
  // Persisted (in-memory) query state, so reopening the modal keeps the user's last search.
  const activeChips = new Set<ChipKey>(['url', 'request', 'response', 'headers']);
  let query = '';
  let caseSensitive = false;
  let regex = false;

  // Live result state.
  let navOrder: string[] = [];
  let navIndex = -1;
  let totalHits = 0;
  let regexError = false;
  let searchToken = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let overlay: HTMLElement | null = null;

  const scopesFromChips = (): NetworkFindScope[] => {
    const out: NetworkFindScope[] = [];
    for (const key of activeChips) out.push(...CHIP_SCOPES[key]);
    return out;
  };

  const q = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
    overlay ? (overlay.querySelector(sel) as T | null) : null;

  function updateCount(): void {
    const countEl = q('[data-find-count]');
    if (!countEl) return;
    if (!query) {
      countEl.textContent = '';
      countEl.classList.remove('is-empty');
      return;
    }
    if (regexError) {
      countEl.textContent = 'Invalid pattern';
      countEl.classList.add('is-empty');
      return;
    }
    if (navOrder.length === 0) {
      countEl.textContent = 'No matches';
      countEl.classList.add('is-empty');
      return;
    }
    countEl.classList.remove('is-empty');
    // Just the totals — navigation (and any position indicator) lives on the header ↑/↓, not here.
    const hits = totalHits > 0 ? ` · ${totalHits} hit${totalHits === 1 ? '' : 's'}` : '';
    countEl.textContent = `${navOrder.length} request${navOrder.length === 1 ? '' : 's'}${hits}`;
  }

  function navigate(delta: number): void {
    if (navOrder.length === 0) return;
    if (navIndex < 0) navIndex = delta > 0 ? -1 : navOrder.length;
    navIndex = (navIndex + delta + navOrder.length) % navOrder.length;
    cb.onNavigate(navOrder[navIndex]!, query);
    updateCount();
  }

  function applyResults(matches: NetworkFindMatch[], jumpToFirst: boolean): void {
    const totals = new Map(matches.map((m) => [m.id, m.total] as const));
    navOrder = cb.onResults(matches);
    totalHits = navOrder.reduce((sum, id) => sum + (totals.get(id) ?? 0), 0);
    if (navOrder.length === 0) {
      navIndex = -1;
    } else if (jumpToFirst) {
      navIndex = 0;
      cb.onNavigate(navOrder[0]!, query);
    } else {
      // Preserve the focused request across a refresh when it's still in the set.
      const prevId = navIndex >= 0 ? navOrder[navIndex] : undefined;
      navIndex = prevId ? navOrder.indexOf(prevId) : -1;
      if (navIndex < 0) navIndex = 0;
    }
    updateCount();
  }

  async function runSearch(jumpToFirst: boolean): Promise<void> {
    regexError = false;
    if (!query) {
      navOrder = [];
      navIndex = -1;
      totalHits = 0;
      cb.onClear();
      updateCount();
      return;
    }
    if (regex) {
      try {
        // Validate up front so we can show "Invalid pattern" rather than silently returning nothing.
        void new RegExp(query);
      } catch {
        regexError = true;
        navOrder = [];
        navIndex = -1;
        cb.onClear();
        updateCount();
        return;
      }
    }
    const token = ++searchToken;
    const options: NetworkFindOptions = { query, scopes: scopesFromChips(), caseSensitive, regex };
    let matches: NetworkFindMatch[] = [];
    try {
      matches = await cb.search(options);
    } catch {
      matches = [];
    }
    if (token !== searchToken) return; // superseded by a newer keystroke
    applyResults(matches, jumpToFirst);
  }

  function scheduleSearch(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      // Live-update the match bars + count while typing WITHOUT scrolling the list (no auto-jump);
      // Enter is what commits + jumps to the first result.
      void runSearch(false);
    }, 220);
  }

  function buildOverlay(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'modal-overlay ni-find-overlay active';
    const chips = CHIP_LABELS.map(
      (c) =>
        `<button type="button" class="ni-find-chip${activeChips.has(c.key) ? ' is-on' : ''}" data-find-chip="${c.key}" title="${c.title}" aria-pressed="${activeChips.has(c.key)}">${c.label}</button>`
    ).join('');
    el.innerHTML = `
      <div class="ni-find-modal" role="dialog" aria-modal="true" aria-label="Find in Network traffic">
        <div class="ni-find-header">
          <h3 class="ni-find-title">Find in Traffic</h3>
          <button type="button" class="ni-find-close" title="Close (Esc)" aria-label="Close">×</button>
        </div>
        <div class="ni-find-body">
          <div class="ni-find-field">
            <span class="ni-find-field-icon icon icon-sm" aria-hidden="true"><svg><use href="#icon-zoom"/></svg></span>
            <input type="text" class="ni-find-input" data-find-input placeholder="Find text in URL, payloads, headers…" spellcheck="false" autocomplete="off" aria-label="Find text" value="${escapeHtml(query)}" />
            <span class="ni-find-count" data-find-count aria-live="polite"></span>
            <button type="button" class="ni-find-nav" data-find-nav-prev title="Previous Match (Shift+Enter)" aria-label="Previous Match"><span class="icon icon-xs"><svg><use href="#icon-chevron-up"/></svg></span></button>
            <button type="button" class="ni-find-nav" data-find-nav-next title="Next Match (Enter)" aria-label="Next Match"><span class="icon icon-xs"><svg><use href="#icon-chevron-down"/></svg></span></button>
            <button type="button" class="ni-find-nav" data-find-nav-close title="Close (Esc)" aria-label="Close"><span class="icon icon-xs"><svg><use href="#icon-x"/></svg></span></button>
          </div>
          <div class="ni-find-row">
            <span class="ni-find-row-label">Search in</span>
            <div class="ni-find-chips">${chips}</div>
          </div>
          <div class="ni-find-row">
            <span class="ni-find-row-label">Options</span>
            <div class="ni-find-opts">
              <button type="button" class="ni-find-opt${caseSensitive ? ' is-on' : ''}" data-find-opt="case" title="Match case" aria-pressed="${caseSensitive}">Aa</button>
              <button type="button" class="ni-find-opt${regex ? ' is-on' : ''}" data-find-opt="regex" title="Use regular expression" aria-pressed="${regex}">.*</button>
            </div>
          </div>
          <ul class="ni-find-note">
            <li>Binary (base64) bodies aren't searched.</li>
            <li>Press <kbd>Enter</kbd> to jump to the first match and close.</li>
            <li><kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> (or the header arrows) move between matches.</li>
          </ul>
        </div>
      </div>`;
    return el;
  }

  function wire(el: HTMLElement): void {
    const input = el.querySelector('[data-find-input]') as HTMLInputElement | null;

    el.querySelector('.ni-find-close')?.addEventListener('click', close);
    el.querySelector('[data-find-nav-prev]')?.addEventListener('click', () => navigate(-1));
    el.querySelector('[data-find-nav-next]')?.addEventListener('click', () => navigate(1));
    el.querySelector('[data-find-nav-close]')?.addEventListener('click', close);
    // Backdrop click (outside the dialog) closes.
    el.addEventListener('mousedown', (e) => {
      if (e.target === el) close();
    });

    input?.addEventListener('input', () => {
      query = input.value;
      scheduleSearch();
    });
    input?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        query = input.value;
        // Enter commits the search: run it, jump to the first match, and close so the user lands on
        // the result. From there the header ↑/↓ walk the matches. (No match → stay open to show it.)
        await runSearch(true);
        if (navOrder.length > 0) close();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });

    el.querySelectorAll('[data-find-chip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.findChip as ChipKey;
        if (activeChips.has(key)) {
          // Never let the user disable the last scope — search would match nothing.
          if (activeChips.size === 1) return;
          activeChips.delete(key);
        } else {
          activeChips.add(key);
        }
        btn.classList.toggle('is-on', activeChips.has(key));
        btn.setAttribute('aria-pressed', String(activeChips.has(key)));
        void runSearch(false);
      });
    });

    el.querySelectorAll('[data-find-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const opt = (btn as HTMLElement).dataset.findOpt;
        if (opt === 'case') caseSensitive = !caseSensitive;
        else if (opt === 'regex') regex = !regex;
        const on = opt === 'case' ? caseSensitive : regex;
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', String(on));
        void runSearch(false);
      });
    });
  }

  function open(): void {
    if (overlay) {
      (overlay.querySelector('[data-find-input]') as HTMLInputElement | null)?.focus();
      return;
    }
    overlay = buildOverlay();
    document.body.appendChild(overlay);
    wire(overlay);
    cb.onOpen?.();
    updateCount();
    const input = overlay.querySelector('[data-find-input]') as HTMLInputElement | null;
    input?.focus();
    input?.select();
    if (query) void runSearch(navIndex < 0);
  }

  function close(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    const wasOpen = !!overlay;
    overlay?.remove();
    overlay = null;
    // Matches + the last selection stay put so the user keeps their place; reopening restores state.
    // Notify the host on close so it can NOW play the match-bar animation (list is back in view).
    if (wasOpen) cb.onClose?.();
  }

  return {
    open,
    close,
    isOpen: () => !!overlay,
    isActive: () => !!query,
    next: () => navigate(1),
    prev: () => navigate(-1),
    refresh() {
      if (!query) return;
      void runSearch(false);
    },
    clear() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      searchToken++; // drop any in-flight search
      query = '';
      navOrder = [];
      navIndex = -1;
      totalHits = 0;
      regexError = false;
      const input = q<HTMLInputElement>('[data-find-input]');
      if (input) input.value = '';
      cb.onClear();
      updateCount();
    },
    destroy() {
      close();
      searchToken++;
    }
  };
}

/**
 * Network Inspector — "Find in content" modal (multi-term).
 *
 * A surface-agnostic control panel for searching the *full* content of captured transactions
 * (request URL, request/response headers, request/response bodies) — as opposed to the toolbar
 * Filter, which only narrows the list by summary fields.
 *
 * Multi-term: the user can search for up to {@link MAX_TERMS} independent, color-coded terms at once
 * (press "+ Add term"). Each term carries its OWN scope/case/regex options and an auto-assigned color
 * the user can change. A request that matches N terms shows N color segments on its list-row bar. The
 * terms are OR'd — a row matches if ANY term matches.
 *
 * The modal owns the terms + their options; the *results* live in the host's own session list
 * ("keep all + badge & jump"):
 *   - The host badges matching rows (one color segment per matched term) and reports back which matched
 *     rows are currently visible, in list order — that ordered set is what Prev/Next walks.
 *   - Prev/Next (and Enter / Shift+Enter) walk that visible set, asking the host to select + scroll to
 *     each one and seed the detail-pane find bar (with the first matching term's text) so the hit
 *     highlights in the body too.
 *
 * Both the live Network tab and the offline Session Viewer drive this via {@link FindModalCallbacks} —
 * the only difference is how `search` sources content (IPC over the disk store vs. in-memory).
 */
import type {
  NetworkFindMatch,
  NetworkFindRequest,
  NetworkFindScope
} from '@shared/network-inspector/content-search';
import { isLikelyRedos, MAX_REGEX_PATTERN_LENGTH } from '@shared/platform/text-match.js';

/** The four user-facing scope chips, mapped to the engine's granular scopes. */
type ChipKey = 'url' | 'request' | 'response' | 'headers';

const CHIP_ORDER: ChipKey[] = ['url', 'request', 'response', 'headers'];

/**
 * Heuristic: does this query look like a *deliberate* regular expression? Only STRONG signals that are
 * meaningless (or very rare) in a literal search count — a bare `.`, `?`, or `*` (common in URLs/paths)
 * does NOT trigger, so we never nudge on an ordinary text search. Used to suggest (not force) regex mode.
 */
function looksLikeRegex(query: string): boolean {
  const s = query.trim();
  if (!s) return false;
  if (/\\[a-zA-Z0-9.\/(){}[\]^$|+*?-]/.test(s)) return true; // an escape like \s \d \. \w \\
  if (/\[[^\]]+\]/.test(s)) return true; // a character class [...]
  if (/\([^)]*\|[^)]*\)/.test(s)) return true; // an alternation group (a|b)
  if (/\{\d+(?:,\d*)?\}/.test(s)) return true; // a quantifier {n} {n,} {n,m}
  if (/\.[*+]/.test(s)) return true; // .* or .+
  return s.startsWith('^') || s.endsWith('$'); // an anchor
}

const CHIP_LABELS: Record<ChipKey, { label: string; short: string; title: string }> = {
  url: { label: 'URL', short: 'URL', title: 'Request URL, hostname and SNI' },
  request: { label: 'Request Body', short: 'Req', title: 'Request payload' },
  response: { label: 'Response Body', short: 'Resp', title: 'Response payload' },
  headers: { label: 'Headers', short: 'Hdr', title: 'Request and response headers' }
};

const CHIP_SCOPES: Record<ChipKey, NetworkFindScope[]> = {
  url: ['url'],
  request: ['reqBody'],
  response: ['respBody'],
  headers: ['reqHeaders', 'respHeaders']
};

/** Max concurrent colored terms. Matches the palette length and the main-process sanitizer cap. */
export const MAX_TERMS = 5;

/** Auto-assign palette — amber → magenta → green → white → orange. Neighbors contrast, and the two
 *  warm tones (amber #f59e0b index 0, orange #f58231 index 4) sit at opposite ends so they're never
 *  side by side. Index 0 stays amber so a single-term search looks like the classic Find. */
const PALETTE = ['#f59e0b', '#ce1e9e', '#3cb44b', '#ffffff', '#f58231'];

// ---- color math for the inline HSV picker (pure) ---------------------------------------------
const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** HSV (h 0–360, s/v 0–1) → 8-bit RGB. */
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

const toHex2 = (n: number): string => n.toString(16).padStart(2, '0');
const rgbToHex = (r: number, g: number, b: number): string => `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;

/** Parse `#rrggbb` (or `#rgb`) → RGB, or null when malformed. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

type Term = {
  id: string;
  query: string;
  color: string;
  scopes: Set<ChipKey>;
  caseSensitive: boolean;
  regex: boolean;
  regexError: boolean;
};

export type FindModalCallbacks = {
  /** Run the multi-term search and return per-event match sets (each carries a per-term breakdown). */
  search: (request: NetworkFindRequest) => Promise<NetworkFindMatch[]>;
  /**
   * Hand the host the fresh match set plus the term→{color,query} map (in term order) so it can badge
   * rows with one color segment per matched term AND seed the selected row's body highlight with a
   * matching term's text. The host returns the eventIds that are both matched AND currently visible,
   * in list order — that ordered set is what Prev/Next walks.
   */
  onResults: (
    matches: NetworkFindMatch[],
    termInfo: Map<string, { color: string; query: string }>
  ) => string[];
  /** Select + scroll to a matched event and seed its detail find bar with `query` (a matching term). */
  onNavigate: (eventId: string, query: string) => void;
  /** The host's currently-selected event id (if any). Prev/Next anchor to it so they step to the
   *  match nearest the selected result rather than restarting from the first match. */
  getCurrentId?: () => string | null;
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
  /** Whether a search is currently active (results may be showing even with the modal closed). */
  isActive: () => boolean;
  /** Advance to the next / Previous Match (used by the header ↑/↓ buttons — works while closed). */
  next: () => void;
  prev: () => void;
  /** Re-run the active search against the current list (new events arrived / filter changed). */
  refresh: () => void;
  /** The non-regex terms as `{text,color}` — for the URL/header seed tint (substring-only). */
  getSeedKeywords: () => { text: string; color: string }[];
  /** ALL valid terms (regex + substring) for seeding the detail-pane find bars as chips. Regex terms
   *  carry `regex:true` + their case flag so the pane compiles + counts them; the pane can't author
   *  regex, but a modal regex term shows as a chip, counts, navigates, and highlights. */
  getSeedTerms: () => { text: string; color: string; regex: boolean; caseSensitive: boolean }[];
  /** Clear all terms' results (keeps the terms + their options/colors) — e.g. the header "clear". */
  clear: () => void;
  destroy: () => void;
};

export function createNetworkFindModal(cb: FindModalCallbacks): FindModalHandle {
  let termSeq = 0;
  const makeTerm = (): Term => {
    const idx = termSeq++;
    return {
      id: `term-${idx}`,
      query: '',
      color: PALETTE[idx % PALETTE.length]!,
      scopes: new Set<ChipKey>(CHIP_ORDER),
      caseSensitive: false,
      regex: false,
      regexError: false
    };
  };

  // Persisted (in-memory) term state, so reopening the modal keeps the user's last search.
  const terms: Term[] = [makeTerm()];

  // Live result state.
  let matchById = new Map<string, NetworkFindMatch>();
  let navOrder: string[] = [];
  let navIndex = -1;
  let totalHits = 0;
  let searchToken = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let overlay: HTMLElement | null = null;
  let openPopover: HTMLElement | null = null;
  // The color popover is portaled to <body> (position:fixed) so it can grow past the modal's clipped
  // bounds when the inline picker expands; this doc-level handler closes it on an outside click.
  let popoverDocHandler: ((e: MouseEvent) => void) | null = null;

  const q = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
    overlay ? (overlay.querySelector(sel) as T | null) : null;

  const scopeList = (term: Term): NetworkFindScope[] => {
    const out: NetworkFindScope[] = [];
    for (const key of CHIP_ORDER) if (term.scopes.has(key)) out.push(...CHIP_SCOPES[key]);
    return out;
  };

  /** Terms with a usable (non-empty, valid-if-regex) query — the ones actually searched. */
  const activeTerms = (): Term[] => terms.filter((t) => t.query.trim() && !t.regexError);

  const isActive = (): boolean => activeTerms().length > 0;

  /** The {color,query} map handed to the host, in term order, for every term that currently searches. */
  const termInfoMap = (): Map<string, { color: string; query: string }> => {
    const map = new Map<string, { color: string; query: string }>();
    for (const t of terms) {
      if (t.query.trim() && !t.regexError) map.set(t.id, { color: t.color, query: t.query });
    }
    return map;
  };

  // ---- results / navigation ------------------------------------------------------------------

  function updateFooterCount(): void {
    const countEl = q('[data-find-count]');
    if (!countEl) return;
    if (!isActive()) {
      countEl.textContent = '';
      countEl.classList.remove('is-empty');
      return;
    }
    if (navOrder.length === 0) {
      countEl.textContent = 'No matches';
      countEl.classList.add('is-empty');
      return;
    }
    countEl.classList.remove('is-empty');
    const hits = totalHits > 0 ? ` · ${totalHits} hit${totalHits === 1 ? '' : 's'}` : '';
    countEl.textContent = `${navOrder.length} request${navOrder.length === 1 ? '' : 's'}${hits}`;
  }

  /** Update each term row's per-term hit count over the currently VISIBLE matches. */
  function updateTermCounts(): void {
    for (const term of terms) {
      const el = q(`[data-term-hits="${term.id}"]`);
      if (!el) continue;
      // Sum over the FULL result set, not `navOrder` (which is only the DOM-visible matched rows — in
      // Group-by-Host view collapsed/virtualized groups drop out, so a term whose matches sit in those
      // groups would wrongly read 0). The per-term count is a total, independent of what's on screen.
      let hits = 0;
      for (const m of matchById.values()) hits += m.terms?.[term.id]?.total ?? 0;
      if (!term.query.trim()) el.textContent = '';
      else if (term.regexError) el.textContent = '!';
      else el.textContent = hits > 0 ? String(hits) : '0';
      el.classList.toggle('is-zero', !!term.query.trim() && !term.regexError && hits === 0);
      el.classList.toggle('is-error', term.regexError);
    }
  }

  /** The first term (in term order) that matched the given event — used to seed the body find bar. */
  function seedQueryFor(eventId: string): string {
    const match = matchById.get(eventId);
    if (match?.terms) {
      for (const term of terms) {
        if (match.terms[term.id]) return term.query;
      }
    }
    return activeTerms()[0]?.query ?? '';
  }

  function navigate(delta: number): void {
    if (navOrder.length === 0) return;
    // Anchor to the row the user actually has selected, so Shift+↑/↓ steps to the match nearest the
    // selected result — not from a stale internal cursor (which restarted at the first match).
    const currentId = cb.getCurrentId?.();
    const curPos = currentId ? navOrder.indexOf(currentId) : -1;
    if (curPos >= 0) navIndex = curPos;
    else if (navIndex < 0) navIndex = delta > 0 ? -1 : navOrder.length;
    navIndex = (navIndex + delta + navOrder.length) % navOrder.length;
    const id = navOrder[navIndex]!;
    cb.onNavigate(id, seedQueryFor(id));
    updateFooterCount();
  }

  function applyResults(matches: NetworkFindMatch[], jumpToFirst: boolean): void {
    matchById = new Map(matches.map((m) => [m.id, m] as const));
    navOrder = cb.onResults(matches, termInfoMap());
    totalHits = navOrder.reduce((sum, id) => sum + (matchById.get(id)?.total ?? 0), 0);
    if (navOrder.length === 0) {
      navIndex = -1;
    } else if (jumpToFirst) {
      navIndex = 0;
      const id = navOrder[0]!;
      cb.onNavigate(id, seedQueryFor(id));
    } else {
      // Preserve the focused request across a refresh when it's still in the set.
      const prevId = navIndex >= 0 ? navOrder[navIndex] : undefined;
      navIndex = prevId ? navOrder.indexOf(prevId) : -1;
      if (navIndex < 0) navIndex = 0;
    }
    updateFooterCount();
    updateTermCounts();
  }

  function validateRegex(): void {
    for (const term of terms) {
      if (term.regex && term.query.trim()) {
        let compiles = true;
        try {
          void new RegExp(term.query);
        } catch {
          compiles = false;
        }
        // Mirror the engine's guard (compileGlobalSearchRegex): a ReDoS-suspect or over-long pattern
        // won't run as a real regex — it degrades to a LITERAL search, which quietly returns 0. Flag it
        // as an error (shows "!") instead of a confusing "found nothing" so the user knows to simplify.
        term.regexError =
          !compiles ||
          term.query.length > MAX_REGEX_PATTERN_LENGTH ||
          isLikelyRedos(term.query);
      } else {
        term.regexError = false;
      }
    }
  }

  function buildRequest(): NetworkFindRequest {
    return {
      terms: activeTerms().map((t) => ({
        id: t.id,
        query: t.query,
        scopes: scopeList(t),
        caseSensitive: t.caseSensitive,
        regex: t.regex
      }))
    };
  }

  async function runSearch(jumpToFirst: boolean): Promise<void> {
    validateRegex();
    if (!isActive()) {
      matchById = new Map();
      navOrder = [];
      navIndex = -1;
      totalHits = 0;
      cb.onClear();
      updateFooterCount();
      updateTermCounts();
      return;
    }
    const token = ++searchToken;
    let matches: NetworkFindMatch[] = [];
    try {
      matches = await cb.search(buildRequest());
    } catch {
      matches = [];
    }
    if (token !== searchToken) return; // superseded by a newer keystroke
    applyResults(matches, jumpToFirst);
  }

  /** Re-push results with the current term→color map WITHOUT re-searching. A color change never
   *  changes which rows match — only their badge color — so this re-badges cheaply (no IPC / disk),
   *  which matters while dragging the picker (fires per pointer-move). */
  function repaintColors(): void {
    if (!isActive()) return;
    applyResults([...matchById.values()], false);
  }

  function scheduleSearch(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      // Live-update the bars + counts while typing WITHOUT scrolling the list (no auto-jump);
      // Enter is what commits + jumps to the first result.
      void runSearch(false);
    }, 220);
  }

  // ---- DOM: term rows ------------------------------------------------------------------------

  function closePopover(): void {
    openPopover?.remove();
    openPopover = null;
    if (popoverDocHandler) {
      document.removeEventListener('mousedown', popoverDocHandler, true);
      popoverDocHandler = null;
    }
  }

  /** Trash glyph, inlined (not a sprite ref) so it renders in BOTH the live tab and the Session Viewer
   *  documents — this modal is appended to whichever page opened it. */
  const TRASH_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

  function buildColorPopover(term: Term, anchor: HTMLElement): HTMLElement {
    const pop = document.createElement('div');
    pop.className = 'ni-find-pop ni-find-color-pop';
    pop.innerHTML = `
      <div class="ni-find-color-swatches">
        ${PALETTE.map(
          (c) =>
            `<button type="button" class="ni-find-color-swatch${c === term.color ? ' is-on' : ''}" data-color="${c}" style="background:${c}" title="${c}" aria-label="Set color ${c}"></button>`
        ).join('')}
        <button type="button" class="ni-find-color-custom" data-open-picker title="Custom color…" aria-label="Custom color"></button>
      </div>
      <div class="ni-find-picker" data-picker hidden>
        <div class="ni-find-picker-sv" data-picker-sv><span class="ni-find-picker-thumb" data-sv-thumb></span></div>
        <div class="ni-find-picker-hue" data-picker-hue><span class="ni-find-picker-hue-thumb" data-hue-thumb></span></div>
        <div class="ni-find-picker-foot">
          <span class="ni-find-picker-preview" data-picker-preview></span>
          <input type="text" class="ni-find-picker-hex" data-picker-hex maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex color" />
        </div>
      </div>`;

    const setColor = (hex: string): void => {
      term.color = hex;
      anchor.style.background = hex;
      repaintColors(); // recolor badges without re-searching (match set is unchanged)
    };

    // Presets: pick + close. Colors stay unique across terms — if another term already owns the
    // picked color, SWAP (that term inherits this term's old color) rather than duplicating it.
    pop.querySelectorAll<HTMLElement>('[data-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hex = btn.dataset.color!;
        const other = terms.find((t) => t !== term && t.color === hex);
        if (other) {
          const old = term.color;
          other.color = old;
          const otherSwatch = q(`[data-term-id="${other.id}"] [data-term-color]`);
          if (otherSwatch) otherSwatch.style.background = old;
        }
        setColor(hex);
        closePopover();
      });
    });

    // Inline HSV picker (expands within this same popover — no OS-native picker window).
    const svEl = pop.querySelector<HTMLElement>('[data-picker-sv]')!;
    const svThumb = pop.querySelector<HTMLElement>('[data-sv-thumb]')!;
    const hueEl = pop.querySelector<HTMLElement>('[data-picker-hue]')!;
    const hueThumb = pop.querySelector<HTMLElement>('[data-hue-thumb]')!;
    const hexEl = pop.querySelector<HTMLInputElement>('[data-picker-hex]')!;
    const preview = pop.querySelector<HTMLElement>('[data-picker-preview]')!;
    const seed = hexToRgb(term.color) ?? { r: 255, g: 255, b: 255 };
    const hsv = rgbToHsv(seed.r, seed.g, seed.b);

    const paint = (fromHexInput: boolean): void => {
      const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
      const hex = rgbToHex(r, g, b);
      svEl.style.background = `linear-gradient(to bottom, rgba(0,0,0,0), #000), linear-gradient(to right, #fff, rgba(255,255,255,0)), hsl(${hsv.h.toFixed(0)}, 100%, 50%)`;
      svThumb.style.left = `${hsv.s * 100}%`;
      svThumb.style.top = `${(1 - hsv.v) * 100}%`;
      svThumb.style.background = hex;
      hueThumb.style.left = `${(hsv.h / 360) * 100}%`;
      preview.style.background = hex;
      if (!fromHexInput) hexEl.value = hex;
      setColor(hex);
    };

    const dragFrom = (el: HTMLElement, onMove: (e: PointerEvent) => void) => (e: PointerEvent) => {
      e.preventDefault();
      onMove(e);
      const move = (ev: PointerEvent): void => onMove(ev);
      const up = (): void => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    };

    svEl.addEventListener(
      'pointerdown',
      dragFrom(svEl, (e) => {
        const r = svEl.getBoundingClientRect();
        hsv.s = clamp01((e.clientX - r.left) / r.width);
        hsv.v = clamp01(1 - (e.clientY - r.top) / r.height);
        paint(false);
      })
    );
    hueEl.addEventListener(
      'pointerdown',
      dragFrom(hueEl, (e) => {
        const r = hueEl.getBoundingClientRect();
        hsv.h = clamp01((e.clientX - r.left) / r.width) * 360;
        paint(false);
      })
    );
    hexEl.addEventListener('input', () => {
      const rgb = hexToRgb(hexEl.value);
      if (!rgb) return;
      const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
      hsv.h = next.h;
      hsv.s = next.s;
      hsv.v = next.v;
      paint(true);
    });

    // Toggle the picker open/closed inside the popover ("expand the existing panel").
    pop.querySelector<HTMLElement>('[data-open-picker]')?.addEventListener('click', () => {
      const picker = pop.querySelector<HTMLElement>('[data-picker]')!;
      picker.hidden = !picker.hidden;
      if (!picker.hidden) {
        const cur = hexToRgb(term.color) ?? { r: 255, g: 255, b: 255 };
        const c = rgbToHsv(cur.r, cur.g, cur.b);
        hsv.h = c.h;
        hsv.s = c.s;
        hsv.v = c.v;
        hexEl.value = term.color;
        paint(true);
      }
    });

    return pop;
  }

  function toggleColorPopover(term: Term, anchor: HTMLElement): void {
    const already = openPopover?.dataset.for === `color:${term.id}`;
    closePopover();
    if (already) return;
    const pop = buildColorPopover(term, anchor);
    pop.dataset.for = `color:${term.id}`;
    // Portal to <body> so the expandable picker isn't clipped by the modal's `overflow:hidden`.
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.top = `${r.bottom + 6}px`;
    pop.style.left = `${Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)}px`;
    openPopover = pop;
    popoverDocHandler = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (pop.contains(t) || t === anchor || anchor.contains(t)) return;
      // A click outside dismisses the popover only — swallow it (capture phase) so the modal's
      // backdrop handler doesn't ALSO fire and close the whole modal in the same click.
      e.stopPropagation();
      closePopover();
    };
    document.addEventListener('mousedown', popoverDocHandler, true);
  }

  function buildTermRow(term: Term): HTMLElement {
    const row = document.createElement('div');
    row.className = 'ni-find-term';
    row.dataset.termId = term.id;
    const chips = CHIP_ORDER.map(
      (key) =>
        `<button type="button" class="ni-find-chip${term.scopes.has(key) ? ' is-on' : ''}" data-term-scope="${key}" title="${CHIP_LABELS[key].title}" aria-pressed="${term.scopes.has(key)}">${CHIP_LABELS[key].label}</button>`
    ).join('');
    row.innerHTML = `
      <div class="ni-find-term-top">
        <span class="ni-find-swatch-cell">
          <button type="button" class="ni-find-swatch" data-term-color style="background:${term.color}" title="Change color" aria-label="Change term color"></button>
        </span>
        <div class="ni-find-box">
          <input type="text" class="ni-find-input" data-term-input placeholder="Find" spellcheck="false" autocomplete="off" aria-label="Search term" />
          <button type="button" class="ni-find-inline-btn ni-find-clear-input" data-term-clear title="Clear text" aria-label="Clear text">×</button>
          <button type="button" class="ni-find-inline-btn ni-find-opt${term.caseSensitive ? ' is-on' : ''}" data-term-opt="case" title="Match case" aria-pressed="${term.caseSensitive}">Aa</button>
          <button type="button" class="ni-find-inline-btn ni-find-opt${term.regex ? ' is-on' : ''}" data-term-opt="regex" title="Use regular expression" aria-pressed="${term.regex}">.*</button>
        </div>
        <button type="button" class="ni-find-term-delete" data-term-delete title="Delete search entry" aria-label="Delete search entry">${TRASH_SVG}</button>
        <span class="ni-find-term-hits" data-term-hits="${term.id}" aria-live="polite"></span>
      </div>
      <div class="ni-find-scope-row">${chips}</div>
      <div class="ni-find-rx-hint" data-rx-hint hidden>
        <span class="ni-find-rx-icon">.*</span>
        <span>This looks like a regular expression.</span>
        <button type="button" class="ni-find-rx-enable" data-rx-enable>Use Regex</button>
      </div>`;

    const input = row.querySelector<HTMLInputElement>('[data-term-input]');
    // Set the value as a DOM property, NOT an HTML attribute — queries routinely contain double-quotes
    // (`"type":"..."`), and `escapeHtml` (textContent→innerHTML) doesn't escape `"`, so a `value="..."`
    // attribute would truncate at the first quote and the term would reopen blank.
    if (input) input.value = term.query;

    // Nudge (don't force) regex mode when the text has strong regex signals and regex is still off:
    // pulse the `.*` button and reveal a one-click "Use regex" hint. Re-evaluated on every edit.
    const syncRxHint = (): void => {
      const suggest = !term.regex && looksLikeRegex(term.query);
      const hint = row.querySelector<HTMLElement>('[data-rx-hint]');
      const rxBtn = row.querySelector<HTMLElement>('[data-term-opt="regex"]');
      if (hint) hint.hidden = !suggest;
      rxBtn?.classList.toggle('is-suggested', suggest);
    };

    input?.addEventListener('input', () => {
      term.query = input.value;
      syncRxHint();
      scheduleSearch();
    });
    input?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        term.query = input.value;
        if (e.shiftKey) {
          // Shift+Enter commits this term and opens another (up to MAX_TERMS) instead of closing.
          // addTerm() is a no-op at the cap, so the shortcut just keeps focus here when full.
          void runSearch(false);
          addTerm();
          return;
        }
        await runSearch(true);
        if (navOrder.length > 0) close();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (openPopover) closePopover();
        else close();
      }
    });

    const swatch = row.querySelector<HTMLElement>('[data-term-color]');
    // stop mousedown from reaching the overlay's outside-click handler, which would close the popover
    // a frame before this button's click re-toggles it (making the button feel like it never closes).
    swatch?.addEventListener('mousedown', (e) => e.stopPropagation());
    swatch?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleColorPopover(term, swatch);
    });

    // The inline × clears just this term's text; the trash button deletes the whole search entry.
    row.querySelector('[data-term-clear]')?.addEventListener('click', () => clearTermText(term));
    row.querySelector('[data-term-delete]')?.addEventListener('click', () => deleteTerm(term));

    row.querySelectorAll<HTMLElement>('[data-term-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const opt = btn.dataset.termOpt;
        if (opt === 'case') term.caseSensitive = !term.caseSensitive;
        else if (opt === 'regex') term.regex = !term.regex;
        const on = opt === 'case' ? term.caseSensitive : term.regex;
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', String(on));
        syncRxHint();
        void runSearch(false);
      });
    });

    // "Use regex" nudge → enable regex for this term (matching a manual `.*` toggle).
    row.querySelector('[data-rx-enable]')?.addEventListener('click', () => {
      term.regex = true;
      const rxBtn = row.querySelector<HTMLElement>('[data-term-opt="regex"]');
      rxBtn?.classList.add('is-on');
      rxBtn?.setAttribute('aria-pressed', 'true');
      syncRxHint();
      input?.focus();
      void runSearch(false);
    });

    syncRxHint(); // reflect a regex-like query that's already present on (re)render

    // Scope chips: on/off toggles under the box. Never let the last scope turn off (matches nothing).
    row.querySelectorAll<HTMLElement>('[data-term-scope]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.termScope as ChipKey;
        if (term.scopes.has(key)) {
          if (term.scopes.size === 1) return;
          term.scopes.delete(key);
        } else {
          term.scopes.add(key);
        }
        btn.classList.toggle('is-on', term.scopes.has(key));
        btn.setAttribute('aria-pressed', String(term.scopes.has(key)));
        void runSearch(false);
      });
    });

    return row;
  }

  function syncAddButton(): void {
    const addBtn = q<HTMLButtonElement>('[data-find-add]');
    if (addBtn) addBtn.disabled = terms.length >= MAX_TERMS;
  }

  function addTerm(): void {
    if (terms.length >= MAX_TERMS) return;
    const term = makeTerm();
    terms.push(term);
    const listEl = q('[data-find-terms]');
    if (listEl) {
      const row = buildTermRow(term);
      listEl.appendChild(row);
      row.querySelector<HTMLInputElement>('[data-term-input]')?.focus();
    }
    syncAddButton();
  }

  /** Inline × handler: empty this term's text (keeps the entry so the user can keep typing). */
  function clearTermText(term: Term): void {
    term.query = '';
    const input = q<HTMLInputElement>(`[data-term-id="${term.id}"] [data-term-input]`);
    if (input) {
      input.value = '';
      input.focus();
    }
    void runSearch(false);
  }

  /** Trash handler: delete the whole search entry. The last remaining entry can't be removed (a search
   *  needs at least one) — it's emptied instead. */
  function deleteTerm(term: Term): void {
    if (terms.length <= 1) {
      clearTermText(term);
      return;
    }
    const idx = terms.indexOf(term);
    if (idx < 0) return;
    terms.splice(idx, 1);
    q(`[data-find-terms] [data-term-id="${term.id}"]`)?.remove();
    closePopover();
    syncAddButton();
    void runSearch(false);
  }

  // ---- DOM: overlay --------------------------------------------------------------------------

  function buildOverlay(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'modal-overlay ni-find-overlay active';
    el.innerHTML = `
      <div class="ni-find-modal" role="dialog" aria-modal="true" aria-label="Find in Network traffic">
        <div class="ni-find-header">
          <h3 class="ni-find-title">Find in Traffic</h3>
          <button type="button" class="ni-find-close" title="Close (Esc)" aria-label="Close">×</button>
        </div>
        <div class="ni-find-body">
          <div class="ni-find-terms" data-find-terms></div>
          <button type="button" class="ni-find-add" data-find-add title="Add another search entry">+ Search More…</button>
          <ul class="ni-find-note">
            <li>Each term gets a color; a request shows every matching term's color.</li>
            <li>Whitespace is ignored — minified and pretty-printed bodies both match.</li>
            <li>Binary (base64) bodies aren't searched.</li>
            <li>Press <kbd>Enter</kbd> to jump to the first match and close.</li>
            <li><kbd>Shift</kbd>+<kbd>Enter</kbd> adds another term (up to ${MAX_TERMS}).</li>
            <li><kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> (or the header arrows) move between matches.</li>
          </ul>
        </div>
      </div>`;
    const listEl = el.querySelector('[data-find-terms]')!;
    for (const term of terms) listEl.appendChild(buildTermRow(term));
    return el;
  }

  function wire(el: HTMLElement): void {
    el.querySelector('.ni-find-close')?.addEventListener('click', close);
    el.querySelector('[data-find-add]')?.addEventListener('click', addTerm);
    // Backdrop click (outside the dialog) closes. The color popover is portaled to <body> and closes
    // itself via its own document-level handler, so it isn't handled here.
    el.addEventListener('mousedown', (e) => {
      if (e.target === el) close();
    });
  }

  function open(): void {
    if (overlay) {
      (overlay.querySelector('[data-term-input]') as HTMLInputElement | null)?.focus();
      return;
    }
    overlay = buildOverlay();
    document.body.appendChild(overlay);
    wire(overlay);
    syncAddButton();
    cb.onOpen?.();
    updateFooterCount();
    updateTermCounts();
    const input = overlay.querySelector('[data-term-input]') as HTMLInputElement | null;
    input?.focus();
    input?.select();
    if (isActive()) void runSearch(navIndex < 0);
  }

  function close(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    closePopover();
    const wasOpen = !!overlay;
    overlay?.remove();
    overlay = null;
    // Matches + the last selection stay put so the user keeps their place; reopening restores state.
    if (wasOpen) cb.onClose?.();
  }

  return {
    open,
    close,
    isOpen: () => !!overlay,
    isActive,
    next: () => navigate(1),
    prev: () => navigate(-1),
    refresh() {
      if (!isActive()) return;
      void runSearch(false);
    },
    getSeedKeywords: () =>
      terms
        .filter((t) => t.query.trim() && !t.regex)
        .map((t) => ({ text: t.query, color: t.color })),
    getSeedTerms: () =>
      terms
        .filter((t) => t.query.trim() && (!t.regex || !t.regexError))
        .map((t) => ({
          text: t.query,
          color: t.color,
          regex: t.regex,
          caseSensitive: t.caseSensitive
        })),
    clear() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      searchToken++; // drop any in-flight search
      // Reset to a single empty term. Rewind the color sequence so the fresh term is the heritage
      // amber (index 0) — a cleared search looks exactly like the classic single-term Find.
      termSeq = 0;
      terms.splice(0, terms.length, makeTerm());
      matchById = new Map();
      navOrder = [];
      navIndex = -1;
      totalHits = 0;
      const listEl = q('[data-find-terms]');
      if (listEl) {
        listEl.innerHTML = '';
        for (const term of terms) listEl.appendChild(buildTermRow(term));
      }
      closePopover();
      syncAddButton();
      cb.onClear();
      updateFooterCount();
      updateTermCounts();
    },
    destroy() {
      close();
      searchToken++;
    }
  };
}

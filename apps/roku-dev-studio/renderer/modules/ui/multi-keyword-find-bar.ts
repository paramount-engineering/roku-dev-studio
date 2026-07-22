/**
 * Multi-keyword "find in body" bar for the Network Inspector Request/Response panes.
 *
 * Unlike the shared single-query {@link import('./find-bar.js').createFindBar} (ECP / App Connector /
 * simple bodies), this bar searches for SEVERAL keywords at once — rendered as removable colored chips
 * — so the Find modal's up-to-5 search entries can be seeded straight into the detail panes and the
 * user can keep adding their own. User-typed chips are substring (case-insensitive, whitespace-agnostic)
 * by default; toggling the inline `.*` button (or accepting the "looks like a regex" nudge that pulses it)
 * commits the next chip as a regex instead. Chips seeded from the modal's `.*` entries carry the same
 * `regex` flag and match via a compiled RegExp. Both kinds show as chips, count, navigate, and highlight.
 *
 * Engine mirrors find-bar.ts: it walks the rendered text of one scroll container into a cached flat
 * string + segment index, computes cheap numeric match offsets (union across all keywords, capped),
 * and builds `Range`s lazily for the CSS Custom Highlight paint. All keyword matches paint in the one
 * amber "all matches" tint; the active match is the stronger current-match tint. Chips carry each
 * keyword's own color purely for UI identity (linking a chip back to its modal term).
 */
import {
  supportsCssHighlights,
  ensureFindHighlightStyles,
  clearFindHighlights,
  paintMatchHighlights,
  setCurrentMatchHighlight
} from './find-highlight.js';
import { compileGlobalSearchRegex, looksLikeRegex } from '@shared/platform/text-match.js';
import { S } from '@shared/strings/index.js';

/**
 * One search chip. `regex` terms (seeded from the modal's `.*` entries) match via a compiled RegExp
 * over the raw body text; the rest match via whitespace-insensitive substring. Either way they show as
 * a chip, count, navigate, and highlight — regex chips just aren't authorable from the pane input.
 */
export type MkwKeyword = { text: string; color: string; regex?: boolean; caseSensitive?: boolean };

export type MultiFindHandle = {
  setVisible: (visible: boolean) => void;
  isVisible: () => boolean;
  focus: () => void;
  /** Replace the whole keyword set (seeded from the Find modal's entries). Programmatic — does NOT
   *  fire `onChange` (only user edits do). */
  setKeywords: (keywords: MkwKeyword[], jumpToFirst?: boolean) => void;
  /** The current chips, in order — lets the host persist per-request user edits. */
  getKeywords: () => MkwKeyword[];
  /** Recompute matches against the current body DOM (after the content repaints). */
  refresh: () => void;
  /** Drop all keywords, chips, and highlights. Leaves the bar visible. */
  clear: () => void;
  dispose: () => void;
};

export type MultiFindOptions = {
  bodyEl: HTMLElement;
  barEl: HTMLElement;
  /** CSS-highlight registry id for this pane (e.g. 'ni-find-request'). */
  highlightId: string;
  /** Fired when the USER adds/removes/clears a chip (not on programmatic `setKeywords`), so the host
   *  can persist that request's own search terms. */
  onChange?: (keywords: MkwKeyword[]) => void;
};

const MAX_MATCHES = 5000;
const PAINT_CAP = 2000;
/** Fallback colors for keywords the user types directly in the pane (seeded ones carry their own). */
const ADD_PALETTE = ['#f59e0b', '#3cb44b', '#3b82f6', '#f43f5e', '#a855f7'];

/** Lower-case + drop all whitespace, so matching ignores formatting — the same content matches whether
 *  the pane shows minified (Raw) or pretty-printed (JSON/XML) bytes. Mirrors the engine's stripWhitespace. */
const stripWhitespaceLower = (s: string): string => s.toLowerCase().replace(/\s+/g, '');
const isWhitespaceChar = (ch: string): boolean =>
  ch === ' ' ||
  ch === '\n' ||
  ch === '\t' ||
  ch === '\r' ||
  ch === '\f' ||
  ch === '\v' ||
  ch === '\u00a0';

type Segment = { node: Text; start: number };
type MatchOffset = { start: number; end: number };

/** Build the chip find-bar markup. Insert next to a scroll container, then pass as `barEl`. */
export function buildMultiFindBarElement(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'mkw-bar';
  bar.hidden = true;
  bar.innerHTML =
    `<div class="mkw-bar-box" data-mkw-box>` +
    `<div class="mkw-bar-fields" data-mkw-fields>` +
    `<input type="text" class="mkw-bar-input" data-mkw-input placeholder="${S.ui.searchPlaceholder}" spellcheck="false" aria-label="${S.common.search}" />` +
    `</div>` +
    `<button type="button" class="mkw-bar-opt" data-mkw-regex title="${S.ui.useRegex}" aria-pressed="false" aria-label="${S.ui.useRegexAria}">.*</button>` +
    `<span class="mkw-bar-hint" data-mkw-hint>${S.ui.multiWordSearchHint}</span>` +
    `<span class="mkw-bar-count" data-mkw-count aria-live="polite"></span>` +
    `<button type="button" class="mkw-bar-btn" data-mkw-prev title="${S.ui.prevMatchTitle}" aria-label="${S.ui.prevMatch}"><span class="icon icon-xs"><svg><use href="#icon-chevron-up"/></svg></span></button>` +
    `<button type="button" class="mkw-bar-btn" data-mkw-next title="${S.ui.nextMatchTitle}" aria-label="${S.ui.nextMatch}"><span class="icon icon-xs"><svg><use href="#icon-chevron-down"/></svg></span></button>` +
    `<button type="button" class="mkw-bar-btn" data-mkw-clear title="${S.ui.clearSearchTitle}" aria-label="${S.ui.clearSearch}"><span class="icon icon-xs"><svg><use href="#icon-x"/></svg></span></button>` +
    `</div>`;
  return bar;
}

export function createMultiFindBar(opts: MultiFindOptions): MultiFindHandle | null {
  const { bodyEl, barEl, highlightId, onChange } = opts;
  const boxCandidate = barEl.querySelector('[data-mkw-box]');
  const inputCandidate = barEl.querySelector('[data-mkw-input]');
  const countCandidate = barEl.querySelector('[data-mkw-count]');
  const prevCandidate = barEl.querySelector('[data-mkw-prev]');
  const nextCandidate = barEl.querySelector('[data-mkw-next]');
  const clearCandidate = barEl.querySelector('[data-mkw-clear]');
  if (
    !(boxCandidate instanceof HTMLElement) ||
    !(inputCandidate instanceof HTMLInputElement) ||
    !(countCandidate instanceof HTMLElement) ||
    !(prevCandidate instanceof HTMLElement) ||
    !(nextCandidate instanceof HTMLElement) ||
    !(clearCandidate instanceof HTMLElement)
  ) {
    return null;
  }
  // Re-bind to fresh consts so the narrowed (non-null) types flow into the nested closures below.
  const boxEl = boxCandidate;
  const inputEl = inputCandidate;
  const countEl = countCandidate;
  const prevEl = prevCandidate;
  const nextEl = nextCandidate;
  const clearEl = clearCandidate;
  // The wrapping area that holds the chips + input (grows; the count/nav buttons stay pinned right).
  const fieldsEl = (barEl.querySelector('[data-mkw-fields]') as HTMLElement | null) ?? boxEl;
  // The inline `.*` toggle: when on, a committed chip (and the live draft preview) is a regex. Optional
  // so an older markup without it still works — the bar just stays substring-only.
  const regexBtn = barEl.querySelector('[data-mkw-regex]') as HTMLElement | null;

  ensureFindHighlightStyles(highlightId);

  let visible = false;
  let keywords: MkwKeyword[] = [];
  let matchOffsets: MatchOffset[] = [];
  let currentIndex = -1;
  // Whether the NEXT chip the user commits (and the live draft preview) is a regex. Sticky, like an
  // editor's regex toggle; seeded modal chips carry their own flag independent of this.
  let regexMode = false;
  let debounce: ReturnType<typeof setTimeout> | undefined;

  const emitChange = (): void => {
    onChange?.(
      keywords.map((k) => ({ text: k.text, color: k.color, regex: k.regex, caseSensitive: k.caseSensitive }))
    );
  };

  // Surface the "Press Enter to search multiple words" hint only while the user has an uncommitted
  // draft in the input — that's the moment it teaches that each Enter adds another keyword.
  const updateHint = (): void => {
    barEl.classList.toggle('mkw-has-draft', inputEl.value.trim().length > 0);
  };

  // Nudge (don't force) regex mode when the draft has strong regex signals and the toggle is still
  // off: pulse the `.*` button so one click switches the next chip to a regex. Mirrors the Find modal.
  const syncRegexUi = (): void => {
    if (!regexBtn) return;
    regexBtn.classList.toggle('is-on', regexMode);
    regexBtn.setAttribute('aria-pressed', String(regexMode));
    const suggest = !regexMode && looksLikeRegex(inputEl.value);
    regexBtn.classList.toggle('is-suggested', suggest);
    regexBtn.title = suggest ? S.ui.regexSuggest : S.ui.useRegex;
  };

  let full = '';
  // Whitespace-insensitive index over `full`: `strippedLower` is `full` lower-cased with all whitespace
  // removed; `strippedToFull[i]` maps the i-th stripped char back to its offset in `full`, so a match
  // located in the stripped text becomes a DOM Range over the real, formatted text.
  let strippedLower = '';
  let strippedToFull: number[] = [];
  let segments: Segment[] = [];
  let segmentsDirty = true;

  // ---- text index (mirrors find-bar.ts) ------------------------------------------------------
  function ensureSegments(): void {
    if (!segmentsDirty) return;
    segmentsDirty = false;
    segments = [];
    const parts: string[] = [];
    let offset = 0;
    const walker = document.createTreeWalker(bodyEl, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = (node as Text).parentElement;
        if (parent && parent.closest('.telnet-fold-summary')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node as Text;
      const len = text.nodeValue?.length ?? 0;
      if (len === 0) continue;
      segments.push({ node: text, start: offset });
      parts.push(text.nodeValue!);
      offset += len;
    }
    full = parts.join('');
    const stripped: string[] = [];
    strippedToFull = [];
    for (let i = 0; i < full.length; i++) {
      const ch = full[i]!;
      if (isWhitespaceChar(ch)) continue;
      stripped.push(ch);
      strippedToFull.push(i);
    }
    strippedLower = stripped.join('').toLowerCase();
  }

  function locate(offset: number): { node: Text; offset: number } | null {
    if (segments.length === 0) return null;
    let lo = 0;
    let hi = segments.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const seg = segments[mid]!;
      const len = seg.node.nodeValue?.length ?? 0;
      if (offset < seg.start) hi = mid - 1;
      else if (offset > seg.start + len) lo = mid + 1;
      else return { node: seg.node, offset: offset - seg.start };
    }
    const last = segments[segments.length - 1]!;
    return { node: last.node, offset: last.node.nodeValue?.length ?? 0 };
  }

  function buildRange(m: MatchOffset): Range | null {
    const startPos = locate(m.start);
    const endPos = locate(m.end);
    if (!startPos || !endPos) return null;
    const range = document.createRange();
    try {
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);
    } catch {
      return null;
    }
    return range;
  }

  /** Collect all substring hits for a whitespace-stripped needle, mapped back to real `full` offsets. */
  function pushSubstringMatches(text: string): void {
    const needle = stripWhitespaceLower(text);
    if (!needle || !strippedLower) return;
    let from = 0;
    while (matchOffsets.length < MAX_MATCHES) {
      const idx = strippedLower.indexOf(needle, from);
      if (idx === -1) break;
      const start = strippedToFull[idx]!;
      const end = strippedToFull[idx + needle.length - 1]! + 1;
      matchOffsets.push({ start, end });
      from = idx + needle.length;
    }
  }

  /** Collect all regex hits over the raw `full` text (the user's pattern controls whitespace itself). */
  function pushRegexMatches(pattern: string, caseSensitive: boolean): void {
    const re = compileGlobalSearchRegex(pattern, { regex: true, caseSensitive });
    if (!re || !full) return;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while (matchOffsets.length < MAX_MATCHES && (m = re.exec(full)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++; // zero-width match → advance so we don't spin
        continue;
      }
      matchOffsets.push({ start: m.index, end: m.index + m[0].length });
    }
  }

  function computeMatches(): void {
    matchOffsets = [];
    currentIndex = -1;
    const active = keywords.filter((k) => k.text.trim().length > 0);
    if (active.length === 0) return;
    ensureSegments();
    if (!full) return;
    // Regex chips (seeded from the modal's `.*` entries) match via RegExp over the raw text; everything
    // else matches whitespace-insensitively. All hits union into one document-ordered list.
    for (const kw of active) {
      if (matchOffsets.length >= MAX_MATCHES) break;
      if (kw.regex) pushRegexMatches(kw.text, !!kw.caseSensitive);
      else pushSubstringMatches(kw.text);
    }
    matchOffsets.sort((a, b) => a.start - b.start || a.end - b.end);
  }

  function paintAll(): void {
    if (!supportsCssHighlights) return;
    const cap = Math.min(matchOffsets.length, PAINT_CAP);
    const ranges: Range[] = [];
    for (let i = 0; i < cap; i++) {
      const r = buildRange(matchOffsets[i]!);
      if (r) ranges.push(r);
    }
    paintMatchHighlights(highlightId, ranges);
  }

  function expandAncestors(node: Node): void {
    let el = node.parentElement;
    while (el && el !== bodyEl) {
      if (el.classList.contains('telnet-fold-group') && el.classList.contains('telnet-fold-collapsed')) {
        el.classList.remove('telnet-fold-collapsed');
        el.querySelector(':scope > .telnet-fold-twisty')?.setAttribute('aria-expanded', 'true');
      }
      el = el.parentElement;
    }
  }

  function scrollRangeIntoView(range: Range): void {
    // Scroll ONLY the body container — never `Element.scrollIntoView`, which bubbles up and scrolls
    // every ancestor (the card + page), making the whole Network Inspector jump on prev/next.
    requestAnimationFrame(() => {
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const view = bodyEl.getBoundingClientRect();
      const pad = 8;
      if (rect.top >= view.top + pad && rect.bottom <= view.bottom - pad) return;
      const desiredTop = view.top + (view.height - rect.height) / 2;
      bodyEl.scrollTo({ top: bodyEl.scrollTop + (rect.top - desiredTop), behavior: 'auto' });
    });
  }

  function paintCurrent(scroll: boolean): void {
    if (currentIndex < 0 || currentIndex >= matchOffsets.length) {
      setCurrentMatchHighlight(highlightId, null);
      return;
    }
    const range = buildRange(matchOffsets[currentIndex]!);
    if (!range) return;
    expandAncestors(range.startContainer);
    setCurrentMatchHighlight(highlightId, range);
    if (scroll) scrollRangeIntoView(range);
  }

  function updateCount(): void {
    const active = keywords.filter((k) => k.text.trim()).length;
    // Header count reads "(N)" while idle, "X of Y" once there are matches to walk.
    if (matchOffsets.length === 0) {
      countEl.textContent = active > 0 ? '0' : '';
      barEl.classList.toggle('mkw-bar-empty', active > 0);
      return;
    }
    barEl.classList.remove('mkw-bar-empty');
    const total = matchOffsets.length >= MAX_MATCHES ? `${MAX_MATCHES}+` : `${matchOffsets.length}`;
    countEl.textContent = currentIndex >= 0 ? S.ui.matchCountOf(currentIndex + 1, total) : total;
  }

  function runSearch(jumpToFirst: boolean): void {
    computeMatches();
    paintAll();
    if (matchOffsets.length > 0 && jumpToFirst) {
      currentIndex = 0;
      paintCurrent(true);
    } else {
      setCurrentMatchHighlight(highlightId, null);
    }
    updateCount();
  }

  function next(): void {
    if (matchOffsets.length === 0) return;
    currentIndex = (currentIndex + 1) % matchOffsets.length;
    paintCurrent(true);
    updateCount();
  }

  function prev(): void {
    if (matchOffsets.length === 0) return;
    currentIndex = (currentIndex - 1 + matchOffsets.length) % matchOffsets.length;
    paintCurrent(true);
    updateCount();
  }

  // ---- chips ---------------------------------------------------------------------------------
  function renderChips(): void {
    fieldsEl.querySelectorAll('.mkw-chip').forEach((c) => c.remove());
    // Insert chips before the input so typing stays at the end.
    for (const kw of keywords) {
      const chip = document.createElement('span');
      chip.className = kw.regex ? 'mkw-chip mkw-chip-regex' : 'mkw-chip';
      chip.style.setProperty('--mkw-chip-color', kw.color);
      // Regex chips carry a small `.*` marker so it's clear the text is a pattern, not a literal.
      if (kw.regex) {
        const badge = document.createElement('span');
        badge.className = 'mkw-chip-rx';
        badge.textContent = '.*';
        badge.title = S.ui.regexBadgeTitle;
        chip.append(badge);
      }
      const label = document.createElement('span');
      label.className = 'mkw-chip-label';
      label.textContent = kw.text;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'mkw-chip-remove';
      rm.setAttribute('aria-label', S.ui.removeKeywordAria(kw.text));
      rm.textContent = '×';
      rm.addEventListener('click', () => removeKeyword(kw));
      chip.append(label, rm);
      inputEl.insertAdjacentElement('beforebegin', chip);
    }
  }

  function addKeyword(text: string): void {
    const t = text.trim();
    if (!t) return;
    if (keywords.some((k) => k.text.toLowerCase() === t.toLowerCase())) {
      inputEl.value = '';
      updateHint();
      return;
    }
    const color = ADD_PALETTE[keywords.length % ADD_PALETTE.length]!;
    keywords.push(regexMode ? { text: t, color, regex: true } : { text: t, color });
    inputEl.value = '';
    updateHint();
    syncRegexUi();
    renderChips();
    runSearch(true);
    emitChange();
  }

  function removeKeyword(kw: MkwKeyword): void {
    keywords = keywords.filter((k) => k !== kw);
    renderChips();
    runSearch(false);
    emitChange();
  }

  /** Reset chips + highlights. `notify` fires `onChange` only for user-initiated clears (Esc / the
   *  clear button) — the host-facing `clear()` handle passes false so it doesn't wipe the store it's
   *  already resetting. */
  function doClear(notify = false): void {
    keywords = [];
    inputEl.value = '';
    updateHint();
    syncRegexUi();
    clearTimeout(debounce);
    matchOffsets = [];
    currentIndex = -1;
    renderChips();
    clearFindHighlights(highlightId);
    updateCount();
    if (notify) emitChange();
  }

  const onInput = (): void => {
    updateHint();
    syncRegexUi();
    // Live-preview the in-progress keyword alongside the committed chips (debounced).
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const draft = inputEl.value.trim();
      const withDraft = draft
        ? [...keywords, { text: draft, color: '#94a3b8', regex: regexMode }]
        : keywords;
      const saved = keywords;
      keywords = withDraft;
      computeMatches();
      paintAll();
      updateCount();
      keywords = saved;
    }, 150);
  };

  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounce);
      if (inputEl.value.trim()) addKeyword(inputEl.value);
      else if (e.shiftKey) prev();
      else next();
    } else if (e.key === 'Backspace' && inputEl.value === '' && keywords.length > 0) {
      e.preventDefault();
      removeKeyword(keywords[keywords.length - 1]!);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (inputEl.value) {
        e.stopPropagation();
        inputEl.value = '';
        updateHint();
        syncRegexUi();
        runSearch(false);
      } else if (keywords.length > 0) {
        e.stopPropagation();
        doClear(true);
      } else {
        inputEl.blur();
        bodyEl.focus();
      }
    }
  };

  // Toggling regex mode re-runs the live preview so the draft reflects the new interpretation at once.
  const onRegexToggle = (): void => {
    regexMode = !regexMode;
    syncRegexUi();
    inputEl.focus();
    onInput();
  };

  inputEl.addEventListener('input', onInput);
  inputEl.addEventListener('keydown', onKeydown);
  regexBtn?.addEventListener('click', onRegexToggle);
  prevEl.addEventListener('click', prev);
  nextEl.addEventListener('click', next);
  clearEl.addEventListener('click', () => {
    doClear(true);
    bodyEl.focus();
  });
  // Clicking anywhere in the box/field area focuses the input (chip area behaves like one field).
  boxEl.addEventListener('mousedown', (e) => {
    if (e.target === boxEl || e.target === fieldsEl) inputEl.focus();
  });

  barEl.hidden = true;
  syncRegexUi(); // reflect the initial (off) regex-toggle state on the button

  return {
    setVisible(v: boolean) {
      if (v === visible) return;
      visible = v;
      barEl.hidden = !v;
      if (v) {
        segmentsDirty = true;
        if (keywords.length > 0) runSearch(false);
      } else {
        clearFindHighlights(highlightId);
      }
    },
    isVisible: () => visible,
    focus() {
      if (!visible) return;
      inputEl.focus();
      inputEl.select();
    },
    setKeywords(kws: MkwKeyword[], jumpToFirst = true) {
      keywords = kws
        .filter((k) => k.text.trim())
        .map((k) => ({ text: k.text, color: k.color, regex: k.regex, caseSensitive: k.caseSensitive }));
      inputEl.value = '';
      updateHint();
      syncRegexUi();
      clearTimeout(debounce);
      renderChips();
      if (visible) runSearch(jumpToFirst);
      else updateCount();
    },
    getKeywords: () =>
      keywords.map((k) => ({ text: k.text, color: k.color, regex: k.regex, caseSensitive: k.caseSensitive })),
    refresh() {
      if (!visible || keywords.length === 0) return;
      segmentsDirty = true;
      runSearch(false);
      if (matchOffsets.length > 0) {
        currentIndex = 0;
        paintCurrent(false);
        updateCount();
      }
    },
    clear: () => doClear(false),
    dispose() {
      clearTimeout(debounce);
      inputEl.removeEventListener('input', onInput);
      inputEl.removeEventListener('keydown', onKeydown);
      regexBtn?.removeEventListener('click', onRegexToggle);
      prevEl.removeEventListener('click', prev);
      nextEl.removeEventListener('click', next);
      clearFindHighlights(highlightId);
    }
  };
}

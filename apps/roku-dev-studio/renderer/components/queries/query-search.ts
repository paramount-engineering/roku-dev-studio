// Query search functionality

import { formatQueryResult, setSafeHTML } from '../../modules/utils/index.js';

/**
 * Apply the search-term highlight to the already syntax-highlighted query
 * output without disturbing the existing `xml-*` colored spans that
 * `formatQueryResult` produced.
 *
 * Strategy: walk every text node under `rootEl`, build a flat string of all
 * text content + a per-node start-offset table, find matches in the flat
 * string, then for each text node split it into plain-text and
 * `<span class="search-highlight">` segments. Cross-span matches (e.g. a
 * search term that crosses the boundary between an `xml-bracket` `&lt;` and
 * the following `xml-tag` text node) produce one wrapper per text-node
 * segment they touch, all carrying the same `data-match-index` so navigation
 * (`current` class) treats them as a single logical match.
 *
 * Returns the number of *logical* matches (deduplicated across cross-span
 * segments), which is the number used for the `1 / N` count and Next/Prev
 * cycling.
 */
function applySearchHighlightsToDom(rootEl: HTMLElement, searchTerm: string): number {
  if (!searchTerm) return 0;
  const lowerTerm = searchTerm.toLowerCase();
  const termLen = searchTerm.length;
  if (termLen === 0) return 0;

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n instanceof Text) textNodes.push(n);
  }
  if (textNodes.length === 0) return 0;

  const nodeStarts: number[] = new Array(textNodes.length);
  let flat = '';
  for (let i = 0; i < textNodes.length; i++) {
    nodeStarts[i] = flat.length;
    flat += textNodes[i]!.nodeValue ?? '';
  }
  const lowerFlat = flat.toLowerCase();

  const matches: Array<{ start: number; end: number }> = [];
  let pos = 0;
  while (pos < lowerFlat.length) {
    const idx = lowerFlat.indexOf(lowerTerm, pos);
    if (idx === -1) break;
    matches.push({ start: idx, end: idx + termLen });
    pos = idx + termLen;
  }
  if (matches.length === 0) return 0;

  // For each text node, find the subset of matches it overlaps and rebuild
  // the node as a fragment of plain text + highlight spans. We start the
  // per-node match scan from the first match that could possibly overlap
  // the current node (cursor `mIdx`) so the total work is O(nodes + matches),
  // not O(nodes * matches).
  let mIdx = 0;
  for (let i = 0; i < textNodes.length; i++) {
    const tn = textNodes[i]!;
    const text = tn.nodeValue ?? '';
    const nodeStart = nodeStarts[i]!;
    const nodeEnd = nodeStart + text.length;

    while (mIdx < matches.length && matches[mIdx]!.end <= nodeStart) mIdx++;

    type Overlap = { matchIndex: number; start: number; end: number };
    const overlaps: Overlap[] = [];
    for (let k = mIdx; k < matches.length; k++) {
      const m = matches[k]!;
      if (m.start >= nodeEnd) break;
      const segStart = Math.max(m.start, nodeStart) - nodeStart;
      const segEnd = Math.min(m.end, nodeEnd) - nodeStart;
      if (segEnd > segStart) overlaps.push({ matchIndex: k, start: segStart, end: segEnd });
    }
    if (overlaps.length === 0) continue;

    const parent = tn.parentNode;
    if (!parent) continue;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const seg of overlaps) {
      if (seg.start > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, seg.start)));
      }
      const span = document.createElement('span');
      span.className = 'search-highlight';
      span.dataset.matchIndex = String(seg.matchIndex);
      span.textContent = text.slice(seg.start, seg.end);
      fragment.appendChild(span);
      cursor = seg.end;
    }
    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }
    parent.replaceChild(fragment, tn);
  }

  return matches.length;
}

export function setupQuerySearch(
  searchInput: HTMLInputElement,
  queryOutput: HTMLElement,
  searchPrevBtn: HTMLButtonElement | null,
  searchNextBtn: HTMLButtonElement | null,
  matchCountSpan: HTMLElement | null,
  getOriginalContent: () => string,
  _setOriginalContent: (content: string) => void
): void {
  void _setOriginalContent;
  if (!searchPrevBtn || !searchNextBtn || !matchCountSpan) return;
  const matchCountEl = matchCountSpan;

  let currentMatchIndex = 0;
  let totalMatches = 0;

  function updateMatchHighlight() {
    // A single logical match may have been split into multiple span segments
    // (cross-span matches share the same `data-match-index`). Treat every
    // span carrying the active index as "current" and scroll to the first
    // one in document order.
    const marks = queryOutput.querySelectorAll<HTMLElement>('.search-highlight');
    let firstCurrent: HTMLElement | null = null;
    marks.forEach((mark) => {
      const isCurrent = Number(mark.dataset.matchIndex) === currentMatchIndex;
      mark.classList.toggle('current', isCurrent);
      if (isCurrent && !firstCurrent) firstCurrent = mark;
    });
    if (firstCurrent) {
      (firstCurrent as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (totalMatches > 0) {
      matchCountEl.textContent = `${currentMatchIndex + 1} / ${totalMatches}`;
    }
  }

  function goToNextMatch() {
    if (totalMatches > 0) {
      currentMatchIndex = (currentMatchIndex + 1) % totalMatches;
      updateMatchHighlight();
    }
  }

  function goToPrevMatch() {
    if (totalMatches > 0) {
      currentMatchIndex = (currentMatchIndex - 1 + totalMatches) % totalMatches;
      updateMatchHighlight();
    }
  }

  searchNextBtn.addEventListener('click', goToNextMatch);
  searchPrevBtn.addEventListener('click', goToPrevMatch);

  const MAX_SEARCH_LENGTH = 500;
  searchInput.addEventListener('input', () => {
    let searchTerm = searchInput.value.trim();
    if (searchTerm.length > MAX_SEARCH_LENGTH) searchTerm = searchTerm.slice(0, MAX_SEARCH_LENGTH);
    const originalContent = getOriginalContent();

    // Always start from the freshly syntax-highlighted DOM so prior search
    // wrappers are gone and `xml-*` token colors are intact. The highlight
    // pass below then overlays match wrappers without touching those colors.
    setSafeHTML(queryOutput, formatQueryResult(originalContent || ''));

    if (!searchTerm || !originalContent) {
      searchInput.style.borderColor = '';
      searchPrevBtn.style.display = 'none';
      searchNextBtn.style.display = 'none';
      matchCountEl.style.display = 'none';
      totalMatches = 0;
      currentMatchIndex = 0;
      return;
    }

    totalMatches = applySearchHighlightsToDom(queryOutput, searchTerm);
    currentMatchIndex = 0;

    searchPrevBtn.style.display = totalMatches > 0 ? 'block' : 'none';
    searchNextBtn.style.display = totalMatches > 0 ? 'block' : 'none';
    matchCountEl.style.display = 'block';

    if (totalMatches > 0) {
      searchInput.style.borderColor = 'var(--accent-green)';
      matchCountEl.className = 'search-match-count has-matches';
      matchCountEl.textContent = `1 / ${totalMatches}`;
      updateMatchHighlight();
    } else {
      searchInput.style.borderColor = 'var(--accent-red)';
      matchCountEl.className = 'search-match-count no-matches';
      matchCountEl.textContent = '0 matches';
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    }
  });

  searchInput.addEventListener('blur', () => {
    if (!searchInput.value.trim()) {
      searchInput.style.borderColor = '';
    }
  });
}

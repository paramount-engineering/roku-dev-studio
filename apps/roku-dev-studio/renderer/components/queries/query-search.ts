// Query search functionality

import { formatQueryResult, escapeHtml, setSafeHTML } from '../../modules/utils/index.js';

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
    const marks = queryOutput.querySelectorAll('.search-highlight');
    marks.forEach((mark, index) => {
      mark.classList.remove('current');
      if (index === currentMatchIndex) {
        mark.classList.add('current');
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
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

    if (!searchTerm || !originalContent) {
      setSafeHTML(queryOutput, formatQueryResult(originalContent || ''));
      searchInput.style.borderColor = '';
      searchPrevBtn.style.display = 'none';
      searchNextBtn.style.display = 'none';
      matchCountEl.style.display = 'none';
      totalMatches = 0;
      currentMatchIndex = 0;
      return;
    }

    const lowerContent = originalContent.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();
    const matchIndices: number[] = [];
    let pos = 0;
    while (pos < lowerContent.length) {
      const idx = lowerContent.indexOf(lowerTerm, pos);
      if (idx === -1) break;
      matchIndices.push(idx);
      pos = idx + 1;
    }
    totalMatches = matchIndices.length;
    currentMatchIndex = 0;

    searchPrevBtn.style.display = totalMatches > 0 ? 'block' : 'none';
    searchNextBtn.style.display = totalMatches > 0 ? 'block' : 'none';
    matchCountEl.style.display = 'block';

    if (totalMatches > 0) {
      searchInput.style.borderColor = 'var(--accent-green)';
      matchCountEl.className = 'search-match-count has-matches';
      matchCountEl.textContent = `1 / ${totalMatches}`;

      const len = searchTerm.length;
      const parts: string[] = [];
      let last = 0;
      for (const i of matchIndices) {
        parts.push(escapeHtml(originalContent.slice(last, i)));
        parts.push('<span class="search-highlight">', escapeHtml(originalContent.slice(i, i + len)), '</span>');
        last = i + len;
      }
      parts.push(escapeHtml(originalContent.slice(last)));
      setSafeHTML(queryOutput, parts.join(''));

      updateMatchHighlight();
    } else {
      searchInput.style.borderColor = 'var(--accent-red)';
      matchCountEl.className = 'search-match-count no-matches';
      matchCountEl.textContent = '0 matches';
      setSafeHTML(queryOutput, formatQueryResult(originalContent));
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

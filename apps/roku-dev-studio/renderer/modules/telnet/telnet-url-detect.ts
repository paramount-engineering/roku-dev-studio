/**
 * Detect http(s) URLs in plain telnet log text for inline linkification.
 * Does not match scheme-less or custom schemes (e.g. pkg:/) to avoid false positives.
 */

export type TextOrUrlPart = { type: 'text'; value: string } | { type: 'url'; value: string };

/** Strip common trailing punctuation mistaken as part of the URL. */
function trimTrailingUrlNoise(href: string): string {
  // Do not strip trailing `]` — ad / SSAI templates often end with a macro like `[SLAU]`.
  return href.replace(/[),.;:!?'"})]+$/g, '');
}

/**
 * Split `text` into alternating plain text and http(s) URL segments.
 * Caps URL count per line for performance on pathological input.
 */
export function splitTextWithUrls(text: string, maxUrls = 48): TextOrUrlPart[] {
  const out: TextOrUrlPart[] = [];
  if (!text) return out;

  // Allow `[` `]` for ad-server macro placeholders (e.g. `[DUR]`, `[RANDOM]`) inside query strings.
  const re = /\bhttps?:\/\/[^\s<>"'`|{}\\]+/gi;
  let last = 0;
  let urlCount = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ type: 'text', value: text.slice(last, m.index) });
    }
    if (urlCount >= maxUrls) {
      out.push({ type: 'text', value: text.slice(m.index) });
      return out;
    }
    const raw = m[0];
    const cleaned = trimTrailingUrlNoise(raw);
    out.push({ type: 'url', value: cleaned });
    urlCount++;
    last = m.index + raw.length;
  }
  if (last < text.length) {
    out.push({ type: 'text', value: text.slice(last) });
  }
  if (out.length === 0) {
    out.push({ type: 'text', value: text });
  }
  return out;
}

export function createTelnetUrlSpan(url: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'telnet-log-url';
  span.dataset.url = url;
  span.setAttribute('role', 'link');
  span.textContent = url;
  span.title = 'Click to preview in a modal · ⌘ or Ctrl+Click to open in browser';
  return span;
}

/** Fill a log line content element with text nodes + URL spans. */
export function populateTelnetLineContentWithUrls(contentEl: HTMLElement, text: string): void {
  contentEl.replaceChildren();
  for (const part of splitTextWithUrls(text)) {
    if (part.type === 'text') {
      contentEl.appendChild(document.createTextNode(part.value));
    } else {
      contentEl.appendChild(createTelnetUrlSpan(part.value));
    }
  }
}

/**
 * Wrap URLs inside existing text nodes (e.g. after find-in-log rebuilds innerHTML).
 * Skips walking inside `.telnet-log-url` spans.
 */
export function linkifyTelnetContentElement(contentEl: HTMLElement): void {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (!(n instanceof Text)) continue;
    const parent = n.parentElement;
    if (parent?.closest('.telnet-log-url')) continue;
    textNodes.push(n);
  }

  for (const textNode of textNodes) {
    const raw = textNode.nodeValue || '';
    const parts = splitTextWithUrls(raw);
    if (parts.length === 1 && parts[0].type === 'text') continue;

    const parent = textNode.parentNode;
    if (!parent) continue;

    const frag = document.createDocumentFragment();
    for (const p of parts) {
      frag.appendChild(
        p.type === 'text' ? document.createTextNode(p.value) : createTelnetUrlSpan(p.value)
      );
    }
    parent.replaceChild(frag, textNode);
  }
}

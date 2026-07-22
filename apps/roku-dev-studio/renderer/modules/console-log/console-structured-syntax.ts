/**
 * Lightweight JSON / XML syntax coloring for the telnet structured console modal (DOM spans, no deps).
 */

import { S } from '@shared/strings/index.js';

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

/**
 * Tokenize pretty-printed JSON into colored spans.
 */
export function applyJsonSyntaxHighlight(root: HTMLElement, json: string): void {
  root.replaceChildren();
  const punct = '{}[],:';
  let i = 0;
  const n = json.length;

  while (i < n) {
    const c = json[i]!;
    if (c === ' ' || c === '\n' || c === '\r' || c === '\t') {
      root.appendChild(document.createTextNode(c));
      i++;
      continue;
    }
    if (punct.includes(c)) {
      root.appendChild(span('telnet-hl-json-punct', c));
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let esc = false;
      while (j < n) {
        const ch = json[j]!;
        if (esc) {
          esc = false;
          j++;
          continue;
        }
        if (ch === '\\') {
          esc = true;
          j++;
          continue;
        }
        if (ch === '"') {
          j++;
          break;
        }
        j++;
      }
      const chunk = json.slice(i, j);
      let k = j;
      while (k < n && /[\s\r\n]/.test(json[k]!)) k++;
      const isKey = k < n && json[k] === ':';
      root.appendChild(span(isKey ? 'telnet-hl-json-key' : 'telnet-hl-json-string', chunk));
      i = j;
      continue;
    }
    if (c === '-' || (c >= '0' && c <= '9')) {
      let j = i + 1;
      while (j < n && /[0-9.eE+-]/.test(json[j]!)) j++;
      root.appendChild(span('telnet-hl-json-number', json.slice(i, j)));
      i = j;
      continue;
    }
    if (json.startsWith('true', i)) {
      root.appendChild(span('telnet-hl-json-literal', 'true'));
      i += 4;
      continue;
    }
    if (json.startsWith('false', i)) {
      root.appendChild(span('telnet-hl-json-literal', 'false'));
      i += 5;
      continue;
    }
    if (json.startsWith('null', i)) {
      root.appendChild(span('telnet-hl-json-literal', 'null'));
      i += 4;
      continue;
    }
    root.appendChild(document.createTextNode(c));
    i++;
  }
}

function appendHighlightedXmlAttributes(root: HTMLElement, attrPart: string): void {
  const t = attrPart.trim();
  if (!t) return;

  const dq = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = dq.exec(t)) !== null) {
    if (m.index > last) {
      root.appendChild(document.createTextNode(t.slice(last, m.index)));
    }
    root.appendChild(span('telnet-hl-xml-attr-name', m[1]!));
    root.appendChild(span('telnet-hl-xml-punct', '="'));
    root.appendChild(span('telnet-hl-xml-attr-value', m[2]!));
    root.appendChild(span('telnet-hl-xml-punct', '"'));
    last = m.index + m[0].length;
  }
  if (last < t.length) {
    root.appendChild(document.createTextNode(t.slice(last)));
  }
}

/**
 * Build one `<span class="telnet-xml-tag">` wrapper around the colored spans for a single
 * XML tag and append it to `root`. Each kind (`open` / `close` / `self-closing` / `decl` /
 * `comment`) is encoded in a `data-kind` attribute, and element tags carry their
 * `data-tagname` so `applyXmlFoldStructure` can match opens with closes without re-parsing.
 * The previous flat-append shape (one span per token, all siblings of `root`) made
 * matching impossible without bracket-counting `<` and `>` directly, which broke down on
 * tags whose attribute values contained `<` or `>`.
 */
function appendOneXmlTag(root: HTMLElement, tag: string): void {
  const wrapper = document.createElement('span');
  wrapper.className = 'telnet-xml-tag';

  if (tag.startsWith('<?')) {
    wrapper.dataset.kind = 'decl';
    wrapper.appendChild(span('telnet-hl-xml-decl', tag));
    root.appendChild(wrapper);
    return;
  }
  if (tag.startsWith('<!--')) {
    wrapper.dataset.kind = 'comment';
    wrapper.appendChild(span('telnet-hl-xml-comment', tag));
    root.appendChild(wrapper);
    return;
  }

  const selfClose = tag.endsWith('/>');
  const endIdx = selfClose ? tag.length - 2 : tag.length - 1;
  const inner = tag.slice(1, endIdx);
  const closing = inner.startsWith('/');
  const rest = closing ? inner.slice(1) : inner;
  const sp = rest.search(/\s/);
  const name = sp < 0 ? rest : rest.slice(0, sp);
  const attrs = sp < 0 ? '' : rest.slice(sp);

  wrapper.dataset.kind = selfClose ? 'self-closing' : closing ? 'close' : 'open';
  if (name) wrapper.dataset.tagname = name;

  wrapper.appendChild(span('telnet-hl-xml-punct', '<'));
  if (closing) {
    wrapper.appendChild(span('telnet-hl-xml-punct', '/'));
  }
  wrapper.appendChild(span('telnet-hl-xml-tagname', name));
  if (attrs.trim()) {
    wrapper.appendChild(document.createTextNode(' '));
    appendHighlightedXmlAttributes(wrapper, attrs);
  }
  if (selfClose) {
    wrapper.appendChild(span('telnet-hl-xml-punct', '/>'));
  } else {
    wrapper.appendChild(span('telnet-hl-xml-punct', '>'));
  }

  root.appendChild(wrapper);
}

function nextXmlTagEnd(xml: string, start: number): number {
  if (xml.startsWith('<![CDATA[', start)) {
    const i = xml.indexOf(']]>', start);
    return i < 0 ? -1 : i + 2;
  }
  if (xml.startsWith('<?', start)) {
    const i = xml.indexOf('?>', start);
    return i < 0 ? -1 : i + 1;
  }
  if (xml.startsWith('<!--', start)) {
    const i = xml.indexOf('-->', start);
    return i < 0 ? -1 : i + 2;
  }
  return xml.indexOf('>', start);
}

/**
 * Tokenize pretty-printed XML: tags vs text nodes (text is escaped entities from our formatter).
 */
export function applyXmlSyntaxHighlight(root: HTMLElement, xml: string): void {
  root.replaceChildren();
  let last = 0;
  const n = xml.length;

  while (last < n) {
    if (xml[last] !== '<') {
      const nextLt = xml.indexOf('<', last);
      const end = nextLt < 0 ? n : nextLt;
      const text = xml.slice(last, end);
      if (text) {
        root.appendChild(span('telnet-hl-xml-text', text));
      }
      last = end;
      continue;
    }
    const gt = nextXmlTagEnd(xml, last);
    if (gt < 0) {
      root.appendChild(document.createTextNode(xml.slice(last)));
      break;
    }
    const tag = xml.slice(last, gt + 1);
    appendOneXmlTag(root, tag);
    last = gt + 1;
  }
}

/* ───────────────────────────── fold / expand ───────────────────────────── */

/**
 * Build the twisty + body + summary scaffold around an open/close token pair.
 *
 * Layout (default `expanded` state):
 *   <span class="telnet-fold-group" data-kind=…>
 *     <button class="telnet-fold-twisty" aria-expanded="true" tabindex="-1"></button>
 *     <openToken/>                  ← moved from caller
 *     <span class="telnet-fold-body">
 *       …intervening nodes…         ← moved from caller
 *       <closeToken/>                ← moved from caller (so its leading-whitespace
 *                                       text node hides cleanly when collapsed)
 *     </span>
 *     <span class="telnet-fold-summary" aria-hidden="true">…<closeMirror/></span>
 *   </span>
 *
 * `.telnet-fold-collapsed` swaps body↔summary visibility via CSS. The `summary`'s
 * `closeMirror` is a sibling-styled copy of the close token so collapsed renders read
 * naturally (e.g. `{…}` / `[…]` / `…</tag>`). Returns the new `.telnet-fold-body` so the
 * caller can recurse into it.
 */
function wrapFoldGroup(
  openToken: HTMLElement,
  closeToken: HTMLElement,
  kind: 'json-object' | 'json-array' | 'xml',
  closeMirrorFactory: () => HTMLElement
): HTMLElement {
  const parent = openToken.parentNode;
  if (!parent) throw new Error('wrapFoldGroup: openToken has no parent');

  // Snapshot the body nodes (siblings strictly between openToken and closeToken) BEFORE
  // any DOM moves — once we start `appendChild`-ing the open token into the new group,
  // sibling pointers shift and a naive `while (n !== closeToken) bodyNodes.push(n.next…)`
  // would race the mutation. Snapshotting up front avoids the tangle.
  const bodyNodes: ChildNode[] = [];
  let cursor: ChildNode | null = openToken.nextSibling;
  while (cursor && cursor !== closeToken) {
    bodyNodes.push(cursor);
    cursor = cursor.nextSibling;
  }

  const group = document.createElement('span');
  group.className = 'telnet-fold-group';
  group.dataset.kind = kind;

  parent.insertBefore(group, openToken);

  const twisty = document.createElement('button');
  twisty.type = 'button';
  twisty.className = 'telnet-fold-twisty';
  twisty.setAttribute('aria-expanded', 'true');
  twisty.setAttribute('aria-label', S.consoleLog.collapse);
  twisty.tabIndex = -1;
  group.appendChild(twisty);

  group.appendChild(openToken);

  const body = document.createElement('span');
  body.className = 'telnet-fold-body';
  for (const node of bodyNodes) {
    body.appendChild(node);
  }
  body.appendChild(closeToken);
  group.appendChild(body);

  const summary = document.createElement('span');
  summary.className = 'telnet-fold-summary';
  summary.setAttribute('aria-hidden', 'true');
  const ellipsis = document.createElement('span');
  ellipsis.className = 'telnet-fold-summary-ellipsis';
  ellipsis.textContent = '…';
  summary.appendChild(ellipsis);
  summary.appendChild(closeMirrorFactory());
  group.appendChild(summary);

  return body;
}

/** Find the close-brace span that balances `openEl` within its parent. */
function findMatchingJsonClose(openEl: HTMLElement): HTMLElement | null {
  const openChar = openEl.textContent;
  const closeChar = openChar === '{' ? '}' : openChar === '[' ? ']' : null;
  if (!closeChar) return null;
  let depth = 1;
  let n: ChildNode | null = openEl.nextSibling;
  while (n) {
    if (n instanceof HTMLElement && n.classList.contains('telnet-hl-json-punct')) {
      const t = n.textContent;
      if (t === '{' || t === '[') {
        depth++;
      } else if (t === '}' || t === ']') {
        depth--;
        if (depth === 0) return t === closeChar ? n : null;
      }
    }
    n = n.nextSibling;
  }
  return null;
}

/**
 * Wrap every `{…}` / `[…]` pair in a fold group, recursing into bodies for nested
 * collapses. Empty `{}` / `[]` are left alone — the open and close tokens are adjacent
 * siblings so there's nothing to hide and no twisty would be useful.
 *
 * Run *after* `applyJsonSyntaxHighlight`; it consumes the punct spans the tokenizer
 * emitted and rewires them into the fold scaffold without changing `pre.dataset.formatted`
 * (which lives separately for the Copy button).
 */
export function applyJsonFoldStructure(root: HTMLElement): void {
  foldJsonContainer(root);
}

function foldJsonContainer(container: HTMLElement): void {
  let node: ChildNode | null = container.firstChild;
  while (node) {
    const next = node.nextSibling;
    if (
      node instanceof HTMLElement &&
      node.classList.contains('telnet-hl-json-punct') &&
      (node.textContent === '{' || node.textContent === '[')
    ) {
      const openEl = node;
      const openChar = openEl.textContent as '{' | '[';
      const closeEl = findMatchingJsonClose(openEl);
      // Skip empty containers: `{}` / `[]` have the close as the immediate next sibling,
      // so there's nothing to fold.
      if (closeEl && closeEl !== openEl.nextSibling) {
        const body = wrapFoldGroup(
          openEl,
          closeEl,
          openChar === '{' ? 'json-object' : 'json-array',
          () => {
            const mirror = document.createElement('span');
            mirror.className = 'telnet-hl-json-punct';
            mirror.textContent = openChar === '{' ? '}' : ']';
            return mirror;
          }
        );
        foldJsonContainer(body);
        // Continue iterating in the parent container after the new group.
        node = body.parentElement?.nextSibling ?? null;
        continue;
      }
    }
    node = next;
  }
}

/** Find the close tag that balances `openEl` within its parent, matched by tag name + depth. */
function findMatchingXmlClose(openEl: HTMLElement): HTMLElement | null {
  const tagname = openEl.dataset.tagname;
  if (!tagname) return null;
  let depth = 1;
  let n: ChildNode | null = openEl.nextSibling;
  while (n) {
    if (n instanceof HTMLElement && n.classList.contains('telnet-xml-tag')) {
      // Only nested elements with the *same* tag name affect depth. Self-closing tags
      // (no body) and decl/comment kinds are inert for matching purposes.
      const kind = n.dataset.kind;
      const name = n.dataset.tagname;
      if (kind === 'open' && name === tagname) {
        depth++;
      } else if (kind === 'close' && name === tagname) {
        depth--;
        if (depth === 0) return n;
      }
    }
    n = n.nextSibling;
  }
  return null;
}

/**
 * Wrap every non-self-closing `<tag>…</tag>` pair in a fold group, recursing into bodies.
 * Empty elements (`<tag></tag>` with open immediately followed by close) are left alone
 * — same rationale as empty JSON containers.
 *
 * Run *after* `applyXmlSyntaxHighlight` so the tags are already grouped into
 * `<span class="telnet-xml-tag" data-kind=… data-tagname=…>` wrappers and we can match
 * by name without re-parsing the XML.
 */
export function applyXmlFoldStructure(root: HTMLElement): void {
  foldXmlContainer(root);
}

function foldXmlContainer(container: HTMLElement): void {
  let node: ChildNode | null = container.firstChild;
  while (node) {
    const next = node.nextSibling;
    if (
      node instanceof HTMLElement &&
      node.classList.contains('telnet-xml-tag') &&
      node.dataset.kind === 'open'
    ) {
      const openEl = node;
      const closeEl = findMatchingXmlClose(openEl);
      if (closeEl && closeEl !== openEl.nextSibling) {
        const body = wrapFoldGroup(openEl, closeEl, 'xml', () => {
          // Mirror the close tag (`</tagname>`) so the collapsed summary renders as
          // `<tag>…</tag>` — same coloring as the original close, just a fresh DOM node
          // (we can't move the original because the body still needs it for expand).
          const tagname = openEl.dataset.tagname ?? '';
          const mirror = document.createElement('span');
          mirror.className = 'telnet-xml-tag';
          mirror.dataset.kind = 'close';
          mirror.dataset.tagname = tagname;
          mirror.appendChild(span('telnet-hl-xml-punct', '<'));
          mirror.appendChild(span('telnet-hl-xml-punct', '/'));
          mirror.appendChild(span('telnet-hl-xml-tagname', tagname));
          mirror.appendChild(span('telnet-hl-xml-punct', '>'));
          return mirror;
        });
        foldXmlContainer(body);
        node = body.parentElement?.nextSibling ?? null;
        continue;
      }
    }
    node = next;
  }
}

/**
 * Toggle a fold group's collapsed state. Idempotent: the caller (delegated click handler)
 * can flip without first checking the current state. Mirrors `aria-expanded` on the twisty
 * so screen readers and keyboard users see the live state.
 */
export function toggleFoldGroup(group: HTMLElement): void {
  const collapsed = group.classList.toggle('telnet-fold-collapsed');
  const twisty = group.querySelector(':scope > .telnet-fold-twisty');
  if (twisty instanceof HTMLElement) {
    twisty.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    twisty.setAttribute('aria-label', collapsed ? S.consoleLog.expand : S.consoleLog.collapse);
  }
}

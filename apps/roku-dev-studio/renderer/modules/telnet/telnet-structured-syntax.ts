/**
 * Lightweight JSON / XML syntax coloring for the telnet structured console modal (DOM spans, no deps).
 */

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

function appendOneXmlTag(root: HTMLElement, tag: string): void {
  if (tag.startsWith('<?')) {
    root.appendChild(span('telnet-hl-xml-decl', tag));
    return;
  }
  if (tag.startsWith('<!--')) {
    root.appendChild(span('telnet-hl-xml-comment', tag));
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

  root.appendChild(span('telnet-hl-xml-punct', '<'));
  if (closing) {
    root.appendChild(span('telnet-hl-xml-punct', '/'));
  }
  root.appendChild(span('telnet-hl-xml-tagname', name));
  if (attrs.trim()) {
    root.appendChild(document.createTextNode(' '));
    appendHighlightedXmlAttributes(root, attrs);
  }
  if (selfClose) {
    root.appendChild(span('telnet-hl-xml-punct', '/>'));
  } else {
    root.appendChild(span('telnet-hl-xml-punct', '>'));
  }
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

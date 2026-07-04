/**
 * Canonical renderer for "show this response as a collapsible, syntax-highlighted JSON/XML tree".
 *
 * One implementation for every surface that displays a structured body — ECP Query Results, App
 * Connector Response, Network Inspector Request/Response, and the Console JSON/XML viewer — built on
 * the shared fold engine (`console-structured-syntax`). Non-structured (or oversized) content falls
 * back to a plain text node, which the simple find bar can still search.
 *
 * This module owns the single pretty-printer (`prettyXml` / `prettyJson`), format detection, and the
 * tokenize+fold mount step, so callers don't re-implement any of it.
 */

import {
  applyJsonSyntaxHighlight,
  applyJsonFoldStructure,
  applyXmlSyntaxHighlight,
  applyXmlFoldStructure,
  toggleFoldGroup
} from '../console-log/console-structured-syntax.js';

export type StructuredKind = 'json' | 'xml' | 'text';

// Above this, building a fold tree (a span per token) costs too much DOM; show raw text instead.
// Comfortably covers ECP device queries and App Connector command responses. Exported so other
// structured-body surfaces (e.g. the Network Inspector detail) gate on the same single threshold
// instead of a private copy that can drift.
export const MAX_STRUCTURED_BYTES = 512 * 1024;

/** Pretty-print JSON text (object/array), or null when it isn't valid JSON. */
export function prettyJson(s: string): string | null {
  const t = s.trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return null;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return null;
  }
}

/** Pretty-print well-formed XML with newlines + indentation, or null when it doesn't parse. */
export function prettyXml(xml: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror') || !doc.documentElement) return null;
    const raw = new XMLSerializer().serializeToString(doc.documentElement);
    const lines = raw.replace(/>\s*</g, '>\n<').split('\n');
    let pad = 0;
    const out: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (/^<\//.test(t)) pad = Math.max(0, pad - 1);
      out.push(`${'  '.repeat(pad)}${t}`);
      // Opening tag that isn't also self-closing / immediately closed on the same line → indent.
      if (/^<[^!?][^>]*[^/]>$/.test(t) && !t.includes('</')) pad += 1;
    }
    return out.join('\n');
  } catch {
    return null;
  }
}

/**
 * Lenient XML pretty-printer: regex line-split + best-effort reindent that never throws or returns
 * null. Unlike the strict {@link prettyXml} (DOMParser, well-formed only), this tolerates partial /
 * malformed fragments — used for Action Script step output (which can be truncated mid-stream) and
 * its PDF export, where some indentation beats raw text even when the markup doesn't fully parse.
 */
export function prettyXmlLenient(xml: string): string {
  const s = xml.trim();
  if (!s) return '';
  const parts = s.replace(/>\s*</g, '>\n<').split('\n');
  let indent = 0;
  const indentStr = '  ';
  const out: string[] = [];
  for (const part of parts) {
    const line = part.trim();
    if (!line) continue;
    const isClosing = line.startsWith('</');
    const isSelfClosing = /\/\s*>$/.test(line) || line.startsWith('<?');
    if (isClosing) indent = Math.max(0, indent - 1);
    out.push(indentStr.repeat(indent) + line);
    if (!isClosing && !isSelfClosing && line.startsWith('<') && !line.startsWith('<!')) {
      const tagMatch = line.match(/^<([^\s/>]+)/);
      // HTML void elements (`<meta>`, `<br>`, `<img>` …) never nest, so don't indent after them —
      // otherwise a plain HTML page would step further right on every one. Harmless for real XML,
      // where these names don't appear as unclosed container tags.
      const tag = tagMatch?.[1]?.toLowerCase();
      if (tagMatch && tag && !HTML_VOID_TAGS.has(tag) && !line.includes(`</${tagMatch[1]}>`)) indent++;
    }
  }
  return out.join('\n');
}

// HTML elements that are always empty (no closing tag), per the HTML spec. Used by the lenient
// markup printer so unclosed void tags in an HTML body don't cause runaway indentation.
const HTML_VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

/** Classify a response string as JSON, XML, or plain text (same rules `renderStructuredBody` uses).
 *  Handy for choosing a default file extension on Save. */
export function detectStructuredKind(rawText: string): StructuredKind {
  const trimmed = (rawText ?? '').trim();
  if (!trimmed || trimmed.length > MAX_STRUCTURED_BYTES) return 'text';
  if (prettyJson(trimmed) != null) return 'json';
  if (trimmed.startsWith('<') && prettyXml(trimmed) != null) return 'xml';
  return 'text';
}

/** Default file extension for a response string, based on its detected kind. */
export function structuredFileExtension(rawText: string): 'json' | 'xml' | 'txt' {
  const kind = detectStructuredKind(rawText);
  return kind === 'json' ? 'json' : kind === 'xml' ? 'xml' : 'txt';
}

export type RenderStructuredOptions = {
  /** Force a kind instead of auto-detecting — e.g. the Network Inspector Format selector picks
   *  JSON/XML/Raw explicitly. Omit to auto-detect (ECP / App Connector). */
  kind?: StructuredKind;
  /** Treat `text` as already pretty-printed and skip re-formatting — e.g. the Console viewer,
   *  which formats during detection. */
  preformatted?: boolean;
};

/** Build the highlighted + foldable element for `formatted` text of a known `kind`. */
function appendStructured(container: HTMLElement, kind: 'json' | 'xml', formatted: string): void {
  const code = document.createElement('div');
  code.className = `structured-body telnet-hl-root telnet-hl-${kind}`;
  // The pretty source backs Copy/Save so it's correct even when nodes are collapsed.
  code.dataset.formatted = formatted;
  if (kind === 'json') {
    applyJsonSyntaxHighlight(code, formatted);
    applyJsonFoldStructure(code);
  } else {
    applyXmlSyntaxHighlight(code, formatted);
    applyXmlFoldStructure(code);
  }
  container.appendChild(code);
}

/**
 * Render `text` into `container` (replacing its contents) as a collapsible JSON/XML tree, or a plain
 * text node when it isn't structured / is too large. Returns the kind actually rendered. This is the
 * single entry point used by every structured-body surface.
 */
export function renderStructuredInto(
  container: HTMLElement,
  text: string,
  opts: RenderStructuredOptions = {}
): StructuredKind {
  container.replaceChildren();
  const raw = text ?? '';
  const trimmed = raw.trim();
  if (!trimmed) return 'text';
  if (trimmed.length > MAX_STRUCTURED_BYTES) {
    container.appendChild(document.createTextNode(raw));
    return 'text';
  }

  const kind = opts.kind ?? detectStructuredKind(trimmed);
  if (kind === 'json') {
    // Forced-JSON on non-JSON still tokenizes best-effort (prettyJson → null → use raw).
    appendStructured(container, 'json', opts.preformatted ? raw : prettyJson(trimmed) ?? raw);
    return 'json';
  }
  if (kind === 'xml') {
    // Strict `prettyXml` (well-formed XML only) → lenient reindent for HTML / partial markup so a
    // non-well-formed body (e.g. an HTML error page) still formats instead of rendering as one line.
    const formatted = opts.preformatted ? raw : prettyXml(trimmed) ?? prettyXmlLenient(trimmed);
    appendStructured(container, 'xml', formatted);
    return 'xml';
  }

  container.appendChild(document.createTextNode(raw));
  return 'text';
}

/** Auto-detecting convenience wrapper (ECP Query Results, App Connector Response). */
export function renderStructuredBody(container: HTMLElement, rawText: string): StructuredKind {
  return renderStructuredInto(container, rawText);
}

/** Pretty-printed source of a previously rendered structured body, for Copy that's correct even
 *  when nodes are collapsed. Falls back to the element's text. */
export function structuredBodyText(container: HTMLElement): string {
  const code = container.querySelector('[data-formatted]');
  if (code instanceof HTMLElement && typeof code.dataset.formatted === 'string') {
    return code.dataset.formatted;
  }
  return container.innerText || container.textContent || '';
}

/** Delegated fold-twisty click handler. Attach once to a container; survives content re-renders.
 *  Returns a remover. */
export function attachFoldToggle(container: HTMLElement): () => void {
  const onClick = (e: MouseEvent): void => {
    const t = e.target;
    const start = t instanceof Element ? t : t instanceof Text ? t.parentElement : null;
    const twisty = start?.closest('.telnet-fold-twisty');
    if (!(twisty instanceof HTMLElement)) return;
    const group = twisty.closest('.telnet-fold-group');
    if (!(group instanceof HTMLElement)) return;
    e.preventDefault();
    toggleFoldGroup(group);
  };
  container.addEventListener('click', onClick);
  return () => container.removeEventListener('click', onClick);
}

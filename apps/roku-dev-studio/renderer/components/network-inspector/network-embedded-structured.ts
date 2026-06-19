/**
 * Detect JSON/XML *embedded inside an otherwise non-structured* response/request body (e.g. a
 * minified `utag.js` whose source contains big JSON config objects) and turn each fragment into a
 * clickable highlight that opens the shared formatted viewer — the same modal the Console / Log
 * Viewer use for structured log lines.
 *
 * This is only for the RAW text body path: when the whole body already is valid JSON/XML the
 * Network Inspector renders it as a collapsible tree, so there's nothing to "find inside it".
 *
 * Detection is offset-based (so we can wrap the exact substring) and heavily bounded so scanning a
 * multi-hundred-KB body stays cheap: a cheap JSON-start pre-filter, an attempt cap, a fragment-size
 * cap, and a max number of targets. Only fragments that actually `JSON.parse` (or `prettyXml`-parse)
 * are highlighted, so JS object literals with unquoted keys / function bodies never match.
 */

import { escapeHtml } from '../../modules/utils/dom.js';
import { prettyJson, prettyXml } from '../../modules/ui/structured-body.js';
import type { StructuredConsolePayload } from '../../modules/console-log/structured-log-detect.js';

// Above this body size we skip embedded detection entirely (scan cost + the single non-chunked
// <pre> we render when highlights exist). Smaller bodies still get the collapsible tree elsewhere.
const EMBED_DETECT_MAX_BYTES = 1_000_000;
const MAX_TARGETS = 40;
const MAX_PROBES = 6000;
// Ignore trivial `{}` / `[]` / tiny objects so JS code isn't peppered with highlights.
const MIN_JSON_FRAGMENT = 60;
const MIN_XML_FRAGMENT = 12;
const MAX_FRAGMENT_BYTES = 600_000;

type EmbeddedRange = { kind: 'json' | 'xml'; start: number; end: number };

function isWs(c: string): boolean {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r';
}

/** Extract a balanced `{...}` / `[...]` starting at `start` (respects JSON string escapes). */
function extractBalancedJsonFragment(s: string, start: number): string | null {
  const open = s[start];
  if (open !== '{' && open !== '[') return null;
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  const limit = Math.min(s.length, start + MAX_FRAGMENT_BYTES);
  for (let i = start; i < limit; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** Cheap pre-filter: only `{` followed by a quoted key (or empty) / `[` followed by a value char
 *  looks like JSON. Skips the vast majority of JS `{ statements }` without an extraction attempt. */
function looksLikeJsonStart(s: string, i: number): boolean {
  const open = s[i];
  let j = i + 1;
  while (j < s.length && isWs(s[j]!)) j++;
  const c = s[j];
  if (c === undefined) return false;
  if (open === '{') return c === '"' || c === '}';
  // array
  return (
    c === '{' ||
    c === '[' ||
    c === '"' ||
    c === ']' ||
    c === '-' ||
    (c >= '0' && c <= '9') ||
    c === 't' ||
    c === 'f' ||
    c === 'n'
  );
}

const XML_TAG_RE = /<(\/?)([A-Za-z_][\w.\-:]*)([^>]*?)(\/?)>/g;

/** Extract a balanced XML element starting exactly at `start` (an opening `<Tag…>`), or null. */
function extractBalancedXmlElement(s: string, start: number): string | null {
  XML_TAG_RE.lastIndex = start;
  let depth = 0;
  let first = false;
  let m: RegExpExecArray | null;
  while ((m = XML_TAG_RE.exec(s))) {
    if (!first) {
      if (m.index !== start || m[1] === '/') return null;
      first = true;
    }
    const closing = m[1] === '/';
    const selfClose = m[4] === '/';
    if (closing) depth--;
    else if (!selfClose) depth++;
    if (depth <= 0) return s.slice(start, XML_TAG_RE.lastIndex);
    if (XML_TAG_RE.lastIndex - start > MAX_FRAGMENT_BYTES) return null;
  }
  return null;
}

/** Find embedded JSON/XML fragments left-to-right; non-overlapping (we advance past each hit). */
function scanEmbeddedStructured(text: string): EmbeddedRange[] {
  const out: EmbeddedRange[] = [];
  if (!text || text.length > EMBED_DETECT_MAX_BYTES) return out;
  let i = 0;
  let probes = 0;
  while (i < text.length && out.length < MAX_TARGETS && probes < MAX_PROBES) {
    const c = text[i];
    if (c === '{' || c === '[') {
      if (looksLikeJsonStart(text, i)) {
        probes++;
        const frag = extractBalancedJsonFragment(text, i);
        if (frag && frag.length >= MIN_JSON_FRAGMENT) {
          try {
            const v = JSON.parse(frag) as unknown;
            if (v !== null && typeof v === 'object') {
              out.push({ kind: 'json', start: i, end: i + frag.length });
              i += frag.length;
              continue;
            }
          } catch {
            /* not JSON — fall through */
          }
        }
      }
    } else if (c === '<') {
      const n = text[i + 1];
      if (n && /[A-Za-z?]/.test(n)) {
        probes++;
        let elStart = i;
        if (n === '?') {
          // XML declaration: jump to the root element that follows `?>`.
          const q = text.indexOf('?>', i);
          if (q < 0) {
            i++;
            continue;
          }
          let k = q + 2;
          while (k < text.length && text[k] !== '<') k++;
          if (k >= text.length || !/[A-Za-z]/.test(text[k + 1] || '')) {
            i = Math.max(i + 1, q + 2);
            continue;
          }
          elStart = k;
        }
        const frag = extractBalancedXmlElement(text, elStart);
        if (frag && frag.length >= MIN_XML_FRAGMENT) {
          // Validate (and require it to pretty-print) so arbitrary `<` in text isn't mislabeled.
          if (prettyXml(text.slice(i, elStart + frag.length)) != null) {
            out.push({ kind: 'xml', start: i, end: elStart + frag.length });
            i = elStart + frag.length;
            continue;
          }
        }
      }
    }
    i++;
  }
  return out;
}

// Per-pane registry of the payloads the click handler resolves by index. Overwritten on every raw
// body render so it can never reference a stale (recycled) detail. Bodies live in the disk-backed
// detail store; only the currently-shown pane's payloads are held here.
const registry: { request: StructuredConsolePayload[]; response: StructuredConsolePayload[] } = {
  request: [],
  response: []
};

export type EmbeddedPane = 'request' | 'response';

export function clearEmbeddedStructured(pane: EmbeddedPane): void {
  registry[pane] = [];
}

export function getEmbeddedStructuredPayload(
  pane: EmbeddedPane,
  idx: number
): StructuredConsolePayload | undefined {
  const arr = registry[pane];
  return idx >= 0 && idx < arr.length ? arr[idx] : undefined;
}

/**
 * Build escaped body HTML with each embedded JSON/XML fragment wrapped in a clickable
 * `.ni-embedded-structured` span, and register the payloads for `pane`. Returns the inner HTML plus
 * the number of fragments found (0 → caller should fall back to the plain/chunked renderer).
 */
export function buildEmbeddedBodyHtml(
  text: string,
  pane: EmbeddedPane
): { html: string; count: number } {
  const ranges = scanEmbeddedStructured(text);
  if (ranges.length === 0) {
    registry[pane] = [];
    return { html: '', count: 0 };
  }
  const payloads: StructuredConsolePayload[] = [];
  let html = '';
  let pos = 0;
  for (const r of ranges) {
    const raw = text.slice(r.start, r.end);
    const formatted = (r.kind === 'json' ? prettyJson(raw) : prettyXml(raw)) ?? raw;
    const idx = payloads.length;
    payloads.push({ kind: r.kind, raw, formatted });
    html += escapeHtml(text.slice(pos, r.start));
    const label = r.kind === 'json' ? 'JSON' : 'XML';
    html +=
      `<span class="ni-embedded-structured ni-embedded-${r.kind}" role="button" tabindex="0" ` +
      `data-ni-emb-idx="${idx}" title="Click to view formatted ${label} (opens in a modal)">` +
      `${escapeHtml(raw)}</span>`;
    pos = r.end;
  }
  html += escapeHtml(text.slice(pos));
  registry[pane] = payloads;
  return { html, count: payloads.length };
}

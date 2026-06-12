/**
 * Detect JSON or XML payloads in a single console log line for "open in viewer" UX.
 * JSON: balanced `{`/`[` fragments, plus JSON embedded in JSON string values (escaped / nested).
 */

export type StructuredConsolePayload = {
  kind: 'json' | 'xml';
  raw: string;
  formatted: string;
  /** Parsed from a string field or a quoted JSON blob, not the primary balanced fragment. */
  fromEscapedString?: boolean;
  /**
   * `[start, end)` offset of the quoted literal (or the balanced JSON fragment) in
   * the *original* log line. When present, lets the click handler open this exact
   * payload when the user clicks inside that range, instead of always opening
   * `targets[0]`. May be absent when only the parsed-tree walker discovered the
   * payload and no matching quoted literal was on the line.
   */
  lineRange?: [number, number];
};

const MAX_LINE_LEN = 400_000;
const MAX_STRUCTURED_TARGETS = 28;
const MAX_QUOTED_STRING_PROBES = 96;
const MAX_STRING_UNWRAP = 10;
const MAX_NESTED_WALK_DEPTH = 48;

function firstNonSpaceIndex(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== ' ' && s[i] !== '\t') return i;
  }
  return -1;
}

/** Extract balanced `{...}` or `[...]` from start index; respects JSON string escapes. */
export function extractBalancedJsonFragment(s: string, start: number): string | null {
  const open = s[start];
  if (open !== '{' && open !== '[') return null;
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function tryParseJsonCandidate(candidate: string): unknown | null {
  const t = candidate.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isJsonObjectOrArray(v: unknown): boolean {
  return v !== null && typeof v === 'object';
}

/**
 * Parse `initial` as JSON, then while the value is a string, parse again (double-encoded JSON lines).
 */
function parseThroughJsonStringWrappers(initial: string): unknown | null {
  let cur: unknown;
  try {
    cur = JSON.parse(initial.trim());
  } catch {
    return null;
  }
  for (let u = 0; u < MAX_STRING_UNWRAP; u++) {
    if (typeof cur !== 'string') break;
    const next = cur.trim();
    if (!next) return null;
    try {
      cur = JSON.parse(next);
    } catch {
      return null;
    }
  }
  return cur;
}

/**
 * If `s` is (possibly wrapped) JSON text that decodes to an object or array, return that value.
 * Used for string fields that contain serialized JSON.
 */
function jsonValueFromPossiblyWrappedString(s: string): unknown | null {
  const v = parseThroughJsonStringWrappers(s);
  if (!isJsonObjectOrArray(v)) return null;
  return v;
}

function escapeXmlText(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlAttrValue(t: string): string {
  return escapeXmlText(t).replace(/"/g, '&quot;');
}

function serializeAttrs(el: Element): string {
  let out = '';
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    out += ` ${a.name}="${escapeXmlAttrValue(a.value)}"`;
  }
  return out;
}

function prettyXmlElement(el: Element, depth: number): string {
  const pad = '  '.repeat(depth);
  const name = el.tagName;
  const attrs = serializeAttrs(el);
  const kids = [...el.childNodes].filter((n) => {
    if (n.nodeType === Node.ELEMENT_NODE) return true;
    if (n.nodeType === Node.TEXT_NODE || n.nodeType === Node.CDATA_SECTION_NODE) {
      const t = (n.textContent || '').trim();
      return t.length > 0;
    }
    return false;
  });

  if (kids.length === 0) {
    return `${pad}<${name}${attrs}/>\n`;
  }

  if (
    kids.length === 1 &&
    (kids[0].nodeType === Node.TEXT_NODE || kids[0].nodeType === Node.CDATA_SECTION_NODE)
  ) {
    const raw = kids[0].textContent || '';
    return `${pad}<${name}${attrs}>${escapeXmlText(raw.trim())}</${name}>\n`;
  }

  let body = `${pad}<${name}${attrs}>\n`;
  for (const k of kids) {
    if (k.nodeType === Node.ELEMENT_NODE) {
      body += prettyXmlElement(k as Element, depth + 1);
    } else if (k.nodeType === Node.TEXT_NODE || k.nodeType === Node.CDATA_SECTION_NODE) {
      const t = (k.textContent || '').trim();
      if (t) body += `${pad}  ${escapeXmlText(t)}\n`;
    }
  }
  body += `${pad}</${name}>\n`;
  return body;
}

function tryXmlPayload(fromFirstLt: string): StructuredConsolePayload | null {
  const candidate = fromFirstLt.trim();
  if (!candidate || candidate.length < 3) return null;

  const doc = new DOMParser().parseFromString(candidate, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) return null;

  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() === 'html') return null;

  const formatted = prettyXmlElement(root, 0).trimEnd();
  return { kind: 'xml', raw: candidate, formatted };
}

/**
 * BrightScript / RAF logs often wrap payloads in double quotes with escaped inner quotes (`\"`).
 */
function unescapeLogQuotedPayload(s: string): string {
  return s
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

/** Trim trailing wrapper quote from `... = "<?xml ..."` style lines. */
function normalizeXmlLogSlice(s: string): string {
  let t = s.trimEnd();
  t = unescapeLogQuotedPayload(t);
  if (t.endsWith('"')) t = t.slice(0, -1).trimEnd();
  return t;
}

/**
 * Strong XML signals (declaration or known ad/feed roots) must win over embedded JSON
 * (e.g. VAST CDATA with VerificationParameters JSON, or URLs) — otherwise embedded-JSON
 * scan parses the first balanced `{...}` inside the line and mislabels the whole row as JSON.
 */
function tryXmlFromStrongMarkers(line: string): StructuredConsolePayload | null {
  const lower = line.toLowerCase();
  let start = lower.indexOf('<?xml');
  if (start < 0) {
    const m = line.match(/<(vast|rss|feed|mrss)(\s|>|\/)/i);
    if (m && m.index !== undefined) start = m.index;
  }
  if (start < 0) return null;

  if (line[start] !== '<') {
    const lt = line.indexOf('<', start);
    if (lt < 0) return null;
    start = lt;
  }

  const normalized = normalizeXmlLogSlice(line.slice(start));
  return tryXmlPayload(normalized);
}

/**
 * Try JSON starting at every `{` / `[` in the line (left to right).
 * Returns the **largest** valid balanced fragment so a small object before a
 * big `Payload: [...]` array does not become the primary JSON target.
 */
function tryJsonEmbeddedPrimary(line: string, fromIdx: number): StructuredConsolePayload | null {
  let bestRaw: string | null = null;
  let bestParsed: unknown = null;
  for (let i = fromIdx; i < line.length; i++) {
    const c = line[i];
    if (c !== '{' && c !== '[') continue;
    const frag = extractBalancedJsonFragment(line, i);
    if (!frag || frag.length < 2) continue;
    const parsed = tryParseJsonCandidate(frag);
    if (parsed !== null && isJsonObjectOrArray(parsed)) {
      if (!bestRaw || frag.length > bestRaw.length) {
        bestRaw = frag;
        bestParsed = parsed;
      }
    }
  }
  if (!bestRaw || bestParsed === null) return null;
  return { kind: 'json', raw: bestRaw.trim(), formatted: formatJson(bestParsed) };
}

function formattedDedupeKey(formatted: string): string {
  return formatted.length > 120_000 ? formatted.slice(0, 120_000) : formatted;
}

function pushJsonTarget(
  targets: StructuredConsolePayload[],
  seenFormatted: Map<string, number>,
  raw: string,
  value: unknown,
  fromEscapedString: boolean | undefined,
  lineRange?: [number, number]
): boolean {
  const formatted = formatJson(value);
  const key = formattedDedupeKey(formatted);
  const existingIdx = seenFormatted.get(key);
  if (existingIdx !== undefined) {
    // Backfill `lineRange` onto the previously-pushed duplicate. Order of detection
    // is `walkStringsForNestedJson` (no range) → `tryJsonFromQuotedStringLiterals`
    // (has range), so the duplicate-from-the-literal-scan would otherwise be dropped
    // and we'd lose click-to-target mapping for nested payloads.
    if (lineRange && !targets[existingIdx]!.lineRange) {
      targets[existingIdx]!.lineRange = lineRange;
    }
    return false;
  }
  if (targets.length >= MAX_STRUCTURED_TARGETS) return false;
  seenFormatted.set(key, targets.length);
  targets.push({
    kind: 'json',
    raw: raw.trim(),
    formatted,
    ...(fromEscapedString ? { fromEscapedString: true } : {}),
    ...(lineRange ? { lineRange } : {})
  });
  return true;
}

function walkStringsForNestedJson(
  value: unknown,
  targets: StructuredConsolePayload[],
  seenFormatted: Map<string, number>,
  depth: number
): void {
  if (targets.length >= MAX_STRUCTURED_TARGETS || depth > MAX_NESTED_WALK_DEPTH) return;

  if (Array.isArray(value)) {
    for (const el of value) {
      if (typeof el === 'string') {
        const inner = jsonValueFromPossiblyWrappedString(el);
        if (inner != null && isJsonObjectOrArray(inner)) {
          if (pushJsonTarget(targets, seenFormatted, el.trim(), inner, true)) {
            walkStringsForNestedJson(inner, targets, seenFormatted, depth + 1);
          }
        }
      } else if (isJsonObjectOrArray(el)) {
        walkStringsForNestedJson(el, targets, seenFormatted, depth + 1);
      }
    }
    return;
  }

  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      const el = o[k];
      if (typeof el === 'string') {
        const inner = jsonValueFromPossiblyWrappedString(el);
        if (inner != null && isJsonObjectOrArray(inner)) {
          if (pushJsonTarget(targets, seenFormatted, el.trim(), inner, true)) {
            walkStringsForNestedJson(inner, targets, seenFormatted, depth + 1);
          }
        }
      } else if (isJsonObjectOrArray(el)) {
        walkStringsForNestedJson(el, targets, seenFormatted, depth + 1);
      }
    }
  }
}

/** A `"` that may begin a JSON string literal whose decoded text is JSON object/array. */
function couldBeginQuotedJsonLiteral(line: string, i: number): boolean {
  if (line[i] !== '"') return false;
  const j = i + 1;
  if (j >= line.length) return false;
  const c = line[j];
  if (c === '{' || c === '[') return true;
  if (c === '\\') return true;
  return false;
}

/** Slice one JSON `"..."` token starting at `start` (must be `"`), or null if unterminated / invalid. */
function sliceJsonDoubleQuotedToken(line: string, start: number): string | null {
  if (line[start] !== '"') return null;
  let esc = false;
  for (let k = start + 1; k < line.length; k++) {
    const c = line[k];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\') {
      esc = true;
      continue;
    }
    if (c === '"') return line.slice(start, k + 1);
  }
  return null;
}

/**
 * Find JSON documents that appear as JSON string literals (possibly multi-layer) anywhere on the line.
 * Covers "plain" escaped blobs without a wrapping `{` ... `}` line prefix.
 */
function tryJsonFromQuotedStringLiterals(
  line: string,
  targets: StructuredConsolePayload[],
  seenFormatted: Map<string, number>
): void {
  let probes = 0;
  for (let i = 0; i < line.length && probes < MAX_QUOTED_STRING_PROBES; i++) {
    if (!couldBeginQuotedJsonLiteral(line, i)) continue;
    probes++;
    const token = sliceJsonDoubleQuotedToken(line, i);
    if (!token) continue;
    const value = parseThroughJsonStringWrappers(token);
    if (!isJsonObjectOrArray(value)) continue;
    pushJsonTarget(targets, seenFormatted, token, value, true, [i, i + token.length]);
  }
}

function tryStandaloneThroughStringWrappers(line: string): {
  raw: string;
  value: unknown;
  fromEscapedString: boolean;
} | null {
  const t = line.trim();
  if (t.length < 4) return null;
  const v = parseThroughJsonStringWrappers(t);
  if (!isJsonObjectOrArray(v)) return null;
  return { raw: t, value: v, fromEscapedString: t[0] === '"' };
}

/**
 * If the line contains parseable JSON or XML, return viewer payloads (non-empty), else [].
 * JSON may be embedded after labels (e.g. `PayLoad: {"events":[...]}`), include JSON parsed from
 * string fields (escaped / nested), and JSON hidden inside quoted string literals on the line.
 *
 * Detection order:
 * 1) XML when the line has a declaration or known root (`<?xml`, `<VAST`, …) so nested JSON
 *    in CDATA does not steal the pill label.
 * 2) Embedded JSON (balanced `{`/`[` … `}`/`]`) plus nested JSON-in-string values from its parse tree.
 * 3) If (2) misses: whole-line JSON through string wrapper layers, then quoted-string literal scan.
 * 4) Generic first-`<` XML fragment (no strong marker; may be short snippets).
 */
export function detectStructuredConsoleLine(line: string): StructuredConsolePayload[] {
  if (!line || line.length > MAX_LINE_LEN) return [];

  const i0 = firstNonSpaceIndex(line);
  if (i0 < 0) return [];

  const xmlStrong = tryXmlFromStrongMarkers(line);
  if (xmlStrong) return [xmlStrong];

  const targets: StructuredConsolePayload[] = [];
  const seenFormatted = new Map<string, number>();

  const embedded = tryJsonEmbeddedPrimary(line, i0);
  if (embedded) {
    const parsed = tryParseJsonCandidate(embedded.raw);
    if (parsed !== null && isJsonObjectOrArray(parsed)) {
      pushJsonTarget(targets, seenFormatted, embedded.raw, parsed, false);
      walkStringsForNestedJson(parsed, targets, seenFormatted, 0);
    }
  } else {
    const stand = tryStandaloneThroughStringWrappers(line);
    if (stand) {
      pushJsonTarget(targets, seenFormatted, stand.raw, stand.value, stand.fromEscapedString);
    }
  }

  tryJsonFromQuotedStringLiterals(line, targets, seenFormatted);

  if (targets.length > 0) return targets;

  const lt = line.indexOf('<', i0);
  if (lt >= 0) {
    const xml = tryXmlPayload(normalizeXmlLogSlice(line.slice(lt)));
    if (xml) return [xml];
  }

  return [];
}

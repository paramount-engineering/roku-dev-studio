import type { NetworkHttpMessage, ParsedNetworkEvent } from '@shared/network-inspector/types';
import { escapeHtml } from '../../modules/utils/dom.js';
import {
  buildEmbeddedBodyHtml,
  clearEmbeddedStructured,
  type EmbeddedPane
} from './network-embedded-structured.js';
import { MAX_STRUCTURED_BYTES, renderStructuredInto } from '../../modules/ui/structured-body.js';
import { renderResponseCookiesPane } from './network-parsed-tables.js';
import { S } from '@shared/strings/index.js';

export type BodyFormatMode = 'auto' | 'json' | 'xml' | 'raw';
export type RequestPaneTab = 'overview' | 'headers' | 'body';
export type ResponsePaneTab = 'headers' | 'cookies' | 'body';

type ResolvedBodyFormat = 'json' | 'xml' | 'raw';

function contentType(msg: NetworkHttpMessage | undefined): string {
  const fromHeaders = msg?.headers
    ? (msg.headers['content-type'] || msg.headers['Content-Type'] || msg.headers['contenttype'] || '')
    : '';
  // Headers (only present once the full detail is loaded) carry the precise value incl. charset;
  // the list summary carries a bare `contentType` so Overview can render before detail loads.
  return (fromHeaders || msg?.contentType || '').toLowerCase();
}

function looksLikeJson(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

// Any body that opens with a tag is treated as markup and routed through the XML pretty-printer.
// This includes HTML (`<!doctype html>`, `<html>`, `<meta>` …), which isn't well-formed XML — the
// renderer falls back to a lenient reindent so markup still formats instead of showing as one line.
function looksLikeMarkup(body: string): boolean {
  return body.trim().startsWith('<');
}

export function inferDetectedBodyFormat(msg: NetworkHttpMessage | undefined): ResolvedBodyFormat {
  if (!msg?.body?.trim()) return 'raw';
  const ct = contentType(msg);
  if (ct.includes('json') || looksLikeJson(msg.body)) return 'json';
  if (ct.includes('xml') || ct.includes('+xml') || ct.includes('html') || looksLikeMarkup(msg.body)) {
    return 'xml';
  }
  return 'raw';
}

export function resolveBodyFormat(
  mode: BodyFormatMode,
  msg: NetworkHttpMessage | undefined
): ResolvedBodyFormat {
  if (mode === 'auto') return inferDetectedBodyFormat(msg);
  if (mode === 'json') return 'json';
  if (mode === 'xml') return 'xml';
  return 'raw';
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} bytes`;
  return `${(bytes / 1024).toFixed(2)} KB (${bytes} bytes)`;
}

/** Format a millisecond duration for display: whole ms below 1 s, then seconds (2 dp) above. */
function formatMs(ms: number): string {
  const rounded = Math.round(ms);
  if (rounded >= 1000) return S.networkInspector.wfSeconds(ms / 1000);
  return S.networkInspector.wfMs(rounded);
}

/**
 * Render an ISO capture timestamp as "UTC · local". Both come from Intl with the short time-zone
 * name, so "UTC" / "PDT" / "GMT+5:30" label themselves (no catalog strings needed). The stored
 * `ev.timestamp` is UTC (ISO `…Z`); we surface that explicitly and add the viewer's local time.
 * Returns the raw string if it doesn't parse, or '—' when absent.
 */
function formatStartTimes(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  };
  const utc = d.toLocaleString(undefined, { ...opts, timeZone: 'UTC' });
  const local = d.toLocaleString(undefined, opts);
  return `${utc}  ·  ${local}`;
}

function formatHeaders(msg: NetworkHttpMessage | undefined): string {
  if (!msg) return '(no data)';
  const lines: string[] = [];
  if (msg.method && msg.url) lines.push(`${msg.method} ${msg.url}`);
  if (msg.statusCode != null) {
    lines.push(`HTTP/1.1 ${msg.statusCode}${msg.statusText ? ` ${msg.statusText}` : ''}`);
  }
  if (msg.headers) {
    for (const [k, v] of Object.entries(msg.headers)) lines.push(`${k}: ${v}`);
  }
  return lines.join('\n') || '(no headers)';
}

// Above this size we skip JSON.parse / syntax highlighting / XML pretty-printing, which
// are O(n) (or worse) over the whole string and produce a huge DOM. The FULL body is still
// shown — as raw (chunked) text rather than a structured tree — so nothing is hidden. Shares the
// single shared-renderer threshold (`MAX_STRUCTURED_BYTES`) so a JSON/XML body renders as a tree at
// the same size here as in ECP / App Connector, rather than a stricter Network-only cap.
const MAX_FORMAT_BYTES = MAX_STRUCTURED_BYTES;

// Per-pane "large body" state, so network-tab can surface it as a header badge instead of an inline
// note. `kb === 0` = not large / not applicable. Set when the raw-text large-body path renders;
// cleared at the top of every `renderBodyContent`. `downgraded` distinguishes a forced raw render
// from a structured view (JSON/XML) vs a natively-raw body, so the badge tooltip stays honest.
type LargeBodyState = { kb: number; downgraded: boolean };
const largeBody: { request: LargeBodyState; response: LargeBodyState } = {
  request: { kb: 0, downgraded: false },
  response: { kb: 0, downgraded: false }
};

/** KB size to show on the "Large Body" header badge for `pane`, or 0 when it doesn't apply. */
export function getLargeBodyKb(pane: EmbeddedPane): number {
  return largeBody[pane].kb;
}

/** True when the large body is a *downgrade* — size forced raw text where we'd otherwise have built
 *  a collapsible JSON/XML tree. False for natively-raw bodies (JS / CSS / HTML / plain text, or
 *  user-selected Raw), where raw text is the expected rendering and nothing was traded for speed. */
export function getLargeBodyDowngraded(pane: EmbeddedPane): boolean {
  return largeBody[pane].downgraded;
}

const MIME_RE = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/;

function mediaMime(msg: NetworkHttpMessage): string {
  const mime = contentType(msg).split(';')[0].trim();
  return MIME_RE.test(mime) ? mime : '';
}

// Decoded body size in bytes. base64 bodies carry ~4/3 the chars of their raw bytes, so
// reporting `body.length` directly overstates binary payloads (images, video) by a third.
function bodyByteSize(msg: NetworkHttpMessage | undefined): number {
  if (!msg) return 0;
  if (msg.body) {
    if (msg.bodyEncoding === 'base64') return Math.floor((msg.body.length * 3) / 4);
    return new TextEncoder().encode(msg.body).length;
  }
  // Summary (no loaded body): trust the precomputed decoded size from the capture side.
  return msg.bodyBytes ?? 0;
}

// Renders a preview for binary (base64) bodies: <img>/<video>/<audio> for media types,
// otherwise a "not previewable" note. Returns null for text bodies so callers fall through.
function renderMediaPreview(msg: NetworkHttpMessage | undefined): string | null {
  if (msg?.bodyEncoding !== 'base64' || !msg.body) return null;
  const mime = mediaMime(msg);
  const approxBytes = bodyByteSize(msg);
  if (msg.bodyTruncated) {
    return `<div class="ni-body-large-note">${S.networkInspector.binaryTruncatedNote(escapeHtml(mime || S.networkInspector.mimeContent))}</div>`;
  }
  const dataUrl = `data:${mime || 'application/octet-stream'};base64,${msg.body}`;
  const caption = `<div class="ni-media-caption">${escapeHtml(mime || S.networkInspector.mimeBinary)} · ${formatBytes(approxBytes)}</div>`;
  if (mime.startsWith('image/')) {
    return `<div class="ni-media-wrap"><img class="ni-media-el ni-media-img" src="${dataUrl}" alt="${S.networkInspector.responseImageAlt}" />${caption}</div>`;
  }
  if (mime.startsWith('video/')) {
    return `<div class="ni-media-wrap"><video class="ni-media-el" src="${dataUrl}" controls preload="metadata"></video>${caption}</div>`;
  }
  if (mime.startsWith('audio/')) {
    return `<div class="ni-media-wrap"><audio class="ni-media-audio" src="${dataUrl}" controls preload="metadata"></audio>${caption}</div>`;
  }
  return `<div class="ni-pane-empty">${S.networkInspector.binaryNotPreviewable(escapeHtml(mime || S.networkInspector.mimeUnknownType), formatBytes(approxBytes))}</div>`;
}

// Very large bodies are split into line-chunks so the browser can paint only the
// chunks near the viewport (content-visibility) and skip the rest. Rendering one
// monolithic <pre> for a multi-thousand-line body means Chromium has to rasterize
// huge tiles as you scroll, which checker-boards blank for a moment before the text
// appears. Chunking keeps each raster unit small so scrolling stays smooth, while
// the content is still fully present (no lazy fetch, no spinner).
const CHUNK_LINES = 100;
// Below this many lines a single <pre> paints instantly — don't chunk (avoids any
// scrollbar-estimate jitter for the common small/medium body).
const CHUNK_MIN_LINES = 400;
// Rough px per logical line (12px font · 1.45 line-height ≈ 17.4). Only used as the
// pre-paint size estimate; `auto` makes the browser remember the real size after the
// chunk is first rendered, so a slight under/over-estimate self-corrects.
const APPROX_LINE_PX = 18;

// Wrap already-escaped/highlighted inner HTML in a <pre>, chunking when large. The
// inner HTML must use real "\n" line separators (true for our JSON/XML/raw output);
// chunk spans are display:block so the block boundary reproduces each chunk-edge
// newline without adding blank lines.
function codeBlockHtml(innerHtml: string, extraClass = ''): string {
  const cls = `ni-code-block${extraClass ? ` ${extraClass}` : ''}`;
  if (innerHtml.indexOf('\n') === -1) return `<pre class="${cls}">${innerHtml}</pre>`;
  const lines = innerHtml.split('\n');
  if (lines.length < CHUNK_MIN_LINES) return `<pre class="${cls}">${innerHtml}</pre>`;
  let chunks = '';
  for (let i = 0; i < lines.length; i += CHUNK_LINES) {
    const count = Math.min(CHUNK_LINES, lines.length - i);
    const slice = lines.slice(i, i + CHUNK_LINES).join('\n');
    chunks += `<span class="ni-code-chunk" style="contain-intrinsic-size:auto ${count * APPROX_LINE_PX}px">${slice}</span>`;
  }
  return `<pre class="${cls} ni-code-chunked">${chunks}</pre>`;
}

// Placeholder for a foldable JSON/XML body. Holds the RAW body (escaped) so the upgrade pass can
// read it back via textContent and hand it to the shared `renderStructuredInto` (which pretty-prints
// + highlights + folds). Uses `.ni-code-block` so word-wrap / nowrap toggling apply uniformly.
function structuredBodyHtml(kind: 'json' | 'xml', body: string): string {
  return `<pre class="ni-code-block" data-ni-fold="${kind}" tabindex="0">${escapeHtml(body)}</pre>`;
}

/** Render a raw (non-structured) body, wrapping any JSON/XML fragments embedded in the text as
 *  clickable highlights (opens the shared formatted viewer). Falls back to the plain chunked code
 *  block when nothing is embedded (or the body is too large to scan). */
function renderRawBody(body: string, pane: EmbeddedPane): string {
  // Drop trailing newline(s) so the <pre> doesn't render a stray blank last line (a body that
  // ends in "\n" otherwise splits into a final empty line).
  body = body.replace(/[\r\n]+$/, '');
  const embedded = buildEmbeddedBodyHtml(body, pane);
  if (embedded.count > 0) {
    // Single (un-chunked) <pre> so embedded spans can't straddle a chunk boundary; only bodies
    // small enough to scan reach here, so a single block paints fine.
    return `<pre class="ni-code-block ni-code-embedded">${embedded.html}</pre>`;
  }
  return codeBlockHtml(escapeHtml(body));
}

function renderBodyContent(
  msg: NetworkHttpMessage | undefined,
  mode: BodyFormatMode,
  fallback: string,
  pane: EmbeddedPane
): string {
  // Clear stale embedded payloads + large-body state for this pane up front; the raw paths below
  // repopulate them.
  clearEmbeddedStructured(pane);
  largeBody[pane] = { kb: 0, downgraded: false };
  if (!msg?.body?.trim()) {
    return `<div class="ni-pane-empty">${escapeHtml(fallback)}</div>`;
  }
  // Media (<img>/<video>/<audio>) previews are an Auto-mode affordance only. When the
  // user explicitly picks Raw/JSON/XML they want the underlying bytes (e.g. the base64
  // string for binary payloads), not the rendered asset.
  if (mode === 'auto') {
    const media = renderMediaPreview(msg);
    if (media) return media;
  }
  // Note: the "body truncated during capture" indicator is surfaced as a centered badge in the
  // pane header (toggled by network-tab from `bodyTruncated`), not inline here, so it stays visible
  // regardless of how far the body is scrolled.
  if (msg.body.length > MAX_FORMAT_BYTES) {
    // We already hold the whole captured body, so show ALL of it — never a truncated head. Only the
    // expensive structured rendering (JSON.parse + syntax highlight + fold tree, which can explode
    // into millions of DOM nodes) is skipped above this size; the full body is rendered as raw text
    // with embedded JSON/XML fragments still made clickable. The "large body" notice is surfaced as
    // a header badge by network-tab (via `getLargeBodyKb`), not inline here.
    largeBody[pane] = {
      kb: Math.round(msg.body.length / 1024),
      // Only a *downgrade* when we'd otherwise have built a JSON/XML tree (auto-detected structured,
      // or the user explicitly picked JSON/XML). A natively-raw body (JS/CSS/text, or Raw mode) loses
      // nothing to size, so the badge must not claim a performance trade-off for it.
      downgraded: resolveBodyFormat(mode, msg) !== 'raw'
    };
    return renderRawBody(msg.body, pane);
  }
  const resolved = resolveBodyFormat(mode, msg);
  // For JSON/XML (already gated to ≤256 KB above), emit a placeholder carrying the RAW body. A
  // post-render pass in network-tab (`upgradeStructuredBodies`) hands it to the shared
  // `renderStructuredInto`, which pretty-prints + builds the collapsible, syntax-highlighted tree —
  // the same renderer the Console viewer and ECP/App Connector use. (The whole body is the
  // structure here, so no embedded-fragment highlighting applies.)
  if (resolved === 'json') {
    return structuredBodyHtml('json', msg.body);
  }
  if (resolved === 'xml') {
    return structuredBodyHtml('xml', msg.body);
  }
  // Plain text body: highlight any JSON/XML nested inside it.
  return renderRawBody(msg.body, pane);
}

function renderHeadersTable(msg: NetworkHttpMessage | undefined): string {
  if (!msg?.headers || Object.keys(msg.headers).length === 0) {
    return `<div class="ni-pane-empty">${S.networkInspector.noHeaders}</div>`;
  }
  const statusLine =
    msg.statusCode != null
      ? `HTTP/1.1 ${msg.statusCode}${msg.statusText ? ` ${msg.statusText}` : ''}`
      : msg.method && msg.url
        ? `${msg.method} ${msg.url}`
        : '';
  const rows: string[] = [];
  if (statusLine) {
    rows.push(`<tr><th>${S.networkInspector.statusLine}</th><td>${escapeHtml(statusLine)}</td></tr>`);
  }
  for (const [k, v] of Object.entries(msg.headers)) {
    rows.push(`<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`);
  }
  return `<div class="ni-overview-scroll"><table class="ni-overview-table">${rows.join('')}</table></div>`;
}

function relatedDns(events: ParsedNetworkEvent[], ev: ParsedNetworkEvent): ParsedNetworkEvent[] {
  const host = (ev.hostname || ev.sni || '').toLowerCase();
  if (!host) return [];
  return events.filter(
    (e) =>
      e.id !== ev.id &&
      (e.type === 'dns-query' || e.type === 'dns-response') &&
      (e.hostname || '').toLowerCase() === host
  );
}

function requestStatusLabel(ev: ParsedNetworkEvent): string {
  const code = ev.httpResponse?.statusCode;
  if (code === 0) return S.networkInspector.statusPending;
  if (code == null) return '—';
  if (code >= 200 && code < 400) return S.networkInspector.statusComplete;
  if (code >= 400) return S.networkInspector.statusFailed;
  return S.networkInspector.statusComplete;
}

function remoteAddress(ev: ParsedNetworkEvent): string {
  if (ev.httpRequest?.url) {
    try {
      const u = new URL(ev.httpRequest.url);
      const port = u.port || (u.protocol === 'https:' ? '443' : '80');
      return `${u.hostname}:${port}`;
    } catch {
      /* fall through */
    }
  }
  const host = ev.hostname || ev.sni || ev.destIp || '—';
  const port = ev.destPort ?? (ev.mitm || ev.type === 'tls-handshake' ? 443 : '');
  return port ? `${host}:${port}` : host;
}

function overviewRow(name: string, value: string, valueClass = ''): string {
  const cls = valueClass ? ` class="${valueClass}"` : '';
  return `<tr><th>${escapeHtml(name)}</th><td${cls}>${escapeHtml(value)}</td></tr>`;
}

function isInspectableUrl(url: string): boolean {
  const t = url.trim();
  if (!t || t === '—') return false;
  return (
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.includes('?') ||
    t.startsWith('/')
  );
}

function overviewUrlRow(url: string): string {
  const display = url || '—';
  if (!isInspectableUrl(display)) return overviewRow(S.networkInspector.ovUrl, display);
  return `<tr><th>${S.networkInspector.ovUrl}</th><td><button type="button" class="ni-overview-url-link" data-ni-url="${escapeHtml(display)}" title="${S.networkInspector.viewUrlTitle}">${escapeHtml(display)}</button></td></tr>`;
}

function overviewSection(title: string): string {
  return `<tr class="ni-overview-section"><th colspan="2">${escapeHtml(title)}</th></tr>`;
}

/**
 * The Overview timing waterfall: a proportional segmented bar (one color per measured RDS→origin
 * phase) plus a wrapping legend of phase name + rounded ms. Rendered as a `.ni-waterfall` block that
 * lives in the pinned bottom footer (see {@link overviewPinned}), NOT as a table row. Returns ''
 * when `ev.timing` is absent (passive/encrypted capture, mock/block/reset emits) — the pinned footer
 * is then omitted entirely (the per-request Note now lives in a header-opened modal, not inline). The
 * phase list is assembled here — not a module-level const — so it always reads the current locale's
 * strings instead of freezing them at module load.
 */
function renderTimingWaterfall(ev: ParsedNetworkEvent): string {
  const t = ev.timing;
  if (!t) return '';
  const phases: Array<{ ms: number; label: string; cls: string }> = [];
  const add = (ms: number | undefined, label: string, cls: string): void => {
    if (typeof ms === 'number' && ms >= 0) phases.push({ ms, label, cls });
  };
  add(t.dnsMs, S.networkInspector.wfDns, 'ni-wf-dns');
  add(t.connectMs, S.networkInspector.wfConnect, 'ni-wf-connect');
  add(t.tlsMs, S.networkInspector.wfTls, 'ni-wf-tls');
  add(t.sendMs, S.networkInspector.wfSend, 'ni-wf-send');
  add(t.waitMs, S.networkInspector.wfWait, 'ni-wf-wait');
  add(t.receiveMs, S.networkInspector.wfReceive, 'ni-wf-receive');
  if (phases.length === 0) return '';
  const total = phases.reduce((sum, p) => sum + p.ms, 0);
  // Every phase is kept (min-width:1px in CSS keeps tiny segments visible). When the summed total
  // rounds to 0 (all sub-ms), split segment widths evenly so the bar still renders.
  const evenPct = 100 / phases.length;
  const segs = phases
    .map((p) => {
      const width = total > 0 ? (p.ms / total) * 100 : evenPct;
      const title = escapeHtml(S.networkInspector.wfSegmentTitle(p.label, formatMs(p.ms)));
      return `<span class="ni-wf-seg ${p.cls}" style="width:${width.toFixed(4)}%" title="${title}"></span>`;
    })
    .join('');
  const legend = phases
    .map(
      (p) =>
        `<span class="ni-wf-legend-item"><span class="ni-wf-swatch ${p.cls}"></span>${escapeHtml(p.label)} <span class="ni-wf-legend-ms">${escapeHtml(formatMs(p.ms))}</span></span>`
    )
    .join('');
  // Total shown = the SAME authoritative round-trip as the Overview "Duration" row (ev.durationMs), so
  // the two never disagree. It can exceed the summed phases: durationMs spans the whole proxy handling
  // window (request setup → response emit) whereas the phases cover only the RDS→origin socket
  // (DNS → last byte); the remainder is proxy overhead + per-phase rounding. Segment WIDTHS stay
  // proportional to the measured phases (`total`); only the displayed number uses durationMs. Falls
  // back to the phase sum when durationMs is absent.
  const totalMs = typeof ev.durationMs === 'number' ? ev.durationMs : total;
  const totalItem = `<span class="ni-wf-legend-item ni-wf-total">${escapeHtml(S.networkInspector.ovTotal)} <span class="ni-wf-legend-ms">${escapeHtml(formatMs(totalMs))}</span></span>`;
  // Combined timing model: the Request Start (UTC · local) sits above the bar so the pinned footer
  // carries the whole story — start → phase breakdown → Total (= duration).
  const started = ev.timestamp
    ? `<div class="ni-wf-started"><span class="ni-wf-started-label">${escapeHtml(S.networkInspector.ovRequestStart)}</span>${escapeHtml(formatStartTimes(ev.timestamp))}</div>`
    : '';
  return `<div class="ni-waterfall">${started}<div class="ni-waterfall-bar" role="img" aria-label="${escapeHtml(S.networkInspector.wfAria)}">${segs}</div><div class="ni-waterfall-legend">${legend}${totalItem}</div></div>`;
}

// The request Overview's pinned bottom footer: just the timing waterfall. Rendered as a NON-scrolling
// footer (`.ni-overview-pinned`, `flex: 0 0 auto`) that sits OUTSIDE the scrolling table region as a
// flow sibling — see {@link overviewLayout} and the flex-column `.ni-contents-scroll` CSS in
// index.html. When there is no timing data (`waterfall` is '' for non-proxied/encrypted rows) the
// footer is omitted entirely. The per-request Note now lives in a header-opened modal (see
// network-note-modal.ts), not inline here.
function overviewPinned(waterfall: string): string {
  return waterfall ? `<div class="ni-overview-pinned">${waterfall}</div>` : '';
}

// Compose a request Overview pane: a scrolling table region (`.ni-overview-scroll` — owns the vertical
// scrollbar) followed by the pinned footer as a flow sibling. Their shared parent `.ni-contents-scroll`
// is a flex column, so the inner scroller flexes to fill the space above the fixed-height footer and the
// scrollbar is confined to the rows above it, while the footer stays put at the pane bottom. With no
// timing data the footer is absent and the scrolling table simply fills the pane.
function overviewLayout(rowsHtml: string, waterfall: string): string {
  return `<div class="ni-overview-scroll"><table class="ni-overview-table">${rowsHtml}</table></div>${overviewPinned(waterfall)}`;
}

function buildHttpsRequestFallback(ev: ParsedNetworkEvent): string {
  const host = ev.sni || ev.hostname || ev.destIp || S.networkInspector.unknownHost;
  const port = ev.destPort === 443 ? '' : `:${ev.destPort ?? 443}`;
  return S.networkInspector.httpsRequestFallback(host, port);
}

function buildHttpsResponseFallback(ev: ParsedNetworkEvent): string {
  if (ev.mitm) return S.networkInspector.noResponseBodyCaptured;
  return S.networkInspector.httpsResponseEncrypted;
}

export function renderRequestOverview(ev: ParsedNetworkEvent, allEvents: ParsedNetworkEvent[]): string {
  if (ev.type !== 'http-transaction') {
    const rows = [
      overviewRow(S.networkInspector.ovType, ev.type),
      overviewRow(S.networkInspector.ovTime, ev.timestamp || '—'),
      overviewRow(S.networkInspector.ovDevice, ev.deviceIp, 'device-ip'),
      overviewRow(S.networkInspector.ovHost, ev.hostname || ev.sni || '—'),
      overviewRow(S.networkInspector.ovDestination, ev.destIp ? `${ev.destIp}:${ev.destPort ?? ''}` : '—')
    ];
    // Non-HTTP rows have no timing, so there is no pinned footer.
    return overviewLayout(rows.join(''), '');
  }

  const req = ev.httpRequest;
  const res = ev.httpResponse;
  const reqCt = contentType(req) || '—';
  const resCt = contentType(res) || '—';
  const reqSize = bodyByteSize(req);
  const resSize = bodyByteSize(res);
  const rows: string[] = [
    overviewUrlRow(req?.url || '—'),
    overviewRow(S.networkInspector.ovStatus, requestStatusLabel(ev)),
    overviewRow(S.networkInspector.ovResponseCode, res?.statusCode != null ? `${res.statusCode} ${res.statusText || ''}`.trim() : '—'),
    overviewRow(S.networkInspector.ovProtocol, ev.mitm ? 'HTTP/1.1 (MITM)' : 'HTTP/1.1'),
    overviewRow(S.networkInspector.ovMethod, req?.method || '—'),
    overviewRow(S.networkInspector.requestContentType, reqCt),
    overviewRow(S.networkInspector.responseContentType, resCt),
    overviewRow(S.networkInspector.ovClientAddress, ev.deviceIp || '—', 'device-ip'),
    overviewRow(S.networkInspector.ovRemoteAddress, remoteAddress(ev))
  ];
  // A replayed transaction is labeled "Replayed" (the request came from the host, not the device);
  // otherwise a decrypted-HTTPS capture shows the MITM tag.
  if (ev.replay) rows.push(overviewRow(S.networkInspector.ovTags, S.networkInspector.tagsReplayed));
  else if (ev.mitm) rows.push(overviewRow(S.networkInspector.ovTags, S.networkInspector.tagsMitmDecrypted));
  const dns = relatedDns(allEvents, ev);
  if (dns.length > 0) {
    rows.push(
      overviewRow(
        S.networkInspector.ovDns,
        dns
          .map((d) =>
            d.type === 'dns-response'
              ? `${d.hostname} → ${(d.resolvedIps || []).join(', ')}`
              : S.networkInspector.dnsQueryValue(d.hostname || '')
          )
          .join('; ')
      )
    );
  }

  rows.push(overviewSection(S.networkInspector.secTls));
  if (ev.mitm) {
    rows.push(overviewRow(S.networkInspector.ovProtocol, S.networkInspector.protocolHttpsDecrypted));
    rows.push(overviewRow(S.networkInspector.ovNotes, S.networkInspector.notesProxied));
  } else {
    rows.push(overviewRow(S.networkInspector.ovProtocol, ev.destPort === 443 || req?.url?.startsWith('https') ? S.networkInspector.protocolHttpsEncrypted : 'HTTP'));
    rows.push(overviewRow(S.networkInspector.ovNotes, S.networkInspector.notesHotspot));
  }

  // Timing: when phase marks exist, the full timing model (Request Start + phases + Total = duration)
  // lives in the pinned waterfall footer, so the redundant section is omitted here. Without marks (no
  // waterfall) keep Request Start (UTC + local) and Duration inline.
  if (!ev.timing) {
    rows.push(overviewSection(S.networkInspector.secTiming));
    rows.push(overviewRow(S.networkInspector.ovRequestStart, formatStartTimes(ev.timestamp)));
    rows.push(
      overviewRow(
        S.networkInspector.ovDuration,
        typeof ev.durationMs === 'number' ? formatMs(ev.durationMs) : '—'
      )
    );
  }

  rows.push(overviewSection(S.networkInspector.secSize));
  rows.push(overviewRow(S.networkInspector.request, formatBytes(reqSize)));
  rows.push(overviewRow(S.networkInspector.response, formatBytes(resSize)));
  rows.push(overviewRow(S.networkInspector.ovTotal, formatBytes(reqSize + resSize)));

  // Request headers now live in the dedicated request "Headers" tab, not inline in the Overview.

  // The per-phase timing waterfall (empty when ev.timing is absent — graceful omit) sits in the
  // pinned footer below the scrolling Overview table.
  return overviewLayout(rows.join(''), renderTimingWaterfall(ev));
}

export function renderRequestPane(
  ev: ParsedNetworkEvent,
  tab: RequestPaneTab,
  bodyFormat: BodyFormatMode,
  allEvents: ParsedNetworkEvent[] = []
): string {
  // The Headers tab is HTTP-message-driven; handling it ahead of the tls/dns branches means a
  // non-HTTP row (which has no httpRequest) falls straight through to the headers table's empty
  // state. Reuses the same headers-table renderer as the response pane.
  if (tab === 'headers') return renderHeadersTable(ev.httpRequest);
  if (ev.type === 'tls-handshake' || (ev.type === 'tcp-connection' && ev.destPort === 443)) {
    if (tab === 'overview') {
      return overviewLayout(
        `${overviewRow(S.networkInspector.ovHost, ev.sni || ev.hostname || '—')}${overviewRow(S.networkInspector.ovType, S.networkInspector.typeHttpsTlsHandshake)}${overviewRow(S.networkInspector.ovDevice, ev.deviceIp, 'device-ip')}`,
        ''
      );
    }
    return `<pre class="ni-code-block">${escapeHtml(buildHttpsRequestFallback(ev))}</pre>`;
  }
  if (ev.type === 'dns-query' || ev.type === 'dns-response') {
    if (tab === 'overview') {
      return renderRequestOverview(ev, allEvents);
    }
    return `<pre class="ni-code-block">${escapeHtml(S.networkInspector.dnsBody(ev.type === 'dns-query', ev.hostname || '—'))}</pre>`;
  }
  if (tab === 'overview') return renderRequestOverview(ev, allEvents);
  return renderBodyContent(ev.httpRequest, bodyFormat, S.networkInspector.noRequestBody, 'request');
}

export function renderResponsePane(
  ev: ParsedNetworkEvent,
  tab: ResponsePaneTab,
  bodyFormat: BodyFormatMode
): string {
  // Handled ahead of the tls/dns branches (see renderRequestPane) so non-HTTP rows show the empty
  // state rather than the encrypted/DNS fallbacks.
  if (tab === 'cookies') return renderResponseCookiesPane(ev.httpResponse);
  if (ev.type === 'tls-handshake' || (ev.type === 'tcp-connection' && ev.destPort === 443)) {
    if (tab === 'headers') return `<div class="ni-pane-empty">${S.networkInspector.encryptedNoHeaders}</div>`;
    return `<pre class="ni-code-block">${escapeHtml(buildHttpsResponseFallback(ev))}</pre>`;
  }
  if (ev.type === 'dns-query' || ev.type === 'dns-response') {
    if (tab === 'headers') return `<div class="ni-pane-empty">${S.networkInspector.dnsNoHeaders}</div>`;
    const ips = (ev.resolvedIps || []).join('\n');
    return `<pre class="ni-code-block">${escapeHtml(ev.type === 'dns-response' ? `;; ANSWER\n${ips || S.networkInspector.dnsAnswerEmpty}` : S.networkInspector.dnsPending)}</pre>`;
  }
  if (tab === 'headers') return renderHeadersTable(ev.httpResponse);
  const code = ev.httpResponse?.statusCode;
  const fallback =
    code === 0 ? S.networkInspector.waitingForResponse : code == null ? S.networkInspector.noResponseBody : S.networkInspector.emptyResponseBody;
  return renderBodyContent(ev.httpResponse, bodyFormat, fallback, 'response');
}

/**
 * Turn each `[data-ni-fold]` placeholder emitted by {@link renderBodyContent} into the shared
 * collapsible, syntax-highlighted JSON/XML tree — the same renderer the Console viewer uses. Call
 * once after a body's innerHTML is set. Idempotent (guarded by `data-ni-fold-ready`). Both the live
 * Network Inspector and the standalone Session Viewer call this, so it lives here next to the
 * placeholder producer.
 */
export function upgradeStructuredBodies(bodyEl: Element | null): void {
  if (!(bodyEl instanceof HTMLElement)) return;
  bodyEl.querySelectorAll('[data-ni-fold]').forEach((el) => {
    if (!(el instanceof HTMLElement) || el.dataset.niFoldReady === '1') return;
    const kind = el.dataset.niFold;
    if (kind !== 'json' && kind !== 'xml') return;
    renderStructuredInto(el, el.textContent || '', { kind });
    el.dataset.niFoldReady = '1';
  });
}


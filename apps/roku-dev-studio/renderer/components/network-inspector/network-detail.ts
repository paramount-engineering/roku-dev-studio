import type { NetworkHttpMessage, ParsedNetworkEvent } from '../../../shared/network-inspector/types';
import { escapeHtml } from '../../modules/utils/dom.js';

export type BodyFormatMode = 'auto' | 'json' | 'xml' | 'raw';
export type RequestPaneTab = 'overview' | 'body';
export type ResponsePaneTab = 'headers' | 'body';

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

function looksLikeXml(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.startsWith('<') && !trimmed.startsWith('<!');
}

export function inferDetectedBodyFormat(msg: NetworkHttpMessage | undefined): ResolvedBodyFormat {
  if (!msg?.body?.trim()) return 'raw';
  const ct = contentType(msg);
  if (ct.includes('json') || looksLikeJson(msg.body)) return 'json';
  if (ct.includes('xml') || ct.includes('+xml') || looksLikeXml(msg.body)) return 'xml';
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

function prettyXml(xml: string): string {
  const trimmed = xml.trim();
  if (!trimmed) return trimmed;
  try {
    const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
    if (doc.querySelector('parsererror')) return trimmed;
    const serializer = new XMLSerializer();
    const raw = serializer.serializeToString(doc.documentElement);
    const lines = raw.replace(/(>)(<)(\/*)/g, '$1\n$2$3').split('\n');
    let pad = 0;
    return lines
      .map((line) => {
        const t = line.trim();
        if (!t) return '';
        if (t.match(/^<\//)) pad = Math.max(0, pad - 1);
        const indented = `${'  '.repeat(pad)}${t}`;
        if (t.match(/^<[^!?][^>]*[^/]>/) && !t.includes('</')) pad += 1;
        return indented;
      })
      .filter(Boolean)
      .join('\n');
  } catch {
    return trimmed;
  }
}

function formatBodyText(msg: NetworkHttpMessage | undefined, format: ResolvedBodyFormat): string {
  if (!msg?.body) return '';
  const body = msg.body;
  if (format === 'json') {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  if (format === 'xml') return prettyXml(body);
  return body;
}

function highlightJsonText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      (match, _q, colon) => {
        if (colon) return `<span class="ni-json-key">${match}</span>`;
        if (/^"/.test(match)) return `<span class="ni-json-string">${match}</span>`;
        if (/^(true|false|null)$/.test(match)) return `<span class="ni-json-lit">${match}</span>`;
        return `<span class="ni-json-num">${match}</span>`;
      }
    );
}

// Above this size we skip JSON.parse / syntax highlighting / XML pretty-printing, which
// are O(n) (or worse) over the whole string and produce a huge DOM. The raw head is shown
// instead; the Copy button still yields the full body straight from the event model.
const MAX_FORMAT_BYTES = 256 * 1024;

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
    return `<div class="ni-body-large-note">Binary ${escapeHtml(mime || 'content')} was truncated during capture — preview unavailable. Use Copy for the captured base64.</div>`;
  }
  const dataUrl = `data:${mime || 'application/octet-stream'};base64,${msg.body}`;
  const caption = `<div class="ni-media-caption">${escapeHtml(mime || 'binary')} · ${formatBytes(approxBytes)}</div>`;
  if (mime.startsWith('image/')) {
    return `<div class="ni-media-wrap"><img class="ni-media-el ni-media-img" src="${dataUrl}" alt="Response image preview" />${caption}</div>`;
  }
  if (mime.startsWith('video/')) {
    return `<div class="ni-media-wrap"><video class="ni-media-el" src="${dataUrl}" controls preload="metadata"></video>${caption}</div>`;
  }
  if (mime.startsWith('audio/')) {
    return `<div class="ni-media-wrap"><audio class="ni-media-audio" src="${dataUrl}" controls preload="metadata"></audio>${caption}</div>`;
  }
  return `<div class="ni-pane-empty">Binary content (${escapeHtml(mime || 'unknown type')}, ~${formatBytes(approxBytes)}) — not previewable. Use Copy for the captured base64.</div>`;
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

function renderBodyContent(
  msg: NetworkHttpMessage | undefined,
  mode: BodyFormatMode,
  fallback: string
): string {
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
  const truncatedNote = msg.bodyTruncated
    ? `<div class="ni-body-large-note">Body was truncated during capture.</div>`
    : '';
  if (msg.body.length > MAX_FORMAT_BYTES) {
    const kb = Math.round(msg.body.length / 1024);
    const head = msg.body.slice(0, MAX_FORMAT_BYTES);
    return (
      `<div class="ni-body-large-note">Large body (${kb} KB) — showing the first 256 KB as raw text for performance. Use Copy for the full body.</div>` +
      codeBlockHtml(escapeHtml(head))
    );
  }
  const resolved = resolveBodyFormat(mode, msg);
  const formatted = formatBodyText(msg, resolved);
  if (resolved === 'json') {
    return `${truncatedNote}${codeBlockHtml(highlightJsonText(formatBodyText(msg, 'json')), 'ni-code-json')}`;
  }
  if (resolved === 'xml') {
    return `${truncatedNote}${codeBlockHtml(escapeHtml(formatted), 'ni-code-xml')}`;
  }
  return `${truncatedNote}${codeBlockHtml(escapeHtml(formatted))}`;
}

function renderHeadersTable(msg: NetworkHttpMessage | undefined): string {
  if (!msg?.headers || Object.keys(msg.headers).length === 0) {
    return `<div class="ni-pane-empty">(no headers)</div>`;
  }
  const statusLine =
    msg.statusCode != null
      ? `HTTP/1.1 ${msg.statusCode}${msg.statusText ? ` ${msg.statusText}` : ''}`
      : msg.method && msg.url
        ? `${msg.method} ${msg.url}`
        : '';
  const rows: string[] = [];
  if (statusLine) {
    rows.push(`<tr><th>Status-Line</th><td>${escapeHtml(statusLine)}</td></tr>`);
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
  if (code === 0) return 'Pending';
  if (code == null) return '—';
  if (code >= 200 && code < 400) return 'Complete';
  if (code >= 400) return 'Failed';
  return 'Complete';
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

function overviewRow(name: string, value: string): string {
  return `<tr><th>${escapeHtml(name)}</th><td>${escapeHtml(value)}</td></tr>`;
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
  if (!isInspectableUrl(display)) return overviewRow('URL', display);
  return `<tr><th>URL</th><td><button type="button" class="ni-overview-url-link" data-ni-url="${escapeHtml(display)}" title="View URL and query parameters">${escapeHtml(display)}</button></td></tr>`;
}

function overviewSection(title: string): string {
  return `<tr class="ni-overview-section"><th colspan="2">${escapeHtml(title)}</th></tr>`;
}

function buildHttpsRequestFallback(ev: ParsedNetworkEvent): string {
  const host = ev.sni || ev.hostname || ev.destIp || 'unknown-host';
  const port = ev.destPort === 443 ? '' : `:${ev.destPort ?? 443}`;
  return `CONNECT ${host}${port} (HTTPS — encrypted)

Hotspot capture only sees the TLS handshake (SNI + IP), not JSON bodies.

Enable MITM in Settings and route the channel through Roku Dev Studio to inspect bodies.`;
}

function buildHttpsResponseFallback(ev: ParsedNetworkEvent): string {
  if (ev.mitm) return '(no response body captured)';
  return 'HTTPS response body is encrypted. Enable the MITM proxy to inspect bodies here.';
}

export function renderRequestOverview(ev: ParsedNetworkEvent, allEvents: ParsedNetworkEvent[]): string {
  if (ev.type !== 'http-transaction') {
    const rows = [
      overviewRow('Type', ev.type),
      overviewRow('Time', ev.timestamp || '—'),
      overviewRow('Device', ev.deviceIp),
      overviewRow('Host', ev.hostname || ev.sni || '—'),
      overviewRow('Destination', ev.destIp ? `${ev.destIp}:${ev.destPort ?? ''}` : '—')
    ];
    return `<div class="ni-overview-scroll"><table class="ni-overview-table">${rows.join('')}</table></div>`;
  }

  const req = ev.httpRequest;
  const res = ev.httpResponse;
  const reqCt = contentType(req) || '—';
  const resCt = contentType(res) || '—';
  const reqSize = bodyByteSize(req);
  const resSize = bodyByteSize(res);
  const rows: string[] = [
    overviewUrlRow(req?.url || '—'),
    overviewRow('Status', requestStatusLabel(ev)),
    overviewRow('Response Code', res?.statusCode != null ? `${res.statusCode} ${res.statusText || ''}`.trim() : '—'),
    overviewRow('Protocol', ev.mitm ? 'HTTP/1.1 (MITM)' : 'HTTP/1.1'),
    overviewRow('Method', req?.method || '—'),
    overviewRow('Request Content-Type', reqCt),
    overviewRow('Response Content-Type', resCt),
    overviewRow('Client Address', ev.deviceIp || '—'),
    overviewRow('Remote Address', remoteAddress(ev))
  ];
  if (ev.mitm) rows.push(overviewRow('Tags', 'MITM · Decrypted'));
  const dns = relatedDns(allEvents, ev);
  if (dns.length > 0) {
    rows.push(
      overviewRow(
        'DNS',
        dns
          .map((d) =>
            d.type === 'dns-response'
              ? `${d.hostname} → ${(d.resolvedIps || []).join(', ')}`
              : `Query ${d.hostname}`
          )
          .join('; ')
      )
    );
  }

  rows.push(overviewSection('TLS'));
  if (ev.mitm) {
    rows.push(overviewRow('Protocol', 'HTTPS (decrypted via Roku Dev Studio MITM proxy)'));
    rows.push(overviewRow('Notes', 'Proxied request — upstream TLS terminated at Roku Dev Studio'));
  } else {
    rows.push(overviewRow('Protocol', ev.destPort === 443 || req?.url?.startsWith('https') ? 'HTTPS (encrypted)' : 'HTTP'));
    rows.push(overviewRow('Notes', 'Hotspot capture — bodies not available without MITM'));
  }

  rows.push(overviewSection('Timing'));
  rows.push(overviewRow('Request Start', ev.timestamp || '—'));

  rows.push(overviewSection('Size'));
  rows.push(overviewRow('Request', formatBytes(reqSize)));
  rows.push(overviewRow('Response', formatBytes(resSize)));
  rows.push(overviewRow('Total', formatBytes(reqSize + resSize)));

  return `<div class="ni-overview-scroll"><table class="ni-overview-table">${rows.join('')}</table></div>`;
}

export function renderRequestPane(
  ev: ParsedNetworkEvent,
  tab: RequestPaneTab,
  bodyFormat: BodyFormatMode,
  allEvents: ParsedNetworkEvent[] = []
): string {
  if (ev.type === 'tls-handshake' || (ev.type === 'tcp-connection' && ev.destPort === 443)) {
    if (tab === 'overview') {
      return `<div class="ni-overview-scroll"><table class="ni-overview-table">${overviewRow('Host', ev.sni || ev.hostname || '—')}${overviewRow('Type', 'HTTPS (TLS handshake)')}${overviewRow('Device', ev.deviceIp)}</table></div>`;
    }
    return `<pre class="ni-code-block">${escapeHtml(buildHttpsRequestFallback(ev))}</pre>`;
  }
  if (ev.type === 'dns-query' || ev.type === 'dns-response') {
    if (tab === 'overview') {
      return renderRequestOverview(ev, allEvents);
    }
    return `<pre class="ni-code-block">${escapeHtml(`DNS ${ev.type === 'dns-query' ? 'Query' : 'Response'}: ${ev.hostname || '—'}`)}</pre>`;
  }
  if (tab === 'overview') return renderRequestOverview(ev, allEvents);
  return renderBodyContent(ev.httpRequest, bodyFormat, '(no request body)');
}

export function renderResponsePane(
  ev: ParsedNetworkEvent,
  tab: ResponsePaneTab,
  bodyFormat: BodyFormatMode
): string {
  if (ev.type === 'tls-handshake' || (ev.type === 'tcp-connection' && ev.destPort === 443)) {
    if (tab === 'headers') return `<div class="ni-pane-empty">(encrypted — no headers)</div>`;
    return `<pre class="ni-code-block">${escapeHtml(buildHttpsResponseFallback(ev))}</pre>`;
  }
  if (ev.type === 'dns-query' || ev.type === 'dns-response') {
    if (tab === 'headers') return `<div class="ni-pane-empty">(DNS — no HTTP headers)</div>`;
    const ips = (ev.resolvedIps || []).join('\n');
    return `<pre class="ni-code-block">${escapeHtml(ev.type === 'dns-response' ? `;; ANSWER\n${ips || '(empty)'}` : '(Pending)')}</pre>`;
  }
  if (tab === 'headers') return renderHeadersTable(ev.httpResponse);
  const code = ev.httpResponse?.statusCode;
  const fallback =
    code === 0 ? '(waiting for response…)' : code == null ? '(no response body)' : '(empty response body)';
  return renderBodyContent(ev.httpResponse, bodyFormat, fallback);
}

export function renderNetworkEventSummary(ev: ParsedNetworkEvent, allEvents: ParsedNetworkEvent[]): string {
  return renderRequestOverview(ev, allEvents);
}

export function eventSummaryLabel(ev: ParsedNetworkEvent): string {
  if (ev.type === 'http-transaction') {
    const host = ev.httpRequest?.headers?.host || ev.hostname || ev.destIp || '';
    return `${ev.httpRequest?.method || 'HTTP'} ${host}${ev.httpRequest?.url && ev.httpRequest.url !== host ? ev.httpRequest.url : ''}`;
  }
  return ev.hostname || ev.sni || `${ev.destIp || ''}:${ev.destPort ?? ''}`;
}

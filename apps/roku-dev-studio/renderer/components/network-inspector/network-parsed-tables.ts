/**
 * Pure parsers + HTML-string renderers for the Network Inspector's response "Cookies" detail tab
 * (`Set-Cookie` response headers).
 *
 * Renderer-only and side-effect-free: no DOM APIs beyond `escapeHtml` string building, so the same
 * functions drive BOTH the live Network tab and the standalone Session Viewer (via the shared
 * `renderResponsePane`) and are trivially unit-testable. All parsing is best-effort and MUST NOT
 * throw on malformed Set-Cookie input.
 */
import { escapeHtml } from '../../modules/utils/dom.js';
import { S } from '@shared/strings/index.js';
import type { NetworkHttpMessage } from '@shared/network-inspector/types';

/** A parsed Set-Cookie: the leading `name=value` plus its trailing attributes. Attribute labels are
 *  echoed verbatim from the wire (Path / HttpOnly / SameSite / …) — they are protocol data, not
 *  catalog strings, so they are never routed through `@shared/strings`. */
type SetCookie = { name: string; value: string; attributes: { label: string; value?: string }[] };

// ── Header access ─────────────────────────────────────────────────────────────
// Case-insensitive header getter (captured headers preserve the wire casing, which varies).
function headerValue(h: Record<string, string> | undefined, name: string): string {
  if (!h) return '';
  const l = name.toLowerCase();
  for (const k in h) if (k.toLowerCase() === l) return h[k] ?? '';
  return '';
}

// ── Parsers ─────────────────────────────────────────────────────────────────
/**
 * Split a possibly-multi-cookie Set-Cookie string into individual cookies. The engine's
 * `normalizeHeaders` joins multiple Set-Cookie headers with `, `, but an `Expires=` attribute also
 * embeds `, ` (e.g. `Wed, 09 Jun 2021 …`). So split ONLY on a comma that immediately precedes a new
 * `token=` cookie (comma + lookahead for `[^\s;,=]+=`), which the date's day-name comma cannot match.
 * Best-effort: a cookie value literally containing `, token=` may still mis-split (documented limit).
 */
export function splitSetCookieHeader(raw: string): string[] {
  if (!raw) return [];
  const re = /,\s*(?=[^\s;,=]+=)/g;
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    parts.push(raw.slice(last, m.index));
    last = re.lastIndex;
  }
  parts.push(raw.slice(last));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Parse the response `Set-Cookie` header(s) into {name, value, attributes[]} records. */
export function parseSetCookies(msg?: NetworkHttpMessage): SetCookie[] {
  const raw = headerValue(msg?.headers, 'set-cookie');
  if (!raw) return [];
  const out: SetCookie[] = [];
  for (const cookieStr of splitSetCookieHeader(raw)) {
    const segs = cookieStr.split(';');
    const first = segs[0].trim();
    if (!first) continue;
    const eq = first.indexOf('=');
    const name = eq < 0 ? first : first.slice(0, eq).trim();
    const value = eq < 0 ? '' : first.slice(eq + 1).trim();
    const attributes: { label: string; value?: string }[] = [];
    for (let i = 1; i < segs.length; i++) {
      const seg = segs[i].trim();
      if (!seg) continue;
      const aeq = seg.indexOf('=');
      if (aeq < 0) attributes.push({ label: seg });
      else attributes.push({ label: seg.slice(0, aeq).trim(), value: seg.slice(aeq + 1).trim() });
    }
    out.push({ name, value, attributes });
  }
  return out;
}

// ── Pane composers ────────────────────────────────────────────────────────────
export function renderResponseCookiesPane(msg?: NetworkHttpMessage): string {
  const cookies = parseSetCookies(msg);
  if (cookies.length === 0) {
    return `<div class="ni-pane-empty">${S.networkInspector.noResponseCookies}</div>`;
  }
  const rows = cookies
    .map((c) => {
      const attrs = c.attributes
        .map((a) => (a.value !== undefined ? `${a.label}=${a.value}` : a.label))
        .join('; ');
      return `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.value)}</td><td class="ni-cookie-attrs">${escapeHtml(attrs)}</td></tr>`;
    })
    .join('');
  const table = `<table class="ni-overview-table ni-cookie-table"><thead><tr><th>${S.networkInspector.colName}</th><th>${S.networkInspector.colValue}</th><th>${S.networkInspector.colAttributes}</th></tr></thead><tbody>${rows}</tbody></table>`;
  return `<div class="ni-overview-scroll ni-parsed-scroll">${table}</div>`;
}

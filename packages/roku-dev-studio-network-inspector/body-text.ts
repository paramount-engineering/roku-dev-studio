/**
 * Text view of a captured HTTP body.
 *
 * Bodies tagged `bodyEncoding: 'base64'` are normally binary (images / video / fonts), but a HAR
 * exporter that base64-wraps every response, or a capture that tagged an unfamiliar MIME as binary,
 * leaves ordinary JSON / XML / text bodies base64-wrapped too. Those decode losslessly back to a
 * string, so every surface (detail panes, Copy, Find, Edit & Resend) shows the text instead of
 * "binary — not previewable".
 *
 * Pure + isomorphic: `atob` and `TextDecoder` are globals in browsers and Node ≥ 16, so this runs
 * unchanged in the renderer, the Electron main process and the relay server.
 */
import type { NetworkHttpMessage } from './types';

// Media never decodes as UTF-8 text; skip the work up front when the MIME says so.
const MEDIA_MIME_RE = /^\s*(image|video|audio|font)\//i;
// ponytail: bodies past ~6 MB raw are not sniffed (atob + decode is O(n) on the UI thread); they keep
// today's binary note. Raise if a real text payload that large ever shows up.
const MAX_SNIFF_CHARS = 8_000_000;
// Real text carries no NUL / C0 control bytes other than TAB LF VT FF CR (and ESC, for ANSI colour).
const BINARY_CHARS_RE = /[\x00-\x08\x0e-\x1a\x1c-\x1f]/;

type BodyLike = Pick<NetworkHttpMessage, 'body' | 'bodyEncoding' | 'contentType' | 'headers'>;

/** Decode a base64 body to text, or null when the bytes are not valid UTF-8 text (genuine binary). */
export function decodeBase64Text(b64: string): string | null {
  if (!b64 || b64.length > MAX_SNIFF_CHARS) return null;
  let bytes: Uint8Array;
  try {
    const bin = atob(b64.replace(/\s+/g, ''));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return null;
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  return BINARY_CHARS_RE.test(text) ? null : text;
}

/**
 * The body as text: the string itself for text bodies, the decoded string for base64 bodies that
 * are really text, null for genuine binary or no body. `mime` overrides the message's own
 * Content-Type for the media short-circuit.
 */
export function textBodyOf(msg: BodyLike | undefined, mime?: string): string | null {
  if (!msg?.body) return null;
  if (msg.bodyEncoding !== 'base64') return msg.body;
  const ct = mime || msg.contentType || msg.headers?.['content-type'] || msg.headers?.['Content-Type'] || '';
  if (MEDIA_MIME_RE.test(ct)) return null;
  return decodeBase64Text(msg.body);
}

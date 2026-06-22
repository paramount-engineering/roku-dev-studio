/**
 * Generic input validation shared across Roku Dev Studio (desktop app, API, remote server).
 *
 * IP/password are sent over native HTTP (Digest auth + multipart) — never interpolated into a shell —
 * so password validation only guards length and control characters, not shell metacharacters.
 *
 * Domain-specific validators (Action Script shapes, ECP payloads, etc.) stay in their owning package;
 * only these cross-cutting primitives live here.
 */

/** True when `ip` is a syntactically valid dotted-quad IPv4 address. */
export function isValidIp(ip: unknown): boolean {
  if (typeof ip !== 'string' || !ip.trim()) return false;
  const trimmed = ip.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 4) return false;
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (isNaN(n) || n < 0 || n > 255 || String(n) !== p) return false;
  }
  return true;
}

/** True if the string contains an ASCII control char (0x00–0x1F or 0x7F DEL). */
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
}

/**
 * Validate a Roku developer password for transport over HTTP. Rejects empty, over-long (>128), and
 * control-character-bearing values (CR/LF/NUL/etc. that could corrupt HTTP headers or a multipart
 * body). Quotes / `$` / other shell metacharacters are intentionally allowed — the password is hashed
 * for Digest auth, never shelled out, and the Roku web UI accepts them.
 */
export function validateDevPassword(password: unknown): { valid: boolean; error?: string } {
  if (password == null) return { valid: false, error: 'Password is required' };
  const s = String(password);
  if (s.length === 0) return { valid: false, error: 'Password is required' };
  if (s.length > 128) return { valid: false, error: 'Password is too long' };
  if (hasControlChar(s)) {
    return {
      valid: false,
      error: 'Password contains invalid control characters. Remove line breaks or tabs and try again.'
    };
  }
  return { valid: true };
}

/**
 * Input validation for Roku device requests. IP/password are sent over native
 * HTTP (Digest auth + multipart) — not interpolated into a shell — so password
 * validation only guards length and control characters, not shell metacharacters.
 */

function isValidIp(ip: unknown): boolean {
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

function validateDevPassword(password: unknown): { valid: boolean; error?: string } {
  if (password == null) return { valid: false, error: 'Password is required' };
  const s = String(password);
  if (s.length === 0) return { valid: false, error: 'Password is required' };
  if (s.length > 128) return { valid: false, error: 'Password is too long' };
  // Only reject control characters (CR/LF/NUL/etc.) that could corrupt HTTP
  // headers or the multipart body. Quotes, `$`, and other shell metacharacters
  // are now safe — the password is hashed for Digest auth, never shelled out —
  // and the Roku device web UI accepts them, so blocking them only locked out
  // legitimate passwords.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(s)) {
    return {
      valid: false,
      error: 'Password contains invalid control characters. Remove line breaks or tabs and try again.'
    };
  }
  return { valid: true };
}

module.exports = { isValidIp, validateDevPassword };

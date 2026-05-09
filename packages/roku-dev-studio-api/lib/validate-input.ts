/**
 * Input validation for Roku libs that build shell commands (curl).
 * Reduces risk of command injection when IP or developer password are interpolated.
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
  const unsafe = /["'`$\\\r\n\t;|&<>*?()[\]{}]|\.\./;
  if (unsafe.test(s)) {
    return { valid: false, error: 'Password contains invalid characters' };
  }
  return { valid: true };
}

module.exports = { isValidIp, validateDevPassword };

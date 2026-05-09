/**
 * Detects the RALE/App Connector "socket gone" result shape so callers can
 * retry or surface a clear message (shared by executor waits and connector).
 */

export function isRaleNotConnectedResult(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const r = result as { success?: boolean; error?: unknown };
  if (r.success !== false || r.error == null) return false;
  return String(r.error).toLowerCase().includes('not connected');
}

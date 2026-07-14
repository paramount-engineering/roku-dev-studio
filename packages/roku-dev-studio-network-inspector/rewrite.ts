/**
 * Pure helpers that apply Charles-style {@link RewriteOp}s. Kept transport-free (no Node http/zlib)
 * so they unit-test in isolation; the MITM proxy handles the surrounding I/O (reading the body,
 * gzip/br decode, and re-serializing the wire response) and calls these for the actual mutation.
 *
 * Header maps here use lowercased keys (Node normalizes incoming request/response header names to
 * lowercase), so `set-header`/`remove-header` match case-insensitively.
 */

import type { RewriteOp } from './types';

/** Keep only the ops that target the request (or, with `'response'`, the response). */
export function opsFor(ops: RewriteOp[] | undefined, target: 'request' | 'response'): RewriteOp[] {
  return (ops || []).filter((o) => o.target === target);
}

/** True if any op in `ops` rewrites the body (so the caller knows to decode + re-encode it). */
export function hasBodyReplace(ops: RewriteOp[]): boolean {
  return ops.some((o) => o.type === 'body-replace' && !!o.match);
}

/**
 * Apply the request URL ops (`set-host` / `set-path` / `set-query` / `remove-query`) to `url`,
 * returning the rewritten absolute URL. On a parse failure the original is returned unchanged.
 */
export function applyRequestUrl(ops: RewriteOp[], url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  for (const op of ops) {
    switch (op.type) {
      case 'set-host': {
        const v = (op.value || '').trim();
        if (!v) break;
        const colon = v.lastIndexOf(':');
        // Split host:port, but only when the part after ':' is numeric (avoid tripping on IPv6/bare).
        if (colon > 0 && /^\d+$/.test(v.slice(colon + 1))) {
          u.hostname = v.slice(0, colon);
          u.port = v.slice(colon + 1);
        } else {
          u.hostname = v;
          u.port = '';
        }
        break;
      }
      case 'set-path': {
        if (op.value == null) break;
        const v = op.value;
        const q = v.indexOf('?');
        if (q >= 0) {
          u.pathname = v.slice(0, q) || '/';
          u.search = v.slice(q);
        } else {
          u.pathname = v || '/';
        }
        break;
      }
      case 'set-query':
        if (op.match) u.searchParams.set(op.match, op.value ?? '');
        break;
      case 'remove-query':
        if (op.match) u.searchParams.delete(op.match);
        break;
      default:
        break;
    }
  }
  return u.toString();
}

/** Apply `set-header` / `remove-header` ops to a (lowercased-key) header map, returning a new map. */
export function applyHeaderOps(ops: RewriteOp[], headers: Record<string, string>): Record<string, string> {
  const out = { ...headers };
  for (const op of ops) {
    if (op.type === 'set-header' && op.match) out[op.match.toLowerCase()] = op.value ?? '';
    else if (op.type === 'remove-header' && op.match) delete out[op.match.toLowerCase()];
  }
  return out;
}

/** Last `set-status` op wins; returns the override status code, or undefined if none/invalid. */
export function statusOverride(ops: RewriteOp[]): number | undefined {
  let status: number | undefined;
  for (const op of ops) {
    if (op.type !== 'set-status' || op.value == null) continue;
    const n = parseInt(String(op.value), 10);
    if (Number.isFinite(n) && n >= 100 && n <= 599) status = n;
  }
  return status;
}

/**
 * Apply `body-replace` ops to a decoded text body, in order. Literal find/replace by default
 * (all occurrences); with `regex: true` the `match` is a global JS regex (an invalid pattern is
 * skipped rather than thrown). Returns the text unchanged when there are no body-replace ops.
 */
export function applyBodyReplace(ops: RewriteOp[], text: string): string {
  let out = text;
  for (const op of ops) {
    if (op.type !== 'body-replace' || !op.match) continue;
    const replacement = op.value ?? '';
    if (op.regex) {
      try {
        out = out.replace(new RegExp(op.match, 'g'), replacement);
      } catch {
        /* invalid regex — leave the body unchanged for this op */
      }
    } else {
      out = out.split(op.match).join(replacement);
    }
  }
  return out;
}

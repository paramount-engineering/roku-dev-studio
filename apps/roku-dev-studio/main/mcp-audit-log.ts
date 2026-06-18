/**
 * Append-only JSONL audit log for the MCP bridge.
 *
 * Why this exists:
 *   - The OWASP "Practical Guide for Secure MCP Server Development" §7
 *     ("Governance / Audit Logs and Trails") asks for a durable record of
 *     every tool invocation with parameters. Bridge stderr (`logInfo`) is
 *     observability, not an audit trail — it isn't retained, isn't
 *     redacted, and disappears with the Electron app's stderr.
 *   - Users need to be able to answer "what did the AI agent do on my
 *     device this morning?" without scrolling chat logs.
 *
 * Shape (one JSON object per line):
 *   {
 *     "ts": "2026-05-08T14:22:09.118Z",
 *     "op": "launch_app",         // op id, tool name, or pathname:method for the back-compat aliases
 *     "device": "192.168.1.182",  // resolved IP, or null for non-device ops (scan, builder drop)
 *     "durationMs": 142,
 *     "status": 200,              // HTTP status the bridge returned
 *     "ok": true,                 // status in [200, 300)
 *     "destructive": false,       // mirrors the op's destructive flag (or pathname mapping for aliases)
 *     "error": "...",             // present only when ok=false
 *     "paramsHash": "sha256:1f..."// 16-hex-char prefix of canonical-JSON param hash
 *                                 // — never the raw params, so password / token
 *                                 //   / personally-sensitive payloads can't leak
 *                                 //   into the log
 *   }
 *
 * Rotation: when the live file passes 5 MB, it's renamed to
 * `mcp-audit.log.1` (overwriting any existing .1) before the next append.
 * Two-file rolling window keeps the on-disk footprint bounded at ~10 MB
 * even for the most chatty agent loops.
 *
 * All writes are fire-and-forget — a failed audit write must never break a
 * live tool call. Failures go to `console.warn` so they show up in the
 * Electron main-process log without contaminating the audit file itself.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const FILE_NAME = 'mcp-audit.log';
const ROTATED_NAME = 'mcp-audit.log.1';
const ROTATE_AT_BYTES = 5 * 1024 * 1024;

let logDir: string | null = null;
/** Cached size so we don't `statSync` on every append. Refreshed on rotation. */
let cachedSize = 0;
let writesInFlight = 0;

export type McpAuditRecord = {
  /** ISO-8601 timestamp at the moment the response finished flushing. */
  ts: string;
  /** Op id (`keypress`), tool name (`rale_command`), or canonical endpoint (`alias:/screenshot`). */
  op: string;
  /** Resolved target IP, or null for ops that don't target a device. */
  device: string | null;
  /** Wall-clock ms from request arrival to response.finish. */
  durationMs: number;
  /** HTTP status code the bridge returned. 0 on connection-level failures. */
  status: number;
  /** Convenience: `status >= 200 && status < 300`. */
  ok: boolean;
  /** Whether this op modifies device or app state (mirrors `destructive` annotation). */
  destructive: boolean;
  /** Bridge-level error string (when ok=false). Includes truncation if long. */
  error?: string;
  /**
   * `sha256:` + 16 hex chars of the canonical-JSON-stringified, redacted
   * params. Lets a reviewer correlate "two calls with identical params" /
   * "every call had a unique payload" without exposing the params themselves.
   */
  paramsHash?: string;
};

/** Wire the rotation directory; call once on app ready. */
export function setMcpAuditLogDir(dir: string): void {
  logDir = dir;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const stat = fs.statSync(path.join(dir, FILE_NAME));
    cachedSize = stat.size;
  } catch {
    cachedSize = 0;
  }
}

/**
 * Hash redacted params for the `paramsHash` field. We always strip
 * obviously-secret fields *before* hashing so the hash itself doesn't
 * encode them — every call with the same non-secret payload hashes the
 * same regardless of whether the agent included the Dev Password.
 */
const SECRET_KEYS = new Set(['password', 'devPassword', 'token', 'authorization', 'imageBase64']);

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(k)) {
        out[k] = '<redacted>';
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

/** Stable JSON: keys sorted recursively so equivalent params hash to the same string. */
function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson((value as Record<string, unknown>)[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function hashParamsForAudit(params: unknown): string {
  if (params == null) return '';
  const redacted = redact(params);
  const canonical = canonicalJson(redacted);
  const full = crypto.createHash('sha256').update(canonical).digest('hex');
  return 'sha256:' + full.slice(0, 16);
}

function rotateIfNeeded(filePath: string, nextWriteBytes: number): void {
  if (cachedSize + nextWriteBytes <= ROTATE_AT_BYTES) return;
  const rotated = path.join(path.dirname(filePath), ROTATED_NAME);
  try {
    // Best-effort overwrite: rm the old .1 first so renameSync can't fail
    // on platforms (Windows) that don't allow renaming over an existing file.
    fs.rmSync(rotated, { force: true });
    fs.renameSync(filePath, rotated);
    cachedSize = 0;
  } catch (e) {
    // Rotation is best-effort. If it fails we keep appending to the live
    // file; better to bloat than to drop the audit record.
    console.warn('[mcp-audit] rotation failed', e);
  }
}

/**
 * Append one record. Synchronous-write inside an async setImmediate so
 * the calling request handler (running inside `res.on('finish')`) is
 * never blocked by disk I/O.
 */
export function recordMcpAudit(record: McpAuditRecord): void {
  if (!logDir) return;
  const dir = logDir;
  writesInFlight++;
  setImmediate(() => {
    try {
      const filePath = path.join(dir, FILE_NAME);
      const line = JSON.stringify(record) + '\n';
      const bytes = Buffer.byteLength(line, 'utf-8');
      rotateIfNeeded(filePath, bytes);
      fs.appendFileSync(filePath, line, { encoding: 'utf-8', mode: 0o600 });
      cachedSize += bytes;
    } catch (e) {
      console.warn('[mcp-audit] append failed', e);
    } finally {
      writesInFlight--;
    }
  });
}

/** Test/diagnostic helper. */
export function getMcpAuditLogPath(): string | null {
  return logDir ? path.join(logDir, FILE_NAME) : null;
}

/** Test/diagnostic helper. */
export function getMcpAuditWritesInFlight(): number {
  return writesInFlight;
}

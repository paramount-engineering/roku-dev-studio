/**
 * Canonical error taxonomy for Roku operations, shared by every transport
 * (Electron IPC handlers, MCP bridge, remote server). A single error class
 * carries a stable `code` plus a human message, and helpers translate it
 * into transport-appropriate shapes.
 *
 * Rationale: today each transport invented its own `{ error, suggestion }`
 * or `{ success: false, error: 'Device X is not connected' }` shape. Now
 * they all carry the same codes so agents can program against them.
 */

'use strict';

const ROKU_OP_ERROR_CODES = Object.freeze({
  /** Callers passed an arg that failed schema validation (missing, wrong type). */
  INVALID_ARG: 'invalid_arg',
  /** Device ip/serial supplied but not known to Dev Studio. */
  DEVICE_UNKNOWN: 'device_unknown',
  /** Known device but no open tab / session. */
  DEVICE_NOT_CONNECTED: 'device_not_connected',
  /** Device was reachable but rejected the operation (non-2xx from ECP). */
  DEVICE_ERROR: 'device_error',
  /** We couldn't reach the device at all (network / timeout). */
  DEVICE_UNREACHABLE: 'device_unreachable',
  /** Device accepted us but dev-auth failed. */
  DEV_AUTH_FAILED: 'dev_auth_failed',
  /** The operation is not available in this context (renderer required, missing AppConnector, etc.). */
  UNSUPPORTED: 'unsupported',
  /** Timed out waiting for the renderer / bridge to ack a round-tripped operation. */
  TIMEOUT: 'timeout',
  /** A destructive operation was rejected by the consent layer. */
  CONSENT_DENIED: 'consent_denied',
  /** Catch-all for unexpected internal exceptions. */
  INTERNAL: 'internal'
} as const);

type RokuOpErrorCode = (typeof ROKU_OP_ERROR_CODES)[keyof typeof ROKU_OP_ERROR_CODES];

/**
 * Thrown from op executors or bridge handlers. Transport adapters convert
 * to the right wire shape (HTTP status, JSON-RPC error, IPC reply).
 */
class RokuOpError extends Error {
  public readonly code: RokuOpErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly suggestion?: string;

  constructor(
    code: RokuOpErrorCode,
    message: string,
    opts: { details?: Record<string, unknown>; suggestion?: string; cause?: unknown } = {}
  ) {
    super(message);
    this.name = 'RokuOpError';
    this.code = code;
    if (opts.details) this.details = opts.details;
    if (opts.suggestion) this.suggestion = opts.suggestion;
    if (opts.cause !== undefined) {
      // Node 16.9+ supports the Error cause option; avoid throwing on older runtimes.
      try {
        (this as Error & { cause?: unknown }).cause = opts.cause;
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Default HTTP status for each code. Transports can override per-endpoint.
   */
  toHttpStatus(): number {
    switch (this.code) {
      case 'invalid_arg':
        return 400;
      case 'device_unknown':
        return 404;
      case 'device_not_connected':
        return 409;
      case 'dev_auth_failed':
        return 401;
      case 'consent_denied':
        return 403;
      case 'unsupported':
        return 501;
      case 'timeout':
        return 504;
      case 'device_unreachable':
      case 'device_error':
        return 502;
      case 'internal':
      default:
        return 500;
    }
  }

  toWire(): {
    error: string;
    code: RokuOpErrorCode;
    details?: Record<string, unknown>;
    suggestion?: string;
  } {
    const out: {
      error: string;
      code: RokuOpErrorCode;
      details?: Record<string, unknown>;
      suggestion?: string;
    } = { error: this.message, code: this.code };
    if (this.details) out.details = this.details;
    if (this.suggestion) out.suggestion = this.suggestion;
    return out;
  }
}

/**
 * Convert any thrown value into a RokuOpError. Pass-through if already one.
 */
function toRokuOpError(e: unknown, fallbackCode: RokuOpErrorCode = 'internal'): RokuOpError {
  if (e instanceof RokuOpError) return e;
  const message = e instanceof Error ? e.message : String(e);
  return new RokuOpError(fallbackCode, message, { cause: e });
}

module.exports = {
  ROKU_OP_ERROR_CODES,
  RokuOpError,
  toRokuOpError
};

/**
 * MCP server logger. Wraps the shared logger in `roku-dev-studio-platform`, but pins the sink to
 * **stderr for every level** — stdout is reserved for the MCP JSON-RPC protocol stream, so any
 * diagnostic written to stdout would corrupt the transport. Verbose (`debug`) output is gated by the
 * unified `RDS_DEBUG` flag, or `RDS_MCP_DEBUG=1` for just the MCP server.
 */

import { createLogger, type LogSink } from 'roku-dev-studio-platform';
import { debugEnvEnabled } from 'roku-dev-studio-platform/node';

// Everything goes to stderr; stdout belongs to the protocol.
const stderrSink: LogSink = {
  log: (...args) => console.error(...args),
  warn: (...args) => console.error(...args),
  error: (...args) => console.error(...args),
};

const logger = createLogger({
  prefix: '[roku-dev-studio-mcp]',
  debug: () => debugEnvEnabled('RDS_MCP_DEBUG'),
  sink: stderrSink,
});

export function mcpLog(...args: unknown[]): void {
  logger.log(...args);
}

export function mcpWarn(...args: unknown[]): void {
  logger.warn(...args);
}

export function mcpError(...args: unknown[]): void {
  logger.error(...args);
}

/** Verbose trace — only emitted when `RDS_DEBUG`/`RDS_MCP_DEBUG` is set. Still stderr-only. */
export function mcpDebug(...args: unknown[]): void {
  logger.debug(...args);
}

export function isMcpDebug(): boolean {
  return logger.isDebugEnabled();
}

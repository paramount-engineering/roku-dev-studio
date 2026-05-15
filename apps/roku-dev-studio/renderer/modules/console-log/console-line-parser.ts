/**
 * Shared raw-text → `ParsedTelnetEntry[]` parser used by both the live Console
 * (per-batch ingest) and the standalone Log Viewer (whole-file parse).
 *
 * Earlier each surface reimplemented the same line-splitting / log-prefix
 * continuation / ANSI strip / truncation / structured-detect chain inline.
 * They drifted — a fix in one didn't land in the other. Folding both onto
 * this module guarantees identical line groupings, so a file produced by the
 * live Console's "Save logs" round-trips back into the file viewer with the
 * same entry shape.
 *
 * State (`ConsoleLineParserState`) carries `pendingLogPrefix` between calls
 * so the live ingest can parse one flush at a time without losing a `[DEBUG]`
 * standalone-prefix line whose continuation arrives in the next batch.
 *
 * Surface-specific extras (per-line timestamps, scrollback caps) stay at the
 * call site — `ParsedTelnetEntry` is intentionally minimal.
 */

import { classifyLogLine } from './console-log-classify.js';
import {
  detectStructuredConsoleLine,
  type StructuredConsolePayload
} from './structured-log-detect.js';
import { stripAnsiForConsole } from '../telnet/telnet-console-buffer.js';
import { DEFER_HEAVY_LINE_CHARS, MAX_LOG_LINE_CHARS } from './console-render-limits.js';

export type ConsoleLineParserState = {
  /** Buffer for a `[DEBUG]`-style log-level marker that arrived alone on its
   *  own line. The next non-blank line gets the prefix prepended. Cleared as
   *  soon as it's consumed. */
  pendingLogPrefix: string;
};

export function createConsoleLineParserState(): ConsoleLineParserState {
  return { pendingLogPrefix: '' };
}

export type ParsedTelnetEntry = {
  text: string;
  type: string;
  structuredTargets?: StructuredConsolePayload[];
};

/**
 * Parse one batch of raw lines. The caller must have already split on `\n`
 * (or kept lines whole, e.g. when re-feeding output from `addLogLine`'s
 * "no-split" path). `\r\n`/`\r` normalization is the caller's responsibility
 * because the live ingest deliberately avoids re-splitting batches that
 * already came in split (preserving the TCP buffer's line boundaries).
 *
 * Returns entries in input order. Empty lines (after pendingLogPrefix
 * processing and ANSI strip) are dropped silently.
 */
export function parseConsoleLineBatch(
  state: ConsoleLineParserState,
  rawLines: string[]
): ParsedTelnetEntry[] {
  const entries: ParsedTelnetEntry[] = [];

  for (const line of rawLines) {
    if (!line || line.trim() === '') continue;

    const logLevelOnlyMatch = line.match(/^\s*\[(DEBUG|INFO|WARN|WARNING|ERROR|FATAL|TRACE)\]\s*$/i);
    if (logLevelOnlyMatch) {
      state.pendingLogPrefix = line.trim() + ' ';
      continue;
    }

    let fullLine = line;
    if (state.pendingLogPrefix) {
      if (/^\s+/.test(line)) {
        fullLine = state.pendingLogPrefix + line.trim();
      } else {
        fullLine = state.pendingLogPrefix + line;
      }
      state.pendingLogPrefix = '';
    }

    const displayLine = stripAnsiForConsole(fullLine);
    if (!displayLine.trim()) continue;

    let textLine = displayLine;
    if (displayLine.length > MAX_LOG_LINE_CHARS) {
      const over = displayLine.length - MAX_LOG_LINE_CHARS;
      textLine = `${displayLine.slice(0, MAX_LOG_LINE_CHARS)} \u2026 [truncated ${over} chars]`;
    }

    const detected =
      textLine.length < DEFER_HEAVY_LINE_CHARS ? detectStructuredConsoleLine(textLine) : [];

    entries.push({
      text: textLine,
      type: classifyLogLine(textLine),
      ...(detected.length ? { structuredTargets: detected } : {})
    });
  }

  return entries;
}

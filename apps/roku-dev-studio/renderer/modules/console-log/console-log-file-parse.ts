/**
 * Parse plain log-file text into entries for the standalone Log Viewer.
 *
 * Thin wrapper over the shared `parseConsoleLineBatch` (`console-line-parser.ts`)
 * — keeps the file viewer and live Console using identical line-splitting /
 * ANSI-strip / structured-detect logic so a file produced by "Save logs"
 * round-trips back into the viewer with identical entry groupings.
 *
 * Adds the file-specific behavior the live ingest doesn't have:
 *
 *   1. Whole-text `\r\n` / `\r` normalization + `\n` split. The live ingest
 *      uses `appendTelnetChunk` (a TCP-buffer-aware splitter) and never has
 *      a single "whole file" string to re-split.
 *   2. `timestamp: null` per entry. Files don't have a synthetic per-line
 *      timestamp source; the live ingest uses `Date.now()` only because
 *      that's the wall-clock at the moment a line arrived over telnet.
 */

import {
  createConsoleLineParserState,
  parseConsoleLineBatch
} from './console-line-parser.js';
import type { StructuredConsolePayload } from './structured-log-detect.js';

export type ConsoleLogFileEntry = {
  text: string;
  timestamp: string | null;
  type: string;
  structuredTargets?: StructuredConsolePayload[];
};

/**
 * Parse the entire raw text of a log file into entries.
 *
 * Returns entries with `timestamp: null` — log files are static text on disk
 * and the parser has no source of real per-line timestamps. The earlier
 * `includeTimestamps` parameter stamped wall-clock-now on every entry, which
 * looks correct in passing but produces nonsense timestamps in saved /
 * exported output. If you ever want per-line timestamps here, parse them out
 * of the line text (e.g. the `[DEBUG]   18:35:41.921` prefix) — don't fall
 * back to `Date.now()`.
 *
 * Heavy lines (>= `DEFER_HEAVY_LINE_CHARS`) skip structured-payload
 * detection at parse time; they're detected on first mount in the view's row
 * builder. Keeps `rawLogFileTextToEntries` fast even on 180 K-line files.
 */
export function rawLogFileTextToEntries(raw: string): ConsoleLogFileEntry[] {
  const state = createConsoleLineParserState();
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const parsed = parseConsoleLineBatch(state, lines);
  return parsed.map((p) => ({
    text: p.text,
    timestamp: null,
    type: p.type,
    ...(p.structuredTargets ? { structuredTargets: p.structuredTargets } : {})
  }));
}

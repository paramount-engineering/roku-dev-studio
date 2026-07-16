/**
 * Windowed log-file backend for the standalone Log Viewer.
 *
 * The earlier model streamed the *entire* file into the renderer, which then
 * held every parsed line in one `entries[]` array — so a 41 MB file blew past
 * the viewer's memory guard. This module lets the renderer keep only a sliding
 * window resident (≈ a few MB) while the scrollbar still spans the whole file:
 *
 *   1. `buildLineIndex` scans the file once and records the byte offset of every
 *      line start (encoding-aware, so UTF-16 never false-matches a `0x0A` byte
 *      that is really the low half of some other code unit). The offsets let us
 *      seek to any line without re-reading from the top.
 *   2. `readLineRange` / `readLines` decode just the bytes for the requested
 *      line(s) — a contiguous range for normal scrolling, scattered line numbers
 *      for Filter mode (whose visible lines aren't adjacent in the file).
 *   3. `searchFile` scans the whole file for a query and returns match ranges
 *      (for Find highlight/nav) plus the ordered set of matching line numbers
 *      (which Filter mode collapses the file down to).
 *
 * Line splitting is owned here, not in the renderer: `readLineRange` returns an
 * array with exactly `endLine - startLine` strings so the renderer's line count,
 * scrollbar, and filter line-number mapping stay perfectly aligned with the
 * index. `\r\n` / trailing `\r` are stripped to match the console renderer's
 * normalization.
 */

import { TextDecoder } from 'util';
import { consoleDisplayText } from '../renderer/modules/console-log/console-display-text';
import {
  recognizeBrsIssue,
  computeConsoleFindings,
  type ConsoleFindings
} from '../shared/console/brightscript-error-catalog';

const fs = require('fs');

/** Encoding label + BOM length, mirroring the sniffer in the streaming path. */
export type LogFileEncoding = {
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be';
  bomBytes: number;
};

export type LogFileIndex = {
  filePath: string;
  fileSize: number;
  encoding: LogFileEncoding['encoding'];
  bomBytes: number;
  /** Byte offset of the first byte of each line (line `i` → `lineOffsets[i]`).
   *  A `Float64Array` because offsets can exceed the 2^31 SMI range on large
   *  files and the fixed 8-bytes/element footprint is predictable. */
  lineOffsets: Float64Array;
  lineCount: number;
};

/** Read granularity for the index + search scans. 1 MB balances syscall count
 *  against transient buffer size (we only ever hold one chunk at a time). */
const SCAN_CHUNK_BYTES = 1024 * 1024;

/**
 * Hard ceiling on indexable lines. The offset table is 8 bytes/line, so this
 * caps the index at ~80 MB even for a pathological file of mostly-empty lines.
 * Files past this are refused with a clear message rather than silently
 * truncated.
 */
export const LOG_VIEWER_MAX_LINES = 10_000_000;

/**
 * Cap on `hits` returned from a search (Find highlight/nav). Navigation past
 * the cap isn't offered; the renderer surfaces a "truncated" note. 100k is far
 * above any realistic interactive result set yet bounds the IPC payload.
 */
export const LOG_VIEWER_MAX_SEARCH_HITS = 100_000;

/**
 * Cap on `matchLines` (Filter mode's collapsed line set). Higher than the hit
 * cap because one matching line can host many hits; a filter that matches most
 * of a huge file is unusual but must stay bounded.
 */
export const LOG_VIEWER_MAX_MATCH_LINES = 1_000_000;

export function sniffEncoding(head: Buffer): LogFileEncoding {
  if (head.length >= 2 && head[0] === 0xff && head[1] === 0xfe) {
    return { encoding: 'utf-16le', bomBytes: 2 };
  }
  if (head.length >= 2 && head[0] === 0xfe && head[1] === 0xff) {
    return { encoding: 'utf-16be', bomBytes: 2 };
  }
  if (head.length >= 3 && head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) {
    return { encoding: 'utf-8', bomBytes: 3 };
  }
  return { encoding: 'utf-8', bomBytes: 0 };
}

/** Growable Float64 buffer for the offset table (we don't know the line count
 *  ahead of the scan). Doubles on overflow; `toExact` trims to the used length. */
class OffsetBuilder {
  private buf: Float64Array;
  private len = 0;
  constructor(initial = 1024) {
    this.buf = new Float64Array(initial);
  }
  push(v: number): void {
    if (this.len >= this.buf.length) {
      const next = new Float64Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.len++] = v;
  }
  get length(): number {
    return this.len;
  }
  toExact(): Float64Array {
    return this.buf.slice(0, this.len);
  }
}

/**
 * Scan `filePath` and build the per-line byte-offset index. Encoding-aware:
 *  - UTF-8 / ASCII: a line ends at byte `0x0A` (1-byte newline).
 *  - UTF-16LE: a line ends at code unit `0x000A` = bytes `0A 00` on an even
 *    boundary. A stray `0x0A` in some other code unit's low byte never matches
 *    because we test the whole 16-bit unit and honor 2-byte alignment.
 *  - UTF-16BE: the same, bytes `00 0A`.
 *
 * Newline convention matches typical log tooling: a trailing newline does NOT
 * create an extra empty final line ("a\nb\n" → 2 lines), but "a\nb" is 2 lines
 * and "a" is 1 line. An empty file is 0 lines.
 *
 * Throws `Error('too-many-lines')` if the file would exceed `LOG_VIEWER_MAX_LINES`.
 */
export function buildLineIndex(filePath: string): LogFileIndex {
  const stat = fs.statSync(filePath);
  const fileSize: number = stat.size;

  const fd = fs.openSync(filePath, 'r');
  try {
    // Sniff from the first few bytes.
    const head = Buffer.alloc(Math.min(3, fileSize));
    if (head.length > 0) fs.readSync(fd, head, 0, head.length, 0);
    const { encoding, bomBytes } = sniffEncoding(head);

    const offsets = new OffsetBuilder();
    if (fileSize > bomBytes) {
      offsets.push(bomBytes); // line 0 starts right after the BOM
    }

    const unit = encoding === 'utf-8' ? 1 : 2;
    const buf = Buffer.alloc(SCAN_CHUNK_BYTES);
    let filePos = bomBytes;
    // For UTF-16, a code unit can straddle a chunk boundary. `carry` holds the
    // single leftover byte from the previous chunk so the unit is reassembled.
    let carry = -1;

    while (filePos < fileSize) {
      const bytesRead = fs.readSync(fd, buf, 0, SCAN_CHUNK_BYTES, filePos);
      if (bytesRead <= 0) break;

      if (unit === 1) {
        for (let i = 0; i < bytesRead; i++) {
          if (buf[i] === 0x0a) {
            const next = filePos + i + 1;
            if (next < fileSize) {
              offsets.push(next);
              if (offsets.length > LOG_VIEWER_MAX_LINES) throw new Error('too-many-lines');
            }
          }
        }
      } else {
        // Reassemble a carried byte with the first byte of this chunk.
        let i = 0;
        if (carry >= 0) {
          const lo = encoding === 'utf-16le' ? carry : buf[0];
          const hi = encoding === 'utf-16le' ? buf[0] : carry;
          if (lo === 0x0a && hi === 0x00) {
            const next = filePos + 1; // one byte consumed into this chunk
            if (next < fileSize) {
              offsets.push(next);
              if (offsets.length > LOG_VIEWER_MAX_LINES) throw new Error('too-many-lines');
            }
          }
          i = 1;
          carry = -1;
        }
        for (; i + 1 < bytesRead; i += 2) {
          const b0 = buf[i]!;
          const b1 = buf[i + 1]!;
          const isNl = encoding === 'utf-16le' ? b0 === 0x0a && b1 === 0x00 : b0 === 0x00 && b1 === 0x0a;
          if (isNl) {
            const next = filePos + i + 2;
            if (next < fileSize) {
              offsets.push(next);
              if (offsets.length > LOG_VIEWER_MAX_LINES) throw new Error('too-many-lines');
            }
          }
        }
        // Odd trailing byte in this chunk → carry it to the next.
        carry = i < bytesRead ? buf[i]! : -1;
      }

      filePos += bytesRead;
    }

    return {
      filePath,
      fileSize,
      encoding,
      bomBytes,
      lineOffsets: offsets.toExact(),
      lineCount: offsets.length
    };
  } finally {
    fs.closeSync(fd);
  }
}

/** Byte range `[byteStart, byteEnd)` covering lines `[startLine, endLine)`. */
function byteRangeForLines(index: LogFileIndex, startLine: number, endLine: number): [number, number] {
  const byteStart = index.lineOffsets[startLine]!;
  const byteEnd = endLine >= index.lineCount ? index.fileSize : index.lineOffsets[endLine]!;
  return [byteStart, byteEnd];
}

/** Decode a byte slice with a fresh (non-fatal) decoder. `skipBom` only for the
 *  file's very first bytes; interior ranges never contain a BOM. */
function decodeSlice(buf: Buffer, index: LogFileIndex, skipBom: boolean): string {
  const decoder = new TextDecoder(index.encoding, { fatal: false });
  const body = skipBom && index.bomBytes > 0 ? buf.subarray(index.bomBytes) : buf;
  return decoder.decode(body);
}

/**
 * Split decoded window text into exactly `expected` lines. Splits on `\n` only
 * — matching the index, which counts `\n` bytes — and strips a trailing `\r`
 * per line so `\r\n`-terminated lines render without the carriage return. (Lone
 * `\r` is intentionally NOT treated as a separator: the byte index doesn't
 * count it either, so this keeps line numbers aligned across index / read /
 * search.) The final split element is an empty tail when the slice ended on a
 * newline — dropped so the count lands on `expected`.
 */
function splitWindowText(text: string, expected: number): string[] {
  const parts = text.split('\n');
  // A slice ending in `\n` yields a trailing '' that isn't a real line.
  if (parts.length > expected && parts[parts.length - 1] === '') parts.pop();
  // Defensive: never return more than the index promised for this range.
  if (parts.length > expected) parts.length = expected;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]!.endsWith('\r')) parts[i] = parts[i]!.slice(0, -1);
  }
  return parts;
}

/** Core of `readLineRange` against an already-open fd (so batch callers can
 *  reuse one fd). Clamped range assumed; returns exactly `end - start` lines. */
function readLineRangeFd(index: LogFileIndex, fd: number, start: number, end: number): string[] {
  const [byteStart, byteEnd] = byteRangeForLines(index, start, end);
  const length = byteEnd - byteStart;
  if (length <= 0) return new Array(end - start).fill('');

  const buf = Buffer.alloc(length);
  fs.readSync(fd, buf, 0, length, byteStart);
  const text = decodeSlice(buf, index, /* skipBom */ start === 0);
  const lines = splitWindowText(text, end - start);
  // Pad if the split came up short (e.g. a truncated final read) so callers can
  // index by (lineNumber - start) without bounds surprises.
  while (lines.length < end - start) lines.push('');
  return lines;
}

/**
 * Read a contiguous, half-open line range `[startLine, endLine)` and return one
 * string per line. Clamps to the file's bounds; returns `[]` for an empty range.
 */
export function readLineRange(index: LogFileIndex, startLine: number, endLine: number): string[] {
  const start = Math.max(0, Math.min(startLine, index.lineCount));
  const end = Math.max(start, Math.min(endLine, index.lineCount));
  if (end <= start) return [];

  const fd = fs.openSync(index.filePath, 'r');
  try {
    return readLineRangeFd(index, fd, start, end);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Read a scattered set of line numbers (Filter mode). Groups adjacent requests
 * into contiguous range reads (bridging small gaps so we don't seek per line)
 * and reuses a single fd for the whole batch. Returns `{ line, text }` sorted by
 * line number.
 */
export function readLines(index: LogFileIndex, lineNumbers: number[]): Array<{ line: number; text: string }> {
  const wanted = [...new Set(lineNumbers)]
    .filter((n) => Number.isInteger(n) && n >= 0 && n < index.lineCount)
    .sort((a, b) => a - b);
  if (wanted.length === 0) return [];

  const out: Array<{ line: number; text: string }> = [];
  const fd = fs.openSync(index.filePath, 'r');
  try {
    let runStart = 0;
    while (runStart < wanted.length) {
      // Extend a run while the gap to the next wanted line is small enough that
      // reading the in-between lines is cheaper than a second seek+read.
      let runEnd = runStart;
      while (runEnd + 1 < wanted.length && wanted[runEnd + 1]! - wanted[runEnd]! <= 64) {
        runEnd++;
      }
      const first = wanted[runStart]!;
      const last = wanted[runEnd]!;
      const lines = readLineRangeFd(index, fd, first, last + 1);
      for (let k = runStart; k <= runEnd; k++) {
        const n = wanted[k]!;
        out.push({ line: n, text: lines[n - first] ?? '' });
      }
      runStart = runEnd + 1;
    }
  } finally {
    fs.closeSync(fd);
  }
  return out;
}

export type SearchHit = { line: number; start: number; end: number };
export type SearchResult = {
  hits: SearchHit[];
  /** Ordered, de-duplicated line numbers that contain at least one match. */
  matchLines: number[];
  /** True if either cap was hit — the result is a prefix of the true set. */
  truncated: boolean;
};

/**
 * Scan the whole file for `regex` and collect match ranges + matching line
 * numbers. Streams the file in chunks (never resident whole) and yields to the
 * event loop between chunks so a long scan doesn't freeze the main process.
 *
 * The caller passes an already-compiled global regex (built with the same
 * `buildSearchRegex` the renderer's find bar uses, so match semantics — case,
 * whole-word, regex/literal, ReDoS fallback — are identical).
 *
 * `shouldAbort` is polled between chunks so a newer search can supersede an
 * in-flight one; an aborted scan resolves with whatever it had collected.
 */
export async function searchFile(
  index: LogFileIndex,
  regex: RegExp,
  shouldAbort: () => boolean
): Promise<SearchResult> {
  const hits: SearchHit[] = [];
  const matchLines: number[] = [];
  let truncated = false;

  const matchLine = (raw: string, line: number): void => {
    // Match against the *display* text — ANSI-stripped + truncated, exactly what
    // the renderer paints — so hit offsets land on the right characters when the
    // find bar maps them into the rendered content. `consoleDisplayText` also
    // absorbs the trailing `\r`. See `parseConsoleLine` for the 1:1 contract.
    const text = consoleDisplayText(raw.endsWith('\r') ? raw.slice(0, -1) : raw);
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    let matchedThisLine = false;
    while ((m = regex.exec(text)) !== null) {
      if (hits.length < LOG_VIEWER_MAX_SEARCH_HITS) {
        hits.push({ line, start: m.index, end: m.index + m[0].length });
      } else {
        truncated = true;
      }
      if (!matchedThisLine) {
        matchedThisLine = true;
        if (matchLines.length < LOG_VIEWER_MAX_MATCH_LINES) matchLines.push(line);
        else truncated = true;
      }
      if (m[0].length === 0) regex.lastIndex++;
    }
  };

  const { aborted } = await streamFileLines(index, matchLine, shouldAbort);
  return { hits, matchLines, truncated: truncated || aborted };
}

/**
 * Stream every line of the indexed file to `onLine(text, lineNo)`, chunked so the file is never
 * resident whole, yielding to the event loop between chunks so a long scan doesn't freeze main.
 * `shouldAbort` is polled between chunks; a mid-scan abort resolves `{ aborted: true }`. Shared by
 * {@link searchFile} and {@link scanFileFindings} so the chunk/decode/newline-carry logic lives once.
 */
async function streamFileLines(
  index: LogFileIndex,
  onLine: (rawLine: string, lineNo: number) => void,
  shouldAbort: () => boolean
): Promise<{ aborted: boolean }> {
  const fd = fs.openSync(index.filePath, 'r');
  const buf = Buffer.alloc(SCAN_CHUNK_BYTES);
  const decoder = new TextDecoder(index.encoding, { fatal: false });
  let filePos = index.bomBytes;
  let lineNo = 0;
  // Carry of the last, not-yet-newline-terminated line across chunk reads.
  let pending = '';
  let aborted = false;

  try {
    while (filePos < index.fileSize) {
      if (shouldAbort()) {
        aborted = true;
        break;
      }
      const n = fs.readSync(fd, buf, 0, SCAN_CHUNK_BYTES, filePos);
      if (n <= 0) break;
      filePos += n;
      const chunkText = decoder.decode(buf.subarray(0, n), { stream: true });
      const combined = pending + chunkText;
      const nlIdx = combined.lastIndexOf('\n');
      if (nlIdx < 0) {
        pending = combined;
        // Still allow the event loop to breathe on huge no-newline files.
        await new Promise<void>((r) => setImmediate(r));
        continue;
      }
      const ready = combined.slice(0, nlIdx); // excludes the trailing '\n'
      pending = combined.slice(nlIdx + 1);
      const lines = ready.split('\n');
      for (const text of lines) {
        onLine(text, lineNo++);
      }
      // Yield between chunks so the main-process event loop stays responsive.
      await new Promise<void>((r) => setImmediate(r));
    }
    // Final partial line (file without a trailing newline).
    if (!aborted && !shouldAbort() && pending.length > 0) {
      onLine(pending, lineNo++);
    }
  } finally {
    fs.closeSync(fd);
  }

  return { aborted };
}

/**
 * Whole-file Console Monitor scan: recognize BrightScript issues on every line and aggregate them via
 * the shared {@link computeConsoleFindings} (the single source of truth also used by the live Console
 * and the `console_monitor_findings` MCP tool). Only issue lines are retained during the scan, so
 * memory stays bounded even on very large files. `scannedLines` is the total lines examined.
 */
export async function scanFileFindings(
  index: LogFileIndex,
  shouldAbort: () => boolean
): Promise<{ findings: ConsoleFindings; scannedLines: number; truncated: boolean }> {
  // `index` carries the 0-based file line number so the Console Monitor can jump straight to an
  // occurrence in the Log Viewer (see `ConsoleFindingLine.indices`).
  const issueLines: { text: string; index: number }[] = [];
  let scannedLines = 0;
  const onLine = (raw: string, lineNo: number): void => {
    // Match the *display* text (ANSI-stripped, trailing \r absorbed) — the same 1:1 contract the find
    // scan and the renderer's line rendering use, so recognition sees exactly what's on screen.
    const text = consoleDisplayText(raw.endsWith('\r') ? raw.slice(0, -1) : raw);
    scannedLines++;
    if (recognizeBrsIssue(text)) issueLines.push({ text, index: lineNo });
  };
  const { aborted } = await streamFileLines(index, onLine, shouldAbort);
  return { findings: computeConsoleFindings(issueLines), scannedLines, truncated: aborted };
}

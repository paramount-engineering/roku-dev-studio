/**
 * Windowed data model for the standalone Log Viewer.
 *
 * The renderer no longer holds the whole file. Instead this model keeps a small
 * *sliding window* of parsed lines resident (≈ a few MB) while the virtualizer's
 * scrollbar still spans the entire file. It sits between the virtualizer's
 * index space and the main-process byte-range readers:
 *
 *   - **View index → file line.** In normal (Find) mode the mapping is the
 *     identity: view row `i` is file line `i`. In Filter mode the view collapses
 *     to matching lines, so view row `i` is `matchLines[i]` — a scattered file
 *     line. `viewCount()` is the virtualizer's row count for the active mode.
 *   - **Resident window.** Only lines in `[residentStart, residentEnd)`
 *     (view-index space) are parsed and held in `resident`. As the viewport
 *     moves (`ensureWindow`, driven by the virtualizer's `onRangeChange`), the
 *     window slides: a new byte range is pulled from main, parsed 1:1 via
 *     `parseConsoleLine`, and swapped in — the old window is dropped, bounding
 *     memory.
 *   - **`entries` proxy.** The object handed to `mountConsoleLogSurface`. Index
 *     access returns the resident entry for that view row, or a blank
 *     placeholder while its window loads; `.length` returns `viewCount()`. The
 *     virtualizer only ever touches the visible window, so the proxy is never
 *     iterated wholesale.
 *
 * 1:1 parsing (`parseConsoleLine`, not the batch parser) is essential: the byte
 * index counts raw `\n`, whole-file search returns raw line numbers, and the
 * scrollbar is sized to the raw line count — all three must agree with the
 * rendered rows, so blank lines and `[DEBUG]`-prefix lines are NOT collapsed.
 */

import type { ConsoleLogFileEntry } from '../../modules/console-log/console-log-file-view.js';
import { parseConsoleLine } from '../../modules/console-log/console-line-parser.js';

/** Minimal surface hooks the model needs after mount (subset of
 *  `ConsoleLogSurfaceHandle`). Kept structural so the model doesn't depend on
 *  the full surface type. */
export type WindowModelSurface = {
  remountVisible(): void;
  setCount(n: number): void;
};

export type LogFileWindowModelConfig = {
  lineCount: number;
  fileSize: number;
  /** Read a contiguous half-open line range; resolves `null` on failure. */
  readRange: (startLine: number, endLine: number) => Promise<string[] | null>;
  /** Read scattered line numbers (Filter mode); resolves `null` on failure. */
  readLines: (lines: number[]) => Promise<Array<{ line: number; text: string }> | null>;
  /** Reset the scroll container to the top (called on Filter enter/exit so the
   *  reshaped virtual list starts at row 0 rather than a clamped stale offset). */
  scrollToTop?: () => void;
};

export type LogFileWindowModel = {
  /** The `entries`-shaped proxy to hand to `mountConsoleLogSurface`. */
  readonly entries: ConsoleLogFileEntry[];
  /** Call once after the surface is mounted so window loads can drive it. */
  bindSurface(surface: WindowModelSurface): void;
  /** Slide the resident window to cover `[viewStart, viewEnd)`. Wire this to
   *  the surface's `onRangeChange`. Debounced; cheap when already covered. */
  ensureWindow(viewStart: number, viewEnd: number): void;
  /** Collapse the view to `matchLines` (file line numbers) for Filter mode, or
   *  pass `null` to restore the full-file view. Idempotent for `null`. */
  setFilter(matchLines: number[] | null): void;
  /** Current virtualizer row count for the active mode. */
  viewCount(): number;
  /** What Copy / Cmd+A should export: the whole file, or just the matching
   *  lines when a filter is active. The viewer reads the actual text from main. */
  exportSpec(): { kind: 'all' } | { kind: 'lines'; lines: number[] };
  dispose(): void;
};

/** Target resident text size. 8 MB keeps us comfortably under the old 36 MB
 *  budget even after parse-object overhead, while spanning enough lines that
 *  normal scrolling rarely crosses a window boundary. */
const TARGET_WINDOW_BYTES = 8 * 1024 * 1024;
const MIN_WINDOW_LINES = 2000;
const MAX_WINDOW_LINES = 200_000;
/**
 * Filter-mode window cap. Matching lines are scattered across the file, so a
 * resident window of N matching lines can span a huge byte range and needs N
 * individual line reads (bridged only across small gaps). Keeping the filter
 * window modest bounds that read cost while still covering many viewport-heights
 * of matches; memory is a non-issue since it's only N single lines.
 */
const FILTER_WINDOW_LINES = 4000;
/** Debounce for window loads during continuous scroll (ms). */
const LOAD_DEBOUNCE_MS = 40;

function makePlaceholder(): ConsoleLogFileEntry {
  // Blank row while the window loads. `timestamp: null` matches parsed entries.
  return { text: '', timestamp: null, type: 'log' };
}

export function createLogFileWindowModel(cfg: LogFileWindowModelConfig): LogFileWindowModel {
  const avgLineBytes = cfg.lineCount > 0 ? cfg.fileSize / cfg.lineCount : 200;
  const windowLines = Math.max(
    MIN_WINDOW_LINES,
    Math.min(MAX_WINDOW_LINES, Math.round(TARGET_WINDOW_BYTES / Math.max(1, avgLineBytes)))
  );
  /** Preload margin: reload once the viewport comes within this many rows of a
   *  resident edge, so the next window is fetched before the user hits blanks. */
  const margin = Math.min(500, windowLines >> 2);

  let mode: 'normal' | 'filter' = 'normal';
  let matchLines: number[] = [];

  /** file line → parsed entry, for the current resident window only. */
  const resident = new Map<number, ConsoleLogFileEntry>();
  /** Resident coverage in view-index space: `[residentStart, residentEnd)`. */
  let residentStart = 0;
  let residentEnd = 0;

  let loadToken = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingStart = 0;
  let pendingEnd = 0;
  let surface: WindowModelSurface | null = null;

  const viewCount = (): number => (mode === 'normal' ? cfg.lineCount : matchLines.length);
  const viewToFileLine = (viewIndex: number): number =>
    mode === 'normal' ? viewIndex : (matchLines[viewIndex] ?? -1);

  const toEntry = (text: string): ConsoleLogFileEntry => ({ timestamp: null, ...parseConsoleLine(text) });

  function getViewEntry(viewIndex: number): ConsoleLogFileEntry {
    if (viewIndex < 0 || viewIndex >= viewCount()) return makePlaceholder();
    const fileLine = viewToFileLine(viewIndex);
    if (fileLine < 0) return makePlaceholder();
    return resident.get(fileLine) ?? makePlaceholder();
  }

  // The proxy the surface/virtualizer/find-bar read through. Only integer index
  // access and `.length` are trapped; everything else falls through so the few
  // array methods the stack might touch still behave.
  const entries = new Proxy([] as ConsoleLogFileEntry[], {
    get(target, prop, receiver) {
      if (prop === 'length') return viewCount();
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return getViewEntry(Number(prop));
      return Reflect.get(target, prop, receiver);
    }
  }) as ConsoleLogFileEntry[];

  async function loadWindow(newStart: number, newEnd: number): Promise<void> {
    const token = ++loadToken;
    const built = new Map<number, ConsoleLogFileEntry>();

    if (mode === 'normal') {
      const lines = await cfg.readRange(newStart, newEnd);
      if (token !== loadToken) return; // superseded by a newer load
      if (!lines) return;
      for (let i = 0; i < lines.length; i++) built.set(newStart + i, toEntry(lines[i]!));
    } else {
      const fileLines = matchLines.slice(newStart, newEnd);
      const rows = await cfg.readLines(fileLines);
      if (token !== loadToken) return;
      if (!rows) return;
      for (const { line, text } of rows) built.set(line, toEntry(text));
    }

    // Swap the whole window (drop the previous one — that's what bounds memory).
    resident.clear();
    for (const [k, v] of built) resident.set(k, v);
    residentStart = newStart;
    residentEnd = newEnd;
    surface?.remountVisible();
  }

  function scheduleLoad(newStart: number, newEnd: number): void {
    pendingStart = newStart;
    pendingEnd = newEnd;
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    const run = (): void => {
      debounceTimer = undefined;
      void loadWindow(pendingStart, pendingEnd);
    };
    // First fetch (empty resident set) is immediate for fast first paint;
    // subsequent scroll-driven fetches debounce so a fast drag issues one read.
    if (resident.size === 0) run();
    else debounceTimer = setTimeout(run, LOAD_DEBOUNCE_MS);
  }

  function ensureWindow(viewStart: number, viewEnd: number): void {
    const vc = viewCount();
    if (vc === 0) return;
    // Filter mode's window is capped: its "lines" are scattered file lines, so a
    // large window means many individual reads.
    const effectiveWindow = mode === 'filter' ? Math.min(windowLines, FILTER_WINDOW_LINES) : windowLines;
    const start = Math.max(0, Math.min(viewStart, vc));
    const end = Math.max(start, Math.min(viewEnd, vc));

    const haveWindow = residentEnd > residentStart;
    const comfortablyInside =
      haveWindow && start >= residentStart + margin && end <= residentEnd - margin;
    // Also comfortable when the resident window already reaches the file edge
    // adjacent to the viewport (can't preload past 0 / vc).
    const atHeadEdge = residentStart === 0 && start >= residentStart;
    const atTailEdge = residentEnd === vc && end <= residentEnd;
    if (haveWindow && (comfortablyInside || (atHeadEdge && end <= residentEnd - margin) || (atTailEdge && start >= residentStart + margin))) {
      return;
    }

    const center = Math.floor((start + end) / 2);
    let newStart = Math.max(0, center - (effectiveWindow >> 1));
    let newEnd = Math.min(vc, newStart + effectiveWindow);
    newStart = Math.max(0, newEnd - effectiveWindow);
    if (haveWindow && newStart === residentStart && newEnd === residentEnd) return;
    scheduleLoad(newStart, newEnd);
  }

  function setFilter(lines: number[] | null): void {
    if (lines === null) {
      if (mode === 'normal') return; // idempotent
      mode = 'normal';
      matchLines = [];
    } else {
      mode = 'filter';
      matchLines = lines;
    }
    // New view space: invalidate the resident window + any in-flight load.
    loadToken++;
    resident.clear();
    residentStart = 0;
    residentEnd = 0;
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    cfg.scrollToTop?.();
    // setCount relayouts the virtualizer to the new row count and fires
    // onRangeChange, which calls ensureWindow → loads the top window.
    surface?.setCount(viewCount());
  }

  return {
    entries,
    bindSurface(s) {
      surface = s;
    },
    ensureWindow,
    setFilter,
    viewCount,
    exportSpec() {
      return mode === 'filter' ? { kind: 'lines', lines: matchLines.slice() } : { kind: 'all' };
    },
    dispose() {
      loadToken++;
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      resident.clear();
      surface = null;
    }
  };
}

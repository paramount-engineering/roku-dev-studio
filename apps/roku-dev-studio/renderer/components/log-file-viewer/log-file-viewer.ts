import type { ConsoleLogFileEntry } from '../../modules/console-log/console-log-file-view.js';
import { setConsoleViewerModalTitlePrefix } from '../../modules/console-log/console-modal-title.js';
import { mountConsoleLogSurface } from '../../modules/console-log/mount-console-log-surface.js';
import {
  createConsoleLineParserState,
  parseConsoleLineBatch
} from '../../modules/console-log/console-line-parser.js';

/**
 * Local typed view of `window.roku` for this renderer window. Declared as a
 * file-local cast (not `declare global`) because the main window has a
 * different (broader) `roku` surface from `renderer-globals.d.ts`, and a
 * conflicting global `Window.roku` declaration in this file would override
 * that and break the Console panel's IPC bridges. See `log-viewer-preload.ts`
 * for the IPC shape.
 */
type LogViewerRokuApi = {
  loadLogViewerFile: () => Promise<{
    success: boolean;
    fileName?: string;
    fileSize?: number;
    error?: string;
  }>;
  onLogViewerChunk: (
    cb: (data: { text: string; doneBytes: number; totalBytes: number }) => void
  ) => () => void;
  onLogViewerComplete: (cb: () => void) => () => void;
  onLogViewerError: (cb: (data: { error: string }) => void) => () => void;
  copyToClipboard: (text: string) => Promise<unknown>;
  openExternal: (url: string) => Promise<unknown>;
  saveConsoleLogs: (
    content: string
  ) => Promise<{ success: boolean; error?: string; filePath?: string }>;
};

const rokuApi = window.roku as unknown as LogViewerRokuApi;

async function main() {
  // DOM refs first — the lazy-mount path inside the chunk handler needs
  // these in scope. Listeners are wired below; chunk events arrive on the
  // next tick after the load invoke resolves, so the closure values are
  // populated by the time they're read.
  const statusEl = document.getElementById('logViewerStatus');
  const titleEl = document.getElementById('logViewerTitle');
  const outputEl = document.getElementById('logViewerOutput');
  const headerEl = document.getElementById('logViewerHeader');
  const findHostEl = document.getElementById('logViewerFindHost');
  const actionsEl = document.getElementById('logViewerActions');
  const copyBtn = actionsEl?.querySelector<HTMLButtonElement>('.log-viewer-copy-btn') ?? null;
  const saveBtn = actionsEl?.querySelector<HTMLButtonElement>('.log-viewer-save-btn') ?? null;

  if (!(outputEl instanceof HTMLElement)) return;

  // Streaming load state. The model (`entries`) is mutated as chunks
  // arrive; the surface observes the same array reference and is told to
  // relayout via `notifyAppended()` after each chunk.
  const entries: ConsoleLogFileEntry[] = [];
  let surface: ReturnType<typeof mountConsoleLogSurface> | null = null;
  let totalBytes = 0;
  let receivedAnyChunk = false;
  let streamErrored = false;
  let streamComplete = false;
  let fileName = 'unknown';
  /**
   * Parser state carried across chunks. The `[DEBUG]`-on-its-own-line prefix
   * can land at the boundary of one chunk with its continuation in the next;
   * `parseConsoleLineBatch` reads + writes `state.pendingLogPrefix` to bridge
   * that case.
   */
  const parserState = createConsoleLineParserState();
  /**
   * Tail of the previous chunk that wasn't terminated by a newline yet. We
   * carry it forward so a line split across the chunk boundary parses as
   * one line on the next chunk's tick. Without this, the boundary line
   * would be treated as two separate (truncated) entries.
   */
  let lineBuffer = '';

  function setStatus(message: string, isError = false): void {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle('log-viewer-status--error', isError);
  }

  function updateProgressStatus(doneBytes: number): void {
    if (!statusEl || streamErrored) return;
    if (streamComplete) {
      // Final state — show entry count, not a "loaded" suffix; mirrors the
      // earlier non-streaming UX.
      statusEl.textContent = `${entries.length.toLocaleString()} lines`;
      return;
    }
    const pct = totalBytes > 0 ? Math.min(100, Math.round((doneBytes / totalBytes) * 100)) : 0;
    statusEl.textContent = `${entries.length.toLocaleString()} lines (Loading ${pct}%)`;
  }

  /**
   * Brief, transient feedback in the status row. Used by Cmd+A and the
   * Copy button so the user gets a confirmation without us spawning a toast
   * stack. The status caption (line count) is restored after a short delay.
   */
  function flashStatus(message: string): void {
    if (!statusEl) return;
    const prev = statusEl.textContent ?? '';
    const wasError = statusEl.classList.contains('log-viewer-status--error');
    statusEl.textContent = message;
    statusEl.classList.remove('log-viewer-status--error');
    window.setTimeout(() => {
      statusEl.textContent = prev;
      if (wasError) statusEl.classList.add('log-viewer-status--error');
    }, 1500);
  }

  /** Mount the surface lazily on the first chunk so the user sees actual
   *  content (not just the empty scaffold) on first paint. The surface
   *  works fine over an array we keep mutating; subsequent chunks just
   *  push entries and call `surface.notifyAppended()`. */
  function ensureSurfaceMounted(): void {
    if (surface) return;
    surface = mountConsoleLogSurface({
      outputEl: outputEl as HTMLElement,
      entries,
      findBarHost: headerEl,
      onSelectAll: () => {
        const text = surface?.getVisibleText() ?? '';
        if (!text) {
          flashStatus('Nothing to copy');
          return;
        }
        void rokuApi.copyToClipboard(text).then(
          () => flashStatus('Copied entire log to clipboard'),
          () => flashStatus('Copy failed')
        );
      }
    });
  }

  /**
   * Parse one chunk into entries and append them. Cross-chunk line
   * boundaries are handled by `lineBuffer`: the unterminated tail of each
   * chunk is held back, then prepended to the next chunk's text. The final
   * flush after `Complete` runs `processChunk('', true)` so any trailing
   * line (file without a final `\n`) reaches the parser.
   */
  function processChunk(text: string, final: boolean): void {
    const combined = lineBuffer + text;
    let toParse: string;
    if (final) {
      toParse = combined;
      lineBuffer = '';
    } else {
      const lastNewline = combined.lastIndexOf('\n');
      if (lastNewline < 0) {
        // No newline in this chunk yet — buffer the whole thing and wait.
        lineBuffer = combined;
        return;
      }
      toParse = combined.slice(0, lastNewline + 1);
      lineBuffer = combined.slice(lastNewline + 1);
    }

    // Match the file viewer's existing whole-text normalization: collapse
    // `\r\n` / `\r` to `\n` before splitting. The shared parser expects
    // pre-split lines.
    const lines = toParse.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const parsed = parseConsoleLineBatch(parserState, lines);
    if (parsed.length === 0) return;

    for (const p of parsed) {
      entries.push({
        text: p.text,
        timestamp: null,
        type: p.type,
        ...(p.structuredTargets ? { structuredTargets: p.structuredTargets } : {})
      });
    }

    ensureSurfaceMounted();
    surface?.notifyAppended();
  }

  // Wire chunk listeners *before* starting the stream so we don't drop a
  // chunk that arrives in the same microtask as the invoke resolution.
  // Disposers kept for symmetry but not currently called — the log viewer
  // window is single-load per session.
  rokuApi.onLogViewerChunk((data) => {
    if (streamErrored || streamComplete) return;
    receivedAnyChunk = true;
    if (data.totalBytes > 0) totalBytes = data.totalBytes;
    processChunk(data.text, false);
    updateProgressStatus(data.doneBytes);
  });
  rokuApi.onLogViewerComplete(() => {
    if (streamErrored) return;
    streamComplete = true;
    if (lineBuffer.length > 0) {
      // Flush any trailing buffered line (file with no final `\n`).
      processChunk('', true);
    }
    // Cold-start corner case: the file had no parseable content (empty
    // file, ANSI-only, or all blank lines). Mount the surface anyway so
    // the user sees an empty scrollable area instead of a blank window.
    ensureSurfaceMounted();
    updateProgressStatus(totalBytes);
  });
  rokuApi.onLogViewerError((data) => {
    streamErrored = true;
    setStatus(data.error || 'Could not load file', true);
  });

  // First status line — gives the user immediate "loading started" feedback,
  // even if the first chunk takes a moment to arrive on a large file.
  setStatus('Loading…');
  findHostEl?.removeAttribute('hidden');
  if (actionsEl) actionsEl.removeAttribute('hidden');

  let res: Awaited<ReturnType<typeof rokuApi.loadLogViewerFile>>;
  try {
    res = await rokuApi.loadLogViewerFile();
  } catch (e: unknown) {
    setStatus(e instanceof Error ? e.message : 'Could not load file', true);
    return;
  }
  if (!res.success) {
    setStatus(res.error || 'Could not load file', true);
    return;
  }

  if (res.fileName) {
    fileName = res.fileName;
    setConsoleViewerModalTitlePrefix(res.fileName);
    if (titleEl) {
      titleEl.textContent = res.fileName;
    }
    document.title = `Log Viewer ♦ ${res.fileName}`;
  }
  if (typeof res.fileSize === 'number') totalBytes = res.fileSize;

  // Replace the generic "Loading…" placeholder with the structured progress
  // line now that we know the total size. If a chunk has already arrived
  // (extremely fast files), `updateProgressStatus` was already called from
  // the chunk handler — the explicit update here is a no-op for that case
  // because `streamComplete` already gated to the final form.
  if (!receivedAnyChunk && !streamErrored && !streamComplete) {
    setStatus(`0 lines (Loading 0%)`);
  }

  // Copy / Save header buttons — file-viewer-specific chrome (the Console
  // panel exposes the same actions via different markup). Both go through
  // `surface.getVisibleText()` so a future filter-rule change lands in
  // exactly one place.
  copyBtn?.addEventListener('click', async () => {
    if (!surface) {
      flashStatus('Still loading…');
      return;
    }
    const text = surface.getVisibleText();
    if (!text) {
      flashStatus('Nothing to copy');
      return;
    }
    try {
      await rokuApi.copyToClipboard(text);
      flashStatus('Copied to clipboard');
    } catch {
      flashStatus('Copy failed');
    }
  });

  saveBtn?.addEventListener('click', async () => {
    if (!surface) {
      flashStatus('Still loading…');
      return;
    }
    const text = surface.getVisibleText();
    if (!text) {
      flashStatus('Nothing to save');
      return;
    }
    // Header block matches the live Console save format so log files dropped
    // by either surface look the same to downstream tools.
    const headerBlock = [
      '='.repeat(80),
      'Roku Log File',
      `Source: ${fileName}`,
      `Saved: ${new Date().toLocaleString()}`,
      `Total Lines: ${text.split('\n').length}`,
      '='.repeat(80),
      ''
    ].join('\n');
    saveBtn.disabled = true;
    try {
      const result = await rokuApi.saveConsoleLogs(headerBlock + text);
      flashStatus(result.success ? 'Saved' : `Save failed: ${result.error ?? 'Unknown'}`);
    } catch (e) {
      flashStatus(e instanceof Error ? `Save failed: ${e.message}` : 'Save failed');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

void main();

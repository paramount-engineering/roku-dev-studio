/**
 * Parse plain log file text into console-style entries and render into a .telnet-output container.
 * Reuses URL / JSON / XML affordances from the device Console (telnet) stack.
 */
import { detectStructuredConsoleLine, type StructuredConsolePayload } from './structured-log-detect.js';
import { stripAnsiForConsole } from './telnet-console-buffer.js';
import {
  clearJsonPlusRangesForLine,
  paintJsonPlusRangesForLine
} from './telnet-json-plus-highlight.js';
import { populateTelnetLineContentWithUrls } from './telnet-url-detect.js';
import { createTelnetVirtualizer } from './telnet-virtualizer.js';
import {
  attachStructuredPillsToLine,
  clickedStructuredTargetIndex,
  closestTelnetLogLineFromEvent,
  firstHitElementOnTelnetClick,
  openTelnetStructuredViewer
} from './telnet-structured-view-modal.js';
import { openTelnetUrlViewer } from './telnet-url-modal.js';
import { classifyLogLine } from './console-log-classify.js';

export type ConsoleLogFileEntry = {
  text: string;
  timestamp: string | null;
  type: string;
  structuredTargets?: StructuredConsolePayload[];
};

const MAX_LINE_CHARS = 120_000;
const DEFER_HEAVY_LINE_CHARS = 6000;

/** Same line-splitting rules as Telnet console ingest (prefix lines, ANSI strip, structure detect). */
export function rawLogFileTextToEntries(raw: string, includeTimestamps = false): ConsoleLogFileEntry[] {
  const entries: ConsoleLogFileEntry[] = [];
  let pendingLogPrefix = '';

  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  for (const line of lines) {
    if (!line || line.trim() === '') continue;

    const logLevelOnlyMatch = line.match(/^\s*\[(DEBUG|INFO|WARN|WARNING|ERROR|FATAL|TRACE)\]\s*$/i);
    if (logLevelOnlyMatch) {
      pendingLogPrefix = line.trim() + ' ';
      continue;
    }

    let fullLine = line;
    if (pendingLogPrefix) {
      if (/^\s+/.test(line)) {
        fullLine = pendingLogPrefix + line.trim();
      } else {
        fullLine = pendingLogPrefix + line;
      }
      pendingLogPrefix = '';
    }

    const displayLine = stripAnsiForConsole(fullLine);
    if (!displayLine.trim()) continue;

    let textLine = displayLine;
    if (displayLine.length > MAX_LINE_CHARS) {
      const over = displayLine.length - MAX_LINE_CHARS;
      textLine = `${displayLine.slice(0, MAX_LINE_CHARS)} \u2026 [truncated ${over} chars]`;
    }

    const detected =
      textLine.length < DEFER_HEAVY_LINE_CHARS ? detectStructuredConsoleLine(textLine) : [];

    entries.push({
      text: textLine,
      timestamp: includeTimestamps ? new Date().toLocaleTimeString() : null,
      type: classifyLogLine(textLine),
      ...(detected.length ? { structuredTargets: detected } : {})
    });
  }

  return entries;
}

/**
 * Build a `.telnet-log-line` for `entries[index]`. Used as the virtualizer's
 * `createLineEl` callback — fires once per row when it scrolls into view.
 *
 * Differs from the pre-virtualization implementation in two ways:
 *   1. Heavy-line URL detection runs *synchronously* now instead of being deferred
 *      to a setTimeout. Virtualization caps the number of in-flight lines at the
 *      visible window (~40), so per-frame work is bounded — the original defer
 *      strategy was a workaround for "we just appended 180k lines, please don't
 *      detect URLs for all of them at once" which no longer applies.
 *   2. The caller (mountConsoleLogFileView) handles JSON+ paint and find-range
 *      bind via the virtualizer's onMount callback, *not* this function. This
 *      keeps the DOM-build step pure — no side effects on the highlight registry.
 */
function buildLogLineElement(entry: ConsoleLogFileEntry, index: number): HTMLElement {
  const lineEl = document.createElement('div');
  lineEl.className = `telnet-log-line ${entry.type}`.trim();
  lineEl.dataset.lineIndex = String(index);

  if (entry.timestamp) {
    const timestampEl = document.createElement('span');
    timestampEl.className = 'telnet-log-timestamp';
    timestampEl.textContent = `[${entry.timestamp}]`;
    lineEl.appendChild(timestampEl);
  }

  const contentEl = document.createElement('span');
  contentEl.className = 'telnet-log-content';
  populateTelnetLineContentWithUrls(contentEl, entry.text);
  lineEl.appendChild(contentEl);

  // Heavy lines (>=6KB) had structured detection skipped during parse to keep
  // `rawLogFileTextToEntries` fast. Now that the row is actually visible, run
  // detection — bounded by the visible window size, not file size.
  if (!entry.structuredTargets?.length && entry.text.length >= DEFER_HEAVY_LINE_CHARS) {
    const d = detectStructuredConsoleLine(entry.text);
    if (d.length) entry.structuredTargets = d;
  }

  if (entry.structuredTargets?.length) {
    attachStructuredPillsToLine(lineEl, contentEl, entry.structuredTargets);
  }

  return lineEl;
}

/**
 * Handle returned from `mountConsoleLogFileView`. Exposes the parsed entries plus a
 * DOM lookup so the find bar can search the model directly (and map flat-string
 * offsets back to DOM positions for CSS-Custom-Highlight painting) without ever
 * walking the rendered DOM. See `telnet-output-find-bar.ts → TelnetFindModel`.
 */
export type ConsoleLogFileViewHandle = {
  getEntryCount(): number;
  getEntryText(lineIndex: number): string | undefined;
  getLineEl(lineIndex: number): HTMLElement | null;
  forEachMountedLine(cb: (lineIndex: number, lineEl: HTMLElement) => void): void;
  /** Programmatic scroll-into-view for `entries[index]` (mounts the row if it's
   *  currently virtualized out, then scrolls). Used by the find bar to reveal
   *  the active match. */
  scrollToIndex(index: number, opts?: { align?: 'auto' | 'start' | 'center' | 'end' }): void;
};

export type MountConsoleLogFileViewOpts = {
  /** Fires after a row is created and inserted into the DOM. The find bar wires
   *  this to `bindLineHighlights` so search hits paint as soon as the line scrolls
   *  into view. */
  onLineMount?: (lineIndex: number, lineEl: HTMLElement) => void;
  /** Fires before a row is removed from the DOM (scrolled out of the visible
   *  window). The find bar wires this to `unbindLineHighlights` so detached text
   *  nodes don't linger in the highlight registry. */
  onLineUnmount?: (lineIndex: number, lineEl: HTMLElement) => void;
};

/**
 * Default row-height estimate fed to the virtualizer. Real heights are read via
 * `measureElement` once each row is in the DOM, so this only affects the very
 * first paint (and the spacer height before any row has been measured).
 *
 * 18 ≈ a single visual line at the configured monospace stack + line-height; a
 * wrapped multi-line log entry resolves to its true height on its first frame.
 */
const ESTIMATE_LINE_HEIGHT_PX = 18;

/**
 * Mount a virtualized log-file view. Only the visible window of `entries` is in
 * the DOM at any one time — typically ~40 rows regardless of `entries.length`.
 *
 * onLineMount / onLineUnmount fire whenever the visible window shifts (scroll,
 * resize). Consumers wire these to the find bar's `bindLineHighlights` /
 * `unbindLineHighlights` so search highlights track the visible rows.
 */
export function mountConsoleLogFileView(
  outputEl: HTMLElement,
  entries: ConsoleLogFileEntry[],
  opts: MountConsoleLogFileViewOpts = {}
): ConsoleLogFileViewHandle {
  // Idempotency guard: callers may re-mount on hot-reload. Tear down any prior
  // virtualizer (its rows were children of `outputEl`) before building afresh.
  if (outputEl.dataset.logViewerBound === '1') {
    outputEl.textContent = '';
  }
  outputEl.dataset.logViewerBound = '1';
  outputEl.textContent = '';

  const logLines = entries;

  // The virtualizer wants a tall spacer container *inside* the scroll element
  // whose height equals the total scrollable size. Rows are absolutely
  // positioned children of that container.
  const containerEl = document.createElement('div');
  containerEl.className = 'telnet-log-virtual-container';
  outputEl.appendChild(containerEl);

  const virtualizer = createTelnetVirtualizer({
    scrollEl: outputEl,
    containerEl,
    getCount: () => logLines.length,
    estimateSize: ESTIMATE_LINE_HEIGHT_PX,
    overscan: 8,
    createLineEl: (index) => buildLogLineElement(logLines[index]!, index),
    onMount: (index, lineEl) => {
      // JSON+ inline tint: bind ranges *after* the line is in the DOM so the
      // text-node walker sees the URL spans / structured pill markup.
      const entry = logLines[index];
      if (entry?.structuredTargets?.length) {
        const contentEl = lineEl.querySelector('.telnet-log-content');
        if (contentEl instanceof HTMLElement) {
          paintJsonPlusRangesForLine(lineEl, contentEl, entry.structuredTargets);
        }
      }
      opts.onLineMount?.(index, lineEl);
    },
    onUnmount: (index, lineEl) => {
      // Drop the line's range bindings from the global Highlight registries
      // before the DOM is detached. Without this, the registry would
      // accumulate ranges pointing to garbage-collected text nodes.
      clearJsonPlusRangesForLine(lineEl);
      opts.onLineUnmount?.(index, lineEl);
    }
  });

  // Click delegation lives on `outputEl` (the persistent scroll container), so
  // it survives row mounts/unmounts. Same logic as before — URL spans first,
  // then structured payloads via the click-resolves-to-deepest-target helper.
  outputEl.addEventListener(
    'click',
    (e) => {
      const anchor = firstHitElementOnTelnetClick(e);
      if (!anchor) return;

      const urlHit = anchor.closest('.telnet-log-url');
      if (urlHit instanceof HTMLElement && urlHit.dataset.url) {
        e.preventDefault();
        e.stopPropagation();
        const href = urlHit.dataset.url;
        if (e.metaKey || e.ctrlKey) {
          if (href.startsWith('http://') || href.startsWith('https://')) {
            void window.roku.openExternal(href);
          }
        } else {
          openTelnetUrlViewer(urlHit, href);
        }
        return;
      }

      const contentEl = anchor.closest('.telnet-log-content');
      if (!(contentEl instanceof HTMLElement)) return;
      const line = closestTelnetLogLineFromEvent(e);
      if (!line) return;
      const idx = parseInt(line.dataset.lineIndex || '-1', 10);
      const entry = idx >= 0 ? logLines[idx] : undefined;
      if (!entry?.structuredTargets?.length) return;
      e.preventDefault();
      const targetIdx = clickedStructuredTargetIndex(contentEl, e, entry.structuredTargets);
      const payload = entry.structuredTargets[targetIdx] ?? entry.structuredTargets[0];
      if (!payload) return;
      openTelnetStructuredViewer(line, payload);
    },
    { passive: false }
  );

  return {
    getEntryCount: () => logLines.length,
    getEntryText: (i) => logLines[i]?.text,
    getLineEl: (i) => virtualizer.getLineEl(i),
    forEachMountedLine: (cb) => virtualizer.forEachMounted(cb),
    scrollToIndex: (i, scrollOpts) => virtualizer.scrollToIndex(i, scrollOpts)
  };
}

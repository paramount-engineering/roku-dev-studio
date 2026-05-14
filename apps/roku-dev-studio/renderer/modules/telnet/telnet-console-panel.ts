// @ts-nocheck
import { errMessage } from '../utils/err-message.js';
import { classifyLogLine } from './console-log-classify.js';
import {
  detectStructuredConsoleLine,
  type StructuredConsolePayload
} from './structured-log-detect.js';
import {
  attachStructuredPillsToLine,
  clickedStructuredTargetIndex,
  closestTelnetLogLineFromEvent,
  firstHitElementOnTelnetClick,
  openTelnetStructuredViewer
} from './telnet-structured-view-modal.js';
import { openTelnetUrlViewer } from './telnet-url-modal.js';
import { populateTelnetLineContentWithUrls } from './telnet-url-detect.js';
import {
  clearJsonPlusRangesForLine,
  paintJsonPlusRangesForLine
} from './telnet-json-plus-highlight.js';
import { createTelnetVirtualizer } from './telnet-virtualizer.js';
import { attachTelnetOutputFindBar, telnetFindMatchesQuery } from './telnet-output-find-bar.js';
import { attachViewerShortcuts } from './telnet-viewer-shortcuts.js';
import { TELNET_VIEWER_CLOSED_EVENT } from './telnet-viewer-bridge.js';
import {
  appendTelnetChunk,
  stripAnsiForConsole,
  takeTelnetTail,
  type TelnetLineBufferState
} from './telnet-console-buffer.js';
import { icon, setSafeHTML } from '../index.js';

export type TelnetConsoleDevice = { deviceName?: string; modelName?: string; ip: string };

export type TelnetConsoleApi = {
  ip: string;
  isRemote?: boolean;
  telnetConnect: () => Promise<{ success: boolean; error?: string }>;
  telnetDisconnect: () => Promise<unknown>;
};

export type TelnetLogLine = { text: string; timestamp: string | null; type: string };

export type TelnetLogSnapshot = {
  lines: TelnetLogLine[];
  /** Opaque cursor: pass as `afterCursor` on the next call to get only new lines. */
  cursor: number;
  /** Total lines in the scrollback buffer at time of call. */
  totalLines: number;
  connected: boolean;
};

export type TelnetPanelElement = HTMLElement & {
  _telnetCleanup?: () => void;
  getTelnetLogText?: () => string;
  /**
   * Cursor-aware log snapshot for MCP agents.
   * - `afterCursor` (default 0): skip lines already seen; pass back the previous `cursor`.
   * - `maxLines` (default 500, capped at 2000): max lines returned in one call.
   */
  getTelnetLogSnapshot?: (afterCursor?: number, maxLines?: number) => TelnetLogSnapshot;
  isTelnetConnected?: () => boolean;
  /**
   * Programmatically open the Telnet console connection, exactly as if the
   * user clicked the Connect button. Idempotent: no-op when already connected.
   * Callers (e.g. the Action Script executor) use this instead of synthesizing
   * a `.telnet-connect-btn` click, which would silently fail if the markup
   * changed.
   */
  connectTelnet?: () => Promise<void>;
  /**
   * Programmatically close the Telnet console connection, mirroring the
   * Disconnect button. Idempotent: no-op when already disconnected. Used by
   * the MCP `telnet_disconnect` tool so an agent can release the 8085 socket
   * without having to synthesize a UI click.
   */
  disconnectTelnet?: () => Promise<void>;
};

/**
 * Telnet debug console (8085): connect, scrollback, find/filter, URL + JSON/XML viewers.
 */
export function setupTelnet(
  panel: TelnetPanelElement,
  device: TelnetConsoleDevice,
  api: TelnetConsoleApi,
  { devLog }: { devLog: (...args: unknown[]) => void }
): void {
  devLog('Setting up Telnet Console for:', api.ip, api.isRemote ? '(via relay)' : '(direct)');
  
  // Elements
  const connectBtn = panel.querySelector('.telnet-connect-btn');
  const disconnectBtn = panel.querySelector('.telnet-disconnect-btn');
  const statusEl = panel.querySelector('.telnet-status');
  const statusText = panel.querySelector('.telnet-status-text');
  const outputEl = panel.querySelector('.telnet-output');
  const autoscrollCheckbox = panel.querySelector('.telnet-autoscroll');
  const copyBtn = panel.querySelector('.telnet-copy-btn');
  const saveBtn = panel.querySelector('.telnet-save-btn');
  const clearBtn = panel.querySelector('.telnet-clear-btn');
  
  // Downstream handlers reference statusEl, statusText, disconnectBtn, and clearBtn
  // without null checks. Assert them here so a reused fragment without these nodes
  // fails fast with a clear message instead of NPE'ing much later.
  if (
    !connectBtn ||
    !outputEl ||
    !disconnectBtn ||
    !statusEl ||
    !statusText ||
    !clearBtn
  ) {
    console.error('Telnet console elements not found');
    return;
  }

  // State
  type TelnetLogEntry = {
    text: string;
    timestamp: string | null;
    type: string;
    structuredTargets?: StructuredConsolePayload[];
  };
  let isConnected = false;
  let logLines: TelnetLogEntry[] = [];

  // Find bar is wired below the line-buffer declarations so the model accessors
  // can reference `logLines` directly. Find/filter searches the model, not the DOM.
  const findBarHandle = attachTelnetOutputFindBar({
    root: panel,
    outputEl,
    model: {
      getEntryCount: () => logLines.length,
      getEntryText: (i) => logLines[i]?.text,
      /**
       * Lines are appended in order; `outputEl.children[i]` is the i-th line once
       * the placeholder is removed. Pre-connection (placeholder still present),
       * `logLines` is empty, so this never gets called.
       */
      getLineEl: (i) => virt?.getLineEl(i) ?? null,
      forEachMountedLine: (cb) => virt?.forEachMounted(cb)
    },
    scrollLineIntoView: (i) => virt?.scrollToIndex(i, { align: 'center' })
  });

  // Virtualized rendering of log lines. The virtualizer mounts/unmounts rows
  // as the scroll position changes; `findBarHandle.bindLineHighlights` and the
  // JSON+ painter are wired to its onMount/onUnmount so search highlights and
  // the cyan JSON+ tint follow the visible window. Initialised after the find
  // bar so onMount can route through it.
  const virtualContainerEl = document.createElement('div');
  virtualContainerEl.className = 'telnet-log-virtual-container';
  // Placeholder ("Connect to Roku…") is appended to outputEl elsewhere; we
  // append the container next to it so the placeholder still renders before
  // any data arrives. The placeholder is removed when lines first land
  // (`addLogLinesBatch`) — same flow as before.
  outputEl.appendChild(virtualContainerEl);

  const virt = createTelnetVirtualizer({
    scrollEl: outputEl,
    containerEl: virtualContainerEl,
    getCount: () => logLines.length,
    estimateSize: 18,
    overscan: 8,
    createLineEl: (index) => createLogLineElement(logLines[index]!, index),
    onMount: (index, lineEl) => {
      const entry = logLines[index];
      if (entry?.structuredTargets?.length) {
        const contentEl = lineEl.querySelector('.telnet-log-content');
        if (contentEl instanceof HTMLElement) {
          paintJsonPlusRangesForLine(lineEl, contentEl, entry.structuredTargets);
        }
      }
      findBarHandle?.bindLineHighlights(index, lineEl);
    },
    onUnmount: (index, lineEl) => {
      clearJsonPlusRangesForLine(lineEl);
      findBarHandle?.unbindLineHighlights(index);
    }
  });

  // Console panel shares the main window with other panels, so the shortcut
  // gate uses `panel` as its scope element — keystrokes only get claimed when
  // the Telnet panel is the visible one.
  attachViewerShortcuts({
    findBar: findBarHandle,
    outputEl,
    scopeEl: panel,
    findInputEl: panel.querySelector<HTMLInputElement>('.telnet-find-input')
  });
  let pendingLogPrefix = ''; // Buffer for incomplete log lines like "[DEBUG]" alone
  const telnetTcpState: TelnetLineBufferState = { value: '' };
  /** Complete lines waiting for one DOM flush (coalesces bursty IPC / main-process batches). */
  let pendingTelnetLines: string[] = [];
  /** Paced flush: limits work per frame + spacing so JSON/XML/URL modals and scrolling stay responsive while streaming. */
  let telnetFlushHandle = 0;
  let telnetFlushKind: 'raf' | 'timeout' | null = null;
  let lastTelnetFlushMs = 0;
  const TELNET_STREAM_MAX_LINES_PER_FLUSH = 350;
  const TELNET_STREAM_MIN_FLUSH_INTERVAL_MS = 36;
  /** Long lines: defer DOMParser + URL scan off the ingest path (batched timeouts). */
  const TELNET_DEFER_HEAVY_LINE_CHARS = 6000;
  type TelnetDeferredHeavyLine = {
    entry: TelnetLogEntry;
    lineEl: HTMLElement;
    contentEl: HTMLElement;
  };
  const deferredTelnetHeavyLines: TelnetDeferredHeavyLine[] = [];
  let deferredTelnetDrainTimer: ReturnType<typeof setTimeout> | null = null;

  /** Cap scrollback (see RokDock TERMINAL_MAX_BUFFER_LINES ≈ 5000). Full DOM scroll — no fixed row-height virtualization. */
  const TELNET_MAX_SCROLLBACK_LINES = 10000;
  /** Avoid pathological layout from one enormous string (wrapped pre-wrap still costs a lot). */
  const TELNET_MAX_LINE_CHARS = 120_000;
  let isScrolling = false;
  let userManuallyScrolled = false; // Track if user manually scrolled away from bottom
  let lastScrollTop = 0;

  function isTelnetContentModalOpen(): boolean {
    const s = document.getElementById('telnetStructuredViewerOverlay');
    const u = document.getElementById('telnetUrlViewerOverlay');
    return (
      (s instanceof HTMLElement && s.classList.contains('active')) ||
      (u instanceof HTMLElement && u.classList.contains('active'))
    );
  }

  function clearDeferredTelnetHeavyLines() {
    deferredTelnetHeavyLines.length = 0;
    if (deferredTelnetDrainTimer != null) {
      clearTimeout(deferredTelnetDrainTimer);
      deferredTelnetDrainTimer = null;
    }
  }

  function scheduleDeferredTelnetDrain() {
    if (deferredTelnetDrainTimer != null) return;
    if (deferredTelnetHeavyLines.length === 0) return;

    deferredTelnetDrainTimer = setTimeout(() => {
      deferredTelnetDrainTimer = null;
      const sliceStart = performance.now();

      while (deferredTelnetHeavyLines.length > 0) {
        if (isTelnetContentModalOpen()) {
          return;
        }
        if (performance.now() - sliceStart > 14) {
          scheduleDeferredTelnetDrain();
          return;
        }

        const job = deferredTelnetHeavyLines.shift()!;
        if (!job.lineEl.isConnected) continue;

        if (!job.entry.structuredTargets?.length) {
          const d = detectStructuredConsoleLine(job.entry.text);
          if (d.length) {
            job.entry.structuredTargets = d;
            attachStructuredPillsToLine(job.lineEl, job.contentEl, d);
          }
        }

        populateTelnetLineContentWithUrls(job.contentEl, job.entry.text);
        // Repopulating contentEl above replaces all child text nodes, so any
        // stale Range bindings from before the drain are detached. Re-bind.
        if (job.entry.structuredTargets?.length) {
          paintJsonPlusRangesForLine(job.lineEl, job.contentEl, job.entry.structuredTargets);
        }
      }
    }, 1);
  }

  function enqueueDeferredTelnetHeavyLine(job: TelnetDeferredHeavyLine) {
    deferredTelnetHeavyLines.push(job);
    scheduleDeferredTelnetDrain();
  }
  
  // Update UI based on connection state
  function updateConnectionState(connected: boolean, connecting = false, error: string | null = null) {
    isConnected = connected;
    
    if (connecting) {
      statusEl.className = 'telnet-status connecting';
      statusText.textContent = 'Connecting...';
      connectBtn.disabled = true;
    } else if (connected) {
      statusEl.className = 'telnet-status connected';
      statusText.textContent = 'Connected';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = '';
      
      // Clear placeholder
      const placeholder = outputEl.querySelector('.telnet-placeholder');
      if (placeholder) placeholder.remove();
    } else {
      statusEl.className = error ? 'telnet-status error' : 'telnet-status disconnected';
      statusText.textContent = error ? `Error: ${error}` : 'Disconnected';
      connectBtn.style.display = '';
      connectBtn.disabled = false;
      disconnectBtn.style.display = 'none';
    }
  }
  
  // Create a single log line DOM element
  function createLogLineElement(logEntry: TelnetLogEntry, index: number) {
    const lineEl = document.createElement('div');
    lineEl.className = `telnet-log-line ${logEntry.type}`;
    lineEl.dataset.lineIndex = String(index); // Index into logLines (find / structured viewer)
    
    if (logEntry.timestamp) {
      const timestampEl = document.createElement('span');
      timestampEl.className = 'telnet-log-timestamp';
      timestampEl.textContent = `[${logEntry.timestamp}]`;
      lineEl.appendChild(timestampEl);
    }
    
    const contentEl = document.createElement('span');
    contentEl.className = 'telnet-log-content';
    const deferHeavy = logEntry.text.length >= TELNET_DEFER_HEAVY_LINE_CHARS;
    if (deferHeavy) {
      contentEl.textContent = logEntry.text;
    } else {
      populateTelnetLineContentWithUrls(contentEl, logEntry.text);
    }
    lineEl.appendChild(contentEl);

    if (logEntry.structuredTargets?.length) {
      attachStructuredPillsToLine(lineEl, contentEl, logEntry.structuredTargets);
    }
    // JSON+ inline-tint binding now happens in the virtualizer's `onMount`
    // callback (telnet-console-panel.ts: see virtualizer setup) so we don't
    // double-paint when the line mounts. The deferred-heavy-line drain still
    // re-binds after `populateTelnetLineContentWithUrls` rebuilds contentEl.

    if (deferHeavy) {
      enqueueDeferredTelnetHeavyLine({ entry: logEntry, lineEl, contentEl });
    }

    if (
      findBarHandle &&
      findBarHandle.getMode() === 'filter' &&
      findBarHandle.getQuery() &&
      !telnetFindMatchesQuery(logEntry.text, findBarHandle.getQuery(), findBarHandle.getFindOptions())
    ) {
      lineEl.classList.add('filtered-out');
    }
    
    return lineEl;
  }
  
  function reindexTelnetDomLines() {
    const els = outputEl.querySelectorAll('.telnet-log-line');
    els.forEach((el, i) => {
      if (el instanceof HTMLElement) el.dataset.lineIndex = String(i);
    });
  }

  /** Drop oldest lines from memory + DOM when over cap; preserve scroll offset. */
  function ensureTelnetScrollbackRoom(linesToAdd: number) {
    let overflow = logLines.length + linesToAdd - TELNET_MAX_SCROLLBACK_LINES;
    if (overflow <= 0) return;

    for (let i = 0; i < overflow; i++) {
      logLines.shift();
    }

    const toRemove = overflow;
    if (toRemove > 0) {
      const beforeST = outputEl.scrollTop;
      // Renumber any currently-mounted rows so `data-line-index` and the
      // virtualizer's internal map reflect the post-trim entry indices.
      // Rows whose new index would be negative are unmounted (their
      // `onUnmount` clears JSON+ + find-range bindings). Then `setCount`
      // triggers a relayout against the new, smaller range.
      virt.shiftIndicesAfterTrim(toRemove);
      virt.setCount(logLines.length);
      // Adjust scrollTop so the user's visible window stays put — the trim
      // removed `toRemove * estimateSize`-ish pixels from the top of the
      // virtualizer's content. (Approximation: actual trimmed height could
      // differ for wrapped lines; the next scroll event re-measures.)
      const removedPx = toRemove * 18;
      outputEl.scrollTop = Math.max(0, beforeST - removedPx);
    }

    // Scrollback trim shifts entry indices. `onLinesRemoved(count)` adjusts
    // every cached find result in-place (subtracts `count` from each hit's
    // `lineIndex`, drops hits that fall off the head, decrements
    // `scannedUpTo`) instead of re-running the query from scratch — important
    // when streaming is hot and the buffer trims often.
    findBarHandle?.onLinesRemoved(toRemove);
  }

  function cancelTelnetFlush() {
    if (telnetFlushKind === 'raf') {
      cancelAnimationFrame(telnetFlushHandle);
    } else if (telnetFlushKind === 'timeout') {
      clearTimeout(telnetFlushHandle);
    }
    telnetFlushHandle = 0;
    telnetFlushKind = null;
  }

  function scheduleTelnetRender() {
    if (telnetFlushKind !== null) return;

    function pump() {
      telnetFlushHandle = 0;
      telnetFlushKind = null;

      if (isTelnetContentModalOpen()) {
        telnetFlushKind = 'timeout';
        telnetFlushHandle = window.setTimeout(() => {
          telnetFlushHandle = 0;
          telnetFlushKind = null;
          scheduleTelnetRender();
        }, 64);
        return;
      }

      const backlog = pendingTelnetLines.length;
      if (backlog === 0) return;

      const now = performance.now();
      const elapsed = now - lastTelnetFlushMs;
      if (
        elapsed < TELNET_STREAM_MIN_FLUSH_INTERVAL_MS &&
        backlog < TELNET_STREAM_MAX_LINES_PER_FLUSH * 4
      ) {
        telnetFlushKind = 'timeout';
        telnetFlushHandle = window.setTimeout(() => {
          telnetFlushHandle = 0;
          telnetFlushKind = null;
          scheduleTelnetRender();
        }, Math.max(8, TELNET_STREAM_MIN_FLUSH_INTERVAL_MS - elapsed));
        return;
      }

      lastTelnetFlushMs = performance.now();
      const take = Math.min(backlog, TELNET_STREAM_MAX_LINES_PER_FLUSH);
      const batch = pendingTelnetLines.splice(0, take);
      if (batch.length) {
        addLogLinesBatch(batch, true, false);
      }

      if (pendingTelnetLines.length > 0) {
        telnetFlushKind = 'raf';
        telnetFlushHandle = requestAnimationFrame(pump);
      }
    }

    telnetFlushKind = 'raf';
    telnetFlushHandle = requestAnimationFrame(pump);
  }

  /** Flush queued TCP lines immediately (disconnect / user-facing events). */
  function flushTelnetPendingLinesSync() {
    cancelTelnetFlush();
    while (pendingTelnetLines.length > 0) {
      const take = Math.min(pendingTelnetLines.length, TELNET_STREAM_MAX_LINES_PER_FLUSH * 12);
      const batch = pendingTelnetLines.splice(0, take);
      if (batch.length) {
        addLogLinesBatch(batch, true, false);
      }
    }
  }

  function onTelnetViewerClosedResume() {
    cancelTelnetFlush();
    scheduleTelnetRender();
    scheduleDeferredTelnetDrain();
  }
  document.addEventListener(TELNET_VIEWER_CLOSED_EVENT, onTelnetViewerClosedResume);

  function ingestTelnetIpcChunk(chunk: string) {
    const lines = appendTelnetChunk(telnetTcpState, chunk);
    if (lines.length === 0) return;
    for (let i = 0; i < lines.length; i++) {
      pendingTelnetLines.push(lines[i]!);
    }
    scheduleTelnetRender();
  }

  /** Add many complete log lines in one layout pass (stable under flood). */
  function addLogLinesBatch(rawLineChunks: string[], timestamp = true, splitEntries = true) {
    const newEntries: TelnetLogEntry[] = [];

    const linesToProcess: string[] = [];
    if (splitEntries) {
      for (const text of rawLineChunks) {
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        for (const line of lines) {
          linesToProcess.push(line);
        }
      }
    } else {
      for (const line of rawLineChunks) {
        linesToProcess.push(line);
      }
    }

    for (const line of linesToProcess) {
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

      if (displayLine.length > TELNET_MAX_LINE_CHARS) {
        const over = displayLine.length - TELNET_MAX_LINE_CHARS;
        fullLine = `${displayLine.slice(0, TELNET_MAX_LINE_CHARS)} \u2026 [truncated ${over} chars]`;
      } else {
        fullLine = displayLine;
      }

      const detected =
        fullLine.length < TELNET_DEFER_HEAVY_LINE_CHARS
          ? detectStructuredConsoleLine(fullLine)
          : [];
      const logEntry: TelnetLogEntry = {
        text: fullLine,
        timestamp: timestamp ? new Date().toLocaleTimeString() : null,
        type: classifyLogLine(fullLine),
        ...(detected.length ? { structuredTargets: detected } : {})
      };

      newEntries.push(logEntry);
    }

    if (newEntries.length === 0) return;

    ensureTelnetScrollbackRoom(newEntries.length);

    const placeholder = outputEl.querySelector('.telnet-placeholder');
    if (placeholder) placeholder.remove();
    outputEl.querySelector('.telnet-scroll-spacer')?.remove();

    // Push entries into the model, then ask the virtualizer to relayout. The
    // virtualizer mounts only the rows currently in the visible window —
    // bursty stream of 350 lines per flush no longer creates 350 DOM nodes,
    // just maybe ~5 rows worth of bottom-edge mounts (and zero if the user
    // has scrolled away from the tail).
    for (const logEntry of newEntries) {
      logLines.push(logEntry);
    }
    virt.setCount(logLines.length);

    // Notify the find bar that the model grew. With the active query in
    // play, this incrementally scans the new tail and extends the cached hit
    // list — avoids re-scanning the whole buffer on every flush. Cheap no-op
    // when nothing is searched.
    findBarHandle?.onLinesAppended();

    let shouldAutoScroll = false;
    if (autoscrollCheckbox && autoscrollCheckbox.checked) {
      if (!userManuallyScrolled) {
        shouldAutoScroll = true;
      } else {
        const scrollThreshold = 100;
        const distanceFromBottom = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight;
        if (distanceFromBottom < scrollThreshold) {
          userManuallyScrolled = false;
          shouldAutoScroll = true;
        }
      }
    }

    if (shouldAutoScroll) {
      isScrolling = true;
      requestAnimationFrame(() => {
        if (autoscrollCheckbox && autoscrollCheckbox.checked && !userManuallyScrolled && logLines.length > 0) {
          // Route through the virtualizer's scroll path so it relayouts the
          // bottom-edge window correctly. Going through `outputEl.scrollTop`
          // *also* works (the offset observer would catch up) but
          // `scrollToIndex(end)` is one less hop and is robust against the
          // virtualizer's content height not being set yet on the first
          // frame after a flush.
          virt.scrollToIndex(logLines.length - 1, { align: 'end' });
          lastScrollTop = outputEl.scrollTop;
        }
        requestAnimationFrame(() => {
          isScrolling = false;
        });
      });
    }
  }

  function addLogLine(text: string, timestamp = true) {
    addLogLinesBatch([text], timestamp, true);
  }

  function handleScroll() {
    if (isScrolling) return;

    const newScrollTop = outputEl.scrollTop;
    const scrollDelta = Math.abs(newScrollTop - lastScrollTop);
    if (scrollDelta > 5) {
      const scrollThreshold = 100;
      const distanceFromBottom = outputEl.scrollHeight - newScrollTop - outputEl.clientHeight;
      userManuallyScrolled = distanceFromBottom > scrollThreshold;
    }

    lastScrollTop = newScrollTop;
  }

  /** Formatted JSON / XML modal: click log text or JSON/XML pill. */
  outputEl.addEventListener('click', (e) => {
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
    // Pick the *deepest* nested target whose lineRange contains the click; falls
    // back to targets[0] (outer JSON) when the click is outside any nested literal.
    // Pills bypass this: they stop propagation and open their own target directly.
    const targetIdx = clickedStructuredTargetIndex(contentEl, e, entry.structuredTargets);
    const payload = entry.structuredTargets[targetIdx] ?? entry.structuredTargets[0];
    if (!payload) return;
    openTelnetStructuredViewer(line, payload);
  });

  // In-flight guard. Multiple concurrent callers (e.g. an Action Script
  // auto-connect colliding with a manual click, or the executor pre-run
  // hook firing simultaneously with the checkbox-change handler) used to
  // each issue their own `api.telnetConnect()` IPC. With the main-process
  // handler now idempotent that is no longer destructive, but we still
  // dedupe here to avoid stacked `--- Connected ---` placeholder lines and
  // redundant `updateConnectionState` work, and to give every caller the
  // same resolved promise.
  let connectInFlight: Promise<void> | null = null;

  /** Shared click-handler + programmatic-entry path so the button and the
   *  exposed `panel.connectTelnet()` go through identical logic. */
  async function connectTelnet(): Promise<void> {
    if (isConnected) return;
    if (connectInFlight) return connectInFlight;

    const promise = (async () => {
      updateConnectionState(false, true);

      try {
        const result = await api.telnetConnect();

        if (result.success) {
          telnetTcpState.value = '';
          pendingTelnetLines.length = 0;
          cancelTelnetFlush();
          clearDeferredTelnetHeavyLines();
          updateConnectionState(true);
          addLogLine(`--- Connected to ${api.ip}:8085 ${api.isRemote ? '(via relay)' : ''} ---`, false);
        } else {
          updateConnectionState(false, false, result.error || 'Connection failed');
          addLogLine(`--- Connection failed: ${result.error || 'Unknown error'} ---`, false);
        }
      } catch (error) {
        const msg = errMessage(error);
        updateConnectionState(false, false, msg);
        addLogLine(`--- Connection error: ${msg} ---`, false);
      }
    })();
    connectInFlight = promise.finally(() => {
      connectInFlight = null;
    });
    return connectInFlight;
  }

  connectBtn.addEventListener('click', () => {
    void connectTelnet();
  });


  /** Shared exit path so the Disconnect button and the exposed
   *  `panel.disconnectTelnet()` go through identical logic. Idempotent. */
  async function disconnectTelnet(): Promise<void> {
    if (!isConnected) return;
    try {
      await api.telnetDisconnect();
      updateConnectionState(false);
      addLogLine('--- Disconnected ---', false);
    } catch (error) {
      console.error('Telnet disconnect error:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  disconnectBtn.addEventListener('click', () => {
    void disconnectTelnet();
  });
  
  /**
   * Single source of truth for "what the user sees and would expect to take
   * with them" — drives both Copy and Save. Flushes any pending append batch
   * so a click right after a burst of output isn't off by a few lines, then
   * applies the *filter*-mode query (Find mode is navigation only, not a
   * visibility cull) and returns the matching `LogLine`s in order.
   *
   * Per-line timestamps stay out of the result — they're a viewer affordance
   * only, and the saved file / clipboard text needs to round-trip through
   * tools that expect raw BrightScript console output unchanged.
   */
  function getVisibleLogLines(): typeof logLines {
    flushTelnetPendingLinesSync();
    return logLines.filter((log) => {
      if (!findBarHandle) return true;
      const q = findBarHandle.getQuery();
      if (findBarHandle.getMode() !== 'filter' || !q) return true;
      return telnetFindMatchesQuery(log.text, q, findBarHandle.getFindOptions());
    });
  }

  function getVisibleLogsBody(): string {
    return getVisibleLogLines().map((log) => log.text).join('\n');
  }

  copyBtn.addEventListener('click', () => {
    const visibleLogs = getVisibleLogsBody();

    window.roku.copyToClipboard(visibleLogs);

    // Visual feedback
    const originalText = copyBtn.innerHTML;
    setSafeHTML(copyBtn, '<span class="icon icon-xs"><svg><use href="#icon-check"/></svg></span> Copied!');
    setTimeout(() => {
      setSafeHTML(copyBtn, originalText);
    }, 2000);
  });

  // Save = Copy body + a header block (device + timestamp + line count) +
  // write-to-file via the system save dialog. The body itself comes through
  // the same `getVisibleLogLines` helper as Copy so the two stay byte-for-
  // byte identical and a future filter rule only has to land in one place.
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      // Store original button text at the start
      const originalText = saveBtn.innerHTML;

      try {
        const logsToSave = getVisibleLogLines();

        if (logsToSave.length === 0) {
          // Show feedback that there's nothing to save
          setSafeHTML(saveBtn, icon('x', 'icon-xs') + ' No logs');
          setTimeout(() => {
            setSafeHTML(saveBtn, originalText);
          }, 2000);
          return;
        }

        const formattedLogs = logsToSave.map((log) => log.text).join('\n');
        
        // Add header with device info and timestamp
        const header = [
          '='.repeat(80),
          `Roku Console Logs`,
          `Device: ${device.deviceName || device.modelName || 'Unknown'} (${device.ip})`,
          `Saved: ${new Date().toLocaleString()}`,
          `Total Lines: ${logsToSave.length}`,
          '='.repeat(80),
          ''
        ].join('\n');
        
        const content = header + formattedLogs;
        
        // Disable button during save
        saveBtn.disabled = true;
        setSafeHTML(saveBtn, icon('refresh', 'icon-xs') + ' Saving...');
        
        // Save to file
        const result = await window.roku.saveConsoleLogs(content);
        
        if (result.success) {
          setSafeHTML(saveBtn, icon('check', 'icon-xs') + ' Saved!');
          setTimeout(() => {
            setSafeHTML(saveBtn, originalText);
            saveBtn.disabled = false;
          }, 2000);
        } else {
          setSafeHTML(saveBtn, icon('x', 'icon-xs') + ' Error');
          setTimeout(() => {
            setSafeHTML(saveBtn, originalText);
            saveBtn.disabled = false;
          }, 2000);
          console.error('Failed to save console logs:', result.error);
        }
      } catch (error) {
        console.error('Error saving console logs:', error);
        setSafeHTML(saveBtn, icon('x', 'icon-xs') + ' Error');
        saveBtn.disabled = false;
        setTimeout(() => {
          setSafeHTML(saveBtn, originalText);
        }, 2000);
      }
    });
  }
  
  // Auto-scroll checkbox change handler
  if (autoscrollCheckbox) {
    autoscrollCheckbox.addEventListener('change', () => {
      if (autoscrollCheckbox.checked) {
        // When re-enabled, reset manual scroll flag and scroll to bottom
        userManuallyScrolled = false;
        
        // Mark as programmatic scroll to avoid triggering manual scroll detection
        isScrolling = true;
        
        // Scroll to bottom immediately
        requestAnimationFrame(() => {
          if (logLines.length > 0) {
            const maxScroll = outputEl.scrollHeight - outputEl.clientHeight;
            outputEl.scrollTop = Math.max(0, maxScroll);
            lastScrollTop = outputEl.scrollTop;
          }
          
          // Reset scroll flag after scroll completes
          // Use a small delay to ensure scroll event has been processed
          setTimeout(() => {
            isScrolling = false;
          }, 50);
        });
      }
      // When unchecked, we don't need to do anything - the shouldAutoScroll logic will handle it
    });
  }
  
  outputEl.addEventListener('scroll', handleScroll, { passive: true });

  outputEl.querySelector('.telnet-scroll-spacer')?.remove();

  // Clear console
  clearBtn.addEventListener('click', () => {
    telnetTcpState.value = '';
    pendingTelnetLines.length = 0;
    pendingLogPrefix = '';
    cancelTelnetFlush();
    clearDeferredTelnetHeavyLines();
    logLines = [];
    // Drive the row teardown THROUGH the virtualizer rather than blowing
    // away `outputEl.innerHTML`. The virtualizer's container element
    // (`virtualContainerEl`, appended to outputEl during setup) IS a child
    // of outputEl; `innerHTML = ''` would detach it, leaving the
    // virtualizer pointing at a DOM node no longer in the tree.
    // Subsequent `addLogLinesBatch` → `virt.setCount(...)` calls would
    // then mount rows into the orphaned container and the user would see
    // nothing — exactly the "logs aren't streaming after Clear" symptom.
    // setCount(0) walks the mounted map and runs `onUnmount` per row, then
    // recomputes layout against the now-empty model.
    virt.setCount(0);
    findBarHandle?.resetFindState();

    // Reset scroll-tail tracking so the next batch of incoming lines
    // pins to the bottom (consistent with a fresh-clear UX).
    userManuallyScrolled = false;
    lastScrollTop = 0;
    outputEl.scrollTop = 0;

    // Re-add the placeholder when disconnected, but APPEND it next to
    // virtualContainerEl rather than replacing outputEl's contents — same
    // shape as the cold-start markup in index.html, where the placeholder
    // and the virtualizer container are siblings inside .telnet-output.
    if (!isConnected) {
      const existingPlaceholder = outputEl.querySelector('.telnet-placeholder');
      if (!existingPlaceholder) {
        const placeholder = document.createElement('div');
        placeholder.className = 'telnet-placeholder';
        setSafeHTML(placeholder, `
          <span class="icon icon-lg"><svg><use href="#icon-terminal"/></svg></span>
          <p>Connect to view BrightScript debug output</p>
          <p class="telnet-hint">Requires Developer Mode enabled on the Roku device.<br>Only one telnet connection to a Roku device can be active at a time.</p>
        `);
        outputEl.insertBefore(placeholder, virtualContainerEl);
      }
    }
  });

  // Expose full console log to Action Script executor (reads in-memory logLines, not DOM)
  panel.getTelnetLogText = function () {
    flushTelnetPendingLinesSync();
    return logLines.map(log => (log.timestamp ? `[${log.timestamp}] ${log.text}` : log.text)).join('\n');
  };
  panel.getTelnetLogSnapshot = function (afterCursor = 0, maxLines = 500) {
    flushTelnetPendingLinesSync();
    const cap = Math.min(Math.max(1, maxLines), 2000);
    const start = Math.max(0, Math.min(afterCursor, logLines.length));
    const slice = logLines.slice(start, start + cap);
    return {
      lines: slice.map(l => ({ text: l.text, timestamp: l.timestamp ?? null, type: l.type })),
      cursor: start + slice.length,
      totalLines: logLines.length,
      connected: isConnected
    };
  };
  panel.isTelnetConnected = function () {
    return isConnected;
  };
  panel.connectTelnet = connectTelnet;
  panel.disconnectTelnet = disconnectTelnet;
  
  // Listen for telnet events (these come from the main process)
  // We need to filter by IP to only handle events for this device
  const dataCleanup = window.roku.onTelnetData((data) => {
    if (data.ip === api.ip && typeof data.data === 'string') {
      ingestTelnetIpcChunk(data.data);
    }
  });
  
  const disconnectCleanup = window.roku.onTelnetDisconnected((data) => {
    if (data.ip === api.ip) {
      const tail = takeTelnetTail(telnetTcpState);
      if (tail) {
        pendingTelnetLines.push(tail);
      }
      flushTelnetPendingLinesSync();
      if (pendingLogPrefix) {
        addLogLine(pendingLogPrefix);
        pendingLogPrefix = '';
      }

      // Diagnostic detail from main: how long the socket stayed open and
      // whether any bytes ever arrived. Roku 8085 closing fast with zero
      // bytes received is the classic "another telnet client holds the
      // BrightScript log binding" / "channel exited immediately" pattern;
      // a plain "--- Connection closed ---" hides the actual cause.
      const aliveMs = typeof data.aliveMs === 'number' ? data.aliveMs : -1;
      const bytes = typeof data.bytesReceived === 'number' ? data.bytesReceived : -1;
      const aliveStr = aliveMs >= 0
        ? (aliveMs < 1000 ? `${aliveMs}ms` : `${(aliveMs / 1000).toFixed(1)}s`)
        : null;

      let summary = '--- Connection closed';
      if (aliveStr !== null) summary += ` (alive ${aliveStr}`;
      if (bytes >= 0) summary += `${aliveStr !== null ? ', ' : ' ('}received ${bytes} bytes`;
      if (aliveStr !== null || bytes >= 0) summary += ')';
      summary += ' ---';
      addLogLine(summary, false);

      // Heuristic hint: short-lived socket + zero bytes ⇒ Roku didn't
      // bind its log stream to us. Most common causes: another telnet
      // client (BrightScript IDE, VS Code BrightScript extension, an
      // IDE plugin, a stray `telnet <ip> 8085` in a terminal, another
      // Dev Studio window pointed at the same IP) holds the binding;
      // the channel exited or crashed; or 8085 was never reachable
      // (firewall / Developer Mode off). hadError adds the OS-level
      // signal that the close was abnormal (RST etc.).
      if (aliveMs >= 0 && aliveMs < 5000 && bytes <= 0) {
        addLogLine('--- Hint: Roku closed the socket quickly with no log data. Check that no other telnet client is connected to this device on port 8085 (BrightScript IDE, another Dev Studio window, a `telnet` terminal session, …) and that a sideloaded channel is currently running. ---', false);
      } else if (data.hadError) {
        addLogLine('--- Hint: socket close was abnormal (TCP RST or similar). Roku may have rebooted or another client took the 8085 binding. ---', false);
      }

      updateConnectionState(false, false, data.hadError ? 'Connection lost' : null);
    }
  });
  
  const errorCleanup = window.roku.onTelnetError((data) => {
    if (data.ip === api.ip) {
      addLogLine(`--- Error: ${data.error} ---`, false);
    }
  });
  
  // Store cleanup functions on panel for later removal
  panel._telnetCleanup = () => {
    findBarHandle?.dispose();
    document.removeEventListener(TELNET_VIEWER_CLOSED_EVENT, onTelnetViewerClosedResume);
    cancelTelnetFlush();
    clearDeferredTelnetHeavyLines();
    dataCleanup();
    disconnectCleanup();
    errorCleanup();
    // Disconnect if still connected
    if (isConnected) {
      api.telnetDisconnect().catch(() => {});
    }
  };
}

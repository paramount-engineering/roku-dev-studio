import { errMessage } from '../utils/err-message.js';
import { type StructuredConsolePayload } from '../console-log/structured-log-detect.js';
import {
  attachStructuredPillsToLine
} from '../console-log/console-structured-view-modal.js';
import { populateConsoleLineContentWithUrls } from '../console-log/console-url-detect.js';
import { createConsoleDeferredHeavyDrain } from '../console-log/console-deferred-heavy-drain.js';
import { DEFER_HEAVY_LINE_CHARS } from '../console-log/console-render-limits.js';
import { mountConsoleLogSurface } from '../console-log/mount-console-log-surface.js';
import {
  buildVisibleLogText,
  selectVisibleLogEntries
} from '../console-log/console-visible-log-text.js';
import { CONSOLE_VIEWER_CLOSED_EVENT } from '../console-log/console-viewer-bridge.js';
import {
  appendTelnetChunk,
  takeTelnetTail,
  type TelnetLineBufferState
} from './telnet-console-buffer.js';
import {
  createConsoleLineParserState,
  parseConsoleLineBatch
} from '../console-log/console-line-parser.js';
import { icon, setSafeHTML } from '../index.js';
import {
  debugTelnetIpcTargetsDevice,
  type DebugTelnetIpcPayload
} from '../../shared/ipc/debug-telnet-connection-id.js';

export type TelnetConsoleDevice = { deviceName?: string; modelName?: string; ip: string };

export type TelnetConsoleApi = {
  ip: string;
  isRemote?: boolean;
  serverUrl?: string | null;
  telnetConnect: (options?: { skipRelayBuffer?: boolean }) => Promise<{ success: boolean; error?: string }>;
  telnetDisconnect: () => Promise<unknown>;
  /** Remote relay only — clears the server-side gap buffer without closing 8085. */
  telnetClearRelayBuffer?: () => Promise<{ success?: boolean; error?: string; clearedBytes?: number }>;
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
  connectTelnet?: (options?: { skipRelayBuffer?: boolean }) => Promise<void>;
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
  
  // Elements. Each lookup is typed to its concrete `HTMLBlahElement` so
  // downstream `.disabled` / `.checked` / `.scrollTop` access is correctly
  // typed without per-call casting. Then we re-bind to non-nullable aliases
  // under the bare names — TypeScript's null-narrowing from the if-guard
  // below only flows through linear control flow, nested callbacks (event
  // handlers, IPC subscriptions, scroll-tail RAF) re-widen back to
  // `T | null`, so per-callsite `!` assertions would otherwise be needed.
  const maybeConnectBtn = panel.querySelector<HTMLButtonElement>('.telnet-connect-btn');
  const maybeDisconnectBtn = panel.querySelector<HTMLButtonElement>('.telnet-disconnect-btn');
  const maybeStatusEl = panel.querySelector<HTMLElement>('.telnet-status');
  const maybeStatusText = panel.querySelector<HTMLElement>('.telnet-status-text');
  const maybeOutputEl = panel.querySelector<HTMLElement>('.telnet-output');
  const copyBtn = panel.querySelector<HTMLButtonElement>('.telnet-copy-btn');
  const saveBtn = panel.querySelector<HTMLButtonElement>('.telnet-save-btn');
  const scrollToBottomBtn = panel.querySelector<HTMLButtonElement>('.telnet-scroll-to-bottom');
  const maybeClearBtn = panel.querySelector<HTMLButtonElement>('.telnet-clear-btn');
  // Live counter shown left of the connection status pill while connected.
  // Optional element — not in the early null-guard because absence just
  // means the host markup didn't include it (silent no-op).
  const lineCountEl = panel.querySelector<HTMLElement>('.telnet-line-count');

  // Downstream handlers reference statusEl, statusText, disconnectBtn, and clearBtn
  // without null checks. Assert them here so a reused fragment without these nodes
  // fails fast with a clear message instead of NPE'ing much later.
  if (
    !maybeConnectBtn ||
    !maybeOutputEl ||
    !maybeDisconnectBtn ||
    !maybeStatusEl ||
    !maybeStatusText ||
    !maybeClearBtn
  ) {
    console.error('Telnet console elements not found');
    return;
  }

  // Non-null aliases under the bare names so all downstream code reads
  // identically to the pre-typecheck era.
  const connectBtn = maybeConnectBtn;
  const disconnectBtn = maybeDisconnectBtn;
  const statusEl = maybeStatusEl;
  const statusText = maybeStatusText;
  const outputEl = maybeOutputEl;
  const clearBtn = maybeClearBtn;
  const connectSplit = panel.querySelector<HTMLElement>('.telnet-connect-split');
  const isRelayConsole = !!(api.isRemote && api.serverUrl && api.telnetClearRelayBuffer);
  let closeOpenTelnetSplitMenu: (() => void) | null = null;

  // State
  type TelnetLogEntry = {
    text: string;
    timestamp: string | null;
    type: string;
    structuredTargets?: StructuredConsolePayload[];
  };
  let isConnected = false;
  let logLines: TelnetLogEntry[] = [];

  /**
   * Disk-backed scrollback spill (see `main/console-spill.ts`).
   *
   * - `spillId`: per-Connect handle from main; `null` between sessions and
   *   while the start IPC is in flight.
   * - `spilledEntryCount`: total entries written to disk this session. Used
   *   for the "N of M lines" counter and to decide whether the auto-load on
   *   scroll-up has anything to show.
   * - `spillCapHit`: latched true when main reports it dropped entries
   *   (file size cap). Past this point we stop trying to append — the disk
   *   file is full so the entries are lost regardless. Avoids per-batch IPC
   *   noise when streaming a forgotten session.
   */
  let spillId: string | null = null;
  let spilledEntryCount = 0;
  let spillCapHit = false;

  // Mount the shared console-log surface — find bar + virtualizer + viewer
  // shortcuts + filter-on-mount + JSON+/find-highlight bind/unbind, all in
  // one call. The Log Viewer mounts the same surface on a static entry array;
  // the panel mounts it on a streaming one and tells the surface about
  // appends and trims via `notifyAppended` / `notifyTrimmed`.
  //
  // `preservePlaceholder: true` skips the surface's outputEl clear so the
  // "Connect to Roku…" placeholder element survives until the first batch
  // arrives (the panel's `updateConnectionState` removes it then).
  //
  // `buildLineEl: createLogLineElement` overrides the surface's default row
  // builder. The panel's builder defers URL detection on heavy (>=6 KB)
  // streaming lines via `enqueueDeferredTelnetHeavyLine` so the per-flush
  // DOM cost stays bounded — the default builder's sync detection would
  // pile up under 350-line bursts.
  //
  // `onSelectAll` (Cmd/Ctrl+A) lays a native selection Range over the
  // virtualizer's content element — it selects (so the user can Cmd+C), it
  // does not auto-copy. Only mounted rows are natively selectable.
  const surface = mountConsoleLogSurface({
    outputEl,
    entries: logLines,
    findBarHost: panel,
    shortcutScopeEl: panel,
    preservePlaceholder: true,
    buildLineEl: (entry, index) => createLogLineElement(entry as TelnetLogEntry, index),
    // Find navigation must unpin stick-to-bottom before scrolling to the match.
    // Otherwise a streaming batch's `followTailScroll()` keeps snapping the view
    // back to the newest line while the find bar pulls it to the hit — the two
    // scroll controllers fight every frame and the console visibly flickers.
    // Setting `pinnedToBottom = false` here also cancels any in-flight
    // `followTailScroll` (its `scrollOnce` guard bails on `!pinnedToBottom`).
    scrollLineIntoView: (idx) => {
      if (pinnedToBottom) {
        pinnedToBottom = false;
        updateScrollToBottomAffordance();
      }
      virt.scrollToIndex(idx, { align: 'center' });
    },
    onSelectAll: () => {
      // Cmd+A selects (it does NOT copy) — leaving the actual Cmd+C to the
      // user, like a normal text region. We scope the native selection to the
      // console output container (rather than letting the browser select the
      // whole page) by laying a Range over the virtualizer's content element.
      // Note: only the virtualized rows currently mounted in the DOM can be
      // highlighted; off-screen scrollback isn't selectable natively.
      const sel = window.getSelection();
      if (!sel) return;
      const container = surface.view.getContainerEl();
      const range = document.createRange();
      range.selectNodeContents(container);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
  // Aliases so the rest of this file (which predates the surface refactor)
  // keeps reading the same. `virt.scrollToIndex` / `virt.getTotalSize` etc.
  // are forwarded from the underlying virtualizer.
  const virt = surface.view;
  const findBarHandle = surface.findBar;
  // Per-connection parser state. The pending `[DEBUG]`-on-its-own-line prefix
  // can carry across IPC chunks, so the state lives at panel scope (one per
  // device) — calls to `parseConsoleLineBatch` thread it through.
  const telnetParserState = createConsoleLineParserState();
  const telnetTcpState: TelnetLineBufferState = { value: '' };
  /** Complete lines waiting for one DOM flush (coalesces bursty IPC / main-process batches). */
  let pendingTelnetLines: string[] = [];
  /** Paced flush: limits work per frame + spacing so JSON/XML/URL modals and scrolling stay responsive while streaming. */
  let telnetFlushHandle = 0;
  let telnetFlushKind: 'raf' | 'timeout' | null = null;
  let lastTelnetFlushMs = 0;
  const TELNET_STREAM_MAX_LINES_PER_FLUSH = 350;
  const TELNET_STREAM_MIN_FLUSH_INTERVAL_MS = 36;
  // Heavy-line and per-line truncation caps live in `console-render-limits.ts`
  // (DEFER_HEAVY_LINE_CHARS / MAX_LOG_LINE_CHARS) so the Log Viewer reads
  // identical thresholds.
  // Heavy-line deferred drain (URL detect + structured detect, paused while a
  // content modal is open). Owns its own queue + timer; the panel only sees
  // `enqueue` / `clear` / `schedule`. See `console-deferred-heavy-drain.ts`.
  const deferredHeavyDrain = createConsoleDeferredHeavyDrain({
    isModalOpen: () => isTelnetContentModalOpen()
  });

  /**
   * Cap scrollback in memory. Live-only; the Log Viewer is bounded by the
   * file-size cap upstream.
   *
   * Sized for a long debug session (≈ a few hours of moderate streaming)
   * without making the renderer feel sluggish:
   *
   *   - Memory: ~300 bytes/entry on average × 50,000 ≈ 15 MB. Comfortable
   *     even on the modest hardware some QA labs use.
   *   - Layout: virtualization caps mounted DOM rows at ~40 regardless of
   *     model size, so paint cost is constant in the cap. The bottleneck
   *     is initial-mount math when scrolling to the very top of a large
   *     backlog (`getVirtualItems` resize), and 50K is comfortably below
   *     where that becomes noticeable on Apple-silicon and modern x86.
   *
   * Earlier value was 10,000 (set pre-virtualization, when each line was a
   * real DOM node and 10K rows already pushed the layout budget). With
   * virtualization that ceiling is no longer the binding constraint, so
   * this is a 5× headroom bump for users with long telnet sessions.
   *
   * Older lines past the cap are **not** lost: `ensureTelnetScrollbackRoom`
   * spills the trimmed segment to an NDJSON file in OS temp (see
   * `main/console-spill.ts`), and `maybeAutoLoadSpill` / `loadAllEntriesIncludingSpill`
   * prepend that history back into the visible model on scroll-to-top and
   * on Copy/Save/Cmd+A respectively. The live counter renders
   * `<buffered> of <total> lines` while a spill is active. Hard ceiling at
   * 100 MB per session — past that, `spillCapHit` latches and the surface
   * degrades to the classic "scrollback" model (Chrome DevTools, iTerm,
   * VSCode integrated terminal) for any further trims.
   */
  const TELNET_MAX_SCROLLBACK_LINES = 50000;
  const SCROLL_TAIL_THRESHOLD_PX = 100;
  let isScrolling = false;
  /** When true, new log lines keep the view pinned to the tail. */
  let pinnedToBottom = true;
  let lastScrollTop = 0;
  let tailFollowToken = 0;
  /** True while a tail-follow RAF chain is pending — lets streaming flushes
   *  coalesce onto the in-flight chain instead of stacking a new 3-pass run. */
  let tailFollowScheduled = false;

  function distanceFromBottom(): number {
    return outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight;
  }

  function isNearBottom(): boolean {
    return distanceFromBottom() <= SCROLL_TAIL_THRESHOLD_PX;
  }

  function updateScrollToBottomAffordance(): void {
    if (!scrollToBottomBtn) return;
    scrollToBottomBtn.hidden = logLines.length === 0 || pinnedToBottom;
  }

  /** Scroll the virtualizer to the log tail. Multi-pass so measured row heights settle. */
  function followTailScroll(onDone?: () => void): void {
    // Each pass reads the *current* tail (`logLines.length - 1`) at execution
    // time, so when a chain is already pending for the streaming path it will
    // land on the newest line anyway — skip stacking another. Only callers that
    // need the `onDone` callback (programmatic jump-to-bottom) force a fresh run.
    if (tailFollowScheduled && !onDone) return;
    const token = ++tailFollowToken;
    tailFollowScheduled = true;
    isScrolling = true;
    const scrollOnce = (): void => {
      if (token !== tailFollowToken || !pinnedToBottom) return;
      if (logLines.length > 0) {
        virt.scrollToIndex(logLines.length - 1, { align: 'end' });
        lastScrollTop = outputEl.scrollTop;
      }
    };
    const finish = (): void => {
      if (token !== tailFollowToken) return;
      tailFollowScheduled = false;
      lastScrollTop = outputEl.scrollTop;
      isScrolling = false;
      onDone?.();
    };
    requestAnimationFrame(() => {
      if (token !== tailFollowToken) return;
      scrollOnce();
      requestAnimationFrame(() => {
        if (token !== tailFollowToken) return;
        scrollOnce();
        queueMicrotask(() => {
          scrollOnce();
          finish();
        });
      });
    });
  }

  function scrollToLatestLogs(): void {
    if (logLines.length === 0) return;
    pinnedToBottom = true;
    followTailScroll(() => {
      updateScrollToBottomAffordance();
    });
  }

  function isTelnetContentModalOpen(): boolean {
    const s = document.getElementById('telnetStructuredViewerOverlay');
    const u = document.getElementById('telnetUrlViewerOverlay');
    return (
      (s instanceof HTMLElement && s.classList.contains('active')) ||
      (u instanceof HTMLElement && u.classList.contains('active'))
    );
  }

  // Thin aliases so the rest of this file reads the same after the extract.
  // The actual queue + slicing + modal-pause logic lives in
  // `console-deferred-heavy-drain.ts` (see `deferredHeavyDrain` above).
  const clearDeferredTelnetHeavyLines = () => deferredHeavyDrain.clear();
  const scheduleDeferredTelnetDrain = () => deferredHeavyDrain.schedule();
  const enqueueDeferredTelnetHeavyLine = (job: {
    entry: TelnetLogEntry;
    lineEl: HTMLElement;
    contentEl: HTMLElement;
  }) => deferredHeavyDrain.enqueue(job);


  /**
   * Refresh the live line counter shown left of the connection status pill.
   * Hidden when not connected (avoids cluttering the disconnected state and
   * also lets the counter "reset" visually when the user disconnects).
   *
   * Counter form depends on whether the disk spill has any content:
   *   - No spill:     `12,453 lines`            — fits in memory, equals total.
   *   - Spill active: `12,453 of 67,892 lines`  — buffer + on-disk total.
   *
   * The "of M" form makes the disk-spill mechanism discoverable without an
   * extra UI element. The numbers stay tabular (`font-variant-numeric:
   * tabular-nums`) so they don't jitter on every batch.
   */
  function refreshLineCount(): void {
    if (!lineCountEl) return;
    if (!isConnected) {
      lineCountEl.hidden = true;
      lineCountEl.textContent = '';
      return;
    }
    const buffered = logLines.length;
    const total = spilledEntryCount + buffered;
    lineCountEl.hidden = false;
    if (spilledEntryCount > 0) {
      lineCountEl.textContent = `${buffered.toLocaleString()} of ${total.toLocaleString()} lines`;
      lineCountEl.title =
        `${buffered.toLocaleString()} in memory, ${spilledEntryCount.toLocaleString()} spilled to disk` +
        (spillCapHit ? ' (disk cap reached — older lines dropped)' : '');
    } else {
      lineCountEl.textContent = `${buffered.toLocaleString()} ${buffered === 1 ? 'line' : 'lines'}`;
      lineCountEl.removeAttribute('title');
    }
  }


  /** Relay split menus use fixed coords; portal to body so inner-tab transforms don't offset them. */
  function wireTelnetSplitMenu(
    splitControl: HTMLElement,
    menuBtn: HTMLButtonElement,
    menu: HTMLElement,
    registerCleanup: (fn: () => void) => void
  ): { close: () => void } {
    menuBtn.hidden = false;

    function portalMenu(): void {
      if (menu.parentElement !== document.body) {
        document.body.appendChild(menu);
      }
    }

    function restoreMenu(): void {
      if (menu.parentElement === document.body && splitControl.isConnected) {
        splitControl.appendChild(menu);
      }
    }

    function positionMenu(): void {
      portalMenu();
      const rect = menuBtn.getBoundingClientRect();
      const splitMain = splitControl.querySelector<HTMLElement>('.telnet-split-main');
      const anchorWidth = splitMain
        ? splitMain.getBoundingClientRect().width + rect.width
        : rect.width;
      menu.style.position = 'fixed';
      menu.style.top = `${Math.round(rect.bottom + 4)}px`;
      menu.style.left = 'auto';
      menu.style.right = `${Math.round(window.innerWidth - rect.right)}px`;
      menu.style.bottom = 'auto';
      menu.style.minWidth = `${Math.max(Math.round(anchorWidth), 240)}px`;
    }

    function setOpen(open: boolean): void {
      if (open) {
        closeOpenTelnetSplitMenu?.();
        closeOpenTelnetSplitMenu = closeMenu;
        positionMenu();
        menu.hidden = false;
        menuBtn.setAttribute('aria-expanded', 'true');
      } else {
        if (closeOpenTelnetSplitMenu === closeMenu) {
          closeOpenTelnetSplitMenu = null;
        }
        menu.hidden = true;
        menuBtn.setAttribute('aria-expanded', 'false');
        restoreMenu();
      }
    }

    function closeMenu(): void {
      setOpen(false);
    }

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(menu.hidden);
    });

    const onDocumentClick = (e: MouseEvent) => {
      if (menu.hidden) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (menu.contains(t) || menuBtn.contains(t)) return;
      closeMenu();
    };

    const onDocumentKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !menu.hidden) {
        closeMenu();
      }
    };

    const onReposition = () => {
      if (!menu.hidden) positionMenu();
    };

    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeydown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    registerCleanup(() => {
      closeMenu();
      if (closeOpenTelnetSplitMenu === closeMenu) {
        closeOpenTelnetSplitMenu = null;
      }
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeydown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    });

    return { close: closeMenu };
  }

  // Update UI based on connection state
  function updateConnectionState(connected: boolean, connecting = false, error: string | null = null) {
    isConnected = connected;

    if (connecting) {
      statusEl.className = 'telnet-status connecting';
      statusText.textContent = 'Connecting...';
      connectBtn.disabled = true;
      if (isRelayConsole && connectSplit) {
        connectSplit.hidden = true;
      }
      closeOpenTelnetSplitMenu?.();
    } else if (connected) {
      statusEl.className = 'telnet-status connected';
      statusText.textContent = 'Connected';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = '';
      if (isRelayConsole && connectSplit) {
        connectSplit.hidden = true;
      }
      closeOpenTelnetSplitMenu?.();

      // Clear placeholder
      const placeholder = outputEl.querySelector('.telnet-placeholder');
      if (placeholder) placeholder.remove();
    } else {
      statusEl.className = error ? 'telnet-status error' : 'telnet-status disconnected';
      statusText.textContent = error ? `Error: ${error}` : 'Disconnected';
      connectBtn.style.display = '';
      connectBtn.disabled = false;
      disconnectBtn.style.display = 'none';
      if (isRelayConsole && connectSplit) {
        connectSplit.hidden = false;
      }
    }

    refreshLineCount();
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
    const deferHeavy = logEntry.text.length >= DEFER_HEAVY_LINE_CHARS;
    if (deferHeavy) {
      contentEl.textContent = logEntry.text;
    } else {
      populateConsoleLineContentWithUrls(contentEl, logEntry.text);
    }
    lineEl.appendChild(contentEl);

    if (logEntry.structuredTargets?.length) {
      attachStructuredPillsToLine(lineEl, contentEl, logEntry.structuredTargets);
    }
    // JSON+ inline-tint binding now happens in the virtualizer's `onMount`
    // callback (telnet-console-panel.ts: see virtualizer setup) so we don't
    // double-paint when the line mounts. The deferred-heavy-line drain still
    // re-binds after `populateConsoleLineContentWithUrls` rebuilds contentEl.

    if (deferHeavy) {
      enqueueDeferredTelnetHeavyLine({ entry: logEntry, lineEl, contentEl });
    }

    if (findBarHandle?.shouldFilterOut(logEntry.text)) {
      lineEl.classList.add('filtered-out');
    }
    
    return lineEl;
  }
  
  /**
   * Spill a batch of trimmed entries to disk. Fire-and-forget — the IPC
   * round-trip is fast (single appendFileSync on the main side) and its
   * result is consumed only for the in-memory `spilledEntryCount` counter
   * and `spillCapHit` latch. Errors are logged and otherwise swallowed:
   * the in-memory trim happened regardless, so a spill failure just means
   * the counter understates "total received" — not a fatal condition.
   */
  function appendToSpill(trimmed: TelnetLogEntry[]): void {
    if (!spillId || spillCapHit || trimmed.length === 0) return;
    // Compact field names (`t`, `ty`, `st`) to save bytes on disk; the
    // read path on this same renderer reverses the mapping.
    const payload = trimmed.map((e) => ({
      t: e.text,
      ty: e.type,
      ...(e.structuredTargets ? { st: e.structuredTargets } : {})
    }));
    void window.roku.consoleSpillAppend(spillId, payload).then(
      (res: { success: boolean; entryCount?: number; dropped?: number; error?: string }) => {
        if (!res?.success) {
          console.warn('[Console spill] append failed:', res?.error);
          return;
        }
        if (typeof res.entryCount === 'number') spilledEntryCount = res.entryCount;
        if (typeof res.dropped === 'number' && res.dropped > 0) {
          spillCapHit = true;
        }
        refreshLineCount();
      },
      (err: unknown) => {
        console.warn('[Console spill] append rejected:', err);
      }
    );
  }

  /** Drop oldest lines from memory + DOM when over cap; preserve scroll offset. */
  function ensureTelnetScrollbackRoom(linesToAdd: number) {
    let overflow = logLines.length + linesToAdd - TELNET_MAX_SCROLLBACK_LINES;
    if (overflow <= 0) return;

    // Capture before shift so we can spill the exact entries about to leave
    // memory. `splice(0, n)` returns the removed segment in one call and is
    // measurably faster than n × `shift()` on large arrays.
    const trimmed = logLines.splice(0, overflow);

    const toRemove = overflow;
    if (toRemove > 0) {
      const beforeST = outputEl.scrollTop;
      // The surface routes through `view.shiftIndicesAfterTrim(toRemove)` +
      // `view.setCount(logLines.length)` + `findBar.onLinesRemoved(toRemove)`
      // and returns the exact pixel delta the trim removed (computed from
      // the virtualizer's measured sizes before/after — the right number
      // for wrapped multi-row entries, where `toRemove * estimateSize` is
      // wrong by a wide margin).
      const removedPx = surface.notifyTrimmed(toRemove);
      outputEl.scrollTop = Math.max(0, beforeST - removedPx);
      appendToSpill(trimmed);
      refreshLineCount();
    }
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
  document.addEventListener(CONSOLE_VIEWER_CLOSED_EVENT, onTelnetViewerClosedResume);

  function ingestTelnetIpcChunk(chunk: string) {
    // The main-process 8085 socket can stay open after this panel disconnects
    // when another holder (e.g. a Fiddle window) still leases it. In that case
    // `TelnetData` keeps broadcasting to every renderer; ignore it here once
    // this panel is no longer connected so the UI state and the log stream
    // don't diverge (and `getTelnetLogSnapshot().connected` stays truthful).
    if (!isConnected) return;
    const lines = appendTelnetChunk(telnetTcpState, chunk);
    if (lines.length === 0) return;
    for (let i = 0; i < lines.length; i++) {
      pendingTelnetLines.push(lines[i]!);
    }
    scheduleTelnetRender();
  }

  /** Add many complete log lines in one layout pass (stable under flood). */
  function addLogLinesBatch(rawLineChunks: string[], timestamp = true, splitEntries = true) {
    // Collapse incoming raw chunks into a flat per-line list. `splitEntries`
    // is the "this came as a multi-line blob, please split me" flag — set by
    // synthetic injections like `--- Connected ---` that arrive whole. The
    // streaming path passes `splitEntries=false` because `appendTelnetChunk`
    // already returned discrete lines from the TCP buffer.
    const linesToProcess: string[] = [];
    if (splitEntries) {
      for (const text of rawLineChunks) {
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        for (const line of lines) linesToProcess.push(line);
      }
    } else {
      for (const line of rawLineChunks) linesToProcess.push(line);
    }

    // Shared parser (`console-line-parser.ts`) — same logic the file viewer
    // uses, threading through `telnetParserState` so a `[DEBUG]` prefix line
    // whose continuation arrives in the next batch isn't dropped.
    const parsed = parseConsoleLineBatch(telnetParserState, linesToProcess);
    if (parsed.length === 0) return;

    const newEntries: TelnetLogEntry[] = parsed.map((p) => ({
      text: p.text,
      // 24-hour format (`23:44:21`) — matches BrightScript's own `[DEBUG]
      // 23:44:21.234` log prefix style and avoids the `AM/PM` suffix
      // doubling the timestamp gutter width. `[]` lets the user's locale
      // pick separators / numbering system; `hour12: false` overrides only
      // the 12/24 toggle (en-US default would be 12).
      timestamp: timestamp ? new Date().toLocaleTimeString([], { hour12: false }) : null,
      type: p.type,
      ...(p.structuredTargets ? { structuredTargets: p.structuredTargets } : {})
    }));

    ensureTelnetScrollbackRoom(newEntries.length);

    const placeholder = outputEl.querySelector('.telnet-placeholder');
    if (placeholder) placeholder.remove();
    outputEl.querySelector('.telnet-scroll-spacer')?.remove();

    // Push entries into the model, then notify the surface so the
    // virtualizer relayouts (it mounts only rows in the visible window —
    // bursty stream of 350 lines per flush creates ~5 rows of bottom-edge
    // mounts, or zero if the user has scrolled away from the tail) and the
    // find bar incrementally scans the new tail (cheap no-op without an
    // active query).
    for (const logEntry of newEntries) {
      logLines.push(logEntry);
    }
    surface.notifyAppended();
    refreshLineCount();

    if (pinnedToBottom) {
      followTailScroll();
    } else {
      updateScrollToBottomAffordance();
    }
  }

  function addLogLine(text: string, timestamp = true) {
    addLogLinesBatch([text], timestamp, true);
  }

  /**
   * One-shot guard: prevents the spill auto-load from re-firing on every
   * scroll event after it's already loaded once for this session. The
   * counter ("12,453 of 67,892 lines") still tracks new spill writes after
   * load, but the on-disk content is already merged into the view, so
   * re-loading is wasted work.
   *
   * Reset on Clear / new Connect (both call `consoleSpillStart` again,
   * which implies a fresh session — old loaded entries are dropped via
   * in-place `logLines.length = 0` in the Clear path).
   */
  let spillAutoLoadInFlight = false;
  let spillAutoLoaded = false;

  /**
   * When the user scrolls near the top of the in-memory range AND there
   * are entries waiting on disk, load the spill into memory and prepend
   * it to the model. After load, the user's vertical position stays
   * anchored on the line they were looking at (so the load isn't a jarring
   * scroll jump). One-shot per session — the disk content stops being a
   * source of truth once it's been hoisted into memory.
   */
  async function maybeAutoLoadSpill(): Promise<void> {
    if (spillAutoLoaded || spillAutoLoadInFlight) return;
    if (!spillId || spilledEntryCount === 0) return;
    // Trigger when the user is within ~200 px of the top of the in-memory
    // range. 200 px ≈ 10 unwrapped log lines — far enough to give the load
    // time to complete before they actually reach row 0; close enough that
    // we don't load on every minor scroll-up. The in-memory cap is 50K so
    // there's plenty of buffer above this trigger.
    if (outputEl.scrollTop > 200) return;

    spillAutoLoadInFlight = true;
    try {
      const res = (await window.roku.consoleSpillRead(spillId)) as {
        success: boolean;
        entries?: string[];
        error?: string;
      };
      if (!res?.success || !Array.isArray(res.entries) || res.entries.length === 0) {
        if (!res?.success) console.warn('[Console spill] auto-load read failed:', res?.error);
        return;
      }
      // Decode NDJSON back to TelnetLogEntry. Same shape `loadAllEntriesIncludingSpill`
      // uses for export, but inlined here so we can prepend in one pass
      // without holding a temporary array of all in-memory entries too.
      const spilled: TelnetLogEntry[] = [];
      for (const line of res.entries) {
        try {
          const obj = JSON.parse(line) as { t?: string; ty?: string; st?: StructuredConsolePayload[] };
          if (typeof obj?.t !== 'string' || typeof obj?.ty !== 'string') continue;
          spilled.push({
            text: obj.t,
            timestamp: null,
            type: obj.ty,
            ...(obj.st ? { structuredTargets: obj.st } : {})
          });
        } catch {
          /* skip corrupt line */
        }
      }
      if (spilled.length === 0) return;

      // Mutate the entries array in place (same reference the surface
      // observes) — `splice(0, 0, ...spilled)` prepends without losing the
      // identity. Then the surface relayouts.
      const beforeST = outputEl.scrollTop;
      logLines.splice(0, 0, ...spilled);
      const addedPx = surface.notifyPrepended(spilled.length);
      // Anchor the user's view on the same logical line they were looking
      // at: we just shoved `addedPx` of new content above their current
      // position, so push scrollTop down by the same amount.
      outputEl.scrollTop = beforeST + addedPx;

      // The disk content is now in memory. Drop the spill counter and let
      // the disk file age out at its own cap — future trims will write
      // *new* content past the loaded prefix, but the auto-load won't
      // re-fire (one-shot guard above).
      spilledEntryCount = 0;
      refreshLineCount();
      spillAutoLoaded = true;
    } catch (e) {
      console.warn('[Console spill] auto-load rejected:', e);
    } finally {
      spillAutoLoadInFlight = false;
    }
  }

  function handleScroll() {
    if (isScrolling) {
      lastScrollTop = outputEl.scrollTop;
      return;
    }

    const newScrollTop = outputEl.scrollTop;
    const delta = newScrollTop - lastScrollTop;

    // Pin state follows *user intent*, not instantaneous distance-from-bottom.
    // Programmatic tail-scroll and virtualizer remeasure often fire scroll
    // events before the view lands within SCROLL_TAIL_THRESHOLD_PX — treating
    // those as "user left the tail" left pinnedToBottom false while the ↓
    // button was still shown.
    if (delta < -5) {
      pinnedToBottom = false;
      updateScrollToBottomAffordance();
    } else if (!pinnedToBottom && delta > 5 && isNearBottom()) {
      pinnedToBottom = true;
      updateScrollToBottomAffordance();
    }

    lastScrollTop = newScrollTop;

    // Auto-load the disk spill when the user scrolls near the top of the
    // in-memory range. Async + one-shot — see `maybeAutoLoadSpill` doc.
    void maybeAutoLoadSpill();
  }

  // Click delegation for URL spans and structured-payload viewers is wired
  // inside `mountConsoleLogFileView` (called by `mountConsoleLogSurface`),
  // so we don't attach a duplicate handler here. The surface's handler uses
  // identical logic — `firstHitElementOnConsoleClick` → URL span check →
  // structured-target lookup via `clickedStructuredTargetIndex` (deepest
  // nested JSON+ literal under the click), falling back to the primary target.

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
  async function connectTelnet(options?: { skipRelayBuffer?: boolean }): Promise<void> {
    if (isConnected) return;
    if (connectInFlight) return connectInFlight;

    const promise = (async () => {
      updateConnectionState(false, true);

      try {
        const result = await api.telnetConnect(options);

        if (result.success) {
          telnetTcpState.value = '';
          pendingTelnetLines.length = 0;
          cancelTelnetFlush();
          clearDeferredTelnetHeavyLines();
          // Start every Connect with a clean view. Previously the in-memory
          // scrollback survived a disconnect → reconnect (or a brief drop),
          // so reconnecting showed a stale mix of the old session's lines plus
          // whatever Roku streamed next. The console should only show what the
          // device emits from this connection onward. Clear in place — the
          // surface holds the same `logLines` array reference (see
          // `clearConsoleLocal`), so reassigning would orphan the virtualizer.
          logLines.length = 0;
          virt.setCount(0);
          findBarHandle?.resetFindState();
          // Discard the previous session's disk spill before opening the fresh
          // one below, otherwise its old trimmed history could be auto-loaded
          // back into the clean view on scroll-up.
          if (spillId) {
            const stale = spillId;
            spillId = null;
            void window.roku.consoleSpillClear(stale).catch(() => {
              /* best effort */
            });
          }
          // Open a fresh disk-spill session for this Connect. Tag with the
          // device IP so co-existing tab spills are distinguishable in the
          // temp dir (purely a debugging convenience). Fire-and-forget; if
          // the IPC fails the spill stays disabled for this session and the
          // counter falls back to "buffered only".
          spillCapHit = false;
          spilledEntryCount = 0;
          spillAutoLoaded = false;
          spillAutoLoadInFlight = false;
          window.roku
            .consoleSpillStart(api.ip)
            .then((res: { success: boolean; spillId?: string; error?: string }) => {
              if (res?.success && res.spillId) {
                spillId = res.spillId;
              } else {
                console.warn('[Console spill] start failed:', res?.error);
              }
            })
            .catch((err: unknown) => {
              console.warn('[Console spill] start rejected:', err);
            });
          updateConnectionState(true);
          const relayNote = api.isRemote
            ? options?.skipRelayBuffer
              ? ' (via relay, skip existing logs buffer)'
              : ' (via relay, replay buffer)'
            : '';
          addLogLine(`--- Connected to ${api.ip}:8085${relayNote} ---`, false);
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
   * Read the disk spill (if any), parse the NDJSON back into
   * `TelnetLogEntry`s, and prepend to the in-memory entries — producing
   * the *full* session history this device tab has seen, regardless of
   * whether older lines were trimmed past the 50K in-memory cap. Returns
   * the in-memory list verbatim when no spill exists (the common case).
   *
   * Used by Copy / Save / Cmd+A. Async because the spill read is an IPC
   * call; the worst case (100 MB file) lands in well under a second.
   *
   * Spilled entries lose their wall-clock timestamps (the spill format only
   * carries `text`/`type`/`structuredTargets` — timestamps are a viewer
   * affordance, never serialised). That's fine: Copy/Save don't include
   * per-line timestamps in their body either, only in the header block.
   */
  async function loadAllEntriesIncludingSpill(): Promise<TelnetLogEntry[]> {
    if (!spillId || spilledEntryCount === 0) return logLines;
    try {
      const res = (await window.roku.consoleSpillRead(spillId)) as {
        success: boolean;
        entries?: string[];
        error?: string;
      };
      if (!res?.success || !Array.isArray(res.entries) || res.entries.length === 0) {
        if (!res?.success) console.warn('[Console spill] read failed:', res?.error);
        return logLines;
      }
      const spilled: TelnetLogEntry[] = [];
      for (const line of res.entries) {
        try {
          const obj = JSON.parse(line) as { t?: string; ty?: string; st?: StructuredConsolePayload[] };
          if (typeof obj?.t !== 'string' || typeof obj?.ty !== 'string') continue;
          spilled.push({
            text: obj.t,
            timestamp: null,
            type: obj.ty,
            ...(obj.st ? { structuredTargets: obj.st } : {})
          });
        } catch {
          // Tolerate a corrupt line (rare — would mean a write was
          // truncated mid-line). Skip and continue.
        }
      }
      return [...spilled, ...logLines];
    } catch (e) {
      console.warn('[Console spill] read rejected:', e);
      return logLines;
    }
  }

  /**
   * Settle pending IPC batches and pull in any disk-spilled history so the
   * caller sees the complete "everything this device tab has logged"
   * sequence. Both `getVisibleLogLines` and `getVisibleLogsBody` are built
   * on this — keeping the flush+load step in one place means a future
   * change (e.g. an extra await on a metadata fetch) lands once instead of
   * drifting between Copy and Save body paths.
   */
  async function loadAllEntriesForExport(): Promise<TelnetLogEntry[]> {
    flushTelnetPendingLinesSync();
    return loadAllEntriesIncludingSpill();
  }

  /**
   * Source of truth for "what the user sees and would expect to take with
   * them" — drives Copy / Save / Cmd+A. Delegates to `selectVisibleLogEntries`
   * (shared with the Log Viewer) to apply the *filter*-mode query.
   */
  async function getVisibleLogLines(): Promise<typeof logLines> {
    const allEntries = await loadAllEntriesForExport();
    return selectVisibleLogEntries(allEntries, findBarHandle) as typeof logLines;
  }

  async function getVisibleLogsBody(): Promise<string> {
    const allEntries = await loadAllEntriesForExport();
    return buildVisibleLogText(allEntries, findBarHandle);
  }

  // Optional chrome — same `if (saveBtn) { … }` shape used for the Save
  // button below. A reused panel fragment without a `.telnet-copy-btn`
  // element silently no-ops the Copy affordance instead of throwing.
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      // Async because spill read is an IPC call. The visual feedback
      // ("Copied!") is set *after* the await so the user doesn't see
      // success for a copy that's still loading from disk; the spinner
      // path is reserved for the (unusual) case where the spill read
      // dominates wall-clock time.
      const visibleLogs = await getVisibleLogsBody();
      void window.roku.copyToClipboard(visibleLogs);

      // Visual feedback
      const originalText = copyBtn.innerHTML;
      setSafeHTML(copyBtn, '<span class="icon icon-xs"><svg><use href="#icon-check"/></svg></span> Copied!');
      setTimeout(() => {
        setSafeHTML(copyBtn, originalText);
      }, 2000);
    });
  }

  // Save = Copy body + a header block (device + timestamp + line count) +
  // write-to-file via the system save dialog. The body itself comes through
  // the same `getVisibleLogLines` helper as Copy so the two stay byte-for-
  // byte identical and a future filter rule only has to land in one place.
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      // Store original button text at the start
      const originalText = saveBtn.innerHTML;

      try {
        const logsToSave = await getVisibleLogLines();

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
        const result = await window.roku.saveTextFile({
          content,
          defaultName: `roku-console-logs-${Date.now()}.txt`,
          dialogTitle: 'Save Console Logs'
        });
        
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
  
  if (scrollToBottomBtn) {
    scrollToBottomBtn.addEventListener('click', () => {
      scrollToLatestLogs();
    });
  }

  // Wheel up is an explicit "leave the tail" gesture; don't infer that from
  // distance-from-bottom after programmatic scroll/layout churn.
  outputEl.addEventListener(
    'wheel',
    (e) => {
      if (isScrolling) return;
      if (e.deltaY < 0) {
        pinnedToBottom = false;
        updateScrollToBottomAffordance();
      }
    },
    { passive: true }
  );

  outputEl.addEventListener('scroll', handleScroll, { passive: true });

  outputEl.querySelector('.telnet-scroll-spacer')?.remove();

  function clearConsoleLocal(): void {
    telnetTcpState.value = '';
    pendingTelnetLines.length = 0;
    telnetParserState.pendingLogPrefix = '';
    cancelTelnetFlush();
    clearDeferredTelnetHeavyLines();
    // Clear in place — `mountConsoleLogSurface` holds the same array
    // reference as `entries`. Reassigning (`logLines = []`) would leave the
    // virtualizer + find bar observing a stale array while new IPC batches
    // push into a fresh one: the line counter increments but nothing renders.
    logLines.length = 0;
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
    // Wipe the disk spill too — the user explicitly asked for a clean
    // slate; keeping spilled history would be misleading. Then drop the
    // spillId so subsequent trims don't try to write to a deleted file.
    if (spillId) {
      const closing = spillId;
      spillId = null;
      void window.roku.consoleSpillClear(closing).catch(() => {
        /* best effort */
      });
    }
    spilledEntryCount = 0;
    spillCapHit = false;
    spillAutoLoaded = false;
    spillAutoLoadInFlight = false;
    // Open a fresh spill if we're still connected — Clear during an active
    // session should resume capturing future trims to disk.
    if (isConnected) {
      window.roku.consoleSpillStart(api.ip).then(
        (res: { success: boolean; spillId?: string }) => {
          if (res?.success && res.spillId) spillId = res.spillId;
        },
        () => {
          /* best effort */
        }
      );
    }
    refreshLineCount();

    // Reset scroll-tail tracking so the next batch of incoming lines
    // pins to the bottom (consistent with a fresh-clear UX).
    pinnedToBottom = true;
    lastScrollTop = 0;
    outputEl.scrollTop = 0;
    updateScrollToBottomAffordance();

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
        // Reinsert the placeholder before the virtualizer's spacer
        // container so the cold-start sibling order (placeholder → container)
        // is preserved. The surface owns the container; `getContainerEl()`
        // exposes it without a fragile `outputEl.querySelector(...)` lookup.
        outputEl.insertBefore(placeholder, surface.view.getContainerEl());
      }
    }
  }

  // Clear console (local scrollback only)
  clearBtn.addEventListener('click', () => {
    clearConsoleLocal();
  });

  const splitMenuCleanups: Array<() => void> = [];
  const registerSplitMenuCleanup = (fn: () => void) => {
    splitMenuCleanups.push(fn);
  };

  // Relay Connect: default replays the server gap buffer; menu offers live-only.
  const connectMenuBtn = panel.querySelector<HTMLButtonElement>('.telnet-connect-menu-btn');
  const connectMenu = panel.querySelector<HTMLElement>('.telnet-connect-menu');
  const connectLiveOnlyItem = panel.querySelector<HTMLButtonElement>(
    '.telnet-connect-menu-item[data-connect-action="live-only"]'
  );

  if (isRelayConsole && connectSplit && connectMenuBtn && connectMenu && connectLiveOnlyItem) {
    const connectMenuUi = wireTelnetSplitMenu(connectSplit, connectMenuBtn, connectMenu, registerSplitMenuCleanup);
    connectLiveOnlyItem.addEventListener('click', () => {
      connectMenuUi.close();
      void connectTelnet({ skipRelayBuffer: true });
    });
  }

  // Relay Clear: main button = local only; menu = relay-only or local + relay.
  const clearMenuBtn = panel.querySelector<HTMLButtonElement>('.telnet-clear-menu-btn');
  const clearMenu = panel.querySelector<HTMLElement>('.telnet-clear-menu');
  const clearRelayOnlyItem = panel.querySelector<HTMLButtonElement>(
    '.telnet-clear-menu-item[data-clear-action="relay-buffer"]'
  );
  const clearLocalAndRelayItem = panel.querySelector<HTMLButtonElement>(
    '.telnet-clear-menu-item[data-clear-action="local-and-relay"]'
  );

  function clearRelayBufferOnServer(): void {
    void api.telnetClearRelayBuffer!().then((res) => {
      if (res?.success === false) {
        console.warn('[Console] relay buffer clear failed:', res?.error);
      }
    }).catch((err: unknown) => {
      console.warn('[Console] relay buffer clear rejected:', err);
    });
  }

  const clearSplit = panel.querySelector<HTMLElement>('.telnet-clear-split');
  if (isRelayConsole && clearSplit && clearMenuBtn && clearMenu && clearRelayOnlyItem && clearLocalAndRelayItem) {
    const clearMenuUi = wireTelnetSplitMenu(clearSplit, clearMenuBtn, clearMenu, registerSplitMenuCleanup);
    clearRelayOnlyItem.addEventListener('click', () => {
      clearMenuUi.close();
      clearRelayBufferOnServer();
    });
    clearLocalAndRelayItem.addEventListener('click', () => {
      clearMenuUi.close();
      clearConsoleLocal();
      clearRelayBufferOnServer();
    });
  }

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

  const telnetDeviceRef = {
    ip: api.ip,
    isRemote: api.isRemote,
    serverUrl: api.serverUrl
  };

  function isOurTelnetEvent(data: unknown): data is DebugTelnetIpcPayload {
    return debugTelnetIpcTargetsDevice(data as DebugTelnetIpcPayload, telnetDeviceRef);
  }

  // Listen for telnet events (these come from the main process).
  // Filter by connectionId so remote tabs at the same private IP (or a local
  // tab plus a remote tab at the same address) do not cross-deliver chunks.
  const dataCleanup = window.roku.onTelnetData((data) => {
    const payload = data as DebugTelnetIpcPayload & { data?: string };
    if (isOurTelnetEvent(payload) && typeof payload.data === 'string') {
      ingestTelnetIpcChunk(payload.data);
    }
  });

  const disconnectCleanup = window.roku.onTelnetDisconnected((data) => {
    const payload = data as DebugTelnetIpcPayload & {
      hadError?: boolean;
      aliveMs?: number;
      bytesReceived?: number;
    };
    if (isOurTelnetEvent(payload)) {
      const tail = takeTelnetTail(telnetTcpState);
      if (tail) {
        pendingTelnetLines.push(tail);
      }
      flushTelnetPendingLinesSync();
      if (telnetParserState.pendingLogPrefix) {
        addLogLine(telnetParserState.pendingLogPrefix);
        telnetParserState.pendingLogPrefix = '';
      }

      // Diagnostic detail from main: how long the socket stayed open and
      // whether any bytes ever arrived. Roku 8085 closing fast with zero
      // bytes received is the classic "another telnet client holds the
      // BrightScript log binding" / "channel exited immediately" pattern;
      // a plain "--- Connection closed ---" hides the actual cause.
      const aliveMs = typeof payload.aliveMs === 'number' ? payload.aliveMs : -1;
      const bytes = typeof payload.bytesReceived === 'number' ? payload.bytesReceived : -1;
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
      } else if (payload.hadError) {
        addLogLine('--- Hint: socket close was abnormal (TCP RST or similar). Roku may have rebooted or another client took the 8085 binding. ---', false);
      }

      updateConnectionState(false, false, payload.hadError ? 'Connection lost' : null);
    }
  });
  
  const errorCleanup = window.roku.onTelnetError((data) => {
    const payload = data as DebugTelnetIpcPayload & { error?: string };
    if (isOurTelnetEvent(payload)) {
      addLogLine(`--- Error: ${payload.error ?? 'Unknown error'} ---`, false);
    }
  });
  
  // Store cleanup functions on panel for later removal
  panel._telnetCleanup = () => {
    for (const fn of splitMenuCleanups) fn();
    // Surface dispose tears down: find bar (clears caches + highlight
    // registry + listeners), document-level keydown shortcut listener,
    // virtualizer ResizeObservers + scroll observers + all mounted rows.
    // Without this, repeated panel reuse (device switch) would accumulate
    // observers on the same scroll element.
    surface.dispose();
    document.removeEventListener(CONSOLE_VIEWER_CLOSED_EVENT, onTelnetViewerClosedResume);
    cancelTelnetFlush();
    clearDeferredTelnetHeavyLines();
    dataCleanup();
    disconnectCleanup();
    errorCleanup();
    // Drop the disk spill for this tab. The renderer-side cleanup is
    // best-effort (the main process also wipes the temp dir on
    // `app.on('will-quit')`), but doing it eagerly here avoids leaving
    // orphan files for users who keep the app open with frequent
    // device-tab churn.
    if (spillId) {
      const closing = spillId;
      spillId = null;
      void window.roku.consoleSpillClear(closing).catch(() => {
        /* best effort */
      });
    }
    // Disconnect if still connected
    if (isConnected) {
      api.telnetDisconnect().catch(() => {});
    }
  };
}

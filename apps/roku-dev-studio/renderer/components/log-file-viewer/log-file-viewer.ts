import { mountConsoleLogFileView, rawLogFileTextToEntries } from '../../modules/telnet/console-log-file-view.js';
import { setTelnetViewerModalTitlePrefix } from '../../modules/telnet/telnet-console-modal-title.js';
import { attachTelnetOutputFindBar } from '../../modules/telnet/telnet-output-find-bar.js';
import { attachViewerShortcuts } from '../../modules/telnet/telnet-viewer-shortcuts.js';

declare global {
  interface Window {
    roku: {
      loadLogViewerFile: () => Promise<{
        success: boolean;
        error?: string;
        fileName?: string;
        content?: string;
      }>;
      copyToClipboard: (text: string) => Promise<unknown>;
      openExternal: (url: string) => Promise<unknown>;
    };
  }
}

async function main() {
  const statusEl = document.getElementById('logViewerStatus');
  const titleEl = document.getElementById('logViewerTitle');
  const outputEl = document.getElementById('logViewerOutput');

  if (!(outputEl instanceof HTMLElement)) return;

  let res: Awaited<ReturnType<typeof window.roku.loadLogViewerFile>>;
  try {
    res = await window.roku.loadLogViewerFile();
  } catch (e: unknown) {
    // ipcRenderer.invoke can reject; without this the viewer silently shows a blank pane.
    if (statusEl) {
      statusEl.textContent = e instanceof Error ? e.message : 'Could not load file';
      statusEl.classList.add('log-viewer-status--error');
    }
    return;
  }
  if (!res.success) {
    if (statusEl) {
      statusEl.textContent = res.error || 'Could not load file';
      statusEl.classList.add('log-viewer-status--error');
    }
    return;
  }

  if (res.fileName) {
    setTelnetViewerModalTitlePrefix(res.fileName);
    if (titleEl) {
      titleEl.textContent = res.fileName;
    }
    document.title = `Log Viewer ♦ ${res.fileName}`;
  }
  if (statusEl) {
    const lines = (res.content || '').split(/\r?\n/).length;
    statusEl.textContent = `${lines.toLocaleString()} lines`;
  }

  const entries = rawLogFileTextToEntries(res.content || '', false);

  // Late-bound find-bar handle: the virtualizer's onMount/onUnmount fire as
  // rows scroll into the visible window, *before* the find bar itself is
  // constructed below. The closure-captured ref lets the initial mounts
  // no-op safely (handle is null), then later mounts / unmounts wire through
  // to the find bar's per-line range binders for search highlights.
  let findBarHandle: ReturnType<typeof attachTelnetOutputFindBar> = null;

  const viewHandle = mountConsoleLogFileView(outputEl, entries, {
    onLineMount: (idx, el) => findBarHandle?.bindLineHighlights(idx, el),
    onLineUnmount: (idx) => findBarHandle?.unbindLineHighlights(idx)
  });

  const header = document.getElementById('logViewerHeader');
  const findHost = document.getElementById('logViewerFindHost');
  findHost?.removeAttribute('hidden');
  if (header) {
    findBarHandle = attachTelnetOutputFindBar({
      root: header,
      outputEl,
      model: viewHandle,
      // Find's "scroll into view on next/prev" must use the virtualizer's
      // scroll-to-index path (it mounts the row first, then scrolls) instead
      // of the DOM `scrollIntoView` which assumes the row is already in DOM.
      scrollLineIntoView: (idx) => viewHandle.scrollToIndex(idx, { align: 'center' })
    });
  }

  attachViewerShortcuts({
    findBar: findBarHandle,
    outputEl,
    findInputEl: header?.querySelector<HTMLInputElement>('.telnet-find-input') ?? null
  });
}

void main();

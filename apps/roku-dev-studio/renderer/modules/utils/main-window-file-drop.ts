/**
 * Drag a log file or Network Session file onto the main window to open it in
 * the matching standalone viewer — the same file types the File menu's "Open
 * Log File…" / "Open Network Session…" items and OS "Open With" already
 * accept (see `@shared/file-associations.js`, the single source of truth for
 * which extensions belong to which viewer).
 *
 * Path resolution mirrors the existing sideload drop-zone
 * (`resolveDroppedSideloadFile` / `renderer/components/dev-app/sideloading.ts`):
 * the renderer can't read a dropped `File`'s real path directly in modern
 * Electron, so preload resolves it via `webUtils.getPathForFile` before
 * handing paths to main.
 *
 * The full-window overlay shown while dragging is best-effort about telling
 * supported apart from unsupported: Chromium exposes a dragged file's *name*
 * during dragenter/dragover (its full path only resolves on drop). If a
 * future Chromium ever stops exposing the name pre-drop, this just falls back
 * to a generic "Drop files to open" message — actually opening the file at
 * drop time is unaffected either way.
 *
 * Decision logic (which state a drag is in, what the overlay/toast should
 * say) lives in `main-window-file-drop-logic.ts`, split out so it's testable
 * without a DOM. This file is just the event wiring + rendering.
 */
import { icon, setSafeHTML } from './dom.js';
import { showToast } from './ui.js';
import { S } from '@shared/strings/index.js';
import { classifyDragNames, overlayText, describeDropResult, type DragState, type OpenDroppedFilesResult } from './main-window-file-drop-logic.js';

function buildOverlay(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'mainWindowFileDropOverlay';
  el.className = 'file-drop-overlay';
  el.hidden = true;
  setSafeHTML(
    el,
    '<div class="file-drop-overlay-inner">' +
      '<span class="file-drop-overlay-icon"></span>' +
      '<p class="file-drop-overlay-text"></p>' +
      '</div>'
  );
  document.body.appendChild(el);
  return el;
}

/** Every dragged item's name (best-effort — see module doc), skipping any
 *  non-file item or one whose name couldn't be read pre-drop. */
function draggedFileNames(items: DataTransferItemList): string[] {
  const names: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || item.kind !== 'file') continue;
    const name = item.getAsFile()?.name;
    if (name) names.push(name);
  }
  return names;
}

function paintOverlay(el: HTMLElement, state: DragState, names: string[]): void {
  el.classList.remove('file-drop-overlay--supported', 'file-drop-overlay--unsupported', 'file-drop-overlay--mixed');
  if (state !== 'unknown') el.classList.add(`file-drop-overlay--${state}`);
  const iconEl = el.querySelector<HTMLElement>('.file-drop-overlay-icon');
  const textEl = el.querySelector<HTMLElement>('.file-drop-overlay-text');
  if (iconEl) {
    setSafeHTML(
      iconEl,
      state === 'unsupported'
        ? icon('x', 'icon-3xl', 'icon-red')
        : icon('file-text', 'icon-3xl', state === 'mixed' ? 'icon-amber' : 'icon-green')
    );
  }
  if (textEl) textEl.textContent = overlayText(state, names);
}

function isFileDrag(e: DragEvent): boolean {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
}

function showResultToast(result: OpenDroppedFilesResult | undefined): void {
  const described = describeDropResult(result);
  if (described) showToast(described.message, described.tone);
}

/** Call once from the main window's bootstrap. No-op in any other window
 *  (its preload doesn't expose `openDroppedAssociatedFiles`). */
export function setupMainWindowFileDropZone(): void {
  if (typeof window.roku?.openDroppedAssociatedFiles !== 'function') return;
  const overlay = buildOverlay();
  let depth = 0;

  // Always prevent default on dragover regardless of drag type — Electron's
  // default action for an unhandled drop is to navigate the window to the
  // dropped item, which would blank the whole app.
  window.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
    if (isFileDrag(e) && e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  window.addEventListener('dragenter', (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    depth++;
    if (depth > 1) return; // already showing; a nested enter doesn't change the verdict
    const names = e.dataTransfer ? draggedFileNames(e.dataTransfer.items) : [];
    overlay.hidden = false;
    paintOverlay(overlay, classifyDragNames(names), names);
  });

  window.addEventListener('dragleave', (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) overlay.hidden = true;
  });

  window.addEventListener('drop', (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    depth = 0;
    overlay.hidden = true;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    void window.roku.openDroppedAssociatedFiles(files).then(showResultToast, () => {
      showToast(S.app.fileDropFailed, 'error');
    });
  });
}

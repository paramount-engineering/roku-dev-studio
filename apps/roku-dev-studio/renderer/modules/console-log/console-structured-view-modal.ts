import { createSingletonConsoleModal } from './singleton-console-modal.js';
import { consoleViewerModalTitle } from './console-modal-title.js';
import type { StructuredConsolePayload } from './structured-log-detect.js';
import { toggleFoldGroup } from './console-structured-syntax.js';
import { renderStructuredInto, structuredBodyText } from '../ui/structured-body.js';
import { attachSelectAll } from '../ui/select-all.js';
import { S } from '@shared/strings/index.js';

const OVERLAY_ID = 'telnetStructuredViewerOverlay';

/** First Element on the event path (skips Text nodes, etc.). */
export function firstHitElementOnConsoleClick(e: MouseEvent): Element | null {
  for (const n of e.composedPath()) {
    if (n instanceof Element) return n;
  }
  return null;
}

/** Find the `.telnet-log-line` hosting this click (works when `event.target` is a Text node). */
export function closestConsoleLogLineFromEvent(e: MouseEvent): HTMLElement | null {
  const start = firstHitElementOnConsoleClick(e);
  const fromClosest = start?.closest('.telnet-log-line');
  if (fromClosest instanceof HTMLElement) return fromClosest;
  for (const n of e.composedPath()) {
    if (n instanceof HTMLElement && n.classList.contains('telnet-log-line')) return n;
  }
  return null;
}

/** Resolve the entry index for a mounted `.telnet-log-line` row. */
export function consoleLogLineEntryIndex(line: HTMLElement): number {
  const raw = line.dataset.lineIndex ?? line.dataset.index ?? '';
  const idx = parseInt(raw, 10);
  return Number.isFinite(idx) && idx >= 0 ? idx : -1;
}

export function primaryStructuredTarget(
  targets: ReadonlyArray<StructuredConsolePayload>
): StructuredConsolePayload | undefined {
  if (targets.length === 0) return undefined;
  const outerJson = targets.find((t) => t.kind === 'json' && !t.fromEscapedString);
  if (outerJson) return outerJson;
  return targets[0];
}

/**
 * Walks `.telnet-log-content`'s text nodes (incl. children of `.telnet-log-url`)
 * in DOM order, summing lengths until reaching the caret's text node — this is
 * the inverse of the find bar's `flatOffsetToDomPosition` and shares the same
 * invariant: `contentEl.textContent` equals the entry's flat text.
 */
function clickToFlatOffset(contentEl: HTMLElement, e: MouseEvent): number | null {
  const cpfp = (
    document as unknown as {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    }
  ).caretPositionFromPoint;

  let textNode: Text | null = null;
  let offset = 0;
  if (typeof cpfp === 'function') {
    const pos = cpfp.call(document, e.clientX, e.clientY);
    if (pos && pos.offsetNode instanceof Text) {
      textNode = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (typeof document.caretRangeFromPoint === 'function') {
    const r = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (r && r.startContainer instanceof Text) {
      textNode = r.startContainer;
      offset = r.startOffset;
    }
  }
  if (!textNode || !contentEl.contains(textNode)) return null;

  const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n === textNode) return consumed + offset;
    consumed += n.nodeValue?.length ?? 0;
  }
  return null;
}

/**
 * Pick the structured-payload index a click landed on. Prefers the *deepest* (smallest
 * range) nested target whose `lineRange` contains the click's flat offset, so clicks
 * inside a nested JSON+ literal open that literal — not the outer object that wraps it.
 * Returns `0` when the click can't be mapped or no nested range contains it; the
 * outer-JSON-as-default behavior the line click handler had before nested ranges existed.
 */
export function clickedStructuredTargetIndex(
  contentEl: HTMLElement,
  e: MouseEvent,
  targets: ReadonlyArray<{ lineRange?: [number, number] }>
): number {
  if (targets.length <= 1) return 0;
  const flat = clickToFlatOffset(contentEl, e);
  if (flat == null) return 0;
  let bestIdx = 0;
  let bestSize = Infinity;
  for (let i = 0; i < targets.length; i++) {
    const r = targets[i]!.lineRange;
    if (!r) continue;
    const [s, end] = r;
    if (flat < s || flat >= end) continue;
    const size = end - s;
    if (size < bestSize) {
      bestSize = size;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Shared singleton overlay lifecycle (backdrop, Esc, focus trap, scroll reset,
// motion bridging) lives in `singleton-telnet-modal.ts`. This file owns the
// JSON/XML-specific markup, the Copy button, and the fold-twisty delegate.
const structuredModal = createSingletonConsoleModal({
  overlayId: OVERLAY_ID,
  innerHTML: `
    <div class="modal telnet-structured-view-modal" role="dialog" aria-modal="true" aria-labelledby="telnetStructuredViewerTitle">
      <div class="modal-header">
        <span class="modal-title" id="telnetStructuredViewerTitle">${S.consoleLog.titlePrefix}</span>
        <div class="telnet-structured-view-modal-actions">
          <button type="button" class="btn btn-secondary telnet-structured-view-copy" title="${S.consoleLog.copyFormattedTitle}">${S.common.copy}</button>
          <button type="button" class="modal-close telnet-structured-view-close" aria-label="${S.common.close}"><span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span></button>
        </div>
      </div>
      <div class="modal-body telnet-structured-view-body">
        <pre class="telnet-structured-view-pre" tabindex="0"></pre>
      </div>
    </div>
  `,
  closeButtonSelector: '.telnet-structured-view-close',
  onMount: (overlay) => {
    // Delegated twisty handler: one listener for the whole modal regardless
    // of how many fold groups the current payload rendered. We attach to the
    // <pre> (not the body) so text selection inside the body doesn't pay the
    // cost of bubbling through this guard, and so toggling never accidentally
    // fires on the Copy button. Twisties carry `tabindex="-1"` and bypass the
    // modal's natural keyboard flow — fold is mouse-driven per the v1 scope;
    // revisit if we add keyboard fold shortcuts.
    const preForFold = overlay.querySelector('.telnet-structured-view-pre');
    if (preForFold instanceof HTMLElement) {
      preForFold.addEventListener('click', (e) => {
        const t = e.target;
        const start = t instanceof Element ? t : t instanceof Text ? t.parentElement : null;
        const twisty = start?.closest('.telnet-fold-twisty');
        if (!(twisty instanceof HTMLElement)) return;
        const group = twisty.closest('.telnet-fold-group');
        if (!(group instanceof HTMLElement)) return;
        e.preventDefault();
        e.stopPropagation();
        toggleFoldGroup(group);
      });
      // Cmd/Ctrl+A selects all the formatted text within the viewer (not the whole page).
      attachSelectAll(preForFold);
    }

    const copyBtn = overlay.querySelector('.telnet-structured-view-copy');
    copyBtn?.addEventListener('click', async () => {
      const pre = overlay.querySelector('.telnet-structured-view-pre');
      const text = pre instanceof HTMLElement ? structuredBodyText(pre) : '';
      try {
        await window.roku.copyToClipboard(text);
        if (copyBtn instanceof HTMLElement) {
          const prev = copyBtn.textContent;
          copyBtn.textContent = S.consoleLog.copied;
          setTimeout(() => {
            copyBtn.textContent = prev || S.common.copy;
          }, 1600);
        }
      } catch {
        /* ignore */
      }
    });
  }
});

/**
 * Open the shared formatted JSON/XML viewer (singleton overlay).
 */
export function openConsoleStructuredViewer(
  opener: HTMLElement | null,
  payload: StructuredConsolePayload,
  options?: { titlePrefix?: string }
): void {
  structuredModal.open(opener, (overlay) => {
    const title = overlay.querySelector('#telnetStructuredViewerTitle');
    const pre = overlay.querySelector('.telnet-structured-view-pre');

    if (title) {
      const label = payload.kind === 'json' ? S.consoleLog.jsonLabel : S.consoleLog.xmlLabel;
      const prefix = options?.titlePrefix?.trim();
      // The structured viewer is a shared singleton (Console + Network Inspector). Honor an explicit
      // prefix so a payload opened from the Network Inspector isn't mislabeled "Console".
      title.textContent = prefix ? `${prefix}: ${label}` : consoleViewerModalTitle(label);
    }
    if (pre instanceof HTMLElement) {
      // `pre.dataset.formatted` backs the Copy button and stays decoupled from the rendered DOM
      // regardless of which fold groups the user collapses. `payload.formatted` is already
      // pretty-printed by detection, so the shared renderer runs in `preformatted` mode.
      pre.dataset.formatted = payload.formatted;
      pre.replaceChildren();
      const code = document.createElement('code');
      code.className = `telnet-hl-root telnet-hl-${payload.kind}`;
      renderStructuredInto(code, payload.formatted, { kind: payload.kind, preformatted: true });
      pre.appendChild(code);
    }
  });
}

/**
 * Append JSON/XML pills. Clicks are handled by delegated listeners on the
 * scroll container (see `console-log-file-view.ts`) so each open resolves
 * `structuredTargets` from the live entry via `data-line-index` — not from
 * closures that can go stale after virtualizer trim/recycle.
 *
 * UX contract:
 * - **JSON** (outer): opens the primary payload for the line.
 * - **JSON+** (nested): opens that nested fragment only.
 * - **Log text** (`.telnet-log-content`): same as **JSON** — primary payload.
 */
export function attachStructuredPillsToLine(
  lineEl: HTMLElement,
  contentEl: HTMLElement,
  targets: StructuredConsolePayload[]
): void {
  if (targets.length === 0) return;
  lineEl.classList.add('has-structured');
  const primary = primaryStructuredTarget(targets);
  const hasNested = targets.some((t) => t.fromEscapedString);
  const defaultHint =
    primary?.kind === 'json'
      ? hasNested
        ? S.consoleLog.hintJsonFullNested
        : S.consoleLog.hintJsonFormatted
      : hasNested
        ? S.consoleLog.hintXmlFull
        : S.consoleLog.hintXmlFormatted;
  contentEl.title = defaultHint;

  const wrap = document.createElement('span');
  wrap.className = 'telnet-structured-view-pills';

  for (let i = 0; i < targets.length; i++) {
    const structured = targets[i]!;
    const hint =
      structured.kind === 'json' && structured.fromEscapedString
        ? S.consoleLog.hintPillNestedJson
        : structured.kind === 'json'
          ? S.consoleLog.hintPillFullJson
          : S.consoleLog.hintXmlFormatted;
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'telnet-structured-view-pill';
    if (structured.fromEscapedString) pill.classList.add('telnet-structured-view-pill--nested');
    pill.textContent =
      structured.kind === 'json'
        ? structured.fromEscapedString
          ? S.consoleLog.jsonPlusLabel
          : S.consoleLog.jsonLabel
        : S.consoleLog.xmlLabel;
    pill.title = hint;
    pill.setAttribute('aria-label', hint);
    pill.dataset.structuredIndex = String(i);
    wrap.appendChild(pill);
  }
  lineEl.appendChild(wrap);
}

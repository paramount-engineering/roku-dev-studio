import { closeModalWithOriginMotion, openModalOverlayActiveFromOpener } from '../utils/modal-origin-motion.js';
import { resetTelnetModalScrollInOverlay, scheduleTelnetModalScrollReset } from '../utils/telnet-modal-scroll-reset.js';
import { telnetConsoleModalTitle } from './telnet-console-modal-title.js';
import { notifyTelnetViewerClosed } from './telnet-viewer-bridge.js';
import type { StructuredConsolePayload } from './structured-log-detect.js';
import { applyJsonSyntaxHighlight, applyXmlSyntaxHighlight } from './telnet-structured-syntax.js';

const OVERLAY_ID = 'telnetStructuredViewerOverlay';

let telnetStructuredEscapeListenerAdded = false;

/** First Element on the event path (skips Text nodes, etc.). */
export function firstHitElementOnTelnetClick(e: MouseEvent): Element | null {
  for (const n of e.composedPath()) {
    if (n instanceof Element) return n;
  }
  return null;
}

/** Find the `.telnet-log-line` hosting this click (works when `event.target` is a Text node). */
export function closestTelnetLogLineFromEvent(e: MouseEvent): HTMLElement | null {
  const start = firstHitElementOnTelnetClick(e);
  const fromClosest = start?.closest('.telnet-log-line');
  if (fromClosest instanceof HTMLElement) return fromClosest;
  for (const n of e.composedPath()) {
    if (n instanceof HTMLElement && n.classList.contains('telnet-log-line')) return n;
  }
  return null;
}

/**
 * Map a click on `contentEl` to a flat character offset into the line's text.
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

function ensureOverlay(): HTMLElement {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing instanceof HTMLElement) return existing;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'modal-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="modal telnet-structured-view-modal" role="dialog" aria-modal="true" aria-labelledby="telnetStructuredViewerTitle">
      <div class="modal-header">
        <span class="modal-title" id="telnetStructuredViewerTitle">Console</span>
        <div class="telnet-structured-view-modal-actions">
          <button type="button" class="btn btn-secondary telnet-structured-view-copy" title="Copy formatted text">Copy</button>
          <button type="button" class="modal-close telnet-structured-view-close" aria-label="Close"><span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span></button>
        </div>
      </div>
      <div class="modal-body telnet-structured-view-body">
        <pre class="telnet-structured-view-pre" tabindex="0"></pre>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => {
    if (!overlay.classList.contains('active')) return;
    closeModalWithOriginMotion(overlay, () => {
      resetTelnetModalScrollInOverlay(overlay);
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      notifyTelnetViewerClosed();
    });
  };

  overlay.querySelector('.telnet-structured-view-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const copyBtn = overlay.querySelector('.telnet-structured-view-copy');
  copyBtn?.addEventListener('click', async () => {
    const pre = overlay.querySelector('.telnet-structured-view-pre');
    const text =
      (pre instanceof HTMLElement && pre.dataset.formatted) || pre?.textContent || '';
    try {
      await window.roku.copyToClipboard(text);
      if (copyBtn instanceof HTMLElement) {
        const prev = copyBtn.textContent;
        copyBtn.textContent = 'Copied';
        setTimeout(() => {
          copyBtn.textContent = prev || 'Copy';
        }, 1600);
      }
    } catch {
      /* ignore */
    }
  });

  if (!telnetStructuredEscapeListenerAdded) {
    telnetStructuredEscapeListenerAdded = true;
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape') return;
        const o = document.getElementById(OVERLAY_ID);
        if (!(o instanceof HTMLElement) || !o.classList.contains('active')) return;
        closeModalWithOriginMotion(o, () => {
          resetTelnetModalScrollInOverlay(o);
          o.classList.remove('active');
          o.setAttribute('aria-hidden', 'true');
          notifyTelnetViewerClosed();
        });
      },
      true
    );
  }

  return overlay;
}

/**
 * Open the shared formatted JSON/XML viewer (singleton overlay).
 */
export function openTelnetStructuredViewer(
  opener: HTMLElement | null,
  payload: StructuredConsolePayload
): void {
  const overlay = ensureOverlay();
  const title = overlay.querySelector('#telnetStructuredViewerTitle');
  const pre = overlay.querySelector('.telnet-structured-view-pre');

  if (title) {
    title.textContent = telnetConsoleModalTitle(payload.kind === 'json' ? 'JSON' : 'XML');
  }
  if (pre instanceof HTMLElement) {
    pre.dataset.formatted = payload.formatted;
    pre.replaceChildren();
    const code = document.createElement('code');
    code.className = `telnet-hl-root telnet-hl-${payload.kind}`;
    if (payload.kind === 'json') {
      applyJsonSyntaxHighlight(code, payload.formatted);
    } else {
      applyXmlSyntaxHighlight(code, payload.formatted);
    }
    pre.appendChild(code);
  }

  resetTelnetModalScrollInOverlay(overlay);
  overlay.setAttribute('aria-hidden', 'false');
  openModalOverlayActiveFromOpener(overlay, opener, () => {
    scheduleTelnetModalScrollReset(overlay);
  });
}

/**
 * Append JSON/XML pills with **direct** click handlers on each pill.
 *
 * UX contract:
 * - **JSON+** (nested / escaped): only that button opens the inner payload (`stopPropagation`).
 * - **JSON** (primary): same — opens the outer fragment only.
 * - **Log text** (`.telnet-log-content`): delegated handler opens `targets[0]` only — the full
 *   structured object for the line (outer JSON when nested JSON+ exists).
 */
export function attachStructuredPillsToLine(
  lineEl: HTMLElement,
  contentEl: HTMLElement,
  targets: StructuredConsolePayload[]
): void {
  if (targets.length === 0) return;
  lineEl.classList.add('has-structured');
  const first = targets[0]!;
  const hasNestedRanges = targets.some((t, i) => i > 0 && t.lineRange);
  const defaultHint =
    first.kind === 'json'
      ? targets.length > 1
        ? hasNestedRanges
          ? 'Click outside a nested JSON+ to view the outer JSON; click inside a nested JSON+ region (or its pill) to view it directly.'
          : 'Click anywhere on this line to view the full (outer) JSON. Use JSON+ for nested JSON only.'
        : 'Click to view formatted JSON (opens in a modal)'
      : targets.length > 1
        ? 'Click anywhere on this line to view the full (outer) XML. Use extra badges for other fragments.'
        : 'Click to view formatted XML (opens in a modal)';
  contentEl.title = defaultHint;

  const wrap = document.createElement('span');
  wrap.className = 'telnet-structured-view-pills';
  wrap.addEventListener('click', (ev) => {
    const t = ev.target;
    const el = t instanceof Element ? t : t instanceof Text ? t.parentElement : null;
    if (el?.closest('.telnet-structured-view-pill')) return;
    ev.stopPropagation();
  });

  for (let i = 0; i < targets.length; i++) {
    const structured = targets[i]!;
    const payload = structured;
    const hint =
      structured.kind === 'json' && structured.fromEscapedString
        ? 'Nested JSON only (from an escaped string). Does not open the full outer JSON.'
        : structured.kind === 'json'
          ? targets.length > 1 && i === 0
            ? 'Outer JSON only — full object for this line (click the line text for the same).'
            : 'Click to view formatted JSON (opens in a modal)'
          : 'Click to view formatted XML (opens in a modal)';
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'telnet-structured-view-pill';
    if (structured.fromEscapedString) pill.classList.add('telnet-structured-view-pill--nested');
    pill.textContent =
      structured.kind === 'json' ? (structured.fromEscapedString ? 'JSON+' : 'JSON') : 'XML';
    pill.title = hint;
    pill.setAttribute('aria-label', hint);
    pill.dataset.structuredIndex = String(i);
    pill.addEventListener(
      'click',
      (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openTelnetStructuredViewer(pill, payload);
      },
      { passive: false }
    );
    wrap.appendChild(pill);
  }
  lineEl.appendChild(wrap);
}

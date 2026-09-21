/**
 * App-wide instant tooltip.
 *
 * Native `title` tooltips are slow and pair with a "?" help cursor that reads as
 * "no tooltip". This shows a styled popover immediately on hover of any element that
 * carries a `title` (moved to `data-tip` so the native one is suppressed), a
 * `data-tip`, or a `data-tip-html`. Multi-line, viewport-clamped, flips below when
 * there's no room above.
 *
 * One shared popover element per document (created lazily). Call
 * {@link attachInstantTooltips} for a subtree to enable it there and get a disposer.
 *
 * Requires the `.rds-tip` / `.rds-tip--visible` CSS to exist in the host window
 * (index.html and settings.html both define it).
 */

let tipEl: HTMLDivElement | null = null;

function getTip(): HTMLDivElement {
  if (tipEl && tipEl.isConnected) return tipEl;
  const el = document.createElement('div');
  el.className = 'rds-tip';
  document.body.appendChild(el);
  tipEl = el;
  return el;
}

/** Targets taller than this (a wrapped multi-line console row, not a button/pill) anchor to the
 *  pointer: their top edge can be hundreds of px away — or scrolled out of view — so a tip placed
 *  above it lands nowhere near where the user is hovering. */
const TALL_TARGET_PX = 40;

type Pointer = { x: number; y: number };

function positionAndShowTip(target: HTMLElement, tip: HTMLDivElement, pointer?: Pointer): void {
  const r = target.getBoundingClientRect();
  const tr = tip.getBoundingClientRect();
  const anchor =
    pointer && r.height > TALL_TARGET_PX
      ? { top: pointer.y - 12, bottom: pointer.y + 16, cx: pointer.x }
      : { top: r.top, bottom: r.bottom, cx: r.left + r.width / 2 };
  let top = anchor.top - tr.height - 6;
  if (top < 4) top = anchor.bottom + 6; // no room above → flip below
  const left = Math.max(4, Math.min(anchor.cx - tr.width / 2, window.innerWidth - tr.width - 4));
  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
  tip.classList.add('rds-tip--visible');
}

function showTip(target: HTMLElement, pointer?: Pointer): void {
  const tip = getTip();
  // `data-tip-html` renders as markup (innerHTML) — ONLY ever author this from a hardcoded,
  // trusted template string (e.g. a `*Html`-suffixed catalog entry), never from user/device/
  // network-supplied text. `title`/`data-tip` (below) stay textContent-only and remain the
  // right choice for anything that isn't a fixed, trusted string.
  const html = target.getAttribute('data-tip-html');
  if (html) {
    tip.innerHTML = html;
    positionAndShowTip(target, tip, pointer);
    return;
  }
  // Adopt a native `title` on first hover (and strip it, so the OS tooltip never shows).
  let text = target.getAttribute('title');
  if (text) {
    target.setAttribute('data-tip', text);
    target.removeAttribute('title');
  } else {
    text = target.getAttribute('data-tip');
  }
  if (!text) {
    tip.classList.remove('rds-tip--visible');
    return;
  }
  tip.textContent = text;
  positionAndShowTip(target, tip, pointer);
}

function hideTip(): void {
  if (tipEl) tipEl.classList.remove('rds-tip--visible');
}

const TIP_SELECTOR = '[title],[data-tip],[data-tip-html]';

/**
 * Enable the instant tooltip for `[title]` / `[data-tip]` / `[data-tip-html]` elements inside
 * `root` (event-delegated — no per-element wiring). Returns a disposer that detaches the
 * listeners and hides the popover. The shared popover element persists across roots.
 */
export function attachInstantTooltips(root: HTMLElement): () => void {
  const onOver = (e: MouseEvent): void => {
    const t = (e.target as HTMLElement)?.closest?.(TIP_SELECTOR) as HTMLElement | null;
    if (t && root.contains(t)) showTip(t, { x: e.clientX, y: e.clientY });
    else hideTip();
  };
  const onOut = (e: MouseEvent): void => {
    const related = e.relatedTarget as Node | null;
    const t = (e.target as HTMLElement)?.closest?.(TIP_SELECTOR);
    if (t && (!related || !(t as HTMLElement).contains(related))) hideTip();
  };
  root.addEventListener('mouseover', onOver);
  root.addEventListener('mouseout', onOut);
  return () => {
    root.removeEventListener('mouseover', onOver);
    root.removeEventListener('mouseout', onOut);
    hideTip();
  };
}

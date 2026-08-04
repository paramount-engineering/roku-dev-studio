/**
 * App-wide instant tooltip.
 *
 * Native `title` tooltips are slow and pair with a "?" help cursor that reads as
 * "no tooltip". This shows a styled popover immediately on hover of any element that
 * carries a `title` (moved to `data-tip` so the native one is suppressed) or a
 * `data-tip`. Multi-line, viewport-clamped, flips below when there's no room above.
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

function showTip(target: HTMLElement): void {
  const tip = getTip();
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
  const r = target.getBoundingClientRect();
  const tr = tip.getBoundingClientRect();
  let top = r.top - tr.height - 6;
  if (top < 4) top = r.bottom + 6; // no room above → flip below
  const left = Math.max(4, Math.min(r.left + r.width / 2 - tr.width / 2, window.innerWidth - tr.width - 4));
  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
  tip.classList.add('rds-tip--visible');
}

function hideTip(): void {
  if (tipEl) tipEl.classList.remove('rds-tip--visible');
}

/**
 * Enable the instant tooltip for `[title]` / `[data-tip]` elements inside `root`
 * (event-delegated — no per-element wiring). Returns a disposer that detaches the
 * listeners and hides the popover. The shared popover element persists across roots.
 */
export function attachInstantTooltips(root: HTMLElement): () => void {
  const onOver = (e: MouseEvent): void => {
    const t = (e.target as HTMLElement)?.closest?.('[title],[data-tip]') as HTMLElement | null;
    if (t && root.contains(t)) showTip(t);
    else hideTip();
  };
  const onOut = (e: MouseEvent): void => {
    const related = e.relatedTarget as Node | null;
    const t = (e.target as HTMLElement)?.closest?.('[title],[data-tip]');
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

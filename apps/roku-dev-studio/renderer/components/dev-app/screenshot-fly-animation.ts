// Flies a just-captured screenshot from the capture button to a transient top-right holding spot,
// then into the screenshot-history/gallery button — replacing the old per-capture preview modal
// (see screenshots.ts) with a lighter "it landed in your history" cue.
//
// Deliberately NOT built on modal-origin-motion.ts: the end state here is never a modal (no
// overlay, nothing stays open), so per this repo's modal-motion convention this is its own
// bespoke effect, not a lazy skip of the shared system — matching the precedent already set by
// components/modals/welcome-feature-modal.ts's flip animation for a genuinely different motion.
// It does reuse that system's general-purpose "something grows/moves into place" easing/duration
// and its getBoundingClientRect()-based positioning technique.

const FLY_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const FLY_DURATION_MS = 460;
const HOLD_MS = 4000;
const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 100;
const CORNER_OFFSET = 16;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function rectCenter(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Briefly scales the gallery button up and back — the "something just arrived" cue for the
 *  animation's landing point. */
function bumpGalleryButton(btn: HTMLElement): void {
  if (reducedMotion()) return;
  btn.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
    { duration: 320, easing: FLY_EASE }
  );
}

/**
 * Fires the fly animation for `imageUrl`, from `fromEl` (the capture button) to `toEl` (the
 * gallery/history button), holding briefly in `boundsEl`'s top-right corner (below its header,
 * if it has one) — the Screen Relay card, not the whole app window, so the hold point stays next
 * to the video it was captured from. Falls back to a no-op (screenshot is already recorded in the
 * session gallery by the caller regardless) when a required element is missing or reduced motion
 * is on.
 *
 * The held thumbnail is itself clickable: `onThumbClick` (passed the thumb element, for use as a
 * modal-motion opener) fires immediately on click, and the hold is cut short right into the same
 * fly-to-gallery motion the timeout would have triggered anyway — clicking shouldn't leave the
 * thumbnail hanging around after the user already acted on it.
 */
export function flyScreenshotToHistory(
  imageUrl: string,
  fromEl: HTMLElement | null,
  toEl: HTMLElement | null,
  boundsEl: HTMLElement | null,
  onThumbClick?: (thumbEl: HTMLElement) => void
): void {
  if (!imageUrl || !fromEl || !toEl || !boundsEl || reducedMotion()) return;
  // Rebind to a non-null alias — TS narrowing from the guard above doesn't flow into the nested
  // `flyIntoGallery` closure below.
  const toElSafe = toEl;

  const fromRect = fromEl.getBoundingClientRect();
  const start = rectCenter(fromRect);

  const thumb = document.createElement('div');
  thumb.className = 'screenshot-fly-thumb';
  thumb.style.backgroundImage = `url("${imageUrl}")`;
  thumb.style.left = `${start.x - THUMB_WIDTH / 2}px`;
  thumb.style.top = `${start.y - THUMB_HEIGHT / 2}px`;
  document.body.appendChild(thumb);

  const boundsRect = boundsEl.getBoundingClientRect();
  const headerBottom = boundsEl.querySelector('.card-header')?.getBoundingClientRect().bottom ?? boundsRect.top;
  const corner = {
    x: boundsRect.right - CORNER_OFFSET - THUMB_WIDTH / 2,
    y: headerBottom + CORNER_OFFSET + THUMB_HEIGHT / 2
  };
  const toCorner = { x: corner.x - start.x, y: corner.y - start.y };

  // Leg 1 — "expand": pops in small from the capture button and overshoots past full size before
  // settling, like a popup springing open, instead of a flat linear move.
  const leg1 = thumb.animate(
    [
      { transform: 'translate(0px, 0px) scale(0.55)', opacity: 0.7, offset: 0 },
      { transform: `translate(${toCorner.x * 0.6}px, ${toCorner.y * 0.6}px) scale(1.16)`, opacity: 1, offset: 0.65 },
      { transform: `translate(${toCorner.x}px, ${toCorner.y}px) scale(0.94)`, opacity: 1, offset: 0.85 },
      { transform: `translate(${toCorner.x}px, ${toCorner.y}px) scale(1)`, opacity: 1, offset: 1 }
    ],
    { duration: FLY_DURATION_MS, easing: FLY_EASE, fill: 'forwards' }
  );

  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let flown = false;

  // Leg 2 — "collapse": bumps slightly bigger mid-flight, then shrinks and fades into the gallery
  // button, mirroring a modal collapsing back into its opener.
  function flyIntoGallery(): void {
    if (flown) return;
    flown = true;
    if (holdTimer) clearTimeout(holdTimer);
    thumb.classList.remove('screenshot-fly-thumb-clickable');

    // Re-read the gallery button's rect live (not captured up front) in case of a resize/scroll
    // during the hold.
    const end = rectCenter(toElSafe.getBoundingClientRect());
    const toEnd = { x: end.x - start.x, y: end.y - start.y };
    const leg2 = thumb.animate(
      [
        { transform: `translate(${toCorner.x}px, ${toCorner.y}px) scale(1)`, opacity: 1, offset: 0 },
        {
          transform: `translate(${lerp(toCorner.x, toEnd.x, 0.4)}px, ${lerp(toCorner.y, toEnd.y, 0.4)}px) scale(1.12)`,
          opacity: 1,
          offset: 0.35
        },
        {
          transform: `translate(${lerp(toCorner.x, toEnd.x, 0.8)}px, ${lerp(toCorner.y, toEnd.y, 0.8)}px) scale(0.55)`,
          opacity: 0.85,
          offset: 0.7
        },
        { transform: `translate(${toEnd.x}px, ${toEnd.y}px) scale(0.12)`, opacity: 0, offset: 1 }
      ],
      { duration: FLY_DURATION_MS, easing: FLY_EASE, fill: 'forwards' }
    );
    leg2.onfinish = () => {
      thumb.remove();
      bumpGalleryButton(toElSafe);
    };
  }

  thumb.classList.add('screenshot-fly-thumb-clickable');
  thumb.addEventListener('click', () => {
    onThumbClick?.(thumb);
    flyIntoGallery();
  });

  leg1.onfinish = () => {
    holdTimer = setTimeout(flyIntoGallery, HOLD_MS);
  };
}

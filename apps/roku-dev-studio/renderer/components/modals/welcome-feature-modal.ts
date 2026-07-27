/**
 * Welcome-screen feature tiles → click to expand into a detail modal.
 *
 * Animation: the modal surface starts mapped onto the clicked tile (translated +
 * scaled to the tile's box) and rotated edge-on (rotateY -90°). It then unflips
 * and grows to its final centered layout — reading as the tile "flipping open"
 * into the modal. Close reverses it: the surface shrinks + flips back down onto
 * the tile, then the overlay is removed. `prefers-reduced-motion` skips the flip.
 */

import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { S } from '@shared/strings/index.js';

interface FeatureDetail {
  blurb: string;
  points: readonly string[];
}

/**
 * Map each welcome tile to its feature-detail key via the tile's title
 * `data-i18n` attribute — a STABLE identifier that does not change when the
 * locale switches (unlike the visible title text). The detail itself is resolved
 * LIVE from `S.modals.features[key]` at open time (see `openFeatureModal`), never
 * captured here at import — capturing would freeze the startup locale AND a
 * localized-title lookup would miss entirely.
 */
const FEATURE_KEY_BY_TITLE_I18N: Record<string, keyof typeof S.modals.features> = {
  'app.featureDeviceDiscovery': 'deviceDiscovery',
  'app.featureAppsDeepLinking': 'appsDeepLinking',
  'app.tabDevApp': 'devApp',
  'app.tabAppConnector': 'appConnector',
  'app.featureFiddle': 'fiddle',
  'app.featureMcpServer': 'mcpServer',
  'app.featureDeviceRemote': 'deviceRemote',
  'app.tabQuery': 'query',
  'app.tabConsole': 'console',
  'app.tabActionScripts': 'actionScripts',
  'app.networkInspector': 'networkInspector',
  'app.featureRemoteLocations': 'remoteLocations'
};

const OVERLAY_CLASS = 'welcome-detail-overlay';
const OPEN_MS = 560;
const CLOSE_MS = 440;
const OPEN_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const CLOSE_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Transform that maps the modal surface (currently at `finalRect`) onto the tile
 * box and flips it edge-on — the "closed" state of the animation.
 */
interface FlipConfig {
  /** Rotation axis: 'Y' = horizontal hinge (mirrored left/right), 'X' = top fold (neutral centre). */
  axis: 'X' | 'Y';
  angle: number;
}

/**
 * The "closed" transform: the surface mapped onto the tile box and flipped
 * edge-on around `cfg.axis`. `openFlipTransform` produces the matching "open"
 * transform with the SAME ordered functions (translate → scale → perspective →
 * rotate<axis>), so the Web Animations API interpolates each function directly
 * instead of decomposing to matrices — that's what keeps the flip smooth and
 * avoids frame-skipping through the 90° singularity.
 */
function closedFlipTransform(tileRect: DOMRect, finalRect: DOMRect, cfg: FlipConfig): string {
  const sx = Math.max(tileRect.width / Math.max(finalRect.width, 1), 0.05);
  const sy = Math.max(tileRect.height / Math.max(finalRect.height, 1), 0.05);
  const tx = tileRect.left + tileRect.width / 2 - (finalRect.left + finalRect.width / 2);
  const ty = tileRect.top + tileRect.height / 2 - (finalRect.top + finalRect.height / 2);
  return `translate(${tx}px, ${ty}px) scale(${sx}, ${sy}) perspective(1400px) rotate${cfg.axis}(${cfg.angle}deg)`;
}

function openFlipTransform(cfg: FlipConfig): string {
  return `translate(0px, 0px) scale(1, 1) perspective(1400px) rotate${cfg.axis}(0deg)`;
}

/**
 * Choose the flip for a tile relative to the *grid* centre (not the window — the
 * grid is offset by the sidebar and its column count is responsive):
 *   - clearly left of centre  → hinge on Y at +90°
 *   - clearly right of centre → hinge on Y at -90°  (mirrored)
 *   - on the centre column (odd-column or single-column layouts, where there's
 *     no left/right side) → fold on X at 90° instead of arbitrarily picking a side.
 */
function flipConfigFor(tile: HTMLElement, tileRect: DOMRect): FlipConfig {
  const grid = tile.closest('.welcome-features') as HTMLElement | null;
  const gridRect = grid?.getBoundingClientRect();
  const midX = gridRect ? gridRect.left + gridRect.width / 2 : window.innerWidth / 2;
  const dx = tileRect.left + tileRect.width / 2 - midX;
  // Within a quarter-tile of centre = the centre column (even layouts have a gap,
  // not a tile, on the midline, so they never fall in here).
  if (Math.abs(dx) < tileRect.width * 0.25) return { axis: 'X', angle: 90 };
  return { axis: 'Y', angle: dx < 0 ? 90 : -90 };
}

function buildModalMarkup(iconWrapHTML: string, title: string, desc: string, detail: FeatureDetail | undefined): string {
  const points = detail?.points?.length
    ? `<ul class="welcome-detail-points">${detail.points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
    : '';
  const blurb = detail?.blurb ? `<p class="welcome-detail-blurb">${escapeHtml(detail.blurb)}</p>` : '';
  return `
    <div class="welcome-detail-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <button type="button" class="welcome-detail-close" aria-label="${S.common.close}">
        <span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span>
      </button>
      <div class="welcome-detail-hero">
        <div class="welcome-detail-hero-icon">${iconWrapHTML}</div>
        <div class="welcome-detail-hero-text">
          <h3 class="welcome-detail-title">${escapeHtml(title)}</h3>
          <p class="welcome-detail-sub">${escapeHtml(desc)}</p>
        </div>
      </div>
      <div class="welcome-detail-body">
        ${blurb}
        ${points}
      </div>
    </div>`;
}

function openFeatureModal(tile: HTMLElement): void {
  const titleEl = tile.querySelector('.feature-title');
  const title = (titleEl?.textContent || '').trim();
  const desc = (tile.querySelector('.feature-desc')?.textContent || '').trim();
  const iconWrap = tile.querySelector('.feature-icon-wrapper');
  const iconWrapHTML = iconWrap ? iconWrap.outerHTML : '';
  // Resolve LIVE from the active-locale catalog via the title's stable data-i18n key.
  const featureKey = FEATURE_KEY_BY_TITLE_I18N[titleEl?.getAttribute('data-i18n') || ''];
  const detail = featureKey ? S.modals.features[featureKey] : undefined;

  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.innerHTML = buildModalMarkup(iconWrapHTML, title, desc, detail);
  document.body.appendChild(overlay);

  const surface = overlay.querySelector('.welcome-detail-modal') as HTMLElement | null;

  let closing = false;
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
  };

  const requestClose = () => {
    if (closing || removed) return;
    closing = true;
    overlay.classList.remove('is-open');
    if (!surface || reducedMotion() || typeof surface.animate !== 'function') {
      remove();
      return;
    }
    // Shrink + flip back onto the (possibly re-measured) tile, then remove.
    const finalRect = surface.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    const cfg = flipConfigFor(tile, tileRect);
    surface.style.transformOrigin = 'center center';
    const anim = surface.animate(
      [
        { transform: openFlipTransform(cfg), opacity: 1, offset: 0 },
        { opacity: 0, offset: 0.75 },
        { transform: closedFlipTransform(tileRect, finalRect, cfg), opacity: 0, offset: 1 }
      ],
      { duration: CLOSE_MS, easing: CLOSE_EASE, fill: 'forwards' }
    );
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      remove();
    };
    anim.onfinish = finish;
    anim.oncancel = finish;
    window.setTimeout(finish, CLOSE_MS + 120);
  };

  overlay.querySelector('.welcome-detail-close')?.addEventListener('click', requestClose);
  attachBackdropClickToClose(overlay, requestClose);
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') requestClose();
  };
  document.addEventListener('keydown', onKeydown);

  // Play the open animation: start mapped onto the tile (flipped edge-on), then
  // unflip + grow to the final layout. `fill: 'none'` lets the surface rest at
  // its base styles (no transform = identity, opacity 1) once done — which is
  // exactly the last keyframe, so there's no end-of-animation snap.
  if (!surface || reducedMotion() || typeof surface.animate !== 'function') {
    overlay.classList.add('is-open');
    return;
  }

  const finalRect = surface.getBoundingClientRect();
  const tileRect = tile.getBoundingClientRect();
  const cfg = flipConfigFor(tile, tileRect);
  surface.style.transformOrigin = 'center center';
  overlay.classList.add('is-open');
  surface.animate(
    [
      { transform: closedFlipTransform(tileRect, finalRect, cfg), opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.4 },
      { transform: openFlipTransform(cfg), opacity: 1, offset: 1 }
    ],
    { duration: OPEN_MS, easing: OPEN_EASE, fill: 'none' }
  );
}

/** Make the welcome-screen feature tiles clickable (mouse + keyboard). */
export function setupWelcomeFeatureModals(): void {
  const tiles = document.querySelectorAll<HTMLElement>('.welcome-features .welcome-feature');
  tiles.forEach((tile) => {
    if (tile.dataset.detailWired === '1') return;
    tile.dataset.detailWired = '1';
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.classList.add('welcome-feature-clickable');

    tile.addEventListener('click', () => openFeatureModal(tile));
    tile.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFeatureModal(tile);
      }
    });
  });
}

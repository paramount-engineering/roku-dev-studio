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

interface FeatureDetail {
  blurb: string;
  points: string[];
}

/**
 * Extended copy keyed by the tile's title text. The modal header still uses the
 * tile's live title + short description from the DOM (so edits there flow
 * through); this only supplies the longer explanation + capability bullets.
 */
const FEATURE_DETAILS: Record<string, FeatureDetail> = {
  'Device Discovery': {
    blurb:
      'Roku Dev Studio continuously scans your local network with SSDP so every Roku on the same subnet shows up automatically — no IP typing required.',
    points: [
      'Auto-detects Roku models, names, and IP addresses',
      'Flags which devices have Developer Mode enabled',
      'Refreshes as devices join or leave the network',
      'One click to connect and start working'
    ]
  },
  'Apps & Deep Linking': {
    blurb:
      'Browse every channel installed on the connected Roku, launch any of them instantly, and test deep links with custom content and media-type parameters.',
    points: [
      'Grid of installed apps (plus TV inputs on Roku TVs)',
      'Launch from the grid or by app ID',
      'Deep-link with contentId / mediaType for content-launch testing',
      'Copy a raw ID + version list of everything installed'
    ]
  },
  'Dev App': {
    blurb:
      'Sideload, control, and inspect your development channel end-to-end — from a zip upload to live screenshots of what is on screen.',
    points: [
      'Sideload a .zip dev channel with your developer password',
      'Launch or delete the sideloaded app',
      'Capture screenshots on demand or auto-capture',
      'Copy, download, or clear captured images'
    ]
  },
  'App Connector': {
    blurb:
      'Call BrightScript functions on your sideloaded channel remotely and see their return values — exercise code paths without touching the remote.',
    points: [
      'Invoke exported functions by name with arguments',
      'Inspect the returned values inline',
      'Runs against the live dev channel'
    ]
  },
  Fiddle: {
    blurb:
      'A scratchpad for BrightScript: write snippets in a full Monaco editor and run them on a connected device with live linting.',
    points: [
      'Monaco editor with syntax highlighting',
      'Live lint feedback as you type',
      'One-click run on the connected Roku',
      'Opens in its own dedicated window'
    ]
  },
  'MCP Server': {
    blurb:
      'Expose Roku Dev Studio to AI agents over the Model Context Protocol, so assistants can drive your device inside your dev loop.',
    points: [
      'Launch apps, press keys, and capture screenshots via MCP tools',
      'Query device state programmatically',
      'Bring AI agents into your test and debug workflow'
    ]
  },
  'Device Remote': {
    blurb:
      'A full on-screen Roku remote — every button of the physical remote, plus keyboard control and text entry.',
    points: [
      'D-pad, OK, Back, Home, Options, and Replay',
      'Media transport: play/pause, rewind, fast-forward',
      'Volume, mute, and power',
      'Type text straight into on-device fields'
    ]
  },
  Query: {
    blurb:
      'Read live state from the Roku over ECP (External Control Protocol) — device info, media-player status, installed apps, and the registry.',
    points: [
      'Device info: model, version, and network',
      'Active app and media-player playback state',
      'Installed apps list',
      'Registry contents'
    ]
  },
  Console: {
    blurb:
      "Stream the Roku's BrightScript debug output live over Telnet, with filtering and search to surface exactly what matters.",
    points: [
      'Live Telnet log stream',
      'Filter and full-text search',
      'Click URLs or JSON to inspect them in a modal',
      'Save the log to a file'
    ]
  },
  'Action Scripts': {
    blurb:
      'Automate repeatable device flows by chaining key presses, app launches, and RALE calls into a single runnable script.',
    points: [
      'Sequence keypresses, launches, and waits',
      'Include RALE calls in the flow',
      'Re-run flows for regression testing'
    ]
  },
  'Network Inspector': {
    blurb:
      "Capture and inspect the Dev App's HTTP/HTTPS traffic through a built-in MITM proxy — like a browser's network tab for your channel.",
    points: [
      'See every request and response the channel makes',
      'Inspect headers, bodies, and timing',
      'Decrypt HTTPS via the MITM proxy',
      'Group by host or view proxied sessions'
    ]
  },
  'Remote Locations': {
    blurb:
      "Connect to Roku devices that aren't on your local network by routing through relay servers.",
    points: [
      'Reach devices anywhere via a relay server',
      'Manage multiple remote locations',
      'Same tooling as local devices'
    ]
  }
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
      <button type="button" class="welcome-detail-close" aria-label="Close">
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
  const title = (tile.querySelector('.feature-title')?.textContent || '').trim();
  const desc = (tile.querySelector('.feature-desc')?.textContent || '').trim();
  const iconWrap = tile.querySelector('.feature-icon-wrapper');
  const iconWrapHTML = iconWrap ? iconWrap.outerHTML : '';
  const detail = FEATURE_DETAILS[title];

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

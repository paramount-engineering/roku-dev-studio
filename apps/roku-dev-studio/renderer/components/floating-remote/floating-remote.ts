/**
 * Body-level Floating Remote singleton.
 *
 * Shows a draggable copy of the Dev App `.quick-remote-card` whenever the
 * `floating-remote.enabled` setting is on AND the active device panel's
 * inner tab is something other than `remote` or `devapp` (those already
 * have a full remote on-screen, so showing a floater there would just
 * duplicate UI).
 *
 * The floater is shared across all device panels — there's only ever one
 * active device tab (`.tab-panel.active`), so a single body-level shell is
 * enough. On every visibility/active-device change we re-clone the card
 * from the active panel and re-attach `attachQuickRemoteKeys` against that
 * panel's `getPanelApi` adapter, so local vs relay routing matches the
 * Remote / Dev App paths exactly.
 */

import { attachQuickRemoteKeys } from '../dev-app/quick-remote.js';
import {
  FLOATING_REMOTE_ENABLED,
  FLOATING_REMOTE_POSITION,
  setFloatingRemoteEnabled,
  setFloatingRemotePosition,
  type FloatingRemotePosition
} from '../../modules/utils/app-user-settings.js';
import { onAppSettingsChanged } from '../../modules/utils/app-settings-change-bus.js';
import { getPanelApi } from '../../modules/device-api/panel-api-registry.js';
import { rendererError } from '../../modules/utils/logger.js';
import { icon, escapeHtml, setSafeHTML } from '../../modules/utils/index.js';
import type { DevAppApi } from '../dev-app/dev-app-types.js';
import { S } from '@shared/strings/index.js';

const ROOT_ID = 'floating-remote-root';
const VISIBLE_CLASS = 'floating-remote-shell--visible';
const DRAG_HANDLE_SELECTOR = '.floating-remote-shell-handle';

let mounted = false;
let shellEl: HTMLElement | null = null;
let cardSlotEl: HTMLElement | null = null;
let footerEl: HTMLElement | null = null;
let boundPanel: HTMLElement | null = null;
/** Panel whose dev-app events the footer is currently subscribed to. */
let footerListenerPanel: HTMLElement | null = null;
let footerRefreshHandler: (() => void) | null = null;
let dragState: { startX: number; startY: number; originX: number; originY: number } | null = null;
let positionRafId: number | null = null;
/**
 * Whether the floater has an explicit `left`/`top` set by JS (either from a
 * persisted user drag, or a drag in the current session). Until this is
 * `true` the shell uses the CSS-anchored bottom-right defaults
 * (`right: 24px; bottom: 24px`) so the first render needs no measurement and
 * window resize is handled naturally by the browser.
 */
let hasExplicitPosition = false;
/** Persisted position is applied once on first show so we measure real layout. */
let persistedPositionApplied = false;

/**
 * Mount the singleton shell, restore persisted position, wire drag, and
 * subscribe to the app-settings bus. Safe to call more than once.
 *
 * The caller (`app.ts`) is responsible for telling us when the active panel
 * or its inner tab changes via `refreshFloatingRemote()`.
 */
export function mountFloatingRemote(): void {
  if (mounted) return;
  mounted = true;

  const root = document.getElementById(ROOT_ID);
  if (!root) {
    rendererError('[FloatingRemote] root element not found');
    return;
  }

  root.innerHTML = `
    <div class="floating-remote-shell" role="dialog" aria-label="${S.floatingRemote.dialogAriaLabel}">
      <div class="floating-remote-shell-handle" aria-hidden="false">
        <span class="floating-remote-shell-title">
          <span class="icon icon-sm" aria-hidden="true"><svg><use href="#icon-gamepad"/></svg></span>
          ${S.floatingRemote.shellTitle}
        </span>
        <button type="button" class="floating-remote-shell-close" title="${S.floatingRemote.hide}" aria-label="${S.floatingRemote.hide}">
          <span class="icon icon-xs" aria-hidden="true"><svg><use href="#icon-x"/></svg></span>
        </button>
      </div>
      <div class="floating-remote-shell-body" data-floating-remote-slot></div>
      <div class="floating-remote-footer" data-floating-remote-footer></div>
    </div>
  `;

  shellEl = root.querySelector('.floating-remote-shell');
  cardSlotEl = root.querySelector<HTMLElement>('[data-floating-remote-slot]');
  footerEl = root.querySelector<HTMLElement>('[data-floating-remote-footer]');
  if (!shellEl || !cardSlotEl || !footerEl) {
    rendererError('[FloatingRemote] shell, slot, or footer element missing after mount');
    return;
  }

  wireDrag(shellEl);
  wireCloseButton(shellEl);
  wireToggleButtons();

  // Re-clamp the floater into view when the window shrinks.
  window.addEventListener('resize', () => {
    schedulePositionApply();
  });

  // Other windows may flip the setting; reflect it here without polling.
  onAppSettingsChanged(() => {
    refreshFloatingRemote();
  });

  refreshFloatingRemote();
}

/**
 * Re-evaluate visibility and rebind to the active device panel. Call from
 * `activateTab` and from each `.tab-panel`'s `innertabswitch` listener.
 */
export function refreshFloatingRemote(): void {
  if (!mounted || !shellEl || !cardSlotEl) return;

  // Keep every floating-remote toggle button (one per cloned device panel
  // header) visually in sync with the global setting on every refresh, so a
  // newly-created device panel picks up the current state for free.
  syncToggleButtonsState();

  if (!FLOATING_REMOTE_ENABLED) {
    hide();
    return;
  }

  const activePanel = findActivePanel();
  if (!activePanel) {
    hide();
    return;
  }

  if (isRemoteOrDevAppActive(activePanel)) {
    hide();
    return;
  }

  const api = getPanelApi(activePanel) as DevAppApi | null;
  if (!api) {
    hide();
    return;
  }

  rebindCard(activePanel, api);
  show();
}

function rebindCard(panel: HTMLElement, api: DevAppApi): void {
  if (!cardSlotEl || !shellEl) return;

  // Re-clone whenever the bound panel changes, or when our slot is empty.
  const needsReclone = boundPanel !== panel || cardSlotEl.childElementCount === 0;
  if (needsReclone) {
    const sourceCard = panel.querySelector('.quick-remote-card');
    if (!(sourceCard instanceof HTMLElement)) {
      hide();
      return;
    }

    const clone = sourceCard.cloneNode(true) as HTMLElement;
    stripFloaterIrrelevantChrome(clone);

    cardSlotEl.replaceChildren(clone);
    boundPanel = panel;
  }

  // Always (re)attach keypress handlers against the *current* api adapter so
  // the floater follows local-vs-relay routing for the active device.
  attachQuickRemoteKeys(cardSlotEl, api, undefined, {
    dispatchHomePressedOn: panel,
    devicePanel: panel
  });

  // Reflect the active device's ECP mode so the existing
  // `.device-panel[data-ecp-mode="Disabled"] .quick-remote-card` CSS rule
  // (and our floater-shell variant) can dim and disable interaction in lockstep.
  const ecpMode = panel.dataset.ecpMode;
  if (ecpMode) {
    shellEl.dataset.ecpMode = ecpMode;
  } else {
    delete shellEl.dataset.ecpMode;
  }

  bindDevAppFooter(panel);
}

/**
 * Compact Dev App footer. Mirrors the active panel's Dev App state and delegates
 * every action to that panel's real controls, so the password/confirm/launch/
 * screenshot logic is reused verbatim:
 *   - no dev app  → a "Sideload Dev App" button (jumps to the Dev App tab)
 *   - installed   → small icon + title + Delete
 *   - not launched → also a Launch button (hidden once it's foreground)
 * Re-renders on the panel's `dev-app-sideload-state` (install/uninstall) and
 * `dev-app-active-polled` (foreground) events.
 */
function bindDevAppFooter(panel: HTMLElement): void {
  if (!footerEl) return;

  // Re-subscribe only when the bound panel changes.
  if (footerListenerPanel !== panel) {
    if (footerListenerPanel && footerRefreshHandler) {
      footerListenerPanel.removeEventListener('dev-app-sideload-state', footerRefreshHandler);
      footerListenerPanel.removeEventListener('dev-app-active-polled', footerRefreshHandler);
    }
    footerRefreshHandler = () => renderDevAppFooter(panel);
    panel.addEventListener('dev-app-sideload-state', footerRefreshHandler);
    panel.addEventListener('dev-app-active-polled', footerRefreshHandler);
    footerListenerPanel = panel;
  }

  renderDevAppFooter(panel);
}

function renderDevAppFooter(panel: HTMLElement): void {
  if (!footerEl) return;

  const details = panel.querySelector('.sideloaded-app-details');
  const nameEl = panel.querySelector('.sideloaded-app-name');
  const installed =
    !!nameEl && !(details instanceof HTMLElement && details.querySelector('.sideloaded-none'));
  const launchBtn = panel.querySelector('.launch-sideload-btn');
  const deleteBtn = panel.querySelector('.delete-sideload-btn');
  // Panel keeps Launch visible only while installed AND not foreground.
  const canLaunch = launchBtn instanceof HTMLElement && launchBtn.style.display !== 'none';

  if (!installed) {
    setSafeHTML(
      footerEl,
      `<button type="button" class="floating-remote-footer-btn floating-remote-footer-sideload" data-fr-sideload title="${S.floatingRemote.sideloadTitle}">
        <span class="icon icon-xs" aria-hidden="true"><svg><use href="#icon-rocket"/></svg></span>
        ${S.floatingRemote.sideloadDevApp}
      </button>`
    );
    footerEl.querySelector('[data-fr-sideload]')?.addEventListener('click', () => {
      // Jump to the Dev App tab, where the full select-package + install UI lives.
      const devappTab = panel.querySelector('.inner-tab[data-inner-tab="devapp"]');
      if (devappTab instanceof HTMLElement) devappTab.click();
    });
    return;
  }

  const name = nameEl?.textContent?.trim() || S.floatingRemote.devAppFallbackName;
  const meta = panel.querySelector('.sideloaded-app-meta')?.textContent?.trim() || '';
  // Icon + title are one hover group; the tooltip carries the full (untruncated)
  // name plus the version line so the whole unit is self-describing.
  const appTooltip = meta ? `${name}\n${meta}` : name;
  const iconImg = panel.querySelector('.sideloaded-app-icon');
  const iconSrc =
    iconImg instanceof HTMLImageElement && iconImg.style.display !== 'none' && iconImg.src
      ? iconImg.src
      : '';

  setSafeHTML(
    footerEl,
    `<div class="floating-remote-footer-app" title="${escapeHtml(appTooltip)}">
      <span class="floating-remote-footer-icon" aria-hidden="true">${iconSrc ? '<img alt="">' : icon('package', 'icon-xs', 'icon-muted')}</span>
      <span class="floating-remote-footer-name">${escapeHtml(name)}</span>
    </div>
    <div class="floating-remote-footer-actions">
      ${canLaunch ? `<button type="button" class="floating-remote-footer-btn floating-remote-footer-launch" data-fr-launch title="${S.floatingRemote.launchDevApp}" aria-label="${S.floatingRemote.launchDevApp}"><span class="icon icon-xs" aria-hidden="true"><svg><use href="#icon-rocket"/></svg></span></button>` : ''}
      <button type="button" class="floating-remote-footer-btn floating-remote-footer-delete" data-fr-delete title="${S.floatingRemote.deleteDevApp}" aria-label="${S.floatingRemote.deleteDevApp}"><span class="icon icon-xs" aria-hidden="true"><svg><use href="#icon-trash"/></svg></span></button>
    </div>`
  );

  // Set the icon src via JS (avoid injecting a data-URL into the HTML string).
  if (iconSrc) {
    const img = footerEl.querySelector('.floating-remote-footer-icon img');
    if (img instanceof HTMLImageElement) img.src = iconSrc;
  }
  footerEl.querySelector('[data-fr-launch]')?.addEventListener('click', () => {
    if (launchBtn instanceof HTMLElement) launchBtn.click();
  });
  footerEl.querySelector('[data-fr-delete]')?.addEventListener('click', () => {
    if (deleteBtn instanceof HTMLElement) deleteBtn.click();
  });
}

/**
 * Trim the cloned Dev App Quick Remote so it makes sense as a floating
 * widget. We drop the card header (it has its own help button + label,
 * which we already render in the shell's drag handle), and the auto-screenshot
 * row (no screenshot surface is visible in non-Remote/non-Dev-App tabs).
 */
function stripFloaterIrrelevantChrome(clone: HTMLElement): void {
  clone.querySelector('.card-header')?.remove();
  clone.querySelector('.devapp-auto-screenshot')?.remove();
}

function findActivePanel(): HTMLElement | null {
  const el = document.querySelector('.tab-panel.active');
  return el instanceof HTMLElement ? el : null;
}

function isRemoteOrDevAppActive(panel: HTMLElement): boolean {
  const devapp = panel.querySelector('.inner-tab-content[data-inner-content="devapp"]');
  if (devapp instanceof HTMLElement && devapp.classList.contains('active')) return true;
  const remote = panel.querySelector('.inner-tab-content[data-inner-content="remote"]');
  return remote instanceof HTMLElement && remote.classList.contains('active');
}

/** True while the floating remote is shown — used to broaden the keyboard-remote gate. */
export function isFloatingRemoteVisible(): boolean {
  return shellEl?.classList.contains(VISIBLE_CLASS) === true;
}

function show(): void {
  if (!shellEl) return;
  shellEl.classList.add(VISIBLE_CLASS);
  // Apply any persisted position the first time the floater becomes visible.
  // Doing it here (rather than at mount) means `display: flex` has taken
  // effect and `getBoundingClientRect()` reports real dimensions, so
  // `clampToViewport` works correctly even when the window has shrunk since
  // the position was last saved. If there's no persisted position we leave
  // the CSS-anchored bottom-right default in place — no measurement, no flash.
  if (!persistedPositionApplied) {
    persistedPositionApplied = true;
    if (FLOATING_REMOTE_POSITION) {
      // Force a synchronous layout pass before measuring.
      void shellEl.offsetWidth;
      setShellPosition(clampToViewport(FLOATING_REMOTE_POSITION, shellEl), /*persist*/ false);
    }
  }
}

function hide(): void {
  shellEl?.classList.remove(VISIBLE_CLASS);
}

// ---------- Drag ----------

function wireDrag(shell: HTMLElement): void {
  const handle = shell.querySelector<HTMLElement>(DRAG_HANDLE_SELECTOR);
  if (!handle) return;

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0) return;
    // Don't start drag when clicking the close button inside the handle.
    if (e.target instanceof HTMLElement && e.target.closest('.floating-remote-shell-close')) {
      return;
    }
    e.preventDefault();
    const rect = shell.getBoundingClientRect();
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top
    };
    document.body.classList.add('floating-remote-dragging');
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!dragState) return;
    e.preventDefault();
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    setShellPosition({ x: dragState.originX + dx, y: dragState.originY + dy }, /*persist*/ false);
  });

  window.addEventListener('mouseup', () => {
    if (!dragState) return;
    dragState = null;
    document.body.classList.remove('floating-remote-dragging');
    const rect = shell.getBoundingClientRect();
    const clamped = clampToViewport({ x: rect.left, y: rect.top }, shell);
    setShellPosition(clamped, /*persist*/ true);
  });
}

function wireCloseButton(shell: HTMLElement): void {
  const closeBtn = shell.querySelector<HTMLElement>('.floating-remote-shell-close');
  if (!closeBtn) return;
  closeBtn.addEventListener('click', (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    void setFloatingRemoteEnabled(false);
    syncToggleButtonsState();
    hide();
  });
}

function wireToggleButtons(): void {
  // One toggle per device-panel header — they all flip the same global setting.
  document.addEventListener('click', (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest('.floating-remote-toggle-btn');
    if (!(btn instanceof HTMLElement)) return;
    e.preventDefault();
    e.stopPropagation();
    const next = !FLOATING_REMOTE_ENABLED;
    void setFloatingRemoteEnabled(next);
    syncToggleButtonsState();
    refreshFloatingRemote();
  });

  syncToggleButtonsState();
}

/** Update all toggle buttons' aria-pressed + active class to match the global setting. */
export function syncToggleButtonsState(): void {
  const buttons = document.querySelectorAll<HTMLElement>('.floating-remote-toggle-btn');
  buttons.forEach((btn) => {
    btn.setAttribute('aria-pressed', FLOATING_REMOTE_ENABLED ? 'true' : 'false');
    btn.classList.toggle('floating-remote-toggle-btn--on', FLOATING_REMOTE_ENABLED);
  });
}

// ---------- Position ----------

function schedulePositionApply(): void {
  // If the user hasn't dragged yet, the floater is still anchored via CSS
  // `right`/`bottom` so the browser keeps it on-screen for free — no work
  // for us to do on resize.
  if (!hasExplicitPosition) return;
  if (positionRafId != null) return;
  positionRafId = window.requestAnimationFrame(() => {
    positionRafId = null;
    if (!shellEl) return;
    const rect = shellEl.getBoundingClientRect();
    const clamped = clampToViewport({ x: rect.left, y: rect.top }, shellEl);
    setShellPosition(clamped, /*persist*/ false);
  });
}

function setShellPosition(pos: FloatingRemotePosition, persist: boolean): void {
  if (!shellEl) return;
  shellEl.style.left = `${pos.x}px`;
  shellEl.style.top = `${pos.y}px`;
  // Clear the CSS-anchored defaults so inline left/top fully take over.
  shellEl.style.right = 'auto';
  shellEl.style.bottom = 'auto';
  hasExplicitPosition = true;
  if (persist) {
    void setFloatingRemotePosition(pos);
  }
}

function clampToViewport(pos: FloatingRemotePosition, shell: HTMLElement): FloatingRemotePosition {
  const margin = 8;
  const rect = shell.getBoundingClientRect();
  // If the shell isn't laid out yet (display:none), getBoundingClientRect can
  // return zero size — fall back to sensible widths so the math still works.
  const w = rect.width || 220;
  const h = rect.height || 320;
  const maxX = Math.max(margin, window.innerWidth - w - margin);
  const maxY = Math.max(margin, window.innerHeight - h - margin);
  return {
    x: Math.min(Math.max(pos.x, margin), maxX),
    y: Math.min(Math.max(pos.y, margin), maxY)
  };
}

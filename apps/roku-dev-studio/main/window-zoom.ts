/**
 * Window zoom helpers — shared across the main window, the Log Viewer window,
 * and the Fiddle window.
 *
 * Why these live in one place:
 *
 * 1. **Clamp** every zoom path (View > Zoom menu, ⌘=/⌘-/⌘0 accelerators,
 *    Ctrl+wheel, the in-renderer `-`/`+` title-bar buttons) to a sensible
 *    band so the frameless main window's CSS title bar can't shrink below
 *    the macOS-drawn traffic-light height (or grow uncomfortably large on
 *    the child windows).
 * 2. **Disable pinch-zoom** so a touchpad gesture can't bypass the clamp.
 * 3. **Broadcast** the resulting factor to the same window's renderer via
 *    `IPC.AppZoomChanged`. The main renderer subscribes and inverse-scales
 *    the title bar to stay at a constant screen-pixel size; child windows
 *    currently ignore the event but routing it to the actual zoomed window
 *    keeps the contract clean and lets future child renderers opt in.
 *
 * Before this module existed, the menu click handlers in `main.ts` closed
 * over the captured main `BrowserWindow`, so View > Zoom always zoomed the
 * main window regardless of which window was focused (Log Viewer / Fiddle /
 * Settings). Centralizing the helpers here lets every window register the
 * same guards without re-implementing the band.
 */

import type { BrowserWindow as ElectronBrowserWindow } from 'electron';
import { IPC } from '../shared/ipc/channels';

export const ZOOM_MIN_FACTOR = 0.5;
export const ZOOM_MAX_FACTOR = 2.0;
export const ZOOM_STEP_FACTOR = 0.1;
export const ZOOM_DEFAULT_FACTOR = 1.0;
const ZOOM_EPSILON = 0.001;

export function clampZoomFactor(factor: number): number {
  if (!Number.isFinite(factor)) return ZOOM_DEFAULT_FACTOR;
  return Math.max(ZOOM_MIN_FACTOR, Math.min(ZOOM_MAX_FACTOR, factor));
}

export function applyZoomFactor(win: ElectronBrowserWindow | undefined, factor: number): void {
  if (!win || !win.webContents || win.webContents.isDestroyed()) return;
  const target = clampZoomFactor(factor);
  if (Math.abs(win.webContents.getZoomFactor() - target) > ZOOM_EPSILON) {
    win.webContents.setZoomFactor(target);
  }
  // Send to the SAME window we just zoomed — the main renderer needs this
  // for title-bar inverse-scaling; child renderers ignore it harmlessly.
  try {
    win.webContents.send(IPC.AppZoomChanged, { factor: target });
  } catch {
    /* window destroyed mid-send */
  }
}

export function zoomIn(win: ElectronBrowserWindow | undefined): void {
  if (!win) return;
  applyZoomFactor(win, win.webContents.getZoomFactor() + ZOOM_STEP_FACTOR);
}

export function zoomOut(win: ElectronBrowserWindow | undefined): void {
  if (!win) return;
  applyZoomFactor(win, win.webContents.getZoomFactor() - ZOOM_STEP_FACTOR);
}

export function resetZoom(win: ElectronBrowserWindow | undefined): void {
  applyZoomFactor(win, ZOOM_DEFAULT_FACTOR);
}

/**
 * Wire up the standard zoom guards on a window:
 *
 * - Disable pinch-zoom (the only zoom paths left are menu/accelerator and
 *   Ctrl+wheel, both of which we clamp).
 * - Re-clamp Ctrl+wheel zoom: Electron applies the new factor itself before
 *   firing `zoom-changed`, so we run `applyZoomFactor` on top of its value
 *   to bring it back into band (idempotent if already in-range) and to
 *   broadcast `AppZoomChanged` to the renderer.
 * - On first load, broadcast the starting (clamped) factor so the renderer
 *   can sync `--app-zoom` before first paint.
 *
 * Call once per window, right after `new BrowserWindow(...)`.
 */
export function setupZoomGuards(win: ElectronBrowserWindow): void {
  if (!win || win.isDestroyed()) return;

  win.webContents.setVisualZoomLevelLimits(1, 1).catch((err: Error) => {
    console.warn('[Zoom] setVisualZoomLevelLimits failed:', err.message);
  });

  win.webContents.on('zoom-changed', (_event: Electron.Event, _direction: 'in' | 'out') => {
    applyZoomFactor(win, win.webContents.getZoomFactor());
  });

  win.webContents.on('did-finish-load', () => {
    if (win.isDestroyed()) return;
    try {
      win.webContents.send(IPC.AppZoomChanged, {
        factor: clampZoomFactor(win.webContents.getZoomFactor())
      });
    } catch {
      /* window destroyed mid-send */
    }
  });
}

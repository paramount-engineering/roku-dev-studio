/**
 * Bridges global keyboard-remote keypresses to the same debounced auto-screenshot
 * schedulers used by on-screen remote buttons (Remote Section vs Dev App tab).
 */

import { SCREENSHOT_DEBOUNCE_DELAY } from './constants.js';

type ScheduleAutoScreenshotFn = (delayMs?: number) => void;

type Schedulers = {
  remote?: ScheduleAutoScreenshotFn;
  devApp?: ScheduleAutoScreenshotFn;
};

const byPanel = new WeakMap<HTMLElement, Schedulers>();

export function registerKeyboardRemoteAutoScreenshotRemote(
  panel: HTMLElement,
  schedule: ScheduleAutoScreenshotFn
): void {
  const s = byPanel.get(panel) ?? {};
  s.remote = schedule;
  byPanel.set(panel, s);
}

export function registerKeyboardRemoteAutoScreenshotDevApp(
  panel: HTMLElement,
  schedule: ScheduleAutoScreenshotFn
): void {
  const s = byPanel.get(panel) ?? {};
  s.devApp = schedule;
  byPanel.set(panel, s);
}

/**
 * Schedule a debounced screenshot after Send Text completes. Honors the shared
 * `.auto-screenshot-checkbox` and routes to the Remote or Dev App scheduler
 * for the active inner tab (Dev App scheduler when the floater is open on
 * other tabs — the screenshot surface lives there).
 */
export function scheduleAutoScreenshotAfterSendText(
  panel: HTMLElement,
  delayMs: number = SCREENSHOT_DEBOUNCE_DELAY
): void {
  const checkbox = panel.querySelector('.auto-screenshot-checkbox');
  if (!(checkbox instanceof HTMLInputElement) || !checkbox.checked) return;

  const schedulers = byPanel.get(panel);
  if (!schedulers) return;

  const activeDevApp = panel.querySelector('.inner-tab-content[data-inner-content="devapp"].active');
  const activeRemote = panel.querySelector('.inner-tab-content[data-inner-content="remote"].active');

  if (activeDevApp && schedulers.devApp) {
    schedulers.devApp(delayMs);
    return;
  }
  if (activeRemote && schedulers.remote) {
    schedulers.remote(delayMs);
    return;
  }
  if (schedulers.devApp) schedulers.devApp(delayMs);
  else schedulers.remote?.(delayMs);
}

/** Call after a successful keyboard-remote keypress when the panel is in remote or devapp context. */
export function scheduleKeyboardRemoteAutoScreenshotForActiveInnerTab(panel: HTMLElement): void {
  const devapp = panel.querySelector('.inner-tab-content[data-inner-content="devapp"]');
  const schedulers = byPanel.get(panel);
  if (!schedulers) return;
  if (devapp instanceof HTMLElement && devapp.classList.contains('active')) {
    schedulers.devApp?.();
    return;
  }
  schedulers.remote?.();
}

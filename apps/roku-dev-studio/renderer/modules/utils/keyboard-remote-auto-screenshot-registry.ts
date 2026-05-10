/**
 * Bridges global keyboard-remote keypresses to the same debounced auto-screenshot
 * schedulers used by on-screen remote buttons (Remote tab vs Dev App tab).
 */

type Schedulers = {
  remote?: () => void;
  devApp?: () => void;
};

const byPanel = new WeakMap<HTMLElement, Schedulers>();

export function registerKeyboardRemoteAutoScreenshotRemote(
  panel: HTMLElement,
  schedule: () => void
): void {
  const s = byPanel.get(panel) ?? {};
  s.remote = schedule;
  byPanel.set(panel, s);
}

export function registerKeyboardRemoteAutoScreenshotDevApp(
  panel: HTMLElement,
  schedule: () => void
): void {
  const s = byPanel.get(panel) ?? {};
  s.devApp = schedule;
  byPanel.set(panel, s);
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

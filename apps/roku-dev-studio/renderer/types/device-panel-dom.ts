/**
 * DOM contracts for the device panel (cloned from `index.html` → `#device-panel-template`).
 * Phase 3.5 — keeps `data-*` / panel-root shapes explicit for setup functions.
 */

/** `data-inner-tab` on `.inner-tab` and matching `data-inner-content` on `.inner-tab-content`. */
export type DeviceInnerTabId =
  | 'remote'
  | 'apps'
  | 'query'
  | 'devapp'
  | 'telnet'
  | 'inspector'
  | 'actionscripts';

/**
 * Root element for a connected device tab: `.tab-panel` built in `createDevicePanel` (`app.ts`).
 * Passed into `setupRemoteControls`, `setupQueries`, `setupDevApp`, `setupInspector`, etc.
 */
export type DevicePanelRoot = HTMLElement;

/**
 * Per-panel device API registry.
 *
 * Each `.tab-panel` is set up by `createDevicePanel` in `app.ts` with its own
 * `createApiAdapter(...)` result — the object that knows whether to call
 * `window.roku.keypress(ip, ...)` (local) or
 * `window.roku.remoteKeypress(serverUrl, ip, ...)` (remote via relay).
 *
 * Component setup functions receive that adapter directly. Cross-cutting code
 * (e.g. the global keyboard-remote shortcut in `app.ts`) only has access to
 * the active panel DOM and must not assume the device is local. This registry
 * gives such code a typed handle to the panel's adapter without needing to
 * re-read `panel.dataset.isRemote`/`serverUrl` and rebuild one itself.
 *
 * Keyed by the panel node via a `WeakMap` so removed panels become GC-eligible
 * without explicit teardown.
 */

/**
 * The subset of the device API used by the registry. Matches the shape of the
 * object returned by `createApiAdapter` in `app.ts`; kept as `Record<...>` +
 * well-known keys so adding new methods there doesn't require changes here.
 */
export interface PanelDeviceApi extends Record<string, unknown> {
  isRemote: boolean;
  ip: string;
  serverUrl?: string | null;
  keypress: (key: string) => Promise<unknown>;
}

const registry = new WeakMap<HTMLElement, PanelDeviceApi>();

/**
 * Associate a device API adapter with a device panel. Called exactly once by
 * `createDevicePanel` right after the adapter is built.
 */
export function registerPanelApi(panel: HTMLElement, api: PanelDeviceApi): void {
  registry.set(panel, api);
}

/**
 * Look up the device API adapter for a panel. Returns `null` when the panel
 * has no adapter yet (e.g. a non-device panel, or the Home view). Callers
 * should handle the null case rather than fall back to `window.roku.*` with
 * raw `panel.dataset.ip`, which skips the local-vs-remote branch.
 */
export function getPanelApi(panel: HTMLElement | null | undefined): PanelDeviceApi | null {
  if (!panel) return null;
  return registry.get(panel) ?? null;
}

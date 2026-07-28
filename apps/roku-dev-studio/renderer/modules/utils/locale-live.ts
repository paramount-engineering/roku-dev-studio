/**
 * Live-locale wiring for a secondary window (About, Fiddle, Log Viewer, Network Session
 * Viewer). Each of these renderers has its own copy of the shared string catalog, so it
 * must (1) apply the current preference when it opens — otherwise a window launched while a
 * non-default locale is active would render in English — and (2) retranslate in place when
 * the preference changes, without a reload.
 *
 * The window's preload bridge supplies `getLocale()` (invoke IPC.GetLocale) and
 * `onLocaleChanged(cb)` (subscribe to IPC.LocaleChanged). `extra` runs after each apply so
 * a window can re-render its own imperative surfaces; static `data-i18n` HTML is handled by
 * the `applyI18n(document)` pass here.
 */
import { applyI18n } from '@shared/strings/index.js';
import { setLocaleFromPreference } from './locale-pref.js';
import { runRetranslate } from '../ui/retranslate-registry.js';

type LocaleBridge = {
  getLocale?: () => Promise<unknown> | unknown;
  onLocaleChanged?: (cb: (pref: string) => void) => unknown;
};

/**
 * Apply a language preference to THIS window — the single source of the live-switch sequence, shared
 * by every window's locale handler (the main window and each secondary window). Repoints the catalog
 * via {@link setLocaleFromPreference}, retranslates the static `[data-i18n*]` shell via
 * {@link applyI18n}, runs `extra` for any window-specific imperative re-render (e.g. the main
 * window's sidebar), then sweeps the retranslate registries ({@link runRetranslate} — window-lifetime
 * surfaces + device panels). `extra` runs BEFORE the registry sweep, and the sweep runs after
 * `applyI18n`, so panel relabelers repair any dynamic content `applyI18n` reverted to a placeholder.
 */
export function applyLocalePreference(pref: string, extra?: () => void): void {
  setLocaleFromPreference(pref);
  applyI18n(document);
  if (extra) {
    try { extra(); } catch { /* window-specific re-render is best-effort */ }
  }
  runRetranslate();
}

export async function initLocaleForWindow(bridge: LocaleBridge | undefined | null, extra?: () => void): Promise<void> {
  if (!bridge) return;
  const apply = (pref: string): void => applyLocalePreference(pref, extra);
  if (typeof bridge.onLocaleChanged === 'function') {
    bridge.onLocaleChanged((pref: string) => apply(typeof pref === 'string' ? pref : 'system'));
  }
  if (typeof bridge.getLocale === 'function') {
    try {
      const pref = await bridge.getLocale();
      if (typeof pref === 'string' && pref) apply(pref);
    } catch {
      /* keep the default locale if the query fails */
    }
  }
}

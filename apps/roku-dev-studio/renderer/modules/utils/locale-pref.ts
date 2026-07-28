/**
 * Renderer-side locale-preference resolution — the small, dependency-light half of the locale flow.
 *
 * A stored language preference is either a concrete {@link LocaleCode} or the `system` sentinel; the
 * sentinel resolves against THIS window's OS locale (browser `navigator.language`). Every renderer
 * entry point that needs to repoint the catalog from a preference goes through {@link
 * setLocaleFromPreference} so the OS-locale fallback is spelled ONE way. The live-switch helper
 * `applyLocalePreference` (locale-live.ts) builds on this; startup / state-load paths that only need
 * the catalog repointed (no DOM re-render yet) call it directly.
 *
 * NOTE: the main process resolves its own osLocale from Electron's `app.getLocale()`, not
 * `navigator`, so it does NOT use this — it calls `effectiveLocale(pref, app.getLocale())` directly.
 */
import { setLocale, effectiveLocale, type LocaleCode } from '@shared/strings/index.js';

/** This window's OS locale (browser `navigator.language`), or '' when unavailable. */
export function osLocale(): string {
  return (typeof navigator !== 'undefined' && navigator.language) || '';
}

/** Resolve a stored preference ('system' or a code) against the OS locale and repoint the catalog.
 *  Returns the resolved LocaleCode. */
export function setLocaleFromPreference(pref: string): LocaleCode {
  return setLocale(effectiveLocale(pref, osLocale()));
}

/**
 * Single source of truth for the app's user-facing UI text.
 *
 * TS code imports `S` and references strings directly (type-safe + autocompletes):
 *   import { S } from '@shared/strings/index.js';
 *   btn.textContent = S.common.save;
 *
 * Static HTML (a later migration phase) uses `data-i18n="area.key"` attributes that
 * `applyI18n(root)` fills at load. `t('area.key')` is the dynamic-key lookup behind it.
 *
 * `S` is locale-aware: it's a thin Proxy that always resolves against the **active
 * locale's** catalog, so every `S.area.key` call site keeps working unchanged when the
 * active locale is switched via {@link setLocale}. English is the base locale and the
 * only one shipping today; add a locale by building a same-shape catalog and registering
 * it in `catalogs` / `availableLocales`. Live re-render after a switch is a separate
 * concern — see `.discussion-docs/RUNTIME-LOCALE-SWITCHING.md`.
 */
import { resolveKey, makeApplyI18n, type StringCatalog } from './i18n.js';
import { common } from './common.js';
import { sideloadRelay } from './sideload-relay.js';
import { settings } from './settings.js';
import { devApp } from './dev-app.js';
import { queries } from './queries.js';
import { modals } from './modals.js';
import { networkSessionViewer } from './network-session-viewer.js';
import { inspector } from './inspector.js';
import { networkInspector } from './network-inspector.js';
import { actionScripts } from './action-scripts.js';
import { consoleLog } from './console-log.js';
import { ui } from './ui.js';
import { app } from './app.js';
import { telnet } from './telnet.js';
import { fiddle } from './fiddle.js';
import { floatingRemote } from './floating-remote.js';
import { about } from './about.js';
import { deeplink } from './deeplink.js';
import { utils } from './utils.js';
import { logFileViewer } from './log-file-viewer.js';
import { menu } from './menu.js';
import { debuggerStrings } from './debugger.js';
import { staticAnalysis } from './static-analysis.js';
import { tryDemoApp } from './try-demo-app.js';
import { es } from './es/index.js';
import { uk } from './uk/index.js';
import { pl } from './pl/index.js';
import { ro } from './ro/index.js';
import { pt } from './pt/index.js';

/** The English catalog — the base locale and the source of the catalog's shape. */
const en = {
  common,
  sideloadRelay,
  settings,
  devApp,
  queries,
  modals,
  networkSessionViewer,
  inspector,
  networkInspector,
  actionScripts,
  consoleLog,
  ui,
  app,
  telnet,
  fiddle,
  floatingRemote,
  about,
  deeplink,
  utils,
  logFileViewer,
  menu,
  debugger: debuggerStrings,
  staticAnalysis,
  tryDemoApp,
} as const;

/** Shape shared by every locale catalog (deep-readonly, literal-typed via `en`). */
export type StringsCatalog = typeof en;

/**
 * Widened view of the catalog: string literals → `string`, tuples/arrays → arrays of
 * widened elements, function leaves keep their signature. A hand-authored locale catalog
 * (Spanish, …) is typed against this so TypeScript enforces it has EVERY key with a
 * matching shape, without demanding the exact English literal values ("Guardar" is not
 * assignable to the literal type "Save").
 */
type Widen<T> =
  T extends string ? string :
  T extends (...args: infer A) => infer R ? (...args: A) => R :
  T extends readonly (infer E)[] ? readonly Widen<E>[] :
  { [K in keyof T]: Widen<T[K]> };
export type LocaleCatalog = Widen<StringsCatalog>;

/** Codes of the locales that ship today. Extend this union as catalogs are added. */
export type LocaleCode = 'en' | 'es' | 'uk' | 'pl' | 'ro' | 'pt';

/** Registry of shippable catalogs, keyed by locale code. `en` is literal-typed (assignable
 *  to the widened shape); hand-authored locales are checked as LocaleCatalog. */
const catalogs: Record<LocaleCode, LocaleCatalog> = { en, es, uk, pl, ro, pt };

/**
 * Ordered list for the Settings → General language picker. `label` is the locale's own
 * endonym, shown as-is (language names are conventionally NOT themselves translated), so
 * it lives here as locale metadata rather than in the translatable string catalog.
 */
export const availableLocales: ReadonlyArray<{ code: LocaleCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español (Latinoamérica)' },
  { code: 'uk', label: 'Українська' },
  { code: 'pl', label: 'Polski' },
  { code: 'ro', label: 'Română' },
  { code: 'pt', label: 'Português (Brasil)' },
];

let activeLocale: LocaleCode = 'en';

function isLocaleCode(code: string): code is LocaleCode {
  return Object.prototype.hasOwnProperty.call(catalogs, code);
}

/** The locale `S` currently resolves against. */
export function getLocale(): LocaleCode {
  return activeLocale;
}

/**
 * Point `S` at a locale. Unknown codes are ignored (the active locale is unchanged).
 * Returns the locale actually in effect. This only repoints the catalog — re-rendering
 * already-drawn UI is the caller's job (`applyI18n(document)` for HTML bindings plus a
 * per-window retranslate for imperative surfaces; see the design note). Today only 'en'
 * ships, so this is effectively a no-op until a second catalog is registered.
 */
export function setLocale(code: string): LocaleCode {
  if (isLocaleCode(code)) activeLocale = code;
  return activeLocale;
}

/**
 * Sentinel meaning "follow the operating-system locale" — the default language
 * preference. Stored and selected in the Settings language picker; resolve it to a
 * concrete code with {@link effectiveLocale}.
 */
export const SYSTEM_LOCALE = 'system';

/** Endonym label for a shipping locale (e.g. 'en' → "English"); falls back to the code. */
export function localeLabel(code: LocaleCode): string {
  const hit = availableLocales.find((l) => l.code === code);
  return hit ? hit.label : code;
}

/**
 * Map a raw OS locale ("en-US", "pt_BR", "fr") to a shipping LocaleCode by its primary
 * subtag, or null when no catalog ships for it.
 */
export function matchLocale(osLocale: string): LocaleCode | null {
  if (!osLocale) return null;
  const primary = osLocale.toLowerCase().split(/[-_]/)[0];
  return isLocaleCode(primary) ? primary : null;
}

/**
 * Resolve a stored language preference to a concrete LocaleCode. `pref` is a LocaleCode or
 * {@link SYSTEM_LOCALE}; `osLocale` is the raw OS locale used when following the system.
 * Falls back to 'en'.
 */
export function effectiveLocale(pref: string, osLocale: string): LocaleCode {
  if (pref && pref !== SYSTEM_LOCALE && isLocaleCode(pref)) return pref;
  return matchLocale(osLocale) ?? 'en';
}

/**
 * Single source of truth for UI text. A Proxy over the base catalog whose top-level
 * namespace access is redirected to the **active** locale — so `S.common.save` always
 * reflects `getLocale()`. Enumeration/`in` fall through to `en`, which is correct because
 * every locale shares its shape. Typed as {@link StringsCatalog} for full autocomplete.
 */
export const S: StringsCatalog = new Proxy(en, {
  get(target, prop, receiver) {
    const active = catalogs[activeLocale] as Record<PropertyKey, unknown>;
    return prop in active ? active[prop] : Reflect.get(target, prop, receiver);
  },
});

/** Dotted-key lookup ("common.save"); returns the key itself if unresolved. Prefer
 *  `S.x.y` directly in TS — use this only for dynamic keys. */
export function t(key: string): string {
  return resolveKey(S as unknown as StringCatalog, key) ?? key;
}

/** Fill every `[data-i18n*]` element under `root` from the catalog. Static HTML keeps
 *  its inline English as the fallback for any key that doesn't resolve. */
export const applyI18n = makeApplyI18n((key) => resolveKey(S as unknown as StringCatalog, key));

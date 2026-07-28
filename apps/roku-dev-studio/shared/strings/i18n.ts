/**
 * Tiny i18n runtime for Roku Dev Studio's shared UI-string catalog.
 *
 * All user-facing UI text lives in per-area modules (common.ts, settings.ts,
 * network-inspector.ts, …) composed into the single `S` object in index.ts. TS code
 * references strings directly — `S.common.save` — for full type-safety + IDE
 * autocomplete. Static HTML carries `data-i18n="area.key"` (and
 * `data-i18n-placeholder` / `-title` / `-aria-label`) attributes filled at load by
 * {@link makeApplyI18n}; the inline text stays as the English fallback.
 *
 * There is one locale today (English, inline in the catalog). To add a translation
 * later, provide an alternate catalog and swap what index.ts composes into `S`; the
 * dotted-key lookup and the DOM pass below need no change.
 *
 * This module stays free of any dependency on the composed catalog (so index.ts can
 * import it without a cycle) and free of DOM-lib types (so it type-checks in BOTH the
 * renderer, which has the DOM lib, and the main process, which does not — the catalog
 * is imported from both). `applyI18n` only ever runs in a renderer at runtime.
 */

export type StringCatalog = { [k: string]: unknown };

/**
 * Opt-out marker attribute. Set at runtime by the renderer's `setDynamic*` helpers on an
 * element whose text/HTML content JS has taken over from its `data-i18n` placeholder.
 * {@link makeApplyI18n} skips the CONTENT bindings (`data-i18n` / `data-i18n-html`) of any
 * element carrying it, so a live locale-switch retranslate pass won't revert live data back
 * to the element's placeholder. The element's `data-i18n` key is left intact, so clearing the
 * marker hands the element back to `applyI18n` untouched (used when it toggles from live data
 * back to a translatable placeholder). Attribute bindings (`-title`/`-placeholder`/`-aria-label`/
 * `-alt`) are NOT skipped — the `setDynamic*` helpers only ever write content, never attributes.
 */
export const I18N_DYNAMIC_ATTR = 'data-i18n-dynamic';

/**
 * Resolve a dotted key ("common.save") against a catalog. Returns `undefined` when
 * the key is missing or resolves to a non-string (e.g. a parametrized function entry,
 * which is TS-only). Never throws.
 */
export function resolveKey(catalog: StringCatalog, key: string): string | undefined {
  let cur: unknown = catalog;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** Minimal structural element shape (avoids the DOM lib so this compiles main-side). */
type El = {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
};
type QueryRoot = { querySelectorAll(selectors: string): ArrayLike<El> };

/**
 * Build the DOM pass that fills every `[data-i18n*]` element under a root from the
 * catalog (via the provided `resolve`). Bound to the composed catalog in index.ts.
 *
 * Safety: a key that doesn't resolve is SKIPPED — the element keeps its inline English
 * fallback (so a typo'd `data-i18n` degrades to English, never a raw key). For
 * `data-i18n` text, element children (icons/SVGs) are preserved: a text-only element
 * gets its `textContent` set; a mixed icon+label element has only its first significant
 * text node replaced, keeping the surrounding whitespace so icon spacing survives.
 *
 * Elements carrying {@link I18N_DYNAMIC_ATTR} are skipped by the two CONTENT passes below,
 * so JS-populated live data (device IP, computed hints) survives a retranslate.
 */
export function makeApplyI18n(resolve: (key: string) => string | undefined) {
  return function applyI18n(root?: QueryRoot): void {
    const scope = root ?? (globalThis as { document?: QueryRoot }).document;
    if (!scope) return;

    const eachAttr = (attr: string, set: (el: El, value: string) => void): void => {
      const nodes = scope.querySelectorAll(`[${attr}]`);
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        const key = el.getAttribute(attr);
        if (!key) continue;
        const value = resolve(key);
        if (value !== undefined) set(el, value);
      }
    };

    // Text content — preserve child elements (icons) + whitespace on mixed content. Skip
    // elements JS has taken over (I18N_DYNAMIC_ATTR) so their live data isn't reverted.
    const textNodes = scope.querySelectorAll(`[data-i18n]:not([${I18N_DYNAMIC_ATTR}])`);
    for (let i = 0; i < textNodes.length; i++) {
      const key = textNodes[i].getAttribute('data-i18n');
      if (!key) continue;
      const value = resolve(key);
      if (value === undefined) continue;
      const node = textNodes[i] as unknown as {
        children: ArrayLike<unknown>;
        childNodes: ArrayLike<{ nodeType: number; textContent: string | null }>;
        textContent: string | null;
        appendChild(n: unknown): void;
        ownerDocument: { createTextNode(s: string): unknown };
      };
      if (node.children.length === 0) {
        node.textContent = value;
        continue;
      }
      let replaced = false;
      for (let j = 0; j < node.childNodes.length; j++) {
        const cn = node.childNodes[j];
        if (cn.nodeType === 3 && cn.textContent && cn.textContent.trim()) {
          const lead = (cn.textContent.match(/^\s*/) || [''])[0];
          const trail = (cn.textContent.match(/\s*$/) || [''])[0];
          cn.textContent = lead + value + trail;
          replaced = true;
          break;
        }
      }
      if (!replaced) node.appendChild(node.ownerDocument.createTextNode(value));
    }

    // Rich HTML content — replace the element's innerHTML with a resolved catalog string
    // that itself contains markup (<strong>/<code>/<a>/<ul>…). This is the mechanism for
    // multi-element prose blocks that the single-text-node `data-i18n` path can't rebuild.
    // The catalog is trusted, first-party app content (never user input), so assigning
    // innerHTML here is safe. A key that doesn't resolve is skipped (inline HTML fallback kept).
    const htmlNodes = scope.querySelectorAll(`[data-i18n-html]:not([${I18N_DYNAMIC_ATTR}])`);
    for (let i = 0; i < htmlNodes.length; i++) {
      const key = htmlNodes[i].getAttribute('data-i18n-html');
      if (!key) continue;
      const value = resolve(key);
      if (value === undefined) continue;
      (htmlNodes[i] as unknown as { innerHTML: string }).innerHTML = value;
    }

    eachAttr('data-i18n-placeholder', (el, v) => el.setAttribute('placeholder', v));
    eachAttr('data-i18n-title', (el, v) => el.setAttribute('title', v));
    eachAttr('data-i18n-aria-label', (el, v) => el.setAttribute('aria-label', v));
    eachAttr('data-i18n-alt', (el, v) => el.setAttribute('alt', v));
  };
}

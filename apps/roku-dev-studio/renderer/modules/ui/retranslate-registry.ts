/**
 * Retranslate registry for imperatively-rendered surfaces.
 *
 * `applyI18n(document)` only updates elements carrying `data-i18n*` attributes. Content
 * built imperatively from `S.*` (modals, dynamically-injected rows) can't be reached that
 * way, so such a surface registers a re-render callback here while it's on screen. On a
 * live locale change the main window calls {@link runRetranslate} (after `applyI18n` +
 * `renderDeviceList`) to re-render every registered surface in the new language.
 *
 * Only register surfaces where re-rendering is state-safe (read-only content, or content
 * that preserves its own input). Callbacks are invoked best-effort; a throw is swallowed so
 * one bad surface can't block the rest.
 */
type RetranslateFn = () => void;

const registered = new Set<RetranslateFn>();

/** Register a re-render callback; returns an unregister function (call it on close/teardown). */
export function registerRetranslate(fn: RetranslateFn): () => void {
  registered.add(fn);
  return () => {
    registered.delete(fn);
  };
}

/** Re-render every registered surface. Called by the main window on a live locale change. */
export function runRetranslate(): void {
  for (const fn of Array.from(registered)) {
    try {
      fn();
    } catch {
      /* best-effort: one surface's failure must not block the others */
    }
  }
}

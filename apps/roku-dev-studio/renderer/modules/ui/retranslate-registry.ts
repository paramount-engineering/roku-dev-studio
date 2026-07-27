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

/**
 * Per-device-panel retranslate.
 *
 * The global {@link registerRetranslate} set is for surfaces mounted once for the window's
 * lifetime (modals, the About/Session-Viewer shells). Device tab panels are different: each
 * connected device clones its own panel with its own imperatively-rendered surfaces (Network
 * Inspector session list, Action Scripts steps, App Connector placeholders, the auth badge,
 * the performance charts). Those must retranslate too, but they come and go as devices connect
 * and disconnect, so a global set would need matching unregister bookkeeping on every teardown.
 *
 * Instead we stash the callbacks ON the panel element (`.tab-panel`) itself. When the panel is
 * removed from the DOM on disconnect, its callbacks vanish with it — no explicit unregister. On a
 * live locale change the main window calls {@link runPanelRetranslate} for every still-mounted
 * panel, AFTER `applyI18n(document)`, so a callback that re-renders from current state also
 * repairs any dynamic content `applyI18n` may have clobbered back to a `data-i18n` placeholder.
 *
 * Only register state-safe re-renders (derived from the surface's own state, preserving user
 * input/selection) — same contract as {@link registerRetranslate}.
 */
type PanelWithRelabelers = { _i18nRelabelers?: Array<() => void> };

/** Attach a relabel callback to a device panel, scoped to that panel's DOM lifetime. */
export function registerPanelRetranslate(panel: unknown, fn: () => void): void {
  const p = panel as PanelWithRelabelers;
  (p._i18nRelabelers ??= []).push(fn);
}

/** Run every mounted device panel's relabel callbacks. Best-effort per callback. */
export function runPanelRetranslate(): void {
  const doc = (globalThis as { document?: { querySelectorAll(s: string): ArrayLike<unknown> } }).document;
  if (!doc) return;
  const panels = doc.querySelectorAll('.tab-panel');
  for (let i = 0; i < panels.length; i++) {
    const fns = (panels[i] as PanelWithRelabelers)._i18nRelabelers;
    if (!fns) continue;
    for (const fn of fns) {
      try {
        fn();
      } catch {
        /* best-effort: one panel/surface's failure must not block the others */
      }
    }
  }
}

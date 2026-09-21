/**
 * Panel-scoped "a device password was saved" notification.
 *
 * Mirrors {@link registerPanelRetranslate}/{@link runRetranslate} in `retranslate-registry.ts`:
 * callbacks are stashed on the `.tab-panel` element itself so they vanish with it on disconnect —
 * no explicit unregister needed.
 *
 * Exists because a password can be validated & saved from a surface that has no reference to the
 * device's open tab panel at all (Settings → Sideload Relay → Setup Devices, or the Device Info
 * modal's inline relay password prompt) — both funnel through the same
 * `IPC.SecretsPasswordUpdated` push, but nothing previously fanned that out to the Dev App
 * section's Auth card, which otherwise only re-checks stored passwords once at panel mount.
 */
type PasswordUpdateFn = (serial: string, password: string) => void;
type PanelWithPasswordListeners = { _passwordUpdateListeners?: PasswordUpdateFn[] };

/** Attach a password-update callback to a device panel, scoped to that panel's DOM lifetime. */
export function registerPanelPasswordUpdate(panel: unknown, fn: PasswordUpdateFn): void {
  const p = panel as PanelWithPasswordListeners;
  (p._passwordUpdateListeners ??= []).push(fn);
}

/** Notify every still-mounted device panel that a password was saved for `serial`. Best-effort
 *  per callback — one panel's throw must not block the rest. */
export function notifyPanelsPasswordUpdated(serial: string, password: string): void {
  for (const panel of document.querySelectorAll('.tab-panel')) {
    const fns = (panel as unknown as PanelWithPasswordListeners)._passwordUpdateListeners;
    if (!fns) continue;
    for (const fn of fns) {
      try {
        fn(serial, password);
      } catch {
        /* best-effort */
      }
    }
  }
}

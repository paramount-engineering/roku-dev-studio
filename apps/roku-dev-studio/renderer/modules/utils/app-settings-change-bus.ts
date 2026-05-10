/**
 * Single subscription to `window.roku.onAppSettingsUpdated`, fanned out to any
 * number of local subscribers.
 *
 * Previously `app.ts` (global shell: reload, sidebar, connection monitor) and
 * each device-metrics panel subscribed to the IPC event independently. Each
 * subscriber then called `loadPersistedAppSettings()` and updated its own
 * state. With multiple device tabs open that meant N parallel reloads per
 * save, racing against each other.
 *
 * This module keeps one IPC listener, reloads the persisted settings *once*,
 * then notifies registered local subscribers in the order they were added.
 * Subscribers get called after the reload has settled, so reading
 * `REMEMBER_SIDEBAR_TOGGLE` / `CONNECTION_CHECK_INTERVAL` / etc. is safe.
 */

import { loadPersistedAppSettings } from './app-user-settings.js';

type Listener = () => void;

const listeners = new Set<Listener>();
let ipcUnsub: (() => void) | null = null;
/** Collapse overlapping events into a single reload pass. */
let reloadInFlight: Promise<void> | null = null;

function ensureIpcSubscription(): void {
  if (ipcUnsub) return;
  const roku = (window as unknown as { roku?: { onAppSettingsUpdated?: unknown } }).roku;
  const subscribe = roku && typeof roku.onAppSettingsUpdated === 'function'
    ? (roku.onAppSettingsUpdated as (cb: () => void) => () => void)
    : null;
  if (!subscribe) return;
  ipcUnsub = subscribe(() => {
    if (reloadInFlight) return;
    const task = loadPersistedAppSettings()
      .catch(() => {
        // Individual subscribers handle their own failure modes; keeping the
        // bus resilient means a reload error doesn't wedge future events.
      })
      .finally(() => {
        reloadInFlight = null;
        for (const listener of Array.from(listeners)) {
          try {
            listener();
          } catch (_) {}
        }
      });
    reloadInFlight = task;
  });
}

/**
 * Register a handler to run whenever persisted app settings change. The
 * handler is invoked *after* `loadPersistedAppSettings()` resolves, so it can
 * read the updated values from `app-user-settings.ts` directly.
 * Returns an unsubscribe function.
 */
export function onAppSettingsChanged(handler: Listener): () => void {
  listeners.add(handler);
  ensureIpcSubscription();
  return () => {
    listeners.delete(handler);
    if (listeners.size === 0 && ipcUnsub) {
      try {
        ipcUnsub();
      } catch (_) {}
      ipcUnsub = null;
    }
  };
}

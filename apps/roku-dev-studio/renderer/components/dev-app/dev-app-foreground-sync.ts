/**
 * Single path for “is Dev App (id=dev) in the foreground?” — dispatches
 * `dev-app-active-polled` so Device Performance, Dev App tab Launch, screenshots, etc. stay aligned.
 */

import type { DevAppApi, DevicePanelRoot } from './dev-app-types.js';
import { QUERY_ENDPOINTS } from '../../modules/utils/constants.js';

export function dispatchDevAppForegroundFromActiveAppXml(
  panel: DevicePanelRoot,
  activeAppXml: string
): void {
  const active = activeAppXml.includes('id="dev"');
  panel.dispatchEvent(
    new CustomEvent('dev-app-active-polled', { detail: { active, ok: true } })
  );
}

/**
 * Query `/query/active-app` once and dispatch `dev-app-active-polled`.
 * @returns `true` / `false` when XML was read; `null` when the query failed (still dispatches `active: false`).
 *
 * On query error, detail.ok is `false` so listeners can distinguish a real "dev backgrounded"
 * transition from a transient network / ECP failure and avoid spuriously pausing metrics,
 * gating Launch, etc. Existing listeners that only read `detail.active` keep working.
 */
export async function pollDevAppForegroundOnce(
  panel: DevicePanelRoot,
  api: DevAppApi
): Promise<boolean | null> {
  try {
    const res = await api.query(QUERY_ENDPOINTS.ACTIVE_APP);
    if (!res.success || typeof res.data !== 'string') {
      panel.dispatchEvent(
        new CustomEvent('dev-app-active-polled', { detail: { active: false, ok: false } })
      );
      return null;
    }
    const active = res.data.includes('id="dev"');
    panel.dispatchEvent(
      new CustomEvent('dev-app-active-polled', { detail: { active, ok: true } })
    );
    return active;
  } catch {
    panel.dispatchEvent(
      new CustomEvent('dev-app-active-polled', { detail: { active: false, ok: false } })
    );
    return null;
  }
}

const DEFAULT_AFTER_LAUNCH = { attempts: 8, intervalMs: 450 } as const;

/**
 * After `launch dev`, foreground may lag behind ECP; poll until dev is active or attempts run out.
 * @returns whether dev became foreground during polling
 */
export async function pollDevAppForegroundAfterLaunch(
  panel: DevicePanelRoot,
  api: DevAppApi,
  opts?: { attempts?: number; intervalMs?: number }
): Promise<boolean> {
  const attempts = opts?.attempts ?? DEFAULT_AFTER_LAUNCH.attempts;
  const intervalMs = opts?.intervalMs ?? DEFAULT_AFTER_LAUNCH.intervalMs;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, intervalMs));
    const active = await pollDevAppForegroundOnce(panel, api);
    if (active === true) return true;
  }
  return false;
}

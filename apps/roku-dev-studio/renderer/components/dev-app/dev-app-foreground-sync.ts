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

/** Shared retry loop behind both `...AfterLaunch` and `...AfterHome` below — a state transition
 *  just got triggered (launch, or a Home keypress) and real foreground status lags behind it by an
 *  unknown amount, so a single immediate query is a race, not a check. Polls until `/query/active-app`
 *  reports the expected state or attempts run out. */
async function pollUntilForegroundState(
  panel: DevicePanelRoot,
  api: DevAppApi,
  targetActive: boolean,
  attempts: number,
  intervalMs: number
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, intervalMs));
    const active = await pollDevAppForegroundOnce(panel, api);
    if (active === targetActive) return true;
  }
  return false;
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
  return pollUntilForegroundState(panel, api, true, opts?.attempts ?? DEFAULT_AFTER_LAUNCH.attempts, opts?.intervalMs ?? DEFAULT_AFTER_LAUNCH.intervalMs);
}

const DEFAULT_AFTER_HOME = { attempts: 6, intervalMs: 350 } as const;

/**
 * After Home is pressed, the dev channel takes a moment to actually drop out of foreground —
 * the same lag `pollDevAppForegroundAfterLaunch` accounts for, just waiting for `active` to flip
 * to `false` instead of `true`. The previous single-shot check (`pollDevAppForegroundOnce` alone)
 * mostly got away with it against a physical device's near-instant LAN ECP response, but an RCE
 * device's extra ports-bridge/HTTPS hop makes that race lose often enough to matter in practice —
 * Home would exit the channel for real, but the Floating Remote's Launch button (and the Dev App
 * tab's own) stayed hidden until some unrelated refresh (e.g. a tab switch) happened to re-check.
 * @returns whether dev was confirmed backgrounded during polling
 */
export async function pollDevAppForegroundAfterHome(
  panel: DevicePanelRoot,
  api: DevAppApi,
  opts?: { attempts?: number; intervalMs?: number }
): Promise<boolean> {
  return pollUntilForegroundState(panel, api, false, opts?.attempts ?? DEFAULT_AFTER_HOME.attempts, opts?.intervalMs ?? DEFAULT_AFTER_HOME.intervalMs);
}

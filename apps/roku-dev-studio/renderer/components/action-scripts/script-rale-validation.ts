/**
 * Shared RALE preflight for Action Script validation (Executor + Import modal).
 *
 * Delegates all connection work to the per-panel AppConnector so the Builder,
 * Executor, and inspector share a single connection.
 */

import { getAppConnector } from '../../modules/app-connector/index.js';
import { S } from '@shared/strings/index.js';

// Read these S.* leaves inline at each return site (below) rather than caching in
// module-scope consts — a const would freeze the startup locale and never update
// on a live language switch.

/**
 * When the script needs RALE: require Dev App, live connection, return normalized app functions list.
 * @param {HTMLElement} panel
 * @param {Object} api
 * @param {(() => unknown[] | null | undefined) | null | undefined} getCachedRaleFunctions
 * @returns {Promise<{ ok: true, raleFunctions: unknown[] } | { ok: false, error: string }>}
 */
export async function ensureRaleFunctionsWhenScriptNeedsRale(panel, api, getCachedRaleFunctions) {
  if (!api || !api.raleCommand) {
    return { ok: true, raleFunctions: [] };
  }

  const connector = getAppConnector(panel, api);

  // Preflight: Dev App must be foreground. The connector offers `checkDevApp`
  // too, but we want a distinct error message here (and to return without
  // waking TrackerTask when the dev channel isn't even running).
  if (api.query) {
    try {
      const activeAppRes = await api.query('/query/active-app');
      const devAppActive =
        activeAppRes &&
        activeAppRes.success &&
        activeAppRes.data &&
        String(activeAppRes.data).includes('id="dev"');
      if (!devAppActive) return { ok: false, error: S.actionScripts.errDevAppRequired };
    } catch {
      return { ok: false, error: S.actionScripts.errDevAppRequired };
    }
  }

  const connectionId = await connector.ensureConnected({ verify: true });
  if (!connectionId) return { ok: false, error: S.actionScripts.errRaleConnection };

  const cached = getCachedRaleFunctions && getCachedRaleFunctions();
  if (cached && Array.isArray(cached) && cached.length) {
    return { ok: true, raleFunctions: cached };
  }

  // Round-trip the fetch so the connector's auto-cache (via
  // `maybeCacheFunctionsFromResult`) populates the normalized function list,
  // then read the normalized shape straight from the cache. Reading the raw
  // `res.data.functions` here would mean re-running the same normalizer the
  // connector already ran — two callers, two passes, latent drift if the
  // normalizer ever grows a second step. See `engineering-principles.md` §20.
  let raleFunctions: unknown[] = [];
  try {
    const res = await connector.command('getExternalControlFunctions', {});
    if (res && res.success) {
      raleFunctions = (connector.getFunctions() ?? []) as unknown[];
    }
  } catch {
    raleFunctions = [];
  }
  return { ok: true, raleFunctions };
}

/**
 * When the script does not require RALE: still load app functions if already connected (for appFunction validation when optional).
 * @param {HTMLElement} panel
 * @param {Object} api
 * @param {(() => unknown[] | null | undefined) | null | undefined} getCachedRaleFunctions
 * @returns {Promise<unknown[]>}
 */
export async function optionalRaleFunctionsForScript(panel, api, getCachedRaleFunctions) {
  const cached = getCachedRaleFunctions && getCachedRaleFunctions();
  if (cached && Array.isArray(cached) && cached.length) return cached;
  if (!api || !api.raleCommand) return [];

  const connector = getAppConnector(panel, api);
  if (!connector.isConnected()) {
    // Don't open a connection just to enumerate functions; the script
    // validates fine without the prefilled dropdown when RALE is optional.
    const alive = await connector.verify();
    if (!alive) return [];
  }

  try {
    const res = await connector.command('getExternalControlFunctions', {});
    if (res && res.success) {
      return (connector.getFunctions() ?? []) as unknown[];
    }
  } catch {
    return [];
  }
  return [];
}

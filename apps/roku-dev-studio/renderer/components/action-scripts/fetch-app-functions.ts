/**
 * Fetch the sideloaded Dev App's external-control function list for the
 * Action Script Builder dropdown.
 *
 * "Borrow" pattern: if the shared AppConnector isn't already connected (the
 * user hasn't hit Connect in the Inspector tab, and no script is running),
 * this helper opens a temporary connection, fetches the list, and disconnects
 * again so the Executor can later open its own connection cleanly. If there's
 * already a live connection we reuse it and leave it alone.
 */

import {
  getAppConnector,
  type AppConnectorApiLike
} from '../../modules/app-connector/index.js';

/**
 * The device API shape this helper needs. `raleCommand` is optional on the
 * input type so callers can pass their loose panel api; we gate on it at
 * runtime below and only hand the connector an adapter that matches
 * `AppConnectorApiLike` (where the same method is required).
 */
type FetchAppFunctionsApi = Partial<Pick<AppConnectorApiLike, 'raleCommand'>> &
  Omit<AppConnectorApiLike, 'raleCommand'>;

/**
 * @returns true if the function list was fetched and passed to `setFunctionsFn`, false otherwise.
 */
export async function fetchAppFunctionsForBuilder(
  panel: HTMLElement,
  api: FetchAppFunctionsApi,
  setFunctionsFn: (functions: unknown[]) => void
): Promise<boolean> {
  if (!api || typeof api.raleCommand !== 'function') return false;

  const connector = getAppConnector(panel, api as AppConnectorApiLike);
  const borrowed = !connector.isConnected();

  const cid = await connector.ensureConnected();
  if (!cid) return false;

  let ok = false;
  try {
    // Round-trip through `connector.command` so the auto-cache fires; then
    // read the already-normalized list directly from the connector instead of
    // re-normalizing `res.data.functions` ourselves. One normalizer, one
    // in-memory shape — see `engineering-principles.md` §20.
    const res = await connector.command<{ functions?: unknown[] }>(
      'getExternalControlFunctions',
      {}
    );
    if (res && res.success) {
      const fns = connector.getFunctions() ?? [];
      setFunctionsFn(fns as unknown[]);
      ok = true;
    }
  } catch (_) {
    // Swallow: the Builder simply shows an empty list on failure.
  }

  if (borrowed) {
    try {
      await connector.disconnect();
    } catch (_) {}
  }
  return ok;
}

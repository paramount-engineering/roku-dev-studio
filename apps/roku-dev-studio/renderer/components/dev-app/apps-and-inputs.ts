// Installed-apps + TV-inputs list, shared per connected-device session between the Apps tab, the
// Remote tab's TV-input row, and the Dev App tab's Sideloaded App card — all three used to fire
// their own independent `/query/apps` ECP call on panel creation, racing each other and (for RCE
// devices) multiplying exposure to the gateway's cold-start 503 window (see roku-dev-studio-rce's
// rce-ecp.ts retry fix). Now whichever asks first triggers the one fetch and the others join the
// same in-flight promise; every settled result also fans out to the subscribers registered via
// `onAppsAndInputsResolved`, so a reload one tab triggers refreshes the others. Nothing is cached:
// once a fetch settles, the next call starts a fresh one.

import { decodeHtmlEntities } from '../../modules/utils/index.js';
import { errMessage } from '@shared/platform/err-util.js';
import { S } from '@shared/strings/index.js';

export interface AppsAndInputsResult {
  success: true;
  apps: Array<{ id: string; name: string; version: string }>;
  inputs: Array<{ id: string; label: string; version: string }>;
}
export interface AppsAndInputsFailure {
  success: false;
  error: string;
}

// Keyed by the api adapter object — 1:1 with a connected device panel/session, so this needs no
// manual cleanup: it's just garbage once the panel disconnects and nothing references `api`.
const appsAndInputsInFlight = new WeakMap<object, Promise<AppsAndInputsResult | AppsAndInputsFailure>>();
const appsAndInputsListeners = new WeakMap<object, Set<(v: AppsAndInputsResult | AppsAndInputsFailure) => void>>();

export function onAppsAndInputsResolved(
  api: object,
  listener: (v: AppsAndInputsResult | AppsAndInputsFailure) => void
): void {
  let set = appsAndInputsListeners.get(api);
  if (!set) {
    set = new Set();
    appsAndInputsListeners.set(api, set);
  }
  set.add(listener);
}

async function fetchAppsAndInputs(api: {
  query: (path: string) => Promise<{ success?: boolean; data?: string; error?: string }>;
}): Promise<AppsAndInputsResult | AppsAndInputsFailure> {
  try {
    const result = await api.query('/query/apps');
    if (!result?.success || typeof result.data !== 'string') {
      return { success: false, error: result?.error || S.app.unknownError };
    }
    const apps: AppsAndInputsResult['apps'] = [];
    const inputs: AppsAndInputsResult['inputs'] = [];
    // TV inputs are exposed by /query/apps with ids prefixed "tvinput." (e.g. tvinput.hdmi1).
    // Matches on the full attribute blob (not just `id` as the first attribute) so `version` can
    // be pulled out too, same approach the old raw-list formatter used independently.
    for (const m of result.data.matchAll(/<app\s+([^>]*)>([^<]*)<\/app>/g)) {
      const attrs = m[1];
      const idMatch = attrs.match(/id="([^"]+)"/);
      if (!idMatch) continue;
      const id = idMatch[1];
      const versionMatch = attrs.match(/version="([^"]+)"/);
      const version = versionMatch ? versionMatch[1] : '';
      const name = decodeHtmlEntities(m[2]).trim();
      if (id.startsWith('tvinput.')) inputs.push({ id, label: name, version });
      else apps.push({ id, name, version });
    }
    return { success: true, apps, inputs };
  } catch (error) {
    return { success: false, error: errMessage(error) };
  }
}

/** Joins the in-flight `/query/apps` fetch for this api if there is one, else starts a new one.
 *  Either way the result fans out to every `onAppsAndInputsResolved` subscriber on settle. */
export function loadAppsAndInputs(
  api: object & { query: (path: string) => Promise<{ success?: boolean; data?: string; error?: string }> }
): Promise<AppsAndInputsResult | AppsAndInputsFailure> {
  const inflight = appsAndInputsInFlight.get(api);
  if (inflight) return inflight;
  const promise = fetchAppsAndInputs(api).then((value) => {
    appsAndInputsInFlight.delete(api);
    const set = appsAndInputsListeners.get(api);
    if (set && set.size) for (const fn of Array.from(set)) fn(value);
    return value;
  });
  appsAndInputsInFlight.set(api, promise);
  return promise;
}

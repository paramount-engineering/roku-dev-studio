/**
 * Single source of truth for the app's user-facing UI text.
 *
 * TS code imports `S` and references strings directly (type-safe + autocompletes):
 *   import { S } from '@shared/strings/index.js';
 *   btn.textContent = S.common.save;
 *
 * Static HTML (a later migration phase) uses `data-i18n="area.key"` attributes that
 * `applyI18n(root)` fills at load. `t('area.key')` is the dynamic-key lookup behind it.
 *
 * Adding a locale later: build an alternate catalog with the same shape and swap what
 * this module composes into `S` (the lookup + DOM pass are locale-agnostic). Each area
 * lives in its own module so the catalog scales without merge contention.
 */
import { resolveKey, makeApplyI18n, type StringCatalog } from './i18n.js';
import { common } from './common.js';
import { sideloadRelay } from './sideload-relay.js';
import { settings } from './settings.js';
import { devApp } from './dev-app.js';
import { queries } from './queries.js';
import { modals } from './modals.js';
import { networkSessionViewer } from './network-session-viewer.js';
import { inspector } from './inspector.js';
import { networkInspector } from './network-inspector.js';
import { actionScripts } from './action-scripts.js';
import { consoleLog } from './console-log.js';
import { ui } from './ui.js';
import { app } from './app.js';
import { telnet } from './telnet.js';
import { fiddle } from './fiddle.js';
import { floatingRemote } from './floating-remote.js';
import { about } from './about.js';
import { deeplink } from './deeplink.js';
import { utils } from './utils.js';
import { logFileViewer } from './log-file-viewer.js';

export const S = {
  common,
  sideloadRelay,
  settings,
  devApp,
  queries,
  modals,
  networkSessionViewer,
  inspector,
  networkInspector,
  actionScripts,
  consoleLog,
  ui,
  app,
  telnet,
  fiddle,
  floatingRemote,
  about,
  deeplink,
  utils,
  logFileViewer,
} as const;

/** Dotted-key lookup ("common.save"); returns the key itself if unresolved. Prefer
 *  `S.x.y` directly in TS — use this only for dynamic keys. */
export function t(key: string): string {
  return resolveKey(S as unknown as StringCatalog, key) ?? key;
}

/** Fill every `[data-i18n*]` element under `root` from the catalog. Static HTML keeps
 *  its inline English as the fallback for any key that doesn't resolve. */
export const applyI18n = makeApplyI18n((key) => resolveKey(S as unknown as StringCatalog, key));

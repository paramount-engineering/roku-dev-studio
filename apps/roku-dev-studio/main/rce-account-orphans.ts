/**
 * Pure helpers behind `pruneOrphanedRceAccounts` (main/remote-locations.ts) — no Electron or
 * store imports so `npm run verify:rce-account-prune` can pin the rule.
 *
 * An RCE account is two writes in two stores: its token + user id in the secret store, and a
 * `kind: 'rce'` entry in the `remote-locations` setting that the UI lists. Only the second is
 * visible. An account whose location is gone (deleted by a build that predates the renderer's
 * token cleanup, or a crash between the two writes) is an orphan: invisible, yet the add-account
 * duplicate check still matches its token / user id and reports "already added".
 *
 * The `remote-locations` setting is the owner: main/settings.ts prunes orphans after every renderer
 * write of that key (and main.ts once at startup), so the secret store follows the settings entry.
 */

/** Account names referenced by a live `kind: 'rce'` entry in a raw `remote-locations` value. */
export function liveRceAccountNames(remoteLocations: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(remoteLocations)) return out;
  for (const entry of remoteLocations) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    if (o.kind === 'rce' && typeof o.accountName === 'string' && o.accountName) out.add(o.accountName);
  }
  return out;
}

/** Stored account names that no live remote location references. */
export function orphanedRceAccounts(storedNames: readonly string[], remoteLocations: unknown): string[] {
  const live = liveRceAccountNames(remoteLocations);
  return storedNames.filter((name) => !live.has(name));
}

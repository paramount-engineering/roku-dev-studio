/**
 * Check for main/rce-account-orphans.ts — the rule behind `pruneOrphanedRceAccounts`: a stored
 * RCE account is an orphan iff no `kind: 'rce'` remote location names it. Orphans arise when the
 * location was deleted without its token (older builds, or a crash between the two writes) and
 * would otherwise make add-account report "already added" for a location the UI doesn't show.
 * `npm run verify:rce-account-prune`.
 */
import assert from 'node:assert/strict';
import { liveRceAccountNames, orphanedRceAccounts } from '../main/rce-account-orphans';

const locations = [
  { id: 'loc-1', name: 'QA Lab', serverUrl: 'http://10.0.0.5:4951', host: '10.0.0.5', port: 4951 }, // relay: no account
  { id: 'loc-2', name: 'Cloud', kind: 'rce', accountName: 'RCE' },
  { id: 'loc-3', name: 'Cloud 2', kind: 'rce', accountName: 'Team', forgetOnQuit: true },
  { id: 'loc-4', kind: 'rce' }, // malformed: no accountName
  null,
  'garbage'
];

// only kind:'rce' entries with a non-empty accountName count as live
assert.deepEqual([...liveRceAccountNames(locations)].sort(), ['RCE', 'Team']);
// stored accounts with no live location are orphans; live ones are kept; order preserved
assert.deepEqual(orphanedRceAccounts(['Old', 'RCE', 'Team', 'Stale'], locations), ['Old', 'Stale']);
// the reported bug: location deleted, token left behind → the account must be treated as orphaned
assert.deepEqual(orphanedRceAccounts(['RCE'], [locations[0]]), ['RCE']);
// no locations setting at all (fresh install, or garbage) → everything stored is orphaned
assert.deepEqual(orphanedRceAccounts(['RCE'], undefined), ['RCE']);
assert.deepEqual(orphanedRceAccounts(['RCE'], 'not-a-list'), ['RCE']);
// nothing stored → nothing to prune; matching is exact (case-sensitive), like the store's keys
assert.deepEqual(orphanedRceAccounts([], locations), []);
assert.deepEqual(orphanedRceAccounts(['rce'], locations), ['rce']);

console.log('✅ verify:rce-account-prune — orphan rule holds (live = kind:rce + accountName; exact-name match).');

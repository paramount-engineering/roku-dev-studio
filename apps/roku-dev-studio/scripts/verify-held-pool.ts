/**
 * Pins the window-holds-socket pool rules (main/ipc/held-console-pool.ts) with a fake transport:
 * reuse-if-healthy + hold, single-flight dial (late window join still gets the hold), stale
 * replacement, held no-op disconnect, window disconnect tears down. `npm run verify:held-pool`.
 */
import assert from 'node:assert/strict';
import { createHeldPool, type HeldEntry } from '../main/ipc/held-console-pool';

type Fake = HeldEntry & { open: boolean; id: number };

async function main(): Promise<void> {
  const pool = createHeldPool<Fake>();
  let dials = 0;
  let discarded = 0;
  let torn = 0;
  let release: () => void = () => undefined;
  const ops = (healthyOpen = true) => ({
    healthy: (e: Fake) => healthyOpen && e.open,
    discardStale: () => { discarded++; },
    dial: () => new Promise<{ success: true; entry: Fake }>((res) => {
      dials++;
      const entry: Fake = { open: true, id: dials, heldByWindow: true /* pool must reset this */ };
      release = () => res({ success: true, entry });
    })
  });

  // 1. Two concurrent connects (a Query click + the window) → ONE dial; the joining window still holds.
  const pQuery = pool.connect('k', undefined, ops());
  const pWindow = pool.connect('k', 'window', ops());
  release();
  const [rQuery, rWindow] = await Promise.all([pQuery, pWindow]);
  assert.equal(dials, 1, 'single-flight: one dial for two concurrent connects');
  assert.deepEqual(rQuery, { success: true, connectionId: 'k', reused: false });
  assert.equal(rWindow.success, true);
  assert.equal(pool.entries.get('k')?.heldByWindow, true, 'late window join applies the hold');

  // 2. Healthy entry → reused, no dial; a plain consumer does not clear the hold.
  const r2 = await pool.connect('k', undefined, ops());
  assert.deepEqual(r2, { success: true, connectionId: 'k', reused: true });
  assert.equal(dials, 1);
  assert.equal(pool.entries.get('k')?.heldByWindow, true);

  // 3. Held → a non-window disconnect is a no-op, entry intact.
  const d3 = await pool.disconnect('k', undefined, () => { torn++; });
  assert.deepEqual(d3, { success: true, held: true });
  assert.equal(torn, 0);
  assert.ok(pool.entries.has('k'));

  // 4. Window disconnect → entry leaves the map BEFORE teardown runs; teardown called once.
  const d4 = await pool.disconnect('k', 'window', () => { torn++; assert.equal(pool.entries.has('k'), false, 'removed before teardown'); });
  assert.deepEqual(d4, { success: true });
  assert.equal(torn, 1);

  // 5. Stale (unhealthy) entry → discarded and replaced by a fresh dial; result is not "reused".
  const p5 = pool.connect('k', undefined, ops()); release(); await p5;
  pool.entries.get('k')!.open = false;
  const p6 = pool.connect('k', undefined, ops()); release();
  const r6 = await p6;
  assert.deepEqual(r6, { success: true, connectionId: 'k', reused: false });
  assert.equal(discarded, 1, 'stale entry discarded once');
  assert.equal(pool.entries.get('k')?.id, dials, 'fresh entry installed');
  assert.equal(pool.entries.get('k')?.heldByWindow, false, 'pool resets heldByWindow on a fresh dial');

  // 6. A failed dial leaves no entry.
  const r7 = await pool.connect('x', 'window', { healthy: () => true, dial: async () => ({ success: false, error: 'nope' }) });
  assert.deepEqual(r7, { success: false, error: 'nope' });
  assert.equal(pool.entries.has('x'), false);

  // 7. Custom connectionId (remote pools key by server too).
  const p8 = pool.connect('srv|ip:8080', undefined, { ...ops(), connectionId: 'ip:8080' }); release();
  assert.equal((await p8 as { connectionId: string }).connectionId, 'ip:8080');

  console.log(`verify-held-pool: OK (dials=${dials}, discarded=${discarded}, teardowns=${torn})`);
}

main().catch((e) => { console.error('verify-held-pool: FAIL', e); process.exit(1); });

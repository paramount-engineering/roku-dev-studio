/**
 * Check for shared/auto-connect-store.ts — the remembered-devices list behind Auto Connect.
 * Pins the rules that stop a closed tab from being reconnected mid-scan (and from coming back on
 * the next launch): mutations hit the in-memory list synchronously, writes never interleave and
 * land in call order, dismissal is session-only and cleared by a user connect, and mutations queued
 * before the first load still apply after it. `npm run verify:auto-connect-store`.
 */
import assert from 'node:assert/strict';
import { RememberedDeviceStore } from '../shared/auto-connect-store';

type Entry = { key: string; ip: string };
const keyOf = (e: Entry) => e.key;
const A: Entry = { key: 'serial:A', ip: '192.168.1.11' };
const B: Entry = { key: 'serial:B', ip: '192.168.1.12' };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function fakeIo(initial: Entry[], persistDelays: number[] = []) {
  const writes: Entry[][] = [];
  const completed: Entry[][] = [];
  let n = 0;
  return {
    writes,
    completed,
    io: {
      load: async () => {
        await sleep(5);
        return initial.slice();
      },
      persist: async (list: Entry[]) => {
        writes.push(list);
        await sleep(persistDelays[n++] ?? 0);
        completed.push(list);
      },
      onError: (e: unknown) => {
        throw e;
      },
    },
  };
}

async function main() {
  // 1. Tab closed mid-scan: the removal is visible to the very next (synchronous) reader, before any
  //    setting write has resolved — this is what stops the next SSDP reply from reconnecting.
  {
    const f = fakeIo([A, B]);
    const store = new RememberedDeviceStore<Entry>(keyOf, f.io);
    await store.list();
    store.remove('serial:A');
    assert.deepEqual(store.peek(), [B], 'removal applies to the in-memory list synchronously');
    assert.equal(f.completed.length, 0, 'nothing has been persisted yet');
    await store.flush();
    assert.deepEqual(f.completed.at(-1), [B], 'and the persisted list matches');
  }

  // 2. Interleaving: a slow removal followed by a fast add must still land in call order — the
  //    final persisted list can neither resurrect the removed device nor lose the added one.
  {
    const f = fakeIo([A], [40, 0]);
    const store = new RememberedDeviceStore<Entry>(keyOf, f.io);
    await store.list();
    store.remove('serial:A');
    store.add(B);
    assert.deepEqual(store.peek(), [B]);
    await store.flush();
    assert.deepEqual(f.writes, [[], [B]], 'writes are issued in call order');
    assert.deepEqual(f.completed, [[], [B]], 'and complete in call order despite the slow first write');
  }

  // 3. Mutations queued before the first load apply on top of the loaded list, in order.
  {
    const f = fakeIo([A, B]);
    const store = new RememberedDeviceStore<Entry>(keyOf, f.io);
    store.remove('serial:A'); // cache not loaded yet
    store.add({ key: 'serial:C', ip: '192.168.1.13' });
    await store.flush();
    assert.deepEqual((store.peek() ?? []).map(keyOf), ['serial:B', 'serial:C']);
  }

  // 4. add() de-duplicates by key (an auto-connect re-add of a remembered device is a no-op).
  {
    const f = fakeIo([A]);
    const store = new RememberedDeviceStore<Entry>(keyOf, f.io);
    await store.list();
    store.add({ key: 'serial:A', ip: '10.0.0.9' });
    await store.flush();
    assert.deepEqual(store.peek(), [A], 'same key → unchanged');
    assert.equal(f.writes.length, 1, 'a no-op mutation still writes the (unchanged) snapshot once');
  }

  // 5. Dismissal is session state, independent of the list, cleared by a user connect.
  {
    const store = new RememberedDeviceStore<Entry>(keyOf, fakeIo([]).io);
    assert.equal(store.isDismissed('192.168.1.11'), false);
    store.dismiss('192.168.1.11');
    assert.equal(store.isDismissed('192.168.1.11'), true, 'closed tab → dismissed for the session');
    store.undismiss('192.168.1.11');
    assert.equal(store.isDismissed('192.168.1.11'), false, 'user connected it again → eligible');
  }

  // 6. reset() drops the cache; the next list() reloads and later mutations still queue correctly.
  {
    const f = fakeIo([A]);
    const store = new RememberedDeviceStore<Entry>(keyOf, f.io);
    await store.list();
    store.reset();
    assert.equal(store.peek(), undefined);
    assert.deepEqual(await store.list(), [A]);
  }

  console.log('verify-auto-connect-store: all checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

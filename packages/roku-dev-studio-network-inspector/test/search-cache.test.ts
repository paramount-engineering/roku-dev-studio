/**
 * Unit tests for the incremental Find cache in `NetworkInspectorService.searchEvents`.
 *
 * A captured event is immutable once its detail is available, so a same-term re-search must reuse the
 * memoized per-event result and only pull detail for NEWLY-arrived events — turning the live re-search
 * from O(N) disk reads per incoming request into O(Δ). These tests assert that by counting how many
 * times the (faked) detail store's `get` is called.
 *
 * Run: `npm test -w roku-dev-studio-network-inspector`
 */

import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';

import { NetworkInspectorService } from '../index';
import type { ParsedNetworkEvent } from '../types';
import type { NetworkFindRequest } from '../content-search';

/** A lightweight summary (no body — body lives in the detail store, like the real buffer). */
function summary(id: string, detailAvailable = true): ParsedNetworkEvent {
  return { id, hostname: 'api.example.com', detailAvailable } as ParsedNetworkEvent;
}

/** The full detail record the faked store returns for an id, carrying a response body. */
function detail(id: string, body: string): ParsedNetworkEvent {
  return {
    id,
    hostname: 'api.example.com',
    detailAvailable: true,
    httpResponse: { headers: {}, body, bodyEncoding: 'utf8' }
  } as ParsedNetworkEvent;
}

const req = (query: string): NetworkFindRequest => ({
  terms: [{ id: 't1', query, scopes: ['respBody'], caseSensitive: false, regex: false }]
});

let getCalls = 0;
let detailById: Map<string, ParsedNetworkEvent>;
let svc: NetworkInspectorService;

/** Wire a service with a faked, call-counting detail store and an all-pass device filter. */
function setSummaries(events: ParsedNetworkEvent[]): void {
  (svc as unknown as { eventBuffer: ParsedNetworkEvent[] }).eventBuffer = events;
}

beforeEach(() => {
  getCalls = 0;
  detailById = new Map();
  svc = new NetworkInspectorService({} as never);
  (svc as unknown as { detailStore: unknown }).detailStore = {
    async get(id: string) {
      getCalls++;
      return detailById.get(id) ?? null;
    },
    put(full: ParsedNetworkEvent) {
      detailById.set(full.id, full);
      return true;
    },
    remove(id: string) {
      detailById.delete(id);
    },
    clear() {
      detailById.clear();
    }
  };
  // upsertEvent runs the record-eligibility gate + summary bookkeeping; bypass the gate for the test.
  (svc as unknown as { shouldRecordEvent: () => boolean }).shouldRecordEvent = () => true;
  // Test the cache, not the device-query filter.
  (svc as unknown as { eventMatchesDeviceQuery: () => boolean }).eventMatchesDeviceQuery = () => true;
  // clearEventsForDevices() broadcasts status via a throttled callback; stub it so no timer/IPC fires
  // after the test (the faked listener has no onStatus).
  (svc as unknown as { broadcastStatus: () => void }).broadcastStatus = () => {};
});

describe('searchEvents incremental cache', () => {
  it('only reads NEW events on a same-term re-search', async () => {
    detailById.set('a', detail('a', '{"k":"foo"}'));
    detailById.set('b', detail('b', '{"k":"nope"}'));
    setSummaries([summary('a'), summary('b')]);

    const first = await svc.searchEvents('10.0.0.1', req('foo'));
    assert.equal(getCalls, 2); // both events read from disk
    assert.deepEqual(first.map((m) => m.id), ['a']);

    // A new event arrives; the same search must reuse a+b and only read c.
    detailById.set('c', detail('c', '{"k":"foo again"}'));
    setSummaries([summary('a'), summary('b'), summary('c')]);
    const second = await svc.searchEvents('10.0.0.1', req('foo'));
    assert.equal(getCalls, 3); // +1, not +3
    assert.deepEqual(second.map((m) => m.id).sort(), ['a', 'c']);
  });

  it('invalidates the whole cache when the term set changes', async () => {
    detailById.set('a', detail('a', '{"k":"foo"}'));
    detailById.set('b', detail('b', '{"k":"bar"}'));
    setSummaries([summary('a'), summary('b')]);

    await svc.searchEvents('10.0.0.1', req('foo'));
    assert.equal(getCalls, 2);

    // Different query → signature changes → both events re-read.
    const r = await svc.searchEvents('10.0.0.1', req('bar'));
    assert.equal(getCalls, 4);
    assert.deepEqual(r.map((m) => m.id), ['b']);
  });

  it('does NOT cache an event whose detail is not yet available (avoids a stale miss)', async () => {
    // 'd' exists but its detail hasn't landed yet: detailAvailable=false → searched as summary-only
    // (no body → no match), and must NOT be memoized as a miss.
    detailById.set('d', detail('d', '{"k":"foo"}'));
    setSummaries([summary('d', /* detailAvailable */ false)]);

    const first = await svc.searchEvents('10.0.0.1', req('foo'));
    assert.equal(getCalls, 0); // detail not available → not fetched
    assert.equal(first.length, 0);

    // Detail lands: the same search must now fetch + match it (proving it wasn't cached as a miss).
    setSummaries([summary('d', /* detailAvailable */ true)]);
    const second = await svc.searchEvents('10.0.0.1', req('foo'));
    assert.equal(getCalls, 1);
    assert.deepEqual(second.map((m) => m.id), ['d']);
  });

  it('does NOT cache a miss when detail is flagged available but get() returns null (live race)', async () => {
    // 'e' claims detailAvailable=true, but its body hasn't landed in the store yet (get → null).
    setSummaries([summary('e', /* detailAvailable */ true)]);
    const first = await svc.searchEvents('10.0.0.1', req('foo'));
    assert.equal(getCalls, 1); // attempted the fetch
    assert.equal(first.length, 0); // no body yet → no match, and MUST NOT be memoized as a miss

    // The body lands; the same search must now fetch + match it (proving the miss wasn't cached).
    detailById.set('e', detail('e', '{"k":"foo"}'));
    const second = await svc.searchEvents('10.0.0.1', req('foo'));
    assert.equal(getCalls, 2);
    assert.deepEqual(second.map((m) => m.id), ['e']);
  });

  it('does NOT cache a result when the event is rewritten mid-search (seq changes during get)', async () => {
    detailById.set('g', detail('g', '{"k":"foo"}'));
    setSummaries([summary('g')]);
    const seq = (svc as unknown as { eventSeq: Map<string, number> }).eventSeq;
    seq.set('g', 1);
    // Simulate a concurrent upsert landing DURING the awaited get: bump the event's seq once.
    let raced = false;
    const store = (svc as unknown as { detailStore: { get: (id: string) => Promise<unknown> } }).detailStore;
    store.get = async (id: string) => {
      getCalls++;
      if (!raced) {
        raced = true;
        seq.set(id, 2); // event rewritten mid-read → result must not be memoized
      }
      return detailById.get(id) ?? null;
    };

    const first = await svc.searchEvents('10.0.0.1', req('foo'));
    assert.deepEqual(first.map((m) => m.id), ['g']); // this run still returns the (fresh-enough) match
    const afterFirst = getCalls;
    // Because the result wasn't cached (seq changed mid-search), the next search re-reads 'g'.
    await svc.searchEvents('10.0.0.1', req('foo'));
    assert.equal(getCalls, afterFirst + 1);
  });

  it('invalidates a cached result when the event content is (re)written via upsertEvent', async () => {
    // 'f' searched with detail present but no match yet (body lacks the term) → cached as a miss.
    detailById.set('f', detail('f', '{"k":"nope"}'));
    setSummaries([summary('f')]);
    await svc.searchEvents('10.0.0.1', req('foo'));
    assert.equal(getCalls, 1);

    // A later capture rewrites 'f' with a matching body (e.g. MITM response body arriving late).
    // upsertEvent pushes its own summary, so normalize the buffer back to a single 'f' afterward.
    (svc as unknown as { upsertEvent: (e: ParsedNetworkEvent) => void }).upsertEvent(
      detail('f', '{"k":"foo now"}')
    );
    setSummaries([summary('f')]);
    const r = await svc.searchEvents('10.0.0.1', req('foo'));
    assert.equal(getCalls, 2); // re-read because upsertEvent dropped the stale cache entry
    assert.deepEqual(r.map((m) => m.id), ['f']);
  });

  it('clears the cache when events are cleared', async () => {
    detailById.set('a', detail('a', '{"k":"foo"}'));
    setSummaries([summary('a')]);
    await svc.searchEvents('10.0.0.1', req('foo'));
    assert.equal(getCalls, 1);

    svc.clearEventsForDevices();
    // Re-add the same id and search again — a cleared cache must re-read it.
    setSummaries([summary('a')]);
    await svc.searchEvents('10.0.0.1', req('foo'));
    assert.equal(getCalls, 2);
  });
});

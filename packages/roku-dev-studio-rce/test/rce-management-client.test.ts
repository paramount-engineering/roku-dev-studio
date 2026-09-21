/**
 * Unit tests for RceManagementClient's request/response handling — no live RCE account exists
 * to test against yet (see design doc), so these stub `global.fetch` and focus on the risk this
 * class actually carries: URL/query building, auth headers, snake_case->camelCase mapping, and
 * that a JSON-array response never gets spread into `{success, ...}` (see the bug this caught
 * during initial implementation — spreading an array numbers its indices as object keys instead
 * of producing a `devices` array).
 *
 * Run: `npm test -w roku-dev-studio-rce`
 */

import { describe, it, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';

import { RceManagementClient } from '../rce-management-client';

const originalFetch = globalThis.fetch;

function stubFetch(handler: (url: URL, init: RequestInit) => { status: number; body: unknown }) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(String(input));
    const { status, body } = handler(url, init ?? {});
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

describe('RceManagementClient', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends the bearer token and maps a raw array response to `devices`', async () => {
    let seenAuth: string | null = null;
    let seenQuery: string | null = null;
    stubFetch((url, init) => {
      seenAuth = (init.headers as Record<string, string>).Authorization;
      seenQuery = url.search;
      return {
        status: 200,
        body: [
          { id: 74, device_type: 'tv', name: 'Regression Test', created_at: '2026-01-01T00:00:00Z', status: 'shutdown', snapshots: [215], serial_number: 'XY0000FAKESN', running_device: null }
        ]
      };
    });

    const client = new RceManagementClient('tok_123');
    const result = await client.listDevices({ items: 50, page: 1, order: 'asc' });

    assert.equal(seenAuth, 'Bearer tok_123');
    assert.equal(seenQuery, '?items=50&page=1&order=asc');
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.devices.length, 1);
    assert.equal(result.devices[0].id, 74);
    assert.equal(result.devices[0].deviceType, 'tv');
    assert.equal(result.devices[0].serialNumber, 'XY0000FAKESN');
    assert.equal(result.devices[0].status, 'shutdown');
  });

  it('unwraps a `{items: [...]}` list shape the same as a raw array', async () => {
    stubFetch(() => ({ status: 200, body: { items: [{ id: 1, device_type: 'stb', name: 'X', created_at: 't', status: 'running', snapshots: [] }] } }));
    const client = new RceManagementClient('tok');
    const result = await client.listSnapshots(1) as unknown as { success: true; snapshots: unknown[] };
    // listSnapshots against a devices-shaped fixture just proves the unwrap path, not schema validity.
    assert.equal(Array.isArray(result.snapshots), true);
  });

  it('maps a 401 to a friendly, non-throwing error', async () => {
    stubFetch(() => ({ status: 401, body: { error: 'invalid token' } }));
    const client = new RceManagementClient('bad-token');
    const result = await client.getDevice(1);
    assert.equal(result.success, false);
    if (result.success) return;
    assert.equal(result.error, 'invalid token');
    assert.equal(result.statusCode, 401);
  });

  it('falls back to a status-code message when the error body has no `error`/`detail`', async () => {
    stubFetch(() => ({ status: 409, body: {} }));
    const client = new RceManagementClient('tok');
    const result = await client.stopDevice(1);
    assert.equal(result.success, false);
    if (result.success) return;
    assert.match(result.error, /Conflict/);
  });

  it('posts snake_case fields for startDevice', async () => {
    let seenBody: unknown = null;
    stubFetch((_url, init) => {
      seenBody = JSON.parse(String(init.body));
      return { status: 200, body: { id: 1, device_type: 'tv', name: 'x', created_at: 't', status: 'pending', snapshots: [] } };
    });
    const client = new RceManagementClient('tok');
    await client.startDevice(1, { snapshotId: 215, firmwareVersionId: 'rce-fw:15.2.4-tv_prod', maxRuntime: 3600 });
    assert.deepEqual(seenBody, {
      snapshot_id: 215,
      firmware_version_id: 'rce-fw:15.2.4-tv_prod',
      max_runtime: 3600
    });
  });

  it('maps a snapshot using the real OpenAPI field names, not the earlier guessed ones', async () => {
    stubFetch(() => ({
      status: 200,
      body: [
        {
          id: 5,
          created_at: 't',
          name: 'live',
          note: 'a note',
          firmware_version_display_name: '15.2.4 TV',
          firmware_version_id: 'rce-fw:15.2.4-tv_prod',
          properties: { foo: 'bar' },
          live: true,
          base: false
        }
      ]
    }));
    const client = new RceManagementClient('tok');
    const result = await client.listSnapshots(1);
    assert.equal(result.success, true);
    if (!result.success) return;
    const snapshot = result.snapshots[0];
    assert.equal(snapshot.note, 'a note');
    assert.equal(snapshot.firmwareVersionDisplayName, '15.2.4 TV');
    assert.equal(snapshot.firmwareVersionId, 'rce-fw:15.2.4-tv_prod');
    assert.deepEqual(snapshot.properties, { foo: 'bar' });
  });

  it('maps user usage buckets from snake_case', async () => {
    let seenQuery: string | null = null;
    stubFetch((url) => {
      seenQuery = url.search;
      return {
        status: 200,
        body: {
          start: '2026-01-01T00:00:00Z',
          end: '2026-01-08T00:00:00Z',
          interval: '24h',
          buckets: [{ start: '2026-01-01T00:00:00Z', stop: '2026-01-02T00:00:00Z', value: 120 }]
        }
      };
    });
    const client = new RceManagementClient('tok');
    const result = await client.getUserUsage({ start: '2026-01-01T00:00:00Z', end: '2026-01-08T00:00:00Z', interval: '24h' });
    assert.equal(seenQuery, '?start=2026-01-01T00%3A00%3A00Z&end=2026-01-08T00%3A00%3A00Z&interval=24h');
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.usage.buckets[0].minutes, 120);
  });
});

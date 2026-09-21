/**
 * Unit tests for rceSideload/rceDeleteSideload against a stubbed `global.fetch` — no live instance
 * or real HTTPS server needed. Covers the two-round Digest handshake (bodyless challenge probe,
 * then the real authenticated request) and the `X-Authorization` + `Authorization: Digest` header
 * combination confirmed live 2026-09-12 (see rce-sideload.ts's header comment).
 *
 * Run: `npm test -w roku-dev-studio-rce`
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';

import { rceSideload, rceDeleteSideload } from '../rce-sideload';

type FetchCall = { url: string; init: RequestInit };

const originalFetch = global.fetch;
let calls: FetchCall[];
let responses: Array<{ status: number; body: string; headers?: Record<string, string> }>;

function installFakeFetch() {
  calls = [];
  responses = [];
  global.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('No more fake responses queued');
    return {
      status: next.status,
      headers: { get: (name: string) => next.headers?.[name.toLowerCase()] ?? null },
      text: async () => next.body
    } as unknown as Response;
  }) as typeof fetch;
}

beforeEach(installFakeFetch);
afterEach(() => {
  global.fetch = originalFetch;
});

const OPTS = { instanceApiUrl: 'https://device.rce.roku.com/instance/abc', rceToken: 'account-token', devPassword: 'dev-pass' };
const CHALLENGE = 'Digest qop="auth", realm="rokudev", nonce="12345"';

describe('rceSideload', () => {
  it('probes without a body, then retries with both X-Authorization and a Digest response', async () => {
    responses.push({ status: 401, body: '', headers: { 'www-authenticate': CHALLENGE } });
    responses.push({ status: 200, body: 'Install Success' });

    const result = await rceSideload(OPTS, Buffer.from('zipbytes'), 'channel.zip');

    assert.equal(result.success, true);
    assert.equal(calls.length, 2);

    const [probe, authed] = calls;
    assert.equal(probe.url, 'https://device.rce.roku.com/instance/abc/sideload/plugin_install');
    assert.equal((probe.init.headers as Record<string, string>)['X-Authorization'], 'Bearer account-token');
    assert.equal(probe.init.body, undefined);

    const authedHeaders = authed.init.headers as Record<string, string>;
    assert.equal(authedHeaders['X-Authorization'], 'Bearer account-token');
    assert.match(authedHeaders['Authorization'], /^Digest username="rokudev", realm="rokudev", nonce="12345"/);
    assert.ok(authed.init.body, 'authenticated request must carry the multipart body');
  });

  it('parses an Install Failure body into a non-success result with the device-reported reason', async () => {
    responses.push({ status: 401, body: '', headers: { 'www-authenticate': CHALLENGE } });
    responses.push({ status: 200, body: 'Install Failure: Compile error on line 4' });

    const result = await rceSideload(OPTS, Buffer.from('zip'), 'c.zip');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Compile error on line 4');
  });

  it('treats a 401 on the authenticated round as a wrong-password auth failure', async () => {
    responses.push({ status: 401, body: '', headers: { 'www-authenticate': CHALLENGE } });
    responses.push({ status: 401, body: '' });

    const result = await rceSideload(OPTS, Buffer.from('zip'), 'c.zip');
    assert.equal(result.success, false);
    assert.equal(result.authFailed, true);
  });

  it('fails cleanly when the device never offers a Digest challenge', async () => {
    responses.push({ status: 401, body: 'no challenge here' });

    const result = await rceSideload(OPTS, Buffer.from('zip'), 'c.zip');
    assert.equal(result.success, false);
  });
});

describe('rceDeleteSideload', () => {
  it('sends mysubmit=Delete with a placeholder archive field, not a file', async () => {
    responses.push({ status: 401, body: '', headers: { 'www-authenticate': CHALLENGE } });
    responses.push({ status: 200, body: 'Delete Success' });

    const result = await rceDeleteSideload(OPTS);
    assert.equal(result.success, true);

    const bodyText = calls[1].init.body!.toString();
    assert.match(bodyText, /name="mysubmit"/);
    assert.match(bodyText, /Delete/);
    assert.match(bodyText, /name="archive"/);
    assert.doesNotMatch(bodyText, /filename=/);
  });
});

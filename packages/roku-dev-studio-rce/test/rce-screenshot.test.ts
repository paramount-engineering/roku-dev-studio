/**
 * Unit tests for rceCaptureScreenshot against a stubbed `global.fetch` — mirrors
 * rce-sideload.test.ts's fake-fetch pattern, extended with `arrayBuffer()` since the screenshot
 * download step reads a binary JPEG body (the same "res.text() corrupts binary" pitfall
 * rce-ecp.test.ts's getIcon tests guard against).
 *
 * Run: `npm test -w roku-dev-studio-rce`
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';

import { rceCaptureScreenshot } from '../rce-sideload';

type FetchCall = { url: string; init: RequestInit };

const originalFetch = global.fetch;
let calls: FetchCall[];
let responses: Array<{ status: number; body: string | Uint8Array; headers?: Record<string, string> }>;

function installFakeFetch() {
  calls = [];
  responses = [];
  global.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('No more fake responses queued');
    const bodyText = typeof next.body === 'string' ? next.body : '';
    const bodyBytes = typeof next.body === 'string' ? Buffer.from(next.body) : Buffer.from(next.body);
    return {
      status: next.status,
      headers: { get: (name: string) => next.headers?.[name.toLowerCase()] ?? null },
      text: async () => bodyText,
      arrayBuffer: async () => bodyBytes.buffer.slice(bodyBytes.byteOffset, bodyBytes.byteOffset + bodyBytes.byteLength)
    } as unknown as Response;
  }) as typeof fetch;
}

beforeEach(installFakeFetch);
afterEach(() => {
  global.fetch = originalFetch;
});

const OPTS = { instanceApiUrl: 'https://device.rce.roku.com/instance/abc', rceToken: 'account-token', devPassword: 'dev-pass', waitAfterTriggerMs: 0, retryWaitMs: 0 };
const CHALLENGE = 'Digest qop="auth", realm="rokudev", nonce="12345"';
const PNG_BYTES = new Uint8Array(Array(1200).fill(1));

describe('rceCaptureScreenshot', () => {
  it('triggers via plugin_inspect, extracts the image path, and downloads the binary body', async () => {
    // Trigger round (probe + authed POST)
    responses.push({ status: 401, body: '', headers: { 'www-authenticate': CHALLENGE } });
    responses.push({ status: 200, body: `<a href="pkgs/dev.jpg?t=123">click</a>` });
    // Download round (probe + authed GET)
    responses.push({ status: 401, body: '', headers: { 'www-authenticate': CHALLENGE } });
    responses.push({ status: 200, body: PNG_BYTES });

    const result = await rceCaptureScreenshot(OPTS);

    assert.equal(result.success, true);
    assert.equal(result.imageBuffer?.length, PNG_BYTES.length);
    assert.equal(calls.length, 4);
    assert.equal(calls[0].url, 'https://device.rce.roku.com/instance/abc/sideload/plugin_inspect');
    assert.equal(calls[2].url, 'https://device.rce.roku.com/instance/abc/sideload/pkgs/dev.jpg?t=123');
  });

  it('fails cleanly when the trigger response has no embedded image URL', async () => {
    responses.push({ status: 401, body: '', headers: { 'www-authenticate': CHALLENGE } });
    responses.push({ status: 200, body: 'no image here' });

    const result = await rceCaptureScreenshot(OPTS);
    assert.equal(result.success, false);
    assert.match(result.error ?? '', /No screenshot URL/);
  });

  it('treats a 401 on the authenticated trigger as an auth failure', async () => {
    responses.push({ status: 401, body: '', headers: { 'www-authenticate': CHALLENGE } });
    responses.push({ status: 401, body: '' });

    const result = await rceCaptureScreenshot(OPTS);
    assert.equal(result.success, false);
    assert.equal(result.authFailed, true);
  });

  it('retries the download until the image is a plausible size, then succeeds', async () => {
    responses.push({ status: 401, body: '', headers: { 'www-authenticate': CHALLENGE } });
    responses.push({ status: 200, body: `<a href="pkgs/dev.jpg?t=1">x</a>` });
    // First download attempt: too small (device hasn't written the file yet)
    responses.push({ status: 401, body: '', headers: { 'www-authenticate': CHALLENGE } });
    responses.push({ status: 200, body: new Uint8Array(10) });
    // Retry: real image
    responses.push({ status: 401, body: '', headers: { 'www-authenticate': CHALLENGE } });
    responses.push({ status: 200, body: PNG_BYTES });

    const result = await rceCaptureScreenshot(OPTS);
    assert.equal(result.success, true);
    assert.equal(result.imageBuffer?.length, PNG_BYTES.length);
  });
});

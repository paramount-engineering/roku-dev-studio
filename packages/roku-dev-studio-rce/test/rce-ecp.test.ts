/**
 * Unit tests for RceEcpClient — the ECP-over-instance-proxy calls (keypress/query/deeplink/
 * inputText). Stubs `global.fetch`; focuses on URL construction and the sequential-keypress
 * inputText loop stopping on the first failure (the same correctness property the local
 * `ecp.ts#inputText` has, and RCE re-implements independently — see its file header).
 *
 * Run: `npm test -w roku-dev-studio-rce`
 */

import { describe, it, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';

import { RceEcpClient, normalizeInstanceApiUrl } from '../rce-ecp';

const originalFetch = globalThis.fetch;

function stubFetch(handler: (url: string, init: RequestInit) => { status: number; body?: string | Uint8Array; headers?: Record<string, string> }) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const { status, body, headers } = handler(String(input), init ?? {});
    return new Response(body ?? '', { status, headers });
  }) as typeof fetch;
}

describe('RceEcpClient', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('keypress hits the confirmed-live api/v0/input route with the bearer token', async () => {
    let seenUrl = '';
    let seenAuth = '';
    let seenMethod = '';
    stubFetch((url, init) => {
      seenUrl = url;
      seenAuth = (init.headers as Record<string, string>).Authorization;
      seenMethod = init.method ?? '';
      return { status: 200 };
    });
    const client = new RceEcpClient('device.rce.roku.com/instance/abc-123', 'tok_abc');
    const result = await client.keypress('Home');
    assert.equal(result.success, true);
    assert.equal(seenUrl, 'https://device.rce.roku.com/instance/abc-123/api/v0/input/keypress/Home');
    assert.equal(seenAuth, 'Bearer tok_abc');
    assert.equal(seenMethod, 'POST');
  });

  // Regression test for a confirmed production bug (2026-09-11): the real API's
  // `instance_api_url` includes an `https://` prefix, contradicting the OpenAPI schema's field
  // description. Naively prepending `https://` on top produced `https://https://...`, which
  // Node's `fetch` resolves to host `https` — `getaddrinfo ENOTFOUND https` — failing every RCE
  // ECP call in production, not just a theoretical edge case.
  it('does not double the protocol when instanceApiUrl already includes one', async () => {
    let seenUrl = '';
    stubFetch((url) => {
      seenUrl = url;
      return { status: 200 };
    });
    const client = new RceEcpClient('https://device.rce.roku.com/instance/abc-123', 'tok');
    await client.keypress('Home');
    assert.equal(seenUrl, 'https://device.rce.roku.com/instance/abc-123/api/v0/input/keypress/Home');
  });

  it('normalizeInstanceApiUrl strips http(s):// and ws(s):// prefixes, and passes through a bare host+path', () => {
    assert.equal(normalizeInstanceApiUrl('https://device.rce.roku.com/instance/abc'), 'device.rce.roku.com/instance/abc');
    assert.equal(normalizeInstanceApiUrl('wss://device.rce.roku.com/instance/abc'), 'device.rce.roku.com/instance/abc');
    assert.equal(normalizeInstanceApiUrl('device.rce.roku.com/instance/abc'), 'device.rce.roku.com/instance/abc');
  });

  // Confirmed live 2026-09-11: there is no dedicated `/ecp1` raw-ECP proxy at all — every
  // non-keypress ECP call goes through the generic port-proxy route, with 8060 (the device's ECP
  // port) as the target. `GET .../api/v0/ports/8060/http/query/device-info` returned a real
  // device-info XML body against a live running instance.
  it('query hits the generic port-8060 HTTP proxy, not a dedicated /ecp1 route', async () => {
    let seenUrl = '';
    stubFetch((url) => {
      seenUrl = url;
      return { status: 200, body: '<device-info/>' };
    });
    const client = new RceEcpClient('device.rce.roku.com/instance/abc-123', 'tok');
    await client.query('/query/device-info');
    assert.equal(seenUrl, 'https://device.rce.roku.com/instance/abc-123/api/v0/ports/8060/http/query/device-info');
  });

  it('inputText sends one keypress per character and stops at the first failure', async () => {
    const seenKeys: string[] = [];
    let callCount = 0;
    stubFetch((url) => {
      callCount += 1;
      const match = url.match(/keypress\/(.+)$/);
      seenKeys.push(match ? decodeURIComponent(match[1]) : '');
      // Fail on the 3rd character to prove the loop stops instead of sending the rest.
      return { status: callCount === 3 ? 500 : 200 };
    });
    const client = new RceEcpClient('device.rce.roku.com/instance/abc', 'tok');
    const result = await client.inputText('abcdef', { delayMs: 0 });
    assert.equal(result.success, false);
    assert.equal(seenKeys.length, 3);
    assert.deepEqual(seenKeys, ['Lit_a', 'Lit_b', 'Lit_c']);
  });

  it('inputText on an empty string is a no-op success', async () => {
    let called = false;
    stubFetch(() => {
      called = true;
      return { status: 200 };
    });
    const client = new RceEcpClient('device.rce.roku.com/instance/abc', 'tok');
    const result = await client.inputText('', { delayMs: 0 });
    assert.equal(result.success, true);
    assert.equal(called, false);
  });

  // Regression test: getIcon used to reuse `query()`, whose `res.text()` corrupts a binary image
  // body instead of producing the `dataUrl` the renderer's icon-loading code expects.
  it('getIcon hits the port-8060 HTTP proxy and base64-encodes the binary body into a data URL', async () => {
    let seenUrl = '';
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    stubFetch((url) => {
      seenUrl = url;
      return { status: 200, body: pngBytes, headers: { 'content-type': 'image/png' } };
    });
    const client = new RceEcpClient('device.rce.roku.com/instance/abc-123', 'tok');
    const result = await client.getIcon('dev');
    assert.equal(seenUrl, 'https://device.rce.roku.com/instance/abc-123/api/v0/ports/8060/http/query/icon/dev');
    assert.equal(result.success, true);
    assert.equal(result.mimeType, 'image/png');
    assert.equal(result.dataUrl, `data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`);
  });

  it('getIcon fails cleanly on a non-image 200 response instead of returning a broken image', async () => {
    stubFetch(() => ({ status: 200, body: '<html>not found</html>', headers: { 'content-type': 'text/html' } }));
    const client = new RceEcpClient('device.rce.roku.com/instance/abc', 'tok');
    const result = await client.getIcon('dev');
    assert.equal(result.success, false);
    assert.match(result.error ?? '', /non-image/);
  });

  it('getHardwareImage resolves the UPnP iconList path from the ECP root, then downloads it', async () => {
    const seenUrls: string[] = [];
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    stubFetch((url) => {
      seenUrls.push(url);
      if (url.endsWith('/http/')) {
        return {
          status: 200,
          body: '<root><device><iconList><icon><url>pkg/images/hardware.png</url></icon></iconList></device></root>',
          headers: { 'content-type': 'text/xml' }
        };
      }
      return { status: 200, body: pngBytes, headers: { 'content-type': 'image/png' } };
    });
    const client = new RceEcpClient('device.rce.roku.com/instance/abc-123', 'tok');
    const result = await client.getHardwareImage();
    assert.equal(seenUrls[0], 'https://device.rce.roku.com/instance/abc-123/api/v0/ports/8060/http/');
    assert.equal(seenUrls[1], 'https://device.rce.roku.com/instance/abc-123/api/v0/ports/8060/http/pkg/images/hardware.png');
    assert.equal(result.success, true);
    assert.equal(result.dataUrl, `data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`);
  });

  // Regression test: a freshly-started RCE instance's own ECP port can take a few seconds to come
  // up, and Roku's gateway 503s ("upstream connect error ... Connection refused") during that
  // window instead of queuing the request — confirmed live 2026-09-16 immediately after connecting
  // to a just-started instance. A bounded retry should ride this out instead of surfacing it.
  it('retries a 503 and succeeds once the gateway recovers', async () => {
    let callCount = 0;
    stubFetch(() => {
      callCount += 1;
      return callCount < 3 ? { status: 503, body: 'upstream connect error' } : { status: 200, body: '<device-info/>' };
    });
    const client = new RceEcpClient('device.rce.roku.com/instance/abc', 'tok');
    const result = await client.query('/query/device-info', { retryWaitMs: 0 });
    assert.equal(result.success, true);
    assert.equal(callCount, 3);
  });

  it('gives up after the retry budget on a persistent 503', async () => {
    let callCount = 0;
    stubFetch(() => {
      callCount += 1;
      return { status: 503, body: 'upstream connect error' };
    });
    const client = new RceEcpClient('device.rce.roku.com/instance/abc', 'tok');
    const result = await client.query('/query/device-info', { retryWaitMs: 0 });
    assert.equal(result.success, false);
    assert.match(result.error ?? '', /HTTP 503/);
    assert.equal(callCount, 5); // initial attempt + 4 retries
  });

  it('does not retry a non-503 error status', async () => {
    let callCount = 0;
    stubFetch(() => {
      callCount += 1;
      return { status: 404 };
    });
    const client = new RceEcpClient('device.rce.roku.com/instance/abc', 'tok');
    const result = await client.query('/query/device-info', { retryWaitMs: 0 });
    assert.equal(result.success, false);
    assert.equal(callCount, 1);
  });

  it('getHardwareImage falls back to the default filename when the root has no iconList', async () => {
    const seenUrls: string[] = [];
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    stubFetch((url) => {
      seenUrls.push(url);
      if (url.endsWith('/http/')) {
        return { status: 200, body: '<root><device/></root>', headers: { 'content-type': 'text/xml' } };
      }
      return { status: 200, body: pngBytes, headers: { 'content-type': 'image/png' } };
    });
    const client = new RceEcpClient('device.rce.roku.com/instance/abc', 'tok');
    const result = await client.getHardwareImage();
    assert.equal(seenUrls[1], 'https://device.rce.roku.com/instance/abc/api/v0/ports/8060/http/device-image.png');
    assert.equal(result.success, true);
  });
});

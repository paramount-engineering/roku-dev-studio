/**
 * Unit tests for the passive plaintext-HTTP (port 80) reassembler (`../http-stream-parser.ts`).
 * Focus: the proxy-embedded-target unwrap (some hotspot/captive-portal proxies rewrite the
 * request target to carry the real destination as a `;https://…` matrix param) — a regression
 * here silently shows the proxy's own address as the "real" host/URL for every proxied request.
 *
 * Run: `npm test -w roku-dev-studio-network-inspector`
 */

import { afterEach, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import { feedTcpStream, resetHttpStreams } from '../http-stream-parser';

const DEVICE_IP = '10.0.0.5';
const PROXY_IP = '192.168.11.105';

function crlf(lines: string[]): Buffer {
  return Buffer.from(lines.join('\r\n'), 'utf8');
}

/** Feed one full request/response transaction over a single (device, proxy) flow and return the
 *  emitted events (the response segment is the one that completes pairing). */
function runTransaction(requestLine: string, requestHeaders: string[], response: Buffer) {
  resetHttpStreams();
  const request = crlf([requestLine, ...requestHeaders, '', '']);
  const reqEvents = feedTcpStream({
    deviceIp: DEVICE_IP,
    srcIp: DEVICE_IP,
    dstIp: PROXY_IP,
    srcPort: 50000,
    dstPort: 80,
    payload: request,
    timestamp: '2026-08-04T00:00:00.000Z'
  });
  const resEvents = feedTcpStream({
    deviceIp: DEVICE_IP,
    srcIp: PROXY_IP,
    dstIp: DEVICE_IP,
    srcPort: 80,
    dstPort: 50000,
    payload: response,
    timestamp: '2026-08-04T00:00:00.010Z'
  });
  return { reqEvents, resEvents };
}

describe('feedTcpStream — proxy-embedded target unwrap', () => {
  afterEach(() => resetHttpStreams());

  it('unwraps a `;https://…` matrix-param target to the real destination', () => {
    const response = crlf([
      'HTTP/1.1 200 OK',
      'Content-Type: application/javascript',
      'Content-Length: 13',
      '',
      'console.log()'
    ]);
    const { reqEvents, resEvents } = runTransaction(
      'GET http://192.168.11.105:8080/;https://tags.tiqcdn.com/utag/cbsi/pplusintl-roku/dev/utag.js HTTP/1.1',
      ['Host: 192.168.11.105:8080'],
      response
    );
    assert.equal(reqEvents.length, 0); // queued — pairing completes on the response
    assert.equal(resEvents.length, 1);
    const ev = resEvents[0];
    assert.equal(ev.httpRequest?.url, 'https://tags.tiqcdn.com/utag/cbsi/pplusintl-roku/dev/utag.js');
    // The real target's authority wins over the Host header, which mirrored the proxy's address.
    assert.equal(ev.hostname, 'tags.tiqcdn.com');
  });

  it('leaves an ordinary absolute-form proxy request (no embedded target) unchanged', () => {
    const response = crlf(['HTTP/1.1 204 No Content', '', '']);
    const { resEvents } = runTransaction(
      'GET https://example.com/path HTTP/1.1',
      ['Host: example.com'],
      response
    );
    assert.equal(resEvents.length, 1);
    assert.equal(resEvents[0].httpRequest?.url, 'https://example.com/path');
    assert.equal(resEvents[0].hostname, 'example.com');
  });

  it('does not mangle a legitimate matrix param that is not an embedded URL', () => {
    // e.g. an old-style `;jsessionid=` segment — must NOT be treated as a proxy-embedded target.
    const response = crlf(['HTTP/1.1 200 OK', 'Content-Length: 0', '', '']);
    const { resEvents } = runTransaction(
      'GET /cart;jsessionid=ABC123 HTTP/1.1',
      ['Host: shop.example.com'],
      response
    );
    assert.equal(resEvents.length, 1);
    assert.equal(resEvents[0].httpRequest?.url, '/cart;jsessionid=ABC123');
    assert.equal(resEvents[0].hostname, 'shop.example.com'); // falls back to Host, as before
  });

  it('path-only requests keep resolving the hostname from the Host header', () => {
    const response = crlf(['HTTP/1.1 200 OK', 'Content-Length: 0', '', '']);
    const { resEvents } = runTransaction(
      'GET /apps/user/ip.json HTTP/1.1',
      ['Host: www.intl.paramountplus.com'],
      response
    );
    assert.equal(resEvents.length, 1);
    assert.equal(resEvents[0].httpRequest?.url, '/apps/user/ip.json');
    assert.equal(resEvents[0].hostname, 'www.intl.paramountplus.com');
  });
});

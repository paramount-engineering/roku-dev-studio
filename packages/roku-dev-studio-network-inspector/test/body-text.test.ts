/**
 * `decodeBase64Text` / `textBodyOf`: base64 bodies that are really text must decode on every surface
 * (detail panes, Copy, Find, Edit & Resend); genuine binary must not.
 *
 * Run: `npm test -w roku-dev-studio-network-inspector`
 */
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import { decodeBase64Text, textBodyOf } from '../body-text';

const b64 = (s: string | Uint8Array): string => Buffer.from(s).toString('base64');
const json = '{"items":[{"id":1,"name":"Émilie ✓"}],"ok":true}\n';

describe('decodeBase64Text', () => {
  it('decodes UTF-8 text, including multi-byte characters', () => {
    assert.equal(decodeBase64Text(b64(json)), json);
  });
  it('tolerates whitespace-wrapped base64 (HAR exporters line-wrap)', () => {
    const wrapped = b64(json).replace(/(.{20})/g, '$1\n');
    assert.equal(decodeBase64Text(wrapped), json);
  });
  it('rejects invalid UTF-8 (PNG header)', () => {
    assert.equal(decodeBase64Text(b64(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))), null);
  });
  it('rejects valid UTF-8 that carries NUL / control bytes', () => {
    assert.equal(decodeBase64Text(b64('abc\x00def')), null);
    assert.equal(decodeBase64Text(b64('\x01\x02')), null);
  });
  it('keeps tabs, newlines and ANSI escapes', () => {
    const s = 'a\tb\r\nc\x1b[31mred\x1b[0m';
    assert.equal(decodeBase64Text(b64(s)), s);
  });
  it('rejects malformed base64 and empty input', () => {
    assert.equal(decodeBase64Text('%%%not base64%%%'), null);
    assert.equal(decodeBase64Text(''), null);
  });
});

describe('textBodyOf', () => {
  it('passes text bodies through untouched', () => {
    assert.equal(textBodyOf({ body: json, bodyEncoding: 'text' }), json);
    assert.equal(textBodyOf({ body: json }), json);
  });
  it('decodes a base64 body tagged application/json', () => {
    assert.equal(textBodyOf({ body: b64(json), bodyEncoding: 'base64', contentType: 'application/json' }), json);
    assert.equal(
      textBodyOf({ body: b64(json), bodyEncoding: 'base64', headers: { 'Content-Type': 'application/json; charset=utf-8' } }),
      json
    );
  });
  it('skips media MIME types without decoding', () => {
    assert.equal(textBodyOf({ body: b64(json), bodyEncoding: 'base64', contentType: 'image/png' }), null);
    assert.equal(textBodyOf({ body: b64(json), bodyEncoding: 'base64' }, 'video/mp4'), null);
  });
  it('returns null for genuine binary and for no body', () => {
    assert.equal(
      textBodyOf({ body: b64(new Uint8Array([0xff, 0xfe, 0x00, 0x01])), bodyEncoding: 'base64', contentType: 'application/octet-stream' }),
      null
    );
    assert.equal(textBodyOf({ bodyEncoding: 'base64' }), null);
    assert.equal(textBodyOf(undefined), null);
  });
});

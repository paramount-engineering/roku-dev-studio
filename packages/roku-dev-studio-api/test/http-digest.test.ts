/**
 * Unit tests for HTTP Digest helpers (`lib/http-digest.ts`).
 * Run: `npm test -w roku-dev-studio-api`
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

const {
  parseDigestChallenge,
  buildDigestAuthorizationHeader,
  findDigestChallengeHeader
} = require('../lib/http-digest');

describe('parseDigestChallenge', () => {
  it('parses quoted digest parameters', () => {
    const params = parseDigestChallenge(
      'Digest realm="rokudev", qop="auth", nonce="abc123", opaque="opaque1", algorithm=MD5'
    );
    assert.equal(params.realm, 'rokudev');
    assert.equal(params.qop, 'auth');
    assert.equal(params.nonce, 'abc123');
    assert.equal(params.opaque, 'opaque1');
    assert.equal(params.algorithm, 'MD5');
  });
});

describe('findDigestChallengeHeader', () => {
  it('extracts Digest when Basic is listed first', () => {
    const header = findDigestChallengeHeader([
      'Basic realm="rokudev"',
      'Digest realm="rokudev", qop="auth", nonce="abc"'
    ]);
    assert.match(header ?? '', /^Digest /i);
    assert.match(header ?? '', /nonce="abc"/);
  });
});

describe('buildDigestAuthorizationHeader', () => {
  it('builds a deterministic auth header with qop=auth', () => {
    const header = buildDigestAuthorizationHeader({
      username: 'rokudev',
      password: 'secret',
      method: 'GET',
      uri: '/',
      challenge: { realm: 'rokudev', nonce: 'deadbeef', qop: 'auth' },
      cnonce: 'c0ffee'
    });
    assert.match(header, /^Digest /);
    assert.match(header, /username="rokudev"/);
    assert.match(header, /realm="rokudev"/);
    assert.match(header, /nonce="deadbeef"/);
    assert.match(header, /uri="\//);
    assert.match(header, /qop=auth/);
    assert.match(header, /nc=00000001/);
    assert.match(header, /cnonce="c0ffee"/);
    assert.match(header, /response="[a-f0-9]{32}"/);
  });
});

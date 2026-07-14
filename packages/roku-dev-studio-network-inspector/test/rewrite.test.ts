/**
 * Unit tests for the pure rewrite helpers (`../rewrite.ts`) and for `resolveTrafficDecision`
 * surfacing `rewrite` ops (`../types.ts`). The MITM proxy composes these on the live request/response
 * path, so a regression here silently mis-rewrites real device traffic.
 *
 * Run: `npm test -w roku-dev-studio-network-inspector`
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  opsFor,
  hasBodyReplace,
  applyRequestUrl,
  applyHeaderOps,
  statusOverride,
  applyBodyReplace
} from '../rewrite';
import { resolveTrafficDecision } from '../types';
import type { RewriteOp } from '../types';

const req = (type: RewriteOp['type'], extra: Partial<RewriteOp> = {}): RewriteOp => ({ target: 'request', type, ...extra });
const res = (type: RewriteOp['type'], extra: Partial<RewriteOp> = {}): RewriteOp => ({ target: 'response', type, ...extra });

describe('opsFor / hasBodyReplace', () => {
  it('splits by target', () => {
    const ops = [req('set-host', { value: 'a' }), res('set-status', { value: '500' })];
    assert.equal(opsFor(ops, 'request').length, 1);
    assert.equal(opsFor(ops, 'response').length, 1);
    assert.equal(opsFor(undefined, 'request').length, 0);
  });
  it('detects body-replace ops', () => {
    assert.equal(hasBodyReplace([req('body-replace', { match: 'a' })]), true);
    assert.equal(hasBodyReplace([req('body-replace')]), false); // no match string
    assert.equal(hasBodyReplace([req('set-host', { value: 'x' })]), false);
  });
});

describe('applyRequestUrl', () => {
  it('redirects host (map remote), preserving path + query', () => {
    const out = applyRequestUrl([req('set-host', { value: 'localhost:8080' })], 'https://api.prod.com/v1/play?x=1');
    assert.equal(out, 'https://localhost:8080/v1/play?x=1');
  });
  it('set-host without port clears the port', () => {
    const out = applyRequestUrl([req('set-host', { value: 'staging.example.com' })], 'https://api.prod.com:443/a');
    assert.equal(out, 'https://staging.example.com/a');
  });
  it('set-path replaces path and can carry its own query', () => {
    assert.equal(applyRequestUrl([req('set-path', { value: '/v2/stop' })], 'https://h.com/v1/play?x=1'), 'https://h.com/v2/stop?x=1');
    assert.equal(applyRequestUrl([req('set-path', { value: '/v2?a=b' })], 'https://h.com/v1?x=1'), 'https://h.com/v2?a=b');
  });
  it('set-query adds/replaces and remove-query deletes', () => {
    assert.equal(applyRequestUrl([req('set-query', { match: 'env', value: 'stage' })], 'https://h.com/p'), 'https://h.com/p?env=stage');
    assert.equal(applyRequestUrl([req('set-query', { match: 'env', value: 'stage' })], 'https://h.com/p?env=prod'), 'https://h.com/p?env=stage');
    assert.equal(applyRequestUrl([req('remove-query', { match: 'token' })], 'https://h.com/p?token=abc&keep=1'), 'https://h.com/p?keep=1');
  });
  it('returns the original string when the URL cannot be parsed', () => {
    assert.equal(applyRequestUrl([req('set-host', { value: 'x' })], 'not a url'), 'not a url');
  });
});

describe('applyHeaderOps', () => {
  it('sets (case-insensitively) and removes headers on a copy', () => {
    const src = { 'x-existing': '1' };
    const out = applyHeaderOps([req('set-header', { match: 'X-Env', value: 'stage' }), req('remove-header', { match: 'x-existing' })], src);
    assert.deepEqual(out, { 'x-env': 'stage' });
    assert.deepEqual(src, { 'x-existing': '1' }); // input not mutated
  });
});

describe('statusOverride', () => {
  it('returns the last valid override, ignoring out-of-range', () => {
    assert.equal(statusOverride([res('set-status', { value: '503' })]), 503);
    assert.equal(statusOverride([res('set-status', { value: '200' }), res('set-status', { value: '418' })]), 418);
    assert.equal(statusOverride([res('set-status', { value: '999' })]), undefined);
    assert.equal(statusOverride([res('set-header', { match: 'a' })]), undefined);
  });
});

describe('applyBodyReplace', () => {
  it('replaces all literal occurrences', () => {
    assert.equal(applyBodyReplace([req('body-replace', { match: 'prod', value: 'stage' })], 'prod-prod'), 'stage-stage');
  });
  it('supports global regex replacement', () => {
    assert.equal(
      applyBodyReplace([req('body-replace', { match: 'v\\d+', value: 'vX', regex: true })], '/v1/ and /v22/'),
      '/vX/ and /vX/'
    );
  });
  it('skips an invalid regex without throwing', () => {
    assert.equal(applyBodyReplace([req('body-replace', { match: '(', value: 'x', regex: true })], 'abc'), 'abc');
  });
});

describe('resolveTrafficDecision surfaces rewrite ops', () => {
  it('collects rewrite ops from matching host rules (in order), non-terminal', () => {
    const d = resolveTrafficDecision(
      { hosts: [{ host: 'api.example.com', rewrite: [req('set-host', { value: 'localhost:9000' })] }] },
      'api.example.com',
      '/v1'
    );
    assert.equal(d.block, false);
    assert.equal(d.rewrite?.length, 1);
    assert.equal(d.rewrite?.[0]?.type, 'set-host');
  });
  it('does not surface rewrite for a non-matching host', () => {
    const d = resolveTrafficDecision({ hosts: [{ host: 'other.com', rewrite: [req('set-status')] }] }, 'api.example.com', '/');
    assert.equal(d.rewrite, undefined);
  });
  it('a terminal block/mock drops rewrite (never forwards)', () => {
    const d = resolveTrafficDecision(
      { hosts: [{ host: 'api.example.com', block: true, rewrite: [res('set-status', { value: '500' })] }] },
      'api.example.com',
      '/'
    );
    assert.equal(d.block, true);
    assert.equal(d.rewrite, undefined);
  });
});

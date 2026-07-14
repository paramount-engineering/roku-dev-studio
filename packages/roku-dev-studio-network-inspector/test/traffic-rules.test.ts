/**
 * Unit tests for the traffic-rule matching engine in `../types.ts`:
 * `hostRuleMatches` (exact / domain-suffix / `*` wildcard) and the path + precedence behavior of
 * `resolveTrafficDecision` (which drives the MITM proxy in both the HTTP and HTTPS-tunnel paths).
 *
 * Run: `npm test -w roku-dev-studio-network-inspector`
 *
 * These are the canonical matching functions (the proxy imports them from source), so wildcard
 * regressions here would silently mis-route real device traffic — hence a case per branch.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import { hostRuleMatches, resolveTrafficDecision } from '../types';
import type { DeviceTrafficRules } from '../types';

describe('hostRuleMatches', () => {
  it('matches exactly and by domain suffix when there is no wildcard', () => {
    assert.equal(hostRuleMatches('paramount.com', 'paramount.com'), true);
    assert.equal(hostRuleMatches('paramount.com', 'www.paramount.com'), true);
    assert.equal(hostRuleMatches('paramount.com', 'api.eu.paramount.com'), true);
  });

  it('does not treat a bare host as a loose substring', () => {
    // suffix match requires a dot boundary, not just endsWith
    assert.equal(hostRuleMatches('aramount.com', 'paramount.com'), false);
    assert.equal(hostRuleMatches('paramount.com', 'notparamount.com'), false);
  });

  it('is case-insensitive and trims', () => {
    assert.equal(hostRuleMatches('  Paramount.COM ', 'WWW.paramount.com'), true);
  });

  it('supports * wildcards (subdomain, prefix, and middle segment)', () => {
    assert.equal(hostRuleMatches('*.paramountplus.com', 'www.intl.paramountplus.com'), true);
    assert.equal(hostRuleMatches('*paramountplus.com', 'www.intl.paramountplus.com'), true);
    assert.equal(hostRuleMatches('www.*.paramountplus.com', 'www.intl.paramountplus.com'), true);
  });

  it('anchors wildcard patterns (full-string match, no implicit suffix)', () => {
    assert.equal(hostRuleMatches('*.example.com', 'paramountplus.com'), false);
    // `*.` requires something (with a dot) before the apex, so the apex alone does not match
    assert.equal(hostRuleMatches('*.paramountplus.com', 'paramountplus.com'), false);
    assert.equal(hostRuleMatches('api-*.example.com', 'api-staging.example.com'), true);
    assert.equal(hostRuleMatches('api-*.example.com', 'web-staging.example.com'), false);
  });

  it('treats metacharacters literally except *', () => {
    // the dots in the pattern must match literal dots, not any char
    assert.equal(hostRuleMatches('a.b.com', 'axbxcom'), false);
    assert.equal(hostRuleMatches('a.b.com', 'a.b.com'), true);
  });

  it('returns false for empty inputs', () => {
    assert.equal(hostRuleMatches('', 'paramount.com'), false);
    assert.equal(hostRuleMatches('*.paramount.com', ''), false);
  });
});

describe('resolveTrafficDecision — path matching', () => {
  const rules = (pathContains: string): DeviceTrafficRules => ({
    hosts: [{ host: 'api.example.com', pathContains, block: true }]
  });

  it('applies a substring path match (case-insensitive, ignores query)', () => {
    assert.equal(resolveTrafficDecision(rules('/v1/play'), 'api.example.com', '/v1/play?x=1').block, true);
    assert.equal(resolveTrafficDecision(rules('/V1/PLAY'), 'api.example.com', '/v1/play').block, true);
    assert.equal(resolveTrafficDecision(rules('/v1/play'), 'api.example.com', '/v2/stop').block, false);
  });

  it('applies a * wildcard path match anywhere in the path', () => {
    assert.equal(resolveTrafficDecision(rules('/v1/*/play'), 'api.example.com', '/v1/abc/play').block, true);
    assert.equal(resolveTrafficDecision(rules('/v1/*/play'), 'api.example.com', '/v1/play').block, false);
    assert.equal(resolveTrafficDecision(rules('*.m3u8'), 'api.example.com', '/hls/seg/stream.m3u8').block, true);
  });

  it('applies to all paths when pathContains is empty', () => {
    assert.equal(resolveTrafficDecision(rules(''), 'api.example.com', '/anything').block, true);
  });
});

describe('resolveTrafficDecision — precedence', () => {
  it('blockAll wins over everything', () => {
    const d = resolveTrafficDecision({ blockAll: true, hosts: [{ host: 'x.com', respond: { statusCode: 200 } }] }, 'x.com', '/');
    assert.equal(d.block, true);
    assert.equal(d.respond, undefined);
  });

  it('a matching host block short-circuits before mock/throttle', () => {
    const d = resolveTrafficDecision(
      { hosts: [{ host: 'x.com', block: true, throttle: { downKbps: 100 } }] },
      'x.com',
      '/'
    );
    assert.equal(d.block, true);
  });

  it('returns a mock response when the host rule mocks', () => {
    const d = resolveTrafficDecision({ hosts: [{ host: 'x.com', respond: { statusCode: 503 } }] }, 'x.com', '/');
    assert.equal(d.block, false);
    assert.equal(d.respond?.statusCode, 503);
  });

  it('reset short-circuits before mock', () => {
    const d = resolveTrafficDecision(
      { hosts: [{ host: 'x.com', resetConnection: true, respond: { statusCode: 200 } }] },
      'x.com',
      '/'
    );
    assert.equal(d.resetConnection, true);
    assert.equal(d.respond, undefined);
  });

  it('does not apply a rule whose host does not match', () => {
    const d = resolveTrafficDecision({ hosts: [{ host: 'other.com', block: true }] }, 'x.com', '/');
    assert.equal(d.block, false);
  });
});

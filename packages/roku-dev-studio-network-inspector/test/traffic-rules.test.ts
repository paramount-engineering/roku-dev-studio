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
import type { DeviceTrafficRules, RewriteOp } from '../types';

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

describe('resolveTrafficDecision — device presets', () => {
  const has = (
    ops: RewriteOp[] | undefined,
    target: 'request' | 'response',
    type: RewriteOp['type'],
    match: string,
    value?: string
  ): boolean =>
    !!ops?.some(
      (o) =>
        o.target === target &&
        o.type === type &&
        o.match === match &&
        (value === undefined || o.value === value)
    );

  it('noCaching strips request cache headers and forces no-store on responses', () => {
    const d = resolveTrafficDecision({ noCaching: true }, 'x.com', '/');
    assert.equal(d.block, false);
    assert.ok(has(d.rewrite, 'request', 'remove-header', 'cache-control'));
    assert.ok(has(d.rewrite, 'request', 'remove-header', 'if-none-match'));
    assert.ok(has(d.rewrite, 'request', 'remove-header', 'if-modified-since'));
    assert.ok(has(d.rewrite, 'response', 'set-header', 'cache-control', 'no-store'));
    assert.ok(has(d.rewrite, 'response', 'remove-header', 'expires'));
    assert.ok(has(d.rewrite, 'response', 'remove-header', 'etag'));
    assert.ok(has(d.rewrite, 'response', 'remove-header', 'last-modified'));
  });

  it('blockCookies strips request cookie and response set-cookie', () => {
    const d = resolveTrafficDecision({ blockCookies: true }, 'x.com', '/');
    assert.equal(d.block, false);
    assert.ok(has(d.rewrite, 'request', 'remove-header', 'cookie'));
    assert.ok(has(d.rewrite, 'response', 'remove-header', 'set-cookie'));
  });

  it('seeds preset ops before per-host rewrite ops', () => {
    const d = resolveTrafficDecision(
      {
        noCaching: true,
        hosts: [{ host: 'x.com', rewrite: [{ target: 'request', type: 'set-header', match: 'x-test', value: '1' }] }]
      },
      'x.com',
      '/'
    );
    assert.ok(d.rewrite && d.rewrite.length > 1);
    // The preset op comes first; the host op is last.
    assert.equal(d.rewrite?.[0].match, 'cache-control');
    const last = d.rewrite?.[d.rewrite.length - 1];
    assert.equal(last?.match, 'x-test');
    assert.equal(last?.value, '1');
  });

  it('blockAll wins over presets and returns no rewrite', () => {
    const d = resolveTrafficDecision({ blockAll: true, noCaching: true, blockCookies: true }, 'x.com', '/');
    assert.equal(d.block, true);
    assert.equal(d.rewrite, undefined);
  });

  it('omits the rewrite key when both preset flags are off', () => {
    const d = resolveTrafficDecision({ noCaching: false, blockCookies: false }, 'x.com', '/');
    assert.equal(d.block, false);
    assert.equal(d.rewrite, undefined);
  });
});

describe('resolveTrafficDecision — per-host presets', () => {
  const has = (
    ops: RewriteOp[] | undefined,
    target: 'request' | 'response',
    type: RewriteOp['type'],
    match: string,
    value?: string
  ): boolean =>
    !!ops?.some(
      (o) =>
        o.target === target &&
        o.type === type &&
        o.match === match &&
        (value === undefined || o.value === value)
    );

  it('expands a forwarding host rule\'s No Caching / Block Cookies into rewrite ops', () => {
    const d = resolveTrafficDecision(
      { hosts: [{ host: 'x.com', noCaching: true, blockCookies: true }] },
      'x.com',
      '/'
    );
    assert.equal(d.block, false);
    assert.ok(has(d.rewrite, 'request', 'remove-header', 'cache-control'));
    assert.ok(has(d.rewrite, 'response', 'set-header', 'cache-control', 'no-store'));
    assert.ok(has(d.rewrite, 'request', 'remove-header', 'cookie'));
    assert.ok(has(d.rewrite, 'response', 'remove-header', 'set-cookie'));
  });

  it('applies host presets only to the matching host', () => {
    const rules: DeviceTrafficRules = { hosts: [{ host: 'x.com', noCaching: true }] };
    assert.equal(resolveTrafficDecision(rules, 'other.com', '/').rewrite, undefined);
    assert.ok((resolveTrafficDecision(rules, 'x.com', '/').rewrite || []).length > 0);
  });

  it('seeds host preset ops before the host\'s explicit rewrite ops', () => {
    const d = resolveTrafficDecision(
      {
        hosts: [
          {
            host: 'x.com',
            noCaching: true,
            rewrite: [{ target: 'request', type: 'set-header', match: 'x-test', value: '1' }]
          }
        ]
      },
      'x.com',
      '/'
    );
    assert.ok(d.rewrite && d.rewrite.length > 1);
    // The host preset op comes first; the explicit host op is last (so it can override the preset).
    assert.equal(d.rewrite?.[0].match, 'cache-control');
    const last = d.rewrite?.[d.rewrite.length - 1];
    assert.equal(last?.match, 'x-test');
    assert.equal(last?.value, '1');
  });

  it('stacks device presets ahead of host presets (device first, host after)', () => {
    const d = resolveTrafficDecision(
      { blockCookies: true, hosts: [{ host: 'x.com', noCaching: true }] },
      'x.com',
      '/'
    );
    // Device-wide Block Cookies is seeded before any host rule...
    assert.equal(d.rewrite?.[0].match, 'cookie');
    // ...then the matching host's No Caching ops are appended.
    assert.ok(has(d.rewrite, 'response', 'set-header', 'cache-control', 'no-store'));
  });

  it('does not expand host presets when the rule blocks (terminal action wins)', () => {
    const d = resolveTrafficDecision(
      { hosts: [{ host: 'x.com', block: true, noCaching: true, blockCookies: true }] },
      'x.com',
      '/'
    );
    assert.equal(d.block, true);
    assert.equal(d.rewrite, undefined);
  });

  it('does not expand host presets when the rule mocks or resets', () => {
    const mock = resolveTrafficDecision(
      { hosts: [{ host: 'x.com', respond: { statusCode: 503 }, noCaching: true }] },
      'x.com',
      '/'
    );
    assert.equal(mock.respond?.statusCode, 503);
    assert.equal(mock.rewrite, undefined);
    const reset = resolveTrafficDecision(
      { hosts: [{ host: 'x.com', resetConnection: true, blockCookies: true }] },
      'x.com',
      '/'
    );
    assert.equal(reset.resetConnection, true);
    assert.equal(reset.rewrite, undefined);
  });
});

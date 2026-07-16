/**
 * Unit tests for the pure "Find in content" matcher (`../content-search.ts`).
 *
 * Focus is the multi-term path (`createContentMatchers` + `matchEventContentMulti`): the desktop app
 * runs it in the MAIN process over disk-backed detail and the offline Session Viewer runs it over
 * in-memory events, so a regression here breaks Find on both surfaces at once.
 *
 * Run: `npm test -w roku-dev-studio-network-inspector`
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  createContentMatcher,
  createContentMatchers,
  matchEventContent,
  matchEventContentMulti,
  findNeedsDetail,
  findNeedsDetailMulti
} from '../content-search';
import type { NetworkFindTerm } from '../content-search';
import type { ParsedNetworkEvent } from '../types';

/** Minimal event with the fields Find reads; the rest of ParsedNetworkEvent is irrelevant here. */
function makeEvent(over: Partial<ParsedNetworkEvent> = {}): ParsedNetworkEvent {
  return {
    id: 'e1',
    hostname: 'api.example.com',
    httpRequest: {
      url: 'https://api.example.com/v2/refresh?auth_token=abc',
      headers: { 'content-type': 'application/json', authorization: 'Bearer abc' },
      body: '{"user":"alice","auth_token":"abc"}',
      bodyEncoding: 'utf8'
    },
    httpResponse: {
      headers: { 'content-type': 'application/json' },
      body: '{"status":"ok","code":500}',
      bodyEncoding: 'utf8'
    },
    ...over
  } as ParsedNetworkEvent;
}

const term = (id: string, over: Partial<NetworkFindTerm> = {}): NetworkFindTerm => ({
  id,
  query: 'x',
  ...over
});

describe('createContentMatchers', () => {
  it('drops empty / whitespace-only-query terms and keeps order', () => {
    const compiled = createContentMatchers([
      term('a', { query: 'auth_token' }),
      term('b', { query: '' }),
      term('c', { query: '500' })
    ]);
    assert.deepEqual(
      compiled.map((t) => t.id),
      ['a', 'c']
    );
  });

  it('honors per-term scope/case options independently', () => {
    const compiled = createContentMatchers([
      term('a', { query: 'ALICE', scopes: ['reqBody'], caseSensitive: false }),
      term('b', { query: 'ALICE', scopes: ['reqBody'], caseSensitive: true })
    ]);
    const ev = makeEvent();
    assert.equal(compiled[0]!.matcher.count(ev.httpRequest!.body!), 1); // case-insensitive hits "alice"
    assert.equal(compiled[1]!.matcher.count(ev.httpRequest!.body!), 0); // case-sensitive misses
  });
});

describe('whitespace-insensitive substring matching', () => {
  // The detail view pretty-prints JSON (adds `: ` + indentation) while captured bodies are often
  // minified — a query must match regardless of which whitespace the user (or the source) used.
  const minified = '{"type":"media.segmentStart","hitId":36}';
  const pretty = '{\n  "type": "media.segmentStart",\n  "hitId": 36\n}';

  it('matches a spaced query against a minified body', () => {
    const m = createContentMatcher({ query: '"type": "media.segmentStart"' })!;
    assert.equal(m.count(minified), 1);
  });

  it('matches an unspaced query against a pretty-printed body', () => {
    const m = createContentMatcher({ query: '"type":"media.segmentStart"' })!;
    assert.equal(m.count(pretty), 1);
  });

  it('is symmetric — same count either way', () => {
    const spaced = createContentMatcher({ query: '"hitId": 36' })!;
    const tight = createContentMatcher({ query: '"hitId":36' })!;
    assert.equal(spaced.count(minified), 1);
    assert.equal(spaced.count(pretty), 1);
    assert.equal(tight.count(minified), 1);
    assert.equal(tight.count(pretty), 1);
  });

  it('still respects case sensitivity while ignoring whitespace', () => {
    const cs = createContentMatcher({ query: '"TYPE":"media.segmentStart"', caseSensitive: true })!;
    assert.equal(cs.count(pretty), 0); // wrong case
    const ci = createContentMatcher({ query: '"TYPE": "media.segmentStart"' })!;
    assert.equal(ci.count(pretty), 1); // case-insensitive + whitespace-insensitive
  });

  it('treats an all-whitespace query like an empty one (no matcher)', () => {
    // After whitespace-stripping the needle is empty, so there is nothing to match — return null
    // (dropped) rather than a zero-matcher that would still force a full scan.
    assert.equal(createContentMatcher({ query: '   ' }), null);
  });
});

describe('matchEventContentMulti', () => {
  it('returns null when no term matches', () => {
    const compiled = createContentMatchers([term('a', { query: 'nope' })]);
    assert.equal(matchEventContentMulti(makeEvent(), compiled), null);
  });

  it('unions matched terms and reports per-term + aggregate counts', () => {
    const compiled = createContentMatchers([
      term('a', { query: 'auth_token' }), // url + reqBody (default all scopes)
      term('b', { query: '500' }), // respBody
      term('c', { query: 'never-there' })
    ]);
    const match = matchEventContentMulti(makeEvent(), compiled);
    assert.ok(match);
    // Only the two terms that hit appear — one color segment each.
    assert.deepEqual(Object.keys(match!.terms ?? {}).sort(), ['a', 'b']);
    assert.ok(match!.terms!.a!.total >= 2); // url query param + body key
    assert.equal(match!.terms!.b!.total, 1);
    // Aggregate total is the sum across matched terms.
    assert.equal(match!.total, match!.terms!.a!.total + match!.terms!.b!.total);
    assert.equal(match!.id, 'e1');
  });

  it('materializes each scope once yet scores every term against it', () => {
    // Two terms both scoped to respBody must both see the same haystack.
    const compiled = createContentMatchers([
      term('a', { query: 'status', scopes: ['respBody'] }),
      term('b', { query: 'code', scopes: ['respBody'] })
    ]);
    const match = matchEventContentMulti(makeEvent(), compiled);
    assert.ok(match);
    assert.equal(match!.terms!.a!.scopes.respBody, 1);
    assert.equal(match!.terms!.b!.scopes.respBody, 1);
  });

  it('empty compiled term list yields null', () => {
    assert.equal(matchEventContentMulti(makeEvent(), []), null);
  });
});

describe('findNeedsDetailMulti', () => {
  it('is true when any term needs headers/bodies, false for URL-only terms', () => {
    const urlOnly = createContentMatchers([term('a', { query: 'x', scopes: ['url'] })]);
    assert.equal(findNeedsDetailMulti(urlOnly), false);

    const withBody = createContentMatchers([
      term('a', { query: 'x', scopes: ['url'] }),
      term('b', { query: 'y', scopes: ['respBody'] })
    ]);
    assert.equal(findNeedsDetailMulti(withBody), true);
  });
});

describe('single-term path still works (legacy)', () => {
  it('matchEventContent has no terms key', () => {
    const matcher = createContentMatcher({ query: 'auth_token' });
    assert.ok(matcher);
    const m = matchEventContent(makeEvent(), matcher!);
    assert.ok(m);
    assert.equal(m!.terms, undefined);
    assert.equal(findNeedsDetail(matcher!.scopes), true);
  });
});

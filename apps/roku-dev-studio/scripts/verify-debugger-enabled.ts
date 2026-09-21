/**
 * Check for shared/platform/debugger-enabled.ts — the ONE "Enable Debugger" predicate/mutator.
 * Locks the rules every consumer relies on: match by identity key (serial when known, else IP),
 * honor legacy raw-IP entries, and keep the list clean on toggle. `npm run verify:debugger-enabled`.
 */
import assert from 'node:assert/strict';
import { isDebuggerEnabled, withDebuggerEnabled, asDebuggerEnabledList } from '../shared/platform/debugger-enabled';

const express = { serial: 'X00400Y65N5F', ip: '192.168.1.154' };
const list = ['X00400Y65N5F', '10.136.216.75', 'YL00FU130342'];

// identity key (serial) matches even though the raw IP is NOT in the list — the bug class this replaces
assert.equal(isDebuggerEnabled(list, express), true);
// legacy raw-IP entry still matches when the serial is unknown or absent from the list
assert.equal(isDebuggerEnabled(list, { serial: 'UNKNOWN', ip: '10.136.216.75' }), true);
assert.equal(isDebuggerEnabled(list, { ip: '10.136.216.75' }), true);
// neither form → off; garbage input → off
assert.equal(isDebuggerEnabled(list, { serial: 'NOPE', ip: '1.2.3.4' }), false);
assert.equal(isDebuggerEnabled(undefined, express), false);
assert.equal(isDebuggerEnabled('not-a-list', express), false);
assert.deepEqual(asDebuggerEnabledList([1, '', ' ok ', null]), [' ok ']);

// switching on stores the serial key and drops the now-redundant legacy IP entry
const on = withDebuggerEnabled(['10.136.216.75'], { serial: 'YL00FU130342', ip: '10.136.216.75' }, true);
assert.deepEqual(on.sort(), ['YL00FU130342']);
// switching off removes both forms
assert.deepEqual(withDebuggerEnabled(['YL00FU130342', '10.136.216.75', 'OTHER'], { serial: 'YL00FU130342', ip: '10.136.216.75' }, false), ['OTHER']);
// idempotent + never mutates the input
const src = ['A'];
assert.deepEqual(withDebuggerEnabled(src, { serial: 'A', ip: '9.9.9.9' }, true), ['A']);
assert.deepEqual(src, ['A']);
// no serial → keyed by IP
assert.deepEqual(withDebuggerEnabled([], { ip: '1.2.3.4' }, true), ['1.2.3.4']);

console.log('verify-debugger-enabled: OK');

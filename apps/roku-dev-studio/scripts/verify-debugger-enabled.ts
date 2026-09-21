/**
 * Check for shared/platform/debugger-enabled.ts — the ONE "Enable Debugger" predicate/mutator.
 * Locks the rules every consumer relies on: match by identity key (serial when known, else IP),
 * honor legacy raw-IP entries, and keep the list clean on toggle. `npm run verify:debugger-enabled`.
 */
import assert from 'node:assert/strict';
import { isDebuggerEnabled, withDebuggerEnabled, asDebuggerEnabledList } from '../shared/platform/debugger-enabled';

const express = { serial: 'X00400EX7Q2M', ip: '192.168.1.137' };
const list = ['X00400EX7Q2M', '10.20.30.40', 'YL00EX294817'];

// identity key (serial) matches even though the raw IP is NOT in the list — the bug class this replaces
assert.equal(isDebuggerEnabled(list, express), true);
// legacy raw-IP entry still matches when the serial is unknown or absent from the list
assert.equal(isDebuggerEnabled(list, { serial: 'UNKNOWN', ip: '10.20.30.40' }), true);
assert.equal(isDebuggerEnabled(list, { ip: '10.20.30.40' }), true);
// neither form → off; garbage input → off
assert.equal(isDebuggerEnabled(list, { serial: 'NOPE', ip: '1.2.3.4' }), false);
assert.equal(isDebuggerEnabled(undefined, express), false);
assert.equal(isDebuggerEnabled('not-a-list', express), false);
assert.deepEqual(asDebuggerEnabledList([1, '', ' ok ', null]), [' ok ']);

// switching on stores the serial key and drops the now-redundant legacy IP entry
const on = withDebuggerEnabled(['10.20.30.40'], { serial: 'YL00EX294817', ip: '10.20.30.40' }, true);
assert.deepEqual(on.sort(), ['YL00EX294817']);
// switching off removes both forms
assert.deepEqual(withDebuggerEnabled(['YL00EX294817', '10.20.30.40', 'OTHER'], { serial: 'YL00EX294817', ip: '10.20.30.40' }, false), ['OTHER']);
// idempotent + never mutates the input
const src = ['A'];
assert.deepEqual(withDebuggerEnabled(src, { serial: 'A', ip: '9.9.9.9' }, true), ['A']);
assert.deepEqual(src, ['A']);
// no serial → keyed by IP
assert.deepEqual(withDebuggerEnabled([], { ip: '1.2.3.4' }, true), ['1.2.3.4']);

console.log('verify-debugger-enabled: OK');

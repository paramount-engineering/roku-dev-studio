/**
 * Unit tests for the canonical Action Script validator
 * (`packages/roku-dev-studio-api/lib/validate-action-script.ts`).
 *
 * Run: `npm test -w roku-dev-studio-api`
 *
 * Coverage matrix mirrors §2 of `.discussion-docs/unified-action-script-validation.md`
 * — every row has a valid + invalid case here.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

const { validateScript } = require('../lib/validate-action-script');

type Err = { path: string; code: string; message: string; expected?: string | string[]; stepIndex?: number };
type Result = { ok: boolean; errors: Err[]; stepCounts: Record<string, number> };

function findError(result: Result, code: string): Err | undefined {
  return result.errors.find((e) => e.code === code);
}

function assertHasCode(result: Result, code: string): Err {
  const err = findError(result, code);
  assert.ok(err, `expected error code "${code}", got: ${JSON.stringify(result.errors)}`);
  return err;
}

// =============================================================================
// Smoke / structural
// =============================================================================

describe('validateScript: structural', () => {
  it('rejects non-object input', () => {
    const r = validateScript(null);
    assert.equal(r.ok, false);
    assertHasCode(r, 'script_not_object');
  });

  it('rejects missing steps array', () => {
    const r = validateScript({});
    assert.equal(r.ok, false);
    assertHasCode(r, 'missing_steps');
  });

  it('accepts an empty steps array', () => {
    const r = validateScript({ steps: [] });
    assert.equal(r.ok, true);
    assert.deepEqual(r.errors, []);
  });

  it('rejects a non-object step', () => {
    const r = validateScript({ steps: ['nope'] });
    assert.equal(r.ok, false);
    assertHasCode(r, 'step_not_object');
  });

  it('rejects an unknown step type', () => {
    const r = validateScript({ steps: [{ type: 'doesNotExist' }] });
    assert.equal(r.ok, false);
    const err = assertHasCode(r, 'unknown_step_type');
    assert.ok(Array.isArray(err.expected));
  });

  it('counts steps by type', () => {
    const r = validateScript({
      steps: [
        { type: 'keypress', key: 'Home' },
        { type: 'keypress', key: 'Down' },
        { type: 'screenshot' }
      ]
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.stepCounts, { keypress: 2, screenshot: 1 });
  });

  it('rejects literal devPassword in script root', () => {
    const r = validateScript({ devPassword: 'oops', steps: [] });
    assert.equal(r.ok, false);
    assertHasCode(r, 'password_in_script');
  });

  it('rejects an invalid script.version value', () => {
    const r = validateScript({ version: 'banana', steps: [] });
    assert.equal(r.ok, false);
    assertHasCode(r, 'invalid_version');
  });
});

// =============================================================================
// Per-step required fields
// =============================================================================

describe('validateScript: required fields', () => {
  it('keypress requires key', () => {
    const r = validateScript({ steps: [{ type: 'keypress' }] });
    assert.equal(r.ok, false);
    assertHasCode(r, 'missing_required');
  });

  it('keypress accepts a known key', () => {
    const r = validateScript({ steps: [{ type: 'keypress', key: 'Home' }] });
    assert.equal(r.ok, true);
  });

  it('keypress rejects an unknown key', () => {
    const r = validateScript({ steps: [{ type: 'keypress', key: 'Frobnicate' }] });
    assert.equal(r.ok, false);
    assertHasCode(r, 'invalid_keypress');
  });

  it('appFunction requires functionName + functionParams', () => {
    const r = validateScript({ steps: [{ type: 'appFunction' }] });
    assert.equal(r.ok, false);
    const missing = r.errors.filter((e) => e.code === 'missing_required');
    assert.equal(missing.length, 2);
  });

  it('devicePerformance requires chart and validates the value', () => {
    const r1 = validateScript({ steps: [{ type: 'devicePerformance' }] });
    assert.equal(r1.ok, false);
    assertHasCode(r1, 'missing_required');

    const r2 = validateScript({ steps: [{ type: 'devicePerformance', chart: 'banana' }] });
    assert.equal(r2.ok, false);
    assertHasCode(r2, 'invalid_chart_id');

    const r3 = validateScript({ steps: [{ type: 'devicePerformance', chart: 'cpu' }] });
    assert.equal(r3.ok, true);
  });
});

// =============================================================================
// query.endpoint telnet shape
// =============================================================================

describe('validateScript: query.endpoint', () => {
  it('accepts /query/* ECP endpoints', () => {
    const r = validateScript({ steps: [{ type: 'query', endpoint: '/query/active-app' }] });
    assert.equal(r.ok, true);
  });

  it('accepts telnet:plugins / telnet:free presets', () => {
    const r1 = validateScript({ steps: [{ type: 'query', endpoint: 'telnet:plugins' }] });
    const r2 = validateScript({ steps: [{ type: 'query', endpoint: 'telnet:free' }] });
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
  });

  it('rejects telnet:bogus', () => {
    const r = validateScript({ steps: [{ type: 'query', endpoint: 'telnet:bogus' }] });
    assert.equal(r.ok, false);
    assertHasCode(r, 'invalid_query_endpoint');
  });
});

// =============================================================================
// raleCommand
// =============================================================================

describe('validateScript: raleCommand', () => {
  it('accepts a known built-in', () => {
    const r = validateScript({
      steps: [{ type: 'raleCommand', command: 'getRegistrySections', args: {} }]
    });
    assert.equal(r.ok, true);
  });

  it('rejects an unknown built-in', () => {
    const r = validateScript({
      steps: [{ type: 'raleCommand', command: 'doesNotExist', args: {} }]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'unknown_rale_command');
  });

  it('rejects non-object args', () => {
    const r = validateScript({
      steps: [{ type: 'raleCommand', command: 'getRegistrySections', args: 'oops' }]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'rale_args_not_object');
  });

  // Phase 0c.1 — deep per-builtin shape check folded into the canonical validator.
  it('rejects getNodeById missing id', () => {
    const r = validateScript({
      steps: [{ type: 'raleCommand', command: 'getNodeById', args: { path: [] } }]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'invalid_rale_args');
  });

  it('accepts getNodeById with id and default empty path', () => {
    const r = validateScript({
      steps: [{ type: 'raleCommand', command: 'getNodeById', args: { id: 'my-node' } }]
    });
    assert.equal(r.ok, true);
  });

  it('rejects addRegistryField missing sectionName', () => {
    const r = validateScript({
      steps: [
        {
          type: 'raleCommand',
          command: 'addRegistryField',
          args: { key: 'k', value: 'v' }
        }
      ]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'invalid_rale_args');
  });

  it('rejects addRegistrySection with non-string field value', () => {
    const r = validateScript({
      steps: [
        {
          type: 'raleCommand',
          command: 'addRegistrySection',
          args: { name: 'sec', section: { k: 42 } }
        }
      ]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'invalid_rale_args');
  });

  it('accepts addRegistrySection with all string values', () => {
    const r = validateScript({
      steps: [
        {
          type: 'raleCommand',
          command: 'addRegistrySection',
          args: { name: 'sec', section: { k: 'v' } }
        }
      ]
    });
    assert.equal(r.ok, true);
  });
});

// =============================================================================
// appFunction.functionParams shape — the rule that motivated this RFC
// =============================================================================

describe('validateScript: appFunction.functionParams shape', () => {
  it('accepts a positional array (canonical)', () => {
    const r = validateScript({
      steps: [{ type: 'appFunction', functionName: 'X', functionParams: ['abc', true] }]
    });
    assert.equal(r.ok, true);
  });

  it('accepts an empty array (zero-arg function)', () => {
    const r = validateScript({
      steps: [{ type: 'appFunction', functionName: 'X', functionParams: [] }]
    });
    assert.equal(r.ok, true);
  });

  it('accepts a named-object form (legacy/agent-generated)', () => {
    const r = validateScript({
      steps: [{ type: 'appFunction', functionName: 'X', functionParams: { fooKey: { a: 1 } } }]
    });
    assert.equal(r.ok, true);
  });

  it('rejects a primitive functionParams', () => {
    for (const bad of ['oops', 42, true]) {
      const r = validateScript({
        steps: [{ type: 'appFunction', functionName: 'X', functionParams: bad }]
      });
      assert.equal(r.ok, false, `should reject primitive: ${JSON.stringify(bad)}`);
      assertHasCode(r, 'invalid_function_params_shape');
    }
  });

  it('still rejects missing functionParams via required-field check', () => {
    const r = validateScript({ steps: [{ type: 'appFunction', functionName: 'X' }] });
    assert.equal(r.ok, false);
    assertHasCode(r, 'missing_required');
  });
});

// =============================================================================
// appFunction with raleFunctions (opt-in deeper check)
// =============================================================================

describe('validateScript: appFunction + raleFunctions option', () => {
  const raleFunctions = [
    { name: 'PlayContent', params: [{ name: 'contentId', type: 'String' }, { name: 'autoPlay', type: 'Boolean' }] },
    { name: 'GetAppState', params: [] }
  ];

  it('rejects a function name not in the list', () => {
    const r = validateScript(
      { steps: [{ type: 'appFunction', functionName: 'NoSuch', functionParams: [] }] },
      { raleFunctions }
    );
    assert.equal(r.ok, false);
    assertHasCode(r, 'unknown_app_function');
  });

  it('reports param-count mismatch (positional)', () => {
    const r = validateScript(
      { steps: [{ type: 'appFunction', functionName: 'PlayContent', functionParams: ['x'] }] },
      { raleFunctions }
    );
    assert.equal(r.ok, false);
    assertHasCode(r, 'app_function_param_count_mismatch');
  });

  it('reports missing keys for named-object form', () => {
    const r = validateScript(
      {
        steps: [
          { type: 'appFunction', functionName: 'PlayContent', functionParams: { contentId: 'x' } }
        ]
      },
      { raleFunctions }
    );
    assert.equal(r.ok, false);
    assertHasCode(r, 'app_function_missing_named_params');
  });

  it('passes when the named-object covers every declared param', () => {
    const r = validateScript(
      {
        steps: [
          {
            type: 'appFunction',
            functionName: 'PlayContent',
            functionParams: { contentId: 'x', autoPlay: true }
          }
        ]
      },
      { raleFunctions }
    );
    assert.equal(r.ok, true);
  });

  it('passes a zero-arg function with []', () => {
    const r = validateScript(
      { steps: [{ type: 'appFunction', functionName: 'GetAppState', functionParams: [] }] },
      { raleFunctions }
    );
    assert.equal(r.ok, true);
  });

  it('skips deeper checks when raleFunctions is omitted', () => {
    const r = validateScript({
      steps: [
        { type: 'appFunction', functionName: 'NoSuch', functionParams: [1, 2, 3, 4, 5] }
      ]
    });
    assert.equal(r.ok, true);
  });
});

// =============================================================================
// wait / if conditions
// =============================================================================

describe('validateScript: wait', () => {
  it('accepts delayMs alone', () => {
    const r = validateScript({ steps: [{ type: 'wait', delayMs: 500 }] });
    assert.equal(r.ok, true);
  });

  it('rejects wait with neither delayMs nor condition', () => {
    const r = validateScript({ steps: [{ type: 'wait' }] });
    assert.equal(r.ok, false);
    assertHasCode(r, 'wait_needs_signal');
  });

  it('accepts media-player condition with state', () => {
    const r = validateScript({
      steps: [{ type: 'wait', condition: { source: 'media-player', state: 'play' } }]
    });
    assert.equal(r.ok, true);
  });

  it('rejects unknown media-player state', () => {
    const r = validateScript({
      steps: [{ type: 'wait', condition: { source: 'media-player', state: 'banana' } }]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'invalid_media_state');
  });

  it('rejects unknown condition source', () => {
    const r = validateScript({
      steps: [{ type: 'wait', condition: { source: 'eldritch' } }]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'invalid_condition_source');
  });

  it('rale-node-field condition: missing operator', () => {
    const r = validateScript({
      steps: [
        {
          type: 'wait',
          condition: { source: 'rale-node-field', path: [], id: 'x', field: 'visible' }
        }
      ]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'invalid_operator');
  });

  it('rale-node-field condition: operator needing value but value missing', () => {
    const r = validateScript({
      steps: [
        {
          type: 'wait',
          condition: {
            source: 'rale-node-field',
            path: [],
            id: 'x',
            field: 'visible',
            operator: 'is'
          }
        }
      ]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'missing_value');
  });

  it('rale-node-field condition: hasNoValue does not require value', () => {
    const r = validateScript({
      steps: [
        {
          type: 'wait',
          condition: {
            source: 'rale-node-field',
            path: [],
            id: 'x',
            field: 'visible',
            operator: 'hasNoValue'
          }
        }
      ]
    });
    assert.equal(r.ok, true);
  });
});

describe('validateScript: if', () => {
  it('rejects an if step without script.version "2"', () => {
    const r = validateScript({
      steps: [
        {
          type: 'if',
          condition: { source: 'media-player', state: 'play' },
          then: [],
          else: []
        }
      ]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'version_required_for_if');
  });

  it('accepts an if step with version 2 and well-formed condition', () => {
    const r = validateScript({
      version: '2',
      steps: [
        {
          type: 'if',
          condition: { source: 'active-app', attribute: 'type', operator: 'is', value: 'home' },
          then: [{ type: 'keypress', key: 'Down' }],
          else: [{ type: 'keypress', key: 'Back' }]
        }
      ]
    });
    assert.equal(r.ok, true);
  });

  it('rejects if.then or if.else not being arrays', () => {
    const r = validateScript({
      version: '2',
      steps: [
        {
          type: 'if',
          condition: { source: 'media-player', state: 'play' },
          then: 'oops',
          else: []
        }
      ]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'missing_branch');
  });

  it('detects a variables-source if referencing an unassigned variable root', () => {
    const r = validateScript({
      version: '2',
      steps: [
        {
          type: 'if',
          condition: {
            source: 'variables',
            variablePath: 'undef.foo',
            operator: 'is',
            value: 'x'
          },
          then: [],
          else: []
        }
      ]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'variable_root_not_assigned');
  });

  it('accepts a variables-source if when an earlier step assigns the root', () => {
    const r = validateScript({
      version: '2',
      steps: [
        {
          type: 'appFunction',
          functionName: 'X',
          functionParams: [],
          assignToVar: 'state'
        },
        {
          type: 'if',
          condition: {
            source: 'variables',
            variablePath: 'state.ready',
            operator: 'is',
            value: 'true'
          },
          then: [],
          else: []
        }
      ]
    });
    assert.equal(r.ok, true);
  });
});

// =============================================================================
// Preorder index — `stepIndex` on errors should match the renderer's walk
// =============================================================================

describe('validateScript: preorder stepIndex', () => {
  it('numbers nested if branches in preorder', () => {
    const r = validateScript({
      version: '2',
      steps: [
        // 0: outer if
        {
          type: 'if',
          condition: { source: 'media-player', state: 'play' },
          then: [
            // 1: inner keypress (invalid key → should report stepIndex 1)
            { type: 'keypress', key: 'Bogus' }
          ],
          // 2: an else step
          else: [{ type: 'keypress', key: 'Home' }]
        }
      ]
    });
    assert.equal(r.ok, false);
    const err = assertHasCode(r, 'invalid_keypress');
    assert.equal(err.stepIndex, 1);
  });

  it('reports if.then preorder index correctly when version is missing', () => {
    const r = validateScript({
      // no version → if rejected
      steps: [
        {
          type: 'if',
          condition: { source: 'media-player', state: 'play' },
          then: [{ type: 'keypress', key: 'Home' }],
          else: []
        }
      ]
    });
    assert.equal(r.ok, false);
    const err = assertHasCode(r, 'version_required_for_if');
    assert.equal(err.stepIndex, 0);
  });
});

// =============================================================================
// Multi-error: every problem in a single script surfaces at once
// =============================================================================

describe('validateScript: multi-error reporting', () => {
  it('reports unrelated issues in one pass', () => {
    const r = validateScript({
      devPassword: 'oops',
      steps: [
        { type: 'keypress' }, // missing key
        { type: 'appFunction', functionName: 'X', functionParams: 'badprim' }, // invalid shape
        { type: 'wait' } // wait_needs_signal
      ]
    });
    assert.equal(r.ok, false);
    assertHasCode(r, 'password_in_script');
    assertHasCode(r, 'missing_required');
    assertHasCode(r, 'invalid_function_params_shape');
    assertHasCode(r, 'wait_needs_signal');
  });
});

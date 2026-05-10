/**
 * Unit tests for `validateAndNormalizeRaleCommandArgs`
 * (`packages/roku-dev-studio-api/lib/rale-command-args.ts`).
 *
 * Run: `npm test -w roku-dev-studio-api`
 *
 * Per `engineering-principles.md` §12 "Tests at the canonical layer": this
 * helper is a canonical surface (it's called from the script-runner headless
 * path, the MCP server's `validate_script`, and the renderer's per-row
 * Builder UI via the preload bridge) — not an adapter. One valid + at least
 * one invalid case per row of `RALE_BUILTIN_COMMAND_DEFS`, plus the generic
 * shape checks.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

const {
  validateAndNormalizeRaleCommandArgs,
  RALE_BUILTIN_COMMAND_DEFS
} = require('../lib/rale-command-args');

type Ok = { ok: true; args: Record<string, unknown> };
type Fail = { ok: false; error: string };
type Result = Ok | Fail;

function assertOk(r: Result): asserts r is Ok {
  assert.equal(r.ok, true, `expected ok, got ${JSON.stringify(r)}`);
}

function assertFail(r: Result, needle?: string): asserts r is Fail {
  assert.equal(r.ok, false, `expected fail, got ${JSON.stringify(r)}`);
  if (needle != null) {
    assert.match((r as Fail).error, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

// =============================================================================
// Generic shape checks
// =============================================================================

describe('validateAndNormalizeRaleCommandArgs: generic shape', () => {
  it('rejects non-string command', () => {
    const r = validateAndNormalizeRaleCommandArgs(42 as unknown, {});
    assertFail(r, 'non-empty command');
  });

  it('rejects empty-string command', () => {
    const r = validateAndNormalizeRaleCommandArgs('   ', {});
    assertFail(r, 'non-empty command');
  });

  it('rejects unknown command', () => {
    const r = validateAndNormalizeRaleCommandArgs('doTheThing', {});
    assertFail(r, 'Unknown RALE command');
  });

  it('treats null args as empty object (arg-less commands)', () => {
    const r = validateAndNormalizeRaleCommandArgs('getRegistrySections', null);
    assertOk(r);
    assert.deepEqual(r.args, {});
  });

  it('treats array args as empty object (arg-less commands)', () => {
    const r = validateAndNormalizeRaleCommandArgs('getRegistrySections', []);
    assertOk(r);
    assert.deepEqual(r.args, {});
  });

  it('every command in the catalog is handled', () => {
    for (const cmd of Object.keys(RALE_BUILTIN_COMMAND_DEFS)) {
      // Pick "lazy valid" args per command — just enough to not fail.
      const minimal: Record<string, Record<string, unknown>> = {
        getNodeById: { path: [], id: 'foo' },
        getNodeByName: { path: [], name: 'foo' },
        getRegistrySections: {},
        clearRegistry: {},
        addRegistrySection: { name: 's', section: { k: 'v' } },
        removeRegistrySection: { name: 's' },
        addRegistryField: { sectionName: 's', key: 'k', value: 'v' },
        removeRegistryField: { sectionName: 's', key: 'k' },
        editRegistryField: { sectionName: 's', key: 'k', newKey: 'k2', newValue: 'v2' }
      };
      const r = validateAndNormalizeRaleCommandArgs(cmd, minimal[cmd]);
      assertOk(r);
    }
  });
});

// =============================================================================
// getNodeById / getNodeByName
// =============================================================================

describe('validateAndNormalizeRaleCommandArgs: getNodeById', () => {
  it('valid: minimal', () => {
    const r = validateAndNormalizeRaleCommandArgs('getNodeById', { path: [], id: 'hero' });
    assertOk(r);
    assert.deepEqual(r.args, { path: [], id: 'hero' });
  });

  it('valid: trims id whitespace', () => {
    const r = validateAndNormalizeRaleCommandArgs('getNodeById', { path: [], id: '  hero  ' });
    assertOk(r);
    assert.equal(r.args.id, 'hero');
  });

  it('valid: path parsed from JSON string', () => {
    const r = validateAndNormalizeRaleCommandArgs('getNodeById', {
      path: '["a","b"]',
      id: 'hero'
    });
    assertOk(r);
    assert.deepEqual(r.args.path, ['a', 'b']);
  });

  it('invalid: missing id', () => {
    const r = validateAndNormalizeRaleCommandArgs('getNodeById', { path: [] });
    assertFail(r, 'args.id is required');
  });

  it('invalid: blank id', () => {
    const r = validateAndNormalizeRaleCommandArgs('getNodeById', { path: [], id: '   ' });
    assertFail(r, 'args.id is required');
  });

  it('invalid: path not an array / parseable', () => {
    const r = validateAndNormalizeRaleCommandArgs('getNodeById', { path: 'not json', id: 'hero' });
    assertFail(r);
  });
});

describe('validateAndNormalizeRaleCommandArgs: getNodeByName', () => {
  it('valid: minimal', () => {
    const r = validateAndNormalizeRaleCommandArgs('getNodeByName', { path: [], name: 'hero' });
    assertOk(r);
    assert.deepEqual(r.args, { path: [], name: 'hero' });
  });

  it('valid: trims name', () => {
    const r = validateAndNormalizeRaleCommandArgs('getNodeByName', {
      path: [],
      name: '  hero  '
    });
    assertOk(r);
    assert.equal(r.args.name, 'hero');
  });

  it('invalid: missing name', () => {
    const r = validateAndNormalizeRaleCommandArgs('getNodeByName', { path: [] });
    assertFail(r, 'args.name is required');
  });
});

// =============================================================================
// getRegistrySections / clearRegistry (arg-less)
// =============================================================================

describe('validateAndNormalizeRaleCommandArgs: arg-less commands', () => {
  it('getRegistrySections: empty args OK', () => {
    const r = validateAndNormalizeRaleCommandArgs('getRegistrySections', {});
    assertOk(r);
    assert.deepEqual(r.args, {});
  });

  it('getRegistrySections: extra args are stripped', () => {
    const r = validateAndNormalizeRaleCommandArgs('getRegistrySections', { bogus: 1 });
    assertOk(r);
    assert.deepEqual(r.args, {});
  });

  it('clearRegistry: empty args OK', () => {
    const r = validateAndNormalizeRaleCommandArgs('clearRegistry', {});
    assertOk(r);
    assert.deepEqual(r.args, {});
  });
});

// =============================================================================
// addRegistrySection
// =============================================================================

describe('validateAndNormalizeRaleCommandArgs: addRegistrySection', () => {
  it('valid: object section', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistrySection', {
      name: 'prefs',
      section: { greeting: 'hello' }
    });
    assertOk(r);
    assert.deepEqual(r.args, { name: 'prefs', section: { greeting: 'hello' } });
  });

  it('valid: JSON-string section is parsed', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistrySection', {
      name: 'prefs',
      section: '{"greeting":"hello"}'
    });
    assertOk(r);
    assert.deepEqual(r.args.section, { greeting: 'hello' });
  });

  it('invalid: missing name', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistrySection', {
      section: { a: 'b' }
    });
    assertFail(r, 'args.name is required');
  });

  it('invalid: missing section', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistrySection', { name: 'prefs' });
    assertFail(r, 'args.section is required');
  });

  it('invalid: section is an array', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistrySection', {
      name: 'prefs',
      section: ['a', 'b']
    });
    assertFail(r);
  });

  it('invalid: non-string value inside section', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistrySection', {
      name: 'prefs',
      section: { n: 42 }
    });
    assertFail(r, 'string');
  });

  it('invalid: blank key in section', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistrySection', {
      name: 'prefs',
      section: { '  ': 'value' }
    });
    assertFail(r, 'empty');
  });

  it('invalid: section JSON string parses to non-object', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistrySection', {
      name: 'prefs',
      section: '"not an object"'
    });
    assertFail(r);
  });
});

// =============================================================================
// removeRegistrySection
// =============================================================================

describe('validateAndNormalizeRaleCommandArgs: removeRegistrySection', () => {
  it('valid: name', () => {
    const r = validateAndNormalizeRaleCommandArgs('removeRegistrySection', { name: 'prefs' });
    assertOk(r);
    assert.deepEqual(r.args, { name: 'prefs' });
  });

  it('valid: trims name', () => {
    const r = validateAndNormalizeRaleCommandArgs('removeRegistrySection', { name: '  prefs  ' });
    assertOk(r);
    assert.equal(r.args.name, 'prefs');
  });

  it('invalid: missing name', () => {
    const r = validateAndNormalizeRaleCommandArgs('removeRegistrySection', {});
    assertFail(r, 'args.name is required');
  });
});

// =============================================================================
// addRegistryField
// =============================================================================

describe('validateAndNormalizeRaleCommandArgs: addRegistryField', () => {
  it('valid: full triple', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistryField', {
      sectionName: 'prefs',
      key: 'greeting',
      value: 'hello'
    });
    assertOk(r);
    assert.deepEqual(r.args, { sectionName: 'prefs', key: 'greeting', value: 'hello' });
  });

  it('valid: missing value is coerced to empty string', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistryField', {
      sectionName: 'prefs',
      key: 'greeting'
    });
    assertOk(r);
    assert.equal(r.args.value, '');
  });

  it('valid: non-string value is stringified (Registry stores strings)', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistryField', {
      sectionName: 'prefs',
      key: 'count',
      value: 42
    });
    assertOk(r);
    assert.equal(r.args.value, '42');
  });

  it('invalid: missing sectionName', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistryField', {
      key: 'greeting',
      value: 'hello'
    });
    assertFail(r, 'args.sectionName is required');
  });

  it('invalid: missing key', () => {
    const r = validateAndNormalizeRaleCommandArgs('addRegistryField', {
      sectionName: 'prefs',
      value: 'hello'
    });
    assertFail(r, 'args.key is required');
  });
});

// =============================================================================
// removeRegistryField
// =============================================================================

describe('validateAndNormalizeRaleCommandArgs: removeRegistryField', () => {
  it('valid: section + key', () => {
    const r = validateAndNormalizeRaleCommandArgs('removeRegistryField', {
      sectionName: 'prefs',
      key: 'greeting'
    });
    assertOk(r);
    assert.deepEqual(r.args, { sectionName: 'prefs', key: 'greeting' });
  });

  it('invalid: missing sectionName', () => {
    const r = validateAndNormalizeRaleCommandArgs('removeRegistryField', { key: 'greeting' });
    assertFail(r, 'args.sectionName is required');
  });

  it('invalid: missing key', () => {
    const r = validateAndNormalizeRaleCommandArgs('removeRegistryField', { sectionName: 'prefs' });
    assertFail(r, 'args.key is required');
  });
});

// =============================================================================
// editRegistryField
// =============================================================================

describe('validateAndNormalizeRaleCommandArgs: editRegistryField', () => {
  it('valid: full quad', () => {
    const r = validateAndNormalizeRaleCommandArgs('editRegistryField', {
      sectionName: 'prefs',
      key: 'greeting',
      newKey: 'salutation',
      newValue: 'howdy'
    });
    assertOk(r);
    assert.deepEqual(r.args, {
      sectionName: 'prefs',
      key: 'greeting',
      newKey: 'salutation',
      newValue: 'howdy'
    });
  });

  it('valid: missing newValue is coerced to empty string', () => {
    const r = validateAndNormalizeRaleCommandArgs('editRegistryField', {
      sectionName: 'prefs',
      key: 'greeting',
      newKey: 'salutation'
    });
    assertOk(r);
    assert.equal(r.args.newValue, '');
  });

  it('invalid: missing sectionName', () => {
    const r = validateAndNormalizeRaleCommandArgs('editRegistryField', {
      key: 'k',
      newKey: 'k2',
      newValue: 'v2'
    });
    assertFail(r, 'args.sectionName is required');
  });

  it('invalid: missing key', () => {
    const r = validateAndNormalizeRaleCommandArgs('editRegistryField', {
      sectionName: 's',
      newKey: 'k2',
      newValue: 'v2'
    });
    assertFail(r, 'args.key is required');
  });

  it('invalid: missing newKey', () => {
    const r = validateAndNormalizeRaleCommandArgs('editRegistryField', {
      sectionName: 's',
      key: 'k',
      newValue: 'v2'
    });
    assertFail(r, 'args.newKey is required');
  });
});

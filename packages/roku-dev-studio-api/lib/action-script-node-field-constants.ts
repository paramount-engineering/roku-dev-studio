/**
 * RALE node-field style operators for wait / if conditions (single source of truth).
 */

'use strict';

const RALE_NODE_FIELD_OPERATORS = Object.freeze([
  'is',
  'isNot',
  'hasAnyValue',
  'hasNoValue',
  'contains',
  'doesNotContain',
  'beginsWith',
  'endsWith'
]);

/** Operators that require condition.value in scripts and compare value in the builder. */
const OPS_NEED_VALUE = new Set([
  'is',
  'isNot',
  'contains',
  'doesNotContain',
  'beginsWith',
  'endsWith'
]);

module.exports = {
  RALE_NODE_FIELD_OPERATORS,
  OPS_NEED_VALUE
};

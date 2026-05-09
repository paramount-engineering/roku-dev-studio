/**
 * Canonical catalogs shared between the Action Scripts layer (renderer),
 * the script validator, the MCP server, and the remote-server agent surface.
 *
 * Everything here is pure data — no runtime behaviour — so each consumer can
 * either deep-import in TS/ESM or require this module in CJS without paying
 * for the rest of roku-dev-studio-api.
 *
 * Adding a field to one of these catalogs propagates to every consumer on
 * the next build. This is the explicit anti-drift module.
 */

'use strict';

const {
  RALE_NODE_FIELD_OPERATORS: RALE_NODE_FIELD_OPERATOR_NAMES,
  OPS_NEED_VALUE
} = require('./action-script-node-field-constants');

// =============================================================================
// Action Scripts — step grammar
// =============================================================================

/**
 * Every supported Action Script step type with its required / optional
 * fields, a label, and a human-readable description. Mirrors what the
 * Builder shows and what the executor accepts.
 *
 * To add a new step type:
 *   1. Add the entry below.
 *   2. Teach the validator (`validate-action-script.ts`) what its shape is.
 *   3. Teach the executor to run it.
 *   4. All downstream consumers (MCP tool catalog, Builder dropdown, docs)
 *      pick it up automatically.
 */
const STEP_SCHEMA = Object.freeze({
  query: {
    required: ['endpoint'],
    optional: [],
    label: 'Device Query',
    description:
      'ECP GET (e.g. /query/media-player) or dev telnet Plugins/Memory (presets telnet:plugins, telnet:free)'
  },
  post: {
    required: ['endpoint'],
    optional: [],
    label: 'POST',
    description: 'Run a POST (e.g. sgrendezvous/track)'
  },
  keypress: {
    required: ['key'],
    optional: [],
    label: 'Keypress',
    description: 'Send a remote key (e.g. Home, Select, Back)'
  },
  inputText: {
    required: ['text'],
    optional: [],
    label: 'Send Text',
    description: 'Send text input to the device'
  },
  launch: {
    required: ['appId'],
    optional: ['params'],
    label: 'Launch App',
    description: 'Launch app by ID'
  },
  sideload: {
    required: ['filePath'],
    optional: ['password'],
    label: 'Sideload',
    description: 'Upload and install a channel package'
  },
  deleteSideload: {
    required: [],
    optional: ['password'],
    label: 'Delete Sideload',
    description: 'Remove sideloaded channel'
  },
  appFunction: {
    required: ['functionName', 'functionParams'],
    optional: ['assignToVar'],
    label: 'App Function',
    description:
      'Execute a function via App Connector (RALE). For a one-off call prefer the direct `app_function` tool; only use this step inside a multi-step script. `functionParams` is a positional array with one entry per declared parameter — see `list_app_connector_functions` for the running channel\'s `params[]` shapes.'
  },
  raleCommand: {
    required: ['command', 'args'],
    optional: ['assignToVar'],
    label: 'RALE Command',
    description: 'Run a built-in RALE command (getNodeById, registry, …)'
  },
  screenshot: {
    required: [],
    optional: ['label', 'password', 'waitBeforeMs', 'waitAfterTriggerMs'],
    label: 'Screenshot',
    description: 'Capture screenshot and save to run folder'
  },
  devicePerformance: {
    required: ['chart'],
    optional: ['label'],
    label: 'Device Performance',
    description:
      'Capture charts for the device this script runs on: BrightScript Objects, CPU usage, system memory, or all three.'
  },
  wait: {
    required: [],
    optional: ['condition', 'delayMs', 'timeoutMs', 'pollIntervalMs'],
    label: 'Wait',
    description: 'Fixed delay (ms) or wait until condition (e.g. media-player state)'
  },
  if: {
    required: ['condition', 'then', 'else'],
    optional: [],
    label: 'If',
    description: 'Conditional branch (requires script version 2): run then or else steps'
  }
} as const);

/** Action Script version strings accepted by the validator. */
const SCRIPT_VERSIONS = Object.freeze(['1', '2'] as const);

/** Step types that write a screenshot / log and therefore need a save folder. */
const SAVE_ACTION_TYPES = Object.freeze(['screenshot'] as const);

/** Step types that require a device developer password. */
const PASSWORD_STEP_TYPES = Object.freeze(['screenshot', 'sideload', 'deleteSideload'] as const);

// =============================================================================
// ECP vocabularies
// =============================================================================

const KEYPRESS_GROUPS = Object.freeze([
  {
    label: 'Navigation & Selection',
    keys: [
      { value: 'Up', label: 'Up ▲' },
      { value: 'Down', label: 'Down ▼' },
      { value: 'Left', label: 'Left ◀' },
      { value: 'Right', label: 'Right ▶' },
      { value: 'Select', label: 'OK' },
      { value: 'Home', label: 'Home ⌂' },
      { value: 'Back', label: 'Back ←' }
    ]
  },
  {
    label: 'Media Playback',
    keys: [
      { value: 'Play', label: 'Play/Pause ⏯' },
      { value: 'InstantReplay', label: 'Instant Replay ↺' },
      { value: 'Fwd', label: 'Fwd ⏭' },
      { value: 'Rev', label: 'Rev ⏮' }
    ]
  }
] as const);

/** Flat list of allowed ECP key values (validator uses this). */
const KEYPRESS_OPTIONS = Object.freeze(
  KEYPRESS_GROUPS.flatMap((g) => g.keys.map((k) => k.value))
);

/** Pre-populated ECP / telnet GET endpoints for the Builder Query picker. */
const QUERY_PRESETS = Object.freeze([
  { endpoint: '/query/device-info', label: 'Device Info' },
  { endpoint: '/query/apps', label: 'All Apps' },
  { endpoint: '/query/active-app', label: 'Active App' },
  { endpoint: '/query/media-player', label: 'Media Player' },
  { endpoint: 'telnet:plugins', label: 'Plugins' },
  { endpoint: 'telnet:free', label: 'Memory' },
  { endpoint: '/query/sgnodes/all', label: 'SG Nodes (All)' },
  { endpoint: '/query/sgnodes/roots', label: 'SG Nodes (Roots)' },
  { endpoint: '/query/graphics-frame-rate', label: 'Frame Rate' },
  { endpoint: '/query/chanperf', label: 'Channel Perf' },
  { endpoint: '/query/app-state/dev', label: 'App State' },
  { endpoint: '/query/registry/dev', label: 'Registry' }
] as const);

/** Pre-populated POST endpoints. */
const POST_PRESETS = Object.freeze([
  { endpoint: '/sgrendezvous/track', label: 'SGRendezvous: Track' },
  { endpoint: '/sgrendezvous/untrack', label: 'SGRendezvous: Untrack' },
  { endpoint: '/fwbeacons/track/dev', label: 'FW Beacons: Track (dev)' },
  { endpoint: '/fwbeacons/untrack', label: 'FW Beacons: Untrack' }
] as const);

/** Dev telnet (port 8080) presets. */
const SYSTEM_TELNET_PRESETS = Object.freeze([
  { telnetCommand: 'plugins', label: 'Plugins' },
  { telnetCommand: 'free', label: 'Memory' }
] as const);

// =============================================================================
// Condition sources (wait + if)
// =============================================================================

const WAIT_SOURCES = Object.freeze(['media-player', 'rale-node-field'] as const);
const IF_SOURCES = Object.freeze([
  'media-player',
  'active-app',
  'rale-node-field',
  'variables'
] as const);

const MEDIA_PLAYER_STATES = Object.freeze([
  { value: 'play', label: 'Play' },
  { value: 'pause', label: 'Pause' },
  { value: 'buffer', label: 'Buffer' },
  { value: 'close', label: 'Close' },
  { value: 'startup', label: 'Startup' },
  { value: 'stop', label: 'Stop' }
] as const);

const ACTIVE_APP_IF_ATTRIBUTES = Object.freeze([
  { value: 'id', label: 'App ID' },
  { value: 'type', label: 'Type (e.g. home, appl)' },
  { value: 'version', label: 'App Version' },
  { value: 'name', label: 'App Name' }
] as const);

/**
 * RALE node-field operators with metadata. The simple string list lives in
 * `action-script-node-field-constants.ts`; this enriches it for agent
 * consumption (description + `requiresValue` per operator).
 */
const NODE_FIELD_OPERATOR_DEFS = Object.freeze(
  (RALE_NODE_FIELD_OPERATOR_NAMES as readonly string[]).map((operator) => ({
    operator,
    requiresValue: (OPS_NEED_VALUE as Set<string>).has(operator),
    description: nodeFieldOperatorDescription(operator)
  }))
);

function nodeFieldOperatorDescription(op: string): string {
  switch (op) {
    case 'is':
      return 'actual === expected (after optional case folding)';
    case 'isNot':
      return 'actual !== expected';
    case 'hasAnyValue':
      return 'Field exists and is not empty';
    case 'hasNoValue':
      return 'Missing node, missing field, or empty';
    case 'contains':
      return 'actual includes value as substring';
    case 'doesNotContain':
      return 'opposite of contains';
    case 'beginsWith':
      return 'actual starts with value';
    case 'endsWith':
      return 'actual ends with value';
    default:
      return op;
  }
}

// =============================================================================
// Device performance
// =============================================================================

const DEVICE_PERFORMANCE_CHART_IDS = Object.freeze([
  'objects',
  'cpu',
  'memory',
  'aboveAll'
] as const);

// =============================================================================
// RALE built-ins — agent-friendly normalized catalog
// =============================================================================

/**
 * Normalized catalog of RALE built-in commands, stripped of inspector UI
 * concerns (registryUi hints, display labels mixed into params). This is
 * what the MCP server / remote-server agents see. The inspector's own
 * richer shape stays in `components/inspector/rale-builtins.ts`.
 */
const RALE_BUILTINS = Object.freeze([
  {
    command: 'getNodeById',
    label: 'Get Node by ID',
    destructive: false,
    args: [
      { name: 'path', type: 'array<string|number>', required: true, description: 'Scene path; [] for root' },
      { name: 'id', type: 'string', required: true, description: 'Node id to look up' }
    ]
  },
  {
    command: 'getNodeByName',
    label: 'Get Node by Name (subtype / component class)',
    destructive: false,
    args: [
      { name: 'path', type: 'array<string|number>', required: true },
      { name: 'name', type: 'string', required: true }
    ]
  },
  {
    command: 'getRegistrySections',
    label: 'List Registry Sections',
    destructive: false,
    args: []
  },
  {
    command: 'addRegistrySection',
    label: 'Add Registry Section',
    destructive: true,
    args: [
      { name: 'name', type: 'string', required: true },
      { name: 'section', type: 'object<string,string>', required: true }
    ]
  },
  {
    command: 'removeRegistrySection',
    label: 'Remove Registry Section',
    destructive: true,
    args: [{ name: 'name', type: 'string', required: true }]
  },
  {
    command: 'addRegistryField',
    label: 'Add Registry Field',
    destructive: true,
    args: [
      { name: 'sectionName', type: 'string', required: true },
      { name: 'key', type: 'string', required: true },
      { name: 'value', type: 'string', required: false }
    ]
  },
  {
    command: 'removeRegistryField',
    label: 'Remove Registry Field',
    destructive: true,
    args: [
      { name: 'sectionName', type: 'string', required: true },
      { name: 'key', type: 'string', required: true }
    ]
  },
  {
    command: 'editRegistryField',
    label: 'Edit Registry Field',
    destructive: true,
    args: [
      { name: 'sectionName', type: 'string', required: true },
      { name: 'key', type: 'string', required: true },
      { name: 'newKey', type: 'string', required: true },
      { name: 'newValue', type: 'string', required: false }
    ]
  },
  {
    command: 'clearRegistry',
    label: 'Clear Registry',
    destructive: true,
    args: []
  }
] as const);

/** Set of RALE command names considered read-only — safe for agents to run without extra consent. */
const RALE_READ_ONLY_COMMANDS = Object.freeze(
  new Set(RALE_BUILTINS.filter((b) => !b.destructive).map((b) => b.command))
);

// =============================================================================
// Authoring rules for AI agents
// =============================================================================

const AUTHORING_RULES = Object.freeze([
  {
    id: 'version-2-for-if',
    rule: 'Use script version "2" whenever the script contains an `if` step. Use "1" otherwise.',
    rationale: 'Version 1 has no `if`; the executor rejects it.'
  },
  {
    id: 'no-passwords-in-json',
    rule:
      'Never emit literal devPassword / password values in generated scripts. Leave the field absent — the user will fill it in Builder before running.',
    rationale: 'Generated scripts are reviewed by humans; secrets must not flow through prompts/transports.'
  },
  {
    id: 'prefer-wait-over-delay',
    rule: 'Prefer `wait` with a `condition` over a fixed `delayMs`.',
    rationale: 'Conditions make scripts deterministic across devices; fixed delays are flaky.'
  },
  {
    id: 'screenshot-after-repro',
    rule: 'Add a `screenshot` step right after the claimed repro point in a bug ticket.',
    rationale: 'Provides evidence next to the action; cheap and high-value.'
  },
  {
    id: 'rale-step-needs-app-connector',
    rule:
      '`raleCommand` and `wait` / `if` with source `rale-node-field` require App Connector (RALE) to be connected on the device at run time.',
    rationale: 'These steps fail without a live RALE session.'
  },
  {
    id: 'app-function-needs-app-connector',
    rule:
      '`appFunction` requires the channel to advertise that name through `getExternalControlFunctions`.',
    rationale:
      'If the function is not in `list_app_connector_functions`, the executor will fail. Use the live tool to confirm names.'
  },
  {
    id: 'app-function-params-are-positional',
    rule:
      '`functionParams` is a positional array — one entry per declared parameter, in declaration order. For a single-`roAssociativeArray` param, wrap the payload (`functionParams: [ { …fields… } ]`); for zero args use `[]`. Prefer the `app_function` direct tool over an `appFunction` script step for one-off calls.',
    rationale:
      'A non-array `functionParams` is a different shape than the channel reads, so the call silently no-ops at runtime. Validation and the runtime tolerate a named object keyed by the declared param names and rewrite it to a positional array, but the rewrite relies on each key exactly matching a declared param name — a typo silently passes `undefined` for that slot. Author positional from the start.'
  }
] as const);

// =============================================================================
// Exports (CJS to match the rest of roku-dev-studio-api's lib/ convention)
// =============================================================================

module.exports = {
  STEP_SCHEMA,
  SCRIPT_VERSIONS,
  SAVE_ACTION_TYPES,
  PASSWORD_STEP_TYPES,
  KEYPRESS_GROUPS,
  KEYPRESS_OPTIONS,
  QUERY_PRESETS,
  POST_PRESETS,
  SYSTEM_TELNET_PRESETS,
  WAIT_SOURCES,
  IF_SOURCES,
  MEDIA_PLAYER_STATES,
  ACTIVE_APP_IF_ATTRIBUTES,
  NODE_FIELD_OPERATOR_DEFS,
  DEVICE_PERFORMANCE_CHART_IDS,
  RALE_BUILTINS,
  RALE_READ_ONLY_COMMANDS,
  AUTHORING_RULES
};

/**
 * MCP Resources — lazily-loaded docs that keep the initial `tools/list` small.
 *
 * Hosts advertise the (name, URI, description, mimeType) list cheaply at
 * connect time; bodies are only fetched when the user or agent explicitly
 * reads a resource. This is where the agent-facing "skill" content lives.
 */

import { ACTION_SCRIPT_AGENT_CONTRACT } from './agent-contract.js';
import QUICK_START_MD from './prose/quick-start.md';

const catalogs = require('roku-dev-studio-api/lib/catalogs') as {
  STEP_SCHEMA: Record<
    string,
    { required: readonly string[]; optional: readonly string[]; label: string; description: string }
  >;
  SCRIPT_VERSIONS: readonly string[];
  KEYPRESS_GROUPS: ReadonlyArray<{ label: string; keys: ReadonlyArray<{ value: string; label: string }> }>;
  KEYPRESS_OPTIONS: readonly string[];
  QUERY_PRESETS: ReadonlyArray<{ endpoint: string; label: string }>;
  POST_PRESETS: ReadonlyArray<{ endpoint: string; label: string }>;
  MEDIA_PLAYER_STATES: ReadonlyArray<{ value: string; label: string }>;
  ACTIVE_APP_IF_ATTRIBUTES: ReadonlyArray<{ value: string; label: string }>;
  WAIT_SOURCES: readonly string[];
  IF_SOURCES: readonly string[];
  DEVICE_PERFORMANCE_CHART_IDS: readonly string[];
  NODE_FIELD_OPERATOR_DEFS: ReadonlyArray<{ operator: string; requiresValue: boolean; description: string }>;
  RALE_BUILTINS: ReadonlyArray<{ command: string; label: string; destructive: boolean; args: ReadonlyArray<unknown> }>;
  AUTHORING_RULES: ReadonlyArray<{ id: string; rule: string; rationale: string }>;
};

const operations = require('roku-dev-studio-api/lib/operations') as {
  ALL_OPS: ReadonlyArray<{ id: string; title: string; runIn: 'main' | 'renderer'; destructive: boolean }>;
};

export type ResourceDescriptor = {
  uri: string;
  name: string;
  title?: string;
  description: string;
  mimeType: 'text/markdown' | 'application/json';
};

export type ResourceContent =
  | { uri: string; mimeType: 'text/markdown'; text: string }
  | { uri: string; mimeType: 'application/json'; text: string };

const RESOURCES: ResourceDescriptor[] = [
  {
    uri: 'roku-dev-studio://quick-start.md',
    name: 'quick-start',
    title: 'Roku Dev Studio MCP — Quick Start',
    description:
      'One-page primer: bridge probe, capability loading, device selection, and the validate → send workflow. Read first.',
    mimeType: 'text/markdown'
  },
  {
    uri: 'roku-dev-studio://action-script-contract.md',
    name: 'action-script-contract',
    title: 'Action Script JSON contract',
    description:
      'Canonical shape for validate_script / send_script_to_builder inputs (root, appFunction params, wait / if conditions).',
    mimeType: 'text/markdown'
  },
  {
    uri: 'roku-dev-studio://capability-bundle.json',
    name: 'capability-bundle',
    title: 'Static capability bundle',
    description:
      'Every static catalog the agent needs in one JSON: actions, presets, vocabularies, RALE built-ins, authoring rules, op directory, and the agent contract.',
    mimeType: 'application/json'
  },
  {
    uri: 'roku-dev-studio://authoring-rules.json',
    name: 'authoring-rules',
    title: 'Hard authoring rules',
    description:
      'Constraints the agent must obey when generating Action Scripts (version, password handling, wait vs delay, …).',
    mimeType: 'application/json'
  }
];

/**
 * Single source of truth for the capability bundle object. Both the
 * `get_capability_bundle` tool and the `capability-bundle.json` resource call
 * this so they can never drift apart.
 */
export function buildCapabilityBundle(): object {
  return {
    schemaVersion: 2,
    actionScriptAgentContract: ACTION_SCRIPT_AGENT_CONTRACT,
    scriptVersions: catalogs.SCRIPT_VERSIONS,
    actions: Object.keys(catalogs.STEP_SCHEMA).map((type) => ({
      type,
      ...catalogs.STEP_SCHEMA[type]
    })),
    keypress: { groups: catalogs.KEYPRESS_GROUPS, all: catalogs.KEYPRESS_OPTIONS },
    presets: { query: catalogs.QUERY_PRESETS, post: catalogs.POST_PRESETS },
    conditions: {
      waitSources: catalogs.WAIT_SOURCES,
      ifSources: catalogs.IF_SOURCES,
      mediaPlayerStates: catalogs.MEDIA_PLAYER_STATES,
      activeAppAttributes: catalogs.ACTIVE_APP_IF_ATTRIBUTES,
      raleNodeFieldOperators: catalogs.NODE_FIELD_OPERATOR_DEFS
    },
    devicePerformanceCharts: catalogs.DEVICE_PERFORMANCE_CHART_IDS,
    raleBuiltins: catalogs.RALE_BUILTINS,
    authoringRules: catalogs.AUTHORING_RULES,
    ops: operations.ALL_OPS.map((op) => ({
      id: op.id,
      title: op.title,
      runIn: op.runIn,
      destructive: op.destructive
    }))
  };
}

function buildCapabilityBundleJson(): string {
  return JSON.stringify(buildCapabilityBundle(), null, 2);
}

export function listResources(): ResourceDescriptor[] {
  return RESOURCES;
}

export function readResource(uri: string): ResourceContent | null {
  switch (uri) {
    case 'roku-dev-studio://quick-start.md':
      return { uri, mimeType: 'text/markdown', text: QUICK_START_MD };
    case 'roku-dev-studio://action-script-contract.md':
      return { uri, mimeType: 'text/markdown', text: ACTION_SCRIPT_AGENT_CONTRACT };
    case 'roku-dev-studio://capability-bundle.json':
      return { uri, mimeType: 'application/json', text: buildCapabilityBundleJson() };
    case 'roku-dev-studio://authoring-rules.json':
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ rules: catalogs.AUTHORING_RULES }, null, 2)
      };
    default:
      return null;
  }
}

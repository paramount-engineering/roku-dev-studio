/**
 * Action Script action types and their required/optional inputs.
 *
 * The **data** — STEP_SCHEMA, keypress groups, ECP presets, condition
 * sources, the node-field operator list — lives in the shared catalog
 * (`packages/roku-dev-studio-api/lib/catalogs.ts`) and is exposed to the
 * renderer via `window.rdsCatalogs` (preload bridge). That single source is
 * also consumed by the MCP server and (eventually) the remote-server agent
 * surface, so adding a new step type, key, or preset propagates everywhere
 * without touching this file.
 *
 * The **helpers** (`scriptNeedsRaleConnection`, `scriptHasSaveActions`,
 * `scriptNeedsPassword`, `queryEndpointToTelnetCommand`, etc.) live here
 * because they walk script trees and are only meaningful in the Action
 * Scripts UI context.
 */

/**
 * Preserves the literal tuple shape that `DEVICE_PERFORMANCE_CHART_IDS`
 * originally carried via `as const`, so exhaustiveness checks downstream
 * (e.g. device-metrics-performance-step switch) still narrow to `never`.
 */
type DevicePerformanceChartTuple = readonly ['objects', 'cpu', 'memory', 'aboveAll'];

type CatalogsShape = {
  STEP_SCHEMA: Record<string, { required: readonly string[]; optional: readonly string[]; label: string; description: string }>;
  SCRIPT_VERSIONS: readonly string[];
  SAVE_ACTION_TYPES: readonly string[];
  PASSWORD_STEP_TYPES: readonly string[];
  KEYPRESS_GROUPS: ReadonlyArray<{ label: string; keys: ReadonlyArray<{ value: string; label: string }> }>;
  KEYPRESS_OPTIONS: readonly string[];
  QUERY_PRESETS: ReadonlyArray<{ endpoint: string; label: string }>;
  POST_PRESETS: ReadonlyArray<{ endpoint: string; label: string }>;
  SYSTEM_TELNET_PRESETS: ReadonlyArray<{ telnetCommand: string; label: string }>;
  WAIT_SOURCES: readonly string[];
  IF_SOURCES: readonly string[];
  MEDIA_PLAYER_STATES: ReadonlyArray<{ value: string; label: string }>;
  ACTIVE_APP_IF_ATTRIBUTES: ReadonlyArray<{ value: string; label: string }>;
  DEVICE_PERFORMANCE_CHART_IDS: DevicePerformanceChartTuple;
};

declare global {
  interface Window {
    rdsCatalogs?: CatalogsShape;
  }
}

function getCatalogs(): CatalogsShape {
  const c = typeof window !== 'undefined' ? window.rdsCatalogs : undefined;
  if (!c) {
    throw new Error(
      'Catalogs unavailable — preload bridge missing `rdsCatalogs`. Ensure the renderer runs inside Dev Studio (not a bare browser).'
    );
  }
  return c;
}

// Pure data passthroughs. These names are the renderer's existing contract
// with its consumers (builder, validator, executor, etc.); don't rename
// without a codemod. Values come from the shared catalog.
export const STEP_SCHEMA = getCatalogs().STEP_SCHEMA;
export const DEVICE_PERFORMANCE_CHART_IDS = getCatalogs().DEVICE_PERFORMANCE_CHART_IDS;
export type DevicePerformanceChartId = (typeof DEVICE_PERFORMANCE_CHART_IDS)[number];
export const SAVE_ACTION_TYPES = getCatalogs().SAVE_ACTION_TYPES;
export const POST_PRESETS = getCatalogs().POST_PRESETS;
export const QUERY_PRESETS = getCatalogs().QUERY_PRESETS;
export const SYSTEM_TELNET_PRESETS = getCatalogs().SYSTEM_TELNET_PRESETS;
export const SYSTEM_TELNET_COMMANDS = SYSTEM_TELNET_PRESETS.map((p) => p.telnetCommand);
export const WAIT_SOURCES = getCatalogs().WAIT_SOURCES;
export const IF_SOURCES = getCatalogs().IF_SOURCES;
export const ACTIVE_APP_IF_ATTRIBUTES = getCatalogs().ACTIVE_APP_IF_ATTRIBUTES;
export const MEDIA_PLAYER_STATES = getCatalogs().MEDIA_PLAYER_STATES;
export const KEYPRESS_GROUPS = getCatalogs().KEYPRESS_GROUPS;
export const KEYPRESS_OPTIONS = getCatalogs().KEYPRESS_OPTIONS;

/**
 * Map a Device Query `endpoint` to a dev telnet command, or null for normal
 * ECP GET.
 */
export function queryEndpointToTelnetCommand(endpoint) {
  if (endpoint == null || typeof endpoint !== 'string') return null;
  const e = endpoint.trim();
  if (e === '/query/plugins') return 'plugins';
  if (e === 'telnet:plugins') return 'plugins';
  if (e === 'telnet:free') return 'free';
  return null;
}

/** Preset label for executor/builder lists, or the raw endpoint for custom values. */
export function queryEndpointLabel(endpoint) {
  if (endpoint == null || endpoint === '') return '?';
  const p = QUERY_PRESETS.find((x) => x.endpoint === endpoint);
  if (p) return p.label;
  return String(endpoint);
}

/**
 * @param {unknown[]} steps
 * @param {(s: { type?: string, condition?: { source?: string }, password?: string }) => void} visitor
 */
function walkSteps(steps, visitor) {
  if (!Array.isArray(steps)) return;
  for (const s of steps) {
    if (!s || typeof s !== 'object') continue;
    visitor(s);
    if (s.type === 'if') {
      walkSteps(s.then, visitor);
      walkSteps(s.else, visitor);
    }
  }
}

/**
 * Whether the script needs an App Connector (RALE) connection for at least one step.
 */
export function scriptNeedsRaleConnection(script) {
  if (!script || !Array.isArray(script.steps)) return false;
  let need = false;
  walkSteps(script.steps, (s) => {
    if (!s.type) return;
    if (s.type === 'appFunction' || s.type === 'raleCommand') need = true;
    if (s.type === 'wait' && s.condition && s.condition.source === 'rale-node-field') need = true;
    if (s.type === 'if' && s.condition && s.condition.source === 'rale-node-field') need = true;
  });
  return need;
}

export function getStepTypes() {
  return Object.keys(STEP_SCHEMA);
}

export function getSchema(type) {
  return STEP_SCHEMA[type] || null;
}

export function scriptHasSaveActions(script) {
  if (!script || !Array.isArray(script.steps)) return false;
  let found = false;
  walkSteps(script.steps, (s) => {
    if ((SAVE_ACTION_TYPES as readonly string[]).includes(s.type)) found = true;
  });
  return found;
}

/**
 * Check if any step in the script needs a Dev Password that isn't already provided
 * in the step itself or at the script level (devPassword).
 */
export function scriptNeedsPassword(script) {
  if (!script || !Array.isArray(script.steps)) return false;
  if (script.devPassword) return false;
  const passwordSteps = getCatalogs().PASSWORD_STEP_TYPES as readonly string[];
  let need = false;
  walkSteps(script.steps, (s) => {
    if (!passwordSteps.includes(s.type)) return;
    if (!s.password) need = true;
  });
  return need;
}

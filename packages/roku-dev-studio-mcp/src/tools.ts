/**
 * MCP tool catalog. Three tiers:
 *
 *   1. **Discovery / meta** — hand-written tools that expose the static
 *      catalogs (list_action_types, get_capability_bundle, authoring rules).
 *      These are pure data lookups against `roku-dev-studio-api/lib/catalogs`.
 *
 *   2. **Auto-generated op-backed tools** — every entry in `ALL_OPS` is
 *      exposed as a tool via `opToMcpTool`. Names, titles, descriptions,
 *      input schemas, and the destructive flag all come from the
 *      descriptor — zero per-tool boilerplate here. Main-direct ops route
 *      through the bridge's `POST /op/<id>`; renderer ops go through
 *      `POST /tool`.
 *
 *   3. **Bespoke tools** — Dev Studio-specific helpers that don't fit the
 *      "device op" shape (probe_bridge, list_devices, connect_device,
 *      send_script_to_builder, validate_script, ...). Hand-written; each
 *      explained inline.
 */

import { validateScript } from './validator.js';
import { bridgeRequest, getBridgeStatus } from './bridge-client.js';
import { wrapValidationForAgent, formatValidationErrorsForAgent } from './agent-contract.js';
import { buildCapabilityBundle } from './resources.js';
import { logOutputSchemaIssues, validateOutput } from './output-schema-validator.js';
import { mcpError } from './log.js';

// Single source of truth for catalogs + op descriptors.
const catalogs = require('roku-dev-studio-api/lib/catalogs') as {
  STEP_SCHEMA: Record<string, { required: readonly string[]; optional: readonly string[]; label: string; description: string }>;
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

type RokuOpDescriptor = {
  id: string;
  title: string;
  description: string;
  runIn: 'main' | 'renderer';
  destructive: boolean;
  /**
   * True only for genuine reads. Distinct from `!destructive`: a mutating-but-
   * non-destructive op (keypress, launch_app, input_text) is
   * `readOnly: false, destructive: false`. Drives `readOnlyHint` /
   * `idempotentHint` — do NOT fall back to `!destructive` here.
   */
  readOnly: boolean;
  inputSchema: ToolInputSchema;
  /**
   * Each op declares the JSON-Schema shape of its 2xx response body.
   * `output-schema-validator.ts` consumes it (warn-only) so a regression
   * that silently changes the response shape shows up in the host log.
   */
  outputSchema: ToolInputSchema;
};

const operations = require('roku-dev-studio-api/lib/operations') as {
  ALL_OPS: ReadonlyArray<RokuOpDescriptor>;
  MAIN_OPS: ReadonlyArray<RokuOpDescriptor>;
  RENDERER_OPS: ReadonlyArray<RokuOpDescriptor>;
};

type StepType = keyof typeof catalogs.STEP_SCHEMA;

// ============================================================================
// Tool plumbing
// ============================================================================

export type ToolInputSchema = {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

/**
 * MCP (2025-03-26) tool behavioural hints. Lets hosts render badges / prompts
 * without re-parsing prose descriptions, and saves per-tool tokens.
 */
export type ToolAnnotations = {
  /** `true` = tool does not mutate state; safe for autonomous use. */
  readOnlyHint?: boolean;
  /** `true` = tool may have destructive side effects (reinstall, reboot, launch). */
  destructiveHint?: boolean;
  /** `true` = calling twice with same args is a no-op after the first success. */
  idempotentHint?: boolean;
  /** `true` = tool touches the outside world (device, network) vs pure computation. */
  openWorldHint?: boolean;
};

export type Tool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: ToolInputSchema;
  annotations?: ToolAnnotations;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};

type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image'; data: string; mimeType: string };

export type ToolResult = {
  content: Array<TextContent | ImageContent>;
  isError?: boolean;
  structuredContent?: unknown;
};

function jsonResult(
  value: unknown,
  options?: { preamble?: string; isError?: boolean }
): ToolResult {
  const body = JSON.stringify(value, null, 2);
  const text = options?.preamble ? `${options.preamble}\n\n${body}` : body;
  return {
    content: [{ type: 'text', text }],
    structuredContent: value,
    ...(options?.isError ? { isError: true as const } : {})
  };
}

/**
 * Tool-level failure: always set isError so hosts surface this to the user/agent.
 * Put the human-readable story in `message`; machine fields in `structured`.
 */
function errorResult(message: string, structured?: unknown): ToolResult {
  const text =
    structured !== undefined
      ? `${message}\n\n--- structured ---\n${JSON.stringify(structured, null, 2)}`
      : message;
  return { content: [{ type: 'text', text }], isError: true, structuredContent: structured };
}

/**
 * If the bridge payload contains `imageBase64` + `imageMimeType`, build a
 * ToolResult that includes an MCP image content block so hosts (Cursor, Claude
 * Desktop, etc.) can render the screenshot inline without any agent-side
 * decoding. The base64 blob is stripped from the JSON summary to avoid
 * duplicating ~88 KB of text.
 *
 * We also lead with a one-line text content block summarizing the capture
 * (ip / filename / size). Hosts that collapse tool-result cards by default
 * (Claude Desktop, Cursor, ChatGPT Desktop) show the first text content as
 * the card preview, so that line is what the user sees before clicking to
 * expand and view the actual image.
 */
function imageResultIfPresent(body: unknown): ToolResult | null {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const base64 = typeof b.imageBase64 === 'string' ? b.imageBase64 : null;
  const mimeType = typeof b.imageMimeType === 'string' ? b.imageMimeType : 'image/jpeg';
  if (!base64) return null;
  const { imageBase64: _dropped, ...meta } = b;
  const ip = typeof meta.ip === 'string' && meta.ip ? (meta.ip as string) : '';
  const filename = typeof meta.filename === 'string' && meta.filename ? (meta.filename as string) : '';
  const bytes = typeof meta.bytes === 'number' && Number.isFinite(meta.bytes) ? (meta.bytes as number) : 0;
  const summary =
    'Screenshot' +
    (ip ? ` from ${ip}` : '') +
    (filename ? ` — ${filename}` : '') +
    (bytes ? `, ${formatBytes(bytes)}` : '') +
    ` (${mimeType})`;
  return {
    content: [
      { type: 'text', text: summary },
      { type: 'image', data: base64, mimeType }
    ],
    structuredContent: meta
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function optionalDevice(args: Record<string, unknown>): string | undefined {
  const v = args.device;
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s ? s : undefined;
}

function bridgeToolFailure(label: string, res: { ok: false; status: number; error: string }): ToolResult {
  return errorResult(
    `${label}: ${res.error} (HTTP ${res.status}). If you have not already, call probe_bridge once to confirm Roku Dev Studio is running; also confirm the correct device tab is focused (or pass device).`,
    { httpStatus: res.status, bridgeError: res.error }
  );
}

/**
 * Warn-only output-schema check. Validates the bridge's response body
 * against the op's declared `outputSchema`; mismatches are logged to
 * stderr (the host's diagnostic pane) but the response still flows back
 * to the agent unchanged. We deliberately keep this non-failing while
 * the schemas themselves are still being tightened — converting to a
 * hard reject is a one-line change once the noise floor is zero.
 */
function warnOnOutputSchemaMismatch(op: RokuOpDescriptor, body: unknown): void {
  if (!op.outputSchema) return;
  try {
    const issues = validateOutput(body, op.outputSchema as Parameters<typeof validateOutput>[1]);
    logOutputSchemaIssues(op.id, issues);
  } catch (e) {
    // Validator should never throw; if it does, treat as warn-only.
    // eslint-disable-next-line no-console
    mcpError(`[output-schema] ${op.id}: validator threw`, e);
  }
}

// ============================================================================
// Auto-generated op-backed tool factory
// ============================================================================

/**
 * Translate an op's strict `ip` schema into the agent-friendly `device`
 * field. Agents see `device: "<IP or serial>"`; the bridge resolves to ip
 * before dispatching the op. Keeps the op descriptor pure while the tool
 * catalog stays ergonomic for LLMs.
 */
function agentFacingSchema(schema: ToolInputSchema): ToolInputSchema {
  const props: Record<string, unknown> = schema.properties ? { ...schema.properties } : {};
  const hadIp = 'ip' in props;
  if (hadIp) {
    delete props.ip;
    props.device = {
      type: 'string',
      description:
        'Target device — IP (e.g. "192.168.1.154") or serial (e.g. "X00046N6S6F"). Omit to use the focused device.'
    };
  }
  const required = (schema.required || []).filter((r) => r !== 'ip');
  return {
    type: 'object',
    properties: props,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: schema.additionalProperties ?? false
  };
}

/**
 * Translate a `RokuOp` descriptor into a live MCP tool. Every main-direct op
 * routes to the bridge's `POST /op/<id>`. Renderer ops go through
 * `POST /tool` so the renderer's per-device handler receives the call.
 */
function opToMcpTool(op: RokuOpDescriptor): Tool {
  // `readOnlyHint` derives from the op's explicit `readOnly` axis, NOT from
  // `!destructive`. A mutating-but-non-destructive op (keypress, launch_app,
  // input_text, deep_link) is `readOnly: false, destructive: false` — deriving
  // the hint from `!destructive` would mislabel it read-only and contradict its
  // description. Per MCP semantics `destructiveHint`/`idempotentHint` are only
  // meaningful when `readOnlyHint` is false; reads are inherently idempotent,
  // and for writes we don't claim idempotency here (safe under-claim).
  const annotations: ToolAnnotations = {
    readOnlyHint: op.readOnly,
    destructiveHint: op.destructive,
    idempotentHint: op.readOnly,
    openWorldHint: true
  };
  return {
    name: op.id,
    title: op.title,
    description: op.description,
    inputSchema: agentFacingSchema(op.inputSchema as ToolInputSchema),
    annotations,
    handler: async (args: Record<string, unknown>) => {
      try {
        if (op.runIn === 'main') {
          const res = await bridgeRequest({
            method: 'POST',
            pathname: `/op/${op.id}`,
            body: args
          });
          if (!res.ok) {
            return errorResult(
              `Tool "${op.id}" failed: ${res.error} (HTTP ${res.status}). ` +
                'If you have not already, call probe_bridge once to confirm Dev Studio is running; also confirm the correct device tab is focused (or pass device).',
              { tool: op.id, httpStatus: res.status, bridgeError: res.error }
            );
          }
          warnOnOutputSchemaMismatch(op, res.body);
          return imageResultIfPresent(res.body) ?? jsonResult(res.body);
        }
        // Renderer-routed: shape the payload `/tool` expects (tool name + args + device).
        const device = optionalDevice(args);
        const payload: Record<string, unknown> = { tool: op.id, args };
        if (device) payload.device = device;
        const res = await bridgeRequest({ method: 'POST', pathname: '/tool', body: payload });
        if (!res.ok) {
          return errorResult(
            `Tool "${op.id}" failed: ${res.error} (HTTP ${res.status}). ` +
              'If you have not already, call probe_bridge once to confirm Dev Studio is running; also confirm the correct device tab is focused (or pass device).',
            { tool: op.id, httpStatus: res.status, bridgeError: res.error }
          );
        }
        warnOnOutputSchemaMismatch(op, res.body);
        return imageResultIfPresent(res.body) ?? jsonResult(res.body);
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
    }
  };
}

const OP_BACKED_TOOLS: Tool[] = operations.ALL_OPS.map((op) => opToMcpTool(op));

// ============================================================================
// Tier 1: Discovery / meta tools (pure catalog lookups; always available)
// ============================================================================

function listActionTypes(): ToolResult {
  const types = (Object.keys(catalogs.STEP_SCHEMA) as StepType[]).map((type) => ({
    type,
    label: catalogs.STEP_SCHEMA[type].label,
    description: catalogs.STEP_SCHEMA[type].description,
    required: catalogs.STEP_SCHEMA[type].required,
    optional: catalogs.STEP_SCHEMA[type].optional
  }));
  return jsonResult({ scriptVersions: [...catalogs.SCRIPT_VERSIONS], actions: types });
}

function getActionSchema(args: Record<string, unknown>): ToolResult {
  const type = String(args.type || '').trim();
  if (!type || !(type in catalogs.STEP_SCHEMA)) {
    return errorResult(
      `Unknown step type "${type || '(empty)'}". Required argument "type" must be one of the keys from list_action_types.`,
      { code: 'unknown_action_type', argument: 'type', received: type || null, expected: Object.keys(catalogs.STEP_SCHEMA) }
    );
  }
  return jsonResult({ type, ...catalogs.STEP_SCHEMA[type as StepType] });
}

function getCapabilityBundle(): ToolResult {
  // Delegates to the shared builder in resources.ts so this tool and the
  // capability-bundle.json resource always return the same payload.
  return jsonResult(buildCapabilityBundle());
}

// ============================================================================
// Tier 3: Bespoke bridge tools (not device ops)
// ============================================================================

async function probeBridge(): Promise<ToolResult> {
  const status = await getBridgeStatus();
  if (status.live) {
    return jsonResult({
      live: true,
      pid: status.descriptor.pid,
      port: status.descriptor.port,
      startedAt: status.descriptor.startedAt
    });
  }
  return jsonResult({ live: false, reason: status.reason });
}

async function getSelectedDevice(): Promise<ToolResult> {
  const res = await bridgeRequest({ method: 'GET', pathname: '/selected-device' });
  if (!res.ok) return bridgeToolFailure('get_selected_device', res);
  return jsonResult(res.body);
}

async function listDevices(): Promise<ToolResult> {
  const res = await bridgeRequest({ method: 'GET', pathname: '/devices' });
  if (!res.ok) return bridgeToolFailure('list_devices', res);
  return jsonResult(res.body);
}

async function listAppConnectorFunctions(args: Record<string, unknown>): Promise<ToolResult> {
  const device = optionalDevice(args);
  const pathname = device
    ? `/app-connector/functions?device=${encodeURIComponent(device)}`
    : '/app-connector/functions';
  const res = await bridgeRequest({ method: 'GET', pathname });
  if (!res.ok) return bridgeToolFailure('list_app_connector_functions', res);
  return jsonResult(res.body);
}

async function connectDeviceTool(args: Record<string, unknown>): Promise<ToolResult> {
  const device = optionalDevice(args);
  if (!device) {
    return errorResult(
      'Missing required argument "device". Pass a string: Roku IP (e.g. "192.168.1.75") or serial from list_devices.',
      { code: 'missing_device', argument: 'device' }
    );
  }
  const res = await bridgeRequest({ method: 'POST', pathname: '/connect-device', body: { device } });
  if (!res.ok) return bridgeToolFailure('connect_device', res);
  return jsonResult(res.body);
}

function validateScriptTool(args: Record<string, unknown>): ToolResult {
  let script: unknown = args.script;
  if (typeof script === 'string') {
    try {
      script = JSON.parse(script);
    } catch (e) {
      return errorResult(
        `Invalid input: could not parse argument "script" as JSON — ${e instanceof Error ? e.message : String(e)}. Pass a JSON object or a string containing the full script JSON.`,
        { code: 'script_parse_error', argument: 'script' }
      );
    }
  }
  if (script == null) {
    return errorResult(
      'Invalid input: missing required argument "script". Provide the Action Script as a JSON object (preferred) or as a JSON string.',
      { code: 'missing_script', argument: 'script' }
    );
  }
  if (typeof script !== 'object' || Array.isArray(script)) {
    return errorResult(
      'Invalid input: "script" must be a JSON object with at least a "steps" array, not an array or primitive.',
      { code: 'script_not_object', received: typeof script }
    );
  }
  const raw = validateScript(script);
  const payload = wrapValidationForAgent(raw);
  if (!payload.ok) {
    return jsonResult(payload, {
      preamble:
        'Action Script validation failed (ok=false). Fix every entry in `errors` (use `path` and `code`). `humanSummary` duplicates the same issues in plain text. See `referenceTools` for which discovery tools to call next.',
      isError: true
    });
  }
  return jsonResult(payload, {
    preamble:
      'Action Script validation succeeded (ok=true). Before handing this script to the Builder with send_script_to_builder, confirm appFunction names still match list_app_connector_functions for that channel. (Reminder: for a single deterministic action, prefer the matching direct op — keypress / launch_app / ecp_post / rale_command / screenshot — over an Action Script.)'
  });
}

async function sendScriptToBuilder(args: Record<string, unknown>): Promise<ToolResult> {
  let script: unknown = args.script;
  if (typeof script === 'string') {
    try {
      script = JSON.parse(script);
    } catch (e) {
      return errorResult(
        `Invalid input: could not parse "script" as JSON — ${e instanceof Error ? e.message : String(e)}.`,
        { code: 'script_parse_error', argument: 'script' }
      );
    }
  }
  if (script == null) {
    return errorResult('Invalid input: missing required argument "script".', {
      code: 'missing_script',
      argument: 'script'
    });
  }
  if (typeof script !== 'object' || Array.isArray(script)) {
    return errorResult('Invalid input: "script" must be a JSON object with a "steps" array.', {
      code: 'script_not_object'
    });
  }
  const validation = validateScript(script);
  if (!validation.ok) {
    const wrapped = wrapValidationForAgent(validation);
    return errorResult(
      `Refusing to send: the same structural checks as validate_script failed.\n\n${formatValidationErrorsForAgent(validation.errors)}\n\nCall validate_script with this script, fix every error until ok=true, then retry send_script_to_builder.`,
      wrapped
    );
  }
  const device = optionalDevice(args);
  const res = await bridgeRequest({
    method: 'POST',
    pathname: '/builder/drop-script',
    body: device ? { script, device } : { script }
  });
  if (!res.ok) {
    return errorResult(
      `Bridge refused drop-script: ${res.error} (HTTP ${res.status}). Dev Studio must be running with Action Scripts / Builder available on the target tab.`,
      { httpStatus: res.status, bridgeError: res.error, device: device || null }
    );
  }
  return jsonResult({
    delivered: true,
    note: 'Script handed off to the Roku Dev Studio Builder. Ask the user to review and run.',
    bridge: res.body,
    inputReminder:
      'Arguments used: script (object), device (optional). Same script shape as validate_script; see get_capability_bundle.actionScriptAgentContract.'
  });
}

/**
 * Convenience wrapper around `rale_command` for the most common read-only
 * lookup. Agents can call this directly; it just translates to the full
 * rale_command under the hood.
 */
async function raleGetNodeByIdTool(args: Record<string, unknown>): Promise<ToolResult> {
  const path = Array.isArray(args.path) ? args.path : [];
  const id = String(args.id || '').trim();
  if (!id) {
    return errorResult('Missing required argument "id" (non-empty string).', {
      code: 'missing_id',
      argument: 'id'
    });
  }
  const device = optionalDevice(args);
  const payload: Record<string, unknown> = {
    tool: 'rale_command',
    args: { command: 'getNodeById', args: { path, id } }
  };
  if (device) payload.device = device;
  const res = await bridgeRequest({ method: 'POST', pathname: '/tool', body: payload });
  if (!res.ok) return bridgeToolFailure('rale_get_node_by_id', res);
  return jsonResult(res.body);
}

// ----------------------------------------------------------------------------
// Network Inspector (read-only). Whole-hotspot packet/HTTP capture that Dev
// Studio runs in its main process. All gated on the feature being enabled;
// when disabled the bridge returns structured remediation (surface it to the
// user). HTTPS request/response bodies are only present when the MITM proxy is
// active (CA injected into the sideloaded channel); otherwise expect HTTP plus
// DNS/TLS metadata only.
// ----------------------------------------------------------------------------

async function networkInspectorStatusTool(): Promise<ToolResult> {
  const res = await bridgeRequest({ method: 'GET', pathname: '/network-inspector/status' });
  if (!res.ok) return bridgeToolFailure('network_inspector_status', res);
  return jsonResult(res.body);
}

async function networkInspectorListEventsTool(args: Record<string, unknown>): Promise<ToolResult> {
  const res = await bridgeRequest({ method: 'POST', pathname: '/network-inspector/events', body: args });
  if (!res.ok) return bridgeToolFailure('network_inspector_list_events', res);
  return jsonResult(res.body);
}

async function networkInspectorGetEventDetailTool(args: Record<string, unknown>): Promise<ToolResult> {
  const id = String(args.id || '').trim();
  if (!id) {
    return errorResult('Missing required argument "id" (an event id from network_inspector_list_events).', {
      code: 'missing_id',
      argument: 'id'
    });
  }
  const res = await bridgeRequest({ method: 'POST', pathname: '/network-inspector/event-detail', body: args });
  if (!res.ok) return bridgeToolFailure('network_inspector_get_event_detail', res);
  return jsonResult(res.body);
}

async function networkInspectorAnalyzeTool(args: Record<string, unknown>): Promise<ToolResult> {
  const res = await bridgeRequest({ method: 'POST', pathname: '/network-inspector/analyze', body: args });
  if (!res.ok) return bridgeToolFailure('network_inspector_analyze', res);
  return jsonResult(res.body);
}

async function networkInspectorGetCaInfoTool(): Promise<ToolResult> {
  const res = await bridgeRequest({ method: 'GET', pathname: '/network-inspector/ca-info' });
  if (!res.ok) return bridgeToolFailure('network_inspector_get_ca_info', res);
  return jsonResult(res.body);
}

const NETWORK_EVENT_TYPES = [
  'dns-query',
  'dns-response',
  'tls-handshake',
  'tcp-connection',
  'udp-datagram',
  'http-transaction'
] as const;

const NETWORK_INSPECTOR_TOOLS: Tool[] = [
  {
    name: 'network_inspector_status',
    title: 'Network Inspector: Status',
    description:
      'Report whether Dev Studio\'s Network Inspector is enabled and actively capturing, plus connected Roku clients, packet/event counts, MITM (HTTPS decryption) state, and `prerequisites[]` remediation. **Call this first** before the other network_inspector_* tools — if `ready` is false, relay `notice` / `remediation` to the user (enable the feature, grant capture access, connect the Roku to the hotspot). Reads return nothing useful until `ready` is true.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => networkInspectorStatusTool()
  },
  {
    name: 'network_inspector_list_events',
    title: 'Network Inspector: List Events',
    description:
      'List captured network events as lightweight summaries (no full headers/body — drill down with network_inspector_get_event_detail using an event `id`). Summary-first by design to protect context. All filters optional and AND-combined: `device` (IP or serial; omit for all Rokus on the hotspot), `host` (case-insensitive substring of hostname/SNI/URL), `method` (GET/POST/…), `type` (one of the network event types), `errorsOnly` (HTTP status >= 400), `mitmOnly` (decrypted-HTTPS transactions only), `limit` (default 200, max 2000). Returns most-recent events. Requires Network Inspector enabled (see network_inspector_status).',
    inputSchema: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Optional Roku IP or serial. Omit to include every Roku on the hotspot.' },
        host: { type: 'string', description: 'Optional case-insensitive substring matched against hostname, TLS SNI, or request URL.' },
        method: { type: 'string', description: 'Optional HTTP method filter (e.g. "GET", "POST").' },
        type: { type: 'string', description: 'Optional event type filter.', enum: NETWORK_EVENT_TYPES as unknown as string[] },
        errorsOnly: { type: 'boolean', description: 'Only HTTP transactions with a response status >= 400.' },
        mitmOnly: { type: 'boolean', description: 'Only decrypted-HTTPS transactions captured via the MITM proxy.' },
        limit: { type: 'number', description: 'Max events to return (default 200, max 2000).' }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (args) => networkInspectorListEventsTool(args)
  },
  {
    name: 'network_inspector_get_event_detail',
    title: 'Network Inspector: Event Detail',
    description:
      'Fetch the full headers and body for one captured event by `id` (from network_inspector_list_events). Bodies are capped at `maxBodyChars` (default 4096) and the response lists `warnings` when truncated; pass `includeFullBody: true` to override. DNS/TLS/TCP events have no body and may return 404. Requires Network Inspector enabled.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Required. Event id from network_inspector_list_events.' },
        includeFullBody: { type: 'boolean', description: 'Return untruncated request/response bodies (can be large).' },
        maxBodyChars: { type: 'number', description: 'Per-side body character cap when includeFullBody is not set (default 4096).' }
      },
      required: ['id'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (args) => networkInspectorGetEventDetailTool(args)
  },
  {
    name: 'network_inspector_analyze',
    title: 'Network Inspector: Analyze',
    description:
      'Aggregate the captured buffer into hotspots and rollups in one call — counts by event type, by HTTP status class (2xx/3xx/4xx/5xx), top hosts (with error counts), top content types, total HTTP/MITM transactions, error count, and the largest responses. Use this to orient on a session before drilling into individual events. Accepts the same optional filters as network_inspector_list_events (`device`, `host`, `method`, `type`, `errorsOnly`, `mitmOnly`). Requires Network Inspector enabled.',
    inputSchema: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Optional Roku IP or serial. Omit to include every Roku on the hotspot.' },
        host: { type: 'string', description: 'Optional case-insensitive substring matched against hostname, TLS SNI, or request URL.' },
        method: { type: 'string', description: 'Optional HTTP method filter.' },
        type: { type: 'string', description: 'Optional event type filter.', enum: NETWORK_EVENT_TYPES as unknown as string[] },
        errorsOnly: { type: 'boolean', description: 'Only count HTTP transactions with a response status >= 400.' },
        mitmOnly: { type: 'boolean', description: 'Only count decrypted-HTTPS transactions.' }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (args) => networkInspectorAnalyzeTool(args)
  },
  {
    name: 'network_inspector_get_ca_info',
    title: 'Network Inspector: HTTPS CA Info',
    description:
      'Return the Dev Studio MITM CA fingerprint, proxy host:port, and the BrightScript snippet needed to trust the proxy so HTTPS request/response bodies become visible to the Network Inspector. Use when network_inspector_list_events shows TLS handshakes but no decrypted HTTP bodies, to guide the user through enabling HTTPS decryption for their sideloaded dev channel.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => networkInspectorGetCaInfoTool()
  }
];

// ============================================================================
// BrightScript socket debugger (control port 8081)
// ============================================================================
// Every tool is a thin POST to a `/debugger/<verb>` bridge route backed by the
// shared main-process DebugSessionController (the same session the Telnet debug
// sidebar drives). The debugger is STATEFUL and event-driven: attach first, then
// most verbs (step, callstack, variables, evaluate, and reliable breakpoint
// registration) only work while the target is HALTED. The loop is:
// debugger_attach → set breakpoints → debugger_wait_for_stop → inspect → step /
// continue. A `device` (IP or serial) is optional on every tool — omit it to use
// the focused Dev Studio tab.

/** POST a debugger verb; pass the tool args straight through as the body. */
async function debuggerCall(verb: string, label: string, args: Record<string, unknown>): Promise<ToolResult> {
  const res = await bridgeRequest({ method: 'POST', pathname: `/debugger/${verb}`, body: args });
  if (!res.ok) return bridgeToolFailure(label, res);
  return jsonResult(res.body);
}

/** `device` property shared by every debugger tool schema (optional; focused tab if omitted). */
const DEVICE_PROP = {
  device: { type: 'string', description: 'Optional. Roku IP or serial; must match a connected Dev Studio tab. Omit to use the focused tab.' }
} as const;

const DEBUGGER_TOOLS: Tool[] = [
  {
    name: 'debugger_attach',
    title: 'Debugger: Attach',
    description:
      'Open a BrightScript debug session to the Roku on control port 8081. REQUIRED FIRST — every other debugger_* tool needs an attached session. The port is only open when the channel was launched with debugging (sideload "with Debugging", or a STOP in the source auto-enables it); a plain sideload/relaunch does NOT open it, and attach returns an actionable error explaining that. Idempotent: re-attaching replaces the prior session (the port is single-client). On success returns `{ ip, state }`.',
    inputSchema: { type: 'object', properties: { ...DEVICE_PROP }, additionalProperties: false },
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    handler: async (args) => debuggerCall('attach', 'debugger_attach', args)
  },
  {
    name: 'debugger_detach',
    title: 'Debugger: Detach',
    description: 'Close the debug session for a device (releases the 8081 control socket). Idempotent — a no-op if not attached. The running channel keeps executing.',
    inputSchema: { type: 'object', properties: { ...DEVICE_PROP }, additionalProperties: false },
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    handler: async (args) => debuggerCall('detach', 'debugger_detach', args)
  },
  {
    name: 'debugger_status',
    title: 'Debugger: Status',
    description:
      'Return the session `state` for a device WITHOUT blocking: one of `disconnected` (not attached), `connecting`, `attached`, `running`, `stopped` (HALTED — safe to inspect), or `error`. Poll this to decide whether inspection tools will work; to block until the next halt use debugger_wait_for_stop instead.',
    inputSchema: { type: 'object', properties: { ...DEVICE_PROP }, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (args) => debuggerCall('status', 'debugger_status', args)
  },
  {
    name: 'debugger_wait_for_stop',
    title: 'Debugger: Wait for Stop',
    description:
      'Block (server-side poll) until the target HALTS at a breakpoint / STOP / step-completion / runtime error, then return `{ stopped: true, stop: { reason, detail, threads, stackFrames, variables } }` — the top-frame snapshot. Returns `{ stopped: false, timedOut: true }` if it is still running at the deadline, or `{ stopped:false, state }` if the session ended. Call this right after debugger_continue / debugger_step, or after triggering the app, to know when you can inspect. Optional `timeoutMs` (default 15000, max 30000).',
    inputSchema: {
      type: 'object',
      properties: { ...DEVICE_PROP, timeoutMs: { type: 'number', description: 'Max ms to wait (default 15000, capped at 30000).' } },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (args) => debuggerCall('wait-for-stop', 'debugger_wait_for_stop', args)
  },
  {
    name: 'debugger_continue',
    title: 'Debugger: Continue',
    description: 'Resume execution from a halted state (run until the next breakpoint / STOP / error). After calling this, use debugger_wait_for_stop to catch the next halt. Only meaningful while `stopped`.',
    inputSchema: { type: 'object', properties: { ...DEVICE_PROP }, additionalProperties: false },
    annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
    handler: async (args) => debuggerCall('continue', 'debugger_continue', args)
  },
  {
    name: 'debugger_pause',
    title: 'Debugger: Pause',
    description: 'Request a halt of a running channel (best-effort). Follow with debugger_wait_for_stop to get the snapshot once it stops. Only meaningful while `running`.',
    inputSchema: { type: 'object', properties: { ...DEVICE_PROP }, additionalProperties: false },
    annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
    handler: async (args) => debuggerCall('pause', 'debugger_pause', args)
  },
  {
    name: 'debugger_step',
    title: 'Debugger: Step',
    description: 'Single-step the halted thread. `kind`: "over" (default — next line, skipping calls), "in" (into the call), or "out" (finish the current function). Requires the target to be HALTED. Follow with debugger_wait_for_stop to get the new location.',
    inputSchema: {
      type: 'object',
      properties: {
        ...DEVICE_PROP,
        kind: { type: 'string', description: 'Step kind (default "over").', enum: ['over', 'in', 'out'] },
        threadIndex: { type: 'number', description: 'Optional thread to step (default the stopped/primary thread).' }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
    handler: async (args) => debuggerCall('step', 'debugger_step', args)
  },
  {
    name: 'debugger_get_callstack',
    title: 'Debugger: Get Call Stack',
    description: 'Return the call-stack frames (function, file, line — top frame first) for the halted thread. Requires the target to be HALTED. Optional `threadIndex` (default the stopped/primary thread). A frame index from here feeds `stackFrameIndex` in debugger_get_variables / debugger_evaluate.',
    inputSchema: {
      type: 'object',
      properties: { ...DEVICE_PROP, threadIndex: { type: 'number', description: 'Optional thread index (default the stopped/primary thread).' } },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (args) => debuggerCall('callstack', 'debugger_get_callstack', args)
  },
  {
    name: 'debugger_get_variables',
    title: 'Debugger: Get Variables',
    description:
      'Return variables in scope at a stack frame while HALTED. With no `variablePath`, returns the frame\'s locals (incl. `m`); each entry has `name`, `type`, `value`, and for containers a `childCount`. To drill into a container, pass its `variablePath` (e.g. `["m","top"]`; a quoted `"key"` segment forces a case-sensitive AA lookup, a bare number indexes an array) — the response is `[container]` whose `.children` is the next level. Optional `stackFrameIndex` (default 0 = top) and `threadIndex`.',
    inputSchema: {
      type: 'object',
      properties: {
        ...DEVICE_PROP,
        variablePath: { type: 'array', description: 'Optional path segments to drill into a container (e.g. ["m","top","count"]). Omit for the frame\'s locals.', items: { type: 'string' } },
        stackFrameIndex: { type: 'number', description: 'Stack frame to read (default 0 = top frame).' },
        threadIndex: { type: 'number', description: 'Optional thread index (default the stopped/primary thread).' }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (args) => debuggerCall('variables', 'debugger_get_variables', args)
  },
  {
    name: 'debugger_evaluate',
    title: 'Debugger: Evaluate (REPL)',
    description:
      'Run a BrightScript expression/statement in the halted frame (the debug-console REPL) — e.g. `print m.top.count` or `print type(node)`. Output streams to the device console; the result reports compile/runtime errors if any. Requires the target to be HALTED. Can have side effects (it executes code), so it is not read-only. For a plain variable read prefer debugger_get_variables. Optional `stackFrameIndex` / `threadIndex` select the scope.',
    inputSchema: {
      type: 'object',
      properties: {
        ...DEVICE_PROP,
        expression: { type: 'string', description: 'Required. BrightScript to run in the halted frame (often `print <expr>`).' },
        stackFrameIndex: { type: 'number', description: 'Stack frame scope (default 0 = top frame).' },
        threadIndex: { type: 'number', description: 'Optional thread index (default the stopped/primary thread).' }
      },
      required: ['expression'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
    handler: async (args) => debuggerCall('evaluate', 'debugger_evaluate', args)
  },
  {
    name: 'debugger_set_breakpoints',
    title: 'Debugger: Set Breakpoints',
    description:
      'Add breakpoints. `breakpoints`: array of `{ path, line, condition?, hitCount? }` — `path` is a `pkg:/…` source path (a bare path is prefixed with `pkg:/`), `condition` is an optional BrightScript expression (Roku OS 11.5+), `hitCount` skips that many hits first. IMPORTANT: the device only registers breakpoints while HALTED — one added while the channel is running comes back `pending:true` and is queued to register at the next stop. Each result carries a `breakpointId` (registered) or an error. Existing conditions are replaced on re-add.',
    inputSchema: {
      type: 'object',
      properties: {
        ...DEVICE_PROP,
        breakpoints: {
          type: 'array',
          description: 'Breakpoints to set.',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Source path, e.g. "pkg:/components/Main.brs" (a bare path is prefixed with pkg:/).' },
              line: { type: 'number', description: '1-based line number.' },
              condition: { type: 'string', description: 'Optional BrightScript condition; the breakpoint fires only when it is true (Roku OS 11.5+).' },
              hitCount: { type: 'number', description: 'Optional: ignore this many hits before halting.' }
            },
            required: ['path', 'line'],
            additionalProperties: false
          }
        }
      },
      required: ['breakpoints'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    handler: async (args) => debuggerCall('set-breakpoints', 'debugger_set_breakpoints', args)
  },
  {
    name: 'debugger_remove_breakpoints',
    title: 'Debugger: Remove Breakpoints',
    description: 'Remove breakpoints by location. `locations`: array of `{ filePath, lineNumber }` (matching what debugger_list_breakpoints reports). Removal is by file:line so it also clears a still-queued breakpoint that has no device id yet. Returns `{ removed }`.',
    inputSchema: {
      type: 'object',
      properties: {
        ...DEVICE_PROP,
        locations: {
          type: 'array',
          description: 'Breakpoint locations to remove.',
          items: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Source path, e.g. "pkg:/components/Main.brs".' },
              lineNumber: { type: 'number', description: '1-based line number.' }
            },
            required: ['filePath', 'lineNumber'],
            additionalProperties: false
          }
        }
      },
      required: ['locations'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    handler: async (args) => debuggerCall('remove-breakpoints', 'debugger_remove_breakpoints', args)
  },
  {
    name: 'debugger_list_breakpoints',
    title: 'Debugger: List Breakpoints',
    description: 'List the breakpoints the debugger is tracking for a device: each with `filePath`, `lineNumber`, `conditionalExpression?`, `hitCount?`, `verified` (registered on the device), `queued` (waiting for the next halt to register), and `breakpointId?`. Read-only.',
    inputSchema: { type: 'object', properties: { ...DEVICE_PROP }, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (args) => debuggerCall('list-breakpoints', 'debugger_list_breakpoints', args)
  }
];

// ============================================================================
// Tool registry
// ============================================================================

const BESPOKE_TOOLS: Tool[] = [
  {
    name: 'list_action_types',
    title: 'List Action Types',
    description:
      'Return every supported Action Script step `type` (with label, description, required / optional fields). Read-only. Start here when authoring a script, then call get_action_schema for one type\'s exact fields, and validate_script before send_script_to_builder. For the full authoring contract in one call use get_capability_bundle or read resource `roku-dev-studio://action-script-contract.md`.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    handler: async () => listActionTypes()
  },
  {
    name: 'get_action_schema',
    title: 'Get Action Schema',
    description:
      'Return the authoring schema (label, description, required and optional fields) for ONE Action Script step `type`. Read-only. Call this after list_action_types (which enumerates every type) when you are about to author or fix a specific step and need its exact field names before running validate_script. Required argument `type` — one of the values from list_action_types (also enumerated in this tool\'s inputSchema). For the whole authoring contract at once, prefer get_capability_bundle.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Exact step type key from list_action_types (e.g. appFunction, wait, keypress).',
          enum: Object.keys(catalogs.STEP_SCHEMA)
        }
      },
      required: ['type'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    handler: async (args) => getActionSchema(args)
  },
  {
    name: 'get_capability_bundle',
    title: 'Get Capability Bundle',
    description:
      'Single payload of every static capability (actions, vocabularies, RALE built-ins, presets, authoring rules, op directory, `actionScriptAgentContract`). Load **once** before authoring scripts, then cache. Same JSON is also available as resource `roku-dev-studio://capability-bundle.json`.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    handler: async () => getCapabilityBundle()
  },
  {
    name: 'validate_script',
    title: 'Validate Action Script',
    description:
      'Validate an Action Script before `send_script_to_builder`. Argument `script`: JSON object or JSON string. Response: `ok`, `errors[]` (path, code, message, expected?), `stepCounts`, `humanSummary`, `referenceTools`. `ok=false` is returned as isError. Contract: resource `roku-dev-studio://action-script-contract.md`. Only author a script for **multi-step / conditional / polling / saved-or-reviewed** flows — for a single action use the matching direct op (keypress, launch_app, rale_command, ecp_query, ecp_post, screenshot, …).',
    inputSchema: {
      type: 'object',
      properties: {
        script: {
          description:
            'Required. The script root object: at minimum `{ "steps": [ ... ] }`, optionally `version`, `name`, `description`. Pass as a native JSON object, or as a single JSON **string** that parses to that object (not double-encoded).',
          oneOf: [{ type: 'object' }, { type: 'string' }]
        }
      },
      required: ['script'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    handler: async (args) => validateScriptTool(args)
  },
  {
    name: 'probe_bridge',
    title: 'Probe Dev Studio Bridge',
    description:
      'Returns `{ live, port, pid, startedAt }` or `{ live: false, reason }`. Call **once per session** before the first bridge-dependent tool; once `live=true`, call direct ops (keypress, launch_app, ecp_query, rale_command, …) and `send_script_to_builder` freely without re-probing.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => probeBridge()
  },
  {
    name: 'get_selected_device',
    title: 'Get Selected Device',
    description:
      'Return the single device tab the user currently has focused in Dev Studio (`ip`, `serial`, `modelName`, `friendlyDeviceName`, …), or an empty/`null` result when no tab is focused. Read-only. Call this to resolve the implicit target before a device op when the user says "this device" / "the current one" and gave no IP. For the full inventory (all connected / discovered / remembered devices) use list_devices instead; to change the focus use connect_device.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => getSelectedDevice()
  },
  {
    name: 'list_devices',
    title: 'List All Known Devices',
    description:
      'Return every device Dev Studio already knows about — connected, discovered, remembered, or remote — without running a network scan. Read-only. Each entry: `ip`, `serial`, `modelName`, `friendlyDeviceName`, `softwareVersion`, `source`, `isConnected`, `isFocused`. Use this as the first step to resolve a `device` argument (IP or serial) for other tools. Related tools: get_selected_device returns only the one focused device; scan_devices actively probes the network for NEW devices not yet known; connect_device opens/focuses a tab for one of these entries.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => listDevices()
  },
  {
    name: 'connect_device',
    title: 'Connect to a Device',
    description:
      'Open (or focus, if already open) a Dev Studio device tab for the given Roku, making it the active target for renderer-routed tools (rale_command, telnet_*, app_function, get_telnet_log). Required `device`: Roku IP or serial from list_devices / scan_devices. Idempotent — a no-op if that device is already connected and focused. Not needed for main-direct ECP ops (keypress, launch_app, ecp_query, …), which accept a `device` argument directly; use test_connection to verify reachability without opening a tab.',
    inputSchema: {
      type: 'object',
      properties: {
        device: {
          type: 'string',
          description: 'Required non-empty string: LAN IP (e.g. "192.168.1.75") or device serial exactly as shown by list_devices / scan_devices.'
        }
      },
      required: ['device'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    handler: async (args) => connectDeviceTool(args)
  },
  {
    name: 'list_app_connector_functions',
    title: 'List App Connector Functions',
    description:
      'Live `functionName` + parameter metadata from RALE `getExternalControlFunctions`. Each entry has `name`, `params: [{ name, type }, …]`, and an optional `description` string when the channel includes one in its payload — surface that description verbatim to the user when explaining what a function does. Call before authoring `appFunction` steps so names and param keys/order match. Optional `device` (IP or serial).',
    inputSchema: {
      type: 'object',
      properties: {
        device: {
          type: 'string',
          description: 'Optional. Roku IP or serial; must match a connected Dev Studio tab when set.'
        }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (args) => listAppConnectorFunctions(args)
  },
  {
    name: 'rale_get_node_by_id',
    title: 'RALE: Get Node by ID',
    description:
      'Read-only convenience wrapper over rale_command `getNodeById`: fetch one SceneGraph node (its fields / children) by its `id` from the running Dev App via the App Connector. Requires a connected App Connector session (auto-connects if needed). Use this — not the general rale_command — for the common "inspect one node" case; drop to rale_command only for other RALE built-ins (registry, focus, other queries). Required `id` (the node\'s `id` field as authored in XML/BrightScript). Optional `path` (array of child indices/ids to disambiguate when the id is not globally unique; omit or `[]` for a global lookup) and `device` (IP or serial; omit for the focused tab).',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'array',
          description: 'Optional. Scene graph path segments; use [] or omit for root.',
          items: { oneOf: [{ type: 'string' }, { type: 'number' }] }
        },
        id: { type: 'string', description: 'Required. Node id string from the scene / registry.' },
        device: { type: 'string', description: 'Optional. IP or serial for a specific Dev Studio device tab.' }
      },
      required: ['id'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (args) => raleGetNodeByIdTool(args)
  },
  {
    name: 'send_script_to_builder',
    title: 'Send Script to Builder',
    description:
      'Drop a validated Action Script into Dev Studio Builder for human review (does not auto-run). Runs the same validation as `validate_script`. Arguments: `script` (object or JSON string), optional `device`. **Use only for multi-step / conditional / saved-or-reviewed flows** — if the task is a single deterministic action (one keypress, one launch, one RALE command, one ECP query/POST, one screenshot), call the matching direct op (`keypress`, `launch_app`, `rale_command`, `ecp_query`, `ecp_post`, `screenshot`, …) directly instead of wrapping it in a one-step script.',
    inputSchema: {
      type: 'object',
      properties: {
        script: {
          description:
            'Required. Same shape as for validate_script: object with `steps` array, or a JSON string that parses to that object.',
          oneOf: [{ type: 'object' }, { type: 'string' }]
        },
        device: {
          type: 'string',
          description:
            'Optional. Target Roku IP (e.g. 192.168.1.75) or serial. Must match an open Dev Studio device tab when provided.'
        }
      },
      required: ['script'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    handler: async (args) => sendScriptToBuilder(args)
  }
];

// Public registry: bespoke + auto-generated, deduped by name.
// Op-backed tools should win when there's overlap so new catalog additions
// propagate automatically. In practice there's no overlap today.
const byName: Map<string, Tool> = new Map();
for (const t of BESPOKE_TOOLS) byName.set(t.name, t);
for (const t of NETWORK_INSPECTOR_TOOLS) byName.set(t.name, t);
for (const t of DEBUGGER_TOOLS) byName.set(t.name, t);
for (const t of OP_BACKED_TOOLS) byName.set(t.name, t);

export const TOOLS: Tool[] = Array.from(byName.values());

export function findTool(name: string): Tool | undefined {
  return byName.get(name);
}

/**
 * Transport-agnostic operation descriptors.
 *
 * Each Roku operation (keypress, launch, sideload, screenshot, …) is
 * described **once** below as a `RokuOp<P, R>`. Transports (Electron IPC,
 * HTTP bridge, MCP tool) mount the same ops through thin adapters.
 *
 * Adding a new device op is a one-file change here + one import on each
 * transport's registration loop. Validation, description, destructive flag,
 * JSON Schema (for the MCP tool) and HTTP path all derive from the
 * descriptor.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { keypress, launch, query, post, inputText, deeplink, testConnection, getIcon } = require('../ecp');
const { sideloadChannel, deleteSideload: apiDeleteSideload } = require('./plugin-install');
const { captureRokuScreenshot } = require('./screenshot');
const { ssdpDiscover, subnetScan } = require('./discovery');
const { isValidIp, validateDevPassword } = require('roku-dev-studio-platform/validation');
const {
  KEYPRESS_OPTIONS,
  DEVICE_PERFORMANCE_CHART_IDS
} = require('./catalogs');
const { RokuOpError, toRokuOpError } = require('./errors');

/**
 * Path prefixes that strongly suggest the agent is running in a remote
 * cloud sandbox (Claude.ai, ChatGPT web, etc.) where uploaded files only
 * exist inside the agent's container — not on the user's machine where
 * Roku Dev Studio (and this MCP server) actually runs. We surface a
 * targeted error before attempting the sideload so the agent gets an
 * actionable message rather than a generic "file not found".
 */
const AGENT_SANDBOX_PATH_PREFIXES: readonly string[] = [
  '/mnt/user-data/',
  '/mnt/skills/',
  '/mnt/uploads/',
  '/mnt/data/',
  '/sandbox/',
  '/tmp/sandbox/',
  '/home/sandbox/',
  '/home/agent/',
  '/workspace/agent/'
];

function looksLikeAgentSandboxPath(p: string): boolean {
  if (!p) return false;
  const norm = p.replace(/\\/g, '/').toLowerCase();
  return AGENT_SANDBOX_PATH_PREFIXES.some((prefix) => norm.startsWith(prefix));
}

/**
 * Verify that an agent-supplied local path actually exists, is a regular
 * file, and is readable by this process — so we can return a precise,
 * actionable error before invoking curl. Returns `null` when the file is
 * sideload-ready, otherwise a `{ code, message }` describing the problem.
 *
 * Recognized failures:
 *   - ENOENT  → file missing (typo, not yet downloaded, browser appended " (1)")
 *   - EISDIR  → path resolved to a directory
 *   - EACCES  → file exists but Roku Dev Studio can't read it (macOS TCC,
 *               unix mode, network volume)
 *   - non_zip → wrong extension (caught here so the agent doesn't get a
 *               cryptic Roku web UI failure for, e.g., a .ipa or .dmg)
 *   - empty   → 0-byte file (corrupted download)
 */
type PreflightFailure = { code: string; message: string } | null;
function preflightLocalFile(filePath: string): PreflightFailure {
  let stat: { isFile?: () => boolean; isDirectory?: () => boolean; size?: number };
  try {
    stat = fs.statSync(filePath);
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err && err.code === 'ENOENT') {
      return {
        code: 'ENOENT',
        message:
          `Sideload file not found at \`${filePath}\`. Verify the absolute path on the user's machine — common causes: (1) browser appended \` (1)\` or stripped characters when saving, (2) file is in a different folder (Desktop / iCloud Drive instead of Downloads), (3) the upload was never actually saved locally. Ask the user to drag the .zip from Finder into Terminal to get the canonical path, or pass the bytes inline via \`contentBase64\` + \`filename\` instead.`
      };
    }
    if (err && err.code === 'EACCES') {
      return {
        code: 'EACCES',
        message:
          `Permission denied reading \`${filePath}\`. On macOS, Roku Dev Studio may need Full Disk Access (System Settings → Privacy & Security → Full Disk Access → enable Roku Dev Studio) — typical for files under Downloads / Documents / Desktop. Or the file's unix mode prevents reads.`
      };
    }
    return {
      code: 'STAT_FAILED',
      message: `Could not stat \`${filePath}\`: ${err && err.message ? err.message : String(e)}`
    };
  }
  if (typeof stat.isDirectory === 'function' && stat.isDirectory()) {
    return {
      code: 'EISDIR',
      message: `\`${filePath}\` is a directory, not a file. Pass the absolute path of the .zip itself.`
    };
  }
  if (typeof stat.isFile === 'function' && !stat.isFile()) {
    return {
      code: 'NOT_REGULAR_FILE',
      message: `\`${filePath}\` is not a regular file (symlink target missing, socket, fifo, …).`
    };
  }
  if (typeof stat.size === 'number' && stat.size === 0) {
    return {
      code: 'EMPTY_FILE',
      message: `\`${filePath}\` is 0 bytes — likely a failed/incomplete download. Re-download the .zip and retry.`
    };
  }
  // Confirm read access (covers cases stat allowed but open() would not).
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err && err.code === 'EACCES') {
      return {
        code: 'EACCES',
        message:
          `Permission denied reading \`${filePath}\`. On macOS, Roku Dev Studio may need Full Disk Access (System Settings → Privacy & Security → Full Disk Access → enable Roku Dev Studio).`
      };
    }
    return {
      code: 'ACCESS_FAILED',
      message: `Could not open \`${filePath}\` for reading: ${err && err.message ? err.message : String(e)}`
    };
  }
  if (!filePath.toLowerCase().endsWith('.zip')) {
    return {
      code: 'NOT_ZIP',
      message: `\`${filePath}\` does not have a \`.zip\` extension. Roku sideload expects a channel .zip (manifest + components/ + …). Verify the file.`
    };
  }
  return null;
}

// =============================================================================
// Types
// =============================================================================

/** JSON Schema compatible input shape (subset; what MCP tools expect). */
type JsonSchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array';
interface JsonSchemaProperty {
  type?: JsonSchemaType | JsonSchemaType[];
  description?: string;
  enum?: readonly (string | number | boolean)[];
  default?: unknown;
  items?: JsonSchemaProperty | { oneOf?: Array<{ type: JsonSchemaType }> };
  additionalProperties?: boolean | JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
}
interface JsonSchemaObject {
  type: 'object';
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/** Thrown by validators. Always catchable as RokuOpError. */
type ValidationIssue = { path: string; message: string };

/**
 * Where the op executes. Main-direct ops run wherever this package is
 * loaded (Node main process, remote server). Renderer-only ops need the
 * Electron renderer because they depend on renderer-owned state
 * (AppConnector session, telnet socket, Builder modal).
 */
type OpRunLocation = 'main' | 'renderer';

interface RokuOp<P extends Record<string, unknown> = Record<string, unknown>, R = unknown> {
  /** Stable snake_case identifier. Used as tool name, HTTP route segment, IPC channel. */
  id: string;
  /** Human-readable title. */
  title: string;
  /** Longer description; shown verbatim in the MCP tool catalog. */
  description: string;
  /** Where the op runs; see OpRunLocation. */
  runIn: OpRunLocation;
  /** True if the op changes device state. Drives toast policy + audit flags. */
  destructive: boolean;
  /** JSON Schema describing the input object. Used by MCP tool definitions. */
  inputSchema: JsonSchemaObject;
  /**
   * JSON Schema describing the **success-path response body** the op
   * returns through the HTTP bridge / `/op/<id>` dispatcher. Used by the
   * MCP server's output-schema check (warn-only) so a regression that
   * silently changes the response shape is surfaced in the host log
   * instead of silently confusing the agent.
   *
   * Must describe what `runOpForHttp` produces on the 2xx path: the op's
   * raw return value if it's an object, otherwise `{ result: <value> }`.
   * Most ops return either a stable shape (`SCREENSHOT`, `SIDELOAD`,
   * `SCAN_DEVICES`, …) or an `ecpRequest`-shaped envelope; permissive
   * `additionalProperties: true` is fine where the underlying call's
   * shape is opaque (renderer-routed ops, generic RALE).
   */
  outputSchema: JsonSchemaObject;
  /**
   * Programmatic validation beyond JSON Schema (cross-field rules, dev
   * password format, etc.). Return an array of issues; empty = ok.
   */
  validate?: (params: Partial<P>) => ValidationIssue[];
  /**
   * Run the op. Main-direct ops are called directly. Renderer ops are only
   * defined for MCP tool-surface reasons; their `execute` throws UNSUPPORTED
   * so callers know to use a renderer transport.
   */
  execute: (params: P) => Promise<R>;
}

// =============================================================================
// Common output schemas (shared across ops)
// =============================================================================

/**
 * Shape of an `ecpRequest` resolution — every ECP-style op (keypress,
 * launch, ecp_query, ecp_post, deep_link) goes through this. The library
 * never throws for HTTP errors; instead it sets `success: false` plus an
 * `error` string, so both shapes have to be representable here.
 *
 * `additionalProperties: true` because some ECP responses include
 * device-specific extras (`headers` on raw query, etc.) that we don't
 * want to spuriously flag.
 */
const ECP_RESPONSE_OUTPUT_SCHEMA: JsonSchemaObject = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'string' },
    status: { type: 'number' },
    error: { type: 'string' },
    statusCode: { type: 'number' },
    authFailed: { type: 'boolean' }
  },
  additionalProperties: true
};

/**
 * Permissive baseline: response is at minimum a JSON object. Used for
 * renderer-routed ops whose output shape is fully owned by the renderer
 * dispatcher and varies by tool — the value of the schema check there
 * is "the renderer didn't accidentally return a string / null / array".
 */
const PERMISSIVE_OBJECT_OUTPUT_SCHEMA: JsonSchemaObject = {
  type: 'object',
  additionalProperties: true
};

// =============================================================================
// Helpers
// =============================================================================

function requireNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RokuOpError('invalid_arg', `Missing or empty \`${name}\`.`);
  }
  return value.trim();
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string') {
    throw new RokuOpError('invalid_arg', `\`${name}\` must be a string.`);
  }
  return value;
}

function requireIp(value: unknown, name = 'ip'): string {
  const s = requireNonEmptyString(value, name);
  if (!isValidIp(s)) {
    throw new RokuOpError('invalid_arg', `\`${name}\` is not a valid IPv4 address: "${s}".`);
  }
  return s;
}

function requireDevPassword(value: unknown, name = 'password'): string {
  const s = requireString(value, name);
  if (!s) throw new RokuOpError('invalid_arg', `\`${name}\` is required.`);
  const v = validateDevPassword(s);
  if (!v.valid) throw new RokuOpError('invalid_arg', v.error || `\`${name}\` failed validation.`);
  return s;
}

/** After optional bridge fill from Dev Studio storage; still missing → clear error. */
function requireDevPasswordParam(value: unknown, name = 'password'): string {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    throw new RokuOpError(
      'invalid_arg',
      `Missing \`${name}\`. Save the developer password for this device in Roku Dev Studio (device tab, verify with Remember checked), or pass \`${name}\` in the request.`,
      {
        suggestion:
          'Open the device panel, enter the Dev Password, authenticate, and enable Remember — or pass password explicitly for this call.'
      }
    );
  }
  return requireDevPassword(value, name);
}

function rendererOnlyExecute(opId: string) {
  return async () => {
    throw new RokuOpError(
      'unsupported',
      `Operation "${opId}" runs only in the Electron renderer and cannot execute main-side.`,
      {
        suggestion:
          'Invoke this via the MCP bridge or the renderer IPC handler; main-direct transport cannot run renderer-owned operations.'
      }
    );
  };
}

// =============================================================================
// Ops (main-direct)
// =============================================================================

const KEYPRESS: RokuOp<{ ip: string; key: string }, unknown> = {
  id: 'keypress',
  title: 'Send Remote Key',
  description:
    'Send an ECP remote key (e.g. "Home", "Up", "Select", "Play") to a Roku device. Mirrors what the user does with the on-screen remote.',
  runIn: 'main',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: {
      ip: { type: 'string', description: 'Device IPv4 address.' },
      key: {
        type: 'string',
        description: 'ECP key name. See list_keypress_options for the full set.',
        enum: KEYPRESS_OPTIONS as readonly string[]
      }
    },
    required: ['ip', 'key'],
    additionalProperties: false
  },
  outputSchema: ECP_RESPONSE_OUTPUT_SCHEMA,
  validate: (p) => {
    const issues: ValidationIssue[] = [];
    if (typeof p.key === 'string' && !(KEYPRESS_OPTIONS as readonly string[]).includes(p.key)) {
      issues.push({
        path: 'key',
        message: `Unknown key "${p.key}". Call list_keypress_options.`
      });
    }
    return issues;
  },
  execute: async (p) => {
    const ip = requireIp(p.ip);
    const key = requireNonEmptyString(p.key, 'key');
    return await keypress(ip, key);
  }
};

const LAUNCH: RokuOp<{ ip: string; appId: string; params?: Record<string, string> }, unknown> = {
  id: 'launch_app',
  title: 'Launch Roku App',
  description:
    'Launch a channel / app on the device by app id. Use /query/apps or ecp_query to discover ids. "dev" is the sideloaded Dev App.',
  runIn: 'main',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: {
      ip: { type: 'string' },
      appId: { type: 'string', description: 'Channel id (e.g. "837" for YouTube, "dev" for sideloaded).' },
      params: {
        type: 'object',
        description: 'Optional URL-encoded launch params.',
        additionalProperties: { type: 'string' }
      }
    },
    required: ['ip', 'appId'],
    additionalProperties: false
  },
  outputSchema: ECP_RESPONSE_OUTPUT_SCHEMA,
  execute: async (p) => {
    const ip = requireIp(p.ip);
    const appId = requireNonEmptyString(p.appId, 'appId');
    return await launch(ip, appId, p.params);
  }
};

const INPUT_TEXT: RokuOp<{ ip: string; text: string }, unknown> = {
  id: 'input_text',
  title: 'Send Text Input',
  description:
    'Send a literal text string to whatever input field is currently focused on the device (ECP /input endpoint).',
  runIn: 'main',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: {
      ip: { type: 'string' },
      text: { type: 'string', description: 'Text to send.' }
    },
    required: ['ip', 'text'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      status: { type: 'number' },
      results: { type: 'array' },
      error: { type: 'string' }
    },
    additionalProperties: true
  },
  execute: async (p) => {
    const ip = requireIp(p.ip);
    const text = requireString(p.text, 'text');
    if (!text) throw new RokuOpError('invalid_arg', '`text` cannot be empty.');
    return await inputText(ip, text);
  }
};

const DEEP_LINK: RokuOp<{ ip: string; appId: string; contentId?: string; mediaType?: string }, unknown> = {
  id: 'deep_link',
  title: 'Deep Link into an App',
  description:
    'Launch an app with a deep link (contentId + mediaType). Equivalent to /launch/<appId>?contentId=...&mediaType=... in ECP.',
  runIn: 'main',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: {
      ip: { type: 'string' },
      appId: { type: 'string' },
      contentId: { type: 'string' },
      mediaType: { type: 'string', description: 'e.g. "movie", "episode", "series".' }
    },
    required: ['ip', 'appId'],
    additionalProperties: false
  },
  outputSchema: ECP_RESPONSE_OUTPUT_SCHEMA,
  execute: async (p) => {
    const ip = requireIp(p.ip);
    const appId = requireNonEmptyString(p.appId, 'appId');
    return await deeplink(ip, appId, p.contentId, p.mediaType);
  }
};

const ECP_QUERY: RokuOp<{ ip: string; endpoint: string }, unknown> = {
  id: 'ecp_query',
  title: 'ECP Query (read-only)',
  description:
    'Run a read-only ECP GET against a device. Use endpoints from list_query_presets or any /query/* path. Does not change device state.',
  runIn: 'main',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: {
      ip: { type: 'string' },
      endpoint: { type: 'string', description: 'ECP path (e.g. /query/active-app) or telnet preset (e.g. telnet:plugins).' }
    },
    required: ['ip', 'endpoint'],
    additionalProperties: false
  },
  outputSchema: ECP_RESPONSE_OUTPUT_SCHEMA,
  execute: async (p) => {
    const ip = requireIp(p.ip);
    const endpoint = requireNonEmptyString(p.endpoint, 'endpoint');
    return await query(ip, endpoint);
  }
};

const ECP_POST: RokuOp<{ ip: string; endpoint: string }, unknown> = {
  id: 'ecp_post',
  title: 'ECP POST (raw)',
  description:
    'POST to an arbitrary ECP endpoint (e.g. /sgrendezvous/track). Side-effecting — agents should use list_post_presets for safe defaults.',
  runIn: 'main',
  destructive: true,
  inputSchema: {
    type: 'object',
    properties: {
      ip: { type: 'string' },
      endpoint: { type: 'string' }
    },
    required: ['ip', 'endpoint'],
    additionalProperties: false
  },
  outputSchema: ECP_RESPONSE_OUTPUT_SCHEMA,
  execute: async (p) => {
    const ip = requireIp(p.ip);
    const endpoint = requireNonEmptyString(p.endpoint, 'endpoint');
    return await post(ip, endpoint);
  }
};

const TEST_CONNECTION: RokuOp<{ ip: string }, unknown> = {
  id: 'test_connection',
  title: 'Test Device Connection',
  description:
    'Probe a device IP for ECP availability. Returns reachability + basic device info. Does not require the device to have a tab open.',
  runIn: 'main',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: { ip: { type: 'string' } },
    required: ['ip'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      deviceInfo: { type: 'object', additionalProperties: true },
      error: { type: 'string' }
    },
    additionalProperties: true
  },
  execute: async (p) => {
    const ip = requireIp(p.ip);
    return await testConnection(ip);
  }
};

const GET_APP_ICON: RokuOp<{ ip: string; appId: string }, unknown> = {
  id: 'get_app_icon',
  title: 'Get App Icon',
  description: 'Fetch the 336x210 app icon for a channel on the device (data URL / base64).',
  runIn: 'main',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: {
      ip: { type: 'string' },
      appId: { type: 'string' }
    },
    required: ['ip', 'appId'],
    additionalProperties: false
  },
  outputSchema: PERMISSIVE_OBJECT_OUTPUT_SCHEMA,
  execute: async (p) => {
    const ip = requireIp(p.ip);
    const appId = requireNonEmptyString(p.appId, 'appId');
    return await getIcon(ip, appId);
  }
};

const SIDELOAD: RokuOp<
  {
    ip: string;
    filePath?: string;
    contentBase64?: string;
    filename?: string;
    password?: string;
  },
  unknown
> = {
  id: 'sideload',
  title: 'Sideload Channel Package',
  description:
    'Upload and install a .zip channel package on the device. Destructive: replaces any currently sideloaded Dev App. Provide the zip in ONE of two ways: (1) `filePath` — an absolute path to a .zip on the SAME machine that runs Roku Dev Studio. Do NOT use this when running in a remote agent sandbox (Claude.ai, ChatGPT web) where files only exist inside the agent\'s container — the path will not resolve on the user\'s machine. (2) `contentBase64` + `filename` — the .zip bytes inline; this server writes them to a temp file on the user\'s machine, sideloads, and cleans up. Use this whenever the agent has file content but no shared filesystem with Roku Dev Studio. Password is optional when Dev Studio has remembered it for this device.',
  runIn: 'main',
  destructive: true,
  inputSchema: {
    type: 'object',
    properties: {
      ip: { type: 'string' },
      filePath: {
        type: 'string',
        description:
          'Absolute path to a .zip on the same machine that runs Roku Dev Studio. Mutually exclusive with `contentBase64`. Will fail with an actionable error if the path looks like an agent sandbox path (e.g. /mnt/user-data/...).'
      },
      contentBase64: {
        type: 'string',
        description:
          'Zip bytes encoded as base64. The server writes them to a temp file on the user\'s machine, sideloads, then deletes the temp file. Use this when running in a remote agent sandbox so file content travels through MCP rather than relying on a shared filesystem. Provide `filename` alongside.'
      },
      filename: {
        type: 'string',
        description:
          'Suggested filename for the temp file when using `contentBase64` (e.g. "my-app.zip"). Optional but recommended; if omitted, "agent-upload.zip" is used.'
      },
      password: {
        type: 'string',
        description:
          'Developer password. Omit if Roku Dev Studio has saved it for this device (Remember on the device tab).'
      }
    },
    required: ['ip'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      error: { type: 'string' }
    },
    additionalProperties: true
  },
  execute: async (p) => {
    const ip = requireIp(p.ip);
    const password = requireDevPasswordParam(p.password);
    const hasFilePath = typeof p.filePath === 'string' && p.filePath.trim() !== '';
    const hasBase64 = typeof p.contentBase64 === 'string' && p.contentBase64.trim() !== '';
    if (!hasFilePath && !hasBase64) {
      throw new RokuOpError(
        'validation_error',
        'sideload requires either `filePath` (absolute path on the same machine as Roku Dev Studio) or `contentBase64` + `filename` (zip bytes encoded as base64).',
        { details: { argument: 'filePath|contentBase64' } }
      );
    }
    if (hasFilePath && hasBase64) {
      throw new RokuOpError(
        'validation_error',
        'sideload accepts EITHER `filePath` OR `contentBase64` (not both). Pick one.',
        { details: { argument: 'filePath|contentBase64' } }
      );
    }

    let filePath = '';
    let tempPathToCleanup = '';
    if (hasBase64) {
      const base64 = (p.contentBase64 as string).trim();
      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64, 'base64');
      } catch (e) {
        throw new RokuOpError(
          'validation_error',
          'sideload `contentBase64` is not valid base64.',
          { details: { argument: 'contentBase64' } }
        );
      }
      if (buffer.length === 0) {
        throw new RokuOpError(
          'validation_error',
          'sideload `contentBase64` decoded to zero bytes.',
          { details: { argument: 'contentBase64' } }
        );
      }
      const safeName = sanitizeUploadFilename(p.filename) || 'agent-upload.zip';
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rds-sideload-'));
      tempPathToCleanup = path.join(tempDir, safeName);
      fs.writeFileSync(tempPathToCleanup, buffer);
      filePath = tempPathToCleanup;
    } else {
      filePath = requireNonEmptyString(p.filePath, 'filePath');
      if (looksLikeAgentSandboxPath(filePath)) {
        throw new RokuOpError(
          'validation_error',
          `sideload \`filePath\` looks like a remote agent sandbox path (\`${filePath}\`). Roku Dev Studio runs on the user's machine and cannot read files from a hosted AI container. Either (a) ask the user to download the .zip locally and re-run with the absolute local path, (b) drag the .zip into Roku Dev Studio's install drop zone, or (c) re-call sideload using \`contentBase64\` + \`filename\` so the bytes travel through MCP.`,
          { details: { filePath, sandbox: true } }
        );
      }
      // Pre-flight readability check so we surface a precise error instead of
      // letting curl bubble up as a generic "(26) Failed to open/read local data".
      const preflight = preflightLocalFile(filePath);
      if (preflight) {
        throw new RokuOpError('validation_error', preflight.message, {
          details: { filePath, code: preflight.code }
        });
      }
    }

    try {
      const result = await sideloadChannel({ ip, filePath, password });
      if (!result || result.success === false) {
        throw new RokuOpError(
          'device_error',
          (result && result.error) || 'Sideload failed.',
          { details: { ip, filePath } }
        );
      }
      return result;
    } finally {
      if (tempPathToCleanup) {
        try {
          fs.rmSync(tempPathToCleanup, { force: true });
          fs.rmdirSync(path.dirname(tempPathToCleanup));
        } catch {
          /* best-effort cleanup; temp dir gets reclaimed by the OS */
        }
      }
    }
  }
};

/**
 * Strip any path separators and disallowed characters from an
 * agent-supplied filename so we can safely combine it with our temp
 * directory. Falls back to empty string for the caller to default.
 */
function sanitizeUploadFilename(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const base = raw.replace(/\\/g, '/').split('/').pop() || '';
  const trimmed = base.trim();
  if (!trimmed) return '';
  // Conservative whitelist: letters, digits, dot, dash, underscore, space.
  const cleaned = trimmed.replace(/[^A-Za-z0-9._\- ]+/g, '_');
  return cleaned.slice(0, 120);
}

const DELETE_SIDELOAD: RokuOp<{ ip: string; password?: string }, unknown> = {
  id: 'delete_sideload',
  title: 'Delete Sideloaded Channel',
  description:
    'Remove the currently sideloaded Dev App from the device. Password optional when Dev Studio has remembered it for this device.',
  runIn: 'main',
  destructive: true,
  inputSchema: {
    type: 'object',
    properties: {
      ip: { type: 'string' },
      password: {
        type: 'string',
        description: 'Omit if Roku Dev Studio has saved the Dev Password for this device (Remember on the device tab).'
      }
    },
    required: ['ip'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      error: { type: 'string' }
    },
    additionalProperties: true
  },
  execute: async (p) => {
    const ip = requireIp(p.ip);
    const password = requireDevPasswordParam(p.password);
    const result = await apiDeleteSideload({ ip, password });
    if (!result || result.success === false) {
      throw new RokuOpError('device_error', (result && result.error) || 'Delete sideload failed.');
    }
    return result;
  }
};

const SCREENSHOT: RokuOp<
  { ip: string; password?: string; waitAfterTriggerMs?: number; returnImageBase64?: boolean },
  unknown
> = {
  id: 'screenshot',
  title: 'Capture Screenshot',
  description:
    'Capture a screenshot of the current device screen and return it inline as an MCP image content block (JPEG, base64). Hosts (Cursor, Claude Desktop, etc.) render this image to the user, so for any human-facing capture **let `returnImageBase64` default to true** (or omit it). Set `returnImageBase64: false` ONLY for batch / metadata-only flows where no one will view the screenshot; in that case the response is just `{ success, filename, bytes }` and the image will not appear in the chat. Password is optional when Dev Studio has remembered it for this device.',
  runIn: 'main',
  destructive: true,
  inputSchema: {
    type: 'object',
    properties: {
      ip: { type: 'string' },
      password: {
        type: 'string',
        description: 'Omit if Roku Dev Studio has saved the Dev Password for this device (Remember on the device tab).'
      },
      waitAfterTriggerMs: { type: 'number' },
      returnImageBase64: {
        type: 'boolean',
        description:
          'Default true. Keep true (or omit) for any user-facing capture so the screenshot is rendered inline in the chat. Set false ONLY for batch / metadata-only flows where no one will view the image; when false, the user will see only the JSON metadata and nothing visible.'
      }
    },
    required: ['ip'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      filename: { type: 'string' },
      bytes: { type: 'number' },
      imageMimeType: { type: 'string' },
      imageBase64: { type: 'string' },
      error: { type: 'string' }
    },
    required: ['success'],
    additionalProperties: false
  },
  execute: async (p) => {
    const ip = requireIp(p.ip);
    const password = requireDevPasswordParam(p.password);
    const result = await captureRokuScreenshot({
      ip,
      password,
      waitAfterTriggerMs: p.waitAfterTriggerMs
    });
    if (!result.success) {
      throw new RokuOpError('device_error', result.error || 'Screenshot failed.');
    }
    const buf = (result as { imageBuffer?: Buffer }).imageBuffer;
    if (!buf || !Buffer.isBuffer(buf)) {
      throw new RokuOpError('device_error', 'Screenshot succeeded but no image buffer was returned.');
    }
    const bytes = buf.length;
    const includeImage = p.returnImageBase64 !== false;
    const out: Record<string, unknown> = {
      success: true,
      filename: 'dev.jpg',
      bytes,
      imageMimeType: 'image/jpeg'
    };
    if (includeImage) {
      out.imageBase64 = buf.toString('base64');
    }
    return out;
  }
};

const SCAN_DEVICES: RokuOp<
  { includeSubnetScan?: boolean; timeoutMs?: number },
  { ssdp: unknown[]; subnet: unknown[] }
> = {
  id: 'scan_devices',
  title: 'Scan Network for Roku Devices',
  description:
    'Run SSDP discovery (multicast) and optionally a subnet HTTP sweep. Does not connect devices — follow up with connect_device to open a tab.',
  runIn: 'main',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: {
      includeSubnetScan: { type: 'boolean' },
      timeoutMs: { type: 'number' }
    },
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      ssdp: { type: 'array' },
      subnet: { type: 'array' }
    },
    required: ['ssdp', 'subnet'],
    additionalProperties: false
  },
  execute: async (p) => {
    const timeoutMs = typeof p.timeoutMs === 'number' ? p.timeoutMs : 4000;
    // ssdpDiscover reads `timeout` (overall discovery window); passing `timeoutMs`
    // was a dead option (the knob had no effect). subnetScan reads a *per-host*
    // `requestTimeout` (default 500ms) — deliberately NOT wired to the overall
    // timeoutMs, since applying a multi-second value per host would make a /24 sweep
    // take minutes.
    const ssdp = await ssdpDiscover({ timeout: timeoutMs });
    const subnet = p.includeSubnetScan ? await subnetScan({}) : [];
    return { ssdp, subnet };
  }
};

// =============================================================================
// Ops (renderer-only — declared here so the MCP tool catalog sees them,
// but `execute` throws; transports are expected to route to the renderer)
// =============================================================================

const RALE_COMMAND: RokuOp<
  { device?: string; command: string; args?: Record<string, unknown> },
  unknown
> = {
  id: 'rale_command',
  title: 'RALE Command (full; read + write)',
  description:
    'Run any built-in RALE command against the active App Connector session — including destructive ones (addRegistryField, removeRegistrySection, clearRegistry, …). Use list_rale_builtins for the catalog. Every call surfaces as a toast in Dev Studio.',
  runIn: 'renderer',
  destructive: true,
  inputSchema: {
    type: 'object',
    properties: {
      device: { type: 'string', description: 'Optional target device (IP or serial).' },
      command: { type: 'string', description: 'RALE built-in command name.' },
      args: { type: 'object', additionalProperties: true }
    },
    required: ['command'],
    additionalProperties: false
  },
  outputSchema: PERMISSIVE_OBJECT_OUTPUT_SCHEMA,
  execute: rendererOnlyExecute('rale_command')
};

const APP_CONNECTOR_CONNECT: RokuOp<{ device?: string }, unknown> = {
  id: 'app_connector_connect',
  title: 'App Connector: Connect',
  description: 'Open a RALE / App Connector session against the device\'s running Dev App.',
  runIn: 'renderer',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: { device: { type: 'string' } },
    additionalProperties: false
  },
  outputSchema: PERMISSIVE_OBJECT_OUTPUT_SCHEMA,
  execute: rendererOnlyExecute('app_connector_connect')
};

const APP_CONNECTOR_DISCONNECT: RokuOp<{ device?: string }, unknown> = {
  id: 'app_connector_disconnect',
  title: 'App Connector: Disconnect',
  description: 'Close the RALE / App Connector session on the targeted device.',
  runIn: 'renderer',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: { device: { type: 'string' } },
    additionalProperties: false
  },
  outputSchema: PERMISSIVE_OBJECT_OUTPUT_SCHEMA,
  execute: rendererOnlyExecute('app_connector_disconnect')
};

const APP_FUNCTION: RokuOp<
  { device?: string; functionName: string; functionParams?: unknown },
  unknown
> = {
  id: 'app_function',
  title: 'App Connector: Call Channel Function',
  description:
    'Invoke a single function on the sideloaded channel through the App Connector. ' +
    'Use this for any one-off function call exposed by the channel; only wrap it in an `appFunction` Action Script step when the call is part of a multi-step flow. ' +
    'The set of available functions is **channel-specific** — every sideloaded app exports its own. **Always call `list_app_connector_functions` first** to discover the exact name and the declared parameter list (`params: [{ name, type }, …]`) for the running channel before calling this tool. ' +
    '`functionParams` is a **positional array** with one entry per declared parameter, in declaration order. Each entry\'s value matches the declared `type`: `String`/`Integer`/`Boolean`/number types are primitives; `roAssociativeArray` is a JSON object (still wrapped in the outer array slot); `roArray` / `roList` is a JSON array (also wrapped). For a zero-arg function pass `[]`. ' +
    'A named object (`{ <paramName>: value }`, keyed by names from `list_app_connector_functions`) is accepted for backward compatibility and rewritten to a positional array before the call is sent. Authors should still emit positional form: a typo in a key silently passes `undefined` for that slot. ' +
    'Auto-connects the App Connector session if needed; surfaces the call as a toast in Dev Studio.',
  runIn: 'renderer',
  destructive: true,
  inputSchema: {
    type: 'object',
    properties: {
      device: { type: 'string', description: 'Optional target device (IP or serial). Omit to use the focused tab.' },
      functionName: {
        type: 'string',
        description: 'The channel function name from list_app_connector_functions.'
      },
      functionParams: {
        description:
          'Positional array of values, one per RALE-declared parameter. Use `[]` for zero-arg functions. ' +
          'A named object keyed by RALE param names is also accepted and will be normalized to positional before the call.'
      }
    },
    required: ['functionName'],
    additionalProperties: false
  },
  outputSchema: PERMISSIVE_OBJECT_OUTPUT_SCHEMA,
  execute: rendererOnlyExecute('app_function')
};

const GET_TELNET_LOG: RokuOp<
  { device?: string; afterCursor?: number; maxLines?: number },
  unknown
> = {
  id: 'get_telnet_log',
  title: 'Get Telnet / BrightScript Console Log',
  description:
    'Read lines from the BrightScript debug console (port 8085) buffer that Dev Studio holds in memory. ' +
    'Returns `{ lines, cursor, totalLines, connected }`. ' +
    'Pass `afterCursor` (the `cursor` from a previous call) to get only new lines — use this for polling. ' +
    '`maxLines` caps the response (default 500, max 2000). ' +
    'Lines only accumulate while the console is **connected**: if `connected` is false call `telnet_connect` first, then re-run this tool. ' +
    'The Roku 8085 telnet socket only allows one client at a time — `telnet_connect` will close any existing telnet session held by another tool/IDE before attaching.',
  runIn: 'renderer',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: {
      device: { type: 'string', description: 'Optional target device (IP or serial).' },
      afterCursor: {
        type: 'number',
        description: 'Cursor returned by a previous call. Omit (or pass 0) for the full buffer.'
      },
      maxLines: {
        type: 'number',
        description: 'Max lines to return (default 500, max 2000).'
      }
    },
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      lines: { type: 'array' },
      cursor: { type: 'number' },
      totalLines: { type: 'number' },
      connected: { type: 'boolean' }
    },
    additionalProperties: true
  },
  execute: rendererOnlyExecute('get_telnet_log')
};

const TELNET_CONNECT: RokuOp<{ device?: string }, unknown> = {
  id: 'telnet_connect',
  title: 'Telnet Console: Connect',
  description:
    'Open the BrightScript debug console (TCP 8085) for the targeted device, exactly as if the user had clicked the Connect button on the Telnet Console tab. ' +
    'Idempotent: returns `{ connected: true, already: true }` when already attached. ' +
    'Lines do not accumulate until this is called. After it returns successfully, poll the buffer with `get_telnet_log({ afterCursor })`. ' +
    'Roku\'s 8085 socket is single-client: connecting here will displace another tool (e.g. an IDE telnet session) that may currently hold it.',
  runIn: 'renderer',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: { device: { type: 'string', description: 'Optional target device (IP or serial). Omit to use the focused tab.' } },
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      connected: { type: 'boolean' },
      already: { type: 'boolean' },
      error: { type: 'string' }
    },
    additionalProperties: true
  },
  execute: rendererOnlyExecute('telnet_connect')
};

const TELNET_DISCONNECT: RokuOp<{ device?: string }, unknown> = {
  id: 'telnet_disconnect',
  title: 'Telnet Console: Disconnect',
  description:
    'Close the BrightScript debug console (TCP 8085) for the targeted device, mirroring the Disconnect button. ' +
    'Idempotent: returns `{ connected: false, already: true }` when no session is open. ' +
    'Use this to release the 8085 socket so another tool can attach, or to stop log accumulation.',
  runIn: 'renderer',
  destructive: false,
  inputSchema: {
    type: 'object',
    properties: { device: { type: 'string', description: 'Optional target device (IP or serial). Omit to use the focused tab.' } },
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      connected: { type: 'boolean' },
      already: { type: 'boolean' },
      error: { type: 'string' }
    },
    additionalProperties: true
  },
  execute: rendererOnlyExecute('telnet_disconnect')
};

// =============================================================================
// Registries
// =============================================================================

const ALL_OPS: ReadonlyArray<RokuOp<Record<string, unknown>, unknown>> = Object.freeze([
  KEYPRESS,
  LAUNCH,
  INPUT_TEXT,
  DEEP_LINK,
  ECP_QUERY,
  ECP_POST,
  TEST_CONNECTION,
  GET_APP_ICON,
  SIDELOAD,
  DELETE_SIDELOAD,
  SCREENSHOT,
  SCAN_DEVICES,
  // Renderer-only ops (advertised in the tool catalog; executed via the renderer transport)
  RALE_COMMAND,
  APP_CONNECTOR_CONNECT,
  APP_CONNECTOR_DISCONNECT,
  APP_FUNCTION,
  GET_TELNET_LOG,
  TELNET_CONNECT,
  TELNET_DISCONNECT
] as unknown as ReadonlyArray<RokuOp<Record<string, unknown>, unknown>>);

/** Convenience filters. */
const MAIN_OPS: typeof ALL_OPS = Object.freeze(ALL_OPS.filter((op) => op.runIn === 'main'));
const RENDERER_OPS: typeof ALL_OPS = Object.freeze(ALL_OPS.filter((op) => op.runIn === 'renderer'));

/** Lookup by id for transports that dispatch on a route / channel name. */
function findOp(id: string): RokuOp | undefined {
  return ALL_OPS.find((op) => op.id === id);
}

// =============================================================================
// Transport adapters
// =============================================================================

/**
 * Run an op. Handles validation, executor invocation, and error normalization.
 * Transports wrap this with their own (request, response) shape.
 */
async function runOp<P extends Record<string, unknown>, R>(
  op: RokuOp<P, R>,
  params: Partial<P>
): Promise<R> {
  if (op.validate) {
    const issues = op.validate(params);
    if (issues.length > 0) {
      throw new RokuOpError(
        'invalid_arg',
        issues.map((i) => `${i.path}: ${i.message}`).join('; '),
        { details: { issues } }
      );
    }
  }
  try {
    return await op.execute(params as P);
  } catch (e) {
    throw toRokuOpError(e);
  }
}

/**
 * HTTP adapter — Node `http` style. Transports (`mcp-bridge`, remote-server)
 * call this with the body already parsed to JSON.
 */
async function runOpForHttp<P extends Record<string, unknown>, R>(
  op: RokuOp<P, R>,
  body: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const params = (body && typeof body === 'object' && !Array.isArray(body)
      ? (body as P)
      : ({} as P));
    const data = await runOp(op, params);
    return {
      status: 200,
      body: data != null && typeof data === 'object' ? (data as Record<string, unknown>) : { result: data }
    };
  } catch (e) {
    const err = toRokuOpError(e);
    return { status: err.toHttpStatus(), body: err.toWire() };
  }
}

/**
 * MCP tool adapter — translate a `RokuOp` into the wire shape the MCP
 * server expects (name/title/description/inputSchema/handler that returns
 * content blocks).
 */
interface McpContentBlock {
  type: 'text';
  text: string;
}
interface McpToolResult {
  content: McpContentBlock[];
  isError?: boolean;
  structuredContent?: unknown;
}

/**
 * Translate an op's strict `ip` requirement into the agent-friendly `device`
 * field. Agents pass `device: "<IP or serial>"`; the transport resolves it
 * to an ip before the op runs. We keep the schema looking like what agents
 * actually use.
 */
function agentFacingSchema(schema: JsonSchemaObject): JsonSchemaObject {
  const props = schema.properties ? { ...schema.properties } : {};
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

function opToMcpTool<P extends Record<string, unknown>, R>(
  op: RokuOp<P, R>,
  executor?: (params: Partial<P>) => Promise<R>
): {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchemaObject;
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>;
  destructive: boolean;
} {
  const run = executor || ((p: Partial<P>) => runOp(op, p));
  return {
    name: op.id,
    title: op.title,
    description: op.description,
    inputSchema: agentFacingSchema(op.inputSchema),
    destructive: op.destructive,
    handler: async (args: Record<string, unknown>) => {
      try {
        const data = await run(args as Partial<P>);
        const text = JSON.stringify(data, null, 2);
        return { content: [{ type: 'text', text }], structuredContent: data };
      } catch (e) {
        const err = toRokuOpError(e);
        return {
          content: [{ type: 'text', text: `${err.code}: ${err.message}` }],
          isError: true,
          structuredContent: err.toWire()
        };
      }
    }
  };
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  // Individual ops (for bespoke transports that want direct refs)
  KEYPRESS,
  LAUNCH,
  INPUT_TEXT,
  DEEP_LINK,
  ECP_QUERY,
  ECP_POST,
  TEST_CONNECTION,
  GET_APP_ICON,
  SIDELOAD,
  DELETE_SIDELOAD,
  SCREENSHOT,
  SCAN_DEVICES,
  RALE_COMMAND,
  APP_CONNECTOR_CONNECT,
  APP_CONNECTOR_DISCONNECT,
  // Collections
  ALL_OPS,
  MAIN_OPS,
  RENDERER_OPS,
  findOp,
  // Adapters
  runOp,
  runOpForHttp,
  opToMcpTool
};

export type { RokuOp, OpRunLocation, JsonSchemaObject, JsonSchemaProperty, McpToolResult };

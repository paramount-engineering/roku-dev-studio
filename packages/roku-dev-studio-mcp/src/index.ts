/**
 * roku-dev-studio-mcp — MCP server entry point.
 *
 * Speaks Model Context Protocol (JSON-RPC 2.0) over stdio: line-delimited
 * JSON messages on stdin, responses on stdout, logs on stderr (never on
 * stdout — that would corrupt the protocol).
 *
 * Tools live in `tools.ts`. This file only handles transport + dispatch.
 *
 * Spec reference: https://spec.modelcontextprotocol.io/
 */

import { mcpError } from './log.js';
import { TOOLS, findTool, type Tool } from './tools.js';
import { listResources, readResource } from './resources.js';
import { listPrompts, getPrompt } from './prompts.js';
import SERVER_INSTRUCTIONS from './prose/server-instructions.md';

/** Bump when the server's tool surface changes in a way agents care about. */
const SERVER_VERSION = '0.3.0';
const SERVER_NAME = 'roku-dev-studio';

/** Negotiate against this protocol version. Mirrors the MCP "latest" stable. */
const PROTOCOL_VERSION = '2024-11-05';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

/** Stable JSON-RPC error codes per the spec. */
const ERROR_CODES = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603
} as const;

function logErr(message: string, ...rest: unknown[]): void {
  // Stderr only — stdout is reserved for MCP protocol traffic.
  mcpError(message, ...rest);
}

function writeMessage(msg: JsonRpcResponse | object): void {
  const line = JSON.stringify(msg);
  process.stdout.write(line + '\n');
}

function makeError(id: number | string | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

function makeResult(id: number | string | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function toolToWire(t: Tool): Record<string, unknown> {
  return {
    name: t.name,
    title: t.title || t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    ...(t.annotations ? { annotations: t.annotations } : {})
  };
}

async function handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const id = req.id ?? null;

  // Notifications carry no id; we never respond.
  if (req.id === undefined) {
    if (req.method === 'notifications/initialized' || req.method === 'notifications/cancelled') {
      return null;
    }
    return null;
  }

  switch (req.method) {
    case 'initialize': {
      return makeResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false, subscribe: false },
          prompts: { listChanged: false }
        },
        instructions: SERVER_INSTRUCTIONS.trim()
      });
    }
    case 'ping':
      return makeResult(id, {});
    case 'tools/list':
      return makeResult(id, { tools: TOOLS.map(toolToWire) });
    case 'tools/call': {
      const params = req.params || {};
      const name = typeof params.name === 'string' ? params.name : '';
      const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<
        string,
        unknown
      >;
      const tool = findTool(name);
      if (!tool) {
        return makeError(id, ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
      }
      try {
        const result = await tool.handler(args);
        return makeResult(id, result);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logErr(`tool ${name} threw:`, message);
        return makeResult(id, {
          content: [{ type: 'text', text: `Tool ${name} error: ${message}` }],
          isError: true
        });
      }
    }
    case 'resources/list':
      return makeResult(id, { resources: listResources() });
    case 'resources/read': {
      const params = req.params || {};
      const uri = typeof params.uri === 'string' ? params.uri : '';
      if (!uri) {
        return makeError(id, ERROR_CODES.INVALID_PARAMS, 'Missing required param "uri"');
      }
      const content = readResource(uri);
      if (!content) {
        return makeError(id, ERROR_CODES.METHOD_NOT_FOUND, `Unknown resource: ${uri}`);
      }
      return makeResult(id, { contents: [content] });
    }
    case 'prompts/list':
      return makeResult(id, { prompts: listPrompts() });
    case 'prompts/get': {
      const params = req.params || {};
      const name = typeof params.name === 'string' ? params.name : '';
      const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<
        string,
        unknown
      >;
      const prompt = getPrompt(name, args);
      if (!prompt) {
        return makeError(id, ERROR_CODES.METHOD_NOT_FOUND, `Unknown prompt: ${name}`);
      }
      return makeResult(id, prompt);
    }
    case 'logging/setLevel':
      return makeResult(id, {});
    default:
      return makeError(id, ERROR_CODES.METHOD_NOT_FOUND, `Method not implemented: ${req.method}`);
  }
}

/**
 * Read stdin as line-delimited JSON. The MCP spec uses LF-terminated JSON for
 * stdio transport, not the LSP-style `Content-Length` framing.
 */
function startStdioLoop(): void {
  let buf = '';
  process.stdin.setEncoding('utf-8');

  process.stdin.on('data', (chunk: string) => {
    buf += chunk;
    let nl = buf.indexOf('\n');
    while (nl !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      nl = buf.indexOf('\n');
      if (!line) continue;
      void processLine(line);
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });
}

async function processLine(line: string): Promise<void> {
  let req: JsonRpcRequest;
  try {
    req = JSON.parse(line);
  } catch (e) {
    writeMessage(makeError(null, ERROR_CODES.PARSE, 'Could not parse JSON-RPC message'));
    logErr('parse error', e);
    return;
  }
  if (req == null || typeof req !== 'object' || req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    writeMessage(makeError((req && (req as JsonRpcRequest).id) ?? null, ERROR_CODES.INVALID_REQUEST, 'Not a valid JSON-RPC 2.0 request'));
    return;
  }
  try {
    const res = await handleRequest(req);
    if (res != null) writeMessage(res);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logErr(`unhandled error:`, message);
    writeMessage(makeError(req.id ?? null, ERROR_CODES.INTERNAL, message));
  }
}

logErr(
  `roku-dev-studio-mcp ${SERVER_VERSION} starting (protocol ${PROTOCOL_VERSION}, ${TOOLS.length} tools, ${listResources().length} resources, ${listPrompts().length} prompts)`
);
startStdioLoop();

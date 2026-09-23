/**
 * Writes docs/mcp-tools.json from the same TOOLS array the running MCP server uses — the
 * generated data is a direct read of the real catalog, so it cannot drift the way a hand-typed
 * table in docs/mcp.html previously could. Run via `npm run docs` (see scripts/gen-docs.mjs),
 * or by CI (.github/workflows/pages.yml) right before the Pages upload.
 *
 * If you just edited operations.ts and don't see the change here: op-backed tools' description/
 * outputSchema come from `roku-dev-studio-api/lib/operations`, which that package's package.json
 * "exports" map resolves to `roku-dev-studio-api/dist/lib/operations.js` — a pre-built artifact,
 * not the live .ts source. Run `npm run build -w roku-dev-studio-api` first.
 */
import * as fs from 'fs';
import * as path from 'path';
import { TOOLS, TOOL_CATEGORIES, TOOL_CATEGORY_GROUPS } from '../src/tools.js';
import { TOOL_EXAMPLES } from '../src/tool-examples.js';

const fail = (msg: string): never => {
  throw new Error(`[gen-docs] ${msg}`);
};

// Fail loudly rather than emit an "Other" bucket: TOOL_CATEGORY_GROUPS is hand-keyed by name,
// so a new tool nobody categorized (or a renamed one left behind) must break this build.
{
  const realNames = new Set(TOOLS.map((t) => t.name));
  const uncategorized = TOOLS.filter((t) => !TOOL_CATEGORIES[t.name]).map((t) => t.name);
  const stale = Object.values(TOOL_CATEGORY_GROUPS)
    .flat()
    .filter((n) => !realNames.has(n));
  if (uncategorized.length || stale.length) {
    fail(`TOOL_CATEGORY_GROUPS drifted from TOOLS — uncategorized: [${uncategorized.join(', ')}], stale: [${stale.join(', ')}]`);
  }
}

// Every tool must spell out all four MCP annotation hints. A missing `destructiveHint` is not
// "unknown" to a client — the spec default is `true` — while the docs page only shows a badge for
// an explicit value, so a partial object silently tells humans and agents different things.
{
  const HINTS = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const;
  const partial = TOOLS.filter((t) => HINTS.some((h) => typeof t.annotations?.[h] !== 'boolean')).map((t) => t.name);
  if (partial.length) fail(`tools with incomplete annotations (all four hints required): ${partial.join(', ')}`);
}

// Every tool needs a hand-authored example (src/tool-examples.ts) that is valid against its input
// schema: known keys only, every required key, exactly one `oneOf` branch, enum members, and the
// right primitive type. `{}` is only acceptable for a tool with no parameters at all.
type Prop = { type?: string | string[]; enum?: unknown[] };
function jsType(v: unknown): string {
  if (Array.isArray(v)) return 'array';
  if (v === null) return 'null';
  return typeof v === 'number' && Number.isInteger(v) ? 'integer' : typeof v;
}
function typeMatches(declared: string | string[] | undefined, v: unknown): boolean {
  if (!declared) return true;
  const allowed = Array.isArray(declared) ? declared : [declared];
  const actual = jsType(v);
  return allowed.some((t) => t === actual || (t === 'number' && actual === 'integer'));
}
{
  const problems: string[] = [];
  const realNames = new Set(TOOLS.map((t) => t.name));
  for (const name of Object.keys(TOOL_EXAMPLES)) if (!realNames.has(name)) problems.push(`${name}: example for a tool that no longer exists`);
  for (const t of TOOLS) {
    const example = TOOL_EXAMPLES[t.name];
    const schema = t.inputSchema as { properties?: Record<string, Prop>; required?: string[]; oneOf?: Array<{ required: string[] }> };
    const props = schema.properties ?? {};
    if (!example) {
      problems.push(`${t.name}: no example`);
      continue;
    }
    const keys = Object.keys(example);
    if (keys.length === 0 && Object.keys(props).length > 0) problems.push(`${t.name}: example is {} but the tool has parameters`);
    for (const k of keys) {
      if (!(k in props)) {
        problems.push(`${t.name}: example key "${k}" is not a parameter`);
        continue;
      }
      const p = props[k];
      if (p.enum && !p.enum.includes(example[k])) problems.push(`${t.name}.${k}: ${JSON.stringify(example[k])} is not one of ${JSON.stringify(p.enum)}`);
      else if (!typeMatches(p.type, example[k])) problems.push(`${t.name}.${k}: expected ${JSON.stringify(p.type)}, got ${jsType(example[k])}`);
    }
    for (const r of schema.required ?? []) if (!(r in example)) problems.push(`${t.name}: required "${r}" missing from example`);
    if (schema.oneOf) {
      const satisfied = schema.oneOf.filter((b) => b.required.every((r) => r in example)).length;
      if (satisfied !== 1) problems.push(`${t.name}: example must satisfy exactly one oneOf branch (satisfies ${satisfied})`);
    }
  }
  if (problems.length) fail(`tool examples invalid:\n  - ${problems.join('\n  - ')}`);
}

// Every Tool (bespoke or op-backed) now carries its own `outputSchema` directly — op-backed
// ones get it copied from roku-dev-studio-api/lib/operations.ts inside opToMcpTool. Docs/
// validation-only in both cases; never sent on the real MCP tools/list response.
//
// Deliberately NOT re-sorted by name: `TOOLS`' own order is each source array's authored
// sequence (e.g. operations.ts's ALL_OPS groups KEYPRESS/LAUNCH/INPUT_TEXT/DEEP_LINK, then the
// ECP pair, then the sideload family, ...; DEBUGGER_TOOLS follows attach → breakpoints →
// wait_for_stop → step, per its own comment in tools.ts). Alphabetizing here would scramble
// that intentional grouping — mcp-tools.js's on-page category grouping is what needs a stable
// order, not the raw file.
const tools = TOOLS.map((t) => ({
  name: t.name,
  title: t.title ?? null,
  description: t.description,
  category: TOOL_CATEGORIES[t.name],
  example: TOOL_EXAMPLES[t.name],
  inputSchema: t.inputSchema,
  outputSchema: t.outputSchema ?? null,
  annotations: t.annotations ?? null
}));

const payload = {
  generatedAt: new Date().toISOString(),
  count: tools.length,
  // Display order for the docs page — the order TOOL_CATEGORY_GROUPS declares.
  categories: Object.keys(TOOL_CATEGORY_GROUPS),
  tools
};

const outPath = path.join(__dirname, '../../../docs/mcp-tools.json');
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
console.log(`[gen-docs] wrote ${tools.length} tools to ${outPath}`);

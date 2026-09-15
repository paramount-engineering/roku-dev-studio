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
import { TOOLS, TOOL_CATEGORIES } from '../src/tools.js';

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
  category: TOOL_CATEGORIES[t.name] || 'Other',
  inputSchema: t.inputSchema,
  outputSchema: t.outputSchema ?? null,
  annotations: t.annotations ?? null
}));

const payload = {
  generatedAt: new Date().toISOString(),
  count: tools.length,
  tools
};

const outPath = path.join(__dirname, '../../../docs/mcp-tools.json');
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
console.log(`[gen-docs] wrote ${tools.length} tools to ${outPath}`);

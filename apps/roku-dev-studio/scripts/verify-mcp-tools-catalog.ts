/**
 * Guard: every tool name `roku-dev-studio-mcp` actually registers must appear in every place that
 * lists them for a human — the in-app "View MCP Tools" reference modal, the docs site's MCP page,
 * and the MCP package's own README — and vice versa. All three are hand-maintained by design: their
 * prose/descriptions are curated copy (the in-app modal's is even translated), not the tool's long
 * agent-facing `description`, so this does not generate any of them; it just fails loudly when one
 * drifts from the real catalog.
 *
 * The real tool catalog can't be `import`ed directly here: tools.ts pulls in a custom esbuild
 * loader (`.md` prose files) that only its own build.mjs configures, and evaluating the whole
 * MCP server module graph is more than a name-list check needs. Instead this statically scans
 * source text for the same declarative patterns both sides already use:
 *   - packages/roku-dev-studio-api/lib/operations.ts: every `RokuOp.id` (auto-wrapped into an
 *     MCP tool by `opToMcpTool` in tools.ts — `OP_BACKED_TOOLS`).
 *   - packages/roku-dev-studio-mcp/src/tools.ts: every hand-written `Tool.name` in
 *     BESPOKE_TOOLS / NETWORK_INSPECTOR_TOOLS / DEBUGGER_TOOLS.
 *   - renderer/components/settings/mcp-tools-modal.ts: every name inside a `toolNames: [...]`
 *     array in MCP_TOOL_GROUPS.
 *   - docs/mcp.html: every `<code>name</code>` inside a <table> within the `#tools` section,
 *     plus the "`N` tools across" sentence.
 *   - packages/roku-dev-studio-mcp/README.md: every backtick-quoted name in a "## Tool catalog"
 *     table's first cell, plus the ALL_OPS enumeration paragraph and the "refresh" count sentence.
 *
 *   cd apps/roku-dev-studio && npm run verify:mcp-tools
 */
import { readFileSync } from 'fs';
import path from 'path';

const appDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appDir, '../..');

const operationsPath = path.join(repoRoot, 'packages/roku-dev-studio-api/lib/operations.ts');
const toolsPath = path.join(repoRoot, 'packages/roku-dev-studio-mcp/src/tools.ts');
const modalPath = path.join(appDir, 'renderer/components/settings/mcp-tools-modal.ts');
const docsHtmlPath = path.join(repoRoot, 'docs/mcp.html');
const mcpReadmePath = path.join(repoRoot, 'packages/roku-dev-studio-mcp/README.md');

/** All `<key>: '<snake_case>'` matches at the start of a line (ignoring leading whitespace) —
 *  matches how every `RokuOp.id` / hand-written `Tool.name` is declared: one per line, as the
 *  first thing after the property name, a plain string literal (never an interpolation). */
function scanLeadingKeyValues(src: string, key: string): Set<string> {
  const re = new RegExp(`^\\s*${key}:\\s*'([a-zA-Z][a-zA-Z0-9_]*)'`, 'gm');
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.add(m[1]);
  return out;
}

const operationsSrc = readFileSync(operationsPath, 'utf8');
const toolsSrc = readFileSync(toolsPath, 'utf8');
const modalSrc = readFileSync(modalPath, 'utf8');
const docsHtmlSrc = readFileSync(docsHtmlPath, 'utf8');
const mcpReadmeSrc = readFileSync(mcpReadmePath, 'utf8');

const opBackedNames = scanLeadingKeyValues(operationsSrc, 'id');
const bespokeNames = scanLeadingKeyValues(toolsSrc, 'name');
const realNames = new Set<string>();
opBackedNames.forEach((n) => realNames.add(n));
bespokeNames.forEach((n) => realNames.add(n));

function diffAgainstReal(surfaceNames: Set<string>): { missing: string[]; stale: string[] } {
  const missing: string[] = [];
  realNames.forEach((n) => {
    if (!surfaceNames.has(n)) missing.push(n);
  });
  missing.sort();
  const stale: string[] = [];
  surfaceNames.forEach((n) => {
    if (!realNames.has(n)) stale.push(n);
  });
  stale.sort();
  return { missing, stale };
}

// ── Surface 1: in-app "View MCP Tools" modal ────────────────────────────────
const modalNames = new Set<string>();
{
  const groupRe = /toolNames:\s*\[([\s\S]*?)\]/g;
  let gm: RegExpExecArray | null;
  while ((gm = groupRe.exec(modalSrc)) !== null) {
    const nameRe = /'([a-zA-Z][a-zA-Z0-9_]*)'/g;
    let nm: RegExpExecArray | null;
    while ((nm = nameRe.exec(gm[1])) !== null) modalNames.add(nm[1]);
  }
}

// ── Surface 2: docs/mcp.html ────────────────────────────────────────────────
const docsNames = new Set<string>();
let docsStatedCount: number | null = null;
{
  const sectionMatch = /<section[^>]*id="tools"[^>]*>[\s\S]*?<\/section>/.exec(docsHtmlSrc);
  const section = sectionMatch ? sectionMatch[0] : '';
  const tableRe = /<table>([\s\S]*?)<\/table>/g;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(section)) !== null) {
    const codeRe = /<code>([a-zA-Z][a-zA-Z0-9_]*)<\/code>/g;
    let cm: RegExpExecArray | null;
    while ((cm = codeRe.exec(tm[1])) !== null) docsNames.add(cm[1]);
  }
  const countMatch = /(\d+)\s+tools\s+across/.exec(section);
  if (countMatch) docsStatedCount = parseInt(countMatch[1], 10);
}

// ── Surface 3: packages/roku-dev-studio-mcp/README.md ───────────────────────
const readmeNames = new Set<string>();
let readmeStatedCounts: { total: number; handWritten: number; opBacked: number } | null = null;
{
  const sectionMatch = /## Tool catalog[\s\S]*?(?=\n## )/.exec(mcpReadmeSrc);
  const section = sectionMatch ? sectionMatch[0] : '';
  // Markdown table rows whose first cell is one or more backtick-quoted plain identifiers
  // (excludes rows like `| \`readOnlyHint: true\` | ... |`, whose backtick content isn't a
  // bare identifier, and any table outside this section since matching stops at the next `## `).
  const rowRe = /^\|\s*((?:`[a-zA-Z][a-zA-Z0-9_]*`,?\s*)+)\|/gm;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(section)) !== null) {
    const nameRe = /`([a-zA-Z][a-zA-Z0-9_]*)`/g;
    let nm: RegExpExecArray | null;
    while ((nm = nameRe.exec(rm[1])) !== null) readmeNames.add(nm[1]);
  }
  // The comma-separated ALL_OPS enumeration paragraph.
  const listMatch = /Today that produces these tools[^\n]*\n\n([^\n]+)\./.exec(section);
  if (listMatch) {
    const nameRe = /`([a-zA-Z][a-zA-Z0-9_]*)`/g;
    let nm: RegExpExecArray | null;
    while ((nm = nameRe.exec(listMatch[1])) !== null) readmeNames.add(nm[1]);
  }
  const countMatch = /(\d+)\s+tools\s+\((\d+)\s+bespoke\s*\+\s*(\d+)\s+op-backed\)/.exec(mcpReadmeSrc);
  if (countMatch) {
    readmeStatedCounts = {
      total: parseInt(countMatch[1], 10),
      handWritten: parseInt(countMatch[2], 10),
      opBacked: parseInt(countMatch[3], 10)
    };
  }
}

console.log(
  `verify:mcp-tools — ${realNames.size} real tools (${opBackedNames.size} op-backed, ` +
    `${bespokeNames.size} hand-written).`
);

let failed = false;

function reportSurface(label: string, names: Set<string>): void {
  const { missing, stale } = diffAgainstReal(names);
  if (missing.length === 0 && stale.length === 0) {
    console.log(`✅ ${label}: ${names.size} tools listed, matches the real catalog.`);
    return;
  }
  failed = true;
  console.error(`\n❌ ${label}: ${names.size} tools listed, but drifted from the real catalog.`);
  if (missing.length) {
    console.error(`   Missing (exist but not listed):`);
    for (const n of missing) console.error('     ' + n);
  }
  if (stale.length) {
    console.error(`   Stale (listed but no longer exist):`);
    for (const n of stale) console.error('     ' + n);
  }
}

reportSurface('mcp-tools-modal.ts', modalNames);
reportSurface('docs/mcp.html', docsNames);
reportSurface('roku-dev-studio-mcp/README.md', readmeNames);

if (docsStatedCount != null && docsStatedCount !== realNames.size) {
  failed = true;
  console.error(
    `\n❌ docs/mcp.html says "${docsStatedCount} tools across ..." — real count is ${realNames.size}.`
  );
}
if (readmeStatedCounts) {
  const wantTotal = realNames.size;
  const wantHandWritten = bespokeNames.size;
  const wantOpBacked = opBackedNames.size;
  if (
    readmeStatedCounts.total !== wantTotal ||
    readmeStatedCounts.handWritten !== wantHandWritten ||
    readmeStatedCounts.opBacked !== wantOpBacked
  ) {
    failed = true;
    console.error(
      `\n❌ roku-dev-studio-mcp/README.md's refresh-count sentence says ` +
        `"${readmeStatedCounts.total} tools (${readmeStatedCounts.handWritten} bespoke + ${readmeStatedCounts.opBacked} op-backed)" ` +
        `— real is "${wantTotal} tools (${wantHandWritten} bespoke + ${wantOpBacked} op-backed)".`
    );
  }
}

if (failed) process.exit(1);

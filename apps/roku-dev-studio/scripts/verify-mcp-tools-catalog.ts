/**
 * Guard: every tool name `roku-dev-studio-mcp` actually registers must appear in the "View MCP
 * Tools" reference modal (Settings → MCP Server), and vice versa. That modal
 * (renderer/components/settings/mcp-tools-modal.ts) is hand-maintained by design — its
 * descriptions are curated, translated UI copy, not the tool's long agent-facing `description` —
 * so this does not generate the modal; it just fails loudly when the two drift apart.
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

const opBackedNames = scanLeadingKeyValues(operationsSrc, 'id');
const bespokeNames = scanLeadingKeyValues(toolsSrc, 'name');
const realNames = new Set<string>();
opBackedNames.forEach((n) => realNames.add(n));
bespokeNames.forEach((n) => realNames.add(n));

const modalNames = new Set<string>();
const groupRe = /toolNames:\s*\[([\s\S]*?)\]/g;
let gm: RegExpExecArray | null;
while ((gm = groupRe.exec(modalSrc)) !== null) {
  const nameRe = /'([a-zA-Z][a-zA-Z0-9_]*)'/g;
  let nm: RegExpExecArray | null;
  while ((nm = nameRe.exec(gm[1])) !== null) modalNames.add(nm[1]);
}

const missingFromModal: string[] = [];
realNames.forEach((n) => {
  if (!modalNames.has(n)) missingFromModal.push(n);
});
missingFromModal.sort();

const staleInModal: string[] = [];
modalNames.forEach((n) => {
  if (!realNames.has(n)) staleInModal.push(n);
});
staleInModal.sort();

console.log(
  `verify:mcp-tools — ${realNames.size} real tools (${opBackedNames.size} op-backed, ` +
    `${bespokeNames.size} hand-written), ${modalNames.size} listed in the "View MCP Tools" modal.`
);

if (missingFromModal.length === 0 && staleInModal.length === 0) {
  console.log('✅ MCP tools modal matches the real tool catalog.');
} else {
  if (missingFromModal.length) {
    console.error(
      `\n❌ ${missingFromModal.length} tool(s) exist but are missing from mcp-tools-modal.ts ` +
        '(add to a group\'s toolNames + a description in S.settings.mcpToolDescriptions, all locales):'
    );
    for (const n of missingFromModal) console.error('  ' + n);
  }
  if (staleInModal.length) {
    console.error(
      `\n❌ ${staleInModal.length} tool(s) listed in mcp-tools-modal.ts no longer exist ` +
        '(remove from toolNames + S.settings.mcpToolDescriptions, all locales):'
    );
    for (const n of staleInModal) console.error('  ' + n);
  }
  process.exit(1);
}

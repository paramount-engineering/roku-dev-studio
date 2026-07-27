/**
 * MCP client integration for Settings → Action Scripts → MCP Server.
 *
 * Detects whether each supported MCP client is installed and reads / writes
 * its per-app MCP configuration so the user can toggle the `roku-dev-studio`
 * MCP server entry on or off from one place.
 *
 * When enabled, writes a stdio server entry that runs the bundled
 * `roku-dev-studio-mcp` entry (`dist/index.cjs`) via this app's Electron binary
 * with `ELECTRON_RUN_AS_NODE=1` (no separate Node install). Toggling off
 * removes the entry. Other servers in the same config are left untouched.
 */

import { S } from '../shared/strings/index';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { mainWarn, mainError } = require('./log');

export type McpClientId =
  | 'chatgpt'
  | 'claude'
  | 'cursor'
  | 'vscode'
  | 'vscode-insiders'
  | 'vscodium'
  | 'windsurf';

/**
 * Order matters: this is the order rows appear in Settings. Sorted by label
 * (alphabetical) so the UI stays predictable as more clients are added.
 */
export const MCP_CLIENT_IDS: readonly McpClientId[] = [
  'chatgpt',
  'claude',
  'cursor',
  'vscode',
  'vscode-insiders',
  'vscodium',
  'windsurf'
] as const;

export const MCP_CLIENT_LABELS: Record<McpClientId, string> = S.settings.mcpClientLabels;

/**
 * VS Code-family clients all share the same MCP schema (`servers` key, per-entry
 * `type: "stdio"`). Centralized so config-key + entry-shape stay aligned.
 */
const VSCODE_FAMILY: ReadonlySet<McpClientId> = new Set([
  'vscode',
  'vscode-insiders',
  'vscodium'
]);

/**
 * Server name written into each client's config. Stable so the same entry can
 * be detected, updated, or removed across runs.
 */
const MCP_SERVER_KEY = 'roku-dev-studio';

/**
 * Resolve the bundled MCP server JS at runtime. We point client configs at
 *
 *   command: <absolute path to Roku Dev Studio binary (Electron)>
 *   args:    [<absolute path to roku-dev-studio-mcp/dist/index.cjs>]
 *   env:     { ELECTRON_RUN_AS_NODE: "1" }
 *
 * so the user does not need their own Node installation. Electron in
 * node-mode behaves like Node for our stdio JSON-RPC server. The path is
 * resolved once at toggle time; if Roku Dev Studio is later reinstalled to a
 * different location, the user re-toggles.
 */
function resolveMcpServerScript(): string {
  // require.resolve walks workspace symlinks; use it to find the package's
  // entry, then point at the bundled CJS file next to it.
  try {
    const pkgPath = require.resolve('roku-dev-studio-mcp/package.json');
    const pkgDir = path.dirname(pkgPath);
    return path.join(pkgDir, 'dist', 'index.cjs');
  } catch (e) {
    mainWarn('[MCP] Could not resolve roku-dev-studio-mcp package:', e);
    return '';
  }
}

function resolveElectronExecPath(): string {
  // process.execPath = path to the Electron binary running this main process.
  // When clients spawn it with ELECTRON_RUN_AS_NODE=1, it acts as plain node.
  return process.execPath || '';
}

export type McpClientDetection = {
  id: McpClientId;
  label: string;
  installed: boolean;
  configPath: string;
  /** True if our entry is already present in the client config on disk. */
  enabledOnDisk: boolean;
};

type StdioServerEntry = {
  command: string;
  args: string[];
  type?: string;
  env?: Record<string, string>;
};

function homedir(): string {
  return os.homedir();
}

function existsAny(paths: string[]): boolean {
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * Per-OS install candidates. We accept any of these as "installed".
 * For Linux we also accept the per-user config directory existing, since
 * AppImage / Flatpak users may not have a stable executable path.
 */
function getInstallCandidates(id: McpClientId): string[] {
  const home = homedir();
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.PROGRAMFILES || '';
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] || '';
  const appData = process.env.APPDATA || '';

  if (process.platform === 'darwin') {
    if (id === 'chatgpt') {
      return [
        '/Applications/ChatGPT.app',
        path.join(home, 'Applications/ChatGPT.app')
      ];
    }
    if (id === 'claude') {
      return [
        '/Applications/Claude.app',
        path.join(home, 'Applications/Claude.app')
      ];
    }
    if (id === 'cursor') {
      return [
        '/Applications/Cursor.app',
        path.join(home, 'Applications/Cursor.app')
      ];
    }
    if (id === 'vscode') {
      return [
        '/Applications/Visual Studio Code.app',
        path.join(home, 'Applications/Visual Studio Code.app')
      ];
    }
    if (id === 'vscode-insiders') {
      return [
        '/Applications/Visual Studio Code - Insiders.app',
        path.join(home, 'Applications/Visual Studio Code - Insiders.app')
      ];
    }
    if (id === 'vscodium') {
      return [
        '/Applications/VSCodium.app',
        path.join(home, 'Applications/VSCodium.app')
      ];
    }
    if (id === 'windsurf') {
      return [
        '/Applications/Windsurf.app',
        path.join(home, 'Applications/Windsurf.app')
      ];
    }
  }

  if (process.platform === 'win32') {
    if (id === 'chatgpt') {
      return [
        path.join(localAppData, 'Programs', 'ChatGPT', 'ChatGPT.exe'),
        path.join(programFiles, 'OpenAI', 'ChatGPT', 'ChatGPT.exe'),
        path.join(programFilesX86, 'OpenAI', 'ChatGPT', 'ChatGPT.exe'),
        path.join(appData, 'OpenAI', 'ChatGPT')
      ];
    }
    if (id === 'claude') {
      return [
        path.join(localAppData, 'AnthropicClaude', 'Claude.exe'),
        path.join(localAppData, 'Programs', 'Claude', 'Claude.exe'),
        path.join(appData, 'Claude')
      ];
    }
    if (id === 'cursor') {
      return [
        path.join(localAppData, 'Programs', 'cursor', 'Cursor.exe'),
        path.join(localAppData, 'cursor', 'Cursor.exe'),
        path.join(programFiles, 'Cursor', 'Cursor.exe'),
        path.join(programFilesX86, 'Cursor', 'Cursor.exe')
      ];
    }
    if (id === 'vscode') {
      return [
        path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'),
        path.join(programFiles, 'Microsoft VS Code', 'Code.exe'),
        path.join(programFilesX86, 'Microsoft VS Code', 'Code.exe')
      ];
    }
    if (id === 'vscode-insiders') {
      return [
        path.join(localAppData, 'Programs', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
        path.join(programFiles, 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
        path.join(programFilesX86, 'Microsoft VS Code Insiders', 'Code - Insiders.exe')
      ];
    }
    if (id === 'vscodium') {
      return [
        path.join(localAppData, 'Programs', 'VSCodium', 'VSCodium.exe'),
        path.join(programFiles, 'VSCodium', 'VSCodium.exe'),
        path.join(programFilesX86, 'VSCodium', 'VSCodium.exe')
      ];
    }
    if (id === 'windsurf') {
      return [
        path.join(localAppData, 'Programs', 'Windsurf', 'Windsurf.exe'),
        path.join(programFiles, 'Windsurf', 'Windsurf.exe'),
        path.join(programFilesX86, 'Windsurf', 'Windsurf.exe')
      ];
    }
  }

  if (process.platform === 'linux') {
    if (id === 'chatgpt') {
      // ChatGPT Desktop has no official Linux release; row will report
      // "Not detected" unless one of these speculative paths exists.
      return [
        '/usr/bin/chatgpt',
        '/opt/chatgpt/chatgpt',
        '/snap/bin/chatgpt',
        path.join(home, '.config', 'ChatGPT')
      ];
    }
    if (id === 'claude') {
      return [
        '/usr/bin/claude-desktop',
        '/opt/claude/claude',
        path.join(home, '.config', 'Claude')
      ];
    }
    if (id === 'cursor') {
      return [
        '/usr/bin/cursor',
        '/opt/cursor/cursor',
        '/snap/bin/cursor',
        path.join(home, '.local', 'share', 'cursor', 'cursor'),
        path.join(home, '.var', 'app', 'com.cursor.Cursor'),
        path.join(home, '.config', 'Cursor')
      ];
    }
    if (id === 'vscode') {
      return [
        '/usr/bin/code',
        '/usr/share/code/code',
        '/snap/bin/code',
        path.join(home, '.var', 'app', 'com.visualstudio.code'),
        path.join(home, '.config', 'Code')
      ];
    }
    if (id === 'vscode-insiders') {
      return [
        '/usr/bin/code-insiders',
        '/usr/share/code-insiders/code-insiders',
        '/snap/bin/code-insiders',
        path.join(home, '.config', 'Code - Insiders')
      ];
    }
    if (id === 'vscodium') {
      return [
        '/usr/bin/codium',
        '/usr/share/codium/codium',
        '/snap/bin/codium',
        path.join(home, '.config', 'VSCodium')
      ];
    }
    if (id === 'windsurf') {
      return [
        '/usr/bin/windsurf',
        '/opt/windsurf/windsurf',
        '/snap/bin/windsurf',
        path.join(home, '.config', 'Windsurf')
      ];
    }
  }

  return [];
}

/**
 * Per-OS MCP config path. We always return a path even if the file does not
 * yet exist — we may need to create it when the user enables the toggle.
 */
function getConfigPath(id: McpClientId): string {
  const home = homedir();
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

  if (id === 'chatgpt') {
    if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'ChatGPT', 'chatgpt_mcp_config.json');
    }
    if (process.platform === 'win32') {
      return path.join(appData, 'OpenAI', 'ChatGPT', 'chatgpt_mcp_config.json');
    }
    return path.join(home, '.config', 'ChatGPT', 'chatgpt_mcp_config.json');
  }

  if (id === 'claude') {
    if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    }
    if (process.platform === 'win32') {
      return path.join(appData, 'Claude', 'claude_desktop_config.json');
    }
    return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }

  if (id === 'cursor') {
    return path.join(home, '.cursor', 'mcp.json');
  }

  if (id === 'vscode') {
    if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
    }
    if (process.platform === 'win32') {
      return path.join(appData, 'Code', 'User', 'mcp.json');
    }
    return path.join(home, '.config', 'Code', 'User', 'mcp.json');
  }

  if (id === 'vscode-insiders') {
    if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Code - Insiders', 'User', 'mcp.json');
    }
    if (process.platform === 'win32') {
      return path.join(appData, 'Code - Insiders', 'User', 'mcp.json');
    }
    return path.join(home, '.config', 'Code - Insiders', 'User', 'mcp.json');
  }

  if (id === 'vscodium') {
    if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'VSCodium', 'User', 'mcp.json');
    }
    if (process.platform === 'win32') {
      return path.join(appData, 'VSCodium', 'User', 'mcp.json');
    }
    return path.join(home, '.config', 'VSCodium', 'User', 'mcp.json');
  }

  if (id === 'windsurf') {
    /**
     * Windsurf stores its MCP config under the user home `.codeium/windsurf/`
     * directory across all platforms (Codeium-style layout).
     */
    return path.join(home, '.codeium', 'windsurf', 'mcp_config.json');
  }

  return '';
}

/**
 * VS Code-family clients use `servers`; everyone else uses `mcpServers`.
 */
function getServerKeyName(id: McpClientId): 'mcpServers' | 'servers' {
  return VSCODE_FAMILY.has(id) ? 'servers' : 'mcpServers';
}

function readConfigFile(filePath: string): Record<string, unknown> {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw || !raw.trim()) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch (e) {
    mainWarn('[MCP] Failed to read config:', filePath, e);
    return {};
  }
}

function writeConfigFile(filePath: string, value: Record<string, unknown>): boolean {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
    return true;
  } catch (e) {
    mainError('[MCP] Failed to write config:', filePath, e);
    return false;
  }
}

function getServersFromConfig(
  cfg: Record<string, unknown>,
  serverKey: 'mcpServers' | 'servers'
): Record<string, StdioServerEntry> {
  const v = cfg[serverKey];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, StdioServerEntry>;
  }
  return {};
}

function buildServerEntry(id: McpClientId): StdioServerEntry | null {
  const electronBin = resolveElectronExecPath();
  const serverScript = resolveMcpServerScript();
  if (!electronBin || !serverScript) return null;
  const entry: StdioServerEntry = {
    command: electronBin,
    args: [serverScript],
    env: { ELECTRON_RUN_AS_NODE: '1' }
  };
  if (VSCODE_FAMILY.has(id)) {
    // VS Code-family schemas accept an explicit `type: "stdio"` discriminator.
    entry.type = 'stdio';
  }
  return entry;
}

function configHasOurServer(
  cfg: Record<string, unknown>,
  serverKey: 'mcpServers' | 'servers'
): boolean {
  const servers = getServersFromConfig(cfg, serverKey);
  return Object.prototype.hasOwnProperty.call(servers, MCP_SERVER_KEY);
}

/**
 * Detect every supported client. Always returns one record per id so the UI
 * can render a stable list (uninstalled clients show as disabled rows).
 */
export function detectMcpClients(): McpClientDetection[] {
  return MCP_CLIENT_IDS.map((id) => {
    const installed = existsAny(getInstallCandidates(id));
    const configPath = getConfigPath(id);
    const cfg = installed ? readConfigFile(configPath) : {};
    const enabledOnDisk = installed ? configHasOurServer(cfg, getServerKeyName(id)) : false;
    return {
      id,
      label: MCP_CLIENT_LABELS[id],
      installed,
      configPath,
      enabledOnDisk
    };
  });
}

export type ApplyResult = {
  id: McpClientId;
  /** Whether the on-disk config now contains our server entry. */
  enabled: boolean;
  /** True if the file changed in this call. */
  changed: boolean;
  configPath: string;
  error?: string;
};

/**
 * Add or remove the `roku-dev-studio` server entry in one client's config.
 * Other entries in the same config are preserved.
 */
function applyMcpClient(id: McpClientId, enable: boolean): ApplyResult {
  const configPath = getConfigPath(id);
  const out: ApplyResult = { id, enabled: enable, changed: false, configPath };
  if (!configPath) {
    out.error = `Unsupported client: ${id}`;
    out.enabled = false;
    return out;
  }
  try {
    const cfg = readConfigFile(configPath);
    const serverKey = getServerKeyName(id);
    const servers = { ...getServersFromConfig(cfg, serverKey) };
    const had = Object.prototype.hasOwnProperty.call(servers, MCP_SERVER_KEY);

    if (enable) {
      const next = buildServerEntry(id);
      if (!next) {
        out.error =
          'Could not resolve the bundled Roku Dev Studio MCP server. Try reinstalling Roku Dev Studio.';
        out.enabled = had;
        return out;
      }
      const prev = had ? (servers[MCP_SERVER_KEY] as StdioServerEntry) : undefined;
      const sameCommand = !!prev && prev.command === next.command;
      const sameArgs = !!prev && JSON.stringify(prev.args) === JSON.stringify(next.args);
      const sameType = !!prev && (prev.type || undefined) === (next.type || undefined);
      const sameEnv = !!prev && JSON.stringify(prev.env || {}) === JSON.stringify(next.env || {});
      if (prev && sameCommand && sameArgs && sameType && sameEnv) {
        out.enabled = true;
        out.changed = false;
        return out;
      }
      servers[MCP_SERVER_KEY] = next;
    } else {
      if (!had) {
        out.enabled = false;
        out.changed = false;
        return out;
      }
      delete servers[MCP_SERVER_KEY];
    }

    const nextCfg = { ...cfg, [serverKey]: servers };
    const ok = writeConfigFile(configPath, nextCfg);
    if (!ok) {
      out.error = 'Failed to write client config';
      out.enabled = had;
      return out;
    }
    out.changed = true;
    return out;
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    out.enabled = false;
    return out;
  }
}

/**
 * Apply enabled-state to all known clients. Caller passes a partial map; only
 * keys present are touched. Returns one ApplyResult per id that was touched.
 */
export function applyMcpClients(state: Partial<Record<McpClientId, boolean>>): ApplyResult[] {
  const results: ApplyResult[] = [];
  for (const id of MCP_CLIENT_IDS) {
    if (!Object.prototype.hasOwnProperty.call(state, id)) continue;
    const enable = !!state[id];
    results.push(applyMcpClient(id, enable));
  }
  return results;
}

/**
 * Sanitize the renderer-supplied toggle map: drop unknown keys, coerce values
 * to booleans. Used by the Settings save handler.
 */
export function sanitizeMcpClientsPayload(raw: unknown): Partial<Record<McpClientId, boolean>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<McpClientId, boolean>> = {};
  for (const id of MCP_CLIENT_IDS) {
    if (id in o) out[id] = !!o[id];
  }
  return out;
}

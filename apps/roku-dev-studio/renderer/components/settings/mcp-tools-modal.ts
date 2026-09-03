/**
 * "View MCP Tools" reference modal for Settings › MCP Server — lists every tool
 * `roku-dev-studio-mcp` exposes to AI agents, grouped the way a person browsing capabilities
 * would think about them (not the internal bespoke/op-backed/debugger/network-inspector source
 * split in packages/roku-dev-studio-mcp/src/tools.ts, which is an implementation detail).
 *
 * Tool NAMES stay as plain literals (they're protocol identifiers, e.g. `debugger_attach` —
 * not translatable prose), but their descriptions are real UI copy shown to a human here, so
 * they route through S.settings.mcpToolDescriptions like every other piece of app text. Group
 * labels do the same via S.settings.mcpToolCategories.
 *
 * ponytail: this list is hand-maintained against packages/roku-dev-studio-mcp/src/tools.ts rather
 * than generated from it — reasonable while the catalog changes rarely; if it drifts a lot, upgrade
 * to a small build-time manifest generated from tools.ts instead of copying by hand.
 */
import { escapeHtml } from '../../modules/utils/dom.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { S } from '@shared/strings/index.js';

type ToolName = keyof typeof S.settings.mcpToolDescriptions;

interface McpToolGroup {
  categoryKey: keyof typeof S.settings.mcpToolCategories;
  toolNames: ToolName[];
}

const MCP_TOOL_GROUPS: McpToolGroup[] = [
  {
    categoryKey: 'discovery',
    toolNames: ['probe_bridge', 'scan_devices', 'list_devices', 'connect_device', 'test_connection', 'get_selected_device']
  },
  {
    categoryKey: 'remote',
    toolNames: ['keypress', 'input_text', 'launch_app', 'deep_link', 'ecp_query', 'ecp_post', 'screenshot', 'get_app_icon']
  },
  {
    categoryKey: 'sideload',
    toolNames: ['sideload', 'delete_sideload']
  },
  {
    categoryKey: 'telnet',
    toolNames: ['telnet_connect', 'telnet_disconnect', 'get_telnet_log', 'console_monitor_findings']
  },
  {
    categoryKey: 'appConnector',
    toolNames: [
      'app_connector_connect',
      'app_connector_disconnect',
      'app_function',
      'list_app_connector_functions',
      'rale_command',
      'rale_get_node_by_id'
    ]
  },
  {
    categoryKey: 'debugger',
    toolNames: [
      'debugger_attach',
      'debugger_status',
      'debugger_set_breakpoints',
      'debugger_list_breakpoints',
      'debugger_remove_breakpoints',
      'debugger_pause',
      'debugger_continue',
      'debugger_step',
      'debugger_wait_for_stop',
      'debugger_get_callstack',
      'debugger_get_variables',
      'debugger_evaluate',
      'debugger_detach'
    ]
  },
  {
    categoryKey: 'networkInspector',
    toolNames: [
      'network_inspector_status',
      'network_inspector_list_events',
      'network_inspector_get_event_detail',
      'network_inspector_find',
      'network_inspector_analyze',
      'network_inspector_get_ca_info'
    ]
  },
  {
    categoryKey: 'actionScripts',
    toolNames: ['list_action_types', 'get_action_schema', 'get_capability_bundle', 'validate_script', 'send_script_to_builder']
  }
];

const TOTAL_TOOL_COUNT = MCP_TOOL_GROUPS.reduce((sum, g) => sum + g.toolNames.length, 0);

function renderGroupsHtml(): string {
  return MCP_TOOL_GROUPS.map((group) => {
    const rows = group.toolNames
      .map(
        (name) =>
          `<div class="mcp-tools-row">
            <code class="mcp-tools-name">${escapeHtml(name)}</code>
            <span class="mcp-tools-desc">${escapeHtml(S.settings.mcpToolDescriptions[name])}</span>
          </div>`
      )
      .join('');
    const label = S.settings.mcpToolCategories[group.categoryKey];
    return `<section class="mcp-tools-group">
      <h4 class="mcp-tools-group-title">${escapeHtml(label)} <span class="mcp-tools-group-count">${group.toolNames.length}</span></h4>
      <div class="mcp-tools-list">${rows}</div>
    </section>`;
  }).join('');
}

/** Open the "View MCP Tools" reference modal. Purely informational — no interaction beyond closing. */
export function openMcpToolsModal(): void {
  const overlay = document.createElement('div');
  overlay.className = 'mcp-tools-overlay';

  overlay.innerHTML = `
    <div class="mcp-tools-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(S.settings.mcpToolsModalAria)}">
      <div class="mcp-tools-header">
        <h3>${escapeHtml(S.settings.mcpToolsModalTitle)}</h3>
        <button type="button" class="modal-close mcp-tools-close" title="${escapeHtml(S.common.close)}" aria-label="${escapeHtml(S.common.close)}"><span aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span></button>
      </div>
      <div class="mcp-tools-body">
        <p class="mcp-tools-intro">${escapeHtml(S.settings.mcpToolsIntro(TOTAL_TOOL_COUNT))}</p>
        <div class="mcp-tools-groups">${renderGroupsHtml()}</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  attachBackdropClickToClose(overlay, close);
  overlay.querySelector('.mcp-tools-close')?.addEventListener('click', close);
}

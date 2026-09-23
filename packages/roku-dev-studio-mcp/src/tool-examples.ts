/**
 * One realistic example call per tool, rendered on the docs site's Tool Reference (the
 * "Example" block and its copy button). Hand-authored because a schema alone can't produce a
 * meaningful call: most parameters are optional (the focused device is the default), so a
 * required-fields-only example collapses to `{}` for half the catalog.
 *
 * Keep entries valid against the tool's inputSchema — scripts/gen-docs-entry.ts checks every
 * example (known keys, required keys present, exactly one `oneOf` branch, enum members, primitive
 * types) and fails the docs build otherwise, so a renamed parameter can't leave a stale example.
 * Tools with no parameters use `{}`.
 */
const DEVICE = '192.168.1.137';

const SMOKE_TEST_SCRIPT = {
  name: 'Smoke test',
  steps: [
    { type: 'keypress', key: 'Home' },
    { type: 'wait', delayMs: 1000 },
    { type: 'screenshot' }
  ]
};

export const TOOL_EXAMPLES: Record<string, Record<string, unknown>> = {
  // Device Connection & Discovery
  probe_bridge: {},
  scan_devices: { timeoutMs: 6000, includeSubnetScan: true },
  list_devices: {},
  connect_device: { device: DEVICE },
  test_connection: { device: DEVICE },
  get_selected_device: {},

  // Remote Control & ECP
  keypress: { key: 'Home' },
  input_text: { text: 'roku dev studio' },
  launch_app: { appId: 'dev' },
  deep_link: { appId: 'dev', contentId: 'episode-42', mediaType: 'episode' },
  ecp_query: { endpoint: '/query/active-app' },
  ecp_post: { endpoint: '/sgrendezvous/track' },
  screenshot: { waitAfterTriggerMs: 500 },
  get_app_icon: { appId: '837' },
  device_performance_metrics: { charts: ['cpu', 'memory'], windowSec: 300 },

  // Sideloading
  sideload: { filePath: '/Users/me/builds/my-channel.zip' },
  delete_sideload: { device: DEVICE },

  // Telnet & Console
  telnet_connect: { device: DEVICE },
  telnet_disconnect: { device: DEVICE },
  get_telnet_log: { maxLines: 200 },
  console_monitor_findings: { device: DEVICE },

  // App Connector & RALE
  app_connector_connect: { device: DEVICE },
  app_connector_disconnect: { device: DEVICE },
  app_function: { functionName: 'getAppVersion', functionParams: [] },
  list_app_connector_functions: { device: DEVICE },
  rale_command: { command: 'getRegistrySections', args: {} },
  rale_get_node_by_id: { id: 'MainScene' },

  // Debugger
  debugger_attach: { device: DEVICE },
  debugger_status: { device: DEVICE },
  debugger_set_breakpoints: {
    breakpoints: [
      { path: 'pkg:/source/main.brs', line: 42 },
      { path: 'pkg:/components/MainScene.brs', line: 10, condition: 'm.top.visible = true' }
    ]
  },
  debugger_list_breakpoints: { device: DEVICE },
  debugger_remove_breakpoints: { locations: [{ filePath: 'pkg:/source/main.brs', lineNumber: 42 }] },
  debugger_pause: { device: DEVICE },
  debugger_continue: { device: DEVICE },
  debugger_step: { kind: 'over' },
  debugger_wait_for_stop: { timeoutMs: 15000 },
  debugger_get_callstack: { threadIndex: 0 },
  debugger_get_variables: { variablePath: ['m', 'top', 'count'], stackFrameIndex: 0 },
  debugger_evaluate: { expression: 'print m.top.visible' },
  debugger_detach: { device: DEVICE },

  // Network Inspector
  network_inspector_status: {},
  network_inspector_list_events: { host: 'api.example.com', type: 'http-transaction', errorsOnly: true, limit: 50 },
  network_inspector_get_event_detail: { id: 'ni-1758650000000-42', includeFullBody: true },
  network_inspector_find: { query: 'Authorization', scopes: ['reqHeaders'], limit: 20 },
  network_inspector_analyze: { statusClass: ['4xx', '5xx'], mitmOnly: true },
  network_inspector_get_ca_info: {},

  // Action Scripts
  list_action_types: {},
  get_action_schema: { type: 'keypress' },
  get_capability_bundle: {},
  validate_script: { script: SMOKE_TEST_SCRIPT },
  send_script_to_builder: { script: SMOKE_TEST_SCRIPT, device: DEVICE }
};

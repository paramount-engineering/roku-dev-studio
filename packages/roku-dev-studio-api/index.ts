/**
 * Roku Dev Studio API — programmatic Roku control (discovery, ECP, dev tools).
 */

const {
  parseDeviceInfo,
  normalizeEcpSettingMode,
  getDeviceId,
  isIpOnSameSubnet,
  getDeviceInfo
} = require('./lib/device-info');

const { getDeviceImageUrl, fetchDeviceHardwareImage } = require('./lib/device-hardware-image');

const { ssdpDiscover, subnetScan } = require('./lib/discovery');
const { resolveDeviceIp } = require('./lib/device-registry');
const { isValidIp, validateDevPassword } = require('roku-dev-studio-platform/validation');
const { captureRokuScreenshot } = require('./lib/screenshot');
const { verifyDeveloperDigestAuth } = require('./lib/verify-dev-digest-auth');
const { sideloadChannel, deleteSideload, rebootDevice, checkForUpdate } = require('./lib/plugin-install');
const { buildFiddleZip, userCodeDefinesInit } = require('./lib/bs-fiddle-template');
const { buildDemoZip } = require('./lib/demo-channel-template');

const {
  ecpErrorFromStatus,
  ecpRequest,
  keypress,
  launch,
  query,
  post,
  inputText,
  deeplink,
  testConnection,
  getIcon
} = require('./ecp');

const { createRelayClient, validateRelayBaseUrl } = require('./relay-client');
const { runActionScript, validateScriptStructure } = require('./lib/script-runner');
const { validateScript: validateActionScript } = require('./lib/validate-action-script');
const catalogs = require('./lib/catalogs');
const errors = require('./lib/errors');
const deviceRef = require('roku-dev-studio-platform/device-ref');
const operations = require('./lib/operations');
const raleDirect = require('./lib/rale-direct');
const rokuTelnet = require('./lib/roku-telnet');
const {
  normalizeRaleFunctions,
  parseGetExternalControlFunctionsResponse
} = require('./lib/rale-functions-normalize');

const {
  DEFAULT_RALE_PORT,
  SCREENSHOT_DEBOUNCE_DELAY,
  SCREENSHOT_AFTER_LAUNCH_DELAY,
  TELNET_TIMEOUT,
  DEFAULT_TELNET_CONNECT_TIMEOUT_MS,
  QUERY_TIMEOUT,
  CONNECTION_CHECK_INTERVAL,
  DEVICE_METRICS_SAMPLE_INTERVAL_MIN_MS,
  TOAST_DISPLAY_DURATION,
  STATUS_MESSAGE_DURATION,
  INPUT_TEXT_KEY_DELAY_MS,
  INPUT_TEXT_PER_KEY_TIMEOUT_MS,
  INPUT_TEXT_RELAY_HTTP_MIN_TIMEOUT_MS,
  INPUT_TEXT_RELAY_HTTP_MAX_TIMEOUT_MS,
  computeInputTextRelayHttpTimeoutMs
} = require('./lib/shared-constants');

const { PACKAGE_VERSION } = require('./lib/package-version');

module.exports = {
  /** Semantic version of this package (same as npm `package.json` `version`). */
  PACKAGE_VERSION,
  // Device info
  parseDeviceInfo,
  normalizeEcpSettingMode,
  getDeviceId,
  isIpOnSameSubnet,
  getDeviceInfo,
  getDeviceImageUrl,
  fetchDeviceHardwareImage,
  // Discovery
  ssdpDiscover,
  subnetScan,
  resolveDeviceIp,
  // Validation
  isValidIp,
  validateDevPassword,
  // Screenshot / sideload
  captureRokuScreenshot,
  verifyDeveloperDigestAuth,
  sideloadChannel,
  deleteSideload,
  rebootDevice,
  checkForUpdate,
  // BrightScript Fiddle (generate minimal sideloadable channel around user code)
  buildFiddleZip,
  userCodeDefinesInit,
  // Demo channel (static sideloadable "Roku Dev Studio Showcase" channel)
  buildDemoZip,
  // ECP
  ecpErrorFromStatus,
  ecpRequest,
  keypress,
  launch,
  query,
  post,
  inputText,
  deeplink,
  testConnection,
  getIcon,
  // Relay HTTP client
  createRelayClient,
  validateRelayBaseUrl,
  // Action scripts (headless)
  runActionScript,
  validateScriptStructure,
  /**
   * Canonical Action Script validator.
   * Returns `{ ok, errors[], stepCounts }` with structured `path`/`code`/`expected`
   * errors that every surface (MCP, Builder, CLI) can consume.
   * See `.discussion-docs/unified-action-script-validation.md`.
   */
  validateActionScript,
  // Shared defaults (lib/shared-constants.js) — API, CLI, relay, desktop
  DEFAULT_RALE_PORT,
  SCREENSHOT_DEBOUNCE_DELAY,
  SCREENSHOT_AFTER_LAUNCH_DELAY,
  TELNET_TIMEOUT,
  QUERY_TIMEOUT,
  CONNECTION_CHECK_INTERVAL,
  DEVICE_METRICS_SAMPLE_INTERVAL_MIN_MS,
  TOAST_DISPLAY_DURATION,
  STATUS_MESSAGE_DURATION,
  INPUT_TEXT_KEY_DELAY_MS,
  INPUT_TEXT_PER_KEY_TIMEOUT_MS,
  INPUT_TEXT_RELAY_HTTP_MIN_TIMEOUT_MS,
  INPUT_TEXT_RELAY_HTTP_MAX_TIMEOUT_MS,
  computeInputTextRelayHttpTimeoutMs,
  // RALE direct (TCP on LAN)
  raleWake: raleDirect.raleWake,
  raleConnect: raleDirect.raleConnect,
  raleCommand: raleDirect.raleCommand,
  raleDisconnect: raleDirect.raleDisconnect,
  raleDisconnectAll: raleDirect.raleDisconnectAll,
  raleConnectionStatus: raleDirect.raleConnectionStatus,
  // Roku telnet TCP (debug 8085, system 8080)
  ROKU_DEBUG_TELNET_PORT: rokuTelnet.ROKU_DEBUG_TELNET_PORT,
  ROKU_SYSTEM_TELNET_PORT: rokuTelnet.ROKU_SYSTEM_TELNET_PORT,
  DEFAULT_TELNET_CONNECT_TIMEOUT_MS,
  connectRokuDebugTelnet: rokuTelnet.connectRokuDebugTelnet,
  connectRokuSystemTelnet: rokuTelnet.connectRokuSystemTelnet,
  writeRokuTelnetLine: rokuTelnet.writeRokuTelnetLine,
  // App Connector Function list (same normalization as Dev Studio)
  normalizeRaleFunctions,
  parseGetExternalControlFunctionsResponse,
  // Shared error taxonomy
  RokuOpError: errors.RokuOpError,
  ROKU_OP_ERROR_CODES: errors.ROKU_OP_ERROR_CODES,
  toRokuOpError: errors.toRokuOpError,
  // Device identity helpers
  parseDeviceRef: deviceRef.parseDeviceRef,
  deviceMatches: deviceRef.deviceMatches,
  findDevice: deviceRef.findDevice,
  resolveDevice: deviceRef.resolveDevice,
  // Transport-agnostic operations framework
  ALL_OPS: operations.ALL_OPS,
  MAIN_OPS: operations.MAIN_OPS,
  RENDERER_OPS: operations.RENDERER_OPS,
  findOp: operations.findOp,
  runOp: operations.runOp,
  runOpForHttp: operations.runOpForHttp,
  opToMcpTool: operations.opToMcpTool,
  // Canonical catalogs (step schema, keypress, RALE built-ins, authoring rules)
  STEP_SCHEMA: catalogs.STEP_SCHEMA,
  SCRIPT_VERSIONS: catalogs.SCRIPT_VERSIONS,
  SAVE_ACTION_TYPES: catalogs.SAVE_ACTION_TYPES,
  PASSWORD_STEP_TYPES: catalogs.PASSWORD_STEP_TYPES,
  KEYPRESS_GROUPS: catalogs.KEYPRESS_GROUPS,
  KEYPRESS_OPTIONS: catalogs.KEYPRESS_OPTIONS,
  QUERY_PRESETS: catalogs.QUERY_PRESETS,
  POST_PRESETS: catalogs.POST_PRESETS,
  SYSTEM_TELNET_PRESETS: catalogs.SYSTEM_TELNET_PRESETS,
  WAIT_SOURCES: catalogs.WAIT_SOURCES,
  IF_SOURCES: catalogs.IF_SOURCES,
  MEDIA_PLAYER_STATES: catalogs.MEDIA_PLAYER_STATES,
  ACTIVE_APP_IF_ATTRIBUTES: catalogs.ACTIVE_APP_IF_ATTRIBUTES,
  NODE_FIELD_OPERATOR_DEFS: catalogs.NODE_FIELD_OPERATOR_DEFS,
  DEVICE_PERFORMANCE_CHART_IDS: catalogs.DEVICE_PERFORMANCE_CHART_IDS,
  RALE_BUILTINS: catalogs.RALE_BUILTINS,
  RALE_READ_ONLY_COMMANDS: catalogs.RALE_READ_ONLY_COMMANDS,
  AUTHORING_RULES: catalogs.AUTHORING_RULES
};

/**
 * MCP loopback bridge: device + App Connector shapes pushed from renderer → main.
 * Use `import type` from the renderer so legacy transpile emits no runtime import.
 */

/**
 * `local`: a physical Roku on this LAN, ECP'd directly by the main process.
 * `remote`: a physical Roku reachable through an RDS Relay server at another location.
 * `rce`: a Roku Cloud Emulator (cloud-hosted virtual device) — no real IP; `ip` above is a
 * serial/synthetic stand-in. Most main-direct device-control tools (keypress/launch_app/
 * ecp_query/ecp_post/input_text/deep_link/get_app_icon/test_connection/screenshot) DO work
 * against an `rce` device — `main/mcp-bridge.ts`'s `runOpForRce` detects it via this `source`
 * field and dials the RCE Device API directly instead of a real `ip:8060`. `sideload` /
 * `delete_sideload` do NOT yet work against `rce` — use connect_device + Dev Studio's Sideload
 * Relay or Dev App tab instead.
 * `unknown`: the renderer didn't tag a source (shouldn't happen in practice).
 */
export type McpBridgeDeviceSource = 'local' | 'remote' | 'rce' | 'unknown';

/** One device row (connected tab, discovered, or known from list). */
export type McpBridgeDeviceSnapshot = {
  ip: string | null;
  serial: string | null;
  modelName?: string | null;
  modelNumber?: string | null;
  friendlyDeviceName?: string | null;
  softwareVersion?: string | null;
  /** Where the device is connected: local network, or a remote relay location id. */
  source?: McpBridgeDeviceSource;
  remoteLocationId?: string | null;
  /** Whether this is the device tab the user currently has focused. */
  isTabFocused?: boolean;
  /** Whether the device has an open tab in Dev Studio (vs just discovered) — a session existing,
   *  not a live reachability check. A device can have an open tab and still be unreachable
   *  (powered off, off-network); see `isReachable`. */
  isTabOpen?: boolean;
  /** Whether the device actually answered the last reachability check (ECP ping / connection-check
   *  poll). Only tracked for devices with an open tab (`isTabOpen`); devices merely discovered or
   *  remembered are always `false` here since there's no live session to probe. This is the flag
   *  to gate a live command on — `isTabOpen` alone does not mean the device will respond right now. */
  isReachable?: boolean;
};

export type McpBridgeSelectedDeviceSnapshot = (McpBridgeDeviceSnapshot & { observedAt: string }) | null;

export type McpBridgeAppConnectorStatus =
  | 'connected'
  | 'available-not-connected'
  | 'not-applicable'
  | 'unknown';

export type McpBridgeAppConnectorState = {
  status: McpBridgeAppConnectorStatus;
  /**
   * Live App Connector Function list pushed from renderer. `description` is
   * optional — surfaced when the channel includes one in
   * `GetExternalControlFunctions`.
   */
  functions: Array<{
    name: string;
    params: Array<{ name: string; type?: string }>;
    description?: string;
  }>;
  fetchedAt?: string;
};

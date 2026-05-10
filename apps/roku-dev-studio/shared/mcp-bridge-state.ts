/**
 * MCP loopback bridge: device + App Connector shapes pushed from renderer → main.
 * Use `import type` from the renderer so legacy transpile emits no runtime import.
 */

export type McpBridgeDeviceSource = 'local' | 'remote' | 'unknown';

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
  /** Whether this is the device the user currently has focused. */
  isFocused?: boolean;
  /** Whether the device has an open tab in Dev Studio (vs just discovered). */
  isConnected?: boolean;
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

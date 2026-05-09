// Roku Dev Studio - Renderer Process
// Handles device discovery, tab management, and multi-device control

// Import modules
import {
  escapeHtml,
  decodeHtmlEntities,
  icon,
  setSafeHTML,
  formatQueryResult,
  getStoredPassword,
  removePassword,
  hydrateSecretCache,
  showStatusMessage,
  showToast,
  DEFAULT_RALE_PORT,
  SCREENSHOT_DEBOUNCE_DELAY,
  CONNECTION_CHECK_INTERVAL,
  loadPersistedAppSettings,
  KEYBOARD_REMOTE_SHORTCUTS_ENABLED,
  AUTO_CONNECT_LAST_DEVICE_ENABLED,
  REMEMBER_SIDEBAR_TOGGLE,
  QUERY_ENDPOINTS
} from './modules/index.js';
import { errMessage } from './modules/utils/err-message.js';
import {
  prepareModalOpenOrigin,
  playModalOpenMotion,
  closeModalWithOriginMotion,
  openModalOverlayActiveFromOpener
} from './modules/utils/modal-origin-motion.js';
import { setupTelnet } from './modules/telnet/telnet-console-panel.js';
import { setupQueries as setupQueriesComponent } from './components/queries/index.js';
import { setupInspector as setupInspectorComponent } from './components/inspector/index.js';
import { setupDevApp as setupDevAppComponent } from './components/dev-app/index.js';
import { setupActionScripts as setupActionScriptsComponent } from './components/action-scripts/index.js';
import { setupRemoteTabMetrics } from './components/dev-app/device-metrics.js';
import { dispatchDevAppForegroundFromActiveAppXml } from './components/dev-app/dev-app-foreground-sync.js';
import { registerKeyboardRemoteAutoScreenshotRemote, scheduleKeyboardRemoteAutoScreenshotForActiveInnerTab } from './modules/utils/keyboard-remote-auto-screenshot-registry.js';
import { registerPanelApi, getPanelApi } from './modules/device-api/panel-api-registry.js';
import { onAppSettingsChanged } from './modules/utils/app-settings-change-bus.js';
import {
  pushMcpBridgeState,
  setFocusedDevice,
  registerMcpConnectResolver,
  onMcpAgentAction,
  ensureMcpStoredPasswordBridge,
  ensureMcpAgentScreenshotBridge
} from './modules/mcp-bridge-client.js';
import { peekAppConnector } from './modules/app-connector/index.js';

// ============================================
// Developer Mode - Conditional Logging
// ============================================

let developerModeEnabled = false;

// Developer-only logging function - only outputs when Developer Mode is enabled
function devLog(...args: unknown[]) {
  if (developerModeEnabled) {
    console.log('[DEV]', ...args);
  }
}

// Initialize developer mode on load
async function initDeveloperMode() {
  try {
    const result = await window.roku.getDeveloperMode();
    developerModeEnabled = result.enabled;
    devLog('Developer Mode initialized:', developerModeEnabled);
  } catch (e) {
    // Developer mode not available, keep disabled
  }
  
  // Listen for changes from the File menu
  window.roku.onDeveloperModeChanged((enabled) => {
    developerModeEnabled = enabled;
    if (enabled) {
      console.log('[DEV] Developer Mode ENABLED - console logging active');
    } else {
      console.log('[DEV] Developer Mode DISABLED');
    }
  });
}

// ============================================
// Privacy Mode - Mask IPs and Serial Numbers
// ============================================

let privacyModeEnabled = false;

// Apply privacy mode to the document
function applyPrivacyMode(enabled) {
  privacyModeEnabled = enabled;
  if (enabled) {
    document.body.classList.add('privacy-mode');
  } else {
    document.body.classList.remove('privacy-mode');
  }
}

// Initialize privacy mode on load
async function initPrivacyMode() {
  try {
    const result = await window.roku.getPrivacyMode();
    applyPrivacyMode(result.enabled);
  } catch (e) {
    // Privacy mode not available, keep disabled
  }
  
  // Listen for changes from the File menu
  window.roku.onPrivacyModeChanged((enabled) => {
    applyPrivacyMode(enabled);
  });
}

// Wrap everything in try-catch to catch any errors
try {

// ============================================
// State Management
// ============================================

const state = {
  devices: new Map(), // deviceId (serial or ip) -> device info
  connectedDevices: new Map(), // ip -> { device, tabId, locationId? }
  activeTabId: null,
  isScanning: false,
  // Remote Locations
  remoteLocations: new Map(), // locationId -> { id, name, host, port, serverUrl, status, devices: Map }
  scanningLocations: new Set(), // locationIds currently being scanned
  collapsedLocations: new Set() // locationIds that are collapsed in sidebar
};

/**
 * Snapshot connectedDevices and push to the MCP bridge so external agents can
 * call `list_devices`. Called on every connect / disconnect / activate-tab.
 * Cheap (small list); idempotent — main just overwrites its cache.
 */
type DeviceSnap = {
  ip: string | null;
  serial: string | null;
  modelName: string | null;
  modelNumber: string | null;
  friendlyDeviceName: string | null;
  softwareVersion: string | null;
  source: 'local' | 'remote';
  remoteLocationId: string | null;
  isFocused: boolean;
  isConnected: boolean;
};

function snapDevice(
  dev: Record<string, unknown>,
  extras: {
    source: 'local' | 'remote';
    isConnected: boolean;
    isFocused: boolean;
    remoteLocationId: string | null;
  }
): DeviceSnap {
  return {
    ip: typeof dev.ip === 'string' ? dev.ip : null,
    serial:
      typeof dev.serialNumber === 'string'
        ? dev.serialNumber
        : typeof dev.serial === 'string'
          ? dev.serial
          : null,
    modelName: typeof dev.modelName === 'string' ? dev.modelName : null,
    modelNumber: typeof dev.modelNumber === 'string' ? dev.modelNumber : null,
    friendlyDeviceName:
      typeof dev.userDeviceName === 'string'
        ? dev.userDeviceName
        : typeof dev.friendlyDeviceName === 'string'
          ? dev.friendlyDeviceName
          : typeof dev.deviceName === 'string'
            ? dev.deviceName
            : null,
    softwareVersion: typeof dev.softwareVersion === 'string' ? dev.softwareVersion : null,
    source: extras.source,
    remoteLocationId: extras.remoteLocationId,
    isFocused: extras.isFocused,
    isConnected: extras.isConnected
  };
}

function pushDeviceListToMcpBridge(): void {
  try {
    const activeTabId = state.activeTabId;

    // Build connected list first, and track which ip/locationId:ip pairs are
    // already connected so we don't duplicate them in `knownDevices`.
    const connected: DeviceSnap[] = [];
    const connectedKeys = new Set<string>();
    state.connectedDevices.forEach((conn: Record<string, unknown>, key: string) => {
      const dev = (conn?.device as Record<string, unknown>) || {};
      const isRemote = !!conn?.isRemote;
      const locId = typeof conn?.locationId === 'string' ? (conn.locationId as string) : null;
      connected.push(
        snapDevice(dev, {
          source: isRemote ? 'remote' : 'local',
          remoteLocationId: locId,
          isConnected: true,
          isFocused: typeof conn?.tabId === 'string' && conn.tabId === activeTabId
        })
      );
      connectedKeys.add(key);
    });

    // Expand with discovered-on-LAN and remote-location devices the user
    // hasn't connected yet. The agent can target these via `connect_device`
    // or per-call overrides.
    const known: DeviceSnap[] = [...connected];

    state.devices.forEach((dev: Record<string, unknown>) => {
      const ip = typeof dev.ip === 'string' ? (dev.ip as string) : null;
      if (!ip) return;
      if (connectedKeys.has(ip)) return;
      known.push(
        snapDevice(dev, {
          source: 'local',
          remoteLocationId: null,
          isConnected: false,
          isFocused: false
        })
      );
    });

    state.remoteLocations.forEach((loc: Record<string, unknown>, locId: string) => {
      const devices = loc?.devices;
      if (!(devices instanceof Map)) return;
      devices.forEach((dev: Record<string, unknown>) => {
        const ip = typeof dev.ip === 'string' ? (dev.ip as string) : null;
        if (!ip) return;
        const key = `${locId}:${ip}`;
        if (connectedKeys.has(key)) return;
        known.push(
          snapDevice(dev, {
            source: 'remote',
            remoteLocationId: locId,
            isConnected: false,
            isFocused: false
          })
        );
      });
    });

    const focused = connected.find((d) => d.isFocused) || null;

    // Let the bridge client know which device is focused so untargeted tool
    // calls fall back to it.
    setFocusedDevice(focused ? { serial: focused.serial, ip: focused.ip } : null);

    pushMcpBridgeState({
      connectedDevices: connected,
      knownDevices: known,
      selectedDevice: focused
        ? {
            ip: focused.ip,
            serial: focused.serial,
            modelName: focused.modelName,
            modelNumber: focused.modelNumber,
            friendlyDeviceName: focused.friendlyDeviceName,
            softwareVersion: focused.softwareVersion,
            source: focused.source,
            remoteLocationId: focused.remoteLocationId,
            isFocused: true,
            isConnected: true
          }
        : null
    });
  } catch (e) {
    console.warn('[mcp-bridge] could not push device list', e);
  }
}

/**
 * Register an MCP bridge resolver that opens a device tab on agent request.
 * Called once at boot. Looks up the target in `state.devices` (local) or
 * `state.remoteLocations` (remote) and delegates to the existing connect
 * flows.
 */
function registerMcpConnectFlow(): void {
  registerMcpConnectResolver(async (target) => {
    const wantIp = target.ip || '';
    const wantSerial = target.serial || '';

    // Already connected? Short-circuit with the existing tab.
    for (const conn of state.connectedDevices.values()) {
      const dev = (conn as { device?: Record<string, unknown> })?.device || {};
      const devIp = typeof dev.ip === 'string' ? dev.ip : '';
      const devSerial =
        typeof dev.serialNumber === 'string' ? dev.serialNumber : typeof dev.serial === 'string' ? dev.serial : '';
      if ((wantIp && devIp === wantIp) || (wantSerial && devSerial === wantSerial)) {
        return { ok: true, device: { ip: devIp || null, serial: devSerial || null } };
      }
    }

    // Local scan cache
    for (const dev of state.devices.values()) {
      const d = dev as Record<string, unknown>;
      const devIp = typeof d.ip === 'string' ? d.ip : '';
      const devSerial =
        typeof d.serialNumber === 'string' ? d.serialNumber : typeof d.serial === 'string' ? d.serial : '';
      if ((wantIp && devIp === wantIp) || (wantSerial && devSerial === wantSerial)) {
        try {
          await connectDevice(d);
          return { ok: true, device: { ip: devIp || null, serial: devSerial || null } };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }
    }

    return {
      ok: false,
      error: `Device "${wantSerial || wantIp}" was not found in the Local Devices list. Scan or add it manually first, then call connect_device again.`
    };
  });
}

/** When auto-connect is on, we persist this list and update it on each connect/disconnect. */
const AUTO_CONNECT_DEVICE_LIST_KEY = 'autoConnectRememberedDevices';

type AutoConnectDeviceEntry = {
  v: 1;
  kind: 'local' | 'remote';
  ip: string;
  serialNumber?: string;
  locationId?: string;
  serverUrl?: string;
};

let startupLocalScanComplete = false;
let startupRemoteScanComplete = false;
let autoConnectLastDeviceAttempted = false;
/** `undefined` = not read yet */
let cachedRememberedDeviceList: AutoConnectDeviceEntry[] | undefined = undefined;

/** v2: default is sidebar expanded when key is absent (v1 often stayed `'1'` and felt like the app “auto-collapsed”). */
const RDS_SIDEBAR_COLLAPSED_KEY = 'rds-sidebar-collapsed-v2';

/** Persisted collapse at launch; used when {@link REMEMBER_SIDEBAR_TOGGLE} to defer “hide sidebar” until post-scan. */
let rememberedSidebarCollapsedAtLaunch = false;
/** When true, startup sidebar orchestration has finished (or user took over). */
let postStartupSidebarDecisionComplete = false;
/** User used the title-bar sidebar control before post-startup finished. */
let userToggledSidebarDuringStartup = false;
/** Pointer or focus entered the sidebar during post-startup; blocks auto-collapse for this launch. */
let startupSidebarStickySuppress = false;
/** Session-only: keep sidebar expanded over a persisted `'1'` (sticky / no device / pointer-on-sidebar). */
let sidebarSessionKeepExpandedOverride = false;
let postStartupSidebarGraceTimer: number | null = null;
let lastPointerClientX = -1;
let lastPointerClientY = -1;
let startupScansReadyPromise: Promise<void> | null = null;

const POST_STARTUP_SIDEBAR_GRACE_MS = 400;

// ============================================
// Icon Helper, Password Storage, and Utilities
// ============================================
// These are now imported from modules/utils
// icon, getStoredPassword, removePassword are imported above

// ============================================
// Unified API Adapter (abstracts local vs remote calls)
// ============================================

/**
 * Per-method adapter spec. One table drives both local and remote branches so
 * a new device API method is added in a single place.
 *
 *  - `prefix: 'ip'` — local call is `window.roku[localName](ip, ...userArgs)`
 *                    and remote is `window.roku[remoteName](serverUrl, ip, ...userArgs)`.
 *                    This covers the vast majority (keypress, launch, query, …).
 *
 *  - `prefix: 'none'` — the user already provides the identifying token
 *                       (e.g. a RALE `connectionId`). Local call is
 *                       `window.roku[localName](...userArgs)`; remote is
 *                       `window.roku[remoteName](serverUrl, ...userArgs)`.
 *                       Used for `raleCommand` / `raleDisconnect`.
 *
 * `localName` / `remoteName` default to method + `'remote' + Capitalized(method)`;
 * declare them explicitly when the IPC name diverges (e.g. `remoteSideloadUpload`).
 */
interface AdapterMethodSpec {
  name: string;
  prefix: 'ip' | 'none';
  localName?: string;
  remoteName?: string;
}

const ADAPTER_METHOD_SPECS: readonly AdapterMethodSpec[] = [
  { name: 'keypress', prefix: 'ip' },
  { name: 'launch', prefix: 'ip' },
  { name: 'query', prefix: 'ip' },
  { name: 'post', prefix: 'ip' },
  { name: 'inputText', prefix: 'ip' },
  { name: 'deeplink', prefix: 'ip' },
  { name: 'getIcon', prefix: 'ip' },
  { name: 'screenshot', prefix: 'ip' },
  { name: 'verifyDevAuth', prefix: 'ip' },
  // Local uses `sideload`, remote uses `remoteSideloadUpload` (multipart upload).
  { name: 'sideload', prefix: 'ip', remoteName: 'remoteSideloadUpload' },
  { name: 'deleteSideload', prefix: 'ip' },
  { name: 'raleWake', prefix: 'ip' },
  { name: 'raleConnect', prefix: 'ip' },
  // RALE command / disconnect use a per-socket connectionId (not ip) as the
  // identifying token, so no ip is prepended.
  { name: 'raleCommand', prefix: 'none' },
  { name: 'raleDisconnect', prefix: 'none' },
  // Telnet console (port 8085)
  { name: 'telnetConnect', prefix: 'ip' },
  { name: 'telnetDisconnect', prefix: 'ip' },
  { name: 'telnetSend', prefix: 'ip' },
  { name: 'telnetStatus', prefix: 'ip' },
  // Telnet system commands (port 8080)
  { name: 'telnetSystemConnect', prefix: 'ip' },
  { name: 'telnetSystemDisconnect', prefix: 'ip' },
  { name: 'telnetSystemSend', prefix: 'ip' },
  { name: 'telnetSystemStatus', prefix: 'ip' }
];

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function createApiAdapter(isRemote, ip, serverUrl = null) {
  const useRemote = !!(isRemote && serverUrl);
  const remoteBase = serverUrl || '';

  // Helper to wrap API calls with logging.
  const wrapApiCall = (method, fn) => {
    return async (...args) => {
      const startTime = Date.now();
      const target = useRemote ? `${remoteBase} → ${ip}` : ip;
      const argsStr = args.map(arg => {
        if (typeof arg === 'string' && arg.length > 100) {
          return arg.substring(0, 100) + '...';
        }
        if (typeof arg === 'string' && (arg.includes('password') || method.includes('password'))) {
          return '***';
        }
        return arg;
      }).join(', ');
      devLog(`[API ${method}] ${useRemote ? 'REMOTE' : 'LOCAL'} → ${target}`, argsStr || '(no args)');
      try {
        const result = await fn(...args);
        const duration = Date.now() - startTime;
        devLog(`[API ${method}] ✓ SUCCESS (${duration}ms)`, result?.success !== undefined ? `success: ${result.success}` : '');
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        devLog(`[API ${method}] ✗ ERROR (${duration}ms):`, errMessage(error));
        throw error;
      }
    };
  };

  // `window.roku` is typed loosely in this file; the method indexing is
  // validated at runtime by the adapter-contract assertions in `main.ts` IPC
  // setup + the preload surface.
  const roku = window.roku as unknown as Record<string, (...a: unknown[]) => unknown>;
  const adapter: Record<string, unknown> = {
    isRemote: useRemote,
    ip,
    serverUrl: useRemote ? remoteBase : null
  };

  for (const spec of ADAPTER_METHOD_SPECS) {
    const localName = spec.localName ?? spec.name;
    const remoteName = spec.remoteName ?? `remote${capitalize(spec.name)}`;
    const impl = useRemote
      ? spec.prefix === 'ip'
        ? (...args: unknown[]) => roku[remoteName](remoteBase, ip, ...args)
        : (...args: unknown[]) => roku[remoteName](remoteBase, ...args)
      : spec.prefix === 'ip'
        ? (...args: unknown[]) => roku[localName](ip, ...args)
        : (...args: unknown[]) => roku[localName](...args);
    adapter[spec.name] = wrapApiCall(spec.name, impl);
  }

  // Cast to `any` to match the duck-typed `api` shape consumed by the various
  // `setup*` component functions (same looseness as before the refactor).
  return adapter as any;
}

// ============================================
// Remote Location Management
// ============================================

// Generate unique location ID (cryptographically secure random suffix via Web Crypto API)
function generateLocationId() {
  const bytes = new Uint8Array(9);
  window.crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes).map(b => (b % 36).toString(36)).join('');
  return 'loc-' + Date.now() + '-' + suffix;
}

// Load remote locations from localStorage
async function loadRemoteLocations() {
  try {
    // Use file-based storage via IPC (more reliable than localStorage in Electron)
    const result = await window.roku.getSetting('remote-locations');
    devLog('[Remote Locations] Loading from file storage:', result);
    
    if (result.success && result.value) {
      const locations = result.value;
      devLog('[Remote Locations] Parsed locations:', locations);
      locations.forEach(loc => {
        devLog('[Remote Locations] Adding location:', loc.name, loc.id);
        state.remoteLocations.set(loc.id, {
          ...loc,
          status: 'unknown',
          devices: new Map()
        });
      });
      devLog('[Remote Locations] Loaded', state.remoteLocations.size, 'locations');
    } else {
      devLog('[Remote Locations] No stored locations found');
    }
  } catch (e) {
    console.error('Failed to load remote locations:', e);
  }
}

// Save remote locations to file storage (more reliable than localStorage)
async function saveRemoteLocations() {
  try {
    const locations = Array.from(state.remoteLocations.values()).map(loc => ({
      id: loc.id,
      name: loc.name,
      host: loc.host,
      port: loc.port,
      serverUrl: loc.serverUrl
    }));
    devLog('[Remote Locations] Saving to file storage:', locations);
    const result = await window.roku.setSetting('remote-locations', locations);
    devLog('[Remote Locations] Save result:', result);
  } catch (e) {
    console.error('Failed to save remote locations:', e);
  }
}

// Add a new remote location
async function addRemoteLocation(name, host, port) {
  const serverUrl = `http://${host}:${port}`;
  const hostLower = host.toLowerCase();
  
  // Check for duplicate host/IP
  for (const [id, existingLocation] of state.remoteLocations) {
    if (existingLocation.host.toLowerCase() === hostLower) {
      throw new Error(`A location with host "${host}" already exists ("${existingLocation.name}").`);
    }
    if (existingLocation.serverUrl === serverUrl) {
      throw new Error(`A location with this server address already exists ("${existingLocation.name}").`);
    }
  }
  
  // First, verify the server is reachable before adding
  try {
    const healthResult = await window.roku.remoteHealth(serverUrl);
    
    if (!healthResult.success) {
      throw new Error('Unable to connect to relay server. Please check the address and ensure the server is running.');
    }
  } catch (e) {
    if (errMessage(e).includes('already exists')) {
      throw e; // Re-throw duplicate error
    }
    throw new Error('Unable to connect to relay server. Please check the address and ensure the server is running.');
  }
  
  // Server is reachable, now add the location
  const id = generateLocationId();
  
  const location = {
    id,
    name,
    host,
    port,
    serverUrl,
    status: 'online',
    devices: new Map()
  };
  
  state.remoteLocations.set(id, location);
  saveRemoteLocations();
  renderRemoteLocations();
  
  // Discover devices at this location
  await refreshRemoteLocation(id);
  
  return location;
}

// Remove a remote location
function removeRemoteLocation(locationId) {
  const location = state.remoteLocations.get(locationId);
  if (!location) return;
  
  // Disconnect any connected devices from this location
  location.devices.forEach((device, deviceId) => {
    const deviceKey = `${locationId}:${device.ip}`;
    if (state.connectedDevices.has(deviceKey)) {
      disconnectDevice(deviceKey);
    }
  });
  
  state.remoteLocations.delete(locationId);
  saveRemoteLocations();
  renderRemoteLocations();
}

// Refresh a remote location (health check + capabilities + device discovery)
async function refreshRemoteLocation(locationId) {
  const location = state.remoteLocations.get(locationId);
  if (!location) return;
  
  if (state.scanningLocations.has(locationId)) return;
  state.scanningLocations.add(locationId);
  
  location.status = 'connecting';
  renderRemoteLocations();
  
  try {
    // Health check
    const healthResult = await window.roku.remoteHealth(location.serverUrl);
    
    if (!healthResult.success) {
      location.status = 'offline';
      location.devices.clear();
      location.capabilities = null;
      state.scanningLocations.delete(locationId); // Delete BEFORE render
      renderRemoteLocations();
      return;
    }
    
    location.status = 'online';
    
    // Fetch server capabilities
    try {
      const capResult = await window.roku.remoteCapabilities(location.serverUrl);
      if (capResult.success && capResult.capabilities) {
        location.capabilities = capResult.capabilities;
        location.serverVersion = capResult.version;
        devLog(`[Remote ${location.name}] Capabilities:`, location.capabilities);
      } else {
        // Server doesn't support capabilities endpoint - assume all features available
        location.capabilities = getDefaultCapabilities();
        devLog(`[Remote ${location.name}] Using default capabilities (server doesn't support /capabilities)`);
      }
    } catch (capError) {
      // Older server without capabilities endpoint - assume all features available
      location.capabilities = getDefaultCapabilities();
      devLog(`[Remote ${location.name}] Capabilities fetch failed, using defaults:`, errMessage(capError));
    }
    
    // Discover devices
    const discoveryStartTime = Date.now();
    devLog(`[Remote ${location.name}] Starting device discovery on ${location.serverUrl}`);
    try {
      const discoverResult = await window.roku.remoteDiscover(location.serverUrl);
      const discoveryDuration = Date.now() - discoveryStartTime;
      devLog(`[Remote ${location.name}] Discovery completed (${discoveryDuration}ms):`, {
        success: discoverResult.success,
        deviceCount: discoverResult.devices?.length || 0,
        error: discoverResult.error
      });
    
      if (discoverResult.success && discoverResult.devices && Array.isArray(discoverResult.devices)) {
      devLog(`[Remote ${location.name}] Found ${discoverResult.devices.length} device(s)`);
      // Update existing devices or add new ones (deduplicate by serial number)
      discoverResult.devices.forEach(device => {
        // Ensure device has required properties
        if (!device || !device.ip) {
          devLog(`[Remote ${location.name}] Skipping invalid device:`, device);
          return;
        }
        
        // Add location info to device
        device.locationId = locationId;
        device.locationName = location.name;
        device.serverUrl = location.serverUrl;
        device.isRemote = true;
        device.capabilities = location.capabilities; // Pass capabilities to device
        
        const deviceId = getDeviceId(device);
        const existingDevice = location.devices.get(deviceId);
        
        if (existingDevice) {
          // Device already exists - update IP if it changed
          if (existingDevice.ip !== device.ip) {
            devLog(`[Remote ${location.name}] Device ${deviceId} IP changed from ${existingDevice.ip} to ${device.ip}`);
            existingDevice.ip = device.ip;
          }
          // Update any other fields that might have changed, but preserve remote-specific properties
          const preservedProps = {
            serverUrl: existingDevice.serverUrl || device.serverUrl,
            locationId: existingDevice.locationId || device.locationId,
            locationName: existingDevice.locationName || device.locationName,
            isRemote: existingDevice.isRemote !== undefined ? existingDevice.isRemote : device.isRemote,
            capabilities: existingDevice.capabilities || device.capabilities
          };
          Object.assign(existingDevice, device, preservedProps);
        } else {
          // New device - add it
          devLog(`[Remote ${location.name}] Adding new device: ${device.deviceName} (${device.ip}), ID: ${deviceId}, serverUrl: ${device.serverUrl}`);
          location.devices.set(deviceId, device);
        }
      });
      
      // Remove devices that are no longer found (but keep connected ones)
      const foundDeviceIds = new Set(discoverResult.devices.map(d => {
        if (!d || !d.ip) return null;
        return getDeviceId(d);
      }).filter(Boolean));
      
      location.devices.forEach((device, deviceId) => {
        // Check if this device is connected by looking up its IP in connectedDevices
        if (device && device.ip) {
          const deviceKey = `${locationId}:${device.ip}`;
          if (!foundDeviceIds.has(deviceId) && !state.connectedDevices.has(deviceKey)) {
            location.devices.delete(deviceId);
          }
        }
      });
      } else if (discoverResult.success && (!discoverResult.devices || discoverResult.devices.length === 0)) {
        // Discovery succeeded but no devices found - clear non-connected devices
        devLog(`[Remote ${location.name}] Discovery succeeded but no devices found`);
        location.devices.forEach((device, deviceId) => {
          if (device && device.ip) {
            const deviceKey = `${locationId}:${device.ip}`;
            if (!state.connectedDevices.has(deviceKey)) {
              location.devices.delete(deviceId);
            }
          }
        });
      } else {
        devLog(`[Remote ${location.name}] Discovery failed:`, discoverResult.error || 'Unknown error');
      }
    } catch (error) {
      const discoveryDuration = Date.now() - discoveryStartTime;
      devLog(`[Remote ${location.name}] Discovery ERROR (${discoveryDuration}ms):`, errMessage(error));
      console.error('[Remote %s] Discovery error: %s', location.name, error);
    }
    
    state.scanningLocations.delete(locationId); // Delete BEFORE render so UI shows "complete"
    renderRemoteLocations();
  } catch (e) {
    console.error('Failed to refresh remote location:', e);
    location.status = 'offline';
    location.capabilities = null;
    state.scanningLocations.delete(locationId); // Delete BEFORE render
    renderRemoteLocations();
    return;
  }
}

// Default capabilities for servers that don't support the /capabilities endpoint
function getDefaultCapabilities() {
  return {
    remote: true,
    apps: true,
    query: true,
    devApp: true,
    screenshot: true,
    console: true,
    appConnector: true,
    deepLink: true,
  };
}

// Refresh all remote locations
async function refreshAllRemoteLocations(opts?: { notifyStartup?: boolean }) {
  const notifyStartup = opts?.notifyStartup !== false;
  const promises = Array.from(state.remoteLocations.keys()).map(id => refreshRemoteLocation(id));
  await Promise.all(promises);
  if (notifyStartup) {
    startupRemoteScanComplete = true;
    void onStartupScansReady();
  }
}

// Render remote locations in sidebar
function renderRemoteLocations() {
  const container = document.getElementById('remoteLocationsContainer');
  
  if (!container) return;
  
  // Clear existing content
  container.innerHTML = '';
  
  state.remoteLocations.forEach((location, locationId) => {
    const section = createRemoteLocationSection(location);
    container.appendChild(section);
  });

  // Keep any open BrightScript Fiddle windows in sync with remote-location
  // device changes (new device discovered, location removed, etc.).
  try {
    const w = window as unknown as { __rdsFiddlePushDevices?: () => void };
    if (typeof w.__rdsFiddlePushDevices === 'function') w.__rdsFiddlePushDevices();
  } catch {
    /* ignore */
  }
}

// Create a collapsible remote location section with devices
function createRemoteLocationSection(location) {
  const isScanning = state.scanningLocations.has(location.id);
  const statusClass = location.status === 'online' ? 'online' : 
                      location.status === 'offline' ? 'offline' : '';
  
  // Check if this location was previously collapsed
  const isCollapsed = state.collapsedLocations && state.collapsedLocations.has(location.id);
  
  const section = document.createElement('div');
  section.className = `location-section remote ${statusClass} ${isCollapsed ? 'collapsed' : ''}`;
  section.dataset.locationId = location.id;
  
  // Count connected devices in this location
  let connectedCount = 0;
  location.devices.forEach((device, deviceId) => {
    const deviceKey = `${location.id}:${device.ip}`;
    if (state.connectedDevices.has(deviceKey)) connectedCount++;
  });
  
  const statusText = isScanning ? 'Scanning...' : 
    location.status === 'online' ? '' : 
    location.status === 'offline' ? 'Offline' : 
    (location.status === 'connecting' || location.status === 'unknown') ? 'Connecting...' : '';
  
  setSafeHTML(section, `
    <div class="location-header">
      <div class="location-header-top">
        <span class="location-status"></span>
        <span class="location-name">${escapeHtml(location.name)}</span>
        <button class="location-action-btn icon-btn info-location" title="Server Info" style="${location.status === 'online' ? '' : 'display:none'}">${icon('info', 'icon-sm')}</button>
        <button class="location-action-btn icon-btn primary refresh-location${isScanning ? ' scanning' : ''}" title="${isScanning ? 'Scanning...' : 'Refresh'}">${icon('refresh', 'icon-sm')}</button>
        <button class="location-action-btn icon-btn danger delete-location" title="Remove">${icon('trash', 'icon-sm')}</button>
        <span class="location-toggle">${icon('chevron-down', 'icon-sm')}</span>
      </div>
      <div class="location-header-bottom">
        <span class="location-device-count">${location.devices.size} device${location.devices.size !== 1 ? 's' : ''}</span>
        <span class="location-server-url">${escapeHtml(location.host)}:${location.port}</span>
      </div>
    </div>
    <div class="location-body">
      <div class="location-devices">
        ${location.devices.size === 0 ? 
          `<div class="location-empty${isScanning || location.status === 'connecting' || location.status === 'unknown' ? ' scanning' : ''}">
            <div class="empty-icon">${icon(isScanning || location.status === 'connecting' || location.status === 'unknown' ? 'loader' : 'radar', 'icon-xl')}</div>
            <p>${isScanning ? 'Scanning for devices...' : 
                 (location.status === 'connecting' || location.status === 'unknown') ? 'Connecting to relay server...' :
                 location.status === 'offline' ? 'Server offline' : 
                 'No Roku devices found'}</p>
          </div>` : ''}
      </div>
    </div>
  `);
  
  // Add devices to the list (sorted: DEV-enabled first, then alphabetically by name)
  const devicesList = section.querySelector('.location-devices');
  if (location.devices.size > 0 && devicesList) {
    // Clear the empty state
    devicesList.innerHTML = '';
    
    // Convert to array and sort: DEV-enabled first, then by device name
    const sortedDevices = Array.from(location.devices.values()).sort((a: any, b: any) => {
      // DEV-enabled devices come first
      if (a.developerEnabled && !b.developerEnabled) return -1;
      if (!a.developerEnabled && b.developerEnabled) return 1;
      // Then sort alphabetically by device name
      const nameA = (a.deviceName || a.modelName || 'Unknown').toLowerCase();
      const nameB = (b.deviceName || b.modelName || 'Unknown').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    sortedDevices.forEach(device => {
      const deviceCard = createRemoteDeviceCard(device, location.id);
      devicesList.appendChild(deviceCard);
    });
  }
  
  // Toggle collapse on header click
  const header = section.querySelector('.location-header');
  header?.addEventListener('click', (e) => {
    // Don't toggle if clicking action buttons
    const t = e.target;
    if (t instanceof Element && t.closest('.location-actions')) return;
    
    section.classList.toggle('collapsed');
    
    // Remember collapsed state
    if (!state.collapsedLocations) state.collapsedLocations = new Set();
    if (section.classList.contains('collapsed')) {
      state.collapsedLocations.add(location.id);
    } else {
      state.collapsedLocations.delete(location.id);
    }
  });
  
  // Event handlers for action buttons
  const infoBtn = section.querySelector('.info-location');
  if (infoBtn) {
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const opener = infoBtn instanceof HTMLElement ? infoBtn : null;
      showServerCapabilities(location, opener);
    });
  }
  
  section.querySelector('.refresh-location')?.addEventListener('click', (e) => {
    e.stopPropagation();
    refreshRemoteLocation(location.id);
  });
  
  section.querySelector('.delete-location')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Remove location "${location.name}"?`)) {
      removeRemoteLocation(location.id);
    }
  });
  
  return section;
}

// Show server capabilities in a modal/popup
function showServerCapabilities(location, opener?: HTMLElement | null) {
  const caps = location.capabilities || {};
  const version = location.serverVersion || 'Unknown';
  
  const capabilityLabels = {
    remote: { label: 'Remote Control', desc: 'Keypress and navigation commands' },
    apps: { label: 'Apps', desc: 'List and launch installed apps' },
    query: { label: 'Query', desc: 'Device info, media player status' },
    devApp: { label: 'Dev App', desc: 'Sideload development channels' },
    screenshot: { label: 'Screenshot', desc: 'Capture device screen' },
    console: { label: 'Console', desc: 'BrightScript debug output' },
    appConnector: { label: 'App Connector', desc: 'RALE TrackerTask integration' },
    deepLink: { label: 'Deep Link', desc: 'Launch content with parameters' }
  };
  
  let capList = '';
  for (const [key, info] of Object.entries(capabilityLabels)) {
    const enabled = caps[key] === true;
    const statusClass = enabled ? 'supported' : 'not-supported';
    const statusText = enabled ? 'Supported' : 'Not Supported';
    capList += `<div class="capability-item ${statusClass}">
      <span class="cap-indicator"></span>
      <div class="cap-info">
        <span class="cap-label">${info.label}</span>
        <span class="cap-desc">${info.desc}</span>
      </div>
      <span class="cap-status-text">${statusText}</span>
    </div>`;
  }
  
  const modalContent = `
    <div class="server-info-modal">
      <div class="server-info-header">
        <h3>${icon('server', 'icon-md')} ${escapeHtml(location.name)}</h3>
        <button class="modal-close close-modal-btn" title="Close">${icon('x', 'icon-sm')}</button>
      </div>
      <div class="server-info-url">
        <span class="server-url-value location-server-url">${escapeHtml(location.host)}:${location.port}</span>
        <span class="server-version">v${escapeHtml(version)}</span>
      </div>
      <div class="server-capabilities">
        <h4>Capabilities</h4>
        <div class="capabilities-list">
          ${capList}
        </div>
      </div>
    </div>
  `;
  
  // Create and show modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay server-info-overlay';
  setSafeHTML(modal, modalContent);
  prepareModalOpenOrigin(modal, opener ?? null);
  document.body.appendChild(modal);
  modal.classList.add('modal-motion-enabled');
  playModalOpenMotion(modal);

  const removeServerModal = () => {
    document.removeEventListener('keydown', escHandler);
    modal.remove();
  };
  const requestClose = () => {
    if (!modal.isConnected) return;
    closeModalWithOriginMotion(modal, removeServerModal);
  };

  modal.querySelector('.close-modal-btn')?.addEventListener('click', requestClose);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) requestClose();
  });

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && modal.isConnected) requestClose();
  };
  document.addEventListener('keydown', escHandler);
}

// Compatibility alias (historical name)
function createRemoteLocationCard(location) {
  return createRemoteLocationSection(location);
}

// Create a device card for remote device (matching local device card format)
function createRemoteDeviceCard(device, locationId) {
  const deviceKey = `${locationId}:${device.ip}`;
  const isConnected = state.connectedDevices.has(deviceKey);
  const connection = state.connectedDevices.get(deviceKey);
  const isActive = connection && state.activeTabId === connection.tabId;
  const isDeveloperEnabled = device.developerEnabled === true;
  const isTv = device.isTv === true;
  
  // Determine minimized state: stored preference, or default (non-dev = minimized)
  const storedMinimized = isDeviceMinimized(deviceKey);
  const isMinimized = storedMinimized !== null ? storedMinimized : !isDeveloperEnabled;
  
  const card = document.createElement('div');
  card.className = `device-card${isConnected ? ' connected' : ''}${isActive ? ' active' : ''}${!isDeveloperEnabled ? ' not-dev-enabled' : ''}${isMinimized ? ' minimized' : ''}`;
  card.dataset.deviceKey = deviceKey;
  card.dataset.ip = device.ip;
  card.dataset.locationId = locationId;
  
  const softwareBuild = device.softwareBuild ? ` (${device.softwareBuild})` : '';
  const devBadge = isDeveloperEnabled 
    ? `<span class="dev-badge enabled">${icon('wrench', 'icon-xs')} Dev</span>`
    : '';
  const ecpMode = getEcpMode(device);
  const ecpBadge = ecpMode === 'Disabled'
    ? `<span class="ecp-badge" title="Control by Mobile Apps is disabled">${icon('tv', 'icon-xs')} Remote off</span>`
    : ecpMode === 'Limited'
      ? `<span class="ecp-badge ecp-badge-limited" title="ECP Limited: text, app launch, and query work; full keypress may not">${icon('tv', 'icon-xs')} ECP Limited</span>`
      : '';
  const deviceType = isTv ? `${icon('tv', 'icon-sm')} TV` : `${icon('stb', 'icon-sm')} STB`;
  
  setSafeHTML(card, `
    <div class="device-card-header">
      <div class="device-card-header-left">
        <div class="device-card-thumb"></div>
        <div class="device-card-title-col">
          <div class="device-name">
            ${isConnected ? '<span class="status-dot"></span>' : ''}
            ${escapeHtml(device.deviceName || device.modelName || 'Unknown Roku')}
          </div>
        </div>
      </div>
      <div class="device-card-header-right">
        ${ecpBadge}
        ${devBadge}
        <button class="device-toggle-btn" title="${isMinimized ? 'Expand' : 'Minimize'}">
          ${icon('chevron-down', 'icon-sm')}
        </button>
      </div>
    </div>
    <div class="device-card-compact">
      <span class="compact-ip device-ip">${escapeHtml(device.ip)}</span>
      <span class="compact-separator">•</span>
      <span class="compact-model">${escapeHtml(device.modelName || device.modelNumber || 'Roku')}</span>
    </div>
    <div class="device-details">
      <div class="device-detail">
        <span class="label">Type</span>
        <span class="value">${deviceType}</span>
      </div>
      <div class="device-detail">
        <span class="label">IP</span>
        <span class="value device-ip">${escapeHtml(device.ip)}</span>
      </div>
      <div class="device-detail">
        <span class="label">Model</span>
        <span class="value">${escapeHtml(device.modelNumber || 'N/A')}</span>
      </div>
      <div class="device-detail">
        <span class="label">Serial</span>
        <span class="value device-serial">${escapeHtml(device.serialNumber || 'N/A')}</span>
      </div>
      ${device.softwareVersion ? `
      <div class="device-detail">
        <span class="label">SW</span>
        <span class="value">${escapeHtml(device.softwareVersion)}${escapeHtml(softwareBuild)}</span>
      </div>
      ` : ''}
    </div>
    <div class="device-actions">
      <button class="connect-btn${isConnected ? ' connected' : ''}">
        ${isConnected ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  `);

  setDeviceCardThumbnail(card.querySelector('.device-card-thumb'), device, {
    isRemote: true,
    serverUrl: device.serverUrl || null
  });
  
  // Toggle minimize/expand
  const toggleBtn = card.querySelector('.device-toggle-btn');
  const connectBtn = card.querySelector('.connect-btn');
  if (!(toggleBtn instanceof HTMLElement) || !(connectBtn instanceof HTMLElement)) {
    return card;
  }
  const toggleMinimize = (e?: Event) => {
    if (e) e.stopPropagation();
    const nowMinimized = !card.classList.contains('minimized');
    card.classList.toggle('minimized');
    toggleBtn.title = nowMinimized ? 'Expand' : 'Minimize';
    setDeviceMinimized(deviceKey, nowMinimized);
  };
  toggleBtn.addEventListener('click', toggleMinimize);
  
  // Connect/Disconnect button handler
  connectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isConnected) {
      disconnectDevice(deviceKey);
    } else {
      connectRemoteDevice(device, locationId);
    }
  });
  
  // Click card: expand if minimized, or activate tab if connected
  card.addEventListener('click', (e) => {
    if (card.classList.contains('minimized')) {
      toggleMinimize(e);
    } else if (isConnected && connection) {
      activateTab(connection.tabId);
    }
  });
  
  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showDeviceContextMenu(device);
  });
  
  return card;
}

// Connect to a remote device
function connectRemoteDevice(device, locationId) {
  const deviceKey = `${locationId}:${device.ip}`;
  
  // Ensure device has serverUrl (get from location if missing)
  if (!device.serverUrl) {
    const location = state.remoteLocations.get(locationId);
    if (location) {
      device.serverUrl = location.serverUrl;
    } else {
      console.error('Cannot connect to remote device: location not found', locationId);
      return;
    }
  }
  
  if (state.connectedDevices.has(deviceKey)) {
    // Already connected, just activate the tab
    const connection = state.connectedDevices.get(deviceKey);
    activateTab(connection.tabId);
    return;
  }
  
  const tabId = `tab-remote-${locationId}-${device.ip.replace(/\./g, '-')}`;
  
  // Create tab
  const tab = createTab(device, tabId);
  // Add location indicator to tab
  const tabName = tab.querySelector('.tab-name');
  if (tabName instanceof HTMLElement) {
    const location = state.remoteLocations.get(locationId);
    setSafeHTML(tabName, icon('globe', 'icon-sm', 'icon-cyan') + ' ' + escapeHtml(device.deviceName));
    tabName.title = `${device.deviceName} @ ${location?.name || 'Remote'}`;
  }
  elements.tabBar.insertBefore(tab, elements.tabBar.querySelector('.tab-placeholder'));
  
  // Create tab panel using the unified createDevicePanel with remote flag
  const panel = createDevicePanel(device, tabId, true, device.serverUrl, locationId);
  elements.tabContentArea.appendChild(panel);
  
  // Store connection with location info
  state.connectedDevices.set(deviceKey, { 
    device, 
    tabId, 
    locationId,
    isRemote: true,
    serverUrl: device.serverUrl
  });
  
  // Also add the tab dataset for disconnect
  tab.dataset.deviceKey = deviceKey;
  tab.dataset.ip = device.ip;
  
  // Activate the new tab
  activateTab(tabId);
  
  // Update remote locations list
  renderRemoteLocations();

  pushDeviceListToMcpBridge();

  if (AUTO_CONNECT_LAST_DEVICE_ENABLED) {
    void addRememberedDeviceToListIfEnabled(device, 'remote', locationId);
  }
}

// Note: createRemoteDevicePanel and setupXxxForRemote helpers have been removed.
// Remote devices now use the unified createDevicePanel with the API adapter pattern.
// See createApiAdapter() and the isRemote parameter of createDevicePanel().

// Removed ~1500 lines of duplicate code that handled remote devices separately.
// The unified approach uses createApiAdapter() to abstract local vs remote API calls,
// allowing all setup functions (setupRemoteControls, setupApps, etc.) to work for both
// local and remote devices with a single implementation.

// ============================================
// DOM Elements (initialized after DOM ready)
// ============================================

interface AppDomElements {
  scanBtn: HTMLElement | null;
  titlebarScanBtn: HTMLButtonElement | null;
  deviceList: HTMLElement | null;
  emptyState: HTMLElement | null;
  manualIp: HTMLInputElement | null;
  manualConnectBtn: HTMLButtonElement | null;
  tabBar: HTMLElement;
  tabContentArea: HTMLElement;
  welcomePanel: HTMLElement;
  devicePanelTemplate: HTMLTemplateElement;
  addLocationBtn: HTMLElement | null;
  addLocationModal: HTMLElement | null;
  locationName: HTMLInputElement | null;
  locationHost: HTMLInputElement | null;
  locationPort: HTMLInputElement | null;
  cancelAddLocation: HTMLButtonElement | null;
  confirmAddLocation: HTMLButtonElement | null;
  remoteLocationsContainer: HTMLElement | null;
  localDevicesSection: HTMLElement | null;
  localDevicesHeader: HTMLElement | null;
  localDevicesBody: HTMLElement | null;
}

let elements = {} as AppDomElements;

// Note: setupXxxForRemote helpers have been removed.
// Remote devices now use the unified createDevicePanel with the API adapter pattern.


// ============================================
// Device Discovery
// ============================================

// Get unique device ID from serial number (or fallback to IP if serial is missing)
function getDeviceId(device) {
  // Use serial number as primary identifier, fallback to IP if serial is missing
  if (device.serialNumber && device.serialNumber.trim()) {
    return device.serialNumber.trim();
  }
  // Fallback to IP if no serial number (shouldn't happen with real Roku devices)
  return device.ip;
}

function parseAutoConnectDeviceEntry(raw: unknown): AutoConnectDeviceEntry | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (o.kind !== 'local' && o.kind !== 'remote') return null;
  if (typeof o.ip !== 'string' || o.ip.trim() === '') return null;
  if (o.kind === 'remote') {
    if (typeof o.locationId !== 'string' || o.locationId.trim() === '') return null;
  }
  const serial =
    typeof o.serialNumber === 'string' && o.serialNumber.trim() !== '' ? o.serialNumber.trim() : undefined;
  const serverUrl =
    typeof o.serverUrl === 'string' && o.serverUrl.trim() !== '' ? o.serverUrl.trim() : undefined;
  const locationId =
    typeof o.locationId === 'string' && o.locationId.trim() !== '' ? o.locationId.trim() : undefined;
  return {
    v: 1,
    kind: o.kind,
    ip: o.ip.trim(),
    ...(serial ? { serialNumber: serial } : {}),
    ...(locationId ? { locationId } : {}),
    ...(serverUrl ? { serverUrl } : {})
  };
}

function parseRememberedDeviceList(raw: unknown): AutoConnectDeviceEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: AutoConnectDeviceEntry[] = [];
  for (const item of raw) {
    const e = parseAutoConnectDeviceEntry(item);
    if (e) out.push(e);
  }
  return out;
}

function autoConnectEntryKey(e: AutoConnectDeviceEntry): string {
  if (e.kind === 'local') {
    const id = (e.serialNumber && e.serialNumber.trim()) || e.ip;
    return `local:${id}`;
  }
  return `remote:${e.locationId}:${e.ip}`;
}

function buildAutoConnectEntry(
  device: { ip: string; serialNumber?: string; serverUrl?: string },
  kind: 'local' | 'remote',
  locationId: string | null
): AutoConnectDeviceEntry {
  const serial =
    typeof device.serialNumber === 'string' && device.serialNumber.trim() !== ''
      ? device.serialNumber.trim()
      : undefined;
  if (kind === 'local') {
    return { v: 1, kind: 'local', ip: device.ip, ...(serial ? { serialNumber: serial } : {}) };
  }
  return {
    v: 1,
    kind: 'remote',
    ip: device.ip,
    ...(serial ? { serialNumber: serial } : {}),
    ...(locationId ? { locationId } : {}),
    ...(device.serverUrl ? { serverUrl: String(device.serverUrl) } : {})
  };
}

function autoConnectEntryKeyFromConnection(conn: {
  device: { ip: string; serialNumber?: string };
  isRemote?: boolean;
  locationId?: string;
}): string {
  if (conn.isRemote === true && conn.locationId) {
    return autoConnectEntryKey(buildAutoConnectEntry(conn.device, 'remote', conn.locationId));
  }
  return autoConnectEntryKey(buildAutoConnectEntry(conn.device, 'local', null));
}

async function addRememberedDeviceToListIfEnabled(
  device: { ip: string; serialNumber?: string; serverUrl?: string },
  kind: 'local' | 'remote',
  locationId: string | null
) {
  if (!AUTO_CONNECT_LAST_DEVICE_ENABLED || !window.roku?.getSetting || !window.roku?.setSetting) return;
  const entry = buildAutoConnectEntry(device, kind, locationId);
  const key = autoConnectEntryKey(entry);
  try {
    const res = await window.roku.getSetting(AUTO_CONNECT_DEVICE_LIST_KEY);
    const list = parseRememberedDeviceList(res?.value);
    if (list.some((x) => autoConnectEntryKey(x) === key)) return;
    list.push(entry);
    await window.roku.setSetting(AUTO_CONNECT_DEVICE_LIST_KEY, list);
    cachedRememberedDeviceList = list;
  } catch (e) {
    console.error('[Auto-connect] Failed to update remembered device list:', e);
  }
}

async function removeRememberedDeviceFromListIfEnabled(conn: {
  device: { ip: string; serialNumber?: string };
  isRemote?: boolean;
  locationId?: string;
}) {
  if (!AUTO_CONNECT_LAST_DEVICE_ENABLED || !window.roku?.getSetting || !window.roku?.setSetting) return;
  const removeKey = autoConnectEntryKeyFromConnection(conn);
  try {
    const res = await window.roku.getSetting(AUTO_CONNECT_DEVICE_LIST_KEY);
    const list = parseRememberedDeviceList(res?.value).filter((x) => autoConnectEntryKey(x) !== removeKey);
    await window.roku.setSetting(AUTO_CONNECT_DEVICE_LIST_KEY, list);
    cachedRememberedDeviceList = list;
  } catch (e) {
    console.error('[Auto-connect] Failed to remove from remembered device list:', e);
  }
}

function findLocalDeviceMatchingProfile(snap: AutoConnectDeviceEntry) {
  const serial = snap.serialNumber?.trim();
  if (serial) {
    for (const d of state.devices.values()) {
      if (d.serialNumber && String(d.serialNumber).trim() === serial) return d;
    }
  }
  for (const d of state.devices.values()) {
    if (d.ip === snap.ip) return d;
  }
  return null;
}

function findRemoteDeviceMatchingProfile(snap: AutoConnectDeviceEntry) {
  if (snap.kind !== 'remote' || !snap.locationId) return null;
  const loc = state.remoteLocations.get(snap.locationId);
  if (!loc || loc.status !== 'online') return null;
  const serial = snap.serialNumber?.trim();
  if (serial) {
    for (const d of loc.devices.values()) {
      if (d.serialNumber && String(d.serialNumber).trim() === serial) return { device: d, locationId: snap.locationId };
    }
  }
  for (const d of loc.devices.values()) {
    if (d.ip === snap.ip) return { device: d, locationId: snap.locationId };
  }
  return null;
}

function connectRememberedListMatches(list: AutoConnectDeviceEntry[]): { count: number; singleLabel: string } {
  let count = 0;
  let singleLabel = '';
  for (const entry of list) {
    if (entry.kind === 'local') {
      const device = findLocalDeviceMatchingProfile(entry);
      if (device && !state.connectedDevices.has(device.ip)) {
        const label = device.deviceName || device.modelName || device.ip;
        connectDevice(device);
        count++;
        singleLabel = label;
      }
    } else {
      const found = findRemoteDeviceMatchingProfile(entry);
      if (!found) continue;
      const { device, locationId } = found;
      const deviceKey = `${locationId}:${device.ip}`;
      if (state.connectedDevices.has(deviceKey)) continue;
      connectRemoteDevice(device, locationId);
      count++;
      singleLabel = device.deviceName || device.modelName || device.ip;
    }
  }
  return { count, singleLabel };
}

async function maybeAutoConnectLastDevice() {
  if (!AUTO_CONNECT_LAST_DEVICE_ENABLED) return;
  if (autoConnectLastDeviceAttempted) return;
  if (state.connectedDevices.size > 0) {
    autoConnectLastDeviceAttempted = true;
    return;
  }
  if (!startupLocalScanComplete) return;

  if (cachedRememberedDeviceList === undefined) {
    try {
      const res = await window.roku.getSetting(AUTO_CONNECT_DEVICE_LIST_KEY);
      cachedRememberedDeviceList = parseRememberedDeviceList(res?.value);
    } catch {
      cachedRememberedDeviceList = [];
    }
  }

  const list = cachedRememberedDeviceList ?? [];
  if (list.some((e) => e.kind === 'remote') && !startupRemoteScanComplete) return;

  autoConnectLastDeviceAttempted = true;

  if (list.length === 0) return;

  const { count, singleLabel } = connectRememberedListMatches(list);

  if (count === 1) {
    showToast(`Connected to ${singleLabel} automatically.`, 'success');
  } else if (count > 1) {
    showToast(`Connected to ${count} saved devices automatically.`, 'success');
  }
}

async function tryAutoConnectRememberedMatchesAfterUserScan() {
  if (!AUTO_CONNECT_LAST_DEVICE_ENABLED) return;
  if (cachedRememberedDeviceList === undefined) {
    try {
      const res = await window.roku.getSetting(AUTO_CONNECT_DEVICE_LIST_KEY);
      cachedRememberedDeviceList = parseRememberedDeviceList(res?.value);
    } catch {
      cachedRememberedDeviceList = [];
    }
  }
  const list = cachedRememberedDeviceList ?? [];
  if (list.length === 0) return;
  const { count, singleLabel } = connectRememberedListMatches(list);
  if (count === 1) {
    showToast(`Connected to ${singleLabel} automatically.`, 'success');
  } else if (count > 1) {
    showToast(`Connected to ${count} saved devices automatically.`, 'success');
  }
}

function setScanButtonsScanningNetworkLabel(): void {
  if (elements.scanBtn) {
    const scanText = elements.scanBtn.querySelector('.scan-text');
    if (scanText) scanText.textContent = 'Scanning Network...';
  }
  const titleText = elements.titlebarScanBtn?.querySelector('.titlebar-scan-text');
  if (titleText) titleText.textContent = 'Scanning Network...';
}

/** SSDP + optional subnet fallback; clears non-connected locals first; always removes onDeviceFound listener. */
async function executeLocalDiscoveryScan(): Promise<void> {
  state.devices.forEach((device, deviceId) => {
    if (!state.connectedDevices.has(device.ip)) {
      state.devices.delete(deviceId);
    }
  });

  const cleanup = window.roku.onDeviceFound((device) => {
    devLog('onDeviceFound callback:', device.ip);
    addDiscoveredDevice(device);
  });

  try {
    devLog('Calling window.roku.discover()...');
    const result = await window.roku.discover();
    devLog('Discovery result:', result.success, 'devices:', result.devices?.length);

    if (result.success && result.devices.length > 0) {
      result.devices.forEach(device => addDiscoveredDevice(device));
    }
  } catch (error) {
    console.error('Discovery error:', error);
  }

  if (state.devices.size === 0) {
    devLog('SSDP found no devices, trying subnet scan...');
    try {
      setScanButtonsScanningNetworkLabel();
      const subnetResult = await window.roku.scanSubnet();
      devLog('Subnet scan result:', subnetResult.success, 'devices:', subnetResult.devices?.length);

      if (subnetResult.success && subnetResult.devices.length > 0) {
        subnetResult.devices.forEach(device => addDiscoveredDevice(device));
      }
    } catch (error) {
      console.error('Subnet scan error:', error);
    }
  }
  cleanup();
}

// Startup / IPC path: local discovery only (remote refresh is scheduled separately).
async function startScan() {
  devLog('startScan called, isScanning:', state.isScanning);
  if (state.isScanning) return;

  state.isScanning = true;
  try {
    updateScanButton(true);
  } catch (err) {
    console.error('Error updating scan button:', err);
  }

  try {
    await executeLocalDiscoveryScan();
  } catch (error) {
    console.error('Discovery error:', error);
  }

  state.isScanning = false;
  try {
    updateScanButton(false);
    renderDeviceList();
  } catch (err) {
    console.error('Error after scan:', err);
  }

  startupLocalScanComplete = true;
  void onStartupScansReady();
}

/** User-initiated scan: local network + all configured remote locations, then remembered-device auto-connect. */
async function runFullUserScan() {
  devLog('runFullUserScan called, isScanning:', state.isScanning);
  if (state.isScanning) return;

  state.isScanning = true;
  try {
    updateScanButton(true);
  } catch (err) {
    console.error('Error updating scan button:', err);
  }

  try {
    const localPromise = executeLocalDiscoveryScan();
    const remotePromise =
      state.remoteLocations.size > 0
        ? refreshAllRemoteLocations({ notifyStartup: false })
        : Promise.resolve();
    await Promise.all([localPromise, remotePromise]);
  } catch (error) {
    console.error('Full scan error:', error);
  }

  state.isScanning = false;
  try {
    updateScanButton(false);
    renderDeviceList();
  } catch (err) {
    console.error('Error after full scan:', err);
  }

  await tryAutoConnectRememberedMatchesAfterUserScan();
}

/**
 * User-initiated scan scoped to the Local Devices section only — does NOT
 * touch remote locations. Each remote location card has its own per-location
 * refresh button that calls `refreshRemoteLocation(id)`. The full local +
 * remote scan is invoked from the title-bar Scan button (visible when the
 * sidebar is hidden) via `runFullUserScan`.
 */
async function runLocalOnlyUserScan() {
  devLog('runLocalOnlyUserScan called, isScanning:', state.isScanning);
  if (state.isScanning) return;

  state.isScanning = true;
  try {
    updateScanButton(true);
  } catch (err) {
    console.error('Error updating scan button:', err);
  }

  try {
    await executeLocalDiscoveryScan();
  } catch (error) {
    console.error('Local scan error:', error);
  }

  state.isScanning = false;
  try {
    updateScanButton(false);
    renderDeviceList();
  } catch (err) {
    console.error('Error after local scan:', err);
  }

  await tryAutoConnectRememberedMatchesAfterUserScan();
}

// Add a discovered device to state
function addDiscoveredDevice(device) {
  const deviceId = getDeviceId(device);
  devLog('[Local Discovery] Device found:', {
    ip: device.ip,
    name: device.deviceName,
    serial: device.serialNumber,
    deviceId: deviceId,
    model: device.modelNumber
  });
  
  // Check if we already have this device (by serial number or same deviceId)
  const existingByKey = state.devices.get(deviceId);
  if (existingByKey) {
    // Device already exists - update IP address if it changed
    if (existingByKey.ip !== device.ip) {
      devLog('[Local Discovery] IP changed for device:', {
        deviceId: deviceId,
        oldIP: existingByKey.ip,
        newIP: device.ip
      });
      existingByKey.ip = device.ip;
      existingByKey.port = device.port;
      Object.assign(existingByKey, device);
    } else {
      Object.assign(existingByKey, device);
    }
    try {
      renderDeviceList();
    } catch (err) {
      console.error('Error rendering device list:', err);
    }
    return;
  }
  
  // Same physical device can appear under different keys: first time with ECP disabled
  // (no serial → keyed by IP, "Unknown Roku") and later with ECP enabled (serial → keyed by serial).
  // Deduplicate by IP so we keep a single entry and prefer the full-identity (serial) one.
  let existingKeyByIp = null;
  for (const [key, d] of state.devices) {
    if (d.ip === device.ip) {
      existingKeyByIp = key;
      break;
    }
  }
  if (existingKeyByIp !== null) {
    const existingByIp = state.devices.get(existingKeyByIp);
    devLog('[Local Discovery] Same IP as existing device (replacing placeholder):', {
      existingKey: existingKeyByIp,
      newKey: deviceId,
      existingName: existingByIp?.deviceName
    });
    state.devices.delete(existingKeyByIp);
    state.devices.set(deviceId, device);
    // If this device was connected, update the connection and refresh tab + panel to use the new device
    if (state.connectedDevices.has(device.ip)) {
      const connection = state.connectedDevices.get(device.ip);
      connection.device = device;
      // Update tab label
      const tabEl = document.querySelector(`.tab-item[data-tab-id="${connection.tabId}"]`);
      if (tabEl) {
        const nameEl = tabEl.querySelector('.tab-name');
        if (nameEl) nameEl.textContent = device.deviceName || device.modelName || 'Unknown Roku';
      }
      // Update panel: device name, IP, icon, and ECP/Dev Mode warnings
      const panel = document.getElementById(connection.tabId);
      if (panel) {
        const nameText = panel.querySelector('.panel-device-name-text');
        const ipEl = panel.querySelector('.device-ip');
        const iconEl = panel.querySelector('.device-panel-icon');
        if (nameText) nameText.textContent = device.deviceName || device.modelName || 'Unknown Roku';
        if (ipEl) ipEl.textContent = device.ip;
        if (iconEl) {
          setDevicePanelIcon(iconEl, device, { isRemote: false });
        }
        updateEcpWarnings(panel, device);
        updateDevModeWarnings(panel, device.developerEnabled === true);
      }
    }
    try {
      renderDeviceList();
    } catch (err) {
      console.error('Error rendering device list:', err);
    }
    return;
  }
  
  // New device - add it
  devLog('[Local Discovery] Adding new device:', deviceId);
  state.devices.set(deviceId, device);
  try {
    renderDeviceList();
  } catch (err) {
    console.error('Error rendering device list:', err);
  }
}

// Update scan button state (sidebar + title bar)
function updateScanButton(scanning) {
  if (elements.scanBtn) {
    elements.scanBtn.classList.toggle('scanning', scanning);
    const scanIcon = elements.scanBtn.querySelector('.scan-icon');
    const scanText = elements.scanBtn.querySelector('.scan-text');

    if (scanText) {
      scanText.textContent = scanning ? 'Scanning...' : 'Scan';
    }
    if (scanIcon instanceof HTMLElement) {
      setSafeHTML(scanIcon, scanning ? `<svg><use href="#icon-refresh"/></svg>` : `<svg><use href="#icon-radar"/></svg>`);
    }
  }

  const tb = elements.titlebarScanBtn;
  if (tb) {
    tb.classList.toggle('scanning', scanning);
    tb.disabled = scanning;
    tb.setAttribute('aria-busy', scanning ? 'true' : 'false');
    const tIcon = tb.querySelector('.titlebar-scan-icon');
    const tText = tb.querySelector('.titlebar-scan-text');
    if (tText) {
      tText.textContent = scanning ? 'Scanning...' : 'Scan';
    }
    if (tIcon instanceof HTMLElement) {
      setSafeHTML(tIcon, scanning ? `<svg><use href="#icon-refresh"/></svg>` : `<svg><use href="#icon-radar"/></svg>`);
    }
  }
}

// ============================================
// Device List Rendering
// ============================================

function renderDeviceList() {
  const devices = Array.from(state.devices.values());
  devLog('renderDeviceList called, devices:', devices.length);

  // Notify any open BrightScript Fiddle windows about the fresh device list.
  try {
    const w = window as unknown as { __rdsFiddlePushDevices?: () => void };
    if (typeof w.__rdsFiddlePushDevices === 'function') w.__rdsFiddlePushDevices();
  } catch {
    /* ignore */
  }
  
  // Update device count in header
  const deviceCountEl = document.getElementById('localDeviceCount');
  if (deviceCountEl) {
    deviceCountEl.textContent = `${devices.length} device${devices.length !== 1 ? 's' : ''}`;
  }
  
  const localDevicesList = document.getElementById('localDevicesList');
  const localEmptyState = document.getElementById('localEmptyState');
  
  if (!localDevicesList) {
    console.error('localDevicesList not found');
    return;
  }
  
  if (devices.length === 0) {
    if (localEmptyState) localEmptyState.style.display = 'flex';
    // Remove all device cards
    localDevicesList.querySelectorAll('.device-card').forEach(el => el.remove());
    return;
  }
  
  if (localEmptyState) localEmptyState.style.display = 'none';
  
  // Clear existing cards
  localDevicesList.querySelectorAll('.device-card').forEach(el => el.remove());
  
  // Sort devices: DEV-enabled first, then alphabetically by name
  const sortedDevices = devices.sort((a, b) => {
    // DEV-enabled devices come first
    if (a.developerEnabled && !b.developerEnabled) return -1;
    if (!a.developerEnabled && b.developerEnabled) return 1;
    // Then sort alphabetically by device name
    const nameA = (a.deviceName || a.modelName || 'Unknown').toLowerCase();
    const nameB = (b.deviceName || b.modelName || 'Unknown').toLowerCase();
    return nameA.localeCompare(nameB);
  });
  
  // Render each device
  sortedDevices.forEach(device => {
    devLog('Creating card for:', device.ip, device.deviceName);
    try {
      const card = createDeviceCard(device);
      localDevicesList.appendChild(card);
    } catch (err) {
      console.error('Error creating device card:', err);
    }
  });
}

// Get/set minimized state for device cards
function isDeviceMinimized(deviceIp) {
  try {
    const stored = localStorage.getItem('roku-minimized-devices');
    if (stored) {
      const minimized = JSON.parse(stored);
      return minimized[deviceIp] !== undefined ? minimized[deviceIp] : null;
    }
  } catch (e) {}
  return null;
}

function setDeviceMinimized(deviceIp, minimized) {
  try {
    const stored = localStorage.getItem('roku-minimized-devices') || '{}';
    const data = JSON.parse(stored);
    data[deviceIp] = minimized;
    localStorage.setItem('roku-minimized-devices', JSON.stringify(data));
  } catch (e) {}
}

function createDeviceCard(device) {
  const isConnected = state.connectedDevices.has(device.ip);
  const isDeveloperEnabled = device.developerEnabled === true;
  const isTv = device.isTv === true;
  
  // Check if this device is the currently active tab
  const connection = state.connectedDevices.get(device.ip);
  const isActive = connection && state.activeTabId === connection.tabId;
  
  // Determine minimized state: stored preference, or default (non-dev = minimized)
  const storedMinimized = isDeviceMinimized(device.ip);
  const isMinimized = storedMinimized !== null ? storedMinimized : !isDeveloperEnabled;
  
  const card = document.createElement('div');
  card.className = `device-card${isConnected ? ' connected' : ''}${isActive ? ' active' : ''}${!isDeveloperEnabled ? ' not-dev-enabled' : ''}${isMinimized ? ' minimized' : ''}`;
  card.dataset.ip = device.ip;
  
  const softwareBuild = device.softwareBuild ? ` (${device.softwareBuild})` : '';
  const devBadge = isDeveloperEnabled 
    ? `<span class="dev-badge enabled">${icon('wrench', 'icon-xs')} Dev</span>`
    : '';
  const ecpMode = getEcpMode(device);
  const ecpBadge = ecpMode === 'Disabled'
    ? `<span class="ecp-badge" title="Control by Mobile Apps is disabled">${icon('tv', 'icon-xs')} Remote off</span>`
    : ecpMode === 'Limited'
      ? `<span class="ecp-badge ecp-badge-limited" title="ECP Limited: text, app launch, and query work; full keypress may not">${icon('tv', 'icon-xs')} ECP Limited</span>`
      : '';
  const deviceType = isTv ? `${icon('tv', 'icon-sm')} TV` : `${icon('stb', 'icon-sm')} STB`;
  
  setSafeHTML(card, `
    <div class="device-card-header">
      <div class="device-card-header-left">
        <div class="device-card-thumb"></div>
        <div class="device-card-title-col">
          <div class="device-name">
            ${isConnected ? '<span class="status-dot"></span>' : ''}
            ${escapeHtml(device.deviceName || device.modelName || 'Unknown Roku')}
          </div>
        </div>
      </div>
      <div class="device-card-header-right">
        ${ecpBadge}
        ${devBadge}
        <button class="device-toggle-btn" title="${isMinimized ? 'Expand' : 'Minimize'}">
          ${icon('chevron-down', 'icon-sm')}
        </button>
      </div>
    </div>
    <div class="device-card-compact">
      <span class="compact-ip device-ip">${escapeHtml(device.ip)}</span>
      <span class="compact-separator">•</span>
      <span class="compact-model">${escapeHtml(device.modelName || device.modelNumber || 'Roku')}</span>
    </div>
    <div class="device-details">
      <div class="device-detail">
        <span class="label">Type</span>
        <span class="value">${deviceType}</span>
      </div>
      <div class="device-detail">
        <span class="label">IP</span>
        <span class="value device-ip">${escapeHtml(device.ip)}</span>
      </div>
      <div class="device-detail">
        <span class="label">Model</span>
        <span class="value">${escapeHtml(device.modelNumber || 'N/A')}</span>
      </div>
      <div class="device-detail">
        <span class="label">Serial</span>
        <span class="value device-serial">${escapeHtml(device.serialNumber || 'N/A')}</span>
      </div>
      ${device.softwareVersion ? `
      <div class="device-detail">
        <span class="label">SW</span>
        <span class="value">${escapeHtml(device.softwareVersion)}${escapeHtml(softwareBuild)}</span>
      </div>
      ` : ''}
    </div>
    <div class="device-actions">
      <button class="connect-btn${isConnected ? ' connected' : ''}">
        ${isConnected ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  `);

  setDeviceCardThumbnail(card.querySelector('.device-card-thumb'), device, {
    isRemote: false,
    serverUrl: null
  });
  
  // Toggle minimize/expand
  const toggleBtn = card.querySelector('.device-toggle-btn');
  const connectBtn = card.querySelector('.connect-btn');
  if (!(toggleBtn instanceof HTMLElement) || !(connectBtn instanceof HTMLElement)) {
    return card;
  }
  const toggleMinimize = (e?: Event) => {
    if (e) e.stopPropagation();
    const nowMinimized = !card.classList.contains('minimized');
    card.classList.toggle('minimized');
    toggleBtn.title = nowMinimized ? 'Expand' : 'Minimize';
    setDeviceMinimized(device.ip, nowMinimized);
  };
  toggleBtn.addEventListener('click', toggleMinimize);
  
  // Connect/Disconnect button handler
  connectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isConnected) {
      disconnectDevice(device.ip);
    } else {
      connectDevice(device);
    }
  });
  
  // Right-click context menu
  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showDeviceContextMenu(device);
  });
  
  // Click card: expand if minimized, or activate tab if connected
  card.addEventListener('click', (e) => {
    if (card.classList.contains('minimized')) {
      toggleMinimize(e);
    } else if (isConnected) {
      const connection = state.connectedDevices.get(device.ip);
      if (connection) {
        activateTab(connection.tabId);
      }
    }
  });
  
  return card;
}

// ============================================
// Context Menu
// ============================================

async function showDeviceContextMenu(device) {
  const items = [
    { label: `${device.deviceName}`, action: 'header' },
    { type: 'separator' },
    { label: 'Copy Device Name', action: 'copy', value: device.deviceName },
    { label: 'Copy IP Address', action: 'copy', value: device.ip },
    { label: 'Copy Model Number', action: 'copy', value: device.modelNumber },
    { label: 'Copy Serial Number', action: 'copy', value: device.serialNumber },
    { type: 'separator' },
    { label: 'Copy All Details', action: 'copy', value: formatDeviceDetails(device) }
  ];
  
  await window.roku.showContextMenu(items);
}

function formatDeviceDetails(device) {
  return `Device Name: ${device.deviceName}
IP Address: ${device.ip}
Model Name: ${device.modelName}
Model Number: ${device.modelNumber}
Serial Number: ${device.serialNumber}
Software Version: ${device.softwareVersion || 'N/A'}
Device ID: ${device.deviceId || 'N/A'}
Network Type: ${device.networkType || 'N/A'}
WiFi MAC: ${device.wifiMac || 'N/A'}`;
}

// ============================================
// Device Connection & Tab Management
// ============================================

function connectDevice(device) {
  if (state.connectedDevices.has(device.ip)) {
    // Already connected, just activate the tab
    const connection = state.connectedDevices.get(device.ip);
    activateTab(connection.tabId);
    return;
  }
  
  const tabId = `tab-${device.ip.replace(/\./g, '-')}`;
  
  // Create tab
  const tab = createTab(device, tabId);
  elements.tabBar.insertBefore(tab, elements.tabBar.querySelector('.tab-placeholder'));
  
  // Create tab panel
  const panel = createDevicePanel(device, tabId);
  elements.tabContentArea.appendChild(panel);
  
  // Store connection
  state.connectedDevices.set(device.ip, { device, tabId });
  
  // Activate the new tab
  activateTab(tabId);
  
  // Update device list
  renderDeviceList();

  pushDeviceListToMcpBridge();

  if (AUTO_CONNECT_LAST_DEVICE_ENABLED) {
    void addRememberedDeviceToListIfEnabled(device, 'local', null);
  }
}

function disconnectDevice(deviceKey) {
  // deviceKey can be either just IP (local) or locationId:IP (remote)
  const connection = state.connectedDevices.get(deviceKey);
  if (!connection) return;

  if (AUTO_CONNECT_LAST_DEVICE_ENABLED) {
    void removeRememberedDeviceFromListIfEnabled(connection);
  }

  const { tabId, isRemote, locationId } = connection;
  
  // Remove tab
  const tab = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
  if (tab) tab.remove();
  
  // Remove panel and cleanup telnet
  const panel = document.getElementById(tabId);
  if (panel) {
    // Cleanup telnet connection if active
    if (panel._telnetCleanup) {
      panel._telnetCleanup();
    }
    if (panel._deviceMetricsCleanup) {
      panel._deviceMetricsCleanup();
    }
    // Tear down the per-panel AppConnector explicitly. The WeakMap-keyed
    // registry would eventually let GC reclaim it once `panel` is gone,
    // but `connector.destroy()` also releases the `RaleDisconnected` IPC
    // subscription deterministically — without this the listener leaks
    // until GC, accumulating one stale entry per closed device tab.
    const connector = peekAppConnector(panel as unknown as Parameters<typeof peekAppConnector>[0]);
    if (connector) {
      try { connector.destroy(); } catch (_) {}
    }
    panel.remove();
  }
  
  // Remove from state
  state.connectedDevices.delete(deviceKey);

  pushDeviceListToMcpBridge();
  
  // If this was the active tab, activate another or show welcome
  if (state.activeTabId === tabId) {
    const remainingTabs = Array.from(state.connectedDevices.values());
    if (remainingTabs.length > 0) {
      activateTab(remainingTabs[0].tabId);
    } else {
      state.activeTabId = null;
      elements.welcomePanel.classList.add('active');
    }
  }
  
  // Update device list
  renderDeviceList();
  
  // Update remote locations if this was a remote device
  if (isRemote) {
    renderRemoteLocations();
  }
  
  updateTabBarVisibility();
}

function createTab(device, tabId) {
  const tab = document.createElement('button');
  tab.className = 'tab-item';
  tab.dataset.tabId = tabId;
  tab.dataset.ip = device.ip;
  
  setSafeHTML(tab, `
    <span class="tab-name">${escapeHtml(device.deviceName)}</span>
    <span class="tab-close">×</span>
  `);
  
  tab.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof Element && !t.classList.contains('tab-close')) {
      activateTab(tabId);
    }
  });
  
  tab.querySelector('.tab-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    // Check if this is a remote device
    const deviceKey = tab.dataset.deviceKey || device.ip;
    disconnectDevice(deviceKey);
  });
  
  return tab;
}

function activateTab(tabId) {
  // Deactivate all tabs
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  
  // Remove active highlight from all device cards
  document.querySelectorAll('.device-card').forEach(c => c.classList.remove('active'));
  
  // Hide welcome panel
  elements.welcomePanel.classList.remove('active');
  
  // Activate selected tab
  const tab = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`) as HTMLElement | null;
  const panel = document.getElementById(tabId);
  
  if (tab && panel) {
    tab.classList.add('active');
    panel.classList.add('active');
    state.activeTabId = tabId;
    pushDeviceListToMcpBridge();
    
    // Highlight the corresponding device card in sidebar
    const ip = tab.dataset.ip;
    const isRemote = panel?.dataset.isRemote === 'true';
    const locationId = panel?.dataset.locationId;
    const serverUrl = panel?.dataset.serverUrl;
    
    if (ip) {
      const deviceCard = document.querySelector(`.device-card[data-ip="${ip}"]`);
      if (deviceCard) {
        deviceCard.classList.add('active');
      }
      
      // Also highlight remote device card if applicable
      if (isRemote && locationId) {
        const remoteDeviceCard = document.querySelector(`.remote-device-mini[data-device-key="${locationId}:${ip}"]`);
        if (remoteDeviceCard) {
          remoteDeviceCard.classList.add('active');
        }
      }
      
      // Check connection status when switching tabs
      checkDeviceConnection(ip, isRemote ? serverUrl : null, isRemote ? locationId : null);
    }
  }
  updateTabBarVisibility();
}

function updateTabBarVisibility() {
  const onHome = !state.activeTabId;
  const noDevices = state.connectedDevices.size === 0;
  elements.tabBar.classList.toggle('hidden', onHome && noDevices);
}

/**
 * After device-info health check, query /query/active-app so Dev App tab stays in sync
 * (Launch vs foreground, screenshot gating) when the user leaves the dev channel on device.
 */
async function pollDevAppForegroundAfterHealthCheck(
  ip: string,
  serverUrl: string | null | undefined,
  tabId: string
) {
  try {
    let activeRes: { success?: boolean; data?: string };
    if (serverUrl) {
      activeRes = await window.roku.remoteQuery(serverUrl, ip, QUERY_ENDPOINTS.ACTIVE_APP);
    } else {
      activeRes = await window.roku.query(ip, QUERY_ENDPOINTS.ACTIVE_APP);
    }
    if (activeRes && activeRes.success && typeof activeRes.data === 'string') {
      const panel = document.getElementById(tabId);
      if (panel) {
        dispatchDevAppForegroundFromActiveAppXml(panel, activeRes.data);
      }
    }
  } catch (e) {
    devLog('[Device Active Check] active-app poll failed:', errMessage(e));
  }
}

// Check single device connection and update UI
async function checkDeviceConnection(
  ip: string,
  serverUrl: string | null | undefined = null,
  locationId: string | null | undefined = null
) {
  const deviceKey = locationId ? `${locationId}:${ip}` : ip;
  const checkStartTime = Date.now();
  const isRemote = !!serverUrl;
  
  devLog(`[Device Active Check] ${isRemote ? 'REMOTE' : 'LOCAL'} → ${isRemote ? `${serverUrl} → ${ip}` : ip}`, {
    deviceKey,
    locationId: locationId || 'N/A'
  });
  
  try {
    let result;
    
    if (serverUrl) {
      // Remote device - check through relay server via IPC
      devLog(`[Device Active Check] Requesting device info from remote server: ${serverUrl}/device/${ip}/info`);
      try {
        const data = await window.roku.remoteDeviceInfo(serverUrl, ip);
        const checkDuration = Date.now() - checkStartTime;
        devLog(`[Device Active Check] Remote response (${checkDuration}ms):`, {
          success: data.success,
          error: data.error,
          hasDeviceInfo: !!data.deviceInfo
        });
        result = { success: data.success, deviceInfo: data.deviceInfo };
      } catch (err) {
        const checkDuration = Date.now() - checkStartTime;
        devLog(`[Device Active Check] Remote ERROR (${checkDuration}ms):`, errMessage(err));
        console.error('Remote check error:', err);
        result = { success: false, error: errMessage(err) };
      }
    } else {
      // Local device - use direct connection
      devLog(`[Device Active Check] Testing direct connection to ${ip}:8060/query/device-info`);
      const testStartTime = Date.now();
      result = await window.roku.testConnection(ip);
      const testDuration = Date.now() - testStartTime;
      devLog(`[Device Active Check] Local response (${testDuration}ms):`, {
        success: result.success,
        error: result.error,
        hasDeviceInfo: !!result.deviceInfo
      });
    }
    
    const connection = state.connectedDevices.get(deviceKey);
    
    if (!result.success) {
      // Device is offline
      updateDeviceOfflineState(deviceKey, true, !!serverUrl);
    } else {
      // Device is online
      updateDeviceOfflineState(deviceKey, false, !!serverUrl);
      // Merge fresh device info into connection so panel has correct ecpSettingMode, developerEnabled, etc.
      if (result.deviceInfo && connection && connection.device) {
        Object.assign(connection.device, result.deviceInfo);
        const panel = document.getElementById(connection.tabId);
        if (panel) {
          const iconEl = panel.querySelector('.device-panel-icon');
          setDevicePanelIcon(iconEl, connection.device, {
            isRemote: !!serverUrl,
            serverUrl: serverUrl || connection.serverUrl
          });
          updateEcpWarnings(panel, connection.device);
          updateDevModeWarnings(panel, connection.device.developerEnabled === true);
        }
      }
      if (connection && connection.tabId) {
        void pollDevAppForegroundAfterHealthCheck(ip, serverUrl, connection.tabId);
      }
    }
  } catch (error) {
    console.error('Connection check failed for', ip, ':', error);
    updateDeviceOfflineState(deviceKey, true, !!serverUrl);
  }
}

// Update device UI for offline/online state
function updateDeviceOfflineState(deviceKey, isOffline, isRemote = false) {
  // deviceKey is either just "ip" for local devices or "locationId:ip" for remote devices
  const parts = deviceKey.split(':');
  const ip = parts.length > 1 ? parts[1] : parts[0];
  const locationId = parts.length > 1 ? parts[0] : null;
  
  // Update local device card (if it's a local device)
  if (!isRemote) {
    const deviceCard = document.querySelector(`.device-card[data-ip="${ip}"]`);
    if (deviceCard) {
      const connectBtn = deviceCard.querySelector('.connect-btn');
      const statusDot = deviceCard.querySelector('.status-dot');
      
      if (isOffline) {
        deviceCard.classList.add('disconnected');
        if (statusDot instanceof HTMLElement) {
          statusDot.style.background = 'var(--accent-red)';
          statusDot.style.animation = 'none';
        }
        if (connectBtn instanceof HTMLElement) {
          connectBtn.textContent = 'Reconnect';
          connectBtn.classList.remove('connected');
          connectBtn.classList.add('reconnect');
        }
      } else {
        deviceCard.classList.remove('disconnected');
        if (statusDot instanceof HTMLElement) {
          statusDot.style.background = 'var(--accent-green)';
          statusDot.style.animation = 'pulse 2s ease-in-out infinite';
        }
        if (connectBtn instanceof HTMLElement) {
          connectBtn.textContent = 'Disconnect';
          connectBtn.classList.add('connected');
          connectBtn.classList.remove('reconnect');
        }
      }
    }
  }
  
  // Update remote device mini card (if it's a remote device)
  if (isRemote && locationId) {
    const remoteDeviceCard = document.querySelector(`.remote-device-mini[data-device-key="${deviceKey}"]`);
    if (remoteDeviceCard) {
      const statusDot = remoteDeviceCard.querySelector('.status-dot');
      if (isOffline) {
        remoteDeviceCard.classList.add('disconnected');
        remoteDeviceCard.classList.remove('connected');
        if (statusDot instanceof HTMLElement) {
          statusDot.style.background = 'var(--accent-red)';
        }
      } else {
        remoteDeviceCard.classList.remove('disconnected');
        remoteDeviceCard.classList.add('connected');
        if (statusDot instanceof HTMLElement) {
          statusDot.style.background = 'var(--accent-green)';
        }
      }
    }
  }
  
  // Update the device panel overlay
  const connection = state.connectedDevices.get(deviceKey);
  if (connection) {
    const panel = document.getElementById(connection.tabId);
    if (panel) {
      const panelDot = panel.querySelector('.panel-device-ip-row .status-dot');
      if (panelDot instanceof HTMLElement) {
        if (isOffline) {
          panelDot.style.background = 'var(--accent-red)';
          panelDot.style.animation = 'none';
          panelDot.title = 'Device offline';
          panelDot.setAttribute('aria-label', 'Device offline');
        } else {
          panelDot.style.background = 'var(--accent-green)';
          panelDot.style.animation = 'pulse 2s ease-in-out infinite';
          panelDot.title = 'Connected';
          panelDot.setAttribute('aria-label', 'Connected');
        }
      }

      let overlay = panel.querySelector('.device-offline-overlay') as HTMLElement | null;
      
      if (isOffline) {
        if (!overlay) {
          const newOverlay = document.createElement('div');
          newOverlay.className = 'device-offline-overlay';
          setSafeHTML(newOverlay, `
            <div class="offline-content">
              <div class="offline-icon">${icon('wifi-off', 'icon-xl')}</div>
              <h3>Device Offline</h3>
              <p>Unable to connect to this Roku device.</p>
              <button class="btn btn-primary retry-connection-btn">${icon('refresh', 'icon-xs')} Retry Connection</button>
            </div>
          `);
          const devicePanelRoot = panel.querySelector('.device-panel');
          if (devicePanelRoot instanceof HTMLElement) {
            devicePanelRoot.prepend(newOverlay);
          }
          
          // Add retry button handler with correct parameters
          const serverUrl = connection.serverUrl || panel.dataset.serverUrl;
          newOverlay.querySelector('.retry-connection-btn')?.addEventListener('click', () => {
            checkDeviceConnection(ip, serverUrl, locationId);
          });
          overlay = newOverlay;
        }
        overlay.style.display = 'flex';
      } else {
        if (overlay) {
          overlay.style.display = 'none';
        }
      }
    }
  }
}

// Apply capability-based visibility to tabs and features
function applyCapabilities(panel, capabilities) {
  if (!capabilities) return;
  
  // Map capability keys to tab data-inner-tab values
  const tabCapabilityMap = {
    'remote': 'remote',        // Remote control tab
    'apps': 'apps',            // Apps tab
    'query': 'query',          // Query tab
    'devApp': 'devapp',        // Dev App tab
    'console': 'telnet',       // Console tab (telnet)
    'appConnector': 'inspector' // App Connector tab
  };
  
  for (const [capKey, tabKey] of Object.entries(tabCapabilityMap)) {
    const isEnabled = capabilities[capKey] !== false; // Default to enabled if not specified
    
    // Find the tab button and content
    const tabBtn = panel.querySelector(`.inner-tab[data-inner-tab="${tabKey}"]`);
    const tabContent = panel.querySelector(`.inner-tab-content[data-inner-content="${tabKey}"]`);
    
    if (!isEnabled) {
      // Hide tab button
      if (tabBtn) {
        tabBtn.style.display = 'none';
      }
      // Hide tab content
      if (tabContent) {
        tabContent.style.display = 'none';
      }
      devLog(`[Capabilities] Tab '${tabKey}' hidden (${capKey}=${capabilities[capKey]})`);
    }
  }
  
  // If the active tab was hidden, switch to the first visible tab
  const activeTab = panel.querySelector('.inner-tab.active');
  if (activeTab && activeTab.style.display === 'none') {
    const firstVisibleTab = panel.querySelector('.inner-tab:not([style*="display: none"])');
    if (firstVisibleTab) {
      activeTab.classList.remove('active');
      firstVisibleTab.classList.add('active');
      
      const oldContent = panel.querySelector('.inner-tab-content.active');
      const newTabKey = firstVisibleTab.dataset.innerTab;
      const newContent = panel.querySelector(`.inner-tab-content[data-inner-content="${newTabKey}"]`);
      
      if (oldContent) oldContent.classList.remove('active');
      if (newContent) newContent.classList.add('active');
    }
  }
}

/**
 * @param {object} device
 * @param {boolean} isRemote
 * @param {string | null} serverUrl
 * @returns {string | null}
 */
function resolveDeviceHardwareImageSrc(device, isRemote, serverUrl) {
  if (!device) return null;
  if (isRemote && serverUrl && device.ip) {
    const base = String(serverUrl).replace(/\/$/, '');
    return `${base}/device/${encodeURIComponent(device.ip)}/hardware-image`;
  }
  if (device.deviceImageUrl && typeof device.deviceImageUrl === 'string') {
    return device.deviceImageUrl;
  }
  return null;
}

/**
 * Model line for hardware image modal footer (name + number). Returns null if empty or redundant with device name.
 * @param {object} device
 * @returns {string | null}
 */
function getDeviceHardwareImageModalFooterModel(device) {
  if (!device) return null;
  const name = String(device.deviceName || '').trim();
  const mn = String(device.modelName || '').trim();
  const num = String(device.modelNumber || '').trim();
  const parts: string[] = [];
  if (mn) parts.push(mn);
  if (num && num !== mn) parts.push(num);
  const modelStr = parts.join(' · ');
  if (!modelStr) return null;
  const norm = (s) => s.toLowerCase();
  if (name && norm(name) === norm(modelStr)) return null;
  return modelStr;
}

/**
 * Full-size hardware image in a lightbox (same URL as the panel thumbnail).
 * @param {string} imageSrc
 * @param {object} device
 */
function openDeviceHardwareImageModal(imageSrc, device, opener?: HTMLElement | null) {
  document.querySelectorAll('.device-hardware-image-modal-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay device-hardware-image-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'device-hardware-image-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute(
    'aria-label',
    `${device.deviceName || device.modelName || 'Roku device'} — device image`
  );

  const header = document.createElement('div');
  header.className = 'device-hardware-image-modal-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'device-hardware-image-modal-title';
  titleEl.textContent = device.deviceName || device.modelName || 'Roku device';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close device-hardware-image-modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  setSafeHTML(closeBtn, icon('x', 'icon-sm'));

  const body = document.createElement('div');
  body.className = 'device-hardware-image-modal-body';

  const img = document.createElement('img');
  img.className = 'device-hardware-image-modal-img';
  img.src = imageSrc;
  img.alt = '';

  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  body.appendChild(img);
  modal.appendChild(header);
  modal.appendChild(body);

  const footerModel = getDeviceHardwareImageModalFooterModel(device);
  if (footerModel) {
    const footer = document.createElement('div');
    footer.className = 'device-hardware-image-modal-footer';
    const label = document.createElement('span');
    label.className = 'device-hardware-image-modal-footer-label';
    label.textContent = 'Model';
    const value = document.createElement('div');
    value.className = 'device-hardware-image-modal-footer-value';
    value.textContent = footerModel;
    footer.appendChild(label);
    footer.appendChild(value);
    modal.appendChild(footer);
  }

  overlay.appendChild(modal);
  prepareModalOpenOrigin(overlay, opener ?? null);
  document.body.appendChild(overlay);
  overlay.classList.add('active');
  overlay.classList.add('modal-motion-enabled');
  playModalOpenMotion(overlay);

  const teardown = () => {
    overlay.remove();
    document.removeEventListener('keydown', escHandler);
  };

  const requestClose = () => {
    closeModalWithOriginMotion(overlay, teardown);
  };

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    requestClose();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) requestClose();
  });

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') requestClose();
  };
  document.addEventListener('keydown', escHandler);
  closeBtn.focus();
}

/**
 * Sidebar device card thumbnail (decorative: hardware image or TV/STB glyph; no modal).
 * @param {HTMLElement | null} thumbEl
 * @param {object} device
 * @param {{ isRemote?: boolean, serverUrl?: string | null }} [opts]
 */
function setDeviceCardThumbnail(
  thumbEl: Element | null,
  device,
  opts: { isRemote?: boolean; serverUrl?: string | null } = {}
) {
  if (!thumbEl || !device || !(thumbEl instanceof HTMLElement)) return;
  const isRemote = !!opts.isRemote;
  const serverUrl = opts.serverUrl || null;
  const hardwareSrc = resolveDeviceHardwareImageSrc(device, isRemote, serverUrl);
  const isTv = device.isTv || (device.modelName && device.modelName.toLowerCase().includes('tv'));
  const iconName = isTv ? 'tv' : 'stb';
  const fallbackHtml =
    '<span class="icon icon-xs icon-accent"><svg><use href="#icon-' +
    escapeHtml(iconName) +
    '"/></svg></span>';

  thumbEl.classList.remove('device-card-thumb--hardware');
  setSafeHTML(thumbEl, '');

  if (!hardwareSrc) {
    thumbEl.className = 'device-card-thumb';
    setSafeHTML(thumbEl, fallbackHtml);
    return;
  }

  thumbEl.className = 'device-card-thumb device-card-thumb--hardware';
  const img = document.createElement('img');
  img.className = 'device-card-thumb-img';
  img.alt = '';
  img.decoding = 'async';
  img.src = hardwareSrc;
  img.setAttribute('aria-hidden', 'true');
  img.addEventListener(
    'error',
    () => {
      thumbEl.classList.remove('device-card-thumb--hardware');
      setSafeHTML(thumbEl, fallbackHtml);
    },
    { once: true }
  );
  thumbEl.appendChild(img);
}

/**
 * Device tab header: UPnP hardware image when available, else TV/STB SVG.
 * @param {HTMLElement | null} iconEl
 * @param {object} device
 * @param {{ isRemote?: boolean, serverUrl?: string | null }} [opts]
 */
function setDevicePanelIcon(
  iconEl: Element | null,
  device,
  opts: { isRemote?: boolean; serverUrl?: string | null } = {}
) {
  if (!iconEl || !device || !(iconEl instanceof HTMLElement)) return;
  const isRemote = !!opts.isRemote;
  const serverUrl = opts.serverUrl || null;
  const hardwareSrc = resolveDeviceHardwareImageSrc(device, isRemote, serverUrl);
  const isTv = device.isTv || (device.modelName && device.modelName.toLowerCase().includes('tv'));
  const iconName = isTv ? 'tv' : 'stb';
  const fallbackHtml =
    '<span class="icon icon-xl icon-accent"><svg><use href="#icon-' +
    escapeHtml(iconName) +
    '"/></svg></span>';

  if (!hardwareSrc) {
    iconEl.classList.remove('device-panel-icon--hardware');
    setSafeHTML(iconEl, fallbackHtml);
    return;
  }

  iconEl.classList.add('device-panel-icon--hardware');
  setSafeHTML(iconEl, '');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'device-panel-hardware-btn';
  btn.setAttribute(
    'aria-label',
    `View larger image: ${device.deviceName || device.modelName || 'Roku device'}`
  );
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const opener = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
    openDeviceHardwareImageModal(hardwareSrc, device, opener);
  });

  const img = document.createElement('img');
  img.className = 'device-panel-hardware-img';
  img.alt = '';
  img.decoding = 'async';
  img.src = hardwareSrc;
  img.addEventListener(
    'error',
    () => {
      iconEl.classList.remove('device-panel-icon--hardware');
      setSafeHTML(iconEl, fallbackHtml);
    },
    { once: true }
  );
  btn.appendChild(img);
  iconEl.appendChild(btn);
}

function createDevicePanel(device, tabId, isRemote = false, serverUrl = null, locationId = null) {
  devLog('Creating device panel for:', device.deviceName, device.ip, isRemote ? '(remote)' : '(local)');
  
  const template = elements.devicePanelTemplate;
  if (!template) {
    console.error('Device panel template not found!');
    return document.createElement('div');
  }
  
  const clonedTemplate = template.content.cloneNode(true);
  const panel = document.createElement('div');
  panel.className = 'tab-panel';
  panel.id = tabId;
  panel.dataset.ip = device.ip;
  
  // Add remote-specific data attributes
  if (isRemote) {
    panel.dataset.isRemote = 'true';
    if (serverUrl) panel.dataset.serverUrl = serverUrl;
    if (locationId) panel.dataset.locationId = locationId;
  }
  
  panel.appendChild(clonedTemplate);
  
  // Create the unified API adapter
  const api = createApiAdapter(isRemote, device.ip, serverUrl);
  // Expose it to cross-cutting code (e.g. global keyboard-remote shortcuts)
  // so they can go through the local-vs-remote branch instead of calling
  // `window.roku.*` directly with `panel.dataset.ip`.
  registerPanelApi(panel, api);
  
  // Apply capability-based tab visibility for remote devices
  if (isRemote && device.capabilities) {
    applyCapabilities(panel, device.capabilities);
  }
  
  // Update header info
  const nameText = panel.querySelector('.panel-device-name-text');
  const ipEl = panel.querySelector('.device-ip');
  const iconEl = panel.querySelector('.device-panel-icon');
  
  if (isRemote && locationId) {
    const location = state.remoteLocations.get(locationId);
    if (nameText instanceof HTMLElement) {
      setSafeHTML(
        nameText,
        icon('globe', 'icon-sm', 'icon-cyan') +
          ' ' +
          escapeHtml(device.deviceName || device.modelName || 'Unknown Roku')
      );
    }
    if (ipEl) {
      ipEl.textContent = `${device.ip} @ ${location?.name || 'Remote'}`;
    }
  } else {
    if (nameText) nameText.textContent = device.deviceName || device.modelName || 'Unknown Roku';
    if (ipEl) ipEl.textContent = device.ip;
  }
  
  if (iconEl) {
    setDevicePanelIcon(iconEl, device, { isRemote, serverUrl });
  }
  
  try {
    // Set up inner tabs
    setupInnerTabs(panel);
    
    // Set up all components using the unified API adapter
    setupRemoteControls(panel, device, api);
    setupApps(panel, device, api);
    setupQueries(panel, api);
    setupDeepLink(panel, api);
    setupDevApp(panel, device, api);
    setupInspector(panel, device, api);
    setupTelnet(panel, device, api, { devLog });
    setupActionScripts(panel, device, api);
    
    // Update dev mode warnings based on device status
    updateDevModeWarnings(panel, device.developerEnabled === true);
    // Update ECP / Control by Mobile Apps warnings (mode-aware)
    updateEcpWarnings(panel, device);
    
    devLog('Device panel setup complete');
  } catch (error) {
    console.error('Error setting up device panel:', error);
  }
  
  return panel;
}

// ============================================
// Inner Tab Management
// ============================================

function setupInnerTabs(panel) {
  const innerTabs = panel.querySelectorAll('.inner-tab');
  const innerContents = panel.querySelectorAll('.inner-tab-content');
  const panesRoot = panel.querySelector('.device-inner-panes');
  if (panesRoot) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panesRoot.classList.add('device-inner-panes--ready');
      });
    });
  }
  
  devLog('Setting up inner tabs:', innerTabs.length, 'tabs found');
  
  innerTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.innerTab;
      devLog('Tab clicked:', target);
      
      innerTabs.forEach(t => t.classList.remove('active'));
      innerContents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      const targetContent = panel.querySelector(`[data-inner-content="${target}"]`);
      if (targetContent) {
        targetContent.classList.add('active');
      } else {
        console.error('Tab content not found for:', target);
      }
      
      // Dispatch custom event for tab switch
      panel.dispatchEvent(new CustomEvent('innertabswitch', { detail: { tab: target } }));
    });
  });
}

// ============================================
// Remote Control
// ============================================

function setupRemoteControls(panel, device, api) {
  devLog('Setting up remote controls for:', api.ip, api.isRemote ? '(via relay)' : '(direct)');

  const serial = device.serialNumber != null ? String(device.serialNumber).trim() : '';
  const ip = device.ip != null ? String(device.ip).trim() : '';
  const metricsDeviceKey = serial || `ip:${ip || 'unknown'}`;
  setupRemoteTabMetrics(panel, api, {
    developerEnabled: device.developerEnabled === true,
    deviceKey: metricsDeviceKey
  });

  // Auto-screenshot elements and state
  const autoScreenshotCheckbox = panel.querySelector('.auto-screenshot-checkbox');
  const screenshotImage = panel.querySelector('.screenshot-image');
  const screenshotPlaceholder = panel.querySelector('.screenshot-placeholder');
  let screenshotDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  // SCREENSHOT_DEBOUNCE_DELAY is imported from modules/utils/constants.js
  
  // Auto-screenshot function for Remote tab
  async function takeAutoScreenshot() {
    if (!autoScreenshotCheckbox || !autoScreenshotCheckbox.checked) return;
    
    const passwordInput = panel.querySelector('.dev-password');
    const password = passwordInput?.value?.trim();
    if (!password) return;
    
    try {
      const result = await api.screenshot(password);
      if (result.success && result.url) {
        if (screenshotImage) {
          screenshotImage.src = result.url;
          screenshotImage.style.display = 'block';
        }
        if (screenshotPlaceholder) {
          screenshotPlaceholder.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('Auto screenshot error:', error);
    }
  }
  
  function scheduleAutoScreenshot() {
    if (!autoScreenshotCheckbox || !autoScreenshotCheckbox.checked) return;
    
    if (screenshotDebounceTimer) {
      clearTimeout(screenshotDebounceTimer);
    }
    screenshotDebounceTimer = setTimeout(takeAutoScreenshot, SCREENSHOT_DEBOUNCE_DELAY);
  }

  registerKeyboardRemoteAutoScreenshotRemote(panel, scheduleAutoScreenshot);
  
  // Key press buttons - improved click handling
  const keyButtons = panel.querySelectorAll('[data-key]');
  devLog('Found', keyButtons.length, 'key buttons');
  
  keyButtons.forEach(btn => {
    let isProcessing = false;
    
    const handlePress = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Prevent double-clicks while processing
      if (isProcessing) return;
      isProcessing = true;
      
      const key = btn.dataset.key;
      devLog('Key pressed:', key);
      
      // Visual feedback - add pressed class
      btn.classList.add('pressed');
      
      try {
        await api.keypress(key);
        
        // Schedule auto screenshot after successful keypress
        scheduleAutoScreenshot();
        
        // If Home was pressed, notify Dev App section to check if dev app exited
        if (key === 'Home') {
          setTimeout(() => {
            panel.dispatchEvent(new CustomEvent('homePressed', { bubbles: true }));
          }, 300); // Small delay to let Roku process the Home press
        }
      } catch (error) {
        console.error('Keypress error:', error);
      }
      
      // Remove pressed class after short delay
      setTimeout(() => {
        btn.classList.remove('pressed');
        isProcessing = false;
      }, 100);
    };
    
    // Use mousedown for faster response
    btn.addEventListener('mousedown', handlePress);
    
    // Also handle touch events for touch screens
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handlePress(e);
    }, { passive: false });
    
    // Prevent context menu on long press
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  
  // Text input (same approach as Dev App Quick Remote: Lit_ keypress per character so it works for both local and remote)
  const textInput = panel.querySelector('.text-input');
  const sendTextBtn = panel.querySelector('.send-text-btn');
  
  if (!textInput || !sendTextBtn) {
    devLog('Remote Send Text: text input or button not found in panel');
    return;
  }
  
  const sendTextLabel = sendTextBtn.querySelector('.send-text-btn-label');

  sendTextBtn.addEventListener('click', async () => {
    const text = textInput.value;
    if (!text) return;
    
    sendTextBtn.disabled = true;
    if (sendTextLabel) sendTextLabel.textContent = 'Sending...';
    
    try {
      for (const char of text) {
        await api.keypress(`Lit_${encodeURIComponent(char)}`);
      }
      textInput.value = '';
      scheduleAutoScreenshot();
    } catch (error) {
      console.error('Remote Send Text error:', error);
    } finally {
      sendTextBtn.disabled = false;
      if (sendTextLabel) sendTextLabel.textContent = 'Send Text';
    }
  });
  
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendTextBtn.click();
    }
  });
}

// ============================================
// Apps
// ============================================

function setupApps(panel, device, api) {
  const isTv = device.isTv === true;
  
  devLog('Setting up apps for:', api.ip, 'isTv:', isTv, api.isRemote ? '(via relay)' : '(direct)');
  
  const appsGrid = panel.querySelector('.installed-apps-grid');
  const appsLoading = panel.querySelector('.apps-loading');
  const appsEmpty = panel.querySelector('.apps-empty');
  const refreshBtn = panel.querySelector('.refresh-apps-btn');
  const tvInputsRow = panel.querySelector('.tv-inputs-row');
  
  if (!appsGrid || !appsLoading || !appsEmpty || !refreshBtn) {
    console.error('Apps elements not found:', { appsGrid, appsLoading, appsEmpty, refreshBtn });
    return;
  }
  
  // Show TV inputs only for TV devices
  if (tvInputsRow) {
    tvInputsRow.style.display = isTv ? 'flex' : 'none';
  }
  
  // Function to load and display installed apps
  async function loadInstalledApps() {
    appsLoading.style.display = 'block';
    appsGrid.innerHTML = '';
    appsEmpty.style.display = 'none';
    
    try {
      const result = await api.query('/query/apps');
      
      appsLoading.style.display = 'none';
      
      if (result.success && result.data) {
        const appMatches = [...result.data.matchAll(/<app id="([^"]+)"[^>]*>([^<]+)<\/app>/g)];
        
        if (appMatches.length === 0) {
          appsEmpty.style.display = 'block';
          return;
        }
        
        // Sort apps alphabetically by name
        appMatches.sort((a, b) => a[2].localeCompare(b[2]));
        
        for (const match of appMatches) {
          const appId = match[1];
          const appName = decodeHtmlEntities(match[2]);
          
          const btn = document.createElement('button');
          btn.className = 'app-btn-dynamic';
          btn.dataset.app = appId;
          btn.title = `${appName}\nID: ${appId}\nClick to launch`;
          
          setSafeHTML(btn, `
            <div class="app-icon-wrapper">
              <img class="app-icon" alt="${escapeHtml(appName)}" style="display: none;">
              <div class="app-icon-placeholder">${icon('tv', 'icon-lg', 'icon-muted icon-loading')}</div>
            </div>
            <div class="app-name-wrapper">
              <span class="app-name">${escapeHtml(appName)}</span>
              <span class="app-id">${appId}</span>
            </div>
          `);
          
          // Load icon via API adapter
          const iconImg = btn.querySelector('.app-icon');
          const placeholder = btn.querySelector('.app-icon-placeholder');
          
          api.getIcon(appId).then(result => {
            if (!(iconImg instanceof HTMLImageElement) || !(placeholder instanceof HTMLElement)) return;
            if (result.success && result.dataUrl) {
              iconImg.src = result.dataUrl;
              iconImg.style.display = 'block';
              placeholder.style.display = 'none';
            } else {
              // Stop animation on error, show static icon
              placeholder.style.animation = 'none';
              placeholder.style.background = 'var(--bg-elevated)';
              const loadingIcon = placeholder.querySelector('.icon-loading');
              if (loadingIcon) loadingIcon.classList.remove('icon-loading');
            }
          }).catch(() => {
            if (!(placeholder instanceof HTMLElement)) return;
            // Stop animation on error
            placeholder.style.animation = 'none';
            placeholder.style.background = 'var(--bg-elevated)';
            const loadingIcon = placeholder.querySelector('.icon-loading');
            if (loadingIcon) loadingIcon.classList.remove('icon-loading');
          });
          
          // Add click handler to launch app
          btn.addEventListener('click', async () => {
            btn.style.opacity = '0.5';
            await api.launch(appId);
            setTimeout(() => {
              btn.style.opacity = '1';
            }, 200);
          });
          
          appsGrid.appendChild(btn);
        }
      } else {
        appsEmpty.style.display = 'block';
        setSafeHTML(appsEmpty, '<p>Failed to load apps: ' + escapeHtml(result.error || 'Unknown error') + '</p>');
      }
    } catch (error) {
      appsLoading.style.display = 'none';
      appsEmpty.style.display = 'block';
      setSafeHTML(appsEmpty, '<p>Error: ' + escapeHtml(errMessage(error)) + '</p>');
    }
  }
  
  // Load apps on panel creation
  loadInstalledApps();
  
  // Refresh button
  refreshBtn.addEventListener('click', loadInstalledApps);
  
  // HDMI input buttons
  panel.querySelectorAll('.hdmi-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const appId = btn.dataset.app;
      btn.style.opacity = '0.5';
      await api.launch(appId);
      setTimeout(() => {
        btn.style.opacity = '1';
      }, 200);
    });
  });
  
  // Custom app launch
  const customAppIdInput = panel.querySelector('.custom-app-id');
  const launchCustomBtn = panel.querySelector('.launch-custom-btn');
  
  launchCustomBtn.addEventListener('click', async () => {
    const appId = customAppIdInput.value.trim();
    if (!appId) return;
    
    launchCustomBtn.style.opacity = '0.5';
    await api.launch(appId);
    setTimeout(() => {
      launchCustomBtn.style.opacity = '1';
    }, 200);
  });
  
  customAppIdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      launchCustomBtn.click();
    }
  });
  
  // List installed apps (raw)
  const listAppsBtn = panel.querySelector('.list-apps-btn');
  const appsOutput = panel.querySelector('.installed-apps-output');
  const copyAppsBtn = panel.querySelector('.copy-apps-btn');
  
  // Function to load and display raw apps list
  async function loadRawAppsList() {
    const result = await api.query('/query/apps');
    
    appsOutput.classList.remove('hidden');
    appsOutput.classList.add('visible');
    appsOutput.style.display = 'block';
    copyAppsBtn.style.display = 'block';
    
    if (result.success && result.data) {
      // Match app elements and extract id, version, and name
      const appMatches = [...result.data.matchAll(/<app\s+([^>]*)>([^<]+)<\/app>/g)];
      
      // Parse each match to extract id, version, and name
      const apps = appMatches.map(match => {
        const attrs = match[1];
        const name = decodeHtmlEntities(match[2]);
        const idMatch = attrs.match(/id="([^"]+)"/);
        const versionMatch = attrs.match(/version="([^"]+)"/);
        return {
          id: idMatch ? idMatch[1] : 'unknown',
          version: versionMatch ? versionMatch[1] : '',
          name: name
        };
      });
      
      // Sort by app name alphabetically
      apps.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      
      let formatted = 'INSTALLED APPS\n' + '═'.repeat(50) + '\n\n';
      
      for (const app of apps) {
        const versionStr = app.version ? ` (v${app.version})` : '';
        formatted += `ID: ${app.id.padEnd(12)} │ ${app.name}${versionStr}\n`;
      }
      
      appsOutput.textContent = formatted || result.data;
    } else {
      appsOutput.textContent = `Error: ${result.error}`;
    }
  }
  
  // Button click handler
  listAppsBtn.addEventListener('click', loadRawAppsList);
  
  // Auto-populate when Apps tab is opened
  panel.addEventListener('innertabswitch', (e) => {
    if (e.detail.tab === 'apps') {
      loadRawAppsList();
    }
  });
  
  // Check if Apps tab is already active on panel creation and auto-populate
  const appsTabContent = panel.querySelector('[data-inner-content="apps"]');
  if (appsTabContent && appsTabContent.classList.contains('active')) {
    loadRawAppsList();
  }
  
  // Copy apps list button handler
  copyAppsBtn.addEventListener('click', async () => {
    const text = appsOutput.textContent;
    if (text) {
      await window.roku.copyToClipboard(text);
      copyAppsBtn.textContent = '✓ Copied!';
      copyAppsBtn.classList.add('copied');
      
      setTimeout(() => {
        setSafeHTML(copyAppsBtn, icon('copy', 'icon-xs') + ' Copy');
        copyAppsBtn.classList.remove('copied');
      }, 2000);
    }
  });
}

// ============================================
// Queries
// ============================================

function setupQueries(panel, api) {
  setupQueriesComponent(panel, api);
}

// ============================================
// App Connector
// ============================================

function setupInspector(panel, device, api) {
  setupInspectorComponent(panel, device, api);
}

function setupActionScripts(panel, device, api) {
  setupActionScriptsComponent(panel, device, api);
}

// Old setupInspector implementation removed - now using modular component
// The old 600+ line function has been split into:
// - components/inspector/integration-guide.js
// - components/inspector/rale-connection.js
// - components/inspector/function-selector.js
// - components/inspector/parameter-inputs.js
// - components/inspector/function-execution.js
// - components/inspector/response-display.js
// - components/inspector/index.js

// ============================================
// Deep Link
// ============================================

function setupDeepLink(panel, api) {
  devLog('Setting up deep link for:', api.ip, api.isRemote ? '(via relay)' : '(direct)');
  
  const appIdInput = panel.querySelector('.deeplink-app-id');
  const contentIdInput = panel.querySelector('.deeplink-content-id');
  const mediaTypeSelect = panel.querySelector('.deeplink-media-type');
  const deeplinkBtn = panel.querySelector('.deeplink-btn');
  const statusDiv = panel.querySelector('.deeplink-status');
  
  if (!appIdInput || !contentIdInput || !mediaTypeSelect || !deeplinkBtn || !statusDiv) {
    console.error('Deep link elements not found');
    return;
  }
  
  deeplinkBtn.addEventListener('click', async () => {
    const appId = appIdInput.value.trim();
    const contentId = contentIdInput.value.trim();
    const mediaType = mediaTypeSelect.value;
    
    if (!appId) {
      showStatusMessage(statusDiv, 'Please enter an App ID', 'warning');
      return;
    }
    
    const result = await api.deeplink(appId, contentId, mediaType);
    
    if (result.success) {
      showStatusMessage(statusDiv, '✓ Deep link launched successfully', 'success');
    } else {
      showStatusMessage(statusDiv, `Deep link failed: ${result.error}`, 'error');
    }
  });
}

// ============================================
// Sideload / Dev App Setup (Two-Column Layout)
// ============================================

function setupDevApp(panel, device, api) {
  setupDevAppComponent(panel, device, api);
}

// ============================================
// Periodic device active check (CONNECTION_CHECK_INTERVAL)
// ============================================

let connectionCheckInterval: ReturnType<typeof setInterval> | null = null;

async function checkConnectedDevices() {
  for (const [deviceKey, connection] of state.connectedDevices) {
    // deviceKey is either "ip" for local or "locationId:ip" for remote
    const parts = deviceKey.split(':');
    const ip = parts.length > 1 ? parts[1] : parts[0];
    const locationId = parts.length > 1 ? parts[0] : null;
    
    await checkDeviceConnection(
      ip, 
      connection.isRemote ? connection.serverUrl : null, 
      connection.isRemote ? locationId : null
    );
  }
}

function startConnectionMonitoring() {
  // Interval from CONNECTION_CHECK_INTERVAL (Settings: Device Active Check)
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
  }
  connectionCheckInterval = setInterval(checkConnectedDevices, CONNECTION_CHECK_INTERVAL);
}

function stopConnectionMonitoring() {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }
}

// ============================================
// Keyboard Shortcuts
// ============================================

/** True when any blocking overlay is open so global remote keys must not fire. */
function shouldSuppressGlobalRemoteShortcuts(): boolean {
  if (document.querySelector('.modal-overlay.active')) return true;
  if (document.querySelector('.add-location-modal.active')) return true;
  // Server info lightbox uses flex without `.active`; treat connected overlay as open.
  if (document.querySelector('.server-info-overlay')) return true;
  return false;
}

/** Keyboard Remote applies on the Remote inner tab (solo or device-performance quad) or Dev App inner tab. */
function isKeyboardRemoteNavigationContextActive(panel: HTMLElement): boolean {
  const devapp = panel.querySelector('.inner-tab-content[data-inner-content="devapp"]');
  if (devapp instanceof HTMLElement && devapp.classList.contains('active')) {
    return true;
  }
  const remote = panel.querySelector('.inner-tab-content[data-inner-content="remote"]');
  return remote instanceof HTMLElement && remote.classList.contains('active');
}

/** Remote tab Send Text field, scoped to the active inner pane. */
function queryRemoteSendTextInput(panel: HTMLElement): HTMLInputElement | null {
  const el = panel.querySelector(
    '.inner-tab-content[data-inner-content="remote"] .text-input'
  );
  return el instanceof HTMLInputElement ? el : null;
}

/** Dev App Quick Remote send field. */
function queryDevAppSendTextInput(panel: HTMLElement): HTMLInputElement | null {
  const el = panel.querySelector('.devapp-text-input');
  return el instanceof HTMLInputElement ? el : null;
}

/**
 * Focus Send Text for the active Remote or Dev App inner tab. Does not depend on
 * "Roku Remote - Use Keyboard " so Tab remains a focus shortcut.
 */
function focusSendTextInDevicePanel(panel: HTMLElement): boolean {
  if (!isKeyboardRemoteNavigationContextActive(panel)) return false;
  const devapp = panel.querySelector('.inner-tab-content[data-inner-content="devapp"]');
  if (devapp instanceof HTMLElement && devapp.classList.contains('active')) {
    const input = queryDevAppSendTextInput(panel);
    if (!input) return false;
    input.focus();
    return true;
  }
  const input = queryRemoteSendTextInput(panel);
  if (!input) return false;
  input.focus();
  return true;
}

document.addEventListener('keydown', async (e) => {
  // Handle Ctrl+F / Cmd+F for search in query tab
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    if (state.activeTabId) {
      const activePanel = document.getElementById(state.activeTabId);
      if (activePanel) {
        const queryTab = activePanel.querySelector('[data-inner-content="query"]');
        const searchInput = activePanel.querySelector('.query-search-input');
        const copyQueryBtn = activePanel.querySelector('.copy-query-btn');
        const copyVisible =
          copyQueryBtn instanceof HTMLElement && copyQueryBtn.style.display === 'block';
        if (
          queryTab &&
          queryTab.classList.contains('active') &&
          searchInput instanceof HTMLInputElement &&
          copyVisible
        ) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
          return;
        }
      }
    }
  }
  
  // Don't intercept if typing in an input
  const keyTarget = e.target;
  if (
    keyTarget instanceof HTMLInputElement ||
    keyTarget instanceof HTMLSelectElement ||
    keyTarget instanceof HTMLTextAreaElement
  ) {
    return;
  }

  if (keyTarget instanceof HTMLElement && keyTarget.isContentEditable) {
    return;
  }

  if (shouldSuppressGlobalRemoteShortcuts()) {
    return;
  }

  // Tab → focus Send Text (Remote or Dev App), only when event is from this device panel
  if (e.key === 'Tab' && !e.shiftKey && state.activeTabId) {
    const activePanel = document.getElementById(state.activeTabId);
    const skipTabToSendText =
      keyTarget instanceof HTMLElement && keyTarget.closest('.inner-tabs') != null;
    if (
      !skipTabToSendText &&
      activePanel &&
      keyTarget instanceof Node &&
      activePanel.contains(keyTarget) &&
      focusSendTextInDevicePanel(activePanel)
    ) {
      e.preventDefault();
      return;
    }
  }

  if (!KEYBOARD_REMOTE_SHORTCUTS_ENABLED) {
    return;
  }

  // Only handle if we have an active connected device tab in view
  if (!state.activeTabId) return;

  const activePanel = document.getElementById(state.activeTabId);
  if (!activePanel) return;

  // Go through the panel's registered device API adapter so keypresses on a
  // remote-connected device tab are routed via `remoteKeypress` (relay server)
  // instead of direct LAN `keypress`. Reading `panel.dataset.ip` and calling
  // `window.roku.keypress(ip, …)` would silently hit the wrong transport.
  const panelApi = getPanelApi(activePanel);
  if (!panelApi) return;

  if (!isKeyboardRemoteNavigationContextActive(activePanel)) {
    return;
  }

  const keyMap = {
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'Enter': 'Select',
    'Backspace': 'Back',
    'Escape': 'Home',
    ' ': 'Play',
    '*': 'Info',
    'r': 'InstantReplay',
    'j': 'Rev',
    'l': 'Fwd',
    '+': 'VolumeUp',
    '-': 'VolumeDown',
    'm': 'VolumeMute'
  };

  const shiftPForPower =
    e.shiftKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    e.key.length === 1 &&
    e.key.toLowerCase() === 'p';

  const lookupKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const rokuKey = shiftPForPower ? 'PowerOff' : keyMap[lookupKey];
  if (rokuKey) {
    e.preventDefault();
    
    // Visual feedback using pressed class
    const btn = activePanel.querySelector(`[data-key="${rokuKey}"]`);
    if (btn) {
      btn.classList.add('pressed');
    }
    
    try {
      await panelApi.keypress(rokuKey);
      scheduleKeyboardRemoteAutoScreenshotForActiveInnerTab(activePanel);
    } catch (error) {
      console.error('Keypress error:', error);
    }
    
    // Remove visual feedback
    if (btn) {
      setTimeout(() => {
        btn.classList.remove('pressed');
      }, 100);
    }
  }
});

// ============================================
// Manual Connection
// ============================================

async function manualConnect() {
  if (!elements.manualIp || !elements.manualConnectBtn) return;
  const ip = elements.manualIp.value.trim();
  if (!ip) return;
  
  elements.manualConnectBtn.disabled = true;
  elements.manualConnectBtn.textContent = 'Connecting...';
  
  try {
    const result = await window.roku.testConnection(ip);
    
    if (result.success && result.deviceInfo) {
      const device = {
        ip,
        ...result.deviceInfo
      };
      
      // Add to devices list
      state.devices.set(ip, device);
      renderDeviceList();
      
      // Connect to the device
      connectDevice(device);
      
      elements.manualIp.value = '';
    } else {
      alert(`Could not connect to ${ip}. Make sure the Roku device is on and accessible.`);
    }
  } catch (error) {
    alert(`Connection error: ${errMessage(error)}`);
  }
  
  if (elements.manualConnectBtn) {
    elements.manualConnectBtn.disabled = false;
    elements.manualConnectBtn.textContent = 'Connect';
  }
}

// ============================================
// Utility Functions
// ============================================

// Utility functions are now imported from modules/utils
// escapeHtml, decodeHtmlEntities, formatQueryResult, showStatusMessage are imported above

// ============================================
// Remote Location Modal
// ============================================

function setupRemoteLocationModal() {
  const modal = elements.addLocationModal;
  const addBtn = elements.addLocationBtn;
  const cancelBtn = elements.cancelAddLocation;
  const confirmBtn = elements.confirmAddLocation;
  const nameInput = elements.locationName;
  const hostInput = elements.locationHost;
  const portInput = elements.locationPort;
  
  if (!modal || !addBtn || !cancelBtn || !confirmBtn || !nameInput || !hostInput || !portInput) {
    devLog('Remote location modal elements not found');
    return;
  }
  const locationModal = modal;
  
  // Open modal
  addBtn.addEventListener('click', (e) => {
    const opener = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
    prepareModalOpenOrigin(locationModal, opener);
    locationModal.classList.add('active');
    nameInput.value = '';
    hostInput.value = '';
    portInput.value = '4951';
    nameInput.focus();
    playModalOpenMotion(locationModal);
  });
  
  // Close modal
  function closeModal() {
    if (!locationModal.classList.contains('active')) return;
    closeModalWithOriginMotion(locationModal, () => {
      locationModal.classList.remove('active');
    });
  }
  
  cancelBtn.addEventListener('click', closeModal);
  
  // Close on backdrop click
  locationModal.addEventListener('click', (e) => {
    if (e.target === locationModal) {
      closeModal();
    }
  });
  
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && locationModal.classList.contains('active')) {
      closeModal();
    }
  });
  
  // Add location
  confirmBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const host = hostInput.value.trim();
    const port = parseInt(portInput.value) || 4951;
    
    if (!name) {
      nameInput.focus();
      nameInput.style.borderColor = 'var(--accent-red)';
      return;
    }
    
    if (!host) {
      hostInput.focus();
      hostInput.style.borderColor = 'var(--accent-red)';
      return;
    }
    
    nameInput.style.borderColor = '';
    hostInput.style.borderColor = '';
    
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Connecting...';
    
    try {
      await addRemoteLocation(name, host, port);
      closeModal();
    } catch (e) {
      console.error('Failed to add remote location:', e);
      alert(errMessage(e) || 'Failed to connect to relay server');
    }
    
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Add Location';
  });
  
  // Enter key to submit
  [nameInput, hostInput, portInput].forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        confirmBtn.click();
      }
    });
  });
  
  // Clear validation on input
  nameInput.addEventListener('input', () => {
    nameInput.style.borderColor = '';
  });
  hostInput.addEventListener('input', () => {
    hostInput.style.borderColor = '';
  });
}

// ============================================
// Initialization
// ============================================

let keyboardRemoteHelpModalWired = false;

/** Info modal for keyboard → remote shortcuts (buttons on Remote header + Dev App Quick Remote card). */
function setupKeyboardRemoteHelpModal(): void {
  if (keyboardRemoteHelpModalWired) return;
  const modal = document.getElementById('keyboardRemoteHelpModal');
  const closeBtn = document.getElementById('keyboardRemoteHelpModalClose');
  if (!(modal instanceof HTMLElement) || !(closeBtn instanceof HTMLElement)) return;
  keyboardRemoteHelpModalWired = true;

  const closeKeyboardRemoteHelpModal = () => {
    if (!modal.classList.contains('active')) return;
    closeModalWithOriginMotion(modal, () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    });
  };

  closeBtn.addEventListener('click', closeKeyboardRemoteHelpModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeKeyboardRemoteHelpModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeKeyboardRemoteHelpModal();
    }
  });

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest('.keyboard-remote-help-btn');
    if (!btn) return;
    if (!document.body.classList.contains('keyboard-remote-shortcuts-on')) return;
    e.preventDefault();
    const opener = btn instanceof HTMLElement ? btn : null;
    modal.setAttribute('aria-hidden', 'false');
    openModalOverlayActiveFromOpener(modal, opener);
  });
}

/** Custom title bar: platform class + window controls (Windows / Linux; macOS uses traffic lights). */
function setupFramelessTitlebar(): void {
  const shell = window.rdsShell;
  if (!shell) return;
  document.body.classList.add(`platform-${shell.platform}`);

  const root = document.querySelector('.titlebar');
  if (!root) return;
  root.querySelector('.titlebar-minimize')?.addEventListener('click', () => shell.minimizeWindow());
  root.querySelector('.titlebar-maximize')?.addEventListener('click', () => shell.toggleMaximizeWindow());
  root.querySelector('.titlebar-close')?.addEventListener('click', () => shell.closeWindow());
}

let primarySidebarTitlebarToggleWired = false;

function cancelPostStartupSidebarGraceTimer(): void {
  if (postStartupSidebarGraceTimer != null) {
    clearTimeout(postStartupSidebarGraceTimer);
    postStartupSidebarGraceTimer = null;
  }
}

/** Reset per-launch sidebar startup state; call when a new discovery session begins. */
function resetPostStartupSidebarSessionState(): void {
  rememberedSidebarCollapsedAtLaunch = false;
  try {
    rememberedSidebarCollapsedAtLaunch = localStorage.getItem(RDS_SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    /* ignore */
  }
  postStartupSidebarDecisionComplete = false;
  userToggledSidebarDuringStartup = false;
  startupSidebarStickySuppress = false;
  sidebarSessionKeepExpandedOverride = false;
  cancelPostStartupSidebarGraceTimer();
}

function isPointerOverAppSidebar(): boolean {
  const sidebar = document.getElementById('appSidebar');
  if (!sidebar || lastPointerClientX < 0 || lastPointerClientY < 0) return false;
  const el = document.elementFromPoint(lastPointerClientX, lastPointerClientY);
  return el ? sidebar.contains(el) : false;
}

function isFocusWithinAppSidebar(): boolean {
  const sidebar = document.getElementById('appSidebar');
  if (!sidebar) return false;
  return sidebar.contains(document.activeElement);
}

function schedulePostStartupSidebarCollapseWithGrace(): void {
  cancelPostStartupSidebarGraceTimer();
  postStartupSidebarGraceTimer = window.setTimeout(() => {
    postStartupSidebarGraceTimer = null;
    if (postStartupSidebarDecisionComplete) return;
    if (userToggledSidebarDuringStartup) {
      postStartupSidebarDecisionComplete = true;
      syncPrimarySidebarCollapsedUI();
      return;
    }
    if (startupSidebarStickySuppress) {
      postStartupSidebarDecisionComplete = true;
      sidebarSessionKeepExpandedOverride = true;
      syncPrimarySidebarCollapsedUI();
      return;
    }
    if (state.connectedDevices.size === 0) {
      postStartupSidebarDecisionComplete = true;
      sidebarSessionKeepExpandedOverride = true;
      syncPrimarySidebarCollapsedUI();
      return;
    }
    if (isFocusWithinAppSidebar() || isPointerOverAppSidebar()) {
      postStartupSidebarDecisionComplete = true;
      sidebarSessionKeepExpandedOverride = true;
      syncPrimarySidebarCollapsedUI();
      return;
    }
    const btn = document.getElementById('titlebarSidebarToggle');
    if (!(btn instanceof HTMLButtonElement)) {
      postStartupSidebarDecisionComplete = true;
      return;
    }
    document.body.classList.add('sidebar-collapsed');
    btn.setAttribute('aria-expanded', 'false');
    try {
      localStorage.setItem(RDS_SIDEBAR_COLLAPSED_KEY, '1');
    } catch {
      /* ignore */
    }
    postStartupSidebarDecisionComplete = true;
    sidebarSessionKeepExpandedOverride = false;
  }, POST_STARTUP_SIDEBAR_GRACE_MS);
}

/** After local + remote startup scans, run auto-connect then optional remembered sidebar collapse. */
function handleRememberSidebarPostStartup(): void {
  if (!REMEMBER_SIDEBAR_TOGGLE) return;
  if (postStartupSidebarDecisionComplete) return;
  if (postStartupSidebarGraceTimer != null) return;

  if (userToggledSidebarDuringStartup) {
    postStartupSidebarDecisionComplete = true;
    syncPrimarySidebarCollapsedUI();
    return;
  }

  if (!rememberedSidebarCollapsedAtLaunch) {
    postStartupSidebarDecisionComplete = true;
    syncPrimarySidebarCollapsedUI();
    return;
  }

  if (state.connectedDevices.size === 0 || startupSidebarStickySuppress) {
    postStartupSidebarDecisionComplete = true;
    sidebarSessionKeepExpandedOverride = true;
    syncPrimarySidebarCollapsedUI();
    return;
  }

  if (isPointerOverAppSidebar() || isFocusWithinAppSidebar()) {
    postStartupSidebarDecisionComplete = true;
    sidebarSessionKeepExpandedOverride = true;
    syncPrimarySidebarCollapsedUI();
    return;
  }

  schedulePostStartupSidebarCollapseWithGrace();
}

async function onStartupScansReady(): Promise<void> {
  if (!startupLocalScanComplete || !startupRemoteScanComplete) return;
  if (startupScansReadyPromise) {
    await startupScansReadyPromise;
    return;
  }
  startupScansReadyPromise = (async () => {
    await maybeAutoConnectLastDevice();
    handleRememberSidebarPostStartup();
  })();
  try {
    await startupScansReadyPromise;
  } finally {
    startupScansReadyPromise = null;
  }
}

/** Apply collapsed class + aria from localStorage when {@link REMEMBER_SIDEBAR_TOGGLE} is on, else expanded. */
function syncPrimarySidebarCollapsedUI(): void {
  const btn = document.getElementById('titlebarSidebarToggle');
  if (!(btn instanceof HTMLButtonElement)) return;
  let collapsed = false;
  if (REMEMBER_SIDEBAR_TOGGLE) {
    try {
      collapsed = localStorage.getItem(RDS_SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      /* ignore */
    }
    if (sidebarSessionKeepExpandedOverride) collapsed = false;
    if (!postStartupSidebarDecisionComplete && rememberedSidebarCollapsedAtLaunch) collapsed = false;
  }
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}

/** Title bar control: show/hide primary sidebar; persistence follows General → Auto Hide SideBar. */
function setupSidebarTitlebarToggle(): void {
  const btn = document.getElementById('titlebarSidebarToggle');
  const sidebar = document.getElementById('appSidebar');
  if (!(btn instanceof HTMLButtonElement) || !sidebar) return;

  syncPrimarySidebarCollapsedUI();

  if (primarySidebarTitlebarToggleWired) return;
  primarySidebarTitlebarToggleWired = true;

  document.addEventListener(
    'mousemove',
    (e) => {
      lastPointerClientX = e.clientX;
      lastPointerClientY = e.clientY;
    },
    { passive: true }
  );

  const markStickyIfPreDecision = () => {
    if (!REMEMBER_SIDEBAR_TOGGLE) return;
    if (postStartupSidebarDecisionComplete) return;
    startupSidebarStickySuppress = true;
  };
  sidebar.addEventListener('mouseenter', markStickyIfPreDecision);
  sidebar.addEventListener('focusin', markStickyIfPreDecision);

  btn.addEventListener('click', () => {
    if (REMEMBER_SIDEBAR_TOGGLE && !postStartupSidebarDecisionComplete) {
      userToggledSidebarDuringStartup = true;
      cancelPostStartupSidebarGraceTimer();
      postStartupSidebarDecisionComplete = true;
    }
    sidebarSessionKeepExpandedOverride = false;

    const collapsed = !document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    // Always record the latest sidebar state so that enabling "Auto Hide SideBar"
    // later can act on it. The setting only controls whether we *read* this value
    // back at launch; writing it unconditionally keeps it fresh.
    try {
      localStorage.setItem(RDS_SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
  });
}

async function init() {
  setupFramelessTitlebar();
  const { ensureGlobalModalsMounted } = await import('./components/modals/mount-global-modals.js');
  await ensureGlobalModalsMounted();
  setupKeyboardRemoteHelpModal();

  // Initialize developer mode first
  initDeveloperMode();
  // Initialize privacy mode
  initPrivacyMode();
  
  devLog('Initializing Roku Dev Studio...');
  
  // Initialize DOM elements
  elements = {
    scanBtn: document.getElementById('scanBtn'),
    titlebarScanBtn: document.getElementById('titlebarScanBtn') as HTMLButtonElement | null,
    deviceList: document.getElementById('localDevicesList'),
    emptyState: document.getElementById('localEmptyState'),
    manualIp: document.getElementById('manualIp') as HTMLInputElement | null,
    manualConnectBtn: document.getElementById('manualConnectBtn') as HTMLButtonElement | null,
    tabBar: document.getElementById('tabBar') as HTMLElement,
    tabContentArea: document.getElementById('tabContentArea') as HTMLElement,
    welcomePanel: document.getElementById('welcomePanel') as HTMLElement,
    devicePanelTemplate: document.getElementById('devicePanelTemplate') as HTMLTemplateElement,
    // Remote location elements
    addLocationBtn: document.getElementById('addLocationBtn'),
    addLocationModal: document.getElementById('addLocationModal'),
    locationName: document.getElementById('locationName') as HTMLInputElement | null,
    locationHost: document.getElementById('locationHost') as HTMLInputElement | null,
    locationPort: document.getElementById('locationPort') as HTMLInputElement | null,
    cancelAddLocation: document.getElementById('cancelAddLocation') as HTMLButtonElement | null,
    confirmAddLocation: document.getElementById('confirmAddLocation') as HTMLButtonElement | null,
    remoteLocationsContainer: document.getElementById('remoteLocationsContainer'),
    // Local devices section
    localDevicesSection: document.getElementById('localDevicesSection'),
    localDevicesHeader: document.getElementById('localDevicesHeader'),
    localDevicesBody: document.getElementById('localDevicesBody')
  };
  
  devLog('window.roku available:', !!window.roku);
  devLog('Elements found:', {
    scanBtn: !!elements.scanBtn,
    deviceList: !!elements.deviceList,
    manualIp: !!elements.manualIp,
    manualConnectBtn: !!elements.manualConnectBtn,
    addLocationBtn: !!elements.addLocationBtn
  });
  
  if (!window.roku) {
    console.error('window.roku is not available! Preload might have failed.');
    return;
  }

  // Hydrate the in-memory developer-password cache from the encrypted store
  // (and migrate the legacy `localStorage["roku-dev-passwords"]` blob on first
  // run). MUST complete before device panels mount — `password-auth.ts`
  // auto-fires `verifyPassword()` synchronously off `getStoredPassword()`,
  // and that read returns `''` until this resolves.
  await hydrateSecretCache();

  await loadPersistedAppSettings();
  resetPostStartupSidebarSessionState();

  setupSidebarTitlebarToggle();

  // The shared bus performs `loadPersistedAppSettings()` once and fans out to
  // every subscriber, so the global shell and each device-metrics panel no
  // longer race on N parallel reloads.
  let wasRememberEnabledBeforeUpdate = REMEMBER_SIDEBAR_TOGGLE;
  onAppSettingsChanged(() => {
    cachedRememberedDeviceList = undefined;
    cancelPostStartupSidebarGraceTimer();
    if (!REMEMBER_SIDEBAR_TOGGLE) {
      postStartupSidebarDecisionComplete = true;
      sidebarSessionKeepExpandedOverride = false;
      userToggledSidebarDuringStartup = false;
      startupSidebarStickySuppress = false;
    } else if (!wasRememberEnabledBeforeUpdate) {
      // Auto Hide SideBar just turned ON. Re-open the "startup" decision window so
      // handleRememberSidebarPostStartup can apply the persisted collapsed state —
      // otherwise the pre-decision override in syncPrimarySidebarCollapsedUI keeps
      // the sidebar forced-expanded forever in this session.
      resetPostStartupSidebarSessionState();
      handleRememberSidebarPostStartup();
    }
    wasRememberEnabledBeforeUpdate = REMEMBER_SIDEBAR_TOGGLE;
    syncPrimarySidebarCollapsedUI();
    stopConnectionMonitoring();
    startConnectionMonitoring();
  });

  // Set up local devices section toggle
  if (elements.localDevicesHeader && elements.localDevicesSection) {
    const localDevicesSection = elements.localDevicesSection;
    elements.localDevicesHeader.addEventListener('click', (e) => {
      // Don't toggle if clicking the scan button
      const t = e.target;
      if (t instanceof Element && t.closest('.location-action-btn')) return;
      
      localDevicesSection.classList.toggle('collapsed');
      
      // Remember collapsed state
      if (!state.collapsedLocations) state.collapsedLocations = new Set();
      if (localDevicesSection.classList.contains('collapsed')) {
        state.collapsedLocations.add('local');
      } else {
        state.collapsedLocations.delete('local');
      }
    });
    
    // Restore collapsed state
    if (state.collapsedLocations && state.collapsedLocations.has('local')) {
      localDevicesSection.classList.add('collapsed');
    }
  }
  
  // Set up event listeners
  if (elements.scanBtn) {
    // Sidebar "Local Devices" Scan button: scans the local network only.
    // Each remote location card has its own per-location refresh button.
    elements.scanBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      void runLocalOnlyUserScan();
    });
  }
  if (elements.titlebarScanBtn) {
    // Title-bar Scan button is only visible when the sidebar is collapsed
    // (see `body.sidebar-collapsed .titlebar-scan-btn` in index.html). With
    // the sidebar hidden the user can't reach the per-section Scan/Refresh
    // buttons, so this button scans everything: local + every remote location.
    elements.titlebarScanBtn.addEventListener('click', () => {
      void runFullUserScan();
    });
  }
  if (elements.manualConnectBtn) {
    elements.manualConnectBtn.addEventListener('click', manualConnect);
  }
  if (elements.manualIp) {
    elements.manualIp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') manualConnect();
    });
  }
  
  // Set up remote location modal
  setupRemoteLocationModal();
  
  startupLocalScanComplete = false;
  startupRemoteScanComplete = false;
  autoConnectLastDeviceAttempted = false;
  cachedRememberedDeviceList = undefined;

  // Start fresh - clear any cached devices
  localStorage.removeItem('roku-devices');
  state.devices.clear();
  renderDeviceList();
  updateTabBarVisibility();
  
  // Load remote locations AFTER initial render (non-blocking)
  setTimeout(() => {
    loadRemoteLocations()
      .then(() => {
        renderRemoteLocations();
        if (state.remoteLocations.size === 0) {
          startupRemoteScanComplete = true;
          void onStartupScansReady();
        }
        // Refresh remote locations after a short delay
        setTimeout(refreshAllRemoteLocations, 500);
      })
      .catch((e) => {
        console.error('Failed to load remote locations:', e);
        startupRemoteScanComplete = true;
        void onStartupScansReady();
      });
  }, 50);
  
  // Auto-scan on startup - start immediately
  const initialDelay = 50;
  devLog('Scheduling auto-scan in', initialDelay, 'ms...');
  
  setTimeout(() => {
    devLog('Starting auto-scan...');
    startScan().then(() => {
      devLog('Auto-scan complete, found', state.devices.size, 'device(s)');
    }).catch(err => {
      console.error('Auto-scan failed:', err);
    });
  }, initialDelay);
  
  // Start periodic connection monitoring
  startConnectionMonitoring();
  
  // BrightScript Fiddle: build a snapshot of currently discovered+connected devices and
  // push it to any open Fiddle window. The main menu's "Open Fiddle" action lands here.
  function buildFiddleDeviceSnapshot(): Array<{ id: string; ip: string; name: string; modelName?: string; isRemote: boolean; serverUrl?: string | null; password?: string }> {
    const out: Array<{ id: string; ip: string; name: string; modelName?: string; isRemote: boolean; serverUrl?: string | null; password?: string }> = [];
    const seen = new Set<string>();

    const pushDevice = (device: { ip?: string; deviceName?: string; friendlyModelName?: string; modelName?: string; serialNumber?: string; isRemote?: boolean; serverUrl?: string; developerEnabled?: boolean }) => {
      if (!device || !device.ip) return;
      // Fiddle sideloads a dev channel; a non-dev-enabled Roku will reject the
      // /plugin_install POST regardless of password. Filter those out at the
      // source so the dropdown only lists devices the user can actually run on.
      if (device.developerEnabled !== true) return;
      const id = getDeviceId(device);
      if (!id || seen.has(id)) return;
      seen.add(id);
      const password = device.serialNumber ? getStoredPassword(device.serialNumber) : '';
      out.push({
        id,
        ip: device.ip,
        name: device.deviceName || device.friendlyModelName || device.modelName || 'Roku',
        modelName: device.modelName || device.friendlyModelName,
        isRemote: !!device.isRemote,
        serverUrl: device.serverUrl || null,
        password
      });
    };

    // Local devices discovered over the LAN.
    for (const device of state.devices.values()) pushDevice(device);
    // Remote devices live under each remote location — they're NOT in
    // state.devices.
    for (const location of state.remoteLocations.values()) {
      if (!location || !location.devices) continue;
      for (const device of location.devices.values()) pushDevice(device);
    }

    return out;
  }

  if (typeof window.roku.onOpenFiddleRequested === 'function') {
    window.roku.onOpenFiddleRequested(() => {
      // Opening Fiddle from the File menu should always default the dropdown
      // to "Select a device" — auto-preselection is reserved for the
      // per-device "Open Fiddle" button in the Developer Queries panel
      // (see __rdsOpenFiddleForDevice below).
      const devices = buildFiddleDeviceSnapshot();
      window.roku.openFiddle({ devices, initialDeviceId: null });
    });
  }
  if (typeof window.roku.onFiddleRefreshRequested === 'function') {
    window.roku.onFiddleRefreshRequested(async () => {
      // Fire a real network + relay rescan (same entry point as the titlebar
      // Scan button), then push the refreshed device list to the Fiddle window.
      try { window.roku.pushFiddleScanStatus({ scanning: true }); } catch { /* ignore */ }
      try {
        await runFullUserScan();
      } catch (err) {
        console.error('[Fiddle] refresh scan failed:', err);
      } finally {
        try {
          window.roku.pushFiddleDevices({ devices: buildFiddleDeviceSnapshot() });
        } catch { /* ignore */ }
        try { window.roku.pushFiddleScanStatus({ scanning: false }); } catch { /* ignore */ }
      }
    });
  }
  if (typeof window.roku.onFiddleClearPasswordRequested === 'function') {
    window.roku.onFiddleClearPasswordRequested((payload: { deviceId: string }) => {
      if (!payload || !payload.deviceId) return;
      // Walk the same device pools Fiddle's snapshot draws from (local + remote)
      // so we can wipe the stored password regardless of where the device lives.
      const allDevices: Array<{ ip?: string; serialNumber?: string }> = [
        ...Array.from(state.devices.values()),
        ...Array.from(state.remoteLocations.values()).flatMap((loc: { devices?: Map<string, unknown> }) =>
          loc && loc.devices ? (Array.from(loc.devices.values()) as Array<{ ip?: string; serialNumber?: string }>) : []
        )
      ];
      const device = allDevices.find((d) => getDeviceId(d) === payload.deviceId);
      if (!device) return;
      const key = device.serialNumber || device.ip;
      if (!key) return;
      try {
        removePassword(key);
      } catch (err) {
        console.error('[Fiddle] removePassword failed:', err);
      }
      // Re-push so the Fiddle window sees the now-empty password on its snapshot
      // and prompts the user on the next Run / Stop.
      try {
        if (typeof window.roku.pushFiddleDevices === 'function') {
          window.roku.pushFiddleDevices({ devices: buildFiddleDeviceSnapshot() });
        }
      } catch { /* ignore */ }
    });
  }
  // Push on any device-list change. `renderDeviceList()` itself calls into this.
  (window as unknown as { __rdsFiddlePushDevices?: () => void }).__rdsFiddlePushDevices = () => {
    try {
      if (typeof window.roku.pushFiddleDevices === 'function') {
        window.roku.pushFiddleDevices({ devices: buildFiddleDeviceSnapshot() });
      }
    } catch {
      /* ignore */
    }
  };

  /**
   * Open a Fiddle window with a specific device preselected. Used by the
   * "Open Fiddle" button in the Developer Queries card — when the user
   * launches Fiddle from a device panel, the expectation is that the
   * originating device is already picked in the dropdown.
   *
   * Resolves the device identity by IP (and optionally `isRemote`/`serverUrl`
   * for remote devices that share LAN IP space with a local device). If the
   * device can't be matched to the current Fiddle-eligible snapshot (e.g.
   * developer mode was disabled between the panel loading and the click),
   * falls back to opening Fiddle with no preselection.
   */
  (window as unknown as {
    __rdsOpenFiddleForDevice?: (locator: { ip: string; isRemote?: boolean; serverUrl?: string | null }) => void;
  }).__rdsOpenFiddleForDevice = (locator) => {
    try {
      if (typeof window.roku.openFiddle !== 'function') return;
      const devices = buildFiddleDeviceSnapshot();
      let initialDeviceId: string | null = null;
      if (locator && typeof locator.ip === 'string') {
        const wantRemote = !!locator.isRemote;
        const wantServer = locator.serverUrl || null;
        const match = devices.find((d) => {
          if (d.ip !== locator.ip) return false;
          if (d.isRemote !== wantRemote) return false;
          if (wantRemote && wantServer && d.serverUrl && d.serverUrl !== wantServer) return false;
          return true;
        }) || devices.find((d) => d.ip === locator.ip) || null;
        initialDeviceId = match ? match.id : null;
      }
      window.roku.openFiddle({ devices, initialDeviceId });
    } catch (err) {
      console.warn('[Fiddle] __rdsOpenFiddleForDevice failed:', err);
    }
  };

  // View Logs button (shown when File > Debug Logging is enabled)
  const viewLogsBtn = document.getElementById('viewLogsBtn');
  if (viewLogsBtn) {
    const viewLogsBtnEl = viewLogsBtn;
    function setViewLogsVisibility(enabled) {
      viewLogsBtnEl.style.display = enabled ? 'flex' : 'none';
    }
    window.roku.isDebugEnabled().then(result => {
      setViewLogsVisibility(result.enabled);
    });
    window.roku.onDebugLoggingChanged(setViewLogsVisibility);
    viewLogsBtn.addEventListener('click', async () => {
      const openResult = await window.roku.openLogFile();
      if (!openResult.success) {
        alert('Could not open log file: ' + openResult.error);
      }
    });
  }
  
  // Help modal functionality
  const helpModal = document.getElementById('helpModal');
  const helpModalClose = document.getElementById('helpModalClose');
  const helpOpeners = [document.getElementById('helpBtn'), document.getElementById('titlebarHelpBtn')].filter(
    (el): el is HTMLElement => el instanceof HTMLElement
  );

  if (helpOpeners.length > 0 && helpModal instanceof HTMLElement && helpModalClose instanceof HTMLElement) {
    const openHelp = (e: Event) => {
      const opener = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
      openModalOverlayActiveFromOpener(helpModal, opener);
    };
    helpOpeners.forEach(btn => btn.addEventListener('click', openHelp));

    const closeHelpModal = () => {
      if (!helpModal.classList.contains('active')) return;
      closeModalWithOriginMotion(helpModal, () => {
        helpModal.classList.remove('active');
      });
    };

    helpModalClose.addEventListener('click', closeHelpModal);

    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) closeHelpModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && helpModal.classList.contains('active')) {
        closeHelpModal();
      }
    });

    // Sidebar nav: click scrolls the matching section into view; the scroll
    // position then drives which nav item is highlighted. We use a plain scroll
    // listener (rAF-throttled) instead of IntersectionObserver because the
    // modal starts as `display: none` and IO with a hidden root can miss the
    // first batch of callbacks until something else nudges it.
    const helpNav = document.getElementById('helpNav');
    const helpContent = document.getElementById('helpContent');
    if (helpNav instanceof HTMLElement && helpContent instanceof HTMLElement) {
      const navItems = Array.from(helpNav.querySelectorAll<HTMLElement>('.help-nav-item'));
      const sections = navItems
        .map(btn => btn.dataset.target ? document.getElementById(btn.dataset.target) : null)
        .filter((el): el is HTMLElement => el instanceof HTMLElement);

      const setActive = (targetId: string | null) => {
        if (!targetId) return;
        for (const btn of navItems) {
          const on = btn.dataset.target === targetId;
          btn.classList.toggle('active', on);
          if (on && helpNav.scrollHeight > helpNav.clientHeight) {
            const top = btn.offsetTop;
            const bottom = top + btn.offsetHeight;
            const visibleTop = helpNav.scrollTop;
            const visibleBottom = visibleTop + helpNav.clientHeight;
            if (top < visibleTop) helpNav.scrollTop = top - 8;
            else if (bottom > visibleBottom) helpNav.scrollTop = bottom - helpNav.clientHeight + 8;
          }
        }
      };

      // Pick the section whose top is closest-to-but-not-past the trigger line
      // (a touch below the scroll container's top edge). Falls back to the
      // first section when the user is scrolled all the way up.
      const TRIGGER_OFFSET_PX = 24;
      const updateActiveFromScroll = () => {
        const containerTop = helpContent.getBoundingClientRect().top + TRIGGER_OFFSET_PX;
        let bestId: string | null = null;
        let bestTop = -Infinity;
        for (const section of sections) {
          const top = section.getBoundingClientRect().top;
          if (top <= containerTop && top > bestTop) {
            bestTop = top;
            bestId = section.id;
          }
        }
        if (!bestId && sections[0]) bestId = sections[0].id;
        if (bestId) setActive(bestId);
      };

      let suppressScrollUpdates = false;
      let scrollRaf = 0;
      helpContent.addEventListener('scroll', () => {
        if (suppressScrollUpdates) return;
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0;
          updateActiveFromScroll();
        });
      });

      // Brief flash on the destination so the user can spot where they
      // landed. Toggling the class off → reflow → on lets repeated clicks on
      // the same nav entry retrigger the CSS animation. The flash duration
      // here matches the CSS keyframes (`helpSectionFlash` at 2.4s).
      const FLASH_MS = 2400;
      let flashTimer = 0;
      const flashSection = (section: HTMLElement) => {
        section.classList.remove('is-highlighted');
        void section.offsetWidth;
        section.classList.add('is-highlighted');
        if (flashTimer) window.clearTimeout(flashTimer);
        flashTimer = window.setTimeout(() => {
          section.classList.remove('is-highlighted');
          flashTimer = 0;
        }, FLASH_MS + 100);
      };

      // Smooth-scroll a section into view, then flash *after* the scroll
      // settles. Without this, long jumps would burn most of the flash
      // animation while the viewport is still in motion and the user
      // wouldn't see the highlight by the time they arrived.
      //
      // We rely on the native `scrollend` event when available (Chromium
      // 114+, fully supported in Electron 33). For the "already in view —
      // no scroll happens" case, `scrollend` never fires, so we cap the
      // wait with a fallback timer that flashes anyway.
      let scrollSettleFallback = 0;
      let pendingScrollEnd: (() => void) | null = null;
      const scheduleFlashAfterScroll = (section: HTMLElement) => {
        if (pendingScrollEnd) {
          helpContent.removeEventListener('scrollend', pendingScrollEnd);
          pendingScrollEnd = null;
        }
        if (scrollSettleFallback) {
          window.clearTimeout(scrollSettleFallback);
          scrollSettleFallback = 0;
        }

        const SCROLL_FALLBACK_MS = 800;
        const SETTLE_GRACE_MS = 60;

        const fire = () => {
          if (pendingScrollEnd) {
            helpContent.removeEventListener('scrollend', pendingScrollEnd);
            pendingScrollEnd = null;
          }
          if (scrollSettleFallback) {
            window.clearTimeout(scrollSettleFallback);
            scrollSettleFallback = 0;
          }
          // End the scroll-spy suppression window now that we're settled
          // — the next legitimate user scroll should update the active
          // sidebar entry again.
          suppressScrollUpdates = false;
          flashSection(section);
        };

        pendingScrollEnd = () => {
          // Tiny grace window after `scrollend` fires lets the layout fully
          // settle before we kick off the animation.
          window.setTimeout(fire, SETTLE_GRACE_MS);
        };
        helpContent.addEventListener('scrollend', pendingScrollEnd, { once: true });
        scrollSettleFallback = window.setTimeout(fire, SCROLL_FALLBACK_MS);
      };

      // Click delegation. `e.target` may be the SVG icon (an SVGElement, not
      // HTMLElement), so we walk up via Element.closest to find the button.
      helpNav.addEventListener('click', (e) => {
        const start = e.target instanceof Element ? e.target : null;
        const target = start?.closest<HTMLElement>('.help-nav-item');
        if (!target) return;
        const sectionId = target.dataset.target;
        if (!sectionId) return;
        const section = document.getElementById(sectionId);
        if (!section) return;
        suppressScrollUpdates = true;
        setActive(sectionId);
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        scheduleFlashAfterScroll(section);
      });

      // Reset to the first section every time the modal opens so the user
      // always lands on a predictable starting point.
      const resetToTop = () => {
        helpContent.scrollTop = 0;
        if (navItems[0]?.dataset.target) setActive(navItems[0].dataset.target);
      };
      helpOpeners.forEach(btn => btn.addEventListener('click', resetToTop));
    }
  }
  
  // Dev Mode Instructions modal functionality
  const devModeModal = document.getElementById('devModeModal');
  const devModeModalClose = document.getElementById('devModeModalClose');
  
  if (devModeModal instanceof HTMLElement && devModeModalClose instanceof HTMLElement) {
    const closeDevModeModal = () => {
      if (!devModeModal.classList.contains('active')) return;
      closeModalWithOriginMotion(devModeModal, () => {
        devModeModal.classList.remove('active');
      });
    };

    devModeModalClose.addEventListener('click', closeDevModeModal);

    devModeModal.addEventListener('click', (e) => {
      if (e.target === devModeModal) closeDevModeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && devModeModal.classList.contains('active')) {
        closeDevModeModal();
      }
    });
  }

  // ECP / Control by Mobile Apps Instructions modal
  const ecpModeModal = document.getElementById('ecpModeModal');
  const ecpModeModalClose = document.getElementById('ecpModeModalClose');
  if (ecpModeModal instanceof HTMLElement && ecpModeModalClose instanceof HTMLElement) {
    const closeEcpModeModal = () => {
      if (!ecpModeModal.classList.contains('active')) return;
      closeModalWithOriginMotion(ecpModeModal, () => {
        ecpModeModal.classList.remove('active');
      });
    };

    ecpModeModalClose.addEventListener('click', closeEcpModeModal);
    ecpModeModal.addEventListener('click', (e) => {
      if (e.target === ecpModeModal) closeEcpModeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ecpModeModal.classList.contains('active')) {
        closeEcpModeModal();
      }
    });
  }
  
  devLog('Roku Dev Studio initialized');
}

// ============================================
// Dev Mode Warning Functions (Global Scope)
// ============================================

// Show the Dev Mode Instructions modal (global scope for onclick)
window.showDevModeInstructions = function (opener?: HTMLElement) {
  const modal = document.getElementById('devModeModal');
  if (modal instanceof HTMLElement) {
    openModalOverlayActiveFromOpener(modal, opener ?? null);
  }
};

// Show the ECP / Control by Mobile Apps Instructions modal
window.showEcpModeInstructions = function (opener?: HTMLElement) {
  const modal = document.getElementById('ecpModeModal');
  if (modal instanceof HTMLElement) {
    openModalOverlayActiveFromOpener(modal, opener ?? null);
  }
};

// Event delegation for dev mode warning buttons (works with cloned template content)
document.addEventListener('click', function (e) {
  const t = e.target;
  if (!(t instanceof Element)) return;
  const btn = t.closest('.dev-mode-warning-btn');
  if (btn) {
    e.preventDefault();
    window.showDevModeInstructions?.(btn instanceof HTMLElement ? btn : undefined);
  }
  const ecpBtn = t.closest('.ecp-mode-warning-btn');
  if (ecpBtn) {
    e.preventDefault();
    window.showEcpModeInstructions?.(ecpBtn instanceof HTMLElement ? ecpBtn : undefined);
  }
});

// Update dev mode warnings for a device panel
function updateDevModeWarnings(panel, isDeveloperEnabled) {
  const warnings = panel.querySelectorAll('.dev-mode-warning');
  warnings.forEach(warning => {
    if (isDeveloperEnabled) {
      warning.classList.remove('visible');
    } else {
      warning.classList.add('visible');
    }
  });
  // The Developer Queries "Open Fiddle" button only makes sense when the
  // device is dev-enabled (Fiddle can't sideload anywhere else, and the
  // Fiddle dropdown explicitly filters non-dev devices out). Hide it
  // alongside toggling the warning so the card header stays consistent.
  const fiddleBtns = panel.querySelectorAll('.open-fiddle-btn');
  fiddleBtns.forEach(btn => {
    (btn as HTMLElement).hidden = !isDeveloperEnabled;
  });
}

// ECP mode: one of Disabled, Limited, Permissive, Enabled (backend normalizes; renderer treats unknown as Disabled)
function getEcpMode(device) {
  const mode = (device && device.ecpSettingMode != null) ? String(device.ecpSettingMode).trim() : '';
  const lower = mode.toLowerCase();
  if (lower === 'disabled') return 'Disabled';
  if (lower === 'limited') return 'Limited';
  if (lower === 'permissive') return 'Permissive';
  if (lower === 'enabled') return 'Enabled';
  return 'Disabled';
}

function canSendText(device) {
  const m = getEcpMode(device);
  return m === 'Limited' || m === 'Permissive' || m === 'Enabled';
}

function canLaunchApps(device) {
  const m = getEcpMode(device);
  return m === 'Limited' || m === 'Permissive' || m === 'Enabled';
}

function canQueryActiveApp(device) {
  const m = getEcpMode(device);
  return m === 'Limited' || m === 'Permissive' || m === 'Enabled';
}

function canUseFullRemoteKeypress(device) {
  const m = getEcpMode(device);
  return m === 'Permissive' || m === 'Enabled';
}

// True when full remote (keypress, etc.) is available. Kept for backward compatibility.
function isEcpEnabled(device) {
  return canUseFullRemoteKeypress(device);
}

// Permissive mode accepts commands only from same subnet; device.sameSubnet is set by main when fetching device info.
function isPermissiveSameSubnet(device) {
  if (getEcpMode(device) !== 'Permissive') return true;
  return device.sameSubnet === true;
}

// Update ECP / Control by Mobile Apps warnings for a device panel (mode-aware messages and visibility)
function updateEcpWarnings(panel, device) {
  const mode = getEcpMode(device);
  const warnings = panel.querySelectorAll('.ecp-mode-warning');
  const showSubnetWarning = mode === 'Permissive' && device.sameSubnet === false;
  warnings.forEach(warning => {
    const titleEl = warning.querySelector('.ecp-mode-warning-title');
    const descEl = warning.querySelector('.ecp-mode-warning-desc');
    const subnetNote = warning.querySelector('.ecp-mode-subnet-note');
    if (mode === 'Disabled') {
      warning.classList.add('visible');
      warning.dataset.ecpVariant = 'disabled';
      if (titleEl) titleEl.textContent = 'Control by Mobile Apps Disabled';
      if (descEl) setSafeHTML(descEl, 'Remote control is off. Enable "Control by Mobile Apps" → Network Access on your Roku device to use remote, apps, and text input.');
      if (subnetNote) subnetNote.classList.remove('visible');
    } else if (mode === 'Limited') {
      warning.classList.add('visible');
      warning.dataset.ecpVariant = 'limited';
      if (titleEl) titleEl.textContent = 'Control by Mobile Apps: Limited';
      if (descEl) setSafeHTML(descEl, 'Text input, app launch, and app query work. Full remote keypress may not be available—set Network Access to <strong>Permissive</strong> or <strong>Enabled</strong> for full remote.');
      if (subnetNote) subnetNote.classList.remove('visible');
    } else if (mode === 'Permissive' || mode === 'Enabled') {
      if (showSubnetWarning) {
        warning.classList.add('visible');
        warning.dataset.ecpVariant = 'subnet';
        if (titleEl) titleEl.textContent = 'Permissive: Check Network';
        if (descEl) descEl.textContent = 'Permissive mode accepts commands only from the same subnet. Your machine may be on a different subnet; if commands fail, check your network.';
        if (subnetNote) subnetNote.classList.add('visible');
      } else {
        warning.classList.remove('visible');
        if (subnetNote) subnetNote.classList.remove('visible');
      }
    } else {
      warning.classList.remove('visible');
      if (subnetNote) subnetNote.classList.remove('visible');
    }
  });
  panel.dataset.ecpMode = mode;
}

// ============================================
// Integration Guide Functions (Global Scope)
// ============================================

// Open the integration guide modal (if present)
window.toggleIntegrationGuide = function () {
  const modal = document.getElementById('integrationGuideModal');
  if (modal instanceof HTMLElement) {
    openModalOverlayActiveFromOpener(modal, null, () => {
      modal.setAttribute('aria-hidden', 'false');
    });
  }
};

// Save TrackerTask.xml file
window.saveTrackerTask = async function() {
  try {
    // Request the TrackerTask content from main process
    const result = await window.roku.saveTrackerTask();
    if (result.success) {
      showToast('TrackerTask.xml saved successfully!', 'success');
    } else {
      showToast('Failed to save TrackerTask.xml: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    console.error('Error saving TrackerTask:', err);
    showToast('Error saving TrackerTask: ' + errMessage(err), 'error');
  }
};

// Copy integration information to clipboard
window.copyTrackerTaskInfo = function() {
  const integrationInfo = `
=== App Connector Integration Guide ===

1. ADD TO YOUR MainScene.xml INTERFACE:
----------------------------------------
<component name="MainScene" extends="Scene">
    <interface>
        <!-- Required for App Connector -->
        <function name="GetExternalControlFunctions" />
        <function name="ExecuteFunction" />
    </interface>
    <script type="text/brightscript" uri="MainScene.brs" />
</component>

2. IMPLEMENT GetExternalControlFunctions IN MainScene.brs:
----------------------------------------------------------
Function GetExternalControlFunctions(args) as Object
    return [
        {
            name: "YourFunctionName",
            description: "Description of what it does",
            params: [
                { name: "paramName", type: "String" }
            ]
        }
    ]
End Function

3. IMPLEMENT ExecuteFunction IN MainScene.brs:
----------------------------------------------
Function ExecuteFunction(functionName as String, params as Object) as Object
    result = invalid

    if functionName = "YourFunctionName" then
        result = YourFunctionName(params[0])
    end if

    return result
End Function

4. SUPPORTED PARAMETER TYPES:
-----------------------------
Boolean, Integer, LongInteger, Float, Double, String, 
roAssociativeArray, roArray, roList

5. INITIALIZE TrackerTask IN MainScene.brs init():
--------------------------------------------------
Sub init()
    ' Initialize TrackerTask for App Connector
    m.trackerTask = CreateObject("roSGNode", "TrackerTask")
    m.trackerTask.control = "run"

    ' Your other initialization code...
End Sub

=== End of Integration Guide ===
`.trim();

  navigator.clipboard.writeText(integrationInfo).then(() => {
    showToast('Integration info copied to clipboard!', 'success');
  }).catch(err => {
    console.error('Failed to copy:', err);
    showToast('Failed to copy to clipboard', 'error');
  });
};

// showToast is now imported from modules/utils/ui.js

// Start the app when DOM is ready
function runInit() {
  registerMcpConnectFlow();
  ensureMcpStoredPasswordBridge();
  ensureMcpAgentScreenshotBridge();
  onMcpAgentAction((payload) => {
    if (!payload || typeof payload.summary !== 'string' || !payload.summary) return;
    const variant = payload.level === 'destructive' ? 'warning' : 'info';
    showToast(payload.summary, variant);
  });
  init().catch((err) => {
    console.error('App init failed:', err);
    alert('App initialization failed: ' + errMessage(err));
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInit);
} else {
  runInit();
}

} catch (err) {
  console.error('=== FATAL ERROR IN APP.JS ===', err);
  alert('App initialization failed: ' + errMessage(err));
}

// Roku Dev Studio - Renderer Process
// Handles device discovery, tab management, and multi-device control

// Import modules
import {
  escapeHtml,
  decodeHtmlEntities,
  icon,
  setSafeHTML,
  setDynamicText,
  setDynamicHTML,
  getStoredPassword,
  setCachedPassword,
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
  NETWORK_INSPECTOR_ENABLED,
  QUERY_ENDPOINTS
} from './modules/index.js';
import { errMessage } from '@shared/platform/err-util.js';
        <span class="value device-serial" data-serial="${escapeHtml(device.serialNumber || '')}">${escapeHtml(device.serialNumber || S.app.notAvailable)}</span>
      </div>
      ${device.softwareVersion ? `
      <div class="device-detail">
        <span class="label">${S.app.labelSw}</span>
        <span class="value">${escapeHtml(device.softwareVersion)}${escapeHtml(softwareBuild)}</span>
      </div>
      ` : ''}
    </div>
    <div class="device-actions">
      <button class="connect-btn${isConnected ? ' connected' : ''}">
        ${isConnected ? S.common.disconnect : S.common.connect}
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
    toggleBtn.title = nowMinimized ? S.app.expand : S.app.minimize;
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
      rendererError('Cannot connect to remote device: location not found', locationId);
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
    tabName.title = S.app.atLocation(device.deviceName, location?.name || S.app.remote);
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
  
  // Update Remote Locations list
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
  return deviceKey({ serial: device.serialNumber, ip: device.ip });
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
    rendererError('[Auto-connect] Failed to update remembered device list:', e);
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
    rendererError('[Auto-connect] Failed to remove from remembered device list:', e);
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
    showToast(S.app.connectedAutomatically(singleLabel), 'success');
  } else if (count > 1) {
    showToast(S.app.connectedMultipleAutomatically(count), 'success');
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
    showToast(S.app.connectedAutomatically(singleLabel), 'success');
  } else if (count > 1) {
    showToast(S.app.connectedMultipleAutomatically(count), 'success');
  }
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
    rendererError('Discovery error:', error);
  }

  const shouldSubnetScan = state.devices.size === 0 || NETWORK_INSPECTOR_ENABLED;
  if (shouldSubnetScan) {
    // Keep the button label as a single "Scanning..." for the whole operation; the SSDP →
    // subnet-sweep phase distinction is dev-only noise, so it lives in devLog (dev/debug mode),
    // not the UI.
    devLog(
      state.devices.size === 0
        ? 'Scan phase: SSDP found no devices, running subnet sweep...'
        : 'Scan phase: Network Inspector enabled — subnet sweep includes hotspot subnet when active...'
    );
    try {
      const subnetResult = await window.roku.scanSubnet();
      devLog('Subnet scan result:', subnetResult.success, 'devices:', subnetResult.devices?.length);

      if (subnetResult.success && subnetResult.devices.length > 0) {
        subnetResult.devices.forEach(device => addDiscoveredDevice(device));
      }
    } catch (error) {
      rendererError('Subnet scan error:', error);
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
    rendererError('Error updating scan button:', err);
  }

  try {
    await executeLocalDiscoveryScan();
  } catch (error) {
    rendererError('Discovery error:', error);
  }

  state.isScanning = false;
  try {
    updateScanButton(false);
    renderDeviceList();
  } catch (err) {
    rendererError('Error after scan:', err);
  }

  startupLocalScanComplete = true;
  void onStartupScansReady();
}

/** User-initiated scan: local network + all configured Remote Locations, then remembered-device auto-connect. */
async function runFullUserScan() {
  devLog('runFullUserScan called, isScanning:', state.isScanning);
  if (state.isScanning) return;

  state.isScanning = true;
  try {
    updateScanButton(true);
  } catch (err) {
    rendererError('Error updating scan button:', err);
  }

  try {
    const localPromise = executeLocalDiscoveryScan();
    const remotePromise =
      state.remoteLocations.size > 0
        ? refreshAllRemoteLocations({ notifyStartup: false })
        : Promise.resolve();
    await Promise.all([localPromise, remotePromise]);
  } catch (error) {
    rendererError('Full scan error:', error);
  }

  state.isScanning = false;
  try {
    updateScanButton(false);
    renderDeviceList();
  } catch (err) {
    rendererError('Error after full scan:', err);
  }

  await tryAutoConnectRememberedMatchesAfterUserScan();
}

/**
 * User-initiated scan scoped to the Local Devices section only — does NOT
 * touch Remote Locations. Each remote location card has its own per-location
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
    rendererError('Error updating scan button:', err);
  }

  try {
    await executeLocalDiscoveryScan();
  } catch (error) {
    rendererError('Local scan error:', error);
  }

  state.isScanning = false;
  try {
    updateScanButton(false);
    renderDeviceList();
  } catch (err) {
    rendererError('Error after local scan:', err);
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
      const oldIp = existingByKey.ip;
      existingByKey.ip = device.ip;
      existingByKey.port = device.port;
      Object.assign(existingByKey, device);
      reconcileConnectedDeviceIp(oldIp, device);
    } else {
      Object.assign(existingByKey, device);
    }
    try {
      renderDeviceList();
    } catch (err) {
      rendererError('Error rendering device list:', err);
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
        if (nameEl) nameEl.textContent = device.deviceName || device.modelName || S.app.unknownRoku;
      }
      // Update panel: device name, IP, icon, and ECP/Dev Mode warnings
      const panel = document.getElementById(connection.tabId);
      if (panel) {
        const nameText = panel.querySelector('.panel-device-name-text');
        const ipEl = panel.querySelector('.device-ip');
        const iconEl = panel.querySelector('.device-panel-icon');
        setDynamicText(nameText, device.deviceName || device.modelName || S.app.unknownRoku);
        setDynamicText(ipEl, device.ip);
        if (iconEl) {
          setDevicePanelIcon(iconEl, device, { isRemote: false });
        }
        // Name/IP width may have changed — re-measure the responsive header.
        panel._headerResponsiveRemeasure?.();
        updateEcpWarnings(panel, device);
        updateDevModeWarnings(panel, device.developerEnabled === true);
      }
    }
    try {
      renderDeviceList();
    } catch (err) {
      rendererError('Error rendering device list:', err);
    }
    return;
  }
  
  // New device - add it
  devLog('[Local Discovery] Adding new device:', deviceId);
  state.devices.set(deviceId, device);
  try {
    renderDeviceList();
  } catch (err) {
    rendererError('Error rendering device list:', err);
  }
}

// Update scan button state (sidebar + title bar)
function updateScanButton(scanning) {
  if (elements.scanBtn) {
    elements.scanBtn.classList.toggle('scanning', scanning);
    const scanIcon = elements.scanBtn.querySelector('.scan-icon');
    const scanText = elements.scanBtn.querySelector('.scan-text');

    if (scanText) {
      scanText.textContent = scanning ? S.common.scanning : S.app.scan;
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
      tText.textContent = scanning ? S.common.scanning : S.app.scan;
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
    deviceCountEl.textContent = S.app.deviceCount(devices.length);
  }
  
  const localDevicesList = document.getElementById('localDevicesList');
  const localEmptyState = document.getElementById('localEmptyState');
  
  if (!localDevicesList) {
    rendererError('localDevicesList not found');
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
      rendererError('Error creating device card:', err);
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
    ? `<span class="dev-badge enabled">${icon('wrench', 'icon-xs')} ${S.app.devBadge}</span>`
    : '';
  const ecpMode = getEcpMode(device);
  const ecpBadge = ecpMode === 'Disabled'
    ? `<span class="ecp-badge" title="${S.app.ecpBadgeDisabledTitle}">${icon('tv', 'icon-xs')} ${S.app.remoteOff}</span>`
    : ecpMode === 'Limited'
      ? `<span class="ecp-badge ecp-badge-limited" title="${S.app.ecpBadgeLimitedTitle}">${icon('tv', 'icon-xs')} ${S.app.ecpLimited}</span>`
      : '';
  const deviceType = isTv ? `${icon('tv', 'icon-sm')} ${S.app.deviceTypeTv}` : `${icon('stb', 'icon-sm')} ${S.app.deviceTypeStb}`;
  
  setSafeHTML(card, `
    <div class="device-card-header">
      <div class="device-card-header-left">
        <div class="device-card-thumb"></div>
        <div class="device-card-title-col">
          <div class="device-name">
            ${isConnected ? '<span class="status-dot"></span>' : ''}
            ${escapeHtml(device.deviceName || device.modelName || S.app.unknownRoku)}
          </div>
        </div>
      </div>
      <div class="device-card-header-right">
        ${ecpBadge}
        ${devBadge}
        <button class="device-toggle-btn" title="${isMinimized ? S.app.expand : S.app.minimize}">
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
        <span class="label">${S.app.labelType}</span>
        <span class="value">${deviceType}</span>
      </div>
      <div class="device-detail">
        <span class="label">${S.app.labelIp}</span>
        <span class="value device-ip">${escapeHtml(device.ip)}</span>
      </div>
      <div class="device-detail">
        <span class="label">${S.app.labelModel}</span>
        <span class="value">${escapeHtml(device.modelNumber || S.app.notAvailable)}</span>
      </div>
      <div class="device-detail">
        <span class="label">${S.app.labelSerial}</span>
        <span class="value device-serial" data-serial="${escapeHtml(device.serialNumber || '')}">${escapeHtml(device.serialNumber || S.app.notAvailable)}</span>
      </div>
      ${device.softwareVersion ? `
      <div class="device-detail">
        <span class="label">${S.app.labelSw}</span>
        <span class="value">${escapeHtml(device.softwareVersion)}${escapeHtml(softwareBuild)}</span>
      </div>
      ` : ''}
    </div>
    <div class="device-actions">
      <button class="connect-btn${isConnected ? ' connected' : ''}">
        ${isConnected ? S.common.disconnect : S.common.connect}
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
    toggleBtn.title = nowMinimized ? S.app.expand : S.app.minimize;
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
    { label: S.app.copyDeviceName, action: 'copy', value: device.deviceName },
    { label: S.app.copyIpAddress, action: 'copy', value: device.ip },
    { label: S.app.copyModelNumber, action: 'copy', value: device.modelNumber },
    { label: S.app.copySerialNumber, action: 'copy', value: device.serialNumber },
    { type: 'separator' },
    { label: S.app.copyAllDetails, action: 'copy', value: formatDeviceDetails(device) }
  ];
  
  await window.roku.showContextMenu(items);
}

function formatDeviceDetails(device) {
  return S.app.deviceDetails(device);
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
    if (panel._headerResponsiveCleanup) {
      panel._headerResponsiveCleanup();
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

  // Tear down the Network Inspector controller: clears its 2s poll interval, debounce
  // timers, rAF, and all DOM listeners (via AbortController), then drops the buffered
  // events so a closed tab can't keep merging pushed capture events into dead state.
  const networkCtrl = networkTabControllers.get(tabId);
  if (networkCtrl) {
    try { networkCtrl.destroy?.(); } catch (_) {}
    networkTabControllers.delete(tabId);
    mitmRevealedTabIds.delete(tabId);
    syncNetworkTabMultiDevice();
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
  
  // Update Remote Locations if this was a remote device
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
  // Stashed for the hover popup (Safari/Chrome-style) — the tab label itself is
  // truncated, so the full name/IP/model are surfaced on hover instead.
  tab.dataset.deviceName = device.deviceName || device.modelName || S.app.unknownRoku;
  if (device.modelName) tab.dataset.modelName = device.modelName;
  if (device.modelNumber) tab.dataset.modelNumber = device.modelNumber;

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

  tab.addEventListener('mouseenter', () => scheduleTabHoverTooltip(tab));
  tab.addEventListener('mouseleave', () => hideTabHoverTooltip());
  tab.addEventListener('mousedown', () => hideTabHoverTooltip());

  return tab;
}

// ---- Tab hover popup (Safari/Chrome-style device info on tab hover) ----

let tabHoverTooltipEl: HTMLElement | null = null;
let tabHoverTooltipTimer: ReturnType<typeof setTimeout> | null = null;

function getTabHoverTooltip(): HTMLElement {
  if (tabHoverTooltipEl) return tabHoverTooltipEl;
  const el = document.createElement('div');
  el.className = 'tab-hover-tooltip';
  el.setAttribute('role', 'tooltip');
  document.body.appendChild(el);
  tabHoverTooltipEl = el;
  return el;
}

function hideTabHoverTooltip() {
  if (tabHoverTooltipTimer) {
    clearTimeout(tabHoverTooltipTimer);
    tabHoverTooltipTimer = null;
  }
  if (tabHoverTooltipEl) tabHoverTooltipEl.classList.remove('visible');
}

function scheduleTabHoverTooltip(tab: HTMLElement) {
  if (tabHoverTooltipTimer) clearTimeout(tabHoverTooltipTimer);
  tabHoverTooltipTimer = setTimeout(() => showTabHoverTooltip(tab), 400);
}

function showTabHoverTooltip(tab: HTMLElement) {
  if (!tab.isConnected) return;
  const name = tab.dataset.deviceName || '';
  const ip = tab.dataset.ip || '';
  const modelName = (tab.dataset.modelName || '').trim();
  const modelNumber = (tab.dataset.modelNumber || '').trim();
  const modelParts: string[] = [];
  if (modelName) modelParts.push(modelName);
  if (modelNumber && modelNumber !== modelName) modelParts.push(modelNumber);
  const modelStr = modelParts.join(' · ');

  const tip = getTabHoverTooltip();
  let html = `<div class="tab-hover-tooltip-name">${escapeHtml(name)}</div>`;
  if (ip) {
    html +=
      `<div class="tab-hover-tooltip-row">` +
      `<span class="status-dot" aria-hidden="true"></span>` +
      `<span class="tab-hover-tooltip-ip device-ip">${escapeHtml(ip)}</span></div>`;
  }
  if (modelStr) {
    html += `<div class="tab-hover-tooltip-model">${escapeHtml(modelStr)}</div>`;
  }
  // Unseen debug stop on this device (set by the cross-tab stop alert).
  const debugStop = tab.dataset.debugStop;
  if (debugStop) {
    html += `<div class="tab-hover-tooltip-stop">${escapeHtml(S.debugger.stoppedTabTooltip(debugStop === '1' ? '' : debugStop))}</div>`;
  }
  setSafeHTML(tip, html);

  // Show first (so we can measure), then clamp within the viewport.
  tip.classList.add('visible');
  const rect = tab.getBoundingClientRect();
  const margin = 8;
  const tipRect = tip.getBoundingClientRect();
  let left = rect.left;
  if (left + tipRect.width > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - margin - tipRect.width);
  }
  const top = rect.bottom + 6;
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

// Section-selector (inner-tab) hover tooltip — only meaningful in icon-only
// mode, where the label is hidden. Reuses the shared tooltip element/timer so
// the section tabs and the device tabs feel identical (and only one shows at a
// time). Prefer this over the native `title` (instant, styled, consistent).
function scheduleSectionTabTooltip(tab: HTMLElement) {
  if (tabHoverTooltipTimer) clearTimeout(tabHoverTooltipTimer);
  tabHoverTooltipTimer = setTimeout(() => showSectionTabTooltip(tab), 300);
}

function showSectionTabTooltip(tab: HTMLElement) {
  if (!tab.isConnected) return;
  const label =
    tab.querySelector('.inner-tab-label')?.textContent?.trim() ||
    tab.getAttribute('aria-label') ||
    '';
  if (!label) return;

  const tip = getTabHoverTooltip();
  setSafeHTML(tip, `<div class="tab-hover-tooltip-name">${escapeHtml(label)}</div>`);
  tip.classList.add('visible');

  // Center under the tab, clamped to the viewport.
  const rect = tab.getBoundingClientRect();
  const margin = 8;
  const tipRect = tip.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - margin - tipRect.width));
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(rect.bottom + 6)}px`;
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
    // Landing on a device whose Console is the active section counts as acknowledging any
    // unseen debug stop — clear its tab dot + Console pulse.
    if (panel.querySelector('.inner-tab[data-inner-tab="telnet"]')?.classList.contains('active')) {
      clearDebugStopForPanel(panel);
    }
    
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
  refreshFloatingRemote();
}

function updateTabBarVisibility() {
  const onHome = !state.activeTabId;
  const noDevices = state.connectedDevices.size === 0;
  elements.tabBar.classList.toggle('hidden', onHome && noDevices);
  updateTitlebarFloatingRemoteVisibility();
}

/**
 * The title-bar Floating Remote toggle is only meaningful once at least one
 * device is connected — otherwise there's nothing to drive. Hide it on the
 * Home view to keep the title bar uncluttered, and re-evaluate the floater
 * itself (which also force-hides when no device is connected).
 */
function updateTitlebarFloatingRemoteVisibility() {
  const btn = document.getElementById('titlebarFloatingRemoteBtn');
  if (!(btn instanceof HTMLElement)) return;
  const hasConnected = state.connectedDevices.size > 0;
  btn.hidden = !hasConnected;
  // When the last device disconnects mid-session, ask the manager to
  // re-evaluate so the floater hides immediately even if the user had it on.
  if (!hasConnected) {
    refreshFloatingRemote();
  }
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
        rendererError('Remote check error:', err);
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
    rendererError('Connection check failed for', ip, ':', error);
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
          connectBtn.textContent = S.app.reconnect;
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
          connectBtn.textContent = S.common.disconnect;
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
          panelDot.title = S.app.deviceOffline;
          panelDot.setAttribute('aria-label', S.app.deviceOffline);
        } else {
          panelDot.style.background = 'var(--accent-green)';
          panelDot.style.animation = 'pulse 2s ease-in-out infinite';
          panelDot.title = S.common.connected;
          panelDot.setAttribute('aria-label', S.common.connected);
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
              <h3>${S.app.deviceOffline}</h3>
              <p>${S.app.unableToConnectDevice}</p>
              <button class="btn btn-primary retry-connection-btn">${icon('refresh', 'icon-xs')} ${S.app.retryConnection}</button>
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
 * Screen size for the hardware image modal footer — shown only when the device
 * reports `is-tv` true and a `screen-size` value. Roku's ECP `screen-size` is a
 * bare inch count (e.g. "65"), so append a quote mark; a non-numeric value is
 * shown verbatim. Returns null otherwise.
 * @param {object} device
 * @returns {string | null}
 */
function getDeviceHardwareImageModalScreenSize(device) {
  if (!device || device.isTv !== true) return null;
  const raw = String(device.screenSize || '').trim();
  if (!raw) return null;
  return /^\d+$/.test(raw) ? `${raw}"` : raw;
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
    S.app.deviceImageAria(device.deviceName || device.modelName || S.app.rokuDevice)
  );

  const header = document.createElement('div');
  header.className = 'device-hardware-image-modal-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'device-hardware-image-modal-title-group';

  const titleEl = document.createElement('span');
  titleEl.className = 'device-hardware-image-modal-title';
  titleEl.textContent = device.deviceName || device.modelName || S.app.rokuDevice;
  titleGroup.appendChild(titleEl);

  const ip = typeof device.ip === 'string' ? device.ip.trim() : '';
  if (ip) {
    const ipRow = document.createElement('div');
    ipRow.className = 'device-hardware-image-modal-ip-row';
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    dot.title = S.common.connected;
    dot.setAttribute('aria-label', S.common.connected);
    const ipEl = document.createElement('span');
    ipEl.className = 'device-ip';
    ipEl.textContent = ip;
    ipRow.appendChild(dot);
    ipRow.appendChild(ipEl);
    titleGroup.appendChild(ipRow);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close device-hardware-image-modal-close';
  closeBtn.setAttribute('aria-label', S.common.close);
  setSafeHTML(closeBtn, icon('x', 'icon-sm'));

  const body = document.createElement('div');
  body.className = 'device-hardware-image-modal-body';

  const img = document.createElement('img');
  img.className = 'device-hardware-image-modal-img';
  img.src = imageSrc;
  img.alt = '';

  header.appendChild(titleGroup);
  header.appendChild(closeBtn);
  body.appendChild(img);
  modal.appendChild(header);
  modal.appendChild(body);

  const footerItems: Array<{ label: string; value: string; end?: boolean }> = [];
  const footerModel = getDeviceHardwareImageModalFooterModel(device);
  if (footerModel) footerItems.push({ label: S.app.labelModel, value: footerModel });
  const screenSize = getDeviceHardwareImageModalScreenSize(device);
  // Right-align Screen Size to the far edge of the footer (only meaningful when
  // Model is also present; on its own it just sits at the start).
  if (screenSize) footerItems.push({ label: S.app.labelScreenSize, value: screenSize, end: footerItems.length > 0 });
  if (footerItems.length) {
    const footer = document.createElement('div');
    footer.className = 'device-hardware-image-modal-footer';
    for (const item of footerItems) {
      const cell = document.createElement('div');
      cell.className = 'device-hardware-image-modal-footer-item';
      if (item.end) cell.classList.add('device-hardware-image-modal-footer-item--end');
      const label = document.createElement('span');
      label.className = 'device-hardware-image-modal-footer-label';
      label.textContent = item.label;
      const value = document.createElement('div');
      value.className = 'device-hardware-image-modal-footer-value';
      value.textContent = item.value;
      cell.appendChild(label);
      cell.appendChild(value);
      footer.appendChild(cell);
    }
    modal.appendChild(footer);
  }

  // ── Software version + device actions ────────────────────────────────────
  // A second footer row: software/OS version on the left, and two stacked
  // buttons on the right (Check for Updates, Restart Device). Both actions post
  // to the device's Developer Application Installer (plugin_swup) via the
  // preload bridge and need the stored developer password.
  {
    const actions = document.createElement('div');
    actions.className = 'device-hardware-image-modal-actions';

    const swCell = document.createElement('div');
    swCell.className = 'device-hardware-image-modal-footer-item';
    const swLabel = document.createElement('span');
    swLabel.className = 'device-hardware-image-modal-footer-label';
    swLabel.textContent = S.app.labelOsVersionBuild;
    const swValue = document.createElement('div');
    swValue.className = 'device-hardware-image-modal-footer-value';
    const swVersion = typeof device.softwareVersion === 'string' ? device.softwareVersion.trim() : '';
    const swBuild = typeof device.softwareBuild === 'string' ? device.softwareBuild.trim() : '';
    swValue.textContent = swVersion ? `${swVersion}${swBuild ? ` (${swBuild})` : ''}` : S.app.unknown;
    swCell.appendChild(swLabel);
    swCell.appendChild(swValue);

    const leftCol = document.createElement('div');
    leftCol.className = 'device-hardware-image-modal-actions-left';

    // Icon-only buttons; the label lives in the native tooltip + aria-label.
    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'btn btn-secondary device-hardware-image-modal-action-btn';
    checkBtn.title = S.app.checkForUpdates;
    checkBtn.setAttribute('aria-label', S.app.checkForUpdates);
    setSafeHTML(checkBtn, icon('refresh', 'icon-md'));

    const restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'btn btn-secondary device-hardware-image-modal-action-btn';
    restartBtn.title = S.app.restartDevice;
    restartBtn.setAttribute('aria-label', S.app.restartDevice);
    setSafeHTML(restartBtn, icon('replay', 'icon-md'));

    const checkSlot = document.createElement('div');
    checkSlot.className = 'device-hardware-image-modal-update-slot';
    checkSlot.appendChild(checkBtn);

    const rightCol = document.createElement('div');
    rightCol.className = 'device-hardware-image-modal-actions-right';
    rightCol.appendChild(restartBtn);

    leftCol.appendChild(swCell);
    leftCol.appendChild(checkSlot);
    actions.appendChild(leftCol);
    actions.appendChild(rightCol);
    modal.appendChild(actions);

    const actionIp = typeof device.ip === 'string' ? device.ip.trim() : '';
    const serial =
      device.serialNumber != null ? String(device.serialNumber).trim() : '';
    const getPwd = () => (serial ? getStoredPassword(serial) || '' : '');

    const runAction = async (
      btn: HTMLButtonElement,
      label: string,
      fn: (ip: string, password: string) => Promise<{ success?: boolean; message?: string; error?: string } | undefined>
    ) => {
      if (!actionIp) {
        showToast(S.app.deviceIpUnavailable, 'error');
        return;
      }
      const pwd = getPwd();
      if (!pwd) {
        showToast(S.app.setDevPasswordFirst, 'error');
        return;
      }
      checkBtn.disabled = true;
      restartBtn.disabled = true;
      btn.classList.add('is-busy');
      try {
        const res = await fn(actionIp, pwd);
        if (res && res.success) {
          showToast(res.message || S.app.actionSucceeded(label), 'success');
        } else {
          showToast((res && res.error) || S.app.actionFailed(label), 'error');
        }
      } catch (err) {
        showToast(S.app.actionFailedWith(label, errMessage(err)), 'error');
      } finally {
        checkBtn.disabled = false;
        restartBtn.disabled = false;
        btn.classList.remove('is-busy');
      }
    };

    checkBtn.addEventListener('click', () =>
      runAction(checkBtn, S.app.checkForUpdatesLabel, (ip, pwd) => window.roku.checkForUpdate(ip, pwd))
    );
    restartBtn.addEventListener('click', () =>
      runAction(restartBtn, S.app.restartDeviceLabel, (ip, pwd) => window.roku.reboot(ip, pwd))
    );
  }

  overlay.appendChild(modal);
  prepareModalOpenOrigin(overlay, opener ?? null);
  document.body.appendChild(overlay);
  overlay.classList.add('active');
  overlay.classList.add('modal-motion-enabled');
  playModalOpenMotion(overlay);

  let detachEsc = () => {};
  const teardown = () => {
    overlay.remove();
    detachEsc();
  };

  const requestClose = () => {
    closeModalWithOriginMotion(overlay, teardown);
  };

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    requestClose();
  });
  // Backdrop click-to-close, mousedown-gated so a text selection inside the
  // dialog body that ends on the backdrop doesn't dismiss the modal.
  attachBackdropClickToClose(overlay, requestClose);
  detachEsc = attachEscToClose(requestClose);
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
    S.app.viewLargerImage(device.deviceName || device.modelName || S.app.rokuDevice)
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

/**
 * Responsive device-panel header. Keeps the section selector (inner tabs)
 * horizontally centered in the *header* (not just the leftover space beside the
 * device info) and, as the header narrows, degrades gracefully through this
 * priority ladder — each rung only used when the previous doesn't fit:
 *
 *   0. device info shown  + full-size tabs
 *   1. device info HIDDEN  + full-size tabs   (name/IP live in the image modal)
 *   2. device info hidden  + compact tabs      (tighter padding/font/gap)
 *   3. device info hidden  + icon-only tabs     (labels move to a hover tooltip)
 *
 * Centering is handled by the CSS (header is a `1fr auto 1fr` grid, so the
 * center tab strip is always horizontally centered in the header). The right
 * column (Device Performance strip / "paused" banner) truncates to fit its
 * track, yielding space to the tabs, with the full text in a tooltip.
 *
 * This controller only decides the tab rung. The section selector has priority:
 * it stays full while each side track can still hold its need — the left block's
 * info (or, once hidden, the icon) and a small reserved floor for the right
 * block (RIGHT_FLOOR). Because the grid centers, both side tracks are equal, so
 * the fit budget is H − 2·max(leftNeed, rightReserve) − 2·gap. The perf block
 * then shrinks into whatever the right track gives it (≥ RIGHT_FLOOR).
 *
 * Hysteresis: rungs downgrade the moment the current one stops fitting, but only
 * upgrade once the lower rung fits with HYST px of slack — so dragging the
 * window slowly across a boundary can't flip-flop.
 *
 * Loop-safety: header width is fixed by the outer layout and is independent of
 * our class toggles (they change the center/side content, not the header's own
 * width); the cached natural widths don't depend on our toggles; and every class
 * write is guarded to fire only on an actual change, so apply() is idempotent
 * and can't drive the observers in a loop. Observers are disconnected on tab
 * close via panel._headerResponsiveCleanup (see disconnectDevice).
 */
function setupDevicePanelHeaderResponsive(panel) {
  const header = panel.querySelector('.device-panel-header');
  const left = panel.querySelector('.device-panel-left');
  const right = panel.querySelector('.device-panel-right');
  const nav = panel.querySelector('.device-panel-nav');
  const info = panel.querySelector('.device-panel-info');
  const innerTabs = panel.querySelector('.inner-tabs');
  if (
    !(header instanceof HTMLElement) ||
    !(left instanceof HTMLElement) ||
    !(nav instanceof HTMLElement) ||
    !(innerTabs instanceof HTMLElement)
  ) {
    return;
  }

  // Read the header column gap from CSS so the JS math can't silently drift if
  // the stylesheet gap changes.
  const parsedGap = parseFloat(getComputedStyle(header).columnGap || '');
  const GAP = Number.isFinite(parsedGap) ? parsedGap : 16;
  const HYST = 16; // px dead-band to keep rung boundaries from flip-flopping
  const RIGHT_FLOOR = 140; // min width the perf/paused block keeps (icon + action) before tabs collapse

  // The right block's two possible occupants; used to detect when it's active.
  const perfWrap = right instanceof HTMLElement ? right.querySelector('[data-device-panel-perf-wrap]') : null;
  const pausedNav = right instanceof HTMLElement ? right.querySelector('[data-device-panel-paused-nav]') : null;
  const rightActive = () =>
    (perfWrap instanceof HTMLElement && !perfWrap.hidden) ||
    (pausedNav instanceof HTMLElement && !pausedNav.hidden);

  let wFull = 0; // tab strip natural width, full
  let wCompact = 0; // tab strip natural width, compact
  let leftInfo = 0; // left block width with the device info shown
  let leftNoInfo = 0; // left block width with the device info hidden
  let measured = false;
  let scheduled = false;
  let rafId = 0;
  let rung = 0; // current ladder rung (see doc comment)

  const rectW = (el: Element | null) => (el ? el.getBoundingClientRect().width : 0);

  const measure = () => {
    const hadCompact = innerTabs.classList.contains('is-compact');
    const hadIcons = innerTabs.classList.contains('is-icons');
    innerTabs.classList.remove('is-compact', 'is-icons');
    wFull = innerTabs.scrollWidth;
    innerTabs.classList.add('is-compact');
    wCompact = innerTabs.scrollWidth;
    innerTabs.classList.remove('is-compact');
    if (hadCompact) innerTabs.classList.add('is-compact');
    if (hadIcons) innerTabs.classList.add('is-icons');

    // Left block width with the device info shown vs. hidden. We force the block
    // to `max-content` while measuring the shown state: the name/IP truncate
    // (ellipsis, min-width:0) when their grid track is narrow, so a plain
    // getBoundingClientRect would UNDER-measure leftInfo — the rung math would
    // then think the info fits and show it truncated instead of hiding it.
    // Measuring the untruncated width makes rung 0 mathematically guarantee the
    // grid track is wide enough for the info (no truncation), and hides it below.
    if (info instanceof HTMLElement) {
      const wasHidden = info.classList.contains('is-hidden');
      info.classList.remove('is-hidden');
      // Lift BOTH the width and the `max-width: 100%` cap (which otherwise clamps
      // `max-content` back to the narrow grid track, keeping the read truncated).
      const prevW = left.style.width;
      const prevMaxW = left.style.maxWidth;
      left.style.width = 'max-content';
      left.style.maxWidth = 'none';
      leftInfo = rectW(left);
      left.style.width = prevW;
      left.style.maxWidth = prevMaxW;
      info.classList.add('is-hidden');
      leftNoInfo = rectW(left);
      if (!wasHidden) info.classList.remove('is-hidden');
    } else {
      leftInfo = leftNoInfo = rectW(left);
    }
    measured = true;
  };

  const setClass = (el: HTMLElement, name: string, on: boolean) => {
    if (el.classList.contains(name) !== on) el.classList.toggle(name, on);
  };

  const apply = () => {
    const H = header.clientWidth;
    if (H <= 0) return;
    // The grid centers the strip, so both side tracks are equal — the binding
    // side is whichever needs more. The right block only reserves a small floor
    // (it truncates below its natural width), so a wide perf strip / paused
    // banner yields to the tabs instead of collapsing them.
    const rightReserve = rightActive() ? RIGHT_FLOOR : 0;
    const availInfo = H - 2 * Math.max(leftInfo, rightReserve) - 2 * GAP;
    const availNoInfo = H - 2 * Math.max(leftNoInfo, rightReserve) - 2 * GAP;

    // Rung table: [needed strip width, available width, resulting config].
    // Rung 3 (icons) needs 0 → always fits, so it's the last-resort floor.
    const rungs = [
      { need: wFull, avail: availInfo, hideInfo: false, compact: false, icons: false },
      { need: wFull, avail: availNoInfo, hideInfo: true, compact: false, icons: false },
      { need: wCompact, avail: availNoInfo, hideInfo: true, compact: true, icons: false },
      { need: 0, avail: availNoInfo, hideInfo: true, compact: false, icons: true }
    ];
    const fits = (i: number, margin: number) => rungs[i].need <= rungs[i].avail - margin;
    // Downgrade the moment the current rung stops fitting…
    while (rung < 3 && !fits(rung, 0)) rung++;
    // …but only upgrade once the lower rung fits with hysteresis slack.
    while (rung > 0 && fits(rung - 1, HYST)) rung--;

    const cfg = rungs[rung];
    if (info instanceof HTMLElement) setClass(info, 'is-hidden', cfg.hideInfo);
    setClass(innerTabs, 'is-compact', cfg.compact);
    setClass(innerTabs, 'is-icons', cfg.icons);
  };

  const run = () => {
    // Don't measure until the panel is actually laid out — a hidden/detached
    // panel reports zero widths, which would cache bogus thresholds.
    if (header.clientWidth <= 0) return;
    if (!measured) measure();
    apply();
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    rafId = requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  };

  // Observe the header: with the grid, its width tracks the real available space
  // (the center track is content-sized, so it wouldn't reflect window/sidebar
  // resizes). Our class toggles don't change the header's own width → no loop.
  const ro = new ResizeObserver(schedule);
  ro.observe(header);

  // The Network tab is revealed/hidden via an inline `display` style (changes
  // the strip's natural width); the perf/paused blocks toggle via the `hidden`
  // attribute (changes whether the right side reserves space) — react to both.
  const mo = new MutationObserver(() => {
    measured = false;
    schedule();
  });
  mo.observe(innerTabs, { attributes: true, attributeFilter: ['style'], subtree: true });
  if (right instanceof HTMLElement) {
    mo.observe(right, { attributes: true, attributeFilter: ['hidden'], subtree: true });
  }

  // Font loading can change label widths after first paint.
  let alive = true;
  if (document.fonts?.ready) {
    document.fonts.ready
      .then(() => {
        if (!alive) return;
        measured = false;
        schedule();
      })
      .catch(() => {});
  }

  schedule();

  // Re-measure when the device is renamed / info changes live.
  panel._headerResponsiveRemeasure = () => {
    measured = false;
    schedule();
  };
  // Deterministic teardown on tab close (matches the other per-panel cleanups).
  panel._headerResponsiveCleanup = () => {
    alive = false;
    if (scheduled) cancelAnimationFrame(rafId);
    ro.disconnect();
    mo.disconnect();
  };
}

function createDevicePanel(device, tabId, isRemote = false, serverUrl = null, locationId = null) {
  devLog('Creating device panel for:', device.deviceName, device.ip, isRemote ? '(remote)' : '(local)');
  
  const template = elements.devicePanelTemplate;
  if (!template) {
    rendererError('Device panel template not found!');
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

  // Localize the cloned device-panel template's static text (inner-tab labels,
  // tooltips, headers). The one-shot applyI18n(document) at startup can't reach this
  // subtree because it's cloned per device here; dynamic values below use S.* directly.
  applyI18n(panel);

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
    setDynamicHTML(
      nameText,
      icon('globe', 'icon-sm', 'icon-cyan') +
        ' ' +
        escapeHtml(device.deviceName || device.modelName || S.app.unknownRoku)
    );
    if (ipEl) {
      setDynamicText(ipEl, S.app.atLocation(device.ip, location?.name || S.app.remote));
    }
  } else {
    setDynamicText(nameText, device.deviceName || device.modelName || S.app.unknownRoku);
    setDynamicText(ipEl, device.ip);
  }
  
  if (iconEl) {
    setDevicePanelIcon(iconEl, device, { isRemote, serverUrl });
  }

  try {
    // Set up inner tabs
    setupInnerTabs(panel);
    setupDevicePanelHeaderResponsive(panel);
    
    // Set up all components using the unified API adapter
    setupRemoteControls(panel, device, api);
    setupApps(panel, device, api);
    setupQueries(panel, api);
    setupDeepLinkPanel(panel, api);
    setupDevApp(panel, device, api);
    setupInspector(panel, device, api);
    setupTelnet(panel, device, api, { devLog });
    setupActionScripts(panel, device, api);
    const networkCtrl = setupNetworkTab(panel, device, isRemote);
    networkTabControllers.set(tabId, networkCtrl);
    syncNetworkTabMultiDevice();
    void syncNetworkTabForConnectedDevice(tabId, device, networkCtrl, isRemote);
    
    // Update dev mode warnings based on device status
    updateDevModeWarnings(panel, device.developerEnabled === true);
    // Update ECP / Control by Mobile Apps warnings (mode-aware)
    updateEcpWarnings(panel, device);
    
    devLog('Device panel setup complete');
  } catch (error) {
    rendererError('Error setting up device panel:', error);
  }
  
  return panel;
}

// ============================================
// Inner Tab Management
// ============================================

// Network Inspector recording is continuous while it's enabled from Settings: once enabled, the
// engine captures every request regardless of which tab is foreground or whether the window is
// visible. Recording only stops for a specific device when the user presses Pause on that device
// (see pausedRecordingDeviceIps in the engine). The engine defaults to active, so the renderer no
// longer drives a tab/visibility-based suspend — leaving the Network view never pauses capture.

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
  
  const innerTabsStrip = panel.querySelector('.inner-tabs');

  // Sliding highlight that travels between tabs when the section changes. Driven
  // reactively (not from the click handler) so EVERY path that flips the active
  // tab — click, capability auto-switch, programmatic — moves it, and the
  // responsive compact/icon width changes keep it aligned to the active tab.
  if (innerTabsStrip instanceof HTMLElement && innerTabsStrip.dataset.indicatorReady !== '1') {
    innerTabsStrip.dataset.indicatorReady = '1';
    const strip = innerTabsStrip;
    let indicator = strip.querySelector('.inner-tab-indicator') as HTMLElement | null;
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'inner-tab-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      strip.prepend(indicator);
    }
    const ind = indicator;

    // Move/resize the pill to sit exactly over the active tab. animate=false snaps
    // (first placement + live tracking during responsive resize); true lets the
    // CSS transition animate the trip across the strip.
    const placeIndicator = (animate: boolean) => {
      const active = strip.querySelector('.inner-tab.active') as HTMLElement | null;
      if (!active || active.offsetWidth === 0) return;
      if (!animate) strip.classList.add('inner-tabs--indicator-instant');
      ind.style.width = `${active.offsetWidth}px`;
      ind.style.height = `${active.offsetHeight}px`;
      ind.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
      ind.style.opacity = '1';
      if (!animate) {
        void ind.offsetWidth; // flush the snap before re-enabling transitions
        strip.classList.remove('inner-tabs--indicator-instant');
      }
    };

    // Animate the travel whenever the active tab actually changes.
    let lastActive: Element | null = strip.querySelector('.inner-tab.active');
    const mo = new MutationObserver(() => {
      const active = strip.querySelector('.inner-tab.active');
      if (active && active !== lastActive) {
        lastActive = active;
        placeIndicator(true);
      }
    });
    mo.observe(strip, { subtree: true, attributes: true, attributeFilter: ['class'] });

    // Track width changes (compact/icon mode transitions, window resize, fonts)
    // without animating, so the pill stays glued to the active tab.
    const ro = new ResizeObserver(() => placeIndicator(false));
    ro.observe(strip);

    // First placement under the already-active tab, after layout, without animating in.
    requestAnimationFrame(() => placeIndicator(false));
  }

  innerTabs.forEach(tab => {
    // Show the label tooltip on hover only when collapsed to icons.
    tab.addEventListener('mouseenter', () => {
      if (innerTabsStrip?.classList.contains('is-icons')) scheduleSectionTabTooltip(tab);
    });
    tab.addEventListener('mouseleave', () => hideTabHoverTooltip());
    tab.addEventListener('mousedown', () => hideTabHoverTooltip());

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
        rendererError('Tab content not found for:', target);
      }
      
      // Dispatch custom event for tab switch
      panel.dispatchEvent(new CustomEvent('innertabswitch', { detail: { tab: target } }));

      // Opening the Console section acknowledges any unseen debug stop for this device.
      if (target === 'telnet') clearDebugStopForPanel(panel as HTMLElement);

      // Show / hide the floating remote based on the new inner tab.
      refreshFloatingRemote();
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
  
  // Auto-screenshot function for Remote Section
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
      rendererError('Auto screenshot error:', error);
    }
  }
  
  function scheduleAutoScreenshot(delayMs = SCREENSHOT_DEBOUNCE_DELAY) {
    if (!autoScreenshotCheckbox || !autoScreenshotCheckbox.checked) return;
    
    if (screenshotDebounceTimer) {
      clearTimeout(screenshotDebounceTimer);
    }
    screenshotDebounceTimer = setTimeout(takeAutoScreenshot, delayMs);
  }

  registerKeyboardRemoteAutoScreenshotRemote(panel, scheduleAutoScreenshot);

  wireRemoteTabKeyButtons(panel, api, scheduleAutoScreenshot, () => {
    panel.dispatchEvent(new CustomEvent('homePressed', { bubbles: true }));
  });
  wireRemoteTabSendText(panel, api, scheduleAutoScreenshot);
  setupRemoteTabInputs(panel, device, api, scheduleAutoScreenshot);
}

/**
 * Populate the Remote card's TV-inputs panel for TV devices. Roku TVs expose their inputs
 * via /query/apps as `<app id="tvinput.hdmi1">HDMI 1</app>`; we launch them with
 * `api.launch(id)` (the same mechanism the Apps tab uses). The panel stays hidden for
 * non-TV devices and for TVs that report no inputs, so nothing else in the Remote card
 * changes. Works in both the solo and quad (device-performance) layouts — the panel is
 * placed by CSS, not JS.
 */
function setupRemoteTabInputs(
  panel: HTMLElement,
  device: { isTv?: boolean },
  api: { query: (path: string) => Promise<{ success?: boolean; data?: string }>; launch: (id: string) => Promise<unknown> },
  scheduleAutoScreenshot: (delayMs?: number) => void
): void {
  const inputsPanel = panel.querySelector<HTMLElement>('.remote-inputs-panel');
  const grid = panel.querySelector<HTMLElement>('.remote-inputs-grid');
  const body = panel.querySelector<HTMLElement>('.remote-quad-remote-body');
  if (!inputsPanel || !grid) return;

  // Reveal/hide the panel and toggle the cluster-shrink class in one place.
  const setInputsVisible = (visible: boolean): void => {
    inputsPanel.hidden = !visible;
    body?.classList.toggle('has-tv-inputs', visible);
  };

  // Non-TV devices: leave the panel hidden — the Remote card is unchanged.
  if (device.isTv !== true) {
    setInputsVisible(false);
    return;
  }

  void (async () => {
    try {
      const result = await api.query('/query/apps');
      if (!result?.success || typeof result.data !== 'string') return;
      const inputs = [...result.data.matchAll(/<app id="(tvinput\.[^"]+)"[^>]*>([^<]+)<\/app>/g)].map(
        (m) => ({ id: m[1], label: decodeHtmlEntities(m[2]).trim() })
      );
      if (inputs.length === 0) {
        setInputsVisible(false);
        return;
      }

      // Stable order regardless of how the device lists them: sort by input id (e.g.
      // tvinput.cvbs, tvinput.dtv, tvinput.hdmi1…hdmi4 → AV, Live TV, Roku, HDMI 2, …).
      inputs.sort((a, b) => a.id.localeCompare(b.id));

      // Layout is CSS-driven (centered flex-wrap): up to ~6 fit on one row, wrapping when
      // there are more or the space is narrower. No fixed column count needed here.
      grid.innerHTML = ''; // clears any prior buttons + their listeners

      for (const inp of inputs) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'remote-input-btn';
        btn.dataset.launch = inp.id;
        const displayName = inp.label || inp.id.replace(/^tvinput\./, '');
        btn.textContent = displayName;
        btn.title = S.app.switchToInput(displayName);
        btn.addEventListener('click', async () => {
          btn.classList.add('pressed');
          try {
            await api.launch(inp.id);
            scheduleAutoScreenshot();
          } catch (error) {
            rendererError('TV input launch error:', error);
          }
          setTimeout(() => btn.classList.remove('pressed'), 150);
        });
        grid.appendChild(btn);
      }

      setInputsVisible(true);
    } catch (error) {
      rendererError('Failed to load TV inputs for remote:', error);
      setInputsVisible(false);
    }
  })();
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
  const inputsSection = panel.querySelector('.installed-inputs-section');
  const inputsGrid = panel.querySelector('.installed-inputs-grid');
  const appsTitle = panel.querySelector('.installed-apps-title');
  const rawListTitle = panel.querySelector('.raw-list-title');
  const setAppsTitle = (hasInputs: boolean) => {
    if (appsTitle) appsTitle.textContent = hasInputs ? S.app.installedAppsAndTvInputs : S.app.installedApps;
    if (rawListTitle) rawListTitle.textContent = hasInputs ? S.app.appsAndInputsList : S.app.rawListOfApps;
  };
  
  if (!appsGrid || !appsLoading || !appsEmpty || !refreshBtn) {
    rendererError('Apps elements not found:', { appsGrid, appsLoading, appsEmpty, refreshBtn });
    return;
  }
  
  // Show TV inputs only for TV devices
  if (tvInputsRow) {
    tvInputsRow.style.display = isTv ? 'flex' : 'none';
  }
  
  // TV inputs are exposed by /query/apps with ids prefixed "tvinput." (e.g. tvinput.hdmi1)
  const isTvInput = (appId) => appId.startsWith('tvinput.');

  // Run async tasks with a bounded number running at once. The Roku device's HTTP
  // server drops connections when hit with too many concurrent requests, so firing
  // all ~28 icon fetches at once causes some to fail; a small pool keeps them reliable.
  async function runWithConcurrency(tasks, limit) {
    let next = 0;
    const worker = async () => {
      while (next < tasks.length) {
        const task = tasks[next++];
        await task();
      }
    };
    const workerCount = Math.min(limit, tasks.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }

  // Build an app/input card button. Returns the button plus a loadIcon() task so
  // icon fetching can be deferred and run through the concurrency pool above.
  function createAppButton(appId, appName) {
    const btn = document.createElement('button');
    btn.className = 'app-btn-dynamic';
    btn.dataset.app = appId;
    btn.title = S.app.appTileTitle(appName, appId);

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

    const iconImg = btn.querySelector('.app-icon');
    const placeholder = btn.querySelector('.app-icon-placeholder');

    // Stop the loading animation and show the static fallback icon
    const showFallbackIcon = () => {
      if (!(placeholder instanceof HTMLElement)) return;
      placeholder.style.animation = 'none';
      placeholder.style.background = 'var(--bg-elevated)';
      const loadingIcon = placeholder.querySelector('.icon-loading');
      if (loadingIcon) loadingIcon.classList.remove('icon-loading');
    };

    // Fetch and apply the icon, retrying transient failures (the device drops
    // sockets under load, so a fresh attempt usually succeeds).
    const loadIcon = async () => {
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await api.getIcon(appId);
          if (result && result.success && result.dataUrl) {
            if (iconImg instanceof HTMLImageElement && placeholder instanceof HTMLElement) {
              iconImg.src = result.dataUrl;
              iconImg.style.display = 'block';
              placeholder.style.display = 'none';
            }
            return;
          }
        } catch {
          // fall through to retry
        }
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, attempt * 300));
        }
      }
      showFallbackIcon();
    };

    // Add click handler to launch app
    btn.addEventListener('click', async () => {
      btn.style.opacity = '0.5';
      await api.launch(appId);
      setTimeout(() => {
        btn.style.opacity = '1';
      }, 200);
    });

    return { btn, loadIcon };
  }

  // Function to load and display installed apps
  async function loadInstalledApps() {
    appsLoading.style.display = 'block';
    appsGrid.innerHTML = '';
    if (inputsGrid) inputsGrid.innerHTML = '';
    if (inputsSection) inputsSection.style.display = 'none';
    setAppsTitle(false);
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

        let inputCount = 0;
        const iconTasks: Array<() => Promise<void>> = [];
        for (const match of appMatches) {
          const appId = match[1];
          const appName = decodeHtmlEntities(match[2]);
          const { btn, loadIcon } = createAppButton(appId, appName);
          iconTasks.push(loadIcon);

          // Route TV inputs into their own section, apps into the main grid
          if (isTvInput(appId) && inputsGrid) {
            // Input icons are square-ish glyphs, not 16:9 poster art, so mark them
            // for contain-fit rendering (see .input-tile CSS) to avoid cropping.
            btn.classList.add('input-tile');
            inputsGrid.appendChild(btn);
            inputCount++;
          } else {
            appsGrid.appendChild(btn);
          }
        }

        // Only reveal the Inputs section when inputs are actually available, and
        // reflect that in the card title.
        if (inputsSection) {
          inputsSection.style.display = inputCount > 0 ? 'flex' : 'none';
        }
        setAppsTitle(inputCount > 0);

        // Fetch icons through a bounded pool so the device isn't overwhelmed.
        // Not awaited: cards are already visible and icons fill in progressively.
        runWithConcurrency(iconTasks, 6);
      } else {
        appsEmpty.style.display = 'block';
        setSafeHTML(appsEmpty, '<p>' + S.app.failedToLoadApps + ' ' + escapeHtml(result.error || S.app.unknownError) + '</p>');
      }
    } catch (error) {
      appsLoading.style.display = 'none';
      appsEmpty.style.display = 'block';
      setSafeHTML(appsEmpty, '<p>' + S.app.errorPrefix + ' ' + escapeHtml(errMessage(error)) + '</p>');
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
    copyAppsBtn.style.display = '';
    
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
      
      // Sort by app name alphabetically, then push TV inputs (tvinput.*) to the bottom
      apps.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      const isInput = (app) => app.id.startsWith('tvinput.');
      const regularApps = apps.filter(app => !isInput(app));
      const inputs = apps.filter(isInput);

      const formatRow = (app) => {
        const versionStr = app.version ? ` (v${app.version})` : '';
        return `ID: ${app.id.padEnd(16)} │ ${app.name}${versionStr}\n`;
      };

      let formatted = S.app.installedAppsHeader + '\n' + '═'.repeat(50) + '\n\n';
      for (const app of regularApps) {
        formatted += formatRow(app);
      }

      if (inputs.length > 0) {
        formatted += '\n' + S.app.inputsHeader + '\n' + '═'.repeat(50) + '\n\n';
        for (const app of inputs) {
          formatted += formatRow(app);
        }
      }

      appsOutput.textContent = formatted || result.data;
    } else {
      appsOutput.textContent = `${S.app.errorPrefix} ${result.error}`;
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
      copyAppsBtn.title = S.app.copied;
      setSafeHTML(copyAppsBtn, icon('check', 'icon-xs'));
      copyAppsBtn.classList.add('copied');

      setTimeout(() => {
        copyAppsBtn.title = S.app.copyList;
        setSafeHTML(copyAppsBtn, icon('copy', 'icon-xs'));
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
// Deep Link — see modules/deeplink/deeplink-panel.ts
// ============================================

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
  // Title-bar hamburger (app) menu open — its own Escape handler closes it, so
  // don't also map Escape → Home (or any keymap key) to the device. This guard
  // runs in the global handler that fires *before* the menu's own listener.
  if (document.querySelector('#titlebarHamburgerBtn[aria-expanded="true"]')) return true;
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

/**
 * Whether global remote-key shortcuts should fire for this panel. Extends
 * `isKeyboardRemoteNavigationContextActive` with the floating-remote case so
 * arrow keys / Enter / etc. still drive the device from Console / Inspector /
 * Action Scripts / Query / Apps while the floating remote is visible.
 *
 * Kept separate from the Tab→Send-Text gate (which intentionally only fires
 * on Remote / Dev App, because those are the only tabs whose Send-Text input
 * is actually focusable in the DOM).
 */
function isKeyboardRemoteShortcutContextActive(panel: HTMLElement): boolean {
  if (isKeyboardRemoteNavigationContextActive(panel)) return true;
  return isFloatingRemoteVisible();
}

/** Remote Section Send Text field, scoped to the active inner pane. */
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
  // Handle Ctrl+F / Cmd+F for search in the ECP query Results tab. The find bar (shared
  // simple find bar) lives just above the results output and is only present/visible once
  // results have rendered — focus it when the Query tab is active.
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    if (state.activeTabId) {
      const activePanel = document.getElementById(state.activeTabId);
      if (activePanel) {
        const queryTab = activePanel.querySelector('[data-inner-content="query"]');
        const findInput = activePanel.querySelector('.query-bottom .find-bar:not([hidden]) .find-bar-input');
        if (
          queryTab &&
          queryTab.classList.contains('active') &&
          findInput instanceof HTMLInputElement
        ) {
          e.preventDefault();
          findInput.focus();
          findInput.select();
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

  if (!isKeyboardRemoteShortcutContextActive(activePanel)) {
    return;
  }

  // Skip when any application-level modifier is held — Cmd/Ctrl/Alt
  // combinations are reserved for menu accelerators (View > Zoom In/Out
  // is `Cmd+/-`, the BrightScript Fiddle window is `Cmd+B`, Reload is
  // `Cmd+R`, etc.) and for OS-level shortcuts (`Cmd+M` minimize on
  // macOS). Without this guard, e.g. `Cmd+-` fires zoomOut from the menu
  // **and** `VolumeDown` from the keyMap below, because Electron menu
  // accelerators don't suppress the renderer DOM keydown event. Shift
  // alone is fine: it's the typing modifier for several keymap entries
  // (`+`, `*`) and is the trigger for `shiftPForPower`.
  if (e.metaKey || e.ctrlKey || e.altKey) {
    return;
  }

  const rokuKey = resolveRokuKeyFromEvent(e);
  if (rokuKey) {
    e.preventDefault();

    // Visual feedback. Use querySelectorAll so the press lights up *every*
    // button bound to this key in the active panel — both the main Remote
    // panel button and the Dev App's Quick Remote mirror (`.devapp-key`)
    // share the same `data-key`. The previous singular `querySelector` only
    // hit the first one (the Remote panel), so users on the Dev App tab
    // saw no feedback even though the keypress fired.
    const btns = activePanel.querySelectorAll<HTMLElement>(`[data-key="${rokuKey}"]`);
    btns.forEach((btn) => btn.classList.add('pressed'));

    try {
      await panelApi.keypress(rokuKey);
      scheduleKeyboardRemoteAutoScreenshotForActiveInnerTab(activePanel);
    } catch (error) {
      rendererError('Keypress error:', error);
    }

    if (btns.length > 0) {
      setTimeout(() => {
        btns.forEach((btn) => btn.classList.remove('pressed'));
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
  elements.manualConnectBtn.textContent = S.app.connecting;
  
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
      alert(S.app.couldNotConnectToIp(ip));
    }
  } catch (error) {
    alert(S.app.connectionError(errMessage(error)));
  }

  if (elements.manualConnectBtn) {
    elements.manualConnectBtn.disabled = false;
    elements.manualConnectBtn.textContent = S.common.connect;
  }
}

// ============================================
// Utility Functions
// ============================================

// Utility functions are now imported from modules/utils
// escapeHtml, decodeHtmlEntities, showStatusMessage are imported above

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
  
  // Close on backdrop click, guarded so a drag that starts inside and releases
  // on the backdrop doesn't dismiss the modal (see modal-backdrop-click.ts).
  attachBackdropClickToClose(locationModal, closeModal);
  
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
    confirmBtn.textContent = S.app.connecting;

    try {
      await addRemoteLocation(name, host, port);
      closeModal();
    } catch (e) {
      rendererError('Failed to add remote location:', e);
      alert(errMessage(e) || S.app.failedToConnectRelay);
    }

    confirmBtn.disabled = false;
    confirmBtn.textContent = S.app.addLocation;
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
  attachBackdropClickToClose(modal, closeKeyboardRemoteHelpModal);
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
  const platform =
    shell?.platform ??
    (typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? 'darwin' : 'win32');
  if (platform !== 'darwin') {
    document.body.classList.add(`platform-${platform}`);
  } else if (shell) {
    document.body.classList.add(`platform-${shell.platform}`);
  }

  if (!shell && platform !== 'darwin') {
    if (!document.getElementById('titlebarShellWarning')) {
      const banner = document.createElement('div');
      banner.id = 'titlebarShellWarning';
      banner.className = 'titlebar-shell-warning';
      banner.setAttribute('role', 'alert');
      banner.textContent = S.app.windowControlsUnavailable;
      document.body.prepend(banner);
    }
    return;
  }
  if (!shell) return;

  const root = document.querySelector('.titlebar');
  if (!root) return;
  root.querySelector('.titlebar-minimize')?.addEventListener('click', () => shell.minimizeWindow());
  root.querySelector('.titlebar-maximize')?.addEventListener('click', () => shell.toggleMaximizeWindow());
  root.querySelector('.titlebar-close')?.addEventListener('click', () => shell.closeWindow());

  const maximizeBtn = root.querySelector<HTMLButtonElement>('.titlebar-maximize');
  const syncMaximizeButton = (maximized: boolean) => {
    if (!maximizeBtn) return;
    maximizeBtn.classList.toggle('titlebar-maximized', maximized);
    const label = maximized ? S.app.restoreDown : S.app.maximize;
    maximizeBtn.title = label;
    maximizeBtn.setAttribute('aria-label', label);
  };
  if (maximizeBtn && typeof shell.isMainWindowMaximized === 'function') {
    shell.isMainWindowMaximized().then((res) => syncMaximizeButton(!!res?.maximized)).catch(() => {});
  }
  if (typeof shell.onMainWindowMaximizeChanged === 'function') {
    shell.onMainWindowMaximizeChanged(syncMaximizeButton);
  }

  setupTitlebarHamburgerMenu(shell);
}

function setupTitlebarHamburgerMenu(shell: NonNullable<Window['rdsShell']>): void {
  const btn = document.getElementById('titlebarHamburgerBtn');
  const menu = document.getElementById('titlebarHamburgerMenu');
  if (!(btn instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) return;

  void window.roku
    .isDiagnosticBuild?.()
    .then((res) => {
      if (!res?.enabled) return;
      document.getElementById('titlebarDiagnosticLogFolderItem')?.removeAttribute('hidden');
      const debugToggle = menu.querySelector('[data-menu-action="toggle-debug-logging"]');
      if (debugToggle instanceof HTMLButtonElement) {
        debugToggle.disabled = true;
        debugToggle.setAttribute('aria-checked', 'true');
      }
    })
    .catch(() => {});

  const toggleButtons = Array.from(
    menu.querySelectorAll<HTMLButtonElement>('[data-menu-action^="toggle-"]')
  );

  const setMenuOpen = (open: boolean) => {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.classList.toggle('titlebar-hamburger-menu--open', open);
    if (open) {
      menu.removeAttribute('hidden');
    } else {
      menu.setAttribute('hidden', '');
    }
  };

  const syncToggleStates = async () => {
    const [devRes, privacyRes, debugRes] = await Promise.all([
      window.roku.getDeveloperMode().catch(() => ({ enabled: false })),
      window.roku.getPrivacyMode().catch(() => ({ enabled: false })),
      window.roku.isDebugEnabled().catch(() => ({ enabled: false }))
    ]);
    const states: Record<string, boolean> = {
      'toggle-developer': !!devRes?.enabled,
      'toggle-privacy': !!privacyRes?.enabled,
      'toggle-debug-logging': !!debugRes?.enabled
    };
    for (const item of toggleButtons) {
      const action = item.dataset.menuAction;
      if (!action) continue;
      const checked = !!states[action];
      item.setAttribute('aria-checked', checked ? 'true' : 'false');
    }
  };

  const closeMenu = () => setMenuOpen(false);

  const syncHamburgerZoomLabel = () => {
    const pctEl = document.getElementById('titlebarHamburgerZoomPct');
    if (!pctEl) return;
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-zoom').trim();
    const factor = Number(raw);
    pctEl.textContent =
      Number.isFinite(factor) && factor > 0 ? `${Math.round(factor * 100)}%` : '100%';
  };

  /** Toggles + zoom adjust in-place; everything else opens a dialog/window or reloads. */
  const menuStaysOpenActions = new Set([
    'toggle-developer',
    'toggle-privacy',
    'toggle-debug-logging',
    'zoom-in',
    'zoom-out',
    'zoom-reset'
  ]);

  const runMenuAction = async (action: string) => {
    switch (action) {
      case 'toggle-developer': {
        const res = await window.roku.getDeveloperMode();
        await window.roku.setDeveloperMode(!res?.enabled);
        break;
      }
      case 'toggle-privacy': {
        const res = await window.roku.getPrivacyMode();
        await window.roku.setPrivacyMode(!res?.enabled);
        break;
      }
      case 'toggle-debug-logging':
        if (typeof shell.appMenuAction === 'function') {
          await shell.appMenuAction('toggle-debug-logging');
        }
        break;
      case 'open-diagnostic-log-folder':
        if (typeof window.roku.openDiagnosticLogFolder === 'function') {
          await window.roku.openDiagnosticLogFolder();
        }
        break;
      case 'open-log-file':
        if (typeof shell.appMenuAction === 'function') {
          await shell.appMenuAction('open-log-file-picker');
        }
        break;
      case 'open-fiddle':
        if (typeof shell.appMenuAction === 'function') {
          await shell.appMenuAction('open-fiddle');
        }
        break;
      case 'settings':
        if (typeof shell.appMenuAction === 'function') {
          await shell.appMenuAction('settings');
        }
        break;
      case 'clear-cache':
        if (typeof shell.appMenuAction === 'function') {
          await shell.appMenuAction('clear-cache');
        }
        break;
      case 'zoom-in':
        shell.zoomIn?.();
        break;
      case 'zoom-out':
        shell.zoomOut?.();
        break;
      case 'zoom-reset':
        shell.zoomReset?.();
        break;
      case 'about':
        if (typeof shell.showAboutDialog === 'function') {
          await shell.showAboutDialog();
        }
        break;
      case 'quit':
        if (typeof shell.appMenuAction === 'function') {
          await shell.appMenuAction('quit');
        }
        break;
      default:
        break;
    }

    if (action.startsWith('toggle-')) {
      await syncToggleStates();
    }
    if (action === 'zoom-in' || action === 'zoom-out' || action === 'zoom-reset') {
      syncHamburgerZoomLabel();
    }
    if (!menuStaysOpenActions.has(action)) {
      closeMenu();
    }
  };

  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const willOpen = btn.getAttribute('aria-expanded') !== 'true';
    if (willOpen) {
      void syncToggleStates().then(() => {
        syncHamburgerZoomLabel();
        setMenuOpen(true);
      });
    } else {
      closeMenu();
    }
  });

  menu.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest<HTMLButtonElement>('button[data-menu-action]');
    if (!btn) return;
    const action = btn.dataset.menuAction;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    void runMenuAction(action);
  });

  document.addEventListener('pointerdown', (event) => {
    if (btn.getAttribute('aria-expanded') !== 'true') return;
    const target = event.target;
    if (target instanceof Node && (btn.contains(target) || menu.contains(target))) return;
    closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    // Only act (and swallow the key) when the menu is actually open. Otherwise
    // a global keyboard-remote handler maps Escape → Home and would fire a Home
    // keypress to the device while the menu closes.
    if (btn.getAttribute('aria-expanded') !== 'true') return;
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
  });
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
  // Apply the locale the main process resolved and passed in the loadFile query
  // (?locale=…) SYNCHRONOUSLY here — before the first applyI18n(document) below and
  // before any modal fragment is injected — so the very first paint is already in the
  // chosen language. Without this the shell paints in English (the inline data-i18n
  // fallback) and loadPersistedAppSettings()'s async setLocale (further down) re-renders
  // it, which is the visible English→locale flash + jank on startup. That async apply
  // stays as the source of truth / fallback; this just wins the first frame.
  try {
    const initialLocale = new URLSearchParams(window.location.search).get('locale');
    if (initialLocale) setLocale(initialLocale);
  } catch {
    /* no query locale — loadPersistedAppSettings() will still apply it async */
  }
  setupFramelessTitlebar();
  const { ensureGlobalModalsMounted } = await import('./components/modals/mount-global-modals.js');
  await ensureGlobalModalsMounted();
  // Localize the static index.html shell + the just-injected modal fragments in one
  // pass (elements carry data-i18n* attributes; inline English is the fallback).
  applyI18n(document);
  // The local device-count badge is parametrized (S.app.deviceCount), so it can't carry
  // a data-i18n attribute; seed its initial "0 devices" label from the catalog. Later
  // renderDeviceList() calls keep it in sync as devices connect/disconnect.
  const initialDeviceCount = document.getElementById('localDeviceCount');
  if (initialDeviceCount) initialDeviceCount.textContent = S.app.deviceCount(0);
  await initDeeplinkMediaTypes();
  await initDeeplinkPresets();
  setupKeyboardRemoteHelpModal();

  // Developer-mode logging self-initializes in the shared dev-log module on import.
  // Initialize privacy mode
  initPrivacyMode();
  initLocaleLiveSwitch(() => renderDeviceList());

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
    rendererError('window.roku is not available! Preload might have failed.');
    return;
  }

  // Hydrate the in-memory developer-password cache from the encrypted store
  // (and migrate the legacy `localStorage["roku-dev-passwords"]` blob on first
  // run). MUST complete before device panels mount — `password-auth.ts`
  // auto-fires `verifyPassword()` synchronously off `getStoredPassword()`,
  // and that read returns `''` until this resolves.
  await hydrateSecretCache();

  await loadPersistedAppSettings();
  // loadPersistedAppSettings() applies the persisted locale (setLocale) — the earlier
  // applyI18n(document) ran before that, so re-drive the static shell now that the
  // active locale is settled (a no-op when the resolved locale is English).
  applyI18n(document);
  resetPostStartupSidebarSessionState();

  setupSidebarTitlebarToggle();
  mountFloatingRemote();
  syncFloatingRemoteToggleButtons();
  setupNetworkInspectorListeners();

  // The shared bus performs `loadPersistedAppSettings()` once and fans out to
  // every subscriber, so the global shell and each device-metrics panel no
  // longer race on N parallel reloads.
  let wasRememberEnabledBeforeUpdate = REMEMBER_SIDEBAR_TOGGLE;
  onAppSettingsChanged(() => {
    cachedRememberedDeviceList = undefined;
    cancelPostStartupSidebarGraceTimer();
    refreshAllNetworkTabVisibility();
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
  
  // Load Remote Locations AFTER initial render (non-blocking)
  setTimeout(() => {
    loadRemoteLocations()
      .then(() => {
        renderRemoteLocations();
        if (state.remoteLocations.size === 0) {
          startupRemoteScanComplete = true;
          void onStartupScansReady();
        }
        // Refresh Remote Locations after a short delay
        setTimeout(refreshAllRemoteLocations, 500);
      })
      .catch((e) => {
        rendererError('Failed to load Remote Locations:', e);
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
      rendererError('Auto-scan failed:', err);
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

  // "Apply to Device" (from the View & Manage Action Scripts window): show a device picker, then
  // connect/activate the chosen device, switch to its Action Scripts section, and load the script.
  function buildApplyDeviceOptions(): Array<{ id: string; label: string }> {
    const out: Array<{ id: string; label: string }> = [];
    const seen = new Set<string>();
    const PRIVACY_IP_MASK = '•••.•••.•••.•••';
    const push = (device: { ip?: string; deviceName?: string; friendlyModelName?: string; modelName?: string; serialNumber?: string }, isRemote: boolean): void => {
      if (!device || !device.ip) return;
      const id = getDeviceId(device);
      if (!id || seen.has(id)) return;
      seen.add(id);
      const name = device.deviceName || device.friendlyModelName || device.modelName || 'Roku';
      const ip = privacyModeEnabled ? PRIVACY_IP_MASK : device.ip;
      out.push({ id, label: `${isRemote ? '☁ ' : ''}${name} (${ip})` });
    };
    for (const device of state.devices.values()) push(device, false);
    for (const location of state.remoteLocations.values()) {
      if (!location || !location.devices) continue;
      for (const device of location.devices.values()) push(device, true);
    }
    return out;
  }

  function applyScriptToDevice(id: string, json: string): void {
    let tabId: string | null = null;
    for (const device of state.devices.values()) {
      if (getDeviceId(device) === id) {
        connectDevice(device);
        tabId = `tab-${device.ip.replace(/\./g, '-')}`;
        break;
      }
    }
    if (!tabId) {
      for (const [locationId, location] of state.remoteLocations) {
        if (!location || !location.devices) continue;
        for (const device of location.devices.values()) {
          if (getDeviceId(device) === id) {
            connectRemoteDevice(device, locationId);
            tabId = `tab-remote-${locationId}-${device.ip.replace(/\./g, '-')}`;
            break;
          }
        }
        if (tabId) break;
      }
    }
    if (!tabId) return;
    const panel = document.getElementById(tabId);
    if (!(panel instanceof HTMLElement)) return;
    // connectDevice/connectRemoteDevice already activated the tab; switch its inner section to
    // Action Scripts, then hand the JSON to that panel's per-panel load-into-builder listener.
    (panel.querySelector('.inner-tab[data-inner-tab="actionscripts"]') as HTMLElement | null)?.click();
    panel.dispatchEvent(new CustomEvent('action-script-load-into-builder', { detail: { json } }));
  }

  // The "View and Manage Action Scripts" window shows its own device picker but owns no device state:
  // serve its list requests here (optionally running a fresh scan first), and reply over the relay.
  if (typeof window.roku.onRequestApplyDeviceOptions === 'function') {
    window.roku.onRequestApplyDeviceOptions(async ({ reqId, rescan }) => {
      if (rescan && !state.isScanning) {
        try {
          await runFullUserScan();
        } catch (err) {
          rendererError('[ApplyToDevice] rescan failed:', err);
        }
      }
      try {
        window.roku.provideApplyDeviceOptions({ reqId, options: buildApplyDeviceOptions() });
      } catch {
        /* ignore */
      }
    });
  }
  // The picker (over in the viewer window) chose a device — connect/activate it here and load the script.
  if (typeof window.roku.onApplyActionScriptOnMain === 'function') {
    window.roku.onApplyActionScriptOnMain(({ deviceId, json }) => {
      if (typeof deviceId === 'string' && typeof json === 'string') applyScriptToDevice(deviceId, json);
    });
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
        rendererError('[Fiddle] refresh scan failed:', err);
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
        rendererError('[Fiddle] removePassword failed:', err);
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
      rendererWarn('[Fiddle] __rdsOpenFiddleForDevice failed:', err);
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
        alert(S.app.couldNotOpenLogFile(openResult.error));
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

    // Backdrop-click-to-close, gated on the press ALSO starting on the backdrop.
    // The naive `if (e.target === helpModal) close()` would dismiss the modal
    // when a drag that STARTED inside (e.g. on the search-bar resize handle)
    // releases out on the backdrop — the synthesized click's common ancestor is
    // the overlay. This shared helper latches the mousedown target and skips it.
    attachBackdropClickToClose(helpModal, closeHelpModal);

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

      // In-header search across the whole guide. The guide is one scroll
      // container (#helpContent) with every section stacked, so the shared
      // simple find bar — the same engine used by ECP Query results and the
      // Network body panes — highlights matches across all sections and
      // navigates between them. Always visible in the header; Ctrl/Cmd+F
      // focuses it while the modal is open.
      const helpFindBarEl = buildFindBarElement(S.app.searchHelpGuide);
      helpFindBarEl.classList.add('find-bar-header');
      const helpHeader = helpModal.querySelector('.modal-header');
      if (helpHeader instanceof HTMLElement) helpHeader.insertBefore(helpFindBarEl, helpModalClose);
      else helpContent.insertAdjacentElement('beforebegin', helpFindBarEl);
      const helpFindBar = createFindBar({
        bodyEl: helpContent,
        barEl: helpFindBarEl,
        highlightId: 'help-find'
      });
      if (helpFindBar) {
        helpFindBar.setVisible(true);
        bindFindShortcut(helpModal, helpFindBar);
      }
      // Centered, drag-to-resize search box — same behavior as the ECP Query /
      // Network header search bars. Centered on the modal header between the
      // pinned title (left) and close button (right).
      if (helpHeader instanceof HTMLElement) {
        makeCenteredSearchResizable(helpFindBarEl, {
          storageKey: searchWidthKey('help', 'guide'),
          header: helpHeader,
          leftGroupSelector: '.modal-title',
          rightGroupSelector: '.modal-close',
          minWidthPx: 220,
          maxDefaultWidth: 380
        });
      }

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
        helpFindBar?.clear();
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

    attachBackdropClickToClose(devModeModal, closeDevModeModal);

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
    attachBackdropClickToClose(ecpModeModal, closeEcpModeModal);
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
      if (titleEl) titleEl.textContent = S.app.ecpWarnDisabledTitle;
      if (descEl) setSafeHTML(descEl, S.app.ecpWarnDisabledDesc);
      if (subnetNote) subnetNote.classList.remove('visible');
    } else if (mode === 'Limited') {
      warning.classList.add('visible');
      warning.dataset.ecpVariant = 'limited';
      if (titleEl) titleEl.textContent = S.app.ecpWarnLimitedTitle;
      if (descEl) setSafeHTML(descEl, S.app.ecpWarnLimitedDesc);
      if (subnetNote) subnetNote.classList.remove('visible');
    } else if (mode === 'Permissive' || mode === 'Enabled') {
      if (showSubnetWarning) {
        warning.classList.add('visible');
        warning.dataset.ecpVariant = 'subnet';
        if (titleEl) titleEl.textContent = S.app.ecpWarnSubnetTitle;
        if (descEl) descEl.textContent = S.app.ecpWarnSubnetDesc;
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
      showToast(S.app.trackerTaskSaved, 'success');
    } else {
      showToast(S.app.failedToSaveTrackerTask + ' ' + (result.error || S.app.unknownError), 'error');
    }
  } catch (err) {
    rendererError('Error saving TrackerTask:', err);
    showToast(S.app.errorSavingTrackerTask + ' ' + errMessage(err), 'error');
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
    showToast(S.app.integrationInfoCopied, 'success');
  }).catch(err => {
    rendererError('Failed to copy:', err);
    showToast(S.app.failedToCopyClipboard, 'error');
  });
};

// showToast is now imported from modules/utils/ui.js

/**
 * Mirror the webContents zoom factor into the `--app-zoom` CSS variable on
 * `:root`. The frameless title bar's CSS uses this to inverse-scale itself
 * (via `max(base, calc(base / var(--app-zoom)))`) and stay at a constant
 * screen-pixel size even as the renderer zoom shrinks — otherwise the
 * macOS-drawn traffic lights (and the Win/Linux custom titlebar controls)
 * collide with the content below. Source side: `apps/roku-dev-studio/main.ts`
 * `applyZoomFactor` + the `did-finish-load` initial broadcast.
 *
 * Also drives the title-bar zoom indicator (`-` / `100%` / `+`) — the
 * indicator is the single subscriber that knows the current factor, so it
 * updates its label and toggles its visibility off when factor === 1.
 */
function subscribeToAppZoom() {
  const shell = window.rdsShell;
  if (!shell || typeof shell.onAppZoomChanged !== 'function') return;

  const zoomGroupEl = document.getElementById('titlebarZoom');
  const zoomLabelEl = document.getElementById('titlebarZoomLabel');
  const zoomInEl = document.getElementById('titlebarZoomIn');
  const zoomOutEl = document.getElementById('titlebarZoomOut');
  const hamburgerZoomPctEl = document.getElementById('titlebarHamburgerZoomPct');

  // 1px tolerance vs 1.0 — `Number.isFinite` rules out NaN/±Infinity from
  // a malformed IPC payload, and the epsilon hides the indicator after a
  // round-trip through `setZoomFactor` (which can reply with 0.9999...).
  const isAtDefaultZoom = (factor: number): boolean => Math.abs(factor - 1) < 0.005;

  if (zoomInEl && typeof shell.zoomIn === 'function') {
    zoomInEl.addEventListener('click', () => shell.zoomIn?.());
  }
  if (zoomOutEl && typeof shell.zoomOut === 'function') {
    zoomOutEl.addEventListener('click', () => shell.zoomOut?.());
  }
  if (zoomLabelEl && typeof shell.zoomReset === 'function') {
    // Clicking the percentage resets to 100% — natural counterpart to the
    // ± buttons. The indicator hides itself on the resulting broadcast.
    zoomLabelEl.addEventListener('click', () => shell.zoomReset?.());
  }

  shell.onAppZoomChanged((factor: number) => {
    const safe = Number.isFinite(factor) && factor > 0 ? factor : 1;
    document.documentElement.style.setProperty('--app-zoom', String(safe));
    if (zoomGroupEl) {
      if (isAtDefaultZoom(safe)) {
        zoomGroupEl.setAttribute('hidden', '');
      } else {
        zoomGroupEl.removeAttribute('hidden');
      }
    }
    if (zoomLabelEl) {
      zoomLabelEl.textContent = `${Math.round(safe * 100)}%`;
    }
    if (hamburgerZoomPctEl) {
      hamburgerZoomPctEl.textContent = `${Math.round(safe * 100)}%`;
    }
  });
}

// --- Debug-stop cross-tab alerts (Phase 1) ---------------------------------
// When a debugged app halts on ANY device, draw attention even if the user is on a
// different device tab or a non-Console section: a persistent dot on the device tab
// (blinks briefly, then steady), a pulse on that panel's Console section button, a
// hover-tooltip line, and a clickable toast that jumps straight to that device's
// Console. Suppressed when the user is already watching that device's Console.

/** Compact "File.brs:42" from a stop snapshot's top stack frame (basename only). */
function debugStopLocation(d: { stackFrames?: unknown }): string {
  const frames = Array.isArray(d.stackFrames) ? d.stackFrames : [];
  const top = (frames[0] ?? {}) as Record<string, unknown>;
  const rawFile = String(top.filePath ?? top.fileName ?? top.file ?? top.path ?? '');
  const file = rawFile.replace(/^pkg:\//i, '').split('/').pop() || '';
  const line = top.lineNumber ?? top.line;
  return file ? `${file}${line != null && line !== '' ? `:${line}` : ''}` : '';
}

/** Tab button for a device ip (ip is numeric/dots — safe inside a quoted attr selector). */
function deviceTabForIp(ip: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.tab-item[data-ip="${ip}"]`);
}

/** Mark a device tab as having an unseen debug stop: a dot (re-blinks each stop) + tooltip data. */
function markTabDebugStop(tab: HTMLElement, loc: string): void {
  tab.dataset.debugStop = loc || '1';
  tab.classList.add('tab-item--attn');
  let dot = tab.querySelector<HTMLElement>('.tab-attn-dot');
  if (!dot) {
    dot = document.createElement('span');
    dot.className = 'tab-attn-dot';
    dot.setAttribute('aria-hidden', 'true');
    tab.insertBefore(dot, tab.firstChild);
  }
  // Re-trigger the finite blink (reflow so the animation restarts on a repeat stop).
  dot.classList.remove('tab-attn-dot--blink');
  void dot.offsetWidth;
  dot.classList.add('tab-attn-dot--blink');
}

/** Clear the unseen-stop indicators for a device panel (called when its Console is opened). */
function clearDebugStopForPanel(panel: HTMLElement): void {
  panel.querySelector('.inner-tab[data-inner-tab="telnet"]')?.classList.remove('inner-tab--attn');
  const tab = document.querySelector<HTMLElement>(`.tab-item[data-tab-id="${panel.id}"]`);
  if (tab) {
    delete tab.dataset.debugStop;
    tab.classList.remove('tab-item--attn');
    tab.querySelector('.tab-attn-dot')?.remove();
  }
}

/** Jump to a device's Console section (activate its tab, then open the telnet inner-tab). */
function focusDeviceConsole(tabId: string): void {
  activateTab(tabId);
  const panel = document.getElementById(tabId);
  (panel?.querySelector('.inner-tab[data-inner-tab="telnet"]') as HTMLElement | null)?.click();
  // Pull the eye to where the halt data lands: pulse the Variables section header once.
  const varHeader = panel?.querySelector<HTMLElement>('[data-debug-section-header="variables"]');
  if (varHeader) {
    varHeader.classList.remove('telnet-debug-section-header--attn');
    void varHeader.offsetWidth; // reflow so the finite pulse restarts on a repeat stop
    varHeader.classList.add('telnet-debug-section-header--attn');
  }
}

function registerDebugStopAlerts(): void {
  const roku = (window as any).roku;
  if (!roku?.onDebuggerStopped) return;
  // Skip non-halt reasons; runtime errors also arrive here (reason RuntimeError), so we
  // don't separately listen to onDebuggerRuntimeError (that would double-fire per crash).
  const SKIP = new Set(['NormalExit', 'NotStopped', 'Undefined']);
  let lastAt = 0;
  let lastIp = '';
  // Returning to the window on a device whose Console is the active section acknowledges any
  // stop that landed while it was unfocused (its sidebar is already showing the halt).
  window.addEventListener('focus', () => {
    const tabId = state.activeTabId;
    const panel = tabId ? document.getElementById(tabId) : null;
    if (panel?.querySelector('.inner-tab[data-inner-tab="telnet"]')?.classList.contains('active')) {
      clearDebugStopForPanel(panel);
    }
  });
  roku.onDebuggerStopped((raw: unknown) => {
    const d = (raw ?? {}) as { ip?: string; reason?: string; stackFrames?: unknown };
    const ip = (d.ip || '').trim();
    if (!ip || (d.reason && SKIP.has(d.reason))) return;
    // De-dup a burst of stops from the same device (stepping / multi-event crash).
    const now = Date.now();
    if (ip === lastIp && now - lastAt < 500) return;
    lastAt = now;
    lastIp = ip;

    const tab = deviceTabForIp(ip);
    if (!tab) return;
    const tabId = tab.dataset.tabId || '';
    const panel = tabId ? document.getElementById(tabId) : null;
    const consoleBtn = panel?.querySelector('.inner-tab[data-inner-tab="telnet"]') ?? null;
    const consoleActive = !!consoleBtn?.classList.contains('active');
    // Suppress when the user is already watching this device's Console (active tab + focused).
    if (state.activeTabId === tabId && consoleActive && document.hasFocus()) return;

    const isError = d.reason === 'RuntimeError' || d.reason === 'CaughtRuntimeError';
    const loc = debugStopLocation(d);
    const name = (tab.dataset.deviceName || tab.dataset.ip || ip).trim();

    markTabDebugStop(tab, loc);
    consoleBtn?.classList.add('inner-tab--attn');
    const msg = isError ? S.debugger.stoppedAlertError(name, loc) : S.debugger.stoppedAlert(name, loc);
    showToast(msg, isError ? 'error' : 'warning', tabId ? () => focusDeviceConsole(tabId) : undefined);
  });
}

// Start the app when DOM is ready
function runInit() {
  subscribeToAppZoom();
  registerMcpConnectFlow();
  registerRelayAutoConnect();
  registerDebugStopAlerts();
  // A password validated in the Sideload Relay setup is a shared device credential —
  // update this window's cache so the Dev App stops prompting for it.
  (window as any).roku?.onSecretsPasswordUpdated?.((serial: string, password: string) => setCachedPassword(serial, password));
  ensureMcpStoredPasswordBridge();
  ensureMcpAgentScreenshotBridge();
  mountUpdateNotification();
  setupWelcomeFeatureModals();
  onMcpAgentAction((payload) => {
    if (!payload || typeof payload.summary !== 'string' || !payload.summary) return;
    const variant = payload.level === 'destructive' ? 'warning' : 'info';
    showToast(payload.summary, variant);
  });
  init().catch((err) => {
    rendererError('App init failed:', err);
    alert(S.app.appInitFailed + ' ' + errMessage(err));
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInit);
} else {
  runInit();
}

} catch (err) {
  rendererError('=== FATAL ERROR IN APP.JS ===', err);
  alert(S.app.appInitFailed + ' ' + errMessage(err));
}

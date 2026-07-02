/**
 * Shared Roku device info parsing and HTTP fetch.
 * Used by main process (device discovery, test-connection) and remote server.
 */

const http = require('http');
const { QUERY_TIMEOUT } = require('./shared-constants');
const os = require('os');
const { isValidIp } = require('roku-dev-studio-platform/validation');

/** Allowed tag names for device-info XML (ReDoS: use only pre-built regexes). */
const DEVICE_INFO_TAGS = new Set([
  'friendly-device-name', 'user-device-name', 'model-name', 'model-number', 'serial-number',
  'software-version', 'software-build', 'wifi-mac', 'ethernet-mac', 'network-type', 'vendor-name',
  'device-id', 'screen-size', 'supports-suspend', 'supports-private-listening', 'headphones-connected',
  'power-mode', 'developer-enabled', 'ecp-setting-mode', 'keyed-developer-id', 'is-tv'
]);

/** Pre-built regexes per tag (no dynamic RegExp from input; avoids ReDoS). */
const TAG_REGEX = Object.fromEntries(
  [...DEVICE_INFO_TAGS].map((tag) => {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [tag, new RegExp(`<${escaped}>([^<]*)</${escaped}>`)];
  })
);

/**
 * Parse device info XML from /query/device-info.
 * @param {string} xml
 * @returns {Object}
 */
function parseDeviceInfo(xml) {
  const getValue = (tag) => {
    const re = TAG_REGEX[tag];
    if (!re) return '';
    const match = xml.match(re);
    return match ? match[1] : '';
  };

  return {
    deviceName: getValue('friendly-device-name') || getValue('user-device-name') || 'Unknown Roku',
    modelName: getValue('model-name'),
    modelNumber: getValue('model-number'),
    serialNumber: getValue('serial-number'),
    softwareVersion: getValue('software-version'),
    softwareBuild: getValue('software-build'),
    wifiMac: getValue('wifi-mac'),
    ethernetMac: getValue('ethernet-mac'),
    networkType: getValue('network-type'),
    vendorName: getValue('vendor-name'),
    deviceId: getValue('device-id'),
    screenSize: getValue('screen-size'),
    supportsSuspend: getValue('supports-suspend'),
    supportsPrivateListening: getValue('supports-private-listening'),
    headphonesConnected: getValue('headphones-connected'),
    powerMode: getValue('power-mode'),
    developerEnabled: getValue('developer-enabled') === 'true',
    ecpSettingMode: getValue('ecp-setting-mode'),
    keyedDeveloperId: getValue('keyed-developer-id'),
    isTv: getValue('is-tv') === 'true'
  };
}

/**
 * Normalize ECP setting mode to one of: Disabled, Limited, Permissive, Enabled.
 * @param {*} raw
 * @returns {string}
 */
function normalizeEcpSettingMode(raw) {
  const s = (raw != null && typeof raw === 'string') ? raw.trim().toLowerCase() : '';
  if (s === 'disabled') return 'Disabled';
  if (s === 'limited') return 'Limited';
  if (s === 'permissive') return 'Permissive';
  if (s === 'enabled') return 'Enabled';
  return s ? raw.trim() : 'Disabled';
}

/**
 * Get a stable device identifier. Prefer serial number; returns null when missing
 * so callers can fall back to IP (e.g. getDeviceId(deviceInfo) || device.ip).
 * Use this for deduplication and mapping; always have a fallback when null.
 *
 * @param {Object} deviceInfo - Parsed device info (e.g. from /query/device-info)
 * @returns {string|null} Serial number if present, otherwise null (caller should use IP)
 */
function getDeviceId(deviceInfo) {
  if (deviceInfo && deviceInfo.serialNumber && deviceInfo.serialNumber.trim()) {
    return deviceInfo.serialNumber.trim();
  }
  return null;
}

/**
 * Check if a device IP is on the same subnet as any of this machine's interfaces (for Permissive mode).
 * @param {string} deviceIp
 * @returns {boolean}
 */
function isIpOnSameSubnet(deviceIp) {
  if (!deviceIp || typeof deviceIp !== 'string') return false;
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    // os.networkInterfaces() can yield undefined for a named entry; guard like the
    // discovery.ts call sites so a missing interface doesn't throw "not iterable".
    for (const iface of interfaces[name] || []) {
      if (iface.internal || iface.family !== 'IPv4') continue;
      const addr = iface.address;
      const parts = addr.split('.').map(Number);
      const devParts = deviceIp.split('.').map(Number);
      if (parts.length !== 4 || devParts.length !== 4) continue;
      const prefixLen = (parts[0] === 10) ? 16 : 24;
      const mask = prefixLen === 24 ? 3 : 2;
      let same = true;
      for (let i = 0; i < mask; i++) {
        if (parts[i] !== devParts[i]) { same = false; break; }
      }
      if (same) return true;
    }
  }
  return false;
}

/**
 * Fetch device info from a Roku device at the given IP.
 * @param {string} ip - Roku device IP
 * @param {{ timeout?: number, includeSameSubnet?: boolean }} [opts] - timeout ms (default QUERY_TIMEOUT from shared-constants); includeSameSubnet (default true) adds sameSubnet for ECP Permissive hint
 * @returns {Promise<Object>} Parsed device info with ecpSettingMode normalized and optionally sameSubnet
 */
function getDeviceInfo(
  ip: string,
  opts: { timeout?: number; includeSameSubnet?: boolean } = {}
) {
  if (!isValidIp(ip)) {
    return Promise.reject(new Error('Invalid device IP'));
  }
  // SSRF mitigated: only validated IPv4 is used (WS-I007-00019).
  const timeout = opts.timeout != null ? opts.timeout : QUERY_TIMEOUT;
  const includeSameSubnet = opts.includeSameSubnet !== false;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: ip,
      port: 8060,
      path: '/query/device-info',
      method: 'GET',
      timeout
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const info = parseDeviceInfo(data);
          info.ecpSettingMode = normalizeEcpSettingMode(info.ecpSettingMode);
          if (includeSameSubnet) {
            (info as Record<string, unknown>).sameSubnet = isIpOnSameSubnet(ip);
          }
          resolve(info);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

module.exports = {
  parseDeviceInfo,
  normalizeEcpSettingMode,
  getDeviceId,
  isIpOnSameSubnet,
  getDeviceInfo
};

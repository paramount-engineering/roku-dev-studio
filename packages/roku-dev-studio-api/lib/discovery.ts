/**
 * Shared Roku device discovery (SSDP + subnet scan).
 */

const dgram = require('dgram');
const os = require('os');
const http = require('http');
const { getDeviceInfo: fetchDeviceInfo, getDeviceId } = require('./device-info');
const { getDeviceImageUrl } = require('./device-hardware-image');

const SSDP_ADDRESS = '239.255.255.250';
const SSDP_PORT = 1900;
const ROKU_SEARCH_TARGET = 'roku:ecp';

const { errorMessage } = require('./err-util');

type SsdpDiscoverOpts = {
  onDeviceFound?: (d: unknown) => void;
  log?: (m: string) => void;
  timeout?: number;
  earlyFinishMs?: number;
  sendCount?: number;
  sendInterval?: number;
};

type SubnetScanOpts = {
  onDeviceFound?: (d: unknown) => void;
  log?: (m: string) => void;
  requestTimeout?: number;
  concurrency?: number;
};

function upsertDevice(devices, ipToDeviceId, ip, port, deviceInfo, onDeviceFound) {
  const deviceId = getDeviceId(deviceInfo) || ip;
  const existingDevice = devices.get(deviceId);
  const existingKeyForIp = ipToDeviceId.get(ip);

  if (existingDevice && existingDevice.ip === ip) {
    Object.assign(existingDevice, deviceInfo);
    existingDevice.ip = ip;
    existingDevice.port = port;
    if (existingKeyForIp !== deviceId) {
      devices.delete(existingKeyForIp);
      ipToDeviceId.delete(ip);
    }
    devices.set(deviceId, existingDevice);
    ipToDeviceId.set(ip, deviceId);
    if (onDeviceFound) onDeviceFound(existingDevice);
    return existingDevice;
  }
  if (existingKeyForIp !== undefined) {
    const previous = devices.get(existingKeyForIp);
    if (previous) devices.delete(existingKeyForIp);
  }
  const device = { ip, port, ...deviceInfo };
  devices.set(deviceId, device);
  ipToDeviceId.set(ip, deviceId);
  if (onDeviceFound) onDeviceFound(device);
  return device;
}

function updateDeviceIp(devices, ipToDeviceId, deviceId, ip, port, deviceInfo, onDeviceFound) {
  const existingDevice = devices.get(deviceId);
  if (!existingDevice) return null;
  ipToDeviceId.delete(existingDevice.ip);
  existingDevice.ip = ip;
  existingDevice.port = port;
  Object.assign(existingDevice, deviceInfo);
  ipToDeviceId.set(ip, deviceId);
  if (onDeviceFound) onDeviceFound(existingDevice);
  return existingDevice;
}

function ssdpDiscover(opts: SsdpDiscoverOpts = {}) {
  const onDeviceFound = opts.onDeviceFound;
  const log = opts.log || (() => {});
  const timeout = opts.timeout != null ? opts.timeout : 6000;
  const earlyFinishMs = opts.earlyFinishMs != null ? opts.earlyFinishMs : 2500;
  const sendCount = opts.sendCount != null ? opts.sendCount : 8;
  const sendInterval = opts.sendInterval != null ? opts.sendInterval : 400;

  return new Promise((resolve, reject) => {
    const devices = new Map();
    const ipToDeviceId = new Map();
    let resolved = false;
    let earlyFinishTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (earlyFinishTimer) clearTimeout(earlyFinishTimer);
      try { socket.close(); } catch (e) {}
      log('SSDP discovery complete, found ' + devices.size + ' devices');
      resolve(Array.from(devices.values()));
    };

    const scheduleEarlyFinish = () => {
      if (earlyFinishTimer) clearTimeout(earlyFinishTimer);
      if (devices.size > 0) {
        earlyFinishTimer = setTimeout(() => {
          if (!resolved && devices.size > 0) {
            log('Early finish - no new devices for ' + earlyFinishMs + 'ms');
            finish();
          }
        }, earlyFinishMs);
      }
    };

    let socket;
    try {
      socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    } catch (err: unknown) {
      log('Failed to create socket: ' + errorMessage(err));
      reject(err);
      return;
    }

    const searchMessage = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\n' +
      `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}\r\n` +
      'MAN: "ssdp:discover"\r\n' +
      'MX: 3\r\n' +
      `ST: ${ROKU_SEARCH_TARGET}\r\n` +
      '\r\n'
    );

    socket.on('message', async (msg, rinfo) => {
      const response = msg.toString();
      log('Received SSDP response from: ' + rinfo.address);

      const locationMatch = response.match(/LOCATION:\s*http:\/\/([^:]+):(\d+)/i);
      if (!locationMatch) return;

      const ip = locationMatch[1];
      const port = locationMatch[2];

      try {
        const ecpPort = parseInt(String(port), 10) || 8060;
        const [deviceInfo, deviceImageUrl] = await Promise.all([
          fetchDeviceInfo(ip, { includeSameSubnet: true }),
          getDeviceImageUrl(ip, { port: ecpPort }).catch(() => null)
        ]);

        const deviceId = getDeviceId(deviceInfo) || ip;
        const existingDevice = devices.get(deviceId);
        const existingKeyForIp = ipToDeviceId.get(ip);

        const enriched = {
          ...deviceInfo,
          ...(deviceImageUrl ? { deviceImageUrl } : {})
        };

        if (existingDevice && existingDevice.ip === ip) {
          upsertDevice(devices, ipToDeviceId, ip, port, enriched, onDeviceFound);
          scheduleEarlyFinish();
        } else if (existingKeyForIp !== undefined) {
          const previous = devices.get(existingKeyForIp);
          if (previous) devices.delete(existingKeyForIp);
          const device = { ip, port, ...enriched };
          devices.set(deviceId, device);
          ipToDeviceId.set(ip, deviceId);
          if (onDeviceFound) onDeviceFound(device);
          scheduleEarlyFinish();
        } else if (!existingDevice) {
          const device = { ip, port, ...enriched };
          devices.set(deviceId, device);
          ipToDeviceId.set(ip, deviceId);
          if (onDeviceFound) onDeviceFound(device);
          scheduleEarlyFinish();
        } else if (existingDevice.ip !== ip) {
          log('Device ' + deviceId + ' IP changed from ' + existingDevice.ip + ' to ' + ip);
          updateDeviceIp(devices, ipToDeviceId, deviceId, ip, port, enriched, onDeviceFound);
        }
      } catch (e: unknown) {
        log('Failed to get device info for ' + ip + ': ' + errorMessage(e));
      }
    });

    socket.on('error', (err) => {
      log('SSDP socket error: ' + err.message);
      if (!resolved) {
        resolved = true;
        if (earlyFinishTimer) clearTimeout(earlyFinishTimer);
        try { socket.close(); } catch (e) {}
        reject(err);
      }
    });

    socket.bind({ address: '0.0.0.0', port: 0, exclusive: false }, () => {
      const address = socket.address();
      log('SSDP socket bound to ' + address.address + ':' + address.port);

      try { socket.setBroadcast(true); } catch (e) {}
      try { socket.setMulticastTTL(4); } catch (e) {}
      try { socket.addMembership(SSDP_ADDRESS); } catch (e) {}
      try { socket.addMembership(SSDP_ADDRESS, '0.0.0.0'); } catch (e) {}

      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          if (iface.family === 'IPv4' && !iface.internal) {
            try {
              socket.addMembership(SSDP_ADDRESS, iface.address);
            } catch (e) {}
          }
        }
      }

      log('Sending SSDP discovery messages...');
      for (let i = 0; i < sendCount; i++) {
        setTimeout(() => {
          if (resolved) return;
          try {
            socket.send(searchMessage, 0, searchMessage.length, SSDP_PORT, SSDP_ADDRESS);
          } catch (e: unknown) {
            log('Failed to send SSDP message: ' + errorMessage(e));
          }
        }, i * sendInterval);
      }
    });

    setTimeout(finish, timeout);
  });
}

function subnetScan(opts: SubnetScanOpts = {}) {
  const onDeviceFound = opts.onDeviceFound;
  const log = opts.log || (() => {});
  const requestTimeout = opts.requestTimeout != null ? opts.requestTimeout : 500;
  const concurrency = opts.concurrency != null ? opts.concurrency : 50;

  const interfaces = os.networkInterfaces();
  const subnets: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        if (parts.length === 4) {
          subnets.push(parts[0] + '.' + parts[1] + '.' + parts[2]);
        }
      }
    }
  }

  if (subnets.length === 0) {
    log('No subnets to scan');
    return Promise.resolve([]);
  }

  const devices = new Map();
  const ipToDeviceId = new Map();
  const allHosts: string[] = [];
  for (const subnet of subnets) {
    for (let host = 1; host <= 254; host++) {
      allHosts.push(subnet + '.' + host);
    }
  }

  function probe(ip: string): Promise<void> {
    return new Promise<void>((resolveScan) => {
      const req = http.get('http://' + ip + ':8060/query/device-info', { timeout: requestTimeout }, (res) => {
        if (res.statusCode !== 200) {
          resolveScan();
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (!data.includes('<device-info>') || !data.includes('Roku')) {
            resolveScan();
            return;
          }
          Promise.all([
            fetchDeviceInfo(ip, { includeSameSubnet: true }),
            getDeviceImageUrl(ip).catch(() => null)
          ])
            .then(([deviceInfo, deviceImageUrl]) => {
              if (deviceInfo) {
                const deviceId = getDeviceId(deviceInfo) || ip;
                const existingKeyForIp = ipToDeviceId.get(ip);
                if (existingKeyForIp !== undefined && existingKeyForIp !== deviceId) {
                  devices.delete(existingKeyForIp);
                }
                const device = {
                  ip,
                  port: 8060,
                  ...deviceInfo,
                  ...(deviceImageUrl ? { deviceImageUrl } : {})
                };
                devices.set(deviceId, device);
                ipToDeviceId.set(ip, deviceId);
                if (onDeviceFound) onDeviceFound(device);
              }
            })
            .catch(() => {})
            .then(resolveScan);
        });
      });
      req.on('error', () => resolveScan());
      req.on('timeout', () => {
        req.destroy();
        resolveScan();
      });
    });
  }

  let index = 0;
  function runBatch(): Promise<void> {
    const batch: Promise<void>[] = [];
    while (batch.length < concurrency && index < allHosts.length) {
      batch.push(probe(allHosts[index++]));
    }
    if (batch.length === 0) return Promise.resolve();
    return Promise.all(batch).then(() => (index < allHosts.length ? runBatch() : undefined));
  }

  return runBatch().then(() => {
    log('Subnet scan complete, found ' + devices.size + ' devices');
    return Array.from(devices.values());
  });
}

module.exports = {
  ssdpDiscover,
  subnetScan
};

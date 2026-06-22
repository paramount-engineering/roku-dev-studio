import * as http from 'http';
import type { HotspotClientDevice } from './types';

const { getDeviceInfo: fetchDeviceInfo } = require('roku-dev-studio-api') as {
  getDeviceInfo: (
    ip: string,
    opts?: { includeSameSubnet?: boolean }
  ) => Promise<Record<string, unknown> | null>;
};

type ProbeResult = HotspotClientDevice | null;

// Dedicated, bounded agent for the /24 sweep so the 254-host scan can't pile sockets onto Node's
// unbounded global agent (EMFILE risk if scans ever overlap). keepAlive:false closes each socket
// right after the probe; maxSockets caps concurrent connections a little above the worker count.
const probeAgent = new http.Agent({ keepAlive: false, maxSockets: 64 });

function probeRokuOnHotspot(ip: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const req = http.get(
      `http://${ip}:8060/query/device-info`,
      { timeout: 1200, agent: probeAgent },
      (res) => {
        if (res.statusCode !== 200) {
          // Free the socket immediately — an unconsumed response body keeps the connection open
          // until it drains or times out.
          res.destroy();
          resolve(null);
          return;
        }
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (!data.includes('<device-info>') || !data.includes('Roku')) {
            resolve(null);
            return;
          }
          fetchDeviceInfo(ip, { includeSameSubnet: true })
            .then((info) => {
              if (!info) {
                resolve(null);
                return;
              }
              const serial =
                typeof info.serialNumber === 'string' && info.serialNumber.trim()
                  ? info.serialNumber.trim()
                  : undefined;
              resolve({
                ip,
                serialNumber: serial,
                deviceName:
                  typeof info.deviceName === 'string' ? info.deviceName : undefined,
                modelName: typeof info.modelName === 'string' ? info.modelName : undefined,
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString()
              });
            })
            .catch(() => resolve(null));
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

export async function scanHotspotSubnet(
  subnetPrefix: string,
  concurrency = 40
): Promise<HotspotClientDevice[]> {
  const hosts: string[] = [];
  for (let host = 1; host <= 254; host++) {
    hosts.push(`${subnetPrefix}.${host}`);
  }
  const found: HotspotClientDevice[] = [];
  let index = 0;
  async function worker(): Promise<void> {
    while (index < hosts.length) {
      const ip = hosts[index];
      index += 1;
      const result = await probeRokuOnHotspot(ip);
      if (result) found.push(result);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, hosts.length) }, () => worker());
  await Promise.all(workers);
  return found;
}

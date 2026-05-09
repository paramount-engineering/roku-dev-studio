#!/usr/bin/env node
/**
 * Sample: use roku-dev-studio-api on the same LAN as the Roku (direct ECP).
 *
 * From monorepo root (after `npm install`):
 *   node packages/roku-dev-studio-api/examples/direct-sample.js
 *   node packages/roku-dev-studio-api/examples/direct-sample.js 192.168.1.10
 *
 * From this package directory:
 *   npm run example:direct
 *   npm run example:direct -- 192.168.1.10
 */

'use strict';

const {
  ssdpDiscover,
  isValidIp,
  testConnection,
  query,
  keypress
} = require('roku-dev-studio-api');

async function main() {
  let ip = process.argv[2];

  if (ip && !isValidIp(ip)) {
    console.error('Invalid IPv4:', ip);
    process.exit(1);
  }

  if (!ip) {
    console.log('No IP passed — discovering via SSDP (~5s)...');
    const devices = await ssdpDiscover({ timeout: 5000, log: () => {} });
    ip = devices[0]?.ip;
    if (!ip) {
      console.error('No Roku found. Set IP explicitly:');
      console.error('  node examples/direct-sample.js 192.168.1.10');
      process.exit(1);
    }
    console.log('Using first device:', ip);
  }

  const conn = await testConnection(ip);
  if (!conn.success) {
    console.error('testConnection failed:', conn.error);
    process.exit(1);
  }

  const name = conn.deviceInfo?.deviceName || ip;
  console.log('Connected:', name);

  const home = await keypress(ip, 'Home');
  console.log('Home key:', home.success ? 'sent' : home.error);

  const apps = await query(ip, '/query/apps');
  if (apps.success) {
    console.log('/query/apps:', `HTTP ${apps.status}, ${(apps.data || '').length} bytes XML`);
  } else {
    console.log('/query/apps failed:', apps.error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

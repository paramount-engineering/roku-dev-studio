#!/usr/bin/env node
/**
 * Sample: use roku-dev-studio-api against Roku Dev Studio Remote Server (relay).
 *
 * Args: <relayBaseUrl> <rokuIpOnRelayLan>
 *
 * From monorepo root (after `npm install`):
 *   node packages/roku-dev-studio-api/examples/relay-sample.js http://mac-mini.local:4951 192.168.1.10
 *
 * From this package directory:
 *   npm run example:relay -- http://localhost:4951 192.168.1.10
 */

'use strict';

const { createRelayClient, validateRelayBaseUrl } = require('roku-dev-studio-api');

async function main() {
  const relayUrl = process.argv[2];
  const deviceIp = process.argv[3];

  if (!relayUrl || !deviceIp) {
    console.error('Usage: node examples/relay-sample.js <http://relay-host:port> <roku-ip-on-relay-lan>');
    console.error('Example: node examples/relay-sample.js http://192.168.1.5:4951 10.0.0.42');
    process.exit(1);
  }

  const baseUrl = validateRelayBaseUrl(relayUrl);
  const client = createRelayClient({ baseUrl, timeout: 15000 });

  console.log('Relay:', baseUrl);

  const devices = await client.discover();
  console.log('discover():', devices.length, 'device(s)');
  if (devices.length) {
    console.log('  first:', devices[0].ip || devices[0]);
  }

  try {
    const info = await client.getDeviceInfo(deviceIp);
    console.log('getDeviceInfo(' + deviceIp + '):', info.deviceName || '(no name)', info.modelName || '');
  } catch (e: unknown) {
    console.error('getDeviceInfo failed:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  const kp = await client.keypress(deviceIp, 'Home');
  console.log('keypress Home:', kp.success !== false ? 'ok' : (kp.error || 'failed'));

  const q = await client.query(deviceIp, '/query/device-info');
  const ok = q && (q.success === true || q.data);
  console.log(
    'query /query/device-info:',
    ok ? `HTTP ${q.statusCode || q.status || 'ok'}, ${String(q.data || '').length} bytes` : (q.error || 'failed')
  );

  // Multipart sideload: pass a local file path (or Buffer) via `file`.
  // Uncomment and set a real path + password to test:
  //
  // const sideloadResult = await client.sideload(deviceIp, {
  //   file: '/path/to/local/channel.zip',
  //   password: 'your-dev-password',
  // });
  // console.log('sideload (upload):', sideloadResult.success ? 'ok' : (sideloadResult.error || 'failed'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

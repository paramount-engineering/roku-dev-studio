// Device discovery IPC handlers (use shared lib for SSDP + subnet scan)

import type { BrowserWindow } from 'electron';
import type { GetDeviceIdFn, GetDeviceInfoFn, SafeSendFn } from '../../shared/ipc/payloads';
import { IPC } from '../../shared/ipc/channels';
import { detectHotspotInterface } from '../network-inspector/index';
import { loadSettings } from '../settings';

const { ssdpDiscover, subnetScan } = require('roku-dev-studio-api');

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Setup device discovery IPC handlers
 */
function setupDeviceDiscovery(
  _mainWindow: BrowserWindow | undefined,
  _getDeviceInfo: GetDeviceInfoFn,
  _getDeviceId: GetDeviceIdFn,
  safeSendToRenderer: SafeSendFn
) {
  const { ipcMain } = require('electron');

  ipcMain.handle(IPC.RokuDiscover, async () => {
    console.log('=== SSDP Discovery Started ===');
    try {
      const devices = await ssdpDiscover({
        onDeviceFound: (device: unknown) => safeSendToRenderer(IPC.RokuDeviceFound, device),
        log: (msg: unknown) => console.log(msg)
      });
      console.log('=== SSDP Discovery Complete ===');
      console.log(
        'Found',
        devices.length,
        'devices:',
        devices.map((d: { serialNumber?: string; ip?: string }) => d.serialNumber || d.ip)
      );
      return { success: true, devices };
    } catch (err: unknown) {
      console.error('SSDP discovery error:', err);
      return { success: false, error: errMsg(err) || 'Discovery failed', devices: [] };
    }
  });

  ipcMain.handle(IPC.RokuScanSubnet, async () => {
    console.log('=== Subnet Scan Started ===');
    try {
      const settings = loadSettings();
      const networkInspectorEnabled = settings['networkInspectorEnabled'] === true;
      const extraSubnetPrefixes: string[] = [];
      if (networkInspectorEnabled) {
        const hotspot = detectHotspotInterface();
        if (hotspot) {
          extraSubnetPrefixes.push(hotspot.subnet);
          console.log(
            'Network Inspector: including hotspot subnet',
            hotspot.subnet + '.0/24',
            'on',
            hotspot.name
          );
        } else {
          console.log(
            'Network Inspector enabled but no hotspot interface detected — scanning LAN subnets only'
          );
        }
      }
      const devices = await subnetScan({
        extraSubnetPrefixes,
        onDeviceFound: (device: unknown) => safeSendToRenderer(IPC.RokuDeviceFound, device),
        log: (msg: unknown) => console.log(msg)
      });
      console.log('=== Subnet Scan Complete ===');
      console.log('Found', devices.length, 'devices');
      return { success: true, devices };
    } catch (err: unknown) {
      console.error('Subnet scan error:', err);
      return { success: false, error: errMsg(err) || 'Scan failed', devices: [] };
    }
  });
}

export { setupDeviceDiscovery };

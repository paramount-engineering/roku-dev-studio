// Device discovery IPC handlers (use shared lib for SSDP + subnet scan)

import type { BrowserWindow } from 'electron';
import type { GetDeviceIdFn, GetDeviceInfoFn, SafeSendFn } from '../../shared/ipc/payloads';
import { IPC } from '../../shared/ipc/channels';
import { detectHotspotInterface } from '../network-inspector/index';
import { loadSettings } from '../settings';
import { mainLog, mainError } from '../log.js';
import { isRelaySelfDevice } from '../sideload-relay/fake-device-info';

const { ssdpDiscover, subnetScan } = require('roku-dev-studio-api');

/** The relay may advertise RDS as a Roku (for VS Code discovery); never list it as a real device. */
function dropRelaySelf(devices: any[]): any[] {
  return devices.filter((d) => !isRelaySelfDevice(d as { serialNumber?: unknown; modelName?: unknown }));
}

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
    mainLog('=== SSDP Discovery Started ===');
    try {
      const found = await ssdpDiscover({
        onDeviceFound: (device: unknown) => {
          if (isRelaySelfDevice(device as { serialNumber?: unknown; modelName?: unknown })) return;
          safeSendToRenderer(IPC.RokuDeviceFound, device);
        },
        log: (msg: unknown) => mainLog(msg)
      });
      const devices = dropRelaySelf(found);
      mainLog('=== SSDP Discovery Complete ===');
      mainLog(
        'Found',
        devices.length,
        'devices:',
        devices.map((d: { serialNumber?: string; ip?: string }) => d.serialNumber || d.ip)
      );
      return { success: true, devices };
    } catch (err: unknown) {
      mainError('SSDP discovery error:', err);
      return { success: false, error: errMsg(err) || 'Discovery failed', devices: [] };
    }
  });

  ipcMain.handle(IPC.RokuScanSubnet, async () => {
    mainLog('=== Subnet Scan Started ===');
    try {
      const settings = loadSettings();
      const networkInspectorEnabled = settings['networkInspectorEnabled'] === true;
      const extraSubnetPrefixes: string[] = [];
      if (networkInspectorEnabled) {
        const hotspot = detectHotspotInterface();
        if (hotspot) {
          extraSubnetPrefixes.push(hotspot.subnet);
          mainLog(
            'Network Inspector: including hotspot subnet',
            hotspot.subnet + '.0/24',
            'on',
            hotspot.name
          );
        } else {
          mainLog(
            'Network Inspector enabled but no hotspot interface detected — scanning LAN subnets only'
          );
        }
      }
      const found = await subnetScan({
        extraSubnetPrefixes,
        onDeviceFound: (device: unknown) => {
          if (isRelaySelfDevice(device as { serialNumber?: unknown; modelName?: unknown })) return;
          safeSendToRenderer(IPC.RokuDeviceFound, device);
        },
        log: (msg: unknown) => mainLog(msg)
      });
      const devices = dropRelaySelf(found);
      mainLog('=== Subnet Scan Complete ===');
      mainLog('Found', devices.length, 'devices');
      return { success: true, devices };
    } catch (err: unknown) {
      mainError('Subnet scan error:', err);
      return { success: false, error: errMsg(err) || 'Scan failed', devices: [] };
    }
  });
}

export { setupDeviceDiscovery };

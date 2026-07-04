/**
 * Sideload Relay IPC handlers.
 *
 * Assembles the relay boot config from `app-settings.json` (flags + targets)
 * plus the encrypted secret store (relay + per-target passwords), boots the
 * service on startup, and re-boots it when the renderer applies settings.
 * Mirrors `network-inspector-handlers.ts`.
 */

import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type { SafeSendFn } from '../../shared/ipc/payloads';
import type { RelayBootConfig, RelayTarget } from '../../shared/sideload-relay/types';
import { loadSettings, saveSettings } from '../settings';
import { getSideloadRelayService, initSideloadRelayFromSettings } from '../sideload-relay/index';
import { isRelaySelfDevice } from '../sideload-relay/fake-device-info';

const { mainLog, mainWarn } = require('../log');
const secretStore = require('../secret-store') as typeof import('../secret-store');
const rokuApi = require('roku-dev-studio-api') as {
  ssdpDiscover: (opts?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
  subnetScan: (opts?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
};

const { DEFAULT_RELAY_PORT } = require('../../shared/sideload-relay/types');

/** Secret-store key for the shared relay Digest password. */
const RELAY_PASSWORD_KEY = 'sideload-relay';
/** Secret-store key prefix for per-target passwords. */
const TARGET_PASSWORD_PREFIX = 'sideload-relay-target:';

function readTargets(settings: Record<string, unknown>): RelayTarget[] {
  const raw = settings['sideloadRelayTargets'];
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: RelayTarget[] = [];
  let primaryTaken = false;
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const ip = typeof e.ip === 'string' ? e.ip.trim() : '';
    if (!ip) continue;
    const id = typeof e.id === 'string' && e.id.trim() ? e.id.trim() : ip;
    if (seen.has(id)) continue;
    seen.add(id);
    // Only one primary survives (last write would win otherwise).
    const primary = e.primary === true && !primaryTaken;
    if (primary) primaryTaken = true;
    out.push({
      id,
      ip,
      port: typeof e.port === 'number' ? e.port : undefined,
      name: typeof e.name === 'string' && e.name.trim() ? e.name.trim() : ip,
      enabled: e.enabled !== false,
      primary
    });
  }
  return out;
}

function readBootConfig(settings: Record<string, unknown>): RelayBootConfig {
  const targets = readTargets(settings);
  const portRaw = settings['sideloadRelayPort'];
  const requestedPort =
    typeof portRaw === 'number' && portRaw > 0 && portRaw < 65536 ? Math.floor(portRaw) : DEFAULT_RELAY_PORT;

  let allPasswords: Record<string, string> = {};
  try {
    allPasswords = secretStore.getAllPasswords();
  } catch {
    allPasswords = {};
  }
  const targetPasswords: Record<string, string> = {};
  for (const t of targets) {
    const pw = allPasswords[`${TARGET_PASSWORD_PREFIX}${t.id}`];
    if (pw) targetPasswords[t.id] = pw;
  }

  return {
    enabled: settings['sideloadRelayEnabled'] === true,
    requestedPort,
    password: allPasswords[RELAY_PASSWORD_KEY] || '',
    targets,
    targetPasswords,
    autoLaunch: settings['sideloadRelayAutoLaunch'] !== false,
    autoConsole: settings['sideloadRelayAutoConsole'] !== false,
    debugProxyEnabled: settings['sideloadRelayDebugProxyEnabled'] === true,
    retryOnFailure: settings['sideloadRelayRetryOnFailure'] === true
  };
}

/** Renderer-safe config view — never includes passwords. */
function sanitizedConfig(settings: Record<string, unknown>) {
  const cfg = readBootConfig(settings);
  let hasPassword = false;
  try {
    hasPassword = !!secretStore.getAllPasswords()[RELAY_PASSWORD_KEY];
  } catch {
    hasPassword = false;
  }
  return {
    enabled: cfg.enabled,
    requestedPort: cfg.requestedPort,
    targets: cfg.targets,
    autoLaunch: cfg.autoLaunch,
    autoConsole: cfg.autoConsole,
    debugProxyEnabled: cfg.debugProxyEnabled,
    retryOnFailure: cfg.retryOnFailure,
    hasPassword
  };
}

function setupRelayHandlers(_mainWindow: BrowserWindow | undefined, safeSendToRenderer: SafeSendFn) {
  const { ipcMain, app } = require('electron') as typeof import('electron');

  function syncFromDisk(): void {
    const settings = loadSettings();
    initSideloadRelayFromSettings(safeSendToRenderer, readBootConfig(settings));
  }

  syncFromDisk();

  app?.once('will-quit', () => {
    try {
      void getSideloadRelayService(safeSendToRenderer).dispose();
    } catch {
      /* ignore */
    }
  });

  ipcMain.handle(IPC.SideloadRelayGetStatus, async () => {
    const svc = getSideloadRelayService(safeSendToRenderer);
    return { success: true, status: svc.getStatus(), lastRun: svc.getLastRun() };
  });

  ipcMain.handle(IPC.SideloadRelayGetConfig, async () => {
    return { success: true, config: sanitizedConfig(loadSettings()) };
  });

  ipcMain.handle(
    IPC.SideloadRelayApplySettings,
    async (
      _event: IpcMainInvokeEvent,
      payload: {
        enabled?: boolean;
        requestedPort?: number;
        targets?: unknown;
        targetPasswords?: Record<string, string> | null;
        autoLaunch?: boolean;
        autoConsole?: boolean;
        debugProxyEnabled?: boolean;
        retryOnFailure?: boolean;
        password?: string | null;
      }
    ) => {
      const settings = loadSettings();
      if (typeof payload?.enabled === 'boolean') settings['sideloadRelayEnabled'] = payload.enabled;
      if (typeof payload?.requestedPort === 'number' && payload.requestedPort > 0 && payload.requestedPort < 65536) {
        settings['sideloadRelayPort'] = Math.floor(payload.requestedPort);
      }
      if (typeof payload?.autoLaunch === 'boolean') settings['sideloadRelayAutoLaunch'] = payload.autoLaunch;
      if (typeof payload?.autoConsole === 'boolean') settings['sideloadRelayAutoConsole'] = payload.autoConsole;
      if (typeof payload?.debugProxyEnabled === 'boolean') {
        settings['sideloadRelayDebugProxyEnabled'] = payload.debugProxyEnabled;
      }
      if (typeof payload?.retryOnFailure === 'boolean') {
        settings['sideloadRelayRetryOnFailure'] = payload.retryOnFailure;
      }
      if (Array.isArray(payload?.targets)) {
        // Persist only the renderer-safe fields via readTargets normalization.
        settings['sideloadRelayTargets'] = readTargets({ sideloadRelayTargets: payload.targets });
      }
      if (!saveSettings(settings)) {
        return { success: false, error: 'Could not write settings file.' };
      }

      // Passwords go straight to the encrypted secret store, never to app-settings.json.
      if (typeof payload?.password === 'string') {
        if (payload.password) secretStore.setPassword(RELAY_PASSWORD_KEY, payload.password);
        else secretStore.deletePassword(RELAY_PASSWORD_KEY);
      }
      if (payload?.targetPasswords && typeof payload.targetPasswords === 'object') {
        for (const [id, pw] of Object.entries(payload.targetPasswords)) {
          const key = `${TARGET_PASSWORD_PREFIX}${id}`;
          if (typeof pw === 'string' && pw) secretStore.setPassword(key, pw);
          else secretStore.deletePassword(key);
        }
      }

      syncFromDisk();
      return { success: true, status: getSideloadRelayService(safeSendToRenderer).getStatus() };
    }
  );

  ipcMain.handle(IPC.SideloadRelaySeedTargets, async (_event: IpcMainInvokeEvent, payload?: { includeSubnetScan?: boolean }) => {
    try {
      const ssdp = await rokuApi.ssdpDiscover({ timeout: 5000 });
      const subnet = payload?.includeSubnetScan ? await rokuApi.subnetScan({}) : [];
      const byIp = new Map<string, RelayTarget>();
      for (const d of [...ssdp, ...subnet]) {
        // Never seed the relay's own SSDP advertisement as a target.
        if (isRelaySelfDevice(d as { serialNumber?: unknown; modelName?: unknown })) continue;
        const ip = typeof d.ip === 'string' ? d.ip : '';
        if (!ip || byIp.has(ip)) continue;
        const serial = typeof d.serialNumber === 'string' && d.serialNumber ? d.serialNumber : ip;
        const name =
          (typeof d.deviceName === 'string' && d.deviceName) ||
          (typeof d.modelName === 'string' && d.modelName) ||
          ip;
        byIp.set(ip, { id: serial, ip, name, enabled: true, primary: false });
      }
      return { success: true, candidates: Array.from(byIp.values()) };
    } catch (e) {
      mainWarn('[SideloadRelay] seed-targets discovery failed:', (e as Error)?.message || e);
      return { success: false, error: (e as Error)?.message || 'Discovery failed', candidates: [] };
    }
  });

  mainLog('[SideloadRelay] IPC handlers registered');
}

export { setupRelayHandlers };

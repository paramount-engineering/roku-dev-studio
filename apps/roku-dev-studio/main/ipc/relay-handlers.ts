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
import { S } from '../../shared/strings/index';
import type { SafeSendFn } from '../../shared/ipc/payloads';
import type { RelayBootConfig, RelayTarget, RelayDeviceCandidate } from '../../shared/sideload-relay/types';
import { loadSettings, saveSettings } from '../settings';
import { getSideloadRelayService, initSideloadRelayFromSettings } from '../sideload-relay/index';
import { isRelaySelfDevice } from '../sideload-relay/fake-device-info';
import { remoteHttpRequest } from '../remote-http';
import { readRemoteLocations } from '../remote-locations';
import { recordRemoteDeviceSeen } from '../remote-device-registry';

const { mainLog, mainWarn } = require('../log');
const secretStore = require('../secret-store') as typeof import('../secret-store');
const rokuApi = require('roku-dev-studio-api') as {
  ssdpDiscover: (opts?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
  subnetScan: (opts?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
  verifyDeveloperDigestAuth: (opts: { ip: string; password: string }) => Promise<{ success: boolean; error?: string; authFailed?: boolean }>;
};

const { DEFAULT_RELAY_PORT } = require('../../shared/sideload-relay/types');

/** Secret-store key for the shared relay Digest password. */
const RELAY_PASSWORD_KEY = 'sideload-relay';
/** Secret-store key prefix for per-target passwords. */
const TARGET_PASSWORD_PREFIX = 'sideload-relay-target:';

/** True when the shared device credential (keyed by serial, else ip) is stored — the same store the Dev App uses. */
function deviceHasStoredPassword(id: string, serial: string | undefined, allPasswords: Record<string, string>): boolean {
  return !!allPasswords[serial || id];
}

/**
 * Map an arbitrary discovered-device object to a candidate row. Returns null for
 * non-dev-enabled devices (nothing can be sideloaded to them) — local devices
 * must report `developerEnabled === true`; remote devices are trusted unless
 * they explicitly report `false` (their server already curates dev devices).
 */
function toCandidate(
  d: Record<string, unknown>,
  location: string,
  remote: boolean,
  allPasswords: Record<string, string>,
  serverUrl?: string,
  locationId?: string
): RelayDeviceCandidate | null {
  const ip = typeof d.ip === 'string' ? d.ip : '';
  if (!ip) return null;
  const devEnabled = remote ? d.developerEnabled !== false : d.developerEnabled === true;
  if (!devEnabled) return null;
  const serial =
    (typeof d.serialNumber === 'string' && d.serialNumber) || (typeof d.serial === 'string' && d.serial) || '';
  const name =
    (typeof d.deviceName === 'string' && d.deviceName) ||
    (typeof d.friendlyDeviceName === 'string' && d.friendlyDeviceName) ||
    (typeof d.modelName === 'string' && d.modelName) ||
    ip;
  const id = serial || ip;
  return {
    id,
    ip,
    name,
    serial: serial || undefined,
    location,
    remote,
    serverUrl,
    locationId,
    hasPassword: deviceHasStoredPassword(id, serial || undefined, allPasswords)
  };
}

function readTargets(settings: Record<string, unknown>): RelayTarget[] {
  const raw = settings['sideloadRelayTargets'];
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: RelayTarget[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const ip = typeof e.ip === 'string' ? e.ip.trim() : '';
    if (!ip) continue;
    const id = typeof e.id === 'string' && e.id.trim() ? e.id.trim() : ip;
    if (seen.has(id)) continue;
    seen.add(id);
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    out.push({
      id,
      ip,
      port: typeof e.port === 'number' ? e.port : undefined,
      name: typeof e.name === 'string' && e.name.trim() ? e.name.trim() : ip,
      enabled: e.enabled !== false,
      serial: str(e.serial),
      location: str(e.location),
      remote: e.remote === true,
      serverUrl: str(e.serverUrl),
      locationId: str(e.locationId)
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
    // One source of truth: the shared device credential keyed by serial (else ip) —
    // the same one the Dev App / sideloading / Action Scripts save & read.
    const pw = allPasswords[t.serial || t.id];
    if (pw) targetPasswords[t.id] = pw;
  }

  return {
    enabled: settings['sideloadRelayEnabled'] === true,
    requestedPort,
    password: allPasswords[RELAY_PASSWORD_KEY] || '',
    targets,
    targetPasswords,
    autoConsole: settings['sideloadRelayAutoConsole'] !== false,
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
    autoConsole: cfg.autoConsole,
    retryOnFailure: cfg.retryOnFailure,
    hasPassword
  };
}

function setupRelayHandlers(
  _mainWindow: BrowserWindow | undefined,
  safeSendToRenderer: SafeSendFn,
  state: { privacyModeEnabled: boolean }
) {
  const { ipcMain, app } = require('electron') as typeof import('electron');
  // Read live, not snapshotted here — `state` is the same object System Handlers' Privacy Mode
  // toggle mutates, so a toggle mid-run is reflected on the very next status line.
  const isPrivacyModeEnabled = () => state.privacyModeEnabled;

  // One-time migration: fold any legacy per-relay device passwords
  // (`sideload-relay-target:<serial|ip>`) into the shared device-credential store
  // keyed by serial/ip, then drop the parallel key. Keeps a single flow.
  try {
    const all = secretStore.getAllPasswords();
    for (const k of Object.keys(all)) {
      if (!k.startsWith(TARGET_PASSWORD_PREFIX)) continue;
      const deviceKey = k.slice(TARGET_PASSWORD_PREFIX.length);
      if (deviceKey && !all[deviceKey]) secretStore.setPassword(deviceKey, all[k]);
      secretStore.deletePassword(k);
    }
  } catch {
    /* best-effort migration */
  }

  function syncFromDisk(): void {
    const settings = loadSettings();
    initSideloadRelayFromSettings(safeSendToRenderer, readBootConfig(settings), isPrivacyModeEnabled);
  }

  syncFromDisk();

  app?.once('will-quit', () => {
    try {
      void getSideloadRelayService(safeSendToRenderer, isPrivacyModeEnabled).dispose();
    } catch {
      /* ignore */
    }
  });

  ipcMain.handle(IPC.SideloadRelayGetStatus, async () => {
    const svc = getSideloadRelayService(safeSendToRenderer, isPrivacyModeEnabled);
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
        autoConsole?: boolean;
        retryOnFailure?: boolean;
        password?: string | null;
      }
    ) => {
      const settings = loadSettings();
      if (typeof payload?.enabled === 'boolean') settings['sideloadRelayEnabled'] = payload.enabled;
      if (typeof payload?.requestedPort === 'number' && payload.requestedPort > 0 && payload.requestedPort < 65536) {
        settings['sideloadRelayPort'] = Math.floor(payload.requestedPort);
      }
      if (typeof payload?.autoConsole === 'boolean') settings['sideloadRelayAutoConsole'] = payload.autoConsole;
      if (typeof payload?.retryOnFailure === 'boolean') {
        settings['sideloadRelayRetryOnFailure'] = payload.retryOnFailure;
      }
      if (Array.isArray(payload?.targets)) {
        // Persist only the renderer-safe fields via readTargets normalization.
        settings['sideloadRelayTargets'] = readTargets({ sideloadRelayTargets: payload.targets });
      }
      if (!saveSettings(settings)) {
        return { success: false, error: S.sideloadRelay.errCouldNotWriteSettings };
      }

      // Only the Relay Dev Password (IDE→RDS auth) is relay-owned; per-device
      // credentials live in the shared store, set via SideloadRelayValidatePassword.
      if (typeof payload?.password === 'string') {
        if (payload.password) secretStore.setPassword(RELAY_PASSWORD_KEY, payload.password);
        else secretStore.deletePassword(RELAY_PASSWORD_KEY);
      }

      syncFromDisk();
      return { success: true, status: getSideloadRelayService(safeSendToRenderer, isPrivacyModeEnabled).getStatus() };
    }
  );

  ipcMain.handle(IPC.SideloadRelaySeedTargets, async (_event: IpcMainInvokeEvent, payload?: { includeSubnetScan?: boolean }) => {
    const byKey = new Map<string, RelayDeviceCandidate>();
    const add = (c: RelayDeviceCandidate | null) => {
      if (!c) return;
      // Dedupe by serial (preferred) then ip; a local hit shouldn't be shadowed by a remote dup.
      const key = c.serial || c.ip;
      if (!byKey.has(key) && !byKey.has(c.ip)) byKey.set(key, c);
    };
    let allPasswords: Record<string, string> = {};
    try {
      allPasswords = secretStore.getAllPasswords();
    } catch {
      allPasswords = {};
    }
    try {
      // --- Local (SSDP, optional subnet scan) — dev-enabled devices only ---
      const ssdp = await rokuApi.ssdpDiscover({ timeout: 5000 });
      const subnet = payload?.includeSubnetScan ? await rokuApi.subnetScan({}) : [];
      for (const d of [...ssdp, ...subnet]) {
        if (isRelaySelfDevice(d as { serialNumber?: unknown; modelName?: unknown })) continue;
        add(toCandidate(d as Record<string, unknown>, 'Local', false, allPasswords));
      }

      // --- Remote locations (best-effort; each location discovered in parallel) ---
      // The remote server's own `/devices` route runs a fresh `ssdpDiscover` (6000ms default,
      // and ONLY resolves early if it actually finds a device) then, if that comes up empty,
      // falls back to a subnet scan — so its worst case comfortably exceeds 6s before it can
      // even start replying. A 5000ms HTTP timeout here would time out on every quiet remote
      // LAN, silently dropping that location's devices from the results.
      const locations = readRemoteLocations(loadSettings());
      await Promise.all(
        locations.map(async (loc) => {
          const res = await remoteHttpRequest(loc.serverUrl, '/devices', 'GET', null, 15000);
          const devices = Array.isArray(res) ? res : Array.isArray(res?.devices) ? res.devices : [];
          for (const d of devices) {
            if (d && typeof d === 'object') {
              recordRemoteDeviceSeen(d as Record<string, unknown>);
              add(toCandidate(d as Record<string, unknown>, loc.name, true, allPasswords, loc.serverUrl, loc.id));
            }
          }
        })
      );

      return { success: true, devices: Array.from(byKey.values()) };
    } catch (e) {
      mainWarn('[SideloadRelay] seed-targets discovery failed:', (e as Error)?.message || e);
      return { success: false, error: (e as Error)?.message || 'Discovery failed', devices: [] };
    }
  });

  // Validate a device's dev password (local via ECP Digest, remote via its server)
  // and, on success, persist it for the relay keyed by the target id (serial||ip).
  ipcMain.handle(
    IPC.SideloadRelayValidatePassword,
    async (
      _event: IpcMainInvokeEvent,
      payload?: { ip?: string; serial?: string; remote?: boolean; serverUrl?: string; password?: string }
    ) => {
      const ip = typeof payload?.ip === 'string' ? payload.ip.trim() : '';
      const password = typeof payload?.password === 'string' ? payload.password : '';
      if (!ip || !password) return { success: false, error: S.sideloadRelay.errDeviceIpPasswordRequired };
      try {
        let ok = false;
        let err = '';
        if (payload?.remote && payload.serverUrl) {
          const res = await remoteHttpRequest(payload.serverUrl, `/device/${encodeURIComponent(ip)}/verify-dev-auth`, 'POST', { password });
          ok = !!res?.success;
          err = res?.error || '';
        } else {
          const res = await rokuApi.verifyDeveloperDigestAuth({ ip, password });
          ok = !!res?.success;
          err = res?.error || '';
        }
        if (!ok) return { success: false, error: err || S.sideloadRelay.errIncorrectPassword };
        // Save it as the ONE canonical device credential (same serial key the Dev
        // App / sideloading / Action Scripts use) and push it to the open window so
        // its cache reflects it live. No relay-specific per-device store.
        const serial = typeof payload?.serial === 'string' ? payload.serial.trim() : '';
        const key = serial || ip;
        secretStore.setPassword(key, password);
        safeSendToRenderer(IPC.SecretsPasswordUpdated, { serial: key, password });
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error)?.message || S.sideloadRelay.errValidationFailed };
      }
    }
  );

  // Reveal the saved Relay Dev Password for the settings "show password" eye.
  ipcMain.handle(IPC.SideloadRelayRevealPassword, async () => {
    try {
      const password = secretStore.getAllPasswords()[RELAY_PASSWORD_KEY] || '';
      return { success: true, password };
    } catch (e) {
      return { success: false, error: (e as Error)?.message || S.sideloadRelay.errCouldNotReadPassword };
    }
  });

  mainLog('[SideloadRelay] IPC handlers registered');
}

export { setupRelayHandlers };

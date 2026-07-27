import type { BrowserWindow, Dialog, IpcMainInvokeEvent } from 'electron';
import { S } from '../../shared/strings/index';
import { IPC } from '../../shared/ipc/channels';
import type { SafeSendFn } from '../../shared/ipc/payloads';
import { loadSettings, saveSettings } from '../settings';
import {
  getNetworkInspectorService,
  initNetworkInspectorFromSettings,
  type NetworkInspectorBootConfig
} from '../network-inspector/index';
import type { NetworkTrafficRules } from '../../shared/network-inspector/types';
import {
  ALL_FIND_SCOPES,
  type NetworkFindRequest,
  type NetworkFindTerm,
  type NetworkFindScope
} from '../../shared/network-inspector/content-search';
import {
  clampMaxRawPacketsPerDevice,
  clampMaxBodyRetainedBytes
} from '../../shared/network-inspector/types';

type DialogLike = Pick<Dialog, 'showSaveDialog' | 'showOpenDialog'>;

const DEFAULT_MITM_PORT = 8888;

/** Per-device block/throttle rules persisted under `networkInspectorTrafficRules` (keyed by IP). */
function readTrafficRules(settings: Record<string, unknown>): NetworkTrafficRules | undefined {
  const raw = settings['networkInspectorTrafficRules'];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as NetworkTrafficRules;
  }
  return undefined;
}

function readBootConfig(settings: Record<string, unknown>, userDataPath?: string): NetworkInspectorBootConfig {
  const mitmPortRaw = settings['networkInspectorMitmPort'];
  const mitmPort =
    typeof mitmPortRaw === 'number' && mitmPortRaw > 0 && mitmPortRaw < 65536
      ? Math.floor(mitmPortRaw)
      : DEFAULT_MITM_PORT;
  return {
    enabled: settings['networkInspectorEnabled'] === true,
    // MITM proxy is always on with the inspector (no dedicated setting). Default true so existing
    // installs that never toggled it still get HTTPS decryption for sideloaded dev channels.
    mitmEnabled: settings['networkInspectorMitmEnabled'] !== false,
    mitmPort,
    maxRawPacketsPerDevice: clampMaxRawPacketsPerDevice(
      settings['networkInspectorMaxRawPacketsPerDevice']
    ),
    maxBodyRetainedBytes: clampMaxBodyRetainedBytes(
      settings['networkInspectorMaxBodyRetainedBytes']
    ),
    trafficRules: readTrafficRules(settings),
    userDataPath
  };
}

/** Hard cap on colored Find terms accepted from the renderer (matches the modal's palette size). */
const MAX_FIND_TERMS = 5;

/** Validate one renderer-supplied Find term, or null when it has no usable query. Color is a
 *  renderer-only concern (results come back keyed by `id`), so it isn't accepted here. */
function sanitizeFindTerm(raw: unknown, index: number): NetworkFindTerm | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const query = typeof t.query === 'string' ? t.query : '';
  if (!query) return null;
  const id = typeof t.id === 'string' && t.id ? t.id : `t${index}`;
  const scopes = Array.isArray(t.scopes)
    ? t.scopes.filter((s): s is NetworkFindScope =>
        (ALL_FIND_SCOPES as readonly string[]).includes(s as string)
      )
    : undefined;
  return {
    id,
    query,
    scopes: scopes && scopes.length > 0 ? scopes : undefined,
    caseSensitive: t.caseSensitive === true,
    regex: t.regex === true
  };
}

/** Validate the renderer-supplied multi-term Find request, or null when no term has a usable query.
 *  Caps the term count at {@link MAX_FIND_TERMS} so a hostile/buggy renderer can't fan out unboundedly. */
function sanitizeFindOptions(raw: unknown): NetworkFindRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const rawTerms = Array.isArray(o.terms) ? o.terms : [];
  const terms: NetworkFindTerm[] = [];
  for (const rt of rawTerms) {
    if (terms.length >= MAX_FIND_TERMS) break;
    const term = sanitizeFindTerm(rt, terms.length);
    if (term) terms.push(term);
  }
  if (terms.length === 0) return null;
  return { terms };
}

function setupNetworkInspectorHandlers(
  _mainWindow: BrowserWindow | undefined,
  safeSendToRenderer: SafeSendFn,
  dialog: DialogLike,
  userDataPath?: string
) {
  const { ipcMain, app } = require('electron') as typeof import('electron');
  const dataPath = userDataPath || (app?.getPath ? app.getPath('userData') : undefined);

  function syncFromDisk(): void {
    const settings = loadSettings();
    initNetworkInspectorFromSettings(safeSendToRenderer, readBootConfig(settings, dataPath));
  }

  syncFromDisk();

  // Delete the on-disk detail cache when RDS quits (covers normal quit; a crash is covered by the
  // stale-cache cleanup that runs when the service initializes on next launch).
  app?.once('will-quit', () => {
    try {
      getNetworkInspectorService(safeSendToRenderer).dispose();
    } catch {
      /* ignore */
    }
  });

  ipcMain.handle(IPC.NetworkInspectorGetStatus, async () => {
    return { success: true, status: getNetworkInspectorService(safeSendToRenderer).getStatus() };
  });

  ipcMain.handle(
    IPC.NetworkInspectorGetEvents,
    async (_event: IpcMainInvokeEvent, payload: { deviceIp?: string; limit?: number; sinceSeq?: number }) => {
      const ip = typeof payload?.deviceIp === 'string' ? payload.deviceIp : '';
      const limit = typeof payload?.limit === 'number' ? payload.limit : 500;
      if (!ip) return { success: false, error: 'deviceIp required' };
      const svc = getNetworkInspectorService(safeSendToRenderer);
      // Cursor-based delta fetch when the renderer supplies `sinceSeq`; otherwise the legacy
      // most-recent-window fetch (used by the one-shot initial load).
      if (typeof payload?.sinceSeq === 'number') {
        const { events, cursor } = svc.getEventsForDeviceSince(ip, payload.sinceSeq, limit);
        return { success: true, events, cursor };
      }
      return { success: true, events: svc.getEventsForDevice(ip, limit) };
    }
  );

  ipcMain.handle(
    IPC.NetworkInspectorGetEventDetail,
    async (_event: IpcMainInvokeEvent, payload: { id?: string }) => {
      const id = typeof payload?.id === 'string' ? payload.id : '';
      if (!id) return { success: false, error: 'id required' };
      const event = await getNetworkInspectorService(safeSendToRenderer).getEventDetail(id);
      return { success: true, event };
    }
  );

  ipcMain.handle(
    IPC.NetworkInspectorFind,
    async (_event: IpcMainInvokeEvent, payload: { deviceIp?: string; options?: unknown }) => {
      const deviceIp = typeof payload?.deviceIp === 'string' ? payload.deviceIp : '';
      if (!deviceIp) return { success: false, error: 'deviceIp required' };
      const options = sanitizeFindOptions(payload?.options);
      if (!options) return { success: true, matches: [] };
      const matches = await getNetworkInspectorService(safeSendToRenderer).searchEvents(
        deviceIp,
        options
      );
      return { success: true, matches };
    }
  );

  ipcMain.handle(
    IPC.NetworkInspectorClearEvents,
    async (_event: IpcMainInvokeEvent, payload: { deviceIps?: string[] }) => {
      const deviceIps = Array.isArray(payload?.deviceIps)
        ? payload.deviceIps.filter((ip): ip is string => typeof ip === 'string')
        : undefined;
      const result = getNetworkInspectorService(safeSendToRenderer).clearEventsForDevices(deviceIps);
      return { success: true, cleared: result.cleared };
    }
  );

  ipcMain.handle(
    IPC.NetworkInspectorSetRecording,
    async (
      _event: IpcMainInvokeEvent,
      payload: { deviceIps?: string[]; recording?: boolean }
    ) => {
      const deviceIps = Array.isArray(payload?.deviceIps)
        ? payload.deviceIps.filter((ip): ip is string => typeof ip === 'string' && !!ip.trim())
        : [];
      getNetworkInspectorService(safeSendToRenderer).setRecordingForDevices(
        deviceIps,
        payload?.recording !== false
      );
      return { success: true };
    }
  );

  ipcMain.handle(
    IPC.NetworkInspectorExportPcap,
    async (_event: IpcMainInvokeEvent, payload?: { deviceIps?: string[] }) => {
      const deviceIps = Array.isArray(payload?.deviceIps)
        ? payload.deviceIps.filter((ip): ip is string => typeof ip === 'string' && !!ip.trim())
        : undefined;
      const win = _mainWindow && !_mainWindow.isDestroyed() ? _mainWindow : undefined;
      const primaryIp = deviceIps?.find((ip) => !ip.endsWith('.1'));
      const namePart = primaryIp ? primaryIp.replace(/\./g, '-') : 'hotspot';
      const pcapOpts = {
        title: S.networkInspector.exportDialogTitles.savePcap,
        defaultPath: `network-inspector-${namePart}-${Date.now()}.pcap`,
        filters: [{ name: S.networkInspector.exportDialogTitles.pcapFilter, extensions: ['pcap'] }]
      };
      const result = await (win ? dialog.showSaveDialog(win, pcapOpts) : dialog.showSaveDialog(pcapOpts));
      if (result.canceled || !result.filePath) {
        return { success: false, error: 'cancelled' };
      }
      return getNetworkInspectorService(safeSendToRenderer).exportPcap(result.filePath, deviceIps);
    }
  );

  ipcMain.handle(IPC.NetworkInspectorGetCaInfo, async () => {
    const svc = getNetworkInspectorService(safeSendToRenderer);
    return { success: true, caInfo: svc.getCaInfo(), status: svc.getStatus() };
  });

  ipcMain.handle(IPC.NetworkInspectorExportCaPem, async () => {
    const win = _mainWindow && !_mainWindow.isDestroyed() ? _mainWindow : undefined;
    const pemOpts = {
      title: S.networkInspector.exportDialogTitles.caPem,
      defaultPath: 'rds-network-inspector-ca.pem',
      filters: [{ name: S.networkInspector.exportDialogTitles.pemFilter, extensions: ['pem'] }]
    };
    const result = await (win ? dialog.showSaveDialog(win, pemOpts) : dialog.showSaveDialog(pemOpts));
    if (result.canceled || !result.filePath) return { success: false, error: 'cancelled' };
    return getNetworkInspectorService(safeSendToRenderer).exportCaPem(result.filePath);
  });

  ipcMain.handle(IPC.NetworkInspectorExportCaCert, async () => {
    const win = _mainWindow && !_mainWindow.isDestroyed() ? _mainWindow : undefined;
    const crtOpts = {
      title: S.networkInspector.exportDialogTitles.caCrt,
      defaultPath: 'rds-network-inspector-ca.crt',
      filters: [{ name: S.networkInspector.exportDialogTitles.certFilter, extensions: ['crt', 'cer'] }]
    };
    const result = await (win ? dialog.showSaveDialog(win, crtOpts) : dialog.showSaveDialog(crtOpts));
    if (result.canceled || !result.filePath) return { success: false, error: 'cancelled' };
    return getNetworkInspectorService(safeSendToRenderer).exportCaCert(result.filePath);
  });

  ipcMain.handle(IPC.NetworkInspectorInstallBpfAccess, async () => {
    return getNetworkInspectorService(safeSendToRenderer).installBpfAccess();
  });

  ipcMain.handle(IPC.NetworkInspectorGetTrafficRules, async () => {
    return { success: true, rules: getNetworkInspectorService(safeSendToRenderer).getTrafficRules() };
  });

  ipcMain.handle(
    IPC.NetworkInspectorSetDeviceTrafficRules,
    async (
      _event: IpcMainInvokeEvent,
      payload: { deviceIp?: string; rules?: Record<string, unknown> | null }
    ) => {
      const deviceIp = typeof payload?.deviceIp === 'string' ? payload.deviceIp.trim() : '';
      if (!deviceIp) return { success: false, error: 'deviceIp required' };
      const svc = getNetworkInspectorService(safeSendToRenderer);
      svc.setDeviceTrafficRules(deviceIp, (payload?.rules as never) || undefined);
      const rules = svc.getTrafficRules();
      // Persist per-device rules so they survive restart. Stored keyed by device IP under
      // `networkInspectorTrafficRules`; an empty map clears the key.
      const settings = loadSettings();
      if (Object.keys(rules).length > 0) {
        settings['networkInspectorTrafficRules'] = rules;
      } else {
        delete settings['networkInspectorTrafficRules'];
      }
      saveSettings(settings);
      return { success: true, rules };
    }
  );

  ipcMain.handle(
    IPC.NetworkInspectorApplySettings,
    async (
      _event: IpcMainInvokeEvent,
      payload: {
        enabled?: boolean;
        mitmEnabled?: boolean;
        mitmPort?: number;
        maxRawPacketsPerDevice?: number;
        maxBodyRetainedBytes?: number;
      }
    ) => {
      const settings = loadSettings();
      if (typeof payload?.enabled === 'boolean') {
        settings['networkInspectorEnabled'] = payload.enabled;
      }
      if (typeof payload?.mitmEnabled === 'boolean') {
        settings['networkInspectorMitmEnabled'] = payload.mitmEnabled;
      }
      if (typeof payload?.mitmPort === 'number') {
        settings['networkInspectorMitmPort'] = payload.mitmPort;
      }
      if (typeof payload?.maxRawPacketsPerDevice === 'number') {
        settings['networkInspectorMaxRawPacketsPerDevice'] = clampMaxRawPacketsPerDevice(
          payload.maxRawPacketsPerDevice
        );
      }
      if (typeof payload?.maxBodyRetainedBytes === 'number') {
        settings['networkInspectorMaxBodyRetainedBytes'] = clampMaxBodyRetainedBytes(
          payload.maxBodyRetainedBytes
        );
      }
      saveSettings(settings);
      syncFromDisk();
      return { success: true, status: getNetworkInspectorService(safeSendToRenderer).getStatus() };
    }
  );
}

export { setupNetworkInspectorHandlers, initNetworkInspectorFromSettings };

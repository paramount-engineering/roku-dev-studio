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
  clampMaxRawPacketsPerDevice,
  clampMaxBodyRetainedBytes
} from '../../shared/network-inspector/types';
// Shared with the remote server (packages/roku-dev-studio-remote-server) so a validation change
// can't silently drift between the two transports.
import {
  sanitizeFindOptions,
  sanitizeReplayInput,
  MAX_REPLAY_TIMEOUT_MS
} from 'roku-dev-studio-network-inspector/input-sanitize';

type DialogLike = Pick<Dialog, 'showSaveDialog' | 'showOpenDialog'>;

const DEFAULT_MITM_PORT = 8888;

/** Upper bound on a per-event note so a hostile/buggy renderer can't push unbounded strings. */
const MAX_EVENT_NOTE_CHARS = 4000;

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

function setupNetworkInspectorHandlers(
  _mainWindow: BrowserWindow | undefined,
  safeSendToRenderer: SafeSendFn,
  dialog: DialogLike,
  userDataPath?: string
) {
  const { ipcMain, app, BrowserWindow } = require('electron') as typeof import('electron');
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
    IPC.NetworkInspectorSetEventNote,
    async (_event: IpcMainInvokeEvent, payload: { id?: string; note?: string }) => {
      const id = typeof payload?.id === 'string' ? payload.id : '';
      if (!id) return { success: false, error: 'id required' };
      const note =
        typeof payload?.note === 'string' ? payload.note.slice(0, MAX_EVENT_NOTE_CHARS) : '';
      getNetworkInspectorService(safeSendToRenderer).setEventNote(id, note);
      return { success: true };
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

  ipcMain.handle(IPC.NetworkInspectorExportCaPem, async (event: IpcMainInvokeEvent) => {
    // Parent the save sheet to the invoking window (usually Settings) so on macOS it doesn't
    // attach to the hidden-behind main window and look like a hang. Fall back to the main window.
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    const win = (senderWin && !senderWin.isDestroyed())
      ? senderWin
      : (_mainWindow && !_mainWindow.isDestroyed() ? _mainWindow : undefined);
    const pemOpts = {
      title: S.networkInspector.exportDialogTitles.caPem,
      defaultPath: 'rds-network-inspector-ca.pem',
      filters: [{ name: S.networkInspector.exportDialogTitles.pemFilter, extensions: ['pem'] }]
    };
    const result = await (win ? dialog.showSaveDialog(win, pemOpts) : dialog.showSaveDialog(pemOpts));
    if (result.canceled || !result.filePath) return { success: false, error: 'cancelled' };
    return getNetworkInspectorService(safeSendToRenderer).exportCaPem(result.filePath);
  });

  ipcMain.handle(IPC.NetworkInspectorExportCaCert, async (event: IpcMainInvokeEvent) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    const win = (senderWin && !senderWin.isDestroyed())
      ? senderWin
      : (_mainWindow && !_mainWindow.isDestroyed() ? _mainWindow : undefined);
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
    IPC.NetworkInspectorReplayRequest,
    async (
      _event: IpcMainInvokeEvent,
      payload: { deviceIp?: string; input?: unknown; applyTrafficRules?: boolean; timeoutMs?: number }
    ) => {
      const deviceIp = typeof payload?.deviceIp === 'string' ? payload.deviceIp.trim() : '';
      const input = sanitizeReplayInput(payload?.input);
      if (!input) return { success: false, error: 'invalid url' };
      const applyTrafficRules = payload?.applyTrafficRules === true;
      const timeoutMs =
        typeof payload?.timeoutMs === 'number' && Number.isFinite(payload.timeoutMs)
          ? Math.min(MAX_REPLAY_TIMEOUT_MS, Math.max(1000, Math.floor(payload.timeoutMs)))
          : undefined;
      return getNetworkInspectorService(safeSendToRenderer).replayRequest({
        deviceIp,
        input,
        applyTrafficRules,
        timeoutMs
      });
    }
  );

  ipcMain.handle(IPC.NetworkInspectorPickMockFile, async () => {
    const win = _mainWindow && !_mainWindow.isDestroyed() ? _mainWindow : undefined;
    const openOpts = {
      title: S.networkInspector.mapLocalDialogTitle,
      properties: ['openFile' as const],
      filters: [{ name: S.networkInspector.mapLocalAllFilesFilter, extensions: ['*'] }]
    };
    const result = await (win ? dialog.showOpenDialog(win, openOpts) : dialog.showOpenDialog(openOpts));
    if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };
    return { success: true, filePath: result.filePaths[0] };
  });

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

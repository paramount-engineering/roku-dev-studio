/**
 * App-side Network Inspector entry. The engine itself now lives in the transport-agnostic
 * `roku-dev-studio-network-inspector` package (so it can also run on the remote server). This file
 * is the Electron *adapter layer*: it re-exports the engine and adds the Electron-specific factory
 * that wires the engine's events onto IPC channels via `createElectronIpcListener`.
 */
import {
  NetworkInspectorService,
  initCaStore,
  type NetworkInspectorBootConfig,
  type NetworkInspectorStatus
} from 'roku-dev-studio-network-inspector';
import { createElectronIpcListener } from './electron-ipc-listener';
import { loadSettings, saveSettings } from '../settings';
import { onSystemSuspend, onSystemResume } from '../power-state';

// Re-export the engine's public API so existing `./network-inspector/index` imports keep working.
export * from 'roku-dev-studio-network-inspector';

type SafeSendFn = (channel: string, data: unknown) => void;

let singleton: NetworkInspectorService | null = null;
let autoDisablePersisted = false;

function isAutoDisabledStatus(status: NetworkInspectorStatus): boolean {
  return (
    status.enabled === false &&
    typeof status.lastError === 'string' &&
    /^Network Inspector disabled:/i.test(status.lastError)
  );
}

function persistAutoDisabledSettings(status: NetworkInspectorStatus): void {
  if (!isAutoDisabledStatus(status)) {
    autoDisablePersisted = false;
    return;
  }
  if (autoDisablePersisted) return;
  const settings = loadSettings();
  let changed = false;
  if (settings['networkInspectorEnabled'] !== false) {
    settings['networkInspectorEnabled'] = false;
    changed = true;
  }
  if (settings['networkInspectorMitmEnabled'] !== false) {
    settings['networkInspectorMitmEnabled'] = false;
    changed = true;
  }
  if (changed) saveSettings(settings);
  autoDisablePersisted = true;
}

export function getNetworkInspectorService(safeSend: SafeSendFn): NetworkInspectorService {
  if (!singleton) {
    const baseListener = createElectronIpcListener(safeSend);
    singleton = new NetworkInspectorService({
      ...baseListener,
      onStatus: (status) => {
        persistAutoDisabledSettings(status);
        baseListener.onStatus(status);
      }
    });
    // A sleeping machine (lid closed, no Wi-Fi) has no use for a poll loop that keeps firing (and,
    // on Linux, spawning `getcap`) for no purpose — pause entirely on suspend, resume at the fast
    // cadence on wake.
    onSystemSuspend(() => singleton?.pauseForSystemSleep());
    onSystemResume(() => singleton?.resumeFromSystemSleep());
  }
  return singleton;
}

export function initNetworkInspectorFromSettings(
  safeSend: SafeSendFn,
  config: NetworkInspectorBootConfig | boolean
): NetworkInspectorService {
  const svc = getNetworkInspectorService(safeSend);
  const boot: NetworkInspectorBootConfig =
    typeof config === 'boolean' ? { enabled: config } : config;
  if (boot.userDataPath) {
    initCaStore(boot.userDataPath);
    svc.setUserDataPath(boot.userDataPath);
  }
  if (typeof boot.mitmPort === 'number') svc.setMitmPort(boot.mitmPort);
  if (typeof boot.maxRawPacketsPerDevice === 'number') {
    svc.setMaxRawPacketsPerDevice(boot.maxRawPacketsPerDevice);
  }
  if (typeof boot.maxBodyRetainedBytes === 'number') {
    svc.setMaxBodyRetainedBytes(boot.maxBodyRetainedBytes);
  }
  if (boot.trafficRules) svc.setAllTrafficRules(boot.trafficRules);
  svc.setEnabled(boot.enabled);
  svc.setMitmEnabled(boot.mitmEnabled === true);
  return svc;
}

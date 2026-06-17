/**
 * App-side Network Inspector entry. The engine itself now lives in the transport-agnostic
 * `roku-dev-studio-network-inspector` package (so it can also run on the remote server). This file
 * is the Electron *adapter layer*: it re-exports the engine and adds the Electron-specific factory
 * that wires the engine's events onto IPC channels via `createElectronIpcListener`.
 */
import {
  NetworkInspectorService,
  initCaStore,
  type NetworkInspectorBootConfig
} from 'roku-dev-studio-network-inspector';
import { createElectronIpcListener } from './electron-ipc-listener';

// Re-export the engine's public API so existing `./network-inspector/index` imports keep working.
export * from 'roku-dev-studio-network-inspector';

type SafeSendFn = (channel: string, data: unknown) => void;

let singleton: NetworkInspectorService | null = null;

export function getNetworkInspectorService(safeSend: SafeSendFn): NetworkInspectorService {
  if (!singleton) singleton = new NetworkInspectorService(createElectronIpcListener(safeSend));
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
  if (boot.trafficRules) svc.setAllTrafficRules(boot.trafficRules);
  svc.setEnabled(boot.enabled);
  svc.setMitmEnabled(boot.mitmEnabled === true);
  return svc;
}

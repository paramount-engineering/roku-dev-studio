/**
 * App-side Sideload Relay entry — lazily-created singleton + settings boot,
 * mirroring `main/network-inspector/index.ts`.
 */

import { SideloadRelayService } from './service';
import { createRelayIpcListener } from './electron-ipc-listener';
import type { RelayBootConfig } from '../../shared/sideload-relay/types';

type SafeSendFn = (channel: string, data: unknown) => void;

let singleton: SideloadRelayService | null = null;

export function getSideloadRelayService(safeSend: SafeSendFn): SideloadRelayService {
  if (!singleton) {
    singleton = new SideloadRelayService(createRelayIpcListener(safeSend));
  }
  return singleton;
}

export function initSideloadRelayFromSettings(
  safeSend: SafeSendFn,
  config: RelayBootConfig
): SideloadRelayService {
  const svc = getSideloadRelayService(safeSend);
  void svc.setConfig(config);
  return svc;
}

export { SideloadRelayService };

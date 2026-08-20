/**
 * App-side Sideload Relay entry — lazily-created singleton + settings boot,
 * mirroring `main/network-inspector/index.ts`.
 */

import { SideloadRelayService } from './service';
import { createRelayIpcListener } from './electron-ipc-listener';
import type { RemoteFanoutOps } from './fanout';
import type { RelayBootConfig } from '../../shared/sideload-relay/types';
import { sideloadFileToRemote, ensureRemoteTelnetConnected } from '../ipc/remote-handlers';
import { S } from '../../shared/strings/index';

const { mainLog } = require('../log');

/** Remote-server ops for fanning a build out to remote-location devices. */
const remoteFanoutOps: RemoteFanoutOps = {
  sideload: sideloadFileToRemote,
  ensureConsole: ensureRemoteTelnetConnected
};

type SafeSendFn = (channel: string, data: unknown) => void;

/** How long the allow-prompt stays up before auto-denying a remote sideload. */
const AUTHORIZE_TIMEOUT_MS = 30_000;

/**
 * Native allow/deny prompt for a sideload from a machine other than this one.
 * Resolves true to allow. Best-effort reverse-DNS enriches the prompt with a
 * hostname. Auto-denies after {@link AUTHORIZE_TIMEOUT_MS} so the IDE gets a
 * clean failure instead of hanging forever.
 */
async function authorizeRemoteSideload(info: { ip: string }): Promise<boolean> {
  const { dialog } = require('electron') as typeof import('electron');
  const dns = require('dns') as typeof import('dns');
  const ip = info.ip || 'unknown';

  let hostname = '';
  try {
    hostname = await new Promise<string>((resolve) => {
      dns.reverse(ip, (err, names) => resolve(err || !names?.length ? '' : names[0]!));
    });
  } catch {
    hostname = '';
  }
  const who = hostname ? `${hostname} (${ip})` : ip;
  mainLog(`[SideloadRelay] remote sideload from ${who} — prompting for approval`);

  const promptP = dialog
    .showMessageBox({
      type: 'warning',
      buttons: [S.sideloadRelay.authorizeAllow, S.sideloadRelay.authorizeDeny],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: S.sideloadRelay.authorizeTitle,
      message: S.sideloadRelay.authorizeMessage(who),
      detail: S.sideloadRelay.authorizeDetail
    })
    .then((r) => r.response === 0)
    .catch(() => false);

  const timeoutP = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), AUTHORIZE_TIMEOUT_MS));
  return Promise.race([promptP, timeoutP]);
}

let singleton: SideloadRelayService | null = null;

export function getSideloadRelayService(
  safeSend: SafeSendFn,
  isPrivacyModeEnabled?: () => boolean
): SideloadRelayService {
  if (!singleton) {
    singleton = new SideloadRelayService(
      createRelayIpcListener(safeSend),
      authorizeRemoteSideload,
      remoteFanoutOps,
      isPrivacyModeEnabled
    );
  }
  return singleton;
}

export function initSideloadRelayFromSettings(
  safeSend: SafeSendFn,
  config: RelayBootConfig,
  isPrivacyModeEnabled?: () => boolean
): SideloadRelayService {
  const svc = getSideloadRelayService(safeSend, isPrivacyModeEnabled);
  void svc.setConfig(config);
  return svc;
}

export { SideloadRelayService };

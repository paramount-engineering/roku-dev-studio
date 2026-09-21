/**
 * Run a single command on the Roku dev telnet port (8080), same session flow as the Query tab
 * (plugins, free / memory, etc.). Used by action script steps and shared with the Query UI handler.
 *
 * Connect → send → collect until the output heuristic says done → disconnect. Main decides what
 * connect/disconnect really do: while the Ports window holds 8080 for this device, connect reuses
 * its socket and disconnect is a no-op, so this stays correct without knowing about the window.
 */

import { isTelnetOutputComplete } from './telnet-utils.js';
import { TELNET_TIMEOUT } from './constants.js';
import { rendererError } from './logger.js';
import { S } from '@shared/strings/index.js';

export interface TelnetSystemRunApi {
  ip: string;
  isRemote?: boolean;
  serverUrl?: string | null;
  telnetSystemDisconnect: () => Promise<unknown>;
  telnetSystemConnect: () => Promise<{ success?: boolean; error?: string; reused?: boolean }>;
  telnetSystemSend: (command: string) => Promise<{ success?: boolean; error?: string }>;
}

/** Heuristic thresholds for `isTelnetOutputComplete`. Smaller values suit
 *  short-response commands (e.g. `remove_plugin`) that should wrap up fast;
 *  larger values suit chatty commands like `plugins` where we need to wait for
 *  the full list to arrive.
 */
export interface TelnetCompleteThresholds {
  substantialDataThreshold: number;
  /** Defaults to 3000ms (via `isTelnetOutputComplete`) if omitted — override for commands that
   *  reply near-instantly or not at all, else the wait-enough fallback path is stuck behind a
   *  stale 3s floor even with the other thresholds tuned down. */
  minWaitTime?: number;
  minDataAfterWait: number;
  maxDataLength: number;
}

export interface TelnetSystemRunOptions {
  /** Plain-text status messages (UI may HTML-escape). */
  onStatus?: (message: string) => void;
  shouldStop?: () => boolean;
  /** Override completion heuristic (defaults tuned for Query tab responses). */
  completeThresholds?: TelnetCompleteThresholds;
  /** Local (non-remote) path only: extra settle time after `isTelnetOutputComplete` first says
   *  done, before `outputComplete` actually flips. Defaults to 300ms — unexplained in history
   *  (present unchanged since the initial commit, no comment), kept as the default so existing
   *  callers keep today's behavior; override to 0 for a command known to have nothing further
   *  to wait for. The remote (relay) path has no equivalent delay and is unaffected. */
  postCompleteSettleMs?: number;
}

/** Defaults tuned for the Query tab (plugins list, free memory, etc.). */
const DEFAULT_COMPLETE: TelnetCompleteThresholds = {
  substantialDataThreshold: 100,
  minDataAfterWait: 50,
  maxDataLength: 10000
};

/**
 * Strip telnet noise and echo of `command` from raw session output (matches Query tab behavior).
 */
export function processTelnetSystemCommandOutput(output: string, command: string): string {
  let processed = output;

  if (processed.startsWith(command + '\r\n')) {
    processed = processed.substring((command + '\r\n').length);
  } else if (processed.startsWith(command + '\n')) {
    processed = processed.substring((command + '\n').length);
  } else if (processed.startsWith(command + '\r')) {
    processed = processed.substring((command + '\r').length);
  } else if (processed.startsWith(command)) {
    const afterCommand = processed.substring(command.length);
    if (afterCommand.match(/^\s/)) {
      processed = afterCommand;
    }
  }

  const lines = processed.split(/\r?\n/);
  const filteredLines: string[] = [];
  let skipBanner = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      skipBanner &&
      (line.includes('Connected to') ||
        line.includes('Escape character') ||
        line.includes('Trying') ||
        ((line.includes('Streaming Stick') || line.includes('Roku')) && line.match(/\d+\.\d+\.\d+\.\d+/)) ||
        line.trim() === '')
    ) {
      continue;
    }

    if (skipBanner && line.length > 0) {
      skipBanner = false;
    }

    if (!skipBanner) {
      filteredLines.push(line);
    }
  }

  processed = filteredLines.join('\n');

  processed = processed.replace(/^>\s*/gm, '');
  processed = processed.replace(/>\s*$/, '');

  processed = processed.replace(/^\n+/, '').replace(/\n+$/, '');

  return processed;
}

/**
 * Connect, send one command, collect output until complete or timeout, disconnect.
 * Does not throw; returns `{ ok: false }` on failure or stop.
 */
export async function runTelnetSystemCommandSession(
  api: TelnetSystemRunApi,
  command: string,
  options?: TelnetSystemRunOptions
): Promise<
  | { ok: true; raw: string; timedOut?: boolean }
  | { ok: false; error: string; stopped?: boolean }
> {
  const onStatus = options?.onStatus;
  const shouldStop = options?.shouldStop;
  const completeThresholds = options?.completeThresholds ?? DEFAULT_COMPLETE;
  const postCompleteSettleMs = options?.postCompleteSettleMs ?? 300;

  let allData = '';
  let commandSent = false;
  let outputComplete = false;
  const timeout = TELNET_TIMEOUT;
  const commandSentTime = { value: 0 };
  let dataCleanup: (() => void) | null = null;
  let dataLengthAtCommandSend = 0;

  try {
    // Reuses the socket when the Ports window already holds 8080 for this device (`reused: true`,
    // no banner will follow); otherwise dials fresh and waits out the device's connect banner below.
    const connectResult = await api.telnetSystemConnect();
    if (!connectResult.success) {
      return {
        ok: false,
        error: S.utils.failedToConnectTelnet(connectResult.error || S.utils.unknownError)
      };
    }

    onStatus?.(S.utils.connectedSettingUpListener);

    // Main pushes console bytes for every transport — local TCP, LAN relay (main polls the relay's
    // buffer itself), and RCE — on this one listener. Match on ip + port (default 8080), plus the
    // relay URL for LAN-relay devices so two relays fronting the same private IP can't cross.
    const roku = window.roku;
    if (!roku?.onTelnetSystemData) {
      await api.telnetSystemDisconnect().catch(() => {});
      return { ok: false, error: S.utils.telnetDataListenerUnavailable };
    }
    dataCleanup = roku.onTelnetSystemData((data: { ip: string; port?: number; data: string; serverUrl?: string }) => {
      if (data.ip !== api.ip) return;
      if ((data.port ?? 8080) !== 8080) return;
      if (api.serverUrl && data.serverUrl && data.serverUrl !== api.serverUrl) return;
      allData += data.data;

      if (commandSent && !outputComplete) {
        const timeSinceCommand = Date.now() - commandSentTime.value;
        const newData = allData.substring(dataLengthAtCommandSend);
        const trimmedNewData = newData.trim();

        if (
          isTelnetOutputComplete(newData, trimmedNewData, timeSinceCommand, completeThresholds)
        ) {
          if (postCompleteSettleMs > 0) {
            setTimeout(() => {
              outputComplete = true;
            }, postCompleteSettleMs);
          } else {
            outputComplete = true;
          }
        }
      }
    });

    if (!connectResult.reused) await new Promise((resolve) => setTimeout(resolve, 1000));

    onStatus?.(S.utils.sendingCommand);

    dataLengthAtCommandSend = allData.length;
    const sendResult = await api.telnetSystemSend(command);
    commandSent = true;
    commandSentTime.value = Date.now();

    if (!sendResult.success) {
      if (dataCleanup) dataCleanup();
      await api.telnetSystemDisconnect();
      return { ok: false, error: S.utils.failedToSendCommand(sendResult.error || S.utils.unknownError) };
    }

    onStatus?.(S.utils.waitingForOutput);

    const startTime = Date.now();
    while (!outputComplete && Date.now() - startTime < timeout) {
      if (typeof shouldStop === 'function' && shouldStop()) {
        if (dataCleanup) dataCleanup();
        await api.telnetSystemDisconnect().catch(() => {});
        return { ok: false, error: S.utils.stopped, stopped: true };
      }
      // Just re-checking already-updated local state (outputComplete / shouldStop) each tick —
      // no I/O of its own, so a tight interval is free. Bounded by `timeout` above regardless.
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (dataCleanup) dataCleanup();
    await api.telnetSystemDisconnect();

    // Exited the loop without `outputComplete` means we hit the wall-clock timeout;
    // return the partial buffer but mark it so callers can surface "may be truncated".
    return { ok: true, raw: allData, timedOut: !outputComplete };
  } catch (e: unknown) {
    if (dataCleanup) dataCleanup();
    await api.telnetSystemDisconnect().catch(() => {});
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

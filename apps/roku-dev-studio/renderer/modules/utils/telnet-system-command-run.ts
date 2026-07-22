/**
 * Run a single command on the Roku dev telnet port (8080), same session flow as the Query tab
 * (plugins, free / memory, etc.). Used by action script steps and shared with the Query UI handler.
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
  telnetSystemConnect: () => Promise<{ success?: boolean; error?: string }>;
  telnetSystemSend: (command: string) => Promise<{ success?: boolean; error?: string }>;
}

/** Heuristic thresholds for `isTelnetOutputComplete`. Smaller values suit
 *  short-response commands (e.g. `remove_plugin`) that should wrap up fast;
 *  larger values suit chatty commands like `plugins` where we need to wait for
 *  the full list to arrive.
 */
export interface TelnetCompleteThresholds {
  substantialDataThreshold: number;
  minDataAfterWait: number;
  maxDataLength: number;
}

export interface TelnetSystemRunOptions {
  /** Plain-text status messages (UI may HTML-escape). */
  onStatus?: (message: string) => void;
  shouldStop?: () => boolean;
  /** Override completion heuristic (defaults tuned for Query tab responses). */
  completeThresholds?: TelnetCompleteThresholds;
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

  let allData = '';
  let commandSent = false;
  let outputComplete = false;
  const timeout = TELNET_TIMEOUT;
  const commandSentTime = { value: 0 };
  let dataCleanup: (() => void) | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let dataLengthAtCommandSend = 0;

  try {
    await api.telnetSystemDisconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));

    const connectResult = await api.telnetSystemConnect();
    if (!connectResult.success) {
      return {
        ok: false,
        error: S.utils.failedToConnectTelnet(connectResult.error || S.utils.unknownError)
      };
    }

    onStatus?.(S.utils.connectedSettingUpListener);

    if (api.isRemote) {
      const roku = window.roku;
      if (!roku?.remoteTelnetSystemPollData) {
        await api.telnetSystemDisconnect().catch(() => {});
        return { ok: false, error: S.utils.remoteTelnetPollUnavailable };
      }
      const pollData = async () => {
        try {
          const result = await roku.remoteTelnetSystemPollData(api.serverUrl!, api.ip);
          if (result.success && result.data) {
            allData += result.data;

            if (commandSent && !outputComplete) {
              const timeSinceCommand = Date.now() - commandSentTime.value;
              const newData = allData.substring(dataLengthAtCommandSend);
              const trimmedNewData = newData.trim();

              if (
                isTelnetOutputComplete(newData, trimmedNewData, timeSinceCommand, completeThresholds)
              ) {
                outputComplete = true;
                if (pollInterval) {
                  clearInterval(pollInterval);
                  pollInterval = null;
                }
              }
            }
          }
        } catch (e) {
          rendererError('[Telnet System] Poll error:', e);
        }
      };

      pollInterval = setInterval(pollData, 200);
      dataCleanup = () => {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };
    } else {
      const roku = window.roku;
      if (!roku?.onTelnetSystemData) {
        await api.telnetSystemDisconnect().catch(() => {});
        return { ok: false, error: S.utils.telnetDataListenerUnavailable };
      }
      dataCleanup = roku.onTelnetSystemData((data: { ip: string; data: string }) => {
        if (data.ip === api.ip) {
          allData += data.data;

          if (commandSent && !outputComplete) {
            const timeSinceCommand = Date.now() - commandSentTime.value;
            const newData = allData.substring(dataLengthAtCommandSend);
            const trimmedNewData = newData.trim();

            if (
              isTelnetOutputComplete(newData, trimmedNewData, timeSinceCommand, completeThresholds)
            ) {
              setTimeout(() => {
                outputComplete = true;
              }, 300);
            }
          }
        }
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

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
      await new Promise((resolve) => setTimeout(resolve, 200));
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

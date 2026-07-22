/**
 * UI strings for the Telnet / BrightScript debug console panel
 * (renderer/modules/telnet/telnet-console-panel.ts).
 *
 * Parametrized strings are functions returning the composed text — the standard way
 * to keep interpolation translatable without a runtime format library. Several leaves
 * here are the "--- … ---" session markers the console prints into its own log stream;
 * the interpolation + wording is preserved exactly (only centralised here).
 */
export const telnet = {
  // Connection status pill (right of the console header)
  statusConnecting: 'Connecting...',
  connectionFailed: 'Connection failed',
  connectionLost: 'Connection lost',
  unknownError: 'Unknown error',
  errorStatusPrefix: (msg: string): string => `Error: ${msg}`,

  // Empty-state placeholder (shown before the first connect)
  placeholderTitle: 'Connect to view BrightScript Debug Output',
  placeholderHintDevMode: 'Requires Developer Mode enabled on the Roku device.',
  placeholderHintSingleConn: 'Only one telnet connection to a Roku device can be active at a time.',

  // Live line counter (left of the status pill) + its hover tooltip
  linesCount: (countLabel: string, n: number): string => `${countLabel} ${n === 1 ? 'line' : 'lines'}`,
  spillTooltip: (bufferedLabel: string, totalLabel: string, spilledLabel: string, capHit: boolean): string =>
    `${bufferedLabel} of ${totalLabel} lines — ${bufferedLabel} in memory, ${spilledLabel} spilled to disk` +
    (capHit ? ' (disk cap reached — older lines dropped)' : ''),

  // Session log lines the console prints into its own stream ("--- … ---")
  relayNoteSkipBuffer: ' (via relay, skip existing logs buffer)',
  relayNoteReplayBuffer: ' (via relay, replay buffer)',
  lineConnectedTo: (ip: string, relayNote: string): string => `--- Connected to ${ip}:8085${relayNote} ---`,
  lineConnectionFailed: (err: string): string => `--- Connection failed: ${err} ---`,
  lineConnectionError: (msg: string): string => `--- Connection error: ${msg} ---`,
  lineDisconnected: '--- Disconnected ---',
  lineError: (err: string): string => `--- Error: ${err} ---`,
  lineConnectionClosed: (aliveStr: string | null, bytes: number): string => {
    let s = '--- Connection closed';
    if (aliveStr !== null) s += ` (alive ${aliveStr}`;
    if (bytes >= 0) s += `${aliveStr !== null ? ', ' : ' ('}received ${bytes} bytes`;
    if (aliveStr !== null || bytes >= 0) s += ')';
    s += ' ---';
    return s;
  },
  hintNoLogData:
    '--- Hint: Roku closed the socket quickly with no log data. Check that no other telnet client is connected to this device on port 8085 (BrightScript IDE, another Dev Studio window, a `telnet` terminal session, …) and that a sideloaded channel is currently running. ---',
  hintAbnormalClose:
    '--- Hint: socket close was abnormal (TCP RST or similar). Roku may have rebooted or another client took the 8085 binding. ---',

  // Copy button transient feedback (rendered next to a check icon — no ✓ prefix,
  // unlike common.copied, so the icon isn't doubled).
  copied: 'Copied!',

  // Save button transient feedback + save dialog + saved-file header block
  saveNoLogs: 'No logs',
  saving: 'Saving...',
  saved: 'Saved!',
  saveError: 'Error',
  saveDialogTitle: 'Save Console Logs',
  saveHeaderTitle: 'Roku Console Logs',
  saveHeaderUnknownDevice: 'Unknown',
  saveHeaderDevice: (device: string, ip: string): string => `Device: ${device} (${ip})`,
  saveHeaderSaved: (when: string): string => `Saved: ${when}`,
  saveHeaderTotalLines: (n: number): string => `Total Lines: ${n}`,
} as const;

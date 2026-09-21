/**
 * Push channel from main-process socket owners (telnet-handlers, remote-handlers, debugger-handlers)
 * to every open Ports window — without those modules importing `port-terminal-window.ts`, which
 * itself imports them (it drives their connect/disconnect with `holder: 'window'`). The window
 * module registers the real fan-out at load; until then broadcasts are dropped.
 */
type PortTerminalSink = (channel: string, payload: unknown) => void;

let sink: PortTerminalSink | null = null;
let hasWindows: () => boolean = () => false;

export function registerPortTerminalSink(fn: PortTerminalSink | null, windowsOpen?: () => boolean): void {
  sink = fn;
  hasWindows = windowsOpen ?? (() => fn !== null);
}

/** Is at least one Ports window open? Lets producers skip per-frame work (the 8081 wire trace)
 *  that only those windows consume. */
export function hasPortTerminalWindows(): boolean {
  return hasWindows();
}

export function broadcastToPortTerminals(channel: string, payload: unknown): void {
  if (!sink) return;
  try {
    sink(channel, payload);
  } catch {
    /* a closing window mid-send is not the socket owner's problem */
  }
}

/**
 * Thin wrapper around Electron's `powerMonitor` so main-process background timers (the Network
 * Inspector poll loop, the MCP bridge's descriptor watcher) can pause on system suspend instead of
 * continuing to tick — and spawn platform-specific subprocesses — while the machine is asleep.
 */
import { powerMonitor } from 'electron';

export function onSystemSuspend(cb: () => void): void {
  powerMonitor.on('suspend', cb);
}

export function onSystemResume(cb: () => void): void {
  powerMonitor.on('resume', cb);
}

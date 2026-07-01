/**
 * Raw log line → display text: ANSI strip + over-length truncation.
 *
 * Deliberately DOM-free and dependency-light (only `stripAnsiForConsole` and a
 * numeric limit) so it can be imported by the **main process** as well as the
 * renderer. The windowed Log Viewer's whole-file search runs in main and must
 * match against the exact text the renderer paints in `.telnet-log-content`;
 * keeping this transform here (rather than in `console-line-parser.ts`, which
 * pulls in DOM-dependent structured-payload detection) lets both sides share it
 * without dragging `DOMParser` et al. into the main-process build.
 */

import { stripAnsiForConsole } from '../telnet/telnet-console-buffer.js';
import { MAX_LOG_LINE_CHARS } from './console-render-limits.js';

export function consoleDisplayText(rawLine: string): string {
  const displayLine = stripAnsiForConsole(rawLine);
  if (displayLine.length > MAX_LOG_LINE_CHARS) {
    const over = displayLine.length - MAX_LOG_LINE_CHARS;
    return `${displayLine.slice(0, MAX_LOG_LINE_CHARS)} … [truncated ${over} chars]`;
  }
  return displayLine;
}

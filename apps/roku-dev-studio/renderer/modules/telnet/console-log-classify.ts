/**
 * Log line severity / styling bucket (shared by Telnet console and log file viewer).
 */
export function classifyLogLine(text: string): string {
  if (/error|exception/i.test(text)) return 'error';
  if (/warning|warn/i.test(text)) return 'warning';
  if (/crash|fatal/i.test(text)) return 'crash';
  if (/backtrace|stack:/i.test(text) || /^\s*#\d+/.test(text)) return 'backtrace';
  if (/info|\[debug\]/i.test(text)) return 'info';
  if (/debug/i.test(text)) return 'debug';
  return '';
}

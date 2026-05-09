/**
 * Telnet / BrightScript console text: TCP-safe line splitting and ANSI stripping.
 * Patterns aligned with common device output (CSI SGR, OSC, etc.) — see strip-ansi (MIT).
 */

/** Mutable buffer for incomplete lines across TCP chunks. */
export type TelnetLineBufferState = { value: string };

/**
 * Append a UTF-8 chunk and return complete lines (no trailing newline on each).
 * Normalizes CRLF and lone CR to LF before splitting.
 */
export function appendTelnetChunk(state: TelnetLineBufferState, chunk: string): string[] {
  if (!chunk) return [];
  // Normalize newlines only in the incoming chunk (cheap); fix `\r` + `\n` split across TCP reads.
  let c = chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (state.value.length > 0 && state.value.endsWith('\r')) {
    const base = state.value.slice(0, -1);
    if (c.length > 0 && c.charCodeAt(0) === 10) {
      state.value = base + '\n' + c.slice(1);
    } else {
      state.value = base + '\n' + c;
    }
  } else {
    state.value += c;
  }
  const parts = state.value.split('\n');
  if (!state.value.endsWith('\n')) {
    state.value = parts.pop() ?? '';
  } else {
    state.value = '';
  }
  const out: string[] = [];
  for (const p of parts) {
    if (p.length) out.push(p);
  }
  return out;
}

/** Remaining partial line after disconnect or stream end (trim trailing whitespace only). */
export function takeTelnetTail(state: TelnetLineBufferState): string | null {
  const t = state.value.replace(/\s+$/, '');
  state.value = '';
  return t.length ? t : null;
}

// eslint-disable-next-line no-control-regex -- intentional: strip terminal escape sequences
const ANSI_ESCAPE = new RegExp(
  [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?]*)*)?)\\u0007)',
    '(?:(?:\\u001B\\]|\\u009D)(?:\\u001B\\[)[0-?]*[ -/]*[@-~])'
  ].join('|'),
  'g'
);

export function stripAnsiForConsole(text: string): string {
  return text.replace(ANSI_ESCAPE, '');
}

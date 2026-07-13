/**
 * Best-effort detection of *which* local process is holding a TCP port, used to turn an opaque
 * `EADDRINUSE` from the MITM proxy into an actionable warning ("Charles (PID 1234) is using port
 * 8888 — close it or change the proxy port"). All probing is **asynchronous** (spawned OS tools,
 * short-timeout) so it never blocks the Electron main-process event loop — a synchronous `lsof`/`ps`
 * probe here used to freeze all IPC (including device connect) for seconds on every EADDRINUSE.
 * Each probe is wrapped so a missing/blocked OS tool degrades gracefully to "process unknown" rather
 * than throwing — the warning is still useful without the process name.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type PortHolder = {
  pid?: number;
  processName?: string;
  command?: string;
};

/** True when an error message indicates the port is already bound by another process. */
export function isAddressInUseError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes('eaddrinuse') || m.includes('address already in use') || m.includes('address in use');
}

async function run(cmd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      encoding: 'utf8',
      timeout: 2500,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    return stdout;
  } catch {
    return '';
  }
}

/** Resolve a fuller command line for a PID on macOS/Linux (best effort). */
async function psCommandForPid(pid: number): Promise<string | undefined> {
  const out = (await run('ps', ['-p', String(pid), '-o', 'command='])).trim();
  return out || undefined;
}

/** Resolve the executable path for a PID on macOS/Linux (best effort). */
async function psExecPathForPid(pid: number): Promise<string | undefined> {
  const out = (await run('ps', ['-p', String(pid), '-o', 'comm='])).trim();
  return out || undefined;
}

/**
 * Derive a clean, human-friendly process name from a command line / executable path. Prefers the
 * macOS `.app` bundle name (e.g. `/Applications/Roku Dev Studio.app/Contents/MacOS/Roku Dev Studio`
 * → "Roku Dev Studio") so we never surface a truncated/escaped `lsof` token like `Roku\x20D`.
 * Falls back to the executable basename, trimming a `.exe` suffix.
 */
function friendlyProcessName(command: string | undefined, execPath: string | undefined): string | undefined {
  const src = (command || execPath || '').trim();
  if (!src) return undefined;
  const appMatch = src.match(/\/([^/]+)\.app\//);
  if (appMatch) return appMatch[1];
  // First whitespace-delimited token is the executable; take its basename.
  const firstToken = src.split(/\s+/)[0] || src;
  const base = (firstToken.split('/').pop() || firstToken).replace(/\.exe$/i, '').trim();
  return base || undefined;
}

/** macOS / Linux: `lsof` gives the listening PID; `ps` resolves a clean name (not lsof's truncated,
 *  space-escaped COMMAND column). */
async function detectUnix(port: number): Promise<PortHolder | null> {
  const out = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);
  if (!out) return null;
  // Skip the header row; the first data row's columns are: COMMAND PID USER ...
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('COMMAND')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const pid = Number(parts[1]);
    if (!Number.isFinite(pid)) continue;
    const command = await psCommandForPid(pid);
    const execPath = await psExecPathForPid(pid);
    return {
      pid,
      // Never trust lsof's truncated COMMAND (`Roku\x20D`); resolve the real name from ps and fall
      // back to the lsof token only if ps gave us nothing.
      processName: friendlyProcessName(command, execPath) || parts[0],
      command: command || execPath
    };
  }
  return null;
}

/** Windows: `netstat -ano` gives the PID listening on the port; `tasklist` maps it to an image name. */
async function detectWindows(port: number): Promise<PortHolder | null> {
  const out = await run('netstat', ['-ano', '-p', 'TCP']);
  if (!out) return null;
  let pid: number | undefined;
  for (const raw of out.split('\n')) {
    const line = raw.trim();
    if (!/LISTENING/i.test(line)) continue;
    const parts = line.split(/\s+/);
    // Proto  Local Address  Foreign Address  State  PID
    const local = parts[1] || '';
    // Parse the port from the local address by its last colon — robust across IPv4 (`0.0.0.0:8888`)
    // and bracketed IPv6 (`[::]:8888`), and avoids matching a substring of a different port.
    const colon = local.lastIndexOf(':');
    if (colon < 0) continue;
    if (Number(local.slice(colon + 1)) !== port) continue;
    const candidate = Number(parts[parts.length - 1]);
    if (Number.isFinite(candidate)) {
      pid = candidate;
      break;
    }
  }
  if (pid === undefined) return null;
  const taskOut = await run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
  let image: string | undefined;
  if (taskOut) {
    // CSV row: "image.exe","1234","Console","1","12,345 K"
    const firstCol = taskOut.split('\n')[0]?.split('","')[0]?.replace(/^"/, '').trim();
    if (firstCol) image = firstCol;
  }
  // "Roku Dev Studio.exe" → "Roku Dev Studio" for the friendly name; keep the .exe for `command`.
  return { pid, processName: friendlyProcessName(undefined, image), command: image };
}

/**
 * Identify the process holding `port`, or null when it can't be determined (tool missing, port
 * already free by the time we probe, or insufficient permission). Never throws.
 */
export async function detectPortHolder(port: number): Promise<PortHolder | null> {
  if (!Number.isFinite(port) || port <= 0) return null;
  try {
    if (process.platform === 'win32') return await detectWindows(port);
    return await detectUnix(port);
  } catch {
    return null;
  }
}

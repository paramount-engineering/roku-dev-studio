import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolveTcpdumpPath, detectLinuxCaptureAvailable } from './capture-engine';

const execFileAsync = promisify(execFile);

const PKEXEC_CANDIDATE_PATHS = ['/usr/bin/pkexec', '/bin/pkexec'] as const;

function resolvePkexecPath(): string | null {
  for (const candidate of PKEXEC_CANDIDATE_PATHS) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Whether tcpdump already carries the capture capabilities, checked via `getcap`. Best-effort:
 * when `getcap` is missing or unreadable we return `null` ("unknown") rather than guessing, so the
 * caller can fall back to the presence-only readiness signal instead of falsely reporting blocked.
 */
export async function isLinuxCaptureAccessGranted(): Promise<boolean | null> {
  if (process.platform !== 'linux') return true;
  const tcpdump = resolveTcpdumpPath();
  if (!tcpdump) return false;
  try {
    const { stdout } = await execFileAsync('getcap', [tcpdump]);
    return /cap_net_raw/i.test(stdout) && /cap_net_admin/i.test(stdout);
  } catch {
    return null;
  }
}

/**
 * Grant tcpdump raw-socket capture rights via a one-time graphical admin prompt (`pkexec`), the
 * Linux analogue of the macOS ChmodBPF helper. Uses Linux capabilities (`setcap`) so RDS itself
 * never needs to run as root and the grant persists across launches.
 */
export async function installCaptureAccessLinux(): Promise<{
  success: boolean;
  error?: string;
  captureToolAvailable?: boolean;
}> {
  if (process.platform !== 'linux') {
    return { success: false, error: 'Packet Capture setup is only required on Linux.' };
  }
  const tcpdump = resolveTcpdumpPath();
  if (!tcpdump) {
    return {
      success: false,
      error: detectLinuxCaptureAvailable().error || 'tcpdump was not found. Install it and try again.'
    };
  }
  const pkexec = resolvePkexecPath();
  const manualHint = `Run manually: sudo setcap cap_net_raw,cap_net_admin=eip ${tcpdump}`;
  if (!pkexec) {
    return {
      success: false,
      error: `pkexec (PolicyKit) is not available for the admin prompt. ${manualHint}`
    };
  }
  // setcap lives in /sbin or /usr/sbin (libcap2-bin); invoke through a shell so PATH resolution and
  // the capability argument are handled by the elevated process.
  const script = `setcap cap_net_raw,cap_net_admin=eip ${shellQuote(tcpdump)}`;
  try {
    await execFileAsync(pkexec, ['sh', '-c', script]);
    const granted = await isLinuxCaptureAccessGranted();
    // `granted === null` means we couldn't verify (no getcap); trust the successful pkexec exit.
    const ok = granted !== false;
    return {
      success: ok,
      error: ok ? undefined : `Capture rights were not applied. ${manualHint}`,
      captureToolAvailable: ok
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // pkexec exits 126 when the user dismisses/declines the authentication dialog.
    if (/dismiss|cancel|not authorized|exit code 126|code 126/i.test(msg)) {
      return { success: false, error: 'cancelled' };
    }
    if (/setcap: command not found|not found/i.test(msg)) {
      return {
        success: false,
        error: `setcap is missing — install libcap (Debian/Ubuntu: sudo apt install libcap2-bin). ${manualHint}`
      };
    }
    return { success: false, error: `Could not grant capture access automatically (${msg}). ${manualHint}` };
  }
}

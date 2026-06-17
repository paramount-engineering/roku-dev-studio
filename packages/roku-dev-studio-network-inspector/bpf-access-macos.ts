import * as fs from 'fs';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { detectBpfCaptureAvailable } from './capture-engine';

const execFileAsync = promisify(execFile);

export const RDS_BPF_LAUNCH_DAEMON_LABEL = 'com.paramount.streaming.roku-dev-studio.ChmodBPF';
export const RDS_BPF_LAUNCH_DAEMON_PLIST = `/Library/LaunchDaemons/${RDS_BPF_LAUNCH_DAEMON_LABEL}.plist`;
export const RDS_BPF_INSTALL_DIR = '/Library/Application Support/Roku Dev Studio/ChmodBPF';
export const RDS_BPF_RUN_SCRIPT = `${RDS_BPF_INSTALL_DIR}/chmod-bpf.sh`;

const CHMOD_BPF_SCRIPT = `#!/bin/bash
GROUP=access_bpf
for bpf in /dev/bpf*; do
  [ -e "$bpf" ] || continue
  chown root:"$GROUP" "$bpf" 2>/dev/null || true
  chmod g+rw "$bpf" 2>/dev/null || chmod a+rw "$bpf" 2>/dev/null || true
done
`;

export function isBpfLaunchDaemonInstalled(): boolean {
  if (process.platform !== 'darwin') return false;
  try {
    return fs.existsSync(RDS_BPF_LAUNCH_DAEMON_PLIST) && fs.existsSync(RDS_BPF_RUN_SCRIPT);
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildInstallShellScript(username: string): string {
  const user = shellQuote(username);
  const installDir = shellQuote(RDS_BPF_INSTALL_DIR);
  const runScript = shellQuote(RDS_BPF_RUN_SCRIPT);
  const launchPlist = shellQuote(RDS_BPF_LAUNCH_DAEMON_PLIST);
  const label = shellQuote(RDS_BPF_LAUNCH_DAEMON_LABEL);

  return `#!/bin/bash
set -e
GROUP=access_bpf
INSTALL_DIR=${installDir}
RUN_SCRIPT=${runScript}
LAUNCH_PLIST=${launchPlist}
LABEL=${label}

dseditgroup -q -o read "$GROUP" 2>/dev/null || dseditgroup -q -o create "$GROUP"
dseditgroup -q -o edit -a ${user} -t user "$GROUP" 2>/dev/null || true

mkdir -p "$INSTALL_DIR"
cat > "$RUN_SCRIPT" << 'RDS_CHMOD_BPF_EOF'
${CHMOD_BPF_SCRIPT}
RDS_CHMOD_BPF_EOF
chmod 755 "$RUN_SCRIPT"
chown root:wheel "$RUN_SCRIPT"

cat > "$LAUNCH_PLIST" << 'RDS_PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.paramount.streaming.roku-dev-studio.ChmodBPF</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Library/Application Support/Roku Dev Studio/ChmodBPF/chmod-bpf.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
RDS_PLIST_EOF
chmod 644 "$LAUNCH_PLIST"
chown root:wheel "$LAUNCH_PLIST"

"$RUN_SCRIPT"

launchctl bootout system "$LABEL" 2>/dev/null || launchctl unload "$LAUNCH_PLIST" 2>/dev/null || true
launchctl bootstrap system "$LAUNCH_PLIST" 2>/dev/null || launchctl load "$LAUNCH_PLIST" 2>/dev/null || true

exit 0
`;
}

async function runShellWithAdminPrivileges(shellScript: string): Promise<void> {
  const tmp = pathJoin(os.tmpdir(), `rds-bpf-install-${Date.now()}.sh`);
  fs.writeFileSync(tmp, shellScript, { mode: 0o700 });
  try {
    const escapedPath = tmp.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    await execFileAsync('osascript', [
      '-e',
      `do shell script "bash \\"${escapedPath}\\"" with administrator privileges`
    ]);
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function pathJoin(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

export async function installBpfAccessMacOS(): Promise<{
  success: boolean;
  error?: string;
  bpfCaptureAvailable?: boolean;
  launchDaemonInstalled?: boolean;
}> {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Packet Capture Setup is only required on macOS.' };
  }
  const username = os.userInfo().username;
  if (!username) {
    return { success: false, error: 'Could not determine the current macOS username.' };
  }
  try {
    await runShellWithAdminPrivileges(buildInstallShellScript(username));
    const bpf = detectBpfCaptureAvailable();
    return {
      success: bpf.ok,
      error: bpf.ok ? undefined : bpf.error,
      bpfCaptureAvailable: bpf.ok,
      launchDaemonInstalled: isBpfLaunchDaemonInstalled()
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/User canceled|canceled/i.test(msg)) {
      return { success: false, error: 'cancelled' };
    }
    return { success: false, error: msg };
  }
}

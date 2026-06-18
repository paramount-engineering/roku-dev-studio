/** User-facing prerequisite / permission remediation (main + Settings + renderer). */

import type { NetworkInspectorPlatform } from './types';

export type PrerequisiteCheck = {
  ok: boolean;
  code: string;
  title: string;
  message: string;
  remediation: string[];
  docsPath?: string;
  /** macOS: one-click installer already on disk */
  persistentFixInstalled?: boolean;
};

export const MACOS_BPF_REMEDIATION_STEPS = [
  'Click “Setup Packet Capture” in the Network tab (one-time admin password — survives reboots).',
  'Or install Wireshark (https://www.wireshark.org/download.html) and run its ChmodBPF installer.',
  'Manual fallback: sudo chmod a+rw /dev/bpf* (temporary — resets when macOS recreates BPF devices).'
] as const;

export function macosBpfBlockedMessage(): string {
  return `macOS blocked packet capture (BPF write access denied). ${MACOS_BPF_REMEDIATION_STEPS.join(' ')}`;
}

export const LINUX_CAPTURE_REMEDIATION_STEPS = [
  'Click “Setup Packet Capture” in the Network tab (one-time admin prompt — grants tcpdump capture rights).',
  'Or run: sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump)',
  'Then return to this tab — no app restart needed.'
] as const;

export function linuxCaptureBlockedMessage(): string {
  return `Linux blocked packet capture (tcpdump needs raw-socket privileges). ${LINUX_CAPTURE_REMEDIATION_STEPS.join(' ')}`;
}

export const WINDOWS_CAP_MODULE_REMEDIATION_STEPS = [
  'Install Npcap from https://npcap.com/ in WinPcap API-compatible mode.',
  'Reinstall/restart Roku Dev Studio so the bundled capture module loads against this build.'
] as const;

export function buildBpfPrerequisiteCheck(opts: {
  bpfCaptureAvailable: boolean;
  persistentFixInstalled?: boolean;
}): PrerequisiteCheck {
  const installed = !!opts.persistentFixInstalled;
  if (opts.bpfCaptureAvailable) {
    return {
      ok: true,
      code: 'bpf-ok',
      title: 'Packet Capture Ready',
      message: 'BPF devices are writable.',
      remediation: [],
      persistentFixInstalled: installed
    };
  }
  return {
    ok: false,
    code: installed ? 'bpf-denied-after-install' : 'bpf-denied',
    title: 'Packet Capture Blocked',
    message:
      'macOS restricts /dev/bpf* to root by default. Manual chmod fixes it only until the OS recreates those devices (often after reboot or sleep).',
    remediation: [...MACOS_BPF_REMEDIATION_STEPS],
    docsPath: 'network-inspector',
    persistentFixInstalled: installed
  };
}

export function buildLinuxCapturePrerequisiteCheck(opts: {
  captureToolAvailable: boolean;
}): PrerequisiteCheck {
  if (opts.captureToolAvailable) {
    return {
      ok: true,
      code: 'linux-capture-ok',
      title: 'Packet Capture Ready',
      message: 'tcpdump is available for capture.',
      remediation: []
    };
  }
  return {
    ok: false,
    code: 'linux-capture-denied',
    title: 'Packet Capture Needs Setup',
    message:
      'Linux captures via tcpdump, which needs raw-socket privileges (root, or the cap_net_raw/cap_net_admin capabilities).',
    remediation: [...LINUX_CAPTURE_REMEDIATION_STEPS],
    docsPath: 'network-inspector'
  };
}

export function buildNetworkInspectorPrerequisites(status: {
  platform: NetworkInspectorPlatform;
  bpfCaptureAvailable?: boolean;
  bpfLaunchDaemonInstalled?: boolean;
  npcapInstalled?: boolean;
  capModuleAvailable?: boolean;
  linuxCaptureAvailable?: boolean;
}): PrerequisiteCheck[] {
  const checks: PrerequisiteCheck[] = [];
  if (status.platform === 'darwin') {
    checks.push(
      buildBpfPrerequisiteCheck({
        bpfCaptureAvailable: status.bpfCaptureAvailable === true,
        persistentFixInstalled: status.bpfLaunchDaemonInstalled === true
      })
    );
  }
  if (status.platform === 'linux') {
    checks.push(
      buildLinuxCapturePrerequisiteCheck({
        captureToolAvailable: status.linuxCaptureAvailable === true
      })
    );
  }
  if (status.platform === 'win32' && status.npcapInstalled === false) {
    checks.push({
      ok: false,
      code: 'npcap-missing',
      // This is optional, not a hard failure: MITM proxying (the default) records proxied
      // requests without Npcap. Npcap only adds *hotspot* capture of DNS/TLS SNI from all of
      // the Roku's traffic, so the copy must not read like the feature is broken.
      title: 'Hotspot Capture Needs Npcap (Optional)',
      message:
        'MITM proxying already works without it. Npcap only adds hotspot capture of DNS/TLS SNI from all of the Roku’s traffic.',
      remediation: [
        'Install Npcap from https://npcap.com/ (WinPcap API-compatible mode).',
        'Restart Roku Dev Studio after installing so the capture module loads.'
      ],
      docsPath: 'network-inspector'
    });
  }
  // Npcap can be present yet the native binding still fail to load (e.g. an ABI mismatch after an
  // Electron upgrade). Surface that distinctly so the user isn't told to reinstall Npcap they
  // already have.
  if (
    status.platform === 'win32' &&
    status.npcapInstalled !== false &&
    status.capModuleAvailable === false
  ) {
    checks.push({
      ok: false,
      code: 'cap-module-missing',
      title: 'Capture Module Unavailable',
      message: 'The native packet-capture module could not be loaded in this build.',
      remediation: [...WINDOWS_CAP_MODULE_REMEDIATION_STEPS],
      docsPath: 'network-inspector'
    });
  }
  return checks;
}

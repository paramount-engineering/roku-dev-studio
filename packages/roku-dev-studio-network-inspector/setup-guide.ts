/**
 * Single source of truth for the Network Inspector "Hotspot Capture Setup" guide.
 *
 * The same per-platform content is rendered in two places so they never drift:
 *   • Settings → Network Inspector → "View setup" modal (main process, settings-dialog).
 *   • The Network Inspector screen's setup badge → modal (renderer).
 *
 * The HTML uses the shared `help-blurb` / `mcp-inline-code` / `mcp-link` classes so the
 * Settings window styles it with its existing CSS; the renderer modal ships matching CSS.
 * All HTML here is static, developer-authored copy (no user input) — safe to inject.
 */

import { platformLabel } from 'roku-dev-studio-platform';

export type NiSetupPlatform = 'darwin' | 'win32' | 'linux';

type GuideBlock =
  | { kind: 'p'; html: string }
  | { kind: 'subhead'; text: string }
  | { kind: 'steps'; items: string[] };

/**
 * Translatable copy for the setup guide, split per platform. All fields are HTML fragments
 * (they carry inline `<strong>`/`<code>`/`<a>`/`<em>` markup + shared classes) except `titlePrefix`.
 * The English defaults below double as this package's standalone/fallback content; the app passes
 * a locale-specific bundle (from `@shared/strings`) so the guide honours the UI language.
 */
export interface NiSetupGuideStrings {
  /** Title prefix; the platform label (macOS/Windows/Linux) is appended. */
  titlePrefix: string;
  darwin: {
    intro: string;
    enableSharing: string;
    sharingSteps: readonly string[];
    captureHead: string;
    captureBody: string;
  };
  win32: {
    intro: string;
    enableHotspot: string;
    hotspotSteps: readonly string[];
    npcapHead: string;
    npcapBody: string;
    npcapSteps: readonly string[];
    npcapNote: string;
  };
  linux: {
    intro: string;
    shareConnection: string;
    shareSteps: readonly string[];
    captureHead: string;
    captureBody: string;
  };
}

/** English source of truth (also the fallback when no localized bundle is supplied). */
export const EN_NI_SETUP_GUIDE: NiSetupGuideStrings = {
  titlePrefix: 'Hotspot Capture Setup',
  darwin: {
    intro: `<strong>Optional — for hotspot capture only.</strong> Decrypting your sideloaded dev channel works on any network without this setup. These steps add hotspot capture of DNS/TLS SNI from <em>all</em> of a Roku's traffic via your Mac's Internet Sharing hotspot (<code class="mcp-inline-code">bridge100</code>). Local devices only.`,
    enableSharing: `<strong>Enable Internet Sharing</strong> — RDS captures on <code class="mcp-inline-code">bridge100</code> once it's on:`,
    sharingSteps: [
      `Open <strong>System Settings → General → Sharing</strong>`,
      `Turn on <strong>Internet Sharing</strong>, sharing <strong>to Wi-Fi</strong>`,
      `Connect your Roku to the Mac's shared Wi-Fi network`
    ],
    captureHead: 'Packet Capture Access',
    captureBody: `macOS creates <code class="mcp-inline-code">/dev/bpf*</code> as root-only. Run the one-time setup below to restore access across reboots (admin password required, like Wireshark's ChmodBPF). Or install <a href="https://www.wireshark.org/download.html" target="_blank" rel="noopener noreferrer" class="mcp-link">Wireshark</a> and run its ChmodBPF installer.`
  },
  win32: {
    intro: `<strong>Optional — for hotspot capture only.</strong> Decrypting your sideloaded dev channel works on any network without this setup (the MITM proxy handles both same-Wi-Fi and hotspot). These steps add hotspot capture of DNS/TLS SNI from <em>all</em> of a Roku's traffic when it's connected through this PC's hotspot. Local devices only.`,
    enableHotspot: `<strong>Enable a hotspot yourself (optional)</strong> — RDS doesn't toggle Windows networking; you control it:`,
    hotspotSteps: [
      `Open <strong>Settings → Network &amp; internet → Mobile hotspot</strong>`,
      `Turn <strong>Mobile hotspot</strong> on (share over Wi-Fi)`,
      `Connect your Roku to that hotspot — RDS auto-detects the virtual adapter`
    ],
    npcapHead: 'Hotspot Capture Access (Npcap)',
    npcapBody: `Hotspot capture (DNS/TLS SNI from all of the Roku's traffic) needs the <a href="https://npcap.com/" target="_blank" rel="noopener noreferrer" class="mcp-link">Npcap</a> driver. This is optional — leave it out and MITM proxying still records your sideloaded dev channel.`,
    npcapSteps: [
      `Download and run the installer from <a href="https://npcap.com/" target="_blank" rel="noopener noreferrer" class="mcp-link">npcap.com</a>`,
      `During setup, enable <strong>“Install Npcap in WinPcap API-compatible Mode”</strong>`,
      `<strong>Restart Roku Dev Studio</strong> after installing so the bundled capture module loads`
    ],
    npcapNote: `Already have Npcap but capture still won't start? Reinstall Roku Dev Studio so its native capture module matches this build.`
  },
  linux: {
    intro: `<strong>Optional — for hotspot capture only.</strong> Decrypting your sideloaded dev channel works on any network without this setup. These steps add hotspot capture of DNS/TLS SNI from <em>all</em> of a Roku's traffic by sharing this machine's connection. Local devices only.`,
    shareConnection: `<strong>Share your connection</strong> so the Roku routes through this machine:`,
    shareSteps: [
      `Use NetworkManager → <strong>“Shared to other computers”</strong> on a Wi-Fi/Ethernet connection (gateway <code class="mcp-inline-code">10.42.0.1</code>), or run a hostapd hotspot`,
      `Connect your Roku to that shared network — RDS auto-detects the gateway interface`
    ],
    captureHead: 'Packet Capture Access',
    captureBody: `Linux captures via <code class="mcp-inline-code">tcpdump</code>, which needs raw-socket privileges. Run the one-time setup below (admin prompt) to grant the <code class="mcp-inline-code">cap_net_raw</code>/<code class="mcp-inline-code">cap_net_admin</code> capabilities — or manually: <code class="mcp-inline-code">sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump)</code>.`
  }
};

/** Modal/section title, e.g. "Hotspot Capture Setup · macOS". */
export function networkInspectorSetupTitle(
  platform: NiSetupPlatform,
  titlePrefix: string = EN_NI_SETUP_GUIDE.titlePrefix
): string {
  return `${titlePrefix} · ${platformLabel(platform)}`;
}

/**
 * Whether this platform offers an in-app one-click "Setup Packet Capture" action.
 * macOS (ChmodBPF-style BPF grant) and Linux (setcap via pkexec) do; Windows relies on the
 * external Npcap installer, so there's no in-app action there.
 */
export function networkInspectorHasCaptureSetupAction(platform: NiSetupPlatform): boolean {
  return platform === 'darwin' || platform === 'linux';
}

function guideBlocks(platform: NiSetupPlatform, s: NiSetupGuideStrings): GuideBlock[] {
  if (platform === 'darwin') {
    const d = s.darwin;
    return [
      { kind: 'p', html: d.intro },
      { kind: 'p', html: d.enableSharing },
      { kind: 'steps', items: [...d.sharingSteps] },
      { kind: 'subhead', text: d.captureHead },
      { kind: 'p', html: d.captureBody }
    ];
  }
  if (platform === 'win32') {
    const w = s.win32;
    return [
      { kind: 'p', html: w.intro },
      { kind: 'p', html: w.enableHotspot },
      { kind: 'steps', items: [...w.hotspotSteps] },
      { kind: 'subhead', text: w.npcapHead },
      { kind: 'p', html: w.npcapBody },
      { kind: 'steps', items: [...w.npcapSteps] },
      { kind: 'p', html: w.npcapNote }
    ];
  }
  const l = s.linux;
  return [
    { kind: 'p', html: l.intro },
    { kind: 'p', html: l.shareConnection },
    { kind: 'steps', items: [...l.shareSteps] },
    { kind: 'subhead', text: l.captureHead },
    { kind: 'p', html: l.captureBody }
  ];
}

/**
 * Inner HTML for the setup guide body (paragraphs + numbered steps), excluding the in-app
 * "Setup Packet Capture" action button (each host appends its own wired button). Pass a
 * localized `strings` bundle to honour the UI language; omit it for the English default.
 */
export function networkInspectorSetupGuideBodyHtml(
  platform: NiSetupPlatform,
  strings: NiSetupGuideStrings = EN_NI_SETUP_GUIDE
): string {
  return guideBlocks(platform, strings)
    .map((block) => {
      if (block.kind === 'p') return `        <p class="help-blurb">${block.html}</p>`;
      if (block.kind === 'subhead') {
        return `        <p class="help-blurb" style="margin-bottom: 8px;"><strong>${block.text}</strong></p>`;
      }
      return `        <ol class="help-blurb">${block.items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
    })
    .join('\n');
}

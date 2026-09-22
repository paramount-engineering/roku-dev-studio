import { S, applyI18n } from '@shared/strings/index.js';
import { initLocaleForWindow } from '../../modules/utils/locale-live.js';
import { installCrashCapture } from '../../modules/errors/install.js';
import { buildGithubIssueUrl } from '../../modules/errors/crash-report.js';

type AboutInfo = {
  appVersion: string;
  /** ISO timestamp stamped by the bundle build (build-info.json); null when unavailable. */
  buildTime: string | null;
  rokuDevStudioApiVersion: string;
  electronVersion: string;
  nodeVersion: string;
  chromiumVersion: string;
  v8Version: string;
  osType: string;
  arch: string;
  osRelease: string;
  iconUrl: string;
  repoUrl: string;
  authorUrl: string;
  siteUrl: string;
};

const api = (window as any).aboutApi as {
  getInfo: () => Promise<AboutInfo>;
  copy: (text: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  fitHeight?: (contentHeight: number) => void;
  checkForUpdates?: () => Promise<{ success: boolean; error?: string }>;
  onLocaleChanged?: (callback: (pref: string) => void) => () => void;
  getSetting: (key: string) => Promise<{ success: boolean; value?: unknown }>;
  getAppInfo: () => Promise<{ version: string; platform: string; osRelease: string }>;
} | undefined;

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** The App Details table as plain text — what Copy puts on the clipboard and what an issue report embeds. */
function versionInfoText(info: AboutInfo): string {
  return [
    S.about.copyAppVersion(info.appVersion),
    S.about.copyBuildTime(info.buildTime ?? '—'),
    S.about.copyApiVersion(info.rokuDevStudioApiVersion),
    S.about.copyElectronVersion(info.electronVersion),
    S.about.copyNodeVersion(info.nodeVersion),
    S.about.copyChromiumVersion(info.chromiumVersion),
    S.about.copyV8Version(info.v8Version),
    S.about.copyOperatingSystem(info.osType + ' ' + info.arch + ' ' + info.osRelease),
  ].join('\n');
}

function copyVersionInfo(info: AboutInfo): void {
  if (!api?.copy) return;
  api.copy(versionInfoText(info)).then(() => {
    const btn = document.getElementById('btnCopy');
    if (!btn) return;
    // Icon-only button: flip to the check mark and say "Copied!" in the tooltip for a moment.
    btn.classList.add('is-copied');
    btn.setAttribute('title', S.about.copied);
    btn.setAttribute('aria-label', S.about.copied);
    setTimeout(() => {
      btn.classList.remove('is-copied');
      btn.setAttribute('title', S.common.copy);
      btn.setAttribute('aria-label', S.common.copy);
    }, 2000);
  }).catch(() => undefined);
}

// Localize the static about.html shell (field labels, buttons).
applyI18n(document);
// Apply the active locale on open + retranslate live on change.
void initLocaleForWindow(api as unknown as Parameters<typeof initLocaleForWindow>[0]);

if (api) {
  installCrashCapture({
    windowName: 'about',
    getSetting: api.getSetting,
    getAppInfo: api.getAppInfo,
    openExternal: api.openExternal
  });
}

if (!api?.getInfo) {
  document.body.innerHTML = '<p style="color:#e0e0e0;padding:16px">' + S.about.apiUnavailable + '</p>';
} else {
  api.getInfo().then((info) => {
    const logo = document.getElementById('appLogo') as HTMLImageElement | null;
    if (logo) {
      logo.src = info.iconUrl;
      logo.alt = S.about.logoAlt;
      logo.onerror = () => { logo.style.display = 'none'; };
    }

    setText('appVersion', S.about.versionLabel(info.appVersion));
    // Build time sits beside the version: locale-formatted for the eye, ISO in the tooltip and in
    // the copied/issue text; hidden entirely when the build wrote no stamp.
    const buildTimeEl = document.getElementById('buildTime');
    if (buildTimeEl) {
      buildTimeEl.hidden = !info.buildTime;
      if (info.buildTime) {
        buildTimeEl.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(info.buildTime));
        buildTimeEl.setAttribute('title', info.buildTime);
      }
    }
    setText('rdsApiVersion', info.rokuDevStudioApiVersion);
    setText('electronVersion', info.electronVersion);
    setText('nodeVersion', info.nodeVersion);
    setText('chromiumVersion', info.chromiumVersion);
    setText('v8Version', info.v8Version);
    setText('osInfo', info.osType + ' ' + info.arch + ' ' + info.osRelease);

    const repoLink = document.getElementById('repoLink');
    const authorLink = document.getElementById('authorLink');

    repoLink?.addEventListener('click', (e) => {
      e.preventDefault();
      api!.openExternal(info.repoUrl).catch(() => undefined);
    });
    authorLink?.addEventListener('click', (e) => {
      e.preventDefault();
      api!.openExternal(info.authorUrl).catch(() => undefined);
    });
    document.getElementById('siteLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      api!.openExternal(info.siteUrl).catch(() => undefined);
    });

    // Fit the (non-resizable) window to the rendered content: once now, again when fonts settle and
    // whenever a live locale switch retranslates the labels. `body` is a flex column with no fixed
    // height, so its box is the content height; add its vertical margins for the true page height.
    const fitWindowToContent = (): void => {
      if (!api?.fitHeight) return;
      const body = document.body;
      const cs = getComputedStyle(body);
      const height = body.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
      if (Number.isFinite(height) && height > 0) api.fitHeight(Math.ceil(height));
    };
    // ONE fit before the window is revealed (main shows it on the first fit): wait for the logo to
    // load or fail (a failed logo is hidden, which changes the height) and for fonts to settle, so
    // there is nothing left to jump afterwards. Later locale switches re-fit as needed.
    const logoSettled = new Promise<void>((resolve) => {
      if (!logo || logo.complete) return resolve();
      logo.addEventListener('load', () => resolve(), { once: true });
      logo.addEventListener('error', () => resolve(), { once: true });
      setTimeout(resolve, 300);
    });
    // Intro geometry: how far the icon must start to the right to sit at the centre alone, and how
    // far the text must start to the left to be hidden behind it. Both depend on the rendered text
    // width, so they are measured once fonts/logo have settled and handed to the CSS keyframes.
    const startHeaderIntro = (): void => {
      const header = document.querySelector<HTMLElement>('.header');
      const text = document.querySelector<HTMLElement>('.header-text');
      if (!header || !text) return;
      const gap = parseFloat(getComputedStyle(header).columnGap) || 0;
      const iconWidth = logo?.getBoundingClientRect().width ?? 0;
      const textWidth = text.getBoundingClientRect().width;
      header.style.setProperty('--intro-logo-shift', `${(textWidth + gap) / 2}px`);
      header.style.setProperty('--intro-text-shift', `${-(iconWidth + gap) / 2}px`);
      header.classList.add('is-ready');
    };
    Promise.all([logoSettled, document.fonts?.ready ?? Promise.resolve()])
      .then(() => requestAnimationFrame(() => { startHeaderIntro(); fitWindowToContent(); }))
      .catch(() => { startHeaderIntro(); fitWindowToContent(); });
    api!.onLocaleChanged?.(() => requestAnimationFrame(fitWindowToContent));

    // "Check for Updates": the same check the Help menu runs; while it runs the button says
    // "Checking…", and the outcome (up to date / update available) surfaces in the main window.
    const updateBtn = document.getElementById('btnUpdate') as HTMLButtonElement | null;
    updateBtn?.addEventListener('click', () => {
      if (!api?.checkForUpdates || updateBtn.disabled) return;
      const label = updateBtn.textContent;
      updateBtn.disabled = true;
      updateBtn.textContent = S.about.checkingForUpdates;
      api.checkForUpdates()
        .catch(() => undefined)
        .then(() => {
          updateBtn.disabled = false;
          updateBtn.textContent = label;
        });
    });

    document.getElementById('btnOk')?.addEventListener('click', () => window.close());
    document.getElementById('btnCopy')?.addEventListener('click', () => copyVersionInfo(info));
    // "Submit an Issue": GitHub's new-issue page with the App Details already filled in (same
    // URL builder as the crash reporter, so the length ceiling and encoding are shared).
    document.getElementById('btnIssue')?.addEventListener('click', () => {
      const url = buildGithubIssueUrl(S.about.issueTitle(info.appVersion), S.about.issueBody(versionInfoText(info)));
      api!.openExternal(url).catch(() => undefined);
    });
  }).catch((err) => {
    document.body.innerHTML = '<p style="color:#e0e0e0;padding:16px">' + S.about.failedToLoad(String(err)) + '</p>';
  });
}

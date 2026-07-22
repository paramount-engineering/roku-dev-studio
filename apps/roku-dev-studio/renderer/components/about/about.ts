import { S, applyI18n } from '@shared/strings/index.js';

type AboutInfo = {
  appVersion: string;
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
};

const api = (window as any).aboutApi as {
  getInfo: () => Promise<AboutInfo>;
  copy: (text: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
} | undefined;

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function copyVersionInfo(info: AboutInfo): void {
  const text = [
    S.about.copyAppVersion(info.appVersion),
    S.about.copyApiVersion(info.rokuDevStudioApiVersion),
    S.about.copyElectronVersion(info.electronVersion),
    S.about.copyNodeVersion(info.nodeVersion),
    S.about.copyChromiumVersion(info.chromiumVersion),
    S.about.copyV8Version(info.v8Version),
    S.about.copyOperatingSystem(info.osType + ' ' + info.arch + ' ' + info.osRelease),
  ].join('\n');

  if (!api?.copy) return;
  api.copy(text).then(() => {
    const btn = document.getElementById('btnCopy');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = S.about.copied;
    setTimeout(() => { if (btn) btn.textContent = orig; }, 2000);
  }).catch(() => undefined);
}

// Localize the static about.html shell (field labels, buttons).
applyI18n(document);

if (!api?.getInfo) {
  document.body.innerHTML = '<p style="color:#e0e0e0;padding:16px">' + S.about.apiUnavailable + '</p>';
} else {
  api.getInfo().then((info) => {
    const logo = document.getElementById('appLogo') as HTMLImageElement | null;
    if (logo) {
      logo.src = info.iconUrl;
      logo.onerror = () => { logo.style.display = 'none'; };
    }

    setText('appVersion', S.about.versionLabel(info.appVersion));
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

    document.getElementById('btnOk')?.addEventListener('click', () => window.close());
    document.getElementById('btnCopy')?.addEventListener('click', () => copyVersionInfo(info));
  }).catch((err) => {
    document.body.innerHTML = '<p style="color:#e0e0e0;padding:16px">' + S.about.failedToLoad(String(err)) + '</p>';
  });
}

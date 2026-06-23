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
    'Roku Dev Studio Version: ' + info.appVersion,
    'Roku Dev Studio API Version: ' + info.rokuDevStudioApiVersion,
    'Electron Version: ' + info.electronVersion,
    'Node.js Version: ' + info.nodeVersion,
    'Chromium Version: ' + info.chromiumVersion,
    'V8 Version: ' + info.v8Version,
    'Operating System: ' + info.osType + ' ' + info.arch + ' ' + info.osRelease,
  ].join('\n');

  if (!api?.copy) return;
  api.copy(text).then(() => {
    const btn = document.getElementById('btnCopy');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { if (btn) btn.textContent = orig; }, 2000);
  }).catch(() => undefined);
}

if (!api?.getInfo) {
  document.body.innerHTML = '<p style="color:#e0e0e0;padding:16px">About API unavailable.</p>';
} else {
  api.getInfo().then((info) => {
    const logo = document.getElementById('appLogo') as HTMLImageElement | null;
    if (logo) {
      logo.src = info.iconUrl;
      logo.onerror = () => { logo.style.display = 'none'; };
    }

    setText('appVersion', 'Version ' + info.appVersion);
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
    document.body.innerHTML = '<p style="color:#e0e0e0;padding:16px">Failed to load: ' + String(err) + '</p>';
  });
}

/**
 * Update notification banner — mounts into the DOM when a new version is detected.
 *
 * Flow:
 *   idle → checking → available → [user clicks Download] → downloading → ready → [user clicks Restart]
 *
 * The banner appears in the bottom-right corner and can be dismissed (except when
 * a download is in progress or an update is ready to install).
 */

interface UpdaterStatus {
  type: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error';
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  message?: string;
}

const BANNER_ID = 'rds-update-banner';

function formatBytes(bps: number): string {
  if (bps > 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
  if (bps > 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

function ensureBannerStyles(): void {
  if (document.getElementById('rds-update-banner-style')) return;
  const style = document.createElement('style');
  style.id = 'rds-update-banner-style';
  style.textContent = `
    #rds-update-banner {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      background: #1e1e2a;
      border: 1px solid rgba(139, 92, 246, 0.35);
      border-radius: 10px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.08);
      padding: 14px 16px;
      min-width: 280px;
      max-width: 340px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      animation: rds-banner-in 0.22s cubic-bezier(0.16,1,0.3,1);
    }
    @keyframes rds-banner-in {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    #rds-update-banner.rds-banner-out {
      animation: rds-banner-out 0.18s ease forwards;
    }
    @keyframes rds-banner-out {
      to { opacity: 0; transform: translateY(8px) scale(0.97); }
    }
    .rds-banner-header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .rds-banner-icon {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: rgba(139, 92, 246, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: #a78bfa;
    }
    .rds-banner-text { flex: 1; min-width: 0; }
    .rds-banner-title {
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 2px;
    }
    .rds-banner-subtitle { color: #94a3b8; font-size: 11.5px; }
    .rds-banner-dismiss {
      margin-left: auto;
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0 0 0 4px;
      flex-shrink: 0;
    }
    .rds-banner-dismiss:hover { color: #94a3b8; }
    .rds-banner-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .rds-banner-btn {
      padding: 5px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: opacity 0.15s;
    }
    .rds-banner-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .rds-banner-btn-primary { background: #8b5cf6; color: #fff; }
    .rds-banner-btn-primary:hover:not(:disabled) { background: #7c3aed; }
    .rds-banner-btn-ghost {
      background: rgba(255,255,255,0.06);
      color: #94a3b8;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .rds-banner-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
    .rds-banner-progress-wrap {
      background: rgba(255,255,255,0.07);
      border-radius: 4px;
      height: 5px;
      overflow: hidden;
    }
    .rds-banner-progress-bar {
      height: 100%;
      background: #8b5cf6;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .rds-banner-progress-label {
      font-size: 11px;
      color: #64748b;
      text-align: right;
    }
    .rds-banner-error { color: #f87171; font-size: 11.5px; }
  `;
  document.head.appendChild(style);
}

function removeBanner(): void {
  const existing = document.getElementById(BANNER_ID);
  if (!existing) return;
  existing.classList.add('rds-banner-out');
  setTimeout(() => existing.remove(), 200);
}

function renderBanner(status: UpdaterStatus): void {
  removeBanner();

  if (status.type === 'idle' || status.type === 'checking' || status.type === 'not-available') return;

  ensureBannerStyles();

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  const iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>`;

  if (status.type === 'available') {
    banner.innerHTML = `
      <div class="rds-banner-header">
        <div class="rds-banner-icon">${iconSvg}</div>
        <div class="rds-banner-text">
          <div class="rds-banner-title">Update Available</div>
          <div class="rds-banner-subtitle">Version ${status.version ?? ''} is ready to download.</div>
        </div>
        <button class="rds-banner-dismiss" aria-label="Dismiss update notification">×</button>
      </div>
      <div class="rds-banner-actions">
        <button class="rds-banner-btn rds-banner-btn-ghost" id="rdsUpdateDismiss">Later</button>
        <button class="rds-banner-btn rds-banner-btn-primary" id="rdsUpdateDownload">Download</button>
      </div>`;

    document.body.appendChild(banner);

    banner.querySelector('.rds-banner-dismiss')?.addEventListener('click', removeBanner);
    document.getElementById('rdsUpdateDismiss')?.addEventListener('click', removeBanner);
    document.getElementById('rdsUpdateDownload')?.addEventListener('click', () => {
      const btn = document.getElementById('rdsUpdateDownload') as HTMLButtonElement | null;
      if (btn) btn.disabled = true;
      (window as any).rdsUpdater?.download().catch(() => undefined);
    });

  } else if (status.type === 'downloading') {
    const pct = Math.round(status.percent ?? 0);
    const speed = status.bytesPerSecond != null ? ` · ${formatBytes(status.bytesPerSecond)}` : '';
    banner.innerHTML = `
      <div class="rds-banner-header">
        <div class="rds-banner-icon">${iconSvg}</div>
        <div class="rds-banner-text">
          <div class="rds-banner-title">Downloading Update…</div>
          <div class="rds-banner-subtitle">Please wait while the update is downloaded.</div>
        </div>
      </div>
      <div class="rds-banner-progress-wrap">
        <div class="rds-banner-progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="rds-banner-progress-label">${pct}%${speed}</div>`;

    document.body.appendChild(banner);

  } else if (status.type === 'ready') {
    banner.innerHTML = `
      <div class="rds-banner-header">
        <div class="rds-banner-icon">${iconSvg}</div>
        <div class="rds-banner-text">
          <div class="rds-banner-title">Update Ready</div>
          <div class="rds-banner-subtitle">Version ${status.version ?? ''} will be installed on restart.</div>
        </div>
      </div>
      <div class="rds-banner-actions">
        <button class="rds-banner-btn rds-banner-btn-ghost" id="rdsUpdateLater">Later</button>
        <button class="rds-banner-btn rds-banner-btn-primary" id="rdsUpdateInstall">Restart & Install</button>
      </div>`;

    document.body.appendChild(banner);

    document.getElementById('rdsUpdateLater')?.addEventListener('click', removeBanner);
    document.getElementById('rdsUpdateInstall')?.addEventListener('click', () => {
      (window as any).rdsUpdater?.install().catch(() => undefined);
    });

  } else if (status.type === 'error') {
    const msg = status.message ?? 'Update check failed.';
    banner.innerHTML = `
      <div class="rds-banner-header">
        <div class="rds-banner-icon">${iconSvg}</div>
        <div class="rds-banner-text">
          <div class="rds-banner-title">Update Error</div>
          <div class="rds-banner-error">${msg.length > 120 ? msg.slice(0, 120) + '…' : msg}</div>
        </div>
        <button class="rds-banner-dismiss" aria-label="Dismiss">×</button>
      </div>`;

    document.body.appendChild(banner);
    banner.querySelector('.rds-banner-dismiss')?.addEventListener('click', removeBanner);
  }
}

export function mountUpdateNotification(): void {
  const updater = (window as any).rdsUpdater;
  if (!updater) return;

  // Wire live updates
  updater.onStatus((status: UpdaterStatus) => {
    renderBanner(status);
  });

  // Recover status if the window reloaded and missed earlier broadcasts
  updater.getStatus().then((status: UpdaterStatus) => {
    if (status && status.type !== 'idle' && status.type !== 'checking' && status.type !== 'not-available') {
      renderBanner(status);
    }
  }).catch(() => undefined);
}

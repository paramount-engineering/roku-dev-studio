/**
 * Update notification banner — mounts into the DOM when a new version is detected.
 *
 * Flow:
 *   idle → checking → available → [user clicks Download] → downloading → ready → [user clicks Restart]
 *
 * The banner appears in the bottom-right corner and can be dismissed (except when
 * a download is in progress or an update is ready to install).
 */

import { showToast } from '../../modules/utils/ui.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { registerRetranslate } from '../../modules/ui/retranslate-registry.js';
import { S } from '@shared/strings/index.js';

interface UpdaterStatus {
  type: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error';
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  message?: string;
  needsManualDownload?: boolean;
  notifyNoUpdate?: boolean;
}

const BANNER_ID = 'rds-update-banner';
const BANNER_CLASS = 'rds-update-banner';
const LATEST_RELEASE_URL = 'https://github.com/paramount-engineering/roku-dev-studio/releases/latest';
const RELEASE_NOTES_MODAL_ID = 'rds-release-notes-modal';

type LatestReleaseInfo = {
  title: string;
  body: string;
  htmlUrl: string;
};

let cachedLatestReleaseInfo: LatestReleaseInfo | null = null;
// In-flight fetch so a prefetch (when the banner appears) and a click-open share
// one request, and so the modal can await the same promise instead of re-fetching.
let latestReleaseInfoPromise: Promise<LatestReleaseInfo> | null = null;

function isMissingReleaseMetadataError(message: string): boolean {
  return /latest-mac\.yml|release artifacts|cannot find\s+latest/i.test(message);
}

function formatBytes(bps: number): string {
  if (bps > 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
  if (bps > 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(line: string): string {
  let html = escapeHtml(line);

  // Inline code first so later formatting does not affect code spans.
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links: [label](https://...)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  return html;
}

function renderReleaseNotesBody(body: string): string {
  // Strip everything from the first horizontal rule (---) onwards — the release
  // body convention uses this to separate the human-readable notes from the
  // auto-generated downloads/installation table.
  const withoutSuffix = (body || '').replace(/\r\n?/g, '\n').replace(/\n---[\s\S]*$/, '');
  const trimmed = withoutSuffix.trim();
  if (!trimmed) return `<p>${S.modals.noReleaseNotes}</p>`;

  const lines = trimmed.split('\n');
  const out: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let inUl = false;
  let inOl = false;
  let inQuote = false;
  let quoteLines: string[] = [];

  function closeLists() {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  }

  function closeQuote() {
    if (!inQuote) return;
    out.push(`<blockquote>${quoteLines.map((l) => `<p>${formatInlineMarkdown(l)}</p>`).join('')}</blockquote>`);
    inQuote = false;
    quoteLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine ?? '';
    const fence = line.match(/^```/);
    if (fence) {
      closeLists();
      closeQuote();
      if (inCode) {
        out.push(`<pre class="rds-release-notes-code"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        inCode = false;
        codeLines = [];
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeLists();
      closeQuote();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeLists();
      closeQuote();
      const level = heading[1].length;
      out.push(`<h${level}>${formatInlineMarkdown(heading[2].trim())}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeLists();
      if (!inQuote) {
        inQuote = true;
        quoteLines = [];
      }
      quoteLines.push(quote[1]);
      continue;
    }

    const ul = line.match(/^[-*+]\s+(.+)$/);
    if (ul) {
      closeQuote();
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${formatInlineMarkdown(ul[1].trim())}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      closeQuote();
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${formatInlineMarkdown(ol[1].trim())}</li>`);
      continue;
    }

    closeLists();
    closeQuote();
    out.push(`<p>${formatInlineMarkdown(line.trim())}</p>`);
  }

  if (inCode) {
    out.push(`<pre class="rds-release-notes-code"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  closeLists();
  closeQuote();

  return `<div class="rds-release-notes-markdown">${out.join('')}</div>`;
}

function fetchLatestReleaseInfo(): Promise<LatestReleaseInfo> {
  if (cachedLatestReleaseInfo) return Promise.resolve(cachedLatestReleaseInfo);
  if (latestReleaseInfoPromise) return latestReleaseInfoPromise;

  latestReleaseInfoPromise = (async () => {
    const updater = (window as any).rdsUpdater;
    if (!updater?.getLatestReleaseInfo) throw new Error('Updater release API unavailable');
    const result = await updater.getLatestReleaseInfo();
    if (!result?.success || !result?.info) {
      throw new Error(String(result?.error || 'Failed to load release notes'));
    }
    const json = result.info;
    const info: LatestReleaseInfo = {
      title: String(json?.title || S.modals.latestRelease),
      body: String(json?.body || ''),
      htmlUrl: String(json?.htmlUrl || LATEST_RELEASE_URL)
    };
    cachedLatestReleaseInfo = info;
    return info;
  })();
  // Drop the memo on failure so a later open can retry the request.
  latestReleaseInfoPromise.catch(() => {
    latestReleaseInfoPromise = null;
  });
  return latestReleaseInfoPromise;
}

/** Warm the cache in the background (e.g. when the update banner appears) so the
 *  Release Notes modal opens fully populated instead of empty-then-fill. */
function prefetchLatestReleaseInfo(): void {
  void fetchLatestReleaseInfo().catch(() => undefined);
}

function removeReleaseNotesModal(): void {
  const existing = document.getElementById(RELEASE_NOTES_MODAL_ID);
  if (existing) existing.remove();
}

/**
 * FLIP-animate the modal dialog so it appears to *expand* out of the notification banner:
 * the dialog is rendered at its final centered size, then we start it transformed down to the
 * banner's on-screen rect (position + size) and animate that transform away to identity, while
 * the backdrop blur/tint fades in. Reads as the banner growing into the modal rather than a
 * hard modal pop. No-op if the origin rect or Web Animations API is unavailable.
 */
function animateModalExpandFrom(modal: HTMLElement, originRect: DOMRect): void {
  const dialog = modal.querySelector('.rds-release-notes-dialog') as HTMLElement | null;
  if (!dialog || typeof dialog.animate !== 'function') return;
  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const finalRect = dialog.getBoundingClientRect();
  if (finalRect.width < 1 || finalRect.height < 1) return;

  const sx = Math.max(0.05, originRect.width / finalRect.width);
  const sy = Math.max(0.05, originRect.height / finalRect.height);
  const tx = originRect.left - finalRect.left;
  const ty = originRect.top - finalRect.top;

  dialog.style.transformOrigin = 'top left';
  dialog.animate(
    [
      { transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`, opacity: 0.35, borderRadius: '12px' },
      { transform: 'translate(0, 0) scale(1, 1)', opacity: 1, borderRadius: '16px' }
    ],
    { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  );
  // Fade the backdrop tint/blur in without touching the dialog's own opacity animation.
  modal.animate(
    [
      { backgroundColor: 'rgba(0, 0, 0, 0)', backdropFilter: 'blur(0px)' },
      { backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }
    ],
    { duration: 260, easing: 'ease-out' }
  );
}

function showReleaseNotesModal(opts: { originRect?: DOMRect } = {}): void {
  removeReleaseNotesModal();
  const modal = document.createElement('div');
  modal.id = RELEASE_NOTES_MODAL_ID;
  modal.className = 'rds-release-notes-overlay';
  modal.innerHTML = `
    <div class="rds-release-notes-dialog" role="dialog" aria-modal="true" aria-labelledby="rdsReleaseNotesTitle">
      <div class="rds-release-notes-header">
        <h3 id="rdsReleaseNotesTitle">${S.modals.releaseNotes}</h3>
        <div class="rds-release-notes-header-actions">
          <button type="button" class="rds-release-notes-icon-btn" id="rdsReleaseNotesOpenPage" title="${S.modals.openReleasePage}" aria-label="${S.modals.openReleasePage}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
          <button type="button" class="rds-release-notes-close" aria-label="${S.common.close}">×</button>
        </div>
      </div>
      <div class="rds-release-notes-content" id="rdsReleaseNotesContent"></div>
    </div>`;

  document.body.appendChild(modal);

  const close = () => removeReleaseNotesModal();
  attachBackdropClickToClose(modal, close);
  modal.querySelector('.rds-release-notes-close')?.addEventListener('click', close);
  document.getElementById('rdsReleaseNotesOpenPage')?.addEventListener('click', () => {
    (window as any).roku?.openExternal?.(LATEST_RELEASE_URL).catch(() => undefined);
  });

  const content = document.getElementById('rdsReleaseNotesContent');

  const applyInfo = (info: LatestReleaseInfo) => {
    // Update the modal heading to "v1.1.0 · Release Notes" once we know the version.
    const titleEl = document.getElementById('rdsReleaseNotesTitle');
    if (titleEl) titleEl.textContent = S.modals.versionedReleaseNotes(info.title);
    if (content) content.innerHTML = renderReleaseNotesBody(info.body);
    const openBtn = document.getElementById('rdsReleaseNotesOpenPage') as HTMLButtonElement | null;
    if (openBtn) {
      openBtn.onclick = () => {
        (window as any).roku?.openExternal?.(info.htmlUrl || LATEST_RELEASE_URL).catch(() => undefined);
      };
    }
  };

  // Put the initial content in place BEFORE measuring for the expand animation, so the
  // dialog is at its real size. Cached (usually prefetched) → full notes; cold → spinner.
  if (cachedLatestReleaseInfo) {
    applyInfo(cachedLatestReleaseInfo);
  } else if (content) {
    content.innerHTML = `<div class="rds-release-notes-loading"><span class="rds-release-notes-spinner" aria-hidden="true"></span>${S.modals.loadingReleaseNotes}</div>`;
  }

  // Smoothly expand out of the banner (if the caller passed its rect). Runs after content is
  // set so the FLIP measures the dialog's real dimensions.
  if (opts.originRect) animateModalExpandFrom(modal, opts.originRect);

  // Cold open: fetch and fill in once the request resolves (modal is already open/expanded).
  if (!cachedLatestReleaseInfo) {
    fetchLatestReleaseInfo().then(applyInfo).catch((err) => {
      if (!content) return;
      content.innerHTML = `
        <p>${S.modals.couldNotLoadReleaseNotes}</p>
        <p class="rds-release-notes-fallback">${escapeHtml(String(err?.message || err || S.modals.unknownError))}</p>
      `;
    });
  }
}

function ensureBannerStyles(): void {
  if (document.getElementById('rds-update-banner-style')) return;
  const style = document.createElement('style');
  style.id = 'rds-update-banner-style';
  // All colour/radius/shadow tokens are aligned with the app-wide CSS variables
  // defined in renderer/index.html :root so every modal surface looks identical.
  //
  // Shared modal constants (mirror the canonical values from index.html):
  //   Overlay:  rgba(0,0,0,0.7)  backdrop-filter: blur(4px)  z-index: 100000
  //   Dialog:   bg var(--bg-tertiary)  border var(--border)  radius 16px
  //             shadow 0 20px 60px rgba(0,0,0,0.5)
  //   Header:   padding 16px 20px  title 16px/600
  //   Btn close: 28×28  bg var(--bg-elevated)  hover var(--bg-elevated) +10%
  style.textContent = `
    /* ── Update notification banner ─────────────────────────────────── */
    #rds-update-banner {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 100000;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-hover, rgba(139, 92, 246, 0.25));
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      padding: 14px 16px;
      min-width: 280px;
      max-width: 340px;
      font-family: inherit;
      font-size: 13px;
      color: var(--text-primary);
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
      background: var(--accent-purple-dim);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--accent-purple);
    }
    .rds-banner-text { flex: 1; min-width: 0; }
    .rds-banner-title {
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2px;
      font-size: 13px;
    }
    .rds-banner-subtitle {
      color: var(--text-secondary);
      font-size: 11.5px;
    }
    .rds-banner-dismiss {
      margin-left: auto;
      width: 24px;
      height: 24px;
      background: none;
      border: none;
      border-radius: 5px;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .rds-banner-dismiss:hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
    }
    .rds-banner-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .rds-banner-btn {
      padding: 5px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      border: none;
      transition: background 0.15s, opacity 0.15s;
    }
    .rds-banner-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .rds-banner-btn-primary {
      background: var(--accent-purple);
      color: #fff;
    }
    .rds-banner-btn-primary:hover:not(:disabled) {
      background: #7c3aed;
    }
    .rds-banner-btn-ghost {
      background: var(--bg-elevated);
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }
    .rds-banner-btn-ghost:hover:not(:disabled) {
      background: var(--bg-elevated);
      color: var(--text-primary);
      border-color: var(--border-hover, rgba(139,92,246,0.25));
    }
    .rds-banner-progress-wrap {
      background: var(--bg-elevated);
      border-radius: 4px;
      height: 5px;
      overflow: hidden;
    }
    .rds-banner-progress-bar {
      height: 100%;
      background: var(--accent-purple);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .rds-banner-progress-label {
      font-size: 11px;
      color: var(--text-muted);
      text-align: right;
    }
    .rds-banner-error { color: var(--accent-red); font-size: 11.5px; }

    /* ── Release notes modal ─────────────────────────────────────────── */
    .rds-release-notes-overlay {
      position: fixed;
      inset: 0;
      z-index: 100000;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .rds-release-notes-dialog {
      width: min(760px, 96vw);
      max-height: min(78vh, 760px);
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .rds-release-notes-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .rds-release-notes-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      flex: 1;
      min-width: 0;
    }
    .rds-release-notes-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
      margin-left: 8px;
    }
    /* Shared icon-button style — used for both the external-link and close buttons */
    .rds-release-notes-icon-btn,
    .rds-release-notes-close {
      width: 28px;
      height: 28px;
      border: none;
      background: var(--bg-elevated);
      color: var(--text-muted);
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      font-size: 18px;
      padding: 0;
      transition: background 0.15s, color 0.15s;
    }
    .rds-release-notes-icon-btn:hover,
    .rds-release-notes-close:hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
      border: 1px solid var(--border-hover, rgba(139,92,246,0.25));
    }
    .rds-release-notes-content {
      padding: 16px 20px;
      overflow: auto;
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.6;
      background: var(--bg-primary);
      flex: 1;
    }
    .rds-release-notes-markdown h1,
    .rds-release-notes-markdown h2,
    .rds-release-notes-markdown h3,
    .rds-release-notes-markdown h4,
    .rds-release-notes-markdown h5,
    .rds-release-notes-markdown h6 {
      color: var(--text-primary);
      margin: 14px 0 8px;
      line-height: 1.3;
      font-weight: 700;
    }
    .rds-release-notes-markdown h1 { font-size: 21px; }
    .rds-release-notes-markdown h2 { font-size: 18px; }
    .rds-release-notes-markdown h3 { font-size: 16px; }
    .rds-release-notes-markdown h4 { font-size: 14px; }
    .rds-release-notes-markdown h5,
    .rds-release-notes-markdown h6 { font-size: 13px; }
    .rds-release-notes-markdown p {
      margin: 8px 0;
      color: var(--text-secondary);
    }
    .rds-release-notes-markdown ul,
    .rds-release-notes-markdown ol {
      margin: 8px 0 10px 20px;
      padding: 0;
    }
    .rds-release-notes-markdown li {
      margin: 4px 0;
      color: var(--text-secondary);
    }
    .rds-release-notes-markdown blockquote {
      margin: 10px 0;
      padding: 6px 12px;
      border-left: 3px solid var(--accent-purple);
      background: var(--accent-purple-dim);
      border-radius: 0 6px 6px 0;
    }
    .rds-release-notes-markdown a {
      color: var(--accent-purple);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .rds-release-notes-markdown a:hover { opacity: 0.8; }
    .rds-release-notes-markdown code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      background: var(--bg-elevated);
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 11px;
      color: var(--text-primary);
    }
    .rds-release-notes-code {
      margin: 10px 0;
      padding: 10px 12px;
      white-space: pre-wrap;
      word-break: break-word;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-deep);
      color: var(--text-secondary);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      font-size: 11.5px;
      line-height: 1.45;
    }
    .rds-release-notes-code code {
      background: transparent;
      padding: 0;
      border-radius: 0;
      font-size: inherit;
      color: inherit;
    }
    .rds-release-notes-fallback {
      color: var(--text-muted);
      font-size: 11.5px;
    }
    .rds-release-notes-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 48px 0;
      color: var(--text-muted);
      font-size: 12px;
    }
    .rds-release-notes-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--border);
      border-top-color: var(--accent-purple);
      border-radius: 50%;
      animation: rds-release-notes-spin 0.7s linear infinite;
    }
    @keyframes rds-release-notes-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

function removeBanner(): void {
  // Select by class, not id: a rapid status change (e.g. checking → available)
  // can briefly leave a previous banner mid-fade, and we must tear down every
  // one so none is orphaned. The id is kept intact so the fading banner keeps
  // its `position: fixed` styling (dropping it would reflow the whole window).
  const banners = document.querySelectorAll(`.${BANNER_CLASS}`);
  banners.forEach((el) => {
    el.classList.add('rds-banner-out');
    setTimeout(() => el.remove(), 200);
  });
}

function renderBanner(status: UpdaterStatus): void {
  removeBanner();

  if (status.type === 'idle' || status.type === 'checking' || status.type === 'not-available') return;

  ensureBannerStyles();

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.classList.add(BANNER_CLASS);
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
          <div class="rds-banner-title">${S.modals.updateAvailableTitle(status.version)}</div>
          <div class="rds-banner-subtitle">${S.modals.newVersionReady}</div>
        </div>
        <button class="rds-banner-dismiss" aria-label="${S.modals.dismissUpdateNotification}">×</button>
      </div>
      <div class="rds-banner-actions">
        <button class="rds-banner-btn rds-banner-btn-ghost" id="rdsUpdateReleaseNotes">${S.modals.releaseNotes}</button>
        <button class="rds-banner-btn rds-banner-btn-ghost" id="rdsUpdateDismiss">${S.modals.later}</button>
        <button class="rds-banner-btn rds-banner-btn-primary" id="rdsUpdateDownload">${S.modals.download}</button>
      </div>`;

    document.body.appendChild(banner);
    // Warm the release-notes cache now so the modal opens populated when clicked.
    prefetchLatestReleaseInfo();

    banner.querySelector('.rds-banner-dismiss')?.addEventListener('click', removeBanner);
    banner.querySelector('#rdsUpdateReleaseNotes')?.addEventListener('click', () => {
      // Release Notes "expands" the notification into the modal: capture the banner's rect,
      // remove it instantly (so the dialog morphs out of it rather than sitting behind), then
      // grow the modal from that rect. Closing the modal doesn't restore the banner.
      const originRect = banner.getBoundingClientRect();
      banner.remove();
      showReleaseNotesModal({ originRect });
    });
    banner.querySelector('#rdsUpdateDismiss')?.addEventListener('click', removeBanner);
    banner.querySelector('#rdsUpdateDownload')?.addEventListener('click', () => {
      const btn = banner.querySelector('#rdsUpdateDownload') as HTMLButtonElement | null;
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
          <div class="rds-banner-title">${S.modals.downloadingUpdate}</div>
          <div class="rds-banner-subtitle">${S.modals.pleaseWaitDownloading}</div>
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
          <div class="rds-banner-title">${S.modals.updateReadyTitle(status.version)}</div>
          <div class="rds-banner-subtitle">${S.modals.installedOnRestart}</div>
        </div>
      </div>
      <div class="rds-banner-actions">
        <button class="rds-banner-btn rds-banner-btn-ghost" id="rdsUpdateLater">${S.modals.later}</button>
        <button class="rds-banner-btn rds-banner-btn-primary" id="rdsUpdateInstall">${S.modals.restartAndInstall}</button>
      </div>`;

    document.body.appendChild(banner);

    banner.querySelector('#rdsUpdateLater')?.addEventListener('click', removeBanner);
    banner.querySelector('#rdsUpdateInstall')?.addEventListener('click', () => {
      (window as any).rdsUpdater?.install().catch(() => undefined);
    });

  } else if (status.type === 'error') {
    const msg = status.message ?? S.modals.updateCheckFailed;
    if (status.needsManualDownload || isMissingReleaseMetadataError(msg)) {
      const bannerTitle = status.version ? S.modals.updateAvailableTitle(status.version) : S.modals.newUpdateAvailable;
      banner.innerHTML = `
        <div class="rds-banner-header">
          <div class="rds-banner-icon">${iconSvg}</div>
          <div class="rds-banner-text">
            <div class="rds-banner-title">${bannerTitle}</div>
            <div class="rds-banner-subtitle">${S.modals.pleaseDownloadLatest}</div>
          </div>
          <button class="rds-banner-dismiss" aria-label="${S.modals.dismiss}">×</button>
        </div>
        <div class="rds-banner-actions">
          <button class="rds-banner-btn rds-banner-btn-ghost" id="rdsUpdateReleaseNotes">${S.modals.releaseNotes}</button>
          <button class="rds-banner-btn rds-banner-btn-primary" id="rdsUpdateOpenLatest">${S.modals.download}</button>
        </div>`;

      document.body.appendChild(banner);
      // Warm the release-notes cache now so the modal opens populated when clicked.
      prefetchLatestReleaseInfo();
      banner.querySelector('.rds-banner-dismiss')?.addEventListener('click', removeBanner);
      banner.querySelector('#rdsUpdateReleaseNotes')?.addEventListener('click', () => {
        // Release Notes "expands" the notification into the modal: capture the banner's rect,
        // remove it instantly (so the dialog morphs out of it rather than sitting behind), then
        // grow the modal from that rect. Closing the modal doesn't restore the banner.
        const originRect = banner.getBoundingClientRect();
        banner.remove();
        showReleaseNotesModal({ originRect });
      });
      banner.querySelector('#rdsUpdateOpenLatest')?.addEventListener('click', () => {
        // Open the downloads (release) page and dismiss the notification.
        removeBanner();
        (window as any).roku?.openExternal?.(LATEST_RELEASE_URL)?.catch?.(() => undefined);
      });
      return;
    }

    banner.innerHTML = `
      <div class="rds-banner-header">
        <div class="rds-banner-icon">${iconSvg}</div>
        <div class="rds-banner-text">
          <div class="rds-banner-title">${S.modals.updateError}</div>
          <div class="rds-banner-error">${msg.length > 120 ? msg.slice(0, 120) + '…' : msg}</div>
        </div>
        <button class="rds-banner-dismiss" aria-label="${S.modals.dismiss}">×</button>
      </div>`;

    document.body.appendChild(banner);
    banner.querySelector('.rds-banner-dismiss')?.addEventListener('click', removeBanner);
  }
}

/** Last updater status the banner rendered from, so a live locale switch can re-render it. */
let lastStatus: UpdaterStatus | null = null;

export function mountUpdateNotification(): void {
  const updater = (window as any).rdsUpdater;
  if (!updater) return;

  // Wire live updates
  updater.onStatus((status: UpdaterStatus) => {
    lastStatus = status;
    // A user-initiated "Check for Updates" that found nothing surfaces a brief,
    // auto-dismissing confirmation toast (the automatic startup check stays silent).
    if (status?.type === 'not-available' && status.notifyNoUpdate) {
      showToast(S.modals.upToDate(status.version), 'success');
    }
    renderBanner(status);
  });

  // Recover status if the window reloaded and missed earlier broadcasts
  updater.getStatus().then((status: UpdaterStatus) => {
    lastStatus = status;
    if (status && status.type !== 'idle' && status.type !== 'checking' && status.type !== 'not-available') {
      renderBanner(status);
    }
  }).catch(() => undefined);

  // The banner + release-notes modal are IMPERATIVE surfaces built from S.modals.* (no
  // data-i18n attributes), so applyI18n(document) can't retranslate them on a live language
  // switch — they only re-render when a NEW updater status arrives. Register with the central
  // retranslate registry (fired by initLocaleLiveSwitch → runRetranslate) so they flip with the
  // app. Guard on being on-screen so we never resurrect a dismissed banner.
  registerRetranslate(() => {
    if (lastStatus && document.getElementById(BANNER_ID)) renderBanner(lastStatus);
    if (document.getElementById(RELEASE_NOTES_MODAL_ID)) showReleaseNotesModal();
  });
}

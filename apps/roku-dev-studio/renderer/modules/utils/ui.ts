// UI utility functions
import { escapeHtml, setSafeHTML } from './dom.js';
import { STATUS_MESSAGE_DURATION, TOAST_DISPLAY_DURATION } from './constants.js';
import { S } from '@shared/strings/index.js';

type StatusType = 'info' | 'success' | 'error' | 'warning';

type ToastDeviceContext = {
  name: string;
  /** Hardware photo URL when the panel is currently showing one, else null. */
  imgSrc: string | null;
  /** Sprite glyph id (`#icon-tv` / `#icon-stb`) — used when there's no photo, or it fails to load. */
  glyphHref: string;
};

/**
 * Reads the device name + icon a device panel's own header (`.device-panel-icon` /
 * `.panel-device-name-text`) is currently showing, so a toast's header matches it exactly —
 * hardware photo when known, else the generic tv/stb glyph — without duplicating that
 * resolution logic here. Returns null when `panel` isn't a device panel (or has no name yet),
 * so callers can pass a possibly-stale/-missing element and just get a headerless toast.
 */
function readDeviceToastContext(panel: Element | null | undefined): ToastDeviceContext | null {
  if (!panel) return null;
  const name = panel.querySelector('.panel-device-name-text')?.textContent?.trim();
  if (!name) return null;
  const iconRoot = panel.querySelector('.device-panel-icon');
  const img = iconRoot?.querySelector('img.device-panel-hardware-img');
  const imgSrc = img instanceof HTMLImageElement && img.src ? img.src : null;
  const use = iconRoot?.querySelector('svg use');
  const glyphHref = use?.getAttribute('href') || use?.getAttribute('xlink:href') || '#icon-tv';
  return { name, imgSrc, glyphHref };
}

/**
 * Show a status message in an element
 */
export function showStatusMessage(
  element: HTMLElement,
  message: string,
  type: StatusType | string = 'info',
  autoHide = true
): void {
  const safeType = ['info', 'success', 'error', 'warning'].includes(type) ? (type as StatusType) : 'info';
  setSafeHTML(
    element,
    `
    <div class="status-message ${safeType}">
      ${escapeHtml(String(message ?? ''))}
    </div>
  `
  );

  if (autoHide) {
    setTimeout(() => {
      element.innerHTML = '';
    }, STATUS_MESSAGE_DURATION);
  }
}

/**
 * Show a toast notification. Pass `onClick` to make it navigable (e.g. jump to the device
 * that raised it) — the toast gets a pointer cursor and dismisses itself when clicked.
 * Pass `devicePanel` (a `.device-panel` element) when the toast is *about* one specific device
 * — with several devices connected, a bare message is otherwise ambiguous about which one it
 * concerns. Adds a small header row with that device's icon + name, mirroring its panel header.
 * Pass `openFilePath` (the absolute path just written to disk) to add an "Open" button that
 * launches it with the OS default app via `window.roku.openFile` — a separate button from
 * `onClick`'s whole-toast click (some callers already use that for unrelated navigation).
 */
export function showToast(
  message: string,
  type: StatusType | string = 'info',
  onClick?: () => void,
  devicePanel?: Element | null,
  openFilePath?: string
): void {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(container);
  }

  // Cap concurrent toasts so a looping caller can't fill the screen — drop the oldest.
  const MAX_TOASTS = 4;
  while (container.children.length >= MAX_TOASTS) container.firstElementChild?.remove();

  const toast = document.createElement('div');
  // Distinct color per tone: warning gets its own amber so a destructive/agent action no
  // longer reads identically to a neutral "info" (both were purple before).
  const bgColor =
    type === 'success'
      ? 'var(--accent-green)'
      : type === 'error'
        ? 'var(--accent-red)'
        : type === 'warning'
          ? 'var(--accent-amber-strong, #b45309)'
          : 'var(--accent-purple)';

  toast.style.cssText = `
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    max-width: 380px;
    word-break: break-word;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `;

  const deviceCtx = readDeviceToastContext(devicePanel);
  if (deviceCtx) {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255,255,255,0.28);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      opacity: 0.9;
    `;
    const iconWrap = document.createElement('span');
    iconWrap.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 15px;
      height: 15px;
      flex: none;
    `;
    const glyphHtml = `<svg width="15" height="15"><use href="${escapeHtml(deviceCtx.glyphHref)}"/></svg>`;
    if (deviceCtx.imgSrc) {
      const img = document.createElement('img');
      img.src = deviceCtx.imgSrc;
      img.alt = '';
      img.decoding = 'async';
      img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; border-radius: 3px;';
      img.addEventListener('error', () => setSafeHTML(iconWrap, glyphHtml), { once: true });
      iconWrap.appendChild(img);
    } else {
      setSafeHTML(iconWrap, glyphHtml);
    }
    const nameEl = document.createElement('span');
    nameEl.textContent = deviceCtx.name;
    nameEl.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    header.appendChild(iconWrap);
    header.appendChild(nameEl);
    toast.appendChild(header);
  }
  // Plain row when there's no Open button (unchanged layout); a flex row with the message on the
  // left and the button pinned to the right when there is one.
  const row = openFilePath ? document.createElement('div') : toast;
  if (openFilePath) {
    row.style.cssText = 'display: flex; align-items: center; gap: 12px;';
    toast.appendChild(row);
  }
  const body = document.createElement('div');
  body.textContent = message;
  if (openFilePath) body.style.cssText = 'flex: 1; min-width: 0;';
  row.appendChild(body);
  const dismiss = (): void => {
    toast.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  };
  if (onClick) {
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', () => {
      try { onClick(); } catch { /* navigation is best-effort */ }
      dismiss();
    });
  }
  if (openFilePath) {
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.textContent = S.common.open;
    openBtn.style.cssText = `
      flex: none;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      color: white;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 5px;
      cursor: pointer;
    `;
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // don't also fire the whole-toast onClick above
      void (window.roku as unknown as { openFile?: (p: string) => Promise<unknown> })
        .openFile?.(openFilePath)
        .catch(() => {}); // best-effort — the OS shows its own error if the path is gone
      dismiss();
    });
    row.appendChild(openBtn);
  }
  container.appendChild(toast);

  setTimeout(dismiss, TOAST_DISPLAY_DURATION);
}

import type { DevicePanelRoot } from '../../types/device-panel-dom.js';

export type { DevicePanelRoot };

/** Minimal device fields used by `setupDevApp`. */
export interface DevAppDevice {
  serialNumber?: string;
  /** RCE only — the numeric device id and owning account name `rce-video.ts` needs to start the
   *  Janus video session (`attachRceVideo(videoEl, accountName, id, ...)`). */
  id?: number;
  accountName?: string;
  kind?: 'rce';
}

/** Unified local/remote API surface used by Dev App modules. */
export interface DevAppApi {
  isRemote: boolean;
  /** False when a remote device's server reports `capabilities.debugger === false` (see
   *  createApiAdapter in app.ts) — "Enable Debugger" disables itself since the
   *  server has no debug-protocol route to attach through. Always true/undefined locally. */
  debuggerSupported?: boolean;
  /** `'rce'` for a Roku Cloud Emulator device — the Screenshot card becomes a live video feed
   *  instead (design doc §8); undefined for local/LAN devices. */
  kind?: 'rce';
  /** Not implemented by the RCE adapter — its "screenshot" is a local video-frame grab
   *  (`captureFrame()` in rce-video.ts), not a device round trip. Always present locally/LAN. */
  screenshot?(
    password: string,
    options?: unknown
  ): Promise<{
    success?: boolean;
    message?: string;
    url?: string;
    tempFile?: string;
    error?: string;
  }>;
  /** Digest auth against device web UI (port 80); does not capture a screenshot. */
  verifyDevAuth(password: string): Promise<{
    success?: boolean;
    error?: string;
    authFailed?: boolean;
  }>;
  keypress(key: string): Promise<{ success?: boolean; error?: string }>;
  /** RCE-only "Dev mode" quick action — opens the on-device Developer Settings wizard. Not
   *  implemented by the local/LAN-relay adapter (no equivalent concept for a physical device). */
  devSettingsCombo?(): Promise<{ success?: boolean; error?: string }>;
  sideload(
    filePath: string,
    password: string,
    remoteDebug?: boolean,
    serial?: string
  ): Promise<{ success?: boolean; message?: string; error?: string; authFailed?: boolean }>;
  deleteSideload(password: string): Promise<{ success?: boolean; message?: string; error?: string; authFailed?: boolean }>;
  query(endpoint: string): Promise<{ success?: boolean; data?: string; error?: string }>;
  getIcon(appId: string): Promise<{ success?: boolean; dataUrl?: string; error?: string }>;
  launch(appId: string, params?: unknown): Promise<unknown>;
}

export interface PasswordAuthElements {
  passwordInput: HTMLInputElement;
  verifyPasswordBtn: HTMLButtonElement | null;
  authStatus: HTMLElement | null;
  rememberCheckbox: HTMLInputElement | null;
}

export interface SideloadElements {
  /** Drop zone / file picker control (may be a div, not a `<button>`). */
  selectFileBtn: HTMLElement;
  fileNameSpan: HTMLElement | null;
  filePathInput: HTMLInputElement | null;
  sideloadBtn: HTMLButtonElement;
  deleteBtn: HTMLButtonElement | null;
  statusDiv: HTMLElement;
  progressDiv: HTMLElement;
  progressText: HTMLElement | null;
  rememberCheckbox: HTMLInputElement | null;
  deleteStatusDiv: HTMLElement | null;
  dropZone: HTMLElement | null;
  selectedFileInfo: HTMLElement | null;
  clearFileBtn: HTMLButtonElement | null;
}

export interface SideloadedAppElements {
  sideloadedAppCard: HTMLElement;
  sideloadedAppDetails: HTMLElement;
  refreshSideloadedBtn: HTMLButtonElement | null;
  deleteBtn: HTMLButtonElement | null;
  launchSideloadBtn: HTMLButtonElement | null;
}

export interface ScreenshotElements {
  screenshotBtn: HTMLButtonElement | null;
  copyScreenshotBtn: HTMLButtonElement | null;
  saveScreenshotBtn: HTMLButtonElement | null;
  clearScreenshotBtn: HTMLButtonElement | null;
  screenshotStatus: HTMLElement;
  screenshotImage: HTMLImageElement;
  screenshotPlaceholder: HTMLElement | null;
  autoScreenshotCheckbox: HTMLInputElement | null;
  /** RCE only — the live video feed occupying the same card slot the `<img>` uses for
   *  local/LAN devices. Capture grabs the current frame instead of calling `api.screenshot`. */
  videoElement?: HTMLVideoElement | null;
  /** The card's screenshot-history/gallery button — used as the landing target for the
   *  post-capture fly animation (see screenshot-fly-animation.ts), not just the gallery-open click
   *  handler (wired separately in index.ts). */
  galleryBtn?: HTMLButtonElement | null;
}

/** One screenshot captured during the current session — originally RCE-only (design doc §8's
 *  session gallery), now populated for physical/LAN devices too so every device kind gets a
 *  capture history. `url` is a `file://` reference once `tempFile` is set (the common case — see
 *  screenshots.ts's `displayUrlFor`), so this array never holds the full base64 payload resident
 *  in memory for the tab's whole lifetime; only falls back to a raw `data:` URL when persisting to
 *  disk failed. `tempFile`'s own lifecycle is owned by this array, not the metadata alone: deleted
 *  on `removeSessionScreenshot`/`removeAllSessionScreenshots` and on panel teardown/disconnect. */
export interface RceSessionScreenshot {
  id: string;
  url: string;
  tempFile?: string;
  capturedAt: number;
}

export interface InnertabSwitchDetail {
  tab: string;
}

export interface DevPasswordVerifiedDetail {
  password: string;
  remember?: boolean;
}

export { errMessage } from '@shared/platform/err-util.js';

/** Single source for the `kind: 'local' | 'remote' | 'rce'` discriminant used across saved
 *  locations, connected-device records, and `DevAppApi`/`DevAppDevice` (which only ever set
 *  `'rce'` or leave `kind` undefined) — replaces re-deriving `=== 'rce'` etc. per call site. */
export const isLocalDevice = (x?: { kind?: string } | null): boolean => x?.kind === 'local';
export const isRemoteDevice = (x?: { kind?: string } | null): boolean => x?.kind === 'remote';
export const isRceDevice = (x?: { kind?: string } | null): boolean => x?.kind === 'rce';

import type { DevicePanelRoot } from '../../types/device-panel-dom.js';

export type { DevicePanelRoot };

/** Minimal device fields used by `setupDevApp`. */
export interface DevAppDevice {
  serialNumber?: string;
}

/** Unified local/remote API surface used by Dev App modules. */
export interface DevAppApi {
  isRemote: boolean;
  /** False when a remote device's server reports `capabilities.debugger === false` (see
   *  createApiAdapter in app.ts) — "Sideload with Debugging" disables itself since the
   *  server has no debug-protocol route to attach through. Always true/undefined locally. */
  debuggerSupported?: boolean;
  screenshot(
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
}

export interface InnertabSwitchDetail {
  tab: string;
}

export interface DevPasswordVerifiedDetail {
  password: string;
  remember?: boolean;
}

export { errMessage } from '@shared/platform/err-util.js';

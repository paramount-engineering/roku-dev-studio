/**
 * Shared IPC invoke payloads and small renderer↔main contracts.
 * Used by main process handlers and preload typings (imports type-only).
 */

/** --- Local Roku --- */
export interface IpPayload {
  ip: string;
}
export interface IpKeyPayload {
  ip: string;
  key: string;
}
export interface IpAppParamsPayload {
  ip: string;
  appId: string;
  params?: unknown;
}
export interface IpEndpointPayload {
  ip: string;
  endpoint: string;
}
export interface IpTextPayload {
  ip: string;
  text: string;
}
export interface IpDeeplinkPayload {
  ip: string;
  appId: string;
  contentId: string;
  mediaType?: string;
}
export interface IpAppIdPayload {
  ip: string;
  appId: string;
}
export interface IpPasswordScreenshotPayload {
  ip: string;
  password?: string;
  waitAfterTriggerMs?: number;
}
export interface IpFilePasswordPayload {
  ip: string;
  filePath: string;
  password?: string;
}
export interface SideloadFilePathPayload {
  filePath: string;
}
export interface IpPasswordPayload {
  ip: string;
  password?: string;
}
export interface SaveScreenshotPayload {
  tempFile: string;
  dataUrl: string;
}
export interface IpPortPayload {
  ip: string;
  port: number;
}
export interface RaleCommandPayload {
  connectionId: string;
  command: string;
  args?: unknown;
}
export interface ConnectionIdPayload {
  connectionId: string;
}
export interface IpCommandPayload {
  ip: string;
  command: string;
}

/** --- Remote (relay) --- */
export interface ServerUrlPayload {
  serverUrl: string;
}
export interface RemoteDevicePayload {
  serverUrl: string;
  ip: string;
}
export interface RemoteKeypressPayload extends RemoteDevicePayload {
  key: string;
}
export interface RemoteLaunchPayload extends RemoteDevicePayload {
  appId: string;
  params?: unknown;
}
export interface RemoteEndpointPayload extends RemoteDevicePayload {
  endpoint: string;
}
export interface RemoteTextPayload extends RemoteDevicePayload {
  text: string;
}
export interface RemoteDeeplinkPayload extends RemoteDevicePayload {
  appId: string;
  contentId: string;
  mediaType?: string;
}
export interface RemoteAppIdPayload extends RemoteDevicePayload {
  appId: string;
}
export interface RemoteScreenshotPayload extends RemoteDevicePayload {
  password?: string;
  waitAfterTriggerMs?: number;
}
export interface RemoteVerifyDevAuthPayload extends RemoteDevicePayload {
  password?: string;
}
export interface RemoteSideloadPayload extends RemoteDevicePayload {
  filePath: string;
  password?: string;
}
export interface RemoteRaleWakePayload extends RemoteDevicePayload {
  port: number;
}
export interface RemoteRaleConnectPayload extends RemoteRaleWakePayload {}
export interface RemoteRaleCommandPayload {
  serverUrl: string;
  connectionId: string;
  command: string;
  args?: unknown;
}
export interface RemoteRaleDisconnectPayload {
  serverUrl: string;
  connectionId: string;
}
export interface SaveConsoleLogsPayload {
  content: string;
}
export interface ActionScriptWriteFilePayload {
  filePath?: string;
  folderPath?: string;
  filename?: string;
  content?: string;
  encoding?: string;
}
export interface ReadFilePayload {
  filePath: string;
}
export interface ReadFileOrUrlPayload {
  filePathOrUrl: string;
}
export interface SaveResultsPdfPayload {
  payload: unknown;
}

/** Viewport-relative rect in CSS / layout pixels (same as `getBoundingClientRect()`). */
export interface CaptureViewRectPayload {
  x: number;
  y: number;
  width: number;
  height: number;
  /** @deprecated Ignored; Electron scales capture output internally from the display DPR. */
  scale?: number;
}

/** Context menu item (loose; passed to Menu.buildFromTemplate) */
export type ContextMenuItemLoose = Record<string, unknown>;

export type GetDeviceInfoFn = (ip: string) => Promise<unknown> | unknown;
export type GetDeviceIdFn = (device: unknown) => string;
export type SafeSendFn = (channel: string, data: unknown) => boolean;

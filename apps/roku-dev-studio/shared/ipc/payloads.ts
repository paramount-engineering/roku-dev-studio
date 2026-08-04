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
  /** Extra key/value query params beyond contentId/mediaType, for channels expecting additional launch args. */
  params?: Record<string, string>;
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
  params?: Record<string, string>;
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
export interface SaveTextFilePayload {
  content: string;
  /** Suggested file name shown in the save dialog (e.g. `ecp-response.xml`). */
  defaultName?: string;
  /** Save dialog title (e.g. `Save Response`). */
  dialogTitle?: string;
}
export interface SaveBinaryFilePayload {
  /** Base64-encoded file bytes (no data-URL prefix). */
  base64: string;
  defaultName?: string;
  dialogTitle?: string;
}
export interface CopyImagePayload {
  /** `data:<mime>;base64,<data>` URL for the image to place on the clipboard. */
  dataUrl: string;
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

// ============================================
// Static Channel Analysis (sca-cmd wrapper)
// ============================================

export type ScaToolStatusType = 'idle' | 'checking' | 'downloading' | 'ready' | 'error';

export type ScaErrorCode =
  | 'network-unreachable'
  | 'cdn-non-200'
  | 'disk-full'
  | 'permission-denied'
  | 'unexpected-archive-layout'
  | 'java-not-found'
  | 'java-check-failed'
  | 'java-incompatible'
  | 'invalid-input-path'
  | 'invalid-input-package'
  | 'spawn-failed'
  | 'sca-tool-crashed'
  | 'timeout'
  | 'cancelled'
  | 'report-missing'
  | 'report-malformed';

export interface ScaError {
  code: ScaErrorCode;
  message: string;
  httpStatus?: number;
}

/** Status of the locally-cached `sca-cmd` tool — pushed on `IPC.StaticAnalysisToolStatus` and
 *  returned by `IPC.StaticAnalysisEnsureTool`. */
export interface ScaToolStatus {
  type: ScaToolStatusType;
  /** Set once `type === 'ready'`. */
  etag?: string;
  /** True when this cycle actually (re)downloaded a changed copy, vs. reusing the cache as-is. */
  updated?: boolean;
  error?: ScaError;
}

export interface JavaStatus {
  available: boolean;
  versionString?: string;
  majorVersion?: number;
  error?: { code: 'java-not-found' | 'java-check-failed'; message: string };
}

export const SCA_SEVERITIES = ['info', 'warning', 'error'] as const;
export type ScaSeverity = (typeof SCA_SEVERITIES)[number];

export const SCA_CATEGORIES = [
  'uncategorized',
  'deprecated_components',
  'deprecated_apis',
  'manifest',
  'raf',
  'red',
  'package'
] as const;
export type ScaCategory = (typeof SCA_CATEGORIES)[number];

export interface StaticAnalysisRunPayload {
  inputPath: string;
  severity?: ScaSeverity;
  /** Omit or pass every category to mean "no filter" (all categories). */
  categories?: ScaCategory[];
}

export interface StaticAnalysisCancelRunPayload {
  runId: string;
}

export interface StaticAnalysisProgressPayload {
  runId: string;
  stream: 'stdout' | 'stderr';
  text: string;
}

/** Terminal outcome of a run, pushed on `IPC.StaticAnalysisRunResult`. */
export interface StaticAnalysisRunResult {
  runId: string;
  /** Parsed `SCA_Report.json` contents, when found and valid — shape is NOT documented by Roku,
   *  so the renderer must read this defensively. */
  report?: unknown;
  reportPath?: string;
  /** Raw process output, always populated so the UI has something to show even without a report. */
  rawStdout?: string;
  rawStderr?: string;
  exitCode?: number | null;
  signal?: string | null;
  timedOut?: boolean;
  cancelled?: boolean;
  error?: ScaError;
}

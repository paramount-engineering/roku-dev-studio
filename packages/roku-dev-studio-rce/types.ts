/**
 * Types for the RCE Core API (api.rce.roku.com), confirmed against the live OpenAPI 3.1 spec
 * (`GET https://api.rce.roku.com/api/v1/openapi.json`, v4.3.0, checked 2026-09-11) — not the
 * narrative API guide's prose, which conflates a couple of these (see DeviceStatus below).
 *
 * Wire format is snake_case; everything here is camelCase. `fromApiDevice`/`fromApiInstanceInfo`
 * in rce-management-client.ts do the conversion in one place.
 */

/** Top-level `device.status` — NOT the same enum as a run's history status, see {@link DeviceInstanceStatus}. */
export type DeviceStatus = 'shutdown' | 'pending' | 'running';

/** Per-run status, used by `GET /devices/{id}/runs` (history) — richer than {@link DeviceStatus}. */
export type DeviceInstanceStatus =
  | 'created'
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'crashed'
  | 'unknown';

/** What a device *can be*. `streambar` exists but isn't in {@link CreatableDeviceType} — can't be created via POST /devices. */
export type DeviceType = 'tv' | 'stb' | 'streambar';

export type CreatableDeviceType = 'tv' | 'stb';

export interface IceServer {
  urls: string[];
  username?: string | null;
  credential?: string | null;
}

/** `device.running_device` — only present while the device is running. */
export interface DeviceInstanceInfo {
  id: number;
  creatorId: string;
  createdAt: string;
  startedAt: string | null;
  snapshotId: number;
  snapshotName: string;
  /** Janus WebRTC signaling — role of `janusPin` in the JSON-RPC exchange is unconfirmed, see design doc §7. */
  janusId: number | null;
  janusPin: string | null;
  janusToken: string | null;
  janusWebsocketUrl: string | null;
  janusIceServers: IceServer[] | null;
  /** Host+path prefix for the Device API, e.g. `device.rce.roku.com/instance/<uuid>`. The OpenAPI
   *  schema describes this field as having no protocol prefix (since it serves both ws:// and
   *  https://) — **confirmed live 2026-09-11 that the real value DOES include `https://`**. Always
   *  go through `normalizeInstanceApiUrl` (rce-ecp.ts) before building a URL from this field. */
  instanceApiUrl: string | null;
  instanceUuid: string;
  firmwareVersionId: string;
  maxRuntime: number;
}

export interface RceDevice {
  id: number;
  deviceType: DeviceType;
  name: string;
  accountName: string | null;
  lastSnapshotName: string | null;
  snapshots: number[];
  status: DeviceStatus;
  createdAt: string;
  note: string | null;
  /** `serial_number` on the wire — the narrative guide's JSON examples show `esn` instead, likely a stale field name. */
  serialNumber: string | null;
  properties: Record<string, unknown> | null;
  lastSnapshotId: number | null;
  firmwareVersionId: string | null;
  runningDevice: DeviceInstanceInfo | null;
  /** Not part of the Core API's device shape — best-effort enrichment `RceGetDevice` (main
   *  process) merges in from a live `query/device-info` ECP call when the device is running, so
   *  the renderer's ECP-mode warning banner (shared with physical/LAN devices) can reflect reality
   *  instead of always defaulting to "Disabled". Absent when the device isn't running or the
   *  enrichment call failed — treat as unknown, not `false`/`'Disabled'`, in that case. */
  developerEnabled?: boolean;
  ecpSettingMode?: string;
  /** Same best-effort `query/device-info` enrichment as the two fields above — the real,
   *  ECP-reported `is-tv` value (authoritative; the same field physical devices use), preferred
   *  over the Core API's coarser `deviceType === 'tv'` whenever it's available. Absent under the
   *  same conditions `developerEnabled`/`ecpSettingMode` are. */
  isTv?: boolean;
}

export interface RceSnapshot {
  id: number;
  createdAt: string;
  parentId: number | null;
  name: string;
  note: string | null;
  /** `firmware_version_display_name` on the wire — the firmware used for this snapshot's rootfs image. */
  firmwareVersionDisplayName: string | null;
  firmwareVersionId: string | null;
  properties: Record<string, unknown> | null;
  startedAt: string | null;
  children: number[];
  ready: boolean;
  live: boolean;
  base: boolean;
}

export interface RceFirmwareVersion {
  firmwareVersionId: string;
  deviceType: DeviceType;
  displayName: string;
}

/** Message pushed by `GET /devices/{id}/ws` on connect and on every state change. */
export interface DeviceStateMessage {
  stateVersion: number;
  device: RceDevice;
}

/** `GET /api/v1/user/me`'s `organisation` object — account-level device/snapshot/runtime quota. */
export interface RceOrganisationInfo {
  id: number;
  idpId: string;
  name: string;
  maxDevices: number;
  maxSnapshots: number;
  /** Seconds. */
  maxProjectRuntime: number;
  currentDevices: { stb: number; tv: number };
}

export interface RceUserInfo {
  id: string;
  username: string;
  fullName: string;
  email: string;
  organisation: RceOrganisationInfo;
}

/** One bucket from `GET /usage/user` — billable instance-minutes in `[start, stop)`. */
export interface RceUsageBucket {
  start: string;
  stop: string;
  minutes: number;
}

export interface RceUsage {
  start: string;
  end: string;
  interval: string;
  buckets: RceUsageBucket[];
}

export type RceResult<T> =
  | ({ success: true } & T)
  | { success: false; error: string; statusCode?: number; rawBody?: unknown };

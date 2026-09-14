/**
 * RCE Core API client (`https://api.rce.roku.com/api/v1`) — account/device/snapshot management.
 * Confirmed against the live OpenAPI spec (2026-09-11), not just the narrative guide — see types.ts.
 *
 * Uses the platform's global `fetch` rather than hand-rolled `http.request`: already the pattern
 * for external HTTPS calls elsewhere in this app (`main/auto-updater.ts`,
 * `main/static-analysis/sca-tool-manager.ts`), and this client has no LAN-IP transport to share
 * with `roku-dev-studio-api/ecp.ts`, so there's nothing to extend there — see design doc §1.
 */

import { errorMessage } from 'roku-dev-studio-platform';
import { describeFetchError } from './rce-ecp';
import type {
  DeviceInstanceInfo,
  DeviceStateMessage,
  IceServer,
  RceDevice,
  RceFirmwareVersion,
  RceOrganisationInfo,
  RceResult,
  RceSnapshot,
  RceUsage,
  RceUsageBucket,
  RceUserInfo
} from './types';

const DEFAULT_BASE_URL = 'https://api.rce.roku.com/api/v1';

export interface ListDevicesOptions {
  items?: number;
  page?: number;
  order?: 'asc' | 'desc';
}

export interface StartDeviceOptions {
  snapshotId: number;
  firmwareVersionId: string;
  maxRuntime: number;
}

export interface UsageQueryOptions {
  /** ISO 8601 with timezone (e.g. `date.toISOString()`), inclusive. */
  start: string;
  /** ISO 8601 with timezone, exclusive. */
  end: string;
  interval: '1h' | '24h' | '1w' | '1mo';
}

export interface WatchDeviceStateHandle {
  close(): void;
}

export interface WatchDeviceStateCallbacks {
  onMessage(message: DeviceStateMessage): void;
  onError?(error: Error): void;
  onClose?(): void;
}

function toIceServer(raw: unknown): IceServer {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    urls: Array.isArray(r.urls) ? (r.urls as string[]) : [],
    username: (r.username as string | null | undefined) ?? null,
    credential: (r.credential as string | null | undefined) ?? null
  };
}

function fromApiInstanceInfo(raw: Record<string, unknown>): DeviceInstanceInfo {
  return {
    id: raw.id as number,
    creatorId: raw.creator_id as string,
    createdAt: raw.created_at as string,
    startedAt: (raw.started_at as string | null) ?? null,
    snapshotId: raw.snapshot_id as number,
    snapshotName: raw.snapshot_name as string,
    janusId: (raw.janus_id as number | null) ?? null,
    janusPin: (raw.janus_pin as string | null) ?? null,
    janusToken: (raw.janus_token as string | null) ?? null,
    janusWebsocketUrl: (raw.janus_websocket_url as string | null) ?? null,
    janusIceServers: Array.isArray(raw.janus_ice_servers)
      ? (raw.janus_ice_servers as unknown[]).map(toIceServer)
      : null,
    instanceApiUrl: (raw.instance_api_url as string | null) ?? null,
    instanceUuid: raw.instance_uuid as string,
    firmwareVersionId: raw.firmware_version_id as string,
    maxRuntime: raw.max_runtime as number
  };
}

function fromApiDevice(raw: Record<string, unknown>): RceDevice {
  return {
    id: raw.id as number,
    deviceType: raw.device_type as RceDevice['deviceType'],
    name: raw.name as string,
    accountName: (raw.account_name as string | null) ?? null,
    lastSnapshotName: (raw.last_snapshot_name as string | null) ?? null,
    snapshots: Array.isArray(raw.snapshots) ? (raw.snapshots as number[]) : [],
    status: raw.status as RceDevice['status'],
    createdAt: raw.created_at as string,
    note: (raw.note as string | null) ?? null,
    serialNumber: (raw.serial_number as string | null) ?? null,
    properties: (raw.properties as Record<string, unknown> | null) ?? null,
    lastSnapshotId: (raw.last_snapshot_id as number | null) ?? null,
    firmwareVersionId: (raw.firmware_version_id as string | null) ?? null,
    runningDevice: raw.running_device ? fromApiInstanceInfo(raw.running_device as Record<string, unknown>) : null
  };
}

function fromApiSnapshot(raw: Record<string, unknown>): RceSnapshot {
  return {
    id: raw.id as number,
    createdAt: raw.created_at as string,
    parentId: (raw.parent_id as number | null) ?? null,
    name: raw.name as string,
    note: (raw.note as string | null) ?? null,
    firmwareVersionDisplayName: (raw.firmware_version_display_name as string | null) ?? null,
    firmwareVersionId: (raw.firmware_version_id as string | null) ?? null,
    properties: (raw.properties as Record<string, unknown> | null) ?? null,
    startedAt: (raw.started_at as string | null) ?? null,
    children: Array.isArray(raw.children) ? (raw.children as number[]) : [],
    ready: !!raw.ready,
    live: !!raw.live,
    base: !!raw.base
  };
}

function fromApiUsageBucket(raw: Record<string, unknown>): RceUsageBucket {
  return {
    start: raw.start as string,
    stop: raw.stop as string,
    minutes: raw.value as number
  };
}

function fromApiOrganisation(raw: Record<string, unknown>): RceOrganisationInfo {
  const currentDevices = (raw.current_devices as Record<string, unknown>) ?? {};
  return {
    id: raw.id as number,
    idpId: raw.idp_id as string,
    name: raw.name as string,
    maxDevices: raw.max_devices as number,
    maxSnapshots: raw.max_snapshots as number,
    maxProjectRuntime: raw.max_project_runtime as number,
    currentDevices: {
      stb: (currentDevices.stb as number) ?? 0,
      tv: (currentDevices.tv as number) ?? 0
    }
  };
}

function fromApiUserInfo(raw: Record<string, unknown>): RceUserInfo {
  return {
    id: raw.id as string,
    username: raw.username as string,
    fullName: raw.full_name as string,
    email: raw.email as string,
    organisation: fromApiOrganisation((raw.organisation as Record<string, unknown>) ?? {})
  };
}

function fromApiFirmwareVersion(raw: Record<string, unknown>): RceFirmwareVersion {
  return {
    firmwareVersionId: raw.firmware_version_id as string,
    deviceType: raw.device_type as RceFirmwareVersion['deviceType'],
    displayName: raw.display_name as string
  };
}

/** Maps the Core API's documented response codes to a user-facing message. */
function errorForStatus(status: number, body: unknown): string {
  const detail = body && typeof body === 'object' ? (body as { error?: string; detail?: unknown }) : null;
  const fromBody = detail?.error || (typeof detail?.detail === 'string' ? detail.detail : undefined);
  if (fromBody) return fromBody;
  switch (status) {
    case 400:
      return 'Bad request — required fields missing or malformed.';
    case 401:
      return 'Unauthorized — invalid or missing RCE token.';
    case 403:
      return 'Forbidden — this account lacks permission for that device/action.';
    case 404:
      return 'Not found.';
    case 409:
      return 'Conflict — the device is already in that state or the resource already exists.';
    case 422:
      return 'Unprocessable — bad ID/timestamp/format.';
    default:
      return `RCE API error (HTTP ${status}).`;
  }
}

export class RceManagementClient {
  constructor(
    private readonly token: string,
    private readonly baseUrl: string = DEFAULT_BASE_URL
  ) {}

  /** Returns the raw parsed JSON body — a plain field, never spread, so an array response (the
   *  list endpoints) can't collide with `{success}` by spreading into numeric-keyed junk. */
  private async requestRaw(path: string, init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}): Promise<{ success: true; data: unknown } | { success: false; error: string; statusCode?: number; rawBody?: unknown }> {
    const url = new URL(path, this.baseUrl + '/');
    if (init.query) {
      for (const [key, value] of Object.entries(init.query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    try {
      const res = await fetch(url, {
        method: init.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined
      });
      const text = await res.text();
      const parsed = text ? JSON.parse(text) : null;
      if (!res.ok) {
        // `rawBody` carries whatever the API actually returned beyond the flattened `error`
        // string (e.g. a structured `detail` object with per-field validation reasons) —
        // `errorForStatus` only surfaces `body.error`/a string `body.detail`, so a caller that
        // needs the full picture (see `RceStartDevice`'s failure logging) has it available.
        return { success: false, error: errorForStatus(res.status, parsed), statusCode: res.status, rawBody: parsed };
      }
      return { success: true, data: parsed };
    } catch (error: unknown) {
      return { success: false, error: describeFetchError(error) };
    }
  }

  /** Unwraps a list response that may be a raw JSON array or `{items: [...]}` — the narrative
   *  guide's examples confirm raw arrays for snapshots/firmwareVersions; `GET /devices` (only in
   *  the live OpenAPI spec, no worked example seen) is assumed the same until verified live. */
  private static asList(data: unknown): Record<string, unknown>[] {
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    const items = (data as { items?: unknown[] } | null)?.items;
    return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
  }

  async getUserInfo(): Promise<RceResult<{ user: RceUserInfo }>> {
    const result = await this.requestRaw('user/me');
    if (!result.success) return result;
    return { success: true, user: fromApiUserInfo((result.data ?? {}) as Record<string, unknown>) };
  }

  /** `GET /usage/user` — the calling user's own billable instance-minutes, bucketed. */
  async getUserUsage(opts: UsageQueryOptions): Promise<RceResult<{ usage: RceUsage }>> {
    const result = await this.requestRaw('usage/user', { query: { start: opts.start, end: opts.end, interval: opts.interval } });
    if (!result.success) return result;
    const data = (result.data ?? {}) as Record<string, unknown>;
    return {
      success: true,
      usage: {
        start: data.start as string,
        end: data.end as string,
        interval: data.interval as string,
        buckets: Array.isArray(data.buckets) ? (data.buckets as Record<string, unknown>[]).map(fromApiUsageBucket) : []
      }
    };
  }

  async listDevices(opts: ListDevicesOptions = {}): Promise<RceResult<{ devices: RceDevice[] }>> {
    const result = await this.requestRaw('devices', {
      query: { items: opts.items, page: opts.page, order: opts.order }
    });
    if (!result.success) return result;
    return { success: true, devices: RceManagementClient.asList(result.data).map(fromApiDevice) };
  }

  async getDevice(deviceId: number): Promise<RceResult<{ device: RceDevice }>> {
    const result = await this.requestRaw(`devices/${deviceId}`);
    if (!result.success) return result;
    return { success: true, device: fromApiDevice(result.data as Record<string, unknown>) };
  }

  async listSnapshots(deviceId: number): Promise<RceResult<{ snapshots: RceSnapshot[] }>> {
    const result = await this.requestRaw(`devices/${deviceId}/snapshots`);
    if (!result.success) return result;
    return { success: true, snapshots: RceManagementClient.asList(result.data).map(fromApiSnapshot) };
  }

  async listFirmwareVersions(): Promise<RceResult<{ firmwareVersions: RceFirmwareVersion[] }>> {
    const result = await this.requestRaw('firmwareVersions');
    if (!result.success) return result;
    return { success: true, firmwareVersions: RceManagementClient.asList(result.data).map(fromApiFirmwareVersion) };
  }

  async startDevice(deviceId: number, opts: StartDeviceOptions): Promise<RceResult<{ device: RceDevice }>> {
    const result = await this.requestRaw(`devices/${deviceId}/start`, {
      method: 'POST',
      body: {
        snapshot_id: opts.snapshotId,
        firmware_version_id: opts.firmwareVersionId,
        max_runtime: opts.maxRuntime
      }
    });
    if (!result.success) return result;
    return { success: true, device: fromApiDevice(result.data as Record<string, unknown>) };
  }

  async stopDevice(deviceId: number): Promise<RceResult<{ device: RceDevice }>> {
    const result = await this.requestRaw(`devices/${deviceId}/stop`, { method: 'POST' });
    if (!result.success) return result;
    return { success: true, device: fromApiDevice(result.data as Record<string, unknown>) };
  }

  /**
   * `GET /devices/{id}/ws` — pushes the device's current state on connect and again on every
   * change. Primary status mechanism per design doc §5 (replaces the 15s-poll pattern the
   * reference implementations use). Auth header on the WS handshake is an unverified assumption
   * (same Bearer scheme as the rest of the Core API) — the OpenAPI spec doesn't document
   * WebSocket auth separately; confirm against a live account.
   */
  watchDeviceState(deviceId: number, callbacks: WatchDeviceStateCallbacks): WatchDeviceStateHandle {
    const WebSocketCtor = require('ws') as typeof import('ws');
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + `/devices/${deviceId}/ws`;
    const socket = new WebSocketCtor(wsUrl, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    socket.on('message', (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString('utf8'));
        callbacks.onMessage({
          stateVersion: parsed.state_version,
          device: fromApiDevice(parsed.device as Record<string, unknown>)
        });
      } catch (error: unknown) {
        callbacks.onError?.(error instanceof Error ? error : new Error(errorMessage(error)));
      }
    });
    socket.on('error', (error: Error) => callbacks.onError?.(error));
    socket.on('close', () => callbacks.onClose?.());
    return {
      close: () => socket.close()
    };
  }
}

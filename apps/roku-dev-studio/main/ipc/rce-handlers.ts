/**
 * Roku Cloud Emulator (RCE) IPC handlers — Phase 1 slice: add/validate an account, list its
 * devices, start/stop a device. Sideload, console, and video land with later phases — see
 * `.discussion-docs/roku-cloud-emulator-support-design.md`.
 *
 * Account tokens live in the existing dev-password secret store (`../secret-store`), namespaced
 * by a key prefix — the same idiom Sideload Relay already uses for its own non-dev-password
 * secrets (`sideload-relay-target:<id>`), not a parallel store. Never send a token back to the
 * renderer once stored; `RceListAccounts` returns names only.
 */

import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type { DebugTelnetConnectResult } from '../../shared/ipc/debug-telnet-connection-id';
import { S } from '../../shared/strings/index';
import { singleFlight } from 'roku-dev-studio-platform/async-patterns';
import { RceManagementClient, RceEcpClient, connectRceSocket, rceSideload, rceDeleteSideload, rceVerifyDevAuth, rceCaptureScreenshot } from 'roku-dev-studio-rce';
import type { RceDevice, RceSocket, WatchDeviceStateHandle } from 'roku-dev-studio-rce';
import { resolveSideloadPackageFile, computeSideloadDebugFlags } from './dev-app-handlers';
import { notifyDebuggerReattach } from './debugger-handlers';
import {
  getRceAccountNames as getAccountNames,
  getRceAccountToken as getAccountToken,
  getRceAccountUserId,
  findRceAccountByToken,
  findRceAccountByUserId,
  setRceAccount,
  setRceAccountUserId,
  deleteRceAccount
} from '../rce-account-store';
import { recordRceDeviceSeen } from '../rce-device-registry';
import { systemTelnetConnectionId } from './telnet-handlers';
import { createHeldPool, type SystemTelnetConnectResult, type SystemTelnetHolder } from './held-console-pool';
import { broadcastFiddleTerminalData } from '../fiddle-window';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { errorMessage } = require('roku-dev-studio-platform');
const { parseDeviceInfo, normalizeEcpSettingMode, writeRokuTelnetLine, raleRegisterSocket } = require('roku-dev-studio-api');
const { mainWarn } = require('../log');

/** Roku's telnet system console (plugins/free/remove_plugin) — same port physical devices use,
 *  tunneled here through the Device API's ports-bridge instead of a raw LAN `net.Socket`. */
const RCE_TELNET_SYSTEM_PORT = 8080;
/** BrightScript debug console (print statements) — same port physical devices use. Confirmed live
 *  2026-09-12: the ports-bridge WS route opens and returns a real device-level response
 *  (`"Console connection is already in use."` when another client already holds it — Roku's 8085
 *  is single-client, same constraint `telnet-handlers.ts` already documents for physical devices). */
const RCE_DEBUG_TELNET_PORT = 8085;
/** App Connector / TrackerTask (RALE) — same port physical devices use. Confirmed live
 *  2026-09-12: wake (`POST .../input?rale=true&port=49200` through the ECP proxy) and the
 *  ports-bridge tunnel both round-trip a real RALE handshake (`raleversion`/`sessionid`). Unlike
 *  ports 8080/8085, this tunnel is binary-only — see `RceRaleWake`/`RceRaleConnect` below and the
 *  `roku-dev-studio-api`'s `rale-direct.ts` `RaleSocketLike` comment for why no extra code is
 *  needed to satisfy that. */
const RCE_RALE_PORT = 49200;

/** Matches both reference implementations' default (roku-deploy, vscode-brightscript-language) —
 *  used when the "Run device" modal's options aren't given an explicit runtime (plain "Start"
 *  click) or when the modal itself is left at its own default. */
const RCE_DEFAULT_MAX_RUNTIME_SECONDS = 3600;

interface StartDeviceHint {
  deviceType?: string | null;
}

/**
 * A snapshot's rootfs is only validated against the specific firmware it was captured under
 * (`RceSnapshot.firmwareVersionId`, non-null on the wire for any real snapshot) — pairing it with
 * an unrelated firmware ID (previously: "whichever firmware happens to match the device type")
 * fails `POST /devices/{id}/start`'s own build-validation check server-side ("Build validation
 * failed"), even though every individual field we sent looked well-formed. Falls back to
 * `listFirmwareVersions()`'s device-type match only for the rare snapshot with no recorded
 * firmware (`firmwareVersionId: null` — very old snapshots per the type's own doc comment).
 */
async function firmwareIdForSnapshot(
  client: RceManagementClient,
  snapshot: { firmwareVersionId: string | null },
  deviceType: string | null | undefined
): Promise<string | null> {
  if (snapshot.firmwareVersionId) return snapshot.firmwareVersionId;
  const firmwareResult = await client.listFirmwareVersions();
  const firmwareVersions = firmwareResult.success ? firmwareResult.firmwareVersions : [];
  const firmware = firmwareVersions.find((f) => f.deviceType === deviceType) ?? firmwareVersions[0];
  return firmware?.firmwareVersionId ?? null;
}

/**
 * Snapshot/firmware are required by `POST /devices/{id}/start`. Always resolves against a
 * *freshly-fetched* snapshot list. Previously fell back to the device's own `last_snapshot_id`
 * (straight off `GET /devices`) as the default pick, paired with an independently-resolved
 * firmware — dropped entirely, not just re-paired, because that stored value can itself go stale
 * (e.g. it named a snapshot that's since been superseded or invalidated on Roku's side) and
 * reproduces the exact "Build validation failed" failure this function exists to prevent, even
 * once its firmware pairing was corrected. The account's "live" snapshot — created once at
 * device-creation time and kept up to date in place on every stop — is the one snapshot that's
 * always meant to reflect current, startable state, so it's the real default, not a fallback.
 *
 * Picks, in order: `explicitSnapshotId` (a user pick from the "Run device" modal's
 * `RceListSnapshots`-backed picker), else the account's "live" snapshot, then "base", then
 * whatever's first (only reachable if an account somehow has neither, which shouldn't happen).
 *
 * Firmware: `explicitFirmwareVersionId` (the "Run device" modal's own firmware dropdown, which the
 * user can override) always wins when present — this is the escape hatch for a device whose
 * snapshot was captured under a firmware Roku has since retired entirely (a real, permanent case,
 * not just a transient mismatch — see `RceListFirmwareVersions`/the modal's stale-firmware check).
 * Absent an explicit pick, falls back to the chosen snapshot's OWN `firmwareVersionId` via
 * `firmwareIdForSnapshot`, never a separately-guessed one. Returns null if nothing usable was found.
 */
async function resolveStartParams(
  client: RceManagementClient,
  deviceId: number,
  hint: StartDeviceHint,
  explicitSnapshotId?: number | null,
  explicitFirmwareVersionId?: string | null
): Promise<{ snapshotId: number; firmwareVersionId: string; ready: boolean } | null> {
  const snapshotsResult = await client.listSnapshots(deviceId);
  const snapshots = snapshotsResult.success ? snapshotsResult.snapshots : [];

  const snapshot =
    (explicitSnapshotId != null ? snapshots.find((s) => s.id === explicitSnapshotId) : undefined) ??
    snapshots.find((s) => s.live) ??
    snapshots.find((s) => s.base) ??
    snapshots[0];
  if (!snapshot) return null;

  const firmwareVersionId = explicitFirmwareVersionId ?? (await firmwareIdForSnapshot(client, snapshot, hint.deviceType));
  if (!firmwareVersionId) return null;

  // `ready` (surfaced to the renderer's Run Device modal but not previously checked here) is
  // logged alongside a start failure below — "Build validation failed" with no further API detail
  // is consistent with attempting to start a snapshot whose own build hasn't passed Roku's
  // validation yet, independent of which firmware it's paired with.
  return { snapshotId: snapshot.id, firmwareVersionId, ready: snapshot.ready };
}

/**
 * Best-effort enrich `device` with `developerEnabled`/`ecpSettingMode`/`isTv` from a live
 * `query/device-info` ECP call — the Core API's device shape doesn't carry any of these (they're
 * physical-device ECP-response fields), so without this the renderer's shared ECP-mode warning
 * banner (see `updateEcpWarnings` in app.ts) has nothing real to show for RCE and stays hidden, and
 * the TV/STB icon falls back to the Core API's coarser `deviceType`. Silently no-ops on any
 * failure (not running, no instance URL, request error) — the banner then just stays hidden rather
 * than showing a wrong "Disabled" default, matching `getEcpMode`'s behavior only being
 * trustworthy when the field is actually present.
 *
 * Exported so `relay-handlers.ts`'s `SideloadRelaySeedTargets` can reuse it: the resulting
 * `developerEnabled` is exactly the same gate `toCandidate` already applies to local/remote
 * devices there (no dev mode ⇒ not a candidate), and doubles as "is this device actually
 * running" for free — it's only ever set for a device whose `runningDevice.instanceApiUrl`
 * resolved, i.e. never for a shutdown device.
 */
export async function enrichWithEcpMode(device: RceDevice, token: string): Promise<void> {
  const instanceApiUrl = device.status === 'running' ? device.runningDevice?.instanceApiUrl : null;
  if (!instanceApiUrl) return;
  try {
    const ecpClient = new RceEcpClient(instanceApiUrl, token);
    const result = await ecpClient.query('/query/device-info');
    if (!result.success || !result.data) return;
    const parsed = parseDeviceInfo(result.data);
    device.developerEnabled = parsed.developerEnabled;
    device.ecpSettingMode = normalizeEcpSettingMode(parsed.ecpSettingMode);
    // Real ECP-reported is-tv — the same field physical devices key their TV/STB icon off of,
    // more authoritative than the Core API's coarser `deviceType` (see types.ts's doc comment).
    device.isTv = parsed.isTv;
  } catch {
    // Best-effort — see doc comment above.
  }
}

/** Module-level (not per-`setupRceHandlers()`-call) so `ensureRceDebugTelnetConnected` can be
 *  imported and called directly by other main-process modules (Sideload Relay's fan-out) without
 *  going through IPC — mirrors `telnet-handlers.ts` exporting `ensureDebugTelnetConnected` the
 *  same way for physical devices. */
const debugTelnetSockets = new Map<string, { socket: RceSocket; openedAtMs: number; bytesReceived: number }>();
type RceTelnetConnectResult = DebugTelnetConnectResult;
/** ip -> connect in flight. Same single-flight guard as telnet-handlers.ts's `debugTelnetConnecting`:
 *  the relay fan-out's pre-open and the Console tab adopting it call this concurrently for one
 *  device, and Roku's 8085 is single-client. */
const debugTelnetConnecting = new Map<string, Promise<RceTelnetConnectResult>>();

/**
 * Open (or reuse) the RCE debug console (port 8085) for `ip`, tunneled through the Device API's
 * ports-bridge. Pushes the same `TelnetConnected`/`TelnetData`/`TelnetDisconnected`/`TelnetError`
 * events the Console tab UI and physical devices already consume — see the IPC handler below and
 * `setupTelnet` in renderer/app.ts. Idempotent like `ensureDebugTelnetConnected`: a live tunnel is
 * reused, a connect already in flight is joined.
 */
export function ensureRceDebugTelnetConnected(
  name: string,
  instanceApiUrl: string,
  ip: string
): Promise<RceTelnetConnectResult> {
  return singleFlight(debugTelnetConnecting, ip, () => openRceDebugTelnet(name, instanceApiUrl, ip));
}

async function openRceDebugTelnet(name: string, instanceApiUrl: string, ip: string): Promise<RceTelnetConnectResult> {
  const token = getAccountToken(name);
  if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
  if (!instanceApiUrl) return { success: false, error: S.app.rceNoInstanceUrl };

  const existing = debugTelnetSockets.get(ip);
  if (existing) {
    if (!existing.socket.destroyed) return { success: true, connectionId: ip };
    debugTelnetSockets.delete(ip);
  }

  const conn = await connectRceSocket({ instanceApiUrl, token, port: RCE_DEBUG_TELNET_PORT });
  if (!conn.success) return { success: false, error: conn.error };

  const entry = { socket: conn.socket, openedAtMs: Date.now(), bytesReceived: 0 };
  debugTelnetSockets.set(ip, entry);
  broadcastToAllWindows(IPC.TelnetConnected, { ip, connectionId: ip });

  entry.socket.on('data', (data: Buffer) => {
    entry.bytesReceived += data.length;
    const text = data.toString('utf8');
    broadcastToAllWindows(IPC.TelnetData, { ip, connectionId: ip, data: text });
    // Physical/LAN-relay devices get this same mirror via `main.ts`'s `safeSendToRendererWithFiddleMirror`
    // wrapper around `telnet-handlers.ts`'s `safeSend` call — RCE's telnet broadcast goes through its own
    // `broadcastToAllWindows` instead, which never passed through that wrapper, so BrightScript Fiddle's
    // terminal silently never got 8085 output for an RCE device even though the Console tab did.
    broadcastFiddleTerminalData({ ip, data: text, isRemote: true, connectionId: ip });
  });
  entry.socket.on('error', (error: Error) => {
    mainWarn('[RCE Telnet] Socket error:', error.message);
    broadcastToAllWindows(IPC.TelnetError, { ip, connectionId: ip, error: error.message });
  });
  entry.socket.on('close', () => {
    const live = debugTelnetSockets.get(ip);
    if (live && live !== entry) return; // superseded — the bookkeeping belongs to the live tunnel
    const aliveMs = Date.now() - entry.openedAtMs;
    debugTelnetSockets.delete(ip);
    broadcastToAllWindows(IPC.TelnetDisconnected, {
      ip,
      connectionId: ip,
      hadError: false,
      aliveMs,
      bytesReceived: entry.bytesReceived
    });
  });

  return { success: true, connectionId: ip };
}

/** Record the RCE user id for accounts stored before it was kept — one call each, once. */
async function backfillRceUserIds(): Promise<void> {
  for (const name of getAccountNames()) {
    if (getRceAccountUserId(name)) continue;
    const token = getAccountToken(name);
    if (!token) continue;
    const info = await new RceManagementClient(token).getUserInfo().catch(() => null);
    if (info?.success && info.user?.id) setRceAccountUserId(name, info.user.id);
  }
}

export function setupRceHandlers(): void {
  const { ipcMain } = require('electron') as typeof import('electron');

  ipcMain.handle(IPC.RceValidateToken, async (_event: IpcMainInvokeEvent, { token }: { token: string }) => {
    if (typeof token !== 'string' || !token.trim()) {
      return { success: false, error: S.app.rceTokenRequired };
    }
    try {
      const client = new RceManagementClient(token.trim());
      return await client.getUserInfo();
    } catch (error: unknown) {
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(IPC.RceAddAccount, async (_event: IpcMainInvokeEvent, { name, token }: { name: string; token: string }) => {
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedToken = typeof token === 'string' ? token.trim() : '';
    if (!trimmedName) return { success: false, error: S.app.rceNameRequired };
    if (!trimmedToken) return { success: false, error: S.app.rceTokenRequired };
    if (getAccountNames().some((n) => n.toLowerCase() === trimmedName.toLowerCase())) {
      return { success: false, error: S.app.rceAccountExists(trimmedName) };
    }
    // Same PAT under a new name — a pure secret-store lookup, no network.
    const sameToken = findRceAccountByToken(trimmedToken);
    if (sameToken) return { success: false, error: S.app.rceTokenExists(sameToken) };
    // Validate before persisting — fail with a clear error instead of silently storing a bad token.
    const client = new RceManagementClient(trimmedToken);
    const validation = await client.getUserInfo();
    if (!validation.success) {
      return { success: false, error: validation.error };
    }
    // A different PAT for the same RCE user — compare the `GET /user/me` id against the ids
    // recorded for stored accounts (backfilled once for accounts stored before ids were kept).
    const userId = validation.user?.id;
    if (userId) {
      await backfillRceUserIds();
      const sameUser = findRceAccountByUserId(userId);
      if (sameUser) return { success: false, error: S.app.rceUserExists(sameUser) };
    }
    setRceAccount(trimmedName, trimmedToken, userId);
    return { success: true, name: trimmedName };
  });

  ipcMain.handle(IPC.RceRemoveAccount, async (_event: IpcMainInvokeEvent, { name }: { name: string }) => {
    if (typeof name !== 'string' || !name) return { success: false, error: S.app.rceNameRequired };
    deleteRceAccount(name);
    return { success: true };
  });

  ipcMain.handle(IPC.RceListAccounts, async () => {
    return { success: true, accounts: getAccountNames() };
  });

  ipcMain.handle(IPC.RceGetUserInfo, async (_event: IpcMainInvokeEvent, { name }: { name: string }) => {
    const token = typeof name === 'string' ? getAccountToken(name) : undefined;
    if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
    try {
      const client = new RceManagementClient(token);
      return await client.getUserInfo();
    } catch (error: unknown) {
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(
    IPC.RceGetUsage,
    async (_event: IpcMainInvokeEvent, { name, start, end, interval }: { name: string; start: string; end: string; interval: '1h' | '24h' | '1w' | '1mo' }) => {
      const token = typeof name === 'string' ? getAccountToken(name) : undefined;
      if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
      try {
        // The RCE token is per-user, not per-org — there's no reason to ever ask for the
        // owner-wide breakdown here. `getOwnerUsage` (GET /usage/owner) required a second,
        // conditional round trip to Roku's Core API on every modal open for any non-owner
        // account (the common case), which is most of why the RCE User Info modal was slow.
        const client = new RceManagementClient(token);
        return await client.getUserUsage({ start, end, interval });
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) };
      }
    }
  );

  ipcMain.handle(IPC.RceListDevices, async (_event: IpcMainInvokeEvent, { name }: { name: string }) => {
    const token = typeof name === 'string' ? getAccountToken(name) : undefined;
    if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
    try {
      const client = new RceManagementClient(token);
      const result = await client.listDevices();
      if (result.success) {
        // Best-effort per-device ECP enrichment (developerEnabled/ecpSettingMode/isTv) for every
        // device in the list — `enrichWithEcpMode` already no-ops for shutdown/pending devices
        // (no running instance to query), so this is safe to call unconditionally rather than
        // filtering by status here too. Previously this only ran at single-device connect time
        // (`RceGetDevice`), so a running-but-not-yet-connected device's Dev/ECP badges never had
        // anything to show.
        await Promise.all(result.devices.map((d) => enrichWithEcpMode(d, token)));
        // Feed the serial->{accountName,deviceId} registry so Sideload Relay/Fiddle can resolve an
        // RCE device by its stable serial instead of a synthetic, restart-invalidated "ip" — same
        // "auto-fed by every discovery call" pattern as roku-dev-studio-api's device-registry.ts for
        // physical devices.
        for (const d of result.devices) recordRceDeviceSeen(name, d);
      }
      return result;
    } catch (error: unknown) {
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(IPC.RceGetDevice, async (_event: IpcMainInvokeEvent, { name, deviceId }: { name: string; deviceId: number }) => {
    const token = typeof name === 'string' ? getAccountToken(name) : undefined;
    if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
    try {
      const client = new RceManagementClient(token);
      const result = await client.getDevice(deviceId);
      if (result.success) {
        await enrichWithEcpMode(result.device, token);
        recordRceDeviceSeen(name, result.device);
      }
      return result;
    } catch (error: unknown) {
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(
    IPC.RceStartDevice,
    async (
      _event: IpcMainInvokeEvent,
      {
        name,
        deviceId,
        deviceType,
        snapshotId,
        firmwareVersionId,
        maxRuntimeSeconds
      }: {
        name: string;
        deviceId: number;
        snapshotId?: number | null;
        firmwareVersionId?: string | null;
        maxRuntimeSeconds?: number | null;
      } & StartDeviceHint
    ) => {
      const token = typeof name === 'string' ? getAccountToken(name) : undefined;
      if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
      try {
        const client = new RceManagementClient(token);
        const params = await resolveStartParams(client, deviceId, { deviceType }, snapshotId, firmwareVersionId);
        if (!params) return { success: false, error: S.app.rceNoStartableSnapshot };
        const startOpts = { ...params, maxRuntime: maxRuntimeSeconds ?? RCE_DEFAULT_MAX_RUNTIME_SECONDS };
        const result = await client.startDevice(deviceId, startOpts);
        // Temporary diagnostic — "Build validation failed" from the API gives no field-level
        // detail through the flattened `.error` string (confirmed live: `rawBody` is just
        // `{ detail: 'Build validation failed' }`, nothing more granular). `startOpts.ready`
        // reflects whether the resolved snapshot itself reports as ready — a `false` here despite
        // a now-provably-correct snapshot/firmware pairing points at Roku's own build validation
        // for that snapshot, not our request. Also logs the account's current firmware list so a
        // deprecated/retired `firmwareVersionId` on an older snapshot is visible directly, rather
        // than guessed at. Remove this whole diagnostic once this class of failure is understood.
        if (!result.success) {
          const firmwareResult = await client.listFirmwareVersions();
          mainWarn('[RCE] startDevice failed', {
            deviceId,
            startOpts,
            error: result.error,
            statusCode: result.statusCode,
            rawBody: result.rawBody,
            currentFirmwareVersions: firmwareResult.success ? firmwareResult.firmwareVersions : firmwareResult.error
          });
        }
        return result;
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) };
      }
    }
  );

  ipcMain.handle(IPC.RceStopDevice, async (_event: IpcMainInvokeEvent, { name, deviceId }: { name: string; deviceId: number }) => {
    const token = typeof name === 'string' ? getAccountToken(name) : undefined;
    if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
    try {
      const client = new RceManagementClient(token);
      return await client.stopDevice(deviceId);
    } catch (error: unknown) {
      return { success: false, error: errorMessage(error) };
    }
  });

  // Backs the "Run device" modal's snapshot dropdown — kicked off client-side as soon as the modal
  // opens (in parallel with its entrance animation), so a slow response never blocks the rest of
  // the form (Max Run Time, Cancel/Run Device) from being usable in the meantime.
  ipcMain.handle(IPC.RceListSnapshots, async (_event: IpcMainInvokeEvent, { name, deviceId }: { name: string; deviceId: number }) => {
    const token = typeof name === 'string' ? getAccountToken(name) : undefined;
    if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
    try {
      const client = new RceManagementClient(token);
      return await client.listSnapshots(deviceId);
    } catch (error: unknown) {
      return { success: false, error: errorMessage(error) };
    }
  });

  // Fetched once per RCE location on connect (renderer's `refreshRceLocation`, then cached on the
  // location for the session) — one account-wide call covering every device type at once (the API
  // has no per-type endpoint, just a `device_type` filter query param we deliberately don't pass),
  // used to (a) pre-select a device's current firmware in the "Run device" modal's picker and (b)
  // detect when that firmware has been retired by Roku entirely, which is what actually causes
  // "Build validation failed" for an old snapshot — see resolveStartParams's doc comment.
  ipcMain.handle(IPC.RceListFirmwareVersions, async (_event: IpcMainInvokeEvent, { name }: { name: string }) => {
    const token = typeof name === 'string' ? getAccountToken(name) : undefined;
    if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
    try {
      const client = new RceManagementClient(token);
      return await client.listFirmwareVersions();
    } catch (error: unknown) {
      return { success: false, error: errorMessage(error) };
    }
  });

  // ── ECP over an RCE instance's Device API ──────────────────────────────────────────────────
  // Each call takes the account name (to resolve the token) and the device's current
  // `instanceApiUrl`, supplied fresh by the renderer from its last list/state-stream update —
  // no main-process instance-URL cache yet (design doc §4 flags a self-healing cache as a later
  // refinement; a plain per-call value is enough for a first working version).

  type EcpCallPayload = { name: string; instanceApiUrl: string };

  function ecpClientFor(name: string, instanceApiUrl: string): RceEcpClient | { error: string } {
    const token = getAccountToken(name);
    if (!token) return { error: S.app.rceNoStoredAccount(name) };
    if (!instanceApiUrl) return { error: S.app.rceNoInstanceUrl };
    return new RceEcpClient(instanceApiUrl, token);
  }

  /** Resolves the ECP client for `name`/`instanceApiUrl` and runs `fn` against it, folding the
   *  "no stored account" / "no instance URL" guard and the call's own try/catch into one place —
   *  every ECP handler below was repeating both verbatim. */
  async function withEcpClient<T>(
    name: string,
    instanceApiUrl: string,
    fn: (client: RceEcpClient) => Promise<T>
  ): Promise<T | { success: false; error: string }> {
    const client = ecpClientFor(name, instanceApiUrl);
    if ('error' in client) return { success: false, error: client.error };
    try {
      return await fn(client);
    } catch (error: unknown) {
      return { success: false, error: errorMessage(error) };
    }
  }

  ipcMain.handle(IPC.RceKeypress, async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, key }: EcpCallPayload & { key: string }) =>
    withEcpClient(name, instanceApiUrl, (client) => client.keypress(key))
  );

  ipcMain.handle(IPC.RceDevSettingsCombo, async (_e: IpcMainInvokeEvent, { name, instanceApiUrl }: EcpCallPayload) =>
    withEcpClient(name, instanceApiUrl, (client) => client.devSettingsCombo())
  );

  ipcMain.handle(IPC.RceLaunch, async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, appId, params }: EcpCallPayload & { appId: string; params?: string }) =>
    withEcpClient(name, instanceApiUrl, (client) => client.launch(appId, params))
  );

  ipcMain.handle(IPC.RceQuery, async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, endpoint }: EcpCallPayload & { endpoint: string }) =>
    withEcpClient(name, instanceApiUrl, (client) => client.query(endpoint))
  );

  ipcMain.handle(IPC.RcePost, async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, endpoint }: EcpCallPayload & { endpoint: string }) =>
    withEcpClient(name, instanceApiUrl, (client) => client.post(endpoint))
  );

  ipcMain.handle(IPC.RceInputText, async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, text }: EcpCallPayload & { text: string }) =>
    withEcpClient(name, instanceApiUrl, (client) => client.inputText(text))
  );

  ipcMain.handle(
    IPC.RceDeeplink,
    async (
      _e: IpcMainInvokeEvent,
      { name, instanceApiUrl, appId, contentId, mediaType, params }: EcpCallPayload & { appId: string; contentId?: string; mediaType?: string; params?: Record<string, string> }
    ) => withEcpClient(name, instanceApiUrl, (client) => client.deeplink(appId, contentId, mediaType, params))
  );

  ipcMain.handle(IPC.RceGetIcon, async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, appId }: EcpCallPayload & { appId: string }) =>
    // `getIcon` (not `query`) — the icon body is binary and `query`'s `res.text()` would
    // corrupt it instead of producing the `dataUrl` the renderer's icon-loading code expects.
    withEcpClient(name, instanceApiUrl, (client) => client.getIcon(appId))
  );

  ipcMain.handle(IPC.RceGetHardwareImage, async (_e: IpcMainInvokeEvent, { name, instanceApiUrl }: EcpCallPayload) =>
    withEcpClient(name, instanceApiUrl, (client) => client.getHardwareImage())
  );

  // Screenshot (design doc — ported from the reference `roku-deploy` implementation the
  // RokuCommunity VS Code extension uses for RCE devices): `plugin_inspect`/Screenshot through the
  // same `/sideload` digest-auth proxy `rceSideload` already uses, not the ECP ports-bridge — see
  // `rce-sideload.ts`'s `rceCaptureScreenshot`. Response shape matches `IPC.RokuScreenshot`'s
  // (physical devices, `dev-app-handlers.ts`) so the renderer's screenshot UI works unchanged.
  ipcMain.handle(
    IPC.RceScreenshot,
    async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, password, waitAfterTriggerMs }: EcpCallPayload & { password: string; waitAfterTriggerMs?: number }) => {
      const token = getAccountToken(name);
      if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
      if (!instanceApiUrl) return { success: false, error: S.app.rceNoInstanceUrl };
      const result = await rceCaptureScreenshot({ instanceApiUrl, rceToken: token, devPassword: password, waitAfterTriggerMs });
      if (!result.success || !result.imageBuffer) {
        return { success: false, error: result.error, authFailed: result.authFailed };
      }
      const tempFile = path.join(os.tmpdir(), `rce-screenshot-${Date.now()}.jpg`);
      try {
        await fs.promises.writeFile(tempFile, result.imageBuffer);
      } catch (error: unknown) {
        return { success: false, error: S.devApp.failedToSaveScreenshot(errorMessage(error)) };
      }
      const dataUrl = `data:image/jpeg;base64,${result.imageBuffer.toString('base64')}`;
      return { success: true, url: dataUrl, tempFile, message: S.devApp.screenshotCapturedToast };
    }
  );

  ipcMain.handle(
    IPC.RceVerifyDevAuth,
    async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, password }: EcpCallPayload & { password?: string }) => {
      const token = getAccountToken(name);
      if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
      if (!instanceApiUrl) return { success: false, error: S.app.rceNoInstanceUrl };
      if (!password) return { success: false, error: S.app.rceDevPasswordRequired };
      return rceVerifyDevAuth({ instanceApiUrl, rceToken: token, devPassword: password });
    }
  );

  ipcMain.handle(
    IPC.RceSideload,
    async (
      _e: IpcMainInvokeEvent,
      { name, instanceApiUrl, filePath, password, remoteDebug, ip }: EcpCallPayload & { filePath: string; password: string; remoteDebug?: boolean; ip?: string }
    ) => {
      const token = getAccountToken(name);
      if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
      if (!instanceApiUrl) return { success: false, error: S.app.rceNoInstanceUrl };
      // Same path-safety gate physical sideload uses — a direct IPC call can't upload an
      // arbitrary path the user never picked via the OS dialog/drop zone.
      const resolvedFile = resolveSideloadPackageFile(filePath);
      if (!resolvedFile.success) return resolvedFile;
      // Same persisted "Enable Debugger" preference + STOP-auto-detect the local/LAN-relay
      // sideload path uses (dev-app-handlers.ts's computeSideloadDebugFlags) — an RCE device should
      // remember this opt-in across sideloads exactly like a physical one does, not just honor
      // whatever the checkbox happened to be this one time.
      const { rememberDebugZip } = require('../debug-sideload-memory') as typeof import('../debug-sideload-memory');
      const { debugEnabled, discovered } = computeSideloadDebugFlags(ip || '', undefined, resolvedFile.filePath, remoteDebug);
      try {
        const zipData = fs.readFileSync(resolvedFile.filePath);
        const result = await rceSideload({ instanceApiUrl, rceToken: token, devPassword: password }, zipData, resolvedFile.fileName, debugEnabled);
        if (debugEnabled && result.success && ip) {
          try {
            rememberDebugZip(ip, resolvedFile.filePath);
            notifyDebuggerReattach(ip, { discovered });
          } catch {
            /* best-effort */
          }
        }
        return result;
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) };
      }
    }
  );

  ipcMain.handle(
    IPC.RceDeleteSideload,
    async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, password }: EcpCallPayload & { password: string }) => {
      const token = getAccountToken(name);
      if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
      if (!instanceApiUrl) return { success: false, error: S.app.rceNoInstanceUrl };
      return rceDeleteSideload({ instanceApiUrl, rceToken: token, devPassword: password });
    }
  );

  // ── Telnet system consoles (8080 / 8087 / custom), tunneled via the Device API's ports-bridge ──
  // One-shot consumer entry points (the Query tab on an RCE device). Same contract as the local and
  // relay pools: connect reuses a socket the Ports window holds (`reused: true`), disconnect is a
  // no-op while it does. The window itself calls the exported pool functions below directly.
  ipcMain.handle(
    IPC.RceTelnetSystemConnect,
    async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, ip, port }: { name: string; instanceApiUrl: string; ip: string; port?: number }) => {
      const token = getAccountToken(name);
      if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
      if (!instanceApiUrl) return { success: false, error: S.app.rceNoInstanceUrl };
      const p = port ?? RCE_TELNET_SYSTEM_PORT;
      if (!isRcePortAllowed(p)) return { success: false, error: 'Unsupported port' };
      return connectRceSystemTelnet({ instanceApiUrl, token, ip, port: p });
    }
  );

  ipcMain.handle(IPC.RceTelnetSystemDisconnect, async (_e: IpcMainInvokeEvent, { ip, port }: { ip: string; port?: number }) =>
    disconnectRceSystemTelnet(ip, port ?? RCE_TELNET_SYSTEM_PORT)
  );

  ipcMain.handle(IPC.RceTelnetSystemSend, async (_e: IpcMainInvokeEvent, { ip, port, command }: { ip: string; port?: number; command: string }) =>
    sendRceSystemTelnet(ip, port ?? RCE_TELNET_SYSTEM_PORT, command)
  );

  // ── BrightScript debug console (port 8085), tunneled the same way ─────────────────────────
  // Deliberately NOT replicating `telnet-handlers.ts`'s holder-tracking or debugger-auto-reattach
  // watching here — the socket debugger IS wired for RCE (see `debuggerSupported: true` in
  // `createRceApiAdapter` and `debugger-handlers.ts`'s own RCE branch), it just owns its own
  // reattach via `ensureRceDebugTelnetConnected` below rather than this console handler watching
  // for it. Connect/data/disconnect/error match
  // what `setupTelnet` (the Console tab UI) consumes via `onTelnetData`/`onTelnetConnected`/
  // `onTelnetDisconnected`/`onTelnetError`. `ensureRceDebugTelnetConnected` (module-level, exported)
  // is the shared connect body — Sideload Relay's fan-out (`fanout.ts`) calls it directly after an
  // RCE install, the same way it calls `ensureDebugTelnetConnected` for physical targets.
  ipcMain.handle(
    IPC.RceTelnetConnect,
    async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, ip }: { name: string; instanceApiUrl: string; ip: string }) =>
      ensureRceDebugTelnetConnected(name, instanceApiUrl, ip)
  );

  ipcMain.handle(IPC.RceTelnetDisconnect, async (_e: IpcMainInvokeEvent, { ip }: { ip: string }) => {
    const existing = debugTelnetSockets.get(ip);
    if (existing) {
      existing.socket.destroy();
      debugTelnetSockets.delete(ip);
    }
    return { success: true };
  });

  // ── App Connector (RALE, port 49200), tunneled the same ports-bridge way ──────────────────
  // Wake goes through the generic ECP proxy (same shape `rceKeypress`/`rceQuery` already use);
  // connect opens the ports-bridge tunnel and hands it to `roku-dev-studio-api`'s shared
  // `raleRegisterSocket` so the existing `[start]/[end]` framing + command-chain logic
  // (`raleCommand`/`raleDisconnect`, physical devices' own implementation) drives it unchanged —
  // no RCE-specific command/disconnect handlers needed. The device's synthetic `ip` doubles as
  // the connectionId, matching the telnet handlers' convention above.
  ipcMain.handle(
    IPC.RceRaleWake,
    async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, port }: EcpCallPayload & { port?: number }) =>
      withEcpClient(name, instanceApiUrl, (client) => client.post(`/input?rale=true&port=${port ?? RCE_RALE_PORT}`))
  );

  ipcMain.handle(
    IPC.RceRaleConnect,
    async (_e: IpcMainInvokeEvent, { name, instanceApiUrl, ip, port }: { name: string; instanceApiUrl: string; ip: string; port?: number }) => {
      const token = getAccountToken(name);
      if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
      if (!instanceApiUrl) return { success: false, error: S.app.rceNoInstanceUrl };

      const conn = await connectRceSocket({ instanceApiUrl, token, port: port ?? RCE_RALE_PORT });
      if (!conn.success) return { success: false, error: conn.error };

      raleRegisterSocket(ip, conn.socket, {
        onClose: (connectionId: string) => {
          broadcastToAllWindows(IPC.RaleDisconnected, { connectionId });
        }
      });
      conn.socket.on('error', (error: Error) => {
        mainWarn('[RCE RALE] Socket error:', error.message);
      });

      return { success: true, connectionId: ip };
    }
  );

  // ── Push-based device state (design doc §5) ────────────────────────────────────────────────
  const activeWatches = new Map<string, WatchDeviceStateHandle>();

  function watchKey(name: string, deviceId: number): string {
    return `${name}:${deviceId}`;
  }

  ipcMain.handle(IPC.RceWatchDeviceState, async (_e: IpcMainInvokeEvent, { name, deviceId }: { name: string; deviceId: number }) => {
    const key = watchKey(name, deviceId);
    if (activeWatches.has(key)) return { success: true };
    const token = getAccountToken(name);
    if (!token) return { success: false, error: S.app.rceNoStoredAccount(name) };
    const client = new RceManagementClient(token);
    const handle = client.watchDeviceState(deviceId, {
      onMessage: (message) => {
        broadcastToAllWindows(IPC.RceDeviceStateChanged, { name, deviceId, ...message });
      },
      onError: (error) => {
        mainWarn(`[rce-handlers] device state stream error for ${key}:`, error);
      },
      onClose: () => {
        activeWatches.delete(key);
      }
    });
    activeWatches.set(key, handle);
    return { success: true };
  });

  ipcMain.handle(IPC.RceUnwatchDeviceState, async (_e: IpcMainInvokeEvent, { name, deviceId }: { name: string; deviceId: number }) => {
    const key = watchKey(name, deviceId);
    const handle = activeWatches.get(key);
    if (handle) {
      handle.close();
      activeWatches.delete(key);
    }
    return { success: true };
  });
}


// ── RCE text-console pool (ports-bridge WebSocket tunnels) ───────────────────────────────────
// Keyed `${serial}:${port}` (an RCE device's `ip` IS its serial — see normalizeRceDevice in
// renderer/app.ts). Mirrors telnet-handlers.ts's local pool: window-hold semantics, single-flight
// connects, identity-guarded close, data + disconnect pushed to every window (Ports windows filter by
// serial + port).

type RceSystemConn = { socket: RceSocket; ip: string; port: number; heldByWindow: boolean };
const rceSystemPool = createHeldPool<RceSystemConn>();
const rceSystemSockets = rceSystemPool.entries;

/** Ports the Instance API's `/api/v0/ports/{port}` bridge will open (its OpenAPI spec, 2026-09-18):
 *  8080 SceneGraph, 8081/8082 debugger control + I/O, 8085 console, 8087 screensaver, 9999
 *  TypeScript debugger, plus the whole ephemeral range 49152–65535. Anything else is refused by the
 *  gateway, so refuse it here with a clear message instead of a failed WebSocket handshake. */
export const RCE_TUNNEL_FIXED_PORTS: ReadonlyArray<number> = [8080, 8081, 8082, 8085, 8087, 9999];
export const RCE_TUNNEL_EPHEMERAL_RANGE: readonly [number, number] = [49152, 65535];

export function isRcePortAllowed(port: unknown): port is number {
  if (typeof port !== 'number' || !Number.isInteger(port)) return false;
  return RCE_TUNNEL_FIXED_PORTS.includes(port) || (port >= RCE_TUNNEL_EPHEMERAL_RANGE[0] && port <= RCE_TUNNEL_EPHEMERAL_RANGE[1]);
}

function emitRceSystemDisconnected(ip: string, port: number): void {
  broadcastToAllWindows(IPC.TelnetSystemDisconnected, { ip, port, connectionId: systemTelnetConnectionId(ip, port), hadError: false });
}

export function connectRceSystemTelnet(opts: {
  instanceApiUrl: string;
  token: string;
  ip: string;
  port: number;
  holder?: SystemTelnetHolder;
}): Promise<SystemTelnetConnectResult> {
  const { instanceApiUrl, token, ip, port, holder } = opts;
  const connectionId = systemTelnetConnectionId(ip, port);
  return rceSystemPool.connect(connectionId, holder, {
    healthy: (e) => !e.socket.destroyed,
    discardStale: (stale) => { try { stale.socket.destroy(); } catch { /* ignore */ } },
    dial: async () => {
      const conn = await connectRceSocket({ instanceApiUrl, token, port });
      if (!conn.success) return { success: false, error: conn.error };
      const entry: RceSystemConn = { socket: conn.socket, ip, port, heldByWindow: false };
      conn.socket.on('data', (data: Buffer) => {
        if (rceSystemSockets.get(connectionId) !== entry) return;
        broadcastToAllWindows(IPC.TelnetSystemData, { ip, port, connectionId, data: data.toString('utf8') });
      });
      conn.socket.on('error', (error: Error) => {
        mainWarn('[RCE Telnet System] Socket error:', connectionId, error.message);
      });
      conn.socket.on('close', () => {
        if (rceSystemSockets.get(connectionId) !== entry) return;
        rceSystemSockets.delete(connectionId);
        emitRceSystemDisconnected(ip, port);
      });
      return { success: true, entry };
    }
  });
}

export function disconnectRceSystemTelnet(ip: string, port: number, holder?: SystemTelnetHolder): Promise<{ success: true; held?: boolean }> {
  return rceSystemPool.disconnect(systemTelnetConnectionId(ip, port), holder, (conn) => {
    try { conn.socket.destroy(); } catch { /* ignore */ }
    emitRceSystemDisconnected(ip, port);
  });
}

export function sendRceSystemTelnet(ip: string, port: number, command: string): { success: true } | { success: false; error: string } {
  const conn = rceSystemSockets.get(systemTelnetConnectionId(ip, port));
  if (!conn || conn.socket.destroyed) return { success: false, error: 'Not connected' };
  // Roku's text consoles take a bare `\n`, not telnet's `\r\n` — matches the physical-device pool.
  return writeRokuTelnetLine(conn.socket, command, { lineEnding: '\n' });
}

/** Send `payload` on `channel` to every open window, skipping any that are destroyed. Mirrors
 *  `relay-handlers.ts`'s identical helper — small enough that sharing it isn't worth the coupling. */
function broadcastToAllWindows(channel: string, payload: unknown): void {
  const { BrowserWindow } = require('electron') as typeof import('electron');
  for (const win of BrowserWindow.getAllWindows()) {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

# `roku-dev-studio-rce`

Roku Cloud Emulator (RCE) client for cloud-hosted virtual Roku devices. Two halves: the **Core
API** (`api.rce.roku.com` — accounts, devices, snapshots, firmware, usage, live device-state
WebSocket) and the per-instance **Device API** (ECP proxy, raw-TCP ports bridge, dev-installer
sideload/screenshot, Janus video signaling). The payoff is `RceSocket`: a `net.Socket`-shaped
`Duplex` over the ports bridge, so the desktop app's telnet, BrightScript debugger, and RALE code
run against a cloud device by swapping only the socket construction — none of their own logic changes.

> Part of [Roku Dev Studio](https://paramount-engineering.github.io/roku-dev-studio/) — see the [main repo](https://github.com/paramount-engineering/roku-dev-studio) for the desktop app, MCP server, and other packages.

## Requirements

- Node.js 24.17 or higher
- An RCE account and a Personal Access Token — generate one from the Roku Cloud Emulator web UI
  (Token tab). It authenticates every Core API and Device API call (`Authorization: Bearer` /
  `X-Authorization: Bearer`).
- For sideload, screenshot, and dev-auth verification: the running device's own developer
  password (HTTP Digest, user `rokudev`) — the same credential a physical device's installer uses.

## Consumed from source

This package has no build step — `main`/`types` in `package.json` point directly at `index.ts`. It
is installed via npm workspaces and imported as TypeScript source by the desktop app's **main
process only** (`apps/roku-dev-studio/main/**`). The renderer never imports it: its WebSocket
handshakes need an `Authorization` header a browser `WebSocket` can't set, so it runs under Node's
`ws` and hands results across IPC.

```bash
npm install                          # from the repository root
npm run typecheck -w roku-dev-studio-rce
npm test -w roku-dev-studio-rce
```

## Shape

**Core API** — `https://api.rce.roku.com/api/v1`, `Authorization: Bearer <token>`:

- **`RceManagementClient`** (`new RceManagementClient(token, baseUrl?)`) — `getUserInfo`,
  `getUserUsage`, `listDevices`, `getDevice`, `listSnapshots`, `listFirmwareVersions`,
  `startDevice`, `stopDevice`, and `watchDeviceState(deviceId, callbacks)` (the
  `GET /devices/{id}/ws` push feed — replaces polling; returns a `WatchDeviceStateHandle` with
  `close()`). Wire format is snake_case; every result is converted to the camelCase types in
  `types.ts` in one place.

**Device API** — per running instance, rooted at `DeviceInstanceInfo.instanceApiUrl`:

- **`RceEcpClient`** (`new RceEcpClient(instanceApiUrl, token)`) — ECP over HTTPS. Key input goes
  to `/api/v0/input/{keypress|keydown|keyup}/{key}`; everything else (`query`, `post`, `launch`,
  `deeplink`, `getIcon`, `getHardwareImage`, `inputText`) goes through the generic HTTP-port proxy
  `/api/v0/ports/8060/http/{path}`. There is no dedicated `/ecp1` route. `devSettingsCombo` is the
  one non-ECP call (`/api/v0/xi/developer-settings-combo`, `X-Authorization`).
- **`RceSocket`** / **`connectRceSocket`** / **`createRceDebugSocketFactory`** — the raw-TCP
  tunnel: `wss://<instanceApiUrl>/api/v0/ports/<port>` (**`ports`, plural**) wrapped in a
  `Duplex` that supports `.write()`, `.on('data'|'close'|'error')`, `.end()`, `.destroy()` — not a
  full `net.Socket` polyfill. `connectRceSocket` resolves `{ success, socket } | { success: false,
  error }`, mirroring `connectRokuTcp` in `roku-dev-studio-api`; `createRceDebugSocketFactory`
  returns the `connectSocket` factory for the in-house `DebugProtocolClient` and maps a bridge
  502 to `ECONNREFUSED` so the attach-retry loop treats it like a local closed port.
- **`rceSideload`** / **`rceDeleteSideload`** / **`rceVerifyDevAuth`** / **`rceCaptureScreenshot`**
  — the dev web installer (`/sideload/plugin_install`, `/sideload/plugin_inspect`) over HTTPS with
  **two** auth headers: `X-Authorization: Bearer <rceToken>` plus classic HTTP Digest
  (`Authorization: Digest …`, user `rokudev`, password = the device's dev password). Reuses
  `roku-dev-studio-api/lib/http-digest`'s pure digest/multipart helpers and
  `lib/plugin-install`'s reply matchers rather than forking them. A debug sideload (`remoteDebug`)
  and an "Identical to previous version" reply both fall back to Delete+Install so the channel
  really relaunches.
- **`RceVideoSignalingClient`** — Janus WebSocket **signaling only** (no WebRTC dependency):
  `connect()` resolves with the JSEP SDP offer + ICE servers; the caller hands it to a real
  `RTCPeerConnection` and calls back `sendAnswer` / `sendCandidate` / `sendCandidatesComplete`;
  `stop()` tears the session down. `janusId` is the stream `id`, `janusPin` its `pin`, and
  `janusToken` is sent as `apisecret` on every request; the account token goes on the WS
  handshake with the `janus-protocol` subprotocol.

**Conventions**

- `RceResult<T>` = `({ success: true } & T) | { success: false; error; statusCode?; rawBody? }` —
  Core API methods never throw on HTTP/network failure. Device API helpers use the same `success`
  discriminant with their own result types (`RceEcpResult`, `RceEcpIconResult`,
  `RceSideloadResult`, `RceScreenshotResult`); `connect()` on the signaling client and the debug
  socket factory reject/throw instead.
- **`normalizeInstanceApiUrl`** strips a leading `http(s)://` / `ws(s)://` from `instanceApiUrl`
  before a scheme is re-added. The live API returns the field *with* `https://` despite the OpenAPI
  schema saying it has no prefix — prepending blindly produced `https://https://…` and
  `ENOTFOUND https`. Always go through it (both clients do).
- `describeFetchError` unwraps undici's generic `TypeError: fetch failed` to include `.cause`, so a
  bad URL, an outage, and a timeout are distinguishable.

| Knob | Default | Where |
|------|---------|-------|
| Core API request timeout | 15 000 ms | `RceManagementClient` |
| ECP per-attempt timeout | 5 000 ms (`timeoutMs`) | `RceEcpClient` |
| ECP gateway-503 retry (instance still booting) | up to 4 retries, 1 500 ms apart (`retryWaitMs`) | `RceEcpClient` |
| `inputText` inter-key delay | 6 ms (`delayMs`) | `RceEcpClient` |
| Ports-bridge connect timeout | 5 000 ms (`connectTimeoutMs`) | `connectRceSocket` |
| Installer request timeout (sideload/delete/verify/screenshot) | 120 000 ms (`timeoutMs`) | `rceSideload` & co. |
| Screenshot: wait after trigger; download retries | 1 500 ms (`waitAfterTriggerMs`); up to 4 retries 1 500 ms apart (`retryWaitMs`); < 1 000 bytes = not written yet | `rceCaptureScreenshot` |
| Janus keepalive / negotiation timeout | 25 000 ms / 20 000 ms | `RceVideoSignalingClient` |

## Exports

| Subpath | What it is |
|---------|------------|
| `.` (`index.ts`) | Everything below re-exported: both clients, the socket trio, the sideload/screenshot functions, `RceVideoSignalingClient`, and all types. |
| `./types` | Core API types (`RceDevice`, `DeviceInstanceInfo`, `RceSnapshot`, `RceFirmwareVersion`, `RceUserInfo`, `RceUsage`, `DeviceStateMessage`, `IceServer`, …) and `RceResult<T>`. |
| `./management-client` | `RceManagementClient` + `ListDevicesOptions` / `StartDeviceOptions` / `UsageQueryOptions` / `WatchDeviceStateCallbacks` / `WatchDeviceStateHandle`. |
| `./ecp` | `RceEcpClient`, `normalizeInstanceApiUrl`, `describeFetchError`, `RceEcpOptions` / `RceEcpResult` / `RceEcpIconResult`. |
| `./socket` | `RceSocket`, `buildPortBridgeUrl`, `connectRceSocket`, `createRceDebugSocketFactory`, `RceSocketOptions`. |
| `./sideload` | `rceSideload`, `rceDeleteSideload`, `rceVerifyDevAuth`, `rceCaptureScreenshot` + `RceSideloadOptions` / `RceSideloadResult` / `RceScreenshotOptions` / `RceScreenshotResult`. |
| `./video-signaling` | `RceVideoSignalingClient` + `RceVideoSignalingConfig` / `RceVideoSignalingClientOptions` / `RceVideoJsep` / `RceVideoSignalingOffer`. |

## Verification status

Routes were cross-checked against Roku's *live* OpenAPI specs (Core API v4.3.0 at
`api.rce.roku.com/api/v1/openapi.json`; the per-instance Device API at
`<instanceApiUrl>/openapi.json`) rather than the narrative "RCE API Guide", which documents a
materially different route shape. Dates are from the source-file headers.

| Area | Status |
|------|--------|
| Core API device/snapshot/firmware/user/usage shapes | Confirmed against the live OpenAPI spec, 2026-09-11 |
| `GET /devices` list body (raw array vs `{ items }`) | Both handled; raw array assumed, not yet seen live |
| `watchDeviceState` WS handshake auth (`Authorization: Bearer`) | **Unverified assumption** — the spec doesn't document WS auth separately |
| `instance_api_url` includes `https://` | Confirmed live 2026-09-11 (contradicts the schema's own field description) |
| ECP: `/api/v0/input/keypress/{key}`, `/api/v0/ports/8060/http/query/device-info` | Confirmed live 2026-09-11 (real 200 bodies); other `query`/`launch` paths ride the same proxy |
| `devSettingsCombo` (`/api/v0/xi/developer-settings-combo`, `X-Authorization`) | **Not live-verified** — header taken from the roku-deploy reference; re-check if it 401s |
| Ports bridge, port 8080 (`wss://…/api/v0/ports/8080`, plain `Authorization: Bearer`) | Confirmed live 2026-09-12 — real `plugins` banner round trip |
| Ports 8085 (BrightScript console), 8087 (Screensaver) | Documented alongside 8080 (docs + the route's own 400 body); **not round-trip tested** |
| Debug port 8081 (and 8082, 9999, 49152–65535) | **Unconfirmed**; a closed debug port 502s at the bridge — that mapping to `ECONNREFUSED` is live-verified 2026-09-12 |
| Sideload `/sideload/plugin_install` reaches real device Digest auth (`realm="rokudev"`) | Confirmed live 2026-09-12 (challenge + clean 401 on a wrong password; same for `rceVerifyDevAuth`'s GET) |
| Screenshot (`plugin_inspect` → `pkgs/dev.jpg`) | Ported from roku-deploy's bundled dist; no live confirmation recorded in the source |
| Janus signaling (`apisecret`, `pin`, `id` field roles) | Ported from `roku-deploy@4.0.0-alpha.6`; no live confirmation recorded in the source |

## Used by

`apps/roku-dev-studio` (declared as a `file:` dependency) — main process only:

- `main/ipc/rce-handlers.ts` — RCE account/device IPC: management client, ECP, telnet over `connectRceSocket`, sideload/delete/verify, screenshot
- `main/ipc/rce-video-handlers.ts` — `RceVideoSignalingClient` behind the renderer's `RTCPeerConnection`
- `main/ipc/debugger-handlers.ts` — `createRceDebugSocketFactory` for the BrightScript debugger
- `main/ipc/relay-handlers.ts` and `main/sideload-relay/fanout.ts` — Sideload Relay targets on RCE devices
- `main/ipc/bs-fiddle-handlers.ts`, `main/ipc/demo-app-handlers.ts` — Fiddle / Try Demo App sideloads
- `main/rce-device-registry.ts` — `RceManagementClient` device registry
- `main/mcp-bridge.ts` — `RceEcpClient` + `rceCaptureScreenshot` for MCP tools

## License

Released under the [MIT License](../../LICENSE).

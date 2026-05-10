# `roku-dev-studio-api`

Node.js package for Roku **discovery** (SSDP / subnet scan), **ECP** (keypress, launch, query, …), **device info**, **developer sideload**, and **screenshots**. Used by **Roku Dev Studio** (Electron main process) and **`roku-dev-studio-remote-server`**.

| Mode | When to use |
|------|-------------|
| **Direct** | This process is on the same LAN as the Roku (or has route to it). You call functions with the device **IPv4**. |
| **Relay** | The Roku is only reachable via **Roku Dev Studio Remote Server**. Use **`createRelayClient({ baseUrl })`**; the relay talks to the device on its network. |

**Requirements**

- **Node.js** ≥ 14  
- **curl** on `PATH` for `captureRokuScreenshot`, `sideloadChannel`, and `deleteSideload` (direct mode only; relay runs these on the server host).

**Install**

```bash
npm install roku-dev-studio-api
```

In this monorepo the desktop app (`apps/roku-dev-studio`) depends on `file:../../packages/roku-dev-studio-api`; the relay server uses `file:../roku-dev-studio-api` from `packages/roku-dev-studio-remote-server/`.

**Runnable examples** (after `npm install` at repo root, or with the package installed):

```bash
# Direct LAN — optional IP; otherwise SSDP discovery (~5s)
node packages/roku-dev-studio-api/examples/direct-sample.js
node packages/roku-dev-studio-api/examples/direct-sample.js 192.168.1.10

# From package folder
npm run example:direct -w roku-dev-studio-api
npm run example:direct -w roku-dev-studio-api -- 192.168.1.10

# Relay — remote server URL + Roku IP as seen by the relay
node packages/roku-dev-studio-api/examples/relay-sample.js http://relay-host:4951 192.168.1.10
npm run example:relay -w roku-dev-studio-api -- http://localhost:4951 192.168.1.10
```

---

## CLI (`rds`)

The package installs a terminal command **`rds`** (**R**oku **D**ev **S**tudio).

**Global options** (before the subcommand): `--ip <ipv4>`, `--relay <url>`, `--password <pwd>` (or **`ROKU_DEV_PASSWORD`**), `--json`, `--quiet`, `--timeout <ms>`.

```bash
# From monorepo root (after npm install)
npm exec -w roku-dev-studio-api -- rds --help

# Examples (direct — device on LAN)
rds discover
rds device info --ip 192.168.1.10
rds ecp query /query/media-player --ip 192.168.1.10
rds keypress Home --ip 192.168.1.10
rds launch dev --ip 192.168.1.10
rds ecp query /query/apps --ip 192.168.1.10
export ROKU_DEV_PASSWORD='your-dev-password'
rds sideload ./out/channel.zip --ip 192.168.1.10
rds screenshot ./screen.jpg --ip 192.168.1.10
rds screenshot --inline --ip 192.168.1.10
rds screenshot --preview --ip 192.168.1.10
rds screenshot ./screen.jpg --inline --inline-width 70% --ip 192.168.1.10
rds sideload delete --ip 192.168.1.10

# Action Scripts (same JSON as Roku Dev Studio → Action Scripts)
rds script validate ./my-flow.json
rds script run ./my-flow.json --ip 192.168.1.10
rds script run ./my-flow.json --ip 192.168.1.10 --screenshot-dir ./out-shots

# App Connector (RALE) — default TCP port 49200 (same as Roku Dev Studio App Connector)
rds rale wake --ip 192.168.1.10
rds rale run getNodeById --args '{"path":[],"id":"root"}' --ip 192.168.1.10
rds rale repl --ip 192.168.1.10
# repl: type JSON lines, e.g. {"command":"getNodeById","args":{"path":[],"id":"root"}} then exit or Ctrl+D

# App Connector — list functions from the running dev channel (GetExternalControlFunctions)
rds appconnector connect --ip 192.168.1.10
rds app-connector connect --ip 192.168.1.10 --json

# Relay — stateful RALE on server (connect / send / disconnect)
rds rale connect --relay http://relay:4951 --ip 10.0.0.50
rds rale send getNodeById --connection-id "10.0.0.50:49200" --args '{"path":[],"id":"root"}' --relay http://relay:4951 --ip 10.0.0.50
rds rale disconnect --connection-id "10.0.0.50:49200" --relay http://relay:4951 --ip 10.0.0.50

# Relay (same commands; add --relay and device --ip as seen by relay)
rds device info --relay http://relay-host:4951 --ip 10.0.0.50
```

**Notes**

- **`launch`:** App ids come from the device (`rds ecp query /query/apps --ip …`). The sideloaded **developer** channel is almost always id **`dev`**, not `12` (404 means that id is not installed).
- **`input-text`:** Sends each character as a **`Lit_` keypress** (same as RDS Tool “Send Text”), not `POST /input`. A **text field or on-screen keyboard** must have focus. Optional **`--key-delay <ms>`** (default 100) if keys are dropped.
- **`screenshot --inline`:** On **iTerm 2 / WezTerm / Kitty**, draws the image in the terminal (OSC 1337). On **Cursor, VS Code, Terminal.app**, nothing would render, so **`rds` opens Preview (macOS) / the default viewer** instead when stdout is a TTY. Set **`RDS_INLINE_NO_PREVIEW=1`** to skip that auto-open. Set **`RDS_FORCE_INLINE=1`** to force sending OSC even on unknown terminals.
- **`screenshot --preview`:** Always open the JPEG in the default app (uses a temp file if you omit `[outfile]`). **Temp files are not auto-deleted** (Preview may still need the path); use an explicit `[outfile]` if you want to control cleanup yourself.
- **`--json`** disables inline OSC and `--preview`.
- **Direct** sideload / screenshot / `sideload delete` need **`curl`** on `PATH` (see Requirements).
- **`rds ecp post`** with **`--body`** is **direct only** (relay POST has no body in this CLI).
- **`rds script run`:** Runs **query, post, keypress, inputText, launch, sideload, deleteSideload, screenshot, wait** (fixed delay or **media-player** polling). **`wait`** with **`rale-node-field`** is **not** supported in `rds` (use the desktop app). Steps that need RALE (**`appFunction`**, **`raleCommand`**) **wake + connect once** then disconnect; default **`--rale-port`** is **49200** (override if your channel uses another port, e.g. **8089**).
- **`rds rale`:** **`run`** is **one-shot** (direct or relay). **`repl`** keeps one TCP session in **this** terminal (direct or relay) — use that for multiple commands on LAN. **`connect` / `send` / `disconnect`** are **relay-only** (socket lives on the server). On direct LAN, **`rale connect`** alone cannot work across two separate `rds` invocations.
- **`rds appconnector connect`** (alias **`app-connector`**) runs **`getExternalControlFunctions`** and prints **`name(params…)`** per line (or **`--json`**). Your channel must implement **`GetExternalControlFunctions`** (same as App Connector in Dev Studio). Default **`--rale-port`** is **49200**.
- Exit code **0** on success, **1** on failed operations, **2** on bad usage / validation.

---

## Public API reference

All exports are available from the package root: `require('roku-dev-studio-api')`.

### Shared defaults (`lib/shared-constants.js`)

One set of values for the **npm package**, **`rds` CLI**, **remote relay server**, and **Roku Dev Studio (Electron)**: **`DEFAULT_RALE_PORT`**, **`QUERY_TIMEOUT`**, **`TELNET_TIMEOUT`** / **`DEFAULT_TELNET_CONNECT_TIMEOUT_MS`**, **`SCREENSHOT_DEBOUNCE_DELAY`**, **`SCREENSHOT_AFTER_LAUNCH_DELAY`**, **`CONNECTION_CHECK_INTERVAL`**, **`TOAST_DISPLAY_DURATION`**, **`STATUS_MESSAGE_DURATION`**. The desktop renderer reads them via preload as **`window.rdsSharedConstants`**.

### Action scripts & RALE (programmatic)

| Export | Notes |
|--------|--------|
| `runActionScript(script, options)` | Run Action Script JSON (same shape as Dev Studio). See `lib/script-runner.js` for `options`. |
| `validateScriptStructure(script)` | **Sentence-form** offline validation; `{ valid, errors[] }`. Thin adapter over the canonical validator. |
| `validateActionScript(script, opts?)` | **Canonical** validator: `{ ok, errors[], stepCounts }` with structured `{ path, code, expected[]?, stepIndex? }` errors. Used by every surface (MCP `validate_script`, the renderer Builder per-row hints, the `rds script validate` CLI). See `.discussion-docs/unified-action-script-validation.md` for the rule matrix. |
| `raleWake`, `raleConnect`, `raleCommand`, `raleDisconnect`, `raleDisconnectAll`, `raleConnectionStatus` | Direct TCP RALE on LAN (same protocol as the relay server). Default port **`DEFAULT_RALE_PORT`** (shared-constants). |
| `normalizeRaleFunctions(raw)` | Normalize `getExternalControlFunctions` entries to `{ name, params, description? }[]` (description preserved verbatim from the channel payload when present). |
| `parseGetExternalControlFunctionsResponse(raleResult)` | Parse `raleCommand` result object into `{ ok, functions?, error?, raw? }`. |

### Action Script JSON shape

Authoring contract lives in two places:

- **Canonical validator rules:** `lib/validate-action-script.ts` (rule logic) + `test/validate-action-script.test.ts` (51-case fixture covering every required / optional field, condition source, version gate, and password-handling rule).
- **Agent-readable contract:** `roku-dev-studio://action-script-contract.md` exposed by the MCP server (`packages/roku-dev-studio-mcp/src/prose/action-script-contract.md`) — includes worked templates for `appFunction.functionParams`, `wait` / `if` conditions (`media-player`, `active-app`, `rale-node-field`, `variables`), and the password-resolution order.

The same JSON runs in three places: the desktop **Action Scripts → Builder + Executor**, the **MCP** server's `validate_script` + `send_script_to_builder` flow, and `rds script validate` / `rds script run`.

### Catalogs (`lib/catalogs.js`)

Pure data — no I/O, safe to import anywhere. Every consumer in this repo (validator, renderer Builder, MCP capability bundle, `rds` CLI) reads these instead of duplicating constants:

| Export | What it is |
|--------|-----------|
| `STEP_SCHEMA` | Action Script step types → `{ required, optional, label, description }`. Drives validation + the Builder picker + the MCP capability bundle. |
| `SCRIPT_VERSIONS` | Accepted `version` strings (`'1'`, `'2'`). v2 unlocks variables + `if` step. |
| `KEYPRESS_GROUPS`, `KEYPRESS_OPTIONS` | Grouped UI presets and the flat allowed-key list (validator). |
| `QUERY_PRESETS`, `POST_PRESETS` | Pre-populated ECP GET / POST endpoints (Builder picker; same set the Query tab uses). |
| `SYSTEM_TELNET_PRESETS` | Dev telnet (`8080`) presets — `plugins`, `free`. |
| `WAIT_SOURCES`, `IF_SOURCES` | Allowed `condition.source` values for `wait` and `if` steps. |
| `MEDIA_PLAYER_STATES` | Accepted media-player states for `media-player` conditions. |
| `ACTIVE_APP_IF_ATTRIBUTES` | Attributes you can compare in an `active-app` `if` condition. |
| `NODE_FIELD_OPERATOR_DEFS` | RALE node-field operators (`equals`, `contains`, `matches`, `hasAnyValue`, …) with `requiresValue` flag. |
| `DEVICE_PERFORMANCE_CHART_IDS` | Chart ids accepted by the `devicePerformance` step. |
| `RALE_BUILTINS` | Built-in RALE commands the Inspector / Builder expose (`getNodeById`, registry CRUD, …). |
| `RALE_READ_ONLY_COMMANDS` | Subset of `RALE_BUILTINS` that don't mutate device state. |
| `AUTHORING_RULES` | Hard rules the agent must obey when generating scripts (version, password handling, wait vs delay, …). |
| `SAVE_ACTION_TYPES`, `PASSWORD_STEP_TYPES` | Which step types write artifacts / require a dev password. |

### Operations registry (`lib/operations.js`)

The transport-agnostic op catalog. Every Roku side-effecting action is described once here; the Electron main process, the MCP bridge, and the `rds` CLI mount the same descriptors through thin adapters (so a new op is a one-file change). The MCP package's `OP_BACKED_TOOLS` is auto-generated from `ALL_OPS`.

| Export | Notes |
|--------|--------|
| `ALL_OPS` | All op descriptors: `{ id, title, description, runIn, destructive, inputSchema, run, … }`. |
| `MAIN_OPS`, `RENDERER_OPS` | Subsets keyed by where the op runs. |
| `findOp(id)` | Lookup by id. |
| `runOp(op, args, ctx)` | Execute an op programmatically. |
| `runOpForHttp(op, body)` | HTTP-friendly wrapper used by the Dev Studio bridge and the relay server. |
| `opToMcpTool(op)` | Adapter that turns a descriptor into an MCP tool entry. |

### Errors

| Export | Notes |
|--------|--------|
| `RokuOpError` | Structured error class with `code` (taxonomy) and `details`. |
| `ROKU_OP_ERROR_CODES` | The taxonomy itself. |
| `toRokuOpError(err)` | Coerce arbitrary errors into the taxonomy. |

### Telnet

| Export | Notes |
|--------|--------|
| `connectRokuDebugTelnet(ip, opts?)` | Open the BrightScript debug stream on `ROKU_DEBUG_TELNET_PORT` (`8085`). |
| `connectRokuSystemTelnet(ip, opts?)` | Open the dev system command stream on `ROKU_SYSTEM_TELNET_PORT` (`8080`). |
| `writeRokuTelnetLine(socket, line)` | Send a system command line. |
| `ROKU_DEBUG_TELNET_PORT`, `ROKU_SYSTEM_TELNET_PORT`, `DEFAULT_TELNET_CONNECT_TIMEOUT_MS` | Defaults. |

### Device identity

| Export | Notes |
|--------|--------|
| `parseDeviceRef(input)` | Normalize an IP or serial string into a structured ref. |
| `deviceMatches(device, ref)` | Equality on either IP or serial. |
| `findDevice(devices, ref)`, `resolveDevice(devices, ref)` | Resolve a device from a list. |

### BrightScript Fiddle scaffold

| Export | Notes |
|--------|--------|
| `buildFiddleZip(userCode)` | Wraps a BrightScript snippet into a sideload-ready zip using the `roku-components/fiddle/` scaffold. The desktop app uses this for the Fiddle window's *Run*. |
| `userCodeDefinesInit(code)` | Detects whether the user already wrote an `init()` so the wrapper doesn't double-define it. |

### Response shapes (ECP helpers)

Most ECP calls resolve to an object:

- **Success:** `{ success: true, data?: string, status: number }` — `keypress` / `launch` / `inputText` / `deeplink` may omit `data`.
- **Failure:** `{ success: false, error: string, statusCode?: number, authFailed?: boolean, data?: string }`

`testConnection(ip)` → `{ success: true, deviceInfo }` or `{ success: false, error }`.

`getIcon(ip, appId)` → `{ success: true, dataUrl, mimeType }` or `{ success: false, error, ... }`.

---

### Discovery

| API | Signature | Returns |
|-----|-----------|---------|
| `ssdpDiscover` | `(opts?)` | `Promise<Device[]>` |
| `subnetScan` | `(opts?)` | `Promise<Device[]>` |

**`opts` (optional):** `onDeviceFound(device)`, `log(msg)`, `timeout`, `earlyFinishMs`, `sendCount`, `sendInterval` (SSDP); `requestTimeout`, `concurrency` (subnet).

---

### Device info

| API | Signature | Notes |
|-----|-----------|--------|
| `getDeviceInfo` | `(ip, opts?)` | `opts`: `{ timeout?, includeSameSubnet? }` (default `timeout`: **QUERY_TIMEOUT** from `lib/shared-constants.js`, typically 10000 ms; default `includeSameSubnet: true`). Rejects on failure. |
| `parseDeviceInfo` | `(xml: string)` | Parses `/query/device-info` XML → plain object. |
| `getDeviceId` | `(deviceInfo)` | Stable id (serial) or `null` (caller may use IP). |
| `normalizeEcpSettingMode` | `(raw)` | `"Disabled"` \| `"Limited"` \| `"Permissive"` \| `"Enabled"`. |
| `isIpOnSameSubnet` | `(deviceIp)` | `boolean` — useful for ECP “Permissive” hints. |

---

### Validation

| API | Signature |
|-----|-----------|
| `isValidIp` | `(ip: string) => boolean` |
| `validateDevPassword` | `(password) => { valid: boolean, error?: string }` |

---

### ECP (direct to Roku `ip:8060`)

| API | Signature |
|-----|-----------|
| `keypress` | `(ip, key, opts?)` — `opts`: `{ timeout?, port? }` (default timeout 3000 ms). |
| `launch` | `(ip, appId, params?, opts?)` — `params` is a query string (e.g. `"contentID=123"`). |
| `query` | `(ip, endpoint, opts?)` — e.g. `"/query/apps"`. Default timeout **QUERY_TIMEOUT** (see `lib/shared-constants.js`). |
| `post` | `(ip, endpoint, opts?)` — POST to ECP path (e.g. `"/sgrendezvous/..."`). |
| `inputText` | `(ip, text, opts?)` |
| `deeplink` | `(ip, appId, contentId?, mediaType?, opts?)` |
| `testConnection` | `(ip, opts?)` — uses `getDeviceInfo`; returns `{ success, deviceInfo? }`. |
| `getIcon` | `(ip, appId, opts?)` |
| `ecpRequest` | `(ip, { path, method?, body?, headers?, timeout? }, opts?)` — low-level; same success/error rules. |
| `ecpErrorFromStatus` | `(statusCode) => { error, authFailed? }` — maps HTTP status to message. |

---

### Screenshot & sideload (direct — uses curl)

| API | Signature |
|-----|-----------|
| `captureRokuScreenshot` | `({ ip, password, exec?, waitAfterTriggerMs?, retryWaitMs?, maxRetries?, minValidBytes?, log? })` |
| `sideloadChannel` | `({ ip, filePath, password, log? })` |
| `deleteSideload` | `({ ip, password, log? })` |

---

### Relay client

| API | Notes |
|-----|--------|
| `validateRelayBaseUrl` | `(baseUrl) => string` — throws if invalid; strips trailing `/`. |
| `createRelayClient` | `({ baseUrl, timeout?, uploadTimeout? })` → client object (default `timeout` 10 s, `uploadTimeout` 180 s). |

**Client methods** (first argument is always **`deviceIp`** as seen from the relay’s network):

| Method | Arguments | Notes |
|--------|-----------|--------|
| `discover()` | — | `Promise<Device[]>` from `GET /devices`. |
| `getDeviceInfo(deviceIp)` | — | Returns parsed `deviceInfo`; throws on error. |
| `keypress(deviceIp, key)` | | |
| `launch(deviceIp, appId, launchOpts?)` | | `launchOpts` can be `{ params: string }` or a string (treated as `params`). |
| `query(deviceIp, endpoint)` | | e.g. `"/query/apps"`. |
| `post(deviceIp, endpoint)` | | ECP path after `/post`, e.g. `"/sgrendezvous/..."` → relay `POST .../post/sgrendezvous/...`. |
| `inputText(deviceIp, text)` | | |
| `deeplink(deviceIp, appId, contentId?, mediaType?)` | | |
| `getIcon(deviceIp, appId)` | | |
| `deleteSideload(deviceIp, password)` | | |
| `screenshot(deviceIp, { password, waitAfterTriggerMs? })` | | Relay returns JSON; success often includes **`url`** (`data:image/...;base64,...`). |
| `sideload(deviceIp, { file?, filePath?, password, fileName? })` | | **`file`** (Buffer or local path string) → multipart upload to relay. Falls back to JSON with **`filePath`** on relay host when `file` is omitted. `fileName` is optional (derived from path or defaults to `"package.zip"`). Uses `uploadTimeout`. |
| `raleWake(deviceIp, port?)` | | Default port **49200**. |
| `raleConnect(deviceIp, port?)` | | Returns `{ success, connectionId }`; socket stays on relay host. |
| `raleCommand(deviceIp, { connectionId, command, args })` | | Long timeout (up to 120 s). |
| `raleDisconnect(deviceIp, { connectionId })` | | |

Relay responses are JSON bodies from the server (same `success` / `error` patterns as direct where applicable). Successful **screenshot** responses from the relay typically include a **`url`** field (`data:image/jpeg;base64,...`).

---

## Examples — Direct

```javascript
const {
  ssdpDiscover,
  getDeviceInfo,
  keypress,
  launch,
  query,
  testConnection,
  sideloadChannel,
  captureRokuScreenshot,
  isValidIp,
} = require('roku-dev-studio-api');

async function directExample() {
  const devices = await ssdpDiscover({ log: console.log });
  const ip = devices[0]?.ip;
  if (!ip || !isValidIp(ip)) return;

  const info = await getDeviceInfo(ip);
  console.log(info.deviceName, info.serialNumber);

  const conn = await testConnection(ip);
  if (!conn.success) {
    console.error(conn.error);
    return;
  }

  let r = await keypress(ip, 'Home');
  if (!r.success) console.error(r.error, r.authFailed);

  r = await launch(ip, '12', 'contentID=123&mediaType=movie');
  const apps = await query(ip, '/query/apps');
  if (apps.success) console.log(apps.data);

  const shot = await captureRokuScreenshot({
    ip,
    password: 'your-dev-password',
    log: console.log,
  });
  if (shot.success) {
    require('fs').writeFileSync('capture.jpg', shot.imageBuffer);
  }

  await sideloadChannel({
    ip,
    filePath: '/absolute/path/to/channel.zip',
    password: 'your-dev-password',
  });
}

directExample().catch(console.error);
```

---

## Examples — Relay

```javascript
const { createRelayClient } = require('roku-dev-studio-api');

async function relayExample() {
  const relay = createRelayClient({
    baseUrl: 'http://my-mac-mini.local:4951',
    timeout: 15000,
  });

  const devices = await relay.discover();
  const deviceIp = devices[0]?.ip;
  if (!deviceIp) return;

  const info = await relay.getDeviceInfo(deviceIp);
  console.log(info.deviceName);

  let r = await relay.keypress(deviceIp, 'Home');
  if (!r.success) console.error(r.error, r.authFailed);

  r = await relay.launch(deviceIp, '12', { params: 'contentID=123' });
  const apps = await relay.query(deviceIp, '/query/apps');

  r = await relay.deeplink(deviceIp, '12', 'some-id', 'movie');
  r = await relay.inputText(deviceIp, 'hello');

  const icon = await relay.getIcon(deviceIp, '12');
  if (icon.success) console.log(icon.dataUrl?.slice(0, 50) + '…');

  const shot = await relay.screenshot(deviceIp, {
    password: 'your-dev-password',
    waitAfterTriggerMs: 2000,
  });
  if (shot.success && shot.url) {
    // e.g. data:image/jpeg;base64,...
  }

  await relay.deleteSideload(deviceIp, 'your-dev-password');

  // Upload a local file to the relay (multipart) — file can be a path or a Buffer:
  await relay.sideload(deviceIp, {
    file: '/local/path/to/channel.zip',
    password: 'your-dev-password',
  });

  // Or upload an in-memory Buffer:
  const zipBuf = require('fs').readFileSync('/local/path/to/channel.zip');
  await relay.sideload(deviceIp, {
    file: zipBuf,
    password: 'your-dev-password',
    fileName: 'channel.zip',   // optional; defaults to "package.zip"
  });

  // Path already on the relay host (JSON body, no upload):
  await relay.sideload(deviceIp, {
    filePath: '/path/on/relay/host/pkg.zip',
    password: 'your-dev-password',
  });
}

relayExample().catch(console.error);
```

---

**When you change this package** (add/remove/rename exports, change signatures or behavior): update **this `README.md`** in the same change so the public API and examples stay accurate.

---

## License

Released under the [MIT License](../../LICENSE).

**Third-party runtime dependencies:**

| Library | Purpose | Licence |
|---------|---------|---------|
| [archiver](https://github.com/archiverjs/node-archiver) | Building sideload `.zip` packages | [MIT](https://opensource.org/licenses/MIT) |
| [commander](https://github.com/tj/commander.js) | `rds` CLI argument parsing | [MIT](https://opensource.org/licenses/MIT) |

# Roku Dev Studio API — Target Design & Usage

## 1. Supported programming languages

### The npm package (`roku-dev-studio-api`)

| Language / runtime | Support | How |
|--------------------|--------|-----|
| **JavaScript (Node.js)** | ✅ Native | `require('roku-dev-studio-api')` or `import ... from 'roku-dev-studio-api'`. Primary target. |
| **TypeScript** | ✅ Via types | Use from Node or ts-node; add optional `.d.ts` for the package. |
| **Other languages** | ❌ Not directly | The package is Node.js-only. No native bindings for Python, Go, C#, etc. |

### Using the Remote Relay Server (HTTP API)

Any language that can send HTTP requests can control Roku devices through the relay:

| Language | Support | How |
|----------|--------|-----|
| **Any** | ✅ | Call the relay’s REST API: `GET/POST http://relay-host:4951/device/:ip/...` (see relay docs). Use `fetch`, `axios`, `requests`, `HttpClient`, `curl`, etc. |
| **JavaScript/Node** | ✅ | Use the package’s **relay client** (same API surface as direct; transport is HTTP to relay). |

**Summary**

- **Package:** Node.js / JavaScript (and TypeScript with types).
- **Relay HTTP API:** Any language; use the relay’s URLs and JSON request/response format.
- **Relay + package:** From Node, use the package in “relay mode” so you get one API for both local and remote devices.

---

## 2. Target design

### 2.1 Package name and layout

- **Name:** `roku-dev-studio-api`
- **Layout:** Monorepo under `packages/roku-dev-studio-api/`:
  - `package.json`, `index.js`, `ecp.js`
  - `lib/` — discovery, device-info, validate-input, screenshot, plugin-install

### 2.2 Public API surface

All return shapes are consistent (see 2.4).

| Category | Methods | Notes |
|----------|---------|--------|
| **Discovery** | `ssdpDiscover(opts?)`, `subnetScan(opts?)` | Returns `Promise<Device[]>`; optional `onDeviceFound`, `log`, timeouts. |
| **Device info** | `getDeviceInfo(ip, opts?)`, `parseDeviceInfo(xml)`, `getDeviceId(info)`, `isIpOnSameSubnet(ip)`, `normalizeEcpSettingMode(raw)` | |
| **ECP** | `keypress(ip, key, opts?)`, `launch(ip, appId, params?, opts?)`, `query(ip, endpoint, opts?)`, `post(ip, endpoint, opts?)`, `inputText(ip, text, opts?)`, `deeplink(ip, appId, contentId?, mediaType?, opts?)`, `testConnection(ip, opts?)`, `getIcon(ip, appId, opts?)` | Optional `opts: { timeout?, port? }` (default port 8060). |
| **Sideload** | `sideloadChannel({ ip, filePath, password, log? })`, `deleteSideload({ ip, password, log? })` | Requires `curl` on the system. |
| **Screenshot** | `captureRokuScreenshot({ ip, password, ...opts })` | Requires `curl`; returns `{ success, imageBuffer? }`. |
| **Validation** | `isValidIp(ip)`, `validateDevPassword(password)` | Utilities. |
| **Relay client** | `createRelayClient({ baseUrl })` → client with same method names, taking `deviceIp` as first arg where applicable; `discover()` calls GET `/devices`. | Optional; uses relay’s existing REST routes. |

### 2.3 Transport modes

| Mode | When | How |
|------|------|-----|
| **Direct** | Node process can reach the Roku (same LAN or VPN). | Call package methods with device `ip`; package uses `http.request` to `ip:8060`. |
| **Relay** | Roku is only reachable via the Remote Relay Server. | Use `createRelayClient({ baseUrl: 'http://relay-host:4951' })`; client sends HTTP to relay; relay uses the same package to talk to the Roku. |

### 2.4 Response shapes (canonical)

**ECP / keypress / launch / query / post / inputText / deeplink**

- Success: `{ success: true, data?: string, status: number }` (keypress/launch may omit `data`).
- Error: `{ success: false, error: string, statusCode?: number, authFailed?: boolean, data?: string }`.

**testConnection**

- Success: `{ success: true, deviceInfo: object }`.
- Error: `{ success: false, error: string }`.

**getIcon**

- Success: `{ success: true, dataUrl: string, mimeType?: string }`.
- Error: `{ success: false, error: string }`.

**Discovery**

- `Promise<Device[]>`; each device: `{ ip, port, deviceName?, serialNumber?, ...parsed device-info }`.

**Sideload / deleteSideload / captureRokuScreenshot**

- Existing shapes kept; success includes `message` or `imageBuffer` as today.

### 2.5 Dependencies and environment

- **Runtime:** Node.js ≥ 14.
- **Dependencies:** None required for discovery, device-info, ECP, validation. Screenshot and sideload use `child_process.exec('curl ...')` — **curl must be installed** on the system.
- **path-safe:** Stays in the app repo; not part of the package. Callers (app, relay) are responsible for safe paths when calling `sideloadChannel`.

### 2.6 Remote server alignment

- Relay server uses the package for discovery, device-info parsing, ECP, sideload, screenshot (and validation).
- Relay returns the **same** response shapes as the package (so 4xx/5xx from Roku become `success: false` with `error` and `authFailed` when appropriate).
- Relay client in the package mirrors the relay’s REST routes so that “relay mode” is a drop-in transport.

### 2.7 Remote server package name

- The **published npm package name** for the relay server is **`roku-dev-studio-remote-server`** (for consistency with `roku-dev-studio-api` and the Roku Dev Studio app).
- The **directory** in the repo is **`packages/roku-dev-studio-remote-server/`** (npm workspace under `packages/*`).

---

## 3. How existing things will change

When the package is introduced (monorepo SDK approach), the following changes apply. **No change** to the renderer (UI) or to the relay’s HTTP contract; only where the logic lives and how the app/relay call it.

### 3.1 What gets added

| Item | Location | Purpose |
|------|----------|---------|
| **New package** | `packages/roku-dev-studio-api/` | Single implementation: discovery, device-info, ECP, sideload, screenshot, validation, relay client. |
| **Workspace dependency** | `apps/roku-dev-studio/package.json`, `packages/roku-dev-studio-remote-server/package.json` | App: `file:../../packages/roku-dev-studio-api`. Relay: `file:../roku-dev-studio-api`. Root lists `workspaces`: `packages/*`, `apps/*`. |

### 3.2 What gets removed or moved

| Current | After |
|---------|--------|
| `lib/roku-discovery.js` | Logic lives in `packages/roku-dev-studio-api`; file can be removed from repo or kept as a re-export from the package during migration. |
| `lib/roku-device-info.js` | Same — moved into package. |
| `lib/validate-input.js` | Same — moved into package. |
| `lib/roku-screenshot.js` | Same — moved into package. |
| `lib/roku-plugin-install.js` | Same — moved into package. |
| Inline ECP logic in `main/ipc/roku-commands.js` | Replaced by calls to the package’s ECP methods (keypress, launch, query, etc.). |
| **Unchanged** | `lib/path-safe.js` stays in the repo (used by app and remote-server for safe paths; not part of the package). |

### 3.3 What gets modified

| File / area | Change |
|-------------|--------|
| **Root `package.json`** | Add `"workspaces": ["packages/*"]` (if using npm workspaces) and ensure app depends on `roku-dev-studio-api`. |
| **Main process (`main.js`)** | Replace `require('./lib/roku-device-info.js')` with `require('roku-dev-studio-api')` for `getDeviceInfo` / `getDeviceId` (or get them from the package and pass to IPC setup as today). |
| **`main/ipc/device-discovery.js`** | Replace `require('../../lib/roku-discovery.js')` with `require('roku-dev-studio-api')`; call `ssdpDiscover` / `subnetScan` from the package. |
| **`main/ipc/roku-commands.js`** | Remove inline `http.request` ECP code. For each IPC handler (`roku:keypress`, `roku:launch`, etc.), call the package’s corresponding method (e.g. `keypress(ip, key)`), then return the result to the renderer. Same response shape as today so the UI does not change. |
| **`main/ipc/dev-app-handlers.js`** | Replace `require('../../lib/roku-screenshot.js')` and `require('../../lib/roku-plugin-install.js')` with `require('roku-dev-studio-api')`; call `captureRokuScreenshot`, `sideloadChannel`, `deleteSideload` from the package. |
| **`packages/roku-dev-studio-remote-server/roku-remote-server.js`** | Uses `require('roku-dev-studio-api')` for Roku logic and `require('../../lib/path-safe.js')` for safe paths (repo-root `lib/`). |
| **Renderer** | No code changes. It still uses IPC (`invoke('roku:keypress', { ip, key })`) and the same JSON shapes. |

### 3.4 Summary of change scope

- **New:** 1 package directory (`packages/roku-dev-studio-api/`) and workspace wiring.
- **Modified:** Root workspace `package.json`, `apps/roku-dev-studio/` (main, IPC, scripts), `packages/roku-dev-studio-remote-server/roku-remote-server.js`.
- **Removed (from repo root):** The five Roku lib files in `lib/` (or re-exported from package once then removed).
- **Unchanged:** Renderer, preload, path-safe.js, remote-server’s HTTP routes and port, and the relay’s external HTTP API contract.

---

## 4. How the App connects with the API

The **Roku Dev Studio desktop app** is an Electron app. Only the **main process** talks to the API package; the renderer (UI) does not.

### 4.1 Dependency

- The **app** (`apps/roku-dev-studio/package.json`) depends on `roku-dev-studio-api` via `file:../../packages/roku-dev-studio-api`.  
- After `npm install` at the **repo root**, the main process can `require('roku-dev-studio-api')`.

### 4.2 Where the app uses the API

- **Main process** (Node.js) runs on the user’s machine. It:
  - Requires the package once (e.g. in `main.js` or in each IPC handler module that needs it).
  - Calls the package’s functions **in-process** (same process as Electron main). There is no network hop to “the API”; the API is a local dependency.

| App need | How it connects |
|----------|------------------|
| Discovery | Main process calls `ssdpDiscover()` / `subnetScan()` from the package. IPC handler `roku:discover` / `roku:scan-subnet` invokes these and sends results to the renderer via `safeSendToRenderer('roku:device-found', device)`. |
| Device info / test connection | Main process calls `getDeviceInfo(ip)` or `testConnection(ip)` from the package. Used by IPC (e.g. `roku:test-connection`) and by other handlers that need device identity. |
| ECP (keypress, launch, query, etc.) | Main process calls `keypress(ip, key)`, `launch(ip, appId, params)`, `query(ip, endpoint)`, etc. from the package. Each IPC handler (e.g. `roku:keypress`) receives (ip, …) from the renderer, calls the package, and returns the package’s result (same shape as today) to the renderer. |
| Sideload / screenshot | Main process calls `sideloadChannel(...)` and `captureRokuScreenshot(...)` from the package. IPC handlers for Dev App use these; path safety for file paths is still enforced in the app using `lib/path-safe.js`. |

### 4.3 Data flow (direct / local devices)

```
[Renderer]  --IPC invoke('roku:keypress', { ip, key })-->  [Main process]
                                                                    |
                                                                    v
                                            require('roku-dev-studio-api').keypress(ip, key)
                                                                    |
                                                                    v
                                            [Package]  --http.request-->  [Roku device ip:8060]
                                                                    |
                                                                    v
[Renderer]  <--IPC return { success, error?, ... }--  [Main process]
```

- The app uses the API in **direct** mode only: the machine running the app must be on the same LAN as the Roku (or have route to it). The package talks directly to the Roku’s IP.

### 4.4 When the app uses a remote relay

- When the user configures a **Remote Relay Server**, the **renderer** (or main process) sends HTTP requests to the relay (e.g. `http://relay-host:4951/device/:ip/keypress/Home`), not to the package for that device.
- So: **local devices** → main process uses the **package** (direct). **Remote devices** → app uses **HTTP to the relay**; the relay server (on another machine) is the one that uses the package (see section 5).

---

## 5. How the Remote Server connects with the API

The **Remote Relay Server** runs on a **remote machine** (e.g. Mac Mini) that is on the same LAN as the Roku devices. It exposes an HTTP API so that the Roku Dev Studio app (or any client) can control those devices from elsewhere.

### 5.1 Dependency

- The remote server **depends on the same package** (`roku-dev-studio-api`).  
- If the server is in the same repo: use workspace dependency.  
- If the server is deployed separately: add `roku-dev-studio-api` as a normal dependency in `packages/roku-dev-studio-remote-server/package.json` (e.g. from npm or a tarball).  
- On the remote machine, `npm install` (or equivalent) installs the package; the server process `require('roku-dev-studio-api')` at runtime.

### 5.2 Where the server uses the API

- The server process runs on the **remote machine**. It uses the package **in-process** (same process as the HTTP server). There is no “connection” to the API over the network; the API is a local Node dependency on that machine.

| Server need | How it connects |
|-------------|------------------|
| Discovery | When a client calls `GET /devices`, the server calls `ssdpDiscover()` / `subnetScan()` from the package (on the remote machine’s network), then caches and returns the list. |
| Device info | For `GET /device/:ip/info` or internal use, the server calls `getDeviceInfo(ip)` or uses `parseDeviceInfo(xml)` from the package after fetching `/query/device-info`. |
| ECP (keypress, launch, query, post, input-text, deeplink, icon) | The server replaces its current `rokuRequest` and inline HTTP with calls to the package’s ECP methods (`keypress(ip, key)`, `launch(ip, appId, params)`, `query(ip, endpoint)`, etc.). It then returns the package’s response shape in the HTTP response body. |
| Sideload / delete / screenshot | The server already receives multipart or JSON; it resolves the file path (using `path-safe` under its temp dir), then calls `sideloadChannel({ ip, filePath, password })`, `deleteSideload({ ip, password })`, `captureRokuScreenshot({ ip, password })` from the package. |
| Validation | The server uses `isValidIp(ip)` from the package before any `/device/:ip/...` handler. |

### 5.3 Data flow (relay)

```
[Client: App or script]  --HTTP POST /device/192.168.1.5/keypress/Home-->  [Remote Server :4951]
                                                                                        |
                                                                                        v
                                                                        require('roku-dev-studio-api').keypress('192.168.1.5', 'Home')
                                                                                        |
                                                                                        v
                                                                        [Package on remote machine]  --http.request-->  [Roku 192.168.1.5:8060]
                                                                                        |
                                                                                        v
[Client]  <--HTTP 200 JSON { success, error?, ... }--  [Remote Server]
```

- The package runs **only on the remote machine**. The client never loads the package; the client only talks HTTP to the relay. The relay uses the package to talk to the Roku on its local network.

### 5.4 Summary

| Question | Answer |
|----------|--------|
| Does the Remote Server “connect” to the API over the network? | No. It **requires** the package as a dependency and calls it in the same process. |
| Where does the package run for relay? | On the **remote machine** where the relay server runs (same process as the server). |
| How does the app “connect” to the API for local devices? | The app’s main process **requires** the package and calls it in-process (direct to Roku). |
| How does the app control devices behind the relay? | The app sends **HTTP** to the relay’s base URL; the relay server uses the package to control the Roku. |

---

## 6. Usage examples

### 6.1 Local (direct) — Node.js

Assume the Roku is on the same network as the machine running Node.

```javascript
const {
  ssdpDiscover,
  getDeviceInfo,
  keypress,
  launch,
  query,
  inputText,
  testConnection,
  getIcon,
  sideloadChannel,
  deleteSideload,
  captureRokuScreenshot,
  isValidIp,
} = require('roku-dev-studio-api');

async function main() {
  // ---- Discovery ----
  const devices = await ssdpDiscover({
    timeout: 6000,
    log: (msg) => console.log(msg),
  });
  console.log('Found devices:', devices.length);
  const device = devices[0];
  if (!device) return;
  const ip = device.ip;

  // ---- Device info ----
  const info = await getDeviceInfo(ip);
  console.log('Device:', info.deviceName, info.modelName, info.serialNumber);

  // ---- Test connection ----
  const test = await testConnection(ip);
  if (!test.success) {
    console.error('Connection failed:', test.error);
    return;
  }

  // ---- ECP: keypress ----
  let result = await keypress(ip, 'Home');
  if (!result.success) {
    console.error('Keypress failed:', result.error, result.authFailed ? '(check dev mode)' : '');
    return;
  }

  // ---- ECP: launch app ----
  result = await launch(ip, '12', { params: 'contentID=123&mediaType=movie' });
  if (!result.success) console.error('Launch failed:', result.error);

  // ---- ECP: query ----
  const apps = await query(ip, '/query/apps');
  if (apps.success && apps.data) console.log('Apps:', apps.data);

  // ---- ECP: input text ----
  result = await inputText(ip, 'Hello Roku');
  if (!result.success) console.error('Input failed:', result.error);

  // ---- Optional: custom timeout/port ----
  result = await keypress(ip, 'Back', { timeout: 5000, port: 8060 });

  // ---- Sideload (requires curl + developer password) ----
  const sideloadResult = await sideloadChannel({
    ip,
    filePath: '/path/to/channel.zip',
    password: 'your-dev-password',
    log: (msg) => console.log(msg),
  });
  if (sideloadResult.success) console.log(sideloadResult.message);
  else console.error(sideloadResult.error);

  // ---- Screenshot (requires curl + developer password) ----
  const shot = await captureRokuScreenshot({
    ip,
    password: 'your-dev-password',
    log: (msg) => console.log(msg),
  });
  if (shot.success) {
    require('fs').writeFileSync('roku-screenshot.jpg', shot.imageBuffer);
    console.log('Saved roku-screenshot.jpg');
  } else console.error(shot.error);
}

main().catch((e) => console.error(e));
```

### 6.2 Local (direct) — ES modules

```javascript
import {
  ssdpDiscover,
  getDeviceInfo,
  keypress,
  launch,
  createRelayClient,
} from 'roku-dev-studio-api';

const devices = await ssdpDiscover();
const ip = devices[0]?.ip;
if (ip) {
  await keypress(ip, 'Home');
  await launch(ip, ' Netflix');
}
```

### 6.3 Relay — Node.js (using the package relay client)

Use when the Roku is not on your network but is reachable by the Remote Relay Server.

```javascript
const { createRelayClient } = require('roku-dev-studio-api');

const relay = createRelayClient({
  baseUrl: 'http://my-mac-mini.local:4951',
  // optional: timeout for all requests
  timeout: 10000,
});

async function main() {
  // Discovery: GET /devices on the relay
  const devices = await relay.discover();
  if (!devices.length) {
    console.log('No devices from relay');
    return;
  }
  const deviceIp = devices[0].ip; // IP as seen from the relay's network

  // Same API shape as direct
  let result = await relay.keypress(deviceIp, 'Home');
  if (!result.success) {
    console.error(result.error, result.authFailed ? '(auth failed)' : '');
    return;
  }

  result = await relay.launch(deviceIp, '12', { params: 'contentID=123' });
  if (!result.success) console.error(result.error);

  const apps = await relay.query(deviceIp, '/query/apps');
  if (apps.success) console.log('Apps:', apps.data);

  const info = await relay.getDeviceInfo(deviceIp);
  console.log('Device:', info.deviceName);

  // Sideload: POST /device/:ip/sideload (multipart) — relay client can accept file path or buffer
  const sideloadResult = await relay.sideload(deviceIp, {
    filePath: '/local/path/to/channel.zip',
    password: 'dev-password',
  });

  // Screenshot: POST /device/:ip/screenshot
  const shot = await relay.screenshot(deviceIp, { password: 'dev-password' });
  if (shot.success && shot.dataUrl) {
    // shot.dataUrl is data:image/jpeg;base64,...
    console.log('Screenshot received, length:', shot.dataUrl.length);
  }
}

main().catch(console.error);
```

### 6.4 Relay — Any language (HTTP only)

No Node package; call the relay’s REST API from any language.

```python
# Python
import requests

BASE = "http://my-mac-mini.local:4951"

# Discover devices
r = requests.get(f"{BASE}/devices")
devices = r.json().get("devices", [])
ip = devices[0]["ip"] if devices else None

if ip:
    # Keypress
    requests.post(f"{BASE}/device/{ip}/keypress/Home")
    # Launch app
    requests.post(f"{BASE}/device/{ip}/launch/12", json={"params": "contentID=123"})
    # Query
    apps = requests.get(f"{BASE}/device/{ip}/query/apps").json()
    # Device info
    info = requests.get(f"{BASE}/device/{ip}/info").json()
```

```bash
# cURL
RELAY="http://my-mac-mini.local:4951"
IP="192.168.1.5"
curl -X POST "$RELAY/device/$IP/keypress/Home"
curl -X POST "$RELAY/device/$IP/launch/12" -H "Content-Type: application/json" -d '{"params":"contentID=123"}'
curl "$RELAY/device/$IP/query/apps"
curl "$RELAY/devices"
```

```csharp
// C# (illustrative)
var baseUrl = "http://my-mac-mini.local:4951";
var client = new HttpClient();
var devices = await client.GetAsync($"{baseUrl}/devices");
var ip = (await devices.Content.ReadAsStringAsync())...; // parse JSON, get first device ip
await client.PostAsync($"{baseUrl}/device/{ip}/keypress/Home", null);
```

### 6.5 Choosing local vs relay

| Scenario | Use |
|----------|-----|
| Script or app runs on the same LAN as the Roku | **Direct:** `require('roku-dev-studio-api')` and pass device `ip`. |
| Script or app runs elsewhere; Roku is at a remote site with the relay server | **Relay:** Use `createRelayClient({ baseUrl })` (Node) or call relay HTTP API from any language. |
| Building a small CLI or automation on the same machine as the Roku | **Direct** with the package. |
| CI or backend service that controls a Roku in another network | **Relay** (point to the relay server’s URL). |

---

## 7. File layout (target)

```
repo-root/
  package.json                    # private workspace; scripts delegate to apps/packages
  lib/
    path-safe.js                  # shared by app + relay (not in API package)
  apps/
    roku-dev-studio/              # Electron app
      package.json
      main.js, preload*.js, main/, renderer/, assets/, scripts/, dist/
  packages/
    roku-dev-studio-api/
      package.json, index.js, ecp.js, relay-client.js, README.md
      lib/  (discovery, device-info, validate-input, screenshot, plugin-install)
    roku-dev-studio-remote-server/
      package.json, roku-remote-server.js, README.md, …
```

---

## 8. Versioning and compatibility

- **Semver:** Package follows semver; response shapes are part of the public contract after 1.0.
- **Relay server:** Same major version of the package in the app and in the relay server so behavior and response shapes stay aligned.
- **Breaking changes:** New major version if we remove or rename public methods or change success/error shape in a way that breaks callers.

---

## 9. Additional considerations

### 9.1 Packaging & Electron

- **Electron builder / asar:** The desktop app must bundle `roku-dev-studio-api` so the main process can `require()` it. Confirm the package is included in the app’s `files` / dependency graph and not incorrectly excluded or broken by asar unpacking rules.
- **Two audiences:** End users install the **Roku Dev Studio app**; developers install **`roku-dev-studio-api`** from npm. Keep release notes and READMEs clear about which artifact is for whom.

### 9.2 Security

- **Relay client (`createRelayClient`):** Validate `baseUrl` (e.g. `http`/`https` only, reject odd schemes) so callers cannot be tricked into sending credentials or traffic to arbitrary hosts.
- **Direct mode:** Keep validating IPv4 before opening HTTP to a device (as today) to limit SSRF-style misuse when the package is used from untrusted input.

### 9.3 Operations & environment

- **curl:** Screenshot and sideload paths use `curl` via `child_process`. Any machine running that code (user’s workstation, relay host, CI agent) needs **curl** available. Document this in the package README and relay deployment docs.
- **OS differences:** Path handling, line endings, and how the relay is run as a service (Windows vs macOS vs Linux) may affect deployment; test or document the primary targets.

### 9.4 Process & governance

- **CHANGELOG:** Maintain a changelog for `roku-dev-studio-api` so consumers know what changed between versions.
- **CI:** Run tests against the package in isolation, plus smoke or integration checks for the app main process and relay using the workspace-linked package version.
- **Release order:** When publishing to npm, publish `roku-dev-studio-api` (and any relay package bump) before releasing app/relay builds that depend on new breaking or major changes.

### 9.5 Legal & naming

- **“Roku” on npm:** Published packages often include a short disclaimer that the project is **not affiliated with or endorsed by Roku, Inc.** Confirm wording with legal/comms if required by your org.

### 9.6 Product & UX

- **Relay response shape change:** Aligning relay with the package may fix cases where 401/403 were returned as `success: true`. Any external client that assumed the old shape should be noted in **release notes** as a behavioral fix.
- **Timeouts:** Sideload and long ECP operations can take many seconds; keep package timeouts aligned with current app and relay behavior so installs don’t fail spuriously.

### 9.7 Optional hardening

- **OpenAPI (or similar):** Document the relay HTTP API as a formal contract for `createRelayClient` and third-party integrations.
- **Migration / deprecation:** If root `lib/` re-exports the package temporarily during migration, set a clear date or version to remove the re-exports and delete duplicate files.

### 9.8 Risk

- **Single dependency:** App and relay both depend on one package — a problematic publish can affect both. Mitigate with CI, semver, and pinning compatible versions in lockfiles.

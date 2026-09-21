# Roku Dev Studio Remote Server

A lightweight Node.js server that runs on a computer at a remote location so the **Roku Dev Studio** desktop app can control Roku devices over the network. The server discovers Rokus on its own LAN and exposes an HTTP/WebSocket bridge that mirrors all Roku ECP (External Control Protocol) functionality, plus telnet relay and RALE / App Connector access.

> Part of [Roku Dev Studio](https://paramount-engineering.github.io/roku-dev-studio/) — see the [main repo](https://github.com/paramount-engineering/roku-dev-studio) for the desktop app, MCP server, and other packages.

## Requirements

- Node.js 24.17 or higher
- Network access to Roku devices on the server's local network
- Port 4951 (default) reachable from wherever the Roku Dev Studio app is running

## Install and run

**Option A — From npm:**

```bash
npm install -g roku-dev-studio-remote-server
roku-remote-server          # default port 4951
roku-remote-server 4000     # or pick a port
```

**Option B — From source (full repo clone):**

```bash
git clone https://github.com/paramount-engineering/roku-dev-studio.git
cd roku-dev-studio
npm install
npm run remote-server       # root script — listens on 4951 by default
```

**Option C — Self-contained copy for a machine without repo or registry access:**

```bash
# from the repo root
npm run deploy:remote-server   # writes ~/Desktop/RDS-Remote-Server-Copy (recreated every run)
```

`scripts/prepare-remote-server-deploy.mjs` rebuilds `roku-dev-studio-api` and this package, packs the api into a local tarball, copies the server's runtime files (`roku-remote-server.js`, `swagger.json`, `swagger-ui.html`, the plist/systemd starters) and writes a `package.json` whose `dependencies` point at that tarball with `devDependencies` stripped — so `npm install --omit=dev` on the remote box only reaches the public registry for the api's own real dependencies and never 404s on the unpublished workspace packages. Copy the folder over and follow the `README.txt` inside it.

## Installation as a Service (macOS)

To run the server automatically on boot:

### 1. Create a Launch Agent

A starter `com.roku-dev-studio.remote-server.plist` ships inside the package. Copy it to your LaunchAgents directory and edit the two paths inside (Node binary and the `roku-remote-server.js` location on this machine):

```bash
# Adjust the source path to wherever you installed the package
cp ./node_modules/roku-dev-studio-remote-server/com.roku-dev-studio.remote-server.plist \
   ~/Library/LaunchAgents/com.roku-dev-studio.remote-server.plist
```

The bundled plist looks like this — the inline comments call out which paths you need to replace before loading:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.roku-dev-studio.remote-server</string>
    <key>ProgramArguments</key>
    <array>
        <!-- Path to your Node binary -->
        <string>/usr/local/bin/node</string>
        <!-- Path to the installed roku-remote-server.js -->
        <string>/Users/YOUR_USERNAME/remote-server/roku-remote-server.js</string>
        <string>4951</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/roku-remote.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/roku-remote.error.log</string>
</dict>
</plist>
```

Rename the `Label` if you want a different reverse-DNS identifier — it just has to be unique on the box.

### 2. Load the Launch Agent

```bash
launchctl load ~/Library/LaunchAgents/com.roku-dev-studio.remote-server.plist
```

### 3. Manage the Service

```bash
# Start
launchctl start com.roku-dev-studio.remote-server

# Stop
launchctl stop com.roku-dev-studio.remote-server

# Unload (disable)
launchctl unload ~/Library/LaunchAgents/com.roku-dev-studio.remote-server.plist

# Check status
launchctl list | grep roku
```

### 4. View Logs

```bash
tail -f /tmp/roku-remote.log
tail -f /tmp/roku-remote.error.log
```

## Installation as a Service (Linux)

A starter **systemd** unit ships as `roku-remote-server.service`. Edit `User`, `WorkingDirectory`, and `ExecStart` paths, then:

```bash
sudo cp roku-remote-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now roku-remote-server
journalctl -u roku-remote-server -f
```

Ensure port **4951** is open in the host firewall if Dev Studio connects from another machine.

## Installation as a Service (Windows)

Run the server at logon with **Task Scheduler** (adjust paths):

1. Open Task Scheduler → Create Task.
2. Triggers: **At log on** (or **At startup**).
3. Action: **Start a program**
   - Program: `C:\Program Files\nodejs\node.exe`
   - Arguments: `C:\path\to\roku-remote-server.js 4951`
   - Start in: `C:\path\to\`
4. Allow task to run whether user is logged on or not (optional for headless hosts).

Alternatively use [NSSM](https://nssm.cc/) to wrap `node roku-remote-server.js 4951` as a Windows Service.

**Health check:** `GET http://<host>:4951/health` returns `apiVersion` (bundled `roku-dev-studio-api` version) — keep the relay host updated when Dev Studio reports sideload/screenshot mismatches.

## API Documentation (Swagger)

The server includes interactive API documentation powered by Swagger/OpenAPI 3.0.

**Access Swagger UI:** `http://localhost:4951/api-docs`

![Swagger UI at /api-docs](https://raw.githubusercontent.com/paramount-engineering/roku-dev-studio/main/docs/images/REMOTE_SERVER_SWAGGER.png)

The Swagger UI provides:
- Interactive API explorer (Health, Capabilities, Discovery, Device Info, Remote Control, RALE …)
- Request/response examples for every endpoint
- Try-it-out functionality for testing endpoints against a live Roku
- Complete parameter documentation generated from the OpenAPI 3.0 spec at `/api-docs/swagger.json`

### API Spec Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api-docs` | Swagger UI interactive documentation |
| `/api-docs/swagger.json` | OpenAPI 3.0 specification (JSON) |

## API Endpoints

### Health & Discovery

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check — `apiVersion`, `serverVersion`, `hostname`, `uptime`, `deviceCount`, `telnetSessions` (the one route that stays open when [auth](#security-considerations) is on) |
| `/capabilities` | GET | Feature flags the desktop app gates on: `remote`, `apps`, `query`, `devApp`, `screenshot`, `verifyDevAuth`, `console`, `telnetSystemPorts` (`[8080, 8087]`), `debugger`, `appConnector`, `deepLink`, `networkInspector` (static support + live MITM state), plus `version` (bundled api), `serverVersion`, `serverInfo` |
| `/api-docs` | GET | Swagger UI documentation |
| `/devices` | GET | Discover all Roku devices (full scan) |
| `/devices/cached` | GET | Get cached devices (fast) |

### Device Control

All device endpoints use the pattern: `/device/:ip/...`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/device/:ip/info` | GET | Get device info |
| `/device/:ip/keypress/:key` | POST | Send key press (e.g., `Up`, `Down`, `Select`) |
| `/device/:ip/launch/:appId` | POST | Launch an app |
| `/device/:ip/query/*` | GET | Query endpoint (device-info, apps, etc.) |
| `/device/:ip/post/*` | POST | POST endpoint (sgrendezvous, fwbeacons, etc.) |
| `/device/:ip/input-text` | POST | Send text input |
| `/device/:ip/deeplink` | POST | Deep link to content |
| `/device/:ip/icon/:appId` | GET | Get app icon as base64 |

**GET `/device/:ip/query/*` — short response cache:** Successful JSON responses are cached per `(device IP, query path)` for **500 ms** (same value as Roku Dev Studio's minimum *Device performance* sampling interval). Multiple Dev Studio clients polling the same Roku through this relay therefore share one ECP hit per path within that window. Failed responses are not cached.

### Developer Features

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/device/:ip/sideload` | POST | Sideload a channel package — `multipart/form-data` **only** (a JSON body gets `400 Missing file or password`): `file` (binary, required), `password` (required), `remotedebug` (`"1"`/`"true"` → clean Delete+Install with `remotedebug=1` so the channel relaunches debuggable) |
| `/device/:ip/delete-sideload` | POST | Delete sideloaded channel (`{ "password" }`) |
| `/device/:ip/screenshot` | POST | Take screenshot (`{ "password" }`) |
| `/device/:ip/verify-dev-auth` | POST | Check a developer password via Digest auth against port 80 without taking a screenshot (`{ "password" }`) |
| `/device/:ip/hardware-image` | GET | The Roku's own UPnP device image (box/stick artwork, not an app icon) as raw image bytes; upstream failures come back as that status or 502 |

### RALE (App Connector)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/device/:ip/rale/wake` | POST | Wake up TrackerTask |
| `/device/:ip/rale/connect` | POST | Connect to TrackerTask |
| `/device/:ip/rale/command` | POST | Send RALE command |
| `/device/:ip/rale/disconnect` | POST | Disconnect |

### Telnet — BrightScript debug console (port 8085)

One relay session per device; the server keeps the Roku socket open and buffers output between WebSocket clients.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/device/:ip/telnet/connect` | POST | Open (or reuse) the 8085 session for a device → `{ success, sessionId, reused? }`, or `{ success: false, error }` |
| `/telnet/connect` | POST | Same, with the IP in a JSON body: `{ "deviceIP" }` |
| `/device/:ip/telnet/disconnect` | POST | Close the device's session → `{ success: true }` (plus a `message` when there was none) |
| `/telnet/disconnect` | POST | Close a session by id: `{ "sessionId" }` → `{ success: true }` |
| `/device/:ip/telnet/clear-buffer` | POST | Drop the relay's buffered backlog without closing the Roku socket → `{ success, sessionId, clearedBytes }` |
| `/telnet/status/:sessionId` | GET | `{ connected, deviceIP, clients, lastActivity }` — `{ connected: false }` for an unknown id |
| `/telnet/sessions` | GET | `{ sessions: [{ sessionId, deviceIP, connected, clients, lastActivity }] }` |
| `/telnet/stream/:sessionId` | WS | WebSocket upgrade that replays the buffered backlog then streams live output as `{ "type": "log", "data" }` frames (also `disconnected` / `error`); a JSON frame `{ "command": "..." }` from the client is written to the Roku console (non-JSON frames are ignored). `?skipBuffer=1` skips the replay and leaves the backlog on the server. Unknown id → plain HTTP 404 |

### Telnet — system consoles (ports 8080 / 8087)

Poll-based (no WebSocket): connect, then read `/data`. All five routes take `?port=8080` (SceneGraph console, default) or `?port=8087` (screensaver console); any other value → `400 Unsupported port`. `GET /capabilities` advertises the allowlist as `telnetSystemPorts`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/device/:ip/telnet-system/connect` | POST | Open the console socket → `{ success }`; replaces any existing connection for that ip:port |
| `/device/:ip/telnet-system/disconnect` | POST | Close it → `{ success: true }` |
| `/device/:ip/telnet-system/send` | POST | Write one line: `{ "command": "chanperf" }` → `{ success }`, or `{ success: false, error: "Not connected" }` |
| `/device/:ip/telnet-system/status` | GET | `{ connected, lastActivity }` |
| `/device/:ip/telnet-system/data` | GET | Drain and return output buffered since the last poll → `{ success, data }`; `{ success: false, error: "Not connected" }` without a socket |

### Network Inspector (MITM capture)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/network/status` | GET | Live state: `enabled`, `mitmEnabled`, `mitmActive` (really bound, not just configured), `mitmLastError` |
| `/network/config` | GET / PUT | Read or persist `enabled` / `mitmEnabled` / `mitmPort` — persisted config survives restarts |
| `/network/stream` | GET | Server-Sent-Events stream of live status + captured events |
| `/network/events` | GET | Buffered captured events for a device |
| `/network/ca/pem`, `/network/ca/cert` | GET | Download the RDS CA certificate the sideloaded channel must trust |

**Network Inspector starts disabled on every fresh install.** Nothing is captured and MITM never binds a port until something enables it — after that, the setting is persisted (`~/.roku-dev-studio-remote/network-inspector.json`) and restored automatically on every restart. Enable it from Roku Dev Studio's Settings → Network Inspector location dropdown, or directly:

```bash
curl -X PUT http://<relay-host>:4951/network/config \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "mitmEnabled": true}'
```

Confirm it's actually running (don't rely on `capabilities.networkInspector.supported` for this — that only means the *feature* is available on this host, not that it's currently on):

```bash
curl http://<relay-host>:4951/network/status | jq '{enabled, mitmEnabled, mitmActive, mitmLastError}'
```

**MITM capture requires the sideloaded dev channel to route its own HTTPS traffic through the proxy** — Roku has no device-wide proxy setting. The channel's BrightScript must prefix outgoing request URLs, e.g. `http://<relay-host>:8888/;https://example.com/api`, and the device must trust the RDS CA certificate (`/network/ca/pem` / `/network/ca/cert`). Without both of those, `mitmActive: true` (the proxy really is listening) but zero captured traffic is expected — not a bug.

### BrightScript Debugger (socket debug protocol, control port 8081)

The debug session lives on the relay host; events fan out to every `/debugger/stream` subscriber. Every route here (the stream included) returns `503 BrightScript Debugger is not available on this server` when the debug-session controller failed to load at startup — `GET /capabilities` reports the same thing as `debugger: false`, so check that first. Controller rejections (e.g. "No debug session for 192.168.1.20. Attach first.") come back as `200 { success: false, error }`, not 500. Request bodies are JSON.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/debugger/stream` | GET | Server-Sent-Events stream of `{ "type", "payload" }` frames (state changes, stopped snapshots, console output, runtime/compile errors, breakpoint updates) across all attached devices |
| `/device/:ip/debugger/attach` | POST | Open a debug-protocol session on port 8081 (tears down any existing one for that IP) → `{ success }` / `{ success: false, error }` |
| `/device/:ip/debugger/detach` | POST | Close the session → `{ success: true }` |
| `/device/:ip/debugger/status` | GET | `{ success, data: { ip, state, protocolVersion } }` |
| `/device/:ip/debugger/continue` | POST | Resume execution |
| `/device/:ip/debugger/pause` | POST | Suspend execution |
| `/device/:ip/debugger/step-over` · `step-in` · `step-out` | POST | Step; optional `{ "threadIndex" }` |
| `/device/:ip/debugger/stack-trace` | POST | Optional `{ "threadIndex" }` → `{ success, data }` |
| `/device/:ip/debugger/variables` | POST | `{ "threadIndex", "stackFrameIndex", "variablePath" }` → `{ success, data }` |
| `/device/:ip/debugger/execute` | POST | Evaluate BrightScript in a frame: `{ "sourceCode", "threadIndex"?, "stackFrameIndex"? }` → `{ success, data }`; `400 Missing sourceCode` |
| `/device/:ip/debugger/add-breakpoints` | POST | `{ "breakpoints": [{ filePath, lineNumber, conditionalExpression?, hitCount? }] }` → `{ success, data }` (queued as pending while the device is running) |
| `/device/:ip/debugger/remove-breakpoints-by-location` | POST | `{ "locations": [...] }` → `{ success, data }` |

## Example Usage

Replace `<relay-host>` with the address (hostname or IP) of the machine running the relay, and `<roku-ip>` with the device IP as seen on the relay's network.

### Discover Devices

```bash
curl http://<relay-host>:4951/devices
```

### Send Key Press

```bash
curl -X POST http://<relay-host>:4951/device/<roku-ip>/keypress/Home
```

### Launch an App

```bash
curl -X POST http://<relay-host>:4951/device/<roku-ip>/launch/<appId>
```

### Query Device Info

```bash
curl http://<relay-host>:4951/device/<roku-ip>/query/device-info
```

### Get Installed Apps

```bash
curl http://<relay-host>:4951/device/<roku-ip>/query/apps
```

### Take Screenshot

```bash
curl -X POST http://<relay-host>:4951/device/<roku-ip>/screenshot \
  -H "Content-Type: application/json" \
  -d '{"password": "your-dev-password"}'
```

## Firewall Configuration

Ensure port 4951 (or your custom port) is open on the relay host's firewall.

**macOS:**

1. **System Settings → Network → Firewall → Options**
2. Add Node.js (or this server's binary) to allowed applications.

Or via Terminal:

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
```

**Linux (ufw):**

```bash
sudo ufw allow 4951/tcp
```

**Windows:** allow Node.js (or the server binary) through Windows Defender Firewall via *Settings → Privacy & security → Windows Security → Firewall & network protection*.

## Security Considerations

1. **Network Security**: This server should only be accessible from trusted networks. Consider using a VPN or SSH tunnel for remote access.

2. **Authentication**: Optional shared-secret bearer token. Start the server with `RDS_RELAY_TOKEN=<secret>` in its environment and every route except `GET /health` (left open for uptime probes) — including the `/telnet/stream` WebSocket upgrade — requires `Authorization: Bearer <secret>`, or `?token=<secret>` for clients that can't set headers on an upgrade (browsers). The comparison is constant-time; a missing or wrong token gets `401 {"success": false, "error": "Unauthorized"}` (a bare `HTTP/1.1 401` on the WebSocket upgrade). With the variable unset the server stays fully open for backward compatibility and prints a prominent warning at startup — CORS only constrains browsers and is **not** authentication.

   ```bash
   RDS_RELAY_TOKEN=my-secret roku-remote-server
   curl -H "Authorization: Bearer my-secret" http://<relay-host>:4951/devices
   ```

3. **Developer Passwords**: Developer passwords are sent in API requests. Ensure the connection is secure (use HTTPS or VPN).

## Troubleshooting

### Server won't start
- Check if port 4951 is already in use: `lsof -i :4951`
- Ensure Node.js is installed: `node --version`

### No devices found
- Ensure Roku devices are on the same network as the relay host
- Check the relay host's firewall settings (see [Firewall Configuration](#firewall-configuration))
- Try a fresh subnet scan by hitting the `/devices` endpoint (uncached) instead of `/devices/cached`

### RALE connection fails
- Ensure the sideloaded app has TrackerTask integrated
- Check if the dev app is running on the Roku
- Verify the correct port (default: 49200)

### Network Inspector shows no traffic
- Check `GET /network/status` (or `/capabilities`'s `networkInspector` object) for `mitmActive` — if it's `false`/missing, MITM was never turned on (see [Network Inspector](#network-inspector-mitm-capture)) or failed to bind a port (`mitmLastError` says why, e.g. already in use — check with `lsof -i :8888`). The server also logs its Network Inspector state once at startup so this shouldn't be a mystery from the console alone.
- Even with `mitmActive: true`, the sideloaded channel must explicitly route its own requests through the proxy URL and trust the RDS CA cert — Roku has no device-wide proxy setting, so a correctly running proxy with a channel that was never built to use it will also show zero traffic.

## License

Released under the [MIT License](./LICENSE). This package has no third-party runtime dependencies beyond [`roku-dev-studio-api`](https://www.npmjs.com/package/roku-dev-studio-api).


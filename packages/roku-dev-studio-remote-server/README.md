# Roku Dev Studio Remote Server

npm package name: **`roku-dev-studio-remote-server`**. A lightweight Node.js server that runs on a Mac Mini (or any computer) at a remote location so Roku Dev Studio can control Roku devices over the network.

**From this monorepo:** run `npm install` from the **repository root**, then start with **`npm run remote-server`** (root script) or **`npm run start -w roku-dev-studio-remote-server`**.

**On a remote / standalone machine** (you only copied this package — **no** root `package.json` with `workspaces`): **do not** use `-w roku-dev-studio-remote-server` (that error means npm is not in a workspace root). Instead:

```bash
cd /path/to/roku-dev-studio-remote-server
npm install
npm start
# or: node roku-remote-server.js
```

The package lives at **`packages/roku-dev-studio-remote-server/`** in the repo (folder name); npm name is **`roku-dev-studio-remote-server`**.

## Overview

This server acts as a bridge between the Roku Dev Studio desktop application and Roku devices on a remote network. It provides a REST API that mirrors all Roku ECP (External Control Protocol) functionality.

## Requirements

- Node.js 14.0 or higher
- Network access to Roku devices on the local network
- Port 4951 (default) must be accessible from the remote Roku Dev Studio

## Quick Start

1. Copy **`packages/roku-dev-studio-remote-server/`** plus **`packages/roku-dev-studio-api/`** (siblings under `packages/`) and repo-root **`lib/path-safe.js`** so paths match the monorepo (see **Deploy layout** below). Or use a full repo clone and `npm install` at the repo root.
2. On the server, **`cd` into `roku-dev-studio-remote-server`** (the folder that contains `package.json` and `roku-remote-server.js`).
3. **`npm install`** then start — **not** workspace flags:

```bash
npm install
npm start
```

Or run Node directly:

```bash
node roku-remote-server.js
```

Or specify a custom port:

```bash
node roku-remote-server.js 4000
```

### Deploy layout (minimal copy, no full git repo)

`roku-remote-server.js` loads `../../lib/path-safe.js` and `package.json` depends on `file:../roku-dev-studio-api`. Preserve this shape on the remote host:

```text
<deploy-root>/
  lib/
    path-safe.js
  packages/
    roku-dev-studio-remote-server/   ← cd here for npm install && npm start
    roku-dev-studio-api/
```

## Installation as a Service (macOS)

To run the server automatically on boot:

### 1. Create a Launch Agent

Create a file at `~/Library/LaunchAgents/com.roku-dev-studio.remote-server.plist` (a starter copy ships in this package as `com.roku-dev-studio.remote-server.plist`; rename the `Label` if you want a different reverse-DNS identifier — it just has to be unique on the box):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.roku-dev-studio.remote-server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/packages/roku-dev-studio-remote-server/roku-remote-server.js</string>
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

**Important:** Replace the script path with the actual path to `roku-remote-server.js` on that machine.

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

## API Documentation (Swagger)

The server includes interactive API documentation powered by Swagger/OpenAPI 3.0.

**Access Swagger UI:** `http://localhost:4951/api-docs`

![Swagger UI at /api-docs](../../images/REMOTE_SERVER_SWAGGER.png)

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
| `/health` | GET | Server health check |
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

**GET `/device/:ip/query/*` — short response cache:** Successful JSON responses are cached per `(device IP, query path)` for **500 ms** (same value as Roku Dev Studio’s minimum *Device performance* sampling interval). Multiple Dev Studio clients polling the same Roku through this relay therefore share one ECP hit per path within that window. Failed responses are not cached.
| `/device/:ip/input-text` | POST | Send text input |
| `/device/:ip/deeplink` | POST | Deep link to content |
| `/device/:ip/icon/:appId` | GET | Get app icon as base64 |

### Developer Features

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/device/:ip/sideload` | POST | Sideload a channel package |
| `/device/:ip/delete-sideload` | POST | Delete sideloaded channel |
| `/device/:ip/screenshot` | POST | Take screenshot |

### RALE (App Connector)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/device/:ip/rale/wake` | POST | Wake up TrackerTask |
| `/device/:ip/rale/connect` | POST | Connect to TrackerTask |
| `/device/:ip/rale/command` | POST | Send RALE command |
| `/device/:ip/rale/disconnect` | POST | Disconnect |

## Example Usage

### Discover Devices

```bash
curl http://mac-mini-ip:4951/devices
```

### Send Key Press

```bash
curl -X POST http://mac-mini-ip:4951/device/192.168.1.100/keypress/Home
```

### Launch Netflix

```bash
curl -X POST http://mac-mini-ip:4951/device/192.168.1.100/launch/12
```

### Query Device Info

```bash
curl http://mac-mini-ip:4951/device/192.168.1.100/query/device-info
```

### Get Installed Apps

```bash
curl http://mac-mini-ip:4951/device/192.168.1.100/query/apps
```

### Take Screenshot

```bash
curl -X POST http://mac-mini-ip:4951/device/192.168.1.100/screenshot \
  -H "Content-Type: application/json" \
  -d '{"password": "your-dev-password"}'
```

## Firewall Configuration

Ensure port 4951 (or your custom port) is open on your Mac Mini's firewall:

1. Go to **System Preferences** > **Security & Privacy** > **Firewall**
2. Click **Firewall Options**
3. Add Node.js or the server to allowed applications

Or via Terminal:

```bash
# Allow incoming connections on port 4951
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
```

## Security Considerations

1. **Network Security**: This server should only be accessible from trusted networks. Consider using a VPN or SSH tunnel for remote access.

2. **Authentication**: The server currently does not require authentication. For production use, consider adding API key authentication.

3. **Developer Passwords**: Developer passwords are sent in API requests. Ensure the connection is secure (use HTTPS or VPN).

## Troubleshooting

### Server won't start
- Check if port 4951 is already in use: `lsof -i :4951`
- Ensure Node.js is installed: `node --version`

### No devices found
- Ensure Roku devices are on the same network as the Mac Mini
- Check firewall settings on Mac Mini
- Try subnet scan by accessing `/devices` endpoint

### RALE connection fails
- Ensure the sideloaded app has TrackerTask integrated
- Check if the dev app is running on the Roku
- Verify the correct port (default: 49200)

## License

Released under the [MIT License](../../LICENSE). This package has no third-party runtime dependencies beyond the workspace's `roku-dev-studio-api` (whose own dependencies are listed in [its README](../roku-dev-studio-api/README.md#license)).


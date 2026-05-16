# Roku Dev Studio Remote Server

A lightweight Node.js server that runs on a computer at a remote location so the **Roku Dev Studio** desktop app can control Roku devices over the network. The server discovers Rokus on its own LAN and exposes an HTTP/WebSocket bridge that mirrors all Roku ECP (External Control Protocol) functionality, plus telnet relay and RALE / App Connector access.

## Requirements

- Node.js 18 or higher
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

## API Documentation (Swagger)

The server includes interactive API documentation powered by Swagger/OpenAPI 3.0.

**Access Swagger UI:** `http://localhost:4951/api-docs`

![Swagger UI at /api-docs](https://raw.githubusercontent.com/paramount-engineering/roku-dev-studio/main/images/REMOTE_SERVER_SWAGGER.png)

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
| `/device/:ip/input-text` | POST | Send text input |
| `/device/:ip/deeplink` | POST | Deep link to content |
| `/device/:ip/icon/:appId` | GET | Get app icon as base64 |

**GET `/device/:ip/query/*` — short response cache:** Successful JSON responses are cached per `(device IP, query path)` for **500 ms** (same value as Roku Dev Studio's minimum *Device performance* sampling interval). Multiple Dev Studio clients polling the same Roku through this relay therefore share one ECP hit per path within that window. Failed responses are not cached.

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

2. **Authentication**: The server currently does not require authentication. For production use, consider adding API key authentication.

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

## License

Released under the [MIT License](./LICENSE). This package has no third-party runtime dependencies beyond [`roku-dev-studio-api`](https://www.npmjs.com/package/roku-dev-studio-api).


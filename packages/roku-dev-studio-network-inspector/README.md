# `roku-dev-studio-network-inspector`

The Network Inspector engine: hotspot packet capture (DNS/SNI/HTTP metadata for all traffic on a
machine-hosted hotspot) plus a local MITM proxy (full HTTPS request/response inspection for a
sideloaded dev channel that routes through it). Transport-agnostic by design — the same engine
drives both **Roku Dev Studio** (via Electron IPC) and **`roku-dev-studio-remote-server`** (via
HTTP/SSE), so capture logic, traffic rules, and replay behavior can't drift between the two.

## Requirements

- Node.js 24.17 or higher
- Per-platform capture tooling for the *hotspot capture* half only (the MITM proxy itself has no
  external dependency): macOS BPF (`tcpdump`), Windows Npcap, Linux `tcpdump` with
  `cap_net_raw`/`cap_net_admin`. See each consumer's Settings → Network Inspector setup guide.

## Consumed from source

This package has no build step — `main`/`types` in `package.json` point directly at `index.ts`. It
is installed via npm workspaces and imported as TypeScript source by:

- `apps/roku-dev-studio` (`main/network-inspector/index.ts` — the Electron IPC adapter)
- `roku-dev-studio-remote-server` (`roku-remote-server.ts` — the HTTP/SSE adapter)

```bash
npm install                          # from the repository root
npm run typecheck:network-inspector
npm test -w roku-dev-studio-network-inspector
```

## Shape

- **`NetworkInspectorService`** (`.`) — the engine class. Constructed with a
  `NetworkInspectorListener` (the transport-agnostic outbound sink: `onEvents`, `onStatus`,
  `onDeviceJoined`/`onDeviceLeft`, `onDeviceDiscovered`, `onClientsCleared`) and driven entirely
  through its own `setEnabled` / `setMitmEnabled` / `setMitmPort` / `setAllTrafficRules` /
  `getStatus` methods — it never references Electron IPC channels or HTTP routes directly.
- **`platform/`** — one capture worker per OS (`macos.ts`, `windows.ts`, `linux.ts`) behind a shared
  `CapturePlatform` interface: hotspot interface detection, capture-tool readiness, and the
  platform-specific one-click setup flow.

## Exports

| Subpath | What it is |
|---------|------------|
| `.` (`index.ts`) | `NetworkInspectorService` — the engine itself. |
| `./types` | Shared contracts (`NetworkInspectorListener`, `NetworkInspectorStatus`, traffic-rule types, replay types). |
| `./rewrite` | Pure traffic-rule mutation helpers (block/throttle/mock), kept transport-free so they unit-test without Node's `http`/`zlib`. |
| `./content-search` | The "Find in content" matcher — searches a captured transaction's full URL/headers/bodies, shared by the desktop app and the offline Session Viewer. |
| `./prerequisites` | User-facing prerequisite / permission remediation (capture-tool availability, install guidance). |
| `./setup-guide` | Single source of truth for the per-platform "Hotspot Capture Setup" guide HTML, rendered identically from Settings and the renderer's setup badge. |
| `./packet-parser` | Reassembles captured TCP payloads into `ParsedNetworkEvent`s. |
| `./http-stream-parser` | Passive plaintext-HTTP (port 80) stream reassembler feeding the packet parser. |
| `./input-sanitize` | Shared input validation for the operations exposed over more than one transport (Electron IPC, remote-server HTTP), so a validation change can't drift between them. |

## License

Released under the [MIT License](../../LICENSE).

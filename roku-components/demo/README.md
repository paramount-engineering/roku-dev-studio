# `roku-components/demo/` — Roku Dev Studio Showcase channel

A small, fictitious SceneGraph channel whose only purpose is capturing Roku
Dev Studio screenshots/GIFs for the website, README, and marketplace
listings — for cases where a real (e.g. internal/proprietary) channel can't
be shown publicly. The Details/Player screen streams real public sample
video (W3C's test media, video.js's demo CDN, and test-videos.co.uk) so
Play/Pause/Rewind/Fast-Forward drive genuine playback.

It's a normal sideload-able channel — build/sideload it the same way you
would any other dev channel (Dev App tab, or `rds sideload`). It also ships
inside the desktop app itself: the **Try Demo App** titlebar button (next to
Floating Remote — toggle it off in Settings → General if you don't want it)
opens a picker and sideloads this exact channel to a chosen device with one
click. That path packages `dist/roku-components/demo/` via
`roku-dev-studio-api`'s `buildDemoZip()` (see `packages/roku-dev-studio-api/lib/demo-channel-template.ts`)
— the same build-time asset-copy mechanism `fiddle/` already uses (`build.mjs`'s
`copyDemoRokuAssets()`), so editing the files here and rebuilding the API
package is all "Try Demo App" needs to pick up changes.

## What it showcases

- **Remote Control** — a title/synopsis list (Home), Up/Down navigation, OK
  opens Details/Player and starts real video playback, Play/Pause/Rewind/
  Fast-Forward drive the actual stream (a full-screen SceneGraph `Video`
  node with a slim title/progress overlay).
- **App Connector (RALE)** — ships `TrackerTask.xml` and implements the
  `GetExternalControlFunctions` / `ExecuteFunction` contract (see
  `roku-components/README.md`) with fourteen real functions:
  - `GetCatalog()` / `SearchCatalog(query)` — GET-style reads
  - `PlayContentById(contentId)` / `SetPlaybackState(state)` — POST-style
    writes that visibly change the on-device screen instantly
  - `GetPlaybackState()` — GET-style read of what's currently playing
  - `LoadCatalogFromUrl(url)` — POST-style write that starts fetching a new
    catalog (same `{ items: [...] }` JSON shape) from any HTTPS URL,
    replacing the current catalog once it arrives
  - `SetProxy(host, enable, port)` / `GetProxyStatus()` — debug network
    proxy (see below)
  - `GetDeviceInfo()` / `GetMemoryInfo()` — `roDeviceInfo` and
    `roAppMemoryMonitor` diagnostics (see below)
  - `PingHealthCheck()` / `SubmitTelemetryEvent(eventName)` /
    `SimulateNetworkError()` — dedicated Network Inspector demo traffic
    (see below)
  - `TriggerConsoleFinding(kind)` — Console Monitor demo trigger (see below)
- **Network Inspector** — on launch the channel loads its bundled
  `data/catalog.json` (see below) with no network traffic at all. Three
  dedicated calls generate traffic on demand without needing a real catalog
  URL: `PingHealthCheck()` (plain GET), `SubmitTelemetryEvent(eventName)`
  (POST with a JSON body, so there's a request body to inspect, not just
  headers), and `SimulateNetworkError()` (a GET that deliberately comes back
  HTTP 500, for a failed-request screenshot). `LoadCatalogFromUrl` still
  works too, e.g. against the project's own GitHub Pages
  `docs/demo-catalog/catalog.json`.
- **Console Monitor** — `TriggerConsoleFinding(kind)` deliberately trips a
  real BrightScript runtime error or warning, matched against the exact
  signatures in `apps/roku-dev-studio/shared/console/brightscript-error-catalog.ts`
  (several of them the RDS team already confirmed on a real device via RDS
  Fiddle). `kind` is optional (default `all`, which trips every one) — one
  of thirteen: `type-mismatch`, `for-each`, `dot-invalid`, `divide-zero`,
  `array-out-of-bounds`, `invalid-format-specifier`, `bad-throw` (Type/Runtime);
  `sg-field-type-mismatch`, `sg-nonexistent-field`, `sg-node-loop-detected`
  (SceneGraph/Component); `formatjson-nested`, `parsejson-failed` (JSON);
  `file-write-failed` (File I/O — writing to the read-only `pkg:/`). The
  ten that are genuine runtime *errors* each run inside their own
  `try`/`catch` so the channel never actually crashes, then print the
  caught exception's own engine-provided message in the standard
  `BRIGHTSCRIPT: ERROR: …` console format. The three that are non-fatal by
  design (`sg-nonexistent-field`, `parsejson-failed`, `file-write-failed`)
  need no try/catch at all — the runtime prints its own warning/error line
  automatically as a side effect. Either way these are genuine runtime
  conditions, not fabricated text, so RDS's Console Monitor recognizes each
  one as a real finding.
- **Debug console** — `print`s on startup, catalog fetch (success/failure),
  navigation, and every App Connector call, so the Console tab and Log File
  Viewer have real, varied output instead of an empty stream.
- **Sideload / Screenshot / Device Performance** — works like any other dev
  channel, no special wiring needed.

## Regenerating the placeholder art

```
node roku-components/demo/generate-images.mjs
```

Regenerates the channel icons + splash (`images/channel_icon_*.png`,
`images/splash.png`) — a dark badge + glowing gradient wordmark, matching
`roku-components/fiddle/`'s art. There's no catalog poster art to regenerate;
the catalog is text-only (title/description/stream URL).

## Default (bundled) catalog

`data/catalog.json` ships inside the channel package (`pkg:/data/catalog.json`)
and is loaded by `LoadDefaultCatalog()` in `components/MainScene.brs` on
every launch — it's the only catalog source used at startup; no network
request happens unless `LoadCatalogFromUrl` is called (see below). It's also
what the app keeps if a later `LoadCatalogFromUrl` call fails — same
`{ items: [...] }` shape as `docs/demo-catalog/catalog.json`. Edit it
directly to change the default content; no code changes needed.

## Loading a different catalog from a URL

Any App Connector client can call `LoadCatalogFromUrl(url)` (see
`GetExternalControlFunctions()` in `components/MainScene.brs`) with an HTTPS
URL to a JSON document shaped like `{ "items": [{ id, title, description,
streamUrl, streamFormat }, ...] }`. The fetch is async — the call returns
once the request starts, and the grid/App Connector's `GetCatalog()` reflect
the new catalog once the response arrives.

## Debug network proxy

`SetProxy(host, enable, port)` (App Connector, see `ExecuteFunction()` in
`components/MainScene.brs`) routes catalog fetches and stream playback
through a Charles/Fiddler/mitmproxy-style capture tool running on `host:port`
(`port` is optional, default `8888`) — Roku has no OS-level HTTP proxy
setting and doesn't support installing a MITM root cert, so every outgoing
URL is rewritten to `http://<host>:<port>/;<realUrl>` and the capture tool
fetches-and-forwards it. Enabling the proxy first fires an async
reachability check (a `roUrlTransfer` GET routed through the same proxy,
same pattern as the catalog fetch/loader); `ApplyProxy()` only rewrites URLs
once that check confirms `host:port` is reachable, so a laptop being off the
network doesn't silently break catalog loads or playback. `GetProxyStatus()`
returns `{ host, port, enabled, verified }` to check the current state.
Ported from the proxy feature in the
`avia-roku-samples` reference app.

## Generic async worker Task

`components/HelperTask.xml`/`.brs` is a small reusable background `Task` —
write an `{ operation, ... }` assocarray to its `input` field, get an
`{ operation, ... }` assocarray back on `output` once the work completes.
Both the catalog fetch (`FetchJson`) and the proxy reachability check
(`TestReachable`) run through it, off the render thread; `MainScene.brs`
observes `output` directly (`OnHelperTaskOutput`) instead of routing
`roUrlEvent`s through `source/main.brs`. It handles one request at a time by
design — a second `input` write while one is in flight comes back as a
"busy" error rather than corrupting the first. Ported from the `HelperTask`
pattern in the `avia-roku-samples` reference app.

## Device / memory diagnostics

`GetDeviceInfo()` returns `roDeviceInfo` values — model, OS version, client
id, local/external IP, connection type, display info, time zone, country
code. `GetMemoryInfo()` returns `roAppMemoryMonitor` values — the channel's
memory limits, available memory, usage percent, and the device's general
memory level (useful for "why did my channel just get killed" debugging).
Both are plain synchronous reads (see `GetDeviceInfo()`/`GetMemoryInfo()` in
`components/MainScene.brs`) — no HelperTask involved.

## Capturing the actual screenshots/GIFs

1. **Remote Control** — sideload, launch, and capture the Home list; Up/Down
   through a couple of rows for a GIF.
2. **Details/Player** — OK on a tile, then Play/Pause/Rewind/Fast-Forward on
   the remote for a media-keys GIF.
3. **App Connector** — connect on port `49200` in the App Connector tab,
   call `PlayContentById` with a different id than what's on screen, and
   capture the instant on-device reaction (best as a short GIF: type the
   call, watch the TV change).
4. **Network Inspector** — open it, then call `PingHealthCheck`,
   `SubmitTelemetryEvent`, and `SimulateNetworkError` in turn (App Connector)
   for a capture with a plain GET, a POST with a body, and a failed request
   all in one session — no catalog URL needed. `LoadCatalogFromUrl` against
   the GitHub Pages `docs/demo-catalog/catalog.json` URL still works too.
5. **AI agent / MCP** — from an MCP-connected client (Cursor, Claude
   Desktop, VS Code), call the `app_function` tool against `SearchCatalog`
   or `PlayContentById` and capture the agent's request + the device's
   reaction together.
6. **Console / Log File Viewer** — capture the Console tab mid-session
   showing the `[SHOWCASE]` log lines from the actions above.
7. **Console Monitor** — call `TriggerConsoleFinding` with `kind: "all"`
   (App Connector), then open Console Monitor in the app and capture the
   thirteen recognized findings it surfaces from the same session.
8. **Sideload Relay fan-out** — this is a root-app feature, not a channel
   function: add 2+ Rokus as Sideload Relay targets (Settings → Sideload
   Relay), point your IDE's sideload at RDS's advertised relay address
   instead of a device IP, and push this same demo package. Capture the
   fan-out table updating live across all targets in one push — no other
   channel does this any differently, so the demo package is just a
   convenient, disposable payload for it.

# Roku Dev Studio vs. RokDock — Detailed Comparison

> Compares this repository (**Roku Dev Studio**, "RDS") against
> [`paramount-streaming/rokdock`](https://github.com/paramount-streaming/rokdock)
> ("RokDock") at the time of writing.
>
> **Sources of truth used:**
>
> - RDS — `README.md`, `apps/roku-dev-studio/package.json`,
>   `packages/roku-dev-studio-{api,remote-server,mcp}/package.json`,
>   monorepo layout under `apps/`, `packages/`, `lib/`.
> - RokDock — `README.md`, `package.json`, `docs/user/*.md`,
>   `src/{main,renderer,shared,preload}` from a fresh clone of the public repo.
>
> Both projects originate from **Paramount Streaming** (RDS author
> `hareendra.donapati@paramount.com`; RokDock lives under the
> `paramount-streaming` GitHub org). This document treats them as sibling
> internal tools rather than rivals, but still names a winner per category and
> overall, as requested.

---

## TL;DR

| | Roku Dev Studio | RokDock |
|---|---|---|
| Project shape | npm workspace **monorepo** (Electron app + reusable Node API package + remote relay server + MCP server) | **Single Electron app** repo |
| Stack | Electron 33, TypeScript, mixed renderers (vanilla + Solid + Monaco) | Electron 41, **React 19 + Zustand**, electron-vite, Ace |
| Primary surfaces | Local network **+ Internet (relay server) + AI agents (MCP)** | **Local network only** |
| Killer apps | RALE App Connector, Action Scripts (with PDF export + perf charts), Remote Server, MCP server, BrightScript profiler-style live charts | **9-Patch editor**, **SVG → quantized PNG converter**, **HDMI capture preview** (docked/PiP/popout), screenshot **onion-skin overlay + measurement**, multi-tab tokenised terminal, RASP-compatible scripts |
| License | MIT | Apache-2.0 |
| Versions (at time of writing) | app `2.0.0`, api `1.0.0`, remote-server `1.1.0`, mcp `0.2.0` | `1.3.1` |

**Headline:** RDS is a *platform* (desktop + library + relay + AI), built around
**dev-channel debugging, automation, and remote/AI control**. RokDock is a
*polished single-app workstation* built around **day-to-day SceneGraph dev
ergonomics**: terminal, screenshots, deeplinks, asset authoring (9-patch / SVG),
HDMI capture, and RASP-style automation. They overlap on the basics
(SSDP discovery, ECP remote, sideload, screenshots, automation scripts) but
diverge sharply at the edges.

---

## 1. What each project actually is

### 1.1 Roku Dev Studio (this repo)

Quoting `README.md`: *"A comprehensive cross-platform desktop application for
controlling and developing on Roku devices over your local network or via remote
server using the External Control Protocol (ECP)."*

Repository layout:

```
.
├── apps/
│   └── roku-dev-studio/              # Electron 33 app (main + renderer)
├── packages/
│   ├── roku-dev-studio-api/          # Node library, npm-publishable, ships `rds` CLI
│   ├── roku-dev-studio-mcp/          # MCP server exposing Action Scripts to AI agents
│   └── roku-dev-studio-remote-server/# HTTP/WS relay for over-the-internet control
├── lib/                              # path-safe TS helpers shared by app/server
└── package.json                      # npm workspaces
```

Notable from `package.json`s:

- App ID `com.paramount.vtg.roku-dev-studio`, `productName` "Roku Dev Studio".
- App targets DMG+ZIP (mac x64+arm64), NSIS+portable (win x64), DEB+AppImage
  (linux x64+arm64). Hardened runtime + entitlements + `afterSign` notarize hook.
- Bundled deps signal feature scope: `brighterscript`, `monaco-editor`,
  `modern-screenshot`, `pdf-lib`, `ws`, `form-data`, `roku-dev-studio-api`,
  `roku-dev-studio-mcp`.
- Dev: `solid-js`, `vite-plugin-solid`, `tsx`, `esbuild`, `electron-builder`.
  The renderer is currently **mixed** — there's a legacy renderer plus a
  newer Solid renderer (`renderer:solid:dev`, `RDS_SOLID_RENDERER=1`).

### 1.2 RokDock

Quoting `README.md`: *"RokDock is a cross-platform desktop app for Roku
development. It combines device discovery, terminal sessions, remote control,
app sideloading, screenshot capture, automation scripting, and more in one
tool."*

Repository layout:

```
.
├── src/
│   ├── main/        # Electron main process, IPC handlers, services
│   ├── preload/     # Context-bridged API
│   ├── renderer/    # React + Zustand UI
│   └── shared/      # Cross-process types, RASP keys, custom UI control web components
├── docs/            # End-user docs (Markdown)
├── electron-builder.json
├── electron.vite.config.ts
└── package.json
```

Notable from `package.json`:

- `electron 41.1.0`, `react 19`, `zustand 5`, `electron-vite 5`.
- Asset-pipeline deps: `ace-builds`, `image-q` (color quantization),
  `pngjs`, `fast-xml-parser`, `electron-store`.
- No reusable library, no server, no MCP, no CLI. Everything is the app.
- Targets Win (NSIS+portable), macOS (DMG+ZIP), Linux (AppImage). README
  explicitly notes the macOS app **is not code-signed**, so users have to
  `xattr -cr` it.

---

## 2. Architecture comparison

| Dimension | Roku Dev Studio | RokDock |
|---|---|---|
| Runtime | Electron 33.4.11 | Electron 41.1.0 |
| Renderer framework | Mix: vanilla TS + **Solid 1.9** (in-progress migration) + Monaco for code | **React 19 + Zustand** + Ace editor |
| Build / bundling | Hand-rolled `tsx` build scripts + `esbuild` + `vite` (renderer) | `electron-vite` |
| State persistence | Custom (settings file, per-device state) | `electron-store` |
| Multi-process pattern | Main bundled to `main.bundled.cjs`; multiple preloads (`preload`, `fiddle-preload`, `log-viewer-preload`, `preload-about`, `preload-settings`) | Standard `src/main` + `src/preload` + `src/renderer`; multiple aux windows for tools (script editor, screenshot preview, 9-patch, SVG converter, JSON viewer, capture popout) |
| Cross-network reach | **Yes** — `roku-dev-studio-remote-server` HTTP/WS relay; full ECP proxy, telnet relay, file upload, Swagger UI at `/api-docs` | **No** — local SSDP only |
| AI / agent control | **Yes** — `roku-dev-studio-mcp` exposes Action Script authoring + ~all device ops as MCP tools (`probe_bridge`, op-backed tools auto-generated from `roku-dev-studio-api` op descriptors) | **None** |
| Reusable library | **Yes** — `roku-dev-studio-api` (npm-publishable, has `rds` CLI bin) | **None** — code is app-internal |
| Code signing | macOS hardened runtime + entitlements + notarize `afterSign` hook (cert provided by user) | None — README tells users to remove quarantine attribute |

**Implication:** RDS is built so its capabilities can be reused outside the
desktop UI (CI pipelines via the API/CLI, remote sites via the relay, AI agents
via MCP). RokDock's capabilities are deliberately in-app — you get them by
running the binary, not by importing a module.

---

## 3. Feature matrix

Legend: ✅ first-class · 🟡 partial / via different mechanism · ❌ absent.

### 3.1 Discovery & connection

| Feature | RDS | RokDock |
|---|:---:|:---:|
| SSDP auto-discovery | ✅ | ✅ |
| Subnet scan fallback | ✅ | ❌ |
| Manual device add | ✅ | ✅ |
| Remote (over-internet) discovery | ✅ via relay | ❌ |
| Per-device dev credentials, encrypted at rest | 🟡 stored | ✅ Electron `safeStorage` when available |
| Developer mode lock/unlock indicator | 🟡 implicit | ✅ explicit lock/unlock icon on cards |
| Drag-and-drop device reordering | ❌ | ✅ |
| Configurable connectivity / stale-device polling | ✅ "Device Active Check" in Settings (`CONNECTION_CHECK_INTERVAL`, 3 000–600 000 ms) — drives both connection status and active-app foreground poll | ✅ ~45 s stale marker (not user-configurable in docs) |
| Per-device port presets (`8085`, `8080`, `8087`, etc.) with color labels | 🟡 fixed ports | ✅ user-configurable port table |

### 3.2 Remote control

| Feature | RDS | RokDock |
|---|:---:|:---:|
| On-screen ECP remote | ✅ | ✅ |
| Keyboard mode | ✅ (off by default; fixed mapping) | ✅ (fully **rebindable** in Settings) |
| Text input via remote | ✅ | ✅ |
| Volume / mute / power | ✅ | ✅ |
| Active-app polling, configurable | ✅ "Device Active Check" in Settings, 3 000–600 000 ms (also drives device-info / ECP / dev-app-foreground polling) | ✅ "Dev App Poll Interval" in Advanced settings, 500–15 000 ms |
| Multi-device "quad" with live perf charts | ✅ ("Show Device Performance" quad on Remote tab) | ❌ |

### 3.3 Terminal / console

| Feature | RDS | RokDock |
|---|:---:|:---:|
| BrightScript debug console (port `8085`) | ✅ | ✅ |
| System commands telnet (port `8080`) | ✅ | 🟡 generic port handler — port table is configurable |
| Multi-tab sessions per device | ❌ (single console panel per device) | ✅ tabbed, with status dots, port-color stripes, buffer meter, activity dot |
| Tokenised syntax highlighting in console | 🟡 line classification + structured pills, but no full BrightScript token coloring | ✅ semantic tokens, prompt emphasis, themed |
| Inline **JSON** click-to-open viewer | ✅ (`structured-log-detect.ts` + `telnet-structured-view-modal.ts`) | ✅ |
| Inline **XML** click-to-open viewer | ✅ (same detector — XML payloads, including escaped/wrapped forms) | ❌ (only JSON in RokDock docs) |
| Inline URL explorer (parsed query params, decoded) | ✅ `telnet-url-modal.ts` | ✅ sortable table, copy as Table / TSV |
| Find / Find-next with **case / whole-word / regex** | ✅ `TelnetFindOptions = { case, word, regex }` in `telnet-output-find-bar.ts` (with ReDoS guard) | ✅ |
| Auto-scroll | ✅ per-panel checkbox | ✅ per-tab |
| Word-wrap toggle | ❌ (always wraps; no toggle) | ✅ per-tab |
| Save snapshot to file | ✅ | ✅ |
| **Continuous streaming** to file | ❌ | ✅ (Start/Stop streaming output) |
| Persistent command history (capped) | ✅ | ✅ (1 000, deduped) |
| Custom syntax themes | ❌ | ✅ |

### 3.4 Sideloading & dev-channel ops

| Feature | RDS | RokDock |
|---|:---:|:---:|
| `.zip` sideload via `/plugin_install` (digest auth) | ✅ | ✅ |
| `.pkg` sideload | ✅ | 🟡 README only mentions `.zip` |
| Upload progress UI | ✅ | ✅ |
| Delete sideload | ✅ | ❌ (not surfaced in docs) |
| Auto-screenshot after keypress / launch | ✅ | ❌ |
| Sideload over the internet (relay) | ✅ | ❌ |
| TrackerTask.xml export helper | ✅ | ❌ |

### 3.5 Screenshots

| Feature | RDS | RokDock |
|---|:---:|:---:|
| Capture current screen | ✅ | ✅ |
| Auto-refresh / interval capture | ✅ (Auto Screenshot setting) | ✅ (5/15/30/45/60/90/120 s + countdown) |
| Dedicated preview window with zoom | 🟡 inline preview | ✅ separate window, slider 10–300 %, fit-to-window, snap-to-100 % |
| Pixel measurement tool (with axis-lock) | ❌ | ✅ |
| **Onion-skin comparison overlay** (custom + built-in safe zones / rule of thirds / aspect / column grids) | ❌ | ✅ |
| Save with overlay / Copy with overlay | ❌ | ✅ |
| Pixel-deduped screenshot history (last 20) | ❌ | ✅ |

### 3.6 Asset authoring tools

| Feature | RDS | RokDock |
|---|:---:|:---:|
| **9-patch editor** (shape/border/shadow, auto-detect zones, dual 1080p+720p export with `_fhd`/`_hd` naming) | ❌ | ✅ |
| **SVG → quantized PNG converter** (Floyd-Steinberg dithering, 64/128/256 palette, 4K/FHD/HD/SD presets) | ❌ | ✅ |
| Pixel inspector (RGBA + swatch on hover) | ❌ | ✅ |

This is RokDock's clearest unique territory.

### 3.7 HDMI capture / external video

| Feature | RDS | RokDock |
|---|:---:|:---:|
| Live HDMI capture preview (USB capture card) | ❌ | ✅ |
| Docked / PiP / popout viewing modes | ❌ | ✅ |
| Capture audio control + idle-timeout pause | ❌ | ✅ |

### 3.8 Deeplinks

| Feature | RDS | RokDock |
|---|:---:|:---:|
| One-shot deep link launch (App ID + content ID + media type) | ✅ | ✅ |
| **Deeplink library / presets manager** | ❌ | ✅ |
| `Launch` and `Input` ECP deeplink types | 🟡 launch only | ✅ both, plus arbitrary extra params |

### 3.9 Automation / scripting

| Feature | RDS | RokDock |
|---|:---:|:---:|
| Visual script builder (GUI step list) | ✅ | ✅ |
| Step types | keypress, ECP request, delay, screenshot, App Connector calls, **Device Performance capture** | press/keyDown/keyUp, text, delay, launch, **loop**, **block / blockRef**, waitPlayerState, validateStreaming, waitActiveApp, **assertQuery**, channelTileOrder, screenshot marker, comment |
| Control flow (loops, blocks/macros) | 🟡 limited | ✅ first-class |
| Variable substitution in text | 🟡 metadata | ✅ `${var}` tokens with metadata-defined variables |
| **Streaming/playback validation** (codec, DRM, player state) | ❌ | ✅ `validateStreaming`, `waitPlayerState` |
| **Channel tile order assertion** | ❌ | ✅ |
| **RASP YAML import/export** (Roku Automation Script Protocol) | ❌ | ✅ |
| RALE BrightScript function calls as steps | ✅ | ❌ |
| Per-step error-handler chain | 🟡 partial | ✅ |
| Run results export as **PDF** with embedded charts | ✅ | ❌ |
| Performance chart card capture into run output | ✅ | ❌ |
| Run logs persisted to disk | 🟡 implicit | ✅ `~/scripts/logs/` |
| Script file format | JSON variant | `.rscript.json` files in `~/scripts/` |

### 3.10 Live performance / device internals

| Feature | RDS | RokDock |
|---|:---:|:---:|
| Live CPU / memory / object-count charts | ✅ (Remote tab "Show Device Performance" quad) | ❌ |
| **App Connector / RALE TrackerTask integration** (function discovery, BrightScript function execution, return values) | ✅ | ❌ |
| Configurable sample interval & history | ✅ | ❌ |
| SceneGraph node / SG rendezvous queries | ✅ | ❌ |
| FW beacons, plugins, memory queries | ✅ | ❌ |
| Custom ECP query endpoint runner | ✅ | 🟡 ad-hoc via terminal |

### 3.11 Remote / over-the-internet & AI

| Feature | RDS | RokDock |
|---|:---:|:---:|
| Internet bridge / relay server (HTTP+WS proxy) | ✅ `roku-dev-studio-remote-server` | ❌ |
| Swagger / OpenAPI for remote API | ✅ | ❌ |
| Telnet ports `8085`/`8080` relayed via WebSocket | ✅ | ❌ |
| Sideload via relay | ✅ | ❌ |
| MCP server for AI agents (Cursor, Claude, etc.) | ✅ `roku-dev-studio-mcp` (op-backed tools auto-generated from descriptors) | ❌ |
| CLI for headless / CI use | ✅ `rds` (from `roku-dev-studio-api/dist/cli.js`) | ❌ |
| Reusable Node library | ✅ `roku-dev-studio-api` | ❌ |

### 3.12 Distribution & ops

| Feature | RDS | RokDock |
|---|:---:|:---:|
| macOS DMG + ZIP, x64 + arm64 | ✅ | ✅ |
| Windows NSIS + portable | ✅ | ✅ |
| Linux DEB + AppImage (x64 + arm64) | ✅ | 🟡 AppImage (x64) |
| **macOS code signing + notarization workflow** | ✅ (entitlements + `afterSign` hook) | ❌ (README tells users to `xattr -cr`) |
| Privacy mode (mask IPs / serials in UI) | ✅ | ❌ |
| Settings persistence across sessions | ✅ | ✅ (`electron-store`) |
| Renovate / dependency automation | ❌ | ✅ (`renovate.json`) |

---

## 4. Department-by-department leaders

| Department | Leader | Why |
|---|---|---|
| **Discovery & device management UX** | **RokDock** | Drag-and-drop reordering, encrypted credentials via `safeStorage`, configurable port table with colored labels, explicit dev-mode lock/unlock chips. RDS works (and exposes its own configurable `CONNECTION_CHECK_INTERVAL` for connectivity polling), but the UI surface is more functional than polished. |
| **Remote control ergonomics** | **Tie**, leaning RokDock for keybinds, RDS for instrumentation | RokDock has fully rebindable keys; RDS has a configurable Device Active Check (3 000–600 000 ms) plus the multi-device "Show Device Performance" quad on the Remote tab. |
| **Terminal / console** | **RokDock**, narrowly | Both have Find with case/word/regex, JSON click-to-open viewer, URL explorer, auto-scroll, save-snapshot, persistent command history. RokDock leads on multi-tab sessions, full BrightScript syntax highlighting, custom syntax themes, port-color stripes / buffer meter / activity dot, streaming-to-file, and a word-wrap toggle. **RDS leads on inline XML payload detection** (RokDock docs only mention JSON). The two are closer than the rest of the matrix. |
| **Sideloading** | **RDS** | Same core mechanism, but RDS adds `.pkg` support, delete-sideload, auto-screenshot, *and* sideloading over the internet via the relay. |
| **Screenshots** | **RokDock**, decisively | Onion-skin overlays (custom + built-in safe zones / rule-of-thirds / aspect / grids), measurement tool with axis-lock, deduped history, save/copy with overlay. RDS captures, RokDock *inspects*. |
| **Asset authoring (9-patch / SVG)** | **RokDock**, alone | RDS has nothing in this category. RokDock's 9-patch editor and SVG-to-quantized-PNG converter are full SceneGraph asset tools with dual-resolution export. |
| **HDMI capture / external video** | **RokDock**, alone | Docked / PiP / popout capture preview with audio control. RDS doesn't address this. |
| **Deeplinks** | **RokDock** | Has a managed library of `Launch` *and* `Input` deeplink presets with extra params. RDS supports deep linking, but not as a managed preset library. |
| **Automation (control flow, validation, RASP)** | **RokDock** | Loops, blocks, RASP YAML, streaming/codec/DRM validation, channel-tile-order assertion, variable substitution, error-handler chains, per-script logs. |
| **Automation (RALE / live perf / PDF reporting)** | **RDS** | RALE BrightScript function calls as scripted steps, embedded performance chart capture, **PDF export of run results**. RokDock has no RALE / no perf charts. |
| **Live performance / SceneGraph instrumentation** | **RDS**, alone | CPU/memory/object live charts, SG node queries, FW beacons, plugins, memory, RALE App Connector, custom ECP query runner. |
| **Remote / over-the-internet control** | **RDS**, alone | Dedicated relay server with full ECP proxy, telnet relay, file upload, Swagger UI. RokDock is local-only. |
| **AI / MCP integration** | **RDS**, alone | `roku-dev-studio-mcp` exposes Action Script authoring + ~every device op as MCP tools. RokDock has none. |
| **Reusability outside the GUI (library + CLI)** | **RDS**, alone | Publishable `roku-dev-studio-api` Node library with `rds` CLI bin. RokDock is GUI-only. |
| **Distribution polish (signing, notarization, breadth)** | **RDS** | Full code-sign + notarize pipeline, DEB + AppImage on x64 *and* arm64. RokDock ships unsigned. |
| **Dependency hygiene / modern stack** | **RokDock** | Electron 41 vs 33, React 19 + Zustand + electron-vite vs RDS' mid-migration vanilla→Solid renderer. Renovate automation in repo. |
| **Daily SceneGraph dev "comfort"** | **RokDock** | The whole UX (themed terminal, screenshot inspector, deeplink presets, capture preview, asset editors) is tuned for a developer who lives in the app for hours. |

---

## 5. Pros and Cons

### 5.1 Roku Dev Studio

**Pros**

- **It's a platform, not just an app.** A reusable `roku-dev-studio-api` (with
  `rds` CLI), an internet relay server, and an MCP server for AI agents. Same
  capability set is reachable from a desktop user, a CI job, or an AI agent.
- **Live performance instrumentation** built in: CPU / memory / object-count
  charts, captureable into Action Scripts and exported to PDF.
- **RALE App Connector** lets you call BrightScript functions inside your dev
  channel from the GUI / scripts — this is the real automated-testing
  foundation, and RokDock has nothing equivalent.
- **Deep query coverage**: device info, all apps, active app, media player, SG
  nodes, SG rendezvous, FW beacons, plugins, memory, system commands via
  telnet, custom ECP endpoint runner.
- **Cross-network reach** out of the box (relay server with Swagger).
- **AI-first authoring path** (MCP) — Action Scripts can be created, validated,
  and dispatched by an agent.
- **Production-grade distribution**: macOS hardened runtime + entitlements +
  notarization, x64+arm64 across all three OSes.
- **Privacy mode** — masks IPs and serials in UI for screen-shares / demos.

**Cons**

- **Console / terminal is narrower than RokDock's** mostly on multi-tab,
  full BrightScript syntax highlighting, custom syntax themes, streaming-to-file,
  and a word-wrap toggle. (RDS *does* have Find with case/word/regex, JSON +
  XML + URL click-through viewers, auto-scroll, save snapshot, and persistent
  command history — the gap is smaller than first impressions suggest.)
- **No SceneGraph asset tools.** No 9-patch editor, no SVG converter, no pixel
  inspector — you'd reach for separate tooling for these.
- **No HDMI capture preview.**
- **Screenshots are utilitarian.** No measurement tool, no comparison overlay,
  no zoomable history window.
- **Renderer is mid-migration** (vanilla → Solid). Higher cognitive cost for
  contributors; some screens are clearly older than others.
- **Older Electron** (33 vs RokDock's 41).
- **Deeplink UX** is one-shot rather than a managed library of presets.
- **No drag-to-reorder** on the device list, no stale indicator, no
  configurable port table — small ergonomic gaps.
- **Build path is hand-rolled** (`tsx scripts/build/index.ts`, multiple
  preloads bundled separately) compared to RokDock's `electron-vite`.

### 5.2 RokDock

**Pros**

- **Polished, focused single-app experience.** Clearly designed by someone
  who lives in the app daily.
- **Best-in-class terminal** for Roku: tabs, semantic tokens, search, JSON
  click-to-open, URL explorer with sortable params, streaming-to-file,
  per-tab settings. (Caveat: only JSON is documented as click-to-open;
  RDS's console additionally detects **XML** payloads inline.)
- **Best-in-class screenshot tooling**: separate window, measurement, onion-skin
  overlays (with built-in safe zones / rule-of-thirds / aspect / grids),
  deduped history.
- **SceneGraph asset authoring built in**: a full 9-patch editor (dual 1080p +
  720p export, auto-detect zones, drop shadow, pixel inspector) and an SVG →
  quantized PNG converter (Floyd-Steinberg dithering).
- **HDMI capture preview** (docked / PiP / popout) — solves the "I don't want a
  separate screen for the TV" problem in-app.
- **Deeplink library** with `Launch` and `Input` types and extra params — much
  more usable than ad-hoc deep linking.
- **Mature automation**: loops, blocks/blockRefs, variable substitution,
  streaming/codec/DRM validation, channel-tile-order assertion, **RASP YAML
  import/export**, per-step error handlers, per-script logs.
- **Modern stack**: Electron 41, React 19, Zustand, electron-vite, Renovate.
- **Configurable everywhere**: port presets (label/number/color/enabled),
  remote key bindings, scan/timeout intervals, theme/font, capture options.
- **Encrypted credentials at rest** via Electron `safeStorage`.

**Cons**

- **Local network only.** No remote/internet bridge, no relay server.
- **No AI/MCP surface.** Can't be driven by an agent without an external wrapper.
- **No reusable library or CLI.** Everything is locked inside the Electron
  binary; you can't `import { ... }` from it for a CI script.
- **No live device performance instrumentation** (no CPU/memory/object charts).
- **No RALE / TrackerTask integration**, so no in-app dev-channel BrightScript
  function calls.
- **Shallower device queries**: no SG nodes, no FW beacons, no plugins/memory
  query, no custom ECP endpoint runner — you'd compose those by hand in the
  terminal.
- **No PDF run report / no perf chart capture** in scripts.
- **Sideload covers `.zip` only** (per the docs); no delete-sideload surfaced;
  no internet sideload.
- **Ships unsigned on macOS** — first-run UX requires manual `xattr -cr`.
- **Linux ships AppImage only** (no DEB; no published arm64 build, per
  `getting-started.md`).
- **No privacy / mask-PII mode** for screen-shares.

---

## 6. Where each project leads, summarised

- **RDS leads** in: cross-network/internet control, AI/MCP, reusable
  library + CLI, live perf instrumentation (CPU/memory/objects + chart capture
  + PDF reporting), RALE/TrackerTask integration, deep ECP query coverage
  (SG nodes, FW beacons, plugins, memory, custom queries), dev-channel ops
  breadth (.pkg, delete-sideload, auto-screenshot, internet sideload,
  TrackerTask.xml export), and distribution polish (notarization).
- **RokDock leads** in: terminal UX, screenshot inspection, SceneGraph asset
  authoring (9-patch + SVG), HDMI capture preview, deeplink presets, automation
  control flow + RASP + streaming validation, modern stack and dependency
  hygiene, fine-grained per-user configuration.

---

## 7. Overall winner

**There is no single winner — the answer depends on the user.** Both
projects come from the same company, and the most honest framing is that they
target overlapping but **different roles** in the dev/QA loop.

| If your day looks like… | Pick |
|---|---|
| Writing automated tests against dev channels, calling BrightScript functions from outside, controlling devices in **another lab/site over the internet**, or wiring **AI agents** into Roku QA. | **Roku Dev Studio** |
| Authoring **SceneGraph UI**, sweating pixel layouts (9-patch, safe zones, measurement), watching the TV via **HDMI capture** alongside the IDE, debugging through a **first-class terminal**, and writing RASP-style certification scripts. | **RokDock** |
| You want **one tool that does both**. | Use **RDS** as the *backbone* (relay, MCP, RALE, perf, CI library) and **RokDock** as the *workstation* (terminal, screenshots, asset tools, capture). They don't conflict — they share Roku as the only piece of state. |

**If pressed for a single winner under the assumption "I can only install one
desktop app on my dev laptop":**

- For a **SceneGraph application developer** doing day-to-day UI work →
  **RokDock** wins. The terminal alone (multi-tab, tokenised, JSON/URL aware)
  plus the 9-patch editor, SVG converter, screenshot inspector, and HDMI
  capture make the difference.
- For a **platform / automation / QA engineer** building test infrastructure,
  remote labs, or AI-driven test suites → **Roku Dev Studio** wins. The
  reusable API, the relay server, the MCP server, RALE App Connector, and live
  perf charts have no equivalent in RokDock.

**Across the broadest "Roku dev tooling capability surface", Roku Dev Studio
is the bigger system** (desktop + library + relay + MCP + CLI). **Across "best
single-window developer experience for SceneGraph work", RokDock is the better
app**.

So:

- **Breadth / capability winner: Roku Dev Studio.**
- **Per-feature UX winner: RokDock.**
- **Right answer for most teams: install both**, since they're complementary
  more than they are competitive.

---

## 8. Possible synergies (not a recommendation, just observations)

These are *opportunities*, not implied work — landing any of these would
require a separate scope-approval discussion per the repo's
`approval-before-scope-expansion` rule.

1. **Close the remaining terminal-UX gap in RDS** — multi-tab sessions, full
   BrightScript token coloring, custom syntax themes, streaming-to-file, and
   a word-wrap toggle. (Find with case/word/regex, JSON+XML+URL viewers, and
   auto-scroll already exist.)
2. **Adopt RokDock's screenshot overlay/measurement tooling in RDS** — onion
   skin + safe-zone presets would fit cleanly alongside RDS's existing
   screenshot capture and Action Script screenshot step.
3. **Expose RDS' `roku-dev-studio-api` as RokDock's IPC backend** — RokDock
   has no library; using `roku-dev-studio-api` would give it relay/MCP/CLI
   reach effectively for free.
4. **Expose RokDock's RASP YAML import/export from RDS Action Scripts** —
   industry-standard interop without changing RDS' internal step model.
5. **Expose RDS' MCP tools against RokDock's deeplink/RASP automation** —
   one MCP-driven AI agent could drive both apps.
6. **Share an internal `paramount-streaming` `roku-shared` package** for
   ECP/digest-auth/SSDP/RASP types so the two projects stop reimplementing
   them in parallel.

---

*Document is descriptive of state at time of writing. Both projects are
actively versioned (RDS app `2.0.0`; RokDock `1.3.1`); re-verify before citing
specific feature claims in tickets or external comms.*

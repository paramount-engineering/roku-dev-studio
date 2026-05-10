# roku-dev-studio-mcp

Model Context Protocol (MCP) server that lets AI agents (Cursor, Claude Desktop, VS Code, …) drive a Roku from inside their chat. Ships bundled with the Roku Dev Studio Electron app. Users do not install it directly — they enable it from **Settings → MCP Server** in Dev Studio, which writes the launch config (`command`, `args`, `cwd`) into the supported client app(s).

![Settings → MCP Server panel](../../images/SETTINGS_MCP_SERVER.png)

Each row is one supported host (Cursor, Claude Desktop, VS Code, Visual Studio Code Insiders, VSCodium, ChatGPT Desktop, Windsurf). Toggling a row writes / removes only the `roku-dev-studio` entry in that client's MCP config — other entries in the same file are left untouched. **Open Config File** opens the rendered JSON for inspection. Hosts that aren't installed are disabled with an inline hint.

## What an agent actually gets

The server exposes **two surfaces** so the agent can pick the right tool for the job, not be forced to wrap everything in a script:

1. **Direct device ops** — one-shot tools that do exactly one thing and return immediately:
   `keypress`, `launch_app`, `input_text`, `deep_link`, `ecp_query`, `ecp_post`, `rale_command`, `app_function`, `screenshot`, `sideload`, `delete_sideload`, `test_connection`, `scan_devices`, `get_app_icon`, `app_connector_connect`, `app_connector_disconnect`, `telnet_connect`, `get_telnet_log`, `telnet_disconnect`, plus bespoke helpers (`connect_device`, `rale_get_node_by_id`).
2. **Action Scripts** — `validate_script` + `send_script_to_builder`. The script lands in the Action Scripts Builder for the human to review and run; nothing executes automatically.

The picker rule (lives in the server's `instructions`, in the `roku-dev-studio://quick-start.md` resource, and in the `roku-action-script-quickstart` prompt): **single deterministic action → direct op**; **multi-step / conditional / polling / saved-or-reviewed flow → Action Script**.

## End-to-end flow

```
┌────────────────────┐  stdio JSON-RPC 2.0   ┌───────────────────────────┐
│  Agent host        │ ────────────────────▶ │ roku-dev-studio-mcp       │
│  (Cursor, Claude,  │                       │ (Node child process,      │
│   VS Code, …)      │                       │  this package)            │
└────────────────────┘                       └─────────────┬─────────────┘
                                                           │
                                                           │ HTTP loopback
                                                           │ 127.0.0.1:<rand>
                                                           │ + bearer token
                                                           ▼
                                              ┌─────────────────────────┐
                                              │ Dev Studio main process │
                                              │  (apps/roku-dev-studio  │
                                              │   /main/mcp-bridge.ts)  │
                                              └─────────────┬───────────┘
                                                            │
                                       ┌────────────────────┼────────────────────┐
                                       ▼                    ▼                    ▼
                              ┌──────────────┐   ┌──────────────────-┐   ┌──────────────┐
                              │ ECP / device │   │ Renderer (IPC)    │   │ Builder UI   │
                              │ (rokuApi)    │   │  - RALE writes    │   │  (drop a     │
                              │              │   │  - app connector  │   │   script for │
                              │              │   │  - stored creds   │   │   review)    │
                              │              │   │  - toasts         │   │              │
                              └──────┬───────┘   └─────────┬─────────┘   └──────────────┘
                                     │                     │
                                     ▼                     ▼
                             ┌─────────────────────────────────┐
                             │       Roku device (ECP,         │
                             │     RALE/App Connector)         │
                             └─────────────────────────────────┘
```

The contract on each hop:

| Hop | Transport | Auth | Format |
| --- | --- | --- | --- |
| Agent ↔ MCP server | stdio | none (host owns the process) | line-delimited JSON-RPC 2.0 |
| MCP server ↔ Dev Studio bridge | localhost HTTP (`127.0.0.1`, random port) | per-launch bearer token | JSON request / JSON response |
| Dev Studio main ↔ renderer | Electron `ipcMain`/`webContents.send` | in-process | typed channels (`shared/ipc/channels.ts`) |
| Dev Studio ↔ Roku device | ECP over HTTP / App Connector / sideload upload | dev-mode password where required | XML / JSON / multipart |

### A typical session

1. **Launch.** The MCP host (e.g. Cursor) spawns `dist/index.cjs` as a child process and reads/writes JSON-RPC frames over stdin/stdout.
2. **Initialize.** The host calls `initialize`. The server responds with capabilities (`tools`, `resources`, `prompts`) and a short `instructions` string sourced from `prose/server-instructions.md`.
3. **Discover surface.** The agent (or user via the host UI) lists `tools/list`, `resources/list`, `prompts/list`. For first-session priming the agent typically reads `roku-dev-studio://quick-start.md` once and (only if it's authoring a script) `roku-dev-studio://capability-bundle.json`.
4. **Probe the bridge.** First live action calls `probe_bridge`. The server reads `<userData>/mcp-bridge.json`, verifies the listed `pid` is alive, and either returns `{ live: true, port, pid, startedAt }` or `{ live: false, reason }`. If `false`, the agent stops and tells the user to open Dev Studio.
5. **Pick a surface and execute.**
   - **Single action:** the agent calls a direct op (e.g. `keypress`). The server posts to `POST /op/<id>` on the bridge with bearer auth. The bridge resolves `device` → `ip`, may fill a remembered dev password from the renderer, runs the op via `roku-dev-studio-api`, and returns the result. Destructive ops (`launch_app`, `ecp_post`, `sideload`, `delete_sideload`, `screenshot`, destructive `rale_command`s) emit a non-blocking toast back to the renderer (`McpBridgeAgentAction`) so the user always sees what the agent did.
   - **Action Script:** the agent calls `validate_script`. If `ok: false` the response is `isError: true` with structured `errors[]` (path / code / expected) for self-correction. Once `ok`, the agent calls `send_script_to_builder`. The bridge IPCs the script to the renderer, the Builder UI opens with the script staged for review, and the human runs it.
6. **Shutdown.** When Dev Studio quits it removes `mcp-bridge.json` and closes the HTTP server. Subsequent `probe_bridge` calls return `live: false`.

## Source layout

```
src/
├── index.ts                ← stdio JSON-RPC 2.0 transport + dispatch
├── tools.ts                ← tool catalog (BESPOKE_TOOLS + auto-generated OP_BACKED_TOOLS)
├── resources.ts            ← MCP resources (quick-start.md, action-script-contract.md, capability-bundle.json, authoring-rules.json)
├── prompts.ts              ← MCP prompts + tiny `{{var}}` renderer
├── agent-contract.ts       ← re-exports the script-authoring contract string
├── validator.ts            ← Action Script validator (mirrors roku-dev-studio-api)
├── bridge-client.ts        ← HTTP client for the Dev Studio bridge (token + descriptor lookup)
├── prose/                  ← all long-form prose lives here, NOT inline in TS
│   ├── server-instructions.md
│   ├── action-script-contract.md
│   ├── quick-start.md
│   └── prompts/
│       ├── one-shot-action.md
│       ├── action-script-quickstart.md
│       └── debug-device.md
└── prose.d.ts              ← `declare module '*.md'` so TS types `.md` imports as string

build.mjs                   ← esbuild bundle (CJS, single file, .md inlined via text loader)
dist/index.cjs              ← what ships and what hosts spawn
```

esbuild's `text` loader inlines every `.md` import at build time — the dist is a single self-contained CJS file with no runtime filesystem reads of prose. To edit any agent-facing copy, edit the markdown file and rebuild.

## Tool catalog (what `tools/list` returns)

### Bespoke (hand-written)

| Tool | Live? | Notes |
| --- | --- | --- |
| `list_action_types`, `get_action_schema` | static | Action Script step types & per-type schema. |
| `get_capability_bundle` | static | Full static catalog + `actionScriptAgentContract`. Load **once**. |
| `validate_script` | static | Runs the authoring validator; returns `isError` with structured `errors[]` on failure. |
| `probe_bridge` | hybrid | Read-only descriptor probe — works whether or not Dev Studio is up. |
| `get_selected_device`, `list_devices`, `connect_device` | live | Device picker. |
| `list_app_connector_functions` | live | RALE `getExternalControlFunctions` for the focused channel. |
| `rale_get_node_by_id` | live | Read-only SceneGraph lookup (wraps `rale_command`'s `getNodeById`). |
| `send_script_to_builder` | live | Pushes a validated Action Script into the Builder UI for human review. |

### Auto-generated from `roku-dev-studio-api/lib/operations.ALL_OPS`

Every entry in `ALL_OPS` is wired into the MCP catalog by `opToMcpTool` in `tools.ts`. Today that produces these tools, each with `annotations` set from the op descriptor:

`keypress`, `launch_app`, `input_text`, `deep_link`, `ecp_query`, `ecp_post`, `test_connection`, `get_app_icon`, `sideload`, `delete_sideload`, `screenshot`, `scan_devices`, `rale_command`, `app_connector_connect`, `app_connector_disconnect`, `app_function`, `get_telnet_log`, `telnet_connect`, `telnet_disconnect`.

The `ip` field on the op's input schema is rewritten into an agent-friendly `device: <IP or serial>` field by `agentFacingSchema`; the bridge resolves `device` back to `ip` server-side.

### Annotations (MCP 2025-03-26 hints)

Every tool ships with `annotations` so hosts can make safe-by-default UI decisions without parsing prose:

| Hint | Meaning |
| --- | --- |
| `readOnlyHint: true` | Safe to call without confirmation. |
| `destructiveHint: true` | May reboot/launch/sideload — host should prompt the user. |
| `idempotentHint: true` | Same args produce the same result. |
| `openWorldHint: true` | Touches an external device or the network. |

For op-backed tools these come straight from the op's `destructive` flag. For bespoke tools they're set inline in `tools.ts`.

## Resources

Lazy-loaded via `resources/list` + `resources/read`. Bodies are sourced from `src/prose/`.

| URI | Purpose |
| --- | --- |
| `roku-dev-studio://quick-start.md` | One-page primer: surface picker, probe, device picking, script vs op recipes. **Read first.** |
| `roku-dev-studio://action-script-contract.md` | Canonical JSON shape for `validate_script` / `send_script_to_builder`. |
| `roku-dev-studio://capability-bundle.json` | Same JSON as `get_capability_bundle` — actions, vocabularies, RALE built-ins, presets, authoring rules, op directory, the agent contract. Load **once**, cache. |
| `roku-dev-studio://authoring-rules.json` | Hard authoring rules in machine-readable form. |

## Prompts

Surfaced in hosts' prompt picker. `getPrompt(name, args)` substitutes `{{var}}` placeholders against precomputed conditional sections.

| Prompt | Args | Use |
| --- | --- | --- |
| `roku-one-shot-action` | `action` (required), `device` (optional) | Primes the agent to call **one direct op** for a single deterministic task and explicitly *not* author a script. |
| `roku-action-script-quickstart` | `goal` (optional) | Primes the agent for the multi-step authoring flow (probe → load → validate → send). |
| `roku-debug-device` | `device` (optional) | Read-only inspection workflow (probe → list / get-selected → ecp_query / rale_get_node_by_id). |

## Bridge protocol (Dev Studio main process)

The bridge lives at `apps/roku-dev-studio/main/mcp-bridge.ts`. It starts on Electron's `ready` event (regardless of whether any host is currently using MCP) and stops on `will-quit` — **not** `before-quit`, which is preventable and would leave the bridge stranded if any window cancels the quit (e.g. the settings window's `close` handler). A periodic watcher re-writes the descriptor file if it disappears while we're still listening. See `.discussion-docs/engineering-principles.md` §19 for the full rationale.

### Descriptor

`<userData>/mcp-bridge.json` (mode `0600`):

```json
{
  "port": 49231,
  "token": "<32-byte hex>",
  "pid": 21847,
  "startedAt": "2026-04-28T13:55:09.123Z"
}
```

Per-launch token. Removed on shutdown. `userData` matches Electron's `app.getPath('userData')` for app name `Roku Dev Studio`. Override for tests with `RDS_MCP_BRIDGE_FILE=/abs/path`.

### Endpoints

| Path | Verb | Used by | Notes |
| --- | --- | --- | --- |
| `/health` | GET | smoke tests | `{ ok, pid }` |
| `/selected-device` | GET | `get_selected_device` | Last snapshot pushed by the renderer. |
| `/devices` | GET | `list_devices` | Connected + known + selected serial. |
| `/app-connector/functions` | GET | `list_app_connector_functions` | Borrows a renderer fetch (`McpBridgeFunctionsRequest`); returns `{ status, functions, fetchedAt }`. |
| `/op/<id>` | POST | every main-direct op tool | Generic dispatcher: looks up the op via `roku-dev-studio-api.findOp`, resolves `device` → `ip`, fills password from renderer if needed, runs `runOpForHttp`. |
| `/tool` | POST | renderer-routed tools (full `rale_command`, `app_connector_*`, telnet send) | Round-trips to the active renderer via `McpBridgeToolRequest/Result`. |
| `/connect-device` | POST | `connect_device` | Round-trips to the renderer to open / focus a tab. Idempotent. |
| `/builder/drop-script` | POST | `send_script_to_builder` | Round-trips to the renderer; Builder opens with the script staged. |
| `/ecp-query`, `/keypress`, `/launch`, `/input-text`, `/deep-link`, `/ecp-post`, `/sideload`, `/delete-sideload`, `/screenshot`, `/scan-devices`, `/get-app-icon`, `/test-connection`, `/rale/get-node-by-id` | POST | back-compat | Older per-op aliases kept for stability. New code should prefer `/op/<id>`. |

Every request requires `Authorization: Bearer <token>`. Anything else returns `401 Unauthorized`.

### Renderer round-trips

For tools that need live RALE / App Connector / Builder access, the bridge IPCs into the focused renderer with a correlation id and waits for the matching result. Channels (defined in `apps/roku-dev-studio/shared/ipc/channels.ts`):

| Request | Result | Used for |
| --- | --- | --- |
| `McpBridgeReportState` | (renderer → main only) | Renderer pushes `{ selectedDevice, connectedDevices, knownDevices, appConnector }` whenever they change. The bridge serves the latest snapshot to GET endpoints. |
| `McpBridgeFunctionsRequest/Result` | – | Live App Connector Function list. |
| `McpBridgeRaleRequest/Result` | – | Read-only RALE `getNodeById` (legacy single-purpose). |
| `McpBridgeToolRequest/Result` | – | Generic dispatch for renderer-owned tools (full `rale_command` writes, `app_connector_connect`/`disconnect`, telnet). |
| `McpBridgeConnectRequest/Result` | – | Open / focus a device tab. |
| `McpBridgeDropScript / McpBridgeDropScriptResult` | – | Drop a validated script into the Builder. |
| `McpBridgeStoredPasswordRequest/Result` | – | When the agent omits `password` for `sideload` / `delete_sideload` / `screenshot`, the bridge asks the renderer for the value the user told the device panel to **Remember**. Never written to disk by the bridge. |
| `McpBridgeAgentAction` | (main → renderer) | Non-blocking toast on agent-initiated actions; destructive ops use `level: 'destructive'`, others `info`. |

### Password handling

Dev passwords are never sent through the protocol unless the agent explicitly passes one. For `sideload`, `delete_sideload`, and `screenshot` the bridge asks the renderer for the saved password keyed by the device's serial (same storage as the device panel's "Remember" toggle). If no password is remembered and none was passed, the bridge returns 400 with a clear hint.

The dev password is **never** allowed inside Action Script JSON — `validate_script` rejects scripts containing literal `password` / `devPassword` values.

## Build, run, develop

```bash
# Install (root of monorepo handles workspace wiring).
npm install

# Type-check.
npm run typecheck            # tsc --noEmit

# Bundle.
npm run build                # node build.mjs → dist/index.cjs (≈143 KB)

# Manual smoke test against the bundle.
node dist/index.cjs <<EOF
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
EOF
```

The bundle is also runnable from Electron in pure-Node mode via `ELECTRON_RUN_AS_NODE=1 electron dist/index.cjs`.

### Wiring an MCP host manually (without Dev Studio's Settings UI)

Most hosts expect a JSON config block like:

```json
{
  "mcpServers": {
    "roku-dev-studio": {
      "command": "node",
      "args": ["/abs/path/to/packages/roku-dev-studio-mcp/dist/index.cjs"]
    }
  }
}
```

Dev Studio's **Settings → MCP Server** writes this for you (with the correct absolute path) into Cursor, Claude Desktop, and VS Code config files.

### Postman collection

`postman/roku-dev-studio-mcp.postman_collection.json` exercises every bridge endpoint with example bodies. Useful for diffing wire shape after a refactor.

## Adding things

### A new direct op

Almost always: just add the descriptor to `roku-dev-studio-api/lib/operations.ts` and the bridge handler logic in `apps/roku-dev-studio/main/mcp-bridge.ts` (if it's not already covered by `/op/<id>`'s generic dispatcher). The MCP server picks the new op up automatically — `OP_BACKED_TOOLS` reads `ALL_OPS` at module load, the agent-facing schema rewrite happens for free, and the annotations come from the op's `destructive` flag.

### A new bespoke tool

Add an entry to `BESPOKE_TOOLS` in `src/tools.ts` with `name`, `title`, `description`, `inputSchema`, `annotations`, and `handler`. Keep the description short and steer agents toward direct ops where appropriate (see the existing `validate_script` / `send_script_to_builder` descriptions for the picker-rule pattern).

### A new prompt

Add a `.md` body under `src/prose/prompts/` (use `{{name}}` for any args, compute conditional sections in TS), then register it in `src/prompts.ts` (`PROMPTS` array + a render function + a `getPrompt` branch).

### A new resource

Add a `.md` or `.json` body, import it at the top of `src/resources.ts`, and add an entry to `RESOURCES` plus a `case` in `readResource`. esbuild's text loader handles the inlining.

### Editing agent-facing prose

Edit the `.md` file under `src/prose/`. Run `npm run build`. The new copy ships next time the host restarts the MCP child process. (For Cursor: toggle the server off / on in Settings → MCP, or restart Cursor.)

## Refreshing Cursor's descriptor cache

Cursor caches the tool / resource / prompt list at `~/.cursor/projects/<project>/mcps/user-roku-dev-studio/`. After rebuilding the MCP server you need to make Cursor re-fetch:

1. **Cursor → Settings → MCP** → toggle `user-roku-dev-studio` off, then on. Cursor respawns the child process and re-runs discovery.
2. *Or* `rm -rf ~/.cursor/projects/<project>/mcps/user-roku-dev-studio` and restart Cursor.

After refresh you should see 30 tools (11 bespoke + 19 op-backed), 4 resources, and 3 prompts in the descriptor folder. To re-derive these counts after edits, `rg "^\s*name: '" src/tools.ts | wc -l` for bespoke tools, and `rg "^\s*id:\s*'" ../../packages/roku-dev-studio-api/lib/operations.ts | wc -l` for op-backed tools.

## Design background

`.discussion-docs/mcp-server-action-scripts.md` carries the original v1 design proposal plus a **Status (2026-04)** block describing what shipped and where the design has since evolved (notably: writes-as-direct-ops with `destructiveHint`, prose moved into `src/prose/`, picker-rule embedded in instructions/contract/quick-start).

---

## License

Released under the [MIT License](../../LICENSE). This package has no third-party runtime dependencies beyond the workspace's `roku-dev-studio-api` (whose own dependencies are listed in [its README](../roku-dev-studio-api/README.md#license)).

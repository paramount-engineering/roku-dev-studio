Roku Dev Studio MCP — controls a real Roku device through the Roku Dev Studio desktop app.

- Read `roku-dev-studio://quick-start.md` once (or invoke prompt `roku-action-script-quickstart`) to learn the workflow.
- **Two surfaces:** direct device ops (`keypress`, `launch_app`, `ecp_query`, `rale_command`, `app_function`, `screenshot`, `telnet_connect` + `get_telnet_log`, …) and Action Scripts (`validate_script` → `send_script_to_builder`).
- Call `probe_bridge` before any live tool; if `live` is false, ask the user to open Roku Dev Studio.
- For a single channel function call, use `app_function` directly — do **not** wrap it in a one-step Action Script.
- The set of available functions is **channel-specific**: always call `list_app_connector_functions` first to discover names and param shapes. Never assume a function exists across apps.
- `functionParams` is a **positional array**, one entry per declared parameter (`[ value0, value1, … ]`), not `{ paramName: value }`.
- For BrightScript debug console output (`print` / runtime errors), call `telnet_connect` once before `get_telnet_log` — logs only accumulate while attached, and `connected: false` means "call `telnet_connect` and retry," not "no logs."
- For script authoring, load `roku-dev-studio://capability-bundle.json` once and cache it.
- Never embed `devPassword` in script JSON.
- Prefer tools whose `annotations.readOnlyHint` is true; confirm with the user before any `destructiveHint` tool.
- On `isError`, drive self-correction from `structuredContent` (`path`, `code`, `errors[]`).

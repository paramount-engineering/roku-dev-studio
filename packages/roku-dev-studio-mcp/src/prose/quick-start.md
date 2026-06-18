# Roku Dev Studio MCP — Quick Start

You are connected to the **roku-dev-studio** MCP server. It controls a Roku
device through the Roku Dev Studio desktop app and exposes **two surfaces**:

1. **Direct device ops** — one-shot tools that do exactly one thing:
   `keypress`, `launch_app`, `input_text`, `deep_link`, `ecp_query`,
   `ecp_post`, `rale_command`, `app_function`, `screenshot`, `sideload`,
   `delete_sideload`, `test_connection`, `scan_devices`,
   `get_app_icon`, `app_connector_connect` /
   `app_connector_disconnect`, `rale_get_node_by_id`,
   `telnet_connect` / `telnet_disconnect` / `get_telnet_log`.
2. **Action Scripts** — `validate_script` + `send_script_to_builder`.
   A script opens in the Builder UI for the human to review. Nothing runs
   automatically.

## 0. Pick the surface **before** picking tools

- **Single deterministic action** — "press Home", "launch YouTube",
  "send one POST", "run one RALE command", "GET /query/active-app",
  "take a screenshot" → call the **direct op**. Do **not** author a script
  just to wrap a single call.
- **Multi-step flow, conditional logic (`if`), polling wait
  (`wait` with a condition), variables, or something the user wants to
  save / share / re-run / review first** → author an **Action Script**.
- Rule of thumb: if you would write one tool call, make one tool call.
  Wrap it in a script only when you would otherwise put a
  `while` / `if` / `for` around it or when the user explicitly asked
  for a saved artifact.

## 1. Before doing anything (once per session)

```
probe_bridge        → { live, port, pid, startedAt } | { live: false, reason }
```

If `live` is **false**, stop and tell the user to open Roku Dev Studio.
After one successful probe, call bridge-dependent tools (direct ops **and**
`send_script_to_builder`) freely — no need to re-probe before each call.

## 2. Load authoring knowledge **once** and cache it (only if authoring a script)

Read the resource `roku-dev-studio://capability-bundle.json` (or call
`get_capability_bundle`). It contains every static catalog you need:

- action step schemas (keys of `actions`)
- keypress / query / post presets
- wait + if vocabularies (media-player states, active-app attributes)
- RALE node-field operators + RALE built-ins
- authoring rules (hard constraints)
- op directory (main vs renderer)
- the full **actionScriptAgentContract** (exact JSON shape + the
  direct-vs-script decision)

Do not re-fetch each turn. It does not change during a session. If you are
only making one direct-op call you usually do **not** need the bundle at all.

## 3. Picking a device

```
list_devices                    → every known device (connected + discovered)
get_selected_device             → the currently-focused Dev Studio tab
connect_device({ device: "..." })   → open a tab (IP or serial)
```

For every tool that talks to a device, `device` is **optional** — omit to
target the focused tab.

## 4. Doing a single action (direct ops path)

Examples of tasks that should be one tool call, not a script:

```
keypress({ key: "Home" })                 // press Home on the focused device
launch_app({ appId: "837" })              // launch YouTube
input_text({ text: "hello" })             // type into the focused input
ecp_query({ endpoint: "/query/active-app" })
ecp_post({ endpoint: "/keypress/Home" })  // side-effecting POST
rale_command({ command: "getNodeById",
               args: { path: [], id: "my-node" } })
app_function({ functionName: "<from-list_app_connector_functions>",
               functionParams: [ /* positional values per the function's params */ ] })
                                          // call one channel function via App Connector
screenshot({})                            // capture current screen
```

All of them return immediately. Pick them over Action Scripts whenever the
task is a single, deterministic action.

### 4a. App Connector Functions

When the user asks you to invoke one function on the sideloaded channel,
**use `app_function`, not an `appFunction` Action Script step.**

The function names a channel exposes are **entirely channel-specific** —
every sideloaded app exports its own (function names mentioned in your
training data, this report, or any prior chat are illustrative only and
will not exist on another channel). Never assume; always discover.

Recipe:

1. `list_app_connector_functions({ device? })` — discover the exact
   `name`, read its declared `params[]` (each entry has a `name` and
   a `type`, in declaration order), and read the optional `description`
   string when present (channel-supplied, surface it verbatim to the user).
2. `app_function({ functionName, functionParams: [ ...positional values... ] })`.
   The tool auto-establishes the App Connector session if not already
   open.

#### `functionParams` shape

`functionParams` is a **positional array** with one entry per declared
parameter, in declaration order. The entry types match the `type` field
on each declared param:

- declared `String` / `Integer` / `Boolean` / number types → primitive
- declared `roAssociativeArray` → JSON object (still wrapped in the outer array slot)
- declared `roArray` / `roList` → JSON array (still wrapped in the outer array slot)
- zero declared params → `[]`

A named object keyed by the declared param names
(`{ "<paramName>": value }`) is tolerated for backward compatibility
and rewritten to a positional array before the call is sent — but
**do not author new calls in named-object form**: a typo in a key
silently passes `undefined` for that slot.

#### Shape templates

| Declared `params[]`                                  | `functionParams` you send  |
| ---                                                  | ---                        |
| `[]` (zero-arg)                                      | `[]`                       |
| `[{ name, type: "String" }]`                         | `[ "<value>" ]`            |
| `[{ name, type: "roAssociativeArray" }]`             | `[ { /* fields */ } ]`     |
| `[{ name, type: "roArray" }]`                        | `[ [ /* items */ ] ]`      |
| `[{ name: a, type: T0 }, { name: b, type: T1 }]`     | `[ <a-value>, <b-value> ]` |

Generic shape (substitute `<FunctionName>` and the values from
`list_app_connector_functions`):

```
app_function({
  functionName: "<FunctionName>",
  functionParams: [
    /* one entry per declared param, in RALE order;
       use [] when the function takes no parameters */
  ]
})
```

Note the **outer array wrapping** in the single-`roAssociativeArray`
case. Sending the associative payload directly (no enclosing `[ ]`)
is a different shape than what the channel reads, and the call will
silently no-op at runtime.

Only wrap an app function in an `appFunction` Action Script step when
the call is part of a larger flow (e.g. connect → call → wait for
media-player state → screenshot). One function call in isolation should
never be a one-step script.

## 5. Authoring a script (script path)

1. Read `roku-dev-studio://action-script-contract.md` (or field
   `actionScriptAgentContract` from the bundle).
2. For any `appFunction` step, call
   `list_app_connector_functions` so `functionName` and
   `functionParams` keys/order match the sideloaded channel.
3. Call `validate_script({ script })` and fix every entry in `errors[]`
   until `ok: true`. The response includes `path`, `code`, and
   `expected` per issue.
4. Hand off with `send_script_to_builder({ script })`. This drops the
   script into the Builder UI for the human to review and run — it does not
   auto-execute.

Never embed the Dev Password in script JSON. Dev Studio supplies it from
local storage at run time.

## 6. Live read-only lookups

```
ecp_query({ endpoint, device? })             → any ECP query
rale_get_node_by_id({ id, path?, device? })  → scene graph read
```

Use these directly for inspection — don't wrap them in a script.

## 7. BrightScript debug console (telnet on port 8085)

Reading `print` output / runtime errors from a sideloaded channel is a
**three-step** flow. The Roku 8085 socket is single-client, so logs only
accumulate while Dev Studio is actively attached.

```
telnet_connect({ device? })                  → attach the 8085 socket (idempotent)
get_telnet_log({ device?, afterCursor?, maxLines? })
                                              → { lines, cursor, totalLines, connected }
telnet_disconnect({ device? })               → release the socket (idempotent)
```

Recipe — "show me what the channel just printed":

1. `telnet_connect({})` once. (Skip if a previous call already returned
   `{ connected: true }`.)
2. Trigger whatever you want to observe (`keypress`, `launch_app`,
   `appFunction` step, …).
3. Poll `get_telnet_log({ afterCursor })` — pass back the `cursor` from the
   previous response so you only get **new** lines. Default page size is
   500, max 2000.
4. Optional: `telnet_disconnect({})` if you're done so other tools / IDEs
   can attach to 8085 again.

If `get_telnet_log` returns `connected: false`, the buffer is empty
because nothing is attached — call `telnet_connect` and retry rather than
reporting "no logs". Connecting may displace another client (e.g. a
BrightScript IDE) that currently holds 8085; surface that to the user when
relevant.

## 8. Tools are tagged

Every tool carries MCP `annotations`:
- `readOnlyHint` — safe to call without confirmation
- `destructiveHint` — may reboot/launch/sideload; confirm with the user
- `idempotentHint` — same args yield the same result
- `openWorldHint` — touches an external device/network

Prefer `readOnlyHint` tools for exploration; get user consent before any
`destructiveHint` tool.

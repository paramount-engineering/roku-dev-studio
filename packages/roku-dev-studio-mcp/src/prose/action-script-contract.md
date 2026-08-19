## Action Script JSON (validate_script / send_script_to_builder)

### When to use Action Scripts vs direct ops

This server exposes two ways to act on a Roku — **before** authoring a script, confirm it is the right surface.

1. **Direct ops** — one-shot tools that do exactly one thing: `keypress`, `launch_app`, `input_text`, `deep_link`, `ecp_query`, `ecp_post`, `rale_command`, `app_function`, `screenshot`, `sideload`, `delete_sideload`, `test_connection`, `scan_devices`, `get_app_icon`, `app_connector_connect` / `app_connector_disconnect`, `rale_get_node_by_id`, `telnet_connect` / `telnet_disconnect` / `get_telnet_log`.
2. **Action Scripts** — `validate_script` + `send_script_to_builder`. The script opens in the Builder for human review; nothing runs automatically.

**Pick a direct op when:**
- The task is a single deterministic action (press Home, launch YouTube, send one POST, run one RALE built-in, **call one App Connector Function** via `app_function`, read `/query/active-app`, take one screenshot).
- You do not need ordering, conditions, polling waits, variables, or user review.
- The user asked you to "just do X" without asking for a saved / shareable script.

**Specifically for App Connector Functions:** use the **`app_function`** direct tool, not an `appFunction` script step. The script step is only for when the function call is part of a multi-step flow (e.g. connect → call → wait for player state → screenshot). One function call in isolation should never be a one-step script.

The set of functions a channel exposes is entirely channel-specific — every sideloaded app exports its own (the function names visible in this report or any chat history are examples from one specific channel and will not exist on another). **Always call `list_app_connector_functions` first** to read the exact names and declared param shapes for the running channel before you author the call.

**Pick an Action Script when:**
- The task has **multiple ordered steps**, **conditional logic** (`if`), **polling waits** (`wait` with a condition), **variables**, or **screenshots tied to a repro flow**.
- The user wants to **save, share, or re-run** the flow later.
- The task is destructive enough that the user should **review it before running** (sideload + launch + deep-link combos, bulk registry writes, unfamiliar POST endpoints).

**Rule of thumb:** if you would write a single direct-op call, call it directly. Only wrap it in a script when you would otherwise write a `while`/`if`/`for` around it or when the user explicitly wants a saved artifact.

### Root object
- `version`: optional string `"1"` (default) or `"2"`. **Required `"2"`** if any step has `"type": "if"`.
- `steps`: **required** array of step objects. Every step **must** include `"type"` (see list_action_types / get_action_schema).

### appFunction steps

**Prefer the `app_function` direct tool** for a single function call. Only use this step when the call is part of a larger script.

Discovery first: call **`list_app_connector_functions`** to read the channel's function list. Each entry has `name`, `params: [{ name, type }, …]`, and an optional `description` string when the channel includes one in its payload. The function names, parameter shapes, and descriptions are channel-specific — do not assume a function exists across apps. Surface the `description` verbatim to the user when explaining what a function does.

#### Step shape

- `type`: `"appFunction"`.
- `functionName`: string — exactly one of the names returned by `list_app_connector_functions`.
- `functionParams`: **a positional array** with one entry per declared parameter, in declaration order. Each entry's value matches the declared `type`:
  - declared `type: "String"` → JSON string
  - declared `type: "Boolean"` → JSON boolean
  - declared `type: "Integer" | "LongInteger" | "Float" | "Double"` → JSON number
  - declared `type: "roAssociativeArray"` → JSON object (still wrapped in the outer array slot)
  - declared `type: "roArray" | "roList"` → JSON array (still wrapped in the outer array slot)
  - zero declared params → `[]`
- `assignToVar` (optional): string — variable name to bind the return value to for later steps.

The list of supported declared types is fixed by the channel-side App Connector implementation and is documented in the in-app **Integration Guide** modal (Settings → Integration Guide); the agent does not need to know it beyond what `list_app_connector_functions` returns for the running channel.

#### Shape templates

(Substitute `<FunctionName>` and the values for whatever `list_app_connector_functions` returned.)

| Declared `params[]`                                  | `functionParams` you send  |
| ---                                                  | ---                        |
| `[]` (zero-arg)                                      | `[]`                       |
| `[{ name, type: "String" }]`                         | `[ "<value>" ]`            |
| `[{ name, type: "roAssociativeArray" }]`             | `[ { /* fields */ } ]`     |
| `[{ name, type: "roArray" }]`                        | `[ [ /* items */ ] ]`      |
| `[{ name: a, type: T0 }, { name: b, type: T1 }]`     | `[ <a-value>, <b-value> ]` |

Two-arg example (e.g. one String + one Boolean):

```json
{
  "type": "appFunction",
  "functionName": "<FunctionName>",
  "functionParams": [ "<string-value>", true ]
}
```

Single-`roAssociativeArray` example — note the **outer one-element array wrapping** the object payload:

```json
{
  "type": "appFunction",
  "functionName": "<FunctionName>",
  "functionParams": [
    { /* fields */ }
  ]
}
```

#### Common shape mistake

Sending the inner object directly without the outer array — e.g. `"functionParams": { "fooKey": …, "barKey": … }` — is a different shape than what the channel reads, and the call will silently no-op at runtime.

Validation and the runtime tolerate two non-canonical shapes for backward compatibility, but **do not author them**:

1. A named object keyed by the declared param names (`"functionParams": { "<paramName>": value }`) — both runtimes auto-rewrite it to a positional array using the function list. Relies on every key matching a declared param name exactly; a typo silently passes `undefined` for that slot.
2. The same single object as above but missing the param-name key — silently treated as a single positional value with mismatched declared type.

The validator only hard-rejects primitive values (string / number / boolean) for `functionParams`, where there's nothing to normalize.

### wait steps (condition.source === "media-player")
- Either `delayMs` (number, fixed wait) **or** `condition` (object).
- For media-player, set `"source": "media-player"` explicitly. Satisfy the wait with **any one** of:
  - `state`: one of **play | pause | buffer | close | startup | stop** (the media-player state vocabulary in `get_capability_bundle`), or
  - `check`: string expression evaluated against parsed player XML, or
  - RALE-style: `field: "state"`, `operator: "equals"`, `value`: same state vocabulary as above.
- Common optional fields: `timeoutMs`, `pollIntervalMs`.

### wait / if — rale-node-field
- `path`: array (use `[]` for root), `id`: string, `field`: string, `operator`, `value` when the operator requires it. See the RALE node-field operators in `get_capability_bundle`.

### Other rules
- See the authoring rules in `get_capability_bundle` (or read `roku-dev-studio://authoring-rules.json` directly) for hard constraints — e.g. never embed `devPassword` in JSON.
- **device** on bridge tools: optional string — Roku **IP** or **serial**; omit to use the device tab the user has focused in Dev Studio.

### Suggested tool order for authoring
1. `probe_bridge`
2. `get_capability_bundle` (covers authoring rules too — no separate call needed)
3. `list_app_connector_functions`
4. `validate_script` — fix every entry in `errors[]` until `ok: true`
5. `send_script_to_builder`

### Reading tool results
- Success and validation responses are JSON in the tool **text** content and in **structuredContent** when the host supports it.
- On validation failure, **humanSummary** lists each issue on one line; **errors[]** has `path`, `code`, `message`, and often `expected` for enums.

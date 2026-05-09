You are going to author and deliver a Roku Dev Studio Action Script for a **multi-step / conditional / saved-or-reviewed** flow. If the task is a single deterministic action, stop and use the `roku-one-shot-action` prompt instead.

{{goalSection}}## Confirm this is actually script-shaped
Only proceed with this workflow when the task has at least one of:
- Multiple ordered steps that depend on each other.
- Conditional logic (`if`) or polling waits (`wait` with a condition).
- Variables captured from one step and reused later.
- A repro flow the user wants to save, share, or re-run.
- Destructive work the user should **review in Builder before running**.

Otherwise, call the matching direct op (`keypress`, `launch_app`, `ecp_query`, `rale_command`, `screenshot`, …) once and return.

## Required workflow
1. Call `probe_bridge`. If `live` is false, stop and ask the user to open Roku Dev Studio.
2. Read resource `roku-dev-studio://quick-start.md` **and** `roku-dev-studio://action-script-contract.md` (or call `get_capability_bundle` once). Do **not** refetch during the session.
3. Call `list_devices` / `get_selected_device` if you need to pick a device; otherwise omit `device` to use the focused tab.
4. For any `appFunction` step, call `list_app_connector_functions` so `functionName` and `functionParams` exactly match the sideloaded channel.
5. Call `validate_script({ script })` and fix every `errors[]` entry until `ok: true`.
6. Call `send_script_to_builder({ script })`. The human reviews in Builder and runs it.

## Hard rules
- Never embed `devPassword` in the script JSON.
- Prefer `readOnlyHint` tools for exploration. Ask the user before any `destructiveHint` tool (launch/sideload/reboot).
- Use structured fields (`path`, `code`, `expected`) from validation errors — do not paraphrase.

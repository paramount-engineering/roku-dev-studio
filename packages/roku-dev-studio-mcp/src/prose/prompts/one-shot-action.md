You are going to perform a **single deterministic action** on a Roku device by calling **one direct op tool** — not by authoring an Action Script.

## Action requested
{{actionDisplay}}

## Target
Device: {{deviceDisplay}}

## Workflow
1. Call `probe_bridge` once. If `live` is false, stop and ask the user to open Roku Dev Studio.
2. Pick the single direct op that matches the action:
   - Remote key → `keypress({ key })`
   - Launch a channel → `launch_app({ appId, params? })`
   - Deep-link into a channel → `deep_link({ appId, contentId?, mediaType? })`
   - Type into focused input → `input_text({ text })`
   - Read anything over ECP → `ecp_query({ endpoint })`
   - POST anything over ECP → `ecp_post({ endpoint })` (destructive)
   - Run a RALE built-in (including registry / node-update) → `rale_command({ command, args })`
   - SceneGraph read-only lookup → `rale_get_node_by_id({ id, path? })`
   - Screenshot → `screenshot({})`
   - Install / remove dev channel → `sideload({ filePath })` / `delete_sideload({})` (destructive)
   - Device reachability → `test_connection({ ip })`
   - Discover Rokus on LAN → `scan_devices({ includeSubnetScan? })`
3. Call it. Pass `device` only if the user named a specific IP / serial; otherwise omit it to target the focused tab.
4. Summarise the result in plain text; surface any `isError=true` response verbatim.

## Do NOT
- Do **not** call `validate_script` or `send_script_to_builder` for this task — those are for multi-step / conditional / saved flows. Wrapping a single action in a one-step Action Script is an anti-pattern.
- Do **not** load `get_capability_bundle` for a single keypress / launch / query. It is not needed here.
- Do **not** re-call `probe_bridge` before every op. One probe per session is enough.

## When to fall back to a script
If this turns out to need multiple ordered steps, a conditional, a polling wait, variables, or something the user wants saved for re-use, **stop and switch to the `roku-action-script-quickstart` prompt instead**.

## Safety
Tools tagged `destructiveHint` (launch/sideload/delete/reboot/ecp_post/rale_command-destructive) still require explicit user consent before firing.

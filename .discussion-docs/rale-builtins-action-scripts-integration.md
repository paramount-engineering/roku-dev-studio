# Integrating RALE builtins into Action Scripts

This note describes how the **inspector-only RALE builtins** (node lookup, registry helpers, etc.) surface in **Action Scripts** so automation can use the same capabilities as the App Connector panel.

**Scope:** Where this doc says to prefer **simple, string-oriented** validation and scripting ergonomics, that applies **only to the Action Scripts layer** (steps, builder, executor). The **inspector** keeps its existing UX (dropdowns, typed inputs, registry pickers). Shared helpers may normalize **into** script-friendly shapes at the Action Scripts boundary without changing inspector behavior.

## Decision: new step type `raleCommand`

We use a **dedicated action type** for direct RALE commands. It is separate from `appFunction` (which remains **only** for `executeExternalControlFunction` + app-registered names from `getExternalControlFunctions`).

**Example step:**

```json
{
  "type": "raleCommand",
  "command": "getNodeById",
  "args": { "path": [], "id": "myLabelId" }
}
```

**Rationale:** Serialized scripts stay explicit (`command` + `args`); no overloading `functionName`; validation and builder can be command-centric against a fixed catalog (`RALE_BUILTIN_COMMANDS` in `rale-builtins.js`). The tradeoff is a second code path in builder, validator, executor, and step list views—acceptable for clarity.

## Current behavior (two channels)

| Surface | How RALE is invoked | Function discovery |
|--------|---------------------|--------------------|
| **Inspector → Execute Function** | `api.raleCommand(connectionId, <command>, <args>)` for builtins and `executeExternalControlFunction` for app-registered functions | App list from `getExternalControlFunctions`; builtins from `rale-builtins.js` |
| **Action Scripts → `appFunction`** | Only `executeExternalControlFunction` with `functionName` + `functionParams` | Builder / validator use `getExternalControlFunctions` (normalized). Builtin names are **not** in that list. |

Until implementation lands, Action Scripts still cannot run direct RALE commands; this doc defines the **intended** `raleCommand` shape.

**Relevant code anchors (for implementers):**

- Builtin catalog: `apps/roku-dev-studio/renderer/components/inspector/rale-builtins.js`
- Inspector dispatch and argument handling: `apps/roku-dev-studio/renderer/components/inspector/function-execution.js`
- Script execution: `apps/roku-dev-studio/renderer/components/action-scripts/executor-engine.js`
- Registry: `action-registry.js` (`STEP_SCHEMA`), `validator.js`, `builder.js`, `actions-list-view.js`, import modal / executor paths that gate on step types

## Schema (target)

| Field | Type | Notes |
|-------|------|--------|
| `type` | `"raleCommand"` | Required. |
| `command` | `string` | Must be one of the **wire** command names allowed by the catalog (e.g. `getNodeById`, not the `__rale__` selection key). |
| `args` | `object` | Key/value map sent as the second argument to `api.raleCommand(connectionId, command, args)`. Empty object `{}` when the command takes no args. |

The allowed `(command, args shape)` pairs should match what the inspector already sends for each builtin—driven from shared metadata derived from `RALE_BUILTIN_COMMANDS` (command string + per-command validation), not an unconstrained string.

**Not in scope for the serialized step:** UI-only hints like `registryUi` remain inspector concerns; the builder may still fetch sections/keys when connected, but the saved script is always `command` + `args`.

## Goal

- **Single automation story**: scripts can call app functions (`appFunction`) and RALE-level builtins (`raleCommand`) where supported.
- **Consistent semantics**: same command + args as the inspector (path normalization, registry shapes, error handling).
- **Discoverability**: builder offers a command picker and structured/JSON fields; users are not required to guess wire names or arg keys.

Non-goals for a first slice (unless product expands later):

- Duplicating full **node update** flows (`selectNode` / `setField` / `removeField` in `node-update-panel.js`) until stable, script-friendly schemas exist.
- Changing the RALE wire protocol on the device.

## Alternatives considered

### Reuse `appFunction` with dual dispatch (rejected)

Would overload `functionName` with `__rale__…` keys and branch in the executor. Fewer action types, but opaque JSON and mixed semantics in one step type.

### JSON-only / undocumented (rejected)

No builder validation; high error rate.

## Shared logic and consistency

Argument validation and normalization **should not be forked** between inspector and Action Scripts:

- Path normalization for node lookup (`normalizePathArg` and helpers in `node-lookup.js`).
- Registry: `registry-validation.js` and RALE-expected shapes for `addRegistrySection`, etc.

Prefer a small shared helper used by both `function-execution.js` and `executor-engine.js` (e.g. `validateRaleBuiltinArgs(command, args)` → `{ ok, error?, normalizedArgs? }`) so catalog changes stay single-sourced.

Inspector-only response formatting stays in the inspector; the executor keeps short step summaries / JSON snippets like other steps.

## UX and safety

- **Destructive** registry commands (`clearRegistry`, removals) should use the same visible labeling as in `rale-builtins.js` in the builder step type picker and step list.
- **Connection**: Any script containing `raleCommand` steps should trigger the same class of **App Connector** connect / `ensureRaleConnection` behavior as scripts with `appFunction` (establish RALE before the step runs; skip or warn if unavailable—match existing policy).
- **Offline validation**: Validate `command` against the catalog and `args` shape (and required keys) without requiring `getExternalControlFunctions`.

## Relationship to node update (scene graph editing)

Node update uses commands not necessarily in `RALE_BUILTIN_COMMANDS` today. Adding them to Action Scripts is a separate decision: extend the catalog + validation first, then expose in the `raleCommand` builder.

## Suggested implementation order

1. Add `raleCommand` to `STEP_SCHEMA` in `action-registry.js` (required: `command`, `args`; document optional fields only if needed later).
2. Implement shared `validateRaleBuiltinArgs` / normalization keyed by `command`, reusing `rale-builtins.js` as the source of allowed commands and param names.
3. `executor-engine.js`: new `case 'raleCommand'` calling `api.raleCommand(connectionId, step.command, step.args || {})` after validation; wire `ensureRaleConnection` when the script includes this step type.
4. `validator.js`: validate `command` allowlist and `args` against shared helper.
5. `builder.js`: new action type in the type dropdown; command `<select>` from catalog; `args` via structured fields and/or JSON for complex values—aligned with inspector behavior.
6. `actions-list-view.js` / `executor-engine.js` `stepDescription`: human-readable labels for `raleCommand` steps.
7. Import modal and executor pre-validation: detect `raleCommand` in script and run RALE checks analogously to `appFunction` where applicable.
8. User-facing `docs/` when the feature ships.

## Open questions

- **Strict vs loose `args`:** Require exact keys per command in JSON, or accept extras and strip (prefer strict + normalized output for consistency).
- **Script `version`:** Bump or document when `raleCommand` is added, or treat as additive only.
- **Registry UI in builder:** For commands that use `registryUi` in the inspector, start with JSON `args` only, or fetch section/key lists when connected (friendlier, more work).

---

*Status: design decision (`raleCommand` step type); implementation pending.*

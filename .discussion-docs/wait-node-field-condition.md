# Wait until node field matches (getNodeById)

This note specifies how Action Scripts **wait** steps could poll **RALE `getNodeById`** and treat a **single field’s value** as the signal, using string-friendly predicates. It complements [rale-builtins-action-scripts-integration.md](./rale-builtins-action-scripts-integration.md) (`raleCommand`); here we only extend the existing **`wait`** step’s `condition` object.

**Scope:** The “string everywhere / keep simple” rules below apply **only to Action Scripts** (executor, validator, builder JSON). The **App Connector inspector** (e.g. Update Node, typed field inputs) may continue to use richer representations where it already does; we do not require the inspector to dumb down to match.

## Principles (v1 — Action Scripts only)

- **First matching poll wins.** No requirement for consecutive successful polls or double-check passes; a single poll that satisfies the predicate completes the wait.
- **Compare as strings wherever possible.** Coerce the field value to a string (`actual`) and compare to `value` (and substring checks) as strings. No separate numeric/boolean equality modes in v1.
- **Defer edge cases.** Internationalization nuances, fancy type rules, dotted field paths, and other complex behavior are out of scope until needed.

## Motivation

Automation often needs “wait until this Label shows this text” or “wait until this field is non-empty.” The ECP **media-player** wait only covers player XML. **Scene graph state** is available via `getNodeById` → `response.fieldlist` / `fieldlist` (see `buildNodeUpdateContextFromResponse` in `inspector-node-update-helpers.js`). Reusing that poll loop in `runWaitStep` avoids adding a separate step type while keeping **timeout** and **pollIntervalMs** behavior consistent with today’s wait.

## Current behavior (reference)

- `wait` with `delayMs`: fixed sleep.
- `wait` with `condition`: today `source` is effectively **`media-player`** (see `WAIT_SOURCES` in `action-registry.js`); executor polls `/query/media-player` and evaluates state or `condition.check` (`executor-engine.js`).

## Proposed condition shape

Add a new **`condition.source`** value, e.g. **`rale-node-field`** (name bikesheddable: `node-field`, `sg-node-field`).

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| `source` | `string` | yes | `"rale-node-field"`. |
| `path` | array | yes | RALE scene path (same semantics as `getNodeById` args; `[]` = root). |
| `id` | string | yes | Node `id` for depth-first search under `path`. |
| `field` | string | yes | Field name in the node’s **fieldlist** map (same keys as Update Node / inspector). |
| `operator` | string | yes | One of the operators below. |
| `value` | string | depends | Operand B for comparisons that need it (see table). |
| `caseInsensitive` | boolean | no | Default `false`. When true, normalize both sides for **string** comparisons (trim optional; see below). |

**RALE connection:** Any wait step using this source requires an App Connector session, same policy as steps that call `raleCommand` / `appFunction`: establish connection before polling (or skip/warn per existing executor policy).

### Operators

All evaluations use a **canonical string** `actual` derived from the field’s runtime value (see “Value extraction”). Operators that need a reference value use `value` from the condition (string).

| `operator` | Meaning | `value` required |
|------------|---------|-------------------|
| `is` | `actual === expected` (after optional case folding) | yes |
| `isNot` | `actual !== expected` | yes |
| `hasAnyValue` | Field exists and `actual` is not “empty” (see below) | no |
| `hasNoValue` | Missing node, missing field, or empty | no |
| `contains` | `actual` includes `value` as substring | yes |
| `doesNotContain` | opposite of `contains` | yes |
| `beginsWith` | `actual` starts with `value` | yes |
| `endsWith` | `actual` ends with `value` | yes |

**Empty definition for `hasAnyValue` / `hasNoValue`:** After coercion to string, treat as empty if the string is `""`, or if the field is absent from `fieldlist`, or if `getNodeById` fails / returns invalid node (same invalid rules as `isValidGetNodeByIdResponseForNodeUpdate` — no match or invalid node ⇒ “no value” for presence checks).

**`hasNoValue` success:** Condition is met when the field is empty as above (or node not found, if we define “no value” that way — **recommend:** not found ⇒ satisfies `hasNoValue`, does **not** satisfy `hasAnyValue`; for `is`/`contains`/… not found ⇒ condition not met until timeout unless operator is `hasNoValue`).

Document edge case explicitly in implementation: **node missing** vs **node found but field empty** may both be “has no value”; both should satisfy `hasNoValue`.

### String coercion for `actual`

Use one straightforward path: primitives → `String(value)`; objects/arrays → `JSON.stringify` (or empty string if stringify fails). No attempt to match BrightScript type semantics beyond that in v1.

### Case sensitivity

- Default: **case-sensitive** for all operators.
- If `caseInsensitive: true`, apply `toLowerCase()` to `actual` and to `value` (including substring operators).

## Executor behavior (`runWaitStep`)

1. If `condition.source !== 'rale-node-field'`, keep existing branches (media-player, etc.).
2. Else:
   - Resolve `connectionId` (reuse `ensureRaleConnection` from context, same as `appFunction`).
   - Loop until `timeoutMs` or `shouldStop`:
     - `api.raleCommand(connectionId, 'getNodeById', { path, id })`.
     - Parse success payload; extract `response.fieldlist[field]` (or equivalent key casing — match inspector).
     - Compute `actual`, evaluate `operator` + optional `value`.
     - If predicate true → `{ success: true }` with log line similar to media-player wait.
     - Else sleep `pollIntervalMs` (with stop chunks).
3. On timeout → `{ success: false, error: 'Wait timeout' }` (same as today).

The loop may run many times until one poll satisfies the predicate; **as soon as** one iteration evaluates true, the step succeeds (no extra confirmation poll).

## Validation (`validator.js`)

- Extend allowed sources list (alongside `media-player`).
- For `rale-node-field`: require `path` (array), `id` (non-empty string), `field` (non-empty string), `operator` (enum), and `value` when operator requires it.
- Reject unknown `operator`.

## Builder

- When “Wait” + condition source = node field: fields for path (JSON array or structured UI), id, field name, operator dropdown, value (enabled only when needed), optional case-insensitive checkbox.
- Help text: link to RALE path/id semantics and that field names match Update Node.

## Relation to `raleCommand`

Users **could** script “call `getNodeById` in a loop” manually with delays; that is fragile. The dedicated **wait** condition reuses timeout/poll/stop and keeps scripts declarative. **`raleCommand`** remains for one-shot calls; **wait** is the right place for “until stable.”

## Open questions (only if product asks later)

Path encoding shortcuts, dotted field paths, richer error messages, and logging verbosity can wait.

---

*Status: design proposal; implementation pending.*

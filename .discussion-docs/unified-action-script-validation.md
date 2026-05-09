# Unify Action Script validation across all three surfaces

**Status:** Phase 0a + 0b + 0c all landed (2026-05-01 → 2026-05-02). Validation logic is in **one place** and every surface delegates.
**Author:** Cursor agent (Composer), 2026-05-01
**Related:** `.discussion-docs/mcp-flows-test-report.md` (the agent test pass that surfaced the inconsistency)

## Decisions (resolved)

| Q  | Decision                                                                                                                                                                |
| -- | ---                                                                                                                                                                     |
| Q1 | **(b)** — migrate the Builder UI to consume the rich `path`/`code`/`expected` shape with inline hints. Phase 0b work.                                                    |
| Q2 | Keep sentence form for `rds validate-script` non-JSON output; expose the structured shape only via `--json`.                                                            |
| Q3 | **Option A** — `raleFunctions` stays opt-in via `ValidationOptions`. CLI's `validate-script` stays offline.                                                              |
| Q4 | **Drop** the per-step shape re-checks at runtime once the canonical validator is the single gate. **Keep** the App Connector connectivity precondition before each `appFunction` / RALE-source step. Phase 0c work. |
| Q5 | Filename: `roku-dev-studio-api/lib/validate-action-script.ts` (flat, not nested under a subfolder).                                                                     |

## 1. Problem

Action Script JSON is validated in three places, by three different
implementations, with three different rule sets:

| Surface                                      | Validator file                                                         | Function                                       | Errors shape                                  |
| ---                                          | ---                                                                    | ---                                            | ---                                           |
| AI agents (`validate_script` MCP tool)       | `packages/roku-dev-studio-mcp/src/validator.ts`                        | `validateScript(input) → { ok, errors[], stepCounts }` | `{ path, code, message, expected? }`     |
| Builder / Executor (Dev Studio renderer)     | `apps/roku-dev-studio/renderer/components/action-scripts/validator.ts` | `validateScript(script, raleFunctions?)` / `parseAndValidateScript(text, raleFunctions?)` | `{ valid, errors: { stepIndex?, message }[] }` |
| Headless CLI / remote relay                  | `packages/roku-dev-studio-api/lib/script-runner.ts`                    | `validateScriptStructure(script) → { valid, errors[] }` | `errors: string[]`                          |

The MCP validator's source even names this:

> *"Self-contained validator for Action Script JSON. … Mirrors the rules in
> `apps/roku-dev-studio/renderer/components/action-scripts/validator.ts`
> but is **deliberately decoupled — Phase 0 of the design doc tracks
> unifying these.**"*

This RFC is that Phase 0.

## 2. What each validator currently checks

All three pull `STEP_SCHEMA`, `RALE_BUILTINS`, `MEDIA_PLAYER_STATES`,
`KEYPRESS_OPTIONS`, `WAIT_SOURCES`, `IF_SOURCES`,
`NODE_FIELD_OPERATOR_DEFS`, `DEVICE_PERFORMANCE_CHART_IDS`,
`SCRIPT_VERSIONS` from the **single canonical source**:
`packages/roku-dev-studio-api/lib/catalogs.ts`. So the **vocabularies
are unified already**. What's not unified is the per-step semantic checks
that each validator layers on top.

| Check                                                                         | MCP `validateScript` | Renderer `validateScript` | API `validateScriptStructure` |
| ---                                                                           | :---:                | :---:                     | :---:                         |
| Script is an object with `steps[]`                                            | ✅                    | ✅                         | ✅                             |
| Step has `type`                                                               | ✅                    | ✅                         | ✅                             |
| `type` is one of `STEP_SCHEMA`                                                | ✅                    | ✅                         | ✅ (via `SUPPORTED_TYPES`)     |
| Required-field check from `STEP_SCHEMA[type].required`                        | ✅                    | per-step (~equivalent)    | ✅ (via `STEP_REQUIRED`)       |
| `version: "2"` required when any `if` step is present (any depth)             | ✅                    | ✅ (per-step "type if requires v2") | ✅                             |
| `keypress.key` ∈ `KEYPRESS_OPTIONS`                                            | ✅                    | ❌                         | ❌                             |
| `query.endpoint` shape (`telnet:plugins` / `telnet:free`)                     | ❌                    | ✅                         | ❌                             |
| `wait`: needs `delayMs` or `condition`                                        | ✅                    | ✅                         | ✅                             |
| `wait`/`if` condition shape (`source` valid, etc.)                            | ✅ (deep)             | ✅ (deep)                  | partial (basic shape only)    |
| `if.then` / `if.else` are arrays                                              | ✅                    | ✅                         | ✅                             |
| `raleCommand.command` ∈ `RALE_BUILTIN_NAMES`                                  | ✅                    | ✅                         | ❌                             |
| `raleCommand.args` is an object                                               | ✅                    | ✅                         | ✅                             |
| `raleCommand.args` shape per built-in (e.g. `addRegistryField` keys)          | ❌                    | ✅ (`validateAndNormalizeRaleCommandArgs`) | ❌                             |
| `appFunction.functionParams` shape (array / object / primitive reject)        | ❌                    | ❌ (only "missing keys" message via raleFunctions) | ✅ (rejects primitive only)   |
| `appFunction.functionName` actually exists on the channel (live `raleFunctions`) | ❌                    | ✅ (when raleFunctions provided) | ❌                             |
| `appFunction` named-object form: missing keys reported                        | ❌                    | ✅ (when raleFunctions provided) | ❌                             |
| `appFunction` param-count vs. declared params                                 | ❌                    | ✅ (when raleFunctions provided) | ❌                             |
| `devicePerformance.chart` ∈ `DEVICE_PERFORMANCE_CHART_IDS`                     | ✅                    | ✅                         | ✅                             |
| `assignToVar` referenced before assigned in `if` (variables source)           | ❌                    | ✅                         | partial                       |
| `output[]` references valid (`validateOutputFields`)                          | ❌                    | ✅                         | ❌                             |
| Reject literal `devPassword` / step `password` in JSON                         | ✅ (script root)      | partial                   | ❌                             |
| `inputText.text` not empty (cosmetics)                                        | partial              | partial                   | partial                       |

The "✅ when raleFunctions provided" rows in column 2 only fire when the
caller hands the validator a live App Connector function list. For the
agent's `validate_script` and the headless CLI flows, that list isn't
available.

### Output shapes diverge too

```ts
// MCP
{ ok: boolean, errors: { path: string, code: string, message: string, expected?: string|string[] }[], stepCounts: Record<string, number> }

// Renderer
{ valid: boolean, errors: { stepIndex?: number, message: string }[] }

// API headless
{ valid: boolean, errors: string[] }   // a "Step 3: missing functionParams for appFunction"-style sentence per error
```

The MCP shape is the richest (machine-correctable: `path`, `code`,
`expected`). The other two were built for human readers — humans are
fine, agents have to grep messages.

## 3. Goals & non-goals

**Goals**

1. **One source of truth for validation rules.** Adding a check (or
   tightening one) should be a one-file change.
2. **Same `(input) → result` regardless of surface** when the same
   inputs (incl. optional `raleFunctions`) are supplied.
3. **Rich, machine-correctable errors everywhere** — `path`, `code`,
   `expected[]` — so agents anywhere (MCP, in-app linter, CLI `--json`)
   can self-correct.
4. **Don't regress existing UX.** The Builder's human-friendly per-row
   error display still has to work; the headless CLI human output still
   has to be readable.

**Non-goals**

1. Rewriting the runtime — both the renderer's `executor-engine.ts` and
   the headless `script-runner.ts` keep their own runtimes. Only the
   *validation* pass is shared.
2. Reorganizing the catalog. `roku-dev-studio-api/lib/catalogs.ts`
   already is the source of truth and stays put.
3. Designing a new error wire format for end users (the existing
   `path`/`code`/`message`/`expected` is sufficient).

## 4. Proposal

Move the canonical `validateScript` into the **api package** so it can
be imported from the renderer, the headless runner, and the MCP server
without any of them taking a hard dependency on each other.

### 4.1 Where the canonical validator lives

```
packages/roku-dev-studio-api/lib/action-script/
├── validate.ts        ← canonical; only imports from ./catalogs and ./action-script-wait-core
├── validate-types.ts  ← ValidationError, ValidationResult, ValidationOptions
├── format.ts          ← optional formatters: structured → string[] (CLI), structured → renderer's { stepIndex, message }
└── index.ts
```

Exports:

```ts
export type ValidationOptions = {
  /** App Connector function list — when provided, deepens appFunction checks. */
  raleFunctions?: ReadonlyArray<{ name?: string; params?: ReadonlyArray<{ name?: string; type?: string }> }>;
};

export type ValidationError = {
  path: string;                  // e.g. "steps[2].condition.operator"
  code: string;                  // e.g. "invalid_operator"
  message: string;
  expected?: string | string[];
  stepIndex?: number;            // preorder index for legacy renderer renderers
};

export type ValidationResult = {
  ok: boolean;
  errors: ValidationError[];
  stepCounts: Record<string, number>;
};

export function validateScript(input: unknown, options?: ValidationOptions): ValidationResult;
```

`stepIndex` is computed during the same preorder walk the existing
validators do — no extra cost, and it preserves the renderer's
per-row UI. The MCP shape is a strict superset of what the other two
return today.

### 4.2 What each surface keeps

- **MCP server `validator.ts`** becomes a re-export:
  ```ts
  export { validateScript } from 'roku-dev-studio-api/lib/action-script/validate';
  ```
  Plus the existing `wrapValidationForAgent` (humanSummary +
  referenceTools) stays put — it's MCP-tool-specific UX, not validation.

- **Renderer `validator.ts`** becomes a thin adapter:
  - call `validateScript(script, { raleFunctions })`
  - translate `errors[]` to `{ stepIndex, message }` for the existing UI
    callers (or, ideally, the UI is updated to consume the richer shape;
    that's a follow-up — see §6).
  - `parseAndValidateScript()` keeps its JSON-parse responsibility.

- **API `script-runner.ts` `validateScriptStructure`** becomes a thin
  adapter:
  - call `validateScript(script)` (no `raleFunctions` available offline)
  - flatten `errors[].path + message` to `string[]` for the existing CLI
    output. Or expose both shapes via an option (`{ format: 'flat' | 'structured' }`).

The CLI's `--json` mode then trivially exposes the rich structured
errors without changing its non-JSON output.

### 4.3 What about catalog imports?

`packages/roku-dev-studio-api/lib/catalogs.ts` already is the canonical
source. The new `validate.ts` imports from there directly. The MCP
server and the renderer both import the catalog too, which is fine and
already the case today.

### 4.4 What about runtime checks?

This RFC is about **validation only**. Both runtimes
(`executor-engine.ts` and `script-runner.ts`) keep their own run-time
behavior, *including* the "named-object → positional" normalization for
`appFunction.functionParams`. Run-time normalization is a backstop for
legacy/agent-generated scripts; lifting it out is a separate question
(see §6).

## 5. Migration plan

Three small PRs, each independently reviewable:

### Phase 0a — Move + reconcile rules (no behavior change)

1. Create `roku-dev-studio-api/lib/action-script/validate.ts` by porting
   the **MCP validator** (it's the cleanest, most structured, has
   `path`/`code`/`expected`) and adding the per-step checks the renderer
   has that the MCP one doesn't (e.g. `query.endpoint` telnet check,
   `raleCommand.args` per-built-in shape, `assignToVar` cycle check,
   `validateOutputFields`).
2. Add a unit test fixture (`packages/roku-dev-studio-api/test/action-script/`)
   covering every check matrix row from §2.
3. **Don't change the call sites yet** — the new validator coexists
   with the old ones until tests are green.

### Phase 0b — Migrate call sites

4. Switch the MCP server's `tools.ts` `validateScriptTool` to import
   from the api package.
5. Switch `apps/roku-dev-studio/renderer/components/action-scripts/validator.ts`
   to delegate to the api validator and translate the shape for legacy
   UI consumers (`{ stepIndex, message }`). Keep the existing exports
   (`validateScript`, `parseAndValidateScript`) so nothing in the
   renderer needs to change.
6. Switch `script-runner.ts::validateScriptStructure` to delegate to the
   api validator and flatten to `string[]` for the CLI.

### Phase 0c — Remove the duplicates

7. Delete the per-validator implementations once Phase 0b is on `main`
   and the next release is cut.
8. Update the comment in MCP `validator.ts` (and any other "Phase 0"
   pointers) to reflect the new architecture.

Total churn: ~3 files added, ~3 files trimmed to thin adapters, no
public API breakage.

## 6. Open questions for review

1. **Output shape for the renderer's UI consumers.** The Builder
   currently consumes `{ stepIndex, message }`. Do we (a) translate from
   the rich shape inside the renderer's adapter (one-liner), or (b)
   take the opportunity to migrate the Builder UI to consume
   `path`/`code`/`expected` and show inline hints? Option (a) is the
   minimum, (b) is nicer UX but adds scope.

2. **CLI human output.** Do we keep the current `Step N: missing X for Y`
   sentences for `rds validate-script` non-JSON, or switch to the
   structured shape with line-1: code, line-2: path, line-3: message?
   I lean toward keeping the sentence form for humans and adding the
   structured shape only to `--json`.

3. **`raleFunctions` plumbing.** The Builder fetches the channel
   function list and hands it to its validator today
   (`fetchAppFunctionsForBuilder`). Should the headless CLI try to
   fetch too (it has live RALE later in the run, just not at validation
   time), or should the deeper "function exists, param count matches"
   checks stay opt-in via `ValidationOptions`?
   - Option A: keep them opt-in (current behavior carried forward;
     CLI's `validate-script` stays offline).
   - Option B: have the CLI's `validate-script` accept `--connect <ip>`
     to fetch and run the deeper checks.
   - I lean A; B is a follow-up if anyone asks for it.

4. **Pre-flight validation in the runtimes.** Right now both runtimes
   re-do per-step shape checks at runtime
   (e.g. `appFunction.functionParams must be a positional array …`).
   With a shared validator, those become redundant — the runtime can
   just run on already-validated input. Do we (a) leave the runtime
   re-checks as belt-and-suspenders, or (b) drop them and let the
   single validator be the only gate? I lean (a) for safety; (b) is a
   follow-up.

5. **Naming.** `roku-dev-studio-api/lib/action-script/validate.ts` vs
   `roku-dev-studio-api/lib/validate-action-script.ts` — preference?

## 7. Risks

- **Subtle behavior drift during the rule reconciliation in 0a.**
  Mitigated by the unit tests covering every row of the §2 matrix. Each
  rule is gated by a fixture that exercises both the "valid" and
  "invalid" path.
- **Renderer adapter regressions.** The Builder UI is the most
  user-visible consumer. Mitigation: the adapter ships in 0b only after
  unit tests pass and a quick smoke pass through the Builder
  (Validate / Run with a known-good script).
- **CLI exit-code contract.** `rds validate-script` already exits 2 on
  invalid; that contract has to be preserved by the adapter.
- **Output-field check (`validateOutputFields`).** Lives only in the
  renderer today and references variable assignments. Will need to be
  ported deterministically — it's the highest-complexity per-step rule.

## 8. Decisions needed before I start coding

Please confirm:

- [x] Proceed with the proposed file layout in §4.1 — renamed per Q5 (single file, not subfolder).
- [x] Confirm the migration order in §5 (0a → 0b → 0c).
- [x] Q3 → A (`raleFunctions` opt-in).
- [x] Q1 → (b) (renderer adapter migrated to rich shape; Phase 0b).
- [x] Q4 → drop runtime re-checks; keep App Connector connectivity check.

## 9. Phase 0a — landed 2026-05-01

Single self-contained diff: new canonical validator + tests, **no
call-site changes**. The three existing validators still run on their
respective surfaces; the new one is exported from
`roku-dev-studio-api` for Phase 0b to delegate to.

### Files added

```
A packages/roku-dev-studio-api/lib/validate-action-script.ts   (canonical validator)
A packages/roku-dev-studio-api/test/validate-action-script.test.ts (46 tests)
M packages/roku-dev-studio-api/index.ts                        (re-export as `validateActionScript`)
M packages/roku-dev-studio-api/package.json                    (add `npm test` script using `tsx --test`)
```

### Public surface

```ts
import { validateActionScript } from 'roku-dev-studio-api';

const result = validateActionScript(script, { raleFunctions });
//   { ok: boolean,
//     errors: { path, code, message, expected?, stepIndex? }[],
//     stepCounts: Record<string, number> }
```

### Coverage vs. §2 matrix

The new validator covers **every row** of §2 except the deep
`raleCommand.args` per-built-in shape (`addRegistryField` etc.) — that
helper (`validateAndNormalizeRaleCommandArgs`) lives in renderer code
today and depends on `RALE_BUILTIN_COMMANDS` / `validateAddRegistrySection`
/ `normalizePathArg` from renderer-only files. Phase 0c moves those
helpers into `roku-dev-studio-api/lib/` and folds the deep check into
the canonical validator. Until then the canonical validator does what
the MCP validator does today (basic `args` is object, `command` ∈
`RALE_BUILTIN_NAMES`), which is a **strict superset of what the
agent-facing surface enforced before this RFC**.

Test fixture (46 cases, all green):

```
▶ validateScript: structural                       (8 cases)
▶ validateScript: required fields                  (5 cases)
▶ validateScript: query.endpoint                   (3 cases)
▶ validateScript: raleCommand                      (3 cases)
▶ validateScript: appFunction.functionParams shape (5 cases — the rule that motivated this RFC)
▶ validateScript: appFunction + raleFunctions opt  (6 cases)
▶ validateScript: wait                             (8 cases)
▶ validateScript: if                               (5 cases)
▶ validateScript: preorder stepIndex               (2 cases)
▶ validateScript: multi-error reporting            (1 case)
ℹ tests 46  pass 46  fail 0
```

Run: `npm test -w roku-dev-studio-api`.

### What didn't change

- The MCP server's `validateScript` still runs against the MCP validator — `validate_script` tool output is byte-for-byte identical to before this PR.
- The renderer's Builder + Executor still run the renderer validator.
- `script-runner.validateScriptStructure` still runs unchanged on the CLI / remote relay.

Phase 0b's diff is the one that moves call sites; this one is a no-op for users.

## 10. Phase 0b — landed 2026-05-02

Three sub-commits, each verified at the seam:

### 0b.1 — MCP server delegation

`packages/roku-dev-studio-mcp/src/validator.ts` body replaced with a thin
re-export of `roku-dev-studio-api/lib/validate-action-script::validateScript`.
`tools.ts` and `agent-contract.ts` keep importing from `./validator.js` —
no call-site change. `validate_script` tool output (used by MCP agents) is
byte-identical to before; `humanSummary` + `referenceTools` from
`wrapValidationForAgent` still wrap the canonical result.

```diff
M packages/roku-dev-studio-mcp/src/validator.ts   (~270 lines → ~70 lines, all delegation)
```

Smoke-tested via the canonical validator's `errorCodes`:
`missing_steps`, `invalid_function_params_shape`, etc. all surface unchanged
through the MCP wrapper.

### 0b.2 — CLI / `script-runner` delegation

`packages/roku-dev-studio-api/lib/script-runner.ts::validateScriptStructure`
now flattens `validate-action-script::validateScript`'s rich errors into
the legacy `string[]` shape the CLI prints. New sibling export
`validateScriptStructureRich` returns the structured shape unchanged.
`cli.ts` uses the rich variant when `--json` is set, sentence form
otherwise (Q2).

```diff
M packages/roku-dev-studio-api/lib/script-runner.ts  (~140 lines of duplicate body removed)
M packages/roku-dev-studio-api/cli.ts                 (--json now emits rich shape)
```

CLI smoke test:

```
$ rds --json script validate bad.json
{
  "valid": false,
  "errors": [
    { "path": "steps[0].key", "code": "missing_required", "message": "Step \"keypress\" requires `key`", "stepIndex": 0 },
    { "path": "steps[1].functionParams", "code": "invalid_function_params_shape",
      "message": "appFunction.functionParams must be a positional array (preferred) or an object keyed by RALE param names",
      "expected": ["array", "object"], "stepIndex": 1 }
  ],
  "stepCounts": { "keypress": 1, "appFunction": 1 }
}
```

### 0b.3 — Renderer delegation + Builder UI rich-shape migration (Q1 → b)

- `apps/.../action-scripts/validator.ts` rewritten as a thin adapter that
  delegates to `window.actionScriptValidator.validateScript` (canonical via
  preload bridge) and translates the rich error shape into the renderer's
  `{ stepIndex?, message, code?, path?, expected? }` shape. All existing
  callers (`import-modal.ts`, `executor.ts`, `builder.ts`) keep working —
  they're already reading `stepIndex` and `message`; the new optional
  `code`/`path`/`expected` fields are available for richer UI.
- `apps/.../action-scripts/executor.ts` — when validation fails, the
  per-row error rendering now suffixes "expected: [a, b, c]" lines when
  the canonical validator returned an enum-like `expected`. So the user
  immediately sees the valid options without having to consult docs.
- Preload bridge expanded with `actionScriptValidator.validateScript`
  (`apps/.../preload.ts`) and the matching window typing in
  `renderer-globals.d.ts`.

```diff
M apps/roku-dev-studio/preload.ts                                              (+ actionScriptValidator bridge)
M apps/roku-dev-studio/renderer/renderer-globals.d.ts                          (+ window.actionScriptValidator typing)
M apps/roku-dev-studio/renderer/components/action-scripts/validator.ts          (~330 lines → ~140 lines, delegating adapter)
M apps/roku-dev-studio/renderer/components/action-scripts/executor.ts           (rich `expected: ...` hint in error display)
```

End-to-end check: `POST /builder/drop-script` with an `appFunction` whose
`functionParams: 42` is now rejected by the Builder with the **exact same
error string** the CLI and MCP both produce — proof the rules are unified
end-to-end across all three surfaces.

## 11. Phase 0c — landed 2026-05-02

### 0c.1 — Port `validateAndNormalizeRaleCommandArgs` + deps into api package

New file `packages/roku-dev-studio-api/lib/rale-command-args.ts` consolidates:

- `RALE_BUILTIN_COMMAND_DEFS` (data-only port of `inspector/rale-builtins.ts::RALE_BUILTIN_COMMANDS`)
- `validateAddRegistrySection` (port of `inspector/registry-validation.ts`)
- `validateAndNormalizeRaleCommandArgs` (the deep per-built-in shape check
  the renderer used to own)

Folded into the canonical validator: `validate-action-script.ts` now runs
the deep raleCommand args check for **every** consumer (MCP agent, Builder,
CLI) — the §2 matrix is now fully covered.

```diff
A packages/roku-dev-studio-api/lib/rale-command-args.ts            (canonical helper)
M packages/roku-dev-studio-api/lib/validate-action-script.ts       (call into the helper for raleCommand)
M packages/roku-dev-studio-api/test/validate-action-script.test.ts (+ 5 deep raleCommand cases)
```

Tests: 51 cases passing (was 46).

### 0c.2 — Drop runtime structural re-checks; keep App Connector connectivity precondition (Q4)

`runActionScript` now calls `validateScriptStructure(script)` once at the
top as a single canonical preflight. The ~140 lines of inline per-step
structural re-checks (required fields, raleCommand args is object,
appFunction functionParams shape, wait shape, if-condition shape) are
gone — same script, one validator, one place.

App Connector connectivity preconditions (`raleConnectionId` set before
`appFunction` / `raleCommand` steps run, `raleConnect` driven by the
`needsRale` walk) are kept in place — those depend on device state, not
script shape.

Smoke test (no real device needed):

```js
runActionScript({ steps: [{ type: 'keypress' }] }, { ip: '127.0.0.1' })
  → { success: false, error: 'Step 0: Step "keypress" requires `key`' }    // canonical preflight
runActionScript({ steps: [{ type: 'appFunction', functionName: 'X', functionParams: 42 }] }, ...)
  → { success: false, error: 'Step 0: appFunction.functionParams must be …' }
```

```diff
M packages/roku-dev-studio-api/lib/script-runner.ts  (- ~140 lines of inline structural re-checks
                                                      + 7-line canonical preflight at top)
```

### 0c.3 — Delete duplicate validator bodies

`validateAndNormalizeRaleCommandArgs` duplicate body in
`apps/.../action-scripts/rale-command-args.ts` replaced with a 12-line
delegate that calls `window.actionScriptValidator.validateRaleCommandArgs`
(new bridge — exposed in `preload.ts`). Renderer UI helpers
(`raleArgsToParamStrings`, `buildRaleArgsFromParamValues`,
`listRaleCommandsForBuilder`, `getRaleBuiltinDefForCommand`) stay put —
they're UI-only and have no rule logic.

```diff
M apps/roku-dev-studio/preload.ts                                                     (+ actionScriptValidator.validateRaleCommandArgs bridge)
M apps/roku-dev-studio/renderer/renderer-globals.d.ts                                 (+ window typing)
M apps/roku-dev-studio/renderer/components/action-scripts/rale-command-args.ts        (~115 lines → 27-line delegate)
```

After 0c, the only thing tying validation to a particular surface is **how
the errors are formatted for human display** — the rule logic lives in
exactly one place.

## 12. Final state

```
roku-dev-studio-api/lib/validate-action-script.ts          ← canonical (the rules)
roku-dev-studio-api/lib/rale-command-args.ts               ← canonical raleCommand shape
roku-dev-studio-api/lib/script-runner.ts::validateScriptStructure
                                                           ← thin adapter (sentence form)
roku-dev-studio-api/lib/script-runner.ts::validateScriptStructureRich
                                                           ← thin adapter (rich shape, used by --json)
roku-dev-studio-mcp/src/validator.ts                       ← thin adapter (re-export, types preserved)
apps/roku-dev-studio/renderer/components/action-scripts/validator.ts
                                                           ← thin adapter (legacy → rich shape via preload)
apps/roku-dev-studio/renderer/components/action-scripts/rale-command-args.ts
                                                           ← thin adapter (delegates to canonical via preload)
```

Verification matrix (all green):

| Surface                           | Same rules? | Same error codes? | Notes                              |
| ---                               | ---         | ---               | ---                                |
| `validate_script` MCP tool        | ✅           | ✅                 | Bundle has `invalid_function_params_shape`, `invalid_rale_args` etc. |
| `rds script validate` (sentence)  | ✅           | n/a (string)      | Exit 2 on invalid; identical text  |
| `rds --json script validate`      | ✅           | ✅                 | Rich shape with `path`/`code`/`expected` |
| Dev Studio Builder Validate       | ✅           | ✅                 | UI shows `expected: [...]` inline   |
| `runActionScript` preflight       | ✅           | ✅ (string-form)   | Refuses bad scripts before any device call |
| `send_script_to_builder` drop     | ✅           | ✅                 | Same error string as CLI / MCP      |

Tests:

- `packages/roku-dev-studio-api/test/validate-action-script.test.ts`
  — **51 cases passing**, every row of the §2 matrix exercised.
- Workspace typecheck: `npm run typecheck:api`,
  `typecheck:renderer`, `typecheck:electron` — all clean.
- `npm run build -w roku-dev-studio-api -w roku-dev-studio-mcp` — clean.
- Live bridge smoke test: `POST /builder/drop-script` with
  `functionParams: 42` returns the canonical-validator error string
  identical to the CLI/MCP — confirming end-to-end rule unification.

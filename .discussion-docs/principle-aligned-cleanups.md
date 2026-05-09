# Principle-aligned cleanups — backlog

**Status:** landed 2026-05-04. Items #1, #2, #3, #4, #5, #7, #8, #9 all shipped in one sweep at the user's explicit request ("Fix all these issues"). Item #6 deliberately **not** landed — see per-item note.
**Provenance:** a sweep of the repo looking for places that don't yet follow the conventions codified in `engineering-principles.md`. Each entry cites the offending file, the principle it violates, the symptom a future bug would look like, and the fix we landed.
**Gates run at landing:** `roku-dev-studio-api` typecheck + `npm test` (93 tests across 19 suites, all green; the new `rale-command-args.test.ts` from item #9 contributes ~40 of them), `roku-dev-studio-mcp` typecheck + full build (now includes `prebuild` forbidden-identifier scanner from item #8), renderer typecheck, electron-main typecheck — all green.

## How to read this doc

Each item follows the same shape:

- **Where** — file + line ranges.
- **Principle(s)** — which `engineering-principles.md` section it cuts against.
- **Symptom** — what a user- or agent-visible failure looks like today (real or latent).
- **Proposed fix** — one-paragraph design.
- **Blast radius** — how many files move / risk level.
- **Suggested phasing** — whether it's a one-file fix or wants a §14-style 0a/0b/0c split.

Items are ordered by **expected regression likelihood × expected fix cost**, highest first.

---

## 1. Inspector RALE call sites bypass `connector.command()` — **landed**

**Where:**
- `apps/roku-dev-studio/renderer/components/inspector/registry-params-ui.ts` — `fetchRegistrySectionsData` (line 21: `api.raleCommand(connectionId, 'getRegistrySections', {})`).
- `apps/roku-dev-studio/renderer/components/inspector/node-update-panel.ts` — `selectNode` (469), `removeField` (501), `setField` (527).
- `apps/roku-dev-studio/renderer/components/inspector/index.ts` — `refreshGetNodeByIdAfterModalClose` (173: `api.raleCommand(connectionId, 'getNodeById', ...)`).

**Principle(s):** §1 (single source of truth), §2 (centralize where data is produced), and the Anti-pattern #1 in `engineering-principles.md` ("reaching under a central abstraction"). This is the same class of bug we just fixed in `function-execution.ts::sendCommand` (documented verbatim at `function-execution.ts` lines 49–59).

**Symptom.** These callers work today because the user is almost always actively connected and the socket is fresh — but three things silently fail:

1. **Stale-socket recovery.** `connector.command` runs a verify-and-reconnect cycle when a cached `connectionId` is no longer accepted (`app-connector.ts` lines 468–484). `api.raleCommand(connectionId, ...)` does not. After any `RaleDisconnected` race or TrackerTask idle timeout, the Inspector's "Select node → Edit field → Apply" flow returns a `Not connected` error that only goes away if the user hits Disconnect + Connect manually.
2. **Future central interceptors.** Today `connector.command` auto-caches `getExternalControlFunctions`. Tomorrow it could rate-limit, log for a diagnostic bundle, or intercept `selectNode` errors and route them through a shared error-formatter. Every bypass caller would have to be re-found and edited — exactly the fan-out that motivated §2.
3. **Contract drift.** The codebase now has two conventions for "send a RALE command from the renderer" and developers will copy whichever example is nearest. The fix to `function-execution.ts::sendCommand` is only half-done until the other Inspector surfaces go through the connector too.

**Proposed fix.** All four call sites should thread a `connector` (or at minimum a `sendCommand(cmd, args)` closure that routes through `connector.command`) into the helper. `registry-params-ui.ts::fetchRegistrySectionsData` is the easiest — it already takes a `Pick<InspectorApi, 'raleCommand'>` and can take a `sendCommand` callable instead. `node-update-panel.ts` has three call sites in one `onApply` handler; wrap them in a single `sendCommand` closure passed in from `setupNodeUpdatePanel`'s caller (the Inspector panel, which already has a live `connection.connector`). `index.ts::refreshGetNodeByIdAfterModalClose` is the simplest of the four — just rewrite it to `connection.connector.command('getNodeById', nodeUpdateInspectorState.searchArgs)`.

**Blast radius.** 3 files, ~15 line diff net. No `.d.ts` / preload changes — `InspectorApi` still exposes `raleCommand` for the final raw-level fallback, but the helpers stop using it.

**Suggested phasing.** Single PR. The proposed change matches the already-landed pattern in `function-execution.ts::sendCommand`; there's no migration dance. Run the MCP live smoke-test loop (§13 "Verify on real devices") after the change to confirm the Inspector's "Edit field" flow still works after a Builder borrow-disconnect mid-edit.

**What actually landed.** Introduced a single `RaleSendCommand` callable type in `inspector-types.ts`, threaded a `sendCommand` closure through the Inspector's `setupNodeUpdatePanel` and `renderParamInputs` options, rewrote `registry-params-ui.ts::fetchRegistrySectionsData` to take the callable, and rewrote `refreshGetNodeByIdAfterModalClose` to go through it. All four bypass sites now go through `connection.connector.command(...)`. Net diff: 5 files, +55/−35 lines including TSDoc. Typecheck green across all four gates; live smoke-test deferred to the user (see §13).

---

## 2. Dead `clearFunctionsCache` + stale subscriber comment — **landed**

**Where:**
- `apps/roku-dev-studio/renderer/modules/app-connector/app-connector.ts` — `clearFunctionsCache` declared at line 237, zero callers.
- `apps/roku-dev-studio/renderer/components/inspector/index.ts` lines 289–291 — comment says "The cache auto-invalidates when state goes to `disconnected` / `idle` (user-initiated disconnect, `RaleDisconnected` IPC, stale-socket recovery), so the dropdown clears cleanly without any explicit `clearFunctions()` call here."

**Principle(s):** §1 (single source of truth for prose), §8 (auto-invalidate within the right scope) — and §18 (communicate at the right level, specifically: don't leave comments that lie about behaviour).

**Symptom.** The comment on the Inspector subscriber directly contradicts the deliberate decision documented in `app-connector.ts::setState` (lines 244–261, which explicitly explains why the cache is **not** cleared on disconnect — that was the `fetchAppFunctionsForBuilder` regression captured in §8 "Worked regression"). A future reader who changes Inspector behavior based on the stale comment will re-introduce the borrow-disconnect bug the session just fixed. Meanwhile `clearFunctionsCache` sits as a tempting-looking helper that, if someone ever does call it in response to a disconnect event, will re-introduce the same bug under a different name.

**Proposed fix.** Two micro-edits in the same commit:
1. Delete `clearFunctionsCache` in `app-connector.ts`. `destroy()` already nulls `functions` + `functionsFetchedAt` inline (lines 511–522); the external helper is dead and dangerous. If a genuine need arises later (e.g. "sideloaded app changed — invalidate"), re-add it scoped to that concrete event.
2. Rewrite the subscriber comment in `inspector/index.ts` to match the actual behaviour:
    > *The connector owns the function-list cache; it persists across borrow-disconnect cycles (see `app-connector.ts::setState` note). This subscriber fires the dropdown update immediately on subscribe and again on every change. The Inspector's own "show empty when disconnected" UI is handled by `updateConnectionUI(false) → functionSelector.clearFunctions()`, independently of the cache.*

**Blast radius.** 2 files, ~10 line diff (mostly comment rewrite). Zero runtime behaviour change.

**Suggested phasing.** Single PR, trivial.

**What actually landed.** Deleted `clearFunctionsCache` in favour of an explicit comment at the same site saying "there is deliberately no exported clear helper — the list's only lifecycle is set-on-fetch / null-on-destroy". Rewrote the Inspector subscriber comment to point at the `setState` note and frame the "show empty when disconnected" behaviour as an Inspector-UX concern owned by `updateConnectionUI(false) → functionSelector.clearFunctions()`, not by the cache. Also caught (and fixed) a third stale comment in the same doc drift: the `AppConnector` interface's `getFunctions()` TSDoc still claimed "auto-cleared when the connector transitions to `disconnected` / `idle`" — same wrong mental model, now corrected.

---

## 3. Hard-coded 2-second grace timer in `AppConnector.doConnect` — **landed**

**Where:** `apps/roku-dev-studio/renderer/modules/app-connector/app-connector.ts` line 328:

```ts
// TrackerTask needs time between wake and socket accept.
await new Promise((r) => setTimeout(r, 2000));
```

**Principle(s):** §3 ("Subscribe-driven UI > poll-driven UI > timer-driven UI"). The codebase just removed a 1-second grace timer in the Inspector dropdown fix for exactly this reason (`engineering-principles.md` §3 "When a 1-second grace period was added during the Inspector dropdown fix, it raced the Builder's borrow-disconnect …"). The App Connector still has one.

**Symptom.** Two opposing failure modes that the blind 2s papers over:

1. **Fast devices pay 2 seconds they don't need on every Connect.** Streaming Stick 4K and Ultra in the test matrix accept the RALE socket well under 500ms post-wake. Builder's borrow-pattern fetch (connect → fetch → disconnect) gets a mandatory 2s hit every time the user opens the Action Scripts tab without a prior session, which is most of the time.
2. **Slow devices still race.** A device at the cold-boot end of the distribution could take >2s. When that happens we fall straight into the "failed to connect" path instead of retrying.

**Proposed fix.** Replace the blind sleep with a **bounded retry-with-backoff around `raleConnect`**. The main-process handler `api.raleConnect(port)` is cheap (TCP handshake to `localhost:<port>` from the renderer via IPC); attempt it up to N times with small backoff until either success or total-elapsed > ~4–5s. In the happy path we get connected in <500ms; in the worst case we're still under today's upper bound. Exposes a `onStatus?.(...)` message per retry so the "Connecting to socket..." label updates.

Alternative (bigger): have the TrackerTask BrightScript side emit a "ready" event via RALE once it's listening, and have `raleWake` resolve only once that signal arrives. That's a real subscribe-driven design but it crosses the BrightScript/renderer boundary and deserves a proper design doc.

**Blast radius.** 1 file for the simple retry approach, ~15 line change. Zero behaviour change for the slow-device case; the fast-device case gets a p50 latency improvement of ~1.5s per connect.

**Suggested phasing.** Single PR, plus a smoke test against all three test-matrix devices in `mcp-flows-test-report.md` (Stick 4K, Express, Ultra). Before landing, confirm with a live-bridge timing check that typical post-wake latency is well under 2s — if it's actually near the limit, the design needs more thought.

**What actually landed.** Replaced the blind `setTimeout(2000)` with a retry loop: initial backoff 150 ms, linear +150 ms per attempt, hard cap 12 attempts or 4.5 s total, whichever comes first. The first successful `raleConnect` breaks out. Each retry after the first surfaces `Connecting to socket (retry N)...` via the existing `onStatus` callback so the Inspector's "Response" panel shows progress. Worst case ≈ the old blind budget; happy-path p50 should drop by ~1.5 s. Live-device timing validation is deferred to the user's smoke-test loop (§13); if the distribution turns out wider than modeled, `CONNECT_TIMEOUT_MS` / `CONNECT_MAX_ATTEMPTS` are named constants in `app-connector.ts::doConnect` for quick tuning.

---

## 4. Stale `before-quit` reference in `roku-dev-studio-mcp/README.md` — **landed**

**Where:** `packages/roku-dev-studio-mcp/README.md` line 157:

> The bridge lives at `apps/roku-dev-studio/main/mcp-bridge.ts`. It starts on Electron's `ready` event (regardless of whether any host is currently using MCP) and stops on `before-quit`.

**Principle(s):** §19 (resource ownership: release on commitment), §18 (communicate at the right level — agent-facing vs user-facing). `mcp-bridge.ts` was deliberately moved from `before-quit` to `will-quit` (lines 1492–1507) with a detailed inline rationale that maps 1:1 to §19's "commitment vs preventable" framing. The README contradicts the fix.

**Symptom.** A future contributor reading the README will "fix" the bridge teardown back to `before-quit` for consistency with the doc and re-introduce the premature-release bug that was the whole subject of Issue #3 in `mcp-flows-test-report.md`. The inline comment in `mcp-bridge.ts` is long and explanatory, but it doesn't help if someone searches the README first.

**Proposed fix.** Replace the sentence with:

> The bridge lives at `apps/roku-dev-studio/main/mcp-bridge.ts`. It starts on Electron's `ready` event (regardless of whether any host is currently using MCP) and stops on `will-quit` — **not** `before-quit`, which is preventable and would leave the bridge stranded if any window cancels the quit. See `.discussion-docs/engineering-principles.md` §19 for the full rationale.

**Blast radius.** 1 line. Belt-and-suspenders: add a one-line comment at the top of `stopMcpBridge` pointing readers to the `will-quit` hookup site, so a future grep for `stopMcpBridge` finds the right lifecycle event immediately.

**Suggested phasing.** Bundle with item #2 as a docs-cleanup PR.

**What actually landed.** README line replaced with the suggested wording (calls out `will-quit` explicitly, names the settings-window close handler as the concrete preventable-cancel path, mentions the heal watcher, links to `engineering-principles.md` §19). Added the belt-and-suspenders TSDoc block above `stopMcpBridge` warning future callers against wiring it to a non-terminating lifecycle event.

---

## 5. Downstream normalizer duplication around `getExternalControlFunctions` — **landed**

**Where:**
- `apps/roku-dev-studio/renderer/components/action-scripts/script-rale-validation.ts` — `ensureRaleFunctionsWhenScriptNeedsRale` (lines 56–66) and `optionalRaleFunctionsForScript` (lines 89–98).
- `apps/roku-dev-studio/renderer/components/action-scripts/fetch-app-functions.ts` — `fetchAppFunctionsForBuilder` (lines 44–55).

Each one does:

```ts
const res = await connector.command('getExternalControlFunctions', {});
const fns = /* re-normalize res.data.functions */ normalizeRaleFunctions(res.data.functions);
```

**Principle(s):** §20 ("Normalize at the boundary; never read the raw wire shape downstream"). The connector's `maybeCacheFunctionsFromResult` already normalizes and stores the list before returning from `command()` (`app-connector.ts` lines 447–456). These callers unnecessarily read the raw `res.data.functions` and re-run the same `normalizeRaleFunctions` work downstream.

**Symptom.** No user-visible regression today — `normalizeRaleFunctions` is idempotent so the duplicate pass is wasteful but correct. The violation is latent: as soon as the normalizer grows a second step (e.g. sorting by name, stripping reserved fields, de-duping), the downstream callers that read the wire shape will diverge from the connector's cache. Same class of silent-drift bug §20 was written to prevent — `list_app_connector_functions` reports five functions, `app_function` reports zero, because one caller normalized once and one caller normalized "almost".

**Proposed fix.** Each caller should drop its own wire-shape read and read `connector.getFunctions()` instead. The connector has just populated the cache via the preceding `await connector.command('getExternalControlFunctions', {})`, so `getFunctions()` is guaranteed non-null on success.

```ts
const res = await connector.command('getExternalControlFunctions', {});
if (res?.success) raleFunctions = connector.getFunctions() ?? [];
```

Note this is exactly the pattern the `app_function` MCP handler uses (`components/action-scripts/index.ts` lines 393–401) after the §20 bug fix. We should extend it to these three.

**Blast radius.** 3 files, ~30 line diff net (mostly deletions). Zero behaviour change in the happy path.

**Suggested phasing.** Single PR. Can be bundled with item #2 as "small principle-aligned cleanups" but worth its own `git log` line so future bisects can pinpoint the normalizer-dedup if a subtle behaviour change is discovered.

**What actually landed.** Three files switched from `normalizeRaleFunctions(res.data.functions)` to `connector.getFunctions() ?? []` after the same `connector.command('getExternalControlFunctions', {})` call. Unused `normalizeRaleFunctions` imports removed from `script-rale-validation.ts` and `fetch-app-functions.ts`. The connector's `maybeCacheFunctionsFromResult` is now the **only** place that normalizes wire-shape functions — §20's single-normalizer invariant is enforced in code, not just in prose.

---

## 6. `stopConnectionMonitoring` reset scope (belt-and-suspenders) — **deferred to shelf**

**Where:** `apps/roku-dev-studio/renderer/app.ts` lines 3345–3350:

```ts
function stopConnectionMonitoring() {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }
}
```

**Principle(s):** §10 (belt-and-suspenders for state-reset functions), §19 (teardowns reset state defensively). `stopMcpBridge` in `main/mcp-bridge.ts` was recently upgraded to reset *all* renderer-driven state fields (`selectedDevice`, `connectedDevices`, `knownDevices`, `connectedDevicesObservedAt`, `appConnector`) — see the §10 entry in `engineering-principles.md`. `stopConnectionMonitoring` is a sibling teardown in the renderer but only clears its own interval handle.

**Symptom.** Today this is fine — `stopConnectionMonitoring` is only called once (line 4049) and the next call path always rebuilds state from scratch. The risk is hypothetical: a future "restart connection monitoring on device event" code path would inherit any leftover cached data the monitor was holding (the function has access to `connectedDevices` via shared scope, for example).

**Proposed fix.** Audit the closure to identify what state "belongs" to connection monitoring specifically, and reset it defensively. This is smaller than it sounds because most shared state (connected device list) is owned elsewhere — the actual scope here may be just the interval handle + maybe a last-check timestamp. If after audit the answer is genuinely "nothing else to reset", leave a one-line comment saying so (so the §10 check is documented as having been done) and move on.

**Blast radius.** 1 file, audit-first. Risk: near-zero.

**Suggested phasing.** Lowest priority on this list. Worth doing **only** when someone is touching `app.ts`'s connection-monitoring code for an adjacent reason — otherwise the audit time isn't paying for itself. Add to `engineering-principles.md` §"What's still on the shelf" rather than actively landing.

**Decision at landing.** Followed the doc's own recommendation and **did not** land. No known bug, no active refactor adjacent, audit-first work. Left parked — see the follow-up entry added to `engineering-principles.md` §"What's still on the shelf".

---

## 7. `apps/roku-dev-studio/renderer/components/action-scripts/rale-command-args.ts` — retire the renderer delegate — **landed**

**Where:** `apps/roku-dev-studio/renderer/components/action-scripts/rale-command-args.ts`. Today (since Phase 0c.3) this file only re-exports `validateAndNormalizeRaleCommandArgs` through the preload bridge; the other helpers (`listRaleCommandsForBuilder`, `raleArgsToParamStrings`, `buildRaleArgsFromParamValues`, `getRaleBuiltinDefForCommand`) are pure UI formatters.

**Principle(s):** Explicitly listed in `engineering-principles.md` §"What's still on the shelf" ("Move `validateAndNormalizeRaleCommandArgs` consumers entirely off the renderer's `rale-command-args.ts`"). Not a new violation — tracking here only so the principle-aligned cleanup backlog is one doc.

**Proposed fix.** Phased:
- 0a: move the UI formatter helpers into a new `rale-command-param-ui.ts` (name reflects what it actually does — no validation).
- 0b: migrate importers one by one. Each commit changes one file.
- 0c: delete `components/action-scripts/rale-command-args.ts` entirely. `validateAndNormalizeRaleCommandArgs` call sites can then import from `window.actionScriptValidator.validateRaleCommandArgs` directly or go through a small canonical adapter.

**Blast radius.** ~6 files (importers). Phased per §14 because the shelf-item has been parked for a while.

**Suggested phasing.** Own PR. Design-doc-first if anyone touches the import graph (§15).

**What actually landed.** Split the old renderer `rale-command-args.ts` into two narrow files:

- `components/action-scripts/rale-command-param-ui.ts` — UI-only helpers (`ALLOWED_RALE_COMMANDS`, `listRaleCommandsForBuilder`, `getRaleBuiltinDefForCommand`, `raleArgsToParamStrings`, `buildRaleArgsFromParamValues`). Name reflects what it actually does.
- `components/action-scripts/rale-command-validator.ts` — thin preload-bridge adapter for `validateAndNormalizeRaleCommandArgs`. Imports straight from `window.actionScriptValidator.validateRaleCommandArgs`.

Migrated all 7 importers (`function-execution.ts`, `builder.ts`, `builder-step-helpers.ts`, `executor-engine.ts`, `action-step-help-modal.ts`, `builder-step-form.ts`, `builder-render-step-fields.ts`) and deleted the original file. Typecheck green; no surviving references to `rale-command-args.js` outside the canonical api package.

---

## 8. Pin the generic "<FunctionName>" / "<paramName>" contract once more — **landed**

**Where:** `packages/roku-dev-studio-mcp/src/prose/*.md` + `packages/roku-dev-studio-mcp/src/tools.ts`.

**Principle(s):** §4 (no channel-specific identifiers) and §17 (generic placeholder examples). Today: `quick-start.md`, `action-script-contract.md`, `tools.ts::list_app_connector_functions`, and the `action-script-quickstart` prompt all use `<FunctionName>` / `functionParams` correctly. The `integration-guide-modal.html` uses `PlayContent` / `SetUserPreferences` / `NavigateToScreen`, which is explicitly allowed per §4 (in-app tutorial). No leak is known; this entry is a **prophylactic test**, not a fix.

**Proposed fix.** Add a one-shot ripgrep check to the `roku-dev-studio-mcp` build — fail the build if any of the banned names appear outside `integration-guide-modal.html`. Something like:

```bash
FORBIDDEN_RE='(HandlePlayBack|LoadTrackingConfig|GetMediaCapabilities|resourceConfig|trackingConfigInput|aviaAdobeECID|crossPublisherIdHash)'
if rg -q --glob '!**/integration-guide-modal.html' --glob '!**/dist/**' --glob '!**/node_modules/**' -e "$FORBIDDEN_RE"; then
  echo "Forbidden channel-specific identifier detected; see .cursor/rules/no-channel-specific-identifiers.mdc" >&2
  exit 1
fi
```

This makes §4 enforceable in CI instead of in code review.

**Blast radius.** 1 file (build script or package.json `prebuild` hook). Low risk.

**Suggested phasing.** Own PR. Easy to write; easy to test by temporarily adding one of the banned names and watching the build fail.

**What actually landed.** `packages/roku-dev-studio-mcp/scripts/check-forbidden-identifiers.mjs` (zero-dependency Node 18+ script, scans the whole repo, allowlists `integration-guide-modal.html` / `.discussion-docs/**` / `.cursor/rules/**` / the scanner itself, skips `node_modules` / `dist` / build-output dirs). Wired in as `prebuild` on the `roku-dev-studio-mcp` package (plus a standalone `npm run check-forbidden-identifiers -w roku-dev-studio-mcp` alias). Validated both paths: clean repo → exit 0; temporarily-planted `HandlePlayBack` string → exit 1 with file path, line number, the forbidden string, and a link to `.cursor/rules/no-channel-specific-identifiers.mdc`. Full MCP build exercised the hook and succeeds.

---

## 9. Direct-delegate test coverage for `validateAndNormalizeRaleCommandArgs` — **landed**

**Where:** `packages/roku-dev-studio-api/test/` currently has `validate-action-script.test.ts` (51 cases). No dedicated test file for `rale-command-args.ts::validateAndNormalizeRaleCommandArgs`.

**Principle(s):** §12 (tests at the canonical layer). `validateAndNormalizeRaleCommandArgs` is a canonical surface — not just an adapter — because it's called from the script-runner headless path and from the MCP server directly. It's currently exercised only transitively through the validator's `raleCommand` step cases.

**Proposed fix.** Add `packages/roku-dev-studio-api/test/rale-command-args.test.ts` covering, at minimum, one valid + one invalid case per command in `ALLOWED_RALE_COMMANDS`. Table-driven with the same `tsx --test` runner the existing test file uses.

**Blast radius.** 1 new test file, ~80 lines. Zero production code changes.

**Suggested phasing.** Own PR. Zero risk. Good first-issue candidate.

**What actually landed.** `packages/roku-dev-studio-api/test/rale-command-args.test.ts` with ~40 tests organized by command: generic shape (non-string command, unknown command, null/array-arg coercion, catalog coverage), `getNodeById`, `getNodeByName`, `getRegistrySections` / `clearRegistry`, `addRegistrySection`, `removeRegistrySection`, `addRegistryField`, `removeRegistryField`, `editRegistryField`. Every row has at least one valid + one invalid case. Total runner count moved from 51 validator-only cases to 93 across 19 suites; all green.

---

## Anti-items (deliberately **not** on this list)

For clarity about what was examined and passed:

- **`integration-guide-modal.html` function names** (`PlayContent`, `SetUserPreferences`, …). Explicitly allowed per §4 "Where to place identifiers when illustrative examples are needed" — tutorial examples for channel developers in the user-facing modal.
- **`WeakMap` registries without `destroy()` in `keyboard-remote-auto-screenshot-registry.ts` and `panel-api-registry.ts`.** Both hold data (not subscriptions); §9 targets WeakMaps whose values *own event subscriptions*. Letting GC clean these up is fine.
- **UI-level `setTimeout` calls (`copy-button.ts`, modal-fade cleanups, toast timers).** Not grace periods over async device state; they're UI affordance timers and orthogonal to §3.
- **`panel-api-registry.ts::registerPanelApi` / `getPanelApi`.** Separate from the Inspector bypass question — this is the adapter registry, not a device-command surface. Doesn't need routing.

---

## Open questions — resolved at landing

| # | Question | Resolution |
| - | -------- | ---------- |
| 1 | Item #1 needs an explicit ask? | User said "Fix all these issues" — explicit green-light covered the whole list. |
| 2 | Priority order? | Landed in the original doc's suggested order (regression × cost). Inspector bypass first, timer fix mid-way, renderer refactor last. |
| 3 | Bundle items #2 and #4? | Landed together as docs/comment micro-fixes (Phase A). |
| 4 | Activate item #7 now? | Yes — landed as part of the sweep. Split into `rale-command-param-ui.ts` + `rale-command-validator.ts` per the original proposal. |
| 5 | Item #8 placement? | `packages/roku-dev-studio-mcp/scripts/check-forbidden-identifiers.mjs`, zero-dependency Node script, wired as `prebuild` on the MCP package (so CI's `npm run build -w roku-dev-studio-mcp` catches it). Also available as `npm run check-forbidden-identifiers -w roku-dev-studio-mcp` for standalone runs. |

---

## Lessons learned

(Filled in after landing, 2026-05-04.)

### 1. Doc-drift happens in clusters; look for all three copies of a stale statement

The "cache auto-invalidates on disconnect" belief was stated in **three** places in the codebase: a live comment in `inspector/index.ts`, a dead-but-tempting `clearFunctionsCache` helper in `app-connector.ts`, and the `AppConnector.getFunctions()` interface TSDoc. The original backlog item #2 only caught the first two — the third came out only when I was reading adjacent lines for the §3 timer fix. **Practical move:** when you find a stale comment explaining a behaviour, grep for the behaviour's keywords across the whole file / module before moving on. The other copies are almost certainly there. This matches `engineering-principles.md` §1 for prose.

### 2. "Sanity-check by planting a forbidden name" needs robust cleanup

The forbidden-identifier scanner passed its negative test on first run, but the cleanup step in the shell heredoc didn't execute cleanly (a shell-substitution edge case) and the probe file `__forbidden_probe.ts` lingered into the next `npm run build`, which legitimately failed. Symptoms: post-build log looked like the scanner was catching a real violation. **Takeaway:** when writing negative tests for a scanner, either (a) run the scanner against a **known** in-repo forbidden-name string inside an allowlisted file (no planting needed), or (b) put the probe-and-remove inside a single `node -e` that uses `try {} finally {}` to guarantee cleanup. Plain shell cleanup is too easy to fool.

### 3. The `RaleSendCommand` callable is a reusable abstraction worth keeping

The Inspector bypass fix (item #1) ended up producing a named type, `RaleSendCommand`, and a canonical shape for "how a renderer sub-panel routes through the connector". That type is now the single contract for four sub-panels (function execution, function selector, registry params, node update) and any future RALE-using Inspector panel plugs into it with one import. Concretely validates `engineering-principles.md` §1 and §2 at the type-system level — the type itself is the enforcement mechanism. Consider extracting it to its own file if a third consumer outside `components/inspector/**` ever needs it.

### 4. `prebuild` hooks > separate `check` scripts that everyone forgets to run

The forbidden-identifier scanner is wired as `prebuild` on the MCP package, not as a `check` alias in the root that has to be invoked manually. This means any path that ends up calling `npm run build -w roku-dev-studio-mcp` — CI, the Electron `main.bundled.cjs` build chain, a new contributor's local `npm install && npm run build` flow — gets the check for free. No remembering, no documentation friction. Extend this pattern to other rule-aligned checks: wire them into `prebuild` on whichever package is their natural home.

### 5. Keep the "shelf" explicit — item #6 is a real deferral, not an oversight

The cleanups doc originally flagged item #6 as lowest-priority with "add to shelf rather than actively land" as my own recommendation. User's "Fix all these issues" could have been interpreted as "do this one too" — but deferring was the right call because the audit wouldn't produce any concrete code change (there's no state that `stopConnectionMonitoring` actually owns besides its interval handle), and landing an empty "audit completed, nothing to reset" comment isn't higher signal than not touching the file. **Pattern:** when a backlog item's own analysis concludes "only worth it adjacent to other work", trust that conclusion and add it to `engineering-principles.md` §"What's still on the shelf" so the decision is auditable.

# Engineering principles for Roku Dev Studio

**Status:** living doc, last updated 2026-05-09
**Provenance:** distilled from the multi-day session 2026-05-01 → 2026-05-04 that exercised the MCP flows end-to-end, hardened the validator surface, purged channel-specific identifiers from the repo, and centralized App Connector state. §21 added 2026-05-08 after the OWASP-MCP-guide audit landed origin/host validation, constant-time bearer compare, an append-only audit log, a per-tool token-bucket rate limiter, and per-op output-schema checks at the MCP boundary. §22 added 2026-05-09 after a README audit caught seven shipped runtime deps missing from the third-party attribution table, and `solid-js` was promoted from `devDependencies` to `dependencies` to match what the installer actually ships. Anti-pattern #16 added 2026-05-09 after a `npm run build:all` run failed twice — DMG-arm64 hit a transient `hdiutil resize` EAGAIN, and electron-builder's shared-temp-dir cleanup turned that into a second, unrelated-looking deb-arm64 failure when the after-install script vanished mid-flight.

## What this doc is

A single place to capture **how this repo wants to be built** — the architectural patterns, the don'ts, the process expectations. Treat it as the engineering style guide that complements the always-applied Cursor rules in `.cursor/rules/`.

A new contributor (human or AI) reading this doc plus the Cursor rules should be able to make changes that "fit" without needing the maintainer to course-correct.

Each principle below is concrete: it lists the code references that prove it lives in the repo today, and the anti-pattern it replaced.

---

## The session at a glance

Roughly chronological so the principles below have context:

1. **MCP flow audit.** "Test all possible MCP flows" → exercised every documented tool against three real Rokus, produced `.discussion-docs/mcp-flows-test-report.md`.
2. **Bridge-client timeout fix.** Bumped the MCP server's bridge timeout from 8 s → 35 s so the longer renderer-routed round-trips return clean device-level errors instead of a generic "Bridge request timed out". Patched the `selectedDevice` push that was reporting `source: "unknown"` and `isFocused: false`.
3. **Telnet Console MCP tools.** Added `telnet_connect` / `telnet_disconnect` direct tools (mirrors of the existing `get_telnet_log`) so an AI agent can attach the BrightScript debug socket without the user having to click anything in the UI. Updated quick-start prose with the three-step recipe (`telnet_connect` → trigger → poll `get_telnet_log({ afterCursor })` → optional `telnet_disconnect`).
4. **Direct `app_function` MCP tool.** AI agents had been authoring one-step Action Scripts for single channel-function calls because there was no "call one app function" direct tool. Added `app_function` (renderer-routed); the tool also normalizes named-object `functionParams` → positional array using the channel's declared param order, so the agent's most common shape mistake gets fixed at the boundary instead of silently no-op'ing on the device.
5. **`functionParams` shape: positional array everywhere.** Documented the canonical shape, removed implementation-leakage (`UIThread_executeExternalControlFunction`, `params[0]`, BrightScript names) from agent-facing prose. The runtime continues to tolerate named-object form as a backstop and rewrites it to positional via the channel's function list.
6. **Channel-specific identifier purge.** Removed `HandlePlayBack`, `LoadTrackingConfig`, `resourceConfig`, `com.avia.roku-remote.plist`, etc. from the repo. Added an always-applied Cursor rule (`.cursor/rules/no-channel-specific-identifiers.mdc`) that codifies the policy.
7. **Validator unification (Phases 0a → 0c).** Three different validators (MCP / Renderer / CLI) collapsed into one canonical implementation in `roku-dev-studio-api/lib/validate-action-script.ts` with a 51-case test fixture. Documented in `.discussion-docs/unified-action-script-validation.md`.
8. **App Connector state centralization.** Connection state was already a per-panel singleton; the function list wasn't. Three independent caches (Inspector, Builder, MCP bridge state) collapsed into a single `connector.onFunctionsChange` subscription with auto-cache and auto-invalidate. Documented in `.discussion-docs/app-connector-state-centralization.md`.
9. **Verification-driven discovery.** Multiple times during the session, the user verified a fix in the running studio and reported what didn't work — each surface a real bug the design hadn't anticipated (e.g. Inspector dropdown stayed empty even after the connector cache was correct, because `function-execution.ts::sendCommand` reached *under* the central `connector.command()` and called `api.raleCommand` directly).

---

## Engineering principles

### 1. Single source of truth — for state, rules, and prose

When N consumers care about the same datum, the datum lives in **one** place and N consumers subscribe.

| Datum | Owner | Subscribers |
| --- | --- | --- |
| Per-device App Connector connection state | `AppConnector` instance per panel | Inspector, Action Script Builder, Action Script Executor, MCP renderer-routed tools |
| Per-device App Connector function list | Same `AppConnector` (added 2026-05-04) | Same as above + main-process `mcp-bridge` state push |
| Action Script validation rules | `roku-dev-studio-api/lib/validate-action-script.ts` | MCP `validate_script` tool, `rds script validate` CLI, Builder's per-row UI |
| Step / RALE / keypress catalogs | `roku-dev-studio-api/lib/catalogs.ts` | All three validators + the renderer Builder + the MCP tool catalog |
| Authoring rules for agents | `catalogs.ts::AUTHORING_RULES` | Surfaced via MCP `get_authoring_rules`, `get_capability_bundle` |
| Action-script agent contract prose | `packages/roku-dev-studio-mcp/src/prose/action-script-contract.md` | Inlined into the MCP server bundle by esbuild's text loader; one source, one display |

**Anti-pattern:** three validators, three function-list caches, three subtly-different "is this functionParams shape OK?" rules — exactly what the validator and App Connector refactors collapsed.

### 2. Centralize where the data is **produced**, not where it's consumed

If you find yourself adding a fifth `setX(...)` call site to keep N caches in sync, the fix is to put the cache on the **producer** so any new caller fans out automatically.

Concrete example: the App Connector's `command()` method auto-caches successful `getExternalControlFunctions` responses on its own. New consumers (the MCP `app_function` tool, the validator's RALE preflight, future renderer tools) get the broadcast for free without anyone editing them.

```app-connector.ts
function maybeCacheFunctionsFromResult(cmd, result) {
  if (cmd !== 'getExternalControlFunctions') return;
  // …normalize and broadcast via setFunctions…
}
```

**Corollary:** consumers must reach the producer through the central method, not bypass it. Re: `function-execution.ts::sendCommand` originally calling `api.raleCommand(connectionId, ...)` directly and silently leaking the centralization — it had to be re-routed through `connector.command(...)`.

### 3. Subscribe-driven UI > poll-driven UI > timer-driven UI

`setTimeout(..., 1000)` "to give the device a moment" is almost never the right answer in this codebase. The connector subscribes to its own state change and broadcasts to listeners on the same call stack as the response handler.

When a 1-second grace period was added during the Inspector dropdown fix, it raced the Builder's borrow-disconnect (~50 ms after connect) and lost half the time. Removing the timer in favor of synchronous subscribe-on-cache-change closed that race entirely.

**Pattern:** any pub-sub primitive that exposes "current value" should fire the new listener with that value as part of `subscribe()`, then again on every change. Subscribers are the same code path on first mount and on later updates — no ordering games.

### 4. No app-specific identifiers in the repo

Codified as `.cursor/rules/no-channel-specific-identifiers.mdc` (always-applied). The rule is broad on purpose:

- App Connector function names (anything from `list_app_connector_functions` for *one* sideloaded channel — `HandlePlayBack`, `LoadTrackingConfig`, `GetMediaCapabilities`)
- App-specific parameter names (`resourceConfig`, `trackingConfigInput`, …)
- Branded reverse-DNS / package identifiers (`com.<brand>.<thing>`)
- Live data captured during testing (registry values, ECIDs, dev passwords, content URLs)

**Why:** the MCP server, the prose, and the op descriptions are read by AI agents that work against **any** customer channel. If we ship them with one channel's names, agents will hallucinate those names against channels that don't have them — exactly the bug we hit with `HandlePlayBack`.

**Where to place identifiers when illustrative examples are needed:** the in-app Integration Guide modal (`apps/.../integration-guide-modal.html`) is the canonical home for hypothetical names like `PlayContent` / `SetUserPreferences` — they're tutorial examples for channel developers, not real channel functions, and they ship with the user-facing app, not the agent surface.

### 5. Agent-facing prose teaches **contracts**, not implementation

What goes in `roku-dev-studio://action-script-contract.md` and the MCP tool descriptions:

- Which fields the agent must send
- What shapes are valid
- Worked shape templates with `<placeholder>` syntax
- Pointers to discovery tools (`list_app_connector_functions`)

What does **not** go in there (and was deliberately removed during this session):

- RALE protocol command names (`executeExternalControlFunction`)
- BrightScript function names (`UIThread_executeExternalControlFunction`)
- Channel-side implementation details (`root.callFunc(...)`, `params[0]`)
- TrackerTask internals

Internal source comments may reference those — they're explaining *why the code does what it does* to repo developers — but the agent prose stays at the contract level.

### 6. Discover at runtime — never assume

Catalogs of static things (step types, keypress vocabulary, RALE built-ins) live in `catalogs.ts`. Catalogs of channel-specific things (the function list a particular sideloaded app exposes) **must** be discovered at runtime via the matching MCP tool and never hard-coded into prose.

Agent prose anchors on this with the pattern: *"Always call `list_app_connector_functions` first; never assume a function exists across apps."* Same anchor in `quick-start.md`, `action-script-contract.md`, and the `app_function` tool description.

### 7. Validate at the boundary, run at the runtime

Run-time per-step structural re-checks were dropped (Phase 0c.2) once the canonical validator became the single gate. The runtime still enforces *runtime preconditions* — "App Connector must be connected before an `appFunction` step", "developer password must be present for `screenshot`" — because those depend on device state, not script shape.

The split:

| Concern | Where | Rationale |
| --- | --- | --- |
| Script structure (required fields, enum values, condition shape, function-params shape) | Canonical validator (one place, called by every surface) | Same script must produce the same verdict on every surface. |
| Runtime preconditions (connector live, device reachable, password set) | Inline in the runtime | Depends on device state — can't be checked offline. |
| Channel function existence + param count | Optional opt-in inside the canonical validator (`raleFunctions` argument) | Needs a live App Connector session; available to surfaces that have one. |

### 8. Auto-invalidate within the right scope

Invariants between two pieces of state are enforced **inside the writer** that owns one of them, not in every reader. *But* the invariant has to actually hold in your domain. If X is independent of Y — even when intuition says they're related — wiring `Y changed → clear X` creates spurious clears that destroy data the rest of the app just paid to fetch.

Test before tying two pieces of state together:

> **Is the invariant *"X always reflects Y"* — or just *"X often changes around the same time as Y"*?**

If the answer is the second one, scope the invalidation **narrower**: invalidate only on the truly-owning lifecycle event (`destroy()`, panel torn down, process exit), and let *consumers* decide their UI invariant locally.

In this codebase:

- The connector's connection state and the channel's function list **look** linked (both held by the connector, both about App Connector). They're not. The function list is a property of the channel's *source code*; the session is a property of *whether we're currently talking to that channel*. A borrow-pattern fetch (`fetchAppFunctionsForBuilder`: connect → fetch → disconnect) connects briefly, populates the list, then closes the session — the list it just produced is still valid. Tying invalidation to disconnect would (and did) wipe data right after fetching it.
- The right invariant: cache lives until `connector.destroy()` (panel torn down). Inspector dropdown's "show empty when disconnected" is a UX choice, owned by the Inspector via `updateConnectionUI(false) → functionSelector.clearFunctions()`. Builder gets to keep its autocomplete across borrow disconnects. MCP bridge state can show the last-known function list with `status: "available-not-connected"` — that's actually *useful* information for an agent ("this channel exposes these functions; you'll need to connect first to call them").

Counter-example where the principle does apply:

- Connection state itself flipping to `disconnected` invalidates the in-flight `connectionId`. That *is* a correct one-way coupling: connectionId is meaningful only while the session is live. The connector clears it inside `setState({ status: 'disconnected', connectionId: null, … })`.

**Worked regression** (recorded for posterity, mid-2026-05-04 session): an earlier version of this principle's example said *"connection status flips to disconnected → connector auto-clears the function-list cache → no stale-data window"*. That implementation actually broke the Builder + the MCP `list_app_connector_functions` tool, because the borrow disconnect cleared the cache the borrow's own fetch had just written. The principle was right ("auto-invalidate alongside ownership"); the ownership boundary was wrong (function list isn't owned by the session). Lesson: when the auto-invalidate fires more often than it should, narrow the scope before adding readers that work around it.

**Corollary — restore-on-resume for cleared local views** (recorded 2026-05-08): once the producer-side cache is decoupled from the session, every consumer that *locally* clears its view on disconnect (a UX choice) **must explicitly restore from the cache** when it transitions back to the active state. The producer-side `onFunctionsChange` listener fires on subscribe and on every cache change — but it does **not** re-fire just because the cache *value* is unchanged. So if Inspector clears its dropdown via `clearFunctions()` on disconnect (UX), and the cache still holds the same list when the user reconnects, the dropdown will sit at the placeholder forever unless the Inspector pulls from the cache itself.

Concrete shape, from `inspector/index.ts::updateConnectionUI`:

```inspector/index.ts
if (connected) {
  // …connection-status / button visibility…
  const cached = connection.connector.getFunctions();
  if (cached != null) {
    functionSelector.setFunctions(cached as ExternalControlFunctionMeta[]);
  }
} else {
  // …
  functionSelector.clearFunctions();   // local UX wipe; cache survives
}
```

Pair this with: do **not** also short-circuit the round-trip refetch with `if (getFunctions() != null) return;`. Instant feedback comes from cache restoration; freshness comes from the round-trip. Skipping the refetch was the bug — the borrow-fetch had already populated the cache before the user's first manual Connect, and the auto-fetch was being skipped on every connect after that.

The lesson generalizes: **a long-lived cache + a wipe-on-event local view + a "skip if cache exists" guard is a three-way pile-up.** Pick at most two: (a) restore-on-resume from the cache, OR (b) always refetch on resume, OR (c) leave the local view alone on the wipe event. Doing all three breaks.

**Corollary — gate UI reactions on user intent, not raw producer state** (recorded 2026-05-08, hours after the cache-restore corollary above): the same shared per-panel resource that fixed the cache fan-out — one `AppConnector` per panel, consumed by Inspector / Builder / Executor / MCP — also fans **state changes** out to every consumer. That's a problem for the Inspector specifically, because the Builder's borrow-pattern fetch (`fetchAppFunctionsForBuilder`: connect → fetch → disconnect) runs **automatically during panel setup** and goes through the very same connector. Without a gate, the borrow's transient `setState({ connected })` flips the Inspector's connection-status pill to "Connected", flashes the Disconnect button, and (worst of all) trips the Inspector's auto-fetch listener — which writes "Fetching available functions…" → "Found N function(s)" into the Response panel **before the user has clicked anything**, leaking the channel's function list into the visible UI on first load.

The right shape: track a `userInitiatedConnect` flag in the surface that owns the user-visible UX (here, `rale-connection.ts`), set it `true` only at the top of the user-clickable `connect()` wrapper, and gate every UI-reactive listener on it. Background consumers like the borrow-fetch never set the flag, so their state changes are invisible. The cache they populate is still the source of truth for the dropdown — `updateConnectionUI(true)` restores from cache on the user's manual Connect, exactly like the previous corollary.

```rale-connection.ts
let userInitiatedConnect = false;

connector.onStateChange((state) => {
  if (!userInitiatedConnect) return;   // borrow-fetch transient connect: ignore
  // …switch on state.status → updateConnectionUI(true|false), button text, etc.
});

async function connect(): Promise<…> {
  userInitiatedConnect = true;          // BEFORE any setState fires
  // …dev-app preflight, connector.connect, etc.
  // Reset on every failure path so the next borrow stays silent.
}

return { …, isUserInitiated: () => userInitiatedConnect };
```

Pair this with a defensive `updateConnectionUI(true)` after a successful `connector.connect()` returns: if a borrow is still mid-flight when the user clicks Connect, `connector.connect()` returns the existing session via `verify()` without firing a setState, so the gated listener never runs and the UI would otherwise stay at "Disconnected". The defensive call is idempotent if the listener did fire.

The general rule: **anything that should look idle until the user explicitly opted in must be gated on a user-intent flag, not on raw producer state.** Background tasks (borrow-fetches, validators, prefetches, MCP tool round-trips) sharing the same producer is good architecture — it's how we keep one normalized cache. But it means UI surfaces can no longer treat the producer's state stream as "what the user is doing"; they have to track user intent locally.

### 9. Explicit teardown beats GC-eligible cleanup

`WeakMap`-keyed registries (the per-panel `AppConnector`, the per-panel `app-connector-registry.ts`) are great for *creation* — multiple modules converge on the same instance — but bad for *destruction*: the entry is freed only when the panel becomes unreachable.

If the value owns event subscriptions (IPC, DOM, websocket, …), GC-dependent cleanup is non-deterministic and accumulates listeners. The pattern is: pair every WeakMap registry with an explicit `destroy()` hook the owner calls at teardown.

```app.ts
function disconnectDevice(...) {
  // …
  const connector = peekAppConnector(panel);
  if (connector) connector.destroy();   // unhooks RaleDisconnected IPC sync
  panel.remove();
  // …
}
```

### 10. Belt-and-suspenders for state-reset functions

Any function *named* like a teardown should reset state to its default, even if today it's only called from a path that's about to terminate the process. Today it's `before-quit`. Tomorrow it might be a hot-reload, a restart-on-error, a "reload MCP" feature. Cheap to write defensive resets; expensive to debug stale-state from a future call site that didn't exist yet.

`stopMcpBridge` now resets `state.{selectedDevice, connectedDevices, knownDevices, connectedDevicesObservedAt, appConnector}` for this reason.

### 11. Cursor rules for always-applied conventions

This repo uses three always-applied workspace rules at `.cursor/rules/`:

- `discussion-design-docs.mdc` — *exploratory write-ups, design docs, and RFC/ADR-style notes go in `.discussion-docs/`, kebab-case filenames.*
- `approval-before-scope-expansion.mdc` — *stop and ask the user before adding new functionality or making major design changes; small fixes in files already in scope are OK.*
- `no-channel-specific-identifiers.mdc` — *no app-specific function names, param names, branded reverse-DNS, or registry data anywhere in the repo.*

When an agent or contributor encounters a recurring concern that should bind future work, the right move is to write a Cursor rule for it (concise, alwaysApply: true if universal, or globs-scoped if file-specific).

### 12. Tests at the canonical layer

The canonical Action Script validator has 51 tests covering every row of the §2 matrix in `unified-action-script-validation.md`. Adapter layers (MCP wrapper, renderer wrapper, CLI wrapper) are not separately unit-tested — they're delegate-only and covered by typecheck.

**Pattern:** test the rule logic where it lives, not at every consumer. If you're tempted to add a fifth test file for the same rule, see Principle 1.

### 13. Verify on real devices, not just typecheck

Every refactor in this session ended with a smoke test against the live MCP bridge running on the user's actual Roku devices. Typecheck and unit tests caught the structural regressions; the live bridge caught:

- `connector.command()` bypass in `function-execution.ts` (typecheck was happy; the dropdown was empty in the running app).
- The Builder's borrow-disconnect race against the original 1-second grace timer.
- The "executor connected, dropdown stays empty" bug that motivated the entire App Connector centralization.

The bridge probe + a couple of `curl`-driven tool calls against the live session is a 30-second test loop; use it.

### 14. Phase big refactors (0a → 0b → 0c)

When a refactor touches multiple packages and surfaces, split into reviewable phases:

| Phase | What lands |
| --- | --- |
| 0a | New canonical implementation + tests, **no call-site changes**. Compiles green; user verifies the new code in isolation. |
| 0b | Migrate call sites one at a time. Each commit is independently reviewable. |
| 0c | Delete the duplicate implementations now that no caller needs them. |

The validator unification (`unified-action-script-validation.md`) used this exact structure. Each phase had its own typecheck + test gate; the user could pause at the end of any phase if something looked wrong.

### 15. Design doc before major changes

For anything that touches multiple packages, has architectural impact, or would surprise a reviewer in a large diff: write a design doc under `.discussion-docs/` first. The doc has a few mandatory sections:

- **Status** (draft / landed / superseded)
- **What was wrong** (the problem in concrete terms, with code references)
- **Goals & non-goals** (so scope is bounded)
- **Design** (the actual proposal)
- **Migration plan** (file map; phased if needed)
- **Risks**
- **Decisions needed before coding** (numbered checklist)
- **Lessons learned** (filled in after landing)

Both `unified-action-script-validation.md` and `app-connector-state-centralization.md` follow this template. The "decisions needed" checklist is what prevents the user from being surprised mid-implementation — they answer the open questions, then the diff is mechanical.

### 16. Handler/executor inconsistency is a smell

Multiple runtimes for the same surface (e.g. the renderer's Action Script Executor and the headless `script-runner` in the api package) is fine *if* they share rule logic. When their rules diverge — `script-runner` strictly rejects what the renderer happily runs — that's a bug, not a feature. The fix is the canonical validator (Principle 1) and runtime preconditions (Principle 7).

This applied to `appFunction.functionParams`: the renderer normalized named-object → positional silently; the headless runner hard-rejected. A script that "worked in Builder" broke on `rds run-script`. Now both runtimes share the canonical validator + the same runtime normalizer.

### 17. Generic placeholder examples in agent prose

When prose needs an example, use `<FunctionName>` / `<paramName>` placeholders, not real names — even hypothetical-but-tempting ones from your own integration guide. Hard rule: agent-facing prose contains **zero** specific function names. If a worked example is needed, point at the in-app Integration Guide modal (which is for channel devs reading docs, not agents) rather than baking the example into prose.

### 18. Communicate at the right level

Agent prose lives in `packages/roku-dev-studio-mcp/src/prose/*.md`. Channel-developer docs live in the Integration Guide modal HTML. End-user product docs live in the existing `docs/` (or package READMEs). Internal design notes live in `.discussion-docs/`. Don't cross the streams — don't put implementation details in agent prose, and don't put agent quirks in channel-dev docs.

### 19. Resource ownership: release on commitment, heal on surprise

When code owns a side-effecting resource — a file on disk, a listening socket, an IPC subscription, a lock, a long-lived registration in another process, a peer service handle — two questions need explicit answers:

1. **When do we release it?** Pick the lifecycle event that's **committed**, not one that's *requested* and **preventable**. Releasing on a "request" event causes the cancel-after-release bug: the request gets canceled, the app stays alive, but the resource is already gone. The general rule: release on the *post-condition* event ("connection closed", "task ended", "all windows actually closed"), not the *pre-condition* event ("close requested", "task starting to end", "quit requested"). When both kinds of event exist, prefer the later one even if it sometimes means the resource lingers a few extra milliseconds.

2. **What if the resource disappears for a reason outside our control?** Periodically re-write / re-register if missing, while we're still alive and own it. This catches three classes of failure:
   - **Past us** calling release prematurely (point 1) and never recovering.
   - **External processes** deleting / displacing the resource (manual fs intervention, OS cleanup, time-machine restore, peer service restart, hot-reload tooling).
   - **Future code paths** that haven't been written yet — e.g. someone adding a new caller to our `stopX()` function for a reason that doesn't actually mean "the app is exiting".

Both legs are needed. Without (1), the heal fights the unwanted release. Without (2), a single bad release path leaves the resource dead until the user restarts the app — and the bug is invisible to the owner because the owner thinks it released the resource on purpose.

**Concrete instance** — the MCP bridge descriptor file
(`apps/roku-dev-studio/main/mcp-bridge.ts`):

```mcp-bridge.ts
// (1) Release on the committed lifecycle event, not the preventable one.
//     `before-quit` is preventable: any window's `close` handler can cancel
//     the quit (we have one in `settings-dialog.ts`). `will-quit` only
//     fires after windows have actually closed — the app is committed to
//     terminating.
app.on('will-quit', () => {
  stopMcpBridge();
});

// (2) Heal if the descriptor disappears while we're still listening.
//     Logs the heal so it's auditable in the bridge log.
descriptorRecheckInterval = setInterval(() => {
  if (!server) return;             // bridge actually shut down — don't fight it
  rewriteDescriptorIfMissing();
}, 2000);
descriptorRecheckInterval.unref();   // never block process exit just for the watcher
```

Heal events are logged (`[mcp-bridge] bridge descriptor was missing — rewrote at <path> (port <N>)`), so a future bug that's silently triggering re-writes shows up in the log instead of being invisible.

**Anti-pattern.** The original bug: teardown was wired to `before-quit`, the descriptor was deleted prematurely on a partial-quit (settings window's `close` handler called `event.preventDefault()`, app stayed alive), the bridge kept listening on its port with its original bearer token but no client could discover it, and AI agents reported `live: false` while the user could see the app running. The fix needed both legs above; either one alone would have been brittle — point 1 alone could be defeated by a future caller of `stopMcpBridge()` who doesn't realize the app might not exit, and point 2 alone would have papered over the bad lifecycle wiring with a silent rewrite every 2 seconds.

This generalizes Principles 9 and 10: §9 says *call teardown explicitly*, §10 says *teardowns reset state defensively*, and §19 adds *teardowns fire at the right time, and the resource heals if it dies anyway*.

### 20. Normalize at the boundary; never read the raw wire shape downstream

When data crosses an external boundary — an HTTP response, an IPC message, a BrightScript-side serializer, a third-party SDK callback — **normalize it once, at the boundary, into the shape the rest of the codebase agrees on**. Every consumer downstream reads the normalized shape and only the normalized shape. Reaching back to the raw wire shape from a downstream caller is a recipe for "works in caller A, silently broken in caller B".

| Wire shape (raw) | Normalized shape (in-memory) | Normalizer |
| --- | --- | --- |
| `getExternalControlFunctions` returns `{ functionName, params, description }` per entry | `{ name, params, description? }` | `roku-dev-studio-api/lib/rale-functions-normalize.ts::normalizeRaleFunctions` |
| RALE result envelope `{ success, data, error }` (with `data` sometimes a JSON string, sometimes an object, sometimes nested under `response.functions`) | `{ ok: true, functions: [...] } \| { ok: false, error }` | Same file: `parseGetExternalControlFunctionsResponse` |

The fan-out: every caller that needs a function list now reads the **normalized** shape, either via `connector.getFunctions()` (which auto-caches the normalized shape via `maybeCacheFunctionsFromResult`) or by calling the normalizer explicitly when no connector is in scope (e.g. the headless `script-runner.ts`, the renderer's `executor-engine.ts` runtime named-object path).

**Anti-pattern.** A downstream caller writes its own ad-hoc reader against the raw response (`fnRes.data?.functions` and looks up by `f.name`). If the field happens to be called `functionName` on the wire, every channel "looks empty" — the lookup silently never matches and the user sees `Available functions: (none — channel exposes no external control functions)`. Meanwhile other call sites that *do* normalize work correctly, so the bug is invisible at the contract level: same input, two different answers depending on which caller reaches the device.

**Concrete instance** — `app_function` MCP handler bug fixed 2026-05-04:

```action-scripts/index.ts
// Wrong — reads raw wire shape, lookup by `f.name` always misses:
const allFns = Array.isArray(fnRes.data?.functions) ? fnRes.data.functions : [];
const fn = allFns.find((f) => f && f.name === functionName);

// Right — round-trip the command (so the connector's auto-cache fires)
// then read the normalized list from the connector:
await connector.command('getExternalControlFunctions', {});
const allFns = connector.getFunctions() || [];
const fn = allFns.find((f) => f && f.name === functionName);
```

For callers without a connector (CLI / headless / renderer engine helpers that only have a raw `raleCommand` function), call the normalizer explicitly:

```script-runner.ts
const rawFns = fnList?.success && Array.isArray(fnList.data?.functions)
  ? fnList.data.functions as unknown[]
  : [];
const fns = normalizeRaleFunctions(rawFns) as Array<{ name?: string; params?: ... }>;
const fn = fns.find((f) => f && f.name === step.functionName);
```

**Heuristic for spotting the violation in review.** Search the codebase for `f.name === ` and `f.functionName === ` near `getExternalControlFunctions` results — if both forms appear, two callers disagree on the wire shape and one of them is wrong. Same heuristic generalizes to any other wire field whose name differs from the in-memory name (`url` vs `href`, `status` vs `state`, etc.).

This is the corollary of §1 (single source of truth) for **shape**: one normalizer, one in-memory shape, every consumer reads the same thing.

### 21. Layered boundary checks at the chokepoint, not at each handler

Auth, rate-limit, and audit logging for live ops belong at one chokepoint that every endpoint funnels through — not sprinkled across individual handlers. New endpoints inherit the full check stack the moment they're routed, and a future audit ("which endpoints are protected?") is a single read of the chokepoint instead of a code search.

In `apps/roku-dev-studio/main/mcp-bridge.ts::handleRequest` the layers run in fixed order before any branch executes:

1. **Origin / Host check** (`isLoopbackRequest`) — DNS-rebinding mitigation. Runs *before* the bearer check so a rebinding attempt doesn't get a 401-vs-403 oracle that confirms the bearer is set.
2. **Bearer token check** (`isAuthorized`) — constant-time compare via `crypto.timingSafeEqual` (length-mismatch short-circuits, but the token length is fixed and well-known).
3. **Rate-limit gate** (`rateBudgetForRequest` + `take`, in `mcp-rate-limit.ts`) — token-bucket per pathname key. `/op/<id>` looks up `op.destructive` to pick 60/min vs 20/min; back-compat aliases use a hardcoded destructive set; read-state GETs and `/scan-devices` (own stricter cooldown) are exempt. Rejected requests return 429 with `Retry-After` and `retryAfterMs`.
4. **Audit hook** (`recordMcpAudit`, in `mcp-audit-log.ts`) — fires from a single `res.on('finish')` once the response has flushed (so `status`, `durationMs`, and `ok` are real, not intended). Per-branch code only sets `audit.device` and `audit.params`; `seedAuditFromPath` derives the rest from the URL. Append-only JSONL, mode 0600, rotates to `mcp-audit.log.1` at 5 MB. Secrets (`password` / `devPassword` / `token` / `imageBase64`) are redacted *before* hashing for `paramsHash` so the hash itself can't encode them.
5. **Output-schema check** (consumer-side, in `packages/roku-dev-studio-mcp/src/tools.ts::warnOnOutputSchemaMismatch`) — every `RokuOp` declares an `outputSchema` (`packages/roku-dev-studio-api/lib/operations.ts`); the MCP boundary validates `res.body` against it and logs mismatches to stderr. Warn-only today; flips to reject in a future release once the noise floor is zero.

The shape is deliberately layered, not bundled: each check is a small standalone module (`mcp-audit-log.ts`, `mcp-rate-limit.ts`, `output-schema-validator.ts`) that the chokepoint composes. A new check ("LLM-as-a-judge", "OPA policy", "destructive-op confirmation") is one more line in the chokepoint plus one new module — it doesn't ripple into every endpoint.

**Anti-pattern.** Per-endpoint ad-hoc checks. The pre-2026-05-08 bridge had:

- `scan_devices`'s 10 s cooldown inlined in the `/scan-devices` handler — every other endpoint was unprotected against runaway agent loops.
- `console.log` audit lines varying per branch — not retained, not redacted, no rotation, no schema.
- No origin check at all (DNS rebinding worked); bearer compare via `===`.

Fixing those three gaps as scattered per-handler edits would have meant 13+ touch points and a guarantee that the next endpoint added would forget at least one. Routing through the chokepoint instead means the rate-limiter for a new tool is `null`-out-of-the-box (sensible default) and the audit record is a 2-line refinement (`audit.params = body; audit.device = ip;`).

This is §1 ("single source of truth") and §2 ("centralize where the data is produced") applied to **policy**: one place that says "what does it mean to be a live op endpoint here?" — the answer is "auth + origin + rate-limit + audit + output-schema check, in that order." Future protection layers join the stack at the chokepoint; they don't get re-implemented per endpoint.

### 22. Every shipped runtime dep is listed in a README third-party table

`package.json` declares dependencies for the build; the README declares them for the user. When a new runtime dep is added — i.e. anything that ends up in the installer, the published npm package, or the renderer bundle — the third-party attribution table in the matching README is updated in the same change. MIT and Apache-2.0 both require the upstream notice to travel with the distribution; the table is how we satisfy that and how a downstream auditor can answer "what did you ship?" without unpacking the artifact.

| Surface | README that owns the table | Covers |
| --- | --- | --- |
| Desktop app + everything reachable through it | [`README.md`](../README.md#license) | All deps that end up in the Electron installer, including transitive workspace packages' runtime deps (`archiver`, `commander` from `roku-dev-studio-api`) |
| `roku-dev-studio-api` (npm package, also drives `rds` CLI and remote server) | [`packages/roku-dev-studio-api/README.md`](../packages/roku-dev-studio-api/README.md#license) | Its own direct runtime deps |
| `roku-dev-studio-mcp` and `roku-dev-studio-remote-server` | Their READMEs | Cross-reference the api package's table when they have no third-party deps of their own |

**`devDependencies` vs `dependencies` matters.** Anything whose compiled output is baked into the renderer bundle by `vite build` is a runtime dep even though the source lives behind a build step. `solid-js` was originally listed as a `devDependency` because the source files only exist in the build pipeline, but the framework's runtime ships in the user's installer — it now lives under `dependencies` so the package manifest matches reality. Pure tooling that runs only during typecheck / build / sign (`tsx`, `typescript`, `esbuild`, `vite`, `vite-plugin-solid`, `concurrently`, `cross-env`, `wait-on`, `jsdom`, type-only `@types/*` packages, `@electron/notarize`) stays in `devDependencies` and is intentionally **not** listed in the third-party table.

**Anti-pattern:** adding a dep to `package.json`, shipping it, and only updating the README months later when an audit catches the drift. The fix is small (one row); the discipline is to make it part of the same diff that introduced the dep.

---

## Anti-patterns to avoid (extracted from bugs we fixed)

1. **Reaching under a central abstraction.** Calling `api.raleCommand(connectionId, ...)` directly when the codebase has `connector.command(...)` available — bypasses interceptors, error recovery, state caching.
2. **Three caches for the same datum, each populated by its own producer.** The Inspector / Builder / MCP-bridge function-list trio.
3. **Three validators with overlapping rules and divergent error shapes.** The MCP / Renderer / CLI validator trio.
4. **Promises that race teardown.** The 1-second grace timer racing the Builder's borrow-disconnect.
5. **WeakMap registry without `destroy()`.** Slow IPC listener leak.
6. **Validation prose that names specific channel functions.** AI agents copy the example into the next channel.
7. **Documenting an agent contract via implementation details.** "Roku reads `params[0]`" is fact-but-noise; the agent only needs "`functionParams` is a positional array".
8. **`stopX()` that doesn't reset state.** Process-exit-only behavior is a footgun for hot-reload.
9. **One-step Action Scripts for single deterministic actions.** Direct ops exist for a reason; scripts are for multi-step / conditional / save-and-share flows.
10. **Bridge / client timeouts that are shorter than server-side flow timeouts.** Generic "timed out" hides actionable device errors.
11. **Releasing an owned resource on a *preventable* lifecycle event.** Bridge descriptor deleted in `before-quit`, then a window cancelled the quit and the bridge survived without its descriptor. Release on the committed event (`will-quit`) and pair with a self-heal watcher.
12. **Auto-invalidating across an ownership boundary that doesn't actually exist.** Tying the function-list cache to connection state cleared the cache during the Action Script Builder's borrow-pattern fetch (connect → fetch → disconnect), so `list_app_connector_functions` reported `not-applicable, []` for a channel that had just answered with five functions. Test the invariant: is X *truly* derived from Y, or just often changes around the same time? If the latter, narrow the invalidation scope (see §8).
13. **Reading the raw wire shape from a downstream caller.** Every callsite that wants a normalized record but reads the raw wire shape directly is a future "works in caller A, silently broken in caller B" — `app_function` returned `Available functions: (none — channel exposes no external control functions)` while `list_app_connector_functions` on the very same connector returned five functions, because the wire field is `functionName` and only the working caller went through the normalizer. Normalize at the boundary; downstream code reads the in-memory shape only (see §20).
14. **Per-endpoint ad-hoc protection layers.** Inlining a rate-limit / audit log / schema check inside one handler instead of layering it at the chokepoint guarantees the next handler added forgets at least one. Old shape: `scan_devices` cooldown inside `/scan-devices`, `console.log` varying per branch, no origin check, `===` bearer compare. New shape: stacked at `handleRequest`'s top — origin → bearer (timing-safe) → rate-limit → audit hook → output-schema (consumer-side). Adding a check is one chokepoint line + one new module (see §21).
15. **Runtime dep added to `package.json` without updating the README third-party table.** The manifest knows what got shipped; users don't, and MIT/Apache-2.0 attribution requires the notice to travel with the distribution. Update the table in the same diff (see §22). Related sub-form: leaving a runtime dep under `devDependencies` because its source lives behind a build step, even though its compiled output ends up in the user's installer (`solid-js` baked by `vite build`).
16. **Bundling multiple build targets into one tool invocation when the tool shares mutable temp state across targets.** `electron-builder --mac --win --linux` runs all three platforms inside one process sharing a single `/private/var/folders/.../T/t-XXXX/` working dir. When DMG-arm64 hit a transient `hdiutil resize` EAGAIN, electron-builder's failure-path cleanup deleted the deb-arm64 build's `2-after-install` script mid-flight, cascading one transient failure into two unrelated-looking ones (same `t-IH72pM` path in both error messages was the giveaway). Fix: **fan out at the harness layer** — `concurrently` runs three independent `electron-builder --<platform>` processes, each with its own temp dir; a single `clean:dist` runs upfront so the per-script cleanups don't race; no `-k` flag, so a transient mac failure doesn't take linux/win artifacts down with it. The `build:mac` / `build:linux` / `build:win` standalone scripts keep their own per-script cleanup for solo use. See `apps/roku-dev-studio/package.json::build:all` and §1 (single source of truth, applied to the *invocation* — one harness orchestrates, the underlying tool runs once per target).

---

## Process — how to work in this repo

### Where things live

```
.cursor/rules/                  ← always-applied AI-guidance rules (mdc)
.discussion-docs/               ← design / RFC / ADR / lessons-learned (md)
docs/                           ← end-user / public docs (don't put internals here)
apps/roku-dev-studio/           ← Electron app: main + preload + renderer + scripts
packages/roku-dev-studio-api/   ← Node-importable: catalogs, validators, runtime,
                                   CLI (`rds`), shared logic. CommonJS module.exports.
packages/roku-dev-studio-mcp/   ← MCP server bundled by esbuild; thin adapters around
                                   `roku-dev-studio-api/lib/*` + agent-facing prose.
packages/roku-dev-studio-remote-server/ ← optional relay for off-LAN device control.
roku-components/                ← BrightScript-side TrackerTask source (the device half).
```

### Build order

```
roku-dev-studio-api  →  roku-dev-studio-mcp
                     ↘
                       apps/roku-dev-studio (preload bundles api/dist into Electron)
```

Always rebuild `roku-dev-studio-api` first when its `lib/*` changes; then `roku-dev-studio-mcp` (which `require()`s it); then restart Electron (`npm start`) so the renderer + main process pick up new preload bundles.

### Typecheck gates (in order of suspected impact)

```bash
npm run typecheck -w roku-dev-studio-api      # canonical layer
npm run typecheck -w roku-dev-studio-mcp      # MCP server
npm run typecheck:renderer -w roku-dev-studio # browser-side TS
npm run typecheck:electron -w roku-dev-studio # main-process TS
```

The pre-existing `typecheck:scripts` failure in `apps/roku-dev-studio/scripts/build/ensure-modern-screenshot-vendor.ts` is unrelated to this work and was left alone.

### Test gates

```bash
npm test -w roku-dev-studio-api   # validator + unit tests via `tsx --test` (Node 18+)
```

If you're touching the validator, add a fixture in `packages/roku-dev-studio-api/test/validate-action-script.test.ts` covering both the valid path and the invalid path for the new rule. New rules without tests are not done.

### Smoke-test the live bridge

After significant changes, restart the studio (`npm start`), then:

```bash
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$HOME/Library/Application Support/Roku Dev Studio/mcp-bridge.json','utf8')).token)")
PORT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$HOME/Library/Application Support/Roku Dev Studio/mcp-bridge.json','utf8')).port)")
curl -s -m 5 -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/health"
```

…then exercise the affected tools / endpoints. The MCP server in Cursor's host needs an explicit reload (Cursor → Settings → MCP → Reload) when its bundled `dist/index.cjs` changes; killing the child PID does **not** reliably auto-respawn.

### When to ask before scope expansion

The `approval-before-scope-expansion.mdc` rule is summarized as:

| Change | Ask first? |
| --- | --- |
| New tool / new MCP capability / new public API | yes |
| Architectural / protocol / data-shape change | yes |
| Broad refactor or multi-package migration | yes (write a design doc first) |
| Small fix in files already in scope | no |
| Edits the user explicitly requested | no |
| Linter / formatter / typo fixes | no |

Default to asking. A one-line check ("I'm about to add X — OK?") is enough.

### When the user says "fix everything"

That's the design-doc → 0a → 0b → 0c flow. Don't merge phases unless the user says merge them. Each phase ends with typecheck + tests + smoke-test + a changelog update in the relevant `.discussion-docs/*.md`. Then status flips: "queued" → "landed" with a date.

### When the user reports a bug from verification

Capture the **exact symptom** (Response panel showed `Found 5 function(s)` but dropdown stayed empty) and the **root cause** (`sendCommand` bypassed `connector.command`) in the design doc as a **verification-time finding**. Future readers see how the bug was found and how the design assumed something that wasn't true.

This is more valuable than a fix-in-isolation commit message.

---

## Concrete patterns this codebase uses

### Pattern: per-panel singleton via WeakMap

`getAppConnector(panel, api)` returns the same `AppConnector` instance for the same `DevicePanelRoot` — the registry's WeakMap is keyed on the DOM node:

```app-connector-registry.ts
const registry = new WeakMap<DevicePanelRoot, AppConnector>();
```

Every consumer that talks to the App Connector goes through this. The MCP renderer-routed tools, the Inspector, the Builder, the Executor — all converge on one connector per device tab.

Use this when:
- A resource has a natural per-panel scope.
- Multiple modules need to observe the same state.
- Creation should be lazy.

### Pattern: subscribe-on-mount, fires-immediately

Both `AppConnector.onStateChange` and `AppConnector.onFunctionsChange` invoke the new listener once with the current value before returning. Subscribers don't need to remember to read-then-subscribe.

```app-connector.ts
function onFunctionsChange(listener) {
  functionsListeners.add(listener);
  try { listener(functions, functionsFetchedAt); } catch {}
  return () => functionsListeners.delete(listener);
}
```

### Pattern: auto-cache via wire-level interceptor

The `command()` method peeks at the response for `getExternalControlFunctions` calls and caches the function list as a side effect. Centralizes "the function list is whatever the device most recently said" without any consumer explicitly calling `setFunctions`.

### Pattern: thin adapters around a canonical implementation

Validator surface today:

```
roku-dev-studio-api/lib/validate-action-script.ts        ← canonical
roku-dev-studio-api/lib/script-runner.ts::validateScriptStructure
                                                          ← thin adapter (sentence form)
roku-dev-studio-mcp/src/validator.ts                     ← thin adapter (re-export)
apps/roku-dev-studio/renderer/components/action-scripts/validator.ts
                                                          ← thin adapter (renderer shape via preload)
```

Each adapter is ~50 lines and does only shape translation. New adapters are mechanical to add.

### Pattern: design doc + lessons-learned addendum

`.discussion-docs/unified-action-script-validation.md` and `.discussion-docs/app-connector-state-centralization.md` both:

- Open with the problem
- Document goals + non-goals
- Lay out the design
- List a phased migration plan
- Record a "Status" line that flips from draft → landed
- End with a "Lessons learned" section the reviewer fills in **after** landing

Future contributors find the lessons section first ("what should I know before touching this?") and the design section second ("what was the original plan?"). Both are reusable across the project.

### Pattern: prose loaded via esbuild text loader

The MCP server's prose files in `packages/roku-dev-studio-mcp/src/prose/*.md` are inlined into `dist/index.cjs` at build time:

```ts
import QUICK_START_MD from './prose/quick-start.md';
```

Means there's exactly one source of truth for agent-facing strings, and the MCP server doesn't need a separate prose file at runtime. Editing prose is a code change with a typecheck gate.

### Pattern: catalogs.ts as the anti-drift module

Every constant the validator, the Builder, the MCP tool catalog, and the renderer share lives in `packages/roku-dev-studio-api/lib/catalogs.ts`. The file's own header says:

> *"Adding a field to one of these catalogs propagates to every consumer on the next build. This is the explicit anti-drift module."*

Adding a new step type, a new RALE built-in, a new wait condition source, a new authoring rule → one file change.

### Pattern: rich error shape with `path` / `code` / `expected[]`

Validation errors are `{ path, code, message, expected?, stepIndex? }`. The MCP `validate_script` tool returns them, the CLI's `--json` returns them, the Builder's per-row error display surfaces `expected: [a, b, c]` inline. AI agents have machine-readable codes for self-correction; humans have inline hints for direct UI use; CLI users have readable sentences in non-JSON mode.

Anti-pattern: validation errors as opaque strings. The agent has to grep for substrings and the code can't grow new categories without breaking grep patterns.

---

## What's still on the shelf (deliberately)

Not every refactor that came up during the session shipped. These are listed so future work knows where to find them:

- ~~**Move `validateAndNormalizeRaleCommandArgs` consumers entirely off the renderer's `rale-command-args.ts`.**~~ **Landed 2026-05-04** as item #7 of `.discussion-docs/principle-aligned-cleanups.md`. Renderer delegate split into `rale-command-param-ui.ts` (UI helpers) + `rale-command-validator.ts` (preload-bridge validator adapter); the old file is gone.
- **Bridge state push as a connector subscription, end-to-end.** Today the renderer's `setupActionScripts` subscribes and pushes; future work could let the bridge subscribe to a renderer-pushed event stream without each consumer pushing.
- **More aggressive validator-driven UI hints.** The Builder's per-row error shows `expected: [a, b, c]` inline; could become a tooltip with a "fix it" affordance for common mistakes.
- **Unify the `roku-dev-studio-api/dist/lib/*.d.ts` typing for the CommonJS modules.** Today `lib/validate-action-script.d.ts` is `export {}` because the source uses `module.exports` + JSDoc; consumers `require()` with a cast. Could move to dual-format publishing if it ever becomes a friction point.
- **`stopConnectionMonitoring` belt-and-suspenders audit** (item #6 of `.discussion-docs/principle-aligned-cleanups.md`). §10 "belt-and-suspenders for state-reset functions" suggests a future audit for symmetry with the `stopMcpBridge` upgrade. Intentionally deferred: `stopConnectionMonitoring` in `app.ts` only owns an interval handle; there's no adjacent connection-monitoring state it could meaningfully reset. Pick up **only** when an unrelated edit is touching the same code path; otherwise the audit cost doesn't pay for itself.

These are explicitly *not blocked* on anything — they're cleanups someone (human or agent) could pick up cleanly because the surrounding architecture is now in place.

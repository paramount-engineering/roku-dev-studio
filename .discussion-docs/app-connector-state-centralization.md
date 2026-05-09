# AppConnector: state centralization & lifecycle hygiene

**Status:** landed 2026-05-04
**Author:** Cursor agent (Composer)
**Related:** `.discussion-docs/app-connector-refactor.md` (the original
move from per-component to per-panel singleton),
`.discussion-docs/unified-action-script-validation.md` (the validator
unification that exposed this gap)

## What was wrong

The per-panel `AppConnector` is the **single source of truth for
connection state** — every consumer (Inspector, Action Script Builder,
Action Script Executor, MCP renderer-routed tools) goes through
`getAppConnector(panel, api)` and observes the same status / connectionId
via `onStateChange`. That part already worked.

The **function list** (the channel's exported
`getExternalControlFunctions` set) was a different story. Three
independent caches lived next to the connector but did not share state:

| Cache                                                                                         | Used by                                               |
| ---                                                                                           | ---                                                   |
| `availableFunctions` inside `function-selector.ts` (set via `setFunctions()`)                 | Inspector's Execute Function dropdown                  |
| `raleFunctions` inside `builder.ts` (set via `setRaleFunctions()` / `getRaleFunctions()`)     | Builder type-ahead + validator's appFunction checks    |
| `state.appConnector.functions` in `main/mcp-bridge.ts` (pushed via `pushMcpBridgeState`)      | MCP `list_app_connector_functions` + `validate_script` |

Each cache was populated by its own fetch (`fetchAvailableFunctions` /
`fetchAppFunctionsForBuilder`) and updated only when its specific path
ran. After a disconnect, only the Inspector's cache was cleared; the
Builder's stayed alive until the next Builder fetch, the bridge's stayed
alive until the next renderer push.

Concrete consequences:

1. **The "Connected, but the dropdown is empty" bug.** When the Action
   Script Executor opened the connector during a script run, the Inspector
   tab's status flipped to "Connected" via `onStateChange`, but its
   dropdown stayed at "-- Connect to load functions --" because nothing
   triggered the Inspector's local fetch. (Patched in a previous session
   by adding an `onStateChange` subscription that fetches functions when
   the state goes to `connected`.)
2. **Stale Builder autocomplete after re-sideload.** A user could
   disconnect, sideload a different build, reconnect, and have the Builder
   still autocomplete the *old* function names because Builder's
   `raleFunctions` was never invalidated.
3. **`connector.destroy()` never called on tab close.**
   `disconnectDevice` in `app.ts` removed the `.tab-panel` DOM node and
   relied on the WeakMap registry to GC the connector. The connector
   itself still held an active `RaleDisconnected` IPC subscription via
   `window.roku.onRaleDisconnected(...)`. On a long session with many
   tab open/close cycles this was a slow listener leak; functionally
   harmless until GC reclaimed the renderer-side closure, but visible in
   diagnostics.
4. **`stopMcpBridge()` did not reset `state.appConnector`.** `before-quit`
   calls `stopMcpBridge()`, which clears the descriptor file, port, and
   pending-request maps. It left `state.appConnector` populated. In the
   normal exit path the whole process dies right after, so it didn't
   matter — but if the bridge ever stops/restarts within a single
   process lifetime (hot-reload, restart on error, …) the next start
   would inherit a stale function list.

## Goals

1. **One owner of the function list per panel.** The `AppConnector`
   itself.
2. **Pull, not push.** Consumers subscribe; nobody hand-walks state into
   peer modules.
3. **Auto-invalidate on disconnect.** The cache flips to "no functions"
   the moment the session ends, regardless of who initiated the
   disconnect.
4. **Explicit teardown when a panel goes away.** Tab close calls
   `connector.destroy()` so IPC subscriptions don't leak waiting for GC.
5. **Don't break existing UX or APIs.** Every consumer that previously
   read `availableFunctions` / `raleFunctions` / the MCP bridge cache
   should keep working — the migration is internal.

## Design

### AppConnector additions

```ts
// state.ts
export type AppConnectorFunction = {
  name: string;
  params: Array<{ name: string; type?: string }>;
};

export interface AppConnector {
  // … existing API unchanged …

  /** Last-fetched function list. `null` means "never fetched in this session". */
  getFunctions(): AppConnectorFunction[] | null;

  /** ISO timestamp of the last successful fetch, or null. */
  getFunctionsFetchedAt(): string | null;

  /** Subscribe to function-list changes. Fires immediately with current value. */
  onFunctionsChange(
    listener: (
      functions: AppConnectorFunction[] | null,
      fetchedAt: string | null
    ) => void
  ): () => void;
}
```

Implementation rules inside `app-connector.ts`:

1. **Auto-cache on the wire.** Every successful
   `connector.command('getExternalControlFunctions', {})` round-trip
   pipes the normalized response through the function cache and
   broadcasts to listeners. No consumer has to explicitly write to the
   cache — fetching *is* writing.
2. **Auto-invalidate on disconnect.** Whenever
   `setState({ status: 'disconnected', … })` runs (user-initiated
   disconnect, `RaleDisconnected` IPC, `verify()` clearing stale state),
   clear the function cache and broadcast `null`.
3. **`destroy()` clears too.** Existing `destroy()` already removes the
   IPC subscription and resets state. It now also clears the function
   cache and the listener set.

### Consumer migration

- **Inspector** (`function-selector.ts` + `inspector/index.ts`):
  - `function-selector.ts` keeps its private `availableFunctions` mirror
    for synchronous render lookups.
  - `inspector/index.ts` subscribes via
    `connection.connector.onFunctionsChange(funcs => functionSelector.setFunctions(funcs ?? []))`.
  - The previous `onStateChange`-driven fetch is no longer needed —
    `connector.command('getExternalControlFunctions')` runs inside
    `fetchAvailableFunctions`, so when the auto-cache fires from any
    path the Inspector dropdown updates automatically. The state-change
    listener still **kicks off** a fetch when the connector first goes
    connected and we don't have functions yet.
- **Builder** (`builder.ts`, `index.ts`, `executor.ts`):
  - Builder's `raleFunctions` cache becomes a thin mirror sourced from
    `connector.onFunctionsChange`. Existing `setRaleFunctions` /
    `getRaleFunctions` API is preserved (callers that pass functions in
    explicitly — e.g. validation paths that have a list to check
    against — still work) but the canonical write path is the connector.
- **MCP bridge** (`action-scripts/index.ts → pushMcpBridgeState`):
  - Subscribes to `connector.onFunctionsChange`. Whenever the cache
    changes, push `{ appConnector: { status, functions, fetchedAt } }`
    to main. Replaces the ad-hoc pushes scattered through builder /
    fetch helpers.

### Lifecycle

- `disconnectDevice` in `app.ts` looks up the connector via
  `peekAppConnector(panel)` and calls `destroy()` *before* the panel
  DOM is removed. The WeakMap entry is freed for GC; the IPC
  subscription is unhooked deterministically.
- `stopMcpBridge` resets `state.appConnector` to its empty default so a
  bridge restart inside the same process starts from a clean slate.

## Migration plan / file map

```
M apps/roku-dev-studio/renderer/modules/app-connector/app-connector.ts
   (+ functions cache + onFunctionsChange + auto-cache + auto-invalidate)
M apps/roku-dev-studio/renderer/components/inspector/function-selector.ts
   (no rule change — receives via onFunctionsChange in inspector/index.ts)
M apps/roku-dev-studio/renderer/components/inspector/index.ts
   (+ onFunctionsChange subscription that drives setFunctions)
M apps/roku-dev-studio/renderer/components/action-scripts/builder.ts
   (read raleFunctions from connector via subscription)
M apps/roku-dev-studio/renderer/components/action-scripts/index.ts
   (subscribe to connector.onFunctionsChange → pushMcpBridgeState)
M apps/roku-dev-studio/renderer/app.ts
   (disconnectDevice calls connector.destroy())
M apps/roku-dev-studio/main/mcp-bridge.ts
   (stopMcpBridge resets state.appConnector)
```

## Risk / non-goals

- **Not changing Builder UI semantics.** The Builder still treats its
  in-memory `raleFunctions` as authoritative *for the duration of a
  validation pass*; the connector subscription just keeps it fresh.
- **Not redesigning the MCP bridge state model.** The renderer continues
  to push to main; centralization happens *inside* the renderer. The
  main-process bridge state stays renderer-driven, just with one push
  source instead of three.
- **No new public API for renderer-routed MCP tools.** Existing tool
  routes (`/tool`, `/op/<id>`) unchanged.

## Verification-time finding (2026-05-04)

After the initial migration, the user verified by clicking the
Inspector's **Connect** button. The Response panel correctly showed
`Found 5 function(s)` with the full list, **but the dropdown stayed at
"-- Connect to load functions --".**

Root cause: the Inspector's `function-execution.ts::sendCommand`
called `api.raleCommand(connectionId, command, args)` directly — it
never went through `connector.command(...)`, so the auto-cache
interceptor inside the connector never saw the response. The
`onFunctionsChange` listener never fired, the dropdown never
populated. The Response panel got its data from the direct return
value of `sendCommand`, which is why it could render the list while
the connector cache stayed empty.

Fix: route the Inspector's `sendCommand` through the shared connector:

```43:51:apps/roku-dev-studio/renderer/components/inspector/function-execution.ts
  async function sendCommand(
    command: string,
    args: Record<string, unknown>
  ): Promise<{ success?: boolean; data?: unknown; error?: string }> {
    if (!getConnectionId()) {
      return { success: false, error: 'Not connected' };
    }
    const connector = getAppConnector(panel, api);
    return await connector.command(command, args);
  }
```

After the fix, Inspector `Connect` → `fetchAvailableFunctions` →
`sendCommand` → `connector.command('getExternalControlFunctions', {})`
→ auto-cache fires inside the connector → `onFunctionsChange`
broadcasts → dropdown populates. Same path is followed by every other
consumer, so they're all guaranteed to be in sync.

(This is also a textbook example of Lesson §2 below — when a
consumer reaches "below" the central abstraction to call the raw API
directly, the centralization is bypassed for that path. The lesson is
amended at the bottom of this file with this concrete instance.)

## Verification-time finding #2 (2026-05-04, later)

The user's AI agent then hit a *new* failure on the `app_function`
direct tool: `Available functions: (none — channel exposes no
external control functions)` — even though `list_app_connector_functions`
on the same panel returned the channel's five functions.

Root cause: the `app_function` MCP handler (added in this same
session) read the response from `connector.command(...)` directly:

```diff
- const allFns = Array.isArray(fnRes.data?.functions) ? fnRes.data.functions : [];
- const fn = allFns.find((f) => f && f.name === functionName);
```

The wire shape from `getExternalControlFunctions` uses
`functionName`, not `name`. Only `normalizeRaleFunctions` (in
`packages/roku-dev-studio-api/lib/rale-functions-normalize.ts`)
renames the field. The borrow-pattern `/app-connector/functions`
endpoint goes through `fetchAppFunctionsForBuilder`, which calls the
normalizer, so it works. The new direct `app_function` handler
skipped normalization and looked up by `f.name` against raw `f.functionName`
records — every channel "looked empty" forever.

Fix: drain through `connector.getFunctions()`, which contains the
normalized list (auto-cached by `maybeCacheFunctionsFromResult`):

```diff
+ // Round-trip the command for freshness; the connector's
+ // `maybeCacheFunctionsFromResult` writes the *normalized* shape
+ // into `getFunctions()`. Reading raw `fnRes.data.functions` would
+ // miss this normalization (wire uses `functionName`, not `name`).
  await connector.command('getExternalControlFunctions', {});
+ const allFns = connector.getFunctions() || [];
+ const fn = allFns.find((f) => f && f.name === functionName);
```

Same wire-vs-in-memory bug existed in two more callers that don't have
an AppConnector in scope:
* `apps/roku-dev-studio/renderer/components/action-scripts/executor-engine.ts`
  (Builder/Executor named-object → positional normalization)
* `packages/roku-dev-studio-api/lib/script-runner.ts`
  (headless CLI / remote-relay named-object → positional)

For both, the fix is to wrap the raw response in
`normalizeRaleFunctions(...)` before the `find` — the renderer
imports it from `apps/roku-dev-studio/renderer/modules/utils/rale-functions.ts`
(preload-bridged), the api package imports it from
`./rale-functions-normalize` directly.

This generalizes to a new principle (`engineering-principles.md` §20):
**normalize at the boundary; never read the raw wire shape
downstream.** The corollary in this codebase: every consumer that
wants a function list either calls `connector.getFunctions()` or
calls the normalizer explicitly. Reaching `fnRes.data.functions`
directly should fail review. Anti-pattern #13 in the same doc
captures the lesson.

## Final layout

```
A apps/roku-dev-studio/renderer/modules/app-connector/app-connector.ts
  (+ AppConnectorFunction type
   + functions / functionsFetchedAt cache
   + maybeCacheFunctionsFromResult(cmd, result) inside command()
   + getFunctions / getFunctionsFetchedAt / onFunctionsChange exports
   + auto-invalidate inside setState() on disconnected/idle
   + destroy() clears function listeners + cache)
M apps/roku-dev-studio/renderer/modules/app-connector/index.ts
  (re-export AppConnectorFunction)
M apps/roku-dev-studio/renderer/components/inspector/index.ts
  (subscribe to connector.onFunctionsChange — single source of truth for
   the dropdown; the previous bespoke onStateChange-driven fetch
   collapses into "kick off a fetch the first time we see connected
   without a cached list")
M apps/roku-dev-studio/renderer/components/action-scripts/index.ts
  (subscribe to connector.onFunctionsChange — fans out to
   builderApi.setRaleFunctions and pushMcpBridgeState; functionsHandler
   reads from cache instead of re-collecting; explicit per-fetch pushes
   replaced with one recomputeBridgeAppConnectorState() that reads
   the canonical state)
M apps/roku-dev-studio/renderer/app.ts
  (peekAppConnector + connector.destroy() inside disconnectDevice
   before panel.remove())
M apps/roku-dev-studio/main/mcp-bridge.ts
  (stopMcpBridge resets state.{selectedDevice,connectedDevices,
   knownDevices,connectedDevicesObservedAt,appConnector})
```

## Verification

| Gate                                              | Result |
| ---                                               | ---    |
| `npm run typecheck:renderer -w roku-dev-studio`   | clean  |
| `npm run typecheck:electron -w roku-dev-studio`   | clean  |
| `npm run typecheck -w roku-dev-studio-api`        | clean  |
| `npm run typecheck -w roku-dev-studio-mcp`        | clean  |
| `npm test -w roku-dev-studio-api` (validator)      | 51/51  |
| `POST /builder/drop-script` with bad `functionParams` | rejected with the canonical validator error string (proves the bridge state stays correct after the renderer-side refactor) |
| `ecp_query`, `telnet_connect`/`telnet_disconnect`  | sanity flows unchanged |
| Studio rebuild + restart                           | clean  |

## Lessons learned

These are general patterns worth carrying into other refactors of the
Roku Dev Studio renderer / Electron architecture, with code references
so future readers can ground themselves quickly.

### 1. Per-panel singletons + `WeakMap` are great until cleanup

The `app-connector-registry` keys on the panel `DocumentNode` and stores
the connector via a `WeakMap`:

```18:18:apps/roku-dev-studio/renderer/modules/app-connector/app-connector-registry.ts
const registry = new WeakMap<DevicePanelRoot, AppConnector>();
```

This is elegant for *creation*: any module that hands the same panel
gets the same connector — Inspector, Builder, Executor, MCP-routed
tools all converge on one instance per device. It's a clean way to
share state without introducing a global registry.

The trap: `WeakMap` only frees the connector when the panel becomes
unreachable. The connector itself owns:

```179:187:apps/roku-dev-studio/renderer/modules/app-connector/app-connector.ts
  const disconnectUnsub = subscribeDisconnect((data) => {
    if (!data || !data.connectionId) return;
    if (data.connectionId !== state.connectionId) return;
    setState({
      status: 'disconnected',
      connectionId: null,
      message: 'Connection closed by device'
    });
  });
```

That `subscribeDisconnect(...)` returns an unsubscribe function the
connector calls in `destroy()`. Without an explicit `destroy()` at tab
close, the IPC listener stays registered until **renderer-side GC**
reclaims the closure — which is non-deterministic. Each closed tab
adds one stale listener.

**Lesson:** pair every `WeakMap` registry with an explicit teardown
hook. The owner (here: `disconnectDevice` in `app.ts`) calls
`peekAppConnector(panel)?.destroy()` before removing the DOM. The
WeakMap frees the entry, GC reclaims the closure, and the IPC
subscription is unhooked synchronously.

### 2. State broadcast vs. peer-to-peer pushes

Three independent caches drifted because each consumer **wrote** its
own copy of the function list:

- Inspector: `setFunctions(funcs)` after `fetchAvailableFunctions`
- Builder: `setRaleFunctions(funcs)` after `fetchAppFunctionsForBuilder`
- MCP bridge: `pushMcpBridgeState({ appConnector: { functions } })`
  inside the same `fetchAndSetFunctions` that populated the Builder

Whenever a fourth path (the new `app_function` MCP tool, or the
validator's RALE preflight) fetched functions, *none* of the three
caches updated. The fix wasn't to add a fourth write path; it was to
turn the fetch itself into the write.

**Pattern:** when N consumers care about the same derived state, put
the cache + broadcast on the **producer**, not the consumers. Then any
new producer caller fans out automatically. In this codebase that
means the `AppConnector` intercepts its own `command(name, args)` calls
and stores the result for `name === 'getExternalControlFunctions'`:

```app-connector.ts
function maybeCacheFunctionsFromResult(cmd: string, result: unknown): void {
  if (cmd !== 'getExternalControlFunctions') return;
  // …normalize and broadcast via setFunctions…
}
```

Subscribers (`onFunctionsChange`) receive the new value and the
cleared-on-disconnect signal in one place.

**Corollary — consumers must call through the central abstraction.**
The Inspector's `function-execution.ts::sendCommand` originally called
`api.raleCommand(connectionId, command, args)` directly, *one layer
below* `connector.command(...)`. After the centralization landed, the
Response panel rendered "Found 5 function(s)" correctly (it got the
data from the direct return value), but the dropdown stayed empty —
the connector never saw the response, so the broadcast never fired.
Centralizing the cache only works if **every** path that produces the
data goes through the central method. When you find a sibling that
reaches under the abstraction directly, that's a leak in the
centralization — fix it by re-routing the consumer, not by adding a
fourth cache. (See "Verification-time finding" above for the exact
diff.)

### 3. Multiple listeners on one signal — fire on subscribe

The connector's `onStateChange` and the new `onFunctionsChange` both
fire the listener immediately on subscribe with the current value:

```app-connector.ts
function onFunctionsChange(listener) {
  functionsListeners.add(listener);
  try { listener(functions, functionsFetchedAt); } catch {}
  return () => functionsListeners.delete(listener);
}
```

This collapses a whole class of "subscriber missed the event because
it subscribed too late" bugs into a non-issue. The Inspector tab can
be opened *after* the Executor already connected and the dropdown
still populates on first paint — no ordering games.

**Pattern:** any pub-sub primitive that exposes "current value" should
fire the new listener with that value as part of `subscribe()`, then
again on every change. Subscribers are the same code path on first
mount and on later updates.

### 4. Auto-invalidate on the producer's lifecycle event

The connector clears the function cache **inside** `setState` whenever
status flips to `disconnected` or `idle`:

```app-connector.ts
if (
  (state.status === 'disconnected' || state.status === 'idle') &&
  prevStatus !== state.status
) {
  clearFunctionsCache();
}
```

Subscribers don't have to remember to clear. The cache and the
connection state are updated atomically, so a consumer that reads
`isConnected() === false` and `getFunctions() === null` always sees a
consistent view. Earlier the Builder cache was unrelated to the
connection state; consumers could read "Builder thinks we have
functions" while the connector was disconnected — the exact stale-data
class of bug.

**Pattern:** invariants between two pieces of state should be enforced
**inside the writer** that owns one of them, not in every reader.

### 5. Renderer state vs. main-process state — never assume implicit cleanup

`stopMcpBridge` (main process) wasn't resetting its renderer-driven
snapshot of `state.appConnector`:

```before
function stopMcpBridge(): void {
  // closed server, removed descriptor, rejected pending requests
  // …but `state.appConnector` kept its last value
}
```

Today this didn't matter because `before-quit` → `stopMcpBridge` →
process exit drops the whole heap. But if the bridge ever stops/starts
within one process — hot-reload, restart-on-error, a future "reload
MCP" feature — the next start would inherit a stale snapshot.

**Pattern:** any teardown function that's *named* like a teardown
should reset state to its default, not rely on the process dying. The
fix is small (5 lines) and removes a footgun.

### 6. "Builder happy, CLI rejects" was a symptom of the same fragmentation

The earlier `appFunction.functionParams` fragmentation
(`.discussion-docs/unified-action-script-validation.md`) and this
function-list fragmentation share the same root cause: **rules and
caches that lived close to UI code instead of close to the protocol**.
Once the rules moved into `roku-dev-studio-api/lib/validate-action-script`
and the function cache moved into `AppConnector`, both classes of bug
disappeared structurally — not because we fixed every consumer, but
because there's no longer anywhere a fourth consumer can drift.

**Pattern:** when you find yourself adding a fifth call site for the
same fetch / the same check, that's a refactor signal. The right place
for the logic is usually one layer down (closer to the data) and one
subscription point up (further from the consumer's local cache).

### 7. Subscribe-driven UI > poll-driven UI > timer-driven UI

The previous Inspector dropdown fix used `setTimeout(..., 1000)` to
"give the channel a moment to register functions". Looked harmless,
raced the Builder's borrow-disconnect, and silently lost the dropdown
population in ~50% of "executor + inspector both open" cases.

The current code never reaches for a timer. It subscribes to the
connector and reacts to the cache changing — which the connector
populates synchronously inside the response handler for the
`getExternalControlFunctions` command. There's no race because the
data, the broadcast, and the listener are on the same call stack.

**Pattern:** "wait a bit then poll" is almost never the right answer
inside the renderer. There's usually an event you can subscribe to
that's already firing at the right time. If there isn't, that's the
abstraction missing.

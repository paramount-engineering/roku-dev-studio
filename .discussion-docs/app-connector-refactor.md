# App Connector: single-owner connection refactor

## Problem

Before this change, the RALE / App Connector connection was owned by nobody
and everybody:

- `components/inspector/rale-connection.ts` held the "manual" connectionId in
  a closure var and also wrote it into `panel.dataset.raleConnectionId`.
- `components/action-scripts/rale-connection-helper.ts` exposed headless
  helpers (`connectRale`, `verifyRaleConnectionAlive`,
  `ensureRaleConnectionForExecutor`, `fetchRaleFunctionsForBuilder`) that all
  read and wrote the same `panel.dataset.raleConnectionId` string.
- `components/action-scripts/executor.ts`,
  `components/action-scripts/executor-engine.ts`,
  `components/action-scripts/script-rale-validation.ts`, and
  `components/action-scripts/builder.ts` each layered their own
  verify-or-reconnect logic over those helpers.
- `packages/roku-dev-studio-api/lib/action-script-if-eval.ts` took a
  `{ getConnectionId, ensureRaleConnection }` bag and reimplemented the same
  dance again.
- Only one consumer (the inspector) listened for the `RaleDisconnected` IPC
  event, and its matcher compared against its local closure var. Connections
  opened by any other path kept a stale id on the panel forever.

The user-visible symptom was Action Script `appFunction` steps being skipped
with "App Connector not available" after a `launch` / `sideload` step killed
the TrackerTask socket mid-run: the executor kept using the stale id,
`raleCommand` returned `Not connected`, and the step was skipped — even though
hitting Connect manually in the Inspector tab always worked (because that
path replaced the stale id with a fresh one).

## Design

Introduce a single `AppConnector` that owns the connection for a device panel.
Everything that needs to talk to TrackerTask calls it. No `panel.dataset`
string, no per-consumer reconnect helpers, no duplicate disconnect listeners.

### Scope per panel

`renderer/modules/app-connector/`:
- `app-connector.ts` — `createAppConnector(api, opts)` factory + public interface
- `app-connector-registry.ts` — `getAppConnector(panel, api)` / `peekAppConnector(panel)` backed by a `WeakMap<DevicePanelRoot, AppConnector>`
- `index.ts` — barrel

One connector per `.tab-panel`. The registry is keyed by the panel DOM node
via a `WeakMap`, so a panel that is removed from the DOM is eligible for GC
without explicit cleanup.

### Public surface

```ts
interface AppConnector {
  getState(): AppConnectorState;           // { status, connectionId, lastError, message }
  getConnectionId(): string | null;
  isConnected(): boolean;
  onStateChange(listener): () => void;     // unsubscribe fn; fires once on subscribe

  connect(opts?): Promise<{ ok, connectionId?, error?, initData?, devAppNotActive?, devAppQueryFailed? }>;
  disconnect(): Promise<void>;
  ensureConnected(opts?): Promise<string | null>;   // optional liveness check
  command<T>(cmd, args?): Promise<{ success, data?, error? }>; // auto-reconnect once on "Not connected"
  verify(): Promise<boolean>;
  destroy(): void;
}
```

State machine: `idle` → `connecting` → `connected` → `reconnecting` → `connected`
(or `disconnected` with a `lastError`). UI subscribes via `onStateChange`.

### Behavior

1. `connect()` performs: optional Dev-App check → `raleWake(port)` → 2s wait →
   `raleConnect(port)` → `raleCommand(id, 'init', { logVerbosity })`. Init is
   sent eagerly because TrackerTask closes the socket if no activity arrives
   within 3s of accept. Concurrent `connect()` callers await the same in-flight
   promise.
2. `command(cmd, args)` runs `raleCommand`. If the result matches
   `"Not connected"` (returned by `rale-direct` when the socket has closed),
   the connector clears its cached id, runs `ensureConnected()` (which runs
   `connect()`), and retries the command once. The caller sees a single
   result.
3. A single `window.roku.onRaleDisconnected` subscription per connector
   clears local state when the device closes the socket, regardless of which
   code path opened it.

### Consumer updates

| File | Before | After |
|---|---|---|
| `inspector/rale-connection.ts` | Owns id + dataset + init + listener | Subscribes to `connector.onStateChange` and drives UI; Connect button calls `connector.connect({ checkDevApp: true })`; Disconnect calls `connector.disconnect()` |
| `action-scripts/rale-connection-helper.ts` | 4 helpers touching dataset | **Transitional shim** over connector; deleted after verification |
| `action-scripts/script-rale-validation.ts` | Manual verify/connect | `connector.ensureConnected()` + `connector.command('getExternalControlFunctions')` |
| `action-scripts/executor.ts` | `ensureRaleConnectionForRun`, `executorOwnsRaleConnection` | Passes `connector` into `runScript` |
| `action-scripts/executor-engine.ts` | `getConnectionId` + `ensureRaleConnection` callbacks, `raleCommandWithReconnect` helper | Calls `connector.command()` directly; reconnect is the connector's job |
| `action-scripts/builder.ts` | `fetchRaleFunctionsForBuilder` opens/closes its own conn | `connector.command('getExternalControlFunctions')` |
| `roku-dev-studio-api/lib/action-script-if-eval.ts` | `{ getConnectionId, ensureRaleConnection }` bag | Accepts a `raleCommand: (cmd, args) => Promise<Result>` fn (connector-agnostic) |
| `roku-dev-studio-api/lib/script-runner.ts` | Provides the bag | Provides a bound `raleCommand` fn |

### Why the if-eval signature change

`action-script-if-eval.ts` ships in the API package and is also used by the
relay-server's `script-runner.ts`. Neither has access to renderer `window.roku`
or the DOM panel. Instead of leaking connector details there, we change its
contract to take a `raleCommand(cmd, args)` function. The renderer passes
`connector.command.bind(connector)`; `script-runner.ts` keeps passing its
existing direct-ECP function. Both sides opt in to the same reconnect behavior
by using a function that already handles it.

### Migration ordering

1. Ship the module + registry.
2. Migrate `rale-connection.ts` to drive UI from `onStateChange`.
3. Migrate `executor.ts` / `executor-engine.ts` (this is the path behind the
   "skipped (App Connector not available)" bug).
4. Migrate `script-rale-validation.ts` and `builder.ts`.
5. Change `action-script-if-eval.ts` to take a `raleCommand` function; update
   `script-runner.ts` and the renderer caller.
6. Shim `rale-connection-helper.ts` over the connector while callers move;
   delete after a manual verification pass.
7. Remove all remaining `panel.dataset.raleConnectionId` references.

### Notes

- The `raleCommandWithReconnect` helper added to `executor-engine.ts` in the
  first fix pass becomes unnecessary once the engine goes through
  `connector.command`. It is removed in step 3.
- `DEFAULT_RALE_PORT` is still read from `.rale-port-input` lazily, so
  changing the port in the inspector UI continues to take effect on the next
  connect.

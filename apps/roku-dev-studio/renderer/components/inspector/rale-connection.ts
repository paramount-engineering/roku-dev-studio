// RALE connection UI — delegates to the per-panel AppConnector for state.
//
// This module is responsible only for the Inspector tab's Connect/Disconnect
// buttons and the status line. All connection lifecycle (connect, disconnect,
// auto-reconnect, the `RaleDisconnected` IPC listener) lives in the shared
// `modules/app-connector`, which is also used by Action Script Builder /
// Executor / Validator / if-eval so every consumer observes the same state.

import { icon } from '../../modules/utils/index.js';
import { DEFAULT_RALE_PORT } from '../../modules/utils/constants.js';
import { ConnectionStatus } from '../../modules/ui/connection-status.js';
import { getAppConnector, type AppConnector } from '../../modules/app-connector/index.js';
import type {
  DevicePanelRoot,
  DisplayResponseFn,
  InspectorApi,
  RaleConnectionElements
} from './inspector-types.js';

/**
 * Setup RALE connection handlers.
 */
export function setupRaleConnection(
  panel: DevicePanelRoot,
  api: InspectorApi,
  elements: RaleConnectionElements,
  updateConnectionUI: (connected: boolean) => void,
  displayResponseFn: DisplayResponseFn
) {
  const { portInput, logVerbositySelect, connectBtn, disconnectBtn, connectionStatus } = elements;

  const connector: AppConnector = getAppConnector(panel, api);
  const statusDisplay = new ConnectionStatus(connectionStatus);

  // Tracks whether the user explicitly clicked the Inspector's Connect button
  // (and hasn't been disconnected since). All Inspector UI reactions to
  // connector state changes are gated on this flag because the per-panel
  // AppConnector is *shared* with the Action Script Builder's borrow-pattern
  // fetch (`fetchAppFunctionsForBuilder`), which programmatically connects →
  // fetches `getExternalControlFunctions` → disconnects to populate the
  // function-list cache. Without this gate, those transient state changes
  // would briefly flash the Inspector to "Connected" / "Disconnected" and
  // (worse) trigger the auto-fetch listener to write the channel's function
  // list into the Response panel before the user has done anything.
  //
  // The cache is still populated as a side effect of the borrow — that's the
  // whole point of the borrow — and `updateConnectionUI(true)` will restore
  // the dropdown from cache once the user actually does click Connect.
  let userInitiatedConnect = false;

  connector.onStateChange((state) => {
    if (!userInitiatedConnect) return;

    switch (state.status) {
      case 'connecting':
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        statusDisplay.setCustom('🟡 Connecting...', 'connecting');
        break;
      case 'reconnecting':
        statusDisplay.setCustom('🟡 Reconnecting...', 'connecting');
        break;
      case 'connected':
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
        updateConnectionUI(true);
        break;
      case 'disconnected':
      case 'idle':
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
        updateConnectionUI(false);
        if (state.status === 'disconnected' && state.lastError) {
          statusDisplay.setError('Disconnected');
        }
        if (state.status === 'disconnected' && state.message === 'Connection closed by device') {
          displayResponseFn({ status: 'Connection closed by device' });
        }
        // After we've reflected the disconnect, drop the flag — a subsequent
        // borrow won't re-flip the UI, and a subsequent user-initiated
        // Connect will set the flag again before the next setState fires.
        userInitiatedConnect = false;
        break;
    }
  });

  async function connect(): Promise<{
    connectionId: string | null;
    initResult: Record<string, unknown>;
  } | null> {
    // Mark this connect as user-initiated *before* any setState fires inside
    // `connector.connect()`, so the gated state-change listener above flips
    // the Inspector UI to "Connecting…" / "Connected" for this session.
    userInitiatedConnect = true;

    // Dev-App preflight is kept in the Inspector UX because the error message
    // here is more actionable than a generic connect failure. The connector
    // itself offers the same check for headless callers via `checkDevApp`.
    displayResponseFn({ status: 'Checking if Dev App is active...' });
    try {
      const res = await api.query('/query/active-app');
      const queryOk = res.success && typeof res.data === 'string';
      const devAppActive = queryOk && res.data!.includes('id="dev"');
      if (!queryOk) {
        displayResponseFn(
          {
            error:
              'Could not verify Dev App status. The active-app query failed (network / ECP / developer mode?).',
            hint: 'Check the device connection and developer mode, then try Connect again.'
          },
          true
        );
        statusDisplay.setError('Status Check Failed');
        userInitiatedConnect = false;
        return null;
      }
      if (!devAppActive) {
        displayResponseFn(
          {
            error: 'Dev App is not running on the Roku device. Please launch the Sideloaded Dev App first.',
            hint: 'Go to the Dev App tab and click "Launch" to start your sideloaded channel.'
          },
          true
        );
        statusDisplay.setError('Dev App Not Active');
        userInitiatedConnect = false;
        return null;
      }
    } catch (_) {
      displayResponseFn(
        {
          error: 'Could not verify Dev App status.',
          hint: 'Check the device connection and developer mode, then try Connect again.'
        },
        true
      );
      statusDisplay.setError('Status Check Failed');
      userInitiatedConnect = false;
      return null;
    }

    const port = parseInt(portInput.value, 10) || DEFAULT_RALE_PORT;
    displayResponseFn({ status: 'Waking up TrackerTask on port ' + port + '...' });
    const rawLevel = logVerbositySelect ? parseInt(logVerbositySelect.value, 10) : 0;
    const logVerbosity = Number.isFinite(rawLevel) && rawLevel >= 0 && rawLevel <= 4 ? rawLevel : 0;

    const result = await connector.connect({
      port,
      logVerbosity,
      // Dev-App was already verified above; skip the connector's own check.
      checkDevApp: false,
      onStatus: (msg) => displayResponseFn({ status: msg })
    });

    if (!result.ok || !result.connectionId) {
      displayResponseFn({ error: result.error || 'Failed to connect' }, true);
      // The connector itself fires `setState({ status: 'disconnected' })` on
      // failure, which will reset the flag via the listener — but reset here
      // too, defensively, in case any path returns without that setState.
      userInitiatedConnect = false;
      return null;
    }

    // Defensive UI nudge for the rare "user clicks Connect while the
    // Builder's borrow-fetch is still holding a connection" race: in that
    // case `connector.connect()` returns the existing session via `verify()`
    // without firing a setState, so the gated state-change listener above
    // never runs and the UI would stay at "Disconnected". Calling
    // `updateConnectionUI(true)` here is idempotent if the listener did fire.
    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect';
    updateConnectionUI(true);

    const initData =
      result.initData && typeof result.initData === 'object' && !Array.isArray(result.initData)
        ? (result.initData as Record<string, unknown>)
        : {};
    displayResponseFn({ status: 'Connected!', ...initData });
    return { connectionId: result.connectionId, initResult: initData };
  }

  async function disconnect(): Promise<void> {
    await connector.disconnect();
    displayResponseFn({ status: 'Disconnected' });
  }

  disconnectBtn.addEventListener('click', () => {
    void disconnect();
  });

  return {
    /** @deprecated callers should use the shared AppConnector directly. */
    getConnectionId: () => connector.getConnectionId(),
    /** Kept for compatibility; manually overriding the id is no longer needed. */
    setConnectionId: (_id: string | null) => {
      // Intentional no-op — the connector owns the id.
    },
    connect,
    disconnect,
    connectBtn,
    /** Expose the shared connector for callers that need to send commands. */
    connector,
    /**
     * `true` while the user has an active session they explicitly opened via
     * the Inspector's Connect button. Use this to gate Inspector-side
     * reactions that should ignore the Builder's borrow-pattern transient
     * connects (which use the same connector instance).
     */
    isUserInitiated: () => userInitiatedConnect
  };
}

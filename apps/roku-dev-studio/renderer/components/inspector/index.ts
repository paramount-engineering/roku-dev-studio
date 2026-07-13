// Inspector component - Main setup function (App Connector / RALE)

import type { DevicePanelRoot } from '../../types/device-panel-dom.js';
import { setupIntegrationGuide } from './integration-guide.js';
import { setupRaleConnection } from './rale-connection.js';
import { setupFunctionSelector } from './function-selector.js';
import { setupFunctionExecution } from './function-execution.js';
import { renderParamInputs } from './parameter-inputs.js';
import { RALE_BUILTIN_COMMANDS, isRaleBuiltinSelection } from './rale-builtins.js';
import { displayResponse } from './response-display.js';
import { setupCopyButton } from '../../modules/ui/copy-button.js';
import { createFindBar, buildFindBarElement, bindFindShortcut } from '../../modules/ui/find-bar.js';
import { makeCenteredSearchResizable } from '../../modules/ui/header-search-resize.js';
import { searchWidthKey } from '../../modules/ui/search-storage-keys.js';
import { attachFoldToggle, structuredBodyText, structuredFileExtension } from '../../modules/ui/structured-body.js';
import { attachSelectAll } from '../../modules/ui/select-all.js';
import { icon, setSafeHTML, DEFAULT_RALE_PORT } from '../../modules/utils/index.js';
import { errMessage } from '@shared/platform/err-util.js';
import { rendererError } from '../../modules/utils/logger.js';
import { setupNodeUpdatePanel } from './node-update-panel.js';
import { formatRaleCommandResponse } from './node-lookup.js';
import {
  buildNodeUpdateContextFromResponse,
  getResponseCommand,
  hideNodeUpdateChrome,
  isStatusOnlyPayload,
  isValidGetNodeByIdResponseForNodeUpdate,
  modalShouldForwardToMainResponse,
  shouldResetNodeUpdateInspector,
  stripFieldlistMetaForDisplay,
  type NodeUpdateContext
} from './inspector-node-update-helpers.js';
import type {
  ExternalControlFunctionMeta,
  GetNodeByIdSearchArgs,
  InspectorApi,
  InspectorDevice
} from './inspector-types.js';

/**
 * Setup inspector component (App Connector / RALE)
 */
export function setupInspector(panel: DevicePanelRoot, _device: InspectorDevice, api: InspectorApi) {
  const portQ = panel.querySelector('.rale-port-input');
  const logVerbositySelect = panel.querySelector('.rale-log-verbosity-select');
  const connectQ = panel.querySelector('.rale-connect-btn');
  const disconnectQ = panel.querySelector('.rale-disconnect-btn');
  const connectionStatusQ = panel.querySelector('.rale-connection-status');
  const refreshFuncsQ = panel.querySelector('.rale-refresh-funcs-btn');
  const funcSelectQ = panel.querySelector('.rale-func-select');
  const funcNameInputQ = panel.querySelector('.rale-func-name-input');
  const executeQ = panel.querySelector('.rale-execute-btn');
  const responseOutputQ = panel.querySelector('.rale-response-output');
  const copyBtn = panel.querySelector('.rale-copy-btn');
  const saveBtn = panel.querySelector('.rale-save-btn');
  const clearQ = panel.querySelector('.rale-clear-btn');
  const funcParamHint = panel.querySelector('.func-param-hint');
  const paramsContainerQ = panel.querySelector('.rale-params-container');

  if (
    !(portQ instanceof HTMLInputElement) ||
    !(connectQ instanceof HTMLButtonElement) ||
    !(responseOutputQ instanceof HTMLElement) ||
    !(disconnectQ instanceof HTMLButtonElement) ||
    !(connectionStatusQ instanceof HTMLElement) ||
    !(refreshFuncsQ instanceof HTMLButtonElement) ||
    !(funcSelectQ instanceof HTMLSelectElement) ||
    !(funcNameInputQ instanceof HTMLInputElement) ||
    !(executeQ instanceof HTMLButtonElement) ||
    !(paramsContainerQ instanceof HTMLElement) ||
    !(clearQ instanceof HTMLButtonElement)
  ) {
    rendererError('Inspector elements not found');
    return;
  }

  const portInput = portQ;
  const connectBtn = connectQ;
  const disconnectBtn = disconnectQ;
  const connectionStatus = connectionStatusQ;
  const refreshFuncsBtn = refreshFuncsQ;
  const funcSelect = funcSelectQ;
  const funcNameInput = funcNameInputQ;
  const executeBtn = executeQ;
  const responseOutput = responseOutputQ;
  const paramsContainer = paramsContainerQ;
  const clearBtn = clearQ;

  const copyBtnEl = copyBtn instanceof HTMLElement ? copyBtn : null;
  const saveBtnEl = saveBtn instanceof HTMLElement ? saveBtn : null;

  // Shared simple find bar, hosted inline in the Response card header to save vertical space. Shown
  // only while a response is present.
  const responseFindBarEl = buildFindBarElement('Find in Response');
  responseFindBarEl.classList.add('find-bar-header');
  const responseCardHeader = responseOutput.closest('.card')?.querySelector(':scope > .card-header');
  if (responseCardHeader instanceof HTMLElement) {
    responseCardHeader.appendChild(responseFindBarEl);
  } else {
    responseOutput.insertAdjacentElement('beforebegin', responseFindBarEl);
  }
  const responseFindBar = createFindBar({
    bodyEl: responseOutput,
    barEl: responseFindBarEl,
    highlightId: 'rale-find',
    historyScope: api.ip || 'unknown'
  });
  if (responseFindBar) {
    // Bind Ctrl/Cmd+F within the App Connector tab so the shortcut works anywhere in the pane,
    // not only when focus is inside the response box.
    const inspectorTab = panel.querySelector('[data-inner-content="inspector"]');
    bindFindShortcut(inspectorTab instanceof HTMLElement ? inspectorTab : responseOutput, responseFindBar);
  }
  // Centered, drag-to-resize behavior for the Response search box.
  makeCenteredSearchResizable(responseFindBarEl, {
    storageKey: searchWidthKey('inspector', api.ip || 'unknown'),
    leftGroupSelector: '.card-header-actions',
    minWidthPx: 220
  });

  // Collapsible JSON/XML nodes in the response (delegated twisty handler survives re-renders).
  attachFoldToggle(responseOutput);

  // Cmd/Ctrl+A selects all the response text (when the output is focused) instead of the page.
  attachSelectAll(responseOutput);

  portInput.value = String(DEFAULT_RALE_PORT);

  setupIntegrationGuide(panel);

  let nodeUpdateInspectorState: {
    context: NodeUpdateContext | null;
    searchArgs: GetNodeByIdSearchArgs | null;
  } = { context: null, searchArgs: null };

  let hideNodeUpdateUi: (() => void) | null = null;

  function resetNodeUpdateInspectorState() {
    nodeUpdateInspectorState.context = null;
    nodeUpdateInspectorState.searchArgs = null;
  }

  function setNodeUpdateContext(ctx: NodeUpdateContext | null) {
    nodeUpdateInspectorState.context = ctx;
    if (ctx == null) nodeUpdateInspectorState.searchArgs = null;
  }

  const displayResponseCore = (data: unknown, isError?: boolean) => {
    displayResponse(responseOutput, copyBtnEl, data, isError);
    if (saveBtnEl) saveBtnEl.style.display = 'inline-flex';
    clearBtn.style.display = 'inline-flex';
    responseFindBar?.setVisible(true);
    responseFindBar?.refresh();
  };

  const displayResponseFn = (data: unknown, isError = false) => {
    if (isStatusOnlyPayload(data)) {
      displayResponseCore(data, isError);
      return;
    }

    const cmd = getResponseCommand(data);
    const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;

    if (!isError && payload?.command === 'getNodeById' && payload.response) {
      if (isValidGetNodeByIdResponseForNodeUpdate(payload.response)) {
        nodeUpdateInspectorState.context = buildNodeUpdateContextFromResponse(
          payload.response as Record<string, unknown>
        );
        const updateBtn = panel.querySelector('.rale-update-node-btn');
        if (updateBtn instanceof HTMLElement) updateBtn.style.display = 'inline-flex';
      } else {
        resetNodeUpdateInspectorState();
        hideNodeUpdateChrome(panel);
      }
    } else if (shouldResetNodeUpdateInspector(cmd, isError)) {
      resetNodeUpdateInspectorState();
      hideNodeUpdateChrome(panel);
    }

    displayResponseCore(stripFieldlistMetaForDisplay(data), isError);
  };

  const displayResponseFromNodeUpdateModal = (data: unknown, isError = false) => {
    if (isError) {
      displayResponseFn(data, true);
      return;
    }
    const cmd = getResponseCommand(data);
    if (!modalShouldForwardToMainResponse(cmd, data)) {
      return;
    }
    displayResponseFn(data, isError);
  };

  setupCopyButton(copyBtnEl, () => structuredBodyText(responseOutput), {
    successText: '✓ Copied!',
    duration: 2000
  });

  saveBtnEl?.addEventListener('click', () => {
    const content = structuredBodyText(responseOutput);
    if (!content) return;
    void window.roku?.saveTextFile?.({
      content,
      defaultName: `app-connector-response-${Date.now()}.${structuredFileExtension(content)}`,
      dialogTitle: 'Save Response'
    });
  });

  const connection = setupRaleConnection(
    panel,
    api,
    {
      portInput,
      logVerbositySelect: logVerbositySelect instanceof HTMLSelectElement ? logVerbositySelect : null,
      connectBtn,
      disconnectBtn,
      connectionStatus
    },
    updateConnectionUI,
    displayResponseFn
  );

  // Single "send a RALE command" closure used by every Inspector sub-surface.
  // Routes through `connection.connector.command` (and therefore through
  // `AppConnector.command`) so stale-socket recovery and the
  // `getExternalControlFunctions` auto-cache apply uniformly — no sub-panel
  // reaches for `api.raleCommand` directly. See `engineering-principles.md`
  // §2 and Anti-pattern #1.
  const sendCommand = async (command: string, args?: unknown) => {
    if (!connection.getConnectionId()) {
      return { success: false, error: 'Not connected' };
    }
    return await connection.connector.command(command, args ?? {});
  };

  async function refreshGetNodeByIdAfterModalClose() {
    if (!nodeUpdateInspectorState.searchArgs) return;
    if (!connection.getConnectionId()) return;
    displayResponseFn({ status: 'Refreshing getNodeById…', args: nodeUpdateInspectorState.searchArgs });
    const result = await sendCommand('getNodeById', nodeUpdateInspectorState.searchArgs);
    formatRaleCommandResponse(result, 'getNodeById', displayResponseFn);
  }

  const nodeUpdateApi = setupNodeUpdatePanel(panel, {
    getConnectionId: () => connection.getConnectionId(),
    sendCommand,
    displayResponseFn: displayResponseFromNodeUpdateModal,
    getLastGetNodeContext: () => nodeUpdateInspectorState.context,
    setLastGetNodeContext: setNodeUpdateContext,
    onModalCloseRefreshGetNodeById: refreshGetNodeByIdAfterModalClose
  });
  hideNodeUpdateUi = nodeUpdateApi?.hideUpdateUi ?? null;

  clearBtn.addEventListener('click', () => {
    responseOutput.innerHTML = '';
    if (copyBtnEl) copyBtnEl.style.display = 'none';
    if (saveBtnEl) saveBtnEl.style.display = 'none';
    clearBtn.style.display = 'none';
    hideNodeUpdateUi?.();
    responseFindBar?.setVisible(false);
  });

  const renderParamInputsFn = (params: unknown[], opts: Record<string, unknown> = {}) => {
    renderParamInputs(paramsContainer, params, funcSelect, {
      getConnectionId: () => connection.getConnectionId(),
      sendCommand,
      ...opts
    });
  };

  const functionSelector = setupFunctionSelector(
    panel,
    {
      funcSelect,
      funcNameInput,
      funcParamHint: funcParamHint instanceof HTMLElement ? funcParamHint : null
    },
    renderParamInputsFn
  );

  function updateConnectionUI(connected: boolean) {
    if (connected) {
      setSafeHTML(connectionStatus, icon('circle', 'icon-xs', 'icon-green') + ' Connected');
      connectionStatus.className = 'rale-connection-status connected';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'flex';
      portInput.disabled = true;
      if (logVerbositySelect instanceof HTMLSelectElement) logVerbositySelect.disabled = true;

      // Restore the dropdown from the connector cache for instant feedback.
      // The cache may already have functions even on the user's "first" Connect
      // — `setupActionScripts` runs `fetchAppFunctionsForBuilder` (the
      // borrow-pattern fetch) automatically during panel setup, which populates
      // the cache before the user ever clicks Connect. Without this, the
      // dropdown sits empty while the auto-fetch round-trips again.
      const cached = connection.connector.getFunctions();
      if (cached != null) {
        functionSelector.setFunctions(cached as ExternalControlFunctionMeta[]);
      }
    } else {
      setSafeHTML(connectionStatus, icon('circle', 'icon-xs', 'icon-muted') + ' Disconnected');
      connectionStatus.className = 'rale-connection-status disconnected';
      connectBtn.style.display = 'flex';
      connectBtn.textContent = 'Connect';
      connectBtn.disabled = false;
      disconnectBtn.style.display = 'none';
      portInput.disabled = false;
      if (logVerbositySelect instanceof HTMLSelectElement) logVerbositySelect.disabled = false;
      functionSelector.clearFunctions();
    }

    refreshFuncsBtn.disabled = !connected;
    funcSelect.disabled = !connected;
    executeBtn.disabled = !connected;

    if (!connected) {
      renderParamInputs(paramsContainer, [], funcSelect);
      hideNodeUpdateUi?.();
    }
  }

  const { fetchAvailableFunctions } = setupFunctionExecution(
    panel,
    api,
    {
      funcNameInput,
      paramsContainer,
      executeBtn
    },
    () => connection.getConnectionId(),
    displayResponseFn,
    {
      refreshRegistryParams: () => {
        const sel = funcSelect.value;
        if (!isRaleBuiltinSelection(sel)) return;
        const builtin = RALE_BUILTIN_COMMANDS[sel as keyof typeof RALE_BUILTIN_COMMANDS];
        const registryUi = (builtin as { registryUi?: string }).registryUi;
        if (!registryUi) return;
        renderParamInputsFn(builtin.params || [], { builtin: { ...builtin, registryUi } });
      },
      onGetNodeByIdSuccess: (args: GetNodeByIdSearchArgs) => {
        nodeUpdateInspectorState.searchArgs = args;
      }
    }
  );

  refreshFuncsBtn.addEventListener('click', async () => {
    // The connector's auto-cache (inside `command()`) handles the
    // dropdown update via `onFunctionsChange`; we only invoke the fetch
    // here. Errors are surfaced by `fetchAvailableFunctions` itself.
    await fetchAvailableFunctions(() => {
      // Intentionally empty — the connector subscription writes to the
      // dropdown. Kept as a callback for back-compat with
      // `fetchAvailableFunctions`'s legacy signature.
    });
  });

  // Single source of truth for the function list lives on the connector
  // itself (`AppConnector.onFunctionsChange`). Every path that calls
  // `connector.command('getExternalControlFunctions', {})` writes through
  // that cache automatically:
  //
  //   • Inspector's `fetchAvailableFunctions` (Refresh button or
  //     auto-fetch on user-initiated connect)
  //   • Action Script Builder's borrow-pattern `fetchAppFunctionsForBuilder`
  //   • Action Script Executor's `script-rale-validation.ts` preflight
  //   • Validators that fetch through the connector
  //   • MCP renderer tools (`rale_command`, `app_function`, ...)
  //
  // The cache is deliberately **not** cleared on `disconnected` / `idle` —
  // it persists across borrow-disconnect cycles (see `app-connector.ts::setState`
  // note). The "show empty when disconnected" Inspector-only UX is owned by
  // `updateConnectionUI(false) → functionSelector.clearFunctions()`, not by the
  // cache.
  //
  // Gate on `isUserInitiated()` because the Builder's borrow-fetch populates
  // the cache (which fires `onFunctionsChange`) before the user has clicked
  // Connect — without the gate, the dropdown would show the channel's
  // function list on first load even though the Inspector should look idle.
  // After the user clicks Connect, `updateConnectionUI(true)` restores the
  // dropdown from the same cache for instant feedback.
  connection.connector.onFunctionsChange((funcs) => {
    if (!connection.isUserInitiated()) return;
    if (funcs == null) {
      functionSelector.clearFunctions();
      return;
    }
    functionSelector.setFunctions(funcs as ExternalControlFunctionMeta[]);
  });

  // Always re-fetch the function list when the connector flips to
  // `connected` *as part of a user-initiated session*. The
  // `isUserInitiated()` guard is what keeps this listener silent during the
  // Builder's borrow-fetch — without it, the borrow's transient connect
  // would write "Fetching available functions…" → "Found N function(s)"
  // into the Response panel before the user has touched anything.
  //
  // We deliberately do *not* skip when `getFunctions()` is already non-null:
  // the cache survives borrow-fetches and prior connect cycles, so trusting
  // it would mean the dropdown stays at the "-- Connect to load functions --"
  // placeholder forever (the `onFunctionsChange` listener doesn't re-fire
  // when the cache value is unchanged, and `clearFunctions()` runs on every
  // disconnect to wipe the Inspector's local view). Instant feedback comes
  // from `updateConnectionUI(true)` restoring the dropdown from cache; this
  // round-trip then refreshes it with current data.
  let isFetchingFunctions = false;
  connection.connector.onStateChange((state) => {
    if (state.status !== 'connected') return;
    if (!connection.isUserInitiated()) return;
    if (isFetchingFunctions) return;

    isFetchingFunctions = true;
    void (async () => {
      try {
        await fetchAvailableFunctions(() => {
          // No-op — the connector subscription updates the dropdown.
        });
      } catch (error: unknown) {
        rendererError('Auto-fetch functions error:', error);
        // Stay quiet on errors that look like a borrow-disconnect race
        // (the Builder's `fetchAppFunctionsForBuilder` connects, fetches,
        // then immediately disconnects). On the next reconnect the
        // dropdown will populate cleanly.
        if (connection.connector.isConnected()) {
          displayResponseFn(
            {
              error: 'Failed to auto-fetch functions. Click Refresh to try again.',
              details: errMessage(error)
            },
            true
          );
        }
      } finally {
        isFetchingFunctions = false;
      }
    })();
  });

  connection.connectBtn.addEventListener('click', () => {
    void connection.connect();
  });

  updateConnectionUI(false);
}

// Function execution logic

import { normalizeRaleFunctions } from '../../modules/utils/rale-functions.js';
import { getParamValues } from './parameter-inputs.js';
import { RALE_BUILTIN_COMMANDS, isRaleBuiltinSelection } from './rale-builtins.js';
import { formatRaleCommandResponse } from './node-lookup.js';
import { validateRaleBuiltinWireArgsForInspector } from './registry-validation.js';
import { buildRaleArgsFromParamValues } from '../action-scripts/rale-command-param-ui.js';
import { validateAndNormalizeRaleCommandArgs } from '../action-scripts/rale-command-validator.js';
import { getAppConnector } from '../../modules/app-connector/index.js';
import type {
  DevicePanelRoot,
  DisplayResponseFn,
  FunctionExecutionElements,
  FunctionExecutionHooks,
  InspectorApi
} from './inspector-types.js';

/**
 * Setup function execution
 */
export function setupFunctionExecution(
  panel: DevicePanelRoot,
  api: InspectorApi,
  elements: FunctionExecutionElements,
  getConnectionId: () => string | null | undefined,
  displayResponseFn: DisplayResponseFn,
  hooks: FunctionExecutionHooks = {}
) {
  const { refreshRegistryParams, onGetNodeByIdSuccess } = hooks;
  const { funcNameInput, paramsContainer, executeBtn } = elements;

  function ralePayloadOk(result: unknown): boolean {
    if (!result || typeof result !== 'object') return false;
    const r = result as { success?: boolean; data?: Record<string, unknown> };
    if (!r.success || !r.data || typeof r.data !== 'object') return false;
    const err = r.data.error as { message?: unknown } | undefined;
    return !(err && err.message);
  }

  /**
   * After any successful registry mutation, show full registry and refresh dropdown UIs.
   */
  async function showRegistrySnapshotAfterMutation() {
    const snap = await sendCommand('getRegistrySections', {});
    formatRaleCommandResponse(snap, 'getRegistrySections', displayResponseFn);
    refreshRegistryParams?.();
  }

  // Send command to device through the shared per-panel `AppConnector`.
  // Going via `connector.command(...)` (rather than `api.raleCommand(...)`
  // directly) is what lets the connector intercept successful
  // `getExternalControlFunctions` responses, populate its function-list
  // cache, and broadcast to every subscriber (Inspector dropdown, Builder
  // type-ahead, MCP bridge state). Sticking with the direct call would
  // leave the dropdown empty even when the response shows up in the
  // Response panel — exactly the bug we just fixed.
  //
  // Bonus: `connector.command()` handles auto-reconnect on a stale
  // socket, which the per-call `getConnectionId()` path used to miss.
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

  async function executeRaleBuiltin(selectionKey: string, functionParams: unknown[]) {
    const def = RALE_BUILTIN_COMMANDS[selectionKey as keyof typeof RALE_BUILTIN_COMMANDS];
    if (!def) {
      displayResponseFn({ error: 'Unknown RALE builtin' }, true);
      return;
    }
    const cmd = def.command;
    const raw = buildRaleArgsFromParamValues(cmd, functionParams);
    const vr = validateAndNormalizeRaleCommandArgs(cmd, raw);
    if (!vr.ok) {
      displayResponseFn({ error: vr.error }, true);
      return;
    }
    const args = vr.args as Record<string, unknown>;

    const pickErr = validateRaleBuiltinWireArgsForInspector(cmd, args);
    if (pickErr) {
      displayResponseFn({ error: pickErr }, true);
      return;
    }

    if (cmd === 'getNodeById') {
      displayResponseFn({ status: 'Sending getNodeById...', args });
      const result = await sendCommand('getNodeById', args);
      if (ralePayloadOk(result)) {
        onGetNodeByIdSuccess?.(args as { path: unknown[]; id: string });
      }
      formatRaleCommandResponse(result, 'getNodeById', displayResponseFn);
      return;
    }

    if (cmd === 'getNodeByName') {
      displayResponseFn({ status: 'Sending getNodeByName...', args });
      const result = await sendCommand('getNodeByName', args);
      formatRaleCommandResponse(result, 'getNodeByName', displayResponseFn);
      return;
    }

    if (cmd === 'getRegistrySections') {
      displayResponseFn({ status: 'Sending getRegistrySections...', args: {} });
      const result = await sendCommand('getRegistrySections', args);
      formatRaleCommandResponse(result, 'getRegistrySections', displayResponseFn);
      return;
    }

    if (cmd === 'clearRegistry') {
      displayResponseFn({ status: 'Sending clearRegistry...', args: {} });
      const result = await sendCommand('clearRegistry', args);
      if (!ralePayloadOk(result)) {
        formatRaleCommandResponse(result, 'clearRegistry', displayResponseFn);
        return;
      }
      await showRegistrySnapshotAfterMutation();
      return;
    }

    if (cmd === 'addRegistrySection') {
      displayResponseFn({ status: 'Sending addRegistrySection...', args });
      const result = await sendCommand('addRegistrySection', args);
      if (!ralePayloadOk(result)) {
        formatRaleCommandResponse(result, 'addRegistrySection', displayResponseFn);
        return;
      }
      await showRegistrySnapshotAfterMutation();
      return;
    }

    if (cmd === 'removeRegistrySection') {
      displayResponseFn({ status: 'Sending removeRegistrySection...', args });
      const result = await sendCommand('removeRegistrySection', args);
      if (!ralePayloadOk(result)) {
        formatRaleCommandResponse(result, 'removeRegistrySection', displayResponseFn);
        return;
      }
      await showRegistrySnapshotAfterMutation();
      return;
    }

    if (cmd === 'addRegistryField') {
      displayResponseFn({ status: 'Sending addRegistryField...', args });
      const result = await sendCommand('addRegistryField', args);
      if (!ralePayloadOk(result)) {
        formatRaleCommandResponse(result, 'addRegistryField', displayResponseFn);
        return;
      }
      await showRegistrySnapshotAfterMutation();
      return;
    }

    if (cmd === 'removeRegistryField') {
      displayResponseFn({ status: 'Sending removeRegistryField...', args });
      const result = await sendCommand('removeRegistryField', args);
      if (!ralePayloadOk(result)) {
        formatRaleCommandResponse(result, 'removeRegistryField', displayResponseFn);
        return;
      }
      await showRegistrySnapshotAfterMutation();
      return;
    }

    if (cmd === 'editRegistryField') {
      displayResponseFn({ status: 'Sending editRegistryField...', args });
      const result = await sendCommand('editRegistryField', args);
      if (!ralePayloadOk(result)) {
        formatRaleCommandResponse(result, 'editRegistryField', displayResponseFn);
        return;
      }
      await showRegistrySnapshotAfterMutation();
      return;
    }

    displayResponseFn({ error: 'Unhandled RALE builtin: ' + cmd }, true);
  }

  // Fetch available functions from the Roku app
  async function fetchAvailableFunctions(setFunctionsFn: (funcs: unknown[]) => void) {
    displayResponseFn({ status: 'Fetching available functions...' });

    const result = await sendCommand('getExternalControlFunctions', {});

    if (!result) {
      displayResponseFn({ error: 'No response from device' }, true);
      return [];
    }

    if (result.success && result.data) {
      const inner = result.data as Record<string, unknown>;
      // TrackerTask returns { success: true/false, functions: [...] }
      if (inner.success && inner.functions && Array.isArray(inner.functions)) {
        const normalized = normalizeRaleFunctions(inner.functions);
        const list = Array.isArray(normalized) ? normalized : [];
        setFunctionsFn(list);
        displayResponseFn({
          status: 'Found ' + list.length + ' function(s)',
          functions: list
        });
        return list;
      } else if (!inner.success) {
        displayResponseFn(
          {
            error: 'getExternalControlFunctions returned false - make sure scene implements this function',
            data: inner
          },
          true
        );
        return [];
      } else {
        displayResponseFn({ status: 'No functions returned', data: inner });
        return [];
      }
    } else {
      console.error('Fetch functions result:', result);
      displayResponseFn(
        {
          error: result.error || 'Failed to fetch functions',
          details: result
        },
        true
      );
      return [];
    }
  }

  // Execute a function on the Roku app (App Connector or RALE builtin)
  async function executeFunction() {
    const selectionKey = funcNameInput.value.trim();
    if (!selectionKey) {
      displayResponseFn({ error: 'Please select a function to execute' }, true);
      return;
    }

    const functionParams = getParamValues(paramsContainer);

    if (isRaleBuiltinSelection(selectionKey)) {
      await executeRaleBuiltin(selectionKey, functionParams);
      return;
    }

    displayResponseFn({ status: `Executing ${selectionKey}...`, params: functionParams });

    const result = await sendCommand('executeExternalControlFunction', {
      functionName: selectionKey,
      functionParams: functionParams
    });

    if (result.success && result.data) {
      const execData = result.data as Record<string, unknown>;
      if (execData.success) {
        displayResponseFn({
          success: true,
          functionName: selectionKey,
          result: execData.result
        });
      } else {
        displayResponseFn(
          {
            error: 'Function execution failed',
            data: execData
          },
          true
        );
      }
    } else {
      displayResponseFn({ error: result.error }, true);
    }
  }

  executeBtn.addEventListener('click', executeFunction);

  return {
    executeFunction,
    fetchAvailableFunctions
  };
}

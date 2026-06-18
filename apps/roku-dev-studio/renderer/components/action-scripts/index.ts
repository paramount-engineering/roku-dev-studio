/**
 * Action Scripts component: Builder + Executor tabs and Import Action Script modal.
 */

import type { DevicePanelRoot } from '../../types/device-panel-dom.js';
import { showToast } from '../../modules/utils/ui.js';
import { setupBuilder } from './builder.js';
import { setupExecutor } from './executor.js';
import { setupImportModal } from './import-modal.js';
import { fetchAppFunctionsForBuilder } from './fetch-app-functions.js';
import {
  registerMcpBuilderDropHandler,
  registerMcpRaleHandler,
  registerMcpFunctionsHandler,
  registerMcpTool,
  pushMcpBridgeState
} from '../../modules/mcp-bridge-client.js';
import { getAppConnector } from '../../modules/app-connector/index.js';

export function setupActionScripts(panel: DevicePanelRoot, device, api) {
  const container = panel.querySelector('.action-scripts-container');
  if (!container) return;

  const builderTab = container.querySelector('.action-scripts-builder-tab') as HTMLElement | null;
  const executorTab = container.querySelector('.action-scripts-executor-tab') as HTMLElement | null;
  const builderContent = container.querySelector('.action-scripts-builder-content');
  const executorContent = container.querySelector('.action-scripts-executor-content');
  const card = container.querySelector('.action-scripts-card');
  const executorImportBtn = container.querySelector('.action-scripts-executor-import-btn');
  const executorEditInBuilderBtn = container.querySelector(
    '.action-scripts-executor-edit-in-builder-btn'
  ) as HTMLButtonElement | null;

  const executorElements = {
    executorTextarea: container.querySelector('.action-script-executor-textarea') as
      | HTMLTextAreaElement
      | null,
    executorUploadBtn: container.querySelector('.action-script-executor-upload'),
    executorValidateBtn: container.querySelector('.action-script-executor-validate'),
    executorValidationMessage: container.querySelector('.action-script-executor-validation'),
    executorSaveFolderDisplay: container.querySelector('.action-script-save-folder-path'),
    executorSaveFolderBtn: container.querySelector('.action-script-save-folder-btn'),
    executorConnectConsoleCheckbox: container.querySelector('.action-script-connect-console'),
    executorRunBtn: container.querySelector('.action-script-executor-run'),
    executorStopBtn: container.querySelector('.action-script-executor-stop'),
    executorClearActionsBtn: container.querySelector('.action-script-executor-clear-actions'),
    executorResultsCopyBtn: container.querySelector('.executor-results-copy-btn'),
    executorResultsSaveBtn: container.querySelector('.executor-results-save-btn'),
    executorResultsClearBtn: container.querySelector('.executor-results-clear-btn'),
    executorStepsList: container.querySelector('.executor-steps-list'),
    executorResults: container.querySelector('.executor-results'),
    executorWarningNoFolder: container.querySelector('.action-script-warning-no-folder'),
    executorPasswordPrompt: container.querySelector('.executor-password-prompt'),
    executorPasswordInput: container.querySelector('.executor-password-prompt-input')
  };

  const builderElements = {
    builderStepsList: container.querySelector('.action-scripts-builder-steps-list'),
    builderAddStepBtn: container.querySelector('.action-scripts-builder-add-step'),
    builderCancelEditBtn: container.querySelector('.action-scripts-builder-cancel-edit'),
    builderFormHeading: container.querySelector('.action-scripts-builder-form-heading'),
    builderAddForm: container.querySelector('.action-scripts-builder-add-form'),
    builderAddFormDismiss: container.querySelector('.action-scripts-builder-add-form-dismiss'),
    builderStepHelpBtn: container.querySelector('.action-scripts-builder-step-help-btn'),
    builderAddSection: container.querySelector('.action-scripts-builder-add-section'),
    builderStepTypeSelect: container.querySelector('.action-scripts-builder-type-select'),
    builderStepFields: container.querySelector('.action-scripts-builder-step-fields'),
    builderCopyJsonBtn: container.querySelector('.action-scripts-builder-copy-json'),
    builderCopyToExecutorBtn: container.querySelector('.action-scripts-builder-copy-to-executor'),
    builderSaveScriptBtn: container.querySelector('.action-scripts-builder-save-script'),
    builderOutputPreview: container.querySelector('.action-scripts-builder-output-preview'),
    builderUndoBtn: container.querySelector('.builder-undo-btn'),
    builderRedoBtn: container.querySelector('.builder-redo-btn'),
    builderClearBtn: container.querySelector('.builder-clear-btn'),
    builderImportBtn: container.querySelector('.builder-import-btn')
  };

  function hasExecutorSteps() {
    const ta = executorElements.executorTextarea;
    if (!(ta instanceof HTMLTextAreaElement) || !ta.value.trim()) return false;
    try {
      const o = JSON.parse(ta.value.trim());
      return Array.isArray(o.steps) && o.steps.length > 0;
    } catch {
      return false;
    }
  }

  function syncEditInBuilderBtn() {
    if (executorEditInBuilderBtn) executorEditInBuilderBtn.disabled = !hasExecutorSteps();
  }

  const builderApiRef: { current: ReturnType<typeof setupBuilder> | null } = { current: null };

  const { openImportModal, closeImportModal } = setupImportModal(container, device, api, {
    executorElements,
    hasExecutorSteps,
    onImportToBuilder(json: string) {
      const api = builderApiRef.current;
      const load = api?.importFromValidatedJson;
      if (!api || typeof load !== 'function') {
        showToast('Builder is not available on this tab.', 'error');
        return;
      }
      void Promise.resolve(load.call(api, json)).then((res) => {
        if (!res) return;
        if (!res.ok && res.message) showToast(res.message.replace(/\n/g, ' '), 'error');
        else if (res.ok) showToast('Loaded in Builder', 'success');
      });
    }
  });

  if (builderTab && executorTab && builderContent && executorContent) {
    builderTab.addEventListener('click', () => {
      builderTab.classList.add('active');
      executorTab.classList.remove('active');
      builderContent.classList.add('active');
      executorContent.classList.remove('active');
      if (card) card.classList.remove('action-scripts-executor-active');
    });
    executorTab.addEventListener('click', () => {
      executorTab.classList.add('active');
      builderTab.classList.remove('active');
      executorContent.classList.add('active');
      builderContent.classList.remove('active');
      if (card) card.classList.add('action-scripts-executor-active');
      queueMicrotask(syncEditInBuilderBtn);
    });
  }

  const builderApi = setupBuilder(panel, api, {
    elements: builderElements,
    onCopyToExecutor(json, opener) {
      if (executorTab) executorTab.click();
      openImportModal(json, opener ?? null);
    }
  });
  builderApiRef.current = builderApi ?? null;

  setupExecutor(panel, api, {
    elements: executorElements,
    getRaleFunctions: builderApi && builderApi.getRaleFunctions ? builderApi.getRaleFunctions.bind(builderApi) : null
  });

  // MCP bridge handlers — registered globally per panel, but only the
  // **currently focused** device panel's handlers should answer at any given
  // time. We express that by re-registering whenever this panel's outer tab
  // becomes active (via `.active` class on the panel root). A single
  // MutationObserver below fires re-registration after the user switches
  // device tabs in the sidebar; the latest-registered handler wins, so this
  // routes bridge traffic to the focused device consistently.

  // Borrow-pattern App Connector fetcher exposed through the MCP bridge
  // (`/app-connector/functions`).
  //
  // We capture the just-fetched list **via the callback** rather than
  // reading `connector.getFunctions()` after `fetchAppFunctionsForBuilder`
  // returns. The borrow disconnects right after fetching, and even though
  // the cache itself is no longer cleared on disconnect (see
  // `app-connector.ts::setState`), capturing inline is the most direct
  // way to express "I want THIS fetch's result, not whatever the cache
  // happens to contain by the time I read it." The connector subscription
  // (`onFunctionsChange`) below still updates the Builder mirror and the
  // MCP bridge state push as a side effect of the fetch.
  const functionsHandler = async () => {
    if (!api || typeof api.raleCommand !== 'function') {
      return { ok: true, status: 'not-applicable' as const, functions: [] };
    }
    let captured: unknown[] = [];
    try {
      const ok = await fetchAppFunctionsForBuilder(panel, api, (raw) => {
        captured = Array.isArray(raw) ? (raw as unknown[]) : [];
      });
      const collected: Array<{ name: string; params: Array<{ name: string; type?: string }> }> = captured
        .map((raw: unknown) => {
          const f = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
          const name = typeof f.name === 'string' ? f.name : '';
          const paramsRaw = Array.isArray(f.params) ? (f.params as unknown[]) : [];
          const params = paramsRaw.map((p) => {
            const po = p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
            return {
              name: typeof po.name === 'string' ? po.name : '',
              type: typeof po.type === 'string' ? po.type : undefined
            };
          });
          return { name, params };
        })
        .filter((f) => f.name !== '');
      if (ok && collected.length > 0) {
        return { ok: true, status: 'connected' as const, functions: collected };
      }
      return {
        ok: true,
        status: (ok ? 'not-applicable' : 'available-not-connected') as
          | 'not-applicable'
          | 'available-not-connected',
        functions: collected
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  // Read-only RALE command proxy for agents. Uses the same AppConnector
  // instance the Builder uses (auto-recovery on Not Connected). Allowlist is
  // read-only; writes must go through an Action Script step for human review.
  const RALE_READ_ONLY_COMMANDS = new Set([
    'getNodeById',
    'getNodeByName',
    'getRegistrySections'
  ]);
  const raleHandler = async ({ command, args }: { command: string; args: unknown }) => {
    if (!command || typeof command !== 'string') {
      return { ok: false, error: 'Missing RALE `command`.' };
    }
    if (!RALE_READ_ONLY_COMMANDS.has(command)) {
      return {
        ok: false,
        error:
          `Refusing to run "${command}" via the MCP bridge — only read-only commands are allowed (` +
          [...RALE_READ_ONLY_COMMANDS].join(', ') +
          `). Put writes into an Action Script step for human review.`
      };
    }
    if (!api || typeof api.raleCommand !== 'function') {
      return { ok: false, error: 'No RALE-capable API on the active device tab.' };
    }
    try {
      const connector = getAppConnector(panel, api);
      const cid = await connector.ensureConnected();
      if (!cid) return { ok: false, error: 'Could not establish App Connector session.' };
      const res = await connector.command(command, args || {});
      if (res && res.success) return { ok: true, data: res.data };
      return { ok: false, error: (res && res.error) || 'RALE command returned no data' };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  // Builder importer. Also ensures the Builder's cached App Connector
  // function list is fresh before the import-validator runs — otherwise
  // legitimate `appFunction` steps get rejected as "function not found"
  // when the user hasn't opened the Action Scripts tab yet.
  const dropHandler = async (jsonScript: string) => {
    const apiRef = builderApiRef.current;
    const load = apiRef?.importFromValidatedJson;
    if (!apiRef || typeof load !== 'function') {
      return { ok: false, message: 'Builder is not ready on this device tab.' };
    }
    // Pre-fetch functions so the Builder's importFromValidatedJson has the
    // list it needs to validate appFunction names. Short-circuits cheaply if
    // the Builder already has a populated cache.
    try {
      const existing = typeof apiRef.getRaleFunctions === 'function' ? apiRef.getRaleFunctions() : null;
      if (!Array.isArray(existing) || existing.length === 0) {
        await functionsHandler();
      }
    } catch (e) {
      console.warn('[mcp-bridge] pre-drop functions refresh failed', e);
    }
    if (builderTab) builderTab.click();
    try {
      const res = await Promise.resolve(load.call(apiRef, jsonScript));
      if (res && res.ok) {
        showToast('AI Agent loaded a Script into the Builder', 'success');
        return { ok: true };
      }
      const msg = (res && res.message) || 'Could not load script';
      showToast(msg.replace(/\n/g, ' '), 'error');
      return { ok: false, message: msg };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(msg, 'error');
      return { ok: false, message: msg };
    }
  };

  // Register handlers keyed by this panel's device. Bridge requests include a
  // target serial (or IP); dispatcher in mcp-bridge-client picks the matching
  // entry. When the agent doesn't specify a target, dispatcher falls back to
  // the focused device, which is tracked via setFocusedDevice() in app.ts.
  const devRec = (device || {}) as Record<string, unknown>;
  const handlerKey = {
    serial:
      typeof devRec.serialNumber === 'string'
        ? devRec.serialNumber
        : typeof devRec.serial === 'string'
          ? devRec.serial
          : null,
    ip: typeof devRec.ip === 'string' ? devRec.ip : null
  };
  registerMcpFunctionsHandler(handlerKey, functionsHandler);
  registerMcpRaleHandler(handlerKey, raleHandler);
  registerMcpBuilderDropHandler(handlerKey, dropHandler);

  // Generic renderer-tool handlers — these give agents access to things the
  // main process can't do directly because they need renderer-owned state
  // (AppConnector session, telnet socket). All share the same connector
  // instance the Builder uses, so they benefit from auto-recovery.

  // Full RALE command (read + write). Unlike the read-only `raleHandler`
  // above, this allowlist is empty by design — agents can invoke any
  // RALE_BUILTIN_COMMANDS entry including destructive ones (clearRegistry,
  // removeRegistrySection, etc). Every call is toasted in Dev Studio so the
  // user sees what the agent is doing.
  registerMcpTool(
    'rale_command',
    handlerKey,
    async (rawArgs: unknown) => {
      const a = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? (rawArgs as Record<string, unknown>) : {};
      const command = typeof a.command === 'string' ? a.command : '';
      if (!command) return { ok: false, error: 'Missing `command`.' };
      if (!api || typeof api.raleCommand !== 'function') {
        return { ok: false, error: 'No RALE-capable API on this device tab.' };
      }
      try {
        const connector = getAppConnector(panel, api);
        const cid = await connector.ensureConnected();
        if (!cid) return { ok: false, error: 'Could not establish App Connector session.' };
        const args = a.args != null && typeof a.args === 'object' ? a.args : {};
        const res = await connector.command(command, args);
        if (res && res.success) return { ok: true, data: res.data };
        return { ok: false, error: (res && res.error) || 'RALE command returned no data' };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );

  registerMcpTool(
    'app_connector_connect',
    handlerKey,
    async () => {
      if (!api || typeof api.raleCommand !== 'function') {
        return { ok: false, error: 'No RALE-capable API on this device tab.' };
      }
      try {
        const connector = getAppConnector(panel, api);
        const res = await connector.connect();
        if (res && res.ok) return { ok: true, data: { connectionId: res.connectionId || null } };
        return { ok: false, error: (res && 'error' in res && typeof (res as { error?: unknown }).error === 'string' ? String((res as { error?: unknown }).error) : 'Connect failed') };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );

  registerMcpTool(
    'app_connector_disconnect',
    handlerKey,
    async () => {
      if (!api || typeof api.raleCommand !== 'function') {
        return { ok: false, error: 'No RALE-capable API on this device tab.' };
      }
      try {
        const connector = getAppConnector(panel, api);
        await connector.disconnect();
        return { ok: true, data: { disconnected: true } };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );

  registerMcpTool(
    'app_function',
    handlerKey,
    async (rawArgs: unknown) => {
      const a = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? (rawArgs as Record<string, unknown>) : {};
      const functionName = typeof a.functionName === 'string' ? a.functionName : '';
      if (!functionName) return { ok: false, error: 'Missing `functionName`.' };
      if (!api || typeof api.raleCommand !== 'function') {
        return { ok: false, error: 'No RALE-capable API on this device tab.' };
      }
      try {
        const connector = getAppConnector(panel, api);
        const cid = await connector.ensureConnected();
        if (!cid) return { ok: false, error: 'Could not establish App Connector session.' };

        // Fetch the channel's exported function list so we can:
        //   1. Validate the requested name actually exists on the device
        //   2. Normalize a named-object `functionParams` into the positional
        //      array the Roku channel reads as `params[0]`, `params[1]`, ...
        //
        // The connector auto-caches and normalizes the response (via
        // `maybeCacheFunctionsFromResult` → `normalizeRaleFunctions`), so we
        // round-trip the command for freshness, then read the normalized
        // `{name, params}` shape from `connector.getFunctions()`. Reading the
        // raw `fnRes.data.functions` here would miss this normalization —
        // the wire format uses `functionName`, not `name`, so a `f.name`
        // lookup against the raw shape always fails (every channel looks
        // empty). See engineering-principles.md §"normalize at the boundary".
        const fnRes = (await connector.command('getExternalControlFunctions', {})) as {
          success?: boolean;
          data?: { functions?: unknown[] };
          error?: string;
        };
        if (!fnRes || !fnRes.success) {
          return { ok: false, error: (fnRes && fnRes.error) || 'Could not fetch App Function list from the channel.' };
        }
        const allFns = connector.getFunctions() || [];
        const fn = allFns.find((f) => f && f.name === functionName);
        if (!fn) {
          const names = allFns.map((f) => f && f.name).filter((n) => typeof n === 'string').join(', ');
          return {
            ok: false,
            error:
              `App function "${functionName}" was not found on this channel. ` +
              `Available functions: ${names || '(none — channel exposes no external control functions)'}.`
          };
        }

        const declared = Array.isArray(fn.params) ? fn.params : [];
        const raw = a.functionParams;
        let positional: unknown[];
        if (Array.isArray(raw)) {
          positional = raw;
        } else if (raw == null) {
          positional = [];
        } else if (typeof raw === 'object') {
          // Named-object form — normalize using the function's declared param order.
          // Channel reads params[0], params[1] positionally, so this conversion
          // is *required* before the call (a stray `{ key: value }` would arrive
          // as `params[0] = invalid`). The contract documents positional as the
          // canonical shape; we accept named-object as a convenience for agents
          // that try it anyway.
          const o = raw as Record<string, unknown>;
          positional = declared.map((p) => (p && typeof p.name === 'string' ? o[p.name] : undefined));
          const missing = declared
            .map((p, i) => ({ name: p && p.name, hasValue: positional[i] !== undefined }))
            .filter((x) => !x.hasValue && x.name)
            .map((x) => x.name);
          if (missing.length > 0) {
            return {
              ok: false,
              error:
                `App function "${functionName}" expects param(s) "${declared.map((p) => p && p.name).filter(Boolean).join(', ')}" ` +
                `but the named-object you sent is missing ${missing.join(', ')}. ` +
                `Prefer a positional array — see the appFunction section of roku-dev-studio://action-script-contract.md.`
            };
          }
        } else {
          return {
            ok: false,
            error:
              '`functionParams` must be an array (preferred) or a named object keyed by the function\'s param names. ' +
              `Got ${typeof raw}.`
          };
        }

        if (declared.length !== positional.length) {
          return {
            ok: false,
            error:
              `App function "${functionName}" expects ${declared.length} param(s), got ${positional.length}. ` +
              `Declared (in order): ${declared.map((p) => p && p.name).filter(Boolean).join(', ') || '(none)'}.`
          };
        }

        const res = await connector.command('executeExternalControlFunction', {
          functionName,
          functionParams: positional
        });
        if (res && res.success) {
          return { ok: true, data: { result: res.data, functionName, paramCount: positional.length } };
        }
        return { ok: false, error: (res && res.error) || 'App Function returned no result.' };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );

  registerMcpTool(
    'get_telnet_log',
    handlerKey,
    async (rawArgs: unknown) => {
      const a = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? (rawArgs as Record<string, unknown>) : {};
      const afterCursor = typeof a.afterCursor === 'number' ? a.afterCursor : 0;
      const maxLines = typeof a.maxLines === 'number' ? a.maxLines : 500;
      const telnetPanel = panel as unknown as {
        getTelnetLogSnapshot?: (ac: number, ml: number) => unknown;
      };
      const snap = typeof telnetPanel.getTelnetLogSnapshot === 'function'
        ? telnetPanel.getTelnetLogSnapshot(afterCursor, maxLines)
        : null;
      if (!snap) {
        return {
          ok: false,
          error: 'Telnet console is not initialised on this device tab. Open the Telnet Console tab in Dev Studio and connect first.'
        };
      }
      return { ok: true, data: snap };
    }
  );

  registerMcpTool(
    'telnet_connect',
    handlerKey,
    async () => {
      const telnetPanel = panel as unknown as {
        isTelnetConnected?: () => boolean;
        connectTelnet?: () => Promise<void>;
      };
      const isConnected = typeof telnetPanel.isTelnetConnected === 'function'
        ? telnetPanel.isTelnetConnected()
        : false;
      if (isConnected) {
        return { ok: true, data: { connected: true, already: true } };
      }
      const connect = telnetPanel.connectTelnet;
      if (typeof connect !== 'function') {
        return {
          ok: false,
          error: 'Telnet console is not initialised on this device tab. Open the device tab in Dev Studio first.'
        };
      }
      try {
        await connect();
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      const nowConnected = typeof telnetPanel.isTelnetConnected === 'function'
        ? telnetPanel.isTelnetConnected()
        : true;
      return { ok: true, data: { connected: nowConnected, already: false } };
    }
  );

  registerMcpTool(
    'telnet_disconnect',
    handlerKey,
    async () => {
      const telnetPanel = panel as unknown as {
        isTelnetConnected?: () => boolean;
        disconnectTelnet?: () => Promise<void>;
      };
      const isConnected = typeof telnetPanel.isTelnetConnected === 'function'
        ? telnetPanel.isTelnetConnected()
        : false;
      if (!isConnected) {
        return { ok: true, data: { connected: false, already: true } };
      }
      const disconnect = telnetPanel.disconnectTelnet;
      if (typeof disconnect !== 'function') {
        return {
          ok: false,
          error: 'Telnet console is not initialised on this device tab. Open the device tab in Dev Studio first.'
        };
      }
      try {
        await disconnect();
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      return { ok: true, data: { connected: false, already: false } };
    }
  );

  // Push a state snapshot so the MCP bridge can answer get_selected_device /
  // list_app_connector_functions. Re-pushed whenever this panel sets up
  // (which happens when the user opens or switches a device tab).
  try {
    const dev = (device || {}) as Record<string, unknown>;
    const isRemote = !!(dev.isRemote || dev.remoteLocationId);
    pushMcpBridgeState({
      selectedDevice: {
        ip: typeof dev.ip === 'string' ? dev.ip : null,
        serial: typeof dev.serial === 'string' ? dev.serial : (typeof dev.id === 'string' ? dev.id : null),
        modelName: typeof dev.modelName === 'string' ? dev.modelName : null,
        modelNumber: typeof dev.modelNumber === 'string' ? dev.modelNumber : null,
        friendlyDeviceName:
          typeof dev.friendlyDeviceName === 'string'
            ? dev.friendlyDeviceName
            : typeof dev.userDeviceName === 'string'
              ? dev.userDeviceName
              : null,
        softwareVersion: typeof dev.softwareVersion === 'string' ? dev.softwareVersion : null,
        source: isRemote ? 'remote' : 'local',
        remoteLocationId: typeof dev.remoteLocationId === 'string' ? dev.remoteLocationId : null,
        isFocused: true,
        isConnected: true
      }
    });
  } catch (e) {
    console.warn('[mcp-bridge] could not push selectedDevice', e);
  }


  if (builderElements.builderImportBtn) {
    builderElements.builderImportBtn.addEventListener('click', (e) => {
      const opener = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
      openImportModal(undefined, opener, { target: 'builder' });
    });
  }

  if (executorElements.executorTextarea) {
    executorElements.executorTextarea.addEventListener('input', syncEditInBuilderBtn);
  }
  syncEditInBuilderBtn();

  if (executorEditInBuilderBtn && builderTab) {
    executorEditInBuilderBtn.addEventListener('click', async () => {
      const ta = executorElements.executorTextarea;
      const raw = ta instanceof HTMLTextAreaElement ? ta.value.trim() : '';
      if (!raw) {
        showToast('No script JSON in Executor to load.', 'error');
        return;
      }
      if (!hasExecutorSteps()) {
        showToast('Add a non-empty "steps" array to the script JSON first.', 'error');
        return;
      }
      const impl = builderApiRef.current;
      if (!impl?.importFromValidatedJson) return;
      const res = await impl.importFromValidatedJson(raw);
      if (!res.ok) {
        showToast(res.message.replace(/\n/g, ' '), 'error');
        return;
      }
      builderTab.click();
      showToast('Opened in Builder', 'success');
    });
  }

  if (executorImportBtn) {
    executorImportBtn.addEventListener('click', (e) => {
      const opener = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
      openImportModal(undefined, opener);
    });
  }

  const builderSplitView = container.querySelector('.action-scripts-builder-split-view');
  const builderSplitDivider = container.querySelector(
    '.action-scripts-builder-split-divider'
  ) as HTMLElement | null;
  const builderStepsSection = container.querySelector(
    '.action-scripts-builder-steps-section'
  ) as HTMLElement | null;
  if (builderSplitView && builderSplitDivider && builderStepsSection) {
    const stepsSectionEl = builderStepsSection;
    builderSplitDivider.addEventListener('mousedown', (e: Event) => {
      const me = e as MouseEvent;
      if (me.button !== 0) return;
      me.preventDefault();
      const startX = me.clientX;
      const startWidth = stepsSectionEl.getBoundingClientRect().width;
      const viewRect = builderSplitView.getBoundingClientRect();
      const minLeft = 200;
      const minRight = 180;
      const dividerWidth = 8;

      function onMove(moveEvent: Event) {
        const dx = (moveEvent as MouseEvent).clientX - startX;
        let w = startWidth + dx;
        const maxLeft = viewRect.width - dividerWidth - minRight;
        w = Math.max(minLeft, Math.min(maxLeft, w));
        stepsSectionEl.style.width = w + 'px';
        stepsSectionEl.style.flex = '0 0 ' + w + 'px';
        stepsSectionEl.style.maxWidth = w + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  if (builderApi && builderApi.setRaleFunctions) {
    // Single subscription drives both the Builder's local mirror and the
    // MCP bridge state push. The connector itself owns the function-list
    // cache (auto-populated whenever any path runs
    // `connector.command('getExternalControlFunctions', {})` and auto-
    // cleared on disconnect), so this listener is the one place that
    // fans the canonical state out to the rest of the renderer.
    const connector = getAppConnector(panel, api);
    const sanitizeFunctions = (fns: ReadonlyArray<unknown> | null | undefined) =>
      (Array.isArray(fns) ? fns : [])
        .map((raw: unknown) => {
          const f = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
          const name = typeof f.name === 'string' ? f.name : '';
          const paramsRaw = Array.isArray(f.params) ? (f.params as unknown[]) : [];
          const params = paramsRaw.map((p) => {
            const po = p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
            return {
              name: typeof po.name === 'string' ? po.name : '',
              type: typeof po.type === 'string' ? po.type : undefined
            };
          });
          const description = typeof f.description === 'string' ? f.description.trim() : '';
          const entry: { name: string; params: typeof params; description?: string } = {
            name,
            params
          };
          if (description) entry.description = description;
          return entry;
        })
        .filter((f) => f.name !== '');

    const recomputeBridgeAppConnectorState = () => {
      const cached = connector.getFunctions();
      const fetchedAt = connector.getFunctionsFetchedAt();
      const isConn = connector.isConnected();
      const sanitized = sanitizeFunctions(cached);
      let status: 'connected' | 'available-not-connected' | 'not-applicable' | 'unknown';
      if (isConn) {
        status = sanitized.length > 0 ? 'connected' : 'not-applicable';
      } else {
        status = 'available-not-connected';
      }
      pushMcpBridgeState({
        appConnector: {
          status,
          functions: sanitized,
          fetchedAt: fetchedAt ?? new Date().toISOString()
        }
      });
    };

    connector.onFunctionsChange((fns) => {
      // Mirror to the Builder's per-instance cache so the appFunction
      // type-ahead and the validator's appFunction checks see the same
      // list everyone else does. `null` (cache cleared on disconnect)
      // becomes `[]` from the Builder's perspective.
      builderApi.setRaleFunctions(Array.isArray(fns) ? fns : []);
      recomputeBridgeAppConnectorState();
    });
    connector.onStateChange(() => {
      // Status field of `appConnector` depends on connector state too
      // (e.g. "available-not-connected" → "connected" when a session
      // opens with no fresh function fetch yet).
      recomputeBridgeAppConnectorState();
    });

    // Kick off the borrow-pattern fetch on initial setup and whenever the
    // user reopens the Action Scripts inner tab. The connector caches the
    // result, which fans out via the subscription above.
    const triggerBorrowFetch = () => {
      if (!api.raleCommand) {
        // No RALE-capable transport — broadcast `available-not-connected`
        // with an empty list so the bridge state matches reality.
        recomputeBridgeAppConnectorState();
        return;
      }
      void fetchAppFunctionsForBuilder(panel, api, () => {
        // No-op — the connector subscription handles the downstream sync.
      });
    };
    triggerBorrowFetch();
    panel.addEventListener('innertabswitch', (e: Event) => {
      const ce = e as CustomEvent<{ tab?: string }>;
      if (ce.detail?.tab === 'actionscripts') triggerBorrowFetch();
    });
  }

  // Default Action Scripts subtab: Builder (guided authoring).
  if (builderTab && executorTab && builderContent && executorContent) {
    builderTab.classList.add('active');
    executorTab.classList.remove('active');
    builderContent.classList.add('active');
    executorContent.classList.remove('active');
    if (card) card.classList.remove('action-scripts-executor-active');
  }
}

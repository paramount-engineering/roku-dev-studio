import type { DevicePanelRoot } from '../../types/device-panel-dom.js';

export type { DevicePanelRoot };

export interface InspectorDevice {
  ip: string;
  serialNumber?: string;
}

/** RALE-related subset of the unified device API (`createApiAdapter` in `app.ts`). */
export interface InspectorApi {
  ip: string;
  isRemote?: boolean;
  query(endpoint: string): Promise<{ success?: boolean; data?: string; error?: string }>;
  raleWake(port: number): Promise<{ success?: boolean; error?: string }>;
  raleConnect(port: number): Promise<{ success?: boolean; connectionId?: string; error?: string }>;
  raleCommand(
    connectionId: string,
    command: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>>;
  raleDisconnect(connectionId: string): Promise<unknown>;
}

export type DisplayPayload = unknown;

export interface RaleConnectionElements {
  portInput: HTMLInputElement;
  logVerbositySelect: HTMLSelectElement | null;
  connectBtn: HTMLButtonElement;
  disconnectBtn: HTMLButtonElement;
  connectionStatus: HTMLElement;
}

export type GetNodeByIdSearchArgs = { path: unknown[]; id: string };

export type DisplayResponseFn = (data: unknown, isError?: boolean) => void;

export interface FunctionExecutionElements {
  funcNameInput: HTMLInputElement;
  paramsContainer: HTMLElement;
  executeBtn: HTMLButtonElement;
}

export interface FunctionExecutionHooks {
  refreshRegistryParams?: () => void;
  onGetNodeByIdSuccess?: (args: GetNodeByIdSearchArgs) => void;
}

export type RenderParamInputsFn = (params: unknown[], opts?: Record<string, unknown>) => void;

/** Loose shape from `getExternalControlFunctions` after normalization. */
export interface ExternalControlFunctionMeta {
  name?: string;
  params?: unknown[];
  parameters?: unknown[];
  paramCount?: number;
  description?: string;
}

export interface FunctionSelectorElements {
  funcSelect: HTMLSelectElement;
  funcNameInput: HTMLInputElement;
  funcParamHint: HTMLElement | null;
  availableFunctions?: ExternalControlFunctionMeta[];
}

/**
 * Canonical "send a RALE command from the renderer" callable.
 *
 * Every Inspector-side caller routes through this instead of calling
 * `api.raleCommand(connectionId, ...)` directly so the shared
 * `AppConnector.command()` can:
 *
 *   - auto-cache successful `getExternalControlFunctions` responses (fans out
 *     to every subscriber of `connector.onFunctionsChange`),
 *   - verify-and-reconnect on a stale socket without the caller noticing,
 *   - remain the single seam for any future central interceptor.
 *
 * Violating this — i.e. reaching directly for `api.raleCommand(...)` — is the
 * Anti-pattern #1 ("reaching under a central abstraction") documented in
 * `engineering-principles.md`.
 */
export type RaleSendCommand = (
  command: string,
  args?: unknown
) => Promise<{ success?: boolean; data?: unknown; error?: string }>;

/** Options for `renderParamInputs` (registry builtin vs normal params). */
export interface RenderParamInputsOptions {
  builtin?: { registryUi?: string; params?: unknown[] } & Record<string, unknown>;
  getConnectionId?: () => string | null | undefined;
  /**
   * Routes registry lookups (`getRegistrySections`) through the shared
   * `AppConnector.command()`. Required when `builtin.registryUi` is set.
   */
  sendCommand?: RaleSendCommand;
}

/**
 * Minimal Window / global typings for the HTML renderer (`renderer/index.html` + `app.ts`).
 * DOM `data-*` contracts: `renderer/types/device-panel-dom.ts` + `dom-string-map-augmentation.ts`.
 */
export {};

/** IPC methods exposed as `window.roku` (see preload.ts). */
type RokuPreloadApi = Record<string, (...args: any[]) => any>;

declare global {
  interface Window {
    saveTrackerTask?: () => void | Promise<void>;
    copyTrackerTaskInfo?: () => void;
    showDevModeInstructions?: (opener?: HTMLElement) => void;
    showEcpModeInstructions?: (opener?: HTMLElement) => void;
    toggleIntegrationGuide?: () => void;
    /** Settings modal (separate window); only present in that window's preload. */
    settingsApi?: {
      getState: () => Promise<unknown>;
      save: (payload: unknown) => Promise<{ success?: boolean; error?: string }>;
      pickFolder: () => Promise<{ success?: boolean; canceled?: boolean; folderPath?: string; error?: string }>;
    };
    rdsSharedConstants?: {
      DEFAULT_RALE_PORT: number;
      SCREENSHOT_DEBOUNCE_DELAY: number;
      SCREENSHOT_AFTER_LAUNCH_DELAY: number;
      TELNET_TIMEOUT: number;
      CONNECTION_CHECK_INTERVAL: number;
      DEVICE_METRICS_SAMPLE_INTERVAL_MS: number;
      DEVICE_METRICS_CHART_HISTORY_MS: number;
      TOAST_DISPLAY_DURATION: number;
      STATUS_MESSAGE_DURATION: number;
    };
    /** Frameless shell: platform + window controls (see preload `rdsShell`). */
    rdsShell?: {
      platform: string;
      minimizeWindow: () => void;
      toggleMaximizeWindow: () => void;
      closeWindow: () => void;
    };
    /**
     * Preload `roku` bridge — index signature keeps IPC surface usable while Phase 3 migrates.
     * Prefer tightening against preload.ts later.
     */
    roku: RokuPreloadApi;
    /** Preload bridge for action-script-if-eval (see action-script-if-client). */
    actionScriptIf?: unknown;
    /** Preload bridge for action-script-variables (see action-script-variables-client). */
    actionScriptVariables?: unknown;
    /**
     * Preload bridge for the canonical Action Script validator
     * (`roku-dev-studio-api/lib/validate-action-script`).
     * See `.discussion-docs/unified-action-script-validation.md`.
     */
    actionScriptValidator?: {
      validateScript: (
        input: unknown,
        options?: { raleFunctions?: ReadonlyArray<unknown> }
      ) => {
        ok: boolean;
        errors: Array<{
          path: string;
          code: string;
          message: string;
          expected?: string | string[];
          stepIndex?: number;
        }>;
        stepCounts: Record<string, number>;
      };
      /**
       * Validate + normalize wire args for a `raleCommand` step. Returns
       * `{ ok: true, args }` on success (with the args cleaned up — path
       * parsed, strings trimmed) or `{ ok: false, error }` on failure.
       */
      validateRaleCommandArgs: (
        command: unknown,
        args: unknown
      ) =>
        | { ok: true; args: Record<string, unknown> }
        | { ok: false; error: string };
    };
  }

  interface HTMLElement {
    /** Set by Queries setup for Secret Screens modal. */
    rokuDevStudioApi?: QueriesDeviceApi;
    /** Telnet console teardown registered on device tab panels. */
    _telnetCleanup?: () => void;
    /** Device metrics polling / listeners teardown. */
    _deviceMetricsCleanup?: () => void;
    /** Action Script import modal: chosen output folder path (set at runtime). */
    _importOutputFolder?: string;
    /** Action Script import: target container element for mount bookkeeping. */
    _importTargetContainer?: HTMLElement | null;
    /** Set when Import modal opens — correct device api/container for shared one-shot listeners. */
    _importContext?: {
      api: { verifyDevAuth?: (password: string) => Promise<unknown>; raleCommand?: unknown; query?: unknown };
      getDeviceSerial: () => string;
      container: HTMLElement;
      /** Direct refs so Import does not rely on querySelector; paired with unhiding `.executor-import-section` before programmatic Validate. */
      executorTextarea?: HTMLTextAreaElement | null;
      executorValidateBtn?: HTMLElement | null;
    };
  }

  /** Loose device API used by Queries tab (direct or relay). */
  interface QueriesDeviceApi {
    ip: string;
    isRemote?: boolean;
    serverUrl?: string;
    query: (endpoint: string) => Promise<{ success?: boolean; data?: string; error?: string }>;
    post: (endpoint: string) => Promise<{ success?: boolean; data?: string; error?: string }>;
    telnetSystemDisconnect: () => Promise<unknown>;
    telnetSystemConnect: () => Promise<{ success?: boolean; error?: string }>;
    telnetSystemSend: (command: string) => Promise<{ success?: boolean; error?: string }>;
    keypress?: (key: string) => Promise<{ success?: boolean; error?: string }>;
  }

  /** Preload exposes RALE normalization on globalThis (see preload). */
  var rokuNormalize:
    | {
        normalizeRaleFunctions: (raw: unknown) => unknown;
        parseGetExternalControlFunctionsResponse: (raleResult: unknown) => unknown;
      }
    | undefined;

  var actionScriptWaitCore:
    | {
        parseMediaPlayerXml: (xmlText: string) => unknown;
        evaluateWaitCheck: (check: unknown, data: unknown) => unknown;
        sleepWithStop: (ms: number, shouldStop: unknown, chunkMs?: number) => Promise<unknown>;
        isValidMediaPlayerState: (state: unknown) => boolean;
        resolveMediaPlayerWaitExpectedState: (condition: unknown) => string;
      }
    | undefined;
}

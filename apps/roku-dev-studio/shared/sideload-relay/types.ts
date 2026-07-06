/**
 * Shared Sideload Relay types — used by the main-process relay service, the
 * IPC layer, and the renderer results panel. Kept transport-agnostic and free
 * of Electron / Node imports so both sides can import it.
 *
 * The relay impersonates a Roku dev server on `/plugin_install`: the IDE
 * (roku-deploy / VS Code / Eclipse) repoints `host` to the RDS machine, RDS
 * accepts the upload, fast-ACKs, then fans the saved package out to the real
 * devices — install → launch → console — reporting per-device status.
 */

/** A fan-out target (a real Roku device the relay forwards installs to). */
export interface RelayTarget {
  /** Stable id (device serial when known, else the ip). Used as React-ish key + password key. */
  id: string;
  ip: string;
  /** Optional non-standard packagePort; devices always use 80, so unused for targets today. */
  port?: number;
  name: string;
  /** True when this target participates in fan-out. */
  enabled: boolean;
  /**
   * The designated debug device (P4). Exactly one target may be primary. The
   * primary receives `remotedebug=1` and is the target of the 8081/8085 TCP
   * proxies + 8060 ECP reverse-proxy so the VS Code debugger attaches to it.
   */
  primary?: boolean;
}

/** Per-step outcome for one target during one relay run. */
export type RelayStepState = 'pending' | 'running' | 'ok' | 'error' | 'skipped';

export interface RelayStepResult {
  state: RelayStepState;
  /** Human-readable detail (error message or success note). */
  message?: string;
  /** ms the step took (set when it settles). */
  durationMs?: number;
}

/** Full per-target result for one relay run, streamed to the renderer as it progresses. */
export interface RelayDeviceResult {
  runId: string;
  targetId: string;
  ip: string;
  name: string;
  primary: boolean;
  install: RelayStepResult;
  launch: RelayStepResult;
  console: RelayStepResult;
  /** Set once all steps have settled. */
  done: boolean;
}

/** Emitted when a new upload is accepted and fan-out begins. */
export interface RelayRunStarted {
  runId: string;
  filename: string;
  bytes: number;
  /** ids of the targets fan-out will touch (enabled at accept time). */
  targetIds: string[];
  /** Whether this run came in on the debug-launch path (remotedebug=1 seen). */
  debugLaunch: boolean;
  startedAt: number;
}

/** Server lifecycle + bind status, pushed to the renderer on change. */
export interface RelayStatus {
  enabled: boolean;
  /** True when the ingest HTTP server is bound and accepting. */
  listening: boolean;
  /** The port actually bound (may differ from the requested port after 80→fallback). */
  boundPort: number | null;
  /** The port the user requested (from settings). */
  requestedPort: number;
  /** LAN interface addresses the server is reachable on (for the "paste this host" hint). */
  addresses: string[];
  /** Non-fatal last error (bind failure, etc.). */
  lastError?: string;
  /** P4: TCP debug proxies (8081/8085 → primary) bound for the debug-launch breakpoint path. */
  debugProxyListening: boolean;
  /** ECP emulator (8060) bound — RDS answers device-info/apps/commands as a Roku. Runs with the relay. */
  ecpEmulatorListening: boolean;
  /** SSDP responder active — RDS is advertising itself as a Roku for VS Code discovery. */
  ssdpAdvertising: boolean;
  /** ip of the current primary/debug device, if any. */
  primaryIp: string | null;
}

/** Boot config assembled from settings + secret store, handed to the service. */
export interface RelayBootConfig {
  enabled: boolean;
  requestedPort: number;
  /** Digest password the IDE authenticates with (user `rokudev`). */
  password: string;
  targets: RelayTarget[];
  /**
   * Per-target Digest passwords keyed by target id (main-process only — never
   * sent to the renderer). A target without an entry falls back to the shared
   * relay `password`.
   */
  targetPasswords?: Record<string, string>;
  autoLaunch: boolean;
  autoConsole: boolean;
  /** P4: bind the debug-proxy ports (8060/8081/8085) so "BrightScript Debug: Launch" works. */
  debugProxyEnabled: boolean;
  /** P5: retry a failed install once before reporting failure. */
  retryOnFailure: boolean;
}

/** Listener the service calls to surface events; the Electron adapter maps these onto IPC. */
export interface RelayListener {
  onStatus: (status: RelayStatus) => void;
  onRunStarted: (run: RelayRunStarted) => void;
  onDeviceResult: (result: RelayDeviceResult) => void;
}

export const DEFAULT_RELAY_PORT = 80;
/**
 * High-port fallback when binding privileged port 80 fails (non-root on
 * macOS/Linux). Deliberately NOT 8888 — that's the Network Inspector's default
 * MITM proxy port, and the relay would EADDRINUSE against it when both are on.
 */
export const RELAY_FALLBACK_PORT = 8889;
/** Fixed Roku ports the VS Code debug path assumes on `host` (P4). */
export const ECP_PORT = 8060;
export const DEBUG_CONTROL_PORT = 8081;
export const DEBUG_CONSOLE_PORT = 8085;

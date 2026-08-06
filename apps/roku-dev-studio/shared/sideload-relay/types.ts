/**
 * Shared Sideload Relay types — used by the main-process relay service, the
 * IPC layer, and the renderer results panel. Kept transport-agnostic and free
 * of Electron / Node imports so both sides can import it.
 *
 * The relay impersonates a Roku dev server on `/plugin_install`: the IDE
 * (roku-deploy / VS Code / Eclipse) repoints `host` to the RDS machine, RDS
 * accepts the upload, fast-ACKs, then fans the saved package out to the real
 * devices — install → console — reporting per-device status. (The channel
 * auto-launches on install, so the relay never issues an explicit launch.)
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
  /** Device serial (for stable identity + display), when known. */
  serial?: string;
  /** Human label for the device's location — "Local" or a remote location name. */
  location?: string;
  /** True when the device belongs to a remote RDS location (fan-out routes through its server). */
  remote?: boolean;
  /** Remote server base URL (remote targets only). */
  serverUrl?: string;
  /** Remote location id (remote targets only). */
  locationId?: string;
}

/** A device candidate returned by discovery for the setup table (local or remote). */
export interface RelayDeviceCandidate {
  id: string;
  ip: string;
  name: string;
  serial?: string;
  /** "Local" or the remote location's name. */
  location: string;
  remote: boolean;
  serverUrl?: string;
  locationId?: string;
  /** A validated dev password is already stored for this device (relay per-target or app credential). */
  hasPassword: boolean;
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
  install: RelayStepResult;
  console: RelayStepResult;
  /** Set once all steps have settled. */
  done: boolean;
  /**
   * True for a remote-location target. The renderer's auto-connect flow needs this (plus
   * `serverUrl`/`locationId`) to open the device through `connectRemoteDevice` instead of the
   * local-only `connectDevice` — otherwise it opens a direct-IP tab for a device that isn't
   * reachable from this machine, and re-opens a new one on every subsequent sideload.
   */
  remote?: boolean;
  /** Remote server base URL (remote targets only). */
  serverUrl?: string;
  /** Remote location id (remote targets only) — the key `connectRemoteDevice` tabs use. */
  locationId?: string;
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
  /**
   * Debug endpoints (8081 protocol stub + 8085 status console) bound. RDS
   * emulates these itself so the VS Code BrightScript "Debug: Launch" connect
   * succeeds and the fan-out status streams to the console. Runs with the relay.
   */
  debugEndpointsListening: boolean;
  /** ECP emulator (8060) bound — RDS answers device-info/apps/commands as a Roku. Runs with the relay. */
  ecpEmulatorListening: boolean;
  /** SSDP responder active — RDS is advertising itself as a Roku for VS Code discovery. */
  ssdpAdvertising: boolean;
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
  autoConsole: boolean;
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

/** UI strings for the Dev App panel (password auth, sideloading, screenshots, quick remote, Device Performance metrics). */
export const devApp = {
  // ── Password auth (password-auth.ts) ──────────────────────────────────────
  authenticated: 'Authenticated',
  notAuthenticated: 'Not Authenticated',
  verify: 'Verify',
  enterDeveloperPassword: 'Enter a developer password.',
  verificationNoResponse: 'Verification failed — no response from the Dev App.',

  // ── Quick remote (quick-remote.ts) ────────────────────────────────────────
  sendText: 'Send Text',
  sending: 'Sending...',

  // ── Screenshots (screenshots.ts) ──────────────────────────────────────────
  captureDisabledTitle: 'Launch the sideloaded Dev App on the device to capture a screenshot.',
  launchBeforeCapture: 'Launch the Dev App on the device before capturing a screenshot.',
  capturing: 'Capturing...',
  capture: 'Capture',
  copiedTitle: 'Copied!',
  copyScreenshot: 'Copy Screenshot',
  saveScreenshotAs: 'Save Screenshot As…',
  clearScreenshot: 'Clear Screenshot',
  copiedToClipboard: '✓ Copied to clipboard',
  savedTo: (filePath: string): string => `✓ Saved to: ${filePath}`,
  failedToCopy: (detail: string): string => `Failed to copy: ${detail}`,

  // ── Sideloaded app card (sideloaded-app.ts) ───────────────────────────────
  versionLabel: 'Version:',
  unknown: 'Unknown',
  noChannelSideloaded: 'No channel currently sideloaded',
  launching: 'Launching',
  launch: 'Launch',

  // ── Sideloading (sideloading.ts) ──────────────────────────────────────────
  dragDropUnavailable: 'Drag and drop is not available in this build',
  selectFileAndPassword: 'Please select a file and enter your developer password',
  installing: 'Installing...',
  install: 'Install',
  unknownError: 'Unknown error',
  deleteSideloadedChannelConfirm: 'Delete Sideloaded Channel?',

  // Shared between screenshots + sideloading
  pleaseEnterDeveloperPassword: 'Please enter your developer password',

  // ── Channel performance parse messages (remote-metrics-charts.ts) ─────────
  channelPerfUnavailable: (err: string): string => `Channel Performance unavailable: ${err}`,
  channelPerfUnavailableFailed: 'Channel Performance unavailable (status failed).',

  // ── Device Performance Action Script capture (device-metrics-performance-step.ts) ──
  captionCpuGraph: 'CPU Usage (Graph)',
  captionCpuProcess: 'CPU Usage (Process)',
  captionSystemMemory: 'System Memory',
  captionObjectsCount: 'BrightScript Objects (Count)',
  captionObjectsMemory: 'BrightScript Objects (Memory)',
  invalidChartType: 'Invalid Device Performance chart type.',
  developerModeRequired: 'Developer Mode must be enabled on this device to capture performance metrics.',
  remoteMetricsRootNotFound: 'Remote metrics root not found for this device tab.',
  devicePerfHidden:
    'Device Performance cards are hidden. On the Remote Section, turn on “Show Device Performance” (quad layout), then run this step again.',
  couldNotShowDevicePerf:
    'Could not show Device Performance automatically. On the Remote Section, turn on “Show Device Performance” (quad layout), then run this step again.',
  stopped: 'Stopped',
  couldNotCaptureDevicePerf:
    'Could not capture Device Performance cards. Ensure the quad is visible and the window is not minimized.',
  devicePerfAutoEnabledSummary:
    'Show Device Performance (quad layout) was turned on automatically for this step.',
  skippedNoProcStat: (caption: string): string =>
    `Skipped "${caption}" capture — device has not produced <proc-stat> yet (requires Roku OS 15.2+).`,

  // ── Device metrics: process-state labels (device-metrics.ts) ──────────────
  stateRunning: 'Running',
  stateSleeping: 'Sleeping',
  stateIdle: 'Idle',
  stateTracingStop: 'Tracing Stop',
  stateDiskWait: 'Disk Wait',
  stateStopped: 'Stopped',
  stateZombie: 'Zombie',
  stateDead: 'Dead',

  // ── Device metrics: objects resource monitor ──────────────────────────────
  updatedAt: (time: string): string => `Updated: ${time}`,
  memoryEstimatedHint:
    'Memory is estimated from object counts and chanperf (“used”) memory when the device does not send per-type bytes.',
  totalBrightScriptObjects: 'Total BrightScript Objects',

  // ── Device metrics: header perf strip ─────────────────────────────────────
  latestDevicePerfTitle: 'Latest Device Performance (Click to Open Remote)',

  // ── Device metrics: CPU process table ─────────────────────────────────────
  processLabel: 'Process',
  waitingForProcStat: 'Waiting for proc-stat sample…',
  stateFieldLabel: 'State',
  channelUptime: 'Channel Uptime',
  sinceFirstObserved: 'Since first observed',
  userCpuTime: 'User CPU Time',
  kernelCpuTime: 'Kernel CPU Time',
  childCpuTime: 'Child CPU Time',
  childFaults: 'Child Faults',
  minorMajor: 'Minor/Major',
  clockTickRate: 'Clock Tick Rate',
  minorFaults: 'Minor Faults',
  majorFaults: 'Major Faults',
  stableFor: (duration: string): string => `Stable for ${duration}`,
  childCpuTimeSecondary: (user: string, kernel: string): string => `User ${user} · Kernel ${kernel}`,

  // ── Device metrics: chart hover series labels ─────────────────────────────
  hoverTotal: 'Total',
  hoverUser: 'User',
  hoverKernel: 'Kernel',
  hoverUsed: 'Used',
  hoverResident: 'Resident',
  hoverAnonymous: 'Anonymous',
  hoverShared: 'Shared',
  hoverLimit: 'Limit',

  // ── Device metrics: error toasts ──────────────────────────────────────────
  chanperfRequestFailed: 'chanperf request failed',
  couldNotParseChanperf: 'Could not parse Channel Performance (Dev Mode / ECP / chanperf).',
  objectCountsFailed: 'Object counts failed',
  deviceMetricsUnavailable: 'Device Metrics unavailable',

  // ── Device metrics: objects empty states ──────────────────────────────────
  objectsEmptyBackground:
    'No BrightScript object breakdown while the Dev App is in the background. Launch or switch to the Dev App on the device — metrics and object counts update only when it is in the foreground.',
  objectsEmptyNoForeground:
    'No BrightScript object breakdown yet. After the connection reports the foreground channel, launch the Dev App if you need sideloaded Dev App object counts.',
  objectsEmptyNoCounts:
    'No BrightScript object breakdown yet. Ensure Control by Mobile Apps (Network Access) is enabled and the foreground channel exposes object counts.',

  // ── Device metrics: launch + paused nav ───────────────────────────────────
  launchingProgress: 'Launching…',
  launchFailed: 'Launch failed',
  pausedSideloadFull: 'Device Performance Paused — Sideload Dev App to Resume',
  pausedSideloadShort: 'Sideload to resume',
  pausedLaunchFull: 'Device Performance Paused — Launch Dev App to Resume',
  pausedLaunchShort: 'Launch to resume',
  pausedUnknownFull: 'Device Performance Paused — bring the Dev App to the foreground to resume.',
  pausedUnknownShort: 'Device Performance Paused',
  bringDevAppToForegroundTitle:
    'Bring the Dev App to the foreground on the device to enable Device Performance.',
  showDevicePerfAutoOnToast:
    'Show Device Performance was turned on so an Action Script could capture charts.',
} as const;

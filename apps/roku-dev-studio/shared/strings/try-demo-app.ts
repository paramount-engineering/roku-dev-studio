/**
 * UI strings for the "Try Demo App" modal
 * (renderer/components/try-demo-app/try-demo-app-modal.ts) and its backing
 * main-process handler (main/ipc/demo-app-handlers.ts).
 */
export const tryDemoApp = {
  modalTitle: 'Try the Roku Dev Studio Showcase',
  explainer:
    'Explore everything Roku Dev Studio can do, no app of your own required. This bundled channel exercises Remote Control, App Connector (real two-way function calls), Network Inspector traffic, Console Monitor findings, and MCP/AI-agent control.',
  postLaunchHeading: 'Once it launches, here is where to look:',
  // Inline `<strong>`/`<code>` markup, inserted as raw HTML by the modal (not escaped) —
  // same convention as shared/strings/network-inspector.ts's hint functions.
  postLaunchTips: [
    '<strong>Remote Control:</strong> move through the Home list and play a real video stream.',
    '<strong>App Connector:</strong> connect on port <code>49200</code> and call <code>PlayContentById</code>, <code>SetProxy</code>, <code>TriggerConsoleFinding</code>, and 11 more functions.',
    '<strong>Network Inspector:</strong> call <code>PingHealthCheck</code>, <code>SubmitTelemetryEvent</code>, or <code>SimulateNetworkError</code> from App Connector to generate live traffic.',
    '<strong>Console Monitor:</strong> call <code>TriggerConsoleFinding</code> from App Connector to surface real BrightScript findings.',
    '<strong>MCP / AI agent:</strong> from an MCP-connected client, call the <code>app_function</code> tool against <code>SearchCatalog</code> or <code>PlayContentById</code>.',
  ],
  deviceSelectLabel: 'Device',
  deviceSelectPlaceholder: 'Select a device',
  noDevicesText: 'No developer-mode devices found. Discover or add one first.',
  launchBtn: 'Sideload & Launch',
  launchBtnBusy: 'Sideloading…',
  toastSuccess: 'Demo channel launched.',
  toastFailure: (message: string): string => `Could not launch the demo channel: ${message}`,
  errDeviceNotFound: 'Select a device first.',
  errNoPasswordAvailable: 'No developer password available for this device.',
  errPackageFailed: (message: string): string => `Could not package the demo channel: ${message}`,
  errSideloadFailed: 'Sideload failed.',
} as const;

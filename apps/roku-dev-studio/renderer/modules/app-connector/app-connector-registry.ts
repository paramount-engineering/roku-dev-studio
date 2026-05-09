/**
 * Per-panel singleton for AppConnector.
 *
 * The device panel DOM is the natural scope for the connection (each connected
 * device is represented by one `.tab-panel`). We key the registry by that node
 * via a WeakMap so there is no DOM pollution and panels that get removed are
 * eligible for GC without explicit cleanup.
 */

import type { DevicePanelRoot } from '../../types/device-panel-dom.js';
import { DEFAULT_RALE_PORT } from '../utils/constants.js';
import {
  createAppConnector,
  type AppConnector,
  type AppConnectorApiLike
} from './app-connector.js';

const registry = new WeakMap<DevicePanelRoot, AppConnector>();

function readPortFromPanel(panel: DevicePanelRoot): number {
  const input = panel.querySelector('.rale-port-input');
  if (!(input instanceof HTMLInputElement)) return DEFAULT_RALE_PORT;
  const port = parseInt(input.value, 10);
  return port && !Number.isNaN(port) ? port : DEFAULT_RALE_PORT;
}

function readLogVerbosityFromPanel(panel: DevicePanelRoot): number {
  const sel = panel.querySelector('.rale-log-verbosity-select');
  if (!(sel instanceof HTMLSelectElement)) return 0;
  const raw = parseInt(sel.value, 10);
  return Number.isFinite(raw) && raw >= 0 && raw <= 4 ? raw : 0;
}

/**
 * Return the AppConnector for this panel, creating it on first call.
 * Subsequent calls with the same panel always return the same instance so all
 * consumers observe the same connection state.
 */
export function getAppConnector(
  panel: DevicePanelRoot,
  api: AppConnectorApiLike
): AppConnector {
  const existing = registry.get(panel);
  if (existing) return existing;
  const connector = createAppConnector(api, {
    getPort: () => readPortFromPanel(panel),
    getLogVerbosity: () => readLogVerbosityFromPanel(panel)
  });
  registry.set(panel, connector);
  return connector;
}

/** Return the AppConnector if one has already been created for this panel, else null. */
export function peekAppConnector(panel: DevicePanelRoot): AppConnector | null {
  return registry.get(panel) ?? null;
}

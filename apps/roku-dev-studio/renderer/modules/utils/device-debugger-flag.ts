/**
 * "Enable Debugger" as a property of the live device: `device.debuggerEnabled`.
 *
 * The persisted truth is the serial-keyed list in app settings (shared/platform/debugger-enabled.ts
 * owns the ONE predicate). This module resolves it for a device tab, stamps the result onto the
 * device object every panel module already holds, and announces changes on the tab panel as
 * {@link DEBUGGER_ENABLED_CHANGED_EVENT} — so the Dev App checkbox, the debug sidebar and anything
 * else read `device.debuggerEnabled` / listen for the event instead of each re-deriving the lookup
 * (which is how the flag ended up matching by IP in one place, by serial in another, and via a
 * DOM element that didn't exist in a third).
 *
 * `bindPanelDevice` is called once by createDevicePanel; the device object is the same reference
 * the connection holds and that enrichment mutates in place, so a late-arriving serial is seen.
 */
import {
  DEBUGGER_ENABLED_DEVICES_KEY,
  isDebuggerEnabled,
  withDebuggerEnabled
} from '@shared/platform/debugger-enabled.js';

export const DEBUGGER_ENABLED_CHANGED_EVENT = 'debugger-enabled-changed';

export interface DebuggerFlagDevice {
  ip: string;
  serialNumber?: string;
  /** Stamped by this module; read it, don't compute it. */
  debuggerEnabled?: boolean;
}

interface Binding {
  device: DebuggerFlagDevice;
  /** Serial the flag was last resolved for — a change means the lookup key changed. */
  resolvedForSerial: string;
}

const bindings = new WeakMap<HTMLElement, Binding>();

/** Attach the tab's device object and resolve the flag once (async). Idempotent per panel. */
export function bindPanelDevice(panel: HTMLElement, device: DebuggerFlagDevice): void {
  if (bindings.has(panel)) return;
  bindings.set(panel, { device, resolvedForSerial: device.serialNumber || '' });
  void refreshPanelDebuggerEnabled(panel);
  // A tab opened from a minimal fallback object (Sideload Relay auto-connect) learns its serial a
  // moment later via enrichment — the lookup key changes, so re-resolve then (and only then).
  panel.addEventListener('device-info-refreshed', () => {
    const b = bindings.get(panel);
    if (!b) return;
    const serial = b.device.serialNumber || '';
    if (serial === b.resolvedForSerial) return;
    b.resolvedForSerial = serial;
    void refreshPanelDebuggerEnabled(panel);
  });
}

/** The stamped value (false until the first resolution lands). */
export function isPanelDebuggerEnabled(panel: HTMLElement): boolean {
  return !!bindings.get(panel)?.device.debuggerEnabled;
}

/** Re-read the persisted list, stamp, and announce a change. Resolves to the flag. */
export async function refreshPanelDebuggerEnabled(panel: HTMLElement): Promise<boolean> {
  const b = bindings.get(panel);
  if (!b) return false;
  let enabled = false;
  try {
    const res = await window.roku.getSetting(DEBUGGER_ENABLED_DEVICES_KEY);
    enabled = isDebuggerEnabled(res?.value, { serial: b.device.serialNumber, ip: b.device.ip });
  } catch {
    /* default off */
  }
  return apply(panel, b, enabled);
}

/** Persist a toggle for the tab's device, then stamp + announce. */
export async function setPanelDebuggerEnabled(panel: HTMLElement, enabled: boolean): Promise<void> {
  const b = bindings.get(panel);
  if (!b) return;
  const res = await window.roku.getSetting(DEBUGGER_ENABLED_DEVICES_KEY);
  const ref = { serial: b.device.serialNumber, ip: b.device.ip };
  await window.roku.setSetting(DEBUGGER_ENABLED_DEVICES_KEY, withDebuggerEnabled(res?.value, ref, enabled));
  apply(panel, b, enabled);
}

function apply(panel: HTMLElement, b: Binding, enabled: boolean): boolean {
  if (b.device.debuggerEnabled !== enabled) {
    b.device.debuggerEnabled = enabled;
    panel.dispatchEvent(new CustomEvent(DEBUGGER_ENABLED_CHANGED_EVENT, { detail: { enabled } }));
  }
  return enabled;
}

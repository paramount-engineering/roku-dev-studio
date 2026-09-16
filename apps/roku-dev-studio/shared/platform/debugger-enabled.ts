/**
 * "Enable Debugger" — the per-device flag behind the Dev App / Fiddle checkbox (also switched on
 * automatically when a sideloaded build carries STOP statements). ONE predicate + ONE mutator for
 * every consumer: the main-process sideload path, the Sideload Relay fan-out, the Dev App checkbox
 * and the Telnet debug sidebar. Before this module each of them re-implemented the lookup (raw IP
 * here, serial there, a DOM scrape elsewhere) and two of them silently never matched.
 *
 * Persistence model: a list of `deviceKey()`s (serial when known, else IP) in app settings under
 * {@link DEBUGGER_ENABLED_DEVICES_KEY}. The device objects the renderer holds are transient
 * discovery results, so the durable identity is the serial — `isDebuggerEnabled` also honors the
 * raw-IP entries written before the identity-key migration. Consumers should stamp the resolved
 * value onto the live device (`device.debuggerEnabled`, see renderer/modules/utils/
 * device-debugger-flag.ts) rather than re-deriving it.
 */
import { deviceKey } from 'roku-dev-studio-platform/device-ref';

/** App-settings key holding the list. */
export const DEBUGGER_ENABLED_DEVICES_KEY = 'debugger-enabled-devices';
/** Pre-2026-09-16 key (a misnomer twice over: it held serials, and it was never sideload-only).
 *  Folded into the new key once by main/settings.ts on load. */
export const LEGACY_DEBUGGER_ENABLED_DEVICES_KEY = 'sideload-debug-ips';

export interface DebuggerEnabledRef {
  serial?: string | null;
  ip?: string | null;
}

/** Coerce a raw setting value into the list (anything else → empty). */
export function asDebuggerEnabledList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
}

function keyOf(ref: DebuggerEnabledRef): string {
  return deviceKey({ serial: ref.serial ?? undefined, ip: ref.ip ?? '' });
}

/** True when the device is in the list — by its identity key, or by a legacy raw-IP entry. */
export function isDebuggerEnabled(value: unknown, ref: DebuggerEnabledRef): boolean {
  const list = asDebuggerEnabledList(value);
  if (list.length === 0) return false;
  const key = keyOf(ref);
  if (key && list.includes(key)) return true;
  const ip = (ref.ip ?? '').trim();
  return !!ip && list.includes(ip);
}

/**
 * The list with the device switched on/off. Switching on stores the identity key and drops a now
 * redundant legacy raw-IP entry; switching off removes both forms. Returns a NEW array.
 */
export function withDebuggerEnabled(value: unknown, ref: DebuggerEnabledRef, enabled: boolean): string[] {
  const set = new Set(asDebuggerEnabledList(value));
  const key = keyOf(ref);
  const ip = (ref.ip ?? '').trim();
  if (enabled) {
    if (key) set.add(key);
    if (ip && ip !== key) set.delete(ip);
  } else {
    if (key) set.delete(key);
    if (ip) set.delete(ip);
  }
  return [...set];
}

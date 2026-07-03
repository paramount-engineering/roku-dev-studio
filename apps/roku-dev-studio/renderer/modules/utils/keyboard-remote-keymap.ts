/**
 * Pure mapping from a physical keyboard key to a Roku ECP key name, used by the
 * keyboard-remote handler. Extracted from app.ts (where the table was rebuilt on every
 * keydown) so it's allocated once and unit-testable in isolation.
 */

/** Physical key (single chars lowercased by the caller) → Roku ECP key. */
const KEY_TO_ROKU: Readonly<Record<string, string>> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Enter: 'Select',
  Backspace: 'Back',
  Escape: 'Home',
  ' ': 'Play',
  '*': 'Info',
  r: 'InstantReplay',
  j: 'Rev',
  l: 'Fwd',
  '+': 'VolumeUp',
  '-': 'VolumeDown',
  m: 'VolumeMute'
};

/**
 * Resolve a keydown event to the Roku ECP key it should send, or null if unmapped.
 * Shift+P (no other modifiers) maps to PowerOff; single-character keys are matched
 * case-insensitively.
 */
export function resolveRokuKeyFromEvent(e: KeyboardEvent): string | null {
  const shiftPForPower =
    e.shiftKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    e.key.length === 1 &&
    e.key.toLowerCase() === 'p';
  if (shiftPForPower) return 'PowerOff';
  const lookupKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return KEY_TO_ROKU[lookupKey] ?? null;
}

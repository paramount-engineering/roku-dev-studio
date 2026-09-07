/**
 * Masks IPv4 and MAC addresses in free-form error text (messages/stacks can echo a
 * device address from an in-flight network call) before a crash report is shown or
 * sent anywhere. Scoped to these two unambiguous patterns only — there's no
 * established free-text serial-number format in this codebase to key off (Privacy
 * Mode's serial masking swaps in a known `device.serial` field, it doesn't scan
 * arbitrary text), and guessing one risks mangling legitimate error text.
 */
const IPV4_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
const MAC_RE = /\b[0-9A-Fa-f]{2}([:-])[0-9A-Fa-f]{2}(?:\1[0-9A-Fa-f]{2}){4}\b/g;

export function redactSensitive(text: string): string {
  return text.replace(IPV4_RE, '•••.•••.•••.•••').replace(MAC_RE, '••:••:••:••:••:••');
}

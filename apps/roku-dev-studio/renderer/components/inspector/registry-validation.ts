/**
 * Client-side validation for TrackerTask registry commands (roRegistry: string values per key).
 */

export function isBlank(s: unknown): boolean {
  return s == null || String(s).trim() === '';
}

export function validateAddRegistrySection(name: unknown, section: unknown): string | null {
  if (isBlank(name)) {
    return 'Section name is required.';
  }
  if (section == null || typeof section !== 'object' || Array.isArray(section)) {
    return 'Section must be a JSON object (not an array).';
  }
  const sec = section as Record<string, unknown>;
  for (const k of Object.keys(sec)) {
    if (isBlank(k)) {
      return 'Section object keys cannot be empty or whitespace-only.';
    }
    const v = sec[k];
    if (typeof v !== 'string') {
      return `Each value must be a string (roRegistry stores strings). Key "${k}" is not a string — use quoted strings in JSON.`;
    }
  }
  return null;
}

export function validateRegistrySectionPick(sectionName: unknown): string | null {
  if (isBlank(sectionName)) {
    return 'Select a section from the list.';
  }
  return null;
}

export function validateRegistryKeyPick(key: unknown): string | null {
  if (isBlank(key)) {
    return 'Select a key from the list.';
  }
  return null;
}

export function validateRegistryKeyText(key: unknown): string | null {
  if (isBlank(key)) {
    return 'Enter a field key.';
  }
  return null;
}

export function validateRaleBuiltinWireArgsForInspector(
  command: string,
  args: Record<string, unknown>
): string | null {
  const a = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
  switch (command) {
    case 'removeRegistrySection':
      return validateRegistrySectionPick(a.name);
    case 'addRegistryField': {
      const e = validateRegistrySectionPick(a.sectionName);
      if (e) return e;
      return validateRegistryKeyText(a.key);
    }
    case 'removeRegistryField': {
      const e = validateRegistrySectionPick(a.sectionName);
      if (e) return e;
      return validateRegistryKeyPick(a.key);
    }
    case 'editRegistryField': {
      const e = validateRegistrySectionPick(a.sectionName);
      if (e) return e;
      return validateRegistryKeyPick(a.key);
    }
    default:
      return null;
  }
}

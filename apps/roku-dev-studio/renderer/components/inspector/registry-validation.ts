/**
 * Client-side validation for TrackerTask registry commands (roRegistry: string values per key).
 */

import { S } from '@shared/strings/index.js';

export function isBlank(s: unknown): boolean {
  return s == null || String(s).trim() === '';
}

export function validateAddRegistrySection(name: unknown, section: unknown): string | null {
  if (isBlank(name)) {
    return S.inspector.sectionNameRequired;
  }
  if (section == null || typeof section !== 'object' || Array.isArray(section)) {
    return S.inspector.sectionMustBeJsonObject;
  }
  const sec = section as Record<string, unknown>;
  for (const k of Object.keys(sec)) {
    if (isBlank(k)) {
      return S.inspector.sectionKeysNotEmpty;
    }
    const v = sec[k];
    if (typeof v !== 'string') {
      return S.inspector.eachValueMustBeString(k);
    }
  }
  return null;
}

export function validateRegistrySectionPick(sectionName: unknown): string | null {
  if (isBlank(sectionName)) {
    return S.inspector.selectSectionFromList;
  }
  return null;
}

export function validateRegistryKeyPick(key: unknown): string | null {
  if (isBlank(key)) {
    return S.inspector.selectKeyFromList;
  }
  return null;
}

export function validateRegistryKeyText(key: unknown): string | null {
  if (isBlank(key)) {
    return S.inspector.enterFieldKey;
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

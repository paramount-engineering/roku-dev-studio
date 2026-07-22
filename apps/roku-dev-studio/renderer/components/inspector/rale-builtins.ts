/**
 * Built-in RALE commands exposed in the Execute Function dropdown (optgroup "RALE Functions").
 * Option values are namespaced to avoid collisions with app function names.
 */
import { S } from '@shared/strings/index.js';

export const RALE_BUILTIN_PREFIX = "__rale__";

export const RALE_BUILTIN_COMMANDS = {
  [`${RALE_BUILTIN_PREFIX}getNodeById`]: {
    command: "getNodeById",
    requiresPath: true,
    label: S.inspector.getNodeByIdLabel,
    description: S.inspector.getNodeByIdDesc,
    params: [
      { name: "path", type: "roArray", defaultValue: "[]" },
      { name: "id", type: "String" },
    ],
  },
  [`${RALE_BUILTIN_PREFIX}getNodeByName`]: {
    command: "getNodeByName",
    requiresPath: true,
    label: S.inspector.getNodeByNameLabel,
    description: S.inspector.getNodeByNameDesc,
    params: [
      { name: "path", type: "roArray", defaultValue: "[]" },
      { name: "name", type: "String" },
    ],
  },

  [`${RALE_BUILTIN_PREFIX}getRegistrySections`]: {
    command: "getRegistrySections",
    label: S.inspector.getRegistrySectionsLabel,
    description: S.inspector.getRegistrySectionsDesc,
    params: [],
  },
  [`${RALE_BUILTIN_PREFIX}clearRegistry`]: {
    command: "clearRegistry",
    label: S.inspector.clearRegistryLabel,
    description: S.inspector.clearRegistryDesc,
    params: [],
  },
  [`${RALE_BUILTIN_PREFIX}addRegistrySection`]: {
    command: "addRegistrySection",
    label: S.inspector.addRegistrySectionLabel,
    description: S.inspector.addRegistrySectionDesc,
    params: [
      { name: "name", type: "String" },
      { name: "section", type: "roAssociativeArray", defaultValue: "{}" },
    ],
  },
  [`${RALE_BUILTIN_PREFIX}removeRegistrySection`]: {
    command: "removeRegistrySection",
    registryUi: "removeSection",
    label: S.inspector.removeRegistrySectionLabel,
    description: S.inspector.removeRegistrySectionDesc,
    params: [{ name: "Section Name", type: "String" }],
  },
  [`${RALE_BUILTIN_PREFIX}addRegistryField`]: {
    command: "addRegistryField",
    registryUi: "setField",
    label: S.inspector.addRegistryFieldLabel,
    description: S.inspector.addRegistryFieldDesc,
    params: [
      { name: "Section Name", type: "String" },
      { name: "Key", type: "String" },
      { name: "Value", type: "String" },
    ],
  },
  [`${RALE_BUILTIN_PREFIX}removeRegistryField`]: {
    command: "removeRegistryField",
    registryUi: "removeField",
    label: S.inspector.removeRegistryFieldLabel,
    description: S.inspector.removeRegistryFieldDesc,
    params: [
      { name: "Section Name", type: "String" },
      { name: "Key", type: "String" },
    ],
  },
  [`${RALE_BUILTIN_PREFIX}editRegistryField`]: {
    command: "editRegistryField",
    registryUi: "editField",
    label: S.inspector.editRegistryFieldLabel,
    description: S.inspector.editRegistryFieldDesc,
    params: [
      { name: "Section Name", type: "String" },
      { name: "Key", type: "String" },
      { name: "New Key", type: "String" },
      { name: "New Value", type: "String" },
    ],
  },
};

export function isRaleBuiltinSelection(value: string) {
  return typeof value === "string" && value.startsWith(RALE_BUILTIN_PREFIX);
}

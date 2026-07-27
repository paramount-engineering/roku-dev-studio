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
    get label() { return S.inspector.getNodeByIdLabel; },
    get description() { return S.inspector.getNodeByIdDesc; },
    params: [
      { name: "path", type: "roArray", defaultValue: "[]" },
      { name: "id", type: "String" },
    ],
  },
  [`${RALE_BUILTIN_PREFIX}getNodeByName`]: {
    command: "getNodeByName",
    requiresPath: true,
    get label() { return S.inspector.getNodeByNameLabel; },
    get description() { return S.inspector.getNodeByNameDesc; },
    params: [
      { name: "path", type: "roArray", defaultValue: "[]" },
      { name: "name", type: "String" },
    ],
  },

  [`${RALE_BUILTIN_PREFIX}getRegistrySections`]: {
    command: "getRegistrySections",
    get label() { return S.inspector.getRegistrySectionsLabel; },
    get description() { return S.inspector.getRegistrySectionsDesc; },
    params: [],
  },
  [`${RALE_BUILTIN_PREFIX}clearRegistry`]: {
    command: "clearRegistry",
    get label() { return S.inspector.clearRegistryLabel; },
    get description() { return S.inspector.clearRegistryDesc; },
    params: [],
  },
  [`${RALE_BUILTIN_PREFIX}addRegistrySection`]: {
    command: "addRegistrySection",
    get label() { return S.inspector.addRegistrySectionLabel; },
    get description() { return S.inspector.addRegistrySectionDesc; },
    params: [
      { name: "name", type: "String" },
      { name: "section", type: "roAssociativeArray", defaultValue: "{}" },
    ],
  },
  [`${RALE_BUILTIN_PREFIX}removeRegistrySection`]: {
    command: "removeRegistrySection",
    registryUi: "removeSection",
    get label() { return S.inspector.removeRegistrySectionLabel; },
    get description() { return S.inspector.removeRegistrySectionDesc; },
    params: [{ name: "Section Name", type: "String" }],
  },
  [`${RALE_BUILTIN_PREFIX}addRegistryField`]: {
    command: "addRegistryField",
    registryUi: "setField",
    get label() { return S.inspector.addRegistryFieldLabel; },
    get description() { return S.inspector.addRegistryFieldDesc; },
    params: [
      { name: "Section Name", type: "String" },
      { name: "Key", type: "String" },
      { name: "Value", type: "String" },
    ],
  },
  [`${RALE_BUILTIN_PREFIX}removeRegistryField`]: {
    command: "removeRegistryField",
    registryUi: "removeField",
    get label() { return S.inspector.removeRegistryFieldLabel; },
    get description() { return S.inspector.removeRegistryFieldDesc; },
    params: [
      { name: "Section Name", type: "String" },
      { name: "Key", type: "String" },
    ],
  },
  [`${RALE_BUILTIN_PREFIX}editRegistryField`]: {
    command: "editRegistryField",
    registryUi: "editField",
    get label() { return S.inspector.editRegistryFieldLabel; },
    get description() { return S.inspector.editRegistryFieldDesc; },
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

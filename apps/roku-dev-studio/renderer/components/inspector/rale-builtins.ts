/**
 * Built-in RALE commands exposed in the Execute Function dropdown (optgroup "RALE Functions").
 * Option values are namespaced to avoid collisions with app function names.
 */
export const RALE_BUILTIN_PREFIX = "__rale__";

export const RALE_BUILTIN_COMMANDS = {
  [`${RALE_BUILTIN_PREFIX}getNodeById`]: {
    command: "getNodeById",
    requiresPath: true,
    label: "Get Node by ID",
    description:
      "RALE getNodeById — depth-first search under path; id matches the node id field. Path [] = scene root.",
    params: [
      { name: "path", type: "roArray", defaultValue: "[]" },
      { name: "id", type: "String" },
    ],
  },
  [`${RALE_BUILTIN_PREFIX}getNodeByName`]: {
    command: "getNodeByName",
    requiresPath: true,
    label: "Get Node by SubType (component class)",
    description:
      "RALE getNodeByName — name is node.subtype() (XML component class), e.g. Label, RowList. Path [] = scene root.",
    params: [
      { name: "path", type: "roArray", defaultValue: "[]" },
      { name: "name", type: "String" },
    ],
  },

  [`${RALE_BUILTIN_PREFIX}getRegistrySections`]: {
    command: "getRegistrySections",
    label: "[Registry] Get All Sections",
    description:
      "RALE getRegistrySections — read all roRegistry sections and keys (returns nested object by section name).",
    params: [],
  },
  [`${RALE_BUILTIN_PREFIX}clearRegistry`]: {
    command: "clearRegistry",
    label: "[Registry] Clear All Sections",
    description:
      "RALE clearRegistry — deletes every registry section on the device (destructive).",
    params: [],
  },
  [`${RALE_BUILTIN_PREFIX}addRegistrySection`]: {
    command: "addRegistrySection",
    label: "[Registry] Add/Update Section",
    description:
      "RALE addRegistrySection — args.name = section name; args.section = JSON object of string key/value pairs.",
    params: [
      { name: "name", type: "String" },
      { name: "section", type: "roAssociativeArray", defaultValue: "{}" },
    ],
  },
  [`${RALE_BUILTIN_PREFIX}removeRegistrySection`]: {
    command: "removeRegistrySection",
    registryUi: "removeSection",
    label: "[Registry] Remove Section",
    description:
      "RALE removeRegistrySection — deletes one section. Sections load from the device; after success, registry is refreshed.",
    params: [{ name: "Section Name", type: "String" }],
  },
  [`${RALE_BUILTIN_PREFIX}addRegistryField`]: {
    command: "addRegistryField",
    registryUi: "setField",
    label: "[Registry] Set Section Key",
    description:
      "RALE addRegistryField — set a string value for a key under a section. Section list loads from the device.",
    params: [
      { name: "Section Name", type: "String" },
      { name: "Key", type: "String" },
      { name: "Value", type: "String" },
    ],
  },
  [`${RALE_BUILTIN_PREFIX}removeRegistryField`]: {
    command: "removeRegistryField",
    registryUi: "removeField",
    label: "[Registry] Remove Section Key",
    description:
      "RALE removeRegistryField — delete one key. Pick section and key from lists loaded from the device.",
    params: [
      { name: "Section Name", type: "String" },
      { name: "Key", type: "String" },
    ],
  },
  [`${RALE_BUILTIN_PREFIX}editRegistryField`]: {
    command: "editRegistryField",
    registryUi: "editField",
    label: "[Registry] Edit Section Key",
    description:
      "RALE editRegistryField — pick section and key, then enter newKey and newValue. Lists load from the device.",
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

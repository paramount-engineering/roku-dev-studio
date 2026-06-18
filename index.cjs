#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../roku-dev-studio-api/dist/lib/action-script-node-field-constants.js
var require_action_script_node_field_constants = __commonJS({
  "../roku-dev-studio-api/dist/lib/action-script-node-field-constants.js"(exports2, module2) {
    "use strict";
    var RALE_NODE_FIELD_OPERATORS = Object.freeze([
      "is",
      "isNot",
      "hasAnyValue",
      "hasNoValue",
      "contains",
      "doesNotContain",
      "beginsWith",
      "endsWith"
    ]);
    var OPS_NEED_VALUE = /* @__PURE__ */ new Set([
      "is",
      "isNot",
      "contains",
      "doesNotContain",
      "beginsWith",
      "endsWith"
    ]);
    module2.exports = {
      RALE_NODE_FIELD_OPERATORS,
      OPS_NEED_VALUE
    };
  }
});

// ../roku-dev-studio-api/dist/lib/catalogs.js
var require_catalogs = __commonJS({
  "../roku-dev-studio-api/dist/lib/catalogs.js"(exports2, module2) {
    "use strict";
    var {
      RALE_NODE_FIELD_OPERATORS: RALE_NODE_FIELD_OPERATOR_NAMES,
      OPS_NEED_VALUE
    } = require_action_script_node_field_constants();
    var STEP_SCHEMA = Object.freeze({
      query: {
        required: ["endpoint"],
        optional: [],
        label: "Device Query",
        description: "ECP GET (e.g. /query/media-player) or dev telnet Plugins/Memory (presets telnet:plugins, telnet:free)"
      },
      post: {
        required: ["endpoint"],
        optional: [],
        label: "POST",
        description: "Run a POST (e.g. sgrendezvous/track)"
      },
      keypress: {
        required: ["key"],
        optional: [],
        label: "Keypress",
        description: "Send a remote key (e.g. Home, Select, Back)"
      },
      inputText: {
        required: ["text"],
        optional: [],
        label: "Send Text",
        description: "Send text input to the device"
      },
      launch: {
        required: ["appId"],
        optional: ["params"],
        label: "Launch App",
        description: "Launch app by ID"
      },
      sideload: {
        required: ["filePath"],
        optional: ["password"],
        label: "Sideload",
        description: "Upload and install a channel package"
      },
      deleteSideload: {
        required: [],
        optional: ["password"],
        label: "Delete Sideload",
        description: "Remove sideloaded channel"
      },
      appFunction: {
        required: ["functionName", "functionParams"],
        optional: ["assignToVar"],
        label: "App Function",
        description: "Execute a function via App Connector (RALE). For a one-off call prefer the direct `app_function` tool; only use this step inside a multi-step script. `functionParams` is a positional array with one entry per declared parameter \u2014 see `list_app_connector_functions` for the running channel's `params[]` shapes."
      },
      raleCommand: {
        required: ["command", "args"],
        optional: ["assignToVar"],
        label: "RALE Command",
        description: "Run a built-in RALE command (getNodeById, registry, \u2026)"
      },
      screenshot: {
        required: [],
        optional: ["label", "password", "waitBeforeMs", "waitAfterTriggerMs"],
        label: "Screenshot",
        description: "Capture screenshot and save to run folder"
      },
      devicePerformance: {
        required: ["chart"],
        optional: ["label"],
        label: "Device Performance",
        description: "Capture charts for the device this script runs on: BrightScript Objects, CPU usage, system memory, or all three."
      },
      wait: {
        required: [],
        optional: ["condition", "delayMs", "timeoutMs", "pollIntervalMs"],
        label: "Wait",
        description: "Fixed delay (ms) or wait until condition (e.g. media-player state)"
      },
      if: {
        required: ["condition", "then", "else"],
        optional: [],
        label: "If",
        description: "Conditional branch (requires script version 2): run then or else steps"
      }
    });
    var SCRIPT_VERSIONS = Object.freeze(["1", "2"]);
    var SAVE_ACTION_TYPES = Object.freeze(["screenshot"]);
    var PASSWORD_STEP_TYPES = Object.freeze(["screenshot", "sideload", "deleteSideload"]);
    var KEYPRESS_GROUPS = Object.freeze([
      {
        label: "Navigation & Selection",
        keys: [
          { value: "Up", label: "Up \u25B2" },
          { value: "Down", label: "Down \u25BC" },
          { value: "Left", label: "Left \u25C0" },
          { value: "Right", label: "Right \u25B6" },
          { value: "Select", label: "OK" },
          { value: "Home", label: "Home \u2302" },
          { value: "Back", label: "Back \u2190" }
        ]
      },
      {
        label: "Media Playback",
        keys: [
          { value: "Play", label: "Play/Pause \u23EF" },
          { value: "InstantReplay", label: "Instant Replay \u21BA" },
          { value: "Fwd", label: "Fwd \u23ED" },
          { value: "Rev", label: "Rev \u23EE" }
        ]
      }
    ]);
    var KEYPRESS_OPTIONS = Object.freeze(
      KEYPRESS_GROUPS.flatMap((g) => g.keys.map((k) => k.value))
    );
    var QUERY_PRESETS = Object.freeze([
      { endpoint: "/query/device-info", label: "Device Info" },
      { endpoint: "/query/apps", label: "All Apps" },
      { endpoint: "/query/active-app", label: "Active App" },
      { endpoint: "/query/media-player", label: "Media Player" },
      { endpoint: "telnet:plugins", label: "Plugins" },
      { endpoint: "telnet:free", label: "Memory" },
      { endpoint: "/query/sgnodes/all", label: "SG Nodes (All)" },
      { endpoint: "/query/sgnodes/roots", label: "SG Nodes (Roots)" },
      { endpoint: "/query/graphics-frame-rate", label: "Frame Rate" },
      { endpoint: "/query/chanperf", label: "Channel Perf" },
      { endpoint: "/query/app-state/dev", label: "App State" },
      { endpoint: "/query/registry/dev", label: "Registry" }
    ]);
    var POST_PRESETS = Object.freeze([
      { endpoint: "/sgrendezvous/track", label: "SGRendezvous: Track" },
      { endpoint: "/sgrendezvous/untrack", label: "SGRendezvous: Untrack" },
      { endpoint: "/fwbeacons/track/dev", label: "FW Beacons: Track (dev)" },
      { endpoint: "/fwbeacons/untrack", label: "FW Beacons: Untrack" }
    ]);
    var SYSTEM_TELNET_PRESETS = Object.freeze([
      { telnetCommand: "plugins", label: "Plugins" },
      { telnetCommand: "free", label: "Memory" }
    ]);
    var WAIT_SOURCES = Object.freeze(["media-player", "rale-node-field"]);
    var IF_SOURCES = Object.freeze([
      "media-player",
      "active-app",
      "rale-node-field",
      "variables"
    ]);
    var MEDIA_PLAYER_STATES = Object.freeze([
      { value: "play", label: "Play" },
      { value: "pause", label: "Pause" },
      { value: "buffer", label: "Buffer" },
      { value: "close", label: "Close" },
      { value: "startup", label: "Startup" },
      { value: "stop", label: "Stop" }
    ]);
    var ACTIVE_APP_IF_ATTRIBUTES = Object.freeze([
      { value: "id", label: "App ID" },
      { value: "type", label: "Type (e.g. home, appl)" },
      { value: "version", label: "App Version" },
      { value: "name", label: "App Name" }
    ]);
    var NODE_FIELD_OPERATOR_DEFS = Object.freeze(
      RALE_NODE_FIELD_OPERATOR_NAMES.map((operator) => ({
        operator,
        requiresValue: OPS_NEED_VALUE.has(operator),
        description: nodeFieldOperatorDescription(operator)
      }))
    );
    function nodeFieldOperatorDescription(op) {
      switch (op) {
        case "is":
          return "actual === expected (after optional case folding)";
        case "isNot":
          return "actual !== expected";
        case "hasAnyValue":
          return "Field exists and is not empty";
        case "hasNoValue":
          return "Missing node, missing field, or empty";
        case "contains":
          return "actual includes value as substring";
        case "doesNotContain":
          return "opposite of contains";
        case "beginsWith":
          return "actual starts with value";
        case "endsWith":
          return "actual ends with value";
        default:
          return op;
      }
    }
    var DEVICE_PERFORMANCE_CHART_IDS = Object.freeze([
      "objects",
      "cpu",
      "memory",
      "aboveAll"
    ]);
    var RALE_BUILTINS = Object.freeze([
      {
        command: "getNodeById",
        label: "Get Node by ID",
        destructive: false,
        args: [
          { name: "path", type: "array<string|number>", required: true, description: "Scene path; [] for root" },
          { name: "id", type: "string", required: true, description: "Node id to look up" }
        ]
      },
      {
        command: "getNodeByName",
        label: "Get Node by Name (subtype / component class)",
        destructive: false,
        args: [
          { name: "path", type: "array<string|number>", required: true },
          { name: "name", type: "string", required: true }
        ]
      },
      {
        command: "getRegistrySections",
        label: "List Registry Sections",
        destructive: false,
        args: []
      },
      {
        command: "addRegistrySection",
        label: "Add Registry Section",
        destructive: true,
        args: [
          { name: "name", type: "string", required: true },
          { name: "section", type: "object<string,string>", required: true }
        ]
      },
      {
        command: "removeRegistrySection",
        label: "Remove Registry Section",
        destructive: true,
        args: [{ name: "name", type: "string", required: true }]
      },
      {
        command: "addRegistryField",
        label: "Add Registry Field",
        destructive: true,
        args: [
          { name: "sectionName", type: "string", required: true },
          { name: "key", type: "string", required: true },
          { name: "value", type: "string", required: false }
        ]
      },
      {
        command: "removeRegistryField",
        label: "Remove Registry Field",
        destructive: true,
        args: [
          { name: "sectionName", type: "string", required: true },
          { name: "key", type: "string", required: true }
        ]
      },
      {
        command: "editRegistryField",
        label: "Edit Registry Field",
        destructive: true,
        args: [
          { name: "sectionName", type: "string", required: true },
          { name: "key", type: "string", required: true },
          { name: "newKey", type: "string", required: true },
          { name: "newValue", type: "string", required: false }
        ]
      },
      {
        command: "clearRegistry",
        label: "Clear Registry",
        destructive: true,
        args: []
      }
    ]);
    var RALE_READ_ONLY_COMMANDS = Object.freeze(
      new Set(RALE_BUILTINS.filter((b) => !b.destructive).map((b) => b.command))
    );
    var AUTHORING_RULES = Object.freeze([
      {
        id: "version-2-for-if",
        rule: 'Use script version "2" whenever the script contains an `if` step. Use "1" otherwise.',
        rationale: "Version 1 has no `if`; the executor rejects it."
      },
      {
        id: "no-passwords-in-json",
        rule: "Never emit literal devPassword / password values in generated scripts. Leave the field absent \u2014 the user will fill it in Builder before running.",
        rationale: "Generated scripts are reviewed by humans; secrets must not flow through prompts/transports."
      },
      {
        id: "prefer-wait-over-delay",
        rule: "Prefer `wait` with a `condition` over a fixed `delayMs`.",
        rationale: "Conditions make scripts deterministic across devices; fixed delays are flaky."
      },
      {
        id: "screenshot-after-repro",
        rule: "Add a `screenshot` step right after the claimed repro point in a bug ticket.",
        rationale: "Provides evidence next to the action; cheap and high-value."
      },
      {
        id: "rale-step-needs-app-connector",
        rule: "`raleCommand` and `wait` / `if` with source `rale-node-field` require App Connector (RALE) to be connected on the device at run time.",
        rationale: "These steps fail without a live RALE session."
      },
      {
        id: "app-function-needs-app-connector",
        rule: "`appFunction` requires the channel to advertise that name through `getExternalControlFunctions`.",
        rationale: "If the function is not in `list_app_connector_functions`, the executor will fail. Use the live tool to confirm names."
      },
      {
        id: "app-function-params-are-positional",
        rule: "`functionParams` is a positional array \u2014 one entry per declared parameter, in declaration order. For a single-`roAssociativeArray` param, wrap the payload (`functionParams: [ { \u2026fields\u2026 } ]`); for zero args use `[]`. Prefer the `app_function` direct tool over an `appFunction` script step for one-off calls.",
        rationale: "A non-array `functionParams` is a different shape than the channel reads, so the call silently no-ops at runtime. Validation and the runtime tolerate a named object keyed by the declared param names and rewrite it to a positional array, but the rewrite relies on each key exactly matching a declared param name \u2014 a typo silently passes `undefined` for that slot. Author positional from the start."
      }
    ]);
    module2.exports = {
      STEP_SCHEMA,
      SCRIPT_VERSIONS,
      SAVE_ACTION_TYPES,
      PASSWORD_STEP_TYPES,
      KEYPRESS_GROUPS,
      KEYPRESS_OPTIONS,
      QUERY_PRESETS,
      POST_PRESETS,
      SYSTEM_TELNET_PRESETS,
      WAIT_SOURCES,
      IF_SOURCES,
      MEDIA_PLAYER_STATES,
      ACTIVE_APP_IF_ATTRIBUTES,
      NODE_FIELD_OPERATOR_DEFS,
      DEVICE_PERFORMANCE_CHART_IDS,
      RALE_BUILTINS,
      RALE_READ_ONLY_COMMANDS,
      AUTHORING_RULES
    };
  }
});

// ../roku-dev-studio-api/dist/lib/action-script-wait-core.js
var require_action_script_wait_core = __commonJS({
  "../roku-dev-studio-api/dist/lib/action-script-wait-core.js"(exports2, module2) {
    "use strict";
    var WAIT_CHECK_PATTERN = /^\s*(state|position|duration)\s*(===?|!==?|<=?|>=?)\s*('[^']*'|"[^"]*"|-?\d+(?:\.\d+)?)\s*$/;
    var MEDIA_STATES = /* @__PURE__ */ new Set(["play", "pause", "buffer", "close", "startup", "stop"]);
    function parseMediaPlayerXml(xmlText) {
      const result = {};
      if (xmlText == null) return result;
      const str = typeof xmlText === "string" ? xmlText : String(xmlText);
      if (!str.trim()) return result;
      const playerStateMatch = str.match(/<player[^>]*?\s+state\s*=\s*["']([^"']*)["']/i);
      const stateMatch = str.match(/<state>([^<]*)<\/state>/i);
      if (playerStateMatch) result.state = playerStateMatch[1].trim().toLowerCase();
      else if (stateMatch) result.state = stateMatch[1].trim().toLowerCase();
      const posMatch = str.match(/<position>([^<]*)<\/position>/i);
      if (posMatch) {
        const num = parseInt(posMatch[1].trim(), 10);
        if (!isNaN(num)) result.position = num;
      }
      const durMatch = str.match(/<duration>([^<]*)<\/duration>/i);
      if (durMatch) {
        const num = parseInt(durMatch[1].trim(), 10);
        if (!isNaN(num)) result.duration = num;
      }
      return result;
    }
    function evaluateWaitCheck(check, data) {
      if (!check || !data || typeof check !== "string") return false;
      const m = check.match(WAIT_CHECK_PATTERN);
      if (!m) return false;
      const [, varName, op, literal] = m;
      const state = String(data.state ?? "");
      const position = Number(data.position) || 0;
      const duration = Number(data.duration) || 0;
      let actual;
      if (varName === "state") actual = state;
      else if (varName === "position") actual = position;
      else actual = duration;
      let expected;
      const litTrim = literal.trim();
      if (litTrim.startsWith("'") && litTrim.endsWith("'") || litTrim.startsWith('"') && litTrim.endsWith('"')) {
        expected = litTrim.slice(1, -1);
      } else {
        expected = Number(litTrim);
        if (varName === "state") actual = String(actual);
        else actual = Number(actual);
      }
      switch (op) {
        case "==":
          return String(actual) === String(expected);
        case "===":
          return actual === expected;
        case "!=":
          return String(actual) !== String(expected);
        case "!==":
          return actual !== expected;
        case "<":
          return actual < expected;
        case "<=":
          return actual <= expected;
        case ">":
          return actual > expected;
        case ">=":
          return actual >= expected;
        default:
          return false;
      }
    }
    async function sleepWithStop(ms, shouldStop, chunkMs = 200) {
      const deadline = Date.now() + ms;
      while (Date.now() < deadline) {
        if (typeof shouldStop === "function" && shouldStop()) return false;
        const remaining = Math.min(chunkMs, deadline - Date.now());
        if (remaining <= 0) return true;
        await new Promise((r) => setTimeout(r, remaining));
      }
      return true;
    }
    function isValidMediaPlayerState(state) {
      if (state == null) return false;
      return MEDIA_STATES.has(String(state).trim().toLowerCase());
    }
    function resolveMediaPlayerWaitExpectedState(condition) {
      if (!condition || typeof condition !== "object") return "";
      if (condition.state != null) {
        const s = String(condition.state).trim().toLowerCase();
        if (s) return s;
      }
      const source = condition.source != null ? String(condition.source).trim().toLowerCase() : "media-player";
      if (source !== "media-player") return "";
      const f = String(condition.field != null ? condition.field : "").trim().toLowerCase();
      const op = String(condition.operator != null ? condition.operator : "").trim().toLowerCase();
      if (f === "state" && op === "equals" && condition.value != null) {
        return String(condition.value).trim().toLowerCase();
      }
      return "";
    }
    module2.exports = {
      WAIT_CHECK_PATTERN,
      MEDIA_STATES,
      parseMediaPlayerXml,
      evaluateWaitCheck,
      resolveMediaPlayerWaitExpectedState,
      sleepWithStop,
      isValidMediaPlayerState
    };
  }
});

// ../roku-dev-studio-api/dist/lib/err-util.js
var require_err_util = __commonJS({
  "../roku-dev-studio-api/dist/lib/err-util.js"(exports2, module2) {
    "use strict";
    var __defProp2 = Object.defineProperty;
    var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames2 = Object.getOwnPropertyNames;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp2(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps2 = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames2(from))
          if (!__hasOwnProp2.call(to, key) && key !== except)
            __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
    var err_util_exports = {};
    __export(err_util_exports, {
      errorMessage: () => errorMessage
    });
    module2.exports = __toCommonJS(err_util_exports);
    function errorMessage(e) {
      return e instanceof Error ? e.message : String(e);
    }
  }
});

// ../roku-dev-studio-api/dist/lib/rale-command-assign-vars.js
var require_rale_command_assign_vars = __commonJS({
  "../roku-dev-studio-api/dist/lib/rale-command-assign-vars.js"(exports2, module2) {
    "use strict";
    var RALE_COMMANDS_WITH_ASSIGN_TO_VAR = /* @__PURE__ */ new Set(["getNodeById", "getNodeByName", "getRegistrySections"]);
    function raleCommandSupportsAssignToVar(command) {
      return typeof command === "string" && RALE_COMMANDS_WITH_ASSIGN_TO_VAR.has(command.trim());
    }
    module2.exports = {
      RALE_COMMANDS_WITH_ASSIGN_TO_VAR,
      raleCommandSupportsAssignToVar
    };
  }
});

// ../roku-dev-studio-api/dist/lib/action-script-variables.js
var require_action_script_variables = __commonJS({
  "../roku-dev-studio-api/dist/lib/action-script-variables.js"(exports2, module2) {
    "use strict";
    var { raleCommandSupportsAssignToVar } = require_rale_command_assign_vars();
    var { errorMessage } = require_err_util();
    var OUTPUT_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    var PLACEHOLDER_RE = /\{\{([^}]*)\}\}/g;
    function isValidOutputName(name) {
      if (name == null || name === "") return true;
      const s = String(name).trim();
      if (s === "") return true;
      return OUTPUT_NAME_RE.test(s);
    }
    function getAssignToVarName(step) {
      if (!step || typeof step !== "object") return "";
      if (step.assignToVar !== void 0 && step.assignToVar !== null && String(step.assignToVar).trim() !== "") {
        return String(step.assignToVar).trim();
      }
      if (step.output !== void 0 && step.output !== null && String(step.output).trim() !== "") {
        return String(step.output).trim();
      }
      return "";
    }
    function parseVariableDotPath(pathStr) {
      if (typeof pathStr !== "string" || !pathStr.trim()) return null;
      const parts = pathStr.trim().split(".").map((p) => p.trim()).filter((p) => p.length > 0);
      if (parts.length === 0) return null;
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parts[0])) return null;
      for (let i = 1; i < parts.length; i++) {
        if (!/^[a-zA-Z0-9_]+$/.test(parts[i])) return null;
      }
      return parts;
    }
    function resolveVariableDotPath(variables, pathStr) {
      const parts = parseVariableDotPath(pathStr);
      if (!parts || parts.length === 0) return void 0;
      const root = parts[0];
      if (!Object.prototype.hasOwnProperty.call(variables, root)) return void 0;
      let value = variables[root];
      if (parts.length > 1) {
        value = getBySegments(value, parts.slice(1));
      }
      return value;
    }
    function valueToWaitStringForCompare(v) {
      if (v === null || v === void 0) return "";
      if (typeof v === "string") return v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    function validateOutputFields(script) {
      const errors = [];
      const doc = script;
      if (!doc || !Array.isArray(doc.steps)) return errors;
      const seen = /* @__PURE__ */ new Map();
      let preorderIndex = 0;
      function checkAssignToVarStep(step, i) {
        const name = getAssignToVarName(step);
        if (!name) return;
        const type = step.type;
        if (type !== "appFunction" && type !== "raleCommand") {
          errors.push({
            stepIndex: i,
            message: `Property "assignToVar" (or deprecated "output") is only allowed on appFunction and raleCommand (not ${type})`
          });
          return;
        }
        if (type === "raleCommand") {
          const cmd = step.command != null ? String(step.command).trim() : "";
          if (!raleCommandSupportsAssignToVar(cmd)) {
            errors.push({
              stepIndex: i,
              message: `assignToVar is only allowed for RALE read commands (getNodeById, getNodeByName, getRegistrySections), not "${cmd || "(missing)"}"`
            });
            return;
          }
        }
        if (!isValidOutputName(name)) {
          errors.push({
            stepIndex: i,
            message: `Invalid assignToVar "${name}". Use letters, digits, underscore; start with a letter or _.`
          });
          return;
        }
        if (seen.has(name)) {
          errors.push({
            stepIndex: i,
            message: `Duplicate assignToVar "${name}" (also used at action ${(seen.get(name) ?? 0) + 1})`
          });
        } else {
          seen.set(name, i);
        }
      }
      function walk(arr) {
        if (!Array.isArray(arr)) return;
        for (const step of arr) {
          if (!step || typeof step !== "object") continue;
          const i = preorderIndex++;
          checkAssignToVarStep(step, i);
          if (step.type === "if") {
            walk(step.then || []);
            walk(step.else || []);
          }
        }
      }
      walk(doc.steps);
      return errors;
    }
    function getBySegments(cur, segments) {
      let v = cur;
      for (const seg of segments) {
        if (v === null || v === void 0) return void 0;
        if (Array.isArray(v)) {
          const n = Number(seg);
          if (seg !== "" && Number.isInteger(n) && String(n) === seg && n >= 0 && n < v.length) {
            v = v[n];
          } else {
            return void 0;
          }
        } else if (typeof v === "object") {
          if (!Object.prototype.hasOwnProperty.call(v, seg)) return void 0;
          v = /** @type {Record<string, unknown>} */
          v[seg];
        } else {
          return void 0;
        }
      }
      return v;
    }
    function formatValueForSubst(v) {
      if (v === null || v === void 0) return "";
      if (typeof v === "string") return v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      try {
        return JSON.stringify(v);
      } catch {
        return "";
      }
    }
    function resolvePlaceholder(inner, variables) {
      const trimmed = String(inner).trim();
      if (!trimmed) return "";
      const parts = trimmed.split(".").map((p) => p.trim()).filter((p) => p.length > 0);
      if (parts.length === 0) return "";
      const root = parts[0];
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(root)) return "";
      for (let i = 1; i < parts.length; i++) {
        if (!/^[a-zA-Z0-9_]+$/.test(parts[i])) return "";
      }
      if (!Object.prototype.hasOwnProperty.call(variables, root)) return "";
      let value = variables[root];
      if (parts.length > 1) {
        value = getBySegments(value, parts.slice(1));
      }
      return formatValueForSubst(value);
    }
    function interpolateString(s, variables) {
      if (typeof s !== "string" || s.indexOf("{{") === -1) {
        return s;
      }
      return s.replace(PLACEHOLDER_RE, (match, inner) => resolvePlaceholder(inner, variables));
    }
    function interpolateDeep(val, variables) {
      if (typeof val === "string") {
        return { ok: true, value: interpolateString(val, variables) };
      }
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const o = val;
        const out = {};
        for (const k of Object.keys(o)) {
          if (k === "password" || k === "devPassword" || k === "assignToVar" || k === "output" || k === "variablePath") {
            out[k] = o[k];
            continue;
          }
          const r = interpolateDeep(o[k], variables);
          out[k] = r.value;
        }
        return { ok: true, value: out };
      }
      if (Array.isArray(val)) {
        const out = [];
        for (let i = 0; i < val.length; i++) {
          const r = interpolateDeep(val[i], variables);
          out.push(r.value);
        }
        return { ok: true, value: out };
      }
      return { ok: true, value: val };
    }
    function resolveStepWithVariables(step, variables) {
      if (!step || typeof step !== "object") {
        return { ok: true, step };
      }
      try {
        const clone = JSON.parse(JSON.stringify(step));
        const r = interpolateDeep(clone, variables);
        return { ok: true, step: (
          /** @type {object} */
          r.value
        ) };
      } catch (e) {
        return { ok: false, error: errorMessage(e) || "Failed to resolve variables in step" };
      }
    }
    module2.exports = {
      isValidOutputName,
      getAssignToVarName,
      validateOutputFields,
      resolveStepWithVariables,
      raleCommandSupportsAssignToVar,
      parseVariableDotPath,
      resolveVariableDotPath,
      valueToWaitStringForCompare
    };
  }
});

// ../roku-dev-studio-api/dist/lib/rale-node-field-compare.js
var require_rale_node_field_compare = __commonJS({
  "../roku-dev-studio-api/dist/lib/rale-node-field-compare.js"(exports2, module2) {
    "use strict";
    var RALE_OBJECT_PLACEHOLDER = "{object}";
    function normalizeFieldType(item) {
      if (!item || typeof item !== "object") return "";
      const o = item;
      const ft = o.fieldType ?? o.fieldtype;
      return ft != null ? String(ft).toLowerCase() : "";
    }
    function normalizeBsType(item) {
      if (!item || typeof item !== "object") return "";
      const o = item;
      return o.type != null ? String(o.type) : "";
    }
    function looksLikeIntegerString(s) {
      return /^-?\d+$/.test(String(s).trim());
    }
    function looksLikeFloatString(s) {
      return /^-?\d+(\.\d+)?$/.test(String(s).trim()) || /^-?\d*\.\d+$/.test(String(s).trim());
    }
    function coerceByFieldType(valueStr, fieldType) {
      if (!fieldType) return void 0;
      switch (fieldType) {
        case "boolean":
          if (valueStr === "true") return true;
          if (valueStr === "false") return false;
          return void 0;
        case "integer":
        case "color":
          if (!looksLikeIntegerString(valueStr)) return void 0;
          return Number.parseInt(valueStr, 10);
        case "float":
          if (!looksLikeFloatString(valueStr)) return void 0;
          return Number.parseFloat(valueStr);
        case "string":
          return String(valueStr);
        case "vector2d":
        case "rect2d":
        case "array":
          return void 0;
        default:
          return void 0;
      }
    }
    function coerceByBrightScriptType(valueStr, bsType) {
      switch (bsType) {
        case "roBoolean":
          if (valueStr === "true") return true;
          if (valueStr === "false") return false;
          return void 0;
        case "roInt":
          if (!looksLikeIntegerString(valueStr)) return void 0;
          return Number.parseInt(valueStr, 10);
        case "roFloat":
          if (!looksLikeFloatString(valueStr)) return void 0;
          return Number.parseFloat(valueStr);
        case "roString":
          return String(valueStr);
        case "roInvalid":
          return null;
        default:
          return void 0;
      }
    }
    function flattenFieldListValue(fieldEntry) {
      if (fieldEntry === null || fieldEntry === void 0) {
        return fieldEntry;
      }
      if (typeof fieldEntry !== "object" || Array.isArray(fieldEntry)) {
        return fieldEntry;
      }
      const fe = fieldEntry;
      if (fe.item === void 0) {
        return fieldEntry;
      }
      const item = fe.item;
      if (!item || typeof item !== "object") {
        return fieldEntry;
      }
      const it = item;
      const valueStr = it.value != null ? String(it.value) : "";
      const fieldType = normalizeFieldType(it);
      const bsType = normalizeBsType(it);
      if (valueStr === RALE_OBJECT_PLACEHOLDER) {
        return RALE_OBJECT_PLACEHOLDER;
      }
      if (bsType === "roInvalid") {
        return null;
      }
      if (fieldType === "node" || bsType === "roSGNode") {
        return valueStr === "" ? null : RALE_OBJECT_PLACEHOLDER;
      }
      const byFt = coerceByFieldType(valueStr, fieldType);
      if (byFt !== void 0) {
        return byFt;
      }
      const byBs = coerceByBrightScriptType(valueStr, bsType);
      if (byBs !== void 0) {
        return byBs;
      }
      return fieldEntry;
    }
    function valueToWaitString(v) {
      if (v === null || v === void 0) return "";
      if (typeof v === "string") return v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    function evaluateNodeFieldWaitPredicate(actual, expected, operator, caseInsensitive) {
      const a = caseInsensitive ? actual.toLowerCase() : actual;
      const e = caseInsensitive ? expected.toLowerCase() : expected;
      switch (operator) {
        case "is":
          return a === e;
        case "isNot":
          return a !== e;
        case "hasAnyValue":
          return actual.length > 0;
        case "hasNoValue":
          return actual.length === 0;
        case "contains":
          return a.includes(e);
        case "doesNotContain":
          return !a.includes(e);
        case "beginsWith":
          return a.startsWith(e);
        case "endsWith":
          return a.endsWith(e);
        default:
          return false;
      }
    }
    function getFieldStringFromGetNodeByIdData(data, fieldName) {
      if (!fieldName || typeof fieldName !== "string") {
        return { ready: false, reason: "invalid_field_name" };
      }
      if (!data || typeof data !== "object") {
        return { ready: false, reason: "no_data" };
      }
      const d = data;
      if (d.error && typeof d.error === "object" && d.error !== null && typeof d.error.message === "string") {
        return { ready: false, reason: "rale_error" };
      }
      let response = null;
      if (d.command === "getNodeById" && d.response && typeof d.response === "object") {
        response = d.response;
      } else if (d.fieldlist || d.item) {
        response = d;
      } else {
        return { ready: false, reason: "no_node" };
      }
      const flRaw = response.fieldlist ?? response.fieldList;
      if (!flRaw || typeof flRaw !== "object" || Array.isArray(flRaw)) {
        return { ready: false, reason: "no_fieldlist" };
      }
      const fieldlist = flRaw;
      if (!Object.prototype.hasOwnProperty.call(fieldlist, fieldName)) {
        return { ready: false, reason: "no_field" };
      }
      const flat = flattenFieldListValue(fieldlist[fieldName]);
      return { ready: true, actualStr: valueToWaitString(flat) };
    }
    module2.exports = {
      valueToWaitString,
      evaluateNodeFieldWaitPredicate,
      getFieldStringFromGetNodeByIdData
    };
  }
});

// ../roku-dev-studio-api/dist/lib/action-script-if-eval.js
var require_action_script_if_eval = __commonJS({
  "../roku-dev-studio-api/dist/lib/action-script-if-eval.js"(exports2, module2) {
    "use strict";
    var { errorMessage } = require_err_util();
    var {
      parseMediaPlayerXml,
      evaluateWaitCheck,
      resolveMediaPlayerWaitExpectedState
    } = require_action_script_wait_core();
    var {
      resolveVariableDotPath,
      valueToWaitStringForCompare,
      parseVariableDotPath
    } = require_action_script_variables();
    function trunc(s, max) {
      if (s.length <= max) return s;
      return s.slice(0, Math.max(0, max - 1)) + "\u2026";
    }
    var {
      valueToWaitString,
      evaluateNodeFieldWaitPredicate,
      getFieldStringFromGetNodeByIdData
    } = require_rale_node_field_compare();
    var {
      RALE_NODE_FIELD_OPERATORS,
      OPS_NEED_VALUE
    } = require_action_script_node_field_constants();
    var ACTIVE_APP_ATTRIBUTES = ["id", "type", "version", "name"];
    function parseActiveAppXml(xmlText) {
      const str = xmlText == null ? "" : typeof xmlText === "string" ? xmlText : String(xmlText);
      const empty = { found: false, id: "", type: "", version: "", name: "" };
      if (!str.trim()) return empty;
      const open = str.match(/<app\b([^>]*)>/i);
      if (!open) return empty;
      const attrPart = open[1];
      function grab(name2) {
        const re = new RegExp(`\\b${name2.replace(/-/g, "\\-")}\\s*=\\s*["']([^"']*)["']`, "i");
        const m = attrPart.match(re);
        return m ? m[1].trim() : "";
      }
      const inner = str.match(/<app\b[^>]*>([^<]*)<\/app>/is);
      const name = inner ? inner[1].trim() : "";
      return {
        found: true,
        id: grab("id"),
        type: grab("type"),
        version: grab("version"),
        name
      };
    }
    function getActiveAppAttributeValue(parsed, attribute) {
      const a = attribute != null ? String(attribute).trim() : "";
      if (a === "id" || a === "type" || a === "version" || a === "name") {
        const v = parsed[a];
        return v != null ? String(v) : "";
      }
      return "";
    }
    function normalizePathArg(pathVal) {
      if (Array.isArray(pathVal)) {
        return { ok: true, path: pathVal };
      }
      if (pathVal == null || pathVal === "") {
        return { ok: true, path: [] };
      }
      try {
        const parsed = JSON.parse(String(pathVal));
        if (!Array.isArray(parsed)) {
          return { ok: false, error: 'Path must be a JSON array (e.g. [] or [{"child":0}])' };
        }
        return { ok: true, path: parsed };
      } catch (e) {
        return { ok: false, error: "Invalid path JSON: " + errorMessage(e) };
      }
    }
    function evaluateVariablesPredicate(actual, expectedRaw, operator, caseInsensitive) {
      const actualStr = valueToWaitStringForCompare(actual);
      const expectedStr = valueToWaitStringForCompare(expectedRaw);
      return evaluateNodeFieldWaitPredicate(actualStr, expectedStr, operator, caseInsensitive);
    }
    async function evaluateIfConditionOnce(condition, variables, api, raleCommand) {
      if (!condition || typeof condition !== "object") {
        return { ok: false, error: "if step requires condition object" };
      }
      const cond = condition;
      const source = cond.source;
      if (source === "media-player") {
        const expectedState = resolveMediaPlayerWaitExpectedState(cond);
        const check = expectedState !== "" ? `state == "${expectedState.replace(/"/g, '\\"')}"` : cond.check && typeof cond.check === "string" ? cond.check : "state == 'stop'";
        const res = await api.query("/query/media-player");
        if (!res || !res.success || res.data == null) {
          return { ok: false, error: res && res.error ? String(res.error) : "media-player query failed" };
        }
        const xmlRaw = typeof res.data === "string" ? res.data : String(res.data);
        const data = parseMediaPlayerXml(xmlRaw);
        const actualDisplay = data.state != null && String(data.state) !== "" ? String(data.state) : "(none)";
        const want = expectedState !== "" ? `state "${expectedState}"` : `check ${check}`;
        let branchThen;
        if (expectedState !== "" && data.state != null && String(data.state).toLowerCase() === expectedState) {
          branchThen = true;
        } else {
          branchThen = !!evaluateWaitCheck(check, data);
        }
        const runtimeSummary = `If \xB7 media-player \xB7 want ${want} \xB7 actual ${actualDisplay} \xB7 took ${branchThen ? "then" : "else"}`;
        return { ok: true, branchThen, runtimeSummary };
      }
      if (source === "active-app") {
        const attribute = cond.attribute != null ? String(cond.attribute).trim() : "";
        const operator = String(cond.operator || "");
        const valueRaw = cond.value;
        const valueStr = valueRaw != null ? valueToWaitString(valueRaw) : "";
        const caseInsensitive = !!cond.caseInsensitive;
        if (!attribute || !ACTIVE_APP_ATTRIBUTES.includes(attribute)) {
          return { ok: false, error: "Invalid active-app condition (attribute)" };
        }
        if (!RALE_NODE_FIELD_OPERATORS.includes(operator)) {
          return { ok: false, error: "Invalid active-app condition (operator)" };
        }
        if (OPS_NEED_VALUE.has(operator) && (valueRaw === void 0 || valueRaw === null)) {
          return { ok: false, error: `condition.value is required for operator "${operator}"` };
        }
        const res = await api.query("/query/active-app");
        if (!res || !res.success || res.data == null) {
          return { ok: false, error: res && res.error ? String(res.error) : "active-app query failed" };
        }
        const xmlRaw = typeof res.data === "string" ? res.data : String(res.data);
        const parsed = parseActiveAppXml(xmlRaw);
        const actualStr = getActiveAppAttributeValue(parsed, attribute);
        if (!parsed.found) {
          const runtimeSummary2 = `If \xB7 active-app \xB7 no <app> in response \xB7 took else`;
          return { ok: true, branchThen: false, runtimeSummary: runtimeSummary2 };
        }
        const pass = evaluateNodeFieldWaitPredicate(actualStr, valueStr, operator, caseInsensitive);
        const actualDisp = trunc(actualStr, 72);
        const valDisp = valueStr ? trunc(valueStr, 40) : "";
        const opTail = OPS_NEED_VALUE.has(operator) && valDisp ? ` "${valDisp}"` : "";
        const runtimeSummary = `If \xB7 active-app \xB7 ${attribute} \xB7 actual "${actualDisp}" \xB7 ${operator}${opTail} \xB7 took ${pass ? "then" : "else"}`;
        return { ok: true, branchThen: !!pass, runtimeSummary };
      }
      if (source === "rale-node-field") {
        const pathNorm = normalizePathArg(cond.path);
        if (!pathNorm.ok) {
          return { ok: false, error: pathNorm.error || "Invalid path" };
        }
        const id = String(cond.id != null ? cond.id : "").trim();
        const field = String(cond.field != null ? cond.field : "").trim();
        const operator = String(cond.operator || "");
        const valueRaw = cond.value;
        const valueStr = valueRaw != null ? valueToWaitString(valueRaw) : "";
        const caseInsensitive = !!cond.caseInsensitive;
        if (!id || !field || !RALE_NODE_FIELD_OPERATORS.includes(operator)) {
          return { ok: false, error: "Invalid rale-node-field condition" };
        }
        if (typeof raleCommand !== "function") {
          return { ok: false, error: "App Connector not available for if (RALE Node)" };
        }
        const res = await raleCommand("getNodeById", { path: pathNorm.path, id });
        if (!res || !res.success || res.data == null) {
          return { ok: false, error: res && res.error ? String(res.error) : "getNodeById failed" };
        }
        const got = getFieldStringFromGetNodeByIdData(res.data, field);
        if (!got.ready) {
          const runtimeSummary2 = `If \xB7 RALE \xB7 ${id}.${field} \xB7 actual unavailable (${got.reason}) \xB7 took else`;
          return { ok: true, branchThen: false, runtimeSummary: runtimeSummary2 };
        }
        const pass = evaluateNodeFieldWaitPredicate(got.actualStr, valueStr, operator, caseInsensitive);
        const actualDisp = trunc(got.actualStr, 72);
        const valDisp = valueStr ? trunc(valueStr, 40) : "";
        const opTail = OPS_NEED_VALUE.has(operator) && valDisp ? ` "${valDisp}"` : "";
        const runtimeSummary = `If \xB7 RALE \xB7 ${id}.${field} \xB7 actual "${actualDisp}" \xB7 ${operator}${opTail} \xB7 took ${pass ? "then" : "else"}`;
        return { ok: true, branchThen: !!pass, runtimeSummary };
      }
      if (source === "variables") {
        const pathStr = cond.variablePath != null ? String(cond.variablePath).trim() : "";
        const operator = String(cond.operator || "");
        if (!pathStr || !RALE_NODE_FIELD_OPERATORS.includes(operator)) {
          return { ok: false, error: "Invalid variables condition" };
        }
        if (OPS_NEED_VALUE.has(operator) && (cond.value === void 0 || cond.value === null)) {
          return { ok: false, error: `condition.value is required for operator "${operator}"` };
        }
        const actual = resolveVariableDotPath(variables, pathStr);
        const pass = evaluateVariablesPredicate(actual, cond.value, operator, !!cond.caseInsensitive);
        const actualDisp = trunc(valueToWaitStringForCompare(actual), 48);
        const expDisp = OPS_NEED_VALUE.has(operator) ? trunc(valueToWaitStringForCompare(cond.value), 40) : "";
        const opTail = expDisp ? ` ${expDisp}` : "";
        const ci = cond.caseInsensitive ? " (i)" : "";
        const runtimeSummary = `If \xB7 $${pathStr} \xB7 actual ${actualDisp}${ci} \xB7 ${operator}${opTail} \xB7 took ${pass ? "then" : "else"}`;
        return { ok: true, branchThen: !!pass, runtimeSummary };
      }
      return { ok: false, error: `Unknown if condition source: ${source}` };
    }
    function validateRaleStyleOperatorAndValue(cond, valueKey = "value") {
      const op = cond.operator;
      if (typeof op !== "string" || !RALE_NODE_FIELD_OPERATORS.includes(op)) {
        return { ok: false, error: `condition.operator must be one of: ${RALE_NODE_FIELD_OPERATORS.join(", ")}` };
      }
      if (OPS_NEED_VALUE.has(op)) {
        const v = cond[valueKey];
        if (v === void 0 || v === null) {
          return { ok: false, error: `condition.${valueKey} is required for operator "${op}"` };
        }
      }
      return { ok: true };
    }
    function validateIfConditionShape(cond, mediaPlayerStateValues) {
      if (!cond || typeof cond !== "object") {
        return { ok: false, error: "condition object required" };
      }
      const source = cond.source;
      if (source === "media-player") {
        const hasCheck = cond.check && typeof cond.check === "string";
        const resolved = resolveMediaPlayerWaitExpectedState(cond);
        const hasState = resolved && mediaPlayerStateValues.includes(resolved);
        if (!hasState && !hasCheck) {
          return {
            ok: false,
            error: `condition.state must be one of: ${mediaPlayerStateValues.join(", ")} (or use condition.check, or field "state" with operator "equals" and a valid value)`
          };
        }
        return { ok: true };
      }
      if (source === "active-app") {
        const attr = cond.attribute != null ? String(cond.attribute).trim() : "";
        if (!attr || !ACTIVE_APP_ATTRIBUTES.includes(attr)) {
          return {
            ok: false,
            error: `condition.attribute must be one of: ${ACTIVE_APP_ATTRIBUTES.join(", ")}`
          };
        }
        return validateRaleStyleOperatorAndValue(cond);
      }
      if (source === "rale-node-field") {
        const pathNorm = normalizePathArg(cond.path);
        if (!pathNorm.ok) {
          return { ok: false, error: pathNorm.error || "Invalid path" };
        }
        const id = cond.id;
        if (id == null || String(id).trim() === "") {
          return { ok: false, error: "condition.id is required" };
        }
        const field = cond.field;
        if (field == null || String(field).trim() === "") {
          return { ok: false, error: "condition.field is required" };
        }
        return validateRaleStyleOperatorAndValue(cond);
      }
      if (source === "variables") {
        const pathStr = cond.variablePath != null ? String(cond.variablePath).trim() : "";
        if (!pathStr) {
          return { ok: false, error: "condition.variablePath is required" };
        }
        if (!parseVariableDotPath(pathStr)) {
          return { ok: false, error: "condition.variablePath must be root or root.segments (e.g. data.items.0.id)" };
        }
        return validateRaleStyleOperatorAndValue(cond);
      }
      return {
        ok: false,
        error: "condition.source must be media-player, active-app, rale-node-field, or variables"
      };
    }
    module2.exports = {
      evaluateIfConditionOnce,
      validateIfConditionShape,
      normalizePathArg,
      RALE_NODE_FIELD_OPERATORS,
      OPS_NEED_VALUE,
      ACTIVE_APP_ATTRIBUTES,
      parseActiveAppXml,
      getActiveAppAttributeValue
    };
  }
});

// ../roku-dev-studio-api/dist/lib/rale-command-args.js
var require_rale_command_args = __commonJS({
  "../roku-dev-studio-api/dist/lib/rale-command-args.js"(exports2, module2) {
    "use strict";
    var { normalizePathArg } = require_action_script_if_eval();
    var RALE_BUILTIN_COMMAND_DEFS = Object.freeze({
      getNodeById: { command: "getNodeById", requiresPath: true },
      getNodeByName: { command: "getNodeByName", requiresPath: true },
      getRegistrySections: { command: "getRegistrySections" },
      clearRegistry: { command: "clearRegistry" },
      addRegistrySection: { command: "addRegistrySection" },
      removeRegistrySection: { command: "removeRegistrySection" },
      addRegistryField: { command: "addRegistryField" },
      removeRegistryField: { command: "removeRegistryField" },
      editRegistryField: { command: "editRegistryField" }
    });
    function isBlank(s) {
      return s == null || String(s).trim() === "";
    }
    function validateAddRegistrySection(name, section) {
      if (isBlank(name)) return "Section name is required.";
      if (section == null || typeof section !== "object" || Array.isArray(section)) {
        return "Section must be a JSON object (not an array).";
      }
      const sec = section;
      for (const k of Object.keys(sec)) {
        if (isBlank(k)) {
          return "Section object keys cannot be empty or whitespace-only.";
        }
        const v = sec[k];
        if (typeof v !== "string") {
          return `Each value must be a string (roRegistry stores strings). Key "${k}" is not a string \u2014 use quoted strings in JSON.`;
        }
      }
      return null;
    }
    function validateAndNormalizeRaleCommandArgs(command, args) {
      if (typeof command !== "string" || command.trim() === "") {
        return { ok: false, error: "raleCommand requires non-empty command" };
      }
      const def = RALE_BUILTIN_COMMAND_DEFS[command];
      if (!def) {
        return { ok: false, error: `Unknown RALE command: "${command}"` };
      }
      const raw = args && typeof args === "object" && !Array.isArray(args) ? args : {};
      if (def.requiresPath) {
        const pathNorm = normalizePathArg(raw.path);
        if (!pathNorm.ok) {
          return { ok: false, error: pathNorm.error || "Invalid path" };
        }
        if (command === "getNodeById") {
          const id = raw.id;
          if (id == null || String(id).trim() === "") {
            return { ok: false, error: "getNodeById args.id is required" };
          }
          return { ok: true, args: { path: pathNorm.path, id: String(id).trim() } };
        }
        if (command === "getNodeByName") {
          const name = raw.name;
          if (name == null || String(name).trim() === "") {
            return { ok: false, error: "getNodeByName args.name is required" };
          }
          return { ok: true, args: { path: pathNorm.path, name: String(name).trim() } };
        }
      }
      if (command === "getRegistrySections" || command === "clearRegistry") {
        return { ok: true, args: {} };
      }
      if (command === "addRegistrySection") {
        const name = raw.name;
        let section = raw.section;
        if (name == null || String(name).trim() === "") {
          return { ok: false, error: "addRegistrySection args.name is required" };
        }
        if (section == null) {
          return { ok: false, error: "addRegistrySection args.section is required" };
        }
        if (typeof section === "string") {
          try {
            section = JSON.parse(section);
          } catch {
            return { ok: false, error: "addRegistrySection args.section must be a JSON object" };
          }
        }
        if (!section || typeof section !== "object" || Array.isArray(section)) {
          return { ok: false, error: "addRegistrySection args.section must be an object" };
        }
        const sectionShapeErr = validateAddRegistrySection(name, section);
        if (sectionShapeErr) return { ok: false, error: sectionShapeErr };
        return {
          ok: true,
          args: {
            name: String(name).trim(),
            section
          }
        };
      }
      if (command === "removeRegistrySection") {
        const name = raw.name;
        if (name == null || String(name).trim() === "") {
          return { ok: false, error: "removeRegistrySection args.name is required" };
        }
        return { ok: true, args: { name: String(name).trim() } };
      }
      if (command === "addRegistryField") {
        const sectionName = raw.sectionName;
        const key = raw.key;
        const value = raw.value;
        if (sectionName == null || String(sectionName).trim() === "") {
          return { ok: false, error: "addRegistryField args.sectionName is required" };
        }
        if (key == null || String(key).trim() === "") {
          return { ok: false, error: "addRegistryField args.key is required" };
        }
        return {
          ok: true,
          args: {
            sectionName: String(sectionName).trim(),
            key: String(key).trim(),
            value: value == null ? "" : String(value)
          }
        };
      }
      if (command === "removeRegistryField") {
        const sectionName = raw.sectionName;
        const key = raw.key;
        if (sectionName == null || String(sectionName).trim() === "") {
          return { ok: false, error: "removeRegistryField args.sectionName is required" };
        }
        if (key == null || String(key).trim() === "") {
          return { ok: false, error: "removeRegistryField args.key is required" };
        }
        return {
          ok: true,
          args: { sectionName: String(sectionName).trim(), key: String(key).trim() }
        };
      }
      if (command === "editRegistryField") {
        const sectionName = raw.sectionName;
        const key = raw.key;
        const newKey = raw.newKey;
        const newValue = raw.newValue;
        if (sectionName == null || String(sectionName).trim() === "") {
          return { ok: false, error: "editRegistryField args.sectionName is required" };
        }
        if (key == null || String(key).trim() === "") {
          return { ok: false, error: "editRegistryField args.key is required" };
        }
        if (newKey == null || String(newKey).trim() === "") {
          return { ok: false, error: "editRegistryField args.newKey is required" };
        }
        return {
          ok: true,
          args: {
            sectionName: String(sectionName).trim(),
            key: String(key).trim(),
            newKey: String(newKey).trim(),
            newValue: newValue == null ? "" : String(newValue)
          }
        };
      }
      return { ok: false, error: `Unhandled RALE command: ${command}` };
    }
    module2.exports = {
      RALE_BUILTIN_COMMAND_DEFS,
      validateAndNormalizeRaleCommandArgs,
      validateAddRegistrySection
    };
  }
});

// ../roku-dev-studio-api/dist/lib/validate-action-script.js
var require_validate_action_script = __commonJS({
  "../roku-dev-studio-api/dist/lib/validate-action-script.js"(exports2, module2) {
    "use strict";
    var {
      STEP_SCHEMA,
      KEYPRESS_OPTIONS,
      WAIT_SOURCES,
      IF_SOURCES,
      MEDIA_PLAYER_STATES,
      ACTIVE_APP_IF_ATTRIBUTES,
      NODE_FIELD_OPERATOR_DEFS,
      DEVICE_PERFORMANCE_CHART_IDS,
      RALE_BUILTINS,
      SCRIPT_VERSIONS
    } = require_catalogs();
    var { resolveMediaPlayerWaitExpectedState } = require_action_script_wait_core();
    var {
      validateIfConditionShape,
      normalizePathArg,
      RALE_NODE_FIELD_OPERATORS,
      OPS_NEED_VALUE
    } = require_action_script_if_eval();
    var {
      validateOutputFields,
      getAssignToVarName,
      parseVariableDotPath
    } = require_action_script_variables();
    var { raleCommandSupportsAssignToVar } = require_rale_command_assign_vars();
    var { validateAndNormalizeRaleCommandArgs } = require_rale_command_args();
    var STEP_TYPE_NAMES = Object.keys(STEP_SCHEMA);
    var RALE_BUILTIN_NAMES = new Set(RALE_BUILTINS.map((b) => b.command));
    var MEDIA_PLAYER_STATE_VALUES = MEDIA_PLAYER_STATES.map((s) => s.value);
    var ACTIVE_APP_IF_VALUES = new Set(ACTIVE_APP_IF_ATTRIBUTES.map((a) => a.value));
    var NODE_FIELD_OPERATOR_REQUIRES_VALUE = new Map(
      NODE_FIELD_OPERATOR_DEFS.map((o) => [o.operator, !!o.requiresValue])
    );
    function isObject(v) {
      return v != null && typeof v === "object" && !Array.isArray(v);
    }
    function queryEndpointToTelnetCommand(endpoint) {
      if (typeof endpoint !== "string") return null;
      const e = endpoint.trim();
      if (e === "/query/plugins") return "plugins";
      if (e === "telnet:plugins") return "plugins";
      if (e === "telnet:free") return "free";
      return null;
    }
    function pushError(errors, err) {
      errors.push(err);
    }
    function validateCondition(cond, path2, context, errors, stepIndex) {
      if (!isObject(cond)) {
        pushError(errors, {
          path: path2,
          code: "condition_not_object",
          message: `${context}.condition must be an object`,
          stepIndex
        });
        return;
      }
      const sourceList = context === "wait" ? WAIT_SOURCES : IF_SOURCES;
      const source = cond.source;
      if (typeof source !== "string" || !sourceList.includes(source)) {
        pushError(errors, {
          path: `${path2}.source`,
          code: "invalid_condition_source",
          message: `Unknown condition source for ${context}`,
          expected: [...sourceList],
          stepIndex
        });
        return;
      }
      if (source === "media-player") {
        const resolved = resolveMediaPlayerWaitExpectedState(cond);
        if (resolved && !MEDIA_PLAYER_STATE_VALUES.includes(resolved)) {
          pushError(errors, {
            path: `${path2}.state`,
            code: "invalid_media_state",
            message: `Unknown media-player state "${resolved}"`,
            expected: [...MEDIA_PLAYER_STATE_VALUES],
            stepIndex
          });
        }
        const okState = resolved !== "" && MEDIA_PLAYER_STATE_VALUES.includes(resolved);
        const okCheck = typeof cond.check === "string" && cond.check.trim() !== "";
        if (!okState && !okCheck) {
          pushError(errors, {
            path: path2,
            code: "media_player_condition_incomplete",
            message: `media-player ${context} needs condition.state (one of: ${MEDIA_PLAYER_STATE_VALUES.join(", ")}), condition.check (string), or field "state" with operator "equals" and a valid value`,
            expected: [...MEDIA_PLAYER_STATE_VALUES],
            stepIndex
          });
        }
        return;
      }
      if (source === "active-app") {
        if (cond.attribute != null && typeof cond.attribute === "string" && !ACTIVE_APP_IF_VALUES.has(cond.attribute)) {
          pushError(errors, {
            path: `${path2}.attribute`,
            code: "invalid_active_app_attribute",
            message: `Unknown active-app attribute "${cond.attribute}"`,
            expected: [...ACTIVE_APP_IF_VALUES],
            stepIndex
          });
        }
        if (context === "if") {
          const cvr = validateIfConditionShape(cond, MEDIA_PLAYER_STATE_VALUES);
          if (!cvr.ok) {
            pushError(errors, {
              path: path2,
              code: "invalid_if_active_app_condition",
              message: cvr.error || "Invalid active-app if condition",
              stepIndex
            });
          }
        }
        return;
      }
      if (source === "rale-node-field") {
        const pathNorm = normalizePathArg(cond.path);
        if (!pathNorm.ok) {
          pushError(errors, {
            path: `${path2}.path`,
            code: "invalid_path",
            message: pathNorm.error || "rale-node-field condition requires a `path` array (use [] for root)",
            stepIndex
          });
        }
        if (typeof cond.id !== "string" || cond.id.trim() === "") {
          pushError(errors, {
            path: `${path2}.id`,
            code: "missing_id",
            message: "rale-node-field condition requires a non-empty `id`",
            stepIndex
          });
        }
        if (typeof cond.field !== "string" || cond.field.trim() === "") {
          pushError(errors, {
            path: `${path2}.field`,
            code: "missing_field",
            message: "rale-node-field condition requires a non-empty `field`",
            stepIndex
          });
        }
        const op = cond.operator;
        if (typeof op !== "string" || !NODE_FIELD_OPERATOR_REQUIRES_VALUE.has(op)) {
          pushError(errors, {
            path: `${path2}.operator`,
            code: "invalid_operator",
            message: "Unknown rale-node-field operator",
            expected: [...NODE_FIELD_OPERATOR_REQUIRES_VALUE.keys()],
            stepIndex
          });
        } else if (NODE_FIELD_OPERATOR_REQUIRES_VALUE.get(op) && cond.value == null) {
          pushError(errors, {
            path: `${path2}.value`,
            code: "missing_value",
            message: `Operator "${op}" requires a \`value\``,
            stepIndex
          });
        }
        return;
      }
      if (source === "variables") {
        if (context === "if") {
          const cvr = validateIfConditionShape(cond, MEDIA_PLAYER_STATE_VALUES);
          if (!cvr.ok) {
            pushError(errors, {
              path: path2,
              code: "invalid_variables_condition",
              message: cvr.error || "Invalid variables if condition",
              stepIndex
            });
          }
        }
        return;
      }
    }
    function validateAppFunctionParams(step, path2, errors, stepIndex, options) {
      const raw = step.functionParams;
      if (raw == null) return;
      const isArr = Array.isArray(raw);
      const isObj = !isArr && isObject(raw);
      if (!isArr && !isObj) {
        pushError(errors, {
          path: `${path2}.functionParams`,
          code: "invalid_function_params_shape",
          message: "appFunction.functionParams must be a positional array (preferred) or an object keyed by RALE param names",
          expected: ["array", "object"],
          stepIndex
        });
        return;
      }
      const raleFunctions = options.raleFunctions;
      if (!raleFunctions || !Array.isArray(raleFunctions)) return;
      const fnName = step.functionName;
      if (typeof fnName !== "string" || fnName.trim() === "") return;
      const fn = raleFunctions.find((f) => f && f.name === fnName);
      if (!fn) {
        pushError(errors, {
          path: `${path2}.functionName`,
          code: "unknown_app_function",
          message: `App function "${fnName}" was not found in list_app_connector_functions for the running channel`,
          stepIndex
        });
        return;
      }
      const declared = Array.isArray(fn.params) ? fn.params : [];
      let asArray;
      if (isArr) {
        asArray = raw;
      } else {
        const o = raw;
        asArray = declared.map((p) => p && typeof p.name === "string" ? o[p.name] : void 0);
      }
      if (asArray.length !== declared.length) {
        pushError(errors, {
          path: `${path2}.functionParams`,
          code: "app_function_param_count_mismatch",
          message: `App function "${fnName}" expects ${declared.length} param(s), got ${asArray.length}`,
          stepIndex
        });
      }
      if (isObj) {
        const missing = declared.map((p, idx) => ({ name: p && p.name, hasValue: asArray[idx] !== void 0 })).filter((x) => !x.hasValue && typeof x.name === "string").map((x) => x.name);
        if (missing.length > 0) {
          pushError(errors, {
            path: `${path2}.functionParams`,
            code: "app_function_missing_named_params",
            message: `App function "${fnName}" missing named functionParams key(s): ${missing.join(", ")}. Prefer a positional array \u2014 see roku-dev-studio://action-script-contract.md.`,
            expected: missing,
            stepIndex
          });
        }
      }
    }
    function validateStep(step, path2, errors, counts, state, options) {
      if (!isObject(step)) {
        pushError(errors, {
          path: path2,
          code: "step_not_object",
          message: "Each step must be an object",
          stepIndex: state.preorderIndex
        });
        state.preorderIndex++;
        return;
      }
      const stepIndex = state.preorderIndex++;
      const type = step.type;
      if (typeof type !== "string" || !(type in STEP_SCHEMA)) {
        pushError(errors, {
          path: `${path2}.type`,
          code: "unknown_step_type",
          message: `Unknown step type "${String(type)}"`,
          expected: STEP_TYPE_NAMES,
          stepIndex
        });
        return;
      }
      counts[type] = (counts[type] || 0) + 1;
      const schema = STEP_SCHEMA[type];
      for (const required of schema.required) {
        if (required === "then" || required === "else") continue;
        if (!(required in step) || step[required] == null || step[required] === "") {
          pushError(errors, {
            path: `${path2}.${required}`,
            code: "missing_required",
            message: `Step "${type}" requires \`${required}\``,
            stepIndex
          });
        }
      }
      if (typeof step.password === "string" && step.password.length > 0) {
        pushError(errors, {
          path: `${path2}.password`,
          code: "password_in_script",
          message: "Do not embed literal `password` in generated steps. Leave it absent \u2014 the user provides it at run time.",
          stepIndex
        });
      }
      if (type === "keypress") {
        if (typeof step.key === "string" && !KEYPRESS_OPTIONS.includes(step.key)) {
          pushError(errors, {
            path: `${path2}.key`,
            code: "invalid_keypress",
            message: `Unknown ECP key "${step.key}"`,
            expected: [...KEYPRESS_OPTIONS],
            stepIndex
          });
        }
      }
      if (type === "query") {
        const ep = typeof step.endpoint === "string" ? step.endpoint.trim() : "";
        if (ep.startsWith("telnet:") && !queryEndpointToTelnetCommand(ep)) {
          pushError(errors, {
            path: `${path2}.endpoint`,
            code: "invalid_query_endpoint",
            message: `Invalid query endpoint "${ep}". Use telnet:plugins or telnet:free for dev telnet, or any /query/* path for ECP.`,
            stepIndex
          });
        }
      }
      if (type === "devicePerformance") {
        if (typeof step.chart === "string" && !DEVICE_PERFORMANCE_CHART_IDS.includes(step.chart)) {
          pushError(errors, {
            path: `${path2}.chart`,
            code: "invalid_chart_id",
            message: "Unknown devicePerformance chart",
            expected: [...DEVICE_PERFORMANCE_CHART_IDS],
            stepIndex
          });
        }
      }
      if (type === "raleCommand") {
        if (typeof step.command === "string" && !RALE_BUILTIN_NAMES.has(step.command)) {
          pushError(errors, {
            path: `${path2}.command`,
            code: "unknown_rale_command",
            message: `Unknown RALE built-in "${step.command}"`,
            expected: [...RALE_BUILTIN_NAMES],
            stepIndex
          });
        } else if (typeof step.command === "string") {
          if (step.args != null && !isObject(step.args)) {
            pushError(errors, {
              path: `${path2}.args`,
              code: "rale_args_not_object",
              message: "raleCommand.args must be an object",
              stepIndex
            });
          } else {
            const vr = validateAndNormalizeRaleCommandArgs(
              step.command,
              step.args == null ? {} : step.args
            );
            if (!vr.ok) {
              pushError(errors, {
                path: `${path2}.args`,
                code: "invalid_rale_args",
                message: vr.error || "Invalid raleCommand args",
                stepIndex
              });
            }
          }
        } else if (step.args != null && !isObject(step.args)) {
          pushError(errors, {
            path: `${path2}.args`,
            code: "rale_args_not_object",
            message: "raleCommand.args must be an object",
            stepIndex
          });
        }
      }
      if (type === "appFunction") {
        validateAppFunctionParams(step, path2, errors, stepIndex, options);
      }
      if (type === "wait") {
        if (step.condition != null) {
          validateCondition(step.condition, `${path2}.condition`, "wait", errors, stepIndex);
        }
        const hasDelay = typeof step.delayMs === "number" && step.delayMs >= 0;
        const hasCondition = step.condition != null;
        if (!hasDelay && !hasCondition) {
          pushError(errors, {
            path: path2,
            code: "wait_needs_signal",
            message: "wait requires either `delayMs` (number, fixed) or `condition` (until)",
            stepIndex
          });
        }
      }
      if (type === "if") {
        if (state.scriptVersion !== "2") {
          pushError(errors, {
            path: `${path2}.type`,
            code: "version_required_for_if",
            message: '`if` step requires `script.version` "2"',
            expected: "2",
            stepIndex
          });
        }
        if (step.condition != null) {
          validateCondition(step.condition, `${path2}.condition`, "if", errors, stepIndex);
          const cond = step.condition;
          if (cond.source === "variables") {
            const pathStr = typeof cond.variablePath === "string" ? cond.variablePath.trim() : typeof cond.path === "string" ? cond.path.trim() : "";
            const parts = pathStr ? parseVariableDotPath(pathStr) : null;
            if (parts && parts.length > 0 && !state.assignedRoots.has(parts[0])) {
              pushError(errors, {
                path: `${path2}.condition.variablePath`,
                code: "variable_root_not_assigned",
                message: `if (variables): root "${parts[0]}" must be assigned on an earlier step (assignToVar)`,
                stepIndex
              });
            }
          }
        } else {
          pushError(errors, {
            path: `${path2}.condition`,
            code: "missing_condition",
            message: "if requires a condition object",
            stepIndex
          });
        }
        if (!Array.isArray(step.then)) {
          pushError(errors, {
            path: `${path2}.then`,
            code: "missing_branch",
            message: "if.then must be an array of steps",
            stepIndex
          });
        } else {
          step.then.forEach(
            (s, i) => validateStep(s, `${path2}.then[${i}]`, errors, counts, state, options)
          );
        }
        if (!Array.isArray(step.else)) {
          pushError(errors, {
            path: `${path2}.else`,
            code: "missing_branch",
            message: "if.else must be an array of steps (use [] for none)",
            stepIndex
          });
        } else {
          step.else.forEach(
            (s, i) => validateStep(s, `${path2}.else[${i}]`, errors, counts, state, options)
          );
        }
        return;
      }
      const assignName = getAssignToVarName(step);
      if (assignName) {
        if (type === "appFunction") {
          state.assignedRoots.add(assignName);
        } else if (type === "raleCommand" && raleCommandSupportsAssignToVar(step.command)) {
          state.assignedRoots.add(assignName);
        }
      }
    }
    function validateScript2(input, options) {
      const errors = [];
      const counts = {};
      const opts = options || {};
      if (!isObject(input)) {
        return {
          ok: false,
          errors: [
            {
              path: "",
              code: "script_not_object",
              message: "Script must be a JSON object with a `steps` array"
            }
          ],
          stepCounts: counts
        };
      }
      if (input.version != null) {
        if (typeof input.version !== "string" || !SCRIPT_VERSIONS.includes(input.version)) {
          pushError(errors, {
            path: "version",
            code: "invalid_version",
            message: `Script version must be one of ${SCRIPT_VERSIONS.join(", ")}`,
            expected: [...SCRIPT_VERSIONS]
          });
        }
      }
      if (!Array.isArray(input.steps)) {
        pushError(errors, {
          path: "steps",
          code: "missing_steps",
          message: "Script must have a `steps` array"
        });
        return { ok: false, errors, stepCounts: counts };
      }
      if (typeof input.devPassword === "string" && input.devPassword.length > 0) {
        pushError(errors, {
          path: "devPassword",
          code: "password_in_script",
          message: "Do not embed devPassword in generated scripts. Leave it absent; the user provides it in Builder before running."
        });
      }
      const scriptVersion = input.version != null && typeof input.version === "string" && input.version.trim() === "2" ? "2" : "1";
      const state = {
        preorderIndex: 0,
        assignedRoots: /* @__PURE__ */ new Set(),
        scriptVersion
      };
      input.steps.forEach((s, i) => validateStep(s, `steps[${i}]`, errors, counts, state, opts));
      for (const oe of validateOutputFields(input)) {
        pushError(errors, {
          path: oe.stepIndex != null ? `steps[${oe.stepIndex}].assignToVar` : "output",
          code: "invalid_output_field",
          message: oe.message,
          stepIndex: oe.stepIndex
        });
      }
      if ((counts.if || 0) > 0 && input.version !== "2") {
        pushError(errors, {
          path: "version",
          code: "version_required_for_if",
          message: 'Scripts that contain `if` steps must declare `"version": "2"`',
          expected: "2"
        });
      }
      return { ok: errors.length === 0, errors, stepCounts: counts };
    }
    module2.exports = {
      validateScript: validateScript2,
      // Re-exported for callers that want the same telnet-endpoint helper without
      // importing renderer code.
      queryEndpointToTelnetCommand
    };
  }
});

// ../roku-dev-studio-api/dist/lib/validate-input.js
var require_validate_input = __commonJS({
  "../roku-dev-studio-api/dist/lib/validate-input.js"(exports2, module2) {
    "use strict";
    function isValidIp(ip) {
      if (typeof ip !== "string" || !ip.trim()) return false;
      const trimmed = ip.trim();
      const parts = trimmed.split(".");
      if (parts.length !== 4) return false;
      for (const p of parts) {
        const n = parseInt(p, 10);
        if (isNaN(n) || n < 0 || n > 255 || String(n) !== p) return false;
      }
      return true;
    }
    function validateDevPassword(password) {
      if (password == null) return { valid: false, error: "Password is required" };
      const s = String(password);
      if (s.length === 0) return { valid: false, error: "Password is required" };
      if (s.length > 128) return { valid: false, error: "Password is too long" };
      const unsafe = /["'`$\\\r\n\t;|&<>*?()[\]{}]|\.\./;
      if (unsafe.test(s)) {
        return { valid: false, error: "Password contains invalid characters" };
      }
      return { valid: true };
    }
    module2.exports = { isValidIp, validateDevPassword };
  }
});

// ../roku-dev-studio-api/dist/lib/shared-constants.js
var require_shared_constants = __commonJS({
  "../roku-dev-studio-api/dist/lib/shared-constants.js"(exports2, module2) {
    "use strict";
    var DEFAULT_RALE_PORT = 49200;
    var SCREENSHOT_DEBOUNCE_DELAY = 800;
    var SCREENSHOT_AFTER_LAUNCH_DELAY = 2500;
    var TELNET_TIMEOUT = 15e3;
    var DEFAULT_TELNET_CONNECT_TIMEOUT_MS = TELNET_TIMEOUT;
    var QUERY_TIMEOUT = 1e4;
    var CONNECTION_CHECK_INTERVAL = 3e4;
    var DEVICE_METRICS_SAMPLE_INTERVAL_MS = 2e3;
    var DEVICE_METRICS_SAMPLE_INTERVAL_MIN_MS = 500;
    var DEVICE_METRICS_CHART_HISTORY_MS = 3e5;
    var TOAST_DISPLAY_DURATION = 5e3;
    var STATUS_MESSAGE_DURATION = 5e3;
    module2.exports = {
      DEFAULT_RALE_PORT,
      SCREENSHOT_DEBOUNCE_DELAY,
      SCREENSHOT_AFTER_LAUNCH_DELAY,
      TELNET_TIMEOUT,
      DEFAULT_TELNET_CONNECT_TIMEOUT_MS,
      QUERY_TIMEOUT,
      CONNECTION_CHECK_INTERVAL,
      DEVICE_METRICS_SAMPLE_INTERVAL_MS,
      DEVICE_METRICS_SAMPLE_INTERVAL_MIN_MS,
      DEVICE_METRICS_CHART_HISTORY_MS,
      TOAST_DISPLAY_DURATION,
      STATUS_MESSAGE_DURATION
    };
  }
});

// ../roku-dev-studio-api/dist/lib/device-info.js
var require_device_info = __commonJS({
  "../roku-dev-studio-api/dist/lib/device-info.js"(exports2, module2) {
    "use strict";
    var http2 = require("http");
    var { QUERY_TIMEOUT } = require_shared_constants();
    var os2 = require("os");
    var { isValidIp } = require_validate_input();
    var DEVICE_INFO_TAGS = /* @__PURE__ */ new Set([
      "friendly-device-name",
      "user-device-name",
      "model-name",
      "model-number",
      "serial-number",
      "software-version",
      "software-build",
      "wifi-mac",
      "ethernet-mac",
      "network-type",
      "vendor-name",
      "device-id",
      "screen-size",
      "supports-suspend",
      "supports-private-listening",
      "headphones-connected",
      "power-mode",
      "developer-enabled",
      "ecp-setting-mode",
      "keyed-developer-id",
      "is-tv"
    ]);
    var TAG_REGEX = Object.fromEntries(
      [...DEVICE_INFO_TAGS].map((tag) => {
        const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return [tag, new RegExp(`<${escaped}>([^<]*)</${escaped}>`)];
      })
    );
    function parseDeviceInfo(xml) {
      const getValue = (tag) => {
        const re = TAG_REGEX[tag];
        if (!re) return "";
        const match = xml.match(re);
        return match ? match[1] : "";
      };
      return {
        deviceName: getValue("friendly-device-name") || getValue("user-device-name") || "Unknown Roku",
        modelName: getValue("model-name"),
        modelNumber: getValue("model-number"),
        serialNumber: getValue("serial-number"),
        softwareVersion: getValue("software-version"),
        softwareBuild: getValue("software-build"),
        wifiMac: getValue("wifi-mac"),
        ethernetMac: getValue("ethernet-mac"),
        networkType: getValue("network-type"),
        vendorName: getValue("vendor-name"),
        deviceId: getValue("device-id"),
        screenSize: getValue("screen-size"),
        supportsSuspend: getValue("supports-suspend"),
        supportsPrivateListening: getValue("supports-private-listening"),
        headphonesConnected: getValue("headphones-connected"),
        powerMode: getValue("power-mode"),
        developerEnabled: getValue("developer-enabled") === "true",
        ecpSettingMode: getValue("ecp-setting-mode"),
        keyedDeveloperId: getValue("keyed-developer-id"),
        isTv: getValue("is-tv") === "true"
      };
    }
    function normalizeEcpSettingMode(raw) {
      const s = raw != null && typeof raw === "string" ? raw.trim().toLowerCase() : "";
      if (s === "disabled") return "Disabled";
      if (s === "limited") return "Limited";
      if (s === "permissive") return "Permissive";
      if (s === "enabled") return "Enabled";
      return s ? raw.trim() : "Disabled";
    }
    function getDeviceId(deviceInfo) {
      if (deviceInfo && deviceInfo.serialNumber && deviceInfo.serialNumber.trim()) {
        return deviceInfo.serialNumber.trim();
      }
      return null;
    }
    function isIpOnSameSubnet(deviceIp) {
      if (!deviceIp || typeof deviceIp !== "string") return false;
      const interfaces = os2.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          if (iface.internal || iface.family !== "IPv4") continue;
          const addr = iface.address;
          const parts = addr.split(".").map(Number);
          const devParts = deviceIp.split(".").map(Number);
          if (parts.length !== 4 || devParts.length !== 4) continue;
          const prefixLen = parts[0] === 10 ? 16 : 24;
          const mask = prefixLen === 24 ? 3 : 2;
          let same = true;
          for (let i = 0; i < mask; i++) {
            if (parts[i] !== devParts[i]) {
              same = false;
              break;
            }
          }
          if (same) return true;
        }
      }
      return false;
    }
    function getDeviceInfo(ip, opts = {}) {
      if (!isValidIp(ip)) {
        return Promise.reject(new Error("Invalid device IP"));
      }
      const timeout = opts.timeout != null ? opts.timeout : QUERY_TIMEOUT;
      const includeSameSubnet = opts.includeSameSubnet !== false;
      return new Promise((resolve, reject) => {
        const options = {
          hostname: ip,
          port: 8060,
          path: "/query/device-info",
          method: "GET",
          timeout
        };
        const req = http2.request(options, (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            try {
              const info = parseDeviceInfo(data);
              info.ecpSettingMode = normalizeEcpSettingMode(info.ecpSettingMode);
              if (includeSameSubnet) {
                info.sameSubnet = isIpOnSameSubnet(ip);
              }
              resolve(info);
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Timeout"));
        });
        req.end();
      });
    }
    module2.exports = {
      parseDeviceInfo,
      normalizeEcpSettingMode,
      getDeviceId,
      isIpOnSameSubnet,
      getDeviceInfo
    };
  }
});

// ../roku-dev-studio-api/dist/lib/device-hardware-image.js
var require_device_hardware_image = __commonJS({
  "../roku-dev-studio-api/dist/lib/device-hardware-image.js"(exports2, module2) {
    "use strict";
    var http2 = require("http");
    var { isValidIp } = require_validate_input();
    var { QUERY_TIMEOUT } = require_shared_constants();
    var { errorMessage } = require_err_util();
    var ICON_LIST_BLOCK_RE = /<iconList>\s*([\s\S]*?)<\/iconList>/i;
    var FIRST_URL_IN_BLOCK_RE = /<url>\s*([^<]+?)\s*<\/url>/i;
    var DEFAULT_FALLBACK_PATH = "device-image.png";
    function normalizeIconRelativePath(raw) {
      if (!raw || typeof raw !== "string") return null;
      const t = raw.trim();
      if (!t || t.includes("..")) return null;
      if (/^https?:\/\//i.test(t)) return null;
      return t.replace(/^\/+/, "");
    }
    function parseUpnpDeviceImagePath(xml) {
      if (!xml || typeof xml !== "string") return null;
      const block = xml.match(ICON_LIST_BLOCK_RE);
      if (!block) return null;
      const urlMatch = block[1].match(FIRST_URL_IN_BLOCK_RE);
      if (!urlMatch) return null;
      return normalizeIconRelativePath(urlMatch[1]);
    }
    function encodeImagePathForUrl(rel) {
      const safe = rel || DEFAULT_FALLBACK_PATH;
      return safe.split("/").filter(Boolean).map((seg) => encodeURIComponent(seg)).join("/");
    }
    function httpGetText(ip, port, path2, timeout) {
      return new Promise((resolve, reject) => {
        const req = http2.request(
          {
            hostname: ip,
            port,
            path: path2,
            method: "GET",
            timeout
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () => {
              if (res.statusCode === 200 && data) resolve(data);
              else reject(new Error("Bad status or empty body"));
            });
          }
        );
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Timeout"));
        });
        req.end();
      });
    }
    function httpGetBuffer(ip, port, path2, timeout) {
      return new Promise((resolve, reject) => {
        const req = http2.request(
          {
            hostname: ip,
            port,
            path: path2,
            method: "GET",
            timeout
          },
          (res) => {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
              resolve({
                statusCode: res.statusCode || 0,
                buffer: Buffer.concat(chunks),
                contentType: res.headers["content-type"]
              });
            });
          }
        );
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Timeout"));
        });
        req.end();
      });
    }
    async function resolveDeviceImageRelativePath(ip, port, timeout) {
      try {
        const xml = await httpGetText(ip, port, "/", timeout);
        const parsed = parseUpnpDeviceImagePath(xml);
        if (parsed) return parsed;
      } catch (_) {
      }
      return DEFAULT_FALLBACK_PATH;
    }
    function getDeviceImageUrl(ip, opts = {}) {
      if (!isValidIp(ip)) return Promise.resolve(null);
      const port = opts.port != null ? opts.port : 8060;
      const timeout = opts.timeout != null ? opts.timeout : QUERY_TIMEOUT;
      return resolveDeviceImageRelativePath(ip, port, timeout).then((rel) => {
        const enc = encodeImagePathForUrl(rel);
        return `http://${ip}:${port}/${enc}`;
      });
    }
    async function fetchDeviceHardwareImage(ip, opts = {}) {
      if (!isValidIp(ip)) {
        return { success: false, error: "Invalid device IP" };
      }
      const port = opts.port != null ? opts.port : 8060;
      const rootTimeout = opts.rootTimeout != null ? opts.rootTimeout : QUERY_TIMEOUT;
      const imageTimeout = opts.imageTimeout != null ? opts.imageTimeout : 8e3;
      let rel;
      try {
        rel = await resolveDeviceImageRelativePath(ip, port, rootTimeout);
      } catch (e) {
        return { success: false, error: errorMessage(e) || "Failed to resolve image path" };
      }
      const path2 = "/" + encodeImagePathForUrl(rel);
      try {
        const { statusCode, buffer, contentType } = await httpGetBuffer(
          ip,
          port,
          path2,
          imageTimeout
        );
        if (statusCode === 200 && buffer.length > 0) {
          return {
            success: true,
            buffer,
            contentType: contentType && String(contentType).split(";")[0].trim() || "image/png"
          };
        }
        return {
          success: false,
          error: statusCode === 200 ? "Empty image" : `HTTP ${statusCode}`,
          statusCode: statusCode || 502
        };
      } catch (e) {
        return { success: false, error: errorMessage(e) || "Image request failed" };
      }
    }
    module2.exports = {
      parseUpnpDeviceImagePath,
      getDeviceImageUrl,
      fetchDeviceHardwareImage
    };
  }
});

// ../roku-dev-studio-api/dist/ecp.js
var require_ecp = __commonJS({
  "../roku-dev-studio-api/dist/ecp.js"(exports2, module2) {
    "use strict";
    var http2 = require("http");
    var { isValidIp } = require_validate_input();
    var { getDeviceInfo } = require_device_info();
    var { getDeviceImageUrl } = require_device_hardware_image();
    var { QUERY_TIMEOUT } = require_shared_constants();
    var { errorMessage } = require_err_util();
    function ecpErrorFromStatus(statusCode) {
      if (statusCode === 401) {
        return { error: "ECP access denied (401). Check Developer Mode and ECP settings on the device.", authFailed: true };
      }
      if (statusCode === 403) {
        return { error: "ECP not allowed (403). Device may have ECP set to Disabled or Limited.", authFailed: true };
      }
      if (statusCode >= 400 && statusCode < 500) {
        return { error: `Request failed (HTTP ${statusCode}). Check device and ECP settings.` };
      }
      if (statusCode >= 500) {
        return { error: `Device error (HTTP ${statusCode}). Try again later.` };
      }
      return { error: `Unexpected response (HTTP ${statusCode}).` };
    }
    function ecpRequest(ip, options, opts = {}) {
      if (!isValidIp(ip)) {
        return Promise.resolve({ success: false, error: "Invalid device IP" });
      }
      const port = opts.port != null ? opts.port : 8060;
      const timeout = opts.timeout != null ? opts.timeout : options.timeout != null ? options.timeout : 5e3;
      return new Promise((resolve) => {
        const reqOptions = {
          hostname: ip,
          port,
          path: options.path,
          method: options.method || "GET",
          headers: options.headers || {}
        };
        const req = http2.request(reqOptions, (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk.toString();
          });
          res.on("end", () => {
            const code = res.statusCode ?? 0;
            if (code >= 200 && code < 300) {
              resolve({ success: true, data, status: code, headers: res.headers });
            } else {
              const err = ecpErrorFromStatus(code);
              resolve({
                success: false,
                error: err.error,
                statusCode: res.statusCode,
                data,
                authFailed: err.authFailed
              });
            }
          });
        });
        req.on("error", (error) => {
          resolve({ success: false, error: error.message });
        });
        req.on("timeout", () => {
          req.destroy();
          resolve({ success: false, error: "Request timed out" });
        });
        req.setTimeout(timeout);
        if (options.body) {
          req.write(options.body);
        }
        req.end();
      });
    }
    function keypress(ip, key, opts = {}) {
      return ecpRequest(ip, {
        path: `/keypress/${key}`,
        method: "POST",
        timeout: 3e3
      }, { timeout: opts.timeout != null ? opts.timeout : 3e3, port: opts.port });
    }
    function launch(ip, appId, params, opts = {}) {
      let path2 = `/launch/${appId}`;
      if (params) {
        path2 += typeof params === "string" ? `?${params}` : "";
      }
      return ecpRequest(ip, {
        path: path2,
        method: "POST",
        timeout: 5e3
      }, { timeout: opts.timeout != null ? opts.timeout : 5e3, port: opts.port });
    }
    function query(ip, endpoint, opts = {}) {
      return ecpRequest(ip, {
        path: endpoint,
        method: "GET",
        timeout: QUERY_TIMEOUT
      }, { timeout: opts.timeout != null ? opts.timeout : QUERY_TIMEOUT, port: opts.port });
    }
    function post(ip, endpoint, opts = {}) {
      return ecpRequest(ip, {
        path: endpoint,
        method: "POST",
        timeout: 5e3
      }, { timeout: opts.timeout != null ? opts.timeout : 5e3, port: opts.port });
    }
    async function inputText(ip, text, opts = {}) {
      const str = text == null ? "" : String(text);
      if (!isValidIp(ip)) {
        return { success: false, error: "Invalid device IP" };
      }
      if (!str) {
        return { success: true, status: 200, results: [] };
      }
      const delayMs = opts.inputKeyDelayMs != null ? opts.inputKeyDelayMs : 100;
      const keyTimeout = opts.timeout != null ? opts.timeout : 2e3;
      const port = opts.port;
      const results = [];
      for (const char of str) {
        const key = `Lit_${encodeURIComponent(char)}`;
        const result = await keypress(ip, key, { timeout: keyTimeout, port });
        results.push(result);
        const r = result;
        if (!r.success) {
          return {
            success: false,
            error: r.error || "inputText failed",
            statusCode: r.statusCode,
            authFailed: r.authFailed,
            index: results.length - 1,
            results
          };
        }
        if (delayMs > 0) {
          await new Promise((r2) => setTimeout(r2, delayMs));
        }
      }
      return { success: true, status: 200, results };
    }
    function deeplink(ip, appId, contentId, mediaType, opts = {}) {
      let path2 = `/launch/${appId}`;
      const params = [];
      if (contentId) params.push(`contentID=${encodeURIComponent(contentId)}`);
      if (mediaType) params.push(`mediaType=${encodeURIComponent(mediaType)}`);
      if (params.length > 0) {
        path2 += `?${params.join("&")}`;
      }
      return ecpRequest(ip, {
        path: path2,
        method: "POST",
        timeout: 5e3
      }, { timeout: opts.timeout != null ? opts.timeout : 5e3, port: opts.port });
    }
    async function testConnection(ip, opts = {}) {
      const timeout = opts.timeout != null ? opts.timeout : QUERY_TIMEOUT;
      try {
        const [deviceInfo, deviceImageUrl] = await Promise.all([
          getDeviceInfo(ip, {
            timeout,
            includeSameSubnet: opts.includeSameSubnet !== false
          }),
          getDeviceImageUrl(ip, { timeout }).catch(() => null)
        ]);
        if (deviceImageUrl) {
          deviceInfo.deviceImageUrl = deviceImageUrl;
        }
        return { success: true, deviceInfo };
      } catch (error) {
        return { success: false, error: errorMessage(error) || "Connection failed" };
      }
    }
    function getIcon(ip, appId, opts = {}) {
      if (!isValidIp(ip)) {
        return Promise.resolve({ success: false, error: "Invalid device IP" });
      }
      const port = opts.port != null ? opts.port : 8060;
      const timeout = opts.timeout != null ? opts.timeout : 5e3;
      return new Promise((resolve) => {
        const reqOptions = {
          hostname: ip,
          port,
          path: `/query/icon/${appId}`,
          method: "GET"
        };
        const req = http2.request(reqOptions, (res) => {
          const chunks = [];
          res.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          res.on("end", () => {
            if (res.statusCode === 200 && chunks.length > 0) {
              const buffer = Buffer.concat(chunks);
              const base64 = buffer.toString("base64");
              const mimeType = res.headers["content-type"] || "image/png";
              const dataUrl = `data:${mimeType};base64,${base64}`;
              resolve({ success: true, dataUrl, mimeType });
            } else {
              const err = ecpErrorFromStatus(res.statusCode || 0);
              resolve({
                success: false,
                error: res.statusCode === 200 ? "Empty icon response" : err.error,
                statusCode: res.statusCode,
                authFailed: err.authFailed
              });
            }
          });
        });
        req.on("error", (error) => {
          resolve({ success: false, error: error.message });
        });
        req.on("timeout", () => {
          req.destroy();
          resolve({ success: false, error: "Request timed out" });
        });
        req.setTimeout(timeout);
        req.end();
      });
    }
    module2.exports = {
      ecpErrorFromStatus,
      ecpRequest,
      keypress,
      launch,
      query,
      post,
      inputText,
      deeplink,
      testConnection,
      getIcon
    };
  }
});

// ../roku-dev-studio-api/dist/lib/plugin-install.js
var require_plugin_install = __commonJS({
  "../roku-dev-studio-api/dist/lib/plugin-install.js"(exports2, module2) {
    "use strict";
    var { exec } = require("child_process");
    var path2 = require("path");
    var { promisify } = require("util");
    var { isValidIp, validateDevPassword } = require_validate_input();
    var { errorMessage } = require_err_util();
    var execPromise = promisify(exec);
    async function sideloadChannel({ ip, filePath, password, log = (_m) => void 0 }) {
      if (!isValidIp(ip)) {
        return { success: false, error: "Invalid device IP address" };
      }
      const pwdCheck = validateDevPassword(password);
      if (!pwdCheck.valid) {
        return { success: false, error: pwdCheck.error || "Invalid developer password" };
      }
      if (typeof filePath !== "string" || !filePath.trim()) {
        return { success: false, error: "File path is required" };
      }
      const normalizedPath = path2.normalize(filePath.trim());
      if (normalizedPath.includes("..")) {
        return { success: false, error: "Invalid file path" };
      }
      const curlCmd = `curl -s -S --digest --user "rokudev:${password}" -F "mysubmit=Install" -F "archive=@${normalizedPath}" "http://${ip}/plugin_install" --connect-timeout 10 --max-time 120`;
      try {
        log("Sideload: running curl");
        const { stdout, stderr } = await execPromise(curlCmd);
        const response = stdout || stderr;
        if (response.includes("Install Success") || response.includes("Application Received") || response.includes("Conversion complete")) {
          return { success: true, message: "Channel installed successfully!" };
        }
        if (response.includes("Install Failure")) {
          const errorMatch = response.match(/Install Failure:\s*([^<\n]+)/);
          return { success: false, error: errorMatch ? errorMatch[1].trim() : "Installation failed" };
        }
        if (response.includes("401") || response.includes("Authentication")) {
          return { success: false, error: "Authentication failed. Check your developer password.", authFailed: true };
        }
        if (response.includes("Roku") && !response.includes("Failure")) {
          return { success: true, message: "Channel installed! Check your Roku device." };
        }
        log(`Sideload: unexpected response (first 500): ${response.substring(0, 500)}`);
        return { success: false, error: "Unknown response from device. Check your Roku to see if the channel was installed." };
      } catch (error) {
        const msg = errorMessage(error);
        if (msg.includes("Connection refused")) {
          return { success: false, error: "Connection refused. Make sure Developer Mode is enabled." };
        }
        if (msg.includes("timed out")) {
          return { success: false, error: "Connection timed out. Check the device IP address." };
        }
        if (msg.includes("Could not resolve host")) {
          return { success: false, error: "Could not resolve host. Check the device IP address." };
        }
        return { success: false, error: `Upload failed: ${msg}` };
      }
    }
    async function deleteSideload({ ip, password, log = (_m) => void 0 }) {
      if (!isValidIp(ip)) {
        return { success: false, error: "Invalid device IP address" };
      }
      const pwdCheck = validateDevPassword(password);
      if (!pwdCheck.valid) {
        return { success: false, error: pwdCheck.error || "Invalid developer password" };
      }
      const curlCmd = `curl -s -S --digest --user "rokudev:${password}" -F "mysubmit=Delete" -F "archive=;" "http://${ip}/plugin_install" --connect-timeout 10 --max-time 30`;
      try {
        log("Delete sideload: running curl");
        const { stdout, stderr } = await execPromise(curlCmd);
        const response = stdout || stderr;
        if (response.includes("Delete Success") || response.includes("Roku") && !response.includes("Failure")) {
          return { success: true, message: "Sideloaded channel deleted successfully!" };
        }
        if (response.includes("401") || response.includes("Authentication")) {
          return { success: false, error: "Authentication failed. Check your developer password.", authFailed: true };
        }
        return { success: true, message: "Delete command sent. Check your Roku device." };
      } catch (error) {
        return { success: false, error: `Delete failed: ${errorMessage(error)}` };
      }
    }
    module2.exports = { sideloadChannel, deleteSideload };
  }
});

// ../roku-dev-studio-api/dist/lib/screenshot.js
var require_screenshot = __commonJS({
  "../roku-dev-studio-api/dist/lib/screenshot.js"(exports2, module2) {
    "use strict";
    var { isValidIp, validateDevPassword } = require_validate_input();
    var { errorMessage } = require_err_util();
    async function captureRokuScreenshot(options) {
      const {
        ip,
        password,
        exec = require("child_process").exec,
        waitAfterTriggerMs = 1500,
        retryWaitMs = 1500,
        maxRetries = 4,
        minValidBytes = 1e3,
        log = (_m) => void 0
      } = options;
      if (!isValidIp(ip)) {
        return { success: false, error: "Invalid device IP address" };
      }
      const pwdCheck = validateDevPassword(password);
      if (!pwdCheck.valid) {
        return { success: false, error: pwdCheck.error || "Invalid developer password" };
      }
      const auth = `rokudev:${password}`;
      const captureCommand = `curl -s -S --digest -u "${auth}" -F "mysubmit=Screenshot" -F "passwd=" http://${ip}/plugin_inspect`;
      const downloadCommand = `curl -s -S --digest -u "${auth}" "http://${ip}/pkgs/dev.jpg"`;
      const run = (cmd, opts = {}) => new Promise((resolve, reject) => {
        exec(cmd, { timeout: 3e4, ...opts }, (err, stdout, _stderr) => {
          if (err) reject(err);
          else resolve(stdout);
        });
      });
      const downloadToBuffer = () => new Promise((resolve, reject) => {
        exec(
          downloadCommand,
          { encoding: "buffer", maxBuffer: 10 * 1024 * 1024, timeout: 3e4 },
          (err, stdout) => {
            if (err) return reject(err);
            resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.alloc(0));
          }
        );
      });
      const waitThenDownload = async (afterTriggerWait) => {
        await new Promise((r) => setTimeout(r, afterTriggerWait));
        let buf = await downloadToBuffer();
        log(`Screenshot: download length ${buf?.length || 0} bytes`);
        for (let attempt = 0; buf.length < minValidBytes && attempt < maxRetries; attempt++) {
          await new Promise((r) => setTimeout(r, retryWaitMs));
          buf = await downloadToBuffer();
          log(`Screenshot: retry ${attempt + 1} download length ${buf?.length || 0} bytes`);
        }
        return buf;
      };
      try {
        log("Screenshot: triggering capture");
        let captureStdout = await run(captureCommand);
        log(`Screenshot: capture response length ${captureStdout?.length || 0}`);
        if (typeof captureStdout === "string" && (captureStdout.includes("401") || captureStdout.includes("Authentication"))) {
          return { success: false, error: "Authentication failed. Check your developer password.", authFailed: true };
        }
        let imageBuffer = await waitThenDownload(waitAfterTriggerMs);
        if (imageBuffer.length < minValidBytes) {
          log("Screenshot: first cycle failed, re-triggering and waiting longer");
          captureStdout = await run(captureCommand);
          const longerWait = Math.max(waitAfterTriggerMs + 1e3, 2500);
          imageBuffer = await waitThenDownload(longerWait);
        }
        if (imageBuffer.length < minValidBytes) {
          return {
            success: false,
            error: 'Screenshot file is empty or invalid. Make sure a sideloaded channel is running. If this step follows a keypress or UI change (e.g. opening HUD), increase "Wait before capture" to 3000\u20134000 ms for this screenshot step. If the image appears truncated (cut off), increase "Wait before capture" as well.'
          };
        }
        return { success: true, imageBuffer };
      } catch (err) {
        const msg = errorMessage(err);
        log(`Screenshot error: ${msg}`);
        return { success: false, error: `Screenshot failed: ${msg}` };
      }
    }
    module2.exports = { captureRokuScreenshot };
  }
});

// ../roku-dev-studio-api/dist/lib/discovery.js
var require_discovery = __commonJS({
  "../roku-dev-studio-api/dist/lib/discovery.js"(exports2, module2) {
    "use strict";
    var dgram = require("dgram");
    var os2 = require("os");
    var http2 = require("http");
    var { getDeviceInfo: fetchDeviceInfo, getDeviceId } = require_device_info();
    var { getDeviceImageUrl } = require_device_hardware_image();
    var SSDP_ADDRESS = "239.255.255.250";
    var SSDP_PORT = 1900;
    var ROKU_SEARCH_TARGET = "roku:ecp";
    var { errorMessage } = require_err_util();
    function upsertDevice(devices, ipToDeviceId, ip, port, deviceInfo, onDeviceFound) {
      const deviceId = getDeviceId(deviceInfo) || ip;
      const existingDevice = devices.get(deviceId);
      const existingKeyForIp = ipToDeviceId.get(ip);
      if (existingDevice && existingDevice.ip === ip) {
        Object.assign(existingDevice, deviceInfo);
        existingDevice.ip = ip;
        existingDevice.port = port;
        if (existingKeyForIp !== deviceId) {
          devices.delete(existingKeyForIp);
          ipToDeviceId.delete(ip);
        }
        devices.set(deviceId, existingDevice);
        ipToDeviceId.set(ip, deviceId);
        if (onDeviceFound) onDeviceFound(existingDevice);
        return existingDevice;
      }
      if (existingKeyForIp !== void 0) {
        const previous = devices.get(existingKeyForIp);
        if (previous) devices.delete(existingKeyForIp);
      }
      const device = { ip, port, ...deviceInfo };
      devices.set(deviceId, device);
      ipToDeviceId.set(ip, deviceId);
      if (onDeviceFound) onDeviceFound(device);
      return device;
    }
    function updateDeviceIp(devices, ipToDeviceId, deviceId, ip, port, deviceInfo, onDeviceFound) {
      const existingDevice = devices.get(deviceId);
      if (!existingDevice) return null;
      ipToDeviceId.delete(existingDevice.ip);
      existingDevice.ip = ip;
      existingDevice.port = port;
      Object.assign(existingDevice, deviceInfo);
      ipToDeviceId.set(ip, deviceId);
      if (onDeviceFound) onDeviceFound(existingDevice);
      return existingDevice;
    }
    function ssdpDiscover(opts = {}) {
      const onDeviceFound = opts.onDeviceFound;
      const log = opts.log || (() => {
      });
      const timeout = opts.timeout != null ? opts.timeout : 6e3;
      const earlyFinishMs = opts.earlyFinishMs != null ? opts.earlyFinishMs : 2500;
      const sendCount = opts.sendCount != null ? opts.sendCount : 8;
      const sendInterval = opts.sendInterval != null ? opts.sendInterval : 400;
      return new Promise((resolve, reject) => {
        const devices = /* @__PURE__ */ new Map();
        const ipToDeviceId = /* @__PURE__ */ new Map();
        let resolved = false;
        let earlyFinishTimer = null;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          if (earlyFinishTimer) clearTimeout(earlyFinishTimer);
          try {
            socket.close();
          } catch (e) {
          }
          log("SSDP discovery complete, found " + devices.size + " devices");
          resolve(Array.from(devices.values()));
        };
        const scheduleEarlyFinish = () => {
          if (earlyFinishTimer) clearTimeout(earlyFinishTimer);
          if (devices.size > 0) {
            earlyFinishTimer = setTimeout(() => {
              if (!resolved && devices.size > 0) {
                log("Early finish - no new devices for " + earlyFinishMs + "ms");
                finish();
              }
            }, earlyFinishMs);
          }
        };
        let socket;
        try {
          socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
        } catch (err) {
          log("Failed to create socket: " + errorMessage(err));
          reject(err);
          return;
        }
        const searchMessage = Buffer.from(
          `M-SEARCH * HTTP/1.1\r
HOST: ${SSDP_ADDRESS}:${SSDP_PORT}\r
MAN: "ssdp:discover"\r
MX: 3\r
ST: ${ROKU_SEARCH_TARGET}\r
\r
`
        );
        socket.on("message", async (msg, rinfo) => {
          const response = msg.toString();
          log("Received SSDP response from: " + rinfo.address);
          const locationMatch = response.match(/LOCATION:\s*http:\/\/([^:]+):(\d+)/i);
          if (!locationMatch) return;
          const ip = locationMatch[1];
          const port = locationMatch[2];
          try {
            const ecpPort = parseInt(String(port), 10) || 8060;
            const [deviceInfo, deviceImageUrl] = await Promise.all([
              fetchDeviceInfo(ip, { includeSameSubnet: true }),
              getDeviceImageUrl(ip, { port: ecpPort }).catch(() => null)
            ]);
            const deviceId = getDeviceId(deviceInfo) || ip;
            const existingDevice = devices.get(deviceId);
            const existingKeyForIp = ipToDeviceId.get(ip);
            const enriched = {
              ...deviceInfo,
              ...deviceImageUrl ? { deviceImageUrl } : {}
            };
            if (existingDevice && existingDevice.ip === ip) {
              upsertDevice(devices, ipToDeviceId, ip, port, enriched, onDeviceFound);
              scheduleEarlyFinish();
            } else if (existingKeyForIp !== void 0) {
              const previous = devices.get(existingKeyForIp);
              if (previous) devices.delete(existingKeyForIp);
              const device = { ip, port, ...enriched };
              devices.set(deviceId, device);
              ipToDeviceId.set(ip, deviceId);
              if (onDeviceFound) onDeviceFound(device);
              scheduleEarlyFinish();
            } else if (!existingDevice) {
              const device = { ip, port, ...enriched };
              devices.set(deviceId, device);
              ipToDeviceId.set(ip, deviceId);
              if (onDeviceFound) onDeviceFound(device);
              scheduleEarlyFinish();
            } else if (existingDevice.ip !== ip) {
              log("Device " + deviceId + " IP changed from " + existingDevice.ip + " to " + ip);
              updateDeviceIp(devices, ipToDeviceId, deviceId, ip, port, enriched, onDeviceFound);
            }
          } catch (e) {
            log("Failed to get device info for " + ip + ": " + errorMessage(e));
          }
        });
        socket.on("error", (err) => {
          log("SSDP socket error: " + err.message);
          if (!resolved) {
            resolved = true;
            if (earlyFinishTimer) clearTimeout(earlyFinishTimer);
            try {
              socket.close();
            } catch (e) {
            }
            reject(err);
          }
        });
        socket.bind({ address: "0.0.0.0", port: 0, exclusive: false }, () => {
          const address = socket.address();
          log("SSDP socket bound to " + address.address + ":" + address.port);
          try {
            socket.setBroadcast(true);
          } catch (e) {
          }
          try {
            socket.setMulticastTTL(4);
          } catch (e) {
          }
          try {
            socket.addMembership(SSDP_ADDRESS);
          } catch (e) {
          }
          try {
            socket.addMembership(SSDP_ADDRESS, "0.0.0.0");
          } catch (e) {
          }
          const interfaces = os2.networkInterfaces();
          for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name] || []) {
              if (iface.family === "IPv4" && !iface.internal) {
                try {
                  socket.addMembership(SSDP_ADDRESS, iface.address);
                } catch (e) {
                }
              }
            }
          }
          log("Sending SSDP discovery messages...");
          for (let i = 0; i < sendCount; i++) {
            setTimeout(() => {
              if (resolved) return;
              try {
                socket.send(searchMessage, 0, searchMessage.length, SSDP_PORT, SSDP_ADDRESS);
              } catch (e) {
                log("Failed to send SSDP message: " + errorMessage(e));
              }
            }, i * sendInterval);
          }
        });
        setTimeout(finish, timeout);
      });
    }
    function subnetScan(opts = {}) {
      const onDeviceFound = opts.onDeviceFound;
      const log = opts.log || (() => {
      });
      const requestTimeout = opts.requestTimeout != null ? opts.requestTimeout : 500;
      const concurrency = opts.concurrency != null ? opts.concurrency : 50;
      const interfaces = os2.networkInterfaces();
      const subnets = [];
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          if (iface.family === "IPv4" && !iface.internal) {
            const parts = iface.address.split(".");
            if (parts.length === 4) {
              subnets.push(parts[0] + "." + parts[1] + "." + parts[2]);
            }
          }
        }
      }
      if (subnets.length === 0) {
        log("No subnets to scan");
        return Promise.resolve([]);
      }
      const devices = /* @__PURE__ */ new Map();
      const ipToDeviceId = /* @__PURE__ */ new Map();
      const allHosts = [];
      for (const subnet of subnets) {
        for (let host = 1; host <= 254; host++) {
          allHosts.push(subnet + "." + host);
        }
      }
      function probe(ip) {
        return new Promise((resolveScan) => {
          const req = http2.get("http://" + ip + ":8060/query/device-info", { timeout: requestTimeout }, (res) => {
            if (res.statusCode !== 200) {
              resolveScan();
              return;
            }
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
              if (!data.includes("<device-info>") || !data.includes("Roku")) {
                resolveScan();
                return;
              }
              Promise.all([
                fetchDeviceInfo(ip, { includeSameSubnet: true }),
                getDeviceImageUrl(ip).catch(() => null)
              ]).then(([deviceInfo, deviceImageUrl]) => {
                if (deviceInfo) {
                  const deviceId = getDeviceId(deviceInfo) || ip;
                  const existingKeyForIp = ipToDeviceId.get(ip);
                  if (existingKeyForIp !== void 0 && existingKeyForIp !== deviceId) {
                    devices.delete(existingKeyForIp);
                  }
                  const device = {
                    ip,
                    port: 8060,
                    ...deviceInfo,
                    ...deviceImageUrl ? { deviceImageUrl } : {}
                  };
                  devices.set(deviceId, device);
                  ipToDeviceId.set(ip, deviceId);
                  if (onDeviceFound) onDeviceFound(device);
                }
              }).catch(() => {
              }).then(resolveScan);
            });
          });
          req.on("error", () => resolveScan());
          req.on("timeout", () => {
            req.destroy();
            resolveScan();
          });
        });
      }
      let index = 0;
      function runBatch() {
        const batch = [];
        while (batch.length < concurrency && index < allHosts.length) {
          batch.push(probe(allHosts[index++]));
        }
        if (batch.length === 0) return Promise.resolve();
        return Promise.all(batch).then(() => index < allHosts.length ? runBatch() : void 0);
      }
      return runBatch().then(() => {
        log("Subnet scan complete, found " + devices.size + " devices");
        return Array.from(devices.values());
      });
    }
    module2.exports = {
      ssdpDiscover,
      subnetScan
    };
  }
});

// ../roku-dev-studio-api/dist/lib/errors.js
var require_errors = __commonJS({
  "../roku-dev-studio-api/dist/lib/errors.js"(exports2, module2) {
    "use strict";
    var ROKU_OP_ERROR_CODES = Object.freeze({
      /** Callers passed an arg that failed schema validation (missing, wrong type). */
      INVALID_ARG: "invalid_arg",
      /** Device ip/serial supplied but not known to Dev Studio. */
      DEVICE_UNKNOWN: "device_unknown",
      /** Known device but no open tab / session. */
      DEVICE_NOT_CONNECTED: "device_not_connected",
      /** Device was reachable but rejected the operation (non-2xx from ECP). */
      DEVICE_ERROR: "device_error",
      /** We couldn't reach the device at all (network / timeout). */
      DEVICE_UNREACHABLE: "device_unreachable",
      /** Device accepted us but dev-auth failed. */
      DEV_AUTH_FAILED: "dev_auth_failed",
      /** The operation is not available in this context (renderer required, missing AppConnector, etc.). */
      UNSUPPORTED: "unsupported",
      /** Timed out waiting for the renderer / bridge to ack a round-tripped operation. */
      TIMEOUT: "timeout",
      /** A destructive operation was rejected by the consent layer. */
      CONSENT_DENIED: "consent_denied",
      /** Catch-all for unexpected internal exceptions. */
      INTERNAL: "internal"
    });
    var RokuOpError = class extends Error {
      constructor(code, message, opts = {}) {
        super(message);
        this.name = "RokuOpError";
        this.code = code;
        if (opts.details) this.details = opts.details;
        if (opts.suggestion) this.suggestion = opts.suggestion;
        if (opts.cause !== void 0) {
          try {
            this.cause = opts.cause;
          } catch {
          }
        }
      }
      /**
       * Default HTTP status for each code. Transports can override per-endpoint.
       */
      toHttpStatus() {
        switch (this.code) {
          case "invalid_arg":
            return 400;
          case "device_unknown":
            return 404;
          case "device_not_connected":
            return 409;
          case "dev_auth_failed":
            return 401;
          case "consent_denied":
            return 403;
          case "unsupported":
            return 501;
          case "timeout":
            return 504;
          case "device_unreachable":
          case "device_error":
            return 502;
          case "internal":
          default:
            return 500;
        }
      }
      toWire() {
        const out = { error: this.message, code: this.code };
        if (this.details) out.details = this.details;
        if (this.suggestion) out.suggestion = this.suggestion;
        return out;
      }
    };
    function toRokuOpError(e, fallbackCode = "internal") {
      if (e instanceof RokuOpError) return e;
      const message = e instanceof Error ? e.message : String(e);
      return new RokuOpError(fallbackCode, message, { cause: e });
    }
    module2.exports = {
      ROKU_OP_ERROR_CODES,
      RokuOpError,
      toRokuOpError
    };
  }
});

// ../roku-dev-studio-api/dist/lib/operations.js
var require_operations = __commonJS({
  "../roku-dev-studio-api/dist/lib/operations.js"(exports2, module2) {
    "use strict";
    var __defProp2 = Object.defineProperty;
    var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames2 = Object.getOwnPropertyNames;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __copyProps2 = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames2(from))
          if (!__hasOwnProp2.call(to, key) && key !== except)
            __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
    var operations_exports = {};
    module2.exports = __toCommonJS(operations_exports);
    var fs2 = require("fs");
    var os2 = require("os");
    var path2 = require("path");
    var { keypress, launch, query, post, inputText, deeplink, testConnection, getIcon } = require_ecp();
    var { sideloadChannel, deleteSideload: apiDeleteSideload } = require_plugin_install();
    var { captureRokuScreenshot } = require_screenshot();
    var { ssdpDiscover, subnetScan } = require_discovery();
    var { isValidIp, validateDevPassword } = require_validate_input();
    var {
      KEYPRESS_OPTIONS,
      DEVICE_PERFORMANCE_CHART_IDS
    } = require_catalogs();
    var { RokuOpError, toRokuOpError } = require_errors();
    var AGENT_SANDBOX_PATH_PREFIXES = [
      "/mnt/user-data/",
      "/mnt/skills/",
      "/mnt/uploads/",
      "/mnt/data/",
      "/sandbox/",
      "/tmp/sandbox/",
      "/home/sandbox/",
      "/home/agent/",
      "/workspace/agent/"
    ];
    function looksLikeAgentSandboxPath(p) {
      if (!p) return false;
      const norm = p.replace(/\\/g, "/").toLowerCase();
      return AGENT_SANDBOX_PATH_PREFIXES.some((prefix) => norm.startsWith(prefix));
    }
    function preflightLocalFile(filePath) {
      let stat;
      try {
        stat = fs2.statSync(filePath);
      } catch (e) {
        const err = e;
        if (err && err.code === "ENOENT") {
          return {
            code: "ENOENT",
            message: `Sideload file not found at \`${filePath}\`. Verify the absolute path on the user's machine \u2014 common causes: (1) browser appended \` (1)\` or stripped characters when saving, (2) file is in a different folder (Desktop / iCloud Drive instead of Downloads), (3) the upload was never actually saved locally. Ask the user to drag the .zip from Finder into Terminal to get the canonical path, or pass the bytes inline via \`contentBase64\` + \`filename\` instead.`
          };
        }
        if (err && err.code === "EACCES") {
          return {
            code: "EACCES",
            message: `Permission denied reading \`${filePath}\`. On macOS, Roku Dev Studio may need Full Disk Access (System Settings \u2192 Privacy & Security \u2192 Full Disk Access \u2192 enable Roku Dev Studio) \u2014 typical for files under Downloads / Documents / Desktop. Or the file's unix mode prevents reads.`
          };
        }
        return {
          code: "STAT_FAILED",
          message: `Could not stat \`${filePath}\`: ${err && err.message ? err.message : String(e)}`
        };
      }
      if (typeof stat.isDirectory === "function" && stat.isDirectory()) {
        return {
          code: "EISDIR",
          message: `\`${filePath}\` is a directory, not a file. Pass the absolute path of the .zip itself.`
        };
      }
      if (typeof stat.isFile === "function" && !stat.isFile()) {
        return {
          code: "NOT_REGULAR_FILE",
          message: `\`${filePath}\` is not a regular file (symlink target missing, socket, fifo, \u2026).`
        };
      }
      if (typeof stat.size === "number" && stat.size === 0) {
        return {
          code: "EMPTY_FILE",
          message: `\`${filePath}\` is 0 bytes \u2014 likely a failed/incomplete download. Re-download the .zip and retry.`
        };
      }
      try {
        fs2.accessSync(filePath, fs2.constants.R_OK);
      } catch (e) {
        const err = e;
        if (err && err.code === "EACCES") {
          return {
            code: "EACCES",
            message: `Permission denied reading \`${filePath}\`. On macOS, Roku Dev Studio may need Full Disk Access (System Settings \u2192 Privacy & Security \u2192 Full Disk Access \u2192 enable Roku Dev Studio).`
          };
        }
        return {
          code: "ACCESS_FAILED",
          message: `Could not open \`${filePath}\` for reading: ${err && err.message ? err.message : String(e)}`
        };
      }
      if (!filePath.toLowerCase().endsWith(".zip")) {
        return {
          code: "NOT_ZIP",
          message: `\`${filePath}\` does not have a \`.zip\` extension. Roku sideload expects a channel .zip (manifest + components/ + \u2026). Verify the file.`
        };
      }
      return null;
    }
    var ECP_RESPONSE_OUTPUT_SCHEMA = {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: { type: "string" },
        status: { type: "number" },
        error: { type: "string" },
        statusCode: { type: "number" },
        authFailed: { type: "boolean" }
      },
      additionalProperties: true
    };
    var PERMISSIVE_OBJECT_OUTPUT_SCHEMA = {
      type: "object",
      additionalProperties: true
    };
    function requireNonEmptyString(value, name) {
      if (typeof value !== "string" || value.trim() === "") {
        throw new RokuOpError("invalid_arg", `Missing or empty \`${name}\`.`);
      }
      return value.trim();
    }
    function requireString(value, name) {
      if (typeof value !== "string") {
        throw new RokuOpError("invalid_arg", `\`${name}\` must be a string.`);
      }
      return value;
    }
    function requireIp(value, name = "ip") {
      const s = requireNonEmptyString(value, name);
      if (!isValidIp(s)) {
        throw new RokuOpError("invalid_arg", `\`${name}\` is not a valid IPv4 address: "${s}".`);
      }
      return s;
    }
    function requireDevPassword(value, name = "password") {
      const s = requireString(value, name);
      if (!s) throw new RokuOpError("invalid_arg", `\`${name}\` is required.`);
      const v = validateDevPassword(s);
      if (!v.valid) throw new RokuOpError("invalid_arg", v.error || `\`${name}\` failed validation.`);
      return s;
    }
    function requireDevPasswordParam(value, name = "password") {
      if (value === void 0 || value === null || typeof value === "string" && value.trim() === "") {
        throw new RokuOpError(
          "invalid_arg",
          `Missing \`${name}\`. Save the developer password for this device in Roku Dev Studio (device tab, verify with Remember checked), or pass \`${name}\` in the request.`,
          {
            suggestion: "Open the device panel, enter the Dev Password, authenticate, and enable Remember \u2014 or pass password explicitly for this call."
          }
        );
      }
      return requireDevPassword(value, name);
    }
    function rendererOnlyExecute(opId) {
      return async () => {
        throw new RokuOpError(
          "unsupported",
          `Operation "${opId}" runs only in the Electron renderer and cannot execute main-side.`,
          {
            suggestion: "Invoke this via the MCP bridge or the renderer IPC handler; main-direct transport cannot run renderer-owned operations."
          }
        );
      };
    }
    var KEYPRESS = {
      id: "keypress",
      title: "Send Remote Key",
      description: 'Send an ECP remote key (e.g. "Home", "Up", "Select", "Play") to a Roku device. Mirrors what the user does with the on-screen remote.',
      runIn: "main",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: {
          ip: { type: "string", description: "Device IPv4 address." },
          key: {
            type: "string",
            description: "ECP key name. See list_keypress_options for the full set.",
            enum: KEYPRESS_OPTIONS
          }
        },
        required: ["ip", "key"],
        additionalProperties: false
      },
      outputSchema: ECP_RESPONSE_OUTPUT_SCHEMA,
      validate: (p) => {
        const issues = [];
        if (typeof p.key === "string" && !KEYPRESS_OPTIONS.includes(p.key)) {
          issues.push({
            path: "key",
            message: `Unknown key "${p.key}". Call list_keypress_options.`
          });
        }
        return issues;
      },
      execute: async (p) => {
        const ip = requireIp(p.ip);
        const key = requireNonEmptyString(p.key, "key");
        return await keypress(ip, key);
      }
    };
    var LAUNCH = {
      id: "launch_app",
      title: "Launch Roku App",
      description: 'Launch a channel / app on the device by app id. Use /query/apps or ecp_query to discover ids. "dev" is the sideloaded Dev App.',
      runIn: "main",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: {
          ip: { type: "string" },
          appId: { type: "string", description: 'Channel id (e.g. "837" for YouTube, "dev" for sideloaded).' },
          params: {
            type: "object",
            description: "Optional URL-encoded launch params.",
            additionalProperties: { type: "string" }
          }
        },
        required: ["ip", "appId"],
        additionalProperties: false
      },
      outputSchema: ECP_RESPONSE_OUTPUT_SCHEMA,
      execute: async (p) => {
        const ip = requireIp(p.ip);
        const appId = requireNonEmptyString(p.appId, "appId");
        return await launch(ip, appId, p.params);
      }
    };
    var INPUT_TEXT = {
      id: "input_text",
      title: "Send Text Input",
      description: "Send a literal text string to whatever input field is currently focused on the device (ECP /input endpoint).",
      runIn: "main",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: {
          ip: { type: "string" },
          text: { type: "string", description: "Text to send." }
        },
        required: ["ip", "text"],
        additionalProperties: false
      },
      outputSchema: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          status: { type: "number" },
          results: { type: "array" },
          error: { type: "string" }
        },
        additionalProperties: true
      },
      execute: async (p) => {
        const ip = requireIp(p.ip);
        const text = requireString(p.text, "text");
        if (!text) throw new RokuOpError("invalid_arg", "`text` cannot be empty.");
        return await inputText(ip, text);
      }
    };
    var DEEP_LINK = {
      id: "deep_link",
      title: "Deep Link into an App",
      description: "Launch an app with a deep link (contentId + mediaType). Equivalent to /launch/<appId>?contentId=...&mediaType=... in ECP.",
      runIn: "main",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: {
          ip: { type: "string" },
          appId: { type: "string" },
          contentId: { type: "string" },
          mediaType: { type: "string", description: 'e.g. "movie", "episode", "series".' }
        },
        required: ["ip", "appId"],
        additionalProperties: false
      },
      outputSchema: ECP_RESPONSE_OUTPUT_SCHEMA,
      execute: async (p) => {
        const ip = requireIp(p.ip);
        const appId = requireNonEmptyString(p.appId, "appId");
        return await deeplink(ip, appId, p.contentId, p.mediaType);
      }
    };
    var ECP_QUERY = {
      id: "ecp_query",
      title: "ECP Query (read-only)",
      description: "Run a read-only ECP GET against a device. Use endpoints from list_query_presets or any /query/* path. Does not change device state.",
      runIn: "main",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: {
          ip: { type: "string" },
          endpoint: { type: "string", description: "ECP path (e.g. /query/active-app) or telnet preset (e.g. telnet:plugins)." }
        },
        required: ["ip", "endpoint"],
        additionalProperties: false
      },
      outputSchema: ECP_RESPONSE_OUTPUT_SCHEMA,
      execute: async (p) => {
        const ip = requireIp(p.ip);
        const endpoint = requireNonEmptyString(p.endpoint, "endpoint");
        return await query(ip, endpoint);
      }
    };
    var ECP_POST = {
      id: "ecp_post",
      title: "ECP POST (raw)",
      description: "POST to an arbitrary ECP endpoint (e.g. /sgrendezvous/track). Side-effecting \u2014 agents should use list_post_presets for safe defaults.",
      runIn: "main",
      destructive: true,
      inputSchema: {
        type: "object",
        properties: {
          ip: { type: "string" },
          endpoint: { type: "string" }
        },
        required: ["ip", "endpoint"],
        additionalProperties: false
      },
      outputSchema: ECP_RESPONSE_OUTPUT_SCHEMA,
      execute: async (p) => {
        const ip = requireIp(p.ip);
        const endpoint = requireNonEmptyString(p.endpoint, "endpoint");
        return await post(ip, endpoint);
      }
    };
    var TEST_CONNECTION = {
      id: "test_connection",
      title: "Test Device Connection",
      description: "Probe a device IP for ECP availability. Returns reachability + basic device info. Does not require the device to have a tab open.",
      runIn: "main",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: { ip: { type: "string" } },
        required: ["ip"],
        additionalProperties: false
      },
      outputSchema: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          deviceInfo: { type: "object", additionalProperties: true },
          error: { type: "string" }
        },
        additionalProperties: true
      },
      execute: async (p) => {
        const ip = requireIp(p.ip);
        return await testConnection(ip);
      }
    };
    var GET_APP_ICON = {
      id: "get_app_icon",
      title: "Get App Icon",
      description: "Fetch the 336x210 app icon for a channel on the device (data URL / base64).",
      runIn: "main",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: {
          ip: { type: "string" },
          appId: { type: "string" }
        },
        required: ["ip", "appId"],
        additionalProperties: false
      },
      outputSchema: PERMISSIVE_OBJECT_OUTPUT_SCHEMA,
      execute: async (p) => {
        const ip = requireIp(p.ip);
        const appId = requireNonEmptyString(p.appId, "appId");
        return await getIcon(ip, appId);
      }
    };
    var SIDELOAD = {
      id: "sideload",
      title: "Sideload Channel Package",
      description: "Upload and install a .zip channel package on the device. Destructive: replaces any currently sideloaded Dev App. Provide the zip in ONE of two ways: (1) `filePath` \u2014 an absolute path to a .zip on the SAME machine that runs Roku Dev Studio. Do NOT use this when running in a remote agent sandbox (Claude.ai, ChatGPT web) where files only exist inside the agent's container \u2014 the path will not resolve on the user's machine. (2) `contentBase64` + `filename` \u2014 the .zip bytes inline; this server writes them to a temp file on the user's machine, sideloads, and cleans up. Use this whenever the agent has file content but no shared filesystem with Roku Dev Studio. Password is optional when Dev Studio has remembered it for this device.",
      runIn: "main",
      destructive: true,
      inputSchema: {
        type: "object",
        properties: {
          ip: { type: "string" },
          filePath: {
            type: "string",
            description: "Absolute path to a .zip on the same machine that runs Roku Dev Studio. Mutually exclusive with `contentBase64`. Will fail with an actionable error if the path looks like an agent sandbox path (e.g. /mnt/user-data/...)."
          },
          contentBase64: {
            type: "string",
            description: "Zip bytes encoded as base64. The server writes them to a temp file on the user's machine, sideloads, then deletes the temp file. Use this when running in a remote agent sandbox so file content travels through MCP rather than relying on a shared filesystem. Provide `filename` alongside."
          },
          filename: {
            type: "string",
            description: 'Suggested filename for the temp file when using `contentBase64` (e.g. "my-app.zip"). Optional but recommended; if omitted, "agent-upload.zip" is used.'
          },
          password: {
            type: "string",
            description: "Developer password. Omit if Roku Dev Studio has saved it for this device (Remember on the device tab)."
          }
        },
        required: ["ip"],
        additionalProperties: false
      },
      outputSchema: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          error: { type: "string" }
        },
        additionalProperties: true
      },
      execute: async (p) => {
        const ip = requireIp(p.ip);
        const password = requireDevPasswordParam(p.password);
        const hasFilePath = typeof p.filePath === "string" && p.filePath.trim() !== "";
        const hasBase64 = typeof p.contentBase64 === "string" && p.contentBase64.trim() !== "";
        if (!hasFilePath && !hasBase64) {
          throw new RokuOpError(
            "validation_error",
            "sideload requires either `filePath` (absolute path on the same machine as Roku Dev Studio) or `contentBase64` + `filename` (zip bytes encoded as base64).",
            { details: { argument: "filePath|contentBase64" } }
          );
        }
        if (hasFilePath && hasBase64) {
          throw new RokuOpError(
            "validation_error",
            "sideload accepts EITHER `filePath` OR `contentBase64` (not both). Pick one.",
            { details: { argument: "filePath|contentBase64" } }
          );
        }
        let filePath = "";
        let tempPathToCleanup = "";
        if (hasBase64) {
          const base64 = p.contentBase64.trim();
          let buffer;
          try {
            buffer = Buffer.from(base64, "base64");
          } catch (e) {
            throw new RokuOpError(
              "validation_error",
              "sideload `contentBase64` is not valid base64.",
              { details: { argument: "contentBase64" } }
            );
          }
          if (buffer.length === 0) {
            throw new RokuOpError(
              "validation_error",
              "sideload `contentBase64` decoded to zero bytes.",
              { details: { argument: "contentBase64" } }
            );
          }
          const safeName = sanitizeUploadFilename(p.filename) || "agent-upload.zip";
          const tempDir = fs2.mkdtempSync(path2.join(os2.tmpdir(), "rds-sideload-"));
          tempPathToCleanup = path2.join(tempDir, safeName);
          fs2.writeFileSync(tempPathToCleanup, buffer);
          filePath = tempPathToCleanup;
        } else {
          filePath = requireNonEmptyString(p.filePath, "filePath");
          if (looksLikeAgentSandboxPath(filePath)) {
            throw new RokuOpError(
              "validation_error",
              `sideload \`filePath\` looks like a remote agent sandbox path (\`${filePath}\`). Roku Dev Studio runs on the user's machine and cannot read files from a hosted AI container. Either (a) ask the user to download the .zip locally and re-run with the absolute local path, (b) drag the .zip into Roku Dev Studio's install drop zone, or (c) re-call sideload using \`contentBase64\` + \`filename\` so the bytes travel through MCP.`,
              { details: { filePath, sandbox: true } }
            );
          }
          const preflight = preflightLocalFile(filePath);
          if (preflight) {
            throw new RokuOpError("validation_error", preflight.message, {
              details: { filePath, code: preflight.code }
            });
          }
        }
        try {
          const result = await sideloadChannel({ ip, filePath, password });
          if (!result || result.success === false) {
            throw new RokuOpError(
              "device_error",
              result && result.error || "Sideload failed.",
              { details: { ip, filePath } }
            );
          }
          return result;
        } finally {
          if (tempPathToCleanup) {
            try {
              fs2.rmSync(tempPathToCleanup, { force: true });
              fs2.rmdirSync(path2.dirname(tempPathToCleanup));
            } catch {
            }
          }
        }
      }
    };
    function sanitizeUploadFilename(raw) {
      if (typeof raw !== "string") return "";
      const base = raw.replace(/\\/g, "/").split("/").pop() || "";
      const trimmed = base.trim();
      if (!trimmed) return "";
      const cleaned = trimmed.replace(/[^A-Za-z0-9._\- ]+/g, "_");
      return cleaned.slice(0, 120);
    }
    var DELETE_SIDELOAD = {
      id: "delete_sideload",
      title: "Delete Sideloaded Channel",
      description: "Remove the currently sideloaded Dev App from the device. Password optional when Dev Studio has remembered it for this device.",
      runIn: "main",
      destructive: true,
      inputSchema: {
        type: "object",
        properties: {
          ip: { type: "string" },
          password: {
            type: "string",
            description: "Omit if Roku Dev Studio has saved the Dev Password for this device (Remember on the device tab)."
          }
        },
        required: ["ip"],
        additionalProperties: false
      },
      outputSchema: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          error: { type: "string" }
        },
        additionalProperties: true
      },
      execute: async (p) => {
        const ip = requireIp(p.ip);
        const password = requireDevPasswordParam(p.password);
        const result = await apiDeleteSideload({ ip, password });
        if (!result || result.success === false) {
          throw new RokuOpError("device_error", result && result.error || "Delete sideload failed.");
        }
        return result;
      }
    };
    var SCREENSHOT = {
      id: "screenshot",
      title: "Capture Screenshot",
      description: "Capture a screenshot of the current device screen and return it inline as an MCP image content block (JPEG, base64). Hosts (Cursor, Claude Desktop, etc.) render this image to the user, so for any human-facing capture **let `returnImageBase64` default to true** (or omit it). Set `returnImageBase64: false` ONLY for batch / metadata-only flows where no one will view the screenshot; in that case the response is just `{ success, filename, bytes }` and the image will not appear in the chat. Password is optional when Dev Studio has remembered it for this device.",
      runIn: "main",
      destructive: true,
      inputSchema: {
        type: "object",
        properties: {
          ip: { type: "string" },
          password: {
            type: "string",
            description: "Omit if Roku Dev Studio has saved the Dev Password for this device (Remember on the device tab)."
          },
          waitAfterTriggerMs: { type: "number" },
          returnImageBase64: {
            type: "boolean",
            description: "Default true. Keep true (or omit) for any user-facing capture so the screenshot is rendered inline in the chat. Set false ONLY for batch / metadata-only flows where no one will view the image; when false, the user will see only the JSON metadata and nothing visible."
          }
        },
        required: ["ip"],
        additionalProperties: false
      },
      outputSchema: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          filename: { type: "string" },
          bytes: { type: "number" },
          imageMimeType: { type: "string" },
          imageBase64: { type: "string" },
          error: { type: "string" }
        },
        required: ["success"],
        additionalProperties: false
      },
      execute: async (p) => {
        const ip = requireIp(p.ip);
        const password = requireDevPasswordParam(p.password);
        const result = await captureRokuScreenshot({
          ip,
          password,
          waitAfterTriggerMs: p.waitAfterTriggerMs
        });
        if (!result.success) {
          throw new RokuOpError("device_error", result.error || "Screenshot failed.");
        }
        const buf = result.imageBuffer;
        if (!buf || !Buffer.isBuffer(buf)) {
          throw new RokuOpError("device_error", "Screenshot succeeded but no image buffer was returned.");
        }
        const bytes = buf.length;
        const includeImage = p.returnImageBase64 !== false;
        const out = {
          success: true,
          filename: "dev.jpg",
          bytes,
          imageMimeType: "image/jpeg"
        };
        if (includeImage) {
          out.imageBase64 = buf.toString("base64");
        }
        return out;
      }
    };
    var SCAN_DEVICES = {
      id: "scan_devices",
      title: "Scan Network for Roku Devices",
      description: "Run SSDP discovery (multicast) and optionally a subnet HTTP sweep. Does not connect devices \u2014 follow up with connect_device to open a tab.",
      runIn: "main",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: {
          includeSubnetScan: { type: "boolean" },
          timeoutMs: { type: "number" }
        },
        additionalProperties: false
      },
      outputSchema: {
        type: "object",
        properties: {
          ssdp: { type: "array" },
          subnet: { type: "array" }
        },
        required: ["ssdp", "subnet"],
        additionalProperties: false
      },
      execute: async (p) => {
        const timeoutMs = typeof p.timeoutMs === "number" ? p.timeoutMs : 4e3;
        const ssdp = await ssdpDiscover({ timeoutMs });
        const subnet = p.includeSubnetScan ? await subnetScan({ timeoutMs }) : [];
        return { ssdp, subnet };
      }
    };
    var RALE_COMMAND = {
      id: "rale_command",
      title: "RALE Command (full; read + write)",
      description: "Run any built-in RALE command against the active App Connector session \u2014 including destructive ones (addRegistryField, removeRegistrySection, clearRegistry, \u2026). Use list_rale_builtins for the catalog. Every call surfaces as a toast in Dev Studio.",
      runIn: "renderer",
      destructive: true,
      inputSchema: {
        type: "object",
        properties: {
          device: { type: "string", description: "Optional target device (IP or serial)." },
          command: { type: "string", description: "RALE built-in command name." },
          args: { type: "object", additionalProperties: true }
        },
        required: ["command"],
        additionalProperties: false
      },
      outputSchema: PERMISSIVE_OBJECT_OUTPUT_SCHEMA,
      execute: rendererOnlyExecute("rale_command")
    };
    var APP_CONNECTOR_CONNECT = {
      id: "app_connector_connect",
      title: "App Connector: Connect",
      description: "Open a RALE / App Connector session against the device's running Dev App.",
      runIn: "renderer",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: { device: { type: "string" } },
        additionalProperties: false
      },
      outputSchema: PERMISSIVE_OBJECT_OUTPUT_SCHEMA,
      execute: rendererOnlyExecute("app_connector_connect")
    };
    var APP_CONNECTOR_DISCONNECT = {
      id: "app_connector_disconnect",
      title: "App Connector: Disconnect",
      description: "Close the RALE / App Connector session on the targeted device.",
      runIn: "renderer",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: { device: { type: "string" } },
        additionalProperties: false
      },
      outputSchema: PERMISSIVE_OBJECT_OUTPUT_SCHEMA,
      execute: rendererOnlyExecute("app_connector_disconnect")
    };
    var APP_FUNCTION = {
      id: "app_function",
      title: "App Connector: Call Channel Function",
      description: "Invoke a single function on the sideloaded channel through the App Connector. Use this for any one-off function call exposed by the channel; only wrap it in an `appFunction` Action Script step when the call is part of a multi-step flow. The set of available functions is **channel-specific** \u2014 every sideloaded app exports its own. **Always call `list_app_connector_functions` first** to discover the exact name and the declared parameter list (`params: [{ name, type }, \u2026]`) for the running channel before calling this tool. `functionParams` is a **positional array** with one entry per declared parameter, in declaration order. Each entry's value matches the declared `type`: `String`/`Integer`/`Boolean`/number types are primitives; `roAssociativeArray` is a JSON object (still wrapped in the outer array slot); `roArray` / `roList` is a JSON array (also wrapped). For a zero-arg function pass `[]`. A named object (`{ <paramName>: value }`, keyed by names from `list_app_connector_functions`) is accepted for backward compatibility and rewritten to a positional array before the call is sent. Authors should still emit positional form: a typo in a key silently passes `undefined` for that slot. Auto-connects the App Connector session if needed; surfaces the call as a toast in Dev Studio.",
      runIn: "renderer",
      destructive: true,
      inputSchema: {
        type: "object",
        properties: {
          device: { type: "string", description: "Optional target device (IP or serial). Omit to use the focused tab." },
          functionName: {
            type: "string",
            description: "The channel function name from list_app_connector_functions."
          },
          functionParams: {
            description: "Positional array of values, one per RALE-declared parameter. Use `[]` for zero-arg functions. A named object keyed by RALE param names is also accepted and will be normalized to positional before the call."
          }
        },
        required: ["functionName"],
        additionalProperties: false
      },
      outputSchema: PERMISSIVE_OBJECT_OUTPUT_SCHEMA,
      execute: rendererOnlyExecute("app_function")
    };
    var GET_TELNET_LOG = {
      id: "get_telnet_log",
      title: "Get Telnet / BrightScript Console Log",
      description: "Read lines from the BrightScript debug console (port 8085) buffer that Dev Studio holds in memory. Returns `{ lines, cursor, totalLines, connected }`. Pass `afterCursor` (the `cursor` from a previous call) to get only new lines \u2014 use this for polling. `maxLines` caps the response (default 500, max 2000). Lines only accumulate while the console is **connected**: if `connected` is false call `telnet_connect` first, then re-run this tool. The Roku 8085 telnet socket only allows one client at a time \u2014 `telnet_connect` will close any existing telnet session held by another tool/IDE before attaching.",
      runIn: "renderer",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: {
          device: { type: "string", description: "Optional target device (IP or serial)." },
          afterCursor: {
            type: "number",
            description: "Cursor returned by a previous call. Omit (or pass 0) for the full buffer."
          },
          maxLines: {
            type: "number",
            description: "Max lines to return (default 500, max 2000)."
          }
        },
        additionalProperties: false
      },
      outputSchema: {
        type: "object",
        properties: {
          lines: { type: "array" },
          cursor: { type: "number" },
          totalLines: { type: "number" },
          connected: { type: "boolean" }
        },
        additionalProperties: true
      },
      execute: rendererOnlyExecute("get_telnet_log")
    };
    var TELNET_CONNECT = {
      id: "telnet_connect",
      title: "Telnet Console: Connect",
      description: "Open the BrightScript debug console (TCP 8085) for the targeted device, exactly as if the user had clicked the Connect button on the Telnet Console tab. Idempotent: returns `{ connected: true, already: true }` when already attached. Lines do not accumulate until this is called. After it returns successfully, poll the buffer with `get_telnet_log({ afterCursor })`. Roku's 8085 socket is single-client: connecting here will displace another tool (e.g. an IDE telnet session) that may currently hold it.",
      runIn: "renderer",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: { device: { type: "string", description: "Optional target device (IP or serial). Omit to use the focused tab." } },
        additionalProperties: false
      },
      outputSchema: {
        type: "object",
        properties: {
          connected: { type: "boolean" },
          already: { type: "boolean" },
          error: { type: "string" }
        },
        additionalProperties: true
      },
      execute: rendererOnlyExecute("telnet_connect")
    };
    var TELNET_DISCONNECT = {
      id: "telnet_disconnect",
      title: "Telnet Console: Disconnect",
      description: "Close the BrightScript debug console (TCP 8085) for the targeted device, mirroring the Disconnect button. Idempotent: returns `{ connected: false, already: true }` when no session is open. Use this to release the 8085 socket so another tool can attach, or to stop log accumulation.",
      runIn: "renderer",
      destructive: false,
      inputSchema: {
        type: "object",
        properties: { device: { type: "string", description: "Optional target device (IP or serial). Omit to use the focused tab." } },
        additionalProperties: false
      },
      outputSchema: {
        type: "object",
        properties: {
          connected: { type: "boolean" },
          already: { type: "boolean" },
          error: { type: "string" }
        },
        additionalProperties: true
      },
      execute: rendererOnlyExecute("telnet_disconnect")
    };
    var ALL_OPS = Object.freeze([
      KEYPRESS,
      LAUNCH,
      INPUT_TEXT,
      DEEP_LINK,
      ECP_QUERY,
      ECP_POST,
      TEST_CONNECTION,
      GET_APP_ICON,
      SIDELOAD,
      DELETE_SIDELOAD,
      SCREENSHOT,
      SCAN_DEVICES,
      // Renderer-only ops (advertised in the tool catalog; executed via the renderer transport)
      RALE_COMMAND,
      APP_CONNECTOR_CONNECT,
      APP_CONNECTOR_DISCONNECT,
      APP_FUNCTION,
      GET_TELNET_LOG,
      TELNET_CONNECT,
      TELNET_DISCONNECT
    ]);
    var MAIN_OPS = Object.freeze(ALL_OPS.filter((op) => op.runIn === "main"));
    var RENDERER_OPS = Object.freeze(ALL_OPS.filter((op) => op.runIn === "renderer"));
    function findOp(id) {
      return ALL_OPS.find((op) => op.id === id);
    }
    async function runOp(op, params) {
      if (op.validate) {
        const issues = op.validate(params);
        if (issues.length > 0) {
          throw new RokuOpError(
            "invalid_arg",
            issues.map((i) => `${i.path}: ${i.message}`).join("; "),
            { details: { issues } }
          );
        }
      }
      try {
        return await op.execute(params);
      } catch (e) {
        throw toRokuOpError(e);
      }
    }
    async function runOpForHttp(op, body) {
      try {
        const params = body && typeof body === "object" && !Array.isArray(body) ? body : {};
        const data = await runOp(op, params);
        return {
          status: 200,
          body: data != null && typeof data === "object" ? data : { result: data }
        };
      } catch (e) {
        const err = toRokuOpError(e);
        return { status: err.toHttpStatus(), body: err.toWire() };
      }
    }
    function agentFacingSchema2(schema) {
      const props = schema.properties ? { ...schema.properties } : {};
      const hadIp = "ip" in props;
      if (hadIp) {
        delete props.ip;
        props.device = {
          type: "string",
          description: 'Target device \u2014 IP (e.g. "192.168.1.154") or serial (e.g. "X00046N6S6F"). Omit to use the focused device.'
        };
      }
      const required = (schema.required || []).filter((r) => r !== "ip");
      return {
        type: "object",
        properties: props,
        ...required.length > 0 ? { required } : {},
        additionalProperties: schema.additionalProperties ?? false
      };
    }
    function opToMcpTool2(op, executor) {
      const run = executor || ((p) => runOp(op, p));
      return {
        name: op.id,
        title: op.title,
        description: op.description,
        inputSchema: agentFacingSchema2(op.inputSchema),
        destructive: op.destructive,
        handler: async (args) => {
          try {
            const data = await run(args);
            const text = JSON.stringify(data, null, 2);
            return { content: [{ type: "text", text }], structuredContent: data };
          } catch (e) {
            const err = toRokuOpError(e);
            return {
              content: [{ type: "text", text: `${err.code}: ${err.message}` }],
              isError: true,
              structuredContent: err.toWire()
            };
          }
        }
      };
    }
    module2.exports = {
      // Individual ops (for bespoke transports that want direct refs)
      KEYPRESS,
      LAUNCH,
      INPUT_TEXT,
      DEEP_LINK,
      ECP_QUERY,
      ECP_POST,
      TEST_CONNECTION,
      GET_APP_ICON,
      SIDELOAD,
      DELETE_SIDELOAD,
      SCREENSHOT,
      SCAN_DEVICES,
      RALE_COMMAND,
      APP_CONNECTOR_CONNECT,
      APP_CONNECTOR_DISCONNECT,
      // Collections
      ALL_OPS,
      MAIN_OPS,
      RENDERER_OPS,
      findOp,
      // Adapters
      runOp,
      runOpForHttp,
      opToMcpTool: opToMcpTool2
    };
  }
});

// src/validator.ts
var { validateScript: validateActionScriptCanonical } = require_validate_action_script();
function validateScript(input) {
  return validateActionScriptCanonical(input);
}

// src/bridge-client.ts
var http = __toESM(require("http"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));
var APP_NAME = "Roku Dev Studio";
var BRIDGE_FILE_NAME = "mcp-bridge.json";
var REQUEST_TIMEOUT_MS = 35e3;
function getUserDataDir() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_NAME);
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, APP_NAME);
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(xdg, APP_NAME);
}
function getBridgeDescriptorPath() {
  if (process.env.RDS_MCP_BRIDGE_FILE) return process.env.RDS_MCP_BRIDGE_FILE;
  return path.join(getUserDataDir(), BRIDGE_FILE_NAME);
}
function readBridgeDescriptor() {
  const file = getBridgeDescriptorPath();
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.port === "number" && typeof parsed.token === "string" && typeof parsed.pid === "number" && typeof parsed.startedAt === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    const code = e instanceof Error ? e.code : null;
    return code === "EPERM";
  }
}
var STATUS_CACHE_TTL_MS = 3e3;
var cachedStatus = null;
var cachedStatusAt = 0;
function invalidateBridgeStatusCache() {
  cachedStatus = null;
  cachedStatusAt = 0;
}
async function getBridgeStatus() {
  const now = Date.now();
  if (cachedStatus && now - cachedStatusAt < STATUS_CACHE_TTL_MS) {
    return cachedStatus;
  }
  const descriptor = readBridgeDescriptor();
  if (!descriptor) {
    cachedStatus = { live: false, reason: "No bridge descriptor \u2014 Roku Dev Studio is not running." };
    cachedStatusAt = now;
    return cachedStatus;
  }
  if (!isProcessAlive(descriptor.pid)) {
    cachedStatus = { live: false, reason: "Roku Dev Studio process is no longer running (stale descriptor)." };
    cachedStatusAt = now;
    return cachedStatus;
  }
  cachedStatus = { live: true, descriptor };
  cachedStatusAt = now;
  return cachedStatus;
}
async function bridgeRequest(req) {
  const status = await getBridgeStatus();
  if (!status.live) {
    return { ok: false, status: 0, error: status.reason };
  }
  const { descriptor } = status;
  return new Promise((resolve) => {
    const bodyStr = req.body == null ? void 0 : JSON.stringify(req.body);
    const headers = {
      "Authorization": `Bearer ${descriptor.token}`,
      "Accept": "application/json"
    };
    if (bodyStr != null) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(bodyStr).toString();
    }
    const r = http.request(
      {
        host: "127.0.0.1",
        port: descriptor.port,
        method: req.method,
        path: req.pathname,
        headers,
        timeout: REQUEST_TIMEOUT_MS
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          let parsed = text;
          if (text) {
            try {
              parsed = JSON.parse(text);
            } catch {
            }
          }
          const code = res.statusCode || 0;
          if (code >= 200 && code < 300) {
            resolve({ ok: true, status: code, body: parsed });
          } else {
            const errMsg = parsed && typeof parsed === "object" && parsed !== null && "error" in parsed ? String(parsed.error) : `HTTP ${code}`;
            resolve({ ok: false, status: code, error: errMsg });
          }
        });
      }
    );
    r.on("error", (err) => {
      invalidateBridgeStatusCache();
      resolve({ ok: false, status: 0, error: err.message });
    });
    r.on("timeout", () => {
      r.destroy();
      resolve({ ok: false, status: 0, error: "Bridge request timed out" });
    });
    if (bodyStr != null) r.write(bodyStr);
    r.end();
  });
}

// src/prose/action-script-contract.md
var action_script_contract_default = '## Action Script JSON (validate_script / send_script_to_builder)\n\n### When to use Action Scripts vs direct ops\n\nThis server exposes two ways to act on a Roku \u2014 **before** authoring a script, confirm it is the right surface.\n\n1. **Direct ops** \u2014 one-shot tools that do exactly one thing: `keypress`, `launch_app`, `input_text`, `deep_link`, `ecp_query`, `ecp_post`, `rale_command`, `app_function`, `screenshot`, `sideload`, `delete_sideload`, `test_connection`, `scan_devices`, `get_app_icon`, `app_connector_connect` / `app_connector_disconnect`, `rale_get_node_by_id`, `telnet_connect` / `telnet_disconnect` / `get_telnet_log`.\n2. **Action Scripts** \u2014 `validate_script` + `send_script_to_builder`. The script opens in the Builder for human review; nothing runs automatically.\n\n**Pick a direct op when:**\n- The task is a single deterministic action (press Home, launch YouTube, send one POST, run one RALE built-in, **call one App Connector Function** via `app_function`, read `/query/active-app`, take one screenshot).\n- You do not need ordering, conditions, polling waits, variables, or user review.\n- The user asked you to "just do X" without asking for a saved / shareable script.\n\n**Specifically for App Connector Functions:** use the **`app_function`** direct tool, not an `appFunction` script step. The script step is only for when the function call is part of a multi-step flow (e.g. connect \u2192 call \u2192 wait for player state \u2192 screenshot). One function call in isolation should never be a one-step script.\n\nThe set of functions a channel exposes is entirely channel-specific \u2014 every sideloaded app exports its own (the function names visible in this report or any chat history are examples from one specific channel and will not exist on another). **Always call `list_app_connector_functions` first** to read the exact names and declared param shapes for the running channel before you author the call.\n\n**Pick an Action Script when:**\n- The task has **multiple ordered steps**, **conditional logic** (`if`), **polling waits** (`wait` with a condition), **variables**, or **screenshots tied to a repro flow**.\n- The user wants to **save, share, or re-run** the flow later.\n- The task is destructive enough that the user should **review it before running** (sideload + launch + deep-link combos, bulk registry writes, unfamiliar POST endpoints).\n\n**Rule of thumb:** if you would write a single direct-op call, call it directly. Only wrap it in a script when you would otherwise write a `while`/`if`/`for` around it or when the user explicitly wants a saved artifact.\n\n### Root object\n- `version`: optional string `"1"` (default) or `"2"`. **Required `"2"`** if any step has `"type": "if"`.\n- `steps`: **required** array of step objects. Every step **must** include `"type"` (see list_action_types / get_action_schema).\n\n### appFunction steps\n\n**Prefer the `app_function` direct tool** for a single function call. Only use this step when the call is part of a larger script.\n\nDiscovery first: call **`list_app_connector_functions`** to read the channel\'s function list. Each entry has `name`, `params: [{ name, type }, \u2026]`, and an optional `description` string when the channel includes one in its payload. The function names, parameter shapes, and descriptions are channel-specific \u2014 do not assume a function exists across apps. Surface the `description` verbatim to the user when explaining what a function does.\n\n#### Step shape\n\n- `type`: `"appFunction"`.\n- `functionName`: string \u2014 exactly one of the names returned by `list_app_connector_functions`.\n- `functionParams`: **a positional array** with one entry per declared parameter, in declaration order. Each entry\'s value matches the declared `type`:\n  - declared `type: "String"` \u2192 JSON string\n  - declared `type: "Boolean"` \u2192 JSON boolean\n  - declared `type: "Integer" | "LongInteger" | "Float" | "Double"` \u2192 JSON number\n  - declared `type: "roAssociativeArray"` \u2192 JSON object (still wrapped in the outer array slot)\n  - declared `type: "roArray" | "roList"` \u2192 JSON array (still wrapped in the outer array slot)\n  - zero declared params \u2192 `[]`\n- `assignToVar` (optional): string \u2014 variable name to bind the return value to for later steps.\n\nThe list of supported declared types is fixed by the channel-side App Connector implementation and is documented in the in-app **Integration Guide** modal (Settings \u2192 Integration Guide); the agent does not need to know it beyond what `list_app_connector_functions` returns for the running channel.\n\n#### Shape templates\n\n(Substitute `<FunctionName>` and the values for whatever `list_app_connector_functions` returned.)\n\n| Declared `params[]`                                  | `functionParams` you send  |\n| ---                                                  | ---                        |\n| `[]` (zero-arg)                                      | `[]`                       |\n| `[{ name, type: "String" }]`                         | `[ "<value>" ]`            |\n| `[{ name, type: "roAssociativeArray" }]`             | `[ { /* fields */ } ]`     |\n| `[{ name, type: "roArray" }]`                        | `[ [ /* items */ ] ]`      |\n| `[{ name: a, type: T0 }, { name: b, type: T1 }]`     | `[ <a-value>, <b-value> ]` |\n\nTwo-arg example (e.g. one String + one Boolean):\n\n```json\n{\n  "type": "appFunction",\n  "functionName": "<FunctionName>",\n  "functionParams": [ "<string-value>", true ]\n}\n```\n\nSingle-`roAssociativeArray` example \u2014 note the **outer one-element array wrapping** the object payload:\n\n```json\n{\n  "type": "appFunction",\n  "functionName": "<FunctionName>",\n  "functionParams": [\n    { /* fields */ }\n  ]\n}\n```\n\n#### Common shape mistake\n\nSending the inner object directly without the outer array \u2014 e.g. `"functionParams": { "fooKey": \u2026, "barKey": \u2026 }` \u2014 is a different shape than what the channel reads, and the call will silently no-op at runtime.\n\nValidation and the runtime tolerate two non-canonical shapes for backward compatibility, but **do not author them**:\n\n1. A named object keyed by the declared param names (`"functionParams": { "<paramName>": value }`) \u2014 both runtimes auto-rewrite it to a positional array using the function list. Relies on every key matching a declared param name exactly; a typo silently passes `undefined` for that slot.\n2. The same single object as above but missing the param-name key \u2014 silently treated as a single positional value with mismatched declared type.\n\nThe validator only hard-rejects primitive values (string / number / boolean) for `functionParams`, where there\'s nothing to normalize.\n\n### wait steps (condition.source === "media-player")\n- Either `delayMs` (number, fixed wait) **or** `condition` (object).\n- For media-player, set `"source": "media-player"` explicitly. Satisfy the wait with **any one** of:\n  - `state`: one of **play | pause | buffer | close | startup | stop** (see list_media_player_states), or\n  - `check`: string expression evaluated against parsed player XML, or\n  - RALE-style: `field: "state"`, `operator: "equals"`, `value`: same state vocabulary as above.\n- Common optional fields: `timeoutMs`, `pollIntervalMs`.\n\n### wait / if \u2014 rale-node-field\n- `path`: array (use `[]` for root), `id`: string, `field`: string, `operator`, `value` when the operator requires it. See describe_rale_node_field_operators.\n\n### Other rules\n- Call **get_authoring_rules** for hard constraints (e.g. never embed `devPassword` in JSON).\n- **device** on bridge tools: optional string \u2014 Roku **IP** or **serial**; omit to use the device tab the user has focused in Dev Studio.\n\n### Suggested tool order for authoring\n1. probe_bridge \u2192 2. get_capability_bundle + get_authoring_rules \u2192 3. list_app_connector_functions \u2192 4. validate_script (fix until `ok: true`) \u2192 5. send_script_to_builder\n\n### Reading tool results\n- Success and validation responses are JSON in the tool **text** content and in **structuredContent** when the host supports it.\n- On validation failure, **humanSummary** lists each issue on one line; **errors[]** has `path`, `code`, `message`, and often `expected` for enums.\n';

// src/agent-contract.ts
var ACTION_SCRIPT_AGENT_CONTRACT = action_script_contract_default;
function formatValidationErrorsForAgent(errors) {
  if (!errors.length) return "No validation issues.";
  return errors.map((e, i) => {
    const loc = e.path ? `path=${e.path}` : "path=(script root)";
    const exp = e.expected !== void 0 ? ` | expected=${JSON.stringify(e.expected)}` : "";
    return `${i + 1}. [${e.code}] ${loc} \u2014 ${e.message}${exp}`;
  }).join("\n");
}
function wrapValidationForAgent(result) {
  const referenceTools = [
    "list_action_types",
    "get_action_schema",
    "list_app_connector_functions",
    "get_capability_bundle"
  ];
  return {
    ...result,
    humanSummary: result.ok ? "Validation passed. Script structure matches the catalog; appFunction names still must exist on the device (list_app_connector_functions) before run." : `Validation failed (${result.errors.length} issue(s)):
${formatValidationErrorsForAgent(result.errors)}`,
    referenceTools
  };
}

// src/prose/quick-start.md
var quick_start_default = '# Roku Dev Studio MCP \u2014 Quick Start\n\nYou are connected to the **roku-dev-studio** MCP server. It controls a Roku\ndevice through the Roku Dev Studio desktop app and exposes **two surfaces**:\n\n1. **Direct device ops** \u2014 one-shot tools that do exactly one thing:\n   `keypress`, `launch_app`, `input_text`, `deep_link`, `ecp_query`,\n   `ecp_post`, `rale_command`, `app_function`, `screenshot`, `sideload`,\n   `delete_sideload`, `test_connection`, `scan_devices`,\n   `get_app_icon`, `app_connector_connect` /\n   `app_connector_disconnect`, `rale_get_node_by_id`,\n   `telnet_connect` / `telnet_disconnect` / `get_telnet_log`.\n2. **Action Scripts** \u2014 `validate_script` + `send_script_to_builder`.\n   A script opens in the Builder UI for the human to review. Nothing runs\n   automatically.\n\n## 0. Pick the surface **before** picking tools\n\n- **Single deterministic action** \u2014 "press Home", "launch YouTube",\n  "send one POST", "run one RALE command", "GET /query/active-app",\n  "take a screenshot" \u2192 call the **direct op**. Do **not** author a script\n  just to wrap a single call.\n- **Multi-step flow, conditional logic (`if`), polling wait\n  (`wait` with a condition), variables, or something the user wants to\n  save / share / re-run / review first** \u2192 author an **Action Script**.\n- Rule of thumb: if you would write one tool call, make one tool call.\n  Wrap it in a script only when you would otherwise put a\n  `while` / `if` / `for` around it or when the user explicitly asked\n  for a saved artifact.\n\n## 1. Before doing anything (once per session)\n\n```\nprobe_bridge        \u2192 { live, port, pid, startedAt } | { live: false, reason }\n```\n\nIf `live` is **false**, stop and tell the user to open Roku Dev Studio.\nAfter one successful probe, call bridge-dependent tools (direct ops **and**\n`send_script_to_builder`) freely \u2014 no need to re-probe before each call.\n\n## 2. Load authoring knowledge **once** and cache it (only if authoring a script)\n\nRead the resource `roku-dev-studio://capability-bundle.json` (or call\n`get_capability_bundle`). It contains every static catalog you need:\n\n- action step schemas (keys of `actions`)\n- keypress / query / post presets\n- wait + if vocabularies (media-player states, active-app attributes)\n- RALE node-field operators + RALE built-ins\n- authoring rules (hard constraints)\n- op directory (main vs renderer)\n- the full **actionScriptAgentContract** (exact JSON shape + the\n  direct-vs-script decision)\n\nDo not re-fetch each turn. It does not change during a session. If you are\nonly making one direct-op call you usually do **not** need the bundle at all.\n\n## 3. Picking a device\n\n```\nlist_devices                    \u2192 every known device (connected + discovered)\nget_selected_device             \u2192 the currently-focused Dev Studio tab\nconnect_device({ device: "..." })   \u2192 open a tab (IP or serial)\n```\n\nFor every tool that talks to a device, `device` is **optional** \u2014 omit to\ntarget the focused tab.\n\n## 4. Doing a single action (direct ops path)\n\nExamples of tasks that should be one tool call, not a script:\n\n```\nkeypress({ key: "Home" })                 // press Home on the focused device\nlaunch_app({ appId: "837" })              // launch YouTube\ninput_text({ text: "hello" })             // type into the focused input\necp_query({ endpoint: "/query/active-app" })\necp_post({ endpoint: "/keypress/Home" })  // side-effecting POST\nrale_command({ command: "getNodeById",\n               args: { path: [], id: "my-node" } })\napp_function({ functionName: "<from-list_app_connector_functions>",\n               functionParams: [ /* positional values per the function\'s params */ ] })\n                                          // call one channel function via App Connector\nscreenshot({})                            // capture current screen\n```\n\nAll of them return immediately. Pick them over Action Scripts whenever the\ntask is a single, deterministic action.\n\n### 4a. App Connector Functions\n\nWhen the user asks you to invoke one function on the sideloaded channel,\n**use `app_function`, not an `appFunction` Action Script step.**\n\nThe function names a channel exposes are **entirely channel-specific** \u2014\nevery sideloaded app exports its own (function names mentioned in your\ntraining data, this report, or any prior chat are illustrative only and\nwill not exist on another channel). Never assume; always discover.\n\nRecipe:\n\n1. `list_app_connector_functions({ device? })` \u2014 discover the exact\n   `name`, read its declared `params[]` (each entry has a `name` and\n   a `type`, in declaration order), and read the optional `description`\n   string when present (channel-supplied, surface it verbatim to the user).\n2. `app_function({ functionName, functionParams: [ ...positional values... ] })`.\n   The tool auto-establishes the App Connector session if not already\n   open.\n\n#### `functionParams` shape\n\n`functionParams` is a **positional array** with one entry per declared\nparameter, in declaration order. The entry types match the `type` field\non each declared param:\n\n- declared `String` / `Integer` / `Boolean` / number types \u2192 primitive\n- declared `roAssociativeArray` \u2192 JSON object (still wrapped in the outer array slot)\n- declared `roArray` / `roList` \u2192 JSON array (still wrapped in the outer array slot)\n- zero declared params \u2192 `[]`\n\nA named object keyed by the declared param names\n(`{ "<paramName>": value }`) is tolerated for backward compatibility\nand rewritten to a positional array before the call is sent \u2014 but\n**do not author new calls in named-object form**: a typo in a key\nsilently passes `undefined` for that slot.\n\n#### Shape templates\n\n| Declared `params[]`                                  | `functionParams` you send  |\n| ---                                                  | ---                        |\n| `[]` (zero-arg)                                      | `[]`                       |\n| `[{ name, type: "String" }]`                         | `[ "<value>" ]`            |\n| `[{ name, type: "roAssociativeArray" }]`             | `[ { /* fields */ } ]`     |\n| `[{ name, type: "roArray" }]`                        | `[ [ /* items */ ] ]`      |\n| `[{ name: a, type: T0 }, { name: b, type: T1 }]`     | `[ <a-value>, <b-value> ]` |\n\nGeneric shape (substitute `<FunctionName>` and the values from\n`list_app_connector_functions`):\n\n```\napp_function({\n  functionName: "<FunctionName>",\n  functionParams: [\n    /* one entry per declared param, in RALE order;\n       use [] when the function takes no parameters */\n  ]\n})\n```\n\nNote the **outer array wrapping** in the single-`roAssociativeArray`\ncase. Sending the associative payload directly (no enclosing `[ ]`)\nis a different shape than what the channel reads, and the call will\nsilently no-op at runtime.\n\nOnly wrap an app function in an `appFunction` Action Script step when\nthe call is part of a larger flow (e.g. connect \u2192 call \u2192 wait for\nmedia-player state \u2192 screenshot). One function call in isolation should\nnever be a one-step script.\n\n## 5. Authoring a script (script path)\n\n1. Read `roku-dev-studio://action-script-contract.md` (or field\n   `actionScriptAgentContract` from the bundle).\n2. For any `appFunction` step, call\n   `list_app_connector_functions` so `functionName` and\n   `functionParams` keys/order match the sideloaded channel.\n3. Call `validate_script({ script })` and fix every entry in `errors[]`\n   until `ok: true`. The response includes `path`, `code`, and\n   `expected` per issue.\n4. Hand off with `send_script_to_builder({ script })`. This drops the\n   script into the Builder UI for the human to review and run \u2014 it does not\n   auto-execute.\n\nNever embed the Dev Password in script JSON. Dev Studio supplies it from\nlocal storage at run time.\n\n## 6. Live read-only lookups\n\n```\necp_query({ endpoint, device? })             \u2192 any ECP query\nrale_get_node_by_id({ id, path?, device? })  \u2192 scene graph read\n```\n\nUse these directly for inspection \u2014 don\'t wrap them in a script.\n\n## 7. BrightScript debug console (telnet on port 8085)\n\nReading `print` output / runtime errors from a sideloaded channel is a\n**three-step** flow. The Roku 8085 socket is single-client, so logs only\naccumulate while Dev Studio is actively attached.\n\n```\ntelnet_connect({ device? })                  \u2192 attach the 8085 socket (idempotent)\nget_telnet_log({ device?, afterCursor?, maxLines? })\n                                              \u2192 { lines, cursor, totalLines, connected }\ntelnet_disconnect({ device? })               \u2192 release the socket (idempotent)\n```\n\nRecipe \u2014 "show me what the channel just printed":\n\n1. `telnet_connect({})` once. (Skip if a previous call already returned\n   `{ connected: true }`.)\n2. Trigger whatever you want to observe (`keypress`, `launch_app`,\n   `appFunction` step, \u2026).\n3. Poll `get_telnet_log({ afterCursor })` \u2014 pass back the `cursor` from the\n   previous response so you only get **new** lines. Default page size is\n   500, max 2000.\n4. Optional: `telnet_disconnect({})` if you\'re done so other tools / IDEs\n   can attach to 8085 again.\n\nIf `get_telnet_log` returns `connected: false`, the buffer is empty\nbecause nothing is attached \u2014 call `telnet_connect` and retry rather than\nreporting "no logs". Connecting may displace another client (e.g. a\nBrightScript IDE) that currently holds 8085; surface that to the user when\nrelevant.\n\n## 8. Tools are tagged\n\nEvery tool carries MCP `annotations`:\n- `readOnlyHint` \u2014 safe to call without confirmation\n- `destructiveHint` \u2014 may reboot/launch/sideload; confirm with the user\n- `idempotentHint` \u2014 same args yield the same result\n- `openWorldHint` \u2014 touches an external device/network\n\nPrefer `readOnlyHint` tools for exploration; get user consent before any\n`destructiveHint` tool.\n';

// src/resources.ts
var catalogs = require_catalogs();
var operations = require_operations();
var RESOURCES = [
  {
    uri: "roku-dev-studio://quick-start.md",
    name: "quick-start",
    title: "Roku Dev Studio MCP \u2014 Quick Start",
    description: "One-page primer: bridge probe, capability loading, device selection, and the validate \u2192 send workflow. Read first.",
    mimeType: "text/markdown"
  },
  {
    uri: "roku-dev-studio://action-script-contract.md",
    name: "action-script-contract",
    title: "Action Script JSON contract",
    description: "Canonical shape for validate_script / send_script_to_builder inputs (root, appFunction params, wait / if conditions).",
    mimeType: "text/markdown"
  },
  {
    uri: "roku-dev-studio://capability-bundle.json",
    name: "capability-bundle",
    title: "Static capability bundle",
    description: "Every static catalog the agent needs in one JSON: actions, presets, vocabularies, RALE built-ins, authoring rules, op directory, and the agent contract.",
    mimeType: "application/json"
  },
  {
    uri: "roku-dev-studio://authoring-rules.json",
    name: "authoring-rules",
    title: "Hard authoring rules",
    description: "Constraints the agent must obey when generating Action Scripts (version, password handling, wait vs delay, \u2026).",
    mimeType: "application/json"
  }
];
function buildCapabilityBundle() {
  return {
    schemaVersion: 2,
    actionScriptAgentContract: ACTION_SCRIPT_AGENT_CONTRACT,
    scriptVersions: catalogs.SCRIPT_VERSIONS,
    actions: Object.keys(catalogs.STEP_SCHEMA).map((type) => ({
      type,
      ...catalogs.STEP_SCHEMA[type]
    })),
    keypress: { groups: catalogs.KEYPRESS_GROUPS, all: catalogs.KEYPRESS_OPTIONS },
    presets: { query: catalogs.QUERY_PRESETS, post: catalogs.POST_PRESETS },
    conditions: {
      waitSources: catalogs.WAIT_SOURCES,
      ifSources: catalogs.IF_SOURCES,
      mediaPlayerStates: catalogs.MEDIA_PLAYER_STATES,
      activeAppAttributes: catalogs.ACTIVE_APP_IF_ATTRIBUTES,
      raleNodeFieldOperators: catalogs.NODE_FIELD_OPERATOR_DEFS
    },
    devicePerformanceCharts: catalogs.DEVICE_PERFORMANCE_CHART_IDS,
    raleBuiltins: catalogs.RALE_BUILTINS,
    authoringRules: catalogs.AUTHORING_RULES,
    ops: operations.ALL_OPS.map((op) => ({
      id: op.id,
      title: op.title,
      runIn: op.runIn,
      destructive: op.destructive
    }))
  };
}
function buildCapabilityBundleJson() {
  return JSON.stringify(buildCapabilityBundle(), null, 2);
}
function listResources() {
  return RESOURCES;
}
function readResource(uri) {
  switch (uri) {
    case "roku-dev-studio://quick-start.md":
      return { uri, mimeType: "text/markdown", text: quick_start_default };
    case "roku-dev-studio://action-script-contract.md":
      return { uri, mimeType: "text/markdown", text: ACTION_SCRIPT_AGENT_CONTRACT };
    case "roku-dev-studio://capability-bundle.json":
      return { uri, mimeType: "application/json", text: buildCapabilityBundleJson() };
    case "roku-dev-studio://authoring-rules.json":
      return {
        uri,
        mimeType: "application/json",
        text: JSON.stringify({ rules: catalogs.AUTHORING_RULES }, null, 2)
      };
    default:
      return null;
  }
}

// src/output-schema-validator.ts
function describeRuntimeType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
function matchesType(value, t) {
  switch (t) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
  }
}
function joinPath(parent, key) {
  if (typeof key === "number") return `${parent}[${key}]`;
  if (parent === "") return key;
  return `${parent}.${key}`;
}
function validate(value, schema, path2, issues) {
  if (!schema) return;
  if (schema.type !== void 0) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      issues.push({
        path: path2 || "<root>",
        code: "type_mismatch",
        message: `expected ${types.join("|")}, got ${describeRuntimeType(value)}`
      });
      return;
    }
  }
  if (schema.enum && schema.enum.length > 0) {
    if (!schema.enum.some((v) => v === value)) {
      issues.push({
        path: path2 || "<root>",
        code: "enum_mismatch",
        message: `expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`
      });
    }
  }
  if (schema.type === "object" || Array.isArray(schema.type) && schema.type.includes("object")) {
    if (matchesType(value, "object")) {
      const obj = value;
      for (const k of schema.required || []) {
        if (!(k in obj)) {
          issues.push({
            path: joinPath(path2, k),
            code: "missing_required",
            message: `required property "${k}" is missing`
          });
        }
      }
      const props = schema.properties || {};
      for (const [k, v] of Object.entries(obj)) {
        if (k in props) {
          validate(v, props[k], joinPath(path2, k), issues);
        } else if (schema.additionalProperties === false) {
          issues.push({
            path: joinPath(path2, k),
            code: "extra_property",
            message: `property "${k}" is not declared in schema (additionalProperties=false)`
          });
        } else if (typeof schema.additionalProperties === "object") {
          validate(v, schema.additionalProperties, joinPath(path2, k), issues);
        }
      }
    }
  }
  if (schema.type === "array" || Array.isArray(schema.type) && schema.type.includes("array")) {
    if (matchesType(value, "array") && schema.items) {
      const arr = value;
      for (let i = 0; i < arr.length; i++) {
        validate(arr[i], schema.items, joinPath(path2, i), issues);
      }
    }
  }
}
function validateOutput(body, schema) {
  const issues = [];
  validate(body, schema, "", issues);
  return issues;
}
function logOutputSchemaIssues(opId, issues) {
  if (issues.length === 0) return;
  const sample = issues.slice(0, 5);
  for (const issue of sample) {
    console.error(
      `[output-schema] ${opId}: ${issue.path} \u2014 ${issue.code}: ${issue.message}`
    );
  }
  if (issues.length > sample.length) {
    console.error(`[output-schema] ${opId}: \u2026and ${issues.length - sample.length} more issue(s)`);
  }
}

// src/tools.ts
var catalogs2 = require_catalogs();
var operations2 = require_operations();
function jsonResult(value, options) {
  const body = JSON.stringify(value, null, 2);
  const text = options?.preamble ? `${options.preamble}

${body}` : body;
  return {
    content: [{ type: "text", text }],
    structuredContent: value,
    ...options?.isError ? { isError: true } : {}
  };
}
function errorResult(message, structured) {
  const text = structured !== void 0 ? `${message}

--- structured ---
${JSON.stringify(structured, null, 2)}` : message;
  return { content: [{ type: "text", text }], isError: true, structuredContent: structured };
}
function imageResultIfPresent(body) {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body;
  const base64 = typeof b.imageBase64 === "string" ? b.imageBase64 : null;
  const mimeType = typeof b.imageMimeType === "string" ? b.imageMimeType : "image/jpeg";
  if (!base64) return null;
  const { imageBase64: _dropped, ...meta } = b;
  const ip = typeof meta.ip === "string" && meta.ip ? meta.ip : "";
  const filename = typeof meta.filename === "string" && meta.filename ? meta.filename : "";
  const bytes = typeof meta.bytes === "number" && Number.isFinite(meta.bytes) ? meta.bytes : 0;
  const summary = "Screenshot" + (ip ? ` from ${ip}` : "") + (filename ? ` \u2014 ${filename}` : "") + (bytes ? `, ${formatBytes(bytes)}` : "") + ` (${mimeType})`;
  return {
    content: [
      { type: "text", text: summary },
      { type: "image", data: base64, mimeType }
    ],
    structuredContent: meta
  };
}
function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
function optionalDevice(args) {
  const v = args.device;
  if (typeof v !== "string") return void 0;
  const s = v.trim();
  return s ? s : void 0;
}
function bridgeToolFailure(label, res) {
  return errorResult(
    `${label}: ${res.error} (HTTP ${res.status}). If you have not already, call probe_bridge once to confirm Roku Dev Studio is running; also confirm the correct device tab is focused (or pass device).`,
    { httpStatus: res.status, bridgeError: res.error }
  );
}
function warnOnOutputSchemaMismatch(op, body) {
  if (!op.outputSchema) return;
  try {
    const issues = validateOutput(body, op.outputSchema);
    logOutputSchemaIssues(op.id, issues);
  } catch (e) {
    console.error(`[output-schema] ${op.id}: validator threw`, e);
  }
}
function agentFacingSchema(schema) {
  const props = schema.properties ? { ...schema.properties } : {};
  const hadIp = "ip" in props;
  if (hadIp) {
    delete props.ip;
    props.device = {
      type: "string",
      description: 'Target device \u2014 IP (e.g. "192.168.1.154") or serial (e.g. "X00046N6S6F"). Omit to use the focused device.'
    };
  }
  const required = (schema.required || []).filter((r) => r !== "ip");
  return {
    type: "object",
    properties: props,
    ...required.length > 0 ? { required } : {},
    additionalProperties: schema.additionalProperties ?? false
  };
}
function opToMcpTool(op) {
  const annotations = {
    readOnlyHint: !op.destructive,
    destructiveHint: op.destructive,
    idempotentHint: !op.destructive,
    openWorldHint: true
  };
  return {
    name: op.id,
    title: op.title,
    description: op.description,
    inputSchema: agentFacingSchema(op.inputSchema),
    annotations,
    handler: async (args) => {
      try {
        if (op.runIn === "main") {
          const res2 = await bridgeRequest({
            method: "POST",
            pathname: `/op/${op.id}`,
            body: args
          });
          if (!res2.ok) {
            return errorResult(
              `Tool "${op.id}" failed: ${res2.error} (HTTP ${res2.status}). If you have not already, call probe_bridge once to confirm Dev Studio is running; also confirm the correct device tab is focused (or pass device).`,
              { tool: op.id, httpStatus: res2.status, bridgeError: res2.error }
            );
          }
          warnOnOutputSchemaMismatch(op, res2.body);
          return imageResultIfPresent(res2.body) ?? jsonResult(res2.body);
        }
        const device = optionalDevice(args);
        const payload = { tool: op.id, args };
        if (device) payload.device = device;
        const res = await bridgeRequest({ method: "POST", pathname: "/tool", body: payload });
        if (!res.ok) {
          return errorResult(
            `Tool "${op.id}" failed: ${res.error} (HTTP ${res.status}). If you have not already, call probe_bridge once to confirm Dev Studio is running; also confirm the correct device tab is focused (or pass device).`,
            { tool: op.id, httpStatus: res.status, bridgeError: res.error }
          );
        }
        warnOnOutputSchemaMismatch(op, res.body);
        return imageResultIfPresent(res.body) ?? jsonResult(res.body);
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
    }
  };
}
var OP_BACKED_TOOLS = operations2.ALL_OPS.map((op) => opToMcpTool(op));
function listActionTypes() {
  const types = Object.keys(catalogs2.STEP_SCHEMA).map((type) => ({
    type,
    label: catalogs2.STEP_SCHEMA[type].label,
    description: catalogs2.STEP_SCHEMA[type].description,
    required: catalogs2.STEP_SCHEMA[type].required,
    optional: catalogs2.STEP_SCHEMA[type].optional
  }));
  return jsonResult({ scriptVersions: [...catalogs2.SCRIPT_VERSIONS], actions: types });
}
function getActionSchema(args) {
  const type = String(args.type || "").trim();
  if (!type || !(type in catalogs2.STEP_SCHEMA)) {
    return errorResult(
      `Unknown step type "${type || "(empty)"}". Required argument "type" must be one of the keys from list_action_types.`,
      { code: "unknown_action_type", argument: "type", received: type || null, expected: Object.keys(catalogs2.STEP_SCHEMA) }
    );
  }
  return jsonResult({ type, ...catalogs2.STEP_SCHEMA[type] });
}
function getCapabilityBundle() {
  return jsonResult(buildCapabilityBundle());
}
async function probeBridge() {
  const status = await getBridgeStatus();
  if (status.live) {
    return jsonResult({
      live: true,
      pid: status.descriptor.pid,
      port: status.descriptor.port,
      startedAt: status.descriptor.startedAt
    });
  }
  return jsonResult({ live: false, reason: status.reason });
}
async function getSelectedDevice() {
  const res = await bridgeRequest({ method: "GET", pathname: "/selected-device" });
  if (!res.ok) return bridgeToolFailure("get_selected_device", res);
  return jsonResult(res.body);
}
async function listDevices() {
  const res = await bridgeRequest({ method: "GET", pathname: "/devices" });
  if (!res.ok) return bridgeToolFailure("list_devices", res);
  return jsonResult(res.body);
}
async function listAppConnectorFunctions(args) {
  const device = optionalDevice(args);
  const pathname = device ? `/app-connector/functions?device=${encodeURIComponent(device)}` : "/app-connector/functions";
  const res = await bridgeRequest({ method: "GET", pathname });
  if (!res.ok) return bridgeToolFailure("list_app_connector_functions", res);
  return jsonResult(res.body);
}
async function connectDeviceTool(args) {
  const device = optionalDevice(args);
  if (!device) {
    return errorResult(
      'Missing required argument "device". Pass a string: Roku IP (e.g. "192.168.1.75") or serial from list_devices.',
      { code: "missing_device", argument: "device" }
    );
  }
  const res = await bridgeRequest({ method: "POST", pathname: "/connect-device", body: { device } });
  if (!res.ok) return bridgeToolFailure("connect_device", res);
  return jsonResult(res.body);
}
function validateScriptTool(args) {
  let script = args.script;
  if (typeof script === "string") {
    try {
      script = JSON.parse(script);
    } catch (e) {
      return errorResult(
        `Invalid input: could not parse argument "script" as JSON \u2014 ${e instanceof Error ? e.message : String(e)}. Pass a JSON object or a string containing the full script JSON.`,
        { code: "script_parse_error", argument: "script" }
      );
    }
  }
  if (script == null) {
    return errorResult(
      'Invalid input: missing required argument "script". Provide the Action Script as a JSON object (preferred) or as a JSON string.',
      { code: "missing_script", argument: "script" }
    );
  }
  if (typeof script !== "object" || Array.isArray(script)) {
    return errorResult(
      'Invalid input: "script" must be a JSON object with at least a "steps" array, not an array or primitive.',
      { code: "script_not_object", received: typeof script }
    );
  }
  const raw = validateScript(script);
  const payload = wrapValidationForAgent(raw);
  if (!payload.ok) {
    return jsonResult(payload, {
      preamble: "Action Script validation failed (ok=false). Fix every entry in `errors` (use `path` and `code`). `humanSummary` duplicates the same issues in plain text. See `referenceTools` for which discovery tools to call next.",
      isError: true
    });
  }
  return jsonResult(payload, {
    preamble: "Action Script validation succeeded (ok=true). Before handing this script to the Builder with send_script_to_builder, confirm appFunction names still match list_app_connector_functions for that channel. (Reminder: for a single deterministic action, prefer the matching direct op \u2014 keypress / launch_app / ecp_post / rale_command / screenshot \u2014 over an Action Script.)"
  });
}
async function sendScriptToBuilder(args) {
  let script = args.script;
  if (typeof script === "string") {
    try {
      script = JSON.parse(script);
    } catch (e) {
      return errorResult(
        `Invalid input: could not parse "script" as JSON \u2014 ${e instanceof Error ? e.message : String(e)}.`,
        { code: "script_parse_error", argument: "script" }
      );
    }
  }
  if (script == null) {
    return errorResult('Invalid input: missing required argument "script".', {
      code: "missing_script",
      argument: "script"
    });
  }
  if (typeof script !== "object" || Array.isArray(script)) {
    return errorResult('Invalid input: "script" must be a JSON object with a "steps" array.', {
      code: "script_not_object"
    });
  }
  const validation = validateScript(script);
  if (!validation.ok) {
    const wrapped = wrapValidationForAgent(validation);
    return errorResult(
      `Refusing to send: the same structural checks as validate_script failed.

${formatValidationErrorsForAgent(validation.errors)}

Call validate_script with this script, fix every error until ok=true, then retry send_script_to_builder.`,
      wrapped
    );
  }
  const device = optionalDevice(args);
  const res = await bridgeRequest({
    method: "POST",
    pathname: "/builder/drop-script",
    body: device ? { script, device } : { script }
  });
  if (!res.ok) {
    return errorResult(
      `Bridge refused drop-script: ${res.error} (HTTP ${res.status}). Dev Studio must be running with Action Scripts / Builder available on the target tab.`,
      { httpStatus: res.status, bridgeError: res.error, device: device || null }
    );
  }
  return jsonResult({
    delivered: true,
    note: "Script handed off to the Roku Dev Studio Builder. Ask the user to review and run.",
    bridge: res.body,
    inputReminder: "Arguments used: script (object), device (optional). Same script shape as validate_script; see get_capability_bundle.actionScriptAgentContract."
  });
}
async function raleGetNodeByIdTool(args) {
  const path2 = Array.isArray(args.path) ? args.path : [];
  const id = String(args.id || "").trim();
  if (!id) {
    return errorResult('Missing required argument "id" (non-empty string).', {
      code: "missing_id",
      argument: "id"
    });
  }
  const device = optionalDevice(args);
  const payload = {
    tool: "rale_command",
    args: { command: "getNodeById", args: { path: path2, id } }
  };
  if (device) payload.device = device;
  const res = await bridgeRequest({ method: "POST", pathname: "/tool", body: payload });
  if (!res.ok) return bridgeToolFailure("rale_get_node_by_id", res);
  return jsonResult(res.body);
}
var BESPOKE_TOOLS = [
  {
    name: "list_action_types",
    title: "List Action Types",
    description: "Return every supported Action Script step `type` (with label, description, required / optional fields). For the full authoring contract call `get_capability_bundle` once or read resource `roku-dev-studio://action-script-contract.md`.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    handler: async () => listActionTypes()
  },
  {
    name: "get_action_schema",
    title: "Get Action Schema",
    description: "Return the schema for one Action step type. Required argument `type` \u2014 must be one of the values from `list_action_types` (also enumerated in inputSchema).",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Exact step type key from list_action_types (e.g. appFunction, wait, keypress).",
          enum: Object.keys(catalogs2.STEP_SCHEMA)
        }
      },
      required: ["type"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    handler: async (args) => getActionSchema(args)
  },
  {
    name: "get_capability_bundle",
    title: "Get Capability Bundle",
    description: "Single payload of every static capability (actions, vocabularies, RALE built-ins, presets, authoring rules, op directory, `actionScriptAgentContract`). Load **once** before authoring scripts, then cache. Same JSON is also available as resource `roku-dev-studio://capability-bundle.json`.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    handler: async () => getCapabilityBundle()
  },
  {
    name: "validate_script",
    title: "Validate Action Script",
    description: "Validate an Action Script before `send_script_to_builder`. Argument `script`: JSON object or JSON string. Response: `ok`, `errors[]` (path, code, message, expected?), `stepCounts`, `humanSummary`, `referenceTools`. `ok=false` is returned as isError. Contract: resource `roku-dev-studio://action-script-contract.md`. Only author a script for **multi-step / conditional / polling / saved-or-reviewed** flows \u2014 for a single action use the matching direct op (keypress, launch_app, rale_command, ecp_query, ecp_post, screenshot, \u2026).",
    inputSchema: {
      type: "object",
      properties: {
        script: {
          description: 'Required. The script root object: at minimum `{ "steps": [ ... ] }`, optionally `version`, `name`, `description`. Pass as a native JSON object, or as a single JSON **string** that parses to that object (not double-encoded).',
          oneOf: [{ type: "object" }, { type: "string" }]
        }
      },
      required: ["script"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    handler: async (args) => validateScriptTool(args)
  },
  {
    name: "probe_bridge",
    title: "Probe Dev Studio Bridge",
    description: "Returns `{ live, port, pid, startedAt }` or `{ live: false, reason }`. Call **once per session** before the first bridge-dependent tool; once `live=true`, call direct ops (keypress, launch_app, ecp_query, rale_command, \u2026) and `send_script_to_builder` freely without re-probing.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => probeBridge()
  },
  {
    name: "get_selected_device",
    title: "Get Selected Device",
    description: "Device the user is currently focused on in Dev Studio.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => getSelectedDevice()
  },
  {
    name: "list_devices",
    title: "List All Known Devices",
    description: "Every device Dev Studio knows about (connected, discovered, remembered, remote). Entries: `ip`, `serial`, `modelName`, `friendlyDeviceName`, `softwareVersion`, `source`, `isConnected`, `isFocused`.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => listDevices()
  },
  {
    name: "connect_device",
    title: "Connect to a Device",
    description: "Open or focus a Dev Studio tab. Required `device`: Roku IP or serial. Idempotent if already connected.",
    inputSchema: {
      type: "object",
      properties: {
        device: {
          type: "string",
          description: "Required non-empty string: LAN IP or device serial exactly as shown by list_devices."
        }
      },
      required: ["device"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    handler: async (args) => connectDeviceTool(args)
  },
  {
    name: "list_app_connector_functions",
    title: "List App Connector Functions",
    description: "Live `functionName` + parameter metadata from RALE `getExternalControlFunctions`. Each entry has `name`, `params: [{ name, type }, \u2026]`, and an optional `description` string when the channel includes one in its payload \u2014 surface that description verbatim to the user when explaining what a function does. Call before authoring `appFunction` steps so names and param keys/order match. Optional `device` (IP or serial).",
    inputSchema: {
      type: "object",
      properties: {
        device: {
          type: "string",
          description: "Optional. Roku IP or serial; must match a connected Dev Studio tab when set."
        }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (args) => listAppConnectorFunctions(args)
  },
  {
    name: "rale_get_node_by_id",
    title: "RALE: Get Node by ID",
    description: "Read-only `getNodeById` via App Connector. Required `id`. Optional `path` (array; default `[]`), `device`.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "array",
          description: "Optional. Scene graph path segments; use [] or omit for root.",
          items: { oneOf: [{ type: "string" }, { type: "number" }] }
        },
        id: { type: "string", description: "Required. Node id string from the scene / registry." },
        device: { type: "string", description: "Optional. IP or serial for a specific Dev Studio device tab." }
      },
      required: ["id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (args) => raleGetNodeByIdTool(args)
  },
  {
    name: "send_script_to_builder",
    title: "Send Script to Builder",
    description: "Drop a validated Action Script into Dev Studio Builder for human review (does not auto-run). Runs the same validation as `validate_script`. Arguments: `script` (object or JSON string), optional `device`. **Use only for multi-step / conditional / saved-or-reviewed flows** \u2014 if the task is a single deterministic action (one keypress, one launch, one RALE command, one ECP query/POST, one screenshot), call the matching direct op (`keypress`, `launch_app`, `rale_command`, `ecp_query`, `ecp_post`, `screenshot`, \u2026) directly instead of wrapping it in a one-step script.",
    inputSchema: {
      type: "object",
      properties: {
        script: {
          description: "Required. Same shape as for validate_script: object with `steps` array, or a JSON string that parses to that object.",
          oneOf: [{ type: "object" }, { type: "string" }]
        },
        device: {
          type: "string",
          description: "Optional. Target Roku IP (e.g. 192.168.1.75) or serial. Must match an open Dev Studio device tab when provided."
        }
      },
      required: ["script"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    handler: async (args) => sendScriptToBuilder(args)
  }
];
var byName = /* @__PURE__ */ new Map();
for (const t of BESPOKE_TOOLS) byName.set(t.name, t);
for (const t of OP_BACKED_TOOLS) byName.set(t.name, t);
var TOOLS = Array.from(byName.values());
function findTool(name) {
  return byName.get(name);
}

// src/prose/prompts/one-shot-action.md
var one_shot_action_default = "You are going to perform a **single deterministic action** on a Roku device by calling **one direct op tool** \u2014 not by authoring an Action Script.\n\n## Action requested\n{{actionDisplay}}\n\n## Target\nDevice: {{deviceDisplay}}\n\n## Workflow\n1. Call `probe_bridge` once. If `live` is false, stop and ask the user to open Roku Dev Studio.\n2. Pick the single direct op that matches the action:\n   - Remote key \u2192 `keypress({ key })`\n   - Launch a channel \u2192 `launch_app({ appId, params? })`\n   - Deep-link into a channel \u2192 `deep_link({ appId, contentId?, mediaType? })`\n   - Type into focused input \u2192 `input_text({ text })`\n   - Read anything over ECP \u2192 `ecp_query({ endpoint })`\n   - POST anything over ECP \u2192 `ecp_post({ endpoint })` (destructive)\n   - Run a RALE built-in (including registry / node-update) \u2192 `rale_command({ command, args })`\n   - SceneGraph read-only lookup \u2192 `rale_get_node_by_id({ id, path? })`\n   - Screenshot \u2192 `screenshot({})`\n   - Install / remove dev channel \u2192 `sideload({ filePath })` / `delete_sideload({})` (destructive)\n   - Device reachability \u2192 `test_connection({ ip })`\n   - Discover Rokus on LAN \u2192 `scan_devices({ includeSubnetScan? })`\n3. Call it. Pass `device` only if the user named a specific IP / serial; otherwise omit it to target the focused tab.\n4. Summarise the result in plain text; surface any `isError=true` response verbatim.\n\n## Do NOT\n- Do **not** call `validate_script` or `send_script_to_builder` for this task \u2014 those are for multi-step / conditional / saved flows. Wrapping a single action in a one-step Action Script is an anti-pattern.\n- Do **not** load `get_capability_bundle` for a single keypress / launch / query. It is not needed here.\n- Do **not** re-call `probe_bridge` before every op. One probe per session is enough.\n\n## When to fall back to a script\nIf this turns out to need multiple ordered steps, a conditional, a polling wait, variables, or something the user wants saved for re-use, **stop and switch to the `roku-action-script-quickstart` prompt instead**.\n\n## Safety\nTools tagged `destructiveHint` (launch/sideload/delete/reboot/ecp_post/rale_command-destructive) still require explicit user consent before firing.\n";

// src/prose/prompts/action-script-quickstart.md
var action_script_quickstart_default = "You are going to author and deliver a Roku Dev Studio Action Script for a **multi-step / conditional / saved-or-reviewed** flow. If the task is a single deterministic action, stop and use the `roku-one-shot-action` prompt instead.\n\n{{goalSection}}## Confirm this is actually script-shaped\nOnly proceed with this workflow when the task has at least one of:\n- Multiple ordered steps that depend on each other.\n- Conditional logic (`if`) or polling waits (`wait` with a condition).\n- Variables captured from one step and reused later.\n- A repro flow the user wants to save, share, or re-run.\n- Destructive work the user should **review in Builder before running**.\n\nOtherwise, call the matching direct op (`keypress`, `launch_app`, `ecp_query`, `rale_command`, `screenshot`, \u2026) once and return.\n\n## Required workflow\n1. Call `probe_bridge`. If `live` is false, stop and ask the user to open Roku Dev Studio.\n2. Read resource `roku-dev-studio://quick-start.md` **and** `roku-dev-studio://action-script-contract.md` (or call `get_capability_bundle` once). Do **not** refetch during the session.\n3. Call `list_devices` / `get_selected_device` if you need to pick a device; otherwise omit `device` to use the focused tab.\n4. For any `appFunction` step, call `list_app_connector_functions` so `functionName` and `functionParams` exactly match the sideloaded channel.\n5. Call `validate_script({ script })` and fix every `errors[]` entry until `ok: true`.\n6. Call `send_script_to_builder({ script })`. The human reviews in Builder and runs it.\n\n## Hard rules\n- Never embed `devPassword` in the script JSON.\n- Prefer `readOnlyHint` tools for exploration. Ask the user before any `destructiveHint` tool (launch/sideload/reboot).\n- Use structured fields (`path`, `code`, `expected`) from validation errors \u2014 do not paraphrase.\n";

// src/prose/prompts/debug-device.md
var debug_device_default = "You are going to inspect a Roku device using read-only tools only.\n\n{{targetSection}}## Workflow\n1. `probe_bridge` \u2014 confirm Roku Dev Studio is running.\n2. `list_devices` / `get_selected_device` \u2014 pick a target. Use `device`={{deviceForUse}}.\n3. `ecp_query` for ECP reads (e.g. `active-app`, `device-info`, `media-player`).\n4. `rale_get_node_by_id` for SceneGraph node reads when App Connector is connected.\n5. Summarise findings; never call destructive tools without explicit user consent.\n";

// src/prompts.ts
function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => key in vars ? vars[key] : "");
}
var PROMPTS = [
  {
    name: "roku-one-shot-action",
    title: "Roku: One-shot Direct Action",
    description: "Primes the agent to perform a single deterministic action (keypress, launch, ecp_query/post, rale_command, screenshot, \u2026) via a direct op \u2014 **not** by authoring an Action Script.",
    arguments: [
      {
        name: "action",
        description: 'What the agent should do on the device, in one sentence (e.g. "press Home", "launch YouTube", "GET /query/active-app", "take a screenshot").',
        required: true
      },
      {
        name: "device",
        description: "Optional target device (IP or serial). Omit to use the focused Dev Studio tab.",
        required: false
      }
    ]
  },
  {
    name: "roku-action-script-quickstart",
    title: "Roku: Action Script \u2014 Quick Start",
    description: "Primes the agent to author an Action Script for multi-step / conditional / saved-or-reviewed flows (bridge probe \u2192 capability load \u2192 validate \u2192 send to Builder). For single actions, prefer `roku-one-shot-action`.",
    arguments: [
      {
        name: "goal",
        description: "What the Action Script should accomplish on the device (one or two sentences). Use this prompt only when the task needs ordering, conditions, polling waits, variables, or Builder review.",
        required: false
      }
    ]
  },
  {
    name: "roku-debug-device",
    title: "Roku: Debug a Device",
    description: "Primes the agent to inspect a Roku using read-only tools (probe_bridge \u2192 list_devices \u2192 get_selected_device \u2192 ecp_query / rale_get_node_by_id).",
    arguments: [
      {
        name: "device",
        description: "Optional target device (IP or serial). Omit to use the focused tab.",
        required: false
      }
    ]
  }
];
function renderOneShot(action, device) {
  return renderTemplate(one_shot_action_default, {
    actionDisplay: action || "(describe the action here)",
    deviceDisplay: device ? `"${device}"` : "(focused Dev Studio tab \u2014 omit `device` argument)"
  });
}
function renderQuickstart(goal) {
  return renderTemplate(action_script_quickstart_default, {
    goalSection: goal ? `## User goal
${goal}

` : ""
  });
}
function renderDebug(device) {
  return renderTemplate(debug_device_default, {
    targetSection: device ? `## Target device
${device}

` : "",
    deviceForUse: device ? `"${device}"` : "(focused tab)"
  });
}
function listPrompts() {
  return PROMPTS;
}
function getPrompt(name, args) {
  const prompt = PROMPTS.find((p) => p.name === name);
  if (!prompt) return null;
  const argText = (key) => {
    const v = args?.[key];
    return typeof v === "string" ? v.trim() : "";
  };
  if (name === "roku-one-shot-action") {
    return {
      description: prompt.description,
      messages: [
        {
          role: "user",
          content: { type: "text", text: renderOneShot(argText("action"), argText("device")) }
        }
      ]
    };
  }
  if (name === "roku-action-script-quickstart") {
    return {
      description: prompt.description,
      messages: [
        { role: "user", content: { type: "text", text: renderQuickstart(argText("goal")) } }
      ]
    };
  }
  if (name === "roku-debug-device") {
    return {
      description: prompt.description,
      messages: [
        { role: "user", content: { type: "text", text: renderDebug(argText("device")) } }
      ]
    };
  }
  return null;
}

// src/prose/server-instructions.md
var server_instructions_default = 'Roku Dev Studio MCP. Read `roku-dev-studio://quick-start.md` once (or invoke prompt `roku-action-script-quickstart`) to learn the workflow. Two surfaces: direct device ops (keypress / launch_app / ecp_query / rale_command / app_function / screenshot / telnet_connect+get_telnet_log / \u2026) and Action Scripts (`validate_script` \u2192 `send_script_to_builder`). Call `probe_bridge` before any live tool; if live=false, ask the user to open Roku Dev Studio. For a single channel function call use `app_function` directly \u2014 do **not** wrap it in a one-step Action Script. The set of available functions is **channel-specific**, so always call `list_app_connector_functions` first to discover names and param shapes; never assume a function exists across apps. `functionParams` is a **positional array** of one entry per declared parameter (`[ value0, value1, \u2026 ]`, not `{ paramName: value }`). For BrightScript debug console output (`print` / runtime errors), call `telnet_connect` once before `get_telnet_log` \u2014 logs only accumulate while attached, and `connected: false` means "call `telnet_connect` and retry", not "no logs". For script authoring, load `roku-dev-studio://capability-bundle.json` **once** and cache. Never embed `devPassword` in script JSON. Prefer tools whose `annotations.readOnlyHint` is true; confirm with the user before any `destructiveHint` tool. On `isError`, drive self-correction from `structuredContent` (path, code, errors[]).\n';

// src/index.ts
var SERVER_VERSION = "0.2.0";
var SERVER_NAME = "roku-dev-studio";
var PROTOCOL_VERSION = "2024-11-05";
var ERROR_CODES = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603
};
function logErr(message, ...rest) {
  console.error(`[roku-dev-studio-mcp] ${message}`, ...rest);
}
function writeMessage(msg) {
  const line = JSON.stringify(msg);
  process.stdout.write(line + "\n");
}
function makeError(id, code, message, data) {
  return { jsonrpc: "2.0", id, error: { code, message, ...data !== void 0 ? { data } : {} } };
}
function makeResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function toolToWire(t) {
  return {
    name: t.name,
    title: t.title || t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    ...t.annotations ? { annotations: t.annotations } : {}
  };
}
async function handleRequest(req) {
  const id = req.id ?? null;
  if (req.id === void 0) {
    if (req.method === "notifications/initialized" || req.method === "notifications/cancelled") {
      return null;
    }
    return null;
  }
  switch (req.method) {
    case "initialize": {
      return makeResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false, subscribe: false },
          prompts: { listChanged: false }
        },
        instructions: server_instructions_default.trim()
      });
    }
    case "ping":
      return makeResult(id, {});
    case "tools/list":
      return makeResult(id, { tools: TOOLS.map(toolToWire) });
    case "tools/call": {
      const params = req.params || {};
      const name = typeof params.name === "string" ? params.name : "";
      const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
      const tool = findTool(name);
      if (!tool) {
        return makeError(id, ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
      }
      try {
        const result = await tool.handler(args);
        return makeResult(id, result);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logErr(`tool ${name} threw:`, message);
        return makeResult(id, {
          content: [{ type: "text", text: `Tool ${name} error: ${message}` }],
          isError: true
        });
      }
    }
    case "resources/list":
      return makeResult(id, { resources: listResources() });
    case "resources/read": {
      const params = req.params || {};
      const uri = typeof params.uri === "string" ? params.uri : "";
      if (!uri) {
        return makeError(id, ERROR_CODES.INVALID_PARAMS, 'Missing required param "uri"');
      }
      const content = readResource(uri);
      if (!content) {
        return makeError(id, ERROR_CODES.METHOD_NOT_FOUND, `Unknown resource: ${uri}`);
      }
      return makeResult(id, { contents: [content] });
    }
    case "prompts/list":
      return makeResult(id, { prompts: listPrompts() });
    case "prompts/get": {
      const params = req.params || {};
      const name = typeof params.name === "string" ? params.name : "";
      const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
      const prompt = getPrompt(name, args);
      if (!prompt) {
        return makeError(id, ERROR_CODES.METHOD_NOT_FOUND, `Unknown prompt: ${name}`);
      }
      return makeResult(id, prompt);
    }
    case "logging/setLevel":
      return makeResult(id, {});
    default:
      return makeError(id, ERROR_CODES.METHOD_NOT_FOUND, `Method not implemented: ${req.method}`);
  }
}
function startStdioLoop() {
  let buf = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => {
    buf += chunk;
    let nl = buf.indexOf("\n");
    while (nl !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      nl = buf.indexOf("\n");
      if (!line) continue;
      void processLine(line);
    }
  });
  process.stdin.on("end", () => {
    process.exit(0);
  });
}
async function processLine(line) {
  let req;
  try {
    req = JSON.parse(line);
  } catch (e) {
    writeMessage(makeError(null, ERROR_CODES.PARSE, "Could not parse JSON-RPC message"));
    logErr("parse error", e);
    return;
  }
  if (req == null || typeof req !== "object" || req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    writeMessage(makeError((req && req.id) ?? null, ERROR_CODES.INVALID_REQUEST, "Not a valid JSON-RPC 2.0 request"));
    return;
  }
  try {
    const res = await handleRequest(req);
    if (res != null) writeMessage(res);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logErr(`unhandled error:`, message);
    writeMessage(makeError(req.id ?? null, ERROR_CODES.INTERNAL, message));
  }
}
logErr(
  `roku-dev-studio-mcp ${SERVER_VERSION} starting (protocol ${PROTOCOL_VERSION}, ${TOOLS.length} tools, ${listResources().length} resources, ${listPrompts().length} prompts)`
);
startStdioLoop();

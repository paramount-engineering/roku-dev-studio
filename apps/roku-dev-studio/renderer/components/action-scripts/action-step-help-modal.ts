/**
 * Help for Action Scripts builder steps: uses **action type** plus **current sub-selections**
 * (presets, wait mode, if source, RALE command, key, legacy telnet preset, etc.).
 */

import {
  getSchema,
  QUERY_PRESETS,
  POST_PRESETS,
  SYSTEM_TELNET_PRESETS,
  KEYPRESS_GROUPS
} from './action-registry.js';
import { getRaleBuiltinDefForCommand } from './rale-command-param-ui.js';
import { escapeHtml, setSafeHTML } from '../../modules/utils/dom.js';
import {
  prepareModalOpenOrigin,
  playModalOpenMotion,
  closeModalWithOriginMotion
} from '../../modules/utils/modal-origin-motion.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';

export type ActionStepHelpContext = {
  actionType: string;
  /** e.g. wait:condition:rale-node-field, query:custom, raleCommand:getNodeById */
  variantKey: string;
  /** Shown after em dash in the modal title */
  subtitle: string;
};

/**
 * Subset of an App Connector function record we care about for the help modal:
 * just enough to look up a function by name and surface its channel-supplied
 * description. Matches both `AppConnectorFunction` (modules/app-connector) and
 * `ExternalControlFunctionMeta` (inspector-types).
 */
type AppFunctionLike = { name?: string; description?: string };

/** Resolver for the currently-loaded App Connector function list. */
export type GetAppFunctions = () => unknown[] | null | undefined;

function selValue(root: HTMLElement, selector: string): string {
  const el = root.querySelector(selector);
  if (el instanceof HTMLSelectElement) return el.value.trim();
  return '';
}

function keypressLabelForValue(keyVal: string): string {
  if (!keyVal) return '';
  for (const g of KEYPRESS_GROUPS) {
    for (const k of g.keys) {
      const val = typeof k === 'string' ? k : k.value;
      if (val === keyVal) return typeof k === 'string' ? k : k.label;
    }
  }
  return keyVal;
}

/**
 * Reads the builder step-fields DOM to determine the current sub-action (preset, mode, command, etc.).
 */
export function collectActionStepHelpContext(
  actionType: string,
  fieldsRoot: HTMLElement | null
): ActionStepHelpContext {
  const type = actionType && String(actionType).trim() ? String(actionType).trim() : 'query';
  const root = fieldsRoot;

  if (!root) {
    return { actionType: type, variantKey: type, subtitle: '' };
  }

  if (type === 'query') {
    const preset = selValue(root, '.builder-query-preset');
    if (preset === '') {
      return { actionType: type, variantKey: 'query:custom', subtitle: 'Custom endpoint' };
    }
    const meta = QUERY_PRESETS.find((p) => p.endpoint === preset);
    const subtitle = meta ? meta.label : preset;
    return { actionType: type, variantKey: `query:${preset}`, subtitle };
  }

  if (type === 'post') {
    const ep = selValue(root, '.builder-post-preset');
    if (!ep) {
      return { actionType: type, variantKey: 'post:__none__', subtitle: 'Select a POST' };
    }
    const meta = POST_PRESETS.find((p) => p.endpoint === ep);
    return { actionType: type, variantKey: `post:${ep}`, subtitle: meta ? meta.label : ep };
  }

  if (type === 'wait') {
    const mode = selValue(root, '.builder-field-wait-mode') || 'delay';
    if (mode === 'delay') {
      return { actionType: type, variantKey: 'wait:delay', subtitle: 'Fixed delay' };
    }
    const src = selValue(root, '.builder-field-wait-source') || 'media-player';
    const srcLabel =
      src === 'rale-node-field'
        ? 'RALE node field'
        : src === 'media-player'
          ? 'Media player'
          : src;
    return {
      actionType: type,
      variantKey: `wait:condition:${src}`,
      subtitle: `Until condition · ${srcLabel}`
    };
  }

  if (type === 'if') {
    const src = selValue(root, '.builder-field-if-source') || 'media-player';
    const labels: Record<string, string> = {
      'media-player': 'Media player',
      'active-app': 'Active app',
      'rale-node-field': 'RALE node field',
      variables: 'Variables'
    };
    return { actionType: type, variantKey: `if:${src}`, subtitle: labels[src] || src };
  }

  if (type === 'raleCommand') {
    const cmd = selValue(root, '.builder-field-rale-command');
    if (!cmd) {
      return { actionType: type, variantKey: 'raleCommand:__none__', subtitle: 'Select a command' };
    }
    const def = getRaleBuiltinDefForCommand(cmd);
    return {
      actionType: type,
      variantKey: `raleCommand:${cmd}`,
      subtitle: def && def.label ? String(def.label) : cmd
    };
  }

  if (type === 'appFunction') {
    const fn = selValue(root, '.builder-field-functionName');
    if (!fn) {
      return { actionType: type, variantKey: 'appFunction:__none__', subtitle: 'Select a function' };
    }
    return { actionType: type, variantKey: `appFunction:${fn}`, subtitle: fn };
  }

  if (type === 'keypress') {
    const key = selValue(root, '.builder-field-key-select');
    if (!key) {
      return { actionType: type, variantKey: 'keypress:__none__', subtitle: 'Select a key' };
    }
    return { actionType: type, variantKey: `keypress:${key}`, subtitle: keypressLabelForValue(key) };
  }

  if (type === 'systemTelnet') {
    const cmd = selValue(root, '.builder-system-telnet-preset');
    const meta = SYSTEM_TELNET_PRESETS.find((p) => p.telnetCommand === cmd);
    return {
      actionType: type,
      variantKey: cmd ? `systemTelnet:${cmd}` : 'systemTelnet:__none__',
      subtitle: meta ? meta.label : cmd || 'Select command'
    };
  }

  return { actionType: type, variantKey: type, subtitle: '' };
}

/** Exact variant → body HTML (modal body only). */
const VARIANT_HELP_BODIES: Record<string, string> = {
  'query:custom': `
    <p>
      <strong>Custom</strong> lets you type any Device Query path yourself: a normal <code>/query/…</code> ECP GET, or
      dev-style values such as <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Use this when there is no preset for the endpoint you need. The value is sent as-is to the same query machinery as presets.</p>
  `,
  'query:telnet:plugins': `
    <p>
      Runs the developer <strong>plugins</strong> telnet command (packed channel list / plugin summary). This is the
      same data as choosing the Plugins preset in older flows, expressed as a query preset.
    </p>
    <p>Requires developer access to the device (same as other dev-plugin queries).</p>
  `,
  'query:telnet:free': `
    <p>
      Runs the developer <strong>free</strong> telnet command (memory / heap style snapshot). Use it when you need a
      quick memory readout during a script.
    </p>
  `,
  'post:__none__': `
    <p>Choose one of the <strong>POST</strong> presets (SGRendezvous, FW Beacons, etc.). Each option maps to a fixed path on the device.</p>
  `,
  'wait:delay': `
    <p>
      Pauses the script for the given number of <strong>milliseconds</strong> with no polling. Use after animations,
      launches, or any step where you only need a fixed pause.
    </p>
  `,
  'wait:condition:media-player': `
    <p>
      Polls <code>/query/media-player</code> until the player’s <strong>state</strong> matches your selection (play,
      pause, buffer, …) or the <strong>timeout</strong> elapses.
    </p>
    <p>
      Tune <strong>Poll interval</strong> to balance responsiveness vs load. If the condition never becomes true, the
      step fails when the timeout is reached.
    </p>
  `,
  'wait:condition:rale-node-field': `
    <p>
      Polls via <strong>RALE</strong> until a field on a scene node matches the comparison (operator + value). You must
      supply path (JSON array), node id, field name, and timing fields.
    </p>
    <p>
      Requires an App Connector connection at run time. Operators like <code>exists</code> / <code>notExists</code> may
      hide the value field—see the form labels for the active mode.
    </p>
  `,
  'if:media-player': `
    <p>
      Evaluates the current <strong>media player</strong> state once and runs either the <strong>then</strong> or
      <strong>else</strong> branch. Pick the expected state (play, pause, …) to branch on.
    </p>
    <p>Unlike <strong>Wait</strong>, there is no polling: the condition is checked a single time when the step runs.</p>
  `,
  'if:active-app': `
    <p>
      Compares one attribute from <code>/query/active-app</code> (app id, type, version, name) using the operator and
      value you set. Useful for branching when a specific channel is foregrounded.
    </p>
  `,
  'if:rale-node-field': `
    <p>
      One-shot check of a <strong>RALE node field</strong> (path, node id, field, operator, value). Same shape as the
      RALE side of a Wait condition, but evaluated once for branching.
    </p>
  `,
  'if:variables': `
    <p>
      Compares a value stored in a <strong>script variable</strong> (from a previous RALE Command or App Function assign)
      using the variable path and operator you configure.
    </p>
    <p>Requires script version 2 and earlier steps that populate the variable.</p>
  `,
  'raleCommand:__none__': `
    <p>Select a <strong>RALE command</strong> from the list. Parameters and optional “Set var” appear after a command is chosen.</p>
  `,
  'appFunction:__none__': `
    <p>
      Connect <strong>App Connector</strong> so your channel’s exported functions appear in the list, then pick a
      function to see its parameters.
    </p>
  `,
  'keypress:__none__': `
    <p>Pick a <strong>remote key</strong> from the grouped list. The script sends that key over ECP when the step runs.</p>
  `,
  'systemTelnet:__none__': `
    <p>Choose <strong>Plugins</strong> or <strong>Memory</strong> for this legacy step, or migrate to Device Query with the matching telnet presets.</p>
  `,
  'systemTelnet:plugins': `
    <p>Legacy telnet <strong>plugins</strong> command. Prefer <strong>Device Query</strong> with preset <code>telnet:plugins</code> for new scripts.</p>
  `,
  'systemTelnet:free': `
    <p>Legacy telnet <strong>free</strong> (memory) command. Prefer <strong>Device Query</strong> with preset <code>telnet:free</code> for new scripts.</p>
  `
};

/** Fallback body per top-level action type (when no variant match). */
const ACTION_FALLBACK_BODIES: Record<string, string> = {
  query: `
    <p>
      Runs a read against the device: either a normal <strong>ECP GET</strong> on a <code>/query/…</code> path or a
      dev-style endpoint such as <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Choose a preset for common endpoints, or <strong>Custom</strong> to type your own.</p>
  `,
  post: `
    <p>
      Sends an <strong>HTTP POST</strong> to the Roku on a fixed analytics / beacon path. Each preset maps to a
      specific endpoint used in development workflows.
    </p>
  `,
  keypress: `
    <p>
      Sends a <strong>remote control key</strong> over ECP. The help title reflects which key is currently selected when
      you open this dialog.
    </p>
  `,
  inputText: `
    <p>
      Sends <strong>keyboard-style text</strong> to the device (ECP input entry). The focused field or on-screen
      keyboard receives the characters.
    </p>
  `,
  launch: `
    <p>
      Launches a channel by <strong>app ID</strong>. Optional <strong>params</strong> can supply a deep link or launch
      arguments depending on the channel.
    </p>
  `,
  sideload: `
    <p>
      Uploads a package from the <strong>file path</strong> and installs it as the sideloaded developer channel. Supply a
      developer password on the step or via script <code>devPassword</code> when required.
    </p>
  `,
  deleteSideload: `
    <p>Removes the sideloaded developer channel. Optional password matches your device’s dev security settings.</p>
  `,
  appFunction: `
    <p>
      Calls a <strong>BrightScript function</strong> over App Connector. The subtitle shows the <strong>selected
      function</strong>. Parameters match the channel’s exported signature; use <strong>Set var</strong> to capture a
      return value for later steps.
    </p>
  `,
  raleCommand: `
    <p>
      Runs a <strong>built-in RALE command</strong>. The subtitle shows the selected command; extended copy comes from
      the command’s built-in description when available.
    </p>
  `,
  devicePerformance: `
    <p>
      Snapshots <strong>Device Performance</strong> charts for the <strong>same device</strong> this script runs on (the
      same connection as Device Query and keypress). Values follow the Remote tab history settings when live polling has
      filled the charts; otherwise the step waits briefly for a fresh sample when needed.
    </p>
    <h4>Chart</h4>
    <p>
      <strong>BrightScript Objects</strong>, <strong>CPU Usage</strong>, <strong>System Memory</strong>, or
      <strong>Above All</strong> (one combined result: CPU, then memory, then objects). CPU and memory are driven from the
      same channel performance poll.
    </p>
    <h4>Optional label</h4>
    <p>Shown in the results header, similar to the screenshot step.</p>
  `,
  screenshot: `
    <p>
      Captures the TV image through the <strong>Developer App</strong>. The Developer App should be active; a
      developer password must be available on the step, script, or validation prompt.
    </p>
    <h4>Wait before (ms)</h4>
    <p>
      Pause in the executor <strong>before</strong> capture starts so the UI can settle (default 100 ms when you add
      the step).
    </p>
    <h4>Wait after (ms)</h4>
    <p>
      After triggering capture, the executor waits before downloading <code>dev.jpg</code>. Increase if images are
      truncated; empty uses <strong>1500 ms</strong> default.
    </p>
    <h4>Optional label</h4>
    <p>Helps identify this capture in run output when a script takes multiple screenshots.</p>
  `,
  wait: `
    <p>
      Either a <strong>fixed delay</strong> or <strong>until a condition</strong> holds. The subtitle reflects the
      current wait type and, for conditions, the data source (media player vs RALE node field).
    </p>
  `,
  if: `
    <p>
      Branches into <strong>then</strong> / <strong>else</strong> step lists using a one-shot condition. The subtitle
      reflects the selected condition source (media player, active app, RALE field, or variables). Requires script
      version 2.
    </p>
  `,
  systemTelnet: `
    <p>
      <strong>Legacy</strong> telnet-only step. Prefer <strong>Device Query</strong> with <code>telnet:plugins</code> or
      <code>telnet:free</code> for new scripts.
    </p>
  `
};

function queryPresetBody(endpoint: string, label: string): string {
  return `
    <p>
      Runs a <strong>Device Query</strong> for <strong>${escapeHtml(label)}</strong> using endpoint
      <code>${escapeHtml(endpoint)}</code>.
    </p>
    <p>
      Like all queries, this uses ECP (or the app’s dev-plugin path for telnet-style presets). The device must be
      reachable on the network.
    </p>
  `;
}

function postPresetBody(label: string, endpoint: string): string {
  return `
    <p>
      Sends an HTTP <strong>POST</strong> to <code>${escapeHtml(endpoint)}</code> (<strong>${escapeHtml(label)}</strong>).
    </p>
    <p>Use this for analytics / beacon flows that expect POST rather than GET.</p>
  `;
}

function findAppFunctionDescription(
  appFunctions: unknown[] | null | undefined,
  fnName: string
): string {
  if (!Array.isArray(appFunctions)) return '';
  for (const f of appFunctions) {
    if (!f || typeof f !== 'object') continue;
    const meta = f as AppFunctionLike;
    if (meta.name === fnName && typeof meta.description === 'string') {
      const desc = meta.description.trim();
      if (desc) return desc;
    }
  }
  return '';
}

function resolveBodyHtml(
  ctx: ActionStepHelpContext,
  getAppFunctions?: GetAppFunctions
): string {
  const { actionType, variantKey } = ctx;

  if (VARIANT_HELP_BODIES[variantKey]) {
    return VARIANT_HELP_BODIES[variantKey];
  }

  if (actionType === 'query' && variantKey.startsWith('query:')) {
    const endpoint = variantKey.slice('query:'.length);
    const preset = QUERY_PRESETS.find((p) => p.endpoint === endpoint);
    if (preset) return queryPresetBody(preset.endpoint, preset.label);
  }

  if (actionType === 'post' && variantKey.startsWith('post:')) {
    const endpoint = variantKey.slice('post:'.length);
    const preset = POST_PRESETS.find((p) => p.endpoint === endpoint);
    if (preset) return postPresetBody(preset.label, preset.endpoint);
  }

  if (actionType === 'raleCommand' && variantKey.startsWith('raleCommand:')) {
    const cmd = variantKey.slice('raleCommand:'.length);
    const def = getRaleBuiltinDefForCommand(cmd);
    if (def && typeof def.description === 'string') {
      return `<p>${escapeHtml(def.description)}</p>`;
    }
  }

  if (actionType === 'appFunction' && variantKey.startsWith('appFunction:')) {
    const fn = variantKey.slice('appFunction:'.length);
    if (fn && fn !== '__none__') {
      const fns = typeof getAppFunctions === 'function' ? getAppFunctions() : null;
      const desc = findAppFunctionDescription(fns, fn);
      const descBlock = desc
        ? `<p><strong>App Function Description:</strong> ${escapeHtml(desc)}</p>`
        : '';
      return `
        ${ACTION_FALLBACK_BODIES.appFunction}
        <p><strong>Selected function:</strong> <code>${escapeHtml(fn)}</code></p>
        ${descBlock}
        <p>Argument rows follow the App Connector metadata for this function; complex types use JSON in the field.</p>
      `;
    }
  }

  if (actionType === 'keypress' && variantKey.startsWith('keypress:')) {
    const key = variantKey.slice('keypress:'.length);
    if (key && key !== '__none__') {
      const nice = keypressLabelForValue(key);
      return `
        ${ACTION_FALLBACK_BODIES.keypress}
        <p>
          <strong>Current key:</strong> ${escapeHtml(nice)} (<code>${escapeHtml(key)}</code>) — sent as a standard ECP
          keypress when the step runs.
        </p>
      `;
    }
  }

  if (ACTION_FALLBACK_BODIES[actionType]) {
    return ACTION_FALLBACK_BODIES[actionType];
  }

  const meta = getSchema(actionType);
  if (meta && typeof meta.description === 'string') {
    return `<p>${escapeHtml(meta.description)}</p>`;
  }
  return `<p>${escapeHtml(`No help text for “${actionType}”.`)}</p>`;
}

function modalTitle(ctx: ActionStepHelpContext): string {
  if (ctx.actionType === 'systemTelnet') {
    const base = 'Plugins / Memory (legacy)';
    return ctx.subtitle && ctx.subtitle !== 'Select command' ? `${base} · ${ctx.subtitle}` : base;
  }
  const meta = getSchema(ctx.actionType);
  const base = meta && typeof meta.label === 'string' ? meta.label : ctx.actionType;
  if (ctx.subtitle) return `${base} · ${ctx.subtitle}`;
  return base;
}

/**
 * Opens help for the current builder row: **action type** from `actionType` and **sub-selections** read from
 * `fieldsRoot` (the `.action-scripts-builder-step-fields` element). Pass `null` for fields when the DOM is not
 * available — falls back to type-only context.
 *
 * `getAppFunctions` (optional) lets the modal surface the channel-supplied
 * description for the currently-selected App Function. Pass the Builder's
 * cached function list (e.g. `() => raleFunctions`); descriptions are looked
 * up by `name`.
 */
export function openActionStepHelpModal(
  actionType: string,
  fieldsRoot: HTMLElement | null,
  opener?: HTMLElement | null,
  getAppFunctions?: GetAppFunctions
) {
  const ctx = collectActionStepHelpContext(actionType, fieldsRoot);
  const titleText = modalTitle(ctx);
  const bodyHtml = resolveBodyHtml(ctx, getAppFunctions);

  document.querySelectorAll('.action-scripts-step-help-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay action-scripts-step-help-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'action-scripts-step-help-title');

  const close = () => {
    closeModalWithOriginMotion(overlay, () => {
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
    });
  };

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  setSafeHTML(
    overlay,
    `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title" id="action-scripts-step-help-title">
          <span class="icon icon-sm"><svg><use href="#icon-info"/></svg></span>
          ${escapeHtml(titleText)}
        </span>
        <button type="button" class="modal-close action-scripts-step-help-close" title="Close" aria-label="Close">
          <span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span>
        </button>
      </div>
      <div class="modal-body">
        ${bodyHtml}
      </div>
    </div>
  `
  );

  prepareModalOpenOrigin(overlay, opener ?? null);
  document.body.appendChild(overlay);
  overlay.classList.add('active');
  overlay.classList.add('modal-motion-enabled');
  playModalOpenMotion(overlay);
  document.addEventListener('keydown', onKeyDown);

  const closeBtn = overlay.querySelector('.action-scripts-step-help-close');
  if (closeBtn instanceof HTMLElement) {
    closeBtn.addEventListener('click', close);
  }
  // Backdrop click-to-close, mousedown-gated so a text selection inside the
  // dialog body that ends on the backdrop doesn't dismiss the modal.
  attachBackdropClickToClose(overlay, close);
}

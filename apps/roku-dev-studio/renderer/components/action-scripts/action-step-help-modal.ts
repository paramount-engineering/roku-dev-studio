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
import { S } from '@shared/strings/index.js';

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
      return { actionType: type, variantKey: 'query:custom', subtitle: S.actionScripts.helpSubCustomEndpoint };
    }
    const meta = QUERY_PRESETS.find((p) => p.endpoint === preset);
    const subtitle = meta ? meta.label : preset;
    return { actionType: type, variantKey: `query:${preset}`, subtitle };
  }

  if (type === 'post') {
    const ep = selValue(root, '.builder-post-preset');
    if (!ep) {
      return { actionType: type, variantKey: 'post:__none__', subtitle: S.actionScripts.helpSubSelectPost };
    }
    const meta = POST_PRESETS.find((p) => p.endpoint === ep);
    return { actionType: type, variantKey: `post:${ep}`, subtitle: meta ? meta.label : ep };
  }

  if (type === 'wait') {
    const mode = selValue(root, '.builder-field-wait-mode') || 'delay';
    if (mode === 'delay') {
      return { actionType: type, variantKey: 'wait:delay', subtitle: S.actionScripts.helpSubFixedDelay };
    }
    const src = selValue(root, '.builder-field-wait-source') || 'media-player';
    const srcLabel =
      src === 'rale-node-field'
        ? S.actionScripts.sourceRaleNodeField
        : src === 'media-player'
          ? S.actionScripts.sourceMediaPlayer
          : src;
    return {
      actionType: type,
      variantKey: `wait:condition:${src}`,
      subtitle: S.actionScripts.helpUntilCondition(srcLabel)
    };
  }

  if (type === 'if') {
    const src = selValue(root, '.builder-field-if-source') || 'media-player';
    const labels: Record<string, string> = {
      'media-player': S.actionScripts.sourceMediaPlayer,
      'active-app': S.actionScripts.sourceActiveApp,
      'rale-node-field': S.actionScripts.sourceRaleNodeField,
      variables: S.actionScripts.sourceVariables
    };
    return { actionType: type, variantKey: `if:${src}`, subtitle: labels[src] || src };
  }

  if (type === 'raleCommand') {
    const cmd = selValue(root, '.builder-field-rale-command');
    if (!cmd) {
      return { actionType: type, variantKey: 'raleCommand:__none__', subtitle: S.actionScripts.helpSubSelectCommand };
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
      return { actionType: type, variantKey: 'appFunction:__none__', subtitle: S.actionScripts.selectAFunction };
    }
    return { actionType: type, variantKey: `appFunction:${fn}`, subtitle: fn };
  }

  if (type === 'keypress') {
    const key = selValue(root, '.builder-field-key-select');
    if (!key) {
      return { actionType: type, variantKey: 'keypress:__none__', subtitle: S.actionScripts.helpSubSelectKey };
    }
    return { actionType: type, variantKey: `keypress:${key}`, subtitle: keypressLabelForValue(key) };
  }

  if (type === 'systemTelnet') {
    const cmd = selValue(root, '.builder-system-telnet-preset');
    const meta = SYSTEM_TELNET_PRESETS.find((p) => p.telnetCommand === cmd);
    return {
      actionType: type,
      variantKey: cmd ? `systemTelnet:${cmd}` : 'systemTelnet:__none__',
      subtitle: meta ? meta.label : cmd || S.actionScripts.helpSubSelectCommandShort
    };
  }

  return { actionType: type, variantKey: type, subtitle: '' };
}

/** Exact variant → body HTML (modal body only). */
const VARIANT_HELP_BODIES: Record<string, string> = {
  'query:custom': S.actionScripts.helpBodyQueryCustom,
  'query:telnet:plugins': S.actionScripts.helpBodyQueryTelnetPlugins,
  'query:telnet:free': S.actionScripts.helpBodyQueryTelnetFree,
  'post:__none__': S.actionScripts.helpBodyPostNone,
  'wait:delay': S.actionScripts.helpBodyWaitDelay,
  'wait:condition:media-player': S.actionScripts.helpBodyWaitMediaPlayer,
  'wait:condition:rale-node-field': S.actionScripts.helpBodyWaitRale,
  'if:media-player': S.actionScripts.helpBodyIfMediaPlayer,
  'if:active-app': S.actionScripts.helpBodyIfActiveApp,
  'if:rale-node-field': S.actionScripts.helpBodyIfRale,
  'if:variables': S.actionScripts.helpBodyIfVariables,
  'raleCommand:__none__': S.actionScripts.helpBodyRaleNone,
  'appFunction:__none__': S.actionScripts.helpBodyAppFunctionNone,
  'keypress:__none__': S.actionScripts.helpBodyKeypressNone,
  'systemTelnet:__none__': S.actionScripts.helpBodySystemTelnetNone,
  'systemTelnet:plugins': S.actionScripts.helpBodySystemTelnetPlugins,
  'systemTelnet:free': S.actionScripts.helpBodySystemTelnetFree
};

/** Fallback body per top-level action type (when no variant match). */
const ACTION_FALLBACK_BODIES: Record<string, string> = {
  query: S.actionScripts.helpFallbackQuery,
  post: S.actionScripts.helpFallbackPost,
  keypress: S.actionScripts.helpFallbackKeypress,
  inputText: S.actionScripts.helpFallbackInputText,
  launch: S.actionScripts.helpFallbackLaunch,
  sideload: S.actionScripts.helpFallbackSideload,
  deleteSideload: S.actionScripts.helpFallbackDeleteSideload,
  appFunction: S.actionScripts.helpFallbackAppFunction,
  raleCommand: S.actionScripts.helpFallbackRaleCommand,
  devicePerformance: S.actionScripts.helpFallbackDevicePerformance,
  screenshot: S.actionScripts.helpFallbackScreenshot,
  wait: S.actionScripts.helpFallbackWait,
  if: S.actionScripts.helpFallbackIf,
  systemTelnet: S.actionScripts.helpFallbackSystemTelnet
};

function queryPresetBody(endpoint: string, label: string): string {
  return S.actionScripts.helpQueryPresetBody(escapeHtml(label), escapeHtml(endpoint));
}

function postPresetBody(label: string, endpoint: string): string {
  return S.actionScripts.helpPostPresetBody(escapeHtml(label), escapeHtml(endpoint));
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
        ? S.actionScripts.helpAppFunctionDescription(escapeHtml(desc))
        : '';
      return `
        ${ACTION_FALLBACK_BODIES.appFunction}
        ${S.actionScripts.helpSelectedFunction(escapeHtml(fn))}
        ${descBlock}
        ${S.actionScripts.helpAppFunctionArgs}
      `;
    }
  }

  if (actionType === 'keypress' && variantKey.startsWith('keypress:')) {
    const key = variantKey.slice('keypress:'.length);
    if (key && key !== '__none__') {
      const nice = keypressLabelForValue(key);
      return `
        ${ACTION_FALLBACK_BODIES.keypress}
        ${S.actionScripts.helpCurrentKey(escapeHtml(nice), escapeHtml(key))}
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
  return `<p>${escapeHtml(S.actionScripts.helpNoText(actionType))}</p>`;
}

function modalTitle(ctx: ActionStepHelpContext): string {
  if (ctx.actionType === 'systemTelnet') {
    const base = S.actionScripts.helpSystemTelnetTitle;
    return ctx.subtitle && ctx.subtitle !== S.actionScripts.helpSubSelectCommandShort ? `${base} · ${ctx.subtitle}` : base;
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
        <button type="button" class="modal-close action-scripts-step-help-close" title="${S.common.close}" aria-label="${S.common.close}">
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

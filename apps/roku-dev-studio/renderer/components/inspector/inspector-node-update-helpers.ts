/**
 * Update Node (inspector): display policy, response shaping, and panel chrome.
 * Keeps rules in one place for the getNodeById / modal flow.
 */

export interface NodeUpdateContext {
  path: unknown[];
  item?: unknown;
  fieldlistMeta: Record<string, { fieldType: string }>;
  fieldlistValues: Record<string, unknown>;
}

/** RALE commands issued from the Update Node modal — must not reset node UI state. */
export const NODE_UPDATE_KEEP_CONTEXT_COMMANDS = new Set(['setField', 'removeField', 'selectNode']);

/**
 * Status-only line (e.g. "Sending…") with no command/response object.
 */
export function isStatusOnlyPayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  return o.status != null && o.command == null && o.response == null;
}

export function getResponseCommand(data: unknown): string | undefined {
  if (!data || typeof data !== 'object' || !('command' in data)) return undefined;
  const c = (data as { command?: string }).command;
  return typeof c === 'string' ? c : undefined;
}

/**
 * Remove internal `fieldlistMeta` / `fieldListMeta` from getNodeById display payload
 * (inspector context is built from the unstripped object before this runs).
 */
function omitFieldlistMetaKeys(r: Record<string, unknown>): Record<string, unknown> {
  const { fieldlistMeta: _m, fieldListMeta: _M, ...rest } = r;
  return rest;
}

/**
 * Remove internal `fieldlistMeta` from getNodeById display payload (still used in context).
 */
export function stripFieldlistMetaForDisplay(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const o = data as Record<string, unknown>;

  if (o.command === 'getNodeById') {
    const resp = o.response;
    if (resp && typeof resp === 'object' && !Array.isArray(resp)) {
      const r = /** @type {Record<string, unknown>} */ (resp);
      const hasMeta =
        Object.prototype.hasOwnProperty.call(r, 'fieldlistMeta') ||
        Object.prototype.hasOwnProperty.call(r, 'fieldListMeta');
      if (hasMeta) {
        return { ...o, response: omitFieldlistMetaKeys(r as Record<string, unknown>) };
      }
    }
    return data;
  }

  // Raw getNode body (e.g. Action Script executor `raleCommand` `result.data` without App Connector wrapper)
  const hasFieldList =
    Object.prototype.hasOwnProperty.call(o, 'fieldlist') ||
    Object.prototype.hasOwnProperty.call(o, 'fieldList');
  const hasMeta =
    Object.prototype.hasOwnProperty.call(o, 'fieldlistMeta') ||
    Object.prototype.hasOwnProperty.call(o, 'fieldListMeta');
  if (hasFieldList && hasMeta) {
    return omitFieldlistMetaKeys(o);
  }

  return data;
}

/**
 * Build modal context from a successful getNodeById `response` object.
 */
export function buildNodeUpdateContextFromResponse(r: Record<string, unknown>): NodeUpdateContext {
  const fl = r.fieldlist;
  return {
    path: Array.isArray(r.path) ? r.path : [],
    item: r.item,
    fieldlistMeta:
      r.fieldlistMeta && typeof r.fieldlistMeta === 'object' && !Array.isArray(r.fieldlistMeta)
        ? (r.fieldlistMeta as Record<string, { fieldType: string }>)
        : {},
    fieldlistValues:
      fl && typeof fl === 'object' && !Array.isArray(fl) ? (fl as Record<string, unknown>) : {}
  };
}

/**
 * TrackerTask can return a structured getNodeById body (path array, item, fieldlist, layout) even when
 * the node is invalid — with nested `{ error: { message } }` and `item.type` `roInvalid`.
 */
export function isValidGetNodeByIdResponseForNodeUpdate(r: unknown): boolean {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  const o = r as Record<string, unknown>;

  if (hasNestedRaleError(o)) return false;
  if (!Array.isArray(o.path)) return false;

  const item = o.item;
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const typ = String((item as Record<string, unknown>).type ?? '').toLowerCase();
  if (typ === 'roinvalid') return false;

  const fl = o.fieldlist ?? o.fieldList;
  if (hasNestedRaleError(fl)) return false;

  if (hasNestedRaleError(o.layout)) return false;

  return true;
}

/** True if `x` is `{ error: { message: non-empty string } }` (RALE getError shape). */
function hasNestedRaleError(x: unknown): boolean {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const e = (x as Record<string, unknown>).error;
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
  const msg = (e as Record<string, unknown>).message;
  return typeof msg === 'string' && msg.length > 0;
}

/** Hide Update Node button and close modal (programmatic reset). */
export function hideNodeUpdateChrome(panel: HTMLElement) {
  const updateBtn = panel.querySelector('.rale-update-node-btn');
  const updateModal = panel.querySelector('.rale-update-node-modal');
  if (updateBtn instanceof HTMLElement) updateBtn.style.display = 'none';
  if (updateModal) {
    updateModal.classList.remove('active');
    updateModal.setAttribute('aria-hidden', 'true');
  }
}

/** Whether to clear stored context and hide chrome. */
export function shouldResetNodeUpdateInspector(cmd: string | undefined, isError: boolean): boolean {
  if (!isError) {
    return !!(cmd && cmd !== 'getNodeById' && !NODE_UPDATE_KEEP_CONTEXT_COMMANDS.has(cmd));
  }
  return !(cmd && NODE_UPDATE_KEEP_CONTEXT_COMMANDS.has(cmd));
}

/**
 * Whether the Update Node modal should forward this success payload to the main Response panel.
 * (Errors always forward.)
 */
export function modalShouldForwardToMainResponse(cmd: string | undefined, data: unknown): boolean {
  if (cmd === 'setField' || cmd === 'removeField' || cmd === 'selectNode') {
    return false;
  }
  if (isStatusOnlyPayload(data)) {
    return false;
  }
  return true;
}
